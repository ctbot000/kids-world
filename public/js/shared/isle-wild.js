// The maps of the Wild Isle, the third episode of Adventure Isle's story
// (isle-story.js): an island that is not made of bricks at all. They are
// made as the isle's other maps are (isle-maps.js Maker: the lie of the land,
// then the way, the camps, the gates, and what grows), but shaped as real
// land is: shores that shelve gently into the sea or drop into it as cliffs,
// hills that roll, rocks that crop out, and nothing square. The world they
// make is still blocks, which is what everyone walks on and the island's
// rules go by; render/real.js draws it as the real thing — the land as one
// smooth skin over the blocks, a step of one block a slope and a step of
// more a rock face — so every map keeps its slopes to steps of one where it
// is meant to be walked, and makes its cliffs from steps of two or more.
//
// Its trees are real trees (blocks.js WILD_TREES: a foot and a trunk of
// TREE_CORE, the crown only drawn), its gates what a wild place has across a
// path — driftwood, a rockfall, brambles, a fallen tree — and its camps
// palisades of logs.
import * as B from './blocks.js';
import { onTerraces, openGround, PAD, rampGate, terraces } from './isle-maps.js';
import { fbm } from './noise.js';
import { hash2 } from './rng.js';

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
// A soft round hill: 1 in the middle, 0 at radius r and beyond.
const bump = (x, z, cx, cz, r) => smooth(1 - Math.hypot(x - cx, z - cz) / r);
// How far a point is from the segment a-b.
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
// How far a point is from a line through points [x, z].
function lineDist(x, z, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

// A real tree of a species (its foot), with a trunk this many blocks high
// over it: what Maker.trees lays.
export function wildTree(foot, trunk = 3) {
  const cells = [[0, 0, 0, foot]];
  for (let y = 1; y <= trunk; y++) cells.push([0, y, 0, B.TREE_CORE]);
  return cells;
}

// Whether a tree at (x, z) would stand clear of the way and the camps: its
// crown no nearer them than reach.
export function clearOfWay(m, x, z, reach = 3.5) {
  const r = Math.ceil(reach);
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > reach * reach || !m.inside(x + dx, z + dz, 0)) continue;
      const k = m.keep[m.k(x + dx, z + dz)];
      if (k === 1 || k === 2) return false;
    }
  }
  return true;
}

// Whether a column is open ground: nothing kept clear there, nothing on it,
// above the sea; its top, or -1.
export function open(m, x, z, pad = 2) {
  if (!m.inside(x, z, pad) || m.keep[m.k(x, z)] || m.bare[m.k(x, z)]) return -1;
  const y = m.ground(x, z);
  return y > m.sea && B.TERRAIN[m.world.get(x, y, z)] && m.world.get(x, y + 1, z) === B.AIR ? y : -1;
}

// Whether the ground within two blocks of (x, z) stands more than a step
// over y: something put there would be a step up it.
export function nearCliff(m, x, z, y, r = 2) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (m.inside(x + dx, z + dz, 0) && m.g[m.k(x + dx, z + dz)] > y + 1) return true;
  return false;
}

// Boulders lying about where where(x, z, top) says: each one to four
// blocks, a rock or two side by side, sometimes one on another.
export function boulders(m, count, where = () => true, big = 0.3) {
  const { world, rng } = m;
  for (let tries = 0, n = 0; tries < count * 30 && n < count; tries++) {
    const x = rng.int(3, m.S - 4);
    const z = rng.int(3, m.S - 4);
    const y = open(m, x, z);
    if (y < 0 || !where(x, z, y) || nearCliff(m, x, z, y)) continue;
    world.set(x, y + 1, z, B.BOULDER);
    if (rng.chance(big)) {
      const [dx, dz] = rng.pick([[1, 0], [0, 1], [-1, 0], [0, -1]]);
      if (open(m, x + dx, z + dz) === y) world.set(x + dx, y + 1, z + dz, B.BOULDER);
      if (rng.chance(0.4)) world.set(x, y + 2, z, B.BOULDER);
    }
    m.claim(x + 0.5, z + 0.5, 1.5, 3);
    n++;
  }
}

