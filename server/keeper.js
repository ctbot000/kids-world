// The keeper: keeps a copy of every player's islands and profile, sent by
// their browsers peer to peer whenever this computer is online. It joins the
// PeerJS signaling service under the fixed peer id in public/keeper.json,
// answers the data connections pages open to it, proves who it is by signing
// each page's nonce, and files what arrives on disk. The protocol is in
// public/js/shared/keeper.js.
//
//   <data>/keeper.json                              the keeper's id and key pair (private)
//   <data>/devices/<device>/device.json             when the device was seen, its profile
//   <data>/devices/<device>/islands/<id>/info.json  the island's name, theme, code, times
//   <data>/devices/<device>/islands/<id>/<day>.json the island as it was at the end of that day
//
// <device> is a hash of the secret device key, so a page can only ever add
// to its own copies. WebRTC comes from node-datachannel, loaded only when the
// keeper goes online.
import { createHash, webcrypto } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidCode } from '../public/js/shared/codes.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import {
  challenge,
  isDeviceKey,
  isIslandId,
  isNonce,
  isPeerId,
  isPublicKey,
  keptProfile,
  KEEPER_VERSION,
  KEY_ALGORITHM,
  MAX_PARTS,
  MAX_TEXT,
  randomHex,
  SIGN_ALGORITHM,
  toBase64Url,
} from '../public/js/shared/keeper.js';
import { World } from '../public/js/shared/world.js';

export const DEFAULT_DATA_DIR = join(homedir(), '.kids-world');
export const PUBLIC_CONFIG = fileURLToPath(new URL('../public/keeper.json', import.meta.url));

const GB = 1024 ** 3;

// The PeerJS cloud and the ICE servers PeerJS pages use by default, so the
// keeper can reach every page a friend's island could.
export const CLOUD = { host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs' };
export const ICE_SERVERS = [
  'stun:stun.l.google.com:19302',
  { hostname: 'eu-0.turn.peerjs.com', port: 3478, username: 'peerjs', password: 'peerjsp', relayType: 'TurnUdp' },
  { hostname: 'us-0.turn.peerjs.com', port: 3478, username: 'peerjs', password: 'peerjsp', relayType: 'TurnUdp' },
];

// A refusal the page is told about: { code, text }.
export class KeepError extends Error {
  constructor(code, text) {
    super(text);
    this.code = code;
  }
}

// ---------------------------------------------------------------- identity

// The keeper's peer id and key pair, kept in the data folder. The public half
// goes to public/keeper.json, which the pages read.
export async function loadIdentity(dir) {
  try {
    const id = JSON.parse(await readFile(join(dir, 'keeper.json'), 'utf8'));
    if (!isPeerId(id.peer) || !isPublicKey(id.publicKey) || typeof id.privateKey?.d !== 'string') return null;
    return id;
  } catch {
    return null;
  }
}

export async function createIdentity(dir) {
  const pair = await webcrypto.subtle.generateKey(KEY_ALGORITHM, true, ['sign', 'verify']);
  const identity = {
    peer: `kids-world-keeper-${randomHex(8)}`,
    publicKey: await webcrypto.subtle.exportKey('jwk', pair.publicKey),
    privateKey: await webcrypto.subtle.exportKey('jwk', pair.privateKey),
    created: new Date().toISOString(),
  };
  delete identity.publicKey.key_ops;
  delete identity.publicKey.ext;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'keeper.json');
  await writeFile(file, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
  await chmod(file, 0o600);
  return identity;
}

// What the pages need to find the keeper and to check it: public/keeper.json.
export function publicConfig(identity, signal = null) {
  return { peer: identity.peer, key: identity.publicKey, ...(signal ? { signal } : {}) };
}

export async function readPublicConfig(file = PUBLIC_CONFIG) {
  try {
    const config = JSON.parse(await readFile(file, 'utf8'));
    return isPeerId(config.peer) && isPublicKey(config.key) ? config : null;
  } catch {
    return null;
  }
}

export function sameKeeper(config, identity) {
  return Boolean(config && identity && config.peer === identity.peer && config.key.x === identity.publicKey.x && config.key.y === identity.publicKey.y);
}

// "https://host:port/path?key=k" (as in ?signal=) to PeerJS server options.
export function signalOptions(signal) {
  if (!signal) return CLOUD;
  const url = new URL(signal);
  const secure = url.protocol === 'https:' || url.protocol === 'wss:';
  return { host: url.hostname, port: Number(url.port) || (secure ? 443 : 80), path: url.pathname || '/', secure, key: url.searchParams.get('key') || 'peerjs' };
}

// ---------------------------------------------------------------- the store

const localDay = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isDeviceId = (v) => typeof v === 'string' && /^[0-9a-f]{20}$/.test(v);

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function sizeOf(file) {
  return (await stat(file).catch(() => null))?.size ?? 0;
}

async function folderSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? await folderSize(path) : await sizeOf(path);
  }
  return total;
}

