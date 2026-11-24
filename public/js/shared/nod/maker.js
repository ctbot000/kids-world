// How a dream of the Land of Nod is put together (worlds/): its bodies
// (shape.js) hung in the sky, what stands on them, the springs that fling you
// from one to another, its nightmares (what is to be fought, and where), its
// winks to find and its boss's own little world. Made the same on every page
// and on the host: nothing of it is sent, and nothing in it ever changes.
import { Rng } from '../rng.js';
import { add, Ball, Block, carry, cross, dist3, dot, Drum, flatUnit, mul, Post, Space, sub, unit, v3 } from './shape.js';

// What of each thing that stands on a body is solid, standing at s (a spot,
// with up and the way it faces, dir), `k` times its usual size.
const at = (s, up, side = 0, fwd = 0) => {
  const right = cross(s.up, s.dir);
  return add(add(add(s, s.up, up), right, side), s.dir, fwd);
};
const SOLIDS = {
  // Big soft things, boxes with round edges: a cushion, a book, a toy chest.
  cushion: (s, k) => [new Block(at(s, 0.45 * k), s.dir, s.up, v3(0.75 * k, 0.18 * k, 0.75 * k), 0.3 * k)],
  book: (s, k) => [new Block(at(s, 0.3 * k), s.dir, s.up, v3(0.95 * k, 0.2 * k, 1.3 * k), 0.05 * k)],
  // Things lying flat, low enough to walk up on to.
  button: (s, k) => [new Drum(at(s, 0.16 * k), s.up, 1.5 * k, 0.22 * k, 0.12 * k)],
  // Tall things, round.
  post: (s, k) => [new Post(at(s, -0.5), at(s, 4.2 * k), 0.42 * k), new Ball(at(s, 4.6 * k), 0.75 * k)],
  lamp: (s, k) => [new Post(at(s, -0.3), at(s, 2.2 * k), 0.14 * k)],
  nightlight: (s, k) => [new Drum(at(s, 0.3 * k), s.up, 1.5 * k, 0.4 * k, 0.15 * k), new Post(at(s, 0.4 * k), at(s, 2.3 * k), 0.75 * k, 0.5 * k), new Ball(at(s, 3.1 * k), 1.25 * k)],
  spring: (s, k) => [new Drum(at(s, 0.12 * k), s.up, 1.05 * k, 0.2 * k, 0.1 * k)],
  mushroom: (s, k) => [new Post(at(s, -0.3), at(s, 1.5 * k), 0.32 * k, 0.24 * k), new Drum(at(s, 1.85 * k), s.up, 1.05 * k, 0.35 * k, 0.3 * k)],
  pebble: (s, k) => [new Ball(at(s, 0.1 * k), 0.5 * k)],
  bell: (s, k) => [new Post(at(s, 0.2 * k), at(s, 1.3 * k), 0.75 * k, 0.4 * k)],
  flowerpot: (s, k) => [new Post(at(s, 0.1 * k), at(s, 0.9 * k), 0.5 * k, 0.62 * k)],
  toadstool: (s, k) => [new Post(at(s, -0.2), at(s, 0.5 * k), 0.16 * k)],
  melon: (s, k) => [new Ball(at(s, 0.7 * k), 0.85 * k)],
  stone: (s, k) => [new Ball(at(s, 0.25 * k), 0.75 * k)],
  fork: (s, k) => [new Post(at(s, -0.5), at(s, 1.6 * k), 0.2 * k), new Post(at(s, 1.9 * k, -0.5 * k), at(s, 4.4 * k, -0.5 * k), 0.18 * k), new Post(at(s, 1.9 * k, 0.5 * k), at(s, 4.4 * k, 0.5 * k), 0.18 * k), new Post(at(s, 1.7 * k, -0.5 * k), at(s, 1.7 * k, 0.5 * k), 0.2 * k)],
  pin: (s, k) => [new Post(at(s, -0.2), at(s, 1.2 * k), 0.16 * k), new Ball(at(s, 1.3 * k), 0.24 * k)],
  drumlet: (s, k) => [new Drum(at(s, 0.5 * k), s.up, 0.95 * k, 0.55 * k, 0.08 * k)],
  cog: (s, k) => [new Drum(at(s, 0.18 * k), s.up, 1.3 * k, 0.24 * k, 0.06 * k)],
  chimney: (s, k) => [new Post(at(s, -0.3), at(s, 1.9 * k), 0.4 * k)],
  key: (s, k) => [new Post(at(s, -0.3), at(s, 1.5 * k), 0.2 * k)],
  shard: (s, k) => [new Post(at(s, -0.3), at(s, 1.6 * k, 0.15 * k), 0.4 * k, 0.12 * k)],
  bedpost: (s, k) => [new Post(at(s, -0.5), at(s, 3.2 * k), 0.4 * k), new Ball(at(s, 3.6 * k), 0.7 * k)],
  peg: (s, k) => [new Post(at(s, -0.2), at(s, 1.5 * k), 0.22 * k)],
  stand: (s, k) => [new Post(at(s, -0.2), at(s, 1.6 * k), 0.14 * k), new Block(at(s, 1.9 * k, 0, 0.1), cross(s.up, s.dir), s.up, v3(0.55 * k, 0.4 * k, 0.06 * k), 0.04)],
  lantern: (s, k) => [new Drum(at(s, 0.2 * k), s.up, 1.2 * k, 0.28 * k, 0.1 * k), new Post(at(s, 0.3 * k), at(s, 2.6 * k), 0.2 * k)],
  clawfoot: (s, k) => [new Post(at(s, -0.3), at(s, 1.4 * k), 0.4 * k)],
};

