// The big things the AI friend builds on its own island (buddy.js), a layer
// at a time so whoever is there sees them go up: a castle, a lighthouse, a
// rocket, a statue of itself, a treehouse, a hedge maze, a Ferris wheel, a
// rainbow pyramid, a trampoline park and a birthday cake. Each comes in a
// colour of the toy bricks and in two sizes. As the toy box's stamps, a
// build is a list of cells [dx, dy, dz, block]: dy = 0 is the first layer
// above the ground, dx runs to the right and dz away from whoever looks at
// its front, which is where a door or a gate is.
//
// findSite() looks for flat open ground for one, near where everyone comes
// in, with its front that way; layersAt() puts it there, foundation first.
import * as B from '../public/js/shared/blocks.js';
import { Rng } from '../public/js/shared/rng.js';
import { FACING, placeTemplate } from '../public/js/shared/stamps.js';

export const COLORS = B.BRICK_COLORS.map(([key]) => key);
const brick = (key) => B.TOY_BRICKS[Math.max(0, COLORS.indexOf(key))];
const [RED, ORANGE, YELLOW, LIME, GREEN, , SKY, BLUE, PURPLE, , PINK, WHITE, GRAY, CHARCOAL, , TAN] = B.TOY_BRICKS;
const RAINBOW = [RED, ORANGE, YELLOW, LIME, GREEN, SKY, BLUE, PURPLE];
// A tent cloth near a brick colour, for flags and cabins.
const CLOTH_FOR = { red: 0, orange: 1, yellow: 2, lime: 3, green: 3, teal: 4, sky: 4, blue: 4, purple: 5, lavender: 5, pink: 6, white: 7, gray: 7, charcoal: 7, brown: 1, tan: 2 };
const cloth = (key) => B.CLOTHS[CLOTH_FOR[key] ?? 0];

class Cells {
  constructor() {
    this.map = new Map();
  }

  put(x, y, z, id) {
    this.map.set(`${x},${y},${z}`, [x, y, z, id]);
  }

  box(x0, y0, z0, x1, y1, z1, id) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.put(x, y, z, id);
  }

  // The outside of a box's walls, from y0 to y1.
  walls(x0, z0, x1, z1, y0, y1, id) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        this.put(x, y, z0, id);
        this.put(x, y, z1, id);
      }
      for (let z = z0; z <= z1; z++) {
        this.put(x0, y, z, id);
        this.put(x1, y, z, id);
      }
    }
  }

  // A round wall (or with fill, a disc) of radius r at height y, around cx, cz.
  ring(cx, cz, r, y, id, fill = false) {
    const R = Math.ceil(r);
    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z);
        if (d <= r + 0.5 && (fill || d > r - 0.5)) this.put(cx + x, y, cz + z, id);
      }
    }
  }

  remove(x, y, z) {
    this.map.delete(`${x},${y},${z}`);
  }

  list() {
    return [...this.map.values()];
  }
}

// A stepped roof: squares smaller each layer up, to a point.
function roof(c, cx, cz, half, y, id) {
  for (let k = 0; half - k >= 0; k++) c.walls(cx - half + k, cz - half + k, cx + half - k, cz + half - k, y + k, y + k, id);
}

