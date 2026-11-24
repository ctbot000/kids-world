// The bosses of the Land of Nod, one to each dream, on a little world of its
// own: frights like the others (foes.js), only far bigger, with more ways to
// strike and a way in that takes the world they stand on to find.
import { addFrights, OPENINGS } from './foes.js';
import { add, carry, cross, dist3, dot, flatUnit, mul, sub, turn } from './shape.js';

// How cross a boss is, by how many of its hearts are gone: 0, 1 or 2.
export const rageOf = (f) => {
  const gone = (f.max - f.hearts) / f.max;
  return gone >= 0.66 ? 2 : gone >= 0.33 ? 1 : 0;
};
const from = (n) => (f) => rageOf(f) >= n;
const upTo = (n) => (f) => rageOf(f) <= n;
const helpers = (most) => (f, sim) => sim.of(f.camp).filter((o) => o.helper).length < most;

addFrights({
  // Rambunctious, the ram of Pillow Moons: as big as a cottage, all wool. He
  // charges half way round his moon, rolls all the way round it, and stomps
  // rings that run right over it: let him run into his own bedposts.
  rambunctious: {
    name: 'Rambunctious', icon: '🐏', boss: true, big: true, hearts: 6, chips: 6, radius: 1.7, height: 3, speed: 3, style: 'come', range: [6, 12], guard: 'all', bonk: true, steady: true,
    moves: [
      { k: 'charge', near: 5, far: 60, windup: 1150, len: 40, speed: 15, w: 1.5, b: 2, rest: 800, every: 900 },
      { k: 'wave', near: 0, far: 60, windup: 850, n: 1, speed: 8, reach: 26, w: 1.2, b: 1, rest: 500, every: 900, when: upTo(0) },
      { k: 'charge', near: 5, far: 60, windup: 1000, len: 40, speed: 16, w: 1.5, b: 2, rest: 500, every: 700, when: from(1) },
      { k: 'wave', near: 0, far: 60, windup: 800, n: 2, gap: 720, speed: 8.5, reach: 26, w: 1.2, b: 1, rest: 500, every: 800, when: from(1) },
      { k: 'charge', near: 4, far: 60, windup: 1200, len: 74, speed: 17, w: 1.6, b: 2, rest: 700, every: 900, look: 'roll', when: from(1) },
      { k: 'leap', near: 3, far: 20, windup: 700, ms: 950, r: 3.4, high: 7, b: 1.5, rest: 600, every: 700, when: from(2) },
      { k: 'wave', near: 0, far: 60, windup: 700, n: 3, gap: 640, speed: 9, reach: 26, w: 1.2, b: 1, rest: 600, every: 800, when: from(2) },
      { k: 'call', near: 0, far: 60, windup: 700, kind: 'bunny', n: 3, rest: 400, every: 900, when: (f, sim) => rageOf(f) >= 1 && helpers(3)(f, sim) },
    ],
    told: 'Nothing gets through all that wool. Stand in front of a bedpost, and roll aside as he charges: BONK!',
  },
});

// ---------------------------------------------------------------- Old Munch

// Old Munch, the caterpillar of Pumpkin Skies, goes round and round his pumpkin
// with a train of joints after him, each in a studded waistcoat — all but the
// last, which is bare. Keep out of his jaws and get round to his tail! Each joint
// popped off leaves the next one bare, and him shorter, quicker and crosser; and
// with none left, there is only his head to catch.
const JOINTS = 6;
const APART = 1.7;
const BARE_MS = 6500;

