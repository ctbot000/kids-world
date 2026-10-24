// A fun park island's rides, as toy models: a merry-go-round under a
// striped canopy edged with light bulbs, its horses going up and down on
// golden poles as it turns; and a Ferris wheel on two white legs, a rim of
// bulbs round it and a coloured cabin hanging from it for each friend, kept
// upright as the wheel goes round. Each turns by the clock (spinAt, in
// shared/critters.js), so wherever a friend sits on it here is where
// spinSeat says they are. Like the vehicles (vehicle-models.js), each seat
// is coloured as the T-shirt of whoever sits in it, and the bulbs light up
// bright when it is tapped.
import * as THREE from '../../vendor/three.module.js';
import { CRITTER_INFO, horseBob, spinAt } from '../shared/critters.js';
import { bakeCached, cone, cylinder, geo, mesh, sphere, toon } from './toon.js';
import { block, rig, rod } from './vehicle-models.js';

const GOLD = '#f4c542';
const WHITE = '#f7f5ef';
const SEAT = '#ff6f6f';
const STRIPES = ['#e8453c', '#f7f5ef', '#3a8dde', '#f7f5ef', '#fcd535', '#f7f5ef', '#f47fb8', '#f7f5ef'];
const RAINBOW = ['#e8453c', '#f59331', '#fcd535', '#35a852', '#62c4f5', '#3a73d8', '#8c5bd6', '#f47fb8'];

// A matrix putting a unit cylinder (cylinder(1, 1, 1)) from a to b, r thick.
function rodMatrix(a, b, r) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return new THREE.Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), q, new THREE.Vector3(r, from.distanceTo(to), r));
}

// A seat cushion of its own, for whoever sits there (v.seatPads).
function seatPad(v) {
  const pad = toon(SEAT).clone();
  v.owned.push(pad);
  v.seatPads.push(pad);
  return pad;
}

// ------------------------------------------------ the merry-go-round

// A carousel horse, facing +z, in mid-gallop: its saddle (pad) on top at
// the ride's seat height.
function horse(coat, mane, pad, seat) {
  const g = new THREE.Group();
  const c = toon(coat);
  const m = toon(mane);
  const gold = toon(GOLD);
  const y = seat - 0.24;
  g.add(mesh(sphere(), c, 0, y, 0, 0.21, 0.22, 0.52));
  // The neck, up and forward, and the head on it.
  const neck = mesh(sphere(), c, 0, y + 0.26, 0.4, 0.13, 0.3, 0.14);
  neck.rotation.x = 0.55;
  g.add(neck);
  const head = mesh(sphere(), c, 0, y + 0.46, 0.6, 0.11, 0.12, 0.22);
  head.rotation.x = 0.35;
  g.add(head);
  g.add(mesh(sphere(1, 10, 8), toon('#2b2530'), 0.08, y + 0.52, 0.62, 0.025));
  g.add(mesh(sphere(1, 10, 8), toon('#2b2530'), -0.08, y + 0.52, 0.62, 0.025));
  for (const side of [-1, 1]) g.add(mesh(cone(0.035, 0.11, 6), c, side * 0.06, y + 0.62, 0.5));
  // The mane down its neck, and a tail.
  for (let k = 0; k < 4; k++) g.add(mesh(sphere(1, 8, 6), m, 0, y + 0.52 - k * 0.1, 0.42 - k * 0.09, 0.05, 0.07, 0.06));
  const tail = mesh(cone(0.08, 0.42, 8), m, 0, y - 0.05, -0.56);
  tail.rotation.x = -2.4;
  g.add(tail);
  // Its legs, the front ones kicked up and the back ones out behind.
  for (const [x, z, tilt] of [[0.1, 0.32, 0.9], [-0.1, 0.32, 0.6], [0.1, -0.34, -0.6], [-0.1, -0.34, -0.85]]) {
    const leg = new THREE.Group();
    leg.position.set(x, y - 0.12, z);
    leg.rotation.x = tilt;
    leg.add(mesh(cylinder(0.045, 0.035, 0.42, 8), c, 0, -0.21, 0));
    leg.add(mesh(cylinder(0.05, 0.05, 0.06, 8), gold, 0, -0.43, 0));
    g.add(leg);
  }
  // The saddle, a golden rim round it, and a bridle.
  block(g, pad, -0.17, seat - 0.06, -0.24, 0.17, seat, 0.14);
  block(g, gold, -0.19, seat - 0.1, -0.26, 0.19, seat - 0.05, 0.16);
  g.add(mesh(cylinder(0.115, 0.115, 0.03, 12), gold, 0, y + 0.46, 0.6).rotateX(Math.PI / 2 + 0.35));
  return g;
}

