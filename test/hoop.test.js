// The hula hoop: put down from the toy box like a sled, spun round a
// player's waist (going round with them at the island), dropped where they
// stand, and how far round it has gone as it spins and wobbles down.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, critterBox, hoopTurn, VEHICLES } from '../public/js/shared/critters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

// A flat meadow: grass at y 10 everywhere, with the start in the middle.
function meadowRoom() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now });
  const W = 64;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.world = w;
  room.hookWorld();
  for (const c of [...room.critters.list]) room.critters.remove(c.id);
  return { room, time };
}

const at = (c, x, z) => ({ t: 'm', s: [x, 11, z, 0, 0, 0] });
const step = (room, time, ms = 100) => {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
};

test('a hula hoop is in the toy box with the vehicles, lies flat without bumping anyone, and turns steadily, slowing as it wobbles down', () => {
  assert.ok(VEHICLES.includes('hoop'));
  assert.equal(CRITTER_INFO.hoop.ride, undefined, 'nobody rides it');
  assert.equal(critterBox('hoop'), null, 'nothing to bump into: you walk over it, and spun it is round you');
  const spin = CRITTER_INFO.hoop.hoop;
  assert.equal(hoopTurn(0, spin), 0);
  assert.ok(Math.abs(hoopTurn(2, spin) - 2 * spin.rate) < 1e-9, 'steady while it is up');
  const end = hoopTurn(spin.spin, spin);
  const late = hoopTurn(spin.spin + spin.wobble, spin);
  assert.ok(late > end && late - end < spin.wobble * spin.rate * 0.8, 'slower as it wobbles down');
  assert.equal(hoopTurn(spin.spin + spin.wobble + 5, spin), late, 'and still once it is down');
});

test('a hoop put down is spun by one player at a time, goes round with them, and drops where they stand', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const pa = a.last('welcome').you;
  const pb = b.last('welcome').you;
  room.receive(a, at(a, 20.5, 20.5));
  room.receive(b, at(b, 40.5, 40.5));
  // Put down from the toy box beside you, as a sled is.
  room.receive(a, { t: 'critter', op: 'invite', type: 'hoop', x: 21.5, y: 11, z: 20.5 });
  const added = b.last('cadd');
  assert.equal(added?.critter.type, 'hoop');
  const hoop = room.critters.get(added.critter.id);
  // Lying there, the island steps it as any vehicle, without a ride to go by.
  step(room, time, 2000);
  assert.ok(Math.abs(hoop.y - 11) < 0.2, `on the grass: ${hoop.y}`);
  // From far off: nothing.
  room.receive(b, { t: 'hoop', op: 'spin', id: hoop.id });
  assert.equal(hoop.hooper ?? 0, 0, 'too far away to spin it');
  // Beside it: round your waist, and everyone is told.
  room.receive(a, { t: 'hoop', op: 'spin', id: hoop.id });
  assert.equal(hoop.hooper, pa);
  assert.deepEqual(b.last('hoop'), { t: 'hoop', op: 'spin', id: hoop.id, pid: pa });
  assert.deepEqual(a.last('hoop'), { t: 'hoop', op: 'spin', id: hoop.id, pid: pa });
  // It goes where you go, round your waist, and the island says it is spinning.
  room.receive(a, at(a, 24.5, 22.5));
  step(room, time);
  assert.deepEqual([hoop.x, hoop.z, hoop.state], [24.5, 22.5, 'hoop']);
  // A friend come over cannot take it from you, nor send it away.
  room.receive(b, at(b, 24.5, 23.5));
  room.receive(b, { t: 'hoop', op: 'spin', id: hoop.id });
  room.receive(b, { t: 'hoop', op: 'drop', id: hoop.id });
  assert.equal(hoop.hooper, pa);
  room.receive(b, { t: 'critter', op: 'bye', id: hoop.id });
  assert.ok(room.critters.get(hoop.id), 'still here');
  assert.match(b.last('notice').text, /spinning/);
  // Dropped: down at your feet, and everyone is told.
  room.receive(a, { t: 'hoop', op: 'drop', id: hoop.id });
  assert.equal(hoop.hooper, 0);
  assert.deepEqual(b.last('hoop'), { t: 'hoop', op: 'drop', id: hoop.id, pid: pa });
  step(room, time, 1000);
  assert.ok(Math.hypot(hoop.x - 24.5, hoop.z - 22.5) < 0.6 && hoop.state === 'idle', `where it dropped: ${hoop.x}, ${hoop.z}, ${hoop.state}`);
  // Now the friend may spin it; going home drops it too.
  room.receive(b, { t: 'hoop', op: 'spin', id: hoop.id });
  assert.equal(hoop.hooper, pb);
  room.detach(b);
  assert.equal(hoop.hooper, 0, 'dropped as they go');
  assert.deepEqual(a.last('hoop'), { t: 'hoop', op: 'drop', id: hoop.id, pid: pb });
  // Nobody spinning it, it can be sent away again.
  room.receive(a, { t: 'critter', op: 'bye', id: hoop.id });
  assert.equal(room.critters.get(hoop.id), null);
});

test('a hoop left spinning by someone gone quiet drops by itself once its time is up', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  room.receive(a, at(a, 20.5, 20.5));
  room.receive(a, { t: 'critter', op: 'invite', type: 'hoop', x: 21.5, y: 11, z: 20.5 });
  const hoop = room.critters.list.find((c) => c.type === 'hoop');
  room.receive(a, { t: 'hoop', op: 'spin', id: hoop.id });
  assert.equal(hoop.hooper, a.last('welcome').you);
  const spin = CRITTER_INFO.hoop.hoop;
  step(room, time, (spin.spin + spin.wobble + 3) * 1000);
  assert.equal(hoop.hooper, 0);
  assert.equal(hoop.state, 'idle');
});
