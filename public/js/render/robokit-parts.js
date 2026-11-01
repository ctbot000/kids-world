// The parts of a robot kit (shared/robokit.js) as real ones look, and whole
// robots made of them, for the kit's window (render/robokit3d.js) and for
// the robot standing on its kit on the island (render/robokits.js).
//
// White plastic motors and hub with a yellow band round the hub, its 5×5
// light matrix and round button on top and its six ports, lettered, down
// its sides; black rubber tyres with a tread on light grey rims; azure
// beams full of holes; black sensors (the distance sensor's two round eyes,
// the colour sensor's lit lens looking down); a bumper's black button; a
// lamp's glowing dome; a propeller; and grey cables from the ports to what
// is plugged in, the way a real robot is wired.
//
// Lengths in centimetres, the ground at y = 0. A part is laid out facing
// -z, as on the plate when it faces up (r = 0); each axle is AXLE_Y up.
import * as THREE from '../../vendor/three.module.js';
import { RoundedBoxGeometry } from '../../vendor/three-addons/geometries/RoundedBoxGeometry.js';
import { analyse, axleOf, BLANK, CELL, COLORS, DIRS, middleOf, PORTS, WHEEL_D } from '../shared/robokit.js';

export const AXLE_Y = WHEEL_D / 2;
const TAU = Math.PI * 2;

// How each part takes the light: three's physical material settings.
export const KIT_FINISH = {
  white: { color: '#f6f6f2', roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.2 },
  yellow: { color: '#ffcf1f', roughness: 0.34, clearcoat: 0.6 },
  azure: { color: '#2f9fe8', roughness: 0.38, clearcoat: 0.5 },
  grey: { color: '#a9b0b9', roughness: 0.45, clearcoat: 0.3 },
  dark: { color: '#3b4049', roughness: 0.5, clearcoat: 0.2 },
  black: { color: '#202328', roughness: 0.42, clearcoat: 0.4 },
  rubber: { color: '#26282c', roughness: 0.92 },
  steel: { color: '#dfe4ea', metalness: 1, roughness: 0.2 },
  lens: { color: '#0d0f12', roughness: 0.08, clearcoat: 1 },
  cable: { color: '#4a4f58', roughness: 0.6 },
  blade: { color: '#ff8a1f', roughness: 0.34, clearcoat: 0.6, side: THREE.DoubleSide },
  // Lights are never lit themselves: they are the light.
  ledOn: { basic: true, color: '#fff6c8' },
  ledOff: { color: '#555b65', roughness: 0.5 },
  glow: { basic: true, color: '#ffffff' },
};