function munchBegin(sim, f) {
  f.soft = false;
  f.trail = [];
  f.hearts = f.max = JOINTS + 1;
  f.side = 1;
  f.sore = 0;
  const back = f.body.walk(f, mul(f.h, -1), (JOINTS + 1) * APART + 1, 0.25);
  for (const q of back.reverse()) f.trail.push({ x: q.x, y: q.y, z: q.z });
  f.segs = [];
  for (let i = 0; i < JOINTS; i++) {
    const seg = sim.add('munchseg', { x: f.x, y: f.y, z: f.z, body: f.body }, { camp: f.camp, held: true, n: i, soft: false });
    seg.brain = () => {};
    seg.more = (o) => [o.soft ? 1 : 0, o.n];
    seg.state = 'walk';
    seg.onPop = () => munchLoses(sim, f, seg);
    seg.onHurt = () => {
      // (Bopped about for long, he wriggles the lot of them.)
      f.sore += 1;
      if (f.sore >= 3) f.cool = Math.min(f.cool, sim.now + 150);
    };
    f.segs.push(seg);
  }
  f.segs.at(-1).soft = true;
  f.brain = munchBrain;
}

function munchLoses(sim, f, seg) {
  f.segs = f.segs.filter((o) => o !== seg);
  f.hearts = f.segs.length + 1;
  f.state = 'hurt';
  f.until = sim.now + 1100;
  f.cool = sim.now + 1400;
  f.act = null;
  f.open = null;
  f.sore = 0;
  sim.fx('ouch', f);
  // Off he bolts, his waistcoat held down tight behind him: a while till his
  // next joint is bare.
  f.boltTill = sim.now + 3200;
  f.bareAt = sim.now + BARE_MS;
  if (!f.segs.length) {
    // Only his head left, and it is no fun at all any more: off he goes.
    f.soft = true;
    f.chips = 8;
    sim.fx('bare', f);
  }
}

function munchBrain(sim, f, dt, now) {
  const p = sim.aim(f);
  const rage = rageOf(f);
  const alone = !f.segs.length;
  f.state = 'walk';
  if (f.bareAt && now >= f.bareAt && f.segs.length) {
    f.bareAt = 0;
    f.segs.at(-1).soft = true;
  }
  if (f.open && now >= f.openUntil) sim.shut(f);
  if (f.open) f.state = 'open';
  else if (f.until > now) f.state = 'hurt';
  else if (now - f.born < 1400) f.state = 'come';
  else if (f.act) sim.runAct(f, dt, now);
  else if (p) {
    const t = sim.toward(f, p);
    const mv = now >= f.cool && !alone && sim.mayStrike(p, now) ? sim.pick(f, t) : null;
    if (mv) sim.start(f, mv, p, t, now);
    else {
      // After whoever is nearest, no quicker to turn than something that long
      // can be; or, with nothing left to him, away.
      const want = alone ? mul(t.way, -1) : t.way;
      const ahead = f.body.clutter(f.x + f.h.x * 2 + f.up.x, f.y + f.h.y * 2 + f.up.y, f.z + f.h.z * 2 + f.up.z);
      const rate = (alone ? 2.6 : 1.25 + rage * 0.25) * (ahead < 1 ? 1.8 : 1);
      sim.face(f, ahead < 0.8 ? flatUnit(cross(f.up, f.h), f.up) : want, dt, rate);
      sim.go(f, f.h, alone ? 6.2 : (now < (f.boltTill ?? 0) ? 6.6 : 4.2) + rage * 0.7, dt, false);
    }
  } else sim.go(f, f.h, 2.4, dt, false);
  // The rest of him comes after, just where his head has been.
  const last = f.trail.at(-1);
  if (dist3(last, f) > 0.22) f.trail.push({ x: f.x, y: f.y, z: f.z });
  if (f.trail.length > 90) f.trail.shift();
  let i = f.trail.length - 1;
  let left = APART + 0.2;
  let at = { x: f.x, y: f.y, z: f.z };
  for (const seg of f.segs) {
    while (i > 0) {
      const d = dist3(at, f.trail[i]);
      if (d >= left) break;
      left -= d;
      at = f.trail[i];
      i--;
    }
    const to = f.trail[i];
    const d = dist3(at, to) || 1;
    const q = add(at, sub(to, at), Math.min(1, left / d));
    const was = { x: seg.x, y: seg.y, z: seg.z };
    const g = f.body.land(q, 3);
    Object.assign(seg, g, { up: f.body.up(g.x, g.y, g.z) });
    const way = sub(at, seg);
    seg.h = flatUnit(dist3(way, { x: 0, y: 0, z: 0 }) > 0.01 ? way : sub(seg, was), seg.up);
    seg.state = f.state === 'come' ? 'come' : 'walk';
    at = q;
    left = APART;
  }
}

