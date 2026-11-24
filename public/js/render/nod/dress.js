// What stands about on the bodies of the Land of Nod (shared/nod/maker.js has
// where, and what of each is solid): buttons, cushions and tufts of wool on the
// Pillow Moons, mushrooms and pebbles in Pumpkin Skies, and so on; the springs
// between bodies, the lamps a nightmare over lights, and the night-light they
// stand round. Each kind is drawn many at once; those that move or light up are
// things of their own.
import * as THREE from '../../../vendor/three.module.js';
import { RoundedBoxGeometry } from '../../../vendor/three-addons/geometries/RoundedBoxGeometry.js';
import { along, finishOf, frameOf, painted, where } from './kit.js';

const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n);
// (A profile of few points, rounded through them.)
const smoothLathe = (pts, n = 40, steps = 40) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(steps).map((v) => v.setX(Math.max(0, v.x))), n);
const ball = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const tube = (R, r, n = 28, m = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, m, n, arc);
const rod = (a, b, h, n = 14) => new THREE.CylinderGeometry(b, a, h, n);
const box = (w, h, d, r = 0.08, s = 3) => new RoundedBoxGeometry(w, h, d, s, r);
const cap = (r, l, n = 12) => new THREE.CapsuleGeometry(r, l, 6, n);
const up = -Math.PI / 2;

// A star (n points) as a flat shape t thick, lying in its own xz.
function starGeo(n = 5, R = 1, r = 0.46, t = 0.2, soft = 0.06) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const k = i % 2 ? r : R;
    if (i) s.lineTo(Math.cos(a) * k, Math.sin(a) * k);
    else s.moveTo(Math.cos(a) * k, Math.sin(a) * k);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelSize: soft, bevelThickness: soft, bevelSegments: 3 });
  g.translate(0, 0, -t / 2);
  g.computeVertexNormals();
  return g;
}

