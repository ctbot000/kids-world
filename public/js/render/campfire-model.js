// A campfire as a real one looks (blocks.js CAMPFIRE), not made of boxes:
// a ring of grey stones round a bed of dark ash, logs leaning together in a
// little teepee over glowing embers, and tongues of flame licking up out of
// it, each one worked out in the same shader as a burning block's
// (render/fire.js), always turned to the camera.
//
// Laid out in a cell's units, its foot in the middle of the floor at the
// origin. The flames flicker by group.userData.tick(time), which
// render/terrain.js calls; the sparks and smoke that rise off it are the
// renderer's (render/renderer.js campfires).
import * as THREE from '../../vendor/three.module.js';
import { at, bake } from './gashapon-model.js';
import { FLAME_FRAG } from './fire.js';

// How each part takes the light: three's physical material settings.
export const CAMPFIRE_FINISH = {
  stone: { color: '#9aa0a8', roughness: 0.8, envMapIntensity: 0.4 },
  darkStone: { color: '#787e87', roughness: 0.85, envMapIntensity: 0.4 },
  ash: { color: '#3a3431', roughness: 0.95, envMapIntensity: 0.2 },
  bark: { color: '#7a4a2b', roughness: 0.75, envMapIntensity: 0.4 },
  // The cut ends of a log.
  cut: { color: '#e9c48f', roughness: 0.7, envMapIntensity: 0.4 },
  // The embers: never lit, they glow.
  ember: { basic: true, color: '#ff7a1f' },
  coal: { basic: true, color: '#ffc23d' },
};

