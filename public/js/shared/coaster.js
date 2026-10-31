// A fun park's roller coaster (park.js puts it in the park): a real one,
// on a smooth steel track rather than rails on blocks. A train of three cars
// waits at the station with its lap bars up; everyone near hops in. Then it
// goes by itself: out of the station, up the lift hill on the chain
// (clack, clack, clack), over the top, down the big drop, round a vertical
// loop, over a camelback hill, round the banked turn at the end and into the
// brakes, back to the station to let everyone off — or ride again.
//
// The track is a closed curve through the points below (centripetal
// Catmull-Rom), sampled every STEP along its length, each sample with the
// way along it (t), its up (straight up as far as it can be, towards the
// middle of the loop as it turns over, and banked into the turns by how
// fast the train takes them) and
// its left. The train's run is worked out once, the same on every page:
// held at the station, driven out, pulled up the lift at a steady speed,
// then left to gravity and a little friction (a booster keeps it from
// ever stalling), and braked to a stop at the station. Where it is comes
// from the clock (trainAt), like the Ferris wheel's turn: nothing is sent
// for it.
//
// Everything here is in the coaster's own frame: the middle of its station
// at the origin, the train heading -z out of it, the rest of the track off
// to -x, y up from the ground it stands on.

export const G = 9.8;
// How far apart the samples are along the track.
export const STEP = 0.25;
// The train: three cars, two friends side by side in each.
export const TRAIN = { cars: 3, gap: 2.1, across: 0.33, seat: 0.55 };
export const SEATS = TRAIN.cars * 2;
// How long it waits at the station, doors open, in seconds.
export const DWELL = 9;

// The points below are laid out from the far end of the station: this much
// further on (-z) is its middle, the coaster's origin.
const MIDDLE = 10.7;
const at = (x, y, z) => [x, y, z - MIDDLE];

// The loop: its radius, and its middle (as it stands, its height and how
// far along z).
const LOOP = { R: 4.6, zc: 2.6 - MIDDLE, yc: 5.5 };
// How high the top of the loop is.
export const LOOP_TOP = LOOP.yc + LOOP.R;

// The way round, from the station northwards.
function controlPoints() {
  const pts = [
    // The station, and out of it to the foot of the lift hill.
    [0, 0.3, 15],
    [0, 0.3, 11],
    [0, 0.3, 7],
    [0, 0.6, 3],
    // Up the lift hill, over its top and round to the west.
    [0, 7.8, -4.5],
    [0, 14.4, -11.2],
    [0, 15.2, -13.6],
    [-1.6, 15, -16.4],
    [-4.5, 14.6, -18],
    [-7.5, 14, -17.4],
    [-9.6, 12.6, -15],
    // The big drop.
    [-10.2, 7, -10],
    [-10.4, 1.4, -5],
    [-10.4, 0.9, -1.6],
  ];
  // The loop: a circle stood up across the way, drifting a little sideways
  // as it goes round so it comes out beside where it went in.
  const R = LOOP.R;
  const zc = LOOP.zc + MIDDLE;
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    pts.push([-10.4 - 2.3 * (k / 10), 0.9 + R - R * Math.cos(a), zc + R * Math.sin(a)]);
  }
  pts.push(
    // Out of the loop and over a bunny hop.
    [-12.7, 0.9, 7],
    [-12.7, 1.6, 9.6],
    [-12.7, 2.1, 11.4],
    [-12.6, 1.6, 13.4],
    [-12.3, 1.1, 15.8],
    // The banked turn back east at the end, and the brakes home.
    [-10.4, 1.1, 18.6],
    [-6.4, 1.8, 19.8],
    [-2.6, 0.9, 19.2],
    [-0.4, 0.4, 17.4],
  );
  return pts.map(([x, y, z]) => at(x, y, z));
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const lerp = (a, b, k) => add(a, mul(sub(b, a), k));
// a turned by angle round the unit axis (Rodrigues).
const turn = (a, axis, angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(mul(a, c), mul(cross(axis, a), s)), mul(axis, dot(axis, a) * (1 - c)));
};

// A point on the centripetal Catmull-Rom curve between p1 and p2, u of the
// way (0 to 1).
function catmull(p0, p1, p2, p3, u) {
  const knot = (a, b) => Math.max(1e-4, Math.hypot(...sub(b, a)) ** 0.5);
  const t1 = knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const a1 = lerp(p0, p1, t / t1);
  const a2 = lerp(p1, p2, (t - t1) / (t2 - t1));
  const a3 = lerp(p2, p3, (t - t2) / (t3 - t2));
  const b1 = lerp(a1, a2, t / t2);
  const b2 = lerp(a2, a3, (t - t1) / (t3 - t1));
  return lerp(b1, b2, (t - t1) / (t2 - t1));
}

