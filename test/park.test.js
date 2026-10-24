// Fun park islands: the park in the middle (its plaza, the roller coaster's
// loop of rails, the rides, nothing of the island's own growing in it), the
// coaster's cars going round it, the merry-go-round's and the Ferris
// wheel's seats as they turn, and the island letting everyone hop on them
// with nobody driving.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { ANIMAL_TYPES, CRITTER_INFO, HIPS, isFixed, riderAt, spinAt, spinSeat, VEHICLES } from '../public/js/shared/critters.js';
import { inPark, PARK_HALF } from '../public/js/shared/park.js';
import { railNext, startRide, stepRide } from '../public/js/shared/riding.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { randomIslandName } from '../public/js/shared/words.js';
import { normalizeMeta } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';

const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  return c;
}

function join(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

// The rails round the coaster, from the station's first one: each joined
// to two others, all the way round and back.
function loop(world, start) {
  const seen = [start];
  let at = start;
  let came = -1;
  for (let guard = 0; guard < 500; guard++) {
    const ways = DIRS.map((_, d) => d).filter((d) => railNext(world, at.x, at.y, at.z, d));
    assert.equal(ways.length, 2, `the rail at ${at.x},${at.y},${at.z} joins two others`);
    const d = ways.find((e) => came < 0 || e !== (came + 2) % 4);
    const next = railNext(world, at.x, at.y, at.z, d);
    came = d;
    if (next.x === start.x && next.y === start.y && next.z === start.z) return seen;
    seen.push(next);
    at = next;
  }
  assert.fail('the rails never come back round');
}

test('a fun park island is a kind of island, saved and named as one', () => {
  assert.ok(THEMES.some((t) => t.key === 'park' && t.icon === '🎡'));
  assert.equal(normalizeMeta({ theme: 'park' }).theme, 'park');
  for (let i = 0; i < 20; i++) assert.match(randomIslandName('park', Math.random), /^\S+ (Park|Island|Fair|Land|Pier|Isle)$/);
});

test('the park: a flat plaza, a Ferris wheel and a merry-go-round, everyone arriving inside the gate, and nothing wild growing in it', () => {
  for (const [seed, size] of [
    [1, 'small'],
    [2, 'small'],
    [77, 'big'],
    [5, 'huge'],
  ]) {
    const where = `${seed} ${size}`;
    const { world, critters } = generate({ seed, theme: 'park', size });
    const park = { cx: Math.floor(world.W / 2), cz: Math.floor(world.D / 2) };
    const level = world.sea + 4;
    // Flat, every column of it, and paved or a lawn.
    for (let x = park.cx - PARK_HALF; x <= park.cx + PARK_HALF; x++) {
      for (let z = park.cz - PARK_HALF; z <= park.cz + PARK_HALF; z++) {
        assert.ok(B.SOLID[world.get(x, level, z)], `${where}: ground at ${x},${z}`);
        assert.ok(!B.TREE_PART[world.get(x, level + 1, z)] && world.get(x, level + 1, z) !== B.WOOD, `${where}: no tree at ${x},${z}`);
      }
    }
    const rides = critters.filter((c) => isFixed(c.type));
    assert.deepEqual(rides.map((c) => c.type).sort(), ['carousel', 'ferris'], `${where}: one of each ride`);
    for (const r of rides) {
      assert.ok(inPark(park, r.x, r.z, 0) && r.y === level + 1, `${where}: the ${r.type} on the plaza`);
      // Nothing else stands where it does.
      for (const o of critters) if (o !== r && CRITTER_INFO[o.type].vehicle) assert.ok(Math.hypot(o.x - r.x, o.z - r.z) > CRITTER_INFO[r.type].ride.radius + 1, `${where}: the ${o.type} clear of the ${r.type}`);
    }
    // Everyone comes in on the plaza, with room to stand, looking up it.
    const s = world.spawn;
    assert.ok(inPark(park, s.x, s.z, 0) && s.y === level + 1 && s.yaw === 0, `${where}: the start inside the park`);
    for (const dy of [0, 1]) assert.equal(world.get(Math.floor(s.x), s.y + dy, Math.floor(s.z)), B.AIR, `${where}: room at the start`);
    // The animals live outside it.
    for (const c of critters) if (['bunny', 'chick', 'sheep'].includes(c.type)) assert.ok(!inPark(park, c.x, c.z, 0), `${where}: the ${c.type} outside the park`);
  }
});

test('the roller coaster is one loop of rails, up a lift hill and down its drops, with cars at its station', () => {
  const { world, critters } = generate({ seed: 3, theme: 'park' });
  const park = { cx: Math.floor(world.W / 2), cz: Math.floor(world.D / 2) };
  // (Not the mine carts in the island's mines.)
  const cars = critters.filter((c) => c.type === 'minecart' && inPark(park, c.x, c.z, 0));
  assert.ok(cars.length >= 3, 'cars on the rails');
  const first = cars[0];
  const rails = loop(world, { x: Math.floor(first.x), y: Math.floor(first.y), z: Math.floor(first.z) });
  assert.equal(rails.length, 100);
  for (const c of cars) assert.ok(rails.some((r) => r.x === Math.floor(c.x) && r.y === Math.floor(c.y) && r.z === Math.floor(c.z)), 'every car on the loop');
  const ys = rails.map((r) => r.y);
  assert.equal(Math.max(...ys) - Math.min(...ys), 8, 'eight blocks up at the top');
  // Every rail up off the ground stands on something.
  for (const r of rails) assert.ok(B.SOLID[world.get(r.x, r.y - 1, r.z)], `something under the rail at ${r.x},${r.y},${r.z}`);
});

test('a coaster car pushed along goes all the way round, faster down the drops than you push, and coasts back down without it', () => {
  const { world, critters } = generate({ seed: 1, theme: 'park' });
  const car = critters.find((c) => c.type === 'minecart' && world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === B.RAIL);
  const ride = startRide(world, 'minecart', car);
  const start = `${Math.floor(car.x)},${Math.floor(car.z)}`;
  const seen = new Set();
  let top = 0;
  let laps = 0;
  let was = start;
  for (let t = 0; t < 40; t += 1 / 60) {
    // Pushing the way it goes, as a rider looking ahead does.
    const [dx, dz] = ride.rail?.next ? DIRS[ride.rail.d] : [0, -1];
    stepRide(world, ride, { mx: dx, mz: dz }, 1 / 60);
    assert.ok(ride.rail, 'still on the rails');
    const k = `${ride.rail.x},${ride.rail.z}`;
    seen.add(k);
    if (k === start && was !== start) laps++;
    was = k;
    top = Math.max(top, ride.rail.v);
  }
  assert.equal(seen.size, 100, 'all the way round');
  assert.ok(laps >= 2, `round and round (${laps} times)`);
  assert.ok(top > CRITTER_INFO.minecart.ride.rails.speed + 3, `faster down the drops (${top.toFixed(1)})`);
  // Left alone halfway up the lift, it rolls back down to the station.
  const idle = startRide(world, 'minecart', car);
  for (let t = 0; t < 2.5; t += 1 / 60) stepRide(world, idle, { mx: 0, mz: -1 }, 1 / 60);
  assert.ok(idle.rail.y > car.y + 1, 'up the lift');
  let high = 0;
  for (let t = 0; t < 8; t += 1 / 60) {
    stepRide(world, idle, { mx: 0, mz: 0 }, 1 / 60);
    high = Math.max(high, idle.rail.y);
  }
  assert.ok(high < car.y + 8 && idle.rail.y <= car.y + 1, `back down without a push (up to ${high - car.y})`);
});

test('the merry-go-round carries its riders round on horses going up and down, and the Ferris wheel round in cabins', () => {
  const m = { x: 20.5, y: 10, z: 30.5, yaw: 0.4 };
  const c = CRITTER_INFO.carousel.ride;
  for (const spin of [0, 1, 2.5]) {
    const seats = c.seats.map((_, i) => spinSeat('carousel', m, i, spin));
    for (const s of seats) {
      assert.ok(Math.abs(Math.hypot(s.x - m.x, s.z - m.z) - 2.45) < 0.01, 'on the ring of horses');
      assert.ok(s.y >= m.y + c.seat - 0.3 && s.y <= m.y + c.seat + c.bob, 'up and down on its pole');
    }
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) assert.ok(Math.hypot(seats[i].x - seats[j].x, seats[i].z - seats[j].z) > 1.5, 'a horse each');
  }
  // Going round: a little later, each rider is further round, facing the way they go.
  const a = spinSeat('carousel', m, 0, 1);
  const b = spinSeat('carousel', m, 0, 1.05);
  const along = Math.atan2(b.x - a.x, b.z - a.z);
  assert.ok(Math.cos(along - a.yaw) > 0.99, 'facing the way it goes');
  // The Ferris wheel's cabins, on a wheel across the way it faces.
  const w = CRITTER_INFO.ferris.ride;
  const f = { x: 50.5, y: 10, z: 40.5, yaw: 0 };
  const cabins = w.seats.map((_, i) => spinSeat('ferris', f, i, 0.3));
  for (const s of cabins) {
    assert.ok(Math.abs(s.z - f.z) < 1e-6, 'in the plane of the wheel');
    assert.ok(Math.abs(Math.hypot(s.x - f.x, s.y - (f.y + w.wheel.hub - w.wheel.hang + w.seat - 0.25)) - w.wheel.r) < 1e-6, 'round the hub');
  }
  const low = Math.min(...[0, 0.5, 1, 1.5, 2, 2.5].flatMap((spin) => w.seats.map((_, i) => spinSeat('ferris', f, i, spin).y)));
  assert.ok(low > f.y && low < f.y + 1.2, 'the bottom cabin a step up off the ground');
  // riderAt is the same, by the clock.
  const now = Date.now();
  const at = riderAt('ferris', { ...f, spin: spinAt('ferris', now) }, 3);
  assert.deepEqual(at, spinSeat('ferris', f, 2, spinAt('ferris', now)));
});

