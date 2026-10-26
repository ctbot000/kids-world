// A rocking chair as a real one looks (blocks.js ROCKING_CHAIR), not made of
// boxes: a wooden chair with a slatted back and two arms, standing on two
// curved runners. While someone sits in it the whole chair tips slowly back
// and forth about the middle of its rockers, and whoever is in it leans with
// it (game.js tilts them by the same amount at the same time).
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js). How far it has
// rocked at a time is rockingAt(time); render/terrain.js turns what rocks,
// in group.userData.rock, and stands it straight when nobody is in it.
import * as THREE from '../../vendor/three.module.js';
import { at, bake } from './gashapon-model.js';

// How each part takes the light: three's physical material settings.
export const ROCKING_FINISH = {
  wood: { color: '#c98a52', roughness: 0.55, clearcoat: 0.3, envMapIntensity: 0.6 },
  dark: { color: '#8b5a3c', roughness: 0.6, clearcoat: 0.25, envMapIntensity: 0.55 },
  cushion: { color: '#e8453c', roughness: 0.85, envMapIntensity: 0.4 },
};

// Materials for every part, each made by `make` from its settings.
export function rockingMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(ROCKING_FINISH)) out[k] = make(f);
  return out;
}

// How high the seat is (as shared/seats.js has it) and where the chair rocks
// about: the middle of its rockers, just above the floor.
export const SEAT = { y: 0.56, pivot: 0.05 };

// How far the chair has rocked at `time`, from sitting up straight: out to
// about twelve degrees back and a little less forward, a whole sway taking
// about four seconds, and resting a touch back when it is in the middle of
// one (so it comes to rest upright, where nobody is in it).
export const rockingAt = (time) => Math.sin(time * 1.6) * 0.2 + 0.02;

// Each chair rocks at a time of its own, so two beside each other are not in
// step: this is the offset of the cell it stands in (render/terrain.js gives
// every mover one like it, and game.js leans whoever is in it by the same).
export const rockPhase = (x, y, z) => (x * 7.3 + z * 3.1 + y) % 10;

const shapes = {};

// A runner: a shallow curve of wood from the front of the cell to its back,
// lowest in the middle (where the chair rocks) and bent up at each end so it
// cannot catch on the floor, drawn as a tube along that curve.
function runner() {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const z = -0.42 + t * 0.84;
    const y = 0.04 + 0.08 * Math.pow(Math.abs(2 * t - 1), 2.5);
    pts.push(new THREE.Vector3(0, y, z));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 6);
}

function chairShapes() {
  if (shapes.chair) return shapes.chair;
  const rocking = { wood: [], dark: [], cushion: [] };
  const onSeat = { wood: [] };
  // The two runners, each across the cell a little in from its sides.
  for (const x of [-0.28, 0.28]) rocking.dark.push({ g: runner(), m: at(x, 0, 0) });
  // Four legs up from the runners to the seat, two at the front and two at
  // the back.
  for (const x of [-0.26, 0.26]) {
    for (const z of [-0.26, 0.22]) rocking.wood.push({ g: new THREE.BoxGeometry(0.07, SEAT.y - 0.08, 0.07), m: at(x, (SEAT.y + 0.08) / 2, z) });
  }
  // The seat, and a cushion on it.
  rocking.wood.push({ g: new THREE.BoxGeometry(0.66, 0.06, 0.62), m: at(0, SEAT.y - 0.03, 0.02) });
  rocking.cushion.push({ g: new THREE.BoxGeometry(0.56, 0.05, 0.52), m: at(0, SEAT.y + 0.005, 0.03) });
  // The back, two uprights and three slats between them, and the two arms, a
  // post up at the front of the seat and a rail back from it: all standing on
  // the seat, laid out in the seat's own frame (where they are leaned back).
  for (const x of [-0.27, 0.27]) onSeat.wood.push({ g: new THREE.BoxGeometry(0.07, 0.38, 0.06), m: at(x, 0.19, 0) });
  for (const y of [0.06, 0.19, 0.32]) onSeat.wood.push({ g: new THREE.BoxGeometry(0.52, 0.1, 0.04), m: at(0, y, 0) });
  for (const x of [-0.33, 0.33]) {
    onSeat.wood.push({ g: new THREE.BoxGeometry(0.06, 0.2, 0.06), m: at(x, 0.1, -0.24) });
    onSeat.wood.push({ g: new THREE.BoxGeometry(0.07, 0.05, 0.5), m: at(x, 0.2, 0) });
  }
  const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l)]));
  shapes.chair = { rocking: baked(rocking), onSeat: baked(onSeat) };
  return shapes.chair;
}

// A whole rocking chair in the materials given (rockingMaterials). What rocks
// is group.userData.rock, turned about the middle of its rockers (x), with
// the back and arms riding on the seat; render/terrain.js turns it by
// rockingAt, and game.js leans whoever is in it by the same.
export function rockingModel(materials) {
  const group = new THREE.Group();
  group.name = 'rocking-chair';
  const s = chairShapes();
  const rock = new THREE.Group();
  rock.position.set(0, SEAT.pivot, 0);
  for (const [k, g] of Object.entries(s.rocking)) {
    const mesh = new THREE.Mesh(g, materials[k]);
    mesh.userData.shared = true;
    rock.add(mesh);
  }
  // The back and arms lean back a little from straight up, at the back of the
  // seat and its height, so they ride along with the rock.
  const seat = new THREE.Group();
  seat.position.set(0, SEAT.y - SEAT.pivot, 0.24);
  seat.rotation.x = -0.18;
  for (const [k, g] of Object.entries(s.onSeat)) {
    const mesh = new THREE.Mesh(g, materials[k]);
    mesh.userData.shared = true;
    seat.add(mesh);
  }
  rock.add(seat);
  group.add(rock);
  group.userData.rock = rock;
  return group;
}
