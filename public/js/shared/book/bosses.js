// The bosses at the ends of the stories of the Storybook (level.js arena), one
// each, and the last of them Count Inkblot himself. Each goes through moves
// one after another (phases), each move lasting so long; what it does in each,
// where it is, what it throws and where it can be landed on to hurt it, is
// worked out from where the move began and how long ago (bossAt), the same on
// every page and on the island. Only the island moves a boss on to its next
// move (stepBoss), choosing whom it goes for as it starts it, and only the
// island takes a heart off it (hitBoss), for a stomp that lands while it is
// weak — tired, stuck, napping, out of breath.

// The state of a boss, as the island keeps it and tells everyone: { kind,
// phase (the key of its move), at (when it began, ms on the story's clock),
// from { x, y, face } (where it was then), to { x, pot } (what it went for),
// n (how many moves it has made), hearts, max, prev (the move before) }.

const ease = (u) => {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
};
const lerp = (a, b, u) => a + (b - a) * u;
const clampIn = (A, x, pad = 2.2) => Math.max(A.x0 + pad, Math.min(A.x1 - pad, x));
const mid = (A) => (A.x0 + A.x1) / 2;

// How quickly a boss gets through its moves: faster the fewer hearts it has.
const pace = (b) => 0.72 + 0.28 * (b.hearts / Math.max(1, b.max));

// An arc from (x0, y0) to (x1, y1) over secs, high at the top: where it is u
// of the way.
function lob(x0, y0, x1, y1, high, u) {
  return { x: lerp(x0, x1, u), y: lerp(y0, y1, u) + high * 4 * u * (1 - u) };
}

// A body's box: { x (middle), y (foot), w, h }.
const box = (x, y, w, h) => ({ x, y, w, h });

// ---------------------------------------------------------------- the five

