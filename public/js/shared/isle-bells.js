// The maps of the Golden Bells, the fourth episode of Adventure Isle's story
// (isle-story.js): Jinx the Magpie's Puzzle Isles. They are made as the
// isle's other maps are (isle-maps.js Maker: the lie of the land, then the
// ways, then what is built and what grows), but with no camps, no gates and
// no lair: each is an island to roam, its ways all starting from the square
// where everyone arrives, with the cage of its Golden Bell there (bellCage)
// and Jinx's challenges laid out about the island (isle-quests.js has their
// rules): shinies hidden all over (hideFinds), something tall to climb to a
// golden key (a climb winding up round it: helix), a patch of meadow for a
// monkey to run about, lost animals to lead into their pen, bonfires to
// light, a ring of Singing Stones, and on the last, Jinx's own nest.
//
// Everything of a challenge can be walked to from the start, and every
// climb climbed a step at a time (the tests walk every map to make sure).
// Each map returns its challenges, in its chapter's order, and its cage.
import * as B from './blocks.js';
import { walkReach } from './adventure.js';
import { lighthouse, palmTree, pier, windmill } from './isle-maps.js';
import { fbm } from './noise.js';
import { hash2 } from './rng.js';
import { fruitTree, oakTree, pineTree } from './stamps.js';

const [RED, ORANGE, YELLOW, LIME, GREEN, TEAL, SKY, BLUE, PURPLE, LAVENDER, PINK, WHITE, GRAY, CHARCOAL, BROWN, TAN] = B.TOY_BRICKS;
const CLOTH = B.CLOTHS;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
// A soft round hill: 1 in the middle, 0 at radius r and beyond.
const bump = (x, z, cx, cz, r) => smooth(1 - Math.hypot(x - cx, z - cz) / r);
const RING8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------------------------------------------------------------- the land

// An island of gentle hills (hills(x, z) over its base), shelving into the
// sea in beaches all round. shape: how far inside the island a point is (1
// in its middle, 0 on its coast), if not round.
function bellLand(m, { rim = 56, base = 3, hills = () => 1.5, shape = null, wiggle = 0.12 } = {}) {
  const { seed } = m;
  const SEA = m.sea;
  return (x, z) => {
    const n = fbm(seed + 11, x / 19, z / 19, 4) * wiggle;
    const edge = (shape ? shape(x, z) : 1 - Math.hypot(x - 64, z - 64) / rim) + n;
    const bed = SEA - 3 - Math.min(14, Math.max(0, -edge) * 70) + fbm(seed + 9, x / 9, z / 9, 2) * 0.6;
    if (edge <= 0) return bed;
    const ground = SEA + 0.6 + base * smooth(edge / 0.3) + hills(x, z);
    return lerp(bed, ground, smooth(edge / 0.12));
  };
}

// A level round patch for something at (x, z) (a cell), at the land's own
// height there or at y: { x, z, y } (y, the top of its ground). Kept clear
// of trees.
function site(m, height, x, z, r, { y = null, blend = 5 } = {}) {
  const level = y ?? Math.round(height(x, z));
  m.disc(x + 0.5, z + 0.5, r, level, blend, 2);
  return { x, z, y: level };
}

// A house (a stamp, stamps.js) at (x, z), its door facing (tx, tz), on
// ground levelled for it first and built once the land is blocks.
function house(m, height, x, z, tx, tz, key = 'house') {
  m.level(x, z, 5, 5, Math.round(height(x, z)), 3, 3);
  m.later(() => m.stamp(key, x, z, tx, tz));
}

// The way from one place to another (each { x, z }, and y to keep it level
// there), through the nodes between: a path, as Maker.route lays it.
const way = (m, nodes, opts = {}) => m.route(nodes.map((n) => (Number.isFinite(n.y) ? { x: n.x + 0.5, z: n.z + 0.5, y: n.y } : { x: n.x + 0.5, z: n.z + 0.5 })), { width: 1.5, slope: 0.55, ...opts });

// ---------------------------------------------------------------- the bell's cage

// The cage of the chapter's Golden Bell (the hub, adventure.js), on a stone
// footing round (cx, cz), its front facing (fx, fz) (one of the four ways):
// fence bars seven across and six high under a golden roof, the bell hanging
// inside, and before it, on the ground, a lock for each challenge in its
// colour (blocks.js ESCAPE_BUTTONS, lit once it is beaten). perch: whether
// Jinx sits on it. Returns the hub: { bell, locks, open (the edit that takes
// its front bars away), perch }.
function bellCage(m, cx, cz, fx, fz, count, perch = true) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  const R = 3;
  for (let dx = -R - 1; dx <= R + 1; dx++) {
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      for (let y = m.ground(x, z) + 1; y < y0; y++) world.set(x, y, z, B.STONE);
      world.set(x, y0, z, Math.max(Math.abs(dx), Math.abs(dz)) > R ? B.STONE : B.PLANKS);
      for (let y = y0 + 1; y <= y0 + 10; y++) world.set(x, y, z, B.AIR);
    }
  }
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      const ring = Math.max(Math.abs(dx), Math.abs(dz)) === R;
      const corner = Math.abs(dx) === R && Math.abs(dz) === R;
      if (ring) for (let y = 1; y <= 6; y++) world.set(x, y0 + y, z, corner ? B.WOOD : B.FENCE);
      world.set(x, y0 + 7, z, B.ESCAPE_TRIM);
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= 1) world.set(x, y0 + 8, z, B.ESCAPE_TRIM);
    }
  }
  // The bell: its crown hanging from the roof, its waist, its wide lip, and
  // the clapper under it.
  world.set(cx, y0 + 6, cz, B.ESCAPE_TRIM);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      world.set(cx + dx, y0 + 5, cz + dz, B.ESCAPE_TRIM);
      world.set(cx + dx, y0 + 4, cz + dz, B.ESCAPE_TRIM);
    }
  }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) < 4) world.set(cx + dx, y0 + 3, cz + dz, B.ESCAPE_TRIM);
  world.set(cx, y0 + 2, cz, CHARCOAL);
  // The locks, in a row across before it.
  const sx = -fz;
  const sz = fx;
  const locks = [];
  for (let i = 0; i < count; i++) {
    const o = Math.round((i - (count - 1) / 2) * 2);
    const x = cx + fx * (R + 3) + sx * o;
    const z = cz + fz * (R + 3) + sz * o;
    const y = m.ground(x, z) + 1;
    world.set(x, y, z, B.ESCAPE_BUTTONS[i]);
    world.set(x, y + 1, z, B.AIR);
    locks.push([x, y, z]);
  }
  const open = [];
  for (let o = -(R - 1); o <= R - 1; o++) for (let y = 1; y <= 6; y++) open.push(cx + fx * R + sx * o, y0 + y, cz + fz * R + sz * o, B.AIR);
  m.claim(cx + fx * 2, cz + fz * 2, R + 6, 3);
  return { bell: [cx, y0 + 3, cz], locks, open, perch: perch ? [cx, y0 + 9, cz] : null };
}

