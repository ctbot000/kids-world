// A real katsura tree (Cercidiphyllum japonicum), grown from a seed as a
// model rather than out of blocks: a few trunks of grey-brown bark from one
// foot, leaning apart as they climb, branching and branching again into a
// broad, rounded crown of little heart-shaped leaves in clusters, and its
// fallen leaves on the ground round it. A young one is narrow and pointed,
// with one trunk or two and branches low down; a giant (the stamp's) is
// wider and taller than any. No three.js here: render/mesher.js lays the
// tree into the chunk its foot is in, lit like everything else.
//
// Units are blocks; (0, 0, 0) is the middle of the bottom of the foot's cell.
import { Rng } from '../shared/rng.js';

const TYPES = {
  young: { height: [7.2, 8.4], stems: [1, 2], tilt: [0.03, 0.12], radius: 0.11, crown: { y: 5, ry: 3.8, r: 2.1, base: 2 }, card: [1, 1.3], shell: 110, litter: 30 },
  mature: { height: [10.5, 12], stems: [3, 5], tilt: [0.2, 0.36], radius: 0.19, crown: { y: 7.2, ry: 4.7, r: 4.6, base: 2.9 }, card: [1.25, 1.6], shell: 330, litter: 80 },
  giant: { height: [14.5, 15], stems: [5, 5], tilt: [0.24, 0.4], radius: 0.3, crown: { y: 9.6, ry: 5.6, r: 6.9, base: 3.6 }, card: [1.45, 1.9], shell: 760, litter: 150 },
};
// How many sides the bark has round a trunk, a branch and a twig.
const SIDES = [9, 5, 3];
// Leaf clusters to choose from, and the fallen leaves, as layers of the
// foliage pictures (render/atlas.js FOLIAGE).
export const CLUSTERS = 3;
export const LITTER = 3;

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Two directions square to `axis` and to each other.
export function across(axis) {
  const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(axis, helper));
  return [u, cross(axis, u)];
}

// The crown as an egg round the trunks: how deep inside it a point is, from
// 0 at its skin (or outside) to 1 at its heart.
export function depthIn(crown, p) {
  const q = Math.hypot(p[0] / crown.r, (p[1] - crown.y) / crown.ry, p[2] / crown.r);
  return Math.max(0, Math.min(1, 1 - q));
}

// How far along `dir` from p (inside the crown) its skin is.
function toSkin(crown, p, dir) {
  const s = [p[0] / crown.r, (p[1] - crown.y) / crown.ry, p[2] / crown.r];
  const d = [dir[0] / crown.r, dir[1] / crown.ry, dir[2] / crown.r];
  const a = dot(d, d);
  const b = 2 * dot(s, d);
  const c = dot(s, s) - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
}

// A limb: points along it and how thick it is at each, drawn with SIDES[level].
function limb(rng, start, dir, length, r0, { step, wiggle, lift, flare = false, tip = 0.012 }) {
  const pts = [start];
  const n = Math.max(2, Math.ceil(length / step));
  let d = dir;
  for (let i = 1; i <= n; i++) {
    d = norm([d[0] + rng.range(-wiggle, wiggle), d[1] + rng.range(-wiggle, wiggle) + lift, d[2] + rng.range(-wiggle, wiggle)]);
    pts.push(add(pts[i - 1], d, length / n));
  }
  const end = Math.min(tip, r0);
  const radii = pts.map((p, i) => {
    const t = i / n;
    let r = end + (r0 - end) * (1 - t) ** 1.1;
    // Its foot spreads where it meets the ground.
    if (flare && p[1] < 0.6) r *= 1 + 0.8 * (1 - Math.max(0, p[1]) / 0.6) ** 2;
    return r;
  });
  return { pts, radii };
}

// The point and the way along a limb, a share t (0 to 1) of its length up it.
function along(l, t) {
  const f = t * (l.pts.length - 1);
  const i = Math.min(l.pts.length - 2, Math.floor(f));
  const k = f - i;
  const a = l.pts[i];
  const b = l.pts[i + 1];
  return { p: add(a, [b[0] - a[0], b[1] - a[1], b[2] - a[2]], k), dir: norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), r: l.radii[i] + (l.radii[i + 1] - l.radii[i]) * k };
}

