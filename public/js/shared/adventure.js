// Adventure islands: grumpy monsters have taken over parts of the island.
// Each of their camps is gloomy ground behind a fence of logs, with their
// flag in the middle, and King Grumble sits in his castle, safe in a magic
// bubble. Friends free the island together:
//
// - A camp's monsters come out when someone comes near, and keep to their
//   camp, chasing whoever comes in. One popped comes back a while later,
//   until the camp is free.
// - Standing by the flag with no monster in the camp lowers it and raises
//   the island's own, and the more friends stand there, the faster it goes.
//   Up all the way, the camp is free: its ground turns back into grass and
//   flowers, its monsters go, and it is a safe place, where anyone out of
//   hearts comes back.
// - With every camp free, King Grumble's bubble pops. Big and slow, he
//   stomps the ground (jump, and it misses you), and sits dazed after,
//   when a bop counts three times. He calls little monsters to help him,
//   and the fewer hearts he has, the quicker he is and the more often he
//   stomps. Left alone, he gets hearts back. Each friend can bop him about
//   once a second, so the more of you there are, the sooner he goes pop,
//   and the whole island is free.
// - Out of hearts with a friend on the island, you sit dizzy for a while,
//   until a friend comes and taps you to help you up (or you go back to the
//   nearest safe place).
//
// The island is made with its camps (buildCamps, from worldgen.js), and the
// host runs the rest (AdventureSim, from room.js), as it runs the monsters.
import * as B from './blocks.js';
import { CRITTER_INFO, standHeight } from './critters.js';
import { campDistance, DAZED_HIT, SAFE_RADIUS } from './monsters.js';
import { hash2, Rng } from './rng.js';

// A camp's fence goes round this far from its flag; King Grumble's castle
// is a square this far from its middle to its walls.
export const CAMP_RADIUS = 7;
export const CASTLE_RADIUS = 10;
// How near the flag you stand to raise it, and how many seconds that takes
// for one friend, two, three, and four or more.
export const FLAG_REACH = 3.5;
const RAISE_SECONDS = [Infinity, 10, 6, 4.5, 4];
export const raiseSeconds = (friends) => RAISE_SECONDS[Math.max(0, Math.min(4, friends))];
// Anyone this far beyond a camp's fence wakes its monsters; with nobody near
// for a while, they go back to sleep.
export const WAKE = 34;
export const SLEEP_MS = 15000;
// A camp's monster popped comes back this long after, while the camp is not free.
export const GUARD_BACK_MS = 20000;
// How many monsters keep a camp: more with more friends on the island.
export const guardsFor = (players) => Math.min(5, 1 + Math.max(1, players));
// King Grumble's hearts, more with more friends on the island; each friend
// can bop him once in this long. Nobody bopping him for KING_HEAL_MS, he
// gets a heart back, and another every KING_HEAL_EVERY after.
export const kingHearts = (players) => 12 + 6 * Math.min(8, Math.max(1, players));
export const KING_HIT_MS = 800;
export const KING_HEAL_MS = 8000;
const KING_HEAL_EVERY = 2000;
// Out of hearts with a friend about: dizzy this long, unless a friend this
// near taps you, which gets you up with this many hearts.
export const DIZZY_MS = 10000;
export const HELP_REACH = 4;
export const HELP_HEARTS = 3;

const FL = Math.floor;
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const PURPLE = B.TOY_BRICKS[8];

// How many camps an island gets: three on a cozy one, more on a bigger one.
export function campCount(world) {
  return Math.max(1, Math.round(4 * Math.sqrt((world.W * world.D) / (128 * 128)) - 1));
}

// ---------------------------------------------------------------- making them

// What is not the ground: trees (candy trees have trunks of white bricks).
const TREE = new Uint8Array(256);
for (const id of [B.WOOD, B.LEAVES, B.PINE_LEAVES, B.SNOWY_LEAVES, B.COTTON_CANDY, B.TOY_BRICKS[11]]) TREE[id] = 1;