// Each kind's parts, by what they are made of (kit.js FINISH). A part painted
// null takes the colour of the one it is part of (tints).
const KINDS = {
  // ------- Pillow Moons
  tuft: () => ({
    soft: painted([0, 1, 2, 3, 4].map((i) => [ball(0.2 + (i % 2) * 0.06, 10, 8), null, where(Math.cos(i * 1.26) * 0.2, 0.12 + (i === 4 ? 0.16 : 0), Math.sin(i * 1.26) * 0.2)])),
  }),
  felt: () => ({
    soft: painted([
      ...[0, 1, 2, 3, 4].map((i) => [ball(1, 12, 8), null, where(Math.sin(i * 1.2566) * 0.19, 0.1, Math.cos(i * 1.2566) * 0.19, [0.15, 0.06, 0.19], 0, i * 1.2566, 0)]),
      [ball(0.12, 12, 8), '#fff0c0', where(0, 0.14, 0, [1, 0.65, 1])],
      ...[0, 1].map((i) => [ball(1, 10, 6), '#9cc9a0', where(i ? 0.3 : -0.26, 0.05, i ? -0.18 : 0.22, [0.2, 0.03, 0.1], 0, i ? 0.6 : -2.4, 0)]),
    ]),
  }),
  cushion: () => ({
    soft: painted([
      [box(2.1, 0.72, 2.1, 0.34, 5), null, where(0, 0.45, 0)],
      [tube(0.86, 0.06, 40, 8), '#fff6e8', where(0, 0.45, 0, [1.17, 1.17, 1], up)],
      [ball(0.14, 12, 8), '#fff6e8', where(0, 0.8, 0, [1, 0.5, 1])],
    ]),
  }),
  button: () => ({
    gloss: painted([
      [lathe([[0, 0.2], [1.02, 0.2], [1.1, 0.26], [1.2, 0.37], [1.36, 0.38], [1.5, 0.3], [1.52, 0.14], [1.4, 0], [0, 0]], 40), null],
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => [rod(0.17, 0.17, 0.05, 16), '#4a3a52', where(x * 0.36, 0.2, z * 0.36)]),
    ]),
    soft: painted([
      [cap(0.07, 0.8), '#fff3d8', where(0, 0.23, 0.36, 1, 0, 0, Math.PI / 2)],
      [cap(0.07, 0.8), '#fff3d8', where(0, 0.23, -0.36, 1, 0, 0, Math.PI / 2)],
    ]),
  }),
  pin: () => ({
    metal: painted([[rod(0.07, 0.07, 1.4, 10), '#cfd6e6', where(0, 0.55, 0)]]),
    gloss: painted([[ball(0.27, 18, 14), null, where(0, 1.36, 0)]]),
  }),
  book: () => ({
    plain: painted([
      [box(1.9, 0.42, 2.6, 0.05), null, where(0, 0.3, 0)],
      [box(1.86, 0.3, 2.4, 0.03), '#fff4dc', where(0.06, 0.3, 0)],
      [box(1.92, 0.07, 2.62, 0.03), null, where(0, 0.54, 0)],
      [box(1.92, 0.07, 2.62, 0.03), null, where(0, 0.06, 0)],
    ]),
    metal: painted([[starGeo(5, 0.5, 0.23, 0.03, 0.01), '#f4cf6a', where(0, 0.59, 0, 1, up)]]),
  }),
  post: () => ({
    plain: painted([
      [lathe([[0, 0], [0.62, 0], [0.62, 0.18], [0.44, 0.28], [0.36, 0.6], [0.46, 0.85], [0.46, 1.0], [0.3, 1.1], [0.26, 2.0], [0.36, 2.9], [0.46, 3.2], [0.46, 3.4], [0.3, 3.5], [0.34, 3.9], [0.5, 4.05], [0.5, 4.2], [0, 4.2]], 24), '#8a5a3a'],
      [tube(0.46, 0.06, 24, 8), '#6e4329', where(0, 0.92, 0, 1, up)],
      [tube(0.46, 0.06, 24, 8), '#6e4329', where(0, 3.3, 0, 1, up)],
    ]),
    metal: painted([[ball(0.72, 24, 18), '#f0c65a', where(0, 4.62, 0)], [tube(0.4, 0.09, 24, 8), '#d9a93e', where(0, 4.12, 0, 1, up)]]),
  }),
  tassel: () => ({
    soft: painted([
      [ball(0.3, 14, 10), '#f4cf6a', where(0, 0.1, 0)],
      [tube(0.2, 0.07, 18, 8), '#e0b24a', where(0, -0.12, 0.24, 1, 0.5)],
      ...Array.from({ length: 12 }, (_, i) => [cap(0.05, 0.75, 6), i % 2 ? '#f4cf6a' : '#e8be58', where(Math.cos(i * 0.52) * 0.14, -0.2 + Math.sin(i * 0.52) * 0.14, 0.62, 1, Math.PI / 2 + Math.sin(i * 0.52) * 0.22, Math.cos(i * 0.52) * 0.22, 0)]),
    ]),
  }),
  // ------- Pumpkin Skies
  mushroom: () => ({
    soft: painted([
      [lathe([[0.42, 0], [0.34, 0.2], [0.28, 0.8], [0.3, 1.4], [0.1, 1.6]], 20), '#fff1da'],
      [lathe([[0.2, 1.62], [0.9, 1.56], [1.1, 1.66], [0.2, 1.8]], 28), '#f0d6b8'],
    ]),
    gloss: painted([
      [lathe([[1.12, 1.62], [1.16, 1.72], [1.08, 1.96], [0.8, 2.22], [0.4, 2.36], [0, 2.4]], 32), null],
      ...[[0.3, 2.2, 0.75, 0.2], [2.0, 2.1, 0.86, 0.16], [3.4, 2.24, 0.7, 0.2], [4.8, 2.06, 0.92, 0.15], [1.2, 1.86, 1.06, 0.13], [5.7, 2.32, 0.4, 0.15]].map(([a, h, R, r]) => [ball(1, 14, 8), '#fff8ea', along(Math.sin(a) * R, h, Math.cos(a) * R, [Math.sin(a) * 0.7, 1, Math.cos(a) * 0.7], [r, 0.05, r])]),
    ]),
  }),
  toadstool: () => ({
    soft: painted([[lathe([[0.14, 0], [0.1, 0.2], [0.11, 0.42], [0, 0.46]], 14), '#fff1da']]),
    gloss: painted([
      [lathe([[0, 0.38], [0.34, 0.36], [0.38, 0.42], [0.3, 0.6], [0.14, 0.7], [0, 0.72]], 20), null],
      ...[0.4, 2.1, 3.7, 5.2].map((a) => [ball(0.06, 8, 6), '#fff8ea', where(Math.sin(a) * 0.24, 0.6, Math.cos(a) * 0.24, [1, 0.5, 1])]),
    ]),
  }),
  daisy: () => ({
    soft: painted([
      [rod(0.02, 0.02, 0.5, 6), '#5fa838', where(0, 0.25, 0)],
      ...Array.from({ length: 9 }, (_, i) => [ball(1, 8, 6), null, where(Math.sin(i * 0.698) * 0.17, 0.52, Math.cos(i * 0.698) * 0.17, [0.07, 0.025, 0.14], 0, i * 0.698, 0)]),
      [ball(0.09, 10, 8), '#f7c12e', where(0, 0.54, 0, [1, 0.6, 1])],
      [ball(1, 8, 6), '#6fb845', where(0.14, 0.16, 0.05, [0.15, 0.02, 0.06], 0, 0.4, 0.4)],
    ]),
  }),
  blade: () => ({
    soft: painted(
      Array.from({ length: 7 }, (_, i) => {
        const a = i * 0.9;
        const lean = 0.25 + (i % 3) * 0.14;
        return [new THREE.ConeGeometry(0.05, 0.5 + (i % 3) * 0.16, 4), i % 2 ? '#7fc548' : '#5fae3a', where(Math.sin(a) * 0.1, 0.24, Math.cos(a) * 0.1, [1, 1, 0.5], Math.cos(a) * lean, 0, -Math.sin(a) * lean)];
      }),
    ),
  }),
  clover: () => ({
    soft: painted([
      [rod(0.015, 0.015, 0.3, 6), '#4f9a34', where(0, 0.15, 0)],
      ...[0, 1, 2, 3].map((i) => [ball(1, 10, 6), i % 2 ? '#5fb548' : '#6fc458', where(Math.sin(i * 1.571) * 0.12, 0.31, Math.cos(i * 1.571) * 0.12, [0.12, 0.02, 0.13], 0, i * 1.571, 0)]),
    ]),
  }),
  sprout: () => ({
    soft: painted([
      [cap(0.06, 0.5, 8), '#8fd055', where(0, 0.3, 0, 1, 0.1)],
      [ball(1, 12, 8), '#7cc548', where(0.2, 0.66, 0, [0.26, 0.04, 0.14], 0, 0, 0.5)],
      [ball(1, 12, 8), '#8fd65a', where(-0.2, 0.7, 0, [0.26, 0.04, 0.14], 0, 0, -0.5)],
    ]),
  }),
  pebble: () => ({ plain: painted([[new THREE.IcosahedronGeometry(0.5, 2), null, where(0, 0.1, 0, [1.1, 0.62, 0.9])]]) }),
  stone: () => ({
    plain: painted([
      [new THREE.IcosahedronGeometry(0.75, 2), '#b9aa96', where(0, 0.26, 0, [1.05, 0.75, 0.9])],
      [ball(1, 14, 8), '#7fb54a', where(0.05, 0.62, 0, [0.56, 0.2, 0.5])],
    ]),
  }),
  dew: () => ({ gloss: painted([[ball(0.2, 14, 10), '#eaf8ff', where(0, 0.08, 0, [1, 0.8, 1])]]) }),
  tendril: () => {
    const pts = [];
    for (let i = 0; i <= 22; i++) {
      const a = i * 0.55;
      const r = 0.36 * (1 - i / 25);
      pts.push(new THREE.Vector3(0.05 * Math.min(i, 6) + (i > 6 ? Math.sin(a) * r : 0), i * 0.075, i > 6 ? Math.cos(a) * r - 0.2 : 0));
    }
    return { soft: painted([[new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.05, 7), '#8fd055', where()]]) };
  },
  // ------- the Music Box
  peg: () => ({
    metal: painted([[lathe([[0.3, 0], [0.24, 0.1], [0.2, 0.3], [0.2, 1.3], [0.26, 1.42], [0.2, 1.62], [0, 1.68]], 18), '#f2cc62']]),
  }),
  drumlet: () => ({
    gloss: painted([[rod(0.95, 0.95, 0.9, 32), null, where(0, 0.52, 0)], [tube(0.96, 0.08, 36, 8), '#f0c04a', where(0, 0.98, 0, 1, up)], [tube(0.96, 0.08, 36, 8), '#f0c04a', where(0, 0.1, 0, 1, up)]]),
    soft: painted([[rod(0.9, 0.9, 0.06, 32), '#f6e7cf', where(0, 1.02, 0)]]),
  }),
  bell: () => ({
    metal: painted([[smoothLathe([[0.95, 0.05], [0.9, 0.16], [0.66, 0.5], [0.52, 1.0], [0.4, 1.35], [0, 1.5]], 32, 26), '#f2cc62'], [tube(0.16, 0.05, 16, 8), '#d9a93e', where(0, 1.6, 0)]]),
  }),
  fork: () => ({
    metal: painted([[rod(0.2, 0.2, 1.8, 14), '#d6dcea', where(0, 0.9, 0)], [tube(0.5, 0.19, 22, 12, Math.PI), '#d6dcea', where(0, 2.3, 0, 1, 0, Math.PI / 2, Math.PI)], [rod(0.18, 0.18, 2.4, 14), '#d6dcea', where(0, 3.4, 0.5)], [rod(0.18, 0.18, 2.4, 14), '#d6dcea', where(0, 3.4, -0.5)]]),
  }),
  stand: () => ({
    metal: painted([[rod(0.08, 0.08, 1.7, 10), '#c9a14a', where(0, 0.85, 0)], ...[0, 1, 2].map((i) => [cap(0.06, 0.6, 8), '#c9a14a', where(Math.sin(i * 2.09) * 0.28, 0.14, Math.cos(i * 2.09) * 0.28, 1, Math.cos(i * 2.09) * 1.1, 0, -Math.sin(i * 2.09) * 1.1)])]),
    plain: painted([[box(1.15, 0.85, 0.08, 0.03), '#5a3a24', where(0, 1.95, 0.1, 1, -0.35)], [box(0.48, 0.66, 0.04, 0.02), '#fff8e6', where(-0.26, 1.98, 0.16, 1, -0.35, 0.06)], [box(0.48, 0.66, 0.04, 0.02), '#fff3d6', where(0.26, 1.98, 0.16, 1, -0.35, -0.06)]]),
  }),
  notelet: () => ({
    ember: painted([
      [ball(0.16, 14, 10), null, where(0, 0.16, 0, [1.25, 0.9, 0.9], 0, 0, 0.35)],
      [rod(0.03, 0.03, 0.62, 8), null, where(0.17, 0.46, 0)],
      [ball(0.1, 10, 8), null, where(0.26, 0.7, 0, [1.3, 0.6, 0.5], 0, 0, -0.5)],
    ]),
  }),
  // ------- Tick-Tock Skies
  cog: () => ({
    metal: painted([
      [lathe([[0.36, 0], [1.1, 0], [1.16, 0.06], [1.16, 0.36], [1.1, 0.42], [0.36, 0.42], [0.36, 0]], 32), null],
      ...Array.from({ length: 12 }, (_, i) => [box(0.32, 0.34, 0.26, 0.05), null, where(Math.sin(i * 0.5236) * 1.24, 0.21, Math.cos(i * 0.5236) * 1.24, 1, 0, i * 0.5236, 0)]),
      [rod(0.3, 0.26, 0.6, 18), '#8a5c28', where(0, 0.3, 0)],
    ]),
  }),
  chimney: () => ({
    metal: painted([[lathe([[0.5, 0], [0.46, 0.2], [0.38, 0.3], [0.36, 1.5], [0.46, 1.6], [0.5, 1.9], [0.38, 1.95], [0, 1.8]], 24), '#b9793a'], ...[0.5, 0.9, 1.3].map((h) => [tube(0.38, 0.05, 24, 8), '#f2cc62', where(0, h, 0, 1, up)])]),
  }),
  key: () => ({
    metal: painted([[rod(0.12, 0.12, 1.1, 12), '#f2cc62', where(0, 0.5, 0)], [tube(0.32, 0.1, 22, 10), '#f2cc62', where(0.3, 1.35, 0)], [tube(0.32, 0.1, 22, 10), '#f2cc62', where(-0.3, 1.35, 0)], [ball(0.16, 12, 10), '#d9a93e', where(0, 1.1, 0)]]),
  }),
  screw: () => ({
    metal: painted([[lathe([[0, 0.16], [0.16, 0.16], [0.22, 0.1], [0.22, 0], [0, 0]], 18), '#e9ce8a'], [box(0.34, 0.04, 0.06, 0.01), '#7a5a2a', where(0, 0.165, 0)]]),
  }),
  // ------- the Dark Side
  shard: () => ({
    crystal: painted([
      [new THREE.CylinderGeometry(0.05, 0.42, 1.9, 6), '#8f6fe8', where(0, 0.85, 0.08, 1, 0.1)],
      [new THREE.CylinderGeometry(0.04, 0.26, 1.1, 6), '#b79cff', where(0.42, 0.45, 0, 1, 0, 0, -0.45)],
      [new THREE.CylinderGeometry(0.03, 0.22, 0.9, 6), '#6f4fd0', where(-0.36, 0.36, -0.1, 1, -0.2, 0, 0.5)],
    ]),
  }),
  spark: () => ({ ember: painted([[new THREE.OctahedronGeometry(0.14, 0), null, where(0, 0.2, 0, [0.7, 1.3, 0.7])]]) }),
  bedpost: () => ({
    plain: painted([[lathe([[0, 0], [0.6, 0], [0.6, 0.2], [0.42, 0.34], [0.34, 1.2], [0.5, 1.5], [0.5, 1.7], [0.32, 1.9], [0.3, 2.8], [0.48, 3.0], [0.48, 3.2], [0, 3.25]], 24), '#4a3358']]),
    gloss: painted([[ball(0.66, 22, 16), '#7a5fa8', where(0, 3.6, 0)]]),
  }),
};

