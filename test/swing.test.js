// A swing set from the toy box's 🛋️ Home tab (shared/blocks.js, shared/seats.js
// and render/swing-model.js): sit on it like any seat and you swing gently
// back and forth; a tap of jump in time as you swing forward pumps you higher
// and higher, up to almost level with the top bar (game.js swingInSeat). Two
// can swing side by side, one on each seat, and friends see you swing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { freeSpot, seatNear, seatOf, seatPose, standUpAt } from '../public/js/shared/seats.js';
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

test('the Swing Set is furniture of the Home tab after the desk chair, a real model that turns to face you', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.DESK_CHAIR) + 1], B.SWING_SET, 'right after the desk chair');
  assert.equal(B.block(B.SWING_SET).name, 'Swing Set');
  assert.equal(B.block(B.SWING_SET).model, 'swing-set');
  assert.equal(B.block(B.SWING_SET).real, 'swing-set', 'drawn as a real model');
  assert.ok(B.block(B.SWING_SET).turns && B.SOLID[B.SWING_SET] === 1, 'solid, like furniture, and it turns');
  assert.equal(B.baseOf(B.SWING_SET + 1), B.SWING_SET, 'it turns to face you');
  // Its picture stays inside its cell, whichever way it is turned.
  for (let front = 0; front < 4; front++) {
    for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(B.turnedTo(B.SWING_SET, front))) {
      assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'inside its cell');
    }
  }
});

test('you sit on a swing facing the way it faces, and there is room for a friend on the seat beside you', () => {
  const w = meadow();
  w.set(10, 6, 10, B.turnedTo(B.SWING_SET, 1));
  assert.deepEqual(seatNear(w, { x: 10.5, y: 6, z: 11.6 }), { x: 10, y: 6, z: 10 });
  const sit = seatPose(w, 10, 6, 10);
  assert.equal(sit.pose, 'sit');
  assert.ok(Math.abs(sit.yaw) < 1e-9, 'facing the way it faces');
  assert.equal(sit.y, 6.5, 'a seat at hanging height');
  // Two spots, one each side of the middle, a friend in the other.
  const a = seatPose(w, 10, 6, 10, 0);
  const b = seatPose(w, 10, 6, 10, 1);
  assert.ok(Math.min(a.x, b.x) < 10.5 && Math.max(a.x, b.x) > 10.5, 'one either side of the middle');
  assert.ok(Math.abs(a.x - b.x) > 0.3, 'the seats a good width apart');
  assert.ok(Math.abs(a.z - b.z) < 1e-9, 'side by side, not one behind the other');
  assert.equal(freeSpot(w, 10, 6, 10, [{ x: a.x, y: a.y, z: a.z }]), 1, 'the seat beside you is free');
  assert.equal(freeSpot(w, 10, 6, 10, [
    { x: a.x, y: a.y, z: a.z },
    { x: b.x, y: b.y, z: b.z },
  ]), -1, 'both seats taken');
  // You get up beside it, in front of it.
  assert.deepEqual(standUpAt(w, 10, 6, 10), { x: 10.5, y: 6, z: 11.5 }, 'up in front of it');
  // A swing set is not a chair you scoot on.
  assert.ok(!seatOf(B.SWING_SET).scoots, 'walking gets you off, it does not roll');
});

