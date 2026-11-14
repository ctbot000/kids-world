// A dish (issue #79): furniture that turns to face you, holds up to three
// pieces of food from the basket, and keeps what is on it in the island's save
// (room.js dishes, saved as `dishes` beside its drawings and kits).
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../public/js/shared/world.js';
import { BLOCKS, DISH, isDishFood } from '../public/js/shared/blocks.js';
import { cleanDishFood, DISH_MAX, dishNear, dishWith, foodItem, isDish, plateSpots } from '../public/js/shared/dish.js';
import * as B from '../public/js/shared/blocks.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { furnitureBoxes } from '../public/js/shared/furniture.js';
import { modelBoxes } from '../public/js/shared/furniture.js';

test('a dish is furniture of the Home tab, and turns to face you', () => {
  const def = BLOCKS[DISH];
  assert.equal(def.name, 'Dish');
  assert.equal(def.category, 'home');
  assert.equal(def.kind, 'furniture');
  // One that turns is four blocks in a row, one per way its front can face.
  assert.equal(def.turns, true);
  assert.deepEqual(def.faces, [DISH, DISH + 1, DISH + 2, DISH + 3]);
  assert.equal(BLOCKS[DISH + 3].model, 'dish');
  // It has a model of its own: a low plate, not a tall piece of furniture.
  const boxes = modelBoxes(DISH, () => true);
  assert.ok(boxes.length);
  assert.ok(Math.max(...boxes.map((b) => b[4])) < 0.2);
});

test('a dish holds the food of the basket, three pieces at most, the same kind as often as you like', () => {
  for (const key of ['apple', 'corn', 'watermelon', 'fish']) assert.ok(isDishFood(key) && foodItem(key), key);
  for (const key of ['shell', 'pearl', 'ruby', 'flower', 'cookie', 'planks', '']) assert.ok(!isDishFood(key) && !foodItem(key), key);
  assert.deepEqual(cleanDishFood(['apple', 'apple', 'fish']), ['apple', 'apple', 'fish']);
  // A fourth piece, and anything not food, are left off.
  assert.deepEqual(cleanDishFood(['apple', 'ruby', 'apple', 'fish', 'corn']), ['apple', 'apple', 'fish']);
  assert.deepEqual(cleanDishFood(null), []);
  assert.equal(DISH_MAX, 3);
  // One more on, or one off; never past full, nor what is not there.
  assert.deepEqual(dishWith(['apple'], { put: 'fish' }), ['apple', 'fish']);
  assert.equal(dishWith(['apple', 'apple', 'fish'], { put: 'corn' }), null);
  assert.equal(dishWith(['apple'], { put: 'ruby' }), null);
  assert.deepEqual(dishWith(['apple', 'fish'], { take: 0 }), ['fish']);
  assert.equal(dishWith(['apple'], { take: 3 }), null);
  // Each piece has a spot on the plate, inside it.
  for (let n = 1; n <= DISH_MAX; n++) assert.equal(plateSpots(n).length, n);
  for (const [dx, dz, size] of plateSpots(3)) assert.ok(Math.hypot(dx, dz) + size / 2 < 0.36);
});

test('on a table a dish stands down on its top', () => {
  const w = new World({ W: 8, H: 8, D: 8, sea: 1 });
  w.set(3, 1, 3, B.TABLE);
  w.set(3, 2, 3, DISH);
  const at = (x, y, z) => w.get(x, y, z);
  const lowest = Math.min(...furnitureBoxes(DISH, 3, 2, 3, at).map((b) => b[1]));
  assert.ok(lowest < 2 && lowest > 1.7, `on the table's top, at ${lowest}`);
});

