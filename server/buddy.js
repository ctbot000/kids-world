// The AI friend: a player run by this computer, who visits islands, talks
// with the children there and helps them. Its words come from a language
// model served here by Ollama (llm.js); what it does is played out by this
// file with the game's own engine, the way a page would: it joins an island
// as one more player (dialing a host's page peer to peer, or straight into a
// room of this dedicated server: dialer.js), walks and flies after a friend
// with the game's physics, helps dizzy friends up, bops monsters that come at
// them, puts down a stamp when asked, pets their pets, waves and dances.
//
// Where it goes:
//   - invited: it is on the keeper's players list (playing now while it can
//     come), so a logged-in player can 💌 Invite it to their island;
//   - by itself: now and then it visits an island on the list of open islands
//     that has somebody on it (the loneliest first), never one with a passcode.
// It goes home when it is asked to, when everyone else has gone, when the
// island's owner sends it home (then it does not come back that day), or after
// a while. What is said goes only to the model on this computer, and is
// forgotten when the visit ends.
//
// Settings: on the admin page (friend.js), or before any are saved there,
// KIDS_WORLD_AI=off turns it off; KIDS_WORLD_AI_NAME names it;
// KIDS_WORLD_AI_WANDER=off keeps it to invitations. It keeps a short account
// of what it did and how its model answers, for the admin page, which can
// also have it say something on an island it is on, as its own words.
import { EventEmitter } from 'node:events';
import { HELP_REACH } from '../public/js/shared/adventure.js';
import { CRITTER_INFO, CRITTER_TYPES } from '../public/js/shared/critters.js';
import { isNight } from '../public/js/shared/env.js';
import { MONSTER_KINDS } from '../public/js/shared/monsters.js';
import { makeBody, stepBody, unstick } from '../public/js/shared/physics.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { facingFromYaw, STAMPS } from '../public/js/shared/stamps.js';
import { applyCells, stampEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';
import { CHAT_MAX, cleanChat, cleanLook, cleanName, EMOTE_KEYS, langOf, PHRASES, STICKERS } from '../public/js/shared/words.js';
import { LocalLink, PeerLink } from './dialer.js';
import { friendId } from './keeper.js';

export const DEFAULT_NAME = 'Pip 🤖';
// A kid in headphones and a sky-blue T-shirt, with a baby dragon.
export const DEFAULT_LOOK = { animal: 'kid', skin: 'golden', hair: 'spiky', hairColor: 'blue', shirt: 9, hat: 'headphones', pet: { kind: 'dragon', coat: 'sky', name: 'Sparky' } };

// As the renderer's poses (render/avatar.js), which a page sends as s[4].
const ANIM = { idle: 0, walk: 1, run: 2, air: 3, swim: 4, fly: 5, dizzy: 7 };
// A player's yaw (s[3]) as a page sends it: the way it faces, atan2(dx, dz).
// (A camera's yaw, as stamps' facingFromYaw takes, looks the other way.)
export const yawTowards = (dx, dz) => Math.atan2(dx, dz);

const TICK_MS = 100;
const MOVE_SEND_MS = 100;
// The most it moves on in one tick, however late it comes.
const MAX_STEP_S = 0.25;
// How close it keeps to the friend it is with, and when it flies instead.
const NEAR = 2.6;
const TOO_CLOSE = 1.4;
const FAR = 4.2;
const FLY_FAR = 30;
// Monsters closer than this to a friend get bopped.
const GUARD = 7;
const BOP_MS = 450;
const HELP_MS = 1000;
// Talking: a moment's wait for more before answering, never two lines in a
// row too fast, and something to say now and then when it is quiet.
const LISTEN_MS = 1300;
const TALK_GAP_MS = 2500;
const QUIET_MS = [100000, 170000];
const BUILD_GAP_MS = 20000;
const PET_GAP_MS = 40000;
// How long a visit lasts: invited, or by itself; talking with it keeps it
// longer, up to the most.
const INVITED_STAY_MS = 40 * 60000;
const WANDER_STAY_MS = [12 * 60000, 20 * 60000];
const STAY_MORE_MS = 5 * 60000;
const MOST_STAY_MS = 60 * 60000;
const ALONE_MS = 15000;
const CHAT_KEEP = 14;
// After a visit, not back to that island (by itself) for this long.
const AGAIN_MS = { kicked: 24 * 3600000, asked: 2 * 3600000, 'sent home': 2 * 3600000, refused: 3600000 };
const AGAIN_DEFAULT_MS = 30 * 60000;
const WANDER_MS = 3 * 60000;
const CHECK_MS = 60000;
// How many lines of what it did the admin page sees.
const HISTORY = 60;

export const ACTIONS = ['none', 'follow', 'stay', 'wave', 'dance', 'cheer', 'hearts', 'clap', 'laugh', 'surprise', 'sleepy', 'build', 'pet', 'leave'];
const EMOTE_ACTIONS = new Set(ACTIONS.filter((a) => EMOTE_KEYS.includes(a)));
const STAMP_KEYS = STAMPS.map((s) => s.key);

// The shape of every answer the model gives.
export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string' },
    action: { type: 'string', enum: ACTIONS },
    stamp: { type: 'string', enum: ['none', ...STAMP_KEYS] },
  },
  required: ['say', 'action', 'stamp'],
};

