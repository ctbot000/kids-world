// Tower defense islands: grumpy monsters march out of their gate, far across
// the island, along a road of pebbles to the island's Star Stone, by the
// start. Friends keep them off it together:
//
// - Beside the road are wooden pads. Standing by one, anyone can build a
//   tower on it, and make it bigger twice, with the island's bricks. A
//   tower blows bubbles at the monster nearest the Star Stone within its
//   reach, and each bubble takes a heart off it; bigger towers reach
//   further, blow faster and, at the last, harder.
// - Anyone presses Start for the next wave. Its monsters come out of the
//   gate one after another, more of them and with more hearts each wave,
//   and King Grumble himself in the middle and last wave, big and slow.
//   Friends can pop them too, as anywhere: tap them, or jump on them.
// - Every monster popped, and every wave seen off, brings bricks for more
//   towers. One that gets to the Star Stone takes a heart off it (King
//   Grumble five), and a wave seen off gives it a couple back; with none
//   left, the wave's monsters go home and the Star Stone shines again, with
//   all its hearts, to try that wave once more.
// - After the last wave the island is safe: fireworks, and a sticker and a
//   diamond for everyone there.
//
// The marching monsters never bump anyone: on a tower defense island
// nobody loses a heart. The road and the pads cannot be built on or dug
// up, so the way is always open.
//
// The island is made with its road (buildDefense, from worldgen.js), and
// the host runs the rest (DefenseSim, from room.js), as it runs the monsters.
import { groundMap } from './adventure.js';
import * as B from './blocks.js';
import { CRITTER_INFO, standHeight } from './critters.js';
import { HIT_MS } from './monsters.js';
import { hash2, Rng } from './rng.js';

export const WAVES = 10;
export const STONE_HEARTS = 10;
export const START_BRICKS = 4;
// What a tower costs to build (level 1), and to make bigger (2, then 3).
export const TOWER_COST = [0, 3, 5, 7];
export const MAX_LEVEL = 3;
// What a tower does at each level: how far it reaches (from the middle of
// its pad, side to side), how often it blows a bubble, and how many hearts
// a bubble takes.
export const TOWER = [null, { range: 6, every: 1000, power: 1 }, { range: 7, every: 700, power: 1 }, { range: 8, every: 600, power: 2 }];
// How near a pad's middle you stand to build on it.
export const BUILD_REACH = 4.5;
// Bricks for each monster popped, for King Grumble, and for a wave seen off.
export const POP_BRICKS = 1;
export const KING_BRICKS = 6;
export const waveBricks = (n) => 2 + Math.ceil(n / 2);
// How long after Start the first monster comes out.
export const START_MS = 3000;
// Hearts the Star Stone gets back with each wave seen off.
export const STONE_BACK = 2;
// How many hearts a monster takes off the Star Stone, getting there.
export const LEAK = { blob: 1, king: 5 };
// What comes in wave n (1 to WAVES): how many little monsters (and one
// more for each friend past the first, up to four), how many hearts each
// has, how long between them, and King Grumble's hearts (0: he stays home).
export function waveOf(n, players = 1) {
  return {
    blobs: 5 + n + Math.min(4, Math.max(0, players - 1)),
    hearts: Math.round(3 + 1.6 * (n - 1) + 0.12 * (n - 1) ** 2),
    every: Math.max(700, 1500 - 70 * n),
    king: n === Math.ceil(WAVES / 2) ? 40 : n === WAVES ? 120 : 0,
  };
}
// The states a defense goes through: waiting for Start, a wave marching,
// and all of it done.
export const DEFENSE_STATES = ['ready', 'march', 'won'];

const FL = Math.floor;
const PURPLE = B.TOY_BRICKS[8];
const TOWER_TOP = [0, B.TOY_BRICKS[7], B.LAMP, B.STAR_BLOCK];
// How tall a tower is at each level, from the top of its pad to its top block.
const TOWER_HEIGHT = [0, 4, 6, 7];

// ---------------------------------------------------------------- making it

