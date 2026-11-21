// The maps of Toon Isle, the fifth episode of Adventure Isle's story
// (isle-story.js): the biggest islands of the isle's story, each twice as
// far across as any before (EPISODES side), drawn as a cartoon
// (render/cartoon.js) and hidden under Baron Bluster's Cloud Blanket until
// someone gets there (isle-battles.js Fog).
//
// They are made as the isle's other maps are (isle-maps.js Maker: the lie
// of the land, then the ways, then what is built and what grows), but with
// no camps, no gates and no lair: everyone lands on a beach in the south,
// by the chapter's Sky Lantern (its hub, a lamp round it for each battle),
// and from a crossroads inland the paths go out to each of the chapter's
// battles (isle-battles.js): a clearing for an ambush, a hilltop beacon for
// a siege, a glade of Storm Nests, a long way round for a hunt's Big Bad to
// roam, and on the last, Baron Bluster's arena on the very top. The Storm
// Gang's roaming gangs go up and down the same paths.
//
// Everything of a battle can be walked to from where everyone lands (the
// tests walk every map, journey and a few seeds to make sure). Each map
// returns its battles in its chapter's order, its hub, and its paths.
import * as B from './blocks.js';
import { lighthouse } from './isle-maps.js';
import { boulders, driftwood, open, wildTree, wildTrees } from './isle-wild.js';
import { fbm } from './noise.js';

const [RED, ORANGE, YELLOW, LIME, GREEN, TEAL, SKY, BLUE, PURPLE, LAVENDER, PINK, WHITE, GRAY, CHARCOAL, BROWN, TAN] = B.TOY_BRICKS;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
// A soft round hill: 1 in the middle, 0 at radius r and beyond.
const bump = (x, z, cx, cz, r) => smooth(1 - Math.hypot(x - cx, z - cz) / r);
const RING8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// How big each kind of battle's ground is: levelled this far round it, and
// the battle's own reach (isle-battles.js: an ambush's ring of thorns, the
// ground a siege's Storm Gang comes over, a glade of nests, the arena).
const PAD = { ambush: 12.5, siege: 6, nest: 12, hunt: 0, showdown: 17.5 };
const REACH = { ambush: 11, siege: 26, nest: 12, hunt: 9, showdown: 16 };

// ---------------------------------------------------------------- the land

// An island's outline: how far inside it a point is (1 in its middle, 0 on
// its coast, below 0 out at sea): round (cx, cz), R across, its coast
// wobbling (each [k, amp, phase] a wave of k bumps round it) and bitten into
// by bays (each [x, z, r, depth]).
function outline(m, { cx = 128, cz = 124, R = 110, wobble = [[3, 0.07, 0.4], [5, 0.04, 2.1]], bays = [] } = {}) {
  const { seed } = m;
  return (x, z) => {
    const dx = x - cx;
    const dz = z - cz;
    const a = Math.atan2(dz, dx);
    let r = R;
    for (const [k, amp, ph] of wobble) r *= 1 + amp * Math.sin(k * a + ph);
    let e = 1 - Math.hypot(dx, dz) / r + fbm(seed + 11, x / 30, z / 30, 3) * 0.05;
    for (const [bx, bz, br, depth] of bays) e -= depth * bump(x, z, bx, bz, br);
    return e;
  };
}

// The land of a big toon island: the ground over the sea at `base`, and
// hills(x, z) over that, shelving into the sea in beaches all round.
function toonLand(m, shape, { base = 3, hills = () => 0, beach = 0.07 } = {}) {
  const { seed } = m;
  const SEA = m.sea;
  return (x, z) => {
    const e = shape(x, z);
    const bed = SEA - 3 - Math.min(14, Math.max(0, -e) * 50) + fbm(seed + 9, x / 11, z / 11, 2) * 0.6;
    if (e <= 0) return bed;
    const land = SEA + 0.6 + base * smooth(e / 0.18) + hills(x, z) * smooth(e / 0.3);
    return lerp(bed, land, smooth(e / beach));
  };
}

// ---------------------------------------------------------------- the ways

