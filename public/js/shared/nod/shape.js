// The shapes of the Land of Nod (Adventure Isle's sixth episode, isle-story.js):
// worlds of no blocks at all, and no island either, but bodies of any shape
// hanging in the sky — balls, logs, rings, coins, tubes to run round the inside
// of, a band with one side only — each with a pull of its own, so that down is
// towards whichever of them you are on, and you can walk right round every one.
//
// A body is a skeleton (a point, a line, a ring, a disc...) and how thick it is
// round it. Down, anywhere, is towards the nearest point of the skeleton: that
// alone makes every one of them a world to walk on, over its edges and all the
// way round. Bumps melt on to it (hills) or are cut out of it (craters), and
// what stands on it (posts, buttons, mushrooms) are props, solid but not
// walked round.
//
// Everything is measured as a distance (how far a point is from the nearest
// thing, less than 0 inside it), so whoever walks on it (walker.js), the
// foes (foes.js), the camera and the drawing of it (render/nod/) all go by the
// same numbers, on every page and on the host.

// ---------------------------------------------------------------- vectors

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const set = (o, a) => {
  o.x = a.x;
  o.y = a.y;
  o.z = a.z;
  return o;
};
export const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const unit = (a) => {
  const l = len(a);
  return l > 1e-9 ? mul(a, 1 / l) : { x: 0, y: 1, z: 0 };
};
// What is left of a with its part along n (a unit way) taken out, and that as
// a unit way (any at all, if nothing is left).
export const flat = (a, n) => add(a, n, -dot(a, n));
export const flatUnit = (a, n) => {
  const f = flat(a, n);
  const l = len(f);
  if (l > 1e-6) return mul(f, 1 / l);
  const other = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  return unit(flat(other, n));
};
// a turned by angle t round the unit way n.
export const turn = (a, n, t) => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const d = dot(a, n) * (1 - c);
  const x = cross(n, a);
  return { x: a.x * c + x.x * s + n.x * d, y: a.y * c + x.y * s + n.y * d, z: a.z * c + x.z * s + n.z * d };
};
// a carried from where up was u to where it is w, as it would be slid along
// the ground between: turned just as far as up turned.
export const carry = (a, u, w) => {
  const c = dot(u, w);
  if (c > 0.999999) return { ...a };
  const n = cross(u, w);
  const s = len(n);
  if (s < 1e-6) return { ...a };
  return turn(a, mul(n, 1 / s), Math.atan2(s, c));
};

// A way along the ground as one number, as the wire carries it: how far round
// from the way the ground's own south would be, were it tipped over from lying
// flat by the shortest way. And back.
const southOf = (u) => carry({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }, u);
const eastOf = (u) => carry({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, u);
export const yawOf = (h, u) => Math.atan2(dot(h, eastOf(u)), dot(h, southOf(u)));
export const headingOf = (yaw, u) => add(mul(southOf(u), Math.cos(yaw)), eastOf(u), Math.sin(yaw));

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// ---------------------------------------------------------------- skeletons
// near(x, y, z, o): the nearest point of it, put in o.x, o.y, o.z, with o.k
// (how thick the body is there, as a share of its thickness). reach: how far
// off its middle (c) any of it is.

export class Dot {
  constructor(c) {
    this.c = c;
    this.reach = 0;
  }

  near(x, y, z, o) {
    o.x = this.c.x;
    o.y = this.c.y;
    o.z = this.c.z;
    o.k = 1;
  }
}

// A line through points, as thick at each as ks says (1 for all, if none).
export class Chain {
  constructor(points, ks = null) {
    this.points = points;
    this.ks = ks;
    const lo = { x: Infinity, y: Infinity, z: Infinity };
    const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const p of points) {
      for (const a of ['x', 'y', 'z']) {
        lo[a] = Math.min(lo[a], p[a]);
        hi[a] = Math.max(hi[a], p[a]);
      }
    }
    this.c = mul(add(lo, hi), 0.5);
    this.reach = Math.max(...points.map((p) => dist3(p, this.c)));
  }

  near(x, y, z, o) {
    const ps = this.points;
    let best = Infinity;
    for (let i = 0; i + 1 < ps.length; i++) {
      const a = ps[i];
      const b = ps[i + 1];
      const bx = b.x - a.x;
      const by = b.y - a.y;
      const bz = b.z - a.z;
      const l2 = bx * bx + by * by + bz * bz;
      const t = Math.min(1, Math.max(0, ((x - a.x) * bx + (y - a.y) * by + (z - a.z) * bz) / l2));
      const px = a.x + bx * t;
      const py = a.y + by * t;
      const pz = a.z + bz * t;
      const k = this.ks ? this.ks[i] + (this.ks[i + 1] - this.ks[i]) * t : 1;
      // (The nearest surface, not the nearest line: a thick stretch further
      // off counts before a thin one nearer.)
      const d = Math.hypot(x - px, y - py, z - pz) - k * this.weigh;
      if (d < best) {
        best = d;
        o.x = px;
        o.y = py;
        o.z = pz;
        o.k = k;
      }
    }
  }
}
Chain.prototype.weigh = 0;