// The track, sampled every STEP: { pts: [{ p, t, up, left }], len }.
function buildTrack() {
  const cp = controlPoints();
  const n = cp.length;
  // Finely along the curve first, then at even steps along its length.
  const fine = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 40; k++) fine.push(catmull(cp[(i - 1 + n) % n], cp[i], cp[(i + 1) % n], cp[(i + 2) % n], k / 40));
  }
  fine.push(fine[0]);
  const at = [0];
  for (let i = 1; i < fine.length; i++) at.push(at[i - 1] + Math.hypot(...sub(fine[i], fine[i - 1])));
  const total = at.at(-1);
  const count = Math.round(total / STEP);
  const step = total / count;
  const pts = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = i * step;
    while (at[j + 1] < s) j++;
    pts.push({ p: lerp(fine[j], fine[j + 1], (s - at[j]) / (at[j + 1] - at[j])) });
  }
  // Smoothed out, so it has no kinks where the curve's pieces meet (a rider
  // would feel each one as a jolt), the station kept straight and level.
  const station = (p) => p[0] === 0 && p[2] > 6 - MIDDLE && p[2] < 16 - MIDDLE;
  for (let pass = 0; pass < 24; pass++) {
    const was = pts.map((q) => q.p);
    for (let i = 0; i < count; i++) {
      if (station(was[i])) continue;
      const a = was[(i - 2 + count) % count];
      const b = was[(i - 1 + count) % count];
      const c = was[(i + 1) % count];
      const d = was[(i + 2) % count];
      pts[i].p = mul(add(add(add(a, d), mul(add(b, c), 2)), mul(was[i], 2)), 1 / 8);
    }
  }
  for (let i = 0; i < count; i++) pts[i].t = norm(sub(pts[(i + 1) % count].p, pts[(i - 1 + count) % count].p));
  // Up: straight up, as far as the track lets it be; but inside the loop,
  // towards its middle (so riders go over the top head down), eased into
  // and out of it.
  const raw = pts.map(({ p, t }) => {
    const inLoop = p[0] <= -10.3 && Math.abs(p[2] - LOOP.zc) <= LOOP.R + 0.3 && p[1] > 1.6;
    const want = inLoop ? sub([p[0], LOOP.yc, LOOP.zc], p) : [0, 1, 0];
    return norm(sub(want, mul(t, dot(want, t))));
  });
  for (let i = 0; i < count; i++) {
    let u = [0, 0, 0];
    for (let k = -6; k <= 6; k++) u = add(u, raw[(i + k + count) % count]);
    pts[i].up = norm(sub(u, mul(pts[i].t, dot(u, pts[i].t))));
  }
  return { pts, len: total, step };
}

export const TRACK = buildTrack();

// The sample nearest the point (in the coaster's frame).
function nearest(p) {
  let best = 0;
  let far = Infinity;
  TRACK.pts.forEach((q, i) => {
    const d = Math.hypot(...sub(q.p, p));
    if (d < far) {
      far = d;
      best = i;
    }
  });
  return best * TRACK.step;
}

// Where along the track things happen: the train's front car stops at
// STOP; the chain pulls it from LIFT to CREST; the brakes start at BRAKE.
export const MARKS = { STOP: nearest(at(0, 0.3, 8.6)), LIFT: nearest(at(0, 0.6, 3)), CREST: nearest(at(0, 15.2, -13.6)), BRAKE: nearest(at(-6.4, 1.8, 19.8)) };

const wrap = (s) => ((s % TRACK.len) + TRACK.len) % TRACK.len;

// The track's height at s, and its slope (dy/ds).
function heightAt(s) {
  const f = wrap(s) / TRACK.step;
  const i = Math.floor(f);
  const a = TRACK.pts[i % TRACK.pts.length].p[1];
  const b = TRACK.pts[(i + 1) % TRACK.pts.length].p[1];
  return { y: a + (b - a) * (f - i), slope: (b - a) / TRACK.step };
}

// The train's run, once round from the station: { s, v } every 1/60 s
// after it leaves, and how long the whole cycle is (with the wait).
function simulate() {
  const dt = 1 / 60;
  const out = [];
  const end = MARKS.STOP + TRACK.len;
  let s = MARKS.STOP;
  let v = 0;
  for (let guard = 0; guard < 60 * 120 && s < end; guard++) {
    const along = s - MARKS.STOP;
    const lift = wrap(s) >= MARKS.LIFT && wrap(s) < MARKS.CREST && along < TRACK.len / 2;
    const toStop = end - s;
    if (along < wrap(MARKS.LIFT - MARKS.STOP)) {
      // Rolled out of the station by its tyres.
      v = Math.min(2.5, v + 1.5 * dt);
    } else if (lift) {
      // Up on the chain, steady.
      v = Math.min(3, v + 2 * dt);
    } else {
      const { slope } = heightAt(s);
      v += (-G * slope / Math.hypot(1, slope) - 0.015 * G - 0.002 * v * v) * dt;
      // A booster: it never stalls on the track.
      v = Math.max(v, 2);
    }
    // The brakes: down to a crawl into the station, and stopped at its place.
    if (wrap(s) >= MARKS.BRAKE || toStop < wrap(MARKS.STOP - MARKS.BRAKE)) {
      v = Math.min(v, Math.sqrt(1.2 * 1.2 + 2 * 3 * Math.max(0, toStop - 3)), Math.max(0.3, toStop * 1.2));
    }
    s = Math.min(end, s + v * dt);
    out.push([s, v]);
  }
  return { run: out, period: DWELL + out.length / 60 };
}

