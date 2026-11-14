// Dishes (blocks.js DISH): a plate to set food from your basket on — fruit,
// vegetables, cookies or fish — up to three pieces, to show and share until
// someone picks it back up. Only players put food on and take it off; nobody
// else (a pet, an octopus) does, so what is on a dish stays as it is put.
//
// What is on each dish is kept by the island (room.js), told to everyone there
// and saved with it, like the pictures on its drawing boards: the food is
// drawn over the plate by the mesher (render/mesher.js), as itself.
import { BLOCKS, isDishFood } from './blocks.js';
import { cellNear } from './arcade.js';

// How many pieces a dish holds at most.
export const DISH_MAX = 3;

// Which dish a block is, and whether it is a dish at all: any way it faces.
export const isDish = (id) => BLOCKS[id]?.model === 'dish';

// The dish nearest a body standing beside it: { x, y, z, key } of its cell,
// or null. One on a table is within reach as one on the floor is.
export const dishNear = (world, body, reach = 2.4) => cellNear(world, body, (id) => (isDish(id) ? {} : null), reach);

// A dish's food, cleaned of anything that is not a piece of dish food: at
// most DISH_MAX keys, each one once, in the order they came.
export function cleanDishFood(food) {
  if (!Array.isArray(food)) return [];
  const out = [];
  for (const key of food) {
    if (!isDishFood(key) || out.includes(key)) continue;
    out.push(key);
    if (out.length >= DISH_MAX) break;
  }
  return out;
}
