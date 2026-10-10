// The pets (see shared/pets.js) as little models, in the coat each was given
// and a collar the colour of their owner's T-shirt: a puppy, a kitten, a
// bunny, a hamster, a piglet and a baby dragon on four legs, and a duckling
// and a parrot on two. Each walks (or hops, scurries, waddles), runs, swims,
// sits, lies down, sleeps, flies if it can, and does its tricks: begging,
// spinning round, a jump, rolling over, a happy wiggle and a snack.
import * as THREE from '../../vendor/three.module.js';
import { PET_COATS } from '../shared/words.js';
import { CritterModel, eyesOn, wingPair } from './critter-models.js';
import { bakeCached, blobShadow, capsule, cone, cylinder, lathe, mesh, sphere, toon, torus } from './toon.js';

const BLACK = '#2b2530';
const PINK = '#ff9fb8';
const NOSE = '#ff7f9f';
const GOLD = '#ffcf3f';
const ORANGE = '#ff9b2f';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const ease = (k) => k * k * (3 - 2 * k);

// A colour made lighter (k > 0) or darker (k < 0).
function shade(hex, k) {
  const c = new THREE.Color(hex);
  return `#${(k > 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.multiplyScalar(1 + k)).getHexString()}`;
}

// ------------------------------------------------ four legs

// Turning about its hips: body (up and down, round and round), roll (over,
// about its middle), pivot (at its hips: sitting up, begging), and the parts
// on that, so that sitting leaves its bottom where it was.
function rig(y, half) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const roll = new THREE.Group();
  roll.position.y = y;
  body.add(roll);
  const pivot = new THREE.Group();
  pivot.position.z = -half;
  roll.add(pivot);
  return { g, body, roll, pivot };
}

// A chubby little leg, its top at y 0 and its paw at -len: full at the top
// (fuller still at the haunch of a back leg), narrowing to a wrist above the
// paw, smoothed so the light runs round it evenly.
const petLeg = (len, r, haunch) =>
  lathe(
    [
      [0, -len],
      ...new THREE.SplineCurve(
        [[0.95, 1], [0.92, 0.82], [0.98, 0.6], [1.25, 0.35], [haunch ? 1.75 : 1.45, 0.12], [haunch ? 1.8 : 1.5, 0]].map(([k, t]) => new THREE.Vector2(k * r, -len * t)),
      )
        .getPoints(16)
        .map((v) => [v.x, v.y]),
      [0, 0.02],
    ],
    18,
  );

// Four legs, each turning about its top (at height top under the hips' line):
// the front ones at z = front, the back ones at z = back, x out either side.
function fourLegs(pivot, { x, front, back, top, len, r, color, paw }) {
  return [
    [-1, front],
    [1, front],
    [-1, back],
    [1, back],
  ].map(([side, z]) => {
    const leg = new THREE.Group();
    leg.position.set(side * x, top, z);
    leg.userData = { side, front: z === front };
    leg.add(mesh(petLeg(len, r, z !== front), toon(color)));
    leg.add(mesh(sphere(1, 10, 8), toon(paw), 0, -len + r * 0.5, r * 0.4, r * 1.25, r * 0.85, r * 1.5));
    // Toes showing at the front of the paw.
    for (const t of [-1, 0, 1]) leg.add(mesh(sphere(1, 8, 6), toon(paw), t * r * 0.7, -len + r * 0.3, r * 1.1, r * 0.34, r * 0.26, r * 0.4));
    pivot.add(leg);
    return leg;
  });
}

// A collar round the neck at (x, y, z) of radius r, leaning back by lean,
// in its own material (the owner's T-shirt colour), with a golden tag.
function collar(parent, { y, z, r, lean, tag = true }) {
  const band = toon('#ff6f6f').clone();
  const c = new THREE.Group();
  c.position.set(0, y, z);
  c.rotation.x = Math.PI / 2 - lean;
  c.add(mesh(torus(r, r * 0.22), band, 0, 0, 0));
  if (tag) c.add(mesh(cylinder(r * 0.24, r * 0.24, r * 0.07, 12), toon(GOLD, { emissive: 0.2 }), 0, r * 1.08, -r * 0.18).rotateX(Math.PI / 2));
  parent.add(c);
  return band;
}

// Little pink cheeks.
function blush(head, R, spread, y) {
  for (const side of [-1, 1]) {
    const m = mesh(sphere(1, 10, 8), toon('#ff9ab0', { transparent: true, opacity: 0.7 }), side * spread, y, R * 0.72, 0.026, 0.016, 0.01);
    m.lookAt(new THREE.Vector3(side * spread * 3, y, R * 3));
    head.add(m);
  }
}

// What every four-legged pet has: a body, a head with eyes, four legs and a
// collar; m: its measurements. The rest is its own (see the kinds below).
function quadruped(coat, m) {
  const fur = PET_COATS[coat] ?? PET_COATS.tan;
  const light = shade(fur, 0.5);
  const dark = shade(fur, -0.22);
  const { g, body, roll, pivot } = rig(m.y, m.half);
  const R = m.torso;
  pivot.add(mesh(sphere(), toon(fur), 0, 0, m.half, ...R));
  if (m.belly !== false) pivot.add(mesh(sphere(), toon(m.belly ?? light), 0, -R[1] * 0.3, m.half + R[2] * 0.08, R[0] * 0.8, R[1] * 0.72, R[2] * 0.8));
  const legs = fourLegs(pivot, { x: m.legX, front: m.half * 2 - m.inset, back: m.inset, top: -R[1] * 0.3, len: m.y - R[1] * 0.3, r: m.legR, color: m.legColor ?? fur, paw: m.paw ?? light });
  const head = new THREE.Group();
  head.position.set(0, m.neck[0], m.half + m.neck[1]);
  pivot.add(head);
  const H = m.head;
  head.add(mesh(sphere(1, 20, 16), toon(fur), 0, 0, 0, ...H));
  const eyes = eyesOn(head, ...H, m.eyes[0], m.eyes[1], m.eyes[2]);
  // Round the bottom of its head, where it meets its body.
  const band = collar(pivot, { y: m.neck[0] - H[1] * 0.62, z: m.half + m.neck[1] - H[2] * 0.12, r: H[0] * 0.8, lean: 0.3 });
  const tail = new THREE.Group();
  tail.position.set(0, R[1] * 0.45, m.half - R[2] * 0.92);
  pivot.add(tail);
  return { group: g, body, roll, pivot, head, eyes, legs, tail, band, fur, light, dark, H, R };
}

