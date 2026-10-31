// Fun park islands: the park in the middle (its plaza, the rides, nothing of
// the island's own growing in it), the roller coaster's track and its
// train's run round it, the merry-go-round's and the Ferris wheel's seats
// as they turn, and the island letting everyone hop on them with nobody
// driving (the coaster only at its station).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { ANIMAL_TYPES, CRITTER_INFO, HIPS, isFixed, riderAt, spinAt, spinSeat, VEHICLES } from '../public/js/shared/critters.js';
import { inPark, PARK_HALF } from '../public/js/shared/park.js';
import { DWELL, G, LOOP_TOP, MARKS, RUN, SEATS, STEP, TRACK, trackAt, trainAt } from '../public/js/shared/coaster.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { randomIslandName } from '../public/js/shared/words.js';
import { normalizeMeta } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';

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
        // No tent cloth over the coaster's station (its roof would be a tent to camp out in).
        if (x - park.cx >= -13 && x - park.cx <= -6) for (let y = level + 1; y < level + 8; y++) assert.ok(!B.CLOTHS.includes(world.get(x, y, z)), `${where}: no tent cloth at ${x},${y},${z}`);
      }
    }
    const rides = critters.filter((c) => isFixed(c.type));
    assert.deepEqual(rides.map((c) => c.type).sort(), ['carousel', 'coaster', 'ferris'], `${where}: one of each ride`);
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

test('the roller coaster’s track: one smooth closed loop in the park, clear of everything, up a lift hill, down a drop and head down round a loop', () => {
  const n = TRACK.pts.length;
  // Closed, and smooth: no sharp bend from one sample to the next.
  assert.ok(Math.hypot(...TRACK.pts[0].p.map((v, k) => v - TRACK.pts[n - 1].p[k])) < STEP * 1.5, 'closed');
  for (let i = 0; i < n; i++) {
    const a = TRACK.pts[i];
    const b = TRACK.pts[(i + 1) % n];
    const bend = Math.acos(Math.min(1, a.t[0] * b.t[0] + a.t[1] * b.t[1] + a.t[2] * b.t[2]));
    const roll = Math.acos(Math.min(1, a.up[0] * b.up[0] + a.up[1] * b.up[1] + a.up[2] * b.up[2]));
    assert.ok(bend < 0.1 && roll < 0.1, `smooth at ${i}: bends ${bend.toFixed(3)}, rolls ${roll.toFixed(3)}`);
  }
  // Never through itself: anywhere more than a train's length apart along
  // it is more than a train's width apart.
  for (let i = 0; i < n; i += 2) {
    for (let j = i + 2; j < n; j += 2) {
      const along = Math.min(j - i, n - (j - i)) * TRACK.step;
      if (along > 3) assert.ok(Math.hypot(...TRACK.pts[i].p.map((v, k) => v - TRACK.pts[j].p[k])) > 1.6, `clear of itself at ${i} and ${j}`);
    }
  }
  const ys = TRACK.pts.map((q) => q.p[1]);
  assert.ok(Math.max(...ys) > 14, 'a lift hill fourteen blocks up');
  assert.ok(TRACK.pts.some((q) => q.up[1] < -0.95), 'head down at the top of the loop');
  // In the park, nothing in its way: no block where the track or a rider's head is.
  for (const seed of [1, 7]) {
    const { world, critters } = generate({ seed, theme: 'park' });
    const park = { cx: Math.floor(world.W / 2), cz: Math.floor(world.D / 2) };
    const c = critters.find((o) => o.type === 'coaster');
    for (const q of TRACK.pts) {
      const at = (h) => [c.x + q.p[0] + q.up[0] * h, c.y + q.p[1] + q.up[1] * h, c.z + q.p[2] + q.up[2] * h];
      assert.ok(inPark(park, at(0)[0], at(0)[2], 0) && q.p[1] > 0.1, `${seed}: in the park, off the ground`);
      // (And either side of it, as wide as the train.)
      for (const h of [0, 1, 1.8]) {
        for (const w of [-0.6, 0, 0.6]) {
          const p = at(h).map((v, k) => v + q.left[k] * w);
          assert.ok(!B.SOLID[world.get(...p.map(Math.floor))], `${seed}: nothing in the way at ${p.map((v) => v.toFixed(2))}`);
        }
      }
    }
  }
});

