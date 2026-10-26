// A wheeled desk chair from the toy box's 🛋️ Home tab (shared/blocks.js and
// shared/seats.js): sit on it as any seat, but walking rolls it gently along
// the floor, the chair carried from cell to cell as it goes (game.js
// scootInSeat) — so the island has to take the edit (shared/room.js 'scoot').
// The 🏢 Office stamp lays a room of it out, desks and all (shared/stamps.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { makeBody, MOVE, SCOOT, stepBody } from '../public/js/shared/physics.js';
import { scootsAt, seatNear, seatOf, seatPose, standUpAt } from '../public/js/shared/seats.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { EDIT_KINDS, PROTOCOL, Room } from '../public/js/shared/room.js';
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

test('the Desk Chair is furniture of the Home tab after the rocking chair, and a seat you scoot on', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.ROCKING_CHAIR) + 1], B.DESK_CHAIR, 'right after the rocking chair');
  assert.equal(B.block(B.DESK_CHAIR).name, 'Desk Chair');
  assert.equal(B.block(B.DESK_CHAIR).model, 'desk-chair');
  assert.ok(B.block(B.DESK_CHAIR).turns && B.SOLID[B.DESK_CHAIR] === 1, 'solid, like furniture, and it turns');
  assert.equal(B.baseOf(B.DESK_CHAIR + 1), B.DESK_CHAIR, 'it turns to face you');
  // Its picture stays inside its cell, whichever way it is turned.
  for (let front = 0; front < 4; front++) {
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(B.turnedTo(B.DESK_CHAIR, front))) {
      assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'inside its cell');
    }
  }
  // It is a seat, marked as one that rolls: a chair, not a sofa, does not.
  assert.equal(seatOf(B.DESK_CHAIR).pose, 'sit');
  assert.ok(seatOf(B.DESK_CHAIR).scoots, 'walking rolls it');
  assert.ok(!seatOf(B.SOFA).scoots, 'a sofa stays put');
});

test('you sit on the desk chair facing the way it faces, and it is the one seat that rolls', () => {
  const w = meadow();
  w.set(10, 6, 10, B.turnedTo(B.DESK_CHAIR, 1));
  assert.deepEqual(seatNear(w, { x: 10.5, y: 6, z: 11.6 }), { x: 10, y: 6, z: 10 });
  const sit = seatPose(w, 10, 6, 10);
  assert.equal(sit.pose, 'sit');
  assert.ok(Math.abs(sit.yaw) < 1e-9, 'facing the way it faces');
  assert.ok(scootsAt(w, 10, 6, 10), 'this one rolls');
  assert.ok(!scootsAt(w, 10, 6, 11), 'the grass beside it does not');
  assert.deepEqual(standUpAt(w, 10, 6, 10), { x: 10.5, y: 6, z: 11.5 }, 'up in front of it');
});

// The roll of a body seated in the chair at (cx, cy, cz), as game.js
// scootInSeat rolls it: the chair's own cell is where you sit, so as far as
// this one roll is concerned it is not there.
function roll(w, body, cx, cy, cz, input, dt) {
  const free = { W: w.W, H: w.H, D: w.D, get: (x, y, z) => (x === cx && y === cy && z === cz ? B.AIR : w.get(x, y, z)) };
  return stepBody(free, body, input, dt, { move: SCOOT, bounce: false });
}

test('rolling in the chair is gentle, speeds up slowly and coasts to a stop; a wall stops it', () => {
  assert.ok(SCOOT.walk < MOVE.walk && SCOOT.jump === 0, 'gentler than walking, and it never jumps');
  const w = meadow();
  w.set(10, 6, 10, B.DESK_CHAIR);
  const sit = seatPose(w, 10, 6, 10);
  const b = makeBody(sit.x, sit.y, sit.z);
  // One second of rolling forward: it picks up speed slowly and goes less far
  // than a walk would (a walk covers 4.6 blocks a second).
  for (let i = 0; i < 60; i++) roll(w, b, 10, 6, 10, { mx: 0, mz: 1, run: false }, 1 / 60);
  const gone = b.z - sit.z;
  assert.ok(gone > 1 && gone < 3, `it rolls along (${gone.toFixed(2)} blocks) but gently`);
  assert.ok(Math.hypot(b.vx, b.vz) <= SCOOT.walk + 0.01, 'no faster than a scoot goes');
  // Let go and it coasts to a stop, not stopping dead.
  const rolling = Math.hypot(b.vx, b.vz);
  for (let i = 0; i < 120; i++) roll(w, b, 10, 6, 10, { mx: 0, mz: 0 }, 1 / 60);
  assert.ok(rolling > 0.5 && Math.hypot(b.vx, b.vz) === 0, 'it coasts to a stop');
  // Into a wall it stops, and stays inside the island.
  const c = makeBody(sit.x, sit.y, sit.z);
  for (let x = 8; x < 20; x++) w.set(x, 6, 12, B.STONE);
  for (let i = 0; i < 240; i++) roll(w, c, 10, 6, 10, { mx: 0, mz: 1, run: false }, 1 / 60);
  assert.ok(c.z < 12, 'a wall stops it');
});

