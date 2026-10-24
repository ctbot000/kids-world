import assert from 'node:assert/strict';
import test from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { cleanScreens, isComputer, screenNear, sinceText } from '../public/js/shared/screens.js';
import { seatNear } from '../public/js/shared/seats.js';
import { World } from '../public/js/shared/world.js';

function flat() {
  const world = new World(16, 16, 16);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.set(x, 0, z, B.STONE);
  return world;
}

test('screens: what an island says its computers show is made safe, and the one beside you found', () => {
  const world = flat();
  world.set(5, 2, 5, B.turnedTo(B.COMPUTER, 1));
  world.set(9, 2, 9, B.COMPUTER);
  assert.ok(isComputer(B.turnedTo(B.COMPUTER, 2)) && !isComputer(B.TV));
  const screens = cleanScreens([
    { x: 5, y: 2, z: 5, name: 'Ada 💼', issue: { n: 12, title: 'Fix the bus' }, doing: '#12: reading a.js', steps: [{ n: 1, tool: 'read', what: 'reading a.js', thought: 'x'.repeat(900) }, { bad: true }], since: 5 },
    { x: 'no', y: 2, z: 5 },
    null,
  ]);
  assert.deepEqual([...screens.keys()], ['5,2,5']);
  const s = screens.get('5,2,5');
  assert.equal(s.steps.length, 1);
  assert.equal(s.steps[0].thought.length, 400);
  assert.deepEqual(s.issue, { n: 12, title: 'Fix the bus' });
  // Beside it (it stands a cell up, on a table), and only one with a screen.
  assert.equal(screenNear(world, { x: 6.5, y: 1, z: 5.5 }, screens)?.key, '5,2,5');
  assert.equal(screenNear(world, { x: 9.5, y: 1, z: 8.2 }, screens), null, 'a computer with nothing on its screen');
  assert.equal(screenNear(world, { x: 12.5, y: 1, z: 5.5 }, screens), null, 'too far');
  assert.equal(sinceText(0), '');
  assert.equal(sinceText(1000, 1000 + 5 * 60000), '5 min');
  assert.equal(sinceText(1000, 1000 + 80 * 60000), '1 h 20 min');
});

test('a seat someone is already in is passed over for the next one', () => {
  const world = flat();
  world.set(5, 1, 5, B.CHAIR);
  world.set(7, 1, 5, B.CHAIR);
  const body = { x: 5.9, y: 1, z: 5.5 };
  assert.deepEqual(seatNear(world, body), { x: 5, y: 1, z: 5 });
  assert.deepEqual(seatNear(world, body, 1.6, (x) => x === 5), { x: 7, y: 1, z: 5 });
  assert.equal(seatNear(world, body, 1.6, () => true), null);
});
