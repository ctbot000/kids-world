// Logins at the keeper: making one with a name and four secret pictures,
// logging another device in with them, the wait after wrong pictures, a
// player's islands and profile coming back to each of their devices, the
// protocol (driven without WebRTC), and the admin pages' new pictures. Real
// pages logging in peer to peer are in e2e.test.js.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION, mergeProfiles, planSync, verifySignature, KEY_ALGORITHM } from '../public/js/shared/keeper.js';
import { Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, KeepError, Keeper, KeeperStore, publicConfig } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-login-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const TABLET = 'a1'.repeat(16);
const PHONE = 'b2'.repeat(16);
const SISTER = 'c3'.repeat(16);
const SECRET = ['rocket', 'apple', 'moon', 'apple'];
const OTHER_SECRET = ['dog', 'dog', 'star', 'fish'];
const ISLAND = '0123456789ab';

function island(build = 0, savedAt = Date.now()) {
  const room = new Room({ code: '482753', theme: 'flat', name: 'Maple Fields', seed: 11, now: () => savedAt });
  if (build) room.world.set(10, 30, 10, build);
  return room.exportSave();
}

function clock() {
  let t = Date.UTC(2026, 9, 3, 3);
  return { now: () => t, advance: (ms) => (t += ms) };
}

const refused = (promise, code) => assert.rejects(promise, (e) => e instanceof KeepError && e.code === code);

test('a login is made with your name and four secret pictures, and logs your other devices in', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const tablet = KeeperStore.deviceId(TABLET);
  // A login goes by your name, so the keeper has to know it first.
  await refused(store.makeLogin(tablet, SECRET), 'bad');
  const made = await store.makeLogin(tablet, SECRET, { name: 'Sunny Otter', look: { animal: 'fox' }, stickers: { 'first-block': 5 } });
  assert.equal(made.player, tablet, 'the folder the tablet sent its copies to is the player now');
  assert.match(made.token, /^[0-9a-f]{32}$/);
  assert.equal(made.name, 'Sunny Otter');
  await refused(store.makeLogin(tablet, ['rocket', 'apple', 'moon']), 'bad');
  await refused(store.makeLogin(tablet, ['rocket', 'apple', 'moon', 'spoon']), 'bad');

  // The phone logs in with the name and the pictures, and gets a token of its own.
  const phone = await store.login('Sunny Otter', SECRET);
  assert.equal(phone.player, tablet);
  assert.notEqual(phone.token, made.token);
  assert.equal(phone.profile.name, 'Sunny Otter');
  assert.equal(phone.profile.stickers['first-block'], 5);
  // On an island, a second Sunny Otter is "Sunny Otter 2": the login is the same.
  assert.equal((await store.login('Sunny Otter 2', SECRET)).player, tablet);
  assert.equal(await store.checkSession(tablet, phone.token), true);
  assert.equal(await store.checkSession(tablet, made.token), true);

  // Wrong pictures, and a name with no login, get the same answer.
  await refused(store.login('Sunny Otter', OTHER_SECRET), 'wrong');
  await refused(store.login('Happy Panda', SECRET), 'wrong');
  await refused(store.login('Not A Name', SECRET), 'wrong');

  // Neither the pictures nor the tokens are kept as they are, and the admin pages see neither.
  const kept = await readFile(join(store.dir, 'devices', tablet, 'login.json'), 'utf8');
  for (const secret of [...SECRET, made.token, phone.token]) assert.ok(!kept.includes(secret), `${secret} is not in login.json`);
  const [device] = await store.devices();
  assert.deepEqual(Object.keys(device.login).sort(), ['changed', 'devices', 'made']);
  assert.equal(device.login.devices, 3, 'the tablet, the phone, and the login as Sunny Otter 2');

  // Logging out forgets that device's token only.
  assert.equal(await store.logout(tablet, phone.token), true);
  assert.equal(await store.checkSession(tablet, phone.token), false);
  assert.equal(await store.checkSession(tablet, made.token), true);

  // New pictures: the old ones stop working, the devices logged in stay so.
  await store.makeLogin(tablet, OTHER_SECRET, null, { session: false });
  await refused(store.login('Sunny Otter', SECRET), 'wrong');
  assert.equal((await store.login('Sunny Otter', OTHER_SECRET)).player, tablet);
  assert.equal(await store.checkSession(tablet, made.token), true);

  // Removed (from the admin pages), every device is logged out.
  assert.equal(await store.removeLogin(tablet), true);
  assert.equal(await store.checkSession(tablet, made.token), false);
  await refused(store.login('Sunny Otter', OTHER_SECRET), 'wrong');
  assert.equal((await store.devices())[0].login, null);
});

