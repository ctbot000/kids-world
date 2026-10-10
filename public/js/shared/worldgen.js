// Makes a new island from a seed: hills and a mountain, beaches, a pond,
// trees (some of them fruit trees of the island's own fruit), flowers,
// seashells, jewels in the rock and a mine into each mountain, animal
// friends, and a spot for everyone to arrive at; on an adventure island, the
// grumpy monsters' camps and King Grumble's castle too.
import { buildCamps } from './adventure.js';
import { buildDefense } from './defense.js';
import * as B from './blocks.js';
import { busesClearOf, placeAircraft, placeBig, placeBuses, placeFlyers, placeGiant, placePolar, placeScooters, placeSea, placeVehicles, scaleCounts } from './critters.js';
import { fbm } from './noise.js';
import { Rng, hash2 } from './rng.js';
import { fruitTree, oakTree, pineTree, candyTree, placeTemplate } from './stamps.js';
import { World } from './world.js';

export const THEMES = [
  { key: 'sunny', name: 'Sunny Island', icon: '🏝️', blurb: 'Beaches, fruit trees and flowers' },
  { key: 'snowy', name: 'Snowy Island', icon: '❄️', blurb: 'Snow, pine trees and frozen ponds' },
  { key: 'candy', name: 'Candy Island', icon: '🍭', blurb: 'Frosting hills and lollipop trees' },
  { key: 'flat', name: 'Flat Land', icon: '🟩', blurb: 'A big flat meadow for building' },
];

// How big an island is, side to side in blocks. A bigger one has more of
// everything: mountains, ponds, trees, flowers, shells and animals.
export const SIZES = [
  { key: 'small', name: 'Cozy', icon: '🏡', side: 128, blurb: 'Everything close by' },
  { key: 'big', name: 'Big', icon: '🏞️', side: 192, blurb: 'Twice the room, and two mountains' },
  { key: 'huge', name: 'Huge', icon: '🗺️', side: 256, blurb: 'Four times the room, to explore' },
];
export const sizeSide = (key) => (SIZES.find((s) => s.key === key) ?? SIZES[0]).side;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The island's own ground, flowers and grass, by its kind.
export function palette(theme) {
  switch (theme) {
    case 'snowy':
      return { top: B.SNOW, under: B.DIRT, deep: B.STONE, beach: B.SAND, flowers: [B.BLUEBELL, B.DAISY], grass: 0 };
    case 'candy':
      return { top: B.FROSTING, under: B.COOKIE, deep: B.CHOCOLATE, beach: B.SAND, flowers: [B.GUMDROP, B.LOLLIPOP, B.COSMOS], grass: 0 };
    default:
      return { top: B.GRASS, under: B.DIRT, deep: B.STONE, beach: B.SAND, flowers: [B.TULIP, B.DAISY, B.BLUEBELL, B.COSMOS, B.SUNFLOWER], grass: B.TALL_GRASS };
  }
}

