// Fish tanks as real ones look (blocks.js FISH_TANK, FISH_BOWL), not made of
// boxes, their fish swimming round.
//
// A fish tank: a wooden cabinet with a glass tank on it, a black rim and a
// lid with a lamp under it, and inside blue water over sand and pebbles, a
// little pink castle, waving water plants, bubbles going up from a stone
// and five bright fish swimming round. A fish bowl: a round glass bowl on a
// wooden stand, two goldfish going round in it over pebbles and a plant.
//
// Fed (shared/fishtank.js), the fish dart over to the flakes and nibble
// them up off the top.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js). What moves is
// done by group.userData.tick(time), which render/terrain.js calls.
import * as THREE from '../../vendor/three.module.js';
import { at, bake, lathe, roundedBox } from './gashapon-model.js';
import { FEED_MS, flakeLayout } from '../shared/fishtank.js';

// How each part takes the light: three's physical material settings.
export const TANK_FINISH = {
  wood: { color: '#8b5a3c', roughness: 0.5, clearcoat: 0.4, envMapIntensity: 0.6 },
  brass: { color: '#e0b04c', metalness: 1, roughness: 0.25, envMapIntensity: 1.1 },
  rim: { color: '#2c2f36', roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.8 },
  sand: { color: '#e3b866', roughness: 0.9, envMapIntensity: 0.4 },
  pebble: { color: '#9aa7b8', roughness: 0.5, clearcoat: 0.6, envMapIntensity: 0.6 },
  plant: { color: '#249a3e', roughness: 0.45, clearcoat: 0.5, envMapIntensity: 0.6, side: THREE.DoubleSide },
  castle: { color: '#f7a6c8', roughness: 0.4, clearcoat: 0.6, envMapIntensity: 0.7 },
  roof: { color: '#8c5bd6', roughness: 0.35, clearcoat: 0.8, envMapIntensity: 0.8 },
  eye: { color: '#1d1f24', roughness: 0.2, clearcoat: 1, envMapIntensity: 1 },
  orange: { color: '#ff6a00', roughness: 0.3, clearcoat: 1, envMapIntensity: 0.9 },
  yellow: { color: '#ffd000', roughness: 0.3, clearcoat: 1, envMapIntensity: 0.9 },
  blue: { color: '#1d5cff', roughness: 0.3, clearcoat: 1, envMapIntensity: 0.9 },
  pink: { color: '#ff3d96', roughness: 0.3, clearcoat: 1, envMapIntensity: 0.9 },
  red: { color: '#e01e1e', roughness: 0.3, clearcoat: 1, envMapIntensity: 0.9 },
  // A flake of fish food, floating on the water.
  flake: { color: '#ffa94d', roughness: 0.7, envMapIntensity: 0.5, side: THREE.DoubleSide },
  // See-through, drawn after what is inside them, and never hiding it.
  water: { color: '#1f96e0', roughness: 0.1, envMapIntensity: 0.3, transparent: true, opacity: 0.32, depthWrite: false },
  glass: { color: '#e6f6ff', roughness: 0.05, clearcoat: 1, envMapIntensity: 0.6, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide },
  bubble: { color: '#ffffff', roughness: 0.05, clearcoat: 1, envMapIntensity: 1.2, transparent: true, opacity: 0.55, depthWrite: false },
  // The lamp under the lid is never lit itself: it is the light.
  lamp: { basic: true, color: '#e9fbff' },
};
const SEE_THROUGH = { water: 1, bubble: 1, glass: 2 };

// Materials for every part, each made by `make` from its settings.
export function tankMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(TANK_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  return out;
}

// Where the fish swim: the water's middle, how far it goes out each way
// (x across, z front to back) and its floor and top.
export const TANK = { y0: 0.47, y1: 0.86, x: 0.41, z: 0.24 };
export const BOWL = { y: 0.6, r: 0.26, top: 0.72 };

const cyl = (r0, r1, h, segs = 16) => new THREE.CylinderGeometry(r0, r1, h, segs);
const ball = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
// Shapes made once and shared by every tank, by name.
const kept = new Map();
const keep = (name, make) => kept.get(name) ?? kept.set(name, make()).get(name);
// A leaf of a water plant: a long thin egg standing up from its foot.
const leaf = (w, len) =>
  keep(`leaf ${w} ${len}`, () => {
    const g = ball(1, 8, 8);
    g.scale(w, len / 2, w * 0.35);
    g.translate(0, len / 2, 0);
    return g;
  });