// The colours each kind comes in.
const TINTS = {
  tuft: ['#fff8ee', '#fdf0f4', '#f3f0ff'],
  felt: ['#f58fa8', '#f7c65c', '#8fb4f2', '#c79af0', '#ff9f7a'],
  cushion: ['#f4b8c6', '#b7d0f6', '#fbe0a6', '#c7e6c8', '#d5c3f4'],
  button: ['#f7d36a', '#8fc7ee', '#f58fa8', '#b5e0b0', '#c9a6f2'],
  pin: ['#f2637a', '#5fa8ee', '#f7c65c', '#7fd0a0'],
  book: ['#c9566a', '#4f77c9', '#4f9a7a', '#8a63c2'],
  mushroom: ['#e8473f', '#f28a2e', '#c85fd0'],
  toadstool: ['#e8473f', '#f7b23d', '#e86fa0', '#8f6fe0'],
  daisy: ['#ffffff', '#ffe3f0', '#fff3b0', '#d6e6ff'],
  pebble: ['#c9b8a2', '#a89a90', '#d8ccb8'],
  drumlet: ['#b3263f', '#2f5fb0', '#2f8a5a'],
  notelet: ['#ffd75e', '#ff9fd0', '#8fd6ff', '#b9ff9a'],
  cog: ['#e0b060', '#c98a4a', '#b9a08a'],
  spark: ['#b45cff', '#5fa8ff', '#ff6fc0'],
};

