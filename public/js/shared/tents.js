// Tents: anywhere with tent cloth over it is in a tent, whether it is one of
// the huge tent stamps or one a player made. A tent is a cozy place to camp
// out at night (there is a sticker for it), and no monster ever comes in.
import { CLOTH } from './blocks.js';

// How far up the cloth can be and still be over you: as high as the top of
// the Circus Tent from its floor, and a little more.
export const TENT_REACH = 24;

// Whether there is tent cloth over the spot (x, y, z), from the cell there up.
export function underTent(world, x, y, z) {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  const from = Math.max(0, Math.floor(y));
  for (let cy = from; cy <= from + TENT_REACH; cy++) if (CLOTH[world.get(cx, cy, cz)]) return true;
  return false;
}
