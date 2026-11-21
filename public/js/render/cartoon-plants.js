// What grows and lies about on Toon Isle (render/cartoon.js), as a storybook
// draws it: puffball trees with round, glossy crowns of leaves, pines in soft
// tiers, palms with drooping fronds, white birches, bare snags, giant
// toadstools with white spots, ribbed cacti with a flower on top — each from
// its foot in the island's blocks (blocks.js WILD_TREES, TOON_TREES), as big
// as its trunk is tall — and bushes, ferns, reeds, tufts of grass, flowers
// and mushrooms, boulders, logs, and the thorns of an ambush's ring.
//
// Crowns and bushes are heaps of balls lit as one soft round thing (their
// normals bent out from the heap's middle), lighter at the top and darker
// deep inside, so they read as puffs, not as balls. Each kind is drawn two
// ways: in detail near the camera, and in far fewer triangles further off
// (none past the haze); each of those is one instanced mesh, every copy a
// little different in colour. All of it sways a little in the wind, and
// whatever is still under the Cloud Blanket (cartoon-clouds.js) is not drawn
// — clearing, it pops up.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { cartoonMaterial } from './cartoon-light.js';
import { FOG_GLSL } from './cartoon-clouds.js';

const C = (hex) => new THREE.Color(hex);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- shapes