test('wrong pictures make that name wait, and players who share a name each have their own login', async () => {
  const time = clock();
  const store = await new KeeperStore(await tempDir(), { now: time.now }).open();
  const tablet = KeeperStore.deviceId(TABLET);
  const sister = KeeperStore.deviceId(SISTER);
  await store.makeLogin(tablet, SECRET, { name: 'Happy Panda' });
  await store.makeLogin(sister, OTHER_SECRET, { name: 'Happy Panda' });
  assert.equal((await store.login('Happy Panda', SECRET)).player, tablet);
  assert.equal((await store.login('Happy Panda', OTHER_SECRET)).player, sister);

  for (let i = 0; i < 5; i++) await refused(store.login('Happy Panda', ['moon', 'moon', 'moon', 'moon']), 'wrong');
  // Now even the right pictures wait, for that name only.
  await assert.rejects(store.login('Happy Panda', SECRET), (e) => e.code === 'wait' && e.extra.wait > 0 && e.extra.wait <= 10 * 60000);
  await store.makeLogin(KeeperStore.deviceId(PHONE), SECRET, { name: 'Brave Fox' });
  assert.equal((await store.login('Brave Fox', SECRET)).player, KeeperStore.deviceId(PHONE));
  time.advance(10 * 60000 + 1);
  assert.equal((await store.login('Happy Panda', SECRET)).player, tablet);
});

test('a player’s devices get back their islands, newer copies win, and a goodbye on one reaches the others', async () => {
  const time = clock();
  const store = await new KeeperStore(await tempDir(), { now: time.now }).open();
  const player = KeeperStore.deviceId(TABLET);
  await store.keepProfileIn(player, { name: 'Sunny Otter' });
  const t = time.now();
  await store.keepIslandIn(player, ISLAND, island(B.GLASS, t - 1000), { newerOnly: true });
  await store.keepIslandIn(player, 'ffffffffffff', island(0, t - 5000), { newerOnly: true });

  const list = await store.list(player);
  assert.equal(list.profile.name, 'Sunny Otter');
  assert.deepEqual(list.islands.map((i) => [i.id, i.savedAt]).sort(), [
    [ISLAND, t - 1000],
    ['ffffffffffff', t - 5000],
  ]);
  const save = JSON.parse(await store.islandText(player, ISLAND));
  assert.equal(World.decode(save.meta, save.blocks).get(10, 30, 10), B.GLASS);

  // An older copy, from a device that was away for a while, is not kept over a newer one.
  const stale = await store.keepIslandIn(player, ISLAND, island(B.STONE, t - 2000), { newerOnly: true });
  assert.equal(stale.stale, true);
  assert.equal(stale.savedAt, t - 1000);
  const latest = JSON.parse(await store.islandText(player, ISLAND));
  assert.equal(World.decode(latest.meta, latest.blocks).get(10, 30, 10), B.GLASS);

  // Goodbye from one device, at a time before a copy kept: later than every copy, still.
  await store.forgetIsland(player, ISLAND, t - 60000);
  const after = await store.list(player);
  assert.deepEqual(
    after.islands.map((i) => i.id),
    ['ffffffffffff'],
  );
  assert.deepEqual(after.forgotten, [{ id: ISLAND, at: t - 1000 }]);
  assert.equal(await store.islandText(player, ISLAND), null);
  // Its copies stay, for the admin pages.
  assert.ok((await readdir(join(store.dir, 'devices', player, 'islands', ISLAND))).some((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)));
  // Changed on another device since: it is back.
  await store.keepIslandIn(player, ISLAND, island(B.PLANKS, t + 1000), { newerOnly: true });
  assert.deepEqual((await store.list(player)).forgotten, []);
});

