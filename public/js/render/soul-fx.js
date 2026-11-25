// What a soul weapon's swing looks like (shared/souls.js): a show for every soul
// that is in it, in the island, or the sky of a dream, round whoever swung it —
// Starfall's crescent of starlight, Prisma thrown out and back along a rainbow,
// Wildheart's spirit wolf, Clarion's great bell, Doodle's stroke of wet paint and
// Lullaby's moon. And the pillar of light out of a golden chest with a part of one
// in it (PartBeam).
//
// Each is made for its moment and gone after it: update returns false once it is
// over (renderer.js bossFx). frame: where and which way — { p (a point, about waist
// high), q (a turn: forward +z, up +y) }.
import * as THREE from '../../vendor/three.module.js';
import { soulOf } from '../shared/souls.js';
import { gameKit, halo, soulBody, soulPart } from './soul-models.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - (1 - k) ** 3;

const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm2(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.07 + 11.3) * 0.28 + vnoise(p * 4.1 + 3.7) * 0.17; }
  vec3 hue3(float h) {
    vec3 k = abs(fract(vec3(h, h + 2.0 / 3.0, h + 1.0 / 3.0)) * 6.0 - 3.0) - 1.0;
    return clamp(k, 0.0, 1.0);
  }
`;
const PLAIN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Both a body of its own and a light of its own: rgb added, as much of what is
// behind it left as a leaves.
const GLOWING = { transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

const shader = (uniforms, fragmentShader, vertexShader = PLAIN_VERT, more = {}) => new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader: `${NOISE}\n${fragmentShader}`, ...GLOWING, ...more });
const C = (c) => ({ value: new THREE.Color(c) });

// A show, its meshes in a group put where frame says.
class Show {
  constructor(scene, frame, secs) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.copy(frame.p);
    this.group.quaternion.copy(frame.q);
    this.group.traverse((o) => (o.frustumCulled = false));
    scene.add(this.group);
    this.secs = secs;
    this.t = 0;
    this.mats = [];
    this.geos = [];
  }

  mesh(geometry, material, own = true) {
    const m = new THREE.Mesh(geometry, material);
    m.frustumCulled = false;
    m.renderOrder = 6;
    m.userData.noShadow = true;
    this.group.add(m);
    if (own) this.geos.push(geometry);
    if (!this.mats.includes(material)) this.mats.push(material);
    return m;
  }

  // A point of its own, in the world.
  at(x, y, z, out = V()) {
    return out.set(x, y, z).applyQuaternion(this.group.quaternion).add(this.group.position);
  }

  way(x, y, z, out = V()) {
    return out.set(x, y, z).applyQuaternion(this.group.quaternion);
  }

  update(dt) {
    this.t += dt;
    const k = this.t / this.secs;
    if (k >= 1) {
      this.dispose();
      return false;
    }
    this.step(k, dt);
    return true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) if (m.isShaderMaterial) m.dispose();
  }
}

// ---------------------------------------------------------------- Starfall

// A crescent blade of light, thick in the middle, its points swept back.
function crescent(R = 1.5, half = 1.35, thick = 0.5, tall = 0.3, seg = 30) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = (i / seg) * 2 - 1;
    const a = u * half;
    const s = Math.cos(u * Math.PI * 0.5) ** 0.75;
    const ring = [[R + 0.08 * s, 0, 0], [R - 0.12 * s, tall * s, 0.5], [R - thick * s, 0, 1], [R - 0.12 * s, -tall * s, 0.5]];
    for (const [r, y, v] of ring) {
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r - R * 0.75);
      uv.push(i / seg, v);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < 4; j++) {
      const a = i * 4 + j;
      const b = i * 4 + ((j + 1) % 4);
      idx.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const WAVE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOn;
  uniform vec3 uA;
  uniform vec3 uB;
  void main() {
    float edge = 1.0 - vUv.y;
    float ends = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float run = fbm2(vec2(vUv.x * 9.0, vUv.y * 2.0 + uTime * 5.0));
    vec3 col = mix(uB, uA, smoothstep(0.1, 0.75, edge));
    col = mix(col, vec3(1.0), smoothstep(0.62, 0.95, edge));
    float a = (0.25 + 0.75 * smoothstep(0.0, 0.5, edge)) * (0.65 + 0.5 * run) * ends * uOn;
    gl_FragColor = vec4(col * a * 1.25, min(1.0, a * 0.85));
    #include <colorspace_fragment>
  }
`;

class StarWave extends Show {
  constructor(scene, effects, frame, { far = 8, size = 1 } = {}) {
    super(scene, frame, 0.62);
    this.effects = effects;
    this.far = far;
    this.mat = shader({ uTime: { value: 0 }, uOn: { value: 1 }, uA: C('#ffe27a'), uB: C('#4fa8ff') }, WAVE_FRAG);
    this.waves = [[0, 1, 0.12], [0.5, 0.86, -0.1], [-0.5, 0.86, -0.1]].map(([roll, s, late]) => {
      const m = this.mesh(crescent(), this.mat);
      m.rotation.z = roll;
      m.userData = { s: s * size, late };
      return m;
    });
    this.light = halo('#ffe9a0', 2.6 * size, 0.55);
    this.group.add(this.light);
    this.size = size;
    this.step(0, 0);
  }

