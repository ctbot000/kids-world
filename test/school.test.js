// Schools: the School Desk (a seat, its chair behind the desk) and the
// Chalkboard (hung on a wall, side by side one long board), furniture that
// turns, side by side in the Home tab; the chalkboard beside you found; the
// School stamp, a classroom of desks facing a chalkboard; and a class, a
// few questions out of the quizzes' banks, with a break before the next.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { makeQuiz, QUESTION_BANKS, QUIZ_LEVELS } from '../public/js/shared/quiz.js';
import { breakLeft, chalkboardNear, CLASS_BREAK_MS, CLASS_SIZE, isChalkboard } from '../public/js/shared/school.js';
import { seatOf, seatPose } from '../public/js/shared/seats.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { World } from '../public/js/shared/world.js';

test('the School Desk and the Chalkboard are furniture that turns, after the broadcast station in the Home tab, inside their cell', () => {
  const home = B.blocksIn('home');
  const at = home.indexOf(B.BROADCAST_STATION);
  assert.deepEqual(home.slice(at + 1, at + 3), [B.SCHOOL_DESK, B.CHALKBOARD]);
  for (const id of [B.SCHOOL_DESK, B.CHALKBOARD]) {
    const d = B.BLOCKS[id];
    assert.equal(d.kind, 'furniture');
    assert.ok(d.turns);
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(id)) {
      assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, `${d.key}: inside its cell`);
      assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
    }
  }
  assert.ok(B.SOLID[B.SCHOOL_DESK]);
  assert.ok(!B.SOLID[B.CHALKBOARD] && B.block(B.CHALKBOARD).wall, 'the chalkboard hangs on a wall');
  for (let k = 0; k < 4; k++) assert.ok(isChalkboard(B.CHALKBOARD + k));
  for (const id of [B.SCHOOL_DESK, B.WALL_TV, B.PICTURE, B.AIR]) assert.ok(!isChalkboard(id));
});

test('the school desk is a seat, its chair behind the desk, so you sit facing the desk', () => {
  assert.equal(seatOf(B.SCHOOL_DESK).pose, 'sit');
  const boxes = modelBoxes(B.SCHOOL_DESK);
  const top = boxes.find((b) => b[6] === B.block(B.SCHOOL_DESK).color);
  // The desk top at the front (low z), as high as a table; the seat behind it.
  assert.ok(top[4] > 0.6, 'a desk to write at');
  assert.ok(top[5] < 0.5, 'the desk top at the front');
  const [, back] = seatOf(B.SCHOOL_DESK).at;
  assert.ok(back > top[5], 'you sit behind the desk');
  // Facing +z, you sit on the -z side of the cell, looking +z.
  const w = new World({ W: 8, H: 8, D: 8, sea: 1 });
  w.set(4, 2, 4, B.turnedTo(B.SCHOOL_DESK, 1));
  const pose = seatPose(w, 4, 2, 4);
  assert.equal(pose.pose, 'sit');
  assert.ok(pose.z < 4.5, 'on the chair at the back of the desk');
  assert.ok(Math.abs(pose.yaw) < 1e-9, 'facing +z, over the desk');
});

test('the chalkboard is green at the front, and side by side they join into one long board framed at its ends', () => {
  const alone = modelBoxes(B.CHALKBOARD);
  const back = Math.max(...alone.map((b) => b[5]));
  assert.equal(back, 1, 'flat against the wall behind it');
  assert.ok(alone.some((b) => b[6] === '#2f5d46' && (b[3] - b[0]) * (b[4] - b[1]) > 0.4), 'a big green board');
  const xs = (boxes) => [Math.min(...boxes.map((b) => b[0])), Math.max(...boxes.map((b) => b[3]))];
  assert.ok(xs(alone)[0] > 0 && xs(alone)[1] < 1, 'framed at both ends on its own');
  const middle = modelBoxes(B.CHALKBOARD, (dx) => dx !== 0);
  assert.deepEqual(xs(middle), [0, 1], 'one in the middle runs right across');
  const green = middle.find((b) => b[6] === '#2f5d46');
  assert.ok(green[0] === 0 && green[3] === 1, 'the green board too');
});

