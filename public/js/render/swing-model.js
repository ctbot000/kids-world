// A swing set as a real one looks (blocks.js SWING_SET), not made of boxes:
// an A-frame of wooden legs at each end holding up a top bar, with two seats
// on chains hanging from it. Whoever sits on one swings gently back and forth
// (game.js), and tapping jump in time as they swing forward pumps them higher
// and higher, up to almost level with the top bar.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js): the swing hangs
// along z, so you swing the way you face. render/terrain.js turns what
// swings, in group.userData.seats, and stands them at rest when nobody is in
// them (game.js keeps the height each one has been pumped to).
import * as THREE from '../../vendor/three.module.js';
import { at, bake } from './gashapon-model.js';

// How each part takes the light: three's physical material settings.
export const SWING_FINISH = {
  wood: { color: '#c98a52', roughness: 0.55, clearcoat: 0.3, envMapIntensity: 0.6 },
  dark: { color: '#8b5a3c', roughness: 0.6, clearcoat: 0.25, envMapIntensity: 0.55 },
  steel: { color: '#c9ced6', metalness: 0.85, roughness: 0.3, envMapIntensity: 0.9 },
  seat: { color: '#e8453c', roughness: 0.8, envMapIntensity: 0.4 },
};

// Materials for every part, each made by `make` from its settings.
export function swingMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(SWING_FINISH)) out[k] = make(f);
  return out;
}

// How high the seats hang at rest (as shared/seats.js has it, half a block up
// on chains just over half a block long) and how high the top bar is: about
// level with the top of a cell, so a swing pumped as far as it goes brings
// you up almost to it.
export const SEAT = { y: 0.5, bar: 0.9, chains: 0.44, spread: 0.42 };

// Where each of the two seats hangs, across the frame (as shared/seats.js has
// its spots: -0.2 and +0.2 about the middle).
export const SEAT_X = [-0.2, 0.2];

// How far a swing has swung at a time, from hanging straight down. How high
// it goes is `amp`, an angle in radians kept by game.js for whoever is on it
// (0 at rest); a whole swing takes about two seconds whatever the height, as
// a real one does.
export const swingAt = (time, amp = 0) => Math.sin(time * Math.PI) * amp;

// The gentle swing of an empty seat, or one sat on with nobody pumping: the
// height you drop to left alone, over about one swing in three.
export const GENTLE = 0.14;
export const settle = (amp, dt) => amp + (GENTLE - amp) * Math.min(1, dt / 2.4);

// How much one well-timed tap of jump adds (a mistimed one less: game.js),
// and how far a swing can be pumped before it will go no higher.
export const PUMP = 0.16;
export const MOST = 1.35;

// Each swing set swings at a time of its own, so two beside each other are
// not in step: this is the offset of the cell it stands in (render/terrain.js
// gives every mover one like it, and game.js swings whoever is in it by the
// same).
export const swingPhase = (x, y, z) => (x * 5.7 + z * 4.3 + y * 1.7) % 4;

// Whoever sits on a swing swung by `a` (swingAt), facing `yaw` as the seat
// has them (shared/seats.js): how far they lean (an avatar's rotation.x, its
// rotation order YXZ), and how far their hips have moved with the seat (dx,
// dy, dz), as it swings about the top bar.
export function swungSitter(a, yaw) {
  const h = SEAT.chains;
  // The seat swings forward along the swing's own -z, the way you face.
  const forth = h * Math.sin(a);
  return { lean: -a * 0.6, dx: Math.sin(yaw) * forth, dy: h * (Math.cos(a) - 1), dz: Math.cos(yaw) * forth };
}

const shapes = {};

// A leg of the A-frame: a tube from its foot out at the cell's side and front
// or back, leaning in to the top of the bar.
function leg(x, z) {
  const pts = [
    new THREE.Vector3(x, 0.05, z),
    new THREE.Vector3(x * 0.55, SEAT.bar * 0.5, z * 0.55),
    new THREE.Vector3(0, SEAT.bar, 0),
  ];
  return { g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.045, 6), m: at(0, 0, 0) };
}

function frameShapes() {
  if (shapes.frame) return shapes.frame;
  const dark = [];
  const wood = [];
  // The top bar the seats hang from, reaching across the cell.
  wood.push({ g: new THREE.BoxGeometry(0.94, 0.07, 0.07), m: at(0, SEAT.bar, 0) });
  // At each end, two legs out to the front and the back of the cell, leaning
  // in to the top of the bar: an A-frame.
  for (const x of [-SEAT.spread - 0.03, SEAT.spread + 0.03]) {
    for (const z of [-0.34, 0.34]) dark.push(leg(x, z));
  }
  // A brace across each pair of legs, a little way up.
  for (const x of [-SEAT.spread - 0.03, SEAT.spread + 0.03]) {
    dark.push({ g: new THREE.BoxGeometry(0.06, 0.05, 0.5), m: at(x * 0.75, SEAT.bar * 0.45, 0) });
  }
  const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l)]));
  shapes.frame = baked({ dark, wood });
  return shapes.frame;
}

// The chains and seat of one swing, hanging from the top bar at `x` across.
// The parts are laid out from the bar down (the group they are baked into
// stands at the bar, and what swings is it, turned about the bar in x).
function seatShapes(x) {
  const key = `seat${x}`;
  if (shapes[key]) return shapes[key];
  const steel = [];
  const seat = [];
  // Two chains, one from each side of the seat up to the bar, drawn as thin
  // tubes so they read as chains at a distance.
  for (const cx of [x - 0.14, x + 0.14]) {
    steel.push({ g: new THREE.CylinderGeometry(0.012, 0.012, SEAT.chains, 5), m: at(cx, -SEAT.chains / 2, 0) });
  }
  // The seat itself: a board a little narrower than the chains are apart.
  seat.push({ g: new THREE.BoxGeometry(0.32, 0.05, 0.16), m: at(x, -SEAT.chains, 0) });
  const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l)]));
  shapes[key] = baked({ steel, seat });
  return shapes[key];
}

// A whole swing set in the materials given (swingMaterials). What swings is
// each of group.userData.seats, one per spot (as shared/seats.js has them),
// turned about the top bar (x); render/terrain.js turns them by swingAt and
// game.js tells it how high each one has been pumped to.
export function swingModel(materials) {
  const group = new THREE.Group();
  group.name = 'swing-set';
  for (const [k, g] of Object.entries(frameShapes())) {
    const mesh = new THREE.Mesh(g, materials[k]);
    mesh.userData.shared = true;
    group.add(mesh);
  }
  const seats = SEAT_X.map((x) => {
    const swing = new THREE.Group();
    swing.position.set(0, SEAT.bar, 0);
    for (const [k, g] of Object.entries(seatShapes(x))) {
      const mesh = new THREE.Mesh(g, materials[k]);
      mesh.userData.shared = true;
      swing.add(mesh);
    }
    group.add(swing);
    return swing;
  });
  group.userData.seats = seats;
  return group;
}
