// The animal friends as little models: bunnies that hop, chicks that peck,
// fluffy sheep, ducks that paddle about, butterflies that flutter, birds,
// owls, bees and seagulls; in the sea, schools of fish, dolphins, a whale,
// turtles, crabs and octopuses; and big ones to ride: ponies, cows, an
// elephant, a giraffe, reindeer, polar bears and unicorns. The vehicles,
// which live with them, are in vehicle-models.js.
import * as THREE from '../../vendor/three.module.js';
import { capsule, cone, cylinder, mesh, onSurface, sphere, toon, torus } from './toon.js';
import { drive, VEHICLE_BUILDERS } from './vehicle-models.js';

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
export function wingPair(parent, { x, y, z = 0, length, width, thick = 0.016, color, tip = null, material = null }) {
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

export function eyesOn(group, rx, ry, rz, spread, y, size = 0.03) {
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

// The sea creatures. The swimmers' models are centred on their middle (center
// 0), where the sim puts them; crabs, turtles and octopuses stand on things.

const FISH = [
  { body: '#ff8a3d', stripe: '#ffffff', fin: '#ff6a1f' }, // clownfish
  { body: '#3d8bff', stripe: '#ffd23f', fin: '#ffd23f' }, // blue tang
  { body: '#ffd23f', stripe: '#fff3b0', fin: '#ffb020' }, // yellow tang
  { body: '#c77dff', stripe: '#ffe066', fin: '#9b4dff' }, // royal gramma
  { body: '#5fd38d', stripe: '#e8fff0', fin: '#2fae66' },
];

// A little school of three, swimming together.
function fish(id) {
  const k = FISH[id % FISH.length];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fishes = [
    [0, 0, 0.12, 1],
    [-0.22, 0.07, -0.1, 0.85],
    [0.21, -0.06, -0.14, 0.9],
  ].map(([x, y, z, size]) => {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    f.scale.setScalar(size);
    f.userData.home = f.position.clone();
    f.add(mesh(sphere(), toon(k.body), 0, 0, 0, 0.045, 0.075, 0.12));
    f.add(mesh(sphere(), toon(k.stripe), 0, 0, 0.02, 0.048, 0.078, 0.025));
    const tail = new THREE.Group();
    tail.position.z = -0.1;
    tail.add(mesh(cone(0.07, 0.1, 4), toon(k.fin), 0, 0, -0.05, 0.3, 1, 1).rotateX(Math.PI / 2));
    f.add(tail);
    f.userData.tail = tail;
    // Fish have their eyes on their sides.
    for (const side of [-1, 1]) f.add(mesh(sphere(1, 8, 6), toon(BLACK), side * 0.038, 0.02, 0.07, 0.014));
    body.add(f);
    return f;
  });
  return { group: g, body, head: body, eyes: null, fishes, height: 0.2, center: 0, shadow: 0, tiny: true, pick: 0.45, seen: 40 };
}

function dolphin() {
  const skin = toon('#7aa6d6');
  const pale = toon('#e3eef8');
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  body.add(pivot);
  pivot.add(mesh(sphere(), skin, 0, 0, 0, 0.2, 0.22, 0.62));
  pivot.add(mesh(sphere(), pale, 0, -0.07, 0.08, 0.16, 0.14, 0.5));
  const head = new THREE.Group();
  head.position.set(0, 0.04, 0.5);
  pivot.add(head);
  head.add(mesh(sphere(), skin, 0, 0, 0, 0.15, 0.15, 0.17));
  head.add(mesh(cone(0.06, 0.2, 10), pale, 0, -0.07, 0.2).rotateX(Math.PI / 2));
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const e = onSurface(0.15, 0.15, 0.17, side * 0.1, 0.03, 0.003);
    eyes.add(mesh(sphere(1, 10, 8), toon(BLACK), e.x, e.y, e.z, 0.024));
    eyes.add(mesh(sphere(1, 6, 4), toon(WHITE, { emissive: 0.5 }), e.x + side * 0.004, e.y + 0.012, e.z + 0.01, 0.008));
  }
  head.add(eyes);
  pivot.add(mesh(cone(0.09, 0.22, 4), skin, 0, 0.27, -0.08, 0.35, 1, 1).rotateX(-0.55));
  for (const side of [-1, 1]) pivot.add(mesh(sphere(), skin, side * 0.2, -0.1, 0.2, 0.12, 0.02, 0.06).rotateY(-side * 0.5).rotateZ(side * 0.4));
  const tail = new THREE.Group();
  tail.position.z = -0.5;
  pivot.add(tail);
  tail.add(mesh(sphere(), skin, 0, 0, -0.15, 0.1, 0.11, 0.25));
  tail.add(mesh(sphere(), skin, 0, 0, -0.38, 0.26, 0.025, 0.09));
  return { group: g, body, pivot, head, eyes, tail, height: 0.45, center: 0, shadow: 0, pick: 0.6, seen: 90 };
}

function whale() {
  const skin = toon('#4d7fc4');
  const pale = toon('#dce8f5');
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  body.add(pivot);
  const R = [0.62, 0.55, 1.45];
  pivot.add(mesh(sphere(), skin, 0, 0, 0, ...R));
  pivot.add(mesh(sphere(), pale, 0, -0.2, 0.25, 0.5, 0.38, 1.2));
  // Its blowhole, on top towards the front.
  pivot.add(mesh(sphere(), toon('#2d4f7c'), 0, 0.535, 0.55, 0.08, 0.02, 0.05));
  const head = new THREE.Group();
  pivot.add(head);
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const e = onSurface(...R, side * 0.45, -0.06, 0.004);
    const eye = alongSurface(new THREE.Group(), ...R, e);
    eye.position.copy(e);
    eye.add(mesh(sphere(1, 10, 8), toon(BLACK), 0, 0, 0, 0.055, 0.065, 0.03));
    eye.add(mesh(sphere(1, 6, 4), toon(WHITE, { emissive: 0.5 }), 0.012, 0.025, 0.025, 0.018));
    eyes.add(eye);
  }
  head.add(eyes);
  for (const side of [-1, 1]) pivot.add(mesh(sphere(), skin, side * 0.62, -0.28, 0.35, 0.32, 0.04, 0.14).rotateY(-side * 0.6).rotateZ(side * 0.35));
  const tail = new THREE.Group();
  tail.position.z = -1.25;
  pivot.add(tail);
  tail.add(mesh(sphere(), skin, 0, 0.02, -0.35, 0.26, 0.24, 0.6));
  for (const side of [-1, 1]) tail.add(mesh(sphere(), skin, side * 0.36, 0.02, -0.92, 0.42, 0.045, 0.2).rotateY(side * 0.45));
  return { group: g, body, pivot, head, eyes, tail, height: 1.1, center: 0, shadow: 0, pick: 1.2, seen: 160 };
}

