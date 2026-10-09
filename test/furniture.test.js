// Interior design: floors, wallpaper and furniture in the Home tab of the
// toy box. Furniture turns to face whoever puts it down (a picture faces out
// from its wall), turns with a stamp, joins up with the same piece beside
// it, is drawn as boxes inside its cell, and counts for a sticker.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { furnitureBoxes, modelBoxes } from '../public/js/shared/furniture.js';
import { LightMap } from '../public/js/shared/light.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { meshChunk } from '../public/js/render/mesher.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { applyCells, buildEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

// Flat grass with its top at y = 5.
function meadow() {
  const w = new World({ W: 32, H: 32, D: 32, sea: 2 });
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

const onTop = (x, z) => ({ x, y: 5, z, nx: 0, ny: 1, nz: 0, id: B.GRASS });

test('the Home tab has floors, wallpaper and one of each piece of furniture', () => {
  assert.ok(B.CATEGORIES.some((c) => c.key === 'home'));
  const home = B.blocksIn('home');
  for (const id of [B.CHAIR, B.SOFA, B.BED, B.BOOKSHELF, B.COUNTER, B.STOVE, B.FRIDGE, B.TV, B.FIREPLACE, B.PICTURE, B.TABLE, B.FLOOR_LAMP, B.POTTED_PLANT, B.PARQUET, B.CHECKER_FLOOR, ...B.CARPETS, ...B.WALLPAPERS]) {
    assert.ok(home.includes(id), B.block(id).name);
  }
  // Only the first of a turned piece's four blocks is in the toy box.
  assert.ok(!home.includes(B.CHAIR + 1));
  for (const id of B.FURNITURE) {
    assert.equal(B.KIND[id], B.K_FURNITURE);
    assert.equal(B.OPAQUE[id], 0, `${B.block(id).key} lets light past`);
    assert.ok(modelBoxes(id).length > 0, `${B.block(id).key} has a model`);
    assert.equal(B.baseOf(id), B.block(id).base);
  }
  assert.equal(B.SOLID[B.SOFA], 1);
  assert.equal(B.SOLID[B.PICTURE], 0);
  assert.ok(B.block(B.FIREPLACE + 2).light > 0 && B.block(B.FLOOR_LAMP).light > 0);
});

test('furniture turns to face the builder, and a picture faces out from its wall', () => {
  const w = meadow();
  // Looking towards +z (facing 0) the chair's front faces -z, back at you.
  for (const [facing, front] of [
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
  ]) {
    const { cells } = buildEdit(w, onTop(10, 10), B.CHAIR, 1, [], facing);
    assert.equal(B.block(cells[3]).front, front, `facing ${facing}`);
    assert.equal(B.baseOf(cells[3]), B.CHAIR);
  }
  // A table does not turn.
  assert.equal(buildEdit(w, onTop(10, 10), B.TABLE, 1, [], 1).cells[3], B.TABLE);
  // Against the +x side of a wall, a picture faces +x, wherever you look.
  w.set(10, 6, 10, B.PLANKS);
  const side = { x: 10, y: 6, z: 10, nx: 1, ny: 0, nz: 0, id: B.PLANKS };
  const { cells } = buildEdit(w, side, B.PICTURE, 1, [], 0);
  assert.deepEqual(cells.slice(0, 3), [11, 6, 10]);
  assert.equal(B.block(cells[3]).front, 0);
});

test('a stamp turns its furniture with it', () => {
  const cells = [[0, 0, 0, B.CHAIR]];
  // The template's chair faces -z, back at the builder; so it does in the world.
  for (let facing = 0; facing < 4; facing++) {
    const [[, , , id]] = placeTemplate(cells, 0, 0, 0, facing);
    assert.equal(B.block(id).front, (3 - facing + 4) % 4, `facing ${facing}`);
  }
  // The Cozy House comes furnished.
  const house = stampByKey('house').cells.map(([, , , id]) => id);
  for (const id of [B.BED, B.TABLE, B.BOOKSHELF, B.CHAIR]) assert.ok(house.includes(id), B.block(id).name);
});

test('sofas side by side join into one long sofa, and beds one behind the other into one bed', () => {
  const w = meadow();
  const arms = (x) => furnitureBoxes(w.get(x, 6, 10), x, 6, 10, (a, b, c) => w.get(a, b, c)).filter((b) => b[4] - b[1] > 0 && b[1] === 6.42 && b[4] === 6.7).length;
  w.set(10, 6, 10, B.SOFA);
  assert.equal(arms(10), 2, 'a lone sofa has two arms');
  w.set(11, 6, 10, B.SOFA);
  assert.equal(arms(10) + arms(11), 2, 'two side by side have an arm at each end');
  // A sofa facing another way does not join.
  w.set(11, 6, 10, B.turnedTo(B.SOFA, 1));
  assert.equal(arms(10), 2);
  // Beds facing -z: the one at the back has the headboard.
  const tall = (z) => furnitureBoxes(w.get(20, 6, z), 20, 6, z, (a, b, c) => w.get(a, b, c)).some((b) => b[4] - 6 > 0.9);
  w.set(20, 6, 10, B.BED);
  w.set(20, 6, 11, B.BED);
  assert.equal(tall(10), false);
  assert.equal(tall(11), true);
  // Every box stays in its cell, however it is turned.
  for (let front = 0; front < 4; front++) {
    for (const [x0, , z0, x1, , z1] of furnitureBoxes(B.turnedTo(B.BOOKSHELF, front), 5, 6, 5, () => B.AIR)) {
      assert.ok(x0 >= 5 && x1 <= 6 && z0 >= 5 && z1 <= 6 && x0 < x1 && z0 < z1);
    }
  }
  // A bookshelf's back is against the wall behind it: +x when it faces -x.
  const back = furnitureBoxes(B.turnedTo(B.BOOKSHELF, 2), 5, 6, 5, () => B.AIR)[0];
  assert.ok(back[3] === 6 && back[0] > 5.9);
});

test('furniture is drawn as boxes, lit by its cell, and the ground under it still shows', () => {
  const w = meadow();
  const visuals = { faceLayer: new Int16Array(256 * 3), tint: new Uint8Array(256 * 3).fill(255), studTint: new Uint8Array(256 * 3).fill(200), layers: new Map([['plain', 3]]) };
  const light = () => {
    const l = new LightMap(w);
    l.computeAll();
    return l;
  };
  const before = meshChunk(w, light(), visuals, 0, 0).opaque.verts;
  w.set(4, 6, 4, B.TABLE);
  const mesh = meshChunk(w, light(), visuals, 0, 0);
  // Top and four legs, six faces of four corners each.
  assert.equal(mesh.opaque.verts - before, 5 * 6 * 4);
  // The grass under it was not hidden, nor its stud: a table is not opaque.
  assert.equal(B.OPAQUE[B.TABLE], 0);
  // A lamp lights the room round it.
  w.set(8, 6, 8, B.FLOOR_LAMP);
  assert.ok(light().lampAt(9, 6, 8) > 10);
});

test('ten pieces of furniture earn Home Sweet Home, and each one XP', () => {
  assert.ok(STAT_KEYS.includes('furnished'));
  assert.ok(XP_FOR.furnished.xp > 0);
  const earned = (n) => STICKERS.find((s) => s.key === 'home-sweet-home').test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'furnished' ? n : 0])));
  assert.equal(earned(9), false);
  assert.equal(earned(10), true);
});

