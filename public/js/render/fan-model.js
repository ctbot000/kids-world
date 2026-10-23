// Fans as real ones look (blocks.js ELECTRIC_FAN, CEILING_FAN), not made of
// boxes, their blades going round.
//
// An electric fan: a round mint base and a white pole up to its head — a
// motor at the back, a cage of chrome wires and in it five see-through mint
// blades round a hub — the head sweeping slowly from side to side. A
// ceiling fan: a white rod down from the ceiling to a white motor, four
// wooden blades going round under it and a frosted bowl of light below.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js). What goes
// round is in group.userData.spin ({ part, speed } each, turning about its
// own z for the electric fan's blades and y for the ceiling fan's), and
// what sweeps in group.userData.sway; render/terrain.js turns them.
import * as THREE from '../../vendor/three.module.js';
import { at, bake, lathe } from './gashapon-model.js';

// How each part takes the light: three's physical material settings.
export const FAN_FINISH = {
  mint: { color: '#7fd8c4', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9 },
  white: { color: '#fbf8f1', roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.8 },
  chrome: { color: '#e9edf2', metalness: 1, roughness: 0.18, envMapIntensity: 1.25 },
  blade: { color: '#a6ecdc', roughness: 0.15, clearcoat: 1, envMapIntensity: 1, transparent: true, opacity: 0.72, side: THREE.DoubleSide },
  wood: { color: '#b9784a', roughness: 0.55, clearcoat: 0.3, envMapIntensity: 0.6, side: THREE.DoubleSide },
  brass: { color: '#e0b04c', metalness: 1, roughness: 0.25, envMapIntensity: 1.1 },
  // The bowl of light is never lit itself: it is the light.
  bulb: { basic: true, color: '#fff3c4' },
};

// Materials for every part, each made by `make` from its settings.
export function fanMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(FAN_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  return out;
}

// The electric fan's measures: its head turns about the top of the pole,
// and its blades about the middle of the cage, which faces -z.
export const HEAD = { y: 0.6 };
export const CAGE = { y: 0.74, z: -0.06, r: 0.27 };

// A turn about one axis.
const turn = (axis, a) => new THREE.Matrix4()[`makeRotation${axis.toUpperCase()}`](a);
const cyl = (r0, r1, h, segs = 20) => new THREE.CylinderGeometry(r0, r1, h, segs);
// A blade: a flattened egg, `len` long out along +y from the middle, tilted
// about its length to push the air.
const bladeShape = (w, len, thick) => {
  const g = new THREE.SphereGeometry(1, 16, 10);
  g.scale(w, len / 2, thick);
  g.translate(0, len / 2, 0);
  return g;
};

const shapes = {};

function electricShapes() {
  if (shapes.electric) return shapes.electric;
  const parts = { mint: [], white: [], chrome: [] };
  const head = { mint: [], white: [], chrome: [] };
  const rotor = { blade: [], mint: [] };
  // The base, a low round dome, a button on its front, and the pole.
  parts.mint.push({ g: lathe([[0, 0], [0.2, 0], [0.21, 0.02], [0.19, 0.05], [0.12, 0.075], [0, 0.08]]), m: at(0, 0, 0.02) });
  parts.white.push({ g: cyl(0.025, 0.025, 0.02, 12), m: at(0, 0.06, -0.12, Math.PI / 2 + 0.6) });
  parts.white.push({ g: cyl(0.022, 0.026, HEAD.y - 0.06), m: at(0, (HEAD.y + 0.06) / 2, 0.02) });
  parts.chrome.push({ g: cyl(0.03, 0.03, 0.04), m: at(0, HEAD.y, 0.02) });
  // The head, laid out round the top of the pole: a neck up to the motor,
  // the motor along z behind the cage, and the cage.
  const y = CAGE.y - HEAD.y;
  head.white.push({ g: cyl(0.02, 0.02, y), m: at(0, y / 2, 0.06) });
  head.mint.push({ g: lathe([[0, -0.07], [0.07, -0.065], [0.085, -0.02], [0.08, 0.05], [0.05, 0.09], [0, 0.1]]), m: at(0, y, 0.06, Math.PI / 2) });
  head.chrome.push({ g: cyl(0.015, 0.015, 0.06, 10), m: at(0, y, 0, Math.PI / 2) });
  // The cage: a rim round it, rings in front and behind, wires out from a
  // badge in the middle of its front and across its back.
  const { r, z } = CAGE;
  head.chrome.push({ g: new THREE.TorusGeometry(r, 0.012, 8, 48), m: at(0, y, z) });
  for (const [k, dz] of [[0.6, -0.07], [0.3, -0.085], [0.65, 0.05], [0.35, 0.06]]) head.chrome.push({ g: new THREE.TorusGeometry(r * k, 0.005, 6, 40), m: at(0, y, z + dz) });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    // Each wire a bow from the badge out to the rim, front and back.
    for (const [depth, sign] of [[0.09, -1], [0.07, 1]]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, sign * depth),
        new THREE.Vector3(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, sign * depth * 0.9),
        new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0),
      );
      head.chrome.push({ g: new THREE.TubeGeometry(curve, 8, 0.004, 4), m: at(0, y, z) });
    }
  }
  head.mint.push({ g: cyl(0.045, 0.045, 0.012, 24), m: at(0, y, z - 0.095, Math.PI / 2) });
  head.white.push({ g: cyl(0.028, 0.028, 0.014, 20), m: at(0, y, z - 0.098, Math.PI / 2) });
  // Five blades round a hub, each pitched, in the rotor's own layout.
  rotor.mint.push({ g: lathe([[0, -0.03], [0.05, -0.025], [0.055, 0.01], [0, 0.03]]), m: at(0, 0, 0, -Math.PI / 2) });
  for (let i = 0; i < 5; i++) rotor.blade.push({ g: bladeShape(0.085, 0.2, 0.008), m: turn('z', (i / 5) * Math.PI * 2).multiply(turn('y', 0.35)).multiply(at(0, 0.035, 0)) });
  const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l)]));
  shapes.electric = { body: baked(parts), head: baked(head), rotor: baked(rotor) };
  return shapes.electric;
}