addFrights({
  munch: {
    name: 'Old Munch', icon: '🐛', boss: true, big: true, hearts: JOINTS + 1, chips: 8, radius: 1.3, height: 2.5, speed: 4.2, style: 'come', range: [0, 2], guard: 'all', steady: true, begin: munchBegin,
    moves: [
      { k: 'lunge', near: 0, far: 6.5, windup: 700, len: 6, speed: 13, w: 1.1, b: 1.5, rest: 500, every: 1700, flash: true },
      { k: 'lob', near: 4, far: 40, windup: 700, n: 3, spread: 3.6, ms: 950, high: 6, r: 1.7, b: 1, rest: 300, every: 1800, look: 'seed', each: true },
      // All his joints at once, once he has been bopped about enough.
      { k: 'spots', near: 0, far: 60, windup: 850, r: 1.9, b: 1.2, rest: 400, every: 1300, when: (f) => f.sore >= 3, where: (sim, f) => { f.sore = 0; return f.segs; } },
      { k: 'lunge', near: 0, far: 8, windup: 520, len: 7.5, speed: 15, w: 1.1, b: 1.5, rest: 400, every: 1300, flash: true, when: from(1) },
      { k: 'shot', near: 3, far: 30, windup: 700, n: 5, fan: 0.4, speed: 9, len: 26, r: 0.45, b: 0.9, rest: 300, every: 1500, back: true, look: 'seed', when: from(1) },
    ],
    told: 'Old Munch’s waistcoats are all studs — but his tail is bare. Keep out of his jaws, get round behind him and bop it!',
  },
  munchseg: { name: 'Old Munch', icon: '🐛', hearts: 1, chips: 7, radius: 0.95, height: 1.6, speed: 0, style: 'stay', still: true, guard: 'all', part: true, big: true, moves: [], told: 'That one is all studs! Only Old Munch’s very last joint is bare.' },
});

// ---------------------------------------------------------------- Maestro Crescendo

// Maestro Crescendo stands on his box in the middle of his podium. He shows a
// tune (fx 'tune'), one beat to each of it — a ring to jump, a note to bop back,
// a crash to roll clear of — and then plays it at everyone, in the same order, on
// the beat. Enough of his notes bopped back and he is flustered, and drops his
// baton. Each time, his next tune is longer and quicker.
const FLUSTER = 2;
const PARTS = {
  ring: { k: 'wave', windup: 760, n: 1, speed: 9, reach: 28, w: 1, b: 1, rest: 0, every: 0 },
  note: { k: 'shot', windup: 760, n: 1, seek: 1.9, speed: 9, len: 30, r: 0.5, b: 0.9, rest: 0, every: 0, back: true, look: 'note' },
  crash: { k: 'spots', windup: 900, r: 2.4, b: 1.1, rest: 0, every: 0, where: (sim, f) => sim.people.filter((p) => !p.dizzy && p.body === f.body).slice(0, 4).map((p) => sim.lead(p, 900)) },
};

function maestroBegin(sim, f) {
  f.fluster = 0;
  f.stage = 'bow';
  f.next = sim.now + 2200;
  f.more = (o) => [o.stage === 'show' ? 1 : 0];
  f.onReturned = (s, o, now) => {
    o.fluster++;
    s.fx('fluster', o, { n: o.fluster, of: FLUSTER });
    if (o.fluster < FLUSTER) return true;
    o.fluster = 0;
    o.stage = 'bow';
    o.next = now + 5600;
    return s.opens(o, 'stun', now, 4800);
  };
  f.onHeart = (s, o, now) => {
    o.stage = 'bow';
    o.fluster = 0;
    o.next = now + 1800;
  };
  f.brain = maestroBrain;
}

