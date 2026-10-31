// Experience and levels: XP from what the game counts and the stickers you
// have, with a cap on what is quick to repeat; each level a little further
// than the last; a profile saying when you go up a level; your level in the
// look the island sees, only a real one; and a ranking board for XP.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanLevel, levelFor, MAX_LEVEL, progressOf, STICKER_XP, XP_FOR, xpForLevel, xpOf, xpToNext } from '../public/js/shared/levels.js';
import { rankBoards } from '../public/js/shared/ranking.js';
import { lookWithGear } from '../public/js/shared/shop.js';
import { MONSTER_LOG, popKey, seenKey, STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { cleanLook } from '../public/js/shared/words.js';

test('everything counted earns XP, except the highest you flew, the monster collection and the coins earned in all, and only counted things do', () => {
  // The monster collection's counts (seen and popped, kind by kind) go over
  // what popped already earns XP for. The coins earned in all (earned) are a
  // lifetime total, not a thing done: what earned each coin already gave XP.
  const book = new Set(MONSTER_LOG.flatMap((k) => [seenKey(k), popKey(k)]));
  for (const key of Object.keys(XP_FOR)) assert.ok(STAT_KEYS.includes(key), `${key} is counted`);
  for (const key of STAT_KEYS) if (key !== 'highest' && key !== 'earned' && !book.has(key)) assert.ok(XP_FOR[key]?.xp > 0, `${key} earns XP`);
  for (const key of book) assert.equal(XP_FOR[key], undefined, key);
  assert.equal(xpOf({ highest: 1000 }, {}), 0);
  assert.equal(xpOf({ earned: 1000000 }, {}), 0);
});

test('XP adds up what you did and your stickers, rounded down, with nothing odd counted', () => {
  assert.equal(xpOf({}, {}), 0);
  assert.equal(xpOf(undefined, undefined), 0);
  assert.equal(xpOf({ placed: 10, fruit: 3, steps: 30 }, {}), 10 + 6 + 1);
  assert.equal(xpOf({ placed: -5, fruit: NaN, gems: 'lots' }, {}), 0);
  assert.equal(xpOf({}, { [STICKERS[0].key]: 1, [STICKERS[1].key]: 2, 'made-up': 3 }), 2 * STICKER_XP);
});

test('talking and dancing over and over stop earning XP after a while', () => {
  const capped = Object.entries(XP_FOR).filter(([, r]) => r.cap);
  assert.ok(capped.some(([k]) => k === 'said') && capped.some(([k]) => k === 'danced'));
  for (const [key, { xp, cap }] of capped) assert.equal(xpOf({ [key]: cap * 50 }, {}), Math.floor(cap * xp), key);
});

test('each level takes more XP than the last, from level 1 to the top', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(-10), 1);
  assert.equal(levelFor(NaN), 1);
  for (let level = 1; level < MAX_LEVEL; level++) {
    assert.equal(xpForLevel(level + 1) - xpForLevel(level), xpToNext(level));
    assert.equal(levelFor(xpForLevel(level)), level, `exactly ${level}`);
    assert.equal(levelFor(xpForLevel(level + 1) - 1), level, `just short of ${level + 1}`);
    if (level > 1) assert.ok(xpToNext(level) > xpToNext(level - 1));
  }
  assert.equal(levelFor(xpForLevel(MAX_LEVEL)), MAX_LEVEL);
  assert.equal(levelFor(1e12), MAX_LEVEL);
});

test('progress says how far into the level you are, and nothing more to go at the top', () => {
  const p = progressOf({ placed: 150 }, {});
  assert.deepEqual(p, { xp: 150, level: 2, into: 50, need: 220 });
  assert.deepEqual(progressOf({ kings: 1e6 }, {}), { xp: 2e8, level: MAX_LEVEL, into: 0, need: 0 });
});