function ceilingShapes() {
  if (shapes.ceiling) return shapes.ceiling;
  const parts = { white: [], brass: [], bulb: [] };
  const rotor = { white: [], wood: [], brass: [] };
  // A cup on the ceiling, a rod down and the motor's housing.
  parts.white.push({ g: lathe([[0, 1], [0.08, 1], [0.07, 0.97], [0.03, 0.95], [0, 0.95]]) });
  parts.brass.push({ g: cyl(0.014, 0.014, 0.2, 10), m: at(0, 0.86, 0) });
  // The bowl of light under the blades, and a brass pull chain.
  parts.bulb.push({ g: lathe([[0, 0.5], [0.06, 0.505], [0.095, 0.53], [0.1, 0.58], [0, 0.58]]) });
  parts.brass.push({ g: cyl(0.004, 0.004, 0.08, 6), m: at(0.03, 0.46, 0) });
  parts.brass.push({ g: new THREE.SphereGeometry(0.01, 8, 6), m: at(0.03, 0.42, 0) });
  // What goes round: the motor, four brass arms and the wooden blades.
  rotor.white.push({ g: lathe([[0, 0.58], [0.1, 0.59], [0.12, 0.64], [0.1, 0.72], [0.05, 0.76], [0, 0.77]]) });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    rotor.brass.push({ g: new THREE.BoxGeometry(0.16, 0.012, 0.04), m: at(Math.cos(a) * 0.16, 0.64, Math.sin(a) * 0.16, 0, -a, 0) });
    const blade = new THREE.BoxGeometry(0.46, 0.012, 0.12);
    blade.translate(0.23, 0, 0);
    rotor.wood.push({ g: blade, m: at(Math.cos(a) * 0.2, 0.632, Math.sin(a) * 0.2, 0, -a, 0).multiply(turn('x', 0.15)) });
  }
  const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l.map(({ g, m }) => ({ g, m: m ?? new THREE.Matrix4() })))]));
  shapes.ceiling = { body: baked(parts), rotor: baked(rotor) };
  return shapes.ceiling;
}

const meshes = (target, list, materials) => {
  for (const [k, g] of Object.entries(list)) {
    const m = new THREE.Mesh(g, materials[k]);
    if (k === 'blade') m.renderOrder = 1;
    m.userData.shared = true;
    target.add(m);
  }
};

// A whole fan, `kind` 'electric-fan' or 'ceiling-fan', in the materials
// given (fanMaterials).
export function fanModel(materials, kind = 'electric-fan') {
  const group = new THREE.Group();
  group.name = kind;
  const rotor = new THREE.Group();
  if (kind === 'ceiling-fan') {
    const s = ceilingShapes();
    meshes(group, s.body, materials);
    meshes(rotor, s.rotor, materials);
    group.add(rotor);
    group.userData.spin = [{ part: rotor, axis: 'y', speed: 5 }];
    return group;
  }
  const s = electricShapes();
  meshes(group, s.body, materials);
  const head = new THREE.Group();
  head.position.set(0, HEAD.y, 0);
  meshes(head, s.head, materials);
  rotor.position.set(0, CAGE.y - HEAD.y, CAGE.z);
  meshes(rotor, s.rotor, materials);
  head.add(rotor);
  group.add(head);
  group.userData.spin = [{ part: rotor, axis: 'z', speed: -14 }];
  group.userData.sway = head;
  return group;
}

// How far a fan's head has swept at `time`, from straight ahead: slowly
// out to either side and back, about a quarter of a turn across in all.
export const swayAt = (time) => Math.sin(time * 0.45) * 0.7;