// A little binary heap of cell indexes by cost, for finding the road.
class Heap {
  constructor() {
    this.k = [];
    this.v = [];
  }

  get size() {
    return this.k.length;
  }

  push(key, value) {
    const { k, v } = this;
    let i = k.length;
    k.push(key);
    v.push(value);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (v[up] <= v[i]) break;
      [k[up], k[i]] = [k[i], k[up]];
      [v[up], v[i]] = [v[i], v[up]];
      i = up;
    }
  }

  pop() {
    const { k, v } = this;
    const top = k[0];
    const lastK = k.pop();
    const lastV = v.pop();
    if (k.length) {
      k[0] = lastK;
      v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && v[l] < v[m]) m = l;
        if (r < k.length && v[r] < v[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

// How uneven the dry ground is in the square reach round (x, z), or null
// where any of it is under water.
function unevenness(map, world, x, z, reach) {
  const { W, D } = world;
  let lo = Infinity;
  let hi = -Infinity;
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const cx = x + dx;
      const cz = z + dz;
      if (cx < 0 || cz < 0 || cx >= W || cz >= D) return null;
      const k = cx * D + cz;
      if (map.wet[k]) return null;
      lo = Math.min(lo, map.ground[k]);
      hi = Math.max(hi, map.ground[k]);
    }
  }
  return hi - lo;
}

// The cheapest way over the island from one cell to another, a step at a
// time side to side: round hills rather than over them, round the water
// rather than across it (a bridge is laid where it must cross), never
// through blocked cells, and away from where the road already goes.
function findWay(world, map, from, to, { blocked, used, avoid, seed }) {
  const { W, D, sea } = world;
  const n = W * D;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const start = from[0] * D + from[1];
  const goal = to[0] * D + to[1];
  const height = (k) => (map.wet[k] ? sea + 1 : Math.max(sea + 1, map.ground[k]));
  const heap = new Heap();
  cost[start] = 0;
  heap.push(start, 0);
  const guess = (k) => Math.abs(FL(k / D) - to[0]) + Math.abs((k % D) - to[1]);
  while (heap.size) {
    const k = heap.pop();
    if (k === goal) break;
    const x = FL(k / D);
    const z = k % D;
    const here = cost[k];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 4 || nz < 4 || nx >= W - 4 || nz >= D - 4) continue;
      const nk = nx * D + nz;
      if (blocked[nk] && nk !== goal) continue;
      let step = 1 + 3 * Math.abs(height(nk) - height(k)) + hash2(seed, nx, nz) * 1.5;
      if (map.wet[nk] === 1) step += 10;
      else if (map.wet[nk] === 2) step += 25;
      if (used[nk] === 2) step += 40;
      else if (used[nk] === 1) step += 12;
      if (avoid[nk]) step += 30;
      const c = here + step;
      if (c < cost[nk]) {
        cost[nk] = c;
        prev[nk] = k;
        heap.push(nk, c + guess(nk));
      }
    }
  }
  if (prev[goal] < 0 && goal !== start) return null;
  const way = [];
  for (let k = goal; k >= 0; k = prev[k]) {
    way.push([FL(k / D), k % D]);
    if (k === start) break;
  }
  return way.reverse();
}

