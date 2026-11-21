// Toon Isle's water (render/cartoon.js): flat cartoon paint, no reflections —
// turquoise in the shallows, blue further out and deep blue far out, each a
// band of its own; rings of white foam lapping round every shore, a band of
// it right at the water's edge, and white glints drifting over it. How deep
// it is at each point is read off the ground's heights (real-ground.js
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
    // A gentle cartoon bob, none far out.
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
  uniform vec3 uCelTint;
  uniform float uTop;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    vec2 uv = (vWorld.xz * 2.0 + 0.5) / uHeightSize;
    float bed = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? uTop - 30.0 : texture2D(tHeight, uv).r;
    float depth = max(0.0, uTop - bed);
    // Three bands of blue by depth, each flat.
    vec3 col = depth < 1.4 ? uShallow : depth < 5.0 ? uMid : uDeep;
    // Foam: a band at the very edge, and rings lapping in round the shore.
    float edge = 1.0 - smoothstep(0.32, 0.4, depth);
    float ring = step(0.82, fract(depth * 0.9 - uTime * 0.45)) * (1.0 - smoothstep(1.2, 2.6, depth));
    col = mix(col, uFoam, max(edge, ring));
    // White glints drifting over it.
    // (Each a little four-pointed twinkle in its cell, now and then.)
    vec2 q = vWorld.xz * 0.35 + vec2(uTime * 0.2, uTime * 0.11);
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float on = step(0.975, wHash(cell)) * step(0.55, fract(uTime * 0.5 + wHash(cell + 7.0)));
    float star = step(abs(f.x) * abs(f.y) * 60.0 + length(f) * 2.2, 0.32);
    col = mix(col, uFoam, on * star);
    gl_FragColor = vec4(col * uCelTint, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class CartoonWater {
  // cols: the ground's columns (real-ground.js groundColumns); heightTexture:
  // the skin's heights (RealGround.heightTexture); tint: the cel light's
  // (cel.js celLight.uCelTint), shared.
  constructor(world, cols, heightTexture, tint) {
    this.world = world;
    const { W, D, sea } = world;
    const top = sea + 1 - WATER_DROP;
    this.uniforms = {
      uTime: { value: 0 },
      tHeight: { value: heightTexture },
      uHeightSize: { value: new THREE.Vector2(heightTexture.image.width, heightTexture.image.height) },
      uShallow: { value: new THREE.Color('#5fe6e0') },
      uMid: { value: new THREE.Color('#35b4ea') },
      uDeep: { value: new THREE.Color('#2b7fd8') },
      uFoam: { value: new THREE.Color('#ffffff') },
      uCelTint: tint,
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

  update(time) {
    this.uniforms.uTime.value = time;
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
