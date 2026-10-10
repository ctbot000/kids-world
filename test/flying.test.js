// Flying: every island's helicopter and hot-air balloon, where they start
// out and the seats in them, taking off, hovering and landing, getting out
// up in the air, coming down by themselves when left up there, and riding
// along with a friend at the controls.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CritterSim, fits, riderAt, seatsFor, waterColumn } from '../public/js/shared/critters.js';
import { getOffAt, rideState, startRide, stepRide } from '../public/js/shared/riding.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const AIR = ['helicopter', 'balloon'];

// A flat island of grass with the sea along one side.
function flat() {
  const w = new World(48, 40, 48, { sea: 10 });
  for (let x = 0; x < 48; x++) {
    for (let z = 0; z < 48; z++) {
      for (let y = 0; y <= 10; y++) w.set(x, y, z, z >= 36 && y >= 6 ? B.WATER : y === 10 ? B.GRASS : B.STONE);
    }
  }
  w.spawn = { x: 20.5, y: 11, z: 20.5 };
  return w;
}

// Steps a ride for secs seconds with this input; returns what happened.
function run(world, ride, input, secs) {
  const evs = [];
  for (let i = 0; i < secs * 60; i++) evs.push(stepRide(world, ride, input, 1 / 60));
  return evs;
}

test('every island has a helicopter and a balloon near where everyone comes in, on dry land with room, clear of the other vehicles', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    for (const [seed, size] of [
      [4242, 'small'],
      [7, 'big'],
      [99, 'huge'],
    ]) {
      const where = `${theme} ${seed} ${size}`;
      const { world, critters } = generate({ seed, theme, size });
      const vehicles = critters.filter((c) => CRITTER_INFO[c.type].vehicle);
      for (const type of AIR) {
        const all = vehicles.filter((c) => c.type === type);
        assert.equal(all.length, 1, `${where}: one ${type}`);
        const [v] = all;
        assert.ok(fits(world, type, v.x, v.y, v.z) && !waterColumn(world, v.x, v.z), `${where}: the ${type} on dry land with room`);
        assert.ok(Math.hypot(v.x - world.spawn.x, v.z - world.spawn.z) < 41, `${where}: the ${type} near the start`);
        for (const o of vehicles) if (o !== v) assert.ok(Math.hypot(o.x - v.x, o.z - v.z) >= 2, `${where}: the ${type} clear of the ${o.type}`);
      }
    }
  }
  // Clear of an adventure island's camps too.
  for (const seed of [5, 11, 4242]) {
    const adv = generate({ seed, theme: 'sunny', size: 'small', adventure: true });
    for (const v of adv.critters.filter((c) => AIR.includes(c.type))) {
      for (const c of adv.camps) assert.ok(Math.hypot(v.x - c.x, v.z - c.z) >= c.r + 3, `${seed}: the ${v.type} clear of camp ${c.id}`);
    }
  }
});

test('a helicopter seats two friends behind its pilot and a balloon four, each in their own seat', () => {
  for (const [type, n] of [
    ['helicopter', 2],
    ['balloon', 4],
  ]) {
    assert.equal(seatsFor(type), n);
    for (const yaw of [0, 1.1, Math.PI, -2.4]) {
      const m = { x: 10, y: 5, z: 20, yaw };
      const seats = Array.from({ length: n + 1 }, (_, i) => riderAt(type, m, i));
      const ahead = (p) => (p.x - m.x) * Math.sin(yaw) + (p.z - m.z) * Math.cos(yaw);
      seats.forEach((p, i) => {
        assert.ok(Math.hypot(p.x - m.x, p.z - m.z) < 1.2, `${type} seat ${i} is in it`);
        if (i) assert.ok(ahead(p) < ahead(seats[0]) - 0.4, `${type} seat ${i} behind the pilot`);
        for (const q of seats.slice(0, i)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 0.55, `${type} seat ${i} has room of its own`);
      });
    }
  }
});

test('jump held takes off and climbs, neither hovers, down comes down and lands; quicker in a helicopter than a balloon', () => {
  const world = flat();
  const speeds = {};
  for (const type of AIR) {
    const ride = startRide(world, type, { x: 20.5, y: 11, z: 20.5, yaw: 0 });
    assert.ok(ride);
    // On the ground, it drives slowly about, and never off it.
    run(world, ride, { mz: 1 }, 1);
    assert.equal(ride.body.y, 11, `${type} on the ground`);
    assert.equal(rideState(ride), 'walk');
    const up = run(world, ride, { jump: true }, 1.5);
    assert.equal(up.filter((e) => e.tookOff).length, 1, `${type} took off, once`);
    assert.ok(ride.body.y > 13, `${type} went up`);
    assert.equal(rideState(ride), 'fly');
    run(world, ride, {}, 0.5);
    const y = ride.body.y;
    const z = ride.body.z;
    run(world, ride, { mz: -1 }, 1);
    assert.ok(Math.abs(ride.body.y - y) < 1e-6, `${type} hovers, neither going up nor down`);
    speeds[type] = z - ride.body.z;
    const down = run(world, ride, { down: true }, 10);
    assert.equal(down.filter((e) => e.touchedDown).length, 1, `${type} landed, once`);
    assert.equal(ride.body.y, 11);
    assert.ok(!ride.body.flying && ride.body.onGround);
  }
  assert.ok(speeds.helicopter > speeds.balloon * 2, 'a helicopter is quicker');
  assert.ok(speeds.balloon > 1);
});

