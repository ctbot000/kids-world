// Cooking classes: walk up to a Stove (a piece of furniture, blocks.js) and
// press Cook, and pick a recipe — pancakes, a pizza, a salad and more — and
// cook it with your own hands, in a kitchen in the window (ui.js, drawn by
// render/kitchen.js). Each step starts with picking the right thing off the
// shelf, what comes next, out of everything the recipe needs and a couple
// of things it does not; then you do it: drag the eggs into the bowl, hold
// the milk over it to pour, stir round and round, tap with the knife to
// chop, rub the sauce over the dough, and take the pan off the heat when it
// is golden. A step is a coin when the right thing was picked first time
// (and nothing came off the heat too dark); a wrong pick only says "Not
// yet!", so every class ends with the dish made. The 🍳 Cooking School
// stamp (stamps.js) is a kitchen classroom of stoves.
//
// Like a class at school (school.js), it all happens on your own page, and
// after a recipe the next one of it is after a break (COOK_BREAK_MS).
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';
import { Rng } from './rng.js';

// What a step has you do (its `act`), and how much of it (`n`):
// - add: drag the thing from the shelf into the vessel, n times;
// - pour: hold it over the vessel, n seconds of pouring;
// - stir: go round and round in the vessel, n times;
// - chop: tap the knife down on it, n times;
// - rub: go back and forth over it until n of it is covered (spread,
//   roll out, sprinkle or wash, as `look` says);
// - heat: it cooks by itself; take it off when it is golden.
// `vessel` is what it is done in: a bowl, a pan, a tray, a board, a pot or
// a plate.
const step = (icon, name, act, n, vessel, text, look) => ({ icon, name, act, n, vessel, text, ...(look ? { look } : {}) });

// The recipes, each a dish made in a few steps, in order. Within a recipe
// every step has a thing of its own to pick.
export const RECIPES = [
  {
    key: 'pancakes',
    icon: '🥞',
    name: 'Pancakes',
    steps: [
      step('🥚', 'Eggs', 'add', 2, 'bowl', 'Crack two eggs into the bowl'),
      step('🥛', 'Milk', 'pour', 1.5, 'bowl', 'Pour in the milk'),
      step('🌾', 'Flour', 'add', 2, 'bowl', 'Add two scoops of flour'),
      step('🥄', 'Spoon', 'stir', 3, 'bowl', 'Stir it into a smooth batter'),
      step('🍳', 'Frying pan', 'heat', 0, 'pan', 'Fry the pancake until golden'),
    ],
  },
  {
    key: 'pizza',
    icon: '🍕',
    name: 'Pizza',
    steps: [
      step('🫓', 'Dough', 'add', 1, 'tray', 'Put the dough on the tray'),
      step('🪵', 'Rolling pin', 'rub', 0.8, 'tray', 'Roll the dough out flat', 'roll'),
      step('🍅', 'Tomato sauce', 'rub', 0.8, 'tray', 'Spread on the tomato sauce', 'sauce'),
      step('🧀', 'Cheese', 'rub', 0.7, 'tray', 'Sprinkle on the cheese', 'cheese'),
      step('🔥', 'Oven', 'heat', 0, 'tray', 'Bake it until golden'),
    ],
  },
  {
    key: 'salad',
    icon: '🥗',
    name: 'Salad',
    steps: [
      step('🚰', 'Tap', 'rub', 0.8, 'board', 'Wash the vegetables', 'wash'),
      step('🔪', 'Knife', 'chop', 6, 'board', 'Chop them into little pieces'),
      step('🫒', 'Dressing', 'pour', 1, 'bowl', 'Pour on a little dressing'),
      step('🥄', 'Spoon', 'stir', 2, 'bowl', 'Toss it all together'),
    ],
  },
  {
    key: 'cookies',
    icon: '🍪',
    name: 'Cookies',
    steps: [
      step('🧈', 'Butter', 'add', 1, 'bowl', 'Put the butter in the bowl'),
      step('🌾', 'Flour', 'add', 2, 'bowl', 'Add two scoops of flour'),
      step('🥄', 'Spoon', 'stir', 3, 'bowl', 'Mix it into a dough'),
      step('🍫', 'Chocolate chips', 'rub', 0.7, 'tray', 'Sprinkle chocolate chips on the cookies', 'chips'),
      step('⏲️', 'Oven', 'heat', 0, 'tray', 'Bake them until golden'),
    ],
  },
  {
    key: 'soup',
    icon: '🍲',
    name: 'Veggie Soup',
    steps: [
      step('🔪', 'Knife', 'chop', 6, 'board', 'Chop the carrot and the potato'),
      step('💧', 'Water', 'pour', 1.5, 'pot', 'Fill the pot with water'),
      step('🔥', 'Stove', 'heat', 0, 'pot', 'Simmer until the vegetables are soft'),
      step('🧂', 'Salt', 'add', 3, 'pot', 'Shake in a pinch of salt'),
    ],
  },
  {
    key: 'sandwich',
    icon: '🥪',
    name: 'Sandwich',
    steps: [
      step('🍞', 'Bread', 'add', 1, 'plate', 'Lay a slice of bread on the plate'),
      step('🧈', 'Butter', 'rub', 0.8, 'plate', 'Spread butter on it', 'butter'),
      step('🥬', 'Lettuce', 'add', 1, 'plate', 'Add the lettuce'),
      step('🧀', 'Cheese', 'add', 1, 'plate', 'Add a slice of cheese'),
      step('🔪', 'Knife', 'chop', 1, 'plate', 'Put the top on and cut it in half'),
    ],
  },
];
export const recipeByKey = (key) => RECIPES.find((r) => r.key === key) ?? null;

