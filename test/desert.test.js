// The desert island: one more kind of island (worldgen.js), rolling golden
// dunes of sand with cacti dotted over them, and a small oasis pool ringed
// with palm trees. Its sea is water like any other's, so crabs and turtles
// keep its sandy shore as they do the beach's, and everything else about it —
// building, digging, planting, stamps — is as on any island.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { seaCounts } from '../public/js/shared/critters.js';
import { cactus, palmTree, STAMPS } from '../public/js/shared/stamps.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';
import { Rng } from '../public/js/shared/rng.js';

const SEEDS = [1, 7, 42, 777, 12345, 999999];

function countBlocks(world, id) {
  let n = 0;
  for (const cell of world.blocks) if (cell === id) n++;
  return n;
}

// A desert island: its sea is water, its shore sand, so crabs and turtles
// keep it as they do the beach of any island.

test('a desert island can be made, of golden sand with cacti and palms', () => {
  assert.ok(THEMES.some((t) => t.key === 'desert'), 'a choice in Make an island');
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'desert' });
    assert.equal(world.theme, 'desert');
    assert.ok(countBlocks(world, B.SAND) > 3000, 'golden dunes');
    assert.ok(countBlocks(world, B.CACTUS) > 10, 'cacti over the dunes');
    assert.ok(countBlocks(world, B.PALM_LEAVES) > 10, 'palms');
    assert.equal(countBlocks(world, B.SNOW), 0, 'no snow on a desert island');
  }
});

test('a desert island is sand all over: no grass, dirt or snow anywhere on it', () => {
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'desert' });
    assert.equal(countBlocks(world, B.GRASS), 0, 'no grass');
    assert.equal(countBlocks(world, B.DIRT), 0, 'no dirt');
    assert.equal(countBlocks(world, B.SNOW), 0, 'no snow');
  }
});

test('every desert island has an oasis: a pool ringed with palm trees', () => {
  for (const seed of SEEDS) {
    const made = generate({ seed, theme: 'desert' });
    const { world } = made;
    // The one pool: water standing above the sea line, apart from the sea.
    const pools = [];
    for (let x = 2; x < world.W - 2; x++) {
      for (let z = 2; z < world.D - 2; z++) {
        let pool = false;
        for (let y = world.sea + 1; y <= world.sea + 8 && !pool; y++) if (world.get(x, y, z) === B.WATER) pool = true;
        if (!pool) continue;
        if (pools.some((p) => Math.hypot(p.x - x, p.z - z) < 12)) continue;
        pools.push({ x, z });
      }
    }
    assert.ok(pools.length >= 1, 'an oasis pool');
    // Palms round it, on the sand.
    let palms = 0;
    for (const pool of pools) {
      for (let dx = -8; dx <= 8; dx++) {
        for (let dz = -8; dz <= 8; dz++) {
          const x = Math.floor(pool.x) + dx;
          const z = Math.floor(pool.z) + dz;
          for (let y = world.sea + 1; y < world.sea + 12; y++) if (world.get(x, y, z) === B.PALM_LEAVES) {
            palms++;
            break;
          }
        }
      }
    }
    assert.ok(palms >= 6, 'palms ring the oasis');
  }
});

test('crabs and turtles wander a desert island\u2019s shore', () => {
  assert.equal(seaCounts('desert').crab > 0, true);
  assert.equal(seaCounts('desert').turtle > 0, true);
  for (const seed of SEEDS.slice(0, 3)) {
    const { critters } = generate({ seed, theme: 'desert' });
    assert.ok(critters.some((c) => c.type === 'crab'), 'crabs');
    assert.ok(critters.some((c) => c.type === 'turtle'), 'turtles');
  }
});

test('everyone arrives on solid sand, not in a cactus or the oasis', () => {
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'desert' });
    const { x, y, z } = world.spawn;
    assert.ok(B.SOLID[world.get(Math.floor(x), Math.floor(y) - 1, Math.floor(z))], 'stands on something solid');
    assert.equal(world.get(Math.floor(x), Math.floor(y), Math.floor(z)), B.AIR, 'nothing where they stand');
  }
});

test('the cactus and the palm tree are stamps in the toy box, and every block they use is in it', () => {
  const cactusStamp = STAMPS.find((s) => s.key === 'cactus');
  const palmStamp = STAMPS.find((s) => s.key === 'palm');
  assert.ok(cactusStamp, 'a cactus stamp');
  assert.ok(palmStamp, 'a palm stamp');
  assert.ok(cactusStamp.cells.every(([, , , id]) => id === B.CACTUS), 'a cactus is all cactus blocks');
  assert.ok(palmStamp.cells.some(([, , , id]) => id === B.WOOD), 'a palm has a trunk');
  assert.ok(palmStamp.cells.some(([, , , id]) => id === B.PALM_LEAVES), 'a palm has a crown of fronds');
  // Both stand on the ground: their lowest cells are at dy 0.
  assert.equal(Math.min(...cactusStamp.cells.map(([, dy]) => dy)), 0);
  assert.equal(Math.min(...palmStamp.cells.map(([, dy]) => dy)), 0);
  // And the blocks they are made of are in the Nature tab to build with.
  for (const id of [B.CACTUS, B.PALM_LEAVES]) assert.equal(B.BLOCKS[id].category, 'nature');
});

test('a cactus and a palm are the shapes worldgen stamps them from', () => {
  const rng = new Rng(5);
  const c = cactus(rng);
  assert.ok(c.length >= 3, 'a column with perhaps an arm');
  assert.ok(c.some(([, dy]) => dy >= 2), 'at least three blocks tall');
  const p = palmTree(rng);
  assert.ok(p.some(([, dy]) => dy >= 5), 'a palm climbs above you');
  assert.ok(p.filter(([, , , id]) => id === B.PALM_LEAVES).length >= 9, 'a broad crown of fronds');
});