  step(k, dt) {
    const go = easeOut(clamp01(k * 1.05));
    this.mat.uniforms.uTime.value = this.t;
    this.mat.uniforms.uOn.value = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
    for (const m of this.waves) {
      m.position.z = 0.6 + go * this.far * (1 - Math.max(0, m.userData.late));
      m.scale.setScalar(m.userData.s * (0.55 + 0.75 * go));
    }
    this.light.position.z = this.waves[0].position.z + 0.4;
    this.light.scale.setScalar(2.6 * this.size * (1 - k * 0.6));
    const n = dt > 0 ? Math.round(dt * 130) : 0;
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 2.6 * this.size;
      const p = this.at(x, (Math.random() - 0.5) * 0.5, this.waves[0].position.z - Math.abs(x) * 0.35);
      const v = this.way((Math.random() - 0.5) * 1.5, Math.random() * 1.2, 1 + Math.random() * 2);
      this.effects.add(i % 3 ? 'sparkle' : 'star', p.x, p.y, p.z, { vx: v.x, vy: v.y, vz: v.z, straight: true, size: 0.16 + Math.random() * 0.2, life: 0.45 + Math.random() * 0.35, drag: 2, spin: 5, color: ['#fff3a0', '#ffd84d', '#ffffff', '#9fd8ff'][i % 4] });
    }
  }
}

// ---------------------------------------------------------------- Prisma

const ROAD_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uLaid;
  uniform float uOn;
  uniform float uTime;
  void main() {
    if (vUv.x > uLaid) discard;
    float d = abs(vUv.y - 0.5) * 2.0;
    vec3 col = pow(mix(vec3(1.0), hue3(vUv.y * 0.8), 0.86), vec3(1.6));
    float run = 0.78 + 0.22 * sin(vUv.x * 46.0 - uTime * 26.0);
    float head = smoothstep(uLaid - 0.12, uLaid, vUv.x);
    float a = (1.0 - smoothstep(0.82, 1.0, d)) * uOn * (0.34 + 0.5 * head) * smoothstep(0.0, 0.06, vUv.x);
    gl_FragColor = vec4(col * a * run * 1.5, a * 0.7);
    #include <colorspace_fragment>
  }
`;

// The ring's way out and back: a loop to the one side of straight ahead.
const loopAt = (k, far) => {
  const s = Math.sin(k * Math.PI);
  return [Math.sin(k * TAU) * far * 0.16, 0.12 + s * 0.2, 0.5 + s * far];
};

class RingFlight extends Show {
  constructor(scene, effects, frame, { far = 7, size = 1, secs = 0.78 } = {}) {
    super(scene, frame, secs + 0.3);
    this.effects = effects;
    this.fly = secs;
    this.far = far;
    this.ring = new THREE.Group();
    const body = soulBody('rainbow', gameKit());
    body.position.y = -0.42;
    const turn = new THREE.Group();
    turn.add(body);
    // (Lying flat, and spinning round.)
    this.spin = new THREE.Group();
    turn.rotation.x = Math.PI / 2;
    this.spin.add(turn);
    this.ring.add(this.spin);
    this.ring.scale.setScalar(1.75 * size);
    this.group.add(this.ring);
    this.light = halo('#ffffff', 2.4 * size, 0.4);
    this.group.add(this.light);
    // The road of every colour it lays.
    const n = 48;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const [x, y, z] = loopAt(i / n, far);
      const [x2, , z2] = loopAt(Math.min(1, i / n + 0.01), far);
      const [x1, , z1] = loopAt(Math.max(0, i / n - 0.01), far);
      const d = Math.hypot(x2 - x1, z2 - z1) || 1;
      const w = 0.62 * size;
      const sx = ((z2 - z1) / d) * w;
      const sz = (-(x2 - x1) / d) * w;
      pos.push(x + sx, y, z + sz, x - sx, y, z - sz);
      uv.push(i / n, 0, i / n, 1);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mat = shader({ uLaid: { value: 0 }, uOn: { value: 1 }, uTime: { value: 0 } }, ROAD_FRAG);
    this.mesh(g, this.mat);
    this.step(0, 0);
  }

  step(_, dt) {
    const k = clamp01(this.t / this.fly);
    const e = k < 0.5 ? 0.5 * easeOut(k * 2) : 1 - 0.5 * easeOut((1 - k) * 2);
    const [x, y, z] = loopAt(e, this.far);
    this.ring.position.set(x, y, z);
    this.ring.visible = k < 1;
    this.spin.rotation.y = -this.t * 22;
    this.ring.rotation.z = Math.sin(this.t * 9) * 0.16;
    this.light.position.set(x, y, z);
    this.light.visible = k < 1;
    this.mat.uniforms.uLaid.value = e;
    this.mat.uniforms.uTime.value = this.t;
    this.mat.uniforms.uOn.value = k < 1 ? 1 : 1 - (this.t - this.fly) / 0.3;
    const n = k < 1 && dt > 0 ? Math.round(dt * 90) : 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const p = this.at(x + Math.sin(a) * 0.62, y, z + Math.cos(a) * 0.62);
      const c = new THREE.Color().setHSL(a / TAU, 1, 0.62, THREE.SRGBColorSpace);
      this.effects.add('sparkle', p.x, p.y, p.z, { vy: 0.3, size: 0.14 + Math.random() * 0.14, life: 0.4 + Math.random() * 0.3, color: `#${c.getHexString()}`, spin: 6 });
    }
  }
}

