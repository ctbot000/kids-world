// The souls of the soul weapons as they look (shared/souls.js), each on its own
// little world (shared/nod/duel.js) with the weapon it is the soul of: Astra the Star
// Knight, Iris the Rainbow Serpent, Rowan the Wild Wolf, Carillon the Bell Giant,
// Scrawl the Living Doodle, Nocturne the Moon Owl and Folio the Paper Phoenix. Frights like the others
// (frights.js has how each is told it is), made of something like light: its edges
// shine.
import * as THREE from '../../../vendor/three.module.js';
import { SOULS } from '../../shared/souls.js';
import { soulBody } from '../soul-models.js';
import { addFrightModels, ball, cap, cone, ease, Fright, joint, lathe, piece, rod, tube } from './frights.js';
import { along, finishOf, where } from './kit.js';
import { Plume, sculpted } from './sculpt.js';

const TAU = Math.PI * 2;

// Their weapon, in the light of the world they are on.
const AS = { metal: 'metal', satin: 'plain', matte: 'soft', gloss: 'gloss', gem: 'crystal', glow: 'glow' };
const kit = { material: (finish) => finishOf(AS[finish] ?? 'plain', 'object') };
function weaponOf(key, k = 1.6) {
  const g = new THREE.Group();
  const body = soulBody(key, kit);
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.shared = true;
    o.castShadow = true;
  });
  g.add(body);
  g.scale.setScalar(k);
  return g;
}

// Shapes sculpted the once, however many times it is fought.
const shapes = new Map();
const shapeOf = (key, make) => {
  if (!shapes.has(key)) shapes.set(key, make());
  return shapes.get(key);
};

// Paint running from one colour to another by height (or any axis).
const a1 = new THREE.Color();
const b1 = new THREE.Color();
const c1 = new THREE.Color();
const fade = (lo, hi, from, to, axis = 1) => (...p) => c1.copy(a1.set(from)).lerp(b1.set(to), Math.max(0, Math.min(1, (p[axis] - lo) / (hi - lo))));

class Soul extends Fright {
  constructor(key, size) {
    const w = SOULS.find((s) => s.key === key);
    super({ ...size, color: w.color });
    this.w = w;
    this.plumes = [];
  }

  // A sculpted shape, shared by every one there ever is of it.
  skin(parent, key, make, finish = 'spirit') {
    const m = new THREE.Mesh(shapeOf(key, make), finishOf(finish, 'object'));
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.shared = true;
    parent.add(m);
    return m;
  }

  // Two eyes of light, looking +z.
  gaze(parent, { x = 0.16, y = 0, z = 0.3, r = 0.1, tall = 1.3, slope = 0.4, color = '#ffffff' } = {}) {
    return [-1, 1].map((s) => {
      const e = joint(parent, s * x, y, z);
      const m = piece(e, 'glow', [[ball(r, 16, 12), color, where(0, 0, 0, [1, tall, 0.5], 0, 0, s * slope)]]);
      m.userData.eye = true;
      return e;
    });
  }

  plume(parent, points, opt) {
    const p = new Plume(points, { hot: this.w.glow, cold: this.w.color, ...opt });
    p.mesh.userData.plume = true;
    parent.add(p.mesh);
    this.plumes.push(p);
    return p;
  }

  // Its eyes wide as it winds up, shut when it is open.
  look(eyes, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    for (const e of eyes) e.scale.set(1, s.open ? 0.22 : 1 + wind * 0.45, 1);
  }

  smoke(s, k = 1) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const fast = Math.min(1.4, (s.speed ?? 0) * 0.14);
    for (const p of this.plumes) p.update(this.time, k * (s.open ? 0.6 : 1 + wind * 0.4), 1 + fast);
  }

  dispose() {
    for (const p of this.plumes) p.dispose();
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.group.traverse((o) => {
      if (o.isMesh && !o.userData.shared && !o.userData.plume) o.geometry.dispose();
    });
  }
}

// How an arm goes for a blow of each kind: drawn back as it winds up, and through
// as it strikes. (forward: about x, less than 0 up and forward; out: about z.)
function armFor(s, rest) {
  const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
  const run = s.state === 'act' ? (s.run ?? 0) : 0;
  const k = s.kind;
  if (s.open) return { x: 0.5, z: 0.5, t: 10 };
  if (s.state === 'wind') {
    if (k === 'wave' || k === 'burst' || k === 'leap') return { x: -2.9 * wind, z: 0.2, t: 14 };
    if (k === 'shot' || k === 'lob' || k === 'beam') return { x: -1.5 * wind, z: 0.9 * wind, t: 12 };
    if (k === 'spots' || k === 'call') return { x: -2.6 * wind, z: 0.7 * wind, t: 12 };
    return { x: 0.9 * wind - 0.4, z: 1.2 * wind, t: 12 };
  }
  if (s.state === 'act') {
    if (k === 'wave' || k === 'burst' || k === 'leap') return { x: -0.4, z: 0, t: 24 };
    if (k === 'beam') return { x: -1.55, z: 0.1, t: 14 };
    if (k === 'shot' || k === 'lob') return { x: -1.2 + run * 0.4, z: -0.3, t: 26 };
    return { x: -1.5, z: -0.2 + run * 0.2, t: 30 };
  }
  return { x: rest.x, z: rest.z, t: 6 };
}

// ---------------------------------------------------------------- Astra

const starPts = (n, r, inner) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (i / n) * Math.PI + Math.PI / 2;
  const d = i % 2 ? inner : r;
  return new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d);
});
const starGeo = (n, r, inner, depth = 0.1) => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(starPts(n, r, inner)), { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
};

class Astra extends Soul {
  constructor() {
    super('star', { height: 3.5, radius: 0.95 });
    const b = joint(this.body, 0, 0.5, 0);
    this.float = b;
    this.skin(b, 'astra-body', () => sculpted(
      [
        { a: [0, 1.5, 0.02], r: 0.5, s: [1.15, 0.95, 0.85] },
        { a: [0, 1.15, 0.05], b: [0, 0.72, 0.02], r: 0.36, r1: 0.26 },
        { a: [0, 0.72, 0.02], b: [0, 0.2, -0.12], r: 0.34, r1: 0.22 },
        { a: [0, 0.2, -0.12], b: [0, -0.36, -0.42], r: 0.2, r1: 0.04 },
        ...[-1, 1].flatMap((s) => [
          { a: [s * 0.5, 1.72, 0], r: 0.24, k: 0.2 },
          { a: [s * 0.18, 1.62, 0.3], r: 0.22, s: [1, 0.85, 0.7], k: 0.12 },
          { a: [s * 0.22, 0.62, 0.02], b: [s * 0.3, 0.18, -0.1], r: 0.2, r1: 0.1 },
        ]),
      ],
      { k: 0.2, cell: 0.06, paint: fade(-0.3, 1.9, '#141a55', '#3a56d8') },
    ));
    // Gold about it: a breastplate star, a belt, shoulders.
    piece(b, 'metal', [
      [starGeo(5, 0.26, 0.12), '#ffd75e', where(0, 1.45, 0.42, 1, 0.1)],
      [tube(0.36, 0.05, 36, 8), '#ffcf4a', where(0, 0.74, 0.02, [1, 1, 0.9], Math.PI / 2)],
      ...[-1, 1].flatMap((s) => [
        [new THREE.SphereGeometry(0.34, 20, 12, 0, TAU, 0, Math.PI * 0.55), '#ffd75e', where(s * 0.58, 1.74, 0, [1, 0.8, 1], 0, 0, -s * 0.5)],
        [cone(0.08, 0.3, 8), '#fff3c0', where(s * 0.8, 1.96, 0, 1, 0, 0, -s * 0.6)],
      ]),
    ]);
    piece(b, 'glow', [[starGeo(5, 0.14, 0.06), '#ffffff', where(0, 1.45, 0.5, 1, 0.1)], ...[0, 1, 2, 3, 4, 5].map((i) => [ball(0.03, 8, 6), '#cfe8ff', where(Math.sin(i * 1.05) * 0.37, 0.74, Math.cos(i * 1.05) * 0.34 + 0.02)])]);
    // Its helm: a star over it, and two eyes in the dark of it.
    this.head = joint(b, 0, 2.2, 0.04);
    piece(this.head, 'metal', [
      [lathe([[0.3, -0.26], [0.36, -0.1], [0.36, 0.12], [0.28, 0.3], [0.12, 0.4], [0, 0.43]], 30), '#2f47c9', where()],
      [tube(0.35, 0.05, 34, 8), '#ffd75e', where(0, -0.14, 0, 1, Math.PI / 2)],
      [new THREE.BoxGeometry(0.1, 0.56, 0.12), '#ffd75e', where(0, 0.1, 0.32, 1, 0.18)],
      ...[-1, 1].map((s) => [cone(0.12, 0.7, 10), '#ffe9a0', where(s * 0.4, 0.28, -0.06, [1, 1, 0.5], 0, 0, -s * 0.75)]),
    ]);
    piece(this.head, 'plain', [[new THREE.BoxGeometry(0.5, 0.16, 0.1), '#0a0c24', where(0, 0.0, 0.31)]]);
    piece(this.head, 'glow', [[starGeo(4, 0.2, 0.06, 0.05), '#fff6c8', where(0, 0.6, 0.02)], [starGeo(4, 0.09, 0.03, 0.06), '#ffffff', where(0, 0.6, 0.06)]]);
    this.eyes = this.gaze(this.head, { x: 0.12, y: 0.0, z: 0.35, r: 0.065, tall: 0.8, slope: 0.35, color: '#fff3a0' });
    const arm = (s) => {
      const a = joint(b, s * 0.66, 1.66, 0);
      piece(a, 'spirit', [[cap(0.15, 0.4, 14), '#2b3fb8', where(0, -0.26, 0)], [ball(0.17, 14, 10), '#ffd75e', where(0, -0.54, 0)]]);
      const e = joint(a, 0, -0.54, 0);
      piece(e, 'spirit', [[cap(0.13, 0.34, 14), '#2b3fb8', where(0, -0.22, 0.02)]]);
      piece(e, 'metal', [[lathe([[0.13, -0.5], [0.2, -0.3], [0.18, -0.2]], 20), '#ffd75e', where()], [ball(0.16, 14, 10), '#3a56d8', where(0, -0.52, 0)]]);
      return { a, e };
    };
    this.right = arm(1);
    this.left = arm(-1);
    this.blade = weaponOf('star', 1.75);
    this.blade.rotation.x = Math.PI / 2;
    this.blade.position.set(0, -0.54, 0.05);
    this.right.e.add(this.blade);
    // Its shield: a great star.
    const sh = joint(this.left.e, -0.06, -0.4, 0.2);
    piece(sh, 'metal', [[starGeo(5, 0.62, 0.34, 0.08), '#2f47c9', where()], [starGeo(5, 0.46, 0.22, 0.14), '#ffd75e', where()]]);
    piece(sh, 'glow', [[starGeo(5, 0.2, 0.09, 0.2), '#fff6c8', where()]]);
    sh.rotation.y = -0.3;
    // A cape of night sky, in four lengths, and stars going round it.
    this.cape = [0, 1, 2, 3].map((i) => {
      const j = i ? joint(this.cape0, 0, -0.5, 0) : joint(b, 0, 1.86, -0.34);
      const w = 0.62 + i * 0.13;
      const g = new THREE.CylinderGeometry(w, w + 0.13, 0.54, 18, 1, true, Math.PI - 0.95, 1.9);
      g.translate(0, -0.25, w * 0.72);
      piece(j, 'spirit', [[g, ['#2a3fc8', '#24339f', '#1b2780', '#131b60'][i], where()]]);
      piece(j, 'glow', [0, 1, 2, 3].map((k) => {
        const a = Math.PI - 0.8 + k * 0.53 + (i % 2) * 0.24;
        return [starGeo(4, 0.055, 0.02, 0.02), k % 2 ? '#ffffff' : '#ffe9a0', where(Math.sin(a) * (w + 0.07), -0.12 - ((k * 7 + i * 3) % 5) * 0.07, w * 0.72 + Math.cos(a) * (w + 0.07), 1, 0, a)];
      }));
      this.cape0 = j;
      return j;
    });
    this.round = [0, 1, 2, 3, 4].map((i) => {
      const j = joint(b, 0, 1.2, 0);
      const k = joint(j, 0, 0, 1.35);
      piece(k, 'glow', [[starGeo(5, 0.16, 0.07, 0.06), ['#fff3a0', '#8fd8ff', '#ffffff'][i % 3], where()]]);
      return { j, k, i };
    });
    this.plume(b, [[-0.3, 1.8, -0.4], [0, 1.5, -0.5], [0.3, 1.8, -0.4], [0, 0.7, -0.7], [0, 0.1, -0.8]], { n: 40, size: 0.34, drift: [0, -0.4, -0.9], spread: 0.2, hot: '#8fd8ff', cold: '#2a3fd8', glow: 0.6, body: 0.2 });
    this.plume(b, [[0, 0.1, -0.2], [0, -0.34, -0.42]], { n: 26, size: 0.3, drift: [0, -0.4, -0.5], spread: 0.1, hot: '#fff0a8', cold: '#3a56d8' });
  }