// Materials for every part, each made by `make` from its settings.
export function kitMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = { make };
  for (const [k, f] of Object.entries(KIT_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  return out;
}

// Shapes made once and shared by every robot.
const shapes = new Map();
const shape = (key, fn) => {
  if (!shapes.has(key)) shapes.set(key, fn());
  return shapes.get(key);
};
const rbox = (w, h, d, r = 0.4) => shape(`rbox${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
const cyl = (r0, r1, h, segs = 24) => shape(`cyl${r0}|${r1}|${h}|${segs}`, () => new THREE.CylinderGeometry(r0, r1, h, segs));
const boxG = (w, h, d) => shape(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A cylinder lying along z (an axle, a hole, a wheel).
function alongZ(geometry, material, x, y, z) {
  const m = mesh(geometry, material, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
}

// A port's letter, a little label beside it.
const letters = new Map();
function letterMaterial(ch) {
  if (!letters.has(ch)) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#3b4049';
    g.font = 'bold 50px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 32, 35);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    letters.set(ch, new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }
  return letters.get(ch);
}

// ------------------------------------------------------------ the hub

const HUB = { w: 7.6, h: 3.8, y0: 1.2 };
// Where each port's socket is on the hub, in its own layout: A, C and E
// down its left side, front to back, B, D and F down its right.
export function portPlace(letter) {
  const i = PORTS.indexOf(letter);
  const side = i % 2 ? 1 : -1;
  const row = Math.floor(i / 2);
  return { x: side * (HUB.w / 2 + 0.05), y: HUB.y0 + HUB.h * 0.42, z: -2.3 + row * 2.3, side };
}

function hub(m) {
  const g = new THREE.Group();
  const top = HUB.y0 + HUB.h;
  g.add(mesh(rbox(HUB.w, HUB.h, HUB.w, 0.7), m.white, 0, HUB.y0 + HUB.h / 2, 0));
  // The yellow band round it.
  g.add(mesh(rbox(HUB.w + 0.24, 1.1, HUB.w + 0.24, 0.5), m.yellow, 0, HUB.y0 + 0.9, 0));
  // The dark panel on top with the light matrix towards the front and the
  // button behind it.
  g.add(mesh(rbox(6.2, 0.3, 6.6, 0.12), m.dark, 0, top - 0.08, -0.1));
  const leds = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const led = mesh(boxG(0.62, 0.14, 0.62), m.ledOff, (c - 2) * 0.92, top + 0.1, -1.0 + (r - 2) * 0.92);
      led.castShadow = false;
      leds.push(led);
      g.add(led);
    }
  }
  g.add(mesh(cyl(0.72, 0.72, 0.22, 28), m.glow, 0, top + 0.08, 2.35));
  g.add(mesh(cyl(0.58, 0.58, 0.32, 28), m.white, 0, top + 0.12, 2.35));
  // Two small buttons either side of it.
  for (const s of [-1, 1]) g.add(mesh(rbox(0.9, 0.24, 0.5, 0.1), m.grey, s * 1.7, top + 0.1, 2.35));
  // The ports, each a dark socket with its letter above.
  for (const p of PORTS) {
    const at = portPlace(p);
    g.add(mesh(boxG(0.2, 0.9, 1.4), m.black, at.x, at.y, at.z));
    const label = new THREE.Mesh(shape('label', () => new THREE.PlaneGeometry(0.9, 0.9)), letterMaterial(p));
    label.position.set(at.x + at.side * 0.02, at.y + 1.0, at.z);
    label.rotation.y = (at.side * Math.PI) / 2;
    g.add(label);
  }
  // A grille of holes for the speaker, at the back.
  for (let i = 0; i < 5; i++) g.add(mesh(cyl(0.18, 0.18, 0.1, 10), m.dark, -1.6 + i * 0.8, HUB.y0 + HUB.h * 0.5, HUB.w / 2 + 0.01).rotateX(Math.PI / 2));
  g.userData.leds = leds;
  return g;
}

// ------------------------------------------------------------ motors and wheels

// An axle end: a dark grey disc with a cross hole and a white dot to see it
// turn, facing -z from z.
function outputDisc(m, z) {
  const disc = new THREE.Group();
  disc.position.set(0, AXLE_Y, z);
  disc.add(alongZ(cyl(1.45, 1.45, 0.4, 32), m.dark, 0, 0, 0));
  disc.add(mesh(boxG(0.9, 0.26, 0.06), m.black, 0, 0, -0.21));
  disc.add(mesh(boxG(0.26, 0.9, 0.06), m.black, 0, 0, -0.21));
  disc.add(alongZ(cyl(0.16, 0.16, 0.08, 10), m.white, 0, 1.05, -0.2));
  return disc;
}

function motor(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.5, 3.5, 3.0, 0.7), m.white, 0, AXLE_Y, 0.25));
  // A round shoulder behind the disc, and holes down its sides for pins.
  g.add(alongZ(cyl(1.75, 1.75, 0.5, 32), m.white, 0, AXLE_Y, -1.35));
  for (const s of [-1, 1]) for (const z of [-0.6, 0.9]) g.add(mesh(cyl(0.33, 0.33, 0.06, 12), m.dark, s * 1.76, AXLE_Y + 0.9, z).rotateZ(Math.PI / 2));
  // The cable's socket at its back.
  g.add(mesh(boxG(1.2, 0.8, 0.2), m.black, 0, AXLE_Y, 1.78));
  const disc = outputDisc(m, -1.75);
  g.add(disc);
  g.userData.spin = disc;
  return g;
}

// A tyre with a tread on a light grey rim, its axle along z, pushed up to
// the motor (or beam) behind it.
function wheel(m) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.set(0, AXLE_Y, 0.9);
  const R = WHEEL_D / 2;
  const tyre = shape('tyre', () => {
    const pts = [];
    const w = 0.85;
    for (let k = 0; k <= 12; k++) {
      const a = -Math.PI / 2 + (k / 12) * Math.PI;
      pts.push(new THREE.Vector2(R - 0.42 + Math.cos(a) * 0.42, Math.sin(a) * w));
    }
    const g = new THREE.LatheGeometry([new THREE.Vector2(1.75, -w), ...pts, new THREE.Vector2(1.75, w)], 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
  spin.add(mesh(tyre, m.rubber));
  // The tread: little blocks all round.
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * TAU;
    const t = mesh(boxG(0.5, 0.16, 1.2), m.rubber, Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02), 0);
    t.rotation.z = a + Math.PI / 2;
    spin.add(t);
  }
  spin.add(alongZ(cyl(1.8, 1.8, 1.5, 32), m.grey, 0, 0, 0));
  spin.add(alongZ(cyl(0.7, 0.7, 1.62, 20), m.white, 0, 0, 0));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    spin.add(alongZ(cyl(0.3, 0.3, 1.56, 12), m.dark, Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0));
  }
  spin.add(mesh(boxG(0.5, 0.16, 1.66), m.dark));
  spin.add(mesh(boxG(0.16, 0.5, 1.66), m.dark));
  g.add(spin);
  // The axle into the motor behind.
  g.add(alongZ(cyl(0.22, 0.22, 1.4, 10), m.dark, 0, AXLE_Y, 1.75));
  g.userData.spin = spin;
  return g;
}

function propeller(m) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.set(0, AXLE_Y, 1.0);
  spin.add(alongZ(cyl(0.6, 0.6, 0.9, 20), m.yellow, 0, 0, 0));
  const blade = shape('blade', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.32, 0.4);
    s.quadraticCurveTo(-0.75, 1.6, -0.4, 2.45);
    s.quadraticCurveTo(0, 2.7, 0.4, 2.45);
    s.quadraticCurveTo(0.6, 1.5, 0.32, 0.4);
    s.lineTo(-0.32, 0.4);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    geo.translate(0, 0, -0.06);
    return geo;
  });
  for (let k = 0; k < 3; k++) {
    const b = mesh(blade, m.blade);
    b.rotation.z = (k / 3) * TAU;
    b.rotateY(0.35);
    spin.add(b);
  }
  g.add(spin);
  g.add(alongZ(cyl(0.22, 0.22, 1.4, 10), m.dark, 0, AXLE_Y, 1.75));
  g.userData.spin = spin;
  return g;
}

function caster(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.2, 1.6, 3.2, 0.5), m.white, 0, 2.6, 0));
  g.add(mesh(cyl(1.25, 1.1, 0.9, 24), m.dark, 0, 1.75, 0));
  g.add(mesh(shape('ball', () => new THREE.SphereGeometry(1.05, 24, 16)), m.steel, 0, 1.05, 0));
  return g;
}

// A square of beam, its holes showing, at axle height: what joins things.
function beam(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.95, 1.0, 3.95, 0.45), m.azure, 0, AXLE_Y, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(mesh(cyl(0.48, 0.48, 1.04, 16), m.dark, x * 0.95, AXLE_Y, z * 0.95));
  return g;
}

// ------------------------------------------------------------ sensors and lights

function distance(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.6, 2.2, 2.4, 0.5), m.black, 0, AXLE_Y, 0.4));
  g.add(mesh(boxG(1.2, 0.8, 0.2), m.dark, 0, AXLE_Y, 1.68));
  const rings = [];
  for (const s of [-1, 1]) {
    // A lit ring round each eye, and the eye itself.
    const ring = mesh(shape('eye-ring', () => new THREE.TorusGeometry(0.78, 0.13, 10, 28)), m.glow, s * 0.92, AXLE_Y, -0.82);
    rings.push(ring);
    g.add(ring);
    g.add(alongZ(cyl(0.7, 0.7, 0.2, 24), m.grey, s * 0.92, AXLE_Y, -0.82));
    g.add(alongZ(cyl(0.48, 0.48, 0.24, 24), m.lens, s * 0.92, AXLE_Y, -0.84));
  }
  g.userData.rings = rings;
  return g;
}

function colorSensor(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.0, 2.0, 3.0, 0.5), m.black, 0, 2.5, 0));
  g.add(mesh(boxG(1.2, 0.8, 0.2), m.dark, 0, 2.6, 1.55));
  // Its lens at the bottom, lit white, a little off the mat.
  g.add(mesh(cyl(0.95, 0.95, 0.3, 24), m.grey, 0, 1.45, 0));
  const lens = mesh(cyl(0.65, 0.65, 0.34, 24), m.glow, 0, 1.42, 0);
  g.add(lens);
  g.userData.lens = lens;
  return g;
}

function bumper(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.4, 3.0, 2.8, 0.6), m.white, 0, AXLE_Y, 0.4));
  g.add(mesh(boxG(1.2, 0.8, 0.2), m.black, 0, AXLE_Y, 1.85));
  const button = new THREE.Group();
  button.position.set(0, AXLE_Y, -1.0);
  button.add(alongZ(cyl(1.1, 1.15, 0.9, 28), m.black, 0, 0, -0.3));
  button.add(alongZ(cyl(0.95, 0.95, 0.16, 28), m.dark, 0, 0, -0.78));
  g.add(button);
  g.userData.button = button;
  return g;
}

function lamp(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.2, 1.6, 3.2, 0.5), m.white, 0, 2.0, 0));
  g.add(mesh(boxG(1.2, 0.8, 0.2), m.black, 0, 2.0, 1.66));
  g.add(mesh(cyl(1.3, 1.3, 0.4, 28), m.grey, 0, 2.95, 0));
  const glass = m.make({ color: '#ffffff', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.55 });
  const dome = mesh(shape('dome', () => new THREE.SphereGeometry(1.2, 28, 14, 0, TAU, 0, Math.PI / 2)), glass, 0, 3.1, 0);
  const bulb = new THREE.MeshBasicMaterial({ color: COLORS.off.hex });
  const core = mesh(shape('bulb', () => new THREE.SphereGeometry(0.75, 20, 12)), bulb, 0, 3.25, 0);
  core.castShadow = false;
  g.add(core, dome);
  g.userData.bulb = bulb;
  return g;
}

const MAKERS = { hub, motor, wheel, caster, beam, distance, color: colorSensor, bumper, lamp, propeller };

// One part's model on its own, as on the plate facing up (a picture of it).
export function partModel(kind, m) {
  return MAKERS[kind](m);
}

// A cable from a port of the hub (`from`, coming out the way `out` points)
// to a part's socket at its back: out of the port, up in a loop and down
// to the part.
function cable(m, from, out, to) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.max(from.y, to.y) + 3.2;
  const curve = new THREE.CatmullRomCurve3([from, from.clone().addScaledVector(out, 1.2), mid, to.clone().add(new THREE.Vector3(0, 1.2, 0)), to]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.26, 8), m.cable);
  tube.castShadow = true;
  tube.userData.own = true;
  return tube;
}

// A whole robot from its parts, its middle (shared/robokit.js analyse) at
// the origin, laid out as on the plate. `loose` marks parts not joined to
// the hub, for the build plate to show. userData.update(state) shows what
// it is doing: its motors' turns, light matrix, lamps, the colour seen and
// the bumper pressed.
export function robotModel(parts, m, { center = null } = {}) {
  const info = analyse(parts);
  const g = new THREE.Group();
  const [ox, oz] = center ?? info.middle;
  const placed = [];
  parts.forEach((p, i) => {
    const part = MAKERS[p.k](m);
    const [mx, mz] = middleOf(p);
    part.position.set((mx - ox) * CELL, 0, (mz - oz) * CELL);
    const r = p.k === 'wheel' ? axleOf(parts, info, i) : p.r;
    part.rotation.y = -r * (Math.PI / 2);
    // A wheel or propeller not on a motor's axle sits in the middle of its stud.
    if ((p.k === 'wheel' || p.k === 'propeller') && !info.driver.has(i)) part.userData.spin.position.z = 0;
    part.userData.index = i;
    placed.push(part);
    g.add(part);
  });
  // Cables from the hub's ports.
  if (info.hub) {
    const h = placed[info.hubIndex];
    h.updateMatrix();
    for (const [letter, i] of Object.entries(info.ports)) {
      const at = portPlace(letter);
      const from = new THREE.Vector3(at.x, at.y, at.z).applyMatrix4(h.matrix);
      const out = new THREE.Vector3(at.side, 0, 0).applyQuaternion(h.quaternion);
      const p = placed[i];
      p.updateMatrix();
      const back = parts[i].k === 'color' ? new THREE.Vector3(0, 2.6, 1.7) : parts[i].k === 'lamp' ? new THREE.Vector3(0, 2.0, 1.8) : new THREE.Vector3(0, AXLE_Y, 1.9);
      const c = cable(m, from, out, back.applyMatrix4(p.matrix));
      g.add(c);
    }
  }
  g.userData.info = info;
  g.userData.placed = placed;
  const leds = info.hub ? placed[info.hubIndex].userData.leds : [];
  let shown = '';
  g.userData.update = ({ motors = {}, matrix = BLANK, lamps = {}, seen = {}, pressed = {} } = {}) => {
    for (const mo of Object.values(motors)) {
      const rad = ((mo.deg ?? 0) * Math.PI) / 180;
      const own = placed[mo.i];
      if (!own) continue;
      own.userData.spin.rotation.z = -rad;
      const on = info.onAxle.get(mo.i);
      if (on !== undefined) placed[on].userData.spin.rotation.z = -rad;
    }
    if (matrix !== shown) {
      shown = matrix;
      leds.forEach((led, k) => (led.material = matrix[k] === '#' ? m.ledOn : m.ledOff));
    }
    for (const [letter, i] of Object.entries(info.ports)) {
      const part = placed[i];
      if (parts[i].k === 'lamp') part.userData.bulb.color.set(COLORS[lamps[letter] ?? 'off'].hex);
      if (parts[i].k === 'bumper') part.userData.button.position.z = pressed[letter] ? -0.55 : -1.0;
      if (parts[i].k === 'color') part.userData.lens.material = seen[letter] ? seenMaterial(seen[letter]) : m.glow;
    }
  };
  g.userData.dispose = () => {
    g.traverse((o) => {
      if (o.userData.own) o.geometry.dispose();
    });
    for (const p of placed) if (p.userData.bulb) p.userData.bulb.dispose();
  };
  g.userData.update();
  return g;
}

// The colour sensor's lens shows the colour it sees.
const seen = new Map();
function seenMaterial(col) {
  if (!seen.has(col)) seen.set(col, new THREE.MeshBasicMaterial({ color: col === 'black' ? '#55606e' : COLORS[col].hex }));
  return seen.get(col);
}

// Which way a part faces, as a turn about y (shared/robokit.js DIRS).
export const turnOf = (r) => -r * (Math.PI / 2);
export { DIRS };
