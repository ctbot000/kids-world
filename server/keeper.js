// The keeper: keeps a copy of every player's islands and profile, sent by
// their browsers peer to peer whenever this computer is online, and their
// logins. It joins the PeerJS signaling service under the fixed peer id in
// public/keeper.json, answers the data connections pages open to it, proves
// who it is by signing each page's nonce, and files what arrives on disk. The
// protocol is in public/js/shared/keeper.js.
//
//   <data>/keeper.json                              the keeper's id and key pair (private)
//   <data>/devices/<device>/device.json             when the device was seen and from which
//                                                   IP address, its profile and the isle's own
//                                                   world of it, and for a login, whether it left
//                                                   the ranking and the players list
//   <data>/devices/<device>/login.json              its login, if it made one: the username, the
//                                                   password's hash, the logged-in devices' tokens' hashes
//   <data>/devices/<device>/islands/<id>/info.json  the island's name, theme, code, times
//   <data>/devices/<device>/islands/<id>/<day>.json the island as it was at the end of that day
//   <data>/reports/<id>.json                        a problem a player told of: what they wrote,
//                                                   who, and what the page knew of where they were
//   <data>/reports/<id>.jpg                         and the picture of their screen, if it came
//   <data>/wishes/<id>.json                         an idea for the game a player sent CTB's
//                                                   workers (or a problem report in words, for
//                                                   them too), and their answer (see server/ctb.js)
//   <data>/visitors.json                            the pages that came by with no login: when,
//                                                   how often, from where and on what browser
//
// <device> is a hash of the secret device key, so a page can only ever add
// to its own copies, and only once logged in: from a page with no login, the
// keeper keeps nothing but that it came by (its visitors' log). A login turns that folder into a player: other devices
// that log in with its username and password get a token that files their copies
// there too, and brings its islands back to them; a device's copies from
// before it logged in can join them (adoptDevice). It also keeps the list of
// open islands, in memory only: each from a host's page, for as long as that
// page stays connected (see shared/listing.js), and, in memory too, which
// players are playing right now, to invite to an island (see
// shared/friends.js). WebRTC comes from
// node-datachannel, loaded only when the keeper goes online.
import { createHash, randomBytes, scrypt, timingSafeEqual, webcrypto } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { BlockList, isIP } from 'node:net';
import { readFileSync } from 'node:fs';
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
  isPlayerId,
  isPublicKey,
  isToken,
  keptProfile,
  KEEPER_VERSION,
  KEY_ALGORITHM,
  loginName,
  mergeProfiles,
  MAX_PARTS,
  MAX_TEXT,
  OLDEST_VERSION,
  REPORT_TEXT_MAX,
  cleanScore,
  WISH_STAGES,
  WISH_TEXT_MAX,
  WISHES_AN_HOUR,
  WISHES_WAITING,
  TELL_US_LEVEL,
  cleanPassword,
  cleanUsername,
  PASSWORD_MAX,
  passwordProblem,
  USERNAME_MAX,
  usernameKey,
  usernameProblem,
  randomHex,
  SIGN_ALGORITHM,
  toBase64Url,
} from '../public/js/shared/keeper.js';
import { cleanBroadcast } from '../public/js/shared/broadcast.js';
import { cleanLock, LOCK_WARNING_MS, lockNews } from '../public/js/shared/lock.js';
import { cleanOnAir, sameOnAir } from '../public/js/shared/station.js';
import { cleanInvite, isFriendId, sortPlayers } from '../public/js/shared/friends.js';
import { progressOf } from '../public/js/shared/levels.js';
import { cleanListing, sortListings } from '../public/js/shared/listing.js';
import { boardsOf, RANKING_TOP, rankBoards } from '../public/js/shared/ranking.js';
import { lookWithGear } from '../public/js/shared/shop.js';
import { World } from '../public/js/shared/world.js';

export const DEFAULT_DATA_DIR = join(homedir(), '.kids-world');
export const PUBLIC_CONFIG = fileURLToPath(new URL('../public/keeper.json', import.meta.url));

const GB = 1024 ** 3;

// Addresses that say nothing about where a player is: their own network's,
// the carrier's shared one, loopback and link-local.
const NOT_PUBLIC = new BlockList();
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 3]]) {
  NOT_PUBLIC.addSubnet(net, bits, 'ipv4');
}
for (const [net, bits] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) NOT_PUBLIC.addSubnet(net, bits, 'ipv6');

// An IPv4-mapped IPv6 address is not one a page offers; BlockList would also
// match a rule for those against every plain IPv4 address.
export function isPublicIp(ip) {
  const v = isIP(ip);
  return v !== 0 && !/^::ffff:/i.test(ip) && !NOT_PUBLIC.check(ip, v === 4 ? 'ipv4' : 'ipv6');
}