// Too small to cast a shadow worth having.
const FLAT = new Set(['tuft', 'felt', 'daisy', 'blade', 'clover', 'dew', 'tendril', 'inkdrop', 'spark', 'notelet', 'screw']);

// All of a world's things that stand about, drawn many at once.
export class Dress {
  constructor(world) {
    this.group = new THREE.Group();
    this.group.name = 'nod dress';
    const by = new Map();
    for (const d of world.dress) {
      if (!KINDS[d.kind]) continue;
      if (!by.has(d.kind)) by.set(d.kind, []);
      by.get(d.kind).push(d);
    }
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    this.meshes = [];
    for (const [kind, list] of by) {
      const parts = KINDS[kind]();
      for (const [finish, geo] of Object.entries(parts)) {
        const mesh = new THREE.InstancedMesh(geo, finishOf(finish), list.length);
        list.forEach((d, i) => {
          mesh.setMatrixAt(i, frameOf(d, d.k, m, -0.03 * d.k));
          const tints = TINTS[kind];
          if (tints) {
            const h = Math.abs(Math.sin(d.x * 12.9898 + d.y * 78.233 + d.z * 37.719) * 43758.5453) % 1;
            mesh.setColorAt(i, c.set(tints[Math.floor(h * tints.length)]));
          } else if (mesh.instanceColor) mesh.setColorAt(i, c.set('#ffffff'));
        });
        mesh.castShadow = !FLAT.has(kind);
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
        this.meshes.push(mesh);
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.dispose();
    }
  }
}

// A spring between two bodies (shared/nod/maker.js spring): a coil under a
// quilted pad with a star on it, that squashes as it flings someone off, and
// sleeps (dim and low) while a fight shuts it.
export class SpringModel {
  constructor(spring, dress, tint = {}) {
    this.spring = spring;
    this.group = new THREE.Group();
    frameOf(dress, 1).decompose(this.group.position, this.group.quaternion, this.group.scale);
    const add = (geo, finish) => {
      const mesh = new THREE.Mesh(geo, finishOf(finish, 'object'));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };
    this.base = add(painted([[lathe([[0, 0], [1.1, 0], [1.16, 0.08], [1.02, 0.16], [0, 0.16]], 32), tint.base ?? '#7a6fc4']]), 'gloss');
    const coils = [];
    for (let i = 0; i < 3; i++) coils.push([tube(0.72, 0.07, 30, 8), '#e9ecf6', where(0, 0.2 + i * 0.13, 0, 1, up)]);
    this.coil = add(painted(coils), 'metal');
    this.pad = new THREE.Group();
    this.pad.add(add(painted([[lathe([[0, 0.1], [0.8, 0.1], [1.0, 0.06], [1.06, -0.04], [0.96, -0.14], [0, -0.14]], 32), spring.need ? (tint.boss ?? '#ffd778') : (tint.pad ?? '#ffb7cb')], [tube(1.0, 0.07, 36, 8), '#f2dfc4', where(0, -0.03, 0, 1, up)]]), 'soft'));
    this.star = add(painted([[starGeo(5, 0.5, 0.24, 0.05, 0.03), '#f7b92e', where(0, 0.13, 0, 1, up)]]), 'ember');
    this.pad.add(this.star);
    this.group.add(this.base, this.coil, this.pad);
    this.pressed = 0;
    this.asleep = false;
    this.time = Math.random() * 6;
  }

