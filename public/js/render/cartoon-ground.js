// Toon Isle's ground (render/cartoon.js): the same one smooth skin over the
// island's blocks as the Wild Isle's (real-ground.js: slopes where columns
// are a step apart, faces of rock where they are more), painted as a cartoon:
// flat colours in the three cel tones (cel.js), each corner of the island its
// own bright palette — grass in two greens in big soft patches, cliffs in
// stripes like a layer cake, sand with a wet band at the water's edge, snow
// as white as icing — and under the Cloud Blanket (cartoon-clouds.js), raised
// up into the cloud bank and painted as cloud.
import * as THREE from '../../vendor/three.module.js';
import { celMaterial } from './cel.js';
import { FOG_GLSL } from './cartoon-clouds.js';

// Each corner's paint, by the ground's splat channels (real-ground.js
// SPLATS: grass, forest floor, earth, sand, rock, gravel, snow, gloom), and
// its cliffs' second stripe.
const PALETTES = {
  toonbay: { grass: '#7fdc4f', forest: '#5fc24a', dirt: '#e8b878', sand: '#ffe39a', rock: '#c9b49a', gravel: '#d7cdbd', snow: '#ffffff', gloom: '#8f86a8', stripe: '#b39a80' },
  toonwood: { grass: '#5fcf5a', forest: '#46b04d', dirt: '#d9a06a', sand: '#f6dc9a', rock: '#b8a690', gravel: '#c9c0b0', snow: '#ffffff', gloom: '#8a7fa6', stripe: '#a08a72' },
  tooncanyon: { grass: '#b9d65a', forest: '#9cc24e', dirt: '#e9a86a', sand: '#ffc978', rock: '#f08a4b', gravel: '#e2b38a', snow: '#ffffff', gloom: '#a3758a', stripe: '#d9573a' },
  toonpeak: { grass: '#78d66a', forest: '#5fbf62', dirt: '#cfa27a', sand: '#efe2c0', rock: '#a9b2cf', gravel: '#c4c9da', snow: '#fbfdff', gloom: '#8f8fb0', stripe: '#8e98bd' },
  toonstorm: { grass: '#58b06c', forest: '#3f9460', dirt: '#a8889a', sand: '#d5c3b8', rock: '#7d6aae', gravel: '#9a8fbd', snow: '#f4f2ff', gloom: '#5b4f86', stripe: '#5f4f94' },
};
const ORDER = ['grass', 'forest', 'dirt', 'sand', 'rock', 'gravel', 'snow', 'gloom'];
const CLOUD = '#f6f3ff';

export function groundPalette(theme) {
  return PALETTES[theme] ?? PALETTES.toonbay;
}

// The ground's material: a cartoon one (cel.js) reading the skin's splats
// for its paint (real-ground.js), and the Cloud Blanket (cartoon-clouds.js
// fogUniforms) for where it is still hidden. extra: the skin's shading
// where the land round hides the sky, and lamp light.
export function cartoonGroundMaterial(theme, fog, uniforms) {
  const pal = groundPalette(theme);
  const colors = ORDER.map((k) => new THREE.Color(pal[k]));
  const own = {
    uPaint: { value: colors },
    uStripe: { value: new THREE.Color(pal.stripe) },
    uCloud: { value: new THREE.Color(CLOUD) },
    uSea: { value: 20 },
  };
  return celMaterial(
    { color: 0xffffff },
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
        shader.fragmentShader = `
          uniform vec3 uPaint[8];
          uniform vec3 uStripe;
          uniform vec3 uCloud;
          uniform float uSea;
          uniform vec3 uLampColor;
          uniform float uNight;
          varying vec4 vSplatA;
          varying vec4 vSplatB;
          varying vec2 vExtra;
          varying vec3 vWorld;
          varying float vClear;
          float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float cNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(cHash(i), cHash(i + vec2(1, 0)), u.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), u.x), u.y);
          }
          ${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            // Each paint sharpened, so one ends where the next begins as a
            // cartoon's would, not in a smear.
            vec4 a = vSplatA * vSplatA * vSplatA;
            vec4 b = vSplatB * vSplatB * vSplatB;
            // The rock's paint in stripes up a cliff, a layer cake; the
            // grass's in two greens, in big soft patches; a wet band of sand
            // at the water's edge.
            float layers = cNoise(vWorld.xz * 0.05) * 0.8;
            vec3 rock = mix(uPaint[4], uStripe, step(0.5, fract(vWorld.y * 0.34 + layers)));
            float blot = smoothstep(0.545, 0.555, cNoise(vWorld.xz * 0.07 + 3.1));
            vec3 grass = mix(uPaint[0], uPaint[0] * vec3(0.86, 0.92, 0.8), blot);
            vec3 forest = mix(uPaint[1], uPaint[1] * vec3(0.86, 0.92, 0.8), blot);
            vec3 sand = uPaint[3] * (vWorld.y < uSea + 1.25 ? 0.88 : 1.0);
            vec3 paint = grass * a.x + forest * a.y + uPaint[2] * a.z + sand * a.w + rock * b.x + uPaint[5] * b.y + uPaint[6] * b.z + uPaint[7] * b.w;
            paint /= max(0.001, a.x + a.y + a.z + a.w + b.x + b.y + b.z + b.w);
            // A little darker where the land round it hides the sky.
            paint *= 0.9 + 0.1 * vExtra.x;
            diffuseColor.rgb = mix(uCloud, paint, vClear);
          }`,
        ).replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += uLampColor * vExtra.y * uNight * vClear + uCloud * (1.0 - vClear) * 0.12;`,
        );
      },
    },
  );
}