export const BOSSES = {
  // Hopscotch Meadow: a great grumpy thistle in three flower pots. It comes up
  // in one, spits seeds at you, wilts — stomp its flower then — and goes back
  // down to come up in another.
  grumbleweed: {
    name: 'Grumbleweed',
    icon: '🌻',
    hearts: 3,
    first: 'under',
    pots: (A) => [A.x0 + 5, mid(A) + 0.5, A.x1 - 5],
    phases: {
      under: { ms: 900, hide: true, next: () => 'rise', aim: aimPot },
      rise: { ms: 550, next: () => 'spit', pose: (b, s, A) => weedPose(b, A, ease(s / 0.55)) },
      spit: {
        ms: 2600,
        weak: true,
        next: () => 'droop',
        pose: (b, s, A) => ({ ...weedPose(b, A, 1), sway: Math.sin(s * 5) * 0.15 }),
        shots: (b, s, A) => seeds(b, s, A),
      },
      droop: { ms: 1700, weak: true, tired: true, next: () => 'sink', pose: (b, s, A) => ({ ...weedPose(b, A, 1), droop: ease(s / 0.4) }) },
      sink: { ms: 500, next: () => 'under', pose: (b, s, A) => weedPose(b, A, 1 - ease(s / 0.5)) },
      hurt: { ms: 1200, safe: true, next: () => 'sink', pose: (b, s, A) => ({ ...weedPose(b, A, 1), shake: 1 - s / 1.2, droop: 0.6 }) },
    },
    // Stood in its pot, its flower on top: the stem hurts, the flower can be
    // stomped on.
    body: (p) => (p.hide || p.up < 0.4 ? [] : [box(p.x, p.y, 0.9, 1.5 * p.up)]),
    weakSpot: (p) => (p.up < 0.6 ? null : box(p.x, p.y + (1.6 - (p.droop ?? 0) * 0.5) * p.up, 2.2, 1.0)),
  },

  // Paper Boat Harbor: Captain Crumple, a crab in a paper hat. He sidles after
  // you, snaps, and charges — straight into the wall, where he lands on his
  // back: stomp his tummy then.
  crumple: {
    name: 'Captain Crumple',
    icon: '🦀',
    hearts: 4,
    first: 'walk',
    phases: {
      walk: {
        ms: 2100,
        next: (b) => (b.n % 3 === 2 ? 'charge' : 'snap'),
        aim: aimPlayer,
        pose: (b, s, A) => {
          const to = clampIn(A, b.to?.x ?? b.from.x, 2.6);
          const x = lerp(b.from.x, to, ease(s / 1.7));
          return { x, y: A.floor, face: to >= b.from.x ? 1 : -1, look: 'walk', step: s * 8 };
        },
      },
      snap: {
        ms: 1000,
        next: () => 'walk',
        aim: aimPlayer,
        pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'snap', snap: s > 0.3 && s < 0.75 ? 1 : 0 }),
      },
      charge: {
        ms: (b, A) => 450 + (Math.abs(chargeEnd(b, A) - b.from.x) / 9) * 1000,
        next: () => 'stuck',
        aim: aimPlayer,
        pose: (b, s, A) => {
          const end = chargeEnd(b, A);
          const run = Math.max(0, s - 0.45);
          const x = Math.abs(end - b.from.x) < 0.01 ? end : b.from.x + Math.sign(end - b.from.x) * Math.min(Math.abs(end - b.from.x), run * 9);
          return { x, y: A.floor, face: end >= b.from.x ? 1 : -1, look: s < 0.45 ? 'wind' : 'charge', step: s * 16, shake: s < 0.45 ? 1 : 0 };
        },
      },
      stuck: { ms: 2700, weak: true, tired: true, safe: true, next: () => 'up', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'stuck', step: s * 10 }) },
      up: { ms: 650, safe: true, next: () => 'walk', aim: aimPlayer, pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'up', k: s / 0.65 }) },
      hurt: { ms: 1100, safe: true, next: () => 'up', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'stuck', shake: 1 - s / 1.1 }) },
    },
    body: (p) => {
      if (p.look === 'stuck' || p.look === 'up') return [];
      const out = [box(p.x, p.y, 3.0, 1.7)];
      if (p.snap) out.push(box(p.x, p.y + 0.3, 5.4, 1.0));
      return out;
    },
    weakSpot: (p) => (p.look === 'stuck' ? box(p.x, p.y + 0.8, 3.0, 0.9) : null),
  },

  // Once-upon Castle: the Paper Dragon, a kite with a dragon's head. It flies
  // over the top dropping fire, swoops down at you, and has to stop for breath
  // on the floor: stomp it then.
  paperdragon: {
    name: 'The Paper Dragon',
    icon: '🐉',
    hearts: 4,
    first: 'rise',
    phases: {
      fly: {
        ms: 3800,
        next: () => 'swoop',
        pose: (b, s, A) => {
          const from = b.from.x;
          const to = from < mid(A) ? A.x1 - 3 : A.x0 + 3;
          const u = ease(s / 3.8);
          return { x: lerp(from, to, u), y: A.floor + 7 + Math.sin(s * 3) * 0.5, face: to > from ? 1 : -1, look: 'fly', flap: s * 7 };
        },
        shots: (b, s, A) => fireballs(b, s, A),
      },
      swoop: {
        ms: 1500,
        next: () => 'rest',
        aim: aimPlayer,
        pose: (b, s, A) => {
          const to = clampIn(A, b.to?.x ?? mid(A), 3);
          const u = ease(s / 1.1);
          const slide = Math.max(0, s - 1.1) * 4;
          const dir = to >= b.from.x ? 1 : -1;
          const x = clampIn(A, lerp(b.from.x, to, u) + dir * slide, 2.4);
          return { x, y: lerp(b.from.y, A.floor, Math.min(1, u * u * 1.2)), face: dir, look: 'swoop', flap: s * 4 };
        },
      },
      rest: { ms: 2800, weak: true, tired: true, safe: true, next: () => 'rise', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'rest', pant: s * 6 }) },
      rise: {
        ms: 900,
        safe: true,
        next: () => 'fly',
        pose: (b, s, A) => {
          const side = b.from.x < mid(A) ? A.x0 + 3 : A.x1 - 3;
          const u = ease(s / 0.9);
          return { x: lerp(b.from.x, side, u), y: lerp(b.from.y ?? A.floor, A.floor + 7, u), face: side >= b.from.x ? 1 : -1, look: 'fly', flap: s * 9 };
        },
      },
      hurt: { ms: 1100, safe: true, next: () => 'rise', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'rest', shake: 1 - s / 1.1 }) },
    },
    body: (p) => (p.look === 'rest' ? [] : [box(p.x, p.y, 3.0, 1.6)]),
    weakSpot: (p) => (p.look === 'rest' ? box(p.x, p.y + 1.0, 3.2, 0.9) : null),
  },

  // Twinkle Sky: King Nibbles, the mouse who has been nibbling the moon. He
  // hops after you (and the moon shakes where he lands: jump the ripple),
  // bowls cheeses, and nods off: stomp his crown then.
  nibbles: {
    name: 'King Nibbles',
    icon: '🐭',
    hearts: 4,
    first: 'hop',
    phases: {
      hop: {
        ms: 1150,
        next: (b) => ((b.n + 1) % 4 === 0 ? 'nap' : (b.n + 1) % 4 === 2 ? 'bowl' : 'hop'),
        aim: aimPlayer,
        pose: (b, s, A) => {
          const to = clampIn(A, b.to?.x ?? b.from.x, 2.4);
          const u = ease(s / 1.0);
          const p = lob(b.from.x, A.floor, lerp(b.from.x, to, 0.85), A.floor, 4.2, Math.min(1, s / 1.0));
          return { x: p.x, y: p.y, face: to >= b.from.x ? 1 : -1, look: s < 1.0 ? 'hop' : 'land', k: u };
        },
        shots: (b, s, A) => ripple(b, s, A),
      },
      bowl: {
        ms: 2000,
        next: () => 'hop',
        aim: aimPlayer,
        pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'bowl', k: s / 2 }),
        shots: (b, s, A) => [...ripple(b, s, A), ...cheeses(b, s, A)],
      },
      nap: { ms: 3000, weak: true, tired: true, safe: true, next: () => 'wake', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'nap', snore: s }), shots: (b, s, A) => ripple(b, s, A) },
      wake: { ms: 550, safe: true, next: () => 'hop', aim: aimPlayer, pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'wake' }) },
      hurt: { ms: 1100, safe: true, next: () => 'wake', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'nap', shake: 1 - s / 1.1 }) },
    },
    body: (p) => (p.look === 'nap' || p.look === 'wake' ? [] : [box(p.x, p.y, 2.2, 2.4)]),
    weakSpot: (p) => (p.look === 'nap' ? box(p.x, p.y + 1.6, 2.4, 0.9) : null),
  },

  // Inkwell Keep: Count Inkblot, the blot who spilt himself over every story.
  // He glides over the top dripping ink, throws blots, and has to come down
  // for breath (stomp his hat); with half his hearts gone, he floods the floor
  // with ink as well (up on a plank!), and shoots quills.
  inkblot: {
    name: 'Count Inkblot',
    icon: '🎩',
    hearts: 6,
    first: 'rise',
    phases: {
      glide: {
        ms: 3200,
        next: (b) => (b.hearts <= b.max / 2 && b.n % 2 === 1 ? 'quills' : 'blots'),
        pose: (b, s, A) => {
          const from = b.from.x;
          const to = from < mid(A) ? A.x1 - 3 : A.x0 + 3;
          return { x: lerp(from, to, ease(s / 3.2)), y: A.floor + 6 + Math.sin(s * 2.4) * 0.4, face: to > from ? 1 : -1, look: 'glide', k: s };
        },
        shots: (b, s, A) => drips(b, s, A),
      },
      blots: {
        ms: 1900,
        next: () => 'land',
        aim: aimPlayer,
        pose: (b, s, A) => ({ x: b.from.x, y: b.from.y ?? A.floor + 6, face: b.from.face, look: 'throw', k: s }),
        shots: (b, s, A) => blots(b, s, A),
      },
      quills: {
        ms: 1800,
        next: () => 'land',
        aim: aimPlayer,
        pose: (b, s, A) => ({ x: b.from.x, y: b.from.y ?? A.floor + 6, face: b.from.face, look: 'throw', k: s }),
        shots: (b, s, A) => quills(b, s, A),
      },
      land: {
        ms: 2700,
        weak: (b, s) => s > 0.6,
        tired: true,
        next: () => 'rise',
        pose: (b, s, A) => ({ x: b.from.x, y: lerp(b.from.y ?? A.floor, A.floor, ease(s / 0.6)), face: b.from.face, look: s < 0.6 ? 'fall' : 'puff', k: s }),
      },
      rise: {
        ms: 800,
        safe: true,
        next: (b) => (b.hearts <= b.max / 2 ? 'flood' : 'glide'),
        pose: (b, s, A) => {
          const side = b.from.x < mid(A) ? A.x0 + 3 : A.x1 - 3;
          const u = ease(s / 0.8);
          return { x: lerp(b.from.x, side, u), y: lerp(b.from.y ?? A.floor, A.floor + 6, u), face: side > b.from.x ? 1 : -1, look: 'glide', k: s };
        },
      },
      flood: {
        ms: 3400,
        next: () => 'glide',
        pose: (b, s, A) => ({ x: lerp(b.from.x, mid(A), ease(s / 0.8)), y: A.floor + 7, face: b.from.face, look: 'laugh', k: s, flood: floodAt(s) }),
        shots: (b, s) => {
          const f = floodAt(s);
          return f > 0.05 ? [{ flood: true, y: f * 0.8, x: 0, r: 0 }] : [];
        },
      },
      hurt: { ms: 1200, safe: true, next: () => 'rise', pose: (b, s, A) => ({ x: b.from.x, y: A.floor, face: b.from.face, look: 'puff', shake: 1 - s / 1.2 }) },
    },
    body: (p) => (p.look === 'puff' || p.look === 'fall' ? [] : [box(p.x, p.y, 1.8, 2.4)]),
    weakSpot: (p) => (p.look === 'puff' ? box(p.x, p.y + 2.0, 2.0, 0.9) : null),
  },
};

