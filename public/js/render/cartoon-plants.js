// What grows and lies about on Toon Isle (render/cartoon.js), drawn as a
// cartoon: round lollipop trees, pines like stacks of cones, palms with
// drooping fronds, white birches, bare snags, giant red toadstools with white
// spots and cacti with their arms up — each from its foot in the island's
// blocks (blocks.js WILD_TREES, TOON_TREES), as big as its trunk is tall —
// and bushes, ferns, reeds, tufts of grass, flowers and mushrooms, boulders,
// logs, and the thorns of an ambush's ring. Everything of a kind is one
// instanced mesh, painted in the cel tones (cel.js); the trees sway a
// little, and whatever is still under the Cloud Blanket (cartoon-clouds.js)
// is not drawn — clearing, it pops up.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { celMaterial } from './cel.js';
import { FOG_GLSL } from './cartoon-clouds.js';

const C = (hex) => new THREE.Color(hex);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- shapes

// Parts into one shape: each { g: a geometry, m: where it goes (a matrix),
// color, sway (how much it sways in the wind: 0 at the foot, 1 at the top of
// a crown) }. Gives position, normal, color and sway.
function paint(parts) {
  let count = 0;
  let indices = 0;
  for (const { g } of parts) {
    count += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sway = new Float32Array(count);
  const idx = new Uint32Array(indices);
  const v3 = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let v = 0;
  let t = 0;
  for (const { g, m, color, sway: s = 0 } of parts) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v3.fromBufferAttribute(p, i).applyMatrix4(m).toArray(pos, (v + i) * 3);
      v3.fromBufferAttribute(n, i).applyMatrix3(nm).normalize().toArray(nor, (v + i) * 3);
      color.toArray(col, (v + i) * 3);
      sway[v + i] = typeof s === 'function' ? s(pos[(v + i) * 3 + 1]) : s;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[t + i] = g.index.array[i] + v;
    else for (let i = 0; i < p.count; i++) idx[t + i] = v + i;
    t += g.index ? g.index.count : p.count;
    v += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

const M = (x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
const ball = (detail = 2) => new THREE.IcosahedronGeometry(1, detail);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s, 1).translate(0, h / 2, 0);
const cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s, 1).translate(0, h / 2, 0);

// A tree's sway: none up its trunk, more and more up its crown.
const crownSway = (from, to) => (y) => Math.max(0, Math.min(1, (y - from) / Math.max(0.1, to - from)));

// Each species, built for a trunk of `std` blocks over its foot (drawn
// bigger or smaller for taller or shorter ones), in its colours by the
// corner of the island (theme).
function treeShape(model, theme) {
  const bark = C('#8a5a3c');
  switch (model) {
    case 'oak': {
      // A lollipop tree: a round crown of balls on a slim trunk.
      const leaf = C(theme === 'toonstorm' ? '#4f9e6a' : theme === 'toonwood' ? '#46c25a' : '#59d24a');
      const leaf2 = leaf.clone().multiplyScalar(0.86);
      const s = crownSway(2.2, 5.5);
      return {
        std: 3,
        geo: paint([
          { g: cyl(0.2, 0.3, 3, 9), m: M(0, 0, 0), color: bark },
          { g: ball(), m: M(0, 4.1, 0, 1.75, 1.6, 1.75), color: leaf, sway: s },
          { g: ball(), m: M(1.15, 3.4, 0.4, 1.12), color: leaf2, sway: s },
          { g: ball(), m: M(-1.0, 3.5, -0.55, 1.05), color: leaf2, sway: s },
          { g: ball(), m: M(-0.25, 3.3, 1.15, 1.0), color: leaf, sway: s },
        ]),
      };
    }
    case 'pine': {
      const needle = C(theme === 'toonpeak' ? '#2f9a6a' : '#2f9e55');
      const snow = C('#ffffff');
      const s = crownSway(1, 6);
      const parts = [
        { g: cyl(0.16, 0.24, 1.6, 8), m: M(0, 0, 0), color: bark },
        { g: cone(1.85, 2.2), m: M(0, 1.2, 0), color: needle, sway: s },
        { g: cone(1.45, 2.0), m: M(0, 2.5, 0), color: needle, sway: s },
        { g: cone(0.95, 1.8), m: M(0, 3.7, 0), color: needle, sway: s },
      ];
      if (theme === 'toonpeak') parts.push({ g: cone(0.55, 0.9), m: M(0, 4.65, 0), color: snow, sway: s }, { g: cone(1.0, 0.6), m: M(0, 3.05, 0), color: snow, sway: s });
      return { std: 4, geo: paint(parts) };
    }
    case 'palm': {
      const trunk = [C('#b9824e'), C('#a06c3e')];
      const frond = C('#46c35a');
      const parts = [];
      let x = 0;
      let y = 0;
      for (let i = 0; i < 7; i++) {
        const lean = 0.06 + i * 0.035;
        parts.push({ g: cyl(0.2 - i * 0.012, 0.24 - i * 0.012, 0.75, 9), m: M(x, y, 0, 1, 1, 1, 0, 0, -lean), color: trunk[i % 2], sway: i / 10 });
        x += Math.sin(lean) * 0.75;
        y += Math.cos(lean) * 0.72;
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        parts.push({ g: ball(1), m: M(x + Math.cos(a) * 1.0, y - 0.25, Math.sin(a) * 1.0, 1.25, 0.16, 0.42, 0, -a, -0.45), color: frond, sway: 1 });
      }
      for (let k = 0; k < 3; k++) parts.push({ g: ball(1), m: M(x + Math.cos(k * 2.1) * 0.3, y - 0.35, Math.sin(k * 2.1) * 0.3, 0.2), color: C('#6b4a2a'), sway: 0.8 });
      return { std: 4, geo: paint(parts) };
    }
    case 'birch': {
      const white = C('#f4f1e6');
      const black = C('#3a3530');
      const leaf = C('#b5e255');
      const s = crownSway(2.5, 6);
      const parts = [{ g: cyl(0.17, 0.22, 3.2, 9), m: M(0, 0, 0), color: white }];
      for (const yy of [0.6, 1.3, 2.1, 2.7]) parts.push({ g: cyl(0.225, 0.225, 0.1, 9), m: M(0, yy, 0), color: black });
      parts.push({ g: ball(), m: M(0, 4.1, 0, 1.3, 2.0, 1.3), color: leaf, sway: s }, { g: ball(), m: M(0.6, 3.5, 0.3, 0.8), color: leaf, sway: s });
      return { std: 3, geo: paint(parts) };
    }
    case 'snag': {
      const dead = C(theme === 'toonstorm' ? '#6d5f6e' : '#8a7362');
      return {
        std: 3,
        geo: paint([
          { g: cyl(0.16, 0.3, 2.4, 8), m: M(0, 0, 0, 1, 1, 1, 0, 0, 0.08), color: dead },
          { g: cyl(0.08, 0.14, 1.6, 7), m: M(-0.1, 2.2, 0, 1, 1, 1, 0, 0.4, 0.5), color: dead, sway: 0.3 },
          { g: cyl(0.07, 0.12, 1.4, 7), m: M(0.05, 1.6, 0, 1, 1, 1, 0, 2.2, -0.6), color: dead, sway: 0.3 },
          { g: cyl(0.06, 0.1, 1.1, 7), m: M(0.2, 2.4, 0.1, 1, 1, 1, 0, -1.2, -0.3), color: dead, sway: 0.4 },
        ]),
      };
    }
    case 'toadstool': {
      // A giant toadstool: a fat cream stem, a red cap with white spots.
      const stem = C('#f6efdc');
      const cap = C(theme === 'toonwood' ? '#ff4d4d' : '#ff5a5a');
      const dots = C('#ffffff');
      const gills = C('#f0d2b0');
      const capGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const parts = [
        { g: cyl(0.5, 0.62, 2.6, 12), m: M(0, 0, 0), color: stem },
        { g: new THREE.CircleGeometry(1.95, 20).rotateX(Math.PI / 2), m: M(0, 2.55, 0), color: gills },
        { g: capGeo, m: M(0, 2.5, 0, 2.0, 1.35, 2.0), color: cap, sway: 0.15 },
      ];
      for (let k = 0; k < 7; k++) {
        const a = k * 2.4;
        const up = k === 0 ? 0 : 0.55 + (k % 3) * 0.18;
        const r = Math.sin(up) * 2.0;
        const y = 2.5 + Math.cos(up) * 1.35;
        parts.push({ g: ball(1), m: M(Math.cos(a) * r, y, Math.sin(a) * r, 0.34, 0.12, 0.34, 0, -a, up), color: dots, sway: 0.15 });
      }
      return { std: 3, geo: paint(parts) };
    }
    case 'cactus': {
      const green = C('#4cbf5a');
      const light = C('#7ddb74');
      const flower = C('#ff7ab6');
      return {
        std: 3,
        geo: paint([
          { g: new THREE.CapsuleGeometry(0.46, 2.6, 4, 10), m: M(0, 1.75, 0), color: green },
          { g: new THREE.CapsuleGeometry(0.3, 0.7, 4, 8), m: M(0.62, 1.5, 0, 1, 1, 1, 0, 0, Math.PI / 2), color: green },
          { g: new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), m: M(0.98, 2.05, 0), color: light },
          { g: new THREE.CapsuleGeometry(0.27, 0.6, 4, 8), m: M(-0.55, 2.2, 0, 1, 1, 1, 0, 0, Math.PI / 2), color: green },
          { g: new THREE.CapsuleGeometry(0.27, 0.6, 4, 8), m: M(-0.82, 2.65, 0), color: light },
          { g: ball(1), m: M(0, 3.55, 0, 0.3, 0.18, 0.3), color: flower },
        ]),
      };
    }
    default:
      return treeShape('oak', theme);
  }
}

