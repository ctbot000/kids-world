// Broadcast stations: a TV camera on a tripod, furniture that turns, in the
// Home tab after the TVs, its lens at the front; found beside you; who is on
// air checked; the 📹 On Air channel on every TV while someone is; and the
// keeper telling every page in the game who is on air, one at a time, until
// they stop or their page goes.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { stationId } from '../public/js/shared/broadcast.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { cleanOnAir, isBroadcastStation, NAME_MAX, onAirShow, sameOnAir, stationNear } from '../public/js/shared/station.js';
import { CHANNELS, channelsWith, LIVE, ON_AIR } from '../public/js/shared/tv.js';
import { World } from '../public/js/shared/world.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

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
  assert.deepEqual(cleanOnAir({ name: 'Happy Panda', station, extra: 1 }), { name: 'Happy Panda', station });
  assert.deepEqual(cleanOnAir({ station }), { name: 'Someone', station });
  assert.equal([...cleanOnAir({ name: '🐼'.repeat(60), station }).name].length, NAME_MAX);
  for (const bad of [null, 'x', { name: 'Happy Panda' }, { name: 'Happy Panda', station: 'kids-world-keeper' }]) assert.equal(cleanOnAir(bad), null);
  assert.ok(sameOnAir({ name: 'a', station }, { name: 'b', station }) && sameOnAir(null, null) && !sameOnAir(null, { station }));
  assert.deepEqual(onAirShow({ name: 'Happy Panda', station }), { kind: 'video', station, title: 'Happy Panda, live' });
});

test('every TV has the 📹 On Air channel while someone is on air, after its own and before the keeper’s 📡 Live', () => {
  assert.equal(channelsWith(null, null), CHANNELS);
  assert.deepEqual(channelsWith(null, { station: 'x' }), [...CHANNELS, ON_AIR]);
  assert.deepEqual(channelsWith({}, { station: 'x' }), [...CHANNELS, ON_AIR, LIVE]);
  assert.deepEqual(channelsWith({}), [...CHANNELS, LIVE]);
});

async function keeperWith() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-station-'));
  dirs.push(dir);
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {} });
  await keeper.loadKey();
  return keeper;
}

// A page connected to the keeper: what it says, and what it hears back.
async function page(keeper, device, me = {}) {
  const replies = [];
  const pieces = new Reassembler();
  const conn = keeper.connection({ id: `page-${Math.random()}`, peer: 'page', pc: { close() {} } });
  conn.dc = {
    isOpen: () => !conn.closed,
    sendMessage: (piece) => {
      const text = pieces.accept(piece);
      if (text != null) replies.push(JSON.parse(text));
    },
    close() {},
  };
  keeper.conns.set(conn.id, conn);
  const say = async (msg) => {
    const parts = [];
    sendText({ send: (part) => parts.push(part) }, JSON.stringify(msg));
    for (const part of parts) await keeper.receive(conn, part);
    return replies.at(-1);
  };
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: 'ab'.repeat(16) });
  const hi = await say({ t: 'me', device, ...me });
  return { conn, hi, say, news: () => replies.filter((r) => r.t === 'onair-news') };
}

test('the keeper tells every page that knows of broadcast stations who is on air: one at a time in the whole game, until they stop or their page goes', async () => {
  const keeper = await keeperWith();
  const old = await page(keeper, 'a1'.repeat(16), { tv: true });
  const panda = await page(keeper, 'b2'.repeat(16), { tv: true, onair: true });
  const fox = await page(keeper, 'c3'.repeat(16), { tv: true, onair: true });
  assert.equal(panda.hi.onAir, null, 'nobody on air yet');
  assert.equal('onAir' in old.hi, false, 'a page from before broadcast stations hears nothing of them');

  const station = stationId();
  assert.equal((await panda.say({ t: 'onair', station: 'nope', name: 'Happy Panda' })).t, 'error');
  assert.deepEqual(await panda.say({ t: 'onair', station, name: '  Happy\u0000 Panda ' }), { t: 'onair', on: true, onAir: { name: 'Happy Panda', station } });
  const on = { t: 'onair-news', onAir: { name: 'Happy Panda', station } };
  assert.deepEqual(fox.news(), [on]);
  assert.deepEqual(panda.news(), [on]);
  assert.deepEqual(old.news(), [], 'not to a page that would take it for an answer');
  assert.deepEqual((await page(keeper, 'd4'.repeat(16), { onair: true })).hi.onAir, on.onAir, 'and to a page as it connects');
  assert.equal(keeper.status().onAir.station, station);

  // Nobody else while they are: told who is on instead.
  assert.deepEqual(await fox.say({ t: 'onair', station: stationId(), name: 'Brave Fox' }), { t: 'onair', on: false, onAir: on.onAir });
  assert.deepEqual(await fox.say({ t: 'onair', off: true }), { t: 'onair', on: false, onAir: on.onAir }, 'nor takes them off');
  assert.equal(fox.news().length, 1);

  // Off air, and someone else can go on; whose page goes is off air too.
  await panda.say({ t: 'onair', off: true });
  assert.deepEqual(fox.news().at(-1), { t: 'onair-news', onAir: null });
  const other = stationId();
  assert.equal((await fox.say({ t: 'onair', station: other, name: 'Brave Fox' })).on, true);
  assert.deepEqual(panda.news().at(-1), { t: 'onair-news', onAir: { name: 'Brave Fox', station: other } });
  keeper.drop(fox.conn);
  assert.deepEqual(panda.news().at(-1), { t: 'onair-news', onAir: null });
  assert.equal(keeper.onAir, null);
  await keeper.stop();
});