// ---------------------------------------------------------------- climbing

// Steps winding up round (cx, cz) — round whatever tall thing is built
// there — at radius r, from the ground at y0 up h blocks, a block higher
// every `tread` blocks along, of mat (wide: how many blocks out each step
// goes), and a landing all round at the top, out to `landing` from the
// middle. Every step is beside the one before (never only corner to
// corner), so it is climbed a step at a time. Returns the top of the
// landing (where someone stands on it) and the steps' cells, in order.
function helix(m, cx, cz, y0, { r, h, tread = 3, mat = B.PLANKS, start = 0, dir = 1, wide = 1, landing = r + wide, landingMat = mat, core = r - 1.6 }) {
  const { world } = m;
  if ((2 * Math.PI * r) / tread < 4) throw new Error('a helix too steep for the steps over each other');
  const steps = [];
  let last = null;
  const put = (x, z, y) => {
    if (last && last[0] === x && last[2] === z) return;
    if (last && last[0] !== x && last[2] !== z) steps.push([x, last[1], last[2]]);
    steps.push([x, y, z]);
    last = [x, y, z];
  };
  const length = h * tread;
  for (let s = 0; s <= length + 1e-6; s += 0.2) {
    const a = start + (dir * s) / r;
    put(Math.floor(cx + 0.5 + Math.cos(a) * r), Math.floor(cz + 0.5 + Math.sin(a) * r), y0 + Math.min(h, Math.floor(s / tread)));
  }
  const top = y0 + h;
  // The landing, with a stairwell left open in it where the last steps
  // come up under it (each needs room over it to stand, and over the one
  // before it to step up from); then the steps, and that room over each.
  const well = new Set(steps.filter(([, y]) => y < top && y >= top - 3).map(([x, , z]) => `${x},${z}`));
  for (let dx = -Math.ceil(landing); dx <= Math.ceil(landing); dx++) {
    for (let dz = -Math.ceil(landing); dz <= Math.ceil(landing); dz++) {
      if (Math.hypot(dx, dz) > landing + 0.3) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (well.has(`${x},${z}`)) continue;
      if (!B.SOLID[world.get(x, top, z)] || Math.hypot(dx, dz) > core) world.set(x, top, z, landingMat);
      if (Math.hypot(dx, dz) > core) for (let y = top + 1; y <= top + 3; y++) world.set(x, y, z, B.AIR);
    }
  }
  for (const [x, y, z] of steps) {
    world.set(x, y, z, mat);
    for (let k = 1; k < wide; k++) {
      const d = Math.hypot(x - cx, z - cz) || 1;
      const ox = Math.round(x + ((x - cx) / d) * k);
      const oz = Math.round(z + ((z - cz) / d) * k);
      if (!B.SOLID[world.get(ox, y, oz)] && !well.has(`${ox},${oz}`)) world.set(ox, y, oz, mat);
    }
  }
  for (const [x, y, z] of steps) for (let k = 1; k <= 3; k++) if (y + k <= top + 3) world.set(x, y + k, z, B.AIR);
  m.claim(cx + 0.5, cz + 0.5, Math.max(r + wide, landing) + 3, 3);
  return { top: top + 1, steps };
}

// The helix's height at angle a (where a climb is at that side), for
// putting what sticks out of a tall thing where the way is not.
const helixAt = (y0, { r, h, tread = 3, start = 0, dir = 1 }, a) => {
  let turn = ((a - start) * dir) % (Math.PI * 2);
  if (turn < 0) turn += Math.PI * 2;
  return y0 + Math.min(h, Math.floor((turn * r) / tread));
};

// The old wreck's mast (Bellbuoy Bay): a mast of wood with pegs winding up
// round it to the crow's nest at the top, railed all round, the golden key
// beside the mast; the wreck's hull lying on the sand beside it, and a flag
// on top. Returns the key's cell.
function mastClimb(m, cx, cz, y0, h) {
  const { world } = m;
  const plan = { r: 2.6, h, tread: 2, mat: B.PLANKS, start: Math.PI / 2, landing: 3.6, core: 1.1 };
  for (let y = y0 + 1; y <= y0 + h + 6; y++) for (const [dx, dz] of [[0, 0], ...SIDES]) world.set(cx + dx, y, cz + dz, dx || dz ? (y > y0 + h + 1 ? B.AIR : B.WOOD) : B.WOOD);
  const { top } = helix(m, cx, cz, y0, plan);
  // The crow's nest's rail, and the flag.
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (Math.hypot(dx, dz) > 3.7 && Math.hypot(dx, dz) <= 4.6) world.set(cx + dx, top - 1, cz + dz, B.PLANKS), world.set(cx + dx, top, cz + dz, B.FENCE);
  for (const [dx, dy] of [[1, 0], [2, 0], [1, -1], [2, -1], [3, -1]]) world.set(cx + dx, y0 + h + 6 + dy, cz, RED);
  // The wreck's hull, keeled over beside the mast on the seaward side.
  for (let l = -5; l <= 5; l++) {
    const half = 2.2 * Math.sqrt(Math.max(0, 1 - (l / 5.6) ** 2));
    for (let w = -Math.ceil(half); w <= Math.ceil(half); w++) {
      for (let y = 0; y <= 2; y++) {
        const rr = Math.hypot(w / Math.max(0.8, half), (y - 0.4) / 2.2);
        if (rr > 1 || (rr < 0.55 && l > -4 && l < 4)) continue;
        const x = cx - 8 + w;
        const z = cz + l;
        const g = m.ground(x, z);
        if (world.get(x, g + 1 + y, z) === B.AIR) world.set(x, g + 1 + y, z, (l + y) % 3 === 0 ? B.WOOD : B.PLANKS);
      }
    }
  }
  m.claim(cx - 8, cz, 7, 3);
  return goldKey(m, [cx + 2, top, cz]);
}

// The golden key put down at the top of a climb (blocks.js GOLD_KEY): returns its cell.
function goldKey(m, at) {
  m.world.set(at[0], at[1], at[2], B.GOLD_KEY);
  return at;
}

