// The souls of the soul weapons (shared/souls.js), each to be beaten alone on a
// little world of its own (duel.js, worlds/souls.js) before its weapon is anyone's:
// frights like the bosses of the dreams (bosses.js), each with the ways of the
// weapon it is the soul of. However mighty what is in your hand, it is being brave
// at the right moment that opens one; and at a third of its hearts, and two, it
// throws you off and comes on again, with more than it had before.
import { SOULS } from '../souls.js';
import { NOD_BOSSES, rageOf } from './bosses.js';
import { addFrights } from './foes.js';
import { add, flatUnit, turn } from './shape.js';

const from = (n) => (f) => rageOf(f) >= n;
const only = (n) => (f) => rageOf(f) === n;
const helpers = (f, sim) => sim.of(f.camp).filter((o) => o.helper).length;

// ---------------------------------------------------------------- how they all are

// Between one lot of hearts and the next it gathers itself: thrown off it goes
// whoever is right up by it, and it says so.
function soulBegin(sim, f) {
  f.phase = 0;
  f.later = [];
  f.brain = soulBrain;
  sim.fx('soulsays', f, { i: 0 });
  f.onHeart = (s, o, now) => {
    const n = rageOf(o);
    o.later = [];
    if (n === o.phase) return;
    o.phase = n;
    s.fx('soulsays', o, { i: n });
    o.until = now + 1500;
    o.cool = now + 2100;
    s.launch(o, { k: 'burst', windup: 900, r: 4.4, b: 0.8 }, null, now);
  };
  f.onPop = (dream) => {
    if (f.dark) dream.frights.fx('dark', null, { on: false });
  };
}

// What comes besides a move of its own (mv.also: { after, mv } each, how long after
// it is begun), as long as nothing has opened it since.
function soulBrain(sim, f, dt, now) {
  if (f.open) f.later = [];
  for (const q of f.later) {
    if (now < q.at) continue;
    q.done = true;
    const p = sim.aim(f);
    if (p) sim.launch(f, q.mv, p, now);
  }
  f.later = f.later.filter((q) => !q.done);
  f.mood?.(sim, f, now);
  sim.think(f, dt, now);
  if (!f.act || f.act === f.last) return;
  f.last = f.act;
  for (const o of f.act.mv.also ?? []) f.later.push({ at: f.act.t0 + o.after, mv: o.mv });
}

// Points on the ground round where someone is: n of them, r off, the first so far
// round.
function ringAt(f, p, n, r, round = 0) {
  const up = f.body.up(p.x, p.y, p.z);
  const way = flatUnit({ x: 0.31, y: 0.2, z: 0.93 }, up);
  return Array.from({ length: n }, (_, i) => f.body.land(add(p, turn(way, up, round + (i / n) * Math.PI * 2), r), 5));
}
const under = (sim, f, p) => (p.body === f.body ? f.body.land(p, 5) : f);

// ---------------------------------------------------------------- Astra, the Star Knight

// She comes in on you blade first, and again, and spins; lets fly stars that can be
// bopped right back; and leaps, coming down like one.
const STAR_LUNGE = { k: 'lunge', near: 0, far: 9, len: 7.5, speed: 15.5, w: 0.8, b: 1.2, rest: 120, every: 220, flash: true };
const STAR = { k: 'shot', near: 2, far: 60, windup: 760, speed: 10, len: 30, r: 0.46, b: 0.9, rest: 300, every: 900, back: true, look: 'star' };
const FALL = { k: 'leap', near: 3, far: 22, ms: 820, high: 6, r: 2.8, b: 1.3, rest: 250, every: 700, open: 'spent' };
const astra = [
  { ...STAR_LUNGE, windup: 760 },
  { ...STAR_LUNGE, windup: 540 },
  { ...STAR_LUNGE, windup: 460, when: from(1) },
  { k: 'burst', near: 0, far: 7, windup: 820, r: 3.5, b: 1.2, rest: 500, every: 900, open: 'spent', when: only(0) },
  { k: 'burst', near: 0, far: 7, windup: 720, r: 3.8, b: 1.2, rest: 150, every: 250, when: from(1) },
  { ...STAR, n: 3, fan: 0.34, seek: 0.5, when: only(0) },
  { ...STAR, n: 5, fan: 0.32, windup: 820, when: from(1) },
  { ...FALL, windup: 640, rest: 120, every: 200, open: null, when: from(2) },
  { ...FALL, windup: 560 },
  // A star of stars, drawn on the ground round you: out through a gap in it.
  {
    k: 'spots', near: 0, far: 60, windup: 1050, r: 1.55, b: 1, rest: 400, every: 900, when: from(1),
    where: (sim, f, p) => ringAt(f, under(sim, f, p), 5, 3.5, sim.rng.range(0, 6)),
    also: [{ after: 750, mv: { k: 'spots', windup: 900, r: 2, b: 1, where: (sim, f, p) => [under(sim, f, p)] } }],
  },
  { k: 'wave', near: 0, far: 60, windup: 800, n: 2, gap: 900, speed: 9, reach: 24, w: 1.1, b: 1, rest: 300, every: 700, when: from(2) },
  { k: 'call', near: 0, far: 60, windup: 700, kind: 'wispstar', n: 2, rest: 300, every: 700, when: (f, sim) => rageOf(f) >= 2 && helpers(f, sim) < 2 },
];

