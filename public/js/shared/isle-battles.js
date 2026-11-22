// The battles of Toon Isle, the fifth episode of Adventure Isle's story
// (isle-story.js): Baron Bluster's Storm Gang keeps no camps and no castle.
// Instead, on an island far bigger than any before (isle-toon.js), hidden
// under his Cloud Blanket until someone gets there:
//
// - The clouds (Fog): the island is a grid of tiles, each hidden until
//   anyone comes near it, and then shown to everyone, for good. Nothing of
//   a tile shows on anyone's screen or map until it is: not the land, not
//   what stands on it, not a battle there.
// - Gangs roam about the island's paths, a few monsters at a time, keeping
//   together, and come after whoever they meet. Pop a whole gang and
//   another turns up somewhere else a while later. And more of the Storm
//   Gang hides in the clouds themselves: rolling them back over new ground,
//   every so often a gang drops out of them, right in front of you.
// - An ambush: a Lantern Spark in a clearing is a trap. Whoever walks up to
//   it springs it: a ring of thorns shoots up round the clearing, shutting
//   in everyone inside, and the Storm Gang comes at them in waves, each
//   tougher than the last. Pop every wave and the ring crumbles: won. With
//   everyone inside out of the fight (dizzy, or gone home), it resets.
// - A siege: a beacon to light (stand by it) and keep alight until its time
//   runs out, while the Storm Gang rushes it from every side to put it out,
//   each bump on it a heart off it. Out of hearts, it goes out: light it
//   again to start over.
// - A nest: Storm Nests in a glade, each hatching a monster every few
//   seconds while anyone is near. Bop every nest till it bursts.
// - A hunt: one of the Baron's Big Bads (a mighty beast, beasts.js) roams a
//   long way round part of the island with a couple of helpers. Twice, hurt
//   enough, it runs off along its way to rest, getting its hearts back while
//   nobody is at it: follow it and pop it.
// - The showdown, on the last chapter, once every other battle is won:
//   Baron Bluster on his cloud over his arena, out of reach, throwing
//   lightning and dropping helpers. Stand on all three of his lightning
//   rods at once and the bolt knocks him down, dazed: bop him on the ground,
//   until he puffs himself back up into the sky — three times.
//
// Each battle won sends a spark to the chapter's Sky Lantern where everyone
// arrived (its hub: a lamp for each battle), and every one won wins the
// stage. Where a battle was won is a safe place from then on, where anyone
// out of hearts comes back.
//
// The Storm Gang is the toughest yet, and tougher against mightier weapons
// (each monster's hearts go up with the toy weapons in everyone's hands,
// GEAR), so no weapon pops them all in one bop; and its bumps hurt more
// (FIERCE).
//
// All of it is worked out by the host (AdventureSim, room.js) from where
// everyone is, as the isle's camps are; the monsters are the island's
// (monsters.js MonsterSim), each keeping to a "camp" of its battle or gang:
// a circle that, for a gang or a hunt, moves.
import * as B from './blocks.js';
import { BEASTS } from './beasts.js';
import { planOf } from './bosses.js';
import { bodyOf, DAZED_HIT, isHeavy, kindOf } from './monsters.js';
import { bodyOverlapsSolid } from './physics.js';
import { Rng } from './rng.js';
import { base64ToBytes, bytesToBase64 } from './world.js';

const FL = Math.floor;

// ---------------------------------------------------------------- the clouds

// The Cloud Blanket is tiles this many blocks across; the clouds roll back
// this far round anyone, and further round where everyone arrives.
export const FOG_TILE = 8;
export const REVEAL = 22;
export const REVEAL_START = 30;

// Which tiles of an island anyone has seen, kept for the whole stage (and
// over a restart: server/adventure.js).
export class Fog {
  constructor(W, D) {
    this.W = W;
    this.D = D;
    this.w = Math.ceil(W / FOG_TILE);
    this.h = Math.ceil(D / FOG_TILE);
    this.seen = new Uint8Array(this.w * this.h);
    this.count = 0;
  }

  // The tile (x, z) is in, or -1 off the island's map (the open sea, never
  // under the blanket).
  tileOf(x, z) {
    const i = FL(x / FOG_TILE);
    const j = FL(z / FOG_TILE);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : i * this.h + j;
  }

  isSeen(x, z) {
    const t = this.tileOf(x, z);
    return t < 0 || this.seen[t] === 1;
  }

  get all() {
    return this.count >= this.seen.length;
  }

  // The clouds rolled back round (x, z), as far as r: every tile any of
  // which is that near, newly seen, added to `out` by its number.
  reveal(x, z, r = REVEAL, out = []) {
    const i0 = Math.max(0, FL((x - r) / FOG_TILE));
    const i1 = Math.min(this.w - 1, FL((x + r) / FOG_TILE));
    const j0 = Math.max(0, FL((z - r) / FOG_TILE));
    const j1 = Math.min(this.h - 1, FL((z + r) / FOG_TILE));
    for (let i = i0; i <= i1; i++) {
      const dx = Math.max(i * FOG_TILE - x, 0, x - (i + 1) * FOG_TILE);
      for (let j = j0; j <= j1; j++) {
        const k = i * this.h + j;
        if (this.seen[k]) continue;
        const dz = Math.max(j * FOG_TILE - z, 0, z - (j + 1) * FOG_TILE);
        if (dx * dx + dz * dz > r * r) continue;
        this.seen[k] = 1;
        this.count++;
        out.push(k);
      }
    }
    return out;
  }

  // Every tile seen at once (the stage won: the Cloud Blanket blown away).
  revealAll() {
    const out = [];
    for (let k = 0; k < this.seen.length; k++) {
      if (this.seen[k]) continue;
      this.seen[k] = 1;
      out.push(k);
    }
    this.count = this.seen.length;
    return out;
  }

  // For the wire and the keeping: a bit for each tile, as base64.
  pack() {
    const bytes = new Uint8Array(Math.ceil(this.seen.length / 8));
    for (let k = 0; k < this.seen.length; k++) if (this.seen[k]) bytes[k >> 3] |= 1 << (k & 7);
    return bytesToBase64(bytes);
  }

  // What pack gave, seen again (nonsense, nothing).
  load(text) {
    if (typeof text !== 'string' || !text) return [];
    let bytes;
    try {
      bytes = base64ToBytes(text);
    } catch {
      return [];
    }
    // (Not this island's, or nonsense: nothing.)
    if (bytes.length !== Math.ceil(this.seen.length / 8)) return [];
    const out = [];
    for (let k = 0; k < this.seen.length; k++) {
      if (this.seen[k] || !(bytes[k >> 3] & (1 << (k & 7)))) continue;
      this.seen[k] = 1;
      this.count++;
      out.push(k);
    }
    return out;
  }
}

// Seen bits as Fog.pack gives them, read back by a page: a byte per tile.
export function unpackFog(text, n) {
  const out = new Uint8Array(n);
  if (typeof text !== 'string') return out;
  let bytes;
  try {
    bytes = base64ToBytes(text);
  } catch {
    return out;
  }
  if (bytes.length !== Math.ceil(n / 8)) return out;
  for (let k = 0; k < n; k++) if (bytes[k >> 3] & (1 << (k & 7))) out[k] = 1;
  return out;
}

// ---------------------------------------------------------------- the battles

// The kinds of battle there are, each with its icon (for the map and the
// story) and its colour.
export const BATTLE_ICONS = { ambush: '💥', siege: '🔥', nest: '🥚', hunt: '🐾', showdown: '🎩' };
export const BATTLE_COLORS = { ambush: '#ff6b4a', siege: '#ffb02e', nest: '#9b6bff', hunt: '#3fb6ff', showdown: '#ff4fa3' };
export const MAX_BATTLES = 5;

// How a battle is going, as the wire says it.
export const STATES = ['idle', 'on', 'done', 'locked'];