// The height of the ground in every column, under any tree, and whether it
// is under water: the sea (1), or a pond or ice above the sea (2).
export function groundMap(world) {
  const { W, D, H, sea } = world;
  const ground = new Int16Array(W * D);
  const wet = new Uint8Array(W * D);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const base = (x * D + z) * H;
      let y = H - 1;
      for (; y > 0; y--) {
        const id = world.blocks[base + y];
        if (B.SOLID[id] && !TREE[id]) break;
      }
      const k = x * D + z;
      ground[k] = y;
      let top = y;
      while (top + 1 < H && world.blocks[base + top + 1] === B.WATER) top++;
      if (world.blocks[base + y] === B.ICE || top > Math.max(y, sea)) wet[k] = 2;
      else if (top > y || y < sea) wet[k] = 1;
    }
  }
  return { ground, wet };
}

// The ground round (cx, cz), reach out (in a square, or a circle): how high
// it lies (its middle height, never below just over the sea), how uneven it
// is and how much of it the sea covers; null where it does not fit, or a
// pond is in the way.
function survey(map, world, cx, cz, reach, square) {
  const { W, D } = world;
  if (cx - reach < 2 || cz - reach < 2 || cx + reach > W - 3 || cz + reach > D - 3) return null;
  const heights = [];
  let n = 0;
  let wet = 0;
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      if (!square && dx * dx + dz * dz > reach * reach) continue;
      const k = (cx + dx) * D + cz + dz;
      n++;
      if (map.wet[k] === 2) return null;
      if (map.wet[k]) wet++;
      else heights.push(map.ground[k]);
    }
  }
  if (heights.length < n * 0.6) return null;
  heights.sort((a, b) => a - b);
  const at = (q) => heights[Math.floor(q * (heights.length - 1))];
  return { level: Math.max(world.sea + 2, at(0.5)), spread: at(0.95) - at(0.05), wet: wet / n };
}

// Looser and looser, until there is a spot: flat dry land first.
const PASSES = [
  { spread: 3, wet: 0 },
  { spread: 6, wet: 0.03 },
  { spread: 10, wet: 0.15 },
  { spread: 18, wet: 0.35 },
];

// The best spot for a camp of radius r (a square castle, or a round camp):
// on ground flat enough to build on, away from the start, the other camps,
// the ways into the mines and the vehicles. far: as far from the start as it
// can be (the castle); otherwise as far as it can be from the start and the
// camps already there, so they spread out over the island.
function choose(world, map, rng, { r, square, far, taken, mines, vehicles }) {
  const reach = r + 3;
  const bound = square ? reach * Math.SQRT2 : reach;
  const spawn = world.spawn;
  const lo = reach + 3;
  for (const pass of PASSES) {
    let best = null;
    for (let tries = 0; tries < 500; tries++) {
      const cx = rng.int(lo, world.W - 1 - lo);
      const cz = rng.int(lo, world.D - 1 - lo);
      const x = cx + 0.5;
      const z = cz + 0.5;
      const start = Math.hypot(x - spawn.x, z - spawn.z) - bound;
      if (start < (far ? 10 : 12)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.bound + bound + 6)) continue;
      if (mines.some((m) => Math.hypot(m.x - cx, m.z - cz) < bound + 8 || m.way.some((w) => Math.hypot(w.x - cx, w.z - cz) < bound + 4))) continue;
      if (vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < bound + 2)) continue;
      const s = survey(map, world, cx, cz, reach, square);
      if (!s || s.spread > pass.spread || s.wet > pass.wet) continue;
      const room = far ? start : Math.min(start, ...taken.map((t) => Math.hypot(t.x - x, t.z - z) - t.bound));
      const score = room - s.spread * 2 - s.wet * 20 + rng.next();
      if (!best || score > best.score) best = { cx, cz, x, z, level: s.level, bound, r, square, score };
    }
    if (best) return best;
  }
  return null;
}

