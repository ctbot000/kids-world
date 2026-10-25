// Screen time (shared/lock.js): the keeper's admin page locks every player
// at once, after a minute's warning, the keeper tells the pages that know of it, as they connect and
// as it changes, and keeps it over a restart.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { cleanLock, LOCK_WARNING_MS, lockNews } from '../public/js/shared/lock.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

async function keeperIn(dir, now = () => 1_000_000) {
  const store = await new KeeperStore(dir, { now }).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, now });
  await keeper.loadKey();
  return { store, keeper };
}

async function newDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-lock-'));
  dirs.push(dir);
  return dir;
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
  return { hi, news: () => replies.filter((r) => r.t === 'lock-news') };
}

test('a lock is checked: since when and when it locks, or nothing; one from before the warning locks at once', () => {
  assert.deepEqual(cleanLock({ since: 1234.5, at: 61234.5 }), { since: 1234, at: 61234 });
  assert.deepEqual(cleanLock({ since: 1234 }), { since: 1234, at: 1234 });
  assert.deepEqual(cleanLock({ since: 1234, at: 1000 }), { since: 1234, at: 1234 });
  assert.deepEqual(cleanLock({ since: 'soon' }), { since: 0, at: 0 });
  assert.equal(cleanLock(null), null);
  assert.equal(cleanLock('locked'), null);
  assert.deepEqual(lockNews({ since: 0, at: 60_000 }, 15_000), { since: 0, at: 60_000, left: 45_000 });
  assert.deepEqual(lockNews({ since: 0, at: 60_000 }, 90_000), { since: 0, at: 60_000, left: 0 });
  assert.equal(lockNews(null, 0), null);
});

test('the keeper locks the pages that know of screen time after a minute, as they connect and as it changes, and keeps it over a restart', async () => {
  const dir = await newDir();
  let clock = 1_000_000;
  const { keeper } = await keeperIn(dir, () => clock);
  const old = await page(keeper, 'a1'.repeat(16));
  const tablet = await page(keeper, 'b2'.repeat(16), { lock: true });
  assert.equal(tablet.hi.lock, null, 'nobody locked');
  assert.equal('lock' in old.hi, false, 'a page from before screen time hears nothing of it');
  assert.equal(keeper.status().lockable, 1);

  const lock = { since: 1_000_000, at: 1_000_000 + LOCK_WARNING_MS };
  assert.equal(LOCK_WARNING_MS, 60_000, 'a minute to finish up');
  assert.deepEqual(await keeper.setLock(true), lock);
  assert.deepEqual(tablet.news(), [{ t: 'lock-news', lock: { ...lock, left: 60_000 } }]);
  assert.deepEqual(old.news(), []);
  await keeper.setLock(true);
  assert.equal(tablet.news().length, 1, 'locking again is no news');
  clock += 20_000;
  const phone = await page(keeper, 'c3'.repeat(16), { lock: true });
  assert.deepEqual(phone.hi.lock, { ...lock, left: 40_000 }, 'a page connecting in the last minute counts down what is left of it');
  await keeper.stop();

  clock += 60_000;
  const again = (await keeperIn(dir, () => clock)).keeper;
  assert.deepEqual(again.lock, lock, 'still locked after a restart');
  const later = await page(again, 'd4'.repeat(16), { lock: true });
  assert.deepEqual(later.hi.lock, { ...lock, left: 0 }, 'locked at once');
  assert.equal(await again.setLock(false), null);
  assert.deepEqual(later.news(), [{ t: 'lock-news', lock: null }]);
  await again.stop();
  assert.equal((await keeperIn(dir)).keeper.lock, null, 'unlocked stays unlocked');
});

test('the admin pages lock every player and unlock them, with the admin header', async () => {
  const { store, keeper } = await keeperIn(await newDir(), () => Date.now());
  const server = createGameServer({ log: () => {}, admin: adminHandler({ store, keeper }) });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://localhost:${server.address().port}/admin/api`;
  const headers = { 'X-Kids-World-Admin': '1' };
  try {
    assert.equal((await (await fetch(`${base}/state`)).json()).keeper.lock, null);
    assert.equal((await fetch(`${base}/lock`, { method: 'PUT' })).status, 403, 'not without the admin header');
    assert.equal(keeper.lock, null);
    const put = await fetch(`${base}/lock`, { method: 'PUT', headers });
    assert.equal(put.status, 200);
    assert.ok((await put.json()).lock.since > 0);
    assert.ok((await (await fetch(`${base}/state`)).json()).keeper.lock.since > 0);
    assert.equal((await fetch(`${base}/lock`, { method: 'POST', headers })).status, 405);
    assert.deepEqual(await (await fetch(`${base}/lock`, { method: 'DELETE', headers })).json(), { lock: null });
    assert.equal(keeper.lock, null);
  } finally {
    server.close();
    await keeper.stop();
  }
});
