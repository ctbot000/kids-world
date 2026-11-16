// Toasting marshmallows over a campfire: how fast one browns and when it is
// golden or burnt, that only the flames brown it, finding the campfire beside
// you, and that picking the fire up leaves nothing to toast at.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BLACK, BURNT_AT, campfireNear, GOLDEN_AT, isCampfire, mallowColor, mallowState, overFlames, TOAST_RATE, toastStep } from '../public/js/shared/mallow.js';
import { World } from '../public/js/shared/world.js';

// A grassy field with a campfire in the middle of it.
function field() {
  const w = new World({ W: 24, H: 16, D: 24, sea: 4 });
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) for (let y = 1; y <= 4; y++) w.set(x, y, z, B.GRASS);
  w.set(10, 5, 10, B.CAMPFIRE);
  return w;
}

test('a marshmallow browns only over the flames, golden in a few seconds, and burns black if left', () => {
  assert.equal(isCampfire(B.CAMPFIRE), true, 'a campfire is one');
  assert.equal(isCampfire(B.GRASS), false, 'grass is not');
  // Away from the fire nothing happens at all, however long.
  assert.equal(toastStep(0, false, 60), 0, 'stepping away stops the browning');
  // Over the flames, golden within a few seconds and burnt after a little more.
  let brown = 0;
  let golden = null;
  let burnt = null;
  for (let t = 0; t < 20 && brown < BLACK; t += 1 / 30) {
    brown = toastStep(brown, true, 1 / 30);
    if (golden === null && mallowState(brown) === 'golden') golden = t;
    if (burnt === null && mallowState(brown) === 'burnt') burnt = t;
  }
  assert.equal(mallowState(0), 'raw', 'white to begin with');
  assert.ok(golden > 2 && golden < 6, `golden after about ${golden?.toFixed(1)}s`);
  assert.ok(burnt > golden + 1, `burnt at ${burnt?.toFixed(1)}s, a while after golden`);
  assert.equal(brown, BLACK, 'never darker than black');
  assert.equal(mallowState(GOLDEN_AT[0]), 'golden', 'golden from its level on');
  assert.equal(mallowState(GOLDEN_AT[1] + 0.01), 'dark', 'a little dark after');
  assert.equal(mallowState(BURNT_AT), 'burnt', 'burnt from its level on');
  assert.ok(TOAST_RATE > 0, 'it browns at a rate');
  // The colour goes from near white to near black on the way.
  const pale = mallowColor(0);
  const dark = mallowColor(BLACK);
  assert.ok(pale.startsWith('rgb(255'), 'starts white');
  assert.ok(dark.startsWith('rgb(58') || dark.startsWith('rgb(5'), 'ends near black');
  assert.notEqual(pale, mallowColor(1), 'and changes on the way');
});

test('the stick is over the flames only right above the fire, not beside it nor high above', () => {
  const fire = [10, 5, 10];
  assert.equal(overFlames({ x: 10.5, y: 5.7, z: 10.5 }, ...fire), true, 'in the flames');
  assert.equal(overFlames({ x: 10.5, y: 5.2, z: 10.5 }, ...fire), true, 'just above the logs');
  assert.equal(overFlames({ x: 12, y: 5.7, z: 10.5 }, ...fire), false, 'a step aside');
  assert.equal(overFlames({ x: 10.5, y: 4.5, z: 10.5 }, ...fire), false, 'under the fire');
  assert.equal(overFlames({ x: 10.5, y: 6.8, z: 10.5 }, ...fire), false, 'held high above');
});

test('the campfire beside you is found, and none further away', () => {
  const w = field();
  assert.deepEqual(campfireNear(w, { x: 9.5, y: 6, z: 10.5 }), { x: 10, y: 5, z: 10, key: '10,5,10' }, 'standing beside it');
  assert.equal(campfireNear(w, { x: 20.5, y: 6, z: 10.5 }), null, 'far away');
  // With the fire picked up, there is nothing to toast at.
  w.set(10, 5, 10, B.AIR);
  assert.equal(campfireNear(w, { x: 9.5, y: 6, z: 10.5 }), null, 'picked up mid-toast');
});
