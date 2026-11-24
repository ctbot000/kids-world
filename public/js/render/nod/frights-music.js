// The frights of the Music Box and of Tick-Tock Skies as they look (frights.js has
// how each is told it is), and their bosses: Maestro Crescendo on his podium,
// and Old Tock on his dial.
import * as THREE from '../../../vendor/three.module.js';
import { addFrightModels, ball, cap, cone, ease, eyes, Fright, joint, lathe, piece, rod, tube } from './frights.js';
import { along, where } from './kit.js';

// ---------------------------------------------------------------- the Music Box

class Quaver extends Fright {
  constructor() {
    super({ height: 0.95, radius: 0.42, color: '#ffd75e' });
    this.n = joint(this.body, 0, 0.4, 0);
    piece(this.n, 'gloss', [
      [ball(0.34, 20, 16), '#ffb52e', where(0, 0, 0, [1.2, 0.92, 0.95], 0, 0, 0.3)],
      [rod(0.06, 0.05, 1.0, 10), '#e08a1e', where(0.32, 0.5, 0)],
      [ball(1, 14, 8), '#e08a1e', where(0.5, 0.92, 0, [0.28, 0.1, 0.06], 0, 0, -0.7)],
    ]);
    this.eyes = eyes(this.n, { x: 0.13, y: 0.04, z: 0.29, r: 0.1, slope: 0.5 });
    this.wings = [-1, 1].map((s) => {
      const w = joint(this.n, s * 0.3, 0.1, -0.12);
      piece(w, 'soft', [[ball(1, 14, 8), '#fff6e0', where(s * 0.3, 0.1, 0, [0.34, 0.2, 0.04], 0, 0, s * 0.5)], [ball(1, 12, 8), '#ffe6b0', where(s * 0.24, -0.06, 0, [0.24, 0.13, 0.04], 0, 0, s * 0.2)]]);
      return { w, s };
    });
  }

  pose(dt, s) {
    const down = s.open === 'fall';
    const beat = Math.sin(this.time * 18) * (down ? 0.1 : 0.8);
    for (const { w, s: side } of this.wings) w.rotation.y = side * beat;
    this.n.position.y = 0.4 + Math.sin(this.time * 4) * 0.08;
    this.n.rotation.x = ease(this.n.rotation.x, s.state === 'act' ? 0.7 : down ? 1.1 : 0.1, 10, dt);
    this.n.rotation.z = Math.sin(this.time * 4) * 0.15;
    this.eyes.mood(Boolean(s.open), s.state === 'wind' ? 1 : 0, this.time);
  }
}

