// Adventure Isle's own maps: every chapter of its story (isle-story.js) is
// a corner of the isle drawn by hand rather than a random island. Each map
// is a way to go: from where everyone arrives, along a path, through each
// monster camp in turn, to King Grumble's lair at the end. Between one camp
// and the next a gate is shut across the path — crates, brambles, ice, a
// wall of gummy — and freeing the camp before it opens it (the room does,
// adventure.js gates), so the isle is crossed one camp at a time, like a
// real journey, and anyone out of hearts comes back at the last camp freed.
//
// A map is made the way a real island is (worldgen.js), but from a plan:
// the land's heights first (with the chapter's hills, cliffs, rivers and
// shores), then the path laid along its way (levelled into the land, over
// bridges and through tunnels), the blocks, the landmarks, the camps and the
// lair (adventure.js builds those), the gates, and last the trees, flowers
// and animals. The plans are in island blocks on a cozy island 128 across.
// The same stage of the same journey is the same island (its seed), and a
// chapter told again on a later journey is its own map turned over, so the
// way goes the other way round (see mirror).
import * as B from './blocks.js';
import { CAMP_RADIUS, CASTLE_RADIUS, campFence, castleWalls, flatten, groundMap } from './adventure.js';
import { CRITTER_INFO, placeFlyers, placePolar, placeSea } from './critters.js';
import { chapterOf } from './isle-story.js';
import { fbm } from './noise.js';
import { hash2, Rng } from './rng.js';
import { candyTree, fruitTree, oakTree, pineTree, placeTemplate, stampByKey } from './stamps.js';
import { World } from './world.js';
import { palette } from './worldgen.js';

export const ISLE_SIDE = 128;
const SEA = 20;
const H = 64;
const [RED, ORANGE, YELLOW, LIME, GREEN, TEAL, SKY, BLUE, PURPLE, LAVENDER, PINK, WHITE, GRAY, CHARCOAL, BROWN, TAN] = B.TOY_BRICKS;
const WHITE_CLOTH = B.CLOTHS[7];

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
// A soft round hill: 1 in the middle, 0 at radius r and beyond.
const bump = (x, z, cx, cz, r) => smooth(1 - Math.hypot(x - cx, z - cz) / r);
// How far inside an ellipse: 1 in the middle, 0 on its edge, below 0 out.
const inside = (x, z, cx, cz, rx, rz) => 1 - Math.hypot((x - cx) / rx, (z - cz) / rz);
const catmull = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
// The camera yaw looking from (x, z) towards (tx, tz): yaw 0 looks to -z.
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
// The stamp facing (stamps.js FACING) that turns a stamp's front, where its
// door is, towards (tx, tz) from (x, z).
function facingTo(x, z, tx, tz) {
  const dx = tx - x;
  const dz = tz - z;
  if (Math.abs(dz) >= Math.abs(dx)) return dz < 0 ? 0 : 2;
  return dx < 0 ? 1 : 3;
}

// What stands on the land and is not the land: everything a map builds.
const SOFT = new Uint8Array(B.BLOCK_IDS);
for (let id = 0; id < B.BLOCK_IDS; id++) if (B.KIND[id] === B.K_PLANT || B.KIND[id] === B.K_ITEM) SOFT[id] = 1;
SOFT[B.AIR] = 1;

// ---------------------------------------------------------------- the maker

// One map in the making: its heights, then its blocks.
class Maker {
  constructor(chapter, seed) {
    this.ch = chapter;
    this.seed = seed;
    this.S = ISLE_SIDE;
    this.sea = SEA;
    this.rng = new Rng(seed);
    this.pal = { ...palette(chapter.theme), ...(chapter.pal ?? {}) };
    const n = this.S * this.S;
    // The ground's height in each column, before it is blocks; what its top
    // is (0: as the island's kind says); the water standing over it (a pond
    // or river above the sea: its top, 0 for none); and what must stay clear
    // of trees and the like (1: the path, 2: beside it or a camp, 3: built on).
    this.h = new Float32Array(n).fill(SEA - 6);
    this.top = new Uint16Array(n);
    this.under = new Uint16Array(n);
    this.water = new Int16Array(n);
    this.keep = new Uint8Array(n);
    // Where no tree may reach over at all: round the walls and the gates, so
    // that no crown makes a way over them.
    this.bare = new Uint8Array(n);
    this.world = new World({ W: this.S, H, D: this.S, sea: SEA, theme: chapter.theme, seed, name: 'Adventure Isle' });
    this.bridges = [];
    this.tunnels = [];
    this.spots = [];
    this.gates = [];
    this.critters = [];
    this.routes = [];
    this.jobs = [];
  }

  // Something to build once the land is blocks (a house on a levelled pad).
  later(job) {
    this.jobs.push(job);
  }

  // The land into blocks, then the bridges and tunnels, everything put off
  // till then, and the camps and the lair.
  finish() {
    this.raster();
    this.ways();
    for (const job of this.jobs) job();
    this.jobs = [];
    this.buildCamps();
  }

  k(x, z) {
    return x * this.S + z;
  }

  inside(x, z, pad = 1) {
    return x >= pad && z >= pad && x < this.S - pad && z < this.S - pad;
  }

  hAt(x, z) {
    const cx = Math.max(0, Math.min(this.S - 1, Math.round(x)));
    const cz = Math.max(0, Math.min(this.S - 1, Math.round(z)));
    return this.h[this.k(cx, cz)];
  }

  // Every column's height from fn(x, z).
  shape(fn) {
    for (let x = 0; x < this.S; x++) for (let z = 0; z < this.S; z++) this.h[this.k(x, z)] = fn(x, z);
  }

  // A level patch at height y over the rectangle round (cx, cz) (half sizes
  // rx, rz), blending back into the land over `blend` blocks.
  level(cx, cz, rx, rz, y, blend = 4, keep = 0) {
    for (let x = Math.floor(cx - rx - blend); x <= Math.ceil(cx + rx + blend); x++) {
      for (let z = Math.floor(cz - rz - blend); z <= Math.ceil(cz + rz + blend); z++) {
        if (!this.inside(x, z, 0)) continue;
        const d = Math.max(Math.abs(x + 0.5 - cx) - rx, Math.abs(z + 0.5 - cz) - rz, 0);
        const k = this.k(x, z);
        this.h[k] = lerp(y, this.h[k], smooth(d / blend));
        if (keep && d <= 0) this.keep[k] = Math.max(this.keep[k], keep);
      }
    }
  }

  // A round level patch, the same way.
  disc(cx, cz, r, y, blend = 4, keep = 0) {
    for (let x = Math.floor(cx - r - blend); x <= Math.ceil(cx + r + blend); x++) {
      for (let z = Math.floor(cz - r - blend); z <= Math.ceil(cz + r + blend); z++) {
        if (!this.inside(x, z, 0)) continue;
        const d = Math.max(0, Math.hypot(x + 0.5 - cx, z + 0.5 - cz) - r);
        const k = this.k(x, z);
        this.h[k] = lerp(y, this.h[k], smooth(d / blend));
        if (keep && d <= 0) this.keep[k] = Math.max(this.keep[k], keep);
      }
    }
  }

  // A river or channel along points [x, z]: its bed `depth` below the water,
  // whose top is at `top` (the sea's, or higher for a stream in the hills),
  // `width` across, with banks easing back into the land.
  river(points, { width = 3, top = SEA, depth = 3, bank = 4 } = {}) {
    const samples = spline(points, 0.5);
    const near = new Float32Array(this.S * this.S).fill(Infinity);
    for (const p of samples) {
      const r = width / 2 + bank;
      for (let x = Math.floor(p.x - r); x <= Math.ceil(p.x + r); x++) {
        for (let z = Math.floor(p.z - r); z <= Math.ceil(p.z + r); z++) {
          if (!this.inside(x, z, 0)) continue;
          const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
          const k = this.k(x, z);
          if (d < near[k]) near[k] = d;
        }
      }
    }
    for (let k = 0; k < near.length; k++) {
      const d = near[k];
      if (d === Infinity) continue;
      if (d <= width / 2) {
        this.h[k] = Math.min(this.h[k], top - depth);
        if (top > SEA) this.water[k] = Math.max(this.water[k], top);
      } else {
        const t = smooth((d - width / 2) / bank);
        this.h[k] = Math.min(this.h[k], lerp(top - 1, Math.max(this.h[k], top + 0.5), t));
        if (top > SEA && this.h[k] < top) this.water[k] = Math.max(this.water[k], top);
      }
    }
  }

