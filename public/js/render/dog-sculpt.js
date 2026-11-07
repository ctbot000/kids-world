// Shapes sculpted as distances: how far a point is from each part of a dog
// (a round cone, a blob, a thin plate for an ear), the parts melted together
// as clay is, and a skin wrapped over the result. A skin made this way has no
// seams where a leg goes into a body or a muzzle grows out of a skull, which
// is what balls and tubes stuck together can never look like.
//
// No three.js here: only numbers, so that it can be measured anywhere.

export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (a, b, v) => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// Melting two distances together, over a width of k.
const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// What every part knows: which bone it moves with and what it counts as
// (tag, for the coat and the fur); the way the hair on it runs (a part's own
// axis, the way flow says); how far its pull on the skin reaches (reach); and
// on which side of the body it is (side), so a left leg never pulls the right.
class Part {
  constructor({ k = 0.03, bone = 0, tip = -1, tag = 'torso', flow = 1, side = 0, reach = 0.05, hair = null, cut = false }) {
    this.k = k;
    this.bone = bone;
    this.tip = tip;
    this.tag = tag;
    this.flow = flow;
    this.side = side;
    this.reach = reach;
    // The way its hair runs, if not along its axis.
    this.hair = hair;
    this.cut = cut;
  }
}

// A round cone from a (radius ra) to b (radius rb), flattened from side to
// side by flat. Its x is measured from its axis, so a flat one stays where
// it is put.
export class Cone extends Part {
  constructor(a, b, ra, rb, o = {}) {
    super(o);
    this.a = a;
    this.b = b;
    this.ra = ra;
    this.rb = rb;
    this.flat = o.flat ?? 1;
    this.mx = (a[0] + b[0]) / 2;
    const f = this.flat;
    this.bx = (b[0] - this.mx) / f - (a[0] - this.mx) / f;
    this.ax = (a[0] - this.mx) / f;
    this.by = b[1] - a[1];
    this.bz = b[2] - a[2];
    this.l2 = this.bx * this.bx + this.by * this.by + this.bz * this.bz;
    this.rr = ra - rb;
    this.a2 = this.l2 - this.rr * this.rr;
    this.il2 = 1 / this.l2;
    this.shrink = Math.min(1, f);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    this.axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];
    this.c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.r = len / 2 + Math.max(ra, rb);
  }

  at(x, y, z) {
    const px = (x - this.mx) / this.flat - this.ax;
    const py = y - this.a[1];
    const pz = z - this.a[2];
    const { bx, by, bz, l2, rr, a2, il2 } = this;
    const dot = px * bx + py * by + pz * bz;
    const zz = dot - l2;
    const cx = px * l2 - bx * dot;
    const cy = py * l2 - by * dot;
    const cz = pz * l2 - bz * dot;
    const x2 = cx * cx + cy * cy + cz * cz;
    const y2 = dot * dot * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    let d;
    if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - this.rb;
    else if (Math.sign(dot) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - this.ra;
    else d = (Math.sqrt(x2 * a2 * il2) + dot * rr) * il2 - this.ra;
    return d * this.shrink;
  }

  // How far along it (x, y, z) is: 0 at a, 1 at b.
  along(x, y, z) {
    const [ux, uy, uz] = this.axis;
    const len = Math.sqrt(this.l2) || 1;
    return clamp(((x - this.a[0]) * ux + (y - this.a[1]) * uy + (z - this.a[2]) * uz) / len);
  }
}

// An egg of radii rad about c, its top tipped forwards by pitch.
export class Blob extends Part {
  constructor(c, rad, o = {}) {
    super(o);
    this.c = c;
    this.rad = rad;
    this.cos = Math.cos(o.pitch ?? 0);
    this.sin = Math.sin(o.pitch ?? 0);
    this.r = Math.max(...rad);
    this.axis = [0, -this.sin, -this.cos];
  }

  at(x, y, z) {
    const px = x - this.c[0];
    const qy = y - this.c[1];
    const qz = z - this.c[2];
    const py = qy * this.cos - qz * this.sin;
    const pz = qy * this.sin + qz * this.cos;
    const [rx, ry, rz] = this.rad;
    const k0 = Math.hypot(px / rx, py / ry, pz / rz);
    if (k0 < 1e-5) return -Math.min(rx, ry, rz);
    const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
    return (k0 * (k0 - 1)) / k1;
  }

  along() {
    return 0.5;
  }
}