export const BOSS_KINDS = Object.keys(BOSSES);
export const bossSpec = (kind) => BOSSES[kind] ?? BOSSES.grumbleweed;

// ---------------------------------------------------------------- helpers

// Grumbleweed in the pot it came up in: up, how far out of it.
function weedPose(b, A, up) {
  const pots = BOSSES.grumbleweed.pots(A);
  const x = pots[b.to?.pot ?? 1];
  return { x, y: A.floor + 1.1, face: 1, up, look: 'weed' };
}

function aimPot(b, A, people, rng) {
  const pots = BOSSES.grumbleweed.pots(A);
  const was = b.to?.pot ?? 1;
  const who = pick(people, b, rng);
  let best = (was + 1) % 3;
  if (who) {
    // The pot nearest whoever it goes for, but never the same one twice.
    let far = Infinity;
    for (let i = 0; i < 3; i++) {
      if (i === was) continue;
      const d = Math.abs(pots[i] - who.x);
      if (d < far) [far, best] = [d, i];
    }
  }
  return { pot: best, x: who ? clampIn(A, who.x, 1.5) : mid(A) };
}

function aimPlayer(b, A, people, rng) {
  const who = pick(people, b, rng);
  return { x: who ? who.x : mid(A) };
}

function pick(people, b, rng) {
  if (!people.length) return null;
  return people[Math.floor((rng ? rng.next() : 0) * people.length) % people.length];
}