// A ring of radius R round axis (a unit way).
export class Loop {
  constructor(c, axis, R) {
    Object.assign(this, { c, axis: unit(axis), R, reach: R });
  }

  near(x, y, z, o) {
    const { c, axis: n, R } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const h = vx * n.x + vy * n.y + vz * n.z;
    let rx = vx - n.x * h;
    let ry = vy - n.y * h;
    let rz = vz - n.z * h;
    const l = Math.hypot(rx, ry, rz);
    if (l < 1e-6) {
      const f = flatUnit({ x: 0.3, y: 0.5, z: 0.8 }, n);
      rx = f.x;
      ry = f.y;
      rz = f.z;
    } else {
      rx /= l;
      ry /= l;
      rz /= l;
    }
    o.x = c.x + rx * R;
    o.y = c.y + ry * R;
    o.z = c.z + rz * R;
    o.k = 1;
  }
}

// A flat disc of radius R across axis.
export class Plate {
  constructor(c, axis, R) {
    Object.assign(this, { c, axis: unit(axis), R, reach: R });
  }

  near(x, y, z, o) {
    const { c, axis: n, R } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const h = vx * n.x + vy * n.y + vz * n.z;
    const rx = vx - n.x * h;
    const ry = vy - n.y * h;
    const rz = vz - n.z * h;
    const l = Math.hypot(rx, ry, rz);
    const s = l > R ? R / l : 1;
    o.x = c.x + rx * s;
    o.y = c.y + ry * s;
    o.z = c.z + rz * s;
    o.k = 1;
  }
}

// A box hx, hy, hz either way of its middle along its own axes X, Y, Z (hy 0:
// a flat sheet).
export class Crate {
  constructor(c, X, Y, hx, hy, hz) {
    this.c = c;
    this.Y = unit(Y);
    this.X = flatUnit(X, this.Y);
    this.Z = cross(this.X, this.Y);
    Object.assign(this, { hx, hy, hz, reach: Math.hypot(hx, hy, hz) });
  }

  near(x, y, z, o) {
    const { c, X, Y, Z } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const a = Math.min(this.hx, Math.max(-this.hx, vx * X.x + vy * X.y + vz * X.z));
    const b = Math.min(this.hy, Math.max(-this.hy, vx * Y.x + vy * Y.y + vz * Y.z));
    const d = Math.min(this.hz, Math.max(-this.hz, vx * Z.x + vy * Z.y + vz * Z.z));
    o.x = c.x + X.x * a + Y.x * b + Z.x * d;
    o.y = c.y + X.y * a + Y.y * b + Z.y * d;
    o.z = c.z + X.z * a + Y.z * b + Z.z * d;
    o.k = 1;
  }
}

// A cylinder's wall of radius R, half either way along axis, open at both
// ends: a body round it is a tube, to walk round the inside of as well.
export class Can {
  constructor(c, axis, R, half) {
    Object.assign(this, { c, axis: unit(axis), R, half, reach: Math.hypot(R, half) });
  }

  near(x, y, z, o) {
    const { c, axis: n, R, half } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const h = vx * n.x + vy * n.y + vz * n.z;
    let rx = vx - n.x * h;
    let ry = vy - n.y * h;
    let rz = vz - n.z * h;
    const l = Math.hypot(rx, ry, rz);
    if (l < 1e-6) {
      const f = flatUnit({ x: 0.3, y: 0.5, z: 0.8 }, n);
      rx = f.x;
      ry = f.y;
      rz = f.z;
    } else {
      rx /= l;
      ry /= l;
      rz /= l;
    }
    const t = Math.min(half, Math.max(-half, h));
    o.x = c.x + n.x * t + rx * R;
    o.y = c.y + n.y * t + ry * R;
    o.z = c.z + n.z * t + rz * R;
    o.k = 1;
  }
}

