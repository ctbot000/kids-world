// The players: kids and grown-ups shaped like real people — a kid about six
// heads tall and a grown-up seven, with long legs that bend at the knee, arms
// that bend at the elbow, hands with fingers, and faces with lidded eyes, a
// nose and lips — and the little animals on a body like a kid's, with their
// own round heads. Everyone wears a t-shirt, jeans and sneakers, and a hat if
// they like. Built from shapes sculpted in code and animated by hand:
// walking, running, jumping, swimming, flying, sitting, riding, and the
// emotes (wave, dance, cheer...).
import * as THREE from '../../vendor/three.module.js';
import { BRICK_COLORS, TOY_BRICKS } from '../shared/blocks.js';
import { BENCH_H, HIGH, LOW } from '../shared/piano.js';
import { FUR_COLORS, GROWN_UP, HAIR_COLORS, isPerson, lookTall, SKIN_TONES } from '../shared/words.js';
import { bake, bakeCached, blobShadow, capsule, cone, cylinder, geo, lathe, loft, mesh, onSurface, roundedBox, sphere, toon, torus } from './toon.js';

// Heads are made at one size, HEAD_R or so from the middle to the top, and
// scaled down to the body they go on.
const HEAD_R = 0.34;
const headShape = (sx, sy, sz) => ({ sx, sy, sz, r: [HEAD_R * sx, HEAD_R * sy, HEAD_R * sz] });
// An animal's round head; and a person's, narrower than it is tall and deeper
// than it is wide, with a jaw under it (see headPoint).
const HEAD = headShape(1.08, 0.96, 1);
const HR = HEAD.r;
const PERSON = headShape(0.8, 1, 0.93);
const PR = PERSON.r;

// Swings at a monster, one for each toy weapon and a punch without one: a
// wind-up, a strike that speeds up into the hit (at strike, a fraction of
// the way through), a moment held there, and an easy way back. Each key is a
// pose at a fraction of the way through: w how much of it (0 is the pose the
// avatar would have anyway), fwd and raise the right arm (as armFwdR and
// armRaiseR) and elbow how far its elbow bends, wrist turns what is in that
// hand forward and down (0 holds it square to the upper arm, as at rest),
// fwdL, raiseL and elbowL the left arm (with wL how much), twist the
// shoulders round (+ takes the right one back), lean forward, dip the body,
// nod the head, and step the left foot forward.
export const SWINGS = {
  // The fist drawn back by the shoulder, then the arm straight out.
  punch: {
    secs: 0.34,
    strike: 0.4,
    keys: [
      { at: 0, w: 0 },
      { at: 0.22, w: 1, fwd: 0.45, raise: 0.3, elbow: 1.9, twist: 0.3, lean: -0.03 },
      { at: 0.4, w: 1, fwd: -1.6, raise: 0.08, elbow: 0.05, twist: -0.4, lean: 0.14, step: 0.3, dip: -0.02 },
      { at: 0.58, w: 1, fwd: -1.55, raise: 0.08, elbow: 0.1, twist: -0.38, lean: 0.12, step: 0.3, dip: -0.02 },
      { at: 1, w: 0 },
    ],
  },
  // Up behind the shoulder, blade back, then down and across in front, the
  // blade ending a little below level.
  sword: {
    secs: 0.44,
    strike: 0.48,
    keys: [
      { at: 0, w: 0 },
      { at: 0.3, w: 1, fwd: -2.5, raise: 0.75, elbow: 0.7, wrist: -0.3, twist: 0.4, lean: -0.06, nod: -0.12 },
      { at: 0.48, w: 1, fwd: -1, raise: -0.35, elbow: 0.12, wrist: 1.05, twist: -0.42, lean: 0.16, step: 0.35, dip: -0.03, nod: 0.1 },
      { at: 0.62, w: 1, fwd: -0.65, raise: -0.45, elbow: 0.2, wrist: 0.95, twist: -0.48, lean: 0.14, step: 0.35, dip: -0.03, nod: 0.08 },
      { at: 1, w: 0 },
    ],
  },
  // Both hands up and back over the head, then down with all the body
  // behind it, the head of the hammer landing on the ground in front.
  hammer: {
    secs: 0.6,
    strike: 0.56,
    keys: [
      { at: 0, w: 0, wL: 0 },
      { at: 0.42, w: 1, wL: 1, fwd: -3, raise: 0.12, elbow: 0.6, wrist: -0.2, fwdL: -2.8, raiseL: 0.05, elbowL: 0.6, lean: -0.16, nod: -0.18 },
      { at: 0.56, w: 1, wL: 1, fwd: -1.1, raise: -0.08, elbow: 0.15, wrist: 1.45, fwdL: -1.15, raiseL: -0.35, elbowL: 0.15, lean: 0.32, step: 0.4, dip: -0.08, nod: 0.18 },
      { at: 0.72, w: 1, wL: 1, fwd: -0.95, raise: -0.08, elbow: 0.15, wrist: 1.55, fwdL: -1, raiseL: -0.35, elbowL: 0.15, lean: 0.3, step: 0.4, dip: -0.07, nod: 0.15 },
      { at: 1, w: 0, wL: 0 },
    ],
  },
  // Up to aim, the other hand under it, the barrel kept level; a kick up
  // as the bubble goes, and down again.
  blaster: {
    secs: 0.42,
    strike: 0.34,
    keys: [
      { at: 0, w: 0, wL: 0 },
      { at: 0.26, w: 1, wL: 1, fwd: -1.45, raise: 0.04, elbow: 0.2, wrist: 1.45, fwdL: -0.95, raiseL: -0.4, elbowL: 0.6, twist: -0.12, lean: 0.06 },
      { at: 0.34, w: 1, wL: 1, fwd: -1.45, raise: 0.04, elbow: 0.2, wrist: 1.45, fwdL: -0.95, raiseL: -0.4, elbowL: 0.6, twist: -0.12, lean: 0.06 },
      { at: 0.42, w: 1, wL: 1, fwd: -1.75, raise: 0.04, elbow: 0.3, wrist: 1.35, fwdL: -1.2, raiseL: -0.4, elbowL: 0.62, twist: -0.1, lean: -0.06 },
      { at: 0.6, w: 1, wL: 1, fwd: -1.45, raise: 0.04, elbow: 0.2, wrist: 1.45, fwdL: -0.95, raiseL: -0.4, elbowL: 0.6, twist: -0.12, lean: 0.06 },
      { at: 1, w: 0, wL: 0 },
    ],
  },
  // The Lava Blade: drawn up high behind, both hands on it, then a great
  // diagonal cut down across, the whole body winding into it — slower than
  // the sword and heavier, and it lands like it.
  lavablade: {
    secs: 0.52,
    strike: 0.5,
    keys: [
      { at: 0, w: 0, wL: 0 },
      { at: 0.32, w: 1, wL: 1, fwd: -2.7, raise: 0.9, elbow: 0.55, wrist: -0.35, fwdL: -2.55, raiseL: 0.8, elbowL: 0.6, twist: 0.5, lean: -0.09, nod: -0.14 },
      { at: 0.5, w: 1, wL: 1, fwd: -0.95, raise: -0.4, elbow: 0.1, wrist: 1.15, fwdL: -0.85, raiseL: -0.5, elbowL: 0.15, twist: -0.5, lean: 0.2, step: 0.4, dip: -0.05, nod: 0.12 },
      { at: 0.66, w: 1, wL: 1, fwd: -0.75, raise: -0.48, elbow: 0.16, wrist: 1.05, fwdL: -0.7, raiseL: -0.55, elbowL: 0.2, twist: -0.54, lean: 0.18, step: 0.4, dip: -0.05, nod: 0.1 },
      { at: 1, w: 0, wL: 0 },
    ],
  },
};
const POSE_KEYS = ['w', 'wL', 'fwd', 'raise', 'elbow', 'wrist', 'fwdL', 'raiseL', 'elbowL', 'twist', 'lean', 'nod', 'dip', 'step'];
// What a key says of one of them: an arm angle a key leaves out is the next
// key's (it has no weight there anyway), anything else is none.
const ARM_ANGLES = new Set(['fwd', 'raise', 'elbow', 'wrist', 'fwdL', 'raiseL', 'elbowL']);
const poseValue = (key, mine, next) => mine[key] ?? (ARM_ANGLES.has(key) ? (next[key] ?? 0) : 0);
// Ease in and out between keys, but into the strike speeding up all the way,
// so it lands hard.
const easeInOut = (k) => k * k * (3 - 2 * k);
const easeIn = (k) => k * k * k;

// The pose a swing has reached, k of the way through it.
export function swingPose(swing, k) {
  const { keys } = swing;
  let i = 1;
  while (i < keys.length - 1 && keys[i].at < k) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const f = Math.min(1, Math.max(0, (k - a.at) / (b.at - a.at || 1)));
  const e = b.at === swing.strike ? easeIn(f) : easeInOut(f);
  const pose = {};
  for (const key of POSE_KEYS) {
    const va = poseValue(key, a, b);
    pose[key] = va + (poseValue(key, b, a) - va) * e;
  }
  return pose;
}
const BLACK = '#2b2530';
const WHITE = '#ffffff';
const PINK = '#ff9fb8';
const EYE = '#4a3226';

// How a body is put together, in blocks up from the soles: a kid's (and an
// animal's) and a grown-up's, in the proportions of real people. hip, knee:
// how high those joints are, hipX how far out the hips; hem: how high the
// jeans come down to. thigh, shin: the jeans' radius at the top, middle and
// bottom of each. seat and shirt: rings of the jeans' seat and the t-shirt,
// each [height over the hips, half width, depth in front, depth behind].
// shoulder: the shoulder joints' [height over the hips, distance out]. neck:
// [bottom, radius, top] over the hips. arm: the upper arm's and forearm's
// lengths, and the arm's radius at the shoulder, elbow and wrist. sleeve: how
// far down the t-shirt's sleeves come. hand, foot: their sizes. badge: the
// star on the shirt's [height, size]. head: a person's skull, its scale (k),
// its middle over the hips (y) and forward (z), and the neck's pivot (pivot).
const BUILDS = {
  kid: {
    hip: 0.71,
    hipX: 0.068,
    knee: 0.385,
    hem: 0.07,
    thigh: [0.064, 0.055, 0.047],
    shin: [0.047, 0.044, 0.042],
    seat: [
      [-0.108, 0.04, 0.03, 0.035],
      [-0.095, 0.098, 0.064, 0.076],
      [-0.06, 0.116, 0.074, 0.09],
      [-0.01, 0.121, 0.077, 0.093],
      [0.04, 0.118, 0.074, 0.086],
      [0.08, 0.111, 0.07, 0.077],
      [0.09, 0.09, 0.058, 0.062],
    ],
    shirt: [
      [0.035, 0.123, 0.082, 0.092],
      [0.09, 0.114, 0.075, 0.08],
      [0.155, 0.106, 0.071, 0.073],
      [0.235, 0.112, 0.078, 0.072],
      [0.305, 0.121, 0.085, 0.074],
      [0.355, 0.126, 0.081, 0.075],
      [0.388, 0.12, 0.071, 0.068],
      [0.41, 0.098, 0.059, 0.058],
      [0.426, 0.062, 0.047, 0.046],
    ],
    shoulder: [0.364, 0.119],
    neck: [0.39, 0.037, 0.52],
    arm: [0.245, 0.2, 0.036, 0.03, 0.022],
    sleeve: 0.1,
    hand: 1.22,
    foot: 1,
    badge: [0.3, 0.6],
    head: { k: 0.36, y: 0.5776, z: 0.014, pivot: 0.46 },
  },
  grown: {
    hip: 0.9,
    hipX: 0.085,
    knee: 0.49,
    hem: 0.085,
    thigh: [0.08, 0.068, 0.056],
    shin: [0.056, 0.053, 0.05],
    seat: [
      [-0.13, 0.05, 0.036, 0.042],
      [-0.115, 0.122, 0.078, 0.094],
      [-0.072, 0.146, 0.09, 0.112],
      [-0.012, 0.152, 0.094, 0.115],
      [0.048, 0.149, 0.091, 0.106],
      [0.096, 0.14, 0.087, 0.095],
      [0.108, 0.114, 0.072, 0.077],
    ],
    shirt: [
      [0.042, 0.154, 0.1, 0.112],
      [0.105, 0.143, 0.092, 0.098],
      [0.18, 0.133, 0.087, 0.09],
      [0.285, 0.142, 0.097, 0.09],
      [0.385, 0.157, 0.108, 0.093],
      [0.45, 0.163, 0.103, 0.094],
      [0.495, 0.156, 0.09, 0.085],
      [0.524, 0.122, 0.074, 0.072],
      [0.545, 0.077, 0.058, 0.057],
    ],
    shoulder: [0.462, 0.153],
    neck: [0.49, 0.048, 0.64],
    arm: [0.3, 0.255, 0.046, 0.038, 0.028],
    sleeve: 0.125,
    hand: 1.5,
    foot: 1.28,
    badge: [0.38, 0.75],
    head: { k: 0.335, y: 0.7161, z: 0.016, pivot: 0.59 },
  },
};
// An animal's head on a kid's body: bigger than a person's, its top where a
// kid's is.
const ANIMAL_SKULL = { k: 0.42, y: 1.41 - HR[1] * 0.42 - BUILDS.kid.hip, z: 0.015, pivot: 0.45 };
// How far out from the sides the arms hang, clear of the hips.
const REST_RAISE = 0.09;
// How high the hips are over the root riding (critters.js HIPS, and a little
// for sinking into the saddle), and over the seat sitting.
const RIDE_HIPS = 0.28;
const SIT_HIPS = 0.075;
// How far forward you lean swimming, and how high over the root the middle
// of your head is: just over the water, which comes up to 1.175 over a
// swimmer's root (physics.js floats them with the top of the water block 1.3
// over it, and render/mesher.js draws the water's top 0.125 under that).
const SWIM_LEAN = 0.62;
const SWIM_HEAD = 1.23;
// Curled up in a bed one block long, all of you fits in this much of it,
// head to toe and side to side (shared/seats.js puts the root at its middle).
const CURL_ROOM = { long: 0.84, wide: 0.84 };

// dizzy: sitting on the ground, out of hearts on an adventure island, until a friend helps you up.
// sit: on a chair or a sofa, the root at the seat; lie: in bed, on your
// back, the root at your feet and your head behind you; curl: in a bed one
// block long, curled up on your side with your knees up, made just small
// enough to fit in it, the root in the middle of the bed (shared/seats.js);
// piano: on a piano bench (drawn under you) playing the piano in front of
// you, the root at the top of the bench (shared/piano.js pianoSeat).
export const ANIM = { idle: 0, walk: 1, run: 2, air: 3, swim: 4, fly: 5, ride: 6, dizzy: 7, sit: 8, lie: 9, curl: 10, piano: 11, type: 12, coffee: 13 };
// How long someone on a coffee break waits between sips, at least and at
// most, each wait picked at random so no two people sip together; and how
// long a sip takes (s).
const SIP_GAP = [3, 10];
const SIP_TIME = 2.4;
// When the last sip on this page began (performance.now(), ms): someone
// about to sip while another is still drinking waits a moment, so people
// on a break together take turns rather than drinking as one.
let lastSip = -Infinity;
// A coffee mug's radius and height, for a hand of size 1.
const MUG_R = 0.027;
const MUG_H = 0.062;

export function shirtColor(index) {
  return BRICK_COLORS[index]?.[2] ?? BRICK_COLORS[0][2];
}

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  const w = new THREE.Color('#ffffff');
  return `#${c.lerp(w, k).getHexString()}`;
}

function darken(hex, k) {
  const c = new THREE.Color(hex);
  return `#${c.multiplyScalar(1 - k).getHexString()}`;
}

function mix(hex, other, k) {
  return `#${new THREE.Color(hex).lerp(new THREE.Color(other), k).getHexString()}`;
}

// Trousers that go with a shirt: blue jeans, or sand-coloured ones under a
// shirt that is blue already.
function trousersFor(shirt) {
  const hsl = new THREE.Color(shirt).getHSL({});
  const blue = hsl.h > 0.45 && hsl.h < 0.8 && hsl.s > 0.3;
  if (blue || hsl.s < 0.15 && hsl.l < 0.4) return '#c9a877';
  return '#4b67a1';
}

// Sneakers to match the shirt, red where the shirt is pale or dull.
function shoeFor(shirt) {
  const hsl = new THREE.Color(shirt).getHSL({});
  return hsl.s < 0.3 || hsl.l > 0.8 ? '#e8453c' : darken(shirt, 0.08);
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Where a part goes: at p, turned by q and then by the angles (rx, ry, rz) in
// its own frame, and scaled by (sx, sy, sz).
function placed(p, q, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  const turn = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)));
  return new THREE.Matrix4().compose(p, turn, new THREE.Vector3(sx, sy, sz));
}
const facing = (n) => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, n);
const NO_TURN = new THREE.Quaternion();
const at = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => placed(new THREE.Vector3(x, y, z), NO_TURN, sx, sy, sz, rx, ry, rz);
// A rod of length 1 along y, stood from a to b.
function between(a, b, r = 1) {
  const d = b.clone().sub(a);
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), new THREE.Vector3(r, d.length(), r));
}

// A sneaker, its sole at y 0 under the ankle and its toe forward (+z), size
// times a kid's: a rubber sole a little wider than the shoe, an upper that
// rises from a low toe to a padded collar round the ankle, and in white the
// laces across the top and a stripe along each side.
const sneakerSole = (size) =>
  loft(
    [
      [-0.052, 0.012, 0.007, 0.007, 0.013],
      [-0.048, 0.026, 0.012, 0.012, 0.013],
      [-0.032, 0.031, 0.013, 0.013, 0.013],
      [0.0, 0.031, 0.013, 0.013, 0.013],
      [0.04, 0.032, 0.012, 0.012, 0.012],
      [0.08, 0.038, 0.012, 0.012, 0.012],
      [0.115, 0.037, 0.012, 0.012, 0.012],
      [0.14, 0.03, 0.012, 0.011, 0.013],
      [0.151, 0.019, 0.01, 0.009, 0.014],
      [0.156, 0.007, 0.005, 0.005, 0.015],
    ].map(([z, ...r]) => [z * size, ...r.map((v) => v * size)]),
    { along: 'z', n: 3.4, segs: 20 },
  );