// How many things on the shelf are not in the recipe at all, and how long
// the break is before the same recipe may be cooked again.
export const SHELF_EXTRAS = 2;
export const COOK_BREAK_MS = 2 * 60_000;

// Heat: how fast it cooks (a level each second), the level it is golden
// between, and the level it gets no darker than. Taken off before golden it
// is not ready; after, it is a little dark: done, but no coin.
export const HEAT_RATE = 0.2;
export const GOLDEN = [0.75, 1.15];
export const DARKEST = 1.6;

// Whether a block is a stove (any way it faces).
export const isStove = (id) => BLOCKS[id]?.model === 'stove';

// The stove nearest a body standing beside it: { x, y, z, key } of its
// cell, or null.
export const stoveNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isStove(id) ? {} : null), reach, 1);

// A class cooking a recipe, as it goes: the shelf ({ icon, name, step }
// each, the step it is for or -1), the step being done and whether its
// thing is still to pick ('pick') or picked and being done ('work'), how
// far it has got (progress, 0-1; heat, the heat level), the wrong picks
// made at each step, whether each came off the heat too dark, how many
// steps were right, and whether the dish is done. The same seed makes the
// same shelf.
export function makeLesson(key, seed = 1) {
  const recipe = recipeByKey(key);
  if (!recipe) return null;
  const rng = new Rng(seed);
  const shelf = recipe.steps.map((s, i) => ({ icon: s.icon, name: s.name, step: i }));
  const others = [];
  for (const r of RECIPES) for (const s of r.steps) if (!shelf.some((t) => t.icon === s.icon) && !others.some((t) => t.icon === s.icon)) others.push({ icon: s.icon, name: s.name, step: -1 });
  for (let k = 0; k < SHELF_EXTRAS && others.length; k++) shelf.push(others.splice(Math.floor(rng.next() * others.length), 1)[0]);
  for (let j = shelf.length - 1; j > 0; j--) {
    const k = Math.floor(rng.next() * (j + 1));
    [shelf[j], shelf[k]] = [shelf[k], shelf[j]];
  }
  const steps = recipe.steps.length;
  return { recipe: recipe.key, shelf, step: 0, phase: 'pick', progress: 0, heat: 0, misses: Array(steps).fill(0), dark: Array(steps).fill(false), right: 0, done: false };
}

// The step being done in a lesson, as the recipe has it, or null.
export const stepOf = (lesson) => (lesson && !lesson.done ? (recipeByKey(lesson.recipe)?.steps[lesson.step] ?? null) : null);

// The thing at shelf place i picked: true when it is the one the step
// needs (it is in your hand now), false when not (a miss at this step),
// undefined when there is nothing to pick.
export function pickItem(lesson, i) {
  const st = stepOf(lesson);
  const item = lesson?.shelf[i];
  if (!st || !item) return undefined;
  if (item.step !== lesson.step) {
    lesson.misses[lesson.step]++;
    return false;
  }
  lesson.phase = 'work';
  return true;
}

// Some of the step done (in the units of its act: drops, seconds of
// pouring, turns, taps, or the share of it newly covered): true when that
// finished the step. Nothing for a step not picked yet, or one on the heat.
export function workOn(lesson, amount) {
  const st = stepOf(lesson);
  if (!st || lesson.phase !== 'work' || st.act === 'heat' || !(amount > 0)) return false;
  lesson.progress = Math.min(1, lesson.progress + amount / st.n);
  if (lesson.progress < 1 - 1e-9) return false;
  finishStep(lesson);
  return true;
}

// Time on the heat, for a step that is heating and picked.
export function heatUp(lesson, dt) {
  const st = stepOf(lesson);
  if (!st || lesson.phase !== 'work' || st.act !== 'heat' || !(dt > 0)) return;
  lesson.heat = Math.min(DARKEST, lesson.heat + dt * HEAT_RATE);
}

// How done it is on the heat: 'raw', 'golden' or 'dark'.
export const doneness = (heat) => (heat < GOLDEN[0] ? 'raw' : heat <= GOLDEN[1] ? 'golden' : 'dark');

// Taking it off the heat: 'raw' leaves it on to cook more; 'golden' or
// 'dark' finishes the step (dark: no coin for it). Undefined when there is
// nothing on the heat.
export function takeOut(lesson) {
  const st = stepOf(lesson);
  if (!st || lesson.phase !== 'work' || st.act !== 'heat') return undefined;
  const how = doneness(lesson.heat);
  if (how === 'raw') return how;
  lesson.dark[lesson.step] = how === 'dark';
  finishStep(lesson);
  return how;
}

// A step done: right when its thing was picked first time and it did not
// come off the heat dark; on to the next one, or the dish is done.
function finishStep(lesson) {
  const steps = recipeByKey(lesson.recipe).steps.length;
  if (!lesson.misses[lesson.step] && !lesson.dark[lesson.step]) lesson.right++;
  lesson.step++;
  lesson.phase = 'pick';
  lesson.progress = 0;
  lesson.heat = 0;
  if (lesson.step >= steps) lesson.done = true;
}

// Coins for a class with `right` steps right.
export const cookCoins = (right) => (Number.isFinite(right) && right > 0 ? Math.floor(right) : 0);

// How long until a recipe last cooked at `endedAt` (ms, 0 for never) may be
// cooked again, at `now`: 0 when it may.
export const cookBreakLeft = (endedAt, now) => (endedAt ? Math.max(0, endedAt + COOK_BREAK_MS - now) : 0);
