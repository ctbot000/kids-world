// Sends copies of this browser's islands and of who you are to the keeper, a
// computer that keeps them whenever it is online (see shared/keeper.js and
// server/keeper.js). It is reached peer to peer, like a friend's island, under
// the peer id in keeper.json, and has to prove it holds that file's key before
// anything is sent. Nothing waits on it: while it is away, copies wait here
// and go the next time both are on.
//
// States: off (no keeper, or switched off), idle, connecting, ready, away, refused.

import { signalingOptions } from './net.js';
import { load, save, listIslands, loadIsland } from './storage.js';
import { Reassembler, sendText } from './shared/framing.js';
import { isDeviceKey, isPeerId, isPublicKey, keptProfile, KEEPER_VERSION, KEY_ALGORITHM, randomHex, verifySignature } from './shared/keeper.js';

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

export class KeeperClient extends EventTarget {
  constructor({ profile, configUrl = 'keeper.json' }) {
    super();
    this.profile = profile;
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
    const saved = load('keeper', null);
    this.data = {
      device: isDeviceKey(saved?.device) ? saved.device : randomHex(16),
      sent: saved?.sent && typeof saved.sent === 'object' ? saved.sent : {},
      profile: typeof saved?.profile === 'string' ? saved.profile : '',
      lastKept: Number.isFinite(saved?.lastKept) ? saved.lastKept : 0,
    };
    this.store();
  }

  get enabled() {
    return this.profile.settings.keeper !== false;
  }

  get lastKept() {
    return this.data.lastKept;
  }

  // Whether a copy is on its way (or about to be, once connected).
  get sending() {
    return this.state === 'connecting' || Boolean(this.waiting);
  }

  store() {
    save('keeper', this.data);
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.dispatchEvent(new CustomEvent('status', { detail: { state } }));
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
    }
    window.addEventListener('online', () => {
      if (this.state === 'away') this.schedule(FIRST_TRY_MS);
    });
    this.setState(this.enabled ? 'idle' : 'off');
    if (this.enabled && this.pending()) this.schedule(FIRST_TRY_MS);
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
    if (!this.config || !this.enabled) return;
    if (this.state === 'ready') this.flush();
    else if (this.state === 'idle' && !this.timer && this.pending()) this.schedule(FIRST_TRY_MS);
  }

  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = 0;
      if (this.enabled && this.pending()) this.connect();
      else if (this.state !== 'off') this.setState('idle');
    }, ms);
  }

  // What to send next: you, when you changed (only now and then when all that
  // changed is what you have done), else the most recently saved island the
  // keeper does not have yet.
  next() {
    const kept = keptProfile(this.profile.data);
    const profile = JSON.stringify(kept);
    if (profile !== this.data.profile) {
      const before = this.data.profile ? JSON.parse(this.data.profile) : {};
      const onlyStats = JSON.stringify({ ...kept, stats: 0 }) === JSON.stringify({ ...before, stats: 0 });
      if (!onlyStats || Date.now() - this.profileSentAt >= PROFILE_EVERY_MS) {
        return { msg: { t: 'profile', profile: kept }, done: () => (this.data.profile = profile) };
      }
    }
    const islands = listIslands()
      .filter((i) => (i.savedAt ?? 0) > (this.data.sent[i.id] ?? 0))
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    for (const item of islands) {
      const island = loadIsland(item.id);
      if (!island) continue;
      const savedAt = island.savedAt ?? item.savedAt;
      return { msg: { t: 'island', id: item.id, save: island }, done: () => (this.data.sent[item.id] = savedAt) };
    }
    return null;
  }

  pending() {
    return this.next() !== null;
  }

  connect() {
    if (this.peer || !this.config) return;
    this.setState('connecting');
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
      conn.on('open', () => {
        if (conn === this.conn) this.send({ t: 'hello', v: KEEPER_VERSION, nonce, device: this.data.device });
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
        if (msg && typeof msg === 'object') this.receive(msg, nonce);
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

  async receive(msg, nonce) {
    if (msg.t === 'hello' && this.state === 'connecting') {
      const ok = await verifySignature(this.publicKey, this.config.peer, nonce, msg.sig);
      if (this.state !== 'connecting') return;
      if (!ok) {
        // Someone else has the keeper's id. Send them nothing.
        this.hangUp();
        this.setState('refused');
        this.schedule(REFUSED_RETRY_MS);
        return;
      }
      clearTimeout(this.timer);
      this.timer = 0;
      this.setState('ready');
      this.flush();
      return;
    }
    if (this.state !== 'ready' || !this.waiting) return;
    if (msg.t === 'kept' || (msg.t === 'error' && msg.code === 'bad')) {
      // Kept, or something the keeper will never take: either way, done with it.
      clearTimeout(this.replyTimer);
      const { done } = this.waiting;
      this.waiting = null;
      done();
      if (msg.t === 'kept') {
        this.data.lastKept = Date.now();
        this.failures = 0;
      }
      this.store();
      this.dispatchEvent(new CustomEvent('kept', { detail: msg }));
      this.flush();
    } else if (msg.t === 'error') {
      clearTimeout(this.replyTimer);
      this.waiting = null;
      if (msg.code === 'busy') setTimeout(() => this.flush(), 3000);
      else this.away();
    }
  }

  flush() {
    if (this.state !== 'ready' || this.waiting) return;
    clearTimeout(this.idleTimer);
    const item = this.next();
    if (!item) {
      this.idleTimer = setTimeout(() => {
        this.send({ t: 'bye' });
        this.hangUp();
        this.setState('idle');
      }, IDLE_MS);
      return;
    }
    if (item.msg.t === 'profile') this.profileSentAt = Date.now();
    this.waiting = item;
    this.replyTimer = setTimeout(() => this.away(), REPLY_TIMEOUT_MS);
    this.send(item.msg);
    this.dispatchEvent(new CustomEvent('status', { detail: { state: this.state } }));
  }

  // The keeper is not there, or the connection broke: try again later, less
  // and less often. Whatever was in flight goes again then.
  away() {
    if (!this.peer && this.state !== 'connecting' && this.state !== 'ready') return;
    this.hangUp();
    this.setState('away');
    this.schedule(RETRY_MS[Math.min(this.failures++, RETRY_MS.length - 1)]);
  }

  hangUp() {
    clearTimeout(this.timer);
    clearTimeout(this.replyTimer);
    clearTimeout(this.idleTimer);
    this.timer = 0;
    this.waiting = null;
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