function turtle() {
  const SKIN = '#a8d672';
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.14;
  body.add(pivot);
  const SHELL = [0.27, 0.13, 0.32];
  pivot.add(mesh(sphere(), toon('#3f8f57'), 0, 0.03, 0, ...SHELL));
  pivot.add(mesh(sphere(), toon('#f2e6b0'), 0, -0.02, 0, 0.24, 0.05, 0.29));
  // Paler plates on top of its shell.
  for (const [x, z] of [[0, 0], [-0.13, 0.09], [0.13, 0.09], [-0.13, -0.1], [0.13, -0.1]]) {
    const top = new THREE.Vector3(x, SHELL[1] * Math.sqrt(Math.max(0, 1 - (x / SHELL[0]) ** 2 - (z / SHELL[2]) ** 2)), z);
    const plate = mesh(sphere(), toon('#6fbf7a'), top.x, top.y + 0.03, top.z, 0.07, 0.07, 0.012);
    plate.quaternion.setFromUnitVectors(Z, new THREE.Vector3(top.x / SHELL[0] ** 2, top.y / SHELL[1] ** 2, top.z / SHELL[2] ** 2).normalize());
    pivot.add(plate);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.04, 0.38);
  pivot.add(head);
  head.add(mesh(sphere(), toon(SKIN), 0, 0, 0, 0.085, 0.08, 0.1));
  const eyes = eyesOn(head, 0.085, 0.08, 0.1, 0.045, 0.02, 0.016);
  // Flippers: front ones bigger. Each hangs from its own side, reaching out.
  const flippers = [
    [1, 0.22, 0.15, 0.14],
    [-1, 0.22, 0.15, 0.14],
    [1, 0.18, -0.2, 0.08],
    [-1, 0.18, -0.2, 0.08],
  ].map(([side, x, z, len]) => {
    const f = new THREE.Group();
    f.position.set(side * x, -0.03, z);
    f.userData.side = side;
    f.userData.front = z > 0;
    f.add(mesh(sphere(), toon(SKIN), side * len * 0.8, 0, 0.02, len, 0.022, len * 0.45));
    pivot.add(f);
    return f;
  });
  pivot.add(mesh(cone(0.03, 0.08, 6), toon(SKIN), 0, -0.02, -0.34).rotateX(-Math.PI / 2));
  return { group: g, body, pivot, head, eyes, flippers, height: 0.32, shadow: 0.3, pick: 0.45 };
}

const CRABS = ['#ff6b4a', '#ff8a3d', '#e8504f'];

// A crab faces +z, and walks off to its sides.
function crab(id) {
  const shell = toon(CRABS[id % CRABS.length]);
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.1;
  body.add(pivot);
  pivot.add(mesh(sphere(), shell, 0, 0, 0, 0.17, 0.08, 0.13));
  // Eyes on stalks.
  const head = new THREE.Group();
  head.position.set(0, 0.05, 0.08);
  pivot.add(head);
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    head.add(mesh(cylinder(0.011, 0.011, 0.09, 6), shell, side * 0.05, 0.045, 0));
    eyes.add(mesh(sphere(1, 10, 8), toon(BLACK), side * 0.05, 0.1, 0, 0.026));
    eyes.add(mesh(sphere(1, 6, 4), toon(WHITE, { emissive: 0.5 }), side * 0.057, 0.112, 0.02, 0.008));
  }
  head.add(eyes);
  // Claws: an arm, a lower jaw, and an upper jaw that snaps.
  const claws = [-1, 1].map((side) => {
    const c = new THREE.Group();
    c.position.set(side * 0.13, 0, 0.08);
    c.rotation.y = side * 0.45;
    c.userData.side = side;
    c.add(mesh(cylinder(0.022, 0.022, 0.1, 8), shell, 0, 0, 0.05).rotateX(Math.PI / 2));
    c.add(mesh(sphere(), shell, 0, -0.005, 0.13, 0.045, 0.028, 0.06));
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.012, 0.09);
    jaw.add(mesh(sphere(), shell, 0, 0.012, 0.045, 0.038, 0.022, 0.055));
    c.add(jaw);
    c.userData.jaw = jaw;
    pivot.add(c);
    return c;
  });
  const legs = [];
  for (const side of [-1, 1]) {
    for (const z of [0.06, -0.01, -0.08]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.15, 0, z);
      leg.rotation.z = -side * 1.05;
      leg.userData.side = side;
      leg.add(mesh(cylinder(0.008, 0.013, 0.14, 6), shell, 0, -0.07, 0));
      pivot.add(leg);
      legs.push(leg);
    }
  }
  return { group: g, body, pivot, head, eyes, claws, legs, height: 0.25, shadow: 0.2, pick: 0.35, seen: 40 };
}

const OCTOPUS = ['#ff7eb6', '#b07cff', '#ff9a4d', '#ff6b6b'];

function octopus(id) {
  const color = OCTOPUS[id % OCTOPUS.length];
  // Its own material, to change colour when it is happy.
  const skin = toon(color).clone();
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const head = new THREE.Group();
  head.position.y = 0.38;
  body.add(head);
  head.add(mesh(sphere(), skin, 0, 0, 0, 0.17, 0.2, 0.17));
  const eyes = eyesOn(head, 0.17, 0.2, 0.17, 0.065, -0.06, 0.034);
  const tentacles = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.Group();
    t.position.set(Math.sin(a) * 0.1, 0.22, Math.cos(a) * 0.1);
    t.rotation.y = a;
    const arm = new THREE.Group();
    arm.add(mesh(cone(0.065, 0.4, 8), skin, 0, -0.2, 0).rotateX(Math.PI));
    // A curl at the end.
    arm.add(mesh(sphere(1, 8, 6), skin, 0, -0.39, 0.025, 0.024));
    t.add(arm);
    t.userData.arm = arm;
    body.add(t);
    tentacles.push(t);
  }
  return { group: g, body, head, eyes, tentacles, skin, color, height: 0.58, shadow: 0.25, pick: 0.4 };
}

// Penguins and seals, on the shore of a snowy island and in the sea by it.

function penguin() {
  const back = toon('#2f3440');
  const white = toon('#fbfbf8');
  const orange = toon('#ffa53a');
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  // Turning about its middle: upright, or flat out on its tummy.
  const pivot = new THREE.Group();
  pivot.position.y = 0.3;
  body.add(pivot);
  pivot.add(mesh(sphere(), back, 0, 0, -0.01, 0.17, 0.26, 0.15));
  pivot.add(mesh(sphere(), white, 0, -0.03, 0.065, 0.13, 0.21, 0.1));
  const head = new THREE.Group();
  head.position.set(0, 0.25, 0.01);
  pivot.add(head);
  head.add(mesh(sphere(), back, 0, 0, 0, 0.12));
  const face = onSurface(0.12, 0.12, 0.12, 0, -0.01, -0.012);
  head.add(alongSurface(mesh(sphere(), white, face.x, face.y, face.z, 0.085, 0.07, 0.03), 0.12, 0.12, 0.12, face));
  const eyes = eyesOn(head, 0.12, 0.12, 0.12, 0.045, 0.02, 0.018);
  head.add(mesh(cone(0.03, 0.08, 8), orange, 0, -0.025, 0.14).rotateX(Math.PI / 2));
  for (const side of [-1, 1]) {
    const p = onSurface(0.12, 0.12, 0.12, side * 0.07, -0.04, 0.002);
    head.add(alongSurface(mesh(sphere(), toon('#ff9fb8'), p.x, p.y, p.z, 0.022, 0.016, 0.006), 0.12, 0.12, 0.12, p));
  }
  // Flippers hang from its shoulders; one angle (times the side) lifts both out.
  const flippers = [-1, 1].map((side) => {
    const f = new THREE.Group();
    f.position.set(side * 0.15, 0.08, 0);
    f.userData.side = side;
    f.add(mesh(sphere(), back, side * 0.02, -0.12, 0, 0.035, 0.14, 0.07));
    pivot.add(f);
    return f;
  });
  const feet = [-1, 1].map((side) => {
    const f = mesh(sphere(), orange, side * 0.065, 0.015, 0.06, 0.05, 0.018, 0.075);
    body.add(f);
    return f;
  });
  return { group: g, body, pivot, head, eyes, flippers, feet, height: 0.62, shadow: 0.22, pick: 0.42 };
}

