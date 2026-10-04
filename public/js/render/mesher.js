// Turns a 16x16 column of the world into vertex data: cube faces with soft
// shadows in the corners (ambient occlusion) and smooth light, crossed
// pictures for flowers, camera-facing pictures for fruit and shells, water
// and glass, and one stud per brick top. No three.js here, so it runs (and
// is tested) anywhere.
import { AIR, KIND, K_GLASS, K_ITEM, K_PLANT, K_SOLID, K_WATER, OPAQUE, EMIT, WATER, BLOCKS, FRUIT_ITEMS, GEM_ITEMS, RAIL, SHELL, STAR_PIECE, STONE, SUNFLOWER } from '../shared/blocks.js';

// The four ways along the ground, as shared/riding.js numbers them.
const RAIL_DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
import { hash3 } from '../shared/rng.js';
import { CHUNK } from '../shared/world.js';

export const WATER_TOP = 0.875;

// For each face: normal, texture-right axis u, texture-up axis v, and the
// corner the face starts from (as 0/1 offsets). Corners go base, +u, +u+v, +v,
// which is counter-clockwise seen from outside because u x v = normal.
export const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], base: [1, 0, 1], shade: 0.8, tile: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], base: [0, 0, 0], shade: 0.8, tile: 1 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], base: [0, 1, 1], shade: 1, tile: 0 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], base: [0, 0, 0], shade: 0.58, tile: 2 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], base: [0, 0, 1], shade: 0.9, tile: 1 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], base: [1, 0, 0], shade: 0.9, tile: 1 },
];
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// A typed array that grows as it is filled.
class Buf {
  constructor(Type, size = 1024) {
    this.Type = Type;
    this.a = new Type(size);
    this.n = 0;
  }

  push(...values) {
    if (this.n + values.length > this.a.length) {
      const b = new this.Type(Math.max(this.a.length * 2, this.n + values.length));
      b.set(this.a);
      this.a = b;
    }
    for (let i = 0; i < values.length; i++) this.a[this.n++] = values[i];
  }

  out() {
    return this.a.slice(0, this.n);
  }
}

class Part {
  constructor() {
    this.pos = new Buf(Float32Array);
    this.uvl = new Buf(Float32Array);
    this.col = new Buf(Uint8Array);
    this.lit = new Buf(Uint8Array);
    this.idx = new Buf(Uint32Array);
    this.verts = 0;
  }

  out() {
    return { pos: this.pos.out(), uvl: this.uvl.out(), col: this.col.out(), lit: this.lit.out(), idx: this.idx.out(), verts: this.verts };
  }
}

class ItemPart extends Part {
  constructor() {
    super();
    this.corner = new Buf(Float32Array);
  }

  out() {
    return { ...super.out(), corner: this.corner.out() };
  }
}

