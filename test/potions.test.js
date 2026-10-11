// HP potions (shop.js): for sale at the shop, one and five at a time, and
// kept with your coins and gear — here, at the keeper, and added up when a
// guest's progress joins a login. Drinking one brings all your HP back at
// once (the island's half of it: room.js), even sitting dizzy on an adventure
// island, where that gets you up on your own instead of waiting for a friend.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { DIZZY_MS } from '../public/js/shared/adventure.js';
import { BUMP_HP, maxHp } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanPotions, POTION } from '../public/js/shared/shop.js';
import { World } from '../public/js/shared/world.js';

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name = 'Happy Panda', { look = { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } } = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look });
  return c;
}

// A flat meadow: grass at y 10 everywhere, with the start in the middle.
function meadow(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

function meadowRoom(settings = { monsters: true }) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, settings });
  room.world = meadow();
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  return { room, time };
}

test('potions are tidied like a basket full: whole numbers, none silly', () => {
  assert.equal(cleanPotions(0), 0);
  assert.equal(cleanPotions(3), 3);
  assert.equal(cleanPotions(-2), 0);
  assert.equal(cleanPotions(1.5), 0);
  assert.equal(cleanPotions('4'), 0);
  assert.equal(cleanPotions(null), 0);
  assert.equal(cleanPotions(1e6), 999);
});

test('buying and drinking potions through your profile', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    assert.equal(p.data.potions, 0);
    assert.equal(p.drinkPotion(), false, 'nothing to drink yet');
    assert.equal(p.buyPotion(), false, 'nothing bought without the coins');
    p.earn(POTION.price);
    assert.equal(p.buyPotion(), true);
    assert.deepEqual([p.data.potions, p.data.coins], [1, 0]);
    p.earn(POTION.price * 7);
    assert.equal(p.buyPotion(5), true);
    assert.equal(p.buyPotion(5), false, 'not without the coins for five');
    assert.deepEqual([p.data.potions, p.data.coins], [6, 2 * POTION.price]);
    assert.equal(p.drinkPotion(), true);
    assert.equal(p.data.potions, 5);
    // Kept on this device.
    const again = new Profile();
    assert.equal(again.data.potions, 5);
  } finally {
    delete globalThis.localStorage;
  }
});

test('potions are kept at the keeper, from the device that changed them last, and added up for a guest', () => {
  const kept = keptProfile({ name: 'Sunny Otter', potions: 4, coins: 20, changedAt: 100 });
  assert.equal(kept.potions, 4);
  assert.equal(keptProfile({ name: 'Sunny Otter', potions: -3 }).potions, 0);
  const merged = mergeProfiles({ name: 'Sunny Otter', potions: 9, coins: 1, changedAt: 100 }, { name: 'Sunny Otter', potions: 2, coins: 3, changedAt: 200 });
  assert.equal(merged.potions, 2, 'the newer shopping is kept');
  assert.equal(mergeProfiles({ name: 'Sunny Otter', potions: 9, coins: 1, changedAt: 300 }, { name: 'Sunny Otter', potions: 2, coins: 3, changedAt: 200 }).potions, 9);
  const added = addProgress({ name: 'Sunny Otter', potions: 7, coins: 10 }, { name: 'Sunny Otter', potions: 5, coins: 1 });
  assert.equal(added.potions, 12);
});

test('drinking a potion brings all your HP back at once, and does nothing with none missing', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const p = room.players.get(1);
  p.hp = maxHp(1) - 3 * BUMP_HP;
  room.receive(a, { t: 'potion' });
  const healed = a.last('healed');
  assert.ok(healed, 'everyone hears of it');
  assert.equal(healed.pid, p.id);
  assert.deepEqual([healed.hp, healed.max], [maxHp(1), maxHp(1)]);
  assert.equal(b.last('healed').pid, p.id, 'friends too');
  // With it all back, and nothing to knock you over, there is nothing to
  // drink for: no message, and nothing comes back by itself either.
  time.t += 1000;
  room.receive(a, { t: 'potion' });
  assert.equal(a.all('healed').length, 1);
  for (let t = 0; t < 8000; t += 100) {
    time.t += 100;
    room.tick();
  }
  assert.equal(a.all('hp').length, 0, 'already full up');
});

test('a potion gets you up on your own when you are sitting dizzy', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const p = room.players.get(1);
  p.hp = 0;
  p.dizzyUntil = time.t + DIZZY_MS;
  room.receive(a, { t: 'potion' });
  const healed = a.last('healed');
  assert.ok(healed);
  assert.equal(healed.hp, maxHp(1));
  assert.equal(p.dizzyUntil, 0, 'up again');
  // Left sitting dizzy, they would have gone home once it wore off; not now.
  for (let t = 0; t < DIZZY_MS + 1000; t += 100) {
    time.t += 100;
    room.tick();
  }
  assert.equal(a.all('home').length, 0);
});
