// The blows of the Land of Nod's frights (foes.js): the shape of each, on ground
// of any shape — a lane it comes along, following the ground round; a ring
// rolling out over it, right round a ball of a world and together again at the
// other side; a spot about to be hit; a beam swept round; something thrown,
// keeping low over the ground, that may be bopped back. Each is told before it
// lands, and goes the same on the host (which moves whoever makes it) and on
// every page (which draws it, and judges whether it hit its own player:
// nod/fight.js).
import { add, carry, cross, dist3, dot, flat, flatUnit, len, mul, sub, turn } from './shape.js';

// A lane from p off the way dir goes, over a body's ground.
export const lanePath = (body, p, dir, far) => body.walk(p, dir, far, 0.7);

// A path from p over a body's ground to a point on it, bent towards it all the
// way there whatever the ground's shape, and straight on from there.
export function aimedPath(body, p, to, far, step = 0.7) {
  let q = { x: p.x, y: p.y, z: p.z };
  let up = body.up(q.x, q.y, q.z);
  let dir = flatUnit(sub(to, q), up);
  let there = false;
  const n = Math.max(1, Math.ceil(far / step));
  const s = far / n;
  const out = [{ ...q, up, dir }];
  for (let i = 0; i < n; i++) {
    if (!there) {
      const d = sub(to, q);
      if (len(d) < s * 1.3) there = true;
      else dir = flatUnit(d, up);
    }
    q = body.land(add(q, dir, s), 5);
    const next = body.up(q.x, q.y, q.z);
    dir = flatUnit(carry(dir, up, next), next);
    up = next;
    out.push({ ...q, up, dir });
  }
  return out;
}

// The path of a lane or a shot of an act, as everyone has it: aimed at a point,
// or straight off the way dir goes.
export const pathOf = (body, p, dir, far, to = null) => (to ? aimedPath(body, p, to, far) : lanePath(body, p, dir, far));

// Where s along a path is: { x, y, z, up, dir }.
export function laneAt(path, s, total) {
  const n = path.length - 1;
  const k = Math.max(0, Math.min(n, (s / Math.max(1e-6, total)) * n));
  const i = Math.min(n - 1, Math.floor(k));
  const a = path[i];
  const b = path[i + 1] ?? a;
  const f = k - i;
  const mix = (u, v) => ({ x: u.x + (v.x - u.x) * f, y: u.y + (v.y - u.y) * f, z: u.z + (v.z - u.z) * f });
  const q = mix(a, b);
  const up = mix(a.up, b.up);
  const l = len(up) || 1;
  return { ...q, up: mul(up, 1 / l), dir: mix(a.dir, b.dir) };
}

// How far a point is from a path's line (the nearest of its stretches).
export function offPath(path, p) {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const d = sub(b, a);
    const l2 = dot(d, d) || 1e-9;
    const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / l2));
    best = Math.min(best, dist3(p, add(a, d, t)));
  }
  return best;
}

// A lane cut short where something solid stands in it, r wide: how far it goes,
// and whether it was.
function cutShort(body, path, far, r) {
  const n = path.length - 1;
  for (let i = 1; i <= n; i++) {
    const q = path[i];
    const c = add(q, q.up, 0.7);
    if (body.clutter(c.x, c.y, c.z) < r * 0.75) return { far: Math.max(0.8, (far * (i - 0.4)) / n), bonk: i > 2 };
  }
  return { far, bonk: false };
}

