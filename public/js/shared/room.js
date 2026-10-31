// A hosted island: the world and everything around it — who is here, their
// reconnect tokens, the animals, the clock and the weather, sprouts growing
// into trees, fruit growing back, crops growing on farmland (and the rain
// and water close by watering it), what the island's owner allows, the
// monsters when the owner lets them in (with everyone's HP), and on an
// adventure island its camps to free (see adventure.js), and on a tower
// defense island the waves of monsters and the towers (see defense.js).
//
// Transport-agnostic. The host environment (the Node server, a host's
// browser, or solo play) attaches connection objects with send(text) and
// optional close(), hands every decoded message to receive(), and calls
// tick() about ten times a second.

import { AdventureSim, cleanStage, DIZZY_MS, freeCells, HELP_REACH, helpHp } from './adventure.js';
import { ArcadeSim, gameOfBlock, keyOf, REACH } from './arcade.js';
import { BUILD_REACH, DefenseSim } from './defense.js';
import { HideSeekSim } from './hideseek.js';
import { RaceSim, raceTrack } from './race.js';
import { GoSim, isGoBoard, REACH as GO_REACH } from './go.js';
import * as B from './blocks.js';
import { trainAt } from './coaster.js';
import { CRITTER_INFO, CritterSim, FLOWERS, isFixed, MAX_FIREFLIES, spinAt, maxCritters, mountUnder, nearestWater, NEEDS_WATER, needsRoom, busesClearOf, placeAircraft, placeBig, placeBuses, placeFlyers, placePolar, placeScooters, placeSea, placeVehicles, riderAt, seatsFor, roomFor, standHeight } from './critters.js';
import { advanceTime, DAY_MODES, isNight, isRaining, nextWeather, WEATHERS } from './env.js';
import { Rng } from './rng.js';
import { FIRE as BLAZE, Fires, strikeSpot } from './fire.js';
import { blastEdit, gemBlastEdit, growEdit, validCells } from './tools.js';
import { cellHitsBody, BODY } from './physics.js';
import { World } from './world.js';
import { generate, hideGems, palette, SIZES } from './worldgen.js';
import { cleanLevel } from './levels.js';
import { isPasscode, normalizePasscode } from './listing.js';
import { canRide, FIRE, hitDragon, inFlames, isWild, RIDE_BUMP_MS, RIDE_FIRE, RIDE_HEAL_MS, RIDE_HEAL_NEAR, RIDE_REST_MS, rideOf, stepDragons } from './dragon.js';
import { underTent } from './tents.js';
import { isMonsterGashapon } from './gashapon.js';
import { ARM_REACH, BOP_SLACK, bopGap, BUMP_HP, GHOST_FIRE, hpAfterBump, hpBack, isHeavy, KING_PUSH, KING_REACH, kindOf, LAVA_BUMPS, maxHp, MonsterSim, SAFE_MS, STOMP } from './monsters.js';
import { isNote, isPiano } from './piano.js';
import { applyStroke, blankPicture, cleanStroke, decodePicture, encodePicture, isBlank, isPictureAt, MAX_PICTURES } from './drawing.js';
import { cleanPiece } from './song.js';
import { hasPower, weaponOf } from './shop.js';
import { cleanChat, cleanIslandName, cleanLook, cleanName, EMOTE_KEYS, isValidName, lookHair, lookTall, NAME_MAX, PHRASES, randomIslandName, randomName, STICKERS } from './words.js';

// The most HP someone has, from the level on their look.
const hpFor = (p) => maxHp(cleanLevel(p.look?.level) || 1);

// 2: block ids take two bytes (world.js FORMAT).
export const PROTOCOL = 2;

// A player's name as sent: any name as typed, tidied, or '' for an empty,
// invisible or overlong one. (Two players of one name on an island get a
// number from uniqueName.)
function nameOf(raw) {
  const name = cleanName(raw);
  return isValidName(name) && [...name].length <= NAME_MAX ? name : '';
}
export const MAX_PLAYERS = 8;
export const EDIT_KINDS = ['build', 'pick', 'paint', 'hills', 'stamp', 'undo', 'grow', 'nature', 'water', 'door', 'scoot'];

const RATE_BURST = 240;
const RATE_PER_SEC = 90;
const CELL_BURST = 16000;
const CELLS_PER_SEC = 4000;
const CRITTER_MS = 200;
// Landing on a monster marching on a tower defense island takes this many of its hearts.
const LAND_POWER = 3;
const ENV_MS = 5000;
const GROW_MS = [45000, 80000];
const REGROW_MS = [120000, 200000];
// On a volcano island, ice melts into water after this long, and water
// boils away after this (a little sparkle and it is gone, stepMelts).
const MELT_MS = [5000, 9000];
const BOIL_MS = [7000, 13000];
// Crops (blocks.js CROPS) are looked at this often, each moving on a stage
// once it has grown long enough: its crop's `stage` seconds on watered
// farmland, twice that on dry, each one a little more or less (STAGE_SPREAD)
// so that a field ripens a few at a time.
const FARM_MS = 1000;
const STAGE_SPREAD = [0.8, 1.2];
// Farmland is looked at about this often for rain falling on it (out under
// the open sky) or water close by (SOAK blocks across, a block up or down),
// which water it; watered, it dries out once DRY_MS has passed with neither.
const SOIL_MS = [3000, 6000];
const DRY_MS = [240000, 360000];
const SOAK = 2;
const SHELL_MS = 60000;
const STAR_MS = 25000;
const MAX_SHELLS = 16;
const MAX_STARS = 6;
const CHAT_KEEP = 30;
// A mining bomb (blocks.js BOMB), once placed: this long a fuse, sparking
// away, before it pops (stepBombs).
const BOMB_FUSE_MS = [2200, 2800];
// How often a waiting bomb throws its fizzing spark (stepBombs).
const BOMB_SPARK_MS = 400;
// A Bomb Rod (shop.js bombrod) throws its little bomb this far at most, and
// its pop reaches this far round where it lands (rodBlast).
const ROD_RANGE = 5;
const ROD_BLAST = 2;
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

// A fun park ride's seats (0 on), the nearest to someone standing at s
// first, where they are on it now: the cabin at the bottom of a Ferris
// wheel, the horse going by on a merry-go-round.
function nearestSeats(c, s) {
  const ms = Date.now();
  const spin = spinAt(c.type, ms);
  const far = (i) => {
    const at = riderAt(c.type, { x: c.x, y: c.y, z: c.z, yaw: c.yaw, spin, ms }, i + 1);
    return Math.hypot(at.x - s[0], at.y - s[1], at.z - s[2]);
  };
  return c.passengers.map((_, i) => [i, far(i)]).sort((a, b) => a[1] - b[1]).map(([i]) => i);
}

// Who a logged-in player is, as their pages tell an island (see main.js).
export const isWho = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

export class Room {
  // Either { theme, size, name, seed, adventure, defense, stage } for a
  // brand-new island, or { save }. stage: the public adventure island's
  // (see shared/adventure.js); shared: an island everybody owns, so nobody
  // becomes its owner — the public adventure island is one, and its toy box
  // stays shut: nobody builds on it or brings anything to it.
  constructor({ code = '', theme = 'sunny', size = 'small', name = '', seed = 0, adventure = false, defense = false, save = null, settings = null, stage = 1, shared = false, now = () => Date.now(), log = () => {}, random = Math.random } = {}) {
    this.code = code;
    this.now = now;
    this.log = log;
    this.random = random;
    this.stage = cleanStage(stage);
    this.shared = shared === true;
    this.clients = new Map();
    this.tokens = new Map();
    this.players = new Map();
    this.kicked = new Set();
    this.chat = [];
    this.nextPid = 1;
    this.host = 0;
    this.reservedHost = 0;
    // An island owned by one login (whoever keeps it sets this, as the CTB
    // island's keeper does): only a player whose page says it is that login
    // (isWho, the hash every page of a login sends) is ever its owner, and
    // with them away it has none. '' for an island like any other.
    this.ownerWho = '';
    this.growth = new Map();
    this.regrow = new Map();
    // The crops growing and the farmland they grow in (see farm), by cell.
    this.crops = new Map();
    this.soil = new Map();
    // The pictures on the island's drawing boards (drawing.js), by cell:
    // { x, y, z, px }. Saved with the island.
    this.drawings = new Map();
    // What the computers on some desks show (whoever keeps the island sets
    // this, as the CTB island's office does with its workers' real work):
    // [{ x, y, z, name, issue, doing, steps, since }], or null for none.
    this.screens = null;
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
    this.farmAt = t + FARM_MS;
    this.farmedAt = t;
    // The camps to free, on an adventure island (adventure.js), and King
    // Grumble's landings still to work out (see stepMonsters).
    this.adventure = null;
    this.advSent = '';
    this.stomps = [];
    // The road, the towers and the waves, on a tower defense island (defense.js).
    this.defense = null;
    this.defSent = '';
    // The owner's song (song.js), in its pieces as they came, or null. Never
    // saved: it is the owner's page that keeps it and plays it again.
    this.song = null;
    // The games going at the island's arcade machines (arcade.js), by their
    // machines' cells. Never saved either: an island opened again starts
    // with none.
    this.arcade = null;
    this.arcSent = '';
    // A round of hide and seek (hideseek.js), never saved either.
    this.hideseek = new HideSeekSim();
    this.hsSent = '';
    // The games of Go at the island's Go boards (go.js), never saved either.
    this.go = new GoSim();
    this.goSent = '';
    // The fireflies out tonight (their critter ids), and whether it is night
    // as far as they are concerned. Never saved: they come out again at dusk.
    this.fireflies = [];
    this.firefliesNight = null;

    if (save) {
      this.loadSave(save);
    } else {
      const s = seed >>> 0 || Math.floor(random() * 2 ** 31) + 1;
      const islandName = cleanIslandName(name) || randomIslandName(theme, random);
      const made = generate({ seed: s, theme, size, name: islandName, adventure, defense: defense && !adventure, stage: this.stage });
      this.world = made.world;
      this.critters = new CritterSim(s ^ 0x5bd1e995);
      this.critters.max = maxCritters(this.world);
      for (const c of made.critters) this.critters.add(c.type, c.x, c.y, c.z, null, c.yaw);
      this.settings = cleanSettings(settings);
      this.env = { time: 0.3, weather: 'clear', left: 240 };
      this.rng = new Rng(s ^ 0x27d4eb2d);
      if (made.camps.length) this.adventure = new AdventureSim({ camps: made.camps, stage: this.stage }, s ^ 0x510e527f);
      if (made.defense) this.defense = new DefenseSim(made.defense, s ^ 0x2b992ddf);
    }
    // Never saved: an island opened again starts without any.
    this.monsters = new MonsterSim((this.world.seed ^ 0x7f4a7c15 ^ (t | 0)) >>> 0);
    this.monstersSent = false;
    this.arcade = new ArcadeSim((this.world.seed ^ 0x5a7d3b1f ^ (t | 0)) >>> 0);
    this.hookWorld();
  }

  // ------------------------------------------------ the world

