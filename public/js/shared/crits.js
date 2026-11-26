// Critical hits: now and then a swing lands as a critical one, taking twice the
// hearts off everything it hits (CRIT_TIMES), with a show of its own (game.js
// strike). Which swings are is the island's to say (room.js swung), from a stream
// of luck drawn for nothing else, a swing ahead: the swinger's page is told of a
// critical one before it swings it, by the number it gives its swings, so the
// blow lands with all its show at once, as every blow does, and not once the
// island answers.
//
// Every blow of that swing is critical: on each monster it hits, a boss, a wild
// dragon, those the Thunder Spear's bolt leaps on to, and all that a Bomb Rod's
// bomb or a Meteor Staff's meteor catches. Not a landing on a monster's head, nor
// a ridden dragon's fire, and never in the Land of Nod or a duel with a soul,
// where how hard a weapon hits hardly counts: openings do there (nod/).

// How many swings in each is critical, and how many times over it lands.
export const CRIT_CHANCE = 1 / 8;
export const CRIT_TIMES = 2;

// Whether a swing is critical, by a draw from rand ([0, 1)). A test that needs
// to know what a blow takes sets globalThis.kidsWorldLuck to the chance it
// wants (0: never, 1: always).
export function critRoll(rand) {
  const chance = typeof globalThis.kidsWorldLuck === 'number' ? globalThis.kidsWorldLuck : CRIT_CHANCE;
  return rand() < chance;
}

// A swing's number, as a page counts them from the island's welcome: whole,
// from 1. A swing without one is from a page before critical hits, or from the
// Land of Nod, and is never critical.
export const isSwing = (n) => Number.isInteger(n) && n >= 1;
