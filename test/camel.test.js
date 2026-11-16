// The desert's big animal: the camel. Every desert island has a couple on
// its dunes by the oasis, on the same pattern as reindeer on snowy islands
// and unicorns on candy ones: they can be petted, fed a fruit to follow you,
// and ridden — faster than running, jumping, swimming — with the saddle the
// colour of the rider's T-shirt (big.test.js covers the rest of what every
// big animal does, and this file what is the camel's own).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { BIG, bigCounts, CRITTER_INFO, CritterSim, fits } from '../public/js/shared/critters.js';
import { bodyOverlapsSolid, makeBody } from '../public/js/shared/physics.js';
import { getOffAt, rideState, startRide, stepRide } from '../public/js/shared/riding.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const FL = Math.floor;
const SEEDS = [1, 7, 42, 777, 12345, 999999];

// A meadow: magic floor, stone, and grass on top at y = 5 (so standing at 6).
function meadow(W = 48, D = 48) {
  const w = new World({ W, H: 32, D, sea: 3 });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

const ride = (world, type, x, y, z, yaw = 0) => startRide(world, type, { x, y, z, yaw });
const go = (world, r, input, seconds) => {
  const events = [];
  for (let i = 0; i < seconds * 60; i++) events.push(stepRide(world, r, input, 1 / 60));
  return events;
};

test('the camel is a big rideable animal, in the toy box with the rest', () => {
  const info = CRITTER_INFO.camel;
  assert.ok(BIG.includes('camel') && info.ride && info.swims && info.gallops, 'big, rideable, swims and gallops like a reindeer');
  assert.ok(info.names.length >= 5, 'it has names to be called by');
  // Plodding, but quicker than you run, and it jumps like the rest.
  assert.ok(info.ride.run > 7.5 && info.ride.run < 10.5, `it gallops at ${info.ride.run}`);
  assert.ok(info.ride.walk > 4 && info.ride.walk < 6, `it walks at ${info.ride.walk}`);
  assert.ok(info.ride.jump > 8 && info.ride.jump < 11, `it jumps at ${info.ride.jump}`);
});

test('one or two camels wander the dunes about the oasis of every desert island', () => {
  assert.deepEqual(bigCounts('desert'), { camel: 2 });
  // And nowhere else: the other islands' animals are as they were.
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) assert.equal(bigCounts(theme).camel, undefined, `no camel on a ${theme} island`);
  for (const seed of SEEDS) {
    const { world, critters } = generate({ seed, theme: 'desert' });
    const camels = critters.filter((c) => c.type === 'camel');
    assert.ok(camels.length >= 1 && camels.length <= 2, `${seed}: ${camels.length} camels`);
    for (const c of camels) {
      assert.ok(fits(world, 'camel', c.x, c.y, c.z), `${seed}: room for itself and a rider`);
      assert.equal(world.get(FL(c.x), FL(c.y) - 1, FL(c.z)), B.SAND, `${seed}: standing on the sand`);
      assert.notEqual(world.get(FL(c.x), FL(c.y), FL(c.z)), B.WATER, `${seed}: out of the oasis`);
      assert.ok(Math.hypot(c.x - world.spawn.x, c.z - world.spawn.z) >= 10, `${seed}: away from where everyone comes in`);
    }
    // No other big animal wants a desert: the camels have it to themselves.
    assert.ok(critters.filter((c) => BIG.includes(c.type)).every((c) => c.type === 'camel'), 'only camels');
  }
});

test('a camel keeps to the dunes for twenty minutes, out of the oasis, and sleeps at night', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const { world, critters } = generate({ seed, theme: 'desert' });
    const sim = new CritterSim(seed);
    for (const c of critters) if (c.type === 'camel') sim.add(c.type, c.x, c.y, c.z);
    const camels = [...sim.list];
    let wet = 0;
    let asleep = 0;
    let night = 0;
    for (let i = 0; i < 20 * 600; i++) {
      const t = i / 10;
      const dark = t % 600 >= 480;
      sim.step(world, 0.1, t * 1000, new Map(), dark);
      for (const c of camels) {
        const r = CRITTER_INFO.camel.ride;
        assert.ok(!bodyOverlapsSolid(world, { x: c.x, y: c.y, z: c.z, radius: r.radius - 0.01, height: r.height - 0.01 }), `${seed}: a camel got into a block`);
        if (world.get(FL(c.x), FL(c.y + 0.5), FL(c.z)) === B.WATER) wet++;
        if (dark && t % 600 > 520) {
          night++;
          if (c.state === 'sleep') asleep++;
        }
      }
    }
    assert.ok(wet < 12000 * 0.5, `${seed}: it gets out of the water (in it ${wet} of 12000 steps)`);
    assert.ok(asleep / night > 0.9, `${seed}: asleep ${(asleep / night).toFixed(2)} of the late night`);
  }
});

