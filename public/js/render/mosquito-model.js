// The giant mosquito as a monster (shared/monsters.js): the very animal
// that used to drone about the meadows as a friend, turned hostile — the
// same round furry blue-grey body, the striped tail, the feathered
// antennae, the long snout and the six stilt legs, but with cross red eyes
// that glow at night, and no saddle: nobody rides one now. It never
// touches the ground: its wings are always a blur, it bobs about as it
// hangs in the air well out of reach, and pitches forward and banks as it
// darts down at someone, shaking as it giggles after a bump. (Its body is
// the one in critter-models.js, where it lived as an animal.)
import * as THREE from '../../vendor/three.module.js';
import { wingPair } from './critter-models.js';
import { blobShadow, capsule, cylinder, mesh, sphere, toon } from './toon.js';

const FUR = ['#8494ab', '#9aa5b8', '#76859e'];
const STRIPE = '#4e5a70';
const LEG = '#5d6a80';

// One leg, from its hip on the body: out and up over its side to a knee,
// then a long thin shin down (a stilt, longer than the whole body), with a
// tiny foot on the end.
function leg(pivot, side, z, forward) {
  const leg = new THREE.Group();
  leg.position.set(side * 0.14, 0.03, z);
  leg.userData = { side };
  const hip = [0, 0, 0];
  const knee = [side * 0.3, 0.24, forward];
  const foot = [side * 0.36, -0.63, forward * 1.5];
  for (const [a, b, r0, r1] of [
    [hip, knee, 0.017, 0.012],
    [knee, foot, 0.011, 0.007],
  ]) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const bone = mesh(cylinder(r1, r0, d.length(), 6), toon(LEG), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    leg.add(bone);
  }
  leg.add(mesh(sphere(1, 6, 4), toon('#3a3438'), foot[0], foot[1], foot[2], 0.018, 0.012, 0.032));
  pivot.add(leg);
  return leg;
}

