// Trampolines: a block that bounces a player back up when they land on it,
// higher and higher while jump is held, the bouncy castle stamp with a floor
// of them, and the sticker for bouncing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BOUNCE, MOVE, bounceSpeed, makeBody, onTrampoline, stepBody } from '../public/js/shared/physics.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { stampByKey } from '../public/js/shared/stamps.js';
import { World } from '../public/js/shared/world.js';

// Flat grass with its top at y = 5, so feet on it are at 6.
function meadow() {
  const w = new World({ W: 32, H: 48, D: 32, sea: 3 });
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

// Steps a player's body (bouncing on trampolines) for a while, at 60 frames a
// second: the top of each hop, the bounces, and the frames it stood still on
// the ground (a body just over the ground counts as on it, so one frame of
// that is only the bottom of a bounce).
function bounceAbout(w, b, input, seconds, options = { bounce: true }) {
  const peaks = [];
  let top = b.y;
  let rising = false;
  let bounces = 0;
  let standing = 0;
  let wasGround = false;
  for (let i = 0; i < seconds * 60; i++) {
    const before = b.vy;
    const ev = stepBody(w, b, input, 1 / 60, options);
    if (ev.bounced) bounces++;
    if (b.onGround && wasGround) standing++;
    wasGround = b.onGround;
    if (b.vy > 0) rising = true;
    top = Math.max(top, b.y);
    // Over the top of a hop, coming down.
    if (rising && before > 0 && b.vy <= 0) {
      peaks.push(top);
      rising = false;
    }
    if (b.vy > 0 && before <= 0) top = b.y;
  }
  return { peaks, bounces, standing };
}

test('dropped onto a trampoline, a player bounces lower and lower and then stands on it', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  const b = makeBody(10.5, 13, 10.5);
  const { peaks, bounces } = bounceAbout(w, b, {}, 8);
  assert.ok(bounces >= 3, `bounced ${bounces} times`);
  assert.ok(peaks[0] > 9 && peaks[0] < 13, `first bounce up to ${peaks[0]}, from 13`);
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] < peaks[i - 1], `each lower than the last: ${peaks.join(', ')}`);
  assert.equal(b.y, 7, 'standing on it at the end');
  assert.ok(b.onGround);
  assert.ok(onTrampoline(w, b));
});

test('a jump off a trampoline goes twice as high as one off the ground', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  const b = makeBody(10.5, 7, 10.5);
  bounceAbout(w, b, {}, 1);
  const jump = bounceAbout(w, b, { jump: true }, 0.5).peaks[0] - 7;
  assert.ok(jump > 2.6 && jump < 3.2, `up ${jump}`);
  const grass = makeBody(14.5, 6, 10.5);
  bounceAbout(w, grass, {}, 1);
  const normal = bounceAbout(w, grass, { jump: true }, 0.5).peaks[0] - 6;
  assert.ok(normal > 1.2 && normal < 1.6, `up ${normal} off the grass`);
  assert.ok(jump > normal * 1.8);
});

test('holding jump on a trampoline bounces higher each time, up to eight blocks or so and never more', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  const b = makeBody(10.5, 7, 10.5);
  bounceAbout(w, b, {}, 1);
  const { peaks, standing } = bounceAbout(w, b, { jump: true }, 20);
  const heights = peaks.map((p) => p - 7);
  assert.equal(standing, 0, 'never stops bouncing while jump is held');
  for (let i = 1; i < 4; i++) assert.ok(heights[i] > heights[i - 1] + 0.5, `higher each time: ${heights.map((h) => h.toFixed(2)).join(', ')}`);
  const most = Math.max(...heights);
  assert.ok(most > 7.5 && most < 8.8, `as high as ${most}`);
  // It gets there in a few bounces, and stays there.
  assert.ok(heights.findIndex((h) => h > most - 0.2) <= 6, heights.map((h) => h.toFixed(2)).join(', '));
  for (const h of heights.slice(-4)) assert.ok(Math.abs(h - most) < 0.2, `steady at the top: ${heights.slice(-4).join(', ')}`);
  assert.ok(Math.abs(b.x - 10.5) < 1e-9 && Math.abs(b.z - 10.5) < 1e-9, 'straight up and down');
});

test('however high it is dropped from, a bounce goes no higher than the most a trampoline gives', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  for (const input of [{}, { jump: true }]) {
    const b = makeBody(10.5, 45, 10.5);
    const ups = bounceAbout(w, b, input, 8).peaks.map((p) => p - 7);
    assert.ok(ups.length >= 3 && ups.every((h) => h < 8.8), `${JSON.stringify(input)}: ${ups.join(', ')}`);
  }
  assert.equal(bounceSpeed(MOVE.maxFall, {}), BOUNCE.max);
  assert.equal(bounceSpeed(MOVE.maxFall, { jump: true }), BOUNCE.max);
});

test('down held lands on a trampoline at once, and stays down', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  const b = makeBody(10.5, 14, 10.5);
  const { bounces } = bounceAbout(w, b, { down: true }, 2);
  assert.equal(bounces, 0);
  assert.equal(b.y, 7);
  assert.ok(b.onGround);
  // Bouncing with jump held, then down: it lands the next time it comes down.
  bounceAbout(w, b, { jump: true }, 4);
  assert.ok(!b.onGround);
  bounceAbout(w, b, { down: true }, 3);
  assert.equal(b.y, 7);
  assert.ok(b.onGround);
  assert.equal(bounceSpeed(20, { down: true, jump: true }), 0);
});