// How a blow's lane is run by whoever makes it: along it to its end.
const lane = (opt = {}) => ({
  start(sim, f, act, p, t) {
    const { mv } = act;
    act.p = { x: f.x, y: f.y, z: f.z };
    act.dir = flatUnit(mv.back180 ? mul(t.way, -1) : t.way, f.up);
    const want = mv.reachOut ? Math.min(mv.len, t.far + mv.reachOut) : mv.len;
    if (p && !mv.back180) act.to = [f.body.land(p, 5)];
    const path = pathOf(f.body, f, act.dir, want, act.to?.[0]);
    const cut = f.spec.alt || opt.through ? { far: want, bonk: false } : cutShort(f.body, path, want, f.spec.radius);
    act.len = cut.far;
    act.bonk = cut.bonk && Boolean(f.spec.bonk);
    act.path = path.length && cut.far < want ? pathOf(f.body, f, act.dir, cut.far, act.to?.[0]) : path;
    act.ms = (act.len / mv.speed) * 1000;
    act.swoop = mv.swoop;
  },
  run(sim, f, act, dt, now) {
    const s = Math.min(act.len, ((now - act.strike) / 1000) * act.mv.speed);
    const q = laneAt(act.path, s, act.len);
    f.x = q.x;
    f.y = q.y;
    f.z = q.z;
    f.up = f.body.up(q.x, q.y, q.z);
    f.h = flatUnit(q.dir, f.up);
    if (s < act.len) return;
    if (act.bonk && !act.tripped) {
      act.over = true;
      f.act = null;
      sim.fx('bonk', f, { p: [q.x, q.y, q.z].map((v) => Math.round(v * 100) / 100) });
      f.onBonk?.(sim, f, now);
      sim.opens(f, 'bonk', now);
    } else sim.endAct(f, now);
  },
});