const sneakerUpper = (size) =>
  loft(
    [
      [-0.048, 0.012, 0.016, 0.012, 0.062],
      [-0.044, 0.025, 0.035, 0.024, 0.048],
      [-0.026, 0.03, 0.036, 0.028, 0.05],
      [0.0, 0.031, 0.034, 0.028, 0.05],
      [0.03, 0.032, 0.028, 0.025, 0.046],
      [0.065, 0.034, 0.02, 0.02, 0.042],
      [0.095, 0.035, 0.015, 0.017, 0.037],
      [0.12, 0.033, 0.012, 0.014, 0.034],
      [0.14, 0.026, 0.01, 0.012, 0.032],
      [0.149, 0.015, 0.007, 0.008, 0.03],
      [0.152, 0.004, 0.003, 0.003, 0.03],
    ].map(([z, ...r]) => [z * size, ...r.map((v) => v * size)]),
    { along: 'z', n: 2.4, segs: 22 },
  );
const sneakerTrim = (size) =>
  geo(`sneaker-trim|${size}`, () =>
    bake([
      // Laces across the top of the instep, following its slope.
      ...[0.028, 0.048, 0.068].map((z, i) => ({ g: capsule(0.0042, 0.03, 3, 6), m: at(0, 0.075 - i * 0.007, z, 1, 1, 1, -0.32, 0, Math.PI / 2) })),
      // A stripe along each side, from the heel up towards the laces.
      ...[-1, 1].map((side) => ({ g: sphere(1, 12, 8), m: at(side * 0.032, 0.045, 0.03, 0.005, 0.011, 0.04, -0.35, side * 0.06, 0) })),
    ].map(({ g, m }) => ({ g, m: new THREE.Matrix4().makeScale(size, size, size).multiply(m) }))),
  );

// Running shoes from the shop (shared/shop.js), in place of the sneakers
// that match the shirt: their colours (upper, sole, trim), and what else is
// on them — a lightning bolt on each side, or a rocket boot's cuff and the
// nozzle at its heel, which blazes as you run.
const SHOES = {
  bouncy: { upper: '#36c5f0', sole: '#ffe14d', trim: '#ffffff' },
  zoomy: { upper: '#ffd23f', sole: '#ffffff', trim: '#ff7a1a', bolt: '#ff7a1a' },
  rocket: { upper: '#e8453c', sole: '#d9dde3', trim: '#ffffff', rocket: true },
};

// A lightning bolt, flat, facing +x: the mark on a Zoomy Sneaker's side.
const boltShape = () =>
  geo('shoe-bolt', () => {
    const s = new THREE.Shape();
    [[0.022, 0.026], [-0.012, 0.003], [0.006, 0.003], [-0.022, -0.026], [0.012, -0.003], [-0.006, -0.003]].forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    return g;
  });

// A flame: a glowing cone pointing down from its top (y 0), to scale by how
// hard it blazes.
function flame(r, len) {
  const g = new THREE.Group();
  g.add(mesh(cone(r, len, 12), toon('#ffb52e', { emissive: 0.9 }), 0, -len / 2, 0).rotateX(Math.PI));
  g.add(mesh(cone(r * 0.55, len * 0.6, 10), toon('#fff3a3', { emissive: 1 }), 0, -len * 0.3, 0).rotateX(Math.PI));
  return g;
}

// What else a pair of shoes has on each foot (the knee's group, the sole
// at -knee): returns the flames, if any.
function shoeExtras(knee, kind, B, side) {
  const s = SHOES[kind];
  const f = B.foot;
  const y = -B.knee;
  const flames = [];
  if (s.bolt) knee.add(mesh(boltShape(), toon(s.bolt, { emissive: 0.3 }), side * 0.039 * f, y + 0.045 * f, 0.02 * f, side, 1, 1));
  if (s.rocket) {
    // A silver cuff round the ankle, and a nozzle at the heel.
    knee.add(mesh(torus(0.042 * f, 0.012 * f), toon(s.sole), 0, y + 0.085 * f, 0.005 * f).rotateX(Math.PI / 2));
    knee.add(mesh(cylinder(0.018 * f, 0.026 * f, 0.04 * f, 12), toon('#8a919c'), 0, y + 0.045 * f, -0.062 * f).rotateX(-0.5));
    const fire = flame(0.022 * f, 0.12 * f);
    fire.position.set(0, y + 0.03 * f, -0.07 * f);
    fire.rotation.x = -0.5;
    knee.add(fire);
    flames.push(fire);
  }
  return flames;
}

// Roller skates from the shop (shared/shop.js), in place of shoes: a boot
// (upper, sole and laces as a sneaker's), a silver plate under it on four
// wheels, and a rubber stopper at the toe. Light-up Skates' wheels each
// glow a colour of the rainbow.
const SKATES = {
  roller: { upper: '#ff7eb6', sole: '#ffffff', trim: '#ffffff', wheels: ['#ffe14d'], stopper: '#e8453c' },
  glowy: { upper: '#7a5cff', sole: '#e9e4ff', trim: '#ffe14d', wheels: ['#ff5a5a', '#ffb52e', '#4fd67a', '#36c5f0'], stopper: '#ff7eb6', glow: true },
};
// How far the wheels lift you, a kid's (times the foot's size).
const SKATE_LIFT = 0.052;
const WHEEL_R = 0.022;

// The plate, wheels and stopper on one foot (the knee's group, the sole at
// -knee): returns the wheels, to roll.
function skateParts(knee, kind, B) {
  const s = SKATES[kind];
  const f = B.foot;
  const y = -B.knee;
  const plateY = y - 0.008 * f;
  knee.add(mesh(roundedBox(0.06 * f, 0.012 * f, 0.19 * f, 0.004 * f), toon('#c8ccd3'), 0, plateY, 0.052 * f));
  const wheels = [];
  [-0.012, 0.118].forEach((z, i) =>
    [-1, 1].forEach((side, j) => {
      const colour = s.wheels[(i * 2 + j) % s.wheels.length];
      const wheel = mesh(cylinder(WHEEL_R * f, WHEEL_R * f, 0.018 * f, 16), toon(colour, { emissive: s.glow ? 0.8 : 0 }), side * 0.033 * f, plateY - 0.022 * f, z * f);
      wheel.rotation.z = Math.PI / 2;
      knee.add(wheel);
      wheels.push(wheel);
    }),
  );
  knee.add(mesh(sphere(1, 14, 10), toon(s.stopper), 0, y - 0.004 * f, 0.162 * f, 0.016 * f, 0.016 * f, 0.016 * f));
  return wheels;
}

// Flying gear from the shop on your back, over a cape or a robe: feathered
// wings, a fairy's see-through ones, or a jet pack with two flames. Returns
// { sides: [left, right] wing groups that flap, sweep: how far back they
// fold, flaps: how fast they beat flying, flames }.
function wingsOn(av, kind, B, caped) {
  const k = B.hip / BUILDS.kid.hip;
  const y = B.shoulder[0] - 0.06 * k;
  const back = (B.shirt.find(([ry]) => ry >= y) ?? B.shirt[B.shirt.length - 1])[3];
  const g = new THREE.Group();
  // Over a cape or a robe, far enough out to be outside it.
  g.position.set(0, y, -back - (caped ? 0.1 : 0.025) * k);
  av.torso.add(g);
  const out = { sides: [], sweep: 0.35, flaps: 9, flames: [] };
  if (kind === 'jetpack') {
    g.add(mesh(roundedBox(0.15 * k, 0.17 * k, 0.04 * k), toon('#5b6573'), 0, -0.04 * k, 0.005 * k));
    for (const side of [-1, 1]) {
      const x = side * 0.058 * k;
      g.add(mesh(cylinder(0.042 * k, 0.042 * k, 0.2 * k, 16), toon('#d9dde3'), x, -0.03 * k, -0.04 * k));
      g.add(mesh(cone(0.042 * k, 0.07 * k, 16), toon('#e8453c'), x, 0.105 * k, -0.04 * k));
      g.add(mesh(cylinder(0.03 * k, 0.04 * k, 0.035 * k, 14), toon('#3d434c'), x, -0.145 * k, -0.04 * k));
      const fire = flame(0.032 * k, 0.2 * k);
      fire.position.set(x, -0.16 * k, -0.04 * k);
      g.add(fire);
      out.flames.push(fire);
    }
    return out;
  }
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.x = side * 0.035 * k;
    g.add(wing);
    out.sides.push(wing);
    if (kind === 'feather') {
      // Five white feathers fanned out and up, longest at the top, from a
      // soft rounded shoulder of the wing.
      const white = toon('#fbfaf5');
      const tip = toon('#d8e6f5');
      const base = mesh(sphere(1, 16, 12), white, side * 0.07 * k, 0.03 * k, 0, 0.085 * k, 0.05 * k, 0.025 * k);
      base.rotation.z = side * -0.5;
      wing.add(base);
      for (let i = 0; i < 5; i++) {
        const len = (0.17 + i * 0.035) * k;
        const a = 1.6 - i * 0.25;
        const dir = new THREE.Vector3(side * Math.sin(a), Math.cos(a) * 0.9 - 0.25, -0.05);
        const f = mesh(capsule(0.028 * k, len, 4, 10), i === 4 ? tip : white);
        f.scale.z = 0.32;
        f.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
        f.position.copy(dir.normalize().multiplyScalar(len / 2 + 0.02 * k));
        wing.add(f);
      }
    } else {
      // Two see-through lobes, a big one up and a small one down, with a
      // little sparkle where they meet.
      out.sweep = 0.25;
      out.flaps = 16;
      const film = toon('#c9b6ff', { transparent: true, opacity: 0.55, emissive: 0.25 });
      const low = toon('#a8e6ff', { transparent: true, opacity: 0.55, emissive: 0.25 });
      const up = mesh(sphere(1, 18, 12), film, side * 0.12 * k, 0.09 * k, 0, 0.13 * k, 0.085 * k, 0.008);
      up.rotation.z = side * -0.55;
      const down = mesh(sphere(1, 16, 10), low, side * 0.085 * k, -0.06 * k, 0, 0.08 * k, 0.055 * k, 0.008);
      down.rotation.z = side * 0.6;
      wing.add(up, down, mesh(sphere(1, 10, 8), toon('#fff3a3', { emissive: 0.8 }), side * 0.012 * k, 0, 0, 0.016 * k));
    }
  }
  return out;
}

// A five-pointed star, a little thick, facing +z: the badge on a t-shirt.
const starShape = () =>
  geo('star-badge', () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.017 : 0.04;
      if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  });

// A feature sitting on the face, pushed out along the head's surface.
function onFace(fx, fy, out) {
  return onSurface(HR[0], HR[1], HR[2], fx, fy, out);
}

function eyes(head, style = 'dot') {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.12, 0.02, style === 'big' ? -0.01 : 0.005);
    if (style === 'big') {
      // A big round eye: a white, an iris, a pupil and a catchlight, turned to face out.
      const eye = new THREE.Group();
      eye.position.set(p.x, p.y, p.z);
      eye.lookAt(p.clone().multiplyScalar(2));
      eye.add(mesh(sphere(1, 18, 14), toon(WHITE), 0, 0, 0, 0.056, 0.072, 0.024));
      const iris = mesh(sphere(1, 14, 10), toon(EYE), 0, -0.004, 0.01, 0.036, 0.05, 0.016);
      iris.userData.iris = true;
      eye.add(iris);
      const pupil = mesh(sphere(1, 10, 8), toon(BLACK), 0, -0.006, 0.018, 0.02, 0.028, 0.01);
      pupil.userData.iris = true;
      eye.add(pupil);
      eye.add(mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.75 }), -0.013, 0.02, 0.026, 0.011, 0.014, 0.006));
      group.add(eye);
    } else {
      const eye = mesh(sphere(1, 16, 12), toon(BLACK), p.x, p.y, p.z, 0.048, 0.062, 0.03);
      eye.lookAt(p.clone().multiplyScalar(2));
      const shine = mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.6 }), p.x + side * 0.012 - 0.01, p.y + 0.022, p.z + 0.024, 0.016);
      group.add(eye, shine);
    }
  }
  group.userData.blink = true;
  head.add(group);
  return group;
}


function blush(head) {
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.2, -0.08, 0.004);
    const b = mesh(sphere(1, 12, 8), toon('#ff9ab0', { transparent: true, opacity: 0.75 }), p.x, p.y, p.z, 0.055, 0.032, 0.012);
    b.lookAt(p.clone().multiplyScalar(2));
    head.add(b);
  }
}

function smile(head, width = 0.05, y = -0.1) {
  const p = onFace(0, y, -0.004);
  const m = mesh(torus(width, 0.012, Math.PI), toon('#7a3b3b'), p.x, p.y, p.z);
  m.rotation.z = Math.PI;
  // Leaning back with the chin, so it lies on the face rather than poking out.
  m.rotation.x = 0.3;
  head.add(m);
  return m;
}

function muzzle(head, color, noseColor = BLACK, size = 1) {
  const p = onFace(0, -0.07, -0.03);
  const mz = mesh(sphere(1, 16, 12), toon(color), p.x, p.y, p.z, 0.12 * size, 0.085 * size, 0.08 * size);
  head.add(mz);
  const n = mesh(sphere(1, 12, 8), toon(noseColor), p.x, p.y + 0.035 * size, p.z + 0.07 * size, 0.04, 0.03, 0.03);
  head.add(n);
  // Nostrils either side of the nose, and a small mouth under it.
  for (const side of [-1, 1]) {
    head.add(mesh(sphere(1, 8, 6), toon(darken(noseColor, 0.3)), p.x + side * 0.016 * size, p.y + 0.036 * size, p.z + 0.09 * size, 0.008, 0.01, 0.006));
  }
  const mouth = onFace(0, -0.135, 0.004);
  head.add(mesh(capsule(0.006, 0.03), toon('#7a3b3b'), mouth.x, mouth.y, mouth.z + 0.04 * size).rotateZ(Math.PI / 2));
}

// Whiskers springing from the muzzle: three each side, all as one shape.
function whiskers(head) {
  const parts = [];
  for (const side of [-1, 1]) {
    for (const [dy, dz, tilt] of [[0.045, 0.02, 0.15], [0.0, -0.01, 0], [-0.04, 0.02, -0.15]]) {
      const m = new THREE.Matrix4()
        .makeRotationZ(side * (Math.PI / 2 - tilt))
        .setPosition(side * 0.17, -0.07 + dy, dz + 0.1);
      parts.push({ g: capsule(0.0035, 0.13), m });
    }
  }
  head.add(mesh(bakeCached('whiskers', parts), toon('#f5ecf2')));
}

function ears(head, animal, fur) {
  const inner = PINK;
  const topY = HR[1];
  const add = (m) => {
    head.add(m);
    return m;
  };
  switch (animal) {
    case 'bunny':
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.19, topY * 0.8, -0.02);
        g.rotation.z = -side * 0.18;
        g.add(mesh(sphere(), toon(fur), 0, 0.26, 0, 0.065, 0.28, 0.05));
        g.add(mesh(sphere(), toon(inner), 0, 0.26, 0.025, 0.04, 0.22, 0.03));
        g.userData.ear = side;
        add(g);
      }
      break;
    case 'cat':
    case 'fox':
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.18, topY * 0.78, 0);
        g.rotation.z = -side * 0.35;
        g.add(mesh(cone(0.11, animal === 'fox' ? 0.26 : 0.2, 4), toon(fur), 0, 0.08, 0));
        g.add(mesh(cone(0.06, animal === 'fox' ? 0.17 : 0.13, 4), toon(animal === 'fox' ? WHITE : inner), 0, 0.06, 0.035));
        g.userData.ear = side;
        add(g);
      }
      break;
    case 'bear':
    case 'panda':
    case 'koala':
    case 'mouse': {
      const big = animal === 'mouse' ? 0.15 : animal === 'koala' ? 0.14 : 0.1;
      const col = animal === 'panda' ? BLACK : fur;
      for (const side of [-1, 1]) {
        const e = add(mesh(sphere(), toon(col), side * 0.25, topY * 0.72, -0.03, big, big, big * 0.45));
        e.userData.ear = side;
        add(mesh(sphere(), toon(animal === 'koala' ? WHITE : animal === 'panda' ? '#4a4450' : inner), side * 0.25, topY * 0.72, big * 0.2, big * 0.6, big * 0.6, big * 0.2));
      }
      break;
    }
    case 'puppy':
      for (const side of [-1, 1]) {
        const e = add(mesh(sphere(), toon(darken(fur, 0.25)), side * 0.33, 0.02, 0, 0.08, 0.2, 0.06));
        e.rotation.z = side * 0.25;
        e.userData.ear = side;
      }
      break;
    case 'pig':
      for (const side of [-1, 1]) {
        const e = add(mesh(cone(0.08, 0.13, 4), toon(fur), side * 0.2, topY * 0.8, 0.02));
        e.rotation.z = -side * 0.4;
        e.rotation.x = 0.3;
        e.userData.ear = side;
      }
      break;
    case 'alien':
      // Two antennae, each a thin stalk leaning out with a glowing bead on
      // top; they bob as you go (see sway in update).
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.15, topY * 0.84, -0.02);
        g.rotation.z = -side * 0.32;
        g.add(mesh(capsule(0.016, 0.24), toon(darken(fur, 0.12)), 0, 0.13, 0));
        g.add(mesh(sphere(1, 14, 10), toon('#fff07a', { emissive: 0.55 }), 0, 0.28, 0, 0.055));
        g.userData.ear = side;
        g.userData.side = side;
        g.userData.rest = g.rotation.z;
        add(g);
      }
      break;
    default:
      break;
  }
}

// An alien's eyes: big and dark and glossy, slanting up to the sides, with
// a gleam in each.
function alienEyes(head) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.135, 0.01, -0.012);
    const eye = new THREE.Group();
    eye.position.set(p.x, p.y, p.z);
    eye.lookAt(p.clone().multiplyScalar(2));
    const ball = mesh(sphere(1, 20, 14), toon('#1e1a2c'), 0, 0, 0, 0.112, 0.074, 0.032);
    ball.rotation.z = side * 0.42;
    eye.add(ball);
    eye.add(mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.75 }), -0.022, 0.02, 0.026, 0.017, 0.014, 0.006));
    eye.add(mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.6 }), 0.026, -0.016, 0.025, 0.008, 0.007, 0.004));
    group.add(eye);
  }
  group.userData.blink = true;
  head.add(group);
  return group;
}

