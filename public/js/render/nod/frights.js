// The frights of the Land of Nod as they look (shared/nod/foes.js has what they
// do): each made of soft and shiny shapes, its feet at the origin, up its own y
// and facing +z, with the parts that move as it walks, winds up and strikes. All
// are told how they are each frame: { state, k (how far into winding up, 0 to 1),
// run (how far into striking), open (how it is open, or null), speed, alt, hurt
// (how hard it was just hit, fading), time }.
import * as THREE from '../../../vendor/three.module.js';
import { blobShadow } from '../toon.js';
import { along, finishOf, painted, where } from './kit.js';

const ball = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const tube = (R, r, n = 28, m = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, m, n, arc);
const rod = (a, b, h, n = 14) => new THREE.CylinderGeometry(b, a, h, n);
const cap = (r, l, n = 12) => new THREE.CapsuleGeometry(r, l, 6, n);
const cone = (r, h, n = 14) => new THREE.ConeGeometry(r, h, n);
const lathe = (pts, n = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n);

export const ease = (a, b, rate, dt) => a + (b - a) * Math.min(1, dt * rate);

// A part (or several, baked together) added to a parent: parts as kit.js painted.
export function piece(parent, finish, parts, at = null) {
  const m = new THREE.Mesh(painted(parts), finishOf(finish, 'object'));
  m.castShadow = true;
  m.receiveShadow = true;
  if (at) m.position.set(...at);
  parent.add(m);
  return m;
}

export function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// A pair of cross eyes on a face looking +z.
export function eyes(parent, { x = 0.16, y = 0, z = 0.3, r = 0.13, glow = null, brow = '#33264d', slope = 0.5, pupil = '#241a38' } = {}) {
  const list = [];
  for (const s of [-1, 1]) {
    const e = joint(parent, s * x, y, z);
    piece(e, glow ? 'glow' : 'gloss', [[ball(r, 16, 12), glow ?? '#fffdf4', where(0, 0, 0, [1, 1.12, 0.6])]]);
    const p = joint(e, 0, 0, r * 0.42);
    piece(p, 'gloss', [[ball(r * 0.5, 12, 10), pupil, where(0, 0, 0, [1, 1.1, 0.6])]]);
    piece(p, 'glow', [[ball(r * 0.15, 8, 6), '#ffffff', where(s * r * 0.16, r * 0.22, r * 0.28)]]);
    const b = brow ? piece(e, 'soft', [[cap(r * 0.24, r * 1.1, 8), brow, where(0, r * 1.15, r * 0.2, 1, 0, 0, Math.PI / 2)]]) : null;
    if (b) b.rotation.z = s * slope;
    list.push({ e, p, b, s, slope });
  }
  return {
    list,
    // Crossed and rolling when it is open; narrowed when it means it.
    mood(open, cross, t) {
      for (const q of list) {
        q.p.position.x = open ? Math.cos(t * 9 + q.s) * r * 0.3 : -q.s * r * 0.1;
        q.p.position.y = open ? Math.sin(t * 9 + q.s) * r * 0.3 : 0;
        if (q.b) q.b.rotation.z = open ? -q.s * 0.35 : q.s * (q.slope + cross * 0.35);
        q.e.scale.y = open ? 1.1 : 1 - cross * 0.2;
      }
    },
  };
}

// What they all are and do.
export class Fright {
  constructor({ height, radius, color }) {
    this.group = new THREE.Group();
    this.body = joint(this.group);
    this.height = height;
    this.radius = radius;
    this.color = color;
    this.shadow = blobShadow(Math.max(0.5, radius * 1.15), 0.3);
    this.time = Math.random() * 10;
    this.squash = 0;
    this.lean = 0;
    this.spin = 0;
    this.step = 0;
  }

  // What every one does: squashed by a blow, wobbling while it is open, tipped
  // right over when it is flipped, shaking as it winds up.
  update(dt, s) {
    this.time += dt;
    this.step += dt * Math.min(10, (s.speed ?? 0) * 2.6);
    this.squash = Math.max(0, this.squash - dt * 3.2);
    const b = this.body;
    const open = s.open;
    const wob = open && open !== 'flip' && open !== 'fall' ? Math.sin(this.time * 6) * 0.16 : 0;
    b.rotation.z = ease(b.rotation.z, (open === 'flip' ? Math.PI : 0) + wob, 12, dt);
    const tip = open === 'trip' ? 0.5 : open === 'fall' ? 0.2 : 0;
    b.rotation.x = ease(b.rotation.x, tip + this.lean, 14, dt);
    b.position.y = ease(b.position.y, open === 'flip' ? this.height * 0.82 : 0, 12, dt);
    const shiver = s.state === 'wind' ? (s.k ?? 0) : 0;
    b.position.x = shiver ? Math.sin(this.time * 46) * 0.03 * shiver : 0;
    const q = 1 + this.squash * 0.35;
    const come = s.come ?? 1;
    b.scale.set(q * come, (1 - this.squash * 0.4) * come, q * come);
    this.pose(dt, s);
  }