  // How far each column is from a smooth line through [x, z] points (to
  // `reach`; Infinity beyond), for shaping a canyon or a road along it.
  field(points, reach) {
    const out = new Float32Array(this.S * this.S).fill(Infinity);
    for (const p of spline(points, 0.5)) {
      for (let x = Math.floor(p.x - reach); x <= Math.ceil(p.x + reach); x++) {
        for (let z = Math.floor(p.z - reach); z <= Math.ceil(p.z + reach); z++) {
          if (!this.inside(x, z, 0)) continue;
          const k = this.k(x, z);
          out[k] = Math.min(out[k], Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z));
        }
      }
    }
    return out;
  }

  // A stream running down the land along [x, z] points (a river of lava on a
  // volcano): sunk `depth` into the land as it lies along its way, its top a
  // block under the land's, so it pours downhill with the slope.
  channel(points, { width = 3, depth = 2 } = {}) {
    const samples = spline(points, 0.5);
    const along = samples.map((p) => this.hAt(p.x, p.z));
    for (let i = 1; i < along.length; i++) along[i] = Math.min(along[i], along[i - 1]);
    const near = new Float32Array(this.S * this.S).fill(Infinity);
    const at = new Int32Array(this.S * this.S).fill(-1);
    samples.forEach((p, i) => {
      for (let x = Math.floor(p.x - width); x <= Math.ceil(p.x + width); x++) {
        for (let z = Math.floor(p.z - width); z <= Math.ceil(p.z + width); z++) {
          if (!this.inside(x, z, 0)) continue;
          const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
          const k = this.k(x, z);
          if (d < near[k]) {
            near[k] = d;
            at[k] = i;
          }
        }
      }
    });
    for (let k = 0; k < near.length; k++) {
      if (near[k] > width / 2) continue;
      const top = Math.round(along[at[k]]) - 1;
      if (top <= SEA) continue;
      this.h[k] = Math.min(this.h[k], top - depth);
      this.water[k] = top;
    }
  }

  // A pond: water at `top` over a bowl round (cx, cz).
  pond(cx, cz, r, top, depth = 2) {
    for (let x = Math.floor(cx - r - 3); x <= Math.ceil(cx + r + 3); x++) {
      for (let z = Math.floor(cz - r - 3); z <= Math.ceil(cz + r + 3); z++) {
        if (!this.inside(x, z, 0)) continue;
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / r;
        const k = this.k(x, z);
        if (d <= 1) {
          this.h[k] = Math.min(this.h[k], top - 1 - Math.round(depth * (1 - d * d)));
          this.water[k] = top;
        } else {
          this.h[k] = Math.max(this.h[k], lerp(top + 0.6, this.h[k], smooth((d - 1) * r / 3)));
        }
      }
    }
  }

  // The way through the map: a path along the nodes, each { x, z } and
  // maybe y (its height there, as at a camp), bridge or tunnel (the way on
  // from that node to the next goes over a bridge, or through a tunnel).
  // It is levelled into the land, never climbing more than `slope` a block
  // on its own, with the land beside it easing down or up to it.
  route(nodes, { width = 1.5, blend = 5, slope = 0.55, mat = this.pal.path ?? B.PEBBLES, boardwalk = false } = {}) {
    const S = this.S;
    const pts = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const p0 = nodes[Math.max(0, i - 1)];
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      const p3 = nodes[Math.min(nodes.length - 1, i + 2)];
      // Straight over a bridge and through a tunnel.
      const straight = p1.bridge || p1.tunnel;
      const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const n = Math.max(2, Math.ceil(len / 0.4));
      for (let j = 0; j < n; j++) {
        const t = j / n;
        const x = straight ? lerp(p1.x, p2.x, t) : catmull(p0.x, p1.x, p2.x, p3.x, t);
        const z = straight ? lerp(p1.z, p2.z, t) : catmull(p0.z, p1.z, p2.z, p3.z, t);
        pts.push({ x, z, node: j === 0 ? i : -1, bridge: Boolean(p1.bridge), tunnel: Boolean(p1.tunnel), fixed: j === 0 && Number.isFinite(p1.y) ? p1.y : null });
      }
    }
    const last = nodes.at(-1);
    pts.push({ x: last.x, z: last.z, node: nodes.length - 1, bridge: false, tunnel: false, fixed: Number.isFinite(last.y) ? last.y : null });
    // Over the water on a boardwalk, wherever the way crosses it (a marsh's).
    if (boardwalk) {
      for (const p of pts) {
        const k = this.k(Math.max(0, Math.min(S - 1, Math.floor(p.x))), Math.max(0, Math.min(S - 1, Math.floor(p.z))));
        if (p.fixed === null && (this.h[k] < SEA + 0.5 || this.water[k] > this.h[k])) p.bridge = true;
      }
    }
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      pts[i].s = s;
    }
    // The land's own height along the way (never below the shore), smoothed.
    const raw = pts.map((p) => Math.max(SEA + 1, this.hAt(p.x, p.z)));
    const smoothed = raw.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - 12); j <= Math.min(raw.length - 1, i + 12); j++) {
        sum += raw[j];
        n++;
      }
      return sum / n;
    });
    // A camp's ground is level out past its fence (and the lair's, at the
    // end of the way, further): the way is at its height all over it.
    const holds = nodes.map((n, i) => (Number.isFinite(n.y) ? { x: n.x, z: n.z, y: n.y, r: i === nodes.length - 1 ? 12.5 : 11 } : null)).filter(Boolean);
    for (const p of pts) {
      const h = holds.find((o) => Math.hypot(p.x - o.x, p.z - o.z) <= o.r);
      if (h && p.fixed === null && !p.bridge && !p.tunnel) p.fixed = h.y;
    }
    // Through the heights it must be at, following the land between.
    const fixed = pts.map((p, i) => (p.fixed !== null ? i : -1)).filter((i) => i >= 0);
    const target = smoothed.slice();
    if (fixed.length) {
      for (let i = 0; i < pts.length; i++) {
        const a = [...fixed].reverse().find((f) => f <= i);
        const b = fixed.find((f) => f >= i);
        const off = (f) => pts[f].fixed - smoothed[f];
        if (a === undefined) target[i] = smoothed[i] + off(b);
        else if (b === undefined || a === b) target[i] = smoothed[i] + off(a);
        else target[i] = smoothed[i] + lerp(off(a), off(b), (pts[i].s - pts[a].s) / Math.max(1e-6, pts[b].s - pts[a].s));
      }
    }
    // Bridges and tunnels run straight from one end to the other.
    for (let i = 0; i < pts.length; i++) {
      if (!(pts[i].bridge || pts[i].tunnel) || pts[i].node < 0) continue;
      let j = i;
      while (j < pts.length - 1 && (pts[j].bridge || pts[j].tunnel) && (j === i || pts[j].node < 0)) j++;
      for (let q = i; q <= j; q++) target[q] = lerp(target[i], target[j], (pts[q].s - pts[i].s) / Math.max(1e-6, pts[j].s - pts[i].s));
    }
    // Never steeper than a walk up: first within reach of the heights it
    // must be at either side (so it gets there in time), then from one
    // point to the next — never moving those heights themselves.
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].fixed !== null) continue;
      const a = [...fixed].reverse().find((f) => f < i);
      const b = fixed.find((f) => f > i);
      let lo = -Infinity;
      let hi = Infinity;
      for (const f of [a, b]) {
        if (f === undefined) continue;
        const d = Math.abs(pts[i].s - pts[f].s) * slope;
        lo = Math.max(lo, pts[f].fixed - d);
        hi = Math.min(hi, pts[f].fixed + d);
      }
      if (lo <= hi) target[i] = Math.max(lo, Math.min(hi, target[i]));
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].fixed !== null) continue;
        const ds = pts[i].s - pts[i - 1].s;
        target[i] = Math.max(target[i - 1] - slope * ds, Math.min(target[i - 1] + slope * ds, target[i]));
      }
      for (let i = pts.length - 2; i >= 0; i--) {
        if (pts[i].fixed !== null) continue;
        const ds = pts[i + 1].s - pts[i].s;
        target[i] = Math.max(target[i + 1] - slope * ds, Math.min(target[i + 1] + slope * ds, target[i]));
      }
    }
    pts.forEach((p, i) => (p.y = Math.round(target[i])));
    // The first way laid starts where everyone arrives: level ground there,
    // kept clear.
    if (!this.routes.length) {
      this.disc(pts[0].x, pts[0].z, 2.5, pts[0].y, 3, 2);
      this.claim(pts[0].x, pts[0].z, 6, 2);
    }
    // Into the land: the nearest bit of the way sets each column's height.
    const near = new Float32Array(S * S).fill(Infinity);
    const at = new Int32Array(S * S).fill(-1);
    const reach = width + blend;
    pts.forEach((p, i) => {
      for (let x = Math.floor(p.x - reach); x <= Math.ceil(p.x + reach); x++) {
        for (let z = Math.floor(p.z - reach); z <= Math.ceil(p.z + reach); z++) {
          if (!this.inside(x, z, 0)) continue;
          const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
          const k = this.k(x, z);
          if (d < near[k]) {
            near[k] = d;
            at[k] = i;
          }
        }
      }
    });
    for (let k = 0; k < S * S; k++) {
      if (at[k] < 0) continue;
      const p = pts[at[k]];
      const d = near[k];
      if (p.bridge || p.tunnel) {
        if (d <= width + 0.6) this.keep[k] = Math.max(this.keep[k], 1);
        continue;
      }
      if (d <= width) {
        this.h[k] = p.y;
        this.top[k] = mat;
        this.keep[k] = Math.max(this.keep[k], 1);
        this.water[k] = 0;
      } else {
        // (With no blend, the land beside the way stays as it was: a cut
        // through a cliff has sheer sides, with no steps up them.)
        const t = blend ? smooth((d - width) / blend) : 1;
        this.h[k] = lerp(p.y, this.h[k], t);
        if (this.h[k] >= p.y - 0.5 && this.water[k] && this.water[k] <= this.h[k]) this.water[k] = 0;
        if (d <= width + 2) this.keep[k] = Math.max(this.keep[k], 2);
      }
    }
    for (const p of pts) {
      if (p.bridge) this.bridges.push(p);
      if (p.tunnel) this.tunnels.push(p);
    }
    this.routes.push({ pts, width, mat });
    return pts;
  }

  // Where along a route a node is (its first point; or `ahead` blocks on
  // from it), and the way it heads.
  along(pts, node, ahead = 0) {
    const n = pts.findIndex((p) => p.node === node);
    let i = n;
    while (i < pts.length - 1 && pts[i].s - pts[n].s < ahead) i++;
    const a = pts[Math.max(0, i - 2)];
    const b = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { ...pts[i], i, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len };
  }

  // ------------------------------------------------ blocks

  // The heights into blocks: rock deep down, the layer under the top and the
  // top itself (sand on the shore, rock on a cliff, the island's own ground
  // elsewhere, or whatever the plan said), and the sea or a pond's water.
  raster() {
    const { S, world, pal } = this;
    const g = new Int16Array(S * S);
    for (let k = 0; k < S * S; k++) g[k] = Math.max(2, Math.min(H - 12, Math.round(this.h[k])));
    this.g = g;
    const liquid = this.ch.theme === 'volcano' ? B.LAVA : B.WATER;
    for (let x = 0; x < S; x++) {
      for (let z = 0; z < S; z++) {
        const k = this.k(x, z);
        const y0 = g[k];
        let steep = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx;
          const zz = z + dz;
          if (xx < 0 || zz < 0 || xx >= S || zz >= S) continue;
          steep = Math.max(steep, y0 - g[this.k(xx, zz)]);
        }
        const beach = y0 <= SEA + 1 && !this.ch.noBeach && !this.water[k];
        let top = this.top[k] || (beach ? pal.beach : steep >= 3 ? pal.cliff ?? B.STONE : y0 > SEA + (pal.rockAt ?? 15) + hash2(this.seed, x, z) * 3 ? pal.rock ?? B.STONE : pal.top);
        if (!this.top[k] && pal.peak && y0 > SEA + pal.peakAt + hash2(this.seed + 1, x, z) * 2) top = pal.peak;
        const under = this.under[k] || (beach ? pal.beach : top === B.STONE || top === pal.cliff ? pal.deep : pal.under);
        world.set(x, 0, z, B.MAGIC_FLOOR);
        for (let y = 1; y <= y0; y++) world.set(x, y, z, y === y0 ? top : y >= y0 - 3 ? under : pal.deep);
        for (let y = y0 + 1; y <= SEA; y++) world.set(x, y, z, liquid);
        if (this.water[k] > SEA) for (let y = y0 + 1; y <= this.water[k]; y++) world.set(x, y, z, this.ch.theme === 'volcano' && this.lavaPools ? B.LAVA : B.WATER);
      }
    }
    // A raised pond's water never stands beside thin air: a rim round it.
    for (let x = 0; x < S; x++) {
      for (let z = 0; z < S; z++) {
        const top = this.water[this.k(x, z)];
        if (top <= SEA) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx;
          const zz = z + dz;
          // (A lower step of the same stream has water of its own.)
          if (!this.inside(xx, zz, 0) || this.water[this.k(xx, zz)]) continue;
          for (let y = world.top(xx, zz) + 1; y <= top; y++) world.set(xx, y, zz, y === top ? pal.top : pal.under);
        }
      }
    }
  }

  // The ground's top in a column now (not counting trees), or -1.
  ground(x, z) {
    for (let y = H - 1; y > 0; y--) {
      const id = this.world.get(x, y, z);
      if (B.SOLID[id] && !B.TREE_PART[id]) return y;
    }
    return -1;
  }

  // Bridges: a deck of planks over the water (or a gap) with a fence along
  // each side, standing on posts; tunnels: room to walk through the rock,
  // lamps in the roof.
  ways() {
    const { world } = this;
    for (const route of this.routes) {
      const { pts, width } = route;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!p.bridge && !p.tunnel) continue;
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const px = -(b.z - a.z) / len;
        const pz = (b.x - a.x) / len;
        for (let o = -(width + 1); o <= width + 1; o += 0.5) {
          const x = Math.floor(p.x + px * o);
          const z = Math.floor(p.z + pz * o);
          if (!this.inside(x, z, 0)) continue;
          const edge = Math.abs(o) > width + 0.25;
          if (p.bridge) {
            for (let y = p.y + 1; y <= p.y + 4; y++) if (world.get(x, y, z) !== B.AIR && (!edge || !B.SOLID[world.get(x, y, z)])) world.set(x, y, z, B.AIR);
            world.set(x, p.y, z, this.pal.deck ?? B.PLANKS);
            const rail = this.pal.rail ?? B.FENCE;
            if (edge && rail && world.get(x, p.y + 1, z) === B.AIR) world.set(x, p.y + 1, z, rail);
          } else if (this.g[this.k(x, z)] >= p.y + 6) {
            // Under the rock: walls and a roof.
            for (let y = p.y + 1; y <= p.y + 4; y++) world.set(x, y, z, edge ? this.pal.wall ?? B.STONE : B.AIR);
            world.set(x, p.y, z, route.mat);
            world.set(x, p.y + 5, z, this.pal.roof ?? B.PLANKS);
          } else if (!edge) {
            // Out in the open again: a cutting.
            for (let y = p.y + 1; y <= Math.max(p.y + 4, this.g[this.k(x, z)]); y++) world.set(x, y, z, B.AIR);
            world.set(x, p.y, z, route.mat);
          }
        }
        // Posts down to the bed under a bridge, every few blocks.
        if (p.bridge && i % 9 === 0) {
          for (const o of [-(width + 1), width + 1]) {
            const x = Math.floor(p.x + px * o);
            const z = Math.floor(p.z + pz * o);
            for (let y = p.y - 1; y > 0 && !B.SOLID[world.get(x, y, z)]; y--) world.set(x, y, z, B.WOOD);
            world.set(x, p.y + 1, z, B.WOOD);
            if (i % 18 === 0) world.set(x, p.y + 2, z, B.LAMP);
          }
        }
        if (p.tunnel && i % 12 === 6 && this.g[this.k(Math.floor(p.x), Math.floor(p.z))] >= p.y + 6) world.set(Math.floor(p.x), p.y + 5, Math.floor(p.z), B.LAMP);
      }
    }
  }

  // A stamp (stamps.js) on level ground at (x, z), its door facing (tx, tz).
  stamp(key, x, z, tx, tz) {
    const s = stampByKey(key);
    if (!s) return;
    const y = this.ground(Math.round(x), Math.round(z)) + 1;
    this.cells(placeTemplate(s.cells, Math.round(x), y, Math.round(z), facingTo(x, z, tx, tz)));
  }

  cells(list) {
    for (const [x, y, z, id] of list) if (this.world.inBounds(x, y, z)) this.world.set(x, y, z, id);
  }

  // Marks the round (cx, cz) radius r as built on (no trees there).
  claim(cx, cz, r, kind = 3) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        if (this.inside(x, z, 0) && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) this.keep[this.k(x, z)] = Math.max(this.keep[this.k(x, z)], kind);
      }
    }
  }

  // ------------------------------------------------ the camps

  // A camp (or the lair, square) at the node of a route: levelled where the
  // path is there. ways: the angles the path comes in and goes out by.
  camp(pts, node, { kind = 'camp', style = {}, blend = 5 } = {}) {
    const p = this.along(pts, node);
    const r = kind === 'castle' ? CASTLE_RADIUS : CAMP_RADIUS;
    const cx = Math.floor(p.x);
    const cz = Math.floor(p.z);
    const before = pts[Math.max(0, p.i - 14)];
    const after = pts[Math.min(pts.length - 1, p.i + 14)];
    const spot = { cx, cz, x: cx + 0.5, z: cz + 0.5, level: p.y, r, square: kind === 'castle', bound: kind === 'castle' ? (r + 3) * Math.SQRT2 : r + 3, kind, style, ways: [Math.atan2(before.z - p.z, before.x - p.x), Math.atan2(after.z - p.z, after.x - p.x)], from: before };
    this.spots.push(spot);
    if (kind === 'castle') this.level(spot.x, spot.z, r + 2, r + 2, p.y, blend, 2);
    else this.disc(spot.x, spot.z, r + 1.5, p.y, blend, 2);
    this.claim(spot.x, spot.z, kind === 'castle' ? (r + 4) * Math.SQRT2 : r + 4, 2);
    return spot;
  }

  // The camps and the lair built: levelled, gloomy, fenced or walled.
  buildCamps() {
    const map = groundMap(this.world);
    const rng = new Rng(this.seed ^ 0x6a09e667);
    for (const s of this.spots) {
      flatten(this.world, map, this.pal, s);
      if (s.kind === 'castle') {
        const dx = s.from.x - s.x;
        const dz = s.from.z - s.z;
        castleWalls(this.world, s, Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1], s.style);
      } else {
        campFence(this.world, rng, s, s.ways, s.style);
      }
    }
  }

  // ------------------------------------------------ the gates

  // A gate across the path at a node, opened when camp `camp` is freed: a
  // barricade `high` blocks high and `thick` thick over the path and a
  // little either side (`span`), of blocks from make(x, y, z, i) (i counting
  // up from the path), and a wall on from each end of it that stays (of
  // `wall`, `wallHigh` blocks over the ground, out to `reach` either side or
  // until it meets water or land as high as it): a wall with a gate in it.
  // Opened, the barricade's cells are air again (or what open(x, y, z) says).
  // walls: lines of [x, z] points the wall runs on along from the gate's
  // ends (each from the end nearer its first point) instead, to the coast or
  // wherever they shut the next part of the way off (barrier).
  // mid: halfway over the bridge (or through the tunnel) that starts at the
  // node, where there is no stepping round it from the bank.
  gate(pts, node, camp, make, { high = 4, span = 2.5, thick = 2, wall = 0, wallHigh = 2, reach = 10, walls = null, ahead = 0, mid = false, open = () => B.AIR } = {}) {
    if (mid) {
      const a = pts.find((q) => q.node === node);
      const b = pts.find((q) => q.node === node + 1);
      ahead = (b.s - a.s) / 2;
    }
    const p = this.along(pts, node, ahead);
    const px = -p.dz;
    const pz = p.dx;
    const cells = [];
    const seen = new Set();
    if (walls) {
      const ends = [1, -1].map((s) => [p.x + px * s * (span + 0.5), p.z + pz * s * (span + 0.5)]);
      for (const line of walls) {
        const end = ends.reduce((a, b) => (Math.hypot(b[0] - line[0][0], b[1] - line[0][1]) < Math.hypot(a[0] - line[0][0], a[1] - line[0][1]) ? b : a));
        this.barrier([end, ...line], wall, { high: wallHigh });
      }
      wall = 0;
    }
    for (let t = 0; t < thick; t++) {
      for (const side of [1, -1]) {
        for (let o = side > 0 ? 0 : -0.5; Math.abs(o) <= (wall ? reach : span); o += side * 0.5) {
          const x = Math.floor(p.x + p.dx * t + px * o);
          const z = Math.floor(p.z + p.dz * t + pz * o);
          const key = `${x},${z}`;
          if (seen.has(key) || !this.inside(x, z)) continue;
          seen.add(key);
          const g = this.ground(x, z);
          const wet = this.world.get(x, g + 1, z) === B.WATER || this.world.get(x, g + 1, z) === B.LAVA;
          if (Math.abs(o) <= span) {
            // The floor under the gate (in a tunnel, not the hill over it).
            const floor = this.world.groundBelow(x, p.y + high, z);
            if (floor >= p.y + high) break;
            // Down to the ground where it is lower than the path (beside a
            // ramp), leaving no gap to crawl under.
            for (let y = Math.max(floor + 1, p.y - 8); y <= p.y + high; y++) {
              const id = make(x, y, z, y - p.y - 1);
              if (!id || !SOFT[this.world.get(x, y, z)]) continue;
              this.world.set(x, y, z, id);
              cells.push(x, y, z, open(x, y, z));
            }
          } else {
            if (wet || g >= p.y + high + wallHigh - 1 || g < SEA) break;
            for (let y = g + 1; y <= g + wallHigh; y++) if (SOFT[this.world.get(x, y, z)]) this.world.set(x, y, z, typeof wall === 'function' ? wall(x, y, z, y - g - 1) : wall);
            this.keep[this.k(x, z)] = Math.max(this.keep[this.k(x, z)], 3);
            this.clear(x + 0.5, z + 0.5, 2.5);
          }
        }
      }
    }
    this.gates.push({ camp, x: Math.floor(p.x), y: p.y + 1, z: Math.floor(p.z), cells });
    this.claim(p.x, p.z, 3, 1);
    this.clear(p.x, p.z, span + 3);
  }

  // A wall over the land along [x, z] points, `high` blocks over the ground
  // all along (too high to jump), of `mat` (or mat(x, y, z, i), i counting
  // up from the ground): with the coast and the other walls, it shuts one
  // part of the way off from the next but for the gate where the path goes
  // through it. Never on the path itself (the gate is there) nor in water.
  // water: it stands in a river too, up out of the water (so there is no
  // swimming through it).
  barrier(points, mat, { high = 3, water = false } = {}) {
    const done = new Set();
    for (const p of spline(points, 0.4)) {
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1]]) {
        const x = Math.floor(p.x) + ox;
        const z = Math.floor(p.z) + oz;
        const key = `${x},${z}`;
        if (done.has(key) || !this.inside(x, z, 0)) continue;
        done.add(key);
        const k = this.k(x, z);
        if (this.keep[k] === 1) continue;
        const g = this.ground(x, z);
        const above = this.world.get(x, g + 1, z);
        // As high over the ground beside it as over its own, on a slope too:
        // never a step up from the uphill side.
        // (The land's own heights: not the wall just built beside it.)
        let near = g;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (this.inside(x + dx, z + dz, 0)) near = Math.max(near, this.g[this.k(x + dx, z + dz)]);
        let top = Math.min(near, g + 4) + high;
        if (above === B.WATER && water && this.water[k] > SEA) top = this.water[k] + high;
        else if (above === B.WATER || above === B.LAVA || g < SEA) continue;
        const soft = (id) => SOFT[id] || B.TREE_PART[id] || id === B.WATER;
        for (let y = g + 1; y <= top; y++) if (soft(this.world.get(x, y, z))) this.world.set(x, y, z, typeof mat === 'function' ? mat(x, y, z, y - g - 1) : mat);
        this.keep[k] = 3;
        this.clear(x + 0.5, z + 0.5, 2.5);
      }
    }
  }

  // No tree reaches over the round (cx, cz) radius r.
  clear(cx, cz, r) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) if (this.inside(x, z, 0) && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) this.bare[this.k(x, z)] = 1;
    }
  }

  // ------------------------------------------------ trees and flowers

  // Trees where fn(x, z) says (a tree's cells, or null), on open ground no
  // nearer each other than `apart`, tried `tries` times.
  trees(tries, apart, fn) {
    const { world, rng } = this;
    const placed = [];
    for (let t = 0; t < tries; t++) {
      const x = rng.int(3, this.S - 4);
      const z = rng.int(3, this.S - 4);
      const k = this.k(x, z);
      if (this.keep[k] || this.bare[k] || this.water[k]) continue;
      const y = this.ground(x, z);
      if (y <= SEA || !B.TERRAIN[world.get(x, y, z)] || world.get(x, y + 1, z) !== B.AIR) continue;
      // Not at the foot of a cliff either, its crown a ladder up it.
      let under = false;
      for (let dx = -3; dx <= 3 && !under; dx++) for (let dz = -3; dz <= 3 && !under; dz++) if (this.inside(x + dx, z + dz, 0) && this.g[this.k(x + dx, z + dz)] > y + 2) under = true;
      if (under) continue;
      if (placed.some(([px, pz, a]) => Math.hypot(px - x, pz - z) < Math.max(a, apart))) continue;
      const cells = fn(x, z, y, rng);
      if (!cells) continue;
      placed.push([x, z, apart]);
      for (const [cx, cy, cz, id] of placeTemplate(cells, x, y + 1, z, 0)) {
        // Never reaching out over the water either: crowns meeting over a
        // river would be a way across it.
        if (this.inside(cx, cz, 0) && (this.bare[this.k(cx, cz)] || this.g[this.k(cx, cz)] < SEA || this.water[this.k(cx, cz)])) continue;
        if (world.inBounds(cx, cy, cz) && SOFT[world.get(cx, cy, cz)] && !this.keep[this.k(cx, cz)]) world.set(cx, cy, cz, id);
        else if (world.inBounds(cx, cy, cz) && SOFT[world.get(cx, cy, cz)] && (id === B.LEAVES || id === B.PINE_LEAVES || id === B.SNOWY_LEAVES || id === B.COTTON_CANDY) && cy > y + 3) world.set(cx, cy, cz, id);
      }
    }
    return placed;
  }

  // Flowers in little patches, tall grass and mushrooms here and there, on
  // open ground the plan does not keep clear.
  flowers(patches, { grass = this.pal.grass, extra = B.MUSHROOM, rare = 0.997, where = () => true } = {}) {
    const { world, rng, pal } = this;
    const open = (x, z) => {
      if (!this.inside(x, z, 2) || this.keep[this.k(x, z)] === 1 || this.keep[this.k(x, z)] === 3) return -1;
      const y = this.ground(x, z);
      return y > SEA && world.get(x, y, z) === pal.top && world.get(x, y + 1, z) === B.AIR && where(x, z) ? y : -1;
    };
    for (let i = 0; i < patches; i++) {
      const x0 = rng.int(4, this.S - 5);
      const z0 = rng.int(4, this.S - 5);
      const flower = rng.pick(pal.flowers);
      for (let n = rng.int(4, 9); n > 0; n--) {
        const x = x0 + rng.int(-3, 3);
        const z = z0 + rng.int(-3, 3);
        const y = open(x, z);
        if (y >= 0) world.set(x, y + 1, z, flower);
      }
    }
    for (let x = 2; x < this.S - 2; x++) {
      for (let z = 2; z < this.S - 2; z++) {
        const r = hash2(this.seed + 61, x, z);
        if (r >= 0.06 && r <= rare) continue;
        const y = open(x, z);
        if (y < 0) continue;
        if (grass && r < 0.06) world.set(x, y + 1, z, grass);
        else if (r > rare && extra) world.set(x, y + 1, z, extra);
      }
    }
  }

  // Seashells on the beaches.
  shells(count) {
    const { world, rng } = this;
    for (let tries = 0, n = 0; tries < 4000 && n < count; tries++) {
      const x = rng.int(1, this.S - 2);
      const z = rng.int(1, this.S - 2);
      const y = this.ground(x, z);
      if (this.keep[this.k(x, z)] || world.get(x, y, z) !== B.SAND || y < SEA || y > SEA + 1 || world.get(x, y + 1, z) !== B.AIR) continue;
      world.set(x, y + 1, z, B.SHELL);
      n++;
    }
  }

  // ------------------------------------------------ animals

  // Friends of these kinds on open ground where fn(x, z) says, out of the
  // camps and off the path.
  animals(counts, where = () => true) {
    const { world, rng } = this;
    for (const [type, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 300; tries++) {
          const x = rng.int(3, this.S - 4);
          const z = rng.int(3, this.S - 4);
          if (this.keep[this.k(x, z)] || !where(x, z)) continue;
          const y = this.ground(x, z);
          if (y <= SEA || !B.TERRAIN[world.get(x, y, z)] || world.get(x, y + 1, z) !== B.AIR && B.KIND[world.get(x, y + 1, z)] !== B.K_PLANT) continue;
          if (B.SOLID[world.get(x, y + 2, z)]) continue;
          this.critters.push({ type, x: x + 0.5, y: y + 1, z: z + 0.5 });
          break;
        }
      }
    }
  }

  // Where the isle's treasure chests may turn up (treasure.js): on open
  // ground a few steps either side of the way, about as high as it is, so
  // every one is found going along it and none is up on a wall or a roof.
  chestSpots() {
    const out = [];
    const seen = new Set();
    for (const { pts } of this.routes) {
      for (let i = 2; i < pts.length - 2; i += 6) {
        const p = pts[i];
        if (p.bridge || p.tunnel) continue;
        const a = pts[i - 2];
        const b = pts[i + 2];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        for (const side of [-1, 1]) {
          for (const d of [3, 4, 5]) {
            const x = Math.floor(p.x - ((b.z - a.z) / len) * side * d);
            const z = Math.floor(p.z + ((b.x - a.x) / len) * side * d);
            const key = `${x},${z}`;
            if (seen.has(key) || !this.inside(x, z, 3) || this.keep[this.k(x, z)] === 3) continue;
            seen.add(key);
            const g = this.ground(x, z);
            if (Math.abs(g - p.y) > 1 || !B.TERRAIN[this.world.get(x, g, z)] || this.world.get(x, g + 1, z) !== B.AIR || this.world.get(x, g + 2, z) !== B.AIR) continue;
            out.push([x, g + 1, z]);
          }
        }
      }
    }
    return out;
  }

  // Out of the camps, the lair and the gates' way, whatever else put them there.
  clearOfCamps(list) {
    return list.filter((c) => {
      if (CRITTER_INFO[c.type]?.flies || CRITTER_INFO[c.type]?.sea) return true;
      const k = this.k(Math.floor(c.x), Math.floor(c.z));
      return !this.spots.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < s.bound + 1) && this.keep[k] !== 1;
    });
  }
}

