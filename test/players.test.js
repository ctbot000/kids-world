// Players and invitations: the players list (who is playing now first, by
// display name and look, never a username or a folder), leaving it, the
// invitations the keeper passes on to the pages of the player invited (and
// their limits), the protocol driven without WebRTC, and an island owner's
// pass letting an invited friend in without the passcode.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { cleanInvite, sortPlayers } from '../public/js/shared/friends.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { createIdentity, friendId, Keeper, KeeperStore } from '../server/keeper.js';

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-players-'));
  dirs.push(dir);
  return dir;
}
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const TABLET = 'a1'.repeat(16);
const PHONE = 'b2'.repeat(16);
const SISTER = 'c3'.repeat(16);
const GUEST = 'd4'.repeat(16);
const LAPTOP = 'e5'.repeat(16);
const PASSWORD = 'rocket-apple7';
const ISLAND = { code: '123456', name: 'Candy Cove', theme: 'candy', size: 'small', server: false };

async function page(keeper, device, nonce) {
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
    const before = replies.length;
    for (const part of parts) await keeper.receive(conn, part);
    return replies.length > before ? replies.at(-1) : null;
  };
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: nonce.repeat(16) });
  await say({ t: 'me', device });
  return { conn, replies, say, news: () => replies.filter((r) => r.t === 'invite-news') };
}

async function keeperWith(now = () => Date.now()) {
  const dir = await tempDir();
  const store = await new KeeperStore(dir, { now }).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {}, now });
  await keeper.loadKey();
  return { store, keeper };
}

test('an invitation is tidied: a real code and name, a known kind and size, and a pass only if it is one', () => {
  assert.deepEqual(cleanInvite({ ...ISLAND, pass: 'f0'.repeat(16), extra: 'x' }), { ...ISLAND, pass: 'f0'.repeat(16) });
  assert.deepEqual(cleanInvite({ code: '654321', name: '  Sunny  Bay ', theme: 'lava', size: 'giant', server: 'yes', pass: 'nope' }), {
    code: '654321',
    name: 'Sunny Bay',
    theme: 'sunny',
    size: 'small',
    server: false,
  });
  assert.equal(cleanInvite({ ...ISLAND, code: '12345' }), null);
  assert.equal(cleanInvite({ ...ISLAND, name: '' }), null);
  assert.equal(cleanInvite(null), null);
});

test('the players list puts who is playing now first, then goes by name', () => {
  const players = sortPlayers([
    { id: '1', name: 'Zed', online: false },
    { id: '2', name: 'Mina', online: true },
    { id: '3', name: 'Ari', online: false },
    { id: '4', name: 'Bo', online: true },
  ]);
  assert.deepEqual(
    players.map((p) => p.name),
    ['Bo', 'Mina', 'Ari', 'Zed'],
  );
});

