// Toon Isle's water (render/cartoon.js), a storybook's: turquoise in the
// shallows deepening smoothly to blue far out, nets of light rippling over
// the sand under the shallows, the sky's colour shining off it where you
// look along it, the sun sparkling on its little waves, rings of white foam
// lapping round every shore and a band of it right at the water's edge. How
// deep it is at each point is read off the ground's heights (real-ground.js
// heightTexture). Under the Cloud Blanket the ground is raised over it, so
// none shows there.
import * as THREE from '../../vendor/three.module.js';

// The water's top, under the top of its blocks (as the Wild Isle's).
export const WATER_DROP = 0.2;

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // A gentle bob, none far out.
    world.y += 0.06 * sin(world.x * 0.35 + uTime * 1.3) * sin(world.z * 0.3 + uTime * 1.1) * uv.x;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform sampler2D tHeight;
  uniform vec2 uHeightSize;
  uniform vec3 uShallow;
  uniform vec3 uMid;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform vec3 uLightTint;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform float uSun;
  uniform float uTop;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  float wHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 wHash2(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // A net of light: how near p is to the edge between two cells, the cells'
  // points drifting round in circles.
  float wNet(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 h = wHash2(i + g);
        vec2 r = g + 0.5 + 0.38 * sin(t + 6.2831 * h) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return sqrt(d2) - sqrt(d1);
  }
  void main() {
    vec2 uv = (vWorld.xz * 2.0 + 0.5) / uHeightSize;
    float bed = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? uTop - 30.0 : texture2D(tHeight, uv).r;
    float depth = max(0.0, uTop - bed);
    float px = length(fwidth(vWorld.xz));
    // Deeper and deeper blue, smoothly.
    vec3 col = mix(uShallow, uMid, smoothstep(0.3, 3.2, depth));
    col = mix(col, uDeep, smoothstep(3.0, 12.0, depth));
    // Light rippling over the sand in the shallows.
    float fine = 1.0 - smoothstep(0.05, 0.16, px);
    float net = 1.0 - smoothstep(0.0, 0.04 + px * 1.2, wNet(vWorld.xz * 0.8 + vec2(uTime * 0.05, 0.0), uTime * 0.9));
    col += vec3(0.5, 0.7, 0.65) * net * (1.0 - smoothstep(0.3, 2.4, depth)) * 0.3 * fine;
    // Little waves: the water's slope, for the sky and the sun on it.
    vec2 q = vWorld.xz * 0.6;
    float e = 0.35;
    float w0 = wNoise(q + vec2(uTime * 0.3, uTime * 0.17)) + 0.5 * wNoise(q * 2.3 - vec2(uTime * 0.2, uTime * 0.31));
    float wx = wNoise(q + vec2(e, 0.0) + vec2(uTime * 0.3, uTime * 0.17)) + 0.5 * wNoise((q + vec2(e, 0.0)) * 2.3 - vec2(uTime * 0.2, uTime * 0.31));
    float wz = wNoise(q + vec2(0.0, e) + vec2(uTime * 0.3, uTime * 0.17)) + 0.5 * wNoise((q + vec2(0.0, e)) * 2.3 - vec2(uTime * 0.2, uTime * 0.31));
    vec3 n = normalize(vec3(-(wx - w0) * 0.5, 1.0, -(wz - w0) * 0.5));
    vec3 v = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 4.0);
    col = mix(col, uSky, fresnel * 0.55);
    // The sun sparkling on it: a hard glint, brighter than white (it glows).
    vec3 r = reflect(-v, n);
    float glint = smoothstep(0.985, 0.995, dot(r, uSunDir)) * uSun;
    // Foam: a band at the very edge, and rings lapping in round the shore.
    float edge = 1.0 - smoothstep(0.32, 0.42, depth);
    float ring = smoothstep(0.78, 0.82, fract(depth * 0.9 - uTime * 0.45)) * (1.0 - smoothstep(1.2, 2.6, depth));
    float foam = max(edge, ring);
    col = mix(col, uFoam, foam);
    gl_FragColor = vec4(col * uLightTint + vec3(3.0, 2.8, 2.4) * glint * (1.0 - foam), 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class CartoonWater {
  // cols: the ground's columns (real-ground.js groundColumns); heightTexture:
  // the skin's heights (RealGround.heightTexture); tint: the storybook
  // light's (cartoon-light.js cartoonLight.uLightTint), shared.
  constructor(world, cols, heightTexture, tint) {
    this.world = world;
    const { W, D, sea } = world;
    const top = sea + 1 - WATER_DROP;
    this.uniforms = {
      uTime: { value: 0 },
      tHeight: { value: heightTexture },
      uHeightSize: { value: new THREE.Vector2(heightTexture.image.width, heightTexture.image.height) },
      uShallow: { value: new THREE.Color('#62ecdc') },
      uMid: { value: new THREE.Color('#25b2ef') },
      uDeep: { value: new THREE.Color('#1a6ee0') },
      uFoam: { value: new THREE.Color('#ffffff') },
      uLightTint: tint,
      uSky: { value: new THREE.Color('#bfeaff') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSun: { value: 1 },
      uTop: { value: top },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true });
    this.group = new THREE.Group();
    this.group.name = 'cartoon water';
    const near = new THREE.PlaneGeometry(W + 200, D + 200, (W + 200) / 4, (D + 200) / 4);
    near.rotateX(-Math.PI / 2);
    near.translate(W / 2, top, D / 2);
    const uv = near.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 1, 0);
    const a = new THREE.Mesh(near, this.material);
    a.frustumCulled = false;
    a.renderOrder = 1;
    const far = new THREE.Mesh(ring(W, D, top, (W + 200) / 2, 3000), this.material);
    far.frustumCulled = false;
    far.renderOrder = 1;
    this.group.add(a, far);
    // Ponds and streams over the sea.
    const inland = inlandWater(world, cols);
    if (inland) {
      const m = new THREE.Mesh(inland, this.material);
      m.renderOrder = 1;
      this.group.add(m);
    }
  }

  // Each frame: the time (waves, foam, light), and the sky and the sun it
  // shows (sky.js environment).
  update(time, env = null) {
    this.uniforms.uTime.value = time;
    if (!env) return;
    this.uniforms.uSky.value.copy(env.horizon).lerp(env.top, 0.35);
    this.uniforms.uSunDir.value.copy(env.sunDir);
    this.uniforms.uSun.value = Math.max(0, Math.min(1, env.sunDir.y * 4)) * env.day;
  }

  dispose() {
    for (const m of this.group.children) m.geometry.dispose();
    this.material.dispose();
  }
}

// The sea on out to the horizon round the island's square: a ring.
function ring(W, D, y, half, far) {
  const cx = W / 2;
  const cz = D / 2;
  const pos = [];
  const idx = [];
  const steps = 48;
  const radii = [half, half * 1.6, half * 3, half * 8, far];
  for (let r = 0; r < radii.length; r++) {
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const k = r === 0 ? half / Math.max(Math.abs(c), Math.abs(sn)) : radii[r];
      pos.push(cx + c * k, y, cz + sn * k);
    }
  }
  for (let r = 0; r < radii.length - 1; r++) {
    for (let s = 0; s < steps; s++) {
      const a = r * steps + s;
      const b = r * steps + ((s + 1) % steps);
      const c = (r + 1) * steps + s;
      const d = (r + 1) * steps + ((s + 1) % steps);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  return g;
}

// Ponds and streams above the sea: a quad over each column of their water
// and the columns round it (the land hides what is over the bank).
function inlandWater(world, cols) {
  const { W, D, sea } = world;
  const level = new Int16Array(W * D);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const top = cols.water[x * D + z];
      if (top <= sea + 1) continue;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
          const k = nx * D + nz;
          const own = cols.water[k];
          if (own && own !== top) continue;
          level[k] = Math.max(level[k], top);
        }
      }
    }
  }
  const pos = [];
  const idx = [];
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const top = level[x * D + z];
      if (!top) continue;
      const y = top - WATER_DROP;
      const v = pos.length / 3;
      pos.push(x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
