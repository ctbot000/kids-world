// Dishes (blocks.js DISH): a plate to set food from your basket on — fruit,
// vegetables or fish — up to three pieces, to show and share until
// someone picks it back up. Only players put food on and take it off; nobody
// else (a pet, an octopus) does, so what is on a dish stays as it is put.
//
// What is on each dish is kept by the island (room.js), told to everyone there
// and saved with it, like the pictures on its drawing boards: the food is
// drawn over the plate by the mesher (render/mesher.js), as itself.
import { BLOCKS, COLLECTABLES, isDishFood } from './blocks.js';
import { cellNear } from './arcade.js';

// How many pieces a dish holds at most.
export const DISH_MAX = 3;

// Which dish a block is, and whether it is a dish at all: any way it faces.
export const isDish = (id) => BLOCKS[id]?.model === 'dish';

// The dish nearest a body standing beside it: { x, y, z, key } of its cell,
// or null. One on a table is within reach as one on the floor is.
export const dishNear = (world, body, reach = 2.4) => cellNear(world, body, (id) => (isDish(id) ? {} : null), reach);

// A dish's food, cleaned of anything that is not a piece of dish food: at
// most DISH_MAX keys (three apples are fine), in the order they came.
export function cleanDishFood(food) {
  if (!Array.isArray(food)) return [];
  return food.filter((key) => isDishFood(key)).slice(0, DISH_MAX);
}

// The block a piece of food is drawn as (its basket item), or 0.
export const foodItem = (key) => (isDishFood(key) ? (COLLECTABLES.find((c) => c.key === key)?.item ?? 0) : 0);

// Where the pieces stand on the plate, from its middle, and how big each is
// drawn: [dx, dz, size]. One in the middle; two side by side; three round.
export function plateSpots(n) {
  if (n <= 1) return [[0, 0, 0.36]];
  if (n === 2) return [[-0.12, 0, 0.3], [0.12, 0, 0.3]];
  return [[-0.13, 0.07, 0.27], [0.13, 0.07, 0.27], [0, -0.13, 0.27]].slice(0, n);
}

// What a dish's food becomes after `key` is put on it, or the piece at
// `index` taken off; null when that cannot be (full, or nothing there).
export function dishWith(food, { put = null, take = -1 } = {}) {
  if (put) return isDishFood(put) && food.length < DISH_MAX ? [...food, put] : null;
  if (take >= 0 && take < food.length) return food.filter((_, i) => i !== take);
  return null;
}