const QUAD = {
  puppy: { y: 0.24, half: 0.14, torso: [0.12, 0.11, 0.18], inset: 0.05, legX: 0.065, legR: 0.038, neck: [0.12, 0.17], head: [0.135, 0.125, 0.125], eyes: [0.055, 0.035, 0.024] },
  kitten: { y: 0.22, half: 0.12, torso: [0.1, 0.095, 0.16], inset: 0.045, legX: 0.055, legR: 0.032, neck: [0.11, 0.15], head: [0.128, 0.118, 0.118], eyes: [0.052, 0.03, 0.026] },
  bunny: { y: 0.19, half: 0.1, torso: [0.13, 0.12, 0.15], inset: 0.04, legX: 0.06, legR: 0.03, neck: [0.12, 0.13], head: [0.118, 0.108, 0.108], eyes: [0.05, 0.03, 0.022] },
  hamster: { y: 0.125, half: 0.09, torso: [0.12, 0.105, 0.135], inset: 0.04, legX: 0.065, legR: 0.022, neck: [0.065, 0.12], head: [0.1, 0.092, 0.092], eyes: [0.045, 0.02, 0.019] },
  piglet: { y: 0.21, half: 0.13, torso: [0.13, 0.12, 0.18], inset: 0.045, legX: 0.07, legR: 0.035, neck: [0.09, 0.17], head: [0.13, 0.12, 0.118], eyes: [0.055, 0.035, 0.022] },
  dragon: { y: 0.24, half: 0.13, torso: [0.115, 0.11, 0.18], inset: 0.045, legX: 0.07, legR: 0.035, neck: [0.13, 0.17], head: [0.125, 0.112, 0.12], eyes: [0.052, 0.035, 0.024] },
};

function puppy(coat) {
  const m = QUAD.puppy;
  const p = quadruped(coat, m);
  const { head, H } = p;
  // A muzzle, a nose, floppy ears.
  head.add(mesh(sphere(), toon(p.light), 0, -0.035, H[2] * 0.8, 0.068, 0.052, 0.06));
  head.add(mesh(sphere(), toon(BLACK), 0, -0.012, H[2] * 0.8 + 0.058, 0.026, 0.02, 0.018));
  head.add(mesh(torus(0.018, 0.005, Math.PI), toon('#7a3b3b'), 0, -0.058, H[2] * 0.8 + 0.045).rotateZ(Math.PI));
  blush(head, H[2], 0.085, -0.035);
  const ears = [-1, 1].map((side) => {
    const e = new THREE.Group();
    e.position.set(side * 0.1, 0.07, -0.01);
    e.rotation.z = side * 0.3;
    e.userData.side = side;
    e.add(mesh(sphere(), toon(p.dark), side * 0.012, -0.06, 0, 0.045, 0.085, 0.024));
    e.add(mesh(sphere(1, 8, 6), toon(p.light), side * 0.014, -0.062, 0.012, 0.028, 0.062, 0.014));
    head.add(e);
    return e;
  });
  p.tail.add(mesh(capsule(0.022, 0.09), toon(p.fur), 0, 0.06, -0.012).rotateX(-0.25));
  p.tail.add(mesh(sphere(1, 10, 8), toon(p.light), 0, 0.115, -0.03, 0.026));
  return { ...p, ears, earRest: 0.3, earFlap: 'floppy', height: 0.52, pick: 0.3 };
}

function kitten(coat) {
  const m = QUAD.kitten;
  const p = quadruped(coat, m);
  const { head, H } = p;
  head.add(mesh(sphere(), toon(p.light), 0, -0.04, H[2] * 0.8, 0.055, 0.04, 0.045));
  head.add(mesh(sphere(), toon(NOSE), 0, -0.022, H[2] * 0.8 + 0.042, 0.016, 0.012, 0.01));
  // Whiskers, three a side.
  for (const side of [-1, 1]) {
    for (const [dy, tilt] of [[0.012, 0.18], [-0.004, 0], [-0.02, -0.18]]) {
      head.add(mesh(cylinder(0.0025, 0.0025, 0.11, 4), toon('#ffffff'), side * 0.09, -0.035 + dy, H[2] * 0.75, 1, 1, 1).rotateZ(Math.PI / 2 + side * tilt));
    }
  }
  blush(head, H[2], 0.08, -0.03);
  const ears = [-1, 1].map((side) => {
    const e = new THREE.Group();
    e.position.set(side * 0.072, 0.085, -0.01);
    e.rotation.z = -side * 0.28;
    e.userData.side = side;
    e.add(mesh(cone(0.045, 0.1, 4), toon(p.fur), 0, 0.04, 0).rotateY(Math.PI / 4));
    e.add(mesh(cone(0.027, 0.065, 4), toon(PINK), 0, 0.032, 0.012).rotateY(Math.PI / 4));
    head.add(e);
    return e;
  });
  // A long tail, up, with a darker tip, in three bends so it can curl.
  const bends = [];
  let at = p.tail;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    if (i) b.position.y = 0.085;
    b.add(mesh(capsule(0.02, 0.07), toon(i === 2 ? p.dark : p.fur), 0, 0.045, 0));
    at.add(b);
    bends.push(b);
    at = b;
  }
  p.tail.rotation.x = -0.4;
  return { ...p, ears, earRest: -0.28, earFlap: 'perk', bends, height: 0.52, pick: 0.28 };
}