// The Teapot Tower (Topsy Gardens): a teapot as big as a house, white with
// pink spots, a spout out of one side and a handle on the other, with steps
// winding up round it to its lid, where the golden key sits by the knob.
// Returns the key's cell.
function teapotClimb(m, cx, cz, y0, h) {
  const { world } = m;
  const plan = { r: 6.6, h, tread: 3, mat: PINK, start: Math.PI / 2, landing: 6.2, landingMat: WHITE, core: 5.4 };
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = Math.hypot(dx, dz);
      for (let y = 1; y < h; y++) {
        // Round-shouldered: narrower at the foot and the top.
        const rr = 5.4 - (y <= 1 ? 0.8 : 0) - (y >= h - 2 ? (y - (h - 3)) * 0.7 : 0);
        if (d <= rr) world.set(cx + dx, y0 + y, cz + dz, (dx * 3 + dz * 5 + y * 7) % 11 === 0 ? PINK : WHITE);
      }
    }
  }
  const { top } = helix(m, cx, cz, y0, plan);
  // The lid's knob.
  world.set(cx, top, cz, PINK);
  world.set(cx, top + 1, cz, PINK);
  // The spout, where the way passes high over it; the handle, where it is low.
  const spoutA = Math.PI * 1.25;
  const handleA = spoutA + Math.PI;
  const under = helixAt(y0, plan, spoutA);
  for (let l = 6; l <= 10; l++) {
    const x = Math.round(cx + Math.cos(spoutA) * l);
    const z = Math.round(cz + Math.sin(spoutA) * l);
    const y = Math.min(under - 3, y0 + 2 + Math.round((l - 6) * 0.8));
    if (y > y0) for (const dy of [0, 1]) if (!B.SOLID[world.get(x, y + dy, z)]) world.set(x, y + dy, z, WHITE);
  }
  const over = helixAt(y0, plan, handleA);
  for (let k = 0; k <= 8; k++) {
    const t = (k / 8) * Math.PI;
    const l = 6 + Math.sin(t) * 3;
    const x = Math.round(cx + Math.cos(handleA) * l);
    const z = Math.round(cz + Math.sin(handleA) * l);
    const y = Math.max(over + 4, y0 + 4) + Math.round(Math.cos(t) * 2.5) + 2;
    if (y < top - 1 && !B.SOLID[world.get(x, y, z)]) world.set(x, y, z, WHITE);
  }
  return goldKey(m, [cx + 2, top, cz]);
}

// Kite Peak (Kite Cliffs): a crag of rock, rough-sided, with a ledge two
// wide winding up round it to the top, a kite tied to a post up there. The
// golden key at the top. Returns its cell.
function peakClimb(m, cx, cz, y0, h) {
  const { world, seed } = m;
  const plan = { r: 6.2, h, tread: 2.6, wide: 2, mat: B.STONE, start: 0, landing: 6.5, landingMat: B.STONE, core: 4.8 };
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = Math.hypot(dx, dz);
      for (let y = 1; y < h; y++) {
        const rr = 4.6 + hash2(seed + 41, dx * 7 + y, dz) * 0.6 - (y > h - 3 ? 0.6 : 0);
        if (d <= rr) world.set(cx + dx, y0 + y, cz + dz, hash2(seed + 43, cx + dx, cz + dz + y) < 0.15 ? GRAY : B.STONE);
      }
    }
  }
  const { top } = helix(m, cx, cz, y0, plan);
  for (let y = top; y <= top + 2; y++) world.set(cx, y, cz, B.WOOD);
  // A kite on the wind, tied to the post: a diamond of cloth up and away.
  kite(m, cx + 4, top + 7, cz + 3, 0);
  return goldKey(m, [cx + 1, top, cz + 1]);
}

// The Nest Tree (the Magpie's Nest): a great tree with branches winding up
// round its trunk like a stair, a platform up in its crown and leaves all
// over the top. Returns the golden key's cell.
function nestTreeClimb(m, cx, cz, y0, h) {
  const { world } = m;
  const plan = { r: 3.7, h, tread: 2.4, mat: B.WOOD, start: Math.PI, landing: 4.4, landingMat: B.PLANKS, core: 2.2 };
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.hypot(dx, dz) <= 2.2) for (let y = 1; y < h; y++) world.set(cx + dx, y0 + y, cz + dz, B.WOOD);
  const { top } = helix(m, cx, cz, y0, plan);
  // Its crown, high over the platform.
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      for (let dy = 0; dy <= 5; dy++) {
        const d = Math.hypot(dx / 6, dz / 6, (dy - 2) / 3.2);
        if (d <= 1 && !B.SOLID[world.get(cx + dx, top + 3 + dy, cz + dz)]) world.set(cx + dx, top + 3 + dy, cz + dz, B.LEAVES);
      }
    }
  }
  // The trunk on up through the crown.
  for (let y = top; y <= top + 4; y++) world.set(cx, y, cz, B.WOOD);
  return goldKey(m, [cx + 2, top, cz]);
}

// A kite up in the wind (decoration): a diamond of two colours.
function kite(m, cx, cy, cz, turn = 0) {
  const { world } = m;
  for (let u = -2; u <= 2; u++) {
    for (let v = -3; v <= 3; v++) {
      if (Math.abs(u) / 2 + Math.abs(v) / 3 > 1) continue;
      const x = cx + (turn ? 0 : u);
      const z = cz + (turn ? u : 0);
      if (world.inBounds(x, cy + v, z) && world.get(x, cy + v, z) === B.AIR) world.set(x, cy + v, z, (u > 0) === (v > 0) ? CLOTH[0] : CLOTH[3]);
    }
  }
}

// ---------------------------------------------------------------- fires, pens, stones

// A bonfire on the ground at (x, z): a ring of stones round a pile of logs,
// which a challenge lights (into a campfire: isle-quests.js). high: up on a
// stone plinth three across, that high (a beacon). Returns its fire's cell.
function bonfire(m, x, z, high = 0) {
  const { world } = m;
  const y = m.ground(x, z);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let yy = y + 1; yy <= y + high + 4; yy++) world.set(x + dx, yy, z + dz, B.AIR);
  if (high) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let k = 1; k <= high; k++) world.set(x + dx, y + k, z + dz, B.STONE);
  } else {
    for (const [dx, dz] of RING8) world.set(x + dx, y + 1, z + dz, GRAY);
  }
  world.set(x, y + high + 1, z, B.LOGS);
  m.claim(x + 0.5, z + 0.5, 4, 3);
  return [x, y + high + 1, z];
}

