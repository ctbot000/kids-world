// The shop: a price for everything in the basket; gear in levels, each
// dearer and faster than the last; gear kept as bought and tidied; you
// faster on foot, in the water and in the air in it (and as fast as anyone
// with it taken off); selling and buying through your profile; and coins
// and gear kept at the keeper, merged from the device that changed them
// last and added up when a guest's progress joins a login. Toy weapons: in
// the look the island sees, only a real one and only while worn; popping a
// blob in fewer taps and from further away at the host, King Grumble feeling
// a Star Hammer's bops twice; and drawn in the hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { makeBody, MOVE, stepBody } from '../public/js/shared/physics.js';
import { AdventureSim } from '../public/js/shared/adventure.js';
import { ARM_REACH, BLOB_HEARTS, BOP_SLACK, HIT_MS, MONSTER_BODY } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanCoins, cleanGear, COINS_MAX, fixPrice, GEAR, gearMove, SKATE_GLIDE, isBroken, lookWithGear, nextLevel, sale, sellPrice, usesLeft, WEAPONS, wearing, weaponOf, wornWeapon } from '../public/js/shared/shop.js';
import { cleanLook } from '../public/js/shared/words.js';
import { Avatar, SWINGS, swingPose } from '../public/js/render/avatar.js';
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

// How far a body goes along x in a second (or secs), from (10, y, z).
function distance(gear, { y = 6, z = 20, flying = false, run = false, up = false, secs = 1 } = {}) {
  const w = meadow();
  const b = makeBody(10, y, z);
  b.flying = flying;
  const move = gearMove(gear, MOVE) ?? undefined;
  for (let i = 0; i < 60 * secs; i++) stepBody(w, b, { mx: up ? 0 : 1, mz: 0, run, jump: up }, DT, { move });
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
  for (const g of GEAR.filter((k) => k.key !== 'weapon')) {
    assert.ok(g.levels.length >= 2);
    for (let i = 1; i < g.levels.length; i++) {
      assert.ok(g.levels[i].price > g.levels[i - 1].price, `${g.levels[i].name} costs more`);
      assert.ok(g.levels[i].boost > g.levels[i - 1].boost, `${g.levels[i].name} is faster`);
    }
    assert.ok(g.levels[0].boost > 1);
  }
});

test('gear and coins are tidied: no levels that do not exist, no made-up kinds, no silly sums', () => {
  assert.deepEqual(cleanGear(null), { off: {}, pick: { weapon: 0 }, shoes: 0, wings: 0, skates: 0, weapon: 0, clothes: [], outfit: '', wear: {}, toys: {}, tames: 0 });
  assert.deepEqual(cleanGear({ shoes: 99, wings: -1, cape: 2, off: { shoes: true, cape: true, wings: 'yes' } }), { off: { shoes: true }, pick: { weapon: 0 }, shoes: GEAR[0].levels.length, wings: 0, skates: 0, weapon: 0, clothes: [], outfit: '', wear: {}, toys: {}, tames: 0 });
  assert.deepEqual(cleanGear({ shoes: 1.5 }), { off: {}, pick: { weapon: 0 }, shoes: 0, wings: 0, skates: 0, weapon: 0, clothes: [], outfit: '', wear: {}, toys: {}, tames: 0 });
  // A chosen weapon is kept, and only one of those owned: anything else
  // falls back to the best (wornWeapon).
  assert.equal(cleanGear({ weapon: 2, pick: { weapon: 1 } }).pick.weapon, 1);
  assert.equal(cleanGear({ weapon: 2, pick: { weapon: 3 } }).pick.weapon, 0, 'not one of yours');
  assert.equal(cleanGear({ weapon: 2, pick: { weapon: 'sword' } }).pick.weapon, 0);
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
  assert.deepEqual(kept.gear, { off: { wings: true }, pick: { weapon: 0 }, shoes: 2, wings: 1, skates: 0, weapon: 0, clothes: [], outfit: '', wear: {}, toys: {}, tames: 0 });
  const merged = mergeProfiles(mine, theirs);
  assert.equal(merged.coins, 3);
  assert.equal(merged.gear.shoes, 2);
  assert.equal(mergeProfiles(theirs, { ...mine, changedAt: 50 }).coins, 3);
  const added = addProgress(mine, theirs);
  assert.equal(added.coins, 13);
  assert.equal(added.gear.shoes, 2);
  assert.equal(added.gear.wings, 1);
});

