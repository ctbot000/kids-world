// What each tool does to the world, worked out as a list of cell changes
// without touching the world itself. The player's page works out the change,
// shows it at once and sends it to the host, which checks it and passes it on.
//
// An edit is a flat array [x, y, z, block, x, y, z, block, ...].
import * as B from './blocks.js';
import { cellHitsBody } from './physics.js';
import { grownTree, placeTemplate, stampByKey } from './stamps.js';

export const MAX_EDIT_CELLS = 8000;
export const REACH = 24;

// A pending set of changes laid over the world.
export class Overlay {
  constructor(world) {
    this.world = world;
    this.map = new Map();
    this.order = [];
  }

  get(x, y, z) {
    if (!this.world.inBounds(x, y, z)) return this.world.get(x, y, z);
    const k = this.world.index(x, y, z);
    return this.map.has(k) ? this.map.get(k) : this.world.blocks[k];
  }

  // The magic floor at the bottom can never change.
  set(x, y, z, id) {
    if (!this.world.inBounds(x, y, z) || y === 0) return false;
    const k = this.world.index(x, y, z);
    if (!this.map.has(k)) this.order.push([x, y, z, k]);
    this.map.set(k, id);
    return true;
  }

  cells() {
    const out = [];
    for (const [x, y, z, k] of this.order) {
      const id = this.map.get(k);
      if (id !== this.world.blocks[k]) out.push(x, y, z, id);
    }
    return out;
  }
}

// ---------------------------------------------------------------- shared rules

// Plants and little items need a block under them; fruit needs a tree beside it.
export function supported(o, x, y, z, id) {
  const kind = B.KIND[id];
  if (kind !== B.K_PLANT && kind !== B.K_ITEM) return true;
  if (B.block(id).collect && B.FRUIT_ITEMS.includes(id)) {
    return (
      B.TREE_PART[o.get(x + 1, y, z)] ||
      B.TREE_PART[o.get(x - 1, y, z)] ||
      B.TREE_PART[o.get(x, y + 1, z)] ||
      B.TREE_PART[o.get(x, y - 1, z)] ||
      B.TREE_PART[o.get(x, y, z + 1)] ||
      B.TREE_PART[o.get(x, y, z - 1)]
    );
  }
  return B.SOLID[o.get(x, y - 1, z)] === 1;
}

// After changes, anything that lost its support goes too. Returns what went.
function settle(o, touched) {
  const gone = [];
  const check = (x, y, z) => {
    const id = o.get(x, y, z);
    if ((B.KIND[id] === B.K_PLANT || B.KIND[id] === B.K_ITEM) && !supported(o, x, y, z, id)) {
      o.set(x, y, z, B.AIR);
      gone.push(id);
    }
  };
  for (const [x, y, z] of touched) {
    check(x, y + 1, z);
    check(x + 1, y, z);
    check(x - 1, y, z);
    check(x, y, z + 1);
    check(x, y, z - 1);
    check(x, y - 1, z);
    check(x, y, z);
  }
  return gone;
}