// How long a bonfire burns once lit (seconds), so that someone by themselves,
// lighting one and walking on to the rest the shortest way round, finds the
// first still burning as they light the last, with time to spare.
export function burnFor(fires, slack = 12) {
  const order = (list) => (list.length <= 1 ? [list] : list.flatMap((v, i) => order([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [v, ...p])));
  let best = Infinity;
  for (const p of order(fires.map((_, i) => i))) {
    let d = 0;
    for (let i = 1; i < p.length; i++) d += Math.hypot(fires[p[i]][0] - fires[p[i - 1]][0], fires[p[i]][2] - fires[p[i - 1]][2]);
    best = Math.min(best, d);
  }
  return Math.ceil((best * 1.6) / 4.6 + slack);
}

// A pen (a coop, or a fold) round (cx, cz): fence round it, its way in
// three wide on the side (fx, fz), hay in the back corners and, for a coop,
// a little hen house. Returns where home is ({ x, y, z, r }: inside the
// fence) and the places in it each animal settles in.
function pen(m, cx, cz, fx, fz, { half = 4, coop = true } = {}) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  const sx = -fz;
  const sz = fx;
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      for (let y = m.ground(x, z) + 1; y < y0; y++) world.set(x, y, z, B.DIRT);
      world.set(x, y0, z, m.pal.top);
      for (let y = y0 + 1; y <= y0 + 4; y++) world.set(x, y, z, B.AIR);
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== half) continue;
      // The way in: the middle three of the front side.
      const front = dx * fx + dz * fz === half;
      const across = dx * sx + dz * sz;
      if (front && Math.abs(across) <= 1) continue;
      world.set(x, y0 + 1, z, B.FENCE);
    }
  }
  const back = (k) => [cx - fx * (half - 1) + sx * k, cz - fz * (half - 1) + sz * k];
  const [hx, hz] = back(-(half - 1));
  world.set(hx, y0 + 1, hz, B.HAY);
  const [qx, qz] = back(half - 1);
  if (coop) {
    // The hen house: planks, a red roof.
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= 1; j++) {
        const x = qx - sx * i - fx * j;
        const z = qz - sz * i - fz * j;
        world.set(x, y0 + 1, z, B.PLANKS);
        world.set(x, y0 + 2, z, j === 0 && i === 0 ? B.GLASS : B.PLANKS);
        world.set(x, y0 + 3, z, RED);
      }
    }
  } else {
    world.set(qx, y0 + 1, qz, B.HAY);
  }
  const slots = [];
  for (let dx = -(half - 2); dx <= half - 2; dx++) for (let dz = -(half - 2); dz <= half - 2; dz++) if ((dx + dz) % 2 === 0 && world.get(cx + dx, y0 + 1, cz + dz) === B.AIR) slots.push([cx + dx, y0 + 1, cz + dz]);
  m.claim(cx + 0.5, cz + 0.5, half + 3, 3);
  return { home: { x: cx + 0.5, y: y0 + 1, z: cz + 0.5, r: half - 0.6 }, slots };
}

// A ring of Singing Stones round (cx, cz): a golden middle stone, and four
// stones three across round it, red, yellow, green and blue (blocks.js
// STAR_TILES), each with a standing stone behind it, a stripe of its colour
// on top. Returns the challenge's stones (isle-quests.js stones).
function singingStones(m, cx, cz) {
  const { world } = m;
  const y = m.ground(cx, cz);
  for (let dx = -9; dx <= 9; dx++) for (let dz = -9; dz <= 9; dz++) for (let yy = y + 1; yy <= y + 4; yy++) if (Math.hypot(dx, dz) <= 9) world.set(cx + dx, yy, cz + dz, B.AIR);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + dx, y, cz + dz, B.ESCAPE_TRIM);
  const pads = [];
  const COLOURS = [RED, YELLOW, GREEN, BLUE];
  for (const [i, [ox, oz]] of [[0, -5], [5, 0], [0, 5], [-5, 0]].entries()) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + ox + dx, y, cz + oz + dz, B.STAR_TILES[i]);
    pads.push([cx + ox, y + 1, cz + oz]);
    const sx = cx + Math.sign(ox) * 8;
    const sz = cz + Math.sign(oz) * 8;
    for (let k = 1; k <= 2; k++) world.set(sx, y + k, sz, B.STONE);
    world.set(sx, y + 3, sz, COLOURS[i]);
  }
  m.claim(cx + 0.5, cz + 0.5, 10, 3);
  return { x: cx, y: y + 1, z: cz, start: [cx, y + 1, cz], pads };
}

// A hedge maze, n by n of its rooms (two blocks of way and a block of hedge
// each), round (cx, cz), its way in on the side (fx, fz): every room joined
// to every other by exactly one way (a maze dug as a random walk that goes
// back on itself when stuck). Returns its bounds, for what is hidden in it.
function hedgeMaze(m, cx, cz, n, fx, fz) {
  const { world, rng } = m;
  const size = n * 3 + 1;
  const x0 = cx - Math.floor(size / 2);
  const z0 = cz - Math.floor(size / 2);
  const y = m.ground(cx, cz);
  const open = new Uint8Array(size * size);
  const at = (i, j) => i * size + j;
  const room = (a, b) => [1 + a * 3, 1 + b * 3];
  const seen = new Uint8Array(n * n);
  const stack = [[Math.floor(n / 2), Math.floor(n / 2)]];
  seen[stack[0][0] * n + stack[0][1]] = 1;
  const carve = (a, b) => {
    const [i, j] = room(a, b);
    for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) open[at(i + di, j + dj)] = 1;
  };
  carve(...stack[0]);
  while (stack.length) {
    const [a, b] = stack.at(-1);
    const next = SIDES.map(([da, db]) => [a + da, b + db, da, db]).filter(([na, nb]) => na >= 0 && nb >= 0 && na < n && nb < n && !seen[na * n + nb]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [na, nb, da, db] = next[Math.floor(rng.next() * next.length)];
    seen[na * n + nb] = 1;
    carve(na, nb);
    // The hedge between knocked through.
    const [i, j] = room(a, b);
    for (let k = 0; k < 2; k++) {
      if (da) open[at(i + (da > 0 ? 2 : -1), j + k)] = 1;
      else open[at(i + k, j + (db > 0 ? 2 : -1))] = 1;
    }
    stack.push([na, nb]);
  }
  // The way in, in the middle of the side facing (fx, fz), and a way out
  // on the far side.
  const mid = Math.floor(n / 2);
  for (const s of [1, -1]) {
    const [i, j] = room(fx * s > 0 ? n - 1 : fx * s < 0 ? 0 : mid, fz * s > 0 ? n - 1 : fz * s < 0 ? 0 : mid);
    for (let k = 0; k < 2; k++) {
      if (fx) open[at(fx * s > 0 ? size - 1 : 0, j + k)] = 1;
      else open[at(i + k, fz * s > 0 ? size - 1 : 0)] = 1;
    }
  }
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = x0 + i;
      const z = z0 + j;
      world.set(x, y, z, open[at(i, j)] ? B.GRASS : B.DIRT);
      for (let k = 1; k <= 4; k++) world.set(x, y + k, z, !open[at(i, j)] && k <= 3 ? B.LEAVES : B.AIR);
    }
  }
  m.claim(cx + 0.5, cz + 0.5, size / 2 + 2, 3);
  return { x0, z0, x1: x0 + size - 1, z1: z0 + size - 1, y };
}