// ---------------------------------------------------------------- Wildheart

// A wolf made of light, leaping: nose at +z.
let wolfShape = null;
function wolf() {
  if (wolfShape) return wolfShape;
  const tube = (pts, rs, seg = 10, round = 8) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)));
    const fr = curve.computeFrenetFrames(seg, false);
    const pos = [];
    const idx = [];
    const p = V();
    for (let i = 0; i <= seg; i++) {
      curve.getPointAt(i / seg, p);
      const s = (i / seg) * (rs.length - 1);
      const j = Math.min(rs.length - 2, Math.floor(s));
      const r = rs[j] + (rs[j + 1] - rs[j]) * (s - j);
      for (let k = 0; k < round; k++) {
        const a = (k / round) * TAU;
        pos.push(p.x + (fr.normals[i].x * Math.cos(a) + fr.binormals[i].x * Math.sin(a)) * r, p.y + (fr.normals[i].y * Math.cos(a) + fr.binormals[i].y * Math.sin(a)) * r, p.z + (fr.normals[i].z * Math.cos(a) + fr.binormals[i].z * Math.sin(a)) * r);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let k = 0; k < round; k++) {
        const a = i * round + k;
        const b = i * round + ((k + 1) % round);
        idx.push(a, b, a + round, b, b + round, a + round);
      }
    }
    return { pos, idx };
  };
  const parts = [
    tube([[0, 0.02, -0.78], [0, 0.1, -0.5], [0, 0.06, -0.05], [0, 0.1, 0.42], [0, 0.16, 0.6]], [0.1, 0.23, 0.21, 0.29, 0.2], 18, 12),
    tube([[0, 0.18, 0.5], [0, 0.36, 0.72], [0, 0.46, 0.9]], [0.24, 0.2, 0.17], 8, 10),
    tube([[0, 0.48, 0.82], [0, 0.46, 1.02], [0, 0.4, 1.2], [0, 0.37, 1.34]], [0.18, 0.17, 0.09, 0.045], 12, 10),
    ...[-1, 1].flatMap((s) => [
      tube([[s * 0.1, 0.58, 0.86], [s * 0.14, 0.72, 0.82], [s * 0.15, 0.84, 0.76]], [0.08, 0.06, 0.006], 6, 6),
      tube([[s * 0.14, 0.02, 0.46], [s * 0.15, -0.16, 0.72], [s * 0.14, -0.14, 1.02], [s * 0.13, -0.1, 1.18]], [0.12, 0.085, 0.06, 0.07], 10, 7),
      tube([[s * 0.14, 0.04, -0.55], [s * 0.16, -0.14, -0.8], [s * 0.14, -0.1, -1.06], [s * 0.13, -0.2, -1.22]], [0.15, 0.1, 0.06, 0.07], 10, 7),
    ]),
    tube([[0, 0.12, -0.74], [0, 0.28, -0.98], [0, 0.3, -1.25], [0, 0.22, -1.5]], [0.08, 0.14, 0.12, 0.01], 12, 8),
  ];
  const pos = [];
  const idx = [];
  for (const p of parts) {
    const n = pos.length / 3;
    pos.push(...p.pos);
    idx.push(...p.idx.map((i) => i + n));
  }
  wolfShape = new THREE.BufferGeometry();
  wolfShape.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wolfShape.setIndex(idx);
  wolfShape.computeVertexNormals();
  return wolfShape;
}