function face(head, animal, fur) {
  switch (animal) {
    case 'frog': {
      for (const side of [-1, 1]) {
        head.add(mesh(sphere(), toon(fur), side * 0.2, HR[1] * 0.78, 0.1, 0.12));
        head.add(mesh(sphere(), toon(WHITE), side * 0.2, HR[1] * 0.8, 0.17, 0.085));
        head.add(mesh(sphere(), toon(BLACK), side * 0.2, HR[1] * 0.8, 0.245, 0.045, 0.055, 0.02));
      }
      smile(head, 0.12, -0.05);
      blush(head);
      return null;
    }
    case 'pig': {
      const e = eyes(head);
      const p = onFace(0, -0.06, -0.015);
      head.add(mesh(cylinder(0.08, 0.08, 0.06, 16), toon('#ff8fae'), p.x, p.y, p.z, 1, 1, 1).rotateX(Math.PI / 2));
      for (const side of [-1, 1]) head.add(mesh(sphere(), toon('#c05a7a'), p.x + side * 0.028, p.y, p.z + 0.032, 0.014, 0.022, 0.01));
      blush(head);
      return e;
    }
    case 'panda': {
      for (const side of [-1, 1]) {
        const p = onFace(side * 0.12, 0.01, -0.01);
        const patch = mesh(sphere(1, 16, 12), toon(BLACK), p.x, p.y, p.z, 0.083, 0.105, 0.04);
        patch.rotation.z = side * 0.5;
        head.add(patch);
        head.add(mesh(sphere(1, 12, 8), toon(darken(fur, 0.1)), p.x, p.y - 0.01, p.z + 0.02, 0.05, 0.065, 0.028));
      }
      const e = eyes(head, 'big');
      // A panda's eyes are pale in their dark patches.
      e.traverse((o) => {
        if (o.userData.iris) o.material = toon('#e8e4ee');
      });
      muzzle(head, WHITE, BLACK, 0.8);
      return e;
    }
    case 'bear':
      muzzle(head, lighten(fur, 0.45));
      break;
    case 'puppy':
      muzzle(head, lighten(fur, 0.5));
      break;
    case 'fox':
      muzzle(head, WHITE);
      break;
    case 'alien': {
      const e = alienEyes(head);
      smile(head, 0.04, -0.13);
      blush(head);
      return e;
    }
    case 'koala': {
      const p = onFace(0, -0.04, -0.01);
      head.add(mesh(sphere(), toon('#4a4450'), p.x, p.y, p.z, 0.07, 0.09, 0.06));
      break;
    }
    case 'mouse':
    case 'bunny':
    case 'cat': {
      const p = onFace(0, -0.045, 0.004);
      head.add(mesh(sphere(1, 14, 10), toon('#ff7f9f'), p.x, p.y, p.z, 0.03, 0.022, 0.02));
      smile(head, 0.035, -0.1);
      if (animal !== 'bunny') whiskers(head);
      // A cheek ruff either side of the face, where the fur stands out.
      for (const side of [-1, 1]) {
        const c = onFace(side * 0.24, -0.09, -0.025);
        head.add(mesh(sphere(1, 14, 10), toon(fur), c.x, c.y, c.z, 0.075, 0.06, 0.05));
      }
      break;
    }
    default:
      break;
  }
  const e = eyes(head);
  blush(head);
  return e;
}

// An animal's tail, at the seat of its jeans (where), a little smaller than
// its head would make it.
function tail(root, animal, fur, where) {
  const t = new THREE.Group();
  t.position.copy(where);
  t.scale.setScalar(0.72);
  switch (animal) {
    case 'bunny':
    case 'bear':
    case 'panda':
      t.add(mesh(sphere(1, 16, 12), toon(animal === 'bunny' ? WHITE : animal === 'panda' ? BLACK : fur), 0, 0, -0.02, 0.08));
      break;
    case 'cat': {
      // A long tail that tapers in three steps, with a dark tip.
      const seg = [
        [0.045, 0.16, fur],
        [0.034, 0.14, fur],
        [0.024, 0.12, darken(fur, 0.35)],
      ];
      let y = 0.02;
      for (const [r, len, col] of seg) {
        const m = mesh(capsule(r, len * 0.8), toon(col), 0, y + len / 2 - 0.04, -0.02 - y * 0.35);
        m.rotation.x = -0.55;
        t.add(m);
        y += len * 0.75;
      }
      break;
    }
    case 'fox': {
      // A big brush of a tail in overlapping steps of fur, white at the tip.
      const brush = [
        [0.085, 0, fur],
        [0.08, 0.12, fur],
        [0.07, 0.24, fur],
        [0.055, 0.34, WHITE],
      ];
      for (const [r, along, col] of brush) {
        t.add(mesh(sphere(1, 16, 12), toon(col), 0, 0.02 + along * 0.85, -0.04 - along * 0.35, r, r * 0.9, r));
      }
      break;
    }
    case 'mouse': {
      // A thin tail with a little bead at the end.
      const m = mesh(capsule(0.022, 0.3), toon(PINK), 0, 0.15, -0.1);
      m.rotation.x = -0.7;
      t.add(m, mesh(sphere(1, 10, 8), toon(PINK), 0, 0.31, -0.2, 0.026));
      break;
    }
    case 'puppy': {
      const m = mesh(capsule(0.04, 0.14), toon(fur), 0, 0.08, -0.04);
      m.rotation.x = -0.9;
      t.add(m, mesh(sphere(1, 12, 8), toon(lighten(fur, 0.3)), 0, 0.04, -0.16, 0.042));
      break;
    }
    case 'pig':
      t.add(mesh(torus(0.04, 0.015), toon(fur), 0, 0.02, -0.02));
      t.add(mesh(torus(0.024, 0.009), toon(darken(fur, 0.12)), 0, 0.024, -0.021));
      break;
    default:
      return null;
  }
  root.add(t);
  return t;
}

// ------------------------------------------------ people

// A kid's face and a grown-up's: how long the jaw is under the eyes (jaw), how
// far the chin comes forward (chin) and the jaw narrows (narrow), and where
// things are on it: the brow ridge (brow, up the head), the eyes (eyeY up,
// apart out, eyeR their size, open how far the upper lid is up), the nose
// (its tip's size and height), the mouth (its height and width) and how
// thick the eyebrows are. A kid's eyes are bigger and lower in a rounder face.
const FACE_SHAPES = {
  kid: { key: 'kid', jaw: 1, chin: 0.65, narrow: 0.24, brow: 0.1, eyeY: -0.045, apart: 0.106, eyeR: 0.063, open: 0.5, nose: 0.026, noseTip: -0.15, mouth: -0.232, mouthW: 0.85, browT: 0.011 },
  grown: { key: 'grown', jaw: 1.12, chin: 0.85, narrow: 0.3, brow: 0.14, eyeY: -0.03, apart: 0.102, eyeR: 0.056, open: 0.42, nose: 0.03, noseTip: -0.168, mouth: -0.262, mouthW: 1, browT: 0.013 },
};
// Where the eyes are round the head (see headPoint), for the sockets they sit in.
for (const f of Object.values(FACE_SHAPES)) {
  f.eyeV = f.eyeY / (PR[1] * f.jaw);
  f.eyeU = f.apart / (PR[0] * (1 - f.narrow * Math.abs(f.eyeV) ** 1.6));
}

const smoothstep = (w) => w * w * (3 - 2 * w);

// A person's head, shaped like a real one: PERSON's ellipsoid over the eyes,
// and below them a jaw that narrows and comes forward to a chin, the back of
// the head drawn in to the neck; a ridge for the brow, and the eyes set in
// under it. (u, v, w) is a point on a ball of radius 1, v up and w to the
// face; out gets where it goes. Only z is moved for the sculpting, so faceAt
// can find a point of the face from x and y.
function headPoint(f, u, v, w, out) {
  const low = Math.max(0, -v);
  const x = PR[0] * u * (1 - f.narrow * low ** 1.6);
  const y = PR[1] * v * (v < 0 ? f.jaw : 1);
  let z = PR[2] * w;
  if (w > 0) {
    const brow = Math.exp(-(((v - f.brow) / 0.08) ** 2) - (u / 0.55) ** 4);
    const socket = Math.exp(-(((Math.abs(u) - f.eyeU) / 0.17) ** 2) - ((v - f.eyeV) / 0.1) ** 2);
    z += PR[2] * smoothstep(w) * (f.chin * low ** 3 * (1 - u * u) + 0.03 * brow - 0.035 * socket);
  } else z *= 1 - 0.3 * low ** 1.4;
  return out.set(x, y, z);
}

// A point on a shape made round a ball (shape(u, v, w, out) puts the point
// for the direction d there), and which way is out there, worked out from the
// shape itself: no seams where the ball's own would be.
function surfaceAt(shape, d) {
  const p = shape(d.x, d.y, d.z, new THREE.Vector3());
  const t1 = new THREE.Vector3().crossVectors(Math.abs(d.y) > 0.99 ? X_AXIS : UP, d).normalize();
  const t2 = new THREE.Vector3().crossVectors(d, t1);
  const a = t1.multiplyScalar(1e-3).add(d).normalize();
  const b = t2.multiplyScalar(1e-3).add(d).normalize();
  const pa = shape(a.x, a.y, a.z, new THREE.Vector3()).sub(p);
  const pb = shape(b.x, b.y, b.z, new THREE.Vector3()).sub(p);
  return { p, n: pa.cross(pb).normalize() };
}

const personHead = (f) =>
  geo(`person-head|${f.key}`, () => {
    const g = new THREE.SphereGeometry(1, 56, 36);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const d = new THREE.Vector3();
    const shape = (u, v, w, out) => headPoint(f, u, v, w, out);
    for (let i = 0; i < pos.count; i++) {
      const { p, n } = surfaceAt(shape, d.fromBufferAttribute(pos, i).normalize());
      pos.setXYZ(i, p.x, p.y, p.z);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  });

// The point of a person's face at (fx, fy) — across, and up from the middle
// of the head — pushed `out` along the way out there, and that way.
function faceAt(f, fx, fy, out = 0) {
  const v = Math.max(-0.995, Math.min(0.995, fy / (PR[1] * (fy < 0 ? f.jaw : 1))));
  const low = Math.max(0, -v);
  const u = fx / (PR[0] * (1 - f.narrow * low ** 1.6));
  const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  const { p, n } = surfaceAt((a, b, c, o) => headPoint(f, a, b, c, o), new THREE.Vector3(u, v, w).normalize());
  return { p: p.addScaledVector(n, out), n };
}

// The eyes: each an eyeball set in under the brow, turned out a little from
// straight ahead (q), its middle at c; the upper lids turn about the line
// through both middles (axis) to blink.
function eyeLayout(f) {
  const r = f.eyeR;
  const eyes = [-1, 1].map((side) => {
    const { p, n } = faceAt(f, side * f.apart, f.eyeY);
    const c = p.addScaledVector(n, 0.014 - r);
    const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, new THREE.Vector3(side * 0.1, 0, 1).normalize());
    return { side, c, q };
  });
  return { r, eyes, axis: new THREE.Vector3(0, eyes[0].c.y, eyes[0].c.z) };
}
const inEye = (e, x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(e.q).add(e.c);

// The lids, as caps over the eyeball: the upper one's pole tilted back (so
// its edge arches over the eye) and its edge `open` above the eye's middle in
// front, the lower one's edge `low` below it. Turning the upper lid down by
// open + low (and a little) shuts the eye.
const LID = { tilt: 0.45, low: 0.47, lowTilt: 0.3 };
const upperLid = (r, open) => geo(`lid-up|${r}|${open}`, () => new THREE.SphereGeometry(r * 1.07, 20, 8, 0, Math.PI, 0, Math.PI / 2 + LID.tilt - open).rotateX(-LID.tilt));
const lowerLid = (r) =>
  geo(`lid-low|${r}`, () => {
    const cap = Math.PI / 2 + LID.lowTilt - LID.low;
    return new THREE.SphereGeometry(r * 1.05, 20, 6, 0, Math.PI, Math.PI - cap, cap).rotateX(LID.lowTilt);
  });
// The lashes along the upper lid's edge, across the front of the eye.
const lashLine = (r, open) =>
  geo(`lash|${r}|${open}`, () => {
    const R = r * 1.07;
    const cap = Math.PI / 2 + LID.tilt - open;
    const arc = 2.3;
    return new THREE.TorusGeometry(R * Math.sin(cap), 0.0075, 5, 20, arc)
      .rotateZ(Math.PI / 2 - arc / 2)
      .rotateX(Math.PI / 2)
      .translate(0, R * Math.cos(cap), 0)
      .rotateX(-LID.tilt);
  });

// The nose: a bridge from between the eyes out to a rounded tip, with a wing
// either side of it (in skin, with the head); and the nostrils under it.
function noseParts(f) {
  const s = f.nose;
  const tip = faceAt(f, 0, f.noseTip);
  const tipP = tip.p.clone().addScaledVector(tip.n, s * 1.05);
  const top = faceAt(f, 0, f.eyeY + 0.01, 0.004).p;
  const along = top.clone().sub(tipP);
  const bridge = new THREE.Matrix4().compose(
    top.clone().add(tipP).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, along.clone().normalize()),
    new THREE.Vector3(s * 0.78, along.length() * 0.56, s * 0.85),
  );
  const parts = [
    { g: sphere(1, 14, 12), m: bridge },
    { g: sphere(1, 14, 12), m: placed(tipP, facing(tip.n), s) },
  ];
  for (const side of [-1, 1]) {
    const wing = faceAt(f, side * s * 1.18, f.noseTip - s * 0.45, s * 0.5);
    parts.push({ g: sphere(1, 12, 10), m: placed(wing.p, facing(wing.n), s * 0.74, s * 0.62, s * 0.72) });
  }
  return parts;
}
function nostrilParts(f) {
  const s = f.nose;
  return [-1, 1].map((side) => {
    const { p, n } = faceAt(f, side * s * 0.62, f.noseTip - s * 0.92, s * 0.98);
    return { g: sphere(1, 10, 8), m: placed(p, facing(n), s * 0.38, s * 0.2, s * 0.32, 0.5, 0, -side * 0.3) };
  });
}

// The ears, at the sides, as high as from the brow to the bottom of the
// nose, leaning back a little and turned out: the outer ear in skin, and the
// hollow inside it a little darker.
function earParts(inner) {
  return [-1, 1].map((side) => {
    const p = new THREE.Vector3(side * (PR[0] * 0.96 + (inner ? 0.013 : 0)), -0.085, -0.045);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, -side * 0.28, side * 0.05));
    return inner ? { g: sphere(1, 12, 10), m: placed(p, q, 0.012, 0.064, 0.044) } : { g: sphere(1, 16, 12), m: placed(p, q, 0.028, 0.094, 0.068) };
  });
}

// Everything of a face in skin, as one shape: the head, the nose, the lower
// lids, and the ears unless hair covers them.
const personSkin = (f, ears) =>
  geo(`person-skin|${f.key}|${ears}`, () => {
    const eye = eyeLayout(f);
    return bake([
      { g: personHead(f), m: new THREE.Matrix4() },
      ...noseParts(f),
      ...eye.eyes.map((e) => ({ g: lowerLid(eye.r), m: placed(e.c, e.q) })),
      ...(ears ? earParts(false) : []),
    ]);
  });

// Eyebrows: an arch over each eye, flat on the brow, the outer end a little higher.
const browShape = (f) =>
  geo(`brows|${f.key}`, () =>
    bake(
      [-1, 1].map((side) => {
        const { p, n } = faceAt(f, side * f.apart * 1.04, f.eyeY + (f.key === 'kid' ? 0.078 : 0.072), 0.006);
        const R = 0.11;
        const arc = 0.85;
        const m = placed(p, facing(n), 1, 1, 1, 0, 0, side * 0.12)
          .multiply(new THREE.Matrix4().makeTranslation(0, -R, 0))
          .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2 - arc / 2))
          .multiply(new THREE.Matrix4().makeScale(1, 1, 0.55));
        return { g: torus(R, f.browT, arc), m };
      }),
    ),
  );

// Lips: an upper lip in two curves meeting in a bow, and a fuller lower lip.
const lipShape = (f) =>
  geo(`lips|${f.key}`, () => {
    const s = f.mouthW;
    const parts = [-1, 1].map((side) => {
      const { p, n } = faceAt(f, side * 0.021 * s, f.mouth + 0.011, 0.003);
      return { g: sphere(1, 14, 10), m: placed(p, facing(n), 0.032 * s, 0.0105, 0.015, 0, 0, -side * 0.18) };
    });
    const { p, n } = faceAt(f, 0, f.mouth - 0.016, 0.004);
    parts.push({ g: sphere(1, 16, 10), m: placed(p, facing(n), 0.04 * s, 0.0155, 0.017) });
    return bake(parts);
  });
// ...and the line between them, turning up a little at the corners: a smile.
const mouthLine = (f) =>
  geo(`mouth|${f.key}`, () => {
    const { p, n } = faceAt(f, 0, f.mouth, 0.006);
    const R = 0.11;
    const arc = 0.85 * f.mouthW;
    const m = placed(p, facing(n))
      .multiply(new THREE.Matrix4().makeTranslation(0, R, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2 - arc / 2));
    return bake([{ g: torus(R, 0.0055, arc), m }]);
  });

// A kid's rosy cheeks.
const cheekShape = (f) =>
  geo(`cheeks|${f.key}`, () =>
    bake(
      [-1, 1].map((side) => {
        const { p, n } = faceAt(f, side * 0.155, -0.12, 0.004);
        return { g: sphere(1, 12, 8), m: placed(p, facing(n), 0.055, 0.03, 0.01) };
      }),
    ),
  );

// Lips a little rosier and darker than the skin.
const lipColor = (skin) => mix(darken(skin, 0.12), '#c4505c', 0.3);