// Every way laid, as the gangs go along them: a point every few blocks.
function gangRoads(m) {
  return m.routes.map(({ pts }) => {
    const out = [];
    let last = -Infinity;
    for (const p of pts) {
      if (p.s - last < 4) continue;
      last = p.s;
      out.push([+p.x.toFixed(1), +p.z.toFixed(1)]);
    }
    return out;
  });
}

// A hunt's range as its Big Bad goes round it: a point every few blocks
// along the loop of its way.
function rangeOf(pts) {
  const out = [];
  let last = -Infinity;
  for (const p of pts) {
    if (p.s - last < 3) continue;
    last = p.s;
    out.push([+p.x.toFixed(1), +p.z.toFixed(1)]);
  }
  return out;
}

// ---------------------------------------------------------------- an island

// A toon island made from a plan: its land (shape, land: toonLand's
// options), water (rivers and ponds, made before the ways), where everyone
// lands, its hub, the crossroads the ways go out from, and its battles'
// sites in the chapter's order (each { kind, at: [x, z], via: [[x, z]...]
// on the way there from the crossroads, y: its ground's height if not the
// land's, loop: for a hunt, the way round its range }); then build(ctx)
// for what is built there and decor(ctx) for what grows. Returns what
// buildIsle wants of a chapter's map.
function toonIsland(m, plan) {
  const shape = outline(m, plan.shape);
  const height = toonLand(m, shape, plan.land);
  m.shape(height);
  plan.water?.(m, height);
  const node = ([x, z], y) => (Number.isFinite(y) ? { x: x + 0.5, z: z + 0.5, y } : { x: x + 0.5, z: z + 0.5 });
  const sites = plan.sites.map((s) => {
    if (s.kind === 'hunt') return { ...s };
    const [x, z] = s.at;
    const y = s.y ?? Math.round(height(x, z));
    m.disc(x + 0.5, z + 0.5, PAD[s.kind], y, s.blend ?? 7, 2);
    return { ...s, x, z, y };
  });
  // The way in: from the beach past the Sky Lantern to the crossroads.
  const [hx, hz] = plan.hub;
  m.level(hx + 0.5, hz + 0.5, 5, 5, Math.round(height(hx, hz)), 4, 3);
  m.route([node(plan.landing), node([hx + 6, hz]), node(plan.cross)], { width: 1.8, slope: 0.5, blend: 5 });
  // Out to each battle.
  for (const s of sites) {
    if (s.kind === 'hunt') {
      const pts = m.route([...s.loop, s.loop[0]].map((p) => node(p)), { width: 1.6, slope: 0.5, blend: 5 });
      s.range = rangeOf(pts);
      m.route([node(plan.cross), ...(s.via ?? []).map((p) => node(p)), node(s.loop[0])], { width: 1.6, slope: 0.5, blend: 5 });
      continue;
    }
    m.route([node(plan.cross), ...(s.via ?? []).map((p) => node(p)), node([s.x, s.z], s.y)], { width: 1.6, slope: 0.5, blend: 5 });
  }
  for (const way of plan.ways ?? []) m.route(way.map((p) => node(p)), { width: 1.4, slope: 0.5, blend: 5 });
  m.finish();
  const { world } = m;
  const ctx = { m, world, height, sites, seed: m.seed, SEA: m.sea };
  // Each battle's ground, as its kind has it.
  const specs = sites.map((s) => {
    if (s.kind === 'hunt') {
      const [x, z] = s.range[0];
      return { kind: 'hunt', x, y: m.ground(Math.floor(x), Math.floor(z)) + 1, z, r: REACH.hunt, range: s.range };
    }
    const x = s.x;
    const z = s.z;
    const y = m.ground(x, z) + 1;
    const spec = { kind: s.kind, x: x + 0.5, y, z: z + 0.5, r: REACH[s.kind] };
    if (s.kind === 'ambush') {
      spec.prize = [x, y, z];
      world.set(x, y, z, B.SPARK);
      m.claim(x + 0.5, z + 0.5, REACH.ambush + 1.5, 3);
    } else if (s.kind === 'siege') {
      spec.beacon = beacon(m, x, z);
    } else if (s.kind === 'nest') {
      spec.spots = nestSpots(m, x, z, s.nests ?? 3, s.phase ?? 0);
    } else if (s.kind === 'showdown') {
      spec.rods = arena(m, x, z, s.phase ?? 0);
    }
    return spec;
  });
  const hub = skyLantern(m, hx, hz, specs.length);
  plan.build?.(ctx, specs);
  plan.decor?.(ctx, specs);
  return { fruit: plan.fruit ?? B.FRUIT_ITEMS[0], battles: specs, hub, roads: gangRoads(m) };
}