export class KeeperStore {
  constructor(dir, { maxBytes = 2 * GB, keepDays = 30, maxIslands = 200, now = () => Date.now(), dayOf = localDay } = {}) {
    this.dir = dir;
    this.maxBytes = maxBytes;
    this.keepDays = keepDays;
    this.maxIslands = maxIslands;
    this.now = now;
    this.dayOf = dayOf;
    this.bytes = 0;
    // Writes go one at a time, so two copies of one island never interleave.
    this.queue = Promise.resolve();
  }

  // Counts what is kept already. Folders are made when the first copy arrives.
  async open() {
    this.bytes = await folderSize(join(this.dir, 'devices'));
    return this;
  }

  static deviceId(key) {
    return createHash('sha256').update(`kids-world device ${key}`).digest('hex').slice(0, 20);
  }

  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  // Writes through a temporary file, so a crash never leaves half a copy.
  async write(file, text) {
    const before = await sizeOf(file);
    const tmp = `${file}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, file);
    this.bytes += Buffer.byteLength(text) - before;
  }

  async remove(path) {
    const size = (await stat(path).catch(() => null))?.isDirectory() ? await folderSize(path) : await sizeOf(path);
    await rm(path, { recursive: true, force: true });
    this.bytes = Math.max(0, this.bytes - size);
  }

  room(extra) {
    if (this.bytes + extra > this.maxBytes) throw new KeepError('full', 'The keeper is full.');
  }

  async seen(device, changes) {
    const file = join(this.dir, 'devices', device, 'device.json');
    const now = this.now();
    const old = (await readJson(file)) ?? { id: device, firstSeen: now };
    const record = { ...old, ...changes, id: device, lastSeen: now };
    await this.write(file, JSON.stringify(record));
    return record;
  }

  keepIsland(key, id, save) {
    if (!isDeviceKey(key) || !isIslandId(id)) return Promise.reject(new KeepError('bad', 'That is not an island this keeper knows how to keep.'));
    if (!save || typeof save !== 'object' || save.app !== 'kids-world' || save.kind !== 'island') {
      return Promise.reject(new KeepError('bad', 'That is not a Kids World island.'));
    }
    let world;
    try {
      world = World.decode(save.meta, save.blocks);
    } catch (error) {
      return Promise.reject(new KeepError('bad', `That island is damaged: ${error.message}`));
    }
    const text = JSON.stringify(save);
    if (text.length > MAX_TEXT) return Promise.reject(new KeepError('bad', 'That island is too big to keep.'));
    return this.serial(async () => {
      const device = KeeperStore.deviceId(key);
      const islands = join(this.dir, 'devices', device, 'islands');
      const folder = join(islands, id);
      const known = await stat(folder).catch(() => null);
      if (!known) {
        const count = (await readdir(islands).catch(() => [])).length;
        if (count >= this.maxIslands) throw new KeepError('full', 'The keeper has no room for more islands from this device.');
      }
      this.room(text.length);
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const now = this.now();
      const savedAt = Number.isFinite(save.savedAt) ? save.savedAt : now;
      await this.write(join(folder, `${this.dayOf(now)}.json`), text);
      const info = { id, name: world.name, theme: world.theme, code: isValidCode(save.code) ? save.code : '', savedAt, keptAt: now, bytes: text.length };
      await this.write(join(folder, 'info.json'), JSON.stringify(info));
      // One copy a day, for the last keepDays days that had one.
      const days = (await readdir(folder)).filter((f) => isDay(f.slice(0, -5)) && f.endsWith('.json')).sort();
      for (const old of days.slice(0, Math.max(0, days.length - this.keepDays))) await this.remove(join(folder, old));
      const record = await this.seen(device, {});
      return { device, savedAt, name: world.name, player: record.profile?.name ?? '' };
    });
  }

  keepProfile(key, raw) {
    if (!isDeviceKey(key)) return Promise.reject(new KeepError('bad', 'Unknown device.'));
    const profile = keptProfile(raw);
    return this.serial(async () => {
      const device = KeeperStore.deviceId(key);
      this.room(JSON.stringify(profile).length);
      await mkdir(join(this.dir, 'devices', device), { recursive: true, mode: 0o700 });
      await this.seen(device, { profile, profileAt: this.now() });
      return { device, player: profile.name };
    });
  }

  async devices() {
    const root = join(this.dir, 'devices');
    const out = [];
    for (const device of await readdir(root).catch(() => [])) {
      if (!isDeviceId(device)) continue;
      const info = (await readJson(join(root, device, 'device.json'))) ?? { id: device };
      const islands = [];
      for (const id of await readdir(join(root, device, 'islands')).catch(() => [])) {
        if (!isIslandId(id)) continue;
        const folder = join(root, device, 'islands', id);
        const island = await readJson(join(folder, 'info.json'));
        if (!island) continue;
        const days = (await readdir(folder))
          .map((f) => f.slice(0, -5))
          .filter(isDay)
          .sort()
          .reverse();
        islands.push({ ...island, days });
      }
      islands.sort((a, b) => b.keptAt - a.keptAt);
      out.push({ id: device, firstSeen: info.firstSeen ?? 0, lastSeen: info.lastSeen ?? 0, profile: info.profile ?? null, profileAt: info.profileAt ?? 0, islands });
    }
    return out.sort((a, b) => b.lastSeen - a.lastSeen);
  }

  async islandInfo(device, id) {
    if (!isDeviceId(device) || !isIslandId(id)) return null;
    return readJson(join(this.dir, 'devices', device, 'islands', id, 'info.json'));
  }

  // The island as it was at the end of `day`, or its latest copy. Null if there is none.
  async islandFile(device, id, day = null) {
    if (!isDeviceId(device) || !isIslandId(id) || (day !== null && !isDay(day))) return null;
    const folder = join(this.dir, 'devices', device, 'islands', id);
    const days = (await readdir(folder).catch(() => [])).map((f) => f.slice(0, -5)).filter(isDay).sort();
    const pick = day ?? days.at(-1);
    return pick && days.includes(pick) ? join(folder, `${pick}.json`) : null;
  }

  deleteIsland(device, id) {
    if (!isDeviceId(device) || !isIslandId(id)) return Promise.resolve(false);
    return this.serial(async () => {
      const folder = join(this.dir, 'devices', device, 'islands', id);
      if (!(await stat(folder).catch(() => null))) return false;
      await this.remove(folder);
      return true;
    });
  }

  deleteDevice(device) {
    if (!isDeviceId(device)) return Promise.resolve(false);
    return this.serial(async () => {
      const folder = join(this.dir, 'devices', device);
      if (!(await stat(folder).catch(() => null))) return false;
      await this.remove(folder);
      return true;
    });
  }
}

// ---------------------------------------------------------------- signaling

// A PeerJS client for one fixed id, speaking the PeerServer protocol over
// WebSocket: register, keep the socket alive, pass OFFER/ANSWER/CANDIDATE
// messages on. A dropped socket comes back with the same token, which moves
// the session over; PeerServer then sends no OPEN, so an open socket that
// hears no refusal for a moment counts as registered. After the computer
// sleeps, the socket can look open long after the server dropped it, so a
// heartbeat that comes late starts a new one.
class Signaling extends EventEmitter {
  constructor({ id, server }) {
    super();
    this.id = id;
    this.server = server;
    this.state = 'off';
    this.ws = null;
    this.stopped = true;
    this.token = '';
    this.retryDelay = 1000;
    this.timers = new Set();
    this.beat = 0;
  }

  start() {
    this.stopped = false;
    this.token = randomHex(8);
    this.connect();
  }

  later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  setState(state, detail = '') {
    if (state === this.state && detail === this.detail) return;
    this.state = state;
    this.detail = detail;
    this.emit('state', state, detail);
  }

  connect() {
    if (this.stopped) return;
    const { host, port, path, secure, key } = this.server;
    const url = `${secure ? 'wss' : 'ws'}://${host}:${port}${path.endsWith('/') ? path : `${path}/`}peerjs?key=${encodeURIComponent(key)}&id=${encodeURIComponent(this.id)}&token=${this.token}&version=1.5.5`;
    if (this.state !== 'id-taken') this.setState('connecting');
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      this.retry(error.message);
      return;
    }
    this.ws = ws;
    let refused = false;
    ws.addEventListener('open', () => {
      if (ws !== this.ws) return;
      let last = Date.now();
      clearInterval(this.beat);
      this.beat = setInterval(() => {
        const now = Date.now();
        if (now - last > 30000) {
          this.drop(ws, 'Woke up from sleep; reconnecting.');
          return;
        }
        last = now;
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
      }, 5000);
      this.later(3000, () => {
        if (ws === this.ws && ws.readyState === 1 && !refused && this.state !== 'online') this.online();
      });
    });
    ws.addEventListener('message', (event) => {
      if (ws !== this.ws) return;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg?.type) {
        case 'OPEN':
          this.online();
          break;
        case 'ID-TAKEN':
          // Our own last session, not yet expired, or someone else: try again with a new token.
          refused = true;
          this.token = randomHex(8);
          this.setState('id-taken', 'Another peer has the keeper’s id; trying again.');
          ws.close();
          break;
        case 'INVALID-KEY':
        case 'ERROR':
          refused = true;
          this.token = randomHex(8);
          this.setState('error', msg.payload?.msg ?? msg.type);
          ws.close();
          break;
        case 'OFFER':
        case 'CANDIDATE':
        case 'LEAVE':
        case 'EXPIRE':
          this.emit('message', msg);
          break;
        default:
      }
    });
    ws.addEventListener('close', () => {
      if (ws === this.ws) this.drop(ws, this.state === 'online' ? 'The signaling server went away.' : this.detail);
    });
    ws.addEventListener('error', () => {});
  }

  online() {
    this.retryDelay = 1000;
    this.setState('online');
  }

  // Lets go of a socket that closed or went quiet, and starts again.
  drop(ws, detail) {
    if (ws !== this.ws) return;
    this.ws = null;
    clearInterval(this.beat);
    try {
      ws.close();
    } catch {
      // already closed
    }
    this.retry(detail);
  }

  retry(detail) {
    if (this.stopped) return;
    if (this.state !== 'id-taken' && this.state !== 'error') this.setState('reconnecting', detail ?? '');
    const delay = this.state === 'id-taken' ? 15000 : this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
    this.later(delay, () => this.connect());
  }

  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  stop() {
    this.stopped = true;
    clearInterval(this.beat);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    const ws = this.ws;
    this.ws = null;
    // Closing the socket frees the id at once, so a restart can have it back.
    ws?.close();
    this.setState('off');
  }
}

