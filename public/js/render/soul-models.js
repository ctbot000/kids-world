// The soul weapons as they look (shared/souls.js): each made of its parts, every
// part a model of its own, so that one found in a golden chest, the ones laid out
// at the Soul Forge and the whole weapon in someone's hand are all the very same
// things (soulPart, soulModel). In a weapon's own axes its grip is at the origin
// and it points up +y, as the toy weapons do (avatar.js weapon).
//
// They are made of a few finishes, whatever their colours — every point of them
// has a colour of its own — so a weapon is drawn in a handful of calls. Which
// material a finish is comes from whoever wants the model: the island's own toy
// materials (gameKit), or ones that can melt in out of thin air on the forge's
// stage (soul-stage.js).
import * as THREE from '../../vendor/three.module.js';
import { soulOf, SOULS, soulWeapon } from '../shared/souls.js';
import { litByStudio, ToyMaterial } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- shapes

// Where a piece goes: at (x, y, z), sized (one number or three), turned.
export function at(x = 0, y = 0, z = 0, s = 1, rx = 0, ry = 0, rz = 0) {
  const k = Array.isArray(s) ? s : [s, s, s];
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(...k));
}

// The same, its y turned to point along d.
function along(x, y, z, d, s = 1) {
  const k = Array.isArray(s) ? s : [s, s, s];
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(...d).normalize()), V(...k));
}

const ball = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const rod = (r0, r1, h, n = 16) => new THREE.CylinderGeometry(r1, r0, h, n);
const cone = (r, h, n = 12) => new THREE.ConeGeometry(r, h, n);
const hoop = (R, r, n = 36, m = 10, arc = TAU) => new THREE.TorusGeometry(R, r, m, n, arc);
const gem = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const lathe = (pts, n = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n);
const capsule = (r, l, n = 10) => new THREE.CapsuleGeometry(r, l, 4, n);

// A flat shape cut from points, thick, its edges bevelled: a blade.
function cut(points, thick = 0.04, bevel = 0.014, curve = false) {
  const shape = new THREE.Shape();
  const pts = points.map(([x, y]) => new THREE.Vector2(x, y));
  if (curve) shape.setFromPoints(new THREE.SplineCurve(pts).getPoints(pts.length * 8));
  else shape.setFromPoints(pts);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, steps: 1, curveSegments: 8, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.translate(0, 0, -thick / 2);
  return g;
}

const starPts = (n, r, inner, turn = 0) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (i / n) * Math.PI + Math.PI / 2 + turn;
  const d = i % 2 ? inner : r;
  return [Math.cos(a) * d, Math.sin(a) * d];
});

// A tube along points, as thick at each as radii says (evenly along it).
export function taper(points, radii, { seg = 22, round = 9 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)));
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [];
  const idx = [];
  const p = V();
  const rAt = (t) => {
    const s = t * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(s));
    return radii.length < 2 ? radii[0] : radii[i] + (radii[i + 1] - radii[i]) * (s - i);
  };
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, p);
    const r = Math.max(0.0005, rAt(i / seg));
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j < round; j++) {
      const a = (j / round) * TAU;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      pos.push(p.x + n.x * c + b.x * s, p.y + n.y * c + b.y * s, p.z + n.z * c + b.z * s);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < round; j++) {
      const a = i * round + j;
      const q = i * round + ((j + 1) % round);
      idx.push(a, q, a + round, q, q + round, a + round);
    }
  }
  for (const end of [0, seg]) {
    curve.getPointAt(end / seg, p);
    const c = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    for (let j = 0; j < round; j++) {
      const a = end * round + j;
      const q = end * round + ((j + 1) % round);
      if (end) idx.push(c, a, q);
      else idx.push(c, q, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const col = new THREE.Color();
const col2 = new THREE.Color();
// Paint running from one colour to the next by how far along an axis a point is.
const fade = (axis, from, to, ...colors) => (x, y, z) => {
  const v = { x, y, z }[axis];
  const s = Math.max(0, Math.min(1, (v - from) / (to - from))) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(s));
  return col.set(colors[i]).lerp(col2.set(colors[i + 1]), s - i);
};
const hue = (h, s = 0.9, l = 0.55) => `#${new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace).getHexString()}`;

// ---------------------------------------------------------------- the parts

// Each weapon's parts, in the order souls.js has them: what each is made of,
// [finish, shape, paint, where] a piece.
const STAR = {
  gold: '#ffcf4a',
  pale: '#fff1b8',
  night: '#2a2f8f',
  deep: '#151a5c',
  ice: '#9fe3ff',
};
// Half of Starfall's blade, from its middle out to its edge (x turned over for
// the other half).
const HALF_BLADE = [[0, 0.26], [0.1, 0.26], [0.135, 0.36], [0.094, 0.56], [0.098, 0.8], [0.12, 1.0], [0.082, 1.15], [0, 1.2]];
const flip = (pts) => pts.map(([x, y]) => [-x, y]);
const grow = (pts, k) => pts.map(([x, y], i) => [x * (i === 0 || i === pts.length - 1 ? 1 : k), y]);
const feather = (l, w) => [[0, 0], [w * 0.7, l * 0.25], [w, l * 0.6], [w * 0.45, l * 0.92], [0, l], [-w * 0.45, l * 0.85], [-w * 0.6, l * 0.5], [-w * 0.3, l * 0.15]];

function starWing(side, tones) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = side * (0.62 + i * 0.27);
    const l = 0.3 - i * 0.035;
    out.push(['satin', cut(feather(l, 0.05), 0.02, 0.008, true), tones[i % tones.length], at(side * 0.05, 0.2 - i * 0.012, 0.012 * (i % 2 ? 1 : -1), 1, 0, 0, -a)]);
    out.push(['glow', cut(feather(l * 0.82, 0.016), 0.028, 0.002, true), side < 0 ? STAR.pale : STAR.ice, at(side * 0.055, 0.2 - i * 0.012, 0.012 * (i % 2 ? 1 : -1), 1, 0, 0, -a)]);
  }
  out.push(['metal', ball(0.042, 14, 10), side < 0 ? STAR.gold : '#c9d2ea', at(side * 0.062, 0.2, 0)]);
  return out;
}