// Levels the ground round a camp at its height, out to just past its fence,
// sloping back to the land as it was a little further out (where the sea
// is, it stays), and lays the gloomy ground: all of the camp, and some
// round it, ragged at the edge. Nothing stays standing on it, and no jewel
// shows in it.
function flatten(world, map, pal, spot) {
  const { cx, cz, level, r, square } = spot;
  const { H, D } = world;
  const outer = r + 3;
  for (let dx = -outer; dx <= outer; dx++) {
    for (let dz = -outer; dz <= outer; dz++) {
      const d = square ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
      if (d > outer + 0.5) continue;
      const x = cx + dx;
      const z = cz + dz;
      const k = x * D + z;
      const wet = map.wet[k];
      if (wet && d > r + 1) continue;
      const g = map.ground[k];
      const t = d <= r + 1 ? 0 : Math.min(1, (d - (r + 1)) / (outer + 0.5 - (r + 1)));
      const target = wet ? level : Math.round(level + (g - level) * t * t * (3 - 2 * t));
      for (let y = target + 1; y < H; y++) if (world.get(x, y, z) !== B.AIR) world.set(x, y, z, B.AIR);
      if (target > g) for (let y = g + 1; y <= target; y++) world.set(x, y, z, y === target ? pal.top : pal.under);
      else if (target < g || d <= r + 1) world.set(x, target, z, pal.top);
      for (let y = target - 2; y < target; y++) if (B.GEM_ROCK[world.get(x, y, z)]) world.set(x, y, z, pal.under);
      if (d <= r + 0.6 + hash2(world.seed + 97, x, z) * 2.2) world.set(x, target, z, B.GLOOM);
    }
  }
}

// A camp's fence: logs round it, every other one a little taller, with two
// ways in (one facing the start, one behind), each with a lamp on a post at
// either side; a little stone floor for the flag in the middle, and hay
// bales for the monsters to sleep on.
function campFence(world, rng, spot, gate) {
  const { cx, cz, r } = spot;
  const y0 = spot.level + 1;
  const half = 1.6 / r;
  const ways = [gate, gate + Math.PI];
  for (let dx = -r - 1; dx <= r + 1; dx++) {
    for (let dz = -r - 1; dz <= r + 1; dz++) {
      const d = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx);
      if (d < r - 0.5 || d >= r + 0.5 || ways.some((w) => Math.abs(wrap(a - w)) < half)) continue;
      const tall = ((dx + dz) & 1) === 0 ? 3 : 2;
      for (let y = 0; y < tall; y++) world.set(cx + dx, y0 + y, cz + dz, B.WOOD);
    }
  }
  for (const w of ways) {
    for (const side of [-1, 1]) {
      const a = w + side * (half + 0.9 / r);
      const x = cx + Math.round(Math.cos(a) * r);
      const z = cz + Math.round(Math.sin(a) * r);
      for (let y = 0; y < 3; y++) world.set(x, y0 + y, z, B.WOOD);
      world.set(x, y0 + 3, z, B.LAMP);
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + dx, y0, cz + dz, B.PEBBLES);
  for (let tries = 0, hay = 0; tries < 40 && hay < 3; tries++) {
    const a = rng.range(-Math.PI, Math.PI);
    if (ways.some((w) => Math.abs(wrap(a - w)) < 0.8)) continue;
    const d = rng.range(3, r - 2.5);
    const x = cx + Math.round(Math.cos(a) * d);
    const z = cz + Math.round(Math.sin(a) * d);
    if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) <= 2 || world.get(x, y0, z) !== B.AIR) continue;
    world.set(x, y0, z, B.HAY);
    hay++;
  }
}