function seal() {
  const grey = toon('#9aa6b2');
  const pale = toon('#dde2e8');
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = 0.17;
  body.add(pivot);
  pivot.add(mesh(sphere(), grey, 0, 0, -0.05, 0.2, 0.17, 0.4));
  pivot.add(mesh(sphere(), pale, 0, -0.07, 0.02, 0.16, 0.1, 0.32));
  const head = new THREE.Group();
  head.position.set(0, 0.14, 0.33);
  pivot.add(head);
  head.add(mesh(sphere(), grey, 0, 0, 0, 0.14, 0.13, 0.14));
  head.add(mesh(sphere(), pale, 0, -0.035, 0.12, 0.075, 0.055, 0.06));
  head.add(mesh(sphere(1, 8, 6), toon(BLACK), 0, -0.005, 0.175, 0.022, 0.016, 0.014));
  const eyes = eyesOn(head, 0.14, 0.13, 0.14, 0.055, 0.035, 0.03);
  // A ball to play with, on its nose.
  const ball = new THREE.Group();
  ball.position.set(0, 0.2, 0.1);
  ball.add(mesh(sphere(), toon('#ff5a5a'), 0, 0, 0, 0.085));
  ball.add(mesh(sphere(), toon(WHITE), 0, 0, 0, 0.087, 0.03, 0.087));
  ball.visible = false;
  head.add(ball);
  const flippers = [-1, 1].map((side) => {
    const f = new THREE.Group();
    f.position.set(side * 0.16, -0.08, 0.15);
    f.userData.side = side;
    f.add(mesh(sphere(), grey, side * 0.07, 0, 0, 0.09, 0.02, 0.05));
    pivot.add(f);
    return f;
  });
  const tail = new THREE.Group();
  tail.position.set(0, -0.03, -0.42);
  pivot.add(tail);
  for (const side of [-1, 1]) tail.add(mesh(sphere(), grey, side * 0.05, 0, -0.07, 0.07, 0.02, 0.1).rotateY(side * 0.4));
  return { group: g, body, pivot, head, eyes, flippers, tail, ball, height: 0.42, shadow: 0.32, pick: 0.45 };
}

// ------------------------------------------------ big animals

// The big animals share a rig, facing +z: a body that bobs, a pivot at the
// middle of the body that pitches (galloping, rearing, jumping) with four
// legs hung from it, a neck that bends down to graze with the head on the
// end of it, a tail, and a saddle that shows while someone rides. Their feet
// are at the origin, where the sim puts them.

function bigRig(y) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pivot = new THREE.Group();
  pivot.position.y = y;
  body.add(pivot);
  return { g, body, pivot };
}

// Four legs, each turning about its hip (hip: how far under the pivot): the
// front ones at z = front, the back ones at z = back, x out to either side.
function fourLegs(pivot, { x, front, back, hip, len, r, color, hoof = null, knees = false, paw = null }) {
  const shin = hoof ? len - 0.06 : len;
  return [
    [-1, front],
    [1, front],
    [-1, back],
    [1, back],
  ].map(([side, z]) => {
    const leg = new THREE.Group();
    leg.position.set(side * x, hip, z);
    leg.userData = { side, front: z > 0 };
    leg.add(mesh(cylinder(r * 0.85, r, shin, 10), toon(color), 0, -shin / 2, 0));
    if (hoof) leg.add(mesh(cylinder(r * 0.95, r * 1.08, 0.07, 10), toon(hoof), 0, -len + 0.035, 0));
    if (knees) leg.add(mesh(sphere(1, 10, 8), toon(color), 0, -len * 0.5, 0, r * 1.3));
    if (paw) leg.add(mesh(sphere(), toon(paw), 0, -len + 0.04, 0.03, r * 1.15, 0.06, r * 1.35));
    pivot.add(leg);
    return leg;
  });
}

// A saddle on the back (top: the top of the back over the pivot), coloured
// as its rider's T-shirt: so its own material. A big animal's is a thick
// blanket with a golden cushion on it.
function saddle(pivot, top, rx, rz, z = 0, blanket = false) {
  const pad = toon('#ff6f6f').clone();
  const s = new THREE.Group();
  s.position.set(0, top, z);
  s.add(mesh(sphere(), pad, 0, blanket ? -0.03 : -0.012, 0, rx, blanket ? 0.09 : 0.05, rz));
  s.add(mesh(sphere(), toon(blanket ? '#ffcf3f' : '#8a5634'), 0, blanket ? 0.03 : 0.012, -0.02, rx * 0.55, 0.035, rz * 0.55));
  s.visible = false;
  pivot.add(s);
  return { saddle: s, pad };
}

// Eyes on either side of a long head, in a group of their own at the height
// of the eyes, so that closing them only squashes them.
function sideEyes(head, x, y, z, size) {
  const eyes = new THREE.Group();
  eyes.position.set(0, y, z);
  for (const side of [-1, 1]) {
    eyes.add(mesh(sphere(1, 12, 10), toon(BLACK), side * x, 0, 0, size * 0.75, size, size));
    eyes.add(mesh(sphere(1, 6, 4), toon(WHITE, { emissive: 0.5 }), side * (x + size * 0.45), size * 0.4, size * 0.4, size * 0.32));
  }
  head.add(eyes);
  return eyes;
}

// A patch of colour lying on an ellipsoid (radii R, centred on the parent's
// origin), where the way (dx, dy, dz) from its middle comes out.
function patch(parent, color, R, [dx, dy, dz], w, h) {
  const k = 1 / Math.hypot(dx / R[0], dy / R[1], dz / R[2]);
  const p = new THREE.Vector3(dx * k, dy * k, dz * k);
  const m = alongSurface(mesh(sphere(1, 12, 8), toon(color), 0, 0, 0, w, h, 0.03), ...R, p);
  m.position.copy(p);
  parent.add(m);
  return m;
}

const PONIES = [
  { coat: '#b8814f', mane: '#5c3a24', nose: '#4a3326' }, // bay
  { coat: '#f1ece4', mane: '#b9ada0', nose: '#d4c4b4' }, // grey
  { coat: '#d9a85f', mane: '#fbeed3', nose: '#a87a42' }, // palomino
  { coat: '#4a4245', mane: '#211d1f', nose: '#2c2729' }, // black
  { coat: '#a85a32', mane: '#ecd2a8', nose: '#6e3a1f' }, // chestnut
];
const RAINBOW = ['#ff9ec7', '#ffc48a', '#fff08a', '#9be7a8', '#8fd3ff', '#c7a4ff'];
const RED_NOSE = '#ff3b3b';

