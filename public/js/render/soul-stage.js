// The stage soul weapons are shown on (shared/souls.js): a little theatre of its
// own in the dark, over everything — where a part found in a golden chest melts in
// out of the light, the parts of a weapon fly together at the Soul Forge and its
// soul wakes, and two weapons circle each other until they are one. This is the
// theatre itself: its sky, its light, sparks by the thousand, rings and lightning,
// the glow round all that shines. What is played on it is in soul-shows.js.
//
// A WebGL context of its own (the window's canvas), so its own materials and light.
import * as THREE from '../../vendor/three.module.js';
import { RoomEnvironment } from '../../vendor/three-addons/environments/RoomEnvironment.js';
import { OutputPass } from '../../vendor/three-addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from '../../vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { soulOf } from '../shared/souls.js';
import { FINISHES, soulBody, soulBox, soulEmblem, soulPart, partCount } from './soul-models.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOut = (k) => 1 - (1 - clamp01(k)) ** 3;
export const easeIn = (k) => clamp01(k) ** 3;
export const easeIO = (k) => ((k = clamp01(k)), k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
export const back = (k) => ((k = clamp01(k) - 1), 1 + 2.7 * k ** 3 + 1.7 * k ** 2);

const NOISE = /* glsl */ `
  float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
  float n3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * n3(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
`;

// ---------------------------------------------------------------- materials

// What something on the stage is made of, melting in out of the light (uIn, 0: not
// there, to 1: all of it), hot along the edge of what there is of it, and all of
// it white-hot (uHot) when it is being worked.
const MELT_HEAD = /* glsl */ `
  ${NOISE}
  uniform float uIn;
  uniform float uHot;
  uniform vec3 uEdge;
  varying vec3 vMelt;
`;
const MELT = /* glsl */ `
  float meltN = n3(vMelt * 11.0) * 0.6 + n3(vMelt * 27.0 + 4.0) * 0.4;
  float meltAt = uIn * 1.16 - 0.08;
  if (meltN > meltAt) discard;
  float meltEdge = (1.0 - smoothstep(0.0, 0.13, meltAt - meltN)) * step(uIn, 0.999);
`;
function melting(shader, shared) {
  Object.assign(shader.uniforms, shared);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMelt;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMelt = position;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${MELT_HEAD}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${MELT}`);
}

class StageMaterial extends THREE.MeshPhysicalMaterial {
  onBeforeCompile(shader) {
    melting(shader, this.userData.shared);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      'totalEmissiveRadiance *= diffuseColor.rgb;\ntotalEmissiveRadiance += uEdge * meltEdge * 5.0 + mix(uEdge, vec3(1.0), 0.6) * uHot * 3.2;',
    );
  }

  customProgramCacheKey() {
    return 'soul-stage';
  }
}

class StageGlow extends THREE.MeshBasicMaterial {
  onBeforeCompile(shader) {
    melting(shader, this.userData.shared);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = outgoingLight + uEdge * meltEdge * 5.0 + vec3(uHot * 2.0);\n#include <opaque_fragment>');
  }

  customProgramCacheKey() {
    return 'soul-stage-glow';
  }
}

// Materials for one thing on the stage: set(how much of it there is, how hot).
export function stageKit(edge = '#ffe9a0') {
  const shared = { uIn: { value: 1 }, uHot: { value: 0 }, uEdge: { value: new THREE.Color(edge) } };
  const made = new Map();
  return {
    shared,
    material(finish) {
      if (!made.has(finish)) {
        let m;
        if (finish === 'glow') m = new StageGlow({ vertexColors: true, color: new THREE.Color(2.1, 2.1, 2.1) });
        else {
          const { shine, ...f } = FINISHES[finish];
          m = new StageMaterial({ ...f, envMapIntensity: (f.envMapIntensity ?? 1) * 0.9, vertexColors: true, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: shine });
        }
        m.userData.shared = shared;
        made.set(finish, m);
      }
      return made.get(finish);
    },
    dispose() {
      for (const m of made.values()) m.dispose();
    },
  };
}

// A hologram of something not there yet: thin light at its edges, lines running
// up it.
export function ghostMaterial(color = '#8fd8ff', { strength = 1, lines = 1, flow = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOn: { value: strength }, uLines: { value: lines }, uFlow: { value: flow } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vE;
      varying vec3 vP;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vP = w.xyz;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal);
        vE = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      varying vec3 vN;
      varying vec3 vE;
      varying vec3 vP;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOn;
      uniform float uLines;
      uniform float uFlow;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vE))), 1.8);
        float line = 0.6 + 0.4 * sin(vP.y * 70.0 - uTime * 5.0);
        float flow = fbm3(vP * 2.2 + vec3(0.0, -uTime * 0.9, 0.0));
        float a = (0.07 + rim * 0.85) * mix(1.0, line, uLines) + uFlow * smoothstep(0.45, 0.8, flow) * 0.5;
        gl_FragColor = vec4(uColor * a * uOn * 1.5, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- the sky behind

const SKY_FRAG = /* glsl */ `
  ${NOISE}
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uLight;
  uniform float uRays;
  uniform float uDark;
  uniform float uPull;
  uniform float uPrism;
  uniform vec2 uMid;
  vec3 hue(float h) { vec3 k = abs(fract(vec3(h, h + 2.0 / 3.0, h + 1.0 / 3.0)) * 6.0 - 3.0) - 1.0; return clamp(k, 0.0, 1.0); }
  void main() {
    vec2 q = (vUv - uMid) * vec2(uAspect, 1.0);
    float r = length(q);
    float a = atan(q.y, q.x);
    // Clouds of light a long way off, turning very slowly; drawn in when it pulls.
    float tw = uTime * 0.02 + uPull * 0.8 / (r + 0.25);
    vec2 s = mat2(cos(tw), -sin(tw), sin(tw), cos(tw)) * q * (1.0 + uPull * 0.6);
    float f = fbm3(vec3(s * 1.9, uTime * 0.03));
    float g = fbm3(vec3(s * 3.6 + 7.0, uTime * 0.05 + f));
    vec3 col = vec3(0.012, 0.009, 0.03);
    col += uB * 0.16 * smoothstep(0.35, 0.85, f);
    col += uA * 0.12 * smoothstep(0.45, 0.85, g) * smoothstep(0.3, 0.7, f);
    // Stars.
    vec2 cell = floor(s * 46.0);
    float st = h31(vec3(cell, 3.0));
    vec2 off = fract(s * 46.0) - 0.5 - (vec2(h31(vec3(cell, 7.0)), h31(vec3(cell, 9.0))) - 0.5) * 0.7;
    col += vec3(0.9, 0.95, 1.0) * step(0.94, st) * exp(-dot(off, off) * 60.0) * (0.5 + 0.5 * sin(uTime * (1.0 + st * 3.0) + st * 90.0)) * 0.9;
    col *= 1.0 - uDark;
    // The light in the middle, and the rays out of it.
    float rays = 0.0;
    rays += pow(0.5 + 0.5 * sin(a * 9.0 + uTime * 0.35 + 1.2 * sin(a * 3.0)), 6.0);
    rays += 0.7 * pow(0.5 + 0.5 * sin(a * 17.0 - uTime * 0.5 + 2.0 * sin(a * 5.0 + 1.0)), 9.0);
    rays += 0.5 * n3(vec3(cos(a) * 5.0, sin(a) * 5.0, uTime * 0.4));
    vec3 rc = mix(mix(uA, vec3(1.0, 0.98, 0.9), 0.35), hue(a / 6.2831853 + uTime * 0.05), uPrism);
    col += rc * rays * uRays * exp(-r * 1.9) * 0.75 * smoothstep(0.02, 0.2, r);
    col += mix(uA, vec3(1.0), 0.25) * uLight * (exp(-r * 4.2) * 0.75 + exp(-r * 1.6) * 0.13);
    // A frame of dark round the whole of it.
    col *= 1.0 - 0.55 * smoothstep(0.55, 1.25, r);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// (Brightest in the middle: what comes out of it is seen before the rest of it fades.)
const FLASH_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uOn;
  uniform vec3 uColor;
  void main() {
    float r = length(vUv - 0.5);
    gl_FragColor = vec4(uColor * pow(uOn, 1.5) * 1.5 * (1.25 - r * 0.6), 1.0);
  }
`;

const FLAT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

// ---------------------------------------------------------------- sparks

const SPARK_VERT = /* glsl */ `
  attribute vec3 aVel;
  attribute vec3 aTo;
  attribute vec4 aTime; // born, life, drag, gravity
  attribute vec4 aLook; // size, swirl, kind, twinkle
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vA;
  varying float vKind;
  void main() {
    float t = uTime - aTime.x;
    float k = t / aTime.y;
    if (t < 0.0 || k >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec3 p;
    if (aLook.z > 0.5) {
      // Drawn in to a point, round and round it.
      float e = k * k * (3.0 - 2.0 * k);
      vec3 d = position - aTo;
      float a = aLook.y * e;
      d.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * d.xz;
      p = aTo + d * (1.0 - e * e);
    } else {
      float drag = max(0.001, aTime.z);
      p = position + aVel * (1.0 - exp(-drag * t)) / drag;
      p.y -= 0.5 * aTime.w * t * t;
      float a = aLook.y * t;
      p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = mix(1.0, 0.55 + 0.45 * sin(uTime * 22.0 + aLook.w * 60.0), step(0.001, aLook.w));
    vA = (aLook.z > 0.5 ? smoothstep(0.0, 0.2, k) : 1.0) * (1.0 - smoothstep(0.55, 1.0, k)) * tw;
    vColor = aColor;
    vKind = fract(aLook.w * 7.0);
    gl_PointSize = aLook.x * uScale / max(0.1, -mv.z) * (0.6 + 0.4 * (1.0 - k));
  }
`;
const SPARK_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  varying float vKind;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = length(q);
    float glow = exp(-r * r * 34.0);
    float core = exp(-r * r * 220.0);
    float cross_ = exp(-abs(q.x) * 46.0) * exp(-abs(q.y) * 9.0) + exp(-abs(q.y) * 46.0) * exp(-abs(q.x) * 9.0);
    float a = (glow * 0.6 + core * 1.4 + cross_ * step(0.5, vKind) * 0.9) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4((vColor * (glow * 0.8 + cross_ * 0.7) + vec3(1.0) * core) * vA * 1.7, 1.0);
  }
`;

class Sparks {
  constructor(scene, max = 4200) {
    this.max = max;
    this.next = 0;
    const g = new THREE.BufferGeometry();
    const at = (n) => new THREE.BufferAttribute(new Float32Array(max * n), n).setUsage(THREE.DynamicDrawUsage);
    this.attrs = { position: at(3), aVel: at(3), aTo: at(3), aTime: at(4), aLook: at(4), aColor: at(3) };
    for (const [k, a] of Object.entries(this.attrs)) g.setAttribute(k, a);
    this.attrs.aTime.array.fill(-100);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 500 } }, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);
    this.c = new THREE.Color();
  }

  // One: from p with a velocity, or drawn in to `to`.
  add(p, { v = null, to = null, life = 1, drag = 1.5, gravity = 0, size = 0.06, swirl = 0, color = '#ffffff', twinkle = 0, late = 0 } = {}) {
    const i = this.next;
    this.next = (i + 1) % this.max;
    const A = this.attrs;
    A.position.setXYZ(i, p.x, p.y, p.z);
    A.aVel.setXYZ(i, v?.x ?? 0, v?.y ?? 0, v?.z ?? 0);
    A.aTo.setXYZ(i, to?.x ?? 0, to?.y ?? 0, to?.z ?? 0);
    A.aTime.setXYZW(i, this.mat.uniforms.uTime.value + late, life, drag, gravity);
    A.aLook.setXYZW(i, size, swirl, to ? 1 : 0, twinkle);
    this.c.set(color);
    A.aColor.setXYZ(i, this.c.r, this.c.g, this.c.b);
    for (const a of Object.values(A)) a.needsUpdate = true;
  }

  update(time, scale) {
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uScale.value = scale;
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------- rings, runes, lightning

const RING_FRAG = /* glsl */ `
  ${NOISE}
  varying vec2 vUv;
  uniform float uK;
  uniform float uFrom;
  uniform vec3 uColor;
  uniform float uThin;
  uniform float uPrism;
  vec3 hue(float h) { vec3 k = abs(fract(vec3(h, h + 2.0 / 3.0, h + 1.0 / 3.0)) * 6.0 - 3.0) - 1.0; return clamp(k, 0.0, 1.0); }
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    float at = uFrom + (0.94 - uFrom) * (1.0 - pow(1.0 - uK, 2.4));
    float w = uThin * (1.0 - uK * 0.6);
    float d = (r - at) / w;
    float ring = exp(-d * d * 3.0) + 0.5 * exp(-abs(d + 1.2) * 0.9) * step(r, at);
    float a = ring * (1.0 - uK) * (1.0 - uK);
    vec3 c = mix(uColor, hue(atan(q.y, q.x) / 6.2831853 + uK), uPrism);
    gl_FragColor = vec4(mix(c, vec3(1.0), exp(-d * d * 8.0) * 0.7) * a * 2.2, 1.0);
  }
`;

const RUNE_FRAG = /* glsl */ `
  ${NOISE}
  varying vec2 vUv;
  uniform float uTime;
  uniform float uDraw;
  uniform float uOn;
  uniform float uN;
  uniform vec3 uA;
  uniform vec3 uB;
  float line(float d, float w) { return exp(-pow(d / w, 2.0)); }
  // How far a point is from the edge of a polygon of n sides, as big as R.
  float poly(vec2 p, float n, float R, float turn) {
    float a = atan(p.y, p.x) + turn;
    float s = 6.2831853 / n;
    return abs(cos(floor(0.5 + a / s) * s - a) * length(p) - R);
  }
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float a = atan(q.y, q.x);
    float k = 0.0;
    float drawn = step(fract(a / 6.2831853 + 0.25), uDraw);
    k += line(r - 0.95, 0.008) * drawn;
    k += line(r - 0.88, 0.005) * drawn;
    k += line(r - 0.6, 0.006) * step(fract(-a / 6.2831853 + 0.6), uDraw);
    k += line(r - 0.28, 0.006) * drawn;
    // Marks round its edge, as many as it has.
    float seg = a / 6.2831853 * 48.0 + uTime * 0.6;
    float mark = step(0.5, h31(vec3(floor(seg), 5.0, 1.0)));
    float in_ = step(0.89, r) * step(r, 0.94);
    k += in_ * step(0.2, fract(seg)) * step(fract(seg), 0.75) * mark * 0.8 * drawn;
    // A star of as many points as the weapon has parts, and another turned in it.
    float pk = smoothstep(0.35, 1.0, uDraw);
    k += line(poly(q, uN, 0.6 * cos(3.14159 / uN), uTime * 0.12), 0.006) * step(r, 0.61) * pk;
    k += line(poly(q, uN, 0.6 * cos(3.14159 / uN) * 0.72, -uTime * 0.2), 0.006) * step(r, 0.56) * pk;
    k += line(poly(q, 3.0, 0.14, uTime * 0.3), 0.006) * step(r, 0.28) * pk;
    k += line(poly(q, 3.0, 0.14, uTime * 0.3 + 3.14159), 0.006) * step(r, 0.28) * pk;
    // Little rings where the parts wait.
    float s = 6.2831853 / uN;
    float ca = floor((a + uTime * 0.12) / s + 0.5) * s - uTime * 0.12;
    vec2 c = vec2(cos(ca), sin(ca)) * 0.74;
    k += line(length(q - c) - 0.075, 0.006) * pk;
    float haze = exp(-pow((r - 0.75) / 0.25, 2.0)) * 0.05 + exp(-r * 4.0) * 0.16;
    vec3 col = mix(uB, uA, clamp(k, 0.0, 1.0));
    float flick = 0.85 + 0.15 * sin(uTime * 7.0 + a * 3.0);
    gl_FragColor = vec4(col * (k * 1.5 * flick + haze * pk) * uOn, 1.0);
  }
`;

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_VERT = /* glsl */ `
  attribute vec3 dir;
  attribute float side;
  uniform float uWidth;
  varying float vSide;
  void main() {
    vec3 across = normalize(cross(dir, cameraPosition - position));
    vSide = side;
    gl_Position = projectionMatrix * viewMatrix * vec4(position + across * side * uWidth, 1.0);
  }
`;
const ARC_FRAG = /* glsl */ `
  varying float vSide;
  uniform vec3 uColor;
  uniform float uOn;
  void main() {
    float d = abs(vSide);
    float core = 1.0 - smoothstep(0.0, 0.3, d);
    float glow = pow(1.0 - d, 2.0);
    gl_FragColor = vec4((mix(uColor, vec3(1.0), core) * core * 2.4 + uColor * glow * 1.1) * uOn, 1.0);
  }
`;

// Lightning between two points, finding a new way there over and over.
class Arc {
  constructor(scene, color, { width = 0.05, n = 14 } = {}) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
    this.dir = new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
    const side = new Float32Array((n + 1) * 2);
    const idx = [];
    for (let i = 0; i <= n; i++) {
      side[i * 2] = 1;
      side[i * 2 + 1] = -1;
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    g.setAttribute('position', this.pos);
    g.setAttribute('dir', this.dir);
    g.setAttribute('side', new THREE.BufferAttribute(side, 1));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uOn: { value: 1 }, uWidth: { value: width } }, vertexShader: ARC_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    scene.add(this.mesh);
    this.moved = 1;
    this.life = 0;
  }

  // From a to b, for secs.
  strike(a, b, secs = 0.25, rough = 0.16) {
    this.a = a;
    this.b = b;
    this.rough = rough;
    this.life = secs;
    this.total = secs;
    this.moved = 1;
  }

  update(dt) {
    this.life -= dt;
    this.mesh.visible = this.life > 0;
    if (this.life <= 0) return;
    this.moved += dt;
    this.mat.uniforms.uOn.value = (0.5 + 0.5 * Math.random()) * Math.min(1, (this.life / this.total) * 2);
    if (this.moved < 0.045) return;
    this.moved = 0;
    const A = typeof this.a === 'function' ? this.a() : this.a;
    const B = typeof this.b === 'function' ? this.b() : this.b;
    const len = A.distanceTo(B);
    const pts = [];
    for (let i = 0; i <= this.n; i++) {
      const k = i / this.n;
      const r = Math.sin(k * Math.PI) * len * this.rough;
      pts.push(A.clone().lerp(B, k).add(V((Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * 2 * r)));
    }
    for (let i = 0; i <= this.n; i++) {
      const d = pts[Math.min(this.n, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      for (let k = 0; k < 2; k++) {
        this.pos.setXYZ(i * 2 + k, pts[i].x, pts[i].y, pts[i].z);
        this.dir.setXYZ(i * 2 + k, d.x, d.y, d.z);
      }
    }
    this.pos.needsUpdate = true;
    this.dir.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------- the stage

export class SoulStage {
  // canvas: where; calm: the window's own little one at the forge (no haste, no
  // shaking). Throws if WebGL cannot be had.
  constructor(canvas, { calm = false } = {}) {
    this.canvas = canvas;
    this.calm = calm;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: calm, alpha: false, powerPreference: 'high-performance' });
    this.gl = gl;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.setClearColor(0x05030d, 1);
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.75;
    this.key = new THREE.DirectionalLight(0xffffff, 1.5);
    this.key.position.set(1.5, 3, 4);
    this.fill = new THREE.PointLight(0xffffff, 3, 12, 1.6);
    this.fill.position.set(-1.6, -0.6, 1.8);
    this.scene.add(this.key, this.fill);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
    this.look = V(0, 0, 0);
    this.cam = { dist: 4.2, yaw: 0, pitch: 0.06, roll: 0, lift: 0 };
    this.jolt = 0;
    this.time = 0;
    this.size = [0, 0];
    // The sky behind it all.
    this.sky = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uA: { value: new THREE.Color('#ffd84d') }, uB: { value: new THREE.Color('#4f6bff') }, uLight: { value: 0 }, uRays: { value: 0 }, uDark: { value: 0 }, uPull: { value: 0 }, uPrism: { value: 0 }, uMid: { value: new THREE.Vector2(0.5, 0.5) } },
      vertexShader: FLAT_VERT,
      fragmentShader: SKY_FRAG,
      depthWrite: false,
      depthTest: false,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.sky);
    sky.frustumCulled = false;
    sky.renderOrder = -50;
    this.scene.add(sky);
    this.sparks = new Sparks(this.scene, calm ? 600 : 4200);
    this.rings = [];
    this.arcs = [];
    this.runes = null;
    // White over everything, for a moment.
    this.flashMat = new THREE.ShaderMaterial({ uniforms: { uOn: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') } }, vertexShader: FLAT_VERT, fragmentShader: FLASH_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.flashMat);
    flash.frustumCulled = false;
    flash.renderOrder = 50;
    this.scene.add(flash);
    this.flashOn = 0;
    this.flashRate = 4.5;
    this.kits = [];
    this.extras = [];
    this.show = null;
    this.buildPost();
    this.clock = new THREE.Clock();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  buildPost() {
    const type = this.gl.extensions.has('EXT_color_buffer_half_float') || this.gl.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type, samples: 4 });
    this.ping = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.calm ? 0.42 : 0.62, 0.7, 1.0);
    this.out = new OutputPass();
  }

  // ------------------------------------------------ things on it

  kit(color) {
    const k = stageKit(color);
    this.kits.push(k);
    return k;
  }

  // Something in its own materials, its middle at the origin of a group: { group,
  // kit, size }.
  part(key, i, edge = null) {
    const kit = this.kit(edge ?? soulOf(key).color);
    const model = soulPart(key, i, kit);
    const group = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(model);
    inner.position.copy(model.userData.mid).negate();
    group.add(inner);
    return { group, inner, model, kit, mid: model.userData.mid.clone(), size: model.userData.size, i };
  }

  // How much bigger than it is in the hand a weapon is shown, all much of a size.
  big(key) {
    return Math.max(0.9, Math.min(1.95, 1.95 / soulBox(key).long));
  }

  // A whole weapon, its middle at the origin: { group, kit }.
  weapon(spec, edge = null) {
    const [key, ...rest] = spec.souls;
    const kit = this.kit(edge ?? soulOf(key).color);
    const group = new THREE.Group();
    const body = soulBody(key, kit);
    const k = this.big(key);
    body.scale.setScalar(k);
    body.position.copy(soulBox(key).mid).multiplyScalar(-k);
    group.add(body);
    const moons = rest.map((k, i) => {
      const e = soulEmblem(k, this.kit(soulOf(k).color));
      e.scale.setScalar(0.085);
      group.add(e);
      return { e, i, k };
    });
    return { group, kit, body, key, moons, spec };
  }

  // The emblems going round one, at time t.
  turnMoons(w, t, r = 0.62) {
    for (const { e, i } of w.moons) {
      const a = t * 1.8 + (i / w.moons.length) * TAU;
      e.position.set(Math.sin(a) * r, Math.sin(t * 1.3 + i * 1.7) * 0.22, Math.cos(a) * r);
      e.rotation.y = a + t;
    }
  }

  ghost(color, opts) {
    const m = ghostMaterial(color, opts);
    this.extras.push(m);
    return m;
  }

  ring(p, { color = '#ffffff', size = 3, secs = 0.9, thin = 0.09, flat = false, prism = 0, turn = null, from = 0.04 } = {}) {
    const mat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uFrom: { value: from }, uColor: { value: new THREE.Color(color) }, uThin: { value: thin }, uPrism: { value: prism } }, vertexShader: PLANE_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    m.position.copy(p);
    m.scale.setScalar(size);
    if (flat) m.rotation.x = -Math.PI / 2;
    if (turn) m.rotation.set(...turn);
    m.renderOrder = 6;
    m.frustumCulled = false;
    this.scene.add(m);
    this.rings.push({ m, mat, t: 0, secs, flat: flat || Boolean(turn) });
  }

  // The circle drawn on the floor, with as many points as the weapon has parts.
  rune(n, a, b, y = -1.15, size = 2.3) {
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uDraw: { value: 0 }, uOn: { value: 1 }, uN: { value: n }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } }, vertexShader: PLANE_VERT, fragmentShader: RUNE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.scale.setScalar(size);
    m.renderOrder = -1;
    this.scene.add(m);
    this.runes = { m, mat };
    return mat.uniforms;
  }

  arc(a, b, color, secs = 0.25, opts = {}) {
    let arc = this.arcs.find((x) => x.life <= 0);
    if (!arc) {
      if (this.arcs.length > 14) return;
      arc = new Arc(this.scene, color, opts);
      this.arcs.push(arc);
    }
    arc.mat.uniforms.uColor.value.set(color);
    arc.mat.uniforms.uWidth.value = opts.width ?? 0.05;
    arc.strike(a, b, secs, opts.rough);
  }

  flash(k = 1, color = '#ffffff', rate = 4.5) {
    if (this.gentle) k *= 0.35;
    this.flashOn = Math.max(this.flashOn, k);
    this.flashMat.uniforms.uColor.value.set(color);
    this.flashRate = rate;
  }

  shake(k) {
    if (!this.calm && !this.gentle) this.jolt = Math.max(this.jolt, k);
  }

  // Sparks flung out from a point every way.
  burst(p, n, { colors, speed = 3, life = 1.2, size = 0.07, drag = 2.2, gravity = 0, swirl = 0, flat = 0, twinkle = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * TAU;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.25 + Math.random() * 0.95);
      this.sparks.add(p, { v: V(Math.cos(a) * r * s, u * s * (1 - flat), Math.sin(a) * r * s), life: life * (0.5 + Math.random() * 0.8), size: size * (0.5 + Math.random()), drag, gravity, swirl, color: colors[i % colors.length], twinkle: twinkle ? 0.1 + Math.random() : 0 });
    }
  }

  // Sparks drawn in to a point from all round, over secs.
  gather(p, n, { colors, from = 3, secs = 1.2, size = 0.06, swirl = 4, spread = 0.6, flat = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = from * (0.45 + Math.random() * 0.7);
      const at = V(p.x + Math.cos(a) * r, p.y + (Math.random() - 0.5) * from * (1 - flat) * 2, p.z + Math.sin(a) * r);
      this.sparks.add(at, { to: p, life: secs * (0.6 + Math.random() * 0.4), size: size * (0.5 + Math.random()), swirl: swirl * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], twinkle: Math.random(), late: Math.random() * spread });
    }
  }

  // Sparks rising about it.
  embers(dt, { colors, rate = 40, r = 1.6, y = -1.3 } = {}) {
    this.emberAcc = (this.emberAcc ?? 0) + dt * rate;
    while (this.emberAcc > 1) {
      this.emberAcc--;
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * r;
      this.sparks.add(V(Math.cos(a) * d, y + Math.random() * 0.5, Math.sin(a) * d), { v: V((Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4), life: 2 + Math.random() * 1.4, drag: 0.2, size: 0.03 + Math.random() * 0.045, swirl: (Math.random() - 0.5) * 0.6, color: colors[Math.floor(Math.random() * colors.length)], twinkle: 0.2 + Math.random() });
    }
  }

  colors(a, b) {
    this.sky.uniforms.uA.value.set(a);
    this.sky.uniforms.uB.value.set(b);
    this.fill.color.set(a);
  }

  // ------------------------------------------------ each frame

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h || (w === this.size[0] && h === this.size[1])) return;
    this.size = [w, h];
    // (Never more than a few million points of it: it is all soft light.)
    const ratio = Math.min(this.calm ? 2 : 1.5, window.devicePixelRatio || 1, Math.sqrt(2.6e6 / (w * h)));
    this.gl.setPixelRatio(Math.max(0.6, ratio));
    this.gl.setSize(w, h, false);
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.target.setSize(W, H);
    this.ping.setSize(W, H);
    this.bloom.setSize(W, H);
    this.out.setSize?.(W, H);
    this.camera.aspect = w / h;
    this.sky.uniforms.uAspect.value = w / h;
    this.fit();
  }

  // How far back the camera is for all that matters to fit, whatever the window:
  // what is this tall, and this wide.
  fit() {
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    // (A short window has less of it to spare above the words.)
    const short = this.calm ? 0 : Math.max(0, Math.min(0.35, (620 - this.size[1]) / 620));
    const room = this.calm ? 0.94 : 0.72 - short * 0.45;
    this.back = Math.max(this.tall / (2 * t * room), this.wide / (2 * t * this.camera.aspect * 0.92));
    // What is written goes under it: the middle of the picture a little up.
    const [w, h] = this.size;
    const up = this.calm ? 0 : 0.085 + short * 0.34;
    this.camera.setViewOffset(w, h, 0, h * up, w, h);
    this.camera.updateProjectionMatrix();
    this.sky.uniforms.uMid.value.set(0.5, 0.5 + up);
  }

  tall = 2.6;
  wide = 2.4;
  back = 4.2;

  frame() {
    this.raf = requestAnimationFrame(this.frame);
    this.tick(Math.min(0.05, this.clock.getDelta()));
  }

  // dt seconds on, and drawn.
  tick(dt) {
    this.resize();
    if (!this.size[0]) return;
    this.time += dt;
    const { time } = this;
    this.sky.uniforms.uTime.value = time;
    this.sparks.update(time, (this.canvas.height * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360));
    this.show?.update(dt);
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = r.t / r.secs;
      if (k >= 1) {
        r.m.removeFromParent();
        r.m.geometry.dispose();
        r.mat.dispose();
        return false;
      }
      r.mat.uniforms.uK.value = k;
      if (!r.flat) r.m.quaternion.copy(this.camera.quaternion);
      return true;
    });
    for (const a of this.arcs) a.update(dt);
    if (this.runes) this.runes.mat.uniforms.uTime.value = time;
    for (const m of this.extras) if (m.uniforms?.uTime) m.uniforms.uTime.value = time;
    this.flashOn = this.flashOn < 0.01 ? 0 : this.flashOn * Math.exp(-dt * this.flashRate);
    this.flashMat.uniforms.uOn.value = this.flashOn;
    this.jolt = Math.max(0, this.jolt - dt * 1.8);
    this.aim();
    this.draw();
  }

  aim() {
    const c = this.cam;
    const d = this.back * (c.dist / 4.2);
    const j = this.jolt * this.jolt * 0.22;
    this.camera.position.set(this.look.x + Math.sin(c.yaw) * Math.cos(c.pitch) * d + (Math.random() - 0.5) * j, this.look.y + Math.sin(c.pitch) * d + (Math.random() - 0.5) * j, this.look.z + Math.cos(c.yaw) * Math.cos(c.pitch) * d);
    this.camera.up.set(Math.sin(c.roll), Math.cos(c.roll), 0);
    this.camera.lookAt(this.look.x + (Math.random() - 0.5) * j * 0.5, this.look.y + (Math.random() - 0.5) * j * 0.5, this.look.z);
  }

  draw() {
    const { gl } = this;
    gl.setRenderTarget(this.target);
    gl.clear();
    gl.render(this.scene, this.camera);
    this.bloom.renderToScreen = false;
    this.bloom.render(gl, this.ping, this.target, 0, false);
    this.out.renderToScreen = true;
    this.out.render(gl, this.ping, this.target, 0, false);
    gl.setRenderTarget(null);
  }

  // Everything off it, for the next.
  clear() {
    this.show?.dispose?.();
    this.show = null;
    for (const r of this.rings) {
      r.m.removeFromParent();
      r.m.geometry.dispose();
      r.mat.dispose();
    }
    this.rings = [];
    if (this.runes) {
      this.runes.m.removeFromParent();
      this.runes.m.geometry.dispose();
      this.runes.mat.dispose();
      this.runes = null;
    }
    for (const a of this.arcs) a.dispose();
    this.arcs = [];
    for (const k of this.kits) k.dispose();
    this.kits = [];
    for (const m of this.extras) m.dispose();
    this.extras = [];
    this.flashOn = 0;
    this.jolt = 0;
    Object.assign(this.cam, { dist: 4.2, yaw: 0, pitch: 0.06, roll: 0 });
    this.look.set(0, 0, 0);
    const u = this.sky.uniforms;
    u.uLight.value = u.uRays.value = u.uDark.value = u.uPull.value = u.uPrism.value = 0;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.clear();
    this.sparks.dispose();
    this.sky.dispose();
    this.flashMat.dispose();
    this.bloom.dispose();
    this.out.dispose();
    this.target.dispose();
    this.ping.dispose();
    this.env.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}

