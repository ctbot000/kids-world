// Escalators: moving stairs that carry you up (or down) their steps, built a
// step up and along at a time, the Shopping Mall stamp with one each way,
// and the sticker for riding one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { boardEscalator, ESCALATOR_SPEED, escalatorOf, piecesBeside, STEP_OFF, stepEscalator } from '../public/js/shared/escalator.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { bodyOverlapsSolid, makeBody, MOVE, stepBody } from '../public/js/shared/physics.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { buildEdit } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

function meadow() {
  const w = new World({ W: 32, H: 32, D: 32, sea: 3 });
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

// An escalator of `steps` pieces from the grass at x = 10 up along +x (its
// front, its foot, towards -x), and a deck at the top of it to step off on.
function withEscalator(id = B.ESCALATOR, steps = 5) {
  const w = meadow();
  for (let i = 0; i < steps; i++) w.set(10 + i, 6 + i, 10, B.turnedTo(id, 2));
  for (let x = 10 + steps; x < 22; x++) for (let z = 7; z < 14; z++) w.set(x, 5 + steps, z, B.PLANKS);
  return { w, top: 6 + steps };
}

// What the game does each frame (game.js moveMe): on an escalator, its
// steps carry the body, walking along it as the wish (mx, mz) goes; off one,
// walking as anywhere, then onto one if the body has come onto its steps.
// The ride goes on from one call to the next, kept with the body.
const rides = new WeakMap();
function play(w, b, input, seconds, seen = () => {}) {
  let ride = rides.get(b) ?? null;
  let rode = false;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const fromY = b.y;
    if (ride) {
      const walk = ((input.mx ?? 0) * ride.dx + (input.mz ?? 0) * ride.dz) * MOVE.walk;
      const events = stepEscalator(w, b, ride, 1 / 60, { walk, jump: input.jump ? MOVE.jump : 0 });
      if (events.off || events.gone) ride = null;
    } else {
      stepBody(w, b, input, 1 / 60);
      ride = boardEscalator(w, b, fromY);
    }
    rode ||= Boolean(ride);
    seen(b, ride, i / 60);
  }
  rides.set(b, ride);
  return { ride, rode };
}

// Feet on the steps of the escalator withEscalator makes, at x.
const stepsAt = (x, from = 10, to = 15) => 6 + Math.min(to, Math.max(from, x)) - from;

test('the up and down escalators: in the Building tab right after the elevator, not solid, turned to face you, drawn as real models', () => {
  const building = B.blocksIn('building');
  assert.deepEqual(building.slice(building.indexOf(B.ELEVATOR), building.indexOf(B.ELEVATOR) + 3), [B.ELEVATOR, B.ESCALATOR, B.ESCALATOR_DOWN]);
  for (const id of [B.ESCALATOR, B.ESCALATOR_DOWN]) {
    const d = B.block(id);
    assert.ok(!d.solid && d.turns && d.real === 'escalator', d.key);
    assert.equal(d.faces.length, 4);
    assert.ok(modelBoxes(id).length > 10, 'a picture for the toy box');
  }
  assert.equal(B.block(B.ESCALATOR).escalator, 1);
  assert.equal(B.block(B.ESCALATOR_DOWN).escalator, -1);
});

test('walking in at the foot of an up escalator, its steps carry you up to the top and onto the floor there', () => {
  const { w, top } = withEscalator();
  const b = makeBody(8.5, 6, 10.5);
  // Walk on, then stand still on the steps.
  let on = 0;
  let worst = 0;
  const { rode } = play(w, b, { mx: 1, mz: 0 }, 0.5);
  assert.ok(rode, 'on it');
  const trip = play(w, b, {}, 6, (body, ride, t) => {
    if (!ride) return;
    on = t;
    // Feet on the slope of the steps, in the middle of it.
    worst = Math.max(worst, Math.abs(body.y - stepsAt(body.x)), Math.abs(body.z - 10.5));
  });
  assert.equal(trip.ride, null, 'stepped off at the top');
  assert.ok(worst < 0.02, `on the steps all the way (${worst})`);
  assert.equal(b.y, top, 'on the deck');
  assert.ok(b.x > 15 + STEP_OFF - 0.01 && b.x < 16.5, `off the steps (${b.x})`);
  assert.ok(!bodyOverlapsSolid(w, b));
  // Five blocks along at its own speed, from wherever it was got on.
  assert.ok(on > 1.5 && on < 5 / ESCALATOR_SPEED + 0.5, `${on}s on it`);
});