// Builds a tower defense island's road on a newly made island (last, from
// randomness of its own, so the rest of it comes out as it would without):
// the monsters' gate as far from the start as there is room for, the Star
// Stone a few steps from the start, a winding road of pebbles three wide
// between them (with a bridge where it crosses water), and wooden pads for
// towers beside it, every few steps on one side or the other. pal, trees,
// critters, mines: as for buildCamps (adventure.js). Returns
// { defense, critters }, defense as { path, pads, stone, gate }: path, the
// cells down the middle of the road from the gate to the Star Stone, as
// [x, y, z] with y where feet stand on it; each pad as { id, x, y, z } (its
// middle, and where feet stand on it); stone and gate as { x, y, z }. Or
// null, when there is nowhere for it.
export function buildDefense(world, rng, { pal, trees = [], critters = [], mines = [] }) {
  const { W, D, H, sea } = world;
  const map = groundMap(world);
  const spawn = world.spawn;
  const sx = FL(spawn.x);
  const sz = FL(spawn.z);
  const n = W * D;
  // Near the ways into the mines: kept clear.
  const avoid = new Uint8Array(n);
  for (const m of mines) {
    for (const w of [{ x: m.x, z: m.z }, ...m.way]) {
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (w.x + dx >= 0 && w.z + dz >= 0 && w.x + dx < W && w.z + dz < D) avoid[(w.x + dx) * D + w.z + dz] = 1;
    }
  }
  const dry = (x, z) => x >= 6 && z >= 6 && x < W - 6 && z < D - 6 && !map.wet[x * D + z];

  // The gate: as far from the start as it can be, on dry, even ground.
  let gate = null;
  for (let tries = 0; tries < 1500; tries++) {
    const x = rng.int(6, W - 7);
    const z = rng.int(6, D - 7);
    if (!dry(x, z) || avoid[x * D + z]) continue;
    const spread = unevenness(map, world, x, z, 3);
    if (spread === null) continue;
    const score = Math.hypot(x - sx, z - sz) - spread * 1.5 + rng.next();
    if (!gate || score > gate.score) gate = { x, z, score };
  }
  if (!gate || Math.hypot(gate.x - sx, gate.z - sz) < 24) return null;

  // The Star Stone: a few steps from the start, towards the gate if it can.
  const toGate = Math.atan2(gate.z - sz, gate.x - sx);
  let stone = null;
  for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.6, -2.6, Math.PI]) {
    const x = Math.round(sx + Math.cos(toGate + turn) * 5.5);
    const z = Math.round(sz + Math.sin(toGate + turn) * 5.5);
    const spread = dry(x, z) ? unevenness(map, world, x, z, 1) : null;
    if (spread !== null && spread <= 2) {
      stone = { x, z, a: toGate + turn };
      break;
    }
  }
  stone ??= { x: Math.round(sx + Math.cos(toGate) * 5.5), z: Math.round(sz + Math.sin(toGate) * 5.5), a: toGate };
  // The road ends just off the Star Stone's floor, on the side it comes from.
  const end = [stone.x + Math.round(Math.cos(stone.a) * 2.4), stone.z + Math.round(Math.sin(stone.a) * 2.4)];

  // Cells the road never goes through: round the start, and the Star Stone's floor.
  const blocked = new Uint8Array(n);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      if (Math.hypot(x - sx, z - sz) < 3.6 || (Math.abs(x - stone.x) <= 1 && Math.abs(z - stone.z) <= 1)) blocked[x * D + z] = 1;
    }
  }

  // Bends: a point or two off the straight way, so the road winds about.
  const len = Math.hypot(end[0] - gate.x, end[1] - gate.z);
  const bends = len > 70 ? 2 : 1;
  const points = [[gate.x, gate.z]];
  let side = rng.chance(0.5) ? 1 : -1;
  for (let i = 1; i <= bends; i++) {
    const t = i / (bends + 1);
    const bx = gate.x + (end[0] - gate.x) * t;
    const bz = gate.z + (end[1] - gate.z) * t;
    const px = -(end[1] - gate.z) / len;
    const pz = (end[0] - gate.x) / len;
    const off = len * rng.range(0.25, 0.4) * side;
    side = -side;
    for (const f of [1, 0.8, 0.6, 0.4, 0.2]) {
      const x = Math.round(bx + px * off * f);
      const z = Math.round(bz + pz * off * f);
      if (dry(x, z) && !blocked[x * D + z]) {
        points.push([x, z]);
        break;
      }
    }
  }
  points.push(end);
  const used = new Uint8Array(n);
  const cells = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const way = findWay(world, map, points[i], points[i + 1], { blocked, used, avoid, seed: world.seed + 131 });
    if (!way) return null;
    for (const [x, z] of i ? way.slice(1) : way) {
      cells.push([x, z]);
    }
    for (const [x, z] of way) {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (x + dx >= 0 && z + dz >= 0 && x + dx < W && z + dz < D) used[(x + dx) * D + z + dz] ||= 1;
    }
    for (const [x, z] of way) used[x * D + z] = 2;
  }

  // How high the road goes in each cell: the ground's height (over water,
  // just over the sea), with never more than a block between one cell and
  // the next, so a monster's hop takes it up.
  const ys = cells.map(([x, z]) => {
    const k = x * D + z;
    return map.wet[k] ? sea + 1 : Math.max(sea + 1, map.ground[k]);
  });
  for (let pass = 0, changed = true; changed && pass < 60; pass++) {
    changed = false;
    for (let i = 1; i < ys.length; i++) {
      const y = Math.min(ys[i - 1] + 1, Math.max(ys[i - 1] - 1, ys[i]));
      if (y !== ys[i]) {
        ys[i] = y;
        changed = true;
      }
    }
    for (let i = ys.length - 2; i >= 0; i--) {
      const y = Math.min(ys[i + 1] + 1, Math.max(ys[i + 1] - 1, ys[i]));
      if (y !== ys[i]) {
        ys[i] = y;
        changed = true;
      }
    }
  }

  // The road: the cells beside the middle first, then the middle over them.
  const road = new Map();
  for (let i = 0; i < cells.length; i++) {
    const [x, z] = cells[i];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const k = (x + dx) * D + z + dz;
        if (!road.has(k) && !blocked[k]) road.set(k, ys[i]);
      }
    }
  }
  for (let i = 0; i < cells.length; i++) road.set(cells[i][0] * D + cells[i][1], ys[i]);

  // The pads, beside the road every few steps, one side then the other.
  const pads = [];
  const nearRoad = (x, z, r) => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (road.has((x + dx) * D + z + dz)) return true;
    return false;
  };
  const maxPads = Math.min(16, Math.max(8, Math.round(cells.length / 6)));
  let padSide = rng.chance(0.5) ? 1 : -1;
  for (let i = 6; i < cells.length - 5 && pads.length < maxPads; i += 4) {
    const a = cells[Math.max(0, i - 2)];
    const b = cells[Math.min(cells.length - 1, i + 2)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const px = -(b[1] - a[1]) / tl;
    const pz = (b[0] - a[0]) / tl;
    let placed = null;
    for (const s of [padSide, -padSide]) {
      for (const d of [3, 3.5, 4, 4.5]) {
        const x = Math.round(cells[i][0] + px * d * s);
        const z = Math.round(cells[i][1] + pz * d * s);
        if (x < 6 || z < 6 || x >= W - 6 || z >= D - 6 || nearRoad(x, z, 1) || avoid[x * D + z]) continue;
        if (Math.hypot(x - sx, z - sz) < 3.5 || Math.hypot(x - stone.x, z - stone.z) < 4 || Math.hypot(x - gate.x, z - gate.z) < 5) continue;
        if (pads.some((p) => Math.hypot(p.cx - x, p.cz - z) < 5)) continue;
        const spread = unevenness(map, world, x, z, 1);
        if (spread === null || spread > 2) continue;
        placed = { cx: x, cz: z, s };
        break;
      }
      if (placed) break;
    }
    if (!placed) continue;
    padSide = -placed.s;
    const hs = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) hs.push(map.ground[(placed.cx + dx) * D + placed.cz + dz]);
    hs.sort((p, q) => p - q);
    pads.push({ cx: placed.cx, cz: placed.cz, level: Math.max(sea + 1, hs[4]) });
  }

  // The trees in the way come down.
  const clear = (x, z) => road.has(x * D + z) || pads.some((p) => Math.abs(p.cx - x) <= 3 && Math.abs(p.cz - z) <= 3) || Math.hypot(x - gate.x, z - gate.z) < 5 || Math.hypot(x - stone.x, z - stone.z) < 3;
  for (const t of trees) {
    if (!t.cells) continue;
    let hit = false;
    for (let dx = -3; dx <= 3 && !hit; dx++) for (let dz = -3; dz <= 3 && !hit; dz++) hit = clear(t.x + dx, t.z + dz);
    if (!hit) continue;
    for (const [x, y, z, id] of t.cells) if (world.get(x, y, z) === id) world.set(x, y, z, B.AIR);
  }

  // Ground filled in under something (or the water under a bridge), cleared
  // over it, and its top laid.
  const lay = (x, z, top, id, headroom) => {
    const g = map.ground[x * D + z];
    for (let y = Math.max(1, Math.min(g, top) - 1); y < top; y++) {
      const here = world.get(x, y, z);
      if (!B.SOLID[here] || B.TREE_PART[here]) world.set(x, y, z, pal.under);
    }
    world.set(x, top, z, id);
    for (let y = top + 1; y <= Math.max(g, top + headroom) && y < H; y++) if (world.get(x, y, z) !== B.AIR) world.set(x, y, z, B.AIR);
  };
  for (const [k, y] of road) lay(FL(k / D), k % D, y, B.PEBBLES, 4);
  for (const p of pads) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) lay(p.cx + dx, p.cz + dz, p.level, B.PLANKS, 9);

  // The Star Stone: a floor of bricks, and a column of star blocks.
  const stoneLevel = Math.max(sea + 1, map.ground[stone.x * D + stone.z]);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) lay(stone.x + dx, stone.z + dz, stoneLevel, B.BRICK_WALL, 6);
  for (let y = 1; y <= 3; y++) world.set(stone.x, stoneLevel + y, stone.z, B.STAR_BLOCK);

  // The gate: gloomy ground round it, and an arch over the road, with a lamp
  // on each side.
  const [g0, g1] = [cells[0], cells[Math.min(cells.length - 1, 3)]];
  const along = Math.abs(g1[0] - g0[0]) >= Math.abs(g1[1] - g0[1]) ? [Math.sign(g1[0] - g0[0]) || 1, 0] : [0, Math.sign(g1[1] - g0[1]) || 1];
  const across = [along[1], along[0]];
  const gy = ys[0];
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const x = g0[0] + dx;
      const z = g0[1] + dz;
      if (Math.hypot(dx, dz) > 2.5 + hash2(world.seed + 89, x, z) * 2 || road.has(x * D + z)) continue;
      const top = world.top(x, z);
      if (top > 0 && world.get(x, top, z) === pal.top) world.set(x, top, z, B.GLOOM);
    }
  }
  for (const s of [-2, 2]) {
    const x = g0[0] + across[0] * s;
    const z = g0[1] + across[1] * s;
    lay(x, z, gy, B.BRICK_WALL, 0);
    for (let y = 1; y <= 5; y++) world.set(x, gy + y, z, B.BRICK_WALL);
    world.set(x, gy + 6, z, B.LAMP);
  }
  for (let s = -1; s <= 1; s++) world.set(g0[0] + across[0] * s, gy + 5, g0[1] + across[1] * s, PURPLE);

  // No animal stays where the road and the pads are (the vehicles had their places first).
  const left = critters.filter((c) => CRITTER_INFO[c.type]?.vehicle || !clear(FL(c.x), FL(c.z)));
  return {
    defense: {
      path: cells.map(([x, z], i) => [x, ys[i] + 1, z]),
      pads: pads.map((p, i) => ({ id: i + 1, x: p.cx + 0.5, y: p.level + 1, z: p.cz + 0.5 })),
      stone: { x: stone.x + 0.5, y: stoneLevel + 1, z: stone.z + 0.5 },
      gate: { x: g0[0] + 0.5, y: gy + 1, z: g0[1] + 0.5 },
    },
    critters: left,
  };
}