function bunny(coat) {
  const m = QUAD.bunny;
  const p = quadruped(coat, m);
  const { head, H } = p;
  head.add(mesh(sphere(), toon(NOSE), 0, -0.018, H[2] + 0.002, 0.017, 0.013, 0.011));
  head.add(mesh(sphere(), toon(p.light), 0, -0.042, H[2] * 0.82, 0.05, 0.035, 0.035));
  blush(head, H[2], 0.07, -0.03);
  const ears = [-1, 1].map((side) => {
    const e = new THREE.Group();
    e.position.set(side * 0.045, 0.085, -0.02);
    e.rotation.z = -side * 0.15;
    e.userData.side = side;
    e.add(mesh(sphere(), toon(p.fur), 0, 0.12, 0, 0.036, 0.13, 0.022));
    e.add(mesh(sphere(), toon(PINK), 0, 0.12, 0.013, 0.021, 0.1, 0.012));
    head.add(e);
    return e;
  });
  // Big back feet, and a cotton tail.
  for (const leg of p.legs) if (!leg.userData.front) leg.add(mesh(sphere(), toon(p.light), 0, -0.17, 0.05, 0.04, 0.025, 0.075));
  for (const side of [-1, 1]) p.pivot.add(mesh(sphere(), toon(p.fur), side * 0.09, -0.04, 0.06, 0.06, 0.075, 0.08));
  p.tail.add(mesh(sphere(1, 12, 10), toon('#ffffff'), 0, 0, -0.02, 0.05));
  return { ...p, ears, earRest: -0.15, earFlap: 'tall', height: 0.55, pick: 0.28, hops: true };
}

function hamster(coat) {
  const m = QUAD.hamster;
  const p = quadruped(coat, m);
  const { head, H } = p;
  // Round white cheeks and tummy, little round ears, a pink nose.
  for (const side of [-1, 1]) head.add(mesh(sphere(1, 12, 10), toon('#fff8f0'), side * 0.06, -0.03, 0.04, 0.05, 0.045, 0.05));
  head.add(mesh(sphere(), toon(NOSE), 0, -0.012, H[2] + 0.003, 0.014, 0.011, 0.009));
  blush(head, H[2], 0.07, -0.02);
  const ears = [-1, 1].map((side) => {
    const e = new THREE.Group();
    e.position.set(side * 0.06, 0.075, -0.02);
    e.userData.side = side;
    e.add(mesh(sphere(1, 10, 8), toon(p.dark), 0, 0, 0, 0.032, 0.03, 0.012));
    e.add(mesh(sphere(1, 10, 8), toon(PINK), 0, 0, 0.006, 0.019, 0.018, 0.008));
    head.add(e);
    return e;
  });
  p.tail.add(mesh(sphere(1, 8, 6), toon(p.light), 0, -0.01, -0.01, 0.018));
  return { ...p, ears, earRest: 0, earFlap: 'none', height: 0.3, pick: 0.24, scurries: true };
}

function piglet(coat) {
  const m = QUAD.piglet;
  const p = quadruped(coat, { ...m, paw: shade(PET_COATS[coat] ?? PET_COATS.pink, -0.35) });
  const { head, H } = p;
  const snout = shade(p.fur, -0.08);
  head.add(mesh(cylinder(0.05, 0.052, 0.04, 16), toon(snout), 0, -0.03, H[2] * 0.95).rotateX(Math.PI / 2));
  for (const side of [-1, 1]) head.add(mesh(sphere(), toon(shade(p.fur, -0.45)), side * 0.018, -0.03, H[2] * 0.95 + 0.021, 0.009, 0.014, 0.006));
  blush(head, H[2], 0.085, -0.035);
  const ears = [-1, 1].map((side) => {
    const e = new THREE.Group();
    e.position.set(side * 0.075, 0.08, 0.01);
    e.userData.side = side;
    e.add(mesh(cone(0.05, 0.09, 3), toon(p.fur), 0, 0.04, 0, 1, 1, 0.35));
    e.add(mesh(cone(0.032, 0.06, 3), toon(PINK), 0, 0.034, 0.006, 1, 1, 0.3));
    head.add(e);
    return e;
  });
  // A curly tail.
  p.tail.add(mesh(torus(0.026, 0.009), toon(p.fur), 0, 0.012, -0.022).rotateY(Math.PI / 2));
  return { ...p, ears, earRest: 0.5, earFlap: 'flop', height: 0.45, pick: 0.3 };
}

