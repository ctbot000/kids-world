// A hosted island: the world and everything around it — who is here, their
// reconnect tokens, the animals, the clock and the weather, sprouts growing
// into trees, fruit growing back, what the island's owner allows, the
// monsters when the owner lets them in (with everyone's hearts), and on an
// adventure island its camps to free (see adventure.js).
//
// Transport-agnostic. The host environment (the Node server, a host's
// browser, or solo play) attaches connection objects with send(text) and
// optional close(), hands every decoded message to receive(), and calls
// tick() about ten times a second.

import { AdventureSim, DIZZY_MS, freeCells, HELP_HEARTS, HELP_REACH } from './adventure.js';
import * as B from './blocks.js';
import { CRITTER_INFO, CritterSim, maxCritters, mountUnder, nearestWater, NEEDS_WATER, needsRoom, placeBig, placeFlyers, placePolar, placeSea, placeVehicles, riderAt, roomFor, standHeight } from './critters.js';
import { advanceTime, DAY_MODES, isNight, nextWeather, WEATHERS } from './env.js';
import { Rng } from './rng.js';
import { growEdit, validCells } from './tools.js';
import { cellHitsBody, BODY } from './physics.js';
import { World } from './world.js';
import { generate, hideGems, palette, SIZES } from './worldgen.js';
import { isPasscode, normalizePasscode } from './listing.js';
import { heartsAfterBump, heartsBack, MAX_HEARTS, MonsterSim, SAFE_MS, STOMP } from './monsters.js';
import { cleanChat, cleanIslandName, cleanLook, cleanName, EMOTE_KEYS, isValidName, KID, NAME_MAX, PHRASES, randomIslandName, randomName, STICKERS } from './words.js';

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
// Wrong passcodes, for the whole island (anyone can try from anywhere): a
// few at once, then one every ten seconds, so four numbers take days to guess.
const GUESS_BURST = 5;
const GUESS_EVERY_MS = 10000;
// Passes the owner gives with invitations: each lets one new visitor in
// without the passcode, within this long.
const PASS_MS = 30 * 60000;
const MAX_PASSES = 16;
// King Grumble's stomp: who it knocks over is worked out this long after he
// lands, so that a jump only just reaching the host still counts; anyone
// in the air within this long of then is missed.
const STOMP_SETTLE_MS = 250;
const AIR_GRACE_MS = 500;

export function randomToken() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function defaultSettings() {
  return { build: 'everyone', locked: false, day: 'cycle', monsters: false };
}

