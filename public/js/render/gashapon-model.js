// A gashapon machine as a real one looks (shared/gashapon.js), not made of
// boxes: a red cabinet with rounded edges on a dark plinth, a chrome coin
// mechanism with a big turning handle and a coin slot, a chute behind a
// smoked flap at the bottom, a chrome collar, and on top a clear glass globe
// packed with two-tone capsules — a coloured half on a clear one, tumbled
// every which way — under a red cap with a chrome knob. And the capsule that
// comes out of it, to be opened.
//
// The same shapes serve the island (render/terrain.js lays one in each
// machine's cell) and the machine's window (render/gasha-stage.js), each
// with materials of its own: a material lights only in the WebGL context it
// was made for, while shapes go anywhere.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin, facing -z like all furniture (shared/furniture.js).
import * as THREE from '../../vendor/three.module.js';
import { Rng } from '../shared/rng.js';

// The capsules' colours, as in the window's balls (style.css).
export const SHELLS = ['#f47fb8', '#62c4f5', '#fcd535', '#9bd44a', '#f59331', '#8c5bd6'];

// How each part takes the light: three's physical material settings.
export const FINISH = {
  red: { color: '#e23b33', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9 },
  dark: { color: '#2b2d33', roughness: 0.5, clearcoat: 0.3, envMapIntensity: 0.6 },
  chrome: { color: '#e9edf2', metalness: 1, roughness: 0.16, envMapIntensity: 1.25 },
  white: { color: '#fbf8f1', roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.8 },
  yellow: { color: '#ffd23f', roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.8 },
  glass: { color: '#ffffff', roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.1, transparent: true, opacity: 0.08, depthWrite: false },
  glassBack: { color: '#cfe9ff', roughness: 0.05, envMapIntensity: 0.6, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.BackSide },
  smoke: { color: '#3a3d45', roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.55 },
  clear: { color: '#f4f7fb', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2, transparent: true, opacity: 0.55, depthWrite: false },
  ...Object.fromEntries(SHELLS.map((c, i) => [`shell${i}`, { color: c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1 }])),
};

// The Monster Gashapon (blocks.js MONSTER_GASHAPON) is the same machine in
// a monster's colours: a purple cabinet and cap with a band of slime green,
// two horns on its cap, capsules in the monsters' own colours, and a beam
// of light up from it to find it by.
export const MONSTER_SHELLS = ['#9b6bff', '#e2536a', '#8ee05a', '#ffa53d', '#5fc7e6', '#3a3d45'];
const MONSTER_FINISH = {
  red: { ...FINISH.red, color: '#5b2a86' },
  yellow: { ...FINISH.yellow, color: '#8ee05a' },
  white: { ...FINISH.white, color: '#2b2d33' },
  horn: { color: '#fff1d0', roughness: 0.3, clearcoat: 0.6, envMapIntensity: 0.8 },
  beam: { basic: true, color: '#c9a6ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide },
  ...Object.fromEntries(MONSTER_SHELLS.map((c, i) => [`shell${i}`, { ...FINISH[`shell${i}`], color: c }])),
};

// Materials for every part, each made by `make` from its settings (three's
// physical material by default; a `basic` one, the beam, is never lit).
// style: 'monster' for the Monster Gashapon's.
export function gashaponMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f }), style = 'capsule') {
  const out = {};
  for (const [k, f] of Object.entries(style === 'monster' ? { ...FINISH, ...MONSTER_FINISH } : FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  return out;
}

// ------------------------------------------------------------- shapes

// Many shapes, each placed by a matrix, as one (indexed or not).
export function bake(parts) {
  let count = 0;
  let indices = 0;
  for (const { g } of parts) {
    count += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const index = new Uint32Array(indices);
  const v3 = new THREE.Vector3();
  const n3 = new THREE.Matrix3();
  let v = 0;
  let t = 0;
  for (const { g, m } of parts) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    n3.getNormalMatrix(m);
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i).applyMatrix4(m).toArray(positions, (v + i) * 3);
      v3.fromBufferAttribute(nor, i).applyMatrix3(n3).normalize().toArray(normals, (v + i) * 3);
    }
    const n = g.index ? g.index.count : pos.count;
    for (let i = 0; i < n; i++) index[t + i] = (g.index ? g.index.array[i] : i) + v;
    v += pos.count;
    t += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

export const at = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, sy, sz));