// Parts into one shape. Each part: { g: a geometry, m: where it goes (a
// matrix), color (or colorAt(x, y, z) for one that changes over it), sway
// (how much it sways in the wind: 0 at the foot, 1 at the top of a crown; or
// a function of height), soft: [x, y, z, k] (its normals bent by k towards
// pointing out from that point: one soft round thing of a heap of parts),
// grad: [y0, y1, k0, k1] (its colour times k0 at height y0, up to k1 at y1),
// hollow: [x, y, z, r, k] (darker deep inside a heap: times k at its middle,
// none from r out) }. Gives position, normal, color and sway.
function paint(parts) {
  let count = 0;
  let indices = 0;
  for (const { g } of parts) {
    count += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sway = new Float32Array(count);
  const idx = new Uint32Array(indices);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  const nm = new THREE.Matrix3();
  let v = 0;
  let t = 0;
  for (const part of parts) {
    const { g, m = new THREE.Matrix4(), color, colorAt, sway: s = 0, soft, grad, hollow } = part;
    const ps = g.attributes.position;
    const ns = g.attributes.normal;
    nm.getNormalMatrix(m);
    for (let i = 0; i < ps.count; i++) {
      p.fromBufferAttribute(ps, i).applyMatrix4(m);
      n.fromBufferAttribute(ns, i).applyMatrix3(nm).normalize();
      if (soft) {
        d.set(p.x - soft[0], p.y - soft[1], p.z - soft[2]).normalize();
        n.lerp(d, soft[3]).normalize();
      }
      if (colorAt) c.copy(colorAt(p.x, p.y, p.z));
      else c.copy(color);
      if (grad) {
        const k = Math.max(0, Math.min(1, (p.y - grad[0]) / (grad[1] - grad[0])));
        c.multiplyScalar(grad[2] + (grad[3] - grad[2]) * k);
      }
      if (hollow) {
        const r = Math.hypot(p.x - hollow[0], p.y - hollow[1], p.z - hollow[2]) / hollow[3];
        const k = Math.max(0, Math.min(1, (r - 0.35) / 0.65));
        c.multiplyScalar(hollow[4] + (1 - hollow[4]) * k * k * (3 - 2 * k));
      }
      p.toArray(pos, (v + i) * 3);
      n.toArray(nor, (v + i) * 3);
      c.toArray(col, (v + i) * 3);
      sway[v + i] = typeof s === 'function' ? s(p.y) : s;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[t + i] = g.index.array[i] + v;
    else for (let i = 0; i < ps.count; i++) idx[t + i] = v + i;
    t += g.index ? g.index.count : ps.count;
    v += ps.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

const M = (x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
const V2 = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));

// A lathe's profile with points put in between, none further apart than
// step (so colour can change along it: a birch's marks).
function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

// The geometry for each level of detail: near (fine) or far (coarse).
function detail(fine) {
  return {
    ball: () => new THREE.IcosahedronGeometry(1, fine ? 3 : 1),
    // (A berry, a spot, a petal: small enough for fewer.)
    tiny: () => new THREE.IcosahedronGeometry(1, fine ? 1 : 0),
    round: fine ? 14 : 6,
    lathe: (pts, step = 0.5) => new THREE.LatheGeometry(V2(fine ? resample(pts, step) : pts), fine ? 14 : 6),
    segs: fine ? 6 : 3,
  };
}

// Bend a geometry over as it goes up: x moved by k times height squared.
function bend(g, k) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + k * p.getY(i) * p.getY(i));
  g.computeVertexNormals();
  return g;
}

// A leaf or a blade: a strip from the origin out along x, drooping as it
// goes, widest a third of the way along and coming to a point, with a crease
// down its middle; its top and its underside both drawn.
function leafGeo(len, width, droop, segs = 6, { pointed = 1 } = {}) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = len * t;
    const y = -droop * len * t * t;
    const w = width * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** (pointed ? 0.9 : 0.4);
    pos.push(x, y - w * 0.18, -w, x, y + w * 0.12, 0, x, y - w * 0.18, w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  top.setIndex(idx);
  top.computeVertexNormals();
  // The underside: the same points, the other way round.
  const under = top.clone();
  const u = under.index.array;
  for (let i = 0; i < u.length; i += 3) [u[i + 1], u[i + 2]] = [u[i + 2], u[i + 1]];
  const un = under.attributes.normal;
  for (let i = 0; i < un.count; i++) un.setXYZ(i, -un.getX(i), -un.getY(i), -un.getZ(i));
  return merge([top, under]);
}

// Geometries (indexed, with normals) into one.
function merge(list) {
  return paint(list.map((g) => ({ g, color: C('#ffffff') })));
}

// A heap of balls, lit as one soft round thing: balls as [x, y, z, sx, sy,
// sz]; its colour (or two, by turns), lighter at the top, darker deep inside.
function heap(q, balls, color, { sway = 0, alt = null, centre = null, top = 1.12, low = 0.72, soft = 0.6, inside = 0.68 } = {}) {
  let lo = Infinity;
  let hi = -Infinity;
  const c = centre ?? [0, 0, 0];
  if (!centre) {
    for (const [x, y, z] of balls) {
      c[0] += x / balls.length;
      c[1] += y / balls.length;
      c[2] += z / balls.length;
    }
  }
  let reach = 0;
  for (const [x, y, z, sx, sy = sx, sz = sx] of balls) {
    lo = Math.min(lo, y - sy);
    hi = Math.max(hi, y + sy);
    reach = Math.max(reach, Math.hypot(x - c[0], y - c[1], z - c[2]) + Math.max(sx, sy, sz));
  }
  return balls.map(([x, y, z, sx, sy = sx, sz = sx], i) => ({
    g: q.ball(),
    m: M(x, y, z, sx, sy, sz),
    color: alt && i % 2 ? alt : color,
    sway,
    soft: [c[0], c[1], c[2], soft],
    grad: [lo, hi, low, top],
    hollow: [c[0], c[1], c[2], reach, inside],
  }));
}

// A tree's sway: none up its trunk, more and more up its crown.
const crownSway = (from, to) => (y) => Math.max(0, Math.min(1, (y - from) / Math.max(0.1, to - from)));

// Each corner's leaves: a crown's two greens, a pine's, a birch's.
const LEAVES = {
  toonbay: { leaf: '#54d13f', alt: '#3fbf4a', pine: '#2fa35a', birch: '#b8e04a' },
  toonwood: { leaf: '#3fc455', alt: '#2fae58', pine: '#23905a', birch: '#a6dc4c' },
  tooncanyon: { leaf: '#8fd43f', alt: '#6cc240', pine: '#3d9d54', birch: '#d6d64a' },
  toonpeak: { leaf: '#4fcf6a', alt: '#3cb86a', pine: '#2a9070', birch: '#b4e06a' },
  toonstorm: { leaf: '#46a878', alt: '#3a9474', pine: '#2c7a68', birch: '#9ec27a' },
};

// Each species, built for a trunk of `std` blocks over its foot (drawn
// bigger or smaller for taller or shorter ones), in its colours by the
// corner of the island (theme), in detail or not (fine).
function treeShape(model, theme, fine) {
  const q = detail(fine);
  const pal = LEAVES[theme] ?? LEAVES.toonbay;
  const bark = C(theme === 'toonstorm' ? '#7d5a52' : '#9a6240');
  switch (model) {
    case 'oak': {
      // A puffball tree: a round crown, a heap of balls, on a trunk that
      // flares at its foot.
      const s = crownSway(2.4, 6);
      const balls = [
        [0, 4.3, 0, 1.7, 1.5, 1.7],
        [1.25, 3.85, 0.35, 1.08],
        [-1.15, 3.95, -0.5, 1.05],
        [-0.3, 3.75, 1.2, 1.0],
        [0.55, 3.8, -1.15, 0.98],
        [-0.75, 4.95, 0.3, 0.95],
        [0.5, 5.15, -0.2, 1.0],
        [1.0, 4.75, 0.9, 0.82],
      ];
      return {
        std: 3,
        geo: paint([
          { g: bend(q.lathe([[0, 0], [0.5, 0], [0.34, 0.25], [0.26, 1.1], [0.22, 2.4], [0.16, 3.6], [0, 3.7]]), 0.012), color: bark, grad: [0, 3.5, 0.8, 1.05] },
          { g: bend(q.lathe([[0, 0], [0.12, 0], [0.08, 1.0], [0, 1.05]]), 0.3), m: M(0.1, 2.5, 0, 1, 1, 1, 0, 0.6, -0.9), color: bark },
          ...heap(q, balls, C(pal.leaf), { sway: s, alt: C(pal.alt), centre: [0, 4.2, 0] }),
        ]),
      };
    }
    case 'pine': {
      // Soft tiers, each a cone with a round rim.
      const needle = C(pal.pine);
      const s = crownSway(1, 6);
      const tier = (r, h) => q.lathe([[0, -0.02], [r * 0.9, 0], [r, 0.1], [r * 0.9, 0.24], [r * 0.55, h * 0.55], [r * 0.18, h * 0.9], [0, h]]);
      const parts = [{ g: q.lathe([[0, 0], [0.34, 0], [0.22, 0.3], [0.18, 1.8], [0, 1.9]]), color: bark, grad: [0, 1.8, 0.8, 1] }];
      const tiers = [[1.95, 2.3, 1.15], [1.55, 2.1, 2.45], [1.1, 1.9, 3.65], [0.65, 1.3, 4.7]];
      for (const [r, h, y] of tiers) parts.push({ g: tier(r, h), m: M(0, y, 0), color: needle, sway: s, soft: [0, y + h * 0.2, 0, 0.35], grad: [1.1, 6, 0.75, 1.15] });
      if (theme === 'toonpeak' || theme === 'toonstorm') {
        const snow = C('#ffffff');
        for (const [r, h, y] of tiers) parts.push({ g: q.lathe([[0, h * 0.55], [r * 0.56, h * 0.52], [r * 0.6, h * 0.6], [r * 0.2, h * 0.92], [0, h + 0.02]]), m: M(0, y + 0.01, 0), color: snow, sway: s, soft: [0, y, 0, 0.3] });
      }
      return { std: 4, geo: paint(parts) };
    }
    case 'palm': {
      // A curving trunk of rings, a crown of drooping fronds, coconuts.
      const trunk = [C('#c08a52'), C('#a5703f')];
      const frond = C(pal.leaf);
      const parts = [];
      let x = 0;
      let y = 0;
      const rings = fine ? 9 : 5;
      const step = 5.4 / rings;
      for (let i = 0; i < rings; i++) {
        const lean = 0.05 + i * (0.3 / rings);
        const r = 0.27 - i * (0.1 / rings);
        parts.push({ g: q.lathe([[0, 0], [r * 1.12, 0], [r * 1.18, step * 0.25], [r * 0.95, step * 1.02], [0, step * 1.05]]), m: M(x, y, 0, 1, 1, 1, 0, 0, -lean), color: trunk[i % 2], sway: i / (rings * 1.5) });
        x += Math.sin(lean) * step;
        y += Math.cos(lean) * step;
      }
      const leaf = leafGeo(2.6, 0.42, 0.32, q.segs);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        parts.push({ g: leaf, m: M(x, y, 0, 1, 1, 1, 0, -a, 0.35 + (k % 2) * 0.2), color: k % 2 ? frond : frond.clone().multiplyScalar(0.88), sway: 1, grad: [y - 2, y + 0.4, 0.8, 1.12] });
      }
      for (let k = 0; k < 3; k++) parts.push({ g: q.tiny(), m: M(x + Math.cos(k * 2.1) * 0.28, y - 0.3, Math.sin(k * 2.1) * 0.28, 0.24), color: C('#7a4f2a'), sway: 0.8, grad: [y - 0.6, y, 0.8, 1.1] });
      return { std: 4, geo: paint(parts) };
    }
    case 'birch': {
      const white = C('#f4efe2');
      const mark = C('#4a403a');
      const s = crownSway(2.5, 6.5);
      const marks = (x, y, z) => (Math.sin(y * 9.1 + Math.sin(Math.atan2(z, x) * 3) * 1.2) > 0.8 && y > 0.3 && y < 3.4 ? mark : white);
      const balls = [
        [0, 4.4, 0, 1.25, 1.75, 1.25],
        [0.75, 3.75, 0.35, 0.9],
        [-0.6, 3.95, -0.4, 0.88],
        [0.1, 5.5, 0.1, 0.85],
        [-0.3, 3.6, 0.7, 0.75],
      ];
      return {
        std: 3,
        geo: paint([
          { g: bend(q.lathe([[0, 0], [0.32, 0], [0.22, 0.25], [0.19, 2], [0.15, 3.8], [0, 3.9]], 0.08), 0.01), colorAt: marks, grad: [0, 3.6, 0.85, 1.02] },
          ...heap(q, balls, C(pal.birch), { sway: s, centre: [0, 4.3, 0] }),
        ]),
      };
    }
    case 'snag': {
      const dead = C(theme === 'toonstorm' ? '#6f6270' : '#8f7764');
      const branch = (len, r) => bend(q.lathe([[0, 0], [r, 0], [r * 0.7, len * 0.6], [r * 0.3, len], [0, len * 1.02]]), 0.15);
      return {
        std: 3,
        geo: paint([
          { g: bend(q.lathe([[0, 0], [0.46, 0], [0.3, 0.3], [0.24, 1.6], [0.16, 2.6], [0, 2.7]]), 0.03), color: dead, grad: [0, 2.6, 0.8, 1.05] },
          { g: branch(1.6, 0.14), m: M(-0.05, 2.0, 0, 1, 1, 1, 0, 0.4, 0.6), color: dead, sway: 0.3 },
          { g: branch(1.3, 0.12), m: M(0.06, 1.45, 0, 1, 1, 1, 0, 2.3, 0.7), color: dead, sway: 0.3 },
          { g: branch(1.0, 0.1), m: M(0.12, 2.35, 0.05, 1, 1, 1, 0, -1.2, 0.45), color: dead, sway: 0.4 },
        ]),
      };
    }
    case 'toadstool': {
      // A giant toadstool: a fat cream stem with a frilly skirt, a glossy
      // red cap with a rolled rim and white spots.
      const stem = C('#fbf3df');
      const cap = C(theme === 'toonwood' ? '#ff4545' : '#ff5248');
      const dots = C('#ffffff');
      // (Lathe profiles go round counter-clockwise, from the axis at the
      // bottom, so their faces face out.)
      const capPts = [[0, 0.12], [0.4, 0.1], [1.6, 0.02], [1.92, -0.02], [2.05, 0.1], [2.02, 0.3], [1.78, 0.7], [1.35, 1.12], [0.7, 1.36], [0, 1.42]];
      const parts = [
        { g: q.lathe([[0, 0], [0.72, 0], [0.62, 0.25], [0.5, 1.2], [0.48, 2.2], [0.56, 2.62], [0, 2.66]]), color: stem, grad: [0, 2.6, 0.82, 1.02] },
        { g: q.lathe([[0.5, -0.12], [0.8, -0.32], [0.75, -0.25], [0.45, 0.05]]), m: M(0, 2.0, 0), color: stem.clone().multiplyScalar(0.95) },
        { g: q.lathe(capPts), m: M(0, 2.55, 0), color: cap, sway: 0.12, soft: [0, 2.0, 0, 0.2], grad: [2.5, 4.0, 0.82, 1.1] },
      ];
      // White spots on the cap, each lying on it: how high the cap's top is
      // this far out, and how steep.
      const top = [[0, 1.42], [0.7, 1.36], [1.35, 1.12], [1.78, 0.7], [2.02, 0.3]];
      const capAt = (r) => {
        for (let i = 1; i < top.length; i++) {
          const [r0, y0] = top[i - 1];
          const [r1, y1] = top[i];
          if (r <= r1) return [y0 + ((y1 - y0) * (r - r0)) / (r1 - r0), Math.atan2(y0 - y1, r1 - r0)];
        }
        return [0.3, 1.2];
      };
      for (let k = 0; k < 10; k++) {
        const a = k * 2.39996;
        const r = k === 0 ? 0 : 0.75 + (k % 3) * 0.42;
        const [yy, slope] = capAt(r);
        const size = 0.3 - (k % 2) * 0.07;
        parts.push({ g: q.tiny(), m: M(Math.cos(a) * r, 2.55 + yy + 0.01, Math.sin(a) * r, size, 0.07, size, 0, -a, -slope), color: dots, sway: 0.12 });
      }
      return { std: 3, geo: paint(parts) };
    }
    case 'cactus': {
      // Ribbed arms and a flower on top.
      const green = C('#3fbf5a');
      const ribbed = (r, h) => {
        const g = new THREE.CapsuleGeometry(r, h, q.segs, q.round + 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const a = Math.atan2(p.getZ(i), p.getX(i));
          const k = 1 + 0.09 * Math.cos(a * 8);
          p.setX(i, p.getX(i) * k);
          p.setZ(i, p.getZ(i) * k);
        }
        g.computeVertexNormals();
        return g;
      };
      const parts = [
        { g: ribbed(0.48, 2.6), m: M(0, 1.75, 0), color: green, grad: [0, 3.6, 0.8, 1.1] },
        { g: ribbed(0.3, 0.6), m: M(0.62, 1.5, 0, 1, 1, 1, 0, 0, Math.PI / 2), color: green },
        { g: ribbed(0.3, 0.9), m: M(0.98, 2.05, 0), color: green, grad: [1.5, 2.8, 0.85, 1.1] },
        { g: ribbed(0.27, 0.5), m: M(-0.55, 2.2, 0, 1, 1, 1, 0, 0, Math.PI / 2), color: green },
        { g: ribbed(0.27, 0.6), m: M(-0.82, 2.62, 0), color: green, grad: [2, 3.2, 0.85, 1.1] },
      ];
      const petal = C('#ff6fae');
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        parts.push({ g: q.tiny(), m: M(Math.cos(a) * 0.17, 3.58, Math.sin(a) * 0.17, 0.17, 0.07, 0.11, 0, -a, 0.3), color: petal });
      }
      parts.push({ g: q.tiny(), m: M(0, 3.62, 0, 0.1), color: C('#ffd23f') });
      return { std: 3, geo: paint(parts) };
    }
    default:
      return treeShape('oak', theme, fine);
  }
}