// What a tree foot of the island's blocks is: its species.
const SPECIES = new Map([
  [B.WILD_OAK, 'oak'],
  [B.WILD_PINE, 'pine'],
  [B.WILD_PALM, 'palm'],
  [B.WILD_BIRCH, 'birch'],
  [B.WILD_SNAG, 'snag'],
  [B.TOON_SHROOM, 'toadstool'],
  [B.TOON_CACTUS, 'cactus'],
]);

// The little things, by block: each its shape, and how much it sways.
const FLOWER_COLORS = new Map([
  [B.TULIP, '#ff5a7a'],
  [B.DAISY, '#ffffff'],
  [B.SUNFLOWER, '#ffd23f'],
  [B.COSMOS, '#ff8ad8'],
  [B.BLUEBELL, '#6c8cff'],
]);

function smallShape(id) {
  if (id === B.BUSH) {
    const g = C('#4bbf4f');
    return paint([
      { g: ball(1), m: M(0, 0.45, 0, 0.62), color: g, sway: 0.3 },
      { g: ball(1), m: M(0.38, 0.35, 0.18, 0.45), color: g.clone().multiplyScalar(0.88), sway: 0.3 },
      { g: ball(1), m: M(-0.3, 0.36, -0.22, 0.46), color: g, sway: 0.3 },
    ]);
  }
  if (id === B.FERN) {
    const g = C('#3fae5a');
    const parts = [];
    for (let k = 0; k < 6; k++) parts.push({ g: ball(1), m: M(Math.cos(k) * 0.32, 0.32, Math.sin(k) * 0.32, 0.55, 0.08, 0.16, 0, -k, -0.6), color: g, sway: 0.6 });
    return paint(parts);
  }
  if (id === B.REEDS) {
    const g = C('#7cbf4a');
    const top = C('#8a5a3c');
    const parts = [];
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7;
      parts.push({ g: cyl(0.035, 0.05, 1.5, 5), m: M(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22, 1, 1, 1, 0.1, a, 0), color: g, sway: (y) => y / 1.6 });
      parts.push({ g: new THREE.CapsuleGeometry(0.07, 0.25, 2, 6), m: M(Math.cos(a) * 0.24, 1.55, Math.sin(a) * 0.24), color: top, sway: 1 });
    }
    return paint(parts);
  }
  if (id === B.TALL_GRASS) {
    const g = C('#6fd257');
    return paint([
      { g: cone(0.09, 0.62, 5), m: M(0, 0, 0, 1, 1, 1, 0.15, 0, 0.1), color: g, sway: (y) => y / 0.6 },
      { g: cone(0.08, 0.5, 5), m: M(0.16, 0, 0.06, 1, 1, 1, -0.1, 0, -0.25), color: g, sway: (y) => y / 0.6 },
      { g: cone(0.08, 0.55, 5), m: M(-0.12, 0, -0.1, 1, 1, 1, 0.2, 0, 0.2), color: g.clone().multiplyScalar(0.9), sway: (y) => y / 0.6 },
    ]);
  }
  if (id === B.MUSHROOM) {
    return paint([
      { g: cyl(0.07, 0.09, 0.3, 6), m: M(0, 0, 0), color: C('#f6efdc') },
      { g: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m: M(0, 0.28, 0, 0.22, 0.16, 0.22), color: C('#ff4d4d') },
    ]);
  }
  if (FLOWER_COLORS.has(id)) {
    const head = C(FLOWER_COLORS.get(id));
    return paint([
      { g: cyl(0.03, 0.04, 0.5, 5), m: M(0, 0, 0), color: C('#4caf50'), sway: (y) => y / 0.5 },
      { g: ball(1), m: M(0, 0.55, 0, 0.17, 0.12, 0.17), color: head, sway: 1 },
      { g: ball(0), m: M(0, 0.6, 0, 0.07), color: C(id === B.SUNFLOWER ? '#7a4a1e' : '#ffd23f'), sway: 1 },
    ]);
  }
  if (id === B.BOULDER) {
    const g = ball(1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 + 0.12 * Math.sin(x * 4.1 + z * 2.3) + 0.08 * Math.sin(y * 5.3 - x * 1.7);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return paint([{ g, m: M(0, 0.42, 0, 0.62, 0.5, 0.62), color: C('#b6aec6') }]);
  }
  if (id === B.LOGS) {
    const wood = C('#9a6a42');
    const end = C('#e8c58e');
    return paint([
      { g: new THREE.CylinderGeometry(0.28, 0.28, 0.95, 10), m: M(0, 0.28, -0.22, 1, 1, 1, 0, 0, Math.PI / 2), color: wood },
      { g: new THREE.CylinderGeometry(0.29, 0.29, 0.02, 10), m: M(0.48, 0.28, -0.22, 1, 1, 1, 0, 0, Math.PI / 2), color: end },
      { g: new THREE.CylinderGeometry(0.26, 0.26, 0.95, 10), m: M(0, 0.26, 0.26, 1, 1, 1, 0, 0, Math.PI / 2), color: wood },
      { g: new THREE.CylinderGeometry(0.25, 0.25, 0.95, 10), m: M(0, 0.7, 0.02, 1, 1, 1, 0, 0.4, Math.PI / 2), color: wood.clone().multiplyScalar(0.9) },
    ]);
  }
  if (id === B.BRAMBLE) {
    // A thorny hedge: a big dark-green ball, thorns all over it.
    const vine = C('#2f8a45');
    const thorn = C('#e2c96a');
    const parts = [{ g: ball(1), m: M(0, 0.5, 0, 0.62, 0.6, 0.62), color: vine }];
    for (let k = 0; k < 8; k++) {
      const a = k * 0.785;
      const up = k % 2 ? 0.5 : 1.2;
      parts.push({ g: cone(0.08, 0.32, 5), m: M(Math.cos(a) * Math.sin(up) * 0.55, 0.5 + Math.cos(up) * 0.55, Math.sin(a) * Math.sin(up) * 0.55, 1, 1, 1, 0, -a, up), color: thorn });
    }
    return paint(parts);
  }
  return null;
}