test('the chalkboard beside you is found, up on the wall, and none further away', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 6, 9, B.CHALKBOARD);
  const near = chalkboardNear(w, { x: 8.5, y: 5, z: 7.8 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z }, { x: 8, y: 6, z: 9 });
  assert.equal(chalkboardNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(chalkboardNear(w, { x: 8.5, y: 3, z: 7.8 }), null, 'too far down');
});

test('the School stamp is a classroom: a way in, a chalkboard on the back wall and rows of desks facing it, whichever way it goes down', () => {
  const stamp = stampByKey('school');
  assert.ok(stamp && stamp.icon === '🏫');
  const at = (cells, x, y, z) => cells.find(([dx, dy, dz]) => dx === x && dy === y && dz === z)?.[3] ?? B.AIR;
  for (const y of [1, 2]) assert.equal(at(stamp.cells, 0, y, 0), B.AIR, 'the way in');
  for (const y of [1, 2, 3]) assert.ok(B.SOLID[at(stamp.cells, -6, y, 5)] && B.SOLID[at(stamp.cells, 6, y, 5)], `walls at ${y}`);
  assert.ok(stamp.cells.some(([, , , id]) => id === B.LAMP), 'lamps');
  for (let facing = 0; facing < 4; facing++) {
    const placed = placeTemplate(stamp.cells, 20, 1, 20, facing);
    const board = placed.filter(([, , , id]) => isChalkboard(id));
    const desks = placed.filter(([, , , id]) => B.BLOCKS[id].model === 'school-desk');
    assert.ok(board.length >= 3, 'a long chalkboard');
    assert.ok(desks.length >= 12, 'rows of desks');
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    // Each chalkboard against a wall, facing into the room.
    for (const [x, y, z, id] of board) {
      const [fx, fz] = dirs[B.BLOCKS[id].front];
      assert.ok(B.SOLID[at(placed, x - fx, y, z - fz)], 'a wall behind the board');
      assert.equal(at(placed, x + fx, y, z + fz), B.AIR, 'room in front of it');
    }
    // Every desk faces the chalkboard, with room to get up in front of it.
    const [bx, , bz] = board[Math.floor(board.length / 2)];
    for (const [x, y, z, id] of desks) {
      const [fx, fz] = dirs[B.BLOCKS[id].front];
      assert.ok(fx * (bx - x) + fz * (bz - z) > 0, 'the desk faces the board');
      assert.equal(at(placed, x + fx, y, z + fz), B.AIR, 'room to stand up');
      assert.ok(B.SOLID[at(placed, x, y - 1, z)], 'a floor under it');
    }
  }
});

test('a class is a few questions out of a quiz bank, and the next of its level is after a break', () => {
  assert.ok(CLASS_SIZE > 1);
  for (const level of Object.keys(QUIZ_LEVELS)) {
    assert.ok(QUESTION_BANKS[level].length >= CLASS_SIZE * 5, `${level}: plenty of questions for classes`);
    const quiz = makeQuiz(level, 7, CLASS_SIZE);
    assert.equal(quiz.questions.length, CLASS_SIZE);
    assert.equal(new Set(quiz.questions.map((q) => q.q)).size, CLASS_SIZE, 'no question twice in a class');
    for (const q of quiz.questions) assert.equal(q.choices[q.answer], QUESTION_BANKS[level].find((b) => b.q === q.q).a[0]);
  }
  assert.equal(breakLeft(0, 5000), 0, 'no class yet: one may begin');
  assert.equal(breakLeft(1000, 1000), CLASS_BREAK_MS, 'just ended: the whole break');
  assert.equal(breakLeft(1000, 1000 + CLASS_BREAK_MS), 0, 'the break over');
  assert.equal(breakLeft(1000, 1000 + CLASS_BREAK_MS / 2), CLASS_BREAK_MS / 2);
});
