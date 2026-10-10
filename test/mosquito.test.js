// Giant mosquitos: where they start out (every island but the snowy ones),
// droning about the meadows without bumping into anything and sipping at
// the flowers, asleep at night, following a friend who feeds them without
// ever sitting on their head, and the ride: the one big animal that takes
// you up into the sky, hovers, comes down again, and flies off by itself
// when you let go of it up in the air.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CRITTER_TYPES, CritterSim, FLOWERS, fits, giantCounts, mountUnder, riderAt, scaleCounts, skyline, STATES, unpackCritter } from '../public/js/shared/critters.js';
import { getOffAt, rideState, startRide, stepRide } from '../public/js/shared/riding.js';
import { Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

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

const ride = (world, x, y, z, yaw = 0) => startRide(world, 'mosquito', { x, y, z, yaw });
const go = (world, r, input, seconds) => {
  const events = [];
  for (let i = 0; i < seconds * 60; i++) events.push(stepRide(world, r, input, 1 / 60));
  return events;
};

test('every island but the snowy ones starts with two giant mosquitos, perched out in the open with room for a rider', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    for (const [seed, size] of [
      [4242, 'small'],
      [7, 'big'],
      [99, 'huge'],
    ]) {
      const where = `${theme} ${seed} ${size}`;
      const { world, critters } = generate({ seed, theme, size });
      const of = critters.filter((c) => c.type === 'mosquito');
      assert.equal(of.length, scaleCounts(giantCounts(theme), world).mosquito ?? 0, `${where}: how many`);
      for (const c of of) {
        assert.ok(B.SOLID[world.get(FL(c.x), FL(c.y - 0.05), FL(c.z))], `${where}: perched on something`);
        assert.ok(fits(world, 'mosquito', c.x, c.y, c.z), `${where}: room for a rider`);
        assert.ok(Math.hypot(c.x - world.spawn.x, c.z - world.spawn.z) >= 8, `${where}: away from where everyone comes in`);
      }
      for (const [a, b] of of.flatMap((a) => of.filter((o) => o !== a).map((o) => [a, o]))) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 6, `${where}: apart from each other`);
    }
  }
});

test('giant mosquitos drone about without bumping into anything, hang in the air, sip at the flowers and sleep at night', () => {
  for (const [theme, seed] of [
    ['sunny', 4242],
    ['candy', 1],
    ['flat', 999],
  ]) {
    const { world, sim } = island(theme, seed);
    let hung = 0;
    let sips = 0;
    let awakeAtNight = 0;
    run(world, sim, 20, (c, night, t) => {
      if (c.type !== 'mosquito') return;
      // Half a minute at dusk and dawn to get to bed.
      if (night && (t % 600) % 480 < 30) return;
      const where = `${theme}: a mosquito at ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`;
      assert.ok([c.x, c.y, c.z, c.yaw].every(Number.isFinite), `${where} is somewhere`);
      assert.ok(c.x >= 0 && c.x <= world.W && c.z >= 0 && c.z <= world.D && c.y >= 1 && c.y <= world.H + 6, `${where} is off the island`);
      const here = world.get(FL(c.x), FL(c.y + 0.15), FL(c.z));
      assert.ok(!B.SOLID[here], `${where} is inside a block`);
      assert.ok(here !== B.WATER || CRITTER_INFO.mosquito.swims, `${where} is under water`);
      if (c.y - skyline(world, c.x, c.z) > 2) hung++;
      if (c.state === 'eat') {
        sips++;
        assert.ok(FLOWERS.has(world.get(FL(c.x), FL(c.y - 0.5), FL(c.z))), `${where} sips at a flower`);
      }
      if (night && c.state !== 'sleep') awakeAtNight++;
      if (c.state === 'sleep') assert.ok(B.SOLID[world.get(FL(c.x), FL(c.y - 0.05), FL(c.z))] || world.get(FL(c.x), FL(c.y), FL(c.z)) === B.WATER, `${where} is asleep in mid-air`);
    });
    assert.ok(hung > 1000, `${theme}: up in the air ${hung} steps`);
    assert.ok(sips > 0, `${theme}: sips at flowers`);
    assert.equal(awakeAtNight, 0, `${theme}: asleep at night`);
  }
});

