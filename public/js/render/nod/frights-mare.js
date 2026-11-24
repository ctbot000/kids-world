// The frights of the Dark Side as they look (frights.js has how each is told it
// is): Inklings, your own Shadow Twin, Under-bed Grabbers, Night Watchers, Gloom
// Moths, and the Night Mare herself, with a mane of smoke.
import * as THREE from '../../../vendor/three.module.js';
import { ANIM, Avatar } from '../avatar.js';
import { addFrightModels, ball, cap, cone, ease, eyes, Fright, joint, lathe, piece, rod, tube } from './frights.js';
import { along, finishOf, where } from './kit.js';
import { Plume, sculpted } from './sculpt.js';

// What you look like, for your shadow to (nod-game.js).
let mine = null;
export function setTwinLook(look) {
  mine = look;
}

class Inkling extends Fright {
  constructor() {
    super({ height: 0.8, radius: 0.36, color: '#5a2f9a' });
    this.drop = joint(this.body);
    piece(this.drop, 'crystal', [[lathe([[0, 0], [0.3, 0.06], [0.38, 0.26], [0.32, 0.46], [0.16, 0.68], [0.04, 0.88], [0, 0.92]], 24), '#3a1f6e'], [ball(0.1, 10, 8), '#8f5cff', where(0.16, 0.42, 0.22)]]);
    this.eyes = eyes(this.drop, { x: 0.11, y: 0.32, z: 0.3, r: 0.085, glow: '#ff9fe0', brow: '#1d1033', slope: 0.5 });
  }

  pose(dt, s) {
    const hop = Math.abs(Math.sin(this.step * 1.6)) * (s.speed > 0.3 ? 0.26 : 0.02);
    const crouch = s.state === 'wind' ? (s.k ?? 0) : 0;
    const spring = s.state === 'act' ? Math.sin(Math.min(1, s.run ?? 0) * Math.PI) * 0.5 : 0;
    const wob = Math.sin(this.time * 7) * 0.06;
    this.drop.position.y = hop + spring;
    this.drop.scale.set(1 + crouch * 0.25 - wob, 1 - crouch * 0.35 + wob + spring * 0.3, 1 + crouch * 0.25 - wob);
    this.eyes.mood(Boolean(s.open) || s.state === 'hurt', crouch, this.time);
  }
}

class Twin extends Fright {
  constructor() {
    super({ height: 1.65, radius: 0.42, color: '#6f3fc9' });
    this.avatar = new Avatar(mine ?? {});
    this.dark = new THREE.MeshStandardMaterial({ color: '#160c2a', emissive: '#4a1f8f', emissiveIntensity: 0.35, roughness: 0.35 });
    this.darken();
    this.body.add(this.avatar.root);
    this.look = joint(this.body, 0, 1.22 + (this.avatar.tall ?? 0), 0.26);
    piece(this.look, 'glow', [-1, 1].map((s) => [ball(0.055, 12, 8), '#ff7ae0', where(s * 0.1, 0, 0.04, [1, 1.5, 0.6], 0, 0, -s * 0.35)]));
    this.smoke = new Plume([[0, 0.2, 0], [0, 0.7, 0], [0, 1.3, 0]], { n: 26, size: 0.24, drift: [0, 0.7, -0.15], spread: 0.22, hot: '#9a5cff', cold: '#2a1060', glow: 0.5, body: 0.35 });
    this.body.add(this.smoke.mesh);
    this.was = '';
  }

  darken() {
    this.avatar.root.traverse((o) => {
      if (o.isMesh && o.material !== this.dark && !o.userData.unflash) o.material = this.dark;
    });
  }

  pose(dt, s) {
    const moving = s.speed > 0.6;
    const anim = s.open ? ANIM.dizzy : s.alt > 0.2 ? ANIM.air : s.state === 'act' && s.kind === 'lunge' ? ANIM.run : moving ? (s.speed > 3.5 ? ANIM.run : ANIM.walk) : ANIM.idle;
    if (s.state === 'act' && this.was !== 'act') this.avatar.swing();
    this.was = s.state;
    this.avatar.update(dt, anim, Math.min(8, s.speed ?? 0));
    this.avatar.root.rotation.y = s.kind === 'burst' && s.state !== 'rest' ? this.time * 14 : 0;
    this.darken();
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    this.dark.emissiveIntensity = s.open ? 1.1 : 0.35 + wind * 0.9;
    this.look.visible = !s.open;
    this.smoke.update(this.time, 1 + wind * 0.5, 1 + Math.min(1, (s.speed ?? 0) * 0.15));
  }