// What a tree foot of the island's blocks is: its species.
const SPECIES = new Map([
  [B.WILD_OAK, 'oak'],
  [B.WILD_PINE, 'pine'],
  [B.WILD_PALM, 'palm'],
  [B.WILD_BIRCH, 'birch'],
  [B.WILD_SNAG, 'snag'],
  [B.TOON_SHROOM, 'toadstool'],
  [B.TOON_CACTUS, 'cactus'],
]);

// The little things, by block: each its shape, and how much it sways.
const FLOWER_COLORS = new Map([
  [B.TULIP, '#ff4f78'],
  [B.DAISY, '#ffffff'],
  [B.SUNFLOWER, '#ffcf2a'],
  [B.COSMOS, '#ff86d6'],
  [B.BLUEBELL, '#6f8dff'],
]);

// A flower: five round petals round a middle, on a stem with two leaves.
function flower(q, head, middle, h = 0.5, size = 1) {
  const stem = C('#45b04c');
  const parts = [
    { g: q.lathe([[0, 0], [0.035, 0], [0.028, h], [0, h + 0.01]]), color: stem, sway: (y) => y / h },
    { g: leafGeo(0.26, 0.07, 0.4, 3), m: M(0, h * 0.25, 0, 1, 1, 1, 0, 0.5, 0.6), color: stem, sway: 0.3 },
    { g: leafGeo(0.22, 0.06, 0.4, 3), m: M(0, h * 0.4, 0, 1, 1, 1, 0, 3.6, 0.6), color: stem, sway: 0.4 },
  ];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    parts.push({ g: q.tiny(), m: M(Math.cos(a) * 0.1 * size, h + 0.02, Math.sin(a) * 0.1 * size, 0.09 * size, 0.035 * size, 0.065 * size, 0, -a, 0.25), color: head, sway: 1, grad: [h - 0.03, h + 0.05, 0.85, 1.08] });
  }
  parts.push({ g: q.tiny(), m: M(0, h + 0.05, 0, 0.055 * size, 0.04 * size, 0.055 * size), color: middle, sway: 1 });
  return parts;
}

