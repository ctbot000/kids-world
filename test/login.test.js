// Logins at the keeper: making one with a username and a password, logging
// another device in with them, usernames of any kind (one per login, in any
// case or width), the wait after wrong passwords, a player's
// islands and profile coming back to each of their devices, a device's copies
// from before it logged in becoming the player's, logins made with secret
// pictures (before passwords) getting one, the protocol (driven without
// WebRTC), and the admin pages. Real pages logging in peer to peer are in
// e2e.test.js.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { addProgress, KEEPER_VERSION, mergeProfiles, passwordProblem, planSync, usernameKey, usernameProblem, verifySignature, KEY_ALGORITHM } from '../public/js/shared/keeper.js';
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
const PASSWORD = 'rocket-apple7';
const OTHER_PASSWORD = 'dogs and stars';
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

test('a login is made with a username and a password, and logs your other devices in', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const tablet = KeeperStore.deviceId(TABLET);
  // No username (nor, from a page from before usernames, a made-up name): no login.
  await refused(store.makeLogin(tablet, PASSWORD), 'username');
  const profile = { name: 'Sunny Otter', look: { animal: 'fox' }, stickers: { 'first-block': 5 } };
  const made = await store.makeLogin(tablet, PASSWORD, profile, { username: '  Otter   Fan 7 ' });
  assert.equal(made.player, tablet, 'the folder the tablet sent its copies to is the player now');
  assert.match(made.token, /^[0-9a-f]{32}$/);
  assert.equal(made.username, 'Otter Fan 7', 'as typed, the spaces tidied');
  // Too short, or just the username, is no password.
  await refused(store.makeLogin(tablet, 'abc12'), 'weak');
  await refused(store.makeLogin(tablet, 'otter_fan_7'), 'weak');
  await refused(store.makeLogin(tablet, ['rocket']), 'bad');

  // The phone logs in with the username, in any case, and the password, and gets a token of its own.
  const phone = await store.login('OTTER FAN 7', PASSWORD);
  assert.equal(phone.player, tablet);
  assert.equal(phone.username, 'Otter Fan 7');
  assert.notEqual(phone.token, made.token);
  assert.equal(phone.profile.name, 'Sunny Otter', 'in games, still the made-up name');
  assert.equal(phone.profile.stickers['first-block'], 5);
  assert.equal(await store.checkSession(tablet, phone.token), true);
  assert.equal(await store.checkSession(tablet, made.token), true);

  // A wrong password, and a username with no login, get the same answer.
  await refused(store.login('Otter Fan 7', OTHER_PASSWORD), 'wrong');
  await refused(store.login('Sunny Otter', PASSWORD), 'wrong');
  await refused(store.login('', PASSWORD), 'wrong');

  // Neither the password nor the tokens are kept as they are, and the admin pages see neither.
  const kept = await readFile(join(store.dir, 'devices', tablet, 'login.json'), 'utf8');
  for (const secret of [PASSWORD, made.token, phone.token]) assert.ok(!kept.includes(secret), `${secret} is not in login.json`);
  const [device] = await store.devices();
  assert.deepEqual(Object.keys(device.login).sort(), ['changed', 'devices', 'made', 'password', 'username']);
  assert.equal(device.login.username, 'Otter Fan 7');
  assert.equal(device.login.password, true);
  assert.equal(device.login.devices, 2);

  // Logging out forgets that device's token only.
  assert.equal(await store.logout(tablet, phone.token), true);
  assert.equal(await store.checkSession(tablet, phone.token), false);
  assert.equal(await store.checkSession(tablet, made.token), true);

  // A new password: the old one stops working, the username and the devices logged in stay.
  await store.makeLogin(tablet, OTHER_PASSWORD, null, { session: false });
  await refused(store.login('Otter Fan 7', PASSWORD), 'wrong');
  assert.equal((await store.login('otter fan 7', OTHER_PASSWORD)).player, tablet);
  assert.equal(await store.checkSession(tablet, made.token), true);

  // Removed (from the admin pages), every device is logged out.
  assert.equal(await store.removeLogin(tablet), true);
  assert.equal(await store.checkSession(tablet, made.token), false);
  await refused(store.login('Otter Fan 7', OTHER_PASSWORD), 'wrong');
  assert.equal((await store.devices())[0].login, null);
});