test('petted, a camel is happy; fed a fruit, it comes along with you', () => {
  const w = meadow();
  const sim = new CritterSim(9);
  const camel = sim.add('camel', 8.5, 6, 20.5);
  const you = { x: 8.5, y: 6, z: 20.5, yaw: 0, anim: 1 };
  sim.pet(camel.id, you, 0);
  assert.equal(camel.state, 'happy', 'happy to be petted');
  sim.feed(camel.id, 1, you, 0);
  assert.equal(camel.follow, 1, 'it follows you');
  let t = 3000;
  for (let i = 0; i < 200; i++) {
    you.x = Math.min(26, 8.5 + i * 0.25);
    t += 100;
    sim.step(w, 0.1, t, new Map([[1, you]]));
  }
  const d = Math.hypot(camel.x - you.x, camel.z - you.z);
  assert.ok(d > 1.5 && d < 4.5, `close behind you, ${d.toFixed(2)} away`);
});

test('a camel rides like the other big animals: quicker than you run, over steps and jumps', () => {
  const w = meadow();
  const r = ride(w, 'camel', 10.5, 6, 20.5);
  assert.equal(r.body.radius, CRITTER_INFO.camel.ride.radius);
  go(w, r, { mx: 1, mz: 0 }, 1);
  assert.ok(Math.abs(r.body.vx - CRITTER_INFO.camel.ride.walk) < 0.01, `walking at ${r.body.vx}`);
  assert.equal(rideState(r), 'walk');
  go(w, r, { mx: 1, mz: 0, run: true }, 0.5);
  assert.ok(r.body.vx > 7.5, `galloping faster than you run, at ${r.body.vx}`);
  assert.equal(rideState(r), 'run');
  go(w, r, {}, 1);
  let top = 0;
  go(w, r, { jump: true }, 0.1);
  for (let i = 0; i < 60; i++) {
    stepRide(w, r, {}, 1 / 60);
    top = Math.max(top, r.body.y);
  }
  assert.ok(top - 6 > 1.5 && top - 6 < 2.3, `up ${(top - 6).toFixed(2)}`);
  // And you get off, standing beside it on the ground.
  const off = getOffAt(w, r);
  assert.equal(off.y, 6, 'on the ground');
  assert.ok(!bodyOverlapsSolid(w, makeBody(off.x, off.y, off.z)), 'with room');
  // A step up onto a terrace, and a wall two high across it.
  for (let z = 0; z < 48; z++) {
    for (let x = 30; x < 48; x++) w.set(x, 6, z, B.GRASS);
    for (const y of [7, 8]) w.set(36, y, z, B.STONE);
  }
  const again = ride(w, 'camel', 10.5, 6, 20.5);
  go(w, again, { mx: 1, mz: 0, run: true }, 3);
  assert.equal(again.body.y, 7, 'hopped up the step');
  assert.ok(again.body.x <= 36 - again.body.radius + 1e-3, `stopped at the wall, at ${again.body.x}`);
  assert.ok(!bodyOverlapsSolid(w, again.body));
});

test('a camel is drawn with two humps, and its saddle takes its rider\u2019s T-shirt colour', () => {
  const m = new CritterModel('camel', 1, 'desert');
  assert.equal(m.legs.length, 4, 'four legs');
  assert.equal(m.saddle.visible, false, 'no saddle showing until someone rides');
  m.setRider('#3aa0ff');
  m.group.updateMatrixWorld(true);
  assert.equal(m.saddle.visible, true, 'the saddle shows');
  // The blanket of the saddle is its rider's colour (a big animal's saddle is
  // a thick blanket, the first thing in it, its pad).
  assert.equal(m.saddle.children[0].material.color.getHexString(), '3aa0ff', 'the saddle is the rider\u2019s T-shirt colour');
  // Its two humps stand up over its back, apart, with a dip between them.
  const ray = new THREE.Raycaster();
  const under = (z) => {
    ray.set(new THREE.Vector3(0, 6, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObject(m.pivot, true).find((h) => h.object.visible && !inSaddle(h.object))?.point.y ?? -Infinity;
  };
  // The saddle blanket sits in the dip between the humps: leave it out.
  const inSaddle = (o) => { let p = o; while (p) { if (p === m.saddle) return true; p = p.parent; } return false; };
  const hump = Math.max(under(0.3), under(-0.38));
  const dip = under(-0.05);
  assert.ok(hump - dip > 0.08, `its humps stand ${(hump - dip).toFixed(3)} over the dip between them`);
  // Every state draws, with and without a rider.
  for (const rider of [null, '#5fb8f4']) {
    m.setRider(rider);
    for (const state of ['idle', 'walk', 'run', 'eat', 'happy', 'swim', 'sleep', 'jump']) {
      m.update(1 / 30, state, true, 0.5);
      m.group.updateMatrixWorld(true);
      m.group.traverse((o) => {
        if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${state}: every part is somewhere`);
      });
    }
  }
  m.dispose();
});
