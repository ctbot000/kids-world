// The animal friends as little models: bunnies that hop, chicks that peck,
// fluffy sheep, ducks that paddle about, butterflies that flutter, birds,
// owls, bees and seagulls.
import * as THREE from '../../vendor/three.module.js';
import { capsule, cone, cylinder, mesh, onSurface, sphere, toon } from './toon.js';

const BLACK = '#2b2530';
const WHITE = '#ffffff';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const Z = new THREE.Vector3(0, 0, 1);

// Turns a flat part placed at p on an ellipsoid to lie along its surface.
function alongSurface(part, rx, ry, rz, p) {
  part.quaternion.setFromUnitVectors(Z, new THREE.Vector3(p.x / (rx * rx), p.y / (ry * ry), p.z / (rz * rz)).normalize());
  return part;
}

// A pair of wings, each hung from its own shoulder and reaching out to its own
// side, so that one positive angle (rotation.z times the side) raises both
// tips. A mirrored copy would turn the other way.
function wingPair(parent, { x, y, z = 0, length, width, thick = 0.016, color, tip = null, material = null }) {
  return [-1, 1].map((side) => {
    const w = new THREE.Group();
    w.position.set(side * x, y, z);
    w.userData.wing = side;
    w.add(mesh(sphere(), material ?? toon(color), side * length * 0.5, 0, 0, length * 0.5, thick, width));
    if (tip) w.add(mesh(sphere(), toon(tip), side * length * 0.9, 0.003, -width * 0.2, length * 0.14, thick * 1.1, width * 0.6));
    parent.add(w);
    return w;
  });
}

function eyesOn(group, rx, ry, rz, spread, y, size = 0.03) {
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = onSurface(rx, ry, rz, side * spread, y, 0.004);
    eyes.add(mesh(sphere(1, 10, 8), toon(BLACK), p.x, p.y, p.z, size, size * 1.2, size * 0.6));
    eyes.add(mesh(sphere(1, 6, 4), toon(WHITE, { emissive: 0.5 }), p.x + side * 0.004, p.y + size * 0.5, p.z + size * 0.5, size * 0.35));
  }
  group.add(eyes);
  return eyes;
}

const BUNNY_FUR = ['#ffffff', '#f3e3cf', '#c8a27c', '#d9d9df'];
const BUTTERFLY = ['#ff8fc4', '#7cc4ff', '#ffd24a', '#b18cff', '#7fe08c', '#ff9b5a'];

function bunny(id) {
  const fur = BUNNY_FUR[id % BUNNY_FUR.length];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(mesh(sphere(), toon(fur), 0, 0.2, -0.02, 0.2, 0.18, 0.24));
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.14);
  body.add(head);
  head.add(mesh(sphere(), toon(fur), 0, 0, 0, 0.15, 0.14, 0.14));
  for (const side of [-1, 1]) {
    const ear = mesh(sphere(), toon(fur), side * 0.06, 0.2, -0.02, 0.045, 0.16, 0.03);
    ear.rotation.z = -side * 0.2;
    head.add(ear);
    head.add(mesh(sphere(), toon('#ffb3c6'), side * 0.06, 0.2, 0.002, 0.025, 0.12, 0.02).rotateZ(-side * 0.2));
  }
  const eyes = eyesOn(head, 0.15, 0.14, 0.14, 0.07, 0.02, 0.022);
  const nose = onSurface(0.15, 0.14, 0.14, 0, -0.03, 0.004);
  head.add(mesh(sphere(), toon('#ff7f9f'), nose.x, nose.y, nose.z, 0.02, 0.015, 0.012));
  body.add(mesh(sphere(), toon(WHITE), 0, 0.2, -0.26, 0.07));
  for (const side of [-1, 1]) body.add(mesh(sphere(), toon(fur), side * 0.11, 0.04, 0.12, 0.05, 0.04, 0.07));
  return { group: g, body, head, eyes, height: 0.6 };
}

