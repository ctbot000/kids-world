// A hosted island: the world and everything around it — who is here, their
// reconnect tokens, the animals, the clock and the weather, sprouts growing
// into trees, fruit growing back, and what the island's owner allows.
//
// Transport-agnostic. The host environment (the Node server, a host's
// browser, or solo play) attaches connection objects with send(text) and
// optional close(), hands every decoded message to receive(), and calls
// tick() about ten times a second.

import * as B from './blocks.js';
import { CRITTER_INFO, CritterSim, MAX_CRITTERS, nearestWater, NEEDS_WATER, placeFlyers, placePolar, placeSea, standHeight } from './critters.js';
import { advanceTime, DAY_MODES, isNight, nextWeather, WEATHERS } from './env.js';
import { Rng } from './rng.js';
import { growEdit, validCells } from './tools.js';
import { cellHitsBody, BODY } from './physics.js';
import { World } from './world.js';
import { generate } from './worldgen.js';
import { cleanChat, cleanLook, cleanName, EMOTE_KEYS, isValidIslandName, isValidName, KID, NAME_MAX, PHRASES, randomIslandName, randomName, STICKERS } from './words.js';

export const PROTOCOL = 1;

// A player's name as sent: any name as typed, tidied, or '' for an empty,
// invisible or overlong one. (Two players of one name on an island get a
// number from uniqueName.)
function nameOf(raw) {
  const name = cleanName(raw);
  return isValidName(name) && [...name].length <= NAME_MAX ? name : '';
}
export const MAX_PLAYERS = 8;
export const EDIT_KINDS = ['build', 'pick', 'paint', 'hills', 'stamp', 'undo', 'grow', 'nature'];

const RATE_BURST = 240;
const RATE_PER_SEC = 90;
const CELL_BURST = 16000;
const CELLS_PER_SEC = 4000;
const CRITTER_MS = 200;
const ENV_MS = 5000;
const GROW_MS = [45000, 80000];
const REGROW_MS = [120000, 200000];
const SHELL_MS = 60000;
const STAR_MS = 25000;
const MAX_SHELLS = 16;
const MAX_STARS = 6;
const CHAT_KEEP = 30;
// Talking: a few at once, then about one a second.
const TALK_BURST = 5;
const TALK_PER_SEC = 1;
const KEEP_PLAYERS = 64;

export function randomToken() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function defaultSettings() {
  return { build: 'everyone', locked: false, day: 'cycle' };
}

