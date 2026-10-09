// What each piece of furniture looks like: a few boxes inside its cell. No
// three.js here, so the mesher (render/mesher.js), the toy box icons
// (render/atlas.js) and the tests all share it.
//
// A model is laid out facing -z, its back to +z, in a cell from 0 to 1 on
// every axis. Each box is [x0, y0, z0, x1, y1, z1, colour, tile], where the
// tile is painted in render/atlas.js and multiplied by the colour; a tile of
// 'glow' is always bright (a fire, a lamp shade, a TV picture).
//
// Some pieces join up with the same piece beside them, facing the same way:
// sofas and kitchen counters side by side make one long one, beds one
// behind the other one long bed, and tables next to each other one big
// table. `same(dx, dz)` says whether the cell that far away (in the
// model's own layout: +x across, +z towards its back) holds one.
import { BLOCKS } from './blocks.js';

const WOOD = '#c98a52';
const DARK_WOOD = '#8b5a3c';
const WHITE = '#f7f5ef';
const STEEL = '#c9ced6';
const BLACK = '#2c2f36';
const BOOKS = ['#e8453c', '#3a73d8', '#fcd535', '#35a852', '#8c5bd6', '#f59331', '#f47fb8', '#2fc1b3'];

const box = (x0, y0, z0, x1, y1, z1, color, tile = 'plain') => [x0, y0, z0, x1, y1, z1, color, tile];

