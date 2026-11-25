// What the things of the Land of Nod are made of (dress.js): shapes painted each
// its own colour and merged into one, lit as its ground is (light.js), soft as
// cloth, shiny as a button, or metal.
import * as THREE from '../../../vendor/three.module.js';
import { NOISE } from './skins.js';
import { nodMaterial } from './light.js';

const tmpV = new THREE.Vector3();
const tmpN = new THREE.Matrix3();

// Where a part goes: at (x, y, z), sized (s: one number, or three), turned.
export function where(x = 0, y = 0, z = 0, s = 1, rx = 0, ry = 0, rz = 0) {
  const k = Array.isArray(s) ? s : [s, s, s];
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(...k));
}

// The same, for a part standing up its y turned to point along d.
export function along(x, y, z, d, s = 1) {
  const k = Array.isArray(s) ? s : [s, s, s];
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d).normalize()), new THREE.Vector3(...k));
}

// Parts ([geometry, colour, matrix] each) as one shape, each point with its
// part's colour. tint: a part of colour null takes the instance's own.
export function painted(parts) {
  let count = 0;
  let idx = 0;
  for (const [g] of parts) {
    count += g.attributes.position.count;
    idx += g.index ? g.index.count : g.attributes.position.count;
  }
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const index = new Uint32Array(idx);
  const c = new THREE.Color();
  let v = 0;
  let t = 0;
  for (const [g, paint, m = where()] of parts) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    tmpN.getNormalMatrix(m);
    c.set(paint ?? '#ffffff');
    for (let i = 0; i < pos.count; i++) {
      tmpV.fromBufferAttribute(pos, i).applyMatrix4(m).toArray(position, (v + i) * 3);
      tmpV.fromBufferAttribute(nor, i).applyMatrix3(tmpN).normalize().toArray(normal, (v + i) * 3);
      color.set([c.r, c.g, c.b], (v + i) * 3);
    }
    const n = g.index ? g.index.count : pos.count;
    for (let i = 0; i < n; i++) index[t + i] = (g.index ? g.index.array[i] : i) + v;
    v += pos.count;
    t += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.setIndex(new THREE.BufferAttribute(count > 65535 ? index : new Uint16Array(index), 1));
  return out;
}

// Their materials. (The colour is the paint's; darker in the folds near the
// ground they stand on.)
const FINISH = {
  soft: { params: { roughness: 0.95 }, skin: 'albedo *= 0.96 + 0.04 * sin(p.x * 31.0) * sin(p.y * 31.0) * sin(p.z * 31.0); rough = 0.95; fuzz = 0.5;' },
  plain: { params: { roughness: 0.6 }, skin: 'rough = 0.6; fuzz = 0.12;' },
  gloss: { params: { roughness: 0.22, envMapIntensity: 0.9 }, skin: 'rough = 0.22;' },
  // A dark coat, a little sheen to it, its edges catching what light there is.
  coat: { params: { roughness: 0.6, envMapIntensity: 0.4 }, skin: 'rough = 0.6; fuzz = 0.6;' },
  metal: { params: { roughness: 0.36, metalness: 0.45, envMapIntensity: 0.8 }, skin: 'rough = 0.36;' },
  crystal: { params: { roughness: 0.12, envMapIntensity: 1.2 }, skin: 'rough = 0.12; glow = albedo * 0.3;' },
  ember: { params: { roughness: 0.5 }, skin: 'glow = albedo * 0.35;' },
  glow: { params: { roughness: 0.6 }, skin: 'glow = albedo * 0.75;' },
  // As if made of light (a weapon's soul: frights-souls.js): its edges shining.
  spirit: { params: { roughness: 0.3, envMapIntensity: 0.6 }, skin: 'float edge = 1.0 - abs(dot(normalize(vNodN), normalize(cameraPosition - w))); rough = 0.3; fuzz = 0.3; glow = albedo * 0.14 + albedo / max(0.12, max(albedo.r, max(albedo.g, albedo.b))) * edge * edge * (0.25 + 0.5 * edge);' },
};
const mats = new Map();
export function finishOf(name, mode = 'instanced') {
  const key = `${name}|${mode}`;
  if (!mats.has(key)) {
    const f = FINISH[name] ?? FINISH.plain;
    mats.set(key, nodMaterial({ vertexColors: true, ...f.params }, { skin: f.skin, head: NOISE, key: `kit-${name}`, mode }));
  }
  return mats.get(key);
}

// A spot's frame as a matrix: standing up its up, facing its dir, k times as big.
const mx = new THREE.Vector3();
const my = new THREE.Vector3();
const mz = new THREE.Vector3();
export function frameOf(s, k = s.k ?? 1, out = new THREE.Matrix4(), lift = 0) {
  my.set(s.up.x, s.up.y, s.up.z);
  mz.set(s.dir.x, s.dir.y, s.dir.z);
  mx.crossVectors(my, mz).normalize();
  mz.crossVectors(mx, my);
  out.makeBasis(mx.multiplyScalar(k), tmpV.copy(my).multiplyScalar(k), mz.multiplyScalar(k));
  out.setPosition(s.x + my.x * lift, s.y + my.y * lift, s.z + my.z * lift);
  return out;
}

// The way things are turned, up their own up and facing dir.
export function quatOf(up, dir, out = new THREE.Quaternion()) {
  my.set(up.x, up.y, up.z);
  mz.set(dir.x, dir.y, dir.z);
  mx.crossVectors(my, mz).normalize();
  mz.crossVectors(mx, my);
  return out.setFromRotationMatrix(tmpM.makeBasis(mx, my, mz));
}
const tmpM = new THREE.Matrix4();