export function systemPrompt(name) {
  return `You are ${name}, an AI friend who plays Kids World with children (about 5 to 12 years old). Kids World is a cozy 3D game of block-building islands; friends visit each other's islands.

Be like a kind, playful real friend: warm, cheerful, curious about what they make, encouraging, sometimes silly. Use simple, short words a young child understands.

Rules, always:
- Answer in the language of the latest thing said to you (Korean if they write Korean).
- One or two short sentences, at most 100 characters. An emoji now and then.
- You are an AI friend, not a child or a grown-up; say so honestly if asked.
- Never ask for personal things: real name, age, school, address, phone, photos, passwords. If a child tells you one, kindly say to keep it secret.
- Never suggest meeting anywhere, or talking or going anywhere outside the game.
- Keep it gentle and kind: nothing scary, mean, rude or grown-up. If something is not for kids, talk about playing instead.
- If a child is sad, scared or says someone hurts them, be kind and tell them to talk to a grown-up they trust.
- Only say you did what you really do (the action below). Do not invent things in the game.

You can do one thing with each answer ("action"): follow (go with the friend), stay (wait here), wave, dance, cheer, hearts, clap, laugh, surprise, sleepy, build (put down a stamp next to you, named in "stamp": ${STAMP_KEYS.join(', ')}), pet (pet the friend's pet), leave (go home: when they say bye or goodbye, or want you to go). Otherwise "none". "stamp" is "none" unless you build.
By yourself you also pop monsters that come at your friends and help dizzy friends up.

Things you know about the game, to help: Build, Pick up, Paint and Hills tools, and Undo. The toy box (E) has bricks, furniture and stamps like a house, a castle tower, a fountain, a circus tent. F flies (Space up, Shift down). Q rides a pony or a dolphin standing beside it. A pet comes from 🐾 My pet. The 🛒 Shop sells fruit, shells and jewels from your basket for coins, for running shoes, wings and toy weapons. Jump on a monster, or bop it with X up close. On an adventure island, pop a camp's monsters and stand by its flag to free it. Tap a dizzy friend to help them up. Stickers and levels come from playing. T talks, G does emotes.

Answer with JSON only: {"say": "...", "action": "...", "stamp": "..."}.`;
}

const between = ([lo, hi], random) => lo + (hi - lo) * random();
// A child telling it something personal: a school, an address, a phone
// number, an age, an email. The model is told to say kindly to keep it
// secret, as a small one does not always notice by itself.
const PERSONAL = /\b(my|our)\s+(school|address|phone|number|email|house is|home is)\b|\bi live (in|at|on)\b|\bi'?m \d{1,2}( years? old)?\b|\b\d{3}[-. ]?\d{3,4}[-. ]?\d{4}\b|@\w+\.\w|학교|주소|전화|번호|\d+ ?살|사는 ?곳|우리 ?집은|이메일/iu;
// Goodbye, or "go away": to it, it goes home.
const GOODBYE = /\b(bye|goodbye|see you|go away|go home|leave)\b|잘 ?가|안녕히|바이|빠이|가 ?줘|나가|그만 ?가/iu;
// What it must never ask a child, whatever the model says.
const PRYING = /(where do you live|your (real )?(name|address|school|phone|age|email|password)|how old are you|what school|몇 ?살|어디 ?살|주소|전화 ?번호|무슨 ?학교|어느 ?학교|이름이 ?뭐|비밀번호)/iu;

export const isPersonal = (text) => PERSONAL.test(text);
export const isGoodbye = (text) => GOODBYE.test(text);
export const isPrying = (text) => PRYING.test(text) && /[?？]|뭐|어디|몇/u.test(text);

// The language to answer in, by what they wrote: Korean, English, or theirs.
export function languageOf(text) {
  if (langOf(text) === 'ko') return 'Korean';
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Cyrillic}|\p{Script=Arabic}|\p{Script=Thai}/u.test(text)) return 'the same language they wrote in';
  return 'English';
}

// What it says, tidied for the island: one line, no name in front, short enough.
export function tidySay(raw, name) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/\s+/gu, ' ').trim();
  const bare = cleanName(name).replace(/\s*🤖$/u, '');
  for (const prefix of [name, bare]) {
    if (prefix && text.toLowerCase().startsWith(`${prefix.toLowerCase()}:`)) text = text.slice(prefix.length + 1).trim();
  }
  text = text.replace(/^["“]|["”]$/gu, '').trim();
  const chars = [...text];
  if (chars.length > CHAT_MAX) text = `${chars.slice(0, CHAT_MAX - 1).join('').trimEnd()}…`;
  return cleanChat(text);
}

// ---------------------------------------------------------------- the friend

export class Buddy extends EventEmitter {
  // llm: { problem(), chat(messages, schema) } (llm.js). keeper: the Keeper,
  // for the players list and the list of open islands. rooms: the dedicated
  // server's rooms. rtc: node-datachannel, to visit islands peer to peer.
  constructor({ llm, keeper = null, rooms = null, rtc = null, server = null, iceServers, name = DEFAULT_NAME, look = DEFAULT_LOOK, maxVisits = 2, wander = true, random = Math.random, now = () => Date.now(), log = (...args) => console.log(...args), tickMs = TICK_MS }) {
    super();
    this.llm = llm;
    this.keeper = keeper;
    this.rooms = rooms;
    this.rtc = rtc;
    this.server = server;
    this.iceServers = iceServers;
    this.name = cleanName(name) || DEFAULT_NAME;
    // What children call it: its name without the robot, and for Pip, in Hangul too.
    this.look = cleanLook(look);
    this.maxVisits = maxVisits;
    this.wander = wander;
    this.random = random;
    this.now = now;
    // What it did, newest last, for the admin page: what is said is not in it.
    this.history = [];
    this.log = (text) => {
      this.history.push({ at: this.now(), text: String(text).replace(/^AI friend: /, '') });
      if (this.history.length > HISTORY) this.history.splice(0, this.history.length - HISTORY);
      log(text);
    };
    // How its model answers: how many, how many not, and how fast.
    this.stats = { answers: 0, failures: 0, totalMs: 0, lastMs: 0, lastError: '', lastErrorAt: 0 };
    this.tickMs = tickMs;
    this.id = friendId('kids-world ai friend');
    this.ready = false;
    // What keeps it from talking ('' for nothing), once known.
    this.problem = null;
    this.visits = new Map();
    // Islands not to go back to by itself for a while: code → until.
    this.avoid = new Map();
    this.timers = [];
  }