// A pony, and its cousins the unicorn (white, with a rainbow mane and tail
// and a golden horn) and the reindeer (antlers, a pale ruff, and a bell; now
// and then a shiny red nose).
function pony(id, kind = 'pony') {
  const unicorn = kind === 'unicorn';
  const deer = kind === 'reindeer';
  const k = unicorn
    ? { coat: '#fff7fb', mane: RAINBOW[0], nose: '#ffd9ea', hoof: '#f2b6d6' }
    : deer
      ? { coat: '#9c6b48', mane: '#ecdfca', nose: '#7b5236', tip: id % 4 === 1 ? RED_NOSE : '#2b2226', hoof: '#3b2f2a' }
      : { ...PONIES[id % PONIES.length], hoof: '#3a3030' };
  const { g, body, pivot } = bigRig(0.82);
  const coat = toon(k.coat);
  const mane = (i) => toon(unicorn ? RAINBOW[i % RAINBOW.length] : k.mane);
  const R = [0.3, 0.27, 0.58];
  pivot.add(mesh(sphere(), coat, 0, 0, 0, ...R));
  pivot.add(mesh(sphere(), coat, 0, 0.01, 0.3, 0.27, 0.27, 0.28));
  pivot.add(mesh(sphere(), coat, 0, 0.02, -0.3, 0.29, 0.26, 0.28));
  if (deer) {
    // A pale chest and rump.
    pivot.add(mesh(sphere(), toon(k.mane), 0, -0.04, 0.44, 0.2, 0.2, 0.13));
    pivot.add(mesh(sphere(), toon(k.mane), 0, 0.03, -0.53, 0.17, 0.17, 0.1));
  }
  const legs = fourLegs(pivot, { x: 0.17, front: 0.36, back: -0.36, hip: -0.18, len: 0.64, r: 0.075, color: k.coat, hoof: k.hoof });

  const neck = new THREE.Group();
  neck.position.set(0, 0.14, 0.42);
  pivot.add(neck);
  const n = new THREE.Group();
  n.rotation.x = 0.6;
  neck.add(n);
  n.add(mesh(capsule(0.13, 0.28), coat, 0, 0.2, 0));
  // The mane, down the back of the neck; a reindeer's ruff, under it.
  for (let i = 0; i < 6; i++) {
    const t = 0.04 + i * 0.07;
    if (deer) n.add(mesh(sphere(1, 10, 8), mane(i), 0, t - 0.04, 0.1, 0.1, 0.09, 0.07));
    else n.add(mesh(sphere(1, 10, 8), mane(i), 0, t, -0.1, 0.055, 0.075, 0.07));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.44, 0.02);
  head.rotation.x = -0.15;
  n.add(head);
  head.add(mesh(sphere(), coat, 0, 0, 0.05, 0.13, 0.145, 0.21));
  head.add(mesh(sphere(), toon(k.nose), 0, -0.04, 0.22, 0.105, 0.095, 0.105));
  if (k.tip) head.add(mesh(sphere(), toon(k.tip, { emissive: k.tip === RED_NOSE ? 0.6 : 0 }), 0, -0.015, 0.315, 0.05, 0.04, 0.035));
  else for (const side of [-1, 1]) head.add(mesh(sphere(1, 8, 6), toon('#3a2a2a'), side * 0.045, -0.01, 0.32, 0.018, 0.024, 0.012));
  const eyes = sideEyes(head, 0.115, 0.06, 0.07, 0.032);
  for (const side of [-1, 1]) {
    const ear = mesh(cone(0.045, 0.13, 8), coat, side * 0.07, 0.16, -0.06);
    ear.rotation.z = -side * 0.3;
    head.add(ear);
  }
  // A forelock, between the ears.
  head.add(mesh(sphere(1, 10, 8), mane(2), 0, 0.13, 0.03, 0.07, 0.05, 0.08));
  if (unicorn) {
    const horn = new THREE.Group();
    horn.position.set(0, 0.17, 0.1);
    horn.rotation.x = 0.55;
    horn.add(mesh(cone(0.04, 0.3, 12), toon('#ffd34f', { emissive: 0.25 }), 0, 0.15, 0));
    for (let i = 0; i < 3; i++) horn.add(mesh(torus(0.033 - i * 0.009, 0.007), toon('#ffe9a6', { emissive: 0.3 }), 0, 0.05 + i * 0.07, 0).rotateX(Math.PI / 2 - 0.25));
    head.add(horn);
  }
  if (deer) {
    // Antlers: a beam up and out from each side of the head, with tines.
    const bone = toon('#e3cfa8');
    for (const side of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(side * 0.06, 0.15, -0.04);
      a.rotation.set(-0.35, 0, -side * 0.45);
      a.add(mesh(cylinder(0.018, 0.026, 0.36, 6), bone, 0, 0.18, 0));
      for (const [y, lean, len] of [
        [0.12, 0.9, 0.13],
        [0.24, 0.8, 0.12],
        [0.34, -0.5, 0.1],
      ]) {
        a.add(mesh(cylinder(0.012, 0.016, len, 6), bone, 0, y + len * 0.4, len * 0.35).rotateX(lean));
      }
      head.add(a);
    }
    // A red collar, with a bell under the chin.
    neck.add(mesh(torus(0.15, 0.025), toon('#e8413c'), 0, 0.05, 0.03).rotateX(Math.PI / 2 - 0.5));
    neck.add(mesh(sphere(), toon('#ffcf3f', { emissive: 0.2 }), 0, -0.08, 0.14, 0.045));
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.58);
  pivot.add(tail);
  if (unicorn) {
    RAINBOW.forEach((color, i) => tail.add(mesh(sphere(1, 10, 8), toon(color), (i - 2.5) * 0.025, -0.2 - (i % 2) * 0.03, -0.1, 0.035, 0.28, 0.05).rotateX(0.35)));
  } else if (deer) {
    tail.add(mesh(sphere(1, 10, 8), toon('#fbf6ee'), 0, -0.02, -0.04, 0.07, 0.09, 0.06));
  } else {
    tail.add(mesh(sphere(1, 10, 8), mane(0), 0, -0.22, -0.09, 0.075, 0.3, 0.08).rotateX(0.35));
  }
  const s = saddle(pivot, R[1], 0.3, 0.27);
  return {
    group: g,
    body,
    pivot,
    neck,
    head,
    eyes,
    tail,
    legs,
    ...s,
    height: deer ? 1.95 : unicorn ? 1.75 : 1.62,
    shadow: 0.55,
    pick: 0.75,
    center: 0.95,
    seen: 110,
    gait: { len: 0.64, run: 4.5, happy: 'rear', graze: 0.95 },
  };
}

function unicorn(id) {
  const u = pony(id, 'unicorn');
  // A little bigger than a pony.
  u.body.scale.setScalar(1.07);
  return u;
}

const reindeer = (id) => pony(id, 'reindeer');

