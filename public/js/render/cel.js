// Cartoon light: flat paint in three tones, as a cartoon is coloured — lit,
// turned from the sun, and in shadow — with a hard white glint on what is
// glossy, and no gradient in between. Toon Isle (render/cartoon.js) is
// painted this way, and on it so is everything that moves (render/toon.js's
// toys, uCelOn); the renderer's ink lines go round all of it
// (render/renderer.js outlinePass).
//
// Each material works out its light as three's do, from the sun and the sky;
// celShade then reads how much of the sun reaches the point (the sun's own
// diffuse light over what full sun on it would be: so the sun turned away, or
// its shadow, both count) and paints the point's colour in the tone for
// that, tinted by the time of day.
import * as THREE from '../../vendor/three.module.js';

// What lights the cartoon paint, set by the renderer each frame: how bright
// the sun's diffuse light is on something facing it (to read each point's
// share of it against), the light's tint and brightness over everything (warm
// white by day, a dim blue by night), and whether the toys are painted so
// too (on Toon Isle).
export const celLight = {
  uSunLum: { value: 1 },
  uCelTint: { value: new THREE.Color(1, 1, 1) },
  uCelOn: { value: 0 },
};

// The tones, as shares of a colour: in full sun, turned from it, in shadow.
export const CEL_TONES = [1.0, 0.8, 0.6];

export const CEL_PARS = /* glsl */ `
  uniform float uSunLum;
  uniform vec3 uCelTint;
  uniform float uCelOn;
  float celLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  // The tone for a point with this colour and this much of the sun's diffuse
  // light on it: the sun's share of full sun, in three steps, a little soft
  // at their edges so they do not crawl.
  float celTone(vec3 albedo, vec3 sunLight) {
    float share = celLum(sunLight) / max(1e-4, celLum(albedo) * uSunLum);
    float tone = mix(${CEL_TONES[2].toFixed(2)}, ${CEL_TONES[1].toFixed(2)}, smoothstep(0.10, 0.16, share));
    return mix(tone, ${CEL_TONES[0].toFixed(2)}, smoothstep(0.50, 0.58, share));
  }
`;

// A material painted the cartoon way (three's Lambert, its light read as
// cel tones): params as MeshLambertMaterial takes them, and hooks into its
// shaders — vertex(shader) and fragment(shader), to add a material's own
// (each gets three's shader object to change, before the cel paint goes in),
// uniforms to add. The cel paint replaces the point's colour just before it
// is written out (fog and the rest come after, as for any material).
export function celMaterial(params = {}, { vertex = null, fragment = null, uniforms = {}, key = '' } = {}) {
  const m = new THREE.MeshLambertMaterial(params);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, celLight, uniforms);
    shader.fragmentShader = `${CEL_PARS}\n${shader.fragmentShader}`;
    vertex?.(shader);
    fragment?.(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `outgoingLight = diffuseColor.rgb * celTone(diffuseColor.rgb, reflectedLight.directDiffuse) * uCelTint + totalEmissiveRadiance;
      #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => `cel|${key}`;
  return m;
}
