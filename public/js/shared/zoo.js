// A zoo island's zoo, in the middle of the island (worldgen.js makes the
// ground there flat for it, as for a fun park's plaza, only bigger:
// ZOO_HALF), laid out the way a real zoo is:
//
// - at the front, an entrance plaza: a gate with ZOO in big letters over
//   it, ticket booths either side, a café with tables out under sunshades
//   and a gift shop;
// - an avenue from the gate to a loop of path all round the zoo, with
//   flower beds, shade trees, lamp posts and a signpost at every exhibit;
// - exhibits all round the loop, each its own habitat, walled in rockwork
//   (the back and the sides) and big glass windows along the path, too high
//   for the animals to get out:
//   - the African savanna: giraffes, zebras and a rhino on dry grass, round
//     a water hole under flat-topped acacia trees, a rocky kopje;
//   - the lions on their pride rock;
//   - the elephants, with their elephant house and a bathing pool;
//   - the tigers in a jungle with a pool and a fallen log;
//   - the giant pandas in a bamboo grove with a pagoda;
//   - the polar bear on the ice with its own pool, and beside it the
//     penguins and seals round a pool with a window under the water, the
//     path dipping down to it;
//   - the hippos in their river, with a window under the water too;
//   - a petting farm with a red barn, walled in a wooden fence with a gate;
//   - the kangaroos' walkabout in the outback;
// - in the middle, inside the loop: monkey island, on an island in a moat
//   (monkeys do not swim) with a tree and a climbing frame; and the
//   flamingos on a sandy spit in a lagoon, wading into its shallow edge;
// - a tall hedge all round, but for the gate.
//
// Everything is laid out from the middle (cx, cz): x across, z towards the
// gate, as `o` offsets.
import * as B from './blocks.js';
import { hash2, Rng } from './rng.js';
import { oakTree, placeTemplate, stampByKey } from './stamps.js';

const [RED, ORANGE, YELLOW, LIME, GREEN, , SKY, BLUE, , , PINK, WHITE, GRAY, CHARCOAL, BROWN, TAN] = B.TOY_BRICKS;

// How far the zoo reaches from its middle, each way (it is a square), and
// how far past that the land eases back into the island's own.
export const ZOO_HALF = 34;
export const ZOO_BLEND = 7;
// How high an exhibit's walls are over its ground: too high for any animal.
export const WALL = 3;
export const MOAT = 4;

// The loop of path round the zoo: a rounded square, `round` far from the
// middle (round: as far as a square with its corners rounded off).
const round = (ox, oz) => (Math.abs(ox) ** 3 + Math.abs(oz) ** 3) ** (1 / 3);
const LOOP = [14.5, 17.5];
// Past the loop's flower beds, the exhibits.
const OUTER = 20;

// The exhibits round the loop: where each is (first match wins, past
// OUTER), its walls (rock, or a wooden fence for the farm and the
// walkabout, two high), and its colour for its signpost. Along the path,
// a big animal's exhibit is open, the way a real zoo's is: a low rail, and
// past it a moat (MOAT deep, a little water at the bottom) that no animal
// goes down into nor could climb out of; the penguins' and the hippos'
// have glass, down under the water.
export const EXHIBITS = [
  { key: 'farm', name: 'Petting Farm', x0: -33, x1: -24, z0: 17, z1: 33, fence: true, sign: RED },
  { key: 'walkabout', name: 'Kangaroo Walkabout', x0: 24, x1: 33, z0: 17, z1: 33, fence: true, sign: ORANGE },
  { key: 'panda', name: 'Panda Grove', x0: -33, x1: -19, z0: 0, z1: 16, sign: GREEN, moat: true },
  { key: 'hippo', name: 'Hippo River', x0: 19, x1: 33, z0: 0, z1: 16, sign: BLUE, window: true },
  { key: 'tiger', name: 'Tiger Jungle', x0: -33, x1: -19, z0: -18, z1: -1, sign: ORANGE, moat: true },
  { key: 'bear', name: 'Polar Bear', x0: 19, x1: 33, z0: -18, z1: -10, sign: WHITE, moat: true },
  { key: 'penguin', name: 'Penguin Bay', x0: 19, x1: 33, z0: -9, z1: -1, sign: SKY, window: true },
  { key: 'savanna', name: 'African Savanna', x0: -33, x1: -6, z0: -33, z1: -19, sign: YELLOW, moat: true },
  { key: 'lion', name: 'Lion Rock', x0: -5, x1: 6, z0: -33, z1: -19, sign: TAN, moat: true },
  { key: 'elephant', name: 'Elephant House', x0: 7, x1: 33, z0: -33, z1: -19, sign: GRAY, moat: true },
];
const byKey = Object.fromEntries(EXHIBITS.map((e) => [e.key, e]));