// Points every `step` along a smooth line through [x, z] points.
function spline(points, step) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      out.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), z: catmull(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  const last = points.at(-1);
  out.push({ x: last[0], z: last[1] });
  return out;
}

// ---------------------------------------------------------------- landmarks

// A boat wrecked on the shore, keeled over: a hull of planks lying on its
// side, its broken mast and a torn sail on the sand beside it.
function shipwreck(m, cx, cz, along) {
  const { world } = m;
  const ux = Math.cos(along);
  const uz = Math.sin(along);
  const y0 = m.ground(Math.floor(cx), Math.floor(cz));
  for (let l = -6; l <= 6; l++) {
    const half = 2.6 * Math.sqrt(Math.max(0, 1 - (l / 6.6) ** 2));
    for (let w = -Math.ceil(half); w <= Math.ceil(half); w++) {
      for (let y = 0; y <= 3; y++) {
        // Keeled over: the hull's side is the bottom, its deck stands up.
        const r = Math.hypot(w / Math.max(0.8, half), (y - 0.5) / 2.6);
        if (r > 1 || (r < 0.62 && l > -5 && l < 5)) continue;
        const x = Math.floor(cx + ux * l - uz * w);
        const z = Math.floor(cz + uz * l + ux * w);
        world.set(x, y0 + 1 + y, z, (l + y) % 3 === 0 ? B.WOOD : B.PLANKS);
      }
    }
  }
  // A hole in its side, broken on the rocks.
  for (let y = 1; y <= 2; y++) world.set(Math.floor(cx + uz * 2), y0 + y, Math.floor(cz - ux * 2), B.AIR);
  // The mast lying on the sand, and the sail torn over it.
  for (let l = 0; l < 7; l++) world.set(Math.floor(cx - uz * (3 + l)), y0 + 1, Math.floor(cz + ux * (3 + l)), B.WOOD);
  for (const [l, w] of [[4, 1], [5, 1], [5, 2], [6, 1], [3, 1]]) world.set(Math.floor(cx - uz * (2 + l) + ux * w), y0 + 1, Math.floor(cz + ux * (2 + l) + uz * w), WHITE_CLOTH);
  m.claim(cx, cz, 8, 3);
}

// A lighthouse: a round tower in white and red bands, a gallery and a
// lantern room of glass on top — dark, its Star stolen.
function lighthouse(m, cx, cz) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  const tall = 13;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const d = Math.hypot(dx, dz);
      const x = cx + dx;
      const z = cz + dz;
      // A stone footing, down to the rock.
      if (d <= 3.2) for (let y = y0 - 3; y <= y0; y++) world.set(x, y, z, B.STONE);
      for (let y = 1; y <= tall; y++) {
        if (d <= 2.6 && d > 1.5) world.set(x, y0 + y, z, Math.floor((y - 1) / 3) % 2 ? RED : WHITE);
        else if (d <= 1.5) world.set(x, y0 + y, z, B.AIR);
      }
      // The gallery round the top, and the lantern room.
      if (d <= 3.4) world.set(x, y0 + tall + 1, z, GRAY);
      if (d <= 3.4 && d > 2.6) world.set(x, y0 + tall + 2, z, B.FENCE);
      if (d <= 1.8 && d > 1) for (let y = 2; y <= 4; y++) world.set(x, y0 + tall + y, z, B.GLASS);
      if (d <= 2.2) world.set(x, y0 + tall + 5, z, RED);
      if (d <= 1.2) world.set(x, y0 + tall + 6, z, RED);
    }
  }
  // Its door, facing the hill.
  world.set(cx, y0 + 1, cz + 2, B.AIR);
  world.set(cx, y0 + 2, cz + 2, B.AIR);
  world.set(cx, y0 + 1, cz + 3, B.PEBBLES);
  m.claim(cx, cz, 5, 3);
}

// A wooden pier out over the sea from (x, z) for `len` blocks the way
// (dx, dz) heads: a deck three wide on posts, lamps at its end.
function pier(m, x, z, dx, dz, len) {
  const { world } = m;
  const y = SEA + 1;
  for (let l = 0; l <= len; l++) {
    for (let w = -1; w <= 1; w++) {
      const cx = x + dx * l - dz * w;
      const cz = z + dz * l + dx * w;
      for (let yy = y; yy <= y + 3; yy++) if (!B.SOLID[world.get(cx, yy, cz)] || yy > y) world.set(cx, yy, cz, yy === y ? B.PLANKS : B.AIR);
    }
    if (l % 3 === 0) {
      for (const w of [-2, 2]) {
        const cx = x + dx * l - dz * w;
        const cz = z + dz * l + dx * w;
        for (let yy = y + 1; yy > 0 && !B.SOLID[world.get(cx, yy - 1, cz)]; yy--) world.set(cx, yy - 1, cz, B.WOOD);
        world.set(cx, y, cz, B.WOOD);
        world.set(cx, y + 1, cz, l === len - len % 3 ? B.LAMP : B.FENCE);
      }
    }
  }
  m.claim(x + dx * len / 2, z + dz * len / 2, len / 2 + 2, 3);
}

// A palm tree for a sunny beach: a trunk leaning out a little as it goes
// up, and a crown of leaves drooping out from the top on every side.
function palmTree(rng) {
  const cells = [];
  const h = rng.int(5, 7);
  const [lx, lz] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  let x = 0;
  let z = 0;
  for (let y = 0; y < h; y++) {
    if (y === Math.floor(h / 2) + 1) {
      x += lx;
      z += lz;
    }
    cells.push([x, y, z, B.WOOD]);
  }
  cells.push([x, h, z, B.LEAVES]);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    cells.push([x + dx, h, z + dz, B.LEAVES]);
    if (dx === 0 || dz === 0) {
      cells.push([x + dx * 2, h, z + dz * 2, B.LEAVES]);
      cells.push([x + dx * 3, h - 1, z + dz * 3, B.LEAVES]);
    }
  }
  return cells;
}

// A house of the village round a camp: its door facing the camp from `dist`
// away at angle `a`, on ground levelled for it first; built once the land
// is blocks (later).
function villageHouse(m, camp, a, dist, key = 'house') {
  const x = camp.x + Math.cos(a) * dist;
  const z = camp.z + Math.sin(a) * dist;
  const mid = { x: camp.x + Math.cos(a) * (dist + 3.5), z: camp.z + Math.sin(a) * (dist + 3.5) };
  m.level(mid.x, mid.z, 5, 5, camp.level, 3, 3);
  m.later(() => m.stamp(key, x, z, camp.x, camp.z));
}

// A fisherman's hut: plank walls, a door the way (fx, fz) faces, a window
// either side and a sloping roof.
function hut(m, cx, cz, fx, fz) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      for (let y = m.ground(x, z) + 1; y <= y0; y++) world.set(x, y, z, B.PLANKS);
      world.set(x, y0, z, B.PLANKS);
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      for (let y = 1; y <= 3; y++) world.set(x, y0 + y, z, edge ? (Math.abs(dx) === 2 && Math.abs(dz) === 2 ? B.WOOD : B.PLANKS) : B.AIR);
    }
  }
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) world.set(cx + dx, y0 + 4, cz + dz, Math.max(Math.abs(dx), Math.abs(dz)) === 3 ? BROWN : B.PLANKS);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) world.set(cx + dx, y0 + 5, cz + dz, Math.max(Math.abs(dx), Math.abs(dz)) === 2 ? BROWN : B.PLANKS);
  world.set(cx, y0 + 6, cz, BROWN);
  // The door and the windows beside it.
  world.set(cx + fx * 2, y0 + 1, cz + fz * 2, B.AIR);
  world.set(cx + fx * 2, y0 + 2, cz + fz * 2, B.AIR);
  world.set(cx + fz * 2, y0 + 2, cz + fx * 2, B.GLASS);
  world.set(cx - fz * 2, y0 + 2, cz - fx * 2, B.GLASS);
  world.set(cx, y0 + 3, cz, B.LAMP);
  m.claim(cx, cz, 4, 3);
}

// ---------------------------------------------------------------- the chapters

// Chapter 1, Shipwreck Shore: you come ashore on the beach in the south-west
// by your wrecked boat, go up through Seaside Village and along the coast
// road to the Old Pier, climb Lighthouse Hill on the north shore past its
// dark lighthouse, and cross the bridge to Crab Point in the south-east,
// where King Grumble has built his fort of driftwood.
function shore(m) {
  const { seed } = m;
  m.shape((x, z) => {
    // The mainland, the headland the lighthouse stands on, and Crab Point,
    // an islet off the south-east.
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.12;
    const main = Math.max(inside(x, z, 60, 60, 44, 44), inside(x, z, 84, 26, 26, 16));
    const point = inside(x, z, 106, 103, 17, 16);
    // The landing cove in the south-west: a wide sandy beach.
    const cove = inside(x, z, 26, 100, 20, 15);
    const land = smooth((Math.max(main, point, cove) + n) / 0.22);
    const hills = 2.2 + fbm(seed + 23, x / 26, z / 26, 4) * 2;
    let h = SEA - 5 + land * (5.5 + hills);
    // Lighthouse Hill on the north shore, and the ridge running down from
    // it that the coast road skirts.
    h += Math.max(bump(x, z, 84, 30, 22) * 9, bump(x, z, 54, 52, 13) * 6, bump(x, z, 66, 44, 13) * 7) * land;
    if (cove > main) h = Math.min(h, lerp(SEA + 1.2, h, smooth((main - cove + 0.25) / 0.25)));
    return h;
  });
  // The channel between the mainland and Crab Point.
  m.river([[80, 76], [96, 80], [112, 82], [126, 78]], { width: 6, depth: 4, bank: 3 });
  m.river([[84, 78], [86, 94], [86, 110], [90, 130]], { width: 5, depth: 4, bank: 3 });
  const path = m.route([
    { x: 27, z: 100 },
    { x: 34, z: 92 },
    { x: 41, z: 85 },
    { x: 46, z: 76, y: SEA + 4 },
    { x: 43, z: 64 },
    { x: 38, z: 55 },
    { x: 35, z: 46 },
    { x: 38, z: 35, y: SEA + 3 },
    { x: 50, z: 31 },
    { x: 62, z: 31 },
    { x: 73, z: 34 },
    { x: 84, z: 37, y: SEA + 11 },
    { x: 94, z: 47 },
    { x: 100, z: 60 },
    { x: 102, z: 73, bridge: true },
    { x: 104, z: 89 },
    { x: 106, z: 103, y: SEA + 3 },
  ]);
  // The village's houses round its square, where the monsters camp.
  const village = m.camp(path, 3);
  for (const a of [0.05, 1.05, 2.9, -1.0]) villageHouse(m, village, a, 13);
  m.camp(path, 7);
  m.camp(path, 11);
  m.camp(path, 16, { kind: 'castle', style: { wall: B.PLANKS, tower: B.WOOD, stripe: PURPLE, floor: B.PLANKS } });
  // Room for the lighthouse at the top of its cliff.
  m.disc(92, 20, 4, SEA + 11, 3, 3);
  m.finish();
  shipwreck(m, 14, 104, -0.3);
  pier(m, 39, 25, 0, -1, 14);
  hut(m, 28, 31, 1, 0);
  hut(m, 50, 25, 0, 1);
  lighthouse(m, 92, 20);
  // The old stone walls across the land: the coast road through one blocked
  // with crates and hay, a wooden gate in the other on the way up to the
  // lighthouse; and the bridge to Crab Point barred.
  const stone = (x, y, z, i) => (i === 2 && (x * 7 + z * 3) % 11 === 0 ? B.LAMP : i === 2 ? B.PEBBLES : B.STONE);
  m.gate(path, 5, 1, (x, y, z, i) => (i >= 3 ? 0 : (x + z + i) % 3 === 0 ? B.HAY : B.CRATE), { high: 3, wall: stone, wallHigh: 3, walls: [[[24, 55], [8, 56]], [[52, 55], [68, 58], [80, 66], [88, 78]]] });
  m.gate(path, 9, 2, (x, y, z, i) => (i === 3 ? B.STONE : B.PLANKS), { high: 4, thick: 1, wall: stone, wallHigh: 3, walls: [[[62, 20], [62, 8]], [[64, 44], [67, 60]]] });
  m.gate(path, 14, 3, (x, y, z, i) => (i === 4 ? PURPLE : B.WOOD), { high: 5, span: 3, thick: 1, mid: true });
  const fruit = B.FRUIT_ITEMS[2];
  m.trees(2600, 5, (x, z, y, rng) => {
    const forest = fbm(seed + 53, x / 18, z / 18, 2);
    if (m.world.get(x, y, z) === B.SAND) return rng.chance(0.35) ? palmTree(rng) : null;
    if (y > SEA + 9) return rng.chance(0.6) ? pineTree(rng) : null;
    if (forest < 0.05 && rng.chance(0.9)) return null;
    return rng.chance(0.3) ? fruitTree(rng, fruit, rng.int(2, 4)) : oakTree(rng, rng.chance(0.15));
  });
  m.flowers(40);
  m.shells(18);
  m.animals({ chick: 4, bunny: 4, sheep: 3 });
  m.animals({ cow: 2, pony: 1 }, (x, z) => x < 80 && z > 50);
  m.critters.push({ type: 'boat', x: 43.5, y: SEA + 1, z: 14.5 });
  return { fruit };
}