test('walking up an up escalator is quicker than standing on it, and walking down it is slower but gets you down', () => {
  const time = (input, from) => {
    const { w } = withEscalator();
    const b = makeBody(...from);
    let t = Infinity;
    play(w, b, input, 8, (body, ride, at) => {
      if (t === Infinity && !ride && (input.mx > 0 ? body.x > 15.4 : body.x < 9.6)) t = at;
    });
    return t;
  };
  const standing = time({ mx: 1e-9 }, [10.05, 6, 10.5]);
  const walking = time({ mx: 1 }, [10.05, 6, 10.5]);
  assert.ok(standing < 5 / ESCALATOR_SPEED + 0.5, `rode up in ${standing}s`);
  assert.ok(walking < standing * 0.5, `walking up ${walking}s, riding ${standing}s`);
  // Down it from the deck, against the steps.
  const down = time({ mx: -1 }, [16, 11, 10.5]);
  assert.ok(down < 8 && down > walking, `walked down in ${down}s`);
});

test('standing still at the top of an up escalator, its steps keep you off it; a down escalator carries you down from there', () => {
  const up = withEscalator();
  const b = makeBody(16, up.top, 10.5);
  play(up.w, b, { mx: -1 }, 0.25);
  play(up.w, b, {}, 3);
  assert.equal(b.y, up.top, 'back on the deck');
  assert.ok(b.x > 15.3, `pushed back off (${b.x})`);

  const down = withEscalator(B.ESCALATOR_DOWN);
  const c = makeBody(16, down.top, 10.5);
  play(down.w, c, { mx: -1 }, 0.25);
  const trip = play(down.w, c, {}, 6);
  assert.equal(trip.ride, null);
  assert.equal(c.y, 6, 'down on the grass');
  assert.ok(c.x < 10 - STEP_OFF + 0.01 && c.x > 8.5, `off its foot (${c.x})`);
});

test('a jump on the steps is a hop that comes down on them again, carried along all the while', () => {
  const { w } = withEscalator();
  const b = makeBody(10.05, 6, 10.5);
  play(w, b, { mx: 1e-9 }, 0.6);
  const x0 = b.x;
  let high = 0;
  let ride = null;
  play(w, b, { jump: true }, 0.1);
  const after = play(w, b, {}, 0.8, (body, r) => {
    ride = r;
    high = Math.max(high, body.y - stepsAt(body.x));
  });
  assert.ok(high > 1 && high < 2, `hopped ${high} high`);
  assert.ok(after.ride && ride, 'still on it');
  assert.ok(Math.abs(b.y - stepsAt(b.x)) < 0.01, 'back on the steps');
  assert.ok(b.x - x0 > 0.9 * ESCALATOR_SPEED * 0.9, 'carried along');
});

test('the steps gone from under you, you fall; a way off blocked keeps you at the end; coming down onto one from above it takes you on', () => {
  const { w } = withEscalator();
  const b = makeBody(10.05, 6, 10.5);
  play(w, b, { mx: 1e-9 }, 1);
  const ride = boardEscalator(w, b);
  assert.ok(ride);
  w.set(Math.floor(b.x), Math.floor(b.y), 10, B.AIR);
  assert.ok(stepEscalator(w, b, ride, 1 / 60).gone);

  const blocked = withEscalator();
  for (let y = blocked.top; y < blocked.top + 3; y++) blocked.w.set(15, y, 10, B.BRICK_WALL);
  const c = makeBody(10.05, 6, 10.5);
  const end = play(blocked.w, c, { mx: 1e-9 }, 6);
  assert.ok(end.ride, 'still on it');
  assert.ok(Math.abs(c.x - 15) < 0.01 && Math.abs(c.y - blocked.top) < 0.01, `at the top of it (${c.x}, ${c.y})`);

  const fall = withEscalator();
  const d = makeBody(12.5, 12, 10.5);
  const caught = play(fall.w, d, {}, 1.5);
  assert.ok(caught.rode, 'onto it');
});

test('escalatorOf finds the whole run from any piece of it, up or down, and where its ends are drawn', () => {
  const { w } = withEscalator(B.ESCALATOR, 4);
  for (let i = 0; i < 4; i++) {
    const e = escalatorOf(w, 10 + i, 6 + i, 10);
    assert.deepEqual([e.from, e.to, e.rise, e.way, e.dx, e.dz], [10, 14, -4, 1, 1, 0]);
  }
  assert.deepEqual(piecesBeside(w, 10, 6, 10), { below: false, above: true });
  assert.deepEqual(piecesBeside(w, 12, 8, 10), { below: true, above: true });
  assert.deepEqual(piecesBeside(w, 13, 9, 10), { below: true, above: false });
  // Running the other ways too: -x, +z and -z.
  for (const [front, cell] of [
    [0, [20, 6, 20]],
    [3, [20, 6, 20]],
    [1, [20, 6, 20]],
  ]) {
    const v = meadow();
    const id = B.turnedTo(B.ESCALATOR_DOWN, front);
    const [dx, dz] = [[-1, 0], [0, -1], [1, 0], [0, 1]][front];
    for (let i = 0; i < 3; i++) v.set(cell[0] + dx * i, cell[1] + i, cell[2] + dz * i, id);
    const e = escalatorOf(v, cell[0] + dx * 2, cell[1] + 2, cell[2] + dz * 2);
    assert.equal(e.to - e.from, 3, `front ${front}`);
    assert.deepEqual([e.dx, e.dz, e.way], [dx, dz, -1]);
    // From the foot along it, feet go up the steps.
    const foot = { x: cell[0] + 0.5 - dx * 0.5, z: cell[2] + 0.5 - dz * 0.5 };
    const body = makeBody(foot.x + dx * 0.05, cell[1], foot.z + dz * 0.05);
    assert.ok(boardEscalator(v, body), `on it from its foot, front ${front}`);
  }
});

