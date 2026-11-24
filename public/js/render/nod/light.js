// How the Land of Nod is lit (render/nod/view.js), and what is drawn on its
// ground: a soft light from over wherever you are (up is another way
// everywhere there), the sky's colour on what faces away from the ground and
// the ground's own on what faces it, shade gathered in every fold (worked out
// as each body's skin is made: ground.js), light catching the fuzz round every
// edge — and, painted on to the ground so that it lies on it however it curves,
// where a blow will land, a wave rolling out over it, a ring of fog.
import * as THREE from '../../../vendor/three.module.js';
import { studioLight } from '../toon.js';

// How many things can be painted on the ground at once.
export const MAX_ZONES = 12;

export const nodLight = {
  // How bright the sun's own light is on what faces it, and its colour over
  // everything; the colours of the light from the sky and back off the ground;
  // the rim's; the haze far off (its colour, and how thick).
  uSunLum: { value: 1 },
  uKey: { value: new THREE.Color(1, 0.97, 0.9) },
  uSky: { value: new THREE.Color(0.7, 0.75, 1) },
  uEarth: { value: new THREE.Color(0.5, 0.42, 0.55) },
  uRimColor: { value: new THREE.Color(1, 0.9, 1) },
  uRim: { value: 0.5 },
  uHaze: { value: new THREE.Color(0.5, 0.45, 0.75) },
  uHazeK: { value: 0.004 },
  uTime: { value: 0 },
  // What is painted on the ground: each where it is and how far round it
  // reaches (xyz, w), its colour and how strong (rgb, a), and what it is:
  // 1 a spot about to be hit (filling up as it comes: k), 2 a wave rolling
  // out (its width), 3 a ring (of fog, round a fight), 4 a soft pool of light.
  uZone: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector4()) },
  uZoneColor: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector4()) },
  uZoneKind: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector4()) },
};

export const LIGHT_GLSL = /* glsl */ `
  uniform float uSunLum;
  uniform vec3 uKey;
  uniform vec3 uSky;
  uniform vec3 uEarth;
  uniform vec3 uRimColor;
  uniform float uRim;
  uniform vec3 uHaze;
  uniform float uHazeK;
  uniform float uTime;
  uniform vec4 uZone[${MAX_ZONES}];
  uniform vec4 uZoneColor[${MAX_ZONES}];
  uniform vec4 uZoneKind[${MAX_ZONES}];
  float nodSq(float v) { return v * v; }
  float nodLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  // What is painted on the ground at a point of it: light to add to it (rgb)
  // and how much of its own colour it keeps (a).
  vec4 nodZones(vec3 w) {
    vec3 add = vec3(0.0);
    float keep = 1.0;
    for (int i = 0; i < ${MAX_ZONES}; i++) {
      float kind = uZoneKind[i].x;
      if (kind < 0.5) continue;
      vec4 z = uZone[i];
      vec4 col = uZoneColor[i];
      float d = distance(w, z.xyz);
      if (kind < 1.5) {
        // About to be hit: a bright rim, stripes turning, filling from the
        // middle out as it comes.
        float edge = 1.0 - smoothstep(z.w - 0.06, z.w, d);
        float rim = edge * smoothstep(z.w - 0.3, z.w - 0.06, d);
        float fill = edge * (1.0 - smoothstep(uZoneKind[i].y * z.w - 0.05, uZoneKind[i].y * z.w + 0.05, d));
        float flash = 0.75 + 0.25 * sin(uTime * 18.0);
        add += col.rgb * col.a * (rim * 1.4 * flash + fill * 0.5 + edge * 0.2);
        keep *= 1.0 - col.a * edge * mix(0.5, 0.85, max(rim, fill * 0.5));
      } else if (kind < 2.5) {
        // A wave: a crest, with foam trailing after it.
        float wide = uZoneKind[i].y;
        float crest = exp(-nodSq((d - z.w) / (wide * 0.5)));
        float trail = smoothstep(z.w - wide * 5.0, z.w, d) * step(d, z.w) * 0.35;
        // (Over its own colour only, not the ground's: it has to show on pale ground too.)
        add += col.rgb * col.a * (crest * 1.25 + trail * 0.7);
        keep *= 1.0 - col.a * min(1.0, crest * 0.92 + trail * 0.8);
      } else if (kind < 3.5) {
        float band = exp(-nodSq((d - z.w) / 0.5));
        float out_ = smoothstep(z.w - 0.2, z.w + 2.5, d) * (1.0 - smoothstep(z.w + 2.5, z.w + 9.0, d));
        float swirl = 0.7 + 0.3 * sin(uTime * 2.0 + d * 3.0 + w.x * 1.3 + w.z * 1.7);
        add += col.rgb * col.a * (band * 1.3 + out_ * 0.35) * swirl;
        keep *= 1.0 - col.a * (band * 0.6 + out_ * 0.4);
      } else {
        float pool = 1.0 - smoothstep(0.0, max(z.w, 0.01), d);
        add += col.rgb * col.a * pool * pool;
      }
    }
    return vec4(add, keep);
  }
`;