export const GHOST_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vP;
  uniform float uTime;
  uniform float uGallop;
  void main() {
    vec3 p = position;
    // Its legs, gathered under it and flung out.
    float leg = smoothstep(0.02, -0.2, p.y);
    p.z += sin(uTime * 19.0 + sign(p.z) * 1.6) * 0.16 * leg * uGallop;
    p.y += sin(uTime * 9.5 - p.z * 2.0) * 0.05 * uGallop;
    vP = p;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vE = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
export const GHOST_FRAG = /* glsl */ `
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vP;
  uniform float uTime;
  uniform float uOn;
  uniform vec3 uA;
  uniform vec3 uB;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vE))), 1.6);
    float flow = fbm2(vec2(vP.z * 3.0 - uTime * 3.0, vP.y * 4.0 + uTime));
    vec3 col = mix(uB, uA, clamp(rim + flow * 0.45, 0.0, 1.0));
    col = mix(col, vec3(1.0), smoothstep(0.75, 1.0, rim) * 0.6);
    float a = (0.22 + rim * 0.75 + flow * 0.2) * uOn;
    gl_FragColor = vec4(col * a * 1.25, min(1.0, a * 0.8));
    #include <colorspace_fragment>
  }
`;

// The wolf, through points of the world one leap after another (or, with one,
// on a way and gone), up being which way is up there.
export class SpiritWolf {
  constructor(scene, effects, points, up = V(0, 1, 0), { size = 1, leap = 0.2 } = {}) {
    this.effects = effects;
    this.points = points.map((p) => V(p.x, p.y, p.z));
    this.up = up.clone().normalize();
    this.leap = leap;
    this.t = 0;
    this.mat = shader({ uTime: { value: 0 }, uOn: { value: 1 }, uGallop: { value: 1 }, uA: C('#c9ff7a'), uB: C('#2fae5a') }, GHOST_FRAG, GHOST_VERT);
    this.mesh = new THREE.Mesh(wolf(), this.mat);
    this.mesh.scale.setScalar(1.05 * size);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.userData.noShadow = true;
    this.group = new THREE.Group();
    this.light = halo('#aaff7a', 2.6 * size, 0.4);
    this.group.add(this.mesh, this.light);
    scene.add(this.group);
    this.total = (this.points.length - 1) * leap + 0.28;
    this.at = V();
    this.m = new THREE.Matrix4();
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.total) {
      this.group.removeFromParent();
      this.mat.dispose();
      return false;
    }
    const last = this.points.length - 1;
    const s = Math.min(last - 1e-4, this.t / this.leap);
    const i = Math.max(0, Math.floor(s));
    const k = s - i;
    const a = this.points[i];
    const b = this.points[i + 1] ?? a;
    const done = this.t > last * this.leap;
    const way = b.clone().sub(a);
    const len = way.length() || 1;
    way.divideScalar(len);
    this.at.copy(a).lerp(b, done ? 1 : k).addScaledVector(this.up, Math.sin(k * Math.PI) * Math.min(0.9, len * 0.2) * (done ? 0 : 1) - 0.1);
    if (done) this.at.addScaledVector(way, (this.t - last * this.leap) * 5).addScaledVector(this.up, (this.t - last * this.leap) * 1.6);
    this.group.position.copy(this.at);
    // Nose the way it goes, its back up.
    const z = way.clone().addScaledVector(this.up, done ? 0.3 : Math.cos(k * Math.PI) * 0.4).normalize();
    const x = this.up.clone().cross(z).normalize();
    const y = z.clone().cross(x);
    this.group.quaternion.setFromRotationMatrix(this.m.makeBasis(x, y, z));
    this.mat.uniforms.uTime.value = this.t;
    const out = done ? 1 - (this.t - last * this.leap) / 0.28 : 1;
    this.mat.uniforms.uOn.value = Math.min(1, this.t * 14) * out;
    this.light.visible = out > 0.3;
    const n = dt > 0 ? Math.round(dt * 90) : 0;
    for (let j = 0; j < n; j++) {
      const p = this.at.clone().addScaledVector(z, -0.6 + Math.random() * 1.4).addScaledVector(x, (Math.random() - 0.5) * 0.7).addScaledVector(y, (Math.random() - 0.4) * 0.7);
      this.effects.add(j % 3 ? 'drop' : 'sparkle', p.x, p.y, p.z, { vx: (Math.random() - 0.5) * 1.2 - z.x * 2, vy: (Math.random() - 0.5) * 1.2 - z.y * 2, vz: (Math.random() - 0.5) * 1.2 - z.z * 2, straight: true, size: 0.12 + Math.random() * 0.14, life: 0.4 + Math.random() * 0.35, spin: 5, color: ['#8fe06a', '#c9ff8a', '#ffd84d', '#4fae5a'][j % 4] });
    }
    return true;
  }
}

// Three claws' worth of cuts through the air in front.
const CLAW_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uK;
  uniform vec3 uA;
  void main() {
    float d = abs(vUv.y - 0.5) * 2.0;
    float shown = smoothstep(uK * 1.5 - 0.12, uK * 1.5 - 0.35, vUv.x) * smoothstep(uK * 1.5 - 1.0, uK * 1.5 - 0.5, vUv.x);
    float w = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159);
    float body = 1.0 - smoothstep(w * 0.4, w * 0.95, d);
    float core = 1.0 - smoothstep(0.0, w * 0.45, d);
    float a = body * shown;
    gl_FragColor = vec4(mix(uA, vec3(1.0), core) * a * 1.4, a * 0.85);
    #include <colorspace_fragment>
  }
