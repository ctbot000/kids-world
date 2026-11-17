// The Wild Isle's sky (render/real.js): a real one, not a cartoon — deep
// blue overhead paling to a hazy horizon, the sun a blinding disc with a
// glow round it (gold and low at either end of the day), clouds drifting at
// their own height, lit from the side the sun is on, and at night the moon
// and stars. Its colours follow the island's time of day and weather
// (sky.js environment); skyColour is shared with the water, which shows it.
import * as THREE from '../../vendor/three.module.js';

export const SKY_GLSL = /* glsl */ `
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uSunColor;
  uniform float uSunUp;
  uniform float uDay;
  uniform float uSkyBright;
  // The colour of the sky looking along dir (normalised); disc: with the
  // sun's own disc in it.
  vec3 skyColour(vec3 dir, bool disc) {
    float up = dir.y;
    float h = pow(clamp(up, 0.0, 1.0), 0.42);
    vec3 col = mix(uSkyHorizon, uSkyTop, h);
    // Below the horizon: haze over the sea.
    col = mix(col, uSkyHorizon * 0.82, smoothstep(0.0, -0.25, up));
    float cs = dot(dir, uSunDir);
    float low = 1.0 - smoothstep(0.0, 0.45, uSunDir.y);
    // The glow round the sun, wide and warm when it is low.
    vec3 warm = mix(uSunColor, vec3(1.0, 0.55, 0.28), low * 0.7);
    float glow = pow(max(cs, 0.0), 6.0) * (0.25 + 0.6 * low) + pow(max(cs, 0.0), 48.0) * 0.55;
    col += warm * glow * uSunUp;
    // A band of warmth all along the horizon at either end of the day.
    col += vec3(1.0, 0.5, 0.25) * low * uSunUp * 0.35 * exp(-abs(up) * 9.0) * (0.4 + 0.6 * max(cs, 0.0));
    col *= uSkyBright;
    if (disc) {
      float sun = smoothstep(0.99975, 0.99988, cs);
      col += uSunColor * sun * 38.0 * uSunUp;
      float moon = smoothstep(0.99955, 0.99968, dot(dir, uMoonDir));
      col = mix(col, vec3(0.85, 0.88, 0.95) * 1.6, moon * (1.0 - uDay * 0.7));
    }
    return col;
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */ `
  ${SKY_GLSL}
  uniform highp sampler2DArray tAlbedo;
  uniform float uTime;
  uniform float uCloud;
  uniform float uStars;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float clouds(vec2 p) {
    float a = texture(tAlbedo, vec3(p, 16.0)).a;
    float b = texture(tAlbedo, vec3(p * 2.7 + 0.31, 16.0)).a;
    float c = texture(tAlbedo, vec3(p * 7.1 + 0.77, 16.0)).a;
    return a * 0.62 + b * 0.28 + c * 0.1;
  }
  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = skyColour(dir, true);
    // Stars, at night.
    if (uStars > 0.0 && dir.y > 0.0) {
      vec3 cell = floor(dir * 420.0);
      float s = hash(cell);
      float star = step(0.9975, s) * smoothstep(0.0, 0.2, dir.y);
      col += vec3(0.9, 0.95, 1.0) * star * uStars * (0.6 + 0.4 * sin(uTime * 3.0 + s * 60.0)) * 1.4;
    }
    // Clouds on a layer high over the island, drifting.
    if (dir.y > 0.0 && uCloud > 0.0) {
      vec2 p = dir.xz / (dir.y + 0.06) * 0.22 + vec2(uTime * 0.0021, uTime * 0.0009);
      float n = clouds(p);
      float cover = mix(0.62, 0.3, uCloud);
      float dens = smoothstep(cover, cover + 0.22, n);
      // Lit from the sun's side: thinner towards it is brighter.
      float toward = clouds(p + uSunDir.xz * 0.025);
      float lit = clamp(0.55 + (n - toward) * 5.0, 0.0, 1.0);
      vec3 bright = mix(vec3(1.0), uSunColor, 0.5) * (0.6 + 0.9 * uSunUp) * uSkyBright;
      vec3 shade = mix(uSkyHorizon * 0.55, vec3(0.42, 0.45, 0.52), 0.5) * (0.35 + 0.65 * uDay) * uSkyBright;
      vec3 cloud = mix(shade, bright, lit);
      // Their edges catch the light round the sun.
      cloud += uSunColor * pow(max(dot(dir, uSunDir), 0.0), 12.0) * (1.0 - dens) * 1.5 * uSunUp;
      float a = dens * smoothstep(0.0, 0.18, dir.y) * 0.95;
      col = mix(col, cloud, a);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class RealSky {
  constructor(textures) {
    this.uniforms = {
      uSkyTop: { value: new THREE.Color() },
      uSkyHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSunUp: { value: 1 },
      uDay: { value: 1 },
      uSkyBright: { value: 1 },
    };
    this.own = {
      tAlbedo: { value: textures.albedo },
      uTime: { value: 0 },
      uCloud: { value: 0.4 },
      uStars: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, ...this.own },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), this.material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.cloudy = 0.4;
  }

  // The sky now: env as sky.js environment gives it, the weather.
  update(dt, time, env, weather, camera) {
    const u = this.uniforms;
    // A real sky is a deeper blue overhead than a cartoon's.
    u.uSkyTop.value.copy(env.top).multiply(tmp.setRGB(0.82, 0.9, 1.0));
    u.uSkyHorizon.value.copy(env.horizon);
    u.uSunDir.value.copy(env.sunDir);
    u.uMoonDir.value.copy(env.moonDir);
    u.uSunColor.value.copy(env.sun);
    u.uSunUp.value = Math.max(0, Math.min(1, (env.sunDir.y + 0.04) / 0.12));
    u.uDay.value = env.day;
    u.uSkyBright.value = 0.55 + 0.75 * env.day;
    const want = weather === 'clear' || weather === 'rainbow' ? 0.35 : weather === 'cloudy' ? 0.78 : 0.95;
    this.cloudy += (want - this.cloudy) * Math.min(1, dt * 0.2);
    this.own.uCloud.value = this.cloudy;
    this.own.uTime.value = time;
    this.own.uStars.value = env.stars ?? 0;
    this.dome.position.copy(camera.position);
  }

  dispose() {
    this.dome.geometry.dispose();
    this.material.dispose();
  }
}

const tmp = new THREE.Color();