const PARTS = {
  star: [
    // Comet Pommel.
    () => [
      ['gem', ball(0.056, 20, 14), fade('y', -0.25, -0.15, '#1f7fd8', '#8fe0ff'), at(0, -0.2, 0)],
      ['glow', cut(starPts(4, 0.04, 0.011), 0.112, 0), '#e6f7ff', at(0, -0.2, 0)],
      ...[0, 1, 2, 3].map((i) => ['metal', taper([[Math.sin(i * 1.571) * 0.02, -0.12, Math.cos(i * 1.571) * 0.02], [Math.sin(i * 1.571) * 0.062, -0.17, Math.cos(i * 1.571) * 0.062], [Math.sin(i * 1.571) * 0.05, -0.235, Math.cos(i * 1.571) * 0.05]], [0.014, 0.012, 0.004], { seg: 10, round: 7 }), STAR.gold]),
      ...[0, 1, 2].map((i) => ['glow', taper([[0, -0.24, 0], [Math.sin(i * 2.09) * 0.03, -0.3, Math.cos(i * 2.09) * 0.03], [Math.sin(i * 2.09 + 0.9) * 0.05, -0.37 - i * 0.02, Math.cos(i * 2.09 + 0.9) * 0.05]], [0.018, 0.011, 0.002], { seg: 10, round: 7 }), fade('y', -0.4, -0.22, '#3fb0ff', '#d6f3ff')]),
      ['metal', hoop(0.036, 0.011, 24, 8), STAR.gold, at(0, -0.13, 0, 1, Math.PI / 2)],
    ],
    // Midnight Grip.
    () => [
      ['matte', rod(0.03, 0.03, 0.25, 16), STAR.deep, at(0, 0.01, 0)],
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ['satin', hoop(0.031, 0.008, 22, 7), STAR.night, at(0, -0.1 + i * 0.036, 0, 1, Math.PI / 2 + 0.26, 0, 0)]),
      ...[0, 1, 2, 3, 4, 5].map((i) => ['glow', cut(starPts(4, 0.013, 0.004), 0.004, 0), '#ffffff', at(Math.sin(i * 2.4) * 0.037, -0.08 + i * 0.034, Math.cos(i * 2.4) * 0.037, 1, 0, i * 2.4)]),
      ['metal', hoop(0.034, 0.01, 24, 8), STAR.gold, at(0, 0.132, 0, 1, Math.PI / 2)],
    ],
    // Dawn Wing, and Dusk Wing: its guard.
    () => starWing(-1, ['#ffe0b4', '#ffc07c', '#ff9f6e']),
    () => starWing(1, ['#8f9be8', '#6f7be0', '#4f5ac9']),
    // Star Core.
    () => [
      ['gem', cut(starPts(5, 0.125, 0.056), 0.05, 0.022), fade('y', 0.08, 0.34, '#ff9d2e', '#ffe36a'), at(0, 0.215, 0)],
      ['glow', cut(starPts(5, 0.07, 0.03), 0.1, 0.006), '#fffbe0', at(0, 0.215, 0)],
      ['metal', hoop(0.1, 0.012, 40, 8), STAR.gold, at(0, 0.215, 0)],
    ],
    // Sunrise Edge and Nightfall Edge: the two halves of its blade.
    () => [
      ['metal', cut(flip(HALF_BLADE), 0.03, 0.012), fade('y', 0.26, 1.2, '#ff8a5c', '#ffc65a', '#fff0b0')],
      ['glow', cut(grow(flip(HALF_BLADE), 1.1), 0.012, 0.004), fade('y', 0.26, 1.2, '#ff9a4a', '#ffe27a')],
      ...[0.44, 0.66, 0.88].map((y, i) => ['glow', cut([[-0.012, 0], [-0.06 + i * 0.006, 0.04], [-0.012, 0.11], [-0.034, 0.045]], 0.066, 0), '#fff6cf', at(0, y, 0)]),
    ],
    () => [
      ['metal', cut(HALF_BLADE, 0.03, 0.012), fade('y', 0.26, 1.2, '#1b1f7a', '#3a49c9', '#7fb2ff')],
      ['glow', cut(grow(HALF_BLADE, 1.1), 0.012, 0.004), fade('y', 0.26, 1.2, '#4f8bff', '#a9ecff')],
      ...[[0.05, 0.36, 0.022], [0.03, 0.5, 0.013], [0.065, 0.62, 0.016], [0.032, 0.76, 0.022], [0.07, 0.88, 0.013], [0.04, 1.0, 0.018], [0.03, 1.12, 0.011]].flatMap(([x, y, r]) => [1, -1].map((s) => ['glow', cut(starPts(4, r, r * 0.3), 0.003, 0), '#eaf6ff', at(x, y, s * 0.03)])),
    ],
    // North Star Tip.
    () => [
      ['gem', new THREE.OctahedronGeometry(0.1, 0), fade('y', 1.14, 1.54, '#2f8fe8', '#8fd8ff', '#f0faff'), at(0, 1.32, 0, [0.86, 2.2, 0.42])],
      ['glow', cut([[0, 1.16], [0.016, 1.3], [0, 1.5], [-0.016, 1.3]], 0.074, 0.002), '#ffffff'],
      ['glow', cut(starPts(4, 0.17, 0.018), 0.006, 0), '#dff4ff', at(0, 1.22, 0.035)],
      ['glow', cut(starPts(4, 0.17, 0.018), 0.006, 0), '#dff4ff', at(0, 1.22, -0.035)],
      ['metal', cut([[-0.085, 1.13], [0, 1.2], [0.085, 1.13], [0.07, 1.22], [0, 1.28], [-0.07, 1.22]], 0.045, 0.01), STAR.gold],
    ],
  ],

  // Seven arcs, one of each colour, round into a ring (held by the red one).
  rainbow: ['#ff4b3e', '#ff9330', '#ffd83a', '#3fc95c', '#3a8bff', '#5a4be0', '#b45cf0'].map((color, i) => () => ringArc(i, color)),

  wild: [
    // Driftwood Haft.
    () => [
      ['matte', taper([[0, -0.5, 0], [0.018, -0.3, 0.012], [-0.012, -0.05, 0], [0.014, 0.22, -0.012], [-0.012, 0.5, 0.008], [0.006, 0.78, 0], [0, 1.02, 0]], [0.044, 0.034, 0.031, 0.033, 0.031, 0.036, 0.03], { seg: 40, round: 11 }), fade('y', -0.5, 1.0, '#4d3826', '#8a6a48', '#a98a62')],
      ...[[0.03, -0.18, 0.01, 0.018], [-0.034, 0.3, 0.012, 0.02], [0.026, 0.52, -0.02, 0.016]].map(([x, y, z, r]) => ['matte', ball(r, 10, 8), '#5d4630', at(x, y, z, [1, 1.5, 1])]),
      ['matte', taper([[0, -0.48, 0], [0.05, -0.56, 0.01], [0.085, -0.5, 0.02], [0.06, -0.44, 0.02]], [0.036, 0.026, 0.018, 0.006], { seg: 18, round: 9 }), '#57402b'],
      ...[0, 1, 2].map((i) => ['satin', hoop(0.037, 0.009, 24, 7), '#caa877', at(0.004, -0.06 + i * 0.028, 0, 1, Math.PI / 2 + 0.15)]),
    ],
    // Deepwood Vine.
    () => {
      const pts = Array.from({ length: 26 }, (_, i) => [Math.sin(i * 0.95) * 0.046, -0.02 + i * 0.026, Math.cos(i * 0.95) * 0.046]);
      const out = [['satin', taper(pts, [0.005, 0.012, 0.012, 0.011, 0.005], { seg: 90, round: 7 }), fade('y', 0, 0.66, '#2f7a3a', '#7fce4a')]];
      for (let i = 2; i < 26; i += 2) {
        const a = i * 0.95;
        out.push(['satin', cut([[0, 0], [0.022, 0.03], [0.014, 0.066], [0, 0.085], [-0.014, 0.066], [-0.022, 0.03]], 0.004, 0.003, true), i % 4 ? '#5fc04a' : '#3f9a3f', along(Math.sin(a) * 0.052, -0.02 + i * 0.026, Math.cos(a) * 0.052, [Math.sin(a), 0.7, Math.cos(a)])]);
      }
      for (const i of [5, 13, 21]) {
        const a = i * 0.95 + 1.6;
        const [x, y, z] = [Math.sin(a) * 0.06, -0.02 + i * 0.026, Math.cos(a) * 0.06];
        for (let k = 0; k < 5; k++) out.push(['gloss', ball(0.013, 8, 6), '#ffd6ec', at(x + Math.cos(k * 1.257) * 0.017, y + Math.sin(k * 1.257) * 0.017, z)]);
        out.push(['glow', ball(0.009, 8, 6), '#ffd84d', at(x, y, z + 0.006)]);
      }
      return out;
    },
    // Thunder Falls Blade: the great one, of blue stone, water running in it.
    () => {
      const edge = [[-0.03, 0.6], [-0.15, 0.52], [-0.33, 0.4], [-0.43, 0.46], [-0.49, 0.6], [-0.505, 0.74], [-0.49, 0.88], [-0.43, 1.02], [-0.33, 1.08], [-0.15, 0.95], [-0.03, 0.87]];
      return [
        ['satin', cut(edge, 0.05, 0.016, true), fade('x', -0.5, 0, '#6fd0f5', '#1f74b8', '#123a5c')],
        ['glow', cut([[-0.36, 0.41], [-0.45, 0.47], [-0.51, 0.6], [-0.527, 0.74], [-0.51, 0.88], [-0.45, 1.01], [-0.36, 1.07], [-0.43, 0.96], [-0.468, 0.85], [-0.48, 0.74], [-0.468, 0.63], [-0.43, 0.52]], 0.018, 0.004, true), '#9fecff'],
        ...[[0.6, 0.1], [0.7, 0.14], [0.8, 0.12], [0.9, 0.09]].map(([y, l], i) => ['glow', taper([[-0.12, y, 0.042], [-0.12 - l, y + 0.015, 0.044], [-0.14 - l * 2, y - 0.01 + i * 0.008, 0.04]], [0.004, 0.009, 0.002], { seg: 14, round: 6 }), '#7fdcff']),
        ...[[0.6, 0.1], [0.7, 0.14], [0.8, 0.12], [0.9, 0.09]].map(([y, l], i) => ['glow', taper([[-0.12, y, -0.042], [-0.12 - l, y + 0.015, -0.044], [-0.14 - l * 2, y - 0.01 + i * 0.008, -0.04]], [0.004, 0.009, 0.002], { seg: 14, round: 6 }), '#7fdcff']),
        ['metal', cut([[-0.03, 0.56], [-0.11, 0.6], [-0.12, 0.735], [-0.11, 0.87], [-0.03, 0.91]], 0.085, 0.012), '#8f6a3a'],
      ];
    },
    // Snowcap Blade: the lesser one, of grey stone under snow.
    () => [
      ['matte', cut([[0.03, 0.62], [0.12, 0.57], [0.25, 0.52], [0.32, 0.6], [0.345, 0.73], [0.32, 0.86], [0.25, 0.94], [0.12, 0.9], [0.03, 0.85]], 0.055, 0.016, true), fade('x', 0, 0.34, '#2a323e', '#5c6876', '#c9d6e2')],
      ['gem', cut([[0.25, 0.52], [0.33, 0.6], [0.358, 0.73], [0.33, 0.86], [0.25, 0.94], [0.3, 0.84], [0.318, 0.73], [0.3, 0.62]], 0.022, 0.006, true), '#bfe8ff'],
      ...[[0.1, 0.9, 0.034], [0.15, 0.925, 0.042], [0.205, 0.94, 0.036], [0.25, 0.935, 0.026], [0.12, 0.885, 0.03]].map(([x, y, r], i) => ['matte', ball(r, 12, 9), '#ffffff', at(x, y, (i % 2 ? 0.012 : -0.01), [1.1, 0.75, 1])]),
      ['metal', cut([[0.03, 0.58], [0.1, 0.61], [0.11, 0.735], [0.1, 0.86], [0.03, 0.89]], 0.08, 0.012), '#8f6a3a'],
    ],
    // Murkfang Spike.
    () => [
      ['gloss', taper([[0, 0.96, 0], [-0.012, 1.1, 0], [0.012, 1.24, 0], [0.075, 1.36, 0]], [0.052, 0.046, 0.03, 0.002], { seg: 22, round: 11 }), fade('y', 0.96, 1.36, '#8a7a5a', '#efe4c6', '#fffaf0')],
      ['matte', ball(0.06, 14, 10), '#3a3f4a', at(0, 0.97, 0, [1, 0.6, 1])],
      ...[0, 1, 2, 3, 4].map((i) => ['matte', cone(0.016, 0.07, 7), '#4a505c', along(Math.sin(i * 1.257) * 0.05, 0.985, Math.cos(i * 1.257) * 0.05, [Math.sin(i * 1.257) * 0.8, 1, Math.cos(i * 1.257) * 0.8])]),
      ['glow', hoop(0.047, 0.006, 26, 7), '#8fffb0', at(-0.004, 1.02, 0, 1, Math.PI / 2)],
    ],
    // Sunstone Heart.
    () => [
      ['gem', gem(0.092, 1), fade('y', 0.64, 0.83, '#ff7a1a', '#ffc94a'), at(0, 0.735, 0, [1, 1, 1.05])],
      ['glow', gem(0.056, 0), '#fff0b0', at(0, 0.735, 0)],
      ['metal', hoop(0.1, 0.014, 34, 8), '#ffcf5a', at(0, 0.735, 0.045)],
      ['metal', hoop(0.1, 0.014, 34, 8), '#ffcf5a', at(0, 0.735, -0.045)],
      ...Array.from({ length: 10 }, (_, i) => ['glow', cone(0.015, 0.05, 6), '#ffb53a', along(Math.sin(i * 0.628) * 0.125, 0.735 + Math.cos(i * 0.628) * 0.125, 0.045, [Math.sin(i * 0.628), Math.cos(i * 0.628), 0])]),
      ...Array.from({ length: 10 }, (_, i) => ['glow', cone(0.015, 0.05, 6), '#ffb53a', along(Math.sin(i * 0.628) * 0.125, 0.735 + Math.cos(i * 0.628) * 0.125, -0.045, [Math.sin(i * 0.628), Math.cos(i * 0.628), 0])]),
    ],
  ],

  bells: [
    // Bellbuoy Handle, in a buoy's stripes.
    () => [
      ...Array.from({ length: 8 }, (_, i) => ['gloss', rod(0.034, 0.034, 0.131, 18), i % 2 ? '#fffaf0' : '#e8413c', at(0, -0.38 + i * 0.13, 0)]),
      ['metal', lathe([[0, -0.52], [0.03, -0.51], [0.052, -0.48], [0.05, -0.455], [0.034, -0.445]], 24), '#ffcf4a'],
      ['metal', hoop(0.037, 0.009, 24, 8), '#ffcf4a', at(0, 0.585, 0, 1, Math.PI / 2)],
    ],
    // Henhouse Rope.
    () => [
      ...Array.from({ length: 8 }, (_, i) => ['matte', hoop(0.04, 0.0125, 24, 8), i % 2 ? '#e6c88a' : '#d8b673', at(0, -0.1 + i * 0.024, 0, 1, Math.PI / 2 + 0.12)]),
      ['matte', taper([[0.04, -0.1, 0.01], [0.1, -0.13, 0.03], [0.105, -0.21, 0.04], [0.09, -0.27, 0.04]], [0.013, 0.012, 0.011, 0.011], { seg: 16, round: 8 }), '#d8b673'],
      ...Array.from({ length: 7 }, (_, i) => ['matte', capsule(0.007, 0.08, 6), i % 2 ? '#e6c88a' : '#caa45f', at(0.09 + Math.sin(i * 0.9) * 0.018, -0.33, 0.04 + Math.cos(i * 0.9) * 0.018, 1, 0.08 * Math.cos(i * 0.9), 0, -0.1 * Math.sin(i * 0.9))]),
      ['gloss', ball(0.026, 12, 9), '#ff8a5c', at(0.09, -0.275, 0.04)],
    ],
    // Topsy Crown: the yoke the bell hangs in.
    () => [
      ['metal', rod(0.05, 0.062, 0.07, 22), '#ffc23d', at(0, 0.63, 0)],
      ['metal', hoop(0.064, 0.012, 30, 8), '#fff0b0', at(0, 0.665, 0, 1, Math.PI / 2)],
      ['metal', taper([[0, 0.66, 0], [0, 0.69, -0.13], [0, 0.8, -0.2], [0, 0.93, -0.17]], [0.05, 0.034, 0.03, 0.034], { seg: 22, round: 10 }), fade('y', 0.66, 0.95, '#e8a020', '#ffd75e')],
      ...Array.from({ length: 5 }, (_, i) => ['metal', cone(0.022, 0.085, 8), '#ffd75e', along(Math.sin((i - 2) * 0.62) * 0.07, 0.99 - Math.abs(i - 2) * 0.012, -0.17, [Math.sin((i - 2) * 0.62), 1.2, 0])]),
      ...Array.from({ length: 5 }, (_, i) => ['gem', ball(0.0165, 10, 8), ['#ff5a7a', '#5ad0ff', '#7affa0', '#5ad0ff', '#ff5a7a'][i], at(Math.sin((i - 2) * 0.62) * 0.115, 1.045 - Math.abs(i - 2) * 0.03, -0.17)]),
      ['metal', hoop(0.066, 0.014, 28, 8), '#ffc23d', at(0, 0.95, -0.17, 1, Math.PI / 2)],
    ],
    // Great Golden Bell, its mouth to the front: what it strikes with.
    () => {
      const bell = lathe([[0.02, 0.0], [0.1, 0.005], [0.135, 0.03], [0.15, 0.09], [0.165, 0.18], [0.19, 0.27], [0.235, 0.345], [0.27, 0.385], [0.272, 0.405], [0.255, 0.41], [0.225, 0.37], [0.185, 0.29], [0.16, 0.2], [0.14, 0.08], [0.1, 0.03], [0.02, 0.02]], 44);
      const put = at(0, 0.8, -0.2, 1, Math.PI / 2);
      return [
        ['metal', bell, (x, y, z) => fade('z', -0.2, 0.22, '#c97a10', '#ffc23d', '#fff0a0')(x, y, z), put],
        ['metal', hoop(0.162, 0.01, 44, 8), '#fff3c0', at(0, 0.8, -0.03)],
        ['glow', hoop(0.2, 0.0065, 44, 8), '#fff6cf', at(0, 0.8, 0.07)],
        ['metal', hoop(0.268, 0.016, 48, 9), '#ffd75e', at(0, 0.8, 0.2)],
        ...Array.from({ length: 10 }, (_, i) => ['glow', cut(starPts(4, 0.021, 0.007), 0.006, 0), '#fffbe0', at(Math.sin(i * 0.628) * 0.172, 0.8 + Math.cos(i * 0.628) * 0.172, 0.005, 1, 0, Math.sin(i * 0.628) * 1.2, 0)]),
        ['metal', rod(0.05, 0.1, 0.05, 24), '#e8a020', at(0, 0.8, -0.225, 1, Math.PI / 2)],
      ];
    },
    // Kite Cliffs Clapper.
    () => [
      ['satin', rod(0.016, 0.02, 0.34, 12), '#5a6a86', at(0, 0.8, 0.06, 1, Math.PI / 2)],
      ['gloss', ball(0.084, 22, 16), '#3f6fd8', at(0, 0.8, 0.24)],
      ['glow', cut(starPts(5, 0.05, 0.023), 0.02, 0), '#bfe6ff', at(0, 0.8, 0.318)],
      ['metal', hoop(0.085, 0.01, 34, 8), '#e8ecf6', at(0, 0.8, 0.24)],
    ],
    // Magpie Plume.
    () => [
      ...[[-0.5, 0.36, '#15161f'], [-0.18, 0.42, '#f6f8ff'], [0.14, 0.4, '#1e3fa8'], [0.44, 0.34, '#15161f']].flatMap(([a, l, c], i) => [
        ['satin', cut(feather(l, 0.052), 0.012, 0.005, true), c, at(a * 0.12, 0.9, -0.23 - (i % 2) * 0.02, 1, -0.85, 0, -a)],
        ['glow', taper([[0, 0.02, 0.014], [0, l * 0.5, 0.016], [0, l * 0.92, 0.012]], [0.005, 0.004, 0.001], { seg: 10, round: 6 }), i === 1 ? '#8fd8ff' : '#7fc8ff', at(a * 0.12, 0.9, -0.23 - (i % 2) * 0.02, 1, -0.85, 0, -a)],
      ]),
      ['metal', ball(0.04, 14, 10), '#ffcf4a', at(0, 0.9, -0.22, [1.3, 0.8, 1])],
      ['gem', ball(0.022, 12, 9), '#39e0d0', at(0, 0.915, -0.19)],
    ],
  ],

  toon: [
    // Lollipop Handle.
    () => {
      const out = [['gloss', rod(0.031, 0.031, 0.98, 20), '#fff6fb', at(0, 0.06, 0)]];
      for (let s = 0; s < 2; s++) out.push(['gloss', taper(Array.from({ length: 40 }, (_, i) => [Math.sin(i * 0.62 + s * Math.PI) * 0.0285, -0.42 + i * 0.0246, Math.cos(i * 0.62 + s * Math.PI) * 0.0285]), [0.013], { seg: 150, round: 7 }), s ? '#37c6ff' : '#ff4b9b']);
      return out;
    },
    // Toadstool Knob.
    () => [
      ['gloss', ball(0.115, 30, 20), '#e8302f', at(0, -0.5, 0, [1, 0.82, 1])],
      ['matte', lathe([[0.03, -0.44], [0.075, -0.425], [0.07, -0.405], [0.03, -0.39]], 24), '#fff3df'],
      ...[[0, 0, 0.026], [0.7, 0.8, 0.02], [0.7, 2.1, 0.023], [0.7, 3.4, 0.018], [0.7, 4.7, 0.022], [1.3, 0.2, 0.016], [1.3, 1.5, 0.018], [1.3, 2.8, 0.015], [1.3, 4.1, 0.018], [1.3, 5.4, 0.016]].map(([t, a, r]) => ['gloss', ball(r, 12, 8), '#ffffff', along(Math.sin(t) * Math.sin(a) * 0.115, -0.5 - Math.cos(t) * 0.094, Math.sin(t) * Math.cos(a) * 0.115, [Math.sin(t) * Math.sin(a), -Math.cos(t) / 0.82, Math.sin(t) * Math.cos(a)], [1, 0.3, 1])]),
    ],
    // Rumble Ring.
    () => [
      ['metal', rod(0.046, 0.1, 0.22, 34), fade('y', 0.54, 0.76, '#3d4558', '#9aa6c0'), at(0, 0.64, 0)],
      ...Array.from({ length: 12 }, (_, i) => ['metal', new THREE.BoxGeometry(0.03, 0.06, 0.034), i % 2 ? '#ffc21f' : '#30364a', at(Math.sin(i * 0.5236) * 0.09, 0.64, Math.cos(i * 0.5236) * 0.09, 1, 0, i * 0.5236)]),
      ['gloss', hoop(0.056, 0.014, 30, 8), '#ffd23f', at(0, 0.55, 0, 1, Math.PI / 2)],
      ['gloss', hoop(0.1, 0.018, 38, 9), '#ffd23f', at(0, 0.745, 0, 1, Math.PI / 2)],
      ...Array.from({ length: 8 }, (_, i) => ['metal', ball(0.012, 10, 8), '#fff0b0', at(Math.sin(i * 0.785) * 0.117, 0.745, Math.cos(i * 0.785) * 0.117)]),
    ],
    // Snowball Gem.
    () => [
      ['gem', gem(0.07, 1), fade('y', 0.58, 0.72, '#3fa8e8', '#c9f2ff'), at(0, 0.65, 0.115)],
      ...Array.from({ length: 3 }, (_, i) => ['glow', capsule(0.0065, 0.074, 6), '#ffffff', at(0, 0.65, 0.184, 1, 0, 0, (i * Math.PI) / 3)]),
      ...Array.from({ length: 6 }, (_, i) => ['glow', cone(0.012, 0.022, 4), '#eafaff', along(Math.sin(i * 1.047) * 0.042, 0.65 + Math.cos(i * 1.047) * 0.042, 0.184, [Math.sin(i * 1.047), Math.cos(i * 1.047), 0])]),
      ['matte', hoop(0.072, 0.014, 34, 8), '#ffffff', at(0, 0.65, 0.105)],
      ...Array.from({ length: 6 }, (_, i) => ['matte', ball(0.02, 10, 8), '#ffffff', at(Math.sin(i * 1.047 + 0.4) * 0.076, 0.65 + Math.cos(i * 1.047 + 0.4) * 0.076, 0.11)]),
    ],
    // Thunder Bristles.
    () => {
      const out = [];
      for (let i = 0; i < 52; i++) {
        const a = i * 2.39996;
        const k = Math.sqrt((i + 0.5) / 52);
        const [sx, sz] = [Math.sin(a), Math.cos(a)];
        const bow = 0.168 * k;
        const tall = 1.3 - 0.24 * k * k + (i % 3) * 0.016;
        out.push(['satin', taper([[sx * 0.086 * k, 0.74, sz * 0.086 * k], [sx * bow * 0.92, 0.86, sz * bow * 0.92], [sx * bow, 0.98, sz * bow], [sx * bow * 0.62, 1.12, sz * bow * 0.62], [sx * bow * 0.14 + 0.02, tall, sz * bow * 0.14]], [0.015, 0.023, 0.022, 0.017, 0.002], { seg: 12, round: 6 }), fade('y', 0.74, 1.2, '#1a1d45', '#3038a0', '#4a5cff', '#ffe03a')]);
      }
      for (let i = 0; i < 4; i++) {
        const a = i * 1.571 + 0.5;
        out.push(['glow', cut([[-0.03, 0], [0.027, 0], [0.008, 0.075], [0.048, 0.075], [-0.016, 0.245], [0.0, 0.112], [-0.044, 0.112]], 0.012, 0.003), '#ffee3a', at(Math.sin(a) * 0.168, 0.8, Math.cos(a) * 0.168, 1, 0, a)]);
      }
      return out;
    },
    // Everycolour Ink.
    () => {
      const inks = ['#ff2f62', '#ff8f12', '#ffd91f', '#1fc95c', '#1f9bff', '#9a3fff'];
      const swirl = (x, y, z) => {
        const s = (((Math.atan2(x, z) / TAU) * 6 + (y - 1) * 7) % 6 + 6) % 6;
        const i = Math.floor(s);
        return col.set(inks[i]).lerp(col2.set(inks[(i + 1) % 6]), Math.max(0, (s - i - 0.7) / 0.3));
      };
      const out = [['gloss', inkCap(), swirl]];
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + 0.5;
        out.push(['gloss', ball(0.026 - (i % 3) * 0.004, 12, 9), inks[(i * 2 + 1) % 6], at(Math.sin(a) * 0.2, 1.06 + (i % 3) * 0.09, Math.cos(a) * 0.2, [1, 1.3, 1])]);
        out.push(['glow', ball(0.0075, 8, 6), '#ffffff', at(Math.sin(a + 0.1) * 0.215, 1.075 + (i % 3) * 0.09, Math.cos(a + 0.1) * 0.215)]);
      }
      return out;
    },
  ],

  nod: [
    // Pillow Pole: quilted, and buttoned.
    () => {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const k = i / 48;
        pts.push([0.027 + Math.abs(Math.sin(k * Math.PI * 9)) * 0.012, -0.62 + k * 1.68]);
      }
      return [
        ['matte', lathe([[0, -0.625], ...pts, [0, 1.065]], 22), (x, y) => col.set(Math.floor((y + 0.62) / 0.1867) % 2 ? '#e9dcff' : '#a58be0')],
        ...Array.from({ length: 8 }, (_, i) => ['metal', ball(0.0115, 10, 8), '#ffd75e', at(Math.sin(i * 2.1) * 0.031, -0.433 + i * 0.1867, Math.cos(i * 2.1) * 0.031)]),
        ['gloss', ball(0.05, 18, 12), '#ff9fd0', at(0, -0.64, 0, [1, 0.8, 1])],
        ['metal', hoop(0.038, 0.01, 26, 8), '#ffd75e', at(0, -0.6, 0, 1, Math.PI / 2)],
      ];
    },
    // Pumpkin Lantern, hung off the back of it.
    () => {
      const out = [
        ['metal', taper([[0, 0.98, 0], [-0.09, 1.02, 0], [-0.17, 0.99, 0], [-0.185, 0.93, 0]], [0.013, 0.011, 0.01, 0.009], { seg: 18, round: 8 }), '#ffcf4a'],
        ['glow', ball(0.062, 16, 12), '#ffe27a', at(-0.185, 0.79, 0)],
        ['satin', rod(0.016, 0.012, 0.05, 10), '#4f9a3a', at(-0.185, 0.9, 0, 1, 0, 0, 0.2)],
      ];
      for (let i = 0; i < 9; i++) out.push(['gloss', ball(0.05, 14, 12), i % 2 ? '#ff8a24' : '#f5780f', at(-0.185 + Math.sin(i * 0.698) * 0.056, 0.79, Math.cos(i * 0.698) * 0.056, [0.86, 1.6, 0.86])]);
      for (const s of [1, -1]) {
        out.push(['glow', cut([[-0.018, -0.012], [0.018, -0.012], [0, 0.02]], 0.006, 0), '#fff3a0', at(-0.185 - 0.034, 0.81, s * 0.1)]);
        out.push(['glow', cut([[-0.018, -0.012], [0.018, -0.012], [0, 0.02]], 0.006, 0), '#fff3a0', at(-0.185 + 0.034, 0.81, s * 0.1)]);
        out.push(['glow', cut([[-0.045, 0.012], [-0.02, -0.014], [0, 0.0], [0.02, -0.014], [0.045, 0.012], [0.02, -0.004], [0, 0.012], [-0.02, -0.004]], 0.006, 0), '#fff3a0', at(-0.185, 0.755, s * 0.102)]);
      }
      return out;
    },
    // Music Box Crank.
    () => [
      ['metal', rod(0.062, 0.062, 0.05, 26), '#ffd75e', at(0.05, 0.22, 0, 1, 0, 0, Math.PI / 2)],
      ...Array.from({ length: 12 }, (_, i) => ['metal', ball(0.0105, 8, 6), '#fff6d0', at(0.05 + ((i % 3) - 1) * 0.015, 0.22 + Math.sin(i * 0.524) * 0.064, Math.cos(i * 0.524) * 0.064)]),
      ['metal', rod(0.012, 0.012, 0.1, 10), '#e8b23a', at(0.11, 0.22, 0, 1, 0, 0, Math.PI / 2)],
      ['metal', rod(0.012, 0.012, 0.13, 10), '#e8b23a', at(0.155, 0.275, 0)],
      ['gloss', ball(0.034, 14, 10), '#ff8fc4', at(0.185, 0.335, 0, [1.2, 1, 1])],
      ['glow', hoop(0.066, 0.006, 30, 7), '#fff0b0', at(0.078, 0.22, 0, 1, 0, Math.PI / 2)],
    ],
    // Clock Hand Spine: the back its blade is on.
    () => turned([
      ['metal', taper([[0, 1.03, 0], [0.1, 1.2, 0], [0.32, 1.26, 0], [0.56, 1.16, 0], [0.72, 0.98, 0]], [0.034, 0.03, 0.025, 0.018, 0.01], { seg: 40, round: 10 }), fade('x', 0, 0.74, '#c98a20', '#ffd75e', '#fff3c0')],
      ['metal', hoop(0.056, 0.014, 30, 8), '#ffd75e', at(0.22, 1.315, 0)],
      ['metal', hoop(0.036, 0.011, 26, 8), '#ffd75e', at(0.42, 1.285, 0)],
      ['metal', cut([[0, 0], [0.04, 0.05], [0.05, 0.11], [0.02, 0.14], [0, 0.2], [-0.02, 0.14], [-0.05, 0.11], [-0.04, 0.05]], 0.02, 0.008, true), '#ffcf4a', at(0.0, 1.06, 0, 1, 0, 0, 0.3)],
      ...Array.from({ length: 5 }, (_, i) => ['glow', ball(0.012, 8, 6), '#fff6d0', at(0.1 + i * 0.125, 1.215 + Math.sin((i / 4) * Math.PI) * 0.04 - i * 0.02, 0.028)]),
    ]),
    // Dark Side Blade.
    () => {
      const outer = [];
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const a = 2.1 - (i / n) * 2.35;
        outer.push([0.3 + Math.cos(a) * 0.52, 0.72 + Math.sin(a) * 0.52]);
      }
      const inner = [];
      for (let i = 0; i <= n; i++) {
        const a = 2.02 - (i / n) * 2.2;
        inner.push([0.24 + Math.cos(a) * 0.5 - 0.02, 0.6 + Math.sin(a) * 0.52]);
      }
      const moon = [...outer, ...inner.reverse()];
      const edge = [...inner.slice().reverse().map(([x, y]) => [x, y]), ...inner.map(([x, y]) => [x + 0.012, y + 0.028])];
      return turned([
        ['metal', cut(moon, 0.03, 0.01), fade('x', -0.05, 0.85, '#1a1440', '#4a33a8', '#b79cff')],
        ['glow', cut(edge, 0.016, 0.004), fade('x', -0.1, 0.85, '#8f6bff', '#e6dcff')],
        ...[[0.1, 1.05, 0.03], [0.26, 1.13, 0.022], [0.42, 1.12, 0.032], [0.56, 1.05, 0.02], [0.67, 0.95, 0.024]].flatMap(([x, y, r]) => [1, -1].map((s) => ['satin', hoop(r, 0.006, 22, 6), '#6f57d0', at(x, y, s * 0.024)])),
        ...[[0.17, 1.12, 0.014], [0.34, 1.17, 0.018], [0.5, 1.12, 0.013], [0.62, 1.02, 0.016], [0.72, 0.86, 0.011]].flatMap(([x, y, r]) => [1, -1].map((s) => ['glow', cut(starPts(4, r, r * 0.28), 0.003, 0), '#f3ecff', at(x, y, s * 0.028)])),
      ]);
    },
    // Night-light Gem.
    () => [
      ['gem', ball(0.08, 26, 18), fade('y', 1.0, 1.16, '#ff9a3a', '#ffe08a'), at(0, 1.08, 0)],
      ['glow', cut(starPts(5, 0.05, 0.022), 0.166, 0), '#fff6d8', at(0, 1.08, 0)],
      ['metal', hoop(0.084, 0.012, 34, 8), '#ffd75e', at(0, 1.08, 0, 1, Math.PI / 2)],
      ['metal', hoop(0.084, 0.01, 34, 8), '#ffd75e', at(0, 1.08, 0)],
      ['glow', cut([...Array.from({ length: 13 }, (_, i) => [Math.cos(1.1 + i * 0.34) * 0.05, Math.sin(1.1 + i * 0.34) * 0.05]), ...Array.from({ length: 13 }, (_, i) => [0.022 + Math.cos(5.18 - i * 0.34) * 0.038, Math.sin(5.18 - i * 0.34) * 0.038])], 0.01, 0), '#fffbe6', at(0, 1.21, 0)],
    ],
  ],
  book: [
    // Meadow Ribbon: a bookmark's ribbon, tied in a bow under the hilt.
    () => {
      const tail = (s) => cut([[0, 0], [s * 0.04, -0.012], [s * 0.07, -0.13], [s * 0.095, -0.27], [s * 0.08, -0.3], [s * 0.064, -0.268], [s * 0.046, -0.292], [s * 0.04, -0.15], [s * 0.012, -0.02]], 0.012, 0.004, true);
      const loop = (s) => cut(Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * TAU;
        return [s * (0.066 + Math.cos(a) * 0.062), Math.sin(a) * 0.04 * (1 - 0.35 * Math.cos(a))];
      }), 0.014, 0.005, true);
      return [
        ['metal', ball(0.034, 18, 12), '#ffd04a', at(0, -0.165, 0)],
        ['metal', hoop(0.03, 0.008, 22, 7), '#ffd04a', at(0, -0.143, 0, 1, Math.PI / 2)],
        ['satin', loop(1), fade('x', 0, 0.13, '#ff5d8f', '#ff8fb0'), at(0, -0.214, 0.008, 1, 0, 0, 0.3)],
        ['satin', loop(-1), fade('x', -0.13, 0, '#ff8fb0', '#ff5d8f'), at(0, -0.214, 0.008, 1, 0, 0, -0.3)],
        ['satin', tail(1), '#f0487c', at(0.004, -0.216, -0.004, 1, 0, 0, 0.12)],
        ['satin', tail(-1), '#ff5d8f', at(-0.004, -0.216, -0.004, 1, 0, 0, -0.06)],
        ['satin', ball(0.027, 14, 10), '#ffb3cb', at(0, -0.214, 0.014, [1.2, 1, 0.8])],
      ];
    },
    // Harbor Map Grip: a sea map rolled up tight, bound with rope, a red cross on it.
    () => [
      ['matte', rod(0.034, 0.034, 0.27, 22), (x, y, z) => col.set('#f1e2b8').lerp(col2.set('#d6bb86'), 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 2 + y * 30)), at(0, -0.005, 0)],
      ['satin', taper(Array.from({ length: 30 }, (_, i) => [Math.sin(i * 0.75) * 0.0348, -0.135 + i * 0.0093, Math.cos(i * 0.75) * 0.0348]), [0.0035], { seg: 110, round: 5 }), '#b08a50'],
      ...[-0.112, 0.1].map((y) => ['matte', hoop(0.037, 0.0085, 24, 7), '#a8703a', at(0, y, 0, 1, Math.PI / 2)]),
      ...[-0.14, 0.13].map((y) => ['matte', hoop(0.026, 0.009, 22, 7), '#e3cf9c', at(0, y, 0, 1, Math.PI / 2)]),
      ...[0.785, -0.785].map((r) => ['matte', new THREE.BoxGeometry(0.03, 0.007, 0.006), '#d8343a', at(0, 0.03, 0.0345, 1, 0, 0, r)]),
      ...Array.from({ length: 5 }, (_, i) => ['matte', ball(0.0042, 6, 4), '#3a5fb8', at(Math.sin(-0.55 + i * 0.15) * 0.0352, -0.06 + i * 0.019, Math.cos(-0.55 + i * 0.15) * 0.0352)]),
    ],
    // Turret Storybook Guard: a storybook lying open across the hilt, a little
    // castle popping up out of each of its pages.
    () => {
      const out = [['satin', rod(0.017, 0.017, 0.165, 12), '#2f4fcf', at(0, 0.152, 0, 1, Math.PI / 2)]];
      for (const s of [-1, 1]) {
        const tilt = s * 0.2;
        const on = (x, y, z) => at(s * x, 0.158 + x * 0.2 + y, z, 1, 0, 0, tilt);
        out.push(['satin', new THREE.BoxGeometry(0.225, 0.016, 0.165), '#2f4fcf', on(0.118, 0, 0)]);
        out.push(['matte', new THREE.BoxGeometry(0.205, 0.026, 0.15), '#fbf2dc', on(0.113, 0.02, 0)]);
        for (let i = 0; i < 4; i++) out.push(['matte', new THREE.BoxGeometry(0.1 - (i % 2) * 0.035, 0.003, 0.009), '#7584c4', on(0.1 - (i % 2) * 0.017, 0.034, -0.05 + i * 0.033)]);
        for (const z of [-1, 1]) out.push(['metal', new THREE.BoxGeometry(0.032, 0.022, 0.032), '#ffd04a', on(0.214, 0, z * 0.068)]);
        // (A pop-up turret, and its flag.)
        const tx = s * 0.17;
        const ty = 0.158 + 0.17 * 0.2 + 0.034;
        out.push(['matte', rod(0.027, 0.027, 0.075, 14), '#f6eee2', at(tx, ty + 0.037, 0)]);
        out.push(['matte', new THREE.BoxGeometry(0.012, 0.022, 0.006), '#4a3a52', at(tx, ty + 0.03, 0.026)]);
        out.push(['gloss', cone(0.037, 0.065, 14), '#e8453c', at(tx, ty + 0.107, 0)]);
        out.push(['metal', rod(0.0025, 0.0025, 0.04, 5), '#8a6a3a', at(tx, ty + 0.155, 0)]);
        out.push(['satin', cut([[0, 0], [0.036, 0.01], [0, 0.022]], 0.003, 0), '#ffd04a', at(tx, ty + 0.152, 0)]);
      }
      return out;
    },
    // Starry Ink Drop: a drop of the night's own ink, stars in it, set in the fold.
    () => [
      ['gem', lathe([[0, -0.05], [0.03, -0.04], [0.042, -0.012], [0.034, 0.02], [0.016, 0.045], [0, 0.066]], 22), fade('y', 0.15, 0.27, '#18268a', '#4f7dff', '#c2d4ff'), at(0, 0.2, 0.092, [1, 1, 0.7])],
      ...[[0.012, 0.19, 0.122, 0.011], [-0.014, 0.178, 0.12, 0.007], [0.0, 0.222, 0.118, 0.008]].map(([x, y, z, r]) => ['glow', cut(starPts(4, r, r * 0.35), 0.002, 0), '#ffffff', at(x, y, z)]),
      ['metal', hoop(0.047, 0.008, 26, 7), '#ffd04a', at(0, 0.196, 0.086)],
    ],
    // Paper Dragon Plume: a great feather off the Paper Dragon, swept up behind the nib.
    () => {
      const len = 0.86;
      const lean = 0.3;
      const way = [-Math.sin(lean), Math.cos(lean), 0];
      return [
        ['satin', cut(feather(len, 0.13), 0.016, 0.006, true), fade('y', 0.2, 1.02, '#2b46c8', '#6f8fff', '#ffe9b0'), at(-0.02, 0.2, -0.055, 1, 0, 0, lean)],
        ['glow', cut(feather(len * 0.84, 0.04), 0.022, 0.002, true), '#d4e0ff', at(-0.02 + way[0] * 0.06, 0.2 + way[1] * 0.06, -0.055, 1, 0, 0, lean)],
        ['satin', rod(0.009, 0.004, len * 0.96, 8), '#fff3d6', along(-0.02 + way[0] * len * 0.48, 0.2 + way[1] * len * 0.48, -0.043, way)],
        ['satin', cut(feather(len * 0.6, 0.09), 0.014, 0.005, true), fade('y', 0.2, 0.72, '#1f2f8f', '#4f6fe0', '#c9d6ff'), at(-0.012, 0.2, -0.072, 1, 0, 0, lean + 0.38)],
        ...Array.from({ length: 6 }, (_, i) => ['glow', ball(0.008, 6, 5), '#fff6d0', at(-0.02 + way[0] * (0.25 + i * 0.1) - 0.045, 0.2 + way[1] * (0.25 + i * 0.1) + 0.01, -0.035)]),
      ];
    },
    // Inkwell Nib: the blade, a pen's golden nib as long as a sword, slit down
    // the middle from a heart, its tip dipped in ink.
    () => {
      const half = [[0, 0.22], [0.075, 0.22], [0.112, 0.3], [0.118, 0.4], [0.1, 0.62], [0.07, 0.9], [0.038, 1.18], [0.012, 1.38], [0, 1.44]];
      const nib = [...half, ...flip(half).reverse().slice(1, -1)];
      const heart = Array.from({ length: 28 }, (_, i) => {
        const t = (i / 28) * TAU;
        return [0.032 * Math.sin(t) ** 3, 0.002 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
      });
      return [
        ['metal', cut(nib, 0.034, 0.012), fade('y', 0.22, 1.44, '#d9901f', '#ffd04a', '#ffe680', '#ffd04a', '#5f7dff')],
        ...[1, -1].map((z) => ['glow', new THREE.BoxGeometry(0.006, 0.68, 0.004), fade('y', 0.7, 1.4, '#c4d4ff', '#4f7dff'), at(0, 1.03, z * 0.031)]),
        ...[1, -1].map((z) => ['glow', cut(heart, 0.004, 0), '#cfe0ff', at(0, 0.66, z * 0.031)]),
        ...[1, -1].flatMap((z) => [1, -1].map((x) => ['metal', taper([[x * 0.05, 0.3, z * 0.03], [x * 0.085, 0.38, z * 0.03], [x * 0.07, 0.5, z * 0.03], [x * 0.04, 0.52, z * 0.03], [x * 0.045, 0.45, z * 0.03]], [0.004], { seg: 24, round: 5 }), '#b8781c'])),
        ['metal', new THREE.BoxGeometry(0.17, 0.03, 0.05), '#d99a2a', at(0, 0.232, 0)],
      ];
    },
  ],
};