test('a giant mosquito takes its rider up into the sky, hovers, and comes down again', () => {
  const w = meadow();
  const r = ride(w, 20.5, 6, 20.5);
  assert.ok(r, 'room to get on');
  assert.equal(r.body.flying, false);
  // Creeping about on its legs, slower than you walk.
  go(w, r, { mx: 1, mz: 0 }, 1);
  assert.ok(Math.abs(r.body.vx - CRITTER_INFO.mosquito.ride.walk) < 0.01, `walking at ${r.body.vx}`);
  assert.equal(rideState(r), 'walk');
  // Hold jump: up into the air.
  const up = go(w, r, { jump: true }, 3);
  assert.ok(up.some((ev) => ev.tookOff), 'it took off');
  assert.ok(r.body.y > 9, `up at ${r.body.y.toFixed(1)}`);
  assert.equal(rideState(r), 'fly');
  // Let go of both: it hovers where it is.
  const y0 = r.body.y;
  go(w, r, { mx: 1, mz: 0 }, 2);
  assert.ok(Math.abs(r.body.y - y0) < 0.4, `hovering at ${r.body.y.toFixed(1)}, not ${y0.toFixed(1)}`);
  assert.ok(r.body.x > 21.5, `drifting along at ${r.body.x.toFixed(1)}`);
  // Down held: it comes down and lands.
  const down = go(w, r, { down: true }, 4);
  assert.ok(down.some((ev) => ev.touchedDown), 'it touched down');
  assert.equal(r.body.y, 6, 'back on the ground');
  assert.equal(r.body.flying, false);
});

test('a giant mosquito flying over the sea comes down onto it and floats there', () => {
  // A meadow with a lake in the middle.
  const w = meadow();
  for (let x = 18; x < 30; x++) for (let z = 18; z < 30; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, y === 5 ? B.WATER : B.STONE);
  const r = ride(w, 16.5, 6, 24.5, Math.PI / 2);
  go(w, r, { jump: true }, 2);
  assert.ok(r.body.flying && r.body.y > 10, 'up in the air');
  go(w, r, { mx: 1, mz: 0 }, 1.5);
  assert.ok(r.body.x > 22 && r.body.x < 30, `over the lake at ${r.body.x.toFixed(1)}`);
  go(w, r, { down: true }, 6);
  assert.equal(r.body.flying, false, 'down onto the water');
  assert.ok(r.body.inWater, 'floating');
  assert.ok(r.body.y < 6, `low in the water at ${r.body.y.toFixed(1)}`);
});

test('the host carries a ridden giant mosquito under its rider, flying as they do, and it flies off when they get off', () => {
  const w = meadow();
  const sim = new CritterSim(3);
  const mosquito = sim.add('mosquito', 10.5, 6, 10.5);
  assert.ok(mosquito);
  sim.ride(mosquito.id, 7);
  // The rider, high up in the air on it, holding still: their feet on its
  // back, as they say where they are.
  const at = { x: 15.5, y: 14, z: 12.5, yaw: 1 };
  const seat = riderAt('mosquito', at);
  const rider = { x: seat.x, y: seat.y, z: seat.z, yaw: 1, anim: 6, flying: true };
  sim.step(w, 0.1, 1000, new Map([[7, rider]]));
  assert.deepEqual([mosquito.x, mosquito.y, mosquito.z, mosquito.yaw].map((v) => +v.toFixed(6)), [15.5, 14, 12.5, 1]);
  assert.equal(mosquito.state, 'fly', 'flying with its rider');
  const under = mountUnder('mosquito', rider);
  assert.ok(Math.abs(under.x - 15.5) < 1e-9 && Math.abs(under.y - 14) < 1e-9, 'right under them');
  // Its rider gone: off it flies by itself, up in the air where they left it.
  sim.step(w, 0.1, 1100, new Map());
  assert.equal(mosquito.rider, 0);
  for (let i = 0; i < 30; i++) sim.step(w, 0.1, 1200 + i * 100, new Map());
  assert.ok(mosquito.mode === 'fly' || mosquito.mode === 'hover', `off flying about (${mosquito.mode})`);
  assert.ok(mosquito.y >= 6, `still up in the air at ${mosquito.y.toFixed(1)}`);
  assert.ok(!B.SOLID[w.get(FL(mosquito.x), FL(mosquito.y + 0.15), FL(mosquito.z))], 'not inside anything');
});