// Driftwood washed up on a beach: a log lying along x or z, len long.
export function driftwood(m, count, where = () => true) {
  const { world, rng } = m;
  for (let tries = 0, n = 0; tries < count * 40 && n < count; tries++) {
    const x = rng.int(3, m.S - 4);
    const z = rng.int(3, m.S - 4);
    const y = open(m, x, z);
    if (y < 0 || world.get(x, y, z) !== B.SAND || !where(x, z, y) || nearCliff(m, x, z, y)) continue;
    const alongX = rng.chance(0.5);
    const len = rng.int(2, 4);
    let ok = true;
    for (let i = 0; i < len && ok; i++) ok = open(m, x + (alongX ? i : 0), z + (alongX ? 0 : i)) === y;
    if (!ok) continue;
    for (let i = 0; i < len; i++) world.set(x + (alongX ? i : 0), y + 1, z + (alongX ? 0 : i), B.LOGS);
    m.claim(x + 0.5 + (alongX ? len / 2 : 0), z + 0.5 + (alongX ? 0 : len / 2), len / 2 + 1, 3);
    n++;
  }
}

// A lighthouse of whitewashed stone (drawn as a model of its own:
// render/real-models.js lighthouseModel), round, narrowing as it climbs, its
// gallery and lantern room on top: solid blocks to bump into, its model's
// foot in the middle at the bottom.
function lighthouse(m, cx, cz) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  const tall = 13;
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dx, dz);
      const x = cx + dx;
      const z = cz + dz;
      // On a stone footing down to the rock.
      if (d <= 3.5) for (let y = m.ground(x, z) + 1; y <= y0; y++) world.set(x, y, z, B.MASS);
      for (let y = 1; y <= tall; y++) if (d <= 3.25 - (y / tall) * 1.2) world.set(x, y0 + y, z, B.MASS);
      if (d <= 2.6) world.set(x, y0 + tall + 1, z, B.MASS);
      if (d <= 1.3) for (let y = tall + 2; y <= tall + 4; y++) world.set(x, y0 + y, z, B.MASS);
    }
  }
  world.set(cx, y0 + 1, cz, B.LIGHTHOUSE);
  m.claim(cx, cz, 6, 3);
}

// ---------------------------------------------------------------- the land

// The Wild Isle's land on terraces (isle-maps.js terraces: each column the
// tier of the way nearest it): an island with a ragged coast, rolling as
// hills(x, z) says, each terrace after the first lift higher than the one
// before, standing over the sea in cliffs; only the first, where everyone
// lands, comes down to the sea in a beach. So the only way up from one
// terrace to the next is the way, through its gate. shape: how far inside
// the island a point is (1 in its middle, 0 on its coast), if not round.
function wildLand(m, tierAt, { hills = () => 2, lift = 5, coast = 2.5, base = 3.5, shape = null, rim = 58, wiggle = 0.1 } = {}) {
  const { seed } = m;
  const SEA = m.sea;
  return (x, z) => {
    const n = fbm(seed + 11, x / 19, z / 19, 4) * wiggle;
    const edge = (shape ? shape(x, z) : 1 - Math.hypot(x - 64, z - 64) / rim) + n;
    const t = tierAt(x, z);
    const bed = SEA - 3 - Math.min(14, Math.max(0, -edge) * 70) + fbm(seed + 9, x / 9, z / 9, 2) * 0.6;
    if (edge <= 0) return bed;
    const ground = SEA + 0.6 + base * smooth(edge / 0.3) + hills(x, z);
    // The first terrace's beach shelves gently into the sea; every terrace
    // after it stands over the water in a cliff, sheer from the sea bed to
    // its top (a slope there would be a stair up it from the terrace below,
    // all along the shore).
    if (!t) return lerp(bed, ground, smooth(edge / 0.14));
    return edge < 0.006 ? bed : ground + coast + lift * t;
  };
}