  dispose() {
    this.avatar.dispose();
    this.dark.dispose();
    this.smoke.dispose();
    super.dispose();
  }
}

class Grabber extends Fright {
  constructor() {
    super({ height: 1.9, radius: 0.8, color: '#4a3a8a' });
    const b = this.body;
    const ring = [];
    for (let i = 0; i < 14; i++) ring.push([ball(0.2 + (i % 3) * 0.05, 10, 8), i % 2 ? '#1d1438' : '#2a1d4f', where(Math.sin(i * 0.449) * 0.72, 0.05, Math.cos(i * 0.449) * 0.72)]);
    piece(b, 'soft', ring);
    this.arm = joint(b);
    piece(this.arm, 'soft', [[cap(0.28, 0.8, 16), '#4a3a8a', where(0, 0.6, 0)], [tube(0.3, 0.09, 24, 8), '#ff9fb0', where(0, 0.95, 0, 1, Math.PI / 2)], [tube(0.31, 0.06, 24, 8), '#fff3e0', where(0, 0.82, 0, 1, Math.PI / 2)]]);
    this.hand = joint(this.arm, 0, 1.25, 0);
    piece(this.hand, 'soft', [[ball(0.42, 20, 16), '#5a48a0', where(0, 0.1, 0, [1, 0.9, 0.7])]]);
    this.fingers = [];
    for (let i = 0; i < 5; i++) {
      const a = i === 4 ? -1.5 : -0.75 + i * 0.5;
      const f = joint(this.hand, Math.sin(a) * 0.34, 0.16 + Math.cos(a) * 0.3, 0);
      f.rotation.z = -a * 0.7;
      piece(f, 'soft', [[cap(0.12, 0.3, 10), '#5a48a0', where(0, 0.2, 0)]]);
      const t = joint(f, 0, 0.4, 0);
      piece(t, 'soft', [[cap(0.1, 0.2, 10), '#6a56b4', where(0, 0.12, 0)]]);
      piece(t, 'plain', [[cone(0.07, 0.2, 8), '#f2e6ff', where(0, 0.32, 0.02)]]);
      this.fingers.push({ f, t });
    }
    // An eye in its palm.
    this.eyes = eyes(this.hand, { x: 0.13, y: 0.1, z: 0.3, r: 0.11, glow: '#ffe27a', brow: '#241a44', slope: 0.45 });
  }

  pose(dt, s) {
    const snatch = s.state === 'act';
    const curl = s.open ? 0.25 + Math.sin(this.time * 8) * 0.12 : snatch ? 1.3 : 0.5 + Math.sin(this.time * 4) * 0.15;
    for (const { f, t } of this.fingers) {
      f.rotation.x = ease(f.rotation.x, curl * 0.8, 18, dt);
      t.rotation.x = ease(t.rotation.x, curl, 18, dt);
    }
    this.arm.scale.y = ease(this.arm.scale.y, s.state === 'come' ? 0.2 : 1, 12, dt);
    this.arm.rotation.z = Math.sin(this.time * (s.open ? 9 : 2)) * (s.open ? 0.22 : 0.1);
    this.eyes.mood(Boolean(s.open), snatch ? 1 : 0, this.time);
  }
}

