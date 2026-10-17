// Broadcast stations: a TV camera on a tripod, furniture that turns, in the
// Home tab after the TVs, its lens at the front; found beside you; who is on
// air checked; the 📹 On Air channel on every TV while someone is; and the
// island telling everyone who is on air, one at a time, until they stop or
// leave.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { stationId } from '../public/js/shared/broadcast.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanOnAir, isBroadcastStation, onAirShow, stationNear } from '../public/js/shared/station.js';
import { CHANNELS, channelsWith, LIVE, ON_AIR } from '../public/js/shared/tv.js';
import { World } from '../public/js/shared/world.js';

test('the Broadcast Station is furniture that turns, after the TVs in the Home tab, a camera on a tripod with its lens at the front', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.WALL_TV) + 1], B.BROADCAST_STATION);
  const d = B.BLOCKS[B.BROADCAST_STATION];
  assert.equal(d.kind, 'furniture');
  assert.equal(d.name, 'Broadcast Station');
  for (let k = 0; k < 4; k++) assert.ok(isBroadcastStation(B.BROADCAST_STATION + k), `facing ${k}`);
  const boxes = modelBoxes(B.BROADCAST_STATION);
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    assert.ok(x0 >= 0 && z0 >= 0 && x1 <= 1 && z1 <= 1 && y0 >= 0 && y1 <= 1, 'inside its cell');
    assert.ok(x1 > x0 && y1 > y0 && z1 > z0);
  }
  // The lens glass glowing at the very front, up on the tripod, and the red light.
  const glow = boxes.filter((b) => b[7] === 'glow');
  const front = Math.min(...boxes.map((b) => b[2]));
  assert.ok(glow.some((b) => b[2] <= front + 0.01 && b[1] > 0.5), 'the lens at the front');
  assert.ok(glow.some((b) => b[6] === '#ff3b30'), 'the ON AIR light');
  assert.ok(boxes.some((b) => b[1] === 0), 'standing on the floor');
  for (const id of [B.TV, B.PIANO, B.AIR]) assert.ok(!isBroadcastStation(id));
});

test('the broadcast station beside you is found, and none further away', () => {
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.turnedTo(B.BROADCAST_STATION, 1));
  const near = stationNear(w, { x: 8.5, y: 5, z: 6.8 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z }, { x: 8, y: 5, z: 8 });
  assert.equal(stationNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(stationNear(w, { x: 8.5, y: 9, z: 7 }), null, 'up above it');
});

test('who is on air is checked, and a TV plays their station', () => {
  const station = stationId();
  assert.deepEqual(cleanOnAir({ pid: 2, name: 'Happy Panda', station, extra: 1 }), { pid: 2, name: 'Happy Panda', station });
  for (const bad of [null, 'x', { pid: 0, station }, { pid: 1.5, station }, { pid: 2, station: 'kids-world-keeper' }, { pid: 2 }]) assert.equal(cleanOnAir(bad), null);
  assert.deepEqual(onAirShow({ pid: 2, name: 'Happy Panda', station }), { kind: 'video', station, title: 'Happy Panda, live' });
});

test('every TV has the 📹 On Air channel while someone is on air, after its own and before the keeper’s 📡 Live', () => {
  assert.equal(channelsWith(null, null), CHANNELS);
  assert.deepEqual(channelsWith(null, { pid: 1 }), [...CHANNELS, ON_AIR]);
  assert.deepEqual(channelsWith({}, { pid: 1 }), [...CHANNELS, ON_AIR, LIVE]);
  assert.deepEqual(channelsWith({}), [...CHANNELS, LIVE]);
});

test('the island tells everyone who is on air from a broadcast station: one at a time, from beside one, until they stop or leave', () => {
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  const conn = (name) => {
    const c = { inbox: [] };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    c.close = () => {};
    c.all = (t) => c.inbox.filter((m) => m.t === t);
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat' } });
    c.pid = c.inbox.find((m) => m.t === 'welcome').you;
    return c;
  };
  const a = conn('Happy Panda');
  const b = conn('Brave Fox');
  assert.equal(a.inbox.find((m) => m.t === 'welcome').onAir, null, 'nobody on air yet');
  const p = room.players.get(a.pid);
  const [x, z] = [Math.floor(p.s[0]) + 2, Math.floor(p.s[2])];
  const y = room.world.top(x, z) + 1;
  room.world.set(x, y, z, B.BROADCAST_STATION);
  p.s = [x - 0.5, y, z + 0.5];
  const station = stationId();

  // Nothing that is not a station's id, at a station, from beside it.
  for (const bad of [{ station: 'nope' }, { at: [x, y + 1, z] }, { at: [x, y] }, { at: 'here' }]) room.receive(a, { t: 'onair', station, at: [x, y, z], ...bad });
  p.s = [x + 8, y, z];
  room.receive(a, { t: 'onair', station, at: [x, y, z] });
  assert.equal(b.all('onair').length, 0);
  assert.equal(room.onAir, null);

  // On air: everyone hears it, and a newcomer when they come.
  p.s = [x - 0.5, y, z + 0.5];
  room.receive(a, { t: 'onair', station, at: [x, y, z] });
  const on = { pid: a.pid, name: 'Happy Panda', station };
  assert.deepEqual(b.all('onair'), [{ t: 'onair', on }]);
  assert.deepEqual(a.all('onair'), [{ t: 'onair', on }]);
  const c = conn('Sunny Otter');
  assert.deepEqual(c.inbox.find((m) => m.t === 'welcome').onAir, on);

  // Nobody else while they are: told who is on instead.
  const q = room.players.get(b.pid);
  q.s = [x + 1.5, y, z + 0.5];
  room.receive(b, { t: 'onair', station: stationId(), at: [x, y, z] });
  assert.deepEqual(b.all('onair').at(-1), { t: 'onair', on });
  assert.equal(c.all('onair').length, 0, 'and nobody else hears of it');
  assert.equal(room.onAir.pid, a.pid);

  // Only they go off air, and then someone else can go on.
  room.receive(b, { t: 'onair', off: true });
  assert.equal(room.onAir.pid, a.pid);
  room.receive(a, { t: 'onair', off: true });
  assert.deepEqual(c.all('onair'), [{ t: 'onair', on: null }]);
  const other = stationId();
  room.receive(b, { t: 'onair', station: other, at: [x, y, z] });
  assert.deepEqual(c.all('onair').at(-1), { t: 'onair', on: { pid: b.pid, name: 'Brave Fox', station: other } });

  // Leaving the island takes them off air.
  room.receive(b, { t: 'leave' });
  assert.deepEqual(c.all('onair').at(-1), { t: 'onair', on: null });
  assert.equal(room.onAir, null);
});
