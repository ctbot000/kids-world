// Toon Isle's light (render/cartoon.js): a storybook's, soft and rich, not a
// comic's flat bands. Each point is lit by how much of the sun reaches it
// (turned from it, or in a shadow, it reaches less), on a soft ramp from the
// shade's colour — cool and colourful, never grey, darker where it faces the
// ground — up to full sun; then the glossy sheen of the studio's light and
// the sun's highlight go on, a soft rim of sky light runs round every edge so
// rounded things look round and stand out from what is behind them, and the
// colours are a little richer than life.
import * as THREE from '../../vendor/three.module.js';
import { studioLight } from './toon.js';

// What lights it all, set by the renderer each frame: how bright the sun's
// diffuse light is on something facing it (each point's share of it is read
// against this), the light's tint over everything (warm white by day, a dim
// blue by night), the colour of the shade, the rim's colour and strength,
// and how much richer than life the colours are.
export const cartoonLight = {
  uSunLum: { value: 1 },
  uLightTint: { value: new THREE.Color(1, 1, 1) },
  uShadeTint: { value: new THREE.Color(0.58, 0.64, 0.9) },
  uRimColor: { value: new THREE.Color(1, 0.97, 0.9) },
  uRim: { value: 0.5 },
  uSat: { value: 1.12 },
};

export const CARTOON_LIGHT_GLSL = /* glsl */ `
  uniform float uSunLum;
  uniform vec3 uLightTint;
  uniform vec3 uShadeTint;
  uniform vec3 uRimColor;
  uniform float uRim;
  uniform float uSat;
  float cLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

// The paint, from what three worked out for the point: its colour, the sun's
// diffuse light on it, the highlights, its normal and the way to the eye
// (both in view space). Nothing reads three's own sky light: the shade's
// colour stands for it.
const PAINT = /* glsl */ `
  {
    vec3 n = normalize(normal);
    vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float sunShare = cLum(reflectedLight.directDiffuse) / max(1e-4, cLum(diffuseColor.rgb) * uSunLum);
    float lit = smoothstep(0.0, 0.6, sunShare);
    vec3 shade = uShadeTint * (0.8 + 0.2 * dot(n, up));
    vec3 light = mix(shade, vec3(1.0), lit);
    float rim = pow(1.0 - saturate(dot(n, normalize(vViewPosition))), 3.0);
    vec3 col = diffuseColor.rgb * light + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    col += uRimColor * mix(vec3(1.0), diffuseColor.rgb, 0.4) * rim * uRim * (0.35 + 0.65 * lit);
    col = max(vec3(0.0), mix(vec3(cLum(col)), col, uSat));
    outgoingLight = col * uLightTint + totalEmissiveRadiance;
  }
`;

// A material lit the storybook way (three's standard material, its light
// painted up as above): params as MeshStandardMaterial takes them (rough and
// not metal unless said; the studio's light for its sheen), and hooks into
// its shaders — vertex(shader), fragment(shader): a material's own, each
// given three's shader object to change before the paint goes in — and
// uniforms to add.
export function cartoonMaterial(params = {}, { vertex = null, fragment = null, uniforms = {}, key = '' } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, envMapIntensity: 0.35, envMap: studioLight(), ...params });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cartoonLight, uniforms);
    shader.fragmentShader = `${CARTOON_LIGHT_GLSL}\n${shader.fragmentShader}`;
    vertex?.(shader);
    fragment?.(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `${PAINT}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `cartoon|${key}`;
  return m;
}
