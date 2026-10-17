// TV broadcasts: YouTube links read, broadcasts checked, every TV at the
// same place in a YouTube video; the keeper telling the pages that know of
// broadcasts what is on, when they connect and as it changes, and taking a
// video off air once its station (the admin page) is gone; and the admin
// pages putting one on and taking it off.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { cleanBroadcast, parseYouTube, sameBroadcast, stationId, youtubeAt, youtubeEmbed } from '../public/js/shared/broadcast.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { channelsWith, CHANNELS, LIVE, nextChannel } from '../public/js/shared/tv.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-tv-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const ID = 'dQw4w9WgXcQ';

test('a YouTube link of any kind is read: the video and where it starts', () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  ${ID}  `,
  ]) {
    assert.deepEqual(parseYouTube(link), { id: ID, start: 0 }, link);
  }
  assert.deepEqual(parseYouTube(`https://youtu.be/${ID}?t=90`), { id: ID, start: 90 });
  assert.deepEqual(parseYouTube(`https://www.youtube.com/watch?v=${ID}&t=1m30s`), { id: ID, start: 90 });
  assert.deepEqual(parseYouTube(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`), { id: ID, start: 3723 });
  for (const bad of ['', 'hello', `https://vimeo.com/${ID}`, `https://youtube.com.evil.example/watch?v=${ID}`, 'https://www.youtube.com/watch?v=short', `javascript:alert(1)//youtube.com/watch?v=${ID}`, null]) {
    assert.equal(parseYouTube(bad), null, String(bad));
  }
});

test('a broadcast is checked: a YouTube video or a station, with a tidy title, and nothing else', () => {
  assert.deepEqual(cleanBroadcast({ kind: 'youtube', id: ID, start: 12.7, duration: 212.4, title: '  Never\n gonna  ', extra: 1 }), { kind: 'youtube', id: ID, start: 12, duration: 212, title: 'Never gonna' });
  assert.deepEqual(cleanBroadcast({ kind: 'youtube', id: ID }), { kind: 'youtube', id: ID, start: 0, duration: 0, title: 'A YouTube video' });
  const station = stationId();
  assert.match(station, /^kidsworld-tv-[0-9a-z]{16}$/);
  assert.deepEqual(cleanBroadcast({ kind: 'video', station, title: 'x'.repeat(200) }).title.length, 80);
  for (const bad of [null, 'tv', {}, { kind: 'youtube', id: 'nope' }, { kind: 'video', station: 'someone-else' }, { kind: 'video' }, { kind: 'radio', id: ID }]) {
    assert.equal(cleanBroadcast(bad), null, JSON.stringify(bad));
  }
  const a = cleanBroadcast({ kind: 'youtube', id: ID, title: 'a' });
  assert.ok(sameBroadcast(a, { ...a, title: 'b' }));
  assert.ok(!sameBroadcast(a, { ...a, start: 5 }));
  assert.ok(!sameBroadcast(a, null) && sameBroadcast(null, null));
});

test('every TV is at the same place in a YouTube video, round again at its end', () => {
  const tv = cleanBroadcast({ kind: 'youtube', id: ID, start: 30, duration: 100 });
  assert.equal(youtubeAt(tv, 0), 30);
  assert.equal(youtubeAt(tv, 25_900), 55);
  assert.equal(youtubeAt(tv, 75_000), 5, 'round again');
  assert.equal(youtubeAt({ ...tv, duration: 0 }, 500_000), 530, 'a length not known');
  const url = new URL(youtubeEmbed(tv, 10_000));
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.pathname, `/embed/${ID}`);
  assert.equal(url.searchParams.get('start'), '40');
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.get('playlist'), ID, 'round and round');
});

test('a TV has the live channel after its own while something is on air', () => {
  assert.equal(channelsWith(null), CHANNELS);
  assert.deepEqual(channelsWith({}), [...CHANNELS, LIVE]);
  assert.equal(nextChannel(CHANNELS.length, 1, CHANNELS.length + 1), 0);
  assert.equal(nextChannel(0, -1, CHANNELS.length + 1), CHANNELS.length);
});

