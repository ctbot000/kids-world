// The blocky world on the GPU: one group of meshes per 16x16 chunk, rebuilt
// when blocks change, with shaders that mix sunlight, lamp light and corner
// shadows (and the shadows of everything that moves), sway the flowers, turn
// fruit to face you, ripple the water and drift the lava.
import * as THREE from '../../vendor/three.module.js';
import { BLOCKS, isTreeFoot } from '../shared/blocks.js';
import { LightMap, LIGHT_REACH } from '../shared/light.js';
import { CHUNK } from '../shared/world.js';
import { meshChunk, TREE_REACH, WATER_TOP } from './mesher.js';
import { gashaponMaterials, gashaponModel } from './gashapon-model.js';
import { toyMaterial } from './toon.js';
import { TILE } from './atlas.js';

const STUD_RADIUS = 0.25;
const STUD_HEIGHT = 0.13;
const STUD_DISTANCE = 56;
// Blocks right in front of the camera dissolve: from none of a surface at the
// first distance (along the view) to all of it at the second. Half is gone
// halfway between, and a tap goes through from there in (see Renderer.seeThrough).
export const NEAR_FADE = [0.9, 2.6];

export const LIGHT_GLSL = /* glsl */ `
  uniform float uDaylight;
  uniform vec3 uSunColor;
  uniform vec3 uLampColor;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  float curve(float level) { return pow(0.8, (1.0 - level) * 15.0); }
  vec3 decode(vec3 c) { return pow(c, vec3(2.2)); }
  // sunlit: how much of the sun gets through (see SHADOW_FRAG).
  vec3 lightOf(float sky, float lamp, float sunlit) {
    vec3 sun = uSunColor * curve(sky) * uDaylight * sunlit;
    vec3 bulb = uLampColor * pow(curve(lamp), 1.25);
    return max(max(sun, bulb), uAmbient);
  }
  vec3 lightOf(float sky, float lamp) { return lightOf(sky, lamp, 1.0); }
  vec3 fogged(vec3 col, float depth) {
    return mix(col, uFogColor, smoothstep(uFogNear, uFogFar, depth));
  }
  // Blocks right in front of the camera dissolve in a fine pattern, so a
  // tree crown or a wall behind you never fills the whole screen.
  float bayer(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[int(i)] + 0.5) / 16.0;
  }
  uniform float uNearFade;
  void nearFade(float depth) {
    if (uNearFade < 0.5) return;
    float keep = smoothstep(${NEAR_FADE[0].toFixed(2)}, ${NEAR_FADE[1].toFixed(2)}, depth);
    if (keep < 1.0 && bayer(gl_FragCoord.xy) > keep) discard;
  }
`;

// The shadows of everything that moves (players, pets, animals, monsters),
// cast by the sun onto the ground round you, at the better picture qualities
// (see Renderer.setQuality). three's own shadow chunks: the vertex shader sets
// worldPosition and mvPosition, then SHADOW_VERT; the fragment shader asks
// sunlit() how much sun gets through.
const SHADOW_VERT_PARS = /* glsl */ `
  #include <common>
  #include <shadowmap_pars_vertex>
  varying vec3 vWorld;
`;
const SHADOW_VERT = /* glsl */ `
  vWorld = worldPosition.xyz;
  #include <shadowmap_vertex>
`;
const SHADOW_FRAG = /* glsl */ `
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  uniform vec3 uShadowFocus;
  uniform float uShadowReach;
  varying vec3 vWorld;
  // 1 in full sun; a shadow lets a little over half through, and shadows fade
  // out before the edge of the ground they are drawn on.
  float sunlit() {
    #ifdef USE_SHADOWMAP
      float edge = smoothstep(uShadowReach * 0.7, uShadowReach, distance(vWorld.xz, uShadowFocus.xz));
      if (edge >= 1.0) return 1.0;
      return mix(mix(0.55, 1.0, getShadowMask()), 1.0, edge);
    #else
      return 1.0;
    #endif
  }
`;