const MODELS = {
  chair() {
    const out = [];
    for (const x of [0.18, 0.74]) for (const z of [0.18, 0.74]) out.push(box(x, 0, z, x + 0.08, 0.45, z + 0.08, WOOD, 'planks'));
    out.push(box(0.15, 0.45, 0.15, 0.85, 0.53, 0.85, WOOD, 'planks'));
    out.push(box(0.2, 0.53, 0.2, 0.8, 0.58, 0.76, '#e8453c', 'cloth'));
    out.push(box(0.15, 0.53, 0.77, 0.85, 1.05, 0.85, WOOD, 'planks'));
    return out;
  },

  sofa(same) {
    const left = same(-1, 0);
    const right = same(1, 0);
    const x0 = left ? 0 : 0.04;
    const x1 = right ? 1 : 0.96;
    const c = '#5b8fd9';
    const out = [box(x0, 0.08, 0.1, x1, 0.42, 0.95, c, 'cloth'), box(x0, 0.42, 0.72, x1, 0.95, 0.95, c, 'cloth')];
    out.push(box(left ? 0 : 0.18, 0.42, 0.12, right ? 1 : 0.82, 0.52, 0.72, '#7aa6e6', 'cloth'));
    if (!left) out.push(box(0.04, 0.42, 0.1, 0.18, 0.7, 0.95, c, 'cloth'));
    if (!right) out.push(box(0.82, 0.42, 0.1, 0.96, 0.7, 0.95, c, 'cloth'));
    for (const x of [left ? null : 0.06, right ? null : 0.88]) {
      if (x === null) continue;
      for (const z of [0.12, 0.85]) out.push(box(x, 0, z, x + 0.06, 0.08, z + 0.06, DARK_WOOD, 'planks'));
    }
    return out;
  },

  bed(same) {
    const back = same(0, 1);
    const front = same(0, -1);
    const z0 = front ? 0 : 0.04;
    const z1 = back ? 1 : 0.96;
    const out = [box(0.05, 0.12, z0, 0.95, 0.3, z1, WOOD, 'planks'), box(0.08, 0.3, z0, 0.92, 0.48, z1, WHITE, 'cloth')];
    // The blanket, up to the pillow at the head.
    out.push(box(0.07, 0.48, z0, 0.93, 0.54, back ? 1 : 0.6, '#f29bc4', 'cloth'));
    if (!back) {
      out.push(box(0.05, 0, 0.88, 0.95, 0.95, 0.98, WOOD, 'planks'));
      out.push(box(0.16, 0.48, 0.63, 0.84, 0.62, 0.86, WHITE, 'cloth'));
    }
    if (!front) out.push(box(0.05, 0, 0.02, 0.95, 0.6, 0.1, WOOD, 'planks'));
    for (const x of [0.05, 0.87]) {
      if (!front) out.push(box(x, 0, 0.02, x + 0.08, 0.12, 0.1, DARK_WOOD, 'planks'));
      if (!back) out.push(box(x, 0, 0.88, x + 0.08, 0.12, 0.96, DARK_WOOD, 'planks'));
    }
    return out;
  },

  bookshelf() {
    const out = [
      box(0.04, 0, 0.92, 0.96, 1, 1, DARK_WOOD, 'planks'),
      box(0.04, 0, 0.5, 0.1, 1, 0.92, WOOD, 'planks'),
      box(0.9, 0, 0.5, 0.96, 1, 0.92, WOOD, 'planks'),
    ];
    for (const y of [0, 0.32, 0.64, 0.94]) out.push(box(0.1, y, 0.5, 0.9, y + 0.06, 0.92, WOOD, 'planks'));
    // Books of all colours, each row a little different.
    [0.06, 0.38, 0.7].forEach((y, row) => {
      let x = 0.12;
      let k = row * 3;
      while (x < 0.84) {
        const w = 0.07 + ((k * 5) % 3) * 0.02;
        const h = 0.18 + ((k * 7) % 4) * 0.02;
        if (x + w > 0.88) break;
        out.push(box(x, y, 0.56, x + w, y + h, 0.9, BOOKS[k % BOOKS.length], 'plain'));
        x += w + 0.01;
        k++;
      }
    });
    return out;
  },

  counter(same) {
    const left = same(-1, 0) ? 0 : 0.02;
    const right = same(1, 0) ? 1 : 0.98;
    return [
      box(left, 0, 0.14, right, 0.08, 1, DARK_WOOD, 'planks'),
      box(left, 0.08, 0.08, right, 0.86, 1, WHITE, 'plain'),
      box(left, 0.86, 0.02, right, 0.95, 1, '#d8c3a0', 'pebbles'),
      box(0.47, 0.12, 0.07, 0.53, 0.82, 0.08, '#d9d5cc', 'plain'),
      box(0.36, 0.6, 0.04, 0.42, 0.72, 0.08, STEEL, 'plain'),
      box(0.58, 0.6, 0.04, 0.64, 0.72, 0.08, STEEL, 'plain'),
    ];
  },

  stove() {
    const out = [
      box(0.02, 0, 0.08, 0.98, 0.86, 1, '#e7e9ec', 'plain'),
      box(0.02, 0.86, 0.06, 0.98, 0.92, 1, BLACK, 'plain'),
      box(0.18, 0.14, 0.06, 0.82, 0.56, 0.08, '#4a5462', 'glass'),
      box(0.2, 0.64, 0.05, 0.8, 0.68, 0.08, STEEL, 'plain'),
    ];
    for (const x of [0.2, 0.4, 0.6, 0.76]) out.push(box(x, 0.74, 0.04, x + 0.06, 0.8, 0.08, BLACK, 'plain'));
    for (const x of [0.14, 0.56]) for (const z of [0.18, 0.58]) out.push(box(x, 0.92, z, x + 0.3, 0.94, z + 0.3, '#5a3a3a', 'plain'));
    return out;
  },

  fridge() {
    return [
      box(0.06, 0, 0.12, 0.94, 1, 1, '#eaf4fb', 'plain'),
      box(0.06, 0.6, 0.11, 0.94, 0.62, 0.12, '#9fb3c2', 'plain'),
      box(0.76, 0.66, 0.06, 0.82, 0.92, 0.11, STEEL, 'plain'),
      box(0.76, 0.12, 0.06, 0.82, 0.5, 0.11, STEEL, 'plain'),
      box(0.18, 0.74, 0.1, 0.3, 0.84, 0.12, '#e8453c', 'plain'),
      box(0.36, 0.7, 0.1, 0.46, 0.8, 0.12, '#fcd535', 'plain'),
    ];
  },

  tv() {
    return [
      box(0.3, 0, 0.4, 0.7, 0.04, 0.62, BLACK, 'plain'),
      box(0.46, 0.04, 0.48, 0.54, 0.18, 0.55, BLACK, 'plain'),
      box(0.04, 0.16, 0.45, 0.96, 0.74, 0.56, BLACK, 'plain'),
      box(0.08, 0.2, 0.44, 0.92, 0.7, 0.45, '#6fc3ff', 'glow'),
    ];
  },

  fireplace() {
    const brick = '#ffffff';
    return [
      box(0, 0, 0.3, 0.2, 0.88, 1, brick, 'brick-wall'),
      box(0.8, 0, 0.3, 1, 0.88, 1, brick, 'brick-wall'),
      box(0.2, 0.58, 0.3, 0.8, 0.88, 1, brick, 'brick-wall'),
      box(0.2, 0, 0.9, 0.8, 0.58, 1, '#3a2c28', 'plain'),
      box(0.2, 0, 0.36, 0.8, 0.03, 0.9, '#3a2c28', 'plain'),
      box(-0.02, 0.88, 0.24, 1.02, 0.98, 1, WOOD, 'planks'),
      box(0.28, 0.03, 0.5, 0.72, 0.11, 0.62, DARK_WOOD, 'wood-side'),
      box(0.32, 0.11, 0.52, 0.68, 0.38, 0.7, '#ffb347', 'glow'),
      box(0.4, 0.11, 0.5, 0.6, 0.48, 0.64, '#ffe066', 'glow'),
    ];
  },

  picture() {
    return [
      box(0.14, 0.28, 0.93, 0.86, 0.86, 1, '#f5c542', 'plain'),
      box(0.2, 0.34, 0.92, 0.8, 0.8, 0.93, '#9ad8f7', 'plain'),
      box(0.2, 0.34, 0.915, 0.8, 0.5, 0.92, '#6cbf6a', 'plain'),
      box(0.6, 0.62, 0.915, 0.72, 0.74, 0.92, '#fcd535', 'plain'),
      box(0.32, 0.5, 0.915, 0.44, 0.6, 0.92, '#e8453c', 'plain'),
    ];
  },

  table(same) {
    const l = same(-1, 0);
    const r = same(1, 0);
    const f = same(0, -1);
    const b = same(0, 1);
    const out = [box(l ? 0 : 0.02, 0.74, f ? 0 : 0.02, r ? 1 : 0.98, 0.82, b ? 1 : 0.98, WOOD, 'planks')];
    // A leg at each corner with no table beside it either way.
    for (const [lx, lz, sx, sz] of [
      [0.08, 0.08, l, f],
      [0.84, 0.08, r, f],
      [0.08, 0.84, l, b],
      [0.84, 0.84, r, b],
    ]) {
      if (!sx && !sz) out.push(box(lx, 0, lz, lx + 0.08, 0.74, lz + 0.08, WOOD, 'planks'));
    }
    return out;
  },

  'floor-lamp'() {
    return [
      box(0.32, 0, 0.32, 0.68, 0.05, 0.68, BLACK, 'plain'),
      box(0.47, 0.05, 0.47, 0.53, 0.72, 0.53, BLACK, 'plain'),
      box(0.26, 0.66, 0.26, 0.74, 1, 0.74, '#fff3c4', 'glow'),
    ];
  },

  'potted-plant'() {
    return [
      box(0.3, 0, 0.3, 0.7, 0.34, 0.7, '#d9774b', 'plain'),
      box(0.27, 0.3, 0.27, 0.73, 0.38, 0.73, '#c4643a', 'plain'),
      box(0.33, 0.34, 0.33, 0.67, 0.37, 0.67, '#5a3d2b', 'dirt'),
      box(0.36, 0.37, 0.36, 0.64, 0.9, 0.64, '#4caf50', 'leaves'),
      box(0.22, 0.48, 0.4, 0.5, 0.74, 0.62, '#43a047', 'leaves'),
      box(0.5, 0.56, 0.36, 0.78, 0.82, 0.6, '#5cbf60', 'leaves'),
      box(0.4, 0.5, 0.2, 0.62, 0.72, 0.42, '#4caf50', 'leaves'),
    ];
  },
};