// ---------------------------------------------------------------- what is built

// The Sky Lantern where everyone lands (drawn as a model of its own,
// render/cartoon-models.js): on a round stone floor, its body solid to bump
// into, and round its front a lamp on a post for each battle, lit as each is
// won (isle-battles.js). Returns the hub: { lantern, lamps }.
function skyLantern(m, cx, cz, count) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      if (Math.hypot(dx, dz) > 4.3) continue;
      const x = cx + dx;
      const z = cz + dz;
      for (let y = m.ground(x, z) + 1; y < y0; y++) world.set(x, y, z, B.STONE);
      world.set(x, y0, z, B.PEBBLES);
      for (let y = y0 + 1; y <= y0 + 8; y++) world.set(x, y, z, B.AIR);
    }
  }
  world.set(cx, y0 + 1, cz, B.SKY_LANTERN);
  for (let y = y0 + 2; y <= y0 + 4; y++) world.set(cx, y, cz, B.MASS);
  const lamps = [];
  for (let i = 0; i < count; i++) {
    const a = Math.PI / 2 + ((i - (count - 1) / 2) * Math.PI) / 5.5;
    const x = cx + Math.round(Math.cos(a) * 3.3);
    const z = cz + Math.round(Math.sin(a) * 3.3);
    world.set(x, y0 + 1, z, B.STONE);
    world.set(x, y0 + 2, z, B.LANTERN_LAMP);
    lamps.push([x, y0 + 2, z]);
  }
  m.claim(cx + 0.5, cz + 0.5, 6, 3);
  return { lantern: [cx, y0 + 1, cz], lamps };
}

// A siege's beacon: a heap of logs to light on a plinth of stone flush with
// the ground. Returns its cell.
function beacon(m, x, z) {
  const { world } = m;
  const y = m.ground(x, z);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      world.set(x + dx, y, z + dz, B.STONE);
      for (let yy = y + 1; yy <= y + 5; yy++) world.set(x + dx, yy, z + dz, B.AIR);
    }
  }
  world.set(x, y + 1, z, B.LOGS);
  m.claim(x + 0.5, z + 0.5, 7, 3);
  return [x, y + 1, z];
}

// Where a glade's Storm Nests sit: n of them round its middle, apart.
function nestSpots(m, cx, cz, n, phase) {
  const { world } = m;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i * Math.PI * 2) / n;
    const x = cx + Math.round(Math.cos(a) * 6.5);
    const z = cz + Math.round(Math.sin(a) * 6.5);
    const y = m.ground(x, z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let yy = y + 1; yy <= y + 3; yy++) world.set(x + dx, yy, z + dz, B.AIR);
    out.push([x, y + 1, z]);
  }
  m.claim(cx + 0.5, cz + 0.5, REACH.nest + 1, 3);
  return out;
}

// Baron Bluster's arena: a round floor of pebbles, and three lightning rods
// round it, each a pole of two. Returns the rods' cells (their feet).
function arena(m, cx, cz, phase) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  for (let dx = -16; dx <= 16; dx++) {
    for (let dz = -16; dz <= 16; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 15.5) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (d > 14.4 || (d < 3.5 && d > 2.4)) world.set(x, y0, z, B.PEBBLES);
      for (let y = y0 + 1; y <= y0 + 6; y++) world.set(x, y, z, B.AIR);
    }
  }
  const rods = [];
  for (let i = 0; i < 3; i++) {
    const a = phase + (i * Math.PI * 2) / 3;
    const x = cx + Math.round(Math.cos(a) * 11);
    const z = cz + Math.round(Math.sin(a) * 11);
    for (const [dx, dz] of RING8) world.set(x + dx, y0, z + dz, B.PEBBLES);
    world.set(x, y0 + 1, z, B.LIGHTNING_ROD);
    world.set(x, y0 + 2, z, B.LIGHTNING_ROD);
    rods.push([x, y0 + 1, z]);
  }
  m.claim(cx + 0.5, cz + 0.5, 18, 3);
  return rods;
}