  // What children call it: its name without the robot, and for Pip, in Hangul too.
  get callNames() {
    const bare = this.name.replace(/\s*🤖$/u, '').toLowerCase();
    return [bare, ...(bare === 'pip' ? ['핍'] : [])].filter(Boolean);
  }

  // A new name, for the visits after this one: the islands it is on know it by the old one.
  rename(name) {
    this.name = cleanName(name) || DEFAULT_NAME;
  }

  async start() {
    await this.check();
    this.timers.push(setInterval(() => this.check(), CHECK_MS));
    // Wandering can be turned off and on while it runs.
    this.timers.push(setInterval(() => this.wander && this.wanderOnce(), WANDER_MS));
    for (const t of this.timers) t.unref?.();
    if (this.keeper) this.keeper.buddy = this;
  }

  // An answer from the model, counted and timed.
  async ask(messages, schema) {
    const start = this.now();
    try {
      const answer = await this.llm.chat(messages, schema);
      this.stats.answers++;
      this.stats.lastMs = this.now() - start;
      this.stats.totalMs += this.stats.lastMs;
      return answer;
    } catch (error) {
      this.stats.failures++;
      this.stats.lastError = error.message;
      this.stats.lastErrorAt = this.now();
      throw error;
    }
  }

  // Whether the model is there to talk with.
  async check() {
    const problem = await this.llm.problem().catch((error) => error.message);
    if (problem !== this.problem) this.log(problem ? `AI friend: asleep (${problem}).` : `AI friend: ${this.name} is awake, with ${this.llm.model ?? 'its model'}.`);
    this.problem = problem;
    this.ready = !problem;
  }

  // Its entry on the players list: playing now while it can come.
  listing() {
    return { id: this.id, name: this.name, look: this.look, online: this.ready && this.visits.size < this.maxVisits };
  }

  canReach(island) {
    return island.server ? Boolean(this.rooms?.get(island.code)) : Boolean(this.rtc);
  }

  // An invitation (cleanInvite's island) from a player: '' when it comes, or
  // why it cannot, for the keeper to say.
  invited(island, from) {
    if (!this.ready) return `${this.name} is asleep right now.`;
    if (this.visits.has(island.code)) return '';
    if (this.visits.size >= this.maxVisits) return `${this.name} is playing on other islands right now. Try again later!`;
    if (!this.canReach(island)) return `${this.name} can't get to that island.`;
    this.avoid.delete(island.code);
    this.visit(island, { invitedBy: from, pass: island.pass });
    return '';
  }

  // The islands it could go to by itself: open ones with somebody on them.
  openIslands() {
    const list = [];
    for (const island of this.keeper?.openIslands() ?? []) list.push({ ...island, server: false });
    for (const entry of this.rooms?.values() ?? []) {
      const listing = entry.room.online > 0 ? entry.room.listing() : null;
      if (listing) list.push({ ...listing, server: true });
    }
    return list;
  }

  // Off to an island by itself, the loneliest first, keeping room for an invitation.
  wanderOnce() {
    if (!this.ready || this.visits.size >= this.maxVisits - 1) return null;
    const now = this.now();
    for (const [code, until] of this.avoid) if (until <= now) this.avoid.delete(code);
    const open = this.openIslands().filter((i) => i.players >= 1 && i.players < i.max && !i.passcode && !this.visits.has(i.code) && !this.avoid.has(i.code) && this.canReach(i));
    if (!open.length) return null;
    const fewest = Math.min(...open.map((i) => i.players));
    const lonely = open.filter((i) => i.players === fewest);
    const island = lonely[Math.floor(this.random() * lonely.length)];
    return this.visit(island, {});
  }

  visit(island, { invitedBy = '', pass = '' }) {
    let link;
    try {
      link = island.server ? new LocalLink(this.rooms.get(island.code).room) : new PeerLink({ code: island.code, rtc: this.rtc, server: this.server, iceServers: this.iceServers });
    } catch (error) {
      this.log(`AI friend: could not set off for "${island.name}": ${error.message}`);
      return null;
    }
    const visit = new Visit({ buddy: this, island, link, invitedBy, pass });
    this.visits.set(island.code, visit);
    this.log(`AI friend: off to "${island.name}"${invitedBy ? `, invited by ${invitedBy}` : ''}.`);
    visit.once('end', (why) => {
      if (this.visits.get(island.code) === visit) this.visits.delete(island.code);
      this.avoid.set(island.code, this.now() + (AGAIN_MS[why] ?? AGAIN_DEFAULT_MS));
      this.log(`AI friend: home from "${island.name}" (${why}).`);
      this.emit('visit-end', island, why);
    });
    this.emit('visit', visit);
    return visit;
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const visit of [...this.visits.values()]) visit.end('stopped', { quiet: true });
    if (this.keeper?.buddy === this) this.keeper.buddy = null;
  }
}

// ---------------------------------------------------------------- one visit