// A thin plate, as an ear is: from a along u (a unit way) for len, round at
// both ends, ra wide at a and rb wide at its tip, th thick, with v the way
// across it and n the way its face looks. cup hollows its face; curl bends it
// over backwards as it goes along.
export class Plate extends Part {
  constructor(a, u, v, n, len, ra, rb, th, o = {}) {
    super(o);
    this.a = a;
    this.u = u;
    this.v = v;
    this.n = n;
    this.len = len;
    this.ra = ra;
    this.rb = rb;
    this.th = th;
    this.cup = o.cup ?? 0;
    this.curl = o.curl ?? 0;
    this.l2 = len * len;
    this.rr = ra - rb;
    this.a2 = this.l2 - this.rr * this.rr;
    this.axis = u;
    this.c = [a[0] + (u[0] * len) / 2, a[1] + (u[1] * len) / 2, a[2] + (u[2] * len) / 2];
    this.r = len / 2 + Math.max(ra, rb) + th + Math.abs(this.curl) * this.l2;
  }

  at(x, y, z) {
    const { a, u, v, n, l2, rr, a2 } = this;
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const s = px * u[0] + py * u[1] + pz * u[2];
    const w = Math.abs(px * v[0] + py * v[1] + pz * v[2]);
    const h = px * n[0] + py * n[1] + pz * n[2] - this.cup * w * w + this.curl * s * s;
    // The round cone in the plate's own plane (as in Cone, with its axis along s).
    const yy = s * this.len;
    const zz = yy - l2;
    const x2 = w * w * l2 * l2;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    const il2 = 1 / l2;
    let flat;
    if (Math.sign(zz) * a2 * z2 > k) flat = Math.sqrt(x2 + z2) * il2 - this.rb;
    else if (Math.sign(yy) * a2 * y2 < k) flat = Math.sqrt(x2 + y2) * il2 - this.ra;
    else flat = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - this.ra;
    return smax(flat, Math.abs(h) - this.th, this.th * 0.9);
  }

  along(x, y, z) {
    const [ux, uy, uz] = this.u;
    return clamp(((x - this.a[0]) * ux + (y - this.a[1]) * uy + (z - this.a[2]) * uz) / this.len);
  }
}

// How far (x, y, z) is from a sculpture: its parts melted together in turn,
// with the cuts then taken out of it. A part too far off to matter is passed
// over, which is most of them for most points.
export class Sculpture {
  constructor(parts) {
    this.parts = parts.filter((p) => !p.cut);
    this.cuts = parts.filter((p) => p.cut);
    const cn = this.parts.length;
    this.cx = new Float64Array(cn);
    this.cy = new Float64Array(cn);
    this.cz = new Float64Array(cn);
    this.cr = new Float64Array(cn);
    this.parts.forEach((p, i) => {
      [this.cx[i], this.cy[i], this.cz[i]] = p.c;
      this.cr[i] = p.r + p.k;
    });
  }

  at(x, y, z) {
    let d = 1e3;
    const { parts, cx, cy, cz, cr } = this;
    for (let i = 0; i < parts.length; i++) {
      const dx = x - cx[i];
      const dy = y - cy[i];
      const dz = z - cz[i];
      const reach = d + cr[i];
      if (reach > 0 && dx * dx + dy * dy + dz * dz > reach * reach) continue;
      const p = parts[i];
      d = smin(d, p.at(x, y, z), p.k);
    }
    for (const c of this.cuts) d = smax(d, -c.at(x, y, z), c.k);
    return d;
  }

  // The box round it all, widened by margin.
  bounds(margin) {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const p of this.parts) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], p.c[i] - p.r - margin);
        hi[i] = Math.max(hi[i], p.c[i] + p.r + margin);
      }
    }
    return { lo, hi };
  }
}

// Lines across a range from lo to hi, about `cell` apart, but as close as
// each near [from, to, cell] asks for where it does.
export function gridLines(lo, hi, cell, near = []) {
  const at = [lo];
  let c = lo;
  while (c < hi) {
    let step = cell;
    for (const [from, to, fine] of near) if (c + fine > from && c < to) step = Math.min(step, fine);
    c += step;
    at.push(c);
  }
  return at;
}

// The same, the same both sides of 0.
export function mirrorLines(hi, cell, near = []) {
  const half = gridLines(cell / 2, hi, cell, near);
  return [...half.map((v) => -v).reverse(), ...half];
}

const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];
const EDGES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

