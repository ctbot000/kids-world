// Fishing from the shore: stand at the edge of a pond or the sea, facing the
// water, and tap 🎣 Fish (or press Q). Your rod comes out and its bobber
// plops onto the water a few steps in front of you; after a while a fish
// bites and the bobber dips under with a splash: tap 🎣 Reel (or Q) while it
// is under to pull the fish in, into your basket. Too soon and you reel in
// nothing; too late and it lets go, and you wait for the next one. Now and
// then what comes up is a seashell, a pearl or an old boot.
//
// This file is the game of it: where the bobber can land, how long a bite
// takes and lasts, and what comes up. The island (shared/room.js) passes the
// cast and the reel on, so friends see your line out; the catch itself is
// yours, into your own basket (game.js), as a pearl from a clam is.
import { WATER, AIR } from './blocks.js';

// How far in front of you the bobber can land, nearest and furthest, in
// blocks from your feet; and how far below or above your feet the water can be.
export const CAST_NEAR = 2;
export const CAST_FAR = 6;
const DROP = 4;
// How long a fish takes to bite, shortest and longest, after the bobber
// lands (or after one got away), and how long the bobber stays under for you
// to reel it in.
export const BITE_MS = [2500, 8000];
export const BITE_FOR_MS = 1600;
// How far you can step from where you cast before the line comes in.
export const STAY = 0.6;

// What can come up on the line, and how often, out of the weights' total.
// Fish go in the basket as fish, whatever kind; `cm` is how long a kind
// grows, shortest and longest. The rest go in as what they are, or (the
// boot) back in the water.
export const CATCHES = [
  { key: 'minnow', name: 'Minnow', icon: '🐟', weight: 30, cm: [5, 10], basket: 'fish' },
  { key: 'perch', name: 'Sunny Perch', icon: '🐟', weight: 22, cm: [12, 25], basket: 'fish' },
  { key: 'trout', name: 'Rainbow Trout', icon: '🐟', weight: 16, cm: [25, 50], basket: 'fish' },
  { key: 'clownfish', name: 'Clownfish', icon: '🐠', weight: 10, cm: [7, 11], basket: 'fish' },
  { key: 'puffer', name: 'Pufferfish', icon: '🐡', weight: 7, cm: [10, 30], basket: 'fish' },
  { key: 'goldfish', name: 'Golden Fish', icon: '✨', weight: 3, cm: [15, 30], basket: 'fish' },
  { key: 'shell', name: 'Seashell', icon: '🐚', weight: 6, basket: 'shell' },
  { key: 'pearl', name: 'Pearl', icon: '🦪', weight: 1, basket: 'pearl' },
  { key: 'boot', name: 'Old Boot', icon: '👢', weight: 5, basket: null },
];
const TOTAL = CATCHES.reduce((n, c) => n + c.weight, 0);

// Whether cell (x, y, z) is water with open air over it: a bobber floats there.
const surface = (world, x, y, z) => world.get(x, y, z) === WATER && world.get(x, y + 1, z) === AIR;

// The water a body standing at the shore, facing `yaw`, can cast onto: the
// water cell { x, y, z } the bobber lands on, as far out as it will go, or
// null if there is none in front. The bobber needs a clear way out: a solid
// block in the way above the water stops the cast short.
export function castSpot(world, body, yaw) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const feet = Math.floor(body.y + 0.05);
  let best = null;
  for (let d = CAST_NEAR; d <= CAST_FAR; d += 0.5) {
    const x = Math.floor(body.x + fx * d);
    const z = Math.floor(body.z + fz * d);
    // Something standing up in front at head height or over: no further.
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

// Whether cell (x, y, z) is a spot a bobber floats on, for the island to
// check a cast against (within `reach` of where the caster stands).
export function canFloat(world, at, from, reach = CAST_FAR + 2) {
  if (!Array.isArray(at) || at.length !== 3 || !at.every(Number.isInteger)) return false;
  if (!surface(world, ...at)) return false;
  return Math.hypot(from[0] - at[0] - 0.5, from[2] - at[2] - 0.5) <= reach && Math.abs(from[1] - at[1]) <= DROP + 2;
}

// How long until a fish bites, for a random number r (0-1).
export const biteWait = (r) => BITE_MS[0] + r * (BITE_MS[1] - BITE_MS[0]);

// What comes up on the line, for two random numbers (0-1): the catch's
// entry and, for a fish, how long it is, in whole centimetres.
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
  return { ...c, length: c.cm ? Math.round(c.cm[0] + r2 * (c.cm[1] - c.cm[0])) : 0 };
}

// Where a line is at `now`: 'wait' for a bite, 'bite' while the bobber is
// under, or 'gone' once the fish let go (and the next bite is to be timed).
export function lineState(line, now) {
  if (now < line.biteAt) return 'wait';
  if (now < line.biteAt + BITE_FOR_MS) return 'bite';
  return 'gone';
}