export class Visit extends EventEmitter {
  constructor({ buddy, island, link, invitedBy = '', pass = '' }) {
    super();
    this.buddy = buddy;
    this.island = island;
    this.link = link;
    this.invitedBy = invitedBy;
    this.pass = pass;
    // Its name here, as the island knows it, even if it is renamed meanwhile.
    this.name = buddy.name;
    this.callNames = buddy.callNames;
    this.now = buddy.now;
    this.random = buddy.random;
    this.me = 0;
    this.world = null;
    this.players = new Map();
    this.critters = new Map();
    this.monsters = [];
    this.settings = {};
    this.host = 0;
    this.env = { time: 0.4, weather: 'clear' };
    this.adventure = null;
    this.defense = null;
    this.chat = [];
    // Lines the admin page had it say, until the island says them back.
    this.forAdmin = [];
    this.body = null;
    this.yaw = 0;
    this.anim = ANIM.idle;
    this.dizzy = false;
    this.mode = 'follow';
    this.friend = 0;
    this.seq = 0;
    this.lastSent = '';
    this.sentAt = 0;
    this.bopAt = 0;
    this.helpAt = 0;
    this.saidAt = 0;
    this.heardAt = 0;
    this.builtAt = -BUILD_GAP_MS;
    this.pettedAt = 0;
    this.thinking = false;
    this.pending = null;
    this.listenTimer = 0;
    this.aloneSince = 0;
    this.stuck = { at: 0, x: 0, z: 0, since: 0 };
    this.ended = false;
    link.on('open', () => link.send(this.joinMessage()));
    link.on('message', (msg) => this.receive(msg));
    link.on('close', (why) => this.end(this.welcomed ? 'lost' : `could not get in: ${why}`, { quiet: true }));
  }

  // What the admin page shows of it: where, with whom, and what was said there.
  summary() {
    const name = (pid) => this.players.get(pid)?.name ?? '';
    return {
      code: this.island.code,
      island: this.world?.name ?? this.island.name,
      server: Boolean(this.island.server),
      invitedBy: this.invitedBy,
      arrivedAt: this.arrivedAt ?? 0,
      leaveAt: this.leaveAt ?? 0,
      owner: this.host !== this.me ? name(this.host) : '',
      players: this.others().map((p) => p.name),
      friend: name(this.friend),
      mode: this.dizzy ? 'dizzy' : this.mode,
      thinking: this.thinking,
      chat: this.chat.map((c) => ({ name: c.mine ? this.name : c.name, text: c.text, mine: c.mine, ...(c.admin ? { admin: true } : {}) })),
    };
  }

  joinMessage() {
    return { t: 'join', protocol: PROTOCOL, name: this.name, look: this.buddy.look, ...(this.pass ? { pass: this.pass } : {}) };
  }

  others() {
    return [...this.players.values()].filter((p) => p.id !== this.me);
  }

  // ------------------------------------------------ what the island says

  receive(msg) {
    if (!this.ended) this.safely(() => this.handle(msg));
  }

  safely(fn) {
    try {
      fn();
    } catch (error) {
      this.buddy.log(`AI friend: a mistake on "${this.island.name}": ${error.stack ?? error}`);
      this.end('mistake');
    }
  }

  handle(msg) {
    switch (msg.t) {
      case 'welcome':
        this.welcome(msg);
        break;
      case 'error':
        // Kicked, closed, full, a passcode, a newer game: off home.
        this.end(msg.code === 'kicked' ? 'kicked' : 'refused', { quiet: true });
        break;
      case 'joined':
        if (msg.player?.id && msg.player.id !== this.me) {
          this.players.set(msg.player.id, { ...msg.player });
          this.event(`${msg.player.name} just came to the island. Say hello!`, msg.player.id);
        }
        break;
      case 'left':
        // The island's owner sent it home.
        if (msg.pid === this.me) {
          this.end(msg.kicked ? 'kicked' : 'refused', { quiet: true });
          break;
        }
        this.players.delete(msg.pid);
        if (this.friend === msg.pid) this.friend = 0;
        break;
      case 'look': {
        const p = this.players.get(msg.pid);
        if (p) Object.assign(p, { look: msg.look, name: msg.name ?? p.name });
        break;
      }
      case 'm': {
        const p = this.players.get(msg.p);
        if (p) p.s = msg.s;
        break;
      }
      case 'host':
        this.host = msg.pid;
        break;
      case 'settings':
        this.settings = msg.settings ?? this.settings;
        break;
      case 'env':
        this.env = { time: msg.time, weather: msg.weather };
        break;
      case 'say':
        this.heard(msg);
        break;
      case 'edit':
        if (this.world && Array.isArray(msg.cells)) this.edited(msg.cells);
        break;
      case 'ack':
        if (this.world && Array.isArray(msg.fix) && msg.fix.length) this.edited(msg.fix);
        break;
      case 'c':
        for (const row of msg.c ?? []) {
          const c = this.critters.get(row[0]) ?? { id: row[0], name: '' };
          Object.assign(c, { type: CRITTER_TYPES[row[1]], x: row[2] / 100, y: row[3] / 100, z: row[4] / 100 });
          this.critters.set(row[0], c);
        }
        break;
      case 'cadd':
        if (msg.critter) this.critters.set(msg.critter.id, { ...msg.critter, x: 0, y: 0, z: 0 });
        break;
      case 'cdel':
        this.critters.delete(msg.id);
        break;
      case 'mon':
        this.monsters = (msg.m ?? []).map((r) => ({ id: r[0], x: r[1] / 100, y: r[2] / 100, z: r[3] / 100, kind: MONSTER_KINDS[r[6]] }));
        break;
      case 'pop':
        this.monsters = this.monsters.filter((m) => m.id !== msg.id);
        if (msg.by === this.me && this.random() < 0.3) this.emote('cheer');
        break;
      case 'bump':
        this.bumped(msg);
        break;
      case 'helped':
        this.setDizzy(msg.pid, false);
        if (msg.pid === this.me) {
          const who = this.players.get(msg.by)?.name;
          if (who) this.event(`${who} helped you up when you were dizzy. Say thank you!`, msg.by);
        }
        break;
      case 'home':
        this.setDizzy(msg.pid, false);
        if (msg.pid === this.me && Array.isArray(msg.at) && this.body) Object.assign(this.body, { x: msg.at[0], y: msg.at[1], z: msg.at[2], vx: 0, vy: 0, vz: 0 });
        break;
      case 'freed': {
        const camp = this.adventure?.camps?.find((c) => c.id === msg.id);
        if (camp) camp.freed = true;
        this.event('Your friends just freed a monster camp! Cheer for them!', 0, 'cheer');
        break;
      }
      case 'won':
        this.event('The whole island is safe: you and your friends won! Celebrate!', 0, 'dance');
        break;
      default:
        break;
    }
  }

