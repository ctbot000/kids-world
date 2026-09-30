// The animal friends as little models: bunnies that hop, chicks that peck,
// fluffy sheep, ducks that paddle about, and butterflies that flutter.
import * as THREE from '../../vendor/three.module.js';
import { capsule, cone, cylinder, mesh, onSurface, sphere, toon } from './toon.js';

const BLACK = '#2b2530';
const WHITE = '#ffffff';

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
  return { group: g, body, head: body, eyes: null, wings, height: 0.2 };
}

const BUILDERS = { bunny, chick, sheep, duck, butterfly };

export class CritterModel {
  constructor(type, id) {
    const parts = (BUILDERS[type] ?? bunny)(id);
    Object.assign(this, parts);
    this.type = type;
    this.id = id;
    this.time = Math.random() * 10;
    this.hopPhase = 0;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(type === 'sheep' ? 0.36 : 0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 1;
    this.shadow = shadow;
  }

  // state: idle, walk, hop, eat, happy, swim, fly, sleep.
  update(dt, state, moving) {
    this.time += dt;
    const t = this.time;
    const b = this.body;
    b.position.y = 0;
    b.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    if (this.eyes) this.eyes.scale.y = 1;
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
        const flap = state === 'sleep' ? 0.2 : Math.sin(t * 22) * 0.9;
        for (const w of this.wings) w.rotation.z = w.userData.wing * flap;
        b.position.y = Math.sin(t * 3) * 0.05;
        break;
      }
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

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