  pose() {}

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.group.traverse((o) => o.geometry?.dispose());
  }
}

// ---------------------------------------------------------------- Pillow Moons

class Bunny extends Fright {
  constructor() {
    super({ height: 0.8, radius: 0.36, color: '#b9aecb' });
    const fluff = [];
    const C = ['#b9aecb', '#a89bc0', '#c6bcd6'];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const h = 0.14 + (i / 12) * 0.36;
      fluff.push([ball(0.17, 10, 8), C[i % 3], where(Math.cos(a) * 0.17, h, Math.sin(a) * 0.17)]);
    }
    fluff.push([ball(0.3, 14, 10), C[0], where(0, 0.32, 0)]);
    this.puff = joint(this.body);
    piece(this.puff, 'soft', fluff);
    this.eyes = eyes(this.puff, { x: 0.11, y: 0.38, z: 0.28, r: 0.085, slope: 0.55 });
    piece(this.puff, 'plain', [[ball(0.035, 8, 6), '#ff8fa8', where(0, 0.3, 0.33)]]);
    this.ears = [-1, 1].map((s) => {
      const e = joint(this.puff, s * 0.11, 0.55, 0);
      piece(e, 'soft', [
        [cap(0.07, 0.26, 10), C[2], where(0, 0.18, 0)],
        [cap(0.04, 0.2, 8), '#f4b6c6', where(0, 0.18, 0.04)],
      ]);
      e.rotation.z = -s * 0.25;
      return { e, s };
    });
    piece(this.puff, 'soft', [[ball(0.1, 10, 8), '#efe8f6', where(0, 0.22, -0.32)]]);
  }

  pose(dt, s) {
    const hop = Math.abs(Math.sin(this.step * 1.4)) * (s.speed > 0.3 ? 0.28 : 0.03);
    const crouch = s.state === 'wind' ? (s.k ?? 0) : 0;
    const spring = s.state === 'act' ? Math.sin(Math.min(1, s.run ?? 0) * Math.PI) * 0.5 : 0;
    this.puff.position.y = hop + spring;
    this.puff.scale.set(1 + crouch * 0.2, 1 - crouch * 0.35, 1 + crouch * 0.2);
    for (const { e, s: side } of this.ears) {
      e.rotation.x = ease(e.rotation.x, s.state === 'wind' ? -1.1 : s.open || s.state === 'hurt' ? 1.2 : Math.sin(this.time * 3 + side) * 0.15 - hop, 12, dt);
    }
    this.eyes.mood(Boolean(s.open) || s.state === 'hurt', crouch, this.time);
  }
}

