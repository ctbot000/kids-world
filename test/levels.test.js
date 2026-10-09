// Experience and levels: XP from what the game counts and the stickers you
// have, with a cap on what is quick to repeat; each level a little further
// than the last; a profile saying when you go up a level; your level in the
// look the island sees, only a real one; and a ranking board for XP.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanLevel, levelFor, MAX_LEVEL, progressOf, STICKER_XP, XP_FOR, xpForLevel, xpOf, xpToNext } from '../public/js/shared/levels.js';
import { rankBoards } from '../public/js/shared/ranking.js';
import { lookWithGear } from '../public/js/shared/shop.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { cleanLook } from '../public/js/shared/words.js';

test('everything counted earns XP, except the highest you flew, and only counted things do', () => {
  for (const key of Object.keys(XP_FOR)) assert.ok(STAT_KEYS.includes(key), `${key} is counted`);
  for (const key of STAT_KEYS) if (key !== 'highest') assert.ok(XP_FOR[key]?.xp > 0, `${key} earns XP`);
  assert.equal(xpOf({ highest: 1000 }, {}), 0);
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
  assert.deepEqual(p, { xp: 150, level: 2, into: 50, need: 200 });
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