  pose(dt, s) {
    const t = this.time;
    this.float.position.y = ease(this.float.position.y, 0.5 + Math.sin(t * 1.8) * 0.1 - (s.open ? 0.35 : 0), 8, dt);
    const r = armFor(s, { x: -0.5, z: 0.35 });
    this.right.a.rotation.x = ease(this.right.a.rotation.x, r.x, r.t, dt);
    this.right.a.rotation.z = ease(this.right.a.rotation.z, r.z, r.t, dt);
    this.right.e.rotation.x = ease(this.right.e.rotation.x, s.state === 'wind' ? -0.9 : s.state === 'act' ? -0.1 : -0.6, 14, dt);
    const guard = s.open ? 0.2 : s.state === 'wind' && s.kind !== 'shot' ? -1.1 : -0.8;
    this.left.a.rotation.x = ease(this.left.a.rotation.x, guard, 10, dt);
    this.left.a.rotation.z = ease(this.left.a.rotation.z, -0.35, 10, dt);
    this.left.e.rotation.x = ease(this.left.e.rotation.x, s.open ? -0.1 : -0.8, 10, dt);
    const spin = s.kind === 'burst' && s.state === 'act' ? t * 20 : 0;
    this.float.rotation.y = spin;
    this.float.rotation.x = ease(this.float.rotation.x, s.state === 'act' && (s.kind === 'lunge' || s.kind === 'charge') ? 0.5 : s.state === 'wind' ? -0.16 * (s.k ?? 0) : 0, 12, dt);
    this.head.rotation.x = ease(this.head.rotation.x, s.open ? 0.55 : 0, 8, dt);
    this.head.rotation.z = s.open ? Math.sin(t * 6) * 0.18 : 0;
    const fly = Math.min(0.42, 0.08 + (s.speed ?? 0) * 0.04 + (s.state === 'wind' ? 0.12 : 0));
    for (const [i, j] of this.cape.entries()) {
      j.rotation.x = ease(j.rotation.x, fly + Math.sin(t * 2.4 - i * 0.8) * 0.09, 8, dt);
      j.rotation.z = Math.sin(t * 1.7 - i * 0.7) * 0.05;
    }
    for (const { j, k, i } of this.round) {
      j.rotation.y = t * (s.state === 'wind' ? 5 : 1.1) + (i / 5) * TAU;
      j.position.y = 1.2 + Math.sin(t * 1.3 + i * 1.9) * 0.45 - (s.open ? 0.8 : 0);
      k.rotation.y = t * 3 + i;
    }
    this.look(this.eyes, s);
    this.smoke(s);
  }
}

// ---------------------------------------------------------------- Iris

const RAIN = ['#ff4b3e', '#ff9330', '#ffd83a', '#3fc95c', '#3a8bff', '#5a4be0', '#b45cf0'];
const LINKS = 14;