// A band round a ring of radius R, w either way across, turned over by
// `twists` whole turns on its way round (a half: it has one side only, and
// walking right round it comes back to the same spot on the other side).
export class Band {
  constructor(c, axis, R, w, twists = 0.5) {
    this.c = c;
    this.axis = unit(axis);
    this.U = flatUnit({ x: 0.37, y: 0.21, z: 0.9 }, this.axis);
    this.V = cross(this.axis, this.U);
    Object.assign(this, { R, w, twists, reach: R + w });
  }

  // The band's frame at angle a: the way out of the ring, and the way across it.
  frame(a) {
    const { U, V, axis } = this;
    const out = add(mul(U, Math.cos(a)), V, Math.sin(a));
    const t = a * this.twists;
    return { out, across: add(mul(out, Math.cos(t)), axis, Math.sin(t)) };
  }

  near(x, y, z, o) {
    const { c, axis: n, U, V, R } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const h = vx * n.x + vy * n.y + vz * n.z;
    const pu = vx * U.x + vy * U.y + vz * U.z;
    const pv = vx * V.x + vy * V.y + vz * V.z;
    const l = Math.hypot(pu, pv) || 1e-6;
    const a = Math.atan2(pv, pu);
    const t = a * this.twists;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const s = Math.min(this.w, Math.max(-this.w, (l - R) * ct + h * st));
    const out = R + s * ct;
    const ox = (U.x * pu + V.x * pv) / l;
    const oy = (U.y * pu + V.y * pv) / l;
    const oz = (U.z * pu + V.z * pv) / l;
    o.x = c.x + ox * out + n.x * s * st;
    o.y = c.y + oy * out + n.y * s * st;
    o.z = c.z + oz * out + n.z * s * st;
    o.k = 1;
  }
}

// ---------------------------------------------------------------- props

// How far (x, y, z) is from something standing on a body: a post or a log (a
// to b), a ball, or a box (its middle, its axes, half as big as h, its edges
// rounded by r).
export class Post {
  constructor(a, b, r, rb = r) {
    Object.assign(this, { a, b, r, rb });
    this.c = mul(add(a, b), 0.5);
    this.reach = dist3(a, b) / 2 + Math.max(r, rb);
  }

  at(x, y, z) {
    const { a, b } = this;
    const bx = b.x - a.x;
    const by = b.y - a.y;
    const bz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((x - a.x) * bx + (y - a.y) * by + (z - a.z) * bz) / (bx * bx + by * by + bz * bz)));
    return Math.hypot(x - a.x - bx * t, y - a.y - by * t, z - a.z - bz * t) - (this.r + (this.rb - this.r) * t);
  }
}

export class Ball {
  constructor(c, r) {
    Object.assign(this, { c, r, reach: r });
  }

  at(x, y, z) {
    return Math.hypot(x - this.c.x, y - this.c.y, z - this.c.z) - this.r;
  }
}

export class Block {
  constructor(c, X, Y, h, r = 0.1) {
    this.c = c;
    this.Y = unit(Y);
    this.X = flatUnit(X, this.Y);
    this.Z = cross(this.X, this.Y);
    this.h = h;
    this.r = r;
    this.reach = Math.hypot(h.x, h.y, h.z) + r;
  }

  at(x, y, z) {
    const { c, X, Y, Z, h } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const a = Math.abs(vx * X.x + vy * X.y + vz * X.z) - h.x;
    const b = Math.abs(vx * Y.x + vy * Y.y + vz * Y.z) - h.y;
    const d = Math.abs(vx * Z.x + vy * Z.y + vz * Z.z) - h.z;
    return Math.hypot(Math.max(a, 0), Math.max(b, 0), Math.max(d, 0)) + Math.min(0, Math.max(a, b, d)) - this.r;
  }
}

// A flat drum (a short cylinder): its middle, the way it stands, how wide and
// how high either way, its rim rounded by e.
export class Drum {
  constructor(c, Y, r, half, e = 0.08) {
    this.c = c;
    this.Y = unit(Y);
    Object.assign(this, { r, half, e, reach: Math.hypot(r, half) });
  }

  at(x, y, z) {
    const { c, Y } = this;
    const vx = x - c.x;
    const vy = y - c.y;
    const vz = z - c.z;
    const h = vx * Y.x + vy * Y.y + vz * Y.z;
    const a = Math.hypot(vx - Y.x * h, vy - Y.y * h, vz - Y.z * h) - this.r + this.e;
    const b = Math.abs(h) - this.half + this.e;
    return Math.min(Math.max(a, b), 0) + Math.hypot(Math.max(a, 0), Math.max(b, 0)) - this.e;
  }
}

// ---------------------------------------------------------------- bodies

const tmp = { x: 0, y: 0, z: 0, k: 1 };