// A person's face on a skull, a kid's or a grown-up's (grown: what they have
// on it, see FACES in shared/words.js; ears: false where hair covers them).
// Returns the upper lids, which turn down by LID_SHUT to blink.
function personFace(skull, f, skin, { ears = true, extra = 'none', hairColor = BLACK } = {}) {
  const eye = eyeLayout(f);
  const add = (g, mat) => skull.add(mesh(g, mat));
  add(personSkin(f, ears), toon(skin));
  if (ears) add(geo('ear-hollows', () => bake(earParts(true))), toon(darken(skin, 0.16)));
  add(geo(`nostrils|${f.key}`, () => bake(nostrilParts(f))), toon(darken(skin, 0.45)));
  // The eyes: whites, a brown iris, a pupil and a catchlight.
  const r = eye.r;
  const iris = f.key === 'kid' ? 0.54 : 0.5;
  const eyePart = (name, g, x, y, z, sx, sy, sz) =>
    add(
      geo(`eye-${name}|${f.key}`, () => bake(eye.eyes.map((e) => ({ g, m: placed(inEye(e, x, y, z), e.q, sx, sy, sz) })))),
      toon(...{ white: ['#fbf8f3'], iris: ['#6b4430'], pupil: ['#1c1416'], shine: [WHITE, { emissive: 0.7 }] }[name]),
    );
  eyePart('white', sphere(1, 20, 14), 0, 0, 0, r, r, r);
  eyePart('iris', sphere(1, 16, 12), 0, -0.03 * r, 0.9 * r, iris * r, iris * r, 0.12 * r);
  eyePart('pupil', sphere(1, 12, 8), 0, -0.03 * r, 0.975 * r, 0.23 * r, 0.23 * r, 0.08 * r);
  eyePart('shine', sphere(1, 8, 6), -0.2 * r, 0.17 * r, 1.01 * r, 0.07 * r, 0.07 * r, 0.035 * r);
  // The upper lids and their lashes, which close together.
  const lids = new THREE.Group();
  lids.position.copy(eye.axis);
  const off = new THREE.Matrix4().makeTranslation(-eye.axis.x, -eye.axis.y, -eye.axis.z);
  const onLid = (g) => eye.eyes.map((e) => ({ g, m: off.clone().multiply(placed(e.c, e.q)) }));
  lids.add(mesh(geo(`lids|${f.key}`, () => bake(onLid(upperLid(r, f.open)))), toon(skin)));
  lids.add(mesh(geo(`lashes|${f.key}`, () => bake(onLid(lashLine(r, f.open)))), toon('#2a1f22')));
  lids.userData.shut = f.open + LID.low + 0.05;
  skull.add(lids);
  add(browShape(f), toon(darken(hairColor, 0.22)));
  const lips = lipColor(skin);
  add(lipShape(f), toon(lips));
  add(mouthLine(f), toon(darken(lips, 0.45)));
  if (f.key === 'kid') add(cheekShape(f), toon('#ff8fa8', { transparent: true, opacity: 0.22 }));
  if (extra.includes('glasses')) glasses(skull, eye);
  if (extra.includes('beard')) beard(skull, f, hairColor);
  if (extra === 'moustache' || extra.includes('beard')) moustache(skull, f, hairColor);
  return lids;
}

// Round glasses in front of the eyes, with a bridge over the nose and arms
// back to the ears: the frame, and the lenses in it.
function glasses(skull, eye) {
  const ring = eye.r * 1.32;
  const frame = [];
  const lenses = [];
  const rim = (e, x) => inEye(e, x, -0.01, eye.r + 0.026);
  for (const e of eye.eyes) {
    frame.push({ g: torus(ring, 0.0085), m: placed(rim(e, 0), e.q) });
    lenses.push({ g: cylinder(ring, ring, 0.004, 24), m: placed(rim(e, 0), e.q, 1, 1, 1, Math.PI / 2) });
    frame.push({ g: cylinder(1, 1, 1, 6), m: between(rim(e, e.side * ring), new THREE.Vector3(e.side * PR[0] * 1.02, -0.04, -0.06), 0.0085) });
  }
  const [a, b] = eye.eyes.map((e) => rim(e, -e.side * ring));
  frame.push({ g: cylinder(1, 1, 1, 6), m: between(a, b.clone().add(new THREE.Vector3(0, 0.004, 0)), 0.0085) });
  skull.add(mesh(bake(frame), toon('#3a3340')), mesh(bake(lenses), toon('#d8f0ff', { transparent: true, opacity: 0.28 })));
}

// A moustache under the nose, curling up a little at each end.
function moustache(skull, f, color) {
  const parts = [-1, 1].flatMap((side) => {
    const a = faceAt(f, side * 0.032, f.noseTip - 0.052, 0.012);
    const b = faceAt(f, side * 0.074, f.noseTip - 0.066, 0.008);
    return [
      { g: sphere(1, 14, 10), m: placed(a.p, facing(a.n), 0.043, 0.017, 0.022, 0, 0, side * 0.28) },
      { g: sphere(1, 12, 8), m: placed(b.p, facing(b.n), 0.022, 0.013, 0.017, 0, 0, side * 0.7) },
    ];
  });
  skull.add(mesh(geo(`moustache|${f.key}`, () => bake(parts)), toon(color)));
}

// A beard over the jaw from ear to ear: a shell on the face, from under the
// lower lip and up the cheeks to sideburns in front of the ears, thinning
// out at its edges; and a fuller chin.
function beard(skull, f, color) {
  const cover = geo(`beard|${f.key}`, () => {
    const cols = 44;
    const rows = 16;
    const shape = (u, v, w, out) => headPoint(f, u, v, w, out);
    // Where it starts, round the face from the front (a 0): under the lip,
    // round the mouth, up the cheeks, and highest at the sideburns.
    const top = (a) => {
      const s = Math.abs(a);
      if (s < 0.28) return -0.8;
      if (s < 0.75) return -0.8 + ((s - 0.28) / 0.47) * 0.48;
      if (s < 1.3) return -0.32 + ((s - 0.75) / 0.55) * 0.3;
      return -0.02;
    };
    const positions = [];
    const index = [];
    for (let i = 0; i <= cols; i++) {
      const a = -1.5 + (i / cols) * 3;
      const from = top(a);
      for (let j = 0; j <= rows; j++) {
        const v = from + (j / rows) * (-0.995 - from);
        const ring = Math.sqrt(1 - v * v);
        const { p, n } = surfaceAt(shape, new THREE.Vector3(Math.sin(a) * ring, v, Math.cos(a) * ring));
        const edge = Math.min(1, j / 3, Math.min(i, cols - i) / 4);
        p.addScaledVector(n, 0.004 + 0.03 * edge);
        positions.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const p = i * (rows + 1) + j;
        const q = p + rows + 1;
        index.push(p, p + 1, q, q, p + 1, q + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  });
  skull.add(mesh(cover, toon(color)));
  const { p, n } = faceAt(f, 0, -PR[1] * f.jaw * 0.88, 0.03);
  skull.add(mesh(geo(`beard-chin|${f.key}`, () => bake([{ g: sphere(1, 16, 12), m: placed(p, facing(n), 0.1, 0.07, 0.06) }])), toon(color)));
}

// Hats that sit over the top of the head, where a bun or spikes would poke through.
const CROWN_HATS = ['cap', 'beanie', 'straw', 'party'];
const TIE = '#ff6f9f';

// A piece of a shell round a head, k times HEAD_R, to be scaled to the
// head's shape. Around the head, phi 0 is the left side, π/2 the face, π the
// right side and 3π/2 the back; theta goes down from the top. tilt leans it
// back, to reach lower behind than in front.
function shell(k, { phi = 0, phiLength = Math.PI * 2, theta = 0, thetaLength = Math.PI, tilt = 0 } = {}) {
  return geo(`shell${k}|${phi}|${phiLength}|${theta}|${thetaLength}|${tilt}`, () => new THREE.SphereGeometry(HEAD_R * k, 28, 16, phi, phiLength, theta, thetaLength).rotateX(-tilt));
}

// A point on a person's head, k times its size, `up` from the top and `turn`
// round from the face (to its left), and which way is out there.
function onHead(up, turn, k = 1) {
  const p = new THREE.Vector3(Math.sin(up) * Math.sin(turn) * PR[0] * k, Math.cos(up) * PR[1] * k, Math.sin(up) * Math.cos(turn) * PR[2] * k);
  const out = new THREE.Vector3(p.x / PR[0] ** 2, p.y / PR[1] ** 2, p.z / PR[2] ** 2).normalize();
  return { p, out };
}

// A point on the front of a person's head, above the eyes (where the
// sculpting of headPoint leaves it as it is), pushed out.
function onBrow(fx, fy, out) {
  return onSurface(PR[0], PR[1], PR[2], fx, fy, out);
}

// Where hair stops going down the head, `turn` round from the face: over
// the forehead at the front, down in front of the ears, up over them, and
// down again behind them to the nape.
const capLine = (turn) => {
  const a = Math.abs(turn);
  const ramp = (a0, a1, v0, v1) => v0 + ((a - a0) / (a1 - a0)) * (v1 - v0);
  if (a < 0.9) return 0.95;
  if (a < 1.32) return ramp(0.9, 1.32, 0.95, 1.7);
  if (a < 1.48) return ramp(1.32, 1.48, 1.7, 1.42);
  if (a < 1.95) return 1.42;
  if (a < 2.35) return ramp(1.95, 2.35, 1.42, 2.08);
  return ramp(2.35, Math.PI, 2.08, 2.3);
};
const bobLine = (turn) => (Math.abs(turn) < 1.12 ? 0.95 : 2.12);
const longLine = (turn) => (Math.abs(turn) < 1.12 ? 0.95 : 2.3);

// Hair combed down from the crown, as one sculpted shell: ridges run from
// the top of the head down to a hairline that dips into a soft point at the
// end of each lock, and the edge rolls under so the hair has thickness.
// line(turn) is how far down it reaches, `turn` round from the face.
function combed(key, line, k = 1.06, ridges = 22) {
  return geo(`combed|${key}|${k}`, () => {
    const cols = ridges * 4;
    const rows = 22;
    const positions = [];
    const index = [];
    for (let i = 0; i <= cols; i++) {
      const turn = (i / cols) * Math.PI * 2 - Math.PI;
      const wave = Math.cos(turn * ridges);
      const reach = line(turn) + 0.07 * wave;
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        const up = v * reach;
        // Ridges grow from nothing at the crown; the last stretch rolls under.
        const ridge = 0.03 * (0.5 + 0.5 * wave) * Math.min(1, up / 0.5);
        const roll = v > 0.9 ? ((v - 0.9) / 0.1) ** 2 * 0.05 : 0;
        const r = k * (1 + ridge - roll);
        positions.push(Math.sin(up) * Math.sin(turn) * PR[0] * r, Math.cos(up) * PR[1] * r, Math.sin(up) * Math.cos(turn) * PR[2] * r);
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j;
        const b = a + rows + 1;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  });
}

// Long hair hanging down the back, past the shoulders to the shoulder
// blades: a curtain in the same ridged locks as the top, each ending in a
// soft point, its edges rolled in. At the top it goes round the back of the
// head; lower down it lies flatter, behind the shoulders, over the back.
const hairFall = (length) =>
  geo(`hair-fall|${length}`, () => {
    const cols = 48;
    const rows = 20;
    const spread = 1.15;
    const positions = [];
    const index = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const a = Math.PI - spread + u * spread * 2;
      const wave = Math.cos((a - Math.PI) * 11);
      const bottom = -length - 0.05 * wave;
      const edge = Math.min(u, 1 - u);
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        const y = -0.16 + (bottom + 0.16) * v;
        const roll = (v > 0.88 ? ((v - 0.88) / 0.12) ** 2 * 0.03 : 0) + (edge < 0.08 ? ((0.08 - edge) / 0.08) ** 2 * 0.03 : 0);
        const r = 0.325 + 0.012 * (0.5 + 0.5 * wave) * Math.min(1, v * 3) - roll;
        // Round the head at the top, flatter over the back lower down.
        const flat = smoothstep(Math.min(1, Math.max(0, (-0.16 - y) / 0.32)));
        const back = -0.27 - 0.06 * Math.cos(((a - Math.PI) / spread) * (Math.PI / 2)) - 0.01 * (0.5 + 0.5 * wave);
        positions.push(Math.sin(a) * r * (1 - 0.08 * flat), y, Math.cos(a) * r * (1 - flat) + (back + roll) * flat);
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j;
        const b = a + rows + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  });

// A person's hair (fall: how far long hair hangs down the back). Returns the
// bunches and tails that swing as you move.
function hair(head, style, color, hatKind, fall = 1) {
  const g = new THREE.Group();
  const shellMat = toon(color, { side: THREE.DoubleSide });
  const mat = toon(color);
  const covered = CROWN_HATS.includes(hatKind);
  const sway = [];
  const add = (m) => {
    g.add(m);
    return m;
  };
  const cover = (k, opts) => add(mesh(shell(k, opts), shellMat, 0, 0, 0, PERSON.sx, PERSON.sy, PERSON.sz));
  // The top and the back, clear of the forehead, combed into locks.
  const cap = () => {
    add(mesh(combed('cap', capLine), shellMat));
  };
  // A lock of hair lying flat over the forehead, rolled round in place.
  const lock = (fx, fy, sx, sy, roll = 0) => {
    const p = onBrow(fx, fy, 0.014);
    const m = mesh(sphere(1, 14, 10), mat, p.x, p.y, p.z, sx, sy, 0.045);
    m.lookAt(p.clone().multiplyScalar(2));
    m.rotateZ(roll);
    return add(m);
  };
  const swept = () => {
    lock(-0.15, 0.18, 0.1, 0.07, 0.55);
    lock(-0.04, 0.16, 0.105, 0.075, 0.35);
    lock(0.085, 0.17, 0.095, 0.065, 0.15);
  };
  // A bunch of hair hanging from a tie, which swings: side 0 behind, -1 or 1
  // beside. len: how long it hangs, thick: how thick it is.
  const bunch = (x, y, z, side, len, thick = 1) => {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.add(mesh(geo(`bunch-tie|${thick}`, () => bake([{ g: sphere(1, 12, 8), m: at(0, 0, 0, 0.045 * thick) }, { g: torus(0.05 * thick, 0.012), m: at(0, -0.045 * thick, 0, 1, 1, 1, Math.PI / 2) }])), toon(TIE)));
    b.add(
      mesh(
        geo(`bunch|${len}|${thick}`, () =>
          bake([
            { g: sphere(1, 16, 12), m: at(0, -0.15 * len, 0, 0.085 * thick, 0.17 * len, 0.08 * thick) },
            { g: sphere(1, 14, 10), m: at(0, -0.28 * len, 0, 0.062 * thick, 0.11 * len, 0.06 * thick) },
            { g: sphere(1, 12, 8), m: at(0, -0.38 * len, 0, 0.038 * thick, 0.06 * len, 0.038 * thick) },
          ]),
        ),
        mat,
      ),
    );
    b.userData = { side, rest: side ? side * 0.3 : 0.4 };
    if (side) b.rotation.z = b.userData.rest;
    else b.rotation.x = b.userData.rest;
    sway.push(b);
    return add(b);
  };
  switch (style) {
    case 'spiky': {
      cap();
      swept();
      // Spikes of two sizes, every one turned a little differently, as one shape.
      if (!covered) {
        const spikes = [];
        for (const [up, turn, len, tilt] of [
          [0.2, 0, 0.17, 0], [0.5, 0.45, 0.14, 0.3], [0.5, -0.45, 0.14, -0.3],
          [0.62, 1.05, 0.13, 0.2], [0.62, -1.05, 0.13, -0.2], [0.75, 1.7, 0.12, 0.1],
          [0.75, -1.7, 0.12, -0.1], [0.8, 2.5, 0.13, 0.15], [0.8, -2.5, 0.13, -0.15],
          [0.86, Math.PI, 0.14, 0.05], [0.35, 2.9, 0.11, 0.2], [0.35, -2.9, 0.11, -0.2],
        ]) {
          const { p, out } = onHead(up, turn, 1.04);
          const q = new THREE.Quaternion().setFromUnitVectors(UP, out).multiply(new THREE.Quaternion().setFromAxisAngle(UP, tilt));
          spikes.push({ g: cone(0.072, len, 10), m: new THREE.Matrix4().compose(p.addScaledVector(out, len / 2 - 0.02), q, new THREE.Vector3(1, 1, 1)) });
        }
        add(mesh(bakeCached('spikes', spikes), mat));
      }
      break;
    }
    case 'curly': {
      cover(1.05, { thetaLength: 1.75, tilt: 0.62 });
      // Curls all over, round the face: spread evenly, then kept to where hair grows.
      const pole = new THREE.Vector3(0, Math.cos(0.68), -Math.sin(0.68));
      const curls = [];
      const n = 70;
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.39996;
        const d = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
        if (d.dot(pole) < -0.02) continue;
        const size = 0.08 + (i % 3) * 0.008;
        curls.push({ g: sphere(1, 12, 9), m: new THREE.Matrix4().makeScale(size, size, size).setPosition(d.x * PR[0] * 1.1, d.y * PR[1] * 1.1, d.z * PR[2] * 1.1) });
      }
      add(mesh(bakeCached('curls', curls), mat));
      break;
    }
    case 'bob':
    case 'long': {
      // Down the sides and the back, round the face, to the jaw.
      add(mesh(combed(style, style === 'bob' ? bobLine : longLine, 1.08), shellMat));
      for (const fx of [-0.17, -0.057, 0.057, 0.17]) lock(fx, 0.165, 0.075, 0.072);
      // On down the back, past the shoulders, with rounded edges.
      if (style === 'long') add(mesh(hairFall(fall), shellMat));
      break;
    }
    case 'ponytail':
      cap();
      swept();
      bunch(0, 0.17, -(PR[2] + 0.012), 0, 2, 0.95);
      break;
    case 'pigtails':
      cap();
      for (const fx of [-0.14, 0, 0.14]) lock(fx, 0.165, 0.08, 0.07);
      for (const side of [-1, 1]) bunch(side * (PR[0] + 0.035), 0.05, -0.07, side, 1.45, 0.95);
      break;
    case 'bun':
      cap();
      swept();
      if (!covered) {
        add(mesh(sphere(1, 16, 12), mat, 0, 0.35, -0.13, 0.14, 0.13, 0.14));
        add(mesh(torus(0.1, 0.02), toon(TIE), 0, 0.29, -0.11).rotateX(Math.PI / 2 + 0.4));
        add(mesh(torus(0.105, 0.02), toon(TIE), 0, 0.34, -0.11).rotateX(Math.PI / 2 + 0.1));
        // A few loose strands escaping the bun.
        for (const [dx, dy, dz, len, roll] of [[-0.08, 0.29, -0.06, 0.09, 0.5], [0.07, 0.27, -0.05, 0.08, -0.4], [0, 0.41, -0.09, 0.07, 0.2]]) {
          add(mesh(capsule(0.012, len), mat, dx, dy, dz).rotateZ(roll));
        }
      }
      break;
    default: {
      cap();
      // A fuller fringe than the swept locks, all as one shape.
      const fringe = [];
      for (const [fx, fy, sx, sy, roll] of [[-0.19, 0.165, 0.08, 0.06, 0.55], [-0.09, 0.15, 0.095, 0.07, 0.3], [0.01, 0.145, 0.095, 0.07, 0.1], [0.11, 0.155, 0.085, 0.065, -0.15], [0.2, 0.175, 0.07, 0.055, -0.45], [-0.24, 0.19, 0.055, 0.045, 0.7]]) {
        const p = onBrow(fx, fy, 0.014);
        const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, p.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, roll));
        fringe.push({ g: sphere(1, 14, 10), m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, 0.045)) });
      }
      add(mesh(bakeCached('fringe|short', fringe), mat));
      break;
    }
  }
  head.add(g);
  return sway;
}

