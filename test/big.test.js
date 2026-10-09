// The big animals, and riding them: where they start out, getting about for
// twenty minutes without getting into anything, asleep at night, along with
// you once fed; riding one on land (walking, galloping, jumping, bumping into
// walls, hopping up steps, the elephant's spray) and in the sea (never out of
// the water, a dolphin's leaps, the whale's spout), getting off, and each
// rider sitting right on the saddle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { BIG, bigCounts, scaleCounts, CRITTER_INFO, CRITTER_TYPES, CritterSim, fits, mountUnder, nearestWater, riderAt, SURFACE, swimmable, waterColumn } from '../public/js/shared/critters.js';
import { BODY, bodyOverlapsSolid, makeBody, MOVE, stepBody } from '../public/js/shared/physics.js';
import { getOffAt, rideState, startRide, stepRide } from '../public/js/shared/riding.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

// Whether o is part of group (or is it).
const isIn = (o, group) => {
  for (; o && group; o = o.parent) if (o === group) return true;
  return false;
};

const FL = Math.floor;

function island(theme, seed) {
  const { world, critters } = generate({ seed, theme });
  const sim = new CritterSim(seed);
  for (const c of critters) sim.add(c.type, c.x, c.y, c.z);
  return { world, sim, critters };
}

// Days of 8 minutes and nights of 2, in tenths of a second, as the host ticks.
function run(world, sim, minutes, look = () => {}, players = new Map()) {
  for (let i = 0; i < minutes * 600; i++) {
    const t = i / 10;
    const night = t % 600 >= 480;
    sim.step(world, 0.1, t * 1000, players, night);
    for (const c of sim.list) look(c, night, t);
  }
}

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

// The sea: water from y = 1 up to the top cell at y = 12 (the surface drawn at
// 12.875), with a sandy beach at the top cell's height for x >= 40.
function sea() {
  const w = new World({ W: 64, H: 32, D: 48, sea: 12 });
  for (let x = 0; x < w.W; x++) {
    for (let z = 0; z < w.D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 12; y++) w.set(x, y, z, x >= 40 ? B.SAND : B.WATER);
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

test('big animals start out in the open on dry land, with room for a rider, away from where you come in', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    for (const [seed, size] of [
      [4242, 'small'],
      [7, 'small'],
      [7, 'big'],
      [4242, 'huge'],
    ]) {
      const { world, critters } = generate({ seed, theme, size });
      const big = critters.filter((c) => BIG.includes(c.type));
      const counts = {};
      for (const c of big) counts[c.type] = (counts[c.type] ?? 0) + 1;
      assert.deepEqual(counts, scaleCounts(bigCounts(theme), world), `${theme} ${seed} ${size}`);
      for (const c of big) {
        assert.ok(fits(world, c.type, c.x, c.y, c.z), `${theme} ${seed}: a ${c.type} has room for itself and a rider`);
        assert.ok(Math.hypot(c.x - world.spawn.x, c.z - world.spawn.z) >= 10, `${theme} ${seed}: a ${c.type} away from where you come in`);
        assert.notEqual(world.get(FL(c.x), FL(c.y), FL(c.z)), B.WATER, `${theme} ${seed}: a ${c.type} out of the water`);
        if (c.type !== 'polarbear') assert.notEqual(world.get(FL(c.x), FL(c.y) - 1, FL(c.z)), B.SAND, `${theme} ${seed}: a ${c.type} off the beach`);
      }
    }
  }
});