// A shipwreck keeled over on its side (as the isle's first chapter has one),
// its length along `along`, beside an ambush's clearing.
function wreck(m, cx, cz, along) {
  const { world } = m;
  const ux = Math.cos(along);
  const uz = Math.sin(along);
  const y0 = m.ground(Math.floor(cx), Math.floor(cz));
  for (let l = -6; l <= 6; l++) {
    const half = 2.6 * Math.sqrt(Math.max(0, 1 - (l / 6.6) ** 2));
    for (let w = -Math.ceil(half); w <= Math.ceil(half); w++) {
      for (let y = 0; y <= 3; y++) {
        const r = Math.hypot(w / Math.max(0.8, half), (y - 0.5) / 2.6);
        if (r > 1 || (r < 0.62 && l > -5 && l < 5)) continue;
        const x = Math.floor(cx + ux * l - uz * w);
        const z = Math.floor(cz + uz * l + ux * w);
        world.set(x, y0 + 1 + y, z, (l + y) % 3 === 0 ? B.WOOD : B.PLANKS);
      }
    }
  }
  for (let l = 0; l < 6; l++) world.set(Math.floor(cx - uz * (3 + l)), y0 + 1, Math.floor(cz + ux * (3 + l)), B.WOOD);
  m.claim(cx, cz, 8, 3);
}

// A ring of things round a clearing (just outside an ambush's ring of
// thorns, so they never shut anyone in or out): make(x, z, y, i) puts each.
function around(m, cx, cz, r, n, make) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n + 0.2;
    const x = Math.floor(cx + Math.cos(a) * r);
    const z = Math.floor(cz + Math.sin(a) * r);
    const y = m.ground(x, z);
    if (y <= m.sea) continue;
    make(x, z, y, i);
    m.claim(x + 0.5, z + 0.5, 2, 3);
  }
}

// A giant toadstool standing by itself, its stem two to four high: for a
// fairy ring (drawn by the cartoon renderer from its foot).
const giantToadstool = (m, x, z, y, stem = 3) => {
  m.world.set(x, y + 1, z, B.TOON_SHROOM);
  for (let k = 2; k <= stem; k++) m.world.set(x, y + k, z, B.TREE_CORE);
};

// A giant's bone, half buried: an arc of white bricks along `along`.
function bone(m, cx, cz, along, len = 6, high = 4) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  for (let l = 0; l <= len; l++) {
    const t = l / len;
    const x = Math.floor(cx + Math.cos(along) * (t - 0.5) * len);
    const z = Math.floor(cz + Math.sin(along) * (t - 0.5) * len);
    const y = y0 + 1 + Math.round(Math.sin(t * Math.PI) * high);
    world.set(x, y, z, WHITE);
    if (l === 0 || l === len) for (let k = y0 + 1; k < y; k++) world.set(x, k, z, WHITE);
  }
}

// An icicle pillar: a spire of ice `high` blocks, thick at its foot.
function icicle(m, x, z, y, high) {
  const { world } = m;
  for (let k = 1; k <= high; k++) {
    world.set(x, y + k, z, B.ICE);
    if (k <= high / 3) for (const [dx, dz] of [[1, 0], [0, 1]]) world.set(x + dx, y + k, z + dz, B.ICE);
  }
}

// A standing stone of the Storm Circle: dark stone, a little lean.
function standingStone(m, x, z, y, high) {
  for (let k = 1; k <= high; k++) m.world.set(x, y + k, z, k === high ? CHARCOAL : B.STONE);
}

