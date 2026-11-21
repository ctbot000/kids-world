// What is built on Toon Isle (render/cartoon.js), drawn as a cartoon: never
// as bricks. Whatever the island built of blocks that are not its ground —
// a shipwreck's planks, the lighthouse's red and white bands, giant bones, a
// gallery's rail — is wrapped in one smooth skin, as if modelled in clay
// (surface nets over the blocks: a corner cut off every edge, a slope across
// every step), painted in each block's colour in the cel tones (cel.js). And
// a few things have models of their own: the Sky Lantern where everyone
// lands, the lamps round it (lit as each battle is won), the lightning rods
// of Baron Bluster's arena, and an ambush's Lantern Spark, floating and
// turning. One mesh of each chunk, made again as its blocks change.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { CHUNK } from '../shared/world.js';
import { celMaterial } from './cel.js';
import { FOG_GLSL } from './cartoon-clouds.js';

// The cartoon colour of each kind of block (else its own colour, or a soft grey).
const PAINT = new Map([
  [B.PLANKS, '#d99a5e'],
  [B.WOOD, '#8f5f3e'],
  [B.STONE, '#bdb4cc'],
  [B.PEBBLES, '#d6ccbc'],
  [B.BRICK_WALL, '#d77a5a'],
  [B.LAMP, '#ffe28a'],
  [B.GLASS, '#bfeaff'],
  [B.HAY, '#f3d36b'],
]);
const colorOf = (id) => {
  const hex = PAINT.get(id) ?? B.BLOCKS[id]?.color;
  return new THREE.Color(hex && hex !== '#ffffff' ? hex : '#dcd6e4');
};

// What has a model of its own here, and what is drawn elsewhere (the
// ground, what grows, the furniture's own models), or not at all (MASS, the
// hidden body of what a model shows).
const MODELS = new Set([B.SKY_LANTERN, B.LANTERN_LAMP, B.LANTERN_LAMP_ON, B.LIGHTNING_ROD, B.SPARK]);
const ELSEWHERE = new Set([B.BOULDER, B.LOGS, B.BRAMBLE, B.MASS, ...MODELS]);
function built(id) {
  if (!id || ELSEWHERE.has(id) || B.TERRAIN[id] || B.TREE_PART[id]) return false;
  const kind = B.KIND[id];
  if (kind === B.K_PLANT || kind === B.K_ITEM) return false;
  if (kind === B.K_FURNITURE) return !B.BLOCKS[id]?.real;
  return Boolean(B.SOLID[id]);
}