// ---------------------------------------------------------------- pictures

// A picture of a whole weapon, combined or not (its spec), drawn the once: a data URL,
// or '' without WebGL.
const whole = new Map();
export function weaponPicture(spec, size = 128) {
  if (!whole.has(spec.id)) {
    let url = '';
    try {
      url = photograph(size, (scene, camera) => {
        const kits = [];
        const kit = () => (kits.push(stageKit()), kits.at(-1));
        const [key, ...rest] = spec.souls;
        const { mid, long } = soulBox(key);
        const g = new THREE.Group();
        const body = soulBody(key, kit());
        body.position.copy(mid).negate();
        g.add(body);
        rest.forEach((k, i) => {
          const e = soulEmblem(k, kit());
          e.scale.setScalar(long * 0.055);
          const a = (i / rest.length) * TAU + 0.5;
          e.position.set(Math.sin(a) * long * 0.34, Math.cos(a) * long * 0.3, 0.3 * long);
          g.add(e);
        });
        g.rotation.set(0.1, key === 'rainbow' ? 0.35 : 0.5, key === 'rainbow' ? 0 : -0.7);
        scene.add(g);
        camera.position.set(0, 0, (long / 2 / Math.sin((12 * Math.PI) / 180)) * (key === 'rainbow' ? 1.16 : 1.02));
        return () => {
          scene.remove(g);
          for (const k of kits) k.dispose();
        };
      })[0];
    } catch {}
    whole.set(spec.id, url);
  }
  return whole.get(spec.id);
}

