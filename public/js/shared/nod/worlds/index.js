// The dreams of the Land of Nod, by their chapters' keys (isle-story.js), each
// put together once and the same everywhere (maker.js).
import { clock } from './clock.js';
import { garden } from './garden.js';
import { mare } from './mare.js';
import { music } from './music.js';
import { pillow } from './pillow.js';

const MAKE = { pillow, garden, music, clock, mare };
const made = new Map();

export const NOD_KEYS = Object.keys(MAKE);
export const isNodKey = (key) => NOD_KEYS.includes(key);

export function nodWorld(key) {
  if (!isNodKey(key)) return null;
  if (!made.has(key)) made.set(key, MAKE[key]());
  return made.get(key);
}

// The kind of island a page is told one is (world.js meta), and back.
export const nodTheme = (key) => `nod${key}`;
export const nodKey = (theme) => (typeof theme === 'string' && theme.startsWith('nod') && isNodKey(theme.slice(3)) ? theme.slice(3) : null);
