// The Wild Isle's water (render/real.js): the sea all round it out to the
// horizon, rolling in swells, and the ponds and streams above the sea, each
// at its own level. Clear and pale green over sand in the shallows, deep blue
// further out, foam where it laps the shore, the sky and the sun's glitter on
// it — how deep it is at each point read off the ground's heights.
import * as THREE from '../../vendor/three.module.js';
import { SKY_GLSL } from './real-sky.js';

// The water's top, under the top of its blocks.
export const WATER_DROP = 0.2;

const WATER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSwell;
  uniform vec2 uCentre;
  varying vec3 vWorld;
  varying float vWave;
  #include <common>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  // Swells rolling in (Gerstner waves, gentle), dying away close in to the
  // island's middle so they never come up through the land.
  vec3 swell(vec3 p, out float crest) {
    vec3 off = vec3(0.0);
    crest = 0.0;
    vec2 dirs[4] = vec2[4](vec2(0.8, 0.6), vec2(-0.5, 0.86), vec2(0.97, -0.24), vec2(-0.3, -0.95));
    float lens[4] = float[4](11.0, 7.3, 5.1, 3.7);
    float amps[4] = float[4](0.11, 0.07, 0.045, 0.03);
    for (int i = 0; i < 4; i++) {
      float k = 6.2831 / lens[i];
      float c = sqrt(9.8 * k) * 0.55;
      float ph = k * dot(dirs[i], p.xz) - c * uTime;
      float a = amps[i] * uSwell;
      off.xz += dirs[i] * a * 0.6 * cos(ph);
      off.y += a * sin(ph);
      crest += a * sin(ph);
    }
    return off;
  }
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float fade = clamp(1.0 - (length(world.xz - uCentre) - 220.0) / 260.0, 0.0, 1.0);
    float crest;
    // (Inland water and the sea far out lie still: their meshes say so with
    // a zero in uv.x.)
    vec3 off = swell(world.xyz, crest) * fade * uv.x;
    world.xyz += off;
    vWave = crest * fade * uv.x;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform highp sampler2DArray tNormal;
  uniform highp sampler2D tHeight;
  uniform vec2 uHeightSize;
  uniform float uDeep;
  uniform vec3 uWaterShallow;
  uniform vec3 uWaterDeep;
  uniform float uFoamy;
  uniform float uSeaY;
  varying vec3 vWorld;
  varying float vWave;
  #include <common>
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  ${SKY_GLSL}
  float groundAt(vec2 xz) {
    vec2 uv = (xz * 2.0 + 0.5) / uHeightSize;
    // Out past the island's map the sea bed goes on from its edge, falling away.
    vec2 out2 = max(max(-uv, uv - 1.0), 0.0) * uHeightSize * 0.5;
    float past = max(out2.x, out2.y);
    float edge = texture2D(tHeight, clamp(uv, vec2(0.0), vec2(1.0))).r;
    return edge - past * 0.35 - smoothstep(0.0, 6.0, past) * 2.0;
  }
  vec3 ripples(vec2 p, float far) {
    vec2 a = texture(tNormal, vec3(p / 9.0 + vec2(uTime * 0.021, uTime * 0.013), 13.0)).xy * 2.0 - 1.0;
    vec2 b = texture(tNormal, vec3(p / 5.3 - vec2(uTime * 0.017, -uTime * 0.026), 13.0)).xy * 2.0 - 1.0;
    vec2 c = texture(tNormal, vec3(p / 23.0 + vec2(-uTime * 0.009, uTime * 0.012), 13.0)).xy * 2.0 - 1.0;
    vec2 d = (a * 0.45 + b * 0.35 + c * 0.6) * mix(1.0, 0.35, far);
    return normalize(vec3(d.x, 1.0, d.y));
  }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 V = toEye / dist;
    float far = smoothstep(20.0, 140.0, dist);
    vec3 N = ripples(vWorld.xz, far);
    float depth = max(0.0, vWorld.y - groundAt(vWorld.xz));
    // Looking down into it: light lost the deeper it is, red first.
    float slant = max(0.15, V.y);
    vec3 through = exp(-vec3(0.45, 0.16, 0.11) * depth * (1.0 + 0.6 / slant));
    // A pond or a stream up on the land: darker, greener, browner than the sea.
    float inland = step(uSeaY + 0.5, vWorld.y);
    vec3 shallow = mix(uWaterShallow, vec3(0.16, 0.27, 0.2), inland);
    vec3 deep = mix(uWaterDeep, vec3(0.025, 0.06, 0.045), inland);
    vec3 body = mix(deep, shallow, through) * (0.25 + 0.75 * uDay);
    float clear = dot(through, vec3(0.33));
    // The sky in it, more at a glance than straight down.
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 sky = skyColour(R, false);
    float sunSpec = pow(max(dot(R, uSunDir), 0.0), 900.0) * 60.0 + pow(max(dot(R, uSunDir), 0.0), 90.0) * 1.2;
    vec3 col = mix(body, sky, fres) + uSunColor * sunSpec * uSunUp;
    // Foam where it laps the shore, and on the crests of the swell.
    vec4 fn = texture(tNormal, vec3(vWorld.xz / 3.1 + vec2(uTime * 0.03, 0.0), 13.0));
    float edge = smoothstep(0.45, 0.0, depth) * uFoamy;
    float lap = 0.5 + 0.5 * sin(depth * 14.0 - uTime * 1.6 + fn.x * 3.0);
    float foam = edge * smoothstep(0.35, 0.75, fn.w * 0.6 + lap * 0.55);
    foam = max(foam, smoothstep(0.2, 0.26, vWave) * smoothstep(0.7, 0.9, fn.w) * 0.35 * (1.0 - far));
    col = mix(col, vec3(0.92, 0.95, 0.97) * (0.35 + 0.65 * uDay), foam);
    float alpha = clamp(max(1.0 - clear * 0.92, fres) + foam, 0.0, 1.0);
    // The very edge fades into the sand.
    alpha *= smoothstep(0.0, 0.06, depth);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// Falling water: white streaks pouring down a sheet, foaming where it lands.
