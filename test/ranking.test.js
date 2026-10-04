// The ranking: the boards (places shared on a tie, made-up stickers and
// silly counts not counted, your own place below the top), the keeper ranking
// only players with a login who have not left it, the protocol (driven
// without WebRTC) with its news for pages watching it live, and the admin
// pages taking a player out of it.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION, keptProfile } from '../public/js/shared/keeper.js';
import { BOARDS, RANKING_TOP, rankBoards } from '../public/js/shared/ranking.js';
import { STICKERS } from '../public/js/shared/stickers.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-ranking-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const TABLET = 'a1'.repeat(16);
const PHONE = 'b2'.repeat(16);
const SISTER = 'c3'.repeat(16);
const GUEST = 'd4'.repeat(16);
const PASSWORD = 'rocket-apple7';

const stickers = (n) => Object.fromEntries(STICKERS.slice(0, n).map((s) => [s.key, 5]));
const player = (id, name, { stats = {}, got = 0 } = {}) => ({ id, profile: keptProfile({ name, look: { animal: 'fox', shirt: 3 }, stats, stickers: stickers(got) }) });
const board = (result, key) => result.boards.find((b) => b.key === key);

test('a board puts the most first, shares places on a tie, and leaves out who did none of it', () => {
  const result = rankBoards([
    player('p1', 'Mina', { stats: { placed: 40 }, got: 3 }),
    player('p2', 'Bo', { stats: { placed: 90 }, got: 3 }),
    player('p3', 'Ari', { stats: { placed: 40 }, got: 1 }),
    player('p4', 'Zed', { stats: { placed: 0 }, got: 0 }),
    player('p5', 'Cy', { stats: { placed: 12 } }),
  ]);
  assert.equal(result.players, 5);
  assert.deepEqual(
    result.boards.map((b) => b.key),
    BOARDS.map((b) => b.key),
  );
  const builders = board(result, 'builders').top;
  assert.deepEqual(
    builders.map((e) => [e.rank, e.name, e.score]),
    [
      [1, 'Bo', 90],
      [2, 'Ari', 40],
      [2, 'Mina', 40],
      [4, 'Cy', 12],
    ],
    'a tie shares the place, in the order of the names, and the next place is skipped',
  );
  assert.deepEqual(builders[0].look, { animal: 'fox', fur: 'orange', shirt: 3, hat: 'none' });
  assert.deepEqual(
    board(result, 'stickers').top.map((e) => [e.rank, e.name]),
    [
      [1, 'Bo'],
      [1, 'Mina'],
      [3, 'Ari'],
    ],
  );
  assert.deepEqual(board(result, 'animals').top, [], 'nobody petted anything');
  // Nobody is "you" when nobody asked.
  assert.ok(result.boards.every((b) => !b.you && b.top.every((e) => !e.you)));
});

test('a board shows the top few, and the one asking their own place wherever it is', () => {
  const many = Array.from({ length: 25 }, (_, i) => player(`p${i}`, `Player ${String(i).padStart(2, '0')}`, { stats: { steps: 1000 - i * 10 } }));
  const result = rankBoards(many, 'p20');
  const explorers = board(result, 'explorers');
  assert.equal(explorers.top.length, RANKING_TOP);
  assert.deepEqual(explorers.you, { rank: 21, score: 800 });
  assert.ok(explorers.top.every((e) => !e.you));
  // In the top, the entry says so too.
  const top = board(rankBoards(many, 'p2'), 'explorers');
  assert.deepEqual(top.you, { rank: 3, score: 980 });
  assert.equal(top.top.filter((e) => e.you).length, 1);
  assert.equal(top.top[2].you, true);
  // Not on a board: no place there.
  assert.equal(board(result, 'builders').you, undefined);
});

