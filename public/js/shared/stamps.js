// Ready-made builds: trees (for world generation and for sprouts that grow)
// and the stamps in the toy box. Each is a list of cells [dx, dy, dz, block]
// relative to where it goes: dy = 0 is the first layer above the ground, dx
// runs to the builder's right and dz away from them.
import * as B from './blocks.js';
import { Rng } from './rng.js';

const [RED, ORANGE, YELLOW, LIME, GREEN, TEAL, SKY, BLUE, PURPLE, LAVENDER, PINK, WHITE, GRAY, CHARCOAL, BROWN, TAN] = B.TOY_BRICKS;

class Cells {
  constructor() {
    this.map = new Map();
  }

  put(dx, dy, dz, id) {
    this.map.set(`${dx},${dy},${dz}`, [dx, dy, dz, id]);
  }

  // Only where nothing has been put yet.
  add(dx, dy, dz, id) {
    const key = `${dx},${dy},${dz}`;
    if (!this.map.has(key)) this.map.set(key, [dx, dy, dz, id]);
  }

  has(dx, dy, dz) {
    return this.map.has(`${dx},${dy},${dz}`);
  }

  get(dx, dy, dz) {
    return this.map.get(`${dx},${dy},${dz}`)?.[3] ?? 0;
  }

  box(x0, y0, z0, x1, y1, z1, id) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.put(x, y, z, id);
  }

  list() {
    return [...this.map.values()];
  }
}

function blob(c, cx, cy, cz, rx, ry, rz, id, rng = null, fuzz = 0) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
        if (d <= 1 - (rng && fuzz ? rng.next() * fuzz : 0)) c.add(x, y, z, id);
      }
    }
  }
}

// ---------------------------------------------------------------- trees

export function oakTree(rng, big = false) {
  const c = new Cells();
  const h = big ? rng.int(5, 6) : rng.int(3, 4);
  for (let y = 0; y < h; y++) c.put(0, y, 0, B.WOOD);
  const r = big ? 3.2 : 2.3;
  blob(c, 0, h + (big ? 0.5 : 0), 0, r, r * 0.85, r, B.LEAVES, rng, 0.25);
  return c.list();
}

// A round fruit tree with fruit hanging around the bottom of its crown.
export function fruitTree(rng, fruitId, count = 3) {
  const c = new Cells();
  const h = rng.int(3, 4);
  for (let y = 0; y < h; y++) c.put(0, y, 0, B.WOOD);
  blob(c, 0, h + 0.4, 0, 2.3, 1.9, 2.3, B.LEAVES);
  // Fruit goes in empty cells right beside the lowest ring of leaves.
  const spots = [];
  for (const [dx, dz] of [
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
    [2, 2],
    [-2, 2],
    [2, -2],
    [-2, -2],
  ]) {
    for (let y = h - 1; y <= h + 1; y++) {
      if (c.has(dx, y, dz)) continue;
      const touches = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 0, 1],
        [0, 0, -1],
        [0, 1, 0],
      ].some(([ax, ay, az]) => c.get(dx + ax, y + ay, dz + az) === B.LEAVES);
      if (touches) {
        spots.push([dx, y, dz]);
        break;
      }
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (const [dx, y, dz] of spots.slice(0, count)) c.put(dx, y, dz, fruitId);
  return c.list();
}

export function pineTree(rng, snowy = false) {
  const c = new Cells();
  const h = rng.int(5, 7);
  for (let y = 0; y < h; y++) c.put(0, y, 0, B.WOOD);
  const layers = h + 1;
  for (let i = 1; i <= layers; i++) {
    const y = i + 1;
    const r = Math.max(0.6, 2.6 * (1 - (i - 1) / layers));
    const leaf = snowy && (i % 2 === 0 || i === layers) ? B.SNOWY_LEAVES : B.PINE_LEAVES;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (x * x + z * z <= r * r && !(x === 0 && z === 0 && y < h)) c.add(x, y, z, leaf);
  }
  c.put(0, layers + 2, 0, snowy ? B.SNOWY_LEAVES : B.PINE_LEAVES);
  return c.list();
}

export function candyTree(rng) {
  const c = new Cells();
  const h = rng.int(4, 5);
  for (let y = 0; y < h; y++) c.put(0, y, 0, WHITE);
  blob(c, 0, h + 1, 0, 2.4, 2.1, 2.4, B.COTTON_CANDY, rng, 0.2);
  return c.list();
}

