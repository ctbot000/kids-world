// The frights of the Land of Nod: who it is full of, and how each fights. They
// are not monsters that come at you till you have bopped them often enough. In
// a dream it is not how strong the weapon in your hand is that counts, it is
// being brave at the right moment: nearly every one of them guards itself, and
// a blow on its guard only clangs. Each has a way in —
//
// - roll at the very last moment, as its blow lands: it trips over itself;
// - bop it just as it flashes, or bop what it threw at you: back it goes;
// - come down on it out of the air (a slam), if it is the sort that tips over;
// - and a trick of its own: a ram that charges into something solid sits dizzy,
//   an alarm clock is worn out once it has rung, and so on;
//
// and then, and only then, it is open: for a moment every bop counts. An
// opening takes one heart at most — CHIPS bops of a fist, and hardly fewer of
// the mightiest weapon there is (mightOf) — and its guard is up again. So a
// fight is as long as the openings it takes, whoever is fighting.
//
// Every blow of theirs is told before it lands (an act: attacks.js has the
// shape of each), and it is each page that judges whether it hit its own
// player, from what they saw (nod/fight.js): what you dodged, you dodged.
import { Rng } from '../rng.js';
import { add, carry, cross, dist3, dot, flat, flatUnit, len, mul, sub, turn, unit } from './shape.js';
import { laneAt, lanePath, MOVES } from './attacks.js';

// Bops of a bare hand a heart takes, once open; and how much one of each
// weapon's counts (by its power, shop.js): a little more, never many times.
export const CHIPS = 3;
export const mightOf = (power) => (power >= 12 ? 2 : power >= 5 ? 1.75 : power >= 3 ? 1.5 : power >= 2 ? 1.25 : 1);
// One player's bops on one fright count no oftener than this.
export const BOP_MS = 240;
// What opens one (OPENINGS: for how long), and how it looks while it is.
export const OPENINGS = { trip: 2200, parry: 2500, bonk: 3400, flip: 3200, fall: 3200, spent: 1900, stuck: 2200, stun: 2800 };
// How far round its back a blow has to come from to get past a guard that is
// only in front (the cosine of it).
const BEHIND = -0.35;
// How many frights may be winding up or striking at one person at once, and
// how long after one starts before another may
// (more of them, and sooner, the later the dream).
const AT_ONCE = [2, 2, 2, 3, 3];
const AFTER_MS = [440, 400, 360, 300, 260];
// A fright notices whoever is on its body, or this near.
const NOTICE = 16;
// Aiming at where someone is off to: no faster than this, no further ahead.
const LEAD_FAST = 5.5;
const LEAD_MOST = 6;