// The terraces of a map (isle-maps.js terraces), their edges wandering as
// real escarpments do rather than running straight across the island.
function wildTiers(m, nodes, wander = 5) {
  const flat = terraces(m, nodes);
  const { seed } = m;
  const warp = (x, z) => [x + fbm(seed + 201, x / 17, z / 17, 3) * wander, z + fbm(seed + 202, x / 17, z / 17, 3) * wander];
  const tierAt = (x, z) => {
    // On and right beside the way, its own terrace.
    if (flat.dist(x, z) < 4) return flat(x, z);
    const [wx, wz] = warp(x, z);
    return flat(wx, wz);
  };
  tierAt.dist = flat.dist;
  return tierAt;
}

// A gate of logs piled across the way, two or three high; of boulders; of
// brambles; of a fallen tree, its trunk across and its branches up.
const logGate = (x, y, z, i) => (i < 2 || (i === 2 && (x + z) % 3 !== 0) ? B.LOGS : 0);
const rockGate = (seed) => (x, y, z, i) => (i < 2 || (i === 2 && hash2(seed + 3, x, z) < 0.75) ? B.BOULDER : 0);
const thornGate = (x, y, z, i) => (i < 3 ? B.BRAMBLE : 0);

// Trees where pick(top, x, z, y, rng) says, off the way and the camps.
export function wildTrees(m, tries, apart, pick, reach = 3.5) {
  m.trees(tries, apart, (x, z, y, rng) => (clearOfWay(m, x, z, reach) ? pick(m.world.get(x, y, z), x, z, y, rng) : null), 1);
}

// ---------------------------------------------------------------- Driftwood Bay

// Chapter 1 of the third episode: a bay on the south side of the Wild Isle.
// Everyone lands on its long sandy beach in the south-east; the way goes
// west along the beach behind the dunes to Driftwood Beach, up onto the
// rocky shelf of the west coast to the Tide Pools, up the headland to
// Lighthouse Point, and east along the clifftops to the Old Sea Fort on its
// rocky point, where Old Ironclaw keeps the first Sunstone.
export function cove(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.PEBBLES;
  const nodes = [
    { x: 98, z: 104, t: 0 },
    { x: 88, z: 108, t: 0 },
    { x: 76, z: 106, t: 0, camp: true },
    { x: 62, z: 108, t: 0 },
    { x: 48, z: 104, t: 0 },
    { x: 36, z: 94, t: 1 },
    { x: 28, z: 82, t: 1 },
    { x: 26, z: 68, t: 1, camp: true },
    { x: 28, z: 54, t: 1 },
    { x: 34, z: 42, t: 2 },
    { x: 42, z: 32, t: 2 },
    { x: 54, z: 26, t: 2, camp: true },
    { x: 68, z: 22, t: 2 },
    { x: 80, z: 22, t: 3 },
    { x: 92, z: 26, t: 3 },
    { x: 100, z: 36, t: 3, camp: true },
  ];
  const tierAt = wildTiers(m, nodes);
  const shape = (x, z) => 1 - Math.hypot((x - 64) / 58, (z - 64) / 56) - 0.5 * bump(x, z, 126, 70, 22);
  const height = wildLand(m, tierAt, { shape, lift: 4, base: 2.5, hills: (x, z) => 1.2 + fbm(seed + 23, x / 24, z / 24, 4) * 1.4 });
  m.shape(height);
  const path = m.route(onTerraces(nodes, height), { width: 1.6, slope: 0.55, blend: 0 });
  const camp = { post: B.WOOD, lamp: B.LAMP, floor: B.PEBBLES, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: camp });
  const pools = m.camp(path, 7, { blend: 2, style: camp });
  const point = m.camp(path, 11, { blend: 2, style: camp });
  m.camp(path, 15, { kind: 'castle', blend: 2, style: { wall: B.BRICK_WALL, stripe: B.BRICK_WALL, tower: B.BRICK_WALL, lamp: B.LAMP, floor: B.PEBBLES } });
  // Room for the lighthouse out on the headland, and the tide pools on the shelf.
  m.level(point.x - 6, point.z - 12, 4.5, 4.5, point.level, PAD, 3);
  for (const [px, pz, r] of [[pools.x - 12, pools.z + 1, 2.2], [pools.x - 11, pools.z + 7, 1.7], [pools.x - 13, pools.z - 6, 1.6]]) m.pond(px, pz, r, pools.level, 1);
  m.finish();
  const { world } = m;
  lighthouse(m, Math.floor(point.x) - 6, Math.floor(point.z) - 12);
  rampGate(m, path, 4, 1, logGate, { high: 4 });
  rampGate(m, path, 8, 2, rockGate(seed), { high: 4 });
  rampGate(m, path, 12, 3, thornGate, { high: 4 });
  wildTrees(m, 1500, 5, (top, x, z, y, rng) => {
    if (top === B.SAND) return rng.chance(0.35) ? wildTree(B.WILD_PALM, 4) : null;
    if (fbm(seed + 53, x / 16, z / 16, 2) < -0.1 && rng.chance(0.85)) return null;
    if (y > SEA + 9) return rng.chance(0.75) ? wildTree(B.WILD_PINE, 4) : wildTree(B.WILD_BIRCH, 3);
    return rng.chance(0.5) ? wildTree(B.WILD_OAK, 3) : rng.chance(0.5) ? wildTree(B.WILD_PINE, 4) : wildTree(B.WILD_BIRCH, 3);
  });
  boulders(m, 30, (x, z, y) => y > SEA + 2 || world.get(x, y, z) === B.STONE);
  driftwood(m, 10);
  m.flowers(30, { grass: B.TALL_GRASS, extra: B.BUSH, rare: 0.985 });
  return { fruit: B.FRUIT_ITEMS[2] };
}

