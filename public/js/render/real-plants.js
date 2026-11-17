// What grows on the Wild Isle (render/real.js), as real plants rather than
// blocks: trees grown from a seed — an oak's spreading limbs and leafy
// crown, a pine's whorls of needled branches, a palm's curving trunk and
// fronds, a birch's white trunk, a dead tree's bare branches — each species
// in a few shapes, every tree of a shape drawn at once (instanced) and turned
// and sized a little differently; the plants the map put down (ferns, bushes,
// reeds, tall grass, flowers, mushrooms); and a carpet of grass blades over
// the meadows near you, swaying in the wind.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { Rng } from '../shared/rng.js';
import { FOLIAGE, foliageTexture, LEAF, MAT, realMaterials } from './real-textures.js';

const TREE_KINDS = { [B.WILD_OAK]: 'oak', [B.WILD_PINE]: 'pine', [B.WILD_PALM]: 'palm', [B.WILD_BIRCH]: 'birch', [B.WILD_SNAG]: 'snag' };
const VARIANTS = 3;

// ---------------------------------------------------------------- shapes

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Geometry in the making: positions, normals, uvs, colours (shade) and indices.
class Shape {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  vertex(p, n, u, v, shade = 1) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.uv.push(u, v);
    this.col.push(shade, shade, shade);
    return this.pos.length / 3 - 1;
  }

  // A limb along points, radius r at each, with sides round it: bark wrapped
  // round it, the picture's v running up it in blocks / scale.
  tube(points, radii, sides, scale = 1.6, shade = 1) {
    const first = norm(sub(points[1], points[0]));
    let a = norm(cross(first, Math.abs(first[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    let v = 0;
    const rings = [];
    for (let i = 0; i < points.length; i++) {
      const dir = norm(sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]));
      // (The frame carried along the limb without twisting.)
      a = norm(sub(a, dir.map((x) => x * (a[0] * dir[0] + a[1] * dir[1] + a[2] * dir[2]))));
      const b = cross(dir, a);
      if (i) v += len(sub(points[i], points[i - 1])) / scale;
      const ring = [];
      for (let s = 0; s <= sides; s++) {
        const t = (s / sides) * Math.PI * 2;
        const n = add([a[0] * Math.cos(t), a[1] * Math.cos(t), a[2] * Math.cos(t)], b, Math.sin(t));
        ring.push(this.vertex(add(points[i], n, radii[i]), n, (s / sides) * Math.max(1, Math.round((radii[0] * 6.283) / scale)), v, shade));
      }
      rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const a = rings[i][s];
        const b = rings[i][s + 1];
        const c = rings[i + 1][s];
        const d = rings[i + 1][s + 1];
        this.idx.push(a, b, c, b, d, c);
      }
    }
    // A cap on its end, drawn in to a point.
    const end = points.at(-1);
    const tip = this.vertex(add(end, norm(sub(end, points.at(-2))), radii.at(-1) * 0.6), norm(sub(end, points.at(-2))), 0.5, v + 0.1, shade);
    const last = rings.at(-1);
    for (let s = 0; s < sides; s++) this.idx.push(last[s], last[s + 1], tip);
  }

  // A card at p, w by h, its middle bottom at p if bottom, else its middle;
  // facing n, turned by roll about it; normal: what it is lit as facing.
  card(p, n, w, h, roll, normal, shade = 1, bottom = false, bend = 0) {
    n = norm(n);
    const helper = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    let u = norm(cross(helper, n));
    let v = cross(n, u);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    [u, v] = [add(u.map((x) => x * cr), v, sr), add(v.map((x) => x * cr), u, -sr)];
    const o = bottom ? p : add(p, v, -h / 2);
    const rows = bend ? 3 : 1;
    const base = this.pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      // A card that bends over as it goes (a frond, a blade).
      const up = add(add(o, v, h * t), n, bend * t * t * h);
      for (const sx of [-0.5, 0.5]) this.vertex(add(up, u, w * sx), normal ?? n, sx + 0.5, t, shade);
    }
    for (let r = 0; r < rows; r++) {
      const a = base + r * 2;
      this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// A limb from `from` growing along dir, length l, bending as gravity and
// the light say (droop down or curl up), in steps: its points.
function limb(rng, from, dir, l, { steps = 4, droop = 0, wander = 0.15 } = {}) {
  const pts = [from];
  let d = norm(dir);
  let p = from;
  for (let i = 1; i <= steps; i++) {
    d = norm([d[0] + rng.range(-wander, wander), d[1] - droop + rng.range(-wander, wander) * 0.5, d[2] + rng.range(-wander, wander)]);
    p = add(p, d, l / steps);
    pts.push(p);
  }
  return pts;
}

const taper = (n, r0, r1) => Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / (n - 1)));

