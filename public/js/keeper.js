// Sends copies of this browser's islands and of who you are to the keeper, a
// computer that keeps them whenever it is online (see shared/keeper.js and
// server/keeper.js). It is reached peer to peer, like a friend's island, under
// the peer id in keeper.json, and has to prove it holds that file's key before
// anything is sent. Nothing waits on it: while it is away, copies wait here
// and go the next time both are on.
//
// It also logs you in and out there. Logged in, it brings back what your
// other devices sent, too: your look, stickers and basket, merged with yours
// here, and newer copies of your islands. And it shows the ranking, live:
// watching it, the page hears of every change, and logged in, what you have
// done goes along every few seconds, so the others see you climb.
//
// Hosting an island that is open to visitors, it puts it on the keeper's
// list of open islands, and keeps the connection open for as long as it is
// there; and it brings that list to any page that asks.
//
// Logged in and on screen, the page stays connected too, so the keeper knows
// you are playing now: other players see so on the players list, and can
// invite you to their islands, which comes as an 'invite' event. It brings
// that list, and sends your invitations (see shared/friends.js).
//
// States: off (no keeper, or switched off), idle, connecting, ready, away,
// refused, gone (the login this page was using was removed).

import { signalingOptions } from './net.js';
import { load, save, listIslands, loadIsland, storeIsland, forgetIsland, MAX_ISLANDS } from './storage.js';
import { Reassembler, sendText } from './shared/framing.js';
import { cleanInvite, isFriendId } from './shared/friends.js';
import { cleanListing } from './shared/listing.js';
import { isDeviceKey, isPeerId, isPublicKey, keptProfile, KEEPER_VERSION, KEY_ALGORITHM, planSync, randomHex, verifySignature } from './shared/keeper.js';

const FIRST_TRY_MS = 3000;
// The first retry is soon, for a blip; after that the keeper is probably off.
const RETRY_MS = [5000, 30000, 60000, 120000, 300000, 600000];
const REFUSED_RETRY_MS = 30 * 60000;
const CONNECT_TIMEOUT_MS = 25000;
const REPLY_TIMEOUT_MS = 60000;
const IDLE_MS = 60000;
// What you have done changes with every step: when nothing else about you
// changed, a copy every few minutes is plenty. Logged in, you are in the
// ranking, which others watch live: every few seconds.
const PROFILE_EVERY_MS = 3 * 60000;
const STATS_EVERY_MS = 5000;
// Watching the ranking, it is asked for again this often, which also keeps
// the connection from looking idle at the keeper.
const WATCH_AGAIN_MS = 90000;
// An open island is told to the keeper again this often, which also keeps
// the connection from looking idle there.
const LIST_AGAIN_MS = 60000;
// Playing now is told to the keeper again this often, which also keeps the
// connection from looking idle there.
const ONLINE_AGAIN_MS = 60000;
// Logged in, coming back to the game after this long asks the keeper for news.
const RESYNC_MS = 2 * 60000;

