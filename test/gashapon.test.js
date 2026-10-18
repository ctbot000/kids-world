// Gashapon machines: furniture that turns, with a globe full of capsules,
// in the toy box's Home tab after the arcade machines and three at the back
// of the Video Arcade stamp; found beside you; a turn costing coins for a
// capsule toy, common ones most often and the Golden Dragon seldom; the
// toys kept with your gear, tidied, merged and added up like the rest of it;
// and two stickers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { addToys, cleanToys, drawToy, GASHA_PRICE, gashaponNear, isGashapon, RARITIES, TOY_MAX, TOYS, toysFound } from '../public/js/shared/gashapon.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { cleanGear } from '../public/js/shared/shop.js';
import { stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { KEPT_MAX } from '../public/js/shared/keeper.js';
import { World } from '../public/js/shared/world.js';

test('a gashapon machine is furniture that turns, a globe of capsules on a stand, in the Home tab after the arcade machines', () => {
  const d = B.BLOCKS[B.GASHAPON];
  assert.equal(d.kind, 'furniture');
  assert.equal(d.category, 'home');
  assert.ok(d.solid);
  for (let k = 0; k < 4; k++) assert.ok(isGashapon(B.GASHAPON + k), `facing ${k}`);
  assert.ok(!isGashapon(B.ARCADE_BLOB));
  assert.ok(!isGashapon(B.AIR));
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.ARCADE_PAIRS) + 1], B.GASHAPON, 'right after the arcade machines');
  const boxes = modelBoxes(B.GASHAPON);
  assert.ok(boxes.length > 20, 'a stand, a handle, a globe and capsules');
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    assert.ok(x0 >= 0 && z0 >= 0 && x1 <= 1 && z1 <= 1 && y0 >= 0 && y1 <= 1.05, 'inside its cell');
    assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
  }
  // The handle sticks out at the front (towards -z).
  assert.ok(Math.min(...boxes.map((b) => b[2])) < 0.15);
});

test('the Video Arcade stamp has three gashapon machines at the back, facing the way in', () => {
  const machines = stampByKey('video-arcade').cells.filter(([, , , id]) => isGashapon(id));
  assert.equal(machines.length, 3);
  for (const [, , dz, id] of machines) {
    assert.equal(dz, 9);
    assert.equal(B.BLOCKS[id].front, 3, 'facing -z, the way in');
  }
});

test('the machine beside you is found, and none further away', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.turnedTo(B.GASHAPON, 1));
  const near = gashaponNear(w, { x: 8.5, y: 5, z: 6.8 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z }, { x: 8, y: 5, z: 8 });
  assert.equal(gashaponNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(gashaponNear(w, { x: 8.5, y: 9, z: 7 }), null, 'up above it');
});

test('a turn draws every toy, common ones most often and the very rare one seldom', () => {
  assert.equal(TOYS.length, 12);
  assert.equal(new Set(TOYS.map((t) => t.key)).size, TOYS.length);
  assert.deepEqual(RARITIES.map((r) => r.key), ['common', 'rare', 'super']);
  assert.equal(TOYS.filter((t) => t.rare === 2).length, 1, 'one very rare toy');
  // Walking rand from 0 to 1 draws each toy as often as its weight.
  const seen = new Map();
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const r = (i + 0.5) / N;
    const { toy, shell } = drawToy(() => r);
    assert.ok(RARITIES[toy.rare].shells.includes(shell));
    seen.set(toy.key, (seen.get(toy.key) ?? 0) + 1);
  }
  assert.equal(seen.size, TOYS.length, 'every toy can come out');
  const total = TOYS.reduce((n, t) => n + RARITIES[t.rare].weight, 0);
  for (const t of TOYS) assert.ok(Math.abs(seen.get(t.key) / N - RARITIES[t.rare].weight / total) < 0.002, t.key);
  assert.ok(seen.get('dragon') < seen.get('unicorn') && seen.get('unicorn') < seen.get('dino'));
  assert.equal(drawToy(() => 0.999999).toy.key, 'dragon');
});