// ---------------------------------------------------------------- the keeper

const MAX_CONNECTIONS = 32;
const CONNECT_TIMEOUT_MS = 30000;
const IDLE_MS = 3 * 60000;
const RECENT = 40;

export class Keeper extends EventEmitter {
  // identity: from loadIdentity(). signal: a PeerServer URL, or null for the PeerJS cloud.
  constructor({ store, identity, signal = null, iceServers = ICE_SERVERS, now = () => Date.now(), log = (...args) => console.error(...args) }) {
    super();
    this.store = store;
    this.identity = identity;
    this.server = signalOptions(signal);
    this.iceServers = iceServers;
    this.now = now;
    this.log = log;
    this.conns = new Map();
    this.recent = [];
    this.since = 0;
    this.rtc = null;
    this.signaling = null;
  }

  async start() {
    this.privateKey = await webcrypto.subtle.importKey('jwk', this.identity.privateKey, KEY_ALGORITHM, false, ['sign']);
    const rtc = await import('node-datachannel');
    this.rtc = rtc.default ?? rtc;
    this.signaling = new Signaling({ id: this.identity.peer, server: this.server });
    this.signaling.on('state', (state, detail) => {
      if (state === 'online') this.since = this.now();
      this.emit('state', state, detail);
    });
    this.signaling.on('message', (msg) => this.onSignal(msg));
    this.sweeper = setInterval(() => this.sweep(), 10000);
    this.sweeper.unref();
    this.signaling.start();
  }