function chick() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(mesh(sphere(), toon('#ffd84d'), 0, 0.2, 0, 0.17, 0.16, 0.18));
  const head = new THREE.Group();
  head.position.set(0, 0.34, 0.06);
  body.add(head);
  head.add(mesh(sphere(), toon('#ffe066'), 0, 0, 0, 0.12));
  const eyes = eyesOn(head, 0.12, 0.12, 0.12, 0.06, 0.02, 0.02);
  const beak = mesh(cone(0.035, 0.07, 8), toon('#ff9b2f'), 0, -0.01, 0.13);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);
  head.add(mesh(sphere(), toon('#ffd84d'), 0, 0.12, 0, 0.03, 0.05, 0.02));
  for (const side of [-1, 1]) {
    const wing = mesh(sphere(), toon('#ffcc33'), side * 0.16, 0.2, -0.01, 0.04, 0.09, 0.1);
    wing.userData.wing = side;
    body.add(wing);
    body.add(mesh(cylinder(0.012, 0.012, 0.08, 6), toon('#ff9b2f'), side * 0.06, 0.04, 0.02));
  }
  return { group: g, body, head, eyes, height: 0.5 };
}

function sheep() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wool = toon('#fbfbf7');
  for (const [x, y, z, r] of [
    [0, 0.42, 0, 0.26],
    [0.14, 0.44, 0.12, 0.17],
    [-0.14, 0.44, 0.12, 0.17],
    [0.14, 0.44, -0.14, 0.17],
    [-0.14, 0.44, -0.14, 0.17],
    [0, 0.58, 0, 0.18],
    [0, 0.42, -0.24, 0.16],
  ]) {
    body.add(mesh(sphere(), wool, x, y, z, r));
  }
  for (const [x, z] of [
    [0.12, 0.14],
    [-0.12, 0.14],
    [0.12, -0.14],
    [-0.12, -0.14],
  ]) {
    body.add(mesh(cylinder(0.035, 0.035, 0.24, 8), toon('#4a4450'), x, 0.12, z));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.3);
  body.add(head);
  head.add(mesh(sphere(), toon('#4a4450'), 0, 0, 0, 0.12, 0.14, 0.12));
  head.add(mesh(sphere(), wool, 0, 0.12, -0.02, 0.1, 0.06, 0.08));
  for (const side of [-1, 1]) head.add(mesh(sphere(), toon('#4a4450'), side * 0.14, 0.02, -0.02, 0.07, 0.03, 0.04).rotateZ(side * 0.4));
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = onSurface(0.12, 0.14, 0.12, side * 0.05, 0.03, 0.004);
    eyes.add(mesh(sphere(), toon(WHITE), p.x, p.y, p.z, 0.025, 0.028, 0.012));
    eyes.add(mesh(sphere(), toon(BLACK), p.x, p.y, p.z + 0.01, 0.013, 0.016, 0.006));
  }
  head.add(eyes);
  return { group: g, body, head, eyes, height: 0.75 };
}

function duck() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(mesh(sphere(), toon('#ffffff'), 0, 0.18, -0.02, 0.18, 0.15, 0.24));
  body.add(mesh(cone(0.08, 0.12, 8), toon('#ffffff'), 0, 0.24, -0.26).rotateX(-1.1));
  const head = new THREE.Group();
  head.position.set(0, 0.38, 0.15);
  body.add(head);
  head.add(mesh(sphere(), toon('#ffffff'), 0, 0, 0, 0.12));
  const eyes = eyesOn(head, 0.12, 0.12, 0.12, 0.065, 0.03, 0.02);
  head.add(mesh(sphere(), toon('#ff9b2f'), 0, -0.03, 0.13, 0.06, 0.02, 0.06));
  for (const side of [-1, 1]) {
    const wing = mesh(sphere(), toon('#f1f1f1'), side * 0.17, 0.2, -0.03, 0.04, 0.09, 0.15);
    wing.userData.wing = side;
    body.add(wing);
    body.add(mesh(sphere(), toon('#ff9b2f'), side * 0.07, 0.02, 0.04, 0.05, 0.015, 0.07));
  }
  return { group: g, body, head, eyes, height: 0.5 };
}