function cow(id) {
  const { g, body, pivot } = bigRig(0.8);
  const white = toon('#fbfbf7');
  const dark = id % 3 === 1 ? '#8a5a3c' : '#3a3438';
  const R = [0.34, 0.31, 0.6];
  pivot.add(mesh(sphere(), white, 0, 0, 0, ...R));
  // Patches on its sides and back.
  for (const [dx, dy, dz, w, h] of [
    [1, 0.3, 0.3, 0.17, 0.13],
    [1, -0.1, -0.45, 0.14, 0.12],
    [-1, 0.2, -0.1, 0.19, 0.14],
    [-1, -0.2, 0.55, 0.12, 0.1],
    [0.2, 1, -0.6, 0.15, 0.12],
  ]) {
    patch(pivot, dark, R, [dx, dy, dz], w, h);
  }
  // Its udder.
  pivot.add(mesh(sphere(), toon('#ffb8c8'), 0, -0.29, -0.3, 0.11, 0.07, 0.1));
  const legs = fourLegs(pivot, { x: 0.2, front: 0.38, back: -0.38, hip: -0.16, len: 0.64, r: 0.08, color: '#fbfbf7', hoof: '#4a4045' });
  const neck = new THREE.Group();
  neck.position.set(0, 0.1, 0.5);
  pivot.add(neck);
  const n = new THREE.Group();
  n.rotation.x = 0.95;
  neck.add(n);
  n.add(mesh(capsule(0.15, 0.12), white, 0, 0.1, 0));
  const head = new THREE.Group();
  head.position.set(0, 0.26, 0.02);
  head.rotation.x = -0.75;
  n.add(head);
  head.add(mesh(sphere(), white, 0, 0, 0.04, 0.16, 0.16, 0.19));
  head.add(mesh(sphere(), toon(dark), 0.06, 0.07, 0.08, 0.08, 0.07, 0.06));
  head.add(mesh(sphere(), toon('#ffc4cf'), 0, -0.06, 0.19, 0.14, 0.1, 0.1));
  for (const side of [-1, 1]) {
    head.add(mesh(sphere(1, 8, 6), toon('#b8606f'), side * 0.05, -0.05, 0.285, 0.022, 0.026, 0.012));
    const horn = mesh(cone(0.03, 0.12, 8), toon('#f3e6c4'), side * 0.11, 0.16, -0.02);
    horn.rotation.z = -side * 0.9;
    head.add(horn);
    const ear = mesh(sphere(), white, side * 0.19, 0.08, -0.05, 0.08, 0.035, 0.05);
    ear.rotation.z = side * 0.3;
    head.add(ear);
  }
  const eyes = sideEyes(head, 0.12, 0.06, 0.1, 0.03);
  // A bell on a red strap.
  neck.add(mesh(torus(0.16, 0.024), toon('#e8413c'), 0, 0.02, 0.06).rotateX(Math.PI / 2 - 0.9));
  neck.add(mesh(cylinder(0.045, 0.06, 0.09, 10), toon('#ffcf3f', { emissive: 0.2 }), 0, -0.13, 0.17));
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.6);
  pivot.add(tail);
  tail.add(mesh(cylinder(0.015, 0.015, 0.4, 6), white, 0, -0.2, -0.02));
  tail.add(mesh(sphere(1, 8, 6), toon(dark), 0, -0.42, -0.02, 0.05, 0.08, 0.05));
  const s = saddle(pivot, R[1], 0.33, 0.28);
  return { group: g, body, pivot, neck, head, eyes, tail, legs, ...s, height: 1.45, shadow: 0.6, pick: 0.75, center: 0.85, seen: 110, gait: { len: 0.64, run: 3.5, happy: 'hop', graze: 0.7 } };
}

function elephant(id) {
  const { g, body, pivot } = bigRig(1.1);
  const GREY = id % 2 ? '#a7aeb9' : '#9aa3b0';
  const grey = toon(GREY);
  const R = [0.6, 0.55, 0.85];
  pivot.add(mesh(sphere(), grey, 0, 0, 0, ...R));
  const legs = fourLegs(pivot, { x: 0.32, front: 0.46, back: -0.46, hip: -0.46, len: 0.64, r: 0.17, color: GREY });
  // Toenails.
  for (const leg of legs) for (const x of [-0.08, 0, 0.08]) leg.add(mesh(sphere(1, 8, 6), toon('#f4efe6'), x, -0.6, 0.14, 0.035, 0.03, 0.02));
  const neck = new THREE.Group();
  neck.position.set(0, 0.18, 0.72);
  pivot.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.2);
  neck.add(head);
  head.add(mesh(sphere(), grey, 0, 0, 0, 0.4, 0.42, 0.38));
  const eyes = sideEyes(head, 0.25, 0.08, 0.26, 0.035);
  // Big ears that flap, pink inside.
  const ears = [-1, 1].map((side) => {
    const e = new THREE.Group();
    e.position.set(side * 0.33, 0.05, -0.05);
    e.rotation.y = side * 0.35;
    e.add(mesh(sphere(), grey, side * 0.2, 0, 0, 0.26, 0.34, 0.035));
    e.add(mesh(sphere(), toon('#f5b3c3'), side * 0.21, 0, 0.022, 0.19, 0.26, 0.02));
    e.userData.side = side;
    head.add(e);
    return e;
  });
  // Tusks.
  for (const side of [-1, 1]) {
    const t = mesh(cone(0.04, 0.22, 8), toon('#fbf6ec'), side * 0.17, -0.22, 0.3);
    t.rotation.set(1.9, 0, -side * 0.25);
    head.add(t);
  }
  // A trunk of five pieces, each hung from the one before, to curl.
  const trunk = [];
  let parent = head;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i ? -0.15 : -0.12, i ? 0 : 0.33);
    const r = 0.12 - i * 0.016;
    seg.add(mesh(cylinder(r * 0.88, r, 0.17, 12), grey, 0, -0.075, 0));
    parent.add(seg);
    trunk.push(seg);
    parent = seg;
  }
  // Where the water comes out.
  const tip = new THREE.Group();
  tip.position.y = -0.16;
  parent.add(tip);
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, -0.84);
  pivot.add(tail);
  tail.add(mesh(cylinder(0.02, 0.02, 0.45, 6), grey, 0, -0.22, 0));
  tail.add(mesh(sphere(1, 8, 6), toon('#4a4450'), 0, -0.46, 0, 0.04, 0.07, 0.04));
  // Its saddle is a big bright blanket.
  const s = saddle(pivot, R[1], 0.52, 0.5, -0.08, true);
  return { group: g, body, pivot, neck, head, eyes, ears, trunk, tip, tail, legs, ...s, height: 2.05, shadow: 0.9, pick: 1.1, center: 1.1, seen: 140, gait: { len: 0.64, run: 3.2, happy: 'trunk', graze: 0.15 } };
}