// ---------------------------------------------------------------- hiding and placing

// Where on the island can be walked to from the start (Maker spawn: the
// first way's first point), once everything is built.
function reachable(m) {
  const p = m.routes[0].pts[0];
  const x = Math.floor(p.x);
  const z = Math.floor(p.z);
  return walkReach(m.world, [[x + 0.5, m.ground(x, z) + 1, z + 0.5]]);
}
const walkedTo = (m, reach, x, y, z) => reach[(x * m.world.D + z) * m.world.H + y] === 1;

// Shinies (or golden eggs: block) for a finds challenge, count of them, on
// ground that can be walked to from the start (reach), off the paths, each
// tucked in somewhere — beside a tree, a wall or a rock, under a roof or a
// crown — rather than out in the open, as far apart as can be and not by
// the start. where(x, z): where they may be. Returns their cells.
function hideFinds(m, reach, count, { block = B.TRINKET, where = () => true, apart = 18 } = {}) {
  const { world, seed } = m;
  const start = m.routes[0].pts[0];
  const spots = [];
  for (let x = 3; x < m.S - 3; x++) {
    for (let z = 3; z < m.S - 3; z++) {
      if (m.keep[m.k(x, z)] === 1 || !where(x, z) || Math.hypot(x - start.x, z - start.z) < 14) continue;
      const y = m.ground(x, z) + 1;
      if (y <= m.sea + 1 || !walkedTo(m, reach, x, y, z)) continue;
      const here = world.get(x, y, z);
      if (here !== B.AIR && B.KIND[here] !== B.K_PLANT) continue;
      let tucked = 0;
      for (const [dx, dz] of RING8) for (const dy of [0, 1]) if (B.SOLID[world.get(x + dx, y + dy, z + dz)]) tucked++;
      for (let dy = 2; dy <= 5; dy++) if (B.SOLID[world.get(x, y + dy, z)]) {
        tucked += 3;
        break;
      }
      spots.push({ x, y, z, score: Math.min(tucked, 8) + hash2(seed + 131, x, z) * 3 });
    }
  }
  spots.sort((a, b) => b.score - a.score);
  const picked = [];
  for (let gap = apart; picked.length < count && gap >= 4; gap -= 3) {
    for (const s of spots) {
      if (picked.length >= count) break;
      if (picked.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < gap)) continue;
      picked.push(s);
    }
  }
  for (const s of picked) world.set(s.x, s.y, s.z, block);
  return picked.map((s) => [s.x, s.y, s.z]);
}

// Where lost animals are found, count of them: on open ground that can be
// walked to from the start, far from their pen (home) and from each other.
function strays(m, reach, count, home, { where = () => true, far = 18 } = {}) {
  const { world, seed } = m;
  const start = m.routes[0].pts[0];
  const spots = [];
  for (let x = 4; x < m.S - 4; x += 2) {
    for (let z = 4; z < m.S - 4; z += 2) {
      if (m.keep[m.k(x, z)] === 1 || m.keep[m.k(x, z)] === 3 || !where(x, z)) continue;
      if (Math.hypot(x - home.x, z - home.z) < far || Math.hypot(x - start.x, z - start.z) < 12) continue;
      const y = m.ground(x, z) + 1;
      if (y <= m.sea + 1 || !walkedTo(m, reach, x, y, z) || B.SOLID[world.get(x, y, z)] || B.SOLID[world.get(x, y + 1, z)]) continue;
      spots.push({ x, y, z, j: hash2(seed + 151, x, z) });
    }
  }
  // As far apart as can be: each the one furthest from those picked so far
  // (and from home), give or take a little.
  const picked = [];
  for (let i = 0; i < count && spots.length; i++) {
    let best = null;
    let bestD = -1;
    for (const s of spots) {
      let d = Math.hypot(s.x - home.x, s.z - home.z) * 0.6;
      for (const p of picked) d = Math.min(d, Math.hypot(s.x - p.x, s.z - p.z));
      d += s.j * 4;
      if (d > bestD) {
        bestD = d;
        best = s;
      }
    }
    picked.push(best);
  }
  return picked.map((s) => [s.x, s.y, s.z]);
}

// Trees of the chapter's kinds where pick(x, z, y, rng) says, on open
// ground (Maker.trees), off the ways, the challenges and the cage.
function grow(m, tries, apart, pick) {
  m.trees(tries, apart, (x, z, y, rng) => pick(m.world.get(x, y, z), x, z, y, rng), 2);
}

// A bell buoy out in the bay (decoration): a red and white float with a
// lamp on top, standing up out of the water.
function bellBuoy(m, x, z) {
  const { world } = m;
  let y = m.sea;
  while (y > 1 && !B.SOLID[world.get(x, y - 1, z)]) y--;
  for (let k = y; k <= m.sea + 3; k++) for (const [dx, dz] of [[0, 0], ...SIDES]) if (k <= m.sea + 1 || !(dx || dz)) world.set(x + dx, k, z + dz, k <= m.sea ? RED : k === m.sea + 1 ? WHITE : RED);
  world.set(x, m.sea + 4, z, B.LAMP);
}

// ---------------------------------------------------------------- Bellbuoy Bay