test('out of a giant mosquito up in the air, you fly', () => {
  const w = meadow();
  const r = ride(w, 20.5, 12, 20.5);
  r.body.flying = true;
  const at = getOffAt(w, r);
  assert.equal(at.flying, true, 'you fly');
  assert.ok(!B.SOLID[w.get(FL(at.x), FL(at.y), FL(at.z))], 'with room');
});

test('fed a fruit, a giant mosquito flies along with you but never sits on your head', () => {
  const w = meadow();
  const sim = new CritterSim(7);
  const mosquito = sim.add('mosquito', 12.5, 6, 10.5);
  const me = { x: 16.5, y: 6, z: 16.5, yaw: 1, anim: 0, flying: false, hat: 'none' };
  const players = new Map([[1, me]]);
  sim.feed(mosquito.id, 1, me, 0);
  let now = 0;
  for (let i = 0; i < 200; i++) {
    now += 100;
    sim.step(w, 0.1, now, players, false);
  }
  assert.equal(mosquito.follow, 1, 'it follows you');
  assert.equal(mosquito.onHead, 0, 'never on your head');
  assert.equal(mosquito.state, 'fly', 'still flying');
  assert.ok(Math.hypot(mosquito.x - me.x, mosquito.z - me.z) < 4, `hanging about beside you (${Math.hypot(mosquito.x - me.x, mosquito.z - me.z).toFixed(1)} away)`);
});

test('the wire carries a giant mosquito as it is', () => {
  const sim = new CritterSim(1);
  sim.add('mosquito', 10.5, 6, 10.5);
  const row = sim.pack()[0];
  const back = unpackCritter(row);
  assert.equal(back.type, 'mosquito');
  assert.equal(CRITTER_TYPES[CRITTER_TYPES.indexOf('mosquito')], 'mosquito');
  assert.equal(CRITTER_TYPES.at(-1), 'mosquito', 'new kinds go on the end');
});

test('an island from before the giant mosquitos gets them, once', () => {
  const room = new Room({ code: '123456', theme: 'sunny', seed: 77, now: () => 1000 });
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  assert.equal(save.v, 10);
  const count = (r) => r.critters.list.filter((c) => c.type === 'mosquito').length;
  const load = (s) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(s)), now: () => 2000 });
  const old = load({ ...save, v: 9, critters: save.critters.filter((c) => c.type !== 'mosquito') });
  assert.equal(count(old), 2, 'they move in');
  for (const c of old.critters.list.filter((x) => x.type === 'mosquito')) assert.ok(fits(old.world, 'mosquito', c.x, c.y, c.z), 'somewhere with room for a rider');
  assert.equal(count(load(old.exportSave())), 2, 'and only once');
  assert.equal(count(load(save)), count(room), 'a new island keeps its own');
});

test("a giant mosquito's wings beat together and its saddle shows for its rider, in every state", () => {
  const m = new CritterModel('mosquito', 1, 'sunny');
  m.time = 0;
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < 40; i++) {
    m.group.position.y += 0.02;
    m.update(0.013, 'fly', true, 2);
    const [left, right] = m.wings.map((w) => new THREE.Vector3(w.userData.wing * 0.1, 0, 0).applyEuler(w.rotation).add(w.position));
    assert.ok(Math.abs(left.y - right.y) < 1e-9 && Math.abs(left.x + right.x) < 1e-9, 'wings mirror each other');
    low = Math.min(low, left.y);
    high = Math.max(high, left.y);
  }
  assert.ok(high - low > 0.02, `wings beat (${(high - low).toFixed(3)})`);
  assert.equal(m.saddle.visible, false);
  m.setRider('#5fb8f4');
  assert.equal(m.saddle.visible, true);
  for (const state of STATES) {
    for (let i = 0; i < 6; i++) {
      m.group.position.x += 0.12;
      m.update(1 / 30, state, i % 2 === 0, 0.5);
    }
    m.group.updateMatrixWorld(true);
    m.group.traverse((o) => {
      if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${state}: every part is somewhere`);
    });
  }
  m.dispose();
});