// An ambush: how near its Lantern Spark someone springs the trap; its ring
// of thorns, how high; how long after a wave is down to `keep` of it the
// next comes (they overlap: no breather in between); how long everyone
// inside can be out of the fight before it resets, and how long after that
// it can be sprung again.
export const AMBUSH = { spring: 2.6, high: 3, gap: 1200, first: 1400, keep: 1 / 3, lost: 2500, rest: 6000 };
// A siege: how long someone stands by the beacon to light it, how near; how
// long it must burn (and longer the harder the chapter); how often the
// Storm Gang comes at it and from how far.
export const SIEGE = { light: 2000, reach: 3.2, ms: 70000, more: 10000, every: [6500, 5000], from: [22, 28], rest: 5000, push: 25000 };
// A nest: how often each hatches a monster while anyone is this near, how
// many it keeps about at most, and how many it has in it to hatch at all
// (brood, and more on the harder chapters and with more friends); how near
// wakes them; nobody this near for this long, and its monsters go back in.
export const NEST = { every: [5000, 3800], near: 24, most: 3, brood: 6, wake: 26, sleep: 40, sleepMs: 15000 };
// A hunt: how far round its Big Bad it keeps to; how fast its way moves on
// while it is after nobody, and how fast it runs off; how far along its way
// it runs off; how long left alone before it rests, and a heart back how
// often then; how near anyone wakes it, how far they get before it sleeps;
// how many times it runs off; how many helpers it has, and how often one
// more joins it while it is being fought.
export const HUNT = { r: 9, roam: 1.1, flee: 5.4, far: 0.3, restMs: 5000, healMs: 1500, wake: 48, sleep: 72, sleepMs: 20000, flees: 3, helpers: 3, pack: 10000 };
// The showdown: the Baron's arena; how high over it he floats; how often he
// throws lightning from up there and drops helpers; how long someone stands
// on a lightning rod to charge it, how near, and how long it stays charged;
// how long he sits dazed after falling; how much of his hearts each turn on
// the ground can take before he puffs himself back up, and at most how long
// it lasts.
export const SHOWDOWN = { high: 8, every: 2100, drop: 6500, charge: 1500, rodReach: 1.9, holds: 11000, dazed: 3500, turn: 1 / 3, turnMs: 26000, wake: 6 };
// Bops on the Baron: each friend once in this long.
export const BOSS_HIT_MS = 800;
// Gangs: how many roam at once (more on the harder chapters and with more
// friends), how many monsters in each; how near anyone wakes one, how far
// they get before it sleeps; how fast one goes along the paths; how soon
// after one is popped another turns up, and how far from everyone.
export const GANG = { base: 6, most: 14, size: 4, near: 44, far: 60, sleepMs: 10000, pace: 1.0, back: [15000, 30000], away: 44, r: 7, landing: 34 };
// Gangs hiding in the clouds: someone who has rolled back this many tiles
// of them (one of the two, picked each time) since the last has a gang
// drop out of them, this far from them; at most one this often on the
// island, and as many monsters in it as a roaming gang has.
export const DROP = { tiles: [14, 24], ms: 18000, from: [8, 12] };
// How much tougher the Storm Gang is against mightier weapons: a share more
// hearts for each heart more a weapon's bop takes (shop.js power), from the
// mean of the weapons in the hands of everyone on the island. Against a
// fist as tough as ever; against a Meteor Staff about six times as tough,
// for it takes twelve hearts a bop.
export const GEAR = 0.45;
// How much harder its bumps are than other monsters' (monsters.js BUMP_HP).
export const FIERCE = 1.25;
// Points for the results (adventure.js DEEDS play): for everyone there as
// a battle is won, and for whoever's popping did it.
const WIN_PLAY = 12;

// How tough the Storm Gang is on a chapter as hard as `level` (a stage of
// the first episode's number): a share more hearts on each, every level up
// from the first of the episode's, and more against mightier weapons (gear:
// the mean power of everyone's, see GEAR).
const toughness = (level) => 1.3 + 0.12 * Math.max(0, level - 12);
export const geared = (gear) => 1 + GEAR * Math.max(0, gear - 1);
const toughen = (m, level, extra = 1, gear = 1) => {
  if (!m) return m;
  m.hearts = Math.max(1, Math.round(kindOf(m.kind).hearts * toughness(level) * extra * geared(gear)));
  m.max = m.hearts;
  m.fierce = FIERCE;
  return m;
};

// The first episodes' beasts of tier 1, for the toughest waves.
const TIER1 = ['wolf', 'stinger', 'rattle', 'hawk'];

// Whether someone can fight just now: on foot, and not dizzy.
const able = (p) => !p.flying && !p.riding && !p.dizzy && !p.beacon && !p.lure;

// Whether (x, y, z) is water a monster would fall into.
function wetAt(world, x, y, z) {
  const id = world.get(FL(x), FL(y), FL(z));
  return id === B.WATER || id === B.LAVA || world.get(FL(x), FL(y) - 1, FL(z)) === B.WATER;
}

// Where someone stands in the column at (x, z) within `rise` of y, up or
// down (the highest such place): on solid ground that is no tree, with room
// over it; null for none.
export function standNear(world, x, z, y, rise = 4) {
  const cx = FL(x);
  const cz = FL(z);
  if (cx < 0 || cz < 0 || cx >= world.W || cz >= world.D) return null;
  for (let yy = Math.min(world.H - 2, FL(y + rise)); yy >= Math.max(1, FL(y - rise)); yy--) {
    const under = world.get(cx, yy - 1, cz);
    if (B.SOLID[under] && !B.TREE_PART[under] && !B.SOLID[world.get(cx, yy, cz)] && !B.SOLID[world.get(cx, yy + 1, cz)]) return yy;
  }
  return null;
}

// Where someone stands on the ground of the column at (x, z), from the top.
const groundY = (world, x, z) => standNear(world, x, z, world.H / 2, world.H / 2);

// Every spot within r of (x, z) from which someone (or a monster) can walk
// to where someone stands there at y, a step up at a time and down any drop,
// never through water: as [x, y, z] each, x and z the middles of columns.
// (A beacon on a mesa is only to be stormed from ground that leads up to it.)
export function walkableAround(world, x, y, z, r) {
  const cx = FL(x);
  const cz = FL(z);
  const n = 2 * r + 1;
  const top = new Int16Array(n * n).fill(-1);
  const seen = new Uint8Array(n * n);
  const k = (i, j) => (i + r) * n + (j + r);
  const height = (i, j) => {
    const at = k(i, j);
    if (top[at] === -1) {
      const yy = standNear(world, cx + i + 0.5, cz + j + 0.5, y, 14);
      top[at] = yy === null || wetAt(world, cx + i, yy, cz + j) ? -2 : yy;
    }
    return top[at];
  };
  const start = height(0, 0);
  if (start < 0) return [];
  const out = [];
  const todo = [[0, 0]];
  seen[k(0, 0)] = 1;
  while (todo.length) {
    const [i, j] = todo.pop();
    const h = height(i, j);
    out.push([cx + i + 0.5, h, cz + j + 0.5]);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < -r || b < -r || a > r || b > r || a * a + b * b > r * r || seen[k(a, b)]) continue;
      const g = height(a, b);
      // From there to here: up a step at most (down, any drop).
      if (g < 0 || h - g > 1) continue;
      seen[k(a, b)] = 1;
      todo.push([a, b]);
    }
  }
  return out;
}

// A spot for a monster to stand near (cx, cy, cz), between near and far from
// it, on ground within `rise` of cy, out of the water, apart from everyone
// and with room for body; null when none will do.
function spotAround(world, rng, cx, cy, cz, near, far, people = [], { apart = 3, rise = 4, body = null } = {}) {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng.range(-Math.PI, Math.PI);
    const d = rng.range(near, far);
    const x = FL(cx + Math.cos(a) * d) + 0.5;
    const z = FL(cz + Math.sin(a) * d) + 0.5;
    const y = standNear(world, x, z, cy, rise);
    if (y === null || wetAt(world, x, y, z)) continue;
    if (people.some((p) => Math.hypot(p.x - x, p.z - z) < apart)) continue;
    if (body && bodyOverlapsSolid(world, { x, y, z, radius: body.radius, height: body.height })) continue;
    return { x, y, z };
  }
  return null;
}

// Where along a way (points [x, z], a loop when `loop`) s blocks from its
// start is, as { x, z, i } (i: the point it is past).
function pointAlong(way, s, loop = true) {
  const n = way.length;
  if (n < 2) return { x: way[0][0], z: way[0][1], i: 0 };
  let left = s;
  for (let guard = 0; guard < 10000; guard++) {
    for (let i = 0; i < (loop ? n : n - 1); i++) {
      const a = way[i];
      const b = way[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (left <= len) {
        const t = len ? left / len : 0;
        return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, i };
      }
      left -= len;
    }
    if (!loop) return { x: way[n - 1][0], z: way[n - 1][1], i: n - 1 };
  }
  return { x: way[0][0], z: way[0][1], i: 0 };
}
const wayLength = (way, loop = true) => way.reduce((sum, a, i) => (i === way.length - 1 && !loop ? sum : sum + Math.hypot(way[(i + 1) % way.length][0] - a[0], way[(i + 1) % way.length][1] - a[1])), 0);