class Iris extends Soul {
  constructor() {
    super('rainbow', { height: 1.9, radius: 1 });
    this.head = joint(this.body, 0, 0.85, 0);
    this.skin(this.head, 'iris-head', () => sculpted(
      [
        { a: [0, 0.06, -0.2], r: 0.4, s: [1.02, 0.9, 1.1] },
        { a: [0, 0.06, 0.1], b: [0, -0.02, 0.62], r: 0.27, r1: 0.19 },
        { a: [0, 0.02, 0.72], r: 0.17, s: [1.15, 0.78, 0.9] },
        { a: [0, 0.2, 0.0], b: [0, 0.13, 0.55], r: 0.14, r1: 0.08, k: 0.1 },
        ...[-1, 1].flatMap((q) => [
          { a: [q * 0.2, 0.27, 0.02], b: [q * 0.3, 0.22, 0.26], r: 0.12, r1: 0.08, k: 0.08 },
          { a: [q * 0.3, -0.06, -0.12], r: 0.2, s: [0.8, 1, 1.15] },
          { a: [q * 0.1, 0.12, 0.76], r: 0.075, k: 0.06 },
        ]),
      ],
      { k: 0.14, cell: 0.042, paint: (x, y, z) => c1.copy(a1.set('#fff6ff')).lerp(b1.setHSL((Math.atan2(y - 0.05, x) / TAU + 1.25) % 1, 0.95, 0.6, THREE.SRGBColorSpace), Math.max(0.2, Math.min(0.94, 0.82 - z * 0.85))) },
    ));
    // Her jaw, and the light in it.
    this.jaw = joint(this.head, 0, -0.16, -0.02);
    this.skin(this.jaw, 'iris-jaw', () => sculpted([{ a: [0, -0.02, 0.02], b: [0, -0.04, 0.6], r: 0.17, r1: 0.11 }, { a: [0, -0.02, 0.66], r: 0.11, s: [1.1, 0.7, 1] }], { k: 0.1, cell: 0.04, paint: '#f4e2ff' }));
    piece(this.jaw, 'glow', [[ball(0.12, 14, 10), '#ff6fb8', where(0, 0.07, 0.36, [0.8, 0.35, 2])]]);
    piece(this.head, 'gloss', [
      ...[-1, 1].flatMap((q) => [
        [cone(0.085, 0.8, 12), '#fff3c8', along(q * 0.25, 0.56, -0.44, [q * 0.4, 0.85, -1])],
        [cone(0.055, 0.36, 10), '#fff3c8', along(q * 0.36, 0.74, -0.34, [q * 0.7, 1, 0.1])],
        [cone(0.06, 0.5, 10), '#ffe3a0', along(q * 0.46, 0.2, -0.46, [q * 1.1, 0.3, -1])],
        [cone(0.032, 0.17, 8), '#fffaf0', where(q * 0.12, -0.17, 0.74, 1, Math.PI)],
        [cone(0.026, 0.11, 8), '#fffaf0', where(q * 0.15, -0.16, 0.56, 1, Math.PI)],
        [ball(0.036, 8, 6), '#7a2f8a', where(q * 0.11, 0.1, 0.85, [1, 0.7, 0.6])],
      ]),
      ...[-1, 1].map((q) => [ball(0.135, 18, 14), '#2a0f4a', where(q * 0.265, 0.16, 0.235, [0.72, 1, 1])]),
    ]);
    // A mane of plumes of every colour, all round the back of her head.
    this.crest = Array.from({ length: 17 }, (_, i) => {
      const a = (i / 16 - 0.5) * 4.4;
      const j = joint(this.head, Math.sin(a) * 0.34, 0.06 + Math.cos(a) * 0.32, -0.34);
      j.rotation.z = -a;
      const k = joint(j);
      piece(k, 'spirit', [[cone(0.1, 0.78 - (Math.abs(a) / 2.2) * 0.22, 10), RAIN[i % 7], where(0, 0.34, 0, [1, 1, 0.4])]]);
      return { k, i };
    });
    this.eyes = this.gaze(this.head, { x: 0.3, y: 0.17, z: 0.27, r: 0.1, tall: 0.95, slope: 0.3, color: '#fff0a0' });
    for (const [i, e] of this.eyes.entries()) piece(e, 'plain', [[ball(0.05, 10, 8), '#200a38', where(i ? 0.035 : -0.035, 0, 0.032, [0.5, 1.5, 0.5])]]);
    // Whiskers of light.
    for (const s of [-1, 1]) this.plume(this.head, [[s * 0.2, -0.1, 0.9], [s * 0.5, 0.0, 0.8], [s * 0.8, 0.1, 0.5]], { n: 16, size: 0.16, drift: [s * 0.25, 0.1, -0.7], spread: 0.03, hot: '#ffffff', cold: s > 0 ? '#ff7ad9' : '#7affd0' });
    // The ring she is the soul of, round her neck like a collar.
    this.collar = joint(this.head, 0, 0, -0.42);
    const ring = weaponOf('rainbow', 1.75);
    ring.position.y = -0.42 * 1.75;
    this.spinner = joint(this.collar);
    this.spinner.add(ring);
    // And the rest of her, link after link, after wherever her head has been.
    this.links = Array.from({ length: LINKS }, (_, i) => {
      const g = new THREE.Group();
      const k = 1 - (i / LINKS) * 0.72;
      const c = `#${new THREE.Color().setHSL((0.92 + (i / LINKS) * 1.15) % 1, 0.92, 0.58, THREE.SRGBColorSpace).getHexString()}`;
      const d = `#${new THREE.Color().setHSL((1.06 + (i / LINKS) * 1.15) % 1, 0.95, 0.66, THREE.SRGBColorSpace).getHexString()}`;
      piece(g, 'spirit', [[ball(0.41 * k, 22, 16), c, where(0, 0, 0, [1, 0.94, 1.55])], [cone(0.1 * k, 0.46 * k, 10), d, where(0, 0.46 * k, -0.06, [1, 1, 0.45], -0.6)], ...[-1, 1].map((q) => [cone(0.07 * k, 0.3 * k, 8), d, along(q * 0.42 * k, 0.1 * k, -0.06, [q, 0.25, -0.8], [1, 1, 0.45])])]);
      piece(g, 'glow', [-1, 0, 1].map((q) => [ball(0.034 * k, 8, 6), '#ffffff', where(q * 0.3 * k, 0.29 * k - Math.abs(q) * 0.1 * k, 0.16 * k)]));
      if (i === LINKS - 1) piece(g, 'spirit', RAIN.map((q, j) => [cone(0.07, 0.6, 8), q, along(0, 0, -0.3, [Math.sin((j - 3) * 0.4), 0.15, -Math.cos((j - 3) * 0.4)])]));
      this.group.add(g);
      return g;
    });
    this.trail = [];
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  pose(dt, s) {
    const t = this.time;
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    this.head.position.y = ease(this.head.position.y, s.open ? 0.4 : 0.85 + Math.sin(t * 2.2) * 0.12, 8, dt);
    this.head.rotation.x = ease(this.head.rotation.x, s.open ? 0.5 : act && s.kind === 'lunge' ? 0.35 : -0.35 * wind, 12, dt);
    this.head.rotation.z = s.open ? Math.sin(t * 6) * 0.3 : Math.sin(t * 1.4) * 0.12;
    this.spinner.rotation.z += dt * (act || wind ? 9 : 2.2);
    for (const { k, i } of this.crest) k.rotation.x = -0.95 - Math.sin(t * 3 + i * 0.9) * 0.13 + wind * 0.5 - Math.min(0.35, (s.speed ?? 0) * 0.04);
    this.jaw.rotation.x = ease(this.jaw.rotation.x, s.open ? 0.3 + Math.sin(t * 5) * 0.08 : act || wind > 0.2 ? 0.5 : 0.1 + Math.sin(t * 2) * 0.04, 12, dt);
    this.look(this.eyes, s);
    this.smoke(s);
    // Her links, along the way her head has come.
    this.group.updateMatrixWorld();
    const at = this.tmp.set(0, this.head.position.y, -0.35).applyMatrix4(this.group.matrixWorld);
    const last = this.trail[0];
    if (!last || last.distanceTo(at) > 0.08) this.trail.unshift(at.clone());
    if (this.trail.length > 190) this.trail.pop();
    const back = this.tmp2.set(0, 0, -1).transformDirection(this.group.matrixWorld);
    let prev = at.clone();
    let i = 0;
    for (const [n, g] of this.links.entries()) {
      let left = 0.46 - n * 0.012;
      let p = prev.clone();
      while (i < this.trail.length) {
        const d = p.distanceTo(this.trail[i]);
        if (d >= left) {
          p.lerp(this.trail[i], left / d);
          left = 0;
          break;
        }
        left -= d;
        p.copy(this.trail[i]);
        i++;
      }
      if (left > 0) p.addScaledVector(back, left);
      const sway = Math.sin(t * 2.6 - n * 0.55) * 0.1;
      const local = this.group.worldToLocal(p.clone());
      const to = this.group.worldToLocal(prev.clone());
      g.position.set(local.x + sway, local.y + Math.sin(t * 2 - n * 0.6) * 0.07, local.z);
      g.lookAt(this.group.localToWorld(to.add(new THREE.Vector3(sway * 0.6, 0, 0.001))));
      prev = p;
    }
  }
}

// ---------------------------------------------------------------- Rowan

const leafGeo = () => shapeOf('rowan-leaf', () => {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.13, 0.12, 0.09, 0.28);
  sh.quadraticCurveTo(0.05, 0.4, 0, 0.5);
  sh.quadraticCurveTo(-0.05, 0.4, -0.09, 0.28);
  sh.quadraticCurveTo(-0.13, 0.12, 0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -0.01);
  return g;
});
const GREENS = ['#6fc24a', '#a8e66a', '#4f9a3f', '#d8c24a', '#3f8a4a'];