// ---------------------------------------------------------------- Iris, the Rainbow Serpent

// Up out of reach she goes round and round, letting fly fans of colour — bop one
// back and down she comes — swooping, and sweeping a beam of light right round.
const HUE = { k: 'shot', near: 1, far: 60, speed: 9.5, len: 32, r: 0.46, b: 0.9, rest: 250, every: 900, back: true, look: 'prism' };
const SWOOP = { k: 'lunge', near: 1, far: 16, len: 11, speed: 12.5, w: 0.9, b: 1.1, rest: 500, every: 700, flash: true, swoop: true };
const iris = [
  { ...HUE, windup: 800, n: 3, fan: 0.4 },
  { ...SWOOP, windup: 820, open: 'spent', when: only(0) },
  { k: 'wave', near: 0, far: 60, windup: 850, n: 2, gap: 900, speed: 9, reach: 26, w: 1.1, b: 1, rest: 300, every: 700 },
  { ...HUE, windup: 820, n: 5, fan: 0.32, when: from(1) },
  { k: 'beam', near: 0, far: 60, windup: 950, len: 14, sweep: 5.4, ms: 2500, w: 0.34, lead: 0.18, b: 1, rest: 300, every: 700, when: from(1) },
  { ...SWOOP, windup: 720, rest: 150, every: 220, when: from(1) },
  { ...SWOOP, windup: 640, open: 'spent', when: from(1) },
  { k: 'lob', near: 0, far: 60, windup: 750, n: 4, spread: 3.6, ms: 1000, high: 6, r: 1.6, b: 0.9, rest: 250, every: 700, each: true, look: 'prism' },
  // All seven of them at once.
  { ...HUE, windup: 900, n: 7, fan: 0.36, speed: 10, when: from(2) },
];

// ---------------------------------------------------------------- Rowan, the Wild Wolf