test('everyone hops on a ride with nobody driving, in the seat nearest them; it stays, and is not in the toy box', () => {
  assert.ok(!VEHICLES.includes('ferris') && !VEHICLES.includes('carousel') && !ANIMAL_TYPES.includes('ferris'));
  const room = new Room({ code: '123456', theme: 'park', seed: 9, now: () => 1_000_000 });
  const [a, b] = ['Ann', 'Bo'].map((n) => join(room, n));
  const wheel = room.critters.list.find((c) => c.type === 'ferris');
  const go = (who, pid, at) => {
    room.receive(who, { t: 'm', s: [at.x, at.y, at.z, 0, 0, 0] });
    room.receive(who, { t: 'critter', op: 'ride', id: wheel.id });
  };
  // At the foot of the wheel: into the cabin at the bottom.
  const foot = { x: wheel.x, y: wheel.y, z: wheel.z + 2 };
  go(a, 1, foot);
  assert.equal(wheel.rider, 0, 'nobody drives it');
  const seat = wheel.passengers.indexOf(1);
  assert.ok(seat >= 0, 'Ann rides in a cabin');
  const spin = spinAt('ferris');
  const ys = wheel.passengers.map((_, i) => spinSeat('ferris', wheel, i, spin).y);
  assert.ok(ys[seat] <= Math.min(...ys) + 1.6, 'the one at the bottom');
  assert.deepEqual(b.last('ride'), { t: 'ride', id: wheel.id, pid: 1, seat: seat + 1 });
  go(b, 2, foot);
  assert.equal(wheel.passengers.filter(Boolean).length, 2, 'Bo too, in a cabin of their own');
  // Sent away? No: it is the park's.
  room.receive(a, { t: 'critter', op: 'off' });
  room.receive(b, { t: 'critter', op: 'off' });
  room.receive(a, { t: 'critter', op: 'bye', id: wheel.id });
  assert.ok(room.critters.get(wheel.id));
  assert.match(a.last('notice').text, /part of the fun park/);
  // Nor brought from the toy box.
  const n = room.critters.list.length;
  room.receive(a, { t: 'critter', op: 'invite', type: 'carousel', x: wheel.x + 20, y: wheel.y, z: wheel.z + 20 });
  assert.equal(room.critters.list.length, n);
  // And it stays where it was built, however long the island runs.
  const was = { x: wheel.x, y: wheel.y, z: wheel.z, yaw: wheel.yaw };
  for (let i = 0; i < 20; i++) room.critters.step(room.world, 0.1, 1_000_000 + i * 100, new Map());
  assert.deepEqual({ x: wheel.x, y: wheel.y, z: wheel.z, yaw: wheel.yaw }, was);
});