test('a toy weapon is in the look the island sees while you have it on, and only a real one', () => {
  const look = { animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' };
  assert.equal(lookWithGear(look, { weapon: 0, off: {} }).weapon, undefined);
  assert.equal(lookWithGear(look, { weapon: 3, off: {} }).weapon, 'hammer');
  assert.equal(lookWithGear(look, { weapon: 4, off: {} }).weapon, 'lavablade', 'the best there is');
  assert.equal(lookWithGear({ ...look, weapon: 'hammer' }, { weapon: 3, off: { weapon: true } }).weapon, undefined, 'taken off');
  assert.equal(wornWeapon({ weapon: 1, off: {} }).key, 'sword');
  assert.equal(wornWeapon({ weapon: 0, off: {} }), null);
  assert.equal(cleanLook({ ...look, weapon: 'blaster' }).weapon, 'blaster');
  assert.equal(cleanLook({ ...look, weapon: 'lavablade' }).weapon, 'lavablade');
  assert.equal(cleanLook({ ...look, weapon: 'cannon' }).weapon, undefined);
  for (let i = 1; i < WEAPONS.length; i++) {
    assert.ok(WEAPONS[i].power >= WEAPONS[i - 1].power && WEAPONS[i].king >= WEAPONS[i - 1].king);
    assert.ok(WEAPONS[i].power > WEAPONS[i - 1].power || WEAPONS[i].reach > WEAPONS[i - 1].reach, `${WEAPONS[i].name} does more`);
  }
  // Each reaches further than an arm, and none far: no bopping from across the meadow.
  for (const w of WEAPONS) assert.ok(w.reach > 0 && ARM_REACH + w.reach <= 5, `${w.name} reaches ${w.reach}`);
});

test('any of the weapons you own can be the one in your hand: the one you pick, or the best', () => {
  // Picked: that one, whatever the best you have.
  assert.equal(wornWeapon({ weapon: 3, pick: { weapon: 1 }, off: {} }).key, 'sword');
  assert.equal(wornWeapon({ weapon: 4, pick: { weapon: 2 }, off: {} }).key, 'blaster');
  assert.equal(lookWithGear({ animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' }, { weapon: 4, pick: { weapon: 1 }, off: {} }).weapon, 'sword');
  // No pick (or one not yours, or silly): the best you have.
  assert.equal(wornWeapon({ weapon: 3, pick: { weapon: 4 }, off: {} }).key, 'hammer');
  assert.equal(wornWeapon({ weapon: 3, pick: { weapon: 1.5 }, off: {} }).key, 'hammer');
  assert.equal(wornWeapon({ weapon: 3, pick: {}, off: {} }).key, 'hammer');
  // Taken off: none at all, picked or not.
  assert.equal(wornWeapon({ weapon: 3, pick: { weapon: 1 }, off: { weapon: true } }), null);
});

test('buying a weapon puts it in your hand, and you can carry any of yours: the shop, or N to flip through them', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    assert.equal(p.nextWeapon(), null, 'nothing to flip through');
    assert.equal(p.pickWeapon(1), null, 'nothing to pick either');
    p.earn(1000);
    for (const key of ['sword', 'blaster', 'hammer', 'lavablade']) {
      assert.equal(p.buy('weapon'), true);
      // Each new one goes straight into your hand.
      assert.equal(wornWeapon(p.data.gear).key, key);
    }
    assert.equal(p.nextWeapon().key, 'sword', 'round to the first');
    assert.equal(p.nextWeapon().key, 'blaster');
    assert.equal(p.pickWeapon(4).key, 'lavablade');
    assert.equal(p.pickWeapon(5), null, 'not one of yours');
    assert.equal(p.pickWeapon(0), null);
    assert.equal(wornWeapon(p.data.gear).key, 'lavablade', 'the pick stays');
    p.wear('weapon', false);
    assert.equal(wornWeapon(p.data.gear), null, 'off is off, picked or not');
    assert.equal(p.nextWeapon().key, 'lavablade', 'flipping puts it back on');
    // Kept on this device.
    const again = new Profile();
    assert.equal(again.data.gear.pick.weapon, 4);
    assert.equal(wornWeapon(again.data.gear).key, 'lavablade');
  } finally {
    delete globalThis.localStorage;
  }
});

// A flat meadow room with monsters on, and a player in it holding weapon.
function meadowRoom(weapon) {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  const W = 96;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.world = w;
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  const c = { inbox: [], close() {} };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Brave Otter', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'none', ...(weapon ? { weapon } : {}) } });
  const spawn = w.spawn;
  // Taps from dx blocks off until it pops (or ten taps): how many it took.
  const taps = (dx) => {
    const m = room.monsters.add(w, spawn.x + 30, 11, spawn.z);
    for (let i = 1; i <= 10; i++) {
      Object.assign(m.body, { x: spawn.x + 30, y: 11, z: spawn.z, vx: 0, vy: 0, vz: 0 });
      room.receive(c, { t: 'm', s: [spawn.x + 30 - dx, 11, spawn.z, 0, 0, 0] });
      time.t += HIT_MS;
      room.receive(c, { t: 'bop', id: m.id });
      if (!room.monsters.get(m.id)) return i;
    }
    room.monsters.remove(m.id);
    return Infinity;
  };
  return { taps };
}

test('a toy weapon pops a blob in fewer bops, and only from as far as it reaches', () => {
  // From dx blocks off (middle to middle): just inside what each reaches at
  // the host, and just past it.
  const edge = (w) => ARM_REACH + (w ? weaponOf(w).reach : 0) + BOP_SLACK + MONSTER_BODY.radius + 0.3;
  const hands = meadowRoom(null);
  assert.equal(hands.taps(2), BLOB_HEARTS);
  assert.equal(hands.taps(edge(null) - 0.1), BLOB_HEARTS);
  assert.equal(hands.taps(edge(null) + 0.1), Infinity, 'too far for an arm');
  const sword = meadowRoom('sword');
  assert.equal(sword.taps(2), 2);
  assert.equal(sword.taps(edge('sword') - 0.1), 2, 'a sword is longer than an arm');
  assert.equal(sword.taps(edge('sword') + 0.1), Infinity);
  const blaster = meadowRoom('blaster');
  assert.equal(blaster.taps(edge('blaster') - 0.1), 2, 'a bubble flies a few steps');
  assert.equal(blaster.taps(edge('blaster') + 0.1), Infinity, 'but not across the meadow');
  const hammer = meadowRoom('hammer');
  assert.equal(hammer.taps(2), 1);
  assert.equal(hammer.taps(edge('hammer') + 0.1), Infinity, 'a hammer is swung up close');
  const lavablade = meadowRoom('lavablade');
  assert.equal(lavablade.taps(2), 1, 'a Lava Blade pops in one');
  assert.equal(lavablade.taps(edge('lavablade') - 0.1), 1, 'from a step away');
  assert.equal(lavablade.taps(edge('lavablade') + 0.1), Infinity);
  assert.equal(meadowRoom('cannon').taps(2), BLOB_HEARTS, 'no made-up weapons');
});

test('King Grumble feels a Star Hammer\'s bop twice, and three times over when dazed', () => {
  const king = () => ({ shielded: false, king: { id: 9, hearts: 30, max: 30, hits: new Map() } });
  const a = king();
  assert.equal(AdventureSim.prototype.hitKing.call(a, 1, 0, false, weaponOf('hammer').king).hearts, 28);
  const b = king();
  assert.equal(AdventureSim.prototype.hitKing.call(b, 1, 0, false, weaponOf('sword').king).hearts, 29);
  const c = king();
  assert.equal(AdventureSim.prototype.hitKing.call(c, 1, 0, false, weaponOf('lavablade').king).hearts, 27, 'a Lava Blade thrice over');
  const d = king();
  assert.equal(AdventureSim.prototype.hitKing.call(d, 1, 0, true, 2).hearts, 24);
});

test('every toy weapon is drawn in the hand, and a swing moves the arm', () => {
  for (const w of WEAPONS) {
    for (const animal of ['kid', 'grownup', 'bear']) {
      const av = new Avatar({ animal, fur: 'brown', shirt: 1, hat: 'none', weapon: w.key });
      assert.ok(av.weapon, `${w.key} for ${animal}`);
      // A boolean: a failing equal() would print a diff of two whole scene graphs.
      assert.ok(av.weapon.parent === av.hands[1], `${w.key} in ${animal}'s right hand`);
      av.update(1 / 60, 0, 0);
      const rest = av.arms[1].rotation.x;
      av.swing();
      av.update(0.1, 0, 0);
      assert.ok(av.arms[1].rotation.x < rest - 1, 'raised to swing');
      av.update(1, 0, 0);
      assert.ok(Math.abs(av.arms[1].rotation.x - rest) < 0.3, 'and back');
    }
  }
  assert.equal(new Avatar({ animal: 'bear', fur: 'brown', shirt: 1, hat: 'none' }).weapon, null);
});

test('every swing starts and ends as the avatar stands, moves smoothly between, and lands when it says', () => {
  for (const [kind, swing] of Object.entries(SWINGS)) {
    // From and back to the pose it had: nothing of the swing at either end.
    for (const k of [0, 1]) {
      const p = swingPose(swing, k);
      assert.equal(p.w, 0, `${kind} at ${k}`);
      for (const key of ['twist', 'lean', 'dip', 'nod', 'step']) assert.equal(p[key], 0, `${kind} ${key} at ${k}`);
    }
    // No jumps: quick as a strike is, nothing in it moves faster than 150 radians a second, so
    // over a six-thousandth of a second nothing moves more than 0.025.
    const n = Math.ceil(swing.secs * 6000);
    let last = swingPose(swing, 0);
    for (let i = 1; i <= n; i++) {
      const p = swingPose(swing, i / n);
      for (const key of Object.keys(p)) assert.ok(Math.abs(p[key] - last[key]) <= 0.025, `${kind} ${key} jumps at ${(i / n).toFixed(3)}`);
      last = p;
    }
    // Wound up behind or out to the side, then the arm out in front at the strike.
    const strike = swingPose(swing, swing.strike);
    assert.ok(strike.fwd < -0.9 && strike.w === 1, `${kind} strikes out in front`);
    const av = new Avatar({ animal: 'kid', shirt: 1, hat: 'none', ...(kind === 'punch' ? {} : { weapon: kind }) });
    assert.ok(Math.abs(av.swing() - swing.secs * swing.strike) < 1e-9, `${kind} says when it lands`);
  }
});

test('the running shoes and flying gear you have on are in the look the island sees, and only real ones', () => {
  const look = { animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' };
  assert.deepEqual(GEAR.slice(0, 2).map((g) => g.levels.map((l) => l.key)), [['bouncy', 'zoomy', 'rocket'], ['feather', 'fairy', 'jetpack']]);
  const shown = lookWithGear(look, cleanGear({ shoes: 3, wings: 2 }));
  assert.equal(shown.shoes, 'rocket');
  assert.equal(shown.wings, 'fairy');
  const off = lookWithGear({ ...look, shoes: 'rocket', wings: 'fairy' }, cleanGear({ shoes: 3, wings: 2, off: { shoes: true, wings: true } }));
  assert.equal(off.shoes, undefined, 'taken off');
  assert.equal(off.wings, undefined, 'taken off');
  assert.equal(lookWithGear({ ...look, shoes: 'rocket' }, cleanGear({})).shoes, undefined, 'not bought');
  assert.deepEqual([cleanLook({ ...look, shoes: 'zoomy', wings: 'jetpack' }).shoes, cleanLook({ ...look, shoes: 'zoomy', wings: 'jetpack' }).wings], ['zoomy', 'jetpack']);
  assert.deepEqual([cleanLook({ ...look, shoes: 'flippers', wings: 3 }).shoes, cleanLook({ ...look, shoes: 'flippers', wings: 3 }).wings], [undefined, undefined]);
});

test('weapons wear out as they bop, break, and are fixed in the shop for less than a new one', async () => {
  // Kept tidy: only weapons you own, never more worn than broken.
  assert.deepEqual(cleanGear({ weapon: 2, wear: { sword: 5, blaster: 999, hammer: 3, lavablade: -1 } }).wear, { sword: 5, blaster: WEAPONS[1].uses });
  assert.deepEqual(cleanGear({ weapon: 1, wear: { sword: 1.5 } }).wear, {});
  for (const w of WEAPONS) {
    assert.ok(Number.isInteger(w.uses) && w.uses > 0);
    assert.equal(fixPrice({ weapon: 4 }, w), 0, 'nothing to fix on a new one');
    assert.ok(fixPrice({ weapon: 4, wear: { [w.key]: w.uses } }, w) < w.price, `fixing the ${w.name} costs less than buying it`);
  }
  // A broken pick falls back to the best not broken; all broken, a fist.
  const [sword, blaster, hammer] = WEAPONS;
  assert.equal(wornWeapon({ weapon: 3, pick: { weapon: 1 }, wear: { sword: sword.uses }, off: {} }).key, 'hammer');
  assert.equal(wornWeapon({ weapon: 3, pick: {}, wear: { hammer: hammer.uses }, off: {} }).key, 'blaster');
  assert.equal(wornWeapon({ weapon: 2, pick: {}, wear: { sword: sword.uses, blaster: blaster.uses }, off: {} }), null);
  assert.equal(lookWithGear({ animal: 'fox' }, { weapon: 1, wear: { sword: sword.uses }, off: {} }).weapon, undefined, 'friends see no broken sword');

  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    p.data.gear = cleanGear({});
    assert.equal(p.useWeapon(), null, 'a fist never wears out');
    p.earn(1000);
    p.buy('weapon');
    p.buy('weapon');
    p.pickWeapon(1);
    for (let i = 1; i < sword.uses; i++) assert.equal(p.useWeapon().left, sword.uses - i);
    assert.deepEqual(p.useWeapon(), { weapon: sword, left: 0 }, 'it breaks');
    assert.ok(isBroken(p.data.gear, sword));
    assert.equal(wornWeapon(p.data.gear).key, 'blaster', 'the next best into your hand');
    assert.equal(p.pickWeapon(1), null, 'a broken one cannot be held');
    assert.equal(p.nextWeapon(), null, 'nor flipped to');
    const coins = p.data.coins;
    assert.equal(p.fixWeapon('blaster'), false, 'nothing to fix');
    assert.equal(p.fixWeapon('hammer'), false, 'not yours');
    assert.equal(p.fixWeapon('sword'), true);
    assert.equal(p.data.coins, coins - sword.price / 2);
    assert.equal(usesLeft(p.data.gear, sword), sword.uses);
    assert.equal(p.pickWeapon(1).key, 'sword');
    // Kept on this device.
    p.useWeapon();
    assert.equal(new Profile().data.gear.wear.sword, 1);
  } finally {
    delete globalThis.localStorage;
  }
});

test('roller skates glide: faster than any shoes over the ground once going, rolling on when let go, and no help swimming', () => {
  const none = { shoes: 0, wings: 0, skates: 0, off: {} };
  const skates = GEAR[2];
  assert.equal(skates.key, 'skates');
  const best = { ...none, skates: skates.levels.length };
  const rocket = { ...none, shoes: GEAR[0].levels.length };
  assert.ok(skates.levels.at(-1).boost > GEAR[0].levels.at(-1).boost, 'the best skates beat the best shoes');
  assert.deepEqual(gearMove(best, MOVE).glide, SKATE_GLIDE);
  assert.equal(gearMove(rocket, MOVE).glide, undefined);
  // Slow to start, faster over a long way.
  assert.ok(distance(best, { secs: 0.25 }) < distance(rocket, { secs: 0.25 }), 'a push takes building up');
  assert.ok(distance(best, { secs: 5 }) > distance(rocket, { secs: 5 }) + 2, 'and then you fly along');
  // Let go, you roll on: further than on foot, and you do stop.
  const coast = (gear) => {
    const w = meadow();
    const b = makeBody(10, 6, 20);
    const move = gearMove(gear, MOVE) ?? undefined;
    for (let i = 0; i < 180; i++) stepBody(w, b, { mx: 1, mz: 0 }, DT, { move });
    const from = b.x;
    for (let i = 0; i < 300; i++) stepBody(w, b, { mx: 0, mz: 0 }, DT, { move });
    return { rolled: b.x - from, still: Math.hypot(b.vx, b.vz) };
  };
  const rolled = coast(best);
  assert.ok(rolled.rolled > 3 && rolled.still === 0, `rolls on ${rolled.rolled} and stops`);
  assert.ok(coast(rocket).rolled < 1, 'shoes stop at once');
  // In the water skates are no help, and the shoes they replaced neither.
  const swim = distance(none, { y: 3.2, z: 110 });
  assert.equal(distance(best, { y: 3.2, z: 110 }), swim);
  assert.equal(distance({ ...rocket, skates: 1 }, { y: 3.2, z: 110 }), swim, 'skates on, shoes are not');
  // Taken off, as fast as anyone.
  assert.equal(gearMove({ ...best, off: { skates: true } }, MOVE), null);
});

test('skates go on your feet in place of shoes: in the look, and put on one at a time', async () => {
  const look = { animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' };
  assert.deepEqual(GEAR[2].levels.map((l) => l.key), ['roller', 'glowy']);
  const both = lookWithGear(look, cleanGear({ shoes: 3, skates: 2 }));
  assert.equal(both.skates, 'glowy');
  assert.equal(both.shoes, undefined, 'skates win');
  assert.equal(lookWithGear(look, cleanGear({ shoes: 3, skates: 2, off: { skates: true } })).shoes, 'rocket');
  assert.equal(lookWithGear({ ...look, skates: 'roller' }, cleanGear({})).skates, undefined, 'not bought');
  assert.equal(cleanLook({ ...look, skates: 'roller' }).skates, 'roller');
  assert.equal(cleanLook({ ...look, skates: 'ice' }).skates, undefined);
  assert.equal(addProgress({ gear: { skates: 1 } }, { gear: { skates: 2 } }).gear.skates, 2);
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    p.data.coins = 1000;
    assert.equal(p.buy('shoes'), true);
    assert.equal(p.buy('skates'), true);
    assert.equal(wearing(p.data.gear, 'skates'), 1, 'new skates go straight on');
    assert.equal(wearing(p.data.gear, 'shoes'), 0, 'and the shoes come off');
    p.wear('shoes', true);
    assert.deepEqual([wearing(p.data.gear, 'shoes'), wearing(p.data.gear, 'skates')], [1, 0]);
    p.wear('skates', true);
    assert.deepEqual([wearing(p.data.gear, 'shoes'), wearing(p.data.gear, 'skates')], [0, 1]);
    p.wear('skates', false);
    assert.deepEqual([wearing(p.data.gear, 'shoes'), wearing(p.data.gear, 'skates')], [0, 0], 'taking skates off leaves you in socks');
  } finally {
    delete globalThis.localStorage;
  }
});