test('two devices of one player: what to fetch, what to drop, and whose look wins', () => {
  // The keeper has a newer copy of a, and c, which this device never had; b was said goodbye to elsewhere.
  const plan = planSync(
    [
      { id: 'a', savedAt: 5 },
      { id: 'b', savedAt: 9 },
      { id: 'd', savedAt: 30 },
    ],
    [
      { id: 'a', savedAt: 7 },
      { id: 'c', savedAt: 1 },
      { id: 'd', savedAt: 20 },
    ],
    [{ id: 'b', at: 10 }],
  );
  assert.deepEqual(plan, { fetch: ['a', 'c'], drop: ['b'] });
  // Changed here after the goodbye: kept, and it goes up again.
  assert.deepEqual(planSync([{ id: 'b', savedAt: 11 }], [], [{ id: 'b', at: 10 }]), { fetch: [], drop: [] });
  // Only as many as a browser keeps: the newest.
  const many = Array.from({ length: 15 }, (_, i) => ({ id: `i${i}`, savedAt: i }));
  assert.deepEqual(planSync([], many, [], 12).fetch.sort(), many.slice(3).map((i) => i.id).sort());

  const tablet = { name: 'Sunny Otter', look: { animal: 'fox', fur: 'orange', shirt: 3, hat: 'crown' }, basket: { apple: 3 }, changedAt: 100, stats: { placed: 40, steps: 10 }, stickers: { 'first-block': 50 } };
  const phone = { name: 'Brave Otter', look: { animal: 'cat', fur: 'gray', shirt: 5, hat: 'cap' }, basket: { apple: 1 }, changedAt: 200, stats: { placed: 5, steps: 90 }, stickers: { 'first-block': 70, swimmer: 80 } };
  const merged = mergeProfiles(tablet, phone);
  assert.equal(merged.name, 'Brave Otter', 'the name, look and basket changed last');
  assert.equal(merged.look.animal, 'cat');
  assert.equal(merged.basket.apple, 1);
  assert.deepEqual(merged.stats, { placed: 40, steps: 90 }, 'the most of everything done');
  assert.deepEqual(merged.stickers, { 'first-block': 50, swimmer: 80 }, 'every sticker, from the day it was first earned');
  assert.deepEqual(mergeProfiles(phone, tablet), merged, 'whichever device merges');
  // A profile nobody has touched yet (a device's first) loses to any other.
  assert.equal(mergeProfiles({ name: 'Happy Panda', changedAt: 0 }, { name: 'Sunny Otter', changedAt: 0 }).name, 'Happy Panda');
  assert.equal(mergeProfiles({ name: 'Happy Panda', changedAt: 0 }, { name: 'Sunny Otter', changedAt: 1 }).name, 'Sunny Otter');
});

// A page talking to the keeper, without WebRTC: what it sends goes straight
// to receive(), and the keeper's answers are put back together here.
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

async function keeperFor(dir, now) {
  const identity = await createIdentity(dir);
  const store = await new KeeperStore(dir, now ? { now } : {}).open();
  const keeper = new Keeper({ store, identity, log: () => {} });
  await keeper.loadKey();
  const key = await crypto.subtle.importKey('jwk', publicConfig(identity).key, KEY_ALGORITHM, false, ['verify']);
  return { keeper, store, check: (nonce, sig) => verifySignature(key, identity.peer, nonce, sig) };
}