// Where a charge ends: against the wall in the way it set off (towards
// whoever it went for).
function chargeEnd(b, A) {
  const dir = (b.to?.x ?? mid(A)) >= b.from.x ? 1 : -1;
  return dir > 0 ? A.x1 - 2.4 : A.x0 + 2.4;
}

// Grumbleweed's seeds: three, lobbed at where you were as it came up.
function seeds(b, s, A) {
  const out = [];
  const p = weedPose(b, A, 1);
  const target = b.to?.x ?? mid(A);
  [0.45, 1.15, 1.85].forEach((at, k) => {
    const age = s - at;
    if (age < 0 || age > 1.05) return;
    const x1 = clampIn(A, target + (k - 1) * 1.8, 1.2);
    const q = lob(p.x, p.y + 2.6, x1, A.floor + 0.3, 2.5, age / 1.05);
    out.push({ x: q.x, y: q.y, r: 0.38, n: k, kind: 'seed' });
  });
  return out;
}

// The Paper Dragon's fire: dropped as it flies, falling, and burning a moment
// where it lands.
function fireballs(b, s, A) {
  const out = [];
  [0.7, 1.7, 2.7].forEach((at, k) => {
    const age = s - at;
    if (age < 0) return;
    const from = BOSSES.paperdragon.phases.fly.pose(b, at, A);
    const fall = 0.5 * 16 * age * age;
    const y = from.y - 0.2 - fall;
    if (y > A.floor + 0.35) out.push({ x: from.x, y, r: 0.42, n: k, kind: 'fire' });
    else {
      const land = Math.sqrt((2 * (from.y - 0.2 - A.floor - 0.35)) / 16);
      if (age - land < 0.8) out.push({ x: from.x, y: A.floor + 0.35, r: 0.5, n: k, kind: 'flame' });
    }
  });
  return out;
}

