// Cooking classes: the stove beside you found; the recipes, each a few steps
// in order; a class asking for each step out of a few, the right one among
// them; the Cooking School stamp, stations of stoves facing the teacher's
// kitchen; and the break before cooking a recipe again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { COOK_BREAK_MS, COOK_CHOICES, cookBreakLeft, cookCoins, isStove, makeLesson, RECIPES, recipeByKey, stoveNear } from '../public/js/shared/cooking.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { World } from '../public/js/shared/world.js';

test('a stove is found beside you, any way it faces, and none further away', () => {
  for (let k = 0; k < 4; k++) assert.ok(isStove(B.STOVE + k));
  for (const id of [B.COUNTER, B.FRIDGE, B.CHALKBOARD, B.AIR]) assert.ok(!isStove(id));
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 4, 9, B.STOVE);
  const near = stoveNear(w, { x: 8.5, y: 4, z: 7.8 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z }, { x: 8, y: 4, z: 9 });
  assert.equal(stoveNear(w, { x: 8.5, y: 4, z: 4.5 }), null, 'too far');
});

test('every recipe is four steps, each with its own icon, and keys of their own', () => {
  assert.ok(RECIPES.length >= 4);
  assert.equal(new Set(RECIPES.map((r) => r.key)).size, RECIPES.length);
  for (const r of RECIPES) {
    assert.equal(recipeByKey(r.key), r);
    assert.equal(r.steps.length, 4, r.key);
    assert.equal(new Set(r.steps.map((s) => s.icon)).size, r.steps.length, `${r.key}: steps told apart by their icons`);
  }
  assert.equal(recipeByKey('mud-pie'), null);
  assert.equal(makeLesson('mud-pie'), null);
});

test('a class asks for each step in order, out of a few, the right one among them and never one twice', () => {
  for (const r of RECIPES) {
    for (let seed = 1; seed <= 40; seed++) {
      const lesson = makeLesson(r.key, seed);
      assert.equal(lesson.recipe, r.key);
      assert.equal(lesson.asks.length, r.steps.length);
      lesson.asks.forEach((ask, i) => {
        assert.equal(ask.choices.length, COOK_CHOICES);
        assert.equal(ask.choices[ask.answer], r.steps[i], 'the step that comes next is the answer');
        assert.equal(new Set(ask.choices.map((c) => c.icon)).size, COOK_CHOICES, 'no two choices alike');
        for (const done of r.steps.slice(0, i)) assert.ok(!ask.choices.includes(done), 'a step done is not asked again');
      });
    }
    assert.deepEqual(makeLesson(r.key, 7), makeLesson(r.key, 7), 'the same seed, the same class');
  }
  // The answer is not always in the same place.
  const places = new Set();
  for (let seed = 1; seed <= 30; seed++) places.add(makeLesson('pizza', seed).asks[0].answer);
  assert.equal(places.size, COOK_CHOICES);
});

test('a coin for each step right first time, and the break before cooking a recipe again', () => {
  assert.equal(cookCoins(0), 0);
  assert.equal(cookCoins(4), 4);
  assert.equal(cookCoins(NaN), 0);
  assert.equal(cookBreakLeft(0, 5000), 0, 'never cooked: it may be');
  assert.equal(cookBreakLeft(1000, 1000), COOK_BREAK_MS);
  assert.equal(cookBreakLeft(1000, 1000 + COOK_BREAK_MS), 0);
});

test('the Cooking School stamp: a way in, stations of stoves to stand at facing the teacher, whichever way it goes down', () => {
  const stamp = stampByKey('cooking-school');
  assert.ok(stamp && stamp.icon === '🍳');
  const at = (cells, x, y, z) => cells.find(([dx, dy, dz]) => dx === x && dy === y && dz === z)?.[3] ?? B.AIR;
  for (const y of [1, 2]) assert.equal(at(stamp.cells, 0, y, 0), B.AIR, 'the way in');
  assert.ok(stamp.cells.some(([, , , id]) => id === B.FRIDGE), 'a fridge');
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  for (let facing = 0; facing < 4; facing++) {
    const placed = placeTemplate(stamp.cells, 20, 1, 20, facing);
    const stoves = placed.filter(([, , , id]) => isStove(id));
    assert.ok(stoves.length >= 9, 'a stove for the teacher and plenty for the class');
    const fronts = new Set(stoves.map(([, , , id]) => B.BLOCKS[id].front));
    assert.equal(fronts.size, 1, 'all facing the same way');
    for (const [x, y, z, id] of stoves) {
      const [fx, fz] = dirs[B.BLOCKS[id].front];
      for (const dy of [0, 1]) assert.equal(at(placed, x + fx, y + dy, z + fz), B.AIR, 'room to stand at it');
      assert.ok(B.SOLID[at(placed, x + fx, y - 1, z + fz)], 'a floor to stand on');
    }
  }
});