// What a sprout grows into.
export function grownTree(kind, seed) {
  const rng = new Rng(seed);
  if (kind === 'oak') return oakTree(rng);
  if (kind === 'pine') return pineTree(rng, false);
  if (kind === 'candy') return candyTree(rng);
  if (kind?.startsWith('fruit-')) {
    const fruit = B.blockByKey(kind.slice(6));
    if (fruit) return fruitTree(rng, fruit.id, 3);
  }
  return oakTree(rng);
}

// ---------------------------------------------------------------- stamps

function house() {
  const c = new Cells();
  // Floor, walls with a door and windows, then a stepped roof.
  c.box(-3, 0, 0, 3, 0, 6, B.PLANKS);
  for (let y = 1; y <= 4; y++) {
    for (let x = -3; x <= 3; x++) {
      for (let z = 0; z <= 6; z++) {
        const edge = x === -3 || x === 3 || z === 0 || z === 6;
        if (!edge) {
          c.put(x, y, z, B.AIR);
          continue;
        }
        const corner = (x === -3 || x === 3) && (z === 0 || z === 6);
        c.put(x, y, z, corner ? B.WOOD : B.PLANKS);
      }
    }
  }
  // Door (front, facing the builder) and windows.
  c.put(0, 1, 0, B.AIR);
  c.put(0, 2, 0, B.AIR);
  for (const x of [-2, 2]) c.put(x, 2, 0, B.GLASS);
  for (const z of [2, 4]) {
    c.put(-3, 2, z, B.GLASS);
    c.put(3, 2, z, B.GLASS);
  }
  c.put(0, 2, 6, B.GLASS);
  for (let step = 0; step <= 3; step++) {
    const y = 5 + step;
    const lo = -4 + step;
    const hi = 4 - step;
    for (let x = lo; x <= hi; x++) {
      for (let z = -1; z <= 7; z++) {
        if (x === lo || x === hi || step === 3) c.put(x, y, z, RED);
        else if (z >= 0 && z <= 6) c.put(x, y, z, z === 0 || z === 6 ? B.PLANKS : B.AIR);
      }
    }
  }
  c.put(0, 4, 3, B.LAMP);
  // A little doormat of flowers.
  c.put(-1, 1, -1, B.TULIP);
  c.put(1, 1, -1, B.DAISY);
  c.put(-1, 0, -1, B.GRASS);
  c.put(1, 0, -1, B.GRASS);
  return c.list();
}

function tower() {
  const c = new Cells();
  for (let y = 0; y <= 8; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = 0; z <= 4; z++) {
        const edge = x === -2 || x === 2 || z === 0 || z === 4;
        c.put(x, y, z, edge || y === 0 ? B.PEBBLES : B.AIR);
      }
    }
  }
  c.put(0, 1, 0, B.AIR);
  c.put(0, 2, 0, B.AIR);
  for (const y of [4, 7]) {
    c.put(0, y, 0, B.GLASS);
    c.put(-2, y, 2, B.GLASS);
    c.put(2, y, 2, B.GLASS);
    c.put(0, y, 4, B.GLASS);
  }
  c.box(-2, 9, 0, 2, 9, 4, B.PEBBLES);
  for (let x = -2; x <= 2; x++) {
    for (let z = 0; z <= 4; z++) {
      const edge = x === -2 || x === 2 || z === 0 || z === 4;
      if (edge && (x + z) % 2 === 0) c.put(x, 10, z, B.PEBBLES);
    }
  }
  // A flag on top.
  c.put(0, 10, 2, CHARCOAL);
  c.put(0, 11, 2, CHARCOAL);
  c.put(0, 12, 2, CHARCOAL);
  c.put(1, 12, 2, RED);
  c.put(2, 12, 2, RED);
  c.put(1, 11, 2, RED);
  c.put(0, 8, 2, B.LAMP);
  return c.list();
}

function fountain() {
  const c = new Cells();
  for (let x = -3; x <= 3; x++) {
    for (let z = 0; z <= 6; z++) {
      const dx = x;
      const dz = z - 3;
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      if (d === 3) c.put(x, 0, z, B.PEBBLES);
      else c.put(x, 0, z, B.WATER);
    }
  }
  c.put(0, 0, 3, B.PEBBLES);
  c.put(0, 1, 3, B.PEBBLES);
  c.put(0, 2, 3, B.PEBBLES);
  c.put(0, 3, 3, B.WATER);
  return c.list();
}

