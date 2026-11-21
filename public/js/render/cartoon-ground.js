// Toon Isle's ground (render/cartoon.js): the same one smooth skin over the
// island's blocks as the Wild Isle's (real-ground.js: slopes where columns
// are a step apart, faces of rock where they are more), painted as a
// storybook's: each corner of the island in its own bright palette, and in
// the storybook light (cartoon-light.js).
//
// Where one paint meets another (grass and a path, sand and grass) the line
// is crisp and a little wavy, as if drawn, and the grass is a shade darker
// along it. The grass has two greens in big soft patches and little light
// leaves in it; paths have round pebbles; sand is speckled, wet at the
// water's edge; rock is cobbled; snow sparkles. Every face of a cliff has
// its top's grass (or sand, or snow) hanging over its edge in round
// scallops, and under that layers of soil with pebbles in them, a layer
// cake. Fine detail fades out far off, where it would only flicker. Under
// the Cloud Blanket (cartoon-clouds.js) the ground is raised up into the
// cloud bank and painted as cloud.
import * as THREE from '../../vendor/three.module.js';
import { cartoonMaterial } from './cartoon-light.js';
import { FOG_GLSL } from './cartoon-clouds.js';

// Each corner's paint, by the ground's splat channels (real-ground.js
// SPLATS: grass, forest floor, earth, sand, rock, gravel, snow, gloom), and
// its cliffs' soil: two layers and the pebbles in them.
const PALETTES = {
  toonbay: { grass: '#6cd43c', forest: '#4fc040', dirt: '#f2b26a', sand: '#ffe39c', rock: '#c8b8aa', gravel: '#dacfc0', snow: '#ffffff', gloom: '#9a8fb5', soil: '#dc874c', stripe: '#bd6a3c', pebble: '#f6c48e' },
  toonwood: { grass: '#55c946', forest: '#3fb34c', dirt: '#e0a266', sand: '#f6dc9a', rock: '#b9a892', gravel: '#c9c0b0', snow: '#ffffff', gloom: '#8a7fa6', soil: '#bd774b', stripe: '#9a5c3a', pebble: '#e6ae7c' },
  tooncanyon: { grass: '#b4d84a', forest: '#97c445', dirt: '#f2a868', sand: '#ffcd7e', rock: '#ef8a4c', gravel: '#e2b38a', snow: '#ffffff', gloom: '#a3758a', soil: '#ec7a48', stripe: '#c85634', pebble: '#ffc28c' },
  toonpeak: { grass: '#74d66a', forest: '#5cc062', dirt: '#d6a87e', sand: '#efe2c0', rock: '#aab4d2', gravel: '#c4c9da', snow: '#fbfdff', gloom: '#8f8fb0', soil: '#929fc6', stripe: '#7480ad', pebble: '#dbe2f4' },
  toonstorm: { grass: '#5ab06c', forest: '#409560', dirt: '#ab8b9c', sand: '#d6c4b9', rock: '#7d6aae', gravel: '#9a8fbd', snow: '#f4f2ff', gloom: '#5b4f86', soil: '#71619f', stripe: '#594a8a', pebble: '#aa9adb' },
};
const ORDER = ['grass', 'forest', 'dirt', 'sand', 'rock', 'gravel', 'snow', 'gloom'];
const CLOUD = '#f6f3ff';

export function groundPalette(theme) {
  return PALETTES[theme] ?? PALETTES.toonbay;
}