export class Maker {
  constructor(key, bodies, seed) {
    this.key = key;
    this.space = new Space(bodies);
    this.rng = new Rng(seed);
    this.dress = [];
    this.springs = [];
    this.nightmares = [];
    this.winks = [];
    this.roam = [];
    this.chests = [];
    this.start = null;
    this.hub = null;
    this.boss = null;
    // Where nothing more is to be put: { x, y, z, r }.
    this.kept = [];
  }

  body(key) {
    return typeof key === 'string' ? this.space.byKey.get(key) : key;
  }

  // A spot on a body the way `off` is from its middle, facing dir (or any way).
  spot(key, off, dir = null) {
    const s = this.body(key).spot(off);
    s.dir = dir ? flatUnit(dir, s.up) : flatUnit(v3(0.31, 0.17, 0.93), s.up);
    return s;
  }

  // Facing one point on the ground from another.
  facing(s, to) {
    s.dir = flatUnit(sub(to, s), s.up);
    return s;
  }

  keep(p, r) {
    this.kept.push({ x: p.x, y: p.y, z: p.z, r });
  }

  free(p, r) {
    return this.kept.every((k) => dist3(k, p) >= k.r + r);
  }

  // Something standing on a body, at a spot: { kind, x, y, z, up, dir, k } and
  // whatever else is its own.
  put(kind, s, { k = 1, solid = true, keep = 0.8, ...more } = {}) {
    const d = { kind, x: s.x, y: s.y, z: s.z, up: s.up, dir: s.dir ?? flatUnit(v3(0.31, 0.17, 0.93), s.up), k, body: s.body.key, ...more };
    this.dress.push(d);
    if (solid && SOLIDS[kind]) for (const p of SOLIDS[kind](d, k)) s.body.addProp(p);
    if (keep) this.keep(d, keep * k);
    return d;
  }

