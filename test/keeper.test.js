// The keeper's store and admin pages: islands filed by device with one copy a
// day, profiles without tokens, what it refuses, and admin pages only this
// computer can use. Pages sending copies peer to peer are in e2e.test.js.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { challenge, keptProfile, toBase64Url, verifySignature, KEY_ALGORITHM, SIGN_ALGORITHM } from '../public/js/shared/keeper.js';
import { Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, KeepError, KeeperStore, loadIdentity, publicConfig, sameKeeper } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-keeper-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const KEY = 'a1'.repeat(16);
const OTHER = 'b2'.repeat(16);
const ISLAND = '0123456789ab';

function island(build = 0) {
  const room = new Room({ code: '482753', theme: 'flat', name: 'Maple Fields', seed: 11 });
  if (build) room.world.set(10, 30, 10, build);
  return room.exportSave();
}

// A clock that can be moved on a day at a time.
function clock() {
  let t = Date.UTC(2026, 9, 1, 3);
  return { now: () => t, dayOf: (at) => new Date(at).toISOString().slice(0, 10), nextDay: () => (t += 24 * 3600 * 1000) };
}

test('an island is kept under its device, one copy a day for the last few days', async () => {
  const time = clock();
  const store = await new KeeperStore(await tempDir(), { keepDays: 3, now: time.now, dayOf: time.dayOf }).open();
  for (let day = 0; day < 4; day++) {
    if (day) time.nextDay();
    await store.keepIsland(KEY, ISLAND, island(B.TOY_BRICKS[day]));
  }
  // Later the same day: that day's copy is replaced, not added to.
  await store.keepIsland(KEY, ISLAND, island(B.GLASS));
  const [device] = await store.devices();
  assert.equal(device.id, KeeperStore.deviceId(KEY));
  assert.equal(device.islands.length, 1);
  const kept = device.islands[0];
  assert.deepEqual(
    { id: kept.id, name: kept.name, theme: kept.theme, code: kept.code, days: kept.days },
    { id: ISLAND, name: 'Maple Fields', theme: 'flat', code: '482753', days: ['2026-10-04', '2026-10-03', '2026-10-02'] },
  );
  const blockOn = async (day) => {
    const save = JSON.parse(await readFile(await store.islandFile(device.id, ISLAND, day), 'utf8'));
    return World.decode(save.meta, save.blocks).get(10, 30, 10);
  };
  assert.equal(await blockOn(null), B.GLASS, 'the latest copy');
  assert.equal(await blockOn('2026-10-02'), B.TOY_BRICKS[1]);
  assert.equal(await store.islandFile(device.id, ISLAND, '2026-10-01'), null, 'older days are let go');
  assert.equal(await store.islandFile(device.id, ISLAND, '../../keeper'), null);
});

test('a device only ever adds to its own copies, and the keeper refuses what is not an island', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  await store.keepIsland(KEY, ISLAND, island(B.GLASS));
  await store.keepIsland(OTHER, ISLAND, island(B.STONE));
  const devices = await store.devices();
  assert.equal(devices.length, 2, 'the same island id from another device is another island');

  const refused = async (key, id, save, code = 'bad') => assert.rejects(store.keepIsland(key, id, save), (e) => e instanceof KeepError && e.code === code);
  await refused(KEY, ISLAND, { ...island(), app: 'other-game' });
  await refused(KEY, ISLAND, { ...island(), blocks: 'AAAA' });
  await refused(KEY, '../../etc', island());
  await refused('not-a-key', ISLAND, island());
  await refused(KEY, ISLAND, { ...island(), padding: 'x'.repeat(5 * 1024 * 1024) });

  const small = await new KeeperStore(await tempDir(), { maxBytes: 20000 }).open();
  await small.keepIsland(KEY, ISLAND, island());
  await assert.rejects(small.keepIsland(KEY, 'ffffffffffff', island()), (e) => e.code === 'full');
});

test('a profile is kept without the tokens that let a player back into islands, or their settings', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const sent = {
    name: 'Sunny Otter',
    look: { animal: 'fox', fur: 'orange', shirt: 3, hat: 'crown' },
    basket: { apple: 4, shell: 1000, bogus: 3 },
    stats: { placed: 12, steps: 300 },
    stickers: { 'first-block': 1790000000000 },
    tokens: { 'island:abc': 'secret' },
    settings: { music: 1 },
  };
  await store.keepProfile(KEY, sent);
  const [device] = await store.devices();
  assert.deepEqual(device.profile, keptProfile(sent));
  assert.equal(device.profile.name, 'Sunny Otter');
  assert.equal(device.profile.basket.shell, 999);
  assert.equal(device.profile.basket.bogus, undefined);
  assert.equal(device.profile.tokens, undefined);
  assert.equal(device.profile.settings, undefined);
  // Any name, but not one with something invisible in it.
  assert.equal(keptProfile({ name: 'Hello there' }).name, 'Hello there');
  assert.equal(keptProfile({ name: 'Hel\u200blo' }).name, '');
});