test('made-up stickers, silly counts and players with no name do not count', () => {
  const cheat = { id: 'p1', profile: keptProfile({ name: 'Sneaky', stickers: { 'not-a-sticker': 5, 'also-fake': 9, 'first-block': 5 }, stats: { placed: 1e15, fruit: 2.7, shells: -4, stars: 1 } }) };
  const nameless = { id: 'p2', profile: keptProfile({ name: '', stats: { placed: 50 } }) };
  const result = rankBoards([cheat, nameless]);
  assert.equal(result.players, 1);
  assert.equal(board(result, 'stickers').top[0].score, 1, 'only the real sticker');
  assert.equal(board(result, 'builders').top[0].score, 10_000_000, 'at most ten million');
  assert.equal(board(result, 'treasures').top[0].score, 3, 'whole fruit, no negative shells');
  assert.deepEqual(
    board(result, 'builders').top.map((e) => e.name),
    ['Sneaky'],
  );
});

test('the keeper ranks the players with a login, but for those who left it, whatever else changes', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const tablet = KeeperStore.deviceId(TABLET);
  const sister = KeeperStore.deviceId(SISTER);
  const guest = KeeperStore.deviceId(GUEST);
  await store.makeLogin(tablet, PASSWORD, { name: 'Sunny Otter', stats: { placed: 30 } }, { username: 'otter fan' });
  await store.makeLogin(sister, PASSWORD, { name: 'Minji', stats: { placed: 70 } }, { username: 'minji kim' });
  // A guest, with no login, is never in it.
  await store.keepProfileIn(guest, { name: 'Brave Fox', stats: { placed: 500 } });
  let ranking = await store.ranking();
  assert.equal(ranking.players, 2);
  assert.deepEqual(
    board(ranking, 'builders').top.map((e) => e.name),
    ['Minji', 'Sunny Otter'],
  );
  assert.equal(ranking.shown, undefined, 'nobody asked');
  const text = JSON.stringify(await store.ranking(tablet));
  for (const secret of ['otter fan', 'minji kim', tablet, sister]) assert.ok(!text.includes(secret), `never ${secret}`);

  // The sister leaves it: nobody sees her, and she sees that she is out.
  assert.equal(await store.setRanked(sister, false), true);
  ranking = await store.ranking(sister);
  assert.equal(ranking.shown, false);
  assert.equal(ranking.players, 1);
  assert.deepEqual(
    board(ranking, 'builders').top.map((e) => e.name),
    ['Sunny Otter'],
  );
  assert.equal(board(ranking, 'builders').you, undefined);
  assert.equal((await store.devices()).find((d) => d.id === sister).ranked, false);
  // Her new profile, a new password and a device's copies moved in leave her out still.
  await store.keepProfileIn(sister, { name: 'Minji', stats: { placed: 90 } });
  await store.makeLogin(sister, 'dogs and stars', null, { session: false });
  await store.keepProfileIn(KeeperStore.deviceId(PHONE), { name: 'Old Phone', stats: { placed: 4 } });
  await store.adoptDevice(KeeperStore.deviceId(PHONE), sister);
  assert.equal((await store.ranking(sister)).shown, false);
  // Back in.
  assert.equal(await store.setRanked(sister, true), true);
  ranking = await store.ranking(tablet);
  assert.equal(ranking.shown, true);
  assert.deepEqual(
    board(ranking, 'builders').top.map((e) => [e.rank, e.name, e.score, e.you ?? false]),
    [
      [1, 'Minji', 90, false],
      [2, 'Sunny Otter', 30, true],
    ],
  );
  // Only a player with a login can be left out, or put back.
  assert.equal(await store.setRanked(guest, false), false);
  assert.equal(await store.setRanked('nope', false), false);
  // A login taken away takes them out of it.
  await store.removeLogin(sister);
  assert.equal((await store.ranking()).players, 1);
});

async function page(keeper) {
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
  return {
    conn,
    replies,
    async say(msg) {
      const parts = [];
      sendText({ send: (part) => parts.push(part) }, JSON.stringify(msg));
      const before = replies.length;
      for (const part of parts) await keeper.receive(conn, part);
      return replies.length > before ? replies.at(-1) : null;
    },
  };
}

