// Cooking classes: the stove beside you found; the recipes, each a few steps
// to do with your hands; the shelf to pick each step's thing from; a class
// picked, worked at and taken off the heat to the dish made; the Cooking
// School stamp, stations of stoves facing the teacher's kitchen; and the
// break before cooking a recipe again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { COOK_BREAK_MS, cookBreakLeft, cookCoins, DARKEST, doneness, GOLDEN, HEAT_RATE, heatUp, isStove, makeLesson, pickItem, RECIPES, recipeByKey, SHELF_EXTRAS, stepOf, stoveNear, takeOut, workOn } from '../public/js/shared/cooking.js';
import { rubPoints } from '../public/js/render/kitchen.js';
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

test('every recipe is a few steps, each something to do with a thing of its own, and keys of their own', () => {
  assert.ok(RECIPES.length >= 4);
  assert.equal(new Set(RECIPES.map((r) => r.key)).size, RECIPES.length);
  const ACTS = ['add', 'pour', 'stir', 'chop', 'rub', 'heat'];
  for (const r of RECIPES) {
    assert.equal(recipeByKey(r.key), r);
    assert.ok(r.steps.length >= 4 && r.steps.length <= 5, r.key);
    assert.equal(new Set(r.steps.map((s) => s.icon)).size, r.steps.length, `${r.key}: a thing of its own to pick for every step`);
    for (const st of r.steps) {
      assert.ok(ACTS.includes(st.act), `${r.key}: ${st.act}`);
      assert.ok(['bowl', 'pan', 'pot', 'tray', 'board', 'plate'].includes(st.vessel));
      assert.ok(st.act === 'heat' || st.n > 0, 'something to do');
      if (st.act === 'rub') assert.ok(rubPoints(r.key, r.steps.indexOf(st)).length > 20, `${r.key}: a place to rub over`);
      else assert.deepEqual(rubPoints(r.key, r.steps.indexOf(st)), []);
    }
  }
  // Every way of doing a step is in some recipe.
  for (const act of ACTS) assert.ok(RECIPES.some((r) => r.steps.some((s) => s.act === act)), act);
  assert.equal(recipeByKey('mud-pie'), null);
  assert.equal(makeLesson('mud-pie'), null);
});

test('the shelf has the thing for every step and a couple more, shuffled, the same for the same seed', () => {
  for (const r of RECIPES) {
    for (let seed = 1; seed <= 30; seed++) {
      const lesson = makeLesson(r.key, seed);
      assert.equal(lesson.shelf.length, r.steps.length + SHELF_EXTRAS);
      assert.equal(new Set(lesson.shelf.map((s) => s.icon)).size, lesson.shelf.length, 'no two alike');
      r.steps.forEach((st, i) => assert.equal(lesson.shelf.filter((s) => s.step === i).length, 1));
      for (const s of lesson.shelf.filter((s) => s.step < 0)) assert.ok(!r.steps.some((st) => st.icon === s.icon), 'the extras are not in the recipe');
    }
    assert.deepEqual(makeLesson(r.key, 7), makeLesson(r.key, 7));
  }
  const firsts = new Set();
  for (let seed = 1; seed <= 30; seed++) firsts.add(makeLesson('pizza', seed).shelf.findIndex((s) => s.step === 0));
  assert.ok(firsts.size >= 4, 'not always in the same place');
});

// Does a step the way hands in the window do: picks its thing, then works
// at it in little bits (or waits on the heat and takes it off golden).
function doStep(lesson) {
  const st = stepOf(lesson);
  assert.equal(pickItem(lesson, lesson.shelf.findIndex((s) => s.step === lesson.step)), true);
  if (st.act === 'heat') {
    while (doneness(lesson.heat) !== 'golden') heatUp(lesson, 0.1);
    return takeOut(lesson);
  }
  const bit = st.act === 'add' || st.act === 'chop' ? 1 : st.n / 7;
  let n = 0;
  while (!workOn(lesson, bit)) assert.ok(++n < 100, 'it finishes');
}

test('a step is picked off the shelf, then done with your hands; a wrong pick is a miss, and the dish is made in the end', () => {
  for (const r of RECIPES) {
    const lesson = makeLesson(r.key, 3);
    // Nothing done before its thing is picked.
    assert.equal(lesson.phase, 'pick');
    assert.equal(workOn(lesson, 99), false);
    assert.equal(lesson.progress, 0);
    // A wrong pick: a miss at this step, and still to pick.
    assert.equal(pickItem(lesson, lesson.shelf.findIndex((s) => s.step < 0)), false);
    assert.deepEqual(lesson.misses.slice(0, 1), [1]);
    assert.equal(lesson.phase, 'pick');
    for (let i = 0; i < r.steps.length; i++) {
      assert.equal(lesson.step, i);
      doStep(lesson);
    }
    assert.ok(lesson.done);
    assert.equal(lesson.right, r.steps.length - 1, 'every step but the one with a miss');
    assert.equal(stepOf(lesson), null);
    assert.equal(pickItem(lesson, 0), undefined, 'nothing left to pick');
  }
});

test('an add step takes as many drops as it says, and six little chops make six', () => {
  const lesson = makeLesson('pancakes', 1);
  pickItem(lesson, lesson.shelf.findIndex((s) => s.step === 0));
  assert.equal(workOn(lesson, 1), false, 'one egg of two');
  assert.equal(lesson.progress, 0.5);
  assert.equal(workOn(lesson, 1), true, 'and the second');
  assert.equal(lesson.step, 1);
  const salad = makeLesson('soup', 1);
  pickItem(salad, salad.shelf.findIndex((s) => s.step === 0));
  for (let i = 0; i < 5; i++) assert.equal(workOn(salad, 1), false);
  assert.equal(workOn(salad, 1), true, 'thirds and sixths add up to the whole');
});

test('on the heat: too soon is not ready, golden is right, too long is done but no coin', () => {
  const cook = () => {
    const lesson = makeLesson('pancakes', 2);
    for (let i = 0; i < 4; i++) doStep(lesson);
    pickItem(lesson, lesson.shelf.findIndex((s) => s.step === 4));
    return lesson;
  };
  const early = cook();
  heatUp(early, 1);
  assert.equal(takeOut(early), 'raw');
  assert.equal(early.step, 4, 'left on');
  heatUp(early, 3);
  assert.equal(takeOut(early), 'golden');
  assert.ok(early.done);
  assert.equal(early.right, 5);
  const late = cook();
  heatUp(late, 60);
  assert.equal(late.heat, DARKEST, 'no darker than the darkest');
  assert.equal(takeOut(late), 'dark');
  assert.ok(late.done);
  assert.equal(late.right, 4, 'no coin for the dark one');
  // It cooks into golden in a few seconds, and stays golden for a while.
  assert.ok(GOLDEN[0] / HEAT_RATE >= 3 && GOLDEN[0] / HEAT_RATE <= 5);
  assert.ok((GOLDEN[1] - GOLDEN[0]) / HEAT_RATE >= 1.5);
  // Heat only once it is picked, and only on a heating step.
  const fresh = makeLesson('pancakes', 2);
  heatUp(fresh, 5);
  assert.equal(fresh.heat, 0);
  assert.equal(takeOut(fresh), undefined);
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