function lengthOf(l) {
  let s = 0;
  for (let i = 1; i < l.pts.length; i++) s += len([l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1], l.pts[i][2] - l.pts[i - 1][2]]);
  return s;
}

// The whole tree: { limbs: [{ pts, radii, level }], cards: [{ p, n, size,
// spin, layer }], litter: [{ x, z, size, spin, layer }], crown }.
export function katsuraModel(seed, type = 'mature') {
  const T = TYPES[type] ?? TYPES.mature;
  const rng = new Rng(seed);
  const height = rng.range(...T.height);
  const scale = height / ((T.height[0] + T.height[1]) / 2);
  const crown = { y: T.crown.y * scale, ry: T.crown.ry * scale, r: T.crown.r * rng.range(0.92, 1.08), base: T.crown.base };
  // A real crown is lumpy, not an egg: it bulges here and dips there, round
  // and up and down; a young one narrows to a point at the top.
  const ph = [rng.next() * 6.3, rng.next() * 6.3, rng.next() * 6.3, rng.next() * 6.3];
  const lump = (a, y) => (1 + 0.13 * Math.sin(a * 3 + ph[0]) * Math.cos(y * 2.2 + ph[1]) + 0.09 * Math.sin(a * 5 + ph[2] + y * 1.7) + 0.06 * Math.cos(a * 2 + ph[3])) * (type === 'young' ? 1 - 0.38 * Math.max(0, y) : 1);
  const lumpAt = (p) => lump(Math.atan2(p[2], p[0]), Math.max(-1, Math.min(1, (p[1] - crown.y) / crown.ry)));
  const limbs = [];
  const cards = [];
  const card = (p, size = rng.range(...T.card)) => {
    // Facing out of the crown and up to the light, but every which way a little.
    const out = norm([p[0], (p[1] - crown.y) * 0.7, p[2]]);
    const n = norm([out[0] + rng.range(-0.4, 0.4), out[1] + 0.3 + rng.range(-0.4, 0.4), out[2] + rng.range(-0.4, 0.4)]);
    cards.push({ p, n, size, spin: rng.next() * Math.PI * 2, layer: rng.int(0, CLUSTERS - 1) });
  };
  const leafy = (l, from, gap) => {
    const total = lengthOf(l);
    for (let s = from * total; s <= total - gap * 0.5; s += gap) {
      const { p } = along(l, s / total);
      card(add(p, [rng.range(-0.18, 0.18), rng.range(-0.1, 0.18), rng.range(-0.18, 0.18)]));
    }
    card(add(l.pts.at(-1), [0, 0.12, 0]));
  };

  // Twigs off a branch, from one side and then the other, with leaf
  // clusters along them.
  const twigs = (b) => {
    const total = lengthOf(b);
    let turn = rng.next() * Math.PI * 2;
    for (let s = total * 0.22; s < total * 0.97; s += rng.range(0.42, 0.6)) {
      const { p, dir, r } = along(b, s / total);
      if (p[1] < crown.base) continue;
      const [u, v] = across(dir);
      turn += Math.PI * 0.8 + rng.range(-0.4, 0.4);
      const around = [0, 1, 2].map((k) => u[k] * Math.cos(turn) + v[k] * Math.sin(turn));
      const a = rng.range(0.6, 0.95);
      const d = norm(add(add(dir, around, Math.tan(a)), [0, 0.15, 0]));
      const reach = Math.min(rng.range(0.8, 1.45), toSkin(crown, p, d) * 1.05 * lumpAt(add(p, d, toSkin(crown, p, d))));
      if (reach < 0.3) continue;
      const t = limb(rng, p, d, reach, Math.min(r * 0.6, 0.035), { step: 0.7, wiggle: 0.08, lift: 0.04 });
      limbs.push({ ...t, level: 2 });
      leafy(t, 0.3, 0.38);
    }
  };

  // Branches off a trunk, round it in a spiral and out of the middle of the
  // tree, rising at a slant to the crown's skin.
  const branches = (stem) => {
    const total = lengthOf(stem.limb);
    let turn = rng.next() * Math.PI * 2;
    for (let s = total * 0.28; s < total * 0.94; s += rng.range(0.42, 0.62)) {
      const { p, dir, r } = along(stem.limb, s / total);
      if (p[1] < crown.base) continue;
      turn += 2.4 + rng.range(-0.3, 0.3);
      const [u, v] = across(dir);
      let around = [0, 1, 2].map((k) => u[k] * Math.cos(turn) + v[k] * Math.sin(turn));
      // Never back in towards the other trunks.
      const out = norm([p[0] || Math.cos(stem.az), 0, p[2] || Math.sin(stem.az)]);
      if (around[0] * out[0] + around[2] * out[2] < -0.15) around = around.map((x) => -x);
      const rise = rng.range(0.75, 1.05) - ((s / total) * 0.25);
      const d = norm(add(add(dir, around, Math.tan(rise)), [0, 0.12, 0]));
      const reach = toSkin(crown, p, d) * rng.range(0.8, 0.98) * lumpAt(add(p, d, toSkin(crown, p, d)));
      if (reach < 0.6) continue;
      const b = limb(rng, p, d, reach, Math.min(r * 0.62, type === 'giant' ? 0.12 : 0.085), { step: 0.4, wiggle: 0.06, lift: 0.035 });
      limbs.push({ ...b, level: 1 });
      twigs(b);
      leafy(b, 0.45, 0.45);
    }
  };

  const stems = rng.int(...T.stems);
  const turn = rng.next() * Math.PI * 2;
  for (let i = 0; i < stems; i++) {
    const az = turn + (i / stems) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const leader = i === 0;
    const tilt = leader && stems > 2 ? rng.range(0.02, 0.08) : rng.range(...T.tilt);
    const length = (leader ? 1 : rng.range(0.78, 0.92)) * height * 0.86;
    const r0 = T.radius * (leader ? 1 : rng.range(0.75, 0.9));
    const start = [Math.cos(az) * 0.07 * (stems > 1 ? 1 : 0), -0.2, Math.sin(az) * 0.07 * (stems > 1 ? 1 : 0)];
    const dir = [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
    const l = limb(rng, start, dir, length, r0, { step: 0.45, wiggle: 0.05, lift: 0.02, flare: true, tip: 0.03 });
    limbs.push({ ...l, level: 0 });
    branches({ limb: l, az });
    twigs(l);
    leafy(l, 0.75, 0.5);
  }

  // The crown's skin, filled in all over with more clusters, so it is as
  // thick with leaves as a real one: towards the top more than underneath,
  // and none below where the branches start.
  for (let i = 0; i < T.shell; i++) {
    const y = rng.range(-0.75, 1);
    const a = rng.next() * Math.PI * 2;
    const k = Math.sqrt(1 - y * y) * rng.range(0.78, 1) * lump(a, y);
    const p = [Math.cos(a) * k * crown.r, crown.y + y * crown.ry * rng.range(0.85, 1) * (y > 0 ? lump(a, y) ** 0.5 : 1), Math.sin(a) * k * crown.r];
    if (p[1] > crown.base + 0.6) card(p);
  }

  // Fallen leaves, thickest near the trunks.
  const litter = [];
  for (let i = 0; i < T.litter; i++) {
    const r = crown.r * 0.95 * Math.sqrt(rng.next()) ** 1.3;
    const a = rng.next() * Math.PI * 2;
    litter.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, size: rng.range(0.45, 0.8), spin: rng.next() * Math.PI * 2, layer: LITTER });
  }
  return { limbs, cards, litter, crown, height };
}

// Which katsura grows at a foot: a giant's foot always grows a giant; any
// other is young about a third of the time, by where it stands.
export const katsuraType = (giant, pick) => (giant ? 'giant' : pick < 0.3 ? 'young' : 'mature');

// Models already grown, by seed and type: a chunk is meshed again and again.
const grown = new Map();
export function katsuraFor(seed, type) {
  const key = `${seed}|${type}`;
  let m = grown.get(key);
  if (!m) {
    m = katsuraModel(seed, type);
    grown.set(key, m);
    if (grown.size > 96) grown.delete(grown.keys().next().value);
  }
  return m;
}

export { SIDES };
