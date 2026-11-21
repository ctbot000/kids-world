// Toon Isle's grass (render/cartoon.js): a soft carpet of round-tipped
// blades over its meadows round you, dark at the foot and bright at the tip,
// swaying in the wind, with little flowers dotted about in it — white,
// yellow, pink and blue. In squares of the island, those near enough drawn,
// shrinking away into the ground's own paint at the edge of where it grows
// (cartoon-ground.js paints the meadows the same green), and none of it under
// the Cloud Blanket (cartoon-clouds.js) until it clears.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { cartoonMaterial } from './cartoon-light.js';
import { FOG_GLSL } from './cartoon-clouds.js';
import { groundPalette } from './cartoon-ground.js';

const CHUNK = 16;

// A little random number from a cell and a salt, 0 to 1.
function hash(x, z, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A clump of blades: wide, curved, round at the tip, leaning every way; its
// colour from dark at the foot to bright at the tip (times the grass's).
function clumpGeometry() {
  const pos = [];
  const nrm = [];
  const col = [];
  const idx = [];
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + hash(b, 1, 3) * 0.8;
    const lean = 0.3 + hash(b, 2, 3) * 0.4;
    const h = 0.14 + hash(b, 3, 3) * 0.12;
    const w = 0.05 + hash(b, 4, 3) * 0.025;
    const r = 0.06 + hash(b, 5, 3) * 0.08;
    const dir = [Math.cos(a), Math.sin(a)];
    const side = [-dir[1], dir[0]];
    const base = pos.length / 3;
    const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = h * t;
      const out = r + lean * h * t * t;
      // Round at the tip: the width falls away like a circle's.
      const ww = w * Math.sqrt(Math.max(0, 1 - t ** 3));
      for (const sx of [-1, 1]) {
        pos.push(dir[0] * out + side[0] * ww * sx, y, dir[1] * out + side[1] * ww * sx);
        nrm.push(dir[0] * 0.35, 1, dir[1] * 0.35);
        const k = 0.62 + 0.5 * t;
        col.push(k, k, k * 0.92);
      }
    }
    for (let s = 0; s < segs; s++) {
      const q = base + s * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// A little flower: five round petals round a yellow middle, on a short stem
// (the petals white, so each copy's colour shows; the middle and the stem
// keep theirs, coloured below nothing in the geometry: see the material).
function flowerGeometry() {
  const parts = [];
  const petal = new THREE.SphereGeometry(1, 6, 3);
  const m = new THREE.Matrix4();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    m.compose(new THREE.Vector3(Math.cos(a) * 0.055, 0.3, Math.sin(a) * 0.055), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0.2, 'YXZ')), new THREE.Vector3(0.05, 0.02, 0.036));
    parts.push([petal, m.clone(), [1, 1, 1]]);
  }
  m.compose(new THREE.Vector3(0, 0.315, 0), new THREE.Quaternion(), new THREE.Vector3(0.03, 0.022, 0.03));
  parts.push([petal, m.clone(), [-1, -0.82, -0.15]]);
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.3, 5, 1).translate(0, 0.15, 0);
  parts.push([stem, new THREE.Matrix4(), [-0.27, -0.69, -0.3]]);
  const pos = [];
  const nrm = [];
  const col = [];
  const idx = [];
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const [g, mm, c] of parts) {
    const base = pos.length / 3;
    nm.getNormalMatrix(mm);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mm);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nrm.push(v.x, v.y, v.z);
      col.push(...c);
    }
    for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.array[i]);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

const FLOWERS = ['#ffffff', '#ffd83a', '#ff7ac8', '#7a9bff', '#ffffff', '#ff6a6a'].map((c) => new THREE.Color(c));