class Rowan extends Soul {
  constructor() {
    super('wild', { height: 2.7, radius: 1.25 });
    const h = joint(this.body);
    this.wolf = h;
    h.scale.setScalar(1.34);
    const leaf = leafGeo();
    // Dark moss above, pale below, as a wolf's coat is.
    const coat = (lo, hi) => (x, y) => {
      const k = Math.max(0, Math.min(1, (y - lo) / (hi - lo)));
      return c1.copy(a1.set('#a9c98a')).lerp(b1.set('#2f6a3c'), Math.min(1, k * 1.9)).lerp(b1.set('#16361f'), Math.max(0, k * 1.6 - 0.8));
    };
    this.trunk = joint(h, 0, 1.12, 0);
    this.skin(this.trunk, 'rowan-trunk', () => sculpted(
      [
        { a: [0, 0.02, 0.36], r: 0.38, s: [0.9, 1.15, 1.05] },
        { a: [0, 0.04, 0.2], b: [0, 0.1, -0.42], r: 0.31, r1: 0.24 },
        { a: [0, 0.1, -0.56], r: 0.29, s: [1, 1, 1.05] },
        { a: [0, 0.22, 0.55], b: [0, 0.42, 0.7], r: 0.32, r1: 0.26, k: 0.24 },
        { a: [0, 0.34, 0.3], b: [0, 0.3, -0.3], r: 0.1, r1: 0.07, k: 0.26 },
        ...[-1, 1].flatMap((q) => [
          { a: [q * 0.2, 0.04, 0.42], b: [q * 0.23, -0.26, 0.44], r: 0.2, r1: 0.13 },
          { a: [q * 0.2, 0.04, -0.55], b: [q * 0.24, -0.22, -0.5], r: 0.24, r1: 0.16 },
        ]),
      ],
      { k: 0.16, cell: 0.05, paint: coat(-0.36, 0.5) },
    ));
    // Its marks, and the sunstone in its breast.
    piece(this.trunk, 'glow', [
      ...[-1, 1].flatMap((q) => [0, 1, 2, 3].map((i) => [cap(0.024, 0.2 - i * 0.02, 8), '#ffb547', where(q * (0.335 - i * 0.02), 0.14, 0.34 - i * 0.26, 1, 0.5, 0, q * 0.5)])),
      [new THREE.IcosahedronGeometry(0.12, 1), '#ffc94a', where(0, 0.04, 0.8)],
    ]);
    piece(this.trunk, 'metal', [[tube(0.16, 0.032, 28, 8), '#d99a3a', where(0, 0.04, 0.8)]]);
    // Leaves down its back, and a great ruff of them.
    const spine = [];
    for (let i = 0; i < 26; i++) {
      const z = 0.42 - (i / 25) * 1.2;
      const q = ((i * 7) % 5) - 2;
      spine.push([leaf, GREENS[i % 5], along(q * 0.07, 0.36 - Math.abs(q) * 0.035 - (z < -0.3 ? (-0.3 - z) * 0.12 : 0), z, [q * 0.18, 0.5, -1], 0.75 - Math.abs(q) * 0.05)]);
    }
    piece(this.trunk, 'spirit', spine);
    this.neck = joint(this.trunk, 0, 0.38, 0.62);
    this.skin(this.neck, 'rowan-neck', () => sculpted([{ a: [0, -0.1, -0.06], b: [0, 0.28, 0.2], r: 0.3, r1: 0.2 }, { a: [0, 0.18, -0.12], b: [0, 0.42, 0.06], r: 0.18, r1: 0.14 }], { k: 0.16, cell: 0.05, paint: coat(-0.4, 0.4) }));
    const ruff = [];
    for (let row = 0; row < 5; row++) {
      const n = 15 - row;
      for (let i = 0; i < n; i++) {
        const a = ((i + (row % 2) * 0.5) / n) * TAU;
        const r = 0.33 - row * 0.03;
        const up = -0.1 + row * 0.1;
        const fwd = -0.06 + row * 0.075;
        ruff.push([leaf, GREENS[(i + row * 2) % 5], along(Math.sin(a) * r, up + Math.cos(a) * r * 0.75, fwd - Math.cos(a) * r * 0.5, [Math.sin(a) * 0.85, Math.cos(a) * 0.6 - 0.35, -0.8 + (Math.cos(a) < -0.2 ? 0.5 : 0)], 1.05 - row * 0.11)]);
      }
    }
    piece(this.neck, 'spirit', ruff);
    this.head = joint(this.neck, 0, 0.44, 0.24);
    this.skin(this.head, 'rowan-head', () => sculpted(
      [
        { a: [0, 0.04, -0.02], r: 0.205, s: [1.08, 0.92, 1.05] },
        { a: [0, 0.07, 0.1], r: 0.13 },
        { a: [0, -0.03, 0.16], b: [0, -0.07, 0.44], r: 0.105, r1: 0.075, k: 0.09 },
        { a: [0, -0.045, 0.47], r: 0.066, s: [1.1, 0.9, 1], k: 0.05 },
        ...[-1, 1].flatMap((q) => [
          { a: [q * 0.14, -0.06, 0.0], r: 0.13, s: [0.9, 1, 1] },
          { a: [q * 0.1, 0.1, 0.11], b: [q * 0.14, 0.12, 0.02], r: 0.055, r1: 0.05, k: 0.06 },
        ]),
      ],
      { k: 0.1, cell: 0.03, paint: coat(-0.22, 0.2) },
    ));
    this.jaw = joint(this.head, 0, -0.11, 0.06);
    this.skin(this.jaw, 'rowan-jaw', () => sculpted([{ a: [0, -0.01, 0.02], b: [0, -0.035, 0.34], r: 0.075, r1: 0.05 }], { k: 0.05, cell: 0.026, paint: '#9fc07f' }));
    piece(this.jaw, 'gloss', [[ball(0.045, 10, 8), '#ff7a8a', where(0, 0.035, 0.2, [0.9, 0.3, 2.2])], ...[-1, 1].map((q) => [cone(0.018, 0.08, 6), '#fffaf0', where(q * 0.045, 0.045, 0.32)])]);
    // Ears, cheeks of leaves, teeth, nose, and the stone in its brow.
    piece(this.head, 'spirit', [
      ...[-1, 1].flatMap((q) => [
        [cone(0.095, 0.34, 14), '#2f6a3c', along(q * 0.14, 0.3, -0.07, [q * 0.32, 1, -0.12], [1, 1, 0.55])],
        [cone(0.06, 0.24, 12), '#d8f0a0', along(q * 0.14, 0.275, -0.04, [q * 0.32, 1, -0.12], [1, 1, 0.4])],
        ...[0, 1, 2].map((i) => [leaf, GREENS[(i + 1) % 5], along(q * 0.2, -0.02 - i * 0.07, -0.03, [q * 0.9, -0.25 - i * 0.25, -0.75], 0.5)]),
      ]),
    ]);
    piece(this.head, 'gloss', [[ball(0.05, 12, 8), '#141c14', where(0, -0.025, 0.525, [1.25, 0.9, 0.8])], ...[-1, 1].flatMap((q) => [[cone(0.024, 0.12, 8), '#fffaf0', where(q * 0.058, -0.14, 0.42, 1, Math.PI)], [cone(0.018, 0.07, 8), '#fffaf0', where(q * 0.07, -0.13, 0.33, 1, Math.PI)]])]);
    piece(this.head, 'glow', [[new THREE.OctahedronGeometry(0.055, 0), '#ffb547', where(0, 0.19, 0.14, [1, 1.5, 0.7])]]);
    this.eyes = this.gaze(this.head, { x: 0.105, y: 0.055, z: 0.185, r: 0.05, tall: 0.75, slope: 0.5, color: '#ffe04d' });
    this.legs = [[-0.23, 0.44], [0.23, 0.44], [-0.24, -0.54], [0.24, -0.54]].map(([x, z], i) => {
      const l = joint(h, x, 0.95, z);
      const dark = fade(-0.9, 0.3, '#16361f', '#2f6a3c');
      this.skin(l, `rowan-leg${i < 2 ? 'f' : 'b'}`, () => sculpted(i < 2 ? [{ a: [0, 0.12, 0], b: [0, -0.36, 0.01], r: 0.16, r1: 0.088 }] : [{ a: [0, 0.12, 0.04], b: [0, -0.14, 0.09], r: 0.22, r1: 0.13 }, { a: [0, -0.14, 0.09], b: [0, -0.4, -0.06], r: 0.12, r1: 0.08 }], { k: 0.1, cell: 0.036, paint: dark }));
      const k = joint(l, 0, -0.38, i < 2 ? 0.01 : -0.06);
      this.skin(k, 'rowan-shin', () => sculpted([{ a: [0, 0.03, 0], b: [0, -0.42, 0.02], r: 0.086, r1: 0.066 }, { a: [0, -0.5, 0.07], r: 0.105, s: [0.95, 0.62, 1.3] }], { k: 0.08, cell: 0.032, paint: fade(-0.55, 0.05, '#0f2616', '#1f4a2b') }));
      piece(k, 'glow', [-1, 0, 1].map((c) => [cone(0.02, 0.08, 6), '#ffe0a0', where(c * 0.05, -0.535, 0.2, 1, 1.7)]));
      // A tuft of leaves at each ankle.
      piece(k, 'spirit', Array.from({ length: 6 }, (_, j) => [leaf, GREENS[j % 5], along(Math.sin(j * 1.05) * 0.07, -0.16, Math.cos(j * 1.05) * 0.07, [Math.sin(j * 1.05) * 0.6, -1, Math.cos(j * 1.05) * 0.6], 0.36)]));
      return { l, k, i };
    });
    this.tail = joint(this.trunk, 0, 0.2, -0.76);
    const brush = [];
    for (let i = 0; i < 34; i++) {
      const k = i / 33;
      const a = i * 2.39996;
      const r = 0.05 + Math.sin(Math.min(1, k * 1.25) * Math.PI) * 0.1;
      brush.push([leaf, GREENS[i % 5], along(Math.sin(a) * r, 0.02 + Math.sin(k * 2.4) * 0.14 + Math.cos(a) * r, -0.04 - k * 0.72, [Math.sin(a) * 0.55, Math.cos(a) * 0.55 + 0.1, -1], 0.78 - k * 0.2)]);
    }
    piece(this.tail, 'spirit', brush);
    this.plume(this.tail, [[0, 0.1, -0.5], [0, 0.14, -0.8], [0, 0.1, -1.0]], { n: 34, size: 0.28, drift: [0, 0.14, -0.6], spread: 0.1, hot: '#c9ff8a', cold: '#1f7a3f', glow: 0.7, body: 0.3 });
    this.plume(this.neck, [[0, 0.4, 0], [0, 0.2, -0.2], [0, -0.05, -0.35]], { n: 22, size: 0.22, drift: [0, 0.25, -0.6], spread: 0.16, hot: '#ffd07a', cold: '#2f8f4a', glow: 0.6, body: 0.25 });
    // The axe it is the soul of, hanging in the air over its back.
    this.axe = joint(h, 0, 2.2, -0.4);
    const w = weaponOf('wild', 0.95);
    w.position.y = -0.4;
    this.axeTurn = joint(this.axe);
    this.axeTurn.add(w);
  }

  pose(dt, s) {
    const t = this.time;
    const act = s.state === 'act';
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const gallop = act || s.speed > 4;
    const rate = gallop ? 2.4 : 1.3;
    const howl = s.kind === 'wave' || s.kind === 'call' || s.kind === 'spots';
    for (const { l, k, i } of this.legs) {
      const a = this.step * rate + [0, 0.8, Math.PI, Math.PI + 0.8][i];
      const amp = s.open ? 0 : Math.min(1.05, 0.06 + (s.speed ?? 0) * 0.13);
      l.rotation.x = ease(l.rotation.x, Math.sin(a) * amp + (wind && !howl && i < 2 ? 0.5 * wind : 0), 18, dt);
      k.rotation.x = ease(k.rotation.x, Math.max(0, Math.cos(a)) * amp * 1.1, 18, dt);
    }
    const crouch = wind && !howl ? wind * 0.2 : 0;
    this.trunk.position.y = ease(this.trunk.position.y, (s.open ? 0.86 : 1.12) - crouch + (gallop ? Math.abs(Math.sin(this.step * rate)) * 0.14 : 0), 12, dt);
    this.trunk.rotation.x = ease(this.trunk.rotation.x, act && s.kind === 'leap' ? -0.35 : gallop ? Math.sin(this.step * rate) * 0.1 : crouch * 0.6, 12, dt);
    this.neck.rotation.x = ease(this.neck.rotation.x, s.open ? 0.7 : howl && (wind || act) ? -0.7 : act ? 0.45 : wind ? 0.35 : 0.1 + Math.sin(t * 1.6) * 0.05, 10, dt);
    this.head.rotation.x = ease(this.head.rotation.x, s.open ? 0.35 : howl && (wind || act) ? -0.55 : act ? -0.25 : wind ? -0.2 : 0.08, 10, dt);
    this.head.rotation.z = s.open ? Math.sin(t * 7) * 0.2 : 0;
    this.head.rotation.y = s.open || act || wind ? 0 : Math.sin(t * 0.9) * 0.18;
    this.jaw.rotation.x = ease(this.jaw.rotation.x, s.open ? 0.35 + Math.sin(t * 9) * 0.1 : act || howl ? 0.7 : wind ? 0.35 : 0.05, 12, dt);
    this.tail.rotation.x = Math.sin(t * 2.2) * 0.16 + (gallop ? 0.35 : -0.15);
    this.tail.rotation.y = Math.sin(t * 3.4) * 0.3;
    this.axe.position.y = 2.2 + Math.sin(t * 1.7) * 0.1 - (s.open ? 0.5 : 0);
    this.axeTurn.rotation.set(act ? t * 12 : 0.5 + Math.sin(t) * 0.1, 0, 1.2 + Math.sin(t * 1.3) * 0.2);
    this.look(this.eyes, s);
    this.smoke(s);
  }
}