// The paint, from what three worked out: colour, the sun's light on it, the
// highlights; nodUp (the way up there, in view space), nodAo, nodFuzz (how much
// its edges catch the light, as cloth does) and nodGlow are the material's own.
const PAINT = /* glsl */ `
  {
    vec3 n = normalize(normal);
    vec3 eye = normalize(vViewPosition);
    float facing = saturate(dot(n, eye));
    float hemi = dot(n, nodUp) * 0.5 + 0.5;
    float sun = nodLum(reflectedLight.directDiffuse) / max(1e-4, nodLum(diffuseColor.rgb) * uSunLum);
    float lit = smoothstep(0.0, 0.75, sun);
    vec3 base = mix(uEarth, uSky, hemi) * nodAo;
    vec3 light = base * 0.6 + uKey * lit * 0.62 * mix(0.6, 1.0, nodAo);
    vec3 col = diffuseColor.rgb * light;
    vec3 spec = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    col += spec / (1.0 + spec * 1.4) * mix(0.35, 1.0, nodAo);
    float rim = pow(max(0.0, 1.0 - facing), 3.0);
    col += uRimColor * mix(vec3(1.0), diffuseColor.rgb, 0.45) * rim * uRim * (0.3 + 0.7 * hemi) * nodAo;
    col += diffuseColor.rgb * nodSq(1.0 - facing) * nodFuzz * light;
    col = mix(vec3(nodLum(col)), col, 1.1);
    vec4 zones = nodZones(nodWorld);
    col = col * zones.a + zones.rgb;
    col += totalEmissiveRadiance + nodGlow;
    float far = length(vViewPosition);
    float haze = 1.0 - exp(-pow(far * uHazeK, 1.5));
    outgoingLight = mix(max(col, vec3(0.0)), uHaze, haze);
  }
`;

// How each point knows its own up and shade: from what was worked out for it
// (ground), or from what it stands on, its own y being up (one of many drawn
// at once, or one thing by itself), with the shade gathered at its foot.
const FRAME = {
  ground: 'vNodUp = aUp; vNodAo = aAo; vNodN = normal; vNodW = (modelMatrix * vec4(position, 1.0)).xyz;',
  instanced: 'mat4 nodM = modelMatrix * instanceMatrix; vNodUp = normalize((nodM * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vNodAo = 0.55 + 0.45 * smoothstep(0.0, 0.5, position.y); vNodN = normalize((nodM * vec4(normal, 0.0)).xyz); vNodW = (nodM * vec4(position, 1.0)).xyz;',
  object: 'vNodUp = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vNodAo = 0.92; vNodN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vNodW = (modelMatrix * vec4(position, 1.0)).xyz;',
};

// A material lit so, over three's standard one: params as that takes them;
// skin: GLSL run per point with these to change — vec3 albedo, float rough,
// vec3 bend (added to the normal, along the world's axes), float fuzz, vec3 glow
// — and to read: vec3 p (the point in the body's own axes, from its middle),
// vec3 n (its normal there), vec3 up, vec3 w (the point in the world), float ao;
// head: GLSL before main; uniforms: its own; mode: one of FRAME's.
export function nodMaterial(params = {}, { skin = '', head = '', uniforms = {}, key = '', mode = 'ground' } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.35, envMap: studioLight(), ...params });
  const own = { uBodyC: { value: new THREE.Vector3() }, uBodyM: { value: new THREE.Matrix3() }, ...uniforms };
  m.userData.nod = own;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, nodLight, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${mode === 'ground' ? 'attribute vec3 aUp; attribute float aAo;' : ''}\nvarying vec3 vNodUp;\nvarying float vNodAo;\nvarying vec3 vNodW;\nvarying vec3 vNodN;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${FRAME[mode]}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${LIGHT_GLSL}\nvarying vec3 vNodUp;\nvarying float vNodAo;\nvarying vec3 vNodW;\nvarying vec3 vNodN;\nuniform vec3 uBodyC;\nuniform mat3 uBodyM;\n${head}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 nodWorld = vNodW;
        vec3 nodUp = normalize((viewMatrix * vec4(normalize(vNodUp), 0.0)).xyz);
        float nodAo = vNodAo;
        float nodFuzz = 0.0;
        vec3 nodGlow = vec3(0.0);
        vec3 nodBend = vec3(0.0);
        float nodRough = roughness;
        {
          vec3 w = vNodW;
          vec3 up = normalize(vNodUp);
          vec3 p = uBodyM * (w - uBodyC);
          vec3 n = normalize(uBodyM * vNodN);
          float ao = nodAo;
          vec3 albedo = diffuseColor.rgb;
          float rough = nodRough;
          vec3 bend = vec3(0.0);
          float fuzz = 0.0;
          vec3 glow = vec3(0.0);
          ${skin}
          diffuseColor.rgb = albedo;
          nodRough = rough;
          nodBend = bend * uBodyM;
          nodFuzz = fuzz;
          nodGlow = glow;
          nodAo = ao;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = nodRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + (viewMatrix * vec4(nodBend, 0.0)).xyz);')
      .replace('#include <opaque_fragment>', `${PAINT}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `nod|${key}|${mode}`;
  return m;
}