async function keeperWith(now) {
  const dir = await tempDir();
  const store = await new KeeperStore(dir, { now }).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, now });
  await keeper.loadKey();
  return { store, keeper };
}

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
  return { conn, hi, news: () => replies.filter((r) => r.t === 'tv-news') };
}

test('the keeper tells the pages that know of broadcasts what is on, as they connect and as it changes, and takes a video off once its station is gone', async () => {
  let clock = 1_000_000;
  const { keeper } = await keeperWith(() => clock);
  const old = await page(keeper, 'a1'.repeat(16));
  const tablet = await page(keeper, 'b2'.repeat(16), { tv: true });
  assert.equal(tablet.hi.tv, null, 'nothing on air');
  assert.equal('tv' in old.hi, false, 'a page from before broadcasts hears nothing of them');

  assert.throws(() => keeper.setTv({ kind: 'youtube', id: 'nope' }), /not something to put on TV/);
  keeper.setTv({ kind: 'youtube', id: ID, start: 10, duration: 200, title: 'Songs' });
  assert.deepEqual(tablet.news().at(-1), { t: 'tv-news', tv: { kind: 'youtube', id: ID, start: 10, duration: 200, title: 'Songs', at: 0 } });
  assert.deepEqual(old.news(), []);
  clock += 5000;
  const phone = await page(keeper, 'c3'.repeat(16), { tv: true });
  assert.equal(phone.hi.tv.at, 5000, 'how long it has been on, to be at the same place');
  assert.equal(keeper.status().tv.since, 1_000_000);

  // A video on the keeper's computer: on air while its station says it is there.
  const station = stationId();
  keeper.setTv({ kind: 'video', station, title: 'Our holiday' });
  assert.equal(phone.news().at(-1).tv.station, station);
  clock += 25_000;
  assert.ok(keeper.tvAlive());
  clock += 25_000;
  keeper.sweep();
  assert.equal(keeper.tv?.station, station, 'still there');
  clock += 31_000;
  keeper.sweep();
  assert.equal(keeper.tv, null, 'its page was closed');
  assert.equal(phone.news().at(-1).tv, null);
  assert.equal(keeper.tvAlive(), false, 'and a station still playing hears it is off');

  // A YouTube video needs no station.
  keeper.setTv({ kind: 'youtube', id: ID });
  clock += 10 * 60000;
  keeper.sweep();
  assert.equal(keeper.tv?.id, ID);
  const laptop = await page(keeper, 'd4'.repeat(16), { tv: true });
  keeper.setTv(null);
  assert.equal(laptop.news().at(-1).tv, null);
  await keeper.stop();
});

test('the admin pages put a broadcast on and take it off, with the admin header', async () => {
  const { store, keeper } = await keeperWith(() => Date.now());
  const server = createGameServer({ log: () => {}, admin: adminHandler({ store, keeper }) });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://localhost:${server.address().port}/admin/api`;
  const headers = { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' };
  try {
    const put = await fetch(`${base}/tv`, { method: 'PUT', headers, body: JSON.stringify({ kind: 'youtube', id: ID, title: 'Songs' }) });
    assert.equal(put.status, 200);
    assert.equal((await put.json()).tv.title, 'Songs');
    assert.equal((await (await fetch(`${base}/state`)).json()).keeper.tv.id, ID);
    assert.equal((await fetch(`${base}/tv`, { method: 'PUT', headers, body: JSON.stringify({ kind: 'youtube', id: 'x' }) })).status, 400);
    assert.equal((await fetch(`${base}/tv`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'not without the admin header');
    assert.deepEqual(await (await fetch(`${base}/tv/alive`, { method: 'POST', headers })).json(), { on: true });
    assert.equal((await fetch(`${base}/tv`, { method: 'DELETE', headers })).status, 200);
    assert.equal(keeper.tv, null);
    assert.deepEqual(await (await fetch(`${base}/tv/alive`, { method: 'POST', headers })).json(), { on: false });
  } finally {
    server.close();
    await keeper.stop();
  }
});