export function meshChunk(world, light, visuals, cx, cz) {
  const { W, H, D, sea } = world;
  const blocks = world.blocks;
  const { faceLayer, tint, studTint } = visuals;
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const x1 = Math.min(W, x0 + CHUNK);
  const z1 = Math.min(D, z0 + CHUNK);

  const opaque = new Part();
  const water = new Part();
  const glass = new Part();
  const plants = new Part();
  const items = new ItemPart();
  const studOffset = new Buf(Float32Array);
  const studCol = new Buf(Uint8Array);
  const studLit = new Buf(Uint8Array);

  // The block at a cell; past the sides of the world, the sea bed goes on
  // forever below the waterline (so the world's cut edge is never drawn).
  const at = (x, y, z) => {
    if (y < 0) return STONE;
    if (y >= H) return AIR;
    if (x < 0 || z < 0 || x >= W || z >= D) return y <= sea ? (y <= sea - 1 ? STONE : WATER) : AIR;
    return blocks[(x * D + z) * H + y];
  };
  const skyAt = (x, y, z) => light.skyAt(x, y, z);
  const lampAt = (x, y, z) => light.lampAt(x, y, z);

  const lit = new Float32Array(4 * 3);
  const aos = [0, 0, 0, 0];

  // Soft light and corner shadow for the 4 corners of a face of cell (x,y,z).
  function faceLight(x, y, z, f) {
    const { n, u, v } = f;
    const fx = x + n[0];
    const fy = y + n[1];
    const fz = z + n[2];
    for (let k = 0; k < 4; k++) {
      const su = CORNERS[k][0] ? 1 : -1;
      const sv = CORNERS[k][1] ? 1 : -1;
      const ax = fx + u[0] * su;
      const ay = fy + u[1] * su;
      const az = fz + u[2] * su;
      const bx = fx + v[0] * sv;
      const by = fy + v[1] * sv;
      const bz = fz + v[2] * sv;
      const cxx = ax + v[0] * sv;
      const cy = ay + v[1] * sv;
      const czz = az + v[2] * sv;
      const s1 = OPAQUE[at(ax, ay, az)];
      const s2 = OPAQUE[at(bx, by, bz)];
      const c = s1 && s2 ? 1 : OPAQUE[at(cxx, cy, czz)];
      aos[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
      let sky = skyAt(fx, fy, fz);
      let lamp = lampAt(fx, fy, fz);
      let count = 1;
      if (!s1) {
        sky += skyAt(ax, ay, az);
        lamp += lampAt(ax, ay, az);
        count++;
      }
      if (!s2) {
        sky += skyAt(bx, by, bz);
        lamp += lampAt(bx, by, bz);
        count++;
      }
      if (!c) {
        sky += skyAt(cxx, cy, czz);
        lamp += lampAt(cxx, cy, czz);
        count++;
      }
      lit[k * 3] = sky / count;
      lit[k * 3 + 1] = lamp / count;
    }
  }

  // mode: 'solid' (smooth light), 'glow' (always bright), 'water' or 'glass'
  // (flat light from the cell in front).
  function quad(part, x, y, z, f, layer, id, mode, flat = null, top = 1, surface = false) {
    const [bx, by, bz] = f.base;
    const tr = tint[id * 3];
    const tg = tint[id * 3 + 1];
    const tb = tint[id * 3 + 2];
    const shade = Math.round(f.shade * 255);
    const v0 = part.verts;
    for (let k = 0; k < 4; k++) {
      const [cu, cv] = CORNERS[k];
      const px = x + bx + f.u[0] * cu + f.v[0] * cv;
      let py = y + by + f.u[1] * cu + f.v[1] * cv;
      const pz = z + bz + f.u[2] * cu + f.v[2] * cv;
      const high = py === y + 1;
      if (high && top !== 1) py = y + top;
      part.pos.push(px, py, pz);
      part.uvl.push(cu, 1 - cv, layer);
      part.col.push(tr, tg, tb);
      if (mode === 'glow') part.lit.push(255, 255, 255, shade);
      else if (mode === 'water') part.lit.push(flat[0] * 17, flat[1] * 17, 255, surface && high ? 255 : 0);
      else if (mode === 'glass') part.lit.push(flat[0] * 17, flat[1] * 17, 255, shade);
      else part.lit.push(Math.round(lit[k * 3] * 17), Math.round(lit[k * 3 + 1] * 17), aos[k] * 85, shade);
    }
    part.verts += 4;
    // Split the quad along the diagonal that keeps corner shadows smooth.
    if (mode === 'solid' && aos[0] + aos[2] < aos[1] + aos[3]) part.idx.push(v0 + 1, v0 + 2, v0 + 3, v0 + 1, v0 + 3, v0);
    else part.idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  }

  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const col = (x * D + z) * H;
      for (let y = 0; y < H; y++) {
        const id = blocks[col + y];
        if (id === AIR) continue;
        const kind = KIND[id];
        if (kind === K_SOLID) {
          const glow = EMIT[id] > 0;
          // Grass (or snow, or frosting) with a block on top looks like the dirt under it.
          const covered = BLOCKS[id].under && OPAQUE[at(x, y + 1, z)];
          const look = covered ? BLOCKS[id].under : id;
          for (let d = 0; d < 6; d++) {
            const f = FACES[d];
            const nid = at(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (OPAQUE[nid]) continue;
            if (!glow) faceLight(x, y, z, f);
            quad(opaque, x, y, z, f, faceLayer[look * 3 + f.tile], look, glow ? 'glow' : 'solid');
          }
          if (BLOCKS[id].studs && at(x, y + 1, z) === AIR) {
            studOffset.push(x + 0.5, y + 1, z + 0.5);
            studCol.push(studTint[id * 3], studTint[id * 3 + 1], studTint[id * 3 + 2]);
            studLit.push(skyAt(x, y + 1, z) * 17, lampAt(x, y + 1, z) * 17);
          }
        } else if (kind === K_WATER) {
          const above = at(x, y + 1, z);
          const top = above === WATER ? 1 : WATER_TOP;
          const surface = above !== WATER;
          for (let d = 0; d < 6; d++) {
            const f = FACES[d];
            const nid = at(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (nid === WATER || OPAQUE[nid]) continue;
            const nx = x + f.n[0];
            const ny = y + f.n[1];
            const nz = z + f.n[2];
            const flat = [Math.max(skyAt(nx, ny, nz), skyAt(x, y, z)), Math.max(lampAt(nx, ny, nz), lampAt(x, y, z))];
            quad(water, x, y, z, f, faceLayer[id * 3 + f.tile], id, 'water', flat, top, surface);
          }
        } else if (kind === K_GLASS) {
          for (let d = 0; d < 6; d++) {
            const f = FACES[d];
            const nid = at(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (nid === id || OPAQUE[nid]) continue;
            const flat = [skyAt(x + f.n[0], y + f.n[1], z + f.n[2]), lampAt(x + f.n[0], y + f.n[1], z + f.n[2])];
            quad(glass, x, y, z, f, faceLayer[id * 3 + f.tile], id, 'glass', flat);
          }
        } else if (id === RAIL) {
          rail(plants, x, y, z);
        } else if (kind === K_PLANT) {
          plant(plants, x, y, z, id);
        } else if (kind === K_ITEM) {
          item(items, x, y, z, id);
        }
      }
    }
  }

  function plant(part, x, y, z, id) {
    const layer = faceLayer[id * 3];
    const jx = (hash3(7, x, y, z) - 0.5) * 0.22;
    const jz = (hash3(11, x, y, z) - 0.5) * 0.22;
    const h = (id === SUNFLOWER ? 1.25 : 0.88) + hash3(13, x, y, z) * 0.14;
    const sky = skyAt(x, y, z) * 17;
    const lamp = lampAt(x, y, z) * 17;
    const cxp = x + 0.5 + jx;
    const czp = z + 0.5 + jz;
    const r = 0.42;
    for (const [ax, az] of [
      [1, 1],
      [1, -1],
    ]) {
      const v0 = part.verts;
      const pts = [
        [cxp - ax * r, y, czp - az * r, 0, 1, 0],
        [cxp + ax * r, y, czp + az * r, 1, 1, 0],
        [cxp + ax * r, y + h, czp + az * r, 1, 0, 255],
        [cxp - ax * r, y + h, czp - az * r, 0, 0, 255],
      ];
      for (const [px, py, pz, u, v, sway] of pts) {
        part.pos.push(px, py, pz);
        part.uvl.push(u, v, layer);
        part.col.push(255, 255, 255);
        part.lit.push(sky, lamp, 255, sway);
      }
      part.verts += 4;
      part.idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
    }
  }

  // Rails lie flat, joined to the rails beside them: straight on between
  // two across from each other, round a corner between two that are not,
  // and up a slope to a rail a step up (the cart's way along them is in
  // shared/riding.js). The texture's way down the tile (v) is laid along
  // `along`, and its way across (u) along `side`.
  function rail(part, x, y, z) {
    const ways = [];
    let up = -1;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = RAIL_DIRS[d];
      if (at(x + dx, y + 1, z + dz) === RAIL) {
        if (up < 0) up = d;
        ways.push(d);
      } else if (at(x + dx, y, z + dz) === RAIL || at(x + dx, y - 1, z + dz) === RAIL) ways.push(d);
    }
    const has = (d) => ways.includes(d);
    let along = 1;
    let side = 0;
    let layer = faceLayer[RAIL * 3];
    if (up >= 0) along = up;
    else if (has(0) && has(2)) along = 0;
    else if (has(1) && has(3)) along = 1;
    else if (ways.length >= 2) {
      // A corner: from the way of one to the way of the other.
      along = ways[0];
      side = ways.find((d) => d % 2 !== along % 2);
      layer = faceLayer[RAIL * 3 + 1];
    } else if (ways.length === 1) along = ways[0] % 2;
    if (layer === faceLayer[RAIL * 3]) side = (along + 1) % 4;
    const [ax, az] = RAIL_DIRS[along];
    const [sx, sz] = RAIL_DIRS[side];
    const sky = skyAt(x, y, z) * 17;
    const lamp = lampAt(x, y, z) * 17;
    const v0 = part.verts;
    for (const [px, pz] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      const k = (px - 0.5) * ax + (pz - 0.5) * az;
      part.pos.push(x + px, y + 0.03 + (up >= 0 ? k + 0.5 : 0), z + pz);
      part.uvl.push((px - 0.5) * sx + (pz - 0.5) * sz + 0.5, k + 0.5, layer);
      part.col.push(255, 255, 255);
      part.lit.push(sky, lamp, 255, 0);
    }
    part.verts += 4;
    part.idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  }

  function item(part, x, y, z, id) {
    const layer = faceLayer[id * 3];
    const fruit = FRUIT_ITEMS.includes(id);
    const jewel = GEM_ITEMS.includes(id);
    const size = fruit ? 0.72 : id === SHELL || jewel ? 0.55 : 0.75;
    const cy = fruit ? y + 0.55 : id === STAR_PIECE ? y + 0.45 : y + 0.28;
    const sky = Math.max(skyAt(x, y, z), 4) * 17;
    // Star pieces and jewels shine, even in the dark.
    const lamp = (EMIT[id] ? 15 : lampAt(x, y, z)) * 17;
    const v0 = part.verts;
    for (const [u, v] of CORNERS) {
      part.pos.push(x + 0.5, cy, z + 0.5);
      part.corner.push((u - 0.5) * size, (v - 0.5) * size);
      part.uvl.push(u, 1 - v, layer);
      part.col.push(255, 255, 255);
      part.lit.push(sky, lamp, 255, fruit ? 0 : 255);
    }
    part.verts += 4;
    part.idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  }

  return {
    cx,
    cz,
    opaque: opaque.out(),
    water: water.out(),
    glass: glass.out(),
    plants: plants.out(),
    items: items.out(),
    studs: { offset: studOffset.out(), col: studCol.out(), lit: studLit.out(), count: studOffset.n / 3 },
  };
}