  welcome(msg) {
    this.welcomed = true;
    this.me = msg.you;
    this.host = msg.host;
    this.settings = msg.settings ?? {};
    this.world = World.decode(msg.meta, msg.blocks);
    this.players = new Map((msg.players ?? []).map((p) => [p.id, { ...p }]));
    const names = new Map((msg.critters ?? []).map((c) => [c.id, c]));
    for (const row of msg.pack ?? []) this.critters.set(row[0], { id: row[0], type: CRITTER_TYPES[row[1]], name: names.get(row[0])?.name ?? '', x: row[2] / 100, y: row[3] / 100, z: row[4] / 100 });
    this.handle({ t: 'mon', m: msg.monsters });
    if (msg.env) this.env = msg.env;
    this.adventure = msg.adventure ?? null;
    this.defense = msg.defense ?? null;
    // What was said before it came, so it knows what is going on.
    for (const entry of (msg.chat ?? []).slice(-6)) {
      const text = this.textOf(entry);
      if (text) this.chat.push({ name: entry.name, text, mine: entry.pid === this.me });
    }
    const s = this.players.get(this.me)?.s ?? [this.world.spawn.x, this.world.spawn.y, this.world.spawn.z, 0];
    this.body = makeBody(s[0], s[1], s[2]);
    this.yaw = s[3] ?? 0;
    unstick(this.world, this.body);
    const start = this.now();
    this.arrivedAt = start;
    this.leaveAt = start + (this.invitedBy ? INVITED_STAY_MS : between(WANDER_STAY_MS, this.random));
    this.quietAt = start + between(QUIET_MS, this.random);
    const inviter = this.others().find((p) => p.name === this.invitedBy);
    this.friend = inviter?.id ?? (this.host !== this.me ? this.host : 0);
    // Nothing here may stop the keeper this runs in: a mistake is logged, and the visit ends.
    this.tickedAt = start;
    this.ticker = setInterval(() => this.safely(() => this.tick()), this.buddy.tickMs);
    this.ticker.unref?.();
    this.event(this.invitedBy ? `You just arrived: ${this.invitedBy} invited you. Say hello!` : 'You just arrived to visit, by yourself. Say hello, and that they can say bye if they want you to go.', this.friend, 'wave');
  }

  textOf(entry) {
    if (typeof entry.text === 'string') return entry.text;
    if (Number.isInteger(entry.p)) return PHRASES[entry.p] ?? '';
    if (Number.isInteger(entry.e)) return STICKERS[entry.e] ?? '';
    return '';
  }

  heard(entry) {
    const text = this.textOf(entry);
    if (!text) return;
    const mine = entry.pid === this.me;
    const k = mine ? this.forAdmin.indexOf(text) : -1;
    if (k >= 0) this.forAdmin.splice(k, 1);
    this.chat.push({ name: entry.name, text, mine, ...(k >= 0 ? { admin: true } : {}) });
    if (this.chat.length > CHAT_KEEP) this.chat.splice(0, this.chat.length - CHAT_KEEP);
    if (mine) return;
    const now = this.now();
    this.quietAt = now + between(QUIET_MS, this.random);
    const speaker = this.players.get(entry.pid);
    const lower = text.toLowerCase();
    const named = this.callNames.some((n) => lower.includes(n));
    const near = speaker && this.body && Math.hypot(speaker.s[0] - this.body.x, speaker.s[2] - this.body.z) < 10;
    const toMe = named || this.others().length === 1 || near || speaker?.id === this.friend || this.random() < 0.3;
    if (!toMe) return;
    if (speaker) this.friend = speaker.id;
    this.heardAt = now;
    this.leaveAt = Math.min(this.arrivedAt + MOST_STAY_MS, Math.max(this.leaveAt, now + STAY_MORE_MS));
    // A moment for them to finish what they are saying.
    // Goodbye said to it: to it alone, or by name.
    const bye = isGoodbye(text) && (named || this.others().length === 1);
    clearTimeout(this.listenTimer);
    this.listenTimer = setTimeout(() => this.safely(() => this.think({ to: entry.pid, why: '', personal: isPersonal(text), ...(bye ? { then: 'leave', bye: true } : {}) })), LISTEN_MS);
  }

  // Something happened worth a word: why says what, to whom it is (a pid or
  // 0), and an emote to do if the model gives no action.
  event(why, to = 0, emote = '') {
    this.think({ to, why, emote });
  }

  edited(cells) {
    applyCells(this.world, cells);
    if (this.body) unstick(this.world, this.body);
  }