// Leaves round a crown: cards on its skin and some inside, lit as if each
// faced out from its middle, darker the deeper in they are.
function crown(shape, rng, centre, radii, count, size, tips = []) {
  for (let i = 0; i < count; i++) {
    let p;
    if (i < tips.length) p = add(tips[i], [rng.range(-0.3, 0.3), rng.range(-0.1, 0.4), rng.range(-0.3, 0.3)]);
    else {
      const a = rng.range(0, Math.PI * 2);
      const y = rng.range(-0.75, 1);
      const r = Math.sqrt(1 - y * y) * Math.pow(rng.next(), 0.3);
      p = [centre[0] + Math.cos(a) * r * radii[0], centre[1] + y * radii[1], centre[2] + Math.sin(a) * r * radii[2]];
    }
    const out = norm([(p[0] - centre[0]) / radii[0], (p[1] - centre[1]) / radii[1], (p[2] - centre[2]) / radii[2]]);
    const depth = Math.min(1, len([(p[0] - centre[0]) / radii[0], (p[1] - centre[1]) / radii[1], (p[2] - centre[2]) / radii[2]]));
    const facing = norm(add(out, [rng.range(-0.8, 0.8), rng.range(-0.5, 0.9), rng.range(-0.8, 0.8)]));
    const s = size * rng.range(0.8, 1.2);
    const shade = 0.45 + 0.55 * depth * (0.75 + 0.25 * Math.max(0, out[1]));
    shape.card(p, facing, s, s, rng.range(0, Math.PI * 2), norm(add(out, [0, 0.4, 0])), shade);
  }
}

