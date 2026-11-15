// Grow Island: an island that starts as nothing but open sea, with not one
// block of land, and grows only as its builders pay for it, one block at a
// time. Its land is bought a column at a time with 🌱 Buy land (grass over
// dirt and stone, out of the sea), each beside the land there is already
// (the first one anywhere). Everything from the toy box costs coins too,
// each thing its own price (blockPrice, friendPrice), and goes down one at
// a time: no stamps, no Hills and no bigger brush there (MANY_AT_ONCE).
//
// Which columns are land is in the blocks themselves: the magic floor under
// a column bought, where the open sea has water right down (isLand). So it
// is saved, sent and grown with the blocks, and nothing else need keep it.
//
// There is no last block of land. The world round the land is kept MARGIN
// steps of open sea wide at least: buy land near its edge and the sea grows
// by GROW_BY steps that way (seaWanted), so there is always more to buy.
// Growing west or north moves everything already there east or south in
// the world's own coordinates (room.js resizeWorld). What does bound it is
// how big a world may be kept in memory, every block of it: MAX_AREA, the
// sea round the land counted in, up to MAX_SIDE long — a million columns of
// land, and far more coins than anyone has.
import * as B from './blocks.js';
import { CRITTER_INFO } from './critters.js';
import { GROW_MAX_AREA, GROW_MAX_SIDE, GROW_STEP, World } from './world.js';

// The world grows by whole steps of this many blocks (so its chunks stay
// whole), keeping MARGIN steps of open sea round the land and adding
// GROW_BY steps of it at a time.
export const STEP = GROW_STEP;
export const MARGIN = 1;
export const GROW_BY = 4;
// The sea it starts as, in steps a side.
export const START = 5;
// The longest the world grows, in blocks a side, and the most columns
// across it all told (W * D).
export const MAX_SIDE = GROW_MAX_SIDE;
export const MAX_AREA = GROW_MAX_AREA;

// What the next block of land costs, with `owned` bought already: a coin
// each for the first hundred, a coin more for every hundred after, up to
// LAND_PRICE_MAX, so land is never out of reach of a full purse.
export const LAND_PRICE_MAX = 10;
export const landPrice = (owned) => Math.min(LAND_PRICE_MAX, 1 + Math.floor(owned / 100));

export const isGrow = (world) => world?.theme === 'grow';

// The tools that put down many blocks at once, which a Grow Island has none
// of: everything goes down one at a time there.
export const MANY_AT_ONCE = ['stamp', 'hills'];

// What each thing from the toy box costs on a Grow Island. Most go by the
// toy box tab they are in; the bigger and cleverer things cost more.
const TAB_PRICES = { bricks: 1, nature: 1, candy: 1, plants: 2, farm: 3, building: 3, home: 8 };
const KEY_PRICES = {
  // Nature
  water: 2, ice: 2, cloud: 3, lava: 4,
  // Building
  pebbles: 1, 'race-track': 1, glass: 2, hay: 2, rail: 2, lamp: 4, 'star-block': 6, bomb: 6, campfire: 6,
  'door-oak': 5, 'door-walnut': 5, 'door-blue': 5, trampoline: 15, walkway: 20, escalator: 25, 'escalator-down': 25, elevator: 30,
  // Farm
  farmland: 2, fence: 2, 'watering-can': 5, scarecrow: 5,
  // Home: floors and walls, furniture, and the things with a window of their own.
  'carpet-red': 2, 'carpet-blue': 2, 'carpet-pink': 2, 'carpet-green': 2, parquet: 2, 'checker-floor': 2,
  'wallpaper-stripes': 2, 'wallpaper-flowers': 2, 'wallpaper-dots': 2, 'wallpaper-stars': 2, 'wallpaper-party': 2,
  picture: 4, 'potted-plant': 4, dish: 4, balloons: 4, 'party-banner': 4, present: 6,
  bed: 12, sofa: 12, fireplace: 15, stove: 15, fridge: 15, chalkboard: 15, 'drawing-board': 15, 'study-desk': 15, 'cuckoo-clock': 15, 'fish-bowl': 15, 'ceiling-fan': 10, 'electric-fan': 10, 'birthday-cake': 15,
  tv: 30, 'retro-tv': 30, 'wall-tv': 30, 'broadcast-station': 40, computer: 30, 'robot-kit': 40, 'stock-terminal': 30, 'stock-ticker': 25,
  'bull-statue': 40, 'bear-statue': 40, 'go-board': 20, 'fish-tank': 30, 'hot-tub': 40, 'tower-clock': 40,
  'arcade-blob': 40, 'arcade-pairs': 40, gashapon: 40, piano: 40, 'grand-piano': 60,
};
export function blockPrice(id) {
  const def = B.block(B.baseOf(id));
  return KEY_PRICES[def.key] ?? TAB_PRICES[def.category] ?? 1;
}

// And each animal or vehicle: little ones, bigger ones, the ones to ride,
// and the vehicles by how big they are.
const FRIEND_PRICES = {
  hoop: 10, rope: 10, scooter: 15, sled: 15, minecart: 30, car: 40, boat: 40, kart: 40, mower: 40, paintvan: 40, digger: 50,
  bus: 80, ferry: 80, helicopter: 100, balloon: 100, dragon: 150,
};
const SMALL_FRIENDS = ['bunny', 'chick', 'duck', 'butterfly', 'bird', 'owl', 'bee', 'seagull', 'fish', 'crab', 'clam'];
export function friendPrice(type) {
  const info = CRITTER_INFO[type];
  if (!info) return 0;
  return FRIEND_PRICES[type] ?? (info.big ? 50 : SMALL_FRIENDS.includes(type) ? 10 : 20);
}