function bridge() {
  const c = new Cells();
  for (let z = 0; z <= 9; z++) {
    for (let x = -1; x <= 1; x++) c.put(x, 0, z, B.PLANKS);
    if (z % 3 === 0) {
      c.put(-2, 0, z, B.WOOD);
      c.put(2, 0, z, B.WOOD);
      c.put(-2, 1, z, B.WOOD);
      c.put(2, 1, z, B.WOOD);
    } else {
      c.put(-2, 0, z, B.PLANKS);
      c.put(2, 0, z, B.PLANKS);
    }
  }
  return c.list();
}

function rainbow() {
  const c = new Cells();
  const bands = [RED, ORANGE, YELLOW, GREEN, SKY, BLUE, PURPLE];
  const inner = 5;
  for (let x = -12; x <= 12; x++) {
    for (let y = 0; y <= 12; y++) {
      const d = Math.hypot(x, y);
      const band = Math.floor(d - inner);
      if (band >= 0 && band < bands.length) c.put(x, y, 0, bands[bands.length - 1 - band]);
    }
  }
  // Fluffy clouds at the feet.
  for (const side of [-1, 1]) {
    blob(c, side * 8.5, 0.3, 0, 2.6, 1.3, 1.4, B.CLOUD);
  }
  return c.list();
}

function heart() {
  const c = new Cells();
  const rows = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  rows.forEach((row, i) => {
    const y = rows.length - 1 - i;
    [...row].forEach((ch, j) => {
      if (ch === 'X') c.put(j - 4, y, 0, (j + i) % 5 === 0 ? PINK : RED);
    });
  });
  return c.list();
}

function star() {
  const c = new Cells();
  const rows = ['....X....', '...XXX...', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '.XXX.XXX.', 'XX.....XX'];
  rows.forEach((row, i) => {
    const y = rows.length - 1 - i;
    [...row].forEach((ch, j) => {
      if (ch === 'X') c.put(j - 4, y + 1, 0, i === 2 && j === 4 ? B.STAR_BLOCK : YELLOW);
    });
  });
  c.put(0, 0, 0, CHARCOAL);
  return c.list();
}

function snowman() {
  const c = new Cells();
  blob(c, 0, 1.2, 2, 2.2, 1.9, 2.2, B.SNOW);
  blob(c, 0, 4, 2, 1.6, 1.3, 1.6, B.SNOW);
  blob(c, 0, 6.2, 2, 1.25, 1.25, 1.25, B.SNOW);
  // Coal eyes, a carrot nose, stick arms and a top hat.
  const front = Math.min(...c.list().filter(([, y]) => y === 6).map(([, , z]) => z));
  c.put(-1, 6, front, CHARCOAL);
  c.put(1, 6, front, CHARCOAL);
  c.put(0, 6, front - 1, ORANGE);
  c.put(-2, 4, 2, BROWN);
  c.put(-3, 5, 2, BROWN);
  c.put(2, 4, 2, BROWN);
  c.put(3, 5, 2, BROWN);
  c.box(-1, 8, 1, 1, 8, 3, CHARCOAL);
  c.put(0, 9, 2, CHARCOAL);
  c.put(0, 10, 2, CHARCOAL);
  return c.list();
}

function boat() {
  const c = new Cells();
  const widths = [0, 1, 2, 2, 2, 1, 0];
  widths.forEach((w, z) => {
    for (let x = -w; x <= w; x++) c.put(x, 0, z, B.PLANKS);
    c.put(-w, 1, z, BROWN);
    c.put(w, 1, z, BROWN);
  });
  // The mast, a triangle sail and a little flag.
  for (let y = 1; y <= 6; y++) c.put(0, y, 3, B.WOOD);
  for (let y = 2; y <= 6; y++) {
    const w = Math.floor((7 - y) / 2) + 1;
    for (let z = 3 - w; z < 3; z++) c.put(0, y, z, WHITE);
  }
  c.put(0, 7, 3, RED);
  return c.list();
}

function lampPost() {
  const c = new Cells();
  c.put(0, 0, 0, CHARCOAL);
  c.put(0, 1, 0, CHARCOAL);
  c.put(0, 2, 0, CHARCOAL);
  c.put(0, 3, 0, B.LAMP);
  return c.list();
}

