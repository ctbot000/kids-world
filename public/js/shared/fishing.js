// Fishing from the shore: stand at the edge of a pond or the sea, facing the
// water, and tap 🎣 Fish (or press Q). Your rod comes out and its bobber
// plops onto the water a few steps in front of you, and a fish's shadow comes
// circling under it. It nibbles — the bobber twitches — but a nibble is not
// a bite: pull then and you scare it off. When it really bites, the bobber
// goes right under: tap 🎣 Strike! (or Q) quick to hook it, and the fight
// is on. Hold 🎣 Reel (or Q) to wind it in, but when it runs the line pulls
// tight: keep holding then and it snaps, let go too long and the fish swims
// off with it. The bigger the fish, the harder it fights. Land it and it
// leaps out of the water onto your line, into your basket; now and then
// what comes up is a seashell, a pearl or an old boot.
//
// This file is the game of it: where the bobber can land, when the fish
// nibble and bite, what comes up, and the fight. The island (shared/room.js)
// passes the line's news on, so friends see your line out, your fish
// fighting and coming in; the catch itself is yours, into your own basket
// (game.js), as a pearl from a clam is.
import { WATER, AIR } from './blocks.js';

// How far in front of you the bobber can land, nearest and furthest, in
// blocks from your feet; and how far below or above your feet the water can be.
export const CAST_NEAR = 2;
export const CAST_FAR = 6;
const DROP = 4;
// How long until a fish comes to the bobber and really bites, shortest and
// longest, after it lands (or after one swam off); how many nibbles it has
// first, and how long each twitch lasts; and how long the bobber stays under
// once it bites, for you to strike.
export const BITE_MS = [3000, 8000];
export const NIBBLES = [0, 3];
export const NIBBLE_MS = 380;
export const STRIKE_MS = 900;
// How far you can step from where you cast before the line comes in.
export const STAY = 0.6;

// The fight: how fast holding reels in, and how fast the fish takes line
// back when you do not (both as parts of the whole way in, a second); how
// tight the line pulls before it is in the red, and how long it holds in the
// red before it snaps; and where on the way in the fight starts.
export const FIGHT = { reel: 0.3, slack: 0.14, red: 0.85, snap: 0.35, start: 0.3 };

// What can come up on the line, and how often, out of the weights' total.
// Fish go in the basket as fish, whatever kind; `cm` is how long a kind
// grows, shortest and longest, and `fight` how hard it fights (0-1), the
// longer ones of a kind fighting harder still. The rest go in as what they
// are, or (the boot) back in the water; they come in like dead weight.
export const CATCHES = [
  { key: 'minnow', name: 'Minnow', icon: '🐟', weight: 30, cm: [5, 10], fight: 0.15, basket: 'fish' },
  { key: 'perch', name: 'Sunny Perch', icon: '🐟', weight: 22, cm: [12, 25], fight: 0.45, basket: 'fish' },
  { key: 'clownfish', name: 'Clownfish', icon: '🐠', weight: 12, cm: [7, 11], fight: 0.4, basket: 'fish' },
  { key: 'trout', name: 'Rainbow Trout', icon: '🐟', weight: 14, cm: [25, 50], fight: 0.75, basket: 'fish' },
  { key: 'puffer', name: 'Pufferfish', icon: '🐡', weight: 7, cm: [10, 30], fight: 0.65, basket: 'fish' },
  { key: 'goldfish', name: 'Golden Fish', icon: '✨', weight: 3, cm: [15, 30], fight: 0.95, basket: 'fish' },
  { key: 'shell', name: 'Seashell', icon: '🐚', weight: 6, fight: 0.05, basket: 'shell' },
  { key: 'pearl', name: 'Pearl', icon: '🦪', weight: 1, fight: 0.05, basket: 'pearl' },
  { key: 'boot', name: 'Old Boot', icon: '👢', weight: 5, fight: 0.35, still: true, basket: null },
];
export const catchByKey = (key) => CATCHES.find((c) => c.key === key) ?? null;
const TOTAL = CATCHES.reduce((n, c) => n + c.weight, 0);

// Whether cell (x, y, z) is water with open air over it: a bobber floats there.
const surface = (world, x, y, z) => world.get(x, y, z) === WATER && world.get(x, y + 1, z) === AIR;

// The water a body standing at the shore, facing `yaw`, can cast onto: the
// water cell { x, y, z } the bobber lands on, as far out as it will go, or
// null if there is none in front. A wall at head height stops the cast
// short; the line goes over a low one.
export function castSpot(world, body, yaw) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const feet = Math.floor(body.y + 0.05);
  let best = null;
  for (let d = CAST_NEAR; d <= CAST_FAR; d += 0.5) {
    const x = Math.floor(body.x + fx * d);
    const z = Math.floor(body.z + fz * d);
    if (world.get(x, feet + 1, z) !== AIR) break;
    let spot = null;
    for (let y = feet; y >= feet - DROP; y--) {
      if (world.get(x, y, z) === AIR) continue;
      if (surface(world, x, y, z)) spot = { x, y, z };
      break;
    }
    if (spot) best = spot;
    // Over dry ground past the water: the cast stays on what water there was.
    else if (best) break;
  }
  return best;
}