function maestroBrain(sim, f, dt, now) {
  const rage = rageOf(f);
  const p = sim.aim(f);
  if (f.open) {
    if (now < f.openUntil) {
      f.state = 'open';
      return;
    }
    sim.shut(f);
    f.next = Math.max(f.next, now + 900);
  }
  if (f.state === 'hurt' && now < f.until) return;
  f.state = now - f.born < 1200 ? 'come' : 'idle';
  if (p) sim.face(f, sim.toward(f, p).way, dt, 3);
  if (!p || now < f.next) return;
  const beat = 600 - rage * 60;
  if (f.stage === 'bow') {
    // A tune of his: never the same twice running, with a note in it always.
    const n = 3 + rage;
    const all = ['ring', 'note', 'crash'];
    f.tune = Array.from({ length: n }, () => all[Math.floor(sim.rng.next() * 3)]);
    if (f.tune.filter((k) => k === 'note').length < 2) {
      f.tune[0] = 'note';
      f.tune[n - 1] = 'note';
    }
    f.stage = 'show';
    f.next = now + beat * (n + 1);
    sim.fx('tune', f, { seq: f.tune, beat });
    // (Anyone right up by him is swept back as he lifts his arms.)
    if (sim.people.some((q) => q.body === f.body && !q.dizzy && dist3(q, f) < 4)) sim.launch(f, { k: 'burst', windup: 900, r: 4, b: 1, rest: 0 }, p, now);
    if (rage >= 1 && sim.of(f.camp).filter((o) => o.helper).length < 2) {
      const q = f.body.walk(f, turn(f.h, f.up, 2.2), 6, 1).at(-1);
      sim.add('quaver', { ...q, body: f.body }, { camp: f.camp, helper: true });
    }
    return;
  }
  if (f.stage === 'show') {
    f.stage = 'play';
    f.at = 0;
  }
  // Playing it: each part in its turn, a little quicker the crosser he is.
  const part = PARTS[f.tune[f.at]];
  if (part.k === 'shot') {
    for (const q of sim.people.filter((o) => !o.dizzy && o.body === f.body).slice(0, 4)) sim.launch(f, part, q, now);
  } else sim.launch(f, part, p, now);
  sim.fx('part', f, { i: f.at });
  f.at++;
  if (f.at < f.tune.length) f.next = now + beat * (2.1 - rage * 0.3);
  else {
    f.stage = 'bow';
    f.next = now + 2300 - rage * 300;
  }
}

// ---------------------------------------------------------------- Old Tock

// Old Tock stands in the middle of the front of his dial, and nothing hurts him
// there. His hands sweep right round it, he strikes rings that run out over both
// sides, and once he has struck the hour he has run right down — and then his key,
// round the back, can be bopped. It winds him up again, and gives him a turn.
function tockBegin(sim, f, dream) {
  const at = dream.boss.spec.back;
  f.soft = false;
  f.turnAt = 0;
  f.next = sim.now + 2400;
  const key = sim.add('tockkey', { ...at, body: f.body }, { camp: f.camp, soft: false, held: true });
  key.hearts = key.max = f.hearts;
  key.more = (o) => [o.soft ? 1 : 0];
  key.next = sim.now + 6000;
  key.brain = (s, k, dt, now) => tockKeyBrain(s, k, f, dt, now);
  key.onHeart = (s, k, now) => {
    f.hearts = k.hearts;
    k.soft = false;
    f.open = null;
    f.until = now + 1500;
    f.state = 'hurt';
    f.next = now + 2000;
    f.turnAt = 0;
    s.fx('ouch', f);
  };
  key.onPop = () => dream.beaten(f);
  f.key = key;
  f.brain = tockBrain;
}