test('an escalator put down on one goes on from the top of it the same way round, or alongside it from its side', () => {
  const { w } = withEscalator(B.ESCALATOR, 3);
  w.set(13, 8, 10, B.AIR);
  for (let x = 13; x < 22; x++) for (let z = 7; z < 14; z++) w.set(x, 8, z, B.AIR);
  const turned = B.turnedTo(B.ESCALATOR, 2);
  // On the top of the first piece, looking any way: the next goes on top.
  const hit = { x: 10, y: 6, z: 10, nx: 0, ny: 1, nz: 0, id: turned };
  assert.deepEqual(buildEdit(w, hit, B.ESCALATOR, 1, [], 1).cells, [13, 9, 10, turned]);
  // On its foot too, and on its head.
  assert.deepEqual(buildEdit(w, { ...hit, nx: -1, ny: 0 }, B.ESCALATOR, 1, [], 3).cells, [13, 9, 10, turned]);
  assert.deepEqual(buildEdit(w, { ...hit, x: 12, y: 8, nx: 1, ny: 0 }, B.ESCALATOR, 1, [], 0).cells, [13, 9, 10, turned]);
  // From its side, a down escalator alongside it, the same way round.
  assert.deepEqual(buildEdit(w, { ...hit, x: 11, y: 7, ny: 0, nz: 1 }, B.ESCALATOR_DOWN, 1, [], 0).cells, [11, 7, 11, B.turnedTo(B.ESCALATOR_DOWN, 2)]);
  // A down escalator on top of an up one goes on top, as anything does.
  assert.deepEqual(buildEdit(w, hit, B.ESCALATOR_DOWN, 1, [], 0).cells, [10, 7, 10, B.turnedTo(B.ESCALATOR_DOWN, 3)]);
  // On the grass, turned to face you, its foot towards you.
  assert.deepEqual(buildEdit(w, { x: 20, y: 5, z: 20, nx: 0, ny: 1, nz: 0, id: B.GRASS }, B.ESCALATOR, 1, [], 1).cells, [20, 6, 20, B.turnedTo(B.ESCALATOR, 2)]);
});

test('the Shopping Mall stamp: up its up escalator from the floor to the upper floor, and down its down one again', () => {
  const w = meadow();
  const cells = stampByKey('mall').cells;
  for (const [x, y, z, id] of placeTemplate(cells, 10, 6, 4, 0)) w.set(x, y, z, id);
  const ups = cells.filter(([, , , id]) => id === B.ESCALATOR);
  const downs = cells.filter(([, , , id]) => id === B.ESCALATOR_DOWN);
  assert.equal(ups.length, 5);
  assert.equal(downs.length, 5);
  // Walk in straight ahead and ride up.
  const b = makeBody(10.5, 6, 4.5);
  assert.ok(play(w, b, { mz: 1 }, 0.6).rode);
  play(w, b, {}, 4);
  assert.equal(b.y, 11, 'upstairs');
  assert.ok(!bodyOverlapsSolid(w, b));
  // Over to the down escalator, beside it to the right (as you look at the
  // mall, which is towards -x here), and down it.
  const c = makeBody(9.5, 11, 12);
  play(w, c, { mz: -1 }, 0.4);
  play(w, c, {}, 5);
  assert.equal(c.y, 6, 'downstairs');
  assert.ok(c.z < 6 && c.z > 4.5, `off at its foot (${c.z})`);
  assert.ok(!bodyOverlapsSolid(w, c));
});

test('riding an escalator earns a sticker', () => {
  assert.ok(STAT_KEYS.includes('escalators'));
  const earned = (n) => STICKERS.find((s) => s.key === 'moving-stairs').test(Object.fromEntries(STAT_KEYS.map((k) => [k, k === 'escalators' ? n : 0])));
  assert.ok(earned(1) && !earned(0));
});