  get state() {
    return this.signaling?.state ?? 'off';
  }

  status() {
    return {
      peer: this.identity.peer,
      state: this.state,
      detail: this.signaling?.detail ?? '',
      since: this.state === 'online' ? this.since : 0,
      connections: [...this.conns.values()].filter((c) => c.hello).length,
      recent: this.recent,
    };
  }

  onSignal(msg) {
    const p = msg.payload ?? {};
    const id = p.connectionId;
    if (msg.type === 'OFFER') {
      if (p.type !== 'data' || typeof id !== 'string' || typeof p.sdp?.sdp !== 'string' || this.conns.has(id)) return;
      if (this.conns.size >= MAX_CONNECTIONS) return;
      this.answer(msg.src, id, p.sdp);
    } else if (msg.type === 'CANDIDATE') {
      const conn = this.conns.get(id);
      const c = p.candidate;
      if (!conn || typeof c?.candidate !== 'string' || !c.candidate) return;
      try {
        conn.pc.addRemoteCandidate(c.candidate, typeof c.sdpMid === 'string' ? c.sdpMid : '0');
      } catch {
        // a candidate it cannot use
      }
    } else if (msg.type === 'LEAVE' || msg.type === 'EXPIRE') {
      for (const conn of this.conns.values()) if (conn.peer === msg.src && !conn.dc) this.drop(conn);
    }
  }