  hookWorld() {
    const w = this.world;
    this.counts = { shells: 0, stars: 0 };
    this.growth.clear();
    this.crops.clear();
    this.soil.clear();
    // On a volcano island, water brought to it boils away and ice melts into
    // water that boils away in turn (stepMelts, each tick): what the heat
    // has left to do, by the cell it will do it to.
    this.melts = new Map();
    // Mining bombs placed, by the cell they sit in: the cell, who placed one
    // there, and when it pops (stepBombs).
    this.bombs = new Map();
    // Fires lightning has started (stepStorm), never saved; and when the
    // next strike comes, in a storm. Their own draws, so the weather goes
    // on as before.
    const fireRng = new Rng((w.seed ^ 0x6c8e9cf5) >>> 0);
    this.fires = new Fires(w, () => fireRng.next());
    this.strikeAt = 0;
    const volcano = w.theme === 'volcano';
    for (let x = 0; x < w.W; x++) {
      for (let z = 0; z < w.D; z++) {
        for (let y = 1; y < w.H; y++) {
          const id = w.blocks[w.index(x, y, z)];
          if (id === B.AIR) continue;
          if (id === B.SHELL) this.counts.shells++;
          else if (id === B.STAR_PIECE) this.counts.stars++;
          else if (B.block(id).grows) this.growth.set(w.index(x, y, z), this.now() + this.between(GROW_MS));
          else if (B.CROP_OF[id]) this.planted(x, y, z, id);
          else if (B.SOIL[id]) this.tilled(x, y, z, id);
          // A mining bomb saved before it popped: its fuse burns again, the
          // jewels it shakes loose going to nobody (who laid it is not known).
          else if (id === B.BOMB) this.bombs.set(w.index(x, y, z), { x, y, z, by: 0, at: this.now() + this.between(BOMB_FUSE_MS), next: this.now() });
          else if (volcano && id === B.WATER) this.melts.set(w.index(x, y, z), { x, y, z, at: this.now() + this.between(BOIL_MS), to: B.AIR });
          else if (volcano && id === B.ICE) this.melts.set(w.index(x, y, z), { x, y, z, at: this.now() + this.between(MELT_MS), to: B.WATER });
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
      // A crop planted, picked, or on a stage (which starts it growing
      // afresh), and farmland turned over, watered or dried out.
      if (B.CROP_OF[after]) this.planted(x, y, z, after);
      else if (B.CROP_OF[before]) this.crops.delete(k);
      if (B.SOIL[after]) this.tilled(x, y, z, after);
      else if (B.SOIL[before]) this.soil.delete(k);
      // A drawing board or a picture frame picked up (or painted over): its
      // picture goes with it.
      if (isPictureAt(before) && !isPictureAt(after)) this.drawings.delete(k);
      // An arcade machine picked up (or painted over): its game goes with it.
      if (gameOfBlock(before) && !gameOfBlock(after)) this.arcadeGone(x, y, z);
      // A Go board picked up: its game goes with it.
      if (isGoBoard(before) && !isGoBoard(after) && this.go.removeAt(x, y, z)) this.sendGo();
      // A mining bomb placed starts its fuse, and one taken away (picked up,
      // or built over) stops it.
      if (after === B.BOMB) this.bombs.set(k, { x, y, z, by: this.bombPlacer ?? 0, at: this.now() + this.between(BOMB_FUSE_MS), next: this.now() });
      else if (before === B.BOMB) this.bombs.delete(k);
      // Water or ice put down on a volcano island is not there to stay.
      if (volcano) {
        if (after === B.WATER) this.melts.set(k, { x, y, z, at: this.now() + this.between(BOIL_MS), to: B.AIR });
        else if (after === B.ICE) this.melts.set(k, { x, y, z, at: this.now() + this.between(MELT_MS), to: B.WATER });
        else this.melts.delete(k);
      }
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
    if (this.arcade.left(pid)) this.sendArcade();
    if (this.go.left(pid)) this.sendGo();
    this.hideSeekLeft(pid);
    this.raceLeft(pid);
    p.online = false;
    this.broadcast({ t: 'left', pid });
    if (this.host === pid) this.passHost();
    this.changed();
  }

  passHost() {
    // An island owned by one login has no owner while they are away.
    if (this.ownerWho) {
      this.host = 0;
      this.broadcast({ t: 'host', pid: 0 });
      return;
    }
    const next = this.onlinePlayers().sort((a, b) => a.id - b.id)[0];
    if (!next) return;
    this.host = next.id;
    this.broadcast({ t: 'host', pid: next.id });
    this.tellHost();
    this.dropHalfSong();
  }

  // A song the owner was still sending when someone else became the owner
  // never finishes coming: it goes, and the island music comes back.
  dropHalfSong() {
    // (Its parts are holes until they come, which every() would skip.)
    if (!this.song?.parts.includes(undefined)) return;
    this.song = null;
    this.broadcast({ t: 'song', off: true });
  }

  // Everything of the song that has come so far, for a newcomer.
  sendSong(conn) {
    const s = this.song;
    if (!s) return;
    s.parts.forEach((data, i) => data !== undefined && this.sendTo(conn, { t: 'song', id: s.id, name: s.name, i, n: s.n, data }));
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
      case 'douse':
        this.douse(p, msg);
        break;
      case 'say':
        this.say(conn, c, p, msg);
        break;
      case 'emote':
        if (EMOTE_KEYS.includes(msg.e)) this.broadcast({ t: 'emote', pid, e: msg.e });
        break;
      // A swing at a monster (the 👊 button), for friends to see it start as
      // it does: the bop it lands comes a moment later. A King Punch (a bare
      // fist held to charge) says so, for friends to see the shockwave.
      case 'swing':
        this.broadcast({ t: 'swing', pid, king: msg.king === true ? true : undefined }, conn);
        break;
      // A key played on a piano (piano.js), by someone standing at it, for
      // everyone else to hear from there.
      case 'piano':
        if (!isNote(msg.n) || !Array.isArray(msg.at) || !msg.at.every(Number.isInteger)) break;
        if (!isPiano(this.world.get(...msg.at))) break;
        if (Math.hypot(p.s[0] - msg.at[0] - 0.5, p.s[2] - msg.at[2] - 0.5) > REACH + 1 || Math.abs(p.s[1] - msg.at[1]) > 4) break;
        this.broadcast({ t: 'piano', pid, n: msg.n, at: msg.at }, conn);
        break;
      case 'draw':
        this.draw(conn, p, msg);
        break;
      case 'look': {
        // A new look, and a new name with it when one comes (🎨 Change me while here).
        p.look = cleanLook(msg.look, this.random);
        this.levelHp(p);
        const name = nameOf(msg.name);
        if (name) p.name = this.uniqueName(name, p.id);
        this.broadcast({ t: 'look', pid, look: p.look, name: p.name });
        this.changed();
        break;
      }
      case 'critter':
        this.critterOp(conn, p, msg);
        break;
      case 'pet':
        this.petOp(p, msg);
        break;
      case 'bop':
        this.bop(p, msg);
        break;
      // A Bomb Rod's throw (shop.js bombrod): the bomb lands where the thrower
      // faces, a few steps off, and pops at once.
      case 'bomb':
        this.rodBlast(p, msg);
        break;
      case 'potion':
        this.drank(p);
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
      case 'defend':
        this.defendOp(conn, p, msg);
        break;
      case 'arcade':
        this.arcadeOp(conn, p, msg);
        break;
      case 'hideseek':
        this.hideSeekOp(conn, p, msg);
        break;
      case 'race':
        this.raceOp(conn, p, msg);
        break;
      case 'go':
        this.goOp(conn, p, msg);
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
    // A login's pages say who they are (see main.js), so the same login on
    // another device comes back as the same player instead of a second one.
    const who = isWho(msg.who) ? msg.who : '';
    const known = !p && who ? ([...this.players.values()].find((q) => q.who === who) ?? null) : null;
    if (known && this.kicked.has(known.id)) {
      this.sendTo(conn, { t: 'error', code: 'kicked', text: 'The island owner said goodbye for now.' });
      return;
    }
    // Peer to peer, the page the island lives in cannot be the one replaced.
    if (known && [...this.clients].some(([other, oc]) => oc.pid === known.id && other.hosting)) {
      this.sendTo(conn, { t: 'error', code: 'twice', text: 'You are on this island already, on another device.' });
      return;
    }
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
      if (this.online - (known?.online ? 1 : 0) >= MAX_PLAYERS) {
        this.sendTo(conn, { t: 'error', code: 'full', text: `This island already has ${MAX_PLAYERS} friends on it. Try again later!` });
        return;
      }
      if (this.passcode && this.players.size > 0 && !this.passFits(msg.pass) && !this.passcodeFits(conn, msg.passcode)) return;
      // Only the reconnect token lets someone past the lock or the passcode:
      // a login comes back by who it is once it is let in like anyone else.
      p = known;
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
      p.hp = p.maxHp = hpFor(p);
      p.dizzyUntil = 0;
      p.name = this.uniqueName(wanted, p.id);
      p.ai = msg.ai === true;
    } else {
      const spawn = this.world.spawn;
      p = { id: this.nextPid++, name: this.uniqueName(wanted, 0), look, online: true, s: [spawn.x, spawn.y, spawn.z, 0, 0, 0], ...(who ? { who } : {}), ...(msg.ai === true ? { ai: true } : {}) };
      p.hp = p.maxHp = hpFor(p);
      this.players.set(p.id, p);
      this.prunePlayers();
    }
    if (!token) {
      token = randomToken();
      this.tokens.set(token, p.id);
    }
    if (p.id === this.reservedHost) this.reservedHost = 0;
    // A shared island has no owner: nobody becomes its host, so its rules
    // stay as they are and nobody can close it or passcode it.
    const before = this.host;
    if (this.ownerWho) {
      if (who && who === this.ownerWho) this.host = p.id;
    } else if (!this.shared && (!this.host || (!this.players.get(this.host)?.online && !this.reservedHost))) this.host = p.id;
    this.broadcast({ t: 'joined', player: this.describePlayer(p) });
    // Its owner coming back to it takes it over from whoever had it.
    if (this.ownerWho && this.host !== before) {
      this.broadcast({ t: 'host', pid: this.host }, conn);
      this.dropHalfSong();
    }
    c.pid = p.id;
    c.token = token;
    this.sendWelcome(conn, c);
    this.sendSong(conn);
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
    return { id: p.id, name: p.name, look: p.look, s: p.s, ...((p.dizzyUntil ?? 0) > this.now() ? { dizzy: true } : {}), ...(p.ai ? { ai: true } : {}) };
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
      ...this.hpOf(this.players.get(c.pid)),
      env: this.envMessage(),
      fires: this.fires.pack(),
      chat: this.chat,
      adventure: this.adventure?.describe() ?? null,
      defense: this.defense?.describe(this.monsters) ?? null,
      arcade: this.arcade.pack(this.now()),
      hideseek: this.hideseek.pack(this.now()),
      race: this.raceSim()?.pack(this.now()) ?? null,
      go: this.go.pack(),
      drawings: this.packDrawings(),
      ...(this.screens ? { screens: this.screens } : {}),
      song: this.song ? { id: this.song.id, name: this.song.name } : null,
      // An island everybody owns (the public adventure island).
      shared: this.shared === true,
      // A conquered stage of it: where everyone goes on to (server/adventure.js).
      ...(this.next ? { next: this.next } : {}),
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
    // What only the island puts down (the Monster Gashapon) nobody picks up
    // or builds over: the whole edit is put back as it was.
    let islandOnly = false;
    for (let i = 0; i < cells.length && !islandOnly; i += 4) islandOnly = Boolean(B.BLOCKS[this.world.get(cells[i], cells[i + 1], cells[i + 2])]?.islandOnly);
    if (islandOnly) {
      this.sendTo(conn, { t: 'ack', seq, fix: this.current(cells) });
      return;
    }
    // The shared isle is nobody's to build on: it stays as it was made, for
    // everyone who comes, so nothing is picked up or collected either. So
    // does an island owned by one login (the CTB island), even for its owner.
    if (this.shared || this.ownerWho) {
      this.sendTo(conn, { t: 'ack', seq, fix: this.current(cells) });
      this.notice(conn, `${this.world.name} stays just as it is — no building here!`);
      return;
    }
    // A door swinging open or shut is no build: anyone may bop one, wherever
    // the island's owner lets friends build or not, so nobody is stuck in or
    // out. The halves of a tall door swing together, so a swing may touch the
    // whole vertical run of them — and nothing else may ride along with it.
    const swing = kind === 'door' && cells.length <= this.world.H * 4 && (() => {
      const [fx, , fz] = cells;
      const first = this.world.get(cells[0], cells[1], cells[2]);
      if (!B.DOOR[first]) return false;
      const ys = [];
      for (let i = 0; i < cells.length; i += 4) {
        const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
        if (B.DOOR[id] !== 1 || id !== B.turnedDoor(this.world.get(x, y, z))) return false;
        if (x !== fx || z !== fz || ys.includes(y)) return false;
        if (!B.sameDoor(first, this.world.get(x, y, z))) return false;
        ys.push(y);
      }
      ys.sort((a, b) => a - b);
      return ys.every((y, i) => i === 0 || y === ys[i - 1] + 1);
    })();
    const refused = !swing && this.settings.build === 'host' && p.id !== this.host;
    if (refused || c.cells < n) {
      this.sendTo(conn, { t: 'ack', seq, fix: this.current(cells) });
      this.notice(conn, refused ? 'The island owner is the only builder right now.' : 'Whoa, slow down a little!');
      return;
    }
    // A tower defense island's road, its pads and its towers stay as they are.
    if (this.defense) {
      let road = false;
      for (let i = 0; i < cells.length && !road; i += 4) road = this.defense.protects(cells[i], cells[i + 1], cells[i + 2]);
      if (road) {
        this.sendTo(conn, { t: 'ack', seq, fix: this.current(cells) });
        this.notice(conn, 'The monsters’ road, the tower pads and the Star Stone stay just as they are.');
        return;
      }
    }
    // A desk chair rolling on (game.js scootInSeat) goes all at once or not
    // at all: from one cell and into the next, so a friend's build in the
    // way, or the chair already gone, never leaves it nowhere, or twice over.
    if (kind === 'scoot') {
      let ok = Boolean(expect);
      for (let i = 0; i < cells.length && ok; i += 4) {
        const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
        ok = expect[i / 4] === this.world.get(x, y, z) && !(B.SOLID[id] && this.onlinePlayers().some((q) => q.id !== p.id && cellHitsBody(x, y, z, { x: q.s[0], y: q.s[1], z: q.s[2], radius: BODY.radius, height: BODY.height })));
      }
      if (!ok) {
        this.sendTo(conn, { t: 'ack', seq, fix: this.current(cells) });
        return;
      }
    }
    c.cells -= n;
    // Who is placing this, for a mining bomb's fuse: its blast's jewels go
    // in their basket (stepBombs).
    this.bombPlacer = p.id;
    const others = this.onlinePlayers().filter((q) => q.id !== p.id);
    const applied = [];
    const fix = [];
    for (let i = 0; i < cells.length; i += 4) {
      const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
      const here = this.world.get(x, y, z);
      // The watering can waters what it is tapped at; it is never put down.
      let ok = (!expect || expect[i / 4] === here) && id !== B.WATERING_CAN;
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
    this.bombPlacer = 0;
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
        if (c) this.broadcast({ t: 'cfx', id: c.id, fx: CRITTER_INFO[c.type].vehicle ? 'pet' : c.type === 'clam' ? 'clam' : 'pet', by: p.id, pearl: c.type === 'clam' ? c.pearl : undefined });
        break;
      }
      case 'feed': {
        // Fruit or a vegetable (still `fruit`, as pages from before vegetables send it).
        if (!B.isFood(msg.fruit)) return;
        const c = this.critters.feed(msg.id, p.id, who, now);
        // A vehicle is only honked at.
        if (c) this.broadcast({ t: 'cfx', id: c.id, fx: CRITTER_INFO[c.type].vehicle ? 'pet' : 'yum', by: p.id, fruit: msg.fruit });
        break;
      }
      case 'invite': {
        // A fun park's rides are built with it, not brought.
        // Nor are fireflies: they come out by themselves at night.
        if (!CRITTER_INFO[msg.type] || isFixed(msg.type) || CRITTER_INFO[msg.type].look || ![msg.x, msg.y, msg.z].every(finite)) return;
        // A dragon comes only to those who have tamed a volcano island's
        // dragon often enough (dragon.js TAMES_TO_INVITE: their page keeps
        // count and only sends for one then), and tame: one of your own.
        // The shared isle's toy box stays shut: nothing is brought to it,
        // animal or vehicle — it has everything it means to have.
        if (this.shared) {
          this.notice(conn, `${this.world.name} stays just as it was made, so its toy box stays shut!`, 'info');
          return;
        }
        if (this.critters.animals() >= this.critters.max) {
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
        // in, and big animals, air mounts and land vehicles at the nearest
        // spot with room for them, facing the one who asked for them.
        const info = CRITTER_INFO[msg.type];
        const roomy = info.big || Boolean(info.ride?.air) || info.vehicle === 'land';
        if (info.sea === 'water') at = nearestWater(w, msg.type, x, z);
        if (roomy) at = roomFor(w, msg.type, x, at.y, z);
        if (!at) {
          this.notice(conn, roomy ? needsRoom(msg.type) : NEEDS_WATER[msg.type], 'info');
          return;
        }
        const c = this.critters.add(msg.type, at.x, at.y, at.z, null, info.vehicle || info.wild ? Math.atan2(p.s[0] - at.x, p.s[2] - at.z) : null);
        if (c && info.wild) c.tame = true;
        if (c) this.broadcast({ t: 'cadd', critter: { id: c.id, type: c.type, name: c.name }, s: this.critters.pack().find((r) => r[0] === c.id), by: p.id });
        this.changed();
        break;
      }
      case 'bye': {
        // Nor is anything sent away: what is on the shared isle is
        // everyone's, and it stays with the island.
        if (this.shared) {
          this.notice(conn, `${this.world.name} is everyone’s, so its animals and vehicles stay.`, 'info');
          return;
        }
        const riding = this.critters.get(msg.id);
        if (riding?.rider || riding?.passengers?.some(Boolean)) {
          this.notice(conn, `Someone is riding ${riding.name}! Wait until they get off.`, 'info');
          return;
        }
        // The island's own dragon stays: the volcano island would not be
        // itself without it. (One brought tame from the toy box can go.)
        if (isWild(riding)) {
          this.notice(conn, `${riding.name} the dragon is the island’s own — they stay!`, 'info');
          return;
        }
        // Nor do a fun park's rides, built where they stand.
        if (riding && isFixed(riding.type)) {
          this.notice(conn, `The ${CRITTER_INFO[riding.type].name} is part of the fun park — it stays!`, 'info');
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
        if (!r || c.rider === p.id || c.passengers?.includes(p.id)) return;
        // A wild dragon has to be tamed first (dragon.js), and a tired one
        // (its ride-hearts gone, see stepRides) needs a moment to catch its
        // breath before anyone climbs on again.
        if (!canRide(c)) {
          this.notice(conn, `${c.name} the dragon is wild! Bop it until it is tired out to tame it — and watch out for its fire!`, 'info');
          return;
        }
        if (c.type === 'dragon' && (rideOf(c).restUntil ?? 0) > now) {
          this.notice(conn, `${c.name} is worn out! Let it catch its breath a moment.`, 'info');
          return;
        }
        // With someone driving, the others ride along, in the seats it has;
        // and on a fun park's ride, which nobody drives, everyone does.
        const along = Boolean(c.rider) || isFixed(c.type);
        if (along && !seatsFor(c.type)) {
          this.notice(conn, `Someone is already riding ${c.name}!`, 'info');
          return;
        }
        if (along && !c.passengers.includes(0)) {
          this.notice(conn, `${c.name} is full! Wait for a seat.`, 'info');
          return;
        }
        // The roller coaster's train takes riders on only in the station.
        if (r.coaster && trainAt().phase !== 'station') {
          this.notice(conn, 'The train is out on the track! Wait at the station: it is back soon.', 'info');
          return;
        }
        // Close enough to climb on (with some room for being a little behind).
        if (Math.hypot(c.x - p.s[0], c.z - p.s[2]) > r.radius + 4 || Math.abs(c.y - p.s[1]) > 5) return;
        this.unride(p.id);
        const seat = along ? this.critters.board(c.id, p.id, isFixed(c.type) ? nearestSeats(c, p.s) : null) : 0;
        if (!along) this.critters.ride(c.id, p.id);
        // Up on its back at once, until they say where they are.
        const at = riderAt(c.type, c, seat);
        p.s = [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2), +c.yaw.toFixed(2), p.s[4], p.s[5]];
        this.broadcast({ t: 'ride', id: c.id, pid: p.id, ...(seat ? { seat } : {}) });
        break;
      }
      case 'off':
        this.unride(p.id);
        break;
      case 'hit':
        this.hitDragon(p, msg);
        break;
      case 'fire':
        this.dragonBreath(p, msg);
        break;
      case 'trick': {
        // A spout from the whale, a spray from the elephant's trunk, or a honk.
        // Friends riding along can honk too.
        const c = this.critters.list.find((o) => o.rider === p.id || o.passengers?.includes(p.id));
        const trick = c && CRITTER_INFO[c.type].ride.trick;
        if (trick === 'spout' || trick === 'spray' || trick === 'honk') this.broadcast({ t: 'cfx', id: c.id, fx: trick, by: p.id });
        break;
      }
      default:
        break;
    }
  }

  // Someone petting a player's pet, or giving it a fruit, for everyone to
  // see. Pets are no island's: every page moves them itself (pets.js), so
  // this is all the island hears of them.
  petOp(p, msg) {
    const owner = this.players.get(msg.pid);
    if (!owner?.online || !owner.look?.pet) return;
    if (msg.op === 'feed' && B.isFood(msg.fruit)) this.broadcast({ t: 'pfx', pid: owner.id, by: p.id, fx: 'yum', fruit: msg.fruit });
    else if (msg.op === 'pet') this.broadcast({ t: 'pfx', pid: owner.id, by: p.id, fx: 'pet' });
  }

  // Whatever pid is riding stays where they got off it; a seat they rode
  // along in is free again.
  unride(pid) {
    const p = this.players.get(pid);
    for (const c of this.critters.list) {
      const seat = c.passengers?.indexOf(pid) ?? -1;
      if (seat >= 0) {
        c.passengers[seat] = 0;
        this.broadcast({ t: 'ride', id: c.id, pid: 0, seat: seat + 1 });
      }
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
    if (this.shared) {
      this.notice(conn, 'This island is everyone’s, so nobody is its owner. Everybody is welcome!', 'info');
      return;
    }
    if (p.id !== this.host) {
      this.notice(conn, 'Only the island owner can do that.');
      return;
    }
    switch (msg.cmd) {
      case 'settings': {
        const before = this.settings.day;
        this.settings = cleanSettings(msg.settings, this.settings);
        // Nobody builds on an island owned by one login, whatever the toggle says.
        if (this.ownerWho) this.settings.build = 'host';
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
        if (this.arcade.left(target.id)) this.sendArcade();
        if (this.go.left(target.id)) this.sendGo();
        this.hideSeekLeft(target.id);
        this.raceLeft(target.id);
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
        // An island owned by one login stays theirs.
        if (this.ownerWho) {
          this.notice(conn, 'This island always stays yours.', 'info');
          return;
        }
        this.host = target.id;
        this.broadcast({ t: 'host', pid: target.id });
        this.tellHost();
        this.dropHalfSong();
        break;
      }
      case 'song': {
        // A piece of a new song, passed on to everyone else as it comes, or
        // off: the island music again.
        if (msg.off === true) {
          if (!this.song) return;
          this.song = null;
          this.broadcast({ t: 'song', off: true }, conn);
          return;
        }
        const piece = cleanPiece(msg);
        if (!piece) return;
        if (this.song?.id !== piece.id || this.song.n !== piece.n) this.song = { id: piece.id, name: piece.name, n: piece.n, parts: new Array(piece.n) };
        if (this.song.parts[piece.i] !== undefined) return;
        this.song.parts[piece.i] = piece.data;
        this.broadcast({ t: 'song', ...piece, name: this.song.name }, conn);
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
    // owned: an island owned by one login (the CTB island), that stays just as it is.
    return { ...this.settings, passcode: this.passcode !== '', ...(this.ownerWho ? { owned: true } : {}) };
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
      // The one public adventure island (whoever keeps it sets this, see
      // server/adventure.js): true while it is the one to conquer.
      public: this.public === true,
      // An island anyone may come to straight from a link without logging
      // in (whoever keeps it sets this): the CTB island (server/ctb-office.js).
      ...(this.watchable === true ? { watch: true } : {}),
      // An adventure island: how many camps it has, how many are free, and whether all of it is.
      ...(this.adventure ? { adventure: this.adventure.tally() } : {}),
      // A tower defense island: the wave it is on, of how many, and whether every one is done.
      ...(this.defense ? { defense: this.defense.tally() } : {}),
    };
  }

  // ------------------------------------------------ time

  envMessage() {
    const tw = this.env.twister;
    // A tornado's path comes from its seed; its age says where along it it is.
    return { t: 'env', time: +this.env.time.toFixed(5), weather: this.env.weather, mode: this.settings.day, ...(tw ? { twister: { seed: tw.seed, age: +tw.age.toFixed(2) } } : {}) };
  }

  tick() {
    if (this.closed) return;
    const now = this.now();
    const dt = Math.min(1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    const env = this.env;
    env.time = advanceTime(env.time, dt, this.settings.day);
    env.left -= dt;
    if (env.twister) env.twister.age += dt;
    if (env.left <= 0) {
      const next = nextWeather(env.weather, this.world.theme, () => this.rng.next());
      env.weather = next.weather;
      env.left = next.seconds;
      // Each tornado a path of its own (no draw of the rng of its own, so
      // the weather after it comes out as before).
      env.twister = next.weather === 'tornado' ? { seed: Math.floor(next.seconds * 1e6) >>> 0, age: 0 } : null;
      this.broadcast(this.envMessage());
      this.envSentAt = now;
    } else if (now - this.envSentAt >= ENV_MS) {
      this.broadcast(this.envMessage());
      this.envSentAt = now;
    }

    const where = new Map();
    for (const p of this.players.values()) {
      if (p.online) where.set(p.id, { x: p.s[0], y: p.s[1], z: p.s[2], yaw: p.s[3], anim: p.s[4], flying: (p.s[5] & 1) === 1, hat: p.look?.hat, hair: lookHair(p.look), tall: lookTall(p.look) });
    }
    this.stepFireflies(isNight(env.time));
    this.critters.step(this.world, dt, now, where, isNight(env.time));
    // A wave with nobody left to see it goes home, to come again on Start.
    if (this.defense?.marching && this.online === 0) this.popAll(this.defense.stop(this.monsters));
    if (this.settings.monsters || this.adventure?.active || this.defense?.marching) this.stepMonsters(dt, now, where);
    this.stepDragons(now, where);
    // The Monster Gashapon only ever turns up on the shared isle, Adventure Isle.
    if (this.adventure && this.shared) for (const news of this.adventure.stepGasha(this.world, now, [...where].map(([id, w]) => ({ id, ...w })))) this.gashaNews(news);
    this.keepApart(where);
    // The volcano's own dangers and chores: lava burns whoever stands in it,
    // water boils away and ice melts, and HP comes back whatever took it.
    this.stepLava(now);
    this.stepStorm(now);
    this.stepMelts(now);
    this.stepRides(now);
    this.healUp(now);
    // A round of hide and seek, as it goes.
    if (this.hideseek.round) {
      for (const fx of this.hideseek.step(this.world, now, where)) this.broadcast({ t: 'hsfx', ...fx });
      this.sendHideSeek();
    }
    // A race round a racing island's track, as it goes.
    if (this.race?.round) {
      const drivers = new Set(this.critters.list.filter((c) => c.type === 'kart' && c.rider).map((c) => c.rider));
      for (const fx of this.race.step(now, dt, where, drivers)) this.broadcast({ t: 'rcfx', ...fx });
      this.sendRace();
    }
    // The games at the arcade machines, as they go.
    if (this.arcade.sessions.size) {
      for (const fx of this.arcade.step(now)) this.broadcast({ t: 'arcfx', ...fx });
      this.sendArcade();
    }
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
      // The wave, the Star Stone's hearts, the bricks and the towers, as they change.
      if (this.defense) this.sendDefense();
    }

    this.grow(now);
    this.farm(now);
    this.nature(now);
    this.stepBombs(now);
  }

  // The fireflies: the host lets a few out over the flowers at dusk and
  // sees them all home again at dawn, telling everyone, so an island's
  // night has the same little lights for everybody in it.
  stepFireflies(night) {
    if (night === this.firefliesNight) return;
    this.firefliesNight = night;
    const w = this.world;
    if (!night) {
      for (const id of this.fireflies.splice(0)) {
        const c = this.critters.remove(id);
        if (c) this.broadcast({ t: 'cdel', id: c.id, by: 0 });
      }
      return;
    }
    // Over a flower first, or over open grass where there are none; low,
    // so the glow stays near the ground.
    const flowerTop = (x, z) => {
      const h = w.top(x, z);
      return h >= 0 && FLOWERS.has(w.get(x, h + 1, z)) ? h : -1;
    };
    for (let n = 0; n < MAX_FIREFLIES; n++) {
      let at = null;
      for (let tries = 0; tries < 60 && !at; tries++) {
        const x = this.rng.int(2, w.W - 3);
        const z = this.rng.int(2, w.D - 3);
        const h = tries < 40 ? flowerTop(x, z) : w.top(x, z);
        if (h < 1 || w.get(x, h, z) !== B.GRASS) continue;
        if (w.get(x, h + 1, z) !== B.AIR && B.KIND[w.get(x, h + 1, z)] !== B.K_PLANT) continue;
        at = [x + 0.5, h + 1 + 0.6 + this.rng.range(0, 0.4), z + 0.5];
      }
      if (!at) break;
      const c = this.critters.add('firefly', at[0], at[1], at[2]);
      if (c) {
        this.fireflies.push(c.id);
        this.broadcast({ t: 'cadd', critter: { id: c.id, type: c.type, name: c.name }, s: this.critters.pack().find((r) => r[0] === c.id), by: 0 });
      }
    }
  }

  // Animals and monsters that walked into someone, or into each other, step
  // back out. Players keep out of everything themselves, each on their own
  // page; someone riding is up on what they ride, which counts for them.
  keepApart(where) {
    const riding = this.critters.aboard();
    const people = [];
    for (const [id, w] of where) if (!riding.has(id)) people.push({ x: w.x, y: w.y, z: w.z, radius: BODY.radius, height: BODY.height, key: `p${id}` });
    this.critters.keepApart(this.world, [...people, ...this.monsters.boxes()]);
    if (this.monsters.list.length) this.monsters.keepApart(this.world, [...people, ...this.critters.boxes()]);
  }

  // ------------------------------------------------ monsters

  stepMonsters(dt, now, where) {
    // Dizzy for too long, with no friend to help: back to the nearest safe
    // place — before the monsters move, so nothing bumps them at the very
    // moment they come round.
    for (const p of this.players.values()) {
      if (p.online && p.dizzyUntil && now >= p.dizzyUntil) this.sendHome(p, now);
    }
    const riding = this.critters.aboard();
    const people = [];
    for (const [id, w] of where) {
      const p = this.players.get(id);
      // Someone on a dragon's back is fair game, as the dragon under them:
      // a bump there takes its hearts (see hurt), never theirs.
      const dragon = this.dragonUnder(id);
      if (dragon) {
        people.push({ id, x: dragon.x, y: dragon.y, z: dragon.z, flying: w.flying, riding: false, mount: CRITTER_INFO.dragon.ride.radius, safeUntil: 0, dizzy: false });
        continue;
      }
      people.push({ id, x: w.x, y: w.y, z: w.z, flying: w.flying, riding: riding.has(id), safeUntil: p.safeUntil ?? 0, dizzy: (p.dizzyUntil ?? 0) > now });
    }
    const adv = this.adventure;
    if (adv?.active) for (const news of adv.step(this.world, dt, now, people, this.monsters, this.online)) this.campFreed(news);
    const bumps = this.monsters.step(this.world, dt, now, people, isNight(this.env.time), { roam: this.settings.monsters, havens: adv?.havens(this.world), camps: adv });
    for (const m of this.monsters.takeGone()) adv?.guardGone(m, now);
    // The Queen Mosquito getting a heart back (monsters.js step): everyone
    // near sees the little hearts over her.
    const healed = this.monsters.takeHealed();
    if (healed.length) this.broadcast({ t: 'mheal', m: healed });
    // A Lava Ghost's breath of fire: the jet everyone sees, and whoever it
    // burned, with Knight Armor or a Fire Suit taking half of it.
    for (const m of this.monsters.takeFires()) this.broadcast({ t: 'mfire', id: m.id, yaw: +m.yaw.toFixed(3), ms: GHOST_FIRE.ms });
    for (const { monster: m, pid } of this.monsters.takeBurns()) {
      const p = this.players.get(pid);
      if (!p) continue;
      const half = hasPower(p.look, 'armor') || hasPower(p.look, 'fireproof');
      this.knock(p, now, hpAfterBump(p.hp, half ? GHOST_FIRE.bumps / 2 : GHOST_FIRE.bumps), { t: 'bump', pid, id: m.id, fire: true, ghost: true, x: +m.body.x.toFixed(2), z: +m.body.z.toFixed(2) });
    }
    if (this.defense) this.stepDefense(now);
    for (const { monster, pid } of bumps) this.hurt(pid, monster, now);
    // Mr. Mole coming up out of the ground beside someone: a burst of dirt
    // everyone sees, and his little grunt of arrival.
    for (const u of this.monsters.takeUps()) {
      this.broadcast({ t: 'mfx', kind: 'dirt', id: u.monster.id, x: +u.x.toFixed(2), y: +u.y.toFixed(2), z: +u.z.toFixed(2) });
    }
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
  }

  // A monster bumped into someone (stomp: King Grumble's landing knocked
  // them over): some HP gone, and all that follows (see knock).
  hurt(pid, monster, now, stomp = false) {
    const p = this.players.get(pid);
    if (!p) return;
    const dragon = this.dragonUnder(pid);
    if (dragon) {
      this.bumpRide(dragon, monster.kind === 'king' ? 1 : kindOf(monster.kind).bump, now);
      return;
    }
    const b = monster.body;
    const msg = { t: 'bump', pid, id: monster.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2) };
    if (isHeavy(monster.kind)) msg.big = true;
    if (monster.kind === 'spiky') msg.spiky = true;
    if (stomp) msg.stomp = true;
    const bumps = monster.kind === 'king' ? 1 : kindOf(monster.kind).bump;
    // Knight Armor (shop.js CLOTHES) takes half of it.
    this.knock(p, now, hpAfterBump(p.hp, hasPower(p.look, 'armor') ? bumps / 2 : bumps), msg);
  }

  // HP off someone, by whatever took it — a monster's bump, King Grumble's
  // stomp, the lava — with the safe moment after, and with none left, they
  // sit dizzy where they are on an adventure island while a friend there
  // could come and help them up; otherwise back they go to the nearest safe
  // place, with all their HP again. The message says what happened.
  knock(p, now, hp, msg) {
    p.hp = hp;
    p.bumpAt = now;
    p.healAt = now;
    p.safeUntil = now + SAFE_MS;
    Object.assign(msg, this.hpOf(p), { home: false });
    if (p.hp === 0) {
      if (this.adventure && this.helperFor(p.id, now)) {
        p.dizzyUntil = now + DIZZY_MS;
        msg.dizzy = true;
      } else {
        const at = this.goHome(p, now);
        Object.assign(msg, { home: true, ...this.hpOf(p), at });
      }
    }
    this.broadcast(msg);
  }

  // The wild dragons' fights (dragon.js): waking, the fire they breathe and
  // whoever it burns, and going back to sleep or wild again. What it does
  // as it goes shows in the animals' states (critters.js pack); each breath
  // and its burns are told as they come.
  stepDragons(now, where) {
    if (!this.online || !this.critters.list.some(isWild)) return;
    const riding = this.critters.aboard();
    const people = [];
    for (const [id, w] of where) {
      const p = this.players.get(id);
      people.push({ id, x: w.x, y: w.y, z: w.z, riding: riding.has(id), dizzy: (p.dizzyUntil ?? 0) > now, sheltered: underTent(this.world, w.x, w.y, w.z) });
    }
    const news = stepDragons(this.critters, people, now);
    for (const c of news.woke) this.broadcast({ t: 'dragon', id: c.id, fx: 'wake' });
    for (const { c, yaw } of news.fires) this.broadcast({ t: 'dragon', id: c.id, fx: 'fire', yaw: +yaw.toFixed(3), ms: FIRE.ms });
    for (const { c, pid } of news.burns) {
      const p = this.players.get(pid);
      if (!p || now < (p.safeUntil ?? 0)) continue;
      // Knight Armor or a Fire Suit (shop.js CLOTHES) takes half of it.
      const half = hasPower(p.look, 'armor') || hasPower(p.look, 'fireproof');
      this.knock(p, now, hpAfterBump(p.hp, half ? FIRE.bumps / 2 : FIRE.bumps), { t: 'bump', pid, id: c.id, fire: true, x: +c.x.toFixed(2), z: +c.z.toFixed(2) });
    }
    for (const c of news.slept) this.broadcast({ t: 'dragon', id: c.id, fx: 'sleep' });
    for (const c of news.wild) this.broadcast({ t: 'dragon', id: c.id, fx: 'wild' });
  }

  // Fire, at its rider's word: a tame dragon with someone on its back
  // breathes a short burst ahead of it (dragon.js RIDE_FIRE), at most about
  // once a second — the same flames a wild one pours, and every monster in
  // them takes one bop (the rider's, so it counts for them). A tired dragon
  // (its ride-hearts gone, see the bumps below) does nothing at all.
  dragonBreath(p, msg) {
    const c = this.critters.get(msg.id);
    if (!c || c.type !== 'dragon' || c.rider !== p.id || !canRide(c)) return;
    const now = this.now();
    const ride = rideOf(c);
    if ((ride.restUntil ?? 0) > now || now - ride.breathAt < RIDE_FIRE.every) return;
    ride.breathAt = now;
    this.broadcast({ t: 'dragon', id: c.id, fx: 'fire', yaw: +c.yaw.toFixed(3), ms: RIDE_FIRE.ms });
    // The monsters in the flames: each a heart off (the wild fire's reach and
    // cone, dragon.js inFlames), and pop with the last — told as any bop is.
    for (const m of [...this.monsters.list]) {
      // Mr. Mole under the ground: no fire reaches him there.
      if (m.under) continue;
      if (m.march) {
        if (this.inFlamesOf(c, m.body)) this.bopMarcher(p, m, now, 1);
        continue;
      }
      if (m.kind === 'king') {
        if (this.inFlamesOf(c, m.body)) this.bopKing(p, m, now, 1);
        continue;
      }
      if (!this.inFlamesOf(c, m.body)) continue;
      const hit = this.monsters.hit(m, p.id, { x: c.x, y: c.y, z: c.z }, now, 1);
      if (hit.wait) continue;
      if (hit.hearts) {
        this.broadcast({ t: 'mhit', id: m.id, by: p.id, hearts: hit.hearts });
        continue;
      }
      this.monsters.remove(m.id);
      const b = m.body;
      this.broadcast({ t: 'pop', id: m.id, by: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
      if (m.camp) this.adventure?.guardGone(m, now);
    }
  }

  // Whether a monster's body stands in the flames a dragon breathes from
  // where it is (its middle, facing the way it faces).
  inFlamesOf(c, b) {
    return inFlames({ x: c.x, y: c.y, z: c.z }, c.yaw, b.x, b.y + b.height / 2, b.z);
  }

  // A bop at a wild dragon, from as far as an arm (or the toy weapon in it)
  // reaches: hearts off it, and with the last it is tame, and everyone who
  // bopped it in that fight has tamed it (their pages count it).
  hitDragon(p, msg) {
    const c = this.critters.get(msg.id);
    const now = this.now();
    if (!isWild(c) || (p.dizzyUntil ?? 0) > now || this.critters.aboard().has(p.id)) return;
    const weapon = weaponOf(p.look?.weapon);
    const r = CRITTER_INFO.dragon.ride;
    const at = { x: p.s[0], y: p.s[1], z: p.s[2] };
    if (bopGap(at, { x: c.x, y: c.y, z: c.z, radius: r.radius, height: r.height }, ARM_REACH + (weapon?.reach ?? 0) + BOP_SLACK) === null) return;
    const hit = hitDragon(c, p.id, now, weapon?.power ?? 1);
    if (!hit || hit.wait) return;
    this.broadcast({ t: 'dhit', id: c.id, by: p.id, hearts: hit.hearts, max: hit.max });
    if (hit.tamed) {
      for (const q of this.players.values()) if (q.online && q.hp < q.maxHp && hit.fighters.includes(q.id)) this.allWellFor(q);
      this.broadcast({ t: 'tamed', id: c.id, by: hit.fighters, hero: p.id, name: c.name });
    }
  }

  // All HP back for one player who just won a fight.
  allWellFor(q) {
    q.hp = q.maxHp;
    this.sendToPid(q.id, { t: 'hp', ...this.hpOf(q) });
  }

  // Lava burns: standing in it takes twice a monster bump's HP off, again
  // and again while you stay in it, each hit as far apart as a bump. Riding
  // anything — the dragon, say — you are up out of it and safe, and so is
  // anyone in a Fire Suit (shop.js CLOTHES).
  stepLava(now) {
    if (this.world.theme !== 'volcano') return;
    const riding = this.critters.aboard();
    for (const p of this.players.values()) {
      if (!p.online || riding.has(p.id) || (p.dizzyUntil ?? 0) > now || now < (p.safeUntil ?? 0) || hasPower(p.look, 'fireproof')) continue;
      const s = p.s;
      if (this.world.get(Math.floor(s[0]), Math.floor(s[1] + 0.5), Math.floor(s[2])) !== B.LAVA) continue;
      this.knock(p, now, hpAfterBump(p.hp, LAVA_BUMPS), { t: 'bump', pid: p.id, lava: true });
    }
  }

  // A thunderstorm's lightning, and the fires it starts (fire.js). Every few
  // seconds a bolt strikes the highest of a few spots on the island, which
  // everyone sees and hears in the same place; what it hits may catch fire,
  // and fire spreads to what burns next to it, burning it away, and burns
  // whoever stands in it (not in a Fire Suit, nor up on a ride).
  stepStorm(now) {
    if (this.env.weather === 'storm') {
      if (!this.strikeAt) this.strikeAt = now + this.fireBetween(BLAZE.strikeMs);
      if (now >= this.strikeAt) {
        this.strikeAt = now + this.fireBetween(BLAZE.strikeMs);
        const spot = strikeSpot(this.world, this.fires.random);
        if (spot) {
          const caught = this.fires.random() < BLAZE.catches && this.fires.ignite(spot.x, spot.y, spot.z, now);
          this.broadcast({ t: 'strike', x: spot.x, y: spot.y, z: spot.z, fire: caught });
        }
      }
    } else this.strikeAt = 0;
    if (!this.fires.list.size) return;
    const { on, off, burnt } = this.fires.step(now, isRaining(this.env.weather));
    if (burnt.length) {
      const cells = [];
      for (let i = 0; i < burnt.length; i += 4) {
        const [x, y, z, id] = burnt.slice(i, i + 4);
        if (this.world.get(x, y, z) === id) continue;
        this.world.set(x, y, z, id);
        cells.push(x, y, z, id);
      }
      if (cells.length) {
        this.broadcast({ t: 'edit', by: 0, kind: 'nature', cells });
        this.changed();
      }
    }
    if (on.length || off.length) this.broadcast({ t: 'fire', on, off });
    const riding = this.critters.aboard();
    for (const p of this.players.values()) {
      if (!p.online || riding.has(p.id) || (p.dizzyUntil ?? 0) > now || now < (p.safeUntil ?? 0) || hasPower(p.look, 'fireproof')) continue;
      if (!this.fires.burning(p.s[0], p.s[1], p.s[2])) continue;
      this.knock(p, now, hpAfterBump(p.hp, BLAZE.bumps), { t: 'bump', pid: p.id, burn: true });
    }
  }

  fireBetween([lo, hi]) {
    return lo + this.fires.random() * (hi - lo);
  }

  // The watering can tapped at (x, y, z): any fire round there goes out.
  douse(p, msg) {
    if (!p || ![msg.x, msg.y, msg.z].every(finite)) return;
    // Only within reach of where they stand.
    if (Math.hypot(msg.x - p.s[0], msg.y - p.s[1], msg.z - p.s[2]) > 12) return;
    const off = this.fires.douse(msg.x, msg.y, msg.z);
    if (off.length) this.broadcast({ t: 'fire', on: [], off, by: p.id });
  }

  // The tame dragon someone is riding, and can still ride, or null.
  dragonUnder(pid) {
    for (const c of this.critters.list) {
      if (c.rider === pid) return c.type === 'dragon' && canRide(c) && !(rideOf(c).restUntil > this.now()) ? c : null;
    }
    return null;
  }

  // A monster bumped into a ridden dragon (hurt): bumps of its hearts off
  // (the rider's HP never, they are safe up on its back), not too often, and
  // with none left the rider is set down beside it, unhurt, while the dragon
  // rests, too tired to ride, for a short while.
  bumpRide(c, bumps, now) {
    const ride = rideOf(c);
    if (now - ride.bumpAt < RIDE_BUMP_MS) return;
    ride.hearts = Math.max(0, ride.hearts - bumps * BUMP_HP);
    ride.bumpAt = now;
    ride.healAt = now;
    if (ride.hearts) {
      this.broadcast({ t: 'chearts', id: c.id, hearts: ride.hearts, max: ride.max });
      return;
    }
    ride.restUntil = now + RIDE_REST_MS;
    this.unride(c.rider);
    this.broadcast({ t: 'chearts', id: c.id, hearts: 0, max: ride.max, rest: RIDE_REST_MS });
  }

  // The tame dragons being ridden, as they go: their hearts come back by
  // themselves once no monster has been near for a while, and one resting
  // (see bumpRide) has all of them back when its rest is over.
  stepRides(now) {
    for (const c of this.critters.list) {
      // Only a rideable dragon has ride-hearts (a wild one's fight has its own).
      if (c.type !== 'dragon' || !c.ride || !canRide(c)) continue;
      const ride = c.ride;
      if (ride.restUntil) {
        if (now < ride.restUntil) continue;
        ride.restUntil = 0;
        ride.hearts = ride.max;
        ride.healAt = now;
        this.broadcast({ t: 'chearts', id: c.id, hearts: ride.hearts, max: ride.max });
        continue;
      }
      // No monster near for a while: a heart back, again and again until full.
      if (ride.hearts >= ride.max) continue;
      const near = this.monsters.list.some((m) => !m.march && Math.hypot(m.body.x - c.x, m.body.z - c.z) < RIDE_HEAL_NEAR);
      if (near || now - ride.healAt < RIDE_HEAL_MS) continue;
      ride.hearts++;
      ride.healAt = now;
      this.broadcast({ t: 'chearts', id: c.id, hearts: ride.hearts, max: ride.max });
    }
  }

  // Water boils away on a volcano island, and ice melts into water that
  // boils away in turn (see hookWorld for what is queued, and when): a
  // little at a time, as one edit everyone sees, so no one cell pops on its
  // own. What somebody has changed by hand since is left alone.
  stepMelts(now) {
    if (!this.melts.size) return;
    const cells = [];
    for (const [k, m] of this.melts) {
      if (m.at > now) continue;
      this.melts.delete(k);
      const id = this.world.get(m.x, m.y, m.z);
      if (id !== (m.to === B.WATER ? B.ICE : B.WATER)) continue;
      this.world.set(m.x, m.y, m.z, m.to);
      cells.push(m.x, m.y, m.z, m.to);
    }
    if (cells.length) {
      this.broadcast({ t: 'edit', by: 0, kind: 'nature', cells });
      this.changed();
    }
  }

  // HP comes back by itself, whatever took it: 20 every six seconds that
  // nothing has, for everyone in, sent to them alone.
  healUp(now) {
    for (const p of this.players.values()) {
      if (!p.online) continue;
      if (p.hp >= p.maxHp || p.dizzyUntil) continue;
      const hp = hpBack(p.hp, p.maxHp, now - Math.max(p.bumpAt ?? 0, p.healAt ?? 0));
      if (hp === p.hp) continue;
      p.hp = hp;
      p.healAt = now;
      this.sendToPid(p.id, { t: 'hp', ...this.hpOf(p) });
    }
  }

  // Whether anyone else on the island could help someone up (nobody dizzy too).
  helperFor(pid, now) {
    for (const q of this.players.values()) if (q.online && q.id !== pid && !((q.dizzyUntil ?? 0) > now)) return true;
    return false;
  }

  // Back to the nearest safe place (the start, or a camp freed), safe, with
  // all their HP again. Returns where, as [x, y, z].
  goHome(p, now) {
    const at = this.adventure ? this.adventure.homeFor(this.world, p.s[0], p.s[2]) : this.world.spawn;
    p.hp = p.maxHp;
    p.dizzyUntil = 0;
    p.healAt = now;
    p.safeUntil = now + SAFE_MS;
    p.s = [at.x, at.y, at.z, p.s[3], 0, 0];
    return [at.x, at.y, at.z];
  }

  sendHome(p, now) {
    const at = this.goHome(p, now);
    this.broadcast({ t: 'home', pid: p.id, at, ...this.hpOf(p) });
  }

  // A friend tapping someone sitting dizzy, from beside them: up they get,
  // with some of their HP.
  help(p, msg) {
    const now = this.now();
    const q = this.players.get(msg.pid);
    if (!q?.online || q === p || !((q.dizzyUntil ?? 0) > now) || (p.dizzyUntil ?? 0) > now) return;
    if (Math.hypot(q.s[0] - p.s[0], q.s[1] - p.s[1], q.s[2] - p.s[2]) > HELP_REACH + 1.5) return;
    Object.assign(q, { dizzyUntil: 0, hp: helpHp(q.maxHp), bumpAt: now, healAt: now, safeUntil: now + SAFE_MS * 2 });
    this.broadcast({ t: 'helped', pid: q.id, by: p.id, ...this.hpOf(q) });
  }

  // An HP potion drunk (shop.js, one out of the drinker's pocket at their
  // end): all their HP back at once, and up on their own if they were the
  // one sitting dizzy. With none missing, there is nothing to drink for.
  drank(p) {
    const now = this.now();
    const dizzy = (p.dizzyUntil ?? 0) > now;
    if (p.hp >= p.maxHp && !dizzy) return;
    p.hp = p.maxHp;
    p.dizzyUntil = 0;
    p.healAt = now;
    p.safeUntil = Math.max(p.safeUntil ?? 0, now + SAFE_MS);
    this.broadcast({ t: 'healed', pid: p.id, ...this.hpOf(p) });
  }

  // Jumping on a monster (msg.on): pop! Tapping one: a heart off it (more,
  // and from further, with a toy weapon in hand), and pop with the last.
  // (King Grumble takes a lot of either, a Big Bruiser a few landings, and
  // a Spiky is not landed on at all: see MonsterSim.step.)
  bop(p, msg) {
    if (!Number.isInteger(msg.id)) return;
    const now = this.now();
    const m = this.monsters.get(msg.id);
    if (!m || (!m.camp && !m.march && !this.settings.monsters) || (p.dizzyUntil ?? 0) > now) return;
    // A King Punch (a bare fist held to charge, game.js): only with an empty
    // hand, and it reaches further round a wider arc. HP and XP are as a punch.
    const king = msg.king === true && !weaponOf(p.look?.weapon);
    const at = { x: p.s[0], y: p.s[1], z: p.s[2] };
    const landed = msg.on === true && this.monsters.landsOn(m.id, at);
    const weapon = weaponOf(p.look?.weapon);
    if (!landed && !this.monsters.canBop(m.id, at, king ? KING_REACH : weapon?.reach ?? 0)) return;
    if (m.march) {
      this.bopMarcher(p, m, now, landed ? LAND_POWER : m.kind === 'king' ? (weapon?.king ?? 1) : (weapon?.power ?? 1));
      return;
    }
    if (m.kind === 'king') {
      this.bopKing(p, m, now, weapon?.king ?? 1);
      return;
    }
    const land = kindOf(m.kind).land;
    if (landed && !land) return;
    if (!landed || land !== Infinity) {
      const hit = this.monsters.hit(m, p.id, at, now, landed ? land : (weapon?.power ?? 1), king ? KING_PUSH : undefined);
      if (hit.wait) return;
      if (hit.hearts) {
        this.broadcast({ t: 'mhit', id: m.id, by: p.id, hearts: hit.hearts });
        return;
      }
    }
    this.monsters.remove(m.id);
    const b = m.body;
    this.broadcast({ t: 'pop', id: m.id, by: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    if (m.camp) this.adventure?.guardGone(m, now);
  }

  // A monster marching on a tower defense island tapped (or landed on):
  // power hearts off it, and with the last it goes pop, with bricks for it.
  bopMarcher(p, m, now, power) {
    const hit = this.defense?.tap(m, p.id, now, power);
    if (!hit || hit.wait) return;
    if (hit.hearts) {
      this.broadcast({ t: 'mhit', id: m.id, by: p.id, hearts: hit.hearts, march: true });
      return;
    }
    this.defense.popped(m, this.monsters);
    const b = m.body;
    this.broadcast({ t: 'pop', id: m.id, by: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    this.sendDefense();
  }

  // A Bomb Rod thrown (shop.js bombrod): the small bomb pops where it lands,
  // a few steps off, bopping every monster caught in its blast — the thrower's
  // bops, as any swing of theirs is — and shaking the jewels out of any gem
  // rocks there into their basket (tools.js gemBlastEdit). The ground is never
  // dug, and nothing anyone built, planted or furnished is ever broken.
  rodBlast(p, msg) {
    const now = this.now();
    if ((p.dizzyUntil ?? 0) > now || weaponOf(p.look?.weapon)?.key !== 'bombrod') return;
    // Where it pops: a few steps the way they face, no further than the rod
    // throws, on the ground there (or in it, so a blast against a wall still
    // catches the gem rocks in the wall).
    const fx = Math.sin(p.s[3] ?? 0);
    const fz = Math.cos(p.s[3] ?? 0);
    const dist = Math.min(ROD_RANGE, Math.max(0, +msg.d || 0));
    const x = Math.floor(p.s[0] + fx * dist);
    const z = Math.floor(p.s[2] + fz * dist);
    const y = Math.floor(p.s[1] + 0.5);
    if (!this.world.inBounds(x, y, z)) return;
    // Friends see the bomb lobbed from the thrower's hand, arcing down to it.
    this.broadcast({ t: 'fx', kind: 'lob', pid: p.id, x: +p.s[0].toFixed(2), y: +(p.s[1] + 1).toFixed(2), z: +p.s[2].toFixed(2), tx: x + 0.5, tz: z + 0.5 });
    // The monsters in the blast: each takes a bop of the thrower's.
    for (const m of [...this.monsters.list]) {
      if (m.under) continue;
      const b = m.body;
      if (Math.hypot(b.x - x - 0.5, b.z - z - 0.5) > ROD_BLAST + b.radius) continue;
      if (b.y > y + ROD_BLAST + 1 || b.y + b.height < y - ROD_BLAST) continue;
      if (m.march) {
        this.bopMarcher(p, m, now, weaponOf('bombrod').power);
        continue;
      }
      if (m.kind === 'king') {
        this.bopKing(p, m, now, weaponOf('bombrod').king);
        continue;
      }
      const hit = this.monsters.hit(m, p.id, { x: p.s[0], y: p.s[1], z: p.s[2] }, now, weaponOf('bombrod').power);
      if (hit.wait) continue;
      if (hit.hearts) {
        this.broadcast({ t: 'mhit', id: m.id, by: p.id, hearts: hit.hearts });
        continue;
      }
      this.monsters.remove(m.id);
      this.broadcast({ t: 'pop', id: m.id, by: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
      if (m.camp) this.adventure?.guardGone(m, now);
    }
    // The gem rocks caught in it: their jewels, and the boom everyone hears.
    const plan = gemBlastEdit(this.world, x, y, z);
    if (plan.cells.length) {
      for (let i = 0; i < plan.cells.length; i += 4) this.world.set(plan.cells[i], plan.cells[i + 1], plan.cells[i + 2], plan.cells[i + 3]);
      this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'pick', cells: plan.cells });
      this.changed();
    }
    this.broadcast({ t: 'fx', kind: 'blast', x: x + 0.5, y: y + 0.5, z: z + 0.5, by: p.id, gems: plan.collected });
  }

  // ------------------------------------------------ tower defense

  // Start pressed, or a tower built on a pad (or made bigger) by someone
  // standing by it. Anyone on the island can do either.
  defendOp(conn, p, msg) {
    const def = this.defense;
    if (!def) return;
    const now = this.now();
    if (msg.cmd === 'start') {
      if (!def.start(now, this.online)) return;
      this.broadcast({ t: 'dwave', k: 'start', wave: def.wave, by: p.id });
      this.sendDefense();
      return;
    }
    if (msg.cmd !== 'build' || !Number.isInteger(msg.pad)) return;
    const pad = def.padById(msg.pad);
    if (!pad || Math.hypot(p.s[0] - pad.x, p.s[2] - pad.z) > BUILD_REACH + 1 || Math.abs(p.s[1] - pad.y) > 4) return;
    const made = def.build(pad.id);
    if (made.no) {
      if (made.no === 'bricks') this.notice(conn, `That takes 🧱 ${made.cost} bricks. Pop monsters to get more!`);
      return;
    }
    // Over anyone standing there, it goes up anyway (their page lifts them out of it).
    const cells = made.cells;
    for (let i = 0; i < cells.length; i += 4) this.world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
    this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'nature', cells });
    this.broadcast({ t: 'tower', pad: pad.id, level: made.level, by: p.id });
    this.sendDefense();
    this.changed();
  }

  // The wave moving on (after the monsters have): towers' bubbles, monsters
  // popped by them or getting to the Star Stone, and the wave done or lost.
  stepDefense(now) {
    const def = this.defense;
    const zaps = [];
    for (const n of def.step(this.world, now, this.monsters)) {
      const b = n.monster?.body;
      switch (n.t) {
        case 'zap':
          zaps.push([n.pad.id, n.monster.id, n.hearts]);
          break;
        case 'pop':
          this.broadcast({ t: 'pop', id: n.monster.id, by: 0, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
          break;
        case 'leak':
          this.broadcast({ t: 'leak', id: n.monster.id, hearts: n.hearts, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
          break;
        case 'lost':
          this.popAll(n.gone);
          this.broadcast({ t: 'dwave', k: 'lost', wave: n.wave });
          break;
        case 'clear':
          this.broadcast({ t: 'dwave', k: 'clear', wave: n.wave, bricks: n.bricks, won: n.won, by: this.onlinePlayers().map((q) => q.id) });
          this.changed();
          break;
        default:
          break;
      }
    }
    if (zaps.length) this.broadcast({ t: 'zap', z: zaps });
    if (zaps.length) this.sendDefense();
  }

  // Monsters gone home all at once (by: nobody), each with a pop.
  popAll(gone) {
    for (const m of gone) {
      const b = m.body;
      this.broadcast({ t: 'pop', id: m.id, by: 0, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    }
  }

  // The defense as it is now, to everyone, when anything in it changed.
  sendDefense() {
    const pack = this.defense.pack(this.monsters);
    const text = JSON.stringify(pack);
    if (text === this.defSent) return;
    this.defSent = text;
    this.broadcast({ t: 'def', ...pack });
  }

  // ------------------------------------------------ the video arcade

  // Play pressed at an arcade machine, a bop at a blob, or a card turned
  // over: anyone standing near the machine it is at (leaving it, from
  // wherever they have got to). The games themselves run along in tick, and
  // what each of these did is told to everyone in the 'arc' that follows
  // (and at once, for a bop or a pair, in 'arcfx').
  arcadeOp(conn, p, msg) {
    if (msg.op === 'leave') {
      if (this.arcade.left(p.id)) this.sendArcade();
      return;
    }
    if (![msg.x, msg.y, msg.z].every(Number.isInteger)) return;
    const game = gameOfBlock(this.world.get(msg.x, msg.y, msg.z));
    if (!game) return;
    const now = this.now();
    if (Math.hypot(p.s[0] - msg.x - 0.5, p.s[2] - msg.z - 0.5) > REACH + 1 || Math.abs(p.s[1] - msg.y) > 4) return;
    const key = keyOf(msg.x, msg.y, msg.z);
    if (msg.op === 'play') {
      this.arcade.play(msg.x, msg.y, msg.z, game, p.id, now);
      this.sendArcade();
      return;
    }
    if (msg.op === 'bop') {
      const fx = this.arcade.bop(key, msg.i, p.id, now);
      if (!fx) return;
      this.broadcast({ t: 'arcfx', ...fx });
      this.sendArcade();
      return;
    }
    if (msg.op === 'flip') {
      for (const fx of this.arcade.flip(key, msg.i, p.id, now)) this.broadcast({ t: 'arcfx', ...fx });
      this.sendArcade();
    }
  }

  // ------------------------------------------------ hide and seek

  // 🙈 I'll be it! from anyone on the island (a round with everyone else on
  // it hiding), or 🏳️ Stop from the seeker or the island's owner.
  hideSeekOp(conn, p, msg) {
    const now = this.now();
    if (msg.op === 'start') {
      const ids = this.onlinePlayers().map((q) => q.id);
      const res = this.hideseek.start(p.id, ids, now);
      if (res.why === 'alone') this.notice(conn, 'Hide and seek needs a friend on the island to hide!', 'info');
      else if (res.why === 'busy') this.notice(conn, 'A round of hide and seek is going already!', 'info');
      if (!res.ok) return;
      this.broadcast({ t: 'hsfx', f: 'start', seeker: p.id });
      this.sendHideSeek();
      return;
    }
    if (msg.op === 'stop') {
      const r = this.hideseek.round;
      if (!this.hideseek.playing || (r.seeker !== p.id && p.id !== this.host)) return;
      this.broadcast({ t: 'hsfx', ...this.hideseek.end(now, 'stopped') });
      this.sendHideSeek();
    }
  }

  // Someone gone from the island, out of a round of hide and seek.
  hideSeekLeft(pid) {
    const fx = this.hideseek.left(pid, this.now());
    if (!fx.length) return;
    for (const f of fx) this.broadcast({ t: 'hsfx', ...f });
    this.sendHideSeek();
  }

  // The round to everyone, as it changes (a new phase, someone found): each
  // page counts its time down by itself from there.
  sendHideSeek() {
    const pack = this.hideseek.pack(this.now());
    const text = JSON.stringify(pack && { ...pack, left: 0 });
    if (text === this.hsSent) return;
    this.hsSent = text;
    this.broadcast({ t: 'hs', s: pack });
  }

  // ------------------------------------------------ races

  // A racing island's races (race.js), never saved: null on any other island.
  raceSim() {
    if (this.race === undefined) {
      const track = raceTrack(this.world);
      this.race = track ? new RaceSim(track) : null;
    }
    return this.race;
  }

  // 🏁 Race! from someone driving a go-kart on a racing island (everyone in
  // a kart lines up, and the island's other karts race too, driven by the
  // computer), or 🏳️ Stop from whoever called it or the island's owner.
  raceOp(conn, p, msg) {
    const race = this.raceSim();
    if (!race) return;
    const now = this.now();
    if (msg.op === 'start') {
      const kart = this.critters.list.find((c) => c.rider === p.id);
      if (kart?.type !== 'kart') {
        this.notice(conn, 'Get in a go-kart to start a race!', 'info');
        return;
      }
      const free = this.critters.list.filter((c) => c.type === 'kart' && !c.rider && !c.passengers?.some(Boolean) && Math.max(Math.abs(c.x - race.track.cx), Math.abs(c.z - race.track.cz)) <= 26);
      const res = race.start(p.id, free, now);
      if (res.why === 'busy') this.notice(conn, 'A race is going already!', 'info');
      if (!res.ok) return;
      this.broadcast({ t: 'rcfx', f: 'start', by: p.id });
      this.sendRace();
      return;
    }
    if (msg.op === 'stop') {
      const r = race.round;
      if (!race.playing || (r.by !== p.id && p.id !== this.host)) return;
      this.broadcast({ t: 'rcfx', ...race.end(now, 'stopped') });
      this.sendRace();
    }
  }

  raceLeft(pid) {
    if (!this.race?.round) return;
    for (const f of this.race.left(pid, this.now())) this.broadcast({ t: 'rcfx', ...f });
    this.sendRace();
  }

  // The race to everyone, as it changes (a new phase, a lap, a place):
  // each page counts its time down by itself from there.
  sendRace() {
    const pack = this.race.pack(this.now());
    const text = JSON.stringify(pack && { ...pack, left: 0 });
    if (text === this.raceSent) return;
    this.raceSent = text;
    this.broadcast({ t: 'rc', s: pack });
  }

  // ------------------------------------------------ Go

  // At a Go board: sitting down to play (a new game of Go or Gomoku, or the
  // empty seat of one), a fresh board (of either game), calling the AI friend over, a stone, a pass,
  // giving up, or getting up. Anyone near the board, as for the arcade; a
  // stone that cannot go there is told of in a 'gofx' 'no', for the page to
  // say why (and the AI friend to explain).
  goOp(conn, p, msg) {
    if (![msg.x, msg.y, msg.z].every(Number.isInteger) || !isGoBoard(this.world.get(msg.x, msg.y, msg.z))) return;
    const k = keyOf(msg.x, msg.y, msg.z);
    if (msg.op === 'leave') {
      if (this.go.leave(k, p.id)) this.sendGo();
      return;
    }
    if (Math.hypot(p.s[0] - msg.x - 0.5, p.s[2] - msg.z - 0.5) > GO_REACH + 1 || Math.abs(p.s[1] - msg.y) > 4) return;
    let fx = [];
    const kind = msg.kind === 'gomoku' ? 'gomoku' : 'go';
    if (msg.op === 'sit') fx = this.go.sit(msg.x, msg.y, msg.z, p.id, p.ai === true, kind);
    else if (msg.op === 'new') fx = this.go.restart(k, p.id, msg.n, msg.kind === undefined ? null : kind);
    else if (msg.op === 'call') {
      if (!this.onlinePlayers().some((q) => q.ai)) {
        this.notice(conn, 'The AI friend is not on this island right now. 💌 Invite it from 👫 Players, then ask again!', 'info');
        return;
      }
      fx = this.go.call(k, p.id);
    } else if (msg.op === 'move') {
      const res = this.go.move(k, p.id, msg.i);
      fx = Array.isArray(res) ? res : [{ k, f: 'no', by: p.id, i: msg.i, why: res.why }];
    } else if (msg.op === 'pass') fx = this.go.pass(k, p.id);
    else if (msg.op === 'resign') fx = this.go.resign(k, p.id);
    for (const f of fx) this.broadcast({ t: 'gofx', ...f });
    this.sendGo();
  }

  // The games of Go, to everyone, as they change.
  sendGo() {
    const pack = this.go.pack();
    const text = JSON.stringify(pack);
    if (text === this.goSent) return;
    this.goSent = text;
    this.broadcast({ t: 'go', s: pack });
  }

  // A machine gone (picked up, say): its game goes with it.
  arcadeGone(x, y, z) {
    if (this.arcade.removeAt(x, y, z)) this.sendArcade();
  }

  // The games at the arcade machines, to everyone, as they change.
  sendArcade() {
    const pack = this.arcade.pack(this.now());
    const text = JSON.stringify(pack);
    if (text === this.arcSent) return;
    this.arcSent = text;
    this.broadcast({ t: 'arc', s: pack });
  }

  // A bop for King Grumble: nothing in his bubble, otherwise a heart (three
  // while he sits dazed from a stomp; he is too big to knock back); with none
  // left he goes pop, and the whole island is free.
  bopKing(p, m, now, times = 1) {
    const hit = this.adventure?.hitKing(p.id, now, now < (m.dazed ?? 0), times);
    if (!hit || hit.wait) return;
    if (hit.shielded) {
      this.broadcast({ t: 'kinghit', id: m.id, by: p.id, shielded: true });
      return;
    }
    const msg = { t: 'kinghit', id: m.id, by: p.id, hearts: hit.hearts, max: hit.max };
    if (hit.dazed) msg.dazed = true;
    this.broadcast(msg);
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

  // The Monster Gashapon turned up (or went), as the adventure says: put
  // down (or taken away) by the island, and everyone told.
  gashaNews(news) {
    const { x, y, z } = news;
    if (news.t === 'gasha') {
      this.natureCell([x, y, z], news.id);
      this.broadcast({ t: 'gasha', x, y, z });
    } else {
      if (isMonsterGashapon(this.world.get(x, y, z))) this.natureCell([x, y, z], B.AIR);
      this.broadcast({ t: 'gasha', x, y, z, gone: true });
    }
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
  // can bump anyone now, so everyone has all their HP.
  allWell() {
    const now = this.now();
    for (const p of this.players.values()) {
      if ((p.dizzyUntil ?? 0) > now) {
        p.dizzyUntil = 0;
        p.hp = this.settings.monsters ? helpHp(p.maxHp) : p.maxHp;
        if (p.online) this.broadcast({ t: 'helped', pid: p.id, by: 0, ...this.hpOf(p) });
        continue;
      }
      p.dizzyUntil = 0;
      if (this.settings.monsters || p.hp === p.maxHp) continue;
      p.hp = p.maxHp;
      if (p.online) this.sendToPid(p.id, { t: 'hp', ...this.hpOf(p) });
    }
  }

  // Monsters turned off: every one roaming about goes (those of an adventure
  // island's camps stay), and, unless those are about, everyone has all their
  // HP.
  noMonsters() {
    this.monsters.clearRoaming();
    if (this.adventure?.active) return;
    for (const p of this.players.values()) {
      if (p.hp === p.maxHp) continue;
      p.hp = p.maxHp;
      if (p.online) this.sendToPid(p.id, { t: 'hp', ...this.hpOf(p) });
    }
  }

  // Someone's HP as a message carries it: { hp, max }.
  hpOf(p) {
    const max = p?.maxHp ?? maxHp(1);
    return { hp: p?.hp ?? max, max };
  }

  // A new look with a new level on it: a level up gives more HP (levels.js),
  // and as much of it as is new comes straight away.
  levelHp(p) {
    const max = hpFor(p);
    if (max === p.maxHp) return;
    p.hp = Math.max(0, Math.min(max, (p.hp ?? max) + Math.max(0, max - (p.maxHp ?? max))));
    p.maxHp = max;
    if (p.online) this.sendToPid(p.id, { t: 'hp', ...this.hpOf(p) });
  }

  sendToPid(pid, msg) {
    const text = JSON.stringify(msg);
    for (const [conn, c] of this.clients) if (c.pid === pid) this.safeSend(conn, text);
  }

  // Mining bombs placed (blocks.js BOMB), their fuses burning down: a
  // fizzing spark at the fuse's end every few moments, so everyone can see
  // (and steer clear of) a bomb about to pop. One that pops digs its blast
  // hole (tools.js blastEdit) as an edit by the island itself, telling
  // everyone where to see and hear the boom, and any jewels it shook loose
  // go to whoever placed it: the blast is theirs, so what it dug out belongs
  // in their basket. The jewels travel with the boom as a list of item ids,
  // which each page drops into that player's basket.
  stepBombs(now) {
    const w = this.world;
    for (const [k, bomb] of [...this.bombs]) {
      if (bomb.at > now) {
        if (bomb.next > now) continue;
        bomb.next = now + BOMB_SPARK_MS;
        if (w.get(bomb.x, bomb.y, bomb.z) === B.BOMB) this.broadcast({ t: 'fx', kind: 'fuse', x: bomb.x + 0.5, y: bomb.y + 0.9, z: bomb.z + 0.5 });
        continue;
      }
      this.bombs.delete(k);
      // Picked up or built over before it went off: nothing to pop.
      if (w.get(bomb.x, bomb.y, bomb.z) !== B.BOMB) continue;
      const plan = blastEdit(w, bomb.x, bomb.y, bomb.z);
      if (!plan.cells.length) continue;
      for (let i = 0; i < plan.cells.length; i += 4) w.set(plan.cells[i], plan.cells[i + 1], plan.cells[i + 2], plan.cells[i + 3]);
      this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'pick', cells: plan.cells });
      this.broadcast({ t: 'fx', kind: 'blast', x: bomb.x + 0.5, y: bomb.y + 0.5, z: bomb.z + 0.5, by: bomb.by, gems: plan.collected });
      this.changed();
    }
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

  // A crop at a stage, to grow from nothing on to the next (see farm): how
  // long that takes, in seconds on dry farmland.
  planted(x, y, z, id) {
    const crop = B.cropOf(id);
    this.crops.set(this.world.index(x, y, z), { x, y, z, grown: 0, need: 2 * crop.stage * this.between(STAGE_SPREAD) });
  }

  // Farmland, to look at for rain or water close by now and then (see
  // farm), and once watered, when it dries out.
  tilled(x, y, z, id) {
    const now = this.now();
    this.soil.set(this.world.index(x, y, z), { x, y, z, at: now + this.between(SOIL_MS), dryAt: B.SOIL[id] === 2 ? now + this.between(DRY_MS) : 0 });
  }

  // Crops grow a stage at a time, twice as fast in watered farmland; the
  // rain waters farmland out under the open sky, and water close by any
  // farmland at all, which dries out a while after neither does. What
  // changes goes out as one edit, the crops' and the farmland's together.
  farm(now) {
    if (now < this.farmAt) return;
    // Up to a minute at a time: a host page whose ticks were held back
    // (hidden, say) catches up rather than stopping.
    const dt = Math.min(60, (now - this.farmedAt) / 1000);
    this.farmedAt = now;
    this.farmAt = now + FARM_MS;
    if (!this.crops.size && !this.soil.size) return;
    const w = this.world;
    const cells = [];
    for (const c of this.crops.values()) {
      const id = w.get(c.x, c.y, c.z);
      if (!B.CROP_OF[id] || B.STAGE_OF[id] >= B.RIPE) continue;
      c.grown += dt * (B.SOIL[w.get(c.x, c.y - 1, c.z)] === 2 ? 2 : 1);
      if (c.grown >= c.need) cells.push(c.x, c.y, c.z, B.CROP_STAGES[B.CROP_OF[id] - 1][B.STAGE_OF[id] + 1]);
    }
    const raining = isRaining(this.env.weather);
    for (const s of this.soil.values()) {
      if (s.at > now) continue;
      s.at = now + this.between(SOIL_MS);
      const id = w.get(s.x, s.y, s.z);
      const soaked = (raining && w.top(s.x, s.z) === s.y) || this.waterNear(s.x, s.y, s.z);
      if (B.SOIL[id] === 1 && soaked) cells.push(s.x, s.y, s.z, B.WET_FARMLAND);
      else if (B.SOIL[id] === 2 && soaked) s.dryAt = now + this.between(DRY_MS);
      else if (B.SOIL[id] === 2 && now >= s.dryAt) cells.push(s.x, s.y, s.z, B.FARMLAND);
    }
    if (!cells.length) return;
    for (let i = 0; i < cells.length; i += 4) w.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
    this.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'crop', cells });
    this.changed();
  }

  // Whether there is water within SOAK blocks across of a cell, from a block
  // below it to a block above.
  waterNear(x, y, z) {
    const w = this.world;
    for (let dx = -SOAK; dx <= SOAK; dx++) {
      for (let dz = -SOAK; dz <= SOAK; dz++) {
        for (let dy = -1; dy <= 1; dy++) if (w.get(x + dx, y + dy, z + dz) === B.WATER) return true;
      }
    }
    return false;
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

  // ------------------------------------------------ drawing boards

  // A stroke on a drawing board or a picture hung in a frame (drawing.js),
  // by someone standing at it: drawn on the island's copy of its picture and
  // passed on to everyone else, who draw it on theirs.
  draw(conn, p, msg) {
    const at = msg.at;
    if (!Array.isArray(at) || at.length !== 3 || !at.every(Number.isInteger) || !isPictureAt(this.world.get(...at))) return;
    if (Math.hypot(p.s[0] - at[0] - 0.5, p.s[2] - at[2] - 0.5) > REACH + 1 || Math.abs(p.s[1] - at[1]) > 4) return;
    const stroke = cleanStroke(msg.s);
    if (!stroke) return;
    if (this.ownerWho) {
      this.notice(conn, `${this.world.name} stays just as it is — no drawing here!`);
      return;
    }
    const k = this.world.index(...at);
    let pic = this.drawings.get(k);
    if (!pic) {
      if (stroke.k === 'clear') return;
      if (this.drawings.size >= MAX_PICTURES) {
        this.notice(conn, 'This island has all the pictures it can keep. Wipe one clean to draw on another board!');
        return;
      }
      pic = { x: at[0], y: at[1], z: at[2], px: blankPicture() };
      this.drawings.set(k, pic);
    }
    applyStroke(pic.px, stroke);
    if (isBlank(pic.px)) this.drawings.delete(k);
    this.broadcast({ t: 'draw', pid: p.id, at, s: stroke }, conn);
    this.changed();
  }

  // The pictures, as [x, y, z, text] each.
  // New screens for the island's computers (see this.screens), told to everyone there.
  setScreens(list) {
    this.screens = Array.isArray(list) && list.length ? list : null;
    this.broadcast({ t: 'screens', s: this.screens ?? [] });
  }

  packDrawings() {
    return [...this.drawings.values()].map((d) => [d.x, d.y, d.z, encodePicture(d.px)]);
  }

  // ------------------------------------------------ saving

  exportSave() {
    return {
      app: 'kids-world',
      kind: 'island',
      // 2: made since birds, owls, bees and seagulls came to the islands;
      // 3: since the sea creatures did; 4: since penguins and seals did; 5:
      // since the big animals did; 6: since jewels were hidden in the rock;
      // 7: since the vehicles came; 8: since the bus and the ferry did; 9:
      // since the helicopter and the balloon did; 10: since the giant
      // mosquitos did; 11: since the kick scooter did.
      v: 11,
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
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, look: p.look, ...(p.who ? { who: p.who } : {}) })),
      tokens: [...this.tokens],
      ...(this.adventure ? { adventure: this.adventure.save() } : {}),
      ...(this.defense ? { defense: this.defense.save() } : {}),
      ...(this.drawings.size ? { drawings: this.packDrawings() } : {}),
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
      const added = this.critters.add(c.type, Math.min(w.W - 0.5, Math.max(0.5, c.x)), Math.min(w.H, Math.max(1, c.y)), Math.min(w.D - 0.5, Math.max(0.5, c.z)), c.name, finite(c.yaw) ? c.yaw : null);
      if (added && c.tame === true && CRITTER_INFO[c.type].wild) added.tame = true;
    }
    // Animals that came to the islands since this one was saved move in, once.
    const v = Number(save.v) || 1;
    if (v < 2) for (const f of placeFlyers(this.world, new Rng(seed ^ 0x2545f491))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 3) for (const f of placeSea(this.world, new Rng(seed ^ 0x6b43a9b5))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 4) for (const f of placePolar(this.world, new Rng(seed ^ 0x3c6ef372))) this.critters.add(f.type, f.x, f.y, f.z);
    if (v < 5) for (const f of placeBig(this.world, new Rng(seed ^ 0x1b873593))) this.critters.add(f.type, f.x, f.y, f.z);
    // (Islands from before v 10 got giant mosquitos here; they are monsters
    // now, monsters.js, so islands from before them get none.)
    // And vehicles: a car, a boat and a digger (the mines of an island from
    // before them have no rails, nor a mine cart).
    if (v < 7) for (const f of placeVehicles(this.world, new Rng(seed ^ 0x4cf5ad43))) this.critters.add(f.type, f.x, f.y, f.z, null, f.yaw);
    // Jewels too, deep in the rock where nothing anyone built can be.
    if (v < 6) hideGems(this.world, new Rng(seed ^ 0x2c1b3c6d), { open: false });
    // The pictures, on the drawing boards still there.
    for (const row of Array.isArray(save.drawings) ? save.drawings.slice(0, MAX_PICTURES) : []) {
      if (!Array.isArray(row) || !row.slice(0, 3).every(Number.isInteger)) continue;
      const [x, y, z, text] = row;
      const px = decodePicture(text);
      if (px && !isBlank(px) && isPictureAt(this.world.get(x, y, z))) this.drawings.set(this.world.index(x, y, z), { x, y, z, px });
    }
    this.settings = cleanSettings(save.settings);
    this.passcode = isPasscode(save.passcode) ? save.passcode : '';
    this.adventure = AdventureSim.load(save.adventure, this.world, (seed ^ 0x510e527f ^ (Number(save.savedAt) | 0)) >>> 0);
    if (this.adventure) this.stage = this.adventure.stage;
    this.defense = this.adventure ? null : DefenseSim.load(save.defense, this.world, (seed ^ 0x2b992ddf ^ (Number(save.savedAt) | 0)) >>> 0);
    // And a bus and a ferry, to ride in together, clear of the camps or the road.
    if (v < 8) {
      const clear = busesClearOf(this.critters.list.filter((c) => CRITTER_INFO[c.type].vehicle), this.adventure?.camps ?? [], this.defense);
      for (const f of placeBuses(this.world, new Rng(seed ^ 0x3243f6a8), clear)) this.critters.add(f.type, f.x, f.y, f.z, null, f.yaw);
    }
    // And a helicopter and a hot-air balloon, the same way.
    if (v < 9) {
      const clear = busesClearOf(this.critters.list.filter((c) => CRITTER_INFO[c.type].vehicle), this.adventure?.camps ?? [], this.defense);
      for (const f of placeAircraft(this.world, new Rng(seed ^ 0x13198a2e), clear)) this.critters.add(f.type, f.x, f.y, f.z, null, f.yaw);
    }
    // And a kick scooter, the same way.
    if (v < 11) {
      const clear = busesClearOf(this.critters.list.filter((c) => CRITTER_INFO[c.type].vehicle), this.adventure?.camps ?? [], this.defense);
      for (const f of placeScooters(this.world, new Rng(seed ^ 0x85ebca6b), clear)) this.critters.add(f.type, f.x, f.y, f.z, null, f.yaw);
    }
    const time = finite(save.env?.time) ? ((save.env.time % 1) + 1) % 1 : 0.3;
    // A tornado blew itself out while the island was put away.
    const weather = save.env?.weather === 'tornado' ? 'cloudy' : save.env?.weather;
    this.env = { time, weather: WEATHERS.includes(weather) ? weather : 'clear', left: 180 };
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
          ...(isWho(raw.who) ? { who: raw.who } : {}),
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