// King Grumble's castle: stone walls five high with battlements and a purple
// stripe, a tower at each corner with a lamp on top, lamps in the middle of
// the walls, and a way in, three wide and four high, in the wall facing the
// start; the stone floor for his flag in the middle of the yard.
function castleWalls(world, spot, side) {
  const { cx, cz, r: R } = spot;
  const y0 = spot.level + 1;
  for (let dx = -R - 1; dx <= R + 1; dx++) {
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      const ax = Math.abs(dx);
      const az = Math.abs(dz);
      const x = cx + dx;
      const z = cz + dz;
      if (ax >= R - 1 && az >= R - 1) {
        for (let y = 0; y < 8; y++) world.set(x, y0 + y, z, B.BRICK_WALL);
        if (ax === R && az === R) world.set(x, y0 + 8, z, B.LAMP);
        else if (((dx + dz) & 1) === 0) world.set(x, y0 + 8, z, B.BRICK_WALL);
        continue;
      }
      if (Math.max(ax, az) !== R) continue;
      for (let y = 0; y < 5; y++) world.set(x, y0 + y, z, y === 3 && ((dx + dz) & 3) === 0 ? PURPLE : B.BRICK_WALL);
      if (((dx + dz) & 1) === 0) world.set(x, y0 + 5, z, B.BRICK_WALL);
    }
  }
  for (const [sx, sz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = cx + sx * R;
    const z = cz + sz * R;
    if (sx === side[0] && sz === side[1]) {
      for (let p = -1; p <= 1; p++) for (let y = 0; y < 4; y++) world.set(x + (sz ? p : 0), y0 + y, z + (sx ? p : 0), B.AIR);
    } else {
      world.set(x, y0 + 2, z, B.LAMP);
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + dx, y0, cz + dz, B.PEBBLES);
}

// Builds an adventure island's camps and King Grumble's castle on a newly
// made island (last, from randomness of their own, so the rest of it comes
// out as it would without). pal: the island's ground (worldgen.js palette);
// trees: as worldgen.js grew them, to take down those in the way; critters:
// the animals and vehicles, to keep out of the camps; mines: their ways in,
// to keep clear. Returns { camps, critters }: each camp as
// { id, kind: 'camp' or 'castle', x, y, z, r }, numbered from the one
// nearest the start, with the castle last; (x, y, z) is where its flag
// stands, on the ground in the middle; and the critters left.
export function buildCamps(world, rng, { pal, trees = [], critters = [], mines = [] }) {
  const map = groundMap(world);
  const vehicles = critters.filter((c) => CRITTER_INFO[c.type]?.vehicle);
  const spots = [];
  const castle = choose(world, map, rng, { r: CASTLE_RADIUS, square: true, far: true, taken: spots, mines, vehicles });
  if (castle) spots.push({ ...castle, kind: 'castle' });
  for (let i = 0; i < campCount(world); i++) {
    const camp = choose(world, map, rng, { r: CAMP_RADIUS, square: false, far: false, taken: spots, mines, vehicles });
    if (!camp) break;
    spots.push({ ...camp, kind: 'camp' });
  }
  // The trees in the way come down.
  for (const t of trees) {
    if (!t.cells || !spots.some((s) => Math.hypot(t.x + 0.5 - s.x, t.z + 0.5 - s.z) < s.bound + 4)) continue;
    for (const [x, y, z, id] of t.cells) if (world.get(x, y, z) === id) world.set(x, y, z, B.AIR);
  }
  const spawn = world.spawn;
  for (const s of spots) {
    flatten(world, map, pal, s);
    const toStart = Math.atan2(spawn.z - s.z, spawn.x - s.x);
    if (s.kind === 'castle') {
      const dx = spawn.x - s.x;
      const dz = spawn.z - s.z;
      castleWalls(world, s, Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1]);
    } else {
      campFence(world, rng, s, toStart);
    }
  }
  const near = (s) => Math.hypot(s.x - spawn.x, s.z - spawn.z);
  const ordered = [...spots.filter((s) => s.kind === 'camp').sort((a, b) => near(a) - near(b)), ...spots.filter((s) => s.kind === 'castle')];
  const camps = ordered.map((s, i) => ({ id: i + 1, kind: s.kind, x: s.x, y: s.level + 1, z: s.z, r: s.r }));
  // No animal lives in a monsters' camp (the vehicles were kept clear of them).
  const left = critters.filter((c) => CRITTER_INFO[c.type]?.vehicle || !spots.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < s.bound + 1));
  return { camps, critters: left };
}

// A camp freed: its gloomy ground back to the island's own (pal.top), with
// flowers coming up here and there. Returns the cells, as an edit.
export function freeCells(world, camp, pal, rng) {
  const cells = [];
  const reach = camp.r + 4;
  const cx = FL(camp.x);
  const cz = FL(camp.z);
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (campDistance(camp, x + 0.5, z + 0.5) > reach) continue;
      for (let y = 1; y < world.H - 1; y++) {
        if (world.get(x, y, z) !== B.GLOOM) continue;
        cells.push(x, y, z, pal.top);
        if (world.get(x, y + 1, z) === B.AIR && rng.chance(0.2)) cells.push(x, y + 1, z, rng.pick(pal.flowers));
      }
    }
  }
  return cells;
}