test('a first island visit with a few things done takes a new player up a level or two, not ten', () => {
  const firstGo = { placed: 60, picked: 10, fruit: 5, shells: 2, petted: 6, steps: 800, said: 5, swims: 1 };
  const stickers = Object.fromEntries(STICKERS.filter((s) => s.test({ ...Object.fromEntries(STAT_KEYS.map((k) => [k, 0])), ...firstGo })).map((s) => [s.key, 1]));
  const { level } = progressOf(firstGo, stickers);
  assert.ok(level >= 2 && level <= 4, `level ${level}`);
});

test('your level is in the look the island sees, and only a real one', () => {
  const look = { animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' };
  assert.equal(lookWithGear(look, { weapon: 0, off: {} }, 7).level, 7);
  assert.equal(lookWithGear({ ...look, level: 9 }, { weapon: 0, off: {} }).level, undefined, 'only the one given');
  assert.equal(cleanLook({ ...look, level: 12 }).level, 12);
  for (const bad of [0, -1, 1.5, MAX_LEVEL + 1, '5', null]) assert.equal(cleanLook({ ...look, level: bad }).level, undefined, String(bad));
  assert.equal(cleanLevel(3), 3);
  assert.equal(cleanLevel(1000), 0);
});

test('a profile says when what you did takes you up a level, once, and you show your level', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    assert.equal(p.progress.level, 1);
    const ups = [];
    p.addEventListener('level', (e) => ups.push(e.detail.level));
    p.count('placed', 50);
    // 50 blocks and the First Brick sticker: 75 XP.
    assert.deepEqual(ups, []);
    assert.equal(p.progress.xp, 50 + STICKER_XP);
    p.count('placed', 25);
    assert.deepEqual(ups, [2]);
    p.count('placed', 1);
    assert.deepEqual(ups, [2], 'once');
    p.count('kings', 5);
    assert.equal(ups.length, 2);
    assert.ok(ups[1] > 3, 'a big jump says the level you got to');
    assert.equal(p.shownLook.level, p.progress.level);
  } finally {
    delete globalThis.localStorage;
  }
});

test('photos are counted, and five of them are the Photographer’s sticker', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const sticker = STICKERS.find((s) => s.key === 'photographer');
    assert.ok(sticker, 'the sticker is there');
    const p = new Profile();
    const got = [];
    p.addEventListener('sticker', (e) => got.push(e.detail.key));
    for (let i = 0; i < 4; i++) p.count('photos');
    assert.deepEqual(got, [], 'four is not five');
    assert.equal(p.data.stats.photos, 4);
    p.count('photos');
    assert.deepEqual(got, ['photographer'], 'the fifth one is');
    assert.equal(p.progress.xp, 5 * 5 + STICKER_XP, 'each photo a little XP, and the sticker its 25');
  } finally {
    delete globalThis.localStorage;
  }
});

test('the 777th monster popped is the King Bop sticker, and one already past 777 earns it on their next pop', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const got = [];
    const p = new Profile();
    p.addEventListener('sticker', (e) => got.push(e.detail.key));
    p.count('popped', 776);
    assert.deepEqual(got, ['monster-popper', 'monster-master'], 'not yet at 777');
    p.count('popped');
    assert.deepEqual(got, ['monster-popper', 'monster-master', 'king-bop'], 'the 777th one is');
    assert.equal(p.data.stats.popped, 777);
    // Someone who was popping monsters before the sticker was: with only the
    // older ones had, it comes on the next pop.
    p.data.stats.popped = 5000;
    p.data.stickers = { 'monster-popper': 1, 'monster-master': 1 };
    const late = [];
    p.addEventListener('sticker', (e) => late.push(e.detail.key));
    p.count('popped');
    assert.deepEqual(late, ['king-bop', 'monster-legend'], 'caught up on the next pop');
  } finally {
    delete globalThis.localStorage;
  }
});

