// The vehicles as little toy models, built like the bricks of the island
// (boxy, with studs on top): a car with big round headlights for eyes, a
// speedboat with an outboard motor and a flag, a yellow digger on tracks
// with a drill on the front and a flashing light, a mine cart with a
// lantern, and for friends to ride in together, an open-top bus and a
// ferry, each with three rows of two seats behind the driver's. Each seat
// is coloured as the T-shirt of whoever sits in it, and each vehicle is
// moved by CritterModel (critter-models.js), which calls drive() each frame.
import * as THREE from '../../vendor/three.module.js';
import { cone, cylinder, geo, mesh, sphere, toon, torus } from './toon.js';

const BLACK = '#2b2530';
const TIRE = '#3a3540';
const METAL = '#b9c2cc';
const SEAT = '#ff6f6f';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const box = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));

// A box from (x0, y0, z0) to (x1, y1, z1).
function block(parent, material, x0, y0, z0, x1, y1, z1) {
  const m = mesh(box(), material, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  parent.add(m);
  return m;
}

// Studs on top of a box, the way the island's bricks have them.
function studs(parent, material, y, xs, zs) {
  for (const x of xs) for (const z of zs) parent.add(mesh(cylinder(0.075, 0.075, 0.05, 14), material, x, y + 0.025, z));
}

// A wheel turning about the x axis, in a group of its own to spin.
function wheel(parent, x, y, z, r, width, tire = TIRE, hub = '#f4f1ea') {
  const w = new THREE.Group();
  w.position.set(x, y, z);
  w.userData.r = r;
  const t = mesh(cylinder(r, r, width, 18), toon(tire));
  t.rotation.z = Math.PI / 2;
  w.add(t);
  const h = mesh(cylinder(r * 0.45, r * 0.45, width + 0.02, 12), toon(hub));
  h.rotation.z = Math.PI / 2;
  w.add(h);
  // A spoke, to see it turn.
  w.add(mesh(box(), toon(tire), Math.sign(x) * (width / 2 + 0.012), 0, 0, 0.01, r * 0.75, r * 0.16));
  parent.add(w);
  return w;
}

// Big round headlights that look like eyes, which light up when it honks.
function lampEyes(parent, x, y, z, r, glow) {
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    eyes.add(mesh(sphere(1, 16, 12), glow, side * x, y, z, r, r, r * 0.7));
    eyes.add(mesh(sphere(1, 10, 8), toon(BLACK), side * x, y + r * 0.1, z + r * 0.6, r * 0.42, r * 0.5, r * 0.25));
    eyes.add(mesh(sphere(1, 6, 4), toon('#ffffff', { emissive: 0.5 }), side * x + r * 0.12, y + r * 0.3, z + r * 0.75, r * 0.15));
  }
  parent.add(eyes);
  return eyes;
}

// The parts every vehicle has: its group, a body that bounces, an empty
// head (CritterModel turns one), the seat's own material, and a light that
// glows brighter when it honks.
function rig(lamp = '#fff4b8') {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const head = new THREE.Group();
  body.add(head);
  const pad = toon(SEAT).clone();
  const glow = toon(lamp, { emissive: 0.35 }).clone();
  return { group, body, head, pad, glow, owned: [glow], padColor: SEAT, vehicle: true };
}

const CARS = ['#e8453c', '#3a73d8', '#fcd535', '#f47fb8', '#35a852', '#f59331'];