// The island's columns as a little picture, a texel to each (red: how high
// its ground's top is, green: what it is made of, as real-ground.js
// groundColumns has them), for the cliffs to see whose top they are.
export function columnTexture(world, cols) {
  const { W, D } = world;
  const data = new Uint8Array(W * D * 4);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const k = x * D + z;
      const t = (z * W + x) * 4;
      data[t] = Math.max(0, Math.min(255, cols.height[k]));
      data[t + 1] = cols.kind[k];
      data[t + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, D, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Noise for painting patterns: a hash, a smooth noise, and points scattered
// one to a cell (how far the nearest and the second nearest are, and the
// nearest's cell); and a round spot with a smooth edge.
export const NOISE_GLSL = /* glsl */ `
  float gHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 gHash2(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  vec4 gCells(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 r = g + 0.1 + 0.8 * gHash2(i + g) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = i + g;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return vec4(sqrt(d1), sqrt(d2), id);
  }
  float gSpot(float d, float r, float aa) { return 1.0 - smoothstep(r - aa, r + aa, d); }
`;

const GROUND_GLSL = /* glsl */ `
  ${NOISE_GLSL}
  uniform vec3 uPaint[8];
  uniform vec3 uSoil;
  uniform vec3 uStripe;
  uniform vec3 uPebble;
  uniform vec3 uCloud;
  uniform float uSea;
  uniform sampler2D uCols;
  uniform vec2 uColsSize;
  uniform vec3 uLampColor;
  uniform float uNight;
  varying vec4 vSplatA;
  varying vec4 vSplatB;
  varying vec2 vExtra;
  varying vec3 vWorld;
  varying float vClear;
  // Paint k at the point w, with its detail: px, how much of the world one
  // pixel spans; big, the big soft patches. glint: a sparkle there (snow).
  vec3 gPaint(int k, vec3 w, float px, float big, out float glint) {
    glint = 0.0;
    vec3 c = uPaint[k];
    float fine = 1.0 - smoothstep(0.035, 0.11, px);
    if (k == 0 || k == 1) {
      c = mix(c, c * vec3(0.88, 0.95, 0.8), smoothstep(0.45, 0.6, big));
      c *= 0.95 + 0.1 * gNoise(w.xz * 0.45);
      #if GROUND_DETAIL
      vec4 v = gCells(w.xz * 2.4);
      float h = gHash(v.zw);
      float leaf = gSpot(v.x, 0.1 + 0.08 * h, px * 2.4 + 0.015) * step(0.4, h) * fine;
      c = mix(c, c * vec3(1.08, 1.14, 0.86) + vec3(0.02, 0.03, 0.0), leaf * 0.85);
      #endif
    } else if (k == 2) {
      c *= 0.94 + 0.1 * gNoise(w.xz * 0.7);
      #if GROUND_DETAIL
      vec4 v = gCells(w.xz * 2.0);
      float h = gHash(v.zw + 3.1);
      float r = 0.1 + 0.1 * h;
      float peb = gSpot(v.x, r, px * 2.0 + 0.015) * step(0.55, h) * fine;
      float lit = gSpot(length(w.xz * 2.0 - v.zw - 0.5 + 0.04), r * 0.6, px * 2.0 + 0.015);
      c = mix(c, c * vec3(1.16, 1.12, 1.06) + 0.03 * lit, peb);
      #endif
    } else if (k == 3) {
      c *= 1.0 + (gNoise(w.xz * 5.0) - 0.5) * 0.1 * fine;
      #if GROUND_DETAIL
      vec4 v = gCells(w.xz * 3.0);
      c *= 1.0 - 0.07 * gSpot(v.x, 0.08, px * 3.0 + 0.02) * step(0.6, gHash(v.zw)) * fine;
      #endif
      c *= mix(0.84, 1.0, smoothstep(uSea + 1.05, uSea + 1.45, w.y));
    } else if (k == 4 || k == 7) {
      #if GROUND_DETAIL
      vec4 v = gCells(w.xz * 1.2);
      c *= 0.9 + 0.2 * gHash(v.zw + 9.7);
      c *= 1.0 - 0.22 * (1.0 - smoothstep(0.02, 0.06 + px * 1.2, v.y - v.x));
      #else
      c *= 0.92 + 0.16 * gNoise(w.xz * 1.2);
      #endif
    } else if (k == 5) {
      #if GROUND_DETAIL
      vec4 v = gCells(w.xz * 3.6);
      c *= 0.88 + 0.22 * gHash(v.zw);
      c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.08 + px * 3.6, v.y - v.x)) * fine;
      #else
      c *= 0.9 + 0.2 * gNoise(w.xz * 3.6);
      #endif
    } else if (k == 6) {
      c = mix(c, c * vec3(0.9, 0.94, 1.0), smoothstep(0.4, 0.7, big));
      glint = step(0.985, gHash(floor(w.xz * 9.0))) * fine;
    }
    return c;
  }
`;

// The paint at the point: the two paints most there, a crisp wavy line
// between them, and on a cliff's face its lip and its soil.
const GROUND_PAINT = /* glsl */ `
  {
    vec3 w = vWorld;
    float px = length(fwidth(w.xz)) + 0.5 * abs(fwidth(w.y));
    float big = gNoise(w.xz * 0.06 + 3.1);
    // Each paint's share, nudged by its own noise, so the lines between
    // them wave.
    float h[8];
    h[0] = vSplatA.x; h[1] = vSplatA.y; h[2] = vSplatA.z; h[3] = vSplatA.w;
    h[4] = vSplatB.x; h[5] = vSplatB.y; h[6] = vSplatB.z; h[7] = vSplatB.w;
    #if GROUND_DETAIL
    for (int i = 0; i < 8; i++) h[i] += 0.34 * (gNoise(w.xz * 0.85 + float(i) * 17.3) - 0.5);
    #else
    // (Cheaper: grass's wave against everything else's.)
    float nGrass = gNoise(w.xz * 0.85) - 0.5;
    float nOther = gNoise(w.xz * 0.85 + 31.7) - 0.5;
    for (int i = 0; i < 8; i++) h[i] += 0.34 * (i <= 1 ? nGrass : nOther);
    #endif
    int ia = 0;
    for (int i = 1; i < 8; i++) if (h[i] > h[ia]) ia = i;
    int ib = ia == 0 ? 1 : 0;
    for (int i = 0; i < 8; i++) if (i != ia && h[i] > h[ib]) ib = i;
    // (And a finer wave in the line between those two.)
    float gap = h[ia] - h[ib] + 0.07 * (gNoise(w.xz * 3.1 + float(ia) * 5.1) - gNoise(w.xz * 3.1 + float(ib) * 5.1));
    if (gap < 0.0) {
      int swap = ia;
      ia = ib;
      ib = swap;
      gap = -gap;
    }
    float glintA;
    float glintB;
    vec3 ca = gPaint(ia, w, px, big, glintA);
    vec3 cb = gPaint(ib, w, px, big, glintB);
    // Grass a shade darker along where it meets something else.
    float rim = 1.0 - smoothstep(0.0, 0.07, gap);
    if (ia <= 1 && ib > 1) ca *= 1.0 - 0.16 * rim;
    float aa = fwidth(gap) * 0.8 + 1e-4;
    float t = smoothstep(-aa, aa, gap);
    vec3 paint = mix(cb, ca, t);
    float glint = mix(glintB, glintA, t);
    // A face of a cliff (by its own slope, not its smoothed normal): the
    // top's paint hanging over its edge, soil under that.
    vec3 gn = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
    float steep = 1.0 - smoothstep(0.5, 0.6, gn.y);
    if (steep > 0.0 && vClear > 0.0) {
      vec2 out2 = normalize(gn.xz + 1e-5);
      vec4 col = texture2D(uCols, (floor(w.xz - out2 * 0.45) + 0.5) / uColsSize);
      float top = col.r * 255.0;
      int kind = int(col.g * 255.0 + 0.5);
      float below = max(0.0, top - w.y);
      // (Along the face: along whichever of x and z it faces less, so a
      // rough face's pattern does not swirl with its bumps.)
      float s = abs(out2.x) > abs(out2.y) ? w.z : w.x;
      float bump = fract(s * 1.3) - 0.5;
      float lip = 0.15 + 0.15 * sqrt(max(0.0, 0.25 - bump * bump)) * 2.0;
      float band = fract((w.y + 0.35 * gNoise(vec2(s * 0.3, 1.7))) * 0.6);
      float bandAa = abs(fwidth(w.y)) * 0.6 + 0.01;
      float layer = smoothstep(0.55 - bandAa, 0.55 + bandAa, band) - smoothstep(0.97 - bandAa, 0.97 + bandAa, band);
      vec3 soilA = uSoil;
      vec3 soilB = uStripe;
      if (kind == 3) {
        soilA = uPaint[3] * vec3(0.92, 0.84, 0.74);
        soilB = uPaint[3] * vec3(0.8, 0.7, 0.6);
      } else if (kind >= 4 && kind != 6) {
        soilA = uPaint[kind];
        soilB = uPaint[kind] * 0.84;
      } else if (kind == 6) {
        soilA = uPaint[4];
        soilB = uPaint[4] * vec3(0.86, 0.9, 1.0);
      }
      vec3 face = mix(soilA, soilB, layer);
      face *= 0.95 + 0.1 * gNoise(vec2(s, w.y) * 1.7);
      #if GROUND_DETAIL
      vec4 v = gCells(vec2(s, w.y) * 1.8);
      float ph = gHash(v.zw + 5.3);
      float fineF = 1.0 - smoothstep(0.04, 0.12, px);
      float peb = gSpot(v.x, 0.11 + 0.1 * ph, px * 1.8 + 0.02) * step(0.5, ph) * fineF;
      face = mix(face, (kind <= 2 ? uPebble : mix(soilA, vec3(1.0), 0.35)) * (0.9 + 0.2 * ph), peb);
      #endif
      bool soft = kind <= 3 || kind == 6;
      if (soft) {
        // Its shadow just under the lip, and the lip itself.
        face *= 1.0 - 0.22 * (1.0 - smoothstep(lip, lip + 0.3, below));
        float lipAa = abs(fwidth(w.y)) * 0.8 + 0.01;
        float under = smoothstep(lip - lipAa, lip + lipAa, below);
        vec3 lipColor = uPaint[kind] * mix(1.04, 0.84, smoothstep(0.0, lip, below));
        face = mix(lipColor, face, under);
      }
      paint = mix(paint, face, steep);
    }
    // A little darker where the land round it hides the sky.
    paint *= 0.86 + 0.14 * vExtra.x;
    diffuseColor.rgb = mix(uCloud, paint, vClear);
    totalEmissiveRadiance += vec3(2.4, 2.5, 2.8) * glint * vClear * (1.0 - steep);
  }
`;

// The ground's material: a storybook one (cartoon-light.js) painting the
// skin's splats as above (real-ground.js), reading the island's columns
// (columnTexture) for its cliffs and the Cloud Blanket (cartoon-clouds.js
// fogUniforms) for where it is still hidden. extra: the skin's shading
// where the land round hides the sky, and lamp light.
// detail: whether its fine detail is painted (pebbles, little leaves,
// cobbles; not at the lowest picture quality, setDetail).
export function cartoonGroundMaterial(theme, fog, uniforms, columns, { size, sea, detail = true }) {
  const pal = groundPalette(theme);
  const own = {
    uPaint: { value: ORDER.map((k) => new THREE.Color(pal[k])) },
    uSoil: { value: new THREE.Color(pal.soil) },
    uStripe: { value: new THREE.Color(pal.stripe) },
    uPebble: { value: new THREE.Color(pal.pebble) },
    uCloud: { value: new THREE.Color(CLOUD) },
    uSea: { value: sea },
    uCols: { value: columns },
    uColsSize: { value: new THREE.Vector2(size[0], size[1]) },
  };
  const m = cartoonMaterial(
    { color: 0xffffff, roughness: 0.82, envMapIntensity: 0.15 },
    {
      key: `cartoon-ground-${theme}`,
      uniforms: { ...fog, ...uniforms, ...own },
      vertex: (shader) => {
        shader.vertexShader = `${FOG_GLSL}
          attribute vec4 splatA;
          attribute vec4 splatB;
          attribute vec2 extra;
          varying vec4 vSplatA;
          varying vec4 vSplatB;
          varying vec2 vExtra;
          varying vec3 vWorld;
          varying float vClear;
          ${shader.vertexShader}`
          .replace(
            '#include <beginnormal_vertex>',
            `#include <beginnormal_vertex>
            // Under the clouds: up into the cloud bank, facing the sky.
            float clear = fogClear(position.xz);
            objectNormal = normalize(mix(vec3(0.0, 1.0, 0.0), objectNormal, clear));`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            transformed.y = mix(fogBank(position.xz) + 0.25 * sin(position.x * 0.3 + uTime * 0.4) * sin(position.z * 0.27), transformed.y, clear);
            vSplatA = splatA;
            vSplatB = splatB;
            vExtra = extra;
            vWorld = transformed;
            vClear = clear;`,
          );
      },
      fragment: (shader) => {
        shader.fragmentShader = `${GROUND_GLSL}\n${shader.fragmentShader}`
          .replace('#include <color_fragment>', `#include <color_fragment>\n${GROUND_PAINT}`)
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += uLampColor * vExtra.y * uNight * vClear + uCloud * (1.0 - vClear) * 0.12;`,
          );
      },
    },
  );
  setDetail(m, detail);
  return m;
}

// The ground's fine detail painted, or not.
export function setDetail(material, on) {
  material.defines = { ...material.defines, GROUND_DETAIL: on ? 1 : 0 };
  material.needsUpdate = true;
}
