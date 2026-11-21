// Baron Bluster's Cloud Blanket over Toon Isle (render/cartoon.js), drawn:
// over every tile of the island nobody has got to yet (shared/isle-battles.js
// Fog), fat white cartoon clouds, and under them the land itself raised up
// into a cloud bank and painted as cloud, so nothing of it shows — not its
// hills, not what grows or stands on it (each of those reads the same
// blanket, cloudFog below, and is not drawn there). As someone comes near a
// tile, its clouds puff away and the land settles down out of them, and what
// grows there pops up.
//
// The blanket is one little texture, a texel a tile: red, whether it has been
// seen; green, how far its clouds have cleared (0 to 1 over a second and a
// half once seen); blue, how high its cloud bank stands (over the highest
// ground round it, as a share of the world's height).
import * as THREE from '../../vendor/three.module.js';
import { cartoonMaterial } from './cartoon-light.js';

// How long a tile's clouds take to clear once it is seen, and how many puffs
// of cloud stand on each tile.
const CLEAR_MS = 1500;
const PUFFS = 2;

// The blanket's uniforms, for every material that reads it (the ground, the
// trees and plants, the clouds): the texture, how many blocks it spans, and
// the time (for what bobs and breathes).
export function fogUniforms() {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 40, 255]), 1, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { uFog: { value: tex }, uFogSize: { value: new THREE.Vector2(1e6, 1e6) }, uFogTop: { value: 64 }, uFogSea: { value: 20 }, uTime: { value: 0 } };
}

// GLSL for reading the blanket at a point: how far it has cleared there (1:
// clear, 0: under the clouds), and how high the cloud bank is there.
export const FOG_GLSL = /* glsl */ `
  uniform sampler2D uFog;
  uniform vec2 uFogSize;
  uniform float uFogTop;
  uniform float uFogSea;
  uniform float uTime;
  float fogClear(vec2 xz) {
    vec2 uv = xz / uFogSize;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
    return smoothstep(0.3, 0.7, texture2D(uFog, uv).g);
  }
  float fogBank(vec2 xz) {
    vec2 uv = clamp(xz / uFogSize, 0.0, 1.0);
    return uFogSea + texture2D(uFog, uv).b * (uFogTop - uFogSea);
  }
  // A cartoon pop: from nothing, overshooting a little, settling at 1.
  float fogPop(float a) {
    if (a <= 0.0) return 0.0;
    if (a >= 1.0) return 1.0;
    return 1.0 - pow(2.0, -9.0 * a) * cos(a * 9.0);
  }
`;