function car(id) {
  const v = rig();
  const { body } = v;
  const paint = toon(CARS[id % CARS.length]);
  const white = toon('#f7f5ef');
  v.wheels = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sz]) => wheel(body, sx * 0.47, 0.2, sz * 0.48, 0.2, 0.15));
  block(body, paint, -0.45, 0.2, -0.75, 0.45, 0.44, 0.75);
  // The hood and the trunk, with studs.
  block(body, paint, -0.45, 0.44, 0.2, 0.45, 0.66, 0.75);
  block(body, paint, -0.45, 0.44, -0.75, 0.45, 0.66, -0.46);
  studs(body, paint, 0.66, [-0.2, 0.2], [0.36, 0.6]);
  studs(body, paint, 0.66, [-0.2, 0.2], [-0.6]);
  // The sides, round the seat.
  for (const side of [-1, 1]) block(body, paint, side * 0.37, 0.44, -0.46, side * 0.45, 0.62, 0.2);
  // The seat: a cushion (where the driver sits, at the car's seat height:
  // see shared/critters.js) and its back.
  v.seat = block(body, v.pad, -0.3, 0.44, -0.42, 0.3, 0.51, 0.08);
  block(body, v.pad, -0.3, 0.44, -0.47, 0.3, 0.95, -0.4);
  // A windscreen and a steering wheel.
  block(body, toon('#bfe8ff', { transparent: true, opacity: 0.55 }), -0.38, 0.66, 0.2, 0.38, 0.92, 0.23);
  const steer = mesh(torus(0.11, 0.022), toon(BLACK), 0, 0.76, 0.14);
  steer.rotation.x = -0.6;
  body.add(steer);
  // Bumpers, headlights for eyes, and tail lights.
  for (const z of [-0.78, 0.78]) {
    const b = mesh(cylinder(0.05, 0.05, 0.9, 10), white, 0, 0.28, z);
    b.rotation.z = Math.PI / 2;
    body.add(b);
  }
  v.eyes = lampEyes(body, 0.24, 0.5, 0.74, 0.11, v.glow);
  for (const side of [-1, 1]) block(body, toon('#ff4a4a', { emissive: 0.3 }), side * 0.38 - 0.05, 0.5, -0.77, side * 0.38 + 0.05, 0.58, -0.74);
  return { ...v, height: 1, center: 0.5, pick: 0.75, shadow: 0.75, seen: 110 };
}

const BOATS = ['#e8453c', '#3a73d8', '#2fc1b3', '#8c5bd6', '#f59331'];

function boat(id) {
  const v = rig();
  const { body } = v;
  const stripe = toon(BOATS[id % BOATS.length]);
  const white = toon('#f7f5ef');
  // The hull, its middle at the top of the water (where the boat's origin
  // is), and a rim round it.
  body.add(mesh(sphere(1, 24, 16), white, 0, -0.05, 0, 0.56, 0.3, 1.05));
  body.add(mesh(sphere(1, 24, 16), stripe, 0, -0.08, 0, 0.575, 0.18, 1.07));
  const rim = mesh(torus(1, 0.05), stripe, 0, 0.2, 0, 0.56, 1.05, 1);
  rim.rotation.x = Math.PI / 2;
  body.add(rim);
  // The seat, a windscreen and a steering wheel.
  v.seat = block(body, v.pad, -0.25, 0.18, -0.42, 0.25, 0.31, 0.08);
  block(body, v.pad, -0.25, 0.18, -0.5, 0.25, 0.62, -0.42);
  block(body, toon('#bfe8ff', { transparent: true, opacity: 0.55 }), -0.3, 0.22, 0.32, 0.3, 0.5, 0.35);
  const steer = mesh(torus(0.09, 0.02), toon(BLACK), 0, 0.5, 0.2);
  steer.rotation.x = -0.6;
  body.add(steer);
  // Eyes on the bow.
  v.eyes = lampEyes(body, 0.17, 0.12, 0.88, 0.08, v.glow);
  // The motor on the back, with a propeller under the water.
  block(body, toon(BLACK), -0.13, 0.05, -1.16, 0.13, 0.42, -0.94);
  block(body, stripe, -0.14, 0.38, -1.17, 0.14, 0.46, -0.93);
  block(body, toon(METAL), -0.04, -0.3, -1.08, 0.04, 0.05, -1.0);
  const prop = new THREE.Group();
  prop.position.set(0, -0.26, -1.13);
  for (let i = 0; i < 3; i++) {
    const b = mesh(sphere(1, 8, 6), toon(METAL), 0, 0, 0, 0.03, 0.09, 0.015);
    b.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.07, Math.sin((i * Math.PI * 2) / 3) * 0.07, 0);
    b.rotation.z = (i * Math.PI * 2) / 3 + Math.PI / 2;
    prop.add(b);
  }
  body.add(prop);
  v.prop = prop;
  // A little flag on a pole.
  body.add(mesh(cylinder(0.015, 0.015, 0.6, 6), toon('#8b5a3c'), 0.32, 0.5, -0.7));
  const flag = mesh(box(), stripe, 0.32, 0.72, -0.82, 0.02, 0.14, 0.22);
  body.add(flag);
  v.flag = flag;
  return { ...v, height: 0.8, center: 0.25, pick: 0.8, shadow: 0, seen: 120 };
}

