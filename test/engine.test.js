// The shared engine: the world and its encoding, island generation, walking
// and jumping, aiming, and what each tool does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { advanceTime, daylight, isDaytime } from '../public/js/shared/env.js';
import { BODY, bodyOverlapsSolid, makeBody, stepBody, unstick } from '../public/js/shared/physics.js';
import { raycast } from '../public/js/shared/raycast.js';
import { FACING, facingFromYaw, placeTemplate, STAMPS } from '../public/js/shared/stamps.js';
import { applyCells, buildEdit, growEdit, hillEdit, paintEdit, pickEdit, stampEdit, validCells } from '../public/js/shared/tools.js';
import { decodeBlocks, encodeBlocks, World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

// A small flat test world: magic floor, stone up to y=4, grass at y=5.
function flatWorld({ W = 32, H = 24, D = 32, ground = 5, sea = 3 } = {}) {
  const w = new World({ W, H, D, sea });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= ground; y++) w.set(x, y, z, y === ground ? B.GRASS : B.STONE);
    }
  }
  return w;
}

const hitOn = (w, x, y, z, nx = 0, ny = 1, nz = 0) => ({ x, y, z, nx, ny, nz, id: w.get(x, y, z) });

test('block ids are unique and every block has tiles', () => {
  for (const d of B.BLOCKS) {
    if (!d || d.id === B.AIR) continue;
    assert.ok(d.tiles, `${d.key} has tiles`);
    assert.equal(B.block(d.id).key, d.key);
  }
  assert.equal(B.TOY_BRICKS.length, 16);
  assert.ok(B.isReplaceable(B.TALL_GRASS));
  assert.ok(!B.isReplaceable(B.STONE));
});

test('the world encodes and decodes exactly', () => {
  const { world } = generate({ seed: 99, theme: 'sunny' });
  const data = world.encode();
  const back = World.decode(world.meta(), data);
  assert.deepEqual(back.blocks, world.blocks);
  assert.ok(data.length < 120000, `encoded island is ${data.length} characters`);
  assert.throws(() => decodeBlocks(data.slice(0, 100), world.W, world.H, world.D));
  // Unknown block ids decode as air rather than failing.
  const odd = new Uint8Array(8 * 8 * 8);
  odd[5] = 250;
  assert.equal(decodeBlocks(encodeBlocks(odd, 8, 8, 8), 8, 8, 8)[5], B.AIR);
});

test('generation is deterministic and makes a sensible island', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    const a = generate({ seed: 4242, theme });
    const b = generate({ seed: 4242, theme });
    assert.deepEqual(a.world.blocks, b.world.blocks, `${theme} is deterministic`);
    const w = a.world;
    const s = w.spawn;
    // You arrive standing on solid ground with room to stand.
    assert.ok(B.isSolid(w.get(Math.floor(s.x), s.y - 1, Math.floor(s.z))), `${theme} spawn is on the ground`);
    const body = makeBody(s.x, s.y, s.z);
    assert.ok(!bodyOverlapsSolid(w, body), `${theme} spawn is free`);
    assert.ok(a.critters.length > 5, `${theme} has animal friends`);
    // Every plant and item stands on something.
    let floating = 0;
    for (let x = 0; x < w.W; x++) {
      for (let z = 0; z < w.D; z++) {
        for (let y = 1; y < w.H; y++) {
          const id = w.get(x, y, z);
          const kind = B.KIND[id];
          if (kind === B.K_PLANT && !B.isSolid(w.get(x, y - 1, z))) floating++;
        }
      }
    }
    assert.equal(floating, 0, `${theme} has no floating plants`);
  }
  const sunny = generate({ seed: 5, theme: 'sunny' });
  const fruitCount = sunny.world.blocks.reduce((n, id) => n + (id === sunny.fruit ? 1 : 0), 0);
  assert.ok(fruitCount >= 6, `the island has its own fruit (${fruitCount})`);
});

