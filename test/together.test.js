// Riding together: every island's bus and ferry, where they start out, the
// seats in them for friends (each in its own place, turning as it turns),
// and the island letting one friend drive while the others hop on, honk,
// get out, and stay put when the driver goes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CRITTER_INFO, fits, riderAt, seatsFor, swimmable, waterColumn } from '../public/js/shared/critters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { generate } from '../public/js/shared/worldgen.js';

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => (c.t += ms);
  return c;
}

// A fake connection that records what it is sent.
function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

test('every island has a bus near where everyone comes in and a ferry on the sea, clear of the other vehicles', () => {
  for (const theme of ['sunny', 'snowy', 'candy']) {
    for (const [seed, size] of [
      [4242, 'small'],
      [7, 'big'],
      [99, 'huge'],
    ]) {
      const where = `${theme} ${seed} ${size}`;
      const { world, critters } = generate({ seed, theme, size });
      const vehicles = critters.filter((c) => CRITTER_INFO[c.type].vehicle);
      const [bus, ...more] = vehicles.filter((c) => c.type === 'bus');
      const [ferry, ...extra] = vehicles.filter((c) => c.type === 'ferry');
      assert.ok(bus && !more.length, `${where}: a bus`);
      assert.ok(ferry && !extra.length, `${where}: a ferry`);
      assert.ok(fits(world, 'bus', bus.x, bus.y, bus.z) && !waterColumn(world, bus.x, bus.z), `${where}: the bus on dry land with room`);
      assert.ok(Math.hypot(bus.x - world.spawn.x, bus.z - world.spawn.z) < 41, `${where}: the bus near the start`);
      assert.ok(swimmable(world, 'ferry', ferry.x, ferry.z) && waterColumn(world, ferry.x, ferry.z).top === world.sea, `${where}: the ferry on the sea`);
      for (const v of [bus, ferry]) {
        for (const o of vehicles) if (o !== v) assert.ok(Math.hypot(o.x - v.x, o.z - v.z) >= 2, `${where}: the ${v.type} clear of the ${o.type}`);
      }
    }
  }
});

test('on an adventure or tower defense island, the bus and the ferry keep clear of the camps and the road', () => {
  for (const seed of [5, 11, 4242]) {
    const adv = generate({ seed, theme: 'sunny', size: 'small', adventure: true });
    for (const v of adv.critters.filter((c) => c.type === 'bus' || c.type === 'ferry')) {
      for (const c of adv.camps) assert.ok(Math.hypot(v.x - c.x, v.z - c.z) >= c.r + 3, `${seed}: the ${v.type} clear of camp ${c.id}`);
    }
    const def = generate({ seed, theme: 'sunny', size: 'small', defense: true });
    if (!def.defense) continue;
    for (const v of def.critters.filter((c) => c.type === 'bus' || c.type === 'ferry')) {
      for (const [x, , z] of def.defense.path) assert.ok(Math.hypot(v.x - x - 0.5, v.z - z - 0.5) >= 4, `${seed}: the ${v.type} off the road`);
    }
  }
});

test('a bus and a ferry seat six friends behind the driver, each in their own seat, turning as it turns', () => {
  for (const type of ['bus', 'ferry']) {
    assert.equal(seatsFor(type), 6);
    const r = CRITTER_INFO[type].ride;
    for (const yaw of [0, 1.1, Math.PI, -2.4]) {
      const m = { x: 10, y: 5, z: 20, yaw };
      const seats = [0, 1, 2, 3, 4, 5, 6].map((i) => riderAt(type, m, i));
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const ahead = (p) => (p.x - m.x) * fx + (p.z - m.z) * fz;
      seats.forEach((p, i) => {
        assert.equal(p.yaw, yaw);
        assert.equal(p.y, seats[0].y, 'all at the same height');
        assert.ok(Math.hypot(p.x - m.x, p.z - m.z) < 1.4, `${type} seat ${i} is in it`);
        if (i) assert.ok(ahead(p) < ahead(seats[0]) - 0.4, `${type} seat ${i} behind the driver`);
        for (const q of seats.slice(0, i)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 0.55, `${type} seat ${i} has room of its own`);
      });
      // The driver's seat is where it always was.
      assert.deepEqual(seats[0], riderAt(type, m));
    }
  }
  // The other vehicles and animals have room for one.
  for (const type of ['car', 'boat', 'pony', 'whale']) assert.equal(seatsFor(type), 0);
});