// A stone tower with the beacon at its foot (the Lightning Tower): a ring of
// stone four high with a lightning rod on top, beside a siege's beacon.
function tower(m, cx, cz) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 2.4) continue;
      for (let y = m.ground(cx + dx, cz + dz) + 1; y <= y0 + 9; y++) world.set(cx + dx, y, cz + dz, d > 1.4 || y <= y0 ? B.STONE : B.AIR);
    }
  }
  world.set(cx, y0 + 10, cz, B.LIGHTNING_ROD);
  world.set(cx, y0 + 11, cz, B.LIGHTNING_ROD);
  m.claim(cx + 0.5, cz + 0.5, 4, 3);
}

// ---------------------------------------------------------------- what grows

// Trees by what pick(top, x, z, y, rng) says (a tree's cells, or null),
// kept off the ways and the battles (wildTrees).
function trees(m, tries, apart, pick) {
  wildTrees(m, tries, apart, pick, 3);
}

// Bushes and ferns dotted about where where(x, z, y) says.
function scatter(m, id, count, where = () => true) {
  const { world, rng } = m;
  for (let tries = 0, n = 0; tries < count * 20 && n < count; tries++) {
    const x = rng.int(3, m.S - 4);
    const z = rng.int(3, m.S - 4);
    const y = open(m, x, z);
    if (y < 0 || !where(x, z, y)) continue;
    world.set(x, y + 1, z, id);
    n++;
  }
}

// ---------------------------------------------------------------- Lollipop Bay

// Chapter 1 of the fifth episode: everyone lands on the long beach in the
// south. The crossroads is up past the Sky Lantern; from there a way goes
// east to the shipwreck on the shore of the lagoon (the ambush), west up the
// lighthouse hill (the siege) and north to the hills where Old Snapjaw goes
// round (the hunt). Lollipop trees, palms on the beaches.
export function lollipop(m) {
  const { seed } = m;
  const SEA = m.sea;
  return toonIsland(m, {
    shape: { cx: 128, cz: 122, R: 112, bays: [[236, 116, 36, 0.8], [30, 34, 30, 0.5]] },
    land: { base: 2.5, hills: (x, z) => 2 + fbm(seed + 23, x / 40, z / 40, 4) * 5 + 7 * bump(x, z, 124, 120, 46) + 9 * bump(x, z, 42, 150, 24) },
    landing: [128, 229],
    hub: [120, 216],
    cross: [128, 176],
    sites: [
      { kind: 'ambush', at: [184, 142], via: [[156, 166]] },
      { kind: 'siege', at: [44, 150], via: [[96, 172], [70, 162]] },
      { kind: 'hunt', loop: [[76, 78], [112, 52], [162, 50], [196, 78], [178, 106], [128, 100], [88, 104]], via: [[124, 140]] },
    ],
    build({ m: mk, sites }, specs) {
      const [ambush, siege] = [sites[0], sites[1]];
      wreck(mk, ambush.x + 15, ambush.z - 6, 0.5);
      lighthouse(mk, siege.x - 9, siege.z - 3);
      void specs;
    },
    decor({ m: mk, world }) {
      trees(mk, 2600, 5, (top, x, z, y, rng) => {
        if (top === B.SAND) return rng.chance(0.4) ? wildTree(B.WILD_PALM, 4) : null;
        if (fbm(seed + 53, x / 18, z / 18, 2) < -0.15 && rng.chance(0.8)) return null;
        return rng.chance(0.7) ? wildTree(B.WILD_OAK, 3) : wildTree(B.WILD_BIRCH, 3);
      });
      boulders(mk, 40, (x, z, y) => y > SEA + 2);
      driftwood(mk, 16);
      scatter(mk, B.BUSH, 120);
      mk.flowers(90, { grass: B.TALL_GRASS, extra: B.BUSH, rare: 0.99 });
      mk.animals({ bunny: 6, chick: 4, crab: 3 }, (x, z) => world.get(x, mk.ground(x, z), z) !== B.WATER);
    },
    fruit: B.FRUIT_ITEMS[1],
  });
}

// ---------------------------------------------------------------- Toadstool Woods