// Holes dug at or below the sea next to water fill with water.
function flood(o, holes) {
  const sea = o.world.sea;
  const low = holes.filter(([, y]) => y <= sea);
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const [x, y, z] of low) {
      if (o.get(x, y, z) !== B.AIR) continue;
      const wet =
        o.get(x + 1, y, z) === B.WATER || o.get(x - 1, y, z) === B.WATER || o.get(x, y, z + 1) === B.WATER || o.get(x, y, z - 1) === B.WATER || o.get(x, y + 1, z) === B.WATER;
      if (wet) {
        o.set(x, y, z, B.WATER);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function overlapsAny(x, y, z, bodies) {
  for (const b of bodies) if (cellHitsBody(x, y, z, b)) return true;
  return false;
}

// Offsets of a square patch lying flat against a face with normal (nx, ny, nz).
function patch(nx, ny, nz, size) {
  const r = size - 1;
  const out = [[0, 0, 0]];
  for (let a = -r; a <= r; a++) {
    for (let b = -r; b <= r; b++) {
      if (a === 0 && b === 0) continue;
      if (ny !== 0) out.push([a, 0, b]);
      else if (nx !== 0) out.push([0, a, b]);
      else out.push([a, b, 0]);
    }
  }
  return out;
}

// Where a build lands for a given aim: into a plant or water that was hit,
// otherwise against the face that was hit.
export function buildOrigin(hit) {
  if (B.KIND[hit.id] === B.K_PLANT || hit.id === B.WATER) return [hit.x, hit.y, hit.z];
  return [hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz];
}

// ---------------------------------------------------------------- tools

export function buildEdit(world, hit, id, size = 1, bodies = []) {
  const o = new Overlay(world);
  const [ox, oy, oz] = buildOrigin(hit);
  const kind = B.KIND[id];
  const small = kind === B.K_PLANT || kind === B.K_ITEM;
  // Little things go on top of the ground, spread around when the brush is big.
  const offsets = small ? patch(0, 1, 0, size) : patch(hit.nx, hit.ny, hit.nz, size);
  for (const [dx, dy, dz] of offsets) {
    const x = ox + dx;
    const y = oy + dy;
    const z = oz + dz;
    if (!world.inBounds(x, y, z) || y === 0) continue;
    const here = o.get(x, y, z);
    if (!B.isReplaceable(here) || here === id) continue;
    if (small) {
      if (!supported(o, x, y, z, id)) continue;
      if (here === B.WATER) continue;
    } else if (B.SOLID[id] && overlapsAny(x, y, z, bodies)) {
      continue;
    }
    o.set(x, y, z, id);
  }
  const touched = o.order.map(([x, y, z]) => [x, y, z]);
  settle(o, touched);
  return { cells: o.cells(), collected: [] };
}

export function pickEdit(world, hit, size = 1) {
  const o = new Overlay(world);
  const targets = [];
  if (size <= 1) targets.push([hit.x, hit.y, hit.z]);
  else {
    const r = size === 2 ? 1 : 2;
    const limit = size === 2 ? 3 : 2.6;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) if (Math.hypot(dx, dy, dz) <= limit) targets.push([hit.x + dx, hit.y + dy, hit.z + dz]);
      }
    }
  }
  const collected = [];
  const holes = [];
  for (const [x, y, z] of targets) {
    const id = o.get(x, y, z);
    if (id === B.AIR || id === B.WATER || id === B.MAGIC_FLOOR || !world.inBounds(x, y, z)) continue;
    if (o.set(x, y, z, B.AIR)) {
      holes.push([x, y, z]);
      if (B.block(id).collect) collected.push(id);
    }
  }
  flood(o, holes);
  for (const id of settle(o, holes)) if (B.block(id).collect) collected.push(id);
  return { cells: o.cells(), collected };
}

export function paintEdit(world, hit, id, size = 1) {
  const o = new Overlay(world);
  if (!B.block(id).cube || id === B.WATER) return { cells: [], collected: [] };
  const touched = [];
  for (const [dx, dy, dz] of patch(hit.nx, hit.ny, hit.nz, size)) {
    const x = hit.x + dx;
    const y = hit.y + dy;
    const z = hit.z + dz;
    const here = o.get(x, y, z);
    if (!B.SOLID[here] || here === B.MAGIC_FLOOR || B.GEM_ROCK[here] || here === id) continue;
    if (size > 1) {
      // A big brush paints the surface, not the blocks buried behind it.
      const fx = x + hit.nx;
      const fy = y + hit.ny;
      const fz = z + hit.nz;
      if (B.OPAQUE[o.get(fx, fy, fz)]) continue;
    }
    if (o.set(x, y, z, id)) touched.push([x, y, z]);
  }
  const gone = settle(o, touched);
  return { cells: o.cells(), collected: gone.filter((g) => B.block(g).collect) };
}

// The highest natural ground block in a column at or below y.
function groundAt(o, x, z, fromY) {
  for (let y = Math.min(fromY, o.world.H - 1); y >= 1; y--) {
    const id = o.get(x, y, z);
    if (B.TERRAIN[id]) return y;
    if (B.SOLID[id] && !B.TREE_PART[id]) return -1; // someone built here: leave it be
  }
  return -1;
}

export const HILL_MODES = ['raise', 'lower', 'flat'];

