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
import { BOARDS, ISLE_BOARDS, isBoardsOf, RANKING_TOP, rankBoards } from '../public/js/shared/ranking.js';
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

// ------------------------------------------------ the isle's own world

test('the isle has boards of its own, and nothing done elsewhere leads them', () => {
  const isle = rankBoards([player('p1', 'Mina', { stats: { popped: 12, freed: 2, kings: 1 } }), player('p2', 'Bo', { stats: { popped: 5, freed: 4, steps: 3000 } })], null, RANKING_TOP, ISLE_BOARDS);
  assert.deepEqual(
    isle.boards.map((b) => b.key),
    ISLE_BOARDS.map((b) => b.key),
  );
  assert.deepEqual(
    board(isle, 'monsters').top.map((e) => [e.rank, e.name, e.score]),
    [
      [1, 'Mina', 12],
      [2, 'Bo', 5],
    ],
  );
  assert.deepEqual(board(isle, 'camps').top.map((e) => [e.name, e.score]), [
    ['Bo', 4],
    ['Mina', 2],
  ]);
  assert.deepEqual(board(isle, 'kings').top.map((e) => [e.name, e.score]), [['Mina', 1]]);
  // What there is no board for on the isle: building, treasures, animals.
  for (const key of ['builders', 'treasures', 'animals']) assert.equal(ISLE_BOARDS.some((b) => b.key === key), false);

  // A keeper from before the isle's ranking answers with the other world's
  // boards, whatever was asked: caught by the one board only the isle has.
  assert.equal(isBoardsOf('isle', isle.boards), true);
  assert.equal(isBoardsOf('home', isle.boards), false);
  assert.equal(isBoardsOf('home', rankBoards([player('p1', 'Mina')]).boards), true);
  assert.equal(isBoardsOf('isle', rankBoards([player('p1', 'Mina')]).boards), false);
  assert.equal(isBoardsOf('home', null), false);
});