function cleanSettings(raw, base = defaultSettings()) {
  return {
    build: raw?.build === 'host' || raw?.build === 'everyone' ? raw.build : base.build,
    locked: typeof raw?.locked === 'boolean' ? raw.locked : base.locked,
    day: DAY_MODES.includes(raw?.day) ? raw.day : base.day,
    monsters: typeof raw?.monsters === 'boolean' ? raw.monsters : base.monsters,
  };
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export class Room {
  // Either { theme, size, name, seed, adventure } for a brand-new island, or { save }.
  constructor({ code = '', theme = 'sunny', size = 'small', name = '', seed = 0, adventure = false, save = null, settings = null, now = () => Date.now(), log = () => {}, random = Math.random } = {}) {
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
    // The owner's passcode, which new visitors type to come in, or ''.
    this.passcode = '';
    // Invitations' passes, and until when each is good (see givePass).
    this.passes = new Map();
    const t = now();
    this.guesses = { left: GUESS_BURST, at: t };
    this.lastTick = t;
    this.critterSentAt = 0;
    this.envSentAt = t;
    this.shellAt = t + SHELL_MS;
    this.starAt = t + STAR_MS;
    // The camps to free, on an adventure island (adventure.js), and King
    // Grumble's landings still to work out (see stepMonsters).
    this.adventure = null;
    this.advSent = '';
    this.stomps = [];

    if (save) {
      this.loadSave(save);
    } else {
      const s = seed >>> 0 || Math.floor(random() * 2 ** 31) + 1;
      const islandName = cleanIslandName(name) || randomIslandName(theme, random);
      const made = generate({ seed: s, theme, size, name: islandName, adventure });
      this.world = made.world;
      this.critters = new CritterSim(s ^ 0x5bd1e995);
      this.critters.max = maxCritters(this.world);
      for (const c of made.critters) this.critters.add(c.type, c.x, c.y, c.z, null, c.yaw);
      this.settings = cleanSettings(settings);
      this.env = { time: 0.3, weather: 'clear', left: 240 };
      this.rng = new Rng(s ^ 0x27d4eb2d);
      if (made.camps.length) this.adventure = new AdventureSim({ camps: made.camps }, s ^ 0x510e527f);
    }
    // Never saved: an island opened again starts without any.
    this.monsters = new MonsterSim((this.world.seed ^ 0x7f4a7c15 ^ (t | 0)) >>> 0);
    this.monstersSent = false;
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
    this.unride(pid);
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
    this.tellHost();
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
      case 'bop':
        this.bop(p, msg);
        break;
      case 'host':
        this.hostCommand(conn, p, msg);
        break;
      case 'pass':
        this.givePass(conn, c);
        break;
      case 'help':
        this.help(p, msg);
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
      if (this.passcode && this.players.size > 0 && !this.passFits(msg.pass) && !this.passcodeFits(conn, msg.passcode)) return;
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
      p.hearts = MAX_HEARTS;
      p.dizzyUntil = 0;
      p.name = this.uniqueName(wanted, p.id);
    } else {
      const spawn = this.world.spawn;
      p = { id: this.nextPid++, name: this.uniqueName(wanted, 0), look, online: true, s: [spawn.x, spawn.y, spawn.z, 0, 0, 0], hearts: MAX_HEARTS };
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

  // Whether a new visitor typed the island's passcode; if not, they are told
  // why they cannot come in.
  passcodeFits(conn, raw) {
    const typed = normalizePasscode(raw);
    if (!typed) {
      this.sendTo(conn, { t: 'error', code: 'passcode', text: 'This island has a passcode. Ask the island owner for it!' });
      return false;
    }
    const now = this.now();
    const g = this.guesses;
    g.left = Math.min(GUESS_BURST, g.left + (now - g.at) / GUESS_EVERY_MS);
    g.at = now;
    if (g.left < 1) {
      this.sendTo(conn, { t: 'error', code: 'passcode', wait: true, text: 'Lots of wrong passcodes were tried here. Wait a minute, then try again.' });
      return false;
    }
    if (typed === this.passcode) return true;
    g.left -= 1;
    this.sendTo(conn, { t: 'error', code: 'passcode', wrong: true, text: 'That passcode is not right. Ask the island owner for it!' });
    return false;
  }

  // An invitation's pass, used up as it lets its friend in.
  passFits(pass) {
    if (typeof pass !== 'string' || !((this.passes.get(pass) ?? 0) > this.now())) return false;
    this.passes.delete(pass);
    return true;
  }

  // A pass for a friend the owner invites to an island with a passcode, so
  // they come in without it. Only the owner gets one, as only they know the
  // passcode, and nobody but the friend they invited sees it.
  givePass(conn, c) {
    if (c.pid !== this.host) return;
    const now = this.now();
    for (const [pass, until] of this.passes) if (until <= now) this.passes.delete(pass);
    while (this.passes.size >= MAX_PASSES) this.passes.delete(this.passes.keys().next().value);
    const pass = randomToken();
    this.passes.set(pass, now + PASS_MS);
    this.sendTo(conn, { t: 'pass', pass });
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
    return { id: p.id, name: p.name, look: p.look, s: p.s, ...((p.dizzyUntil ?? 0) > this.now() ? { dizzy: true } : {}) };
  }

  sendWelcome(conn, c) {
    this.sendTo(conn, {
      t: 'welcome',
      protocol: PROTOCOL,
      code: this.code,
      you: c.pid,
      token: c.token,
      host: this.host,
      settings: this.publicSettings(),
      // Only the owner hears the passcode itself.
      ...(c.pid === this.host ? { passcode: this.passcode } : {}),
      meta: this.world.meta(),
      blocks: this.encodedBlocks(),
      players: this.onlinePlayers().map((p) => this.describePlayer(p)),
      critters: this.critters.describe(),
      pack: this.critters.pack(),
      monsters: this.monsters.pack(),
      hearts: this.players.get(c.pid)?.hearts ?? MAX_HEARTS,
      env: this.envMessage(),
      chat: this.chat,
      adventure: this.adventure?.describe() ?? null,
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
    // Up in the air (or flying, or swimming), for King Grumble's stomp to miss.
    if (this.adventure) {
      const ground = w.groundBelow(Math.floor(x), Math.floor(y + 0.05), Math.floor(z)) + 1;
      if (state[5] & 1 || y - ground > 0.3) p.airAt = this.now();
    }
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
        // A vehicle is only honked at.
        if (c) this.broadcast({ t: 'cfx', id: c.id, fx: CRITTER_INFO[c.type].vehicle ? 'pet' : 'yum', by: p.id, fruit: msg.fruit });
        break;
      }
      case 'invite': {
        if (!CRITTER_INFO[msg.type] || ![msg.x, msg.y, msg.z].every(finite)) return;
        if (this.critters.list.length >= this.critters.max) {
          this.notice(conn, 'The island is full of animal friends already!', 'info');
          return;
        }
        const w = this.world;
        const x = Math.min(w.W - 0.5, Math.max(0.5, msg.x));
        const z = Math.min(w.D - 0.5, Math.max(0.5, msg.z));
        let at = { x, y: standHeight(w, x, z, msg.y) ?? msg.y, z };
        // Flying friends come in above any water, and fly off from there.
        if (CRITTER_INFO[msg.type].flies) while (at.y < w.H && w.get(Math.floor(x), Math.floor(at.y), Math.floor(z)) === B.WATER) at.y++;
        // Swimmers (and boats) come in at the nearest water they can live
        // in, and big animals and vehicles at the nearest spot with room for
        // them, facing the one who asked for them.
        const info = CRITTER_INFO[msg.type];
        const roomy = info.big || info.vehicle === 'land';
        if (info.sea === 'water') at = nearestWater(w, msg.type, x, z);
        if (roomy) at = roomFor(w, msg.type, x, at.y, z);
        if (!at) {
          this.notice(conn, roomy ? needsRoom(msg.type) : NEEDS_WATER[msg.type], 'info');
          return;
        }
        const c = this.critters.add(msg.type, at.x, at.y, at.z, null, info.vehicle ? Math.atan2(p.s[0] - at.x, p.s[2] - at.z) : null);
        if (c) this.broadcast({ t: 'cadd', critter: { id: c.id, type: c.type, name: c.name }, s: this.critters.pack().find((r) => r[0] === c.id), by: p.id });
        this.changed();
        break;
      }
      case 'bye': {
        const riding = this.critters.get(msg.id);
        if (riding?.rider) {
          this.notice(conn, `Someone is riding ${riding.name}! Wait until they get off.`, 'info');
          return;
        }
        const c = this.critters.remove(msg.id);
        if (c) this.broadcast({ t: 'cdel', id: c.id, by: p.id });
        this.changed();
        break;
      }
      case 'ride': {
        const c = this.critters.get(msg.id);
        const r = c && CRITTER_INFO[c.type].ride;
        if (!r || c.rider === p.id) return;
        if (c.rider) {
          this.notice(conn, `Someone is already riding ${c.name}!`, 'info');
          return;
        }
        // Close enough to climb on (with some room for being a little behind).
        if (Math.hypot(c.x - p.s[0], c.z - p.s[2]) > r.radius + 4 || Math.abs(c.y - p.s[1]) > 5) return;
        this.unride(p.id);
        this.critters.ride(c.id, p.id);
        // Up on its back at once, until they say where they are.
        const at = riderAt(c.type, c);
        p.s = [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2), +c.yaw.toFixed(2), p.s[4], p.s[5]];
        this.broadcast({ t: 'ride', id: c.id, pid: p.id });
        break;
      }
      case 'off':
        this.unride(p.id);
        break;
      case 'trick': {
        // A spout from the whale, a spray from the elephant's trunk, or a honk.
        const c = this.critters.list.find((o) => o.rider === p.id);
        const trick = c && CRITTER_INFO[c.type].ride.trick;
        if (trick === 'spout' || trick === 'spray' || trick === 'honk') this.broadcast({ t: 'cfx', id: c.id, fx: trick, by: p.id });
        break;
      }
      default:
        break;
    }
  }

  // Whatever pid is riding stays where they got off it.
  unride(pid) {
    const p = this.players.get(pid);
    for (const c of this.critters.list) {
      if (c.rider !== pid) continue;
      if (p) Object.assign(c, mountUnder(c.type, { x: p.s[0], y: p.s[1], z: p.s[2], yaw: p.s[3] }));
      this.critters.letGo(c);
      this.broadcast({ t: 'ride', id: c.id, pid: 0 });
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
        this.broadcast({ t: 'settings', settings: this.publicSettings() });
        if (!this.settings.monsters) this.noMonsters();
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
        this.unride(target.id);
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
        this.tellHost();
        break;
      }
      case 'passcode': {
        // Four numbers, or '' for none: anyone can come in again.
        const passcode = msg.passcode === '' ? '' : normalizePasscode(msg.passcode);
        if (msg.passcode !== '' && !passcode) return;
        this.passcode = passcode;
        this.broadcast({ t: 'settings', settings: this.publicSettings() });
        this.tellHost();
        this.changed();
        break;
      }
      default:
        break;
    }
  }

  // The island's rules as everyone hears them: whether it has a passcode, never the passcode.
  publicSettings() {
    return { ...this.settings, passcode: this.passcode !== '' };
  }

  // The owner, whoever that is now, hears the passcode.
  tellHost() {
    const text = JSON.stringify({ t: 'passcode', passcode: this.passcode });
    for (const [conn, c] of this.clients) if (c.pid && c.pid === this.host) this.safeSend(conn, text);
  }

  // The island on the list of open islands (see listing.js), or null while
  // it is closed to new visitors.
  listing() {
    if (this.settings.locked) return null;
    const w = this.world;
    return {
      code: this.code,
      name: w.name,
      theme: w.theme,
      size: SIZES.find((s) => s.side === w.W)?.key ?? SIZES[0].key,
      players: this.online,
      max: MAX_PLAYERS,
      passcode: this.passcode !== '',
      // An adventure island: how many camps it has, how many are free, and whether all of it is.
      ...(this.adventure ? { adventure: this.adventure.tally() } : {}),
    };
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
    if (this.settings.monsters || this.adventure?.active) this.stepMonsters(dt, now, where);
    if (now - this.critterSentAt >= CRITTER_MS && this.online > 0) {
      this.critterSentAt = now;
      this.broadcast({ t: 'c', c: this.critters.pack() });
      // Monsters too, while there are any, and once more when the last goes.
      const any = this.monsters.list.length > 0;
      if (any || this.monstersSent) this.broadcast({ t: 'mon', m: this.monsters.pack() });
      this.monstersSent = any;
      // The flags going up, and King Grumble's hearts, as they change.
      if (this.adventure) {
        const pack = this.adventure.pack();
        const text = JSON.stringify(pack);
        if (text !== this.advSent) {
          this.advSent = text;
          this.broadcast({ t: 'adv', ...pack });
        }
      }
    }

    this.grow(now);
    this.nature(now);
  }

  // ------------------------------------------------ monsters

  stepMonsters(dt, now, where) {
    const riding = new Set(this.critters.list.map((c) => c.rider).filter(Boolean));
    const people = [];
    for (const [id, w] of where) {
      const p = this.players.get(id);
      people.push({ id, x: w.x, y: w.y, z: w.z, flying: w.flying, riding: riding.has(id), safeUntil: p.safeUntil ?? 0, dizzy: (p.dizzyUntil ?? 0) > now });
    }
    const adv = this.adventure;
    if (adv?.active) for (const news of adv.step(this.world, dt, now, people, this.monsters, this.online)) this.campFreed(news);
    const bumps = this.monsters.step(this.world, dt, now, people, isNight(this.env.time), { roam: this.settings.monsters, havens: adv?.havens(this.world), camps: adv });
    for (const m of this.monsters.takeGone()) adv?.guardGone(m, now);
    for (const { monster, pid } of bumps) this.hurt(pid, monster, now);
    // King Grumble landing: a thump everyone sees, and a moment later, whoever
    // was on the ground near him then is knocked over.
    for (const s of this.monsters.takeStomps()) {
      this.broadcast({ t: 'stomp', id: s.monster.id, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2) });
      this.stomps.push({ ...s, at: now + STOMP_SETTLE_MS });
    }
    for (const s of [...this.stomps]) {
      if (s.at > now) continue;
      this.stomps.splice(this.stomps.indexOf(s), 1);
      for (const p of this.players.values()) {
        if (!p.online || riding.has(p.id) || (p.dizzyUntil ?? 0) > now || now < (p.safeUntil ?? 0)) continue;
        if (Math.hypot(p.s[0] - s.x, p.s[2] - s.z) > STOMP.reach || Math.abs(p.s[1] - s.y) > 2) continue;
        if (now - (p.airAt ?? -Infinity) <= AIR_GRACE_MS) continue;
        this.hurt(p.id, s.monster, now, true);
      }
    }
    for (const p of this.players.values()) {
      if (!p.online) continue;
      // Dizzy for too long, with no friend to help: back to the nearest safe place.
      if (p.dizzyUntil && now >= p.dizzyUntil) this.sendHome(p, now);
      // Hearts come back while nothing bumps you.
      if ((p.hearts ?? MAX_HEARTS) >= MAX_HEARTS || p.dizzyUntil) continue;
      const hearts = heartsBack(p.hearts, now - Math.max(p.bumpAt ?? 0, p.healAt ?? 0));
      if (hearts === p.hearts) continue;
      p.hearts = hearts;
      p.healAt = now;
      this.sendToPid(p.id, { t: 'hearts', hearts });
    }
  }

  // A monster bumped into someone (stomp: King Grumble's landing knocked
  // them over): a heart gone. With none left, they sit dizzy where they are
  // on an adventure island while a friend there could come and help them up;
  // otherwise back they go to the nearest safe place, with every heart again.
  hurt(pid, monster, now, stomp = false) {
    const p = this.players.get(pid);
    if (!p) return;
    p.hearts = heartsAfterBump(p.hearts ?? MAX_HEARTS);
    p.bumpAt = now;
    p.healAt = now;
    p.safeUntil = now + SAFE_MS;
    const b = monster.body;
    const msg = { t: 'bump', pid, id: monster.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), hearts: p.hearts, home: false };
    if (monster.kind === 'king') msg.big = true;
    if (stomp) msg.stomp = true;
    if (p.hearts === 0) {
      if (this.adventure && this.helperFor(pid, now)) {
        p.dizzyUntil = now + DIZZY_MS;
        msg.dizzy = true;
      } else {
        const at = this.goHome(p, now);
        Object.assign(msg, { home: true, hearts: MAX_HEARTS, at });
      }
    }
    this.broadcast(msg);
  }

  // Whether anyone else on the island could help someone up (nobody dizzy too).
  helperFor(pid, now) {
    for (const q of this.players.values()) if (q.online && q.id !== pid && !((q.dizzyUntil ?? 0) > now)) return true;
    return false;
  }

  // Back to the nearest safe place (the start, or a camp freed), safe, with
  // every heart again. Returns where, as [x, y, z].
  goHome(p, now) {
    const at = this.adventure ? this.adventure.homeFor(this.world, p.s[0], p.s[2]) : this.world.spawn;
    p.hearts = MAX_HEARTS;
    p.dizzyUntil = 0;
    p.healAt = now;
    p.safeUntil = now + SAFE_MS;
    p.s = [at.x, at.y, at.z, p.s[3], 0, 0];
    return [at.x, at.y, at.z];
  }

  sendHome(p, now) {
    const at = this.goHome(p, now);
    this.broadcast({ t: 'home', pid: p.id, at, hearts: MAX_HEARTS });
  }

  // A friend tapping someone sitting dizzy, from beside them: up they get,
  // with a few hearts.
  help(p, msg) {
    const now = this.now();
    const q = this.players.get(msg.pid);
    if (!q?.online || q === p || !((q.dizzyUntil ?? 0) > now) || (p.dizzyUntil ?? 0) > now) return;
    if (Math.hypot(q.s[0] - p.s[0], q.s[1] - p.s[1], q.s[2] - p.s[2]) > HELP_REACH + 1.5) return;
    Object.assign(q, { dizzyUntil: 0, hearts: HELP_HEARTS, bumpAt: now, healAt: now, safeUntil: now + SAFE_MS * 2 });
    this.broadcast({ t: 'helped', pid: q.id, by: p.id, hearts: q.hearts });
  }

  // Tapping a monster, or jumping on it: pop! (King Grumble takes a lot of that.)
  bop(p, msg) {
    if (!Number.isInteger(msg.id)) return;
    const now = this.now();
    const m = this.monsters.get(msg.id);
    if (!m || (!m.camp && !this.settings.monsters) || (p.dizzyUntil ?? 0) > now) return;
    if (!this.monsters.canBop(m.id, { x: p.s[0], y: p.s[1], z: p.s[2] })) return;
    if (m.kind === 'king') {
      this.bopKing(p, m, now);
      return;
    }
    this.monsters.remove(m.id);
    const b = m.body;
    this.broadcast({ t: 'pop', id: m.id, by: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    if (m.camp) this.adventure?.guardGone(m, now);
  }

  // A bop for King Grumble: nothing in his bubble, otherwise a heart (and a
  // hop back); with none left he goes pop, and the whole island is free.
  bopKing(p, m, now) {
    const hit = this.adventure?.hitKing(p.id, now);
    if (!hit || hit.wait) return;
    if (hit.shielded) {
      this.broadcast({ t: 'kinghit', id: m.id, by: p.id, shielded: true });
      return;
    }
    const b = m.body;
    const dx = b.x - p.s[0];
    const dz = b.z - p.s[2];
    const d = Math.hypot(dx, dz) || 1;
    Object.assign(b, { vx: (dx / d) * 5, vz: (dz / d) * 5, vy: 5, onGround: false });
    this.broadcast({ t: 'kinghit', id: m.id, by: p.id, hearts: hit.hearts, max: hit.max });
    if (hit.beaten) this.winAdventure(p, m);
  }

  // A camp of an adventure island freed: its monsters go pop, its gloomy
  // ground turns back into the island's own, and everyone hears (and, with
  // the last camp, that King Grumble's bubble popped).
  campFreed(news) {
    const c = news.camp;
    for (const m of news.gone) {
      const b = m.body;
      this.broadcast({ t: 'pop', id: m.id, by: 0, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    }
    this.ungloom(c);
    this.broadcast({ t: 'freed', id: c.id, by: news.by, x: c.x, y: c.y, z: c.z });
    if (news.shieldDown) this.broadcast({ t: 'shield', up: false });
    if (news.won) {
      this.broadcast({ t: 'won', by: this.onlinePlayers().map((q) => q.id), x: c.x, y: c.y, z: c.z });
      this.allWell();
    }
    this.changed();
  }

  // The gloomy ground round a camp back to the island's own, with flowers.
  ungloom(c) {
    const cells = freeCells(this.world, c, palette(this.world.theme), this.adventure.rng);
    if (!cells.length) return;
    for (let i = 0; i < cells.length; i += 4) this.world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
    this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'nature', cells });
  }

  // King Grumble popped: every camp's monster goes, his castle is free, and
  // so is the island, for everyone on it.
  winAdventure(p, king) {
    const adv = this.adventure;
    for (const m of adv.win(this.monsters)) {
      const b = m.body;
      this.broadcast({ t: 'pop', id: m.id, by: m === king ? p.id : 0, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    }
    const castle = adv.castle;
    if (castle) this.ungloom(castle);
    const b = king.body;
    this.broadcast({ t: 'won', by: this.onlinePlayers().map((q) => q.id), hero: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    this.allWell();
    this.changed();
  }

  // The island free: anyone dizzy gets up, and with no monsters roaming, nothing
  // can bump anyone now, so everyone has all their hearts.
  allWell() {
    const now = this.now();
    for (const p of this.players.values()) {
      if ((p.dizzyUntil ?? 0) > now) {
        p.dizzyUntil = 0;
        p.hearts = this.settings.monsters ? HELP_HEARTS : MAX_HEARTS;
        if (p.online) this.broadcast({ t: 'helped', pid: p.id, by: 0, hearts: p.hearts });
        continue;
      }
      p.dizzyUntil = 0;
      if (this.settings.monsters || (p.hearts ?? MAX_HEARTS) === MAX_HEARTS) continue;
      p.hearts = MAX_HEARTS;
      if (p.online) this.sendToPid(p.id, { t: 'hearts', hearts: MAX_HEARTS });
    }
  }

  // Monsters turned off: every one roaming about goes (those of an adventure
  // island's camps stay), and, unless those are about, everyone has all their
  // hearts.
  noMonsters() {
    this.monsters.clearRoaming();
    if (this.adventure?.active) return;
    for (const p of this.players.values()) {
      if ((p.hearts ?? MAX_HEARTS) === MAX_HEARTS) continue;
      p.hearts = MAX_HEARTS;
      if (p.online) this.sendToPid(p.id, { t: 'hearts', hearts: MAX_HEARTS });
    }
  }

  sendToPid(pid, msg) {
    const text = JSON.stringify(msg);
    for (const [conn, c] of this.clients) if (c.pid === pid) this.safeSend(conn, text);
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
      // 3: since the sea creatures did; 4: since penguins and seals did; 5:
      // since the big animals did; 6: since jewels were hidden in the rock;
      // 7: since the vehicles came.
      v: 7,
      code: this.code,
      savedAt: this.now(),
      meta: this.world.meta(),
      blocks: this.encodedBlocks(),
      critters: this.critters.save(),
      env: { time: +this.env.time.toFixed(4), weather: this.env.weather },
      settings: this.settings,
      passcode: this.passcode,
      host: this.host,
      nextPid: this.nextPid,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, look: p.look })),
      tokens: [...this.tokens],
      ...(this.adventure ? { adventure: this.adventure.save() } : {}),
    };
  }

  loadSave(save) {
    if (!save || save.app !== 'kids-world' || save.kind !== 'island') throw new Error('That is not a Kids World island file.');
    this.world = World.decode(save.meta, save.blocks);
    const seed = this.world.seed;
    this.rng = new Rng(seed ^ 0x27d4eb2d ^ (Number(save.savedAt) | 0));
    this.critters = new CritterSim(seed ^ 0x5bd1e995 ^ (Number(save.savedAt) | 0));
    this.critters.max = maxCritters(this.world);
    for (const c of Array.isArray(save.critters) ? save.critters.slice(0, this.critters.max) : []) {
      if (!CRITTER_INFO[c?.type] || ![c.x, c.y, c.z].every(finite)) continue;
      const w = this.world;
      this.critters.add(c.type, Math.min(w.W - 0.5, Math.max(0.5, c.x)), Math.min(w.H, Math.max(1, c.y)), Math.min(w.D - 0.5, Math.max(0.5, c.z)), c.name, finite(c.yaw) ? c.yaw : null);
    }
    // Animals that came to the islands since this one was saved move in, once.
    const v = Number(save.v) || 1;
    if (v < 2) for (const f of placeFlyers(this.world, new Rng(seed ^ 0x2545f491))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 3) for (const f of placeSea(this.world, new Rng(seed ^ 0x6b43a9b5))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 4) for (const f of placePolar(this.world, new Rng(seed ^ 0x3c6ef372))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 5) for (const f of placeBig(this.world, new Rng(seed ^ 0x1b873593))) this.critters.add(f.type, f.x, f.y, f.z);
    // And vehicles: a car, a boat and a digger (the mines of an island from
    // before them have no rails, nor a mine cart).
    if (v < 7) for (const f of placeVehicles(this.world, new Rng(seed ^ 0x4cf5ad43))) this.critters.add(f.type, f.x, f.y, f.z, null, f.yaw);
    // Jewels too, deep in the rock where nothing anyone built can be.
    if (v < 6) hideGems(this.world, new Rng(seed ^ 0x2c1b3c6d), { open: false });
    this.settings = cleanSettings(save.settings);
    this.passcode = isPasscode(save.passcode) ? save.passcode : '';
    this.adventure = AdventureSim.load(save.adventure, this.world, (seed ^ 0x510e527f ^ (Number(save.savedAt) | 0)) >>> 0);
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