test('big animals get about for twenty minutes without getting into anything, wandering off or staying in the water, and sleep at night', () => {
  for (const [theme, seed] of [
    ['sunny', 4242],
    ['snowy', 77],
    ['candy', 1],
    ['flat', 999],
    ['sunny', 123],
    ['snowy', 8],
  ]) {
    const { world, sim } = island(theme, seed);
    const big = sim.list.filter((c) => BIG.includes(c.type));
    const seen = new Map(big.map((c) => [c.id, { x: c.x, z: c.z, far: 0, wet: 0, moved: 0, lx: c.x, lz: c.z }]));
    let night = 0;
    let asleep = 0;
    run(world, sim, 20, (c, dark, t) => {
      const s = seen.get(c.id);
      if (!s) return;
      const r = CRITTER_INFO[c.type].ride;
      // A hair inside its box: touching a wall is not being in it.
      assert.ok(!bodyOverlapsSolid(world, { x: c.x, y: c.y, z: c.z, radius: r.radius - 0.01, height: r.height - 0.01 }), `${theme} ${seed}: a ${c.type} got into a block at ${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}`);
      s.far = Math.max(s.far, Math.hypot(c.x - s.x, c.z - s.z));
      s.moved += Math.hypot(c.x - s.lx, c.z - s.lz);
      s.lx = c.x;
      s.lz = c.z;
      if (world.get(FL(c.x), FL(c.y + 0.5), FL(c.z)) === B.WATER) s.wet++;
      // Late at night, a while after dusk.
      if (dark && t % 600 > 520) {
        night++;
        if (c.state === 'sleep') asleep++;
      }
    });
    for (const c of big) {
      const s = seen.get(c.id);
      assert.ok(s.far < 30, `${theme} ${seed}: a ${c.type} stays about its home (went ${s.far.toFixed(1)} away)`);
      assert.ok(s.wet < 12000 * (CRITTER_INFO[c.type].paddles ? 0.5 : 0.1), `${theme} ${seed}: a ${c.type} gets out of the water (in it ${s.wet} of 12000 steps)`);
    }
    assert.ok(big.filter((c) => seen.get(c.id).moved > 100).length >= big.length * 0.6, `${theme} ${seed}: most of them get about`);
    assert.ok(asleep / night > 0.9, `${theme} ${seed}: asleep ${(asleep / night).toFixed(2)} of the late night`);
  }
});

test('fed a fruit, a big animal comes along with you, a little way off, and keeps out of the water you swim in', () => {
  const w = meadow();
  // A pond to the east, three deep.
  for (let x = 30; x < 40; x++) for (let z = 10; z < 30; z++) for (let y = 3; y <= 5; y++) w.set(x, y, z, B.WATER);
  const sim = new CritterSim(5);
  const pony = sim.add('pony', 8.5, 6, 20.5);
  const you = { x: 8.5, y: 6, z: 20.5, yaw: 0, anim: 1 };
  const players = new Map([[1, you]]);
  sim.feed(pony.id, 1, you, 0);
  let t = 3000;
  // You walk east; it follows, running when it is left behind.
  for (let i = 0; i < 200; i++) {
    you.x = Math.min(26, 8.5 + i * 0.25);
    t += 100;
    sim.step(w, 0.1, t, players);
  }
  const d = Math.hypot(pony.x - you.x, pony.z - you.z);
  assert.ok(d > 1.5 && d < 4.5, `close behind you, ${d.toFixed(2)} away`);
  // Into the pond: it waits on the bank.
  for (let i = 0; i < 100; i++) {
    you.x = Math.min(35, you.x + 0.25);
    you.y = 4.2;
    t += 100;
    sim.step(w, 0.1, t, players);
  }
  assert.notEqual(w.get(FL(pony.x), FL(pony.y + 0.5), FL(pony.z)), B.WATER, 'a pony stays out of the water');
  assert.ok(pony.x < 30 && pony.x > 26, `on the bank, at ${pony.x.toFixed(2)}`);
});

test('a pony walks and gallops faster than you do, jumps higher, bumps into walls and hops up a step', () => {
  const w = meadow();
  const r = ride(w, 'pony', 10.5, 6, 20.5);
  assert.equal(r.body.radius, CRITTER_INFO.pony.ride.radius);
  go(w, r, { mx: 1, mz: 0 }, 1);
  assert.ok(Math.abs(r.body.vx - CRITTER_INFO.pony.ride.walk) < 0.01, `walking at ${r.body.vx}`);
  assert.equal(rideState(r), 'walk');
  go(w, r, { mx: 1, mz: 0, run: true }, 0.5);
  assert.ok(r.body.vx > 9 && r.body.vx > 7, 'galloping faster than you run');
  assert.equal(rideState(r), 'run');
  assert.ok(Math.abs(r.yaw - Math.PI / 2) < 0.05, 'facing the way it goes');
  // A jump: about two blocks, higher than you jump.
  go(w, r, {}, 1);
  let peak = 0;
  for (const ev of go(w, r, { jump: true }, 0.1)) peak = Math.max(peak, ev.jumped ? 1 : 0);
  assert.equal(peak, 1, 'jumped');
  let top = 0;
  for (let i = 0; i < 60; i++) {
    stepRide(w, r, {}, 1 / 60);
    top = Math.max(top, r.body.y);
  }
  assert.ok(top - 6 > 1.8 && top - 6 < 2.1, `up ${(top - 6).toFixed(2)}`);
  // A step up onto a terrace, and a wall two high across the terrace.
  for (let z = 0; z < 48; z++) {
    for (let x = 30; x < 48; x++) w.set(x, 6, z, B.GRASS);
    for (const y of [7, 8]) w.set(36, y, z, B.STONE);
  }
  go(w, r, { mx: 1, mz: 0 }, 3);
  assert.equal(r.body.y, 7, 'hopped up the step');
  assert.ok(r.body.x <= 36 - r.body.radius + 1e-3 && r.body.x > 35, `stopped at the wall, at ${r.body.x}`);
  assert.ok(!bodyOverlapsSolid(w, r.body));
});