// A tower on a pad at a level: its blocks, as an edit ([x, y, z, id, ...]),
// from the pad up: a column of bricks with a blue brick on top (a lamp at
// level 2, a star at 3), and a wider foot as it grows.
export function towerCells(pad, level) {
  const cells = [];
  const x = FL(pad.x);
  const z = FL(pad.z);
  const y0 = pad.y;
  const height = TOWER_HEIGHT[level] ?? 0;
  if (!height) return cells;
  for (let y = 0; y < height - 1; y++) cells.push(x, y0 + y, z, B.BRICK_WALL);
  cells.push(x, y0 + height - 1, z, TOWER_TOP[level]);
  if (level >= 2) {
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      for (let y = 0; y < level - 1; y++) cells.push(x + dx, y0 + y, z + dz, B.BRICK_WALL);
    }
  }
  return cells;
}

// Where a tower's bubbles come from: just over its top block.
export function towerTop(pad, level) {
  return { x: pad.x, y: pad.y + (TOWER_HEIGHT[level] ?? 0) + 0.3, z: pad.z };
}

// ---------------------------------------------------------------- playing it

export class DefenseSim {
  // As buildDefense makes it (and saves keep it): path, pads (each with its
  // tower's level), stone, gate; and how far it got: the wave to play next,
  // the bricks to build with, the Star Stone's hearts, and whether every
  // wave is done.
  constructor({ path, pads, stone, gate, wave = 1, bricks = START_BRICKS, hearts = STONE_HEARTS, won = false }, seed = 1) {
    this.rng = new Rng(seed);
    this.path = path.map(([x, y, z]) => [x, y, z]);
    this.route = this.path.map(([x, y, z]) => ({ x: x + 0.5, y, z: z + 0.5 }));
    this.pads = pads.map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z, level: Math.max(0, Math.min(MAX_LEVEL, p.level | 0)), readyAt: 0 }));
    this.stone = { ...stone };
    this.gate = { ...gate };
    this.won = Boolean(won);
    this.wave = this.won ? WAVES : Math.max(1, Math.min(WAVES, wave | 0));
    this.bricks = Math.max(0, bricks | 0);
    this.state = this.won ? 'won' : 'ready';
    this.hearts = Math.max(1, Math.min(STONE_HEARTS, hearts | 0));
    this.queue = [];
    this.spawnAt = 0;
    this.kingHearts = 0;
    this.blobHearts = 0;
    this.every = 1000;
    this.protect = this.protection();
  }

  get marching() {
    return this.state === 'march';
  }

  padById(id) {
    return this.pads.find((p) => p.id === id) ?? null;
  }

  // The columns nobody can build in or dig up, each with the heights it
  // keeps from (lo) and to (hi): the road and over it, the pads and over
  // them, round the Star Stone and round the gate.
  protection() {
    const out = new Map();
    const keep = (x, z, lo, hi) => {
      const key = `${x},${z}`;
      const was = out.get(key);
      out.set(key, was ? [Math.min(was[0], lo), Math.max(was[1], hi)] : [lo, hi]);
    };
    for (const [x, y, z] of this.path) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) keep(x + dx, z + dz, y - 1, y + 3);
    for (const p of this.pads) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) keep(FL(p.x) + dx, FL(p.z) + dz, p.y - 1, p.y + 8);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) keep(FL(this.stone.x) + dx, FL(this.stone.z) + dz, this.stone.y - 1, this.stone.y + 5);
    for (const s of [-2, -1, 0, 1, 2]) for (const t of [-2, -1, 0, 1, 2]) keep(FL(this.gate.x) + s, FL(this.gate.z) + t, this.gate.y - 1, this.gate.y + 6);
    return out;
  }

  // Whether the block at (x, y, z) is one nobody can change.
  protects(x, y, z) {
    const r = this.protect.get(`${x},${z}`);
    return Boolean(r) && y >= r[0] && y <= r[1];
  }

  // Start pressed: the next wave's monsters on their way. players: how
  // many friends are on the island.
  start(now, players = 1) {
    if (this.state !== 'ready') return false;
    const w = waveOf(this.wave, players);
    this.queue = Array.from({ length: w.blobs }, () => 'blob');
    if (w.king) this.queue.splice(Math.floor(w.blobs * 0.6), 0, 'king');
    this.blobHearts = w.hearts;
    this.kingHearts = w.king;
    this.every = w.every;
    this.spawnAt = now + START_MS;
    this.state = 'march';
    for (const p of this.pads) p.readyAt = 0;
    return true;
  }

  // A tower built on a pad, or made bigger. Returns { level, cells } (the
  // blocks to set), or { no } with why not: 'full' (as big as it gets) or
  // 'bricks' (not enough of them).
  build(id) {
    const p = this.padById(id);
    if (!p) return { no: 'pad' };
    if (p.level >= MAX_LEVEL) return { no: 'full' };
    const cost = TOWER_COST[p.level + 1];
    if (this.bricks < cost) return { no: 'bricks', cost };
    this.bricks -= cost;
    p.level++;
    return { level: p.level, cells: towerCells(p, p.level), cost };
  }

  // How many monsters of this wave are still to come or about.
  left(monsters) {
    let n = this.queue.length;
    for (const m of monsters.list) if (m.march) n++;
    return n;
  }

  // Moves the wave on by dt seconds, after the monsters have moved: the
  // next monster out of the gate, those that got to the Star Stone, the
  // towers blowing their bubbles, and the wave done (or lost). Returns
  // what happened, for the room to tell everyone:
  //   { t: 'zap', pad, monster, hearts }   a bubble from a tower
  //   { t: 'pop', monster, bricks }        a monster popped by one
  //   { t: 'leak', monster, hearts }       one got to the Star Stone
  //   { t: 'lost', gone }                  the Star Stone out of hearts
  //   { t: 'clear', wave, bricks, won }    a wave seen off
  step(world, now, monsters) {
    const news = [];
    if (this.state !== 'march') return news;
    if (this.queue.length && now >= this.spawnAt) {
      const kind = this.queue.shift();
      const at = this.route[0];
      const m = monsters.add(world, at.x, standHeight(world, at.x, at.z, at.y + 1) ?? at.y, at.z, { kind, march: this.route });
      m.hearts = kind === 'king' ? this.kingHearts : this.blobHearts;
      m.max = m.hearts;
      this.spawnAt = now + this.every * (kind === 'king' ? 2 : 1);
    }
    for (const m of [...monsters.list]) {
      if (!m.march || !m.arrived) continue;
      monsters.remove(m.id);
      this.hearts = Math.max(0, this.hearts - (LEAK[m.kind] ?? 1));
      news.push({ t: 'leak', monster: m, hearts: this.hearts });
    }
    if (this.hearts <= 0) {
      const gone = [];
      for (const m of [...monsters.list]) if (m.march) gone.push(monsters.remove(m.id));
      this.queue = [];
      this.hearts = STONE_HEARTS;
      this.state = 'ready';
      news.push({ t: 'lost', gone, wave: this.wave });
      return news;
    }
    for (const p of this.pads) {
      if (!p.level || now < p.readyAt) continue;
      const tower = TOWER[p.level];
      let target = null;
      for (const m of monsters.list) {
        if (!m.march || m.hearts <= 0) continue;
        if (Math.hypot(m.body.x - p.x, m.body.z - p.z) > tower.range) continue;
        if (!target || m.along > target.along) target = m;
      }
      if (!target) continue;
      p.readyAt = now + tower.every;
      target.hearts = Math.max(0, target.hearts - tower.power);
      news.push({ t: 'zap', pad: p, monster: target, hearts: target.hearts });
      if (target.hearts <= 0) news.push(this.popped(target, monsters));
    }
    if (!this.queue.length && !monsters.list.some((m) => m.march)) {
      const bricks = waveBricks(this.wave);
      this.bricks += bricks;
      const wave = this.wave;
      this.hearts = Math.min(STONE_HEARTS, this.hearts + STONE_BACK);
      if (wave >= WAVES) {
        this.won = true;
        this.state = 'won';
      } else {
        this.wave++;
        this.state = 'ready';
      }
      news.push({ t: 'clear', wave, bricks, won: this.won });
    }
    return news;
  }

  // A marching monster popped (by a tower, or by a friend): gone, and
  // bricks for it. Returns { t: 'pop', monster, bricks }.
  popped(m, monsters) {
    monsters.remove(m.id);
    const bricks = m.kind === 'king' ? KING_BRICKS : POP_BRICKS;
    this.bricks += bricks;
    return { t: 'pop', monster: m, bricks };
  }

  // A friend tapping a marching monster (or landing on it): power hearts off
  // it, once a moment each. Returns { wait }, or the hearts it has left.
  tap(m, pid, now, power = 1) {
    if (now - (m.hits.get(pid) ?? -Infinity) < HIT_MS) return { wait: true };
    m.hits.set(pid, now);
    m.hearts = Math.max(0, m.hearts - power);
    return { hearts: m.hearts };
  }

  // Nobody left on the island in the middle of a wave: its monsters go home,
  // to come again when Start is pressed. Returns them.
  stop(monsters) {
    if (this.state !== 'march') return [];
    const gone = [];
    for (const m of [...monsters.list]) if (m.march) gone.push(monsters.remove(m.id));
    this.queue = [];
    this.hearts = STONE_HEARTS;
    this.state = 'ready';
    return gone;
  }

  // How it is going, for the list of open islands.
  tally() {
    return { wave: this.wave, waves: WAVES, won: this.won };
  }

  // What everyone needs to know as they arrive.
  describe(monsters) {
    return {
      path: this.path,
      pads: this.pads.map(({ id, x, y, z }) => ({ id, x, y, z })),
      stone: this.stone,
      gate: this.gate,
      ...this.pack(monsters),
    };
  }

  // What changes as it goes: the wave, what state it is in, the Star Stone's
  // hearts, the bricks, how many monsters are still to come or about, and
  // each pad's tower.
  pack(monsters) {
    return {
      w: this.wave,
      n: WAVES,
      s: DEFENSE_STATES.indexOf(this.state),
      h: this.hearts,
      hm: STONE_HEARTS,
      b: this.bricks,
      l: monsters ? this.left(monsters) : 0,
      lv: this.pads.map((p) => p.level),
    };
  }

  save() {
    return {
      path: this.path,
      pads: this.pads.map(({ id, x, y, z, level }) => ({ id, x, y, z, level })),
      stone: this.stone,
      gate: this.gate,
      wave: this.wave,
      bricks: this.bricks,
      hearts: this.hearts,
      won: this.won,
    };
  }

  // A defense as saved, checked, or null for none.
  static load(raw, world, seed) {
    if (!raw || !Array.isArray(raw.path) || !Array.isArray(raw.pads)) return null;
    const inside = (x, y, z) => [x, y, z].every(Number.isFinite) && x >= 0 && z >= 0 && x <= world.W && z <= world.D && y >= 1 && y <= world.H;
    const path = [];
    for (const c of raw.path.slice(0, 4096)) {
      if (!Array.isArray(c) || !c.every(Number.isInteger) || !inside(c[0], c[1], c[2])) return null;
      path.push([c[0], c[1], c[2]]);
    }
    if (path.length < 2) return null;
    const pads = [];
    for (const p of raw.pads.slice(0, 64)) {
      if (!Number.isInteger(p?.id) || p.id < 1 || pads.some((o) => o.id === p.id) || !inside(p.x, p.y, p.z)) continue;
      pads.push({ id: p.id, x: p.x, y: p.y, z: p.z, level: Number.isInteger(p.level) ? Math.max(0, Math.min(MAX_LEVEL, p.level)) : 0 });
    }
    const point = (o) => (o && inside(o.x, o.y, o.z) ? { x: o.x, y: o.y, z: o.z } : null);
    const stone = point(raw.stone);
    const gate = point(raw.gate);
    if (!stone || !gate) return null;
    const wave = Number.isInteger(raw.wave) ? raw.wave : 1;
    const bricks = Number.isInteger(raw.bricks) ? Math.min(9999, raw.bricks) : START_BRICKS;
    const hearts = Number.isInteger(raw.hearts) ? raw.hearts : STONE_HEARTS;
    return new DefenseSim({ path, pads, stone, gate, wave, bricks, hearts, won: raw.won === true }, seed);
  }
}
