// How a blow feels: the picture jolting (render/jolt.js), and how much harder
// the heavier toy weapons knock a monster back.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Jolt } from '../public/js/render/jolt.js';
import { HIT_PUSH } from '../public/js/shared/monsters.js';
import { WEAPONS, weaponOf } from '../public/js/shared/shop.js';

const FRAME = 1 / 60;

test('a blow kicks the picture at once: the whole of it on the very next frame', () => {
  const j = new Jolt();
  assert.equal(j.moved, false, 'still until something lands');
  j.hit({ x: 0.012, y: -0.004, zoom: 0.02, roll: 0.005 });
  j.update(FRAME);
  assert.equal(j.shiftX, 0.012);
  assert.equal(j.shiftY, -0.004);
  assert.equal(j.zoom, 0.02);
  assert.equal(j.roll, 0.005);
  assert.equal(j.moved, true);
});

test('the picture springs back past where it was, and settles in about a quarter of a second', () => {
  const j = new Jolt();
  j.hit({ x: 0.02, zoom: 0.03, roll: 0.01 });
  j.update(FRAME);
  let t = 0;
  let furthest = 0;
  while (j.moved && t < 2) {
    j.update(FRAME);
    t += FRAME;
    furthest = Math.min(furthest, j.shiftX);
  }
  assert.ok(furthest < -0.0005, `past where it was: ${furthest}`);
  assert.ok(furthest > -0.01, `by less than half the kick: ${furthest}`);
  assert.ok(t < 0.75, `at rest again, every bit of it, in ${t}s`);
  assert.equal(j.shiftX, 0);
  assert.equal(j.roll, 0);
  assert.equal(j.zoom, 0);
  // And most of the way there much sooner.
  const k = new Jolt();
  k.hit({ x: 0.02 });
  k.update(FRAME);
  for (let i = 0; i < 18; i++) k.update(FRAME);
  assert.ok(Math.abs(k.x) < 0.002, `a tenth of the kick left at 0.3 s: ${k.x}`);
});

test('a frame that comes late does not throw the picture about', () => {
  const j = new Jolt();
  j.hit({ x: 0.03, y: 0.03, roll: 0.02 });
  j.update(FRAME);
  for (let i = 0; i < 20; i++) {
    j.update(0.1);
    assert.ok(Math.abs(j.x) <= 0.03 && Math.abs(j.y) <= 0.03 && Math.abs(j.roll) <= 0.02, `stays within the kick: ${j.x}`);
  }
  assert.equal(j.moved, false);
});

test('blows on top of each other add up, but never fling the picture off', () => {
  const j = new Jolt();
  j.hit({ x: 0.01 });
  j.hit({ x: 0.01 });
  assert.equal(j.x, 0.02);
  for (let i = 0; i < 50; i++) j.hit({ x: 0.03, y: -0.03, roll: 0.03, zoom: 0.05 });
  assert.ok(j.x <= 0.07 && j.y >= -0.07 && j.roll <= 0.05 && j.zoom <= 0.1);
});

test('the ground shaking rattles the picture for a moment, and dies away by itself', () => {
  const j = new Jolt();
  j.shake(0.3);
  let furthest = 0;
  let turns = 0;
  let last = 0;
  for (let i = 0; i < 12; i++) {
    j.update(FRAME);
    furthest = Math.max(furthest, Math.hypot(j.shiftX, j.shiftY));
    if (j.shiftX * last < 0) turns++;
    last = j.shiftX;
  }
  // On a screen 800 high, several pixels: a shake that can be seen.
  assert.ok(furthest * 800 > 5, `${furthest * 800} px`);
  assert.ok(turns >= 2, `to and fro: ${turns}`);
  for (let i = 0; i < 30; i++) j.update(FRAME);
  assert.equal(j.moved, false, 'over');
});

test('the heavier the weapon, the further it knocks a monster back: no weapon knocks less than an arm', () => {
  for (const w of WEAPONS) assert.ok((w.push ?? HIT_PUSH) >= HIT_PUSH - 1, w.key);
  assert.ok(weaponOf('hammer').push > weaponOf('sword').push);
  assert.ok(weaponOf('lavablade').push > weaponOf('sword').push);
  assert.ok(weaponOf('sword').push > HIT_PUSH);
});
