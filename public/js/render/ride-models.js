// A fun park island's rides, as toy models: a merry-go-round under a
// striped canopy edged with light bulbs, its horses going up and down on
// golden poles as it turns; and a Ferris wheel on two white legs, a rim of
// bulbs round it and a coloured cabin hanging from it for each friend, kept
// upright as the wheel goes round. Each turns by the clock (spinAt, in
// shared/critters.js), so wherever a friend sits on it here is where
// spinSeat says they are. Like the vehicles (vehicle-models.js), each seat
// is coloured as the T-shirt of whoever sits in it, and the bulbs light up
// bright when it is tapped. And the roller coaster (shared/coaster.js): its
// steel track on yellow posts, and its train of three cars going round it.
import * as THREE from '../../vendor/three.module.js';
import { frameQuat, MARKS, TRACK, trackAt, TRAIN, trainAt } from '../shared/coaster.js';
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

// ------------------------------------------------ the roller coaster

// The track as a curve for a tube to follow, `left` and `up` off its middle.
class TrackCurve extends THREE.Curve {
  constructor(left, up) {
    super();
    this.off = [left, up];
  }

  getPoint(u, target = new THREE.Vector3()) {
    const f = trackAt(u * TRACK.len);
    const [l, h] = this.off;
    return target.set(f.p[0] + f.left[0] * l + f.up[0] * h, f.p[1] + f.left[1] * l + f.up[1] * h, f.p[2] + f.left[2] * l + f.up[2] * h);
  }
}

const tube = (key, left, up, r) => geo(`coaster-${key}`, () => new THREE.TubeGeometry(new TrackCurve(left, up), TRACK.pts.length * 2, r, 8, true));

// A box w x h x d at f's point (plus left and up), turned with the track.
function onTrack(f, w, h, d, left = 0, up = 0) {
  const L = new THREE.Vector3(...f.left);
  const U = new THREE.Vector3(...f.up);
  const T = new THREE.Vector3(...f.t);
  const at = new THREE.Vector3(...f.p).addScaledVector(L, left).addScaledVector(U, up);
  return new THREE.Matrix4().makeBasis(L, U, T).scale(new THREE.Vector3(w, h, d)).setPosition(at);
}

// The track, standing still: two steel rails, a fat spine under them, ties
// across every half block, the lift hill's chain, and yellow posts down to
// the ground wherever nothing of the track is under it.
function coasterTrack(group) {
  const box = geo('box', () => new THREE.BoxGeometry(1, 1, 1));
  for (const side of [-1, 1]) group.add(mesh(tube(`rail${side}`, side * 0.42, 0, 0.06), toon('#e9edf2')));
  group.add(mesh(tube('spine', 0, -0.3, 0.16), toon('#e8453c')));
  const ties = [];
  const chain = [];
  for (let s = 0; s < TRACK.len; s += 0.5) {
    const f = trackAt(s);
    ties.push({ g: box, m: onTrack(f, 0.95, 0.07, 0.12, 0, -0.07) });
    ties.push({ g: box, m: onTrack(f, 0.09, 0.22, 0.09, 0, -0.2) });
  }
  for (let s = MARKS.LIFT; s < MARKS.CREST; s += 0.3) chain.push({ g: box, m: onTrack(trackAt(s), 0.16, 0.04, 0.1, 0, 0.01) });
  group.add(mesh(bakeCached('coaster-ties', ties), toon('#a3a7ad')));
  group.add(mesh(bakeCached('coaster-chain', chain), toon('#3a3540')));
  const posts = [];
  const n = TRACK.pts.length;
  for (let i = 0; i < n; i += 10) {
    const q = TRACK.pts[i];
    const foot = [q.p[0] - q.up[0] * 0.45, q.p[1] - q.up[1] * 0.45, q.p[2] - q.up[2] * 0.45];
    if (q.up[1] < 0.35 || foot[1] < 0.6) continue;
    // Not where it would go through the track lower down.
    const under = TRACK.pts.some((o, j) => Math.abs(((j - i + n * 1.5) % n) - n / 2) < n / 2 - 16 && o.p[1] < foot[1] - 0.5 && Math.hypot(o.p[0] - foot[0], o.p[2] - foot[2]) < 1.1);
    if (under) continue;
    posts.push({ g: cylinder(1, 1, 1, 10), m: new THREE.Matrix4().makeScale(0.15, foot[1], 0.15).setPosition(foot[0], foot[1] / 2, foot[2]) });
    posts.push({ g: cylinder(1, 1, 1, 10), m: new THREE.Matrix4().makeScale(0.3, 0.16, 0.3).setPosition(foot[0], 0.08, foot[2]) });
  }
  group.add(mesh(bakeCached('coaster-posts', posts), toon('#fcd535')));
}

