// A bop-to-open Door block: a frame with a panel that fills a one-block gap
// in a wall, swung open by a bop and shut by the next one, which friends on
// the island see, and Undo takes away cleanly. It comes in three woods.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { furnitureBoxes, modelBoxes } from '../public/js/shared/furniture.js';
import { applyCells, buildEdit, doorEdit, pickEdit } from '../public/js/shared/tools.js';
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

test('two doors of one kind stacked one above the other are one tall door', () => {
  const w = yard();
  for (const y of [6, 7]) w.set(10, y, 10, B.AIR);
  // Two Oak doors, one above the other, facing the same way.
  w.set(10, 6, 10, B.DOORS[0]);
  w.set(10, 7, 10, B.DOORS[0]);
  const boxes = (y) => furnitureBoxes(w.get(10, y, 10), 10, y, 10, (a, b, c) => w.get(a, b, c));
  // The bottom half leaves the gap between the two open: nothing across the
  // top of its cell, and its panel runs on up into the half above. The top
  // half keeps the head of the whole tall door.
  const lintel = (y) => boxes(y).filter((b) => b[4] - y > 0.85 && b[4] - b[1] < 0.3);
  assert.equal(lintel(6).length, 0, 'no lintel across the bottom half');
  assert.equal(lintel(7).length, 1, 'the top half keeps the head of the door');
  assert.ok(boxes(6).some((b) => b[4] - 6 === 1), 'the bottom half reaches the top of its cell');
  // The handle is on the bottom half only, at hand height.
  const handles = (y) => boxes(y).filter((b) => b[7] === 'plain' && b[6] === '#f5c542');
  assert.equal(handles(6).length, 1);
  assert.equal(handles(7).length, 0);
  // Different kinds, or doors side by side, do not join: each keeps its lintel.
  w.set(10, 7, 10, B.DOORS[1]);
  assert.ok(lintel(7).length === 1 && lintel(6).length === 1, 'a different kind above does not join');
  w.set(10, 7, 10, B.DOORS[0]);
  w.set(9, 6, 10, B.DOORS[0]);
  const beside = furnitureBoxes(w.get(9, 6, 10), 9, 6, 10, (a, b, c) => w.get(a, b, c));
  assert.equal(beside.filter((b) => b[4] - 6 > 0.85 && b[4] - b[1] < 0.3).length, 1, 'a door beside it does not join');
});

test('a bop on either half swings the whole tall door, open and shut again', () => {
  const w = yard();
  for (const y of [6, 7]) w.set(10, y, 10, B.AIR);
  w.set(10, 6, 10, B.DOORS[0]);
  w.set(10, 7, 10, B.DOORS[0]);
  // A bop on the top half swings both.
  const openCells = doorEdit(w, 10, 7, 10);
  assert.equal(openCells.length, 8, 'both halves swing');
  applyCells(w, openCells);
  assert.equal(B.DOOR_OPEN[w.get(10, 6, 10)], 1);
  assert.equal(B.DOOR_OPEN[w.get(10, 7, 10)], 1, 'you may walk through either half');
  // A bop on the bottom half shuts both again, back to the doors they were.
  const shutCells = doorEdit(w, 10, 6, 10);
  applyCells(w, shutCells);
  assert.equal(w.get(10, 6, 10), B.DOORS[0]);
  assert.equal(w.get(10, 7, 10), B.DOORS[0]);
  // A door of another kind above swings alone.
  w.set(10, 7, 10, B.DOORS[1]);
  assert.deepEqual(doorEdit(w, 10, 6, 10), [10, 6, 10, B.turnedDoor(B.DOORS[0])]);
});

test('a tall door comes away whole when picked up', () => {
  const w = yard();
  for (const y of [6, 7]) w.set(10, y, 10, B.AIR);
  w.set(10, 6, 10, B.DOORS[0]);
  w.set(10, 7, 10, B.DOORS[0]);
  // Picking up either half takes both.
  const plan = pickEdit(w, { x: 10, y: 7, z: 10, nx: 0, ny: 0, nz: 1, id: B.DOORS[0] });
  assert.deepEqual(plan.cells, [10, 7, 10, B.AIR, 10, 6, 10, B.AIR]);
  // A door of another kind above stays put when the lower one is picked up.
  applyCells(w, plan.cells);
  w.set(10, 6, 10, B.DOORS[0]);
  w.set(10, 7, 10, B.DOORS[1]);
  const lone = pickEdit(w, { x: 10, y: 6, z: 10, nx: 0, ny: 0, nz: 1, id: B.DOORS[0] });
  assert.deepEqual(lone.cells, [10, 6, 10, B.AIR]);
});