test('the chair is carried from cell to cell as you scoot, turned the way it rolls', () => {
  const w = meadow();
  w.set(10, 6, 10, B.turnedTo(B.DESK_CHAIR, 1));
  let chair = { x: 10, y: 6, z: 10 };
  const id = () => w.get(chair.x, chair.y, chair.z);
  const sit = seatPose(w, chair.x, chair.y, chair.z);
  const b = makeBody(sit.x, sit.y, sit.z);
  // As scootInSeat: roll the body, then the chair moves to the cell the body
  // is over if it could stand there, turned the way it is rolling (front 1 is
  // +z, RAIL_DIRS).
  const moves = [];
  for (let i = 0; i < 120; i++) {
    roll(w, b, chair.x, chair.y, chair.z, { mx: 0, mz: 1, run: false }, 1 / 60);
    const nx = Math.floor(b.x);
    const ny = Math.floor(b.y + 0.1);
    const nz = Math.floor(b.z);
    if (nx !== chair.x || ny !== chair.y || nz !== chair.z) {
      const going = Math.hypot(b.vx, b.vz) > 0.3 ? Math.atan2(b.vx, b.vz) : null;
      const front = going === null ? B.block(id()).front : ((1 - Math.round(going / (Math.PI / 2))) % 4 + 4) % 4;
      moves.push([nx, ny, nz, B.turnedTo(id(), front), chair.x, chair.y, chair.z, B.AIR]);
      w.set(chair.x, chair.y, chair.z, B.AIR);
      chair = { x: nx, y: ny, z: nz };
      w.set(chair.x, chair.y, chair.z, moves[moves.length - 1][3]);
    }
  }
  assert.ok(chair.z > 10, `the chair rolled on (${chair.z - 10} cells)`);
  assert.equal(w.get(10, 6, 10), B.AIR, 'nothing left where it started');
  // Rolling toward +z, its front is +z (front 1), so you face the way you go.
  assert.equal(B.block(w.get(chair.x, chair.y, chair.z)).front, 1, 'turned the way it rolls');
  assert.ok(scootsAt(w, chair.x, chair.y, chair.z), 'still a chair that rolls, wherever it got to');
  // Sitting in it where it ended, you face the way it faces.
  const again = seatPose(w, chair.x, chair.y, chair.z);
  assert.ok(Math.abs(again.yaw) < 1e-9, 'you face the way it faces');
});