// A body: its key, skeleton and thickness r; bumps ({ c or a and b, r, k (how
// softly it melts on), cut }); ripple(x, y, z, o): how much thicker it is there
// (less than 0, thinner), o the nearest point of the skeleton; skin, how it is
// drawn (render/nod/); cell, how finely. Props are added to it as it is dressed.
export class Body {
  constructor(key, skel, r, { bumps = [], ripple = null, skin = 'plain', cell = 0.5, ...more } = {}) {
    Object.assign(this, { key, skel, r, ripple, skin, cell }, more);
    if (skel instanceof Chain) skel.weigh = r;
    this.bumps = bumps.map((b) => {
      const part = b.a ? new Post(b.a, b.b, b.r, b.rb ?? b.r) : new Ball(b.c, b.r);
      return { part, k: b.k ?? 1.5, cut: Boolean(b.cut) };
    });
    this.c = skel.c;
    this.props = [];
    this.measure();
  }

  // How far off its middle anything of it can be.
  measure() {
    let far = this.skel.reach + this.r * 1.3 + 1;
    for (const b of this.bumps) if (!b.cut) far = Math.max(far, dist3(b.part.c, this.c) + b.part.reach + b.k);
    for (const p of this.props) far = Math.max(far, dist3(p.c, this.c) + p.reach);
    this.reach = far;
  }

  addProp(p) {
    this.props.push(p);
    this.measure();
  }

  // How far off its skin, not counting its bumps, (x, y, z) is.
  base(x, y, z) {
    this.skel.near(x, y, z, tmp);
    const d = Math.hypot(x - tmp.x, y - tmp.y, z - tmp.z) - this.r * tmp.k;
    return this.ripple ? d - this.ripple(x, y, z, tmp) : d;
  }

  // The ground of it: with its bumps.
  ground(x, y, z) {
    let d = this.base(x, y, z);
    for (const b of this.bumps) {
      const e = Math.hypot(x - b.part.c.x, y - b.part.c.y, z - b.part.c.z) - b.part.reach;
      if (b.cut) {
        if (e > -d + b.k && e > 0) continue;
        d = smax(d, -b.part.at(x, y, z), b.k);
      } else {
        if (e > d + b.k) continue;
        d = smin(d, b.part.at(x, y, z), b.k);
      }
    }
    return d;
  }

  // Anything solid of it: its ground and its props.
  solid(x, y, z) {
    let d = this.ground(x, y, z);
    for (const p of this.props) {
      const dx = x - p.c.x;
      const dy = y - p.c.y;
      const dz = z - p.c.z;
      const reach = d + p.reach;
      if (reach <= 0 || dx * dx + dy * dy + dz * dz > reach * reach) continue;
      d = Math.min(d, p.at(x, y, z));
    }
    return d;
  }

  // Only its props (for walking round them): far off, a big number.
  clutter(x, y, z) {
    let d = 1e3;
    for (const p of this.props) {
      const dx = x - p.c.x;
      const dy = y - p.c.y;
      const dz = z - p.c.z;
      const reach = Math.min(d, 8) + p.reach;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      d = Math.min(d, p.at(x, y, z));
    }
    return d;
  }

  // Which way is up there (a unit way, put in o).
  up(x, y, z, o = {}) {
    this.skel.near(x, y, z, tmp);
    const dx = x - tmp.x;
    const dy = y - tmp.y;
    const dz = z - tmp.z;
    const l = Math.hypot(dx, dy, dz);
    if (l < 1e-6) {
      o.x = 0;
      o.y = 1;
      o.z = 0;
    } else {
      o.x = dx / l;
      o.y = dy / l;
      o.z = dz / l;
    }
    return o;
  }

  // The way out of its ground there.
  slope(x, y, z, o = {}, e = 0.05) {
    const a = this.ground(x + e, y - e, z - e);
    const b = this.ground(x - e, y - e, z + e);
    const c = this.ground(x - e, y + e, z - e);
    const f = this.ground(x + e, y + e, z + e);
    o.x = a - b - c + f;
    o.y = -a - b + c + f;
    o.z = -a + b - c + f;
    const l = Math.hypot(o.x, o.y, o.z) || 1;
    o.x /= l;
    o.y /= l;
    o.z /= l;
    return o;
  }

  // The point of its ground nearest (x, y, z), near enough.
  land(p, tries = 10) {
    const q = { x: p.x, y: p.y, z: p.z };
    const n = {};
    for (let i = 0; i < tries; i++) {
      const d = this.ground(q.x, q.y, q.z);
      if (Math.abs(d) < 0.004) break;
      this.slope(q.x, q.y, q.z, n);
      q.x -= n.x * d;
      q.y -= n.y * d;
      q.z -= n.z * d;
    }
    return q;
  }

