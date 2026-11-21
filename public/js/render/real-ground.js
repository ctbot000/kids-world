// The Wild Isle's ground (render/real.js): one smooth skin laid over the tops
// of the island's blocks, as real land is — not a block in sight.
//
// Each column of ground has its height (the top of its highest block of
// ground). Two columns side by side whose heights differ by one are joined:
// one step is a slope, which is how the ground is walked anyway. Two that
// differ by more are not: between them stands a face of rock, as tall as the
// step, roughened so that it is no wall of bricks. Where columns are joined,
// the skin passes through the average height of those round it, so a hill
// of one-block steps is a smooth hill.
//
// The skin is a grid of points two to a block, each point one vertex for
// every group of joined columns that meet there (so a cliff's top and foot
// are two vertices in one place, a rock face between them). What each point
// is made of (grass, a forest's floor, earth, sand, rock, gravel, snow, the
// fog's dead ground) blends from the columns round it; where the skin is
// steep it is rock. It is shaded where the land round it hides the sky, and
// lit by lamps at night.
//
// What stands on it — someone, a monster, a tree — stands where the skin is,
// not on the block's top under it: surfaceAt says where, for each column.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { MAT } from './real-textures.js';

// The ground's materials, by splat channel (the first eight of MATERIALS).
export const SPLATS = ['grass', 'forest', 'dirt', 'sand', 'rock', 'gravel', 'snow', 'gloom'];
const CH = Object.fromEntries(SPLATS.map((k, i) => [k, i]));
// Which channel each block of ground is.
const SPLAT = new Int8Array(B.BLOCK_IDS).fill(-1);
for (let id = 0; id < B.BLOCK_IDS; id++) if (B.TERRAIN[id]) SPLAT[id] = CH.dirt;
SPLAT[B.GRASS] = CH.grass;
SPLAT[B.MOWED] = CH.grass;
SPLAT[B.SAND] = CH.sand;
SPLAT[B.STONE] = CH.rock;
SPLAT[B.BASALT] = CH.rock;
for (const id of B.GEM_ROCKS ?? []) SPLAT[id] = CH.rock;
SPLAT[B.PEBBLES] = CH.gravel;
SPLAT[B.SNOW] = CH.snow;
SPLAT[B.ICE] = CH.snow;
SPLAT[B.GLOOM] = CH.gloom;
export const splatOf = (id) => SPLAT[id];

// How far round a point the columns count towards its height, and its material.
const REACH = 1.6;
const PAINT_REACH = 1.55;

// Smooth 3D value noise, -1 to 1, for roughening the rock faces.
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const at = (i, j, k) => hash3(x0 + i, y0 + j, z0 + k);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(at(0, 0, 0), at(1, 0, 0), u), l(at(0, 1, 0), at(1, 1, 0), u), v), l(l(at(0, 0, 1), at(1, 0, 1), u), l(at(0, 1, 1), at(1, 1, 1), u), v), w) * 2 - 1;
}

// The ground of a world, column by column: its height (the top of its
// ground), what it is (a splat channel), and the water standing over it (its
// top, 0 for none).
export function groundColumns(world) {
  const { W, D, H } = world;
  const height = new Int16Array(W * D);
  const kind = new Int8Array(W * D);
  const water = new Int16Array(W * D);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const base = (x * D + z) * H;
      let y = H - 1;
      while (y > 0 && !B.TERRAIN[world.blocks[base + y]]) y--;
      const k = x * D + z;
      height[k] = y + 1;
      kind[k] = Math.max(0, SPLAT[world.blocks[base + y]]);
      let top = 0;
      for (let yy = y + 1; yy < H && world.blocks[base + yy] === B.WATER; yy++) top = yy + 1;
      water[k] = top;
    }
  }
  return { height, kind, water };
}