// ---------------------------------------------------------------- more landmarks

// An ellipsoid of blocks (where only(x, y, z) lets it, open air by default).
function ball(m, cx, cy, cz, rx, ry, rz, id, only = (x, y, z) => SOFT[m.world.get(x, y, z)]) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 > 1 || !only(x, y, z)) continue;
        m.world.set(x, y, z, typeof id === 'function' ? id(x, y, z) : id);
      }
    }
  }
}

// A giant mushroom, taller than you: a thick white stalk and a red cap
// with white spots.
function giantMushroom(m, x, z, h, r) {
  const { world } = m;
  const y0 = m.ground(x, z);
  for (let y = 1; y <= h; y++) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) world.set(x + dx, y0 + y, z + dz, WHITE);
  const rh = Math.max(2, r * 0.6);
  ball(m, x + 0.5, y0 + h + 0.5, z + 0.5, r, rh, r, (cx, cy, cz) => (hash2(m.seed + 7, cx * 3 + cy, cz) < 0.16 ? WHITE : RED), (cx, cy) => cy > y0 + h);
  m.claim(x, z, r + 1, 3);
}

// A tree of the old wood whose trunk is hollow, four wide and as tall as a
// house, with roots spreading round its foot, a doorway into the hollow
// (the way (fx, fz) faces) and a great crown of leaves.
function hollowTree(m, x, z, fx, fz) {
  const { world } = m;
  const y0 = m.ground(x, z);
  const tall = 15;
  for (let dx = -2; dx <= 1; dx++) {
    for (let dz = -2; dz <= 1; dz++) {
      const edge = dx === -2 || dx === 1 || dz === -2 || dz === 1;
      for (let y = 1; y <= tall; y++) world.set(x + dx, y0 + y, z + dz, edge || y > tall - 2 ? B.WOOD : B.AIR);
    }
  }
  // Roots at the corners, and the doorway.
  for (const [dx, dz] of [[-3, -3], [2, -3], [-3, 2], [2, 2], [-3, 0], [2, -1], [0, 2], [-1, -3]]) for (let y = 1; y <= 2; y++) world.set(x + dx, y0 + y, z + dz, B.WOOD);
  for (const o of [-1, 0]) {
    for (let y = 1; y <= 3; y++) {
      const dx = fx ? (fx > 0 ? 1 : -2) : o;
      const dz = fz ? (fz > 0 ? 1 : -2) : o;
      world.set(x + dx, y0 + y, z + dz, B.AIR);
    }
  }
  world.set(x, y0 + 5, z, B.LAMP);
  // Branches and the crown.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let l = 2; l <= 5; l++) world.set(x + dx * l, y0 + tall - 3 + (l >> 1), z + dz * l, B.WOOD);
  ball(m, x, y0 + tall + 3, z, 8, 4.5, 8, B.LEAVES);
  for (const [dx, dz] of [[5, 3], [-5, -2], [2, -6], [-3, 5]]) ball(m, x + dx, y0 + tall + 1, z + dz, 4, 3, 4, B.LEAVES);
}

// A water mill on a river bank: a log cabin, and its wheel turning in the
// river beside it (round (wx, wz), its axle along x or z).
function waterWheel(m, wx, wy, wz, alongX) {
  const { world } = m;
  for (let a = -4; a <= 4; a++) {
    for (let b = -4; b <= 4; b++) {
      const d = Math.hypot(a, b);
      if (d > 4.4) continue;
      const rim = d > 3.4;
      const spoke = a === 0 || b === 0 || Math.abs(a) === Math.abs(b);
      if (!rim && !spoke) continue;
      for (const t of [0, 1]) {
        const x = alongX ? wx + t : wx + a;
        const z = alongX ? wz + a : wz + t;
        world.set(x, wy + b, z, rim ? B.PLANKS : B.WOOD);
      }
    }
  }
}

// A spider's web strung between trees: white threads across a frame,
// standing up in a sheet that runs the way (dx, dz) heads.
function web(m, x, y, z, dx, dz, r = 2) {
  for (let u = -r; u <= r; u++) {
    for (let v = -r; v <= r; v++) {
      if (!(u === 0 || v === 0 || Math.abs(u) === Math.abs(v) || Math.max(Math.abs(u), Math.abs(v)) === r)) continue;
      const cx = Math.round(x + dx * u);
      const cz = Math.round(z + dz * u);
      if (SOFT[m.world.get(cx, y + v, cz)]) m.world.set(cx, y + v, cz, WHITE_CLOTH);
    }
  }
}

// A tree long dead: a bare trunk with a branch or two.
function deadTree(rng) {
  const h = rng.int(4, 6);
  const cells = [];
  for (let i = 0; i < h; i++) cells.push([0, i, 0, B.WOOD]);
  if (rng.chance(0.7)) cells.push([1, h - 2, 0, B.WOOD], [2, h - 1, 0, B.WOOD]);
  if (rng.chance(0.7)) cells.push([-1, h - 3, 0, B.WOOD], [-1, h - 2, 1, B.WOOD]);
  return cells;
}

// A willow by the water: a short trunk, a wide crown, and leaves hanging
// down from its edge almost to the ground.
function willowTree(rng) {
  const cells = [];
  const h = rng.int(4, 5);
  for (let y = 0; y < h; y++) cells.push([0, y, 0, B.WOOD]);
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      const d = Math.hypot(x, z);
      if (d > 3.4) continue;
      cells.push([x, h, z, B.LEAVES]);
      if (d < 2.4) cells.push([x, h + 1, z, B.LEAVES]);
      if (d > 2.4 && rng.chance(0.55)) for (let y = h - 1; y >= rng.int(1, 2); y--) cells.push([x, y, z, B.LEAVES]);
    }
  }
  return cells;
}

// A hut on stilts over the marsh: posts down to the bed, a floor of planks
// a little over the water, walls and a reed roof, its door the way (fx, fz)
// faces with a ladder of planks down from it.
function stiltHut(m, cx, cz, fx, fz) {
  const { world } = m;
  const y0 = SEA + 3;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) for (let y = y0 - 1; y > 0 && !B.SOLID[world.get(x, y, z)]; y--) world.set(x, y, z, B.WOOD);
      world.set(x, y0, z, B.PLANKS);
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      for (let y = 1; y <= 3; y++) world.set(x, y0 + y, z, edge ? (Math.abs(dx) === 2 && Math.abs(dz) === 2 ? B.WOOD : B.PLANKS) : B.AIR);
    }
  }
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) world.set(cx + dx, y0 + 4, cz + dz, B.HAY);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + dx, y0 + 5, cz + dz, B.HAY);
  world.set(cx + fx * 2, y0 + 1, cz + fz * 2, B.AIR);
  world.set(cx + fx * 2, y0 + 2, cz + fz * 2, B.AIR);
  world.set(cx + fz * 2, y0 + 2, cz + fx * 2, B.GLASS);
  world.set(cx, y0 + 3, cz, B.LAMP);
  // Steps down to the ground or the water.
  for (let s = 1; s <= 3; s++) {
    const x = cx + fx * (2 + s);
    const z = cz + fz * (2 + s);
    const y = y0 - s + 1;
    if (B.SOLID[world.get(x, y, z)]) break;
    world.set(x, y, z, B.PLANKS);
    for (let yy = y - 1; yy > 0 && !B.SOLID[world.get(x, yy, z)]; yy--) world.set(x, yy, z, B.WOOD);
  }
  m.claim(cx, cz, 4, 3);
}

// The Gumdrop Factory: a long building of pink and white bricks with rows
// of windows, a big door the way (fx, fz) faces, and two candy-cane
// chimneys puffing (well, standing) over its roof.
function factory(m, cx, cz, fx, fz) {
  const { world } = m;
  const y0 = m.ground(cx, cz);
  const along = fx === 0;
  const L = 8;
  const Wd = 5;
  for (let a = -L; a <= L; a++) {
    for (let b = -Wd; b <= Wd; b++) {
      const x = cx + (along ? a : b);
      const z = cz + (along ? b : a);
      for (let y = m.ground(x, z) + 1; y <= y0; y++) world.set(x, y, z, B.COOKIE);
      const edge = Math.abs(a) === L || Math.abs(b) === Wd;
      for (let y = 1; y <= 7; y++) {
        let id = B.AIR;
        if (edge) id = y === 3 && a % 3 === 0 && Math.abs(a) !== L ? B.GLASS : y >= 6 ? LAVENDER : (a + y) % 2 ? PINK : WHITE;
        world.set(x, y0 + y, z, id);
      }
      world.set(x, y0 + 8, z, edge ? WHITE : PINK);
    }
  }
  // The door, and the chimneys.
  for (let o = -1; o <= 1; o++) for (let y = 1; y <= 3; y++) world.set(cx + fx * Wd + (along ? o : 0), y0 + y, cz + fz * Wd + (along ? 0 : o), B.AIR);
  for (const s of [-4, 4]) {
    const x = cx + (along ? s : 0);
    const z = cz + (along ? 0 : s);
    for (let y = 9; y <= 14; y++) world.set(x, y0 + y, z, B.CANDY_CANE);
    world.set(x, y0 + 15, z, B.COTTON_CANDY);
  }
  world.set(cx, y0 + 4, cz, B.LAMP);
  m.claim(cx, cz, 11, 3);
}

// A giant lollipop beside the way: a white stick and a round sweet on top.
function lollipop(m, x, z, color) {
  const { world } = m;
  const y0 = m.ground(x, z);
  for (let y = 1; y <= 5; y++) world.set(x, y0 + y, z, WHITE);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.hypot(a, b) <= 2.3) world.set(x + a, y0 + 7 + b, z, Math.hypot(a, b) > 1.3 ? color : WHITE);
  m.claim(x, z, 2, 3);
}

// A castle wall along [x, z] points: two blocks thick and `high` over the
// ground, battlements on top, a lamp now and then; a tower at each point.
function wallLine(m, points, { high = 6, mat = B.BRICK_WALL, top = mat, stripe = PURPLE, towers = true } = {}) {
  const { world } = m;
  const done = new Set();
  const samples = spline(points.map((p) => [p[0], p[1]]), 0.5);
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = Math.floor(p.x) + ox;
      const z = Math.floor(p.z) + oz;
      const key = `${x},${z}`;
      if (done.has(key) || !m.inside(x, z)) continue;
      done.add(key);
      const g = m.ground(x, z);
      if (g <= SEA - 1) continue;
      for (let y = 1; y <= high; y++) world.set(x, g + y, z, y === high - 1 && (x + z) % 4 === 0 ? stripe : mat);
      if ((x + z) % 2 === 0) world.set(x, g + high + 1, z, top);
      m.keep[m.k(x, z)] = 3;
    }
  }
  if (towers) for (const [x, z] of points) tower(m, x, z, high + 4, mat, top);
}

// A round tower with battlements and a lamp on top.
function tower(m, cx, cz, high, mat = B.BRICK_WALL, top = mat) {
  const { world } = m;
  const g = m.ground(cx, cz);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.hypot(dx, dz) > 2.6) continue;
      const x = cx + dx;
      const z = cz + dz;
      for (let y = m.ground(x, z) + 1; y <= g + high; y++) world.set(x, y, z, mat);
      if (Math.hypot(dx, dz) > 1.6 && (dx + dz) % 2 === 0) world.set(x, g + high + 1, z, top);
    }
  }
  world.set(cx, g + high + 1, cz, B.LAMP);
  m.claim(cx, cz, 3, 3);
}

// ---------------------------------------------------------------- chapter 2

// Chapter 2, the Whispering Woods: a wood so thick it is dim at noon. From
// a meadow in the south-west the old path winds north through the
// Mushroom Ring, on to the Old Mill on the river, over the mill's bridge,
// down into Spider Hollow and up to King Grumble's hideout, a fort built
// round the hollow of the oldest tree in the wood.
function woods(m) {
  const { seed } = m;
  m.shape((x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.08;
    const dx = Math.abs(x - 64) / 60;
    const dz = Math.abs(z - 64) / 60;
    const land = smooth((1 - (dx ** 4 + dz ** 4) ** 0.25 + n) / 0.16);
    const hills = 3 + fbm(seed + 23, x / 22, z / 22, 4) * 3.5;
    let h = SEA - 5 + land * (5 + hills);
    // The rise the hideout stands on, and Spider Hollow, a dell sunk in the wood.
    h += bump(x, z, 92, 26, 30) * 5 * land;
    h -= bump(x, z, 92, 72, 15) * 4 * land;
    return h;
  });
  // The river, from the north down to the sea in the south-east.
  m.river([[70, -6], [72, 16], [66, 34], [72, 52], [70, 70], [80, 92], [96, 112], [104, 134]], { width: 5, depth: 3, bank: 3 });
  const path = m.route([
    { x: 20, z: 110 },
    { x: 24, z: 98 },
    { x: 28, z: 86 },
    { x: 32, z: 74, y: SEA + 6 },
    { x: 38, z: 62 },
    { x: 44, z: 54 },
    { x: 46, z: 44 },
    { x: 50, z: 34, y: SEA + 6 },
    { x: 56, z: 42 },
    { x: 60, z: 48, bridge: true },
    { x: 82, z: 52 },
    { x: 88, z: 60 },
    { x: 92, z: 72, y: SEA + 3 },
    { x: 102, z: 62 },
    { x: 104, z: 50 },
    { x: 100, z: 40 },
    { x: 92, z: 26, y: SEA + 9 },
  ]);
  const ring = m.camp(path, 3);
  const mill = m.camp(path, 7);
  m.camp(path, 12);
  const lair = m.camp(path, 16, { kind: 'castle', style: { wall: B.WOOD, tower: B.WOOD, stripe: PURPLE, top: B.LEAVES, floor: B.PLANKS } });
  // Room for the mill on the river bank.
  m.level(60, 28, 5, 5, SEA + 6, 3, 3);
  m.finish();
  // Giant mushrooms round the Mushroom Ring.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const x = Math.round(ring.x + Math.cos(a) * 12.5);
    const z = Math.round(ring.z + Math.sin(a) * 12.5);
    if (m.keep[m.k(x, z)] === 1) continue;
    giantMushroom(m, x, z, 4 + (i % 3), 3 + (i % 2));
  }
  // The Old Mill: its cabin on the bank and its wheel in the river.
  m.stamp('log-cabin', 59, 25, mill.x, mill.z);
  waterWheel(m, 66, SEA + 1, 28, true);
  // King Grumble's hideout, round the hollow of the oldest tree.
  hollowTree(m, lair.cx + 6, lair.cz - 6, -1, 0);
  // Webs strung round Spider Hollow, and across the way out of it.
  const hollow = m.spots[2];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.9;
    const x = hollow.x + Math.cos(a) * 12;
    const z = hollow.z + Math.sin(a) * 12;
    web(m, x, m.ground(Math.floor(x), Math.floor(z)) + 3, z, -Math.sin(a), Math.cos(a));
    m.claim(x, z, 2, 3);
  }
  // Brambles across the old path, the mill's bridge barred, and webs.
  // Hedges of thorny brambles shut the wood's parts off from each other.
  const hedge = (x, y, z) => ((x * 7 + z * 5) % 9 === 0 ? B.WOOD : B.LEAVES);
  m.gate(path, 5, 1, (x, y, z, i) => (i < 3 ? ((x * 3 + z + i) % 4 ? B.LEAVES : B.WOOD) : 0), { high: 3, wall: hedge, wallHigh: 3, walls: [[[30, 53], [2, 52]], [[58, 56], [72, 58]]] });
  m.gate(path, 9, 2, (x, y, z, i) => (i === 4 ? PURPLE : B.WOOD), { high: 5, span: 3, thick: 1, mid: true });
  m.gate(path, 14, 3, () => WHITE_CLOTH, { high: 4, thick: 1, wall: (x, y, z, i) => (i === 2 ? WHITE_CLOTH : hedge(x, y, z)), wallHigh: 3, walls: [[[118, 50], [127, 50]], [[90, 46], [72, 44]]] });
  m.trees(5200, 4, (x, z, y, rng) => {
    if (m.world.get(x, y, z) === B.SAND) return null;
    if (Math.hypot(x - hollow.x, z - hollow.z) < 18) return rng.chance(0.6) ? deadTree(rng) : null;
    const r = rng.next();
    return r < 0.22 ? pineTree(rng) : r < 0.32 ? fruitTree(rng, B.FRUIT_ITEMS[0], rng.int(2, 3)) : oakTree(rng, r > 0.6);
  });
  m.flowers(16, { extra: B.MUSHROOM, rare: 0.985 });
  m.animals({ bunny: 5, chick: 2 });
  m.animals({ pony: 2, dog: 1 }, (x, z) => z > 60);
  return { fruit: B.FRUIT_ITEMS[0] };
}