// Monkey island and the flamingo lagoon, in the middle: each a ring of
// deep water round dry land.
export const MONKEYS = { x: 0, z: -3, land: 5, moat: 8 };
// The lagoon: a spit of sand (x0..x1 by z0..z1), a ring of shallow water
// a step wide round it, and deep water two wide round that.
export const LAGOON = { x0: -3, x1: 3, z0: 10, z1: 11 };
// How far the cell at (ox, oz) is from the lagoon's spit.
const fromSpit = (ox, oz) => Math.hypot(Math.max(LAGOON.x0 - ox, ox - LAGOON.x1, 0), Math.max(LAGOON.z0 - oz, oz - LAGOON.z1, 0));

// The animals, in the exhibit each lives in, and roughly where in it.
export const ZOO_ANIMALS = [
  ['giraffe', 'savanna', -26, -27],
  ['giraffe', 'savanna', -16, -29],
  ['zebra', 'savanna', -11, -24],
  ['zebra', 'savanna', -13, -26],
  ['zebra', 'savanna', -28, -23],
  ['rhino', 'savanna', -21, -30],
  ['lion', 'lion', -3, -24],
  ['lion', 'lion', 4, -23],
  ['lion', 'lion', 3, -31],
  ['elephant', 'elephant', 13, -27],
  ['elephant', 'elephant', 20, -25],
  ['tiger', 'tiger', -27, -14],
  ['tiger', 'tiger', -24, -5],
  ['panda', 'panda', -27, 5],
  ['panda', 'panda', -23, 12],
  ['polarbear', 'bear', 28, -15],
  ['penguin', 'penguin', 28, -7],
  ['penguin', 'penguin', 29, -4],
  ['penguin', 'penguin', 30, -6],
  ['penguin', 'penguin', 31, -3],
  ['penguin', 'penguin', 27, -3],
  ['seal', 'penguin', 26, -7],
  ['hippo', 'hippo', 28, 5],
  ['hippo', 'hippo', 29, 12],
  ['sheep', 'farm', -30, 20],
  ['sheep', 'farm', -27, 22],
  ['bunny', 'farm', -26, 25],
  ['bunny', 'farm', -29, 26],
  ['chick', 'farm', -26, 21],
  ['chick', 'farm', -27, 20],
  ['duck', 'farm', -31, 30],
  ['cow', 'farm', -27, 30],
  ['kangaroo', 'walkabout', 27, 21],
  ['kangaroo', 'walkabout', 30, 24],
  ['kangaroo', 'walkabout', 27, 28],
  ['monkey', 'monkeys', -1, -2],
  ['monkey', 'monkeys', 1, -5],
  ['monkey', 'monkeys', 2, -1],
  ['monkey', 'monkeys', -2, -5],
  ['flamingo', 'lagoon', -2, 9],
  ['flamingo', 'lagoon', -1, 10],
  ['flamingo', 'lagoon', 1, 9],
  ['flamingo', 'lagoon', 2, 10],
  ['flamingo', 'lagoon', 0, 9],
];

// What the cell at (ox, oz) from the middle is part of: an exhibit (its
// key), 'monkeys' or 'lagoon' for the islands in the middle, or null for
// everything open to visitors and the gardens.
export function zoneAt(ox, oz) {
  if (Math.max(Math.abs(ox), Math.abs(oz)) > ZOO_HALF - 1) return null;
  if (Math.hypot(ox - MONKEYS.x, oz - MONKEYS.z) < MONKEYS.moat) return 'monkeys';
  if (fromSpit(ox, oz) <= 3.5) return 'lagoon';
  if (round(ox, oz) < OUTER) return null;
  return EXHIBITS.find((e) => ox >= e.x0 && ox <= e.x1 && oz >= e.z0 && oz <= e.z1)?.key ?? null;
}

// The island's zoo, if it has one: where its middle is, and its ground.
export function zooAt(world) {
  if (world?.theme !== 'zoo') return null;
  return { cx: Math.floor(world.W / 2), cz: Math.floor(world.D / 2), y: world.sea + 5, half: ZOO_HALF };
}