class Watcher extends Fright {
  constructor() {
    super({ height: 2.4, radius: 0.8, color: '#7a4fd0' });
    const b = this.body;
    const roots = [];
    for (let i = 0; i < 6; i++) roots.push([cap(0.13, 0.5, 8), i % 2 ? '#2a1d4f' : '#3a2a6a', where(Math.sin(i * 1.047) * 0.5, 0.12, Math.cos(i * 1.047) * 0.5, 1, Math.cos(i * 1.047) * 1.2, 0, -Math.sin(i * 1.047) * 1.2)]);
    piece(b, 'soft', [...roots, [lathe([[0.55, 0], [0.34, 0.3], [0.24, 0.9], [0.3, 1.3], [0, 1.4]], 24), '#3a2a6a']]);
    this.head = joint(b, 0, 1.75, 0);
    piece(this.head, 'gloss', [[ball(0.62, 30, 22), '#f4ecff', where()]]);
    this.iris = joint(this.head);
    piece(this.iris, 'glow', [[new THREE.SphereGeometry(0.64, 28, 12, 0, Math.PI * 2, 0, 0.55), '#b45cff', where(0, 0, 0, 1, Math.PI / 2)]]);
    piece(this.iris, 'gloss', [[new THREE.SphereGeometry(0.655, 24, 10, 0, Math.PI * 2, 0, 0.3), '#140a24', where(0, 0, 0, 1, Math.PI / 2)], [ball(0.08, 10, 8), '#ffffff', where(0.14, 0.2, 0.62)]]);
    this.lids = [-1, 1].map((s) => {
      const l = joint(this.head);
      piece(l, 'soft', [[new THREE.SphereGeometry(0.68, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), '#4a3580', where(0, 0, 0, 1, s > 0 ? 0 : Math.PI)]]);
      return { l, s };
    });
    const lash = [];
    for (let i = 0; i < 7; i++) lash.push([cone(0.05, 0.3, 6), '#241a44', along(Math.sin(-0.9 + i * 0.3) * 0.5, 0.5, 0.42, [Math.sin(-0.9 + i * 0.3), 1, 0.7])]);
    piece(this.head, 'plain', lash);
  }

  pose(dt, s) {
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const act = s.state === 'act';
    const gape = s.open ? 0.25 + Math.abs(Math.sin(this.time * 7)) * 0.3 : act ? 1.25 : 0.75 + wind * 0.4;
    const blink = !act && !wind && Math.sin(this.time * 0.9) > 0.97 ? 0.1 : 1;
    for (const { l, s: side } of this.lids) l.rotation.x = ease(l.rotation.x, side * -gape * blink * 0.75, 14, dt);
    this.iris.rotation.x = s.open ? Math.sin(this.time * 5) * 0.4 : 0;
    this.iris.rotation.y = s.open ? Math.cos(this.time * 4) * 0.5 : act ? 0 : Math.sin(this.time * 0.8) * 0.35;
    this.head.position.y = 1.75 + Math.sin(this.time * 2) * 0.06;
    this.iris.scale.setScalar(1 + wind * 0.04);
  }
}

class NightMoth extends Fright {
  constructor() {
    super({ height: 1, radius: 0.52, color: '#6a3fb0' });
    this.fur = joint(this.body, 0, 0.45, 0);
    const fl = [];
    for (let i = 0; i < 14; i++) fl.push([ball(0.14, 10, 8), ['#3a2468', '#4a2f80', '#2d1b54'][i % 3], where(Math.cos(i * 2.4) * 0.17, (i / 14 - 0.5) * 0.5, Math.sin(i * 2.4) * 0.17)]);
    fl.push([ball(0.24, 14, 10), '#4a2f80', where(0, 0.28, 0.1)], ...[-1, 1].map((s) => [cone(0.09, 0.28, 8), '#4a2f80', where(s * 0.14, 0.54, 0.06, 1, 0, 0, -s * 0.25)]));
    piece(this.fur, 'soft', fl);
    piece(this.fur, 'plain', [-1, 1].map((s) => [cone(0.04, 0.14, 6), '#fffaf0', where(s * 0.07, 0.14, 0.3, 1, Math.PI)]));
    this.eyes = eyes(this.fur, { x: 0.12, y: 0.3, z: 0.28, r: 0.1, glow: '#ff5cc0', brow: '#180d30', slope: 0.5 });
    this.wings = [-1, 1].map((s) => {
      const w = joint(this.fur, s * 0.14, 0.12, -0.04);
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.2);
      sh.quadraticCurveTo(0.6, 0.75, 1.25, 0.5);
      sh.quadraticCurveTo(1.05, 0.24, 1.15, 0);
      sh.quadraticCurveTo(0.85, 0.1, 0.75, -0.22);
      sh.quadraticCurveTo(0.5, -0.02, 0.35, -0.3);
      sh.quadraticCurveTo(0.15, -0.1, 0, -0.16);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
      if (s < 0) g.scale(-1, 1, 1);
      if (s < 0) {
        const ix = g.index;
        if (!ix) {
          const p = g.attributes.position.array;
          for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]];
        }
        g.computeVertexNormals();
      }
      piece(w, 'soft', [[g, '#4a2a8a', where()]]);
      return { w, s };
    });
  }

  pose(dt, s) {
    const down = s.open === 'fall' || s.open === 'spent';
    const beat = down ? Math.sin(this.time * 4) * 0.2 + 0.9 : Math.sin(this.time * (s.state === 'wind' ? 26 : 13)) * 0.7;
    for (const { w, s: side } of this.wings) w.rotation.y = -side * beat;
    this.fur.position.y = 0.45 + (down ? -0.2 : Math.sin(this.time * 3) * 0.12);
    this.fur.rotation.x = ease(this.fur.rotation.x, down ? 1.1 : s.state === 'act' ? 0.7 : 0.1, 10, dt);
    this.eyes.mood(Boolean(s.open), s.state === 'wind' ? 1 : 0, this.time);
  }
}

