// A dish (issue #79): furniture that turns to face you, holds up to three
// pieces of food from the basket, and keeps what is on it in the island's save
// (room.js dishes, saved as `dishes` beside its drawings and kits).
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../public/js/shared/world.js';
import { BLOCKS, DISH, isDishFood } from '../public/js/shared/blocks.js';
import { cleanDishFood, DISH_MAX, dishNear, isDish } from '../public/js/shared/dish.js';
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

test('a dish holds the food of the basket, and no more than three pieces', () => {
  for (const key of ['apple', 'corn', 'cookie', 'fish']) assert.ok(isDishFood(key), key);
  for (const key of ['shell', 'pearl', 'ruby', 'flower', 'planks', '']) assert.ok(!isDishFood(key), key);
  assert.deepEqual(cleanDishFood(['apple', 'cookie', 'fish']), ['apple', 'cookie', 'fish']);
  // A fourth piece, a repeated kind and anything not food are left off.
  assert.deepEqual(cleanDishFood(['apple', 'apple', 'cookie', 'fish', 'corn']), ['apple', 'cookie', 'fish']);
  assert.deepEqual(cleanDishFood(['apple', 'ruby', 'apple']), ['apple']);
  assert.deepEqual(cleanDishFood(null), []);
  assert.equal(DISH_MAX, 3);
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
