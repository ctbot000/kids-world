// The frights of Pumpkin Skies as they look (frights.js has how each is told it
// is): aphids, Weevil Knights, Snapdragons, Snaptraps, Grump-hoppers, and Old
// Munch, the great caterpillar, all in pieces.
import * as THREE from '../../../vendor/three.module.js';
import { addFrightModels, ball, cap, cone, ease, eyes, Fright, joint, lathe, piece, rod, tube } from './frights.js';
import { along, where } from './kit.js';

class Aphid extends Fright {
  constructor() {
    super({ height: 0.75, radius: 0.36, color: '#a8dc5a' });
    this.puff = joint(this.body);
    piece(this.puff, 'gloss', [
      [ball(0.34, 18, 14), '#a8dc5a', where(0, 0.36, -0.04, [1, 0.92, 1.15])],
      [ball(0.22, 14, 10), '#b9e876', where(0, 0.4, 0.24)],
      ...[-1, 1].map((s) => [ball(0.12, 10, 8), '#8fc447', where(s * 0.22, 0.2, -0.16)]),
    ]);
    this.eyes = eyes(this.puff, { x: 0.12, y: 0.46, z: 0.4, r: 0.085, slope: 0.55, brow: '#3f5a1f' });
    this.legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = joint(this.puff, s * 0.24, 0.2, 0.16 - i * 0.18);
        piece(l, 'plain', [[cap(0.03, 0.2, 6), '#5f8a2a', where(s * 0.08, -0.08, 0, 1, 0, 0, s * 0.7)]]);
        this.legs.push({ l, s, i });
      }
    }
    for (const s of [-1, 1]) piece(this.puff, 'plain', [[cap(0.02, 0.3, 6), '#5f8a2a', where(s * 0.12, 0.72, 0.34, 1, 0.6, 0, -s * 0.5)], [ball(0.04, 8, 6), '#5f8a2a', where(s * 0.21, 0.86, 0.44)]]);
  }

  pose(dt, s) {
    const hop = Math.abs(Math.sin(this.step * 1.5)) * (s.speed > 0.3 ? 0.3 : 0.02);
    const crouch = s.state === 'wind' ? (s.k ?? 0) : 0;
    const spring = s.state === 'act' ? Math.sin(Math.min(1, s.run ?? 0) * Math.PI) * 0.6 : 0;
    this.puff.position.y = hop + spring;
    this.puff.scale.set(1 + crouch * 0.2, 1 - crouch * 0.32, 1 + crouch * 0.2);
    for (const { l, i } of this.legs) l.rotation.x = Math.sin(this.step * 3 + i * 2) * 0.5;
    this.eyes.mood(Boolean(s.open) || s.state === 'hurt', crouch, this.time);
  }
}