const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, l]) => [k, bake(l.map(({ g, m }) => ({ g, m: m ?? new THREE.Matrix4() })))]));

// A fish's shapes, its nose to +x: a round body, a tail fin, a fin on its
// back and an eye on each side.
let fishShapes;
function fish() {
  if (fishShapes) return fishShapes;
  const body = ball(1, 14, 10);
  body.scale(0.045, 0.032, 0.016);
  const tail = new THREE.ConeGeometry(0.026, 0.04, 4);
  tail.rotateZ(Math.PI / 2);
  tail.scale(1, 1, 0.25);
  tail.translate(-0.02, 0, 0);
  const fin = new THREE.ConeGeometry(0.014, 0.03, 4);
  fin.scale(1.4, 1, 0.25);
  fin.translate(-0.005, 0.035, 0);
  const eyes = bake([
    { g: ball(0.006, 8, 6), m: at(0.026, 0.008, 0.013) },
    { g: ball(0.006, 8, 6), m: at(0.026, 0.008, -0.013) },
  ]);
  fishShapes = { body, tail, fin, eyes };
  return fishShapes;
}

function makeFish(materials, color, size) {
  const s = fish();
  const group = new THREE.Group();
  group.scale.setScalar(size);
  const tail = new THREE.Group();
  tail.position.x = -0.035;
  for (const [g, m, target] of [[s.body, color, group], [s.fin, color, group], [s.eyes, 'eye', group], [s.tail, color, tail]]) {
    const mesh = new THREE.Mesh(g, materials[m]);
    mesh.userData.shared = true;
    target.add(mesh);
  }
  group.add(tail);
  group.userData.tail = tail;
  return group;
}

// A fish's place on its round at `time`: where it is (an oval a across and b
// deep, at height y) and which way its nose points, going round `dir` way.
function homeOf({ a, b, y, speed, dir, start }, time) {
  const angle = start + time * speed * dir;
  const vx = -Math.sin(angle) * a * dir;
  const vz = Math.cos(angle) * b * dir;
  return { x: Math.cos(angle) * a, y: y + Math.sin(time * 0.8 + start) * 0.025, z: Math.sin(angle) * b, angle: Math.atan2(-vz, vx) };
}