// The boxes of a piece of furniture in its own layout (facing -z).
export function modelBoxes(id, same = () => false) {
  const make = MODELS[BLOCKS[id]?.model];
  return make ? make(same) : [];
}

// Quarter turns that take the model's own front (-z) round to `front`.
const turnsFor = (front) => (front + 1) % 4;

// A point of the layout turned once: -z goes to +x.
const turnPoint = (x, z) => [1 - z, x];
const turnOffset = (dx, dz) => [-dz, dx];

// The boxes of the piece of furniture with block `id` at cell (x, y, z) of
// the world, where `at(x, y, z)` gives the block in any cell: turned the way
// it faces, joined up with the ones beside it, and moved into place.
export function furnitureBoxes(id, x, y, z, at) {
  const def = BLOCKS[id];
  const k = turnsFor(def.front);
  const same = (dx, dz) => {
    let [ox, oz] = [dx, dz];
    for (let i = 0; i < k; i++) [ox, oz] = turnOffset(ox, oz);
    const other = BLOCKS[at(x + ox, y, z + oz)];
    return other?.model === def.model && other.front === def.front;
  };
  return modelBoxes(id, same).map(([x0, y0, z0, x1, y1, z1, color, tile]) => {
    let [ax, az] = [x0, z0];
    let [bx, bz] = [x1, z1];
    for (let i = 0; i < k; i++) {
      [ax, az] = turnPoint(ax, az);
      [bx, bz] = turnPoint(bx, bz);
    }
    return [x + Math.min(ax, bx), y + y0, z + Math.min(az, bz), x + Math.max(ax, bx), y + y1, z + Math.max(az, bz), color, tile];
  });
}