function digger() {
  const v = rig();
  const { body } = v;
  const yellow = toon('#fcc419');
  const dark = toon('#4a4e57');
  // Tracks, with their rollers.
  v.wheels = [];
  for (const side of [-1, 1]) {
    block(body, dark, side * 0.5, 0, -0.62, side * 0.32, 0.34, 0.56);
    for (const z of [-0.42, 0, 0.38]) v.wheels.push(wheel(body, side * 0.52, 0.17, z, 0.13, 0.04, METAL, '#6e737c'));
  }
  // Its body, with studs on the back.
  block(body, yellow, -0.36, 0.3, -0.62, 0.36, 0.72, 0.36);
  studs(body, yellow, 0.72, [-0.18, 0.18], [-0.56]);
  // The seat, up on top.
  block(body, dark, -0.27, 0.72, -0.5, 0.27, 0.84, 0.04);
  v.seat = block(body, v.pad, -0.25, 0.84, -0.48, 0.25, 0.93, 0.02);
  block(body, v.pad, -0.25, 0.84, -0.6, 0.25, 1.28, -0.5);
  // A lever to hold.
  body.add(mesh(cylinder(0.02, 0.02, 0.3, 6), dark, 0, 0.86, 0.2));
  body.add(mesh(sphere(1, 10, 8), toon('#e8453c'), 0, 1.02, 0.2, 0.05));
  // The drill on its arm, out in front, which turns as it digs.
  block(body, dark, -0.12, 0.42, 0.36, 0.12, 0.64, 0.72);
  const drill = new THREE.Group();
  drill.position.set(0, 0.53, 0.72);
  const bit = new THREE.Group();
  bit.rotation.x = Math.PI / 2;
  bit.add(mesh(cone(0.32, 0.62, 18), toon(METAL), 0, 0.31, 0));
  // Its thread, round and round.
  for (let i = 0; i < 4; i++) {
    const t = mesh(torus(0.27 - i * 0.065, 0.026), toon('#8d96a1'), 0, 0.07 + i * 0.14, 0);
    t.rotation.x = Math.PI / 2 + 0.22;
    bit.add(t);
  }
  drill.add(bit);
  body.add(drill);
  v.drill = drill;
  v.eyes = lampEyes(body, 0.2, 0.62, 0.37, 0.09, v.glow);
  // A light on a pole, flashing orange while it works.
  const beacon = toon('#ff9a2e', { emissive: 0.3 }).clone();
  v.owned.push(beacon);
  body.add(mesh(cylinder(0.02, 0.02, 0.5, 6), dark, 0.3, 0.97, -0.55));
  body.add(mesh(sphere(1, 12, 10), beacon, 0.3, 1.25, -0.55, 0.07));
  v.beacon = beacon;
  return { ...v, height: 1.4, center: 0.6, pick: 0.85, shadow: 0.8, seen: 110 };
}