  // Someone flung off it.
  fling() {
    this.pressed = 1;
  }

  update(dt, asleep) {
    this.time += dt;
    this.pressed = Math.max(0, this.pressed - dt * 1.6);
    const spring = Math.sin(this.pressed * 22) * this.pressed * 0.45 - this.pressed * 0.12;
    const low = asleep ? 0.42 : 1 + Math.sin(this.time * 2.2) * 0.05;
    const k = Math.max(0.2, low + spring);
    this.coil.scale.y = k;
    this.pad.position.y = 0.16 + 0.42 * k;
    this.star.rotation.y = this.time * 0.6;
    this.star.visible = !asleep;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => o.geometry?.dispose());
  }
}

// A lamp by the night-light: a star on a post, dark until its nightmare is
// over, and then shining.
export class LampModel {
  constructor(dress) {
    this.group = new THREE.Group();
    frameOf(dress, dress.k).decompose(this.group.position, this.group.quaternion, this.group.scale);
    const post = new THREE.Mesh(painted([[lathe([[0, 0], [0.42, 0], [0.44, 0.1], [0.2, 0.2], [0.1, 0.34], [0.09, 1.7], [0.16, 1.8], [0, 1.85]], 20), '#efe6f7']]), finishOf('gloss', 'object'));
    post.castShadow = true;
    this.off = new THREE.Mesh(painted([[starGeo(5, 0.5, 0.26, 0.16, 0.08), '#7d76a8', where(0, 2.35, 0)]]), finishOf('plain', 'object'));
    this.on = new THREE.Mesh(painted([[starGeo(5, 0.5, 0.26, 0.16, 0.08), '#ffd75e', where(0, 2.35, 0)]]), finishOf('glow', 'object'));
    this.on.visible = false;
    this.group.add(post, this.off, this.on);
    this.lit = false;
    this.time = 0;
  }

