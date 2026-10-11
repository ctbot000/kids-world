// A giant spider as a monster (shared/monsters.js): a fat dark-plum body
// low to the ground, a pale lilac marking down its back, a little head with
// two big cross eyes (and two tiny bead ones beside them, as spiders have)
// that glow green at night, and two soft fangs under them. It skitters
// about on eight stilt legs, knees up over its back, each leg a quarter
// step behind the one before — all the quicker as it scuttles at someone —
// and folds them in under it as it hops, squashing flat as it lands and
// shaking as it giggles after a bump.
import * as THREE from '../../vendor/three.module.js';
import { blobShadow, cone, cylinder, mesh, sphere, toon } from './toon.js';

const SHELL = ['#463a5e', '#3d3354', '#514469'];
const BELLY = '#6f6089';
const LEG = '#372e4a';
const MARK = '#c9b7f2';

// One leg, from its hip on the body: out and up over its side to a knee
// above its back, then a long thin shin down and a little further out, with
// a tiny foot on the end. forward: how far ahead of its hip it reaches
// (the front pair well forward, the back pair swept behind).
function leg(body, side, z, kneeF, footF) {
  const leg = new THREE.Group();
  leg.position.set(side * 0.15, 0.42, z);
  const hip = [0, 0, 0];
  const knee = [side * 0.28, 0.52, kneeF];
  const foot = [side * 0.66, -0.42, footF];
  leg.userData = { side, knee: new THREE.Vector3(...knee), foot: new THREE.Vector3(...foot) };
  for (const [a, b, r0, r1] of [
    [hip, knee, 0.035, 0.026],
    [knee, foot, 0.022, 0.012],
  ]) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const bone = mesh(cylinder(r1, r0, d.length(), 6), toon(LEG), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    leg.add(bone);
  }
  leg.add(mesh(sphere(1, 6, 4), toon('#241d33'), foot[0], foot[1], foot[2], 0.026, 0.016, 0.04));
  body.add(leg);
  return leg;
}

export class SpiderModel {
  constructor(theme = 'sunny', id = 1) {
    const shell = toon(SHELL[(id + 5) % SHELL.length]);
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const b = this.body;
    // The fat abdomen behind, round and smooth with a soft underside, and a
    // pale marking down its back.
    b.add(mesh(sphere(), shell, 0, 0.52, -0.28, 0.4, 0.34, 0.44));
    b.add(mesh(sphere(), toon(BELLY), 0, 0.4, -0.26, 0.3, 0.2, 0.34));
    b.add(mesh(sphere(1, 10, 8), toon(MARK), 0, 0.84, -0.16, 0.13, 0.05, 0.17));
    b.add(mesh(sphere(1, 10, 8), toon(MARK), 0, 0.82, -0.44, 0.1, 0.05, 0.13));
    // The thorax, and the head up in front of it.
    b.add(mesh(sphere(), shell, 0, 0.4, 0.12, 0.27, 0.2, 0.26));
    const head = new THREE.Group();
    head.position.set(0, 0.37, 0.34);
    b.add(head);
    this.head = head;
    head.add(mesh(sphere(), shell, 0, 0, 0, 0.2, 0.17, 0.19));
    // Two big cross eyes, which glow at night, with two tiny bead eyes over
    // them, as spiders have.
    this.eyeWhite = toon('#fff7d6');
    this.eyeGlow = toon('#a5ff7d', { emissive: 0.9 });
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = mesh(sphere(1, 14, 10), this.eyeWhite, side * 0.078, 0.04, 0.145, 0.056, 0.062, 0.038);
      head.add(eye);
      this.eyes.push(eye);
      head.add(mesh(sphere(1, 8, 6), toon('#241d33'), side * 0.07, 0.028, 0.172, 0.026, 0.03, 0.014));
      head.add(mesh(sphere(1, 6, 4), toon('#ffffff', { emissive: 0.6 }), side * 0.088, 0.062, 0.168, 0.011, 0.013, 0.006));
      // Cross: a dark brow sloping down towards the middle.
      const brow = mesh(sphere(1, 8, 6), toon('#241d33'), side * 0.075, 0.108, 0.13, 0.062, 0.014, 0.018);
      brow.rotation.z = side * 0.45;
      head.add(brow);
    }
    for (const side of [-1, 1]) head.add(mesh(sphere(1, 6, 4), toon('#1d1729'), side * 0.035, 0.12, 0.11, 0.018));
    // Two soft fangs under its face, working up and down as it comes at you.
    this.fangs = [];
    for (const side of [-1, 1]) {
      const fang = mesh(cone(0.022, 0.09, 6), toon('#efe6ff'), side * 0.055, -0.1, 0.12);
      fang.rotation.x = Math.PI + 0.3;
      head.add(fang);
      this.fangs.push(fang);
    }
    // Eight stilt legs: the front pair reaching well forward, the middle
    // pairs down and a little out, the back pair swept behind.
    this.legs = [
      leg(b, -1, 0.22, 0.12, 0.36),
      leg(b, 1, 0.22, 0.12, 0.36),
      leg(b, -1, 0.1, 0.05, 0.14),
      leg(b, 1, 0.1, 0.05, 0.14),
      leg(b, -1, -0.02, 0, -0.08),
      leg(b, 1, -0.02, 0, -0.08),
      leg(b, -1, -0.14, -0.08, -0.34),
      leg(b, 1, -0.14, -0.08, -0.34),
    ];
    this.height = 0.95;
    this.center = 0.5;
    this.pick = 0.6;
    this.shadowScale = 1.15;
    this.seen = 90;
    this.shadow = blobShadow(0.5, 0.2);
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.squash = 0;
  }

  // state: idle, hop (skittering about), chase (scuttling at someone) or
  // giggle (shared/monsters.js). air: how high it is over the ground.
  // night: eyes aglow.
  update(dt, state, air = 0, night = false) {
    this.time += dt;
    const t = this.time;
    const y = this.group.position.y;
    if (this.lastY !== null && dt > 0) this.vy += ((y - this.lastY) / dt - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    // Squashed flat as it lands, wobbling as it goes.
    if (air < 0.05 && this.vy < -1.5) this.squash = 0.35;
    this.squash = Math.max(0, this.squash - dt * 2.2);
    const wobble = Math.sin(t * (state === 'chase' ? 9 : 4)) * 0.03;
    const sy = 1 - this.squash * 0.6 + wobble;
    const sxz = 1 + this.squash * 0.35;
    this.body.scale.set(sxz, sy, sxz);
    this.body.rotation.set(0, 0, 0);
    // A giggle, after it bumped someone: shaking side to side.
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.18;
    // The legs skitter, each a quarter step behind the one before so they
    // ripple along its sides, all the quicker as it scuttles at someone; up
    // in a hop, they fold in under it.
    const up = air > 0.05;
    const speed = state === 'chase' ? 20 : 10;
    this.legs.forEach((l, i) => {
      if (up) {
        l.rotation.x = -0.45;
        l.rotation.z = l.userData.side * 0.4;
      } else {
        l.rotation.x = Math.sin(t * speed + i * Math.PI * 0.5) * 0.26;
        l.rotation.z = l.userData.side * 0.08;
      }
    });
    // Its fangs work up and down, quicker as it comes at you.
    this.fangs.forEach((f, i) => {
      f.rotation.x = Math.PI + 0.3 + Math.sin(t * (state === 'chase' ? 14 : 5) + i * Math.PI) * 0.16;
    });
    // Eyes aglow at night.
    const mat = night ? this.eyeGlow : this.eyeWhite;
    for (const eye of this.eyes) if (eye.material !== mat) eye.material = mat;
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