// adventure: with monster camps all over it, to free (see adventure.js);
// defense: with a road for monsters to march along, and towers to build
// beside it (see defense.js).
export function generate({ seed = 1, theme = 'sunny', name = 'My Island', size = 'small', W = sizeSide(size), H = 64, D = W, sea = 20, adventure = false, defense = false } = {}) {
  const world = new World({ W, H, D, sea, theme, seed, name });
  // How much more there is of everything than on a cozy island: by area, and side to side.
  const area = (W * D) / (128 * 128);
  const more = (n) => Math.round(n * area);
  const rng = new Rng(seed);
  const pal = palette(theme);
  const heights = new Int16Array(W * D);
  const hi = (x, z) => heights[x * D + z];
  const cx = W / 2;
  const cz = D / 2;

  // ---------------------------------------------------------------- shape
  const mAngle = rng.next() * Math.PI * 2;
  const mDist = rng.range(0.18, 0.3) * W;
  const mx = cx + Math.cos(mAngle) * mDist;
  const mz = cz + Math.sin(mAngle) * mDist;
  const mHeight = theme === 'snowy' ? 24 : 18;
  // A bigger island has more mountains, spread about the first one.
  const mountains = [{ x: mx, z: mz, height: mHeight }];
  const wantMountains = Math.round(Math.sqrt(area) * 2) - 1;
  for (let tries = 0; tries < 100 && mountains.length < wantMountains; tries++) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(0.1, 0.32) * W;
    const m = { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, height: mHeight * rng.range(0.7, 1) };
    if (Math.hypot(m.x - cx, m.z - cz) < 16 || mountains.some((o) => Math.hypot(o.x - m.x, o.z - m.z) < 44)) continue;
    mountains.push(m);
  }
  const nearMountain = (x, z, r) => mountains.some((m) => Math.hypot(x - m.x, z - m.z) < r);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      let h;
      if (theme === 'flat') {
        const border = Math.min(x, z, W - 1 - x, D - 1 - z);
        h = border < 4 ? sea - 3 : sea + 2;
      } else {
        const nx = (x - cx) / (W / 2);
        const nz = (z - cz) / (D / 2);
        const d = Math.hypot(nx, nz) + fbm(seed + 11, x / 36, z / 36, 3) * 0.2;
        const mask = 1 - smoothstep(0.52, 0.86, d);
        const hills = fbm(seed + 23, x / 30, z / 30, 4);
        let peak = 0;
        for (const m of mountains) peak = Math.max(peak, Math.max(0, 1 - Math.hypot(x - m.x, z - m.z) / 19) ** 1.7 * m.height);
        const mountain = peak * (0.85 + 0.3 * fbm(seed + 37, x / 9, z / 9, 2));
        const land = sea + 2 + (2.5 + hills * 3.5) + mountain;
        const floor = sea - 4 - (1 - mask) * 6 + fbm(seed + 41, x / 14, z / 14, 2) * 1.5;
        h = floor + (land - floor) * smoothstep(0.02, 0.4, mask);
        // Soft beaches: land just above the sea is pulled down to it.
        if (h > sea && h < sea + 2.2 && mask < 0.55) h = sea + (h - sea) * 0.6;
      }
      heights[x * D + z] = Math.max(2, Math.min(H - 12, Math.round(h)));
    }
  }

  // ---------------------------------------------------------------- ponds
  const ponds = [];
  if (theme !== 'flat') {
    const want = rng.int(1, 2) + more(1) - 1;
    for (let tries = 0; tries < more(200) && ponds.length < want; tries++) {
      const px = rng.int(24, W - 25);
      const pz = rng.int(24, D - 25);
      const r = rng.range(3.2, 4.8);
      const h0 = hi(px, pz);
      if (h0 < sea + 2 || h0 > sea + 6) continue;
      if (nearMountain(px, pz, 22) || Math.hypot(px - cx, pz - cz) < 8) continue;
      if (ponds.some((p) => Math.hypot(p.x - px, p.z - pz) < p.r + r + 8)) continue;
      ponds.push({ x: px, z: pz, r, level: h0 - 1 });
    }
  }

  // ---------------------------------------------------------------- fill
  const beachAt = (x, z) => {
    const h = hi(x, z);
    if (h > sea + 1) return false;
    if (h <= sea - 2) return true;
    return true;
  };
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const h = hi(x, z);
      world.set(x, 0, z, B.MAGIC_FLOOR);
      const beach = beachAt(x, z);
      let top = beach ? pal.beach : pal.top;
      let under = beach ? pal.beach : pal.under;
      if (!beach && theme !== 'flat') {
        if (h > sea + 13 + hash2(seed, x, z) * 3) {
          top = theme === 'candy' ? B.CANDY_CANE : B.STONE;
          under = theme === 'candy' ? B.CHOCOLATE : B.STONE;
        }
        if (h > sea + 18 + hash2(seed + 1, x, z) * 2) top = theme === 'candy' ? B.COTTON_CANDY : B.SNOW;
      }
      for (let y = 1; y <= h; y++) {
        let id = pal.deep;
        if (y === h) id = top;
        else if (y >= h - 3) id = under;
        if (h < sea - 1 && y === h && hash2(seed + 3, x, z) < 0.25) id = B.PEBBLES;
        world.set(x, y, z, id);
      }
      for (let y = h + 1; y <= sea; y++) world.set(x, y, z, B.WATER);
    }
  }

  for (const p of ponds) {
    for (let x = Math.floor(p.x - p.r); x <= Math.ceil(p.x + p.r); x++) {
      for (let z = Math.floor(p.z - p.r); z <= Math.ceil(p.z + p.r); z++) {
        const d = Math.hypot(x - p.x, z - p.z) / p.r;
        if (d > 1) continue;
        const floor = p.level - 1 - Math.round(1.6 * (1 - d * d));
        const h = hi(x, z);
        for (let y = floor + 1; y <= Math.max(h, p.level); y++) world.set(x, y, z, y <= p.level ? B.WATER : B.AIR);
        world.set(x, floor, z, B.SAND);
        heights[x * D + z] = floor;
      }
    }
    // Raise any low rim so the pond's water never stands beside thin air.
    for (let x = Math.floor(p.x - p.r) - 1; x <= Math.ceil(p.x + p.r) + 1; x++) {
      for (let z = Math.floor(p.z - p.r) - 1; z <= Math.ceil(p.z + p.r) + 1; z++) {
        if (world.get(x, p.level, z) === B.WATER) continue;
        for (let y = hi(x, z) + 1; y <= p.level; y++) world.set(x, y, z, y === p.level ? pal.top : pal.under);
        heights[x * D + z] = Math.max(hi(x, z), p.level);
      }
    }
    if (theme === 'snowy') {
      for (let x = Math.floor(p.x - p.r); x <= Math.ceil(p.x + p.r); x++) {
        for (let z = Math.floor(p.z - p.r); z <= Math.ceil(p.z + p.r); z++) if (world.get(x, p.level, z) === B.WATER) world.set(x, p.level, z, B.ICE);
      }
    }
  }

  // ---------------------------------------------------------------- spawn
  const isLand = (x, z) => {
    const h = hi(x, z);
    return h > sea && world.get(x, h, z) === pal.top && world.get(x, h + 1, z) === B.AIR;
  };
  const flatAround = (x, z, r) => {
    const h = hi(x, z);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (!isLand(x + dx, z + dz) || Math.abs(hi(x + dx, z + dz) - h) > 0) return false;
    return true;
  };
  let spawn = null;
  for (let ring = 0; ring < 40 && !spawn; ring++) {
    for (let a = 0; a < 16 && !spawn; a++) {
      const x = Math.round(cx + Math.cos((a / 16) * Math.PI * 2) * ring);
      const z = Math.round(cz + Math.sin((a / 16) * Math.PI * 2) * ring);
      if (flatAround(x, z, 1)) spawn = { x, z };
    }
  }
  spawn ??= { x: Math.round(cx), z: Math.round(cz) };
  world.spawn = { x: spawn.x + 0.5, y: hi(spawn.x, spawn.z) + 1, z: spawn.z + 0.5 };
  const nearSpawn = (x, z, r) => Math.hypot(x - spawn.x, z - spawn.z) < r;

  // ---------------------------------------------------------------- trees
  const fruit = rng.pick(B.FRUIT_ITEMS);
  const trees = [];
  const place = (cells) => {
    for (const [x, y, z, id] of cells) {
      if (!world.inBounds(x, y, z)) continue;
      const here = world.get(x, y, z);
      if (here === B.AIR || B.KIND[here] === B.K_PLANT) world.set(x, y, z, id);
    }
  };
  const treeFits = (x, z, spacing) => isLand(x, z) && !nearSpawn(x, z, 8) && trees.every((t) => Math.hypot(t.x - x, t.z - z) >= spacing);
  const treeCount = more(theme === 'flat' ? 8 : 70);
  for (let tries = 0; tries < more(3000) && trees.length < treeCount; tries++) {
    const x = rng.int(3, W - 4);
    const z = rng.int(3, D - 4);
    const forest = fbm(seed + 53, x / 22, z / 22, 2);
    if (theme !== 'flat' && forest < -0.15 && rng.chance(0.8)) continue;
    if (!treeFits(x, z, 5)) continue;
    trees.push({ x, z });
    const y = hi(x, z) + 1;
    const high = hi(x, z) > sea + 9;
    let cells;
    if (theme === 'snowy') cells = pineTree(rng, true);
    else if (theme === 'candy') cells = rng.chance(0.3) ? fruitTree(rng, fruit, rng.int(2, 4)) : candyTree(rng);
    else if (high || (theme === 'sunny' && forest > 0.35 && rng.chance(0.5))) cells = pineTree(rng, false);
    else if (rng.chance(0.3)) cells = fruitTree(rng, fruit, rng.int(2, 4));
    else cells = oakTree(rng, rng.chance(0.15));
    trees.at(-1).cells = placeTemplate(cells, x, y, z, 0);
    place(trees.at(-1).cells);
  }
  // An orchard of the island's own fruit, not far from where everyone arrives.
  const orchardAngle = rng.next() * Math.PI * 2;
  let orchard = 0;
  for (let tries = 0; tries < 400 && orchard < 4; tries++) {
    const r = rng.range(9, 16);
    const a = orchardAngle + rng.range(-0.5, 0.5);
    const x = Math.round(spawn.x + Math.cos(a) * r);
    const z = Math.round(spawn.z + Math.sin(a) * r);
    if (!treeFits(x, z, 4)) continue;
    trees.push({ x, z, cells: placeTemplate(fruitTree(rng, fruit, 3), x, hi(x, z) + 1, z, 0) });
    orchard++;
    place(trees.at(-1).cells);
  }

  // ---------------------------------------------------------------- flowers and grass
  const clusters = more(theme === 'flat' ? 14 : 34);
  for (let i = 0; i < clusters; i++) {
    const x0 = rng.int(4, W - 5);
    const z0 = rng.int(4, D - 5);
    const flower = rng.pick(pal.flowers);
    const n = rng.int(4, 9);
    for (let k = 0; k < n; k++) {
      const x = x0 + rng.int(-3, 3);
      const z = z0 + rng.int(-3, 3);
      if (!isLand(x, z) || nearSpawn(x, z, 2)) continue;
      world.set(x, hi(x, z) + 1, z, flower);
    }
  }
  for (let x = 1; x < W - 1; x++) {
    for (let z = 1; z < D - 1; z++) {
      if (!isLand(x, z) || nearSpawn(x, z, 2)) continue;
      const r = hash2(seed + 61, x, z);
      if (pal.grass && r < 0.06) world.set(x, hi(x, z) + 1, z, pal.grass);
      else if (r > 0.997) world.set(x, hi(x, z) + 1, z, theme === 'candy' ? B.GUMDROP : B.MUSHROOM);
    }
  }

  // ---------------------------------------------------------------- rocks and shells
  if (theme !== 'flat') {
    for (let i = 0; i < more(10); i++) {
      const x = rng.int(4, W - 5);
      const z = rng.int(4, D - 5);
      if (!isLand(x, z) || nearSpawn(x, z, 6)) continue;
      const y = hi(x, z) + 1;
      const rock = theme === 'candy' ? B.CANDY_CANE : B.STONE;
      place([
        [x, y, z, rock],
        [x + 1, y, z, rock],
        [x, y, z + 1, rock],
        [x, y + 1, z, rock],
      ]);
    }
  }
  let shells = 0;
  for (let tries = 0; tries < more(4000) && shells < more(14); tries++) {
    const x = rng.int(1, W - 2);
    const z = rng.int(1, D - 2);
    const h = hi(x, z);
    if (world.get(x, h, z) !== B.SAND || h < sea || h > sea + 1 || world.get(x, h + 1, z) !== B.AIR) continue;
    world.set(x, h + 1, z, B.SHELL);
    shells++;
  }

  // ---------------------------------------------------------------- critters
  const critters = [];
  const spot = (test) => {
    for (let tries = 0; tries < 400; tries++) {
      const x = rng.int(2, W - 3);
      const z = rng.int(2, D - 3);
      if (test(x, z)) return { x: x + 0.5, y: world.top(x, z) + 1, z: z + 0.5 };
    }
    return null;
  };
  const onLand = (x, z) => isLand(x, z) || (world.get(x, hi(x, z), z) === pal.top && B.KIND[world.get(x, hi(x, z) + 1, z)] === B.K_PLANT);
  const counts = scaleCounts(theme === 'snowy' ? { bunny: 5, sheep: 4, chick: 2, duck: 2, butterfly: 0 } : { bunny: 4, chick: 4, sheep: 3, duck: 3, butterfly: 4 }, world);
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      let s;
      if (type === 'duck') {
        const p = ponds[i % Math.max(1, ponds.length)];
        s = p ? { x: p.x + 0.5 + rng.range(-1, 1), y: p.level + 1, z: p.z + 0.5 + rng.range(-1, 1) } : spot(onLand);
      } else {
        s = spot((x, z) => onLand(x, z) && !nearSpawn(x, z, 3));
      }
      if (s) critters.push({ type, ...s });
    }
  }
  critters.push(...placeFlyers(world, rng), ...placeSea(world, rng), ...placePolar(world, rng), ...placeBig(world, rng));
  // The giant mosquitos came after all of those, from randomness of their
  // own, so the rest of the island comes out just as it did before them.
  critters.push(...placeGiant(world, new Rng(seed ^ 0x94d049bb)));

  // ---------------------------------------------------------------- jewels and mines
  // Last, from randomness of their own, so the rest of the island comes out
  // just as it did before there were any.
  const mines = theme === 'flat' ? [] : digMines(world, heights, mountains, pal, new Rng(seed ^ 0x51ed2705), spawn);
  if (mines.length) clearWays(world, mines, trees, critters);
  hideGems(world, new Rng(seed ^ 0x2c1b3c6d));

  // ---------------------------------------------------------------- vehicles
  // Last, from their own randomness too.
  const vehicles = placeVehicles(world, new Rng(seed ^ 0x4cf5ad43), mines);
  critters.push(...vehicles);

  // ---------------------------------------------------------------- adventure
  // Last of all, from randomness of its own, on top of the island as it
  // would be without: the monsters' camps, and King Grumble's castle.
  let camps = [];
  if (adventure) {
    const made = buildCamps(world, new Rng(seed ^ 0x6a09e667), { pal, trees, critters, mines });
    camps = made.camps;
    critters.splice(0, critters.length, ...made.critters);
  }

  // ---------------------------------------------------------------- tower defense
  // Or, the same way, the monsters' road from their gate to the Star Stone.
  let road = null;
  if (defense && !adventure) {
    const made = buildDefense(world, new Rng(seed ^ 0x3c6ef372 ^ 0x9e3779b9), { pal, trees, critters, mines });
    if (made) {
      road = made.defense;
      critters.splice(0, critters.length, ...made.critters);
    }
  }

  // ---------------------------------------------------------------- riding together
  // After all that, so it all comes out just as before them: a bus and a
  // ferry, clear of everything else, with dice of their own.
  const buses = placeBuses(world, new Rng(seed ^ 0x3243f6a8), busesClearOf(vehicles, camps, road));
  critters.push(...buses);

  // ---------------------------------------------------------------- flying
  // And after those, the same way: a helicopter and a hot-air balloon.
  const aircraft = placeAircraft(world, new Rng(seed ^ 0x13198a2e), busesClearOf([...vehicles, ...buses], camps, road));
  critters.push(...aircraft);

  // ---------------------------------------------------------------- kicking along
  // And after those, the same way: a kick scooter by where everyone comes in.
  critters.push(...placeScooters(world, new Rng(seed ^ 0x85ebca6b), busesClearOf([...vehicles, ...buses, ...aircraft], camps, road)));

  return { world, critters, fruit, mines, camps, defense: road };
}