function giraffe(id) {
  const { g, body, pivot } = bigRig(1.32);
  const coat = toon('#f3cf6b');
  const spot = id % 2 ? '#c8783a' : '#b86a30';
  const R = [0.28, 0.3, 0.5];
  pivot.add(mesh(sphere(), coat, 0, 0, 0, ...R));
  for (const [dx, dy, dz, w, h] of [
    [1, 0.2, 0.2, 0.09, 0.08],
    [1, -0.2, -0.3, 0.08, 0.08],
    [1, 0.3, -0.6, 0.07, 0.06],
    [1, -0.25, 0.6, 0.07, 0.06],
    [-1, 0.25, -0.1, 0.09, 0.08],
    [-1, -0.2, 0.35, 0.08, 0.07],
    [-1, 0.1, -0.65, 0.07, 0.07],
    [0.2, 1, 0.4, 0.08, 0.07],
    [-0.3, 1, -0.3, 0.08, 0.07],
    [0.5, 1, -0.05, 0.06, 0.05],
  ]) {
    patch(pivot, spot, R, [dx, dy, dz], w, h);
  }
  const legs = fourLegs(pivot, { x: 0.15, front: 0.3, back: -0.32, hip: -0.27, len: 1.05, r: 0.062, color: '#f3cf6b', hoof: '#5a4030', knees: true });
  const neck = new THREE.Group();
  neck.position.set(0, 0.16, 0.36);
  pivot.add(neck);
  const n = new THREE.Group();
  n.rotation.x = 0.32;
  neck.add(n);
  n.add(mesh(cylinder(0.075, 0.12, 1.1, 12), coat, 0, 0.55, 0));
  // Spots up the neck, and a short brown mane down the back of it.
  for (let i = 0; i < 6; i++) {
    const y = 0.12 + i * 0.17;
    const r = 0.12 - (0.045 * y) / 1.1;
    const a = (i % 2 ? 1 : -1) * 0.9 + (i % 3) * 0.3;
    const m = mesh(sphere(1, 10, 8), toon(spot), Math.sin(a) * r, y, Math.cos(a) * r, 0.055, 0.05, 0.02);
    m.quaternion.setFromUnitVectors(Z, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
    n.add(m);
    n.add(mesh(sphere(1, 8, 6), toon('#8a5a32'), 0, y, -r - 0.005, 0.03, 0.08, 0.035));
  }
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0.02);
  head.rotation.x = 0.13;
  n.add(head);
  head.add(mesh(sphere(), coat, 0, 0, 0.05, 0.11, 0.12, 0.2));
  head.add(mesh(sphere(), toon('#e7b95a'), 0, -0.03, 0.2, 0.085, 0.08, 0.08));
  for (const side of [-1, 1]) {
    head.add(mesh(sphere(1, 8, 6), toon('#5a3a2a'), side * 0.035, -0.02, 0.275, 0.015, 0.02, 0.01));
    // Two little horns with knobs on top (ossicones), and ears.
    head.add(mesh(cylinder(0.018, 0.022, 0.13, 8), coat, side * 0.045, 0.16, -0.04));
    head.add(mesh(sphere(1, 8, 6), toon('#5a3a2a'), side * 0.045, 0.23, -0.04, 0.03));
    const ear = mesh(cone(0.035, 0.12, 8), coat, side * 0.11, 0.08, -0.06);
    ear.rotation.z = -side * 1.1;
    head.add(ear);
  }
  const eyes = sideEyes(head, 0.1, 0.05, 0.06, 0.03);
  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.5);
  pivot.add(tail);
  tail.add(mesh(cylinder(0.015, 0.015, 0.45, 6), coat, 0, -0.22, -0.02));
  tail.add(mesh(sphere(1, 8, 6), toon('#4a3020'), 0, -0.46, -0.02, 0.04, 0.08, 0.04));
  const s = saddle(pivot, R[1], 0.27, 0.25, -0.14);
  return { group: g, body, pivot, neck, head, eyes, tail, legs, ...s, height: 2.9, shadow: 0.55, pick: 0.85, center: 1.35, seen: 160, gait: { len: 1.05, run: 4, happy: 'sway', graze: -0.25 } };
}

function polarbear(id) {
  const { g, body, pivot } = bigRig(0.68);
  const fur = toon(id % 2 ? '#f8f5ec' : '#f4efe2');
  const R = [0.38, 0.33, 0.6];
  pivot.add(mesh(sphere(), fur, 0, 0, 0, ...R));
  pivot.add(mesh(sphere(), fur, 0, 0.03, -0.3, 0.36, 0.33, 0.32));
  pivot.add(mesh(sphere(), fur, 0, 0.02, 0.28, 0.34, 0.32, 0.32));
  const legs = fourLegs(pivot, { x: 0.22, front: 0.36, back: -0.36, hip: -0.24, len: 0.44, r: 0.12, color: '#f6f2e8', paw: '#efe8d8' });
  const neck = new THREE.Group();
  neck.position.set(0, 0.06, 0.5);
  pivot.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0, 0.2);
  neck.add(head);
  head.add(mesh(sphere(), fur, 0, 0, 0, 0.21, 0.19, 0.22));
  head.add(mesh(sphere(), toon('#ece4d2'), 0, -0.05, 0.19, 0.12, 0.1, 0.13));
  head.add(mesh(sphere(), toon(BLACK), 0, -0.01, 0.315, 0.05, 0.035, 0.03));
  head.add(mesh(sphere(1, 8, 6), toon('#4a4450'), 0, -0.1, 0.27, 0.035, 0.012, 0.02));
  const eyes = sideEyes(head, 0.1, 0.07, 0.15, 0.026);
  for (const side of [-1, 1]) {
    head.add(mesh(sphere(), fur, side * 0.14, 0.15, -0.03, 0.065, 0.065, 0.035));
    head.add(mesh(sphere(), toon('#e6ddd0'), side * 0.14, 0.15, -0.012, 0.035, 0.035, 0.02));
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.06, -0.6);
  pivot.add(tail);
  tail.add(mesh(sphere(1, 8, 6), fur, 0, 0, -0.02, 0.07));
  const s = saddle(pivot, R[1], 0.36, 0.3, -0.04);
  return { group: g, body, pivot, neck, head, eyes, tail, legs, ...s, height: 1.15, shadow: 0.65, pick: 0.7, center: 0.65, seen: 110, gait: { len: 0.44, run: 3.5, happy: 'hop', graze: 0.45 } };
}