test('a logged-in page sees the other players, who is playing now, and can leave the list', async () => {
  const { store, keeper } = await keeperWith();
  const sister = KeeperStore.deviceId(SISTER);
  const laptop = KeeperStore.deviceId(LAPTOP);
  await store.makeLogin(sister, PASSWORD, { name: 'Minji', look: { animal: 'bunny', shirt: 2 }, stats: { placed: 120 }, stickers: { 'first-block': 5 } }, { username: 'minji kim' });
  await store.makeLogin(laptop, PASSWORD, { name: 'Brave Fox', look: { animal: 'fox' } }, { username: 'fox fan' });
  // A guest with a profile but no login is never on it.
  await store.keepProfileIn(KeeperStore.deviceId(PHONE), { name: 'Shy Owl' });

  // A guest page cannot see it, or say it is playing.
  const guest = await page(keeper, GUEST, '11');
  assert.match((await guest.say({ t: 'players' })).text, /Log in/);
  assert.match((await guest.say({ t: 'online', on: true })).text, /Log in/);

  const tablet = await page(keeper, TABLET, '22');
  await tablet.say({ t: 'make-login', username: 'Otter Fan', password: PASSWORD, profile: { name: 'Sunny Otter', look: { animal: 'cat' } } });
  let list = await tablet.say({ t: 'players' });
  assert.equal(list.t, 'players');
  assert.equal(list.shown, true);
  assert.deepEqual(
    list.players.map((p) => [p.name, p.look.animal, p.look.level, p.online]),
    [
      ['Brave Fox', 'fox', 1, false],
      ['Minji', 'bunny', 2, false],
    ],
    'everyone else with a login, never yourself, each with their level in their look',
  );
  assert.equal(list.players.find((p) => p.name === 'Minji').id, friendId(sister));
  const text = JSON.stringify(list);
  for (const secret of ['minji kim', 'fox fan', sister, laptop]) assert.ok(!text.includes(secret), `never ${secret}`);

  // Minji opens the game, logged in: she is playing now, first on the list.
  const minji = await page(keeper, PHONE, '33');
  const login = await minji.say({ t: 'login', username: 'minji kim', password: PASSWORD });
  assert.equal(login.t, 'login');
  assert.deepEqual(await minji.say({ t: 'online', on: true }), { t: 'kept', what: 'online', on: true });
  list = await tablet.say({ t: 'players' });
  assert.deepEqual(
    list.players.map((p) => [p.name, p.online]),
    [
      ['Minji', true],
      ['Brave Fox', false],
    ],
  );
  assert.equal(keeper.status().online, 1);
  // Her page goes off screen, or away: not playing now.
  await minji.say({ t: 'online', on: false });
  assert.equal((await tablet.say({ t: 'players' })).players[0].online, false);
  await minji.say({ t: 'online', on: true });
  keeper.drop(minji.conn);
  assert.equal((await tablet.say({ t: 'players' })).players.find((p) => p.name === 'Minji').online, false);

  // The fox leaves the list: nobody sees him, and he sees that he is off it.
  const fox = await page(keeper, GUEST, '44');
  await fox.say({ t: 'login', username: 'fox fan', password: PASSWORD });
  assert.deepEqual(await fox.say({ t: 'findable', on: false }), { t: 'kept', what: 'findable', on: false });
  assert.equal((await fox.say({ t: 'players' })).shown, false);
  assert.deepEqual(
    (await tablet.say({ t: 'players' })).players.map((p) => p.name),
    ['Minji'],
  );
  assert.equal((await store.devices()).find((d) => d.id === laptop).findable, false);
  // It holds through a new profile, and leaves the ranking alone.
  await store.keepProfileIn(laptop, { name: 'Brave Fox', stats: { placed: 3 } });
  assert.equal((await store.ranking()).players, 3);
  assert.deepEqual(await fox.say({ t: 'findable', on: true }), { t: 'kept', what: 'findable', on: true });
  assert.equal((await tablet.say({ t: 'players' })).players.length, 2);
  await keeper.stop();
});

test('an invitation goes to every page of the player that is playing now, from who the keeper knows you are', async () => {
  let clock = 1_000_000;
  const { store, keeper } = await keeperWith(() => clock);
  const sister = KeeperStore.deviceId(SISTER);
  await store.makeLogin(sister, PASSWORD, { name: 'Minji', look: { animal: 'bunny' } }, { username: 'minji' });
  const tablet = await page(keeper, TABLET, '11');
  await tablet.say({ t: 'make-login', username: 'otter', password: PASSWORD, profile: { name: 'Sunny Otter', look: { animal: 'cat', shirt: 4 } } });
  const to = friendId(sister);

  // Not playing now: nobody to invite.
  let reply = await tablet.say({ t: 'invite', to, island: ISLAND });
  assert.equal(reply.code, 'away');

  // Playing on two devices: both hear it. A third, logged in but off screen, does not.
  const phone = await page(keeper, PHONE, '22');
  const laptop = await page(keeper, LAPTOP, '33');
  const hidden = await page(keeper, SISTER, '44');
  for (const p of [phone, laptop, hidden]) await p.say({ t: 'login', username: 'minji', password: PASSWORD });
  await phone.say({ t: 'online', on: true });
  await laptop.say({ t: 'online', on: true });
  reply = await tablet.say({ t: 'invite', to, island: { ...ISLAND, pass: 'f0'.repeat(16) } });
  assert.deepEqual(reply, { t: 'kept', what: 'invite', to });
  for (const p of [phone, laptop]) {
    // Sunny Otter has done nothing yet: level 1 comes in the look anyway, as
    // friends see it (see shownProfile in server/keeper.js).
    assert.deepEqual(p.news(), [{ t: 'invite-news', from: { id: friendId(KeeperStore.deviceId(TABLET)), name: 'Sunny Otter', look: { ...(await store.list(KeeperStore.deviceId(TABLET))).profile.look, level: 1 } }, island: { ...ISLAND, pass: 'f0'.repeat(16) } }]);
  }
  assert.deepEqual(hidden.news(), []);
  assert.ok(keeper.recent.some((e) => e.what === 'invite' && e.player === 'Sunny Otter' && e.to === 'Minji' && e.island === 'Candy Cove'));

  // Not again to her straight away, and not too many a minute.
  assert.equal((await tablet.say({ t: 'invite', to, island: ISLAND })).code, 'wait');
  clock += 16000;
  assert.equal((await tablet.say({ t: 'invite', to, island: ISLAND })).t, 'kept');
  assert.equal(phone.news().length, 2);

  // Nonsense, and players off the list, are no invitation.
  assert.equal((await tablet.say({ t: 'invite', to, island: { ...ISLAND, code: 'abc' } })).code, 'bad');
  assert.equal((await tablet.say({ t: 'invite', to: 'nope', island: ISLAND })).code, 'bad');
  clock += 60000;
  await store.setFindable(sister, false);
  assert.equal((await tablet.say({ t: 'invite', to, island: ISLAND })).code, 'away');
  // Nor can a guest invite anyone.
  const guest = await page(keeper, GUEST, '55');
  assert.match((await guest.say({ t: 'invite', to, island: ISLAND })).text, /Log in/);
  await keeper.stop();
});