`;

class Claws extends Show {
  constructor(scene, frame, { size = 1 } = {}) {
    super(scene, frame, 0.4);
    this.mat = shader({ uK: { value: 0 }, uA: C('#a9f06a') }, CLAW_FRAG);
    for (let c = 0; c < 3; c++) {
      const n = 18;
      const pos = [];
      const uv = [];
      const idx = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const a = -0.9 + k * 1.8;
        const r = 1.75 * size;
        const tilt = (0.5 - k) * 1.5;
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        const y = tilt + (c - 1) * 0.36;
        pos.push(x, y + 0.13, z, x, y - 0.13, z);
        uv.push(k, 0, k, 1);
        if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      this.mesh(g, this.mat);
    }
  }

  step(k) {
    this.mat.uniforms.uK.value = k * 1.35;
  }
}

// ---------------------------------------------------------------- Clarion

const RIPPLE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uK;
  uniform vec3 uA;
  uniform vec3 uB;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    float wave = 0.0;
    for (int i = 0; i < 3; i++) {
      float at = uK * 1.25 - float(i) * 0.16;
      float w = exp(-pow((r - at) / 0.035, 2.0)) + 0.35 * exp(-pow((r - at + 0.05) / 0.07, 2.0));
      wave += w * (1.0 - float(i) * 0.24) * step(0.0, at);
    }
    float fine = 0.75 + 0.25 * sin(r * 130.0 - uK * 60.0);
    float a = wave * fine * (1.0 - smoothstep(0.85, 1.0, r)) * (1.0 - smoothstep(0.72, 1.0, uK));
    vec3 col = mix(uB, uA, clamp(wave, 0.0, 1.0));
    gl_FragColor = vec4(col * a * 1.5, min(1.0, a * 0.7));
    #include <colorspace_fragment>
  }
`;

let bellShape = null;
const bell = () => (bellShape ??= new THREE.LatheGeometry([[0.02, 1.5], [0.36, 1.46], [0.52, 1.28], [0.6, 0.95], [0.68, 0.6], [0.8, 0.3], [1.0, 0.06], [1.04, -0.04], [0.98, -0.06], [0.82, 0.16], [0.62, 0.55], [0.5, 1.1], [0.02, 1.36]].map(([x, y]) => new THREE.Vector2(x, y)), 40));

class BellToll extends Show {
  constructor(scene, effects, frame, { reach = 4, size = 1 } = {}) {
    super(scene, frame, 0.95);
    this.effects = effects;
    this.reach = reach;
    this.mat = shader({ uK: { value: 0 }, uA: C('#fff3b0'), uB: C('#ffb52e') }, RIPPLE_FRAG);
    const flat = this.mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    flat.rotation.x = -Math.PI / 2;
    flat.position.y = -0.82;
    flat.scale.setScalar(reach * 1.15);
    const high = this.mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    high.rotation.x = -Math.PI / 2;
    high.position.y = 0.15;
    high.scale.setScalar(reach * 0.95);
    this.ghost = shader({ uTime: { value: 0 }, uOn: { value: 0 }, uGallop: { value: 0 }, uA: C('#fff0a8'), uB: C('#ff9d1f') }, GHOST_FRAG, GHOST_VERT);
    this.swing = new THREE.Group();
    this.swing.position.set(0, 3.1 * size, -0.1);
    const m = new THREE.Mesh(bell(), this.ghost);
    m.position.y = -1.5;
    m.frustumCulled = false;
    m.renderOrder = 6;
    m.userData.noShadow = true;
    this.mats.push(this.ghost);
    this.swing.add(m);
    this.swing.scale.setScalar(1.05 * size);
    this.group.add(this.swing);
    this.light = halo('#ffd97a', 3.4 * size, 0.4);
    this.light.position.set(0, 2.2 * size, 0);
    this.group.add(this.light);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const p = this.at(Math.sin(a) * 0.8, -0.1, Math.cos(a) * 0.8);
      const v = this.way(Math.sin(a) * reach * 1.5, 0.8, Math.cos(a) * reach * 1.5);
      effects.add(i % 2 ? 'note' : 'sparkle', p.x, p.y, p.z, { vx: v.x, vy: v.y, vz: v.z, straight: true, size: 0.26, life: 0.7, drag: 2.2, spin: 3, color: ['#ffd84d', '#fff3b0', '#ffb84d'][i % 3] });
    }
    this.step(0, 0);
  }

  step(k) {
    this.mat.uniforms.uK.value = k;
    this.ghost.uniforms.uTime.value = this.t;
    this.ghost.uniforms.uOn.value = Math.min(1, this.t * 9) * (1 - clamp01((k - 0.6) / 0.4));
    this.swing.rotation.x = Math.sin(this.t * 15) * 0.5 * (1 - k * 0.7);
    this.light.scale.setScalar(3.4 * (1 - k));
  }
}

// ---------------------------------------------------------------- Doodle