test('a swing swings gently back and forth on its own, and a tap in time pumps it higher', async () => {
  const { swingAt, swingPhase, GENTLE, PUMP, MOST, settle, SEAT } = await import('../public/js/render/swing-model.js');
  // A gentle swing: it sways back and forth, never far, and it is periodic.
  assert.equal(swingAt(0, GENTLE), 0, 'hanging straight at the top of its arc');
  let most = 0;
  for (let t = 0; t < 20; t += 0.05) most = Math.max(most, Math.abs(swingAt(t, GENTLE)));
  assert.ok(most > 0.05 && most <= GENTLE + 1e-9, `never swinging further than the gentle height (${most.toFixed(3)})`);
  assert.ok(Math.abs(swingAt(1, GENTLE) - swingAt(3, GENTLE)) < 1e-9, 'a whole swing in two seconds');
  // Left alone, a pumped swing settles back to the gentle swing.
  let amp = MOST;
  for (let i = 0; i < 60 * 10; i++) amp = settle(amp, 1 / 60);
  assert.ok(Math.abs(amp - GENTLE) < 0.03, `settled to gentle (${amp.toFixed(3)})`);
  // Each well-timed tap adds, and there is a height it goes no further than.
  assert.ok(PUMP > 0.05 && PUMP < 0.4, 'a tap adds a sensible amount');
  let height = GENTLE;
  for (let i = 0; i < 100; i++) height = Math.min(MOST, height + PUMP);
  assert.equal(height, MOST, 'no higher than the most');
  // Almost level with the top bar: the seat rises nearly to it.
  assert.ok(SEAT.bar - (SEAT.y - SEAT.chains * (1 - Math.cos(MOST))) > 0, 'the seat stays under the bar');
  assert.ok(MOST > 1.1 && MOST < Math.PI / 2 + 0.1, `up to ${MOST.toFixed(2)} radians, near enough level with the bar`);
  // Each swing set swings at a time of its own, so two beside each other are
  // not in step.
  assert.ok(Math.abs(swingPhase(10, 6, 10) - swingPhase(11, 6, 10)) > 0.01, 'out of step');
});

test('whoever sits on a swing is carried with the seat, leaned back as it swings', async () => {
  const { swungSitter, GENTLE, SEAT } = await import('../public/js/render/swing-model.js');
  // Facing +z (yaw 0), the swing carries them forward along +z as it swings.
  const forth = swungSitter(GENTLE, 0);
  assert.ok(forth.dz > 0, 'carried forward');
  assert.ok(forth.dy < 0, 'a touch lower, as it swings out');
  assert.ok(Math.abs(forth.dx) < 1e-9, 'nowhere sideways');
  // The other way, and back the way they came from.
  const back = swungSitter(-GENTLE, 0);
  assert.ok(back.dz < 0 && Math.abs(back.dy - forth.dy) < 1e-9, 'and back');
  // Turned to face -z instead, it carries them the other way along z.
  const turned = swungSitter(GENTLE, Math.PI);
  assert.ok(turned.dz < 0, 'the way they face');
  // Leaned with the swing, never far, and their hips stay below the bar.
  assert.ok(Math.abs(forth.lean) < GENTLE, 'leaning with it');
  assert.ok(SEAT.chains * 2 < SEAT.bar + 1, 'the chains are shorter than the bar is high');
});

test('the swing set itself fits its cell, and its two seats swing about the top bar', async () => {
  const THREE = await import('../public/vendor/three.module.js');
  const { swingMaterials, swingModel, SEAT } = await import('../public/js/render/swing-model.js');
  const model = swingModel(swingMaterials());
  const size = new THREE.Box3().setFromObject(model);
  assert.ok(size.min.y >= 0 && size.max.y <= 1.001 && size.min.x >= -0.5 && size.max.x <= 0.5 && size.min.z >= -0.5 && size.max.z <= 0.5, 'it fits its cell');
  assert.ok(model.userData.seats?.length === 2, 'two seats');
  // What swings is turned about the top bar, so a seat hangs from it.
  for (const seat of model.userData.seats) {
    assert.ok(Math.abs(seat.position.y - SEAT.bar) < 1e-9, 'pivoting at the bar');
    assert.equal(seat.rotation.x, 0, 'hanging straight to begin with');
    seat.rotation.x = 0.5;
    seat.updateMatrix();
    const box = new THREE.Box3().setFromObject(seat);
    assert.ok(box.min.y < SEAT.y && box.max.y <= SEAT.bar + 0.01, 'the seat swings under the bar');
    seat.rotation.x = 0;
  }
  // Turning a seat swings whoever is on it forward along -z, the way they face
  // (the layout faces -z, shared/furniture.js).
  const seat = model.userData.seats[0];
  seat.rotation.x = -0.4;
  seat.updateMatrix();
  const box = new THREE.Box3().setFromObject(seat);
  assert.ok(box.min.z < 0, 'swung forward, the way you face');
  seat.rotation.x = 0;
});