// A pinch of fish food on the water (shared/fishtank.js flakeLayout): the
// flakes come down onto it, float there, and the fish dart over and nibble
// them up one by one, easing back to their rounds once the last is gone.
// `homes` says where each fish is on its round, `nibbleY` how high one comes
// to take a flake off the top and `top` where the flakes float.
function feeder(materials, kind, fish, homes, top, nibbleY) {
  const flakes = flakeLayout(kind).map((f, i) => {
    const m = new THREE.Mesh(keep(`flake ${i % 2}`, () => ball(0.008 + (i % 2) * 0.003, 6, 4)), materials.flake);
    m.visible = false;
    m.renderOrder = 1;
    m.userData.shared = true;
    m.matrixAutoUpdate = false;
    m.scale.set(1.5, 0.5, 1.5);
    // Built already on the water, hidden until a pinch comes.
    m.position.set(f.x, top, f.z);
    m.updateMatrix();
    return { ...f, m, eaten: false };
  });
  // The flake each fish has its eye on, and when the feeding began (in the
  // tick's own clock, so whoever calls pinch needs no clock of their own).
  const claimed = new Map();
  let began = -1;
  let pinched = false;
  let last = 0;
  return {
    flakes,
    pinch() {
      pinched = true;
    },
    tick(time) {
      const dt = Math.min(0.1, Math.max(0, time - last));
      last = time;
      if (pinched) {
        pinched = false;
        began = time;
        claimed.clear();
        for (const f of flakes) {
          f.eaten = false;
          f.m.visible = false;
        }
      }
      const since = began < 0 ? Infinity : time - began;
      if (began >= 0 && since > FEED_MS / 1000) {
        began = -1;
        claimed.clear();
      }
      // Each flake falls the last little way onto the water, then floats.
      for (const f of flakes) {
        const age = since - f.t;
        f.m.visible = began >= 0 && !f.eaten && age > 0;
        if (!f.m.visible) continue;
        f.m.position.set(f.x, top - Math.min(1, age * 2.5) * 0.02, f.z);
        f.m.rotation.y = f.x * 9;
        f.m.updateMatrix();
      }
      fish.forEach((f, i) => {
        const home = homes[i](time);
        let tx = home.x;
        let ty = home.y;
        let tz = home.z;
        let darting = false;
        let aim = null;
        if (began >= 0) {
          // The flake nearest this fish, of those down and not taken.
          aim = claimed.get(i);
          if (aim && (aim.eaten || began < 0)) claimed.delete(i);
          if (!claimed.has(i)) {
            let bestD = 1;
            for (const fl of flakes) {
              if (fl.eaten || fl.t > since || [...claimed.values()].includes(fl)) continue;
              const d = Math.hypot(f.position.x - fl.x, f.position.z - fl.z);
              if (d < bestD) {
                bestD = d;
                aim = fl;
              }
            }
            if (aim) claimed.set(i, aim);
          }
          if (aim && !aim.eaten) {
            tx = aim.x;
            ty = nibbleY;
            tz = aim.z;
            darting = true;
          }
        }
        // Darting over to a flake, or easing back to its round.
        const dx = tx - f.position.x;
        const dy = ty - f.position.y;
        const dz = tz - f.position.z;
        const d = Math.hypot(dx, dy, dz);
        const step = d < 1e-6 ? 1 : Math.min(1, (dt * (darting ? 1.2 : 0.5)) / d);
        f.position.x += dx * step;
        f.position.y += dy * step;
        f.position.z += dz * step;
        f.rotation.y = d > 0.005 ? Math.atan2(-dz, dx) : home.angle;
        f.updateMatrix();
        const tail = f.userData.tail;
        tail.rotation.y = Math.sin(time * (darting ? 20 : 9) + i) * (darting ? 0.65 : 0.45);
        tail.updateMatrix();
        if (darting && d < 0.02) {
          aim.eaten = true;
          aim.m.visible = false;
          claimed.delete(i);
        }
      });
    },
  };
}

let tankShapes;
function tankBody() {
  if (tankShapes) return tankShapes;
  const p = { wood: [], brass: [], rim: [], sand: [], pebble: [], castle: [], roof: [], lamp: [], water: [], glass: [] };
  // The cabinet, two doors with knobs on its front.
  p.wood.push({ g: roundedBox(0.94, 0.4, 0.6, 0.025), m: at(0, 0.2, 0) });
  p.rim.push({ g: new THREE.BoxGeometry(0.004, 0.32, 0.002), m: at(0, 0.2, -0.301) });
  for (const x of [-0.04, 0.04]) p.brass.push({ g: ball(0.014), m: at(x, 0.24, -0.305) });
  // The tank: a black rim round its foot and its top, glass between, the
  // lid and its lamp.
  const W = 0.9;
  const D = 0.56;
  for (const y of [0.415, 0.905]) {
    for (const z of [-D / 2, D / 2]) p.rim.push({ g: new THREE.BoxGeometry(W + 0.02, 0.03, 0.02), m: at(0, y, z) });
    for (const x of [-W / 2, W / 2]) p.rim.push({ g: new THREE.BoxGeometry(0.02, 0.03, D + 0.02), m: at(x, y, 0) });
  }
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) p.rim.push({ g: new THREE.BoxGeometry(0.016, 0.47, 0.016), m: at(x, 0.66, z) });
  p.rim.push({ g: roundedBox(W + 0.04, 0.04, D + 0.04, 0.012), m: at(0, 0.94, 0) });
  p.lamp.push({ g: new THREE.BoxGeometry(W - 0.2, 0.01, 0.08), m: at(0, 0.915, 0.05) });
  p.glass.push({ g: new THREE.BoxGeometry(W - 0.01, 0.46, D - 0.01), m: at(0, 0.66, 0) });
  p.water.push({ g: new THREE.BoxGeometry(W - 0.03, 0.44, D - 0.03), m: at(0, 0.65, 0) });
  // Sand along the floor, piled up at the back, and pebbles on it.
  p.sand.push({ g: new THREE.BoxGeometry(W - 0.03, 0.035, D - 0.03), m: at(0, 0.448, 0) });
  p.sand.push({ g: new THREE.BoxGeometry(W - 0.03, 0.03, 0.2), m: at(0, 0.47, 0.16, -0.12) });
  for (let i = 0; i < 18; i++) {
    const x = Math.sin(i * 12.9898) * 0.4;
    const z = Math.sin(i * 78.233) * 0.22;
    p.pebble.push({ g: ball(0.018 + (i % 3) * 0.006, 8, 6), m: at(x, 0.468, z, 0, i, 0, 1, 0.6, 1) });
  }
  // The castle: a keep with a tower each side, purple roofs, a dark door.
  p.castle.push({ g: new THREE.BoxGeometry(0.12, 0.12, 0.08), m: at(0.1, 0.53, 0.14) });
  for (const x of [0.03, 0.17]) {
    p.castle.push({ g: cyl(0.03, 0.032, 0.18), m: at(x, 0.56, 0.14) });
    p.roof.push({ g: new THREE.ConeGeometry(0.04, 0.07, 16), m: at(x, 0.685, 0.14) });
  }
  p.rim.push({ g: new THREE.CylinderGeometry(0.022, 0.022, 0.004, 16, 1, false, 0, Math.PI), m: at(0.1, 0.5, 0.099, Math.PI / 2, 0, Math.PI / 2) });
  // The stone the bubbles come up from.
  p.pebble.push({ g: ball(0.03, 10, 8), m: at(-0.28, 0.47, 0.12, 0, 0, 0, 1, 0.7, 1) });
  tankShapes = baked(p);
  return tankShapes;
}