test('a body stands on the ground, walks, bumps into walls and jumps', () => {
  const w = flatWorld();
  const b = makeBody(10.5, 8, 10.5);
  for (let i = 0; i < 60; i++) stepBody(w, b, {}, 1 / 30);
  assert.equal(b.y, 6);
  assert.ok(b.onGround);
  // Walk east for a second.
  for (let i = 0; i < 30; i++) stepBody(w, b, { mx: 1, mz: 0 }, 1 / 30);
  assert.ok(b.x > 13, `walked to ${b.x}`);
  // A wall two blocks high stops us (no auto-jump over two blocks).
  for (let z = 0; z < 32; z++) {
    w.set(16, 6, z, B.STONE);
    w.set(16, 7, z, B.STONE);
  }
  for (let i = 0; i < 90; i++) stepBody(w, b, { mx: 1, mz: 0 }, 1 / 30);
  assert.ok(b.x <= 16 - BODY.radius + 1e-3 && b.x > 15.5, `stopped at the wall: ${b.x}`);
  // Jumping gets us over one block but not two.
  const peak = { y: 0 };
  stepBody(w, b, { jump: true }, 1 / 30);
  for (let i = 0; i < 30; i++) {
    stepBody(w, b, {}, 1 / 30);
    peak.y = Math.max(peak.y, b.y);
  }
  assert.ok(peak.y > 7.2 && peak.y < 7.8, `jump peak ${peak.y}`);
});

test('auto-jump hops up a single step', () => {
  const w = flatWorld();
  for (let z = 0; z < 32; z++) for (let x = 14; x < 32; x++) w.set(x, 6, z, B.GRASS);
  const b = makeBody(10.5, 6, 10.5);
  for (let i = 0; i < 90; i++) stepBody(w, b, { mx: 1, mz: 0 }, 1 / 30);
  assert.equal(b.y, 7, 'climbed onto the step');
  assert.ok(b.x > 15);
  const c = makeBody(10.5, 6, 12.5);
  for (let i = 0; i < 90; i++) stepBody(w, c, { mx: 1, mz: 0 }, 1 / 30, { autoJump: false });
  assert.equal(c.y, 6, 'without auto-jump it stays down');
});

test('a big time step never tunnels through the floor', () => {
  const w = flatWorld();
  const b = makeBody(10.5, 20, 10.5);
  b.vy = -30;
  stepBody(w, b, {}, 0.25);
  stepBody(w, b, {}, 0.25);
  assert.ok(b.y >= 6);
  for (let i = 0; i < 10; i++) stepBody(w, b, {}, 0.25);
  assert.equal(b.y, 6);
});

test('someone built into a wall is lifted out', () => {
  const w = flatWorld();
  const b = makeBody(10.5, 6, 10.5);
  w.set(10, 6, 10, B.STONE);
  w.set(10, 7, 10, B.STONE);
  assert.ok(bodyOverlapsSolid(w, b));
  assert.ok(unstick(w, b));
  assert.equal(b.y, 8);
});