  set(lit) {
    this.lit = lit;
    this.on.visible = lit;
    this.off.visible = !lit;
  }

  update(dt) {
    this.time += dt;
    const s = this.lit ? 1 + Math.sin(this.time * 3) * 0.04 : 1;
    this.on.rotation.y = this.time * 0.9;
    this.on.scale.set(s, 1, s);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => o.geometry?.dispose());
  }
}

// A lantern on the Night Mare's moon: dark till somebody slams down by it, and
// then shining for a while.
export class LanternModel {
  constructor(dress) {
    this.at = dress;
    this.group = new THREE.Group();
    frameOf(dress, dress.k).decompose(this.group.position, this.group.quaternion, this.group.scale);
    const add = (geo, finish) => {
      const m = new THREE.Mesh(geo, finishOf(finish, 'object'));
      m.castShadow = true;
      this.group.add(m);
      return m;
    };
    add(painted([[lathe([[0, 0], [1.2, 0], [1.28, 0.12], [1.1, 0.42], [0.9, 0.48], [0, 0.48]], 32), '#4a3f7a'], [tube(1.12, 0.08, 36, 8), '#f4cf6a', where(0, 0.4, 0, 1, up)], [lathe([[0.2, 0.4], [0.14, 0.7], [0.12, 2.0], [0.24, 2.2], [0, 2.25]], 18), '#6a5aa8']]), 'gloss');
    const cage = [];
    for (let i = 0; i < 6; i++) cage.push([rod(0.03, 0.03, 0.9, 6), '#f4cf6a', where(Math.sin(i * 1.047) * 0.42, 2.7, Math.cos(i * 1.047) * 0.42)]);
    cage.push([new THREE.ConeGeometry(0.56, 0.4, 18), '#f4cf6a', where(0, 3.35, 0)], [rod(0.48, 0.48, 0.08, 18), '#f4cf6a', where(0, 2.24, 0)]);
    add(painted(cage), 'metal');
    this.dark = add(painted([[ball(0.36, 18, 14), '#3a3158', where(0, 2.7, 0)]]), 'plain');
    this.glow = add(painted([[ball(0.4, 18, 14), '#ffd75e', where(0, 2.7, 0)]]), 'glow');
    this.glow.visible = false;
    this.light = new THREE.PointLight('#ffcf7a', 0, 22, 1.4);
    this.light.position.set(0, 2.8, 0);
    this.group.add(this.light);
    this.k = 0;
  }