function dragon(coat) {
  const m = QUAD.dragon;
  const fur = PET_COATS[coat] ?? PET_COATS.green;
  const p = quadruped(coat, { ...m, belly: '#fff0b8' });
  const { head, H, pivot } = p;
  const spike = shade(fur, -0.3);
  // A snout, nostrils, little horns, spikes down its back.
  head.add(mesh(sphere(), toon(fur), 0, -0.03, H[2] * 0.85, 0.075, 0.055, 0.075));
  for (const side of [-1, 1]) head.add(mesh(sphere(), toon(shade(fur, -0.5)), side * 0.025, -0.012, H[2] * 0.85 + 0.072, 0.008, 0.01, 0.006));
  blush(head, H[2], 0.08, -0.03);
  for (const side of [-1, 1]) head.add(mesh(cone(0.024, 0.075, 8), toon('#fff3d6'), side * 0.055, 0.1, -0.03).rotateX(-0.5).rotateZ(-side * 0.25));
  for (let i = 0; i < 4; i++) pivot.add(mesh(cone(0.022, 0.05, 6), toon(spike), 0, p.R[1] * 0.98 - i * 0.008, m.half + 0.11 - i * 0.075).rotateX(-0.35));
  // Plates across its pale belly.
  for (let i = 0; i < 4; i++) {
    const z = m.half + 0.1 - i * 0.07;
    pivot.add(mesh(torus(0.055 - i * 0.006, 0.012, Math.PI), toon(shade('#fff0b8', -0.12)), 0, -p.R[1] * 0.28, z).rotateX(Math.PI / 2 - 0.3));
  }
  // Wings at its shoulders, which flap in the air and fold away on the ground.
  const wings = wingPair(pivot, { x: 0.08, y: 0.075, z: m.half + 0.06, length: 0.24, width: 0.11, thick: 0.012, color: shade(fur, 0.35), tip: spike });
  // A long tail, in three bends that sway, with a spade at the end.
  const bends = [];
  let at = p.tail;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    if (i) b.position.z = -0.085;
    b.add(mesh(capsule(0.03 - i * 0.007, 0.06), toon(fur), 0, 0, -0.045).rotateX(Math.PI / 2));
    at.add(b);
    bends.push(b);
    at = b;
  }
  at.add(mesh(cone(0.035, 0.06, 4), toon(spike), 0, 0, -0.11).rotateX(-Math.PI / 2));
  p.tail.position.y -= 0.03;
  p.tail.rotation.x = 0.35;
  return { ...p, ears: [], earRest: 0, earFlap: 'none', bends, wings, height: 0.52, pick: 0.3, wingRate: 14 };
}

// ------------------------------------------------ two legs

const PARROTS = {
  green: { wing: '#3f86d1', tail: '#ef5b5b', face: '#fff6e8' },
  blue: { wing: '#2f6fc2', tail: '#3a5fb0', belly: '#ffd84d', face: '#ffffff' },
  red: { wing: '#ffd24a', tip: '#3f86d1', tail: '#c93f3f', face: '#ffffff' },
  yellow: { wing: '#5cc96b', tip: '#3f86d1', tail: '#f2b82e', face: '#fff6e8' },
};

// Shared by the duckling and the parrot: body, then a pivot at the middle of
// the body (leaning and bobbing), with the head on it.
function birdRig(y) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const roll = new THREE.Group();
  roll.position.y = y;
  body.add(roll);
  const pivot = new THREE.Group();
  roll.add(pivot);
  return { g, body, roll, pivot };
}

function duckling(coat) {
  const fur = PET_COATS[coat] ?? PET_COATS.yellow;
  const { g, body, roll, pivot } = birdRig(0.16);
  pivot.add(mesh(sphere(), toon(fur), 0, 0, -0.01, 0.105, 0.095, 0.125));
  pivot.add(mesh(cone(0.04, 0.07, 8), toon(fur), 0, 0.05, -0.13).rotateX(-1));
  const head = new THREE.Group();
  head.position.set(0, 0.13, 0.06);
  pivot.add(head);
  head.add(mesh(sphere(1, 18, 14), toon(fur), 0, 0, 0, 0.085));
  head.add(mesh(sphere(), toon(fur), 0, 0.085, -0.01, 0.018, 0.035, 0.012).rotateX(-0.4));
  const eyes = eyesOn(head, 0.085, 0.085, 0.085, 0.038, 0.018, 0.017);
  head.add(mesh(sphere(), toon(ORANGE), 0, -0.018, 0.085, 0.042, 0.014, 0.048));
  blush(head, 0.085, 0.055, -0.012);
  const band = collar(pivot, { y: 0.075, z: 0.05, r: 0.055, lean: 0.25, tag: false });
  const wings = [-1, 1].map((side) => {
    const w = new THREE.Group();
    w.position.set(side * 0.095, 0.02, -0.01);
    w.userData.wing = side;
    w.add(mesh(sphere(), toon(shade(fur, -0.08)), side * 0.01, -0.01, 0, 0.03, 0.06, 0.075));
    w.add(mesh(sphere(1, 10, 8), toon(shade(fur, -0.16)), side * 0.012, -0.035, -0.045, 0.024, 0.035, 0.045));
    pivot.add(w);
    return w;
  });
  const feet = [-1, 1].map((side) => {
    const f = new THREE.Group();
    f.position.set(side * 0.045, 0.06, 0.02);
    f.add(mesh(cylinder(0.01, 0.01, 0.06, 6), toon(ORANGE), 0, -0.03, 0));
    f.add(mesh(sphere(), toon(ORANGE), 0, -0.058, 0.025, 0.035, 0.01, 0.045));
    body.add(f);
    return f;
  });
  return { group: g, body, roll, pivot, head, eyes, wings, feet, band, tail: null, legs: [], ears: [], height: 0.38, pick: 0.24, bird: 'duck' };
}