test('the Office stamp is a furnished office with desks and wheeled chairs, whichever way it goes down', () => {
  const stamp = stampByKey('office');
  assert.ok(stamp && stamp.icon === '🏢');
  const at = (cells, x, y, z) => cells.find(([dx, dy, dz]) => dx === x && dy === y && dz === z)?.[3] ?? B.AIR;
  for (const y of [1, 2]) assert.equal(at(stamp.cells, 0, y, 0), B.AIR, 'the way in');
  assert.ok(stamp.cells.some(([, , , id]) => id === B.TABLE), 'desks');
  assert.ok(stamp.cells.some(([, , , id]) => B.BLOCKS[id].model === 'computer'), 'a computer on each one');
  assert.ok(stamp.cells.some(([, , , id]) => B.BLOCKS[id].model === 'desk-chair'), 'wheeled chairs');
  assert.ok(stamp.cells.some(([, , , id]) => B.BLOCKS[id].model === 'bookshelf'), 'bookshelves');
  assert.ok(stamp.cells.some(([, , , id]) => B.BLOCKS[id].model === 'tv' || B.BLOCKS[id].model === 'wall-tv'), 'a TV');
  assert.ok(stamp.cells.some(([, , , id]) => id === B.FLOOR_LAMP), 'lamps');
  for (let facing = 0; facing < 4; facing++) {
    const placed = placeTemplate(stamp.cells, 20, 6, 20, facing);
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    const chairs = placed.filter(([, , , id]) => B.BLOCKS[id].model === 'desk-chair');
    assert.ok(chairs.length >= 4, 'a wheeled chair at every desk');
    for (const [x, y, z, id] of chairs) {
      assert.ok(B.SOLID[at(placed, x, y - 1, z)], 'a floor under it');
      // The desk it faces may be in front of it; every other way is open floor.
      const [fx, fz] = dirs[B.BLOCKS[id].front];
      for (const [dx, dz] of dirs) {
        if (dx === fx && dz === fz) continue;
        assert.equal(at(placed, x + dx, y, z + dz), B.AIR, 'room to roll');
      }
    }
    // Each desk is a table with a computer standing on it, and a chair facing
    // it from a step back, as scooting up to work.
    for (const [x, y, z] of placed.filter(([, , , id]) => id === B.TABLE)) {
      assert.ok(B.BLOCKS[at(placed, x, y + 1, z)].model === 'computer', 'a computer on the desk');
      assert.ok(
        chairs.some(([cx, cy, cz, id]) => cy === y && Math.abs(cx - x) + Math.abs(cz - z) === 1 && B.BLOCKS[id].front === dirs.findIndex(([a, c]) => a === x - cx && c === z - cz)),
        'a wheeled chair facing the desk',
      );
    }
  }
});

// A room and a fake connection, as test/room.test.js.
function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}
function join(room, extra = {}) {
  const c = { inbox: [], closed: false };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => (c.closed = true);
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' }, ...extra });
  return c;
}

test("a chair's scoot from cell to cell is an edit of its own, and everyone sees it", () => {
  assert.ok(EDIT_KINDS.includes('scoot'), 'the island knows the kind');
  let seed = 1;
  const room = new Room({ code: '123456', name: 'Sunny Cove', seed: 42, now: clock().now, random: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
  const a = join(room);
  const b = join(room, { name: 'Brave Otter' });
  const w = room.world;
  const x = Math.floor(w.spawn.x);
  const z = Math.floor(w.spawn.z) + 3;
  const y = w.top(x, z) + 1;
  const chair = B.turnedTo(B.DESK_CHAIR, 1);
  room.receive(a, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, chair] });
  assert.equal(w.get(x, y, z), chair);
  // The chair rolls a cell on, facing the way it rolled (front 1, +z).
  room.receive(a, { t: 'edit', seq: 2, kind: 'scoot', cells: [x, y, z + 1, B.turnedTo(chair, 1), x, y, z, B.AIR], expect: [B.AIR, chair] });
  assert.equal(w.get(x, y, z), B.AIR, 'nothing left where it was');
  assert.equal(w.get(x, y, z + 1), B.turnedTo(chair, 1), 'the chair a cell on');
  assert.deepEqual(b.last('edit').kind, 'scoot', 'friends see the chair move');
  assert.deepEqual(a.last('ack'), { t: 'ack', seq: 2, fix: [] });
  // A scoot that expects a chair where there is none (a friend's build landed
  // there) takes nothing away.
  room.receive(a, { t: 'edit', seq: 3, kind: 'scoot', cells: [x, y, z + 2, chair, x, y, z + 1, B.AIR], expect: [B.AIR, B.AIR] });
  assert.equal(w.get(x, y, z + 1), B.turnedTo(chair, 1), 'the chair stays put');
  assert.equal(w.get(x, y, z + 2), B.AIR, 'and no second chair turns up');
  // Rolling into a friend's block put down there a moment before: the
  // chair stays where it was, rather than going from there and nowhere else.
  room.receive(b, { t: 'edit', seq: 1, kind: 'build', cells: [x, y, z + 2, B.STONE] });
  room.receive(a, { t: 'edit', seq: 4, kind: 'scoot', cells: [x, y, z + 2, B.turnedTo(chair, 1), x, y, z + 1, B.AIR], expect: [B.AIR, B.turnedTo(chair, 1)] });
  assert.equal(w.get(x, y, z + 1), B.turnedTo(chair, 1), 'the chair is still there');
  assert.equal(w.get(x, y, z + 2), B.STONE, 'and so is the block');
  assert.equal(a.last('ack').fix.length, 8, 'both cells put back on the scooter\'s page');
});