// Chapter 1: a round sunny island with a bay bitten out of its south side,
// a bell buoy bobbing in it. Everyone lands on the bay's beach and comes up
// to the village square, where the first bell's cage stands. The old wreck
// lies on the west shore with its mast still standing; Coco the monkey has
// the palm grove on the east side; a lookout hill in the north; and five
// shinies scattered about.
export function bellbuoy(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.PEBBLES;
  const shape = (x, z) => 1 - Math.hypot((x - 64) / 56, (z - 64) / 54) - 0.75 * bump(x, z, 64, 114, 22);
  const height = bellLand(m, { shape, base: 3, hills: (x, z) => 1.2 + fbm(seed + 23, x / 22, z / 22, 4) * 1.4 + bump(x, z, 60, 30, 26) * 5 });
  m.shape(height);
  const spawn = { x: 64, z: 99 };
  const plaza = site(m, height, 64, 89, 8);
  const cage = site(m, height, 53, 86, 6, { y: plaza.y });
  const mast = site(m, height, 24, 76, 6);
  const grove = site(m, height, 98, 58, 12, { blend: 8 });
  const lookout = site(m, height, 58, 30, 5);
  for (const [hx, hz] of [[78, 80], [80, 97], [47, 102]]) house(m, height, hx, hz, plaza.x, plaza.z);
  way(m, [spawn, plaza, { x: 50, z: 92 }, { x: 36, z: 84 }, mast]);
  way(m, [plaza, { x: 72, z: 72 }, { x: 86, z: 62 }, grove]);
  way(m, [plaza, { x: 62, z: 74 }, { x: 54, z: 58 }, { x: 56, z: 42 }, lookout]);
  m.finish();
  const { world } = m;
  const hub = bellCage(m, cage.x, cage.z, 1, 0, 3);
  const key = mastClimb(m, mast.x, mast.z, mast.y, 13);
  bellBuoy(m, 64, 116);
  pier(m, 76, 106, 0, 1, 8);
  lighthouse(m, 58, 24);
  // Palms round the grove, and a few in it for a monkey to run round.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const d = i % 3 === 0 ? 5 : 11;
    const x = Math.round(grove.x + Math.cos(a) * d);
    const z = Math.round(grove.z + Math.sin(a) * d);
    const y = m.ground(x, z);
    if (y > SEA && world.get(x, y + 1, z) === B.AIR) for (const [cx, cy, cz, id] of palmTree(m.rng)) if (world.inBounds(x + cx, y + 1 + cy, z + cz) && !B.SOLID[world.get(x + cx, y + 1 + cy, z + cz)]) world.set(x + cx, y + 1 + cy, z + cz, id);
  }
  grow(m, 900, 7, (top, x, z, y, rng) => {
    if (top === B.SAND) return rng.chance(0.4) ? palmTree(rng) : null;
    if (fbm(seed + 53, x / 16, z / 16, 2) < 0 && rng.chance(0.85)) return null;
    return rng.chance(0.3) ? fruitTree(rng, B.FRUIT_ITEMS[2], rng.int(2, 3)) : oakTree(rng, rng.chance(0.2));
  });
  m.flowers(40);
  const reach = reachable(m);
  const finds = { kind: 'finds', x: 64, y: plaza.y + 1, z: 64, spots: hideFinds(m, reach, 5) };
  return {
    fruit: B.FRUIT_ITEMS[2],
    hub,
    quests: [finds, { kind: 'climb', x: key[0], y: key[1], z: key[2], at: key }, { kind: 'chase', x: grove.x, y: grove.y + 1, z: grove.z, r: 13, catches: 1, pace: 1 }],
  };
}

// ---------------------------------------------------------------- Henhouse Hills

// Chapter 2: a farm on rolling hills, the farmyard square in the south with
// the second bell's cage, the chicks' coop beside it, a windmill on the west
// side and three round hills to the north, a bonfire on top of each; the
// golden eggs hidden all over, and the lost chicks too.
export function henhouse(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.DIRT;
  const tops = [[32, 44], [64, 26], [97, 44]];
  const hills = (x, z) => 1 + fbm(seed + 29, x / 20, z / 20, 4) * 1.2 + tops.reduce((h, [hx, hz]) => h + bump(x, z, hx, hz, 22) * 9, 0);
  const height = bellLand(m, { rim: 57, base: 3, hills });
  m.shape(height);
  const spawn = { x: 64, z: 106 };
  const plaza = site(m, height, 64, 96, 8);
  const cage = site(m, height, 53, 93, 6, { y: plaza.y });
  const coop = site(m, height, 88, 92, 7);
  const mill = site(m, height, 36, 84, 6);
  const fires = tops.map(([x, z]) => site(m, height, x, z, 4));
  way(m, [spawn, plaza, { x: 74, z: 92 }, { x: 82, z: 92 }]);
  way(m, [plaza, { x: 50, z: 82 }, { x: 40, z: 62 }, fires[0]]);
  way(m, [plaza, { x: 64, z: 74 }, { x: 64, z: 48 }, fires[1]]);
  way(m, [{ x: 74, z: 92 }, { x: 80, z: 82 }, { x: 92, z: 70 }, { x: 96, z: 56 }, fires[2]]);
  way(m, [{ x: 50, z: 82 }, { x: 42, z: 84 }, mill]);
  m.finish();
  const { world } = m;
  const hub = bellCage(m, cage.x, cage.z, 1, 0, 3);
  const { home, slots } = pen(m, coop.x, coop.z, -1, 0);
  windmill(m, mill.x, mill.z, 0, 1);
  // Hay bales about the fields.
  for (let i = 0; i < 14; i++) {
    const x = 14 + Math.floor(hash2(seed + 71, i, 1) * 100);
    const z = 14 + Math.floor(hash2(seed + 71, i, 2) * 100);
    const y = m.ground(x, z);
    if (y <= SEA + 1 || m.keep[m.k(x, z)] || world.get(x, y + 1, z) !== B.AIR) continue;
    world.set(x, y + 1, z, B.HAY);
    if (hash2(seed + 71, i, 3) < 0.5 && world.get(x + 1, y + 1, z) === B.AIR && m.ground(x + 1, z) === y) world.set(x + 1, y + 1, z, B.HAY);
    m.claim(x + 0.5, z + 0.5, 1.5, 3);
  }
  const lit = fires.map((f) => bonfire(m, f.x, f.z));
  grow(m, 1400, 6, (top, x, z, y, rng) => {
    if (top !== m.pal.top) return null;
    return rng.chance(0.35) ? fruitTree(rng, B.FRUIT_ITEMS[0], rng.int(2, 4)) : oakTree(rng, rng.chance(0.25));
  });
  m.flowers(46);
  const reach = reachable(m);
  const eggs = hideFinds(m, reach, 6, { block: B.GOLD_EGG });
  const chicks = strays(m, reach, 5, home);
  return {
    fruit: B.FRUIT_ITEMS[0],
    hub,
    quests: [
      { kind: 'lead', animal: 'chick', x: coop.x, y: home.y, z: coop.z, home, slots, spots: chicks },
      { kind: 'fires', x: fires[1].x, y: fires[1].y + 1, z: fires[1].z, fires: lit, burn: burnFor(lit) },
      { kind: 'finds', x: 64, y: plaza.y + 1, z: 70, spots: eggs },
    ],
  };
}

// ---------------------------------------------------------------- Topsy Gardens