  // A spot on its ground the way `off` is from its middle, coming down on it
  // from outside: { x, y, z, up, body }.
  spot(off) {
    const l = len(off) || 1;
    const p = add(this.c, off, l < this.reach ? 1 : this.reach / l);
    return this.spotNear(p);
  }

  spotNear(p) {
    const q = this.land(p);
    return { ...q, up: this.up(q.x, q.y, q.z), body: this };
  }

  // A walk over its ground from p, off the way dir is, `far` long in steps:
  // the points of it, p first, each { x, y, z, up, dir }.
  walk(p, dir, far, step = 0.8) {
    let q = { x: p.x, y: p.y, z: p.z };
    let up = this.up(q.x, q.y, q.z);
    let way = flatUnit(dir, up);
    const out = [{ ...q, up, dir: way }];
    const n = Math.max(1, Math.ceil(far / step));
    const s = far / n;
    for (let i = 0; i < n; i++) {
      q = this.land(add(q, way, s), 5);
      const next = this.up(q.x, q.y, q.z);
      way = flatUnit(carry(way, up, next), next);
      up = next;
      out.push({ ...q, up, dir: way });
    }
    return out;
  }
}

// ---------------------------------------------------------------- a sky of them

// All the bodies of a world.
export class Space {
  constructor(bodies) {
    this.bodies = bodies;
    this.byKey = new Map(bodies.map((b) => [b.key, b]));
    bodies.forEach((b, i) => {
      b.n = i;
    });
    const lo = { x: Infinity, y: Infinity, z: Infinity };
    const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const b of bodies) {
      for (const a of ['x', 'y', 'z']) {
        lo[a] = Math.min(lo[a], b.c[a] - b.reach);
        hi[a] = Math.max(hi[a], b.c[a] + b.reach);
      }
    }
    this.lo = lo;
    this.hi = hi;
    this.c = mul(add(lo, hi), 0.5);
    this.reach = dist3(lo, hi) / 2;
  }

  // The body whose pull is felt at (x, y, z): the nearest (the one it was,
  // prev, unless another is nearer by a good bit, so nobody flickers between).
  bodyAt(x, y, z, prev = null) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.bodies) {
      const far = Math.hypot(x - b.c.x, y - b.c.y, z - b.c.z) - b.reach;
      if (far > bestD) continue;
      const d = b.base(x, y, z) - (b === prev ? 0.9 : 0);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  up(x, y, z, o = {}, prev = null) {
    return (this.bodyAt(x, y, z, prev) ?? this.bodies[0]).up(x, y, z, o);
  }

  // How far the nearest solid thing is. Further off than `far`, only roughly.
  dist(x, y, z, far = 4) {
    let d = 1e3;
    for (const b of this.bodies) {
      const e = Math.hypot(x - b.c.x, y - b.c.y, z - b.c.z) - b.reach;
      if (e > far || e > d) {
        d = Math.min(d, Math.max(e, 0.5));
        continue;
      }
      d = Math.min(d, b.solid(x, y, z));
    }
    return d;
  }

  normal(x, y, z, o = {}, e = 0.03) {
    const a = this.dist(x + e, y - e, z - e);
    const b = this.dist(x - e, y - e, z + e);
    const c = this.dist(x - e, y + e, z - e);
    const f = this.dist(x + e, y + e, z + e);
    o.x = a - b - c + f;
    o.y = -a - b + c + f;
    o.z = -a + b - c + f;
    const l = Math.hypot(o.x, o.y, o.z);
    if (l < 1e-9) return this.up(x, y, z, o);
    o.x /= l;
    o.y /= l;
    o.z /= l;
    return o;
  }

  // How far a ray from p the way d is goes before it comes within r of
  // anything solid, at most max.
  ray(p, d, max, r = 0.1) {
    let t = 0;
    for (let i = 0; i < 64 && t < max; i++) {
      const e = this.dist(p.x + d.x * t, p.y + d.y * t, p.z + d.z * t, 6) - r;
      if (e < 0.02) return t;
      t += Math.max(0.05, Math.min(e, 2.5));
    }
    return max;
  }

  // How high over the ground of the body it is on something at p is, straight
  // down from it, at most max (null if nothing is under it by then).
  under(p, body, max = 12) {
    const up = body.up(p.x, p.y, p.z);
    const t = this.ray(add(p, up, 0.3), mul(up, -1), max + 0.3, 0);
    return t >= max + 0.3 ? null : Math.max(0, t - 0.3);
  }
}