// The edit kinds that put blocks down, and so cost coins.
export const PAID_KINDS = ['build', 'paint'];

// What an edit puts down costs: the thing built (one at a time: the price
// of the thing, whatever cells it takes up), or a coin for each block
// painted. 0 for what puts nothing down.
export function editPrice(world, kind, cells) {
  let first = 0;
  let painted = 0;
  for (let i = 0; i < cells.length; i += 4) {
    const id = cells[i + 3];
    if (id === B.AIR || world.get(cells[i], cells[i + 1], cells[i + 2]) === id) continue;
    first ||= id;
    painted++;
  }
  if (kind === 'build') return first ? blockPrice(first) : 0;
  if (kind === 'paint') return painted;
  return 0;
}

// Whether the column at x, z is land bought: the magic floor under it.
export function isLand(world, x, z) {
  return world.inBounds(x, 0, z) && world.get(x, 0, z) === B.MAGIC_FLOOR;
}

// How many columns of land there are, counted once for each world (and
// kept up to date as more is bought, raiseColumn).
export function landCount(world) {
  if (world.landCount === undefined) {
    let n = 0;
    for (let col = 0; col < world.W * world.D; col++) if (world.blocks[col * world.H] === B.MAGIC_FLOOR) n++;
    world.landCount = n;
  }
  return world.landCount;
}

// Why the column at x, z cannot be bought: 'outside' the world, 'owned'
// already, or 'far' from the land there is (it must touch it, side to
// side). Null when it can.
export function landProblem(world, x, z) {
  if (!Number.isInteger(x) || !Number.isInteger(z) || !world.inBounds(x, 0, z)) return 'outside';
  if (isLand(world, x, z)) return 'owned';
  if (!landCount(world)) return null;
  const near = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dz]) => isLand(world, x + dx, z + dz));
  return near ? null : 'far';
}

// The sea a Grow Island starts as: water right down, nothing else.
export function makeGrowWorld({ seed = 1, name = 'My Island', sea = 20, H = 64 } = {}) {
  const side = START * STEP;
  const world = new World({ W: side, H, D: side, sea, theme: 'grow', seed, name, spawn: { x: side / 2 + 0.5, y: sea + 1, z: side / 2 + 0.5 } });
  fillSea(world.blocks, world.H, world.sea, 0, side * side);
  world.landCount = 0;
  return world;
}

// Columns first to last (x * D + z) made open sea.
function fillSea(blocks, H, sea, first, last) {
  for (let col = first; col < last; col++) blocks.fill(B.WATER, col * H, col * H + sea + 1);
}

// The land of the column at x, z, as cells [x, y, z, id, ...]: the magic
// floor, stone, dirt, and grass one block over the sea. What is up above
// it stays as it was.
export function columnCells(world, x, z) {
  const cells = [];
  const top = world.sea + 1;
  for (let y = 0; y <= top; y++) cells.push(x, y, z, y === 0 ? B.MAGIC_FLOOR : y === top ? B.GRASS : y >= top - 3 ? B.DIRT : B.STONE);
  return cells;
}

// The column at x, z made land, and counted.
export function raiseColumn(world, x, z) {
  const owned = isLand(world, x, z);
  const n = landCount(world);
  const cells = columnCells(world, x, z);
  for (let i = 0; i < cells.length; i += 4) world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
  world.landCount = owned ? n : n + 1;
  return cells;
}

// An island from before its land was bought a block at a time, when it came
// in plots, had the magic floor under its sea too: there the sea has water
// right down again, so only the land bought counts as land.
export function settleSea(world) {
  const { H } = world;
  for (let col = 0; col < world.W * world.D; col++) {
    if (world.blocks[col * H] === B.MAGIC_FLOOR && world.blocks[col * H + 1] === B.WATER) world.blocks[col * H] = B.WATER;
  }
  world.landCount = undefined;
}

// How much more sea the world needs round the column at x, z, in steps on
// each side, to keep MARGIN of them there: { west, east, north, south }, or
// null when it has enough. GROW_BY steps of it where it can, else just
// enough, else one step more: whatever still fits in MAX_SIDE and MAX_AREA
// (null if nothing does).
export function seaWanted(world, x, z) {
  const across = world.W / STEP;
  const down = world.D / STEP;
  const px = Math.floor(x / STEP);
  const pz = Math.floor(z / STEP);
  const short = {
    west: Math.max(0, MARGIN - px),
    east: Math.max(0, px - (across - 1 - MARGIN)),
    north: Math.max(0, MARGIN - pz),
    south: Math.max(0, pz - (down - 1 - MARGIN)),
  };
  if (!short.west && !short.east && !short.north && !short.south) return null;
  const fits = (m) => {
    const W = (across + m.west + m.east) * STEP;
    const D = (down + m.north + m.south) * STEP;
    return W <= MAX_SIDE && D <= MAX_SIDE && W * D <= MAX_AREA;
  };
  const each = (f) => Object.fromEntries(Object.entries(short).map(([k, v]) => [k, v && f(v)]));
  return [each((v) => Math.max(GROW_BY, v)), short, each(() => 1)].find(fits) ?? null;
}

// A copy of the world with more sea round it ({ west, east, north, south }
// steps, as seaWanted says): { world, dx, dz }, dx and dz how far east and
// south everything already there moved.
export function grownWorld(world, more) {
  const dx = more.west * STEP;
  const dz = more.north * STEP;
  const W = world.W + dx + more.east * STEP;
  const D = world.D + dz + more.south * STEP;
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
  const grown = new World({ ...meta, W, D, spawn, blocks });
  grown.landCount = world.landCount;
  return { world: grown, dx, dz };
}