// ---------------------------------------------------------------- chapter 3

// Chapter 3, Frostpeak Pass: the tallest mountain on the isle, all snow.
// From a snowy valley in the south the pass goes by the Frozen Lake, zigzags
// up the mountain's face to Halfway Ledge, on up to the Old Mine, through
// the mine to the far side and up to the Ice Palace on the summit.
function frost(m) {
  const { seed } = m;
  m.pal.path = B.PEBBLES;
  // Frostpeak rises in steps, each a cliff too high to climb but where the
  // path goes up a ramp: the valley, Halfway Ledge, the mine's shelf and
  // the summit. The ledge and the shelf bulge out where their camps are.
  m.pal.rockAt = 99;
  const tier = (x, z) => {
    const r = Math.hypot(x - 74, z - 30) + fbm(seed + 71, x / 10, z / 10, 2) * 2;
    if (r < 23) return 3;
    if (r < 32 || Math.hypot(x - 44, z - 42) < 19) return 2;
    if (r < 43 || Math.hypot(x - 96, z - 64) < 12) return 1;
    return 0;
  };
  const LIFT = [0, 7, 13, 19];
  m.shape((x, z) => {
    const n = fbm(seed + 11, x / 20, z / 20, 3) * 0.08;
    const edge = inside(x, z, 64, 62, 60, 62) + n;
    const land = smooth(edge / 0.18);
    const hills = 2.5 + fbm(seed + 23, x / 24, z / 24, 4) * 1.5;
    // The crag the mine runs through, on the summit's edge.
    const crag = bump(x, z, 57, 35, 9) * 7;
    // The mountain's steps drop straight into the sea where they meet it.
    return SEA - 5 + land * (8 + hills) + (LIFT[tier(x, z)] + crag) * smooth(edge / 0.04) + fbm(seed + 5, x / 6, z / 6, 2) * 0.6;
  });
  m.pond(34, 98, 9, SEA + 5, 2);
  const path = m.route([
    { x: 22, z: 116 },
    { x: 38, z: 110 },
    { x: 56, z: 102, y: SEA + 6 },
    { x: 74, z: 96 },
    { x: 90, z: 88 },
    { x: 96, z: 80 },
    { x: 96, z: 73 },
    { x: 96, z: 64, y: SEA + 12 },
    { x: 84, z: 68 },
    { x: 70, z: 68 },
    { x: 61, z: 64 },
    { x: 54, z: 55 },
    { x: 44, z: 42, y: SEA + 18 },
    { x: 52, z: 38, tunnel: true },
    { x: 57, z: 34.5, tunnel: true },
    { x: 62, z: 31 },
    { x: 68, z: 30 },
    { x: 80, z: 28, y: SEA + 24 },
  ], { slope: 0.6, blend: 0 });
  m.camp(path, 2);
  m.camp(path, 7, { blend: 2 });
  m.camp(path, 12, { blend: 2 });
  m.camp(path, 17, { kind: 'castle', blend: 2, style: { wall: B.ICE, tower: WHITE, stripe: SKY, top: B.SNOW, floor: B.ICE } });
  m.finish();
  // The lake frozen over.
  for (let x = 22; x <= 46; x++) for (let z = 86; z <= 110; z++) if (m.world.get(x, SEA + 5, z) === B.WATER && m.world.get(x, SEA + 6, z) === B.AIR) m.world.set(x, SEA + 5, z, B.ICE);
  // The Old Mine's way in: a frame of logs in the crag.
  const mouth = m.along(path, 13);
  for (const s of [-2, 2]) for (let y = 1; y <= 4; y++) m.world.set(Math.floor(mouth.x - mouth.dz * s), mouth.y + y, Math.floor(mouth.z + mouth.dx * s), B.WOOD);
  for (let s = -2; s <= 2; s++) m.world.set(Math.floor(mouth.x - mouth.dz * s), mouth.y + 5, Math.floor(mouth.z + mouth.dx * s), B.PLANKS);
  // A wall of ice in the cut up to Halfway Ledge, a snowdrift in the cut up
  // to the mine, and boards nailed over the mine's far end.
  m.gate(path, 5, 1, () => B.ICE, { high: 4, span: 5 });
  m.gate(path, 11, 2, (x, y, z, i) => (i < 3 + ((x + z) & 1) ? B.SNOW : 0), { high: 4, span: 5 });
  m.gate(path, 14, 3, (x, y, z, i) => (i < 4 ? B.PLANKS : 0), { high: 4, span: 1.5, thick: 1 });
  m.trees(3000, 5, (x, z, y, rng) => (y < SEA + 12 && m.world.get(x, y, z) === B.SNOW ? pineTree(rng, true) : y < SEA + 17 && rng.chance(0.2) ? pineTree(rng, true) : null));
  m.flowers(10);
  m.animals({ bunny: 4, chick: 1 }, (x, z) => z > 70);
  m.animals({ reindeer: 2, polarbear: 1 }, (x, z) => z > 76);
  return { fruit: B.FRUIT_ITEMS[1] };
}

// ---------------------------------------------------------------- chapter 4

// Chapter 4, Candy Canyon: a deep canyon cut through a plateau of frosting
// and cookie, a stream at its floor. From its mouth in the west you go along
// Lollipop Lane, up a ramp onto Cookie Mesa, over the canyon on the long
// candy bridge to the Gumdrop Factory on the far mesa, and down to the
// Candy Castle where the canyon opens out in the east.
function candy(m) {
  const { seed } = m;
  m.pal.path = B.COOKIE;
  m.pal.cliff = B.CHOCOLATE;
  m.pal.rail = B.CANDY_CANE;
  const canyon = [[-4, 70], [24, 68], [44, 64], [64, 64], [86, 66], [104, 62], [132, 60]];
  const near = m.field(canyon, 30);
  const bowls = [[34, 66, 13]];
  m.shape((x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.08;
    const edge = inside(x, z, 64, 64, 64, 60) + n;
    // The canyon (with room for a camp along it) cut down to the floor, the
    // mesas either side of it standing up in cliffs, out of the sea too.
    // (A sheer edge all along: no slope up it anywhere, where it bends too.)
    const wiggle = fbm(seed + 71, x / 8, z / 8, 2) * 1.2;
    let open = near[x * ISLE_SIDE + z] < 10 + wiggle ? 1 : 0;
    for (const [bx, bz, r] of bowls) if (Math.hypot(x - bx, z - bz) < r + wiggle) open = 1;
    const floor = SEA - 5 + smooth(edge / 0.14) * 8 + fbm(seed + 31, x / 9, z / 9, 2) * 0.6;
    const mesa = (12 + fbm(seed + 23, x / 20, z / 20, 4) * 1.5) * smooth(edge / 0.04);
    return floor + mesa * (1 - open);
  });
  m.river([[-4, 72], [24, 72], [46, 69], [66, 69], [86, 71], [104, 70], [132, 68]], { width: 3, top: SEA + 2, depth: 2, bank: 1 });
  const path = m.route([
    { x: 6, z: 64 },
    { x: 20, z: 64 },
    { x: 34, z: 62, y: SEA + 3 },
    { x: 46, z: 62 },
    { x: 52, z: 58 },
    { x: 55, z: 50 },
    { x: 57, z: 42 },
    { x: 60, z: 32, y: SEA + 15 },
    { x: 70, z: 36 },
    { x: 75, z: 46 },
    { x: 76, z: 53, bridge: true },
    { x: 77, z: 78 },
    { x: 78, z: 86 },
    { x: 78, z: 98, y: SEA + 15 },
    { x: 86, z: 98 },
    { x: 91, z: 99 },
    { x: 98, z: 100 },
    { x: 108, z: 102, y: SEA + 15 },
  ], { slope: 0.6, blend: 0 });
  m.camp(path, 2);
  m.camp(path, 7, { blend: 2 });
  const works = m.camp(path, 13, { blend: 2 });
  m.camp(path, 17, { kind: 'castle', blend: 2, style: { wall: PINK, tower: WHITE, stripe: LAVENDER, top: B.CANDY_CANE, floor: B.COOKIE, lamp: B.LAMP } });
  m.level(56, 105, 9, 6, SEA + 15, 2, 3);
  m.finish();
  factory(m, 56, 105, 1, 0);
  // Giant lollipops along Lollipop Lane.
  for (const [x, z, c] of [[14, 59, RED], [22, 70, YELLOW], [26, 56, SKY], [44, 70, LIME], [46, 55, ORANGE]]) if (!m.keep[m.k(x, z)]) lollipop(m, x, z, c);
  // A wall of gummy in the cut up onto Cookie Mesa, candy-cane bars on the
  // bridge, and the chocolate wall out of the factory yard with its gate.
  m.gate(path, 5, 1, () => B.GUMMY, { high: 4, span: 4 });
  m.gate(path, 10, 2, (x, y, z, i) => ((x + z + i) % 2 ? B.CANDY_CANE : WHITE), { high: 5, span: 3, thick: 1, mid: true });
  m.gate(path, 15, 3, (x, y, z, i) => (i === 3 ? PINK : B.CHOCOLATE), { high: 4, thick: 1, wall: (x, y, z, i) => (i === 3 ? PINK : B.CHOCOLATE), wallHigh: 4, walls: [[[91, 84], [91, 74]], [[91, 114], [91, 127]]] });
  m.trees(2400, 5, (x, z, y, rng) => (rng.chance(0.75) ? candyTree(rng) : null));
  m.flowers(30, { extra: B.GUMDROP, rare: 0.99 });
  m.animals({ bunny: 3, chick: 3 });
  m.animals({ unicorn: 3 }, (x, z) => works && x < 88 && Math.hypot(x - 64, z - 64) > 20);
  return { fruit: B.FRUIT_ITEMS[3] };
}

// ---------------------------------------------------------------- chapter 5

// Chapter 5, Misty Marsh: low wet land, more pool than ground, with
// boardwalks over the water. From the firm ground in the south the way goes
// over Reedy Pool's boardwalk, to the Stilt Village, round to the Queen
// Mosquito's nest (the deepest camp, which she keeps) and to the Bog Fort.
function marsh(m) {
  const { seed } = m;
  m.pal.rail = 0;
  m.pal.path = B.PLANKS;
  m.shape((x, z) => {
    const n = fbm(seed + 11, x / 20, z / 20, 3) * 0.1;
    const land = smooth((inside(x, z, 64, 62, 60, 62) + n) / 0.16);
    // Pools all over: the land barely above the water, and often under it.
    const wet = fbm(seed + 41, x / 11, z / 11, 3);
    let h = SEA - 4 + land * (5 + wet * 3);
    // Firm ground in the south where you arrive.
    h = Math.max(h, (SEA + 2) * bump(x, z, 64, 118, 16) + (SEA - 6) * (1 - bump(x, z, 64, 118, 16)));
    return h;
  });
  // Deep channels part the marsh into its islands: the south one you
  // arrive on, the Stilt Village's in the west, the Queen's in the middle
  // and the Bog Fort's in the east.
  const channels = [
    [[-6, 80], [30, 82], [60, 76], [96, 80], [134, 76]],
    [[44, 80], [46, 60], [42, 36], [46, 10], [44, -6]],
    [[80, 78], [78, 56], [80, 30], [76, -6]],
  ];
  for (const c of channels) m.river(c, { width: 5, depth: 3, bank: 2 });
  const path = m.route([
    { x: 64, z: 118 },
    { x: 58, z: 108 },
    { x: 50, z: 96, y: SEA + 2 },
    { x: 42, z: 88 },
    { x: 38, z: 80 },
    { x: 33, z: 72 },
    { x: 26, z: 58, y: SEA + 2 },
    { x: 34, z: 48 },
    { x: 44, z: 46 },
    { x: 52, z: 42 },
    { x: 62, z: 38, y: SEA + 2 },
    { x: 72, z: 32 },
    { x: 79, z: 30 },
    { x: 88, z: 30 },
    { x: 102, z: 30, y: SEA + 3 },
  ], { boardwalk: true });
  m.camp(path, 2);
  const village = m.camp(path, 6);
  m.camp(path, 10);
  m.camp(path, 14, { kind: 'castle', style: { wall: B.WOOD, tower: B.WOOD, stripe: GREEN, top: B.LEAVES, floor: B.PLANKS } });
  m.finish();
  // The Stilt Village round its camp, over the water.
  for (const a of [Math.PI * 0.85, Math.PI * 1.2, Math.PI * 0.5, -0.35]) {
    const x = Math.round(village.x + Math.cos(a) * 15);
    const z = Math.round(village.z + Math.sin(a) * 15);
    if (m.keep[m.k(x, z)] === 1 || !m.inside(x, z, 4)) continue;
    stiltHut(m, x, z, Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? -Math.sign(Math.cos(a)) : 0, Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 0 : -Math.sign(Math.sin(a)));
  }
  // Lily pads on the pools (never in the channels): stepping stones.
  const deep = channels.map((c) => m.field(c, 8));
  for (let tries = 0, n = 0; tries < 3000 && n < 60; tries++) {
    const x = m.rng.int(4, 123);
    const z = m.rng.int(4, 123);
    if (deep.some((d) => d[m.k(x, z)] < 8) || m.world.get(x, SEA, z) !== B.WATER || m.world.get(x, SEA + 1, z) !== B.AIR || m.keep[m.k(x, z)]) continue;
    m.world.set(x, SEA, z, LIME);
    if (m.rng.chance(0.3)) m.world.set(x, SEA + 1, z, B.COSMOS);
    n++;
  }
  // The boardwalk broken over the first channel (mended once Reedy Pool is
  // free), a log gate on the second and a hedge of reeds on the third.
  gapGate(m, path, 4, 1);
  m.gate(path, 8, 2, (x, y, z, i) => (i === 3 ? GREEN : B.WOOD), { high: 4, span: 3, thick: 1 });
  m.gate(path, 12, 3, (x, y, z, i) => (i < 3 ? B.LEAVES : 0), { high: 3, span: 3 });
  m.trees(3000, 5, (x, z, y, rng) => (rng.chance(0.25) ? deadTree(rng) : rng.chance(0.6) ? willowTree(rng) : null));
  m.flowers(20, { extra: B.MUSHROOM, rare: 0.99 });
  m.animals({ chick: 2, bunny: 2 });
  return { fruit: B.FRUIT_ITEMS[4] };
}

// ---------------------------------------------------------------- chapter 6