function parrot(coat) {
  const fur = PET_COATS[coat] ?? PET_COATS.green;
  const k = PARROTS[coat] ?? PARROTS.green;
  const { g, body, roll, pivot } = birdRig(0.17);
  // Upright on a perch, level in the air (see the pitch in update).
  pivot.add(mesh(sphere(), toon(fur), 0, 0, 0, 0.085, 0.12, 0.09));
  if (k.belly) pivot.add(mesh(sphere(), toon(k.belly), 0, -0.02, 0.035, 0.065, 0.09, 0.06));
  const head = new THREE.Group();
  head.position.set(0, 0.13, 0.015);
  pivot.add(head);
  head.add(mesh(sphere(1, 18, 14), toon(fur), 0, 0, 0, 0.08));
  // A pale face round the eyes, and a big hooked beak over a little cere.
  for (const side of [-1, 1]) head.add(mesh(sphere(), toon(k.face), side * 0.04, 0.005, 0.05, 0.035, 0.035, 0.022));
  const eyes = eyesOn(head, 0.08, 0.08, 0.08, 0.04, 0.012, 0.016);
  const beak = toon('#e8a33d');
  head.add(mesh(sphere(1, 12, 10), toon('#f4f0e8'), 0, -0.004, 0.068, 0.024, 0.018, 0.018));
  const hook = mesh(cone(0.03, 0.06, 10), beak, 0, -0.03, 0.078);
  hook.rotation.x = Math.PI * 0.92;
  head.add(hook);
  const point = mesh(cone(0.018, 0.03, 8), toon('#c77f28'), 0, -0.052, 0.072);
  point.rotation.x = Math.PI * 0.55;
  head.add(point);
  blush(head, 0.08, 0.05, -0.02);
  const band = collar(pivot, { y: 0.085, z: 0.012, r: 0.05, lean: 0.1, tag: false });
  const tail = new THREE.Group();
  tail.position.set(0, -0.09, -0.04);
  pivot.add(tail);
  // Long tail feathers stepped down its back.
  for (const side of [-1, 0, 1]) tail.add(mesh(capsule(0.011, 0.13, 4, 8), toon(side ? k.tail : k.wing), side * 0.02, -0.09, -0.015).rotateX(-0.5).rotateZ(side * 0.18));
  const folded = [-1, 1].map((side) => {
    const f = new THREE.Group();
    f.position.set(side * 0.08, 0.035, -0.02);
    f.rotation.z = side * 0.12;
    f.add(mesh(sphere(), toon(k.wing), side * 0.008, -0.045, 0, 0.03, 0.105, 0.062));
    // Layered primaries reaching back past its body.
    const feathers = [];
    for (let i = 0; i < 3; i++) {
      feathers.push({ g: capsule(0.009, 0.08 - i * 0.012, 4, 8), m: new THREE.Matrix4().makeRotationZ(side * (0.25 + i * 0.15)).setPosition(side * 0.012, -0.08 - i * 0.012, -0.01 - i * 0.012) });
    }
    f.add(mesh(bakeCached(`parrot-primaries|${side}|${k.wing}`, feathers), toon(k.tip ?? k.tail)));
    pivot.add(f);
    return f;
  });
  const wings = wingPair(pivot, { x: 0.07, y: 0.04, length: 0.3, width: 0.1, color: k.wing, tip: k.tip ?? k.tail });
  const feet = [-1, 1].map((side) => {
    const f = new THREE.Group();
    f.position.set(side * 0.035, 0.05, 0.005);
    f.add(mesh(cylinder(0.009, 0.009, 0.05, 6), toon('#8a7f86'), 0, -0.025, 0));
    f.add(mesh(sphere(), toon('#8a7f86'), 0, -0.05, 0.012, 0.02, 0.009, 0.03));
    body.add(f);
    return f;
  });
  return { group: g, body, roll, pivot, head, eyes, wings, folded, feet, band, tail, legs: [], ears: [], height: 0.4, pick: 0.24, bird: 'parrot', wingRate: 24 };
}

const BUILDERS = { puppy, kitten, bunny, hamster, piglet, dragon, duckling, parrot };

// ------------------------------------------------ riding along

// Where a pet rides along, behind its owner, on each kind of animal and in
// each vehicle: how far behind its middle.
const SEATS = { pony: -0.5, unicorn: -0.5, reindeer: -0.5, cow: -0.52, elephant: -0.62, giraffe: -0.45, polarbear: -0.52, dolphin: -0.45, whale: -0.62, car: -0.63, boat: -0.75, digger: -0.55, minecart: -0.43, bus: 0.1, ferry: 0.1, helicopter: -0.42, balloon: -0.33, mosquito: -0.55 };
const seatTops = new Map();

// How high the top of a mount is there, standing still, measured once on a
// model of its own: the highest point under where the pet sits (its saddle
// left out, and anything up over it, such as a rotor or a balloon).
function seatTop(type) {
  if (seatTops.has(type)) return seatTops.get(type);
  const m = new CritterModel(type, 0);
  // At rest, not caught mid-roll (a model starts at a random time, and a boat rocks).
  m.time = 0;
  m.update(0, 'idle', false, 0);
  m.group.updateMatrixWorld(true);
  const z = SEATS[type] ?? -0.5;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  let top = 0;
  for (const dx of [-0.07, 0, 0.07]) {
    for (const dz of [-0.07, 0, 0.07]) {
      ray.set(new THREE.Vector3(dx, 8, z + dz), down);
      const hit = ray.intersectObject(m.group, true).find((h) => (!m.saddle || !isInside(h.object, m.saddle)) && (!m.over || !isInside(h.object, m.over)));
      if (hit) top = Math.max(top, hit.point.y);
    }
  }
  // Over its body as it stands, which bobs as it goes (see petSeat).
  top -= m.body.position.y;
  m.dispose();
  seatTops.set(type, top);
  return top;
}

const isInside = (o, group) => {
  for (; o; o = o.parent) if (o === group) return true;
  return false;
};