export class Battles {
  // specs: the chapter's battles as its map lays them out (isle-toon.js), in
  // its order, each { kind, x, y, z, r, ... }: an ambush's prize (the cell of
  // its Lantern Spark), a siege's beacon (its cell), a nest's nests (where
  // each sits), a hunt's range (the way round it goes, [x, z] points), a
  // showdown's rods (each lightning rod's cell). story: the chapter
  // (isle-story.js chapterOf): each battle's name, the gangs' monsters.
  // level: how hard. roads: the island's paths, for the gangs to go along.
  // spawn: where everyone arrives. W, D: the island's size.
  constructor({ specs = [], story, level = 12, roads = [], spawn, W, D }, seed = 1) {
    this.rng = new Rng(seed);
    this.story = story;
    this.level = level;
    this.roads = roads.filter((r) => r.length >= 2);
    this.spawn = spawn;
    this.fog = new Fog(W, D);
    const told = story.battles ?? [];
    this.list = specs.map((s, i) => {
      const t = told[i] ?? {};
      const b = { ...s, id: i + 1, kind: s.kind, name: t.name ?? s.kind, after: Boolean(t.after), beast: t.beast ?? s.beast ?? 'oak', who: t.who ?? '', state: 'idle', done: false, rest: 0, camp: { id: 100 + i + 1, kind: 'arena', x: s.x, y: s.y, z: s.z, r: s.r } };
      if (b.kind === 'hunt') {
        b.camp.r = HUNT.r;
        b.along = 0;
        b.length = wayLength(s.range);
        const at = pointAlong(s.range, 0);
        Object.assign(b.camp, { x: at.x, z: at.z });
        b.flees = 0;
      }
      // (A siege's Storm Gang keeps close round the beacon, coming in to it
      // from wherever it is let out: stepSiege.)
      if (b.kind === 'siege') b.camp.r = 7;
      if (b.kind === 'showdown') {
        b.camp.r = s.r + 2;
        b.rodSpots = s.rods ?? [];
        b.rods = b.rodSpots.map(() => 0);
        delete b.spots;
      }
      return b;
    });
    this.gangs = [];
    this.nextGang = 0;
    this.gangAt = 0;
    // The mean power of the weapons in everyone's hands (see GEAR); how many
    // tiles of the clouds each has rolled back since a gang last dropped out
    // of them on them, and how many more it takes this time (DROP).
    this.gear = 1;
    this.rolled = new Map();
    this.dropNeed = new Map();
    this.dropAt = 0;
    // The monsters each battle's is waiting on, by id: a hunt's Big Bad, a
    // nest's nests, the Baron.
    this.popped = new Set();
    this.havenList = [];
    // The clouds roll back round where everyone arrives to start with.
    this.fog.reveal(spawn.x, spawn.z, REVEAL_START);
  }

  get won() {
    return this.list.length > 0 && this.list.every((b) => b.done);
  }

  byId(id) {
    return this.list.find((b) => b.id === id) ?? null;
  }

  // A battle's camp (or a gang's), for its monsters to keep to (monsters.js).
  campById(id) {
    for (const b of this.list) if (b.camp.id === id) return b.camp;
    for (const g of this.gangs) if (g.camp.id === id) return g.camp;
    return null;
  }

  // Whether a battle can be fought yet: one that comes after the others only
  // once every other is won.
  open(b) {
    return !b.after || this.list.every((o) => o === b || o.done);
  }

  // The safe places: where everyone arrives, and every battle won.
  havens(spawnR) {
    const out = [{ x: this.spawn.x, z: this.spawn.z, r: spawnR }];
    for (const h of this.havenList) out.push(h);
    return out;
  }

  // ------------------------------------------------ each tick

  // Moves everything on by dt seconds. people: as for the monsters
  // (MonsterSim.step); monsters: the island's; players: how many are on it.
  // Returns { fx, cells, done, fog, hurls, credit, flag }: things to see and
  // hear ({ id, k, ... }), cells changed, battles won ({ battle, by }), tiles
  // newly seen, lightning thrown from the sky, and points earned (by person
  // id) for the results.
  step(world, dt, now, people, monsters, players) {
    const out = { fx: [], cells: [], done: [], fog: [], hurls: [], credit: new Map(), flag: new Map() };
    const humans = people.filter((p) => !p.lure && !p.beacon);
    if (humans.length) this.gear = humans.reduce((sum, p) => sum + (p.power ?? 1), 0) / humans.length;
    for (const p of humans) {
      const before = out.fog.length;
      this.fog.reveal(p.x, p.z, REVEAL, out.fog);
      if (out.fog.length > before) this.rolled.set(p.id, (this.rolled.get(p.id) ?? 0) + out.fog.length - before);
    }
    const counts = new Map();
    for (const m of monsters.list) if (m.camp) counts.set(m.camp, (counts.get(m.camp) ?? 0) + 1);
    for (const b of this.list) {
      if (b.done) continue;
      if (!this.open(b)) continue;
      const n = counts.get(b.camp.id) ?? 0;
      if (b.kind === 'ambush') this.stepAmbush(world, b, dt, now, people, monsters, players, n, out);
      else if (b.kind === 'siege') this.stepSiege(world, b, dt, now, people, monsters, players, n, out);
      else if (b.kind === 'nest') this.stepNest(world, b, dt, now, people, monsters, players, n, out);
      else if (b.kind === 'hunt') this.stepHunt(world, b, dt, now, people, monsters, players, out);
      else if (b.kind === 'showdown') this.stepShowdown(world, b, dt, now, people, monsters, players, out);
    }
    this.stepGangs(world, dt, now, people, monsters, players, counts, out);
    this.stepDrops(world, now, humans, monsters, out);
    return out;
  }

  // Everyone near a battle as it is won (they get the points), and it done:
  // a safe place from now on.
  win(b, people, monsters, out, where = b) {
    b.done = true;
    b.state = 'done';
    const by = people.filter((p) => !p.beacon && !p.lure && Math.hypot(p.x - where.x, p.z - where.z) <= (b.r ?? 10) + 14).map((p) => p.id);
    for (const id of by) out.credit.set(id, (out.credit.get(id) ?? 0) + WIN_PLAY);
    // Whatever of its Storm Gang is left runs off.
    for (const m of [...monsters.list]) {
      if (m.camp !== b.camp.id) continue;
      monsters.remove(m.id);
      out.fx.push({ id: b.id, k: 'flee', m: m.id, x: +m.body.x.toFixed(2), y: +m.body.y.toFixed(2), z: +m.body.z.toFixed(2) });
    }
    this.havenList.push({ x: where.x, z: where.z, r: b.kind === 'hunt' ? 7 : Math.min(12, (b.r ?? 8) + 0.5), battle: b.id, y: where.y ?? b.y });
    out.done.push({ battle: b, by });
  }

  // A monster for a battle (or a gang): kind, at a spot near (x, y, z), its
  // hearts as tough as the chapter makes them.
  addMonster(world, monsters, camp, kind, at, extra = 1) {
    const m = monsters.add(world, at.x, at.y, at.z, { camp: camp.id, kind });
    return toughen(m, this.level, extra, this.gear);
  }

  // ------------------------------------------------ an ambush

  // The kinds coming in wave w (from 1) of `waves`: the chapter's own and
  // tougher ones as they go on, a beast in the last on the harder chapters.
  waveKinds(w, waves, players) {
    const gang = this.story.gang ?? ['blob'];
    const n = Math.min(10, 3 + w + Math.min(3, players - 1));
    const pools = [[gang[0], 'spiky', gang[0], 'blob'], ['knight', gang[1] ?? 'big', 'big', gang[0]], ['golem', 'knight', gang[2] ?? 'spiky', gang[1] ?? 'big'], ['knight', 'spiky', 'golem', gang[0]]];
    const pool = pools[Math.min(pools.length - 1, w - 1)];
    const out = [];
    for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
    // From the third wave on, a beast at its head; in the last, on the
    // hardest chapters, two.
    if (w >= 3) out[0] = TIER1[(this.level + w) % TIER1.length];
    if (w === waves && this.level >= 15) out[1] = TIER1[(this.level + w + 1) % TIER1.length];
    return out;
  }

