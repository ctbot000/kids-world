// Cooking classes: walk up to a Stove (a piece of furniture, blocks.js) and
// press Cook, and pick a recipe — pancakes, a pizza, a salad and more. Each
// recipe is a few steps, and the class asks for them one at a time: "What
// comes next?", out of the steps still to do and one or two from other
// recipes. A step right first time is a coin; a wrong one only says "Not
// yet!" and you try again, so every class ends with the dish made. The
// 🍳 Cooking School stamp (stamps.js) is a kitchen classroom of stoves.
//
// Like a class at school (school.js), it all happens on your own page, and
// after a recipe the next one of it is after a break (COOK_BREAK_MS).
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';
import { Rng } from './rng.js';

// The recipes, each a dish made in four steps, in order.
export const RECIPES = [
  {
    key: 'pancakes',
    icon: '🥞',
    name: 'Pancakes',
    steps: [
      { icon: '🥚', text: 'Crack the eggs into a bowl' },
      { icon: '🥛', text: 'Pour in the milk and flour' },
      { icon: '🥄', text: 'Stir it into a smooth batter' },
      { icon: '🍳', text: 'Fry spoonfuls in the pan, flipping them' },
    ],
  },
  {
    key: 'pizza',
    icon: '🍕',
    name: 'Pizza',
    steps: [
      { icon: '🫓', text: 'Roll the dough out flat' },
      { icon: '🍅', text: 'Spread on the tomato sauce' },
      { icon: '🧀', text: 'Sprinkle on cheese and toppings' },
      { icon: '🔥', text: 'Bake it in the hot oven' },
    ],
  },
  {
    key: 'salad',
    icon: '🥗',
    name: 'Salad',
    steps: [
      { icon: '🚰', text: 'Wash the vegetables' },
      { icon: '🔪', text: 'Chop them into little pieces' },
      { icon: '🥣', text: 'Put them all in a big bowl' },
      { icon: '🫒', text: 'Toss with a little dressing' },
    ],
  },
  {
    key: 'cookies',
    icon: '🍪',
    name: 'Cookies',
    steps: [
      { icon: '🧈', text: 'Mix the butter and sugar' },
      { icon: '🌾', text: 'Stir in the flour and an egg' },
      { icon: '🍫', text: 'Add the chocolate chips' },
      { icon: '⏲️', text: 'Bake little balls of dough' },
    ],
  },
  {
    key: 'soup',
    icon: '🍲',
    name: 'Veggie Soup',
    steps: [
      { icon: '🥕', text: 'Peel and chop the carrots and potatoes' },
      { icon: '💧', text: 'Put them in a pot of water' },
      { icon: '♨️', text: 'Simmer until soft' },
      { icon: '🧂', text: 'Add a pinch of salt and serve' },
    ],
  },
  {
    key: 'sandwich',
    icon: '🥪',
    name: 'Sandwich',
    steps: [
      { icon: '🍞', text: 'Lay out two slices of bread' },
      { icon: '🧈', text: 'Spread butter on them' },
      { icon: '🥬', text: 'Add lettuce, cheese and ham' },
      { icon: '🔪', text: 'Put the top on and cut it in half' },
    ],
  },
];
export const recipeByKey = (key) => RECIPES.find((r) => r.key === key) ?? null;

// How many steps to pick from each time, and how long the break is before
// the same recipe may be cooked again.
export const COOK_CHOICES = 3;
export const COOK_BREAK_MS = 2 * 60_000;

// Whether a block is a stove (any way it faces).
export const isStove = (id) => BLOCKS[id]?.model === 'stove';

// The stove nearest a body standing beside it: { x, y, z, key } of its
// cell, or null.
export const stoveNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isStove(id) ? {} : null), reach, 1);

// A class cooking a recipe: { recipe, asks: [{ choices, answer }] }, one ask
// for each step, its choices steps ({ icon, text }) and answer the place in
// them of the step that comes next. The choices are that step, others still
// to do and, when too few are left, steps of other recipes. The same seed
// makes the same class.
export function makeLesson(key, seed = 1) {
  const recipe = recipeByKey(key);
  if (!recipe) return null;
  const rng = new Rng(seed);
  const pick = (list) => list.splice(Math.floor(rng.next() * list.length), 1)[0];
  const others = RECIPES.filter((r) => r !== recipe).flatMap((r) => r.steps);
  const asks = recipe.steps.map((step, i) => {
    const later = recipe.steps.slice(i + 1);
    const wrong = [];
    while (wrong.length < COOK_CHOICES - 1 && later.length) wrong.push(pick(later));
    const decoys = others.filter((s) => s.icon !== step.icon && !wrong.some((w) => w.icon === s.icon));
    while (wrong.length < COOK_CHOICES - 1) wrong.push(pick(decoys));
    const choices = [step, ...wrong];
    for (let j = choices.length - 1; j > 0; j--) {
      const k = Math.floor(rng.next() * (j + 1));
      [choices[j], choices[k]] = [choices[k], choices[j]];
    }
    return { choices, answer: choices.indexOf(step) };
  });
  return { recipe: recipe.key, asks };
}

// Coins for a class with `right` steps right first time.
export const cookCoins = (right) => (Number.isFinite(right) && right > 0 ? Math.floor(right) : 0);

// How long until a recipe last cooked at `endedAt` (ms, 0 for never) may be
// cooked again, at `now`: 0 when it may.
export const cookBreakLeft = (endedAt, now) => (endedAt ? Math.max(0, endedAt + COOK_BREAK_MS - now) : 0);