test('the ranking has a board for XP', () => {
  const players = [
    { id: 'a', profile: { name: 'Ann', look: {}, stats: { placed: 10 }, stickers: {} } },
    { id: 'b', profile: { name: 'Bo', look: {}, stats: { kings: 1 }, stickers: {} } },
    { id: 'c', profile: { name: 'Cy', look: {}, stats: {}, stickers: {} } },
  ];
  const board = rankBoards(players, 'a').boards.find((b) => b.key === 'levels');
  assert.deepEqual(
    board.top.map((e) => [e.rank, e.name, e.score]),
    [
      [1, 'Bo', 200],
      [2, 'Ann', 10],
    ],
  );
  assert.deepEqual(board.you, { rank: 2, score: 10 });
});

test('harder stickers, and legendary ones after them, come only long after the easier ones, each at its own count', () => {
  const tiers = [
    ['master-builder', 'mega-builder', 'placed', 10000],
    ['painter', 'master-painter', 'painted', 500],
    ['fruit-picker', 'orchard-keeper', 'fruit', 500],
    ['gem-miner', 'treasure-hunter', 'gems', 100],
    ['diamond', 'diamond-hoard', 'diamonds', 10],
    ['animal-friend', 'animal-whisperer', 'petted', 500],
    ['explorer', 'globetrotter', 'steps', 50000],
    ['monster-popper', 'monster-master', 'popped', 500],
    ['monster-master', 'king-bop', 'popped', 777],
    ['flag-raiser', 'camp-liberator', 'freed', 50],
    ['island-hero', 'grumble-buster', 'kings', 10],
    ['star-keeper', 'fortress-guard', 'defended', 5],
    ['blob-bopper', 'blob-champion', 'blobpops', 1000],
    ['piano-star', 'concert-pianist', 'tunes', 25],
    ['sharp-memory', 'memory-master', 'pairsfound', 500],
    ['quiz-perfect', 'brainiac', 'quizperfect', 10],
    ['bumper-crop', 'harvest-champion', 'harvested', 1000],
    // and the legends, ten times further again
    ['mega-builder', 'legendary-builder', 'placed', 100000],
    ['master-painter', 'paint-legend', 'painted', 5000],
    ['orchard-keeper', 'fruit-legend', 'fruit', 5000],
    ['treasure-hunter', 'jewel-legend', 'gems', 1000],
    ['diamond-hoard', 'diamond-mountain', 'diamonds', 100],
    ['animal-whisperer', 'creature-keeper', 'petted', 5000],
    ['globetrotter', 'world-walker', 'steps', 500000],
    ['king-bop', 'monster-legend', 'popped', 5000],
    ['camp-liberator', 'freedom-legend', 'freed', 500],
    ['grumble-buster', 'king-of-kings', 'kings', 100],
    ['fortress-guard', 'unbreakable', 'defended', 50],
    ['blob-champion', 'blob-legend', 'blobpops', 10000],
    ['concert-pianist', 'maestro', 'tunes', 200],
    ['memory-master', 'perfect-recall', 'pairsfound', 5000],
    ['brainiac', 'genius', 'quizperfect', 100],
    ['harvest-champion', 'farm-tycoon', 'harvested', 10000],
  ];
  const byKey = new Map(STICKERS.map((s, i) => [s.key, { ...s, i }]));
  assert.equal(byKey.size, STICKERS.length, 'every key is its own');
  for (const [easy, hard, stat, n] of tiers) {
    const e = byKey.get(easy);
    const h = byKey.get(hard);
    assert.ok(e && h && STAT_KEYS.includes(stat), hard);
    assert.equal(h.i, e.i + 1, `${hard} sits right after ${easy}`);
    assert.ok(e.test({ [stat]: n - 1 }) && !h.test({ [stat]: n - 1 }), `${hard} not yet at ${n - 1}`);
    assert.ok(h.test({ [stat]: n }), `${hard} at ${n}`);
  }
});