function castle(color, big) {
  const c = new Cells();
  const h = big ? 6 : 5;
  const H = (big ? 13 : 9) >> 1;
  const wall = B.BRICK_WALL;
  c.walls(-H, -H, H, H, 0, h - 1, wall);
  // Battlements all the way round.
  for (let x = -H; x <= H; x += 2) for (const z of [-H, H]) c.put(x, h, z, wall);
  for (let z = -H; z <= H; z += 2) for (const x of [-H, H]) c.put(x, h, z, wall);
  // The gate, with a coloured arch over it.
  for (let x = -1; x <= 1; x++) for (let y = 0; y <= 2; y++) c.remove(x, y, -H);
  for (let x = -2; x <= 2; x++) c.put(x, 3, -H, brick(color));
  // A tower at each corner, with a pointed roof and a flag.
  const t = h + 3;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * H;
      const z = sz * H;
      c.walls(x - 1, z - 1, x + 1, z + 1, 0, t - 1, wall);
      c.put(x, t - 2, z - 1, B.GLASS);
      roof(c, x, z, 1, t, brick(color));
      c.put(x, t + 2, z, WHITE);
      c.put(x, t + 3, z, cloth(color));
    }
  }
  // A big castle has a keep in the middle.
  if (big) {
    c.walls(-2, -2, 2, 2, 0, h + 4, wall);
    for (let y = 0; y <= 1; y++) c.remove(0, y, -2);
    c.put(0, 3, -2, B.GLASS);
    c.put(0, h + 1, -2, B.GLASS);
    roof(c, 0, 0, 2, h + 5, brick(color));
    c.put(0, h + 8, 0, B.STAR_BLOCK);
  }
  return c.list();
}

function lighthouse(color, big) {
  const c = new Cells();
  const r = big ? 3 : 2;
  const h = big ? 16 : 12;
  for (let y = 0; y < h; y++) c.ring(0, 0, r, y, Math.floor(y / 2) % 2 ? WHITE : brick(color));
  c.ring(0, 0, r - 1, 0, B.PLANKS, true);
  // A door, and windows up the side.
  for (let y = 0; y <= 1; y++) c.remove(0, y, -r);
  for (let y = 4; y < h - 2; y += 4) c.put(0, y, -r, B.GLASS);
  // A lift inside up to the gallery.
  c.put(0, 0, 0, B.ELEVATOR);
  c.ring(0, 0, r + 1, h, B.PLANKS, true);
  c.put(0, h, 0, B.ELEVATOR);
  c.ring(0, 0, r + 1, h + 1, B.PEBBLES);
  for (let y = h + 1; y <= h + 2; y++) c.ring(0, 0, r - 1, y, B.GLASS);
  c.put(0, h + 2, 0, B.LAMP);
  c.ring(0, 0, r - 1, h + 3, brick(color), true);
  c.ring(0, 0, Math.max(0, r - 2), h + 4, brick(color), true);
  c.put(0, h + 5, 0, B.STAR_BLOCK);
  return c.list();
}

function rocket(color, big) {
  const c = new Cells();
  const r = 2;
  const h = big ? 15 : 11;
  const base = 2;
  for (let y = base; y < base + h; y++) c.ring(0, 0, r, y, (y - base) % 4 === 3 ? brick(color) : WHITE);
  for (let y = base + 3; y < base + h - 2; y += 4) c.put(0, y, -r, B.GLASS);
  // The nose.
  c.ring(0, 0, r - 1, base + h, brick(color), true);
  c.ring(0, 0, r - 1, base + h + 1, brick(color), true);
  c.put(0, base + h + 2, 0, brick(color));
  c.put(0, base + h + 3, 0, B.STAR_BLOCK);
  // Four fins it stands on, and its engine glowing between them.
  for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let k = 1; k <= 2; k++) for (let y = 0; y <= 4 - k; y++) c.put(fx * (r + k), y, fz * (r + k), brick(color));
    for (let y = 0; y < base; y++) c.put(fx * r, y, fz * r, GRAY);
  }
  c.put(0, 1, 0, B.LAMP);
  c.ring(0, 0, 1, 0, CHARCOAL, true);
  return c.list();
}