function tockBrain(sim, f, dt, now) {
  const rage = rageOf(f);
  const p = sim.aim(f);
  if (f.open) {
    f.state = 'open';
    if (now < f.openUntil) return;
    sim.shut(f);
    f.key.soft = false;
    f.next = now + 700;
  }
  if (f.state === 'hurt' && now < f.until) return;
  f.state = now - f.born < 1400 ? 'come' : f.busyTill > now ? 'act' : 'idle';
  if (p && f.state === 'idle') sim.face(f, sim.toward(f, p).way, dt, 1.2);
  if (!p || now < f.next) return;
  const step = f.turnAt++ % 3;
  const beam = { k: 'beam', windup: 1000, len: 15, sweep: Math.PI * 2, ms: 4600 - rage * 600, w: 0.36, lead: 0.12, b: 1, rest: 0 };
  if (step === 0) {
    // His hands: one, or both of them, or both and against each other.
    sim.launch(f, beam, p, now);
    if (rage >= 1) {
      const a = sim.launch(f, { ...beam, len: 10, lead: 0.5, ms: beam.ms * (rage >= 2 ? 0.8 : 1), sweep: rage >= 2 ? -Math.PI * 2 : Math.PI * 2 }, p, now);
      a.second = true;
    }
    f.busyTill = now + beam.windup + beam.ms;
    f.next = now + beam.windup + beam.ms * 0.8;
    return;
  }
  if (step === 1) {
    sim.launch(f, { k: 'lob', windup: 800, n: 2 + rage, spread: 4, ms: 1000, high: 8, r: 1.9, b: 1, far: 60, each: true, look: 'cog' }, p, now);
    sim.launch(f, { k: 'wave', windup: 1500, n: 2, gap: 720, speed: 9, reach: 24, w: 1, b: 1 }, p, now);
    f.next = now + 2900 - rage * 350;
    return;
  }
  // The hour: so many strokes of it, and then he has run right down.
  const n = 4 + rage;
  const gap = 640 - rage * 60;
  sim.launch(f, { k: 'wave', windup: 1200, n, gap, speed: 10, reach: 24, w: 1, b: 1 }, p, now);
  f.busyTill = now + 1200 + n * gap;
  f.next = now + 60000;
  f.downAt = f.busyTill;
  sim.fx('hour', f, { n, gap });
  f.waiting = true;
}

function tockKeyBrain(sim, k, f, dt, now) {
  k.state = now - k.born < 1400 ? 'come' : 'idle';
  if (f.waiting && now >= f.downAt) {
    f.waiting = false;
    k.soft = true;
    k.chips = sim.chipsOf(k.spec);
    const ms = 8200 - rageOf(f) * 600;
    sim.opens(f, 'spent', now, ms);
    f.soft = false;
    f.next = now + ms + 800;
    sim.fx('keybare', k);
    if (rageOf(f) >= 1) {
      for (let i = 0; i < 2; i++) {
        const q = k.body.walk(k, turn(k.h, k.up, 1 + i * 2.4), 7, 1).at(-1);
        sim.add('cogling', { ...q, body: k.body }, { camp: f.camp, helper: true });
      }
    }
    return;
  }
  if (k.soft || f.waiting || now < k.next) return;
  // Wound up, it spins a beam of its own round the back.
  const p = sim.people.find((q) => !q.dizzy && q.body === k.body && dot(q.body.up(q.x, q.y, q.z), k.up) > 0.4);
  k.next = now + 5200 - rageOf(f) * 600;
  if (p) sim.launch(k, { k: 'beam', windup: 900, len: 11, sweep: Math.PI * 1.7, ms: 2600, w: 0.32, lead: 0.2, b: 1 }, p, now);
}

// ---------------------------------------------------------------- the Night Mare