// Where a pet riding along sits, on the critter model its owner rides: its
// feet, and the way it faces (the mount's way).
export function petSeat(mount) {
  const g = mount.group;
  const z = SEATS[mount.type] ?? -0.5;
  const yaw = g.rotation.y;
  return { x: g.position.x + Math.sin(yaw) * z, y: g.position.y + seatTop(mount.type) + (mount.body?.position.y ?? 0), z: g.position.z + Math.cos(yaw) * z, yaw };
}

// How far its middle is out of each pose, for easing from one to the next.
const POSE_KEYS = ['drop', 'pitch', 'front', 'back', 'headX', 'headY', 'headZ', 'tail', 'ear', 'fold', 'open'];

export class PetModel {
  // pet: { kind, coat }; collarColor: the colour of its owner's T-shirt.
  constructor(pet, collarColor = '#ff6f6f') {
    const parts = (BUILDERS[pet.kind] ?? puppy)(pet.coat);
    Object.assign(this, parts);
    this.kind = BUILDERS[pet.kind] ? pet.kind : 'puppy';
    this.coat = pet.coat;
    this.time = Math.random() * 10;
    this.phase = 0;
    this.center = this.height * 0.45;
    this.seen = 70;
    this.pose = 'sit';
    this.since = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.cur = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
    this.cur.open = 1;
    this.hs = 0;
    this.vy = 0;
    this.last = null;
    this.setCollar(collarColor);
    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    const shadow = blobShadow((this.kind === 'hamster' || this.bird ? 0.16 : 0.22) * 1.25, 0.2);
    this.shadow = shadow;
  }

  setCollar(color) {
    this.band.color.set(color);
  }

  // How fast it is going and climbing, from where it has been put.
  track(dt) {
    const p = this.group.position;
    if (this.last && dt > 0) {
      const k = Math.min(1, dt * 8);
      this.hs += (Math.hypot(p.x - this.last.x, p.z - this.last.z) / dt - this.hs) * k;
      this.vy += ((p.y - this.last.y) / dt - this.vy) * k;
    }
    this.last = p.clone();
  }

  // pose: what it is doing (see petPose in shared/pets.js).
  update(dt, pose) {
    this.time += dt;
    this.dt = dt;
    if (pose !== this.pose) {
      this.pose = pose;
      this.since = 0;
    }
    this.since += dt;
    this.track(Math.max(dt, 1e-3));
    const want = this.bird ? this.birdPose(pose) : this.quadPose(pose);
    // Easing from pose to pose: sitting down, lying down, getting up.
    const k = 1 - Math.exp(-dt * 9);
    for (const key of POSE_KEYS) this.cur[key] += ((want[key] ?? (key === 'open' ? 1 : 0)) - this.cur[key]) * k;
    if (this.bird) this.applyBird(want);
    else this.applyQuad(want);
    // Blinking now and then, and eyes shut asleep.
    this.blinkAt -= dt;
    if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 3;
    if (this.eyes) this.eyes.scale.y = this.cur.open < 0.5 || this.blinkAt < 0.12 ? 0.12 : 1;
  }

  // Where its joints go for each pose, on four legs: drop (how far down it
  // sits), pitch (sitting up), front and back (its legs), its head, its tail
  // up, its ears, its wings folded (a dragon), and its eyes open.
  quadPose(pose) {
    const t = this.time;
    const m = QUAD[this.kind];
    const lie = -(m.y - m.torso[1]) * 0.98;
    const w = { drop: 0, pitch: 0, front: 0, back: 0, headX: 0, headY: 0, headZ: 0, tail: 0.6, ear: 0, fold: 1, open: 1 };
    // The walk, run, hop and paddle play over the pose.
    this.gait = null;
    this.wag = { rate: 3, size: 0.25 };
    this.spin = 0;
    this.rollOver = 0;
    this.bob = 0;
    switch (pose) {
      case 'walk':
      case 'run':
        this.gait = pose;
        w.tail = 0.4;
        this.wag = { rate: 9, size: 0.35 };
        break;
      case 'jump':
        w.front = -0.9;
        w.back = 0.8;
        w.headX = -0.2;
        w.tail = 0.2;
        break;
      case 'swim':
        this.gait = 'swim';
        w.pitch = -0.25;
        w.headX = 0.1;
        w.tail = 0;
        break;
      case 'sit':
        w.drop = lie * 0.6;
        w.pitch = -0.6;
        w.front = 0.6;
        w.back = -0.75;
        w.headX = 0.35;
        w.headY = this.glance(t);
        w.tail = 0.15;
        this.wag = { rate: 4, size: 0.3 };
        break;
      case 'beg':
        w.drop = lie * 0.45;
        w.pitch = -1.15;
        w.front = 0.55 + Math.sin(t * 9) * 0.15;
        w.back = -0.35;
        w.headX = 0.75;
        w.headZ = Math.sin(t * 3) * 0.2;
        w.tail = 0.3;
        this.wag = { rate: 16, size: 0.5 };
        break;
      case 'lie':
        w.drop = lie;
        w.front = -1.45;
        w.back = 1.45;
        w.headX = 0.25;
        w.headY = this.glance(t) * 0.6;
        w.tail = -0.2;
        this.wag = { rate: 2, size: 0.15 };
        break;
      case 'sleep':
      case 'nap':
        w.drop = lie;
        w.front = -1.45;
        w.back = 1.45;
        w.headX = 0.55;
        w.headZ = 0.25;
        w.tail = -0.4;
        w.ear = -0.3;
        w.open = 0;
        this.wag = { rate: 0.6, size: 0.05 };
        this.bob = Math.sin(t * 2) * 0.006;
        break;
      case 'happy':
        this.bob = Math.abs(Math.sin(t * 10)) * 0.08;
        w.headZ = Math.sin(t * 5) * 0.3;
        w.front = Math.sin(t * 10) * 0.3;
        w.tail = 0.8;
        w.ear = 0.3;
        this.wag = { rate: 18, size: 0.6 };
        break;
      case 'eat':
        w.headX = 0.55 + Math.max(0, Math.sin(t * 10)) * 0.15;
        w.tail = 0.7;
        this.wag = { rate: 14, size: 0.45 };
        break;
      case 'spin': {
        const k = ease(Math.min(1, this.since / 1.4));
        this.spin = k * Math.PI * 4;
        this.bob = Math.abs(Math.sin(k * Math.PI * 4)) * 0.06;
        w.tail = 0.8;
        this.wag = { rate: 16, size: 0.5 };
        break;
      }
      case 'roll': {
        // Down, over onto its back, legs up, and round onto its feet again.
        const k = ease(clamp((this.since - 0.25) / 1.4, 0, 1));
        w.drop = lie;
        this.rollOver = k * Math.PI * 2;
        const up = Math.sin(k * Math.PI);
        w.front = -0.6 * up;
        w.back = 0.6 * up;
        w.headX = -0.2 * up;
        break;
      }
      case 'fly':
      case 'hover':
        // A dragon in the air: legs tucked, wings beating.
        w.front = 0.6;
        w.back = 1.1;
        w.pitch = pose === 'hover' ? -0.35 : clamp(-this.vy * 0.06, -0.4, 0.4);
        w.headX = pose === 'hover' ? 0.3 : 0;
        w.tail = 0;
        w.fold = 0;
        break;
      default:
        // Standing: looking about.
        w.headY = this.glance(t);
        break;
    }
    return w;
  }