function butterfly(id) {
  const color = BUTTERFLY[id % BUTTERFLY.length];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(mesh(capsule(0.025, 0.14), toon('#4a3a3a'), 0, 0, 0).rotateX(Math.PI / 2));
  const wings = [];
  for (const side of [-1, 1]) {
    const w = new THREE.Group();
    w.userData.wing = side;
    w.add(mesh(sphere(), toon(color, { side: THREE.DoubleSide }), side * 0.1, 0, 0.04, 0.1, 0.012, 0.09));
    w.add(mesh(sphere(), toon(color, { side: THREE.DoubleSide }), side * 0.08, 0, -0.07, 0.07, 0.012, 0.06));
    w.add(mesh(sphere(), toon('#ffffff', { side: THREE.DoubleSide }), side * 0.11, 0.008, 0.04, 0.035, 0.01, 0.03));
    body.add(w);
    wings.push(w);
  }
  for (const side of [-1, 1]) body.add(mesh(cylinder(0.004, 0.004, 0.1, 4), toon('#4a3a3a'), side * 0.02, 0.04, 0.1).rotateX(0.9));
  return { group: g, body, head: body, eyes: null, wings, height: 0.2, shadow: 0, tiny: true };
}

// The flying ones below share a rig: body, then a pivot at the middle of the
// body that leans into turns, then the parts; spread wings for the air and
// folded ones for sitting; legs left out of the pivot, so they stay put.

const BIRDS = [
  { body: '#5aa9f0', belly: '#ffb27a', wing: '#3f86d1' }, // bluebird
  { body: '#a08070', belly: '#ff8a5c', wing: '#80614f' }, // robin
  { body: '#ffd84d', belly: '#fff3b0', wing: '#f2b82e' }, // canary
  { body: '#ef5a5a', belly: '#ff9d9d', wing: '#cc4444', crest: true }, // cardinal
];

function bird(id) {
  const k = BIRDS[id % BIRDS.length];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.17;
  body.add(pivot);
  pivot.add(mesh(sphere(), toon(k.body), 0, 0, -0.01, 0.12, 0.11, 0.14));
  pivot.add(mesh(sphere(), toon(k.belly), 0, -0.025, 0.06, 0.09, 0.08, 0.075));
  const head = new THREE.Group();
  head.position.set(0, 0.1, 0.07);
  pivot.add(head);
  head.add(mesh(sphere(), toon(k.body), 0, 0, 0, 0.085));
  const eyes = eyesOn(head, 0.085, 0.085, 0.085, 0.045, 0.015, 0.017);
  head.add(mesh(cone(0.022, 0.055, 8), toon('#ffad33'), 0, -0.012, 0.1).rotateX(Math.PI / 2));
  if (k.crest) head.add(mesh(cone(0.032, 0.09, 8), toon(k.body), 0, 0.09, -0.02).rotateX(-0.4));
  const tail = new THREE.Group();
  tail.position.set(0, 0.02, -0.13);
  pivot.add(tail);
  tail.add(mesh(sphere(), toon(k.wing), 0, 0, -0.06, 0.045, 0.012, 0.08));
  const folded = [-1, 1].map((side) => {
    const f = mesh(sphere(), toon(k.wing), side * 0.105, 0.01, -0.03, 0.03, 0.07, 0.1);
    f.rotation.x = 0.25;
    pivot.add(f);
    return f;
  });
  const wings = wingPair(pivot, { x: 0.09, y: 0.035, length: 0.26, width: 0.075, color: k.wing });
  const legs = new THREE.Group();
  for (const side of [-1, 1]) legs.add(mesh(cylinder(0.009, 0.009, 0.08, 6), toon('#e8963a'), side * 0.035, 0.04, 0.01));
  body.add(legs);
  return { group: g, body, pivot, head, eyes, tail, wings, folded, legs, height: 0.36, shadow: 0.16, flapRate: 26 };
}