  stepAmbush(world, b, dt, now, people, monsters, players, n, out) {
    const [px, py, pz] = b.prize;
    if (b.state === 'idle') {
      if (now < b.rest) return;
      const springer = people.find((p) => able(p) && Math.hypot(p.x - px - 0.5, p.z - pz - 0.5) <= AMBUSH.spring && Math.abs(p.y - py) < 3);
      if (!springer) return;
      // Sprung: the ring of thorns, and the first wave on its way.
      b.state = 'on';
      b.wave = 0;
      b.waves = this.level >= 14 ? 5 : 4;
      b.next = now + AMBUSH.first;
      b.lostAt = 0;
      b.ring = ringCells(world, b);
      for (let i = 0; i < b.ring.length; i += 4) world.set(b.ring[i], b.ring[i + 1], b.ring[i + 2], B.BRAMBLE);
      out.cells.push(...ringEdit(b.ring, true));
      out.fx.push({ id: b.id, k: 'spring', by: springer.id });
      return;
    }
    // Everyone inside the ring who can still fight.
    const inside = people.filter((p) => !p.beacon && !p.lure && Math.hypot(p.x - b.x, p.z - b.z) <= b.r + 0.6 && Math.abs(p.y - b.y) < 6);
    const fighting = inside.filter((p) => !p.dizzy);
    if (!fighting.length) {
      b.lostAt ||= now;
      if (now - b.lostAt >= AMBUSH.lost) {
        // Everyone inside out of the fight: the trap resets, to try again.
        for (const m of [...monsters.list]) if (m.camp === b.camp.id) monsters.remove(m.id);
        this.unring(world, b, out);
        b.state = 'idle';
        b.rest = now + AMBUSH.rest;
        out.fx.push({ id: b.id, k: 'fail' });
      }
      return;
    }
    b.lostAt = 0;
    // The next wave comes once this one is down to a few of it, and the
    // ring crumbles once the last is popped, every one.
    if (n > (b.wave >= b.waves ? 0 : FL((b.size ?? 0) * AMBUSH.keep))) {
      b.next = now + AMBUSH.gap;
      return;
    }
    if (now < b.next) return;
    if (b.wave >= b.waves) {
      // Every wave popped: the ring crumbles, the spark is theirs.
      this.unring(world, b, out);
      world.set(px, py, pz, B.AIR);
      out.cells.push(px, py, pz, B.AIR);
      this.win(b, people, monsters, out);
      return;
    }
    b.wave++;
    const kinds = this.waveKinds(b.wave, b.waves, players);
    b.size = kinds.length;
    for (const kind of kinds) {
      const at = spotAround(world, this.rng, b.x, b.y, b.z, 3, Math.max(4, b.r - 2.5), inside, { apart: 3.2, body: bodyOf(kind) }) ?? { x: b.x, y: b.y, z: b.z };
      this.addMonster(world, monsters, b.camp, kind, at, BEASTS[kind] ? 0.8 : 1);
    }
    out.fx.push({ id: b.id, k: 'wave', n: b.wave, of: b.waves });
  }

  // An ambush's ring of thorns gone again: the cells as they were.
  unring(world, b, out) {
    if (!b.ring) return;
    for (let i = 0; i < b.ring.length; i += 4) world.set(b.ring[i], b.ring[i + 1], b.ring[i + 2], b.ring[i + 3]);
    out.cells.push(...ringEdit(b.ring, false));
    b.ring = null;
  }

  // ------------------------------------------------ a siege

  // The beacon as someone the Storm Gang comes after (monsters.js): standing
  // where it does, as wide as its fire, bumped as anyone is (beaconBumped).
  beacons(now) {
    const out = [];
    for (const b of this.list) {
      if (b.kind !== 'siege' || b.state !== 'on') continue;
      const [x, y, z] = b.beacon;
      out.push({ id: -(1000 + b.id), x: x + 0.5, y, z: z + 0.5, flying: false, riding: false, dizzy: false, safeUntil: b.safeUntil ?? 0, mount: 0.85, beacon: b.id, only: b.camp.id });
    }
    for (const b of this.list) {
      if (b.kind !== 'hunt' || !b.lure) continue;
      out.push({ id: -(2000 + b.id), x: b.lure.x, y: b.lure.y, z: b.lure.z, flying: false, riding: false, dizzy: false, safeUntil: Infinity, lure: b.id, only: b.camp.id });
    }
    return out;
  }

  // A monster bumped a beacon (someone of beacons, by its id): a heart off it,
  // two from a big one.
  beaconBumped(pid, monster, now) {
    const b = this.byId(-pid - 1000);
    if (!b || b.kind !== 'siege' || b.state !== 'on') return null;
    b.hearts = Math.max(0, b.hearts - (isHeavy(monster.kind) ? 2 : 1));
    b.safeUntil = now + 450;
    return { id: b.id, k: 'hit', hearts: b.hearts, max: b.max };
  }