const FALLS_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const FALLS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform highp sampler2DArray tAlbedo;
  uniform float uDay;
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    // uv: x along the edge it pours over, y down from its lip (in blocks).
    float a = texture(tAlbedo, vec3(vUv.x * 0.35, vUv.y * 0.12 - uTime * 0.55, 16.0)).a;
    float b = texture(tAlbedo, vec3(vUv.x * 0.8 + 0.3, vUv.y * 0.2 - uTime * 0.9, 16.0)).a;
    float streak = smoothstep(0.35, 0.75, a * 0.6 + b * 0.5);
    vec3 col = mix(vec3(0.42, 0.62, 0.66), vec3(0.95, 0.97, 0.98), streak) * (0.35 + 0.65 * uDay);
    float alpha = 0.65 + streak * 0.35;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// Water made for a world: the sea, and the water over the ground's columns
// that stands above the sea (cols from real-ground.js groundColumns).
export class RealWater {
  constructor(world, cols, heightTexture, textures, sky) {
    this.world = world;
    const { W, D, sea } = world;
    this.uniforms = {
      uTime: { value: 0 },
      uSwell: { value: 1 },
      uCentre: { value: new THREE.Vector2(W / 2, D / 2) },
      tNormal: { value: textures.normal },
      tHeight: { value: heightTexture },
      uHeightSize: { value: new THREE.Vector2(heightTexture.image.width, heightTexture.image.height) },
      uDeep: { value: sea - 12 },
      uWaterShallow: { value: new THREE.Color(0.32, 0.62, 0.56) },
      uWaterDeep: { value: new THREE.Color(0.012, 0.075, 0.13) },
      uFoamy: { value: 1 },
      uSeaY: { value: sea + 1 - WATER_DROP },
      ...sky.uniforms,
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      // (Its own depth, not the sea bed's, for what comes after: the shading
      // in corners and the haze.)
      depthWrite: true,
      fog: true,
    });
    this.group = new THREE.Group();
    this.group.name = 'real water';
    const top = sea + 1 - WATER_DROP;
    // The sea: fine round the island, where the swell shows, then out to
    // the horizon in rings ever coarser.
    const inner = new THREE.PlaneGeometry(W + 160, D + 160, (W + 160) / 2, (D + 160) / 2);
    inner.rotateX(-Math.PI / 2);
    inner.translate(W / 2, top, D / 2);
    this.setStill(inner, 1);
    const near = new THREE.Mesh(inner, this.material);
    near.renderOrder = 2;
    near.frustumCulled = false;
    const ring = this.ring(W, D, top, (W + 160) / 2, 3000);
    const far = new THREE.Mesh(ring, this.material);
    far.renderOrder = 2;
    far.frustumCulled = false;
    this.group.add(near, far);
    // Ponds and streams over the sea: a quad over each column of their water
    // and the columns beside it (the land hides what is over the bank).
    const inland = this.inland(cols, sea);
    if (inland) {
      const m = new THREE.Mesh(inland, this.material);
      m.renderOrder = 2;
      this.group.add(m);
    }
    // Falls, wherever water steps down from one column to the next.
    const falls = this.falls(cols, sea);
    if (falls) {
      this.fallsMaterial = new THREE.ShaderMaterial({
        uniforms: { uTime: this.uniforms.uTime, tAlbedo: { value: textures.albedo }, uDay: sky.uniforms.uDay, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
        vertexShader: FALLS_VERT,
        fragmentShader: FALLS_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      });
      const m = new THREE.Mesh(falls, this.fallsMaterial);
      m.renderOrder = 3;
      this.group.add(m);
    }
  }