// ---------------------------------------------------------------- the material

// The one material for all of it: vertex colours in the cel tones, swaying
// by `sway`, each instance popping up out of the Cloud Blanket as it clears
// (cartoon-clouds.js), and not drawn under it. (And the same shape in the
// sun's shadow map, so nothing under the blanket casts a shadow.)
const VERTEX_HOOK = (shader) => {
  shader.vertexShader = `${FOG_GLSL}\nattribute float sway;\n${shader.vertexShader}`.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
      vec3 at = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float pop = fogPop(fogClear(at.xz));
      float phase = at.x * 0.37 + at.z * 0.29;
      transformed.x += sway * 0.07 * sin(uTime * 1.7 + phase);
      transformed.z += sway * 0.05 * sin(uTime * 1.3 + phase * 1.3);
      transformed *= pop;
    }`,
  );
};

function plantMaterial(fog) {
  return celMaterial({ vertexColors: true }, { key: 'cartoon-plants', uniforms: fog, vertex: VERTEX_HOOK });
}

function plantDepth(fog) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fog);
    VERTEX_HOOK(shader);
  };
  m.customProgramCacheKey = () => 'cartoon-plants-depth';
  return m;
}

// ---------------------------------------------------------------- all of it

export class CartoonPlants {
  // ground: the skin (real-ground.js RealGround), for standing each on it;
  // fog: the Cloud Blanket's uniforms (cartoon-clouds.js fogUniforms).
  constructor(world, ground, fog) {
    this.world = world;
    this.ground = ground;
    this.fog = fog;
    this.theme = world.theme;
    this.group = new THREE.Group();
    this.group.name = 'cartoon plants';
    this.material = plantMaterial(fog);
    this.depth = plantDepth(fog);
    this.shapes = new Map();
    this.meshes = new Map();
    // Every cell with something of these in it: its kind, by cell.
    this.cells = new Map();
    const { W, D, H } = world;
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const base = (x * D + z) * H;
        for (let y = 1; y < H; y++) {
          const id = world.blocks[base + y];
          if (id && this.kindOf(id)) this.cells.set(base + y, id);
        }
      }
    }
    this.rebuild();
  }

  // What a block is drawn as here: a tree's species, a small thing's block,
  // or nothing.
  kindOf(id) {
    if (SPECIES.has(id)) return `tree:${SPECIES.get(id)}`;
    if (id === B.BUSH || id === B.FERN || id === B.REEDS || id === B.TALL_GRASS || id === B.MUSHROOM || id === B.BOULDER || id === B.LOGS || id === B.BRAMBLE || FLOWER_COLORS.has(id)) return `small:${id}`;
    return null;
  }

  shapeOf(kind) {
    let s = this.shapes.get(kind);
    if (s) return s;
    if (kind.startsWith('tree:')) s = treeShape(kind.slice(5), this.theme);
    else {
      const geo = smallShape(Number(kind.slice(6)));
      s = geo ? { std: 0, geo } : null;
    }
    this.shapes.set(kind, s);
    return s;
  }

  // Every mesh made again from the cells (as the island is first drawn, and
  // after a change: an ambush's thorns, a beacon's logs alight).
  rebuild() {
    for (const m of this.meshes.values()) {
      this.group.remove(m);
      m.dispose();
    }
    this.meshes.clear();
    const { world } = this;
    const { D, H } = world;
    const byKind = new Map();
    for (const [i, id] of this.cells) {
      const kind = this.kindOf(id);
      if (!kind) continue;
      let list = byKind.get(kind);
      if (!list) byKind.set(kind, (list = []));
      list.push(i);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (const [kind, list] of byKind) {
      const shape = this.shapeOf(kind);
      if (!shape) continue;
      const mesh = new THREE.InstancedMesh(shape.geo, this.material, list.length);
      mesh.customDepthMaterial = this.depth;
      const tree = kind.startsWith('tree:');
      let n = 0;
      for (const i of list) {
        const y = i % H;
        const z = Math.floor(i / H) % D;
        const x = Math.floor(i / H / D);
        const h = (x * 7919 + z * 104729) % 997;
        const turn = (h / 997) * Math.PI * 2;
        let size = 1;
        if (tree) {
          // As big as its trunk is tall.
          let trunk = 0;
          while (world.get(x, y + 1 + trunk, z) === B.TREE_CORE) trunk++;
          size = (trunk + 1.2) / (shape.std + 1.2);
          size *= 0.92 + (h % 17) / 100;
        } else if (kind === `small:${B.BOULDER}`) size = 0.85 + (h % 30) / 100;
        else size = 0.85 + (h % 25) / 100;
        const lift = this.ground.lift(x + 0.5, y, z + 0.5, 0.3);
        // (Logs in a row lie along it; a heap of them is a beacon's.)
        const along = kind === `small:${B.LOGS}` ? (world.get(x + 1, y, z) === B.LOGS || world.get(x - 1, y, z) === B.LOGS ? 0 : world.get(x, y, z + 1) === B.LOGS || world.get(x, y, z - 1) === B.LOGS ? Math.PI / 2 : turn) : turn;
        q.setFromAxisAngle(UP, along);
        p.set(x + 0.5, y + lift - (tree ? 0.15 : 0), z + 0.5);
        s.set(size, size, size);
        mesh.setMatrixAt(n++, m.compose(p, q, s));
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = tree || kind === `small:${B.BOULDER}` || kind === `small:${B.BRAMBLE}`;
      mesh.receiveShadow = true;
      mesh.name = kind;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  // Blocks changed: the cells of what is drawn here taken in, and drawn again
  // if any of it was.
  cellsChanged(cells) {
    const { D, H } = this.world;
    let any = false;
    for (let i = 0; i < cells.length; i += 4) {
      const k = (cells[i] * D + cells[i + 2]) * H + cells[i + 1];
      const id = cells[i + 3];
      const was = this.cells.has(k);
      if (this.kindOf(id)) {
        this.cells.set(k, id);
        any = true;
      } else if (was) {
        this.cells.delete(k);
        any = true;
      }
      // A tree's trunk growing or going changes how big it is drawn.
      if (id === B.TREE_CORE) any = true;
    }
    if (any) this.rebuild();
  }

  dispose() {
    for (const m of this.meshes.values()) m.dispose();
    for (const s of this.shapes.values()) s?.geo.dispose();
    this.material.dispose();
    this.depth.dispose();
  }
}