export const RUN = simulate();

// How hard the train is going round each sample's bend, sideways: the bank
// it leans into, from how fast it goes there.
function bank() {
  const n = TRACK.pts.length;
  const speed = new Float64Array(n);
  for (const [s, v] of RUN.run) speed[Math.floor(wrap(s) / TRACK.step) % n] = v;
  for (let i = 1; i < n * 2; i++) if (!speed[i % n]) speed[i % n] = speed[(i - 1) % n];
  const roll = [];
  for (let i = 0; i < n; i++) {
    const a = TRACK.pts[(i - 4 + n) % n].t;
    const b = TRACK.pts[(i + 4) % n].t;
    // The way it turns, flat (none where it heads up or down a lot).
    const flat = Math.hypot(a[0], a[2]) * Math.hypot(b[0], b[2]);
    const yaw = flat > 0.5 ? Math.atan2(a[0] * b[2] - a[2] * b[0], a[0] * b[0] + a[2] * b[2]) : 0;
    const curve = yaw / (8 * TRACK.step);
    roll.push(Math.max(-1.4, Math.min(1.4, Math.atan((speed[i] ** 2 * curve) / G))));
  }
  // Eased in and out of each turn.
  TRACK.pts.forEach((q, i) => {
    let r = 0;
    for (let k = -8; k <= 8; k++) r += roll[(i + k + n) % n];
    q.up = turn(q.up, q.t, r / 17);
    q.left = norm(cross(q.up, q.t));
  });
}
bank();

// The track at s (any distance along, round and round): { p, t, up, left }.
export function trackAt(s) {
  const n = TRACK.pts.length;
  const f = wrap(s) / TRACK.step;
  const i = Math.floor(f);
  const a = TRACK.pts[i % n];
  const b = TRACK.pts[(i + 1) % n];
  const k = f - i;
  const t = norm(lerp(a.t, b.t, k));
  const up = norm(lerp(a.up, b.up, k));
  return { p: lerp(a.p, b.p, k), t, up: norm(sub(up, mul(t, dot(up, t)))), left: norm(cross(up, t)) };
}

// Where the train is at a moment (ms, by the clock): its front car's s,
// its speed, and what it is doing: 'station' (waiting, doors open), 'lift'
// (on the chain) or 'ride'.
export function trainAt(ms = Date.now()) {
  const t = ((ms / 1000) % RUN.period + RUN.period) % RUN.period;
  if (t < DWELL) return { s: MARKS.STOP, v: 0, phase: 'station', wait: DWELL - t };
  const [s, v] = RUN.run[Math.min(RUN.run.length - 1, Math.floor((t - DWELL) * 60))];
  const w = wrap(s);
  return { s: w, v, phase: w >= MARKS.LIFT && w < MARKS.CREST && v <= 3.01 ? 'lift' : 'ride', wait: 0 };
}

// Where seat i (0 to SEATS - 1: two to a car, the front car first, left
// then right) is with the train's front car at s: the rider's feet (hips
// sunk into the seat by hips), and their frame { t, up, left }.
export function seatOnTrack(s, i, hips = 0.25) {
  const car = Math.floor(i / 2);
  const f = trackAt(s - car * TRAIN.gap);
  const side = i % 2 ? -TRAIN.across : TRAIN.across;
  const p = add(add(f.p, mul(f.up, TRAIN.seat - hips)), mul(f.left, side));
  return { ...f, p };
}

// A frame { t, up, left } in the coaster's own frame as a quaternion [x, y,
// z, w] for something that faces +z with +y up (as the avatars do), turned
// by yaw round the world's up as the coaster is.
export function frameQuat(f, yaw = 0) {
  // The rotation whose columns are left (x), up (y) and along (z).
  const [m00, m10, m20] = f.left;
  const [m01, m11, m21] = f.up;
  const [m02, m12, m22] = f.t;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const k = 0.5 / Math.sqrt(tr + 1);
    q = [(m21 - m12) * k, (m02 - m20) * k, (m10 - m01) * k, 0.25 / k];
  } else if (m00 > m11 && m00 > m22) {
    const k = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * k, (m01 + m10) / k, (m02 + m20) / k, (m21 - m12) / k];
  } else if (m11 > m22) {
    const k = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / k, 0.25 * k, (m12 + m21) / k, (m02 - m20) / k];
  } else {
    const k = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / k, (m12 + m21) / k, 0.25 * k, (m10 - m01) / k];
  }
  // Then the coaster's own turn round y.
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  const [x, y, z, w] = q;
  return [hw * x + hy * z, hw * y + hy * w, hw * z - hy * x, hw * w - hy * y];
}