function owl(id, theme) {
  const k =
    theme === 'snowy'
      ? { body: '#f6f5f0', face: '#ffffff', wing: '#dedbd2', spots: '#8f8a80' }
      : id % 2
        ? { body: '#9a8478', face: '#efe2d2', wing: '#7f6a5e' }
        : { body: '#b07d4f', face: '#f3dfc0', wing: '#8a5f3a' };
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.2;
  body.add(pivot);
  pivot.add(mesh(sphere(), toon(k.body), 0, 0, 0, 0.16, 0.18, 0.15));
  pivot.add(mesh(sphere(), toon(k.face), 0, -0.03, 0.07, 0.115, 0.13, 0.09));
  // A snowy owl's few dark speckles, on its front.
  for (const [x, y] of k.spots ? [[-0.05, 0.02], [0.045, -0.035], [-0.01, -0.07]] : []) {
    const p = onSurface(0.115, 0.13, 0.09, x, y, 0.001);
    pivot.add(alongSurface(mesh(sphere(), toon(k.spots), p.x, p.y - 0.03, p.z + 0.07, 0.016, 0.011, 0.005), 0.115, 0.13, 0.09, p));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.17, 0.01);
  pivot.add(head);
  const HR = [0.15, 0.125, 0.13];
  head.add(mesh(sphere(), toon(k.body), 0, 0, 0, ...HR));
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    // A pale disc round each big eye, the way an owl's face is.
    const d = onSurface(...HR, side * 0.06, 0.005, -0.004);
    head.add(alongSurface(mesh(sphere(), toon(k.face), d.x, d.y, d.z, 0.062, 0.062, 0.022), ...HR, d));
    const e = onSurface(...HR, side * 0.06, 0.005, 0.012);
    const eye = alongSurface(new THREE.Group(), ...HR, e);
    eye.position.copy(e);
    eye.add(mesh(sphere(), toon('#ffc93c'), 0, 0, 0, 0.04, 0.04, 0.012));
    eye.add(mesh(sphere(), toon(BLACK), 0, 0, 0.008, 0.024, 0.024, 0.009));
    eye.add(mesh(sphere(1, 6, 4), toon(WHITE, { emissive: 0.5 }), side * 0.005, 0.011, 0.016, 0.008));
    eyes.add(eye);
    head.add(mesh(cone(0.032, 0.085, 6), toon(k.wing), side * 0.095, 0.105, -0.01).rotateZ(-side * 0.35));
  }
  head.add(eyes);
  head.add(mesh(cone(0.02, 0.05, 8), toon('#e8a33d'), 0, -0.035, 0.125).rotateX(Math.PI - 0.5));
  const tail = new THREE.Group();
  tail.position.set(0, -0.08, -0.13);
  pivot.add(tail);
  tail.add(mesh(sphere(), toon(k.wing), 0, 0, -0.03, 0.06, 0.018, 0.06));
  const folded = [-1, 1].map((side) => {
    const f = mesh(sphere(), toon(k.wing), side * 0.15, -0.01, -0.02, 0.045, 0.14, 0.12);
    f.rotation.z = side * 0.1;
    pivot.add(f);
    return f;
  });
  const wings = wingPair(pivot, { x: 0.13, y: 0.04, length: 0.38, width: 0.11, thick: 0.02, color: k.wing });
  const legs = new THREE.Group();
  for (const side of [-1, 1]) legs.add(mesh(sphere(), toon('#e8a33d'), side * 0.06, 0.018, 0.05, 0.032, 0.018, 0.042));
  body.add(legs);
  return { group: g, body, pivot, head, eyes, tail, wings, folded, legs, height: 0.5, shadow: 0.22, pick: 0.42, flapRate: 10 };
}