// The vertex hook for both: each copy turned (offset.w), sized (look.x) and
// shrinking away at the edge of where it grows and under the clouds, swaying,
// and coloured (look.yzw; a colour below nothing in the geometry keeps its
// own, turned the right way up).
function material(fog, uniforms, key) {
  return cartoonMaterial(
    { vertexColors: true, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0.2 },
    {
      key,
      uniforms: { ...fog, ...uniforms },
      vertex: (shader) => {
        shader.vertexShader = `${FOG_GLSL}
          attribute vec4 offset;
          attribute vec4 look;
          uniform float uReach;
          uniform vec3 uCam;
          ${shader.vertexShader}`
          .replace(
            '#include <begin_vertex>',
            `vec3 transformed = vec3(position);
            float c = cos(offset.w);
            float s = sin(offset.w);
            transformed.xz = mat2(c, -s, s, c) * transformed.xz;
            float d = distance(offset.xyz, uCam);
            float fade = 1.0 - smoothstep(uReach * 0.65, uReach, d);
            float pop = fogPop(fogClear(offset.xz));
            transformed *= vec3(1.0, look.x, 1.0) * fade * pop;
            float phase = offset.x * 0.37 + offset.z * 0.29;
            float bend = transformed.y * transformed.y * 3.0;
            transformed.x += bend * 0.06 * sin(uTime * 1.9 + phase);
            transformed.z += bend * 0.05 * sin(uTime * 1.4 + phase * 1.3);
            transformed += offset.xyz;`,
          )
          .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal);')
          .replace(
            '#include <color_vertex>',
            `#include <color_vertex>
            vColor.rgb = color.r < 0.0 ? -color.rgb : vColor.rgb * look.yzw;`,
          );
      },
    },
  );
}

export class CartoonGrass {
  // ground: the skin (real-ground.js RealGround); density: clumps to a block
  // of meadow; reach: how far from the camera it grows.
  constructor(world, ground, fog, { density = 8, reach = 30 } = {}) {
    this.world = world;
    this.reach = reach;
    this.group = new THREE.Group();
    this.group.name = 'cartoon grass';
    this.uniforms = { uReach: { value: reach }, uCam: { value: new THREE.Vector3() } };
    this.grassMaterial = material(fog, this.uniforms, 'cartoon-grass');
    this.flowerMaterial = material(fog, this.uniforms, 'cartoon-flowers');
    this.clump = clumpGeometry();
    this.flower = flowerGeometry();
    this.chunks = [];
    this.build(world, ground, density);
  }