test('too many invitations in a minute wait', async () => {
  let clock = 1_000_000;
  const { store, keeper } = await keeperWith(() => clock);
  const tablet = await page(keeper, TABLET, '11');
  await tablet.say({ t: 'make-login', username: 'otter', password: PASSWORD, profile: { name: 'Sunny Otter' } });
  const friends = [];
  for (let i = 0; i < 11; i++) {
    const key = (i + 16).toString(16).repeat(16);
    await store.makeLogin(KeeperStore.deviceId(key), PASSWORD, { name: `Friend ${i}` }, { username: `friend ${i}` });
    const p = await page(keeper, key, '22');
    await p.say({ t: 'login', username: `friend ${i}`, password: PASSWORD });
    await p.say({ t: 'online', on: true });
    friends.push(friendId(KeeperStore.deviceId(key)));
  }
  for (let i = 0; i < 10; i++) {
    clock += 1000;
    // Each message waits its turn at the keeper's rate, as a page's would.
    tablet.conn.tokens = 20;
    assert.equal((await tablet.say({ t: 'invite', to: friends[i], island: ISLAND })).t, 'kept', `invitation ${i}`);
  }
  tablet.conn.tokens = 20;
  assert.equal((await tablet.say({ t: 'invite', to: friends[10], island: ISLAND })).code, 'wait');
  clock += 60000;
  assert.equal((await tablet.say({ t: 'invite', to: friends[10], island: ISLAND })).t, 'kept');
  await keeper.stop();
});

// A room with its owner on it and a passcode set, and a way to knock.
function roomWithPasscode() {
  let t = 1_000_000;
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42, now: () => t });
  const connect = () => {
    const conn = { sent: [], send: (text) => conn.sent.push(JSON.parse(text)), close() {} };
    room.attach(conn);
    return conn;
  };
  const owner = connect();
  room.receive(owner, { t: 'join', protocol: PROTOCOL, name: 'Sunny Otter', look: {} });
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '4821' });
  const knock = (extra = {}) => {
    const conn = connect();
    room.receive(conn, { t: 'join', protocol: PROTOCOL, name: 'Minji', look: {}, ...extra });
    return conn.sent.find((m) => m.t === 'welcome' || m.t === 'error');
  };
  return { room, owner, connect, knock, later: (ms) => (t += ms) };
}

test('an island owner’s pass lets one invited friend in without the passcode, for a while', () => {
  const { room, owner, connect, knock, later } = roomWithPasscode();
  room.receive(owner, { t: 'pass' });
  const { pass } = owner.sent.find((m) => m.t === 'pass');
  assert.match(pass, /^[0-9a-f]{32}$/);
  assert.equal(knock().code, 'passcode', 'without it, the passcode is asked for');
  assert.equal(knock({ pass: 'f0'.repeat(16) }).code, 'passcode', 'a made-up pass is no pass');
  assert.equal(knock({ pass }).t, 'welcome');
  assert.equal(knock({ pass }).code, 'passcode', 'once only');

  // A pass is good for half an hour.
  room.receive(owner, { t: 'pass' });
  const old = owner.sent.findLast((m) => m.t === 'pass').pass;
  later(31 * 60000);
  assert.equal(knock({ pass: old }).code, 'passcode');

  // Only the owner gets passes: a visitor does not know the passcode either.
  const visitor = connect();
  room.receive(visitor, { t: 'join', protocol: PROTOCOL, name: 'Brave Fox', look: {}, passcode: '4821' });
  room.receive(visitor, { t: 'pass' });
  assert.ok(!visitor.sent.some((m) => m.t === 'pass'));
  // An island closed to new visitors stays closed, pass or not.
  room.receive(owner, { t: 'pass' });
  const closed = owner.sent.findLast((m) => m.t === 'pass').pass;
  room.receive(owner, { t: 'host', cmd: 'settings', settings: { locked: true } });
  assert.equal(knock({ pass: closed }).code, 'locked');
});
