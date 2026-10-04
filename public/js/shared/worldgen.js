// Makes a new island from a seed: hills and a mountain, beaches, a pond,
// trees (some of them fruit trees of the island's own fruit), flowers,
// seashells, animal friends, and a spot for everyone to arrive at.
import * as B from './blocks.js';
import { placeBig, placeFlyers, placePolar, placeSea, scaleCounts } from './critters.js';
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

function palette(theme) {
  switch (theme) {
    case 'snowy':
      return { top: B.SNOW, under: B.DIRT, deep: B.STONE, beach: B.SAND, flowers: [B.BLUEBELL, B.DAISY], grass: 0 };
    case 'candy':
      return { top: B.FROSTING, under: B.COOKIE, deep: B.CHOCOLATE, beach: B.SAND, flowers: [B.GUMDROP, B.LOLLIPOP, B.COSMOS], grass: 0 };
    default:
      return { top: B.GRASS, under: B.DIRT, deep: B.STONE, beach: B.SAND, flowers: [B.TULIP, B.DAISY, B.BLUEBELL, B.COSMOS, B.SUNFLOWER], grass: B.TALL_GRASS };
  }
}

export function generate({ seed = 1, theme = 'sunny', name = 'My Island', size = 'small', W = sizeSide(size), H = 64, D = W, sea = 20 } = {}) {
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
    place(placeTemplate(cells, x, y, z, 0));
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
    trees.push({ x, z });
    orchard++;
    place(placeTemplate(fruitTree(rng, fruit, 3), x, hi(x, z) + 1, z, 0));
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

  return { world, critters, fruit };
}