function smallShape(id, theme, fine) {
  const q = detail(fine);
  const pal = LEAVES[theme] ?? LEAVES.toonbay;
  if (id === B.BUSH) {
    const g = C(pal.alt);
    const parts = heap(q, [[0, 0.5, 0, 0.6, 0.52, 0.6], [0.42, 0.36, 0.15, 0.42], [-0.36, 0.38, -0.2, 0.44], [0.05, 0.34, 0.45, 0.4], [-0.15, 0.75, 0.1, 0.38]], g, { sway: 0.25, alt: C(pal.leaf), centre: [0, 0.35, 0], low: 0.7 });
    // Berries.
    for (const [x, y, z] of [[0.5, 0.55, 0.3], [-0.3, 0.7, 0.42], [0.2, 0.95, -0.25], [-0.55, 0.45, -0.3]]) parts.push({ g: q.tiny(), m: M(x, y, z, 0.07), color: C('#ff3f5a'), sway: 0.25 });
    return paint(parts);
  }
  if (id === B.FERN) {
    const g = C(pal.alt);
    const parts = [];
    const leaf = leafGeo(0.75, 0.16, 0.7, q.segs);
    for (let k = 0; k < 7; k++) parts.push({ g: leaf, m: M(0, 0.05, 0, 1, 1, 1, 0, -k * 0.9, 0.75 + (k % 2) * 0.25), color: k % 2 ? g : g.clone().multiplyScalar(1.12), sway: (y) => 0.3 + y, grad: [0, 0.5, 0.75, 1.1] });
    return paint(parts);
  }
  if (id === B.REEDS) {
    const g = C('#79c24a');
    const top = C('#8a5534');
    const parts = [];
    for (let k = 0; k < 5; k++) {
      const a = k * 1.7;
      parts.push({ g: q.lathe([[0, 0], [0.05, 0], [0.035, 1.5], [0, 1.52]]), m: M(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22, 1, 0.8 + (k % 3) * 0.15, 1, 0.1, a, 0), color: g, sway: (y) => y / 1.6 });
      if (k % 2 === 0) parts.push({ g: new THREE.CapsuleGeometry(0.08, 0.26, 2, q.round), m: M(Math.cos(a) * 0.24, 1.45, Math.sin(a) * 0.24), color: top, sway: 1 });
    }
    for (let k = 0; k < 3; k++) parts.push({ g: leafGeo(0.8, 0.07, 0.25, q.segs), m: M(0, 0, 0, 1, 1, 1, 0, k * 2.1, 1.2), color: g, sway: (y) => y / 1.2 });
    return paint(parts);
  }
  if (id === B.TALL_GRASS) {
    const g = C(pal.leaf);
    const parts = [];
    for (let k = 0; k < 7; k++) parts.push({ g: leafGeo(0.55 + (k % 3) * 0.12, 0.07, 0.35, q.segs), m: M(0, 0, 0, 1, 1, 1, 0, k * 0.9, 1.05 + (k % 2) * 0.2), color: k % 2 ? g : g.clone().multiplyScalar(0.9), sway: (y) => y / 0.6, grad: [0, 0.6, 0.7, 1.15] });
    return paint(parts);
  }
  if (id === B.MUSHROOM) {
    const parts = [
      { g: q.lathe([[0, 0], [0.09, 0], [0.07, 0.2], [0.08, 0.3], [0, 0.31]]), color: C('#fbf3df') },
      { g: q.lathe([[0, 0.02], [0.2, -0.01], [0.24, 0.02], [0.22, 0.1], [0.13, 0.18], [0, 0.2]]), m: M(0, 0.28, 0), color: C('#ff4f45'), grad: [0.28, 0.5, 0.85, 1.1] },
    ];
    for (let k = 0; k < 4; k++) parts.push({ g: q.tiny(), m: M(Math.cos(k * 1.7) * 0.11, 0.45 - (k ? 0.03 : -0.02), Math.sin(k * 1.7) * 0.11, 0.04, 0.015, 0.04), color: C('#ffffff') });
    return paint(parts);
  }
  if (FLOWER_COLORS.has(id)) {
    const head = C(FLOWER_COLORS.get(id));
    const middle = C(id === B.SUNFLOWER ? '#7a4a1e' : '#ffd23f');
    return paint(flower(q, head, middle, id === B.SUNFLOWER ? 0.62 : 0.48, id === B.SUNFLOWER ? 1.5 : 1));
  }
  if (id === B.BOULDER) {
    const g = q.ball();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 + 0.1 * Math.sin(x * 3.1 + z * 2.3) + 0.06 * Math.sin(y * 4.3 - x * 1.7);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return paint([{ g, m: M(0, 0.4, 0, 0.66, 0.5, 0.62), color: C(theme === 'toonstorm' ? '#9c90c4' : theme === 'tooncanyon' ? '#d9a07a' : '#b9b2d2'), grad: [0, 0.9, 0.78, 1.08] }]);
  }
  if (id === B.LOGS) {
    const wood = C('#a8703f');
    const end = C('#f2cf96');
    const log = (r) => new THREE.CylinderGeometry(r, r, 0.95, q.round, 1);
    return paint([
      { g: log(0.28), m: M(0, 0.28, -0.22, 1, 1, 1, 0, 0, Math.PI / 2), color: wood },
      { g: new THREE.CylinderGeometry(0.22, 0.22, 0.97, q.round, 1), m: M(0, 0.28, -0.22, 1, 1, 1, 0, 0, Math.PI / 2), color: end },
      { g: log(0.26), m: M(0, 0.26, 0.26, 1, 1, 1, 0, 0, Math.PI / 2), color: wood.clone().multiplyScalar(0.92) },
      { g: new THREE.CylinderGeometry(0.2, 0.2, 0.97, q.round, 1), m: M(0, 0.26, 0.26, 1, 1, 1, 0, 0, Math.PI / 2), color: end },
      { g: log(0.25), m: M(0, 0.7, 0.02, 1, 1, 1, 0, 0.4, Math.PI / 2), color: wood.clone().multiplyScalar(0.86) },
      { g: new THREE.CylinderGeometry(0.19, 0.19, 0.97, q.round, 1), m: M(0, 0.7, 0.02, 1, 1, 1, 0, 0.4, Math.PI / 2), color: end },
    ]);
  }
  if (id === B.BRAMBLE) {
    // A thorny hedge: a dark heap, yellow thorns all over it.
    const vine = C('#2c8a4a');
    const thorn = C('#f0d46a');
    const parts = heap(q, [[0, 0.5, 0, 0.6, 0.58, 0.6], [0.3, 0.75, 0.2, 0.36], [-0.28, 0.7, -0.22, 0.36]], vine, { centre: [0, 0.5, 0], low: 0.65 });
    for (let k = 0; k < 10; k++) {
      const a = k * 0.628;
      const up = k % 2 ? 0.55 : 1.25;
      parts.push({ g: q.lathe([[0, 0], [0.07, 0], [0, 0.3]]), m: M(Math.cos(a) * Math.sin(up) * 0.56, 0.5 + Math.cos(up) * 0.56, Math.sin(a) * Math.sin(up) * 0.56, 1, 1, 1, 0, -a, -up), color: thorn });
    }
    return paint(parts);
  }
  return null;
}