class Drummer extends Fright {
  constructor() {
    super({ height: 1.65, radius: 0.9, color: '#c9304a' });
    this.drum = joint(this.body, 0, 0.95, 0);
    const cords = [];
    for (let i = 0; i < 16; i++) cords.push([cap(0.03, 0.62, 6), '#f0c04a', along(Math.sin(i * 0.3927) * 0.87, 0, Math.cos(i * 0.3927) * 0.87, [Math.cos(i * 0.3927) * (i % 2 ? 0.28 : -0.28), 1, -Math.sin(i * 0.3927) * (i % 2 ? 0.28 : -0.28)])]);
    piece(this.drum, 'gloss', [[rod(0.85, 0.85, 0.86, 36), '#c9304a', where()], [tube(0.87, 0.08, 40, 10), '#f0c04a', where(0, 0.43, 0, 1, Math.PI / 2)], [tube(0.87, 0.08, 40, 10), '#f0c04a', where(0, -0.43, 0, 1, Math.PI / 2)], ...cords]);
    this.skin = joint(this.drum, 0, 0.46, 0);
    piece(this.skin, 'soft', [[rod(0.8, 0.8, 0.05, 36), '#f6e7cf', where()], [tube(0.34, 0.03, 24, 6), '#c9304a', where(0, 0.03, 0, 1, Math.PI / 2)]]);
    this.eyes = eyes(this.drum, { x: 0.26, y: 0.1, z: 0.84, r: 0.15, slope: 0.5 });
    piece(this.drum, 'plain', [[tube(0.18, 0.035, 18, 8, Math.PI), '#3a1420', where(0, -0.2, 0.88)]]);
    this.arms = [-1, 1].map((s) => {
      const a = joint(this.drum, s * 0.8, 0.3, 0.2);
      piece(a, 'plain', [[ball(0.14, 12, 10), '#8a5cc9', where()], [cap(0.05, 0.62, 8), '#e0b98a', where(-s * 0.2, 0.36, -0.06, 1, -0.1, 0, s * 0.6)], [ball(0.11, 12, 10), '#fff3e0', where(-s * 0.42, 0.66, -0.1)]]);
      return { a, s };
    });
    this.legs = [-1, 1].map((s) => {
      const l = joint(this.body, s * 0.36, 0.36, 0);
      piece(l, 'plain', [[cap(0.11, 0.16, 10), '#8a5cc9', where(0, -0.06, 0)], [ball(0.18, 12, 10), '#3a2454', where(0, -0.24, 0.07, [0.9, 0.7, 1.3])]]);
      return { l, s };
    });
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const beating = s.kind === 'wave' && (s.state === 'act' || wind > 0.2);
    for (const { a, s: side } of this.arms) a.rotation.x = s.open ? 0.9 : beating ? Math.sin(this.time * 14 + (side > 0 ? 0 : Math.PI)) * 0.8 - 0.2 : Math.sin(this.time * 3 + side) * 0.15;
    const boom = beating ? Math.abs(Math.sin(this.time * 14)) : 0;
    this.drum.scale.set(1 + boom * 0.05, 1 - boom * 0.08, 1 + boom * 0.05);
    this.drum.position.y = 0.95 + Math.abs(Math.sin(this.step * 1.5)) * 0.1 - (s.open ? 0.15 : 0);
    this.drum.rotation.z = Math.sin(this.step * 1.5) * 0.08 + (s.open ? 0.2 : 0);
    for (const { l, s: side } of this.legs) l.rotation.x = Math.sin(this.step * 1.5 + (side > 0 ? 0 : Math.PI)) * Math.min(0.7, (s.speed ?? 0) * 0.5);
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

class Metronome extends Fright {
  constructor() {
    super({ height: 2.2, radius: 0.75, color: '#b9793a' });
    const b = this.body;
    const four = (h0, h1, w0, w1, c) => [new THREE.CylinderGeometry(w1, w0, h1 - h0, 4, 1), c, where(0, (h0 + h1) / 2, 0, 1, 0, Math.PI / 4)];
    piece(b, 'gloss', [four(0.16, 2.0, 0.92, 0.46, '#a8652f'), four(0, 0.2, 1.06, 1.02, '#6e3f1c'), four(2.0, 2.16, 0.52, 0.4, '#6e3f1c')]);
    piece(b, 'plain', [[new THREE.CylinderGeometry(0.3, 0.58, 1.6, 4, 1), '#ffe9c4', where(0, 1.06, 0.14, [1, 1, 0.8], 0, Math.PI / 4)]]);
    this.eyes = eyes(b, { x: 0.2, y: 0.62, z: 0.6, r: 0.14, slope: 0.5 });
    this.arm = joint(b, 0, 0.3, 0.66);
    piece(this.arm, 'metal', [[rod(0.035, 0.03, 1.9, 8), '#eef2fb', where(0, 0.95, 0)], [rod(0.16, 0.2, 0.3, 6), '#f2cc62', where(0, 1.3, 0)]]);
    this.tip = piece(this.arm, 'glow', [[ball(0.14, 14, 10), '#ff7a9f', where()]], [0, 1.92, 0]);
    this.key = joint(b, 0.8, 0.5, 0);
    piece(this.key, 'metal', [[rod(0.04, 0.04, 0.3, 8), '#f2cc62', where(0, 0, 0, 1, 0, 0, Math.PI / 2)], [tube(0.12, 0.04, 16, 8), '#f2cc62', where(0.2, 0.12, 0, 1, 0, Math.PI / 2)], [tube(0.12, 0.04, 16, 8), '#f2cc62', where(0.2, -0.12, 0, 1, 0, Math.PI / 2)]]);
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const rate = act ? 16 : wind ? 6 + wind * 8 : s.open ? 1 : 4;
    this.swing = (this.swing ?? 0) + dt * rate;
    this.arm.rotation.z = Math.sin(this.swing) * (s.open ? 0.15 : 0.6);
    this.key.rotation.x += dt * (s.open ? 0 : rate * 0.5);
    this.tip.scale.setScalar(1 + wind * 0.8 + (act ? 0.6 : 0));
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

class Clam extends Fright {
  constructor() {
    super({ height: 1, radius: 0.8, color: '#3f8fb0' });
    const a = joint(this.body, 0, 0.34, 0);
    const half = () => lathe([[0, 0.5], [0.4, 0.46], [0.72, 0.3], [0.84, 0.06], [0.8, 0], [0, 0]], 32);
    const ribs = [];
    for (let i = 0; i < 9; i++) ribs.push([cap(0.035, 0.7, 6), '#ffe9c4', along(Math.sin(-1.2 + i * 0.3) * 0.42, 0.36, Math.cos(-1.2 + i * 0.3) * 0.42, [Math.sin(-1.2 + i * 0.3), -0.5, Math.cos(-1.2 + i * 0.3)])]);
    this.low = joint(a);
    piece(this.low, 'gloss', [[half(), '#2f6f94', where(0, 0, 0, [1, 0.6, 1], Math.PI)]]);
    piece(this.low, 'soft', [[ball(1, 18, 10), '#ff9fb0', where(0, 0.02, 0.1, [0.6, 0.14, 0.6])]]);
    this.top = joint(a, 0, 0.02, -0.7);
    piece(this.top, 'gloss', [[half(), '#3f8fb0', where(0, 0, 0.7)], ...ribs.map(([g, c, m]) => [g, c, m.clone().premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0.7))])]);
    this.eyes = eyes(this.top, { x: 0.28, y: 0.42, z: 1.2, r: 0.14, slope: 0.5 });
    this.pearl = piece(this.low, 'glow', [[ball(0.17, 16, 12), '#fff3d6', where(0, 0.18, 0.1)]]);
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const gape = s.open ? 0.85 : s.state === 'act' ? 0.95 : wind ? Math.abs(Math.sin(this.time * 18)) * 0.25 * wind : Math.abs(Math.sin(this.time * 3)) * 0.05;
    this.top.rotation.x = ease(this.top.rotation.x, -gape, 20, dt);
    this.body.position.y += Math.abs(Math.sin(this.step * 1.8)) * 0.14 * Math.min(1, s.speed ?? 0);
    this.pearl.visible = gape > 0.2;
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

// Maestro Crescendo: tails, white gloves, a shock of hair, and a baton.
class Maestro extends Fright {
  constructor() {
    super({ height: 3.4, radius: 1.1, color: '#f7e3c9' });
    const b = joint(this.body);
    this.man = b;
    b.scale.setScalar(1.35);
    piece(b, 'soft', [
      [lathe([[0.5, 0.5], [0.62, 0.7], [0.66, 1.1], [0.56, 1.5], [0.3, 1.72], [0, 1.75]], 30), '#1f1830'],
      ...[-1, 1].map((s) => [ball(1, 14, 10), '#1f1830', where(s * 0.22, 0.45, -0.34, [0.2, 0.55, 0.1], -0.35, 0, s * 0.12)]),
    ]);
    piece(b, 'plain', [
      [ball(1, 16, 12), '#fff8ec', where(0, 1.12, 0.36, [0.3, 0.5, 0.3])],
      [ball(0.07, 8, 6), '#1f1830', where(0, 1.02, 0.66)],
      [ball(0.07, 8, 6), '#1f1830', where(0, 0.82, 0.64)],
      ...[-1, 1].map((s) => [cone(0.12, 0.24, 8), '#f7f1ff', where(s * 0.14, 1.46, 0.5, [1, 1, 0.5], 0, 0, s * 1.57)]),
    ]);
    this.legs = [-1, 1].map((s) => {
      const l = joint(b, s * 0.24, 0.55, 0);
      piece(l, 'plain', [[cap(0.14, 0.3, 10), '#15101f', where(0, -0.24, 0)], [ball(0.2, 12, 10), '#0d0a14', where(0, -0.46, 0.1, [0.85, 0.55, 1.4])]]);
      return { l, s };
    });
    this.head = joint(b, 0, 2.02, 0.04);
    const hair = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 15) * Math.PI - Math.PI / 2;
      hair.push([cone(0.13, 0.5 + (i % 3) * 0.16, 8), i % 2 ? '#f4f1ff' : '#dcd6f2', along(Math.sin(a) * 0.36, 0.14 + Math.cos(a) * 0.22, -0.12, [Math.sin(a) * 1.2, 0.5 + Math.cos(a) * 0.6, -0.5 - (i % 2) * 0.4])]);
    }
    piece(this.head, 'soft', hair);
    piece(this.head, 'plain', [
      [ball(0.42, 22, 16), '#f2cfae', where(0, 0, 0, [0.92, 1.05, 0.95])],
      [ball(0.13, 12, 10), '#eab38a', where(0, -0.04, 0.42, [0.8, 0.9, 1.4])],
      ...[-1, 1].map((s) => [ball(1, 12, 8), '#f4f1ff', where(s * 0.16, -0.18, 0.4, [0.2, 0.07, 0.08], 0, 0, s * 0.35)]),
    ]);
    this.eyes = eyes(this.head, { x: 0.17, y: 0.1, z: 0.34, r: 0.12, slope: 0.55, brow: '#f4f1ff' });
    this.arms = [-1, 1].map((s) => {
      const a = joint(b, s * 0.58, 1.5, 0);
      piece(a, 'soft', [[cap(0.14, 0.5, 12), '#1f1830', where(s * 0.12, -0.3, 0, 1, 0, 0, s * 0.35)]]);
      const h = joint(a, s * 0.26, -0.62, 0);
      piece(h, 'soft', [[cap(0.12, 0.4, 12), '#1f1830', where(0, -0.2, 0.12, 1, -0.5)]]);
      const g = joint(h, 0, -0.42, 0.26);
      piece(g, 'plain', [[ball(0.17, 14, 10), '#ffffff', where()]]);
      if (s < 0) {
        piece(g, 'plain', [[rod(0.025, 0.04, 1.1, 8), '#fff3d6', where(0, 0.2, 0.5, 1, 1.1)]]);
        this.tip = piece(g, 'glow', [[ball(0.07, 12, 8), '#ffd75e', where()]], [0, 0.44, 0.98]);
      }
      return { a, h, s };
    });
    // The box he stands on.
    piece(this.body, 'gloss', [[rod(1.25, 1.35, 0.4, 40), '#7a3f1c', where(0, 0.2, 0)], [tube(1.28, 0.08, 44, 8), '#f0c04a', where(0, 0.38, 0, 1, Math.PI / 2)]]);
    b.position.y = 0.4;
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const tune = (s.more?.[0] ?? 0) === 1;
    const t = this.time * (tune ? 5.2 : 3);
    for (const { a, h, s: side } of this.arms) {
      a.rotation.x = ease(a.rotation.x, s.open ? 0.6 : act ? -2.2 : -0.9 - Math.sin(t) * 0.5 - wind * 0.8, 10, dt);
      a.rotation.z = ease(a.rotation.z, s.open ? -side * 0.1 : side * (0.35 + Math.cos(t * 0.5) * 0.35), 10, dt);
      h.rotation.x = s.open ? 0.2 : -0.5 - Math.sin(t + side) * 0.3;
    }
    this.head.rotation.x = s.open ? 0.4 : Math.sin(t) * 0.12 - wind * 0.2;
    this.head.rotation.z = Math.sin(t * 0.5) * 0.1;
    this.man.position.y = 0.4 + Math.abs(Math.sin(t * 0.5)) * 0.06 - (s.open ? 0.2 : 0);
    this.tip?.scale.setScalar(1 + wind * 1.6);
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

// ---------------------------------------------------------------- Tick-Tock Skies

class Windup extends Fright {
  constructor() {
    super({ height: 1.55, radius: 0.62, color: '#8fb0c9' });
    const b = this.body;
    this.trunk = joint(b, 0, 0.75, 0);
    piece(this.trunk, 'metal', [[rod(0.42, 0.36, 0.7, 24), '#8fb0c9', where()], [tube(0.42, 0.05, 28, 8), '#f2cc62', where(0, -0.3, 0, 1, Math.PI / 2)], [tube(0.38, 0.04, 28, 8), '#f2cc62', where(0, 0.34, 0, 1, Math.PI / 2)], ...[0, 1, 2].map((i) => [ball(0.05, 8, 6), '#f2cc62', where(0, 0.16 - i * 0.18, 0.41)])]);
    this.head = joint(b, 0, 1.3, 0);
    piece(this.head, 'metal', [[new THREE.SphereGeometry(0.36, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), '#8fb0c9', where(0, -0.02, 0)], [rod(0.36, 0.36, 0.22, 24), '#7a9ab5', where(0, -0.12, 0)], [cone(0.12, 0.4, 10), '#e0405f', where(0, 0.5, 0)]]);
    piece(this.head, 'plain', [[ball(1, 14, 8), '#231b33', where(0, -0.04, 0.28, [0.28, 0.09, 0.12])]]);
    this.eyes = eyes(this.head, { x: 0.12, y: -0.04, z: 0.36, r: 0.07, glow: '#ffd27a', brow: null });
    this.shield = joint(b, 0.3, 0.75, 0.46);
    piece(this.shield, 'metal', [[rod(0.46, 0.46, 0.08, 28), '#d9a93e', where(0, 0, 0, [1, 1, 1.25], Math.PI / 2)], [tube(0.46, 0.05, 30, 8), '#f2cc62', where(0, 0, 0.02, [1, 1.25, 1])], [ball(0.14, 14, 10), '#e0405f', where(0, 0, 0.08, [1, 1, 0.6])]]);
    this.arm = joint(b, -0.46, 0.95, 0.05);
    piece(this.arm, 'metal', [[ball(0.14, 12, 10), '#7a9ab5', where()], [cap(0.09, 0.3, 10), '#7a9ab5', where(0, -0.2, 0.06)]]);
    this.sword = joint(this.arm, 0, -0.4, 0.14);
    piece(this.sword, 'metal', [[new THREE.BoxGeometry(0.1, 0.04, 1.1), '#eef2fb', where(0, 0, 0.6)], [cone(0.07, 0.2, 4), '#eef2fb', where(0, 0, 1.22, 1, Math.PI / 2, 0, 0)], [new THREE.BoxGeometry(0.36, 0.07, 0.08), '#f2cc62', where(0, 0, 0.06)]]);
    this.legs = [-1, 1].map((s) => {
      const l = joint(b, s * 0.2, 0.42, 0);
      piece(l, 'metal', [[cap(0.1, 0.2, 10), '#6f8aa5', where(0, -0.12, 0)], [ball(0.16, 12, 10), '#3a4a5f', where(0, -0.32, 0.07, [0.85, 0.6, 1.35])]]);
      return { l, s };
    });
    this.key = joint(this.trunk, 0, 0.05, -0.5);
    piece(this.key, 'metal', [[rod(0.05, 0.05, 0.3, 8), '#f2cc62', where(0, 0, 0.05, 1, Math.PI / 2)], [tube(0.18, 0.06, 18, 8), '#f2cc62', where(-0.2, 0, -0.12)], [tube(0.18, 0.06, 18, 8), '#f2cc62', where(0.2, 0, -0.12)]]);
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const spin = s.kind === 'burst' && (act || wind > 0.5);
    this.trunk.rotation.y = spin ? this.time * 16 : ease(this.trunk.rotation.y % (Math.PI * 2), 0, 10, dt);
    this.key.rotation.z += dt * (s.open ? 0.4 : 5);
    this.arm.rotation.x = ease(this.arm.rotation.x, act ? 0.9 : wind ? -2.2 * wind : s.open ? 0.5 : -0.5, 16, dt);
    this.shield.position.z = ease(this.shield.position.z, s.open ? 0.1 : 0.46, 8, dt);
    this.shield.position.y = ease(this.shield.position.y, s.open ? 0.35 : 0.75, 8, dt);
    for (const { l, s: side } of this.legs) l.rotation.x = Math.sin(this.step * 1.8 + (side > 0 ? 0 : Math.PI)) * Math.min(0.8, (s.speed ?? 0) * 0.4);
    this.head.rotation.x = s.open ? 0.5 : 0;
    this.head.rotation.y = Math.sin(this.time * 2) * 0.1;
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

class Cuckoo extends Fright {
  constructor() {
    super({ height: 1, radius: 0.5, color: '#e0663d' });
    const b = joint(this.body, 0, 0.45, 0);
    this.bird = b;
    piece(b, 'gloss', [[ball(0.4, 22, 16), '#e0663d', where(0, 0, 0, [0.9, 0.95, 1.15])], [ball(0.28, 16, 12), '#ffd9a8', where(0, -0.1, 0.14)], [ball(0.28, 18, 14), '#f07a48', where(0, 0.36, 0.2)]]);
    piece(b, 'metal', [[cone(0.1, 0.3, 8), '#f2cc62', where(0, 0.34, 0.56, 1, Math.PI / 2)], ...[-1, 0, 1].map((i) => [ball(1, 10, 6), '#f2cc62', where(i * 0.1, 0.64, 0.14, [0.04, 0.14, 0.06], 0, 0, -i * 0.35)]), ...[-1, 0, 1].map((i) => [ball(1, 10, 6), '#b94a2a', where(i * 0.12, 0.06, -0.52, [0.07, 0.04, 0.24], 0.25, i * 0.3)])]);
    this.eyes = eyes(b, { x: 0.14, y: 0.42, z: 0.4, r: 0.1, slope: 0.5 });
    this.wings = [-1, 1].map((s) => {
      const w = joint(b, s * 0.3, 0.06, 0);
      piece(w, 'metal', [0, 1, 2].map((i) => [ball(1, 12, 8), i % 2 ? '#c9933e' : '#f2cc62', where(s * (0.3 + i * 0.1), -i * 0.05, -0.04 - i * 0.12, [0.34 - i * 0.05, 0.03, 0.12], 0, s * 0.25 * i, 0)]));
      return { w, s };
    });
    this.key = joint(b, 0, 0.1, -0.4);
    piece(this.key, 'metal', [[tube(0.1, 0.035, 14, 8), '#f2cc62', where(-0.11, 0, -0.06)], [tube(0.1, 0.035, 14, 8), '#f2cc62', where(0.11, 0, -0.06)]]);
  }

  pose(dt, s) {
    const down = s.open === 'fall' || s.open === 'spent';
    for (const { w, s: side } of this.wings) w.rotation.z = side * (down ? -0.5 : Math.sin(this.time * 16) * 0.8);
    this.bird.position.y = 0.45 + Math.sin(this.time * 3) * 0.08;
    this.bird.rotation.x = ease(this.bird.rotation.x, down ? 0.9 : s.state === 'act' && s.kind === 'lunge' ? 0.6 : 0.05, 10, dt);
    this.key.rotation.z = this.time * (down ? 1 : 7);
    this.eyes.mood(Boolean(s.open), s.state === 'wind' ? 1 : 0, this.time);
  }
}

class Cogling extends Fright {
  constructor() {
    super({ height: 0.85, radius: 0.38, color: '#e0b060' });
    this.wheel = joint(this.body, 0, 0.42, 0);
    const t = [];
    for (let i = 0; i < 10; i++) t.push([new THREE.BoxGeometry(0.22, 0.16, 0.16), '#c98a4a', along(0, Math.sin(i * 0.628) * 0.4, Math.cos(i * 0.628) * 0.4, [0, Math.sin(i * 0.628), Math.cos(i * 0.628)])]);
    piece(this.wheel, 'metal', [[rod(0.36, 0.36, 0.22, 28), '#e0b060', where(0, 0, 0, 1, 0, 0, Math.PI / 2)], ...t]);
    this.face = joint(this.body, 0, 0.42, 0);
    for (const s of [-1, 1]) piece(this.face, 'plain', [[rod(0.2, 0.2, 0.06, 20), '#fff0d0', where(s * 0.13, 0, 0, 1, 0, 0, Math.PI / 2)]]);
    this.eyes = eyes(this.face, { x: 0.1, y: 0.06, z: 0.4, r: 0.085, slope: 0.5 });
  }

  pose(dt, s) {
    this.wheel.rotation.x += dt * (s.speed ?? 0) * 2.4 + (s.state === 'wind' ? dt * 16 * (s.k ?? 0) : 0);
    this.face.position.y = 0.42 + Math.abs(Math.sin(this.step * 2)) * 0.05;
    this.eyes.mood(Boolean(s.open) || s.state === 'hurt', s.state === 'wind' ? 1 : 0, this.time);
  }
}

class Jack extends Fright {
  constructor() {
    super({ height: 1.3, radius: 0.72, color: '#4f8fd0' });
    const b = joint(this.body);
    this.box = b;
    const stars = [];
    for (let f = 0; f < 4; f++) stars.push([ball(1, 5, 2), '#ffd75e', where(Math.sin(f * 1.571) * 0.63, 0.55, Math.cos(f * 1.571) * 0.63, [f % 2 ? 0.02 : 0.26, 0.26, f % 2 ? 0.26 : 0.02])]);
    piece(b, 'gloss', [[new THREE.BoxGeometry(1.24, 1.05, 1.24), '#4f8fd0', where(0, 0.55, 0)], ...[-1, 1].flatMap((x) => [-1, 1].map((z) => [rod(0.08, 0.08, 1.12, 10), '#f2cc62', where(x * 0.62, 0.55, z * 0.62)])), ...stars]);
    this.crank = joint(b, 0.7, 0.6, 0);
    piece(this.crank, 'metal', [[rod(0.04, 0.04, 0.24, 8), '#f2cc62', where(0.06, 0, 0, 1, 0, 0, Math.PI / 2)], [rod(0.04, 0.04, 0.3, 8), '#f2cc62', where(0.16, 0.13, 0)], [ball(0.08, 10, 8), '#e0405f', where(0.16, 0.3, 0)]]);
    this.lid = joint(b, 0, 1.08, -0.6);
    piece(this.lid, 'gloss', [[new THREE.BoxGeometry(1.28, 0.12, 1.28), '#3a6fb0', where(0, 0.06, 0.6)]]);
    // Who is in it, on a spring.
    this.out = joint(b, 0, 1.0, 0);
    const coil = [];
    for (let i = 0; i < 9; i++) coil.push([tube(0.2, 0.035, 18, 6), '#e9ecf6', where(0, 0, 0.1 + i * 0.1)]);
    this.coil = piece(this.out, 'metal', coil);
    this.head = joint(this.out, 0, 0, 1);
    piece(this.head, 'gloss', [[ball(0.4, 22, 16), '#ffe0c4', where()], [ball(0.13, 12, 10), '#e0405f', where(0, -0.04, 0.4)], ...[-1, 1].map((s) => [cone(0.2, 0.7, 12), s > 0 ? '#e0405f' : '#ffd75e', along(s * 0.28, 0.42, -0.04, [s * 0.9, 1, 0], [1, 1, 1])]), ...[-1, 1].map((s) => [ball(0.09, 10, 8), '#f2cc62', where(s * 0.58, 0.76, -0.04)]), ...Array.from({ length: 9 }, (_, i) => [ball(0.14, 10, 8), i % 2 ? '#ffd75e' : '#4fb08a', where(Math.sin(i * 0.698) * 0.34, Math.cos(i * 0.698) * 0.34, -0.26, [1, 1, 0.6])])]);
    this.eyes = eyes(this.head, { x: 0.16, y: 0.12, z: 0.32, r: 0.11, slope: 0.55 });
    this.head.visible = this.coil.visible = false;
    this.reach = 0;
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const out = s.state === 'act' && s.kind === 'out' ? 8 : s.open === 'stuck' ? 5.5 : s.open ? 2 : 0;
    this.reach = ease(this.reach, out, out > this.reach ? 26 : 9, dt);
    const on = this.reach > 0.15;
    this.head.visible = this.coil.visible = on;
    this.coil.scale.z = Math.max(0.1, this.reach);
    this.head.position.z = this.reach;
    const sag = s.open === 'stuck' ? Math.sin(this.time * 5) * 0.06 : 0;
    this.out.rotation.x = 0.12 + sag;
    this.out.rotation.y = s.open === 'stuck' ? Math.sin(this.time * 3) * 0.08 : 0;
    this.lid.rotation.x = ease(this.lid.rotation.x, on ? -2 : wind * -0.12, 16, dt);
    this.crank.rotation.x += dt * (wind ? 6 + wind * 16 : 0.6);
    this.box.position.y = Math.abs(Math.sin(this.step * 1.4)) * 0.24 * Math.min(1, s.speed ?? 0);
    this.eyes.mood(Boolean(s.open), 1, this.time);
  }
}

// Old Tock: a grandfather clock as tall as a house, with a moustache.
class Tock extends Fright {
  constructor() {
    super({ height: 5.4, radius: 1.5, color: '#8a5630' });
    const b = joint(this.body);
    this.case_ = b;
    piece(b, 'gloss', [
      [new THREE.BoxGeometry(2.5, 0.5, 1.7), '#5f371c', where(0, 0.25, 0)],
      [new THREE.BoxGeometry(1.9, 2.7, 1.3), '#8a5630', where(0, 1.8, 0)],
      [new THREE.BoxGeometry(2.4, 1.7, 1.6), '#7a4a28', where(0, 3.9, 0)],
      [new THREE.CylinderGeometry(0.3, 1.3, 0.8, 4), '#5f371c', where(0, 5.1, 0, [1, 1, 0.7], 0, Math.PI / 4)],
      [ball(0.28, 16, 12), '#f2cc62', where(0, 5.6, 0)],
      ...[-1, 1].map((s) => [cone(0.2, 0.6, 12), '#f2cc62', where(s * 1.05, 5.0, 0.3)]),
    ]);
    piece(b, 'plain', [[rod(0.78, 0.78, 0.08, 40), '#fff4dc', where(0, 3.95, 0.82, 1, Math.PI / 2)], [new THREE.BoxGeometry(1.1, 1.9, 0.06), '#2a1a10', where(0, 1.75, 0.66)]]);
    const ticks = [];
    for (let i = 0; i < 12; i++) ticks.push([ball(0.06, 8, 6), '#4a2c16', where(Math.sin(i * 0.5236) * 0.62, 3.95 + Math.cos(i * 0.5236) * 0.62, 0.88)]);
    piece(b, 'metal', [[tube(0.8, 0.08, 40, 8), '#f2cc62', where(0, 3.95, 0.84)], ...ticks]);
    this.hands = [0.52, 0.36].map((l, i) => {
      const h = joint(b, 0, 3.95, 0.9);
      piece(h, 'gloss', [[cap(0.04, l, 8), '#33201a', where(0, l / 2, 0)]]);
      return { h, i };
    });
    this.eyes = eyes(b, { x: 0.28, y: 4.1, z: 0.92, r: 0.17, slope: 0.5 });
    piece(b, 'soft', [-1, 1].map((s) => [ball(1, 14, 10), '#f4f1ff', where(s * 0.26, 3.68, 0.95, [0.3, 0.12, 0.12], 0, 0, s * 0.3)]));
    this.pend = joint(b, 0, 2.6, 0.72);
    piece(this.pend, 'metal', [[rod(0.04, 0.04, 1.3, 8), '#f2cc62', where(0, -0.65, 0)], [rod(0.3, 0.3, 0.08, 28), '#f2cc62', where(0, -1.35, 0, 1, Math.PI / 2)]]);
    this.feet = [-1, 1].map((s) => {
      const f = joint(b, s * 0.8, 0.1, 0.3);
      piece(f, 'gloss', [[ball(0.42, 16, 12), '#3f2412', where(0, 0, 0.2, [0.9, 0.55, 1.3])]]);
      return { f, s };
    });
    this.arms = [-1, 1].map((s) => {
      const a = joint(b, s * 1.2, 3.3, 0);
      piece(a, 'gloss', [[cap(0.2, 1.1, 12), '#7a4a28', where(s * 0.3, -0.6, 0, 1, 0, 0, s * 0.4)], [ball(0.4, 16, 12), '#f2cc62', where(s * 0.6, -1.35, 0)]]);
      return { a, s };
    });
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    this.swing = (this.swing ?? 0) + dt * (s.open ? 0.6 : 3.2);
    this.pend.rotation.z = Math.sin(this.swing) * (s.open ? 0.1 : 0.4);
    for (const { h, i } of this.hands) h.rotation.z -= dt * (act ? 5 : s.open ? 0 : 0.7) * (i ? 0.2 : 1);
    this.case_.rotation.z = Math.sin(this.swing) * 0.03;
    this.case_.position.y = wind ? wind * 0.5 : 0;
    for (const { a, s: side } of this.arms) {
      a.rotation.x = ease(a.rotation.x, s.open ? 0.1 : act ? -1.4 : -wind * 2.6, 8, dt);
      a.rotation.z = ease(a.rotation.z, side * (act ? 0.9 : 0.1), 8, dt);
    }
    for (const { f, s: side } of this.feet) f.position.y = 0.1 + Math.max(0, Math.sin(this.step + (side > 0 ? 0 : Math.PI))) * 0.3;
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

// His key, round the back of the dial.
class TockKey extends Fright {
  constructor() {
    super({ height: 2.6, radius: 1.1, color: '#f2cc62' });
    this.key = joint(this.body);
    piece(this.body, 'metal', [[lathe([[0, 0], [1.5, 0], [1.55, 0.14], [1.2, 0.34], [0.5, 0.42], [0, 0.42]], 36), '#8a5c28']]);
    this.hold = piece(this.key, 'metal', [[rod(0.22, 0.22, 1.6, 16), '#f2cc62', where(0, 0.9, 0)], [tube(0.62, 0.2, 28, 12), '#f2cc62', where(0.62, 2.1, 0)], [tube(0.62, 0.2, 28, 12), '#f2cc62', where(-0.62, 2.1, 0)]]);
    this.hot = piece(this.key, 'glow', [[rod(0.26, 0.26, 1.6, 16), '#ff7a9f', where(0, 0.9, 0)], [tube(0.62, 0.24, 28, 12), '#ff7a9f', where(0.62, 2.1, 0)], [tube(0.62, 0.24, 28, 12), '#ff7a9f', where(-0.62, 2.1, 0)]]);
  }

  pose(dt, s) {
    const soft = (s.more?.[0] ?? 0) === 1;
    this.hot.visible = soft;
    this.hold.visible = !soft;
    this.key.rotation.y += dt * (soft ? 0.5 : 5);
    this.key.position.y = soft ? Math.sin(this.time * 8) * 0.05 : 0;
  }
}

addFrightModels({ quaver: Quaver, drummer: Drummer, metronome: Metronome, clam: Clam, maestro: Maestro, windup: Windup, cuckoo: Cuckoo, cogling: Cogling, jack: Jack, tock: Tock, tockkey: TockKey });