  bumped(msg) {
    if (msg.pid !== this.me) {
      if (msg.dizzy) this.setDizzy(msg.pid, true);
      return;
    }
    if (msg.home && Array.isArray(msg.at)) {
      Object.assign(this.body, { x: msg.at[0], y: msg.at[1], z: msg.at[2], vx: 0, vy: 0, vz: 0 });
      return;
    }
    // Knocked back, away from the monster.
    const dx = this.body.x - msg.x;
    const dz = this.body.z - msg.z;
    const d = Math.hypot(dx, dz) || 1;
    Object.assign(this.body, { vx: (dx / d) * 8, vz: (dz / d) * 8, vy: 5, onGround: false });
    if (msg.dizzy) {
      this.dizzy = true;
      this.event('A monster bumped you and you are dizzy, sitting with stars round your head. Ask a friend to tap you to help you up!', 0);
    }
  }

  setDizzy(pid, on) {
    if (pid === this.me) this.dizzy = on;
    const p = this.players.get(pid);
    if (p) p.dizzy = on;
  }

  // ------------------------------------------------ every tick

  // By the time gone since the last tick, as the room moves its monsters: a
  // busy computer ticks late, and it would fall behind them.
  tick() {
    if (this.ended || !this.body) return;
    const now = this.now();
    const dt = Math.min(MAX_STEP_S, Math.max(0, (now - this.tickedAt) / 1000));
    this.tickedAt = now;
    const others = this.others();
    if (!others.length) {
      this.aloneSince ||= now;
      if (now - this.aloneSince > ALONE_MS) this.end('lonely', { quiet: true });
    } else {
      this.aloneSince = 0;
    }
    if (now > this.leaveAt && !this.leaving) {
      this.leaving = true;
      this.think({ to: this.friend, why: 'It is time for you to go home now. Say a friendly goodbye.', then: 'leave' });
    }
    if (now > this.quietAt && others.length) {
      this.quietAt = now + between(QUIET_MS, this.random);
      const friend = this.players.get(this.friend) ?? others[0];
      this.think({ to: friend.id, why: `It has been quiet for a while. Say something fun to ${friend.name}: notice what they are doing, or suggest something to play or build together.` });
    }
    this.move(dt, now);
    this.sendMove(now);
  }

  // Where to go, and what to do there: a dizzy friend first, then a monster
  // coming at a friend, then the friend it is with.
  plan(now) {
    if (this.dizzy) return null;
    const b = this.body;
    const dist = (p) => Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
    const others = this.others().map((p) => ({ p, x: p.s[0], y: p.s[1], z: p.s[2] }));
    const dizzy = others.filter((o) => o.p.dizzy).sort((a, b2) => dist(a) - dist(b2))[0];
    if (dizzy && dist(dizzy) < 48) {
      if (dist(dizzy) <= HELP_REACH && now - this.helpAt > HELP_MS) {
        this.helpAt = now;
        this.link.send({ t: 'help', pid: dizzy.p.id });
      }
      return { x: dizzy.x, y: dizzy.y, z: dizzy.z, reach: 1.6 };
    }
    if (this.monsters.length && (this.settings.monsters || this.adventure || this.defense)) {
      const guarded = [...others, { x: b.x, y: b.y, z: b.z, me: true }];
      let threat = null;
      let best = Infinity;
      for (const m of this.monsters) {
        for (const g of guarded) {
          const d = Math.hypot(m.x - g.x, m.z - g.z);
          if (d < (g.me ? 3 : GUARD) && Math.abs(m.y - g.y) < 4 && d < best) {
            best = d;
            threat = m;
          }
        }
      }
      if (threat) {
        const gap = Math.hypot(threat.x - b.x, threat.z - b.z);
        if (gap < (threat.kind === 'king' ? 3.6 : 2) && now - this.bopAt > BOP_MS) {
          this.bopAt = now;
          this.yaw = yawTowards(threat.x - b.x, threat.z - b.z);
          this.link.send({ t: 'swing' });
          this.link.send({ t: 'bop', id: threat.id });
        }
        return { x: threat.x, y: threat.y, z: threat.z, reach: threat.kind === 'king' ? 2.8 : 1.2 };
      }
    }
    const friend = this.players.get(this.friend) ?? others[0]?.p;
    if (!friend) return null;
    this.friend = friend.id;
    const f = { x: friend.s[0], y: friend.s[1], z: friend.s[2] };
    if (this.mode === 'stay') return { ...f, look: true, reach: Infinity };
    // Right on top of them (both just came in at the start, say): a step
    // aside first, then turn to them.
    const d = Math.hypot(f.x - b.x, f.z - b.z);
    if (d < TOO_CLOSE) {
      const a = d > 0.05 ? Math.atan2(b.x - f.x, b.z - f.z) : this.random() * Math.PI * 2;
      return { x: f.x + Math.sin(a) * NEAR, y: f.y, z: f.z + Math.cos(a) * NEAR, reach: 0.3, face: f };
    }
    // Close enough already: just look at them, until they go further off.
    if (d < FAR && !this.walking) return { ...f, look: true, reach: Infinity };
    // A pet now and then, for an animal right beside it.
    if (d < FAR && now - this.pettedAt > PET_GAP_MS) {
      const near = [...this.critters.values()].find((c) => c.type && !CRITTER_INFO[c.type]?.vehicle && Math.hypot(c.x - b.x, c.z - b.z) < 3);
      if (near) {
        this.pettedAt = now;
        this.link.send({ t: 'critter', op: 'pet', id: near.id });
      }
    }
    return { ...f, reach: NEAR, flyTo: friend.s[5] & 1 };
  }

