// Jewels: hidden in the deep rock and in the walls of a mine into each
// mountain, dug out by any tool into the basket, never made from nothing,
// given to islands from before them, and counted for stickers and the ranking.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BOARDS } from '../public/js/shared/ranking.js';
import { Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { applyCells, hillEdit, paintEdit, pickEdit, stampEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const SIDES = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const ROCKY = (id) => B.TERRAIN[id] || id === B.MAGIC_FLOOR;
const buried = (w, x, y, z) => SIDES.every(([a, b, c]) => ROCKY(w.get(x + a, y + b, z + c)));

function gemRocks(w) {
  const out = [];
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 1; y < w.H; y++) if (B.GEM_ROCK[w.get(x, y, z)]) out.push([x, y, z]);
  return out;
}

const hitOn = (w, x, y, z) => ({ x, y, z, nx: 0, ny: 1, nz: 0, id: w.get(x, y, z) });

// Stone up to y = 5, with a ruby rock as the top block in the middle.
function rockyWorld() {
  const w = new World({ W: 32, H: 24, D: 32, sea: 2 });
  for (let x = 0; x < w.W; x++) {
    for (let z = 0; z < w.D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, B.STONE);
    }
  }
  w.set(16, 5, 16, B.GEM_ROCKS[0]);
  return w;
}

test('jewels and gems are blocks of their own, kept in the basket, and not in the toy box', () => {
  assert.equal(B.GEMS.length, 5);
  for (const [i, [key]] of B.GEMS.entries()) {
    const rock = B.block(B.GEM_ROCKS[i]);
    const jewel = B.block(B.GEM_ITEMS[i]);
    assert.equal(rock.collect, key);
    assert.equal(jewel.collect, key);
    assert.ok(rock.solid && B.TERRAIN[rock.id] && !rock.category, `${rock.key} is natural rock nobody can build with`);
    assert.equal(jewel.kind, 'item');
    assert.equal(B.COLLECTABLES.find((c) => c.key === key)?.item, jewel.id, `${key} goes in the basket and is put down as a jewel`);
  }
});

test('every island with mountains has a mine into one, lit, with jewels in its walls and a diamond at the end', () => {
  for (const theme of ['sunny', 'snowy', 'candy']) {
    for (const size of ['small', 'big']) {
      for (const seed of [4242, 1, 77]) {
        const where = `${theme} ${size} ${seed}`;
        const { world: w, mines } = generate({ seed, theme, size });
        assert.ok(mines.length >= (size === 'small' ? 1 : 2), `${where}: mines (${mines.length})`);
        for (const m of mines) {
          // A clear way in, from outside (two steps out from its foot) up to
          // the doorway, on a path from the foot on.
          for (const [i, { x, z }] of m.way.entries()) {
            for (let y = m.y; y < m.y + 3; y++) assert.ok(!B.SOLID[w.get(x, y, z)], `${where}: the way into the mine at ${x},${y},${z} is open`);
            if (i >= 2) assert.equal(w.get(x, m.y - 1, z), B.PEBBLES, `${where}: a path on the way in at ${x},${z}`);
          }
          // A wooden doorway, rock over the tunnel, and lamps and jewels within.
          assert.equal(w.get(m.x, m.y + 3, m.z), B.PLANKS, `${where}: a doorway`);
          let lamps = 0;
          let jewels = 0;
          let diamonds = 0;
          for (let x = m.x - 24; x <= m.x + 24; x++) {
            for (let z = m.z - 24; z <= m.z + 24; z++) {
              for (let y = m.y - 1; y <= m.y + 5; y++) {
                const id = w.get(x, y, z);
                const open = SIDES.some(([a, b, c]) => w.get(x + a, y + b, z + c) === B.AIR);
                if (id === B.LAMP) lamps++;
                if (B.GEM_ROCK[id] && open) jewels++;
                if (id === B.DIAMOND_ROCK && open) diamonds++;
              }
            }
          }
          assert.ok(lamps >= 2, `${where}: lamps in the mine (${lamps})`);
          assert.ok(jewels >= 8, `${where}: jewels to see in the mine (${jewels})`);
          assert.ok(diamonds >= 1, `${where}: a diamond`);
        }
      }
    }
  }
});