const PAINT_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uLaid;
  uniform float uGone;
  uniform float uSeed;
  uniform vec3 uInk[6];
  void main() {
    float u = vUv.x;
    float v = vUv.y;
    // Laid on from one end, ragged in front as bristles are.
    float bristle = vnoise(vec2(v * 34.0 + uSeed, 1.0));
    float front = uLaid * 1.12 - bristle * 0.1;
    if (u > front) discard;
    float rag = vnoise(vec2(u * 16.0 + uSeed, v * 3.0));
    float edge = min(v, 1.0 - v);
    if (edge < 0.05 + 0.06 * rag) discard;
    // Dry and gone by and by, in streaks.
    float dry = vnoise(vec2(u * 5.0 - uSeed, v * 40.0)) * 0.6 + vnoise(vec2(u * 24.0, v * 9.0 + uSeed)) * 0.4;
    if (dry < uGone * 1.25 - 0.15) discard;
    float lane = clamp(v * 6.0 + (vnoise(vec2(u * 7.0, v * 12.0 + uSeed)) - 0.5) * 1.1, 0.0, 5.999);
    int i = int(lane);
    vec3 col = uInk[0];
    for (int k = 0; k < 6; k++) if (k == i) col = uInk[k];
    float streak = vnoise(vec2(u * 3.0 + uSeed, v * 60.0));
    col *= 0.82 + 0.3 * streak;
    // Wet: a light along each ridge of it.
    float shine = smoothstep(0.78, 0.96, vnoise(vec2(u * 2.2 + uSeed * 2.0, v * 44.0)));
    col = mix(col, vec3(1.0), shine * 0.55);
    float line = 1.0 - smoothstep(0.0, 0.035, edge - 0.05 - 0.06 * rag);
    col = mix(col, vec3(0.09, 0.07, 0.2), line);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
const INKS = ['#ff2f62', '#ff8f12', '#ffe02a', '#22cf63', '#1f9bff', '#a03fff'];

class PaintStroke extends Show {
  constructor(scene, effects, frame, { reach = 5, arc = 2.1 } = {}) {
    super(scene, frame, 1.05);
    this.effects = effects;
    this.reach = reach;
    this.arc = arc;
    const n = 64;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const a = arc - k * arc * 2;
      const high = 0.5 - 1.0 * Math.abs(k - 0.5) + Math.sin(k * 9) * 0.1;
      const r1 = reach * (0.72 + 0.28 * Math.sin(k * Math.PI));
      const r0 = r1 * 0.52;
      pos.push(Math.sin(a) * r1, high + 0.5, Math.cos(a) * r1, Math.sin(a) * r0, high - 0.42, Math.cos(a) * r0);
      uv.push(k, 1, k, 0);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mat = shader({ uLaid: { value: 0 }, uGone: { value: 0 }, uSeed: { value: Math.random() * 50 }, uInk: { value: INKS.map((c) => new THREE.Color(c)) } }, PAINT_FRAG, PLAIN_VERT, { transparent: false, depthWrite: true, blending: THREE.NormalBlending });
    this.mesh(g, this.mat);
    this.thrown = 0;
    this.step(0, 0);
  }

  step(k) {
    const laid = easeOut(clamp01(this.t / 0.3));
    this.mat.uniforms.uLaid.value = laid;
    this.mat.uniforms.uGone.value = clamp01((k - 0.42) / 0.58);
    // Drops flung off its front as it goes.
    while (this.thrown < laid * 46) {
      this.thrown++;
      const a = this.arc - (this.thrown / 46) * this.arc * 2;
      const r = this.reach * (0.6 + Math.random() * 0.4);
      const p = this.at(Math.sin(a) * r, 0.1 + Math.random() * 0.7, Math.cos(a) * r);
      const v = this.way(Math.sin(a) * 2.5, 1 + Math.random() * 2.5, Math.cos(a) * 2.5);
      this.effects.add('drop', p.x, p.y, p.z, { vx: v.x, vy: v.y, vz: v.z, gravity: 9, size: 0.16 + Math.random() * 0.22, life: 0.7 + Math.random() * 0.4, color: INKS[this.thrown % 6], spin: 2 });
    }
  }
}

// ---------------------------------------------------------------- Lullaby

const MOON_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uOn;
  uniform float uTime;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float d = length(q) - 0.86;
    float bite = 0.78 - length(q - vec2(0.36, 0.12));
    float m = max(d, bite);
    float body = 1.0 - smoothstep(-0.02, 0.015, m);
    float glow = exp(-max(0.0, m) * 8.0) * 0.7;
    float sea = fbm2(q * 3.4 + 4.0);
    vec3 col = mix(vec3(1.0, 0.96, 0.82), vec3(0.82, 0.72, 1.0), sea * 0.8);
    float a = max(body, glow * 0.8) * uOn;
    gl_FragColor = vec4(mix(vec3(0.62, 0.45, 1.0), col, body) * a * 1.3, min(1.0, a * 0.9));
    #include <colorspace_fragment>
  }
`;
const TRAIL_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uHead;
  uniform float uOn;
  uniform float uTime;
  void main() {
    float behind = uHead - vUv.x;
    if (behind < 0.0) discard;
    float tail = exp(-behind * 3.2);
    float d = abs(vUv.y - 0.5) * 2.0;
    float st = step(0.985, h21(floor(vec2(vUv.x * 110.0, vUv.y * 16.0)))) * (0.6 + 0.4 * sin(uTime * 20.0 + vUv.x * 90.0));
    vec3 col = mix(vec3(0.32, 0.2, 0.85), vec3(0.88, 0.8, 1.0), vUv.y);
    float a = tail * (1.0 - smoothstep(0.5, 1.0, d)) * uOn;
    gl_FragColor = vec4(col * a * 1.1 + vec3(1.0, 0.97, 0.8) * st * a * 2.0, a * 0.62);
    #include <colorspace_fragment>
  }
`;

