// The volcano island: one theme of worldgen.js with a crater of lava in its
// mountain, lakes of lava at its foot and a sea of lava round it — never a
// drop of water or ice, which would only boil away — and the one dragon,
// asleep on the volcano and nobody's to invite or send away. Lava is swum in
// as water is, only slower (physics.js); monsters, like everyone, keep out
// of it (monsters.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { ANIMAL_TYPES, CRITTER_INFO, CritterSim } from '../public/js/shared/critters.js';
import { MonsterSim, MONSTER_KINDS } from '../public/js/shared/monsters.js';
import { makeBody, stepBody } from '../public/js/shared/physics.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';
import { World } from '../public/js/shared/world.js';

const SEEDS = [1, 7, 42, 777, 12345, 999999];

function countBlocks(world, id) {
  let n = 0;
  for (const cell of world.blocks) if (cell === id) n++;
  return n;
}
test('a volcano island can be made, with lava and basalt and never water or ice', () => {
  assert.ok(THEMES.some((t) => t.key === 'volcano'));
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'volcano' });
    assert.ok(countBlocks(world, B.LAVA) > 500, 'a sea, a crater and lakes of lava');
    assert.ok(countBlocks(world, B.BASALT) > 1000, 'volcano rock');
    assert.equal(countBlocks(world, B.WATER), 0, 'no water');
    assert.equal(countBlocks(world, B.ICE), 0, 'no ice');
  }
});

test('a volcano island rises out of a sea of lava, and its mountain holds a crater of it', () => {
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'volcano' });
    // Lava at the sea line, away from the island.
    let shore = false;
    for (let x = 0; x < world.W && !shore; x += 7) {
      if (world.get(x, world.sea, 3) === B.LAVA || world.get(x, world.sea, world.D - 4) === B.LAVA) shore = true;
    }
    assert.ok(shore, 'the sea round it is lava');
    // Lava high up the mountain, in the crater.
    let crater = false;
    for (let x = 0; x < world.W && !crater; x++) {
      for (let z = 0; z < world.D && !crater; z++) {
        for (let y = world.sea + 12; y < world.H; y++) {
          if (world.get(x, y, z) === B.LAVA) {
            crater = true;
            break;
          }
        }
      }
    }
    assert.ok(crater, 'lava in the crater');
  }
});

test('everyone arrives on solid ground, with never lava right beside the start', () => {
  for (const seed of SEEDS) {
    const { world } = generate({ seed, theme: 'volcano' });
    const { x, y, z } = world.spawn;
    assert.ok(B.SOLID[world.get(Math.floor(x), Math.floor(y) - 1, Math.floor(z))], 'stands on something solid');
    let near = false;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (world.get(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz) === B.LAVA) near = true;
        }
      }
    }
    assert.ok(!near, 'no lava within three blocks');
  }
});

test('every volcano island has exactly one dragon, asleep near the crater; no other island has any', () => {
  for (const seed of SEEDS) {
    const made = generate({ seed, theme: 'volcano' });
    const dragons = made.critters.filter((c) => c.type === 'dragon');
    assert.equal(dragons.length, 1, 'the one dragon');
    const d = dragons[0];
    assert.ok(d.y > made.world.sea + 4, 'up on the volcano');
    // Nothing else that swims or lives in the sea: the sea is lava.
    for (const c of made.critters) assert.ok(!CRITTER_INFO[c.type].sea, `${c.type} does not live in lava`);
  }
  for (const theme of ['sunny', 'snowy', 'candy']) {
    const { critters } = generate({ seed: 5, theme });
    assert.equal(critters.filter((c) => c.type === 'dragon').length, 0, `${theme} has no dragon`);
  }
});

test('the dragon is nobody’s to invite or send away: it is not even in the toy box', () => {
  assert.ok(CRITTER_INFO.dragon.wild, 'wild');
  assert.ok(!ANIMAL_TYPES.includes('dragon'), 'not among the animals to invite');
});

test('lava is swum in, as water is, and slower — and you can climb back out', () => {
  // A lava pool three deep in a stone bowl, with ground beside it.
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, B.STONE);
  for (let x = 5; x <= 9; x++) for (let z = 5; z <= 9; z++) {
    w.set(x, 5, z, B.AIR);
    w.set(x, 4, z, B.AIR);
    w.set(x, 3, z, B.AIR);
    w.set(x, 2, z, B.LAVA);
    w.set(x, 3, z, B.LAVA);
    w.set(x, 4, z, B.LAVA);
  }
  const b = makeBody(7.5, 2, 7.5);
  for (let i = 0; i < 60; i++) stepBody(w, b, { mx: 0, mz: 0 }, 1 / 30, {});
  assert.ok(b.inLava, 'in the lava');
  assert.ok(b.y > 3, `floats at the surface of it, not on the bottom (y ${b.y.toFixed(2)})`);
  // Jump kicks you up out of it, and you can climb onto the bank.
  const out = makeBody(7.5, 4.5, 7.5);
  let escaped = false;
  for (let i = 0; i < 240 && !escaped; i++) {
    stepBody(w, out, { mx: 0, mz: 1, jump: true }, 1 / 30, {});
    if (!out.inLava && out.z > 10) escaped = true;
  }
  assert.ok(escaped, `climbs out onto the bank (z ${out.z.toFixed(2)})`);
});

test('monsters keep out of the lava, and one that falls in is gone', () => {
  const w = new World({ W: 32, H: 16, D: 32, sea: 1 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
  for (let x = 10; x <= 20; x++) for (let z = 10; z <= 20; z++) {
    w.set(x, 5, z, B.AIR);
    w.set(x, 4, z, B.LAVA);
  }
  const sim = new MonsterSim(3);
  const m = sim.add(MONSTER_KINDS.indexOf('blob'), 15.5, 4, 15.5);
  assert.ok(m, 'a monster in the lava');
  for (let i = 0; i < 50; i++) sim.step(w, 0.1, i * 100, [], false, { roam: true, havens: [], camps: null });
  assert.ok(!sim.get(m.id), 'gone');
});

test('the mesher draws lava in a part of its own, like water', async () => {
  const { meshChunk } = await import('../public/js/render/mesher.js');
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200) };
  const w = new World({ W: 16, H: 16, D: 16, sea: 1, theme: 'volcano' });
  w.set(8, 5, 8, B.LAVA);
  const mesh = meshChunk(w, { skyAt: () => 15, lampAt: () => 0 }, visuals, 0, 0);
  assert.ok(mesh.lava.idx.length >= 12, 'faces of lava');
  assert.equal(mesh.water.idx.length, 0, 'and none of them counted as water');
});