// A toy weapon from the shop (shared/shop.js), held in the hand: its grip
// at the hand, pointing forward with the arm down. Soft foam and bubbles,
// in bright toy colours.
export function weapon(kind) {
  const g = new THREE.Group();
  g.name = `weapon ${kind}`;
  g.rotation.x = Math.PI / 2;
  switch (kind) {
    case 'sword':
      g.add(
        mesh(cylinder(0.028, 0.028, 0.14, 10), toon('#ffcf3f'), 0, 0.02, 0),
        mesh(sphere(), toon('#ff7fb2'), 0, -0.06, 0, 0.04),
        mesh(capsule(0.03, 0.04), toon('#ff7fb2'), 0, 0.1, 0, 3.2, 0.5, 1.2),
        mesh(capsule(0.042, 0.42), toon('#5fb8f4'), 0, 0.36, 0, 1, 1, 0.55),
      );
      break;
    case 'blaster':
      g.add(
        mesh(cylinder(0.03, 0.03, 0.14, 10), toon('#9b7bea'), 0, -0.02, -0.06),
        mesh(capsule(0.065, 0.2), toon('#9b7bea'), 0, 0.12, 0),
        mesh(sphere(), toon('#bff3ff', { transparent: true, opacity: 0.75 }), 0, 0.1, 0.09, 0.07),
        mesh(cylinder(0.05, 0.035, 0.08, 14), toon('#ffcf3f'), 0, 0.28, 0),
        mesh(torus(0.045, 0.012), toon('#ff7fb2'), 0, 0.33, 0),
      );
      break;
    case 'hammer': {
      g.add(mesh(cylinder(0.026, 0.026, 0.42, 10), toon('#ffcf3f'), 0, 0.16, 0));
      const head = new THREE.Group();
      head.position.y = 0.4;
      head.rotation.z = Math.PI / 2;
      head.add(
        mesh(cylinder(0.1, 0.1, 0.28, 18), toon('#ff7fb2'), 0, 0, 0),
        mesh(cylinder(0.11, 0.11, 0.03, 18), toon('#ffffff'), 0, 0.14, 0),
        mesh(cylinder(0.11, 0.11, 0.03, 18), toon('#ffffff'), 0, -0.14, 0),
      );
      // A star on the side, like a sticker.
      const star = mesh(cylinder(0.07, 0.07, 0.02, 5), toon('#ffd23f', { emissive: 0.25 }), 0, 0, 0.1);
      star.rotation.x = Math.PI / 2;
      head.add(star);
      g.add(head);
      break;
    }
    case 'lavablade': {
      // A chunky toy cleaver of glowing lava: a warm handle, a guard of
      // dark rock, and a blade that shines bright orange like it just came
      // out of the crater, with a drip at its tip.
      g.add(
        mesh(cylinder(0.03, 0.03, 0.15, 10), toon('#5a4636'), 0, 0.02, 0),
        mesh(sphere(), toon('#ffd97a'), 0, -0.055, 0, 0.032),
        mesh(capsule(0.05, 0.05), toon('#4a4652'), 0, 0.105, 0, 1, 0.55, 1.3),
        mesh(capsule(0.052, 0.46), toon('#ff8c2e', { emissive: 0.45 }), 0, 0.4, 0, 1, 1, 0.42),
        mesh(capsule(0.03, 0.3), toon('#ffd23f', { emissive: 0.6 }), 0, 0.5, 0.018, 1, 1, 0.2),
        mesh(sphere(), toon('#ffd97a', { emissive: 0.7 }), 0, 0.65, 0, 0.026),
      );
      break;
    }
    default:
      return null;
  }
  return g;
}

// A hat on a head: an animal's, or a person's (person), fitted to its shape.
// lift: how much higher it sits than on the bare head (on a person's hair).
function hat(head, kind, shirt, lift = 0, person = false) {
  const top = (person ? PR : HR)[1];
  const g = new THREE.Group();
  g.position.set(0, top * 0.72 + lift, 0);
  if (person) g.scale.set(PR[0] / HR[0], 0.9, PR[2] / HR[2]);
  const add = (...ms) => ms.forEach((m) => g.add(m));
  switch (kind) {
    case 'cap': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(shirt));
      dome.scale.set(1.2, 0.8, 1.15);
      add(dome);
      // A band round the base, and a brim reaching forward over the eyes.
      add(mesh(torus(0.29, 0.024), toon(darken(shirt, 0.2)), 0, 0.02, 0, 1.16, 1, 1.11).rotateX(Math.PI / 2));
      add(mesh(roundedBox(0.34, 0.024, 0.24, 0.012), toon(shirt), 0, 0.015, 0.3));
      add(mesh(sphere(1, 12, 8), toon(darken(shirt, 0.2)), 0, 0.235, 0, 0.034));
      break;
    }
    case 'flower': {
      const f = new THREE.Group();
      f.position.set(0.22, 0.08, 0.12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = mesh(sphere(1, 14, 10), toon(i % 2 ? '#ff9fce' : '#ff8fc4'), Math.cos(a) * 0.062, Math.sin(a) * 0.062, 0, 0.048, 0.048, 0.024);
        petal.rotation.z = a;
        f.add(petal);
      }
      f.add(mesh(sphere(1, 12, 8), toon('#ffd84d'), 0, 0, 0.017, 0.036, 0.036, 0.02));
      const leaf = mesh(sphere(1, 12, 8), toon('#5fae4e'), 0.05, -0.03, -0.01, 0.05, 0.022, 0.026);
      leaf.rotation.z = 0.7;
      f.add(leaf);
      f.rotation.y = 0.5;
      add(f);
      break;
    }
    case 'bow': {
      const b = new THREE.Group();
      b.position.set(0.16, 0.12, 0.05);
      b.rotation.z = -0.3;
      // Each loop of the bow in two lobes, with a knot in the middle and two tails.
      for (const side of [-1, 1]) {
        b.add(mesh(sphere(1, 16, 12), toon('#ff5f8f'), side * 0.075, 0.018, 0, 0.072, 0.052, 0.038));
        b.add(mesh(sphere(1, 16, 12), toon('#ff5f8f'), side * 0.075, -0.028, 0, 0.062, 0.044, 0.034));
        const tail = mesh(capsule(0.016, 0.07), toon('#e0406f'), side * 0.05, -0.075, 0.005);
        tail.rotation.z = side * 0.5;
        b.add(tail);
      }
      b.add(mesh(sphere(1, 12, 8), toon('#e0406f'), 0, 0, 0.012, 0.034, 0.03, 0.026));
      add(b);
      break;
    }
    case 'party': {
      const c = mesh(cone(0.13, 0.32, 18), toon(shirt), 0, 0.2, 0);
      add(c, mesh(sphere(1, 14, 10), toon('#ffd84d'), 0, 0.37, 0, 0.05));
      for (let i = 0; i < 3; i++) add(mesh(torus(0.1 - i * 0.03, 0.012), toon(WHITE), 0, 0.09 + i * 0.08, 0).rotateX(Math.PI / 2));
      // A ruffle round the base, where the hat sits on the head.
      add(mesh(torus(0.115, 0.028, Math.PI * 2), toon(lighten(shirt, 0.3)), 0, 0.045, 0).rotateX(Math.PI / 2));
      break;
    }
    case 'crown': {
      const gold = toon('#ffcf3f', { emissive: 0.15 });
      add(mesh(cylinder(0.17, 0.17, 0.08, 20, true), gold, 0, 0.06, 0));
      add(mesh(torus(0.168, 0.012), gold, 0, 0.022, 0).rotateX(Math.PI / 2));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(mesh(cone(0.04, 0.09, 4), gold, Math.cos(a) * 0.16, 0.14, Math.sin(a) * 0.16));
      }
      // A jewel at each point, and one big one at the front.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        add(mesh(sphere(1, 10, 8), toon(i % 2 ? '#4fc3f7' : '#ff4f6f', { emissive: 0.2 }), Math.cos(a) * 0.16, 0.085, Math.sin(a) * 0.16, 0.022));
      }
      add(mesh(sphere(1, 12, 8), toon('#ff4f6f', { emissive: 0.25 }), 0, 0.06, 0.17, 0.03));
      break;
    }
    case 'beanie': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(shirt));
      dome.scale.set(1.18, 0.9, 1.12);
      add(dome);
      // Ribs running up the knit, each a band over the dome from the brim on
      // one side to the brim on the other, and a turned-up brim.
      const rib = geo('beanie-rib', () => new THREE.SphereGeometry(1, 8, 10, 0, Math.PI * 2, 0, Math.PI / 2));
      const ribs = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI;
        const reach = 1 / Math.hypot(Math.sin(a) / 0.354, Math.cos(a) / 0.336) + 0.007;
        ribs.push({ g: rib, m: at(0, 0, 0, 0.009, 0.277, reach, 0, a, 0) });
      }
      add(mesh(bakeCached('beanie-ribs', ribs), toon(darken(shirt, 0.15))));
      add(mesh(torus(0.33, 0.045), toon(lighten(shirt, 0.35)), 0, 0.02, 0, 1.05, 1, 1).rotateX(Math.PI / 2));
      add(mesh(sphere(1, 14, 10), toon(WHITE), 0, 0.3, 0, 0.07), mesh(sphere(1, 10, 8), toon('#f0e8e0'), 0.02, 0.33, 0.01, 0.035));
      break;
    }
    case 'sprout': {
      add(mesh(cylinder(0.012, 0.012, 0.14, 6), toon('#4fae3e'), 0, 0.22, 0));
      for (const side of [-1, 1]) {
        const l = mesh(sphere(1, 14, 10), toon(side > 0 ? '#6fcf55' : '#5fbf49'), side * 0.07, 0.3, 0, 0.08, 0.035, 0.04);
        l.rotation.z = side * 0.4;
        add(l);
      }
      const bud = mesh(sphere(1, 10, 8), toon('#8fe072'), 0, 0.31, 0.02, 0.024);
      add(bud);
      break;
    }
    case 'straw': {
      const straw = toon('#f2d27a');
      add(mesh(cylinder(0.42, 0.42, 0.025, 28), straw, 0, 0.02, 0));
      // The weave: rings of ridges on the brim, all as one shape.
      const weave = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        weave.push({ g: capsule(0.008, 0.13), m: new THREE.Matrix4().makeRotationY(a).setPosition(Math.cos(a) * 0.31, 0.033, Math.sin(a) * 0.31) });
      }
      add(mesh(bakeCached('straw-weave', weave), toon('#dabc5f')));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw);
      dome.scale.set(1.1, 0.8, 1.1);
      add(dome, mesh(cylinder(0.25, 0.25, 0.05, 24), toon('#ff6f8f'), 0, 0.04, 0));
      add(mesh(torus(0.252, 0.012), toon('#e05580'), 0, 0.062, 0).rotateX(Math.PI / 2));
      break;
    }
    case 'headphones': {
      const band = mesh(torus(0.34, 0.025, Math.PI), toon(shirt), 0, -0.1, 0);
      add(band);
      // A padded band riding just over it, and cups with cushions that meet the head.
      add(mesh(torus(0.345, 0.033, Math.PI), toon(darken(shirt, 0.15)), 0, -0.1, 0));
      for (const side of [-1, 1]) {
        add(mesh(cylinder(0.09, 0.09, 0.06, 18), toon(darken(shirt, 0.2)), side * 0.35, -0.12, 0).rotateZ(Math.PI / 2));
        add(mesh(torus(0.072, 0.02), toon('#3d3644'), side * 0.385, -0.12, 0).rotateY(Math.PI / 2));
        add(mesh(sphere(1, 12, 8), toon(lighten(shirt, 0.25)), side * 0.315, -0.12, 0, 0.028, 0.05, 0.05));
      }
      break;
    }
    default:
      return null;
  }
  head.add(g);
  return g;
}