// Each species' shape from a seed: { bark, leaves, barkLayer, leafLayer }.
const GROW = {
  oak(rng) {
    const bark = new Shape();
    const leaves = new Shape();
    const h = rng.range(2.4, 3.2);
    const lean = [rng.range(-0.12, 0.12), 1, rng.range(-0.12, 0.12)];
    const trunk = limb(rng, [0, -0.3, 0], lean, h + 0.3, { steps: 4, wander: 0.05 });
    bark.tube(trunk, taper(trunk.length, 0.42, 0.3), 10);
    const top = trunk.at(-1);
    const tips = [];
    const limbs = rng.int(4, 6);
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const out = [Math.cos(a), rng.range(0.6, 1.1), Math.sin(a)];
      const l = rng.range(2.2, 3.2);
      const pts = limb(rng, add(top, [0, -rng.range(0, 0.6), 0]), out, l, { steps: 4, droop: -0.02 });
      bark.tube(pts, taper(pts.length, 0.22, 0.08), 7);
      for (let k = 0; k < 3; k++) {
        const from = pts[rng.int(2, pts.length - 1)];
        const twig = limb(rng, from, add(norm(sub(pts.at(-1), pts[0])), [rng.range(-0.8, 0.8), rng.range(0, 0.6), rng.range(-0.8, 0.8)]), rng.range(0.9, 1.6), { steps: 2 });
        bark.tube(twig, taper(twig.length, 0.07, 0.03), 4);
        tips.push(twig.at(-1));
      }
      tips.push(pts.at(-1));
    }
    const centre = [top[0], top[1] + 1.9, top[2]];
    crown(leaves, rng, centre, [3.1, 2.4, 3.1], 120, 1.7, tips);
    return { bark: bark.geometry(), leaves: leaves.geometry(), barkLayer: MAT.bark, leafLayer: LEAF.oak };
  },
  birch(rng) {
    const bark = new Shape();
    const leaves = new Shape();
    const h = rng.range(6.2, 7.6);
    const trunk = limb(rng, [0, -0.3, 0], [rng.range(-0.1, 0.1), 1, rng.range(-0.1, 0.1)], h, { steps: 6, wander: 0.06 });
    bark.tube(trunk, taper(trunk.length, 0.22, 0.07), 9, 1.4);
    const tips = [];
    for (let i = 0; i < 9; i++) {
      const from = trunk[rng.int(2, trunk.length - 2)];
      const a = rng.range(0, Math.PI * 2);
      const pts = limb(rng, from, [Math.cos(a), rng.range(0.8, 1.6), Math.sin(a)], rng.range(1.2, 2.2), { steps: 3 });
      bark.tube(pts, taper(pts.length, 0.06, 0.025), 4);
      tips.push(pts.at(-1));
    }
    crown(leaves, rng, [trunk.at(-1)[0], h * 0.66, trunk.at(-1)[2]], [1.8, 2.8, 1.8], 90, 1.15, tips);
    return { bark: bark.geometry(), leaves: leaves.geometry(), barkLayer: MAT.birch, leafLayer: LEAF.birch };
  },
  pine(rng) {
    const bark = new Shape();
    const leaves = new Shape();
    const h = rng.range(9, 11.5);
    const trunk = limb(rng, [0, -0.3, 0], [0, 1, 0], h, { steps: 6, wander: 0.025 });
    bark.tube(trunk, taper(trunk.length, 0.36, 0.06), 9, 1.8);
    // Whorls of branches up the trunk, shorter towards the top.
    const first = rng.range(2.4, 3.2);
    for (let y = first; y < h - 0.3; y += rng.range(0.55, 0.75)) {
      const t = (y - first) / (h - first);
      const reach = (1 - t) * 3.1 + 0.45;
      const n = rng.int(5, 7);
      const at = lerp3(trunk[0], trunk.at(-1), y / h);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3) + y;
        const pts = limb(rng, at, [Math.cos(a), rng.range(-0.25, 0.05) + t * 0.3, Math.sin(a)], reach, { steps: 3, droop: 0.06 });
        bark.tube(pts, taper(pts.length, 0.06 * (1 - t) + 0.02, 0.015), 3);
        // Needles all along it: sprays lying along the branch, tilted up.
        const sprays = Math.max(1, Math.round(reach / 0.75));
        for (let k = 0; k < sprays; k++) {
          const p = lerp3(pts[0], pts.at(-1), (k + 0.6) / sprays);
          const along = norm(sub(pts.at(-1), pts[0]));
          const side = norm(cross(along, [0, 1, 0]));
          const facing = norm(add([0, 1, 0], side, rng.range(-0.6, 0.6)));
          const shade = 0.5 + 0.5 * Math.min(1, ((k + 1) / sprays) * 0.6 + t * 0.6);
          const s = 1.25 * (0.75 + 0.5 * (1 - t));
          leaves.card(add(p, along, -s * 0.15), facing, s, s * 1.1, Math.atan2(along[2], along[0]) + Math.PI / 2 + rng.range(-0.3, 0.3), norm(add(side, [0, 1, 0])), shade);
          leaves.card(p, norm(add(side, [0, -0.3, 0])), s * 0.8, s, rng.range(0, 6.28), norm(add(side, [0, 0.6, 0])), shade * 0.85);
        }
      }
    }
    // The leader at the top.
    leaves.card(add(trunk.at(-1), [0, -0.2, 0]), [1, 0, 0], 0.9, 1.4, 0, [0, 1, 0], 1);
    leaves.card(add(trunk.at(-1), [0, -0.2, 0]), [0, 0, 1], 0.9, 1.4, 0, [0, 1, 0], 1);
    return { bark: bark.geometry(), leaves: leaves.geometry(), barkLayer: MAT.bark, leafLayer: LEAF.pine };
  },
  palm(rng) {
    const bark = new Shape();
    const leaves = new Shape();
    const h = rng.range(6.5, 8.5);
    const bend = [rng.range(-1, 1), 0, rng.range(-1, 1)];
    const bl = len(bend) || 1;
    const dir = [bend[0] / bl, 0, bend[2] / bl];
    const curve = rng.range(1.2, 2.4);
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([dir[0] * curve * t * t, -0.3 + t * (h + 0.3), dir[2] * curve * t * t]);
    }
    bark.tube(pts, taper(pts.length, 0.26, 0.17), 9, 0.9);
    const top = pts.at(-1);
    // Coconuts under the crown.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const c = add(top, [Math.cos(a) * 0.28, -0.35, Math.sin(a) * 0.28]);
      bark.tube([add(c, [0, 0.16, 0]), add(c, [0, -0.16, 0])], [0.16, 0.14], 6, 0.5, 0.55);
    }
    const fronds = rng.int(11, 14);
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const up = rng.range(-0.1, 0.55);
      const out = norm([Math.cos(a), up, Math.sin(a)]);
      const l = rng.range(3.2, 4.2);
      // A frond: a strip arching out and down, its card along it.
      const segs = 5;
      const base = leaves.pos.length / 3;
      const across = norm(cross(out, [0, 1, 0]));
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const c = add(add(top, out, l * t), [0, 1, 0], -1.9 * t * t + 0.45 * t);
        const w = 1.25 * Math.sin(Math.min(1, t * 1.15 + 0.05) * Math.PI) + 0.15;
        const n = norm(add(cross(across, norm(sub(c, top))), [0, 0.5, 0]));
        for (const sx of [-0.5, 0.5]) leaves.vertex(add(add(c, across, w * sx), [0, -Math.abs(sx) * 0.25 * w, 0]), n[1] < 0 ? n.map((x) => -x) : n, t, sx + 0.5, 0.65 + 0.35 * t);
      }
      for (let s = 0; s < segs; s++) {
        const q = base + s * 2;
        leaves.idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
    return { bark: bark.geometry(), leaves: leaves.geometry(), barkLayer: MAT.bark, leafLayer: LEAF.palm };
  },
  snag(rng) {
    const bark = new Shape();
    const leaves = new Shape();
    const h = rng.range(4.5, 6.5);
    const trunk = limb(rng, [0, -0.3, 0], [rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)], h, { steps: 5, wander: 0.12 });
    bark.tube(trunk, taper(trunk.length, 0.34, 0.08), 8, 1.5, 0.8);
    const grow = (from, dir, l, r, depth) => {
      const pts = limb(rng, from, dir, l, { steps: 3, wander: 0.3 });
      bark.tube(pts, taper(pts.length, r, r * 0.4), Math.max(3, Math.round(r * 30)), 1.2, 0.8);
      if (depth > 0) for (let k = 0; k < 2; k++) grow(pts[rng.int(1, pts.length - 1)], add(norm(sub(pts.at(-1), pts[0])), [rng.range(-0.9, 0.9), rng.range(-0.2, 0.7), rng.range(-0.9, 0.9)]), l * 0.6, r * 0.55, depth - 1);
    };
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI * 2);
      grow(trunk[rng.int(2, trunk.length - 1)], [Math.cos(a), rng.range(0.2, 0.9), Math.sin(a)], rng.range(1.6, 2.6), 0.12, 2);
    }
    return { bark: bark.geometry(), leaves: leaves.geometry(), barkLayer: MAT.bark, leafLayer: LEAF.twigs };
  },
};