// Pictures of things, one after another: each shot(scene, camera) puts what it is of
// in the scene and says how to take it out again.
function photograph(size, ...shots) {
  const gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  gl.setSize(size, size, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = env;
  const light = new THREE.DirectionalLight(0xffffff, 1.6);
  light.position.set(1.4, 2.4, 3);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x9f9fbf, 0.7), light);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.02, 20);
  const urls = shots.map((shot) => {
    const done = shot(scene, camera);
    camera.lookAt(0, 0, 0);
    gl.render(scene, camera);
    const url = gl.domElement.toDataURL('image/png');
    done();
    return url;
  });
  env.dispose();
  gl.dispose();
  gl.forceContextLoss();
  return urls;
}

// Pictures of a weapon's parts for the forge's window, each drawn the once and kept
// for as long as the page is open: data URLs in the order of its parts. have: which
// to show as they are (the rest only as their outlines). Without WebGL, none.
const pictures = new Map();
export function partPictures(key, have, size = 112) {
  const want = [];
  for (let i = 0; i < partCount(key); i++) if (!pictures.has(`${key}|${i}|${have[i] ? 1 : 0}`)) want.push(i);
  if (want.length) {
    const kit = stageKit();
    const ghost = ghostMaterial(soulOf(key).glow, { strength: 0.8 });
    ghost.uniforms.uTime.value = 2;
    try {
      const urls = photograph(
        size,
        ...want.map((i) => (scene, camera) => {
          const model = soulPart(key, i, kit);
          if (!have[i]) model.traverse((o) => o.isMesh && (o.material = ghost));
          const holder = new THREE.Group();
          model.position.copy(model.userData.mid).negate();
          holder.add(model);
          // (Long thin ones, aslant.)
          holder.rotation.set(0.3, 0.6, model.userData.size > 0.8 ? -0.75 : 0);
          scene.add(holder);
          camera.position.set(0, 0, (model.userData.size / 2 / Math.sin((12 * Math.PI) / 180)) * 0.98);
          return () => scene.remove(holder);
        }),
      );
      want.forEach((i, n) => pictures.set(`${key}|${i}|${have[i] ? 1 : 0}`, urls[n]));
    } catch {
      return [];
    } finally {
      kit.dispose();
      ghost.dispose();
    }
  }
  return Array.from({ length: partCount(key) }, (_, i) => pictures.get(`${key}|${i}|${have[i] ? 1 : 0}`) ?? '');
}