function garden() {
  const c = new Cells();
  const flowers = [B.TULIP, B.DAISY, B.BLUEBELL, B.COSMOS, B.SUNFLOWER];
  for (let x = -2; x <= 2; x++) {
    for (let z = 0; z <= 4; z++) {
      c.put(x, -1, z, B.GRASS);
      c.put(x, 0, z, flowers[(x + 2 + z * 2) % flowers.length]);
    }
  }
  return c.list();
}

function pyramid() {
  const c = new Cells();
  for (let y = 0; y <= 4; y++) {
    const r = 4 - y;
    for (let x = -r; x <= r; x++) for (let z = 4 - r; z <= 4 + r; z++) c.put(x, y, z, y === 4 ? YELLOW : B.SAND);
  }
  return c.list();
}

function bigTree() {
  return oakTree(new Rng(7), true);
}

function pine() {
  return pineTree(new Rng(11), false);
}

function picnic() {
  const c = new Cells();
  // A red-and-white blanket with a little table and two stools.
  for (let x = -2; x <= 2; x++) for (let z = 0; z <= 4; z++) c.put(x, -1, z, (x + z) % 2 === 0 ? RED : WHITE);
  c.put(0, 0, 2, B.WOOD);
  c.put(0, 1, 2, B.PLANKS);
  c.put(-1, 1, 2, B.PLANKS);
  c.put(1, 1, 2, B.PLANKS);
  c.put(0, 1, 1, B.PLANKS);
  c.put(0, 1, 3, B.PLANKS);
  c.put(-2, 0, 2, B.HAY);
  c.put(2, 0, 2, B.HAY);
  c.put(0, 2, 2, B.FRUIT_ITEMS[0]);
  return c.list();
}

export const STAMPS = [
  { key: 'house', name: 'Cozy House', icon: '🏠', cells: house() },
  { key: 'tower', name: 'Castle Tower', icon: '🏰', cells: tower() },
  { key: 'big-tree', name: 'Big Tree', icon: '🌳', cells: bigTree() },
  { key: 'pine', name: 'Pine Tree', icon: '🌲', cells: pine() },
  { key: 'fountain', name: 'Fountain', icon: '⛲', cells: fountain() },
  { key: 'bridge', name: 'Bridge', icon: '🌉', cells: bridge() },
  { key: 'rainbow', name: 'Rainbow', icon: '🌈', cells: rainbow() },
  { key: 'heart', name: 'Big Heart', icon: '💖', cells: heart() },
  { key: 'star', name: 'Big Star', icon: '⭐', cells: star() },
  { key: 'snowman', name: 'Snowman', icon: '⛄', cells: snowman() },
  { key: 'boat', name: 'Sail Boat', icon: '⛵', cells: boat() },
  { key: 'lamp-post', name: 'Lamp Post', icon: '💡', cells: lampPost() },
  { key: 'garden', name: 'Flower Garden', icon: '🌻', cells: garden() },
  { key: 'pyramid', name: 'Pyramid', icon: '🔺', cells: pyramid() },
  { key: 'picnic', name: 'Picnic', icon: '🧺', cells: picnic() },
];
export const stampByKey = (key) => STAMPS.find((s) => s.key === key) ?? null;

// Facing: 0 = the builder looks toward +z, 1 = +x, 2 = -z, 3 = -x.
export const FACING = [
  { f: [0, 1], r: [-1, 0] },
  { f: [1, 0], r: [0, 1] },
  { f: [0, -1], r: [1, 0] },
  { f: [-1, 0], r: [0, -1] },
];

// Where each cell of a template lands in the world.
export function placeTemplate(cells, x, y, z, facing) {
  const { f, r } = FACING[((facing % 4) + 4) % 4];
  return cells.map(([dx, dy, dz, id]) => [x + dx * r[0] + dz * f[0], y + dy, z + dx * r[1] + dz * f[1], id]);
}

// The facing (0-3) closest to a camera yaw, where yaw 0 looks toward -z.
export function facingFromYaw(yaw) {
  // Forward for yaw is (-sin yaw, -cos yaw).
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  if (Math.abs(fz) >= Math.abs(fx)) return fz > 0 ? 0 : 2;
  return fx > 0 ? 1 : 3;
}