function bee() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.08;
  body.add(pivot);
  pivot.add(mesh(sphere(), toon('#ffd23f'), 0, 0, -0.015, 0.075, 0.07, 0.09));
  // Two black stripes: discs a little wider than the body where they cross it.
  for (const z of [-0.005, -0.05]) {
    const k = Math.sqrt(1 - ((z + 0.015) / 0.09) ** 2);
    pivot.add(mesh(sphere(), toon('#3a3040'), 0, 0, z, 0.075 * k + 0.004, 0.07 * k + 0.004, 0.012));
  }
  pivot.add(mesh(sphere(), toon('#3a3040'), 0, 0, -0.098, 0.022));
  const head = new THREE.Group();
  head.position.set(0, 0.012, 0.085);
  pivot.add(head);
  head.add(mesh(sphere(), toon('#ffe066'), 0, 0, 0, 0.055));
  const eyes = eyesOn(head, 0.055, 0.055, 0.055, 0.025, 0.008, 0.013);
  for (const side of [-1, 1]) {
    head.add(mesh(cylinder(0.004, 0.004, 0.06, 4), toon(BLACK), side * 0.022, 0.07, 0.01).rotateZ(-side * 0.35));
    head.add(mesh(sphere(1, 6, 4), toon(BLACK), side * 0.033, 0.1, 0.01, 0.011));
  }
  const glass = toon('#eef8ff', { transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const wings = wingPair(pivot, { x: 0.02, y: 0.065, z: -0.01, length: 0.1, width: 0.035, thick: 0.006, material: glass });
  return { group: g, body, pivot, head, eyes, wings, folded: [], legs: null, tail: null, height: 0.16, shadow: 0, tiny: true, flapRate: 48 };
}

function seagull() {
  const WHITE_FEATHERS = '#fbfbf8';
  const GREY = '#aab4c0';
  const TIPS = '#3d4048';
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.19;
  body.add(pivot);
  pivot.add(mesh(sphere(), toon(WHITE_FEATHERS), 0, 0, -0.02, 0.11, 0.11, 0.21));
  const head = new THREE.Group();
  head.position.set(0, 0.11, 0.15);
  pivot.add(head);
  head.add(mesh(sphere(), toon(WHITE_FEATHERS), 0, 0, 0, 0.08));
  const eyes = eyesOn(head, 0.08, 0.08, 0.08, 0.045, 0.02, 0.016);
  head.add(mesh(cone(0.02, 0.09, 8), toon('#ffcf3a'), 0, -0.015, 0.11).rotateX(Math.PI / 2));
  head.add(mesh(sphere(), toon('#ff5f4f'), 0, -0.022, 0.125, 0.009));
  const tail = new THREE.Group();
  tail.position.set(0, 0.02, -0.2);
  pivot.add(tail);
  tail.add(mesh(sphere(), toon(WHITE_FEATHERS), 0, 0, -0.05, 0.065, 0.014, 0.08));
  // Folded, the grey wings lie along its back, their black tips past the tail.
  const folded = [-1, 1].map((side) => {
    const f = new THREE.Group();
    f.add(mesh(sphere(), toon(GREY), side * 0.07, 0.055, -0.05, 0.05, 0.045, 0.19).rotateZ(side * 0.5));
    f.add(mesh(sphere(), toon(TIPS), side * 0.035, 0.05, -0.25, 0.03, 0.018, 0.08));
    pivot.add(f);
    return f;
  });
  const wings = wingPair(pivot, { x: 0.08, y: 0.05, length: 0.6, width: 0.11, color: GREY, tip: TIPS });
  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    legs.add(mesh(cylinder(0.012, 0.012, 0.09, 6), toon('#f0a64a'), side * 0.045, 0.045, 0));
    legs.add(mesh(sphere(), toon('#f0a64a'), side * 0.045, 0.006, 0.025, 0.028, 0.008, 0.035));
  }
  body.add(legs);
  return { group: g, body, pivot, head, eyes, tail, wings, folded, legs, height: 0.38, shadow: 0.24, pick: 0.45, flapRate: 9 };
}