function minecart() {
  const v = rig('#ffd36b');
  const { body } = v;
  const wood = toon('#9a6a44');
  const iron = toon('#5b5f68');
  v.wheels = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sz]) => wheel(body, sx * 0.33, 0.12, sz * 0.28, 0.12, 0.06, '#4a4e57', '#8d96a1'));
  // The tub: a floor, four walls and iron bands round its corners.
  block(body, wood, -0.33, 0.16, -0.43, 0.33, 0.24, 0.43);
  for (const side of [-1, 1]) {
    block(body, wood, side * 0.33 - 0.04, 0.16, -0.43, side * 0.33 + 0.04, 0.72, 0.43);
    block(body, wood, -0.33, 0.16, side * 0.43 - 0.04, 0.33, 0.72, side * 0.43 + 0.04);
    for (const end of [-1, 1]) block(body, iron, side * 0.33 - 0.06, 0.16, end * 0.43 - 0.06, side * 0.33 + 0.06, 0.74, end * 0.43 + 0.06);
  }
  // An iron band round its top.
  for (const side of [-1, 1]) {
    block(body, iron, side * 0.33 - 0.05, 0.64, -0.48, side * 0.33 + 0.05, 0.69, 0.48);
    block(body, iron, -0.38, 0.64, side * 0.43 - 0.05, 0.38, 0.69, side * 0.43 + 0.05);
  }
  // A plank to sit on.
  v.seat = block(body, v.pad, -0.25, 0.24, -0.22, 0.25, 0.33, 0.22);
  // A lantern on the front.
  body.add(mesh(cylinder(0.012, 0.012, 0.16, 6), iron, 0, 0.8, 0.47));
  body.add(mesh(sphere(1, 12, 10), v.glow, 0, 0.9, 0.5, 0.075, 0.09, 0.075));
  body.add(mesh(cone(0.08, 0.06, 10), iron, 0, 1.0, 0.5));
  v.eyes = null;
  return { ...v, height: 1, center: 0.45, pick: 0.6, shadow: 0.55, seen: 100 };
}

// The seats for friends, two to a row behind the driver (as ride.seats in
// shared/critters.js), each a cushion of its own colour with a back,
// cushions at height y. Their materials go in v.seatPads.
function benches(v, y) {
  v.seatPads = [];
  const bench = toon('#f7f5ef');
  for (const z of [0.2, -0.45, -1.1]) {
    // A bench across, a little under the cushions (a pet sits between them).
    block(v.body, bench, -0.52, y - 0.12, z - 0.3, 0.52, y - 0.03, z + 0.2);
    for (const x of [-0.3, 0.3]) {
      const pad = toon(SEAT).clone();
      v.owned.push(pad);
      v.seatPads.push(pad);
      block(v.body, pad, x - 0.22, y - 0.08, z - 0.3, x + 0.22, y, z + 0.2);
      block(v.body, pad, x - 0.22, y - 0.08, z - 0.36, x + 0.22, y + 0.36, z - 0.29);
    }
  }
}

const BUSES = ['#fcc419', '#e8453c', '#3a73d8', '#35a852'];

