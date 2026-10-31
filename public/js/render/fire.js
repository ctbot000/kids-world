// Blocks on fire (shared/fire.js): tongues of flame licking up off every
// open face of each burning block, drawn as upright quads that always turn
// to the camera, each one a flame worked out in its shader from rising,
// wavering noise — white-yellow at its root, orange, then deep red at its
// ragged tips — with sparks flying up out of it and dark smoke rolling off.
import * as THREE from '../../vendor/three.module.js';
import { SOLID } from '../shared/blocks.js';

const MAX = 320;

const VERT = /* glsl */ `
  attribute vec3 center;
  attribute vec3 shape; // width, height, seed
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    // Upright: turned round to the camera, never tipped over.
    vec3 toCam = cameraPosition - center;
    vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
    vec3 p = center + right * position.x * shape.x + vec3(0.0, (position.y + 0.5) * shape.y, 0.0);
    vUv = uv;
    vSeed = shape.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
  void main() {
    float x = vUv.x * 2.0 - 1.0;
    float y = vUv.y;
    float t = uTime * (1.6 + vSeed * 0.6) + vSeed * 17.0;
    // Rising noise, pulled up faster than it drifts sideways.
    float n = fbm(vec2(x * 1.8 + vSeed * 5.0, y * 2.6 - t * 1.9));
    float sway = (noise(vec2(t * 0.7, vSeed * 9.0)) - 0.5) * 0.35 * y;
    // Wide at the root, narrowing to a ragged tip.
    float w = mix(0.95, 0.12, pow(y, 0.8));
    float body = 1.0 - smoothstep(w * 0.55, w, abs(x - sway));
    float heat = body * (1.1 - y * 1.2) + (n - 0.5) * 0.9 * (0.35 + y);
    heat *= smoothstep(0.0, 0.1, y);
    heat = clamp(heat, 0.0, 1.0);
    vec3 c = mix(vec3(0.45, 0.04, 0.0), vec3(0.95, 0.27, 0.02), smoothstep(0.1, 0.4, heat));
    c = mix(c, vec3(1.0, 0.58, 0.1), smoothstep(0.4, 0.7, heat));
    c = mix(c, vec3(1.0, 0.86, 0.45), smoothstep(0.78, 1.0, heat));
    float a = smoothstep(0.08, 0.35, heat);
    if (a < 0.01) discard;
    // Premultiplied: glowing over what is behind it, and still a flame
    // against a bright sky.
    gl_FragColor = vec4(c * a * 1.15, a * 0.8);
  }
`;

// The faces a flame may lick out of, and where: [dx, dz, out of the side?].
const FACES = [
  [0, 0, false],
  [1, 0, true],
  [-1, 0, true],
  [0, 1, true],
  [0, -1, true],
];

export class FireView {
  constructor(scene, effects) {
    this.effects = effects;
    this.cells = new Map();
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    this.center = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.shape = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    g.setAttribute('center', this.center);
    g.setAttribute('shape', this.shape);
    g.instanceCount = 0;
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.time = 0;
    this.dirty = false;
  }

  key(x, y, z) {
    return `${x},${y},${z}`;
  }

  has(x, y, z) {
    return this.cells.has(this.key(x, y, z));
  }

  // Every fire at once (on arriving): [x, y, z, ...].
  reset(world, cells = []) {
    this.cells.clear();
    this.set(world, cells, []);
  }

  set(world, on = [], off = []) {
    this.world = world;
    for (let i = 0; i + 2 < off.length; i += 3) this.cells.delete(this.key(off[i], off[i + 1], off[i + 2]));
    for (let i = 0; i + 2 < on.length; i += 3) this.cells.set(this.key(on[i], on[i + 1], on[i + 2]), { x: on[i], y: on[i + 1], z: on[i + 2], seed: Math.random() });
    this.dirty = true;
  }

  // The world changed: which faces are open to burn out of may have too.
  changed() {
    if (this.cells.size) this.dirty = true;
  }

  // Lays out the flames: one standing on top of each burning block with
  // open air over it, and one out of each open side, a little lower.
  layout() {
    this.dirty = false;
    const w = this.world;
    let n = 0;
    const c = this.center.array;
    const s = this.shape.array;
    for (const f of this.cells.values()) {
      for (const [dx, dz, side] of FACES) {
        if (n >= MAX) break;
        const open = side ? !SOLID[w?.get(f.x + dx, f.y, f.z + dz)] : !SOLID[w?.get(f.x, f.y + 1, f.z)];
        if (!open) continue;
        const seed = (f.seed + n * 0.137) % 1;
        if (side) c.set([f.x + 0.5 + dx * 0.56, f.y + 0.05, f.z + 0.5 + dz * 0.56], n * 3);
        else c.set([f.x + 0.5, f.y + 0.75, f.z + 0.5], n * 3);
        s.set(side ? [1.05, 1.4 + seed * 0.5, seed] : [1.5, 2.2 + seed * 0.9, seed], n * 3);
        n++;
      }
    }
    this.geometry.instanceCount = n;
    this.center.needsUpdate = true;
    this.shape.needsUpdate = true;
  }

  // The flames flicker; sparks and smoke rise off the fires near you.
  update(dt, focus) {
    if (this.dirty) this.layout();
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
    this.mesh.visible = this.cells.size > 0;
    const fx = this.effects;
    for (const f of this.cells.values()) {
      if (Math.hypot(f.x - focus.x, f.z - focus.z) > 70) continue;
      const x = f.x + 0.5;
      const z = f.z + 0.5;
      if (Math.random() < dt * 3.2) {
        fx.add('puff', x + (Math.random() - 0.5) * 0.6, f.y + 2 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.6, {
          vx: 0.3 + (Math.random() - 0.5) * 0.4,
          vy: 1.1 + Math.random() * 0.6,
          vz: (Math.random() - 0.5) * 0.4,
          size: 0.7 + Math.random() * 0.5,
          grow: 1.1,
          drag: 0.15,
          life: 2.6 + Math.random() * 1.4,
          color: ['#3b3836', '#4a4643', '#2e2b29', '#57524d'][Math.floor(Math.random() * 4)],
        });
      }
      if (Math.random() < dt * 4) {
        fx.add('square', x + (Math.random() - 0.5) * 0.8, f.y + 1 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.8, {
          vx: (Math.random() - 0.5) * 1.4,
          vy: 2 + Math.random() * 2.5,
          vz: (Math.random() - 0.5) * 1.4,
          size: 0.04 + Math.random() * 0.04,
          drag: 0.8,
          life: 0.8 + Math.random() * 0.9,
          color: ['#ffd27a', '#ff9a2e', '#ffef9a'][Math.floor(Math.random() * 3)],
        });
      }
    }
  }

  // How far the nearest fire is from (x, y, z), or Infinity.
  nearest(x, y, z) {
    let best = Infinity;
    for (const f of this.cells.values()) best = Math.min(best, Math.hypot(f.x + 0.5 - x, f.y + 0.5 - y, f.z + 0.5 - z));
    return best;
  }
}
