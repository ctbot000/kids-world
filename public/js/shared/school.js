// Schools: a School Desk with its chair to sit at, and a Chalkboard that
// hangs on the wall (pieces of furniture, blocks.js), and the 🏫 School
// stamp (stamps.js), a schoolhouse with a bell tower and a classroom of
// desks facing a long chalkboard. Walk up to a chalkboard and press Class:
// pick a class, Year 2 of elementary school or Year 3 of middle school, and
// answer its questions, asked out of the extra-credit quizzes' banks
// (quiz.js), for a coin or two for each one right.
//
// It all happens on your own page, like the quizzes: each player's class is
// their own. After a class, the next one of that level is after a break
// (CLASS_BREAK_MS), so coins come from learning, not from tapping on.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

// How many questions a class asks, and how long the break is before the
// next class of the same level.
export const CLASS_SIZE = 3;
export const CLASS_BREAK_MS = 2 * 60_000;

// Whether a block is a chalkboard (any way it faces).
export const isChalkboard = (id) => BLOCKS[id]?.model === 'chalkboard';

// The chalkboard nearest a body standing beside it: { x, y, z, key } of its
// cell, or null. It hangs on the wall, so up to two cells over your feet.
export const chalkboardNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isChalkboard(id) ? {} : null), reach, 2);

// How long until a class of a level whose last class ended at `endedAt`
// (ms, 0 for never) may begin, at `now`: 0 when it may.
export const breakLeft = (endedAt, now) => (endedAt ? Math.max(0, endedAt + CLASS_BREAK_MS - now) : 0);
