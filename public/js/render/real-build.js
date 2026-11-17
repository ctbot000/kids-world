// What is built on the Wild Isle, or lies about on it, drawn as the real
// thing (render/real.js) from the blocks it is made of, a chunk at a time:
// walls of stone in courses, whitewash, planks, crates and glass as solid
// shapes (faces between two of them left out, a picture running on across
// them as one wall, shaded into their corners); a post of wood as a log
// standing up, sharpened at its top (a camp's palisade); logs lying in a
// pile; a boulder as a rock; a bramble as a thicket of thorny stems; a lamp
// as a lantern; a hay bale as a round bale.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { CHUNK } from '../shared/world.js';
import { noise3 } from './real-ground.js';
import { layerTextures, leafTexture, NEAR_FADE_GLSL, wind } from './real-plants.js';
import { lighthouseModel } from './real-models.js';
import { LEAF, MAT } from './real-textures.js';

// How each block is drawn: 'box' (with its material), or a shape of its own.
const LOOK = new Map([
  [B.BRICK_WALL, { box: 'masonry' }],
  [B.PLANKS, { box: 'planks' }],
  [B.CRATE, { box: 'crate' }],
  [B.GLASS, { box: 'glass' }],
  [B.WOOD, { post: true }],
  [B.LOGS, { logs: true }],
  [B.BOULDER, { rock: true }],
  [B.BRAMBLE, { thorns: true }],
  [B.LAMP, { lantern: true }],
  [B.HAY, { bale: true }],
  [B.MASS, { hidden: true }],
  [B.LIGHTHOUSE, { landmark: 'lighthouse' }],
]);
for (const id of B.TOY_BRICKS) LOOK.set(id, { box: 'paint' });
// Box materials: their picture (a layer of the material arrays), how many
// blocks one copy of it covers, and roughness.
const BOXES = {
  masonry: { layer: MAT.masonry, scale: 2.4 },
  planks: { layer: MAT.planks, scale: 2 },
  crate: { layer: MAT.planks, scale: 1, tint: 0.85 },
  paint: { layer: MAT.plaster, scale: 2.6 },
  glass: { layer: MAT.plaster, scale: 1 },
};

// What a block is to the shading of its neighbours' corners: solid.
const isBox = (id) => LOOK.get(id)?.box !== undefined;
const hidesFace = (here, there) => {
  const l = LOOK.get(there);
  if (!l?.box) return false;
  if (l.box === 'glass') return LOOK.get(here)?.box === 'glass';
  return true;
};

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