// The Night Mare: a great black horse, her mane and tail of smoke, her eyes and
// hooves alight. A shadow of her (s.more[0] 1) has no light in its hooves.
const COAT = '#1b1330';
// Darker underneath and down the legs, a bloom of violet along her back.
const shade = (lo, hi) => {
  const a = new THREE.Color('#0f0a1e');
  const b = new THREE.Color('#2c1f52');
  const c = new THREE.Color();
  return (x, y) => c.copy(a).lerp(b, Math.max(0, Math.min(1, (y - lo) / (hi - lo))));
};
let mareShapes = null;
// (Sculpted once, however many of her there are.)
function shapesOfMare() {
  mareShapes ??= {
    trunk: sculpted(
      [
        { a: [0, -0.02, -0.5], b: [0, 0.0, 0.42], r: 0.43, r1: 0.45 },
        { a: [0, -0.04, 0.56], r: 0.4, s: [0.95, 1.12, 0.9] },
        { a: [0, 0.1, -0.62], r: 0.44, s: [1.02, 0.98, 1] },
        { a: [0, 0.34, 0.36], b: [0, 0.3, 0.1], r: 0.17, r1: 0.14, k: 0.3 },
        { a: [0, 0.16, 0.62], b: [0, 0.42, 0.78], r: 0.34, r1: 0.28, k: 0.24 },
        ...[-1, 1].flatMap((s) => [
          { a: [s * 0.25, 0.04, 0.5], b: [s * 0.27, -0.34, 0.52], r: 0.25, r1: 0.19 },
          { a: [s * 0.26, 0.04, -0.62], b: [s * 0.28, -0.32, -0.6], r: 0.31, r1: 0.22 },
        ]),
        { a: [0, 0.22, -0.98], r: 0.12, k: 0.2 },
      ],
      { k: 0.2, cell: 0.055, paint: shade(-0.45, 0.5) },
    ),
    neck: sculpted(
      [
        { a: [0, -0.08, -0.06], b: [0, 0.34, 0.2], r: 0.33, r1: 0.25 },
        { a: [0, 0.34, 0.2], b: [0, 0.74, 0.36], r: 0.25, r1: 0.2 },
        { a: [0, 0.74, 0.36], b: [0, 0.96, 0.42], r: 0.2, r1: 0.18 },
        // Its crest.
        { a: [0, 0.16, -0.1], b: [0, 0.62, 0.12], r: 0.15, r1: 0.14 },
        { a: [0, 0.62, 0.12], b: [0, 1.02, 0.32], r: 0.14, r1: 0.1 },
      ],
      { k: 0.16, cell: 0.05, paint: shade(-0.3, 1.1) },
    ),
    head: sculpted(
      [
        { a: [0, 0.03, 0.02], r: 0.2, s: [0.92, 1, 1.05] },
        { a: [0, 0, 0.1], b: [0, -0.2, 0.46], r: 0.19, r1: 0.125 },
        { a: [0, -0.2, 0.46], b: [0, -0.28, 0.6], r: 0.125, r1: 0.12 },
        { a: [0, -0.29, 0.63], r: 0.12, s: [1.02, 0.9, 0.85] },
        { a: [0, -0.16, 0.12], b: [0, -0.34, 0.54], r: 0.12, r1: 0.07 },
        ...[-1, 1].flatMap((s) => [
          { a: [s * 0.1, -0.1, 0.06], r: 0.14, s: [0.8, 1, 1] },
          { a: [s * 0.12, 0.08, 0.18], b: [s * 0.1, 0.02, 0.28], r: 0.06, r1: 0.05, k: 0.08 },
          { a: [s * 0.075, -0.27, 0.69], r: 0.045, k: 0.06 },
          { a: [s * 0.085, -0.27, 0.73], r: 0.032, k: 0.03, cut: true },
        ]),
      ],
      { k: 0.12, cell: 0.032, paint: shade(-0.5, 0.25) },
    ),
    fore: sculpted([{ a: [0, 0.12, 0], b: [0, -0.2, 0.02], r: 0.21, r1: 0.16 }, { a: [0, -0.2, 0.02], b: [0, -0.46, 0.02], r: 0.15, r1: 0.1 }, { a: [0, -0.5, 0.035], r: 0.105 }], { k: 0.1, cell: 0.04, paint: shade(-0.9, 0.6) }),
    hind: sculpted([{ a: [0, 0.14, 0.04], b: [0, -0.2, 0.06], r: 0.28, r1: 0.18 }, { a: [0, -0.2, 0.06], b: [0, -0.46, -0.03], r: 0.17, r1: 0.1 }, { a: [0, -0.5, -0.04], r: 0.115, s: [0.8, 1, 1.15] }], { k: 0.1, cell: 0.04, paint: shade(-0.9, 0.6) }),
    shin: sculpted([{ a: [0, 0.02, 0], b: [0, -0.34, 0], r: 0.085, r1: 0.062 }, { a: [0, -0.38, 0.0], r: 0.085, s: [0.95, 0.95, 1.1] }, { a: [0, -0.38, 0], b: [0, -0.48, 0.05], r: 0.07, r1: 0.08 }], { k: 0.06, cell: 0.03, paint: shade(-1.4, 0.6) }),
  };
  return mareShapes;
}