// Each kind: its hearts, size, how it gets about (speed; style: 'circle' round
// whoever it is after, keeping to its range; 'come' right up; 'stay'; 'fly',
// with alt, how high), its guard ('none': every bop is a heart's; 'all'; or
// 'front': only there, and only while it is not resting), what tips it over
// (slam), whether it bonks into things (bonk), and its moves (attacks.js MOVES),
// in the turn it makes them: near and far, how far off whoever it is after has
// to be; windup, how long it shows before; rest, how long after; every, how long
// to the next; open, an opening it leaves after it by itself.
export const FRIGHTS = {
  // ------- Pillow Moons
  // Dust Bunnies: little grey puffs with ears, in crowds, one bop each.
  bunny: {
    name: 'Dust Bunny', icon: '🐇', hearts: 1, radius: 0.36, height: 0.7, speed: 3.6, style: 'circle', range: [2.4, 4.2], guard: 'none', hops: true,
    moves: [{ k: 'lunge', near: 0.6, far: 4.2, windup: 480, len: 3.8, speed: 9.5, w: 0.4, b: 0.6, rest: 900, every: 1700, flash: true }],
    told: 'One bop and a Dust Bunny goes pop — but mind the rest of them!',
  },
  // A Grumble Ram: all wool in front. It charges; let it run into something.
  ram: {
    name: 'Grumble Ram', icon: '🐏', hearts: 2, radius: 0.75, height: 1.35, speed: 2.4, style: 'come', range: [5, 9], guard: 'front', bonk: true,
    moves: [
      { k: 'charge', near: 3, far: 13, windup: 850, len: 13, speed: 13, w: 0.8, b: 1.5, rest: 500, every: 1500, open: 'spent' },
      { k: 'lunge', near: 0, far: 2.6, windup: 620, len: 2.4, speed: 8, w: 0.75, b: 1, rest: 700, every: 1600, flash: true },
    ],
    told: 'A Grumble Ram is all wool in front: roll out of the way as it charges so it bumps into something, or bop it just as it flashes!',
  },
  // A Thimble Knight, steel all round but for his feet, with a needle.
  thimble: {
    name: 'Thimble Knight', icon: '🪡', hearts: 2, radius: 0.6, height: 1.15, speed: 2.5, style: 'circle', range: [1.9, 2.8], guard: 'all', slam: 'flip',
    moves: [
      { k: 'lunge', near: 0, far: 3.4, windup: 640, len: 3, speed: 11, w: 0.4, b: 1, rest: 600, every: 1500, flash: true },
      { k: 'lunge', near: 0, far: 3.4, windup: 420, len: 3, speed: 11, w: 0.4, b: 1, rest: 700, every: 1800, flash: true },
      { k: 'burst', near: 0, far: 3.2, windup: 900, r: 2.5, b: 1, rest: 500, every: 1500, open: 'spent' },
    ],
    told: 'Bops clang off a Thimble Knight: jump and slam down beside it to tip it over, or bop its needle back as it flashes!',
  },
  // A Night Moth, up out of reach, spitting balls of dust.
  moth: {
    name: 'Night Moth', icon: '🦋', hearts: 2, radius: 0.5, height: 0.9, speed: 3.4, style: 'fly', alt: 3, range: [5.5, 8], guard: 'all', falls: true,
    moves: [
      { k: 'shot', near: 2, far: 14, windup: 700, n: 1, seek: 1, speed: 7.5, len: 18, r: 0.42, b: 0.8, rest: 300, every: 2100, back: true },
      { k: 'shot', near: 2, far: 14, windup: 800, n: 3, fan: 0.42, speed: 7, len: 18, r: 0.42, b: 0.8, rest: 400, every: 2600, back: true },
      { k: 'lunge', near: 1, far: 9.5, windup: 800, len: 9, speed: 10, w: 0.6, b: 1, rest: 500, every: 2000, flash: true, swoop: true, open: 'spent' },
    ],
    told: 'A Night Moth keeps out of reach: bop its dust balls right back at it, and down it comes!',
  },
  // An Alarm Clock on two stout legs: rings, and its ring rolls right round the
  // moon; worn out for a moment after.
  alarm: {
    name: 'Alarm Clock', icon: '⏰', hearts: 3, radius: 0.8, height: 1.6, speed: 1.7, style: 'come', range: [3, 6], guard: 'all',
    moves: [
      { k: 'wave', near: 0, far: 30, windup: 900, n: 1, speed: 7.5, reach: 30, w: 1, b: 1, rest: 400, every: 2600, open: 'spent' },
      { k: 'wave', near: 0, far: 30, windup: 900, n: 2, gap: 750, speed: 7.5, reach: 30, w: 1, b: 1, rest: 400, every: 3000, open: 'spent' },
    ],
    told: 'Jump over an Alarm Clock’s rings as they roll by — once it has rung itself out, bop it!',
  },

  // ------- Pumpkin Skies
  // Aphids: fat little green hoppers, in crowds, one bop each.
  aphid: {
    name: 'Aphid', icon: '🟢', hearts: 1, radius: 0.36, height: 0.65, speed: 4, style: 'circle', range: [2.2, 4], guard: 'none', hops: true,
    moves: [{ k: 'lunge', near: 0.6, far: 4.4, windup: 440, len: 4, speed: 10, w: 0.4, b: 0.6, rest: 800, every: 1500, flash: true }],
    told: 'One bop and an Aphid goes pop — but they hop from every side!',
  },
  // Weevil Knights: shiny beetles in armour that tuck themselves up and roll.
  weevil: {
    name: 'Weevil Knight', icon: '🪲', hearts: 2, radius: 0.75, height: 1.1, speed: 2.6, style: 'come', range: [4, 8], guard: 'all', slam: 'flip', bonk: true,
    moves: [
      { k: 'charge', near: 2.5, far: 13, windup: 800, len: 12, speed: 12, w: 0.8, b: 1.2, rest: 500, every: 1500, look: 'roll', open: 'spent' },
      { k: 'lunge', near: 0, far: 3, windup: 560, len: 2.8, speed: 10, w: 0.6, b: 1, rest: 600, every: 1300, flash: true },
    ],
    told: 'Bops clang off a Weevil Knight’s shell: slam down beside it to flip it on its back, or get out of its way as it rolls!',
  },
  // Snapdragons: rooted to the spot, spitting seeds.
  spitter: {
    name: 'Snapdragon', icon: '🌺', hearts: 2, radius: 0.7, height: 1.9, speed: 0, style: 'stay', still: true, guard: 'all', slam: 'stun',
    moves: [
      { k: 'shot', near: 0, far: 18, windup: 700, n: 1, seek: 1, speed: 8.5, len: 20, r: 0.42, b: 0.8, rest: 300, every: 1500, back: true, look: 'seed' },
      { k: 'lob', near: 0, far: 20, windup: 700, n: 3, spread: 3.4, ms: 1000, high: 6, r: 1.6, b: 0.8, rest: 400, every: 1700, look: 'seed' },
      { k: 'shot', near: 0, far: 18, windup: 800, n: 3, fan: 0.35, speed: 8, len: 20, r: 0.42, b: 0.8, rest: 400, every: 1800, back: true, look: 'seed' },
    ],
    told: 'A Snapdragon’s seeds can be bopped right back at it — or slam down beside its roots to stun it!',
  },
  // Snaptraps: under the ground, and up with a snap under your feet.
  snaptrap: {
    name: 'Snaptrap', icon: '🪴', hearts: 2, radius: 0.8, height: 1.5, speed: 4, style: 'come', range: [0, 3], guard: 'all', burrows: true,
    moves: [{ k: 'dive', near: 0, far: 9, windup: 1000, r: 1.7, b: 1.2, rest: 200, every: 1100, open: 'stuck' }],
    told: 'When the ground goes red under you, roll clear: up comes a Snaptrap, SNAP — and there it is stuck for a moment. Bop it!',
  },
  // Grasshoppers: three great leaps, and then a breather.
  hopper: {
    name: 'Grump-hopper', icon: '🦗', hearts: 2, radius: 0.62, height: 1.25, speed: 3, style: 'circle', range: [3.5, 7], guard: 'all',
    moves: [
      { k: 'leap', near: 0, far: 11, windup: 620, ms: 700, high: 4, r: 2, b: 1, rest: 120, every: 250 },
      { k: 'leap', near: 0, far: 11, windup: 420, ms: 700, high: 4, r: 2, b: 1, rest: 120, every: 250 },
      { k: 'leap', near: 0, far: 11, windup: 420, ms: 750, high: 5, r: 2.3, b: 1, rest: 200, every: 1900, open: 'spent' },
    ],
    told: 'A Grump-hopper comes down three times running: keep moving! After the third it has to catch its breath.',
  },

  // ------- The Music Box
  // Quavers: notes with wings that swoop at you off the beat.
  quaver: {
    name: 'Quaver', icon: '🎵', hearts: 1, radius: 0.42, height: 0.9, speed: 4, style: 'fly', alt: 2.6, range: [4.5, 7], guard: 'none', falls: true,
    moves: [
      { k: 'lunge', near: 1, far: 9, windup: 620, len: 9, speed: 11, w: 0.5, b: 0.8, rest: 700, every: 1500, flash: true, swoop: true },
      { k: 'shot', near: 2, far: 12, windup: 600, n: 1, seek: 1, speed: 8.5, len: 18, r: 0.4, b: 0.6, rest: 300, every: 1800, back: true, look: 'note' },
    ],
    told: 'Quavers swoop down at you: bop them as they come — or bop their notes right back!',
  },
  // Drummers: big drums on legs, beating rings out over the ground.
  drummer: {
    name: 'Thumper', icon: '🥁', hearts: 2, radius: 0.9, height: 1.5, speed: 2, style: 'come', range: [4, 7], guard: 'all', slam: 'stun',
    moves: [
      { k: 'wave', near: 0, far: 30, windup: 700, n: 2, gap: 520, speed: 8.5, reach: 26, w: 1, b: 1, rest: 300, every: 1600 },
      { k: 'wave', near: 0, far: 30, windup: 700, n: 4, gap: 470, speed: 8.5, reach: 26, w: 1, b: 1, rest: 300, every: 2200, open: 'spent' },
    ],
    told: 'Jump over every ring a Thumper beats out: two, then four — and after the fourth it is worn out. Or slam right down on it!',
  },
  // Metronomes: tick, tock, a beam swept right round.
  metronome: {
    name: 'Metronome', icon: '⏳', hearts: 2, radius: 0.75, height: 2.1, speed: 0, style: 'stay', still: true, guard: 'all',
    moves: [
      { k: 'beam', near: 0, far: 24, windup: 900, len: 11, sweep: 5.6, ms: 2700, w: 0.3, lead: 0.2, b: 1, rest: 300, every: 1200, open: 'spent' },
      { k: 'beam', near: 0, far: 24, windup: 800, len: 11, sweep: 5.6, ms: 2100, w: 0.3, lead: 0.2, b: 1, rest: 300, every: 1500, open: 'spent' },
    ],
    told: 'A Metronome sweeps its beam right round it: jump over it as it comes, and run in — it has to be wound up again after every swing!',
  },
  // Castanets: clams that snap open to spit a fan of notes.
  clam: {
    name: 'Castanet', icon: '🪭', hearts: 2, radius: 0.8, height: 0.9, speed: 3, style: 'circle', range: [4, 7.5], guard: 'all', slam: 'flip',
    moves: [
      { k: 'shot', near: 2, far: 14, windup: 700, n: 3, fan: 0.4, speed: 8, len: 18, r: 0.4, b: 0.7, rest: 200, every: 1600, back: true, look: 'note', open: 'stuck' },
      { k: 'lunge', near: 0, far: 3.2, windup: 520, len: 3, speed: 10, w: 0.6, b: 1, rest: 500, every: 1200, flash: true },
    ],
    told: 'A Castanet is shut tight till it spits its notes. Then it is wide open for a moment — or slam it over!',
  },

  // ------- Tick-Tock Skies
  // Wind-up knights: tin in front, a key in the back.
  windup: {
    name: 'Wind-up Knight', icon: '🗝️', hearts: 2, radius: 0.62, height: 1.45, speed: 2.8, style: 'come', range: [1.8, 3], guard: 'front',
    moves: [
      { k: 'lunge', near: 0, far: 3.8, windup: 560, len: 3.2, speed: 11, w: 0.5, b: 1, rest: 250, every: 450, flash: true },
      { k: 'lunge', near: 0, far: 4.4, windup: 380, len: 3.4, speed: 12, w: 0.5, b: 1, rest: 250, every: 450, flash: true },
      { k: 'burst', near: 0, far: 3.6, windup: 750, r: 2.4, b: 1.2, rest: 1500, every: 1700, open: 'spent' },
    ],
    told: 'A Wind-up Knight is all shield in front. Cut, cut, spin — and then it has run right down. Or bop it back as it flashes!',
  },
  // Cuckoos: out of reach, laying clockwork eggs on you.
  cuckoo: {
    name: 'Bomb Cuckoo', icon: '🐦', hearts: 1, radius: 0.5, height: 0.95, speed: 4.4, style: 'fly', alt: 3.4, range: [3.5, 6.5], guard: 'all', falls: true,
    moves: [
      { k: 'lob', near: 0, far: 14, windup: 620, n: 2, spread: 2.6, ms: 850, high: 2.5, r: 1.7, b: 0.9, rest: 200, every: 1400, look: 'cog' },
      { k: 'shot', near: 2, far: 13, windup: 700, n: 1, seek: 1, speed: 9, len: 18, r: 0.42, b: 0.8, rest: 300, every: 1600, back: true, look: 'cog' },
      { k: 'lunge', near: 1, far: 9, windup: 700, len: 9, speed: 11, w: 0.55, b: 1, rest: 500, every: 1800, flash: true, swoop: true, open: 'spent' },
    ],
    told: 'A Bomb Cuckoo keeps out of reach: get out from under its eggs, and bop its cogs right back at it!',
  },
  // Coglings: little brass wheels that bowl along.
  cogling: {
    name: 'Cogling', icon: '⚙️', hearts: 1, radius: 0.38, height: 0.8, speed: 4.4, style: 'circle', range: [3, 5.5], guard: 'none',
    moves: [{ k: 'charge', near: 1, far: 8, windup: 520, len: 8, speed: 12, w: 0.4, b: 0.7, rest: 700, every: 1500 }],
    told: 'Coglings bowl along in a straight line: step aside, and bop them as they wobble to a stop!',
  },
  // Jacks in their boxes.
  jack: {
    name: 'Grumpy Jack', icon: '🃏', hearts: 2, radius: 0.72, height: 1.2, speed: 2.2, style: 'come', range: [4, 6.5], guard: 'all', hops: true,
    moves: [
      { k: 'out', near: 1, far: 9, windup: 850, len: 8.5, w: 0.5, b: 1.2, rest: 200, every: 1400, open: 'stuck' },
      { k: 'out', near: 1, far: 9, windup: 550, len: 8.5, w: 0.5, b: 1.2, rest: 200, every: 1500, open: 'stuck' },
    ],
    told: 'Round goes the handle… and OUT he pops! Step aside — and while he dangles there, bop him.',
  },

  // ------- The Dark Side
  // Inklings: drips of the dark.
  inkling: {
    name: 'Inkling', icon: '🫧', hearts: 1, radius: 0.36, height: 0.7, speed: 4.4, style: 'circle', range: [2, 4], guard: 'none', hops: true,
    moves: [{ k: 'lunge', near: 0.6, far: 4.8, windup: 400, len: 4.4, speed: 11, w: 0.4, b: 0.6, rest: 700, every: 1300, flash: true }],
    told: 'One bop and an Inkling is a splash — but the dark is full of them!',
  },
  // Your own shadow, with a mind of its own: as quick as you are.
  twin: {
    name: 'Shadow Twin', icon: '👤', hearts: 3, radius: 0.42, height: 1.6, speed: 5, style: 'circle', range: [2.4, 3.6], guard: 'all',
    moves: [
      { k: 'lunge', near: 0, far: 4.6, windup: 520, len: 4, speed: 13, w: 0.45, b: 1, rest: 150, every: 350, flash: true },
      { k: 'lunge', near: 0, far: 4.6, windup: 360, len: 4, speed: 13, w: 0.45, b: 1, rest: 150, every: 350, flash: true },
      { k: 'burst', near: 0, far: 4, windup: 620, r: 2.6, b: 1.2, rest: 500, every: 1500, open: 'spent' },
      { k: 'leap', near: 3, far: 10, windup: 520, ms: 620, high: 3, r: 2, b: 1, rest: 200, every: 900, open: 'spent' },
    ],
    told: 'A Shadow Twin knows all your tricks: bop it just as it flashes, or roll out of the way at the very last moment!',
  },
  // What is under the bed.
  grabber: {
    name: 'Under-bed Grabber', icon: '🖐️', hearts: 2, radius: 0.8, height: 1.7, speed: 4.4, style: 'come', range: [0, 3], guard: 'all', burrows: true,
    moves: [
      { k: 'dive', near: 0, far: 10, windup: 900, r: 1.8, b: 1.3, rest: 100, every: 500 },
      { k: 'dive', near: 0, far: 10, windup: 750, r: 1.8, b: 1.3, rest: 100, every: 900, open: 'stuck' },
    ],
    told: 'An Under-bed Grabber reaches up twice: roll clear, and roll clear again — and then it has got hold of nothing, and is stuck.',
  },
  // A searching eye on a stalk, its beam sweeping the dark.
  watcher: {
    name: 'Night Watcher', icon: '👁️', hearts: 2, radius: 0.8, height: 2.2, speed: 0, style: 'stay', still: true, guard: 'all',
    moves: [
      { k: 'beam', near: 0, far: 26, windup: 800, len: 13, sweep: 5.8, ms: 2300, w: 0.32, lead: 0.2, b: 1.1, rest: 200, every: 900, look: 'dark' },
      { k: 'shot', near: 0, far: 20, windup: 700, n: 3, fan: 0.35, seek: 0.6, speed: 9, len: 22, r: 0.44, b: 0.9, rest: 300, every: 1000, back: true, look: 'dark' },
      { k: 'beam', near: 0, far: 26, windup: 700, len: 13, sweep: 11.4, ms: 3600, w: 0.32, lead: 0.2, b: 1.1, rest: 300, every: 1500, look: 'dark', open: 'spent' },
    ],
    told: 'Jump over a Night Watcher’s beam as it comes round, bop its darts back — and after it has gone round twice, its eye waters: run in!',
  },
  // Night moths of the Dark Side.
  nightmoth: {
    name: 'Gloom Moth', icon: '🦇', hearts: 2, radius: 0.52, height: 0.95, speed: 4, style: 'fly', alt: 3.1, range: [5, 8], guard: 'all', falls: true,
    moves: [
      { k: 'shot', near: 2, far: 15, windup: 620, n: 3, fan: 0.35, seek: 0.6, speed: 8.5, len: 20, r: 0.42, b: 0.8, rest: 250, every: 1500, back: true, look: 'dark' },
      { k: 'lunge', near: 1, far: 10, windup: 650, len: 10, speed: 12, w: 0.6, b: 1, rest: 400, every: 1500, flash: true, swoop: true, open: 'spent' },
      { k: 'lob', near: 0, far: 14, windup: 620, n: 3, spread: 3, ms: 850, high: 3, r: 1.7, b: 0.9, rest: 250, every: 1500, look: 'dark' },
    ],
    told: 'A Gloom Moth’s darts can be bopped right back at it — and it swoops, too!',
  },
};