// ---------------------------------------------------------------- materials

// A layer of the material arrays as plain textures, for three's own
// materials: its colour, its normal map (rebuilt into RGB) and roughness.
const layerCache = new Map();
export function layerTextures(gl, layer, repeat = 1) {
  const key = `${layer}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const { albedo, normal, size } = realMaterials(gl);
  const n = size * size * 4;
  const a = albedo.image.data.slice(layer * n, (layer + 1) * n);
  const nm = normal.image.data.slice(layer * n, (layer + 1) * n);
  const rough = new Uint8Array(n);
  for (let i = 0; i < n; i += 4) {
    const x = nm[i] / 127.5 - 1;
    const y = nm[i + 1] / 127.5 - 1;
    rough[i + 1] = nm[i + 2];
    rough[i + 3] = 255;
    nm[i + 2] = Math.round((Math.sqrt(Math.max(0, 1 - x * x - y * y)) * 0.5 + 0.5) * 255);
    nm[i + 3] = 255;
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  };
  const out = { map: tex(a, true), normalMap: tex(nm, false), roughnessMap: tex(rough, false) };
  layerCache.set(key, out);
  return out;
}

// A plant's card picture (FOLIAGE) as its own texture.
const leafCache = new Map();
export function leafTexture(layer) {
  if (leafCache.has(layer)) return leafCache.get(layer);
  const all = foliageTexture();
  const size = all.image.width;
  const n = size * size * 4;
  const t = new THREE.DataTexture(all.image.data.slice(layer * n, (layer + 1) * n), size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  leafCache.set(layer, t);
  return t;
}

// The wind, for everything that sways: its time, strength and the sun
// (where leaves glow when it shines through them).
export const wind = { uWind: { value: 0 }, uGust: { value: 0.6 }, uSunView: { value: new THREE.Vector3(0, 1, 0) }, uSunTint: { value: new THREE.Color(1, 1, 1) }, uNearFade: { value: 1 } };

// Leaves and branches right in front of the camera dissolve in a fine
// pattern (as blocks do, render/terrain.js), so a tree it has slipped into
// never fills the screen: none of it at the first distance, all at the second.
export const NEAR_FADE_GLSL = /* glsl */ `
  uniform float uNearFade;
  float nearBayer(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[int(i)] + 0.5) / 16.0;
  }
  void nearFade(float depth, float a, float b) {
    if (uNearFade < 0.5) return;
    float keep = smoothstep(a, b, depth);
    if (keep < 1.0 && nearBayer(gl_FragCoord.xy) > keep) discard;
  }