test('the protocol: no secret before the keeper has signed, then logging in, bringing islands back and out', async () => {
  const { keeper, store, check } = await keeperFor(await tempDir());
  const nonce = 'd4'.repeat(16);

  // The tablet: hello with only a nonce, and the signature is good.
  const tablet = await page(keeper);
  const hello = await tablet.say({ t: 'hello', v: KEEPER_VERSION, nonce });
  assert.equal(hello.t, 'hello');
  assert.equal(await check(nonce, hello.sig), true);
  assert.equal(tablet.conn.folder, null, 'nobody yet');
  assert.deepEqual(await tablet.say({ t: 'me', device: TABLET }), { t: 'me' });
  assert.equal((await tablet.say({ t: 'island', id: ISLAND, save: island(B.GLASS) })).t, 'kept');
  // Not logged in, it can send, but not take anything back.
  assert.equal((await tablet.say({ t: 'list' })).code, 'bad');
  const made = await tablet.say({ t: 'make-login', secret: SECRET, profile: { name: 'Sunny Otter', look: { animal: 'fox' } } });
  assert.equal(made.t, 'login');
  assert.equal(made.player, KeeperStore.deviceId(TABLET));
  assert.match(made.token, /^[0-9a-f]{32}$/);

  // The phone: wrong pictures, then the right ones; then it has the tablet's island.
  const phone = await page(keeper);
  await phone.say({ t: 'hello', v: KEEPER_VERSION, nonce: 'e5'.repeat(16) });
  await phone.say({ t: 'me', device: PHONE });
  assert.equal((await phone.say({ t: 'login', name: 'Sunny Otter', secret: OTHER_SECRET })).code, 'wrong');
  const login = await phone.say({ t: 'login', name: 'Sunny Otter', secret: SECRET });
  assert.equal(login.player, made.player);
  assert.equal(login.profile.name, 'Sunny Otter');
  const list = await phone.say({ t: 'list' });
  assert.deepEqual(
    list.islands.map((i) => i.id),
    [ISLAND],
  );
  const fetched = await phone.say({ t: 'fetch', id: ISLAND });
  assert.equal(fetched.t, 'island');
  assert.equal(World.decode(fetched.save.meta, fetched.save.blocks).get(10, 30, 10), B.GLASS);
  assert.equal((await phone.say({ t: 'fetch', id: 'ffffffffffff' })).code, 'missing');
  // What the phone builds goes to the player, for the tablet to fetch next time.
  await phone.say({ t: 'island', id: ISLAND, save: island(B.STONE, Date.now() + 1000) });
  const save = JSON.parse(await store.islandText(made.player, ISLAND));
  assert.equal(World.decode(save.meta, save.blocks).get(10, 30, 10), B.STONE);
  assert.deepEqual(await phone.say({ t: 'logout' }), { t: 'kept', what: 'logout' });
  assert.equal((await phone.say({ t: 'list' })).code, 'bad', 'logged out');

  // Next time, the phone comes back with its token: gone now, it is told so.
  const again = await page(keeper);
  await again.say({ t: 'hello', v: KEEPER_VERSION, nonce: 'f6'.repeat(16) });
  assert.deepEqual(await again.say({ t: 'me', device: PHONE, login: { player: login.player, token: login.token } }), { t: 'me' });
  // The tablet's token still works.
  const back = await page(keeper);
  await back.say({ t: 'hello', v: KEEPER_VERSION, nonce: '07'.repeat(16) });
  assert.deepEqual(await back.say({ t: 'me', device: TABLET, login: { player: made.player, token: made.token } }), { t: 'me', player: made.player });

  // Anything but a hello first, or anything but who it is next, and the page is dropped.
  const rude = await page(keeper);
  await rude.say({ t: 'me', device: TABLET });
  assert.equal(rude.conn.closed, true);
  const pushy = await page(keeper);
  await pushy.say({ t: 'hello', v: KEEPER_VERSION, nonce: '18'.repeat(16) });
  await pushy.say({ t: 'island', id: ISLAND, save: island() });
  assert.equal(pushy.conn.closed, true);
});

test('pages from before logins still say who they are in their hello, and are answered', async () => {
  const { keeper, store, check } = await keeperFor(await tempDir());
  const old = await page(keeper);
  const nonce = '29'.repeat(16);
  const hello = await old.say({ t: 'hello', v: 1, nonce, device: TABLET });
  assert.equal(hello.v, 1);
  // Signed over version 1's challenge, which those pages check.
  const { challenge, KEY_ALGORITHM: alg, SIGN_ALGORITHM } = await import('../public/js/shared/keeper.js');
  const identity = keeper.identity;
  const key = await crypto.subtle.importKey('jwk', publicConfig(identity).key, alg, false, ['verify']);
  const bytes = Uint8Array.from(atob(hello.sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  assert.equal(await crypto.subtle.verify(SIGN_ALGORITHM, key, bytes, challenge(identity.peer, nonce, 1)), true);
  assert.equal(await check(nonce, hello.sig), false, 'not over version 2’s');
  assert.equal((await old.say({ t: 'island', id: ISLAND, save: island() })).t, 'kept');
  assert.equal((await store.devices())[0].id, KeeperStore.deviceId(TABLET));
});

test('the admin pages give a player new secret pictures, or take their login away', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const device = KeeperStore.deviceId(TABLET);
  await store.makeLogin(device, SECRET, { name: 'Sunny Otter' });
  const server = createGameServer({ log: () => {}, admin: adminHandler({ store }) });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/admin/api/devices/${device}/login`;
  const headers = { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(url, { method: 'PUT', body: JSON.stringify({ secret: OTHER_SECRET }) })).status, 403, 'not without the header');
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ secret: ['nope'] }) })).status, 400);
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ secret: OTHER_SECRET }) })).status, 200);
    assert.equal((await store.login('Sunny Otter', OTHER_SECRET)).player, device);
    const state = await (await fetch(`http://127.0.0.1:${server.address().port}/admin/api/state`)).json();
    assert.equal(state.devices[0].login.devices, 2);
    assert.ok(!JSON.stringify(state).includes('hash'), 'never the hashes');
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 200);
    await refused(store.login('Sunny Otter', OTHER_SECRET), 'wrong');
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 404);
  } finally {
    await server.shutdown();
  }
});