// ---------------------------------------------------------------- Carillon

class Carillon extends Soul {
  constructor() {
    super('bells', { height: 4.1, radius: 1.45 });
    const b = joint(this.body, 0, 0.75, 0);
    this.bell = b;
    const shell = shapeOf('carillon-bell', () => {
      const g = new THREE.LatheGeometry([[1.28, -0.12], [1.45, -0.06], [1.46, 0.08], [1.3, 0.22], [1.12, 0.55], [1.0, 1.05], [0.94, 1.6], [0.86, 2.05], [0.66, 2.38], [0.34, 2.54], [0, 2.58]].map(([x, y]) => new THREE.Vector2(x, y)), 56);
      return g;
    });
    piece(b, 'metal', [[shell, '#e8ab2f', where()]]);
    piece(b, 'metal', [
      [tube(1.16, 0.05, 60, 8), '#fff0b0', where(0, 0.5, 0, 1, Math.PI / 2)],
      [tube(1.02, 0.04, 60, 8), '#fff0b0', where(0, 1.0, 0, 1, Math.PI / 2)],
      [tube(0.88, 0.05, 56, 8), '#fff0b0', where(0, 2.02, 0, 1, Math.PI / 2)],
      [tube(0.3, 0.11, 30, 10), '#ffcf4a', where(0, 2.82, 0)],
      [rod(0.34, 0.26, 0.2, 24), '#c98a20', where(0, 2.62, 0)],
    ]);
    // Its crown of points, and what is written round it, alight.
    piece(b, 'glow', [
      ...Array.from({ length: 14 }, (_, i) => [starGeo(4, 0.1, 0.035, 0.04), '#fff6cf', where(Math.sin((i / 14) * TAU) * 1.1, 0.76, Math.cos((i / 14) * TAU) * 1.1, 1, 0, (i / 14) * TAU)]),
      ...Array.from({ length: 10 }, (_, i) => [cone(0.06, 0.22, 8), '#ffe9a0', along(Math.sin((i / 10) * TAU) * 0.5, 2.56, Math.cos((i / 10) * TAU) * 0.5, [Math.sin((i / 10) * TAU) * 0.6, 1, Math.cos((i / 10) * TAU) * 0.6])]),
    ]);
    // A face cast in the front of it: heavy brows, a mouth that is a crack of light.
    const f = joint(b, 0, 1.46, 0.93);
    this.face = f;
    piece(f, 'metal', [-1, 1].map((s) => [cap(0.085, 0.34, 10), '#a86a18', where(s * 0.3, 0.24, 0.06, 1, 0, 0, Math.PI / 2 + s * 0.32)]));
    piece(f, 'plain', [-1, 1].map((s) => [ball(0.17, 16, 12), '#3a2208', where(s * 0.3, 0.02, 0.0, [1, 1.05, 0.5])]));
    this.eyes = this.gaze(f, { x: 0.3, y: 0.02, z: 0.1, r: 0.11, tall: 1.05, slope: 0.15, color: '#fff3b0' });
    this.mouth = joint(f, 0, -0.5, 0.1);
    piece(this.mouth, 'plain', [[ball(0.36, 22, 14), '#3a2208', where(0, 0, -0.02, [1.12, 0.3, 0.4])]]);
    const m = piece(this.mouth, 'glow', [[ball(0.33, 22, 14), '#ffcf6a', where(0, 0, 0.02, [1.05, 0.16, 0.4])]]);
    m.userData.eye = true;
    // Its teeth: keys of a carillon.
    piece(this.mouth, 'metal', [-2, -1, 0, 1, 2].map((i) => [new THREE.BoxGeometry(0.07, 0.07, 0.06), '#fff0b0', where(i * 0.12, 0.045, 0.14 - Math.abs(i) * 0.012)]));
    // Its clapper, swinging under it.
    this.clapper = joint(b, 0, 1.0, 0);
    piece(this.clapper, 'plain', [[rod(0.07, 0.07, 1.2, 12), '#4a5a78', where(0, -0.6, 0)]]);
    piece(this.clapper, 'gloss', [[ball(0.42, 24, 18), '#3f6fd8', where(0, -1.3, 0)]]);
    piece(this.clapper, 'glow', [[tube(0.43, 0.04, 34, 8), '#bfe6ff', where(0, -1.3, 0, 1, Math.PI / 2)]]);
    // Feathers on top of it.
    piece(b, 'spirit', [[-0.5, '#15161f'], [-0.17, '#f6f8ff'], [0.16, '#2a4fc8'], [0.48, '#15161f']].map(([a, c], i) => [cone(0.1, 0.9 - Math.abs(a) * 0.4, 10), c, along(a * 0.4, 3.3 - Math.abs(a) * 0.2, -0.1 - (i % 2) * 0.06, [a, 1, -0.25], [1, 1, 0.35])]));
    // Two great gauntlets, in the air beside it.
    const fist = (s) => {
      const j = joint(b, s * 1.75, 0.95, 0.35);
      piece(j, 'metal', [
        [ball(0.36, 22, 16), '#ffcf4a', where(0, 0, 0, [1, 0.95, 1.1])],
        [lathe([[0.26, -0.1], [0.4, 0.22], [0.36, 0.34], [0.2, 0.3]], 26), '#c98a20', where(0, 0.14, -0.14, 1, -0.5)],
        ...[0, 1, 2, 3].map((i) => [cap(0.095, 0.2, 10), '#ffd76a', where((i - 1.5) * 0.17, -0.1, 0.28, 1, 0.9)]),
        [cap(0.1, 0.2, 10), '#ffd76a', where(-s * 0.3, -0.02, 0.18, 1, 0.5, 0, s * 0.7)],
      ]);
      piece(j, 'glow', [[starGeo(5, 0.13, 0.06, 0.04), '#fff6cf', where(0, 0.36, -0.06, 1, -Math.PI / 2)]]);
      return j;
    };
    this.right = fist(1);
    this.left = fist(-1);
    this.hammer = weaponOf('bells', 1.55);
    this.hammer.rotation.x = Math.PI / 2;
    this.hammer.position.set(0, -0.06, 0.1);
    this.right.add(this.hammer);
    this.plume(b, [[-0.8, -0.1, 0], [0, -0.15, 0.8], [0.8, -0.1, 0], [0, -0.15, -0.8]], { n: 46, size: 0.4, drift: [0, -0.6, 0], spread: 0.2, hot: '#fff0b0', cold: '#ff9d1f', glow: 0.6, body: 0.2 });
  }

  pose(dt, s) {
    const t = this.time;
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const ring = act && (s.kind === 'wave' || s.kind === 'burst');
    this.bell.position.y = ease(this.bell.position.y, s.open ? 0.2 : 0.75 + Math.sin(t * 1.5) * 0.08 + (s.kind === 'leap' && wind ? -0.2 * wind : 0), 8, dt);
    const sway = ring ? Math.sin(t * 11) * 0.22 : s.open ? Math.sin(t * 3) * 0.12 : Math.sin(t * 1.3) * 0.04;
    this.bell.rotation.z = ease(this.bell.rotation.z, sway, 16, dt);
    this.bell.rotation.x = ease(this.bell.rotation.x, s.kind === 'beam' && act ? 0.16 : -0.1 * wind, 8, dt);
    this.clapper.rotation.x = ring ? Math.sin(t * 11) * 0.8 : s.kind === 'beam' && act ? -0.5 : Math.sin(t * 1.8) * 0.2;
    this.clapper.rotation.z = Math.sin(t * 1.4 + 1) * 0.14;
    const r = armFor(s, { x: 0, z: 0 });
    const up = Math.max(0, -r.x) * 0.5;
    this.right.position.y = ease(this.right.position.y, 0.95 + up + (s.open ? -0.7 : 0), r.t, dt);
    this.right.position.z = ease(this.right.position.z, 0.35 + (act ? 0.9 : 0), r.t, dt);
    this.right.rotation.x = ease(this.right.rotation.x, r.x * 0.6 - 0.2, r.t, dt);
    this.left.position.y = ease(this.left.position.y, 0.95 + (s.kind === 'shot' || s.kind === 'lob' || s.kind === 'call' ? up : up * 0.5) + (s.open ? -0.7 : 0) + Math.sin(t * 1.9) * 0.06, 10, dt);
    this.left.position.z = ease(this.left.position.z, 0.35 + (act && s.kind !== 'wave' ? 0.6 : 0), 10, dt);
    this.mouth.scale.y = ease(this.mouth.scale.y, (s.open ? 0.6 : act || wind ? 2 : 1) + Math.sin(t * 5) * 0.12, 12, dt);
    this.look(this.eyes, s);
    this.smoke(s, 0.9);
  }
}

// ---------------------------------------------------------------- Scrawl