// A statue of the AI friend itself: spiky blue hair, big headphones, and a
// T-shirt in the colour asked for.
function robot(color, big) {
  const c = new Cells();
  const s = big ? 2 : 1;
  const box = (x0, y0, z0, x1, y1, z1, id) => c.box(x0 * s, y0 * s, z0 * s, x1 * s + s - 1, y1 * s + s - 1, z1 * s + s - 1, id);
  // Shoes, legs, a shirt, arms and hands.
  box(-2, 0, -1, -1, 0, 1, CHARCOAL);
  box(1, 0, -1, 2, 0, 1, CHARCOAL);
  box(-2, 1, 0, -1, 3, 1, BLUE);
  box(1, 1, 0, 2, 3, 1, BLUE);
  box(-3, 4, 0, 3, 8, 1, brick(color));
  box(-4, 6, 0, -4, 8, 1, brick(color));
  box(4, 6, 0, 4, 8, 1, brick(color));
  box(-4, 4, 0, -4, 5, 1, TAN);
  box(4, 4, 0, 4, 5, 1, TAN);
  // The head: eyes and a smile on the front, hair on top.
  box(-2, 9, -1, 2, 13, 2, TAN);
  box(-1, 11, -1, -1, 11, -1, CHARCOAL);
  box(1, 11, -1, 1, 11, -1, CHARCOAL);
  box(-1, 10, -1, 1, 10, -1, PINK);
  box(-2, 14, -1, 2, 14, 2, B.TOY_BRICKS[7]);
  for (const [x, z] of [[-2, 0], [0, -1], [2, 1], [0, 2], [-1, 1], [1, 0]]) box(x, 15, z, x, 15, z, B.TOY_BRICKS[7]);
  // Headphones, with the band over the top.
  box(-3, 10, 0, -3, 12, 1, CHARCOAL);
  box(3, 10, 0, 3, 12, 1, CHARCOAL);
  box(-3, 13, 0, -3, 15, 0, CHARCOAL);
  box(3, 13, 0, 3, 15, 0, CHARCOAL);
  box(-3, 16, 0, 3, 16, 0, CHARCOAL);
  return c.list();
}

function treehouse(color, big) {
  const c = new Cells();
  const up = big ? 8 : 6;
  const P = big ? 4 : 3;
  c.box(-1, 0, 0, 0, up - 1, 1, B.WOOD);
  c.box(-P, up, -P + 1, P - 1, up, P, B.PLANKS);
  // A hut on the platform, with a door, windows and a roof.
  const hx0 = -P + 1;
  const hx1 = P - 2;
  const hz0 = -P + 2;
  const hz1 = P - 1;
  c.walls(hx0, hz0, hx1, hz1, up + 1, up + 3, B.PLANKS);
  for (let y = up + 1; y <= up + 2; y++) c.remove(0, y, hz0);
  c.put(hx0, up + 2, 1, B.GLASS);
  c.put(hx1, up + 2, 1, B.GLASS);
  for (let k = 0; hx0 + k <= hx1 - k; k++) c.walls(hx0 + k - 1, hz0 - 1 + k, hx1 - k + 1, hz1 + 1 - k, up + 4 + k, up + 4 + k, brick(color));
  // Leaves round the back and top, and lanterns at the front corners.
  for (let x = -P - 1; x <= P; x++) {
    for (let z = 0; z <= P + 2; z++) {
      for (let y = up + 2; y <= up + 6 + (big ? 2 : 0); y++) {
        const d = Math.hypot(x + 0.5, (y - up - 4) * 1.4, z - P - 1);
        if (d < P + 0.5 && !c.map.has(`${x},${y},${z}`)) c.put(x, y, z, B.LEAVES);
      }
    }
  }
  c.put(-P, up + 1, -P + 1, B.LAMP);
  c.put(P - 1, up + 1, -P + 1, B.LAMP);
  // A lift up the front of the trunk, and steps to the side.
  c.put(-1, 0, -1, B.ELEVATOR);
  c.put(-1, up, -1, B.ELEVATOR);
  for (let k = 0; k < up; k++) c.put(P + up - 1 - k, k, 0, B.PLANKS);
  return c.list();
}