function bus(id) {
  const v = rig();
  const { body } = v;
  const paint = toon(BUSES[id % BUSES.length]);
  const white = toon('#f7f5ef');
  const dark = toon('#4a4e57');
  v.wheels = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sz]) => wheel(body, sx * 0.6, 0.26, sz * 0.95, 0.26, 0.16));
  // The floor, and low sides all round to see everyone over.
  block(body, paint, -0.6, 0.26, -1.5, 0.6, 0.54, 1.45);
  for (const side of [-1, 1]) {
    block(body, paint, side * 0.6 - 0.07, 0.54, -1.5, side * 0.6, 0.86, 1.2);
    // A white stripe along each side, and studs along the top.
    block(body, white, side * 0.6 - 0.01, 0.62, -1.5, side * 0.6 + 0.005, 0.7, 1.2);
    studs(body, paint, 0.86, [side * 0.565], [-1.3, -0.8, -0.3, 0.2, 0.7]);
  }
  block(body, paint, -0.6, 0.54, -1.5, 0.6, 0.95, -1.43);
  // The front: a bonnet with studs, and a windscreen and wheel for the driver.
  block(body, paint, -0.6, 0.54, 1.2, 0.6, 0.86, 1.45);
  studs(body, paint, 0.86, [-0.3, 0, 0.3], [1.33]);
  block(body, toon('#bfe8ff', { transparent: true, opacity: 0.55 }), -0.55, 0.86, 1.17, 0.55, 1.22, 1.2);
  const steer = mesh(torus(0.12, 0.022), toon(BLACK), 0, 0.88, 1.1);
  steer.rotation.x = -0.6;
  body.add(steer);
  // The driver's seat, in front.
  v.seat = block(body, v.pad, -0.24, 0.54, 0.55, 0.24, 0.62, 1.05);
  block(body, v.pad, -0.24, 0.54, 0.49, 0.24, 0.98, 0.56);
  benches(v, 0.62);
  // A bell on a pole at the back, and bumpers, headlights for eyes and tail lights.
  body.add(mesh(cylinder(0.02, 0.02, 0.6, 6), dark, 0.52, 1.1, -1.46));
  body.add(mesh(sphere(1, 12, 10), v.glow, 0.52, 1.42, -1.46, 0.08));
  for (const z of [-1.53, 1.48]) {
    const b = mesh(cylinder(0.05, 0.05, 1.2, 10), white, 0, 0.32, z);
    b.rotation.z = Math.PI / 2;
    body.add(b);
  }
  v.eyes = lampEyes(body, 0.32, 0.68, 1.45, 0.12, v.glow);
  for (const side of [-1, 1]) block(body, toon('#ff4a4a', { emissive: 0.3 }), side * 0.48 - 0.06, 0.66, -1.53, side * 0.48 + 0.06, 0.76, -1.5);
  return { ...v, height: 1.3, center: 0.6, pick: 1.2, shadow: 1.25, seen: 120 };
}

function ferry(id) {
  const v = rig();
  const { body } = v;
  const stripe = toon(BOATS[(id + 1) % BOATS.length]);
  const white = toon('#f7f5ef');
  const deck = toon('#c99a6b');
  // The hull, its middle at the top of the water, a deck across it and a
  // rail round it.
  body.add(mesh(sphere(1, 28, 16), white, 0, -0.02, 0, 0.82, 0.34, 1.8));
  body.add(mesh(sphere(1, 28, 16), stripe, 0, -0.06, 0, 0.835, 0.2, 1.82));
  block(body, deck, -0.62, 0.2, -1.45, 0.62, 0.3, 1.25);
  const rail = mesh(torus(1, 0.04), stripe, 0, 0.62, -0.05, 0.7, 1.58, 1);
  rail.rotation.x = Math.PI / 2;
  body.add(rail);
  for (const [x, z] of [[-0.68, 0.6], [0.68, 0.6], [-0.68, -0.45], [0.68, -0.45], [-0.6, -1.25], [0.6, -1.25], [0, 1.52]]) body.add(mesh(cylinder(0.02, 0.02, 0.34, 6), stripe, x, 0.46, z));
  // The driver's seat and wheel up front, behind a windscreen.
  v.seat = block(body, v.pad, -0.24, 0.3, 0.55, 0.24, 0.38, 1.05);
  block(body, v.pad, -0.24, 0.3, 0.49, 0.24, 0.74, 0.56);
  block(body, toon('#bfe8ff', { transparent: true, opacity: 0.55 }), -0.45, 0.3, 1.24, 0.45, 0.8, 1.27);
  const steer = mesh(torus(0.11, 0.022), toon(BLACK), 0, 0.62, 1.1);
  steer.rotation.x = -0.6;
  body.add(steer);
  benches(v, 0.38);
  // A life ring on each side, and eyes on the bow.
  for (const side of [-1, 1]) {
    const ring = mesh(torus(0.13, 0.045), toon('#ff7a3d'), side * 0.79, 0.24, 0.2);
    ring.rotation.y = Math.PI / 2;
    body.add(ring);
  }
  v.eyes = lampEyes(body, 0.22, 0.14, 1.66, 0.1, v.glow);
  // A funnel at the back that puffs, and a propeller under the water.
  body.add(mesh(cylinder(0.12, 0.15, 0.5, 14), stripe, 0, 0.55, -1.55));
  body.add(mesh(cylinder(0.125, 0.125, 0.08, 14), toon(BLACK), 0, 0.82, -1.55));
  const prop = new THREE.Group();
  prop.position.set(0, -0.3, -1.72);
  for (let i = 0; i < 3; i++) {
    const b = mesh(sphere(1, 8, 6), toon(METAL), 0, 0, 0, 0.04, 0.11, 0.02);
    b.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.09, Math.sin((i * Math.PI * 2) / 3) * 0.09, 0);
    b.rotation.z = (i * Math.PI * 2) / 3 + Math.PI / 2;
    prop.add(b);
  }
  body.add(prop);
  v.prop = prop;
  // A flag at the bow.
  body.add(mesh(cylinder(0.015, 0.015, 0.7, 6), toon('#8b5a3c'), 0, 0.85, 1.52));
  const flag = mesh(box(), stripe, 0, 1.08, 1.4, 0.02, 0.16, 0.24);
  body.add(flag);
  v.flag = flag;
  return { ...v, sea: true, height: 0.9, center: 0.3, pick: 1.25, shadow: 0, seen: 130 };
}