  // A look round now and then, as it sits.
  glance(t) {
    return Math.sin(t * 0.37 + this.coat.length) * 0.35 + Math.sin(t * 0.13) * 0.25;
  }

  applyQuad(w) {
    const t = this.time;
    const c = this.cur;
    const m = QUAD[this.kind];
    let pitch = c.pitch;
    let bob = this.bob;
    const legs = this.legs.map((leg) => (leg.userData.front ? c.front : c.back));
    const hs = Math.min(this.hs, 12);
    if (this.gait === 'swim') {
      this.phase += this.dt * 12;
      this.legs.forEach((leg, i) => (legs[i] += Math.sin(this.phase + (leg.userData.side > 0 ? Math.PI : 0) + (leg.userData.front ? 0 : 1.5)) * 0.6 + (leg.userData.front ? -0.5 : 0.4)));
      bob += Math.sin(t * 3) * 0.01;
    } else if (this.gait && this.hops) {
      // A bunny hops: up off its back feet, front paws out, and down.
      this.phase += this.dt * (6 + hs * 0.9);
      const s = Math.sin(this.phase);
      bob += Math.abs(s) * (0.06 + hs * 0.012);
      pitch += Math.cos(this.phase) * 0.2;
      this.legs.forEach((leg, i) => (legs[i] += leg.userData.front ? -Math.abs(s) * 0.7 : Math.abs(s) * 0.8));
    } else if (this.gait) {
      const run = this.gait === 'run' || hs > 6;
      this.phase += this.dt * ((this.scurries ? 14 : 5) + hs * (this.scurries ? 3 : 1.8));
      const swing = this.scurries ? 0.6 : run ? 0.85 : clamp(0.3 + hs * 0.08, 0.3, 0.6);
      this.legs.forEach((leg, i) => {
        const { side, front } = leg.userData;
        // A trot: each front leg with the back one across from it; a run:
        // front legs together, then back legs.
        const off = run ? (front ? 0 : Math.PI * 0.8) + (side > 0 ? 0.3 : 0) : (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0);
        legs[i] += Math.sin(this.phase + off) * swing;
      });
      bob += run ? Math.abs(Math.cos(this.phase)) * 0.045 : Math.abs(Math.sin(this.phase)) * 0.015;
      if (run) pitch += Math.sin(this.phase) * 0.08;
    }
    this.body.position.y = c.drop + bob;
    this.body.rotation.y = this.spin;
    this.roll.rotation.z = this.rollOver;
    this.pivot.rotation.x = pitch;
    this.legs.forEach((leg, i) => leg.rotation.set(legs[i], 0, 0));
    this.head.rotation.set(c.headX, c.headY, c.headZ);
    // Its tail: up, and wagging.
    if (this.tail) {
      const wag = Math.sin(t * this.wag.rate) * this.wag.size;
      if (this.kind === 'dragon') {
        this.tail.rotation.set(0.35 - c.tail * 0.3, wag * 0.6, 0);
        this.bends.forEach((b, i) => b.rotation.set(0.1, Math.sin(t * 2.2 - i * 0.8) * 0.25 + wag * 0.3, 0));
      } else if (this.kind === 'kitten') {
        // Up behind it, curling over at the tip; along the ground sitting.
        this.tail.rotation.set(-1.45 + c.tail * 1.5, 0, wag * 0.5);
        this.bends.forEach((b, i) => b.rotation.set(c.tail * (0.15 + i * 0.22), 0, Math.sin(t * 2.4 + i) * 0.12));
      } else {
        this.tail.rotation.set(-c.tail * 0.6, wag, 0);
      }
    }
    for (const e of this.ears) {
      const s = e.userData.side;
      if (this.earFlap === 'floppy') e.rotation.z = s * (this.earRest + c.ear * 0.5 + Math.abs(bob) * 2);
      // A bunny's ears lie back along it, asleep.
      else if (this.earFlap === 'tall') e.rotation.set(-0.15 - (1 - c.open) * 0.95 + c.ear * 0.2, 0, -s * 0.15);
      else if (this.earFlap === 'perk') e.rotation.z = -s * (0.28 - c.ear * 0.4);
      else if (this.earFlap === 'flop') e.rotation.set(1.05 - c.ear * 0.4 + Math.abs(bob) * 3, 0, -s * 0.45);
    }
    if (this.wings) {
      // Folded along its back on the ground; beating in the air.
      const flap = Math.sin(t * this.wingRate) * 0.9;
      for (const wg of this.wings) {
        const s = wg.userData.wing;
        wg.rotation.set(0, s * c.fold * 1.35, s * (c.fold * 0.55 + (1 - c.fold) * flap));
        wg.scale.setScalar(1 - c.fold * 0.45);
      }
    }
  }