// ---------------------------------------------------------------- the material

// The one material for all of it: vertex colours in the storybook light,
// swaying by `sway`, each copy popping up out of the Cloud Blanket as it
// clears (cartoon-clouds.js), and not drawn under it. (And the same shape in
// the sun's shadow map, so nothing under the blanket casts a shadow.)
const VERTEX_HOOK = (shader) => {
  shader.vertexShader = `${FOG_GLSL}\nattribute float sway;\n${shader.vertexShader}`.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
      vec3 at = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float pop = fogPop(fogClear(at.xz));
      float phase = at.x * 0.37 + at.z * 0.29;
      transformed.x += sway * 0.07 * sin(uTime * 1.7 + phase);
      transformed.z += sway * 0.05 * sin(uTime * 1.3 + phase * 1.3);
      transformed *= pop;
    }`,
  );
};

function plantMaterial(fog) {
  return cartoonMaterial({ vertexColors: true, roughness: 0.55, envMapIntensity: 0.22 }, { key: 'cartoon-plants', uniforms: fog, vertex: VERTEX_HOOK });
}

function plantDepth(fog) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fog);
    VERTEX_HOOK(shader);
  };
  m.customProgramCacheKey = () => 'cartoon-plants-depth';
  return m;
}

// ---------------------------------------------------------------- all of it

// How far from the camera each is drawn in detail (trees, small things), and
// past how far not at all (trees: in the haze; small things sooner, too
// small to see), and how far the camera goes before they are sorted again.
const NEAR_TREE = 50;
const NEAR_SMALL = 34;
const FAR_SMALL = 90;
const RESORT = 6;

export class CartoonPlants {
  // ground: the skin (real-ground.js RealGround), for standing each on it;
  // fog: the Cloud Blanket's uniforms (cartoon-clouds.js fogUniforms).
  constructor(world, ground, fog) {
    this.world = world;
    this.ground = ground;
    this.fog = fog;
    this.theme = world.theme;
    this.group = new THREE.Group();
    this.group.name = 'cartoon plants';
    this.material = plantMaterial(fog);
    this.depth = plantDepth(fog);
    this.shapes = new Map();
    // Each kind drawn: its copies (where each stands, its matrix and its
    // colour) and its two meshes, near and far.
    this.kinds = new Map();
    // How far off nothing is drawn (the haze's end), set by the renderer.
    this.far = 200;
    this.sortedAt = null;
    // Every cell with something of these in it: its kind, by cell.
    this.cells = new Map();
    const { W, D, H } = world;
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const base = (x * D + z) * H;
        for (let y = 1; y < H; y++) {
          const id = world.blocks[base + y];
          if (id && this.kindOf(id)) this.cells.set(base + y, id);
        }
      }
    }
    this.rebuild();
  }

  // What a block is drawn as here: a tree's species, a small thing's block,
  // or nothing.
  kindOf(id) {
    if (SPECIES.has(id)) return `tree:${SPECIES.get(id)}`;
    if (id === B.BUSH || id === B.FERN || id === B.REEDS || id === B.TALL_GRASS || id === B.MUSHROOM || id === B.BOULDER || id === B.LOGS || id === B.BRAMBLE || FLOWER_COLORS.has(id)) return `small:${id}`;
    return null;
  }

  // A kind's shapes, near and far.
  shapeOf(kind) {
    let s = this.shapes.get(kind);
    if (s !== undefined) return s;
    if (kind.startsWith('tree:')) {
      const near = treeShape(kind.slice(5), this.theme, true);
      s = { std: near.std, near: near.geo, far: treeShape(kind.slice(5), this.theme, false).geo };
    } else {
      const id = Number(kind.slice(6));
      const near = smallShape(id, this.theme, true);
      s = near ? { std: 0, near, far: smallShape(id, this.theme, false) } : null;
    }
    this.shapes.set(kind, s);
    return s;
  }

  // Every copy of everything placed again from the cells (as the island is
  // first drawn, and after a change: an ambush's thorns, a beacon's logs).
  rebuild() {
    for (const k of this.kinds.values()) {
      for (const mesh of [k.near, k.far]) {
        this.group.remove(mesh);
        mesh.dispose();
      }
    }
    this.kinds.clear();
    const { world } = this;
    const { D, H } = world;
    const byKind = new Map();
    for (const [i, id] of this.cells) {
      const kind = this.kindOf(id);
      if (!kind) continue;
      let list = byKind.get(kind);
      if (!list) byKind.set(kind, (list = []));
      list.push(i);
    }
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const tint = new THREE.Color();
    for (const [kind, list] of byKind) {
      const shape = this.shapeOf(kind);
      if (!shape) continue;
      const tree = kind.startsWith('tree:');
      const copies = [];
      for (const i of list) {
        const y = i % H;
        const z = Math.floor(i / H) % D;
        const x = Math.floor(i / H / D);
        const h = (x * 7919 + z * 104729) % 997;
        const turn = (h / 997) * Math.PI * 2;
        let size = 1;
        if (tree) {
          // As big as its trunk is tall.
          let trunk = 0;
          while (world.get(x, y + 1 + trunk, z) === B.TREE_CORE) trunk++;
          size = (trunk + 1.2) / (shape.std + 1.2);
          size *= 0.92 + (h % 17) / 100;
        } else if (kind === `small:${B.BOULDER}`) size = 0.85 + (h % 30) / 100;
        else size = 0.85 + (h % 25) / 100;
        const lift = this.ground.lift(x + 0.5, y, z + 0.5, 0.3);
        // (Logs in a row lie along it; a heap of them is a beacon's.)
        const along = kind === `small:${B.LOGS}` ? (world.get(x + 1, y, z) === B.LOGS || world.get(x - 1, y, z) === B.LOGS ? 0 : world.get(x, y, z + 1) === B.LOGS || world.get(x, y, z - 1) === B.LOGS ? Math.PI / 2 : turn) : turn;
        q.setFromAxisAngle(UP, along);
        p.set(x + 0.5, y + lift - (tree ? 0.15 : 0), z + 0.5);
        s.set(size, size, size);
        // Each a little lighter or darker, warmer or cooler than the next.
        const v = ((h * 31) % 100) / 100;
        tint.setRGB(0.92 + 0.14 * v, 0.94 + 0.1 * ((h * 17) % 100) / 100, 0.93 + 0.1 * (1 - v));
        copies.push({ x: p.x, z: p.z, m: new THREE.Matrix4().compose(p, q, s), c: tint.clone() });
      }
      const mesh = (geo, near) => {
        const m = new THREE.InstancedMesh(geo, this.material, copies.length);
        m.customDepthMaterial = this.depth;
        m.castShadow = near && (tree || kind === `small:${B.BOULDER}` || kind === `small:${B.BRAMBLE}` || kind === `small:${B.BUSH}`);
        m.receiveShadow = true;
        m.name = `${kind} ${near ? 'near' : 'far'}`;
        m.count = 0;
        this.group.add(m);
        return m;
      };
      this.kinds.set(kind, { copies, near: mesh(shape.near, true), far: mesh(shape.far, false), reach: tree ? NEAR_TREE : NEAR_SMALL, gone: tree ? Infinity : FAR_SMALL });
    }
    this.sortedAt = null;
    if (this.camera) this.sort(this.camera);
  }

  // Each frame: once the camera has gone far enough, which copies are near
  // (in detail), which far, and which past the haze (none).
  update(camera, far = this.far) {
    this.camera = camera;
    this.far = far;
    const at = camera.position;
    if (this.sortedAt && Math.hypot(at.x - this.sortedAt.x, at.z - this.sortedAt.z) < RESORT) return;
    this.sort(camera);
  }

  sort(camera) {
    const at = camera.position;
    this.sortedAt = { x: at.x, z: at.z };
    for (const k of this.kinds.values()) {
      const gone = Math.min(k.gone, this.far + 12);
      let n = 0;
      let f = 0;
      for (const c of k.copies) {
        const d = Math.hypot(c.x - at.x, c.z - at.z);
        if (d < k.reach) {
          k.near.setMatrixAt(n, c.m);
          k.near.setColorAt(n++, c.c);
        } else if (d < gone) {
          k.far.setMatrixAt(f, c.m);
          k.far.setColorAt(f++, c.c);
        }
      }
      for (const [mesh, count] of [[k.near, n], [k.far, f]]) {
        mesh.count = count;
        mesh.visible = count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }

  // Blocks changed: the cells of what is drawn here taken in, and drawn again
  // if any of it was.
  cellsChanged(cells) {
    const { D, H } = this.world;
    let any = false;
    for (let i = 0; i < cells.length; i += 4) {
      const k = (cells[i] * D + cells[i + 2]) * H + cells[i + 1];
      const id = cells[i + 3];
      const was = this.cells.has(k);
      if (this.kindOf(id)) {
        this.cells.set(k, id);
        any = true;
      } else if (was) {
        this.cells.delete(k);
        any = true;
      }
      // A tree's trunk growing or going changes how big it is drawn.
      if (id === B.TREE_CORE) any = true;
    }
    if (any) this.rebuild();
  }

  dispose() {
    for (const k of this.kinds.values()) {
      k.near.dispose();
      k.far.dispose();
    }
    for (const s of this.shapes.values()) {
      s?.near.dispose();
      s?.far.dispose();
    }
    this.material.dispose();
    this.depth.dispose();
  }
}