export const FRIGHT_KINDS = Object.keys(FRIGHTS);
export const FRIGHT_STATES = ['idle', 'walk', 'wind', 'act', 'rest', 'open', 'hurt', 'under', 'fly', 'taunt', 'come', 'held'];

export const frightOf = (kind) => FRIGHTS[kind] ?? FRIGHTS.bunny;

// Adds kinds of one's own (the bosses': bosses.js).
export function addFrights(kinds) {
  for (const [k, v] of Object.entries(kinds)) {
    if (FRIGHTS[k]) continue;
    FRIGHTS[k] = v;
    FRIGHT_KINDS.push(k);
  }
}

export class Frights {
  constructor(space, { level = 14, seed = 1 } = {}) {
    this.space = space;
    this.level = level;
    this.rng = new Rng(seed);
    this.list = [];
    this.nextId = 1;
    this.nextAct = 1;
    // What is to be told of since last asked: acts starting (take('acts')),
    // and everything else there is to see ('fx').
    this.out = { acts: [], fx: [], gone: [] };
    // The acts of late, by their ids, for what pages say of them.
    this.acts = new Map();
    // When someone was last struck at, by their id.
    this.struckAt = new Map();
    // How many there are to fight.
    this.players = 1;
    // Which way each of them is going, and how well it is reckoned with: little
    // in the first dream, all the way by the fourth.
    this.going = new Map();
    this.leads = Math.max(0.4, Math.min(1, 0.4 + (level - 14) * 0.2));
  }