// The parts of a body, shaped as a build (BUILDS) says, each hanging from
// its joint: a trouser leg from the hip down to the knee and on from the
// knee (its rounded top fills the bend) to the hem; an arm from the shoulder
// to the elbow, and the forearm from the elbow (rounded the same) to the wrist.
// lathe() wants its points from the bottom up; these are from the joint down.
const hanging = (points, segs) => lathe([...points].reverse(), segs);
const thighShape = (B) => {
  const L = B.hip - B.knee;
  const [top, mid, low] = B.thigh;
  return hanging([[0, 0.07], [top * 0.8, 0.06], [top, 0.015], [top * 0.97, -0.07], [mid, -L * 0.52], [low * 1.02, -L * 0.86], [low, -L], [low * 0.62, -L - low * 0.62], [0, -L - low * 0.8]], 20);
};
const shinShape = (B) => {
  const L = B.knee - B.hem;
  const [top, mid, low] = B.shin;
  return hanging([[0, top * 0.92], [top * 0.68, top * 0.74], [top, 0.004], [top * 1.01, -0.05], [mid, -L * 0.48], [low, -L], [low * 0.55, -L - 0.006], [0, -L - 0.008]], 20);
};
const upperArmShape = (B) => {
  const [len, , rs, re] = B.arm;
  return hanging([[0, -0.015], [rs * 0.9, -0.03], [rs * 0.95, -B.sleeve * 0.6], [(rs + re) * 0.51, -len * 0.62], [re, -len], [re * 0.6, -len - re * 0.62], [0, -len - re * 0.82]], 16);
};
const forearmShape = (B) => {
  const [, len, , re, rw] = B.arm;
  return hanging([[0, re * 0.9], [re * 0.68, re * 0.74], [re, 0], [re * 1.04, -len * 0.24], [(re + rw) * 0.5, -len * 0.62], [rw, -len], [rw * 0.6, -len - 0.005], [0, -len - 0.007]], 16);
};
// The shoulder rounded in its sleeve, and the short sleeve opening out from it.
const sleeveShape = (B) => {
  const rs = B.arm[2];
  return geo(`sleeve|${rs}|${B.sleeve}`, () =>
    bake([
      { g: sphere(1, 16, 12), m: at(0, 0, 0, rs * 1.22, rs * 1.02, rs * 1.18) },
      { g: hanging([[rs * 1.12, 0.016], [rs * 1.22, -0.012], [rs * 1.25, -B.sleeve * 0.6], [rs * 1.24, -B.sleeve], [rs * 1.02, -B.sleeve - 0.004]], 18), m: new THREE.Matrix4() },
    ]),
  );
};
// Clothes from the shop (shared/shop.js CLOTHES), over the t-shirt.
// A sheet hanging from its top edge down the back, for a cape or a robe:
// top and bottom its widths, len how far down it goes, bulge how far its
// middle stands out behind the edges at the bottom, rows [from, to] of it
// (0 the top, 1 the bottom) for a trim along the hem, and out how far it is
// pushed back, to lie over the sheet itself. Round from +x, it faces back.
const capeSheet = (top, bottom, len, bulge, rows = [0, 1], out = 0) =>
  geo(`cape|${top}|${bottom}|${len}|${bulge}|${rows}|${out}`, () => {
    const W = 12;
    const H = 10;
    const positions = [];
    const index = [];
    for (let j = 0; j <= H; j++) {
      const v = rows[0] + ((rows[1] - rows[0]) * j) / H;
      const w = top + (bottom - top) * v;
      for (let i = 0; i <= W; i++) {
        const u = i / W - 0.5;
        // Rounder about the shoulders, wider and in soft folds lower down.
        const z = -(0.012 + bulge * v) * Math.cos(u * Math.PI * 0.9) - 0.006 * v * Math.sin((u + 0.5) * Math.PI * 6) - out;
        positions.push(u * w, -v * len, z);
      }
    }
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const p = j * (W + 1) + i;
        index.push(p, p + 1, p + W + 1, p + 1, p + W + 2, p + W + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  });

// What a kind of clothes looks like: dressed onto the avatar (its torso and
// arms), and returns what flaps as you go — { part, flap: how far it swings
// back at a run, rest: and standing still } — or null for nothing that does.
function dressUp(av, kind, B) {
  const torso = av.torso;
  const k = B.hip / BUILDS.kid.hip;
  const ring = (i) => B.shirt[i];
  const shoulderY = B.shoulder[0];
  const backAt = (y) => (B.shirt.find(([ry]) => ry >= y) ?? ring(B.shirt.length - 1))[3];
  // A shell a little bigger than the t-shirt, rings from..to of it.
  // The little parts that never move on their own, fused into one shape for
  // each colour and what they are on (see bakeCached): name, to, mat.
  const fused = new Map();
  const put = (name, to, mat, g, m) => {
    if (!fused.has(name)) fused.set(name, { to, mat, parts: [] });
    fused.get(name).parts.push({ g, m });
  };
  const shell = (from, to, grow, front = grow) => loft(B.shirt.slice(from, to + 1).map(([y, w, a, b]) => [y, w * grow, a * front, b * grow]), { segs: 28, ends: [false, false] });
  // A cape or a robe, hung from the back of the collar.
  const cape = (outer, lining, len, bottom, flap, rest) => {
    const g = new THREE.Group();
    const top = B.shoulder[1] * 1.55;
    g.position.set(0, shoulderY + 0.035 * k, -backAt(shoulderY) - 0.004);
    g.add(mesh(capeSheet(top, bottom, len, 0.07 * k), toon(outer)));
    g.add(mesh(capeSheet(top, bottom, len, 0.07 * k), toon(lining, { side: THREE.BackSide })));
    torso.add(g);
    // Clasps at the front of the shoulders, holding it on.
    for (const side of [-1, 1]) put('clasps', torso, toon('#f5c542'), sphere(1, 12, 8), at(side * B.shoulder[1] * 0.62, shoulderY + 0.03 * k, ring(6)[2] * 0.75, 0.02 * k));
    return { g, top, flap, rest };
  };
  let flapping = null;
  switch (kind) {
    case 'scarf': {
      // A stripy scarf round the neck, its end hanging down behind one
      // shoulder: that is what flies out behind as you run.
      const [cy, cw, cf] = ring(B.shirt.length - 1);
      const stripes = ['#e8453c', '#ffffff'];
      torso.add(mesh(torus(cw * 1.18, 0.024 * k), toon(stripes[0]), 0, cy + 0.012 * k, 0.004, 1, cf / cw, 1).rotateX(Math.PI / 2 - 0.1));
      const end = new THREE.Group();
      end.position.set(-cw * 0.7, cy + 0.005 * k, -backAt(cy) - 0.012 * k);
      const seg = 0.045 * k;
      for (let i = 0; i < 4; i++) put(`end${i % 2}`, end, toon(stripes[i % 2]), roundedBox(0.06 * k, seg, 0.016 * k, 0.006 * k), at(0, -seg * (i + 0.5), 0));
      for (const x of [-0.022, -0.007, 0.008, 0.023]) put('end0', end, toon(stripes[0]), cylinder(0.004 * k, 0.004 * k, 0.025 * k, 6), at(x * k, -seg * 4 - 0.012 * k, 0));
      torso.add(end);
      flapping = { part: end, flap: 1.1, rest: 0.08 };
      break;
    }
    case 'cape': {
      const c = cape('#e23b3b', '#f5c542', B.shoulder[0] + B.hip - 0.24 * k, c0(B) * 2.9, 0.6, 0.06);
      flapping = { part: c.g, flap: c.flap, rest: c.rest };
      break;
    }
    case 'robe': {
      // A long velvet robe down to the heels, with a white fur trim along
      // the hem and a fluffy white collar, both with ermine's black spots.
      const len = B.shoulder[0] + B.hip - 0.05 * k;
      const bottom = c0(B) * 3.3;
      const c = cape('#6a2c91', '#f2c84b', len, bottom, 0.22, 0.05);
      const top = c.top;
      c.g.add(mesh(capeSheet(top, bottom, len, 0.07 * k, [0.92, 1], 0.004), toon('#fbf8f2')));
      const [cy, cw, cf] = ring(B.shirt.length - 2);
      torso.add(mesh(torus(cw * 1.08, 0.034 * k), toon('#fbf8f2'), 0, cy + 0.01 * k, 0, 1, cf / cw, 1).rotateX(Math.PI / 2 - 0.1));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        put('spots', torso, toon(BLACK), sphere(1, 6, 4), at(Math.cos(a) * (cw * 1.08 + 0.026 * k), cy + 0.022 * k, Math.sin(a) * (cf * 1.08 + 0.026 * k), 0.007 * k));
      }
      flapping = { part: c.g, flap: c.flap, rest: c.rest };
      break;
    }
    case 'armor': {
      // A shiny breastplate over the t-shirt, a gold rim round its edges, a
      // red cross on the chest, and a round plate on each shoulder.
      const steel = toon('#cfd6e0');
      const gold = toon('#e9b93a');
      torso.add(mesh(shell(0, 7, 1.12, 1.2), steel));
      for (const i of [0, 7]) {
        const [y, w, a, b] = ring(i);
        put('rims', torso, gold, torus(w * 1.12, 0.008 * k), at(0, y, ((a - b) * 1.15) / 2, 1, ((a + b) * 1.16) / 2 / (w * 1.12), 1, Math.PI / 2));
      }
      const [badgeY] = B.badge;
      const front = (B.shirt.find(([y]) => y >= badgeY) ?? ring(4))[2] * 1.2 + 0.004;
      const red = toon('#d93a3a');
      put('cross', torso, red, roundedBox(0.03 * k, 0.11 * k, 0.01 * k, 0.004 * k), at(0, badgeY, front, 1, 1, 1, -0.12));
      put('cross', torso, red, roundedBox(0.08 * k, 0.03 * k, 0.01 * k, 0.004 * k), at(0, badgeY + 0.012 * k, front, 1, 1, 1, -0.12));
      for (const arm of av.arms) arm.add(mesh(geo('pauldron', () => new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), steel, 0, -0.012 * k, 0, B.arm[2] * 1.75, B.arm[2] * 1.4, B.arm[2] * 1.65));
      break;
    }
    case 'firesuit': {
      // A firefighter's coat over the t-shirt: thick and yellow, with
      // shining bands round the middle and the chest, and its sleeves.
      const coat = toon('#e7b52c');
      const bright = toon('#e8f0f2', { emissive: 0.25 });
      const lime = toon('#c8f04a');
      torso.add(mesh(shell(0, B.shirt.length - 1, 1.09, 1.12), coat));
      for (const i of [1, 4]) {
        const [y, w, a, b] = ring(i);
        for (const [dy, name, m, r] of [[0, 'lime', lime, 0.013], [0.022 * k, 'bright', bright, 0.007], [-0.022 * k, 'bright', bright, 0.007]]) {
          put(name, torso, m, torus(w * 1.1, r * k), at(0, y + dy, ((a - b) * 1.12) / 2, 1, ((a + b) * 1.12) / 2 / (w * 1.1), 1, Math.PI / 2));
        }
      }
      // Buckles down the front.
      const black = toon('#3a3a40');
      for (const i of [2, 3, 5]) put('buckles', torso, black, roundedBox(0.03 * k, 0.012 * k, 0.008 * k, 0.003 * k), at(0, ring(i)[0], ring(i)[2] * 1.12 + 0.004));
      for (const arm of av.arms) {
        arm.add(mesh(sleeveShape(B), coat, 0, 0, 0, 1.1, 1.6, 1.1));
        arm.add(mesh(torus(B.arm[2] * 1.38, 0.008 * k), lime, 0, -B.sleeve * 1.4, 0).rotateX(Math.PI / 2));
      }
      break;
    }
    default:
      break;
  }
  for (const [name, { to, mat, parts }] of fused) to.add(mesh(bakeCached(`outfit|${kind}|${name}|${B === BUILDS.grown ? 'grown' : 'kid'}`, parts), mat));
  return flapping;
}
// A cape's width at the bottom goes by how wide the shoulders are.
const c0 = (B) => B.shoulder[1];

// A hand at the wrist, hanging down, its palm to the body (side: which
// hand, -1 or 1) and its thumb forward: a palm, four fingers a little curled
// and a thumb, size times a small hand.
const handShape = (size, side) =>
  geo(`hand|${size}|${side}`, () => {
    const parts = [{ g: sphere(1, 14, 10), m: at(0, -0.034, 0.001, 0.0118, 0.035, 0.0235) }];
    // From the front (by the thumb) to the back: how long each finger is.
    for (const [z, len, r] of [[0.0155, 0.038, 0.0062], [0.005, 0.043, 0.0065], [-0.0055, 0.04, 0.0062], [-0.0158, 0.032, 0.0056]]) {
      parts.push({ g: capsule(r, len - 2 * r, 4, 8), m: at(-side * 0.002, -0.056 - len / 2, z, 1, 1, 1, 0, 0, -side * 0.22) });
    }
    parts.push({ g: capsule(0.0074, 0.02, 4, 8), m: at(-side * 0.006, -0.033, 0.024, 1, 1, 1, -0.55, 0, -side * 0.15) });
    return bake(parts.map(({ g, m }) => ({ g, m: new THREE.Matrix4().makeScale(size, size, size).multiply(m) })));
  });

// A hand as it plays the piano, palm down and jointed (handShape is one
// piece, its fingers straight along the arm): a palm and four fingers
// along -y, each in two parts that curl down (to -z) at the knuckle and at
// the middle joint, arched over the keys, and the thumb under the inner side
// (towards the middle of you, -side). Laid out as handShape is, in the
// hand's own place at the end of the forearm, and as big.
function pianoHand(size, side, skin) {
  const g = new THREE.Group();
  g.scale.setScalar(size);
  // The palm, broad and flat, from the wrist out to the knuckles, and the
  // wrist joining it to the forearm.
  g.add(mesh(roundedBox(0.05, 0.054, 0.022, 0.0095), skin, -side * 0.002, -0.037, 0));
  g.add(mesh(sphere(1, 12, 8), skin, 0, -0.008, 0, 0.019, 0.014, 0.012));
  const fingers = [];
  // From the thumb's side: across, how long, how thick (as handShape's
  // lengths), each splayed out a little from the middle of the hand.
  for (const [x, len, r] of [[0.0215, 0.038, 0.0064], [0.0072, 0.043, 0.0066], [-0.0072, 0.04, 0.0064], [-0.0215, 0.032, 0.0058]]) {
    const knuckle = new THREE.Group();
    knuckle.position.set(-side * x, -0.064, 0.002);
    knuckle.rotation.order = 'ZXY';
    knuckle.rotation.z = -side * x * 3;
    const a = len * 0.55;
    const b = len * 0.45;
    knuckle.add(mesh(capsule(r * 1.12, a, 4, 8), skin, 0, -a / 2, 0));
    const joint = new THREE.Group();
    joint.position.y = -a;
    joint.add(mesh(capsule(r * 1.05, b, 4, 8), skin, 0, -b / 2, 0));
    knuckle.add(joint);
    g.add(knuckle);
    fingers.push({ knuckle, joint });
  }
  // The thumb, reaching forward and down along the inner side.
  const thumb = new THREE.Group();
  thumb.position.set(-side * 0.028, -0.03, -0.004);
  thumb.rotation.z = side * 0.35;
  thumb.add(mesh(capsule(0.0072, 0.024, 4, 8), skin, 0, -0.019, 0));
  g.add(thumb);
  return { group: g, fingers, thumb };
}

// The bench you sit on at the piano, its padded top where the root is and
// its four legs down to the floor: a little wider than you, of the same dark
// wood as the piano, with a red cushion.
// A mug of coffee, for a break at a desk, its handle on its +x side.
function coffeeMug(h) {
  const g = new THREE.Group();
  const cup = toon('#f4f1ea');
  const r = MUG_R * h;
  const tall = MUG_H * h;
  g.add(mesh(cylinder(r, r * 0.9, tall, 14), cup, 0, 0, 0));
  g.add(mesh(cylinder(r * 0.88, r * 0.88, 0.004, 14), toon('#5b3a24'), 0, tall / 2 - 0.006 * h, 0));
  // The handle: a ring standing up on the side (a torus lies in its own xy plane).
  g.add(mesh(torus(r * 0.5, 0.006 * h), cup, r * 1.05, 0, 0));
  g.add(mesh(cylinder(r * 1.01, r * 1.01, tall * 0.25, 14), toon('#1f8a8a'), 0, -tall * 0.1, 0));
  return g;
}

function pianoBench() {
  const g = new THREE.Group();
  const wood = toon('#3b2a24');
  g.add(mesh(roundedBox(0.56, 0.06, 0.32, 0.02), wood, 0, -0.05, -0.02));
  g.add(mesh(roundedBox(0.5, 0.04, 0.27, 0.018), toon('#c0392b'), 0, -0.01, -0.02));
  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.15, 0.11]) g.add(mesh(cylinder(0.02, 0.016, BENCH_H - 0.07, 8), wood, x, -0.075 - (BENCH_H - 0.07) / 2, z));
  }
  return g;
}

export class Avatar {
  constructor(look, { name = '' } = {}) {
    this.root = new THREE.Group();
    this.root.name = `avatar ${name}`;
    this.look = null;
    this.phase = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.emote = null;
    this.emoteAt = 0;
    this.time = 0;
    this.anim = ANIM.idle;
    this.speed = 0;
    // On an animal: how far round it the legs reach (see shared/critters.js).
    this.ride = null;
    this.setLook(look);
    // At the piano: each hand where on the keys it is (0 the lowest key, 1
    // the highest; the left plays below the high C, the right from it) and
    // when it last struck one; and the bench under you, there only while
    // you play (so nothing measuring you counts it otherwise).
    this.keys = [
      { u: 0.3, to: 0.3, at: -Infinity, finger: 2 },
      { u: 0.7, to: 0.7, at: -Infinity, finger: 2 },
    ];
    this.bench = pianoBench();
    // Each one's own place in idle rhythms (typing and its pauses), so
    // people side by side are never in step; and when their next sip is.
    this.quirk = Math.random() * 1000;
    this.sipAt = null;
    this.sipping = false;
    // The mug in hand on a coffee break, there only then.
    this.mug = null;
    // A soft round shadow under the feet.
    const shadow = blobShadow(0.42);
    shadow.position.y = 0.02;
    this.shadow = shadow;
  }

