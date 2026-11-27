// The stories of the Storybook, by their chapters' keys (isle-story.js), each
// made once and the same everywhere (maker.js).
import { harbor } from './harbor.js';
import { inkwell } from './inkwell.js';
import { meadow } from './meadow.js';
import { starry } from './starry.js';
import { turret } from './turret.js';

const STORIES = { meadow, harbor, turret, starry, inkwell };
const made = new Map();

export const BOOK_KEYS = Object.keys(STORIES);
export const isBookKey = (key) => BOOK_KEYS.includes(key);

export function bookLevel(key) {
  if (!isBookKey(key)) return null;
  if (!made.has(key)) made.set(key, STORIES[key]());
  return made.get(key);
}

// The kind of island a page is told one is (world.js meta), and back.
export const bookTheme = (key) => `book${key}`;
export const bookKey = (theme) => (typeof theme === 'string' && theme.startsWith('book') && isBookKey(theme.slice(4)) ? theme.slice(4) : null);