// The Night Mare goes round and round her black moon. At first she only gallops at
// you. Then she is three, and only one of them strikes sparks: a shadow of her
// comes apart in smoke as it is turned. And at the last it goes quite dark, and
// there is nothing to be seen of her but her eyes — but for three lanterns, that
// light when someone slams down by them, and go out again; all three at once, and
// she is dazzled.
const LANTERN_MS = 15000;
const MARE_MOVES = [
  { k: 'charge', near: 3, far: 60, windup: 900, len: 24, speed: 16, w: 1.2, b: 1.6, rest: 400, every: 500, flash: true, trail: true },
  { k: 'wave', near: 3, far: 60, windup: 850, n: 2, gap: 620, speed: 9.5, reach: 30, w: 1.1, b: 1, rest: 300, every: 500 },
  // (Right up by her, and she rears and stamps.)
  { k: 'burst', near: 0, far: 3, windup: 640, r: 3.4, b: 1.2, rest: 200, every: 300 },
  { k: 'charge', near: 3, far: 60, windup: 760, len: 24, speed: 17, w: 1.2, b: 1.6, rest: 300, every: 500, flash: true, trail: true },
  { k: 'leap', near: 3, far: 18, windup: 700, ms: 800, r: 3, high: 6, b: 1.4, rest: 300, every: 500 },
  { k: 'lob', near: 2, far: 60, windup: 700, n: 3, spread: 3.6, ms: 900, high: 6, r: 1.9, b: 1, rest: 300, every: 800, each: true, look: 'dark' },
  { k: 'charge', near: 3, far: 60, windup: 700, len: 24, speed: 18, w: 1.2, b: 1.6, rest: 300, every: 500, flash: true, trail: true },
  { k: 'shot', near: 2, far: 30, windup: 700, n: 5, fan: 0.36, speed: 10, len: 30, r: 0.46, b: 0.9, rest: 300, every: 900, back: true, look: 'dark', when: from(1) },
];

function mareBegin(sim, f, dream) {
  f.lit = [0, 0, 0];
  f.phase = 0;
  f.lights = dream.boss.spec.lights;
  f.more = (o) => [0, o.dark ? 1 : 0];
  f.brain = mareBrain;
  f.onHeart = (s, o, now) => marePhase(s, o, now);
  f.onSlam = (s, o, p, now) => {
    if (o.phase < 2) return;
    o.lights.forEach((l, i) => {
      if (dist3(l, p) > 4.2 || o.lit[i] > now) return;
      o.lit[i] = now + LANTERN_MS;
      s.fx('lantern', o, { i, on: true, ms: LANTERN_MS });
    });
    mareDazzle(s, o, now);
  };
}

function marePhase(sim, f, now) {
  const gone = f.max - f.hearts;
  const phase = gone >= 6 ? 2 : gone >= 3 ? 1 : 0;
  if (phase !== f.phase) {
    f.phase = phase;
    sim.fx('phase', f, { n: phase });
    f.until = now + 1800;
    f.cool = now + 2400;
  }
  for (const o of sim.of(f.camp)) if (o.shadow) sim.vanish(o);
  if (f.phase === 1) f.splitAt = now + 1600;
  if (f.phase === 2) {
    f.lit = [0, 0, 0];
    sim.fx('lantern', f, { i: -1, on: false });
    mareDark(sim, f, true);
  }
}

// All three lanterns lit at once: she is dazzled (as soon as she can be).
function mareDazzle(sim, f, now) {
  if (f.phase !== 2 || f.open || !f.lit.every((t) => t > now) || !sim.opens(f, 'stun', now, 5200)) return;
  mareDark(sim, f, false);
  f.lit = [0, 0, 0];
}

function mareDark(sim, f, on) {
  if (f.dark === on) return;
  f.dark = on;
  sim.fx('dark', f, { on });
}