test('the dish nearest you is the one you can put food on, on the floor or a table', () => {
  const w = new World({ W: 16, H: 8, D: 16, sea: 1 });
  w.set(8, 1, 8, 12);
  w.set(4, 1, 4, 12);
  w.set(4, 2, 4, DISH);
  w.set(8, 2, 8, DISH + 1);
  assert.ok(isDish(DISH + 1));
  assert.equal(dishNear(w, { x: 4.5, y: 3, z: 4.5 }).key, '4,2,4');
  assert.equal(dishNear(w, { x: 8.5, y: 2, z: 8.5 }).key, '8,2,8');
  assert.equal(dishNear(w, { x: 1.5, y: 2, z: 1.5 }), null);
  assert.equal(dishNear(w, { x: 8.5, y: 8, z: 8.5 }), null);
});

function island({ owned = false } = {}) {
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  if (owned) room.ownerWho = 'someone';
  const conn = () => {
    const c = { inbox: [] };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    c.close = () => {};
    c.all = (t) => c.inbox.filter((m) => m.t === t);
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' } });
    return c;
  };
  const a = conn();
  const b = conn();
  const pid = a.inbox.find((m) => m.t === 'welcome').you;
  const p = room.players.get(pid);
  const [x, z] = [Math.floor(p.s[0]) + 2, Math.floor(p.s[2])];
  const y = room.world.top(x, z) + 1;
  room.world.set(x, y, z, DISH);
  p.s = [x - 0.5, y, z + 0.5, 0, 0, 0];
  return { room, conn, a, b, pid, p, x, y, z };
}

test('the island keeps food set on a dish one piece at a time, tells everyone, saves it and drops it with the dish', () => {
  const { room, conn, a, b, pid, p, x, y, z } = island();
  room.receive(a, { t: 'dish', at: [x, y, z], food: ['apple'] });
  room.receive(a, { t: 'dish', at: [x, y, z], food: ['apple', 'apple'] });
  // Told to everyone, the one who did it too (their basket waits for it).
  assert.deepEqual(b.all('dish').at(-1), { t: 'dish', pid, at: [x, y, z], food: ['apple', 'apple'] });
  assert.deepEqual(a.all('dish').at(-1).food, ['apple', 'apple']);
  // Never two at once, nor a piece swapped for another, nor past full.
  for (const food of [['apple', 'apple', 'fish', 'corn'], ['fish', 'apple'], ['apple', 'fish', 'corn'], []]) room.receive(a, { t: 'dish', at: [x, y, z], food });
  assert.equal(b.all('dish').length, 2, 'none of those');
  // Nor from afar, nor at no dish.
  p.s = [x + 9, y, z, 0, 0, 0];
  room.receive(a, { t: 'dish', at: [x, y, z], food: ['apple'] });
  p.s = [x - 0.5, y, z + 0.5, 0, 0, 0];
  room.receive(a, { t: 'dish', at: [x, y + 1, z], food: ['apple'] });
  assert.equal(b.all('dish').length, 2);
  // Someone arriving sees it, and so does the island opened again.
  const c = conn();
  assert.deepEqual(c.all('welcome')[0].dishes, [[x, y, z, ['apple', 'apple']]]);
  const again = new Room({ save: JSON.parse(JSON.stringify(room.exportSave())) });
  assert.deepEqual(again.packDishes(), [[x, y, z, ['apple', 'apple']]]);
  // A piece taken back, then the dish picked up: its food goes with it.
  room.receive(a, { t: 'dish', at: [x, y, z], food: ['apple'] });
  assert.deepEqual(b.all('dish').at(-1).food, ['apple']);
  room.world.set(x, y, z, B.AIR);
  assert.deepEqual(b.all('dishes').at(-1).d, []);
  assert.equal(room.exportSave().dishes, undefined, 'none saved');
});

test('nobody lays the table on an island that stays as it is', () => {
  const { room, a, b, x, y, z } = island({ owned: true });
  room.receive(a, { t: 'dish', at: [x, y, z], food: ['apple'] });
  assert.equal(b.all('dish').length, 0);
  assert.ok(a.all('notice').some((m) => /no laying the table/.test(m.text)));
});