// ---------------------------------------------------------------- playing them

const noKing = () => ({ id: 0, hearts: 0, max: 0, minions: 0, hits: new Map(), hitAt: 0, healAt: 0 });

export class AdventureSim {
  // camps: as buildCamps makes them (and saves keep them), with whether
  // each is free; won: King Grumble popped, and the whole island free.
  constructor({ camps = [], won = false } = {}, seed = 1) {
    this.rng = new Rng(seed);
    this.camps = camps.map((c) => {
      const freed = Boolean(c.freed) || Boolean(won);
      return { id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed, progress: freed ? 1 : 0, awake: false, quiet: 0, back: [], holders: 0, guarded: false };
    });
    this.won = Boolean(won) || (this.camps.length > 0 && this.camps.every((c) => c.freed));
    this.king = noKing();
  }

  // Whether there is anything left to free.
  get active() {
    return !this.won && this.camps.length > 0;
  }

  get castle() {
    return this.camps.find((c) => c.kind === 'castle') ?? null;
  }

  // King Grumble is in his bubble while any camp is not free.
  get shielded() {
    return this.camps.some((c) => c.kind === 'camp' && !c.freed);
  }

  campById(id) {
    return this.camps.find((c) => c.id === id) ?? null;
  }

  // How the adventure is going, for the list of open islands.
  tally() {
    const camps = this.camps.filter((c) => c.kind === 'camp');
    return { camps: camps.length, freed: camps.filter((c) => c.freed).length, won: this.won };
  }

  // The safe places no monster goes into: the island's start, and every
  // camp freed (the castle too, once the island is).
  havens(world) {
    const out = [{ x: world.spawn.x, z: world.spawn.z, r: SAFE_RADIUS }];
    for (const c of this.camps) if (c.freed) out.push({ x: c.x, z: c.z, r: c.r + 0.5, kind: c.kind });
    return out;
  }