// Cartoon clouds drifting over Toon Isle (in place of the toy sky's clouds,
// which are blocks): fat white heaps of puffs, big ones low round the
// horizon and smaller ones high overhead, slowly blown along, round again
// when they drift too far.
export class SkyClouds {
  constructor(world, uniforms) {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const heaps = 34;
    const per = 7;
    const mesh = new THREE.InstancedMesh(geo, null, heaps * per);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let seed = (world.seed ^ 0x51ed27) >>> 0;
    const rand = () => {
      seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
      return seed / 4294967296;
    };
    let c = 0;
    for (let i = 0; i < heaps; i++) {
      const a = rand() * Math.PI * 2;
      const low = i % 2 === 0;
      const d = low ? 330 + rand() * 200 : 60 + rand() * 260;
      const x = world.W / 2 + Math.cos(a) * d;
      const z = world.D / 2 + Math.sin(a) * d;
      const y = low ? world.H + 6 + rand() * 30 : world.H + 30 + rand() * 34;
      const size = low ? 16 + rand() * 18 : 6 + rand() * 8;
      for (let k = 0; k < per; k++) {
        const r = size * (k ? 0.45 + rand() * 0.35 : 0.8);
        m.compose(new THREE.Vector3(x + (rand() - 0.5) * size * 2.2, y + (k ? rand() * size * 0.4 : size * 0.15), z + (rand() - 0.5) * size * 1.2), q, new THREE.Vector3(r * 1.2, r * 0.8, r));
        mesh.setMatrixAt(c++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.material = cartoonMaterial(
      { color: new THREE.Color('#ffffff'), emissive: new THREE.Color('#dfe8ff'), emissiveIntensity: 0.12, fog: false },
      {
        key: 'sky-clouds',
        uniforms,
        vertex: (shader) => {
          shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
            '#include <project_vertex>',
            `vec4 mvPosition = vec4(transformed, 1.0);
            mvPosition = instanceMatrix * mvPosition;
            // Blown along, and round again past the far side.
            mvPosition.x = mod(mvPosition.x + uTime * 1.2 + 550.0, 1400.0) - 550.0;
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;`,
          );
        },
      },
    );
    mesh.name = 'sky clouds';
    this.mesh = mesh;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

export class CloudBlanket {
  // world: the island; cols: its ground's columns (real-ground.js
  // groundColumns: their heights); uniforms: fogUniforms(), shared.
  constructor(world, cols, uniforms) {
    this.world = world;
    this.cols = cols;
    this.uniforms = uniforms;
    this.group = new THREE.Group();
    this.group.name = 'cloud blanket';
    this.fog = null;
    this.clearing = [];
    // The blanket's own clock, in ms, moved on by update.
    this.now = 0;
  }

  // The blanket as the game has it (isle-battles-view.js readFog), or null for
  // none (the island all clear).
  set(fog) {
    this.fog = fog;
    this.clearing = [];
    this.disposePuffs();
    const old = this.uniforms.uFog.value;
    if (!fog) {
      this.uniforms.uFog.value = fogUniforms().uFog.value;
      this.uniforms.uFogSize.value.set(1e6, 1e6);
      old.dispose();
      return;
    }
    const { world, cols } = this;
    const { w, h, tile } = fog;
    const data = new Uint8Array(w * h * 4);
    const top = world.H - 4;
    this.uniforms.uFogTop.value = top;
    this.uniforms.uFogSea.value = world.sea;
    // Each tile's cloud bank: over the highest ground round it.
    const bank = new Float32Array(w * h);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        let most = world.sea + 1;
        for (let x = (i - 1) * tile; x < (i + 2) * tile; x++) {
          for (let z = (j - 1) * tile; z < (j + 2) * tile; z++) {
            if (x < 0 || z < 0 || x >= world.W || z >= world.D) continue;
            most = Math.max(most, cols.height[x * world.D + z]);
          }
        }
        bank[i * h + j] = Math.min(top, most + 3.5);
      }
    }
    this.bank = bank;
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        const k = i * h + j;
        const o = (j * w + i) * 4;
        data[o] = fog.seen[k] ? 255 : 0;
        data[o + 1] = fog.seen[k] ? 255 : 0;
        data[o + 2] = Math.round((255 * (bank[k] - world.sea)) / (top - world.sea));
        data[o + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.uniforms.uFog.value = tex;
    this.uniforms.uFogSize.value.set(w * tile, h * tile);
    old.dispose();
    this.data = data;
    this.buildPuffs();
  }

  // Tiles newly seen: their clouds start clearing now.
  reveal(tiles, now = this.now) {
    if (!this.fog) return;
    for (const k of tiles) {
      const o = this.texel(k);
      if (o < 0) continue;
      this.data[o] = 255;
      this.clearing.push({ o, at: now });
      this.cleared = (this.cleared ?? 0) + 1;
    }
    this.uniforms.uFog.value.needsUpdate = true;
  }

  texel(k) {
    const { w, h } = this.fog;
    const i = Math.floor(k / h);
    const j = k % h;
    return i < 0 || i >= w || j < 0 || j >= h ? -1 : (j * w + i) * 4;
  }

  // Each frame: the clouds clearing go on clearing, and the time for what
  // bobs (seconds, on the island's own clock).
  update(time) {
    this.uniforms.uTime.value = time;
    this.now = time * 1000;
    const now = this.now;
    // Plenty cleared and none still clearing: their puffs dropped (each
    // puff's place is its tile's own, so the rest stay just where they were).
    if (!this.clearing.length && this.cleared >= 48 && this.fog) {
      this.cleared = 0;
      this.disposePuffs();
      this.buildPuffs();
    }
    if (!this.clearing.length) return;
    this.clearing = this.clearing.filter((c) => {
      const k = Math.min(1, (now - c.at) / CLEAR_MS);
      this.data[c.o + 1] = Math.round(255 * k);
      return k < 1;
    });
    this.uniforms.uFog.value.needsUpdate = true;
  }

  // The puffs of cloud, PUFFS to a tile, each a fat ball sunk into the cloud
  // bank: one mesh, each puff reading its tile's texel (aTile) to see how far
  // its clouds have cleared — clearing, it billows up and shrinks away.
  buildPuffs() {
    const { w, h, tile, seen } = this.fog;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    let hidden = 0;
    for (let k = 0; k < seen.length; k++) if (!seen[k]) hidden++;
    const n = Math.max(1, hidden * PUFFS);
    const mesh = new THREE.InstancedMesh(geo, this.material(), n);
    const tiles = new Float32Array(n * 3);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let c = 0;
    // (The same puffs every time for the same tile of the same island.)
    let seed = 1;
    const rand = () => {
      seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (seen[i * h + j]) continue;
        seed = (Math.imul(this.world.seed ^ 0x9e3779b9, 31) + i * 7919 + j * 104729) >>> 0;
        for (let k = 0; k < PUFFS; k++) {
          const r = 4.8 + rand() * 2.6;
          const x = (i + 0.5) * tile + (rand() - 0.5) * tile * 0.7;
          const z = (j + 0.5) * tile + (rand() - 0.5) * tile * 0.7;
          const y = this.bank[i * h + j] - r * 0.45 + rand() * 1.2;
          p.set(x, y, z);
          s.set(r * (1 + rand() * 0.25), r * (0.72 + rand() * 0.2), r * (1 + rand() * 0.25));
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
          m.compose(p, q, s);
          mesh.setMatrixAt(c, m);
          tiles[c * 3] = i;
          tiles[c * 3 + 1] = j;
          tiles[c * 3 + 2] = rand();
          c++;
        }
      }
    }
    geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 3));
    mesh.count = c;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = 'cloud puffs';
    this.puffs = mesh;
    this.group.add(mesh);
  }

  material() {
    this.mat ??= cartoonMaterial(
      { color: new THREE.Color('#f6f3ff'), emissive: new THREE.Color('#2a2440'), emissiveIntensity: 0.25 },
      {
        key: 'cloud-puffs',
        uniforms: this.uniforms,
        vertex: (shader) => {
          shader.vertexShader = `${FOG_GLSL}\nattribute vec3 aTile;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            {
              vec4 f = texture2D(uFog, (aTile.xy + 0.5) / vec2(textureSize(uFog, 0)));
              float a = f.g;
              // Clearing: it billows up and away, smaller and smaller.
              float keep = a >= 0.999 ? 0.0 : 1.0 - smoothstep(0.15, 1.0, a);
              transformed *= keep * (1.0 + 0.035 * sin(uTime * 0.7 + aTile.z * 31.0)) * (1.0 + 0.4 * a);
              transformed.y += a * 3.5;
            }`,
          );
        },
      },
    );
    return this.mat;
  }

  disposePuffs() {
    if (!this.puffs) return;
    this.group.remove(this.puffs);
    this.puffs.geometry.dispose();
    this.puffs.dispose();
    this.puffs = null;
  }

  dispose() {
    this.disposePuffs();
    this.mat?.dispose();
  }
}
