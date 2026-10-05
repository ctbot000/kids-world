// Elevators: a pad you stand on and jump (or go down) to glide to the next
// pad above or below in its column, the stamp that builds a tower with two,
// and the sticker for riding one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { nextPad, padUnder, startLift, stepLift } from '../public/js/shared/elevator.js';
import { bodyOverlapsSolid, makeBody, stepBody } from '../public/js/shared/physics.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { stampByKey } from '../public/js/shared/stamps.js';
import { World } from '../public/js/shared/world.js';

function meadow() {
  const w = new World({ W: 32, H: 32, D: 32, sea: 3 });
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

const settle = (w, b) => {
  for (let i = 0; i < 60; i++) stepBody(w, b, {}, 1 / 60);
};

test('a body on a pad rides up to the next pad and down again', () => {
  const w = meadow();
  w.set(10, 6, 10, B.ELEVATOR);
  w.set(10, 13, 10, B.ELEVATOR);
  w.set(10, 20, 10, B.ELEVATOR);
  const b = makeBody(10.5, 8, 10.5);
  settle(w, b);
  assert.equal(b.y, 7, 'standing on the pad');
  assert.deepEqual(padUnder(w, b), { x: 10, y: 6, z: 10 });
  assert.equal(nextPad(w, padUnder(w, b), 1), 14);
  assert.equal(nextPad(w, padUnder(w, b), -1), null);
  const lift = startLift(w, b, 1);
  let steps = 0;
  while (!stepLift(b, lift, 1 / 60)) assert.ok(++steps < 600);
  assert.equal(b.y, 14);
  assert.ok(steps / 60 > 0.8 && steps / 60 < 2, `took ${steps / 60}s`);
  settle(w, b);
  assert.equal(b.y, 14, 'stays on the pad');
  // On up to the third, and then back down to the first.
  const up = startLift(w, b, 1);
  while (!stepLift(b, up, 1 / 60));
  assert.equal(b.y, 21);
  assert.equal(startLift(w, b, 1), null, 'no pad above the top one');
  for (const to of [14, 7]) {
    const down = startLift(w, b, -1);
    while (!stepLift(b, down, 1 / 60));
    assert.equal(b.y, to);
  }
});

test('only a body standing on a pad can ride one', () => {
  const w = meadow();
  w.set(10, 6, 10, B.ELEVATOR);
  w.set(10, 13, 10, B.ELEVATOR);
  const off = makeBody(12.5, 8, 10.5);
  settle(w, off);
  assert.equal(startLift(w, off, 1), null, 'on the grass beside it');
  const flying = makeBody(10.5, 8, 10.5);
  settle(w, flying);
  flying.flying = true;
  assert.equal(startLift(w, flying, 1), null);
  const air = makeBody(10.5, 12, 10.5);
  assert.equal(startLift(w, air, 1), null, 'in the air above it');
});

test('a ride passes through blocks in the shaft and ends standing on the pad', () => {
  const w = meadow();
  w.set(10, 6, 10, B.ELEVATOR);
  for (let y = 7; y < 13; y++) w.set(10, y, 10, B.GLASS);
  w.set(10, 13, 10, B.ELEVATOR);
  const b = makeBody(10.5, 7, 10.5);
  settle(w, b);
  const lift = startLift(w, b, 1);
  while (!stepLift(b, lift, 1 / 60));
  assert.equal(b.y, 14);
  assert.ok(!bodyOverlapsSolid(w, b));
});

test('the elevator tower stamp has a pad at the bottom and one on its deck', () => {
  const w = meadow();
  const cells = stampByKey('elevator').cells;
  for (const [dx, dy, dz, id] of cells) w.set(10 + dx, 6 + dy, 10 + dz, id);
  const pads = cells.filter(([, , , id]) => id === B.ELEVATOR);
  assert.equal(pads.length, 2);
  // Walk in from the front and onto the pad, then ride up.
  const b = makeBody(10.5, 6, 8.5);
  settle(w, b);
  for (let i = 0; i < 120; i++) stepBody(w, b, { mx: 0, mz: 1 }, 1 / 60);
  assert.ok(padUnder(w, b), `at ${b.x}, ${b.y}, ${b.z}`);
  const lift = startLift(w, b, 1);
  assert.ok(lift, 'a pad above');
  while (!stepLift(b, lift, 1 / 60));
  assert.equal(b.y, 13, 'on the deck');
  assert.ok(!bodyOverlapsSolid(w, b));
});

test('riding an elevator earns a sticker', () => {
  assert.ok(STAT_KEYS.includes('lifts'));
  const earned = (lifts) => STICKERS.find((s) => s.key === 'going-up').test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'lifts' ? lifts : 0])));
  assert.ok(earned(1) && !earned(0));
});
