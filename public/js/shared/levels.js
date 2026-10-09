// Experience and levels: everything you do earns ⭐ experience (XP), and
// enough of it takes you up a level. XP is worked out from what the game
// already counts (stickers.js STAT_KEYS) and the stickers you have, never
// kept by itself, so it comes along to every device with a login the way
// those do, and the keeper can rank it (ranking.js). Friends see your level
// on your name tag: it travels in your look (look.level, see words.js
// cleanLook).
import { STICKERS } from './stickers.js';

// XP for each one of a thing counted. cap: only this many of it earn XP,
// for what is quick to do over and over (talking, dancing), so playing is
// what takes you up, not pressing one button.
export const XP_FOR = {
  placed: { xp: 1 },
  picked: { xp: 0.5 },
  painted: { xp: 0.5 },
  hills: { xp: 2 },
  stamps: { xp: 5 },
  planted: { xp: 1 },
  sprouts: { xp: 3 },
  fruit: { xp: 2 },
  shells: { xp: 3 },
  stars: { xp: 10 },
  gems: { xp: 10 },
  diamonds: { xp: 50 },
  petted: { xp: 2, cap: 500 },
  fed: { xp: 3 },
  invited: { xp: 5 },
  perched: { xp: 5, cap: 100 },
  adopted: { xp: 20, cap: 1 },
  tricks: { xp: 2, cap: 200 },
  petpals: { xp: 5, cap: 100 },
  spouts: { xp: 5, cap: 50 },
  slides: { xp: 5, cap: 50 },
  rides: { xp: 5 },
  searides: { xp: 10 },
  drives: { xp: 5 },
  drilled: { xp: 0.2 },
  railed: { xp: 0.1 },
  lifts: { xp: 2, cap: 100 },
  bounces: { xp: 0.5, cap: 400 },
  campouts: { xp: 10 },
  freed: { xp: 50 },
  helped: { xp: 20 },
  kings: { xp: 200 },
  towers: { xp: 10 },
  defended: { xp: 200 },
  said: { xp: 1, cap: 200 },
  danced: { xp: 1, cap: 100 },
  visits: { xp: 10 },
  guests: { xp: 10 },
  swims: { xp: 3 },
  nights: { xp: 10 },
  rainbows: { xp: 10 },
  steps: { xp: 0.05 },
  popped: { xp: 5 },
};

// XP for each sticker earned, on top of what earned it.
export const STICKER_XP = 25;

export const MAX_LEVEL = 99;

// XP to go from a level to the next: a little more each time (100, 200,
// 300, ...), so the first levels come quickly and later ones mean a lot.
export const xpToNext = (level) => 100 * level;

// The XP it takes to reach a level from nothing.
export const xpForLevel = (level) => 50 * level * (level - 1);

// More than anyone does of one thing: a count above it is taken as this.
const MOST = 10_000_000;

// Your XP, from your counts and stickers (as a profile or the keeper keeps
// them). Whole numbers only, rounded down.
export function xpOf(stats, stickers) {
  let xp = 0;
  for (const [key, { xp: each, cap = MOST }] of Object.entries(XP_FOR)) {
    const n = stats?.[key];
    if (Number.isFinite(n) && n > 0) xp += Math.min(n, cap) * each;
  }
  for (const s of STICKERS) if (stickers?.[s.key]) xp += STICKER_XP;
  return Math.floor(xp);
}

// The level for an amount of XP: 1 to start with.
export function levelFor(xp) {
  // xpForLevel(l) <= xp, solved for l.
  const level = Math.floor((1 + Math.sqrt(1 + (Number.isFinite(xp) && xp > 0 ? xp : 0) / 12.5)) / 2);
  return Math.max(1, Math.min(MAX_LEVEL, level));
}

// Where you are: { xp, level, into: XP into this level, need: XP this level
// takes (0 at the top) }.
export function progressOf(stats, stickers) {
  const xp = xpOf(stats, stickers);
  const level = levelFor(xp);
  return level >= MAX_LEVEL ? { xp, level, into: 0, need: 0 } : { xp, level, into: xp - xpForLevel(level), need: xpToNext(level) };
}

// A level as the island sees it (look.level): a whole number 1 to MAX_LEVEL,
// or 0 for none.
export const cleanLevel = (n) => (Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL ? n : 0);
