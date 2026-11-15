// Grow Island: an island that starts as nothing but open sea, with not one
// block of land, and grows only as its builders pay for it. Its land comes
// in plots, PLOT blocks a side, each bought with coins beside the land there
// is already (the first one anywhere), and every block put down on it costs
// coins too, as does every animal or vehicle brought from the toy box.
//
// There is no last plot. The world round the land is kept MARGIN plots of
// open sea wide: buy land near its edge and the sea grows by GROW_BY plots
// that way (growBox), so there is always more to buy. Growing west or north
// moves everything already there east or south in the world's own
// coordinates (room.js resizeWorld). What does bound it is how big a world
// may be kept in memory, every block of it: MAX_AREA, the sea round the land
// counted in, up to MAX_SIDE long. That is 4096 plots of a square island, a
// row of 250 of a long thin one, and millions of coins' worth of land.
import * as B from './blocks.js';
import { GROW_MAX_AREA, GROW_MAX_SIDE, GROW_PLOT, World } from './world.js';

export const PLOT = GROW_PLOT;
// Open sea kept round the land, in plots, and how much more of it comes
// when the land gets that close to the edge.
export const MARGIN = 2;
export const GROW_BY = 4;
// The sea it starts as, in plots a side: the first plot in the middle.
export const START = 5;
// The longest the world grows, in blocks a side, and the most blocks across
// it all told (W * D).
export const MAX_SIDE = GROW_MAX_SIDE;
export const MAX_AREA = GROW_MAX_AREA;
// What a block put down costs, and a friend from the toy box.
export const BLOCK_PRICE = 1;
export const FRIEND_PRICE = 20;
// What the next plot costs, with `owned` bought already: more for each, up
// to LAND_PRICE_MAX, so a plot is never out of reach of a full purse.
export const LAND_PRICE_MAX = 500;
export const landPrice = (owned) => Math.min(LAND_PRICE_MAX, 10 + 5 * owned);

// The edit kinds that put blocks down, and so cost coins (room.js EDIT_KINDS).
export const PAID_KINDS = ['build', 'paint', 'hills', 'stamp'];

export const isGrow = (world) => world?.theme === 'grow';
export const plotKey = (px, pz) => `${px},${pz}`;
export const plotOf = (x, z) => ({ px: Math.floor(x / PLOT), pz: Math.floor(z / PLOT) });

// Whether the column at x, z is on land bought.
export function onLand(world, x, z) {
  return world.land.has(plotKey(Math.floor(x / PLOT), Math.floor(z / PLOT)));
}

// Why plot px, pz cannot be bought: 'outside' the world, 'owned' already,
// or 'far' from the land there is (it must touch it, side to side). Null
// when it can.
export function landProblem(world, px, pz) {
  if (!Number.isInteger(px) || !Number.isInteger(pz) || px < 0 || pz < 0 || px >= world.W / PLOT || pz >= world.D / PLOT) return 'outside';
  if (world.land.has(plotKey(px, pz))) return 'owned';
  if (!world.land.size) return null;
  const near = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dz]) => world.land.has(plotKey(px + dx, pz + dz)));
  return near ? null : 'far';
}

// The sea a Grow Island starts as: water over the magic floor, nothing else.
export function makeGrowWorld({ seed = 1, name = 'My Island', sea = 20, H = 64 } = {}) {
  const side = START * PLOT;
  const world = new World({ W: side, H, D: side, sea, theme: 'grow', seed, name, spawn: { x: side / 2 + 0.5, y: sea + 1, z: side / 2 + 0.5 } });
  fillSea(world.blocks, world.H, world.sea, 0, side * side);
  return world;
}

// Columns first to last (x * D + z) made open sea.
function fillSea(blocks, H, sea, first, last) {
  for (let col = first; col < last; col++) {
    const base = col * H;
    blocks[base] = B.MAGIC_FLOOR;
    blocks.fill(B.WATER, base + 1, base + sea + 1);
  }
}

// The land of plot px, pz, as cells [x, y, z, id, ...]: stone, dirt, and
// grass one block over the sea. What is up above it stays as it was.
export function plotCells(world, px, pz) {
  const cells = [];
  const top = world.sea + 1;
  for (let x = px * PLOT; x < (px + 1) * PLOT; x++) {
    for (let z = pz * PLOT; z < (pz + 1) * PLOT; z++) {
      for (let y = 1; y <= top; y++) cells.push(x, y, z, y === top ? B.GRASS : y >= top - 3 ? B.DIRT : B.STONE);
    }
  }
  return cells;
}

// Plot px, pz made land, and counted as bought.
export function raisePlot(world, px, pz) {
  const cells = plotCells(world, px, pz);
  for (let i = 0; i < cells.length; i += 4) world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
  world.land.add(plotKey(px, pz));
  return cells;
}

// How much more sea the world needs round plot px, pz, in plots on each side,
// to keep MARGIN of it there: { west, east, north, south }, or null when it
// has enough. GROW_BY plots of it where it can, else just enough, else one
// plot more: whatever still fits in MAX_SIDE and MAX_AREA (null if nothing does).
export function seaWanted(world, px, pz) {
  const across = world.W / PLOT;
  const down = world.D / PLOT;
  const short = {
    west: Math.max(0, MARGIN - px),
    east: Math.max(0, px - (across - 1 - MARGIN)),
    north: Math.max(0, MARGIN - pz),
    south: Math.max(0, pz - (down - 1 - MARGIN)),
  };
  if (!short.west && !short.east && !short.north && !short.south) return null;
  const fits = (m) => {
    const W = (across + m.west + m.east) * PLOT;
    const D = (down + m.north + m.south) * PLOT;
    return W <= MAX_SIDE && D <= MAX_SIDE && W * D <= MAX_AREA;
  };
  const each = (f) => Object.fromEntries(Object.entries(short).map(([k, v]) => [k, v && f(v)]));
  return [each((v) => Math.max(GROW_BY, v)), short, each(() => 1)].find(fits) ?? null;
}

// A copy of the world with more sea round it ({ west, east, north, south }
// plots, as seaWanted says): { world, dx, dz }, dx and dz how far east and
// south everything already there moved.
export function grownWorld(world, more) {
  const dx = more.west * PLOT;
  const dz = more.north * PLOT;
  const W = world.W + dx + more.east * PLOT;
  const D = world.D + dz + more.south * PLOT;
  const { H } = world;
  const blocks = new Uint16Array(W * H * D);
  fillSea(blocks, H, world.sea, 0, W * D);
  // Each old column into its place, whole.
  for (let x = 0; x < world.W; x++) {
    const from = x * world.D * H;
    blocks.set(world.blocks.subarray(from, from + world.D * H), ((x + dx) * D + dz) * H);
  }
  const meta = world.meta();
  const spawn = { ...meta.spawn, x: meta.spawn.x + dx, z: meta.spawn.z + dz };
  const land = [...world.land].map((k) => {
    const [px, pz] = k.split(',').map(Number);
    return plotKey(px + more.west, pz + more.north);
  });
  return { world: new World({ ...meta, W, D, spawn, land, blocks }), dx, dz };
}