  stepSiege(world, b, dt, now, people, monsters, players, n, out) {
    const [bx, by, bz] = b.beacon;
    if (b.state === 'idle') {
      if (now < b.rest) return;
      const near = people.filter((p) => able(p) && Math.hypot(p.x - bx - 0.5, p.z - bz - 0.5) <= SIEGE.reach && Math.abs(p.y - by) < 3);
      b.light = near.length ? (b.light ?? 0) + dt * 1000 : Math.max(0, (b.light ?? 0) - dt * 2000);
      for (const p of near) out.flag.set(p.id, (out.flag.get(p.id) ?? 0) + dt);
      if (b.light < SIEGE.light) return;
      // Alight: the beacon has to burn this long, with hearts for as many
      // friends as are on the island.
      b.light = 0;
      b.state = 'on';
      b.ms = SIEGE.ms + SIEGE.more * Math.max(0, this.level - 12);
      b.until = now + b.ms;
      b.max = Math.min(44, 14 + 3 * Math.max(0, this.level - 12) + 6 * (Math.min(6, Math.max(1, players)) - 1));
      b.hearts = b.max;
      b.next = now + 1500;
      b.waves = 0;
      b.push = false;
      world.set(bx, by, bz, B.CAMPFIRE);
      out.cells.push(bx, by, bz, B.CAMPFIRE);
      out.fx.push({ id: b.id, k: 'lit', ms: b.ms, by: near[0]?.id ?? 0 });
      return;
    }
    if (b.hearts <= 0) {
      // Out: the Storm Gang cheers and is off; light it again to start over.
      for (const m of [...monsters.list]) if (m.camp === b.camp.id) monsters.remove(m.id);
      b.state = 'idle';
      b.rest = now + SIEGE.rest;
      world.set(bx, by, bz, B.LOGS);
      out.cells.push(bx, by, bz, B.LOGS);
      out.fx.push({ id: b.id, k: 'out' });
      return;
    }
    if (now >= b.until) {
      this.win(b, people, monsters, out);
      return;
    }
    if (now < b.next) return;
    // The Storm Gang comes at it from two sides at once, more of them with
    // more friends about, and in the last stretch a beast at their head.
    const every = SIEGE.every[0] + (SIEGE.every[1] - SIEGE.every[0]) * Math.min(1, Math.max(0, (this.level - 12) / 4));
    b.next = now + every;
    b.waves++;
    const most = 8 + Math.min(6, players);
    if (n >= most) return;
    const gang = this.story.gang ?? ['blob'];
    const count = Math.min(most - n, 3 + FL((this.level - 12) / 3) + Math.min(3, players - 1));
    const a0 = this.rng.range(-Math.PI, Math.PI);
    const last = !b.push && b.until - now <= SIEGE.push;
    // Let out on ground that leads up to the beacon, a way off from it.
    b.ground ??= walkableAround(world, bx + 0.5, by, bz + 0.5, SIEGE.from[1]).filter(([x, , z]) => Math.hypot(x - bx - 0.5, z - bz - 0.5) >= SIEGE.from[0]);
    for (let i = 0; i < count && b.ground.length; i++) {
      const side = a0 + (i % 2) * Math.PI + this.rng.range(-0.6, 0.6);
      // Mostly the chapter's lighter ones, a knight every other time.
      let kind = i === 0 && b.waves % 2 === 0 ? 'knight' : gang[(i + b.waves) % Math.min(2, gang.length)];
      // The last push: a beast at its head (two on the harder chapters).
      if (last && (i === 0 || (i === 1 && this.level >= 14))) kind = TIER1[(this.level + b.id + i) % TIER1.length];
      let at = null;
      for (let tries = 0; tries < 12 && !at; tries++) {
        // From about the side wanted, as near it as the ground lets.
        const [x, y, z] = b.ground[this.rng.int(0, b.ground.length - 1)];
        const off = Math.abs(((Math.atan2(z - bz - 0.5, x - bx - 0.5) - side + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (tries < 8 && off > 1.2) continue;
        if (people.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
        if (bodyOverlapsSolid(world, { x, y, z, ...bodyOf(kind) })) continue;
        at = { x, y, z };
      }
      if (at) this.addMonster(world, monsters, b.camp, kind, at, BEASTS[kind] ? 0.8 : 1);
    }
    if (last) {
      b.push = true;
      out.fx.push({ id: b.id, k: 'push' });
    }
  }

  // ------------------------------------------------ a nest

  stepNest(world, b, dt, now, people, monsters, players, n, out) {
    const near = (r) => people.some((p) => !p.beacon && !p.lure && Math.hypot(p.x - b.x, p.z - b.z) <= r);
    b.nests ??= b.spots.map((at) => ({ at, id: 0, hearts: 0, max: 0, popped: false, hatch: 0, brood: NEST.brood + Math.max(0, this.level - 12) + 2 * (Math.min(6, Math.max(1, players)) - 1) }));
    if (b.state === 'idle') {
      if (!near(NEST.wake + b.r)) return;
      b.state = 'on';
      b.quiet = 0;
      for (const nest of b.nests) {
        if (nest.popped) continue;
        const [x, y, z] = nest.at;
        const m = monsters.add(world, x + 0.5, y, z + 0.5, { camp: b.camp.id, kind: 'nest' });
        if (!m) continue;
        nest.max ||= Math.min(240, Math.round((14 + 4 * Math.max(0, this.level - 12)) * (1 + 0.45 * (Math.min(6, Math.max(1, players)) - 1)) * geared(this.gear)));
        nest.hearts ||= nest.max;
        Object.assign(m, { hearts: nest.hearts, max: nest.max, keepHearts: true, yaw: Math.atan2(b.x - x, b.z - z) });
        nest.id = m.id;
        nest.hatch = now + 1500 + this.rng.range(0, 1500);
      }
      out.fx.push({ id: b.id, k: 'wake' });
      return;
    }
    // Each nest as it is: popped (and that may be the last), gone by itself
    // (back it comes), or hatching.
    let left = 0;
    for (const nest of b.nests) {
      if (nest.popped) continue;
      const m = nest.id ? monsters.get(nest.id) : null;
      if (!m) {
        if (this.popped.has(nest.id)) {
          nest.popped = true;
          out.fx.push({ id: b.id, k: 'burst', x: nest.at[0] + 0.5, y: nest.at[1], z: nest.at[2] + 0.5 });
          continue;
        }
        const [x, y, z] = nest.at;
        const again = monsters.add(world, x + 0.5, y, z + 0.5, { camp: b.camp.id, kind: 'nest' });
        if (again) {
          Object.assign(again, { hearts: nest.hearts || nest.max, max: nest.max, keepHearts: true });
          nest.id = again.id;
        }
        left++;
        continue;
      }
      left++;
      nest.hearts = m.hearts;
      // Nobody near it for a while: a heart back now and then.
      if (people.some((p) => able(p) && Math.hypot(p.x - m.body.x, p.z - m.body.z) <= NEST.near)) nest.alone = 0;
      else nest.alone ||= now;
      if (m.hearts < m.max && nest.alone && now - nest.alone >= 8000 && now - (nest.healAt ?? 0) >= 2000) {
        m.hearts++;
        nest.healAt = now;
      }
      // (Its brood all hatched, it hatches no more.)
      if (now < nest.hatch || nest.brood <= 0) continue;
      const every = NEST.every[0] + (NEST.every[1] - NEST.every[0]) * Math.min(1, Math.max(0, (this.level - 12) / 4));
      nest.hatch = now + every;
      if (!people.some((p) => able(p) && Math.hypot(p.x - m.body.x, p.z - m.body.z) <= NEST.near)) continue;
      const mine = monsters.list.filter((q) => q.camp === b.camp.id && q.kind !== 'nest' && q.from === nest.id).length;
      if (mine >= NEST.most) continue;
      const gang = this.story.gang ?? ['blob'];
      const kind = gang[this.rng.int(0, Math.min(gang.length, 3) - 1)];
      const at = spotAround(world, this.rng, m.body.x, m.body.y, m.body.z, 1.6, 2.6, [], { apart: 0, rise: 2, body: bodyOf(kind) }) ?? { x: m.body.x + 1.5, y: m.body.y, z: m.body.z };
      const kid = this.addMonster(world, monsters, b.camp, kind, at);
      if (kid) {
        nest.brood--;
        kid.from = nest.id;
        Object.assign(kid.body, { vy: 5 });
        out.fx.push({ id: b.id, k: 'hatch', nest: nest.id, m: kid.id });
      }
    }
    if (!left) {
      this.win(b, people, monsters, out);
      return;
    }
    // Nobody near for a while: its hatchlings go back in, the nests wait.
    if (near(NEST.sleep + b.r)) b.quiet = 0;
    else {
      b.quiet ||= now;
      if (now - b.quiet >= NEST.sleepMs) {
        for (const m of [...monsters.list]) if (m.camp === b.camp.id) monsters.remove(m.id);
        for (const nest of b.nests) nest.id = 0;
        b.state = 'idle';
      }
    }
  }

  // ------------------------------------------------ a hunt

  // A hunt's Big Bad: its hearts, for as many friends as are on the island.
  huntHearts(b, players) {
    const base = BEASTS[b.beast]?.hearts ?? 28;
    return Math.round(base * 2.2 * (1 + 0.2 * Math.max(0, this.level - 12)) * (1 + 0.45 * (Math.min(6, Math.max(1, players)) - 1)) * geared(this.gear));
  }

  stepHunt(world, b, dt, now, people, monsters, players, out) {
    const camp = b.camp;
    const range = b.range;
    const m = b.monster ? monsters.get(b.monster) : null;
    const anyone = (r) => people.some((p) => !p.beacon && !p.lure && Math.hypot(p.x - camp.x, p.z - camp.z) <= r);
    if (b.monster && !m) {
      if (this.popped.has(b.monster)) {
        const at = b.last ?? camp;
        this.win(b, people, monsters, out, { x: at.x, y: at.y, z: at.z });
        return;
      }
      // Gone by itself (into the water): back it comes on its way, as it was.
      b.monster = 0;
      b.state = 'idle';
    }
    if (!m) {
      // Asleep: its way goes on round, nobody to see it.
      this.moveHunt(b, dt * HUNT.roam);
      if (!anyone(HUNT.wake)) return;
      const y = groundY(world, camp.x, camp.z) ?? b.y;
      const at = spotAround(world, this.rng, camp.x, y, camp.z, 0, 4, [], { rise: 4, body: bodyOf(b.beast) }) ?? spotAround(world, this.rng, camp.x, y, camp.z, 0, 8, [], { rise: 8 });
      if (!at) return;
      const beast = monsters.add(world, at.x, at.y, at.z, { camp: camp.id, kind: b.beast });
      if (!beast) return;
      b.max ||= this.huntHearts(b, players);
      b.hearts ||= b.max;
      Object.assign(beast, { hearts: b.hearts, max: b.max, keepHearts: true, champion: true });
      b.monster = beast.id;
      b.state = 'on';
      b.quiet = 0;
      // Helpers with it (and more on their way: below).
      for (let i = 0; i < HUNT.helpers; i++) this.huntHelper(world, b, monsters, at, people, i);
      b.packAt = now + HUNT.pack;
      out.fx.push({ id: b.id, k: 'wake', m: beast.id });
      return;
    }
    b.last = { x: m.body.x, y: m.body.y, z: m.body.z };
    b.hearts = m.hearts;
    const fair = people.filter((p) => able(p));
    const nearest = fair.reduce((d, p) => Math.min(d, Math.hypot(p.x - m.body.x, p.z - m.body.z)), Infinity);
    // Running off to rest: the lure ahead of it along its way, until it is
    // far enough on.
    if (b.lure) {
      b.lure.ms -= dt * 1000;
      const lead = Math.hypot(b.lure.x - m.body.x, b.lure.z - m.body.z);
      if (lead < 6) this.moveHunt(b, dt * HUNT.flee);
      const at = pointAlong(range, b.along);
      b.lure.x = at.x;
      b.lure.z = at.z;
      b.lure.y = standNear(world, at.x, at.z, b.lure.y, 8) ?? b.lure.y;
      if (b.fled >= b.length * HUNT.far || b.lure.ms <= 0) {
        b.lure = null;
        out.fx.push({ id: b.id, k: 'rest', m: m.id });
      } else {
        b.fled += lead < 6 ? dt * HUNT.flee : 0;
      }
      this.healHunt(b, m, now, nearest);
      return;
    }
    // Its pack: while anyone is at it, another helper now and then, up to
    // a few more with more friends.
    if (now >= (b.packAt ?? 0) && nearest < 30) {
      b.packAt = now + HUNT.pack;
      const pack = monsters.list.filter((q) => q.camp === camp.id && q.id !== m.id).length;
      if (pack < HUNT.helpers + Math.min(2, players - 1)) this.huntHelper(world, b, monsters, m.body, people, b.flees + pack);
    }
    // Hurt enough (three quarters, a half, then a quarter of its hearts
    // left): off it runs.
    if (b.flees < HUNT.flees && m.hearts <= m.max * (1 - (b.flees + 1) / (HUNT.flees + 1))) {
      b.flees++;
      b.fled = 0;
      const ahead = pointAlong(range, b.along);
      b.lure = { x: ahead.x, y: m.body.y, z: ahead.z, ms: 40000 };
      m.target = 0;
      out.fx.push({ id: b.id, k: 'flee', m: m.id, x: +m.body.x.toFixed(2), y: +m.body.y.toFixed(2), z: +m.body.z.toFixed(2) });
      return;
    }
    // After nobody: on along its way, at a stroll (keeping up with it).
    if (!m.target && Math.hypot(m.body.x - camp.x, m.body.z - camp.z) < camp.r - 3) this.moveHunt(b, dt * HUNT.roam);
    this.healHunt(b, m, now, nearest);
    // Nobody about for long: it goes to sleep, its hearts kept.
    if (anyone(HUNT.sleep)) b.quiet = 0;
    else {
      b.quiet ||= now;
      if (now - b.quiet >= HUNT.sleepMs) {
        for (const q of [...monsters.list]) if (q.camp === camp.id) monsters.remove(q.id);
        b.monster = 0;
        b.state = 'idle';
      }
    }
  }

  // One of a hunt's Big Bad's helpers, near `at`: the chapter's own, a
  // knight now and then.
  huntHelper(world, b, monsters, at, people, i) {
    const gang = this.story.gang ?? ['blob'];
    const kind = i % 3 === 2 ? 'knight' : gang[i % gang.length];
    const h = spotAround(world, this.rng, at.x, at.y, at.z, 2, 5, people, { body: bodyOf(kind) });
    return h ? this.addMonster(world, monsters, b.camp, kind, h) : null;
  }

  // A hunt's way on along its range by `ds` blocks.
  moveHunt(b, ds) {
    b.along = (b.along + ds) % b.length;
    const at = pointAlong(b.range, b.along);
    b.camp.x = at.x;
    b.camp.z = at.z;
  }

  // Left alone a while (nobody this side of 18 blocks), a Big Bad gets a
  // heart back now and then — never past what it had when it last ran off.
  healHunt(b, m, now, nearest) {
    const cap = Math.round(m.max * (1 - b.flees / (HUNT.flees + 1)));
    if (nearest < 18) {
      b.alone = 0;
      return;
    }
    b.alone ||= now;
    if (now - b.alone < HUNT.restMs || m.hearts >= cap || now - (b.healAt ?? 0) < HUNT.healMs) return;
    m.hearts++;
    b.healAt = now;
  }

  // ------------------------------------------------ the showdown

  stepShowdown(world, b, dt, now, people, monsters, players, out) {
    const inArena = (p) => !p.beacon && !p.lure && Math.hypot(p.x - b.x, p.z - b.z) <= b.r + SHOWDOWN.wake && Math.abs(p.y - b.y) < 8;
    const here = people.filter(inArena);
    let m = b.monster ? monsters.get(b.monster) : null;
    if (b.monster && !m) {
      if (this.popped.has(b.monster)) return;
      b.monster = 0;
    }
    if (!m) {
      if (!here.length) return;
      const plan = planOf('bluster');
      m = monsters.add(world, b.x, b.y + SHOWDOWN.high, b.z, { camp: b.camp.id, kind: 'bluster', plan });
      if (!m) return;
      m.body.flying = true;
      m.held = true;
      m.passive = true;
      m.gapScale = 0.8;
      b.monster = m.id;
      b.phase = 'sky';
      b.rods = b.rodSpots.map(() => 0);
      b.throwAt = now + 2000;
      b.dropAt = now + 5000;
      b.turns = b.turns ?? 0;
      b.max ||= Math.round((12 + 6 * Math.min(8, Math.max(1, players))) * 4 * (plan?.hearts ?? 1.25) * geared(this.gear));
      b.hearts ||= b.max;
      b.state = 'on';
      b.quiet = 0;
      out.fx.push({ id: b.id, k: 'show', m: m.id });
    }
    b.last = { x: m.body.x, y: m.body.y, z: m.body.z };
    // Nobody in the arena for a while: back up he goes, and waits.
    if (here.length) b.quiet = 0;
    else {
      b.quiet ||= now;
      if (now - b.quiet >= 20000 && b.phase !== 'sky') this.rise(b, m, now, out);
      if (b.hearts < b.max && now - (b.healAt ?? 0) >= 2000 && now - b.quiet >= 5000) {
        b.hearts++;
        b.healAt = now;
      }
    }
    if (b.phase === 'sky') {
      // Floating round over his arena, out of reach, laughing.
      const t = now / 1000;
      Object.assign(m.body, { x: b.x + Math.sin(t * 0.35) * 4, y: b.y + SHOWDOWN.high + Math.sin(t * 1.3) * 0.4, z: b.z + Math.cos(t * 0.35) * 4, vx: 0, vy: 0, vz: 0, flying: true });
      const look = here[0];
      if (look) m.yaw = Math.atan2(look.x - m.body.x, look.z - m.body.z);
      m.state = now < (b.throwing ?? 0) ? 'hurl' : 'idle';
      // The lightning rods: each charged while someone stands on it, and
      // for a while after; all three at once, and down he comes.
      let charged = 0;
      b.rods.forEach((until, i) => {
        const [rx, ry, rz] = b.rodSpots[i];
        const on = people.filter((p) => able(p) && Math.hypot(p.x - rx - 0.5, p.z - rz - 0.5) <= SHOWDOWN.rodReach && Math.abs(p.y - ry) < 3);
        for (const p of on) out.flag.set(p.id, (out.flag.get(p.id) ?? 0) + dt);
        b.charging ??= [];
        b.charging[i] = on.length ? (b.charging[i] ?? 0) + dt * 1000 : 0;
        if (b.charging[i] >= SHOWDOWN.charge && until < now + SHOWDOWN.holds - 500) {
          if (until <= now) out.fx.push({ id: b.id, k: 'rod', n: i, by: on[0].id });
          b.rods[i] = now + SHOWDOWN.holds;
        }
        if (b.rods[i] > now) charged++;
      });
      if (charged === b.rods.length && b.rods.length) {
        // Zap: down he falls, dazed.
        b.phase = 'ground';
        b.turnFrom = b.hearts;
        b.turnUntil = now + SHOWDOWN.turnMs;
        b.rods = b.rods.map(() => 0);
        b.charging = [];
        Object.assign(m, { held: false, passive: false, dazed: now + SHOWDOWN.dazed, state: 'dazed' });
        Object.assign(m.body, { flying: false, vy: -2 });
        out.fx.push({ id: b.id, k: 'zap', x: +m.body.x.toFixed(2), y: +m.body.y.toFixed(2), z: +m.body.z.toFixed(2) });
        return;
      }
      // Lightning from up there, on whoever is about.
      if (now >= b.throwAt && here.length) {
        b.throwAt = now + SHOWDOWN.every * (b.turns >= 2 ? 0.75 : 1);
        b.throwing = now + 700;
        const fair = here.filter((p) => able(p));
        const to = [];
        for (const p of fair.slice(0, 3)) {
          for (let k = 0; k < 2 && to.length < 4; k++) {
            const a = this.rng.range(-Math.PI, Math.PI);
            const d = k ? this.rng.range(2, 3.5) : 0;
            const x = p.x + Math.sin(a) * d;
            const z = p.z + Math.cos(a) * d;
            const y = standNear(world, x, z, p.y, 3);
            if (y !== null) to.push({ x, y, z });
          }
        }
        if (to.length) out.hurls.push({ id: m.id, what: 'bolt', from: { x: m.body.x, y: m.body.y + 1, z: m.body.z }, to, ms: 1300, reach: 2, bumps: 1.5 });
      }
      // And his Storm Gang dropped in to help.
      if (now >= b.dropAt && here.length) {
        b.dropAt = now + SHOWDOWN.drop;
        const alive = monsters.list.filter((q) => q.camp === b.camp.id && q.id !== m.id).length;
        const gang = this.story.gang ?? ['spiky'];
        for (let i = 0; i < 3 && alive + i < 5 + Math.min(4, players); i++) {
          const kind = gang[(b.turns + i) % gang.length];
          const at = spotAround(world, this.rng, b.x, b.y, b.z, 3, b.r - 2, here, { apart: 4, body: bodyOf(kind) });
          if (at) this.addMonster(world, monsters, b.camp, kind, at);
        }
        out.fx.push({ id: b.id, k: 'drop' });
      }
      return;
    }
    // On the ground: a boss as any is (bosses.js), till he has lost enough
    // hearts (or been down long enough) to puff himself back up.
    if (m.body.y < b.y - 6 || Math.hypot(m.body.x - b.x, m.body.z - b.z) > b.r + 6) {
      // Off the edge of his arena: up he floats again.
      this.rise(b, m, now, out);
      return;
    }
    if (b.hearts > 0 && (b.turnFrom - b.hearts >= b.max * SHOWDOWN.turn || now >= b.turnUntil) && now >= (m.dazed ?? 0)) this.rise(b, m, now, out);
  }

  // The Baron puffing himself back up into the sky over his arena.
  rise(b, m, now, out) {
    b.phase = 'sky';
    b.turns = (b.turns ?? 0) + 1;
    b.throwAt = now + 2200;
    b.dropAt = now + 3000;
    b.rods = b.rods.map(() => 0);
    b.charging = [];
    Object.assign(m, { held: true, passive: true, dazed: 0, move: null, windup: 0, slam: false, dash: null, target: 0, state: 'idle' });
    Object.assign(m.body, { flying: true, vx: 0, vy: 0, vz: 0 });
    out.fx.push({ id: b.id, k: 'up', m: m.id });
  }

  // The showdown going on, if it is: the battle and its Baron.
  get showdown() {
    return this.list.find((b) => b.kind === 'showdown' && b.monster && !b.done) ?? null;
  }

  // A friend bopping the Baron: out of reach up on his cloud; otherwise a
  // heart (three while he sits dazed), each friend once a moment. Returns
  // { shielded }, { wait }, or { hit, hearts, max, beaten, dazed }.
  hitBoss(pid, now, dazed = false, times = 1) {
    const b = this.showdown;
    if (!b) return { wait: true };
    if (b.phase !== 'ground') return { shielded: true };
    b.hits ??= new Map();
    if (now - (b.hits.get(pid) ?? -Infinity) < BOSS_HIT_MS) return { wait: true };
    b.hits.set(pid, now);
    b.hearts = Math.max(0, b.hearts - (dazed ? DAZED_HIT : 1) * times);
    b.hitAt = now;
    return { hit: true, hearts: b.hearts, max: b.max, beaten: b.hearts <= 0, dazed };
  }

  // ------------------------------------------------ the gangs

  // How many gangs roam at once.
  gangsWanted(players) {
    return Math.min(GANG.most, GANG.base + 2 * Math.max(0, this.level - 12) + (players > 2 ? 1 : 0) + (players > 4 ? 1 : 0));
  }

  stepGangs(world, dt, now, people, monsters, players, counts, out) {
    const humans = people.filter((p) => !p.beacon && !p.lure);
    // A new gang now and then, while there are fewer than there should be.
    if (this.roads.length && this.gangs.filter((g) => !g.drop).length < this.gangsWanted(players) && now >= this.gangAt) {
      this.gangAt = now + 1000;
      const g = this.newGang(humans);
      if (g) this.gangs.push(g);
    }
    for (const g of [...this.gangs]) {
      const n = counts.get(g.camp.id) ?? 0;
      const near = humans.some((p) => Math.hypot(p.x - g.camp.x, p.z - g.camp.z) <= GANG.near);
      if (g.awake) {
        if (n === 0 && g.spawned) {
          // Popped, every one of them: gone, and another later somewhere else.
          this.gangs.splice(this.gangs.indexOf(g), 1);
          if (!g.drop) this.gangAt = Math.max(this.gangAt, now + this.rng.range(GANG.back[0], GANG.back[1]));
          out.fx.push({ id: 0, k: 'gang', x: +g.camp.x.toFixed(1), z: +g.camp.z.toFixed(1) });
          continue;
        }
        if (humans.some((p) => Math.hypot(p.x - g.camp.x, p.z - g.camp.z) <= GANG.far)) g.quiet = 0;
        else {
          g.quiet ||= now;
          if (now - g.quiet >= GANG.sleepMs && g.drop) {
            // Dropped out of the clouds and left behind: back up into them.
            for (const m of [...monsters.list]) if (m.camp === g.camp.id) monsters.remove(m.id);
            this.gangs.splice(this.gangs.indexOf(g), 1);
            continue;
          }
          if (now - g.quiet >= GANG.sleepMs) {
            g.left = n;
            for (const m of [...monsters.list]) if (m.camp === g.camp.id) monsters.remove(m.id);
            g.awake = false;
            g.spawned = false;
          }
        }
      } else if (near) {
        this.wakeGang(world, g, humans, monsters);
      }
      // Dropped out of the clouds: after whoever is nearest, a little slower
      // than a walk, so walking off gets away.
      if (g.drop) {
        this.chaseGang(world, g, dt, humans);
        continue;
      }
      // Along its path, while none of it is after anyone (and slowly enough
      // for it to keep up); back the other way at either end, or before a
      // safe place.
      const busy = g.awake && monsters.list.some((m) => m.camp === g.camp.id && m.target);
      if (!busy) this.moveGang(g, dt);
    }
  }

  // A gang at a spot on the paths well away from everyone, where everyone
  // arrives and every battle not yet won; null if there is none just now.
  newGang(people) {
    const kinds = this.story.gang ?? ['blob'];
    for (let tries = 0; tries < 30; tries++) {
      const road = this.roads[this.rng.int(0, this.roads.length - 1)];
      const i = this.rng.int(0, road.length - 1);
      const [x, z] = road[i];
      if (people.some((p) => Math.hypot(p.x - x, p.z - z) < GANG.away)) continue;
      if (Math.hypot(this.spawn.x - x, this.spawn.z - z) < GANG.landing + 8) continue;
      if (this.list.some((b) => !b.done && b.kind !== 'hunt' && Math.hypot(b.x - x, b.z - z) < b.r + 14)) continue;
      if (this.havenList.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 12)) continue;
      if (this.gangs.some((g) => Math.hypot(g.camp.x - x, g.camp.z - z) < 30)) continue;
      const list = this.gangKinds();
      return { camp: { id: 200 + this.nextGang++ % 800, kind: 'arena', x, z, r: GANG.r }, road, at: i, dir: this.rng.chance(0.5) ? 1 : -1, kinds: list, left: list.length, awake: false, spawned: false, quiet: 0 };
    }
    return null;
  }

  // What a gang is: the chapter's own, a knight at its head from the second
  // chapter on, now and then, and a beast now and then on the hardest.
  gangKinds() {
    const kinds = this.story.gang ?? ['blob'];
    const size = Math.min(7, GANG.size + FL((this.level - 12) / 2) + this.rng.int(0, 1));
    const list = [];
    for (let k = 0; k < size; k++) list.push(k === 0 && this.level >= 13 && this.rng.chance(0.5) ? 'knight' : kinds[k % kinds.length]);
    if (this.level >= 15 && this.rng.chance(0.4)) list[1] = TIER1[this.rng.int(0, TIER1.length - 1)];
    return list;
  }

  // A gang out of the clouds (DROP), on whoever has rolled back enough of
  // them, a way off them; never where everyone arrives, in a safe place or a
  // battle not yet won.
  stepDrops(world, now, people, monsters, out) {
    if (now < this.dropAt || this.fog.all) return;
    for (const p of people) {
      if (!able(p)) continue;
      if (!this.dropNeed.has(p.id)) this.dropNeed.set(p.id, this.rng.int(DROP.tiles[0], DROP.tiles[1]));
      if ((this.rolled.get(p.id) ?? 0) < this.dropNeed.get(p.id)) continue;
      if (Math.hypot(p.x - this.spawn.x, p.z - this.spawn.z) < GANG.landing) continue;
      if (this.havenList.some((h) => Math.hypot(h.x - p.x, h.z - p.z) < h.r + 8)) continue;
      if (this.list.some((b) => !b.done && Math.hypot(b.x - p.x, b.z - p.z) < (b.r ?? 8) + 12)) continue;
      const kinds = this.gangKinds();
      const at = spotAround(world, this.rng, p.x, p.y, p.z, DROP.from[0], DROP.from[1], people, { apart: 6, rise: 6, body: bodyOf(kinds[0]) });
      if (!at) continue;
      const g = { camp: { id: 200 + this.nextGang++ % 800, kind: 'arena', x: at.x, z: at.z, r: GANG.r }, road: null, at: 0, dir: 1, kinds, left: kinds.length, awake: false, spawned: false, quiet: 0, drop: true };
      this.wakeGang(world, g, people, monsters, at.y);
      if (!g.awake) continue;
      this.gangs.push(g);
      this.rolled.set(p.id, 0);
      this.dropNeed.delete(p.id);
      this.dropAt = now + DROP.ms;
      out.fx.push({ id: 0, k: 'cloud', x: +at.x.toFixed(1), y: at.y, z: +at.z.toFixed(1), to: p.id });
      return;
    }
  }

  // A gang dropped out of the clouds, its middle after the nearest of
  // everyone (as far as it can see), a little slower than a walk.
  chaseGang(world, g, dt, people) {
    let best = null;
    let far = GANG.far;
    for (const p of people) {
      const d = Math.hypot(p.x - g.camp.x, p.z - g.camp.z);
      if (d < far && able(p)) {
        far = d;
        best = p;
      }
    }
    if (!best || far < 2) return;
    const step = Math.min(far, dt * 3.6);
    const x = g.camp.x + ((best.x - g.camp.x) / far) * step;
    const z = g.camp.z + ((best.z - g.camp.z) / far) * step;
    // (Never into a safe place.)
    if (this.havenList.some((h) => Math.hypot(h.x - x, h.z - z) < h.r) || Math.hypot(this.spawn.x - x, this.spawn.z - z) < GANG.landing / 2) return;
    g.camp.x = x;
    g.camp.z = z;
  }

  // A gang out, near someone: as many as it has left, round its middle
  // (none of them with room there just now: it waits, still asleep), on the
  // ground there (or about `y`).
  wakeGang(world, g, people, monsters, y = groundY(world, g.camp.x, g.camp.z) ?? world.sea + 2) {
    let n = 0;
    for (const kind of g.kinds.slice(0, g.left)) {
      const at = spotAround(world, this.rng, g.camp.x, y, g.camp.z, 0.5, GANG.r - 2, people, { apart: 5, body: bodyOf(kind), rise: 6 });
      if (at && this.addMonster(world, monsters, g.camp, kind, at)) n++;
    }
    if (!n) return;
    g.awake = true;
    g.quiet = 0;
    g.spawned = true;
  }

  moveGang(g, dt) {
    const road = g.road;
    let left = dt * GANG.pace;
    for (let guard = 0; guard < 8 && left > 0; guard++) {
      const next = g.at + g.dir;
      if (next < 0 || next >= road.length) {
        g.dir = -g.dir;
        continue;
      }
      const [tx, tz] = road[next];
      // (Nor up to a battle not yet won: that is its own Storm Gang's. And
      // never anywhere near where everyone lands.)
      if (Math.hypot(this.spawn.x - tx, this.spawn.z - tz) < GANG.landing || this.havens(9).some((h) => Math.hypot(h.x - tx, h.z - tz) < h.r + g.camp.r + 2) || this.list.some((b) => !b.done && b.kind !== 'hunt' && Math.hypot(b.x - tx, b.z - tz) < b.r + 10)) {
        g.dir = -g.dir;
        break;
      }
      const dx = tx - g.camp.x;
      const dz = tz - g.camp.z;
      const d = Math.hypot(dx, dz);
      if (d <= left) {
        g.camp.x = tx;
        g.camp.z = tz;
        g.at = next;
        left -= d;
      } else {
        g.camp.x += (dx / d) * left;
        g.camp.z += (dz / d) * left;
        left = 0;
      }
    }
  }

  // ------------------------------------------------ for the wire

  // How each battle is going, a few times a second: [id, state, a, b, c],
  // state as STATES numbers it; a, b, c by its kind — an ambush its wave and
  // how many there are, a siege its hearts, the most it has and the seconds
  // left (lighting: how far, in hundredths), a nest how many nests are left
  // and of how many, a hunt its Big Bad's hearts and the most, the showdown
  // its turn and which rods are charged (a bit each).
  pack(now) {
    return this.list.map((b) => {
      const s = b.done ? 2 : !this.open(b) ? 3 : b.state === 'on' ? 1 : 0;
      if (b.kind === 'ambush') return [b.id, s, b.wave ?? 0, b.waves ?? 0, 0];
      if (b.kind === 'siege') return b.state === 'on' && !b.done ? [b.id, s, b.hearts, b.max, Math.max(0, Math.ceil((b.until - now) / 1000))] : [b.id, s, 0, 0, Math.round(((b.light ?? 0) / SIEGE.light) * 100)];
      if (b.kind === 'nest') return [b.id, s, b.nests ? b.nests.filter((n) => !n.popped).length : b.spots.length, b.spots.length, 0];
      if (b.kind === 'hunt') return [b.id, s, b.hearts ?? 0, b.max ?? 0, b.lure ? 1 : 0];
      if (b.kind === 'showdown') return [b.id, s, b.turns ?? 0, (b.rods ?? []).reduce((bits, until, i) => bits | (until > now ? 1 << i : 0), 0), b.phase === 'ground' ? 1 : 0];
      return [b.id, s, 0, 0, 0];
    });
  }

  // What everyone needs to know of them as they arrive: each battle, where it
  // is and its parts.
  describe() {
    return this.list.map((b) => ({
      id: b.id,
      kind: b.kind,
      x: b.x,
      y: b.y,
      z: b.z,
      r: b.r,
      ...(b.prize ? { prize: b.prize } : {}),
      ...(b.beacon ? { beacon: b.beacon } : {}),
      ...(b.spots && b.kind === 'nest' ? { spots: b.spots } : {}),
      ...(b.rodSpots ? { rods: b.rodSpots } : {}),
      ...(b.kind === 'hunt' ? { range: b.range.map(([x, z]) => [Math.round(x), Math.round(z)]) } : {}),
      done: b.done,
    }));
  }

  // Battles won before (kept over a restart), won again with nobody there:
  // the cells that make the island look it.
  restore(ids, world) {
    const cells = [];
    for (const id of ids) {
      const b = this.byId(id);
      if (!b || b.done) continue;
      b.done = true;
      b.state = 'done';
      if (b.kind === 'ambush') cells.push(b.prize[0], b.prize[1], b.prize[2], B.AIR);
      if (b.kind === 'siege') cells.push(b.beacon[0], b.beacon[1], b.beacon[2], B.CAMPFIRE);
      const at = b.kind === 'hunt' ? { x: b.camp.x, z: b.camp.z } : b;
      this.havenList.push({ x: at.x, z: at.z, r: b.kind === 'hunt' ? 7 : Math.min(12, (b.r ?? 8) + 0.5), battle: b.id, y: b.y });
    }
    for (let i = 0; i < cells.length; i += 4) world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
    return cells;
  }
}

// ---------------------------------------------------------------- the ring

// An ambush's ring of thorns: round the edge of its clearing, AMBUSH.high
// blocks over the ground (and over the tallest ground beside it), every
// cell there that is air or something growing. As [x, y, z, was] each.
export function ringCells(world, b) {
  const cells = [];
  const r = b.r;
  const seen = new Set();
  for (let dx = -r - 1; dx <= r + 1; dx++) {
    for (let dz = -r - 1; dz <= r + 1; dz++) {
      const d = Math.hypot(dx, dz);
      if (d < r - 0.5 || d >= r + 0.5) continue;
      const x = FL(b.x) + dx;
      const z = FL(b.z) + dz;
      const key = `${x},${z}`;
      if (seen.has(key) || x < 0 || z < 0 || x >= world.W || z >= world.D) continue;
      seen.add(key);
      let g = world.top(x, z);
      while (g > 0 && (B.TREE_PART[world.get(x, g, z)] || !B.SOLID[world.get(x, g, z)])) g--;
      let top = g;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) top = Math.max(top, Math.min(g + 4, world.top(x + ox, z + oz)));
      for (let y = g + 1; y <= top + AMBUSH.high && y < world.H; y++) {
        const id = world.get(x, y, z);
        if (id === B.AIR || B.KIND[id] === B.K_PLANT || id === B.WATER) cells.push(x, y, z, id);
      }
    }
  }
  return cells;
}

// The edit that puts a ring up (or takes it down again).
function ringEdit(ring, up) {
  const out = [];
  for (let i = 0; i < ring.length; i += 4) out.push(ring[i], ring[i + 1], ring[i + 2], up ? B.BRAMBLE : ring[i + 3]);
  return out;
}