// A box with rounded edges and corners, w x h x d, centred on the origin:
// an outline r in from each side, rounded off at its corners, with a bevel
// of r all round it (which grows the outline back out by r).
export function roundedBox(w, h, d, r, segs = 4) {
  const s = new THREE.Shape();
  const x = w / 2 - r;
  const y = h / 2 - r;
  const c = Math.min(r * 0.6, x * 0.5, y * 0.5);
  s.moveTo(-x + c, -y);
  s.lineTo(x - c, -y);
  s.quadraticCurveTo(x, -y, x, -y + c);
  s.lineTo(x, y - c);
  s.quadraticCurveTo(x, y, x - c, y);
  s.lineTo(-x + c, y);
  s.quadraticCurveTo(-x, y, -x, y - c);
  s.lineTo(-x, -y + c);
  s.quadraticCurveTo(-x, -y, -x + c, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segs, curveSegments: segs });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.deleteAttribute('uv');
  return g;
}

export const lathe = (pts, segs = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);

// The machine's measures.
export const GLOBE = { y: 0.755, r: 0.245 };
// Where the handle turns, and where a capsule comes out (the chute's mouth).
export const HANDLE = { x: 0, y: 0.31, z: -0.305 };
export const CHUTE = { x: 0, y: 0.12, z: -0.29 };
// A capsule's size.
export const CAPSULE_R = 0.041;

// Capsules tumbled into the globe: settled into its lower part, none
// overlapping, each turned its own way. [x, y, z, rx, ry, rz, shell].
export function packCapsules(seed = 7, r = CAPSULE_R) {
  const rng = new Rng(seed);
  const R = GLOBE.r - r - 0.012;
  const tries = [];
  for (let i = 0; i < 4000; i++) {
    const x = rng.range(-R, R);
    const y = rng.range(-R, R * 0.5);
    const z = rng.range(-R, R);
    if (x * x + y * y + z * z > R * R) continue;
    tries.push([x, y, z]);
  }
  tries.sort((a, b) => a[1] - b[1]);
  const out = [];
  for (const [x, y, z] of tries) {
    if (out.some((c) => (c[0] - x) ** 2 + (c[1] - GLOBE.y - y) ** 2 + (c[2] - z) ** 2 < (2 * r * 0.98) ** 2)) continue;
    out.push([x, GLOBE.y + y, z, rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.int(0, SHELLS.length - 1)]);
  }
  return out;
}

// A capsule's two halves (a dome each, open side down at the origin).
let halfShape = null;
export function capsuleHalf() {
  halfShape ??= new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  return halfShape;
}

const shapes = {};
// The machine's shapes, by material, made once for each style: { red:
// geometry, ... }, and the handle's on their own, to turn (about z, at
// HANDLE).
export function gashaponShapes(style = 'capsule') {
  if (shapes[style]) return shapes[style];
  const parts = {};
  const put = (kind, g, m) => (parts[kind] ??= []).push({ g, m });
  // The plinth and the cabinet.
  put('dark', roundedBox(0.66, 0.06, 0.66, 0.025), at(0, 0.03, 0));
  put('red', roundedBox(0.58, 0.46, 0.58, 0.06), at(0, 0.29, 0));
  // A yellow band round the cabinet near the top, and a white one under it.
  put('yellow', roundedBox(0.594, 0.045, 0.594, 0.02), at(0, 0.46, 0));
  put('white', roundedBox(0.592, 0.018, 0.592, 0.009), at(0, 0.425, 0));
  // The coin mechanism: a chrome plate on the front, the coin slot, and the
  // round boss the handle turns on.
  put('chrome', roundedBox(0.3, 0.3, 0.03, 0.012), at(0, 0.29, -0.29));
  put('dark', roundedBox(0.012, 0.05, 0.02, 0.005), at(0, 0.405, -0.302));
  put('chrome', new THREE.CylinderGeometry(0.085, 0.09, 0.03, 32), at(HANDLE.x, HANDLE.y, -0.31, Math.PI / 2));
  put('dark', new THREE.TorusGeometry(0.088, 0.006, 8, 32), at(HANDLE.x, HANDLE.y, -0.322));
  // The chute: a dark mouth in the cabinet, a chrome lip, and the smoked
  // flap a capsule pushes out through.
  put('dark', roundedBox(0.2, 0.1, 0.04, 0.015), at(CHUTE.x, CHUTE.y, -0.285));
  put('chrome', roundedBox(0.23, 0.02, 0.06, 0.008), at(CHUTE.x, CHUTE.y - 0.06, -0.3));
  put('smoke', roundedBox(0.19, 0.09, 0.008, 0.003), at(CHUTE.x, CHUTE.y + 0.004, -0.31, -0.18));
  // The collar the globe sits in, and its red cap with a chrome knob.
  put('chrome', lathe([[0.2, 0.515], [0.235, 0.515], [0.245, 0.525], [0.245, 0.56], [0.225, 0.575], [0.17, 0.575]]), at(0, 0, 0));
  put('red', lathe([[0.19, 0.902], [0.207, 0.905], [0.21, 0.93], [0.19, 0.968], [0.14, 1.0], [0.07, 1.016], [0, 1.019]]), at(0, 0, 0));
  put('chrome', new THREE.SphereGeometry(0.03, 18, 12), at(0, 1.028, 0));
  // The globe, and its inside seen through it.
  put('glass', new THREE.SphereGeometry(GLOBE.r, 40, 28), at(0, GLOBE.y, 0));
  put('glassBack', new THREE.SphereGeometry(GLOBE.r * 0.995, 32, 22), at(0, GLOBE.y, 0));
  // The capsules: coloured halves by colour, the clear ones all together.
  for (const [x, y, z, rx, ry, rz, shell] of packCapsules()) {
    const m = at(x, y, z, rx, ry, rz, CAPSULE_R);
    put(`shell${shell}`, capsuleHalf(), m);
    put('clear', capsuleHalf(), m.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI)));
  }
  // The Monster Gashapon's horns, curving up out of its cap, and its beam.
  if (style === 'monster') {
    for (const side of [-1, 1]) {
      put('horn', new THREE.ConeGeometry(0.045, 0.16, 12), at(side * 0.12, 1.04, 0, 0, 0, -side * 0.5));
      put('horn', new THREE.ConeGeometry(0.03, 0.1, 10), at(side * 0.18, 1.12, 0, 0, 0, -side * 1.0));
    }
    const beam = new THREE.CylinderGeometry(0.14, 0.2, BEAM, 20, 1, true);
    put('beam', beam, at(0, 1.05 + BEAM / 2, 0));
  }
  // The handle: a chrome bar across the boss, a knob at each end, and a
  // red grip in the middle — turned as a whole.
  const handle = [];
  handle.push({ kind: 'chrome', g: roundedBox(0.2, 0.042, 0.038, 0.016), m: at(0, 0, -0.025) });
  handle.push({ kind: 'chrome', g: new THREE.SphereGeometry(0.03, 18, 12), m: at(0.1, 0, -0.025) });
  handle.push({ kind: 'chrome', g: new THREE.SphereGeometry(0.03, 18, 12), m: at(-0.1, 0, -0.025) });
  handle.push({ kind: 'red', g: new THREE.CylinderGeometry(0.022, 0.022, 0.03, 18), m: at(0, 0, -0.05, Math.PI / 2) });
  const handleParts = {};
  for (const { kind, g, m } of handle) (handleParts[kind] ??= []).push({ g, m });
  shapes[style] = {
    body: Object.fromEntries(Object.entries(parts).map(([k, list]) => [k, bake(list)])),
    handle: Object.fromEntries(Object.entries(handleParts).map(([k, list]) => [k, bake(list)])),
  };
  return shapes[style];
}