// Chapter 3: a garden island, flat and trim, an avenue running north from
// the square where everyone arrives (the third bell's cage beside it) past
// the fountain to the Teapot Tower; the hedge maze off to the west, the ring
// of Singing Stones to the east, and Kiki's lawn of clipped bushes in the
// north-east.
export function topsy(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.PEBBLES;
  const height = bellLand(m, { rim: 57, base: 3, hills: (x, z) => 1 + fbm(seed + 31, x / 26, z / 26, 3) * 0.9 });
  m.shape(height);
  const spawn = { x: 64, z: 108 };
  const plaza = site(m, height, 64, 98, 8);
  const cage = site(m, height, 53, 95, 6, { y: plaza.y });
  const fountain = site(m, height, 64, 78, 6);
  const mazeAt = { x: 30, z: 62 };
  m.level(mazeAt.x + 0.5, mazeAt.z + 0.5, 13, 13, Math.round(height(mazeAt.x, mazeAt.z)), 5, 2);
  const stonesAt = site(m, height, 97, 66, 10);
  const teapot = site(m, height, 64, 34, 9);
  const lawn = site(m, height, 97, 31, 13, { blend: 7 });
  way(m, [spawn, plaza, fountain, { x: 64, z: 56 }, { x: 64, z: 46 }]);
  way(m, [fountain, { x: 50, z: 70 }, { x: 45, z: 62 }]);
  way(m, [fountain, { x: 80, z: 70 }, { x: 86, z: 67 }]);
  way(m, [{ x: 64, z: 56 }, { x: 78, z: 46 }, { x: 88, z: 38 }]);
  m.finish();
  const { world } = m;
  const hub = bellCage(m, cage.x, cage.z, 1, 0, 4);
  m.stamp('fountain', fountain.x, fountain.z, plaza.x, plaza.z);
  const maze = hedgeMaze(m, mazeAt.x, mazeAt.z, 7, 1, 0);
  const stones = singingStones(m, stonesAt.x, stonesAt.z);
  const key = teapotClimb(m, teapot.x, teapot.z, teapot.y, 12);
  // Kiki's lawn: clipped bushes dotted about it, round as balls on top.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const d = i % 2 ? 8 : 5;
    const x = Math.round(lawn.x + Math.cos(a) * d);
    const z = Math.round(lawn.z + Math.sin(a) * d);
    const y = m.ground(x, z);
    for (let k = 1; k <= 2; k++) world.set(x, y + k, z, B.LEAVES);
  }
  // Rows of tulips along the avenue.
  for (let z = 44; z <= 92; z++) {
    for (const x of [60, 68]) {
      const y = m.ground(x, z);
      if (m.keep[m.k(x, z)] !== 1 && world.get(x, y, z) === m.pal.top && world.get(x, y + 1, z) === B.AIR && (z % 6 !== 0)) world.set(x, y + 1, z, z % 3 ? B.TULIP : B.COSMOS);
    }
  }
  grow(m, 1200, 7, (top, x, z, y, rng) => {
    if (top !== m.pal.top || (x > maze.x0 - 4 && x < maze.x1 + 4 && z > maze.z0 - 4 && z < maze.z1 + 4)) return null;
    return rng.chance(0.4) ? fruitTree(rng, B.FRUIT_ITEMS[3], rng.int(2, 4)) : oakTree(rng, rng.chance(0.3));
  });
  m.flowers(60);
  const reach = reachable(m);
  const inMaze = (x, z) => x > maze.x0 && x < maze.x1 && z > maze.z0 && z < maze.z1;
  const shinies = hideFinds(m, reach, 5, { where: inMaze, apart: 7 });
  return {
    fruit: B.FRUIT_ITEMS[3],
    hub,
    quests: [
      { kind: 'stones', ...stones, rounds: 3 },
      { kind: 'finds', x: mazeAt.x, y: maze.y + 1, z: mazeAt.z, spots: shinies },
      { kind: 'chase', x: lawn.x, y: lawn.y + 1, z: lawn.z, r: 13, catches: 2, pace: 2 },
      { kind: 'climb', x: key[0], y: key[1], z: key[2], at: key },
    ],
  };
}

// ---------------------------------------------------------------- Kite Cliffs

// Chapter 4: a high, windy island, its ground rising to the north into a
// plateau with Kite Peak, a crag of rock, standing up out of it; the Wind
// Stones on a shoulder to the north-east, four beacons on the heights round
// the rim, the sheep's fold in the south-west by the square where everyone
// arrives, and kites in the sky.
export function kiteCliffs(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.PEBBLES;
  const hills = (x, z) => 1.4 + fbm(seed + 37, x / 18, z / 18, 4) * 1.6 + bump(x, z, 40, 36, 34) * 10 + bump(x, z, 90, 40, 26) * 6 + bump(x, z, 64, 64, 30) * 3;
  const height = bellLand(m, { rim: 57, base: 3.5, hills });
  m.shape(height);
  const spawn = { x: 64, z: 107 };
  const plaza = site(m, height, 64, 97, 8);
  const cage = site(m, height, 75, 94, 6, { y: plaza.y });
  const fold = site(m, height, 40, 90, 7);
  const peak = site(m, height, 38, 34, 9);
  const stonesAt = site(m, height, 90, 42, 10);
  const beacons = [[17, 62], [38, 22], [88, 22], [110, 64]].map(([x, z]) => site(m, height, x, z, 3));
  way(m, [spawn, plaza, { x: 62, z: 80 }, { x: 52, z: 62 }, { x: 44, z: 46 }, peak]);
  way(m, [plaza, { x: 52, z: 94 }, { x: 46, z: 90 }]);
  way(m, [{ x: 62, z: 80 }, { x: 78, z: 62 }, { x: 86, z: 52 }, stonesAt]);
  way(m, [{ x: 52, z: 62 }, { x: 30, z: 60 }, beacons[0]]);
  way(m, [peak, { x: 34, z: 24 }, beacons[1]]);
  way(m, [stonesAt, { x: 90, z: 26 }, beacons[2]]);
  way(m, [stonesAt, { x: 104, z: 52 }, beacons[3]]);
  m.finish();
  const { world } = m;
  const hub = bellCage(m, cage.x, cage.z, -1, 0, 4);
  const { home, slots } = pen(m, fold.x, fold.z, 1, 0, { coop: false });
  const key = peakClimb(m, peak.x, peak.z, peak.y, 18);
  const stones = singingStones(m, stonesAt.x, stonesAt.z);
  const lit = beacons.map((b) => bonfire(m, b.x, b.z, 2));
  kite(m, 70, plaza.y + 22, 70, 0);
  kite(m, 100, plaza.y + 26, 82, 1);
  kite(m, 24, plaza.y + 25, 86, 0);
  grow(m, 1300, 6, (top, x, z, y, rng) => {
    if (top !== m.pal.top) return null;
    return y > SEA + 10 ? (rng.chance(0.5) ? pineTree(rng) : null) : rng.chance(0.5) ? oakTree(rng, rng.chance(0.2)) : null;
  });
  m.flowers(40);
  const reach = reachable(m);
  const sheep = strays(m, reach, 5, home);
  return {
    fruit: B.FRUIT_ITEMS[1],
    hub,
    quests: [
      { kind: 'climb', x: key[0], y: key[1], z: key[2], at: key },
      { kind: 'fires', x: 64, y: peak.y + 1, z: 40, fires: lit, burn: burnFor(lit) },
      { kind: 'stones', ...stones, rounds: 4 },
      { kind: 'lead', animal: 'sheep', x: fold.x, y: home.y, z: fold.z, home, slots, spots: sheep },
    ],
  };
}

