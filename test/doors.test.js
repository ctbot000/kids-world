// A bop-to-open Door block: a frame with a panel that fills a one-block gap
// in a wall, swung open by a bop and shut by the next one, which friends on
// the island see, and Undo takes away cleanly. It comes in three woods.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { applyCells, buildEdit, doorEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

// Flat grass with its top at y = 5, and a wall of planks two high along x = 10.
function yard() {
  const w = new World({ W: 32, H: 32, D: 32, sea: 2 });
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  for (let z = 4; z < 20; z++) for (let y = 6; y <= 7; y++) w.set(10, y, z, B.PLANKS);
  return w;
}

const onGround = (x, z) => ({ x, y: 5, z, nx: 0, ny: 1, nz: 0, id: B.GRASS });
const face = (x, y, z, nx) => ({ x, y, z, nx, ny: 0, nz: 0, id: B.PLANKS });

test('the Building tab has a door in three woods, a frame with a panel', () => {
  const building = B.blocksIn('building');
  for (const id of B.DOORS) {
    assert.ok(building.includes(id), `${B.block(id).name} is in the toy box`);
    assert.equal(B.KIND[id], B.K_FURNITURE);
    assert.equal(B.SOLID[id], 1, 'a shut door is solid, in the way of walking through it');
    assert.ok(modelBoxes(id).length > 0, `${B.block(id).key} has a model`);
  }
  assert.equal(B.DOORS.length, 3);
  // The same door swung open: not in the toy box, and nothing to bump into.
  for (const id of B.DOORS) {
    const open = B.turnedDoor(id);
    assert.ok(B.DOOR[open], 'the open door is a door too');
    assert.equal(B.DOOR_OPEN[open], 1);
    assert.equal(B.DOOR_OPEN[id], 0);
    assert.equal(B.SOLID[open], 0, 'an open door lets you walk through the gap');
    assert.equal(B.OPAQUE[open], 0);
    assert.ok(!building.includes(open), 'only the shut one is in the toy box');
    // And bopping that one shuts it again.
    assert.equal(B.turnedDoor(open), id);
  }
});

test('a door is put down facing out of the wall it fills, and undo takes it away', () => {
  const w = yard();
  // A gap in the wall, one block wide, with the door stood in it from +x.
  w.set(10, 6, 10, B.AIR);
  const { cells } = buildEdit(w, onGround(10, 10), B.DOORS[0], 1, [], 0);
  applyCells(w, cells);
  const id = w.get(10, 6, 10);
  assert.ok(B.DOOR[id], 'the door is in the gap');
  assert.equal(B.baseOf(id), B.DOORS[0]);
  // It fills its cell, so nothing else may be built in it and nothing stands
  // on it: its boxes reach from one side of the cell to the other.
  const boxes = modelBoxes(id);
  assert.ok(boxes.some((b) => b[1] === 0 && b[4] > 0.9), 'the panel reaches the floor');
  assert.ok(boxes.some((b) => b[4] === 1), 'its frame reaches the top of its cell');
});

test('a bop swings a door open, and the next bop shuts it again', () => {
  const w = yard();
  w.set(10, 6, 10, B.AIR);
  const { cells } = buildEdit(w, onGround(10, 10), B.DOORS[1], 1, [], 0);
  applyCells(w, cells);
  const id = w.get(10, 6, 10);
  // First bop: open.
  const openCells = doorEdit(w, 10, 6, 10);
  assert.deepEqual(openCells, [10, 6, 10, B.turnedDoor(id)]);
  applyCells(w, openCells);
  assert.equal(B.DOOR_OPEN[w.get(10, 6, 10)], 1, 'the door is open, and you may walk through');
  // Second bop: shut again, the same door it was.
  const shutCells = doorEdit(w, 10, 6, 10);
  assert.deepEqual(shutCells, [10, 6, 10, id]);
  applyCells(w, shutCells);
  assert.equal(w.get(10, 6, 10), id);
  // Nothing there to swing: no cells at all.
  w.set(10, 6, 10, B.PLANKS);
  assert.deepEqual(doorEdit(w, 10, 6, 10), []);
});