const BUILDERS = { bunny, chick, sheep, duck, butterfly, bird, owl, bee, seagull };

export class CritterModel {
  constructor(type, id, theme = 'sunny') {
    const parts = (BUILDERS[type] ?? bunny)(id, theme);
    Object.assign(this, parts);
    this.type = type;
    this.id = id;
    this.time = Math.random() * 10;
    this.hopPhase = 0;
    this.tiny = parts.tiny ?? false;
    this.pick = parts.pick ?? (type === 'sheep' ? 0.5 : 0.38);
    // How it is moving, worked out from where it is put each frame.
    this.vy = 0;
    this.turn = 0;
    this.lastY = null;
    this.lastYaw = 0;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(parts.shadow || (type === 'sheep' ? 0.36 : 0.22), 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 1;
    this.shadow = shadow;
  }

  // state: idle, walk, hop, eat, happy, swim, fly, sleep. air: how high it
  // is over the ground, which tells sitting from hovering when it is happy.
  update(dt, state, moving, air = 0) {
    this.time += dt;
    const t = this.time;
    const b = this.body;
    b.position.y = 0;
    b.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    if (this.eyes) this.eyes.scale.y = 1;
    this.track(dt);
    switch (this.type) {
      case 'bunny':
        if (state === 'hop' || (moving && state !== 'sleep')) {
          this.hopPhase += dt * 7;
          b.position.y = Math.abs(Math.sin(this.hopPhase)) * 0.22;
          b.rotation.x = Math.cos(this.hopPhase) * 0.15;
        }
        if (state === 'eat') this.head.rotation.x = 0.35 + Math.sin(t * 9) * 0.06;
        break;
      case 'chick':
        if (moving) b.position.y = Math.abs(Math.sin(t * 12)) * 0.04;
        if (state === 'eat') this.head.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.9;
        for (const c of b.children) if (c.userData.wing) c.rotation.z = c.userData.wing * (0.1 + Math.max(0, Math.sin(t * 5)) * 0.1);
        break;
      case 'sheep':
        if (moving) b.position.y = Math.abs(Math.sin(t * 6)) * 0.03;
        if (state === 'eat') this.head.rotation.x = 0.5 + Math.sin(t * 4) * 0.05;
        break;
      case 'duck':
        if (state === 'swim') {
          b.position.y = -0.12 + Math.sin(t * 2.5) * 0.02;
          b.rotation.z = Math.sin(t * 1.7) * 0.05;
        } else if (moving) {
          b.rotation.z = Math.sin(t * 9) * 0.12;
        }
        if (state === 'eat') this.head.rotation.x = 0.6;
        break;
      case 'butterfly': {
        // Sitting on a flower, its wings stand up together and slowly open.
        const sitting = state === 'idle' || state === 'sleep';
        const flap = state === 'sleep' ? 1.45 : sitting ? 1.05 + Math.sin(t * 2.2) * 0.35 : Math.sin(t * 22) * 0.9;
        for (const w of this.wings) w.rotation.z = w.userData.wing * flap;
        if (!sitting) b.position.y = Math.sin(t * 3) * 0.05;
        break;
      }
      case 'bird':
      case 'owl':
      case 'seagull':
        this.flyer(state, air);
        break;
      case 'bee':
        this.buzz(state);
        break;
      default:
        break;
    }
    if (state === 'happy') {
      b.position.y = Math.abs(Math.sin(t * 9)) * 0.25;
      b.rotation.y = Math.sin(t * 6) * 0.3;
    }
    if (state === 'sleep' && this.eyes) {
      this.eyes.scale.y = 0.12;
      this.head.rotation.x = 0.25;
    }
  }

  // Climbing or diving, and how fast it is turning, from where the group has
  // been put since last time.
  track(dt) {
    const y = this.group.position.y;
    const yaw = this.group.rotation.y;
    if (this.lastY !== null && dt > 0) {
      const k = Math.min(1, dt * 6);
      this.vy += ((y - this.lastY) / dt - this.vy) * k;
      this.turn += (wrap(yaw - this.lastYaw) / dt - this.turn) * k;
    }
    this.lastY = y;
    this.lastYaw = yaw;
  }

  // Birds, owls and seagulls. Sitting: wings folded, pecking, hopping, looking
  // about. In the air: leaning into turns, nose up to climb, and each with its
  // own way of flying.
  flyer(state, air) {
    const t = this.time;
    const flying = state === 'fly' || (state === 'happy' && air > 0.3);
    let open = flying;
    let a = 0;
    if (flying) {
      // Turning left (yaw going up) dips the left wing, on +x.
      this.pivot.rotation.set(clamp(-this.vy * 0.12, -0.45, 0.45), 0, clamp(-this.turn * 0.35, -0.6, 0.6));
      if (this.type === 'seagull') {
        // Long glides, and a few strong beats to climb.
        a = this.vy > 0.6 ? Math.sin(t * this.flapRate) * 0.7 : 0.12 + Math.sin(t * 1.3) * 0.08;
      } else if (this.type === 'owl') {
        // Slow, soft beats, then a long glide down.
        a = this.vy < -0.5 || t % 2.4 > 1.4 ? 0.08 : Math.sin(t * this.flapRate) * 0.75;
      } else {
        // A songbird bounds: a burst of beats, then its wings shut a moment.
        a = Math.sin(t * this.flapRate) * 0.85;
        open = (t * 2.4) % 1 < 0.65 || this.vy > 0.8;
      }
      this.body.position.y = Math.sin(t * this.flapRate) * 0.012;
      this.tail.rotation.x = 0.1;
    } else {
      this.pivot.rotation.set(0, 0, 0);
      this.tail.rotation.x = 0.35 + Math.sin(t * 3) * 0.05;
      switch (state) {
        case 'eat':
          this.pivot.rotation.x = 0.25;
          this.head.rotation.x = Math.max(0, Math.sin(t * 9)) * 0.9;
          break;
        case 'hop':
          this.body.position.y = Math.abs(Math.sin(t * 14)) * 0.07;
          break;
        case 'swim':
          this.body.position.y = -0.13 + Math.sin(t * 2.2) * 0.015;
          break;
        case 'idle':
          // Looking about; an owl turns its head right round.
          this.head.rotation.y = this.type === 'owl' ? Math.sin(t * 0.45 + this.id) * 1.3 : Math.sin(t * 1.1 + this.id) * 0.5;
          break;
        default:
          break;
      }
    }
    for (const w of this.wings) {
      w.visible = open;
      w.rotation.z = w.userData.wing * a;
    }
    for (const f of this.folded) f.visible = !open;
    this.legs.visible = !flying && state !== 'swim';
  }

  // A bee's wings are a blur, and it never quite keeps still in the air.
  buzz(state) {
    const t = this.time;
    const sitting = state === 'idle' || state === 'sleep';
    const a = sitting ? 0.25 : 0.55 + Math.sin(t * this.flapRate) * 0.45;
    for (const w of this.wings) w.rotation.z = w.userData.wing * a;
    this.pivot.position.x = sitting ? 0 : Math.sin(t * 2.65) * 0.04;
    this.pivot.rotation.z = sitting ? 0 : Math.sin(t * 3.1) * 0.15;
    if (!sitting) this.body.position.y = Math.sin(t * 5.3) * 0.03;
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