export const VEHICLE_BUILDERS = { car, boat, digger, minecart, bus, ferry };

// One frame of a vehicle: its wheels (and tracks) turning as far as it went,
// the digger's drill and the boat's propeller going round while it moves,
// bobbing on the water, rocking along, and, honked (trick) or tapped
// (happy), a bounce with its lights bright.
export function drive(m, dt, state, moving) {
  const t = m.time;
  const b = m.body;
  m.trick = Math.max(0, m.trick - dt);
  const go = moving ? m.hs : 0;
  for (const w of m.wheels ?? []) w.rotation.x += (go * dt) / w.userData.r;
  const honk = m.trick > 0 || state === 'happy';
  m.glow.emissiveIntensity = honk ? 0.9 + Math.sin(t * 30) * 0.1 : 0.35;
  if (m.eyes) m.eyes.scale.setScalar(honk ? 1.15 : 1);
  if (m.type === 'boat' || m.sea) {
    const fast = clamp(go / 6, 0, 1);
    b.position.y = Math.sin(t * 2.1) * 0.03 + fast * (m.sea ? 0.03 : 0.06);
    b.rotation.set(-fast * 0.08 + Math.sin(t * 1.6) * 0.02, 0, Math.sin(t * 1.3) * 0.04 - clamp(m.turn * 0.04, -0.12, 0.12));
    m.prop.rotation.z += dt * (moving ? 30 : 2);
    m.flag.rotation.y = Math.sin(t * (moving ? 12 : 3)) * 0.3;
  } else {
    // An engine's shake, a bounce off the ground, and a tilt in the air.
    b.position.y = moving ? Math.sin(t * 40) * 0.006 : 0;
    b.rotation.set(state === 'jump' ? clamp(-m.vy * 0.03, -0.3, 0.3) : 0, 0, m.type === 'minecart' && moving ? Math.sin(t * 9) * 0.03 : 0);
    if (state === 'swim') b.position.y = Math.sin(t * 2) * 0.03 - 0.05;
  }
  if (honk) b.position.y += Math.abs(Math.sin(t * 14)) * 0.05;
  if (m.drill) {
    const working = moving || state === 'walk' || state === 'run';
    m.drill.rotation.z += dt * (working ? 16 : honk ? 8 : 0);
    m.beacon.emissiveIntensity = working || honk ? 0.4 + Math.max(0, Math.sin(t * 9)) * 0.9 : 0.3;
  }
}