// He charges clean across his hill — and into his own standing stones, if you are
// in front of one — springs, bites, and howls: rings of it, and cubs of light.
const POUNCE = { k: 'leap', near: 2.5, far: 18, ms: 720, high: 3.6, r: 2.5, b: 1.2, rest: 130, every: 220 };
const rowan = [
  { k: 'charge', near: 4, far: 60, windup: 950, len: 34, speed: 15, w: 1.2, b: 1.5, rest: 700, every: 800 },
  { k: 'lunge', near: 0, far: 6, windup: 620, len: 5, speed: 14, w: 0.9, b: 1.1, rest: 250, every: 500, flash: true },
  { ...POUNCE, windup: 640 },
  { ...POUNCE, windup: 460, when: from(1) },
  { ...POUNCE, windup: 440, rest: 300, every: 700, open: 'spent' },
  { k: 'wave', near: 0, far: 60, windup: 900, n: 2, gap: 900, speed: 9, reach: 28, w: 1.1, b: 1, rest: 400, every: 800 },
  { k: 'call', near: 0, far: 60, windup: 750, kind: 'wispwild', n: 2, rest: 300, every: 800, when: (f, sim) => rageOf(f) >= 1 && helpers(f, sim) < 2 },
  { k: 'charge', near: 4, far: 60, windup: 780, len: 40, speed: 17, w: 1.2, b: 1.5, rest: 250, every: 300, when: from(1) },
  { k: 'charge', near: 4, far: 60, windup: 680, len: 40, speed: 18, w: 1.2, b: 1.5, rest: 700, every: 800, when: from(1) },
  // Thorns up out of the ground, in a ring of them: stay in the middle — and then do not.
  {
    k: 'spots', near: 0, far: 60, windup: 1000, r: 1.5, b: 1, rest: 300, every: 700, when: from(2),
    where: (sim, f, p) => ringAt(f, under(sim, f, p), 7, 3.7, sim.rng.range(0, 6)),
    also: [{ after: 900, mv: { k: 'spots', windup: 950, r: 2.3, b: 1, where: (sim, f, p) => [under(sim, f, p)] } }],
  },
  { k: 'lunge', near: 0, far: 7, windup: 480, len: 6, speed: 15, w: 0.9, b: 1.1, rest: 200, every: 350, flash: true, when: from(2) },
];

// ---------------------------------------------------------------- Carillon, the Bell Giant

// Slow, and hard as bronze: nothing trips him. But a peal rings him out, coming
// down on his rim he is stuck in the ground, and his own notes ring in his ears.
const PEAL = { k: 'wave', near: 0, far: 60, windup: 950, gap: 900, speed: 8.8, reach: 26, w: 1.1, b: 1, rest: 400, every: 900, open: 'spent' };
const NOTE = { k: 'shot', near: 1, far: 60, windup: 820, speed: 9, len: 30, r: 0.5, b: 0.9, rest: 300, every: 800, back: true, look: 'note' };
const DROP = { k: 'leap', near: 2, far: 24, windup: 850, ms: 1050, high: 8, r: 3.3, b: 1.5, rest: 300, every: 900, open: 'stuck' };
const carillon = [
  { ...PEAL, n: 3, when: only(0) },
  { ...DROP },
  { ...NOTE, n: 3, fan: 0.4 },
  { k: 'burst', near: 0, far: 5, windup: 900, r: 4, b: 1.3, rest: 400, every: 600 },
  { k: 'lob', near: 2, far: 60, windup: 800, n: 4, spread: 4, ms: 1050, high: 8, r: 1.8, b: 1, rest: 300, every: 700, each: true, look: 'note' },
  { k: 'beam', near: 0, far: 60, windup: 1000, len: 14, sweep: Math.PI * 2, ms: 3600, w: 0.36, lead: 0.14, b: 1, rest: 300, every: 700, when: from(1) },
  { ...PEAL, n: 4, gap: 860, when: from(1), also: [{ after: 1500, mv: { k: 'lob', windup: 900, n: 2, spread: 4, ms: 1000, high: 8, r: 1.7, b: 0.9, far: 60, look: 'note' } }] },
  { ...DROP, windup: 650, rest: 150, every: 250, open: null, when: from(1) },
  { ...DROP, windup: 560, when: from(1) },
  { ...NOTE, n: 5, fan: 0.3, when: from(2) },
  { ...PEAL, n: 5, gap: 840, speed: 9.4, when: from(2) },
];

// ---------------------------------------------------------------- Scrawl, the Living Doodle