class Weevil extends Fright {
  constructor() {
    super({ height: 1.2, radius: 0.75, color: '#3f7ac9' });
    this.all = joint(this.body, 0, 0.55, 0);
    const a = this.all;
    this.shell = joint(a);
    const dots = [];
    for (let i = 0; i < 10; i++) dots.push([ball(0.07, 8, 6), '#ffd75e', along(Math.sin(i * 2.4) * 0.5, 0.2 + (i % 4) * 0.1, Math.cos(i * 2.4) * 0.5 - 0.1, [Math.sin(i * 2.4), 0.6, Math.cos(i * 2.4)], [1, 0.4, 1])]);
    piece(this.shell, 'gloss', [
      [new THREE.SphereGeometry(0.72, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), '#3f7ac9', where(0, -0.08, -0.06, [1, 0.92, 1.1])],
      [tube(0.7, 0.05, 32, 8), '#f0c65a', where(0, -0.14, -0.06, [1, 1.1, 1], Math.PI / 2)],
      [rod(0.03, 0.03, 1.36, 8), '#2b568f', where(0, 0.5, -0.08, [1, 1, 1], Math.PI / 2 + 0.06)],
      ...dots,
    ]);
    piece(a, 'plain', [[ball(0.62, 18, 12), '#2a2438', where(0, -0.12, 0, [1, 0.62, 1.08])]]);
    this.head = joint(a, 0, -0.02, 0.62);
    piece(this.head, 'gloss', [[ball(0.3, 18, 14), '#34466e', where(0, 0, 0)]]);
    // Its snout, long and bent, with feelers.
    piece(this.head, 'plain', [
      [cap(0.07, 0.3, 10), '#27324f', where(0, -0.08, 0.32, 1, 1.15)],
      [cap(0.06, 0.2, 10), '#27324f', where(0, -0.24, 0.5, 1, 0.5)],
      ...[-1, 1].map((s) => [cap(0.02, 0.26, 6), '#27324f', where(s * 0.16, 0.12, 0.34, 1, 1, 0, -s * 0.9)]),
    ]);
    this.eyes = eyes(this.head, { x: 0.15, y: 0.12, z: 0.2, r: 0.1, slope: 0.5 });
    // A helmet of half a nutshell.
    piece(this.head, 'plain', [[new THREE.SphereGeometry(0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), '#a8703a', where(0, 0.06, -0.06)], [cone(0.05, 0.16, 8), '#8a5628', where(0, 0.44, -0.06)]]);
    this.legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = joint(a, s * 0.5, -0.25, 0.34 - i * 0.36);
        piece(l, 'plain', [[cap(0.06, 0.24, 8), '#27324f', where(s * 0.12, -0.1, 0, 1, 0, 0, s * 0.6)]]);
        this.legs.push({ l, s, i });
      }
    }
  }

  pose(dt, s) {
    const roll = s.look === 'roll' && s.state === 'act';
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const tuck = roll ? 1 : s.look === 'roll' ? wind : 0;
    this.all.rotation.x = roll ? this.all.rotation.x + dt * 15 : ease(this.all.rotation.x % (Math.PI * 2), 0, 10, dt);
    this.head.position.z = ease(this.head.position.z, 0.62 - tuck * 0.4, 12, dt);
    this.head.scale.setScalar(1 - tuck * 0.35);
    for (const { l, s: side, i } of this.legs) {
      l.rotation.z = s.open === 'flip' ? Math.sin(this.time * 16 + i * 2 + side) * 0.6 : tuck * side * 1.2;
      l.rotation.x = Math.sin(this.step * 2.4 + i * 2 + (side > 0 ? 0 : Math.PI)) * Math.min(0.6, (s.speed ?? 0) * 0.3);
      l.scale.setScalar(1 - tuck * 0.6);
    }
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

class Spitter extends Fright {
  constructor() {
    super({ height: 1.95, radius: 0.7, color: '#f2637a' });
    const b = this.body;
    const leaves = [];
    for (let i = 0; i < 6; i++) leaves.push([ball(1, 14, 8), i % 2 ? '#5fae3a' : '#79c448', where(Math.sin(i * 1.047) * 0.45, 0.1, Math.cos(i * 1.047) * 0.45, [0.2, 0.05, 0.42], -0.25, i * 1.047, 0)]);
    piece(b, 'soft', leaves);
    this.stem = [];
    let at = joint(b, 0, 0.05, 0);
    for (let i = 0; i < 4; i++) {
      piece(at, 'soft', [[cap(0.13 - i * 0.012, 0.3, 10), '#6fb83f', where(0, 0.17, 0)]]);
      this.stem.push(at);
      at = joint(at, 0, 0.33, 0);
    }
    this.head = at;
    const petals = [];
    for (let i = 0; i < 9; i++) petals.push([ball(1, 12, 8), i % 2 ? '#f2637a' : '#ff8f9f', along(Math.sin(i * 0.698) * 0.44, Math.cos(i * 0.698) * 0.44, -0.06, [Math.sin(i * 0.698), Math.cos(i * 0.698), -0.1], [0.16, 0.3, 0.06])]);
    piece(this.head, 'soft', petals);
    this.top = joint(this.head);
    piece(this.top, 'gloss', [[new THREE.SphereGeometry(0.4, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), '#e0405f', where(0, 0, 0.06, [1, 0.85, 1.15])]]);
    this.jaw = joint(this.head);
    piece(this.jaw, 'gloss', [[new THREE.SphereGeometry(0.4, 22, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), '#c93558', where(0, 0, 0.06, [1, 0.7, 1.15])], [ball(0.32, 16, 10), '#5a1a34', where(0, 0.0, 0.1, [1, 0.12, 1.1])]]);
    const teeth = [];
    for (let i = 0; i < 7; i++) {
      const t = -1.2 + i * 0.4;
      teeth.push([cone(0.05, 0.13, 6), '#fffaf0', where(Math.sin(t) * 0.36, -0.04, 0.08 + Math.cos(t) * 0.42, 1, Math.PI, 0, 0)]);
    }
    piece(this.top, 'plain', teeth);
    this.eyes = eyes(this.top, { x: 0.17, y: 0.3, z: 0.3, r: 0.1, slope: 0.5 });
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const spit = s.state === 'act' ? 1 : 0;
    this.stem.forEach((j, i) => {
      j.rotation.x = ease(j.rotation.x, s.open ? 0.5 : -0.1 - wind * 0.22 + spit * 0.2 + Math.sin(this.time * 1.8 + i) * 0.06, 10, dt);
      j.rotation.z = Math.sin(this.time * 1.4 + i * 0.7) * 0.08;
    });
    this.head.rotation.x = ease(this.head.rotation.x, s.open ? 0.8 : 0.3, 8, dt);
    this.top.rotation.x = ease(this.top.rotation.x, -(wind * 0.5 + spit * 0.8) + (s.open ? -0.3 : 0), 16, dt);
    this.jaw.rotation.x = ease(this.jaw.rotation.x, wind * 0.3 + spit * 0.6 + (s.open ? 0.5 : 0), 16, dt);
    const puff = 1 + wind * 0.22;
    this.head.scale.set(puff, puff, puff);
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

class Snaptrap extends Fright {
  constructor() {
    super({ height: 1.6, radius: 0.8, color: '#6fbf4c' });
    const b = this.body;
    const dirt = [];
    for (let i = 0; i < 12; i++) dirt.push([new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 1), i % 2 ? '#7a5433' : '#5f4026', where(Math.sin(i * 0.524) * 0.72, 0.04, Math.cos(i * 0.524) * 0.72)]);
    piece(b, 'plain', dirt);
    piece(b, 'soft', [[cap(0.26, 0.5, 14), '#5fae3a', where(0, 0.4, 0)]]);
    this.sides = [-1, 1].map((s) => {
      const j = joint(b, 0, 0.75, 0);
      const spikes = [];
      for (let i = 0; i < 8; i++) {
        const t = -1.25 + i * 0.357;
        spikes.push([cone(0.05, 0.3, 6), '#fff2c0', where(s * 0.08, 0.62 + Math.cos(t) * 0.28, Math.sin(t) * 0.66, 1, Math.sin(t) * 0.5, 0, -s * 0.6)]);
      }
      piece(j, 'gloss', [[new THREE.SphereGeometry(0.72, 22, 14, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), '#6fbf4c', where(0, 0.35, 0, [0.62, 0.85, 1])]]);
      piece(j, 'soft', [[ball(0.66, 18, 12), '#e0405f', where(s * 0.04, 0.35, 0, [0.12, 0.82, 0.95])]]);
      piece(j, 'plain', spikes);
      return { j, s };
    });
    this.eyes = eyes(b, { x: 0.22, y: 0.62, z: 0.42, r: 0.12, slope: 0.5 });
  }

  pose(dt, s) {
    const open = s.open ? 0.75 : s.state === 'act' ? 0.05 : 0.5 + Math.sin(this.time * 5) * 0.08;
    for (const { j, s: side } of this.sides) j.rotation.z = ease(j.rotation.z, -side * open, 18, dt);
    this.eyes.mood(Boolean(s.open), 0, this.time);
  }
}

class Hopper extends Fright {
  constructor() {
    super({ height: 1.35, radius: 0.62, color: '#7fc93f' });
    this.all = joint(this.body, 0, 0.6, 0);
    const a = this.all;
    piece(a, 'gloss', [
      [cap(0.3, 0.6, 16), '#7fc93f', where(0, 0, -0.12, 1, Math.PI / 2 - 0.2)],
      [ball(1, 14, 10), '#a8e06a', where(0, -0.12, -0.1, [0.24, 0.2, 0.5])],
      ...[-1, 1].map((s) => [ball(1, 14, 8), '#5fa52e', where(s * 0.16, 0.22, -0.3, [0.08, 0.05, 0.55], 0.12, s * 0.08, s * 0.4)]),
    ]);
    this.head = joint(a, 0, 0.2, 0.5);
    piece(this.head, 'gloss', [[ball(0.28, 18, 14), '#8fd650', where(0, 0, 0, [0.95, 1.1, 0.95])], [ball(0.16, 12, 10), '#a8e06a', where(0, -0.18, 0.12)]]);
    this.eyes = eyes(this.head, { x: 0.18, y: 0.1, z: 0.16, r: 0.13, slope: 0.4 });
    for (const s of [-1, 1]) piece(this.head, 'plain', [[cap(0.02, 0.5, 6), '#4f7a22', where(s * 0.14, 0.42, -0.06, 1, -0.6, 0, -s * 0.3)]]);
    this.back = [-1, 1].map((s) => {
      const th = joint(a, s * 0.3, 0.02, -0.26);
      piece(th, 'gloss', [[cap(0.11, 0.5, 10), '#6fb83a', where(s * 0.05, 0.26, -0.18, 1, -0.6)]]);
      const sh = joint(th, s * 0.06, 0.5, -0.38);
      piece(sh, 'plain', [[cap(0.05, 0.85, 8), '#4f8a2a', where(0, -0.46, 0.14, 1, 0.3)], [ball(0.09, 10, 8), '#4f8a2a', where(0, -0.94, 0.32, [1, 0.5, 1.5])]]);
      return { th, sh, s };
    });
    this.front = [-1, 1].map((s) => {
      const l = joint(a, s * 0.22, -0.12, 0.3);
      piece(l, 'plain', [[cap(0.045, 0.36, 8), '#4f8a2a', where(s * 0.08, -0.22, 0.04, 1, 0, 0, s * 0.3)]]);
      return { l, s };
    });
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const air = s.alt > 0.2;
    this.all.position.y = ease(this.all.position.y, 0.6 - wind * 0.28 - (s.open ? 0.2 : 0), 14, dt);
    this.all.rotation.x = ease(this.all.rotation.x, air ? -0.45 : wind * 0.15, 10, dt);
    for (const { th, sh } of this.back) {
      th.rotation.x = ease(th.rotation.x, air ? -1.1 : wind * 0.35, 14, dt);
      sh.rotation.x = ease(sh.rotation.x, air ? 1.2 : -wind * 0.3, 14, dt);
    }
    for (const { l, s: side } of this.front) l.rotation.x = air ? 0.9 : Math.sin(this.step * 2 + side) * Math.min(0.5, (s.speed ?? 0) * 0.2);
    this.head.rotation.z = s.open ? Math.sin(this.time * 6) * 0.3 : 0;
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

// Old Munch's head: a great green caterpillar's, with a bib.
class Munch extends Fright {
  constructor() {
    super({ height: 2.5, radius: 1.3, color: '#8fcf3f' });
    this.head = joint(this.body, 0, 1.2, 0);
    piece(this.head, 'gloss', [
      [ball(1.2, 30, 22), '#8fcf3f', where(0, 0, 0, [1, 1, 0.95])],
      [ball(0.75, 22, 16), '#c9ee86', where(0, -0.35, 0.62, [1, 0.8, 0.6])],
      ...[-1, 1].map((s) => [ball(0.3, 14, 10), '#ffb0a0', where(s * 0.8, -0.2, 0.75, [1, 0.8, 0.4])]),
    ]);
    this.eyes = eyes(this.head, { x: 0.48, y: 0.34, z: 0.9, r: 0.34, slope: 0.4, brow: '#4f7a1f' });
    // His jaws, with something always in them.
    this.jaws = [-1, 1].map((s) => {
      const j = joint(this.head, s * 0.34, -0.5, 0.95);
      piece(j, 'gloss', [[ball(1, 14, 10), '#e0602a', where(-s * 0.1, 0, 0.16, [0.3, 0.2, 0.26], 0, -s * 0.5, 0)], [cone(0.1, 0.3, 8), '#fff3d6', where(-s * 0.22, 0, 0.34, 1, Math.PI / 2, 0, 0)]]);
      return { j, s };
    });
    for (const s of [-1, 1]) piece(this.head, 'plain', [[cap(0.07, 0.8, 8), '#4f7a1f', where(s * 0.5, 1.45, 0, 1, 0.1, 0, -s * 0.35)], [ball(0.18, 14, 10), '#ff7a3d', where(s * 0.7, 1.95, 0.06)]]);
    piece(this.head, 'soft', [[lathe([[0.4, 0], [0.95, -0.12], [1.05, -0.4], [0.3, -0.5]], 28), '#fff3e0', where(0, -0.75, 0.3, [1, 1, 0.9], 0.35)]]);
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const bite = s.state === 'act' ? 1 : 0;
    this.head.position.y = 1.2 + Math.abs(Math.sin(this.time * 3)) * 0.1 + wind * 0.5;
    this.head.rotation.x = ease(this.head.rotation.x, wind ? -0.45 * wind : bite ? 0.35 : s.open ? 0.4 : 0, 10, dt);
    const chew = s.open ? 0.5 : 0.3 + Math.sin(this.time * 9) * 0.25;
    for (const { j, s: side } of this.jaws) j.rotation.y = ease(j.rotation.y, side * (bite ? -0.2 : wind ? 0.9 : chew), 16, dt);
    this.eyes.mood(Boolean(s.open), wind, this.time);
  }
}

// A joint of him: a ball on stubby feet, in a waistcoat but for the last one,
// which is soft and bare and glows.
class MunchSeg extends Fright {
  constructor() {
    super({ height: 1.6, radius: 0.95, color: '#a5dc55' });
    this.part = joint(this.body, 0, 0.9, 0);
    this.coat = joint(this.part);
    piece(this.part, 'gloss', [[ball(0.92, 24, 18), '#9ad64a', where(0, 0, 0)]]);
    const studs = [];
    for (let i = 0; i < 8; i++) studs.push([cone(0.13, 0.34, 8), '#ffd75e', along(Math.sin(i * 0.785) * 0.62, 0.66, Math.cos(i * 0.785) * 0.62, [Math.sin(i * 0.785), 1, Math.cos(i * 0.785)])]);
    piece(this.coat, 'plain', [[new THREE.SphereGeometry(0.97, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), '#7a4fb0', where()], [tube(0.97, 0.07, 32, 8), '#ffd75e', where(0, 0.12, 0, 1, Math.PI / 2)], ...studs]);
    this.bare = joint(this.part);
    this.glow = piece(this.bare, 'glow', [[ball(0.95, 24, 18), '#ff8f7a', where()]]);
    piece(this.bare, 'plain', [[tube(0.5, 0.09, 28, 8), '#fff3c0', where(0, 0.2, -0.8)]]);
    this.bare.visible = false;
    this.feet = [-1, 1].map((s) => {
      const f = joint(this.body, s * 0.5, 0.2, 0);
      piece(f, 'gloss', [[ball(0.26, 14, 10), '#5f9a2a', where(0, 0, 0.04, [0.9, 0.8, 1.2])]]);
      return { f, s };
    });
  }

  pose(dt, s) {
    const tail = (s.more?.[0] ?? 0) === 1;
    this.coat.visible = !tail;
    this.bare.visible = tail;
    const wave = Math.sin(this.time * 5 + (s.more?.[1] ?? 0) * 0.9);
    this.part.position.y = 0.9 + wave * 0.16;
    const k = tail ? 0.86 + Math.sin(this.time * 6) * 0.05 : 1;
    this.part.scale.setScalar(k);
    for (const { f, s: side } of this.feet) f.position.y = 0.2 + Math.max(0, Math.sin(this.time * 5 + (s.more?.[1] ?? 0) * 0.9 + (side > 0 ? 0 : 1))) * 0.14;
  }
}

addFrightModels({ aphid: Aphid, weevil: Weevil, spitter: Spitter, snaptrap: Snaptrap, hopper: Hopper, munch: Munch, munchseg: MunchSeg });