// A ram: a great ball of wool on four legs, with a dark face and curled horns.
export function ramParts(body, { wool = ['#fff4e6', '#f6e6d8', '#fffaf2'], face = '#5a4668', horn = '#c79a5e', tip = '#8a6238', n = 44 } = {}) {
  const coat = joint(body, 0, 0.82, -0.05);
  const puffs = [[ball(0.6, 18, 14), wool[0], where(0, 0, -0.1, [1, 0.9, 1.15])]];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    puffs.push([ball(0.2 + (i % 3) * 0.02, 10, 8), wool[i % 3], where(Math.cos(a) * r * 0.58, y * 0.5, Math.sin(a) * r * 0.66 - 0.1)]);
  }
  piece(coat, 'soft', puffs);
  const head = joint(body, 0, 0.95, 0.62);
  piece(head, 'soft', [
    [ball(0.3, 18, 14), face, where(0, 0, 0.08, [0.9, 1.05, 1.15])],
    [ball(0.2, 14, 10), face, where(0, -0.12, 0.34, [1, 0.8, 0.9])],
    [ball(0.22, 12, 10), wool[0], where(0, 0.26, -0.02, [1.2, 0.8, 1])],
    ...[-1, 1].map((s) => [ball(0.12, 10, 8), face, where(s * 0.36, 0.06, -0.02, [1.5, 0.55, 0.8], 0, 0, -s * 0.4)]),
  ]);
  piece(head, 'plain', [-1, 1].map((s) => [ball(0.035, 8, 6), '#2a1c36', where(s * 0.08, -0.1, 0.5)]));
  for (const s of [-1, 1]) {
    const curl = [];
    const at = joint(head, s * 0.24, 0.22, -0.02);
    for (let i = 0; i < 15; i++) {
      const a = -0.4 + i * 0.42;
      const R = 0.3 - i * 0.012;
      curl.push([ball(0.13 - i * 0.0062, 10, 8), i > 10 ? tip : horn, where(s * (0.05 + i * 0.022), Math.sin(a + 1.9) * R - 0.12, -Math.cos(a + 1.9) * R - 0.06)]);
    }
    piece(at, 'plain', curl);
  }
  const look = eyes(head, { x: 0.14, y: 0.08, z: 0.33, r: 0.095 });
  const legs = [[-0.3, 0.32], [0.3, 0.32], [-0.3, -0.45], [0.3, -0.45]].map(([x, z], i) => {
    const l = joint(body, x, 0.5, z);
    piece(l, 'soft', [
      [cap(0.1, 0.32, 10), face, where(0, -0.22, 0)],
      [rod(0.13, 0.11, 0.13, 12), '#33264d', where(0, -0.44, 0.01)],
    ]);
    return { l, i };
  });
  return { coat, head, look, legs };
}

class Ram extends Fright {
  constructor() {
    super({ height: 1.5, radius: 0.75, color: '#fff4e6' });
    this.parts = ramParts(this.body);
  }

  pose(dt, s) {
    const { coat, head, look, legs } = this.parts;
    const charge = s.state === 'act';
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const pace = charge ? 3.2 : 1;
    for (const { l, i } of legs) {
      const a = this.step * pace + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.5 : 0);
      const paw = wind && i < 1 ? Math.sin(this.time * 16) * 0.7 : 0;
      l.rotation.x = s.open ? Math.sin(this.time * 5 + i) * 0.4 : Math.sin(a) * Math.min(0.9, 0.15 + (s.speed ?? 0) * 0.14) + paw;
    }
    head.rotation.x = ease(head.rotation.x, charge || wind ? 0.75 : s.open ? -0.25 : Math.sin(this.time * 1.7) * 0.06, 10, dt);
    head.position.z = ease(head.position.z, wind ? 0.5 : charge ? 0.8 : 0.62, 10, dt);
    coat.scale.setScalar(1 + Math.sin(this.time * 2.4) * 0.015);
    coat.position.y = 0.82 + (charge ? Math.abs(Math.sin(this.step * 3.2)) * 0.1 : 0);
    look.mood(Boolean(s.open), charge || wind ? 1 : 0, this.time);
  }
}