// ---------------------------------------------------------------- Deepwood Forest

// Chapter 2: Deepwood Forest, climbing from the shore in the south-west
// through tall pines in terraces, by Fern Hollow, over a mossy stream, past
// the woodcutters' camp and the Old Oak, up to the Bear's Den at the top in
// the north, a ring of tumbled rocks where Old Bramblepaw keeps the second
// Sunstone.
export function deepwood(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.DIRT;
  const nodes = [
    { x: 25, z: 104, t: 0 },
    { x: 31, z: 100, t: 0 },
    { x: 40, z: 96, t: 0, camp: true },
    { x: 52, z: 100, t: 0 },
    { x: 66, z: 104, t: 1 },
    { x: 80, z: 104, t: 1, camp: true },
    { x: 94, z: 100, t: 1 },
    { x: 104, z: 88, t: 2 },
    { x: 106, z: 74, t: 2, camp: true },
    { x: 102, z: 60, t: 2 },
    { x: 92, z: 50, t: 3 },
    { x: 78, z: 46, t: 3, camp: true },
    { x: 66, z: 42, t: 3 },
    { x: 54, z: 36, t: 4 },
    { x: 40, z: 26, t: 4, camp: true },
  ];
  const tierAt = wildTiers(m, nodes);
  const height = wildLand(m, tierAt, { rim: 60, lift: 4, base: 2.5, hills: (x, z) => 1.5 + fbm(seed + 31, x / 20, z / 20, 4) * 1.6 });
  m.shape(height);
  // A stream through the forest, from the hills down to the sea, crossed by
  // the way on a bridge of planks by the Mossy Bridge camp.
  const path = m.route(onTerraces(nodes, height), { width: 1.5, slope: 0.55, blend: 0 });
  const forest = { post: B.WOOD, lamp: B.LAMP, floor: B.PEBBLES, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: forest });
  m.camp(path, 5, { blend: 2, style: forest });
  const woodcut = m.camp(path, 8, { blend: 2, style: forest });
  const oak = m.camp(path, 11, { blend: 2, style: forest });
  m.camp(path, 14, { kind: 'castle', blend: 2, style: { wall: B.BOULDER, stripe: B.BOULDER, tower: B.BOULDER, lamp: B.LAMP, floor: B.PEBBLES } });
  m.finish();
  const { world } = m;
  // The woodcutters' log piles round their camp.
  for (const [dx, dz] of [[9, 4], [-9, -3], [3, 10]]) {
    const x = Math.floor(woodcut.x + dx);
    const z = Math.floor(woodcut.z + dz);
    const y = openGround(m, x, z);
    if (y < 0 || nearCliff(m, x, z, y, 3)) continue;
    for (let i = -1; i <= 1; i++) if (openGround(m, x + i, z) === y) world.set(x + i, y + 1, z, B.LOGS);
    m.claim(x, z, 2.5, 3);
  }
  // The Old Oak, by its camp: the biggest tree in the forest.
  {
    const x = Math.floor(oak.x) - 9;
    const z = Math.floor(oak.z) - 8;
    const y = m.ground(x, z);
    if (y > SEA) {
      world.set(x, y + 1, z, B.WILD_OAK);
      for (let k = 2; k <= 4; k++) world.set(x, y + k, z, B.TREE_CORE);
      m.claim(x, z, 4, 3);
    }
  }
  rampGate(m, path, 3, 1, logGate, { high: 4 });
  rampGate(m, path, 6, 2, thornGate, { high: 4 });
  rampGate(m, path, 9, 3, logGate, { high: 4 });
  rampGate(m, path, 12, 4, rockGate(seed), { high: 4 });
  wildTrees(m, 2600, 4, (top, x, z, y, rng) => {
    if (top !== B.GRASS) return null;
    if (fbm(seed + 57, x / 14, z / 14, 2) < -0.35 && rng.chance(0.7)) return null;
    return rng.chance(0.62) ? wildTree(B.WILD_PINE, 4) : rng.chance(0.6) ? wildTree(B.WILD_OAK, 3) : wildTree(B.WILD_BIRCH, 3);
  }, 3);
  boulders(m, 36, (x, z, y) => y > SEA + 1, 0.4);
  m.flowers(24, { grass: B.FERN, extra: B.BUSH, rare: 0.975 });
  return { fruit: B.FRUIT_ITEMS[0] };
}