  setLook(full) {
    // A pet goes along beside you (render/pet-models.js), not on you.
    const { pet: _, ...look } = full;
    const same = this.look && JSON.stringify(this.look) === JSON.stringify(look);
    if (same) return;
    this.look = { ...look };
    if (this.body) this.root.remove(this.body);
    this.curlFit = null;
    const person = isPerson(look);
    const grown = look.animal === GROWN_UP;
    const B = grown ? BUILDS.grown : BUILDS.kid;
    this.build = B;
    // How much taller a grown-up is than a kid.
    this.tall = lookTall(look);
    // A kid's (or a grown-up's) skin is where an animal's fur is: face, neck and hands.
    const fur = person ? (SKIN_TONES[look.skin] ?? SKIN_TONES.golden) : (FUR_COLORS[look.fur] ?? FUR_COLORS.white);
    const skin = toon(fur);
    const shirt = shirtColor(look.shirt);
    const shirtMat = toon(shirt);
    const band = toon(darken(shirt, 0.16));
    const body = new THREE.Group();
    this.body = body;
    this.root.add(body);

    const frog = look.animal === 'frog';
    const pants = frog ? fur : trousersFor(shirt);
    const pantsMat = toon(pants);
    const seam = toon(darken(pants, 0.18));
    // Legs: a thigh from the hip, then the knee and the shin down to a
    // sneaker (a frog's legs are its skin, and its feet bare), or the
    // running shoes from the shop (on a frog too).
    const skates = SKATES[look.skates] ?? null;
    const shoes = skates ?? SHOES[look.shoes] ?? null;
    this.flames = [];
    this.wheels = [];
    this.skateLift = skates ? SKATE_LIFT * B.foot : 0;
    this.legs = [];
    this.knees = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * B.hipX, B.hip, 0);
      leg.add(mesh(thighShape(B), pantsMat));
      const knee = new THREE.Group();
      knee.position.y = B.knee - B.hip;
      knee.add(mesh(shinShape(B), pantsMat));
      if (!frog) knee.add(mesh(torus(B.shin[2] + 0.001, 0.0105), seam, 0, B.hem - B.knee + 0.011, 0).rotateX(Math.PI / 2));
      knee.add(mesh(sneakerSole(B.foot), toon(shoes?.sole ?? (frog ? darken(fur, 0.25) : '#f6f1ea')), 0, -B.knee, 0));
      knee.add(mesh(sneakerUpper(B.foot), toon(shoes?.upper ?? (frog ? darken(fur, 0.1) : shoeFor(shirt))), 0, -B.knee, 0));
      if (shoes || !frog) knee.add(mesh(sneakerTrim(B.foot), toon(shoes?.trim ?? '#ffffff'), 0, -B.knee, 0));
      if (skates) this.wheels.push(...skateParts(knee, look.skates, B));
      else if (shoes) this.flames.push(...shoeExtras(knee, look.shoes, B, side));
      leg.add(knee);
      body.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
    }
    this.torso = new THREE.Group();
    this.torso.position.y = B.hip;
    body.add(this.torso);
    // The seat of the jeans, with a pocket either side behind.
    this.torso.add(mesh(loft(B.seat), pantsMat));
    if (!frog) {
      const [y, , , back] = B.seat[3];
      const w = B.seat[3][1];
      this.torso.add(mesh(geo(`pockets|${w}`, () => bake([-1, 1].map((side) => ({ g: roundedBox(w * 0.46, w * 0.42, 0.012, 0.005), m: at(side * w * 0.4, y - 0.03, -back * 0.92, 1, 1, 1, 0.12, -side * 0.35, 0) })))), seam));
    }
    // A t-shirt with a shape of its own: a chest, shoulders, a waist, and a
    // hem that sits out over the jeans; a band round the hem, a ribbed collar
    // round the neck, and a star on the chest.
    const hem = B.shirt[0];
    const collar = B.shirt[B.shirt.length - 1];
    this.torso.add(mesh(loft(B.shirt, { segs: 28, ends: [false, true] }), shirtMat));
    this.torso.add(mesh(torus(hem[1], 0.009), band, 0, hem[0] + 0.006, (hem[2] - hem[3]) / 2, 1, (hem[2] + hem[3]) / 2 / hem[1], 1).rotateX(Math.PI / 2));
    this.torso.add(mesh(torus(collar[1], 0.0105), band, 0, collar[0] - 0.004, 0.002, 1, collar[2] / collar[1], 1).rotateX(Math.PI / 2 - 0.12));
    const [badgeY, badgeSize] = B.badge;
    const chest = B.shirt.find(([y]) => y >= badgeY) ?? B.shirt[4];
    const badge = mesh(starShape(), toon(lighten(shirt, 0.65)), 0, badgeY, chest[2] - 0.002, badgeSize);
    badge.rotation.x = -0.12;
    this.torso.add(badge);
    // A neck in the skin colour, up into the head.
    const [neckY, neckR, neckTop] = B.neck;
    this.torso.add(mesh(lathe([[0, neckY], [neckR * 1.08, neckY + 0.004], [neckR * 1.02, neckY + 0.04], [neckR, (neckY + neckTop) / 2], [neckR * 0.97, neckTop], [0, neckTop + 0.004]], 16), skin));
    // Arms: a shoulder in its short sleeve, a bare arm down to the elbow, and
    // the forearm down to the hand.
    this.arms = [];
    this.elbows = [];
    this.hands = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * B.shoulder[1], B.shoulder[0], 0);
      // Turned about its length last (only ever to hold a mug: reachTo).
      arm.rotation.order = 'XZY';
      arm.add(mesh(sleeveShape(B), shirtMat));
      arm.add(mesh(torus(B.arm[2] * 1.22, 0.0068), band, 0, -B.sleeve + 0.005, 0).rotateX(Math.PI / 2));
      arm.add(mesh(upperArmShape(B), skin));
      const elbow = new THREE.Group();
      elbow.position.y = -B.arm[0];
      elbow.add(mesh(forearmShape(B), skin));
      const hand = new THREE.Group();
      hand.position.y = -B.arm[1];
      const rest = mesh(handShape(B.hand, side), skin);
      hand.add(rest);
      hand.userData.rest = rest;
      hand.userData.piano = pianoHand(B.hand, side, skin);
      elbow.add(hand);
      arm.add(elbow);
      this.torso.add(arm);
      this.arms.push(arm);
      this.elbows.push(elbow);
      this.hands.push(hand);
    }
    // A toy weapon in the right hand, its grip in the palm.
    this.handsPlaying = false;
    this.weapon = look.weapon ? weapon(look.weapon) : null;
    this.weaponKind = this.weapon ? look.weapon : null;
    if (this.weapon) {
      this.weapon.position.set(0, -0.045 * B.hand, 0.006 * B.hand);
      this.hands[1].add(this.weapon);
    }
    // The head turns on the neck; the skull is made at its own size and
    // scaled to the body.
    const H = person ? B.head : ANIMAL_SKULL;
    this.head = new THREE.Group();
    this.head.position.y = H.pivot;
    this.torso.add(this.head);
    const skull = new THREE.Group();
    skull.position.set(0, H.y - H.pivot, H.z);
    skull.scale.setScalar(H.k);
    this.head.add(skull);
    this.skull = skull;
    if (person) {
      const hairColor = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS.brown;
      const f = grown ? FACE_SHAPES.grown : FACE_SHAPES.kid;
      this.eyes = personFace(skull, f, fur, { ears: look.hair !== 'bob' && look.hair !== 'long', extra: grown ? (look.face ?? 'none') : 'none', hairColor });
      this.lidShut = this.eyes.userData.shut;
      this.sway = hair(skull, look.hair, hairColor, look.hat, grown ? 1.15 : 1);
    } else {
      skull.add(mesh(sphere(HEAD_R, 28, 20), skin, 0, 0, 0, HEAD.sx, HEAD.sy, HEAD.sz));
      ears(skull, look.animal, fur);
      this.eyes = face(skull, look.animal, fur);
      this.lidShut = 0;
      // An alien's antennae bob the way a ponytail swings.
      this.sway = skull.children.filter((o) => o.userData.ear && o.userData.rest !== undefined);
    }
    this.hat = hat(skull, look.hat, shirt, person ? (look.hair === 'curly' ? 0.07 : 0.025) : 0, person);
    // Clothes from the shop, over all of it.
    this.outfit = look.outfit ? dressUp(this, look.outfit, B) : null;
    // Flying gear on your back, over the clothes.
    const caped = look.outfit === 'cape' || look.outfit === 'robe';
    this.wings = look.wings ? wingsOn(this, look.wings, B, caped) : null;
    // Under wings or a jet pack, a cape or a robe flies out less, to keep
    // clear of them.
    if (this.wings && caped && this.outfit) this.outfit = { ...this.outfit, flap: this.outfit.flap * 0.35 };
    const back = B.seat.reduce((most, ring) => Math.max(most, ring[3]), 0);
    this.tail = tail(this.torso, look.animal, fur, new THREE.Vector3(0, -0.02, -back + 0.01));
    // A cape or a robe hangs over a tail, which would poke through it.
    if (this.tail && (look.outfit === 'cape' || look.outfit === 'robe')) this.tail.visible = false;
    // Where the top of your head is sitting on the ground (dizzy), and how
    // far behind your middle the back of you reaches (the back of your head,
    // or of your jeans), to lie on it.
    this.sitTop = 1.41 + this.tall - (B.hip - SIT_HIPS);
    this.lieLift = Math.max(back, (person ? PR[2] * 1.08 : HR[2]) * H.k - H.z);
    // How far down you sink swimming, leaning forward, to have your head just out of the water.
    this.swimDrop = B.hip + H.y * Math.cos(SWIM_LEAN) - SWIM_HEAD;
  }

  // A swing at a monster, with whatever is in hand (see SWINGS). Returns how
  // long until it lands, in seconds.
  swing() {
    this.swingAt = this.time;
    const swing = SWINGS[this.weaponKind] ?? SWINGS.punch;
    return swing.secs * swing.strike;
  }

  // A key struck on the piano being played (MIDI note n): the hand on that
  // side of the keyboard moves over to it and strikes it.
  pianoNote(n) {
    const u = Math.max(0, Math.min(1, (n - LOW) / (HIGH - LOW)));
    const hand = this.keys[u < 0.5 ? 0 : 1];
    hand.to = u;
    hand.at = this.time;
    // The thumb (0) to the little finger (4), as the tune walks along.
    hand.finger = (n - LOW) % 5;
  }

  playEmote(key) {
    this.emote = key;
    this.emoteAt = this.time;
  }

  // anim: one of ANIM; speed: ground speed (for the walk cycle, and the
  // bounce in the saddle).
  update(dt, anim, speed) {
    this.time += dt;
    const t = this.time;
    this.anim = anim;
    const B = this.build;
    const moving = anim === ANIM.walk || anim === ANIM.run;
    const running = anim === ANIM.run;
    const riding = anim === ANIM.ride;
    // On skates, long slow pushes: you glide most of the way.
    const rate = moving ? (this.skateLift ? 2.2 + speed * 0.45 : 3.2 + speed * 1.6) : 0;
    this.phase += dt * rate;
    const ph = this.phase;
    const s = Math.sin(ph);
    const [legL, legR] = this.legs;
    const [kneeL, kneeR] = this.knees;
    const [armL, armR] = this.arms;
    const [elbowL, elbowR] = this.elbows;
    // Rest pose.
    let bob = 0;
    let lean = 0;
    let legSwing = 0;
    let armSwing = 0;
    let armRaiseL = REST_RAISE;
    let armRaiseR = REST_RAISE;
    let armFwdL = 0;
    let armFwdR = 0;
    // The right upper arm turned about its own length (only to hold a mug).
    let armTwistR = 0;
    // How far each elbow and knee bends.
    let bendL = 0.14;
    let bendR = 0.14;
    let kneeBendL = 0.04;
    let kneeBendR = 0.04;
    let spin = 0;
    let headTilt = 0;
    let headNod = 0;
    let twist = 0;
    // Poses that put both legs just so: for each, [forward (-) or back,
    // out, how far the knee bends, and the shin turned back in under it].
    let legs = null;

    if (moving) {
      // Strides as long as carry you over the ground at that speed, each knee
      // bending as its foot swings through (most just after it leaves the
      // ground), the arms swinging against the legs and the shoulders
      // turning with them.
      const stride = Math.min(0.8, Math.max(0.3, speed / (B.hip * rate)));
      legSwing = s * stride;
      armSwing = -s * stride * (running ? 0.95 : 0.75);
      const lift = running ? 1.5 : 0.85;
      kneeBendL = 0.1 + lift * Math.max(0, -Math.cos(ph + 0.54)) ** 1.3;
      kneeBendR = 0.1 + lift * Math.max(0, Math.cos(ph + 0.54)) ** 1.3;
      bendL = (running ? 1.4 : 0.32) + 0.25 * Math.max(0, s);
      bendR = (running ? 1.4 : 0.32) + 0.25 * Math.max(0, -s);
      bob = running ? Math.abs(s) * 0.045 - 0.025 : (Math.abs(Math.cos(ph)) - 0.6) * 0.022;
      lean = running ? 0.17 : 0.05;
      twist = s * (running ? 0.1 : 0.07);
      if (this.skateLift) {
        // On skates, a push off to the side and back with each foot in
        // turn, gliding on the other, knees bent and leaning in, the arms
        // swinging wide across.
        const pushes = [Math.max(0, s), Math.max(0, -s)];
        legs = pushes.map((u, i) => {
          const out = (i ? 1 : -1) * (0.06 + 0.4 * u);
          return [-0.28 + 0.6 * u, out, 0.6 - 0.4 * u, -out * 0.6];
        });
        armSwing = -s * 0.5;
        armRaiseL = armRaiseR = REST_RAISE + 0.25;
        bendL = bendR = 0.35;
        bob = -0.03 + Math.abs(s) * 0.01;
        lean = 0.22;
        twist = s * 0.15;
      }
    } else if (anim === ANIM.air) {
      // Up in a jump, knees tucked, arms out for balance.
      legSwing = 0.3;
      kneeBendL = 0.55;
      kneeBendR = 0.75;
      armRaiseL = armRaiseR = 0.8;
      armFwdL = armFwdR = -0.35;
      bendL = bendR = 0.55;
    } else if (anim === ANIM.swim) {
      lean = SWIM_LEAN;
      armFwdL = Math.sin(t * 6) * 0.9 - 1.5;
      armFwdR = Math.sin(t * 6 + Math.PI) * 0.9 - 1.5;
      bendL = 0.35 + 0.3 * Math.max(0, Math.cos(t * 6));
      bendR = 0.35 + 0.3 * Math.max(0, -Math.cos(t * 6));
      armRaiseL = armRaiseR = 0.25;
      legSwing = Math.sin(t * 8) * 0.35;
      kneeBendL = 0.2 + 0.25 * Math.max(0, Math.sin(t * 8));
      kneeBendR = 0.2 + 0.25 * Math.max(0, -Math.sin(t * 8));
      bob = Math.sin(t * 3) * 0.04 - this.swimDrop;
    } else if (anim === ANIM.fly) {
      // Gliding, arms out like wings and a little back, legs trailing.
      armRaiseL = armRaiseR = 1.1 + Math.sin(t * 2.5) * 0.06;
      armFwdL = armFwdR = 0.3;
      bendL = bendR = 0.25;
      lean = 0.35;
      bob = Math.sin(t * 2.5) * 0.06;
      legs = [[0.22, -0.05, 0.3, 0], [0.32, 0.05, 0.5, 0]];
    } else if (anim === ANIM.dizzy) {
      // Sat down with a bump, legs out in front, leaning back on your hands,
      // head going round and round.
      bob = -(B.hip - SIT_HIPS);
      lean = -0.18;
      armRaiseL = armRaiseR = 0.35;
      armFwdL = armFwdR = 0.4;
      bendL = bendR = 0.12;
      headTilt = Math.sin(t * 5) * 0.28;
      headNod = 0.12 + Math.cos(t * 5) * 0.1;
      legs = [[-1.42, -0.16, 0.3, 0], [-1.42, 0.16, 0.3, 0]];
    } else if (anim === ANIM.sit) {
      // Sitting back in the seat, knees over its edge, hands in the lap,
      // looking about now and then.
      bob = -(B.hip - SIT_HIPS);
      lean = -0.04;
      armRaiseL = armRaiseR = 0;
      armFwdL = armFwdR = -0.3;
      bendL = bendR = 0.85;
      headTilt = Math.sin(t * 0.7) * 0.06;
      headNod = Math.sin(t * 0.45) * 0.05;
      legs = [[-1.48, -0.07, 1.3, 0], [-1.48, 0.07, 1.3, 0]];
    } else if (anim === ANIM.piano) {
      // On the bench, leaning in to the keys, both hands on them: each glides
      // over to the key it plays next and strikes it, the wrist dropping and
      // springing back up, and the shoulders turn a little after the hand
      // that played last; the fingers ripple while you are playing, and the
      // head sways with the music. The left hand is on this side (+x), the
      // low notes' end as you face the piano.
      bob = -(B.hip - SIT_HIPS);
      lean = 0.16;
      const [lo, hi] = this.keys;
      const glide = Math.min(1, dt * 14);
      lo.u += (lo.to - lo.u) * glide;
      hi.u += (hi.to - hi.u) * glide;
      const press = (k) => Math.max(0, 1 - (t - k.at) / 0.2) ** 2;
      const pl = press(lo);
      const ph2 = press(hi);
      const playing = t - Math.max(lo.at, hi.at) < 1.5;
      const ripple = playing ? 0.03 : 0.012;
      // How far out each arm reaches along the keys, from the middle.
      armRaiseR = -0.08 + (0.5 - lo.u) * 0.95;
      armRaiseL = -0.08 + (hi.u - 0.5) * 0.95;
      armFwdR = -0.94 + 0.05 * pl + Math.sin(t * 11) * ripple * 0.4;
      armFwdL = -0.94 + 0.05 * ph2 + Math.sin(t * 11 + 1.7) * ripple * 0.4;
      bendR = 0.62 - 0.05 * pl;
      bendL = 0.62 - 0.05 * ph2;
      const last = lo.at > hi.at ? lo.u : hi.u;
      twist = playing ? (0.5 - last) * 0.35 : 0;
      headTilt = playing ? Math.sin(t * 2.2) * 0.08 : Math.sin(t * 0.7) * 0.04;
      headNod = 0.18 + (pl + ph2) * 0.03;
      legs = [[-1.42, -0.1, 1.35, 0], [-1.42, 0.1, 1.35, 0]];
    } else if (anim === ANIM.type) {
      // At a desk, leaning in to the keyboard, both forearms out over it and
      // the hands tapping away in turn, quick and uneven; now and then a
      // pause to read the screen, the head bent to it all the while.
      bob = -(B.hip - SIT_HIPS);
      lean = 0.12;
      const q = t + this.quirk;
      const busy = Math.sin(q * 0.9) + Math.sin(q * 0.37 + 1) > -1.1;
      const tapL = busy ? Math.max(0, Math.sin(q * 17)) ** 2 : 0;
      const tapR = busy ? Math.max(0, Math.sin(q * 19.5 + 1.3)) ** 2 : 0;
      armRaiseL = armRaiseR = -0.1;
      armFwdL = -0.85 + tapL * 0.08;
      armFwdR = -0.85 + tapR * 0.08;
      bendL = 0.9 - tapL * 0.1;
      bendR = 0.9 - tapR * 0.1;
      twist = busy ? (tapR - tapL) * 0.03 : 0;
      headNod = 0.16 + (busy ? 0 : Math.sin(q * 0.8) * 0.03);
      headTilt = busy ? Math.sin(q * 1.3) * 0.025 : Math.sin(q * 0.6) * 0.07;
      legs = [[-1.48, -0.07, 1.3, 0], [-1.48, 0.07, 1.3, 0]];
    } else if (anim === ANIM.coffee) {
      // On a break, sat back with a mug of coffee: held in front of you,
      // and every so often lifted for a sip, the head tipping back a little
      // as you drink; the other hand rests in the lap.
      bob = -(B.hip - SIT_HIPS);
      lean = -0.06;
      // The first sip some while after sitting down; each after it a random wait after the last.
      const wait = () => SIP_GAP[0] + Math.random() * (SIP_GAP[1] - SIP_GAP[0]);
      if (this.sipAt === null) this.sipAt = t + Math.random() * SIP_GAP[1];
      else if (t > this.sipAt + SIP_TIME) {
        this.sipAt = t + wait();
        this.sipping = false;
      }
      if (!this.sipping && t >= this.sipAt) {
        const now = performance.now();
        if (now - lastSip < SIP_TIME * 1000) this.sipAt = t + 0.5 + Math.random() * 2;
        else {
          lastSip = now;
          this.sipping = true;
        }
      }
      const c = t - this.sipAt;
      const up = this.sipping && c >= 0 && c < SIP_TIME ? Math.min(1, Math.sin((c / SIP_TIME) * Math.PI) * 1.6) : 0;
      this.sip = up * up * (3 - 2 * up);
      armRaiseL = 0;
      armFwdL = -0.3;
      bendL = 0.85;
      // The right hand round the mug, wherever it is (see holdMug).
      [armFwdR, armTwistR, armRaiseR, bendR] = this.reachTo(this.mugGrip(this.sip));
      headNod = 0.04 - this.sip * 0.14;
      headTilt = this.sip ? 0 : Math.sin((t + this.quirk) * 0.7) * 0.06;
      legs = [[-1.48, -0.07, 1.3, 0], [-1.48, 0.07, 1.3, 0]];
    } else if (anim === ANIM.curl) {
      // Hugging your knees, chin tucked in, breathing slowly.
      armRaiseL = armRaiseR = -0.05;
      armFwdL = armFwdR = -0.85 + Math.sin(t * 1.6) * 0.02;
      bendL = bendR = 1.25;
      headNod = 0.55;
      legs = [[-2.05, -0.05, 2.3, 0], [-2.05, 0.05, 2.3, 0]];
    } else if (anim === ANIM.lie) {
      // Flat on your back, arms by your sides, breathing slowly.
      bob = Math.sin(t * 1.6) * 0.006;
      armRaiseL = armRaiseR = 0.12;
      bendL = bendR = 0.1;
      legs = [[0, -0.04, 0.04, 0], [0, 0.04, 0.04, 0]];
    } else if (riding) {
      if (this.ride?.stand) {
        // Kicking along standing up (a kick scooter): front foot planted on
        // the deck, the other kicking back, hands on the handlebars.
        const k = Math.min(1, speed / 9);
        const kick = speed > 0.4;
        this.phase += dt * (kick ? 3.5 + speed * 1.3 : 0);
        bob = Math.abs(Math.sin(this.phase * 0.5)) * (0.008 + k * 0.02);
        lean = 0.07 + k * 0.16;
        armFwdL = armFwdR = -0.95 - k * 0.12;
        armRaiseL = armRaiseR = 0.1;
        bendL = bendR = 0.55;
        legs = [
          [-0.08, -0.05, 0.12, 0],
          [kick ? 0.55 + Math.sin(this.phase) * 0.5 : 0.18, 0.05, kick ? 0.25 + 0.45 * Math.max(0, -Math.cos(this.phase)) : 0.1, 0],
        ];
      } else {
        // Astride an animal, hands forward on the reins (or its neck), going
        // up and down with it, more the faster it goes; or sat in a seat.
        const k = Math.min(1, speed / 8);
        this.phase += dt * (speed > 0.4 ? 5 + speed * 1.2 : 0);
        // Hips where a kid's would be, longer legs reaching further down its sides.
        bob = Math.abs(Math.sin(this.phase)) * (0.015 + k * 0.06) - (B.hip - RIDE_HIPS);
        lean = 0.1 + k * 0.15;
        armFwdL = armFwdR = -0.55 - Math.sin(this.phase) * 0.12 * k;
        armRaiseL = armRaiseR = 0.15;
        bendL = bendR = 0.85;
        // The legs reach round the animal's sides and a little forward, the
        // shins hanging down its sides; on a wide back, or in a seat, out
        // in front with the knees bent over.
        const spread = this.ride?.spread ?? 0.85;
        const reach = this.ride?.reach ?? 0.35;
        const knee = Math.max(1, reach);
        legs = [[-reach, -spread, knee, spread * 0.75], [-reach, spread, knee, -spread * 0.75]];
      }
    } else {
      bob = Math.sin(t * 2) * 0.006;
      armRaiseL = armRaiseR = REST_RAISE + Math.sin(t * 2) * 0.015;
    }

    // Emotes play over the pose for a few seconds. With a toy weapon in the
    // right hand, the left one waves and goes to your heart or your tummy,
    // the weapon kept down at your side; arms up, it points up along the arm.
    let hop = 0;
    const armed = Boolean(this.weapon);
    if (this.emote) {
      const e = t - this.emoteAt;
      const done = e > (this.emote === 'dance' ? 3.2 : 2.2);
      if (done) this.emote = null;
      else {
        switch (this.emote) {
          case 'wave':
            if (armed) {
              armRaiseL = 2.55;
              armFwdL = Math.sin(e * 12) * 0.3;
              bendL = 0.45;
              headTilt = -0.15;
              break;
            }
            armRaiseR = 2.55;
            armFwdR = Math.sin(e * 12) * 0.3;
            bendR = 0.45;
            headTilt = 0.15;
            break;
          case 'dance':
            spin = e * Math.PI * 1.3;
            hop = Math.abs(Math.sin(e * 7)) * 0.12;
            armRaiseL = 2.2 + Math.sin(e * 7) * 0.5;
            armRaiseR = 2.2 - Math.sin(e * 7) * 0.5;
            bendL = bendR = 0.5;
            legSwing = Math.sin(e * 7) * 0.4;
            kneeBendL = 0.25 + 0.3 * Math.max(0, Math.sin(e * 7));
            kneeBendR = 0.25 + 0.3 * Math.max(0, -Math.sin(e * 7));
            break;
          case 'cheer':
            armRaiseL = armRaiseR = 2.7;
            bendL = bendR = 0.2;
            hop = Math.max(0, Math.sin(e * 6)) * 0.3;
            break;
          case 'hearts':
            // Hands together over the heart.
            headTilt = Math.sin(e * 3) * 0.2;
            armFwdL = -0.55;
            armRaiseL = -0.28;
            bendL = 1.65;
            if (armed) break;
            armFwdR = -0.55;
            armRaiseR = -0.28;
            bendR = 1.65;
            break;
          case 'clap': {
            const c = Math.abs(Math.sin(e * 10));
            armFwdL = -0.85;
            armRaiseL = -0.3 * c - 0.02;
            bendL = 0.95;
            if (armed) break;
            armFwdR = -0.85;
            armRaiseR = -0.3 * c - 0.02;
            bendR = 0.95;
            break;
          }
          case 'sleepy':
            headTilt = 0.35;
            headNod = 0.25 + Math.sin(e * 2) * 0.05;
            break;
          case 'laugh':
            // Head back, hands on your tummy, shaking with it.
            headNod = -0.3;
            bob = Math.abs(Math.sin(e * 16)) * 0.03;
            armFwdL = -0.35;
            armRaiseL = -0.12;
            bendL = 1.5;
            if (armed) break;
            armFwdR = -0.35;
            armRaiseR = -0.12;
            bendR = 1.5;
            break;
          case 'surprise':
            hop = Math.max(0, Math.sin(Math.min(e, 0.6) * 5.2)) * 0.18;
            armRaiseL = armRaiseR = 0.9;
            bendL = bendR = 1.3;
            headNod = -0.2;
            break;
          default:
            break;
        }
      }
    }

    // A swing (see SWINGS), over whatever the avatar is doing: the arms blend
    // into it and back out, the shoulders twist, it leans in and steps in.
    let dip = 0;
    let step = 0;
    let wrist = 0;
    const swing = SWINGS[this.weaponKind] ?? SWINGS.punch;
    const swung = t - (this.swingAt ?? -Infinity);
    if (swung < swing.secs) {
      const p = swingPose(swing, swung / swing.secs);
      // The walking arm swing fades out while it swings.
      armFwdR = armFwdR + (p.fwd + armSwing - armFwdR) * p.w;
      armRaiseR = armRaiseR + (p.raise - armRaiseR) * p.w;
      bendR = bendR + (p.elbow - bendR) * p.w;
      wrist = p.wrist * p.w;
      if (p.wL) {
        armFwdL = armFwdL + (p.fwdL - armSwing - armFwdL) * p.wL;
        armRaiseL = armRaiseL + (p.raiseL - armRaiseL) * p.wL;
        bendL = bendL + (p.elbowL - bendL) * p.wL;
      }
      twist += p.twist;
      lean += p.lean;
      dip = p.dip;
      headNod += p.nod;
      step = p.step;
    }

    const curled = anim === ANIM.curl;
    const sitting = anim === ANIM.sit || anim === ANIM.piano || anim === ANIM.type || anim === ANIM.coffee || curled;
    if ((anim === ANIM.piano) !== (this.bench.parent === this.root)) {
      if (anim === ANIM.piano) this.root.add(this.bench);
      else this.bench.removeFromParent();
    }
    this.playHands(anim === ANIM.piano, lean, [armFwdL, armFwdR], [bendL, bendR], t);
    this.holdMug(anim === ANIM.coffee, lean);
    const lying = anim === ANIM.lie;
    if (legs) {
      legL.rotation.set(legs[0][0], 0, legs[0][1]);
      legR.rotation.set(legs[1][0], 0, legs[1][1]);
      kneeL.rotation.set(legs[0][2], 0, legs[0][3]);
      kneeR.rotation.set(legs[1][2], 0, legs[1][3]);
    } else {
      // A step in to swing only standing; walking, the legs are busy.
      const stepIn = anim === ANIM.idle ? step : 0;
      legL.rotation.set(legSwing - stepIn, 0, 0);
      legR.rotation.set(-legSwing + stepIn * 0.6, 0, 0);
      kneeL.rotation.set(kneeBendL + stepIn * 0.3, 0, 0);
      kneeR.rotation.set(kneeBendR, 0, 0);
    }
    if (anim === ANIM.dizzy || sitting || lying || riding) {
      // Emotes play with the arms and the head, but nobody spins or hops
      // out of a seat, a bed or the saddle, or sitting dizzy.
      spin = 0;
      hop = 0;
    }
    // The arms hang from mirrored shoulders, so each side opens outward with
    // its own sign; the elbows bend the forearms forward.
    armL.rotation.set(armSwing + armFwdL, 0, -armRaiseL);
    armR.rotation.set(-armSwing + armFwdR, armTwistR, armRaiseR);
    elbowL.rotation.x = -bendL;
    elbowR.rotation.x = -bendR;
    this.body.position.y = bob + hop + dip;
    // In bed, the whole of you tips back about your feet, face up, and sinks
    // to lie on your back.
    this.body.rotation.set(lying || curled ? -Math.PI / 2 : 0, curled ? Math.PI / 2 : spin, 0);
    this.body.position.x = 0;
    this.body.position.z = 0;
    this.body.scale.setScalar(1);
    if (lying) this.body.position.y += this.lieLift;
    // Skates stand you up on their wheels, which roll as you go (not in a
    // seat, a bed or the water).
    else if (this.skateLift && !sitting && !curled && !riding && anim !== ANIM.swim) {
      this.body.position.y += this.skateLift;
      const roll = (speed * dt) / (WHEEL_R * B.foot);
      if (anim !== ANIM.air && anim !== ANIM.fly) for (const w of this.wheels) w.rotation.x += roll;
    }
    this.torso.rotation.set(lean, twist, 0);
    // What is in hand keeps the angle it would have with the arm straight;
    // with the arm raised high in an emote it turns to point up along it.
    if (this.weapon) {
      const held = Math.PI / 2 + wrist + bendR;
      const up = this.emote ? Math.max(0, Math.min(1, (armRaiseR - 1.3) / 1.0)) : 0;
      this.weapon.rotation.x = held + (Math.PI - held) * up;
    }
    // The head keeps looking ahead as the shoulders turn.
    this.head.rotation.set(headNod, -twist * 0.8, headTilt);
    if (this.tail) this.tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.3;
    // A cape (or a scarf's end) flies out behind as you go: a little
    // walking, a lot running, swimming, flying or in the air; a robe is
    // heavier.
    if (this.outfit) {
      const { part, flap, rest } = this.outfit;
      const out = running ? 1 : moving ? 0.45 : anim === ANIM.fly || anim === ANIM.air || anim === ANIM.swim ? 1.3 : 0;
      const target = rest + flap * out + (out ? Math.sin(t * 9) * 0.05 * flap : Math.sin(t * 1.6) * 0.02);
      part.rotation.x += (target - part.rotation.x) * Math.min(1, dt * 8);
    }
    // A ponytail swings to and fro, pigtails from side to side; more on the move.
    // Wings beat flying and stir standing; a jet pack blazes flying, rocket
    // boots running or flying, and both only flicker otherwise.
    const flying = anim === ANIM.fly;
    if (this.wings) {
      const w = this.wings;
      const beat = flying ? Math.sin(t * w.flaps) * 0.55 - 0.15 : Math.sin(t * 2) * 0.06;
      w.sides.forEach((wing, i) => (wing.rotation.y = (i ? 1 : -1) * (w.sweep + beat)));
      for (const f of w.flames) {
        f.visible = flying;
        if (flying) f.scale.setScalar(1 + Math.sin(t * 40 + f.position.x * 50) * 0.15);
      }
    }
    const blaze = flying ? 1 : Math.min(1, Math.max(0, (speed - 4) / 4));
    for (const f of this.flames) {
      f.visible = blaze > 0.05;
      f.scale.setScalar(Math.max(0.001, blaze * (1 + Math.sin(t * 45 + f.position.x * 60) * 0.18)));
    }
    for (const b of this.sway) {
      const { side, rest } = b.userData;
      const swing = Math.sin(t * (moving ? 9 : 2.2) + side) * (moving ? 0.2 : 0.05);
      if (side) b.rotation.z = rest + swing * side;
      else b.rotation.x = rest + swing;
    }
    if (curled) {
      // Curled up on your side (turned a quarter round, then tipped back),
      // shrunk to fit the bed and moved so all of you is in the middle of it:
      // measured once the whole pose is set.
      const fit = (this.curlFit ??= this.measureCurl());
      this.body.scale.setScalar(fit.scale);
      this.body.position.set(fit.x, fit.y, fit.z);
    }
    // Blink now and then: a person's lids come down, an animal's eyes squeeze shut.
    if (this.eyes) {
      this.blinkAt -= dt;
      const closed = this.blinkAt < 0.12 || this.emote === 'sleepy' || this.emote === 'laugh' || ((lying || curled) && !this.emote);
      if (this.lidShut) this.eyes.rotation.x = closed ? this.lidShut : 0;
      else this.eyes.scale.y = closed ? 0.12 : 1;
      if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 3;
    }
  }

  // At the piano, the jointed playing hands in place of the resting ones
  // (and whatever is in hand put away), there only while playing so nothing
  // measuring you counts them otherwise: each held palm down, level with
  // the keys whatever the arm does, the fingers arched over them; the
  // finger that struck last pushes down into its key and springs back, the
  // others lifting a little, and between notes they ripple.
  playHands(playing, lean, fwd, bend, t) {
    if (playing !== this.handsPlaying) {
      this.handsPlaying = playing;
      for (const hand of this.hands) {
        const { rest, piano } = hand.userData;
        if (playing) {
          rest.removeFromParent();
          hand.add(piano.group);
        } else {
          piano.group.removeFromParent();
          hand.add(rest);
        }
      }
      if (this.weapon) {
        if (playing) this.weapon.removeFromParent();
        else this.hands[1].add(this.weapon);
      }
    }
    if (!playing) return;
    // The arms are this.keys' other way round: arms[1] (+x) plays the low keys.
    for (let i = 0; i < 2; i++) {
      const { group, fingers, thumb } = this.hands[i].userData.piano;
      const k = this.keys[1 - i];
      // Pitched so its fingers point forward and a little down, wherever the
      // forearm points (the torso's lean, the shoulder, the elbow).
      group.rotation.x = -(Math.PI / 2 - 0.2) - (lean + fwd[i] - bend[i]);
      const since = t - k.at;
      const strike = Math.max(0, 1 - since / 0.22) ** 1.5;
      const busy = since < 1.5;
      for (let f = 0; f < 5; f++) {
        const struck = f === k.finger ? strike : 0;
        const ripple = busy ? Math.sin(t * 9 + f * 1.3 + i) * 0.08 : 0;
        // The struck finger pushes down from the knuckle, its end
        // straightening a little to press the key rather than curl back.
        const curl = 0.55 + ripple + struck * 0.5 - (f !== k.finger ? strike * 0.15 : 0);
        if (f === 0) {
          thumb.rotation.x = 0.9 + ripple * 0.5 + struck * 0.5;
          continue;
        }
        fingers[f - 1].knuckle.rotation.x = curl;
        fingers[f - 1].joint.rotation.x = 0.97 + ripple * 0.4 - struck * 0.35;
      }
    }
  }

  // On a coffee break, a mug held in front of the chest, and lifted to the
  // lips for a sip (this.sip, 0 to 1), tipping up as you drink: it is
  // placed on the torso, kept upright against its lean, and the right hand
  // reaches round it (mugGrip, reachTo); a weapon is put away meanwhile.
  holdMug(holding, lean) {
    if (holding !== (this.mug?.parent === this.torso)) {
      if (holding) {
        this.mug ??= coffeeMug(this.build.hand);
        this.torso.add(this.mug);
        this.weapon?.removeFromParent();
      } else {
        this.mug.removeFromParent();
        if (this.weapon && !this.handsPlaying) this.hands[1].add(this.weapon);
      }
    }
    if (!holding) return;
    this.mug.position.fromArray(this.mugAt(this.sip));
    this.mug.rotation.x = -lean - Math.max(0, this.sip - 0.5) * 1.6;
  }

  // Where the mug is, on the torso: before the chest, at the lips, or on its way between.
  mugAt(sip) {
    const B = this.build;
    const k = B.arm[0] / 0.3;
    const h = B.hand;
    const held = [0.04 * k, B.shoulder[0] * 0.6, 0.19 * k];
    const lips = [0, this.head.position.y + 0.05 - MUG_H * h * 0.2, 0.1 + MUG_R * h * 1.4];
    // Brought up in an arc, out clear of the chest on the way.
    const at = held.map((v, i) => v + (lips[i] - v) * sip);
    at[2] += Math.sin(sip * Math.PI) * 0.05 * k;
    return at;
  }

  // Where the right wrist is to hold it: beside it, on the handle's side.
  mugGrip(sip) {
    const k = this.build.arm[0] / 0.3;
    const [x, y, z] = this.mugAt(sip);
    return [x + MUG_R * this.build.hand + 0.03 * k, y - 0.05 * k, z - 0.005];
  }

  // The right arm's angles to put its wrist at a point on the torso: [the
  // shoulder's forward swing, the upper arm's turn about its length, its
  // raise out to the side, the elbow's bend], with the elbow kept down and
  // out as it would be. Two bones: the elbow is on the circle of points
  // the upper arm's length from the shoulder and the forearm's from the
  // wrist, the one nearest down and out; the shoulder's swing and raise
  // point the upper arm at it, and its turn and the elbow's bend the
  // forearm on to the wrist (the arm's rotation order is XZY).
  reachTo(at) {
    const B = this.build;
    const [a, b] = B.arm;
    const v = new THREE.Vector3(at[0] - B.shoulder[1], at[1] - B.shoulder[0], at[2]);
    const d = THREE.MathUtils.clamp(v.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
    const n = v.clone().normalize();
    const c = (a * a - b * b + d * d) / (2 * d);
    const rho = Math.sqrt(Math.max(0, a * a - c * c));
    const w = new THREE.Vector3(0.45, -1, -0.15);
    w.addScaledVector(n, -w.dot(n)).normalize();
    const elbow = n.clone().multiplyScalar(c).addScaledVector(w, rho);
    const u = elbow.clone().divideScalar(a);
    const raise = Math.asin(THREE.MathUtils.clamp(u.x, -1, 1));
    const fwd = Math.atan2(-u.z, -u.y);
    // The forearm, back in the upper arm's own frame.
    const f = n.multiplyScalar(d).sub(elbow).divideScalar(b);
    const [ca, sa, cr, sr] = [Math.cos(fwd), Math.sin(fwd), Math.cos(raise), Math.sin(raise)];
    const fy = f.y * ca + f.z * sa;
    const fz = -f.y * sa + f.z * ca;
    const lx = f.x * cr + fy * sr;
    const ly = -f.x * sr + fy * cr;
    const bend = Math.acos(THREE.MathUtils.clamp(-ly, -1, 1));
    return [fwd, Math.atan2(lx, fz), raise, bend];
  }

  // How the curled-up pose (already set on the body, at full size) has to be
  // shrunk and moved to fit CURL_ROOM, centred on the root and resting on it.
  measureCurl() {
    const { root } = this;
    const [p, r] = [root.position.clone(), root.rotation.clone()];
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.scale.setScalar(1);
    root.updateMatrixWorld(true);
    // Only what shows: a weapon put away or a hidden hat does not count.
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    const visit = (o) => {
      if (!o.visible) return;
      if (o.isMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      }
      for (const c of o.children) visit(c);
    };
    visit(this.body);
    root.position.copy(p);
    root.rotation.copy(r);
    root.updateMatrixWorld(true);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.min(1, CURL_ROOM.long / size.z, CURL_ROOM.wide / size.x);
    const mid = box.getCenter(new THREE.Vector3());
    return { scale, x: -mid.x * scale, y: -box.min.y * scale, z: -mid.z * scale };
  }

  dispose() {
    this.root.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

export const shirtHex = (index) => shirtColor(index);
export const brickIdForShirt = (index) => TOY_BRICKS[index];