class Scrawl extends Soul {
  constructor() {
    super('toon', { height: 3.1, radius: 1.05 });
    const b = joint(this.body);
    this.blob = b;
    this.skin(b, 'scrawl-body', () => sculpted(
      [
        { a: [0, 0.5, 0], r: 0.78, s: [1.08, 0.72, 1] },
        { a: [0, 1.0, 0], b: [0, 1.72, 0.04], r: 0.62, r1: 0.5 },
        { a: [0, 1.95, 0.05], r: 0.52, s: [1.05, 0.95, 0.98] },
        ...Array.from({ length: 7 }, (_, i) => ({ a: [Math.sin(i * 0.9) * 0.82, 0.13, Math.cos(i * 0.9) * 0.82], r: 0.22 + (i % 3) * 0.05, s: [1, 0.55, 1], k: 0.24 })),
        { a: [0.1, 2.35, -0.02], b: [0.26, 2.62, -0.06], r: 0.16, r1: 0.05 },
        { a: [-0.16, 2.36, 0], b: [-0.3, 2.54, 0], r: 0.12, r1: 0.04 },
      ],
      { k: 0.22, cell: 0.06, paint: (x, y, z) => c1.copy(a1.set('#1b1145')).lerp(b1.set('#5a36c0'), Math.max(0, Math.min(1, (y - 0.1) / 2.2))).lerp(b1.setHSL((Math.sin(x * 3.1 + y * 2.3) * 0.5 + z * 0.4 + 2) % 1, 0.9, 0.55, THREE.SRGBColorSpace), Math.max(0, Math.sin(x * 5.3 + y * 4.1 + z * 3.7) * Math.sin(y * 6.1 - x * 2.9 + z * 5.3) - 0.35) * 1.5) },
    ));
    // Splotches of every colour, and scribbles round it.
    const inks = ['#ff2f62', '#ff8f12', '#ffe02a', '#22cf63', '#1f9bff', '#ff7ad9'];
    const spots = [];
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996;
      const y = 0.35 + (i / 18) * 1.35;
      const r = y < 0.8 ? 0.76 : 0.6 - (y - 1) * 0.06;
      spots.push([ball(0.13 + (i % 4) * 0.04, 12, 8), inks[i % 6], along(Math.sin(a) * (r + 0.03), y, Math.cos(a) * (r + 0.03), [Math.sin(a), 0.1, Math.cos(a)], [1.25, 0.32, 1])]);
    }
    piece(b, 'gloss', spots);
    this.rings = [0, 1, 2].map((i) => {
      const j = joint(b, 0, [0.62, 1.28, 2.62][i], 0);
      if (i === 2) j.scale.setScalar(0.62);
      const pts = Array.from({ length: 40 }, (_, k) => new THREE.Vector3(Math.sin((k / 39) * TAU * 1.9) * (0.95 - i * 0.12 + Math.sin(k * 1.7) * 0.06), Math.sin(k * 0.9 + i) * 0.14, Math.cos((k / 39) * TAU * 1.9) * (0.95 - i * 0.12 + Math.cos(k * 1.3) * 0.06)));
      piece(j, 'glow', [[new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 110, 0.022, 6), inks[(i * 2 + 1) % 6], where()]]);
      return j;
    });
    // Its face: two great round drawn eyes, and a zigzag of a mouth.
    const f = joint(b, 0, 1.95, 0.5);
    this.face = f;
    this.eyes = [-1, 1].map((s) => {
      const e = joint(f, s * 0.24, 0.1, 0.02);
      const white = piece(e, 'gloss', [[ball(0.22, 22, 16), '#ffffff', where(0, 0, 0, [1, 1.2, 0.5])]]);
      white.userData.eye = true;
      piece(e, 'plain', [[tube(0.22, 0.028, 30, 8), '#0d0a20', where(0, 0, 0.02, [1, 1.2, 1])]]);
      const p = joint(e, 0, 0, 0.11);
      const swirl = Array.from({ length: 30 }, (_, k) => new THREE.Vector3(Math.cos(k * 0.5) * k * 0.0034, Math.sin(k * 0.5) * k * 0.0034, 0));
      piece(p, 'plain', [[new THREE.TubeGeometry(new THREE.CatmullRomCurve3(swirl), 60, 0.016, 6), '#0d0a20', where()]]);
      return { e, p };
    });
    this.mouth = joint(f, 0, -0.3, 0.1);
    const zig = Array.from({ length: 9 }, (_, k) => new THREE.Vector3(-0.36 + k * 0.09, k % 2 ? 0.07 : -0.05, -Math.abs(k - 4) * 0.02));
    const grin = piece(this.mouth, 'glow', [[new THREE.TubeGeometry(new THREE.CatmullRomCurve3(zig, false, 'catmullrom', 0.1), 70, 0.034, 6), '#ffe02a', where()]]);
    grin.userData.eye = true;
    // Arms like ribbons of ink, one with the brush it is the soul of.
    const arm = (s) => {
      const a = joint(b, s * 0.52, 1.5, 0.05);
      piece(a, 'gloss', [[cap(0.13, 0.5, 12), '#3a2486', where(s * 0.2, -0.22, 0.02, 1, 0, 0, s * 0.6)], [ball(0.14, 14, 10), '#4a2f9a', where(s * 0.42, -0.46, 0.04)]]);
      const e = joint(a, s * 0.42, -0.46, 0.04);
      piece(e, 'gloss', [[cap(0.12, 0.3, 12), '#3a2486', where(0, -0.16, 0.1, 1, -0.6)], [ball(0.24, 18, 14), '#ff5cb0', where(0, -0.34, 0.26, [1, 0.9, 1])], [ball(0.1, 12, 8), '#ff5cb0', where(-s * 0.2, -0.28, 0.34)]]);
      return { a, e };
    };
    this.right = arm(1);
    this.left = arm(-1);
    this.brush = weaponOf('toon', 1.5);
    this.brush.rotation.x = Math.PI / 2;
    this.brush.position.set(0, -0.34, 0.28);
    this.right.e.add(this.brush);
    this.plume(b, [[-0.6, 0.2, 0], [0, 0.15, 0.6], [0.6, 0.2, 0], [0, 0.15, -0.6]], { n: 30, size: 0.3, drift: [0, 0.5, 0], spread: 0.16, hot: '#ff7ad9', cold: '#3ad0ff', glow: 0.6, body: 0.3 });
  }

  pose(dt, s) {
    const t = this.time;
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    // Never quite still, as a drawing redrawn over and over is not.
    const boil = Math.floor(t * 8);
    const jit = (k) => Math.sin(boil * 12.9898 + k * 78.233) * 0.5;
    const wob = Math.sin(t * 5) * 0.04;
    const under = s.kind === 'dive' && s.state !== 'rest' ? wind : 0;
    this.blob.scale.set(1 - wob + under * 0.5, Math.max(0.12, 1 + wob - under * 0.86 + (act && s.kind === 'dive' ? 0.2 : 0)), 1 - wob + under * 0.5);
    this.blob.rotation.y = jit(1) * 0.03;
    for (const [i, j] of this.rings.entries()) {
      j.rotation.y = t * (0.7 + i * 0.4) * (i % 2 ? -1 : 1);
      j.rotation.x = jit(i) * 0.12;
    }
    const r = armFor(s, { x: -0.3, z: 0.3 });
    this.right.a.rotation.x = ease(this.right.a.rotation.x, r.x, r.t, dt);
    this.right.a.rotation.z = ease(this.right.a.rotation.z, r.z * 0.8, r.t, dt);
    this.right.e.rotation.x = ease(this.right.e.rotation.x, s.state === 'wind' ? -0.8 : -0.4, 14, dt);
    this.left.a.rotation.x = ease(this.left.a.rotation.x, s.kind === 'lob' || s.kind === 'shot' || s.kind === 'call' ? r.x : -0.2 + Math.sin(t * 2.4) * 0.2, 10, dt);
    this.left.a.rotation.z = ease(this.left.a.rotation.z, -0.3 - wind * 0.5, 10, dt);
    this.face.position.x = Math.sin(t * 1.3) * 0.05;
    for (const [i, { e, p }] of this.eyes.entries()) {
      e.scale.set(1 + jit(i + 3) * 0.04, s.open ? 0.35 : 1 + wind * 0.25 + jit(i + 5) * 0.04, 1);
      p.rotation.z = s.open ? t * 10 : t * 1.5;
    }
    this.mouth.scale.set(1 + wind * 0.3, s.open ? -1 : 1 + (act ? 1.2 : 0) + jit(8) * 0.2, 1);
    this.smoke(s, 0.8);
  }
}

// ---------------------------------------------------------------- Nocturne

const featherGeo = (l, w) => {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(w, l * 0.3, w * 0.85, l * 0.75);
  sh.quadraticCurveTo(w * 0.5, l, 0, l * 1.04);
  sh.quadraticCurveTo(-w * 0.5, l, -w * 0.85, l * 0.75);
  sh.quadraticCurveTo(-w, l * 0.3, 0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -0.01);
  return g;
};
const crescentGeo = (R, depth = 0.1) => {
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(new THREE.Vector2(Math.cos(0.62 + i * 0.206) * R, Math.sin(0.62 + i * 0.206) * R));
  for (let i = 24; i >= 0; i--) pts.push(new THREE.Vector2(R * 0.42 + Math.cos(0.94 + i * 0.18) * R * 0.78, Math.sin(0.94 + i * 0.18) * R * 0.78));
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
};