const SOLID_VERT = /* glsl */ `
  ${SHADOW_VERT_PARS}
  attribute vec3 uvl;
  attribute vec3 tint;
  attribute vec4 lit;
  varying vec3 vUvl;
  varying vec3 vTint;
  varying vec4 vLit;
  varying float vDepth;
  uniform float uTime;
  void main() {
    vec3 p = position;
    #ifdef SWAY
      float t = uTime * 1.7 + p.x * 0.7 + p.z * 0.9;
      p.x += sin(t) * 0.07 * lit.w;
      p.z += cos(t * 0.8) * 0.05 * lit.w;
    #endif
    vec4 worldPosition = modelMatrix * vec4(p, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    ${SHADOW_VERT}
    vUvl = uvl;
    vTint = tint;
    vLit = lit;
    vDepth = -mvPosition.z;
  }
`;

const SOLID_FRAG = /* glsl */ `
  precision highp sampler2DArray;
  uniform sampler2DArray atlas;
  #ifdef FOLIAGE
    uniform sampler2DArray foliage;
  #endif
  varying vec3 vUvl;
  varying vec3 vTint;
  varying vec4 vLit;
  varying float vDepth;
  ${LIGHT_GLSL}
  ${SHADOW_FRAG}
  void main() {
    nearFade(vDepth);
    #ifdef FOLIAGE
      vec4 tex = texture(foliage, vUvl);
    #else
      vec4 tex = texture(atlas, vUvl);
    #endif
    #ifdef CUTOUT
      if (tex.a < 0.5) discard;
    #endif
    vec3 base = tex.rgb * decode(vTint);
    float ao = mix(0.52, 1.0, vLit.z);
    #ifdef SWAY
      float shade = 1.0;
    #else
      float shade = vLit.w;
    #endif
    vec3 col = base * lightOf(vLit.x, vLit.y, sunlit()) * ao * shade;
    #ifdef GLASS
      gl_FragColor = vec4(fogged(col, vDepth), tex.a);
    #else
      gl_FragColor = vec4(fogged(col, vDepth), 1.0);
    #endif
    #include <colorspace_fragment>
  }
`;

const ITEM_VERT = /* glsl */ `
  attribute vec3 uvl;
  attribute vec2 corner;
  attribute vec4 lit;
  varying vec3 vUvl;
  varying vec4 vLit;
  varying float vDepth;
  uniform float uTime;
  void main() {
    // Stay upright and turn to face the camera.
    vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
    float bob = lit.w * sin(uTime * 2.2 + position.x * 1.3 + position.z) * 0.05;
    float swing = (1.0 - lit.w) * sin(uTime * 1.5 + position.x + position.z * 1.7) * 0.04;
    vec3 p = position + right * (corner.x + swing) + vec3(0.0, corner.y + bob, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vUvl = uvl;
    vLit = lit;
    vDepth = -mv.z;
  }
`;

const ITEM_FRAG = /* glsl */ `
  precision highp sampler2DArray;
  uniform sampler2DArray atlas;
  varying vec3 vUvl;
  varying vec4 vLit;
  varying float vDepth;
  ${LIGHT_GLSL}
  void main() {
    nearFade(vDepth);
    vec4 tex = texture(atlas, vUvl);
    if (tex.a < 0.5) discard;
    vec3 col = tex.rgb * lightOf(vLit.x, vLit.y);
    gl_FragColor = vec4(fogged(col, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

const WATER_VERT = /* glsl */ `
  attribute vec3 uvl;
  attribute vec3 tint;
  attribute vec4 lit;
  varying vec3 vUvl;
  varying vec4 vLit;
  varying float vDepth;
  varying vec3 vWorld;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float wave = sin(p.x * 1.3 + uTime * 1.4) + sin(p.z * 1.1 + uTime * 1.1) + sin((p.x + p.z) * 0.6 + uTime * 0.7) * 0.6;
    p.y += (wave * 0.035 - 0.02) * lit.w;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    vUvl = uvl;
    vLit = lit;
    vDepth = -mv.z;
    vWorld = world.xyz;
  }