test('a username can be any letters, numbers and signs, once: in any case or width it is taken', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const tablet = KeeperStore.deviceId(TABLET);
  const sister = KeeperStore.deviceId(SISTER);
  await store.makeLogin(tablet, PASSWORD, { name: 'Happy Panda' }, { username: '민지 the Bunny 🐰' });
  assert.equal((await store.login('민지  THE bunny 🐰', PASSWORD)).player, tablet);
  // The same made-up name is fine; the same username, in any case or width, is not.
  await refused(store.makeLogin(sister, OTHER_PASSWORD, { name: 'Happy Panda' }, { username: '민지 The Bunny 🐰' }), 'taken');
  await store.makeLogin(sister, OTHER_PASSWORD, { name: 'Happy Panda' }, { username: 'ＨＡＮＡ' });
  await refused(store.makeLogin(KeeperStore.deviceId(PHONE), PASSWORD, { name: 'Brave Fox' }, { username: 'hana' }), 'taken');
  assert.equal((await store.login('Hana', OTHER_PASSWORD)).player, sister);
  // Too short, too long, or with something invisible in it that could make two look alike.
  assert.equal(usernameProblem('j'), 'short');
  assert.equal(usernameProblem('x'.repeat(33)), 'long');
  assert.equal(usernameProblem('han​a'), 'odd');
  assert.equal(usernameProblem('🐰🐰'), '');
  assert.equal(usernameKey('  Ｍinji   KIM '), 'minji kim');
  await refused(store.makeLogin(KeeperStore.deviceId(PHONE), PASSWORD, { name: 'Brave Fox' }, { username: 'han​a' }), 'username');
});

test('wrong passwords make that username wait, for a while and for it only', async () => {
  const time = clock();
  const store = await new KeeperStore(await tempDir(), { now: time.now }).open();
  const tablet = KeeperStore.deviceId(TABLET);
  await store.makeLogin(tablet, PASSWORD, { name: 'Happy Panda' }, { username: 'panda' });
  for (let i = 0; i < 5; i++) await refused(store.login('Panda', 'moonmoonmoon'), 'wrong');
  // Now even the right password waits, for that username only (in any case).
  await assert.rejects(store.login('PANDA', PASSWORD), (e) => e.code === 'wait' && e.extra.wait > 0 && e.extra.wait <= 10 * 60000);
  await store.makeLogin(KeeperStore.deviceId(PHONE), PASSWORD, { name: 'Brave Fox' }, { username: 'fox' });
  assert.equal((await store.login('fox', PASSWORD)).player, KeeperStore.deviceId(PHONE));
  time.advance(10 * 60000 + 1);
  assert.equal((await store.login('panda', PASSWORD)).player, tablet);
});

test('logins from before usernames get their made-up name as one, and two of one name keep it both', async () => {
  const dir = await tempDir();
  const store = await new KeeperStore(dir).open();
  const tablet = KeeperStore.deviceId(TABLET);
  const sister = KeeperStore.deviceId(SISTER);
  // Made as they were: by the made-up name, which two players may share.
  for (const [device, password] of [
    [tablet, PASSWORD],
    [sister, OTHER_PASSWORD],
  ]) {
    await store.makeLogin(device, password, { name: 'Happy Panda' }, { username: `x${device}` });
    const file = join(dir, 'devices', device, 'login.json');
    const { username, ...old } = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(username);
    await store.write(file, JSON.stringify(old));
  }
  const opened = await new KeeperStore(dir).open();
  assert.deepEqual(
    (await opened.devices()).map((d) => d.login.username),
    ['Happy Panda', 'Happy Panda'],
  );
  // Told apart by the password, as before.
  assert.equal((await opened.login('Happy Panda', PASSWORD)).player, tablet);
  assert.equal((await opened.login('happy panda', OTHER_PASSWORD)).player, sister);
  // A new login cannot have it; each of the two can still get a new password.
  await refused(opened.makeLogin(KeeperStore.deviceId(PHONE), PASSWORD, { name: 'Brave Fox' }, { username: 'Happy Panda' }), 'taken');
  await opened.makeLogin(sister, 'a-new-password', null, { session: false });
  assert.equal((await opened.login('Happy Panda', 'a-new-password')).player, sister);
});