// One car of the train, facing +z with its floor on the rails: two seats
// side by side (their pads in v.seatPads, left first), padded sides, a lap
// bar that comes down over both, and wheels on the rails. The front car has
// a nose with big headlights.
function coasterCar(v, k) {
  const g = new THREE.Group();
  const paint = toon(['#e8453c', '#fcd535', '#3a73d8'][k % 3]);
  const white = toon(WHITE);
  const dark = toon('#3a3540');
  const top = TRAIN.seat;
  block(g, dark, -0.5, 0.12, -0.9, 0.5, 0.22, 0.9);
  block(g, paint, -0.58, 0.22, -0.9, 0.58, top - 0.12, 0.9);
  for (const side of [-1, 1]) {
    block(g, paint, side * 0.58 - 0.08, top - 0.12, -0.9, side * 0.58, top + 0.3, 0.75);
    block(g, white, side * 0.58 - 0.09, top + 0.22, -0.9, side * 0.58 + 0.01, top + 0.3, 0.75);
    for (const z of [-0.6, 0.6]) {
      const w = mesh(cylinder(0.11, 0.11, 0.08, 12), dark, side * 0.42, 0.06, z);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
  }
  // The seats, a back behind each (and the next car's riders behind that).
  for (const across of [TRAIN.across, -TRAIN.across]) {
    const pad = seatPad(v);
    block(g, pad, across - 0.24, top - 0.12, -0.42, across + 0.24, top, 0.1);
    block(g, pad, across - 0.24, top - 0.12, -0.55, across + 0.24, top + 0.55, -0.42);
  }
  block(g, paint, -0.58, top - 0.12, 0.6, 0.58, top + 0.35, 0.9);
  if (k === 0) {
    g.add(mesh(sphere(1, 16, 12), paint, 0, top - 0.05, 0.95, 0.58, 0.32, 0.32));
    for (const side of [-1, 1]) g.add(mesh(sphere(1, 12, 8), v.glow, side * 0.3, top + 0.05, 1.18, 0.1));
  }
  // The lap bar, on a pivot behind the riders' knees.
  const bar = new THREE.Group();
  bar.position.set(0, top + 0.45, 0.45);
  g.add(bar);
  const gold = toon(GOLD);
  const across = mesh(cylinder(0.04, 0.04, 1.0, 8), gold, 0, 0, 0);
  across.rotation.z = Math.PI / 2;
  bar.add(across);
  for (const x of [-0.48, 0.48]) bar.add(mesh(cylinder(0.035, 0.035, 0.3, 8), gold, x, -0.15, 0.02));
  v.bars.push(bar);
  return g;
}

function coaster() {
  const v = rig('#fff1a8');
  v.seatPads = [];
  v.bars = [];
  // Track and train hang off the group, not the body: a tap bounces only
  // the body, and the whole coaster would bounce with it.
  coasterTrack(v.group);
  v.cars = Array.from({ length: TRAIN.cars }, (_, k) => {
    const car = coasterCar(v, k);
    v.group.add(car);
    return car;
  });
  v.animate = () => {
    const train = trainAt();
    v.cars.forEach((car, k) => {
      const f = trackAt(train.s - k * TRAIN.gap);
      car.position.set(...f.p);
      car.quaternion.set(...frameQuat(f));
    });
    // The lap bars up at the station, down out on the track.
    const want = train.phase === 'station' && train.wait > 1.5 ? -1.25 : 0;
    for (const bar of v.bars) bar.rotation.x += (want - bar.rotation.x) * 0.15;
  };
  v.animate();
  return { ...v, height: 2, center: 1, pick: 1.2, shadow: 0, seen: 300 };
}

export const RIDE_BUILDERS = { carousel, ferris, coaster };