`;

const WATER_FRAG = /* glsl */ `
  precision highp sampler2DArray;
  uniform sampler2DArray atlas;
  uniform float uWaterLayer;
  varying vec3 vUvl;
  varying vec4 vLit;
  varying float vDepth;
  varying vec3 vWorld;
  ${LIGHT_GLSL}
  void main() {
    vec2 flow = vec2(vWorld.x + vWorld.y * 0.3, vWorld.z) * 0.5 + vec2(uTime * 0.05, uTime * 0.03);
    vec4 tex = texture(atlas, vec3(fract(flow), uWaterLayer));
    vec3 col = tex.rgb * lightOf(max(vLit.x, 0.35), vLit.y);
    float s = sin(vWorld.x * 2.3 + uTime * 1.3) * sin(vWorld.z * 1.9 - uTime * 1.1);
    float broad = sin(vWorld.x * 0.9 - uTime * 0.6) * sin(vWorld.z * 0.7 + uTime * 0.5);
    col += vec3(0.12) * smoothstep(0.72, 1.0, s) * vLit.w * uDaylight;
    col += vec3(0.08) * smoothstep(0.55, 1.0, broad) * vLit.w * uDaylight;
    // Seen at a low angle, the water picks up the colour of the sky above it.
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
    col += uFogColor * fres * 0.18;
    gl_FragColor = vec4(fogged(col, vDepth), 0.72);
    #include <colorspace_fragment>
  }
`;

const LAVA_VERT = /* glsl */ `
  attribute vec3 uvl;
  attribute vec3 tint;
  attribute vec4 lit;
  varying vec3 vUvl;
  varying vec4 vLit;
  varying float vDepth;
  varying vec3 vWorld;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float wave = sin(p.x * 0.9 + uTime * 0.5) + sin(p.z * 0.7 + uTime * 0.4);
    p.y += (wave * 0.02 - 0.01) * lit.w;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    vUvl = uvl;
    vLit = lit;
    vDepth = -mv.z;
    vWorld = world.xyz;
  }