  // Where someone out of hearts at (x, z) comes back: the nearest safe
  // place, beside its flag (or the island's start).
  homeFor(world, x, z) {
    let best = { x: world.spawn.x, y: world.spawn.y, z: world.spawn.z };
    let far = Math.hypot(x - best.x, z - best.z);
    for (const c of this.camps) {
      if (!c.freed) continue;
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < far) {
        far = d;
        best = { x: c.x, y: c.y, z: c.z + 2 };
      }
    }
    return best;
  }

  // Moves it all on by dt seconds: camps waking and sleeping, monsters coming
  // back, flags going up, King Grumble's helpers. people: as for the
  // monsters (MonsterSim.step); players: how many are on the island. Returns
  // what happened, for the room to make happen and tell everyone:
  //   { t: 'freed', camp, by, gone, shieldDown, won }
  step(world, dt, now, people, monsters, players) {
    const news = [];
    if (!this.active) return news;
    const want = guardsFor(players);
    for (const c of this.camps) {
      if (c.freed) continue;
      if (people.some((p) => campDistance(c, p.x, p.z) <= c.r + WAKE)) {
        c.quiet = 0;
        if (!c.awake) this.wake(world, c, people, monsters, players);
      } else if (c.awake) {
        c.quiet ||= now;
        if (now - c.quiet >= SLEEP_MS) this.sleep(c, monsters);
      }
      if (!c.awake) continue;
      if (c.kind === 'castle') this.stepCastle(world, c, now, monsters);
      else this.stepCamp(world, c, dt, now, people, monsters, want, news);
    }
    return news;
  }

  // Someone came near: out come its monsters (or King Grumble, with his
  // hearts for as many friends as are on the island now).
  wake(world, c, people, monsters, players) {
    c.awake = true;
    c.back = [];
    if (c.kind === 'castle') {
      const at = this.kingSpot(world, c);
      const m = monsters.add(world, at.x, at.y, at.z, { camp: c.id, kind: 'king' });
      m.passive = this.shielded;
      this.king = { ...noKing(), id: m.id, hearts: kingHearts(players), max: kingHearts(players) };
      return;
    }
    for (let i = 0; i < guardsFor(players); i++) this.addGuard(world, c, people, monsters);
  }

  // Nobody near for a while: its monsters go back in, and come out afresh
  // next time (King Grumble with all his hearts again). How far a flag got
  // stays.
  sleep(c, monsters) {
    Object.assign(c, { awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    for (const m of [...monsters.list]) if (m.camp === c.id) monsters.remove(m.id);
    if (c.kind === 'castle') this.king = noKing();
  }

  // King Grumble's place in his yard: beside his flag, on the far side from the start.
  kingSpot(world, c) {
    const spawn = world.spawn;
    const spots = [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ].map(([dx, dz]) => ({ x: c.x + dx, y: c.y, z: c.z + dz }));
    return spots.reduce((a, b) => (Math.hypot(b.x - spawn.x, b.z - spawn.z) > Math.hypot(a.x - spawn.x, a.z - spawn.z) ? b : a));
  }

  // A camp's monster hopping out: somewhere in the camp, not right beside anyone.
  addGuard(world, c, people, monsters) {
    for (let tries = 0; tries < 30; tries++) {
      const a = this.rng.range(-Math.PI, Math.PI);
      const d = this.rng.range(2.5, Math.max(3, c.r - 2.5));
      const x = FL(c.x + Math.cos(a) * d) + 0.5;
      const z = FL(c.z + Math.sin(a) * d) + 0.5;
      const y = standHeight(world, x, z, c.y + 2);
      if (y === null || Math.abs(y - c.y) > 3) continue;
      if (people.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      return monsters.add(world, x, y, z, { camp: c.id });
    }
    return monsters.add(world, c.x + 2.5, c.y, c.z, { camp: c.id });
  }

  // A camp awake: its popped monsters coming back, and its flag going up
  // while friends on foot stand by it with none of its monsters in the camp.
  stepCamp(world, c, dt, now, people, monsters, want, news) {
    let count = 0;
    for (const m of monsters.list) if (m.camp === c.id) count++;
    while (c.back.length && c.back[0] <= now) {
      c.back.shift();
      if (count < want && this.addGuard(world, c, people, monsters)) count++;
    }
    // A friend came to the island: one more on its way.
    if (count + c.back.length < want) c.back.push(now + GUARD_BACK_MS);
    c.holders = people.filter((p) => !p.flying && !p.riding && !p.dizzy && Math.hypot(p.x - c.x, p.z - c.z) <= FLAG_REACH && p.y > c.y - 1.5 && p.y < c.y + 3.5).length;
    c.guarded = monsters.list.some((m) => m.camp === c.id && campDistance(c, m.body.x, m.body.z) <= c.r + 0.5);
    if (!c.holders || c.guarded) return;
    c.progress = Math.min(1, c.progress + dt / raiseSeconds(c.holders));
    if (c.progress >= 1) news.push(this.free(c, people, monsters));
  }

  // The camp is free: its monsters go, and whoever was there helped. With
  // that the last camp, King Grumble's bubble pops (and on an island
  // without a castle, that is the island free).
  free(c, people, monsters) {
    const shielded = this.shielded;
    Object.assign(c, { freed: true, progress: 1, awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    const gone = [];
    for (const m of [...monsters.list]) if (m.camp === c.id) gone.push(monsters.remove(m.id));
    const by = people.filter((p) => campDistance(c, p.x, p.z) <= c.r + 12).map((p) => p.id);
    const won = !this.castle && this.camps.every((o) => o.freed);
    if (won) this.won = true;
    return { t: 'freed', camp: c, by, gone, shieldDown: shielded && !this.shielded, won };
  }

  // King Grumble's yard: in his bubble he is no trouble; out of it, he calls
  // two little monsters to help him when he is down to two thirds of his
  // hearts, and two more at a third, getting crosser each time; and left
  // alone a while, he gets his hearts back one by one.
  stepCastle(world, c, now, monsters) {
    const k = this.king;
    let king = monsters.get(k.id);
    // Gone by himself (into water someone poured in): back in his yard, as he was.
    if (!king) {
      const at = this.kingSpot(world, c);
      king = monsters.add(world, at.x, at.y, at.z, { camp: c.id, kind: 'king' });
      k.id = king.id;
    }
    king.passive = this.shielded;
    if (king.passive) return;
    if (k.hearts < k.max && now - Math.max(k.hitAt, k.healAt) >= (k.healAt > k.hitAt ? KING_HEAL_EVERY : KING_HEAL_MS)) {
      k.hearts++;
      k.healAt = now;
    }
    const due = k.hearts <= k.max / 3 ? 2 : k.hearts <= (k.max * 2) / 3 ? 1 : 0;
    king.rage = due;
    while (k.minions < due) {
      k.minions++;
      for (const side of [-1, 1]) {
        const a = king.yaw + side * 1.2;
        const x = king.body.x + Math.sin(a) * 2.2;
        const z = king.body.z + Math.cos(a) * 2.2;
        const y = standHeight(world, x, z, king.body.y + 1) ?? king.body.y;
        monsters.add(world, x, y, z, { camp: c.id });
      }
    }
  }

  // One of a camp's monsters popped (or gone by itself): back it comes in a
  // while, while the camp is not free. King Grumble's helpers do not.
  guardGone(m, now) {
    const c = this.campById(m.camp);
    if (!c || c.freed || !c.awake || c.kind !== 'camp' || m.kind !== 'blob') return;
    c.back.push(now + GUARD_BACK_MS);
  }

  // A friend bopping King Grumble: nothing gets through his bubble, each
  // friend can bop him once a moment, and while he sits dazed a bop takes
  // DAZED_HIT hearts; times: how many times over a bop counts (a Star
  // Hammer's, see shop.js). Returns { shielded }, { wait }, or
  // { hit, hearts, max, beaten, dazed }.
  hitKing(pid, now, dazed = false, times = 1) {
    if (this.shielded) return { shielded: true };
    const k = this.king;
    if (!k.id || k.hearts <= 0) return { wait: true };
    if (now - (k.hits.get(pid) ?? -Infinity) < KING_HIT_MS) return { wait: true };
    k.hits.set(pid, now);
    k.hearts = Math.max(0, k.hearts - (dazed ? DAZED_HIT : 1) * times);
    k.hitAt = now;
    return { hit: true, hearts: k.hearts, max: k.max, beaten: k.hearts <= 0, dazed };
  }

  // King Grumble popped: the whole island is free. Every monster of every
  // camp goes; returns them.
  win(monsters) {
    this.won = true;
    for (const c of this.camps) Object.assign(c, { freed: true, progress: 1, awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    this.king = noKing();
    const gone = [];
    for (const m of [...monsters.list]) if (m.camp) gone.push(monsters.remove(m.id));
    return gone;
  }

  // What everyone needs to know as they arrive.
  describe() {
    return {
      camps: this.camps.map((c) => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed: c.freed, progress: +c.progress.toFixed(3) })),
      won: this.won,
      ...this.pack(),
    };
  }

  // What changes as it goes, a few times a second: how far up each flag is
  // that has been started on or is being guarded ([id, percent, friends by
  // it, guarded]), and King Grumble's hearts while he is about.
  pack() {
    return {
      c: this.camps.filter((c) => !c.freed && (c.awake || c.progress > 0)).map((c) => [c.id, Math.floor(c.progress * 100), c.holders, c.guarded ? 1 : 0]),
      k: this.king.id ? [this.king.hearts, this.king.max] : null,
      shield: this.shielded,
    };
  }

  save() {
    return { camps: this.camps.map(({ id, kind, x, y, z, r, freed }) => ({ id, kind, x, y, z, r, freed })), won: this.won };
  }

  // An adventure as saved, checked, or null for none.
  static load(raw, world, seed) {
    if (!raw || !Array.isArray(raw.camps)) return null;
    const camps = [];
    for (const c of raw.camps.slice(0, 32)) {
      if (!Number.isInteger(c?.id) || c.id < 1 || camps.some((o) => o.id === c.id)) continue;
      if (c.kind !== 'camp' && c.kind !== 'castle') continue;
      if (![c.x, c.y, c.z, c.r].every(Number.isFinite)) continue;
      if (c.x < 0 || c.z < 0 || c.x > world.W || c.z > world.D || c.y < 1 || c.y > world.H || c.r < 2 || c.r > 20) continue;
      camps.push({ id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed: c.freed === true });
    }
    return camps.length ? new AdventureSim({ camps, won: raw.won === true }, seed) : null;
  }
}