`;

const SWAY = /* glsl */ `
  uniform float uWind;
  uniform float uGust;
  vec3 sway(vec3 p, vec3 root, float k) {
    float ph = root.x * 0.37 + root.z * 0.29;
    float g = 0.6 + 0.4 * sin(uWind * 0.31 + ph * 0.5);
    float s = sin(uWind * 1.6 + ph + p.y * 0.35) * 0.6 + sin(uWind * 2.9 + ph * 1.7 + p.x) * 0.25;
    return vec3(s, 0.0, cos(uWind * 1.3 + ph) * 0.5) * k * uGust * g;
  }
`;

// Bark, leaves and the rest of a plant: three's standard material, swaying
// in the wind by how high up a vertex is (leaves more), leaves cut out of
// their cards and glowing when the sun shines through them.
function plantMaterial({ map, normalMap = null, roughnessMap = null, cut = false, bend = 0.02, glow = 0, side = THREE.FrontSide }) {
  const m = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1, metalness: 0, side, vertexColors: true, alphaTest: cut ? 0.45 : 0 });
  if (normalMap) m.normalScale.set(1, 1);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wind);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${SWAY}`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        vec3 root = vec3(0.0);
        #ifdef USE_INSTANCING
          root = instanceMatrix[3].xyz;
        #endif
        float k = ${bend.toFixed(3)} * max(0.0, position.y) * max(0.0, position.y) * 0.06;
        transformed += sway(transformed, root, k);
      }`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NEAR_FADE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nnearFade(length(vViewPosition), 1.0, 3.6);');
    shader.uniforms.uNearFade = wind.uNearFade;
    if (glow) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;\nuniform vec3 uSunTint;')
        .replace(
          '#include <aomap_fragment>',
          `#include <aomap_fragment>
          {
            // Sun shining through the leaves towards the eye.
            vec3 toEye = normalize(-vViewPosition);
            float through = pow(max(dot(-toEye, uSunView), 0.0), 3.0);
            reflectedLight.directDiffuse += diffuseColor.rgb * uSunTint * (through * ${glow.toFixed(2)} + 0.08);
          }`,
        );
      shader.uniforms.uSunView = wind.uSunView;
      shader.uniforms.uSunTint = wind.uSunTint;
    }
  };
  m.customProgramCacheKey = () => `plant-${bend}-${glow}-${cut}`;
  return m;
}

// A cut-out card's shadow: its picture's see-through parts cast none.
function cardDepth(map) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- the trees

export class RealTrees {
  // ground: real-ground.js RealGround (where each tree stands).
  constructor(gl, world, ground, trees) {
    this.group = new THREE.Group();
    this.group.name = 'real trees';
    this.gl = gl;
    const shapes = {};
    const byShape = new Map();
    for (const [x, y, z] of trees) {
      const kind = TREE_KINDS[world.get(x, y, z)];
      if (!kind) continue;
      const variant = Math.floor(hash(x, z, 3) * VARIANTS);
      const key = `${kind}:${variant}`;
      if (!byShape.has(key)) byShape.set(key, []);
      const surface = ground.surfaceIn(x, z, x + 0.5, z + 0.5) ?? y;
      byShape.get(key).push({ x: x + 0.5, y: Math.min(surface, y) - 0.05, z: z + 0.5, turn: hash(x, z, 7) * Math.PI * 2, size: 0.88 + hash(x, z, 11) * 0.26 });
    }
    const mats = {};
    const matOf = (layer, leaf) => {
      const key = `${leaf ? 'leaf' : 'bark'}${layer}`;
      if (mats[key]) return mats[key];
      if (leaf) {
        const map = leafTexture(layer);
        mats[key] = { mat: plantMaterial({ map, cut: true, bend: 0.05, glow: 0.65, side: THREE.DoubleSide }), depth: cardDepth(map) };
      } else {
        const t = layerTextures(gl, layer);
        mats[key] = { mat: plantMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, bend: 0.012 }), depth: null };
      }
      return mats[key];
    };
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [key, list] of byShape) {
      const [kind, variant] = key.split(':');
      shapes[key] ??= GROW[kind](new Rng(1000 + kind.length * 97 + Number(variant) * 31));
      const shape = shapes[key];
      for (const part of ['bark', 'leaves']) {
        const geo = shape[part];
        if (!geo.index.count) continue;
        const { mat, depth } = matOf(part === 'bark' ? shape.barkLayer : shape.leafLayer, part === 'leaves');
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((t, i) => {
          q.setFromAxisAngle(up, t.turn);
          m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.size, t.size, t.size));
          mesh.setMatrixAt(i, m4);
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (depth) mesh.customDepthMaterial = depth;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
      }
    }
    this.materials = Object.values(mats);
    this.shapes = Object.values(shapes);
  }

  dispose() {
    for (const s of this.shapes) {
      s.bark.dispose();
      s.leaves.dispose();
    }
    for (const { mat, depth } of this.materials) {
      mat.dispose();
      depth?.dispose();
    }
  }
}

function hash(x, z, s) {
  let h = Math.imul(x * 73856093 ^ z * 19349663 ^ s * 83492791, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- small plants

// Each small plant the map puts down, as cards: { leaf (FOLIAGE), cards (how
// many, crossed round the middle), w, h (size), bend, tint }.
const SMALL = {
  [B.FERN]: { leaf: LEAF.fern, fan: 7, w: 0.75, h: 1.05, bend: 0.55, tilt: 0.95 },
  [B.BUSH]: { leaf: LEAF.bush, blob: 14, size: 0.85, r: 0.55, y: 0.45 },
  [B.REEDS]: { leaf: LEAF.reeds, cross: 3, w: 1.2, h: 1.8 },
  [B.TALL_GRASS]: { leaf: LEAF.tuft, cross: 3, w: 0.9, h: 0.8 },
  [B.DAISY]: { leaf: LEAF.daisy, cross: 2, w: 0.8, h: 0.6 },
  [B.BLUEBELL]: { leaf: LEAF.bluebell, cross: 2, w: 0.8, h: 0.6 },
  [B.TULIP]: { leaf: LEAF.daisy, cross: 2, w: 0.8, h: 0.6 },
  [B.COSMOS]: { leaf: LEAF.daisy, cross: 2, w: 0.8, h: 0.6 },
  [B.SUNFLOWER]: { leaf: LEAF.daisy, cross: 2, w: 0.9, h: 0.75 },
  [B.MUSHROOM]: { leaf: LEAF.tuft, cross: 2, w: 0.6, h: 0.4 },
};

function smallShape(def, rng) {
  const s = new Shape();
  if (def.fan) {
    // Fronds from the middle, each a strip leaning out and arching over.
    for (let i = 0; i < def.fan; i++) {
      const a = (i / def.fan) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const out = [Math.cos(a), 0, Math.sin(a)];
      const side = [-out[2], 0, out[0]];
      const h = def.h * rng.range(0.8, 1.15);
      const base = s.pos.length / 3;
      const segs = 4;
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const reach = h * def.tilt * t;
        const up = h * (t * (1 - def.bend * t * t));
        const c = [out[0] * reach, up + 0.02, out[2] * reach];
        const n = norm([out[0] * 0.3, 1, out[2] * 0.3]);
        for (const sx of [-0.5, 0.5]) s.vertex(add(c, side, def.w * sx), n, sx + 0.5, t, 0.65 + 0.35 * t);
      }
      for (let k = 0; k < segs; k++) {
        const q = base + k * 2;
        s.idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
  } else if (def.blob) {
    crown(s, rng, [0, def.y, 0], [def.r, def.r * 0.8, def.r], def.blob, def.size);
  } else {
    for (let i = 0; i < def.cross; i++) {
      const a = (i / def.cross) * Math.PI + rng.range(-0.2, 0.2);
      s.card([0, 0, 0], [Math.cos(a), 0, Math.sin(a)], def.w, def.h * rng.range(0.85, 1.15), 0, [0, 1, 0], 0.85, true);
    }
  }
  return s.geometry();
}

export class RealSmallPlants {
  constructor(world, ground) {
    this.world = world;
    this.ground = ground;
    this.group = new THREE.Group();
    this.group.name = 'real plants';
    this.geos = new Map();
    this.mats = new Map();
    this.meshes = new Map();
    this.rebuild();
  }

  rebuild() {
    for (const m of this.meshes.values()) this.group.remove(m);
    this.meshes.clear();
    const { world, ground } = this;
    const at = new Map();
    for (let x = 0; x < world.W; x++) {
      for (let z = 0; z < world.D; z++) {
        for (let y = world.H - 1; y > 0; y--) {
          const id = world.get(x, y, z);
          if (B.KIND[id] !== B.K_PLANT) continue;
          if (!SMALL[id]) continue;
          if (!at.has(id)) at.set(id, []);
          const s = ground.surfaceIn(x, z, x + 0.5, z + 0.5);
          at.get(id).push([x + 0.5 + (hash(x, z, 5) - 0.5) * 0.4, s !== null && Math.abs(s - y) < 1.2 ? s : y, z + 0.5 + (hash(x, z, 6) - 0.5) * 0.4, hash(x, z, 9)]);
        }
      }
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [id, list] of at) {
      const def = SMALL[id];
      if (!this.geos.has(id)) this.geos.set(id, smallShape(def, new Rng(77 + id)));
      if (!this.mats.has(def.leaf)) {
        const map = leafTexture(def.leaf);
        this.mats.set(def.leaf, { mat: plantMaterial({ map, cut: true, bend: 0.5, glow: 0.4, side: THREE.DoubleSide }), depth: cardDepth(map) });
      }
      const { mat, depth } = this.mats.get(def.leaf);
      const mesh = new THREE.InstancedMesh(this.geos.get(id), mat, list.length);
      list.forEach(([x, y, z, r], i) => {
        q.setFromAxisAngle(up, r * Math.PI * 2);
        const k = 0.85 + r * 0.3;
        m4.compose(new THREE.Vector3(x, y - 0.03, z), q, new THREE.Vector3(k, k, k));
        mesh.setMatrixAt(i, m4);
      });
      mesh.castShadow = id === B.BUSH || id === B.FERN || id === B.REEDS;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depth;
      mesh.computeBoundingSphere();
      this.meshes.set(id, mesh);
      this.group.add(mesh);
    }
  }

  dispose() {
    for (const g of this.geos.values()) g.dispose();
    for (const { mat, depth } of this.mats.values()) {
      mat.dispose();
      depth.dispose();
    }
  }
}

// ---------------------------------------------------------------- grass

// A clump of blades: thin curved strips from a point, dark at the foot and
// light at the tip, as many as count, leaning every way.
function clumpGeometry(rng, count) {
  const pos = [];
  const nrm = [];
  const col = [];
  const idx = [];
  for (let b = 0; b < count; b++) {
    const a = rng.range(0, Math.PI * 2);
    const lean = rng.range(0.15, 0.6);
    const h = rng.range(0.16, 0.42);
    const w = rng.range(0.018, 0.032);
    const ox = rng.range(-0.12, 0.12);
    const oz = rng.range(-0.12, 0.12);
    const dir = [Math.cos(a), Math.sin(a)];
    const side = [-dir[1], dir[0]];
    const tone = rng.range(0.8, 1.2);
    const base = pos.length / 3;
    const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = h * t;
      const out = lean * h * t * t;
      const ww = w * (1 - t * 0.92);
      for (const sx of [-1, 1]) {
        pos.push(ox + dir[0] * out + side[0] * ww * sx, y, oz + dir[1] * out + side[1] * ww * sx);
        // Lit as if facing up, with a little of its own slant: soft.
        nrm.push(dir[0] * 0.3, 1, dir[1] * 0.3);
        const k = (0.35 + 0.65 * t) * tone;
        col.push(k, k, k);
      }
    }
    for (let s = 0; s < segs; s++) {
      const q = base + s * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

const GRASS_CHUNK = 16;

// The grass on the meadows round you: in squares of the island, those near
// enough drawn, the furthest of them thinning out.
export class RealGrass {
  // density: clumps to a block of meadow; reach: how far from you it grows.
  constructor(world, ground, { density = 6, reach = 28, tint = [1, 1, 1] } = {}) {
    this.world = world;
    this.reach = reach;
    this.group = new THREE.Group();
    this.group.name = 'real grass';
    this.geometry = clumpGeometry(new Rng(5), 9);
    this.material = new THREE.MeshLambertMaterial({ color: 0x748f44, vertexColors: true, side: THREE.DoubleSide });
    this.uniforms = { uReach: { value: reach }, uCam: { value: new THREE.Vector3() }, uTint: { value: new THREE.Vector3(...tint) } };
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, wind, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          ${SWAY}
          attribute vec4 offset;
          attribute vec4 look;
          uniform float uReach;
          uniform vec3 uCam;
          uniform vec3 uTint;`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
          float c = cos(offset.w);
          float s = sin(offset.w);
          transformed.xz = mat2(c, -s, s, c) * transformed.xz;
          // Smaller towards the edge of where it grows, so it fades in.
          float d = distance(offset.xz, uCam.xz);
          float fade = 1.0 - smoothstep(uReach * 0.7, uReach, d);
          transformed *= vec3(1.0, look.x * fade, 1.0) * mix(0.6, 1.0, fade);
          transformed += sway(transformed + offset.xyz, offset.xyz, 0.9 * transformed.y * transformed.y);
          transformed += offset.xyz;`,
        )
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal);')
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
          vColor.rgb *= uTint * look.yzw;`,
        );
    };
    this.material.customProgramCacheKey = () => 'real-grass';
    this.chunks = [];
    this.build(world, ground, density);
  }

  build(world, ground, density) {
    const { W, D } = world;
    const cols = ground.cols;
    for (let cx = 0; cx < W; cx += GRASS_CHUNK) {
      for (let cz = 0; cz < D; cz += GRASS_CHUNK) {
        const off = [];
        const look = [];
        for (let x = cx; x < Math.min(W, cx + GRASS_CHUNK); x++) {
          for (let z = cz; z < Math.min(D, cz + GRASS_CHUNK); z++) {
            const k = x * D + z;
            const kind = cols.kind[k];
            // Grass on grass, a little on a forest's floor and the fog's ground.
            const wood = ground.wood[k];
            let n = kind === 0 ? density * Math.max(0.25, 1 - wood * 0.8) : kind === 7 ? density * 0.35 : 0;
            if (!n || cols.water[k]) continue;
            const top = cols.height[k];
            // Not under anything built, nor a path.
            const above = world.get(x, top, z);
            if (B.SOLID[above] || B.KIND[above] === B.K_TREE) continue;
            const dead = kind === 7;
            for (let i = 0; i < n; i++) {
              const px = x + hash(x * 7 + i, z, 21);
              const pz = z + hash(x, z * 7 + i, 23);
              const fx = Math.floor(px);
              const fz = Math.floor(pz);
              const s = ground.surfaceIn(fx, fz, px, pz);
              if (s === null || Math.abs(s - top) > 0.9) continue;
              off.push(px, s - 0.02, pz, hash(x + i, z, 25) * Math.PI * 2);
              const r = hash(x, z + i, 27);
              const tall = 0.75 + hash(x + i, z + i, 29) * 0.6;
              // Mostly green, some of it gone to straw.
              const straw = hash(x * 3 + i, z * 5, 31) < 0.18 ? 1 : 0;
              look.push(tall, dead ? 0.62 : straw ? 1.35 : 0.85 + r * 0.25, dead ? 0.55 : straw ? 1.08 : 0.95 + r * 0.12, dead ? 0.52 : straw ? 0.62 : 0.7 + r * 0.25);
            }
          }
        }
        if (!off.length) continue;
        const g = new THREE.InstancedBufferGeometry();
        g.index = this.geometry.index;
        for (const name of ['position', 'normal', 'color']) g.setAttribute(name, this.geometry.getAttribute(name));
        g.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(off), 4));
        g.setAttribute('look', new THREE.InstancedBufferAttribute(new Float32Array(look), 4));
        g.instanceCount = off.length / 4;
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx + GRASS_CHUNK / 2, ground.cols.height[Math.min(W - 1, cx + 8) * D + Math.min(D - 1, cz + 8)], cz + GRASS_CHUNK / 2), GRASS_CHUNK * 0.9 + 6);
        const mesh = new THREE.Mesh(g, this.material);
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        this.chunks.push({ mesh, x: cx + GRASS_CHUNK / 2, z: cz + GRASS_CHUNK / 2 });
        this.group.add(mesh);
      }
    }
  }

  // Only the squares near enough to the camera.
  update(camera) {
    this.uniforms.uCam.value.copy(camera.position);
    for (const c of this.chunks) c.mesh.visible = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < this.reach + GRASS_CHUNK * 0.75;
  }

  dispose() {
    for (const c of this.chunks) c.mesh.geometry.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export { FOLIAGE };