test('swimming floats up and flying goes where you steer', () => {
  const w = flatWorld({ ground: 3, sea: 8 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) for (let y = 4; y <= 8; y++) w.set(x, y, z, B.WATER);
  const b = makeBody(10.5, 4, 10.5);
  for (let i = 0; i < 120; i++) stepBody(w, b, {}, 1 / 30);
  assert.ok(b.inWater);
  assert.ok(b.y > 6.5, `floated up to ${b.y}`);
  const f = makeBody(5.5, 10, 5.5);
  f.flying = true;
  for (let i = 0; i < 30; i++) stepBody(w, f, { jump: true }, 1 / 30);
  assert.ok(f.y > 14, `flew up to ${f.y}`);
});

test('a ray finds the first block and the face it came through', () => {
  const w = flatWorld();
  const solid = (id) => B.isSolid(id);
  const down = raycast(w, 10.5, 12, 10.5, 0, -1, 0, 20, solid);
  assert.deepEqual([down.x, down.y, down.z, down.nx, down.ny, down.nz], [10, 5, 10, 0, 1, 0]);
  w.set(14, 6, 10, B.STONE);
  const side = raycast(w, 10.5, 6.5, 10.5, 1, 0, 0, 20, solid);
  assert.deepEqual([side.x, side.y, side.z, side.nx], [14, 6, 10, -1]);
  assert.equal(raycast(w, 10.5, 12, 10.5, 0, 1, 0, 20, solid), null);
  // Diagonal: agrees with stepping along the ray finely.
  for (let i = 0; i < 50; i++) {
    const dx = Math.cos(i) * 0.7;
    const dz = Math.sin(i * 1.7) * 0.7;
    const dy = -0.6;
    const hit = raycast(w, 16.2, 12.3, 16.7, dx, dy, dz, 40, solid);
    const len = Math.hypot(dx, dy, dz);
    let found = null;
    for (let t = 0; t < 40; t += 0.001) {
      const x = Math.floor(16.2 + (dx / len) * t);
      const y = Math.floor(12.3 + (dy / len) * t);
      const z = Math.floor(16.7 + (dz / len) * t);
      if (solid(w.get(x, y, z))) {
        found = [x, y, z];
        break;
      }
    }
    assert.deepEqual([hit.x, hit.y, hit.z], found);
  }
});

test('build places blocks against the face, and never inside a body', () => {
  const w = flatWorld();
  let e = buildEdit(w, hitOn(w, 10, 5, 10), B.TOY_BRICKS[0], 1);
  assert.deepEqual(e.cells, [10, 6, 10, B.TOY_BRICKS[0]]);
  e = buildEdit(w, hitOn(w, 10, 5, 10), B.TOY_BRICKS[0], 2);
  assert.equal(e.cells.length / 4, 9);
  const body = makeBody(10.5, 6, 10.5);
  e = buildEdit(w, hitOn(w, 10, 5, 10), B.STONE, 1, [body]);
  assert.deepEqual(e.cells, []);
  // Flowers go on top of ground only.
  e = buildEdit(w, hitOn(w, 10, 5, 10, 1, 0, 0), B.TULIP, 1);
  assert.deepEqual(e.cells, []);
  e = buildEdit(w, hitOn(w, 10, 5, 10), B.TULIP, 1);
  assert.deepEqual(e.cells, [10, 6, 10, B.TULIP]);
  // Building into a flower replaces the flower.
  applyCells(w, e.cells);
  e = buildEdit(w, hitOn(w, 10, 6, 10), B.PLANKS, 1);
  assert.deepEqual(e.cells, [10, 6, 10, B.PLANKS]);
});

test('pick up removes blocks, collects items, drops what they held, and never the magic floor', () => {
  const w = flatWorld();
  w.set(10, 6, 10, B.SHELL);
  w.set(11, 6, 10, B.DAISY);
  let e = pickEdit(w, hitOn(w, 10, 6, 10), 1);
  assert.deepEqual(e.cells, [10, 6, 10, B.AIR]);
  assert.deepEqual(e.collected, [B.SHELL]);
  // Removing the ground under a flower takes the flower too.
  e = pickEdit(w, hitOn(w, 11, 5, 10), 1);
  assert.equal(e.cells.length / 4, 2);
  e = pickEdit(w, hitOn(w, 5, 0, 5), 1);
  assert.deepEqual(e.cells, []);
  // A big pick-up is a ball of blocks.
  e = pickEdit(w, hitOn(w, 16, 3, 16), 3);
  assert.ok(e.cells.length / 4 > 40);
  assert.ok(validCells(w, e.cells));
});

test('digging beside the sea lets the water in', () => {
  const w = flatWorld({ ground: 5, sea: 5 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 8; z++) w.set(x, 5, z, B.WATER);
  const e = pickEdit(w, hitOn(w, 10, 5, 8), 1);
  assert.deepEqual(e.cells, [10, 5, 8, B.WATER]);
});

test('fruit falls from a tree that is taken away, into the basket', () => {
  const w = flatWorld();
  w.set(10, 6, 10, B.WOOD);
  w.set(10, 7, 10, B.LEAVES);
  w.set(11, 7, 10, B.FRUIT_ITEMS[0]);
  const e = pickEdit(w, hitOn(w, 10, 7, 10), 1);
  assert.deepEqual(e.collected, [B.FRUIT_ITEMS[0]]);
});

test('paint swaps blocks for another kind', () => {
  const w = flatWorld();
  const e = paintEdit(w, hitOn(w, 10, 5, 10), B.TOY_BRICKS[3], 2);
  assert.equal(e.cells.length / 4, 9);
  for (let i = 3; i < e.cells.length; i += 4) assert.equal(e.cells[i], B.TOY_BRICKS[3]);
  assert.deepEqual(paintEdit(w, hitOn(w, 10, 5, 10), B.TULIP, 1).cells, []);
});

test('hills raise, lower and flatten the ground', () => {
  const w = flatWorld();
  let e = hillEdit(w, hitOn(w, 16, 5, 16), 'raise', 3);
  applyCells(w, e.cells);
  assert.equal(w.top(16, 16), 8, 'the middle rose by three');
  assert.equal(w.get(16, 8, 16), B.GRASS);
  assert.equal(w.get(16, 5, 16), B.DIRT);
  e = hillEdit(w, hitOn(w, 16, 8, 16), 'lower', 3);
  applyCells(w, e.cells);
  assert.equal(w.top(16, 16), 5);
  applyCells(w, hillEdit(w, hitOn(w, 16, 5, 16), 'raise', 3).cells);
  e = hillEdit(w, hitOn(w, 16, 5, 16), 'flat', 3);
  applyCells(w, e.cells);
  for (let x = 12; x <= 20; x++) assert.equal(w.top(x, 16), 5);
});

test('stamps land facing the builder', () => {
  assert.equal(facingFromYaw(0), 2);
  assert.equal(facingFromYaw(Math.PI), 0);
  assert.equal(facingFromYaw(-Math.PI / 2), 1);
  for (let f = 0; f < 4; f++) {
    const { f: fw, r } = FACING[f];
    // Right is forward turned clockwise seen from above: (fx, fz) -> (-fz, fx).
    assert.deepEqual([r[0], r[1]], [-fw[1] || 0, fw[0] || 0].map((v) => v || 0));
  }
  const w = flatWorld({ W: 48, D: 48 });
  for (const s of STAMPS) {
    for (let f = 0; f < 4; f++) {
      const e = stampEdit(w, hitOn(w, 24, 5, 24), s.key, f);
      assert.ok(e.cells.length > 0, `${s.key} places something`);
      assert.ok(validCells(w, e.cells), `${s.key} fits`);
    }
  }
  // The house door faces the builder: with facing 0 (looking +z) the door is on the -z side.
  const house = placeTemplate(STAMPS[0].cells, 24, 6, 24, 0);
  const door = house.filter(([x, y, z, id]) => x === 24 && y === 7 && id === B.AIR);
  assert.ok(door.some(([, , z]) => z === 24));
});

test('sprouts grow into trees', () => {
  const w = flatWorld();
  w.set(10, 6, 10, B.FRUIT_SPROUTS[0]);
  const cells = growEdit(w, 10, 6, 10, 123);
  applyCells(w, cells);
  assert.equal(w.get(10, 6, 10), B.WOOD);
  let fruit = 0;
  for (let i = 3; i < cells.length; i += 4) if (cells[i] === B.FRUIT_ITEMS[0]) fruit++;
  assert.ok(fruit >= 1, 'the tree has fruit');
  assert.deepEqual(growEdit(w, 10, 6, 10, 1), []);
});

test('the host rejects edits outside the world or touching the magic floor', () => {
  const w = flatWorld();
  assert.equal(validCells(w, [0, 0, 0, B.STONE]), null);
  assert.equal(validCells(w, [-1, 5, 0, B.STONE]), null);
  assert.equal(validCells(w, [1, 5, 1, 999]), null);
  assert.equal(validCells(w, [1, 5, 1, B.MAGIC_FLOOR]), null);
  assert.equal(validCells(w, [1, 5, 1]), null);
  assert.deepEqual(validCells(w, [1, 5, 1, B.STONE]), [1, 5, 1, B.STONE]);
});

test('days are long and nights are short', () => {
  let t = 0.25;
  let secs = 0;
  while (isDaytime(t)) {
    t = advanceTime(t, 1);
    secs++;
  }
  assert.ok(Math.abs(secs - 14 * 60) <= 1, `day lasted ${secs}s`);
  const start = t;
  secs = 0;
  while (!isDaytime(t)) {
    t = advanceTime(t, 1);
    secs++;
  }
  assert.ok(Math.abs(secs - 4 * 60) <= 1, `night lasted ${secs}s from ${start}`);
  assert.equal(daylight(0.5), 1);
  assert.equal(daylight(0), 0);
  assert.equal(advanceTime(0.6, 100, 'day'), 0.42);
});
