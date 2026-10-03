// Sends copies of this browser's islands and of who you are to the keeper, a
// computer that keeps them whenever it is online (see shared/keeper.js and
// server/keeper.js). It is reached peer to peer, like a friend's island, under
// the peer id in keeper.json, and has to prove it holds that file's key before
// anything is sent. Nothing waits on it: while it is away, copies wait here
// and go the next time both are on.
//
// It also logs you in and out there. Logged in, it brings back what your
// other devices sent, too: your look, stickers and basket, merged with yours
// here, and newer copies of your islands.
//
// States: off (no keeper, or switched off), idle, connecting, ready, away,
// refused, gone (the login this page was using was removed).

import { signalingOptions } from './net.js';
import { load, save, listIslands, loadIsland, storeIsland, forgetIsland, MAX_ISLANDS } from './storage.js';
import { Reassembler, sendText } from './shared/framing.js';
import { isDeviceKey, isPeerId, isPublicKey, keptProfile, KEEPER_VERSION, KEY_ALGORITHM, planSync, randomHex, verifySignature } from './shared/keeper.js';

const FIRST_TRY_MS = 3000;
// The first retry is soon, for a blip; after that the keeper is probably off.
const RETRY_MS = [5000, 30000, 60000, 120000, 300000, 600000];
const REFUSED_RETRY_MS = 30 * 60000;
const CONNECT_TIMEOUT_MS = 25000;
const REPLY_TIMEOUT_MS = 60000;
const IDLE_MS = 60000;
// What you have done changes with every step: when nothing else about you
// changed, a copy every few minutes is plenty.
const PROFILE_EVERY_MS = 3 * 60000;
// Logged in, coming back to the game after this long asks the keeper for news.
const RESYNC_MS = 2 * 60000;

// Why the keeper could not do something you asked: asleep (not online),
// refused (someone else has its id), gone (your login was removed), none (no
// keeper), or what it said: wrong (password), wait, weak (password), bad, full.
export class KeeperProblem extends Error {
  constructor(code, text = '', extra = {}) {
    super(text || code);
    this.code = code;
    Object.assign(this, extra);
  }
}

// The owner's token from an island's save: the host player's. Islands of yours
// that come from the keeper open with it, so you are their owner here too.
function ownerToken(save) {
  const tokens = Array.isArray(save?.tokens) ? save.tokens : [];
  return tokens.find((t) => Array.isArray(t) && t[1] === save.host && typeof t[0] === 'string')?.[0] ?? '';
}

export class KeeperClient extends EventTarget {
  // login: { player, token } when logged in on this device.
  constructor({ profile, login = null, configUrl = 'keeper.json' }) {
    super();
    this.profile = profile;
    this.login = login;
    this.configUrl = configUrl;
    this.config = null;
    this.publicKey = null;
    this.state = 'off';
    this.peer = null;
    this.conn = null;
    this.timer = 0;
    this.replyTimer = 0;
    this.idleTimer = 0;
    this.failures = 0;
    this.waiting = null;
    this.profileSentAt = 0;
    // What you asked for (logging in, out...), sent before any copy.
    this.requests = [];
    // Logged in: whether this connection brought back what the keeper has yet,
    // and whether the login still needs a password (it was made with secret
    // pictures, before passwords).
    this.listed = false;
    this.needsPassword = false;
    this.toFetch = [];
    this.syncedAt = 0;
    const saved = load('keeper', null);
    this.data = {
      device: isDeviceKey(saved?.device) ? saved.device : randomHex(16),
      sent: saved?.sent && typeof saved.sent === 'object' ? saved.sent : {},
      profile: typeof saved?.profile === 'string' ? saved.profile : '',
      lastKept: Number.isFinite(saved?.lastKept) ? saved.lastKept : 0,
      // Islands you said goodbye to while logged in, for your other devices to drop too.
      forgets: saved?.forgets && typeof saved.forgets === 'object' ? saved.forgets : {},
    };
    this.store();
  }

