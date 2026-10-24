// Computers' screens: on an island whose keeper says what its computers show
// (shared/room.js setScreens; the CTB island's office does, with each
// worker's real work), the screen of each of those computers shows it
// (render/screens.js), and walking up to one and pressing Look opens it big.
import { BLOCKS } from './blocks.js';
import { keyOf } from './arcade.js';

// The most a page takes of what a screen says.
const STEPS_MAX = 8;
const TEXT_MAX = 400;

export const isComputer = (id) => BLOCKS[id]?.model === 'computer';

const text = (v, max = TEXT_MAX) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

// The screens an island told of, made safe to show: by cell key, each
// { x, y, z, name, issue: { n, title } or null, doing, steps, since }.
export function cleanScreens(list) {
  const out = new Map();
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || ![s.x, s.y, s.z].every(Number.isInteger)) continue;
    const issue = s.issue && Number.isInteger(s.issue.n) ? { n: s.issue.n, title: text(s.issue.title, 200) } : null;
    const steps = (Array.isArray(s.steps) ? s.steps : []).slice(-STEPS_MAX).filter((t) => t && typeof t.what === 'string');
    out.set(keyOf(s.x, s.y, s.z), {
      x: s.x,
      y: s.y,
      z: s.z,
      name: text(s.name, 40),
      issue,
      doing: text(s.doing),
      steps: steps.map((t) => ({ n: int(t.n), tool: text(t.tool, 20), what: text(t.what, 200), thought: text(t.thought) })),
      since: int(s.since),
    });
  }
  return out;
}

// The computer with a screen to look at nearest a body standing beside it:
// { x, y, z, key } of its cell, or null. It stands on a table, so up to a
// cell over your feet.
export function screenNear(world, body, screens, reach = 2.2) {
  const by = Math.floor(body.y + 0.05);
  let best = null;
  let near = reach;
  for (const [key, s] of screens) {
    if (s.y < by - 1 || s.y > by + 1 || !isComputer(world.get(s.x, s.y, s.z))) continue;
    const d = Math.hypot(s.x + 0.5 - body.x, s.z + 0.5 - body.z);
    if (d < near) {
      near = d;
      best = { x: s.x, y: s.y, z: s.z, key };
    }
  }
  return best;
}

// How long someone has been at it, in words: "5 min", "1 h 20 min".
export function sinceText(since, now = Date.now()) {
  if (!since) return '';
  const min = Math.max(0, Math.floor((now - since) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