class Thimble extends Fright {
  constructor() {
    super({ height: 1.25, radius: 0.6, color: '#d6dbea' });
    const b = this.body;
    const dots = [];
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + r * 0.22;
        const h = 0.66 + r * 0.14;
        const R = 0.53 - r * 0.024;
        dots.push([ball(0.034, 6, 5), '#aab2cc', where(Math.sin(a) * R, h, Math.cos(a) * R)]);
      }
    }
    for (let i = 0; i < 14; i++) dots.push([ball(0.034, 6, 5), '#aab2cc', where(Math.cos(i * 2.4) * 0.1 * Math.sqrt(i), 1.2 - i * 0.004, Math.sin(i * 2.4) * 0.1 * Math.sqrt(i))]);
    this.shell = joint(b);
    piece(this.shell, 'metal', [
      [lathe([[0, 0.3], [0.6, 0.3], [0.64, 0.36], [0.62, 0.44], [0.57, 0.48], [0.53, 0.8], [0.48, 1.08], [0.4, 1.18], [0.2, 1.22], [0, 1.22]], 32), '#dfe4f2'],
      [tube(0.6, 0.045, 32, 8), '#f4cf6a', where(0, 0.4, 0, 1, Math.PI / 2)],
      ...dots,
    ]);
    // Who is inside: a round soft thing in socks.
    piece(b, 'soft', [[ball(0.46, 18, 14), '#8a5f9f', where(0, 0.36, 0, [1, 0.75, 1])]]);
    this.slot = joint(this.shell, 0, 0.62, 0.48);
    piece(this.slot, 'plain', [[ball(0.28, 16, 10), '#2a1c36', where(0, 0, 0, [1.1, 0.42, 0.35])]]);
    this.eyes = eyes(this.slot, { x: 0.12, y: 0, z: 0.08, r: 0.075, glow: '#ffe27a', brow: null });
    this.feet = [-1, 1].map((s) => {
      const f = joint(b, s * 0.24, 0.16, 0.06);
      piece(f, 'soft', [[ball(0.17, 12, 10), s > 0 ? '#f58fa8' : '#8fc7ee', where(0, 0, 0.06, [0.9, 0.8, 1.35])]]);
      return { f, s };
    });
    this.arm = joint(b, 0.56, 0.55, 0.1);
    piece(this.arm, 'soft', [[ball(0.13, 12, 10), '#8a5f9f', where(0, 0, 0)]]);
    this.needle = joint(this.arm, 0, 0, 0);
    piece(this.needle, 'metal', [
      [rod(0.035, 0.03, 1.3, 10), '#eef2fb', where(0, 0, 0.55, 1, Math.PI / 2)],
      [cone(0.03, 0.22, 10), '#eef2fb', where(0, 0, 1.3, 1, Math.PI / 2)],
      [tube(0.06, 0.02, 14, 6), '#eef2fb', where(0, 0, -0.16, 1, 0, Math.PI / 2)],
    ]);
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    for (const { f, s: side } of this.feet) {
      f.position.y = 0.16 + Math.max(0, Math.sin(this.step * 1.6 + (side > 0 ? 0 : Math.PI))) * 0.16;
      f.rotation.x = s.open === 'flip' ? Math.sin(this.time * 14 + side) * 0.6 : 0;
    }
    this.shell.rotation.z = Math.sin(this.step * 1.6) * 0.07;
    const spin = s.kind === 'burst' && (wind || act);
    this.shell.rotation.y = spin ? this.time * (wind ? 6 + wind * 12 : 26) : ease(this.shell.rotation.y % (Math.PI * 2), 0, 8, dt);
    this.arm.position.z = ease(this.arm.position.z, act ? 0.5 : wind ? -0.25 : 0.1, 18, dt);
    this.arm.position.x = spin ? Math.sin(this.time * 24) * 0.7 : 0.56;
    this.needle.rotation.x = ease(this.needle.rotation.x, wind ? -0.15 : act ? 0 : -0.7, 14, dt);
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

class Moth extends Fright {
  constructor() {
    super({ height: 0.95, radius: 0.5, color: '#8d7ac9' });
    const b = this.body;
    this.fur = joint(b, 0, 0.45, 0);
    const fl = [];
    for (let i = 0; i < 16; i++) fl.push([ball(0.13, 10, 8), ['#8d7ac9', '#a293db', '#7a67b8'][i % 3], where(Math.cos(i * 2.4) * 0.16, (i / 16 - 0.5) * 0.5, Math.sin(i * 2.4) * 0.16)]);
    fl.push([ball(0.2, 14, 10), '#b7a9e6', where(0, 0.24, 0.1)]);
    piece(this.fur, 'soft', fl);
    this.eyes = eyes(this.fur, { x: 0.12, y: 0.28, z: 0.24, r: 0.1, glow: '#ffd27a', brow: '#4a3a78', slope: 0.45 });
    for (const s of [-1, 1]) {
      const an = [];
      for (let i = 0; i < 6; i++) an.push([ball(0.03 - i * 0.002, 8, 6), '#5a4a8a', where(s * (0.06 + i * 0.05), 0.42 + i * 0.06, 0.16 + i * 0.03)]);
      an.push([ball(0.05, 8, 6), '#ffd27a', where(s * 0.36, 0.78, 0.34)]);
      piece(this.fur, 'soft', an);
    }
    this.wings = [-1, 1].map((s) => {
      const w = joint(this.fur, s * 0.12, 0.08, -0.04);
      piece(w, 'soft', [
        [ball(1, 20, 12), '#6a58b0', where(s * 0.62, 0.22, 0, [0.62, 0.44, 0.03], 0, 0, s * 0.35)],
        [ball(1, 16, 10), '#7f6cc6', where(s * 0.45, -0.26, 0, [0.42, 0.3, 0.03], 0, 0, -s * 0.4)],
        [ball(1, 14, 10), '#f2a9cf', where(s * 0.74, 0.3, 0.025, [0.22, 0.2, 0.025])],
        [ball(1, 12, 8), '#33264d', where(s * 0.74, 0.3, 0.05, [0.1, 0.1, 0.02])],
        [ball(1, 12, 8), '#ffd27a', where(s * 0.5, -0.28, 0.03, [0.13, 0.11, 0.02])],
      ]);
      return { w, s };
    });
  }

