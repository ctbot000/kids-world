// Toasting marshmallows over a campfire (blocks.js CAMPFIRE): stand by one and
// tap 🍢 Toast (or press Q), and a marshmallow on a stick is in your hand. Held
// over the flames it browns from white to golden; eat it golden for a happy
// munch and a heart, leave it too long and it burns black with a puff of smoke.
// Only the flames brown it, so stepping away stops it, and picking the campfire
// up or walking off drops the stick — nothing about it is kept. The stick itself
// is drawn by render/mallow-model.js, held in render/avatar.js (ANIM.toast);
// everyone else on the island is told of it through the room ('mallow', room.js),
// the way a fishing line out on the water is.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

// Browning, as cooking.js has the heat of a pan: how much of it a second over
// the flames, the level it is golden between, and the level it is burnt black
// from — no darker than BLACK. Between golden and burnt it is a little dark:
// still good to eat, if not the best.
export const TOAST_RATE = 0.28;
export const GOLDEN_AT = [0.8, 1.4];
export const BURNT_AT = 2.2;
export const BLACK = 2.6;

// The marshmallow's colours as it browns, white to golden to brown, then burnt
// black; the model that draws it (render/mallow-model.js) comes here for them.
export const MALLOW_STAGES = ['#fff8f0', '#f7e3b0', '#e9b95f', '#c88f3a', '#8a5a26', '#3a2e22'];

// How brown a marshmallow is, `brown` of it browned (0 up), as a colour on its
// way from white to black.
export function mallowColor(brown) {
  const t = Math.max(0, Math.min(1, brown / BLACK));
  const span = MALLOW_STAGES.length - 1;
  const i = Math.min(MALLOW_STAGES.length - 2, Math.floor(t * span));
  const k = t * span - i;
  const mix = (c) => Math.round(parseInt(MALLOW_STAGES[i].slice(c, c + 2), 16) * (1 - k) + parseInt(MALLOW_STAGES[i + 1].slice(c, c + 2), 16) * k);
  return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`;
}

// What a marshmallow is at `brown` (0 up): 'raw' before it is golden, 'golden'
// in the golden range, 'dark' after it until it burns, and 'burnt' from then on.
export function mallowState(brown) {
  if (brown >= BURNT_AT) return 'burnt';
  if (brown >= GOLDEN_AT[0] && brown <= GOLDEN_AT[1]) return 'golden';
  if (brown > GOLDEN_AT[1]) return 'dark';
  return 'raw';
}

// Whether a block is a campfire (render/campfire-model.js).
export const isCampfire = (id) => BLOCKS[id]?.model === 'campfire';

// The campfire nearest a body standing beside it: { x, y, z, key } of its cell,
// or null. A campfire is always lit.
export const campfireNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isCampfire(id) ? {} : null), reach, 1);

// Whether a marshmallow on a stick held at (x, y, z) is over the flames of the
// campfire at cell (fx, fy, fz): over the fire's middle, and down among the
// flames, which reach about this high over its bed of logs (render/campfire-model.js
// FLAMES).
export const FLAME_TOP = 1.2;
export const overFlames = (m, fx, fy, fz) => Math.hypot(fx + 0.5 - m.x, fz + 0.5 - m.z) < 0.55 && m.y > fy + 0.05 && m.y < fy + FLAME_TOP;

// One step of toasting: the marshmallow browns only while it is over the flames.
export const toastStep = (brown, over, dt) => (over ? Math.min(BLACK, brown + TOAST_RATE * dt) : brown);
