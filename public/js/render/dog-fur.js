// Fur, the way a game draws it close up: the skin drawn again many times, each
// a little further out along the hair, with less and less of each hair left
// the further out it goes. Together the layers look like a coat of real hairs,
// parted, lit from inside, and with a soft edge against the sky.
//
// One drawing for all the layers (the same skin, drawn as many times over), so
// a dog in full fur costs the GPU less than a pet made of thirty balls. Fewer
// layers are drawn the smaller it looks, and none at all from far off.
import * as THREE from '../../vendor/three.module.js';
import { litByStudio, ToyMaterial } from './toon.js';

// The layers, the ones to leave out first at the end. Drawn in this order, any
// first few are spread evenly from root to tip.
const MOST = 18;
const heights = (() => {
  const out = [];
  for (let i = 0; i < MOST; i++) {
    // Every next number of a sequence that keeps filling the gaps evenly.
    out.push(1 - ((i * 0.6180339887) % 1) * 0.94);
  }
  out[0] = 1;
  return new Float32Array(out);
})();
const layers = new THREE.InstancedBufferAttribute(heights, 1);

// The most layers a quality draws (see setFurLayers in the renderer).
let fullest = MOST;
export function setFurLayers(n) {
  fullest = Math.min(MOST, n);
}

// The same skin, to be drawn as many times over as there are layers.
export function shellGeometry(geometry) {
  const g = new THREE.InstancedBufferGeometry();
  for (const n of Object.keys(geometry.attributes)) g.setAttribute(n, geometry.attributes[n]);
  g.setIndex(geometry.index);
  g.setAttribute('aT', layers);
  g.boundingBox = geometry.boundingBox;
  g.boundingSphere = geometry.boundingSphere;
  g.instanceCount = MOST;
  return g;
}

// How many layers to draw of a dog of this size, from how many pixels tall it
// looks from here.
export function shellsFor(renderer, camera, mesh, size) {
  const e = mesh.matrixWorld.elements;
  const c = camera.matrixWorld.elements;
  const d = Math.hypot(e[12] - c[12], e[13] - c[13], e[14] - c[14]) || 0.01;
  const target = renderer.getRenderTarget();
  const high = target ? target.height : renderer.domElement.height;
  const pixels = (size / d) * (camera.projectionMatrix.elements[5] * high * 0.5);
  if (pixels < 24) return 0;
  const want = pixels < 50 ? 3 : pixels < 100 ? 5 : pixels < 180 ? 8 : pixels < 320 ? 12 : MOST;
  return Math.min(want, fullest);
}

const VERTEX_TOP = /* glsl */ `
attribute vec4 aCoat;
attribute vec4 aSkin;
attribute vec4 aFur;
attribute float aAO;
#ifdef FUR_LAYER
attribute float aT;
#endif
varying vec3 vRest;
varying vec4 vCoat;
varying vec4 vSkin;
varying vec4 vFur;
varying float vAO;
varying float vT;
`;

const VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3( position );
vRest = position;
vCoat = aCoat;
vSkin = aSkin;
vFur = aFur;
vAO = aAO;
#ifdef FUR_LAYER
  vT = aT;
  transformed += normal * aFur.w * aT + aFur.xyz * aT * aT;
#else
  vT = 0.0;
#endif
`;

const FRAGMENT_TOP = /* glsl */ `
uniform vec3 uPal[4];
uniform float uCell;
uniform float uStretch;
uniform float uDither;
uniform float uLocks;
uniform int uPattern;
uniform vec2 uPatScale;
varying vec3 vRest;
varying vec4 vCoat;
varying vec4 vSkin;
varying vec4 vFur;
varying float vAO;
varying float vT;

vec4 furHash(vec3 p) {
  vec4 q = fract(p.xyzx * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw) * q.zywx);
}

float patNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = furHash(i).x;
  float b = furHash(i + vec3(1.0, 0.0, 0.0)).x;
  float c = furHash(i + vec3(0.0, 1.0, 0.0)).x;
  float d = furHash(i + vec3(1.0, 1.0, 0.0)).x;
  float e = furHash(i + vec3(0.0, 0.0, 1.0)).x;
  float g = furHash(i + vec3(1.0, 0.0, 1.0)).x;
  float h = furHash(i + vec3(0.0, 1.0, 1.0)).x;
  float j = furHash(i + vec3(1.0, 1.0, 1.0)).x;
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, j, f.x), f.y), f.z);
}