class Nocturne extends Soul {
  constructor() {
    super('nod', { height: 2.5, radius: 1.15 });
    const b = joint(this.body, 0, 0.35, 0);
    this.owl = b;
    this.skin(b, 'nocturne-body', () => sculpted(
      [
        { a: [0, 0.85, 0], r: 0.74, s: [1, 1.12, 0.92] },
        { a: [0, 0.4, 0.04], r: 0.6, s: [1, 0.9, 0.9] },
        { a: [0, 1.62, 0.06], r: 0.6, s: [1.1, 0.86, 0.95] },
        { a: [0, 0.3, -0.3], b: [0, -0.1, -0.7], r: 0.3, r1: 0.14 },
      ],
      { k: 0.24, cell: 0.06, paint: fade(0, 2.1, '#2a1f66', '#6a52c8') },
    ));
    // Her breast of pale feathers, scale on scale, and stars in her.
    const down = [];
    for (let row = 0; row < 7; row++) {
      for (let i = 0; i < 5 + (row % 2); i++) {
        const a = (i - (4 + (row % 2)) / 2) * 0.28;
        const y = 1.2 - row * 0.155;
        // (As far out as she is there.)
        const round = (mid, high) => Math.sqrt(Math.max(0, 1 - ((y - mid) / high) ** 2));
        const r = Math.max(0.74 * round(0.85, 0.83), 0.6 * round(0.4, 0.54)) + 0.035;
        down.push([ball(0.11, 12, 8), row % 2 ? '#e6dcff' : '#b9a6f5', along(Math.sin(a) * r, y, Math.cos(a) * r * 0.92, [Math.sin(a), -0.25, Math.cos(a)], [1, 0.34, 1.25])]);
      }
    }
    piece(b, 'soft', down);
    piece(b, 'glow', Array.from({ length: 34 }, (_, i) => {
      const a = i * 2.39996 + Math.PI;
      const y = 0.4 + (i / 34) * 1.5;
      const r = y > 1.35 ? 0.56 : 0.68;
      return Math.cos(a) > 0.5 ? null : [ball(0.018 + (i % 3) * 0.008, 6, 5), ['#ffffff', '#ffe9a8', '#cfe0ff'][i % 3], where(Math.sin(a) * r * 1.03, y, Math.cos(a) * r * 0.97)];
    }).filter(Boolean));
    // Her face: two great discs, two great eyes, a beak; and horns of feathers.
    this.head = joint(b, 0, 1.66, 0.1);
    piece(this.head, 'soft', [-1, 1].flatMap((s) => [[lathe([[0, 0.1], [0.2, 0.085], [0.36, 0.02], [0.38, -0.03], [0, -0.03]], 30), '#d8c8ff', where(s * 0.3, 0.06, 0.44, 1, Math.PI / 2 - 0.1, 0, 0)], [cone(0.16, 0.62, 12), '#4a37a8', along(s * 0.46, 0.52, 0.0, [s * 0.6, 1, -0.1], [1, 1, 0.5])]]));
    piece(this.head, 'gloss', [[cone(0.11, 0.3, 12), '#ffcf5a', where(0, -0.12, 0.6, [1, 1, 0.8], 2.6)], ...[-1, 1].map((s) => [ball(0.21, 20, 14), '#140c34', where(s * 0.3, 0.06, 0.48, [1, 1, 0.5])])]);
    this.eyes = this.gaze(this.head, { x: 0.3, y: 0.06, z: 0.56, r: 0.15, tall: 1, slope: 0, color: '#ffe9a8' });
    this.pupils = this.eyes.map((e) => piece(joint(e, 0, 0, 0.075), 'plain', [[ball(0.07, 12, 10), '#1a1040', where(0, 0, 0, [1, 1.3, 0.4])]]));
    // A crescent moon behind her head.
    this.moon = joint(b, 0, 1.85, -0.34);
    piece(this.moon, 'glow', [[crescentGeo(0.78, 0.06), '#e6dcff', where(0, 0, 0, 1, 0, 0, -0.9)]]);
    // Her wings, three rows of feathers.
    this.wings = [-1, 1].map((s) => {
      const w = joint(b, s * 0.6, 1.25, -0.12);
      const inner = joint(w);
      const rows = [];
      for (let i = 0; i < 6; i++) rows.push([featherGeo(0.75 + i * 0.1, 0.16), i % 2 ? '#4a37a8' : '#5f49c0', along(s * (0.1 + i * 0.12), 0.02 + i * 0.03, 0, [s * (0.5 + i * 0.1), -0.85 + i * 0.1, -0.06])]);
      piece(inner, 'spirit', rows);
      const tip = joint(inner, s * 0.72, 0.2, 0);
      const prim = [];
      for (let i = 0; i < 7; i++) prim.push([featherGeo(1.15 - i * 0.05, 0.14), i % 2 ? '#3a2a90' : '#6f58d0', along(s * i * 0.03, i * 0.02, 0.01 * i, [s * (0.35 + i * 0.13), -0.8 + i * 0.2, -0.04])]);
      piece(tip, 'spirit', prim);
      piece(tip, 'glow', prim.map(([, , m], i) => [featherGeo(0.8 - i * 0.04, 0.03), '#cdbcff', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.2, 0.02))]));
      return { w, inner, tip, s };
    });
    piece(b, 'spirit', Array.from({ length: 5 }, (_, i) => [featherGeo(0.8, 0.14), i % 2 ? '#3a2a90' : '#5f49c0', along((i - 2) * 0.08, -0.02, -0.6, [(i - 2) * 0.18, -0.7, -1])]));
    // The scythe she is the soul of, in her talons.
    this.hold = joint(b, 0, -0.12, 0.2);
    piece(this.hold, 'gloss', [-1, 1].flatMap((s) => [0, 1, 2].map((i) => [cap(0.05, 0.16, 8), '#ffcf5a', where(s * 0.28 + (i - 1) * 0.08, 0, 0.06, 1, 0.5)])));
    const scythe = weaponOf('nod', 1.5);
    scythe.rotation.z = Math.PI / 2;
    scythe.position.set(0.6, -0.06, 0.06);
    this.hold.add(scythe);
    this.plume(b, [[0, 0.1, -0.5], [0, 0.6, -0.6], [0, 1.2, -0.5]], { n: 40, size: 0.36, drift: [0, -0.2, -0.8], spread: 0.24, hot: '#e6dcff', cold: '#4a33c8', glow: 0.6, body: 0.3 });
  }

  pose(dt, s) {
    const t = this.time;
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const down = s.open === 'fall' || s.open === 'spent' || s.open === 'stun' || Boolean(s.open);
    const swoop = act && (s.kind === 'lunge' || s.kind === 'charge');
    const rate = wind ? 12 : 4.6;
    const beat = down ? 0.35 : swoop ? -0.5 : Math.sin(t * rate) * (0.55 + wind * 0.25) + 0.1;
    for (const { w, inner, tip, s: side } of this.wings) {
      inner.rotation.z = ease(inner.rotation.z, side * (down ? -0.6 : 0.5 + beat * 0.8), 18, dt);
      tip.rotation.z = ease(tip.rotation.z, side * (down ? -0.3 : 0.35 + Math.sin(t * rate - 0.7) * 0.35), 16, dt);
      w.rotation.y = ease(w.rotation.y, side * (swoop ? 0.9 : 0.15), 10, dt);
    }
    this.owl.position.y = 0.35 + (down ? -0.15 : Math.sin(t * rate) * -0.08 + Math.sin(t * 1.4) * 0.08);
    this.owl.rotation.x = ease(this.owl.rotation.x, down ? 0.25 : swoop ? 0.9 : -0.22 * wind, 10, dt);
    this.head.rotation.y = down ? Math.sin(t * 5) * 0.5 : Math.sin(t * 0.8) * 0.25;
    this.head.rotation.z = down ? Math.sin(t * 6) * 0.2 : 0;
    this.head.rotation.x = ease(this.head.rotation.x, swoop ? -0.7 : 0, 10, dt);
    this.moon.rotation.z = t * 0.3;
    for (const p of this.pupils) p.scale.setScalar(down ? 0.5 : 1 + wind * 0.5);
    // Quite dark: only her eyes (and the moon behind her) to be seen.
    const hide = (s.more?.[1] ?? 0) === 1 && !s.open;
    if (hide !== this.hidden) {
      this.hidden = hide;
      const eyes = new Set(this.eyes.flatMap((e) => e.children));
      this.owl.traverse((o) => {
        if (o.isMesh && !o.userData.plume) o.visible = !hide || eyes.has(o) || o.parent === this.moon;
      });
    }
    this.look(this.eyes, s);
    this.smoke(s, hide ? 0 : 1);
  }
}

// ---------------------------------------------------------------- Folio

// A feather of paper, folded down its middle: a long point, its quill end blunt.
const quillGeo = (l, w) => {
  const sh = new THREE.Shape();
  sh.moveTo(-w * 0.3, 0);
  sh.lineTo(w * 0.3, 0);
  sh.lineTo(w, l * 0.42);
  sh.lineTo(w * 0.55, l * 0.86);
  sh.lineTo(0, l * 1.06);
  sh.lineTo(-w * 0.55, l * 0.86);
  sh.lineTo(-w, l * 0.42);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
  g.translate(0, 0, -0.008);
  // (Folded: its two halves a little up from the crease.)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.abs(p.getX(i)) * 0.35);
  g.computeVertexNormals();
  return g;
};
// Cream at the quill end, dipped in ink at the tip: along a feather's own y.
const dipped = (l, ink = '#3d5fe0') => (...p) => c1.set('#fff6e0').lerp(b1.set(ink), Math.max(0, Math.min(1, (p[1] / l - 0.55) / 0.4)) ** 1.5);