// ---------------------------------------------------------------- Thunder Falls

// Chapter 3: a river valley, the river coming down from the top of the isle
// in falls over each terrace to the sea in the south. The way climbs beside
// it from the river's mouth by Riverbend, the Otter Pools and the Misty
// Steps, to the Great Dam at the top, which Gnasher the beaver has built of
// whole trees with the third Sunstone inside.
export function falls(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.DIRT;
  const nodes = [
    { x: 46, z: 106, t: 0 },
    { x: 44, z: 98, t: 0 },
    { x: 40, z: 88, t: 0, camp: true },
    { x: 36, z: 76, t: 0 },
    { x: 34, z: 64, t: 1 },
    { x: 38, z: 52, t: 1, camp: true },
    { x: 46, z: 42, t: 1 },
    { x: 58, z: 36, t: 2 },
    { x: 72, z: 34, t: 2, camp: true },
    { x: 86, z: 34, t: 2 },
    { x: 96, z: 40, t: 3 },
    { x: 100, z: 54, t: 3, camp: true },
  ];
  const tierAt = wildTiers(m, nodes);
  const height = wildLand(m, tierAt, { rim: 60, lift: 5, base: 2.5, hills: (x, z) => 1.4 + fbm(seed + 37, x / 22, z / 22, 4) * 1.3 });
  m.shape(height);
  // The river: from the lake at the top, past the way's camps on the far
  // bank, over the edge of each terrace, down to the sea.
  m.channel([[106, 72], [92, 66], [78, 60], [70, 70], [64, 84], [60, 98], [58, 112], [58, 126]], { width: 5, depth: 2 });
  const path = m.route(onTerraces(nodes, height), { width: 1.5, slope: 0.55, blend: 0 });
  const bank = { post: B.WOOD, lamp: B.LAMP, floor: B.PEBBLES, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: bank });
  m.camp(path, 5, { blend: 2, style: bank });
  m.camp(path, 8, { blend: 2, style: bank });
  m.camp(path, 11, { kind: 'castle', blend: 2, style: { wall: B.LOGS, stripe: B.LOGS, tower: B.LOGS, lamp: B.LAMP, floor: B.PLANKS } });
  m.finish();
  const { world } = m;
  rampGate(m, path, 3, 1, logGate, { high: 4 });
  rampGate(m, path, 6, 2, rockGate(seed), { high: 4 });
  rampGate(m, path, 9, 3, (x, y, z, i) => (i < 3 ? (i === 2 ? B.LOGS : B.BRAMBLE) : 0), { high: 4 });
  wildTrees(m, 1900, 5, (top, x, z, y, rng) => {
    if (top !== B.GRASS) return null;
    return rng.chance(0.45) ? wildTree(B.WILD_PINE, 4) : rng.chance(0.55) ? wildTree(B.WILD_BIRCH, 3) : wildTree(B.WILD_OAK, 3);
  });
  boulders(m, 44, () => true, 0.45);
  m.flowers(30, { grass: B.TALL_GRASS, extra: B.FERN, rare: 0.98 });
  return { fruit: B.FRUIT_ITEMS[1] };
}