  take(what) {
    const list = this.out[what];
    this.out[what] = [];
    return list;
  }

  fx(k, f, more = {}) {
    this.out.fx.push({ k, ...(f ? { f: f.id } : {}), ...more });
  }

  get(id) {
    return this.list.find((f) => f.id === id) ?? null;
  }

  of(camp) {
    return this.list.filter((f) => f.camp === camp);
  }

  // Quicker to strike the later the dream (windups a little shorter, and the
  // next sooner).
  get haste() {
    return Math.max(0.7, 1 - (this.level - 14) * 0.06);
  }

  // One comes out at a spot of a body, for a camp (what it is part of).
  add(kind, spot, { camp = '', hearts = null, ...more } = {}) {
    const spec = frightOf(kind);
    const up = spot.body.up(spot.x, spot.y, spot.z);
    const n = hearts ?? spec.hearts;
    const f = {
      id: this.nextId++,
      kind,
      spec,
      body: spot.body,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      up,
      h: flatUnit(spot.dir ?? { x: this.rng.range(-1, 1), y: this.rng.range(-1, 1), z: this.rng.range(-1, 1) }, up),
      alt: spec.alt ? spec.alt + 2 : 0,
      state: 'come',
      until: 0,
      born: 0,
      hearts: n,
      max: n,
      chips: this.chipsOf(spec),
      open: null,
      openUntil: 0,
      target: 0,
      act: null,
      cool: 0,
      turnOf: 0,
      side: this.rng.chance(0.5) ? 1 : -1,
      swap: 0,
      camp,
      hits: new Map(),
      home: { x: spot.x, y: spot.y, z: spot.z },
      ...more,
    };
    this.list.push(f);
    return f;
  }