// Lullaby's blade and its spine, turned a little round the pole, so that neither
// from behind nor from the side are they a thin line.
const HEAD_TURN = new THREE.Matrix4().makeRotationY(-0.55);
function turned(pieces) {
  return pieces.map(([f, g, c, m = at()]) => [f, g, c, HEAD_TURN.clone().multiply(m)]);
}

// Wet paint over the end of a brush: a drop, its foot running down in drips.
function inkCap() {
  const rows = 22;
  const round = 48;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= rows; i++) {
    const v = i / rows;
    for (let j = 0; j < round; j++) {
      const a = (j / round) * TAU;
      const run = Math.max(0, Math.sin(a * 6 + 0.6)) * (0.6 + 0.4 * Math.sin(a * 3));
      const low = Math.max(0, (v - 0.45) / 0.55);
      const r = 0.004 + 0.142 * Math.sin(Math.min(1, v * 1.06) * Math.PI * 0.5) ** 0.9 * (1 + 0.1 * run * low) + 0.02 * Math.sin(low * Math.PI) * run;
      const y = 1.37 - v * 0.31 - run * low * low * 0.2 - 0.02 * low;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < round; j++) {
      const a = i * round + j;
      const b = i * round + ((j + 1) % round);
      idx.push(a, a + round, b, b, a + round, b + round);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// One of Prisma's seven arcs: a fat round bar of its colour, a light along its
// inside, a curved blade on its outside and a jewel in its middle.
const RING = { y: 0.42, R: 0.36 };
function ringArc(i, color) {
  const step = TAU / 7;
  const gap = 0.05;
  // (The red one at the bottom, where the hand is.)
  const a0 = -Math.PI / 2 - step / 2 + i * step + gap / 2;
  const span = step - gap;
  const { y, R } = RING;
  const round = (r, tube, n = 18, inset = 0) => {
    const g = new THREE.TorusGeometry(r, tube, 9, n, span - inset * 2);
    g.rotateZ(a0 + inset);
    g.translate(0, y, 0);
    return g;
  };
  // Its blade: standing out further the further round, to a point.
  const blade = [];
  const n = 12;
  for (let k = 0; k <= n; k++) blade.push([a0 + (span * k) / n, R + 0.03]);
  for (let k = n; k >= 0; k--) {
    const t = k / n;
    blade.push([a0 + (span * k) / n + 0.04 * t, R + 0.036 + 0.12 * t ** 1.6]);
  }
  const pts = blade.map(([a, r]) => [Math.cos(a) * r, y + Math.sin(a) * r]);
  const light = `#${new THREE.Color(color).lerp(col2.set('#ffffff'), 0.5).getHexString()}`;
  const mid = a0 + span / 2;
  return [
    ['gloss', round(R, 0.046), color],
    ['gloss', cut(pts, 0.02, 0.008), color],
    ['glow', round(R + 0.04, 0.012, 18, 0.03), light],
    ['glow', round(R - 0.054, 0.011, 18, 0.04), light],
    ['gem', gem(0.044, 1), light, at(Math.cos(mid) * R, y + Math.sin(mid) * R, 0, [1, 1, 1.35])],
    ['glow', ball(0.02, 10, 8), light, at(Math.cos(mid) * R, y + Math.sin(mid) * R, 0.05)],
    ['glow', ball(0.02, 10, 8), light, at(Math.cos(mid) * R, y + Math.sin(mid) * R, -0.05)],
    ...[a0 + 0.035, a0 + span - 0.035].map((a) => ['metal', new THREE.TorusGeometry(0.05, 0.011, 8, 20), '#ffd75e', new THREE.Matrix4().compose(V(Math.cos(a) * R, y + Math.sin(a) * R, 0), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(-Math.sin(a), Math.cos(a), 0)), V(1, 1, 1))]),
  ];
}

// ---------------------------------------------------------------- put together

// Pieces of one finish as one shape, each point with its own colour.
function merged(pieces) {
  let count = 0;
  let total = 0;
  for (const [, g] of pieces) {
    count += g.attributes.position.count;
    total += g.index ? g.index.count : g.attributes.position.count;
  }
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const index = count > 65535 ? new Uint32Array(total) : new Uint16Array(total);
  const v = V();
  const nm = new THREE.Matrix3();
  const c = new THREE.Color();
  let n = 0;
  let t = 0;
  for (const [, g, paint, m = at()] of pieces) {
    const p = g.attributes.position;
    const q = g.attributes.normal;
    nm.getNormalMatrix(m);
    if (typeof paint === 'string') c.set(paint);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m).toArray(position, (n + i) * 3);
      if (typeof paint !== 'string') c.copy(paint(v.x, v.y, v.z));
      color.set([c.r, c.g, c.b], (n + i) * 3);
      v.fromBufferAttribute(q, i).applyMatrix3(nm).normalize().toArray(normal, (n + i) * 3);
    }
    const k = g.index ? g.index.count : p.count;
    for (let i = 0; i < k; i++) index[t + i] = n + (g.index ? g.index.array[i] : i);
    n += p.count;
    t += k;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function byFinish(pieces) {
  const groups = new Map();
  for (const p of pieces) {
    if (!groups.has(p[0])) groups.set(p[0], []);
    groups.get(p[0]).push(p);
  }
  return [...groups].map(([finish, list]) => [finish, merged(list)]);
}

// Each made once, whoever draws it.
const shapes = new Map();
function shapesOf(key, pieces) {
  if (!shapes.has(key)) shapes.set(key, byFinish(pieces()));
  return shapes.get(key);
}

function group(list, kit, name) {
  const g = new THREE.Group();
  g.name = name;
  for (const [finish, shape] of list) {
    const m = new THREE.Mesh(shape, kit.material(finish));
    if (finish === 'glow') m.userData.noShadow = true;
    g.add(m);
  }
  return g;
}

// What each finish is like to the light. glow: how much of its own colour shines.
export const FINISHES = {
  metal: { metalness: 0.75, roughness: 0.27, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1.1, shine: 0.05 },
  satin: { metalness: 0.1, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.7, shine: 0.03 },
  matte: { metalness: 0, roughness: 0.88, clearcoat: 0, envMapIntensity: 0.45, shine: 0.02 },
  gloss: { metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85, shine: 0.05 },
  gem: { metalness: 0.1, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2, shine: 0.45 },
};

// A toy material that shines with each point's own colour, shine of it.
class ShinyToy extends ToyMaterial {
  onBeforeCompile(shader) {
    super.onBeforeCompile(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb;');
  }

  customProgramCacheKey() {
    return 'shiny-toy';
  }
}

let kit = null;
// The island's own materials for them: lit as every other toy is.
export function gameKit() {
  if (kit) return kit;
  const made = new Map();
  kit = {
    material(finish) {
      if (!made.has(finish)) {
        if (finish === 'glow') made.set(finish, new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.35, 1.35, 1.35) }));
        else {
          const { shine, ...f } = FINISHES[finish];
          made.set(finish, litByStudio(new ShinyToy({ ...f, vertexColors: true, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: shine })));
        }
      }
      return made.get(finish);
    },
  };
  return kit;
}