// How tall the Monster Gashapon's beam of light goes up.
export const BEAM = 9;

// Drawn last of all, so what is behind the glass shows through it.
const ORDER = { glassBack: 1, clear: 2, glass: 3, smoke: 3, beam: 4 };

// A whole machine: a group of meshes in the materials given
// (gashaponMaterials), its handle in group.userData.handle, to turn.
export function gashaponModel(materials, style = 'capsule') {
  const s = gashaponShapes(style);
  const group = new THREE.Group();
  group.name = 'gashapon';
  for (const [k, g] of Object.entries(s.body)) {
    const m = new THREE.Mesh(g, materials[k]);
    m.renderOrder = ORDER[k] ?? 0;
    m.userData.shared = true;
    group.add(m);
  }
  const handle = new THREE.Group();
  handle.position.set(HANDLE.x, HANDLE.y, HANDLE.z);
  for (const [k, g] of Object.entries(s.handle)) {
    const m = new THREE.Mesh(g, materials[k]);
    m.userData.shared = true;
    handle.add(m);
  }
  group.add(handle);
  group.userData.handle = handle;
  return group;
}

// A capsule on its own, to come out of the chute and be opened: its
// coloured lid (userData.top) and clear cup (userData.bottom), each in a
// group of its own hinged at the back of the seam, so the lid can flip up.
export function capsuleModel(materials, shell = 0, r = CAPSULE_R) {
  const g = new THREE.Group();
  g.name = 'capsule';
  const hinge = (mat, flip) => {
    const h = new THREE.Group();
    h.position.set(0, 0, r);
    const m = new THREE.Mesh(capsuleHalf(), mat);
    m.scale.setScalar(r);
    m.position.set(0, 0, -r);
    if (flip) m.rotation.x = Math.PI;
    h.add(m);
    g.add(h);
    return h;
  };
  g.userData.bottom = hinge(materials.clear, true);
  g.userData.top = hinge(materials[`shell${shell}`], false);
  // A seam ring round the middle, so the two halves read as two.
  const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 1.002, r * 0.05, 6, 32), materials.white);
  seam.rotation.x = Math.PI / 2;
  g.add(seam);
  g.userData.seam = seam;
  return g;
}