  // Logged in, copies always go: that is what the login is for.
  get enabled() {
    return Boolean(this.login) || this.profile.settings.keeper !== false;
  }

  get lastKept() {
    return this.data.lastKept;
  }

  // Whether a copy is on its way (or about to be, once connected).
  get sending() {
    return this.state === 'connecting' || Boolean(this.waiting);
  }

  // Whether this logged-in page is still bringing back what the keeper has.
  get syncing() {
    return Boolean(this.login) && this.state === 'ready' && (!this.listed || this.toFetch.length > 0);
  }

  store() {
    save('keeper', this.data);
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.dispatchEvent(new CustomEvent('status', { detail: { state } }));
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // Reads keeper.json. Without one (or without what checking it takes), there is no keeper.
  async start() {
    try {
      if (typeof Peer === 'undefined' || !globalThis.crypto?.subtle) return;
      const res = await fetch(this.configUrl, { cache: 'no-cache' });
      if (!res.ok) return;
      const config = await res.json();
      if (!isPeerId(config?.peer) || !isPublicKey(config.key)) return;
      this.peerOptions = config.signal ? signalingOptions(new URLSearchParams({ signal: config.signal })) : {};
      this.publicKey = await crypto.subtle.importKey('jwk', config.key, KEY_ALGORITHM, false, ['verify']);
      this.config = config;
    } catch {
      return;
    } finally {
      this.emit('config');
    }
    window.addEventListener('online', () => {
      if (this.state === 'away') this.schedule(FIRST_TRY_MS);
    });
    // Logged in, back on this device after a while: anything new from your others?
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.resync();
    });
    this.setState(this.enabled ? 'idle' : 'off');
    if (this.enabled && this.pending()) this.schedule(this.login ? 0 : FIRST_TRY_MS);
  }

  setEnabled(on) {
    if (!this.config) return;
    if (!on) {
      this.hangUp();
      clearTimeout(this.timer);
      this.timer = 0;
      this.setState('off');
    } else if (this.state === 'off') {
      this.failures = 0;
      this.setState('idle');
      this.nudge();
    }
  }

  // Something new to copy: an island was saved, or you changed.
  nudge() {
    if (!this.config || !this.enabled || this.state === 'gone' || this.halted) return;
    if (this.state === 'ready') this.flush();
    else if (this.state === 'idle' && !this.timer && this.pending()) this.schedule(FIRST_TRY_MS);
  }

  // Logged in: asks the keeper for news, unless it was asked lately.
  resync(force = false) {
    if (!this.login || !this.config || this.state === 'gone') return;
    if (!force && Date.now() - this.syncedAt < RESYNC_MS) return;
    this.listed = false;
    if (this.state === 'ready') this.flush();
    else if (this.state === 'idle' || this.state === 'away') this.schedule(0);
  }

  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = 0;
      if (this.requests.length || (this.enabled && this.pending())) this.connect();
      else if (this.state !== 'off') this.setState('idle');
    }, ms);
  }

  // What to send next, after anything you asked for: logged in, what it takes
  // to bring back what the keeper has, and the islands you said goodbye to;
  // then you, when you changed (only now and then when all that changed is
  // what you have done), else the most recently saved island the keeper does
  // not have yet. Each comes with what to do with the keeper's answer.
  next() {
    if (!this.enabled) return null;
    if (this.login) {
      if (!this.listed) return { msg: { t: 'list' }, answer: (reply) => this.listedAs(reply) };
      const id = this.toFetch[0];
      if (id) return { msg: { t: 'fetch', id }, answer: (reply) => this.fetched(id, reply) };
      const [gone, at] = Object.entries(this.data.forgets)[0] ?? [];
      if (gone) return this.copy({ t: 'forget', id: gone, at }, () => delete this.data.forgets[gone]);
    }
    const kept = keptProfile(this.profile.data);
    const profile = JSON.stringify(kept);
    if (profile !== this.data.profile) {
      const before = this.data.profile ? JSON.parse(this.data.profile) : {};
      const onlyStats = JSON.stringify({ ...kept, stats: 0 }) === JSON.stringify({ ...before, stats: 0 });
      if (!onlyStats || Date.now() - this.profileSentAt >= PROFILE_EVERY_MS) {
        return this.copy({ t: 'profile', profile: kept }, () => (this.data.profile = profile));
      }
    }
    const islands = listIslands()
      .filter((i) => (i.savedAt ?? 0) > (this.data.sent[i.id] ?? 0))
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    for (const item of islands) {
      const island = loadIsland(item.id);
      if (!island) continue;
      const savedAt = island.savedAt ?? item.savedAt;
      return this.copy({ t: 'island', id: item.id, save: island }, () => (this.data.sent[item.id] = savedAt));
    }
    return null;
  }

  // A copy for the keeper to keep. Once it says it did, or that it never
  // will (bad), done() notes it.
  copy(msg, done) {
    return {
      msg,
      answer: (reply) => {
        if (reply.t === 'error' && reply.code !== 'bad') {
          this.away();
          return;
        }
        done();
        if (reply.t === 'kept') {
          this.data.lastKept = Date.now();
          this.failures = 0;
        }
        // Another device sent a newer copy meanwhile: bring that one back.
        if (reply.stale) this.listed = false;
        this.store();
        this.emit('kept', reply);
      },
    };
  }

  pending() {
    return this.requests.length > 0 || this.next() !== null;
  }

  // ------------------------------------------------ asking

  // Asks the keeper something, connecting for it even if copies are off.
  // Resolves with its answer; rejects with a KeeperProblem when it said no or
  // could not be reached. halt: hang up as soon as it answers, before any
  // copy goes, as the page reloads as someone else next.
  request(msg, { halt = false } = {}) {
    if (!this.config) return Promise.reject(new KeeperProblem('none'));
    if (this.state === 'gone') return Promise.reject(new KeeperProblem('gone'));
    this.halted = false;
    return new Promise((resolve, reject) => {
      this.requests.push({
        msg,
        reject,
        answer: (reply) => {
          if (halt && reply.t !== 'error') this.halt();
          if (reply.t === 'error') reject(new KeeperProblem(reply.code, reply.text, { wait: reply.wait }));
          else resolve(reply);
        },
      });
      if (this.state === 'ready') this.flush();
      else if (!this.peer) {
        clearTimeout(this.timer);
        this.timer = 0;
        this.connect();
      }
    });
  }

  // Logs in as the player with this name and password. Resolves with
  // { player, token, profile }.
  logIn(name, password) {
    return this.request({ t: 'login', name, password }, { halt: true });
  }

  // Makes a login for you, or, logged in, gives it a new password. Resolves
  // with { player, token? }.
  async makeLogin(password) {
    const reply = await this.request({ t: 'make-login', password, profile: keptProfile(this.profile.data) }, { halt: !this.login });
    this.needsPassword = false;
    return reply;
  }

  // What this device sent the keeper before it logged in as that player
  // becomes theirs there too (see KeeperStore.adoptDevice): this page's
  // device key and the player's token prove both. Resolves with { islands }.
  adopt(player, token) {
    return this.request({ t: 'adopt', player, token }, { halt: true });
  }

  // Tells the keeper this device is logged out, if it can be reached soon,
  // after the copies still waiting here. Those that cannot go now wait here
  // until you log in on this device again.
  async logOut() {
    if (!this.login || !this.config || this.state === 'gone') return;
    const soon = (ms) => new Promise((done) => setTimeout(done, ms));
    await Promise.race([this.drained(), soon(12000)]);
    if (this.state !== 'away' && this.state !== 'refused') {
      await Promise.race([this.request({ t: 'logout' }, { halt: true }).catch(() => null), soon(8000)]);
    }
    this.halt();
  }

  // Resolves once nothing is waiting to be sent, or the keeper went away.
  drained() {
    return new Promise((done) => {
      const check = () => {
        if (this.state === 'away' || this.state === 'refused' || this.state === 'gone' || this.state === 'off' || !this.pending()) {
          this.removeEventListener('status', check);
          this.removeEventListener('kept', check);
          done();
        }
      };
      this.addEventListener('status', check);
      this.addEventListener('kept', check);
      check();
      if (this.state === 'idle') this.schedule(0);
    });
  }

  // An island you said goodbye to: logged in, your other devices drop it too.
  forget(id) {
    if (!this.login) return;
    this.data.forgets[id] = Date.now();
    delete this.data.sent[id];
    this.store();
    this.nudge();
  }

  // ------------------------------------------------ bringing back

  listedAs(reply) {
    if (reply.t !== 'list') {
      this.away();
      return;
    }
    // Your profile, from your other devices. What the keeper has is what was
    // sent last, so the merge goes up only if it changed anything there.
    if (reply.profile) {
      this.profile.merge(reply.profile);
      this.data.profile = JSON.stringify(keptProfile(reply.profile));
    }
    const mine = listIslands().map((i) => ({ id: i.id, savedAt: i.savedAt ?? 0 }));
    const islands = Array.isArray(reply.islands) ? reply.islands : [];
    const forgotten = Array.isArray(reply.forgotten) ? reply.forgotten : [];
    const plan = planSync(
      mine,
      islands.filter((i) => !(i.id in this.data.forgets)),
      forgotten,
      MAX_ISLANDS,
    );
    for (const id of plan.drop) {
      forgetIsland(id);
      delete this.data.sent[id];
    }
    this.listed = true;
    this.toFetch = plan.fetch;
    this.store();
    if (plan.drop.length) this.emit('islands');
    if (!this.toFetch.length) this.synced();
  }

  fetched(id, reply) {
    this.toFetch = this.toFetch.filter((other) => other !== id);
    const save = reply.t === 'island' ? reply.save : null;
    if (save && typeof save === 'object') {
      storeIsland(id, save);
      this.data.sent[id] = save.savedAt ?? 0;
      const key = `island:${id}`;
      const token = ownerToken(save);
      if (token && !this.profile.token(key)) this.profile.setToken(key, token);
      this.store();
      this.emit('islands');
    }
    if (!this.toFetch.length) this.synced();
  }

  synced() {
    this.syncedAt = Date.now();
    this.emit('synced');
  }

  // ------------------------------------------------ the connection

  connect() {
    if (this.peer || !this.config || this.state === 'gone' || this.halted) return;
    this.setState('connecting');
    this.listed = false;
    this.toFetch = [];
    const peer = new Peer(this.peerOptions);
    this.peer = peer;
    this.timer = setTimeout(() => this.away(), CONNECT_TIMEOUT_MS);
    peer.on('open', () => {
      if (peer !== this.peer) return;
      const conn = peer.connect(this.config.peer, { serialization: 'raw', reliable: true });
      if (!conn) {
        this.away();
        return;
      }
      this.conn = conn;
      const pieces = new Reassembler();
      const nonce = randomHex(16);
      const talk = { nonce, checked: false };
      conn.on('open', () => {
        // The nonce, and nothing else, until the keeper has signed it.
        if (conn === this.conn) this.send({ t: 'hello', v: KEEPER_VERSION, nonce });
      });
      conn.on('data', (data) => {
        if (conn !== this.conn || typeof data !== 'string') return;
        const text = pieces.accept(data);
        let msg = null;
        try {
          msg = text == null ? null : JSON.parse(text);
        } catch {
          // not for us
        }
        if (msg && typeof msg === 'object') this.receive(msg, talk);
      });
      conn.on('close', () => {
        if (conn === this.conn) this.away();
      });
      conn.on('error', () => {
        if (conn === this.conn) this.away();
      });
    });
    // peer-unavailable: the keeper is not online. Anything else: no way to reach it now.
    peer.on('error', () => {
      if (peer === this.peer && this.state !== 'ready') this.away();
    });
    peer.on('disconnected', () => {
      if (peer === this.peer && this.state !== 'ready') this.away();
    });
  }

  send(msg) {
    if (this.conn?.open) sendText(this.conn, JSON.stringify(msg));
  }

  async receive(msg, talk) {
    if (msg.t === 'hello' && this.state === 'connecting' && !talk.checked) {
      const conn = this.conn;
      const ok = await verifySignature(this.publicKey, this.config.peer, talk.nonce, msg.sig);
      if (this.state !== 'connecting' || conn !== this.conn) return;
      if (!ok) {
        // Someone else has the keeper's id. Send them nothing.
        this.hangUp('refused');
        this.setState('refused');
        this.schedule(REFUSED_RETRY_MS);
        return;
      }
      talk.checked = true;
      this.send({ t: 'me', device: this.data.device, ...(this.login ? { login: this.login } : {}) });
      return;
    }
    if (msg.t === 'me' && this.state === 'connecting' && talk.checked) {
      if (this.login && msg.player !== this.login.player) {
        // The login this page used is gone: removed at the keeper.
        this.hangUp('gone');
        this.setState('gone');
        this.emit('gone');
        return;
      }
      clearTimeout(this.timer);
      this.timer = 0;
      if (msg.needsPassword && !this.needsPassword) {
        this.needsPassword = true;
        this.emit('needs-password');
      }
      this.setState('ready');
      this.flush();
      return;
    }
    if (this.state !== 'ready' || !this.waiting) return;
    const item = this.waiting;
    clearTimeout(this.replyTimer);
    this.waiting = null;
    if (msg.t === 'error' && msg.code === 'busy') {
      // Too much at once: the same again, in a moment. (Anything but what
      // you asked for comes up again by itself.)
      if (item.reject) this.requests.unshift(item);
      setTimeout(() => this.flush(), 3000);
      return;
    }
    // What the answer sets off (a merged profile, a stored island) may nudge
    // for more, which waits until the answer is all taken in.
    this.answering = true;
    try {
      item.answer(msg);
    } finally {
      this.answering = false;
    }
    if (this.state === 'ready') this.flush();
  }

  flush() {
    if (this.state !== 'ready' || this.waiting || this.answering) return;
    clearTimeout(this.idleTimer);
    const item = this.requests.shift() ?? this.next();
    if (!item) {
      this.idleTimer = setTimeout(() => {
        this.send({ t: 'bye' });
        this.hangUp();
        this.setState(this.enabled ? 'idle' : 'off');
      }, IDLE_MS);
      return;
    }
    if (item.msg.t === 'profile') this.profileSentAt = Date.now();
    this.waiting = item;
    this.replyTimer = setTimeout(() => this.away(), REPLY_TIMEOUT_MS);
    this.send(item.msg);
    this.emit('status', { state: this.state });
  }

  // Done, as the page is about to reload as someone else: nothing more goes
  // until it asks for something again.
  halt() {
    this.halted = true;
    this.hangUp();
    this.setState('idle');
  }

  // The keeper is not there, or the connection broke: try again later, less
  // and less often. Whatever was in flight goes again then; what you asked
  // for fails now, as you are waiting for it.
  away() {
    if (!this.peer && this.state !== 'connecting' && this.state !== 'ready') return;
    this.hangUp();
    this.setState('away');
    this.schedule(RETRY_MS[Math.min(this.failures++, RETRY_MS.length - 1)]);
  }

  // why: what anything you asked for, still waiting, fails with.
  hangUp(why = 'asleep') {
    clearTimeout(this.timer);
    clearTimeout(this.replyTimer);
    clearTimeout(this.idleTimer);
    this.timer = 0;
    const asked = [...(this.waiting?.reject ? [this.waiting] : []), ...this.requests];
    this.waiting = null;
    this.requests = [];
    for (const r of asked) r.reject(new KeeperProblem(why));
    const conn = this.conn;
    const peer = this.peer;
    this.conn = null;
    this.peer = null;
    try {
      conn?.close();
    } catch {
      // already closed
    }
    peer?.destroy();
    // Islands this browser no longer has need no record either.
    const ids = new Set(listIslands().map((i) => i.id));
    for (const id of Object.keys(this.data.sent)) if (!ids.has(id)) delete this.data.sent[id];
    this.store();
  }
}