  pose(dt, s) {
    const down = s.open === 'fall';
    const beat = down ? Math.sin(this.time * 4) * 0.2 + 1.1 : Math.sin(this.time * (s.state === 'wind' ? 30 : 15)) * 0.75;
    for (const { w, s: side } of this.wings) w.rotation.y = -side * beat;
    this.fur.position.y = 0.45 + (down ? -0.2 : Math.sin(this.time * 3) * 0.1);
    this.fur.rotation.x = ease(this.fur.rotation.x, down ? 1.2 : s.state === 'act' ? 0.7 : 0.15, 10, dt);
    this.eyes.mood(Boolean(s.open), s.state === 'wind' ? 1 : 0, this.time);
  }
}

class Alarm extends Fright {
  constructor() {
    super({ height: 1.75, radius: 0.8, color: '#f2637a' });
    this.clock = joint(this.body, 0, 0.95, 0);
    piece(this.clock, 'gloss', [
      [rod(0.72, 0.72, 0.5, 40), '#f2637a', where(0, 0, 0, 1, Math.PI / 2)],
      [tube(0.72, 0.1, 40, 12), '#d94f68', where(0, 0, 0.24)],
      [tube(0.72, 0.1, 40, 12), '#d94f68', where(0, 0, -0.24)],
    ]);
    const ticks = [];
    for (let i = 0; i < 12; i++) ticks.push([ball(i % 3 ? 0.035 : 0.06, 8, 6), '#5a3a5a', where(Math.sin((i / 12) * Math.PI * 2) * 0.54, Math.cos((i / 12) * Math.PI * 2) * 0.54, 0.29)]);
    piece(this.clock, 'plain', [[rod(0.66, 0.66, 0.04, 36), '#fff6e6', where(0, 0, 0.26, 1, Math.PI / 2)], ...ticks]);
    this.hands = [0.42, 0.3].map((l, i) => {
      const h = joint(this.clock, 0, 0, 0.31);
      piece(h, 'gloss', [[cap(0.035 - i * 0.004, l, 8), '#33264d', where(0, l / 2, 0)]]);
      return h;
    });
    this.eyes = eyes(this.clock, { x: 0.2, y: 0.14, z: 0.33, r: 0.12, slope: 0.5 });
    piece(this.clock, 'plain', [[tube(0.16, 0.035, 18, 8, Math.PI), '#33264d', where(0, -0.32, 0.31)]]);
    this.bells = [-1, 1].map((s) => {
      const b = joint(this.clock, s * 0.42, 0.72, 0);
      piece(b, 'metal', [[new THREE.SphereGeometry(0.28, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#f7cf66', where(0, 0, 0, 1, 0, 0, -s * 0.5)]]);
      return { b, s };
    });
    this.hammer = joint(this.clock, 0, 0.74, 0);
    piece(this.hammer, 'metal', [[rod(0.03, 0.03, 0.26, 8), '#c9cfdf', where(0, 0.12, 0)], [ball(0.09, 12, 10), '#e9ecf6', where(0, 0.28, 0)]]);
    // The key in its back.
    this.key = joint(this.clock, 0, 0, -0.36);
    piece(this.key, 'metal', [[rod(0.04, 0.04, 0.24, 8), '#f7cf66', where(0, 0, -0.06, 1, Math.PI / 2)], [tube(0.13, 0.04, 16, 8), '#f7cf66', where(-0.13, 0, -0.22)], [tube(0.13, 0.04, 16, 8), '#f7cf66', where(0.13, 0, -0.22)]]);
    this.legs = [-1, 1].map((s) => {
      const l = joint(this.body, s * 0.34, 0.36, 0);
      piece(l, 'gloss', [[cap(0.1, 0.16, 10), '#d94f68', where(0, -0.06, 0)], [ball(0.17, 12, 10), '#33264d', where(0, -0.24, 0.07, [0.9, 0.7, 1.3])]]);
      return { l, s };
    });
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const ring = s.state === 'act' ? 1 : wind > 0.3 ? wind * 0.6 : 0;
    this.clock.position.y = 0.95 + Math.abs(Math.sin(this.step * 1.5)) * 0.1 - (s.open ? 0.12 : 0);
    this.clock.rotation.z = Math.sin(this.time * 52) * 0.09 * ring + Math.sin(this.step * 1.5) * 0.06;
    this.hammer.rotation.z = Math.sin(this.time * 60) * 0.8 * ring;
    for (const { b, s: side } of this.bells) b.rotation.z = Math.sin(this.time * 55 + side) * 0.15 * ring;
    this.hands[0].rotation.z = -this.time * (ring ? 14 : 1.2);
    this.hands[1].rotation.z = -this.time * (ring ? 3 : 0.1);
    this.key.rotation.z = s.open ? this.key.rotation.z : this.time * 2;
    for (const { l, s: side } of this.legs) l.rotation.x = Math.sin(this.step * 1.5 + (side > 0 ? 0 : Math.PI)) * Math.min(0.7, (s.speed ?? 0) * 0.5);
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

// Rambunctious: a ram as big as a cottage, in a nightcap.
class Rambunctious extends Fright {
  constructor() {
    super({ height: 3.4, radius: 1.7, color: '#efe6ff' });
    this.big = joint(this.body);
    this.big.scale.setScalar(2.25);
    this.parts = ramParts(this.big, { wool: ['#efe6ff', '#dccff6', '#fbf7ff'], face: '#4a3566', horn: '#e0b060', tip: '#a8703a', n: 60 });
    // His nightcap, its bobble swinging.
    this.cap = joint(this.parts.head, 0.02, 0.34, -0.02);
    const C = ['#f2637a', '#fff1e0'];
    for (let i = 0; i < 6; i++) piece(this.cap, 'soft', [[lathe([[0.3 - i * 0.045, 0], [0.31 - i * 0.045, 0.03], [0.27 - i * 0.045, 0.13], [0.24 - i * 0.045, 0.14]], 20), C[i % 2], where(0, i * 0.11, -i * i * 0.012)]]);
    piece(this.cap, 'soft', [[tube(0.31, 0.06, 24, 10), '#fff1e0', where(0, 0.02, 0, 1, Math.PI / 2)]]);
    this.bobble = joint(this.cap, 0, 0.66, -0.36);
    piece(this.bobble, 'soft', [[ball(0.12, 14, 10), '#fff1e0', where(0, 0, 0)]]);
  }

  pose(dt, s) {
    const { coat, head, look, legs } = this.parts;
    const act = s.state === 'act';
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const rolling = s.look === 'roll' && (act || wind > 0.4);
    const stomp = s.kind === 'wave';
    for (const { l, i } of legs) {
      const a = this.step * (act ? 2.4 : 0.8) + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.5 : 0);
      const paw = wind && !stomp && i < 1 ? Math.sin(this.time * 14) * 0.6 : 0;
      l.rotation.x = s.open ? Math.sin(this.time * 4 + i) * 0.35 : Math.sin(a) * Math.min(0.8, 0.12 + (s.speed ?? 0) * 0.1) + paw;
      l.scale.setScalar(ease(l.scale.x, rolling ? 0.2 : 1, 10, dt));
    }
    head.rotation.x = ease(head.rotation.x, rolling ? 1.4 : act || wind ? 0.6 : s.open ? -0.3 : Math.sin(this.time * 1.4) * 0.06, 8, dt);
    head.position.z = ease(head.position.z, rolling ? 0.2 : wind ? 0.5 : act ? 0.76 : 0.62, 8, dt);
    this.big.rotation.x = rolling && act ? this.big.rotation.x + dt * 9 : ease(this.big.rotation.x % (Math.PI * 2), stomp && wind ? -0.5 * wind : 0, 10, dt);
    this.big.position.y = rolling ? 0.1 : stomp ? (wind ? wind * 0.8 : 0) : 0;
    coat.scale.setScalar(1 + Math.sin(this.time * 2) * 0.02 - (1 - s.hearts / Math.max(1, s.max)) * 0.28);
    this.bobble.position.x = Math.sin(this.time * 3.1) * 0.1;
    look.mood(Boolean(s.open), act || wind ? 1 : 0, this.time);
  }
}

const MAKE = { bunny: Bunny, ram: Ram, thimble: Thimble, moth: Moth, alarm: Alarm, rambunctious: Rambunctious };

export function addFrightModels(models) {
  Object.assign(MAKE, models);
}

export function makeFright(kind) {
  const m = new (MAKE[kind] ?? Bunny)(kind);
  m.kind = kind;
  return m;
}

export { along, ball, cap, cone, lathe, rod, tube };
