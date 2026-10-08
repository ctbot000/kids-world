// The shop: a price for everything in the basket; gear in levels, each
// dearer and faster than the last; gear kept as bought and tidied; you
// faster on foot, in the water and in the air in it (and as fast as anyone
// with it taken off); selling and buying through your profile; and coins
// and gear kept at the keeper, merged from the device that changed them
// last and added up when a guest's progress joins a login.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { makeBody, MOVE, stepBody } from '../public/js/shared/physics.js';
import { cleanCoins, cleanGear, COINS_MAX, GEAR, gearMove, nextLevel, sale, sellPrice, wearing } from '../public/js/shared/shop.js';
import { World } from '../public/js/shared/world.js';

const DT = 1 / 60;

// A meadow: magic floor, stone, and grass on top at y = 5 (so standing at 6),
// with a pond of water 3 deep along z >= 40.
function meadow(W = 120, D = 120) {
  const w = new World({ W, H: 40, D, sea: 3 });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < 5; y++) w.set(x, y, z, z >= 100 && y >= 2 ? B.WATER : B.STONE);
      if (z < 100) w.set(x, 5, z, B.GRASS);
    }
  }
  return w;
}

// How far a body goes along x in a second, from (10, y, z).
function distance(gear, { y = 6, z = 20, flying = false, run = false, up = false } = {}) {
  const w = meadow();
  const b = makeBody(10, y, z);
  b.flying = flying;
  const move = gearMove(gear, MOVE) ?? undefined;
  for (let i = 0; i < 60; i++) stepBody(w, b, { mx: up ? 0 : 1, mz: 0, run, jump: up }, DT, { move });
  return up ? b.y - y : b.x - 10;
}

test('the shop buys everything that goes in the basket, a jewel for more than a fruit', () => {
  for (const c of B.COLLECTABLES) assert.ok(sellPrice(c.key) > 0, `${c.key} has a price`);
  assert.ok(sellPrice('diamond') > sellPrice('ruby'));
  assert.ok(sellPrice('ruby') > sellPrice('star'));
  assert.ok(sellPrice('star') > sellPrice('apple'));
  assert.equal(sellPrice('nonsense'), 0);
});

test('each level of gear costs more and makes you faster than the one before', () => {
  for (const g of GEAR) {
    assert.ok(g.levels.length >= 2);
    for (let i = 1; i < g.levels.length; i++) {
      assert.ok(g.levels[i].price > g.levels[i - 1].price, `${g.levels[i].name} costs more`);
      assert.ok(g.levels[i].boost > g.levels[i - 1].boost, `${g.levels[i].name} is faster`);
    }
    assert.ok(g.levels[0].boost > 1);
  }
});

test('gear and coins are tidied: no levels that do not exist, no made-up kinds, no silly sums', () => {
  assert.deepEqual(cleanGear(null), { off: {}, shoes: 0, wings: 0 });
  assert.deepEqual(cleanGear({ shoes: 99, wings: -1, cape: 2, off: { shoes: true, cape: true, wings: 'yes' } }), { off: { shoes: true }, shoes: GEAR[0].levels.length, wings: 0 });
  assert.deepEqual(cleanGear({ shoes: 1.5 }), { off: {}, shoes: 0, wings: 0 });
  assert.equal(cleanCoins(-4), 0);
  assert.equal(cleanCoins(2.5), 0);
  assert.equal(cleanCoins('12'), 0);
  assert.equal(cleanCoins(1e9), COINS_MAX);
  assert.equal(cleanCoins(42), 42);
});

test('the next level to buy, and none past the best', () => {
  assert.equal(nextLevel({ shoes: 0 }, 'shoes').level, 1);
  assert.equal(nextLevel({ shoes: 1 }, 'shoes').name, GEAR[0].levels[1].name);
  assert.equal(nextLevel({ shoes: GEAR[0].levels.length }, 'shoes'), null);
  assert.equal(nextLevel({}, 'cape'), null);
});

test('selling needs that many in the basket, of something the shop buys', () => {
  const basket = { apple: 3, diamond: 1 };
  assert.equal(sale(basket, 'apple', 3), 3 * sellPrice('apple'));
  assert.equal(sale(basket, 'apple', 4), 0);
  assert.equal(sale(basket, 'diamond', 1), sellPrice('diamond'));
  assert.equal(sale(basket, 'apple', 0), 0);
  assert.equal(sale(basket, 'apple', 1.5), 0);
  assert.equal(sale({ cape: 5 }, 'cape', 1), 0);
});