// ---------------------------------------------------------------- jewels

// Which jewel a gem rock holds: diamonds are the rarest.
function gemRock(r) {
  return r < 0.22 ? B.GEM_ROCKS[0] : r < 0.44 ? B.GEM_ROCKS[1] : r < 0.66 ? B.GEM_ROCKS[2] : r < 0.88 ? B.GEM_ROCKS[3] : B.DIAMOND_ROCK;
}

// The rock deep down that jewels hide in: stone, or chocolate on a candy island.
const DEEP = new Uint8Array(256);
DEEP[B.STONE] = 1;
DEEP[B.CHOCOLATE] = 1;
const ROCKY = new Uint8Array(256);
for (let id = 0; id < 256; id++) if (B.TERRAIN[id]) ROCKY[id] = 1;
ROCKY[B.MAGIC_FLOOR] = 1;

// Deep rock with rock on every side, so a jewel put there changes nothing
// anyone can see until they dig down to it.
function buried(world, x, y, z) {
  return (
    DEEP[world.get(x, y, z)] &&
    ROCKY[world.get(x + 1, y, z)] &&
    ROCKY[world.get(x - 1, y, z)] &&
    ROCKY[world.get(x, y + 1, z)] &&
    ROCKY[world.get(x, y - 1, z)] &&
    ROCKY[world.get(x, y, z + 1)] &&
    ROCKY[world.get(x, y, z - 1)]
  );
}