export const MOVES = {
  // A short rush at someone.
  lunge: lane({ through: true }),
  // A long one, straight on until it is done or runs into something solid.
  charge: lane(),
  // Something thrown, or a fan of them.
  shot: {
    start(sim, f, act, p, t) {
      const { mv } = act;
      act.p = { x: f.x, y: f.y, z: f.z };
      act.dir = t.way;
      act.n = mv.n ?? 1;
      // (Each of a fan of them at a spot of its own, round it from whoever it is after.)
      const to = f.body.land(p, 5);
      act.to = Array.from({ length: act.n }, (_, i) => add(f, turn(sub(to, f), f.up, (i - (act.n - 1) / 2) * (mv.fan ?? 0.3))));
      act.len = mv.len;
      act.high = f.alt ?? 0;
      act.ms = 200;
    },
    wind(sim, f, act, dt) {
      f.h = flatUnit(act.dir, f.up);
    },
  },
  // A ring (or a few, one after another) rolling out over the ground from it.
  wave: {
    start(sim, f, act) {
      act.p = { x: f.x, y: f.y, z: f.z };
      act.n = act.mv.n ?? 1;
      act.ms = (act.n - 1) * (act.mv.gap ?? 0) + 250;
    },
  },
  // All round it, at once.
  burst: {
    start(sim, f, act) {
      act.p = { x: f.x, y: f.y, z: f.z };
      act.ms = 220;
    },
  },
  // Up, over and down where someone stands now.
  leap: {
    start(sim, f, act, p, t) {
      const { mv } = act;
      const far = Math.max(0.8, Math.min(t.far, mv.far));
      const aim = f.body.land(p, 5);
      const path = aimedPath(f.body, f, aim, far);
      act.p = { x: f.x, y: f.y, z: f.z };
      act.path = path;
      act.len = far;
      act.dir = t.way;
      const end = path.at(-1);
      // (Where it comes down; and the way there, which is aimed at them.)
      act.to = [{ x: end.x, y: end.y, z: end.z }, aim];
      act.ms = mv.ms ?? 750;
      act.high = mv.high ?? 4;
    },
    run(sim, f, act, dt, now) {
      const k = Math.min(1, (now - act.strike) / act.ms);
      const q = laneAt(act.path, k * act.len, act.len);
      Object.assign(f, { x: q.x, y: q.y, z: q.z, up: f.body.up(q.x, q.y, q.z) });
      f.h = flatUnit(q.dir, f.up);
      f.alt = Math.sin(k * Math.PI) * act.high;
      if (k >= 1) {
        f.alt = 0;
        if (act.mv.then) {
          sim.endAct(f, now);
          f.cool = Math.max(f.cool, now + 400);
        } else sim.endAct(f, now);
      }
    },
  },
  // A beam swept round from it.
  beam: {
    start(sim, f, act, p, t) {
      const { mv } = act;
      const way = mv.sweep * (f.side ?? 1);
      act.p = { x: f.x, y: f.y, z: f.z };
      act.dir = turn(t.way, f.up, -way * (mv.lead ?? 0.35));
      act.sweep = way;
      act.len = mv.len;
      act.ms = mv.ms;
    },
    run(sim, f, act, dt, now) {
      const k = Math.min(1, (now - act.strike) / act.ms);
      f.h = flatUnit(turn(act.dir, f.up, act.sweep * k), f.up);
      if (k >= 1) sim.endAct(f, now);
    },
  },
  // Thrown up and over, to come down where someone stands (and round them).
  lob: {
    start(sim, f, act, p, t) {
      const { mv } = act;
      act.p = { x: f.x, y: f.y, z: f.z };
      act.dir = t.way;
      act.to = [];
      const targets = mv.each ? sim.people.filter((q) => !q.dizzy && dist3(q, f) < mv.far + 4) : [p];
      for (const q of targets.slice(0, 4)) {
        const n = mv.n ?? 1;
        const o = sim.lead(q, mv.windup + (mv.ms ?? 900));
        for (let i = 0; i < n; i++) {
          const a = sim.rng.range(0, Math.PI * 2);
          const r = i ? sim.rng.range(1.6, mv.spread ?? 3.4) : 0;
          const up = o.body.up(o.x, o.y, o.z);
          const way = turn(flatUnit({ x: 0.3, y: 0.2, z: 0.9 }, up), up, a);
          act.to.push(o.body.land(add(o, way, r), 5));
        }
      }
      act.ms = mv.ms ?? 900;
      act.high = mv.high ?? 5;
    },
  },
  // Under the ground, and up again under someone.
  dive: {
    start(sim, f, act, p) {
      act.p = { x: f.x, y: f.y, z: f.z };
      const q = p.body === f.body ? f.body.land(p, 5) : { x: f.x, y: f.y, z: f.z };
      act.to = [q];
      act.ms = 300;
      f.under = true;
    },
    wind(sim, f, act, dt, now) {
      const q = act.to[0];
      const k = 1 - Math.max(0, (act.strike - now) / act.windup);
      if (k > 0.5) Object.assign(f, { x: q.x, y: q.y, z: q.z, up: f.body.up(q.x, q.y, q.z) });
      f.h = flatUnit(f.h, f.up);
    },
    run(sim, f, act, dt, now) {
      f.under = false;
      if (now >= act.ends) sim.endAct(f, now);
    },
  },
  // Out on a spring, a long way, and there it dangles a while.
  out: {
    start(sim, f, act, p, t) {
      act.p = { x: f.x, y: f.y, z: f.z };
      act.dir = t.way;
      act.len = act.mv.len;
      act.ms = 260;
    },
    wind(sim, f, act) {
      f.h = flatUnit(act.dir, f.up);
    },
  },
  // All at once in several places (mv.where(sim, f, p): which).
  spots: {
    start(sim, f, act, p) {
      act.p = { x: f.x, y: f.y, z: f.z };
      act.to = act.mv.where(sim, f, p).map((q) => ({ x: q.x, y: q.y, z: q.z }));
      act.ms = act.mv.ms ?? 200;
    },
  },
  // Calls others to help.
  call: {
    start(sim, f, act) {
      act.p = { x: f.x, y: f.y, z: f.z };
      act.ms = 300;
    },
    run(sim, f, act, dt, now) {
      if (!act.called) {
        act.called = true;
        for (let i = 0; i < (act.mv.n ?? 2); i++) {
          const a = turn(f.h, f.up, Math.PI * (0.35 + (i / Math.max(1, (act.mv.n ?? 2) - 1)) * 1.3));
          const q = f.body.spotNear(add(f, a, f.spec.radius + 1.6 + (i % 2)));
          sim.add(act.mv.kind, q, { camp: f.camp, helper: true });
        }
      }
      if (now >= act.ends) sim.endAct(f, now);
    },
  },
};

// ---------------------------------------------------------------- on a page

// How far out a wave has rolled ms after it set off, and whether it has come to
// its end.
export const waveR = (ms, speed) => Math.max(0, (ms / 1000) * speed);

// The two ends of a beam ms into its sweep, as a path over the ground.
export function beamPath(body, act, k) {
  const up = body.up(act.p.x, act.p.y, act.p.z);
  return body.walk(act.p, turn(act.dir, up, act.sweep * k), act.len, 1.1);
}

export { add, carry, cross, flat };