class MoonSweep extends Show {
  constructor(scene, effects, frame, { reach = 4, secs = 0.6 } = {}) {
    super(scene, frame, secs + 0.35);
    this.effects = effects;
    this.round = secs;
    this.reach = reach;
    this.mat = shader({ uOn: { value: 1 }, uTime: { value: 0 } }, MOON_FRAG);
    this.moon = this.mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.moon.scale.setScalar(Math.min(1.5, reach * 0.36));
    const n = 72;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI * 0.9 + (i / n) * TAU * 1.12;
      for (const [r, y, v] of [[reach * 1.02, 0.3, 1], [reach * 0.45, -0.3, 0]]) {
        pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
        uv.push(i / n, v);
      }
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.trail = shader({ uHead: { value: 0 }, uOn: { value: 1 }, uTime: { value: 0 } }, TRAIL_FRAG);
    this.mesh(g, this.trail);
    this.light = halo('#cdb8ff', 3, 0.45);
    this.group.add(this.light);
    this.step(0, 0);
  }

  step(_, dt) {
    const k = clamp01(this.t / this.round);
    const a = -Math.PI * 0.9 + k * TAU * 1.12;
    const r = this.reach * 0.76;
    this.moon.position.set(Math.sin(a) * r, 0.25, Math.cos(a) * r);
    // (Broadside on to whoever swung it, rolling as it goes.)
    this.moon.rotation.set(0, a, -this.t * 5, 'YXZ');
    const out = k < 1 ? 1 : 1 - (this.t - this.round) / 0.35;
    this.mat.uniforms.uOn.value = Math.min(1, this.t * 16) * out;
    this.trail.uniforms.uHead.value = k;
    this.trail.uniforms.uOn.value = out;
    this.trail.uniforms.uTime.value = this.t;
    this.light.position.copy(this.moon.position);
    this.light.scale.setScalar(3 * out);
    const n = k < 1 && dt > 0 ? Math.round(dt * 80) : 0;
    for (let i = 0; i < n; i++) {
      const p = this.at(Math.sin(a) * r * (0.8 + Math.random() * 0.4), Math.random() * 0.8 - 0.2, Math.cos(a) * r * (0.8 + Math.random() * 0.4));
      this.effects.add(i % 4 ? 'star' : 'zzz', p.x, p.y, p.z, { vy: 0.5, size: 0.14 + Math.random() * 0.14, life: 0.6 + Math.random() * 0.4, color: ['#fff6d0', '#d8c4ff', '#ffffff'][i % 3], spin: 2 });
    }
  }
}

// ---------------------------------------------------------------- all of them