let bowlShapes;
function bowlBody() {
  if (bowlShapes) return bowlShapes;
  const { y, r, top } = BOWL;
  const p = { wood: [], pebble: [], water: [], glass: [] };
  // A round wooden stand.
  p.wood.push({ g: lathe([[0, 0], [0.18, 0], [0.19, 0.03], [0.1, 0.06], [0.07, 0.3], [0.15, 0.33], [0.16, 0.36], [0, 0.36]]) });
  // The bowl, open at the top with a lip, flat underneath.
  const open = Math.acos((top + 0.04 - y) / r);
  p.glass.push({ g: new THREE.SphereGeometry(r, 32, 20, 0, Math.PI * 2, open, Math.PI - open - 0.4), m: at(0, y, 0) });
  p.glass.push({ g: new THREE.TorusGeometry(r * Math.sin(open), 0.008, 8, 40), m: at(0, y + r * Math.cos(open), 0, Math.PI / 2) });
  // Its water, a flat top, pebbles on its floor.
  const w = r - 0.012;
  const level = Math.acos((top - y) / w);
  p.water.push({ g: new THREE.SphereGeometry(w, 28, 16, 0, Math.PI * 2, level, Math.PI - level - 0.42), m: at(0, y, 0) });
  p.water.push({ g: new THREE.CircleGeometry(w * Math.sin(level), 28), m: at(0, top, 0, -Math.PI / 2) });
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const d = 0.03 + (i % 3) * 0.03;
    p.pebble.push({ g: ball(0.016, 8, 6), m: at(Math.cos(a) * d, 0.385, Math.sin(a) * d, 0, i, 0, 1, 0.6, 1) });
  }
  bowlShapes = baked(p);
  return bowlShapes;
}

function meshes(target, list, materials) {
  for (const [k, g] of Object.entries(list)) {
    const m = new THREE.Mesh(g, materials[k]);
    if (SEE_THROUGH[k]) m.renderOrder = SEE_THROUGH[k];
    m.userData.shared = true;
    target.add(m);
  }
}

// A water plant of a few leaves, each to wave.
function plant(materials, x, y, z, n, len) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(leaf(0.016, len * (0.7 + ((i * 37) % 10) / 25)), materials.plant);
    l.userData.shared = true;
    l.position.set(Math.cos(i * 2.1) * 0.015, 0, Math.sin(i * 2.1) * 0.015);
    l.rotation.set(Math.sin(i * 1.7) * 0.25, i * 1.3, Math.cos(i * 1.7) * 0.25);
    l.userData.lean = [l.rotation.x, l.rotation.z, i];
    group.add(l);
    leaves.push(l);
  }
  return { group, leaves };
}