  build(world, ground, density) {
    const { W, D } = world;
    const { cols } = ground;
    const pal = groundPalette(world.theme);
    const greens = [new THREE.Color(pal.grass), new THREE.Color(pal.forest)];
    // Grass on grass, a little less on a forest's floor; never within a bit
    // of a column that is not grass (a path's wavy edge, cartoon-ground.js).
    const grassy = (x, z) => x >= 0 && z >= 0 && x < W && z < D && cols.kind[x * D + z] <= 1 && !cols.water[x * D + z];
    for (let cx = 0; cx < W; cx += CHUNK) {
      for (let cz = 0; cz < D; cz += CHUNK) {
        const lists = { grass: [[], []], flowers: [[], []] };
        for (let x = cx; x < Math.min(W, cx + CHUNK); x++) {
          for (let z = cz; z < Math.min(D, cz + CHUNK); z++) {
            if (!grassy(x, z)) continue;
            const k = x * D + z;
            const top = cols.height[k];
            const above = world.get(x, top, z);
            if (B.SOLID[above] || B.KIND[above] === B.K_TREE) continue;
            const green = greens[cols.kind[k]];
            const wood = ground.wood[k];
            const n = Math.round(density * Math.max(0.3, 1 - wood * 0.7));
            const edge = { l: !grassy(x - 1, z), r: !grassy(x + 1, z), b: !grassy(x, z - 1), f: !grassy(x, z + 1) };
            for (let i = 0; i < n + 1; i++) {
              const flower = i === n;
              if (flower && hash(x, z, 77) > 0.16) continue;
              const fx = hash(x * 7 + i, z, 21);
              const fz = hash(x, z * 7 + i, 23);
              if ((edge.l && fx < 0.32) || (edge.r && fx > 0.68) || (edge.b && fz < 0.32) || (edge.f && fz > 0.68)) continue;
              const px = x + fx;
              const pz = z + fz;
              const s = ground.surfaceIn(x, z, px, pz);
              if (s === null || Math.abs(s - top) > 0.9) continue;
              const [off, look] = flower ? lists.flowers : lists.grass;
              off.push(px, s - 0.02, pz, hash(x + i, z, 25) * Math.PI * 2);
              if (flower) {
                const c = FLOWERS[Math.floor(hash(x, z + 3, 29) * FLOWERS.length)];
                look.push(0.8 + hash(x, z, 31) * 0.5, c.r, c.g, c.b);
              } else {
                const v = 0.9 + hash(x + i, z + i, 27) * 0.2;
                look.push(0.75 + hash(x + i, z + i, 29) * 0.6, green.r * v, green.g * v, green.b * (0.9 + hash(x, z + i, 33) * 0.2));
              }
            }
          }
        }
        const meshes = [];
        for (const [name, geo, mat] of [['grass', this.clump, this.grassMaterial], ['flowers', this.flower, this.flowerMaterial]]) {
          const [off, look] = lists[name];
          if (!off.length) continue;
          // In a shuffled order, so drawing fewer of them (further off,
          // update) thins them out all over.
          const n = off.length / 4;
          for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(hash(i, cx * 31 + cz, 41) * (i + 1));
            for (const [list, w] of [[off, 4], [look, 4]]) {
              for (let k = 0; k < w; k++) [list[i * w + k], list[j * w + k]] = [list[j * w + k], list[i * w + k]];
            }
          }
          const g = new THREE.InstancedBufferGeometry();
          g.index = geo.index;
          for (const a of ['position', 'normal', 'color']) g.setAttribute(a, geo.getAttribute(a));
          g.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(off), 4));
          g.setAttribute('look', new THREE.InstancedBufferAttribute(new Float32Array(look), 4));
          g.instanceCount = off.length / 4;
          const mid = Math.min(W - 1, cx + CHUNK / 2) * D + Math.min(D - 1, cz + CHUNK / 2);
          g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx + CHUNK / 2, cols.height[mid], cz + CHUNK / 2), CHUNK * 0.75 + 12);
          const mesh = new THREE.Mesh(g, mat);
          mesh.receiveShadow = true;
          mesh.name = `cartoon ${name}`;
          mesh.userData.count = g.instanceCount;
          meshes.push(mesh);
          this.group.add(mesh);
        }
        const mid = Math.min(W - 1, cx + CHUNK / 2) * D + Math.min(D - 1, cz + CHUNK / 2);
        if (meshes.length) this.chunks.push({ meshes, x: cx + CHUNK / 2, y: cols.height[mid], z: cz + CHUNK / 2 });
      }
    }
  }

  // Only the squares near enough to the camera, those further off thinner.
  update(camera) {
    const at = camera.position;
    this.uniforms.uCam.value.copy(at);
    for (const c of this.chunks) {
      const d = Math.max(0, Math.hypot(c.x - at.x, c.y - at.y, c.z - at.z) - CHUNK * 0.6);
      const on = d < this.reach;
      const share = 1 - 0.65 * Math.max(0, Math.min(1, (d - this.reach * 0.35) / (this.reach * 0.65)));
      for (const m of c.meshes) {
        m.visible = on;
        m.geometry.instanceCount = Math.ceil(m.userData.count * share);
      }
    }
  }

  dispose() {
    for (const c of this.chunks) for (const m of c.meshes) m.geometry.dispose();
    this.clump.dispose();
    this.flower.dispose();
    this.grassMaterial.dispose();
    this.flowerMaterial.dispose();
  }
}