// ---------------------------------------------------------------- the Magpie's Nest

// Chapter 5, the last: a rocky island with a great crag in the middle and
// Jinx's enormous nest on top of it, built of everything shiny he ever took,
// four beacons round the crag's foot and a clearing below it where he lands
// when he is dazzled; the Nest Tree in the east, Bobo's patch in the west,
// and the last bell's cage by the landing place in the south.
export function nest(m) {
  const { seed } = m;
  const SEA = m.sea;
  m.pal.path = B.PEBBLES;
  const height = bellLand(m, { rim: 56, base: 3, hills: (x, z) => 1.4 + fbm(seed + 47, x / 15, z / 15, 4) * 2 });
  m.shape(height);
  const spawn = { x: 64, z: 108 };
  const plaza = site(m, height, 64, 98, 8);
  const cage = site(m, height, 53, 95, 6, { y: plaza.y });
  const crag = site(m, height, 64, 50, 11);
  const clearing = site(m, height, 64, 72, 7, { y: crag.y });
  const tree = site(m, height, 101, 74, 7);
  const patch = site(m, height, 27, 74, 13, { blend: 7 });
  const spots = [[44, 58], [84, 58], [46, 34], [82, 34]];
  const beacons = spots.map(([x, z]) => site(m, height, x, z, 3, { y: crag.y }));
  way(m, [spawn, plaza, { x: 64, z: 86 }, clearing]);
  way(m, [clearing, { x: 50, z: 66 }, beacons[0], { x: 40, z: 46 }, beacons[2], { x: 64, z: 30 }, beacons[3], { x: 88, z: 46 }, beacons[1], { x: 78, z: 66 }, clearing]);
  way(m, [plaza, { x: 80, z: 92 }, { x: 94, z: 82 }, tree]);
  way(m, [plaza, { x: 48, z: 92 }, { x: 36, z: 82 }, patch]);
  m.finish();
  const { world } = m;
  const hub = bellCage(m, cage.x, cage.z, 1, 0, 4, false);
  // The crag: sheer rock nine across, fourteen high.
  const y0 = crag.y;
  const tall = 14;
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 5.6 + hash2(seed + 61, dx, dz) * 0.5) continue;
      for (let y = y0 + 1; y <= y0 + tall; y++) world.set(64 + dx, y, 50 + dz, hash2(seed + 63, dx + y, dz) < 0.12 ? GRAY : B.STONE);
    }
  }
  // The nest on top: a ring of sticks, glinting with shiny things woven in.
  const nestY = y0 + tall;
  for (let dx = -7; dx <= 7; dx++) {
    for (let dz = -7; dz <= 7; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 7.2) continue;
      const x = 64 + dx;
      const z = 50 + dz;
      if (d <= 6) world.set(x, nestY + 1, z, B.PLANKS);
      if (d > 4.6) {
        for (let k = 1; k <= 3; k++) {
          const shiny = hash2(seed + 67, x * 3 + k, z) < 0.16;
          world.set(x, nestY + k, z, shiny ? (hash2(seed + 69, x, z + k) < 0.5 ? B.ESCAPE_TRIM : YELLOW) : k === 3 && d < 5.2 ? B.AIR : hash2(seed + 65, x, z + k) < 0.5 ? B.WOOD : BROWN);
        }
      }
    }
  }
  const perch = [64, nestY + 2, 50];
  // (Each beacon a few steps off the way round the crag, outwards.)
  const lit = beacons.map((b) => bonfire(m, b.x + Math.sign(b.x - 64) * 3, b.z + Math.sign(b.z - 50) * 3));
  const key = nestTreeClimb(m, tree.x, tree.z, tree.y, 16);
  // Boulders about Bobo's patch, to run round.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.7;
    const x = Math.round(patch.x + Math.cos(a) * 7);
    const z = Math.round(patch.z + Math.sin(a) * 7);
    const y = m.ground(x, z);
    world.set(x, y + 1, z, B.STONE);
    world.set(x + 1, y + 1, z, B.STONE);
    world.set(x, y + 2, z, GRAY);
  }
  grow(m, 1300, 6, (top, x, z, y, rng) => {
    if (top !== m.pal.top) return null;
    return rng.chance(0.55) ? pineTree(rng) : rng.chance(0.5) ? oakTree(rng) : null;
  });
  m.flowers(30);
  const reach = reachable(m);
  const hoard = hideFinds(m, reach, 6);
  return {
    fruit: B.FRUIT_ITEMS[4],
    hub,
    quests: [
      { kind: 'finds', x: 64, y: plaza.y + 1, z: 64, spots: hoard },
      { kind: 'chase', x: patch.x, y: patch.y + 1, z: patch.z, r: 13, catches: 3, pace: 3 },
      { kind: 'climb', x: key[0], y: key[1], z: key[2], at: key },
      { kind: 'jinx', x: 64, y: perch[1], z: 50, perch, land: [clearing.x, clearing.y + 1, clearing.z], fires: lit, burn: burnFor(lit, 14), catches: 3, pace: 2 },
    ],
  };
}

// ---------------------------------------------------------------- turned over

// A chapter's challenges and its cage, as its map is turned over on a later
// journey (isle-maps.js mirror): every place in them mirrored with it.
export function mirrorQuests(made, W, D, alongX, alongZ) {
  const fx = (x) => (alongX ? W - 1 - x : x);
  const fz = (z) => (alongZ ? D - 1 - z : z);
  const cell = (c) => [fx(c[0]), c[1], fz(c[2])];
  for (const q of made.quests ?? []) {
    q.x = fx(q.x);
    q.z = fz(q.z);
    for (const key of ['spots', 'fires', 'slots', 'pads']) if (q[key]) q[key] = q[key].map(cell);
    for (const key of ['at', 'start', 'perch', 'land']) if (q[key]) q[key] = cell(q[key]);
    if (q.home) q.home = { ...q.home, x: alongX ? W - q.home.x : q.home.x, z: alongZ ? D - q.home.z : q.home.z };
  }
  const hub = made.hub;
  if (!hub) return;
  for (const key of ['bell', 'perch']) if (hub[key]) hub[key] = cell(hub[key]);
  hub.locks = hub.locks.map(cell);
  for (let i = 0; i < hub.open.length; i += 4) {
    hub.open[i] = fx(hub.open[i]);
    hub.open[i + 2] = fz(hub.open[i + 2]);
  }
}

// The Puzzle Isles' maps, by chapter key (isle-story.js).
export const BELL_MAPS = { bellbuoy, henhouse, topsy, kite: kiteCliffs, nest };