const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class MosquitoModel {
  constructor(theme = 'sunny', id = 1) {
    const fur = toon(FUR[(id + 3) % FUR.length]);
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const pivot = new THREE.Group();
    pivot.position.y = 0.62;
    this.body.add(pivot);
    this.pivot = pivot;
    // The thorax, round and furry, with a hump over its shoulders and a pale
    // belly underneath.
    pivot.add(mesh(sphere(), fur, 0, 0.02, 0.1, 0.28, 0.27, 0.32));
    pivot.add(mesh(sphere(), fur, 0, 0.17, 0, 0.16, 0.13, 0.15));
    pivot.add(mesh(sphere(), toon('#bcc7d6'), 0, -0.09, 0.08, 0.2, 0.15, 0.24));
    // The tail slopes up behind, ringed with darker stripes.
    const tail = new THREE.Group();
    tail.position.set(0, 0.08, -0.2);
    tail.rotation.x = 0.24;
    pivot.add(tail);
    this.tail = tail;
    tail.add(mesh(capsule(0.12, 0.3), fur, 0, 0.03, -0.2).rotateX(Math.PI / 2));
    tail.add(mesh(sphere(), fur, 0, 0.07, -0.44, 0.085));
    tail.add(mesh(sphere(), fur, 0, 0.1, -0.53, 0.05));
    for (const [z, r] of [
      [-0.14, 0.121],
      [-0.3, 0.114],
      [-0.42, 0.088],
    ]) {
      const k = Math.sqrt(Math.max(0.01, 1 - ((z + 0.05) / 0.4) ** 2));
      tail.add(mesh(sphere(), toon(STRIPE), 0, 0.02 + (z + 0.2) * 0.12, z, r * k + 0.006, r * k + 0.006, 0.014));
    }
    // The head, with cross red eyes and feathered antennae.
    const head = new THREE.Group();
    head.position.set(0, 0.15, 0.34);
    pivot.add(head);
    this.head = head;
    head.add(mesh(sphere(), fur, 0, 0, 0, 0.15, 0.14, 0.135));
    this.eyeDim = toon('#5c1428');
    this.eyeGlow = toon('#ff6b6b', { emissive: 0.9 });
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = mesh(sphere(1, 12, 10), this.eyeDim, side * 0.088, 0.045, 0.06, 0.039, 0.052, 0.039);
      head.add(eye);
      this.eyes.push(eye);
      head.add(mesh(sphere(1, 6, 4), toon('#ffffff', { emissive: 0.5 }), side * 0.108, 0.066, 0.081, 0.012));
      // Cross: a dark brow sloping down towards the middle.
      const brow = mesh(sphere(1, 8, 6), toon('#2b2530'), side * 0.085, 0.115, 0.075, 0.052, 0.012, 0.014);
      brow.rotation.z = -side * 0.5;
      head.add(brow);
    }
    for (const side of [-1, 1]) {
      const a = mesh(cylinder(0.005, 0.003, 0.2, 5), toon('#2b2530'), side * 0.05, 0.22, 0.06);
      a.rotation.set(0.35, 0, -side * 0.5);
      head.add(a);
      head.add(mesh(sphere(1, 6, 4), toon('#2b2530'), side * 0.095, 0.27, 0.065, 0.012));
    }
    // The long snout, out in front and a little down.
    const snout = new THREE.Group();
    snout.position.set(0, -0.05, 0.1);
    snout.rotation.x = 0.3;
    head.add(snout);
    snout.add(mesh(cylinder(0.017, 0.009, 0.5, 6), toon('#3a3438'), 0, 0, 0.25).rotateX(Math.PI / 2));
    // The wings: long and narrow and almost see-through, with a dark tip.
    const glass = toon('#e8f4ff', { transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    this.wings = wingPair(pivot, { x: 0.12, y: 0.28, z: -0.04, length: 0.52, width: 0.085, thick: 0.007, material: glass, tip: '#aebdd6' });
    // The halteres: the little knobbed stalks a mosquito steers with, behind
    // its wings.
    for (const side of [-1, 1]) {
      pivot.add(mesh(cylinder(0.008, 0.006, 0.09, 5), toon(LEG), side * 0.12, 0.14, -0.26).rotateX(0.5));
      pivot.add(mesh(sphere(1, 6, 4), toon(LEG), side * 0.12, 0.17, -0.28, 0.014));
    }
    // Six stilt legs, the front pair reaching forward, the middle pair down
    // and the back pair sweeping behind.
    this.legs = [
      leg(pivot, -1, 0.2, 0.1),
      leg(pivot, 1, 0.2, 0.1),
      leg(pivot, -1, 0, 0),
      leg(pivot, 1, 0, 0),
      leg(pivot, -1, -0.18, -0.06),
      leg(pivot, 1, -0.18, -0.06),
    ];
    this.height = 1.15;
    this.center = 0.6;
    this.pick = 0.7;
    this.shadowScale = 0.9;
    this.seen = 110;
    this.shadow = blobShadow(0.5, 0.2);
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.lastYaw = 0;
    this.turn = 0;
    this.squash = 0;
  }

  // state: idle, hop (flitting about), chase (darting at someone) or giggle
  // (shared/monsters.js). air: how high it is over the ground (always well
  // up). night: eyes aglow.
  update(dt, state, air = 0, night = false) {
    this.time += dt;
    const t = this.time;
    const y = this.group.position.y;
    if (this.lastY !== null && dt > 0) this.vy += ((y - this.lastY) / dt - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    let dy = wrap(this.group.rotation.y - this.lastYaw);
    this.lastYaw = this.group.rotation.y;
    if (dt > 0) this.turn += (dy / dt - this.turn) * Math.min(1, dt * 15);
    // Wings a blur, all the faster darting at someone.
    const dart = state === 'chase';
    const a = 0.4 + Math.sin(t * (dart ? 42 : 30)) * 0.5;
    for (const w of this.wings) w.rotation.z = w.userData.wing * a;
    // Pitching over as it dives or climbs, banking into a turn, bobbing as
    // it hangs in the air.
    this.pivot.rotation.set(clamp(-this.vy * 0.14, -0.5, 0.5), 0, clamp(-this.turn * 0.3, -0.55, 0.55));
    const squash = (this.squash = Math.max(0, this.squash - dt * 2.2));
    this.body.position.y = Math.sin(t * (dart ? 6 : 4.5)) * 0.04 - squash * 0.08;
    this.body.rotation.set(0, 0, 0);
    // A giggle, after it bumped someone: shaking side to side.
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.18;
    this.tail.rotation.y = Math.sin(t * (dart ? 3 : 1.7)) * 0.1;
    // Looking about as it hangs there; eyes ahead on the dart.
    this.head.rotation.y = dart ? 0 : Math.sin(t * 0.8) * 0.5;
    // Legs: folded up and trailing behind in the air.
    this.legs.forEach((l, i) => {
      l.rotation.x = -0.75 + Math.sin(t * 3 + i * 1.3) * 0.08;
      l.rotation.z = l.userData.side * 0.5;
    });
    // Eyes aglow at night.
    const mat = night ? this.eyeGlow : this.eyeDim;
    for (const eye of this.eyes) if (eye.material !== mat) eye.material = mat;
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