// Chapter 2: woods of round trees and giant toadstools, a river running
// north from the middle of the island to the sea. Thumpwood goes round the
// south-west; the Storm Nests are in a glade in the north-west, the Fairy
// Ring in the east, and the woodcutters' beacon on the hill in the
// north-east.
export function toadstool(m) {
  const { seed } = m;
  const SEA = m.sea;
  return toonIsland(m, {
    shape: { cx: 128, cz: 124, R: 110, wobble: [[4, 0.06, 1.1], [7, 0.035, 0.3]] },
    land: { base: 3, hills: (x, z) => 3 + fbm(seed + 31, x / 36, z / 36, 4) * 8 + 9 * bump(x, z, 182, 62, 30) },
    water(mk) {
      mk.river([[126, 112], [118, 86], [126, 58], [116, 30], [118, -4]], { width: 4, top: SEA, depth: 3, bank: 5 });
    },
    landing: [130, 230],
    hub: [122, 217],
    cross: [130, 172],
    sites: [
      { kind: 'hunt', loop: [[44, 160], [66, 134], [98, 140], [106, 172], [94, 204], [62, 206], [40, 188]], via: [[110, 172]] },
      { kind: 'nest', at: [72, 86], via: [[100, 132]], phase: 0.4 },
      { kind: 'ambush', at: [192, 150], via: [[160, 164]] },
      { kind: 'siege', at: [182, 62], via: [[150, 120], [166, 92]] },
    ],
    build({ m: mk, sites }) {
      const ring = sites[2];
      around(mk, ring.x + 0.5, ring.z + 0.5, 13.5, 10, (x, z, y, i) => giantToadstool(mk, x, z, y, 2 + (i % 3)));
    },
    decor({ m: mk }) {
      trees(mk, 3200, 4, (top, x, z, y, rng) => {
        if (top === B.SAND) return rng.chance(0.15) ? wildTree(B.WILD_OAK, 3) : null;
        const n = fbm(seed + 57, x / 22, z / 22, 2);
        if (n < -0.25 && rng.chance(0.7)) return null;
        if (rng.chance(0.3)) return wildTree(B.TOON_SHROOM, rng.int(2, 4));
        return rng.chance(0.6) ? wildTree(B.WILD_OAK, 3) : wildTree(B.WILD_PINE, 4);
      });
      boulders(mk, 30, (x, z, y) => y > SEA + 2);
      scatter(mk, B.BUSH, 160);
      scatter(mk, B.FERN, 140);
      scatter(mk, B.REEDS, 60, (x, z, y) => y <= SEA + 2);
      mk.flowers(90, { grass: B.TALL_GRASS, extra: B.MUSHROOM, rare: 0.985 });
      mk.animals({ bunny: 6, duck: 3, chick: 2 });
    },
    fruit: B.FRUIT_ITEMS[2],
  });
}

// ---------------------------------------------------------------- Rumble Canyon