// Whether cell `at` is a spot a bobber floats on, for the island to check a
// cast against (within `reach` of `from`, where the caster stands).
export function canFloat(world, at, from, reach = CAST_FAR + 2) {
  if (!Array.isArray(at) || at.length !== 3 || !at.every(Number.isInteger)) return false;
  if (!surface(world, ...at)) return false;
  return Math.hypot(from[0] - at[0] - 0.5, from[2] - at[2] - 0.5) <= reach && Math.abs(from[1] - at[1]) <= DROP + 2;
}

// When the next fish nibbles and bites, from `now`, for random numbers from
// r() (0-1): { nibbles: [times], strikeAt }. The nibbles come before the bite,
// with a gap after each, so no twitch runs into the next or into the bite.
export function planBites(r, now) {
  const strikeAt = now + BITE_MS[0] + r() * (BITE_MS[1] - BITE_MS[0]);
  // Each nibble in a slot of its own, over a second long, between a moment
  // after the bobber lands and a moment before the bite: fewer of them for
  // a fish that bites soon.
  const room = strikeAt - now - 1500;
  const n = Math.min(NIBBLES[0] + Math.floor(r() * (NIBBLES[1] - NIBBLES[0] + 1)), Math.floor(room / 1100));
  const nibbles = [];
  for (let i = 0; i < n; i++) nibbles.push(Math.round(now + 1200 + (room * (i + 0.35 + r() * 0.3)) / n));
  return { nibbles, strikeAt };
}

// Where a line waiting for a bite is at `now`: 'wait', 'nibble' while the
// bobber twitches, 'strike' while it is under, or 'gone' once that fish
// swam off (and the next is to be planned).
export function lineState(line, now) {
  if (now >= line.strikeAt + STRIKE_MS) return 'gone';
  if (now >= line.strikeAt) return 'strike';
  if (line.nibbles.some((t) => now >= t && now < t + NIBBLE_MS)) return 'nibble';
  return 'wait';
}

// What comes up on the line, for two random numbers (0-1): the catch's
// entry, how long it is in whole centimetres (a fish), and how hard it
// fights (`power`, 0-1).
export function catchFor(r, r2 = 0.5) {
  let n = r * TOTAL;
  let c = CATCHES[CATCHES.length - 1];
  for (const each of CATCHES) {
    if (n < each.weight) {
      c = each;
      break;
    }
    n -= each.weight;
  }
  const length = c.cm ? Math.round(c.cm[0] + r2 * (c.cm[1] - c.cm[0])) : 0;
  return { ...c, length, power: Math.min(1, c.fight * (c.cm ? 0.85 + r2 * 0.3 : 1)) };
}

// A fight begun with a fish of `power` (0-1) on the line.
export function newFight(power, still = false) {
  return { power, still, progress: FIGHT.start, tension: 0.2, pull: 0, run: 0, rest: 0.8, strength: 0, red: 0, over: '' };
}

// The fight a step on, `dt` seconds, with the reel held or not, and random
// numbers from r(). The fish rests, pulling a little, then runs, pulling
// hard, for a while, the bigger the fish the harder, the longer and the more
// often. Holding winds it in, and pulls the line tight: hardest while it
// runs, when reeling barely gains any line at all. Letting go eases the line
// but the fish swims off with some. `over` says how it ended: 'landed',
// 'snapped' (in the red too long) or 'escaped' (all the way out again).
export function fightStep(f, dt, holding, r) {
  if (f.over) return f;
  const p = f.power;
  if (f.still) f.pull = p * 0.5;
  else if (f.run > 0) {
    f.run -= dt;
    f.pull = f.strength;
  } else {
    f.pull = p * 0.15;
    f.rest -= dt;
    if (f.rest <= 0) {
      f.run = 0.5 + r() * (0.4 + p * 1.2);
      f.strength = p * (0.75 + r() * 0.35);
      f.rest = 0.6 + r() * (2.4 - p * 1.6);
    }
  }
  const target = holding ? 0.22 + f.pull * 0.95 : f.pull * 0.35;
  f.tension += (target - f.tension) * Math.min(1, dt * 5);
  f.progress += dt * (holding ? FIGHT.reel * Math.max(-0.3, 1 - f.pull * 1.2) : -FIGHT.slack * (0.4 + f.pull));
  f.red = f.tension > FIGHT.red ? f.red + dt : Math.max(0, f.red - dt * 2);
  if (f.red > FIGHT.snap) f.over = 'snapped';
  else if (f.progress >= 1) f.over = 'landed';
  else if (f.progress <= 0) f.over = 'escaped';
  f.progress = Math.max(0, Math.min(1, f.progress));
  return f;
}