const BUILDERS = { bunny, chick, sheep, duck, butterfly, bird, owl, bee, seagull, fish, dolphin, whale, turtle, crab, octopus, penguin, seal, pony, cow, elephant, giraffe, reindeer, polarbear, unicorn, ...VEHICLE_BUILDERS };

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
    // Where to aim at it, above its origin; and how far off it is still drawn.
    this.center = parts.center ?? this.height * 0.5;
    this.seen = parts.seen ?? (type === 'seagull' ? 100 : 60);
    this.hasShadow = parts.shadow !== 0;
    this.hs = 0;
    this.jumpAt = -1;
    // How it is moving, worked out from where it is put each frame.
    this.vy = 0;
    this.turn = 0;
    this.lastY = null;
    this.lastYaw = 0;
    // How its head sits when it is doing nothing in particular.
    this.headRest = this.head.rotation.x;
    // Big animals: where they are in their stride, and how long the elephant
    // still holds its trunk up to spray.
    this.phase = 0;
    this.trick = 0;
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
    this.head.rotation.set(this.headRest, 0, 0);
    if (this.eyes) this.eyes.scale.y = 1;
    this.track(dt);
    if (this.vehicle) {
      drive(this, dt, state, moving);
      return;
    }
    if (this.gait) {
      this.trot(dt, state, moving);
      if (state === 'sleep') this.eyes.scale.y = 0.12;
      return;
    }
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
      case 'fish':
        this.school(state);
        break;
      case 'dolphin':
      case 'whale':
        this.swimmer(state);
        break;
      case 'turtle':
        this.paddle(state, moving);
        break;
      case 'crab':
        this.scuttle(state, moving);
        break;
      case 'octopus':
        this.wiggle(state);
        break;
      case 'penguin':
        this.waddle(state, moving);
        break;
      case 'seal':
        this.flop(state, moving);
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
      this.head.rotation.x = this.headRest + 0.25;
    }
  }

  // The big animals: walking with each leg in step with the one across from
  // it, galloping (front legs, then back), jumping, swimming, grazing, lying
  // down asleep, and happy, each in its own way. The elephant's trunk sways,
  // curls up to its mouth, comes up to spray, and up out of the water.
  trot(dt, state, moving) {
    const t = this.time;
    const g = this.gait;
    const air = state === 'jump';
    const lie = state === 'sleep';
    const swim = state === 'swim';
    const gallop = !swim && !air && !lie && (state === 'run' || this.hs > g.run);
    const walk = !swim && !air && !lie && !gallop && (state === 'walk' || moving);
    const swing = gallop ? 0.8 : swim ? 0.55 : walk ? 0.42 : 0;
    this.phase += dt * (gallop ? 5 + this.hs * 1.1 : swim ? 5 : walk ? 3 + this.hs * 2.2 : 0);
    const p = this.phase;
    let pitch = 0;
    let bob = 0;
    let neck = state === 'eat' ? g.graze + Math.sin(t * 5) * 0.04 : swim ? -0.25 : 0;
    for (const leg of this.legs) {
      const { side, front } = leg.userData;
      let a = 0;
      // Folded under it lying down; tucked up in the air.
      if (lie) a = front ? 1.45 : -1.45;
      else if (air) a = front ? -1 : 0.65;
      else if (gallop) a = Math.sin(p + (front ? 0 : Math.PI * 0.85) + (side > 0 ? 0.35 : 0)) * swing;
      else a = Math.sin(p + (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0)) * swing;
      leg.rotation.set(a, 0, 0);
    }
    if (gallop) {
      pitch = Math.sin(p) * 0.08;
      bob = Math.abs(Math.cos(p)) * 0.07;
    } else if (walk) {
      bob = Math.abs(Math.sin(p)) * 0.025;
    } else if (air) {
      pitch = clamp(-this.vy * 0.05, -0.35, 0.35);
    } else if (lie) {
      bob = -g.len * 0.82;
      neck = 0.3;
    }
    let sway = 0;
    if (state === 'happy') {
      if (g.happy === 'rear') {
        // Up on its back legs, pawing the air.
        pitch = -0.55;
        bob = 0.18;
        for (const leg of this.legs) leg.rotation.x = leg.userData.front ? -1 + Math.sin(t * 12 + leg.userData.side) * 0.35 : 0.55;
        neck = -0.35;
      } else if (g.happy === 'sway') {
        sway = Math.sin(t * 4) * 0.25;
        bob = Math.abs(Math.sin(t * 8)) * 0.06;
      } else {
        bob = Math.abs(Math.sin(t * 8)) * 0.14;
      }
    }
    this.pivot.rotation.set(pitch, 0, 0);
    this.body.position.y = bob;
    this.neck.rotation.set(neck, state === 'idle' ? Math.sin(t * 0.5 + this.id) * 0.35 : 0, sway);
    this.tail.rotation.set(gallop || state === 'happy' ? 0.6 : 0.1, 0, lie ? 0 : Math.sin(t * (gallop ? 9 : 1.6) + this.id) * 0.25);
    if (this.ears) {
      const flap = state === 'happy' ? 0.5 + Math.sin(t * 9) * 0.4 : Math.max(0, Math.sin(t * 1.3 + this.id)) * 0.5;
      for (const e of this.ears) e.rotation.y = e.userData.side * (0.35 + flap);
    }
    if (this.trunk) {
      this.trick = Math.max(0, this.trick - dt);
      // Up and forward to spray, or out of the water; curled in to eat.
      const up = this.trick > 0 || state === 'happy' || swim;
      const curl = up ? -0.5 : state === 'eat' ? 0.55 : 0.1;
      this.trunk.forEach((seg, i) => seg.rotation.set(curl + (up ? 0 : Math.sin(t * 1.2 + i * 0.6) * 0.05), 0, i ? Math.sin(t * 0.9 + i) * 0.06 : 0));
    }
  }

  // Someone riding it shows its saddle, in the colour of their T-shirt;
  // nobody (null) hides it.
  setRider(color) {
    // A vehicle's seat is always there, in its own colour with nobody in it.
    if (this.vehicle) {
      this.pad.color.set(color ?? this.padColor);
      return;
    }
    if (!this.saddle) return;
    this.saddle.visible = Boolean(color);
    if (color) this.pad.color.set(color);
  }

  // Someone riding along in a vehicle's seat i for friends (null: nobody),
  // its cushion in the colour of their T-shirt.
  setPassenger(i, color) {
    this.seatPads?.[i]?.color.set(color ?? this.padColor);
  }

  // Climbing or diving, and how fast it is turning, from where the group has
  // been put since last time.
  track(dt) {
    const { x, y, z } = this.group.position;
    const yaw = this.group.rotation.y;
    if (this.lastY !== null && dt > 0) {
      const k = Math.min(1, dt * 6);
      this.vy += ((y - this.lastY) / dt - this.vy) * k;
      this.hs += (Math.hypot(x - this.lastX, z - this.lastZ) / dt - this.hs) * k;
      this.turn += (wrap(yaw - this.lastYaw) / dt - this.turn) * k;
    }
    this.lastX = x;
    this.lastY = y;
    this.lastZ = z;
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

  // Three fish, tails going, keeping together; one of them leaps out of the
  // water when the school is jumping.
  school(state) {
    const t = this.time;
    if (state === 'jump' && this.jumpAt < 0) this.jumpAt = t;
    if (state !== 'jump') this.jumpAt = -1;
    const slow = state === 'sleep' ? 0.3 : 1;
    this.fishes.forEach((f, i) => {
      const home = f.userData.home;
      f.position.set(home.x + Math.sin(t * 1.3 + i * 2) * 0.03, home.y + Math.sin(t * 2 * slow + i) * 0.03, home.z);
      f.rotation.set(0, Math.sin(t * 14 * slow + i + 1) * 0.12, 0);
      f.userData.tail.rotation.y = Math.sin(t * 14 * slow + i) * 0.5;
      if (i === 0 && this.jumpAt >= 0) {
        const k = Math.min(1, t - this.jumpAt);
        f.position.y = home.y + Math.sin(Math.PI * k) * 1.5;
        f.position.z = home.z + k * 0.8;
        f.rotation.x = -Math.cos(Math.PI * k) * 1.1;
      }
    });
  }

  // Dolphins and the whale: up-and-down strokes of the tail, the nose
  // following the way it is going (up out of the water, down into it).
  swimmer(state) {
    const t = this.time;
    const whale = this.type === 'whale';
    const pitch = state === 'sleep' ? 0 : clamp(-Math.atan2(this.vy, Math.max(this.hs, 0.5)), -1.1, 1.1);
    this.pivot.rotation.set(pitch, 0, clamp(-this.turn * 0.25, -0.35, 0.35));
    const beat = state === 'jump' ? 0.1 : state === 'sleep' ? 0.08 : 0.32;
    this.tail.rotation.x = Math.sin(t * (whale ? 1.6 : 8)) * beat;
    this.body.position.y = Math.sin(t * (whale ? 0.7 : 2)) * (whale ? 0.05 : 0.02);
  }

  // A turtle rows with its flippers in the water, and steps with them, one
  // corner after another, on land. Asleep, it pulls its head in.
  paddle(state, moving) {
    const t = this.time;
    const swim = state === 'swim';
    for (const f of this.flippers) {
      const { side, front } = f.userData;
      if (swim) {
        // Both front flippers together, like wings; the back ones steer.
        f.rotation.set(0, 0, side * (front ? Math.sin(t * 3) * 0.5 : 0.1));
      } else {
        const step = moving ? Math.sin(t * 6 + (side * (front ? 1 : -1) > 0 ? 0 : Math.PI)) * 0.45 : 0;
        f.rotation.set(0, step * side, -side * 0.15);
      }
    }
    this.head.position.z = state === 'sleep' ? 0.3 : 0.38;
    if (state === 'eat') this.head.rotation.x = Math.max(0, Math.sin(t * 5)) * 0.5;
    if (swim) this.body.position.y = Math.sin(t * 1.5) * 0.02;
  }

  // A crab: legs going when it walks, claws snapping, eyes up on their
  // stalks; claws up in the air when it is happy, and down when it digs.
  scuttle(state, moving) {
    const t = this.time;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = moving || state === 'walk' ? Math.sin(t * 16 + i * 2.1) * 0.4 : 0;
    });
    if (moving) this.body.position.y = Math.abs(Math.sin(t * 16)) * 0.012;
    for (const c of this.claws) {
      const { side, jaw } = c.userData;
      let lift = 0;
      if (state === 'happy') lift = -1.1 + Math.sin(t * 8 + side) * 0.3;
      else if (state === 'eat') lift = Math.max(0, Math.sin(t * 4 + (side > 0 ? 0 : Math.PI))) * 0.7;
      c.rotation.set(lift, side * 0.45, 0);
      jaw.rotation.x = state === 'sleep' ? 0 : -Math.max(0, Math.sin(t * (state === 'happy' ? 12 : 5) + side)) * 0.6;
    }
    this.head.rotation.z = state === 'sleep' ? 0 : Math.sin(t * 2.3) * 0.1;
    if (state === 'sleep') this.body.position.y = -0.04;
  }

  // An octopus's eight arms wave, trail behind when it jets along, and lie
  // still when it sleeps. Happy, it changes colour.
  wiggle(state) {
    const t = this.time;
    const jet = state === 'swim';
    this.tentacles.forEach((arm, i) => {
      const tilt = state === 'sleep' ? 1.35 : jet ? 0.3 : 1.12;
      arm.userData.arm.rotation.x = tilt + (state === 'sleep' ? 0 : Math.sin(t * (jet ? 7 : 3) + i * 0.9) * 0.22);
    });
    if (state === 'happy') this.skin.color.setHSL((t * 0.4) % 1, 0.75, 0.66);
    else this.skin.color.set(this.color);
    if (!jet && state !== 'sleep') this.head.position.y = 0.38 + Math.sin(t * 2) * 0.015;
  }

  // A penguin waddles side to side on land, lies flat out on its tummy to
  // slide and to swim under water ("flying" with its flippers), and sits low
  // in the water afloat.
  waddle(state, moving) {
    const t = this.time;
    const flat = state === 'slide' || state === 'dive' || state === 'jump';
    let pitch = 0;
    let roll = 0;
    let lift = 0.15;
    if (state === 'jump') pitch = clamp(Math.PI / 2 - Math.atan2(this.vy, Math.max(this.hs, 0.5)), 0.3, 2.6);
    else if (flat) pitch = 1.45;
    if (state === 'walk' || (moving && !flat && state !== 'swim')) {
      roll = Math.sin(t * 9) * 0.14;
      this.body.position.y = Math.abs(Math.sin(t * 9)) * 0.03;
      lift = 0.3;
    }
    if (state === 'slide') {
      // On its tummy: down to the ground, flippers out to the sides.
      this.body.position.y = -0.14;
      lift = 1.3;
    } else if (state === 'dive' || state === 'jump') {
      lift = 0.9 + Math.sin(t * 12) * 0.6;
    } else if (state === 'swim') {
      this.body.position.y = -0.3 + Math.sin(t * 2) * 0.02;
      lift = 0.4 + Math.sin(t * 5) * 0.3;
    } else if (state === 'happy') {
      lift = 0.8 + Math.sin(t * 16) * 0.6;
    }
    this.pivot.rotation.set(pitch, 0, roll);
    for (const f of this.flippers) f.rotation.set(0, 0, f.userData.side * lift);
    for (const [i, f] of this.feet.entries()) {
      f.visible = !flat;
      f.position.y = 0.015 + (state === 'walk' ? Math.max(0, Math.sin(t * 9 + i * Math.PI)) * 0.03 : 0);
    }
    if (state === 'eat') {
      // Tidying its feathers.
      this.head.rotation.set(0.35 + Math.sin(t * 6) * 0.1, 0.9, 0);
    } else if (state === 'idle') {
      this.head.rotation.y = Math.sin(t * 0.8 + this.id) * 0.6;
    }
  }

  // A seal lies about on the shore, looking round and waving its tail; it
  // humps itself along, claps its flippers when it is happy, plays with a
  // ball on its nose, floats with just its head out, and swims with its tail.
  flop(state, moving) {
    const t = this.time;
    this.ball.visible = state === 'eat';
    this.pivot.rotation.set(0, 0, 0);
    this.tail.rotation.set(Math.sin(t * 1.5) * 0.2, 0, 0);
    let clap = 0.15;
    if (state === 'walk' || (moving && state !== 'swim' && state !== 'dive')) {
      this.pivot.rotation.x = Math.sin(t * 6) * 0.15;
      this.body.position.y = Math.abs(Math.sin(t * 6)) * 0.05;
    } else if (state === 'happy') {
      clap = 0.2 + Math.abs(Math.sin(t * 10)) * 1;
      this.head.rotation.x = -0.35;
    } else if (state === 'eat') {
      this.ball.position.y = 0.2 + Math.abs(Math.sin(t * 4)) * 0.15;
      this.head.rotation.x = -0.45 + Math.sin(t * 4) * 0.1;
    } else if (state === 'swim') {
      this.body.position.y = -0.28 + Math.sin(t * 2) * 0.02;
      this.head.rotation.x = -0.35;
    } else if (state === 'dive') {
      this.tail.rotation.set(0, Math.sin(t * 6) * 0.45, 0);
      clap = -0.3;
    } else if (state === 'idle') {
      this.head.rotation.y = Math.sin(t * 0.6 + this.id) * 0.5;
      this.head.rotation.x = -0.15;
    }
    for (const f of this.flippers) f.rotation.set(0, f.userData.side * clap, 0);
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    if (this.type === 'octopus') this.skin.dispose();
    this.pad?.dispose();
    for (const m of this.owned ?? []) m.dispose();
  }
}