test("the elephant sprays water instead of jumping, and still climbs a step and out of the water", () => {
  const w = meadow();
  for (let z = 0; z < 48; z++) for (let x = 20; x < 48; x++) w.set(x, 6, z, B.GRASS);
  const r = ride(w, 'elephant', 10.5, 6, 20.5);
  const [first] = go(w, r, { jump: true }, 1 / 60);
  assert.ok(first.trick && !first.jumped, 'a spray, not a jump');
  assert.ok(!go(w, r, { jump: true }, 0.5).some((ev) => ev.trick), 'once for each press');
  assert.equal(r.body.y, 6, 'its feet stayed on the ground');
  go(w, r, { mx: 1, mz: 0 }, 4);
  assert.equal(r.body.y, 7, 'up the step');
});

test('a ridden animal dropped from any height lands once, as hard as it fell', () => {
  const w = meadow();
  for (const type of ['pony', 'elephant']) {
    for (let i = 0; i < 100; i++) {
      const h = 0.2 + (i / 99) * 8.2;
      const r = ride(w, type, 10.5, 6 + h, 20.5);
      const landings = go(w, r, {}, 2)
        .map((ev) => ev.landed)
        .filter(Boolean);
      const speed = Math.sqrt(2 * MOVE.gravity * h);
      assert.equal(landings.length, 1, `${type} dropped from ${h}: landed ${landings.join(', ') || 'never'}`);
      assert.ok(Math.abs(landings[0] - speed) < MOVE.gravity / 90, `${type} dropped from ${h}: landed at ${landings[0]}, not ${speed}`);
      assert.equal(r.body.y, 6);
    }
  }
});

test('swimmers climb out of the water onto a bank a block over it, and no higher', () => {
  for (const [bank, out] of [
    [0, true],
    [1, true],
    [2, false],
  ]) {
    const w = sea();
    for (let x = 40; x < 64; x++) for (let z = 0; z < 48; z++) for (let y = 13; y <= 12 + bank; y++) w.set(x, y, z, B.GRASS);
    for (const type of ['player', 'pony', 'polarbear', 'elephant']) {
      const b = makeBody(34.5, 9, 20.5);
      let move;
      if (type !== 'player') {
        const r = CRITTER_INFO[type].ride;
        Object.assign(b, { radius: r.radius, height: r.height, float: r.float });
        move = r;
      }
      // Jump held (to swim up and climb out), until out of the water.
      for (let i = 0; i < 600; i++) stepBody(w, b, { mx: 1, mz: 0, jump: b.x < 40.5 }, 1 / 60, { move });
      assert.equal(b.x > 40.5 && Math.abs(b.y - (13 + bank)) < 1e-6, out, `${type}, a bank ${bank} over the water: ${out ? 'out' : 'still in'} (at ${b.x.toFixed(2)}, ${b.y.toFixed(2)})`);
    }
  }
});