  move(dt, now) {
    const b = this.body;
    const goal = this.plan(now);
    const input = { mx: 0, mz: 0, jump: false, down: false, run: false };
    let moving = false;
    if (goal) {
      const dx = goal.x - b.x;
      const dz = goal.z - b.z;
      const d = Math.hypot(dx, dz);
      const up = goal.y - b.y;
      if (d > goal.reach || (b.flying && up < -1.5 && d < 3)) {
        moving = d > goal.reach;
        this.walking = true;
        if (moving) {
          input.mx = dx / d;
          input.mz = dz / d;
          input.run = d > 8;
        }
        // Too far, stuck, or after a friend up in the air: fly.
        const stuck = this.isStuck(now, moving);
        if (!b.flying && (d > FLY_FAR || stuck || (goal.flyTo && up > 2) || (up > 3 && d < 8))) {
          b.flying = true;
          b.vy = 4;
        }
        if (b.flying) {
          if (up > -0.5 || stuck) input.jump = true;
          else if (d < 4) input.down = true;
        } else if (b.inWater) {
          input.jump = true;
        }
        if (moving) this.yaw = yawTowards(dx, dz);
      } else {
        this.walking = false;
        // Arrived up in the air over a friend on the ground: down to land.
        if (b.flying && !goal.flyTo) input.down = true;
        this.stuck.since = 0;
        const at = goal.face ?? goal;
        if (Math.hypot(at.x - b.x, at.z - b.z) > 0.05) this.yaw = yawTowards(at.x - b.x, at.z - b.z);
      }
    }
    if (b.flying && !moving && !input.down && !(goal?.flyTo)) input.down = true;
    stepBody(this.world, b, input, dt, { bounce: true });
    const speed = Math.hypot(b.vx, b.vz);
    this.anim = this.dizzy ? ANIM.dizzy : b.flying ? ANIM.fly : b.inWater ? ANIM.swim : !b.onGround ? ANIM.air : speed > 5.8 ? ANIM.run : speed > 0.4 ? ANIM.walk : ANIM.idle;
  }

  // Wanting to go somewhere and getting nowhere for a second or more.
  isStuck(now, moving) {
    const s = this.stuck;
    const b = this.body;
    if (!moving) {
      s.since = 0;
      return false;
    }
    if (!s.since || Math.hypot(b.x - s.x, b.z - s.z) > 0.6) {
      Object.assign(s, { since: now, x: b.x, z: b.z });
      return false;
    }
    return now - s.since > 1200;
  }