  // n of them about a body, wherever there is room: kinds (one at random each
  // time), sizes between ks, no nearer each other than gap, on ground where
  // only(spot) says so.
  scatter(kinds, key, n, { ks = [0.8, 1.2], gap = 1.6, only = null, solid = true, ...more } = {}) {
    const body = this.body(key);
    const list = Array.isArray(kinds) ? kinds : [kinds];
    for (let tries = 0, made = 0; made < n && tries < n * (only ? 40 : 14); tries++) {
      const a = unit(v3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)));
      // (A point some way off a body of any shape: from all round its box.)
      const s = body.spotNear(add(body.c, mul(a, body.reach * this.rng.range(0.35, 1))));
      if (only && !only(s)) continue;
      const k = this.rng.range(ks[0], ks[1]);
      if (!this.free(s, gap * 0.5 * k)) continue;
      // (Not where it would stand in something else of the sky's, nor upside
      // down in a fold.)
      if (body.clutter(s.x, s.y, s.z) < gap * 0.4 * k) continue;
      s.dir = flatUnit(v3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)), s.up);
      this.put(list[Math.floor(this.rng.next() * list.length)], s, { k, solid, keep: gap * 0.5, ...more });
      made++;
    }
  }

  // Springs between two spots, one each way: step on one and it flings you
  // over to the other (a step in front of it, not back on to it). lift: how
  // far out over the ground it flings you. need: 'boss' (only once every
  // nightmare is over). face: the two turned to each other, so you come down
  // over each from the side of the other.
  spring(a, b, { lift = null, need = null, both = true, face = false } = {}) {
    if (face) {
      this.facing(a, b);
      this.facing(b, a);
    }
    const ms = Math.round(900 + dist3(a, b) * 30);
    const high = lift ?? 8 + dist3(a, b) * 0.45;
    const one = (from, to) => {
      const toward = flatUnit(sub(to, from), from.up);
      const land = to.body.spotNear(add(to, to.dir ?? flatUnit(sub(from, to), to.up), -2.4));
      const s = { id: this.springs.length + 1, from: { x: from.x, y: from.y, z: from.z, up: from.up, body: from.body.key }, to: { x: land.x, y: land.y, z: land.z, up: land.up, body: to.body.key }, ms, lift: high, need };
      this.springs.push(s);
      this.put('spring', { ...from, dir: toward }, { k: 1, keep: 2.6, spring: s.id });
      this.keep(land, 1.5);
    };
    one(a, b);
    if (both) one(b, a);
    else this.keep(b, 3);
  }

  // Winks in a row over a body's ground, from a spot off the way dir is.
  winkRow(s, dir, n, gap = 1.6, high = 0.9) {
    for (const p of s.body.walk(s, dir, gap * (n - 1) + 0.01, gap).slice(0, n)) this.wink(p, high);
  }

  wink(p, high = 0.9) {
    const up = p.up;
    this.winks.push({ x: p.x + up.x * high, y: p.y + up.y * high, z: p.z + up.z * high, up });
  }

  // Where treasure chests may stand (chests.js): n spots about the bodies a spring
  // leads to, on ground that is level enough, clear of everything, well away from
  // where a nightmare waits and from each other — and none where the boss is.
  hideChests(n = 9) {
    const bodies = this.space.bodies.filter((b) => b.key !== this.boss.body && b.key !== this.start.body.key && this.springs.some((s) => s.to.body === b.key));
    for (let tries = 0; this.chests.length < n && tries < n * 80; tries++) {
      const body = bodies[Math.floor(this.rng.next() * bodies.length)];
      const a = unit(v3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)));
      const s = body.spotNear(add(body.c, mul(a, body.reach * this.rng.range(0.35, 1))));
      if (!this.free(s, 1) || this.nightmares.some((o) => dist3(o.at, s) < 7) || this.chests.some((o) => dist3(o, s) < 9)) continue;
      const c = add(s, s.up, 0.5);
      if (body.clutter(c.x, c.y, c.z) < 1 || dot(body.slope(s.x, s.y, s.z), s.up) < 0.9) continue;
      const dir = flatUnit(v3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)), s.up);
      this.chests.push({ x: s.x, y: s.y, z: s.z, up: s.up, dir, body: body.key });
      this.keep(s, 1.2);
    }
  }

  done() {
    const { key, space, dress, springs, nightmares, winks, roam, chests, start, hub, boss } = this;
    return { key, space, dress, springs, nightmares, winks, roam, chests, start, hub, boss };
  }
}

// Where someone flung by a spring is k (0 to 1) of the way over, and which way
// is up for them there.
export function flightAt(spring, k) {
  const { from: a, to: b, lift } = spring;
  const k2 = k * k;
  const k3 = k2 * k;
  const h00 = 2 * k3 - 3 * k2 + 1;
  const h10 = k3 - 2 * k2 + k;
  const h01 = -2 * k3 + 3 * k2;
  const h11 = k3 - k2;
  const at = {};
  for (const c of ['x', 'y', 'z']) at[c] = h00 * a[c] + h10 * a.up[c] * lift * 2.2 + h01 * b[c] - h11 * b.up[c] * lift * 2.2;
  // Turned over on the way from one's up to the other's.
  const s = k * k * (3 - 2 * k);
  const c = Math.max(-1, Math.min(1, dot(a.up, b.up)));
  if (c > 0.9999) at.up = { ...b.up };
  else {
    let axis = cross(a.up, b.up);
    if (Math.hypot(axis.x, axis.y, axis.z) < 1e-4) axis = flatUnit(sub(b, a), a.up);
    const t = Math.acos(c) * s;
    const u = unit(axis);
    const co = Math.cos(t);
    const si = Math.sin(t);
    const x = cross(u, a.up);
    const d = dot(u, a.up) * (1 - co);
    at.up = unit({ x: a.up.x * co + x.x * si + u.x * d, y: a.up.y * co + x.y * si + u.y * d, z: a.up.z * co + x.z * si + u.z * d });
  }
  return at;
}

export { carry };