  answer(peer, id, sdp) {
    const pc = new this.rtc.PeerConnection(id, { iceServers: this.iceServers });
    const conn = { id, peer, pc, dc: null, hello: false, device: null, pieces: new Reassembler(MAX_PARTS, 2), started: this.now(), lastSeen: this.now(), tokens: 20, busy: false, closed: false };
    this.conns.set(id, conn);
    pc.onLocalDescription((text, type) => this.signaling.send({ type: 'ANSWER', dst: peer, payload: { sdp: { type, sdp: text }, type: 'data', connectionId: id } }));
    pc.onLocalCandidate((candidate, mid) => this.signaling.send({ type: 'CANDIDATE', dst: peer, payload: { candidate: { candidate, sdpMid: mid, sdpMLineIndex: 0 }, type: 'data', connectionId: id } }));
    pc.onStateChange((state) => {
      if (state === 'failed' || state === 'closed') this.drop(conn);
    });
    pc.onDataChannel((dc) => {
      if (conn.closed || conn.dc) {
        dc.close();
        return;
      }
      conn.dc = dc;
      dc.onMessage((data) => this.receive(conn, data));
      dc.onClosed(() => this.drop(conn));
      dc.onError(() => this.drop(conn));
    });
    try {
      pc.setRemoteDescription(sdp.sdp, 'offer');
    } catch (error) {
      this.log(`keeper: a page's offer could not be used: ${error.message ?? error}`);
      this.drop(conn);
    }
  }