export function hillEdit(world, hit, mode, size = 1) {
  const o = new Overlay(world);
  const radius = [2.2, 3.6, 5.6][size - 1] ?? 2.2;
  const amount = [1, 2, 3][size - 1] ?? 1;
  const touched = [];
  const holes = [];
  const level = hit.y;
  const R = Math.ceil(radius);
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dz) / radius;
      if (d > 1) continue;
      const x = hit.x + dx;
      const z = hit.z + dz;
      if (x < 0 || z < 0 || x >= world.W || z >= world.D) continue;
      const g = groundAt(o, x, z, mode === 'flat' ? world.H - 1 : Math.max(hit.y + 6, level));
      if (g < 1) continue;
      // A gem rock on top is stone round its jewel: the land grows as stone.
      const topId = B.GEM_ROCK[o.get(x, g, z)] ? B.STONE : o.get(x, g, z);
      const under = B.underOf(topId);
      const above = o.get(x, g + 1, z);
      const plant = B.KIND[above] === B.K_PLANT || B.KIND[above] === B.K_ITEM ? above : 0;
      if (mode === 'raise') {
        const n = Math.max(d < 0.35 ? 1 : 0, Math.round(amount * (1 - d * d)));
        if (n === 0) continue;
        let k = 0;
        for (; k < n; k++) {
          const y = g + 1 + k;
          if (y >= world.H - 1 || !B.isReplaceable(o.get(x, y, z)) || (o.get(x, y, z) !== B.AIR && B.KIND[o.get(x, y, z)] !== B.K_PLANT && o.get(x, y, z) !== B.WATER)) break;
          o.set(x, y, z, k === n - 1 ? topId : under);
          touched.push([x, y, z]);
        }
        // Stopped early under something: the last new block is the top one.
        if (k > 0 && k < n) o.set(x, g + k, z, topId);
        if (k > 0) {
          o.set(x, g, z, under);
          if (plant && o.get(x, g + k + 1, z) === B.AIR) o.set(x, g + k + 1, z, plant);
        }
      } else if (mode === 'lower') {
        const n = Math.max(d < 0.35 ? 1 : 0, Math.round(amount * (1 - d * d)));
        if (n === 0) continue;
        const bottom = Math.max(1, g - n);
        if (bottom === g) continue;
        for (let y = g; y > bottom; y--) {
          o.set(x, y, z, B.AIR);
          holes.push([x, y, z]);
        }
        if (B.TERRAIN[o.get(x, bottom, z)]) o.set(x, bottom, z, topId);
        if (plant) {
          o.set(x, g + 1, z, B.AIR);
          if (o.get(x, bottom + 1, z) === B.AIR) o.set(x, bottom + 1, z, plant);
        }
        touched.push([x, bottom, z]);
      } else {
        // Flatten: cut everything above the level away, fill up to it.
        for (let y = level + 1; y <= Math.min(world.H - 1, level + 14); y++) {
          const id = o.get(x, y, z);
          if (id !== B.AIR && id !== B.MAGIC_FLOOR && (y <= world.sea ? id !== B.WATER : true)) {
            o.set(x, y, z, B.AIR);
            holes.push([x, y, z]);
          }
        }
        for (let y = Math.max(1, g + 1); y <= level; y++) {
          const id = o.get(x, y, z);
          if (B.isReplaceable(id)) o.set(x, y, z, y === level ? topId : under);
        }
        if (g > level) o.set(x, level, z, topId);
        touched.push([x, level, z]);
      }
    }
  }
  flood(o, holes);
  settle(o, [...touched, ...holes]);
  const cells = o.cells();
  const kept = cells.length / 4 > MAX_EDIT_CELLS ? cells.slice(0, MAX_EDIT_CELLS * 4) : cells;
  return { cells: kept, collected: collectedBy(world, kept) };
}

// Treasures an edit takes away: jewels dug out of the land and fruit or
// shells it sweeps off, which go in the basket.
function collectedBy(world, cells) {
  const out = [];
  for (let i = 0; i < cells.length; i += 4) {
    const was = world.get(cells[i], cells[i + 1], cells[i + 2]);
    if (B.block(was).collect && cells[i + 3] !== was) out.push(was);
  }
  return out;
}

export function stampOrigin(hit) {
  return buildOrigin(hit);
}

export function stampEdit(world, hit, key, facing) {
  const stamp = stampByKey(key);
  if (!stamp) return { cells: [], collected: [] };
  const o = new Overlay(world);
  const [ox, oy, oz] = stampOrigin(hit);
  const touched = [];
  for (const [x, y, z, id] of placeTemplate(stamp.cells, ox, oy, oz, facing)) {
    if (o.set(x, y, z, id)) touched.push([x, y, z]);
  }
  settle(o, touched);
  const cells = o.cells();
  return { cells, collected: collectedBy(world, cells) };
}

// A sprout grown into its tree. Returns [] when the sprout is gone.
export function growEdit(world, x, y, z, seed) {
  const sprout = world.get(x, y, z);
  const kind = B.block(sprout).grows;
  if (!kind) return [];
  const o = new Overlay(world);
  o.set(x, y, z, B.AIR);
  for (const [cx, cy, cz, id] of placeTemplate(grownTree(kind, seed), x, y, z, 0)) {
    const here = o.get(cx, cy, cz);
    if (here === B.AIR || B.KIND[here] === B.K_PLANT || (cx === x && cy === y && cz === z)) o.set(cx, cy, cz, id);
  }
  // Fruit that ended up with no branch to hang from is dropped.
  const touched = o.order.map(([a, b, c]) => [a, b, c]);
  settle(o, touched);
  return o.cells();
}

// Every cell of an edit inside the world, with a known block, and never the
// magic floor. Used by the host on everything it receives.
export function validCells(world, cells) {
  if (!Array.isArray(cells) || cells.length % 4 !== 0 || cells.length / 4 > MAX_EDIT_CELLS) return null;
  for (let i = 0; i < cells.length; i += 4) {
    const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || !B.isKnown(id)) return null;
    if (!world.inBounds(x, y, z) || y === 0 || id === B.MAGIC_FLOOR) return null;
  }
  return cells;
}

export function applyCells(world, cells) {
  for (let i = 0; i < cells.length; i += 4) world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
}