export class RealGround {
  // trees: the feet of the real trees, as [x, y, z] (their forest floor).
  // rough: how rough its faces of rock are (1 as real rock is; less for a
  // cartoon's, render/cartoon.js).
  constructor(world, light, trees = [], { rough = 1 } = {}) {
    this.world = world;
    this.rough = rough;
    const { W, D } = world;
    this.W = W;
    this.D = D;
    const cols = groundColumns(world);
    this.cols = cols;
    // How wooded each column is (0 to 1): its grass is a forest's floor there.
    this.wood = new Float32Array(W * D);
    for (const [tx, , tz] of trees) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const x = tx + dx;
          const z = tz + dz;
          if (x < 0 || z < 0 || x >= W || z >= D) continue;
          const d = Math.hypot(dx, dz);
          if (d > 3.2) continue;
          this.wood[x * D + z] += 0.55 * (1 - d / 3.2);
        }
      }
    }
    this.light = light;
    this.build();
  }

  // Two columns side by side are joined by a slope when one step apart, and
  // always under water, where nobody walks: the sea bed is smooth.
  joined(a, b) {
    const { height, water } = this.cols;
    if (Math.abs(height[a] - height[b]) <= 1) return true;
    const sea = this.world.sea + 1;
    const wet = (k) => water[k] > height[k] || height[k] < sea;
    return wet(a) && wet(b);
  }

  // The skin: points, the vertices at each, the cells' quads and the faces of rock.
  build() {
    const { W, D, cols } = this;
    const PW = 2 * W + 1;
    const PD = 2 * D + 1;
    // Each cell's nine points (corners, middles of its sides, its middle), as vertices.
    const cellVert = new Int32Array(W * D * 9).fill(-1);
    const pos = [];
    const splat = [];
    const extra = [];
    // Whether a vertex is on a face of rock (to be roughened), by vertex.
    const rough = [];
    const touching = (i, j) => {
      const xs = i % 2 === 0 ? [i / 2 - 1, i / 2] : [(i - 1) / 2];
      const zs = j % 2 === 0 ? [j / 2 - 1, j / 2] : [(j - 1) / 2];
      const out = [];
      for (const x of xs) for (const z of zs) if (x >= 0 && z >= 0 && x < W && z < D) out.push(x * D + z);
      return out;
    };
    const weights = new Float32Array(8);
    const seen = new Map();
    for (let i = 0; i < PW; i++) {
      for (let j = 0; j < PD; j++) {
        const cells = touching(i, j);
        if (!cells.length) continue;
        // The cells joined at this point, in groups.
        const group = cells.map((_, n) => n);
        const find = (n) => (group[n] === n ? n : (group[n] = find(group[n])));
        for (let a = 0; a < cells.length; a++) {
          for (let b = a + 1; b < cells.length; b++) {
            const ca = cells[a];
            const cb = cells[b];
            const adjacent = Math.abs(Math.floor(ca / D) - Math.floor(cb / D)) + Math.abs((ca % D) - (cb % D)) === 1;
            if (adjacent && this.joined(ca, cb)) group[find(a)] = find(b);
          }
        }
        const px = i / 2;
        const pz = j / 2;
        const roots = [...new Set(cells.map((_, n) => find(n)))];
        for (const root of roots) {
          const own = cells.filter((_, n) => find(n) === root);
          // The columns joined to these within reach, by a walk over joined
          // neighbours, each counted by how near its middle is.
          seen.clear();
          const queue = [...own];
          for (const c of own) seen.set(c, true);
          let hs = 0;
          let ws = 0;
          weights.fill(0);
          let paint = 0;
          let wooded = 0;
          for (let q = 0; q < queue.length; q++) {
            const c = queue[q];
            const cx = Math.floor(c / D) + 0.5;
            const cz = (c % D) + 0.5;
            const d = Math.hypot(cx - px, cz - pz);
            const w = Math.max(own.includes(c) ? 0.05 : 0, (1 - (d / REACH) ** 2) ** 2);
            hs += cols.height[c] * w;
            ws += w;
            const pw = Math.max(own.includes(c) ? 0.05 : 0, (1 - Math.min(1, d / PAINT_REACH) ** 2) ** 2);
            weights[cols.kind[c]] += pw;
            wooded += this.wood[c] * pw;
            paint += pw;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = Math.floor(c / D) + dx;
              const nz = (c % D) + dz;
              if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
              const n = nx * D + nz;
              if (seen.has(n) || !this.joined(c, n)) continue;
              if (Math.hypot(nx + 0.5 - px, nz + 0.5 - pz) > REACH) continue;
              seen.set(n, true);
              queue.push(n);
            }
          }
          const v = pos.length / 3;
          pos.push(px, hs / ws, pz);
          // A forest's floor where the grass is under trees.
          const forest = Math.min(0.85, wooded / paint) * weights[CH.grass];
          weights[CH.grass] -= forest;
          weights[CH.forest] += forest;
          for (let k = 0; k < 8; k++) splat.push(weights[k] / paint);
          extra.push(1, 0);
          rough.push(0);
          for (const c of own) {
            const lx = i - 2 * Math.floor(c / D);
            const lz = j - 2 * (c % D);
            cellVert[c * 9 + lx * 3 + lz] = v;
          }
        }
      }
    }
    const index = [];
    // Each cell: four quads, their diagonals turning about its middle.
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const c = (x * D + z) * 9;
        const at = (a, b) => cellVert[c + a * 3 + b];
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            const v00 = at(a, b);
            const v10 = at(a + 1, b);
            const v01 = at(a, b + 1);
            const v11 = at(a + 1, b + 1);
            // (Counter-clockwise seen from above: y up, x right, z towards you.)
            if ((a + b) % 2 === 0) index.push(v00, v01, v11, v00, v11, v10);
            else index.push(v00, v01, v10, v10, v01, v11);
          }
        }
      }
    }
    // The faces of rock between columns not joined: from the lower one's
    // vertices along their shared side up to the higher one's.
    const faces = [];
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const c = x * D + z;
        for (const [dx, dz] of [[1, 0], [0, 1]]) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx >= W || nz >= D) continue;
          const n = nx * D + nz;
          if (this.joined(c, n)) continue;
          const low = cols.height[c] < cols.height[n] ? c : n;
          const high = low === c ? n : c;
          // The side's three points, in each cell's own numbering.
          const side = (cell) => {
            const cx = Math.floor(cell / D);
            const cz = cell % D;
            return [0, 1, 2].map((s) => {
              const a = dx ? 2 * (nx - cx) : s;
              const b = dz ? 2 * (nz - cz) : s;
              return cellVert[cell * 9 + a * 3 + b];
            });
          };
          faces.push({ lows: side(low), highs: side(high), facing: [low === c ? -dx : dx, 0, low === c ? -dz : dz] });
        }
      }
    }
    for (const { lows, highs, facing } of faces) {
      for (const v of [...lows, ...highs]) rough[v] = Math.max(rough[v], 1);
      // Rows up the face, about two to a block.
      const rows = [];
      let most = 1;
      for (let s = 0; s < 3; s++) most = Math.max(most, Math.ceil((pos[highs[s] * 3 + 1] - pos[lows[s] * 3 + 1]) / 0.5));
      for (let s = 0; s < 3; s++) {
        const lo = lows[s];
        const hi = highs[s];
        const col = [lo];
        for (let r = 1; r < most; r++) {
          const t = r / most;
          const v = pos.length / 3;
          pos.push(pos[lo * 3], pos[lo * 3 + 1] + (pos[hi * 3 + 1] - pos[lo * 3 + 1]) * t, pos[lo * 3 + 2]);
          for (let k = 0; k < 8; k++) splat.push(k === CH.rock ? 1 : 0);
          extra.push(1, 0);
          rough.push(2);
          col.push(v);
        }
        col.push(hi);
        rows.push(col);
      }
      for (let s = 0; s < 2; s++) {
        for (let r = 0; r < most; r++) {
          const a = rows[s][r];
          const b = rows[s + 1][r];
          const c2 = rows[s][r + 1];
          const d2 = rows[s + 1][r + 1];
          // Wound to face the lower column.
          const ax = pos[b * 3] - pos[a * 3];
          const az = pos[b * 3 + 2] - pos[a * 3 + 2];
          // (along x up: the face's normal is along x cross up.)
          const nxv = -az;
          const nzv = ax;
          if (nxv * facing[0] + nzv * facing[2] > 0) index.push(a, b, c2, b, d2, c2);
          else index.push(a, c2, b, b, c2, d2);
        }
      }
    }
    // Rough faces: each vertex on one pushed about by noise (its top and foot
    // a little, the rows between more), the same wherever it is shared.
    const count = pos.length / 3;
    for (let v = 0; v < count; v++) {
      if (!rough[v]) continue;
      const x = pos[v * 3];
      const y = pos[v * 3 + 1];
      const z = pos[v * 3 + 2];
      const amp = (rough[v] === 2 ? 0.34 : 0.16) * this.rough;
      pos[v * 3] += noise3(x * 1.3, y * 1.1, z * 1.3) * amp + noise3(x * 3.1 + 7, y * 2.9, z * 3.1) * amp * 0.4;
      pos[v * 3 + 2] += noise3(x * 1.3 + 31, y * 1.1, z * 1.3 + 17) * amp + noise3(x * 3.1, y * 2.9 + 5, z * 3.1 + 9) * amp * 0.4;
      if (rough[v] === 2) pos[v * 3 + 1] += noise3(x * 2.3 + 3, y * 1.7, z * 2.3) * 0.08;
    }
    this.cellVert = cellVert;
    this.positions = new Float32Array(pos);
    this.vertexCount = count;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const sp = new Float32Array(splat);
    this.splat = sp;
    this.splatBuffer = new THREE.InterleavedBuffer(sp, 8);
    g.setAttribute('splatA', new THREE.InterleavedBufferAttribute(this.splatBuffer, 4, 0));
    g.setAttribute('splatB', new THREE.InterleavedBufferAttribute(this.splatBuffer, 4, 4));
    this.extra = new Float32Array(extra);
    g.setIndex(index);
    g.computeVertexNormals();
    this.geometry = g;
    this.shade();
    g.setAttribute('extra', new THREE.BufferAttribute(this.extra, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }

  // How much sky each vertex sees (the land round it hiding some), and how
  // much lamp light reaches it: the second number of `extra`.
  shade() {
    const { W, D, cols, positions, extra, light } = this;
    const H = this.world.H;
    const heightAt = (x, z) => (x < 0 || z < 0 || x >= W || z >= D ? this.world.sea - 6 : cols.height[x * D + z]);
    const DIRS = 8;
    for (let v = 0; v < this.vertexCount; v++) {
      const x = positions[v * 3];
      const y = positions[v * 3 + 1];
      const z = positions[v * 3 + 2];
      let hidden = 0;
      for (let k = 0; k < DIRS; k++) {
        const a = (k / DIRS) * Math.PI * 2 + 0.3;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        let most = 0;
        for (let s = 0.75; s <= 6; s += 0.75) {
          const h = heightAt(Math.floor(x + dx * s), Math.floor(z + dz * s));
          most = Math.max(most, (h - y) / s);
        }
        hidden += most / Math.sqrt(1 + most * most);
      }
      let ao = 1 - 0.75 * (hidden / DIRS);
      // Right at the foot of anything built: darker.
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      const yy = Math.floor(y + 0.2);
      let near = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const id = this.world.get(cx + dx, yy, cz + dz);
          if (B.SOLID[id] && !B.TERRAIN[id] && B.KIND[id] !== B.K_TREE) near += dx === 0 || dz === 0 ? 0.08 : 0.04;
        }
      }
      ao *= 1 - Math.min(0.35, near);
      extra[v * 2] = Math.max(0.2, ao);
      const lamp = light ? Math.max(light.lampAt(cx, yy, cz), light.lampAt(cx, Math.min(H - 1, yy + 1), cz)) : 0;
      extra[v * 2 + 1] = lamp ? (lamp / 15) ** 2.2 : 0;
    }
  }

  // Where the skin is over (x, z) for something standing on the ground of
  // column (cx, cz): its height there, or null outside the world.
  surfaceIn(cx, cz, x, z) {
    const { W, D } = this;
    if (cx < 0 || cz < 0 || cx >= W || cz >= D) return null;
    const fx = Math.min(1.999, Math.max(0, (x - cx) * 2));
    const fz = Math.min(1.999, Math.max(0, (z - cz) * 2));
    const a = Math.floor(fx);
    const b = Math.floor(fz);
    const u = fx - a;
    const w = fz - b;
    const c = (cx * D + cz) * 9;
    const y = (aa, bb) => this.positions[this.cellVert[c + aa * 3 + bb] * 3 + 1];
    // The same two triangles the quad is cut into.
    const y00 = y(a, b);
    const y10 = y(a + 1, b);
    const y01 = y(a, b + 1);
    const y11 = y(a + 1, b + 1);
    if ((a + b) % 2 === 0) return u > w ? y00 + (y10 - y00) * u + (y11 - y10) * w : y00 + (y11 - y01) * u + (y01 - y00) * w;
    return u + w < 1 ? y00 + (y10 - y00) * u + (y01 - y00) * w : y11 + (y01 - y11) * (1 - u) + (y10 - y11) * (1 - w);
  }

  // How far up or down to draw something standing at (x, y, z) so that it
  // stands on the skin: 0 unless it stands on (or over) the ground of a
  // column near it, its feet at that ground's top.
  lift(x, y, z, radius = 0.3) {
    const { W, D, cols } = this;
    const fy = Math.round(y);
    // The column it stands on: the one under its middle, or under its edge.
    let best = -1;
    let bestH = -Infinity;
    for (const ox of [0, -radius, radius]) {
      for (const oz of [0, -radius, radius]) {
        const cx = Math.floor(x + ox);
        const cz = Math.floor(z + oz);
        if (cx < 0 || cz < 0 || cx >= W || cz >= D) continue;
        const h = cols.height[cx * D + cz];
        if (h <= y + 0.05 && h > bestH) {
          bestH = h;
          best = cx * D + cz;
        }
        if (ox === 0 && oz === 0 && h === fy) {
          bestH = h;
          best = cx * D + cz;
          break;
        }
      }
    }
    if (best < 0 || y - bestH > 6) return 0;
    // On something built over the ground (a bridge, a floor): as it is.
    const cx = Math.floor(best / D);
    const cz = best % D;
    if (B.SOLID[this.world.get(Math.floor(x), Math.floor(y - 0.05), Math.floor(z))] && !B.TERRAIN[this.world.get(Math.floor(x), Math.floor(y - 0.05), Math.floor(z))]) return 0;
    const s = this.surfaceIn(cx, cz, x, z);
    if (s === null) return 0;
    return Math.max(-1.2, Math.min(1.2, s - bestH));
  }

  // A camp freed: what its columns are made of now (gloom to grass), in
  // the paint of the vertices round them.
  repaint(cells) {
    const { D, cols, world } = this;
    const changed = new Set();
    for (let i = 0; i < cells.length; i += 4) {
      const x = cells[i];
      const z = cells[i + 2];
      if (x < 0 || z < 0 || x >= this.W || z >= D) continue;
      const k = x * D + z;
      const top = world.top(x, z);
      let y = top;
      while (y > 0 && !B.TERRAIN[world.get(x, y, z)]) y--;
      const kind = Math.max(0, SPLAT[world.get(x, y, z)]);
      if (kind !== cols.kind[k]) {
        cols.kind[k] = kind;
        changed.add(k);
      }
    }
    if (!changed.size) return false;
    // The vertices of each changed column and its neighbours: their paint
    // again, from the columns round them (heights are unchanged).
    const verts = new Set();
    for (const k of changed) {
      const x = Math.floor(k / D);
      const z = k % D;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= this.W || nz >= D) continue;
          for (let q = 0; q < 9; q++) verts.add(this.cellVert[(nx * D + nz) * 9 + q]);
        }
      }
    }
    for (const v of verts) {
      const px = this.positions[v * 3];
      const pz = this.positions[v * 3 + 2];
      const w = new Float32Array(8);
      let sum = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = Math.floor(px - 0.5) + dx + (dx < 0 ? 0 : 0);
          const cz = Math.floor(pz - 0.5) + dz;
          if (cx < 0 || cz < 0 || cx >= this.W || cz >= D) continue;
          const c = cx * D + cz;
          const d = Math.hypot(cx + 0.5 - px, cz + 0.5 - pz);
          const pw = (1 - Math.min(1, d / PAINT_REACH) ** 2) ** 2;
          if (!pw || Math.abs(cols.height[c] - this.positions[v * 3 + 1]) > 1.2) continue;
          w[cols.kind[c]] += pw;
          sum += pw;
        }
      }
      if (!sum) continue;
      for (let k = 0; k < 8; k++) this.splat[v * 8 + k] = w[k] / sum;
    }
    this.splatBuffer.needsUpdate = true;
    return true;
  }

  // The heights of the skin as a picture, a texel to each point of the grid
  // (for the water, to see how deep it is over the ground).
  heightTexture() {
    const PW = 2 * this.W + 1;
    const PD = 2 * this.D + 1;
    const data = new Float32Array(PW * PD);
    for (let i = 0; i < PW; i++) {
      for (let j = 0; j < PD; j++) {
        // The lowest vertex at each point (the foot of a cliff, under water).
        const cx = Math.min(this.W - 1, Math.floor(i / 2));
        const cz = Math.min(this.D - 1, Math.floor(j / 2));
        const v = this.cellVert[(cx * this.D + cz) * 9 + (i - 2 * cx) * 3 + (j - 2 * cz)];
        data[j * PW + i] = v >= 0 ? this.positions[v * 3 + 1] : 0;
      }
    }
    const t = new THREE.DataTexture(data, PW, PD, THREE.RedFormat, THREE.FloatType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  dispose() {
    this.geometry.dispose();
  }
}

// The ground's material: lit as everything real is (three's standard
// material, the sun's shadows and the sky's light), its colour, bumps and
// roughness blended from the materials' pictures by the vertices' paint,
// rock wherever it is steep, the sky's light dimmed where the land hides it
// and the lamps' added at night.
export function groundMaterial(textures, uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.tAlbedo = { value: textures.albedo };
    shader.uniforms.tNormal = { value: textures.normal };
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 splatA;
        attribute vec4 splatB;
        attribute vec2 extra;
        varying vec4 vSplatA;
        varying vec4 vSplatB;
        varying vec2 vExtra;
        varying vec3 vGround;
        varying vec3 vGroundN;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSplatA = splatA;
        vSplatB = splatB;
        vExtra = extra;
        vGround = (modelMatrix * vec4(position, 1.0)).xyz;
        vGroundN = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform highp sampler2DArray tAlbedo;
        uniform highp sampler2DArray tNormal;
        uniform vec3 uLampColor;
        uniform float uNight;
        uniform vec3 uGrassTint;
        varying vec4 vSplatA;
        varying vec4 vSplatB;
        varying vec2 vExtra;
        varying vec3 vGround;
        varying vec3 vGroundN;
        // Tiles of each material, in blocks across.
        const float SCALE[8] = float[8](3.2, 3.0, 3.0, 3.6, 4.5, 2.4, 5.0, 3.2);
        vec3 gN;
        float gRough;
        // A material at this point: planar from above where the ground is
        // level, from the sides as well where it is steep.
        vec4 sampleMat(int layer, out vec3 nrm, out float rough) {
          vec3 p = vGround / SCALE[layer];
          vec3 n = vGroundN;
          vec3 w = pow(abs(n), vec3(6.0));
          w /= (w.x + w.y + w.z);
          vec4 a = vec4(0.0);
          vec4 t = vec4(0.0);
          if (w.y > 0.01) {
            vec2 uv = p.xz;
            a += texture(tAlbedo, vec3(uv, float(layer))) * w.y;
            vec4 tn = texture(tNormal, vec3(uv, float(layer)));
            vec2 d = tn.xy * 2.0 - 1.0;
            t += vec4(d.x, 0.0, d.y, tn.z) * w.y;
          }
          if (w.x > 0.01) {
            vec2 uv = vec2(p.z, p.y);
            a += texture(tAlbedo, vec3(uv, float(layer))) * w.x;
            vec4 tn = texture(tNormal, vec3(uv, float(layer)));
            vec2 d = tn.xy * 2.0 - 1.0;
            t += vec4(0.0, d.y, d.x, tn.z) * w.x;
          }
          if (w.z > 0.01) {
            vec2 uv = vec2(p.x, p.y);
            a += texture(tAlbedo, vec3(uv, float(layer))) * w.z;
            vec4 tn = texture(tNormal, vec3(uv, float(layer)));
            vec2 d = tn.xy * 2.0 - 1.0;
            t += vec4(d.x, d.y, 0.0, tn.z) * w.z;
          }
          nrm = t.xyz;
          rough = t.w;
          return a;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `
        float wts[8] = float[8](vSplatA.x, vSplatA.y, vSplatA.z, vSplatA.w, vSplatB.x, vSplatB.y, vSplatB.z, vSplatB.w);
        // Rock wherever the ground is steep, and some on a slope of earth.
        float steep = smoothstep(0.62, 0.78, 1.0 - vGroundN.y);
        for (int k = 0; k < 8; k++) wts[k] *= 1.0 - steep;
        wts[4] += steep;
        vec4 macro = texture(tAlbedo, vec3(vGround.xz / 41.0, 13.0));
        // Each material that is there, its height deciding where two meet.
        vec4 cols[8];
        vec3 nrms[8];
        float rghs[8];
        float best = 0.0;
        for (int k = 0; k < 8; k++) {
          if (wts[k] < 0.02) continue;
          cols[k] = sampleMat(k, nrms[k], rghs[k]);
          best = max(best, wts[k] + cols[k].a * 0.6);
        }
        vec3 albedo = vec3(0.0);
        gN = vec3(0.0);
        gRough = 0.0;
        float sum = 0.0;
        for (int k = 0; k < 8; k++) {
          if (wts[k] < 0.02) continue;
          float w = max(0.0, wts[k] + cols[k].a * 0.6 - best + 0.32);
          vec3 c = cols[k].rgb;
          if (k == 0) c *= uGrassTint;
          albedo += c * w;
          gN += nrms[k] * w;
          gRough += rghs[k] * w;
          sum += w;
        }
        albedo /= max(sum, 1e-4);
        gN /= max(sum, 1e-4);
        gRough /= max(sum, 1e-4);
        // Big patches lighter and darker, so no tiling shows from afar.
        albedo *= 0.82 + macro.a * 0.36;
        diffuseColor.rgb *= albedo;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = clamp(gRough, 0.3, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `
        // The pictures' bumps on the ground's own normal (both in the world),
        // into the view as three's lights want it.
        vec3 bent = normalize(vGroundN + gN * 0.9);
        normal = normalize((viewMatrix * vec4(bent, 0.0)).xyz);
        `,
      )
      .replace(
        '#include <aomap_fragment>',
        `
        float ambientOcclusion = vExtra.x;
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        reflectedLight.indirectSpecular *= ambientOcclusion;
        reflectedLight.directDiffuse += diffuseColor.rgb * uLampColor * vExtra.y * uNight;
        `,
      );
  };
  m.customProgramCacheKey = () => 'real-ground';
  return m;
}