test('the keeper keeps the isle\'s own world of each player beside their profile, and ranks it apart', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const tablet = KeeperStore.deviceId(TABLET);
  const sister = KeeperStore.deviceId(SISTER);
  const guest = KeeperStore.deviceId(GUEST);
  await store.makeLogin(tablet, PASSWORD, { name: 'Sunny Otter', stats: { placed: 900, popped: 2 } }, { username: 'otter' });
  await store.makeLogin(sister, PASSWORD, { name: 'Minji', stats: { placed: 10 } }, { username: 'minji' });
  // The isle's own world of them, sent beside their profiles.
  await store.keepAdventureIn(tablet, { name: 'Sunny Otter', look: { animal: 'fox' }, stats: { popped: 12, freed: 2, kings: 1 } });
  await store.keepAdventureIn(sister, { name: 'Minji', look: { animal: 'bunny' }, stats: { popped: 5, freed: 4, steps: 3000 } });
  // A guest's isle world is kept too, but never ranked.
  await store.keepAdventureIn(guest, { name: 'Brave Fox', stats: { popped: 99 } });

  // The isle's boards: what was done there, not everywhere else.
  const isle = await store.ranking(null, 'isle');
  assert.equal(isle.players, 2);
  assert.deepEqual(board(isle, 'monsters').top.map((e) => [e.name, e.score]), [
    ['Sunny Otter', 12],
    ['Minji', 5],
  ]);
  assert.deepEqual(board(isle, 'camps').top.map((e) => [e.name, e.score]), [
    ['Minji', 4],
    ['Sunny Otter', 2],
  ]);
  // Your own place, and marked in the top.
  const mine = await store.ranking(tablet, 'isle');
  assert.deepEqual(board(mine, 'monsters').you, { rank: 1, score: 12 });
  // The isle's level in the rows, not the one from everywhere else (levels.js:
  // 12 popped, 2 camps freed and a king is 360 XP, level 3).
  assert.equal(board(mine, 'monsters').top[0].look.level, 3);
  // The other ranking is as it was: the guest's popping counts for nothing
  // there either, and building still leads.
  const home = await store.ranking();
  assert.deepEqual(
    home.boards.map((b) => b.key),
    BOARDS.map((b) => b.key),
  );
  assert.deepEqual(board(home, 'builders').top.map((e) => [e.name, e.score]), [
    ['Sunny Otter', 900],
    ['Minji', 10],
  ]);
  assert.equal(board(home, 'monsters'), undefined, 'no monsters board but on the isle');

  // It comes back with the list, and a player out of the ranking is out of both.
  assert.equal((await store.list(tablet)).adventure.stats.popped, 12);
  await store.setRanked(sister, false);
  assert.equal((await store.ranking(null, 'isle')).players, 1);
  assert.equal((await store.ranking()).players, 1);

  // The admin pages see it: each player's other world, with its own level.
  const devices = await store.devices();
  const fox = devices.find((d) => d.id === tablet);
  assert.equal(fox.adventure.profile.stats.popped, 12);
  assert.equal(devices.find((d) => d.id === guest).adventure.profile.name, 'Brave Fox');
  assert.equal(devices.find((d) => d.id === sister).adventure.profile.stats.popped, 5);

  // A device's copies moved into a login bring its isle world along: the
  // most of each, as with the profile.
  await store.setRanked(sister, true);
  const old = KeeperStore.deviceId(PHONE);
  await store.keepAdventureIn(old, { name: 'Old Phone', stats: { popped: 7, freed: 1 } });
  await store.adoptDevice(old, sister);
  assert.equal((await store.list(sister)).adventure.stats.popped, 7, 'the most of each');
  assert.equal((await store.list(sister)).adventure.stats.freed, 4);
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

test('the protocol: the isle\'s world of you goes to the keeper, comes back with the list, and its ranking is watched apart', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, rankingNewsMs: 200 });
  await keeper.loadKey();
  await store.makeLogin(KeeperStore.deviceId(SISTER), PASSWORD, { name: 'Minji', stats: { placed: 10 } }, { username: 'minji' });

  // Minji's tablet logs in and sends the isle's world of her, as its own
  // kind of copy beside her profile.
  const tablet = await page(keeper);
  await tablet.say({ t: 'hello', v: KEEPER_VERSION, nonce: '22'.repeat(16) });
  await tablet.say({ t: 'me', device: TABLET });
  await tablet.say({ t: 'login', username: 'minji', password: PASSWORD });
  assert.deepEqual(await tablet.say({ t: 'adventure', profile: { name: 'Minji', look: { animal: 'bunny' }, stats: { popped: 7 } } }), { t: 'kept', what: 'adventure' });
  // The list of what her other devices sent brings it back, to merge with.
  const list = await tablet.say({ t: 'list' });
  assert.equal(list.adventure.stats.popped, 7);
  assert.equal(list.adventure.name, 'Minji');

  // A guest watches the isle's ranking: its own boards, from that world.
  const watcher = await page(keeper);
  await watcher.say({ t: 'hello', v: KEEPER_VERSION, nonce: '11'.repeat(16) });
  await watcher.say({ t: 'me', device: GUEST });
  const first = await watcher.say({ t: 'ranking', watch: true, world: 'isle' });
  assert.equal(watcher.conn.watching, 'isle');
  assert.deepEqual(
    first.boards.map((b) => b.key),
    ISLE_BOARDS.map((b) => b.key),
  );
  assert.deepEqual(board(first, 'monsters').top.map((e) => [e.name, e.score]), [['Minji', 7]]);
  const news = () => watcher.replies.filter((r) => r.t === 'ranking-news');

  // She pops monsters on the isle: the watcher hears of it there, and her
  // building everywhere else changes nothing on the isle's boards.
  await tablet.say({ t: 'adventure', profile: { name: 'Minji', look: { animal: 'bunny' }, stats: { popped: 9, placed: 500 } } });
  await until(() => news().length === 1);
  assert.deepEqual(board(news()[0], 'monsters').top.map((e) => [e.name, e.score]), [['Minji', 9]]);
  assert.equal(board(news()[0], 'builders'), undefined, 'no building but on the other world\'s boards');

  // A watcher of the other ranking is told nothing new by it.
  const other = await page(keeper);
  await other.say({ t: 'hello', v: KEEPER_VERSION, nonce: '33'.repeat(16) });
  await other.say({ t: 'me', device: PHONE });
  await other.say({ t: 'ranking', watch: true });
  assert.equal(other.conn.watching, true);
  await tablet.say({ t: 'adventure', profile: { name: 'Minji', look: { animal: 'bunny' }, stats: { popped: 11, placed: 500 } } });
  await until(() => news().length === 2);
  await delay(400);
  assert.deepEqual(other.replies.filter((r) => r.t === 'ranking-news'), [], 'the isle is no news to the other ranking');

  // Stopped watching: no more news.
  assert.deepEqual(await watcher.say({ t: 'unwatch' }), { t: 'kept', what: 'unwatch' });
  await tablet.say({ t: 'adventure', profile: { name: 'Minji', look: { animal: 'bunny' }, stats: { popped: 13, placed: 500 } } });
  await delay(400);
  assert.equal(news().length, 2);
  await keeper.stop();
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
  await tablet.say({ t: 'profile', profile: { ...playing, stats: { placed: 70, highest: 40 } } });
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

test('a keeper older than the page says so in its terminal, once for each thing it does not know', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const said = [];
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: (line) => said.push(line) });
  await keeper.loadKey();
  const newer = await page(keeper);
  await newer.say({ t: 'hello', v: KEEPER_VERSION, nonce: '33'.repeat(16) });
  await newer.say({ t: 'me', device: GUEST });
  for (let i = 0; i < 3; i++) assert.equal((await newer.say({ t: 'leaderboard' })).code, 'bad');
  assert.equal((await newer.say({ t: 'trophies' })).code, 'bad');
  assert.equal(said.length, 2);
  assert.match(said[0], /"leaderboard".*git pull, then restart npm start/);
  assert.match(said[1], /"trophies"/);
  // Nothing for what is not a kind of message at all.
  await newer.say({ t: 'Not A Kind\n' });
  await newer.say({ x: 1 });
  assert.equal(said.length, 2);
  await keeper.stop();
});