// Off the page it goes and up again under you, three times running, and then it is
// stuck; draws rings and crosses round you that go off; flings paint.
const DIVE = { k: 'dive', near: 0, far: 60, r: 2.1, b: 1.2, rest: 120, every: 200 };
const PAINT = { k: 'shot', near: 1, far: 60, windup: 720, speed: 9.5, len: 30, r: 0.46, b: 0.9, rest: 250, every: 800, back: true, look: 'paint' };
const scrawl = [
  { ...DIVE, windup: 1000 },
  { ...DIVE, windup: 820 },
  { ...DIVE, windup: 820, rest: 300, every: 700, open: 'stuck' },
  { ...PAINT, n: 3, fan: 0.36, seek: 0.4 },
  {
    k: 'spots', near: 0, far: 60, windup: 1000, r: 1.6, b: 1, rest: 300, every: 800,
    where: (sim, f, p) => ringAt(f, under(sim, f, p), 6, 3.5, sim.rng.range(0, 6)),
    also: [{ after: 900, mv: { k: 'spots', windup: 950, r: 2.2, b: 1, where: (sim, f, p) => [under(sim, f, p)] } }],
  },
  { k: 'lunge', near: 0, far: 7, windup: 600, len: 6, speed: 13, w: 0.9, b: 1.1, rest: 250, every: 500, flash: true },
  { k: 'lob', near: 1, far: 60, windup: 700, n: 5, spread: 4, ms: 950, high: 6, r: 1.6, b: 0.9, rest: 250, every: 700, each: true, look: 'paint' },
  { k: 'call', near: 0, far: 60, windup: 700, kind: 'wisptoon', n: 2, rest: 300, every: 700, when: (f, sim) => rageOf(f) >= 1 && helpers(f, sim) < 2 },
  { ...DIVE, windup: 760, when: from(1) },
  // A cross of it, right through where you are.
  {
    k: 'spots', near: 0, far: 60, windup: 900, r: 1.6, b: 1, rest: 300, every: 700, when: from(1),
    where: (sim, f, p) => {
      const c = under(sim, f, p);
      const round = sim.rng.range(0, 6);
      return [c, ...ringAt(f, c, 4, 3, round), ...ringAt(f, c, 4, 6, round)];
    },
  },
  { ...PAINT, n: 5, fan: 0.3, when: from(1) },
  { ...DIVE, windup: 660, when: from(2) },
  { ...DIVE, windup: 620, rest: 300, every: 600, open: 'stuck', when: from(2) },
];

// ---------------------------------------------------------------- Nocturne, the Moon Owl

// Round she glides with never a sound, loosing crescents that bend round after you
// — bop one back, and down she comes — and swooping; and from a third of the way
// on the lights go out, now and then, till there is nothing of her but her eyes.
const CRESCENT = { k: 'shot', near: 1, far: 60, speed: 9, len: 30, r: 0.48, b: 0.9, rest: 250, every: 800, back: true, look: 'moon' };
const STOOP = { k: 'lunge', near: 1, far: 18, len: 13, speed: 14, w: 0.9, b: 1.3, rest: 500, every: 700, flash: true, swoop: true };
const nocturne = [
  { ...CRESCENT, windup: 800, n: 1, seek: 1.5 },
  { ...STOOP, windup: 800, open: 'spent', when: only(0) },
  { k: 'lob', near: 0, far: 60, windup: 750, n: 4, spread: 3.8, ms: 1000, high: 7, r: 1.6, b: 0.9, rest: 250, every: 700, each: true, look: 'star' },
  { ...CRESCENT, windup: 820, n: 3, fan: 0.5, seek: 0.8 },
  { k: 'wave', near: 0, far: 60, windup: 850, n: 2, gap: 900, speed: 9, reach: 26, w: 1.1, b: 1, rest: 300, every: 700, when: from(1) },
  { ...STOOP, windup: 680, rest: 150, every: 250, when: from(1) },
  { ...STOOP, windup: 620, rest: 150, every: 250, when: from(2) },
  { ...STOOP, windup: 600, open: 'spent', when: from(1) },
  { ...CRESCENT, windup: 800, n: 5, fan: 0.36, seek: 0.5, when: from(2) },
  {
    k: 'spots', near: 0, far: 60, windup: 950, r: 1.6, b: 1, rest: 300, every: 700, when: from(2),
    where: (sim, f, p) => ringAt(f, under(sim, f, p), 6, 3.5, sim.rng.range(0, 6)),
    also: [{ after: 850, mv: { k: 'spots', windup: 900, r: 2.1, b: 1, where: (sim, f, p) => [under(sim, f, p)] } }],
  },
];
const NIGHT_MS = 9000;
const DAY_MS = 9500;
const inTheDark = [
  { ...STOOP, windup: 760, rest: 250, every: 500, b: 1.1 },
  { ...CRESCENT, windup: 800, n: 1, seek: 1.4 },
  { ...STOOP, windup: 640, rest: 400, every: 600, b: 1.1, open: 'spent' },
];