class Mare extends Fright {
  constructor(kind = 'mare') {
    super({ height: 3.4, radius: 1.35, color: '#4a1f8f' });
    const shapes = shapesOfMare();
    const shape = (parent, g) => {
      const m = new THREE.Mesh(g, finishOf('coat', 'object'));
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.shared = true;
      parent.add(m);
      return m;
    };
    this.shadowy = kind === 'mareshadow';
    const h = joint(this.body);
    this.horse = h;
    h.scale.setScalar(1.45);
    this.trunk = joint(h, 0, 1.35, 0);
    shape(this.trunk, shapes.trunk);
    // Stars in her coat.
    const pos = shapes.trunk.attributes.position;
    const nor = shapes.trunk.attributes.normal;
    const stars = [];
    for (let i = 0; i < 46; i++) {
      const q = Math.floor(((i * 0.618034) % 1) * pos.count);
      if (nor.getY(q) < -0.5) continue;
      const r = 0.009 + ((i * 7) % 5) * 0.0035;
      stars.push([ball(r, 6, 5), ['#cdb8ff', '#ffffff', '#ffc9f0'][i % 3], where(pos.getX(q) + nor.getX(q) * 0.004, pos.getY(q) + nor.getY(q) * 0.004, pos.getZ(q) + nor.getZ(q) * 0.004)]);
    }
    piece(this.trunk, 'glow', stars);
    this.neck = joint(this.trunk, 0, 0.26, 0.66);
    shape(this.neck, shapes.neck);
    this.head = joint(this.neck, 0, 0.98, 0.46);
    shape(this.head, shapes.head);
    // Her ears, pricked; and the fire in her nostrils.
    this.ears = [-1, 1].map((s) => {
      const e = joint(this.head, s * 0.125, 0.16, -0.04);
      e.rotation.set(-0.15, 0, -s * 0.22);
      piece(e, 'coat', [[cone(0.075, 0.22, 14), COAT, where(0, 0.09, 0, [1, 1, 0.6])]]);
      piece(e, 'soft', [[cone(0.045, 0.15, 10), '#5a3a8f', where(0, 0.075, 0.03, [1, 1, 0.5])]]);
      return e;
    });
    piece(this.head, 'glow', [-1, 1].map((s) => [ball(0.022, 8, 6), '#ff5cc0', where(s * 0.083, -0.272, 0.722)]));
    this.eyes = [-1, 1].map((s) => {
      const e = joint(this.head, s * 0.165, 0.05, 0.2);
      e.rotation.set(0.1, s * 0.75, s * 0.3);
      piece(e, 'glow', [[ball(0.075, 18, 12), '#ffd0f4', where(0, 0, 0, [1.15, 0.8, 0.45])]]);
      piece(e, 'gloss', [[ball(0.03, 10, 8), '#3a0a4a', where(0, -0.004, 0.026, [0.6, 1.5, 0.5])]]);
      return e;
    });
    const hot = this.shadowy ? '#8f8fd0' : '#e08cff';
    const cold = this.shadowy ? '#1d1a3a' : '#3a148a';
    this.plumes = [];
    const plume = (parent, points, opt) => {
      const p = new Plume(points, { hot, cold, ...opt });
      parent.add(p.mesh);
      this.plumes.push(p);
      return p;
    };
    plume(this.neck, [[0, 1.16, 0.34], [0, 0.98, 0.14], [0, 0.66, 0.02], [0, 0.3, -0.16], [0, 0.08, -0.3]], { n: 70, size: 0.26, drift: [0, 0.16, -0.62], spread: 0.06 });
    plume(this.head, [[0, 0.24, 0.0], [0, 0.16, 0.2]], { n: 12, size: 0.16, drift: [0, 0.2, -0.3], spread: 0.04 });
    this.tail = joint(this.trunk, 0, 0.26, -1.0);
    plume(this.tail, [[0, 0.04, 0], [0, 0.04, -0.2], [0, -0.14, -0.42], [0, -0.44, -0.56]], { n: 54, size: 0.28, drift: [0, -0.22, -0.6], spread: 0.07 });
    this.hooves = [];
    this.legs = [[-0.25, 0.54], [0.25, 0.54], [-0.26, -0.62], [0.26, -0.62]].map(([x, z], i) => {
      const l = joint(h, x, 1.15, z);
      shape(l, i < 2 ? shapes.fore : shapes.hind);
      const k = joint(l, 0, -0.5, i < 2 ? 0.03 : -0.04);
      shape(k, shapes.shin);
      const hoof = piece(k, 'glow', [[rod(0.135, 0.095, 0.13, 18), '#c05cff', where(0, -0.555, 0.06)]]);
      const dull = piece(k, 'gloss', [[rod(0.135, 0.095, 0.13, 18), '#2a1d44', where(0, -0.555, 0.06)]]);
      plume(k, [[0, -0.5, 0.04], [0, -0.4, 0]], { n: 12, size: 0.15, drift: [0, 0.22, -0.26], spread: 0.07, hot: this.shadowy ? hot : '#ff8ce0' });
      this.hooves.push({ hoof, dull });
      return { l, k, i };
    });
    this.stream = 1;
  }