function wave(leaves, time) {
  for (const l of leaves) {
    const [rx, rz, i] = l.userData.lean;
    l.rotation.x = rx + Math.sin(time * 1.3 + i) * 0.12;
    l.rotation.z = rz + Math.cos(time * 1.1 + i * 0.7) * 0.12;
    l.updateMatrix();
  }
}

// A whole tank, `kind` 'fish-tank' or 'fish-bowl', in the materials given
// (tankMaterials). group.userData.feed() sprinkles a pinch of food on the
// water (shared/fishtank.js), and group.userData.flakes are its meshes.
export function tankModel(materials, kind = 'fish-tank') {
  const group = new THREE.Group();
  group.name = kind;
  const leaves = [];
  // The fish: colour, size, how far round each way, how high and how fast.
  const school =
    kind === 'fish-bowl'
      ? [['orange', 1.5, 0.12, 0.12, 0.55, 0.7, 1], ['yellow', 1.25, 0.09, 0.09, 0.47, 0.55, -1]]
      : [
        ['orange', 1.7, 0.28, 0.14, 0.62, 0.5, 1],
        ['yellow', 1.4, 0.25, 0.1, 0.7, 0.65, -1],
        ['blue', 1.6, 0.3, 0.14, 0.55, 0.42, 1],
        ['pink', 1.3, 0.22, 0.12, 0.74, 0.75, 1],
        ['red', 1.5, 0.27, 0.08, 0.67, 0.55, -1],
      ];
  const fish = [];
  const homes = [];
  school.forEach(([c, size, a, b, y, speed, dir], i) => {
    const f = makeFish(materials, c, size);
    group.add(f);
    fish.push(f);
    homes.push((time) => homeOf({ a, b, y, speed, dir, start: i * 1.3 + (kind === 'fish-bowl' ? (i ? 2 : 0) : 0) }, time));
    // On its round from the first frame, so the model fits its cell as built.
    const home = homes[i](0);
    f.position.set(home.x, home.y, home.z);
    f.rotation.y = home.angle;
    f.updateMatrix();
  });
  const food = feeder(materials, kind, fish, homes, kind === 'fish-bowl' ? BOWL.top : TANK.y1 - 0.02, kind === 'fish-bowl' ? 0.63 : 0.78);
  for (const f of food.flakes) group.add(f.m);
  group.userData.feed = () => food.pinch();
  group.userData.flakes = food.flakes;
  if (kind === 'fish-bowl') {
    meshes(group, bowlBody(), materials);
    const weed = plant(materials, 0.08, 0.37, 0.06, 4, 0.17);
    group.add(weed.group);
    leaves.push(...weed.leaves);
  } else {
    meshes(group, tankBody(), materials);
    for (const [x, z, n, len] of [[-0.36, 0.18, 6, 0.32], [-0.18, 0.2, 4, 0.22], [0.33, 0.17, 7, 0.36], [0.38, -0.12, 3, 0.16], [-0.38, -0.15, 4, 0.2]]) {
      const p = plant(materials, x, 0.46, z, n, len);
      group.add(p.group);
      leaves.push(...p.leaves);
    }
  }
  const bubbles = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(keep(`bubble ${i % 2}`, () => ball(0.008 + (i % 2) * 0.004, 8, 6)), materials.bubble);
    b.renderOrder = 1;
    b.userData.shared = true;
    group.add(b);
    bubbles.push(b);
  }
  group.userData.tick = (time) => {
    wave(leaves, time);
    food.tick(time);
    // Bubbles go up one after another from the stone and burst at the top.
    bubbles.forEach((b, i) => {
      const k = (time * 0.35 + i / bubbles.length) % 1;
      b.position.set(-0.28 + Math.sin(k * 12 + i) * 0.01, TANK.y0 + 0.02 + k * (TANK.y1 - TANK.y0 - 0.02), 0.12);
      b.updateMatrix();
    });
  };
  group.userData.tick(0);
  return group;
}
