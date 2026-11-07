// The captains of the later chapters of Adventure Isle's story (shared/
// isle-story.js, shared/bosses.js), each a creature of its own, built at its
// full size, on its feet (or hovering) at y = 0 and facing +z, its eyes aglow
// at night, as the beasts are (beast-kit.js):
//
// - Sir Scarabold, of Sunscorch Dunes: a great golden scarab in polished
//   armour, a curved horn on his nose and a red plume on his helmet, six legs
//   scuttling. His wing cases open as he flies up to come down on you.
// - Old Glimmershell, of the Crystal Caverns: an ancient tortoise, his high
//   shell grown over with glowing crystals, a long white beard and sleepy
//   eyes. He pulls in his head and legs to spin along in his shell.
// - Baron Boo, of Haunted Hollow: a tall ghost in a top hat and a purple cape,
//   with a curly moustache and a Star Shard for a monocle, floating over the
//   ground. He fades away to blink somewhere else.
// - Big Sprocket, of Cogwheel City: a wind-up tin giant, a great key turning
//   in his back, a gear glowing in the window of his chest, a funnel on his
//   head and pincers for hands.
// - Old Nimbus, of the Stormcloud Spires: a great grumpy thundercloud with a
//   face, lightning crackling at his sides, drifting along over the ground.
//
// makeBoss (boss-models.js) gives each the parts every boss has: its bubble,
// its stomp ring, what it holds up to throw, and its poses for its moves.
import * as THREE from '../../vendor/three.module.js';
import { Beast, crossEye, DARK, ease, group, joint, limb, moving, pace } from './beast-kit.js';
import { capsule, cone, cylinder, lathe, mesh, roundedBox, sphere, toon, torus } from './toon.js';