test('a friend may bop a door where only the owner builds, but not make it another door', () => {
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  const conn = () => {
    const c = { inbox: [] };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    c.close = () => {};
    return c;
  };
  const join = (name) => {
    const c = conn();
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
    return c;
  };
  const owner = join('Happy Panda');
  const friend = join('Brave Otter');
  room.receive(owner, { t: 'host', cmd: 'settings', settings: { build: 'host' } });
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 3;
  const z = Math.floor(w.spawn.z) + 3;
  const y = w.top(x, z) + 1;
  room.receive(owner, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.DOORS[0]] });
  assert.equal(w.get(x, y, z), B.DOORS[0]);
  const open = B.turnedDoor(B.DOORS[0]);
  room.receive(friend, { t: 'edit', seq: 1, kind: 'door', cells: [x, y, z, open] });
  assert.equal(w.get(x, y, z), open, 'the friend swung it open');
  const heard = owner.inbox.filter((m) => m.t === 'edit' && m.kind === 'door');
  assert.deepEqual(heard.at(-1).cells, [x, y, z, open], 'and the owner sees it swing');
  // A door edit that is no swing (another colour, or the wrong way round)
  // is a build, and refused.
  room.receive(friend, { t: 'edit', seq: 2, kind: 'door', cells: [x, y, z, B.DOORS[1]] });
  room.receive(friend, { t: 'edit', seq: 3, kind: 'door', cells: [x, y, z, open + 1] });
  assert.equal(w.get(x, y, z), open);
  room.receive(friend, { t: 'edit', seq: 4, kind: 'door', cells: [x, y, z, B.DOORS[0]] });
  assert.equal(w.get(x, y, z), B.DOORS[0], 'and shut again');
});

test('a friend bops a tall door and both halves swing for everyone', () => {
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  const conn = () => {
    const c = { inbox: [] };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    c.close = () => {};
    return c;
  };
  const join = (name) => {
    const c = conn();
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
    return c;
  };
  const owner = join('Happy Panda');
  const friend = join('Brave Otter');
  room.receive(owner, { t: 'host', cmd: 'settings', settings: { build: 'host' } });
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 3;
  const z = Math.floor(w.spawn.z) + 3;
  const y = w.top(x, z) + 1;
  // The owner stacks two Oak doors, one above the other: one tall door.
  room.receive(owner, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.DOORS[0], x, y + 1, z, B.DOORS[0]] });
  assert.deepEqual([w.get(x, y, z), w.get(x, y + 1, z)], [B.DOORS[0], B.DOORS[0]]);
  // The friend bops the top half: both halves swing open, and the owner sees it.
  const open = B.turnedDoor(B.DOORS[0]);
  room.receive(friend, { t: 'edit', seq: 1, kind: 'door', cells: [x, y + 1, z, open, x, y, z, open] });
  assert.equal(w.get(x, y, z), open, 'the bottom half swung with it');
  assert.equal(w.get(x, y + 1, z), open, 'the top half the friend bopped');
  const heard = owner.inbox.filter((m) => m.t === 'edit' && m.kind === 'door');
  assert.equal(heard.at(-1).cells.length, 8, 'and the owner sees the whole door swing');
  // A door edit that reaches outside the tall door is no swing, and refused.
  const above = w.get(x, y + 2, z);
  room.receive(friend, { t: 'edit', seq: 2, kind: 'door', cells: [x, y + 2, z, open, x, y, z, B.turnedDoor(open)] });
  assert.equal(w.get(x, y + 2, z), above, 'nothing above the door changed');
  assert.equal(w.get(x, y, z), open);
  // And the tall door shuts as one again.
  room.receive(friend, { t: 'edit', seq: 3, kind: 'door', cells: [x, y, z, B.DOORS[0], x, y + 1, z, B.DOORS[0]] });
  assert.deepEqual([w.get(x, y, z), w.get(x, y + 1, z)], [B.DOORS[0], B.DOORS[0]]);
});