class Buf {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  v(x, y, z, nx, ny, nz, u, w, r = 1, g = r, b = r) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, w);
    this.col.push(r, g, b);
    return this.pos.length / 3 - 1;
  }

  geometry() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function hash(x, y, z, s = 0) {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ z * 83492791 ^ s * 2654435761, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// A cylinder along axis from a to b (radius r), sides round it, into buf:
// bark wrapped round it, its picture running along it from where it starts
// in the world (v0), so logs end to end join up. cap: close its ends with
// the log's cut face (lighter). point: its end at b comes to a point.
function cylinder(buf, a, b, r, sides, { v0 = 0, caps = true, point = 0, shade = 1 } = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  const ax = [d[0] / L, d[1] / L, d[2] / L];
  const helper = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(ax, helper));
  const w = cross(ax, u);
  const ring = (p, rr, v) => {
    const out = [];
    for (let s = 0; s <= sides; s++) {
      const t = (s / sides) * Math.PI * 2;
      const n = [u[0] * Math.cos(t) + w[0] * Math.sin(t), u[1] * Math.cos(t) + w[1] * Math.sin(t), u[2] * Math.cos(t) + w[2] * Math.sin(t)];
      out.push(buf.v(p[0] + n[0] * rr, p[1] + n[1] * rr, p[2] + n[2] * rr, n[0], n[1], n[2], (s / sides) * Math.max(1, Math.round((r * 6.283) / 1.1)), v, shade));
    }
    return out;
  };
  const end = point ? [b[0] - ax[0] * point, b[1] - ax[1] * point, b[2] - ax[2] * point] : b;
  const r0 = ring(a, r, v0);
  const r1 = ring(end, r, v0 + (L - point) / 1.4);
  for (let s = 0; s < sides; s++) buf.idx.push(r0[s], r0[s + 1], r1[s], r0[s + 1], r1[s + 1], r1[s]);
  if (point) {
    const tip = buf.v(b[0], b[1], b[2], ax[0], ax[1], ax[2], 0.5, v0 + L / 1.4, shade);
    for (let s = 0; s < sides; s++) buf.idx.push(r1[s], r1[s + 1], tip);
  }
  if (caps) {
    for (const [p, rr, sign] of [[a, r0, -1], ...(point ? [] : [[end, r1, 1]])]) {
      const c = buf.v(p[0], p[1], p[2], ax[0] * sign, ax[1] * sign, ax[2] * sign, 0.5, 0.5, shade * 1.35);
      const cap = [];
      for (let s = 0; s <= sides; s++) {
        const t = (s / sides) * Math.PI * 2;
        const q = [p[0] + (u[0] * Math.cos(t) + w[0] * Math.sin(t)) * r * 0.97, p[1] + (u[1] * Math.cos(t) + w[1] * Math.sin(t)) * r * 0.97, p[2] + (u[2] * Math.cos(t) + w[2] * Math.sin(t)) * r * 0.97];
        cap.push(buf.v(q[0], q[1], q[2], ax[0] * sign, ax[1] * sign, ax[2] * sign, 0.5 + Math.cos(t) * 0.5, 0.5 + Math.sin(t) * 0.5, shade * 1.35));
      }
      for (let s = 0; s < sides; s++) {
        if (sign > 0) buf.idx.push(c, cap[s], cap[s + 1]);
        else buf.idx.push(c, cap[s + 1], cap[s]);
      }
    }
  }
}
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// A few rocks to pick from: lumps of stone, a rounded heap pushed about by
// noise, each its own.
function rockShapes() {
  const out = [];
  for (let k = 0; k < 5; k++) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.getAttribute('position');
    const sx = 1 + hash(k, 1, 2) * 0.35;
    const sy = 0.62 + hash(k, 3, 4) * 0.3;
    const sz = 0.85 + hash(k, 5, 6) * 0.3;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const n = 1 + noise3(x * 1.6 + k * 5, y * 1.6, z * 1.6) * 0.22 + noise3(x * 4 + k, y * 4, z * 4) * 0.06;
      // Flattened underneath, where it sits.
      y = y < -0.3 ? -0.3 + (y + 0.3) * 0.25 : y;
      p.setXYZ(i, x * n * sx, y * n * sy, z * n * sz);
    }
    g.computeVertexNormals();
    out.push(g);
  }
  return out;
}

