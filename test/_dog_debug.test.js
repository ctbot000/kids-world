import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRITTER_TYPES, CRITTER_INFO, BIG } from '../public/js/shared/critters.js';

// The big friendly dog (issue #30): new kinds go on the end of the list,
// because the wire sends the index — an old page must keep reading every
// other animal just as it did.
test('the dog is the newest animal, on the end of the list, big and rideable', () => {
  assert.equal(CRITTER_TYPES.at(-1), 'dog', 'the dog stays on the end of CRITTER_TYPES');
  assert.equal(CRITTER_TYPES.indexOf('dog'), CRITTER_TYPES.length - 1, 'and only there');
  const info = CRITTER_INFO.dog;
  assert.ok(info.big, 'one of the big animals');
  assert.ok(BIG.includes('dog'), 'so it is in BIG');
  assert.ok(info.ride, 'it can be ridden');
  assert.ok(info.swims, 'it swims, and climbs out onto the bank');
  assert.ok(info.gallops, 'it gallops, like the pony');
  assert.ok(info.names.length >= 5, 'it has names to be called by');
});