function carousel(id) {
  const v = rig('#fff1a8');
  const { body } = v;
  const r = CRITTER_INFO.carousel.ride;
  v.seatPads = [];
  const white = toon(WHITE);
  const gold = toon(GOLD);
  // The round base, standing still.
  body.add(mesh(cylinder(3.5, 3.6, 0.28, 40), toon('#f47fb8'), 0, 0.14, 0));
  body.add(mesh(cylinder(3.52, 3.52, 0.06, 40), white, 0, 0.26, 0));
  // Everything that turns.
  const spin = new THREE.Group();
  body.add(spin);
  spin.add(mesh(cylinder(3.3, 3.3, 0.12, 40), toon('#e2c393'), 0, 0.35, 0));
  // The middle: a column with mirrors round it, and a band of colour.
  spin.add(mesh(cylinder(0.62, 0.62, 3.5, 16), toon('#8c5bd6'), 0, 2.1, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spin.add(mesh(geo('carousel-mirror', () => new THREE.BoxGeometry(0.3, 0.9, 0.04)), toon('#c8f0ff', { emissive: 0.15 }), Math.sin(a) * 0.62, 2.2, Math.cos(a) * 0.62).rotateY(a));
  }
  spin.add(mesh(cylinder(0.7, 0.7, 0.2, 16), gold, 0, 0.5, 0));
  spin.add(mesh(cylinder(0.7, 0.7, 0.2, 16), gold, 0, 3.75, 0));
  // The canopy: a cone in stripes, a scalloped edge round it lit with bulbs,
  // and a flag on top.
  for (let i = 0; i < 16; i++) {
    const wedge = geo(`canopy-wedge-${i}`, () => new THREE.ConeGeometry(3.95, 1.5, 4, 1, true, (i / 16) * Math.PI * 2, Math.PI / 8));
    spin.add(mesh(wedge, toon(STRIPES[i % STRIPES.length], { side: THREE.DoubleSide }), 0, 4.65, 0));
  }
  spin.add(mesh(cylinder(3.95, 3.95, 0.4, 40), toon('#e8453c'), 0, 3.75, 0));
  const bulbs = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    bulbs.push({ g: sphere(1, 6, 4), m: new THREE.Matrix4().makeScale(0.07, 0.07, 0.07).setPosition(Math.sin(a) * 3.99, 3.75, Math.cos(a) * 3.99) });
    if (i % 2 === 0) bulbs.push({ g: sphere(1, 6, 4), m: new THREE.Matrix4().makeScale(0.06, 0.06, 0.06).setPosition(Math.sin(a) * 1.8, 4.8, Math.cos(a) * 1.8) });
  }
  spin.add(mesh(bakeCached('carousel-bulbs', bulbs), v.glow));
  spin.add(mesh(cylinder(0.04, 0.04, 0.9, 6), gold, 0, 5.75, 0));
  spin.add(mesh(sphere(1, 12, 8), gold, 0, 5.45, 0, 0.18));
  spin.add(mesh(geo('carousel-flag', () => new THREE.BoxGeometry(0.02, 0.26, 0.42)), toon('#e8453c'), 0, 6.05, 0.22));
  // A golden pole for each horse, and the horse on it (in the order of
  // ride.seats), facing the way it goes round.
  const coats = ['#f7f5ef', '#e2c393', '#c3a9f2', '#f8c8dc', '#9fd8f5', '#f7f5ef', '#ffe08a', '#b6e3a8'];
  const manes = ['#f47fb8', '#8b5a3c', '#8c5bd6', '#e8453c', '#3a73d8', '#fcd535', '#f59331', '#35a852'];
  v.horses = r.seats.map(([x, z], i) => {
    const a = Math.atan2(x, z);
    const post = new THREE.Group();
    post.position.set(x, 0, z);
    post.rotation.y = a + Math.PI / 2;
    spin.add(post);
    post.add(mesh(cylinder(0.04, 0.04, 3.4, 8), gold, 0, 2.1, 0.32));
    const h = horse(coats[(i + id) % coats.length], manes[(i + id) % manes.length], seatPad(v), r.seat);
    post.add(h);
    return h;
  });
  v.animate = () => {
    const turn = spinAt('carousel');
    spin.rotation.y = turn;
    v.horses.forEach((h, i) => (h.position.y = horseBob(r, i, turn)));
  };
  v.animate();
  return { ...v, height: 6.2, center: 2.4, pick: 3.4, shadow: 3, seen: 220 };
}

// ------------------------------------------------ the Ferris wheel