// The zoo, built into the world round (cx, cz) with the ground at height
// level. Returns { spawn, rides (the zoo's animals, each in its exhibit),
// clear (what vehicles keep clear of, as { x, z, r }), walls (Map of 'ox,oz'
// to { key, front } for every exhibit's wall) }.
export function buildZoo(world, { cx, cz, level, pal, seed = 1 }) {
  const H = ZOO_HALF;
  const set = (ox, y, oz, id) => world.set(cx + ox, y, cz + oz, id);
  const get = (ox, y, oz) => world.get(cx + ox, y, cz + oz);
  const place = (cells) => {
    for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z)) world.set(x, y, z, id);
  };
  const noise = (ox, oz, k = 0) => hash2(seed + k * 7919, ox, oz);
  const tree = (ox, oz, big = false) => place(placeTemplate(oakTree(new Rng(hash2(seed, ox, oz)), big), cx + ox, level + 1, cz + oz, 0));

  // ---------------------------------------------------------------- zones
  const N = 2 * H + 1;
  const zone = new Array(N * N);
  const at = (ox, oz) => (ox + H) * N + (oz + H);
  const inside = (ox, oz) => Math.abs(ox) <= H && Math.abs(oz) <= H;
  for (let ox = -H; ox <= H; ox++) for (let oz = -H; oz <= H; oz++) zone[at(ox, oz)] = zoneAt(ox, oz);
  const zoneOf = (ox, oz) => (inside(ox, oz) ? zone[at(ox, oz)] : null);
  // An exhibit's walls: every cell of it beside one that is not (corners
  // too); those beside a path or garden are its windows (front), the rest
  // rock.
  const walls = new Map();
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      const k = zoneOf(ox, oz);
      if (!k || !byKey[k]) continue;
      let edge = false;
      let front = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const o = zoneOf(ox + dx, oz + dz);
          if (o === k) continue;
          edge = true;
          if (!o && Math.max(Math.abs(ox + dx), Math.abs(oz + dz)) < H - 1 && (dx === 0 || dz === 0)) front = true;
        }
      }
      if (edge) walls.set(`${ox},${oz}`, { key: k, front });
    }
  }
  // How far each exhibit's cells are from its walls (in steps), so nothing
  // anyone could climb stands near enough to them to get over.
  const clear = new Map();
  let ring = [...walls.keys()];
  for (const w of ring) clear.set(w, 0);
  for (let d = 1; ring.length; d++) {
    const next = [];
    for (const w of ring) {
      const [ox, oz] = w.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const n = `${ox + dx},${oz + dz}`;
        if (clear.has(n) || !byKey[zoneOf(ox + dx, oz + dz)]) continue;
        clear.set(n, d);
        next.push(n);
      }
    }
    ring = next;
  }
  const roomy = (ox, oz, d = 3) => (clear.get(`${ox},${oz}`) ?? 0) >= d;
  // How far each cell of an open exhibit is from its rail, for its moat.
  const fromRail = new Map();
  ring = [];
  for (const [w, { key, front }] of walls) {
    if (!front || !byKey[key].moat) continue;
    fromRail.set(w, 0);
    ring.push(w);
  }
  for (let d = 1; d <= 6 && ring.length; d++) {
    const next = [];
    for (const w of ring) {
      const [ox, oz] = w.split(',').map(Number);
      const k = zoneOf(ox, oz);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const n = `${ox + dx},${oz + dz}`;
        if (fromRail.has(n) || walls.has(n) || zoneOf(ox + dx, oz + dz) !== k) continue;
        fromRail.set(n, d);
        next.push(n);
      }
    }
    ring = next;
  }
  const nearMoat = (ox, oz, d) => (fromRail.get(`${ox},${oz}`) ?? 99) <= d;

  // ---------------------------------------------------------------- ground
  // Paths of grey pavers, the plaza in a pattern of tan and white, and each
  // exhibit's own ground; nothing standing on any of it to begin with.
  const GROUND = {
    savanna: (ox, oz) => (noise(ox, oz) < 0.4 ? B.SAND : pal.top),
    lion: (ox, oz) => (noise(ox, oz) < 0.6 ? B.SAND : pal.top),
    elephant: (ox, oz) => (noise(ox, oz) < 0.5 ? B.DIRT : B.SAND),
    tiger: () => pal.top,
    panda: () => pal.top,
    bear: (ox, oz) => (noise(ox, oz) < 0.2 ? B.ICE : B.SNOW),
    penguin: (ox, oz) => (noise(ox, oz) < 0.5 ? B.PEBBLES : B.SNOW),
    hippo: (ox, oz) => (noise(ox, oz) < 0.6 ? B.DIRT : pal.top),
    farm: () => pal.top,
    walkabout: (ox, oz) => (noise(ox, oz) < 0.55 ? B.SAND : B.DIRT),
    monkeys: () => pal.top,
    lagoon: () => B.SAND,
  };
  const plaza = (ox, oz) => oz >= 22 && Math.abs(ox) <= 23;
  const avenue = (ox, oz) => Math.abs(ox) <= 2 && oz >= LOOP[0];
  const onLoop = (ox, oz) => round(ox, oz) >= LOOP[0] && round(ox, oz) < LOOP[1];
  const isPath = (ox, oz) => !zoneOf(ox, oz) && (onLoop(ox, oz) || avenue(ox, oz) || plaza(ox, oz));
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      for (let y = level + 1; y < world.H; y++) set(ox, y, oz, B.AIR);
      for (let y = level - 4; y < level; y++) set(ox, y, oz, y < level - 2 ? B.STONE : B.DIRT);
      const k = zoneOf(ox, oz);
      let id = pal.top;
      if (k) id = GROUND[k](ox, oz);
      else if (plaza(ox, oz) && !avenue(ox, oz)) id = (ox + oz) % 6 === 0 || (ox - oz) % 6 === 0 ? WHITE : TAN;
      else if (isPath(ox, oz)) id = B.PEBBLES;
      set(ox, level, oz, id);
    }
  }

  // ---------------------------------------------------------------- walls
  for (const [w, { key, front }] of walls) {
    const [ox, oz] = w.split(',').map(Number);
    const ex = byKey[key];
    set(ox, level, oz, B.STONE);
    if (ex.fence) {
      // A wooden fence on a plank kerb, two high: no farm animal nor
      // kangaroo gets over it, and anyone can see in over it.
      set(ox, level + 1, oz, B.PLANKS);
      set(ox, level + 2, oz, B.FENCE);
      continue;
    }
    if (front && ex.moat) {
      // A rail to lean on, over the moat.
      set(ox, level + 1, oz, B.FENCE);
      continue;
    }
    if (front) {
      // A window (WALL - 1 high: high enough for a penguin, a seal and a
      // hippo): a low wall of rock and glass over it.
      set(ox, level + 1, oz, B.STONE);
      for (let y = level + 2; y <= level + WALL - 1; y++) set(ox, y, oz, (ox * 3 + oz * 5) % 6 ? B.GLASS : B.STONE);
      continue;
    }
    // Rockwork, rough along the top: a little higher here and there, with
    // pebbles and moss.
    const h = WALL + (noise(ox, oz, 1) < 0.3 ? 1 : 0);
    for (let y = level + 1; y <= level + h; y++) set(ox, y, oz, noise(ox, y, 2) < 0.2 ? B.PEBBLES : B.STONE);
    if (noise(ox, oz, 4) < 0.25) set(ox, level + h + 1, oz, B.LEAVES);
  }
  // The moats: two wide behind the rail, down MOAT, with water at the
  // bottom.
  for (const [w, d] of fromRail) {
    if (d < 1 || d > 2) continue;
    const [ox, oz] = w.split(',').map(Number);
    for (let y = level - MOAT + 2; y <= level; y++) set(ox, y, oz, B.AIR);
    set(ox, level - MOAT + 1, oz, B.WATER);
    set(ox, level - MOAT, oz, B.DIRT);
  }
  // The farm's gate, on the plaza side.
  set(-24, level + 1, 26, B.turnedTo(B.DOORS[0], 0));
  set(-24, level + 2, 26, B.turnedTo(B.DOORS[0], 0));

  // ---------------------------------------------------------------- helpers
  // A pool dug into an exhibit's ground: water `deep` blocks deep over a
  // floor of `floor`, wherever `inPool` holds.
  const pool = (key, x0, x1, z0, z1, inPool, deep = 2, floor = B.SAND) => {
    for (let ox = x0; ox <= x1; ox++) {
      for (let oz = z0; oz <= z1; oz++) {
        if (zoneOf(ox, oz) !== key || !inPool(ox, oz) || walls.has(`${ox},${oz}`) || nearMoat(ox, oz, 4)) continue;
        for (let y = level - deep + 1; y <= level; y++) set(ox, y, oz, B.WATER);
        set(ox, level - deep, oz, floor);
      }
    }
  };
  // A window under the water: the exhibit's front wall glass down to the
  // floor of its pool where the pool comes up to it, and the path dipping
  // down two steps beside it, for a look in under the water.
  const underwater = (key) => {
    for (const [w, { key: k, front }] of walls) {
      if (k !== key || !front) continue;
      const [ox, oz] = w.split(',').map(Number);
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => get(ox + dx, level - 1, oz + dz) === B.WATER);
      if (!wet) continue;
      for (let y = level - 1; y <= level + WALL - 1; y++) set(ox, y, oz, B.GLASS);
      set(ox, level - 2, oz, B.STONE);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (zoneOf(ox + dx, oz + dz) || onLoop(ox + dx, oz + dz)) continue;
        // Two steps down: the one by the glass deeper.
        set(ox + dx, level, oz + dz, B.AIR);
        set(ox + dx, level - 1, oz + dz, B.AIR);
        set(ox + dx, level - 2, oz + dz, B.PEBBLES);
        const ox2 = ox + dx * 2;
        const oz2 = oz + dz * 2;
        if (!zoneOf(ox2, oz2) && get(ox2, level - 1, oz2) !== B.AIR) {
          set(ox2, level, oz2, B.AIR);
          set(ox2, level - 1, oz2, B.PEBBLES);
        }
      }
    }
  };
  // Rocks piled up in steps (a kopje, a pride rock), only where they leave
  // the walls well out of reach.
  const rocks = (x, z, r, h, top = B.STONE) => {
    for (let ox = Math.floor(x - r); ox <= Math.ceil(x + r); ox++) {
      for (let oz = Math.floor(z - r); oz <= Math.ceil(z + r); oz++) {
        const d = Math.hypot(ox - x, oz - z) / r;
        if (d > 1 || !roomy(ox, oz, 2 + Math.ceil(h * (1 - d))) || nearMoat(ox, oz, 3 + Math.ceil(h * (1 - d)))) continue;
        const k = Math.max(1, Math.round(h * (1 - d) + noise(ox, oz, 6) * 0.6));
        for (let y = level + 1; y <= level + k; y++) set(ox, y, oz, y === level + k ? top : B.STONE);
      }
    }
  };
  const plants = (key, ids, chance) => {
    for (const [w, d] of clear) {
      if (d < 1) continue;
      const [ox, oz] = w.split(',').map(Number);
      if (zoneOf(ox, oz) !== key || get(ox, level + 1, oz) !== B.AIR || get(ox, level, oz) === B.WATER || !B.SOLID[get(ox, level, oz)]) continue;
      if (noise(ox, oz, 9) < chance) set(ox, level + 1, oz, ids[Math.floor(noise(ox, oz, 10) * ids.length)]);
    }
  };
  // A flat-topped acacia: a bare trunk leaning up to a wide flat crown.
  const acacia = (x, z) => {
    if (!roomy(x, z, 3) || nearMoat(x, z, 3)) return;
    for (let y = level + 1; y <= level + 5; y++) set(x + (y > level + 3 ? 1 : 0), y, z, B.WOOD);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) < 5) set(x + 1 + dx, level + 6, z + dz, B.LEAVES);
  };
  // A clump of bamboo: green canes of different heights.
  const bamboo = (x, z) => {
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 1], [1, -1]]) {
      if (!roomy(x + dx, z + dz, 2) || nearMoat(x + dx, z + dz, 3)) continue;
      const h = 4 + Math.floor(noise(x + dx, z + dz, 7) * 3);
      for (let y = level + 1; y <= level + h; y++) set(x + dx, y, z + dz, y % 2 ? GREEN : LIME);
      set(x + dx, level + h + 1, z + dz, B.LEAVES);
    }
  };
  // A little building: walls of `wall`, a door gap on one side (side:
  // 'n' | 's' | 'e' | 'w', `door` wide and `doorH` high), windows round
  // it, and a flat roof with a striped edge.
  const building = (x0, x1, z0, z1, h, { wall, roof, side, door = 1, doorH = 2, windows = true, stripe = null, floor = B.PARQUET }) => {
    const mx = Math.round((x0 + x1) / 2);
    const mz = Math.round((z0 + z1) / 2);
    for (let ox = x0; ox <= x1; ox++) {
      for (let oz = z0; oz <= z1; oz++) {
        const rim = ox === x0 || ox === x1 || oz === z0 || oz === z1;
        set(ox, level, oz, floor);
        for (let y = level + 1; y <= level + h; y++) {
          if (!rim) {
            set(ox, y, oz, B.AIR);
            continue;
          }
          const doorway =
            y <= level + doorH &&
            ((side === 's' && oz === z1 && Math.abs(ox - mx) < (door + 1) / 2) ||
              (side === 'n' && oz === z0 && Math.abs(ox - mx) < (door + 1) / 2) ||
              (side === 'e' && ox === x1 && Math.abs(oz - mz) < (door + 1) / 2) ||
              (side === 'w' && ox === x0 && Math.abs(oz - mz) < (door + 1) / 2));
          const corner = (ox === x0 || ox === x1) && (oz === z0 || oz === z1);
          const glass = windows && !corner && y === level + 2 && (ox + oz) % 2 === 0;
          set(ox, y, oz, doorway ? B.AIR : glass ? B.GLASS : wall);
        }
        set(ox, level + h + 1, oz, stripe && rim ? ((ox + oz) % 2 ? stripe : WHITE) : roof);
      }
    }
  };
  // A signpost: a post with a board in the exhibit's colour on top.
  const signpost = (ox, oz, color) => {
    set(ox, level + 1, oz, BROWN);
    set(ox, level + 2, oz, BROWN);
    set(ox, level + 3, oz, color);
    set(ox + 1, level + 3, oz, color);
  };

  // ---------------------------------------------------------------- exhibits
  // The savanna: a water hole, acacias, a rocky kopje, long grass.
  pool('savanna', -24, -16, -29, -24, (ox, oz) => ((ox + 20) / 4) ** 2 + ((oz + 26.5) / 2.3) ** 2 < 1);
  for (const [x, z] of [[-30, -29], [-12, -30], [-19, -22], [-8, -24]]) acacia(x, z);
  rocks(-29, -22, 2.2, 2);
  plants('savanna', [B.TALL_GRASS, B.TALL_GRASS, B.TALL_GRASS, B.DAISY], 0.18);
  // Lion rock: a pride rock of stone steps to a high ledge, a log to lie on.
  rocks(0.5, -28, 3.6, 4, B.SAND);
  for (let ox = -2; ox <= 1; ox++) if (roomy(ox, -24, 2) && !nearMoat(ox, -24, 3)) set(ox, level + 1, -24, B.WOOD);
  plants('lion', [B.TALL_GRASS], 0.15);
  // The elephants: their house at the back, a bathing pool, logs and hay.
  building(23, 32, -32, -26, 6, { wall: TAN, roof: BROWN, side: 's', door: 4, doorH: 4, windows: false, floor: B.HAY });
  pool('elephant', 10, 18, -32, -24, (ox, oz) => ((ox - 14) / 4) ** 2 + ((oz + 28.5) / 2.6) ** 2 < 1, 2, B.DIRT);
  for (const [x, z] of [[21, -24], [22, -24]]) if (roomy(x, z, 2) && !nearMoat(x, z, 3)) set(x, level + 1, z, B.HAY);
  if (roomy(30, -22, 4)) tree(30, -22, true);
  // The tigers: a jungle of trees and long grass round a pool and a log.
  pool('tiger', -30, -24, -16, -11, (ox, oz) => ((ox + 27) / 3) ** 2 + ((oz + 13.5) / 2.2) ** 2 < 1);
  for (const [x, z] of [[-29, -4], [-23, -15], [-30, -8]]) if (roomy(x, z, 3)) tree(x, z);
  for (let oz = -9; oz <= -6; oz++) if (roomy(-26, oz, 2) && !nearMoat(-26, oz, 3)) set(-26, level + 1, oz, B.WOOD);
  plants('tiger', [B.TALL_GRASS, B.TALL_GRASS, B.BLUEBELL], 0.3);
  // The pandas: bamboo all over, and a pagoda to shelter under.
  for (const [x, z] of [[-30, 3], [-29, 13], [-23, 3], [-30, 8], [-24, 14]]) bamboo(x, z);
  for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) for (let y = level + 1; y <= level + 3; y++) set(-28 + dx, y, 6 + dz, RED);
  for (let dx = -1; dx <= 4; dx++) for (let dz = -1; dz <= 4; dz++) set(-28 + dx, level + 4, 6 + dz, RED);
  for (let dx = 0; dx <= 3; dx++) for (let dz = 0; dz <= 3; dz++) set(-28 + dx, level + 5, 6 + dz, GREEN);
  set(-27, level + 6, 7, YELLOW);
  set(-26, level + 6, 8, YELLOW);
  // The polar bear: ice and snow, rocks, and a deep cold pool.
  pool('bear', 22, 27, -17, -11, (ox, oz) => ((ox - 24.5) / 3) ** 2 + ((oz + 14) / 3) ** 2 < 1, 3, B.ICE);
  rocks(30, -16, 1.8, 2, B.SNOW);
  // The penguins and seals: a pool along the front with floes, a window
  // under it, pebbly beach behind.
  pool('penguin', 20, 25, -8, -2, () => true, 3, B.ICE);
  set(23, level, -5, B.ICE);
  underwater('penguin');
  rocks(30, -6, 1.4, 1, B.SNOW);
  // The hippos: a long river along the front, a window under it, reeds.
  pool('hippo', 20, 26, 1, 15, (ox, oz) => ox <= 24 + Math.round(Math.sin(oz * 0.6)), 3, B.DIRT);
  underwater('hippo');
  plants('hippo', [B.TALL_GRASS, B.TALL_GRASS, B.TULIP], 0.25);
  if (roomy(30, 14, 3)) tree(30, 14);
  // The farm: a red barn, a duck pond, hay.
  building(-33, -28, 29, 33, 4, { wall: RED, roof: WHITE, side: 'e', door: 2, doorH: 3, windows: false, floor: B.HAY });
  pool('farm', -32, -29, 23, 26, (ox, oz) => ((ox + 30.5) / 1.8) ** 2 + ((oz + 0 - 24.5) / 1.6) ** 2 < 1, 1, B.DIRT);
  for (const [x, z] of [[-27, 28], [-26, 28], [-27, 27]]) if (roomy(x, z, 2)) set(x, level + 1, z, B.HAY);
  // The walkabout: red sand, gum trees, a rock, and dry grass.
  for (const [x, z] of [[31, 19], [29, 31]]) if (roomy(x, z, 3)) tree(x, z);
  rocks(31, 26, 1.3, 1);
  plants('walkabout', [B.TALL_GRASS], 0.12);

  // ---------------------------------------------------------------- the middle
  // Monkey island: a moat round it, a tree, and a climbing frame of poles
  // and platforms.
  for (let ox = -9; ox <= 9; ox++) {
    for (let oz = -12; oz <= 6; oz++) {
      const d = Math.hypot(ox - MONKEYS.x, oz - MONKEYS.z);
      if (d >= MONKEYS.land && d < MONKEYS.moat) {
        for (let y = level - 1; y <= level; y++) set(ox, y, oz, B.WATER);
        set(ox, level - 2, oz, B.SAND);
      } else if (d >= MONKEYS.moat && d < MONKEYS.moat + 1) {
        set(ox, level, oz, B.PEBBLES);
        if ((Math.round(Math.atan2(oz - MONKEYS.z, ox - MONKEYS.x) * 8) & 1) === 0) set(ox, level + 1, oz, B.FENCE);
      }
    }
  }
  tree(MONKEYS.x - 2, MONKEYS.z + 2, true);
  for (const [dx, dz] of [[1, -2], [3, -2], [1, 0], [3, 0]]) for (let y = level + 1; y <= level + 4; y++) set(dx, y, MONKEYS.z + dz, B.WOOD);
  for (let dx = 1; dx <= 3; dx++) for (let dz = -2; dz <= 0; dz++) if (dx === 2 || dz === -1) set(dx, level + 2, MONKEYS.z + dz, B.PLANKS);
  for (let dx = 1; dx <= 3; dx++) set(dx, level + 4, MONKEYS.z - 1, B.PLANKS);
  // The flamingo lagoon: a sandy spit, a shallow edge round it, deep water
  // round that, and a rail to lean on.
  for (let ox = LAGOON.x0 - 4; ox <= LAGOON.x1 + 4; ox++) {
    for (let oz = LAGOON.z0 - 4; oz <= LAGOON.z1 + 4; oz++) {
      // (The shallow edge is everywhere within a step and a half of the
      // spit, so a step from it is always the spit, more shallows or the
      // deep water.)
      const d = fromSpit(ox, oz);
      if (d > 4.5) continue;
      if (d > 3.5) {
        if (!avenue(ox, oz) && !isPath(ox, oz) && (ox + oz) % 2) set(ox, level + 1, oz, B.FENCE);
        continue;
      }
      if (d === 0) continue;
      set(ox, level, oz, B.WATER);
      if (d <= 1.5) {
        set(ox, level - 1, oz, B.SAND);
      } else {
        set(ox, level - 1, oz, B.WATER);
        set(ox, level - 2, oz, B.SAND);
      }
    }
  }

  // ---------------------------------------------------------------- gardens
  // Flower beds and shade trees along the loop, lamp posts, and a signpost
  // at the front of each exhibit.
  const flowers = [B.TULIP, B.DAISY, B.SUNFLOWER, B.BLUEBELL, B.COSMOS];
  for (let ox = -H + 1; ox < H; ox++) {
    for (let oz = -H + 1; oz < H; oz++) {
      if (zoneOf(ox, oz) || isPath(ox, oz) || get(ox, level, oz) !== pal.top || get(ox, level + 1, oz) !== B.AIR) continue;
      const r = round(ox, oz);
      const bed = (r >= LOOP[1] && r < LOOP[1] + 1.2) || (r < LOOP[0] && r >= LOOP[0] - 1.2);
      if (bed && noise(ox, oz, 12) < 0.55) set(ox, level + 1, oz, flowers[Math.floor(noise(ox, oz, 13) * flowers.length)]);
    }
  }
  const lamp = stampByKey('lamp-post').cells;
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    const ox = Math.round(Math.cos(t) * (LOOP[1] + 0.6));
    const oz = Math.round(Math.sin(t) * (LOOP[1] + 0.6));
    if (!zoneOf(ox, oz) && !isPath(ox, oz) && get(ox, level, oz) === pal.top) place(placeTemplate(lamp, cx + ox, level + 1, cz + oz, 0));
  }
  for (const [x, z] of [[-11, -11], [11, -11], [-11, 3], [11, 3], [-7, 13], [7, 13]]) if (get(x, level + 1, z) !== B.WATER && round(x, z) < LOOP[0] - 2) tree(x, z);
  for (const ex of EXHIBITS) {
    // Its signpost on the garden before the middle of its front.
    let best = null;
    const mx = (ex.x0 + ex.x1) / 2;
    const mz = (ex.z0 + ex.z1) / 2;
    for (let ox = -H + 1; ox < H - 1; ox++) {
      for (let oz = -H + 1; oz < H - 1; oz++) {
        if (zoneOf(ox, oz) || zoneOf(ox + 1, oz) || isPath(ox, oz) || isPath(ox + 1, oz) || plaza(ox, oz)) continue;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0]].some(([dx, dz]) => zoneOf(ox + dx, oz + dz) === ex.key)) continue;
        const d = Math.hypot(ox - mx, oz - mz);
        if (!best || d < best.d) best = { ox, oz, d };
      }
    }
    if (best && get(best.ox, level, best.oz) !== B.AIR) signpost(best.ox, best.oz, ex.sign);
  }

  // ---------------------------------------------------------------- the front
  // The gate: two towers and a sign over the way in, ZOO in big green
  // letters on yellow, a lamp on each tower.
  const GZ = 30;
  for (const side of [-1, 1]) {
    for (let x = 7; x <= 8; x++) for (let z = GZ - 1; z <= GZ + 1; z++) for (let y = level + 1; y <= level + 11; y++) set(side * x, y, z, y > level + 10 ? GREEN : BROWN);
    set(side * 8, level + 12, GZ, B.LAMP);
  }
  for (let x = -6; x <= 6; x++) for (let y = level + 5; y <= level + 10; y++) set(x, y, GZ, YELLOW);
  const LETTERS = {
    Z: ['###', '..#', '.#.', '#..', '###'],
    O: ['###', '#.#', '#.#', '#.#', '###'],
  };
  // (On both sides, the back reading the right way round from inside.)
  ['Z', 'O', 'O'].forEach((ch, i) => {
    LETTERS[ch].forEach((row, r) => {
      for (let c = 0; c < 3; c++) {
        if (row[c] !== '#') continue;
        set(-5 + i * 4 + c, level + 9 - r, GZ + 1, GREEN);
        set(5 - i * 4 - c, level + 9 - r, GZ - 1, GREEN);
      }
    });
  });
  // Ticket booths either side, with a window onto the way in.
  for (const side of [-1, 1]) {
    building(side > 0 ? 10 : -13, side > 0 ? 13 : -10, GZ - 1, GZ + 2, 3, { wall: WHITE, roof: RED, side: side > 0 ? 'e' : 'w', stripe: RED, floor: TAN });
    set(side > 0 ? 10 : -10, level + 2, GZ, B.GLASS);
    set(side > 0 ? 10 : -10, level + 2, GZ + 1, B.GLASS);
    set(side > 0 ? 11 : -11, level + 1, GZ, B.COUNTER);
  }
  // The café: a counter inside, tables out on the plaza under sunshades.
  building(-21, -15, 23, 27, 4, { wall: CHARCOAL, roof: ORANGE, side: 'e', door: 2, stripe: ORANGE });
  for (let oz = 24; oz <= 26; oz++) set(-19, level + 1, oz, B.turnedTo(B.COUNTER, 1));
  set(-20, level + 1, 24, B.FRIDGE);
  for (const [x, z, shade] of [[-12, 24, ORANGE], [-12, 28, YELLOW], [-17, 30, ORANGE]]) {
    set(x, level + 1, z, B.TABLE);
    set(x - 1, level + 1, z, B.turnedTo(B.CHAIR, 1));
    set(x + 1, level + 1, z, B.turnedTo(B.CHAIR, 3));
    for (let y = level + 2; y <= level + 3; y++) set(x, y, z, WHITE);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(x + dx, level + 4, z + dz, (dx + dz) % 2 ? WHITE : shade);
  }
  // The gift shop: shelves of toys and a counter.
  building(15, 21, 23, 27, 4, { wall: BLUE, roof: PINK, side: 'w', door: 2, stripe: PINK });
  for (let ox = 17; ox <= 20; ox++) set(ox, level + 1, 26, B.turnedTo(B.BOOKSHELF, 2));
  set(17, level + 1, 24, B.turnedTo(B.COUNTER, 3));
  set(19, level + 1, 24, B.GASHAPON);
  // Planters and lamps round the plaza.
  for (const [x, z] of [[-4, 25], [4, 25], [-4, 21], [4, 21]]) {
    set(x, level + 1, z, B.POTTED_PLANT);
  }
  for (const [x, z] of [[-9, 33], [9, 33], [-22, 33], [22, 33]]) place(placeTemplate(lamp, cx + x, level + 1, cz + z, 0));

  // ---------------------------------------------------------------- the hedge
  // A hedge all round the zoo, but for the way in.
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== H || (oz === H && Math.abs(ox) <= 6)) continue;
      set(ox, level, oz, pal.top);
      for (let y = level + 1; y <= level + 3; y++) set(ox, y, oz, B.LEAVES);
    }
  }

  // ---------------------------------------------------------------- animals
  // Each animal on the dry ground of its exhibit nearest where it is meant
  // to be, well in from the walls, with room over it, and not on another.
  const taken = new Set();
  const free = (key, ox, oz) => {
    if (zoneOf(ox, oz) !== key || taken.has(`${ox},${oz}`)) return false;
    if (byKey[key] && !roomy(ox, oz, 2)) return false;
    if (!B.SOLID[get(ox, level, oz)] || get(ox, level, oz) === B.ICE) return false;
    for (let y = level + 1; y <= level + 3; y++) if (get(ox, y, oz) !== B.AIR) return false;
    // Two steps from the water, on an island (monkeys, flamingos).
    if (!byKey[key]) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(ox + dx, level, oz + dz) === B.WATER && key === 'monkeys') return false;
    return true;
  };
  const rides = [];
  for (const [type, key, x, z] of ZOO_ANIMALS) {
    let spot = null;
    for (let r = 0; r < 12 && !spot; r++) {
      for (let dx = -r; dx <= r && !spot; dx++) {
        for (let dz = -r; dz <= r && !spot; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) === r && free(key, x + dx, z + dz)) spot = [x + dx, z + dz];
        }
      }
    }
    if (!spot) continue;
    taken.add(`${spot[0]},${spot[1]}`);
    rides.push({ type, x: cx + spot[0] + 0.5, y: level + 1, z: cz + spot[1] + 0.5 });
  }

  // Everyone comes in outside the gate, looking in at it (a camera yaw of 0
  // looks towards -z).
  const spawn = { x: cx + 0.5, y: level + 1, z: cz + H - 1.5, yaw: 0 };
  // (The whole square, as rings that hug it, so the island round it keeps
  // room for its own vehicles.)
  const clearOf = [];
  for (let ox = -30; ox <= 30; ox += 12) for (let oz = -30; oz <= 30; oz += 12) clearOf.push({ x: cx + ox + 0.5, z: cz + oz + 0.5, r: 9.5 });
  return { spawn, rides, clear: clearOf, walls };
}