function maze(color, big, seed) {
  const c = new Cells();
  const n = big ? 7 : 5;
  const side = 2 * n + 1;
  const off = -n;
  const open = new Set();
  const rng = new Rng(seed);
  const stack = [[0, 0]];
  const seen = new Set(['0,0']);
  open.add('1,1');
  while (stack.length) {
    const [x, z] = stack.at(-1);
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, z + b, a, b]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !seen.has(`${a},${b}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [a, b, dx, dz] = next[Math.floor(rng.next() * next.length)];
    seen.add(`${a},${b}`);
    open.add(`${2 * x + 1 + dx},${2 * z + 1 + dz}`);
    open.add(`${2 * a + 1},${2 * b + 1}`);
    stack.push([a, b]);
  }
  // Ways in at the front and out at the back.
  open.add(`${n},0`);
  open.add(`${n},${side - 1}`);
  for (let x = 0; x < side; x++) {
    for (let z = 0; z < side; z++) {
      if (open.has(`${x},${z}`)) continue;
      const corner = (x === 0 || x === side - 1) && (z === 0 || z === side - 1);
      c.put(x + off, 0, z + off, B.LEAVES);
      c.put(x + off, 1, z + off, corner ? brick(color) : B.LEAVES);
      if (corner) c.put(x + off, 2, z + off, B.LAMP);
    }
  }
  // A star piece to find in the middle.
  c.put(0, 0, 0, brick(color));
  c.put(0, 1, 0, B.STAR_PIECE);
  return c.list();
}

const RAINBOW_KEYS = ['red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'pink'];

function ferrisWheel(color, big) {
  const c = new Cells();
  const R = big ? 7 : 5;
  const hub = R + 2;
  for (let x = -R - 1; x <= R + 1; x++) {
    for (let y = -R - 1; y <= R + 1; y++) {
      const d = Math.hypot(x, y);
      if (Math.abs(d - R) < 0.5) c.put(x, hub + y, 0, brick(color));
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    for (let t = 1; t < R; t++) c.put(Math.round(Math.cos(a) * t), hub + Math.round(Math.sin(a) * t), 0, WHITE);
    // A cabin hanging under each spoke's end.
    const x = Math.round(Math.cos(a) * R);
    const y = hub + Math.round(Math.sin(a) * R) - 1;
    for (const z of [-1, 1]) c.put(x, y, z, cloth(RAINBOW_KEYS[k]));
  }
  c.put(0, hub, 0, B.LAMP);
  // A frame each side, from the ground up to the hub.
  for (const z of [-2, 2]) {
    for (let y = 0; y <= hub; y++) {
      const spread = Math.round(((hub - y) / hub) * (R - 1));
      c.put(-spread, y, z, GRAY);
      c.put(spread, y, z, GRAY);
    }
    c.put(0, hub, Math.sign(z), GRAY);
  }
  return c.list();
}
function pyramid(color, big) {
  const c = new Cells();
  const L = big ? 7 : 5;
  for (let y = 0; y <= L; y++) {
    const r = L - y;
    const id = y === 0 ? brick(color) : RAINBOW[(y - 1) % RAINBOW.length];
    c.walls(-r, -r, r, r, y, y, id);
    // Hollow inside, with a way in.
    if (r > 1) c.walls(-r + 1, -r + 1, r - 1, r - 1, y, y, id);
  }
  for (let y = 0; y <= 1; y++) for (let k = 0; k <= 1; k++) c.remove(0, y, -L + k);
  c.put(0, 0, 0, B.LAMP);
  c.put(0, L + 1, 0, B.STAR_BLOCK);
  return c.list();
}

function trampolinePark(color, big) {
  const c = new Cells();
  const H = big ? 5 : 4;
  c.box(-H + 1, 0, -H + 1, H - 1, 0, H - 1, B.TRAMPOLINE);
  c.walls(-H, -H, H, H, 0, 1, brick(color));
  for (let x = -1; x <= 1; x++) for (let y = 0; y <= 1; y++) c.remove(x, y, -H);
  // A tower at the back to jump off, with steps up its side.
  const top = big ? 7 : 5;
  c.box(-1, 0, H + 1, 1, top, H + 3, brick(color));
  c.walls(-1, H + 1, 1, H + 3, top + 1, top + 1, WHITE);
  for (let k = 0; k < top; k++) c.put(2 + top - 1 - k, k, H + 2, B.PLANKS);
  c.put(0, top + 1, H + 1, B.LAMP);
  c.remove(0, top + 1, H + 1);
  c.put(-1, 2, -H, B.LAMP);
  c.put(1, 2, -H, B.LAMP);
  return c.list();
}

function cake(color, big) {
  const c = new Cells();
  const tiers = big ? [6, 4, 2] : [4, 3, 1];
  let y = 0;
  tiers.forEach((r, i) => {
    const h = i === tiers.length - 1 ? 2 : 3;
    for (let k = 0; k < h; k++) c.ring(0, 0, r, y + k, k === h - 1 ? B.FROSTING : i % 2 ? B.CHOCOLATE : B.COOKIE, true);
    // Coloured dots round the edge.
    c.ring(0, 0, r, y + 1, brick(color));
    for (let k = 0; k < h; k++) c.ring(0, 0, r - 1, y + k, k === h - 1 ? B.FROSTING : i % 2 ? B.CHOCOLATE : B.COOKIE, true);
    y += h;
  });
  // Candles on top.
  const top = tiers.at(-1);
  for (const [x, z] of top > 1 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[0, 0]]) {
    c.put(x, y, z, B.CANDY_CANE);
    c.put(x, y + 1, z, B.LAMP);
  }
  return c.list();
}

export const PROJECTS = [
  { key: 'castle', name: 'castle', icon: '🏰', about: 'a castle with towers, a gate and flags', make: castle },
  { key: 'lighthouse', name: 'lighthouse', icon: '🗼', about: 'a striped lighthouse with a lamp on top and a lift inside', make: lighthouse },
  { key: 'rocket', name: 'rocket', icon: '🚀', about: 'a rocket ready to fly to the stars', make: rocket },
  { key: 'statue', name: 'statue of itself', icon: '🤖', about: 'a giant statue of you, with headphones', make: robot },
  { key: 'treehouse', name: 'treehouse', icon: '🌳', about: 'a treehouse with a hut, a lift and steps', make: treehouse },
  { key: 'maze', name: 'hedge maze', icon: '🌿', about: 'a hedge maze with a star piece hidden in the middle', make: maze },
  { key: 'ferris-wheel', name: 'Ferris wheel', icon: '🎡', about: 'a Ferris wheel with rainbow cabins', make: ferrisWheel },
  { key: 'pyramid', name: 'rainbow pyramid', icon: '🔺', about: 'a rainbow pyramid with a glowing room inside', make: pyramid },
  { key: 'trampolines', name: 'trampoline park', icon: '🤸', about: 'a trampoline park with a tower to jump from', make: trampolinePark },
  { key: 'cake', name: 'birthday cake', icon: '🎂', about: 'a giant birthday cake with candles', make: cake },
];
export const PROJECT_KEYS = PROJECTS.map((p) => p.key);
export const projectByKey = (key) => PROJECTS.find((p) => p.key === key) ?? null;

// A project's cells, centred on 0, 0.
export function projectCells(key, color = 'red', big = false, seed = 1) {
  const p = projectByKey(key);
  return p ? p.make(COLORS.includes(color) ? color : 'red', big, seed) : [];
}

// How far from its middle a build reaches, in any direction along the ground.
export function reachOf(cells) {
  let r = 0;
  for (const [x, , z] of cells) r = Math.max(r, Math.abs(x), Math.abs(z));
  return r;
}

const MAX_BUMP = 3;
const SITE_STEP = 2;
// How high above the ground trees are cleared away.
const CLEAR_UP = 14;

// What clears away for a build: trees, flowers, fruit and grass.
export const clears = (id) => id !== B.AIR && (B.TREE_PART[id] === 1 || B.KIND[id] === B.K_PLANT || B.FRUIT_ITEMS.includes(id));

// The natural ground of a column under any trees and flowers, or -1 where it
// is anything else: water, sea, or something somebody built.
function groundOf(world, x, z) {
  for (let y = world.top(x, z); y > 0; y--) {
    const id = world.get(x, y, z);
    if (id === B.AIR || clears(id)) continue;
    return B.TERRAIN[id] && y > world.sea && !B.isWater(world.get(x, y + 1, z)) ? y : -1;
  }
  return -1;
}

// Open ground for something reaching r from its middle, near where everyone
// comes in but not in the way: natural ground in every column (trees and
// flowers clear away; never water or anything built), no more than a step
// or two up or down. Returns { x, z, r, base, facing } with its front
// towards that spot, or null when there is no room left.
export function findSite(world, r, { avoid = [], random = Math.random } = {}) {
  const { W, D } = world;
  const ground = new Int16Array(W * D);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) ground[x * D + z] = groundOf(world, x, z);
  const sp = world.spawn;
  const m = r + 1;
  const spots = [];
  for (let x = m; x < W - m; x += SITE_STEP) {
    for (let z = m; z < D - m; z += SITE_STEP) {
      const d = Math.hypot(x - sp.x, z - sp.z);
      if (d < r + 8 || avoid.some((a) => Math.hypot(x - a.x, z - a.z) < r + a.r + 3)) continue;
      spots.push({ x, z, d: d + random() * 8 });
    }
  }
  spots.sort((a, b) => a.d - b.d);
  for (const { x, z } of spots) {
    let lo = Infinity;
    let hi = -Infinity;
    let good = true;
    for (let dx = -m; dx <= m && good; dx++) {
      for (let dz = -m; dz <= m && good; dz++) {
        const g = ground[(x + dx) * D + (z + dz)];
        lo = Math.min(lo, g);
        hi = Math.max(hi, g);
        good = g >= 0 && hi - lo <= MAX_BUMP;
      }
    }
    if (!good) continue;
    // Its front towards where everyone comes in.
    const fx = sp.x - x;
    const fz = sp.z - z;
    const want = Math.abs(fx) > Math.abs(fz) ? [-Math.sign(fx), 0] : [0, -Math.sign(fz)];
    const facing = FACING.findIndex(({ f }) => f[0] === want[0] && f[1] === want[1]);
    return { x, z, r, base: hi + 1, facing };
  }
  return null;
}

// A build at a site, as the layers to put down one after another, each a
// flat list x, y, z, block as edits are. The first clears the trees and
// flowers off the site and fills the ground up level under it, with
// whatever that ground is.
export function layersAt(world, cells, site) {
  const placed = placeTemplate(cells, site.x, site.base, site.z, site.facing);
  const first = [];
  const m = site.r + 1;
  for (let x = site.x - m; x <= site.x + m; x++) {
    for (let z = site.z - m; z <= site.z + m; z++) {
      const g = groundOf(world, x, z);
      if (g < 0) continue;
      for (let y = g + 1; y < site.base + CLEAR_UP; y++) if (clears(world.get(x, y, z))) first.push(x, y, z, B.AIR);
      const id = world.get(x, g, z);
      for (let y = g + 1; y < site.base; y++) first.push(x, y, z, id);
    }
  }
  const rows = new Map();
  for (const [x, y, z, id] of placed) {
    if (!world.inBounds(x, y, z)) continue;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x, y, z, id);
  }
  const layers = [...rows.keys()].sort((a, b) => a - b).map((y) => rows.get(y));
  // Clearing and filling first, then the bottom layer over what was cleared.
  return first.length ? [first, ...layers] : layers;
}