// Chapter 3: mesas in steps of striped rock, canyons between them. The way
// climbs from the beach up through the canyons; the Mesa Beacon is on top of
// the biggest mesa in the middle, Rumbletooth goes round the canyons in the
// south-east, the Fossil Pit is in the west and the Thunder Nests up in the
// north-east.
export function rumble(m) {
  const { seed } = m;
  const SEA = m.sea;
  const shape = outline(m, { cx: 128, cz: 124, R: 112, wobble: [[3, 0.08, 2.2], [6, 0.04, 0.9]] });
  // Each mesa a whole number of steps up, a step seven blocks: a canyon at
  // the bottom, the biggest mesa in the middle, low by the sea.
  const step = (x, z) => {
    const e = shape(x, z);
    const n = 0.5 + 0.5 * fbm(seed + 41, x / 38, z / 38, 3) + 0.4 * bump(x, z, 128, 96, 44) - 0.25;
    const level = Math.max(0, Math.min(3, Math.floor(n * 4 * smooth((e - 0.05) / 0.3))));
    return level * 7;
  };
  return toonIsland(m, {
    shape: { cx: 128, cz: 124, R: 112, wobble: [[3, 0.08, 2.2], [6, 0.04, 0.9]] },
    land: { base: 3, hills: (x, z) => step(x, z) + fbm(seed + 43, x / 14, z / 14, 2) * 0.6 },
    landing: [128, 231],
    hub: [120, 218],
    cross: [128, 182],
    sites: [
      { kind: 'hunt', loop: [[150, 152], [188, 142], [212, 166], [200, 198], [164, 206], [146, 184]], via: [[140, 170]] },
      { kind: 'siege', at: [128, 92], via: [[112, 160], [104, 128], [118, 110]] },
      { kind: 'ambush', at: [62, 166], via: [[96, 186]] },
      { kind: 'nest', at: [196, 72], via: [[160, 140], [176, 104]], phase: 1.2, nests: 4 },
    ],
    build({ m: mk, sites }) {
      const pit = sites[2];
      for (let i = 0; i < 5; i++) bone(mk, pit.x - 6 + i * 3, pit.z - 15, Math.PI / 2, 5, 3 + (i % 2));
      bone(mk, pit.x + 15, pit.z - 2, 0.3, 8, 5);
    },
    decor({ m: mk, world }) {
      trees(mk, 1800, 6, (top, x, z, y, rng) => {
        if (rng.chance(0.55)) return null;
        if (top === B.SAND && rng.chance(0.75)) return wildTree(B.TOON_CACTUS, rng.int(2, 4));
        return rng.chance(0.5) ? wildTree(B.WILD_SNAG, 3) : null;
      });
      boulders(mk, 90, (x, z, y) => y > SEA + 1, 0.45);
      scatter(mk, B.BUSH, 50, (x, z, y) => world.get(x, y, z) !== B.STONE);
      mk.flowers(40, { grass: 0, extra: B.BUSH, rare: 0.995 });
      mk.animals({ bunny: 4 });
    },
    fruit: B.FRUIT_ITEMS[3],
  });
}

// ---------------------------------------------------------------- Snowball Peaks

// Chapter 4: meadows in the south, the mountains of Snowball Peaks in the
// middle and north, their tops deep in snow. The Summit Beacon is up on the
// highest top, the Ice Cave in a valley in the west, the Blizzard Nests on a
// shelf in the east, and Big Blink goes round the valleys in the south-east.
export function snowball(m) {
  const { seed } = m;
  const SEA = m.sea;
  return toonIsland(m, {
    shape: { cx: 128, cz: 126, R: 110, wobble: [[3, 0.06, 0.9], [5, 0.05, 2.6]] },
    land: {
      base: 2.5,
      hills: (x, z) => {
        const peak = bump(x, z, 128, 88, 80);
        return 1.5 + fbm(seed + 51, x / 30, z / 30, 4) * (3 + 4 * peak) + 27 * peak ** 1.25 + 6 * bump(x, z, 70, 60, 26) + 5 * bump(x, z, 190, 60, 24);
      },
    },
    landing: [128, 230],
    hub: [120, 217],
    cross: [128, 184],
    sites: [
      { kind: 'hunt', loop: [[150, 170], [186, 152], [212, 176], [198, 206], [162, 208], [140, 192]], via: [[136, 180]] },
      { kind: 'ambush', at: [56, 116], via: [[96, 176], [70, 150]] },
      { kind: 'nest', at: [196, 104], via: [[166, 160], [190, 136]], phase: 0.2, nests: 4 },
      { kind: 'siege', at: [128, 74], via: [[112, 160], [96, 128], [104, 98], [124, 100]] },
    ],
    build({ m: mk, sites }) {
      const cave = sites[1];
      around(mk, cave.x + 0.5, cave.z + 0.5, 13.5, 14, (x, z, y, i) => icicle(mk, x, z, y, 4 + (i % 4)));
    },
    decor({ m: mk, world }) {
      trees(mk, 2400, 5, (top, x, z, y, rng) => {
        if (top === B.SAND || rng.chance(0.3)) return null;
        if (y > SEA + 24) return null;
        return y > SEA + 8 || rng.chance(0.6) ? wildTree(B.WILD_PINE, rng.int(4, 5)) : wildTree(B.WILD_BIRCH, 3);
      });
      boulders(mk, 60, (x, z, y) => y > SEA + 2);
      scatter(mk, B.BUSH, 60, (x, z, y) => world.get(x, y, z) === B.GRASS);
      mk.flowers(50, { grass: B.TALL_GRASS, extra: B.BUSH, rare: 0.995 });
      mk.animals({ sheep: 4, bunny: 3, penguin: 3 });
    },
    fruit: B.FRUIT_ITEMS[4],
  });
}