// A weapon's part by itself, where it goes in the weapon.
export function soulPart(key, i, kit = gameKit()) {
  const build = PARTS[key]?.[i];
  if (!build) return null;
  const g = group(shapesOf(`${key}|${i}`, build), kit, `part ${key} ${i}`);
  const box = new THREE.Box3();
  for (const m of g.children) box.union(m.geometry.boundingBox);
  g.userData.mid = box.getCenter(V());
  g.userData.size = box.getSize(V()).length();
  return g;
}

// All of a weapon's parts together, as one.
export function soulBody(key, kit = gameKit()) {
  return group(shapesOf(key, () => PARTS[key].flatMap((build) => build())), kit, `soul weapon ${key}`);
}

// How far up each weapon shoots from, and how far up the emblems go round it.
const TIPS = { star: 1.45, rainbow: 0.42, wild: 1.2, bells: 0.8, toon: 1.3, nod: 1.1, book: 1.42 };
const MIDDLE = { star: 0.75, rainbow: 0.42, wild: 0.75, bells: 0.8, toon: 0.85, nod: 0.95, book: 0.8 };

// The little emblem of each soul, going round a weapon it has been combined into.
const EMBLEMS = {
  star: () => [['glow', cut(starPts(5, 1, 0.46), 0.34, 0.1), '#ffe27a']],
  rainbow: () => Array.from({ length: 7 }, (_, i) => {
    const g = new THREE.TorusGeometry(0.72, 0.24, 8, 8, TAU / 7 + 0.02);
    g.rotateZ((i * TAU) / 7);
    return ['glow', g, hue(i / 7.4)];
  }),
  wild: () => [['glow', cut([[0, -1], [0.55, -0.4], [0.62, 0.2], [0.3, 0.75], [0, 1], [-0.3, 0.75], [-0.62, 0.2], [-0.55, -0.4]], 0.2, 0.08, true), '#8fe06a'], ['glow', rod(0.06, 0.05, 2.1, 8), '#d8ffb0', at(0, -0.1, 0.16)]],
  bells: () => [['glow', lathe([[0, 0.95], [0.3, 0.88], [0.45, 0.5], [0.5, 0], [0.7, -0.45], [0.95, -0.7], [0.9, -0.8], [0, -0.8]], 24), '#ffc94a'], ['glow', ball(0.24, 12, 9), '#fff0b0', at(0, -0.9, 0)]],
  toon: () => [['glow', lathe([[0, 1.15], [0.14, 0.75], [0.42, 0.25], [0.66, -0.2], [0.68, -0.6], [0.45, -0.95], [0, -1.05]], 24), (x, y) => col.setHSL((y + 1.1) * 0.42, 0.95, 0.58, THREE.SRGBColorSpace)]],
  nod: () => {
    const pts = [];
    for (let i = 0; i <= 18; i++) pts.push([Math.cos(0.85 + i * 0.255) * 1, Math.sin(0.85 + i * 0.255) * 1]);
    for (let i = 18; i >= 0; i--) pts.push([0.36 + Math.cos(1.1 + i * 0.227) * 0.74, Math.sin(1.1 + i * 0.227) * 0.74]);
    return [['glow', cut(pts, 0.26, 0.08), '#d8c4ff']];
  },
  book: () => [
    ['glow', cut([[0, -0.55], [0.95, -0.3], [0.95, 0.78], [0, 0.5], [-0.95, 0.78], [-0.95, -0.3]], 0.24, 0.08), '#a9c0ff'],
    ['glow', cut(starPts(4, 0.32, 0.12), 0.32, 0.04), '#fff3c4', at(0, 0.12, 0)],
  ],
};