class Folio extends Soul {
  constructor() {
    super('book', { height: 2.4, radius: 1.1 });
    const b = joint(this.body, 0, 0.4, 0);
    this.bird = b;
    this.skin(b, 'folio-body', () => sculpted(
      [
        { a: [0, 0.9, 0], r: 0.56, s: [0.92, 1.15, 1] },
        { a: [0, 0.55, -0.12], r: 0.42, s: [0.9, 0.8, 1.1] },
        { a: [0, 1.32, 0.12], b: [0, 1.72, 0.3], r: 0.26, r1: 0.2 },
        { a: [0, 1.86, 0.34], r: 0.3, s: [0.95, 1, 1.05] },
        { a: [0, 0.4, -0.4], b: [0, 0.2, -0.85], r: 0.22, r1: 0.1 },
      ],
      { k: 0.22, cell: 0.06, paint: fade(0.1, 2.1, '#f0a83a', '#fff0cc') },
    ));
    // Lines of words written over it, and golden ink at its heart.
    piece(b, 'plain', Array.from({ length: 8 }, (_, i) => {
      const y = 0.58 + i * 0.1;
      const r = 0.515 * Math.sqrt(Math.max(0.2, 1 - ((y - 0.9) / 0.66) ** 2)) + 0.01;
      return [rod(0.013, 0.013, 0.16 + (i % 3) * 0.08, 6), '#2f4fd8', where((i % 2) * 0.05 - 0.025, y, r * 1.04 + 0.03, 1, 0, 0, Math.PI / 2)];
    }));
    piece(b, 'glow', [[ball(0.1, 14, 10), '#ffd84d', where(0, 0.95, 0.5, [1, 1.2, 0.5])]]);
    // Its head: a golden beak, eyes of light, and a crest of quills.
    this.head = joint(b, 0, 1.86, 0.34);
    piece(this.head, 'gloss', [[cone(0.08, 0.3, 10), '#ffc93a', where(0, -0.04, 0.38, [1, 1, 0.8], Math.PI / 2 + 0.25)]]);
    this.eyes = this.gaze(this.head, { x: 0.15, y: 0.06, z: 0.24, r: 0.07, tall: 1.2, slope: 0.3, color: '#9fb8ff' });
    piece(this.head, 'spirit', Array.from({ length: 5 }, (_, i) => [quillGeo(0.42 + (i % 2) * 0.12, 0.07), dipped(0.5, '#4f7dff'), along((i - 2) * 0.05, 0.18, -0.08, [(i - 2) * 0.28, 1, -0.9])]));
    // Its wings: pages, each feather a quill dipped in ink.
    this.wings = [-1, 1].map((side) => {
      const w = joint(b, side * 0.42, 1.25, -0.06);
      const inner = joint(w);
      const rows = [];
      for (let i = 0; i < 6; i++) rows.push([quillGeo(0.7 + i * 0.09, 0.15), dipped(0.8 + i * 0.09, i % 2 ? '#3d5fe0' : '#5a7bff'), along(side * (0.08 + i * 0.11), 0.02 + i * 0.025, 0, [side * (0.5 + i * 0.1), -0.85 + i * 0.1, -0.06])]);
      piece(inner, 'spirit', rows);
      const tip = joint(inner, side * 0.66, 0.18, 0);
      const prim = [];
      for (let i = 0; i < 7; i++) prim.push([quillGeo(1.1 - i * 0.04, 0.13), dipped(1.15 - i * 0.04, i % 2 ? '#2b46c8' : '#4f7dff'), along(side * i * 0.03, i * 0.02, 0.01 * i, [side * (0.35 + i * 0.13), -0.8 + i * 0.2, -0.04])]);
      piece(tip, 'spirit', prim);
      piece(tip, 'glow', prim.map(([, , m], i) => [quillGeo(0.72 - i * 0.03, 0.025), '#ffe9a8', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.22, 0.02))]));
      return { w, inner, tip, s: side };
    });
    // Its tail: long streamers of paper, and quills.
    this.tail = joint(b, 0, 0.3, -0.6);
    piece(this.tail, 'spirit', [
      ...Array.from({ length: 5 }, (_, i) => [quillGeo(1.1 + (i % 2) * 0.3, 0.12), dipped(1.3 + (i % 2) * 0.3, '#4f7dff'), along((i - 2) * 0.09, 0, 0, [(i - 2) * 0.35, -0.55, -1])]),
      ...[-1, 1].map((sd) => [tube(0.5, 0.025, 20, 6, Math.PI * 1.3), '#ff5d8f', where(sd * 0.18, -0.35, -0.5, 1, 0.3, sd * 0.6, sd * 0.4)]),
    ]);
    // The quill it is the soul of, in its talons.
    this.hold = joint(b, 0, 0.1, 0.26);
    piece(this.hold, 'gloss', [-1, 1].flatMap((sd) => [0, 1, 2].map((i) => [cap(0.045, 0.15, 8), '#ffc93a', where(sd * 0.22 + (i - 1) * 0.07, 0, 0.05, 1, 0.5)])));
    const quill = weaponOf('book', 1.35);
    quill.rotation.z = -Math.PI / 2;
    quill.position.set(-0.5, -0.04, 0.08);
    this.hold.add(quill);
    // And golden sparks off it, as a phoenix has fire.
    this.plume(b, [[0, 0.3, -0.6], [0, 0.9, -0.5], [0, 1.4, -0.3]], { n: 40, size: 0.34, drift: [0, 0.3, -0.7], spread: 0.26, hot: '#fff3c4', cold: '#4f7dff', glow: 0.75, body: 0.25 });
  }

  pose(dt, s) {
    const t = this.time;
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const down = Boolean(s.open);
    const swoop = act && (s.kind === 'lunge' || s.kind === 'charge');
    const rate = wind ? 11 : 4.2;
    const beat = down ? 0.3 : swoop ? -0.55 : Math.sin(t * rate) * (0.6 + wind * 0.25) + 0.1;
    for (const { w, inner, tip, s: side } of this.wings) {
      inner.rotation.z = ease(inner.rotation.z, side * (down ? -0.7 : 0.5 + beat * 0.8), 18, dt);
      tip.rotation.z = ease(tip.rotation.z, side * (down ? -0.35 : 0.35 + Math.sin(t * rate - 0.7) * 0.4), 16, dt);
      w.rotation.y = ease(w.rotation.y, side * (swoop ? 0.95 : 0.12), 10, dt);
    }
    this.bird.position.y = 0.4 + (down ? -0.18 : Math.sin(t * rate) * -0.09 + Math.sin(t * 1.3) * 0.08);
    this.bird.rotation.x = ease(this.bird.rotation.x, down ? 0.3 : swoop ? 0.95 : -0.24 * wind, 10, dt);
    this.tail.rotation.x = ease(this.tail.rotation.x, swoop ? -0.5 : Math.sin(t * 2.2) * 0.15, 8, dt);
    this.tail.rotation.y = Math.sin(t * 1.7) * 0.2;
    this.head.rotation.y = down ? Math.sin(t * 5) * 0.5 : Math.sin(t * 0.9) * 0.3;
    this.head.rotation.z = down ? Math.sin(t * 6) * 0.22 : 0;
    this.head.rotation.x = ease(this.head.rotation.x, swoop ? -0.6 : wind * -0.3, 10, dt);
    // (Pages flung, it throws its quill hand up.)
    this.hold.rotation.x = ease(this.hold.rotation.x, act && (s.kind === 'shot' || s.kind === 'lob') ? -0.9 : 0, 14, dt);
    this.look(this.eyes, s);
    this.smoke(s, down ? 0.4 : 1);
  }
}

// ---------------------------------------------------------------- their helpers

// Little ones some of them call: a spark of the same light.
class Wisp extends Fright {
  constructor(color, eye) {
    super({ height: 0.8, radius: 0.36, color });
    this.dot = joint(this.body, 0, 0.42, 0);
    piece(this.dot, 'spirit', [[lathe([[0, -0.3], [0.2, -0.22], [0.3, 0], [0.24, 0.2], [0.08, 0.42], [0, 0.5]], 22), color, where()]]);
    this.eyes = [-1, 1].map((s) => {
      const e = joint(this.dot, s * 0.11, 0.0, 0.26);
      piece(e, 'glow', [[ball(0.06, 10, 8), eye, where(0, 0, 0, [1, 1.4, 0.5], 0, 0, s * 0.3)]]);
      return e;
    });
    this.tail = new Plume([[0, 0.1, 0], [0, 0.4, -0.1]], { n: 14, size: 0.22, drift: [0, 0.5, -0.5], spread: 0.1, hot: '#ffffff', cold: color, glow: 0.7, body: 0.3 });
    this.dot.add(this.tail.mesh);
  }

  pose(dt, s) {
    const hop = Math.abs(Math.sin(this.step * 1.5)) * (s.speed > 0.3 ? 0.25 : 0.04);
    const crouch = s.state === 'wind' ? (s.k ?? 0) : 0;
    const spring = s.state === 'act' ? Math.sin(Math.min(1, s.run ?? 0) * Math.PI) * 0.4 : 0;
    this.dot.position.y = 0.42 + hop + spring;
    this.dot.scale.set(1 + crouch * 0.25, 1 - crouch * 0.3 + spring * 0.3, 1 + crouch * 0.25);
    for (const e of this.eyes) e.scale.y = s.open ? 0.25 : 1 + crouch * 0.4;
    this.tail.update(this.time, 1, 1 + (s.speed ?? 0) * 0.1);
  }

  dispose() {
    this.tail.dispose();
    super.dispose();
  }
}

const MODELS = { star: Astra, rainbow: Iris, wild: Rowan, bells: Carillon, toon: Scrawl, nod: Nocturne, book: Folio };
addFrightModels({
  ...Object.fromEntries(Object.entries(MODELS).map(([k, M]) => [`soul${k}`, M])),
  wispstar: class extends Wisp { constructor() { super('#5a7bff', '#fff3a0'); } },
  wispwild: class extends Wisp { constructor() { super('#5fb84a', '#ffd84d'); } },
  wisptoon: class extends Wisp { constructor() { super('#ff5cb0', '#ffffff'); } },
  wispnod: class extends Wisp { constructor() { super('#7a5cf0', '#ffe9a8'); } },
  wispbook: class extends Wisp { constructor() { super('#f6ecd4', '#4f7dff'); } },
});

// A soul as a model by itself, for the stage (render/soul-shows.js): it has group,
// height and update(dt, how it is).
export function soulFigure(key) {
  const M = MODELS[key] ?? Astra;
  const f = new M();
  f.shadow.visible = false;
  return f;
}