test('jewels hide deep in the rock all over an island, on Flat Land too, more on a bigger one', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    const { world: w, mines } = generate({ seed: 4242, theme });
    const rocks = gemRocks(w);
    const hidden = rocks.filter(([x, y, z]) => buried(w, x, y, z));
    assert.ok(hidden.length > 250, `${theme}: jewels buried (${hidden.length})`);
    for (const [x, y, z] of rocks) {
      if (buried(w, x, y, z)) continue;
      // Any to be seen are in a mine, or out on a stony mountain top.
      const inMine = mines.some((m) => Math.hypot(x - m.x, z - m.z) < 30 && Math.abs(y - m.y) < 7);
      assert.ok(inMine || (y > w.sea + 12 && w.get(x, y + 1, z) === B.AIR), `${theme}: a jewel out in the open at ${x},${y},${z}`);
    }
    if (theme === 'flat') assert.equal(hidden.length, rocks.length, 'nothing to see on Flat Land');
    const kinds = new Set(rocks.map(([x, y, z]) => w.get(x, y, z)));
    assert.equal(kinds.size, 5, `${theme}: every kind of jewel`);
  }
  const small = gemRocks(generate({ seed: 7, theme: 'sunny', size: 'small' }).world).length;
  const huge = gemRocks(generate({ seed: 7, theme: 'sunny', size: 'huge' }).world).length;
  assert.ok(huge > small * 3, `a huge island has more (${small}, ${huge})`);
});

test('digging a gem rock out, with any tool, puts its jewel in the basket and never makes one', () => {
  // Picked up.
  let w = rockyWorld();
  let e = pickEdit(w, hitOn(w, 16, 5, 16), 1);
  assert.deepEqual(e.collected, [B.GEM_ROCKS[0]]);
  assert.deepEqual(e.cells, [16, 5, 16, B.AIR]);
  // Dug with the hills tool.
  e = hillEdit(w, hitOn(w, 16, 5, 16), 'lower', 1);
  assert.deepEqual(e.collected, [B.GEM_ROCKS[0]]);
  // Raised: the land grows as stone, and the jewel is dug out, not copied.
  e = hillEdit(w, hitOn(w, 16, 5, 16), 'raise', 3);
  applyCells(w, e.cells);
  assert.deepEqual(e.collected, [B.GEM_ROCKS[0]]);
  assert.equal(gemRocks(w).length, 0, 'no new gem rocks');
  // Flattened from above, with a buried one in the way.
  w = rockyWorld();
  w.set(16, 4, 16, B.GEM_ROCKS[3]);
  e = hillEdit(w, hitOn(w, 16, 3, 16), 'flat', 1);
  assert.deepEqual(e.collected.sort(), [B.GEM_ROCKS[0], B.GEM_ROCKS[3]].sort());
  // A stamp put down over one.
  w = rockyWorld();
  e = stampEdit(w, hitOn(w, 16, 4, 16), 'house', 0);
  assert.ok(e.cells.length > 0);
  assert.deepEqual(e.collected, [B.GEM_ROCKS[0]]);
  // Paint goes round it.
  w = rockyWorld();
  e = paintEdit(w, hitOn(w, 16, 5, 16), B.TOY_BRICKS[0], 2);
  for (let i = 0; i < e.cells.length; i += 4) assert.ok(!(e.cells[i] === 16 && e.cells[i + 2] === 16), 'the gem rock is not painted');
  assert.ok(e.cells.length > 0);
});

test('an island from before jewels gets them, once, deep in the rock, changing nothing anyone can see', () => {
  const room = new Room({ code: '123456', theme: 'sunny', seed: 4242, now: () => 1000 });
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  assert.equal(save.v, 9);
  // The same island without any: as if made before there were jewels.
  const old = World.decode(save.meta, save.blocks);
  for (const [x, y, z] of gemRocks(old)) old.set(x, y, z, B.STONE);
  const before = { ...save, v: 5, blocks: old.encode() };
  const load = (s) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(s)), now: () => 2000 });
  const given = load(before);
  const now = gemRocks(given.world);
  assert.ok(now.length > 250, `jewels given (${now.length})`);
  for (const [x, y, z] of now) {
    assert.equal(old.get(x, y, z), B.STONE, 'only in stone');
    assert.ok(buried(given.world, x, y, z), `buried at ${x},${y},${z}`);
  }
  // Saved again, it has them, and gets no more.
  const again = load(given.exportSave());
  assert.equal(gemRocks(again.world).length, now.length);
  // And a new island keeps the ones it was made with.
  assert.equal(gemRocks(load(save).world).length, gemRocks(room.world).length);
});

test('jewels count for stickers and the treasures board', () => {
  assert.ok(STAT_KEYS.includes('gems') && STAT_KEYS.includes('diamonds'));
  const miner = STICKERS.find((s) => s.key === 'gem-miner');
  const diamond = STICKERS.find((s) => s.key === 'diamond');
  assert.ok(!miner.test({ gems: 9 }) && miner.test({ gems: 10 }));
  assert.ok(!diamond.test({ diamonds: 0 }) && diamond.test({ diamonds: 1 }));
  const treasures = BOARDS.find((b) => b.key === 'treasures');
  assert.equal(treasures.score({ stats: { fruit: 2, shells: 1, stars: 1, gems: 3 } }), 7);
});