// The skin over the built blocks of the chunk at (x0, z0), `size` across: as
// a geometry (position, normal, color), or null for none there. The blocks
// are points at their middles; every little cube of eight of those with some
// in and some out gets a vertex, at the middle of its edges that cross in to
// out, and every edge between one in and one out gets a quad of the four
// cubes round it. Each chunk makes the quads of the edges starting in it, and
// works out the vertices of the cubes just over its edges too, the very same
// as its neighbours do, so the skin is one across chunks.
function surfaceNets(world, x0, z0, size) {
  const { H } = world;
  const lo = (v) => v - 1;
  const NX = size + 1;
  const NZ = size + 1;
  const occ = (x, y, z) => built(world.get(x, y, z));
  // Which cubes are anywhere near a built block (to look at no others).
  const near = new Uint8Array(NX * H * NZ);
  let any = false;
  for (let x = x0 - 1; x <= x0 + size; x++) {
    for (let z = z0 - 1; z <= z0 + size; z++) {
      for (let y = 0; y < H; y++) {
        if (!occ(x, y, z)) continue;
        any = true;
        for (let cx = x - 1; cx <= x; cx++) {
          for (let cz = z - 1; cz <= z; cz++) {
            for (let cy = y - 1; cy <= y; cy++) {
              const i = cx - lo(x0);
              const k = cz - lo(z0);
              if (i < 0 || k < 0 || i >= NX || k >= NZ || cy < 0 || cy >= H - 1) continue;
              near[(i * H + cy) * NZ + k] = 1;
            }
          }
        }
      }
    }
  }
  if (!any) return null;
  const vid = new Int32Array(NX * H * NZ).fill(-1);
  const pos = [];
  const col = [];
  const tmp = new THREE.Color();
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const corner = (c) => [c & 1, (c >> 1) & 1, (c >> 2) & 1];
  for (let i = 0; i < NX; i++) {
    for (let cy = 0; cy < H - 1; cy++) {
      for (let k = 0; k < NZ; k++) {
        const ci = (i * H + cy) * NZ + k;
        if (!near[ci]) continue;
        const cx = lo(x0) + i;
        const cz = lo(z0) + k;
        let mask = 0;
        const ids = [];
        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = corner(c);
          const id = world.get(cx + dx, cy + dy, cz + dz);
          if (built(id)) {
            mask |= 1 << c;
            ids.push(id);
          }
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
          const [ax, ay, az] = corner(a);
          const [bx, by, bz] = corner(b);
          sx += (ax + bx) / 2;
          sy += (ay + by) / 2;
          sz += (az + bz) / 2;
          n++;
        }
        vid[ci] = pos.length / 3;
        pos.push(cx + 0.5 + sx / n, cy + 0.5 + sy / n, cz + 0.5 + sz / n);
        let r = 0;
        let g = 0;
        let bl = 0;
        for (const id of ids) {
          tmp.copy(colorOf(id));
          r += tmp.r;
          g += tmp.g;
          bl += tmp.b;
        }
        col.push(r / ids.length, g / ids.length, bl / ids.length);
      }
    }
  }
  const idx = [];
  // Each triangle's block (the one on the inside of its quad), for its colour.
  const of = [];
  const V = (cx, cy, cz) => {
    const i = cx - lo(x0);
    const k = cz - lo(z0);
    if (i < 0 || k < 0 || i >= NX || k >= NZ || cy < 0 || cy >= H - 1) return -1;
    return vid[(i * H + cy) * NZ + k];
  };
  const quad = (a, b, c, d, flip, id) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
    of.push(id, id);
  };
  for (let x = x0; x < x0 + size; x++) {
    for (let z = z0; z < z0 + size; z++) {
      for (let y = 0; y < H - 1; y++) {
        const here = occ(x, y, z);
        const own = world.get(x, y, z);
        // Along x: the cubes round the edge from (x, y, z) to (x + 1, y, z).
        if (here !== occ(x + 1, y, z)) quad(V(x, y - 1, z - 1), V(x, y, z - 1), V(x, y, z), V(x, y - 1, z), !here, here ? own : world.get(x + 1, y, z));
        // Along y.
        if (here !== occ(x, y + 1, z)) quad(V(x - 1, y, z - 1), V(x - 1, y, z), V(x, y, z), V(x, y, z - 1), !here, here ? own : world.get(x, y + 1, z));
        // Along z.
        if (here !== occ(x, y, z + 1)) quad(V(x - 1, y - 1, z), V(x, y - 1, z), V(x, y, z), V(x - 1, y, z), !here, here ? own : world.get(x, y, z + 1));
      }
    }
  }
  if (!idx.length) return null;
  // Smooth normals from the shared vertices; then each triangle its own
  // three, in its block's colour, so a band of red ends where the white
  // begins (not smeared across the corner between).
  const shared = new THREE.BufferGeometry();
  shared.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shared.setIndex(idx);
  shared.computeVertexNormals();
  const normals = shared.getAttribute('normal').array;
  shared.dispose();
  const n = idx.length;
  const P = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const Q = new Float32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const v = idx[t];
    for (let k = 0; k < 3; k++) {
      P[t * 3 + k] = pos[v * 3 + k];
      N[t * 3 + k] = normals[v * 3 + k];
    }
    colorOf(of[Math.floor(t / 3)]).toArray(Q, t * 3);
  }
  void col;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(Q, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- models

const C = (hex) => new THREE.Color(hex);

function lanternModel(materials) {
  // A big paper lantern on a short pole: red, ribbed, gold at top and foot,
  // a warm glow inside once lit (lit: its emissive turned up).
  const g = new THREE.Group();
  const body = new THREE.LatheGeometry([0, 0.15, 0.55, 0.85, 1.0, 1.02, 1.0, 0.85, 0.55, 0.15, 0].map((r, i) => new THREE.Vector2(Math.max(0.01, r * 1.05), i * 0.26)), 24);
  const shell = new THREE.Mesh(body, materials.paper);
  shell.position.y = 1.2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.28, 16), materials.gold);
  cap.position.y = 3.95;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.28, 16), materials.gold);
  foot.position.y = 1.08;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), materials.wood);
  pole.position.y = 0.55;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), materials.gold);
  tassel.position.y = 4.35;
  g.add(shell, cap, foot, pole, tassel);
  for (const m of g.children) m.castShadow = true;
  return g;
}