test('one friend drives the bus, the others hop on, honk, get out, and stay aboard when the driver goes', () => {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', seed: 42, now: time.now });
  const people = ['Driver', 'Rider One', 'Rider Two', 'Rider Three', 'Rider Four', 'Rider Five', 'Rider Six', 'Rider Seven'].map((n) => join(room, n));
  const [a, b, c] = people;
  const bus = room.critters.list.find((o) => o.type === 'bus');
  assert.ok(bus, 'the island has a bus');
  const near = (who, o) => room.receive(who, { t: 'm', s: [o.x + 1, o.y, o.z, 0, 0, 0] });
  const ride = (who) => {
    near(who, bus);
    room.receive(who, { t: 'critter', op: 'ride', id: bus.id });
  };
  // The first one on drives.
  ride(a);
  assert.equal(bus.rider, 1);
  assert.deepEqual(b.last('ride'), { t: 'ride', id: bus.id, pid: 1 });
  // The next ones ride along, in the first free seat, put there at once.
  ride(b);
  assert.equal(bus.rider, 1);
  assert.deepEqual(bus.passengers, [2, 0, 0, 0, 0, 0]);
  assert.deepEqual(a.last('ride'), { t: 'ride', id: bus.id, pid: 2, seat: 1 });
  const seat = riderAt('bus', bus, 1);
  assert.deepEqual(room.players.get(2).s.slice(0, 3), [seat.x, seat.y, seat.z].map((v) => +v.toFixed(2)));
  ride(c);
  assert.deepEqual(bus.passengers, [2, 3, 0, 0, 0, 0]);
  // Asking again changes nothing.
  ride(c);
  assert.deepEqual(bus.passengers, [2, 3, 0, 0, 0, 0]);
  // Someone joining later is told who sits where.
  const told = room.critters.describe().find((d) => d.id === bus.id);
  assert.equal(told.rider, 1);
  assert.deepEqual(told.passengers, [2, 3, 0, 0, 0, 0]);
  // Riding along, you can honk too.
  room.receive(b, { t: 'critter', op: 'trick' });
  assert.deepEqual(a.last('cfx'), { t: 'cfx', id: bus.id, fx: 'honk', by: 2 });
  // It goes where the driver takes it, with everyone on it, and nobody
  // riding along is pushed about as if they stood there.
  room.receive(a, { t: 'm', s: [40.5, 30, 41.5, 1.5, 6, 0] });
  time.advance(100);
  room.tick();
  assert.ok(Math.abs(bus.x - (40.5 - Math.sin(1.5) * CRITTER_INFO.bus.ride.z)) < 1e-6, 'under its driver');
  assert.ok(room.critters.aboard().has(2) && room.critters.aboard().has(3));
  // Full up: the eighth friend waits.
  for (const who of people.slice(3)) ride(who);
  assert.deepEqual(bus.passengers, [2, 3, 4, 5, 6, 7]);
  const last = people[7];
  assert.match(last.last('notice').text, /is full/);
  assert.ok(!bus.passengers.includes(8));
  // Not sent away with friends in it.
  room.receive(a, { t: 'critter', op: 'off' });
  room.receive(last, { t: 'critter', op: 'bye', id: bus.id });
  assert.ok(room.critters.get(bus.id), 'still here');
  assert.match(last.last('notice').text, /Wait until they get off/);
  // The driver got out; those riding along stay in their seats, and the next
  // one to get on takes the wheel.
  assert.equal(bus.rider, 0);
  assert.deepEqual(bus.passengers, [2, 3, 4, 5, 6, 7]);
  ride(last);
  assert.equal(bus.rider, 8);
  // Getting out, or going home, frees the seat for someone else.
  room.receive(b, { t: 'critter', op: 'off' });
  assert.deepEqual(a.last('ride'), { t: 'ride', id: bus.id, pid: 0, seat: 1 });
  room.receive(c, { t: 'leave' });
  assert.deepEqual(bus.passengers, [0, 0, 4, 5, 6, 7]);
  ride(a);
  assert.deepEqual(bus.passengers, [1, 0, 4, 5, 6, 7]);
  // Riding along in one thing gets you out of it to drive another.
  const car = room.critters.list.find((o) => o.type === 'car');
  near(a, car);
  room.receive(a, { t: 'critter', op: 'ride', id: car.id });
  assert.equal(car.rider, 1);
  assert.deepEqual(bus.passengers, [0, 0, 4, 5, 6, 7]);
  // And a car has room for its driver only.
  near(b, car);
  room.receive(b, { t: 'critter', op: 'ride', id: car.id });
  assert.equal(car.rider, 1);
  assert.match(b.last('notice').text, /already riding/);
});

test('riding along with a friend at the wheel earns a sticker of its own', () => {
  const s = STICKERS.find((x) => x.key === 'all-aboard');
  assert.ok(s && STAT_KEYS.includes('along'));
  assert.ok(s.test({ along: 1 }) && !s.test({ along: 0 }));
});