  // Two legs: a duckling waddles, paddles and tucks its head in to sleep; a
  // parrot stands up straight, flies with its wings out, and bobs about.
  birdPose(pose) {
    const t = this.time;
    const w = { drop: 0, pitch: 0, headX: 0, headY: 0, headZ: 0, fold: 1, open: 1 };
    this.gait = null;
    this.spin = 0;
    this.rollOver = 0;
    this.bob = 0;
    this.flap = 0;
    const parrot = this.bird === 'parrot';
    switch (pose) {
      case 'walk':
      case 'run':
        this.gait = 'walk';
        break;
      case 'swim':
        this.gait = 'swim';
        w.drop = -0.04;
        break;
      case 'jump':
        this.flap = 1;
        break;
      case 'sit':
        w.drop = parrot ? 0 : -0.05;
        w.headY = Math.sin(t * 0.5) * 0.5;
        break;
      case 'perch':
        w.headY = Math.sin(t * 0.45) * 0.7 + Math.sin(t * 1.3) * 0.2;
        this.bob = Math.max(0, Math.sin(t * 2.2)) * 0.008;
        break;
      case 'lie':
        w.drop = parrot ? 0 : -0.06;
        break;
      case 'sleep':
      case 'nap':
        w.drop = parrot ? 0 : -0.06;
        w.headX = 0.5;
        w.headY = 2.2;
        w.open = 0;
        break;
      case 'beg':
        this.flap = 0.6;
        w.pitch = -0.2;
        this.bob = Math.abs(Math.sin(t * 8)) * 0.03;
        break;
      case 'happy':
        this.flap = 0.7;
        this.bob = Math.abs(Math.sin(t * 10)) * 0.06;
        w.headZ = Math.sin(t * 6) * 0.3;
        break;
      case 'eat':
        w.headX = 0.6 + Math.max(0, Math.sin(t * 10)) * 0.25;
        w.pitch = 0.2;
        break;
      case 'spin': {
        const k = ease(Math.min(1, this.since / 1.4));
        this.spin = k * Math.PI * 4;
        this.flap = 0.5;
        break;
      }
      case 'roll': {
        // Head over heels, a somersault.
        const k = ease(clamp((this.since - 0.2) / 1.2, 0, 1));
        this.bob = Math.sin(k * Math.PI) * 0.25;
        this.flip = k * Math.PI * 2;
        this.flap = 0.4;
        break;
      }
      case 'fly':
      case 'hover':
        w.fold = 0;
        w.pitch = pose === 'fly' ? clamp(0.35 - this.vy * 0.05, -0.1, 0.6) : 0;
        break;
      default:
        w.headY = Math.sin(t * 0.6) * 0.5;
        break;
    }
    if (pose !== 'roll') this.flip = 0;
    return w;
  }

  applyBird(w) {
    const t = this.time;
    const c = this.cur;
    const parrot = this.bird === 'parrot';
    let bob = this.bob;
    let rock = 0;
    if (this.gait === 'walk') {
      this.phase += this.dt * (10 + Math.min(this.hs, 12) * 1.5);
      rock = Math.sin(this.phase) * 0.15;
      bob += Math.abs(Math.sin(this.phase)) * 0.025;
    } else if (this.gait === 'swim') {
      bob += Math.sin(t * 2.4) * 0.012;
      rock = Math.sin(t * 1.7) * 0.05;
    }
    this.body.position.y = c.drop + bob;
    this.body.rotation.y = this.spin;
    this.roll.rotation.x = this.flip ?? 0;
    // A parrot stands up straight: leaning back, unless it flies.
    this.pivot.rotation.set(c.pitch + (parrot ? -0.3 * c.fold : 0), 0, rock);
    this.head.rotation.set(c.headX + (parrot ? 0.3 * c.fold : 0), c.headY, c.headZ);
    const flying = c.fold < 0.5;
    // Wings: out and beating in the air, flapping for joy, folded otherwise.
    const beat = Math.sin(t * (this.wingRate ?? 18));
    if (parrot) {
      for (const wg of this.wings) {
        wg.visible = flying;
        wg.rotation.z = wg.userData.wing * beat * 0.85;
      }
      this.folded.forEach((f, i) => {
        f.visible = !flying;
        f.rotation.z = (i ? 1 : -1) * this.flap * Math.max(0, Math.sin(t * 16)) * 0.9;
      });
      this.tail.rotation.x = flying ? 1.1 : 0.15 + Math.sin(t * 2) * 0.04;
    } else {
      for (const wg of this.wings) wg.rotation.z = wg.userData.wing * (0.1 + this.flap * Math.max(0, Math.sin(t * 18)) * 0.9);
    }
    // Feet tucked away in the air and in the water; stepping as it walks.
    this.feet.forEach((f, i) => {
      f.visible = !flying && this.gait !== 'swim' && c.drop > -0.03;
      f.rotation.x = this.gait === 'walk' ? Math.sin(this.phase + i * Math.PI) * 0.5 : 0;
    });
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.band.dispose();
  }
}