test('running shoes take you further walking, running and swimming; flying gear in the air, up too', () => {
  const none = { shoes: 0, wings: 0, off: {} };
  const best = { shoes: GEAR[0].levels.length, wings: GEAR[1].levels.length, off: {} };
  assert.equal(gearMove(none, MOVE), null);
  const walk = distance(none);
  const fast = distance(best);
  assert.ok(walk > 3.5, `walks ${walk}`);
  assert.ok(fast > walk * 1.4, `walks ${fast} with shoes on, against ${walk}`);
  assert.ok(distance(best, { run: true }) > distance(none, { run: true }) * 1.4);
  const swim = distance(none, { y: 3.2, z: 110 });
  assert.ok(distance(best, { y: 3.2, z: 110 }) > swim * 1.4, 'swims faster');
  const fly = distance(none, { y: 15, flying: true });
  assert.ok(distance(best, { y: 15, flying: true }) > fly * 1.4, 'flies faster');
  assert.ok(distance(best, { y: 15, flying: true, up: true }) > distance(none, { y: 15, flying: true, up: true }) * 1.4, 'flies up faster');
  // Shoes alone leave flying as it is, and wings alone walking.
  assert.equal(distance({ ...none, shoes: 1 }, { y: 15, flying: true }), fly);
  assert.equal(distance({ ...none, wings: 1 }), walk);
});

test('gear taken off is not worn, and makes you as fast as anyone', () => {
  const gear = { shoes: 2, wings: 1, off: { shoes: true } };
  assert.equal(wearing(gear, 'shoes'), 0);
  assert.equal(wearing(gear, 'wings'), 1);
  assert.equal(gearMove(gear, MOVE).walk, MOVE.walk);
  assert.ok(gearMove(gear, MOVE).fly > MOVE.fly);
  assert.equal(gearMove({ shoes: 2, wings: 1, off: { shoes: true, wings: true } }, MOVE), null);
});

test('selling, buying and wearing through your profile', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    assert.equal(p.data.coins, 0);
    let told = 0;
    p.addEventListener('basket', () => told++);
    assert.equal(p.buy('shoes'), false, 'nothing bought without the coins');
    p.addToBasket('diamond', 1);
    p.addToBasket('apple', 2);
    assert.equal(p.sell('apple', 3), false, 'not more than there are');
    assert.equal(p.sell('diamond'), true);
    assert.equal(p.sell('apple', 2), true);
    assert.equal(p.basket.diamond, 0);
    assert.equal(p.basket.apple, 0);
    const coins = sellPrice('diamond') + 2 * sellPrice('apple');
    assert.equal(p.data.coins, coins);
    const before = p.data.changedAt;
    assert.equal(p.buy('shoes'), true);
    assert.equal(p.data.gear.shoes, 1);
    assert.equal(p.data.coins, coins - GEAR[0].levels[0].price);
    assert.ok(p.data.changedAt >= before);
    p.wear('shoes', false);
    assert.equal(wearing(p.data.gear, 'shoes'), 0);
    p.wear('shoes', true);
    assert.equal(wearing(p.data.gear, 'shoes'), 1);
    assert.ok(told >= 5, 'the page hears of each change');
    // Kept on this device.
    const again = new Profile();
    assert.equal(again.data.coins, p.data.coins);
    assert.equal(again.data.gear.shoes, 1);
  } finally {
    delete globalThis.localStorage;
  }
});

test('coins and gear are kept at the keeper, from the device that changed them last, and added up for a guest', () => {
  const mine = { name: 'Sunny Otter', coins: 10, gear: { shoes: 1 }, changedAt: 100 };
  const theirs = { name: 'Sunny Otter', coins: 3, gear: { shoes: 2, wings: 1, off: { wings: true } }, changedAt: 200 };
  const kept = keptProfile({ ...theirs, coins: 1e12 });
  assert.equal(kept.coins, COINS_MAX);
  assert.deepEqual(kept.gear, { off: { wings: true }, shoes: 2, wings: 1 });
  const merged = mergeProfiles(mine, theirs);
  assert.equal(merged.coins, 3);
  assert.equal(merged.gear.shoes, 2);
  assert.equal(mergeProfiles(theirs, { ...mine, changedAt: 50 }).coins, 3);
  const added = addProgress(mine, theirs);
  assert.equal(added.coins, 13);
  assert.equal(added.gear.shoes, 2);
  assert.equal(added.gear.wings, 1);
});