// Upright: each flame turned round to the camera about its own root, which
// the model's matrix puts wherever the campfire stands.
export const FLAME_VERT = /* glsl */ `
  attribute vec3 center;
  attribute vec3 shape; // width, height, seed
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vec3 c = (modelMatrix * vec4(center, 1.0)).xyz;
    vec3 toCam = cameraPosition - c;
    vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
    vec3 p = c + right * position.x * shape.x + vec3(0.0, (position.y + 0.5) * shape.y, 0.0);
    vUv = uv;
    vSeed = shape.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

// What flames are drawn in, its uTime moved by the ticks: also the candles'
// on a birthday cake (render/party-model.js).
export const flameMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

// Flames as a shape, one quad each ([x, y, z, width, height, seed]: its root,
// and how big): its corners in position, its root and size beside them, for
// the shader to stand up and turn to the camera.
export function flameQuads(list) {
  const corners = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, -0.5, 0, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]];
  const pos = [];
  const uv = [];
  const center = [];
  const shape = [];
  for (const [x, y, z, w, h, seed] of list) {
    for (const [cx, cy, u, v] of corners) {
      pos.push(cx, cy, 0);
      uv.push(u, v);
      center.push(x, y, z);
      shape.push(w, h, seed);
    }
  }
  const flames = new THREE.BufferGeometry();
  flames.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  flames.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  flames.setAttribute('center', new THREE.Float32BufferAttribute(center, 3));
  flames.setAttribute('shape', new THREE.Float32BufferAttribute(shape, 3));
  return flames;
}

// Materials for every part, each made by `make` from its settings, and the
// flames' own, whose uTime the ticks move.
export function campfireMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(CAMPFIRE_FINISH)) {
    const { basic, ...rest } = f;
    out[k] = basic ? new THREE.MeshBasicMaterial(rest) : make(rest);
  }
  out.flame = flameMaterial();
  return out;
}

// The fire's measures: the ring of stones round it, and how high its
// flames reach (the cell is 1 high).
export const RING = { r: 0.34, stones: 10 };
export const FLAMES = [
  // [x, z, width, height, seed]: a big one in the middle, smaller round it.
  [0, 0, 0.5, 0.82, 0.13],
  [0.07, 0.05, 0.36, 0.62, 0.57],
  [-0.08, 0.03, 0.34, 0.58, 0.81],
  [0.01, -0.08, 0.32, 0.55, 0.36],
];

// A rough stone: a lumpy ball, squashed.
function stoneShape(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + Math.sin(i * 12.9898 + seed * 78.233) * 0.12;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

const shapes = {};

function campfireShapes() {
  if (shapes.fire) return shapes.fire;
  const parts = { stone: [], darkStone: [], ash: [], bark: [], cut: [], ember: [], coal: [] };
  // The bed of ash in the ring, and the ring of stones round it.
  parts.ash.push({ g: new THREE.CylinderGeometry(RING.r - 0.02, RING.r, 0.03, 24), m: at(0, 0.015, 0) });
  for (let i = 0; i < RING.stones; i++) {
    const a = (i / RING.stones) * Math.PI * 2 + 0.2;
    const s = 0.075 + ((i * 37) % 5) * 0.006;
    parts[i % 3 ? 'stone' : 'darkStone'].push({ g: stoneShape(i), m: at(Math.cos(a) * RING.r, s * 0.92, Math.sin(a) * RING.r, 0, -a + i, 0, s * 1.15, s * 0.8, s) });
  }
  // Logs leaning together over the middle, their tops meeting.
  const LOGS = 5;
  for (let i = 0; i < LOGS; i++) {
    const a = (i / LOGS) * Math.PI * 2 + 0.5;
    const len = 0.46;
    const log = new THREE.CylinderGeometry(0.03, 0.04, len, 10);
    log.translate(0, len / 2, 0);
    // From its foot out by the stones, tipped in towards the middle.
    parts.bark.push({ g: log, m: at(Math.cos(a) * 0.24, 0.025, Math.sin(a) * 0.24, 0, -a, 0).multiply(at(0, 0, 0, 0, 0, 0.6)) });
  }
  // A log lying across the front, a pale cut end at each end of it, and
  // the embers glowing under the teepee.
  const lying = at(0.02, 0.05, -0.15, 0, 0.4, Math.PI / 2);
  parts.bark.push({ g: new THREE.CylinderGeometry(0.04, 0.04, 0.42, 10), m: lying });
  for (const end of [1, -1]) {
    const g = new THREE.CircleGeometry(0.039, 12);
    g.rotateX(-Math.PI / 2);
    parts.cut.push({ g, m: lying.clone().multiply(at(0, end * 0.211, 0, end > 0 ? 0 : Math.PI)) });
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.04 + (i % 3) * 0.045;
    parts[i % 2 ? 'ember' : 'coal'].push({ g: new THREE.IcosahedronGeometry(0.03 + (i % 3) * 0.006, 0), m: at(Math.cos(a) * r, 0.04, Math.sin(a) * r) });
  }
  const body = {};
  for (const [k, l] of Object.entries(parts)) if (l.length) body[k] = bake(l);
  const flames = flameQuads(FLAMES.map(([x, z, w, h, seed]) => [x, 0.04, z, w, h, seed]));
  // Where the flames are, whichever way they turn.
  flames.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.45, 0), 0.6);
  flames.boundingBox = new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.25), new THREE.Vector3(0.25, 0.9, 0.25));
  shapes.fire = { body, flames };
  return shapes.fire;
}

// A whole campfire in the materials given (campfireMaterials).
export function campfireModel(materials) {
  const s = campfireShapes();
  const group = new THREE.Group();
  group.name = 'campfire';
  for (const [k, g] of Object.entries(s.body)) {
    const m = new THREE.Mesh(g, materials[k]);
    m.userData.shared = true;
    group.add(m);
  }
  const flames = new THREE.Mesh(s.flames, materials.flame);
  flames.renderOrder = 4;
  flames.userData.shared = true;
  flames.userData.flames = true;
  group.add(flames);
  group.userData.campfire = true;
  group.userData.tick = (time) => {
    materials.flame.uniforms.uTime.value = time;
  };
  return group;
}