export function soulEmblem(key, kit = gameKit()) {
  return group(shapesOf(`emblem|${key}`, EMBLEMS[key]), kit, `emblem ${key}`);
}

// A soft round glow, the picture of it made by hand (tests draw models with no
// page).
let haloMap = null;
function haloTexture() {
  if (haloMap) return haloMap;
  const s = 64;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = Math.min(1, Math.hypot((x + 0.5) / s - 0.5, (y + 0.5) / s - 0.5) * 2);
      const a = Math.max(0, 1 - r) ** 2.2;
      data.set([255, 255, 255, Math.round(a * 255)], (y * s + x) * 4);
    }
  }
  haloMap = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  haloMap.magFilter = THREE.LinearFilter;
  haloMap.minFilter = THREE.LinearFilter;
  haloMap.needsUpdate = true;
  return haloMap;
}

const halos = new Map();
export function halo(color, size, strength = 0.5) {
  const k = `${color}|${strength}`;
  if (!halos.has(k)) halos.set(k, new THREE.SpriteMaterial({ map: haloTexture(), color, transparent: true, opacity: strength, depthWrite: false, blending: THREE.AdditiveBlending }));
  const s = new THREE.Sprite(halos.get(k));
  s.scale.setScalar(size);
  s.userData.noFlash = true;
  return s;
}