test('the protocol: any page sees the ranking, and a logged-in one can leave it or join again', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {} });
  await keeper.loadKey();
  await store.makeLogin(KeeperStore.deviceId(SISTER), PASSWORD, { name: 'Minji', look: { animal: 'bunny' }, stickers: stickers(4) }, { username: 'minji' });

  // A guest: the ranking, without a place or a choice of its own.
  const guest = await page(keeper);
  await guest.say({ t: 'hello', v: KEEPER_VERSION, nonce: '11'.repeat(16) });
  await guest.say({ t: 'me', device: GUEST });
  const seen = await guest.say({ t: 'ranking' });
  assert.equal(seen.t, 'ranking');
  assert.equal(seen.players, 1);
  assert.equal(seen.shown, undefined);
  assert.deepEqual(
    board(seen, 'stickers').top.map((e) => [e.rank, e.name, e.look.animal, e.score]),
    [[1, 'Minji', 'bunny', 4]],
  );
  const refused = await guest.say({ t: 'ranked', on: false });
  assert.equal(refused.t, 'error');
  assert.match(refused.text, /Log in/);

  // The tablet makes a login and is in it, marked as itself.
  const tablet = await page(keeper);
  await tablet.say({ t: 'hello', v: KEEPER_VERSION, nonce: '22'.repeat(16) });
  await tablet.say({ t: 'me', device: TABLET });
  await tablet.say({ t: 'make-login', username: 'Otter Fan', password: PASSWORD, profile: { name: 'Sunny Otter', stickers: stickers(6) } });
  const mine = await tablet.say({ t: 'ranking' });
  assert.equal(mine.shown, true);
  assert.deepEqual(board(mine, 'stickers').you, { rank: 1, score: 6 });
  assert.deepEqual(
    board(mine, 'stickers').top.map((e) => [e.name, e.you ?? false]),
    [
      ['Sunny Otter', true],
      ['Minji', false],
    ],
  );
  // Out, and back in.
  assert.deepEqual(await tablet.say({ t: 'ranked', on: false }), { t: 'kept', what: 'ranked', on: false });
  const out = await tablet.say({ t: 'ranking' });
  assert.equal(out.shown, false);
  assert.deepEqual(
    board(out, 'stickers').top.map((e) => e.name),
    ['Minji'],
  );
  assert.deepEqual(
    board(await guest.say({ t: 'ranking' }), 'stickers').top.map((e) => e.name),
    ['Minji'],
  );
  assert.deepEqual(await tablet.say({ t: 'ranked', on: true }), { t: 'kept', what: 'ranked', on: true });
  assert.equal((await tablet.say({ t: 'ranking' })).players, 2);
});

test('the admin pages take a player out of the ranking, and put them back', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const device = KeeperStore.deviceId(TABLET);
  await store.makeLogin(device, PASSWORD, { name: 'Sunny Otter', stats: { steps: 50 } }, { username: 'otter' });
  const guest = KeeperStore.deviceId(GUEST);
  await store.keepProfileIn(guest, { name: 'Brave Fox' });
  const server = createGameServer({ log: () => {}, admin: adminHandler({ store }) });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}/admin/api`;
  const headers = { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' };
  try {
    const url = `${base}/devices/${device}/ranked`;
    assert.equal((await fetch(url, { method: 'PUT', body: JSON.stringify({ on: false }) })).status, 403, 'not without the header');
    assert.equal((await fetch(url, { method: 'POST', headers, body: '{}' })).status, 405);
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ on: false }) })).status, 200);
    assert.equal((await store.ranking()).players, 0);
    const state = await (await fetch(`${base}/state`)).json();
    assert.equal(state.devices.find((d) => d.id === device).ranked, false);
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ on: true }) })).status, 200);
    assert.equal((await store.ranking()).players, 1);
    // No login, no ranking.
    assert.equal((await fetch(`${base}/devices/${guest}/ranked`, { method: 'PUT', headers, body: JSON.stringify({ on: false }) })).status, 404);
  } finally {
    await server.shutdown();
  }
});

async function until(fn, timeout = 5000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${String(fn)}`);
    await delay(10);
  }
}