// Chapter 6, Ember Mountain: a volcano in a sea of lava, rivers of lava
// pouring down its sides. From the black beach in the north-west the way
// crosses the Ash Fields, goes over the lava rivers by Lava Falls, through
// the Golem Gate and up to the Fire Fort by the crater.
function ember(m) {
  const { seed } = m;
  m.lavaPools = true;
  m.pal.deck = B.BASALT;
  m.pal.rail = 0;
  m.pal.rockAt = 99;
  // Ember Mountain rises in rings of black rock, each a cliff too high to
  // climb but where the path goes up a ramp; bulges where the camps are.
  const tier = (x, z) => {
    const r = Math.hypot(x - 64, z - 62) + fbm(seed + 71, x / 10, z / 10, 2) * 1.5;
    if (r < 19 || Math.hypot(x - 66, z - 74) < 20) return 3;
    if (r < 30 || Math.hypot(x - 90, z - 54) < 12) return 2;
    if (r < 40 || Math.hypot(x - 60, z - 19) < 12) return 1;
    return 0;
  };
  const LIFT = [0, 6, 12, 18];
  m.shape((x, z) => {
    const n = fbm(seed + 11, x / 20, z / 20, 3) * 0.08;
    const edge = inside(x, z, 64, 64, 60, 60) + n;
    const land = smooth(edge / 0.16);
    const hills = 2 + fbm(seed + 23, x / 22, z / 22, 4) * 1.2;
    return SEA - 5 + land * (8 + hills) + LIFT[tier(x, z)] * smooth(edge / 0.04) + fbm(seed + 5, x / 6, z / 6, 2) * 0.6;
  });
  // The crater: a lake of lava in the volcano's top, and rivers of lava
  // pouring from it down the mountain's sides into the sea.
  m.pond(60, 54, 5, SEA + 22, 3);
  m.channel([[56, 54], [44, 56], [30, 60], [12, 64], [-4, 66]], { width: 3 });
  m.channel([[58, 62], [50, 78], [42, 96], [34, 114], [28, 132]], { width: 3 });
  const path = m.route([
    { x: 14, z: 16 },
    { x: 14, z: 28 },
    { x: 16, z: 42, y: SEA + 5 },
    { x: 24, z: 34 },
    { x: 32, z: 28 },
    { x: 40, z: 24 },
    { x: 48, z: 22 },
    { x: 60, z: 19, y: SEA + 11 },
    { x: 72, z: 24 },
    { x: 80, z: 32 },
    { x: 85, z: 40 },
    { x: 90, z: 52, y: SEA + 17 },
    { x: 91, z: 63 },
    { x: 90, z: 74 },
    { x: 86, z: 74 },
    { x: 66, z: 74, y: SEA + 23 },
  ], { slope: 0.6, blend: 0 });
  m.camp(path, 2, { blend: 2, style: { post: B.BASALT } });
  m.camp(path, 7, { blend: 2, style: { post: B.BASALT } });
  m.camp(path, 11, { blend: 2, style: { post: B.BASALT } });
  m.camp(path, 15, { kind: 'castle', blend: 2, style: { wall: B.BASALT, tower: B.BASALT, stripe: ORANGE, top: B.BASALT, floor: B.STONE } });
  m.finish();
  // Boulders on the way up to Lava Falls, a river of lava across the way
  // up to the Golem Gate (it cools to stone), and the Golem Gate's great
  // doors on the way up to the Fire Fort.
  m.gate(path, 6, 1, (x, y, z, i) => (i < 3 ? (i === 2 && (x + z) % 2 ? B.BASALT : B.STONE) : 0), { high: 3, span: 4 });
  lavaGate(m, path, 10, 2);
  m.gate(path, 13, 3, (x, y, z, i) => (i === 4 ? ORANGE : B.BRICK_WALL), { high: 5, span: 4, thick: 1 });
  m.trees(1400, 6, (x, z, y, rng) => (rng.chance(0.4) ? deadTree(rng) : null));
  m.flowers(8);
  m.animals({ bunny: 2, chick: 2 });
  return { fruit: B.FRUIT_ITEMS[5 % B.FRUIT_ITEMS.length] };
}