// Little veins of jewels, all of one kind, hidden in the deep rock all over
// the island, for anyone who digs down far enough; and on a stony mountain
// top, a few out in the open. Only ever replaces buried rock (and bare stone
// tops above the trees), so an island played on already can be given them
// too: what anyone built stays as it was.
export function hideGems(world, rng, { open = true } = {}) {
  const { W, D } = world;
  const area = (W * D) / (128 * 128);
  let veins = 0;
  for (let tries = 0; tries < Math.round(6000 * area) && veins < Math.round(110 * area); tries++) {
    const x = rng.int(1, W - 2);
    const z = rng.int(1, D - 2);
    const top = world.top(x, z);
    if (top < 6) continue;
    const y = rng.int(2, top - 4);
    if (!buried(world, x, y, z)) continue;
    const rock = gemRock(rng.next());
    world.set(x, y, z, rock);
    veins++;
    const size = rng.int(1, 4);
    for (let k = 0; k < size; k++) {
      const [dx, dy, dz] = rng.pick([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
      if (buried(world, x + dx, y + dy, z + dz)) world.set(x + dx, y + dy, z + dz, rock);
    }
  }
  if (!open) return;
  for (let x = 1; x < W - 1; x++) {
    for (let z = 1; z < D - 1; z++) {
      const h = world.top(x, z);
      if (h > world.sea + 12 && world.get(x, h, z) === B.STONE && world.get(x, h + 1, z) === B.AIR && hash2(world.seed + 71, x, z) < 0.035) world.set(x, h, z, gemRock(hash2(world.seed + 73, x, z)));
    }
  }
}

// A mine into each mountain: a path cut up into its side from the foot, a
// wooden doorway where the rock closes over it, a tunnel three wide lit by
// lamps with jewels in its walls, and a little cave at the end with a
// diamond in it; rails along the middle from the foot to the end, with a
// mine cart on them at the doorway. Mountains too low or too near the sea
// get none. Returns each mine, with the cells of its way in, to keep trees
// and rocks out, and where its mine cart and a digger beside the way go.
function digMines(world, heights, mountains, pal, rng, spawn) {
  const { W, D, sea } = world;
  const hi = (x, z) => (x < 0 || z < 0 || x >= W || z >= D ? 0 : heights[x * D + z]);
  const mines = [];
  for (const m of mountains) {
    // Out from the mountain to its foot, straight along x or z: towards the
    // middle of the island if that way works, otherwise another way.
    const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(([x1, z1], [x2, z2]) => (x2 - x1) * (W / 2 - m.x) + (z2 - z1) * (D / 2 - m.z));
    for (const [dx, dz] of ways) {
      const mine = digMine(world, hi, m, dx, dz, pal, rng, mines, spawn);
      if (mine) {
        mines.push(mine);
        break;
      }
    }
  }
  return mines;
}

function digMine(world, hi, m, dx, dz, pal, rng, mines, spawn) {
  const { sea } = world;
  let foot = null;
  for (let t = 4; t < 40; t++) {
    const x = Math.round(m.x + dx * t);
    const z = Math.round(m.z + dz * t);
    const h = hi(x, z);
    if (h <= sea + 1) break;
    if (h <= sea + 6) {
      foot = { x, z, g: h };
      break;
    }
  }
  if (!foot) return null;
  const { g } = foot;
  if (world.get(foot.x, g, foot.z) !== pal.top || mines.some((o) => Math.hypot(o.x - foot.x, o.z - foot.z) < 16)) return null;
  // Back into the mountain.
  const [ax, az] = [-dx, -dz];
  const [px, pz] = [az, ax];
  const at = (i, p) => [foot.x + ax * i + px * p, foot.z + az * i + pz * p];
  // Rock at least this high over every column across.
  const covered = (i, wide, high) => {
    for (let p = -wide; p <= wide; p++) if (hi(...at(i, p)) < g + high) return false;
    return true;
  };
  let door = -1;
  for (let i = 0; i <= 20 && door < 0; i++) if (covered(i, 2, 5)) door = i;
  if (door < 0) return null;
  // Not over where everyone comes in.
  for (let i = -3; i <= door; i++) if (Math.hypot(at(i, 0)[0] - spawn.x, at(i, 0)[1] - spawn.z) < 7) return null;
  let end = door;
  for (let i = door + 1; i <= door + 16 && covered(i, 2, 5); i++) end = i;
  if (end - door < 7) return null;
  const cave = end - door >= 10 && [1, 3, 5].every((k) => covered(end + k, 3, 6));
  const air = [];
  for (let i = 0; i <= end; i++) for (let p = -1; p <= 1; p++) for (let y = g + 1; y <= g + 3; y++) air.push([...at(i, p), y]);
  if (cave) for (let i = end + 1; i <= end + 5; i++) for (let p = -2; p <= 2; p++) for (let y = g + 1; y <= g + 4; y++) air.push([...at(i, p), y]);
  for (const [x, z, y] of air) world.set(x, y, z, B.AIR);
  for (const [x, z, y] of air) if (y === g + 1) world.set(x, g, z, B.PEBBLES);
  // Jewels in the rock round it (not in the grass outside).
  for (const [x, z, y] of air) {
    for (const [ox, oy, oz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      const id = world.get(x + ox, y + oy, z + oz);
      if ((id === pal.deep || id === pal.under) && rng.chance(0.12)) world.set(x + ox, y + oy, z + oz, gemRock(rng.next()));
    }
  }
  // A diamond waiting at the very end.
  const [ex, ez] = at(cave ? end + 6 : end + 1, 0);
  if (B.TERRAIN[world.get(ex, g + 2, ez)]) world.set(ex, g + 2, ez, B.DIAMOND_ROCK);
  // Lamps along the walls, one side then the other, and in the cave's roof.
  for (let i = door + 3, side = 1; i <= end; i += 5, side = -side) {
    const [x, z] = at(i, 2 * side);
    world.set(x, g + 3, z, B.LAMP);
  }
  if (cave) {
    const [x, z] = at(end + 3, 0);
    world.set(x, g + 5, z, B.LAMP);
  }
  // Rails down the middle, from the foot to the end (and into the cave).
  const last = cave ? end + 4 : end;
  for (let i = 0; i <= last; i++) {
    const [x, z] = at(i, 0);
    world.set(x, g + 1, z, B.RAIL);
  }
  // A wooden doorway where the rock closes over.
  for (const p of [-2, 2]) {
    const [x, z] = at(door, p);
    for (let y = g + 1; y <= g + 3; y++) world.set(x, y, z, B.WOOD);
  }
  for (let p = -2; p <= 2; p++) {
    const [x, z] = at(door, p);
    world.set(x, g + 4, z, B.PLANKS);
  }
  const way = [];
  for (let i = -2; i <= door; i++) {
    const [x, z] = at(i, 0);
    way.push({ x, z });
  }
  const [x, z] = at(door, 0);
  // Its mine cart in the doorway, and a digger beside the way in, both facing in.
  const into = Math.atan2(ax, az);
  const [dx2, dz2] = at(-3, 2);
  return { x, z, y: g + 1, way, cart: { x: x + 0.5, y: g + 1, z: z + 0.5, yaw: into }, digger: { x: dx2 + 0.5, y: hi(dx2, dz2) + 1, z: dz2 + 0.5, yaw: into } };
}

// Trees in the way into a mine come down, and anything left with nothing
// under it goes; animals standing in the way stand on the path.
function clearWays(world, mines, trees, critters) {
  const near = (x, z, r) => mines.some((m) => m.way.some((w) => Math.hypot(x - w.x, z - w.z) < r));
  for (const t of trees) {
    if (!t.cells || !near(t.x, t.z, 4)) continue;
    for (const [x, y, z, id] of t.cells) if (world.get(x, y, z) === id) world.set(x, y, z, B.AIR);
  }
  for (const m of mines) {
    for (const w of m.way) {
      for (let x = w.x - 4; x <= w.x + 4; x++) {
        for (let z = w.z - 4; z <= w.z + 4; z++) {
          for (let y = 1; y < world.H; y++) {
            const kind = B.KIND[world.get(x, y, z)];
            if ((kind === B.K_PLANT || kind === B.K_ITEM) && !B.SOLID[world.get(x, y - 1, z)] && !B.FRUIT_ITEMS.includes(world.get(x, y, z))) world.set(x, y, z, B.AIR);
          }
        }
      }
    }
  }
  for (const c of critters) {
    if (!near(c.x, c.z, 3) || c.y < world.sea) continue;
    c.y = world.groundBelow(Math.floor(c.x), Math.floor(c.y) + 2, Math.floor(c.z)) + 1;
  }
}