test('the coaster’s train goes round by itself, the same on every page: waiting at the station, up the chain, faster and faster down the drop, pressed into its seats over the top of the loop, and braked to a stop back at the station', () => {
  assert.ok(RUN.period > DWELL + 15 && RUN.period < 60, `a ride of ${RUN.period.toFixed(1)} s`);
  const at = (t) => trainAt(1_000_000_000 * RUN.period + t * 1000);
  assert.deepEqual(at(0), at(0), 'the same every time');
  assert.equal(at(1).phase, 'station');
  assert.equal(at(DWELL - 0.1).phase, 'station');
  assert.equal(at(1).s, MARKS.STOP);
  // Out, on round: never backwards, never stopped out on the track.
  let s = MARKS.STOP;
  let top = 0;
  let lift = 0;
  const steps = [];
  for (let t = DWELL; t < RUN.period - 0.05; t += 0.05) {
    const now = at(t);
    const along = (now.s - MARKS.STOP + TRACK.len) % TRACK.len;
    steps.push(along);
    assert.ok(now.v > 0, `moving at ${t.toFixed(2)}`);
    if (now.phase === 'lift') lift = Math.max(lift, now.v);
    top = Math.max(top, now.v);
    s = now.s;
  }
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1] - 1e-9 || steps[i] < 1, 'only ever onwards');
  assert.ok(Math.abs(lift - 3) < 0.05, 'up the chain at a steady 3 blocks a second');
  assert.ok(top > 13, `fast down the drop (${top.toFixed(1)})`);
  // Over the top of the loop fast enough to be pressed into the seat.
  const [, v] = RUN.run.reduce((best, r) => (Math.abs(trackAt(r[0]).p[1] - LOOP_TOP) < Math.abs(trackAt(best[0]).p[1] - LOOP_TOP) && trackAt(r[0]).up[1] < 0 ? r : best));
  assert.ok((v * v) / 4.6 > G * 1.3, `over the top of the loop at ${v.toFixed(1)}`);
  // And back, stopped, where it started.
  assert.equal(at(RUN.period + 0.5).s, MARKS.STOP);
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

test('the coaster takes riders on only at its station, two to a car, and lets nobody off out on the track', () => {
  const real = Date.now;
  const cycle = RUN.period * 1000;
  try {
    Date.now = () => 500 * cycle + 2000;
    const room = new Room({ code: '123456', theme: 'park', seed: 9, now: () => 1_000_000 });
    const people = ['Ann', 'Bo', 'Cy'].map((n) => join(room, n));
    const coaster = room.critters.list.find((c) => c.type === 'coaster');
    assert.equal(coaster.passengers.length, SEATS);
    const ride = (who) => {
      room.receive(who, { t: 'm', s: [coaster.x + 1.2, coaster.y, coaster.z + 0.5, 0, 0, 0] });
      room.receive(who, { t: 'critter', op: 'ride', id: coaster.id });
    };
    // In the station: in, each to a seat of their own, nobody driving.
    ride(people[0]);
    ride(people[1]);
    assert.equal(coaster.rider, 0);
    assert.deepEqual(coaster.passengers.filter(Boolean).sort(), [1, 2]);
    // Out on the track: nobody gets on.
    Date.now = () => 500 * cycle + (DWELL + 10) * 1000;
    ride(people[2]);
    assert.ok(!coaster.passengers.includes(3));
    assert.match(people[2].last('notice').text, /out on the track/);
  } finally {
    Date.now = real;
  }
});

test('on the models, every rider sits on a saddle or a cabin seat of their own, where spinSeat says, as the ride turns', () => {
  const real = Date.now;
  try {
    for (const type of ['carousel', 'ferris', 'coaster']) {
      for (const ms of [1_000_000, 1_004_321, 1_017_000, 1_031_500]) {
        Date.now = () => ms;
        const m = new CritterModel(type, 1);
        m.group.position.set(5, 2, 7);
        m.group.rotation.y = 0.6;
        m.update(1 / 60, 'idle', false, 0);
        m.group.updateMatrixWorld(true);
        const at = { x: 5, y: 2, z: 7, yaw: 0.6 };
        CRITTER_INFO[type].ride.seats.forEach((_, i) => {
          const s = riderAt(type, { ...at, ms }, i + 1);
          // Down onto the seat the way the rider's own up is (on the
          // coaster, turned with the track).
          const up = s.q ? new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(...s.q)) : new THREE.Vector3(0, 1, 0);
          const hips = new THREE.Vector3(s.x, s.y, s.z).addScaledVector(up, HIPS);
          const ray = new THREE.Raycaster(hips.clone().addScaledVector(up, 0.4), up.clone().negate());
          const hit = ray.intersectObject(m.group, true)[0];
          assert.ok(hit && hit.point.distanceTo(hips) < 0.03, `${type} at ${ms}: seat ${i} under its rider (${hit?.point.distanceTo(hips).toFixed(3)} off)`);
          assert.equal(hit.object.material, m.seatPads[i], `${type} at ${ms}: seat ${i} its own`);
        });
        m.dispose();
      }
    }
  } finally {
    Date.now = real;
  }
});