test('a password is the same however a keyboard spells its letters, and has to be more than the name', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const tablet = KeeperStore.deviceId(TABLET);
  const password = '하늘색바다';
  // Hangul as whole syllables (NFC), and as letters that join up (NFD): the same password.
  await store.makeLogin(tablet, `${password}!`.normalize('NFC'), { name: 'Merry Seal' });
  assert.equal((await store.login('Merry Seal', `${password}!`.normalize('NFD'))).player, tablet);
  assert.equal(passwordProblem('12345'), 'short');
  assert.equal(passwordProblem('비밀번호좋아'), '', 'six letters, whatever the alphabet');
  assert.equal(passwordProblem('x'.repeat(65)), 'long');
  assert.equal(passwordProblem('Merry_Seal', 'Merry Seal'), 'name');
  assert.equal(passwordProblem('merry seal 2', 'Merry Seal'), '');
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
  const phone = { name: 'Brave Otter', look: { animal: 'kid', fur: 'gray', shirt: 5, hat: 'cap', skin: 'brown', hair: 'curly', hairColor: 'blue' }, basket: { apple: 1 }, changedAt: 200, stats: { placed: 5, steps: 90 }, stickers: { 'first-block': 70, swimmer: 80 } };
  const merged = mergeProfiles(tablet, phone);
  assert.equal(merged.name, 'Brave Otter', 'the name, look and basket changed last');
  assert.deepEqual(merged.look, phone.look, "a kid's skin and hair too");
  assert.equal(merged.basket.apple, 1);
  assert.deepEqual(merged.stats, { placed: 40, steps: 90 }, 'the most of everything done');
  assert.deepEqual(merged.stickers, { 'first-block': 50, swimmer: 80 }, 'every sticker, from the day it was first earned');
  assert.deepEqual(mergeProfiles(phone, tablet), merged, 'whichever device merges');
  // What a guest did on a device, brought along once to the player who logged in there: added up.
  const added = addProgress(tablet, { ...phone, stats: { placed: 5, highest: 70 }, basket: { apple: 998 } });
  assert.deepEqual(added.stats, { placed: 45, steps: 10, highest: 70 }, 'the highest flight is the higher one, not the two added');
  assert.equal(added.basket.apple, 999);
  assert.deepEqual(added.stickers, { 'first-block': 50, swimmer: 80 });
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
  const made = await tablet.say({ t: 'make-login', username: 'Otter Fan', password: PASSWORD, profile: { name: 'Sunny Otter', look: { animal: 'fox' } } });
  assert.equal(made.t, 'login');
  assert.equal(made.player, KeeperStore.deviceId(TABLET));
  assert.equal(made.username, 'Otter Fan');
  assert.match(made.token, /^[0-9a-f]{32}$/);

  // The phone, played on before as Happy Panda, with an island of its own.
  const phone = await page(keeper);
  await phone.say({ t: 'hello', v: KEEPER_VERSION, nonce: 'e5'.repeat(16) });
  await phone.say({ t: 'me', device: PHONE });
  await phone.say({ t: 'profile', profile: { name: 'Happy Panda', stickers: { swimmer: 7 }, stats: { swims: 3 } } });
  await phone.say({ t: 'island', id: 'ffffffffffff', save: island(B.PLANKS) });
  // A wrong password, then the right one; then it has the tablet's island.
  assert.equal((await phone.say({ t: 'login', username: 'otter fan', password: OTHER_PASSWORD })).code, 'wrong');
  const login = await phone.say({ t: 'login', username: 'otter fan', password: PASSWORD });
  assert.equal(login.player, made.player);
  assert.equal(login.username, 'Otter Fan');
  assert.equal(login.profile.name, 'Sunny Otter');
  const list = await phone.say({ t: 'list' });
  assert.deepEqual(
    list.islands.map((i) => i.id),
    [ISLAND],
  );
  // Happy Panda's things were the player's own: they come along, proven by the phone's key and the token.
  assert.equal((await phone.say({ t: 'adopt', player: login.player, token: 'ab'.repeat(16) })).code, 'gone');
  assert.deepEqual(await phone.say({ t: 'adopt', player: login.player, token: login.token }), { t: 'kept', what: 'adopt', islands: 1 });
  const adopted = await phone.say({ t: 'list' });
  assert.deepEqual(adopted.islands.map((i) => i.id).sort(), [ISLAND, 'ffffffffffff']);
  assert.equal(adopted.profile.name, 'Sunny Otter', 'the player’s name stays');
  assert.equal(adopted.profile.stickers.swimmer, 7, 'with the stickers from the phone');
  assert.equal(adopted.profile.stats.swims, 3);
  assert.ok(!(await store.devices()).some((d) => d.id === KeeperStore.deviceId(PHONE)), 'the phone’s folder is gone');
  const fetched = await phone.say({ t: 'fetch', id: ISLAND });
  assert.equal(fetched.t, 'island');
  assert.equal(World.decode(fetched.save.meta, fetched.save.blocks).get(10, 30, 10), B.GLASS);
  assert.equal((await phone.say({ t: 'fetch', id: 'eeeeeeeeeeee' })).code, 'missing');
  // What the phone builds goes to the player, for the tablet to fetch next time.
  await phone.say({ t: 'island', id: ISLAND, save: island(B.STONE, Date.now() + 1000) });
  const save = JSON.parse(await store.islandText(made.player, ISLAND));
  assert.equal(World.decode(save.meta, save.blocks).get(10, 30, 10), B.STONE);
  assert.deepEqual(await phone.say({ t: 'logout' }), { t: 'kept', what: 'logout' });
  // A page still open from before passwords is told to reload, and that is not a wrong try.
  const wrongBefore = store.wrong.length;
  const old = await phone.say({ t: 'login', name: 'Otter Fan', secret: ['moon', 'moon', 'star', 'dog'] });
  assert.equal(old.code, 'old');
  assert.match(old.text, /Reload/);
  assert.equal(store.wrong.length, wrongBefore);
  assert.equal((await phone.say({ t: 'list' })).code, 'bad', 'logged out');
  // A page from before usernames sends what it calls the name.
  const older = await page(keeper);
  await older.say({ t: 'hello', v: KEEPER_VERSION, nonce: '5c'.repeat(16) });
  await older.say({ t: 'me', device: PHONE });
  assert.equal((await older.say({ t: 'login', name: 'Otter Fan', password: PASSWORD })).player, made.player);
  await older.say({ t: 'logout' });

  // Next time, the phone comes back with its token: gone now, it is told so.
  const again = await page(keeper);
  await again.say({ t: 'hello', v: KEEPER_VERSION, nonce: 'f6'.repeat(16) });
  assert.deepEqual(await again.say({ t: 'me', device: PHONE, login: { player: login.player, token: login.token } }), { t: 'me' });
  // The tablet's token still works.
  const back = await page(keeper);
  await back.say({ t: 'hello', v: KEEPER_VERSION, nonce: '07'.repeat(16) });
  assert.deepEqual(await back.say({ t: 'me', device: TABLET, login: { player: made.player, token: made.token } }), { t: 'me', player: made.player, username: 'Otter Fan' });

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

test('a login made with secret pictures, before passwords, gets one from a device still logged in, or from the admin pages', async () => {
  const { keeper, store } = await keeperFor(await tempDir());
  const player = KeeperStore.deviceId(TABLET);
  await store.keepProfileIn(player, { name: 'Sunny Otter' });
  // As the keeper kept them: no kind, a hash of the pictures, and the tablet's token.
  const token = 'cd'.repeat(16);
  const old = { salt: 'aa'.repeat(16), hash: 'bb'.repeat(32), made: 1, changed: 1, sessions: {} };
  KeeperStore.addSession(old, token, Date.now());
  await store.write(store.path(player, 'login.json'), JSON.stringify(old));
  assert.equal((await store.devices())[0].login.password, false);
  await refused(store.login('Sunny Otter', 'rocket apple moon apple'), 'wrong');

  const tablet = await page(keeper);
  await tablet.say({ t: 'hello', v: KEEPER_VERSION, nonce: '3a'.repeat(16) });
  assert.deepEqual(await tablet.say({ t: 'me', device: TABLET, login: { player, token } }), { t: 'me', player, username: '', needsPassword: true });
  // From before usernames too: the made-up name becomes it.
  assert.deepEqual(await tablet.say({ t: 'make-login', password: PASSWORD }), { t: 'login', player, username: 'Sunny Otter' });
  assert.equal((await store.login('Sunny Otter', PASSWORD)).player, player);
  const again = await page(keeper);
  await again.say({ t: 'hello', v: KEEPER_VERSION, nonce: '4b'.repeat(16) });
  assert.deepEqual(await again.say({ t: 'me', device: TABLET, login: { player, token } }), { t: 'me', player, username: 'Sunny Otter' }, 'still logged in, with a password now');
});

test('the admin pages give a player a new password, take their login away, or move a gone device’s copies into it', async () => {
  const store = await new KeeperStore(await tempDir()).open();
  const device = KeeperStore.deviceId(TABLET);
  await store.makeLogin(device, PASSWORD, { name: 'Sunny Otter' });
  const server = createGameServer({ log: () => {}, admin: adminHandler({ store }) });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/admin/api/devices/${device}/login`;
  const headers = { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(url, { method: 'PUT', body: JSON.stringify({ password: OTHER_PASSWORD }) })).status, 403, 'not without the header');
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ password: 'nope' }) })).status, 400);
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ password: OTHER_PASSWORD }) })).status, 200);
    assert.equal((await store.login('Sunny Otter', OTHER_PASSWORD)).player, device);
    // A login for a player with none: a username too, not one taken.
    const other = KeeperStore.deviceId(PHONE);
    await store.keepProfileIn(other, { name: 'Brave Fox' });
    const otherUrl = `http://127.0.0.1:${server.address().port}/admin/api/devices/${other}/login`;
    const taken = await fetch(otherUrl, { method: 'PUT', headers, body: JSON.stringify({ username: 'SUNNY OTTER', password: PASSWORD }) });
    assert.equal(taken.status, 400);
    assert.match((await taken.json()).error, /has that username/);
    assert.equal((await fetch(otherUrl, { method: 'PUT', headers, body: JSON.stringify({ username: 'fox kid', password: PASSWORD }) })).status, 200);
    assert.equal((await store.login('Fox Kid', PASSWORD)).player, other);
    const state = await (await fetch(`http://127.0.0.1:${server.address().port}/admin/api/state`)).json();
    assert.equal(state.devices.find((d) => d.id === device).login.devices, 2);
    assert.ok(!JSON.stringify(state).includes('hash'), 'never the hashes');

    // The copies of an old tablet, which never logged in, into the login.
    const gone = KeeperStore.deviceId(SISTER);
    await store.keepIslandIn(gone, 'ffffffffffff', island(B.PLANKS));
    await store.keepProfileIn(gone, { name: 'Lucky Bunny', stickers: { rainbow: 3 } });
    const move = `http://127.0.0.1:${server.address().port}/admin/api/devices/${gone}/move`;
    assert.equal((await fetch(move, { method: 'POST', headers, body: JSON.stringify({ to: gone }) })).status, 400);
    const moved = await fetch(move, { method: 'POST', headers, body: JSON.stringify({ to: device }) });
    assert.deepEqual(await moved.json(), { ok: true, islands: 1 });
    const after = await store.list(device);
    assert.deepEqual(
      after.islands.map((i) => i.id),
      ['ffffffffffff'],
    );
    assert.equal(after.profile.stickers.rainbow, 3);
    assert.equal(after.profile.name, 'Sunny Otter');
    // Into a player with no login, or from one with a login of its own: no.
    await store.keepProfileIn(gone, { name: 'Lucky Bunny' });
    await refused(store.adoptDevice(device, gone), 'bad');

    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 200);
    await refused(store.login('Sunny Otter', OTHER_PASSWORD), 'wrong');
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 404);
  } finally {
    await server.shutdown();
  }
});