// Half a sphere, the open side down; and a quarter of one, for a wing case.
const DOME = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const HALF_DOME = new THREE.SphereGeometry(1, 16, 12, 0, Math.PI, 0, Math.PI / 2);
const OCTA = new THREE.OctahedronGeometry(1, 0);
// Baron Boo's cape: round his back only, from his shoulders down.
const CAPE = new THREE.LatheGeometry([[0.62, 1.72], [0.88, 1.4], [0.98, 0.7], [1.0, 0.35], [0.92, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 20, Math.PI / 2 + 0.25, Math.PI - 0.5);

// A zigzag of lightning, as tall as h, in its own group, standing up +y.
function bolt(mat, h = 0.6, w = 0.12) {
  const g = new THREE.Group();
  const pts = [[0, 0], [w, h * 0.35], [-w * 0.2, h * 0.45], [w * 0.6, h]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const seg = mesh(cylinder(0.035, 0.035, len, 6), mat, (x0 + x1) / 2, (y0 + y1) / 2, 0);
    seg.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
    g.add(seg);
  }
  return g;
}

// ---------------------------------------------------------------- Sir Scarabold

export class ScarabModel extends Beast {
  constructor() {
    super({ height: 1.7, center: 0.85, pick: 1.2, radius: 1.2, glow: '#fff27a' });
    const gold = toon('#e5b52e');
    const deep = toon('#a8741c');
    const bronze = toon('#5a3a1c');
    const b = this.body;
    // His belly, and his wing cases, two halves of a great gold dome with a
    // seam down the middle; under them, his thin wings.
    b.add(mesh(sphere(1, 22, 14), bronze, 0, 0.5, -0.1, 0.92, 0.36, 1.05));
    this.cases = [];
    this.wings = [];
    for (const side of [-1, 1]) {
      const hinge = group(b, 0, 0.62, -0.1);
      const half = mesh(HALF_DOME, gold, 0, 0, 0, 0.98, 0.95, 1.12);
      half.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      hinge.add(half);
      // Bumps along each case, polished.
      for (const [y, z] of [[0.62, 0.35], [0.7, -0.15], [0.55, -0.6]]) hinge.add(mesh(sphere(1, 10, 8), toon('#ffd75a'), side * 0.42, y, z, 0.13, 0.08, 0.16));
      hinge.userData.side = side;
      this.cases.push(hinge);
      const wing = mesh(sphere(1, 14, 8), toon('#cfe8ff', { transparent: true, opacity: 0.45 }), side * 0.55, 0.7, -0.4, 0.55, 0.03, 0.9);
      wing.visible = false;
      b.add(wing);
      this.wings.push(wing);
    }
    b.add(mesh(cylinder(0.025, 0.025, 2.0, 6), toon('#7a4f12'), 0, 1.5, -0.1).rotateX(Math.PI / 2));
    // His armoured front, a helmet of a head with a horn on its nose and a
    // red plume over it.
    b.add(mesh(sphere(1, 20, 14), deep, 0, 0.72, 0.85, 0.74, 0.44, 0.42));
    const head = group(b, 0, 0.62, 1.2);
    this.head = head;
    head.add(mesh(sphere(1, 20, 14), gold, 0, 0, 0, 0.5, 0.38, 0.36));
    head.add(mesh(torus(0.42, 0.04), deep, 0, 0.05, 0.08, 1, 0.72, 1).rotateX(0.2));
    const horn = mesh(cone(0.13, 0.75, 12), gold, 0, 0.42, 0.36);
    horn.rotation.x = 0.55;
    head.add(horn);
    head.add(mesh(sphere(1, 10, 8), toon('#ffe680', { emissive: 0.3 }), 0, 0.74, 0.55, 0.07));
    for (let i = 0; i < 5; i++) head.add(mesh(sphere(1, 10, 8), toon('#e0342a'), 0, 0.42 + i * 0.07, -0.15 - i * 0.1, 0.13 - i * 0.012));
    crossEye(this, head, -1, -0.22, 0.04, 0.28, { w: 0.11 });
    crossEye(this, head, 1, 0.22, 0.04, 0.28, { w: 0.11 });
    this.mouth = mesh(sphere(1, 12, 8), toon('#3a1f3f'), 0, -0.2, 0.32, 0.16, 0.025, 0.05);
    head.add(this.mouth);
    for (const side of [-1, 1]) {
      const jaw = mesh(cone(0.06, 0.26, 8), bronze, side * 0.16, -0.22, 0.4);
      jaw.rotation.set(Math.PI / 2, 0, -side * 0.5);
      head.add(jaw);
      // Feelers with clubs on the end.
      const feeler = group(head, side * 0.2, 0.2, 0.25);
      limb(feeler, [0, 0, 0], [side * 0.2, 0.3, 0.25], 0.02, 0.02, bronze, 6);
      joint(feeler, [side * 0.2, 0.3, 0.25], 0.06, bronze);
    }
    // Six legs, three a side, scuttling.
    this.legs = [];
    for (const side of [-1, 1]) {
      for (const [i, z] of [0.65, 0.05, -0.55].entries()) {
        const l = group(b, side * 0.75, 0.42, z);
        l.userData.side = side;
        l.userData.i = i;
        limb(l, [0, 0, 0], [side * 0.45, 0.2, 0], 0.07, 0.06, bronze, 8);
        joint(l, [side * 0.45, 0.2, 0], 0.08, deep);
        limb(l, [side * 0.45, 0.2, 0], [side * 0.7, -0.42, (1 - i) * 0.15], 0.06, 0.035, bronze, 8);
        this.legs.push(l);
      }
    }
    this.open = 0;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.45;
    this.body.scale.set(1 + this.squash * 0.2, sy, 1 + this.squash * 0.2);
    this.body.rotation.set(state === 'charge' ? 0.12 : 0, 0, state === 'giggle' ? Math.sin(t * 20) * 0.08 : state === 'dazed' ? Math.sin(t * 5) * 0.08 : 0);
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 10, 18);
    for (const l of this.legs) {
      const phase = l.userData.i * 2.1 + (l.userData.side > 0 ? Math.PI : 0);
      l.rotation.x = go ? Math.sin(t * speed + phase) * 0.35 : 0;
      l.rotation.z = go ? l.userData.side * Math.max(0, Math.cos(t * speed + phase)) * 0.18 : 0;
    }
    // Up in the air (or crouched to fly), the wing cases open and the wings buzz.
    const flying = state === 'leap' || air > 0.3;
    this.open = ease(this.open, flying ? 1 : 0, 10, dt);
    for (const c of this.cases) c.rotation.z = c.userData.side * this.open * 0.9;
    for (const [i, w] of this.wings.entries()) {
      w.visible = this.open > 0.2;
      w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(t * 60) * 0.35);
    }
    this.head.rotation.x = state === 'rear' ? -0.25 : state === 'charge' ? 0.3 : Math.sin(t * 1.6) * 0.04;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Old Glimmershell

export class TortoiseModel extends Beast {
  constructor() {
    super({ height: 1.9, center: 0.9, pick: 1.25, radius: 1.3, glow: '#bff6ff' });
    const skin = toon('#7f9a6a');
    const dark = toon('#55704a');
    const shell = toon('#3e5f58');
    const plate = toon('#5a8277');
    const b = this.body;
    // His high shell, its plates, a rim round it, and the crystals grown out of it.
    this.shell = group(b, 0, 0.45, -0.05);
    const s = this.shell;
    s.add(mesh(DOME, shell, 0, 0, 0, 1.18, 1.05, 1.3));
    s.add(mesh(torus(1, 0.09), toon('#2f4a44'), 0, 0.02, 0, 1.2, 1.32, 1).rotateX(Math.PI / 2));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.62;
      const el = i === 0 ? 0.95 : 0.55;
      s.add(mesh(sphere(1, 12, 8), plate, Math.sin(a) * r, el, Math.cos(a) * r * 1.1, 0.32, 0.12, 0.32));
    }
    const crystals = [toon('#b98cff', { emissive: 0.75, transparent: true, opacity: 0.9 }), toon('#7fe8ff', { emissive: 0.75, transparent: true, opacity: 0.9 }), toon('#ff9ad4', { emissive: 0.7, transparent: true, opacity: 0.9 })];
    this.crystals = [];
    for (const [x, y, z, h, tx, tz, k] of [[0, 1.0, 0.05, 0.75, 0, 0, 0], [0.42, 0.85, 0.35, 0.55, 0.35, 0.3, 1], [-0.45, 0.82, 0.25, 0.5, -0.35, 0.25, 2], [0.38, 0.8, -0.5, 0.5, 0.35, -0.35, 0], [-0.4, 0.78, -0.45, 0.6, -0.3, -0.4, 1], [0, 0.85, -0.65, 0.45, 0, -0.5, 2], [0.75, 0.45, -0.1, 0.35, 0.8, 0, 1]]) {
      const c = mesh(OCTA, crystals[k], x, y + h * 0.5, z, 0.16, h, 0.16);
      c.rotation.set(tz, 0, -tx);
      s.add(c);
      this.crystals.push(c);
    }
    // Four stubby legs, toes on each.
    this.legs = [];
    for (const [x, z] of [[-0.85, 0.65], [0.85, 0.65], [-0.85, -0.7], [0.85, -0.7]]) {
      const l = group(b, x, 0.45, z);
      l.add(mesh(cylinder(0.26, 0.3, 0.5, 14), skin, 0, -0.2, 0));
      for (const o of [-0.12, 0, 0.12]) l.add(mesh(sphere(1, 8, 6), toon('#e8e2c8'), o, -0.43, 0.24, 0.07, 0.05, 0.06));
      l.userData.x = x;
      l.userData.z = z;
      this.legs.push(l);
    }
    b.add(mesh(cone(0.14, 0.35, 10), skin, 0, 0.5, -1.35).rotateX(-Math.PI / 2 - 0.4));
    // His old head on a long wrinkly neck: sleepy eyes under bushy white brows,
    // and a long white beard.
    this.neck = group(b, 0, 0.75, 1.05);
    const n = this.neck;
    n.add(mesh(capsule(0.24, 0.35, 6, 14), skin, 0, 0.05, 0.12).rotateX(1.1));
    for (let i = 0; i < 3; i++) n.add(mesh(torus(0.25, 0.025), dark, 0, 0.02 + i * 0.08, 0.05 + i * 0.1, 1, 1, 1).rotateX(1.1));
    const head = group(n, 0, 0.3, 0.42);
    this.head = head;
    head.add(mesh(sphere(1, 20, 14), skin, 0, 0, 0, 0.36, 0.3, 0.42));
    head.add(mesh(sphere(1, 10, 8), dark, 0, 0.0, 0.4, 0.06, 0.035, 0.03));
    crossEye(this, head, -1, -0.17, 0.1, 0.3, { w: 0.08, brow: '#ffffff', slope: 0.3 });
    crossEye(this, head, 1, 0.17, 0.1, 0.3, { w: 0.08, brow: '#ffffff', slope: 0.3 });
    // Heavy lids, half down: he is very old and very sleepy.
    this.lids = [];
    for (const side of [-1, 1]) {
      const lid = mesh(sphere(1, 12, 8), skin, side * 0.17, 0.15, 0.31, 0.095, 0.06, 0.06);
      head.add(lid);
      this.lids.push(lid);
    }
    this.mouth = mesh(sphere(1, 12, 8), toon('#3a1f3f'), 0, -0.1, 0.36, 0.14, 0.025, 0.05);
    head.add(this.mouth);
    const beard = mesh(cone(0.16, 0.5, 12), toon('#ffffff'), 0, -0.36, 0.28);
    beard.rotation.x = Math.PI - 0.25;
    head.add(beard);
    this.spin = 0;
    this.tuck = 0;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.4;
    this.body.scale.set(1 + this.squash * 0.15, sy, 1 + this.squash * 0.15);
    // Charging, he pulls in his head and legs and spins along in his shell.
    const inShell = state === 'charge' || state === 'rear';
    this.tuck = ease(this.tuck, inShell ? 1 : 0, 9, dt);
    this.spin = state === 'charge' ? this.spin + dt * 16 : ease(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2, 4, dt);
    this.body.rotation.set(0, this.spin, state === 'dazed' ? Math.sin(t * 4) * 0.06 : 0);
    this.neck.scale.setScalar(Math.max(0.01, 1 - this.tuck * 0.95));
    this.neck.position.z = 1.05 - this.tuck * 0.5;
    const go = moving(state) && air < 0.2 && !inShell;
    const speed = pace(state, 5, 8);
    for (const [i, l] of this.legs.entries()) {
      l.scale.y = Math.max(0.05, 1 - this.tuck * 0.9);
      l.rotation.x = go ? Math.sin(t * speed + (i % 3 ? Math.PI : 0)) * 0.3 : 0;
    }
    this.head.rotation.x = state === 'stomp' ? -0.3 : Math.sin(t * 0.8) * 0.06;
    for (const lid of this.lids) lid.position.y = state === 'chase' || state === 'stomp' || state === 'hurl' ? 0.2 : 0.15;
    // The crystals glow brighter as he throws them.
    const glow = state === 'hurl' ? 1.3 : 0.75 + Math.sin(t * 2) * 0.1;
    for (const c of this.crystals) c.material.emissiveIntensity = glow;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Baron Boo

export class BaronModel extends Beast {
  constructor() {
    super({ height: 2.4, center: 1.3, pick: 1.1, radius: 1.0, glow: '#b8ffea', white: '#ffffff' });
    const sheet = toon('#eef1ff', { transparent: true, opacity: 0.9 });
    const cape = toon('#5b2d82', { side: THREE.DoubleSide });
    const b = this.body;
    this.float = group(b, 0, 0.35, 0);
    const f = this.float;
    // A sheet of a body, round on top and wavy round its hem.
    f.add(mesh(lathe([[0, 2.05], [0.42, 1.98], [0.7, 1.7], [0.82, 1.2], [0.86, 0.6], [0.95, 0.15], [0.7, 0.05], [0.5, 0.18], [0.3, 0.06], [0, 0.12]], 28), sheet));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      f.add(mesh(sphere(1, 10, 8), sheet, Math.sin(a) * 0.82, 0.08, Math.cos(a) * 0.82, 0.2, 0.14, 0.2));
    }
    // A cape over his shoulders, a high collar and a red bow tie.
    f.add(mesh(CAPE, cape));
    f.add(mesh(torus(0.6, 0.08), cape, 0, 1.72, 0, 1, 1, 0.6).rotateX(Math.PI / 2));
    for (const side of [-1, 1]) {
      const bow = mesh(cone(0.09, 0.18, 10), toon('#d6372f'), side * 0.1, 1.02, 0.86);
      bow.rotation.z = side * Math.PI / 2;
      f.add(bow);
    }
    f.add(mesh(sphere(1, 8, 6), toon('#d6372f'), 0, 1.02, 0.88, 0.05));
    // Two little arms, waving.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = group(f, side * 0.78, 1.15, 0.15);
      arm.add(mesh(capsule(0.12, 0.42, 6, 10), sheet, side * 0.2, -0.15, 0.1).rotateZ(side * 0.9));
      arm.userData.side = side;
      this.arms.push(arm);
    }
    // His face: big eyes, a monocle with a Star Shard for its glass, a curly
    // moustache and a wide mouth.
    crossEye(this, f, -1, -0.24, 1.62, 0.72, { w: 0.13, brow: '#3a2f55', slope: 0.3 });
    crossEye(this, f, 1, 0.24, 1.62, 0.72, { w: 0.13, brow: '#3a2f55', slope: 0.3 });
    f.add(mesh(torus(0.16, 0.025), toon('#ffcc33', { emissive: 0.3 }), 0.24, 1.62, 0.8));
    f.add(mesh(sphere(1, 12, 8), toon('#ffe680', { emissive: 0.8, transparent: true, opacity: 0.55 }), 0.24, 1.62, 0.79, 0.15, 0.15, 0.03));
    f.add(mesh(cylinder(0.008, 0.008, 0.6, 4), toon('#ffcc33'), 0.38, 1.35, 0.8).rotateZ(0.2));
    for (const side of [-1, 1]) {
      const curl = mesh(torus(0.11, 0.035, Math.PI * 1.4), toon('#3a2f55'), side * 0.13, 1.37, 0.86);
      curl.rotation.set(0, side > 0 ? 0 : Math.PI, side > 0 ? 2.2 : 2.2);
      f.add(curl);
    }
    this.mouth = mesh(sphere(1, 14, 8), toon('#2b1f3f'), 0, 1.24, 0.84, 0.18, 0.03, 0.04);
    f.add(this.mouth);
    // His top hat, tipped a little, with a purple band.
    const hat = group(f, 0, 2.0, -0.02);
    hat.rotation.z = -0.12;
    hat.add(mesh(cylinder(0.55, 0.55, 0.05, 24), toon('#1f1b24'), 0, 0, 0));
    hat.add(mesh(cylinder(0.36, 0.38, 0.62, 24), toon('#1f1b24'), 0, 0.33, 0));
    hat.add(mesh(cylinder(0.385, 0.385, 0.12, 24), toon('#8a4fd6'), 0, 0.1, 0));
    this.hat = hat;
    this.fade = 1;
    this.sheet = sheet;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    // Floating, bobbing, and leaning into a chase.
    this.float.position.y = 0.35 + Math.sin(t * 2.2) * 0.12;
    const sy = 1 - this.squash * 0.35;
    this.body.scale.set(1 + this.squash * 0.15, sy, 1 + this.squash * 0.15);
    this.body.rotation.set(state === 'chase' ? 0.12 : 0, 0, state === 'giggle' ? Math.sin(t * 16) * 0.1 : state === 'dazed' ? Math.sin(t * 3) * 0.12 : Math.sin(t * 1.3) * 0.04);
    for (const a of this.arms) a.rotation.z = a.userData.side * (state === 'hurl' ? -1.4 : Math.sin(t * 3 + a.userData.side) * 0.3);
    this.hat.position.y = 2.0 + (state === 'giggle' ? Math.abs(Math.sin(t * 10)) * 0.25 : 0);
    // Fading away as he blinks off somewhere else.
    this.fade = ease(this.fade, state === 'blink' ? 0.05 : 1, 7, dt);
    this.float.scale.setScalar(0.4 + 0.6 * this.fade);
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Big Sprocket

export class SprocketModel extends Beast {
  constructor() {
    super({ height: 2.7, center: 1.35, pick: 1.3, radius: 1.15, glow: '#7ff2ff' });
    const tin = toon('#d8473a');
    const steel = toon('#b9c2cc');
    const dark = toon('#4a5260');
    const brass = toon('#e0a83a');
    const b = this.body;
    // Two stout legs on flat feet.
    this.legs = [];
    for (const side of [-1, 1]) {
      const l = group(b, side * 0.42, 0.95, 0);
      l.add(mesh(cylinder(0.2, 0.24, 0.75, 14), steel, 0, -0.42, 0));
      for (let i = 0; i < 3; i++) l.add(mesh(torus(0.22, 0.03), dark, 0, -0.2 - i * 0.2, 0).rotateX(Math.PI / 2));
      l.add(mesh(roundedBox(0.5, 0.18, 0.7, 0.06), dark, 0, -0.86, 0.1));
      l.userData.side = side;
      this.legs.push(l);
    }
    // His tin chest, riveted, with a round window: a gear glowing inside.
    this.trunk = group(b, 0, 1.0, 0);
    const t = this.trunk;
    t.add(mesh(roundedBox(1.5, 1.05, 1.05, 0.18), tin, 0, 0.55, 0));
    t.add(mesh(roundedBox(1.56, 0.12, 1.1, 0.05), brass, 0, 0.06, 0));
    for (const x of [-0.62, 0.62]) for (const y of [0.2, 0.55, 0.9]) t.add(mesh(sphere(1, 8, 6), brass, x, y, 0.53, 0.035));
    t.add(mesh(torus(0.26, 0.05), brass, 0, 0.6, 0.53));
    t.add(mesh(cylinder(0.25, 0.25, 0.02, 20), toon('#1d2833'), 0, 0.6, 0.52).rotateX(Math.PI / 2));
    this.gear = group(t, 0, 0.6, 0.54);
    const glow = toon('#ffd75a', { emissive: 0.9 });
    this.gear.add(mesh(cylinder(0.12, 0.12, 0.03, 16), glow, 0, 0, 0).rotateX(Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.gear.add(mesh(roundedBox(0.06, 0.06, 0.03, 0.01), glow, Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0));
    }
    // The great key in his back, turning.
    this.key = group(t, 0, 0.6, -0.55);
    const k = this.key;
    k.add(mesh(cylinder(0.06, 0.06, 0.35, 10), brass, 0, 0, -0.17).rotateX(Math.PI / 2));
    for (const side of [-1, 1]) k.add(mesh(torus(0.22, 0.06), brass, side * 0.3, 0, -0.38).rotateY(Math.PI / 2));
    // Arms on ball joints, with pincers for hands.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = group(t, side * 0.85, 0.85, 0);
      joint(arm, [0, 0, 0], 0.17, brass);
      arm.add(mesh(cylinder(0.11, 0.11, 0.7, 12), steel, 0, -0.38, 0));
      const hand = group(arm, 0, -0.78, 0.05);
      joint(hand, [0, 0.05, 0], 0.12, dark);
      for (const s of [-1, 1]) {
        const claw = mesh(torus(0.13, 0.04, Math.PI), dark, 0, -0.12, s * 0.02);
        claw.rotation.set(0, Math.PI / 2, s > 0 ? Math.PI / 2 : -Math.PI / 2);
        hand.add(claw);
      }
      arm.userData.side = side;
      this.arms.push(arm);
    }
    // His head: a silver box with round glowing eyes, a grille of a mouth, an
    // antenna with a light on top and a funnel that puffs.
    this.head = group(t, 0, 1.08, 0.05);
    const h = this.head;
    h.add(mesh(roundedBox(0.95, 0.7, 0.8, 0.14), steel, 0, 0.35, 0));
    crossEye(this, h, -1, -0.22, 0.42, 0.4, { w: 0.13, brow: '#2b2f38', slope: 0.35 });
    crossEye(this, h, 1, 0.22, 0.42, 0.4, { w: 0.13, brow: '#2b2f38', slope: 0.35 });
    this.mouth = mesh(sphere(1, 12, 8), toon('#1d2833'), 0, 0.15, 0.4, 0.22, 0.025, 0.04);
    h.add(this.mouth);
    for (const x of [-0.12, 0, 0.12]) h.add(mesh(roundedBox(0.03, 0.08, 0.02, 0.01), steel, x, 0.15, 0.43));
    h.add(mesh(cylinder(0.02, 0.02, 0.35, 6), dark, 0.25, 0.85, 0));
    this.bulb = mesh(sphere(1, 10, 8), toon('#ff4f4f', { emissive: 0.9 }), 0.25, 1.05, 0, 0.07);
    h.add(this.bulb);
    h.add(mesh(cylinder(0.16, 0.11, 0.35, 14), toon('#2b2f38'), -0.2, 0.85, -0.15));
    for (const side of [-1, 1]) h.add(mesh(cylinder(0.1, 0.1, 0.06, 12), brass, side * 0.5, 0.38, 0).rotateZ(Math.PI / 2));
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.4;
    this.body.scale.set(1 + this.squash * 0.15, sy, 1 + this.squash * 0.15);
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 6, 10);
    this.body.rotation.set(state === 'charge' ? 0.18 : 0, 0, state === 'dazed' ? Math.sin(t * 4) * 0.1 : go ? Math.sin(t * speed) * 0.05 : 0);
    for (const l of this.legs) l.rotation.x = go ? Math.sin(t * speed + (l.userData.side > 0 ? Math.PI : 0)) * 0.45 : 0;
    for (const a of this.arms) a.rotation.x = state === 'hurl' ? -2.4 : state === 'charge' ? -1.3 : go ? Math.sin(t * speed + (a.userData.side > 0 ? 0 : Math.PI)) * 0.5 : Math.sin(t * 1.5) * 0.08;
    // The key turns all the while, quicker the crosser he is.
    this.key.rotation.z += dt * (state === 'chase' || state === 'charge' ? 7 : 2);
    this.gear.rotation.z -= dt * (state === 'charge' ? 12 : 3);
    this.bulb.visible = Math.sin(t * 6) > -0.3;
    this.head.rotation.y = state === 'dazed' ? Math.sin(t * 8) * 0.3 : 0;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Old Nimbus

export class CloudModel extends Beast {
  constructor() {
    super({ height: 2.5, center: 1.4, pick: 1.3, radius: 1.2, glow: '#fff27a', white: '#ffffff' });
    const white = toon('#f3f6fb');
    const grey = toon('#9aa5b8');
    const dark = toon('#6b7488');
    const b = this.body;
    this.float = group(b, 0, 0, 0);
    const f = this.float;
    // A great heap of cloud, darker underneath.
    for (const [x, y, z, r, mat] of [[0, 1.55, 0, 0.95, white], [-0.75, 1.35, 0.1, 0.65, white], [0.75, 1.35, 0.1, 0.65, white], [-0.35, 2.05, -0.1, 0.6, white], [0.4, 2.0, -0.05, 0.62, white], [0, 1.0, 0, 0.85, grey], [-0.9, 1.0, -0.1, 0.5, grey], [0.9, 1.0, -0.1, 0.5, grey], [0, 0.75, -0.2, 0.6, dark], [0, 1.6, -0.6, 0.7, white]]) {
      f.add(mesh(sphere(1, 18, 12), mat, x, y, z, r));
    }
    // Lightning crackling at his sides.
    this.bolts = [];
    const zap = toon('#ffe14d', { emissive: 1 });
    for (const side of [-1, 1]) {
      const g = bolt(zap, 0.9, 0.16);
      g.position.set(side * 1.25, 0.75, 0.2);
      g.rotation.z = side * 0.5;
      f.add(g);
      this.bolts.push(g);
    }
    // A grumpy face: cross eyes, puffed cheeks, a frown.
    crossEye(this, f, -1, -0.32, 1.65, 0.86, { w: 0.15, slope: 0.55 });
    crossEye(this, f, 1, 0.32, 1.65, 0.86, { w: 0.15, slope: 0.55 });
    for (const side of [-1, 1]) f.add(mesh(sphere(1, 10, 8), toon('#c6d2ea'), side * 0.55, 1.35, 0.78, 0.2, 0.15, 0.1));
    this.frown = mesh(torus(0.18, 0.04, Math.PI), toon(DARK), 0, 1.2, 0.92);
    f.add(this.frown);
    this.mouth = mesh(sphere(1, 12, 8), toon(DARK), 0, 1.16, 0.9, 0.16, 0.025, 0.04);
    f.add(this.mouth);
    // Little rain falling under him.
    this.rain = [];
    const drop = toon('#8fc9ff', { transparent: true, opacity: 0.8 });
    for (let i = 0; i < 10; i++) {
      const d = mesh(capsule(0.025, 0.12, 3, 6), drop, (i % 5) * 0.3 - 0.6, 0.5, Math.floor(i / 5) * 0.4 - 0.2);
      f.add(d);
      this.rain.push(d);
    }
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    this.float.position.y = Math.sin(t * 1.8) * 0.12;
    const puff = state === 'puff' ? 1.12 + Math.sin(t * 24) * 0.03 : 1 + Math.sin(t * 1.2) * 0.03;
    this.body.scale.set(puff * (1 + this.squash * 0.2), 1 - this.squash * 0.3, puff * (1 + this.squash * 0.2));
    this.body.rotation.set(state === 'chase' ? 0.1 : 0, 0, state === 'dazed' ? Math.sin(t * 3) * 0.12 : Math.sin(t * 0.9) * 0.05);
    // The lightning crackles, wildly as he calls it down.
    const crackle = state === 'hurl' || state === 'chase';
    for (const [i, g] of this.bolts.entries()) {
      g.visible = crackle ? Math.sin(t * 40 + i) > -0.6 : Math.sin(t * 3 + i * 2) > 0.2;
      g.rotation.y = Math.sin(t * 9 + i) * 0.4;
    }
    for (const [i, d] of this.rain.entries()) d.position.y = 0.6 - ((t * 2.2 + i * 0.37) % 1) * 0.6;
    this.frown.rotation.z = state === 'giggle' ? Math.PI : 0;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}
