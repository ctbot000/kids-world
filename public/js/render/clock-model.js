// Clocks as real ones look (blocks.js CUCKOO_CLOCK, TOWER_CLOCK), not made
// of boxes, their hands telling the island's time of day.
//
// A cuckoo clock: a little wooden house that hangs on the wall, a pointed
// roof with carved leaves, a round face, a pendulum swinging under it and
// two pinecone weights on chains; on the hour a little bird pops out of
// the door above the face. A tower clock: a stone block with a clock face
// on each of its four sides, for the top of a clock tower, its faces lit.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js); the cuckoo
// clock's back is against the wall at +z. What moves is done by
// group.userData.tick(time, day), day the island's time of day (0 is
// midnight, 0.5 noon), which render/terrain.js calls; the hour and minute
// hands of each face are in group.userData.hands.
import * as THREE from '../../vendor/three.module.js';
import { at, bake, roundedBox } from './gashapon-model.js';

// How each part takes the light: three's physical material settings.
export const CLOCK_FINISH = {
  wood: { color: '#9a6238', roughness: 0.5, clearcoat: 0.4, envMapIntensity: 0.6 },
  dark: { color: '#5e3a22', roughness: 0.55, clearcoat: 0.3, envMapIntensity: 0.5 },
  leaf: { color: '#3f9a4a', roughness: 0.45, clearcoat: 0.5, envMapIntensity: 0.6 },
  brass: { color: '#e0b04c', metalness: 1, roughness: 0.25, envMapIntensity: 1.1 },
  face: { color: '#fbf6e6', roughness: 0.4, clearcoat: 0.6, envMapIntensity: 0.6 },
  hand: { color: '#23252b', roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.8 },
  bird: { color: '#ffd23f', roughness: 0.35, clearcoat: 0.8, envMapIntensity: 0.8 },
  beak: { color: '#ff7a1a', roughness: 0.35, clearcoat: 0.8, envMapIntensity: 0.8 },
  stone: { color: '#eadcc0', roughness: 0.75, envMapIntensity: 0.5 },
  trim: { color: '#6c7a96', roughness: 0.45, clearcoat: 0.5, envMapIntensity: 0.6 },
  // A tower clock's faces are lit from inside: never lit themselves.
  lit: { basic: true, color: '#fff7dc' },
};

// Materials for every part, each made by `make` from its settings.
export function clockMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(CLOCK_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  return out;
}

// Where the hands point at a time of day: turns of the hour hand and the
// minute hand from twelve, clockwise.
export function handsAt(day) {
  const hours = ((((day % 1) + 1) % 1) * 24) % 12;
  return { hour: hours / 12, minute: hours % 1 };
}

// How far out the cuckoo is at a time of day, 0 to 1: it pops out on the
// hour, calls and goes back in.
export function cuckooAt(day) {
  const k = (((day % 1) + 1) % 1) * 24 % 1;
  const OUT = 0.05;
  if (k >= OUT) return 0;
  return Math.min(1, Math.sin((k / OUT) * Math.PI) * 2.5);
}

// The cuckoo clock's measures: its face and where the pendulum hangs from.
export const CUCKOO = { face: { y: 0.6, z: 0.336, r: 0.12 }, pivot: { y: 0.42, z: 0.36 }, rod: 0.24, door: { y: 0.79, z: 0.336 } };
// The tower clock's faces, out from the middle of each side.
export const TOWER = { y: 0.5, out: 0.478, r: 0.34 };

const cyl = (r0, r1, h, segs = 20) => new THREE.CylinderGeometry(r0, r1, h, segs);
const ball = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l.map(({ g, m }) => ({ g, m: m ?? new THREE.Matrix4() })))]));

// A hand, `len` long up from where it turns, with a little tail behind.
const handShape = (w, len, thick) => {
  const g = new THREE.BoxGeometry(w, len * 1.15, thick);
  g.translate(0, len * 0.425, 0);
  return g;
};

// A clock face's dial, facing -z at (x, y, z): a disc, a rim, the twelve
// marks (the quarters bigger) and the cap the hands turn on.
function dial(p, y, z, r, disc, rim) {
  p[disc].push({ g: cyl(r, r, 0.01, 40), m: at(0, y, z, Math.PI / 2) });
  p[rim].push({ g: new THREE.TorusGeometry(r, r * 0.08, 8, 40), m: at(0, y, z - 0.004, 0, 0, 0, 1, 1, 0.4) });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const big = i % 3 === 0;
    p.hand.push({ g: new THREE.BoxGeometry(r * (big ? 0.09 : 0.05), r * (big ? 0.2 : 0.12), 0.006), m: at(-Math.sin(a) * r * 0.78, y + Math.cos(a) * r * 0.78, z - 0.007, 0, 0, a) });
  }
  p.brass.push({ g: cyl(r * 0.08, r * 0.08, 0.012, 12), m: at(0, y, z - 0.016, Math.PI / 2) });
}