test('a build into a room stays put after the edit is applied', () => {
  const w = meadow();
  const { cells } = buildEdit(w, onTop(3, 3), B.SOFA, 1, [], 2);
  applyCells(w, cells);
  assert.equal(B.baseOf(w.get(3, 6, 3)), B.SOFA);
  assert.equal(B.block(w.get(3, 6, 3)).front, 1);
});

test('a seat beside you is found, you sit facing the way it faces, lie in bed from its foot, and stand up in front of it', async () => {
  const { seatNear, seatPose, standUpAt } = await import('../public/js/shared/seats.js');
  const w = meadow();
  // A chair facing +z, and you standing in front of it.
  w.set(10, 6, 10, B.turnedTo(B.CHAIR, 1));
  assert.deepEqual(seatNear(w, { x: 10.5, y: 6, z: 11.6 }), { x: 10, y: 6, z: 10 });
  assert.equal(seatNear(w, { x: 10.5, y: 6, z: 13.5 }), null, 'too far away');
  const sit = seatPose(w, 10, 6, 10);
  assert.equal(sit.pose, 'sit');
  assert.ok(sit.y > 6.4 && sit.y < 6.7, `on the seat: ${sit.y}`);
  // Facing +z: an avatar facing +z has yaw 0, and sits back from the front.
  assert.ok(Math.abs(sit.yaw) < 1e-9);
  assert.ok(sit.z < 10.5 && sit.z > 10.4);
  assert.deepEqual(standUpAt(w, 10, 6, 10), { x: 10.5, y: 6, z: 11.5 }, 'up in front of it');
  // With a wall in front, beside it.
  w.set(10, 6, 11, B.PLANKS);
  const up = standUpAt(w, 10, 6, 10);
  assert.equal(up.y, 6);
  assert.notDeepEqual([up.x, up.z], [10.5, 11.5]);
  // A table is not a seat.
  w.set(12, 6, 10, B.TABLE);
  assert.equal(seatPose(w, 12, 6, 10), null);
  // A bed two long facing -z: lying from the front one, whichever is picked.
  w.set(20, 6, 10, B.BED);
  w.set(20, 6, 11, B.BED);
  for (const z of [10, 11]) {
    const lie = seatPose(w, 20, 6, z);
    assert.equal(lie.pose, 'lie');
    assert.ok(lie.z > 10 && lie.z < 10.3, `feet at the foot: ${lie.z}`);
    assert.ok(Math.abs(Math.abs(lie.yaw) - Math.PI) < 1e-9, 'facing -z, head to +z');
  }
});

test('sitting down earns Comfy Spot', () => {
  assert.ok(STAT_KEYS.includes('sat') && XP_FOR.sat.xp > 0);
  const sticker = STICKERS.find((s) => s.key === 'comfy');
  assert.equal(sticker.test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'sat' ? 1 : 0]))), true);
});