// A boardwalk broken at a node, its planks gone over the water there:
// opened (camp `camp` freed), it is mended, the planks back.
function gapGate(m, pts, node, camp) {
  const p = m.along(pts, node);
  const cells = [];
  const seen = new Set();
  for (let t = -1.5; t <= 1.5; t += 0.5) {
    for (let o = -3; o <= 3; o += 0.5) {
      const x = Math.floor(p.x + p.dx * t - p.dz * o);
      const z = Math.floor(p.z + p.dz * t + p.dx * o);
      const key = `${x},${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (let y = p.y; y <= p.y + 1; y++) {
        const id = m.world.get(x, y, z);
        if (id !== B.PLANKS && id !== B.WOOD && id !== B.FENCE) continue;
        m.world.set(x, y, z, B.AIR);
        cells.push(x, y, z, id);
      }
    }
  }
  m.gates.push({ camp, x: Math.floor(p.x), y: p.y + 1, z: Math.floor(p.z), cells });
}

// A river of lava across the path at a node, a little below it: opened
// (camp `camp` freed), it cools into a bridge of stone.
function lavaGate(m, pts, node, camp) {
  const p = m.along(pts, node);
  const cells = [];
  for (let t = -1; t <= 1; t++) {
    for (let o = -4; o <= 4; o++) {
      const x = Math.floor(p.x + p.dx * t - p.dz * o);
      const z = Math.floor(p.z + p.dz * t + p.dx * o);
      const g = m.ground(x, z);
      if (g < p.y - 1 || g > p.y + 1) continue;
      for (let y = g + 1; y <= g + 3; y++) if (SOFT[m.world.get(x, y, z)]) m.world.set(x, y, z, B.AIR);
      m.world.set(x, g, z, B.LAVA);
      cells.push(x, g, z, B.BASALT);
    }
  }
  m.gates.push({ camp, x: Math.floor(p.x), y: p.y + 1, z: Math.floor(p.z), cells });
}

// ---------------------------------------------------------------- chapter 7

// Chapter 7, Gloom Rock: King Grumble's own castle on a great rock in the
// sea. From the beach in the south you go to the Outer Camp before its
// walls, through the gatehouse into the castle (its portcullis up once the
// camp is free), past the Castle Gate camp and the inner wall, round to the
// Knights' Yard, and up the great stairs to the Throne Yard at the top.
function castle(m) {
  const { seed } = m;
  m.pal.top = B.GRASS;
  m.pal.path = GRAY;
  m.pal.rockAt = 99;
  m.shape((x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.08;
    const edge = inside(x, z, 64, 60, 58, 60) + n;
    const land = smooth(edge / 0.16);
    const hills = 2 + fbm(seed + 23, x / 22, z / 22, 4) * 1.5;
    // The land rises behind the walls to the inner yard, and Gloom Rock
    // stands up out of it in sheer cliffs, the Throne Yard on top.
    const rise = smooth((70 - z) / 26) * 5;
    const h = SEA - 5 + land * (5 + hills + rise);
    const rock = Math.hypot(x - 80, z - 24) + fbm(seed + 71, x / 9, z / 9, 2) * 0.8 < 23;
    return rock ? lerp(h, SEA + 20, smooth(edge / 0.04)) : h;
  });
  const path = m.route([
    { x: 64, z: 122 },
    { x: 63, z: 110 },
    { x: 62, z: 98, y: SEA + 5 },
    { x: 62, z: 90 },
    { x: 62, z: 84 },
    { x: 62, z: 76 },
    { x: 61, z: 66, y: SEA + 7 },
    { x: 61, z: 58 },
    { x: 61, z: 53 },
    { x: 56, z: 46 },
    { x: 42, z: 40, y: SEA + 10 },
    { x: 46, z: 30 },
    { x: 54, z: 25 },
    { x: 60, z: 24 },
    { x: 80, z: 24, y: SEA + 20 },
  ], { slope: 0.6, blend: 0 });
  m.camp(path, 2, { style: { post: B.BRICK_WALL } });
  m.camp(path, 6, { style: { post: B.BRICK_WALL } });
  m.camp(path, 10, { blend: 2, style: { post: B.BRICK_WALL } });
  m.camp(path, 14, { kind: 'castle', blend: 2, style: { wall: B.BRICK_WALL, tower: CHARCOAL, stripe: PURPLE, top: B.BRICK_WALL, floor: B.CHECKER_FLOOR } });
  m.finish();
  // The outer wall right across the rock with its gatehouse, and the inner
  // wall with its gate, each a tower either side of the way through.
  wallLine(m, [[0, 86], [30, 84], [56, 84]], { high: 6 });
  wallLine(m, [[68, 84], [96, 84], [127, 86]], { high: 6 });
  wallLine(m, [[0, 56], [32, 54], [55, 53]], { high: 6 });
  wallLine(m, [[67, 53], [92, 54], [127, 58]], { high: 6 });
  // The portcullis (opened, up), the inner gate, the door to the great
  // stairs up Gloom Rock.
  m.gate(path, 4, 1, (x, y, z, i) => ((x + z + i) % 2 ? CHARCOAL : GRAY), { high: 6, span: 4, thick: 1 });
  m.gate(path, 8, 2, (x, y, z, i) => (i === 4 ? PURPLE : B.WOOD), { high: 5, span: 4, thick: 1 });
  m.gate(path, 13, 3, (x, y, z, i) => (i === 3 ? PURPLE : B.WOOD), { high: 4, span: 4, thick: 1 });
  m.trees(1600, 6, (x, z, y, rng) => (z > 84 ? (rng.chance(0.5) ? oakTree(rng) : pineTree(rng)) : rng.chance(0.3) ? deadTree(rng) : null));
  m.flowers(16);
  m.animals({ bunny: 2, chick: 2 }, (x, z) => z > 84);
  return { fruit: B.FRUIT_ITEMS[0] };
}

// ---------------------------------------------------------------- terraces

// Terraces along the way, for the later chapters: each column of the map is
// on the terrace of the stretch of the way nearest it (its nodes' t), so the
// way between one gate and the next runs over a terrace of its own, a sheer
// cliff wherever it meets another, and climbs from one to the next on a ramp
// (where the gate goes, see rampGate). Returns tierAt(x, z).
function terraces(m, nodes) {
  const pts = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
    for (let j = 0; j < n; j++) {
      const f = j / n;
      pts.push({ x: lerp(a.x, b.x, f), z: lerp(a.z, b.z, f), t: f < 0.5 ? a.t : b.t });
    }
  }
  const end = nodes.at(-1);
  pts.push({ x: end.x, z: end.z, t: end.t });
  const S = m.S;
  const tier = new Uint8Array(S * S);
  const dist = new Float32Array(S * S);
  for (let x = 0; x < S; x++) {
    for (let z = 0; z < S; z++) {
      let best = Infinity;
      let t = 0;
      for (const p of pts) {
        const d = (p.x - x - 0.5) ** 2 + (p.z - z - 0.5) ** 2;
        if (d < best) {
          best = d;
          t = p.t;
        }
      }
      tier[m.k(x, z)] = t;
      dist[m.k(x, z)] = Math.sqrt(best);
    }
  }
  const at = (x, z) => m.k(Math.max(0, Math.min(S - 1, Math.floor(x))), Math.max(0, Math.min(S - 1, Math.floor(z))));
  const tierAt = (x, z) => tier[at(x, z)];
  // (And how far each column is from the way: canyons, the caverns' own.)
  tierAt.dist = (x, z) => dist[at(x, z)];
  return tierAt;
}

// The way's nodes for route(), each camp's (and the lair's) at the height of
// its terrace there: height(x, z) is the map's.
const onTerraces = (nodes, height) => nodes.map(({ t, camp, ...n }) => (camp ? { ...n, y: Math.round(height(n.x, n.z)) } : n));

// A gate halfway up the ramp that starts at a node (from one terrace to the
// next): in the cut, or on the causeway, with nothing either side to step
// round it by.
function rampGate(m, path, node, camp, make, opts = {}) {
  const a = path.find((q) => q.node === node);
  const b = path.find((q) => q.node === node + 1);
  m.gate(path, node, camp, make, { high: 4, span: 4, ahead: (b.s - a.s) / 2, ...opts });
}

// A stepped pyramid of sandstone round (cx, cz), its base half as wide as
// half, each step two blocks high (too high to climb), a gold star on top.
function pyramid(m, cx, cz, half, y0, mat = TAN, trim = ORANGE) {
  const { world } = m;
  let y = y0;
  for (let r = half; r >= 1; r--) {
    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        if (!m.inside(x, z, 0)) continue;
        for (let dy = 0; dy < 2; dy++) world.set(x, y + dy, z, dy === 1 && (Math.abs(x - cx) === r || Math.abs(z - cz) === r) && (x + z) % 3 === 0 ? trim : mat);
      }
    }
    y += 2;
  }
  world.set(cx, y, cz, B.STAR_BLOCK);
  m.claim(cx, cz, half * 1.5, 3);
}

// An obelisk: a tall square column of sandstone with a gold top; broken, it
// stops short with its top lying beside it.
function obelisk(m, x, z, high, broken = false) {
  const { world } = m;
  const g = m.ground(x, z);
  for (let y = 1; y <= high; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) world.set(x + dx, g + y, z + dz, y % 4 === 0 ? ORANGE : TAN);
  if (broken) {
    for (let i = 0; i < 3; i++) world.set(x + 3 + i, m.ground(x + 3 + i, z) + 1, z, i === 2 ? B.STAR_BLOCK : TAN);
  } else {
    world.set(x, g + high + 1, z, B.STAR_BLOCK);
    world.set(x + 1, g + high + 1, z + 1, B.STAR_BLOCK);
  }
  m.claim(x + 0.5, z + 0.5, 3, 3);
}

// A cactus: a green column with an arm or two.
function cactus(rng) {
  const cells = [];
  const h = rng.int(3, 5);
  for (let y = 0; y < h; y++) cells.push([0, y, 0, GREEN]);
  if (rng.chance(0.7)) cells.push([1, 1, 0, GREEN], [2, 1, 0, GREEN], [2, 2, 0, GREEN]);
  if (rng.chance(0.5)) cells.push([0, 2, -1, GREEN], [0, 2, -2, GREEN], [0, 3, -2, GREEN]);
  return cells;
}

// ---------------------------------------------------------------- chapter 5

// Chapter 5, Sunscorch Dunes: rolling sand rising in great terraces of
// sandstone, each a cliff too high to climb. From the beach in the south-west
// the way goes by the Palm Oasis, up the first ramp to the Scorpion Pit, along
// the northern mesa to the Broken Obelisk, round and up to the Sandstone Steps
// and last of all up to the Sunken Pyramid in the middle, on the highest
// terrace of all.
function dunes(m) {
  const { seed } = m;
  m.pal.path = TAN;
  m.pal.cliff = TAN;
  m.pal.deep = TAN;
  m.pal.rockAt = 99;
  m.pal.deck = TAN;
  const nodes = [
    { x: 16, z: 112, t: 0 },
    { x: 24, z: 104, t: 0 },
    { x: 32, z: 95, t: 0, camp: true },
    { x: 26, z: 82, t: 0 },
    { x: 20, z: 70, t: 0 },
    { x: 20, z: 56, t: 1 },
    { x: 22, z: 44, t: 1 },
    { x: 31, z: 31, t: 1, camp: true },
    { x: 45, z: 21, t: 1 },
    { x: 58, z: 17, t: 1 },
    { x: 73, z: 17, t: 2 },
    { x: 86, z: 23, t: 2 },
    { x: 98, z: 34, t: 2, camp: true },
    { x: 105, z: 48, t: 2 },
    { x: 105, z: 63, t: 3 },
    { x: 101, z: 77, t: 3 },
    { x: 92, z: 92, t: 3, camp: true },
    { x: 78, z: 96, t: 3 },
    { x: 64, z: 92, t: 4 },
    { x: 60, z: 79, t: 4 },
    { x: 60, z: 63, t: 4, camp: true },
  ];
  const tierAt = terraces(m, nodes);
  const LIFT = 5;
  const height = (x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.08;
    const dx = Math.abs(x - 64) / 61;
    const dz = Math.abs(z - 64) / 61;
    const edge = 1 - (dx ** 4 + dz ** 4) ** 0.25 + n;
    const land = smooth(edge / 0.16);
    // Dunes rippling over each terrace.
    const dune = 1.5 + fbm(seed + 23, x / 14, z / 9, 3) * 1.1;
    // (The terraces drop sheer into the sea: no slope along the shore to
    // climb from one to the next.)
    return SEA - 5 + land * (6 + dune) + (edge > 0 ? LIFT * tierAt(x, z) : 0);
  };
  m.shape(height);
  // The oasis: a pool by the first camp.
  m.pond(14, 86, 5, SEA + 2, 2);
  const path = m.route(onTerraces(nodes, height), { slope: 0.6, blend: 0 });
  const tan = { post: TAN, lamp: B.LAMP, floor: B.SAND, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: { ...tan, post: B.WOOD } });
  m.camp(path, 7, { blend: 2, style: tan });
  const obeliskCamp = m.camp(path, 12, { blend: 2, style: tan });
  m.camp(path, 16, { blend: 2, style: tan });
  const lair = m.camp(path, 20, { kind: 'castle', blend: 2, style: { wall: TAN, tower: ORANGE, stripe: B.STAR_BLOCK, top: TAN, floor: B.SAND } });
  m.finish();
  // The Sunken Pyramid rising behind the lair, and the obelisks.
  pyramid(m, lair.cx, lair.cz - 19, 7, m.ground(lair.cx, lair.cz - 19) + 1);
  obelisk(m, Math.floor(obeliskCamp.x) + 11, Math.floor(obeliskCamp.z) - 2, 9, true);
  obelisk(m, 40, 102, 7);
  obelisk(m, 114, 70, 8);
  // A drift of sand on the first ramp, a stone door on the second, the
  // sun-stone wall on the third and the pyramid's doors on the last.
  rampGate(m, path, 4, 1, (x, y, z, i) => (i < 3 + ((x * 3 + z) & 1) ? B.SAND : 0));
  rampGate(m, path, 9, 2, (x, y, z, i) => (i === 3 ? ORANGE : TAN), { thick: 1 });
  rampGate(m, path, 13, 3, (x, y, z, i) => (i === 2 ? B.STAR_BLOCK : (x + z + i) % 2 ? TAN : YELLOW), { thick: 1 });
  rampGate(m, path, 17, 4, (x, y, z, i) => (i === 3 ? B.STAR_BLOCK : TAN), { thick: 1, high: 5 });
  m.trees(1800, 6, (x, z, y, rng) => (m.world.get(x, y, z) !== B.SAND ? null : Math.hypot(x - 14, z - 86) < 12 ? palmTree(rng) : rng.chance(0.45) ? cactus(rng) : null));
  m.flowers(6);
  m.animals({ zebra: 2, giraffe: 1 }, (x, z) => Math.hypot(x - 20, z - 92) < 26);
  return { fruit: B.FRUIT_ITEMS[3 % B.FRUIT_ITEMS.length] };
}

// ---------------------------------------------------------------- chapter 7

// A cluster of glowing crystals standing on the ground, as tall as h.
function crystalCluster(rng, h = 3) {
  const cells = [];
  const id = rng.chance(0.5) ? B.CRYSTAL : B.CRYSTAL_BLUE;
  for (let y = 0; y < h; y++) cells.push([0, y, 0, id]);
  if (rng.chance(0.7)) for (let y = 0; y < h - 1; y++) cells.push([1, y, 0, id]);
  if (rng.chance(0.5)) cells.push([0, 0, 1, id === B.CRYSTAL ? B.CRYSTAL_BLUE : B.CRYSTAL]);
  return cells;
}

// Chapter 7, the Crystal Caverns: canyons cut deep into a great block of
// rock, open to the night sky, their walls glittering with crystals. From the
// cove in the south the miners' road winds through the caverns, each one a
// step up from the last, by the Miners' Camp, the Glowing Gallery, Spider
// Bridge and the Deep Diggings, to the Crystal Grotto in the heart of the rock.
function caverns(m) {
  const { seed } = m;
  m.pal.path = B.PEBBLES;
  m.pal.cliff = B.STONE;
  m.pal.rockAt = 99;
  const nodes = [
    { x: 64, z: 118, t: 0 },
    { x: 64, z: 106, t: 0 },
    { x: 60, z: 94, t: 0, camp: true },
    { x: 46, z: 88, t: 0 },
    { x: 33, z: 85, t: 0 },
    { x: 21, z: 75, t: 1 },
    { x: 18, z: 61, t: 1 },
    { x: 24, z: 46, t: 1, camp: true },
    { x: 35, z: 37, t: 1 },
    { x: 48, z: 32, t: 2 },
    { x: 62, z: 28, t: 2 },
    { x: 76, z: 33, t: 2, camp: true },
    { x: 88, z: 41, t: 2 },
    { x: 97, z: 54, t: 3 },
    { x: 101, z: 68, t: 3 },
    { x: 97, z: 82, t: 3, camp: true },
    { x: 85, z: 91, t: 3 },
    { x: 77, z: 81, t: 4 },
    { x: 71, z: 71, t: 4 },
    { x: 63, z: 61, t: 4, camp: true },
  ];
  const tierAt = terraces(m, nodes);
  const camps = nodes.filter((n) => n.camp);
  const lair = camps.at(-1);
  // In a canyon: near the way, round a camp, or the lair's cavern.
  const open = (x, z) => tierAt.dist(x, z) < 5.5 || camps.some((c) => c !== lair && Math.hypot(x - c.x, z - c.z) < 11.5) || Math.max(Math.abs(x - lair.x), Math.abs(z - lair.z)) < 15;
  const height = (x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.08;
    const dx = Math.abs(x - 64) / 62;
    const dz = Math.abs(z - 64) / 62;
    const edge = 1 - (dx ** 4 + dz ** 4) ** 0.25 + n;
    // The cove where everyone lands, open to the sea.
    if (Math.hypot(x - 64, z - 122) < 9) return SEA + 2 + smooth((9 - Math.hypot(x - 64, z - 122)) / 9) * 2;
    if (edge < 0) return SEA - 4;
    const floor = SEA + 4 + 5 * tierAt(x, z) + fbm(seed + 23, x / 9, z / 9, 2) * 0.6;
    return open(x, z) ? floor : SEA + 34 + fbm(seed + 31, x / 12, z / 12, 3) * 2;
  };
  m.shape(height);
  const path = m.route(onTerraces(nodes, height), { slope: 0.6, blend: 0 });
  const rock = { post: B.STONE, lamp: B.CRYSTAL, floor: B.PEBBLES, bed: B.HAY };
  m.camp(path, 2, { blend: 1, style: { ...rock, post: B.WOOD, lamp: B.LAMP } });
  m.camp(path, 7, { blend: 1, style: { ...rock, lamp: B.CRYSTAL_BLUE } });
  const bridge = m.camp(path, 11, { blend: 1, style: rock });
  m.camp(path, 15, { blend: 1, style: rock });
  m.camp(path, 19, { kind: 'castle', blend: 1, style: { wall: B.STONE, tower: B.CRYSTAL, stripe: B.CRYSTAL_BLUE, top: B.STONE, floor: B.CRYSTAL_BLUE } });
  m.finish();
  // Crystals set into the canyon walls (flush with them: nothing to climb),
  // and miners' lamps set into the floor by the road.
  const { world } = m;
  for (let x = 1; x < m.S - 1; x++) {
    for (let z = 1; z < m.S - 1; z++) {
      const g = m.ground(x, z);
      if (g < SEA + 20) continue;
      const below = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => m.ground(x + dx, z + dz)));
      if (below > g - 6) continue;
      for (let y = below + 2; y < g - 1; y++) if (hash2(seed + 97, x * 64 + y, z) < 0.06) world.set(x, y, z, hash2(seed + 98, x, z * 64 + y) < 0.5 ? B.CRYSTAL : B.CRYSTAL_BLUE);
    }
  }
  for (const [i, p] of path.entries()) {
    if (i % 14 || p.bridge || p.tunnel) continue;
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const x = Math.floor(p.x - ((b.z - a.z) / len) * 2.5);
    const z = Math.floor(p.z + ((b.x - a.x) / len) * 2.5);
    if (m.ground(x, z) === p.y && m.keep[m.k(x, z)] !== 3) world.set(x, p.y, z, B.LAMP);
  }
  // Webs across Spider Bridge's cavern.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    web(m, bridge.x + Math.cos(a) * 9.5, bridge.level + 4, bridge.z + Math.sin(a) * 9.5, -Math.sin(a), Math.cos(a));
  }
  // The rockfall on the first ramp, the crystal doors on the second, the
  // webs on the third, and a wall of rock on the last.
  rampGate(m, path, 4, 1, (x, y, z, i) => (i < 4 ? ((x + z + i) % 3 ? B.STONE : B.PEBBLES) : 0));
  rampGate(m, path, 8, 2, (x, y, z, i) => ((x + z + i) % 2 ? B.CRYSTAL : B.CRYSTAL_BLUE), { thick: 1 });
  rampGate(m, path, 12, 3, () => WHITE_CLOTH, { thick: 1 });
  rampGate(m, path, 16, 4, (x, y, z, i) => (i === 2 ? B.CRYSTAL : B.STONE), { thick: 2, high: 5 });
  m.trees(1400, 6, (x, z, y, rng) => (y > SEA + 30 || m.world.get(x, y, z) !== B.STONE ? null : rng.chance(0.55) ? crystalCluster(rng, rng.int(2, 4)) : rng.chance(0.4) ? giantMushroomCells(rng) : null));
  m.flowers(4, { extra: B.MUSHROOM, rare: 0.97 });
  m.animals({ bunny: 2 }, (x, z) => z > 100);
  return { fruit: B.FRUIT_ITEMS[4 % B.FRUIT_ITEMS.length] };
}

// A little glowing mushroom, as a tree (cells from its foot).
function giantMushroomCells(rng) {
  const h = rng.int(2, 3);
  const cells = [];
  for (let y = 0; y < h; y++) cells.push([0, y, 0, WHITE]);
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) cells.push([dx, h, dz, rng.chance(0.5) ? PURPLE : SKY]);
  return cells;
}

// ---------------------------------------------------------------- chapter 8

// A gravestone: a rounded slab of stone, two high, by (x, z).
function gravestone(m, x, z) {
  const g = m.ground(x, z);
  if (g < SEA || m.keep[m.k(x, z)] === 1) return;
  m.world.set(x, g + 1, z, GRAY);
  m.world.set(x, g + 2, z, B.STONE);
  m.claim(x + 0.5, z + 0.5, 1.5, 3);
}

// A crooked lamp post: a fence post with a lamp, as a tree.
const lampPost = () => [[0, 0, 0, B.FENCE], [0, 1, 0, B.FENCE], [0, 2, 0, B.LAMP]];

// Chapter 8, Haunted Hollow: a dark valley where the sun never shines, its
// dead trees crooked, its terraces stepping up and up. From the gate in the
// south-east the way goes past the Crooked Gate, through the Old Graveyard,
// the Pumpkin Patch and round the Witch's Well to Creaky Manor at the top.
function hollow(m) {
  const { seed } = m;
  m.pal.path = GRAY;
  m.pal.cliff = B.STONE;
  m.pal.rockAt = 99;
  m.pal.rail = B.FENCE;
  const nodes = [
    { x: 112, z: 116, t: 0 },
    { x: 104, z: 106, t: 0 },
    { x: 93, z: 96, t: 0, camp: true },
    { x: 82, z: 103, t: 0 },
    { x: 70, z: 108, t: 1 },
    { x: 57, z: 104, t: 1, camp: true },
    { x: 44, z: 100, t: 1 },
    { x: 33, z: 96, t: 2 },
    { x: 25, z: 85, t: 2, camp: true },
    { x: 20, z: 72, t: 2 },
    { x: 20, z: 59, t: 3 },
    { x: 26, z: 45, t: 3, camp: true },
    { x: 39, z: 37, t: 3 },
    { x: 52, z: 35, t: 4 },
    { x: 64, z: 39, t: 4 },
    { x: 76, z: 46, t: 4, camp: true },
  ];
  const tierAt = terraces(m, nodes);
  const height = (x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.08;
    const dx = Math.abs(x - 64) / 61;
    const dz = Math.abs(z - 64) / 61;
    const edge = 1 - (dx ** 4 + dz ** 4) ** 0.25 + n;
    const land = smooth(edge / 0.16);
    const hills = 2 + fbm(seed + 23, x / 18, z / 18, 3) * 1.2;
    return SEA - 5 + land * (7 + hills) + (edge > 0 ? 5 * tierAt(x, z) : 0);
  };
  m.shape(height);
  m.pond(30, 30, 4, Math.round(height(30, 30)) + 1, 2);
  const path = m.route(onTerraces(nodes, height), { slope: 0.6, blend: 0 });
  const iron = { post: CHARCOAL, lamp: B.LAMP, floor: GRAY, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: iron });
  const yard = m.camp(path, 5, { blend: 2, style: iron });
  const patch = m.camp(path, 8, { blend: 2, style: { ...iron, post: B.WOOD } });
  const well = m.camp(path, 11, { blend: 2, style: iron });
  m.camp(path, 15, { kind: 'castle', blend: 2, style: { wall: CHARCOAL, tower: PURPLE, stripe: LAVENDER, top: CHARCOAL, floor: B.CHECKER_FLOOR } });
  m.finish();
  // Gravestones round the Old Graveyard, pumpkins and a scarecrow in the
  // Pumpkin Patch, and the Witch's Well: a ring of stone round dark water.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    gravestone(m, Math.floor(yard.x + Math.cos(a) * 11), Math.floor(yard.z + Math.sin(a) * 11));
  }
  const pumpkin = B.CROP_STAGES[B.CROPS.findIndex((c) => c.key === 'pumpkin')][B.RIPE];
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const d = 10 + (i % 3);
    const x = Math.floor(patch.x + Math.cos(a) * d);
    const z = Math.floor(patch.z + Math.sin(a) * d);
    const g = m.ground(x, z);
    if (m.keep[m.k(x, z)] === 1 || m.world.get(x, g + 1, z) !== B.AIR) continue;
    m.world.set(x, g + 1, z, pumpkin);
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) m.world.set(Math.floor(well.x) + 4 + dx, well.level + 1, Math.floor(well.z) + 4 + dz, B.STONE);
  m.world.set(Math.floor(well.x) + 4, well.level, Math.floor(well.z) + 4, B.WATER);
  // The rusty gate, the graveyard's iron fence, a wall of pumpkins and the
  // well's mist turned to stone.
  rampGate(m, path, 3, 1, (x, y, z, i) => (i < 4 ? ((x + z) % 2 ? CHARCOAL : GRAY) : 0), { thick: 1 });
  rampGate(m, path, 6, 2, (x, y, z, i) => (i === 3 ? B.LAMP : CHARCOAL), { thick: 1 });
  rampGate(m, path, 9, 3, (x, y, z, i) => (i < 3 ? ORANGE : 0));
  rampGate(m, path, 12, 4, (x, y, z, i) => (i === 3 ? LAVENDER : PURPLE), { thick: 1, high: 5 });
  m.trees(3200, 5, (x, z, y, rng) => (m.world.get(x, y, z) !== B.GRASS ? null : rng.chance(0.08) ? lampPost() : rng.chance(0.5) ? deadTree(rng) : rng.chance(0.25) ? willowTree(rng) : null));
  m.flowers(12, { extra: B.MUSHROOM, rare: 0.98 });
  m.animals({ bunny: 2 }, (x, z) => x > 90 && z > 90);
  return { fruit: B.FRUIT_ITEMS[5 % B.FRUIT_ITEMS.length] };
}

// ---------------------------------------------------------------- chapter 10

// A brick building of Cogwheel City, w by d, high, with a flat roof, windows
// that light up and a chimney; only on open ground well away from cliffs.
function factoryBlock(m, rng, cx, cz) {
  const { world } = m;
  const w = rng.int(2, 3);
  const d = rng.int(2, 3);
  const high = rng.int(4, 7);
  const g = m.ground(cx, cz);
  for (let x = cx - w - 3; x <= cx + w + 3; x++) {
    for (let z = cz - d - 3; z <= cz + d + 3; z++) {
      if (!m.inside(x, z, 2) || m.keep[m.k(x, z)] || Math.abs(m.ground(x, z) - g) > 0) return false;
    }
  }
  const wall = rng.pick([B.BRICK_WALL, GRAY, BROWN]);
  for (let x = cx - w; x <= cx + w; x++) {
    for (let z = cz - d; z <= cz + d; z++) {
      const edge = Math.abs(x - cx) === w || Math.abs(z - cz) === d;
      for (let y = 1; y <= high; y++) world.set(x, g + y, z, edge && y % 3 === 2 && (x + z) % 2 === 0 ? B.GLASS : y === high ? CHARCOAL : wall);
    }
  }
  for (let y = high + 1; y <= high + 4; y++) world.set(cx + w - 1, g + y, cz - d + 1, y === high + 4 ? B.LAMP : CHARCOAL);
  m.claim(cx, cz, Math.max(w, d) + 2, 3);
  return true;
}

// A great cog lying on the ground, as a ring of dark bricks with teeth.
function cog(m, cx, cz, r) {
  for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++) {
      const d = Math.hypot(x - cx, z - cz);
      const tooth = (Math.round((Math.atan2(z - cz, x - cx) / (Math.PI * 2)) * 16) & 1) === 0;
      if (d > r - 1 && (d < r + 0.2 || (tooth && d < r + 1.1)) && m.keep[m.k(x, z)] !== 1) m.world.set(x, m.ground(x, z), z, CHARCOAL);
    }
  }
}

// Chapter 10, Cogwheel City: a town of brass and brick on terraces stepping
// up the hill behind Ember Mountain. From the docks in the south-west the way
// goes through the Scrap Yard, along Conveyor Row (its moving belts running
// against you), up to the Steam Works and the Clock Tower, and last up to
// Mainspring Hall on the top terrace.
function works(m) {
  const { seed } = m;
  m.pal.path = GRAY;
  m.pal.cliff = B.BRICK_WALL;
  m.pal.deep = B.STONE;
  m.pal.rockAt = 99;
  m.pal.deck = CHARCOAL;
  m.pal.rail = B.FENCE;
  const nodes = [
    { x: 14, z: 116, t: 0 },
    { x: 20, z: 106, t: 0 },
    { x: 30, z: 96, t: 0, camp: true },
    { x: 40, z: 84, t: 0 },
    { x: 52, z: 78, t: 1 },
    { x: 66, z: 78, t: 1 },
    { x: 80, z: 78, t: 1 },
    { x: 94, z: 84, t: 1, camp: true },
    { x: 106, z: 72, t: 1 },
    { x: 108, z: 58, t: 2 },
    { x: 100, z: 44, t: 2, camp: true },
    { x: 88, z: 33, t: 2 },
    { x: 74, z: 29, t: 3 },
    { x: 58, z: 24, t: 3, camp: true },
    { x: 44, z: 29, t: 3 },
    { x: 36, z: 42, t: 4 },
    { x: 42, z: 54, t: 4 },
    { x: 57, z: 57, t: 4, camp: true },
  ];
  const tierAt = terraces(m, nodes);
  const height = (x, z) => {
    const n = fbm(seed + 11, x / 22, z / 22, 3) * 0.06;
    const dx = Math.abs(x - 64) / 62;
    const dz = Math.abs(z - 64) / 62;
    const edge = 1 - (dx ** 6 + dz ** 6) ** (1 / 6) + n;
    const land = smooth(edge / 0.12);
    // Paved and level, each terrace: a town, not a hillside.
    return SEA - 5 + land * 9 + (edge > 0 ? 5 * tierAt(x, z) : 0);
  };
  m.shape(height);
  const path = m.route(onTerraces(nodes, height), { slope: 0.6, blend: 0, width: 2 });
  const brass = { post: BROWN, lamp: B.LAMP, floor: CHARCOAL, bed: B.CRATE };
  m.camp(path, 2, { blend: 2, style: brass });
  m.camp(path, 7, { blend: 2, style: brass });
  const steam = m.camp(path, 10, { blend: 2, style: brass });
  const clock = m.camp(path, 13, { blend: 2, style: brass });
  m.camp(path, 17, { kind: 'castle', blend: 2, style: { wall: B.BRICK_WALL, tower: ORANGE, stripe: YELLOW, top: CHARCOAL, floor: B.CHECKER_FLOOR } });
  m.finish();
  // Conveyor Row: moving belts along the way, running back the way you come.
  const { world } = m;
  for (const p of path) {
    if (p.node >= 0 && p.node !== 5) continue;
    const i = path.indexOf(p);
    if (!(p.s >= path.find((q) => q.node === 5).s && p.s <= path.find((q) => q.node === 6).s)) continue;
    const back = facingTo(p.x, p.z, path[Math.max(0, i - 3)].x, path[Math.max(0, i - 3)].z);
    for (const o of [-1, 0, 1]) {
      const x = Math.floor(p.x);
      const z = Math.floor(p.z) + o;
      if (world.get(x, p.y + 1, z) === B.AIR && m.ground(x, z) === p.y) world.set(x, p.y + 1, z, B.turnedTo(B.WALKWAY, back));
    }
  }
  // The Clock Tower by its camp, with a clock on each side; the steam works'
  // chimneys; great cogs lying about, and brick buildings all over the town.
  const tx = Math.floor(clock.x) - 11;
  const tz = Math.floor(clock.z) - 3;
  const tg = m.ground(tx, tz);
  for (let y = 1; y <= 12; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(tx + dx, tg + y, tz + dz, y === 12 ? CHARCOAL : B.BRICK_WALL);
  for (const [dx, dz] of [[0, 2], [0, -2], [2, 0], [-2, 0]]) world.set(tx + dx, tg + 10, tz + dz, B.TOWER_CLOCK);
  world.set(tx, tg + 13, tz, B.LAMP);
  m.claim(tx, tz, 4, 3);
  for (const [dx, dz] of [[9, -6], [10, 5]]) {
    const x = Math.floor(steam.x) + dx;
    const z = Math.floor(steam.z) + dz;
    const g = m.ground(x, z);
    for (let y = 1; y <= 9; y++) world.set(x, g + y, z, y > 7 ? GRAY : CHARCOAL);
    m.claim(x, z, 2, 3);
  }
  cog(m, 70, 100, 4);
  cog(m, 20, 60, 3);
  const rng = new Rng(seed ^ 0x51a7);
  for (let tries = 0, built = 0; tries < 400 && built < 22; tries++) if (factoryBlock(m, rng, rng.int(8, 120), rng.int(8, 120))) built++;
  // The magnet's heap of junk, the steel shutter, the boiler-room doors, and
  // the doors of Mainspring Hall.
  rampGate(m, path, 3, 1, (x, y, z, i) => (i < 4 ? ((x * 3 + z + i) % 3 ? B.CRATE : GRAY) : 0));
  rampGate(m, path, 8, 2, (x, y, z, i) => (i % 2 ? GRAY : CHARCOAL), { thick: 1 });
  rampGate(m, path, 11, 3, (x, y, z, i) => (i === 2 ? YELLOW : BROWN), { thick: 1 });
  rampGate(m, path, 14, 4, (x, y, z, i) => (i === 3 ? ORANGE : B.BRICK_WALL), { thick: 1, high: 5 });
  m.trees(900, 7, (x, z, y, rng2) => (m.world.get(x, y, z) === B.PEBBLES && rng2.chance(0.3) ? oakTree(rng2) : null));
  m.flowers(6);
  m.animals({ dog: 2 }, (x, z) => z > 90);
  return { fruit: B.FRUIT_ITEMS[6 % B.FRUIT_ITEMS.length] };
}

// ---------------------------------------------------------------- chapter 11

// A puff of cloud blocks floating at (cx, cy, cz).
function cloudPuff(m, cx, cy, cz, r) {
  for (let x = Math.floor(cx - r * 1.6); x <= Math.ceil(cx + r * 1.6); x++) {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      for (let y = cy - 1; y <= cy + r; y++) {
        if (!m.inside(x, z, 0) || ((x - cx) / 1.6) ** 2 + (z - cz) ** 2 + ((y - cy) * 1.3) ** 2 > r * r) continue;
        if (m.world.get(x, y, z) === B.AIR) m.world.set(x, y, z, B.CLOUD);
      }
    }
  }
}

// Chapter 11, the Stormcloud Spires: great pillars of rock standing up out of
// the sea, each taller than the last, their tops green and the clouds drifting
// round them, joined by rainbow bridges. From the landing on the low island in
// the south-west the way crosses from spire to spire, by Rainbow Landing, the
// Windy Arch, Hawk's Perch and the Thunder Steps, to the Thunderhead Temple on
// the tallest of them all. Each bridge has a gate halfway over.
function spires(m) {
  const { seed } = m;
  m.pal.path = WHITE;
  m.pal.cliff = B.STONE;
  m.pal.rockAt = 99;
  m.pal.rail = B.FENCE;
  // (The decks are laid dark, then painted the rainbow's colours.)
  m.pal.deck = CHARCOAL;
  // Each spire: where, how wide and how high its top. The first is the low
  // island where everyone lands, with a beach to climb out of the sea onto.
  const SPIRES = [
    { x: 24, z: 104, r: 17, top: SEA + 4, beach: true },
    { x: 21, z: 51, r: 13, top: SEA + 10 },
    { x: 62, z: 22, r: 13, top: SEA + 16 },
    { x: 104, z: 41, r: 13, top: SEA + 22 },
    { x: 89, z: 92, r: 18, top: SEA + 28 },
    // And some no way goes to, for the look of it.
    { x: 60, z: 64, r: 6, top: SEA + 20 },
    { x: 116, z: 112, r: 5, top: SEA + 12 },
    { x: 8, z: 22, r: 5, top: SEA + 18 },
    { x: 58, z: 112, r: 6, top: SEA + 9 },
  ];
  m.shape((x, z) => {
    let h = SEA - 8;
    for (const s of SPIRES) {
      const d = Math.hypot(x - s.x, z - s.z) + fbm(seed + 71, x / 7, z / 7, 2) * 1.6;
      if (s.beach) {
        if (d < s.r + 6) h = Math.max(h, SEA - 3 + smooth((s.r + 6 - d) / 8) * (s.top - SEA + 3) + fbm(seed + 5, x / 6, z / 6, 2) * 0.5);
      } else if (d < s.r) {
        h = Math.max(h, s.top + fbm(seed + 23, x / 9, z / 9, 2) * 0.8);
      }
    }
    return h;
  });
  const path = m.route([
    { x: 15, z: 116 },
    { x: 24, z: 106 },
    { x: 30, z: 96, y: SEA + 4 },
    { x: 27, z: 89, bridge: true },
    { x: 23, z: 63 },
    { x: 21, z: 51, y: SEA + 10 },
    { x: 29, z: 43, bridge: true },
    { x: 51, z: 27 },
    { x: 62, z: 22, y: SEA + 16 },
    { x: 74, z: 26, bridge: true },
    { x: 93, z: 37 },
    { x: 104, z: 41, y: SEA + 22 },
    { x: 102, z: 53, bridge: true },
    { x: 95, z: 76 },
    { x: 89, z: 92, y: SEA + 28 },
  ], { slope: 0.6, blend: 0 });
  const cloud = { post: WHITE, lamp: B.LAMP, floor: SKY, bed: B.HAY };
  m.camp(path, 2, { blend: 2, style: cloud });
  m.camp(path, 5, { blend: 1, style: cloud });
  m.camp(path, 8, { blend: 1, style: cloud });
  m.camp(path, 11, { blend: 1, style: cloud });
  m.camp(path, 14, { kind: 'castle', blend: 1, style: { wall: WHITE, tower: SKY, stripe: YELLOW, top: WHITE, floor: B.STAR_BLOCK } });
  m.finish();
  // The bridges in all the colours of the rainbow.
  const RAINBOW = [RED, ORANGE, YELLOW, LIME, SKY, BLUE, PURPLE];
  const { world } = m;
  for (let x = 0; x < m.S; x++) {
    for (let z = 0; z < m.S; z++) {
      for (let y = SEA + 3; y < SEA + 32; y++) {
        if (world.get(x, y, z) !== CHARCOAL) continue;
        const near = m.bridges.reduce((best, p) => (Math.hypot(p.x - x - 0.5, p.z - z - 0.5) < best.d ? { d: Math.hypot(p.x - x - 0.5, p.z - z - 0.5), p } : best), { d: Infinity, p: null });
        if (near.p && near.d < 3.5) world.set(x, y, z, RAINBOW[Math.floor(near.p.s / 2.5) % RAINBOW.length]);
      }
    }
  }
  // Clouds drifting round the spires, high over the bridges.
  for (const [x, y, z, r] of [[44, SEA + 36, 70, 3], [80, SEA + 38, 60, 4], [20, SEA + 33, 78, 3], [110, SEA + 40, 76, 3], [42, SEA + 37, 10, 3], [70, SEA + 41, 110, 4], [100, SEA + 35, 14, 3]]) cloudPuff(m, x, y, z, r);
  // A rainbow wall across each bridge, halfway over.
  m.gate(path, 3, 1, (x, y, z, i) => RAINBOW[(i + 7) % 7], { high: 5, span: 3, thick: 1, mid: true });
  m.gate(path, 6, 2, (x, y, z, i) => (i % 2 ? WHITE : SKY), { high: 5, span: 3, thick: 1, mid: true });
  m.gate(path, 9, 3, (x, y, z, i) => (i === 2 ? B.LAMP : WHITE_CLOTH), { high: 5, span: 3, thick: 1, mid: true });
  m.gate(path, 12, 4, (x, y, z, i) => (i === 3 ? YELLOW : WHITE), { high: 5, span: 3, thick: 1, mid: true });
  m.trees(2400, 5, (x, z, y, rng) => (m.world.get(x, y, z) !== B.GRASS ? null : rng.chance(0.4) ? oakTree(rng) : rng.chance(0.3) ? pineTree(rng) : null));
  m.flowers(24);
  m.animals({ sheep: 3, bunny: 2 }, (x, z) => Math.hypot(x - 24, z - 104) < 16);
  return { fruit: B.FRUIT_ITEMS[1] };
}

const CHAPTER_MAPS = { shore, woods, frost, candy, dunes, marsh, caverns, hollow, ember, works, spires, castle };

// ---------------------------------------------------------------- the isle

// The island of a stage of Adventure Isle: the map of its chapter, from the
// stage's seed (which only settles the trees, flowers and the like: the
// lie of the land is the chapter's own). Returns what worldgen.generate
// does — { world, critters, fruit, mines, defense } — and its camps (as
// adventure.js AdventureSim takes them) and gates: each { camp, x, y, z,
// cells } (cells as an edit, what they become once that camp is freed).
export function buildIsle({ stage = 1, seed = 1, journey = 1 } = {}) {
  const ch = chapterOf(stage);
  const make = CHAPTER_MAPS[ch.key] ?? shore;
  const m = new Maker(ch, seed >>> 0 || 1);
  const made = make(m) ?? {};
  const { world } = m;
  // Everyone arrives where the way starts, looking along it.
  const way = m.routes[0].pts;
  const sx = Math.floor(way[0].x);
  const sz = Math.floor(way[0].z);
  const ahead = way[Math.min(way.length - 1, 25)];
  world.spawn = { x: sx + 0.5, y: m.ground(sx, sz) + 1, z: sz + 0.5, yaw: yawTo(sx + 0.5, sz + 0.5, ahead.x, ahead.z) };
  const rng = new Rng(seed ^ 0x13198a2e);
  const critters = m.clearOfCamps([...m.critters, ...placeFlyers(world, rng), ...placeSea(world, rng), ...placePolar(world, rng)]);
  const camps = m.spots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.kind === 'castle') - (b.s.kind === 'castle') || a.i - b.i)
    .map(({ s }, i) => ({ id: i + 1, kind: s.kind, x: s.x, y: s.level + 1, z: s.z, r: s.r }));
  const out = { world, critters, fruit: made.fruit ?? B.FRUIT_ITEMS[0], mines: [], camps, defense: null, gates: m.gates, chestSpots: m.chestSpots(), debug: { routes: m.routes, spots: m.spots } };
  // Told again on a later journey, a chapter is its own map turned over:
  // mirrored left to right on journey 2, top to bottom on journey 3, both on
  // journey 4, and so on round again — the way going the other way round.
  const turn = ((Number.isInteger(journey) && journey >= 1 ? journey : 1) - 1) % 4;
  if (turn) mirror(out, turn !== 2, turn !== 1);
  return out;
}

// A map turned over, mirrored side to side (along x) and/or top to bottom
// (along z): its blocks (furniture turned to match), where everyone arrives
// and which way they look, the camps, the gates and the animals.
function mirror(made, alongX, alongZ) {
  const { world } = made;
  const { W, D, H } = world;
  const fx = (x) => (alongX ? W - x : x);
  const fz = (z) => (alongZ ? D - z : z);
  const old = world.blocks.slice();
  const flip = (id) => {
    const d = B.block(id);
    if (!d.turns) return id;
    let front = d.front;
    if (alongX && (front === 0 || front === 2)) front = 2 - front;
    if (alongZ && (front === 1 || front === 3)) front = 4 - front;
    return B.turnedTo(id, front);
  };
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const from = ((alongX ? W - 1 - x : x) * D + (alongZ ? D - 1 - z : z)) * H;
      const to = (x * D + z) * H;
      for (let y = 0; y < H; y++) world.blocks[to + y] = flip(old[from + y]);
    }
  }
  // A look along (dx, dz) is yaw atan2(-dx, -dz): mirroring one of them flips it.
  const yaw = (y) => (alongX && alongZ ? y + Math.PI : alongX ? -y : alongZ ? Math.PI - y : y);
  world.spawn = { ...world.spawn, x: fx(world.spawn.x), z: fz(world.spawn.z), yaw: yaw(world.spawn.yaw) };
  for (const c of made.camps) Object.assign(c, { x: fx(c.x), z: fz(c.z) });
  for (const c of made.critters) Object.assign(c, { x: fx(c.x), z: fz(c.z), ...(Number.isFinite(c.yaw) ? { yaw: alongX && alongZ ? c.yaw + Math.PI : alongX ? -c.yaw : alongZ ? Math.PI - c.yaw : c.yaw } : {}) });
  for (const at of made.chestSpots) {
    if (alongX) at[0] = W - 1 - at[0];
    if (alongZ) at[2] = D - 1 - at[2];
  }
  for (const g of made.gates) {
    g.x = alongX ? W - 1 - g.x : g.x;
    g.z = alongZ ? D - 1 - g.z : g.z;
    for (let i = 0; i < g.cells.length; i += 4) {
      if (alongX) g.cells[i] = W - 1 - g.cells[i];
      if (alongZ) g.cells[i + 2] = D - 1 - g.cells[i + 2];
      g.cells[i + 3] = flip(g.cells[i + 3]);
    }
  }
  made.debug = null;
}
