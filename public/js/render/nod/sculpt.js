// Shapes sculpted in the round for the frights of the Land of Nod: a few soft
// masses (balls, and limbs thick at one end and thin at the other) run together
// into one smooth skin, as the bodies of its skies are (ground.js) — and smoke,
// drifting off whatever is made of it.
import * as THREE from '../../../vendor/three.module.js';
import { gridLines, skinOver } from '../dog-sculpt.js';
import { NOISE } from './skins.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smin = (a, b, k) => {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

// How far (x, y, z) is from a mass: { a, b (its ends; b for a limb), r (thick
// there), r1 (and at b), s (squashed by, along each axis) }.
function massAt(m, x, y, z) {
  const [ax, ay, az] = m.a;
  if (!m.b) {
    if (!m.s) return Math.hypot(x - ax, y - ay, z - az) - m.r;
    const [sx, sy, sz] = m.s;
    const k = Math.hypot((x - ax) / sx, (y - ay) / sy, (z - az) / sz);
    return (k - m.r) * Math.min(sx, sy, sz);
  }
  const dx = m.b[0] - ax;
  const dy = m.b[1] - ay;
  const dz = m.b[2] - az;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - (m.r + ((m.r1 ?? m.r) - m.r) * t);
}

// The masses run together, k how softly, as one shape; paint: its colour, or
// paint(x, y, z) → one at each point. A mass with `cut` is taken out of it.
export function sculpted(masses, { k = 0.16, cell = 0.05, paint = '#ffffff' } = {}) {
  const field = {
    at(x, y, z) {
      let d = Infinity;
      for (const m of masses) if (!m.cut) d = d === Infinity ? massAt(m, x, y, z) : smin(d, massAt(m, x, y, z), m.k ?? k);
      for (const m of masses) if (m.cut) d = -smin(-d, massAt(m, x, y, z), m.k ?? k * 0.5);
      return d;
    },
  };
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const m of masses) {
    if (m.cut) continue;
    for (const [p, r] of [[m.a, m.r], ...(m.b ? [[m.b, m.r1 ?? m.r]] : [])]) {
      for (let i = 0; i < 3; i++) {
        const w = r * (m.s?.[i] ?? 1) + cell * 2;
        lo[i] = Math.min(lo[i], p[i] - w);
        hi[i] = Math.max(hi[i], p[i] + w);
      }
    }
  }
  const { points, tris } = skinOver(field, gridLines(lo[0], hi[0], cell), gridLines(lo[1], hi[1], cell), gridLines(lo[2], hi[2], cell));
  const n = points.length / 3;
  const normal = new Float32Array(points.length);
  const color = new Float32Array(points.length);
  const c = new THREE.Color(typeof paint === 'string' ? paint : '#ffffff');
  const e = cell * 0.5;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    const nx = field.at(x + e, y, z) - field.at(x - e, y, z);
    const ny = field.at(x, y + e, z) - field.at(x, y - e, z);
    const nz = field.at(x, y, z + e) - field.at(x, y, z - e);
    const l = Math.hypot(nx, ny, nz) || 1;
    normal.set([nx / l, ny / l, nz / l], i * 3);
    if (typeof paint !== 'string') c.set(paint(x, y, z));
    color.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(points, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(tris) : new Uint16Array(tris), 1));
  return g;
}

const VERT = /* glsl */ `
  attribute vec3 aAt;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uK;
  uniform float uSwirl;
  uniform vec3 uDrift;
  varying vec2 vUv;
  varying float vT;
  varying float vSeed;
  void main() {
    float t = fract(aSeed * 7.13 + uTime * (0.5 + 0.3 * aSeed));
    vec3 at = aAt + uDrift * t * (0.55 + 0.9 * fract(aSeed * 3.7));
    at += vec3(sin(uTime * 2.1 + aSeed * 40.0), sin(uTime * 1.7 + aSeed * 23.0), cos(uTime * 1.9 + aSeed * 31.0)) * uSwirl * (0.25 + t);
    vec4 mv = modelViewMatrix * vec4(at, 1.0);
    float a = aSeed * 6.28 + uTime * (aSeed - 0.5) * 1.4;
    vec2 c = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
    mv.xy += c * uSize * (0.5 + 0.5 * fract(aSeed * 11.3)) * (0.6 + 0.8 * t) * uK * length(modelMatrix[0].xyz);
    vUv = position.xy;
    vT = t;
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  ${NOISE}
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uCold;
  uniform float uGlow;
  uniform float uBody;
  varying vec2 vUv;
  varying float vT;
  varying float vSeed;
  void main() {
    float d = length(vUv);
    float n = nFbm(vec3(vUv * 1.6, vSeed * 37.0 + uTime * 0.35));
    float a = smoothstep(1.0, 0.15, d + (n - 0.5) * 1.1) * sin(3.14159 * clamp(vT, 0.0, 1.0));
    if (a < 0.004) discard;
    vec3 col = mix(uHot, uCold, smoothstep(0.0, 0.75, vT + (0.5 - n) * 0.5));
    // (Both its own dark body and a light of its own.)
    gl_FragColor = vec4(col * a * uGlow, a * uBody);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Smoke drifting off a line of points (in the axes of whatever it is added to):
// n puffs of it, about size across, carried drift before each is gone.
export class Plume {
  constructor(points, { n = 44, size = 0.4, drift = [0, 0.3, -0.5], swirl = 0.07, hot = '#d88cff', cold = '#3a1a8a', glow = 0.85, body = 0.5, spread = 0.05 } = {}) {
    const quad = new THREE.PlaneGeometry(2, 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    const at = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    let h = 7;
    const rnd = () => ((h = Math.imul(h, 48271) >>> 0) % 100003) / 100003;
    for (let i = 0; i < n; i++) {
      const s = (i / Math.max(1, n - 1)) * (points.length - 1);
      const j = Math.min(points.length - 2, Math.floor(s));
      for (let a = 0; a < 3; a++) at[i * 3 + a] = points[j][a] + (points[Math.min(j + 1, points.length - 1)][a] - points[j][a]) * (s - j) + (rnd() - 0.5) * 2 * spread;
      seed[i] = rnd();
    }
    g.setAttribute('aAt', new THREE.InstancedBufferAttribute(at, 3));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    g.instanceCount = n;
    this.uniforms = { uTime: { value: 0 }, uSize: { value: size }, uK: { value: 1 }, uSwirl: { value: swirl }, uDrift: { value: new THREE.Vector3(...drift) }, uHot: { value: new THREE.Color(hot) }, uCold: { value: new THREE.Color(cold) }, uGlow: { value: glow }, uBody: { value: body } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.userData.noShadow = true;
    this.mesh.userData.noFlash = true;
    this.drift = new THREE.Vector3(...drift);
  }

  // time, and how much of it there is (k) and how fast it streams off (stream).
  update(time, k = 1, stream = 1) {
    this.uniforms.uTime.value = time;
    this.uniforms.uK.value = k;
    this.uniforms.uDrift.value.copy(this.drift).multiplyScalar(stream);
    this.mesh.visible = k > 0.02;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