// The rocks' and the bramble's materials, shared by every chunk.
function triplanar(material, scale) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTri;\nvarying vec3 vTriN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vTri = (modelMatrix * wp).xyz;
          vec3 nn = normal;
          #ifdef USE_INSTANCING
            nn = mat3(instanceMatrix) * nn;
          #endif
          vTriN = normalize(mat3(modelMatrix) * nn);
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTri;
        varying vec3 vTriN;
        vec4 tri(sampler2D t) {
          vec3 w = pow(abs(vTriN), vec3(4.0));
          w /= w.x + w.y + w.z;
          vec3 p = vTri / ${scale.toFixed(2)};
          return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
        }`,
      )
      .replace('#include <map_fragment>', 'diffuseColor *= tri(map);')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * tri(roughnessMap).g;');
  };
  material.customProgramCacheKey = () => `tri-${scale}`;
  return material;
}

function nearFading(material) {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, gl) => {
    before?.call(material, shader, gl);
    shader.uniforms.uNearFade = wind.uNearFade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NEAR_FADE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nnearFade(length(vViewPosition), 0.9, 2.6);');
  };
  material.customProgramCacheKey = () => `near-${material.type}-${material.alphaTest}-${Boolean(material.map)}`;
}

export class RealBuild {
  constructor(gl, world) {
    this.world = world;
    this.gl = gl;
    this.group = new THREE.Group();
    this.group.name = 'real build';
    this.chunks = new Map();
    const mat = (box) => {
      const def = BOXES[box];
      const t = layerTextures(gl, def.layer);
      if (box === 'glass') return new THREE.MeshStandardMaterial({ color: 0xbfd8e8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
      const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, vertexColors: true, roughness: 1, metalness: 0 });
      return m;
    };
    this.materials = Object.fromEntries(Object.keys(BOXES).map((k) => [k, mat(k)]));
    const bark = layerTextures(gl, MAT.bark);
    this.materials.bark = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughnessMap: bark.roughnessMap, vertexColors: true, roughness: 1 });
    const hay = layerTextures(gl, MAT.hay);
    this.materials.hay = new THREE.MeshStandardMaterial({ map: hay.map, normalMap: hay.normalMap, roughnessMap: hay.roughnessMap, vertexColors: true, roughness: 1 });
    const rock = layerTextures(gl, MAT.rock);
    this.materials.rock = triplanar(new THREE.MeshStandardMaterial({ map: rock.map, normalMap: null, roughnessMap: rock.roughnessMap, roughness: 1 }), 2.2);
    const thorn = leafTexture(LEAF.bramble);
    this.materials.thorns = new THREE.MeshStandardMaterial({ map: thorn, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true });
    this.thornDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: thorn, alphaTest: 0.45, side: THREE.DoubleSide });
    this.materials.iron = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.55, metalness: 0.7 });
    this.materials.flame = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa040, emissiveIntensity: 0.4, roughness: 0.3, transparent: true, opacity: 0.85 });
    this.rocks = rockShapes();
    // What is right in front of the camera dissolves, as leaves do.
    for (const [k, m] of Object.entries(this.materials)) if (k !== 'glass' && k !== 'flame' && k !== 'rock') nearFading(m);
  }

  // The lanterns glow brighter at night.
  setNight(night) {
    this.materials.flame.emissiveIntensity = 0.35 + night * 2.6;
  }

  build(cx, cz) {
    const key = `${cx},${cz}`;
    this.drop(key);
    const { world } = this;
    const group = new THREE.Group();
    const boxes = Object.fromEntries(Object.keys(BOXES).map((k) => [k, new Buf()]));
    const logs = new Buf();
    const hay = new Buf();
    const thorns = new Buf();
    const iron = new Buf();
    const flame = new Buf();
    const rocks = [];
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;
    for (let x = x0; x < Math.min(world.W, x0 + CHUNK); x++) {
      for (let z = z0; z < Math.min(world.D, z0 + CHUNK); z++) {
        for (let y = 1; y < world.H; y++) {
          const id = world.get(x, y, z);
          if (id === B.AIR) continue;
          const look = LOOK.get(id);
          if (!look) {
            // Anything else solid and not ground: a box of plaster in its colour.
            if (!B.SOLID[id] || B.TERRAIN[id] || B.KIND[id] === B.K_TREE || B.KIND[id] === B.K_FURNITURE) continue;
          }
          if (!look || look.box) {
            const box = look?.box ?? 'paint';
            const tint = B.BLOCKS[id].color ?? '#ffffff';
            this.box(boxes[box], world, x, y, z, id, BOXES[box], box === 'paint' ? tint : null);
          } else if (look.post) {
            this.post(logs, world, x, y, z);
          } else if (look.logs) {
            this.logs(logs, world, x, y, z);
          } else if (look.rock) {
            rocks.push([x, y, z]);
          } else if (look.thorns) {
            this.thorns(thorns, x, y, z);
          } else if (look.lantern) {
            this.lantern(iron, flame, world, x, y, z);
          } else if (look.bale) {
            this.bale(hay, x, y, z);
          } else if (look.landmark === 'lighthouse') {
            const model = lighthouseModel(this.gl);
            model.position.set(x + 0.5, y, z + 0.5);
            model.rotation.y = hash(x, y, z, 1) * Math.PI * 2;
            group.add(model);
          }
        }
      }
    }
    const add = (buf, material, shadow = true, depth = null) => {
      const g = buf.geometry();
      if (!g) return;
      const m = new THREE.Mesh(g, material);
      m.castShadow = shadow;
      m.receiveShadow = true;
      if (depth) m.customDepthMaterial = depth;
      m.matrixAutoUpdate = false;
      group.add(m);
    };
    for (const k of Object.keys(BOXES)) add(boxes[k], this.materials[k], k !== 'glass');
    add(logs, this.materials.bark);
    add(hay, this.materials.hay);
    add(thorns, this.materials.thorns, true, this.thornDepth);
    add(iron, this.materials.iron);
    add(flame, this.materials.flame, false);
    if (rocks.length) {
      const byShape = new Map();
      for (const r of rocks) {
        const k = Math.floor(hash(...r, 9) * this.rocks.length);
        if (!byShape.has(k)) byShape.set(k, []);
        byShape.get(k).push(r);
      }
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      for (const [k, list] of byShape) {
        const mesh = new THREE.InstancedMesh(this.rocks[k], this.materials.rock, list.length);
        list.forEach(([x, y, z], i) => {
          const below = B.SOLID[world.get(x, y - 1, z)] && world.get(x, y - 1, z) === B.BOULDER;
          const s = 0.62 + hash(x, y, z, 1) * 0.22;
          e.set((hash(x, y, z, 2) - 0.5) * 0.4, hash(x, y, z, 3) * Math.PI * 2, (hash(x, y, z, 4) - 0.5) * 0.4);
          q.setFromEuler(e);
          m4.compose(new THREE.Vector3(x + 0.5 + (hash(x, y, z, 5) - 0.5) * 0.2, y + (below ? 0.25 : 0.22), z + 0.5 + (hash(x, y, z, 6) - 0.5) * 0.2), q, new THREE.Vector3(s * 1.05, s, s * 1.05));
          mesh.setMatrixAt(i, m4);
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
    }
    group.name = `real chunk ${key}`;
    this.chunks.set(key, group);
    this.group.add(group);
  }

  // A block's faces that show, its picture in world units, each corner
  // darker the more solid there is round it.
  box(buf, world, x, y, z, id, def, tint) {
    const c = tint ? new THREE.Color(tint) : null;
    const k = (def.tint ?? 1) * (0.94 + hash(x, y, z, 7) * 0.12);
    const solid = (dx, dy, dz) => (isBox(world.get(x + dx, y + dy, z + dz)) ? 1 : 0);
    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      const there = world.get(x + nx, y + ny, z + nz);
      if (hidesFace(id, there)) continue;
      // The two directions along the face.
      const t1 = nx ? [0, 1, 0] : [1, 0, 0];
      const t2 = nz ? [0, 1, 0] : [0, 0, 1];
      const base = buf.pos.length / 3;
      for (const [cx, cy, cz] of f.c) {
        const s1 = (t1[0] ? cx : t1[1] ? cy : cz) * 2 - 1;
        const s2 = (t2[0] ? cx : t2[1] ? cy : cz) * 2 - 1;
        const a = solid(nx + t1[0] * s1, ny + t1[1] * s1, nz + t1[2] * s1);
        const b = solid(nx + t2[0] * s2, ny + t2[1] * s2, nz + t2[2] * s2);
        const d = solid(nx + t1[0] * s1 + t2[0] * s2, ny + t1[1] * s1 + t2[1] * s2, nz + t1[2] * s1 + t2[2] * s2);
        const occ = a && b ? 3 : a + b + d;
        const shade = (1 - occ * 0.14) * k;
        const px = x + cx;
        const py = y + cy;
        const pz = z + cz;
        const u = nx ? pz : px;
        const v = ny ? pz : py;
        const col = c ? [c.r * shade, c.g * shade, c.b * shade] : [shade, shade, shade];
        buf.v(px, py, pz, nx, ny, nz, u / def.scale, v / def.scale, col[0], col[1], col[2]);
      }
      buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // A post of wood standing up: a log, wandering a little off upright, its
  // top cut to a point if nothing of wood is on it.
  post(buf, world, x, y, z) {
    const above = world.get(x, y + 1, z);
    const below = world.get(x, y - 1, z);
    const ox = (hash(x, 0, z, 1) - 0.5) * 0.12;
    const oz = (hash(x, 0, z, 2) - 0.5) * 0.12;
    const r = 0.36 + hash(x, 0, z, 3) * 0.07;
    const top = above === B.WOOD || above === B.LAMP ? y + 1 : y + 1.25 + hash(x, y, z, 4) * 0.25;
    const bottom = below === B.WOOD ? y : y - 0.25;
    cylinder(buf, [x + 0.5 + ox, bottom, z + 0.5 + oz], [x + 0.5 + ox, top, z + 0.5 + oz], r, 12, { v0: y / 1.4, caps: below !== B.WOOD, point: above === B.WOOD || above === B.LAMP ? 0 : 0.35, shade: 0.9 + hash(x, 0, z, 5) * 0.2 });
  }

  // Logs lying: along whichever way the pile runs, two side by side and one
  // on them, those of the next cell along going on from these.
  logs(buf, world, x, y, z) {
    const alongX = world.get(x + 1, y, z) === B.LOGS || world.get(x - 1, y, z) === B.LOGS ? true : world.get(x, y, z + 1) === B.LOGS || world.get(x, y, z - 1) === B.LOGS ? false : hash(x, y, z, 1) < 0.5;
    const prev = alongX ? world.get(x - 1, y, z) === B.LOGS : world.get(x, y, z - 1) === B.LOGS;
    const next = alongX ? world.get(x + 1, y, z) === B.LOGS : world.get(x, y, z + 1) === B.LOGS;
    const r = 0.24;
    const at = (across, up) => (alongX ? [[x - (prev ? 0 : 0.05), y + up, z + 0.5 + across], [x + 1 + (next ? 0 : 0.08), y + up, z + 0.5 + across]] : [[x + 0.5 + across, y + up, z - (prev ? 0 : 0.05)], [x + 0.5 + across, y + up, z + 1 + (next ? 0 : 0.08)]]);
    const v0 = (alongX ? x : z) / 1.4;
    for (const [across, up] of [[-0.25, 0.24], [0.25, 0.24], [0, 0.66]]) {
      const [a, b] = at(across + (hash(x, y, z, across + 3) - 0.5) * 0.06, up);
      cylinder(buf, a, b, r * (0.9 + hash(x, y, z, up * 10) * 0.2), 8, { v0, caps: true, shade: 0.85 + hash(x, y, z, 6) * 0.2 });
    }
  }

  // A thicket: thorny stems on cards crossed every way, spilling a little
  // past the cell so a hedge of them is one hedge.
  thorns(buf, x, y, z) {
    const cards = 6;
    for (let i = 0; i < cards; i++) {
      const a = (i / cards) * Math.PI + hash(x, y, z, i) * 0.6;
      const tilt = i < 2 ? 0.5 : 0;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const w = 1.45;
      const h = 1.3;
      const cxp = x + 0.5 + (hash(x, y, z, i + 10) - 0.5) * 0.3;
      const czp = z + 0.5 + (hash(x, y, z, i + 20) - 0.5) * 0.3;
      const y0 = y - 0.1;
      const n = norm([-dz, tilt, dx]);
      const base = buf.pos.length / 3;
      const shade = 0.75 + hash(x, y, z, i + 30) * 0.3;
      for (const [s, t] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) {
        buf.v(cxp + dx * w * s - n[0] * tilt * t * 0.3, y0 + h * t, czp + dz * w * s - n[2] * tilt * t * 0.3, n[0] * 0.4, 1, n[2] * 0.4, s + 0.5, t, shade);
      }
      buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // A lantern: an iron frame round a warm glass light, a cap on top, on
  // whatever is under it.
  lantern(iron, flame, world, x, y, z) {
    const cx = x + 0.5;
    const cz = z + 0.5;
    const y0 = y + (B.SOLID[world.get(x, y - 1, z)] ? 0.02 : 0.2);
    const box = (buf, x0, y0b, z0, x1, y1, z1, shade = 1) => {
      for (const f of FACES) {
        const base = buf.pos.length / 3;
        for (const [a, b, c] of f.c) buf.v(a ? x1 : x0, b ? y1 : y0b, c ? z1 : z0, ...f.n, a, b, shade);
        buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    };
    box(iron, cx - 0.2, y0, cz - 0.2, cx + 0.2, y0 + 0.06, cz + 0.2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(iron, cx + sx * 0.17 - 0.025, y0, cz + sz * 0.17 - 0.025, cx + sx * 0.17 + 0.025, y0 + 0.5, cz + sz * 0.17 + 0.025);
    box(flame, cx - 0.15, y0 + 0.06, cz - 0.15, cx + 0.15, y0 + 0.46, cz + 0.15);
    box(iron, cx - 0.23, y0 + 0.46, cz - 0.23, cx + 0.23, y0 + 0.53, cz + 0.23);
    box(iron, cx - 0.12, y0 + 0.53, cz - 0.12, cx + 0.12, y0 + 0.62, cz + 0.12);
    box(iron, cx - 0.03, y0 + 0.62, cz - 0.03, cx + 0.03, y0 + 0.74, cz + 0.03);
  }

  // A round bale of hay lying on its side.
  bale(buf, x, y, z) {
    const alongX = hash(x, y, z, 1) < 0.5;
    const r = 0.47;
    const a = alongX ? [x + 0.04, y + r, z + 0.5] : [x + 0.5, y + r, z + 0.04];
    const b = alongX ? [x + 0.96, y + r, z + 0.5] : [x + 0.5, y + r, z + 0.96];
    cylinder(buf, a, b, r, 14, { v0: 0, caps: true, shade: 0.95 + hash(x, y, z, 2) * 0.1 });
  }

  drop(key) {
    const old = this.chunks.get(key);
    if (!old) return;
    this.group.remove(old);
    old.traverse((o) => {
      if (o.userData.dispose) o.userData.dispose();
      else if (o.isMesh && !this.rocks.includes(o.geometry) && !o.parent?.userData.dispose) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    this.chunks.delete(key);
  }

  dispose() {
    for (const key of [...this.chunks.keys()]) this.drop(key);
    for (const m of Object.values(this.materials)) m.dispose();
    this.thornDepth.dispose();
    for (const g of this.rocks) g.dispose();
  }
}