test('deleting an island or a whole device frees its bytes', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  await store.keepIsland(KEY, ISLAND, island());
  await store.keepIsland(KEY, 'ffffffffffff', island());
  await store.keepProfile(KEY, { name: 'Sunny Otter' });
  const full = store.bytes;
  const device = KeeperStore.deviceId(KEY);
  assert.equal(await store.deleteIsland(device, ISLAND), true);
  assert.ok(store.bytes < full && store.bytes > 0);
  assert.equal(await store.deleteIsland(device, ISLAND), false);
  assert.equal(await store.deleteDevice(device), true);
  assert.equal(store.bytes, 0);
  assert.deepEqual(await store.devices(), []);
  // Counted again from the folder when the keeper starts.
  await store.keepIsland(KEY, ISLAND, island());
  assert.equal((await new KeeperStore(store.dir).open()).bytes, store.bytes);
});

test('the keeper has one identity, and signs what the page checks', async () => {
  const dir = await tempDir();
  const identity = await createIdentity(dir);
  assert.deepEqual(await loadIdentity(dir), identity);
  assert.match(identity.peer, /^kids-world-keeper-[0-9a-f]{16}$/);
  const config = publicConfig(identity, 'http://127.0.0.1:9000/');
  assert.equal(config.key.d, undefined, 'never the private half');
  assert.ok(sameKeeper(config, identity));
  assert.ok(!sameKeeper(publicConfig(await createIdentity(await tempDir())), identity));

  const priv = await crypto.subtle.importKey('jwk', identity.privateKey, KEY_ALGORITHM, false, ['sign']);
  const pub = await crypto.subtle.importKey('jwk', config.key, KEY_ALGORITHM, false, ['verify']);
  const nonce = 'c3'.repeat(16);
  const sig = toBase64Url(await crypto.subtle.sign(SIGN_ALGORITHM, priv, challenge(identity.peer, nonce)));
  assert.equal(await verifySignature(pub, identity.peer, nonce, sig), true);
  assert.equal(await verifySignature(pub, identity.peer, 'd4'.repeat(16), sig), false, 'another nonce');
  assert.equal(await verifySignature(pub, 'kids-world-keeper-0000000000000000', nonce, sig), false, 'another keeper');
  assert.equal(await verifySignature(pub, identity.peer, nonce, 'not base64!'), false);
});

async function listen(server) {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return server.address().port;
}

test('/keeper.json names the keeper this server runs, and none by default', async () => {
  const plain = createGameServer({ log: () => {} });
  const config = { peer: 'kids-world-keeper-0123456789abcdef', key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } };
  const keeping = createGameServer({ log: () => {}, keeperConfig: config });
  try {
    assert.equal((await fetch(`http://127.0.0.1:${await listen(plain)}/keeper.json`)).status, 404);
    const res = await fetch(`http://127.0.0.1:${await listen(keeping)}/keeper.json`);
    assert.deepEqual(await res.json(), config);
  } finally {
    await plain.shutdown();
    await keeping.shutdown();
  }
});

test('the admin pages list, download and delete copies, for this computer only', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  await store.keepIsland(KEY, ISLAND, island(B.GLASS));
  await store.keepProfile(KEY, { name: 'Sunny Otter' });
  const admin = adminHandler({ store });
  const server = createGameServer({ log: () => {}, admin });
  const base = `http://127.0.0.1:${await listen(server)}`;
  const device = KeeperStore.deviceId(KEY);
  try {
    const page = await fetch(`${base}/admin/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Island keeper/);
    const state = await (await fetch(`${base}/admin/api/state`)).json();
    assert.equal(state.devices[0].profile.name, 'Sunny Otter');
    assert.equal(state.devices[0].islands[0].name, 'Maple Fields');

    const file = await fetch(`${base}/admin/api/devices/${device}/islands/${ISLAND}?download`);
    assert.match(file.headers.get('content-disposition'), /^attachment; filename="maple-fields-\d{4}-\d{2}-\d{2}\.kidsworld\.json"$/);
    assert.equal((await file.json()).app, 'kids-world');

    // A page from another site in this computer's browser cannot make changes...
    const url = `${base}/admin/api/devices/${device}/islands/${ISLAND}`;
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 403);
    // ...nor read anything under another host name pointing here (DNS rebinding).
    const rebound = await new Promise((done) => {
      import('node:http').then(({ request }) =>
        request(`${base}/admin/api/state`, { headers: { Host: 'evil.example' } }, (res) => {
          res.resume();
          done(res.statusCode);
        }).end(),
      );
    });
    assert.equal(rebound, 403);
    assert.equal((await fetch(url, { method: 'DELETE', headers: { 'X-Kids-World-Admin': '1' } })).status, 200);
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await fetch(`${base}/admin/api/devices/${device}`, { method: 'DELETE', headers: { 'X-Kids-World-Admin': '1' } })).status, 200);
    assert.deepEqual((await (await fetch(`${base}/admin/api/state`)).json()).devices, []);
  } finally {
    await server.shutdown();
  }

  // Another computer on the network gets nothing, whatever it calls itself.
  let status = 0;
  const handled = await admin(
    { socket: { remoteAddress: '192.168.1.20' }, headers: { host: 'localhost:8747' }, method: 'GET', url: '/admin/api/state' },
    {
      writeHead(code) {
        status = code;
        return { end() {} };
      },
    },
    '/admin/api/state',
  );
  assert.equal(handled, true);
  assert.equal(status, 403);
});