// What a swing of spec (souls.js soulWeapon) shows: one for each soul in it, at
// frame. far: how far off what it aims at is, if it is aimed at anything; empty:
// nothing was hit (the wolf springs out by itself then: otherwise it is told
// which way: SpiritWolf); near: in a dream, nothing reaches as far as it looks.
export function soulShows(scene, effects, spec, frame, { empty = true, near = 1 } = {}) {
  const out = [];
  const arm = 1.2;
  for (const [i, key] of spec.souls.entries()) {
    const size = i ? 0.85 : 1;
    switch (key) {
      case 'star':
        out.push(new StarWave(scene, effects, frame, { far: (arm + (spec.line ?? 4)) * near, size }));
        break;
      case 'rainbow':
        out.push(new RingFlight(scene, effects, frame, { far: (arm + (spec.line ?? 4)) * near, size }));
        break;
      case 'wild': {
        out.push(new Claws(scene, frame, { size: near < 1 ? 1 : 1.15 }));
        if (empty) {
          const a = frame.p.clone();
          const f = V(0, 0, 1).applyQuaternion(frame.q);
          const up = V(0, 1, 0).applyQuaternion(frame.q);
          out.push(new SpiritWolf(scene, effects, [a.clone().addScaledVector(f, 0.4), a.clone().addScaledVector(f, 4.4 * near + 0.4)], up, { size, leap: 0.34 }));
        }
        break;
      }
      case 'bells':
        out.push(new BellToll(scene, effects, frame, { reach: (arm + (spec.round ?? 3)) * near + 0.4, size }));
        break;
      case 'toon':
        out.push(new PaintStroke(scene, effects, frame, { reach: Math.min(6.2, arm + (spec.sweep ?? 4)) * near + 0.2 }));
        break;
      case 'nod':
        out.push(new MoonSweep(scene, effects, frame, { reach: (arm + (spec.round ?? 3)) * near + 0.2 }));
        break;
      default:
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- out of a chest

// (Thin where it is looked straight into, so that what is in it is seen.)
const BEAM_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vSide;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vSide = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying float vSide;
  uniform float uOn;
  uniform float uTime;
  uniform vec3 uA;
  uniform vec3 uB;
  void main() {
    float up = vUv.y;
    float streak = fbm2(vec2(vUv.x * 14.0, up * 3.0 - uTime * 2.4));
    float fine = fbm2(vec2(vUv.x * 44.0 + 3.0, up * 7.0 - uTime * 5.0));
    vec3 col = mix(uB, uA, clamp(streak * 1.3, 0.0, 1.0));
    col = mix(col, vec3(1.0), smoothstep(0.62, 0.9, fine) * 0.7);
    float a = (0.28 + 0.8 * streak * streak + 0.35 * smoothstep(0.55, 0.9, fine)) * pow(1.0 - up, 1.2) * uOn;
    a *= 0.16 + 0.84 * smoothstep(0.1, 0.8, vSide);
    gl_FragColor = vec4(col * a * 1.3, a * 0.45);
    #include <colorspace_fragment>
  }
`;

// A part of a soul weapon rising out of a golden chest at p (up: which way is up
// there) in a pillar of light, for everyone near to see; and after a while flying
// to whoever found it: to(), where they are, or null.
export class PartBeam {
  constructor(scene, effects, p, up, key, i, to = () => null) {
    const w = soulOf(key);
    this.effects = effects;
    this.to = to;
    this.t = 0;
    this.secs = 4.2;
    this.group = new THREE.Group();
    this.group.position.set(p.x, p.y, p.z);
    this.up = V(up.x, up.y, up.z);
    this.group.quaternion.setFromUnitVectors(V(0, 1, 0), this.up);
    scene.add(this.group);
    this.mat = shader({ uOn: { value: 0 }, uTime: { value: 0 }, uA: C(w.color), uB: C(w.glow) }, BEAM_FRAG, BEAM_VERT);
    this.geos = [];
    this.shafts = [[0.55, 1.1, 22], [0.3, 0.5, 30], [1.1, 2.1, 9]].map(([r0, r1, h]) => {
      const g = new THREE.CylinderGeometry(r1, r0, h, 28, 1, true);
      g.translate(0, h / 2, 0);
      this.geos.push(g);
      const m = new THREE.Mesh(g, this.mat);
      m.frustumCulled = false;
      m.renderOrder = 5;
      m.userData.noShadow = true;
      this.group.add(m);
      return m;
    });
    this.ring = shader({ uK: { value: 0 }, uA: C(w.color), uB: C(w.glow) }, RIPPLE_FRAG);
    const g = new THREE.PlaneGeometry(2, 2);
    this.geos.push(g);
    const flat = new THREE.Mesh(g, this.ring);
    flat.rotation.x = -Math.PI / 2;
    flat.position.y = 0.12;
    flat.scale.setScalar(7);
    flat.frustumCulled = false;
    flat.renderOrder = 5;
    flat.userData.noShadow = true;
    this.group.add(flat);
    const part = soulPart(key, i, gameKit());
    this.part = new THREE.Group();
    if (part) {
      part.position.copy(part.userData.mid).multiplyScalar(-1);
      this.size = 0.95 / Math.max(0.2, part.userData.size);
      this.part.add(part);
    }
    this.light = halo(w.color, 2.6, 0.6);
    this.group.add(this.part, this.light);
    this.colors = [w.color, w.glow, '#ffffff'];
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const { t } = this;
    if (t >= this.secs) {
      this.group.removeFromParent();
      for (const g of this.geos) g.dispose();
      this.mat.dispose();
      this.ring.dispose();
      return false;
    }
    const rise = easeOut(clamp01(t / 1.3));
    const leave = clamp01((t - 3.3) / 0.7);
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uOn.value = clamp01(t / 0.25) * (1 - clamp01((t - 3.1) / 1));
    this.ring.uniforms.uK.value = t < 1.5 ? t / 1.5 : ((t - 1.5) % 1.2) / 1.2;
    for (const [i, s] of this.shafts.entries()) {
      s.rotation.y = t * (i % 2 ? -0.7 : 0.5);
      s.scale.set(0.2 + 0.8 * rise, 1, 0.2 + 0.8 * rise);
    }
    const high = 0.4 + rise * 1.5 + Math.sin(t * 2.4) * 0.08;
    this.part.position.set(0, high, 0);
    this.part.rotation.set(Math.sin(t * 1.3) * 0.25, t * 2.6, 0);
    this.part.scale.setScalar((this.size ?? 1) * (0.25 + 0.75 * rise) * (1 - leave * 0.85));
    if (leave > 0) {
      const to = this.to();
      if (to) {
        const q = this.group.worldToLocal(V(to.x, to.y, to.z));
        this.part.position.lerp(q, leave * leave);
      }
    }
    this.light.position.copy(this.part.position);
    this.light.scale.setScalar(2.6 * (0.6 + 0.4 * rise) * (1 - leave * 0.6));
    const n = dt > 0 && t < 3.4 ? Math.round(dt * 60) : 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = 0.4 + Math.random() * 0.9;
      const p = V(Math.sin(a) * r, 0.1 + Math.random() * 0.6, Math.cos(a) * r).applyQuaternion(this.group.quaternion).add(this.group.position);
      const v = this.up.clone().multiplyScalar(2 + Math.random() * 3);
      this.effects.add(i % 3 ? 'sparkle' : 'star', p.x, p.y, p.z, { vx: v.x, vy: v.y, vz: v.z, straight: true, size: 0.14 + Math.random() * 0.2, life: 0.9 + Math.random() * 0.6, drag: 0.6, spin: 4, color: this.colors[i % 3] });
    }
    return true;
  }
}