// A skin over the sculpture (Surface Nets): the distance measured at every
// crossing of the grid lines, a point of skin in every little box the surface
// passes through, and a four-sided patch across every line it cuts. Only near
// the surface is it measured closely. mirrored: xs is the same both sides of
// 0 and so is the sculpture, so half of it needs no measuring.
export function skinOver(sculpture, xs, ys, zs, { mirrored = false } = {}) {
  const nx = xs.length;
  const ny = ys.length;
  const nz = zs.length;
  const nxy = nx * ny;
  const field = new Float32Array(nx * ny * nz);
  const from = mirrored ? Math.floor(nx / 2) : 0;
  const BLOCK = 4;
  for (let bk = 0; bk < nz; bk += BLOCK) {
    const k1 = Math.min(nz - 1, bk + BLOCK);
    for (let bj = 0; bj < ny; bj += BLOCK) {
      const j1 = Math.min(ny - 1, bj + BLOCK);
      for (let bi = from; bi < nx; bi += BLOCK) {
        const i1 = Math.min(nx - 1, bi + BLOCK);
        const mx = (xs[bi] + xs[i1]) / 2;
        const my = (ys[bj] + ys[j1]) / 2;
        const mz = (zs[bk] + zs[k1]) / 2;
        const half = Math.hypot(xs[i1] - xs[bi], ys[j1] - ys[bj], zs[k1] - zs[bk]) / 2;
        const mid = sculpture.at(mx, my, mz);
        const clear = Math.abs(mid) > half * 1.6;
        for (let k = bk; k <= k1; k++) {
          for (let j = bj; j <= j1; j++) {
            for (let i = bi; i <= i1; i++) {
              field[i + j * nx + k * nxy] = clear ? mid : sculpture.at(xs[i], ys[j], zs[k]);
            }
          }
        }
      }
    }
  }
  if (mirrored) {
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < from; i++) field[i + j * nx + k * nxy] = field[nx - 1 - i + j * nx + k * nxy];
  }
  const index = new Int32Array(nx * ny * nz).fill(-1);
  const points = [];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const o = i + j * nx + k * nxy;
        let mask = 0;
        const d = [];
        for (let c = 0; c < 8; c++) {
          const [a, b, e] = CORNERS[c];
          const v = field[o + a + b * nx + e * nxy];
          d.push(v);
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [p, q] of EDGES) {
          if ((d[p] < 0) === (d[q] < 0)) continue;
          const t = d[p] / (d[p] - d[q]);
          const [pa, pb, pe] = CORNERS[p];
          const [qa, qb, qe] = CORNERS[q];
          sx += lerp(xs[i + pa], xs[i + qa], t);
          sy += lerp(ys[j + pb], ys[j + qb], t);
          sz += lerp(zs[k + pe], zs[k + qe], t);
          n++;
        }
        index[o] = points.length / 3;
        points.push(sx / n, sy / n, sz / n);
      }
    }
  }
  const tris = [];
  const dist2 = (a, b) => (points[a * 3] - points[b * 3]) ** 2 + (points[a * 3 + 1] - points[b * 3 + 1]) ** 2 + (points[a * 3 + 2] - points[b * 3 + 2]) ** 2;
  const quad = (a, b, c, d, inside) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (!inside) [b, d] = [d, b];
    // Across the shorter way.
    if (dist2(a, c) <= dist2(b, d)) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const o = i + j * nx + k * nxy;
        const v = field[o] < 0;
        if (i < nx - 1 && j > 0 && j < ny - 1 && k > 0 && k < nz - 1 && v !== field[o + 1] < 0) quad(index[o - nx - nxy], index[o - nxy], index[o], index[o - nx], v);
        if (j < ny - 1 && i > 0 && i < nx - 1 && k > 0 && k < nz - 1 && v !== field[o + nx] < 0) quad(index[o - 1 - nxy], index[o - 1], index[o], index[o - nxy], v);
        if (k < nz - 1 && i > 0 && i < nx - 1 && j > 0 && j < ny - 1 && v !== field[o + nxy] < 0) quad(index[o - 1 - nx], index[o - nx], index[o], index[o - 1], v);
      }
    }
  }
  return { points: new Float32Array(points), tris };
}

// The way out of the surface at (x, y, z).
export function normalAt(sculpture, x, y, z, e = 0.004) {
  const d = sculpture;
  const a = d.at(x + e, y - e, z - e);
  const b = d.at(x - e, y - e, z + e);
  const c = d.at(x - e, y + e, z - e);
  const f = d.at(x + e, y + e, z + e);
  const nx = a - b - c + f;
  const ny = -a - b + c + f;
  const nz = -a + b - c + f;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

// Smooth random numbers from 0 to 1 at a point: for edges of markings that
// wander as real ones do, and how a coat lies.
const fract = (v) => v - Math.floor(v);
const hash = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
export function noise(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const c = (a, b, e) => hash(ix + a, iy + b, iz + e);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), ux), lerp(c(0, 1, 0), c(1, 1, 0), ux), uy), lerp(lerp(c(0, 0, 1), c(1, 0, 1), ux), lerp(c(0, 1, 1), c(1, 1, 1), ux), uy), uz);
}