function nocturneBegin(sim, f) {
  soulBegin(sim, f);
  f.dark = false;
  f.darkAt = 0;
  f.more = (o) => [0, o.dark ? 1 : 0];
  f.mood = (s, o, now) => {
    if (rageOf(o) < 1) return;
    o.darkAt ||= now + 2500;
    const on = !o.open && o.state !== 'hurt' && now >= o.darkAt && now < o.darkAt + NIGHT_MS;
    if (now >= o.darkAt + NIGHT_MS || (o.dark && !on)) o.darkAt = now + DAY_MS;
    if (on === o.dark) return;
    o.dark = on;
    o.moves = on ? inTheDark : null;
    s.fx('dark', o, { on });
  };
}

// ---------------------------------------------------------------- Folio, the Paper Phoenix

// Round it flies over its book, flinging pages that fold up and come at you —
// bop one right back, and down it comes — diving through the air in a blaze of
// paper, and raining ink. Pop-ups spring out of its pages round you; paper birds
// fly to its help; and at the last it writes THE END right across the page.
const PAGES = { k: 'shot', near: 1, far: 60, speed: 9.5, len: 30, r: 0.48, b: 0.9, rest: 250, every: 800, back: true, look: 'page' };
const BLAZE = { k: 'lunge', near: 1, far: 17, len: 12.5, speed: 14, w: 0.9, b: 1.2, rest: 500, every: 700, flash: true, swoop: true };
const INK = { k: 'lob', near: 0, far: 60, windup: 760, n: 4, spread: 3.8, ms: 1000, high: 7, r: 1.6, b: 0.9, rest: 250, every: 700, each: true, look: 'ink' };
const folio = [
  { ...PAGES, windup: 800, n: 3, fan: 0.38, seek: 0.4 },
  { ...BLAZE, windup: 820, open: 'spent', when: only(0) },
  { ...INK },
  // Pop-ups, springing up out of the page in a ring round you, then under you.
  {
    k: 'spots', near: 0, far: 60, windup: 1000, r: 1.6, b: 1, rest: 300, every: 700,
    where: (sim, f, p) => ringAt(f, under(sim, f, p), 6, 3.5, sim.rng.range(0, 6)),
    also: [{ after: 900, mv: { k: 'spots', windup: 950, r: 2.2, b: 1, where: (sim, f, p) => [under(sim, f, p)] } }],
  },
  { k: 'wave', near: 0, far: 60, windup: 850, n: 2, gap: 900, speed: 9, reach: 26, w: 1.1, b: 1, rest: 300, every: 700, when: from(1) },
  { ...BLAZE, windup: 680, rest: 150, every: 250, when: from(1) },
  { ...BLAZE, windup: 620, open: 'spent', when: from(1) },
  { ...PAGES, windup: 820, n: 5, fan: 0.34, seek: 0.5, when: from(1) },
  { k: 'call', near: 0, far: 60, windup: 700, kind: 'wispbook', n: 2, rest: 300, every: 700, when: (f, sim) => rageOf(f) >= 1 && helpers(f, sim) < 2 },
  { ...INK, n: 6, spread: 4.4, windup: 700, when: from(2) },
  // THE END, written right across the page: a line of it through where you are,
  // and another across that.
  {
    k: 'spots', near: 0, far: 60, windup: 950, r: 1.5, b: 1.1, rest: 300, every: 700, when: from(2),
    where: (sim, f, p) => {
      const c = under(sim, f, p);
      const round = sim.rng.range(0, 6);
      return [c, ...ringAt(f, c, 2, 2.6, round), ...ringAt(f, c, 2, 5.2, round)];
    },
    also: [{ after: 800, mv: { k: 'spots', windup: 900, r: 1.5, b: 1.1, where: (sim, f, p) => {
      const c = under(sim, f, p);
      const round = sim.rng.range(0, 6);
      return [c, ...ringAt(f, c, 2, 2.6, round), ...ringAt(f, c, 2, 5.2, round)];
    } } }],
  },
];

// ---------------------------------------------------------------- all of them