function mareBrain(sim, f, dt, now) {
  if (f.phase === 2 && !f.dark && !f.open && f.state !== 'hurt') {
    mareDark(sim, f, true);
    sim.fx('lantern', f, { i: -1, on: false });
  }
  mareDazzle(sim, f, now);
  f.lit.forEach((t, i) => {
    if (t && t <= now) {
      f.lit[i] = 0;
      sim.fx('lantern', f, { i, on: false });
    }
  });
  // Three of her.
  if (f.phase === 1 && f.splitAt && now >= f.splitAt && !f.open) {
    f.splitAt = 0;
    const p = sim.aim(f);
    const at = p ?? f;
    for (let i = 0; i < 2; i++) {
      const way = turn(flatUnit(sub(f, at), f.body.up(at.x, at.y, at.z)), f.body.up(at.x, at.y, at.z), (i ? 1 : -1) * 2.1);
      const q = f.body.walk(f.body.land(at), way, 8, 1).at(-1);
      const o = sim.add('mareshadow', { ...q, body: f.body }, { camp: f.camp, helper: true, shadow: true });
      o.more = () => [1, 0];
      o.cool = now + 1400 + i * 900;
      // (Turned, or rolled clear of, it is only smoke.)
      o.onOpens = () => sim.vanish(o);
    }
    sim.fx('split', f);
  }
  if (f.phase === 1 && !f.splitAt && now > f.cool && !sim.of(f.camp).some((o) => o.shadow)) f.splitAt = now + 7000;
  const was = f.act;
  sim.think(f, dt, now);
  // Where she has galloped, the ground smoulders and bursts behind her.
  const a = f.act ?? was;
  if (a?.mv.trail && a.path && !a.trailed && now >= a.strike) {
    a.trailed = true;
    const n = a.path.length;
    const spots = [];
    for (let i = 3; i < n - 1; i += 5) spots.push(a.path[i]);
    sim.launch(f, { k: 'spots', windup: 1500, r: 1.5, b: 0.8, where: () => spots.slice(0, 7) }, null, now);
  }
}

addFrights({
  maestro: { name: 'Maestro Crescendo', icon: '🎼', boss: true, big: true, hearts: 6, chips: 7, radius: 1.1, height: 3.4, speed: 0, style: 'stay', still: true, guard: 'all', steady: true, begin: maestroBegin, moves: [], told: 'Watch the tune, then play it back: jump the rings, bop the notes right back at him, roll clear of the crashes. Two notes back, and he drops his baton!' },
  tock: { name: 'Old Tock', icon: '🕰️', boss: true, big: true, shell: true, hearts: 5, chips: 6, radius: 1.5, height: 5.4, speed: 0, style: 'stay', still: true, guard: 'all', steady: true, begin: tockBegin, moves: [], told: 'Nothing hurts Old Tock in front. When he has struck the hour he has run right down: over the edge, quick, to the key on the other side of the dial!' },
  tockkey: { name: 'Old Tock’s key', icon: '🗝️', hearts: 5, chips: 6, radius: 1.1, height: 2.6, speed: 0, style: 'stay', still: true, guard: 'all', part: true, big: true, steady: true, moves: [], told: 'The key is spinning too fast to touch! It stops when Old Tock has struck the hour and run down.' },
  mare: { name: 'The Night Mare', icon: '🐴', boss: true, big: true, hearts: 10, chips: 5, radius: 1.35, height: 3.4, speed: 5.4, style: 'circle', range: [6, 11], guard: 'all', begin: mareBegin, moves: MARE_MOVES, told: 'Bop the Night Mare just as she flashes, or roll clear at the very last moment as she gallops by: then she is open!' },
  mareshadow: { name: 'A shadow of the Mare', icon: '🌫️', hearts: 1, chips: 3, radius: 1.35, height: 3.4, speed: 5.4, style: 'circle', range: [6, 11], guard: 'all', big: true, moves: MARE_MOVES.filter((m) => m.k === 'charge' || m.k === 'leap').map((m) => ({ ...m, b: 1, trail: false, every: 2200 })), told: 'That one strikes no sparks: it is only a shadow of her. Turn it, and it is gone!' },
});

// What each chapter's boss is called, how it looks on its bar, and what is said
// as it comes and goes, for the page (isle-story.js has the story's words).
export const NOD_BOSSES = {
  rambunctious: { name: 'Rambunctious', icon: '🐏', moves: ['Charge', 'Ring stomp', 'Wool roll'] },
  munch: { name: 'Old Munch', icon: '🐛', moves: ['Bite', 'Seed rain', 'Wriggle'] },
  maestro: { name: 'Maestro Crescendo', icon: '🎼', moves: ['Ring', 'Note', 'Crash'] },
  tock: { name: 'Old Tock', icon: '🕰️', moves: ['Hands', 'Cuckoo eggs', 'The hour'] },
  mare: { name: 'The Night Mare', icon: '🐴', moves: ['Gallop', 'Shadows', 'The dark'] },
};

export { carry, dot, OPENINGS, turn };