  reply(conn, msg) {
    if (conn.closed || !conn.dc?.isOpen()) return;
    try {
      sendText({ send: (text) => conn.dc.sendMessage(text) }, JSON.stringify(msg));
    } catch {
      this.drop(conn);
    }
  }

  async receive(conn, data) {
    if (conn.closed || typeof data !== 'string') return;
    conn.lastSeen = this.now();
    const text = conn.pieces.accept(data);
    if (text == null) return;
    // About one message a second, after a first handful.
    conn.tokens = Math.min(20, conn.tokens + (this.now() - (conn.refilled ?? conn.started)) / 1000);
    conn.refilled = this.now();
    if (conn.tokens < 1) {
      this.reply(conn, { t: 'error', code: 'busy', text: 'Too much at once; try again soon.' });
      return;
    }
    conn.tokens--;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (!conn.hello) {
      if (msg.t !== 'hello' || !isNonce(msg.nonce) || !isDeviceKey(msg.device)) {
        this.drop(conn);
        return;
      }
      if (msg.v !== KEEPER_VERSION) {
        this.reply(conn, { t: 'error', code: 'version', text: 'This keeper speaks a different version.' });
        return;
      }
      conn.hello = true;
      conn.device = msg.device;
      const sig = await webcrypto.subtle.sign(SIGN_ALGORITHM, this.privateKey, challenge(this.identity.peer, msg.nonce));
      this.reply(conn, { t: 'hello', v: KEEPER_VERSION, sig: toBase64Url(sig) });
      return;
    }
    if (conn.busy) {
      this.reply(conn, { t: 'error', code: 'busy', text: 'One thing at a time.' });
      return;
    }
    conn.busy = true;
    try {
      if (msg.t === 'island') {
        const { device, savedAt, name, player } = await this.store.keepIsland(conn.device, msg.id, msg.save);
        this.reply(conn, { t: 'kept', what: 'island', id: msg.id, savedAt });
        this.note({ device, what: 'island', id: msg.id, island: name, player });
      } else if (msg.t === 'profile') {
        const { device, player } = await this.store.keepProfile(conn.device, msg.profile);
        this.reply(conn, { t: 'kept', what: 'profile' });
        this.note({ device, what: 'profile', player });
      } else if (msg.t === 'bye') {
        this.drop(conn);
      }
    } catch (error) {
      if (error instanceof KeepError) this.reply(conn, { t: 'error', code: error.code, text: error.message });
      else {
        this.log(error);
        this.reply(conn, { t: 'error', code: 'oops', text: 'The keeper could not keep that.' });
      }
    } finally {
      conn.busy = false;
    }
  }

  note(event) {
    this.recent.unshift({ at: this.now(), ...event });
    this.recent.length = Math.min(this.recent.length, RECENT);
    this.emit('kept', event);
  }

  sweep() {
    const now = this.now();
    for (const conn of [...this.conns.values()]) {
      if ((!conn.dc?.isOpen() && now - conn.started > CONNECT_TIMEOUT_MS) || now - conn.lastSeen > IDLE_MS) this.drop(conn);
    }
  }

  drop(conn) {
    if (conn.closed) return;
    conn.closed = true;
    this.conns.delete(conn.id);
    // Closing from inside one of its own callbacks is not allowed; do it next.
    setImmediate(() => {
      try {
        conn.dc?.close();
      } catch {
        // already closed
      }
      try {
        conn.pc.close();
      } catch {
        // already closed
      }
    });
  }

  async stop() {
    clearInterval(this.sweeper);
    this.signaling?.stop();
    for (const conn of [...this.conns.values()]) this.drop(conn);
    await new Promise((done) => setImmediate(done));
    await this.store.queue;
  }
}