test('only a trampoline bounces, and only a player on foot', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  const grass = makeBody(14.5, 13, 10.5);
  assert.equal(bounceAbout(w, grass, {}, 2).bounces, 0, 'the grass beside it');
  assert.equal(grass.y, 6);
  // Without the bounce option (an animal, a monster) it is like any block.
  const animal = makeBody(10.5, 13, 10.5);
  assert.equal(bounceAbout(w, animal, {}, 2, {}).bounces, 0);
  assert.equal(animal.y, 7);
  const hops = bounceAbout(w, animal, { jump: true }, 3, {});
  assert.equal(hops.bounces, 0);
  assert.ok(hops.peaks.length >= 3 && hops.peaks.every((p) => p - 7 < 1.6), `jumps off it as off the ground: ${hops.peaks.join(', ')}`);
  // Flying down onto it lands you.
  const flyer = makeBody(10.5, 9, 10.5);
  flyer.flying = true;
  for (let i = 0; i < 120; i++) stepBody(w, flyer, { down: true }, 1 / 60, { bounce: true });
  assert.ok(!flyer.flying && flyer.onGround && flyer.y === 7, `at ${flyer.y}`);
  assert.equal(bounceAbout(w, flyer, {}, 1).bounces, 0);
});

test('under water a trampoline does not bounce', () => {
  const w = meadow();
  w.set(10, 6, 10, B.TRAMPOLINE);
  for (let x = 8; x <= 12; x++) for (let z = 8; z <= 12; z++) for (let y = 6; y <= 9; y++) if (w.get(x, y, z) === B.AIR) w.set(x, y, z, B.WATER);
  const b = makeBody(10.5, 9, 10.5);
  assert.equal(bounceAbout(w, b, { down: true }, 3).bounces, 0);
});

test('at the edge of a trampoline: held up by it, it bounces; standing on the grass beside it, not', () => {
  const w = meadow();
  w.set(10, 5, 10, B.TRAMPOLINE);
  // The middle over the hole beside the trampoline, the edge on it.
  w.set(11, 5, 10, B.AIR);
  w.set(11, 4, 10, B.AIR);
  const edge = makeBody(11.2, 9, 10.5);
  assert.ok(bounceAbout(w, edge, {}, 0.6).bounces >= 1, 'held up by the trampoline at its edge');
  // The middle over grass, and a bit of it over the trampoline.
  const beside = makeBody(9.8, 9, 10.5);
  assert.equal(bounceAbout(w, beside, {}, 2).bounces, 0);
  assert.equal(beside.y, 6);
  assert.ok(!onTrampoline(w, beside));
});

test('walking about on a floor of trampolines, a player only bounces when jumping', () => {
  const w = meadow();
  for (let x = 8; x <= 12; x++) for (let z = 8; z <= 12; z++) w.set(x, 5, z, B.TRAMPOLINE);
  const b = makeBody(8.5, 6, 10.5);
  assert.equal(bounceAbout(w, b, { mx: 1 }, 0.8).bounces, 0);
  assert.ok(b.x > 11 && b.onGround, `walked to ${b.x}`);
  // Bouncing along it, steered: it lands on one trampoline after another.
  const hop = makeBody(8.5, 6, 8.5);
  const run = bounceAbout(w, hop, { jump: true, mx: 0.3, mz: 0.3 }, 1.2);
  assert.ok(run.bounces >= 1);
  assert.ok(hop.x > 9.5 && hop.z > 9.5, `bounced over to ${hop.x}, ${hop.z}`);
});

test('the bouncy castle stamp has a floor of trampolines, walls round it and a way in', () => {
  const w = meadow();
  const cells = stampByKey('bouncy-castle').cells;
  for (const [dx, dy, dz, id] of cells) w.set(10 + dx, 6 + dy, 10 + dz, id);
  const floor = cells.filter(([, , , id]) => id === B.TRAMPOLINE);
  assert.ok(floor.length >= 9, `${floor.length} trampolines`);
  assert.ok(floor.every(([, dy]) => dy === 0));
  // Walk in from the front, then bounce.
  const b = makeBody(10.5, 6, 7.5);
  for (let i = 0; i < 90; i++) stepBody(w, b, { mz: 1 }, 1 / 60, { bounce: true });
  for (let i = 0; i < 120; i++) stepBody(w, b, {}, 1 / 60, { bounce: true });
  assert.ok(b.onGround && onTrampoline(w, b), `inside at ${b.x}, ${b.y}, ${b.z}`);
  const { peaks } = bounceAbout(w, b, { jump: true }, 10);
  assert.ok(Math.max(...peaks) - 7 > 7.5, 'bounces high in there');
  // A wall all round but at the way in.
  const walls = cells.filter(([, dy, , id]) => dy === 0 && id !== B.TRAMPOLINE);
  assert.ok(walls.length >= 16);
});

test('bouncing on a trampoline earns a sticker', () => {
  assert.ok(STAT_KEYS.includes('bounces'));
  const earned = (bounces) => STICKERS.find((s) => s.key === 'boing').test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'bounces' ? bounces : 0])));
  assert.ok(earned(20) && !earned(19));
});