// A player on the keeper's own network (the same Wi-Fi, say) or on this
// computer: their address there is all the keeper ever sees of them.
const LOCAL = new BlockList();
for (const [net, bits] of [['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16]]) LOCAL.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [['::1', 128], ['fc00::', 7]]) LOCAL.addSubnet(net, bits, 'ipv6');

export function isLocalIp(ip) {
  const v = isIP(ip);
  return v !== 0 && !/^::ffff:/i.test(ip) && LOCAL.check(ip, v === 4 ? 'ipv4' : 'ipv6');
}

export const isLoopbackIp = (ip) => /^127\./.test(ip) || ip === '::1';

// The IPv4 address an IPv6 one carries inside it, for the transition
// prefixes that do: NAT64 (64:ff9b::/96), 6to4 (2002::/16) and Teredo
// (2001::/32, the client's address inverted). Any other IPv6 address has no
// IPv4 address of its own; the keeper learns one only if the page offers it.
export function embeddedIpv4(ip) {
  if (isIP(ip) !== 6) return null;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const part = (text) => (text ? text.split(':') : []);
  let words = [...part(head), ...part(tail)];
  if (words.at(-1)?.includes('.')) return null;
  if (ip.includes('::')) words = [...part(head), ...Array(8 - words.length).fill('0'), ...part(tail)];
  const n = words.map((w) => Number.parseInt(w, 16));
  const v4 = (hi, lo, mask = 0) => [hi >> 8, hi & 255, lo >> 8, lo & 255].map((b) => b ^ mask).join('.');
  let found = null;
  if (n[0] === 0x64 && n[1] === 0xff9b && n.slice(2, 6).every((w) => w === 0)) found = v4(n[6], n[7]);
  else if (n[0] === 0x2002) found = v4(n[1], n[2]);
  else if (n[0] === 0x2001 && n[1] === 0) found = v4(n[6], n[7], 255);
  return found && isPublicIp(found) ? found : null;
}

// The public IP address an ICE candidate from a page tells of, and how sure
// it is that it is the player's: 3 for a server-reflexive one (what a STUN
// server saw: the address of the player's internet connection), 2 for a host
// one that is public already, 1 for the address a relayed one was asked for
// from. Browsers hide private host addresses behind mDNS names. Or null.
export function candidateAddress(candidate) {
  const words = String(candidate).replace(/^a=/, '').split(/\s+/);
  const type = words[words.indexOf('typ') + 1];
  const raddr = words.indexOf('raddr');
  const [ip, rank] = type === 'srflx' ? [words[4], 3] : type === 'host' ? [words[4], 2] : type === 'relay' && raddr > 0 ? [words[raddr + 1], 1] : [];
  return ip && isPublicIp(ip) ? { ip, rank } : null;
}

// The address a connection actually talks to, from node-datachannel's
// selected candidate pair: 4 when it is public (the player's own, as their
// router shows it, even when the page never sent its STUN candidate, as
// Chrome sometimes does not), or 0.5 for one on the keeper's own network
// (the page's own candidates there are only mDNS names). Not a relay's: that
// is the TURN server's. Or null.
export function pairAddress(pair) {
  const remote = pair?.remote;
  if (!remote || remote.type === 'relay' || typeof remote.address !== 'string') return null;
  const ip = remote.address;
  return isPublicIp(ip) ? { ip, rank: 4 } : isLocalIp(ip) ? { ip, rank: 0.5 } : null;
}

// The PeerJS cloud and the ICE servers PeerJS pages use by default, so the
// keeper can reach every page a friend's island could.
export const CLOUD = { host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs' };
export const ICE_SERVERS = [
  'stun:stun.l.google.com:19302',
  { hostname: 'eu-0.turn.peerjs.com', port: 3478, username: 'peerjs', password: 'peerjsp', relayType: 'TurnUdp' },
  { hostname: 'us-0.turn.peerjs.com', port: 3478, username: 'peerjs', password: 'peerjsp', relayType: 'TurnUdp' },
];

// A refusal the page is told about: { code, text, ...extra }.
export class KeepError extends Error {
  constructor(code, text, extra = {}) {
    super(text);
    this.code = code;
    this.extra = extra;
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

// A password's hash, slow to make, so that a copy of the folder does not
// give the passwords away easily. What keeps a short one safe is that only
// the keeper has the hash, and that it lets nobody try many times (see
// KeeperStore.login).
const hashPassword = (password, salt) =>
  new Promise((done, fail) => scrypt(cleanPassword(password), salt, 32, { N: 16384, r: 8, p: 1 }, (error, key) => (error ? fail(error) : done(key))));
const PASSWORD_WORDS = {
  short: 'That password is too short.',
  long: 'That password is too long.',
  name: 'Pick a password that is not your username.',
};
const USERNAME_WORDS = {
  short: 'That username is too short.',
  long: 'That username is too long.',
  odd: 'That username has something invisible in it.',
};
// Tokens are kept as hashes too, so a copy of the folder lets nobody in.
const hashToken = (token) => createHash('sha256').update(`kids-world session ${token}`).digest('hex');

// After this many wrong tries for one name, logins with that name wait a while;
// after this many in an hour for any names, all logins do.
const NAME_TRIES = 5;
const NAME_WAIT_MS = 10 * 60000;
const HOUR_TRIES = 200;
const HOUR_MS = 3600000;
// The devices one login can be on at once; the one unused longest is logged out.
const MAX_SESSIONS = 20;

// A kept profile with the look as friends see the player (see shownLook in
// profile.js): the toy weapon worn, and the level worked out from what they
// have done (levels.js), which travels in looks (cleanLook) — onto the name
// tag over them and into the ranking rows, the players list, and invitations.
const shownProfile = (profile) => ({ ...profile, look: lookWithGear(profile.look, profile.gear, progressOf(profile.stats, profile.stickers).level) });

// Says 'change' whenever a player's profile or login changes, or something
// is deleted: what the ranking is made of (see Keeper.rankingChanged).
export class KeeperStore extends EventEmitter {
  constructor(dir, { maxBytes = 2 * GB, keepDays = 30, maxIslands = 200, now = () => Date.now(), dayOf = localDay } = {}) {
    super();
    this.dir = dir;
    this.maxBytes = maxBytes;
    this.keepDays = keepDays;
    this.maxIslands = maxIslands;
    this.now = now;
    this.dayOf = dayOf;
    this.bytes = 0;
    // Writes go one at a time, so two copies of one island never interleave.
    // Whatever runs in the queue must not wait for the queue itself.
    this.queue = Promise.resolve();
    // Where devices were last seen from, until their records keep it (see noteAddress).
    this.addresses = new Map();
    // Wrong pictures lately: per login name, and when, for every name.
    this.tries = new Map();
    this.wrong = [];
    // Logins are checked one at a time: each check is a slow hash per player
    // of that name, and the counts of wrong tries hold only if none overlap.
    this.checking = Promise.resolve();
    // Problem reports lately, per folder, for the limit on them.
    this.reportTimes = new Map();
    // Ideas sent lately, per player, for the limit on them.
    this.wishTimes = new Map();
    // The visitors' log, once read (see visitors).
    this.visitorList = null;
  }

  // Counts what is kept already, and gives logins from before usernames one.
  // Folders are made when the first copy arrives.
  async open() {
    this.bytes = (await folderSize(join(this.dir, 'devices'))) + (await folderSize(join(this.dir, 'reports')));
    await this.nameOldLogins();
    return this;
  }

  // Logins from before usernames went by the player's made-up name: it
  // becomes their username, as it was then. Two players of one name keep it
  // both, told apart by their passwords as before.
  async nameOldLogins() {
    for (const device of await readdir(join(this.dir, 'devices')).catch(() => [])) {
      if (!isDeviceId(device)) continue;
      const login = await this.readLogin(device);
      if (!login || login.username) continue;
      const name = loginName((await readJson(this.path(device, 'device.json')))?.profile?.name);
      if (name) await this.write(this.path(device, 'login.json'), JSON.stringify({ ...login, username: name }));
    }
  }

  // Every login, with its folder: [{ device, login }].
  async logins() {
    const out = [];
    for (const device of await readdir(join(this.dir, 'devices')).catch(() => [])) {
      if (!isDeviceId(device)) continue;
      const login = await this.readLogin(device);
      if (login) out.push({ device, login });
    }
    return out;
  }

  static deviceId(key) {
    return createHash('sha256').update(`kids-world device ${key}`).digest('hex').slice(0, 20);
  }

  // Inside a device's folder. Callers check the id first.
  path(device, ...rest) {
    return join(this.dir, 'devices', device, ...rest);
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
    if (/(?:device|login)\.json$/.test(file)) this.emit('change');
  }

  async remove(path) {
    const size = (await stat(path).catch(() => null))?.isDirectory() ? await folderSize(path) : await sizeOf(path);
    await rm(path, { recursive: true, force: true });
    this.bytes = Math.max(0, this.bytes - size);
    this.emit('change');
  }

  room(extra) {
    if (this.bytes + extra > this.maxBytes) throw new KeepError('full', 'The keeper is full.');
  }

  async seen(device, changes) {
    const file = this.path(device, 'device.json');
    const now = this.now();
    const old = (await readJson(file)) ?? { id: device, firstSeen: now };
    const record = { ...old, ...changes, id: device, lastSeen: now };
    if (this.addresses.has(device)) {
      const { ip, ip4 } = this.addresses.get(device);
      record.ip = ip;
      if (ip4) record.ip4 = ip4;
      else delete record.ip4;
      this.addresses.delete(device);
    }
    await this.write(file, JSON.stringify(record));
    return record;
  }

  // The IP address a device (or a player, on any of their devices) was last
  // seen from: a public one, or a local one for a player on the keeper's own
  // network, and with an IPv6 one, the IPv4 one it also has (ip4), when
  // known. Into its record now, if it has one and the address is new, or
  // else with whatever it sends first.
  noteAddress(device, ip, ip4 = null) {
    if (!isDeviceId(device) || !(isPublicIp(ip) || isLocalIp(ip))) return Promise.resolve();
    ip4 = isIP(ip) === 6 ? (ip4 && isIP(ip4) === 4 && (isPublicIp(ip4) || !isPublicIp(ip)) ? ip4 : embeddedIpv4(ip)) : null;
    if (this.addresses.size >= 1000) this.addresses.clear();
    this.addresses.set(device, { ip, ip4 });
    return this.serial(async () => {
      if (!this.addresses.has(device)) return;
      const old = await readJson(this.path(device, 'device.json'));
      if (!old) return this.visitorAddress(device);
      if (old.ip === ip && (old.ip4 ?? null) === ip4) this.addresses.delete(device);
      else await this.seen(device, {});
    });
  }

  // ------------------------------------------------ copies

  // From a page that is not logged in: filed under its device key.
  keepIsland(key, id, save) {
    if (!isDeviceKey(key)) return Promise.reject(new KeepError('bad', 'That is not an island this keeper knows how to keep.'));
    return this.keepIslandIn(KeeperStore.deviceId(key), id, save);
  }

  // newerOnly: for a player's folder, which several devices send to, where a
  // copy older than the one kept already is not kept over it ({ stale }).
  keepIslandIn(device, id, save, { newerOnly = false } = {}) {
    if (!isDeviceId(device) || !isIslandId(id)) return Promise.reject(new KeepError('bad', 'That is not an island this keeper knows how to keep.'));
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
      const islands = this.path(device, 'islands');
      const folder = join(islands, id);
      const known = await stat(folder).catch(() => null);
      if (!known) {
        const count = (await readdir(islands).catch(() => [])).length;
        if (count >= this.maxIslands) throw new KeepError('full', 'The keeper has no room for more islands from this device.');
      }
      const old = known ? await readJson(join(folder, 'info.json')) : null;
      const now = this.now();
      const savedAt = Number.isFinite(save.savedAt) ? save.savedAt : now;
      if (newerOnly && old && old.savedAt > savedAt) {
        const record = await this.seen(device, {});
        return { device, savedAt: old.savedAt, name: old.name, player: record.profile?.name ?? '', stale: true };
      }
      this.room(text.length);
      await mkdir(folder, { recursive: true, mode: 0o700 });
      await this.write(join(folder, `${this.dayOf(now)}.json`), text);
      // Said goodbye to on one device and changed on another since, it is back.
      const forgotten = old?.forgotten >= savedAt ? { forgotten: old.forgotten } : {};
      const info = { id, name: world.name, theme: world.theme, code: isValidCode(save.code) ? save.code : '', savedAt, keptAt: now, bytes: text.length, ...forgotten };
      await this.write(join(folder, 'info.json'), JSON.stringify(info));
      // One copy a day, for the last keepDays days that had one.
      const days = (await readdir(folder)).filter((f) => isDay(f.slice(0, -5)) && f.endsWith('.json')).sort();
      for (const day of days.slice(0, Math.max(0, days.length - this.keepDays))) await this.remove(join(folder, day));
      const record = await this.seen(device, {});
      return { device, savedAt, name: world.name, player: record.profile?.name ?? '' };
    });
  }

  keepProfile(key, raw) {
    if (!isDeviceKey(key)) return Promise.reject(new KeepError('bad', 'Unknown device.'));
    return this.keepProfileIn(KeeperStore.deviceId(key), raw);
  }

  keepProfileIn(device, raw) {
    if (!isDeviceId(device)) return Promise.reject(new KeepError('bad', 'Unknown device.'));
    const profile = keptProfile(raw);
    return this.serial(() => this.storeProfile(device, profile));
  }

  // Returns { device, player, onlyStats }: onlyStats when nothing changed
  // but what they have done, as it does every few seconds while a player
  // with a login plays (for the ranking).
  async storeProfile(device, profile) {
    this.room(JSON.stringify(profile).length);
    await mkdir(this.path(device), { recursive: true, mode: 0o700 });
    const old = (await readJson(this.path(device, 'device.json')))?.profile;
    await this.seen(device, { profile, profileAt: this.now() });
    const onlyStats = Boolean(old) && JSON.stringify({ ...keptProfile(old), stats: 0 }) === JSON.stringify({ ...profile, stats: 0 });
    return { device, player: profile.name, onlyStats };
  }

  // The isle's own world of a player (the shared isle is a world of its own,
  // see main.js): its own profile, kept beside theirs the same way — its own
  // basket, coins, gear, stickers and what they did there.
  keepAdventure(key, raw) {
    if (!isDeviceKey(key)) return Promise.reject(new KeepError('bad', 'Unknown device.'));
    return this.keepAdventureIn(KeeperStore.deviceId(key), raw);
  }

  keepAdventureIn(device, raw) {
    if (!isDeviceId(device)) return Promise.reject(new KeepError('bad', 'Unknown device.'));
    const profile = keptProfile(raw);
    return this.serial(() => this.storeAdventure(device, profile));
  }

  async storeAdventure(device, profile) {
    this.room(JSON.stringify(profile).length);
    await mkdir(this.path(device), { recursive: true, mode: 0o700 });
    const old = (await readJson(this.path(device, 'device.json')))?.adventure?.profile;
    await this.seen(device, { adventure: { profile, profileAt: this.now() } });
    const onlyStats = Boolean(old) && JSON.stringify({ ...keptProfile(old), stats: 0 }) === JSON.stringify({ ...profile, stats: 0 });
    return { device, player: profile.name, onlyStats };
  }

  // ------------------------------------------------ logins

  async readLogin(device) {
    const login = await readJson(this.path(device, 'login.json'));
    if (typeof login?.salt !== 'string' || typeof login.hash !== 'string') return null;
    return { ...login, sessions: login.sessions && typeof login.sessions === 'object' ? login.sessions : {} };
  }

  // A new session for a device that logged in; the one unused longest goes
  // when there are too many.
  static addSession(login, token, now) {
    login.sessions[hashToken(token)] = { at: now, seen: now };
    const old = Object.entries(login.sessions).sort((a, b) => (b[1].seen ?? 0) - (a[1].seen ?? 0));
    for (const [hash] of old.slice(MAX_SESSIONS)) delete login.sessions[hash];
  }

  // Makes a login for a device's folder, or gives it a new password.
  // username: the login's, which no other login may have (in any case or
  // width); for a login that has one already, it stays when left out. A page
  // from before usernames leaves it out, and its made-up name is taken.
  // profile: who the player is, kept first. Returns { player, token,
  // username }; the token is for the device that made it, unless session is
  // false (a new password from a device already in, or from the admin
  // pages). A login from before passwords (made with secret pictures)
  // becomes a password login this way, its devices still in.
  makeLogin(device, password, profile = null, { session = true, username = null } = {}) {
    if (!isDeviceId(device) || typeof password !== 'string') return Promise.reject(new KeepError('bad', 'That is not a password.'));
    return this.serial(async () => {
      if (profile) await this.storeProfile(device, keptProfile(profile));
      const record = await readJson(this.path(device, 'device.json'));
      const old = await this.readLogin(device);
      const wanted = cleanUsername(username ?? old?.username ?? loginName(record?.profile?.name));
      const problem = usernameProblem(wanted);
      if (problem) throw new KeepError('username', USERNAME_WORDS[problem], { problem });
      // A new username, or a changed one, must be no other login's. One kept
      // as it was stays, even shared by two logins from before usernames.
      const key = usernameKey(wanted);
      const changed = !old || usernameKey(old.username) !== key;
      if (changed && (await this.logins()).some((other) => other.device !== device && usernameKey(other.login.username) === key)) {
        throw new KeepError('taken', 'Someone has that username already.');
      }
      const weak = passwordProblem(password, wanted);
      if (weak) throw new KeepError('weak', PASSWORD_WORDS[weak], { problem: weak });
      const salt = randomBytes(16).toString('hex');
      const hash = (await hashPassword(password, salt)).toString('hex');
      const now = this.now();
      const login = { kind: 'password', username: wanted, salt, hash, made: old?.made ?? now, changed: now, sessions: old?.sessions ?? {} };
      const token = session ? randomHex(16) : null;
      if (token) KeeperStore.addSession(login, token, now);
      if (!(await stat(this.path(device)).catch(() => null))) await mkdir(this.path(device), { recursive: true, mode: 0o700 });
      await this.write(this.path(device, 'login.json'), JSON.stringify(login));
      return { player: device, token, username: wanted };
    });
  }

  // How long logins with this username wait before another try, in ms.
  waitFor(name) {
    const now = this.now();
    this.wrong = this.wrong.filter((t) => now - t < HOUR_MS);
    const t = this.tries.get(name);
    const mine = t && t.count >= NAME_TRIES ? t.last + NAME_WAIT_MS : 0;
    const all = this.wrong.length >= HOUR_TRIES ? this.wrong[0] + HOUR_MS : 0;
    return Math.max(0, mine - now, all - now);
  }

  wrongTry(name) {
    const now = this.now();
    const t = this.tries.get(name);
    this.tries.set(name, { count: t && now - t.last < NAME_WAIT_MS ? t.count + 1 : 1, last: now });
    this.wrong.push(now);
    if (this.tries.size > 2000) {
      for (const [key, value] of this.tries) if (now - value.last >= NAME_WAIT_MS) this.tries.delete(key);
    }
  }

  // Logs a device in: finds the login with this username whose password
  // this is, and gives the device a token for it. Returns { player, token,
  // username, profile }. A wrong password and a username with no login get
  // the same answer; after a few, that username waits. A login from before
  // passwords has none to match: a device still logged in to it, or the
  // admin pages, give it one.
  login(username, password) {
    const run = this.checking.then(() => this.checkLogin(username, password));
    this.checking = run.catch(() => {});
    return run;
  }

  async checkLogin(username, password) {
    const who = usernameKey(username);
    const wait = who ? this.waitFor(who) : 0;
    if (wait > 0) throw new KeepError('wait', 'Too many tries. Wait a little, then try again.', { wait });
    const wrong = () => new KeepError('wrong', 'That is not the right password.');
    const tooLong = (text, max) => [...text].length > max;
    if (!who || tooLong(who, USERNAME_MAX * 2) || typeof password !== 'string' || tooLong(cleanPassword(password), PASSWORD_MAX)) throw wrong();
    const found = [];
    for (const { device, login } of await this.logins()) {
      if (login.kind !== 'password' || usernameKey(login.username) !== who) continue;
      const hash = await hashPassword(password, login.salt);
      const kept = Buffer.from(login.hash, 'hex');
      const record = await readJson(this.path(device, 'device.json'));
      if (kept.length === hash.length && timingSafeEqual(hash, kept)) found.push({ device, seen: record?.lastSeen ?? 0, username: login.username });
    }
    if (!found.length) {
      this.wrongTry(who);
      throw wrong();
    }
    this.tries.delete(who);
    // Two logins of one name from before usernames, with one password: the one seen last.
    const { device } = found.sort((a, b) => b.seen - a.seen)[0];
    return this.serial(async () => {
      const login = await this.readLogin(device);
      if (!login) throw wrong();
      const token = randomHex(16);
      KeeperStore.addSession(login, token, this.now());
      await this.write(this.path(device, 'login.json'), JSON.stringify(login));
      const record = await readJson(this.path(device, 'device.json'));
      return { player: device, token, username: login.username, profile: record?.profile ?? null };
    });
  }

  // Whether a device that logged in still is: its token is one this player
  // gave out, and nobody removed the login since.
  checkSession(device, token) {
    if (!isPlayerId(device) || !isToken(token)) return Promise.resolve(false);
    return this.serial(async () => {
      const login = await this.readLogin(device);
      const session = login?.sessions[hashToken(token)];
      if (!session) return false;
      // When it was last used, at most once an hour.
      if (this.now() - (session.seen ?? 0) > HOUR_MS) {
        session.seen = this.now();
        await this.write(this.path(device, 'login.json'), JSON.stringify(login));
      }
      return true;
    });
  }

  logout(device, token) {
    if (!isPlayerId(device) || !isToken(token)) return Promise.resolve(false);
    return this.serial(async () => {
      const login = await this.readLogin(device);
      if (!login?.sessions[hashToken(token)]) return false;
      delete login.sessions[hashToken(token)];
      await this.write(this.path(device, 'login.json'), JSON.stringify(login));
      return true;
    });
  }

  // From the admin pages: every device logged in to it is logged out.
  removeLogin(device) {
    if (!isDeviceId(device)) return Promise.resolve(false);
    return this.serial(async () => {
      const file = this.path(device, 'login.json');
      if (!(await stat(file).catch(() => null))) return false;
      await this.remove(file);
      return true;
    });
  }

  // A device's copies from before it logged in (or from a device that is
  // gone, from the admin pages) become a player's: its islands move into the
  // player's folder, where the newer copy of an island both have stays; its
  // stickers and what it did join the player's profile (the most of each);
  // and its folder goes. Returns how many islands moved.
  adoptDevice(device, player) {
    if (!isDeviceId(device) || !isPlayerId(player) || device === player) return Promise.reject(new KeepError('bad', 'That cannot be moved there.'));
    return this.serial(async () => {
      if (!(await this.readLogin(player))) throw new KeepError('bad', 'That player has no login.');
      if (await this.readLogin(device)) throw new KeepError('bad', 'Those copies are a player with a login of their own.');
      if (!(await stat(this.path(device)).catch(() => null))) return 0;
      await mkdir(this.path(player, 'islands'), { recursive: true, mode: 0o700 });
      let moved = 0;
      for (const id of await readdir(this.path(device, 'islands')).catch(() => [])) {
        if (!isIslandId(id)) continue;
        const from = this.path(device, 'islands', id);
        const to = this.path(player, 'islands', id);
        const kept = await readJson(join(to, 'info.json'));
        if (kept) {
          if (((await readJson(join(from, 'info.json')))?.savedAt ?? 0) <= (kept.savedAt ?? 0)) continue;
          await this.remove(to);
        }
        await rename(from, to);
        moved++;
      }
      const gone = await readJson(this.path(device, 'device.json'));
      const theirs = gone?.profile;
      const record = await readJson(this.path(player, 'device.json'));
      if (theirs && record?.profile) {
        // The player's name, look and basket; everyone's stickers.
        await this.seen(player, { profile: mergeProfiles(record.profile, { ...theirs, changedAt: 0 }), profileAt: this.now() });
      }
      // The isle's own world of them joins the player's the same way.
      const isleTheirs = gone?.adventure?.profile;
      const isleMine = record?.adventure?.profile;
      if (isleTheirs && isleMine) {
        await this.seen(player, { adventure: { profile: mergeProfiles(isleMine, { ...isleTheirs, changedAt: 0 }), profileAt: this.now() } });
      }
      await this.remove(this.path(device));
      return moved;
    });
  }

  // ------------------------------------------------ for a logged-in page

  // The player's profile and islands, so each of their devices can fetch
  // what it lacks, and the islands they said goodbye to, so it drops those;
  // and the isle's own world of them, to merge with theirs here.
  async list(device) {
    if (!isDeviceId(device)) return { profile: null, adventure: null, islands: [], forgotten: [] };
    const record = await readJson(this.path(device, 'device.json'));
    const islands = [];
    const forgotten = [];
    for (const id of await readdir(this.path(device, 'islands')).catch(() => [])) {
      if (!isIslandId(id)) continue;
      const info = await readJson(this.path(device, 'islands', id, 'info.json'));
      if (!info) continue;
      if (info.forgotten) forgotten.push({ id, at: info.forgotten });
      else islands.push({ id, name: info.name, theme: info.theme, code: info.code, savedAt: info.savedAt });
    }
    return { profile: record?.profile ?? null, adventure: record?.adventure?.profile ?? null, islands, forgotten };
  }

  // The latest copy of one of the player's islands, as kept (JSON text).
  async islandText(device, id) {
    const info = await this.islandInfo(device, id);
    if (!info || info.forgotten) return null;
    const file = await this.islandFile(device, id);
    return file ? readFile(file, 'utf8').catch(() => null) : null;
  }

  // The player said goodbye to an island on one of their devices, at `at`:
  // the others drop it too, unless it was changed later. Its copies stay
  // here, for the admin pages.
  forgetIsland(device, id, at = this.now()) {
    if (!isDeviceId(device) || !isIslandId(id)) return Promise.resolve(false);
    return this.serial(async () => {
      const file = this.path(device, 'islands', id, 'info.json');
      const info = await readJson(file);
      if (!info) return false;
      // Later than every copy kept, even from a device whose clock is ahead.
      const when = Math.max(Number.isFinite(at) ? Math.min(at, this.now() + HOUR_MS) : this.now(), info.savedAt ?? 0);
      await this.write(file, JSON.stringify({ ...info, forgotten: Math.max(when, info.forgotten ?? 0) }));
      return true;
    });
  }

  // ------------------------------------------------ the ranking

  // Every board of the ranking (see rankBoards): the players with a login,
  // but for those who left it. me: the player asking, if logged in, who
  // also learns whether they are in it ({ shown }). world: 'isle' for the
  // isle's own boards, from the isle's own world of each player.
  async ranking(me = null, world = 'home') {
    return KeeperStore.rankingOf(await this.players(world), me, world);
  }

  // Every player with a login, their profile, and whether they are in the
  // ranking and on the players list: [{ id, profile, ranked, findable }].
  // The look comes with the player's level in it (shownProfile), for every
  // list this serves. Read once for everyone watching the ranking.
  // world: 'isle' for each one's world on the shared isle.
  async players(world = 'home') {
    const players = [];
    for (const { device } of await this.logins()) {
      const record = await readJson(this.path(device, 'device.json'));
      const kept = world === 'isle' ? record?.adventure?.profile : record?.profile;
      players.push({ id: device, profile: kept ? shownProfile(keptProfile(kept)) : null, ranked: record?.ranked !== false, findable: record?.findable !== false });
    }
    return players;
  }

  static rankingOf(players, me = null, world = 'home') {
    const shown = players.find((p) => p.id === me)?.ranked ?? true;
    return { ...rankBoards(players.filter((p) => p.profile && p.ranked), me, RANKING_TOP, boardsOf(world)), ...(isPlayerId(me) ? { shown } : {}) };
  }

  // A player with a login joins the ranking, or leaves it: by their own
  // choice, or a grown-up's on the admin pages. Returns whether there is
  // such a player.
  setRanked(device, on) {
    return this.setChoice(device, 'ranked', on);
  }

  // A player with a login goes on the players list, where others can invite
  // them to their islands, or leaves it. Returns whether there is such a player.
  setFindable(device, on) {
    return this.setChoice(device, 'findable', on);
  }

  // A choice of a player with a login, kept with them (so it holds on all
  // their devices): off is written down, on is the way it starts.
  setChoice(device, key, on) {
    if (!isDeviceId(device)) return Promise.resolve(false);
    return this.serial(async () => {
      if (!(await this.readLogin(device))) return false;
      const file = this.path(device, 'device.json');
      const record = (await readJson(file)) ?? { id: device };
      delete record[key];
      await this.write(file, JSON.stringify(on ? record : { ...record, [key]: false }));
      return true;
    });
  }

  // ------------------------------------------------ for the admin pages

  async devices() {
    const root = join(this.dir, 'devices');
    const out = [];
    for (const device of await readdir(root).catch(() => [])) {
      if (!isDeviceId(device)) continue;
      const info = (await readJson(join(root, device, 'device.json'))) ?? { id: device };
      const login = await this.readLogin(device);
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
      out.push({
        id: device,
        firstSeen: info.firstSeen ?? 0,
        lastSeen: info.lastSeen ?? 0,
        profile: info.profile ?? null,
        profileAt: info.profileAt ?? 0,
        // The isle's own world of them, when they have played there.
        adventure: info.adventure?.profile ? { profile: info.adventure.profile, adventureAt: info.adventure.profileAt ?? 0 } : null,
        ip: info.ip ?? null,
        ip4: info.ip4 ?? null,
        ranked: info.ranked !== false,
        findable: info.findable !== false,
        // Never the hashes: when it was made, on how many devices it is, and
        // whether it has a password yet (one from before passwords has not).
        login: login
          ? { username: login.username ?? '', made: login.made ?? 0, changed: login.changed ?? 0, devices: Object.keys(login.sessions).length, password: login.kind === 'password' }
          : null,
        islands,
      });
    }
    return out.sort((a, b) => b.lastSeen - a.lastSeen);
  }

  async islandInfo(device, id) {
    if (!isDeviceId(device) || !isIslandId(id)) return null;
    return readJson(this.path(device, 'islands', id, 'info.json'));
  }

  // The island as it was at the end of `day`, or its latest copy. Null if there is none.
  async islandFile(device, id, day = null) {
    if (!isDeviceId(device) || !isIslandId(id) || (day !== null && !isDay(day))) return null;
    const folder = this.path(device, 'islands', id);
    const days = (await readdir(folder).catch(() => [])).map((f) => f.slice(0, -5)).filter(isDay).sort();
    const pick = day ?? days.at(-1);
    return pick && days.includes(pick) ? join(folder, `${pick}.json`) : null;
  }

  deleteIsland(device, id) {
    if (!isDeviceId(device) || !isIslandId(id)) return Promise.resolve(false);
    return this.serial(async () => {
      const folder = this.path(device, 'islands', id);
      if (!(await stat(folder).catch(() => null))) return false;
      await this.remove(folder);
      return true;
    });
  }

  deleteDevice(device) {
    if (!isDeviceId(device)) return Promise.resolve(false);
    return this.serial(async () => {
      const folder = this.path(device);
      if (!(await stat(folder).catch(() => null))) return false;
      await this.remove(folder);
      return true;
    });
  }

  // ------------------------------------------------ problem reports

  // A player's level in Adventure Isle's own world: 1 before they played there.
  async isleLevel(player) {
    const isle = (await readJson(this.path(player, 'device.json')))?.adventure?.profile;
    return isle ? progressOf(isle.stats, isle.stickers).level : 1;
  }

  // Keeps a problem report from this folder: { id, player }.
  keepReport(device, raw) {
    if (!isDeviceId(device)) return Promise.reject(new KeepError('bad', 'Unknown device.'));
    const report = cleanReport(raw);
    if (!report) return Promise.reject(new KeepError('bad', 'That is not a problem report.'));
    const now = this.now();
    const times = (this.reportTimes.get(device) ?? []).filter((t) => now - t < HOUR_MS);
    if (times.length >= REPORTS_AN_HOUR) return Promise.reject(new KeepError('wait', 'That is a lot of reports. Try again later.'));
    times.push(now);
    this.reportTimes.set(device, times);
    if (this.reportTimes.size > 1000) this.reportTimes.delete(this.reportTimes.keys().next().value);
    return this.serial(async () => {
      const folder = join(this.dir, 'reports');
      const id = `${now}-${randomHex(4)}`;
      const record = (await readJson(this.path(device, 'device.json'))) ?? {};
      const login = await this.readLogin(device);
      const info = {
        id,
        at: now,
        device,
        // The name the keeper has for them, or, before their first copy (or with copies off), the page's.
        player: record.profile?.name || report.about.name,
        username: login?.username ?? '',
        text: report.text,
        about: report.about,
        picture: Boolean(report.picture),
        seen: false,
      };
      const text = JSON.stringify(info);
      this.room(text.length + (report.picture?.length ?? 0));
      await mkdir(folder, { recursive: true, mode: 0o700 });
      if (report.picture) {
        await writeFile(join(folder, `${id}.jpg`), report.picture);
        this.bytes += report.picture.length;
      }
      await this.write(join(folder, `${id}.json`), text);
      // The newest REPORTS_KEPT, and the rest go.
      const ids = (await readdir(folder)).filter((f) => f.endsWith('.json') && isReportId(f.slice(0, -5))).map((f) => f.slice(0, -5)).sort();
      for (const old of ids.slice(0, Math.max(0, ids.length - REPORTS_KEPT))) await this.dropReport(old);
      return { id, player: info.player };
    });
  }

  // Every report, the newest first, without the pictures.
  async reports() {
    const folder = join(this.dir, 'reports');
    const out = [];
    for (const f of await readdir(folder).catch(() => [])) {
      if (!f.endsWith('.json') || !isReportId(f.slice(0, -5))) continue;
      const report = await readJson(join(folder, f));
      if (report) out.push(report);
    }
    return out.sort((a, b) => b.at - a.at);
  }

  // The picture of a report's screen, or null.
  async reportPicture(id) {
    if (!isReportId(id)) return null;
    const file = join(this.dir, 'reports', `${id}.jpg`);
    return (await stat(file).catch(() => null)) ? file : null;
  }

  // Marks a report looked into (seen), or not.
  setReportSeen(id, seen) {
    if (!isReportId(id)) return Promise.resolve(false);
    return this.serial(async () => {
      const file = join(this.dir, 'reports', `${id}.json`);
      const report = await readJson(file);
      if (!report) return false;
      await this.write(file, JSON.stringify({ ...report, seen: Boolean(seen) }));
      return true;
    });
  }

  deleteReport(id) {
    if (!isReportId(id)) return Promise.resolve(false);
    return this.serial(() => this.dropReport(id));
  }

  // In the queue already.
  async dropReport(id) {
    const folder = join(this.dir, 'reports');
    if (!(await stat(join(folder, `${id}.json`)).catch(() => null))) return false;
    for (const ext of ['jpg', 'json']) {
      const file = join(folder, `${id}.${ext}`);
      const size = await sizeOf(file);
      await rm(file, { force: true });
      this.bytes = Math.max(0, this.bytes - size);
    }
    return true;
  }

  // ------------------------------------------------ visitors

  // The pages that came by with no login, for the admin pages, the latest
  // first: [{ device, firstSeen, lastSeen, visits, about, ip, ip4 }], one
  // for each device, at most VISITORS_KEPT. Nothing of theirs is kept, only
  // that they came, from where and on what.
  async visitors() {
    if (!this.visitorList) {
      const list = await readJson(join(this.dir, 'visitors.json'));
      this.visitorList ??= (Array.isArray(list) ? list : []).filter((v) => isDeviceId(v?.device));
    }
    return this.visitorList;
  }

  // A page with no login came by (see Keeper.handle): about is what its page
  // said of itself (see cleanVisit).
  noteVisit(device, about) {
    if (!isDeviceId(device)) return Promise.reject(new KeepError('bad', 'That is not a device.'));
    return this.serial(async () => {
      const list = await this.visitors();
      const now = this.now();
      const at = list.findIndex((v) => v.device === device);
      const old = at >= 0 ? list.splice(at, 1)[0] : { device, firstSeen: now, visits: 0 };
      list.unshift({ ...old, lastSeen: now, visits: old.visits + 1, about: cleanVisit(about) });
      list.length = Math.min(list.length, VISITORS_KEPT);
      await (this.addressOfVisitor(list[0]) || this.writeVisitors());
    });
  }

  // In the queue already: a visitor's address, noted before or after its
  // visit, into its entry.
  async visitorAddress(device) {
    const entry = (await this.visitors()).find((v) => v.device === device);
    if (entry) await this.addressOfVisitor(entry);
  }

  // Writes the visitors' log, with the address noted for this entry, if any
  // (else false, and nothing is written).
  addressOfVisitor(entry) {
    const noted = this.addresses.get(entry.device);
    if (!noted) return false;
    this.addresses.delete(entry.device);
    entry.ip = noted.ip;
    if (noted.ip4) entry.ip4 = noted.ip4;
    else delete entry.ip4;
    return this.writeVisitors();
  }

  // Empties the visitors' log.
  clearVisitors() {
    return this.serial(async () => {
      this.visitorList = [];
      await this.writeVisitors();
    });
  }

  // Through a temporary file, as copies are; not counted as what is kept.
  async writeVisitors() {
    const file = join(this.dir, 'visitors.json');
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await writeFile(`${file}.tmp`, JSON.stringify(this.visitorList ?? []));
    await rename(`${file}.tmp`, file);
  }

  // ------------------------------------------------ ideas for the game

  // Keeps a player's idea for CTB's workers to read: the idea as kept, with
  // who sent it ({ id, at, player, name, username, text, state: 'waiting' }).
  keepWish(player, raw) {
    if (!isDeviceId(player)) return Promise.reject(new KeepError('bad', 'Log in to send an idea.'));
    const text = shortText(raw, WISH_TEXT_MAX).replace(/\s+/gu, ' ');
    if (!text) return Promise.reject(new KeepError('bad', 'Write your idea first.'));
    const now = this.now();
    const times = (this.wishTimes.get(player) ?? []).filter((t) => now - t < HOUR_MS);
    if (times.length >= WISHES_AN_HOUR) return Promise.reject(new KeepError('wait', 'That is a lot of ideas! Send another one later.'));
    return this.serial(async () => {
      const mine = (await this.wishes()).filter((w) => w.player === player && w.state === 'waiting' && w.kind !== 'bug');
      if (mine.length >= WISHES_WAITING) throw new KeepError('wait', 'Your other ideas are still being read. Wait for an answer first!');
      times.push(now);
      this.wishTimes.set(player, times);
      if (this.wishTimes.size > 1000) this.wishTimes.delete(this.wishTimes.keys().next().value);
      const record = (await readJson(this.path(player, 'device.json'))) ?? {};
      const login = await this.readLogin(player);
      const wish = { id: `${now}-${randomHex(4)}`, at: now, player, name: record.profile?.name ?? '', username: login?.username ?? '', text, state: 'waiting', by: '', reply: '', answeredAt: 0 };
      const json = JSON.stringify(wish);
      this.room(json.length);
      const folder = join(this.dir, 'wishes');
      await mkdir(folder, { recursive: true, mode: 0o700 });
      await this.write(join(folder, `${wish.id}.json`), json);
      const ids = (await readdir(folder)).filter((f) => f.endsWith('.json') && isReportId(f.slice(0, -5))).sort();
      for (const old of ids.slice(0, Math.max(0, ids.length - WISHES_KEPT))) await rm(join(folder, old), { force: true });
      return wish;
    });
  }

  // A problem report (keepReport's id) kept for CTB's workers beside the
  // player's ideas, read and answered the same way: the wish as kept, or
  // null for one with neither words nor a picture. Its limits are the
  // report's own.
  keepBug(player, reportId) {
    if (!isDeviceId(player) || !isReportId(reportId)) return Promise.resolve(null);
    return this.serial(async () => {
      const report = await readJson(join(this.dir, 'reports', `${reportId}.json`));
      const text = shortText(report?.text, REPORT_TEXT_MAX).replace(/\s+/gu, ' ');
      if (!text && !report?.picture) return null;
      const now = this.now();
      const record = (await readJson(this.path(player, 'device.json'))) ?? {};
      const login = await this.readLogin(player);
      const wish = { id: `${now}-${randomHex(4)}`, at: now, player, name: record.profile?.name || report.player || '', username: login?.username ?? '', kind: 'bug', report: reportId, text, picture: Boolean(report.picture), state: 'waiting', by: '', reply: '', answeredAt: 0 };
      const json = JSON.stringify(wish);
      this.room(json.length);
      const folder = join(this.dir, 'wishes');
      await mkdir(folder, { recursive: true, mode: 0o700 });
      await this.write(join(folder, `${wish.id}.json`), json);
      return wish;
    });
  }

  // Open problem reports that CTB has not had (from before it read them,
  // say), each kept for it now as keepBug does: the wishes kept. Only from
  // a login, as every report is now, and the oldest first.
  async handOverReports() {
    const had = new Set((await this.wishes()).filter((w) => w.kind === 'bug').map((w) => w.report));
    const out = [];
    for (const r of (await this.reports()).reverse()) {
      if (r.seen || !r.username || (!String(r.text ?? '').trim() && !r.picture) || had.has(r.id)) continue;
      const bug = await this.keepBug(r.device, r.id);
      if (bug) out.push(bug);
    }
    return out;
  }

  // Every idea kept (and problem report for CTB, kind 'bug'), the newest first.
  async wishes() {
    const folder = join(this.dir, 'wishes');
    const out = [];
    for (const f of await readdir(folder).catch(() => [])) {
      if (!f.endsWith('.json') || !isReportId(f.slice(0, -5))) continue;
      const wish = await readJson(join(folder, f));
      if (wish) out.push(wish);
    }
    return out.sort((a, b) => b.at - a.at);
  }

  // A player's own ideas, the newest first.
  async wishesOf(player) {
    return (await this.wishes()).filter((w) => w.player === player).slice(0, WISHES_SHOWN);
  }

  // A worker's answer to an idea: { state, by, reply, issue }. The idea as
  // kept now, or null when there is no such idea.
  answerWish(id, answer) {
    if (!isReportId(id)) return Promise.resolve(null);
    return this.serial(async () => {
      const file = join(this.dir, 'wishes', `${id}.json`);
      const wish = await readJson(file);
      if (!wish) return null;
      const next = { ...wish, state: answer.state, by: shortText(answer.by, 40), reply: shortText(answer.reply, 400), answeredAt: this.now(), score: cleanScore(answer.score), ...(answer.issue ? { issue: answer.issue } : {}) };
      await this.write(file, JSON.stringify(next));
      return next;
    });
  }

  // News of an accepted idea: where it has got to (a WISH_STAGES stage).
  // The idea as kept now, or null when there is no such idea or it was there
  // already.
  stageWish(id, stage) {
    if (!isReportId(id) || !WISH_STAGES.includes(stage)) return Promise.resolve(null);
    return this.serial(async () => {
      const file = join(this.dir, 'wishes', `${id}.json`);
      const wish = await readJson(file);
      if (!wish || wish.stage === stage) return null;
      const next = { ...wish, stage, stageAt: this.now() };
      await this.write(file, JSON.stringify(next));
      return next;
    });
  }
}

// ---------------------------------------------------------------- problem reports

// A problem a player told of, from a page (see KeeperClient.report): what
// they wrote, a picture of their screen, and what the page knew about where
// they were. Each kind of thing is tidied, and anything else dropped.
const REPORT_PICTURE_MAX = 3 * 1024 * 1024;
// Kept: the newest this many, and from one folder, this many an hour.
const REPORTS_KEPT = 200;
const REPORTS_AN_HOUR = 6;
// Ideas kept at most (the oldest go), and how many of a player's the page sees.
const WISHES_KEPT = 1000;
const WISHES_SHOWN = 20;
const isReportId = (v) => typeof v === 'string' && /^\d{13}-[0-9a-f]{8}$/.test(v);
const shortText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max) : '');

// The visitors' log keeps this many devices, the latest; what a page says of
// itself as it comes by (see KeeperClient's visitAbout) is tidied the same way.
const VISITORS_KEPT = 500;
export function cleanVisit(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  return { page: shortText(a.page, 200), agent: shortText(a.agent, 300), screen: shortText(a.screen, 40), touch: a.touch === true, language: shortText(a.language, 20) };
}

// An idea (or a problem told of, kind 'bug') as its sender's page sees it:
// never who sent it, nor the issue.
const wishForPage = (w) => ({ id: w.id, at: w.at, kind: w.kind === 'bug' ? 'bug' : 'idea', ...(w.picture ? { picture: true } : {}), text: w.text, state: w.state, by: w.by, reply: w.reply, answeredAt: w.answeredAt, score: w.score ?? null, stage: w.stage ?? '', stageAt: w.stageAt ?? 0 });

export function cleanReport(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = shortText(raw.text, REPORT_TEXT_MAX);
  const picture = typeof raw.picture === 'string' ? /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw.picture)?.[1] : null;
  const bytes = picture ? Buffer.from(picture, 'base64') : null;
  // A JPEG starts FF D8 FF.
  const jpeg = bytes && bytes.length <= REPORT_PICTURE_MAX && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;
  if (!text && !jpeg) return null;
  const a = raw.about && typeof raw.about === 'object' ? raw.about : {};
  const island = a.island && typeof a.island === 'object' ? a.island : null;
  const about = {
    name: shortText(a.name, 40),
    page: shortText(a.page, 200),
    agent: shortText(a.agent, 300),
    screen: shortText(a.screen, 40),
    layout: shortText(a.layout, 300),
    touch: a.touch === true,
    where: shortText(a.where, 40),
    // Where the picture came from: the screen as it was, or one the player
    // picked from their device (a phone's gallery, say).
    picture: jpeg ? (a.picture === 'chosen' ? 'chosen' : 'screen') : '',
    island: island
      ? {
          name: shortText(island.name, 60),
          code: isValidCode(island.code) ? island.code : '',
          kind: shortText(island.kind, 20),
          theme: shortText(island.theme, 20),
          players: Number.isInteger(island.players) ? Math.max(0, Math.min(island.players, 999)) : 0,
          host: island.host === true,
          online: shortText(island.online, 20),
        }
      : null,
    errors: (Array.isArray(a.errors) ? a.errors : []).slice(-10).map((e) => shortText(e, 500)).filter(Boolean),
  };
  return { text, picture: jpeg, about };
}

// ---------------------------------------------------------------- signaling

// A PeerJS client for one fixed id, speaking the PeerServer protocol over
// WebSocket: register, keep the socket alive, pass OFFER/ANSWER/CANDIDATE
// messages on. A dropped socket comes back with the same token, which moves
// the session over; PeerServer then sends no OPEN, so an open socket that
// hears no refusal for a moment counts as registered. After the computer
// sleeps, the socket can look open long after the server dropped it, so a
// heartbeat that comes late starts a new one. The AI friend (buddy.js) has
// one too, under a random id, to dial the islands it visits.
export class Signaling extends EventEmitter {
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
        case 'ANSWER':
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

// Hosts of open islands keep theirs open, to stay on the list of open
// islands, and so does every page of a player with a login while it is on
// screen, to be invited.
const MAX_CONNECTIONS = 128;
const CONNECT_TIMEOUT_MS = 30000;
const IDLE_MS = 3 * 60000;
const RECENT = 40;
// Changes to the ranking that come together go to the pages watching it
// together, this long after the first.
const RANKING_NEWS_MS = 1000;
// A video on air comes off this long after its station (the admin page) last said it is there.
const TV_STATION_MS = 30000;
// Invitations: one to the same player every so often, and a few a minute.
const INVITE_AGAIN_MS = 15000;
const INVITES_PER_MINUTE = 10;

// A player's id on the players list: not the folder their copies are filed
// in, which is half of what lets a device in as them.
export const friendId = (player) => createHash('sha256').update(`kids-world friend ${player}`).digest('hex').slice(0, 20);

export class Keeper extends EventEmitter {
  // identity: from loadIdentity(). signal: a PeerServer URL, or null for the PeerJS cloud.
  constructor({ store, identity, signal = null, iceServers = ICE_SERVERS, now = () => Date.now(), log = (...args) => console.error(...args), rankingNewsMs = RANKING_NEWS_MS }) {
    super();
    this.store = store;
    this.identity = identity;
    this.server = signalOptions(signal);
    this.iceServers = iceServers;
    this.now = now;
    this.log = log;
    this.conns = new Map();
    this.recent = [];
    // Kinds of message pages sent that this keeper does not know (see unknown()).
    this.unknownKinds = new Set();
    this.since = 0;
    this.rtc = null;
    this.signaling = null;
    this.newsTimer = null;
    this.rankingNewsMs = rankingNewsMs;
    // Who invited whom when, for the limits on invitations.
    this.invited = new Map();
    // The AI friend (see buddy.js), on the players list to invite, if any.
    this.buddy = null;
    // Islands this process hosts peer to peer (host.js), on the list of open
    // islands too: code → () => its listing, or null while it is not.
    this.hosted = new Map();
    // What is on every TV (shared/broadcast.js), put there from the admin
    // page, or null; since when, and when the admin page that is its TV
    // station last said it is still there (see tvAlive).
    this.tv = null;
    this.tvSince = 0;
    this.tvSeen = 0;
    // Who is on air from a broadcast station (shared/station.js), on every
    // TV in the game: { conn, name, station, since } of the page that is its
    // TV station, or null.
    this.onAir = null;
    // Screen time (shared/lock.js): every player locked, from the admin
    // page, or null. Kept in the data folder, so a restart keeps it.
    this.lock = this.readLock();
    // How long players are warned before it locks.
    this.lockWarningMs = LOCK_WARNING_MS;
    this.storeChanged = () => this.rankingChanged();
    store.on('change', this.storeChanged);
  }

  // The private key, to sign with. start() does this first; tests that talk
  // to receive() directly, without WebRTC, call only this.
  async loadKey() {
    this.privateKey ??= await webcrypto.subtle.importKey('jwk', this.identity.privateKey, KEY_ALGORITHM, false, ['sign']);
  }

  async start() {
    await this.loadKey();
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
      islands: this.openIslands().length,
      online: this.onlinePlayers().size,
      recent: this.recent,
      tv: this.tv ? { ...this.tv, since: this.tvSince } : null,
      onAir: this.onAir ? { name: this.onAir.name, station: this.onAir.station, since: this.onAir.since } : null,
      lock: this.lock,
      // The pages that cover the game as it locks.
      lockable: [...this.conns.values()].filter((c) => c.lock && c.folder && !c.closed).length,
    };
  }

  // ------------------------------------------------ screen time

  get lockFile() {
    return join(this.store.dir, 'lock.json');
  }

  readLock() {
    try {
      return cleanLock(JSON.parse(readFileSync(this.lockFile, 'utf8')));
    } catch {
      return null;
    }
  }

  // Every player locked (on), after a minute's warning, or unlocked (a lock
  // still counting down is called off): the pages connected now hear at
  // once, and the others when they connect. Returns the lock.
  async setLock(on) {
    if (Boolean(on) !== Boolean(this.lock)) {
      const now = this.now();
      this.lock = on ? { since: now, at: now + this.lockWarningMs } : null;
      if (this.lock) await writeFile(this.lockFile, JSON.stringify(this.lock));
      else await rm(this.lockFile, { force: true });
      this.log(this.lock ? `Screen time: every player is locked in ${Math.round(this.lockWarningMs / 1000)} s.` : 'Screen time: every player is unlocked.');
      for (const conn of this.conns.values()) if (conn.lock && conn.folder && !conn.closed) this.reply(conn, { t: 'lock-news', lock: this.lockNow() });
    }
    return this.lock;
  }

  lockNow() {
    return lockNews(this.lock, this.now());
  }

  // ------------------------------------------------ TV broadcasts

  // Something on every TV (shared/broadcast.js), or nothing (null): the
  // pages connected now hear at once, and the others when they connect.
  // Returns what is on air.
  setTv(raw) {
    const tv = raw == null ? null : cleanBroadcast(raw);
    if (raw != null && !tv) throw new KeepError('bad', 'That is not something to put on TV.');
    this.tv = tv;
    this.tvSince = this.tvSeen = this.now();
    for (const conn of this.conns.values()) if (conn.tv && conn.folder && !conn.closed) this.reply(conn, { t: 'tv-news', tv: this.tvNow() });
    return tv;
  }

  // The admin page playing a video for every TV is still there. A video
  // whose station has not said so for a while comes off air (the page was
  // closed); a YouTube video needs no station.
  tvAlive() {
    if (!this.tv) return false;
    this.tvSeen = this.now();
    return true;
  }

  // Someone on air from a broadcast station now (or nobody: null): every
  // page that knows of them hears at once, and the others when they connect.
  setOnAir(onAir) {
    const same = sameOnAir(onAir, this.onAirNow());
    // (The same show from a page connected again: only its connection is new.)
    this.onAir = onAir;
    if (same) return;
    const news = { t: 'onair-news', onAir: this.onAirNow() };
    for (const conn of this.conns.values()) if (conn.onAir && conn.folder && !conn.closed) this.reply(conn, news);
  }

  onAirNow() {
    return this.onAir ? { name: this.onAir.name, station: this.onAir.station } : null;
  }

  // A page going live at a broadcast station, as the TV station under the
  // peer id it gives, or off air (off): one at a time, so while someone
  // else is on, the answer is who (on: false).
  goLive(conn, msg) {
    if (msg.off === true) {
      if (this.onAir?.conn === conn) this.setOnAir(null);
      return { on: false };
    }
    const want = cleanOnAir(msg);
    if (!want) throw new KeepError('bad', 'That is not a TV station.');
    if (this.onAir && this.onAir.conn !== conn && !this.onAir.conn.closed) return { on: false };
    this.setOnAir({ conn, ...want, since: this.now() });
    return { on: true };
  }

  // What is on air, for a page: with how long it has been, to be at the same place.
  tvNow() {
    return this.tv ? { ...this.tv, at: this.now() - this.tvSince } : null;
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
      this.learnAddress(conn, candidateAddress(c.candidate));
      try {
        conn.pc.addRemoteCandidate(c.candidate, typeof c.sdpMid === 'string' ? c.sdpMid : '0');
      } catch {
        // a candidate it cannot use
      }
    } else if (msg.type === 'LEAVE' || msg.type === 'EXPIRE') {
      for (const conn of this.conns.values()) if (conn.peer === msg.src && !conn.dc) this.drop(conn);
    }
  }

  // A page's connection: who it is once it says so (see from()), and its limits.
  connection(fields) {
    const now = this.now();
    return { dc: null, hello: false, device: null, player: null, token: null, folder: null, pieces: new Reassembler(MAX_PARTS, 2), started: now, lastSeen: now, tokens: 20, busy: false, closed: false, watching: false, rankingSent: '', island: null, online: false, ...fields };
  }

  answer(peer, id, sdp) {
    const pc = new this.rtc.PeerConnection(id, { iceServers: this.iceServers });
    const conn = this.connection({ id, peer, pc });
    this.conns.set(id, conn);
    pc.onLocalDescription((text, type) => this.signaling.send({ type: 'ANSWER', dst: peer, payload: { sdp: { type, sdp: text }, type: 'data', connectionId: id } }));
    pc.onLocalCandidate((candidate, mid) => this.signaling.send({ type: 'CANDIDATE', dst: peer, payload: { candidate: { candidate, sdpMid: mid, sdpMLineIndex: 0 }, type: 'data', connectionId: id } }));
    pc.onStateChange((state) => {
      if (state === 'failed' || state === 'closed') this.drop(conn);
      else if (state === 'connected') this.learnAddress(conn, this.pairOf(conn));
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
    this.replyText(conn, JSON.stringify(msg));
  }

  replyText(conn, text) {
    if (conn.closed || !conn.dc?.isOpen()) return;
    try {
      sendText({ send: (piece) => conn.dc.sendMessage(piece) }, text);
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
      await this.hello(conn, msg);
      return;
    }
    if (conn.busy) {
      this.reply(conn, { t: 'error', code: 'busy', text: 'One thing at a time.' });
      return;
    }
    conn.busy = true;
    try {
      await this.handle(conn, msg);
    } catch (error) {
      if (error instanceof KeepError) this.reply(conn, { t: 'error', code: error.code, text: error.message, ...error.extra });
      else {
        this.log(error);
        this.reply(conn, { t: 'error', code: 'oops', text: 'The keeper could not do that.' });
      }
    } finally {
      conn.busy = false;
    }
  }

  // The page's hello: it gets a signature over its nonce. A page of version 1
  // said who it is right here; one of version 2 says so once it has checked
  // the signature (see 'me').
  async hello(conn, msg) {
    const v = msg.v === OLDEST_VERSION ? OLDEST_VERSION : KEEPER_VERSION;
    if (msg.t !== 'hello' || !isNonce(msg.nonce) || (v === OLDEST_VERSION && !isDeviceKey(msg.device))) {
      this.drop(conn);
      return;
    }
    if (msg.v !== v) {
      this.reply(conn, { t: 'error', code: 'version', text: 'This keeper speaks a different version.' });
      return;
    }
    conn.hello = true;
    if (v === OLDEST_VERSION) this.from(conn, msg.device);
    const sig = await webcrypto.subtle.sign(SIGN_ALGORITHM, this.privateKey, challenge(this.identity.peer, msg.nonce, v));
    this.reply(conn, { t: 'hello', v, sig: toBase64Url(sig) });
  }

  // Where this connection's copies go: its device's folder, or the folder of
  // the player it is logged in to (with the token that let it in).
  from(conn, device, player = null, token = null) {
    conn.device = device;
    conn.player = player;
    conn.token = token;
    conn.folder = player ?? KeeperStore.deviceId(device);
    this.learnAddress(conn, this.pairOf(conn));
    this.noteAddress(conn);
  }

  pairOf(conn) {
    try {
      return pairAddress(conn.pc?.getSelectedCandidatePair?.());
    } catch {
      return null;
    }
  }

  // A better idea of where this connection's page is than it had: the
  // best address of all, and the best IPv4 one, for when that is IPv6.
  learnAddress(conn, address) {
    if (!address) return;
    let better = false;
    if (address.rank > (conn.address?.rank ?? 0)) {
      conn.address = address;
      better = true;
    }
    if (isIP(address.ip) === 4 && address.rank > (conn.address4?.rank ?? 0)) {
      conn.address4 = address;
      better = true;
    }
    if (better) this.noteAddress(conn);
  }

  // Where this connection's page is, for the admin page, once both are known:
  // for its folder, and for the device's own copies from before it logged in
  // (which show as a player with no login until they are moved).
  noteAddress(conn) {
    if (!conn.folder || !conn.address) return;
    const own = isDeviceKey(conn.device) ? KeeperStore.deviceId(conn.device) : conn.folder;
    for (const device of new Set([conn.folder, own])) this.store.noteAddress(device, conn.address.ip, conn.address4?.ip).catch((error) => this.log(error));
  }

  async handle(conn, msg) {
    if (!conn.folder) {
      // Who the page is, now that it knows who the keeper is.
      if (msg.t !== 'me' || !isDeviceKey(msg.device)) {
        this.drop(conn);
        return;
      }
      const { player, token } = msg.login && typeof msg.login === 'object' ? msg.login : {};
      const ok = Boolean(player) && (await this.store.checkSession(player, token));
      this.from(conn, msg.device, ok ? player : null, ok ? token : null);
      const login = ok ? await this.store.readLogin(player) : null;
      const needsPassword = ok && login?.kind !== 'password';
      // A page that knows TV broadcasts hears what is on, now and as it changes.
      conn.tv = msg.tv === true;
      // And one that knows broadcast stations, who is on air from one.
      conn.onAir = msg.onair === true;
      // And one that knows screen time, whether it is locked.
      conn.lock = msg.lock === true;
      this.reply(conn, {
        t: 'me',
        ...(ok ? { player, username: login?.username ?? '' } : {}),
        ...(needsPassword ? { needsPassword } : {}),
        ...(conn.tv ? { tv: this.tvNow() } : {}),
        ...(conn.onAir ? { onAir: this.onAirNow() } : {}),
        ...(conn.lock ? { lock: this.lockNow() } : {}),
      });
      return;
    }
    const mine = (what) => {
      if (!conn.player) throw new KeepError('bad', `Log in to ${what}.`);
      return conn.player;
    };
    // A page still open from when logins had secret pictures.
    if ((msg.t === 'login' || msg.t === 'make-login') && msg.secret !== undefined && msg.password === undefined) {
      throw new KeepError('old', 'Reload the page: logins take a password now.');
    }
    switch (msg.t) {
      // Copies only from a page logged in: nothing is kept of the others.
      case 'island': {
        mine('keep islands');
        const { device, savedAt, name, player, stale } = await this.store.keepIslandIn(conn.folder, msg.id, msg.save, { newerOnly: Boolean(conn.player) });
        this.reply(conn, { t: 'kept', what: 'island', id: msg.id, savedAt, ...(stale ? { stale } : {}) });
        if (!stale) this.note({ device, what: 'island', id: msg.id, island: name, player });
        break;
      }
      case 'profile': {
        mine('keep what you have');
        const { device, player, onlyStats } = await this.store.keepProfileIn(conn.folder, msg.profile);
        this.reply(conn, { t: 'kept', what: 'profile' });
        // Not every few seconds while a player with a login plays.
        if (!onlyStats) this.note({ device, what: 'profile', player });
        break;
      }
      case 'adventure': {
        // The isle's own world of you (the shared isle is a world of its
        // own), kept beside your profile the same way.
        mine('keep what you have');
        const { device, player, onlyStats } = await this.store.keepAdventureIn(conn.folder, msg.profile);
        this.reply(conn, { t: 'kept', what: 'adventure' });
        if (!onlyStats) this.note({ device, what: 'adventure', player });
        break;
      }
      case 'visit': {
        // A page with no login came by, once: for the visitors' log, and
        // nothing more. (Logged in, it is a player, on the players list.)
        if (!conn.player) {
          await this.store.noteVisit(conn.folder, msg.about);
          this.note({ device: conn.folder, what: 'visit', player: '' });
        }
        this.reply(conn, { t: 'kept', what: 'visit' });
        break;
      }
      case 'login': {
        // Pages from before usernames send the made-up name.
        const { player, token, username, profile } = await this.store.login(msg.username ?? msg.name, msg.password);
        this.from(conn, conn.device, player, token);
        this.reply(conn, { t: 'login', player, token, username, profile });
        this.note({ device: player, what: 'login', player: profile?.name ?? '', username });
        break;
      }
      case 'make-login': {
        // A new password for the player it is logged in to, or a login for this device's folder.
        const username = conn.player || typeof msg.username !== 'string' ? null : msg.username;
        const made = await this.store.makeLogin(conn.folder, msg.password, conn.player ? null : msg.profile, { session: !conn.player, username });
        if (made.token) this.from(conn, conn.device, made.player, made.token);
        this.reply(conn, { t: 'login', player: made.player, username: made.username, ...(made.token ? { token: made.token } : {}) });
        const record = await this.store.list(made.player);
        this.note({ device: made.player, what: made.token ? 'made-login' : 'new-password', player: record.profile?.name ?? '', username: made.username });
        break;
      }
      case 'adopt': {
        // What this device sent before it logged in, for the player it logged
        // in as: the device's key (in 'me') and the player's token prove both.
        if (!(await this.store.checkSession(msg.player, msg.token))) throw new KeepError('gone', 'That login is gone.');
        const device = KeeperStore.deviceId(conn.device);
        const islands = device === msg.player ? 0 : await this.store.adoptDevice(device, msg.player);
        this.reply(conn, { t: 'kept', what: 'adopt', islands });
        const record = await this.store.list(msg.player);
        this.note({ device: msg.player, what: 'adopt', islands, player: record.profile?.name ?? '' });
        break;
      }
      case 'logout':
        if (conn.player) await this.store.logout(conn.player, conn.token);
        this.from(conn, conn.device);
        this.reply(conn, { t: 'kept', what: 'logout' });
        break;
      case 'list':
        this.reply(conn, { t: 'list', ...(await this.store.list(mine('see your islands'))) });
        break;
      case 'fetch': {
        const text = isIslandId(msg.id) ? await this.store.islandText(mine('fetch islands'), msg.id) : null;
        if (!text) throw new KeepError('missing', 'The keeper has no such island.');
        // The copy as kept, without reading it back into objects.
        this.replyText(conn, `{"t":"island","id":${JSON.stringify(msg.id)},"save":${text}}`);
        break;
      }
      case 'forget':
        await this.store.forgetIsland(mine('say goodbye to islands'), msg.id, msg.at);
        this.reply(conn, { t: 'kept', what: 'forget', id: msg.id });
        break;
      case 'ranking': {
        // watch: and news of every change from now on (see rankingChanged),
        // until 'unwatch' or the page goes. world: the isle's own boards.
        const world = msg.world === 'isle' ? 'isle' : 'home';
        if (msg.watch === true) conn.watching = world === 'isle' ? 'isle' : true;
        this.sendRanking(conn, await this.store.ranking(conn.player, world));
        break;
      }
      case 'unwatch':
        conn.watching = false;
        this.reply(conn, { t: 'kept', what: 'unwatch' });
        break;
      case 'ranked': {
        const on = msg.on !== false;
        await this.store.setRanked(mine('be in the ranking'), on);
        this.reply(conn, { t: 'kept', what: 'ranked', on });
        break;
      }
      case 'open-island': {
        // On the list of open islands for as long as this connection lasts.
        // One island a connection; the newest word about a code wins.
        const island = cleanListing(msg.island);
        if (!island) throw new KeepError('bad', 'That is not an island to list.');
        // Only an island of the keeper's own computer is one to come to
        // without logging in (the CTB island): never a page's.
        delete island.watch;
        for (const other of this.conns.values()) if (other !== conn && other.island?.code === island.code) other.island = null;
        conn.island = island;
        this.reply(conn, { t: 'kept', what: 'open-island', code: island.code });
        break;
      }
      case 'close-island':
        conn.island = null;
        this.reply(conn, { t: 'kept', what: 'close-island' });
        break;
      case 'islands':
        this.reply(conn, { t: 'islands', islands: this.openIslands() });
        break;
      case 'onair':
        // Going live at a broadcast station (shared/station.js), or off air.
        this.reply(conn, { t: 'onair', ...this.goLive(conn, msg), onAir: this.onAirNow() });
        break;
      case 'online':
        // A logged-in page on screen: playing right now, for as long as
        // this connection lasts, so others can invite them.
        mine('be on the players list');
        conn.online = msg.on !== false;
        this.reply(conn, { t: 'kept', what: 'online', on: conn.online });
        break;
      case 'players':
        this.reply(conn, { t: 'players', ...(await this.playersFor(mine('see the players'))) });
        break;
      case 'findable': {
        const on = msg.on !== false;
        await this.store.setFindable(mine('be on the players list'), on);
        this.reply(conn, { t: 'kept', what: 'findable', on });
        break;
      }
      case 'invite':
        await this.invite(conn, mine('invite players'), msg);
        this.reply(conn, { t: 'kept', what: 'invite', to: msg.to });
        break;
      case 'report': {
        // A problem a player told of, with a picture of their screen: logged
        // in, so the grown-ups know who to thank and to ask.
        const who = await this.needIsleLevel(mine('tell of a problem'), 'tell of a problem');
        const { id, player } = await this.store.keepReport(conn.folder, msg.report);
        this.reply(conn, { t: 'kept', what: 'report', id });
        this.note({ device: conn.folder, what: 'report', player });
        // Read by CTB's workers too, as an idea is (its picture described
        // to them in words).
        const bug = await this.store.keepBug(who, id).catch(() => null);
        if (bug) this.emit('wish', bug);
        break;
      }
      case 'wish': {
        // An idea for the game, for CTB's workers to read and answer.
        const wish = await this.store.keepWish(await this.needIsleLevel(mine('send an idea'), 'send an idea'), msg.text);
        this.reply(conn, { t: 'kept', what: 'wish', wish: wishForPage(wish) });
        this.note({ device: conn.player, what: 'wish', player: wish.name });
        this.emit('wish', wish);
        break;
      }
      case 'wishes':
        this.reply(conn, { t: 'wishes', wishes: (await this.store.wishesOf(mine('see your ideas'))).map(wishForPage) });
        break;
      case 'bye':
        this.drop(conn);
        break;
      default:
        this.unknown(msg.t);
        throw new KeepError('bad', 'The keeper does not know that message.');
    }
  }

  // A worker's answer to an idea: kept, and told to the pages of the player
  // who sent it that are open now. The idea as kept, or null.
  async answerWish(id, answer) {
    const wish = await this.store.answerWish(id, answer);
    if (wish) this.tellWish(wish);
    return wish;
  }

  // News of where an accepted idea has got to, kept and told the same way.
  // The idea as kept, or null when that was its stage already.
  async stageWish(id, stage) {
    const wish = await this.store.stageWish(id, stage);
    if (wish) this.tellWish(wish);
    return wish;
  }

  tellWish(wish) {
    for (const page of this.conns.values()) if (page.player === wish.player && !page.closed) this.reply(page, { t: 'wish-news', wish: wishForPage(wish) });
  }

  // The players with a login who are playing right now: their pages are
  // connected and on screen.
  onlinePlayers() {
    return new Set([...this.conns.values()].filter((c) => c.online && c.player && !c.closed).map((c) => c.player));
  }

  // The players list, for this player: everyone else with a login who is on
  // it, who is playing now first, and whether this player is on it.
  //   → { players: [{ id, name, look, online }], shown }
  async playersFor(me) {
    const all = await this.store.players();
    const online = this.onlinePlayers();
    const players = all
      .filter((p) => p.id !== me && p.findable && p.profile?.name)
      .map((p) => ({ id: friendId(p.id), name: p.profile.name, look: p.profile.look, online: online.has(p.id) }));
    // The AI friend, when this computer runs one: playing now while it can come.
    if (this.buddy) players.push(this.buddy.listing());
    return { players: sortPlayers(players), shown: all.find((p) => p.id === me)?.findable ?? true };
  }

  // The player, once they are at TELL_US_LEVEL on Adventure Isle: ideas and
  // problems come from players who have played a while.
  async needIsleLevel(player, what) {
    const level = await this.store.isleLevel(player);
    if (level < TELL_US_LEVEL) throw new KeepError('level', `Reach level ${TELL_US_LEVEL} on Adventure Isle to ${what}.`, { level, need: TELL_US_LEVEL });
    return player;
  }

  // An invitation from player `me` to their island, for the pages of the
  // player it is for that are open right now. It says who it is from by
  // what the keeper has of them, never by what the page claims.
  async invite(conn, me, msg) {
    const island = cleanInvite(msg.island);
    if (!island || !isFriendId(msg.to)) throw new KeepError('bad', 'That is not an invitation.');
    const now = this.now();
    const sent = (this.invited.get(me) ?? []).filter((s) => now - s.at < 60000);
    if (sent.length >= INVITES_PER_MINUTE || sent.some((s) => s.to === msg.to && now - s.at < INVITE_AGAIN_MS)) {
      throw new KeepError('wait', 'Wait a little before inviting again.');
    }
    const all = await this.store.players();
    const from = all.find((p) => p.id === me)?.profile;
    if (this.buddy && msg.to === this.buddy.id) {
      if (!from?.name) throw new KeepError('bad', 'Pick a display name first.');
      // It says itself why it cannot come, or comes.
      const busy = this.buddy.invited(island, from.name);
      if (busy) throw new KeepError(this.buddy.ready ? 'friend-busy' : 'away', busy);
      sent.push({ to: msg.to, at: now });
      this.invited.set(me, sent);
      this.note({ device: me, what: 'invite', player: from.name, to: this.buddy.name, island: island.name });
      return;
    }
    const them = all.find((p) => p.findable && p.id !== me && friendId(p.id) === msg.to);
    const pages = them ? [...this.conns.values()].filter((c) => c.online && c.player === them.id && !c.closed) : [];
    if (!pages.length) throw new KeepError('away', 'They are not playing right now.');
    if (!from?.name) throw new KeepError('bad', 'Pick a display name first.');
    sent.push({ to: msg.to, at: now });
    this.invited.set(me, sent);
    for (const page of pages) this.reply(page, { t: 'invite-news', from: { id: friendId(me), name: from.name, look: from.look }, island });
    this.note({ device: me, what: 'invite', player: from.name, to: them.profile?.name ?? '', island: island.name });
  }

  // The list of open islands: those whose hosts' pages are connected and
  // said so, and those this process hosts.
  openIslands() {
    const pages = [...this.conns.values()].filter((c) => c.island && !c.closed && !this.hosted.has(c.island.code)).map((c) => c.island);
    const ours = [...this.hosted.values()].map((listing) => cleanListing(listing())).filter(Boolean);
    return sortListings([...pages, ...ours]);
  }

  // An island this process hosts, on the list of open islands while listing() gives it.
  listIsland(code, listing) {
    this.hosted.set(code, listing);
  }

  unlistIsland(code) {
    this.hosted.delete(code);
  }

  // The ranking, as an answer, or as news for a page watching it: news only
  // when it looks different to that page from what it was sent last.
  sendRanking(conn, ranking, news = false) {
    const text = JSON.stringify(ranking);
    if (news && text === conn.rankingSent) return;
    conn.rankingSent = text;
    this.reply(conn, { t: news ? 'ranking-news' : 'ranking', ...ranking });
  }

  // Something the ranking is made of changed (the store said so): once the
  // changes that come with it are in too, every page watching it hears.
  rankingChanged() {
    if (this.newsTimer || ![...this.conns.values()].some((c) => c.watching)) return;
    this.newsTimer = setTimeout(() => {
      this.newsTimer = null;
      this.sendRankingNews().catch((error) => this.log(error));
    }, this.rankingNewsMs);
    this.newsTimer.unref?.();
  }

  async sendRankingNews() {
    const watching = [...this.conns.values()].filter((c) => c.watching);
    if (!watching.length) return;
    // Both worlds' players, each read once however many pages watch them.
    const read = new Map();
    const playersOf = async (world) => {
      if (!read.has(world)) read.set(world, await this.store.players(world));
      return read.get(world);
    };
    for (const conn of watching) {
      if (conn.closed) continue;
      const world = conn.watching === 'isle' ? 'isle' : 'home';
      this.sendRanking(conn, KeeperStore.rankingOf(await playersOf(world), conn.player, world), true);
    }
  }

  // A page asked for something this keeper does not know: most likely the
  // game was updated and this keeper was not (it runs the code of the folder
  // it was started from). Says so where whoever runs it looks, once for each
  // kind of message.
  unknown(t) {
    if (typeof t !== 'string' || !/^[a-z-]{1,24}$/.test(t) || this.unknownKinds.has(t) || this.unknownKinds.size >= 20) return;
    this.unknownKinds.add(t);
    this.log(`keeper: a page asked for "${t}", which this keeper does not know: the game is newer than it. Update it with git pull, then restart npm start.`);
  }

  note(event) {
    this.recent.unshift({ at: this.now(), ...event });
    this.recent.length = Math.min(this.recent.length, RECENT);
    this.emit('kept', event);
  }

  sweep() {
    const now = this.now();
    if (this.tv?.kind === 'video' && now - this.tvSeen > TV_STATION_MS) this.setTv(null);
    for (const [me, sent] of this.invited) if (!sent.some((x) => now - x.at < 60000)) this.invited.delete(me);
    for (const conn of [...this.conns.values()]) {
      if ((!conn.dc?.isOpen() && now - conn.started > CONNECT_TIMEOUT_MS) || now - conn.lastSeen > IDLE_MS) this.drop(conn);
    }
  }

  drop(conn) {
    if (conn.closed) return;
    conn.closed = true;
    this.conns.delete(conn.id);
    // Its page was the TV station of whoever is on air: off air.
    if (this.onAir?.conn === conn) this.setOnAir(null);
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
    clearTimeout(this.newsTimer);
    this.store.off('change', this.storeChanged);
    this.signaling?.stop();
    for (const conn of [...this.conns.values()]) this.drop(conn);
    await new Promise((done) => setImmediate(done));
    await this.store.queue;
  }
}