test('a dolphin never takes its rider out of the water, swims at the top of it, dives, and leaps', () => {
  const w = sea();
  const at = nearestWater(w, 'dolphin', 20.5, 20.5);
  const r = ride(w, 'dolphin', at.x, at.y, at.z, Math.PI / 2);
  // East, towards the beach: it stops where the water is too shallow for it.
  go(w, r, { mx: 1, mz: 0 }, 6);
  assert.ok(swimmable(w, 'dolphin', r.body.x, r.body.z) && r.body.x < 40, `still at sea, at ${r.body.x.toFixed(2)}`);
  assert.ok(Math.abs(r.body.y - (12 + SURFACE - CRITTER_INFO.dolphin.ride.float)) < 0.05, 'its back out of the water');
  assert.ok(riderAt('dolphin', { x: r.body.x, y: r.body.y, z: r.body.z, yaw: r.yaw }).y > 12 + SURFACE - 0.3, "and its rider's hips");
  go(w, r, { down: true }, 2);
  assert.ok(r.body.y < 12 + SURFACE - 1.2, 'under the water, diving');
  go(w, r, {}, 2);
  // West, and a leap out of the sea and back into it.
  go(w, r, { mx: -1, mz: 0 }, 1);
  let leapt = false;
  let high = -Infinity;
  for (const ev of go(w, r, { mx: -1, mz: 0, jump: true }, 0.2)) leapt ||= ev.leapt;
  assert.ok(leapt, 'it leapt');
  assert.equal(rideState(r), 'jump');
  for (let i = 0; i < 90; i++) {
    stepRide(w, r, { mx: -1, mz: 0 }, 1 / 60);
    high = Math.max(high, r.body.y);
  }
  assert.ok(high > 12 + SURFACE + 1, 'high out of the water');
  assert.equal(r.leap, null, 'and back in');
  assert.equal(w.get(FL(r.body.x), FL(r.body.y), FL(r.body.z)), B.WATER);
});

test('the whale keeps its rider out in the deep sea, and blows water once for each press', () => {
  const w = sea();
  const at = nearestWater(w, 'whale', 10.5, 20.5);
  const r = ride(w, 'whale', at.x, at.y, at.z);
  for (const [mx, mz] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    go(w, r, { mx, mz, run: true }, 8);
    assert.ok(swimmable(w, 'whale', r.body.x, r.body.z), `in the deep sea, at ${r.body.x.toFixed(2)}, ${r.body.z.toFixed(2)}`);
  }
  const blows = go(w, r, { jump: true }, 1).filter((ev) => ev.trick).length;
  assert.equal(blows, 1);
});

test('getting off, you stand on the ground beside the animal, or swim beside it at sea', () => {
  const w = meadow();
  for (const type of BIG) {
    const r = ride(w, type, 20.5, 6, 20.5, 0.4);
    const at = getOffAt(w, r);
    assert.equal(at.y, 6, `off a ${type}, on the ground`);
    assert.ok(!bodyOverlapsSolid(w, makeBody(at.x, at.y, at.z)), `off a ${type}, with room`);
    const d = Math.hypot(at.x - 20.5, at.z - 20.5);
    assert.ok(d >= CRITTER_INFO[type].ride.radius + BODY.radius && d < 2, `off a ${type}, beside it (${d.toFixed(2)} away)`);
  }
  // Hemmed in by walls: on top of where it was.
  for (let x = 18; x <= 22; x++) for (let z = 18; z <= 22; z++) if (x === 18 || x === 22 || z === 18 || z === 22) for (let y = 6; y < 10; y++) w.set(x, y, z, B.STONE);
  const boxed = ride(w, 'pony', 20.5, 6, 20.5);
  const up = getOffAt(w, boxed);
  assert.ok(!bodyOverlapsSolid(w, makeBody(up.x, up.y, up.z)), 'somewhere free');
  const s = sea();
  const at = nearestWater(s, 'whale', 10.5, 20.5);
  const off = getOffAt(s, ride(s, 'whale', at.x, at.y, at.z));
  assert.equal(s.get(FL(off.x), FL(off.y + 0.5), FL(off.z)), B.WATER, 'in the water beside the whale');
  assert.ok(Math.hypot(off.x - at.x, off.z - at.z) > 1, 'not under it');
});

test('there is no getting on where it would not fit with a rider', () => {
  const w = meadow();
  for (let x = 10; x < 13; x++) for (let z = 10; z < 13; z++) w.set(x, 8, z, B.PLANKS);
  assert.equal(ride(w, 'pony', 11.5, 6, 11.5), null, 'under a low roof');
  assert.ok(ride(w, 'pony', 20.5, 6, 20.5), 'out in the open');
});