// ---------------------------------------------------------------- Snowcap Ridge

// Chapter 4: the highest corner of the Wild Isle. The way climbs from the
// meadows in the south past the Shepherds' Hut, by Glacier Lake under the
// snowfields and over the Windy Saddle, up to Eagle Crag at the top, where
// Old Curlhorn keeps the fourth Sunstone.
export function ridge(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.PEBBLES;
  m.pal.rockAt = 13;
  m.pal.peakAt = 17;
  const nodes = [
    { x: 88, z: 106, t: 0 },
    { x: 79, z: 104, t: 0 },
    { x: 68, z: 100, t: 0, camp: true },
    { x: 54, z: 98, t: 0 },
    { x: 40, z: 92, t: 1 },
    { x: 30, z: 80, t: 1, camp: true },
    { x: 28, z: 66, t: 1 },
    { x: 36, z: 54, t: 2 },
    { x: 50, z: 50, t: 2, camp: true },
    { x: 64, z: 48, t: 2 },
    { x: 74, z: 40, t: 3 },
    { x: 78, z: 26, t: 3, camp: true },
  ];
  const tierAt = wildTiers(m, nodes);
  const height = wildLand(m, tierAt, { rim: 60, lift: 5, base: 3, hills: (x, z) => 1.5 + fbm(seed + 41, x / 18, z / 18, 5) * 2 + bump(x, z, 92, 40, 30) * 6 });
  m.shape(height);
  const path = m.route(onTerraces(nodes, height), { width: 1.5, slope: 0.55, blend: 0 });
  const hut = { post: B.WOOD, lamp: B.LAMP, floor: B.PEBBLES, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: hut });
  const lake = m.camp(path, 5, { blend: 2, style: hut });
  m.camp(path, 8, { blend: 2, style: hut });
  m.camp(path, 11, { kind: 'castle', blend: 2, style: { wall: B.BOULDER, stripe: B.BOULDER, tower: B.BOULDER, lamp: B.LAMP, floor: B.PEBBLES } });
  m.pond(lake.x + 13, lake.z - 2, 5, lake.level, 2);
  m.finish();
  const { world } = m;
  rampGate(m, path, 3, 1, rockGate(seed), { high: 4 });
  rampGate(m, path, 6, 2, logGate, { high: 4 });
  rampGate(m, path, 9, 3, rockGate(seed + 1), { high: 4 });
  wildTrees(m, 1500, 5, (top, x, z, y, rng) => {
    if (top !== B.GRASS || y > SEA + 15) return null;
    return rng.chance(0.8) ? wildTree(B.WILD_PINE, 4) : wildTree(B.WILD_BIRCH, 3);
  });
  boulders(m, 60, () => true, 0.5);
  m.flowers(26, { grass: B.TALL_GRASS, extra: B.BUSH, rare: 0.99 });
  return { fruit: B.FRUIT_ITEMS[3] };
}

// ---------------------------------------------------------------- Murk Fen