test('on the models, every rider sits on a saddle or a cabin seat of their own, where spinSeat says, as the ride turns', () => {
  const real = Date.now;
  try {
    for (const type of ['carousel', 'ferris']) {
      for (const ms of [1_000_000, 1_004_321, 1_017_000]) {
        Date.now = () => ms;
        const m = new CritterModel(type, 1);
        m.group.position.set(5, 2, 7);
        m.group.rotation.y = 0.6;
        m.update(1 / 60, 'idle', false, 0);
        m.group.updateMatrixWorld(true);
        const at = { x: 5, y: 2, z: 7, yaw: 0.6 };
        CRITTER_INFO[type].ride.seats.forEach((_, i) => {
          const s = spinSeat(type, at, i, spinAt(type));
          const hips = s.y + HIPS;
          const ray = new THREE.Raycaster(new THREE.Vector3(s.x, hips + 0.4, s.z), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(m.group, true)[0];
          assert.ok(hit && Math.abs(hit.point.y - hips) < 0.03, `${type} at ${ms}: seat ${i} under its rider (${hit?.point.y.toFixed(3)} for ${hips.toFixed(3)})`);
          assert.equal(hit.object.material, m.seatPads[i], `${type} at ${ms}: seat ${i} its own`);
        });
        m.dispose();
      }
    }
  } finally {
    Date.now = real;
  }
});