  // (A heart of a big one takes more, the more there are to bop it.)
  chipsOf(spec) {
    return (spec.chips ?? CHIPS) + (spec.big ? (this.players - 1) * 2 : 0);
  }

  remove(f) {
    const i = this.list.indexOf(f);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear(camp) {
    for (const f of this.of(camp)) {
      this.remove(f);
      this.out.gone.push(f.id);
    }
  }

  // One gone in a puff of smoke.
  vanish(f) {
    this.remove(f);
    this.out.gone.push(f.id);
  }

  // Moves them all on. people: who there is, { id, x, y, z, body, dizzy, safe }.
  step(dt, now, people) {
    this.now = now;
    this.people = people;
    this.players = Math.max(1, people.length);
    this.watch(dt, people);
    for (const [id, a] of this.acts) if (now > a.ends + 4000) this.acts.delete(id);
    for (const f of [...this.list]) {
      if (!this.list.includes(f)) continue;
      f.born ||= now;
      if (f.brain) f.brain(this, f, dt, now);
      else this.think(f, dt, now);
    }
    this.apart(dt);
  }

  // Which way everyone is going, and how fast (as it has gone these last moments).
  watch(dt, people) {
    const was = this.going;
    this.going = new Map();
    for (const p of people) {
      const o = was.get(p.id);
      if (!o || !(dt > 0)) {
        this.going.set(p.id, { x: p.x, y: p.y, z: p.z, v: { x: 0, y: 0, z: 0 } });
        continue;
      }
      let v = mul(sub(p, o), 1 / dt);
      // (Flung by a spring, or in a roll, says nothing of where they are off to.)
      const l = len(v);
      if (l > LEAD_FAST) v = mul(v, LEAD_FAST / l);
      const k = Math.min(1, dt * 5);
      this.going.set(p.id, { x: p.x, y: p.y, z: p.z, v: add(mul(o.v, 1 - k), v, k) });
    }
  }

  // Where to aim at someone what lands in ms: now where they are, now where they
  // will be if they go on as they are going. Walking round and round is no way
  // out of it, then; minding what is coming is.
  lead(p, ms, body = p.body) {
    const v = this.going.get(p.id)?.v;
    const roll = this.rng.next();
    const k = (roll < 0.3 ? 0 : roll < 0.6 ? 0.6 : 1) * this.leads;
    if (!v || !k || len(v) < 0.6) return p;
    const d = mul(v, (ms / 1000) * k);
    const l = len(d);
    const q = body.land(add(p, l > LEAD_MOST ? mul(d, LEAD_MOST / l) : d), 5);
    return { ...p, x: q.x, y: q.y, z: q.z };
  }

  // How long a move takes to get to someone, so far off (null: it is not aimed).
  static lands(mv, windup, far) {
    if (mv.k === 'lunge' || mv.k === 'charge') return windup + (Math.min(far, mv.len) / mv.speed) * 1000;
    if (mv.k === 'shot') return windup + (Math.min(far, mv.len) / mv.speed) * 1000;
    if (mv.k === 'leap') return windup + (mv.ms ?? 750);
    if (mv.k === 'dive') return windup;
    return null;
  }

  // Whoever a fright is after: the nearest on its body (or near it) that can be
  // gone for, the same as before unless another is a good deal nearer.
  aim(f) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.people) {
      if (p.dizzy) continue;
      const d = dist3(p, f);
      if (p.body !== f.body && d > NOTICE) continue;
      const w = d - (p.id === f.target ? 3 : 0);
      if (w < bestD) {
        bestD = w;
        best = p;
      }
    }
    f.target = best?.id ?? 0;
    return best;
  }

  // Which way along the ground from a fright a point is, and how far round it
  // (on a ball, as far as it is to walk; on the rest, near enough).
  toward(f, p) {
    const d = sub(p, f);
    const away = len(d);
    const up = f.body.up(p.x, p.y, p.z);
    return { way: flatUnit(d, f.up), far: away * (1 + 0.285 * (1 - dot(f.up, up))), away };
  }

  // Along its ground the way dir is, at speed: kept on it, and out of whatever
  // stands there. Whether something was in the way.
  go(f, dir, speed, dt, face = true) {
    const r = f.spec.radius;
    const from = { x: f.x, y: f.y, z: f.z };
    let q = f.body.land(add(f, dir, speed * dt), 4);
    let up = f.body.up(q.x, q.y, q.z);
    let bumped = false;
    if (!f.spec.alt) {
      const c = add(q, up, Math.min(0.6, r));
      const d = f.body.clutter(c.x, c.y, c.z);
      if (d < r) {
        bumped = true;
        const e = 0.1;
        const n = flatUnit(
          {
            x: f.body.clutter(c.x + e, c.y, c.z) - d,
            y: f.body.clutter(c.x, c.y + e, c.z) - d,
            z: f.body.clutter(c.x, c.y, c.z + e) - d,
          },
          up,
        );
        q = f.body.land(add(q, n, Math.min(r - d, 0.6)), 4);
        up = f.body.up(q.x, q.y, q.z);
      }
    }
    f.h = flatUnit(carry(f.h, f.up, up), up);
    f.up = up;
    f.x = q.x;
    f.y = q.y;
    f.z = q.z;
    if (face && speed > 0.05) this.face(f, flatUnit(sub(q, from), up), dt, 12);
    return bumped;
  }

  // Turns to face a way, at rate.
  face(f, way, dt, rate = 8) {
    const c = Math.max(-1, Math.min(1, dot(f.h, way)));
    const a = Math.acos(c);
    if (a < 1e-3) return;
    const side = dot(cross(f.h, way), f.up) >= 0 ? 1 : -1;
    f.h = flatUnit(turn(f.h, f.up, side * Math.min(a, rate * dt)), f.up);
  }

  // Frights keep out of each other.
  apart(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i];
        const b = L[j];
        if (a.body !== b.body || a.held || b.held || a.spec.still || b.spec.still) continue;
        const need = a.spec.radius + b.spec.radius;
        const d = sub(a, b);
        const l = len(d);
        if (l >= need || l < 1e-4) continue;
        if (Math.abs((a.alt ?? 0) - (b.alt ?? 0)) > 1.2) continue;
        const k = ((need - l) / l) * 0.5 * Math.min(1, dt * 8);
        const A = a.spec.big ? 0 : b.spec.big ? 2 : 1;
        if (A && !a.act) Object.assign(a, a.body.land(add(a, d, k * A), 3));
        if (2 - A && !b.act) Object.assign(b, b.body.land(add(b, d, -k * (2 - A)), 3));
      }
    }
  }

  // One's own mind, a step of it: what it is busy with, or where to go, or which
  // of its moves to make.
  think(f, dt, now) {
    const { spec } = f;
    const p = this.aim(f);
    if (spec.alt) this.fly(f, dt);
    // Coming out: a moment while it shows itself.
    if (f.state === 'come') {
      if (now - f.born > 900) f.state = 'idle';
      return;
    }
    if (f.open) {
      if (now < f.openUntil) {
        f.state = 'open';
        return;
      }
      this.shut(f);
    }
    if (f.state === 'hurt' && now < f.until) return;
    if (f.act) {
      this.runAct(f, dt, now);
      return;
    }
    if (f.state === 'rest' && now < f.until) {
      if (p) this.face(f, this.toward(f, p).way, dt, 1.2);
      return;
    }
    // (One that burrows is under the ground whenever it is not up to something.)
    f.under = Boolean(spec.burrows);
    if (!p) {
      this.idle(f, dt, now);
      if (f.under) f.state = 'under';
      return;
    }
    const t = this.toward(f, p);
    if (now >= f.cool && this.mayStrike(p, now)) {
      const mv = this.pick(f, t);
      if (mv) {
        this.start(f, mv, p, t, now);
        return;
      }
    }
    this.roam(f, p, t, dt, now);
    if (f.under) f.state = 'under';
  }

  // With nobody about: a little wander round where it came out.
  idle(f, dt, now) {
    const { spec } = f;
    if (spec.style === 'stay' || spec.still) {
      f.state = 'idle';
      return;
    }
    if (now > f.swap) {
      f.swap = now + this.rng.range(1500, 4000);
      f.wander = this.rng.chance(0.4) ? null : unit({ x: this.rng.range(-1, 1), y: this.rng.range(-1, 1), z: this.rng.range(-1, 1) });
      if (dist3(f, f.home) > 7) f.wander = sub(f.home, f);
    }
    if (!f.wander) {
      f.state = 'idle';
      return;
    }
    f.state = 'walk';
    this.go(f, flatUnit(f.wander, f.up), spec.speed * 0.45, dt);
  }

  // After someone: up to its range, or round them at it, biding its time.
  roam(f, p, t, dt, now) {
    const { spec } = f;
    if (spec.style === 'stay' || spec.still) {
      f.state = 'idle';
      this.face(f, t.way, dt, 5);
      return;
    }
    const [lo, hi] = spec.range;
    if (now > f.swap) {
      f.swap = now + this.rng.range(1400, 3200);
      if (this.rng.chance(0.45)) f.side = -f.side;
    }
    const round = mul(cross(f.up, t.way), f.side);
    let dir;
    let speed = spec.speed;
    if (t.far > hi) dir = spec.style === 'circle' ? add(t.way, round, 0.35) : t.way;
    else if (t.far < lo) {
      dir = add(mul(t.way, -1), round, 0.7);
      speed *= 0.8;
    } else {
      dir = round;
      speed *= spec.style === 'come' ? 0.45 : 0.7;
    }
    f.state = 'walk';
    const bumped = this.go(f, flatUnit(dir, f.up), speed, dt, false);
    if (bumped) f.side = -f.side;
    this.face(f, t.way, dt, 6);
  }

  fly(f, dt) {
    const want = f.open ? 0 : f.act?.swoop ? 0.5 : f.spec.alt;
    const rate = f.open ? 9 : 5;
    f.alt += Math.max(-rate * dt, Math.min(rate * dt, want - f.alt));
  }

  // Whether another fright may strike at someone just now.
  mayStrike(p, now) {
    const l = Math.max(0, Math.min(4, this.level - 14));
    if (now - (this.struckAt.get(p.id) ?? -Infinity) < AFTER_MS[l]) return false;
    let n = 0;
    for (const f of this.list) if (f.act && f.act.at === p.id && !f.act.over && now < f.act.ends) n++;
    return n < AT_ONCE[l] + (this.players > 2 ? 1 : 0);
  }

  // The next of one's moves it can make, from how far off whoever it is after is.
  pick(f, t) {
    const moves = f.moves ?? f.spec.moves;
    for (let i = 0; i < moves.length; i++) {
      const k = (f.turnOf + i) % moves.length;
      const mv = moves[k];
      if (t.far < (mv.near ?? 0) || t.far > mv.far) continue;
      if (mv.when && !mv.when(f, this)) continue;
      f.turnOf = k + 1;
      return mv;
    }
    return null;
  }

  // Starts a move at someone: told now, and struck once it is wound up.
  start(f, mv, p, t, now) {
    const windup = Math.round(mv.windup * (mv.flash ? Math.max(0.82, this.haste) : this.haste));
    const act = { id: this.nextAct++, f: f.id, k: mv.k, mv, at: p?.id ?? 0, t0: now, strike: now + windup, windup, b: mv.b, over: false };
    const ms = p && !mv.back180 ? Frights.lands(mv, windup, t.far) : null;
    const q = ms && p.body === f.body ? this.lead(p, ms) : p;
    MOVES[mv.k].start(this, f, act, q, q === p ? t : this.toward(f, q));
    act.ends ??= act.strike + (act.ms ?? 0);
    f.act = act;
    f.state = 'wind';
    if (act.dir) f.h = flatUnit(act.dir, f.up);
    this.acts.set(act.id, act);
    if (p) this.struckAt.set(p.id, now);
    this.out.acts.push(this.told(f, act));
    return act;
  }

  // A blow of one's let go besides whatever else it is doing: several at once.
  launch(f, mv, p, now = this.now) {
    const t = p ? this.toward(f, p) : { way: f.h, far: 5, away: 5 };
    const act = { id: this.nextAct++, f: f.id, k: mv.k, mv, at: p?.id ?? 0, t0: now, strike: now + mv.windup, windup: mv.windup, b: mv.b, over: false };
    const h = f.h;
    const ms = p ? Frights.lands(mv, mv.windup, t.far) : null;
    const q = ms && p.body === f.body ? this.lead(p, ms) : p;
    MOVES[mv.k].start(this, f, act, q ?? { x: f.x, y: f.y, z: f.z }, q === p ? t : this.toward(f, q));
    f.h = h;
    act.ends ??= act.strike + (act.ms ?? 0);
    this.acts.set(act.id, act);
    this.out.acts.push(this.told(f, act));
    return act;
  }

  // An act, as pages are told of it.
  told(f, a) {
    const r2 = (v) => Math.round(v * 100) / 100;
    const at = (q) => [r2(q.x), r2(q.y), r2(q.z)];
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return {
      a: a.id,
      f: f.id,
      k: a.k,
      ms: a.windup,
      b: a.b,
      ...(a.p ? { p: at(a.p) } : {}),
      ...(a.dir ? { q: [r3(a.dir.x), r3(a.dir.y), r3(a.dir.z)] } : {}),
      ...(a.to ? { to: a.to.map(at) } : {}),
      ...(a.len ? { l: r2(a.len) } : {}),
      ...(a.mv.w ? { w: a.mv.w } : {}),
      ...(a.mv.r ? { r: a.mv.r } : {}),
      ...(a.mv.speed ? { s: a.mv.speed } : {}),
      ...(a.mv.reach ? { m: a.mv.reach } : {}),
      ...(a.n > 1 ? { n: a.n, g: a.mv.gap ?? 0 } : {}),
      ...(a.sweep ? { y: r3(a.sweep) } : {}),
      ...(a.ms ? { d: Math.round(a.ms) } : {}),
      ...(a.high ? { h: r2(a.high) } : {}),
      ...(a.mv.flash ? { flash: 1 } : {}),
      ...(a.mv.back ? { back: 1 } : {}),
      ...(a.mv.seek ? { u: a.mv.seek } : {}),
      ...(a.mv.swoop ? { swoop: 1 } : {}),
      ...(a.mv.look ? { look: a.mv.look } : {}),
      ...(a.at ? { at: a.at } : {}),
    };
  }

  // A move under way.
  runAct(f, dt, now) {
    const act = f.act;
    if (now < act.strike) {
      f.state = 'wind';
      MOVES[act.k].wind?.(this, f, act, dt, now);
      return;
    }
    f.state = 'act';
    MOVES[act.k].run?.(this, f, act, dt, now);
    if (f.act !== act) return;
    if (now >= act.ends) this.endAct(f, now);
  }

  // Over: it rests, and then the next in a while; some leave themselves open.
  endAct(f, now = this.now) {
    const act = f.act;
    if (!act) return;
    f.act = null;
    act.over = true;
    const mv = act.mv;
    f.cool = now + (mv.rest ?? 600) + (mv.every ?? 1500) * this.haste * this.rng.range(0.85, 1.2);
    if (mv.open) {
      this.opens(f, mv.open, now);
      return;
    }
    f.state = 'rest';
    f.until = now + (mv.rest ?? 600);
  }

  // Open: for a moment, every bop counts. how: one of OPENINGS.
  opens(f, how, now = this.now, ms = OPENINGS[how]) {
    f.under = false;
    if (f.spec.guard === 'none' && !f.spec.falls) {
      // (One with no guard is only put off its stride.)
      f.act = null;
      f.state = 'hurt';
      f.until = now + 700;
      return false;
    }
    if (f.immune && now < f.immune) return false;
    if (f.act) f.act.over = true;
    f.act = null;
    if (f.onOpens) {
      f.onOpens(how);
      return true;
    }
    f.open = how;
    f.state = 'open';
    f.openUntil = now + ms;
    f.chips = this.chipsOf(f.spec);
    this.fx('open', f, { how, ms: Math.round(ms) });
    return true;
  }

  // Its guard up again.
  shut(f) {
    f.open = null;
    f.openUntil = 0;
    f.state = 'idle';
    f.chips = this.chipsOf(f.spec);
    f.cool = Math.max(f.cool, this.now + 500);
    f.immune = this.now + 400;
  }

  // Whether a blow from a point gets past its guard.
  bare(f, from) {
    if (f.soft !== undefined) return f.soft;
    if (f.open) return true;
    const { guard } = f.spec;
    if (guard === 'none') return true;
    if (guard === 'front' && f.state === 'rest') return dot(f.h, flatUnit(sub(from, f), f.up)) < BEHIND;
    return false;
  }

  // A bop on one, by player pid standing at from: might, what it counts for
  // (mightOf). { wait } (too soon after their last), { clang } (its guard), or
  // { hearts, broke (a heart came off), pop }.
  hit(f, pid, from, now, might = 1) {
    if (now - (f.hits.get(pid) ?? -Infinity) < BOP_MS) return { wait: true };
    f.hits.set(pid, now);
    if (f.state === 'under' || f.state === 'come') return { wait: true };
    if (f.hold?.(f, now)) return { clang: true };
    if (!this.bare(f, from)) {
      f.onClang?.(this, f, pid, now);
      return { clang: true };
    }
    const soft = f.spec.guard === 'none';
    f.chips -= soft ? CHIPS : might;
    f.onHurt?.(this, f, might);
    if (f.chips > 0.01) {
      // Nudged by it.
      if (!f.spec.big && !f.spec.still) this.nudge(f, from, 0.25);
      return { hearts: f.hearts, left: f.chips };
    }
    f.hearts--;
    f.chips = this.chipsOf(f.spec);
    if (f.hearts <= 0) return { hearts: 0, pop: true };
    if (!f.spec.big && !f.spec.still) this.nudge(f, from, 1.1);
    if (f.act) f.act.over = true;
    f.act = null;
    f.open = null;
    f.state = 'hurt';
    f.until = now + (f.spec.big ? 1200 : 650);
    f.cool = now + 900;
    f.immune = now + 900;
    f.onHeart?.(this, f, now);
    return { hearts: f.hearts, broke: true };
  }

  nudge(f, from, d) {
    const way = flatUnit(sub(f, from), f.up);
    const q = f.body.land(add(f, way, d), 4);
    const c = f.body.clutter(q.x, q.y, q.z);
    if (c < f.spec.radius * 0.6) return;
    f.up = f.body.up(q.x, q.y, q.z);
    f.x = q.x;
    f.y = q.y;
    f.z = q.z;
    f.h = flatUnit(f.h, f.up);
  }

  // Someone rolled out of the very jaws of an act of one: it trips.
  dodged(act, now) {
    const f = this.get(act.f);
    if (!f || f.act !== act || act.tripped || f.open || !['lunge', 'charge', 'leap', 'burst', 'out'].includes(act.k)) return false;
    act.tripped = true;
    if (f.spec.steady) return false;
    return this.opens(f, 'trip', now);
  }

  // Someone bopped one just as it flashed: its own blow turned on it.
  parried(act, now) {
    const f = this.get(act.f);
    if (!f || act.over || act.tripped || !act.mv.flash) return false;
    act.tripped = true;
    return this.opens(f, 'parry', now);
  }

  // Someone bopped what one threw: back it goes, and gets it.
  returned(act, now) {
    const f = this.get(act.f);
    if (!f || !act.mv.back || f.open) return false;
    if (f.onReturned) return f.onReturned(this, f, now);
    return this.opens(f, f.spec.alt ? 'fall' : 'stun', now);
  }

  // Someone came down out of the air beside some of them, at p: those that tip
  // over do, the rest with no guard are bopped. Who it got. (up: which way is up
  // at p; not those on the other side of something thin.)
  slam(p, now, r = 2.7, up = null) {
    const out = [];
    for (const f of this.list) {
      const gap = dist3(p, f) - f.spec.radius;
      if (gap > r || (f.alt ?? 0) > 1.6 || f.state === 'under' || (up && dot(up, f.up) < -0.4)) continue;
      if (f.spec.slam && !f.open) {
        if (this.opens(f, f.spec.slam, now)) out.push({ f, flip: true });
      } else out.push({ f, flip: false });
    }
    return out;
  }

  // One packed for the wire: [id, kind, x, y, z, the way it faces, state, hearts,
  // of how many, how it is open (0: not), how high].
  pack() {
    const c = (v) => Math.round(v * 100);
    const hows = Object.keys(OPENINGS);
    return this.list.map((f) => [f.id, FRIGHT_KINDS.indexOf(f.kind), c(f.x), c(f.y), c(f.z), c(f.h.x), c(f.h.y), c(f.h.z), FRIGHT_STATES.indexOf(f.state), f.hearts, f.max, f.open ? hows.indexOf(f.open) + 1 : 0, c(f.alt ?? 0), ...(f.more ? f.more(f) : [])]);
  }
}

export function readFright(row) {
  if (!Array.isArray(row) || row.length < 13 || !row.every(Number.isFinite)) return null;
  const hows = Object.keys(OPENINGS);
  return {
    id: row[0],
    kind: FRIGHT_KINDS[row[1]] ?? 'bunny',
    x: row[2] / 100,
    y: row[3] / 100,
    z: row[4] / 100,
    h: { x: row[5] / 100, y: row[6] / 100, z: row[7] / 100 },
    state: FRIGHT_STATES[row[8]] ?? 'idle',
    hearts: row[9],
    max: Math.max(1, row[10]),
    open: hows[row[11] - 1] ?? null,
    alt: row[12] / 100,
    more: row.slice(13),
  };
}

export { laneAt, lanePath };