// How much a coat's pattern shows here: spots, merle, stripes.
float coatPattern(vec3 p) {
  if (uPattern == 1) {
    // Round spots, of all sizes.
    vec3 q = p * uPatScale.x;
    vec3 i = floor(q);
    float best = 0.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 c = i + vec3(float(x), float(y), float(z));
      vec4 h = furHash(c + 7.0);
      vec3 d = q - (c + 0.15 + 0.7 * h.xyz);
      float r = 0.13 + 0.3 * h.w * h.w;
      if (h.w < 0.42) continue;
      best = max(best, smoothstep(r, r * 0.72, length(d)));
    }
    return best;
  }
  if (uPattern == 2) {
    // Merle: torn patches of the dark colour.
    vec3 q = p * uPatScale.x;
    float n = patNoise(q) * 0.65 + patNoise(q * 2.3 + 4.0) * 0.35;
    return smoothstep(uPatScale.y, uPatScale.y + 0.05, n);
  }
  if (uPattern == 3) {
    // Brindle: dark stripes down its sides, wandering.
    vec3 q = p * vec3(1.0, 0.16, 1.0) * uPatScale.x;
    float n = patNoise(q + vec3(0.0, 0.0, 0.0)) + 0.5 * patNoise(q * 3.0);
    return smoothstep(-0.25, -0.55, sin(n * 9.0 + p.z * uPatScale.x * 1.5));
  }
  return 1.0;
}
`;

const FRAGMENT_COLOR = /* glsl */ `
  // The cell of hair this point is in: long along the way the hair lies.
  float furLen = vFur.w;
  vec3 lay = vFur.xyz;
  float layLen = length(lay);
  lay = layLen > 1e-5 ? lay / layLen : vec3(0.0, 0.0, -1.0);
  vec3 ddx = dFdx(vRest);
  vec3 ddy = dFdy(vRest);
  float across = max(length(ddx), length(ddy));
  // Hairs no finer than a pixel or so, whatever the distance.
  float level = max(0.0, ceil(log2(max(across * 1.5, 1e-6) / uCell)));
  float cell = uCell * pow(2.0, level);
  vec3 q = vRest / cell;
  q -= lay * dot(q, lay) * (1.0 - 1.0 / uStretch);
  q = mat3(0.36, 0.48, -0.8, -0.8, 0.6, 0.0, 0.48, 0.64, 0.6) * q;
  #ifdef FUR_LAYER
    // Hairs gather into locks towards their tips.
    vec3 lock = (floor(q / 7.0) + 0.5 + (furHash(floor(q / 7.0) + 13.0).xyz - 0.5) * 0.6) * 7.0;
    q = mix(q, lock, vT * vT * uLocks);
  #endif
  vec3 id = floor(q);
  vec3 inCell = fract(q) - 0.5;
  vec4 hair = furHash(id);
  vec4 hair2 = furHash(id + 41.0);

  #ifdef FUR_LAYER
    // Thinner the further out it goes; shorter for some hairs than others.
    float tall = 0.45 + 0.55 * hair.x;
    float left = 1.0 - vT / tall;
    float wide = (0.92 * sqrt(max(left, 0.0))) ;
    if (furLen < 0.0015 || left <= 0.0 || length(inCell + (vec3(hair.yz, hair2.x) - 0.5) * 0.3) > wide) discard;
  #endif

  // Each hair is one colour of its coat, by chance as much as the weights say.
  vec4 w = vCoat;
  if (uPattern != 0) {
    // Where the pattern is not, the coat's first colour.
    float showing = coatPattern(vRest);
    w.x += w.w * (1.0 - showing);
    w.w *= showing;
  }
  vec3 even = uPal[0] * w.x + uPal[1] * w.y + uPal[2] * w.z + uPal[3] * w.w;
  float sumW = w.x + w.y + w.z + w.w;
  even /= max(sumW, 1e-3);
  vec4 pick = w + (hair2 - 0.5) * uDither;
  vec3 fine = uPal[0];
  float top = pick.x;
  if (pick.y > top) { top = pick.y; fine = uPal[1]; }
  if (pick.z > top) { top = pick.z; fine = uPal[2]; }
  if (pick.w > top) { fine = uPal[3]; }
  // From far off, each hair too small to see, the colours just add up.
  float near = (1.0 - smoothstep(0.004, 0.02, across)) * smoothstep(0.0, 0.016, furLen);
  vec3 col = mix(even, fine, mix(0.25, 1.0, near));
  col *= mix(1.0, 0.86 + 0.26 * hair.w, near);
  #ifdef FUR_LAYER
    // Dark down among the roots, bright at the tips, where the light gets.
    col *= mix(0.62, 1.1, smoothstep(0.0, 1.0, vT));
  #else
    col *= mix(1.0, furLen > 0.002 ? 0.52 : 1.0, near);
  #endif
  // Darker in the folds, where the light does not reach; and leather.
  col *= mix(0.42, 1.0, vAO);
  col = mix(col, vSkin.rgb * mix(0.55, 1.0, vAO), vSkin.a);
  diffuseColor.rgb = col;
`;

// A coat's two materials: for the skin itself and for its layers of fur.
class FurMaterial extends ToyMaterial {
  onBeforeCompile(shader) {
    super.onBeforeCompile(shader);
    Object.assign(shader.uniforms, this.userData.uniforms);
    shader.vertexShader = (VERTEX_TOP + shader.vertexShader).replace('#include <begin_vertex>', VERTEX_BEGIN);
    shader.fragmentShader = (FRAGMENT_TOP + shader.fragmentShader)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      // A wet nose and lips; matt fur that the light scatters in.
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, vSkin.a * vSkin.a);')
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        normal = normalize(normal + (hair.yzx - 0.5) * 0.5 * near * (1.0 - vSkin.a));`,
      );
  }

  customProgramCacheKey() {
    return `dog-fur-${this.defines?.FUR_LAYER ? 1 : 0}`;
  }
}

// How fine a hair is, and how long next to that.
const hairs = { body: 0.0052, stretch: 3.4 };
export function furMaterials(coat, fur) {
  const palette = coat.palette.map((c) => new THREE.Color(c));
  while (palette.length < 4) palette.push(palette[0].clone());
  const uniforms = {
    uPal: { value: palette },
    uCell: { value: fur.cell ?? hairs.body },
    uStretch: { value: fur.stretch ?? hairs.stretch },
    uDither: { value: coat.dither ?? 0.45 },
    uLocks: { value: fur.locks ?? 0.14 },
    uPattern: { value: coat.pattern ?? 0 },
    uPatScale: { value: new THREE.Vector2(coat.patScale ?? 8, coat.patAt ?? 0.5) },
  };
  const make = (layer) => {
    const m = new FurMaterial({ color: '#ffffff', metalness: 0, roughness: 0.82, envMapIntensity: 0.34 });
    m.userData.uniforms = uniforms;
    if (layer) m.defines = { ...m.defines, FUR_LAYER: 1 };
    return litByStudio(m);
  };
  return { skinMaterial: make(false), furMaterial: make(true) };
}