  // A sheet of falling water on each side between a column of water and a
  // lower one beside it (or the sea), from the one's top down to the other's.
  falls(cols, sea) {
    const { W, D } = this.world;
    const pos = [];
    const uv = [];
    const idx = [];
    const topOf = (x, z) => {
      if (x < 0 || z < 0 || x >= W || z >= D) return sea + 1;
      const k = x * D + z;
      return cols.water[k] || (cols.height[k] <= sea ? sea + 1 : 0);
    };
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const hi = cols.water[x * D + z];
        if (hi <= sea + 1) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const lo = topOf(x + dx, z + dz);
          if (!lo || lo >= hi) continue;
          // The edge between the two columns, and the sheet down it.
          const ex = dx > 0 ? x + 1 : dx < 0 ? x : null;
          const ez = dz > 0 ? z + 1 : dz < 0 ? z : null;
          const a = ex !== null ? [ex, z] : [x, ez];
          const b = ex !== null ? [ex, z + 1] : [x + 1, ez];
          const y0 = hi - WATER_DROP;
          const y1 = lo - WATER_DROP - 0.05;
          const out = 0.06;
          const v = pos.length / 3;
          pos.push(a[0] + dx * out, y0, a[1] + dz * out, b[0] + dx * out, y0, b[1] + dz * out, b[0] + dx * out * 3, y1, b[1] + dz * out * 3, a[0] + dx * out * 3, y1, a[1] + dz * out * 3);
          const along = ex !== null ? z : x;
          uv.push(along, 0, along + 1, 0, along + 1, y0 - y1, along, y0 - y1);
          idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
        }
      }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  // uv.x is how much a vertex rises and falls with the swell.
  setStill(geo, k) {
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, k, 0);
  }

  ring(W, D, y, half, far) {
    const cx = W / 2;
    const cz = D / 2;
    const pos = [];
    const idx = [];
    const steps = 48;
    const radii = [half * 1.0, half * 1.6, half * 3, half * 8, far];
    // Square inner edge meeting the inner plane, round beyond.
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

  inland(cols, sea) {
    const { W, D } = this.world;
    const pos = [];
    const idx = [];
    const level = new Int16Array(W * D);
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const top = cols.water[x * D + z];
        if (top <= sea + 1) continue;
        // Over it and round it, unless a neighbour has water of its own.
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

  update(time) {
    this.uniforms.uTime.value = time;
  }

  dispose() {
    for (const m of this.group.children) m.geometry.dispose();
    this.material.dispose();
    this.fallsMaterial?.dispose();
  }
}
