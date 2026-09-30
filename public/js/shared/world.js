// The world is a box of cells, one byte each: which block is there. Cells are
// stored column by column (y runs fastest), which keeps a column's blocks
// together and makes the run-length encoding of a whole island tiny.
import { AIR, MAGIC_FLOOR, SOLID, isKnown } from './blocks.js';

export const CHUNK = 16;

export class World {
  constructor({ W = 128, H = 64, D = 128, sea = 20, theme = 'sunny', seed = 1, name = 'My Island', spawn = null, blocks = null } = {}) {
    this.W = W;
    this.H = H;
    this.D = D;
    this.sea = sea;
    this.theme = theme;
    this.seed = seed;
    this.name = name;
    this.spawn = spawn ?? { x: W / 2 + 0.5, y: sea + 4, z: D / 2 + 0.5 };
    this.blocks = blocks ?? new Uint8Array(W * H * D);
    this.chunksX = Math.ceil(W / CHUNK);
    this.chunksZ = Math.ceil(D / CHUNK);
    // Called as onSet(x, y, z, before, after) for every change.
    this.onSet = null;
  }

  index(x, y, z) {
    return (x * this.D + z) * this.H + y;
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.H && z < this.D;
  }

  // Below the world is solid magic floor; beside and above it is air.
  get(x, y, z) {
    if (y < 0) return MAGIC_FLOOR;
    if (x < 0 || z < 0 || x >= this.W || z >= this.D || y >= this.H) return AIR;
    return this.blocks[(x * this.D + z) * this.H + y];
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return -1;
    const i = (x * this.D + z) * this.H + y;
    const before = this.blocks[i];
    if (before === id) return before;
    this.blocks[i] = id;
    this.onSet?.(x, y, z, before, id);
    return before;
  }

  // The y of the highest solid block in a column, or -1.
  top(x, z) {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D) return -1;
    const base = (x * this.D + z) * this.H;
    for (let y = this.H - 1; y >= 0; y--) if (SOLID[this.blocks[base + y]]) return y;
    return -1;
  }

  // The highest solid block at or below y, or -1.
  groundBelow(x, y, z) {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D) return -1;
    const base = (x * this.D + z) * this.H;
    for (let yy = Math.min(y, this.H - 1); yy >= 0; yy--) if (SOLID[this.blocks[base + yy]]) return yy;
    return -1;
  }

  meta() {
    return { W: this.W, H: this.H, D: this.D, sea: this.sea, theme: this.theme, seed: this.seed, name: this.name, spawn: { ...this.spawn } };
  }

  encode() {
    return encodeBlocks(this.blocks, this.W, this.H, this.D);
  }

  static decode(meta, data) {
    const m = normalizeMeta(meta);
    const blocks = decodeBlocks(data, m.W, m.H, m.D);
    return new World({ ...m, blocks });
  }

  clone() {
    return new World({ ...this.meta(), blocks: this.blocks.slice() });
  }
}

export function normalizeMeta(meta) {
  const int = (v, lo, hi, fallback) => (Number.isInteger(v) && v >= lo && v <= hi ? v : fallback);
  const W = int(meta?.W, 16, 512, 128);
  const H = int(meta?.H, 16, 128, 64);
  const D = int(meta?.D, 16, 512, 128);
  const sea = int(meta?.sea, 1, H - 2, Math.min(20, H - 2));
  const spawn = meta?.spawn;
  const finite = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
  return {
    W,
    H,
    D,
    sea,
    theme: ['sunny', 'snowy', 'candy', 'flat'].includes(meta?.theme) ? meta.theme : 'sunny',
    seed: Number.isInteger(meta?.seed) ? meta.seed >>> 0 : 1,
    name: typeof meta?.name === 'string' ? meta.name.slice(0, 40) : 'My Island',
    spawn: {
      x: finite(spawn?.x, 0.5, W - 0.5, W / 2),
      y: finite(spawn?.y, 1, H, sea + 4),
      z: finite(spawn?.z, 0.5, D - 0.5, D / 2),
    },
  };
}

// ---------------------------------------------------------------- encoding
// Runs of equal bytes as (block, length) pairs, the length as a varint, then
// base64. The cells are read layer by layer (y slowest), so the solid stone
// deep down and the empty sky above each come out as a handful of long runs.

function* layerOrder(W, H, D) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) yield (x * D + z) * H + y;
}

export function encodeBlocks(blocks, W, H, D) {
  const out = [];
  let prev = -1;
  let run = 0;
  const flush = () => {
    if (run === 0) return;
    out.push(prev);
    let n = run;
    while (n >= 0x80) {
      out.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    out.push(n);
  };
  for (const i of layerOrder(W, H, D)) {
    const id = blocks[i];
    if (id === prev) {
      run++;
    } else {
      flush();
      prev = id;
      run = 1;
    }
  }
  flush();
  return bytesToBase64(Uint8Array.from(out));
}

export function decodeBlocks(data, W, H, D) {
  if (typeof data !== 'string') throw new Error('The island data is missing.');
  const size = W * H * D;
  const bytes = base64ToBytes(data);
  const blocks = new Uint8Array(size);
  const order = layerOrder(W, H, D);
  let at = 0;
  let i = 0;
  while (i < bytes.length) {
    const raw = bytes[i++];
    let run = 0;
    let shift = 0;
    for (;;) {
      if (i >= bytes.length) throw new Error('The island data is cut short.');
      const b = bytes[i++];
      run += (b & 0x7f) * 2 ** shift;
      if (!(b & 0x80)) break;
      shift += 7;
      if (shift > 35) throw new Error('The island data is damaged.');
    }
    if (run < 1 || at + run > size) throw new Error('The island data does not fit this island.');
    const id = isKnown(raw) ? raw : AIR;
    for (let k = 0; k < run; k++) blocks[order.next().value] = id;
    at += run;
  }
  if (at !== size) throw new Error('The island data is incomplete.');
  return blocks;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

export function bytesToBase64(bytes) {
  const parts = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    chunk += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

export function base64ToBytes(text) {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64_INDEX[clean.charCodeAt(i)];
    const b = B64_INDEX[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_INDEX[clean.charCodeAt(i + 2)] : -1;
    const d = i + 3 < clean.length ? B64_INDEX[clean.charCodeAt(i + 3)] : -1;
    if (a < 0 || b < 0) break;
    out[o++] = (a << 2) | (b >> 4);
    if (c < 0) break;
    out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d < 0) break;
    out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}