test("the host puts a ridden animal under its rider, as they say where they are", () => {
  const w = meadow();
  const sim = new CritterSim(3);
  const pony = sim.add('pony', 10.5, 6, 10.5);
  assert.equal(sim.ride(pony.id, 7), pony);
  const seat = riderAt('pony', { x: 15.5, y: 6, z: 12.5, yaw: 1 });
  const rider = { x: seat.x, y: seat.y, z: seat.z, yaw: 1, anim: 6 };
  sim.step(w, 0.1, 1000, new Map([[7, rider]]));
  assert.deepEqual([pony.x, pony.y, pony.z, pony.yaw].map((v) => +v.toFixed(6)), [15.5, 6, 12.5, 1]);
  assert.equal(pony.state, 'run', 'having come a long way at once');
  sim.step(w, 0.1, 1100, new Map([[7, rider]]));
  assert.equal(pony.state, 'idle');
  // Once its rider has gone, it is on its own, there, and that is its home.
  sim.step(w, 0.1, 1200, new Map());
  assert.equal(pony.rider, 0);
  assert.deepEqual(pony.home, { x: 15.5, z: 12.5 });
  const under = mountUnder('pony', rider);
  assert.ok(Math.abs(under.x - 15.5) < 1e-9 && Math.abs(under.y - 6) < 1e-9);
  // Small animals have no saddles.
  const bunny = sim.add('bunny', 5.5, 6, 5.5);
  assert.equal(sim.ride(bunny.id, 7), null);
});

test('each rider sits on the saddle, on the top of the back', () => {
  for (const type of CRITTER_TYPES.filter((t) => CRITTER_INFO[t].ride)) {
    const r = CRITTER_INFO[type].ride;
    const m = new CritterModel(type, 2, 'sunny');
    m.time = 0;
    m.update(1 / 60, 'idle', false, 0);
    m.setRider('#ff0000');
    m.group.updateMatrixWorld(true);
    // The highest point under the rider's hips (not a rotor or a balloon
    // up over it).
    const under = (hits) => hits.find((h) => !m.over || !isIn(h.object, m.over));
    let top = -Infinity;
    for (const rad of [0, 0.06, 0.12]) {
      for (let i = 0; i < (rad ? 10 : 1); i++) {
        const a = (i / 10) * Math.PI * 2;
        const ray = new THREE.Raycaster(new THREE.Vector3(Math.cos(a) * rad, 6, (r.z ?? 0) + Math.sin(a) * rad), new THREE.Vector3(0, -1, 0));
        top = Math.max(top, under(ray.intersectObject(m.group, true))?.point.y ?? -Infinity);
      }
    }
    assert.ok(Math.abs(top - r.seat) <= 0.02, `${type}: sits at ${r.seat}, its back is at ${top.toFixed(3)}`);
    // Big enough a box for a rider sitting there (without a hat).
    if (!r.sea) assert.ok(r.height >= r.seat + 1.15, `${type}: room for the rider's head`);
    m.dispose();
  }
});

test('every big animal can be drawn in every state, with and without a rider, at any speed', () => {
  for (const type of BIG) {
    const m = new CritterModel(type, 1, 'snowy');
    for (const rider of [null, '#5fb8f4']) {
      m.setRider(rider);
      for (const state of ['idle', 'walk', 'run', 'eat', 'happy', 'swim', 'sleep', 'jump']) {
        for (let i = 0; i < 6; i++) {
          m.group.position.x += i * 0.12;
          m.update(1 / 30, state, i % 2 === 0, 0.5);
        }
        m.group.updateMatrixWorld(true);
        m.group.traverse((o) => {
          if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${type} ${state}: every part is somewhere`);
        });
      }
    }
    assert.equal(m.saddle.visible, true);
    m.dispose();
  }
});

test('big animals behave the same whatever else is on the island, and leave the others as they were', () => {
  // The same island with and without its big animals: the rest do exactly the same.
  const trace = (withBig) => {
    const { world, critters } = generate({ seed: 31, theme: 'sunny' });
    const sim = new CritterSim(31);
    for (const c of critters) if (withBig || !BIG.includes(c.type)) sim.add(c.type, c.x, c.y, c.z);
    const out = [];
    run(world, sim, 1, (c) => {
      if (!BIG.includes(c.type) && c.type === 'bunny') out.push(c.x.toFixed(3));
    });
    return out.join();
  };
  assert.equal(trace(true), trace(false));
});

test('water a swimmer of its kind can be in, and what is under it', () => {
  const w = sea();
  assert.ok(swimmable(w, 'whale', 10.5, 20.5));
  assert.ok(!swimmable(w, 'whale', 45.5, 20.5), 'not on the beach');
  assert.ok(waterColumn(w, 10.5, 20.5));
});