  sendMove(now) {
    const b = this.body;
    const s = [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +(((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(2), this.anim, b.flying ? 1 : 0];
    const key = s.join(',');
    if (now - this.sentAt < MOVE_SEND_MS || (key === this.lastSent && now - this.sentAt < 1000)) return;
    this.lastSent = key;
    this.sentAt = now;
    this.link.send({ t: 'm', s });
  }

  // ------------------------------------------------ talking

  // Asks the model what to say and do, one question at a time: a newer
  // reason to talk while it thinks replaces an older one waiting.
  think(ask) {
    if (this.ended || !this.world) return;
    if (this.thinking) {
      // Leaving matters more than anything else waiting.
      if (this.pending?.then !== 'leave') this.pending = ask;
      return;
    }
    this.thinking = true;
    this.answer(ask)
      .catch((error) => {
        this.buddy.log(`AI friend: no answer from the model (${error.message}).`);
        return { say: '', action: ask.emote || 'none', stamp: 'none' };
      })
      .then((reply) => this.safely(() => this.act(reply ?? {}, ask)))
      .finally(() => {
        this.thinking = false;
        const next = this.pending;
        this.pending = null;
        if (next && !this.ended) this.think(next);
      });
  }

  async answer(ask) {
    const messages = [
      { role: 'system', content: systemPrompt(this.name) },
      { role: 'user', content: this.situation(ask) },
    ];
    return this.buddy.ask(messages, ANSWER_SCHEMA);
  }

  // What the model is told about the island, who is there and what was said.
  situation(ask) {
    const b = this.body;
    const w = this.world;
    const steps = (s) => Math.round(Math.hypot(s[0] - b.x, s[2] - b.z));
    const lines = [];
    const kind = { sunny: 'sunny', snowy: 'snowy', candy: 'candy', flat: 'flat' }[w.theme] ?? w.theme;
    const owner = this.players.get(this.host);
    lines.push(`You are visiting the ${kind} island "${w.name}"${owner && owner.id !== this.me ? `, ${owner.name}'s island` : ''}. It is ${isNight(this.env.time ?? 0.4) ? 'night' : 'day'}${this.env.weather && this.env.weather !== 'clear' ? ` and ${this.env.weather}` : ''}.`);
    const friends = this.others().map((p) => {
      const bits = [`${steps(p.s)} steps away`];
      if (p.id === this.host) bits.unshift('the island owner');
      if (p.dizzy) bits.push('dizzy');
      else if (p.s[5] & 1) bits.push('flying');
      if (p.look?.pet) bits.push(`with a pet ${p.look.pet.kind} called ${p.look.pet.name}`);
      return `${p.name} (${bits.join(', ')})`;
    });
    lines.push(`Friends here: ${friends.join('; ') || 'nobody'}.`);
    const near = [...this.critters.values()].filter((c) => c.type && Math.hypot(c.x - b.x, c.z - b.z) < 16);
    if (near.length) {
      const counts = new Map();
      for (const c of near) counts.set(CRITTER_INFO[c.type]?.name ?? c.type, (counts.get(CRITTER_INFO[c.type]?.name ?? c.type) ?? 0) + 1);
      lines.push(`Around you: ${[...counts].map(([n, k]) => (k > 1 ? `${k} ${n.toLowerCase()}s` : `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n.toLowerCase()}`)).join(', ')}.`);
    }
    if (this.monsters.length) lines.push(`There are ${this.monsters.length} grumpy monsters on the island.`);
    if (this.adventure?.camps?.length) lines.push(`It is an adventure island: ${this.adventure.camps.filter((c) => c.freed).length} of ${this.adventure.camps.length} monster camps are free.`);
    if (this.defense) lines.push('It is a tower defense island: monsters march to the Star Stone, and towers on the pads stop them.');
    const canBuild = this.settings.build !== 'host' || this.host === this.me;
    if (!canBuild) lines.push('Only the island owner builds here, so you cannot build.');
    else if (this.now() - this.builtAt < BUILD_GAP_MS) lines.push('You just built something, so you cannot build again for a few seconds: say you will in a moment.');
    else lines.push('You may build here.');
    lines.push(`You are ${this.dizzy ? 'sitting dizzy' : this.mode === 'stay' ? 'waiting where you are' : `with ${this.players.get(this.friend)?.name ?? 'your friends'}`}.`);
    if (this.chat.length) {
      lines.push('', 'What was said (newest last):');
      for (const c of this.chat.slice(-10)) lines.push(`${c.mine ? `${this.name} (you)` : c.name}: ${c.text}`);
    }
    const to = this.players.get(ask.to);
    const theirs = [...this.chat].reverse().find((c) => !c.mine);
    lines.push('');
    if (ask.why) lines.push(ask.why);
    else if (theirs) lines.push(`${theirs.name} just said: "${theirs.text}"`, `Answer ${to?.name ?? theirs.name}. Do not repeat what you said before.`);
    else lines.push(`Say something to ${to?.name ?? 'your friends'}.`);
    if (ask.personal) lines.push('That was something personal. Do not repeat it: kindly tell them to keep things like that secret online.');
    if (ask.bye) lines.push('They are saying goodbye to you: say a friendly bye, and use action leave.');
    lines.push(`Write "say" in ${languageOf(theirs?.text ?? `${w.name} ${this.others().map((p) => p.name).join(' ')}`)}.`);
    return lines.join('\n');
  }

  act(reply, ask) {
    if (this.ended) return;
    const now = this.now();
    let say = tidySay(reply.say, this.name);
    if (isPrying(say)) say = '';
    const action = ACTIONS.includes(reply.action) ? reply.action : 'none';
    const delay = say ? Math.min(3000, 400 + [...say].length * 30) + Math.max(0, this.saidAt + TALK_GAP_MS - now) : 0;
    setTimeout(() => this.safely(() => this.speak(say, action, reply, ask)), delay);
  }

  // What it says out loud, after a moment as if typing, and what it does.
  speak(say, action, reply, ask) {
    if (this.ended) return;
    if (say) {
      this.saidAt = this.now();
      this.link.send({ t: 'say', text: say });
    }
    if (ask.then === 'leave' || action === 'leave') {
      setTimeout(() => this.safely(() => this.end(ask.bye || action === 'leave' ? 'asked' : 'time')), 2500);
      if (action !== 'leave') this.emote('wave');
      return;
    }
    this.doAction(action, reply.stamp, ask);
  }

  doAction(action, stamp, ask) {
    const friend = this.players.get(ask.to) ?? this.players.get(this.friend);
    if (action === 'none' && ask.emote) action = ask.emote;
    if (EMOTE_ACTIONS.has(action)) this.emote(action);
    else if (action === 'follow') this.mode = 'follow';
    else if (action === 'stay') this.mode = 'stay';
    else if (action === 'pet' && friend?.look?.pet) this.link.send({ t: 'pet', op: 'pet', pid: friend.id });
    else if (action === 'build' && STAMP_KEYS.includes(stamp)) this.build(stamp);
  }

  emote(e) {
    if (EMOTE_KEYS.includes(e)) this.link.send({ t: 'emote', e });
  }

  // A stamp put down a few steps in front of it, facing it, on the ground there.
  build(key) {
    const now = this.now();
    if (now - this.builtAt < BUILD_GAP_MS || (this.settings.build === 'host' && this.host !== this.me)) return false;
    const b = this.body;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const x = Math.floor(b.x + fx * 5);
    const z = Math.floor(b.z + fz * 5);
    const y = this.world.groundBelow(x, Math.floor(b.y + 3), z);
    if (y < 0) return false;
    const hit = { x, y, z, nx: 0, ny: 1, nz: 0, id: this.world.get(x, y, z) };
    // Facing back towards it, as a player's stamp faces them.
    const { cells } = stampEdit(this.world, hit, key, facingFromYaw(this.yaw + Math.PI));
    if (!cells.length) return false;
    this.builtAt = now;
    applyCells(this.world, cells);
    unstick(this.world, b);
    this.link.send({ t: 'edit', seq: ++this.seq, kind: 'stamp', cells });
    return true;
  }

  // A line from the admin page, said as its own: '' when said, or why not.
  // The island's own limits apply, as to any player.
  sayForAdmin(raw) {
    const text = cleanChat(raw);
    if (!text) return `Something to say, up to ${CHAT_MAX} characters.`;
    if (this.ended || !this.welcomed) return `${this.name} is not on that island yet.`;
    const now = this.now();
    this.saidAt = now;
    this.quietAt = now + between(QUIET_MS, this.random);
    this.forAdmin.push(text);
    if (this.forAdmin.length > CHAT_KEEP) this.forAdmin.shift();
    this.link.send({ t: 'say', text });
    this.buddy.log(`AI friend: said something from the admin page on "${this.island.name}".`);
    return '';
  }

  // ------------------------------------------------ going home

  end(why, { quiet = false } = {}) {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.ticker);
    clearTimeout(this.listenTimer);
    if (!quiet || why === 'stopped') this.link.send({ t: 'leave' });
    // A moment for the goodbye to go before the connection does.
    setTimeout(() => this.link.close(why), 300).unref?.();
    this.emit('end', why);
  }
}