export class CartoonBuild {
  constructor(world, fog) {
    this.world = world;
    this.fog = fog;
    this.group = new THREE.Group();
    this.group.name = 'cartoon build';
    this.chunks = new Map();
    const hide = (shader) => {
      // (Nothing under the Cloud Blanket: cartoon-clouds.js.)
      shader.vertexShader = `${FOG_GLSL}\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 at = (modelMatrix * vec4(position, 1.0)).xyz;
          transformed.y -= (1.0 - fogClear(at.xz)) * 80.0;
        }`,
      );
    };
    this.material = celMaterial({ vertexColors: true }, { key: 'cartoon-build', uniforms: fog, vertex: hide });
    this.materials = {
      paper: celMaterial({ color: C('#ff5a4a'), emissive: C('#ff9a3d'), emissiveIntensity: 0 }, { key: 'lantern-paper', uniforms: fog, vertex: hide }),
      gold: celMaterial({ color: C('#ffcf4a') }, { key: 'lantern-gold', uniforms: fog, vertex: hide }),
      wood: celMaterial({ color: C('#8f5f3e') }, { key: 'lantern-wood', uniforms: fog, vertex: hide }),
      glass: celMaterial({ color: C('#bfe6ff') }, { key: 'lamp-off', uniforms: fog, vertex: hide }),
      lit: celMaterial({ color: C('#fff1a8'), emissive: C('#ffcf4a'), emissiveIntensity: 1.2 }, { key: 'lamp-on', uniforms: fog, vertex: hide }),
      steel: celMaterial({ color: C('#9aa3b8') }, { key: 'rod-steel', uniforms: fog, vertex: hide }),
      copper: celMaterial({ color: C('#ff9a4a'), emissive: C('#ffb36a'), emissiveIntensity: 0.25 }, { key: 'rod-copper', uniforms: fog, vertex: hide }),
      spark: celMaterial({ color: C('#fff3a0'), emissive: C('#ffd84d'), emissiveIntensity: 1.1 }, { key: 'spark', uniforms: fog, vertex: hide }),
    };
    this.sparks = [];
    this.lantern = null;
    this.lit = false;
  }

  // The chunk at (cx, cz) made again from its blocks.
  build(cx, cz) {
    const key = `${cx},${cz}`;
    const old = this.chunks.get(key);
    if (old) {
      this.group.remove(old.group);
      old.skin?.geometry.dispose();
      this.sparks = this.sparks.filter((s) => s.chunk !== key);
      if (this.lantern?.chunk === key) this.lantern = null;
    }
    const { world } = this;
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;
    const group = new THREE.Group();
    const geo = surfaceNets(world, x0, z0, CHUNK);
    let skin = null;
    if (geo) {
      skin = new THREE.Mesh(geo, this.material);
      skin.castShadow = true;
      skin.receiveShadow = true;
      group.add(skin);
    }
    for (let x = x0; x < Math.min(world.W, x0 + CHUNK); x++) {
      for (let z = z0; z < Math.min(world.D, z0 + CHUNK); z++) {
        for (let y = 1; y < world.H; y++) {
          const id = world.get(x, y, z);
          if (!MODELS.has(id)) continue;
          if (id === B.SKY_LANTERN) {
            const m = lanternModel(this.materials);
            m.position.set(x + 0.5, y, z + 0.5);
            group.add(m);
            this.lantern = { chunk: key, model: m };
          } else if (id === B.LANTERN_LAMP || id === B.LANTERN_LAMP_ON) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), id === B.LANTERN_LAMP_ON ? this.materials.lit : this.materials.glass);
            m.position.set(x + 0.5, y + 0.35, z + 0.5);
            group.add(m);
          } else if (id === B.LIGHTNING_ROD && world.get(x, y - 1, z) !== B.LIGHTNING_ROD) {
            let h = 1;
            while (world.get(x, y + h, z) === B.LIGHTNING_ROD) h++;
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h + 0.6, 8), this.materials.steel);
            pole.position.set(x + 0.5, y + (h + 0.6) / 2, z + 0.5);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), this.materials.copper);
            tip.position.set(x + 0.5, y + h + 0.75, z + 0.5);
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 6, 14), this.materials.copper);
            coil.rotation.x = Math.PI / 2;
            coil.position.set(x + 0.5, y + h * 0.6, z + 0.5);
            pole.castShadow = true;
            group.add(pole, tip, coil);
          } else if (id === B.SPARK) {
            const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), this.materials.spark);
            m.position.set(x + 0.5, y + 0.7, z + 0.5);
            group.add(m);
            this.sparks.push({ chunk: key, model: m, y: y + 0.7 });
          }
        }
      }
    }
    group.name = `cartoon chunk ${key}`;
    this.chunks.set(key, { group, skin });
    this.group.add(group);
  }

  // Each frame: the sparks bob and turn, the lantern glows once lit.
  frame(time) {
    for (const s of this.sparks) {
      s.model.rotation.y = time * 1.6;
      s.model.position.y = s.y + Math.sin(time * 2.2) * 0.15;
    }
  }

  // The Sky Lantern lit (the stage won), glowing from inside.
  setLit(on) {
    this.lit = on;
    this.materials.paper.emissiveIntensity = on ? 0.9 : 0;
  }

  dispose() {
    for (const { skin } of this.chunks.values()) skin?.geometry.dispose();
    this.group.traverse((o) => {
      if (o.isMesh && o.geometry && !this.chunks.has(o.geometry)) o.geometry.dispose();
    });
    this.material.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
  }
}