// The hour and minute hands of a face, in front of it at (0, y, z).
function hands(target, materials, y, z, r) {
  const out = [];
  for (const [w, len, dz] of [[0.09, 0.55, 0.009], [0.06, 0.82, 0.013]]) {
    const h = new THREE.Mesh(keep(`hand ${r} ${len}`, () => handShape(r * w, r * len, 0.004)), materials.hand);
    h.userData.shared = true;
    h.position.set(0, y, z - dz);
    target.add(h);
    out.push(h);
  }
  return out;
}

// Hands turned to a time of day. Seen from the front (-z), a turn about +z
// goes clockwise.
function setHands([hour, minute], day) {
  const t = handsAt(day);
  hour.rotation.z = t.hour * Math.PI * 2;
  minute.rotation.z = t.minute * Math.PI * 2;
  hour.updateMatrix();
  minute.updateMatrix();
}

// Shapes made once and shared by every clock, by name.
const kept = new Map();
const keep = (name, make) => kept.get(name) ?? kept.set(name, make()).get(name);

function cuckooBody() {
  return keep('cuckoo body', () => {
    const p = { wood: [], dark: [], leaf: [], brass: [], face: [], hand: [] };
    const { face, door } = CUCKOO;
    // The house, its back against the wall, a ledge under it.
    p.wood.push({ g: roundedBox(0.42, 0.42, 0.16, 0.015), m: at(0, 0.62, 0.42) });
    p.dark.push({ g: roundedBox(0.48, 0.035, 0.2, 0.01), m: at(0, 0.41, 0.4) });
    // The roof, two boards meeting over it, a carved bird on its peak.
    for (const s of [-1, 1]) p.dark.push({ g: roundedBox(0.32, 0.03, 0.2, 0.01), m: at(s * 0.115, 0.89, 0.4, 0, 0, -s * 0.62) });
    // The gable under it, a triangle.
    p.wood.push({ g: cyl(0.2425, 0.2425, 0.16, 3), m: at(0, 0.877, 0.42, -Math.PI / 2, 0, 0, 1, 1, 0.47) });
    p.dark.push({ g: ball(0.03, 10, 8), m: at(0, 0.97, 0.4, 0, 0, 0, 1, 0.8, 1.3) });
    // Carved leaves round the face, and a doorway with its frame above it.
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + (i / 6) * 2.4;
      p.leaf.push({ g: ball(0.03, 8, 6), m: at(Math.sin(a) * 0.17, 0.45 + Math.cos(a) * 0.05, 0.335, 0, 0, a, 1, 0.5, 0.3) });
    }
    for (const s of [-1, 1]) p.leaf.push({ g: ball(0.04, 8, 6), m: at(s * 0.19, 0.72, 0.335, 0, 0, s * 0.5, 0.5, 1, 0.3) });
    p.dark.push({ g: new THREE.BoxGeometry(0.09, 0.09, 0.01), m: at(0, door.y, door.z - 0.001) });
    dial(p, face.y, face.z, face.r, 'face', 'dark');
    return baked(p);
  });
}

// A pinecone weight on its chain, hanging from the bottom of the house.
function weight(p, x) {
  p.brass.push({ g: cyl(0.004, 0.004, 0.24, 6), m: at(x, 0.29, 0.44) });
  p.dark.push({ g: cyl(0.025, 0.012, 0.11, 10), m: at(x, 0.12, 0.44) });
  for (let i = 0; i < 4; i++) p.dark.push({ g: cyl(0.03 - i * 0.004, 0.026 - i * 0.004, 0.012, 10), m: at(x, 0.15 - i * 0.025, 0.44) });
}

function meshes(target, list, materials) {
  for (const [k, g] of Object.entries(list)) {
    const m = new THREE.Mesh(g, materials[k]);
    m.userData.shared = true;
    target.add(m);
  }
}