// King Nibbles landing makes the moon shake: a ripple running out both ways
// along the floor from where he came down, just after a hop.
function ripple(b, s, A) {
  if (b.prev !== 'hop') return [];
  if (s > 1.3) return [];
  const out = [];
  for (const dir of [-1, 1]) {
    const x = b.from.x + dir * (1.2 + s * 7);
    if (x < A.x0 + 0.5 || x > A.x1 - 0.5) continue;
    out.push({ x, y: A.floor + 0.3, r: 0.35, kind: 'ripple', n: dir });
  }
  return out;
}

// King Nibbles' cheeses: bowled both ways, rolling to the walls.
function cheeses(b, s, A) {
  const out = [];
  [
    [0.6, b.from.face],
    [1.2, -b.from.face],
  ].forEach(([at, dir], k) => {
    const age = s - at;
    if (age < 0) return;
    const x = b.from.x + dir * (1.4 + age * 6);
    if (x < A.x0 + 0.6 || x > A.x1 - 0.6) return;
    out.push({ x, y: A.floor + 0.5, r: 0.5, kind: 'cheese', n: k, spin: -dir * age * 12 });
  });
  return out;
}

// Count Inkblot's ink: dripped as he glides, falling straight down.
function drips(b, s, A) {
  const out = [];
  [0.6, 1.4, 2.2, 2.9].forEach((at, k) => {
    const age = s - at;
    if (age < 0) return;
    const from = BOSSES.inkblot.phases.glide.pose(b, at, A);
    const y = from.y - 0.4 - 0.5 * 18 * age * age;
    if (y > A.floor + 0.2) out.push({ x: from.x, y, r: 0.36, n: k, kind: 'drip' });
  });
  return out;
}

// ...and his blots, thrown in arcs at where you were, a little either side.
function blots(b, s, A) {
  const out = [];
  const target = b.to?.x ?? mid(A);
  [0.4, 0.8, 1.2].forEach((at, k) => {
    const age = s - at;
    if (age < 0 || age > 0.9) return;
    const x1 = clampIn(A, target + (k - 1) * 2.6, 1.2);
    const q = lob(b.from.x, (b.from.y ?? A.floor + 6) + 0.6, x1, A.floor + 0.3, 1.2, age / 0.9);
    out.push({ x: q.x, y: q.y, r: 0.42, n: k, kind: 'blot' });
  });
  return out;
}

// ...and his quills, shot straight across at three heights.
function quills(b, s, A) {
  const out = [];
  const dir = (b.to?.x ?? mid(A)) >= b.from.x ? 1 : -1;
  [
    [0.35, 0.7],
    [0.8, 2.3],
    [1.25, 0.7],
  ].forEach(([at, high], k) => {
    const age = s - at;
    if (age < 0) return;
    const x = b.from.x + dir * (1 + age * 11);
    if (x < A.x0 + 0.5 || x > A.x1 - 0.5) return;
    out.push({ x, y: A.floor + high, r: 0.3, n: k, kind: 'quill', face: dir });
  });
  return out;
}

// How high the ink is over the floor in a flood, from 0 to 1: up, a while
// there, and down again.
function floodAt(s) {
  if (s < 0.7) return 0;
  if (s < 1.2) return (s - 0.7) / 0.5;
  if (s < 2.7) return 1;
  if (s < 3.2) return 1 - (s - 2.7) / 0.5;
  return 0;
}

// ---------------------------------------------------------------- the moves

const phaseOf = (b) => {
  const spec = bossSpec(b.kind);
  return spec.phases[b.phase] ?? spec.phases[spec.first];
};

// How long a boss's move lasts, ms.
export function phaseMs(b, A) {
  const ph = phaseOf(b);
  const ms = typeof ph.ms === 'function' ? ph.ms(b, A) : ph.ms;
  return ph.safe || ph.tired ? ms : ms * pace(b);
}

// A boss as it starts: hearts (more, with more people to share them).
export function newBoss(kind, A, hearts = null) {
  const spec = bossSpec(kind);
  const max = hearts ?? spec.hearts;
  return { kind, phase: spec.first, at: 0, from: { x: A.x0 + (A.x1 - A.x0) * 0.62, y: A.floor, face: -1 }, to: null, n: 0, hearts: max, max, prev: null };
}