test('a page watching the ranking hears of every change it would see, a moment later, until it stops', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, rankingNewsMs: 200 });
  await keeper.loadKey();
  const sister = KeeperStore.deviceId(SISTER);
  await store.makeLogin(sister, PASSWORD, { name: 'Minji', look: { animal: 'bunny' }, stats: { placed: 10 } }, { username: 'minji' });

  // A guest watches.
  const watcher = await page(keeper);
  await watcher.say({ t: 'hello', v: KEEPER_VERSION, nonce: '11'.repeat(16) });
  await watcher.say({ t: 'me', device: GUEST });
  const first = await watcher.say({ t: 'ranking', watch: true });
  assert.equal(first.t, 'ranking');
  assert.equal(watcher.conn.watching, true);
  const news = () => watcher.replies.filter((r) => r.t === 'ranking-news');
  const builders = (r) => board(r, 'builders').top.map((e) => [e.name, e.score]);

  // Minji plays on her tablet: what she has done goes along, and the watcher hears of it.
  const tablet = await page(keeper);
  await tablet.say({ t: 'hello', v: KEEPER_VERSION, nonce: '22'.repeat(16) });
  await tablet.say({ t: 'me', device: TABLET });
  const login = await tablet.say({ t: 'login', username: 'minji', password: PASSWORD });
  const playing = { ...login.profile, stats: { placed: 50 } };
  assert.deepEqual(await tablet.say({ t: 'profile', profile: playing }), { t: 'kept', what: 'profile' });
  await until(() => news().length === 1);
  assert.deepEqual(builders(news()[0]), [['Minji', 50]]);
  // Only what she did changed: news for the ranking, nothing for the admin pages.
  assert.ok(!keeper.recent.some((e) => e.what === 'profile'));
  // Many changes at once are one piece of news.
  await tablet.say({ t: 'profile', profile: { ...playing, stats: { placed: 60 } } });
  await tablet.say({ t: 'profile', profile: { ...playing, stats: { placed: 70 } } });
  await until(() => news().length === 2);
  await delay(400);
  assert.equal(news().length, 2);
  assert.deepEqual(builders(news()[1]), [['Minji', 70]]);

  // What the ranking does not show is no news: a guest's profile, or a count no board counts.
  await store.keepProfileIn(KeeperStore.deviceId(PHONE), { name: 'Brave Fox', look: { animal: 'fox' }, stats: { placed: 999 } });
  await tablet.say({ t: 'profile', profile: { ...playing, stats: { placed: 70, danced: 4 } } });
  await delay(400);
  assert.equal(news().length, 2);
  // A new login is: Brave Fox goes first.
  await store.makeLogin(KeeperStore.deviceId(PHONE), 'dogs and stars', null, { username: 'fox' });
  await until(() => news().length === 3);
  assert.deepEqual(builders(news()[2]), [
    ['Brave Fox', 999],
    ['Minji', 70],
  ]);
  // So is leaving it, to the one who left, too: watching, the tablet hears that it is out.
  await tablet.say({ t: 'ranking', watch: true });
  await tablet.say({ t: 'ranked', on: false });
  await until(() => news().length === 4 && tablet.replies.some((r) => r.t === 'ranking-news'));
  assert.deepEqual(builders(news()[3]), [['Brave Fox', 999]]);
  assert.equal(tablet.replies.findLast((r) => r.t === 'ranking-news').shown, false);

  // Stopped watching: no more news.
  assert.deepEqual(await watcher.say({ t: 'unwatch' }), { t: 'kept', what: 'unwatch' });
  await tablet.say({ t: 'ranked', on: true });
  await until(() => tablet.replies.filter((r) => r.t === 'ranking-news').length === 2);
  await delay(400);
  assert.equal(news().length, 4);
  await keeper.stop();
});