// ---------------------------------------------------------------- Thunder Top

// Chapter 5, the last: a dark stormy island round a great hill, Thunder Top,
// with Baron Bluster's arena on its very top. The way winds up round it
// from the crossroads; Gusto goes round the hill's foot, the Lightning Tower
// stands in the north-west, the Storm Circle in the east and the
// Thundercloud Nests in the north-east.
export function thunder(m) {
  const { seed } = m;
  const SEA = m.sea;
  return toonIsland(m, {
    shape: { cx: 128, cz: 124, R: 112, wobble: [[4, 0.07, 0.2], [6, 0.04, 1.4]] },
    land: { base: 3, hills: (x, z) => 2 + fbm(seed + 61, x / 30, z / 30, 4) * 6 + 24 * smooth(bump(x, z, 128, 104, 56) * 1.25) },
    landing: [128, 232],
    hub: [120, 219],
    cross: [128, 190],
    sites: [
      { kind: 'hunt', loop: [[62, 150], [56, 104], [86, 62], [128, 46], [172, 62], [200, 102], [196, 150], [162, 176], [94, 178]], via: [[110, 186]] },
      { kind: 'siege', at: [42, 72], via: [[86, 186], [52, 140]] },
      { kind: 'ambush', at: [212, 148], via: [[172, 184]] },
      { kind: 'nest', at: [194, 66], via: [[204, 168], [214, 112]], phase: 0.9, nests: 4 },
      { kind: 'showdown', at: [128, 104], via: [[168, 166], [182, 126], [164, 86], [124, 76], [96, 92]], phase: 0.5 },
    ],
    build({ m: mk, sites }) {
      const circle = sites[2];
      around(mk, circle.x + 0.5, circle.z + 0.5, 13.5, 9, (x, z, y, i) => standingStone(mk, x, z, y, 3 + (i % 2)));
      const siege = sites[1];
      tower(mk, siege.x - 7, siege.z - 5);
    },
    decor({ m: mk }) {
      trees(mk, 2000, 5, (top, x, z, y, rng) => {
        if (top === B.SAND || rng.chance(0.35)) return null;
        return rng.chance(0.55) ? wildTree(B.WILD_SNAG, 3) : rng.chance(0.6) ? wildTree(B.WILD_PINE, 4) : wildTree(B.WILD_OAK, 3);
      });
      boulders(mk, 80, (x, z, y) => y > SEA + 2, 0.4);
      scatter(mk, B.BUSH, 60);
      mk.flowers(50, { grass: B.TALL_GRASS, extra: B.MUSHROOM, rare: 0.99 });
      mk.animals({ bunny: 3 });
    },
    fruit: B.FRUIT_ITEMS[0],
  });
}

export const TOON_MAPS = { lollipop, toadstool, rumble, snowball, thunder };

// ---------------------------------------------------------------- journeys

// A chapter's battles, hub and ways turned over with its map (isle-maps.js
// mirror): mirrored side to side (along x) and/or top to bottom (along z).
export function mirrorBattles(made, W, D, alongX, alongZ) {
  const px = (x) => (alongX ? W - x : x);
  const pz = (z) => (alongZ ? D - z : z);
  const cell = (c) => {
    if (alongX) c[0] = W - 1 - c[0];
    if (alongZ) c[2] = D - 1 - c[2];
  };
  for (const b of made.battles ?? []) {
    b.x = px(b.x);
    b.z = pz(b.z);
    for (const c of [b.prize, b.beacon, ...(b.spots ?? []), ...(b.rods ?? [])]) if (c) cell(c);
    if (b.range) b.range = b.range.map(([x, z]) => [px(x), pz(z)]);
  }
  if (made.hub) {
    cell(made.hub.lantern);
    for (const c of made.hub.lamps) cell(c);
  }
  if (made.roads) made.roads = made.roads.map((road) => road.map(([x, z]) => [px(x), pz(z)]));
}
