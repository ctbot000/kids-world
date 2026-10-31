// Feeding the fish in the fish tanks and goldfish bowls (blocks.js): walk up, tap 🐟 Feed (or press Q) and a pinch of flakes sprinkles down onto the water, the fish dart over and nibble them up, with a heart or two rising. Everyone on the island sees it, and nothing is kept in the save — the fish are hungry again next visit. The model (render/fishtank-model.js) draws the flakes and the darting fish; this file is the game of it: what a tank is, where it is, where each flake lands, and when a tank may be fed again — which the island (shared/room.js) holds, so friends on it agree.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

// How long the fish stay full, so feeding again right away only says so, and
// how long a feeding goes on from the first flake landing to the last nibble.
export const FED_FOR_MS = 3 * 60_000;
export const FEED_MS = 8_000;
// How many flakes are in a pinch.
export const FLAKES = 12;

// Whether a block is a fish tank or a fish bowl (any way it faces).
export const isTank = (id) => BLOCKS[id]?.model === 'fish-tank' || BLOCKS[id]?.model === 'fish-bowl';

// The tank or bowl nearest a body standing beside it: { x, y, z, kind, key }
// of its cell, or null. Its cabinet is a block tall, so one row above your
// feet is looked at too, like the stove's and the piano's.
export const tankNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => {
  const kind = BLOCKS[id]?.model;
  return kind === 'fish-tank' || kind === 'fish-bowl' ? { kind } : null;
}, reach, 1);

// Where each flake of a pinch lands, over the water of a tank or a bowl, in
// its own units (render/fishtank-model.js): { x, z, t }, t being when it
// comes down onto the water, in seconds from the pinch. The same layout
// every time, so everyone watching sees the same flakes.
export function flakeLayout(kind) {
  const bowl = kind === 'fish-bowl';
  const out = [];
  for (let i = 0; i < FLAKES; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = bowl ? 0.045 + (i % 4) * 0.022 : 0.07 + ((i * 7) % 10) * 0.03;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * (bowl ? 1 : 0.5), t: 0.1 + i * 0.13 });
  }
  return out;
}

// One attempt to feed the tank at (x, y, z), from what the island knows of
// its feedings (`fed`, by cell key, this visit only): { at } for a feeding
// that has just begun, or { full: true } when the last one was too recent.
export function feedTank(tank, fed, now) {
  const key = tank.key ?? `${tank.x},${tank.y},${tank.z}`;
  const last = fed.get(key);
  if (last && now - last < FED_FOR_MS) return { full: true, at: last };
  fed.set(key, now);
  return { at: now };
}