test('coming down onto water, it floats there', () => {
  const world = flat();
  const ride = startRide(world, 'helicopter', { x: 20.5, y: 11, z: 30.5, yaw: 0 });
  run(world, ride, { jump: true }, 1);
  run(world, ride, { mz: 1 }, 1.5);
  assert.ok(waterColumn(world, ride.body.x, ride.body.z), 'over the sea');
  const evs = run(world, ride, { down: true }, 6);
  assert.ok(evs.some((e) => e.splashed));
  assert.ok(!ride.body.flying && ride.body.inWater);
  assert.ok(Math.abs(ride.body.y + 0.5 - 11) < 0.6, 'afloat at the top of the water');
  // And takes off from it again.
  run(world, ride, { jump: true }, 1);
  assert.ok(ride.body.flying && ride.body.y > 12);
});

test('getting out up in the air, you fly; near the ground, you stand on it', () => {
  const world = flat();
  for (const type of AIR) {
    const ride = startRide(world, type, { x: 20.5, y: 11, z: 20.5, yaw: 0 });
    const low = getOffAt(world, ride);
    assert.ok(!low.flying && low.y === 11, `${type}: out onto the ground`);
    run(world, ride, { jump: true }, 2);
    const high = getOffAt(world, ride);
    assert.ok(high.flying, `${type}: out flying`);
    assert.ok(Math.abs(high.y - ride.body.y) < 1e-9);
    assert.ok(Math.hypot(high.x - ride.body.x, high.z - ride.body.z) > CRITTER_INFO[type].ride.radius, `${type}: beside it`);
  }
});

test('left up in the air, a helicopter or a balloon comes gently down by itself', () => {
  const world = flat();
  const sim = new CritterSim(1);
  for (const type of AIR) {
    const c = sim.add(type, 10.5 + sim.list.length * 6, 21, 10.5, null, 0);
    for (let i = 0; i < 10; i++) sim.step(world, 0.1, 0, new Map());
    assert.ok(c.y < 21 && c.y >= 21 - CRITTER_INFO[type].ride.maxFall - 0.05, `${type} drifts down, gently`);
    assert.equal(c.state, 'fly');
    for (let i = 0; i < 100; i++) sim.step(world, 0.1, 0, new Map());
    assert.equal(c.y, 11, `${type} down on the ground`);
    assert.equal(c.state, 'idle');
  }
});

test('one friend flies it and the others hop on, as many as it has seats for; an island from before gets them, once', () => {
  const room = new Room({ code: '123456', theme: 'sunny', seed: 42, now: () => 1000 });
  const people = ['Pilot', 'One', 'Two', 'Three'].map((name) => {
    const c = { inbox: [], send: (t) => c.inbox.push(JSON.parse(t)), close: () => {} };
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
    return c;
  });
  const heli = room.critters.list.find((o) => o.type === 'helicopter');
  for (const who of people) {
    room.receive(who, { t: 'm', s: [heli.x + 1, heli.y, heli.z, 0, 0, 0] });
    room.receive(who, { t: 'critter', op: 'ride', id: heli.id });
  }
  assert.equal(heli.rider, 1);
  assert.deepEqual(heli.passengers, [2, 3]);
  assert.match([...people[3].inbox].reverse().find((m) => m.t === 'notice').text, /is full/);
  // Up it goes with everyone in it, and stays where the pilot left it.
  room.receive(people[0], { t: 'm', s: [heli.x, heli.y + 8, heli.z, 0, 6, 1] });
  room.tick();
  const high = heli.y;
  room.receive(people[0], { t: 'critter', op: 'off' });
  assert.equal(heli.rider, 0);
  assert.deepEqual(heli.passengers, [2, 3]);
  assert.ok(Math.abs(heli.y - high) < 1e-6);

  const save = JSON.parse(JSON.stringify(room.exportSave()));
  assert.equal(save.v, 10);
  const load = (s) => new Room({ code: '123456', save: JSON.parse(JSON.stringify(s)), now: () => 2000 });
  const count = (r) => r.critters.list.filter((c) => AIR.includes(c.type)).length;
  const old = load({ ...save, v: 8, critters: save.critters.filter((c) => !AIR.includes(c.type)) });
  assert.deepEqual(old.critters.list.filter((c) => AIR.includes(c.type)).map((c) => c.type).sort(), ['balloon', 'helicopter']);
  assert.equal(count(load(JSON.parse(JSON.stringify(old.exportSave())))), 2, 'and only once');
  assert.equal(count(load(save)), 2, 'a new island keeps its own');
});

test('flying a helicopter or a balloon earns a sticker of its own', () => {
  const s = STICKERS.find((x) => x.key === 'up-up-away');
  assert.ok(s && STAT_KEYS.includes('flights'));
  assert.ok(s.test({ flights: 1 }) && !s.test({ flights: 0 }));
});