function cleanSettings(raw, base = defaultSettings()) {
  return {
    build: raw?.build === 'host' || raw?.build === 'everyone' ? raw.build : base.build,
    locked: typeof raw?.locked === 'boolean' ? raw.locked : base.locked,
    day: DAY_MODES.includes(raw?.day) ? raw.day : base.day,
  };
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export class Room {
  // Either { theme, name, seed } for a brand-new island, or { save }.
  constructor({ code = '', theme = 'sunny', name = '', seed = 0, save = null, settings = null, now = () => Date.now(), log = () => {}, random = Math.random } = {}) {
    this.code = code;
    this.now = now;
    this.log = log;
    this.random = random;
    this.clients = new Map();
    this.tokens = new Map();
    this.players = new Map();
    this.kicked = new Set();
    this.chat = [];
    this.nextPid = 1;
    this.host = 0;
    this.reservedHost = 0;
    this.growth = new Map();
    this.regrow = new Map();
    this.counts = { shells: 0, stars: 0 };
    this.encoded = null;
    this.onUpdate = null;
    this.closed = false;
    const t = now();
    this.lastTick = t;
    this.critterSentAt = 0;
    this.envSentAt = t;
    this.shellAt = t + SHELL_MS;
    this.starAt = t + STAR_MS;

    if (save) {
      this.loadSave(save);
    } else {
      const s = seed >>> 0 || Math.floor(random() * 2 ** 31) + 1;
      const islandName = isValidIslandName(name) ? name : randomIslandName(theme, random);
      const made = generate({ seed: s, theme, name: islandName });
      this.world = made.world;
      this.critters = new CritterSim(s ^ 0x5bd1e995);
      for (const c of made.critters) this.critters.add(c.type, c.x, c.y, c.z);
      this.settings = cleanSettings(settings);
      this.env = { time: 0.3, weather: 'clear', left: 240 };
      this.rng = new Rng(s ^ 0x27d4eb2d);
    }
    this.hookWorld();
  }

  // ------------------------------------------------ the world

  hookWorld() {
    const w = this.world;
    this.counts = { shells: 0, stars: 0 };
    this.growth.clear();
    for (let x = 0; x < w.W; x++) {
      for (let z = 0; z < w.D; z++) {
        for (let y = 1; y < w.H; y++) {
          const id = w.blocks[w.index(x, y, z)];
          if (id === B.AIR) continue;
          if (id === B.SHELL) this.counts.shells++;
          else if (id === B.STAR_PIECE) this.counts.stars++;
          else if (B.block(id).grows) this.growth.set(w.index(x, y, z), this.now() + this.between(GROW_MS));
        }
      }
    }
    w.onSet = (x, y, z, before, after) => {
      this.encoded = null;
      const k = w.index(x, y, z);
      if (before === B.SHELL) this.counts.shells--;
      if (after === B.SHELL) this.counts.shells++;
      if (before === B.STAR_PIECE) this.counts.stars--;
      if (after === B.STAR_PIECE) this.counts.stars++;
      if (B.block(after).grows) this.growth.set(k, this.now() + this.between(GROW_MS));
      else if (B.block(before).grows) this.growth.delete(k);
      if (B.FRUIT_ITEMS.includes(before) && after === B.AIR) this.regrow.set(k, { id: before, at: this.now() + this.between(REGROW_MS), x, y, z });
      if (B.FRUIT_ITEMS.includes(after)) this.regrow.delete(k);
    };
  }

  between([lo, hi]) {
    return lo + (hi - lo) * this.random();
  }

  encodedBlocks() {
    this.encoded ??= this.world.encode();
    return this.encoded;
  }

  // ------------------------------------------------ connections

  attach(conn) {
    this.clients.set(conn, { pid: 0, token: '', budget: RATE_BURST, cells: CELL_BURST, talk: TALK_BURST, at: this.now(), talkAt: this.now() });
  }

  detach(conn) {
    const c = this.clients.get(conn);
    if (!c) return;
    this.clients.delete(conn);
    if (c.pid) this.leave(c.pid);
  }

  get online() {
    let n = 0;
    for (const c of this.clients.values()) if (c.pid) n++;
    return n;
  }

  connected(pid) {
    for (const c of this.clients.values()) if (c.pid === pid) return true;
    return false;
  }

  onlinePlayers() {
    return [...this.players.values()].filter((p) => p.online);
  }

  leave(pid) {
    const p = this.players.get(pid);
    if (!p || this.connected(pid)) return;
    p.online = false;
    this.broadcast({ t: 'left', pid });
    if (this.host === pid) this.passHost();
    this.changed();
  }

  passHost() {
    const next = this.onlinePlayers().sort((a, b) => a.id - b.id)[0];
    if (!next) return;
    this.host = next.id;
    this.broadcast({ t: 'host', pid: next.id });
  }

  // ------------------------------------------------ messages

  receive(conn, msg) {
    const c = this.clients.get(conn);
    if (!c || !msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    if (!this.allow(c)) return;
    try {
      if (!c.pid) {
        if (msg.t === 'join') this.join(conn, c, msg);
        else if (msg.t === 'ping') this.sendTo(conn, { t: 'pong' });
      } else {
        this.handle(conn, c, msg);
      }
    } catch (error) {
      this.log(error);
      this.sendTo(conn, { t: 'notice', text: 'Oops, the island got a little muddled. Try that again!' });
    }
  }

  allow(c) {
    const now = this.now();
    const secs = Math.max(0, (now - c.at) / 1000);
    c.budget = Math.min(RATE_BURST, c.budget + secs * RATE_PER_SEC);
    c.cells = Math.min(CELL_BURST, c.cells + secs * CELLS_PER_SEC);
    c.at = now;
    if (c.budget < 1) return false;
    c.budget -= 1;
    return true;
  }

  handle(conn, c, msg) {
    const pid = c.pid;
    const p = this.players.get(pid);
    switch (msg.t) {
      case 'm':
        this.move(conn, p, msg.s);
        break;
      case 'edit':
        this.edit(conn, c, p, msg);
        break;
      case 'say':
        this.say(conn, c, p, msg);
        break;
      case 'emote':
        if (EMOTE_KEYS.includes(msg.e)) this.broadcast({ t: 'emote', pid, e: msg.e });
        break;
      case 'look': {
        // A new look, and a new name with it when one comes (🎨 Change me while here).
        p.look = cleanLook(msg.look, this.random);
        const name = nameOf(msg.name);
        if (name) p.name = this.uniqueName(name, p.id);
        this.broadcast({ t: 'look', pid, look: p.look, name: p.name });
        this.changed();
        break;
      }
      case 'critter':
        this.critterOp(conn, p, msg);
        break;
      case 'host':
        this.hostCommand(conn, p, msg);
        break;
      case 'leave':
        this.clients.delete(conn);
        this.leave(pid);
        conn.close?.();
        break;
      case 'ping':
        this.sendTo(conn, { t: 'pong' });
        break;
      default:
        break;
    }
  }

  join(conn, c, msg) {
    if (msg.protocol !== PROTOCOL) {
      this.sendTo(conn, { t: 'error', code: 'protocol', text: 'This island needs a newer (or older) Kids World. Reload the page and try again.' });
      return;
    }
    let token = typeof msg.token === 'string' ? msg.token : '';
    let p = this.tokens.has(token) ? this.players.get(this.tokens.get(token)) : null;
    if (p && this.kicked.has(p.id)) {
      this.sendTo(conn, { t: 'error', code: 'kicked', text: 'The island owner said goodbye for now.' });
      return;
    }
    if (!p) {
      token = '';
      if (this.settings.locked && this.players.size > 0) {
        this.sendTo(conn, { t: 'error', code: 'locked', text: 'This island is closed to new visitors right now.' });
        return;
      }
      if (this.online >= MAX_PLAYERS) {
        this.sendTo(conn, { t: 'error', code: 'full', text: `This island already has ${MAX_PLAYERS} friends on it. Try again later!` });
        return;
      }
    }
    const look = cleanLook(msg.look, this.random);
    const wanted = nameOf(msg.name) || randomName(this.random);
    if (p) {
      // Coming back: whoever was using this player in another tab is replaced.
      for (const [other, oc] of this.clients) {
        if (oc.pid === p.id && other !== conn) {
          oc.pid = 0;
          this.sendTo(other, { t: 'error', code: 'replaced', text: 'You joined this island from another tab or device.' });
          other.close?.();
        }
      }
      p.online = true;
      p.look = look;
      p.name = this.uniqueName(wanted, p.id);
    } else {
      const spawn = this.world.spawn;
      p = { id: this.nextPid++, name: this.uniqueName(wanted, 0), look, online: true, s: [spawn.x, spawn.y, spawn.z, 0, 0, 0] };
      this.players.set(p.id, p);
      this.prunePlayers();
    }
    if (!token) {
      token = randomToken();
      this.tokens.set(token, p.id);
    }
    if (p.id === this.reservedHost) this.reservedHost = 0;
    if (!this.host || (!this.players.get(this.host)?.online && !this.reservedHost)) this.host = p.id;
    this.broadcast({ t: 'joined', player: this.describePlayer(p) });
    c.pid = p.id;
    c.token = token;
    this.sendWelcome(conn, c);
    this.changed();
  }

  uniqueName(name, self) {
    const taken = new Set([...this.players.values()].filter((q) => q.online && q.id !== self).map((q) => q.name));
    if (!taken.has(name)) return name;
    for (let n = 2; n <= 9; n++) if (!taken.has(`${name} ${n}`)) return `${name} ${n}`;
    return name;
  }

  prunePlayers() {
    if (this.players.size <= KEEP_PLAYERS) return;
    for (const p of this.players.values()) {
      if (this.players.size <= KEEP_PLAYERS) break;
      if (p.online || p.id === this.host || p.id === this.reservedHost) continue;
      this.players.delete(p.id);
      for (const [token, owner] of this.tokens) if (owner === p.id) this.tokens.delete(token);
    }
  }

  describePlayer(p) {
    return { id: p.id, name: p.name, look: p.look, s: p.s };
  }

  sendWelcome(conn, c) {
    this.sendTo(conn, {
      t: 'welcome',
      protocol: PROTOCOL,
      code: this.code,
      you: c.pid,
      token: c.token,
      host: this.host,
      settings: this.settings,
      meta: this.world.meta(),
      blocks: this.encodedBlocks(),
      players: this.onlinePlayers().map((p) => this.describePlayer(p)),
      critters: this.critters.describe(),
      pack: this.critters.pack(),
      env: this.envMessage(),
      chat: this.chat,
    });
  }

  move(conn, p, s) {
    if (!Array.isArray(s) || s.length < 6 || !s.every(finite)) return;
    const w = this.world;
    const x = Math.min(w.W, Math.max(0, s[0]));
    const y = Math.min(w.H + 8, Math.max(0, s[1]));
    const z = Math.min(w.D, Math.max(0, s[2]));
    const state = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +(s[3] % (Math.PI * 2)).toFixed(2), Math.max(0, Math.min(15, s[4] | 0)), s[5] & 0xff];
    p.s = state;
    this.broadcast({ t: 'm', p: p.id, s: state }, conn);
  }

  edit(conn, c, p, msg) {
    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    const cells = validCells(this.world, msg.cells);
    const kind = EDIT_KINDS.includes(msg.kind) ? msg.kind : 'build';
    if (!cells) {
      this.sendTo(conn, { t: 'ack', seq, fix: [] });
      return;
    }
    const n = cells.length / 4;
    const expect = Array.isArray(msg.expect) && msg.expect.length === n ? msg.expect : null;
    const refused = this.settings.build === 'host' && p.id !== this.host;
    if (refused || c.cells < n) {
      this.sendTo(conn, { t: 'ack', seq, fix: this.current(cells) });
      this.notice(conn, refused ? 'The island owner is the only builder right now.' : 'Whoa, slow down a little!');
      return;
    }
    c.cells -= n;
    const others = this.onlinePlayers().filter((q) => q.id !== p.id);
    const applied = [];
    const fix = [];
    for (let i = 0; i < cells.length; i += 4) {
      const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
      const here = this.world.get(x, y, z);
      let ok = !expect || expect[i / 4] === here;
      if (ok && B.SOLID[id] && !B.SOLID[here]) {
        for (const q of others) {
          const body = { x: q.s[0], y: q.s[1], z: q.s[2], radius: BODY.radius, height: BODY.height };
          if (cellHitsBody(x, y, z, body)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        if (here !== id) {
          this.world.set(x, y, z, id);
          applied.push(x, y, z, id);
        }
      } else {
        fix.push(x, y, z, here);
      }
    }
    if (applied.length) this.broadcast({ t: 'edit', by: p.id, seq, kind, cells: applied });
    this.sendTo(conn, { t: 'ack', seq, fix });
    if (applied.length) this.changed();
  }

  current(cells) {
    const out = [];
    for (let i = 0; i < cells.length; i += 4) out.push(cells[i], cells[i + 1], cells[i + 2], this.world.get(cells[i], cells[i + 1], cells[i + 2]));
    return out;
  }

  // A phrase (p), a sticker (e), or something typed (text), tidied.
  say(conn, c, p, msg) {
    let entry = null;
    const text = cleanChat(msg.text);
    if (Number.isInteger(msg.p) && msg.p >= 0 && msg.p < PHRASES.length) entry = { pid: p.id, name: p.name, p: msg.p };
    else if (Number.isInteger(msg.e) && msg.e >= 0 && msg.e < STICKERS.length) entry = { pid: p.id, name: p.name, e: msg.e };
    else if (text) entry = { pid: p.id, name: p.name, text };
    if (!entry) return;
    const now = this.now();
    c.talk = Math.min(TALK_BURST, c.talk + ((now - c.talkAt) / 1000) * TALK_PER_SEC);
    c.talkAt = now;
    if (c.talk < 1) {
      this.notice(conn, 'Whoa, slow down a little!');
      return;
    }
    c.talk -= 1;
    entry.ts = now;
    this.chat.push(entry);
    if (this.chat.length > CHAT_KEEP) this.chat.splice(0, this.chat.length - CHAT_KEEP);
    this.broadcast({ t: 'say', ...entry });
  }

  critterOp(conn, p, msg) {
    const now = this.now();
    const who = { x: p.s[0], y: p.s[1], z: p.s[2] };
    switch (msg.op) {
      case 'pet': {
        const c = this.critters.pet(msg.id, who, now);
        if (c) this.broadcast({ t: 'cfx', id: c.id, fx: 'pet', by: p.id });
        break;
      }
      case 'feed': {
        if (!B.FRUITS.some(([key]) => key === msg.fruit)) return;
        const c = this.critters.feed(msg.id, p.id, who, now);
        if (c) this.broadcast({ t: 'cfx', id: c.id, fx: 'yum', by: p.id, fruit: msg.fruit });
        break;
      }
      case 'invite': {
        if (!CRITTER_INFO[msg.type] || ![msg.x, msg.y, msg.z].every(finite)) return;
        if (this.critters.list.length >= MAX_CRITTERS) {
          this.notice(conn, 'The island is full of animal friends already!', 'info');
          return;
        }
        const w = this.world;
        const x = Math.min(w.W - 0.5, Math.max(0.5, msg.x));
        const z = Math.min(w.D - 0.5, Math.max(0.5, msg.z));
        let at = { x, y: standHeight(w, x, z, msg.y) ?? msg.y, z };
        // Flying friends come in above any water, and fly off from there.
        if (CRITTER_INFO[msg.type].flies) while (at.y < w.H && w.get(Math.floor(x), Math.floor(at.y), Math.floor(z)) === B.WATER) at.y++;
        // Swimmers come in at the nearest water they can live in.
        if (CRITTER_INFO[msg.type].sea === 'water') at = nearestWater(w, msg.type, x, z);
        if (!at) {
          this.notice(conn, NEEDS_WATER[msg.type], 'info');
          return;
        }
        const c = this.critters.add(msg.type, at.x, at.y, at.z);
        if (c) this.broadcast({ t: 'cadd', critter: { id: c.id, type: c.type, name: c.name }, s: this.critters.pack().find((r) => r[0] === c.id), by: p.id });
        this.changed();
        break;
      }
      case 'bye': {
        const c = this.critters.remove(msg.id);
        if (c) this.broadcast({ t: 'cdel', id: c.id, by: p.id });
        this.changed();
        break;
      }
      default:
        break;
    }
  }

  notice(conn, text, level = 'warn') {
    this.sendTo(conn, { t: 'notice', text, level });
  }

  // ------------------------------------------------ owner commands

  hostCommand(conn, p, msg) {
    if (p.id !== this.host) {
      this.notice(conn, 'Only the island owner can do that.');
      return;
    }
    switch (msg.cmd) {
      case 'settings': {
        const before = this.settings.day;
        this.settings = cleanSettings(msg.settings, this.settings);
        this.broadcast({ t: 'settings', settings: this.settings });
        if (before !== this.settings.day) {
          this.env.time = advanceTime(this.env.time, 0, this.settings.day);
          if (this.settings.day === 'cycle' && before !== 'cycle') this.env.time = 0.3;
          this.broadcast(this.envMessage());
        }
        this.changed();
        break;
      }
      case 'kick': {
        const target = this.players.get(msg.pid);
        if (!target || target.id === this.host) return;
        for (const [other, oc] of this.clients) {
          if (oc.pid !== target.id) continue;
          this.sendTo(other, { t: 'error', code: 'kicked', text: 'The island owner said goodbye for now.' });
          oc.pid = 0;
          other.close?.();
        }
        this.kicked.add(target.id);
        for (const [token, owner] of this.tokens) if (owner === target.id) this.tokens.delete(token);
        target.online = false;
        this.broadcast({ t: 'left', pid: target.id, kicked: true });
        this.changed();
        break;
      }
      case 'handover': {
        const target = this.players.get(msg.pid);
        if (!target?.online) return;
        this.host = target.id;
        this.broadcast({ t: 'host', pid: target.id });
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------ time

  envMessage() {
    return { t: 'env', time: +this.env.time.toFixed(5), weather: this.env.weather, mode: this.settings.day };
  }

  tick() {
    if (this.closed) return;
    const now = this.now();
    const dt = Math.min(1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    const env = this.env;
    env.time = advanceTime(env.time, dt, this.settings.day);
    env.left -= dt;
    if (env.left <= 0) {
      const next = nextWeather(env.weather, this.world.theme, () => this.rng.next());
      env.weather = next.weather;
      env.left = next.seconds;
      this.broadcast(this.envMessage());
      this.envSentAt = now;
    } else if (now - this.envSentAt >= ENV_MS) {
      this.broadcast(this.envMessage());
      this.envSentAt = now;
    }

    const where = new Map();
    for (const p of this.players.values()) {
      if (p.online) where.set(p.id, { x: p.s[0], y: p.s[1], z: p.s[2], yaw: p.s[3], anim: p.s[4], flying: (p.s[5] & 1) === 1, hat: p.look?.hat, hair: p.look?.animal === KID ? p.look.hair : '' });
    }
    this.critters.step(this.world, dt, now, where, isNight(env.time));
    if (now - this.critterSentAt >= CRITTER_MS && this.online > 0) {
      this.critterSentAt = now;
      this.broadcast({ t: 'c', c: this.critters.pack() });
    }

    this.grow(now);
    this.nature(now);
  }

  grow(now) {
    const w = this.world;
    for (const [k, at] of [...this.growth]) {
      if (at > now) continue;
      this.growth.delete(k);
      const y = k % w.H;
      const rest = (k - y) / w.H;
      const z = rest % w.D;
      const x = (rest - z) / w.D;
      const cells = growEdit(w, x, y, z, Math.floor(this.rng.next() * 2 ** 31));
      if (!cells.length) continue;
      for (let i = 0; i < cells.length; i += 4) w.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
      this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'grow', cells });
      this.changed();
    }
    for (const [k, r] of [...this.regrow]) {
      if (r.at > now) continue;
      this.regrow.delete(k);
      if (w.get(r.x, r.y, r.z) !== B.AIR) continue;
      const leafy = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ].some(([dx, dy, dz]) => B.TREE_PART[w.get(r.x + dx, r.y + dy, r.z + dz)]);
      if (!leafy) continue;
      w.set(r.x, r.y, r.z, r.id);
      this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'nature', cells: [r.x, r.y, r.z, r.id] });
      this.changed();
    }
  }

  // Seashells wash up on the beach; at night, stars fall.
  nature(now) {
    const w = this.world;
    if (now >= this.shellAt) {
      this.shellAt = now + SHELL_MS;
      if (this.counts.shells < MAX_SHELLS) {
        const spot = this.findSpot((x, h, z) => w.get(x, h, z) === B.SAND && h >= w.sea && h <= w.sea + 1);
        if (spot) this.natureCell(spot, B.SHELL);
      }
    }
    if (now >= this.starAt) {
      this.starAt = now + STAR_MS;
      if (isNight(this.env.time) && this.counts.stars < MAX_STARS && this.rng.chance(0.6)) {
        const spot = this.findSpot((x, h, z) => B.SOLID[w.get(x, h, z)] && h > w.sea && B.TERRAIN[w.get(x, h, z)]);
        if (spot) {
          this.broadcast({ t: 'fx', kind: 'star', x: spot[0] + 0.5, y: spot[1] + 0.5, z: spot[2] + 0.5 });
          this.natureCell(spot, B.STAR_PIECE);
        }
      }
    }
  }

  findSpot(test) {
    const w = this.world;
    for (let tries = 0; tries < 300; tries++) {
      const x = this.rng.int(1, w.W - 2);
      const z = this.rng.int(1, w.D - 2);
      const h = w.top(x, z);
      if (h < 1 || h >= w.H - 1 || w.get(x, h + 1, z) !== B.AIR) continue;
      if (test(x, h, z)) return [x, h + 1, z];
    }
    return null;
  }

  natureCell([x, y, z], id) {
    this.world.set(x, y, z, id);
    this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'nature', cells: [x, y, z, id] });
    this.changed();
  }

  // ------------------------------------------------ output

  changed() {
    this.onUpdate?.();
  }

  broadcast(msg, except = null) {
    const text = JSON.stringify(msg);
    for (const [conn, c] of this.clients) if (c.pid && conn !== except) this.safeSend(conn, text);
  }

  sendTo(conn, msg) {
    this.safeSend(conn, JSON.stringify(msg));
  }

  safeSend(conn, text) {
    try {
      conn.send(text);
    } catch (error) {
      this.log(error);
    }
  }

  // ------------------------------------------------ saving

  exportSave() {
    return {
      app: 'kids-world',
      kind: 'island',
      // 2: made since birds, owls, bees and seagulls came to the islands;
      // 3: since the sea creatures did; 4: since penguins and seals did.
      v: 4,
      code: this.code,
      savedAt: this.now(),
      meta: this.world.meta(),
      blocks: this.encodedBlocks(),
      critters: this.critters.save(),
      env: { time: +this.env.time.toFixed(4), weather: this.env.weather },
      settings: this.settings,
      host: this.host,
      nextPid: this.nextPid,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, look: p.look })),
      tokens: [...this.tokens],
    };
  }

  loadSave(save) {
    if (!save || save.app !== 'kids-world' || save.kind !== 'island') throw new Error('That is not a Kids World island file.');
    this.world = World.decode(save.meta, save.blocks);
    const seed = this.world.seed;
    this.rng = new Rng(seed ^ 0x27d4eb2d ^ (Number(save.savedAt) | 0));
    this.critters = new CritterSim(seed ^ 0x5bd1e995 ^ (Number(save.savedAt) | 0));
    for (const c of Array.isArray(save.critters) ? save.critters.slice(0, MAX_CRITTERS) : []) {
      if (!CRITTER_INFO[c?.type] || ![c.x, c.y, c.z].every(finite)) continue;
      const w = this.world;
      this.critters.add(c.type, Math.min(w.W - 0.5, Math.max(0.5, c.x)), Math.min(w.H, Math.max(1, c.y)), Math.min(w.D - 0.5, Math.max(0.5, c.z)), c.name);
    }
    // Animals that came to the islands since this one was saved move in, once.
    const v = Number(save.v) || 1;
    if (v < 2) for (const f of placeFlyers(this.world, new Rng(seed ^ 0x2545f491))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 3) for (const f of placeSea(this.world, new Rng(seed ^ 0x6b43a9b5))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 4) for (const f of placePolar(this.world, new Rng(seed ^ 0x3c6ef372))) this.critters.add(f.type, f.x, f.y, f.z);
    this.settings = cleanSettings(save.settings);
    const time = finite(save.env?.time) ? ((save.env.time % 1) + 1) % 1 : 0.3;
    this.env = { time, weather: WEATHERS.includes(save.env?.weather) ? save.env.weather : 'clear', left: 180 };
    if (Array.isArray(save.players)) {
      for (const raw of save.players.slice(-KEEP_PLAYERS)) {
        if (!Number.isInteger(raw?.id) || raw.id < 1) continue;
        const spawn = this.world.spawn;
        this.players.set(raw.id, {
          id: raw.id,
          name: isValidName(raw.name) ? raw.name : randomName(this.random),
          look: cleanLook(raw.look, this.random),
          online: false,
          s: [spawn.x, spawn.y, spawn.z, 0, 0, 0],
        });
      }
    }
    const maxId = Math.max(0, ...this.players.keys());
    this.nextPid = Math.max(maxId + 1, Number.isInteger(save.nextPid) ? save.nextPid : 1);
    for (const [token, pid] of Array.isArray(save.tokens) ? save.tokens : []) {
      if (typeof token === 'string' && this.players.has(pid)) this.tokens.set(token, pid);
    }
    if (this.players.has(save.host)) {
      this.host = save.host;
      this.reservedHost = save.host;
    }
  }

  close() {
    this.closed = true;
    for (const conn of this.clients.keys()) {
      try {
        conn.close?.();
      } catch {
        // already gone
      }
    }
    this.clients.clear();
  }
}