function ferris(id) {
  const v = rig('#fff1a8');
  const { body } = v;
  const { wheel: w, seats, seat } = CRITTER_INFO.ferris.ride;
  v.seatPads = [];
  const white = toon(WHITE);
  const legs = toon('#62c4f5');
  // Two A-shaped legs, one each side of the wheel, braced across, and the
  // axle between them; a step up to the cabins at the bottom.
  const frame = [];
  for (const z of [-1.15, 1.15]) {
    for (const x of [-3.4, 3.4]) frame.push({ g: cylinder(1, 1, 1, 8), m: rodMatrix([x, 0, z], [0, w.hub, z * 0.85], 0.16) });
    frame.push({ g: cylinder(1, 1, 1, 8), m: rodMatrix([-1.9, w.hub * 0.45, z * 0.93], [1.9, w.hub * 0.45, z * 0.93], 0.09) });
  }
  body.add(mesh(bakeCached('ferris-frame', frame), legs));
  for (const x of [-3.4, 3.4]) for (const z of [-1.15, 1.15]) body.add(mesh(cylinder(0.32, 0.38, 0.2, 10), white, x, 0.1, z));
  const axle = mesh(cylinder(0.24, 0.24, 2.5, 12), toon('#a3a7ad'), 0, w.hub, 0);
  axle.rotation.x = Math.PI / 2;
  body.add(axle);
  block(body, toon('#e2c393'), -0.9, 0, 0.62, 0.9, 0.18, 1.3);
  // The wheel: two rims and an inner ring each side, spokes, a crossbar at
  // each cabin, bulbs all round, and a star on the hub.
  const turn = new THREE.Group();
  turn.position.y = w.hub;
  body.add(turn);
  const parts = [];
  const bulbs = [];
  for (const z of [-0.78, 0.78]) {
    parts.push({ g: geo('ferris-rim', () => new THREE.TorusGeometry(w.r, 0.11, 6, 64)), m: new THREE.Matrix4().makeTranslation(0, 0, z) });
    parts.push({ g: geo('ferris-ring', () => new THREE.TorusGeometry(w.r * 0.5, 0.07, 6, 40)), m: new THREE.Matrix4().makeTranslation(0, 0, z) });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      parts.push({ g: cylinder(1, 1, 1, 6), m: rodMatrix([0, 0, z * 0.4], [Math.cos(a) * w.r, Math.sin(a) * w.r, z], 0.05) });
    }
    for (let i = 0; i < 48; i++) {
      const a = ((i + 0.5) / 48) * Math.PI * 2;
      bulbs.push({ g: sphere(1, 6, 4), m: new THREE.Matrix4().makeScale(0.09, 0.09, 0.09).setPosition(Math.cos(a) * (w.r + 0.13), Math.sin(a) * (w.r + 0.13), z) });
    }
  }
  seats.forEach((_, i) => {
    const a = (i / seats.length) * Math.PI * 2;
    parts.push({ g: cylinder(1, 1, 1, 6), m: rodMatrix([Math.cos(a) * w.r, Math.sin(a) * w.r, -0.8], [Math.cos(a) * w.r, Math.sin(a) * w.r, 0.8], 0.06) });
  });
  turn.add(mesh(bakeCached('ferris-wheel', parts), white));
  turn.add(mesh(bakeCached('ferris-bulbs', bulbs), v.glow));
  for (const z of [-0.95, 0.95]) {
    const cap = mesh(cylinder(0.7, 0.7, 0.16, 5), toon('#fcd535'), 0, 0, z);
    cap.rotation.x = Math.PI / 2;
    turn.add(cap);
  }
  // A cabin for each seat, hanging from its crossbar: a floor, low sides, a
  // seat, four corner posts and a roof, in a colour of its own.
  v.cabins = seats.map((_, i) => {
    const a = (i / seats.length) * Math.PI * 2;
    const cab = new THREE.Group();
    cab.position.set(Math.cos(a) * w.r, Math.sin(a) * w.r, 0);
    turn.add(cab);
    const paint = toon(RAINBOW[(i + id) % RAINBOW.length]);
    const floor = -w.hang;
    rod(cab, toon('#a3a7ad'), [0, 0, 0], [0, floor + 1.55, 0], 0.04);
    block(cab, paint, -0.62, floor - 0.08, -0.55, 0.62, floor, 0.55);
    block(cab, paint, -0.62, floor, -0.55, -0.56, floor + 0.5, 0.55);
    block(cab, paint, 0.56, floor, -0.55, 0.62, floor + 0.5, 0.55);
    block(cab, paint, -0.62, floor, -0.55, 0.62, floor + 0.62, -0.49);
    block(cab, white, -0.62, floor, 0.49, 0.62, floor + 0.36, 0.55);
    const pad = seatPad(v);
    block(cab, pad, -0.42, floor + seat - 0.1, -0.48, 0.42, floor + seat, 0.02);
    block(cab, pad, -0.42, floor + seat, -0.5, 0.42, floor + seat + 0.38, -0.43);
    for (const x of [-0.58, 0.58]) for (const z of [-0.51, 0.51]) block(cab, white, x - 0.03, floor, z - 0.03, x + 0.03, floor + 1.5, z + 0.03);
    block(cab, paint, -0.7, floor + 1.5, -0.62, 0.7, floor + 1.6, 0.62);
    cab.add(mesh(cone(0.85, 0.3, 4), paint, 0, floor + 1.75, 0).rotateY(Math.PI / 4));
    return cab;
  });
  v.animate = () => {
    const a = spinAt('ferris');
    turn.rotation.z = a;
    for (const cab of v.cabins) cab.rotation.z = -a;
  };
  v.animate();
  return { ...v, height: w.hub + w.r + 1, center: w.hub, pick: w.r + 0.5, shadow: 3.2, seen: 280 };
}

export const RIDE_BUILDERS = { carousel, ferris };