// Where a boss is at time t (ms on the story's clock) and what it is doing:
// { x, y, face, look, ... (its move's own), phase, weak (can be stomped now),
// safe (touching it does not hurt), hide, bodies (boxes that hurt), spot (the
// box to land on), shots (what it has thrown, in the air: { x, y, r }, or a
// flood: { flood, y }) }.
export function bossAt(b, t, A) {
  const spec = bossSpec(b.kind);
  // Beaten: where its last heart came off, going pop.
  if (b.phase === 'beaten') return { x: b.from.x, y: b.from.y ?? A.floor, face: b.from.face, look: 'beaten', phase: 'beaten', k: Math.max(0, t - b.at) / 1000, hide: false, weak: false, safe: true, bodies: [], spot: null, shots: [] };
  const ph = phaseOf(b);
  const ms = phaseMs(b, A);
  const s = Math.max(0, Math.min(ms, t - b.at)) / 1000;
  // (The moves' own clocks run at its pace: a move takes ms, made to last as
  // long as its spec says at full pace.)
  const k = ph.safe || ph.tired ? 1 : pace(b);
  const sp = s / k;
  const base = ph.pose ? ph.pose(b, sp, A) : { x: b.from.x, y: b.from.y ?? A.floor, face: b.from.face };
  const p = { face: 1, look: b.phase, ...base, phase: b.phase, hide: Boolean(ph.hide) };
  p.weak = typeof ph.weak === 'function' ? ph.weak(b, sp) : Boolean(ph.weak);
  p.safe = Boolean(ph.safe) || p.hide;
  p.bodies = p.safe ? [] : spec.body(p);
  p.spot = p.weak ? spec.weakSpot(p) : null;
  p.shots = ph.shots ? ph.shots(b, sp, A) : [];
  return p;
}

// Moves a boss on to its next move once this one is over (the island does:
// tale.js). people: whoever is on its page, { x, y }, for it to go for; rng: the
// island's. Whether it moved on.
export function stepBoss(b, now, A, people, rng) {
  if (b.phase === 'beaten') return false;
  const ms = phaseMs(b, A);
  if (now - b.at < ms) return false;
  const spec = bossSpec(b.kind);
  const ph = phaseOf(b);
  const end = bossAt(b, b.at + ms, A);
  const next = ph.next(b, A);
  const nph = spec.phases[next] ?? spec.phases[spec.first];
  b.prev = b.phase;
  b.phase = next;
  // (Not long ago, if it has been so long that the moves are far behind.)
  b.at = Math.max(b.at + ms, now - 250);
  b.from = { x: end.x, y: end.y, face: end.face ?? b.from.face };
  b.to = nph.aim ? nph.aim(b, A, people, rng) : b.to;
  b.n++;
  return true;
}

// A stomp on a boss at time t: whether it was weak then (and so takes a heart
// off it, and it starts its hurt move, or its last, beaten). The island's.
export function hitBoss(b, t, A) {
  if (b.phase === 'beaten' || b.hearts <= 0) return false;
  const p = bossAt(b, t, A);
  if (!p.weak) return false;
  b.hearts = Math.max(0, b.hearts - 1);
  b.prev = b.phase;
  b.phase = b.hearts > 0 ? 'hurt' : 'beaten';
  b.at = t;
  b.from = { x: p.x, y: p.y, face: p.face };
  b.n++;
  return true;
}

// A boss for the wire, and back.
export function packBoss(b) {
  return [b.kind, b.phase, Math.round(b.at), +b.from.x.toFixed(2), +(b.from.y ?? 0).toFixed(2), b.from.face, b.to ? +(b.to.x ?? 0).toFixed(2) : null, b.to?.pot ?? null, b.n, b.hearts, b.max, b.prev];
}

export function unpackBoss(row) {
  if (!Array.isArray(row) || row.length < 12 || !BOSSES[row[0]]) return null;
  const [kind, phase, at, x, y, face, tx, pot, n, hearts, max, prev] = row;
  return { kind, phase, at, from: { x, y, face }, to: tx === null && pot === null ? null : { x: tx ?? 0, pot: pot ?? undefined }, n, hearts, max, prev };
}