// Why the keeper could not do something you asked: asleep (not online),
// refused (someone else has its id), gone (your login was removed), none (no
// keeper), or what it said: wrong (username or password), wait, weak
// (password), username (not one), taken (username), bad, full.
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
  // login: { player, token, username? } when logged in on this device.
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
    // Watching the ranking (while it is on screen), whether this connection
    // asked to yet, and whether the keeper answered with it, so that its
    // news can come (one running older code does not know it).
    this.watching = false;
    this.watched = false;
    this.rankingLive = false;
    this.watchTimer = 0;
    this.countTimer = 0;
    // The island this page hosts, on the list of open islands (see
    // shared/listing.js), or null; and what this connection told the keeper
    // of it, as JSON ('' for nothing).
    this.listing = null;
    this.listingSent = '';
    this.listTimer = 0;
    // Logged in: whether you are playing now (the page is on screen), and
    // what this connection told the keeper of it (null for nothing).
    this.present = false;
    this.presentSent = null;
    this.presentTimer = 0;
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
      if (this.pending()) this.connect();
      else if (this.state !== 'off') this.setState(this.enabled ? 'idle' : 'off');
    }, ms);
  }

  // What to send next, after anything you asked for: logged in, what it takes
  // to bring back what the keeper has, and the islands you said goodbye to;
  // then you, when you changed (only now and then when all that changed is
  // what you have done), else the most recently saved island the keeper does
  // not have yet. Each comes with what to do with the keeper's answer.
  next() {
    // Watching the ranking: asked for on each new connection, and again now and then.
    if (this.watching && !this.watched) return { msg: { t: 'ranking', watch: true }, answer: (reply) => this.watchedAs(reply) };
    // Your open island, as it is now, or that it is not open any more. (A
    // keeper running older code says it does not know this, once.)
    // Logged in: whether you are playing now. (A keeper running older code
    // says it does not know this, once.)
    if (this.login && (this.present ? this.presentSent !== true : this.presentSent === true)) {
      const on = this.present;
      return { msg: { t: 'online', on }, answer: () => (this.presentSent = on) };
    }
    const listing = this.listing ? JSON.stringify(this.listing) : '';
    if (listing !== this.listingSent) {
      return { msg: this.listing ? { t: 'open-island', island: this.listing } : { t: 'close-island' }, answer: () => (this.listingSent = listing) };
    }
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
      if (!onlyStats || Date.now() - this.profileSentAt >= (this.login ? STATS_EVERY_MS : PROFILE_EVERY_MS)) {
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
  // copy goes, as the page reloads as someone else next. answered: called
  // with the answer as it arrives, before anything else is sent.
  request(msg, { halt = false, answered = null } = {}) {
    if (!this.config) return Promise.reject(new KeeperProblem('none'));
    if (this.state === 'gone') return Promise.reject(new KeeperProblem('gone'));
    this.halted = false;
    return new Promise((resolve, reject) => {
      this.requests.push({
        msg,
        reject,
        answer: (reply) => {
          answered?.(reply);
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

  // Logs in with this username and password. Resolves with { player, token,
  // username, profile }.
  logIn(username, password) {
    return this.request({ t: 'login', username, password }, { halt: true });
  }

  // Makes a login for you with this username, or, logged in, gives yours a
  // new password (no username then). Resolves with { player, token?, username }.
  async makeLogin(password, username = null) {
    const reply = await this.request({ t: 'make-login', password, ...(username === null ? {} : { username }), profile: keptProfile(this.profile.data) }, { halt: !this.login });
    this.needsPassword = false;
    return reply;
  }

  // What this device sent the keeper before it logged in as that player
  // becomes theirs there too (see KeeperStore.adoptDevice): this page's
  // device key and the player's token prove both. Resolves with { islands }.
  adopt(player, token) {
    return this.request({ t: 'adopt', player, token }, { halt: true });
  }

  // Watches the ranking of the players with a login (see shared/ranking.js)
  // while it is on screen, whether or not copies go: it comes now, and again
  // whenever it changes, as 'ranking' events with { players, boards, shown? },
  // until unwatchRanking(). The connection stays open meanwhile, and comes
  // back if it breaks. Resolves with the first answer; rejects with a
  // KeeperProblem if the keeper could not be asked (it is asked again when
  // it can be).
  watchRanking() {
    this.watching = true;
    clearInterval(this.watchTimer);
    this.watchTimer = setInterval(() => {
      if (this.state !== 'ready') return;
      this.watched = false;
      this.flush();
    }, WATCH_AGAIN_MS);
    return this.request({ t: 'ranking', watch: true }, { answered: (reply) => this.watchedAs(reply) });
  }

  unwatchRanking() {
    if (!this.watching) return;
    this.watching = false;
    clearInterval(this.watchTimer);
    if (this.state === 'ready' && this.rankingLive) this.request({ t: 'unwatch' }).catch(() => {});
    this.watched = false;
    this.rankingLive = false;
    this.flush();
  }

  // The keeper's answer to watching the ranking, or its news. Asked on this
  // connection either way (a keeper that said no is not asked again at
  // once); live only if the keeper knows the ranking.
  watchedAs(reply) {
    this.watched = true;
    this.rankingLive = reply.t === 'ranking';
    if (this.rankingLive && this.watching) this.emit('ranking', reply);
  }

  // Puts the island this page hosts on the list of open islands (a listing,
  // see shared/listing.js), or takes it off (null), whether or not copies go.
  // While it is on it, the connection stays open, and comes back if it breaks.
  setListing(island) {
    if (!this.config || this.state === 'gone') return;
    if (JSON.stringify(island) === JSON.stringify(this.listing)) return;
    this.listing = island;
    clearInterval(this.listTimer);
    this.listTimer = 0;
    if (island) {
      this.listTimer = setInterval(() => {
        if (this.state !== 'ready') return;
        this.listingSent = '';
        this.flush();
      }, LIST_AGAIN_MS);
    }
    if (this.state === 'ready') this.flush();
    else if (island && !this.peer && !this.timer && this.state !== 'refused' && !this.halted) this.schedule(0);
  }

  // Logged in: you are playing now (on), as the page is on screen, or not.
  // While you are, the connection stays open, and comes back if it breaks,
  // so others see you on the players list and can invite you.
  setPresent(on) {
    on = Boolean(on && this.login);
    if (on === this.present) return;
    this.present = on;
    clearInterval(this.presentTimer);
    this.presentTimer = 0;
    if (on) {
      this.presentTimer = setInterval(() => {
        if (this.state !== 'ready') return;
        this.presentSent = null;
        this.flush();
      }, ONLINE_AGAIN_MS);
    }
    if (!this.config || this.state === 'gone') return;
    if (this.state === 'ready') this.flush();
    else if (on && !this.peer && !this.timer && this.state !== 'refused' && !this.halted) this.schedule(0);
  }

  // Logged in: the players list (see shared/friends.js). Resolves with
  // { players: [{ id, name, look, online }], shown }; rejects with a
  // KeeperProblem when the keeper could not be asked, or does not know the
  // list yet (bad).
  async players() {
    const reply = await this.request({ t: 'players' });
    const players = (Array.isArray(reply.players) ? reply.players : []).filter((p) => isFriendId(p?.id) && typeof p.name === 'string' && p.name);
    return { players: players.map((p) => ({ id: p.id, name: p.name, look: p.look, online: p.online === true })), shown: reply.shown !== false };
  }

  // Logged in: you go on the players list, or leave it, on all your devices.
  setFindable(on) {
    return this.request({ t: 'findable', on });
  }

  // Logged in: invites the player with this id (from players()) to an island
  // (see cleanInvite). Rejects with a KeeperProblem: away when they are not
  // playing now, wait after too many.
  invite(to, island) {
    return this.request({ t: 'invite', to, island });
  }

  // The list of open islands, from the keeper. Resolves with the listings;
  // rejects with a KeeperProblem when the keeper could not be asked, or
  // does not know the list yet (bad).
  async openIslands() {
    const reply = await this.request({ t: 'islands' });
    return (Array.isArray(reply.islands) ? reply.islands : []).map(cleanListing).filter(Boolean);
  }

  // You did something the game counts. Logged in, it goes to the keeper
  // within a few seconds, for the ranking.
  counted() {
    if (!this.login || this.countTimer) return;
    this.countTimer = setTimeout(
      () => {
        this.countTimer = 0;
        this.nudge();
      },
      Math.max(0, this.profileSentAt + STATS_EVERY_MS - Date.now()),
    );
  }

  // Logged in: you join the ranking, or leave it, on all your devices.
  setRanked(on) {
    return this.request({ t: 'ranked', on });
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
    this.watched = false;
    this.rankingLive = false;
    this.listingSent = '';
    this.presentSent = null;
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
      if (this.login && typeof msg.username === 'string' && msg.username !== this.login.username) {
        this.login = { ...this.login, username: msg.username };
        this.emit('username');
      }
      if (msg.needsPassword && !this.needsPassword) {
        this.needsPassword = true;
        this.emit('needs-password');
      }
      this.setState('ready');
      this.flush();
      return;
    }
    // News of the ranking, unasked: never the answer to what is waiting.
    if (msg.t === 'ranking-news') {
      if (this.state === 'ready') this.watchedAs({ ...msg, t: 'ranking' });
      return;
    }
    // An invitation, from a player the keeper knows: { from: { id, name, look }, island }.
    if (msg.t === 'invite-news') {
      const island = cleanInvite(msg.island);
      if (this.state === 'ready' && this.present && island && typeof msg.from?.name === 'string' && msg.from.name) {
        this.emit('invite', { from: { id: msg.from.id, name: msg.from.name, look: msg.from.look }, island });
      }
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
      // Watching the ranking, the connection stays open for its news; with
      // an island on the list, to keep it there; playing now, to be invited.
      if (this.watching || this.listing || (this.login && this.present)) return;
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
    // Copies are off: only something you asked for called the keeper, and
    // that has failed now. (Watching the ranking, or with an island on the
    // list, it is tried again.)
    if (!this.enabled && !this.watching && !this.listing && !this.present) {
      this.setState('off');
      return;
    }
    this.setState('away');
    this.schedule(RETRY_MS[Math.min(this.failures++, RETRY_MS.length - 1)]);
  }

  // why: what anything you asked for, still waiting, fails with.
  hangUp(why = 'asleep') {
    clearTimeout(this.timer);
    clearTimeout(this.replyTimer);
    clearTimeout(this.idleTimer);
    this.timer = 0;
    // The keeper takes the island off its list as the connection goes, and
    // you off the players playing now.
    this.listingSent = '';
    this.presentSent = null;
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