// Where its light gathers, and how far: [x, y, z, how big].
const GLOWS = {
  star: [[0, 0.215, 0, 0.5], [0, 1.3, 0, 0.46], [0, 0.75, 0, 0.6]],
  rainbow: [[0, RING.y, 0, 1.05]],
  wild: [[0, 0.735, 0, 0.6], [-0.42, 0.74, 0, 0.46]],
  bells: [[0, 0.8, 0.1, 0.8]],
  toon: [[0, 1.2, 0, 0.7], [0, 0.85, 0, 0.5]],
  nod: [[0, 1.08, 0, 0.6], [0.4, 1.02, 0.2, 0.6], [-0.185, 0.79, 0, 0.4]],
  book: [[0, 0.95, 0, 0.55], [-0.14, 0.62, -0.05, 0.42], [0, 0.2, 0.09, 0.36]],
};

// A soul weapon whole, as it is in someone's hand: its form, the emblems of the
// souls combined into it going round it, its light. userData.tick(seconds) moves
// what moves of it.
export function soulModel(spec, kit = gameKit(), { glow = true } = {}) {
  const [key, ...rest] = spec.souls;
  const g = new THREE.Group();
  g.name = `weapon ${spec.key}`;
  const body = soulBody(key, kit);
  g.add(body);
  const w = soulOf(key);
  if (glow) {
    for (const [i, [x, y, z, s]] of GLOWS[key].entries()) {
      const h = halo(i % 2 ? w.glow : w.color, s, 0.34);
      h.position.set(x, y, z);
      g.add(h);
    }
  }
  const tip = new THREE.Object3D();
  tip.name = 'tip';
  tip.position.y = TIPS[key];
  g.add(tip);
  const moons = rest.map((k, i) => {
    const m = new THREE.Group();
    const e = soulEmblem(k, kit);
    e.scale.setScalar(0.07);
    m.add(e);
    if (glow) m.add(halo(soulOf(k).color, 0.34, 0.5));
    g.add(m);
    return { m, e, i };
  });
  const mid = MIDDLE[key];
  const r = key === 'rainbow' ? 0.56 : key === 'bells' ? 0.42 : 0.34;
  g.userData.tick = (t) => {
    for (const { m, e, i } of moons) {
      const a = t * 2.1 + (i / moons.length) * TAU;
      m.position.set(Math.sin(a) * r, mid + Math.sin(t * 1.4 + i * 1.9) * 0.16, Math.cos(a) * r);
      e.rotation.y = t * 2.6 + i;
    }
  };
  g.userData.tick(0);
  return g;
}

// The same, by its key in a look ('soul:star+wild'), or null.
export function soulWeaponModel(lookKey, kit = gameKit(), opts = {}) {
  const spec = soulWeapon(lookKey);
  return spec ? soulModel(spec, kit, opts) : null;
}

export const partCount = (key) => PARTS[key]?.length ?? 0;

// The middle of a weapon, and how long it is.
const boxes = new Map();
export function soulBox(key) {
  if (!boxes.has(key)) {
    const box = new THREE.Box3();
    for (const m of soulBody(key).children) box.union(m.geometry.boundingBox);
    const size = box.getSize(V());
    boxes.set(key, { mid: box.getCenter(V()), long: Math.max(size.x, size.y, size.z) });
  }
  return boxes.get(key);
}

export { SOULS };