test('capsule toys are kept with your gear: tidied, merged from the newer device and added up for a guest', () => {
  assert.deepEqual(cleanToys({ dino: 2, dragon: 1, tutu: 3, frog: 0, robot: -1, ghost: 1.5, whale: 500 }), { dino: 2, whale: TOY_MAX, dragon: 1 });
  assert.deepEqual(cleanToys(null), {});
  assert.deepEqual(cleanGear({}).toys, {});
  assert.deepEqual(cleanGear({ toys: { frog: 3 } }).toys, { frog: 3 });
  assert.equal(toysFound({ frog: 3, dino: 1 }), 2);
  assert.deepEqual(addToys({ frog: 1 }, { frog: 2, dragon: 1 }), { frog: 3, dragon: 1 });
  assert.deepEqual(keptProfile({ gear: { toys: { ufo: 2 } } }).gear.toys, { ufo: 2 });
  const merged = mergeProfiles({ name: 'Happy Panda', gear: { toys: { ufo: 1 } }, changedAt: 1 }, { name: 'Happy Panda', gear: { toys: { dino: 4 } }, changedAt: 2 });
  assert.deepEqual(merged.gear.toys, { dino: 4 }, 'from the device that changed it last');
  assert.deepEqual(addProgress({ gear: { toys: { ufo: 1, dino: 1 } } }, { gear: { toys: { dino: 2 } } }).gear.toys, { dino: 3, ufo: 1 });
});

test('turning the handle takes the coins and puts a toy in your collection, with its stickers', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    const earned = [];
    p.addEventListener('sticker', (e) => earned.push(e.detail.key));
    assert.equal(p.turnGashapon(), null, 'no coins');
    p.earn(GASHA_PRICE * 2 + 1);
    const got = p.turnGashapon(() => 0);
    assert.equal(got.toy.key, TOYS[0].key);
    assert.equal(got.have, 1);
    assert.equal(p.data.coins, GASHA_PRICE + 1);
    assert.equal(p.turnGashapon(() => 0).have, 2, 'another of the same');
    assert.equal(p.data.coins, 1);
    assert.equal(p.turnGashapon(), null, 'not enough left');
    assert.deepEqual(p.data.gear.toys, { [TOYS[0].key]: 2 });
    assert.equal(p.data.stats.capsules, 2);
    assert.equal(p.data.stats.capsuletoys, 1);
    assert.deepEqual(earned, ['capsule-toy']);
    // Every toy: the Full Set.
    p.earn(GASHA_PRICE * 200);
    const total = TOYS.reduce((n, t) => n + RARITIES[t.rare].weight, 0);
    let at = 0;
    for (const t of TOYS) {
      const r = (at + 0.5) / total;
      p.turnGashapon(() => r);
      at += RARITIES[t.rare].weight;
    }
    assert.equal(toysFound(p.data.gear.toys), TOYS.length);
    assert.ok(earned.includes('full-set'));
    assert.deepEqual(new Profile().data.gear.toys, p.data.gear.toys, 'kept');
  } finally {
    delete globalThis.localStorage;
  }
});

test('two stickers for capsule toys, on counts the game keeps', () => {
  for (const key of ['capsules', 'capsuletoys']) assert.ok(STAT_KEYS.includes(key));
  const first = STICKERS.find((s) => s.key === 'capsule-toy');
  const full = STICKERS.find((s) => s.key === 'full-set');
  assert.ok(first.test({ capsules: 1 }) && !first.test({ capsules: 0 }));
  assert.ok(full.test({ capsuletoys: TOYS.length }) && !full.test({ capsuletoys: TOYS.length - 1 }));
  assert.ok(STICKERS.length <= KEPT_MAX && STAT_KEYS.length <= KEPT_MAX, 'within what the keeper keeps');
});