`;

const LAVA_FRAG = /* glsl */ `
  precision highp sampler2DArray;
  uniform sampler2DArray atlas;
  uniform float uLavaLayer;
  varying vec3 vUvl;
  varying vec4 vLit;
  varying float vDepth;
  varying vec3 vWorld;
  ${LIGHT_GLSL}
  void main() {
    // Molten rock: the painted crust drifting slowly round, hotter and
    // darker in patches that come and go, bright however dark the night.
    vec2 flow = vec2(vWorld.x + vWorld.y * 0.3, vWorld.z) * 0.35 + vec2(uTime * 0.012, -uTime * 0.009);
    vec4 tex = texture(atlas, vec3(fract(flow), uLavaLayer));
    vec3 col = tex.rgb * 1.3;
    float s = sin(vWorld.x * 1.7 + uTime * 0.5) * sin(vWorld.z * 1.3 - uTime * 0.4);
    float broad = sin(vWorld.x * 0.5 + uTime * 0.23) * sin(vWorld.z * 0.4 - uTime * 0.17);
    col += vec3(0.32, 0.09, 0.0) * smoothstep(0.55, 1.0, s);
    col += vec3(0.18, 0.05, 0.0) * smoothstep(0.4, 1.0, broad);
    gl_FragColor = vec4(fogged(col, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

const STUD_VERT = /* glsl */ `
  ${SHADOW_VERT_PARS}
  attribute vec3 offset;
  attribute vec3 tint;
  attribute vec2 slit;
  varying vec3 vTint;
  varying vec2 vLit;
  varying float vShade;
  varying float vDepth;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position + offset, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    vec3 transformedNormal = normalMatrix * normal;
    ${SHADOW_VERT}
    vTint = tint;
    vLit = slit;
    vec3 L = normalize(vec3(0.35, 1.0, 0.55));
    vShade = normal.y > 0.5 ? 1.0 : 0.62 + 0.3 * max(dot(normal, L), 0.0) + 0.1 * normal.z;
    vDepth = -mvPosition.z;
  }
`;

const STUD_FRAG = /* glsl */ `
  varying vec3 vTint;
  varying vec2 vLit;
  varying float vShade;
  varying float vDepth;
  ${LIGHT_GLSL}
  ${SHADOW_FRAG}
  void main() {
    nearFade(vDepth);
    vec3 col = decode(vTint) * lightOf(vLit.x, vLit.y, sunlit()) * vShade;
    gl_FragColor = vec4(fogged(col, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

// One stud: a short cylinder with its top, but no bottom (it sits on a block).
function studShape(segments = 12) {
  const pos = [];
  const nor = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.sin(a);
    const z = Math.cos(a);
    pos.push(x * STUD_RADIUS, 0, z * STUD_RADIUS, x * STUD_RADIUS, STUD_HEIGHT, z * STUD_RADIUS);
    nor.push(x, 0, z, x, 0, z);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const centre = pos.length / 3;
  pos.push(0, STUD_HEIGHT, 0);
  nor.push(0, 1, 0);
  const ring = centre + 1;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pos.push(Math.sin(a) * STUD_RADIUS, STUD_HEIGHT, Math.cos(a) * STUD_RADIUS);
    nor.push(0, 1, 0);
  }
  for (let i = 0; i < segments; i++) idx.push(centre, ring + i, ring + i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// A model's turn about y to face the way a furniture block does (its
// `front`, numbered as RAIL_DIRS: 0 +x, 1 +z, 2 -x, 3 -z), from facing -z.
const FACING = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

export class Terrain {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.chunks = new Map();
    this.dirty = new Set();
    this.world = null;
    this.light = null;
    this.studsOn = true;

    const tex = new THREE.DataArrayTexture(atlas.data, TILE, TILE, atlas.count);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    this.texture = tex;
    // A real tree's leaves, in bigger pictures of their own (atlas.js FOLIAGE).
    const f = atlas.foliage ?? { data: new Uint8Array(4), size: 1, count: 1 };
    const leaves = new THREE.DataArrayTexture(f.data, f.size, f.size, f.count);
    leaves.format = THREE.RGBAFormat;
    leaves.type = THREE.UnsignedByteType;
    leaves.colorSpace = THREE.SRGBColorSpace;
    leaves.magFilter = THREE.LinearFilter;
    leaves.minFilter = THREE.LinearMipmapLinearFilter;
    leaves.generateMipmaps = true;
    leaves.anisotropy = 4;
    leaves.needsUpdate = true;
    this.foliageTexture = leaves;
    // Feet of real trees, by cell, as last meshed: taking one away changes
    // the shade under its crown in the chunks round it too.
    this.feet = new Set();

    this.uniforms = {
      atlas: { value: tex },
      foliage: { value: leaves },
      uDaylight: { value: 1 },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uLampColor: { value: new THREE.Color(1, 0.83, 0.58) },
      uAmbient: { value: new THREE.Color(0.1, 0.11, 0.16) },
      uFogColor: { value: new THREE.Color(0.75, 0.88, 1) },
      uFogNear: { value: 70 },
      uFogFar: { value: 150 },
      uTime: { value: 0 },
      uWaterLayer: { value: atlas.layers.get('water') ?? 0 },
      uLavaLayer: { value: atlas.layers.get('lava') ?? 0 },
      uNearFade: { value: 1 },
      // Where shadows are drawn: round this point, out to this far.
      uShadowFocus: { value: new THREE.Vector3() },
      uShadowReach: { value: 12 },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    };
    const make = (vertexShader, fragmentShader, extra = {}) =>
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, ...extra });
    // Lit by three's lights too: the sun, for its shadows.
    const sunny = { lights: true };
    this.materials = {
      opaque: make(SOLID_VERT, SOLID_FRAG, sunny),
      plants: make(SOLID_VERT, SOLID_FRAG, { ...sunny, defines: { CUTOUT: 1, SWAY: 1 }, side: THREE.DoubleSide }),
      foliage: make(SOLID_VERT, SOLID_FRAG, { ...sunny, defines: { CUTOUT: 1, SWAY: 1, FOLIAGE: 1 }, side: THREE.DoubleSide }),
      items: make(ITEM_VERT, ITEM_FRAG, { side: THREE.DoubleSide }),
      water: make(WATER_VERT, WATER_FRAG, { transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      lava: make(LAVA_VERT, LAVA_FRAG),
      glass: make(SOLID_VERT, SOLID_FRAG, { ...sunny, defines: { GLASS: 1 }, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      studs: make(STUD_VERT, STUD_FRAG, sunny),
    };
    this.studGeometry = studShape();
  }

  setWorld(world) {
    this.clear();
    this.world = world;
    this.light = new LightMap(world);
    this.light.computeAll();
    this.buildSea();
    for (let cx = 0; cx < world.chunksX; cx++) for (let cz = 0; cz < world.chunksZ; cz++) this.dirty.add(`${cx},${cz}`);
  }

  clear() {
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.dirty.clear();
    if (this.sea) {
      this.group.remove(this.sea);
      this.sea.geometry.dispose();
      this.floor.geometry.dispose();
      this.group.remove(this.floor);
      this.sea = null;
    }
  }

  // The open sea around the island, and a sandy sea bed under it, out to the horizon.
  buildSea() {
    const { W, D, sea } = this.world;
    const R = 1400;
    const y = sea + WATER_TOP - 0.02;
    const rects = [
      [-R, -R, W + R, 0],
      [-R, D, W + R, D + R],
      [-R, 0, 0, D],
      [W, 0, W + R, D],
    ];
    const build = (yy, layer, tint, sky) => {
      const pos = [];
      const uvl = [];
      const col = [];
      const lit = [];
      const idx = [];
      for (const [x0, z0, x1, z1] of rects) {
        const v = pos.length / 3;
        pos.push(x0, yy, z0, x0, yy, z1, x1, yy, z1, x1, yy, z0);
        for (const [u, w] of [
          [x0, z0],
          [x0, z1],
          [x1, z1],
          [x1, z0],
        ]) {
          uvl.push(u / 2, w / 2, layer);
          col.push(...tint);
          lit.push(sky, 0, 255, 255);
        }
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uvl', new THREE.Float32BufferAttribute(uvl, 3));
      g.setAttribute('tint', new THREE.Uint8BufferAttribute(col, 3, true));
      g.setAttribute('lit', new THREE.Uint8BufferAttribute(lit, 4, true));
      g.setIndex(idx);
      return g;
    };
    // A volcano island rises out of a sea of lava, over dark basalt depths.
    const volcano = this.world.theme === 'volcano';
    this.sea = new THREE.Mesh(
      build(y, this.atlas.layers.get(volcano ? 'lava' : 'water'), [255, 255, 255], 255),
      volcano ? this.materials.lava : this.materials.water,
    );
    this.sea.frustumCulled = false;
    this.sea.renderOrder = 2;
    this.floor = new THREE.Mesh(
      build(Math.max(1, sea - 9), this.atlas.layers.get(volcano ? 'basalt' : 'sand'), volcano ? [125, 122, 132] : [220, 205, 170], 150),
      this.materials.opaque,
    );
    this.floor.frustumCulled = false;
    this.group.add(this.sea, this.floor);
  }

  // Blocks changed: relight around them and queue the chunks that need redrawing.
  cellsChanged(cells) {
    if (!this.world || cells.length === 0) return;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < cells.length; i += 4) {
      const x = cells[i];
      const z = cells[i + 2];
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
      const cx = Math.floor(x / CHUNK);
      const cz = Math.floor(z / CHUNK);
      this.dirty.add(`${cx},${cz}`);
      // A real tree put down or taken away: its crown's shade reaches further.
      if (isTreeFoot(cells[i + 3]) || this.feet.has(`${x},${cells[i + 1]},${z}`)) {
        for (let tx = Math.floor((x - TREE_REACH) / CHUNK); tx <= Math.floor((x + TREE_REACH) / CHUNK); tx++) {
          for (let tz = Math.floor((z - TREE_REACH) / CHUNK); tz <= Math.floor((z + TREE_REACH) / CHUNK); tz++) this.dirty.add(`${tx},${tz}`);
        }
      }
      if (x % CHUNK === 0) this.dirty.add(`${cx - 1},${cz}`);
      if (x % CHUNK === CHUNK - 1) this.dirty.add(`${cx + 1},${cz}`);
      if (z % CHUNK === 0) this.dirty.add(`${cx},${cz - 1}`);
      if (z % CHUNK === CHUNK - 1) this.dirty.add(`${cx},${cz + 1}`);
    }
    const changed = this.light.relight(x0 - LIGHT_REACH, z0 - LIGHT_REACH, x1 + LIGHT_REACH, z1 + LIGHT_REACH);
    for (const key of changed) this.dirty.add(key);
  }

  // Rebuilds queued chunks, nearest first, for at most `budget` milliseconds.
  update(focus, budget = 8) {
    if (!this.world || this.dirty.size === 0) return 0;
    const start = performance.now();
    const order = [...this.dirty]
      .map((key) => {
        const [cx, cz] = key.split(',').map(Number);
        return { key, cx, cz, d: Math.hypot((cx + 0.5) * CHUNK - focus.x, (cz + 0.5) * CHUNK - focus.z) };
      })
      .sort((a, b) => a.d - b.d);
    let built = 0;
    for (const { key, cx, cz } of order) {
      if (built > 0 && performance.now() - start > budget) break;
      this.dirty.delete(key);
      if (cx < 0 || cz < 0 || cx >= this.world.chunksX || cz >= this.world.chunksZ) continue;
      this.buildChunk(cx, cz);
      built++;
    }
    return built;
  }

  buildAll() {
    while (this.dirty.size) this.update({ x: 0, z: 0 }, Infinity);
  }

  buildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const old = this.chunks.get(key);
    if (old) this.disposeChunk(old);
    const data = meshChunk(this.world, this.light, this.atlas, cx, cz);
    const group = new THREE.Group();
    group.name = `chunk ${key}`;
    const chunk = { key, cx, cz, group, studs: null, feet: data.trees.map((c) => c.join()) };
    for (const foot of chunk.feet) this.feet.add(foot);
    const H = this.world.H;
    const sphere = new THREE.Sphere(new THREE.Vector3((cx + 0.5) * CHUNK, H / 2, (cz + 0.5) * CHUNK), Math.hypot(CHUNK / 2, H / 2, CHUNK / 2) + 1);
    const add = (part, material, extra = null, order = 0) => {
      if (!part.idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(part.pos, 3));
      g.setAttribute('uvl', new THREE.BufferAttribute(part.uvl, 3));
      g.setAttribute('tint', new THREE.BufferAttribute(part.col, 3, true));
      g.setAttribute('lit', new THREE.BufferAttribute(part.lit, 4, true));
      if (extra) g.setAttribute('corner', new THREE.BufferAttribute(extra, 2));
      g.setIndex(new THREE.BufferAttribute(part.idx, 1));
      g.boundingSphere = sphere;
      const mesh = new THREE.Mesh(g, material);
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = material.lights;
      group.add(mesh);
      return mesh;
    };
    add(data.opaque, this.materials.opaque);
    add(data.plants, this.materials.plants);
    add(data.foliage, this.materials.foliage);
    add(data.items, this.materials.items, data.items.corner);
    add(data.water, this.materials.water, null, 2);
    add(data.lava, this.materials.lava, null, 2);
    add(data.glass, this.materials.glass, null, 3);
    if (data.studs.count) {
      // Each chunk gets its own copy of the (tiny) stud shape: disposing a
      // geometry frees every buffer it holds, so nothing may be shared.
      const g = new THREE.InstancedBufferGeometry();
      g.setIndex(this.studGeometry.index.clone());
      g.setAttribute('position', this.studGeometry.getAttribute('position').clone());
      g.setAttribute('normal', this.studGeometry.getAttribute('normal').clone());
      g.setAttribute('offset', new THREE.InstancedBufferAttribute(data.studs.offset, 3));
      g.setAttribute('tint', new THREE.InstancedBufferAttribute(data.studs.col, 3, true));
      g.setAttribute('slit', new THREE.InstancedBufferAttribute(data.studs.lit, 2, true));
      g.instanceCount = data.studs.count;
      g.boundingSphere = sphere;
      const mesh = new THREE.Mesh(g, this.materials.studs);
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      mesh.visible = this.studsOn;
      group.add(mesh);
      chunk.studs = mesh;
    }
    // Furniture drawn as real models (a gashapon), each turned to face the
    // way it does.
    for (const [x, y, z, id] of data.reals) {
      const model = this.realModel(BLOCKS[id].real);
      if (!model) continue;
      model.position.set(x + 0.5, y, z + 0.5);
      model.rotation.y = FACING[BLOCKS[id].front] ?? 0;
      model.updateMatrixWorld(true);
      model.matrixAutoUpdate = false;
      model.traverse((o) => (o.matrixAutoUpdate = false));
      group.add(model);
    }
    this.group.add(group);
    this.chunks.set(key, chunk);
  }

  // A real model of a piece of furniture, by what it is, in materials made
  // once for the island's light.
  realModel(kind) {
    if (kind === 'gashapon') {
      this.gashaponMaterials ??= gashaponMaterials(toyMaterial);
      return gashaponModel(this.gashaponMaterials);
    }
    if (kind === 'monster-gashapon') {
      this.monsterGashaMaterials ??= gashaponMaterials(toyMaterial, 'monster');
      return gashaponModel(this.monsterGashaMaterials, 'monster');
    }
    return null;
  }

  disposeChunk(chunk) {
    for (const foot of chunk.feet ?? []) this.feet.delete(foot);
    this.group.remove(chunk.group);
    // A real model's shapes are shared by all of them, and kept.
    for (const mesh of chunk.group.children) if (mesh.isMesh) mesh.geometry.dispose();
  }

  // Chunks lost in the fog are skipped, and studs are only worth drawing close up.
  updateVisibility(eye, fogFar) {
    const far = fogFar + CHUNK * 1.5;
    for (const chunk of this.chunks.values()) {
      const d = Math.hypot((chunk.cx + 0.5) * CHUNK - eye.x, (chunk.cz + 0.5) * CHUNK - eye.z);
      chunk.group.visible = d < far;
      if (chunk.studs) chunk.studs.visible = this.studsOn && d < STUD_DISTANCE;
    }
  }

  // shadowFocus, shadowReach: where the shadows of what moves are drawn.
  setLighting({ daylight, sun, ambient, fog, fogNear, fogFar, time, nearFade = true, shadowFocus = null, shadowReach = 12 }) {
    const u = this.uniforms;
    if (shadowFocus) u.uShadowFocus.value.copy(shadowFocus);
    u.uShadowReach.value = shadowReach;
    u.uNearFade.value = nearFade ? 1 : 0;
    u.uDaylight.value = daylight;
    u.uSunColor.value.copy(sun);
    u.uAmbient.value.copy(ambient);
    u.uFogColor.value.copy(fog);
    u.uFogNear.value = fogNear;
    u.uFogFar.value = fogFar;
    u.uTime.value = time;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    for (const m of Object.values(this.materials)) m.dispose();
    this.texture.dispose();
    this.foliageTexture.dispose();
    this.studGeometry.dispose();
  }
}