  pose(dt, s) {
    const shadow = this.shadowy || (s.more?.[0] ?? 0) === 1;
    for (const { hoof, dull } of this.hooves) {
      hoof.visible = !shadow;
      dull.visible = shadow;
    }
    // Asleep at last, her nose by the night-light (shared/isle-story.js): lit by
    // nothing else.
    if (s.state === 'sleep') {
      for (const { l, k, i } of this.legs) {
        const front = i < 2;
        l.position.y = ease(l.position.y, front ? 0.3 : 0.36, 3, dt);
        l.rotation.x = ease(l.rotation.x, front ? -1.42 : -1.15, 3, dt);
        k.rotation.x = ease(k.rotation.x, front ? 0.1 : 2.2, 3, dt);
      }
      this.trunk.rotation.x = ease(this.trunk.rotation.x, 0, 3, dt);
      this.trunk.position.y = ease(this.trunk.position.y, 0.36 + Math.sin(this.time * 1.4) * 0.02, 3, dt);
      this.neck.rotation.x = ease(this.neck.rotation.x, 1.32, 2.4, dt);
      this.head.rotation.x = ease(this.head.rotation.x, -0.62, 2.4, dt);
      for (const e of this.eyes) e.scale.set(1, 0.08, 1);
      for (const e of this.ears) e.rotation.x = ease(e.rotation.x, -0.7, 2, dt);
      for (const { hoof, dull } of this.hooves) {
        hoof.visible = false;
        dull.visible = true;
      }
      this.stream = ease(this.stream, 0.3, 2, dt);
      for (const [i, p] of this.plumes.entries()) p.update(this.time * 0.45, i < 3 ? 0.9 : 0.02, this.stream);
      return;
    }
    const act = s.state === 'act';
    const wind = s.state === 'wind' ? (s.k ?? 0) : 0;
    const gallop = act || s.speed > 4;
    const rate = gallop ? 2.2 : 1.2;
    const stamp = s.kind === 'wave' && wind;
    for (const { l, k, i } of this.legs) {
      const a = this.step * rate + [0, 0.7, Math.PI, Math.PI + 0.7][i];
      const amp = s.open ? 0 : Math.min(1.05, 0.1 + (s.speed ?? 0) * 0.12);
      l.position.y = ease(l.position.y, 1.15, 12, dt);
      l.rotation.x = ease(l.rotation.x, stamp && i < 2 ? -1.2 * wind : Math.sin(a) * amp, 18, dt);
      k.rotation.x = ease(k.rotation.x, stamp && i < 2 ? 1.4 * wind : Math.max(0, Math.cos(a)) * amp * 1.2, 18, dt);
    }
    this.trunk.rotation.x = ease(this.trunk.rotation.x, stamp ? -0.5 * wind : gallop ? Math.sin(this.step * rate) * 0.1 : 0, 12, dt);
    this.trunk.position.y = ease(this.trunk.position.y, s.open ? 1.1 : 1.35 + (gallop ? Math.abs(Math.sin(this.step * rate)) * 0.14 : 0) + (stamp ? wind * 0.4 : 0), 12, dt);
    this.neck.rotation.x = ease(this.neck.rotation.x, s.open ? 0.7 : act ? 0.5 : wind ? -0.35 * wind : 0.12 + Math.sin(this.time * 1.5) * 0.06, 10, dt);
    this.head.rotation.x = ease(this.head.rotation.x, s.open ? 0.4 : act ? -0.15 : 0.16, 10, dt);
    this.head.rotation.z = s.open ? Math.sin(this.time * 7) * 0.16 : 0;
    for (const [i, e] of this.ears.entries()) e.rotation.x = ease(e.rotation.x, act || wind ? -0.75 : s.open ? 0.5 : -0.15 + Math.sin(this.time * 2.3 + i * 2) * 0.12, 8, dt);
    for (const e of this.eyes) e.scale.set(1, s.open ? 0.25 : 1 + wind * 0.4, 1);
    this.tail.rotation.x = Math.sin(this.time * 2) * 0.15 + (gallop ? 0.55 : 0);
    this.stream = ease(this.stream, gallop ? 1.9 : 1, 4, dt);
    // Quite dark: only her eyes (and hooves) to be seen.
    const hide = (s.more?.[1] ?? 0) === 1 && !s.open;
    for (const p of this.plumes) p.update(this.time, hide ? 0 : 1 + wind * 0.3, this.stream);
    if (hide !== this.hidden) {
      this.hidden = hide;
      const smoke = new Set(this.plumes.map((p) => p.mesh));
      this.horse.traverse((o) => {
        if (o.isMesh && !smoke.has(o)) o.visible = !hide || this.eyes.some((e) => e === o.parent) || this.hooves.some((q) => q.hoof === o && !shadow);
      });
    }
  }

  dispose() {
    for (const p of this.plumes) p.dispose();
    // (Her sculpted shapes are shared by every one of her.)
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.group.traverse((o) => {
      if (o.isMesh && !o.userData.shared) o.geometry.dispose();
    });
  }
}

addFrightModels({ inkling: Inkling, twin: Twin, grabber: Grabber, watcher: Watcher, nightmoth: NightMoth, mare: Mare, mareshadow: Mare });