// Chapter 5, the last: Murk Fen, low and wet, its pools and reeds in the
// fog, dead trees standing in the water, and the way over them on
// boardwalks; by the Reed Bank, the Sunken Causeway and the Hermit's Hut to
// Murk Tower on its rise in the middle, where Old Murk keeps the last
// Sunstone.
export function fen(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.DIRT;
  const nodes = [
    { x: 102, z: 100, t: 0 },
    { x: 94, z: 106, t: 0 },
    { x: 82, z: 104, t: 0, camp: true },
    { x: 68, z: 104, t: 0 },
    { x: 54, z: 100, t: 1 },
    { x: 40, z: 92, t: 1, camp: true },
    { x: 30, z: 80, t: 1 },
    { x: 28, z: 66, t: 2 },
    { x: 34, z: 52, t: 2, camp: true },
    { x: 46, z: 44, t: 2 },
    { x: 58, z: 44, t: 3 },
    { x: 66, z: 52, t: 3 },
    { x: 72, z: 64, t: 3, camp: true },
  ];
  const tierAt = wildTiers(m, nodes);
  const height = wildLand(m, tierAt, { rim: 60, lift: 4, coast: 2, base: 1.5, hills: (x, z) => 0.6 + fbm(seed + 47, x / 14, z / 14, 3) * 0.9 });
  m.shape(height);
  // Pools all over the fen, dark and still.
  for (let i = 0; i < 26; i++) {
    const x = 14 + hash2(seed + 71, i, 1) * 100;
    const z = 14 + hash2(seed + 71, i, 2) * 100;
    const r = 2 + hash2(seed + 71, i, 3) * 3;
    // (Never by the edge of a terrace: its rim would be a step up it.)
    let edge = tierAt.dist(x, z) < 7;
    for (let a = 0; a < 12 && !edge; a++) edge = tierAt(x + Math.cos(a / 1.9) * (r + 4), z + Math.sin(a / 1.9) * (r + 4)) !== tierAt(x, z);
    if (edge) continue;
    m.pond(x, z, r, Math.round(height(x, z)) - 1, 1);
  }
  const path = m.route(onTerraces(nodes, height), { width: 1.5, slope: 0.55, blend: 0 });
  const fenCamp = { post: B.WOOD, lamp: B.LAMP, floor: B.PLANKS, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: fenCamp });
  m.camp(path, 5, { blend: 2, style: fenCamp });
  m.camp(path, 8, { blend: 2, style: fenCamp });
  m.camp(path, 12, { kind: 'castle', blend: 2, style: { wall: B.BRICK_WALL, stripe: B.BRICK_WALL, tower: B.BRICK_WALL, lamp: B.LAMP, floor: B.PEBBLES } });
  m.finish();
  const { world } = m;
  rampGate(m, path, 3, 1, logGate, { high: 4 });
  rampGate(m, path, 6, 2, thornGate, { high: 4 });
  rampGate(m, path, 9, 3, rockGate(seed), { high: 4 });
  wildTrees(m, 1400, 5, (top, x, z, y, rng) => {
    if (top !== B.GRASS) return null;
    return rng.chance(0.45) ? wildTree(B.WILD_SNAG, 3) : rng.chance(0.5) ? wildTree(B.WILD_BIRCH, 3) : wildTree(B.WILD_PINE, 4);
  });
  // Reeds round every pool's edge.
  for (let x = 2; x < m.S - 2; x++) {
    for (let z = 2; z < m.S - 2; z++) {
      const y = openGround(m, x, z);
      if (y < 0) continue;
      let wet = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.get(x + dx, y + 1, z + dz) === B.WATER || world.get(x + dx, y, z + dz) === B.WATER) wet = true;
      if (wet && hash2(seed + 77, x, z) < 0.6) world.set(x, y + 1, z, B.REEDS);
    }
  }
  boulders(m, 20, () => true);
  m.flowers(22, { grass: B.REEDS, extra: B.MUSHROOM, rare: 0.97 });
  return { fruit: B.FRUIT_ITEMS[4] };
}

// The Wild Isle's maps, by chapter key (isle-story.js).
export const WILD_MAPS = { cove, deepwood, falls, ridge, fen };
