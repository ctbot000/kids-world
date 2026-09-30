// Light, Minecraft style: every cell holds a sky level (0-15, how much
// daylight reaches it) and a lamp level (0-15, from lamps and glowing
// blocks). Sunlight falls straight down without fading and spreads sideways
// one level per step; lamp light fades one level per step in every
// direction. The renderer turns the two into brightness depending on the
// time of day, so lamps glow at night and houses are cosy inside.
import { EMIT, OPAQUE, WATER } from './blocks.js';

export class LightMap {
  constructor(world) {
    this.world = world;
    const n = world.W * world.H * world.D;
    this.sky = new Uint8Array(n);
    this.lamp = new Uint8Array(n);
    this.queue = new Int32Array(n * 2 + 16);
  }

  // Light for a cell, as the renderer sees it: outside the world is full sky.
  skyAt(x, y, z) {
    const w = this.world;
    if (y >= w.H) return 15;
    if (y < 0) return 0;
    if (x < 0 || z < 0 || x >= w.W || z >= w.D) return y > w.sea ? 15 : 12;
    return this.sky[(x * w.D + z) * w.H + y];
  }

  lampAt(x, y, z) {
    const w = this.world;
    if (y < 0 || y >= w.H || x < 0 || z < 0 || x >= w.W || z >= w.D) return 0;
    return this.lamp[(x * w.D + z) * w.H + y];
  }

  computeAll() {
    const w = this.world;
    this.relight(0, 0, w.W - 1, w.D - 1, false);
  }

  // Recomputes light in the columns [x0..x1] x [z0..z1]. Cells just outside
  // keep their light and shine in. Returns the chunks whose light changed,
  // as a Set of "cx,cz" keys, when `diff` is set.
  relight(x0, z0, x1, z1, diff = true) {
    const w = this.world;
    const { W, H, D } = w;
    x0 = Math.max(0, x0);
    z0 = Math.max(0, z0);
    x1 = Math.min(W - 1, x1);
    z1 = Math.min(D - 1, z1);
    const blocks = w.blocks;
    const sky = this.sky;
    const lamp = this.lamp;
    const changed = new Set();
    let oldSky = null;
    let oldLamp = null;
    const nx = x1 - x0 + 1;
    const nz = z1 - z0 + 1;
    if (diff) {
      oldSky = new Uint8Array(nx * nz * H);
      oldLamp = new Uint8Array(nx * nz * H);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const base = (x * D + z) * H;
          const o = ((x - x0) * nz + (z - z0)) * H;
          oldSky.set(sky.subarray(base, base + H), o);
          oldLamp.set(lamp.subarray(base, base + H), o);
        }
      }
    }

    // Seed: sunlight straight down each column, and every glowing block.
    const q = this.queue;
    let head = 0;
    let tail = 0;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const base = (x * D + z) * H;
        let level = 15;
        for (let y = H - 1; y >= 0; y--) {
          const i = base + y;
          const id = blocks[i];
          if (OPAQUE[id]) level = 0;
          else if (id === WATER && level > 0) level = Math.max(0, level - 1);
          sky[i] = level;
          lamp[i] = EMIT[id];
          if (level > 1 || EMIT[id] > 1) q[tail++] = i;
        }
      }
    }
    // Neighbours just outside the region shine in.
    const ring = (x, z) => {
      if (x < 0 || z < 0 || x >= W || z >= D) return;
      const base = (x * D + z) * H;
      for (let y = 0; y < H; y++) if (sky[base + y] > 1 || lamp[base + y] > 1) q[tail++] = base + y;
    };
    if (x0 > 0 || x1 < W - 1 || z0 > 0 || z1 < D - 1) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        ring(x, z0 - 1);
        ring(x, z1 + 1);
      }
      for (let z = z0; z <= z1; z++) {
        ring(x0 - 1, z);
        ring(x1 + 1, z);
      }
    }

    // Spread, never writing outside the region.
    const strideX = D * H;
    while (head < tail) {
      const i = q[head++];
      if (head === q.length) head = 0;
      const y = i % H;
      const col = (i - y) / H;
      const z = col % D;
      const x = (col - z) / D;
      const s = sky[i];
      const l = lamp[i];
      for (let dir = 0; dir < 6; dir++) {
        let j;
        let xx = x;
        let yy = y;
        let zz = z;
        switch (dir) {
          case 0:
            xx++;
            j = i + strideX;
            break;
          case 1:
            xx--;
            j = i - strideX;
            break;
          case 2:
            zz++;
            j = i + H;
            break;
          case 3:
            zz--;
            j = i - H;
            break;
          case 4:
            yy++;
            j = i + 1;
            break;
          default:
            yy--;
            j = i - 1;
        }
        if (xx < x0 || xx > x1 || zz < z0 || zz > z1 || yy < 0 || yy >= H) continue;
        const id = blocks[j];
        if (OPAQUE[id]) continue;
        const cost = id === WATER ? 2 : 1;
        let pushed = false;
        const ns = dir === 5 && s === 15 && id !== WATER ? 15 : s - cost;
        if (ns > sky[j]) {
          sky[j] = ns;
          pushed = true;
        }
        const nl = l - cost;
        if (nl > lamp[j]) {
          lamp[j] = nl;
          pushed = true;
        }
        if (pushed) {
          q[tail++] = j;
          if (tail === q.length) tail = 0;
        }
      }
    }

    if (diff) {
      const CH = 16;
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const key = `${Math.floor(x / CH)},${Math.floor(z / CH)}`;
          if (changed.has(key)) continue;
          const base = (x * D + z) * H;
          const o = ((x - x0) * nz + (z - z0)) * H;
          for (let y = 0; y < H; y++) {
            if (sky[base + y] !== oldSky[o + y] || lamp[base + y] !== oldLamp[o + y]) {
              changed.add(key);
              // Faces in the neighbouring chunks sample this column's light too.
              if (x % CH === 0) changed.add(`${Math.floor(x / CH) - 1},${Math.floor(z / CH)}`);
              if (x % CH === CH - 1) changed.add(`${Math.floor(x / CH) + 1},${Math.floor(z / CH)}`);
              if (z % CH === 0) changed.add(`${Math.floor(x / CH)},${Math.floor(z / CH) - 1}`);
              if (z % CH === CH - 1) changed.add(`${Math.floor(x / CH)},${Math.floor(z / CH) + 1}`);
              break;
            }
          }
        }
      }
    }
    return changed;
  }
}

export const LIGHT_REACH = 15;