function cuckooClock(materials) {
  const group = new THREE.Group();
  meshes(group, cuckooBody(), materials);
  meshes(group, keep('cuckoo weights', () => {
    const p = { brass: [], dark: [] };
    for (const x of [-0.12, 0.12]) weight(p, x);
    return baked(p);
  }), materials);
  const { face, pivot, rod, door } = CUCKOO;
  const clockHands = hands(group, materials, face.y, face.z, face.r);
  // The pendulum: a rod down from under the house to a brass leaf.
  const pendulum = new THREE.Group();
  pendulum.position.set(0, pivot.y, pivot.z);
  meshes(pendulum, keep('cuckoo pendulum', () => baked({
    brass: [{ g: cyl(0.004, 0.004, rod, 6), m: at(0, -rod / 2, 0) }, { g: cyl(0.045, 0.045, 0.008, 20), m: at(0, -rod, 0, Math.PI / 2) }],
    leaf: [{ g: ball(0.022, 8, 6), m: at(0, -rod, -0.006, 0, 0, 0, 1, 1.3, 0.25) }],
  })), materials);
  group.add(pendulum);
  // The door, opening to its left, and the bird behind it.
  const doorPanel = new THREE.Group();
  doorPanel.position.set(-0.04, door.y, door.z - 0.01);
  const panel = new THREE.Mesh(keep('cuckoo door', () => {
    const g = new THREE.BoxGeometry(0.08, 0.08, 0.008);
    g.translate(0.04, 0, 0);
    return g;
  }), materials.wood);
  panel.userData.shared = true;
  doorPanel.add(panel);
  group.add(doorPanel);
  const bird = new THREE.Group();
  meshes(bird, keep('cuckoo bird', () => baked({
    bird: [{ g: ball(0.03, 12, 8), m: at(0, 0, 0.01, 0, 0, 0, 1, 0.9, 1.3) }, { g: ball(0.022, 10, 8), m: at(0, 0.03, -0.025) }, { g: new THREE.ConeGeometry(0.015, 0.04, 4), m: at(0, 0.005, 0.05, -Math.PI / 2 - 0.4, 0, 0, 1, 1, 0.3) }],
    beak: [{ g: new THREE.ConeGeometry(0.009, 0.025, 6), m: at(0, 0.028, -0.055, -Math.PI / 2) }],
    hand: [{ g: ball(0.005, 6, 4), m: at(0.016, 0.038, -0.035) }, { g: ball(0.005, 6, 4), m: at(-0.016, 0.038, -0.035) }],
  })), materials);
  group.add(bird);
  group.userData.bird = bird;
  group.userData.hands = [clockHands];
  group.userData.tick = (time, day = 0.5) => {
    setHands(clockHands, day);
    pendulum.rotation.z = Math.sin(time * Math.PI) * 0.28;
    pendulum.updateMatrix();
    // Out on the hour: the door swings open and the bird slides out,
    // bobbing as it calls.
    const out = cuckooAt(day);
    doorPanel.rotation.y = Math.min(1, out * 2) * 1.9;
    doorPanel.updateMatrix();
    bird.position.set(0, door.y - 0.01 + (out > 0.9 ? Math.abs(Math.sin(time * 9)) * 0.012 : 0), door.z + 0.06 - out * 0.12);
    bird.visible = out > 0;
    bird.updateMatrix();
  };
  group.userData.tick(0);
  return group;
}

function towerClock(materials) {
  const group = new THREE.Group();
  meshes(group, keep('tower body', () => {
    const p = { stone: [], trim: [], brass: [], lit: [], hand: [] };
    p.stone.push({ g: roundedBox(0.96, 0.96, 0.96, 0.02), m: at(0, 0.5, 0) });
    // A band round the bottom and the top.
    for (const y of [0.04, 0.96]) p.trim.push({ g: roundedBox(1, 0.07, 1, 0.015), m: at(0, y, 0) });
    // A face on each side, turned round the middle.
    for (let k = 0; k < 4; k++) {
      const side = { lit: [], brass: [], hand: [] };
      dial(side, TOWER.y, -TOWER.out, TOWER.r, 'lit', 'brass');
      const turn = new THREE.Matrix4().makeRotationY((k * Math.PI) / 2);
      for (const [key, list] of Object.entries(side)) for (const { g, m } of list) p[key].push({ g, m: turn.clone().multiply(m) });
    }
    return baked(p);
  }), materials);
  const faces = [];
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group();
    side.rotation.y = (k * Math.PI) / 2;
    side.updateMatrix();
    faces.push(hands(side, materials, TOWER.y, -TOWER.out, TOWER.r));
    group.add(side);
  }
  group.userData.hands = faces;
  group.userData.tick = (time, day = 0.5) => {
    for (const f of faces) setHands(f, day);
  };
  group.userData.tick(0);
  return group;
}

// A whole clock, `kind` 'cuckoo-clock' or 'tower-clock', in the materials
// given (clockMaterials).
export function clockModel(materials, kind = 'cuckoo-clock') {
  const group = kind === 'tower-clock' ? towerClock(materials) : cuckooClock(materials);
  group.name = kind;
  return group;
}