  set(on) {
    this.on = on;
    this.glow.visible = on;
    this.dark.visible = !on;
  }

  update(dt) {
    this.k += ((this.on ? 1 : 0) - this.k) * Math.min(1, dt * 6);
    this.light.intensity = 9 * this.k;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => o.geometry?.dispose());
  }
}

// The night-light: a great glowing toadstool with a sleepy face, dim until the
// last of its lamps is lit, and then warm as a sunrise.
export class NightLight {
  constructor(dress) {
    this.group = new THREE.Group();
    frameOf(dress, dress.k).decompose(this.group.position, this.group.quaternion, this.group.scale);
    const add = (geo, finish, shadow = true) => {
      const mesh = new THREE.Mesh(geo, finishOf(finish, 'object'));
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    add(painted([[lathe([[0, 0], [1.45, 0], [1.55, 0.12], [1.5, 0.5], [1.3, 0.68], [0, 0.7]], 40), '#8d7fd6'], [tube(1.5, 0.09, 44, 10), '#f4cf6a', where(0, 0.3, 0, 1, up)]]), 'gloss');
    add(painted([[lathe([[0.72, 0.6], [0.62, 1.2], [0.56, 1.8], [0.62, 2.3], [0.2, 2.5]], 32), '#fff4e2']]), 'soft');
    this.dome = new THREE.Mesh(
      smoothLathe([[0.4, 2.12], [1.25, 2.12], [1.7, 2.36], [1.76, 2.75], [1.5, 3.35], [1.0, 3.85], [0.45, 4.1], [0, 4.16]], 56),
      new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9f4a', emissiveIntensity: 0.6, roughness: 0.45 }),
    );
    this.group.add(this.dome);
    // Its spots, and its sleepy face.
    const spots = [];
    for (const [a, h, r] of [[0.15, 3.35, 0.34], [1.1, 2.75, 0.4], [2.2, 3.3, 0.32], [3.3, 2.8, 0.42], [4.3, 3.4, 0.34], [5.3, 2.7, 0.36], [0.6, 3.95, 0.2], [3.0, 3.95, 0.2]]) {
      const R = h > 3.7 ? 0.8 : h > 3.1 ? 1.5 : 1.74;
      const rise = h > 3.7 ? 1.6 : h > 3.1 ? 0.75 : 0.05;
      spots.push([ball(1, 18, 12), '#fff6dc', along(Math.sin(a) * R, h, Math.cos(a) * R, [Math.sin(a), rise, Math.cos(a)], [r, 0.1, r])]);
    }
    add(painted(spots), 'glow', false);
    const face = [];
    for (const s of [-1, 1]) {
      face.push([tube(0.12, 0.03, 14, 6, Math.PI), '#5a4378', where(s * 0.26, 1.62, 0.56, 1, 0, s * 0.35, Math.PI)]);
      face.push([ball(0.1, 10, 8), '#ff9fb0', where(s * 0.42, 1.42, 0.5, [1, 0.6, 0.4])]);
    }
    face.push([tube(0.07, 0.025, 12, 6, Math.PI), '#5a4378', where(0, 1.45, 0.62, 1, 0.1, 0, Math.PI)]);
    add(painted(face), 'plain', false);
    this.light = new THREE.PointLight('#ffb870', 2, 14, 1.8);
    this.light.position.set(0, 3.2, 0);
    this.group.add(this.light);
    this.glow = 0.35;
    this.time = 0;
  }

  // lit: how many of its lamps are, of all of them (0 to 1).
  update(dt, lit) {
    this.time += dt;
    const want = 0.3 + 0.7 * lit;
    this.glow += (want - this.glow) * Math.min(1, dt * 1.5);
    const breathe = 1 + Math.sin(this.time * 1.3) * 0.06;
    this.dome.material.emissiveIntensity = 1.5 * this.glow * breathe;
    this.light.intensity = 2.2 * this.glow * breathe;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      o.geometry?.dispose();
    });
    this.dome.material.dispose();
  }
}