const big = { boss: true, big: true, guard: 'all', hearts: 8, chips: 5, lax: 1.15, begin: soulBegin };
const wisp = (name, icon) => ({
  name,
  icon,
  hearts: 1,
  radius: 0.36,
  height: 0.75,
  speed: 4.2,
  style: 'circle',
  range: [2.2, 4.2],
  guard: 'none',
  hops: true,
  moves: [{ k: 'lunge', near: 0.6, far: 4.6, windup: 460, len: 4.2, speed: 10, w: 0.4, b: 0.5, rest: 800, every: 1500, flash: true }],
  told: `${name}: one bop, and it is gone!`,
});

export const SOUL_FOES = {
  soulstar: { ...big, radius: 0.95, height: 3.3, speed: 5, style: 'circle', range: [4.5, 8], moves: astra, told: 'Astra comes blade first: bop just as she flashes, or roll clear at the very last moment. After her spin, and after she leaps, she is spent!' },
  soulrainbow: { ...big, hearts: 7, lax: 1.6, radius: 0.95, height: 1.9, speed: 5.4, style: 'fly', alt: 2.7, range: [6, 10], moves: iris, told: 'Iris keeps up out of reach: bop her colours right back at her, and down she comes — or catch her as she swoops!' },
  soulwild: { ...big, hearts: 9, radius: 1.2, height: 2.6, speed: 5.2, style: 'come', range: [5, 10], bonk: true, moves: rowan, told: 'Stand in front of a standing stone and roll aside as Rowan charges: BONK! Or bop him as he flashes, and when he has sprung twice he is out of breath.' },
  soulbells: { ...big, chips: 6, radius: 1.45, height: 3.9, speed: 1.9, style: 'come', range: [3, 7], steady: true, moves: carillon, told: 'Jump every ring of Carillon’s peal: then he is rung right out. He sticks fast when he drops, too — and cannot bear his own notes bopped back at him!' },
  soultoon: { ...big, radius: 1.05, height: 2.9, speed: 3.6, style: 'circle', range: [4, 8], moves: scrawl, told: 'Roll clear as Scrawl comes up under you, three times running: then it is stuck fast! Its paint can be bopped right back, too.' },
  soulnod: { ...big, hearts: 9, radius: 1.1, height: 2.5, speed: 5.2, style: 'fly', alt: 3, range: [6, 10], begin: nocturneBegin, moves: nocturne, told: 'Nocturne’s crescents bend round after you: bop one back, and down she comes! In the dark, watch for her eyes, and bop as they flash.' },
  soulbook: { ...big, hearts: 9, radius: 1.1, height: 2.4, speed: 5.4, style: 'fly', alt: 2.9, range: [6, 10], moves: folio, told: 'Folio’s pages can be bopped right back at it: then down it comes! Roll clear as it dives in a blaze of paper, and after its second dive it is out of puff.' },
  wispstar: wisp('A falling star', '⭐'),
  wispwild: wisp('A wild cub', '🐺'),
  wisptoon: wisp('A blot', '🎨'),
  wispbook: wisp('A paper bird', '🕊️'),
};
for (const w of SOULS) Object.assign(SOUL_FOES[`soul${w.key}`], { name: w.soul.name, icon: w.icon });
addFrights(SOUL_FOES);

Object.assign(NOD_BOSSES, {
  soulstar: { name: 'Astra', icon: '🌠', moves: ['Star lunge', 'Star fan', 'Falling star'] },
  soulrainbow: { name: 'Iris', icon: '🌈', moves: ['Seven colours', 'Swoop', 'Beam of light'] },
  soulwild: { name: 'Rowan', icon: '🪓', moves: ['Charge', 'Pounce', 'Howl'] },
  soulbells: { name: 'Carillon', icon: '🔔', moves: ['Peal', 'Drop', 'Clapper'] },
  soultoon: { name: 'Scrawl', icon: '🖌️', moves: ['Off the page', 'Scribble', 'Paint'] },
  soulnod: { name: 'Nocturne', icon: '🌙', moves: ['Crescents', 'Swoop', 'The dark'] },
  soulbook: { name: 'Folio', icon: '✒️', moves: ['Flying pages', 'Paper blaze', 'THE END'] },
});
