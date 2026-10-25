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

// A piano's two octaves of keys, from x0 to x1 at height y, from z0 at the
// front to z1: fifteen white keys with a gap between each, and the black
// keys standing up between them, shorter. The low notes are on the left as
// you face the piano (towards +x).
function pianoKeys(x0, x1, y, z0, z1) {
  const out = [];
  const w = (x1 - x0) / 15;
  const at = (i) => x1 - (i + 1) * w;
  for (let i = 0; i < 15; i++) out.push(box(at(i) + 0.004, y, z0, at(i) + w - 0.004, y + 0.035, z1, WHITE, 'plain'));
  // A black key after C, D, F, G and A in each octave.
  for (let i = 0; i < 14; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    const x = at(i) - w * 0.3;
    out.push(box(x, y + 0.035, z0 + (z1 - z0) * 0.4, x + w * 0.6, y + 0.06, z1, BLACK, 'plain'));
  }
  return out;
}

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
    out.push(box(0.07, 0.48, z0, 0.93, 0.54, back ? 1 : 0.64, '#f29bc4', 'cloth'));
    if (!back) {
      out.push(box(0.05, 0, 0.92, 0.95, 0.95, 0.99, WOOD, 'planks'));
      out.push(box(0.16, 0.48, 0.66, 0.84, 0.62, 0.9, WHITE, 'cloth'));
    }
    if (!front) out.push(box(0.05, 0, 0.01, 0.95, 0.6, 0.07, WOOD, 'planks'));
    for (const x of [0.05, 0.87]) {
      if (!front) out.push(box(x, 0, 0.01, x + 0.08, 0.12, 0.07, DARK_WOOD, 'planks'));
      if (!back) out.push(box(x, 0, 0.92, x + 0.08, 0.12, 0.99, DARK_WOOD, 'planks'));
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

  // A TV on its stand (shared/tv.js), a show on its glowing screen: a
  // green hill under the sky with the sun over it, and a little red light.
  tv() {
    return [
      box(0.3, 0, 0.4, 0.7, 0.04, 0.62, BLACK, 'plain'),
      box(0.46, 0.04, 0.48, 0.54, 0.18, 0.55, BLACK, 'plain'),
      box(0.04, 0.16, 0.45, 0.96, 0.74, 0.56, BLACK, 'plain'),
      box(0.08, 0.2, 0.44, 0.92, 0.7, 0.45, '#6fc3ff', 'glow'),
      box(0.08, 0.2, 0.435, 0.92, 0.34, 0.44, '#7ed36f', 'glow'),
      box(0.3, 0.34, 0.435, 0.62, 0.4, 0.44, '#7ed36f', 'glow'),
      box(0.7, 0.52, 0.435, 0.8, 0.62, 0.44, '#ffe066', 'glow'),
      box(0.86, 0.17, 0.44, 0.89, 0.19, 0.45, '#ff5a4f', 'glow'),
    ];
  },

  // A Retro TV (shared/tv.js): a wooden box on four short legs, its rounded
  // screen in a grey frame glowing with a cartoon fish, two knobs and a
  // speaker beside it, and rabbit-ear antennae on top, each going up in
  // steps from a little dome.
  'retro-tv'() {
    const out = [
      box(0.08, 0.12, 0.3, 0.92, 0.74, 0.86, '#a8703f', 'planks'),
      box(0.14, 0.18, 0.28, 0.68, 0.68, 0.3, '#9aa1ab', 'plain'),
      box(0.18, 0.22, 0.27, 0.64, 0.64, 0.28, '#8fe3c8', 'glow'),
      box(0.16, 0.24, 0.272, 0.66, 0.62, 0.282, '#8fe3c8', 'glow'),
      // The fish on the screen, with its tail and an eye.
      box(0.32, 0.36, 0.265, 0.48, 0.48, 0.27, '#ff9a3c', 'glow'),
      box(0.48, 0.34, 0.265, 0.54, 0.5, 0.27, '#ff9a3c', 'glow'),
      box(0.35, 0.42, 0.26, 0.38, 0.45, 0.265, BLACK, 'plain'),
      // Two knobs and the speaker's grille.
      box(0.74, 0.54, 0.26, 0.84, 0.64, 0.3, '#e8e2d4', 'plain'),
      box(0.74, 0.4, 0.26, 0.84, 0.5, 0.3, '#e8e2d4', 'plain'),
      ...[0.2, 0.25, 0.3].map((y) => box(0.72, y, 0.29, 0.86, y + 0.025, 0.3, '#5e3a22', 'plain')),
      // Four short legs.
      ...[
        [0.12, 0.34],
        [0.82, 0.34],
        [0.12, 0.76],
        [0.82, 0.76],
      ].map(([x, z]) => box(x, 0, z, x + 0.06, 0.12, z + 0.06, '#5e3a22', 'plain')),
      // The antennae's dome.
      box(0.42, 0.74, 0.52, 0.58, 0.8, 0.66, BLACK, 'plain'),
    ];
    for (let i = 0; i < 6; i++) {
      const y = 0.8 + i * 0.045;
      out.push(box(0.44 - i * 0.045, y, 0.58, 0.47 - i * 0.045, y + 0.05, 0.6, STEEL, 'plain'));
      out.push(box(0.53 + i * 0.045, y, 0.58, 0.56 + i * 0.045, y + 0.05, 0.6, STEEL, 'plain'));
    }
    return out;
  },

  // A Wall TV (shared/tv.js), a thin black screen hung on the wall behind
  // it, glowing with a little fish tank: blue water, sand, waving weed and
  // two fish, and a red light under it.
  'wall-tv'() {
    return [
      box(0.02, 0.18, 0.93, 0.98, 0.82, 1, BLACK, 'plain'),
      box(0.06, 0.22, 0.92, 0.94, 0.78, 0.93, '#4fb3ff', 'glow'),
      box(0.06, 0.22, 0.915, 0.94, 0.28, 0.92, '#f3d98b', 'glow'),
      box(0.14, 0.28, 0.915, 0.18, 0.5, 0.92, '#4cc46a', 'glow'),
      box(0.8, 0.28, 0.915, 0.84, 0.44, 0.92, '#4cc46a', 'glow'),
      box(0.3, 0.52, 0.915, 0.44, 0.62, 0.92, '#ff9a3c', 'glow'),
      box(0.26, 0.53, 0.915, 0.3, 0.61, 0.92, '#ff9a3c', 'glow'),
      box(0.56, 0.36, 0.915, 0.68, 0.44, 0.92, '#fcd535', 'glow'),
      box(0.68, 0.37, 0.915, 0.71, 0.43, 0.92, '#fcd535', 'glow'),
      box(0.47, 0.19, 0.925, 0.53, 0.21, 0.93, '#ff5a4f', 'glow'),
    ];
  },

  // A Computer: a screen on a stand, glowing with lines of code in a dark
  // editor and a little power light, a keyboard in front and a mouse
  // beside it.
  computer() {
    const code = [
      [0.14, 0.7, 0.42, '#7cc4ff'],
      [0.2, 0.64, 0.6, '#ffd166'],
      [0.2, 0.58, 0.5, '#9be38a'],
      [0.26, 0.52, 0.72, '#f78fb3'],
      [0.26, 0.46, 0.56, '#9be38a'],
      [0.2, 0.4, 0.66, '#ffd166'],
      [0.14, 0.34, 0.3, '#7cc4ff'],
    ];
    return [
      box(0.36, 0, 0.62, 0.64, 0.03, 0.84, BLACK, 'plain'),
      box(0.46, 0.03, 0.72, 0.54, 0.26, 0.78, BLACK, 'plain'),
      box(0.06, 0.22, 0.62, 0.94, 0.82, 0.72, BLACK, 'plain'),
      box(0.1, 0.26, 0.61, 0.9, 0.78, 0.62, '#1f2a3d', 'glow'),
      ...code.map(([x0, y, x1, color]) => box(x0, y, 0.605, x1, y + 0.03, 0.61, color, 'glow')),
      box(0.86, 0.235, 0.61, 0.89, 0.25, 0.62, '#5fe08a', 'glow'),
      box(0.12, 0, 0.14, 0.72, 0.035, 0.4, STEEL, 'plain'),
      ...[0.18, 0.25, 0.32].map((z) => box(0.15, 0.035, z, 0.69, 0.05, z + 0.05, '#e9ecf0', 'plain')),
      box(0.8, 0, 0.22, 0.88, 0.04, 0.34, WHITE, 'plain'),
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

  // The fans' boxes, for their pictures (render/fan-model.js draws them for
  // real). An electric fan: a mint base and a white pole up to its round
  // head, the blades in a chrome cage facing the front, a motor behind.
  'electric-fan'() {
    const out = [
      box(0.3, 0, 0.3, 0.7, 0.08, 0.74, '#7fd8c4', 'plain'),
      box(0.47, 0.08, 0.49, 0.53, 0.6, 0.55, WHITE, 'plain'),
      box(0.43, 0.64, 0.5, 0.57, 0.8, 0.68, '#7fd8c4', 'plain'),
    ];
    // The cage, a ring of boxes round it, and the blades across it.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = 0.5 + Math.cos(a) * 0.24;
      const y = 0.72 + Math.sin(a) * 0.24;
      out.push(box(x - 0.025, y - 0.025, 0.38, x + 0.025, y + 0.025, 0.5, STEEL, 'plain'));
    }
    out.push(box(0.28, 0.69, 0.43, 0.72, 0.75, 0.45, '#a6ecdc', 'plain'));
    out.push(box(0.47, 0.5, 0.43, 0.53, 0.94, 0.45, '#a6ecdc', 'plain'));
    out.push(box(0.45, 0.67, 0.4, 0.55, 0.77, 0.43, WHITE, 'plain'));
    return out;
  },

  // A ceiling fan: a cup on the ceiling and a rod down to its motor, four
  // wooden blades out from it, and its bowl of light underneath.
  'ceiling-fan'() {
    return [
      box(0.42, 0.95, 0.42, 0.58, 1, 0.58, WHITE, 'plain'),
      box(0.48, 0.76, 0.48, 0.52, 0.95, 0.52, '#e0b04c', 'plain'),
      box(0.39, 0.6, 0.39, 0.61, 0.76, 0.61, WHITE, 'plain'),
      box(0, 0.63, 0.44, 0.39, 0.65, 0.56, '#b9784a', 'planks'),
      box(0.61, 0.63, 0.44, 1, 0.65, 0.56, '#b9784a', 'planks'),
      box(0.44, 0.63, 0, 0.56, 0.65, 0.39, '#b9784a', 'planks'),
      box(0.44, 0.63, 0.61, 0.56, 0.65, 1, '#b9784a', 'planks'),
      box(0.41, 0.5, 0.41, 0.59, 0.6, 0.59, '#fff3c4', 'glow'),
    ];
  },

  // The fish tanks' boxes, for their pictures (render/fishtank-model.js
  // draws them for real). A fish tank: a wooden cabinet, a glass tank of
  // blue water on it with a black rim and lid, a castle and a fish or two.
  'fish-tank'() {
    return [
      box(0.03, 0, 0.2, 0.97, 0.4, 0.8, DARK_WOOD, 'planks'),
      box(0.05, 0.4, 0.22, 0.95, 0.43, 0.78, BLACK, 'plain'),
      box(0.06, 0.43, 0.23, 0.94, 0.47, 0.77, '#f2d9a0', 'plain'),
      box(0.06, 0.47, 0.23, 0.94, 0.88, 0.77, '#5fc4f0', 'glass'),
      box(0.53, 0.47, 0.6, 0.67, 0.68, 0.7, '#f7a6c8', 'plain'),
      box(0.1, 0.47, 0.62, 0.16, 0.82, 0.68, '#3fbf5f', 'plain'),
      box(0.3, 0.6, 0.21, 0.4, 0.66, 0.22, '#ff8a2a', 'glow'),
      box(0.62, 0.74, 0.21, 0.7, 0.79, 0.22, '#fcd535', 'glow'),
      box(0.03, 0.88, 0.2, 0.97, 0.96, 0.8, BLACK, 'plain'),
    ];
  },

  // A fish bowl: a round wooden stand, a bowl of water on it, a goldfish.
  'fish-bowl'() {
    return [
      box(0.32, 0, 0.32, 0.68, 0.06, 0.68, DARK_WOOD, 'planks'),
      box(0.44, 0.06, 0.44, 0.56, 0.3, 0.56, DARK_WOOD, 'planks'),
      box(0.34, 0.3, 0.34, 0.66, 0.36, 0.66, DARK_WOOD, 'planks'),
      box(0.36, 0.36, 0.36, 0.64, 0.42, 0.64, '#5fc4f0', 'glass'),
      box(0.27, 0.42, 0.27, 0.73, 0.72, 0.73, '#5fc4f0', 'glass'),
      box(0.33, 0.72, 0.33, 0.67, 0.8, 0.67, '#e6f6ff', 'glass'),
      box(0.42, 0.52, 0.26, 0.56, 0.6, 0.27, '#ff8a2a', 'glow'),
    ];
  },

  // The clocks' boxes, for their pictures (render/clock-model.js draws
  // them for real). A cuckoo clock on the wall: a wooden house, its roof,
  // a round face and a pendulum and weights hanging under it.
  'cuckoo-clock'() {
    return [
      box(0.29, 0.41, 0.84, 0.71, 0.83, 1, '#9a6238', 'planks'),
      box(0.26, 0.39, 0.8, 0.74, 0.43, 1, DARK_WOOD, 'planks'),
      box(0.27, 0.83, 0.79, 0.73, 0.9, 1, DARK_WOOD, 'planks'),
      box(0.37, 0.9, 0.79, 0.63, 0.97, 1, DARK_WOOD, 'planks'),
      box(0.39, 0.49, 0.83, 0.61, 0.71, 0.84, '#fbf6e6', 'plain'),
      box(0.49, 0.58, 0.825, 0.51, 0.69, 0.83, BLACK, 'plain'),
      box(0.49, 0.59, 0.825, 0.57, 0.61, 0.83, BLACK, 'plain'),
      box(0.495, 0.18, 0.855, 0.505, 0.41, 0.865, '#e0b04c', 'plain'),
      box(0.46, 0.13, 0.85, 0.54, 0.2, 0.87, '#e0b04c', 'plain'),
      box(0.36, 0.08, 0.92, 0.4, 0.2, 0.96, DARK_WOOD, 'planks'),
      box(0.6, 0.08, 0.92, 0.64, 0.2, 0.96, DARK_WOOD, 'planks'),
    ];
  },

  // A tower clock: a stone block, a band round its foot and top, and a lit
  // face with its hands on each side.
  'tower-clock'() {
    const out = [box(0.02, 0.02, 0.02, 0.98, 0.98, 0.98, '#eadcc0', 'plain'), box(0, 0, 0, 1, 0.07, 1, '#6c7a96', 'plain'), box(0, 0.93, 0, 1, 1, 1, '#6c7a96', 'plain')];
    for (const [x0, z0, x1, z1] of [[0.17, 0.005, 0.83, 0.02], [0.17, 0.98, 0.83, 1], [0, 0.17, 0.02, 0.83], [0.98, 0.17, 1, 0.83]]) {
      out.push(box(x0, 0.17, z0, x1, 0.83, z1, '#fff7dc', 'glow'));
    }
    out.push(box(0.49, 0.5, 0, 0.51, 0.78, 0.005, BLACK, 'plain'), box(0.49, 0.49, 0, 0.7, 0.51, 0.005, BLACK, 'plain'));
    return out;
  },

  // A table laid for tea: a white cloth with a pink skirt over one leg, and
  // on it a teapot (its spout to the right, facing whoever put it down), a
  // cup on a saucer at each side and a little plate of cookies in front.
  'tea-table'() {
    const PINK = '#f29bc4';
    const out = [
      box(0.3, 0, 0.3, 0.7, 0.06, 0.7, DARK_WOOD, 'planks'),
      box(0.42, 0.06, 0.42, 0.58, 0.52, 0.58, DARK_WOOD, 'planks'),
      box(0.1, 0.54, 0.1, 0.9, 0.7, 0.9, PINK, 'cloth'),
      box(0.06, 0.7, 0.06, 0.94, 0.78, 0.94, WHITE, 'cloth'),
      // The teapot, behind the middle.
      box(0.34, 0.78, 0.5, 0.58, 0.97, 0.74, WHITE, 'plain'),
      box(0.58, 0.83, 0.56, 0.67, 0.91, 0.63, WHITE, 'plain'),
      box(0.25, 0.83, 0.55, 0.3, 0.93, 0.69, WHITE, 'plain'),
      box(0.39, 0.97, 0.55, 0.53, 1.0, 0.69, PINK, 'plain'),
      box(0.43, 1.0, 0.59, 0.49, 1.04, 0.65, PINK, 'plain'),
      // A cup on a saucer at each side.
      box(0.12, 0.78, 0.18, 0.3, 0.8, 0.36, PINK, 'plain'),
      box(0.16, 0.8, 0.22, 0.26, 0.89, 0.32, WHITE, 'plain'),
      box(0.7, 0.78, 0.18, 0.88, 0.8, 0.36, PINK, 'plain'),
      box(0.74, 0.8, 0.22, 0.84, 0.89, 0.32, WHITE, 'plain'),
      // A plate of cookies in front.
      box(0.38, 0.78, 0.12, 0.62, 0.8, 0.36, PINK, 'plain'),
      box(0.41, 0.8, 0.16, 0.49, 0.84, 0.24, '#ffffff', 'cookie'),
      box(0.51, 0.8, 0.2, 0.59, 0.84, 0.28, '#ffffff', 'cookie'),
      box(0.46, 0.84, 0.18, 0.54, 0.88, 0.26, '#ffffff', 'cookie'),
    ];
    return out;
  },

  // A pet's bed (shared/pets.js): a round basket of woven bands with a soft
  // pink cushion in it and a little pillow at the back, for a pet to curl up
  // in at night.
  'pet-bed'() {
    const out = [];
    // The basket, a ring of little bands round and round, two courses high
    // and leaning out a little at the top.
    for (const [y0, y1, r] of [[0, 0.11, 0.34], [0.11, 0.22, 0.38]]) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const x = 0.5 + Math.cos(a) * r;
        const z = 0.5 + Math.sin(a) * r;
        out.push(box(x - 0.05, y0, z - 0.05, x + 0.05, y1, z + 0.05, i % 2 ? DARK_WOOD : WOOD, 'planks'));
      }
    }
    // The cushion, a soft round pad just under the basket's rim, and the
    // pillow at the back.
    out.push(box(0.18, 0.14, 0.18, 0.82, 0.26, 0.82, '#f7b6cf', 'cloth'));
    out.push(box(0.3, 0.26, 0.6, 0.7, 0.36, 0.78, '#ffe1ee', 'cloth'));
    return out;
  },

  // An arcade machine, its screen glowing in the dark: a joystick and two
  // buttons under a screen showing the game it runs (shared/arcade.js), and
  // a lit marquee over it. This one runs Bop-a-Blob, with a blob on it.
  'arcade-blob'() {
    const out = [
      box(0.08, 0.02, 0.34, 0.92, 0.82, 1, '#8c5bd6', 'plain'),
      box(0.06, 0.02, 0.26, 0.94, 0.08, 0.34, DARK_WOOD, 'planks'),
      box(0.06, 0.1, 0.24, 0.94, 0.3, 0.34, BLACK, 'plain'),
      box(0.14, 0.36, 0.36, 0.86, 0.74, 0.44, BLACK, 'plain'),
      box(0.18, 0.4, 0.34, 0.82, 0.7, 0.36, '#8fe3ff', 'glow'),
      // The blob on the screen, with its cross eyes.
      box(0.36, 0.44, 0.335, 0.64, 0.66, 0.355, '#f2a0e0', 'glow'),
      box(0.42, 0.58, 0.325, 0.46, 0.62, 0.33, '#2c2f36', 'plain'),
      box(0.54, 0.58, 0.325, 0.58, 0.62, 0.33, '#2c2f36', 'plain'),
      box(0.44, 0.47, 0.325, 0.56, 0.51, 0.33, '#2c2f36', 'plain'),
      // The marquee, lit from the front, and the coin slot.
      box(0.04, 0.82, 0.4, 0.96, 0.94, 1, '#fcd535', 'plain'),
      box(0.06, 0.83, 0.36, 0.94, 0.93, 0.4, '#ffe066', 'glow'),
      box(0.46, 0.12, 0.3, 0.54, 0.15, 0.32, '#fcd535', 'plain'),
      // A joystick and two buttons on the panel.
      box(0.46, 0.3, 0.26, 0.54, 0.4, 0.32, '#2c2f36', 'plain'),
      box(0.41, 0.4, 0.24, 0.59, 0.47, 0.31, '#e8453c', 'plain'),
      box(0.22, 0.3, 0.27, 0.32, 0.35, 0.32, '#35a852', 'plain'),
      box(0.68, 0.3, 0.27, 0.78, 0.35, 0.32, '#3a73d8', 'plain'),
    ];
    return out;
  },

  // The same machine in teal, running Picture Pairs: two little cards on
  // its screen, one with a heart on it.
  'arcade-pairs'() {
    const out = [
      box(0.08, 0.02, 0.34, 0.92, 0.82, 1, '#2fc1b3', 'plain'),
      box(0.06, 0.02, 0.26, 0.94, 0.08, 0.34, DARK_WOOD, 'planks'),
      box(0.06, 0.1, 0.24, 0.94, 0.3, 0.34, BLACK, 'plain'),
      box(0.14, 0.36, 0.36, 0.86, 0.74, 0.44, BLACK, 'plain'),
      box(0.18, 0.4, 0.34, 0.82, 0.7, 0.36, '#fff3c4', 'glow'),
      box(0.26, 0.44, 0.335, 0.44, 0.66, 0.355, WHITE, 'plain'),
      box(0.31, 0.5, 0.325, 0.39, 0.58, 0.33, '#f47fb8', 'plain'),
      box(0.56, 0.44, 0.335, 0.74, 0.66, 0.355, WHITE, 'plain'),
      box(0.61, 0.5, 0.325, 0.69, 0.58, 0.33, '#fcd535', 'plain'),
      box(0.04, 0.82, 0.4, 0.96, 0.94, 1, '#f47fb8', 'plain'),
      box(0.06, 0.83, 0.36, 0.94, 0.93, 0.4, '#ffd1e6', 'glow'),
      box(0.46, 0.12, 0.3, 0.54, 0.15, 0.32, '#fcd535', 'plain'),
      box(0.46, 0.3, 0.26, 0.54, 0.4, 0.32, '#2c2f36', 'plain'),
      box(0.41, 0.4, 0.24, 0.59, 0.47, 0.31, '#f59331', 'plain'),
      box(0.22, 0.3, 0.27, 0.32, 0.35, 0.32, '#e8453c', 'plain'),
      box(0.68, 0.3, 0.27, 0.78, 0.35, 0.32, '#35a852', 'plain'),
    ];
    return out;
  },

  // A gashapon, a capsule toy machine (shared/gashapon.js): a red stand
  // with a coin slot, a big silver handle to turn and a chute the capsule
  // rolls out of, under a glass globe full of capsules — each half
  // coloured, half white — pressed up against the glass all round.
  gashapon() {
    const RED = '#e8453c';
    const SHELLS = ['#f47fb8', '#62c4f5', '#fcd535', '#9bd44a', '#f59331', '#8c5bd6'];
    const out = [
      box(0.18, 0, 0.22, 0.82, 0.5, 0.82, RED, 'plain'),
      box(0.16, 0, 0.2, 0.84, 0.04, 0.84, DARK_WOOD, 'planks'),
      // The coin slot and the handle, sticking out to be turned.
      box(0.36, 0.22, 0.2, 0.64, 0.46, 0.22, STEEL, 'plain'),
      box(0.47, 0.38, 0.19, 0.53, 0.44, 0.2, BLACK, 'plain'),
      box(0.44, 0.24, 0.13, 0.56, 0.36, 0.2, STEEL, 'plain'),
      box(0.32, 0.27, 0.11, 0.68, 0.33, 0.15, WHITE, 'plain'),
      // The chute, with a capsule waiting in it.
      box(0.38, 0.05, 0.19, 0.62, 0.17, 0.22, BLACK, 'plain'),
      box(0.45, 0.06, 0.18, 0.55, 0.11, 0.2, '#fcd535', 'plain'),
      // The globe, rounded off at the top in steps, its silver rim and its
      // red cap with a knob.
      box(0.2, 0.5, 0.24, 0.8, 0.54, 0.8, STEEL, 'plain'),
      box(0.22, 0.54, 0.26, 0.78, 0.84, 0.78, '#cfeeff', 'plain'),
      box(0.27, 0.84, 0.31, 0.73, 0.92, 0.73, '#cfeeff', 'plain'),
      box(0.31, 0.92, 0.35, 0.69, 0.97, 0.69, RED, 'plain'),
      box(0.45, 0.97, 0.45, 0.55, 1.02, 0.55, '#fcd535', 'plain'),
    ];
    // The capsules against the glass, all round: each a coloured half on a
    // white one.
    const capsule = (x, y, z, across, c) => {
      const s = 0.13;
      const [x0, x1, z0, z1] = across ? [x, x + s, z, z + 0.02] : [x, x + 0.02, z, z + s];
      out.push(box(x0, y, z0, x1, y + s / 2, z1, WHITE, 'plain'));
      out.push(box(x0, y + s / 2, z0, x1, y + s, z1, c, 'plain'));
    };
    const rows = [[0.56, [0.25, 0.43, 0.61]], [0.7, [0.33, 0.52]]];
    let i = 0;
    for (const [y, xs] of rows) {
      for (const u of xs) {
        capsule(u, y, 0.245, true, SHELLS[i % SHELLS.length]);
        capsule(1 - u - 0.13, y, 0.765, true, SHELLS[(i + 2) % SHELLS.length]);
        capsule(0.205, y, u, false, SHELLS[(i + 4) % SHELLS.length]);
        capsule(0.775, y, 1 - u - 0.13, false, SHELLS[(i + 1) % SHELLS.length]);
        i++;
      }
    }
    return out;
  },

  // A broadcast station (shared/station.js): a TV camera on a tripod, its
  // lens to the front, its glass glowing blue with a glint, a viewfinder on its
  // side, a handle and a microphone on top and the red ON AIR light.
  'broadcast-station'() {
    const BODY = '#4a4f5a';
    const out = [
      // The camera, its lens and the hood round the glass.
      box(0.3, 0.62, 0.38, 0.7, 0.86, 0.84, BODY, 'plain'),
      box(0.36, 0.64, 0.2, 0.64, 0.84, 0.38, BLACK, 'plain'),
      box(0.33, 0.62, 0.14, 0.67, 0.86, 0.2, BLACK, 'plain'),
      box(0.35, 0.64, 0.135, 0.65, 0.84, 0.14, '#5b616c', 'plain'),
      box(0.4, 0.68, 0.13, 0.6, 0.8, 0.135, '#2f6fd6', 'glow'),
      box(0.42, 0.75, 0.125, 0.47, 0.78, 0.13, '#e6f3ff', 'glow'),
      box(0.3, 0.6, 0.84, 0.7, 0.88, 0.88, BLACK, 'plain'),
      // The viewfinder on its arm, its little screen glowing.
      box(0.7, 0.72, 0.46, 0.74, 0.76, 0.52, BLACK, 'plain'),
      box(0.74, 0.68, 0.4, 0.8, 0.84, 0.62, BLACK, 'plain'),
      box(0.8, 0.7, 0.42, 0.805, 0.82, 0.6, '#9fe3b8', 'glow'),
      // The handle on two posts, a microphone along it to the front, and
      // the ON AIR light.
      box(0.46, 0.86, 0.48, 0.54, 0.92, 0.52, BLACK, 'plain'),
      box(0.46, 0.86, 0.74, 0.54, 0.92, 0.78, BLACK, 'plain'),
      box(0.46, 0.92, 0.46, 0.54, 0.96, 0.8, BLACK, 'plain'),
      box(0.32, 0.88, 0.2, 0.38, 0.94, 0.56, '#9aa1ab', 'plain'),
      box(0.31, 0.87, 0.16, 0.39, 0.95, 0.22, '#3d4048', 'plain'),
      box(0.58, 0.86, 0.4, 0.66, 0.92, 0.46, '#ff3b30', 'glow'),
      // The tripod head and its column.
      box(0.4, 0.58, 0.46, 0.6, 0.62, 0.74, BLACK, 'plain'),
      box(0.47, 0.3, 0.57, 0.53, 0.58, 0.63, STEEL, 'plain'),
      box(0.44, 0.28, 0.54, 0.56, 0.34, 0.66, BLACK, 'plain'),
    ];
    // Three legs, each going out and down in steps from the column, with a foot.
    for (const [dx, dz] of [
      [-1, 0.6],
      [1, 0.6],
      [0, -1],
    ]) {
      for (let i = 0; i < 6; i++) {
        const t = (i + 1) / 6;
        const x = 0.5 + dx * t * 0.36 * (dz < 0 ? 0 : 1);
        const z = 0.6 + (dz < 0 ? -t * 0.36 : t * 0.24);
        const y = 0.3 - t * 0.3;
        out.push(box(x - 0.025, y, z - 0.025, x + 0.025, y + 0.07, z + 0.025, STEEL, 'plain'));
      }
    }
    return out;
  },

  // A school desk (shared/school.js): a little wooden desk on a steel frame
  // at the front, a book and a pencil on it, and its chair joined on behind,
  // to sit at facing the desk.
  'school-desk'() {
    const out = [
      box(0.06, 0.62, 0.04, 0.94, 0.68, 0.44, '#d9a066', 'planks'),
      box(0.1, 0.5, 0.08, 0.9, 0.53, 0.4, STEEL, 'plain'),
      // A book open on it, and a yellow pencil.
      box(0.2, 0.68, 0.14, 0.48, 0.7, 0.34, WHITE, 'plain'),
      box(0.32, 0.68, 0.14, 0.34, 0.705, 0.34, '#3a73d8', 'plain'),
      box(0.6, 0.68, 0.22, 0.82, 0.7, 0.25, '#fcd535', 'plain'),
      // The chair's seat and back, in red.
      box(0.2, 0.42, 0.5, 0.8, 0.48, 0.9, '#e8453c', 'plain'),
      box(0.2, 0.48, 0.88, 0.8, 0.92, 0.94, '#e8453c', 'plain'),
      // The frame joining them, along the bottom.
      box(0.1, 0, 0.2, 0.14, 0.04, 0.9, STEEL, 'plain'),
      box(0.86, 0, 0.2, 0.9, 0.04, 0.9, STEEL, 'plain'),
    ];
    // The desk's legs, and the chair's.
    for (const x of [0.1, 0.86]) out.push(box(x, 0.04, 0.22, x + 0.04, 0.62, 0.26, STEEL, 'plain'));
    for (const x of [0.24, 0.72]) for (const z of [0.54, 0.84]) out.push(box(x, 0.04, z, x + 0.04, 0.42, z + 0.04, STEEL, 'plain'));
    return out;
  },

  // A study desk to do homework at: a wooden top on a leg and a stack of
  // drawers, a shelf along its back with books on it, a desk lamp glowing
  // over an open notebook, a cup of pencils, and a chair on one leg pulled
  // up to it (shared/seats.js), the same height as the school desk's.
  'study-desk'() {
    const out = [
      box(0.04, 0.62, 0.02, 0.96, 0.67, 0.5, WOOD, 'planks'),
      // A leg at the left, and the drawers at the right with their knobs.
      box(0.06, 0, 0.04, 0.12, 0.62, 0.46, WOOD, 'planks'),
      box(0.62, 0, 0.04, 0.94, 0.62, 0.46, WOOD, 'planks'),
      // The shelf along its back, books standing on it.
      box(0.04, 0.67, 0.02, 0.08, 0.98, 0.12, DARK_WOOD, 'planks'),
      box(0.92, 0.67, 0.02, 0.96, 0.98, 0.12, DARK_WOOD, 'planks'),
      box(0.04, 0.84, 0.02, 0.96, 0.87, 0.14, DARK_WOOD, 'planks'),
      box(0.04, 0.98, 0.02, 0.96, 1, 0.14, DARK_WOOD, 'planks'),
      // An open notebook with a line of writing, and a pencil beside it.
      box(0.32, 0.67, 0.22, 0.6, 0.68, 0.4, WHITE, 'plain'),
      box(0.455, 0.67, 0.22, 0.465, 0.685, 0.4, '#3a73d8', 'plain'),
      box(0.36, 0.68, 0.26, 0.44, 0.685, 0.27, '#9aa3b0', 'plain'),
      box(0.36, 0.68, 0.3, 0.42, 0.685, 0.31, '#9aa3b0', 'plain'),
      box(0.5, 0.68, 0.26, 0.57, 0.685, 0.27, '#9aa3b0', 'plain'),
      box(0.63, 0.67, 0.34, 0.65, 0.69, 0.48, '#fcd535', 'plain'),
      // A cup of pencils at the right.
      box(0.8, 0.67, 0.22, 0.88, 0.77, 0.3, '#2fc1b3', 'plain'),
      box(0.82, 0.77, 0.24, 0.83, 0.84, 0.25, '#e8453c', 'plain'),
      box(0.845, 0.77, 0.26, 0.855, 0.82, 0.27, '#fcd535', 'plain'),
      box(0.86, 0.77, 0.23, 0.87, 0.83, 0.24, '#35a852', 'plain'),
      // The desk lamp at the left: a base, an arm and its glowing shade.
      box(0.12, 0.67, 0.18, 0.24, 0.69, 0.3, '#3a73d8', 'plain'),
      box(0.17, 0.69, 0.23, 0.19, 0.92, 0.25, '#3a73d8', 'plain'),
      box(0.17, 0.9, 0.25, 0.3, 0.92, 0.27, '#3a73d8', 'plain'),
      box(0.24, 0.82, 0.2, 0.36, 0.9, 0.32, '#fcd535', 'plain'),
      box(0.25, 0.8, 0.21, 0.35, 0.82, 0.31, '#fff3b0', 'glow'),
      // The chair: a cushioned seat and back on one leg and a round foot.
      box(0.25, 0.42, 0.52, 0.75, 0.48, 0.9, '#5b8fd9', 'cloth'),
      box(0.25, 0.48, 0.88, 0.75, 0.9, 0.94, '#5b8fd9', 'cloth'),
      box(0.47, 0.04, 0.68, 0.53, 0.42, 0.74, STEEL, 'plain'),
      box(0.3, 0, 0.53, 0.7, 0.04, 0.89, STEEL, 'plain'),
    ];
    // The drawers' fronts and knobs, on the chair's side, to open sitting down.
    for (const y of [0.04, 0.24, 0.44]) {
      out.push(box(0.64, y, 0.46, 0.92, y + 0.16, 0.465, DARK_WOOD, 'planks'));
      out.push(box(0.75, y + 0.07, 0.465, 0.81, y + 0.1, 0.475, '#e0b04c', 'plain'));
    }
    // Books on the shelf, leaning a little apart.
    for (let i = 0; i < 7; i++) {
      const x = 0.1 + i * 0.07 + (i > 3 ? 0.2 : 0);
      out.push(box(x, 0.87, 0.03, x + 0.055, 0.95 + (i % 3) * 0.01, 0.13, BOOKS[i], 'plain'));
    }
    return out;
  },

  // A chalkboard (shared/school.js), hung on the wall behind it: green
  // board in a wooden frame with a tray along the bottom, a few lines of
  // chalk writing on it, a stick of chalk and a duster in the tray. Side by
  // side they join into one long board, framed only at its two ends.
  chalkboard(same) {
    const l = same(-1, 0);
    const r = same(1, 0);
    const x0 = l ? 0 : 0.04;
    const x1 = r ? 1 : 0.96;
    const CHALK = '#f4f1e6';
    const out = [
      box(x0, 0.14, 0.95, x1, 0.96, 1, DARK_WOOD, 'planks'),
      box(l ? 0 : 0.1, 0.2, 0.93, r ? 1 : 0.9, 0.9, 0.95, '#2f5d46', 'plain'),
      // The tray along the bottom.
      box(x0, 0.12, 0.86, x1, 0.16, 0.95, DARK_WOOD, 'planks'),
      // The writing: three lines of chalk, each a few words.
      box(l ? 0.06 : 0.18, 0.74, 0.925, 0.46, 0.76, 0.93, CHALK, 'plain'),
      box(0.54, 0.74, 0.925, r ? 0.9 : 0.8, 0.76, 0.93, CHALK, 'plain'),
      box(l ? 0.1 : 0.18, 0.56, 0.925, 0.62, 0.58, 0.93, CHALK, 'plain'),
      box(l ? 0.04 : 0.18, 0.38, 0.925, 0.34, 0.4, 0.93, CHALK, 'plain'),
      box(0.42, 0.38, 0.925, r ? 0.94 : 0.7, 0.4, 0.93, CHALK, 'plain'),
    ];
    // A stick of chalk and the duster in the tray, at the right-hand end.
    if (!r) out.push(box(0.56, 0.16, 0.88, 0.66, 0.18, 0.9, CHALK, 'plain'), box(0.72, 0.16, 0.87, 0.88, 0.22, 0.93, '#8b5a3c', 'cloth'), box(0.72, 0.22, 0.87, 0.88, 0.23, 0.93, '#f29bc4', 'cloth'));
    return out;
  },

  // A drawing board (shared/drawing.js): a whiteboard in a steel frame
  // between two posts on feet, a tray along its bottom with three markers in
  // it, and a crossbar low down. The picture drawn on it is laid over the
  // white at PICTURE_AT (render/drawings.js).
  'drawing-board'() {
    return [
      box(0.04, 0, 0.47, 0.09, 1.28, 0.53, STEEL, 'plain'),
      box(0.91, 0, 0.47, 0.96, 1.28, 0.53, STEEL, 'plain'),
      box(0.02, 0, 0.26, 0.11, 0.04, 0.74, BLACK, 'plain'),
      box(0.89, 0, 0.26, 0.98, 0.04, 0.74, BLACK, 'plain'),
      box(0.09, 0.14, 0.48, 0.91, 0.18, 0.52, STEEL, 'plain'),
      // The board in its frame, white in front.
      box(0.08, 0.54, 0.48, 0.92, 1.22, 0.53, STEEL, 'plain'),
      box(0.1, 0.58, 0.47, 0.9, 1.18, 0.48, WHITE, 'plain'),
      // The tray and its markers.
      box(0.1, 0.5, 0.4, 0.9, 0.54, 0.48, STEEL, 'plain'),
      box(0.2, 0.54, 0.42, 0.34, 0.57, 0.45, '#e8453c', 'plain'),
      box(0.4, 0.54, 0.42, 0.54, 0.57, 0.45, '#3a73d8', 'plain'),
      box(0.6, 0.54, 0.42, 0.74, 0.57, 0.45, '#35a852', 'plain'),
    ];
  },

  // A Go board (shared/go.js): a thick block of golden wood on four short
  // feet, its top ruled into a nine-by-nine grid with the star points
  // marked. A game's own lines and stones are drawn over it
  // (render/go-boards.js).
  'go-board'() {
    const KAYA = '#e2b866';
    const out = [
      box(0.06, 0.2, 0.06, 0.94, 0.46, 0.94, KAYA, 'planks'),
      ...[0.14, 0.86].flatMap((x) => [0.14, 0.86].map((z) => box(x - 0.06, 0, z - 0.06, x + 0.06, 0.2, z + 0.06, DARK_WOOD, 'planks'))),
    ];
    for (let k = 0; k < 9; k++) {
      const at = 0.14 + k * 0.09;
      out.push(box(at - 0.004, 0.46, 0.14, at + 0.004, 0.462, 0.86, BLACK, 'plain'));
      out.push(box(0.14, 0.46, at - 0.004, 0.86, 0.462, at + 0.004, BLACK, 'plain'));
    }
    for (const [a, b] of [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]]) out.push(box(0.13 + a * 0.09, 0.46, 0.13 + b * 0.09, 0.15 + a * 0.09, 0.463, 0.15 + b * 0.09, BLACK, 'plain'));
    return out;
  },

  // An upright piano (shared/piano.js): a tall cabinet of dark polished
  // wood, its keys sticking out in front between two cheeks, the music on
  // its stand, two legs at the front and three gold pedals.
  piano() {
    const CASE = '#3b2a24';
    const out = [
      box(0.04, 0.02, 0.56, 0.96, 0.96, 0.98, CASE, 'planks'),
      box(0.02, 0.96, 0.52, 0.98, 1.01, 1, CASE, 'planks'),
      box(0.04, 0, 0.54, 0.96, 0.06, 0.98, '#2a1d18', 'planks'),
      // The keybed and the cheeks either side, the fallboard behind the
      // keys and the music on its stand.
      box(0.04, 0.44, 0.28, 0.96, 0.52, 0.56, CASE, 'planks'),
      box(0.04, 0.52, 0.26, 0.1, 0.62, 0.56, CASE, 'planks'),
      box(0.9, 0.52, 0.26, 0.96, 0.62, 0.56, CASE, 'planks'),
      box(0.1, 0.52, 0.5, 0.9, 0.64, 0.56, CASE, 'planks'),
      box(0.2, 0.64, 0.53, 0.8, 0.68, 0.56, '#2a1d18', 'planks'),
      box(0.3, 0.68, 0.54, 0.7, 0.86, 0.555, WHITE, 'plain'),
      // Two legs to the front and the pedals.
      box(0.06, 0, 0.3, 0.12, 0.44, 0.36, CASE, 'planks'),
      box(0.88, 0, 0.3, 0.94, 0.44, 0.36, CASE, 'planks'),
      ...[0.4, 0.48, 0.56].map((x) => box(x, 0.06, 0.48, x + 0.04, 0.09, 0.56, '#f5c542', 'plain')),
    ];
    out.push(...pianoKeys(0.1, 0.9, 0.52, 0.29, 0.5));
    return out;
  },

  // A grand piano (shared/piano.js), shiny black: its keys at the front,
  // and behind them the body, straight on the left and curving in towards
  // its tail on the right, on three legs, its lid propped open up to the
  // right with the music on its stand.
  'grand-piano'() {
    const CASE = '#23252b';
    const out = [];
    // The body, a step narrower towards the tail on the curved side, with
    // the gold frame and strings showing inside it.
    const steps = [
      [0.22, 0.46, 0.04],
      [0.46, 0.62, 0.1],
      [0.62, 0.76, 0.2],
      [0.76, 0.88, 0.34],
      [0.88, 0.98, 0.5],
    ];
    for (const [z0, z1, x0] of steps) {
      out.push(box(x0, 0.42, z0, 0.96, 0.62, z1, CASE, 'plain'));
      out.push(box(x0 + 0.04, 0.62, Math.max(0.3, z0), 0.92, 0.625, z1 - 0.03, '#d9a441', 'plain'));
    }
    // Three legs and the pedal lyre between the front two.
    out.push(box(0.06, 0, 0.26, 0.12, 0.42, 0.32, CASE, 'plain'));
    out.push(box(0.88, 0, 0.26, 0.94, 0.42, 0.32, CASE, 'plain'));
    out.push(box(0.66, 0, 0.86, 0.72, 0.42, 0.92, CASE, 'plain'));
    out.push(box(0.46, 0.04, 0.3, 0.54, 0.42, 0.34, CASE, 'plain'));
    out.push(...[0.43, 0.48, 0.53].map((x) => box(x, 0.04, 0.26, x + 0.04, 0.07, 0.3, '#f5c542', 'plain')));
    // The keys, in their slot at the front, between cheeks: as high as an
    // upright's, so the same hands play both.
    out.push(box(0.04, 0.42, 0.04, 0.96, 0.52, 0.22, CASE, 'plain'));
    out.push(box(0.04, 0.52, 0.04, 0.08, 0.6, 0.24, CASE, 'plain'));
    out.push(box(0.92, 0.52, 0.04, 0.96, 0.6, 0.24, CASE, 'plain'));
    out.push(...pianoKeys(0.08, 0.92, 0.52, 0.05, 0.22));
    // The music stand, with the music on it.
    out.push(box(0.2, 0.62, 0.25, 0.8, 0.76, 0.28, CASE, 'plain'));
    out.push(box(0.3, 0.65, 0.245, 0.7, 0.8, 0.25, WHITE, 'plain'));
    // The lid, hinged along the straight side and propped up on a stick,
    // rising in steps towards the curved side.
    for (let i = 0; i < 11; i++) {
      const x1 = 0.96 - i * 0.06;
      out.push(box(x1 - 0.065, 0.64 + i * 0.04, 0.32, x1, 0.665 + i * 0.04, 0.96, CASE, 'plain'));
    }
    out.push(box(0.43, 0.62, 0.6, 0.45, 0.98, 0.62, '#1a1b20', 'plain'));
    return out;
  },

  // The Monster Gashapon's boxes, for its picture: the gashapon's, in a
  // purple cabinet and cap with a slime-green band (render/gashapon-model.js
  // draws it for real).
  'monster-gashapon'() {
    const COLOURS = { '#e8453c': '#5b2a86', '#fcd535': '#8ee05a' };
    return MODELS.gashapon().map((b) => (COLOURS[b[6]] ? [...b.slice(0, 6), COLOURS[b[6]], b[7]] : b));
  },

  // A scarecrow on its pole, taller than its cell like a grown-up: a red
  // shirt with a blue patch, its arms out along a crossbar with straw for
  // hands, straw poking out under it, a smiling pumpkin for a head and a
  // straw hat with a red band.
  scarecrow() {
    const RED = '#e8453c';
    const STRAW = '#f2cf62';
    return [
      box(0.46, 0, 0.46, 0.54, 1.02, 0.54, DARK_WOOD, 'planks'),
      box(0.04, 0.86, 0.47, 0.96, 0.92, 0.53, WOOD, 'planks'),
      box(0.3, 0.56, 0.36, 0.7, 0.98, 0.64, RED, 'cloth'),
      box(0.12, 0.82, 0.39, 0.3, 0.96, 0.61, RED, 'cloth'),
      box(0.7, 0.82, 0.39, 0.88, 0.96, 0.61, RED, 'cloth'),
      box(0.4, 0.68, 0.35, 0.5, 0.78, 0.36, '#3a73d8', 'cloth'),
      box(0.02, 0.8, 0.42, 0.12, 0.94, 0.58, STRAW, 'hay-side'),
      box(0.88, 0.8, 0.42, 0.98, 0.94, 0.58, STRAW, 'hay-side'),
      box(0.33, 0.48, 0.38, 0.67, 0.56, 0.62, STRAW, 'hay-side'),
      box(0.32, 0.98, 0.34, 0.68, 1.28, 0.66, '#ffffff', 'pumpkin-skin'),
      box(0.39, 1.14, 0.33, 0.46, 1.21, 0.34, BLACK, 'plain'),
      box(0.54, 1.14, 0.33, 0.61, 1.21, 0.34, BLACK, 'plain'),
      box(0.41, 1.05, 0.33, 0.59, 1.08, 0.34, BLACK, 'plain'),
      box(0.22, 1.28, 0.24, 0.78, 1.32, 0.76, STRAW, 'hay-top'),
      box(0.35, 1.32, 0.37, 0.65, 1.46, 0.63, STRAW, 'hay-top'),
      box(0.345, 1.32, 0.365, 0.655, 1.36, 0.635, RED, 'plain'),
    ];
  },

  // A wooden fence post, with two rails out to each fence beside it.
  fence(same) {
    const out = [box(0.4, 0, 0.4, 0.6, 0.94, 0.6, WOOD, 'planks'), box(0.37, 0.94, 0.37, 0.63, 1, 0.63, DARK_WOOD, 'planks')];
    for (const y of [0.3, 0.66]) {
      if (same(-1, 0)) out.push(box(0, y, 0.44, 0.4, y + 0.13, 0.56, WOOD, 'planks'));
      if (same(1, 0)) out.push(box(0.6, y, 0.44, 1, y + 0.13, 0.56, WOOD, 'planks'));
      if (same(0, -1)) out.push(box(0.44, y, 0, 0.56, y + 0.13, 0.4, WOOD, 'planks'));
      if (same(0, 1)) out.push(box(0.44, y, 0.6, 0.56, y + 0.13, 1, WOOD, 'planks'));
    }
    return out;
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

// A point (px, py, pz) of a piece of furniture's own layout, in the world,
// for block `id` at cell (x, y, z), turned the way it faces.
export function furniturePoint(id, x, y, z, px, py, pz) {
  let [ax, az] = [px, pz];
  for (let i = 0; i < turnsFor(BLOCKS[id]?.front ?? 3); i++) [ax, az] = turnPoint(ax, az);
  return [x + ax, y + py, z + az];
}

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
