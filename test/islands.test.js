// The list of open islands and passcodes: listings tidied and sorted, a
// room's passcode (asked of new visitors only, guessed slowly, heard only by
// its owner, kept when saved), and the keeper's list (the protocol without
// WebRTC).
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { cleanListing, LIST_MAX, normalizePasscode, randomPasscode, sortListings } from '../public/js/shared/listing.js';
import { MAX_PLAYERS, PROTOCOL, Room } from '../public/js/shared/room.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const listing = (code, extra = {}) => ({ code, name: `Island ${code}`, theme: 'sunny', size: 'small', players: 1, max: 8, passcode: false, ...extra });

test('a listing is tidied, and anything that is not one is refused', () => {
  assert.deepEqual(cleanListing(listing('123456', { name: '  Bunny   Bay ', theme: 'moon', size: 'giant', players: 99, passcode: 'yes' })), {
    code: '123456',
    name: 'Bunny Bay',
    theme: 'sunny',
    size: 'small',
    players: 8,
    max: 8,
    passcode: false,
  });
  assert.equal(cleanListing(listing('123456', { passcode: true, theme: 'candy', size: 'huge' })).passcode, true);
  assert.equal(cleanListing(listing('12345')), null, 'a code has six numbers');
  assert.equal(cleanListing(listing('123456', { name: '​' })), null, 'an island has a name to see');
  assert.equal(cleanListing(listing('123456', { name: 'x'.repeat(40) })), null);
  assert.equal(cleanListing(null), null);
  assert.equal(cleanListing(listing('123456', { players: -3 })).players, 0);
});

test('the list shows the busiest first, full islands last, and only so many', () => {
  const sorted = sortListings([listing('111111', { players: 1 }), listing('222222', { players: 8 }), listing('333333', { players: 5 }), listing('444444', { players: 1, name: 'Apple Isle' })]);
  assert.deepEqual(
    sorted.map((i) => i.code),
    ['333333', '444444', '111111', '222222'],
  );
  const many = Array.from({ length: LIST_MAX + 10 }, (_, i) => listing(String(100000 + i)));
  assert.equal(sortListings(many).length, LIST_MAX);
});

test('a passcode is four numbers, however it was typed', () => {
  assert.equal(normalizePasscode('12 34'), '1234');
  assert.equal(normalizePasscode('１２３４'), '', 'only the digits 0 to 9');
  assert.equal(normalizePasscode('123'), '');
  assert.equal(normalizePasscode('12345'), '');
  assert.equal(normalizePasscode(1234), '1234');
  for (let i = 0; i < 50; i++) assert.match(randomPasscode(), /^\d{4}$/);
});

// ------------------------------------------------ the room

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => (c.t += ms);
  return c;
}

function conn() {
  const c = { inbox: [], closed: false };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => (c.closed = true);
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  return c;
}

function makeRoom() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'snowy', size: 'big', name: 'Frosty Fjord', seed: 7, now: time.now });
  return { room, time };
}

function join(room, extra = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' }, ...extra });
  return c;
}

test('an island anyone can come in to, until its owner gives it a passcode', () => {
  const { room } = makeRoom();
  const owner = join(room);
  assert.equal(owner.last('welcome').passcode, '', 'the owner hears there is none');
  assert.equal(owner.last('welcome').settings.passcode, false);
  const friend = join(room, { name: 'Brave Otter' });
  assert.ok(friend.last('welcome'), 'anyone comes in');
  assert.equal(friend.last('welcome').passcode, undefined, 'only the owner hears the passcode');
  const token = friend.last('welcome').token;

  // Only the owner gives it one, and only four numbers.
  room.receive(friend, { t: 'host', cmd: 'passcode', passcode: '1111' });
  assert.equal(room.passcode, '');
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '12a' });
  assert.equal(room.passcode, '');
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '4821' });
  assert.equal(room.passcode, '4821');
  assert.deepEqual(owner.last('passcode'), { t: 'passcode', passcode: '4821' });
  assert.equal(friend.last('settings').settings.passcode, true, 'everyone hears there is one');
  assert.equal(friend.last('passcode'), undefined, 'but not what it is');
  assert.equal(JSON.stringify(friend.inbox).includes('4821'), false);

  // A new visitor needs it.
  const stranger = join(room, { name: 'Clever Fox' });
  assert.equal(stranger.last('error').code, 'passcode');
  assert.equal(stranger.last('welcome'), undefined);
  const wrong = join(room, { name: 'Clever Fox', passcode: '0000' });
  assert.equal(wrong.last('error').code, 'passcode');
  assert.equal(wrong.last('error').wrong, true);
  const right = join(room, { name: 'Clever Fox', passcode: '48 21' });
  assert.ok(right.last('welcome'));

  // A friend who came in before comes back without it.
  room.detach(friend);
  const back = join(room, { name: 'Brave Otter', token });
  assert.equal(back.last('welcome').you, friend.last('welcome').you);

  // No passcode: anyone again.
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '' });
  assert.equal(room.passcode, '');
  assert.ok(join(room, { name: 'Sleepy Owl' }).last('welcome'));
});

test('wrong passcodes are guessed slowly, for the whole island', () => {
  const { room, time } = makeRoom();
  const owner = join(room);
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '4821' });
  for (let i = 0; i < 5; i++) assert.equal(join(room, { passcode: String(1000 + i) }).last('error').wrong, true);
  // Even the right one waits now, so guessing from many connections is no faster.
  const waiting = join(room, { passcode: '4821' });
  assert.equal(waiting.last('error').code, 'passcode');
  assert.equal(waiting.last('error').wait, true);
  time.advance(10000);
  assert.ok(join(room, { passcode: '4821' }).last('welcome'));
});

test('the new owner hears the passcode, and it is kept when the island is saved', () => {
  const { room } = makeRoom();
  const owner = join(room);
  const friend = join(room, { name: 'Brave Otter' });
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '0042' });
  room.receive(owner, { t: 'host', cmd: 'handover', pid: friend.last('welcome').you });
  assert.deepEqual(friend.last('passcode'), { t: 'passcode', passcode: '0042' });
  const save = room.exportSave();
  assert.equal(save.passcode, '0042');
  assert.equal(save.settings.passcode, undefined, 'the rules are kept as they were');
  const again = new Room({ save });
  assert.equal(again.passcode, '0042');
  assert.equal(new Room({ save: { ...save, passcode: 'abcd' } }).passcode, '', 'a passcode that is none is dropped');
  assert.equal(new Room({ save: { ...save, passcode: undefined } }).passcode, '', 'islands from before passcodes have none');
});

test('a room lists itself while it is open to new visitors', () => {
  const { room } = makeRoom();
  const owner = join(room);
  join(room, { name: 'Brave Otter' });
  assert.deepEqual(room.listing(), { code: '123456', name: 'Frosty Fjord', theme: 'snowy', size: 'big', players: 2, max: MAX_PLAYERS, passcode: false });
  room.receive(owner, { t: 'host', cmd: 'passcode', passcode: '1234' });
  assert.equal(room.listing().passcode, true);
  room.receive(owner, { t: 'host', cmd: 'settings', settings: { locked: true } });
  assert.equal(room.listing(), null, 'closed to new visitors: off the list');
});

// ------------------------------------------------ the keeper's list

async function page(keeper, device) {
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
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: '11'.repeat(16) });
  await say({ t: 'me', device });
  return { conn, say };
}

test('the keeper lists the islands hosts tell it about, for as long as they stay', async () => {
  const dir = await mkdtemp(joinPath(tmpdir(), 'kids-world-islands-'));
  dirs.push(dir);
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {} });
  await keeper.loadKey();

  const anyone = await page(keeper, 'a1'.repeat(16));
  assert.deepEqual(await anyone.say({ t: 'islands' }), { t: 'islands', islands: [] });

  const host = await page(keeper, 'b2'.repeat(16));
  assert.deepEqual(await host.say({ t: 'open-island', island: listing('482753', { name: 'Bunny Bay', players: 2 }) }), { t: 'kept', what: 'open-island', code: '482753' });
  const other = await page(keeper, 'c3'.repeat(16));
  await other.say({ t: 'open-island', island: listing('111222', { name: 'Candy Cove', theme: 'candy', players: 3, passcode: true }) });
  assert.deepEqual(
    (await anyone.say({ t: 'islands' })).islands.map((i) => [i.code, i.name, i.players, i.passcode]),
    [
      ['111222', 'Candy Cove', 3, true],
      ['482753', 'Bunny Bay', 2, false],
    ],
  );
  assert.equal(keeper.status().islands, 2);

  // What is no island is refused; an island told again is updated.
  assert.equal((await host.say({ t: 'open-island', island: { code: 'nope' } })).code, 'bad');
  await host.say({ t: 'open-island', island: listing('482753', { name: 'Bunny Bay', players: 5 }) });
  assert.equal((await anyone.say({ t: 'islands' })).islands[0].players, 5);

  // The newest word about a code wins: one island a code.
  const reopened = await page(keeper, 'd4'.repeat(16));
  await reopened.say({ t: 'open-island', island: listing('482753', { name: 'Bunny Bay Again' }) });
  assert.deepEqual(
    (await anyone.say({ t: 'islands' })).islands.filter((i) => i.code === '482753').map((i) => i.name),
    ['Bunny Bay Again'],
  );

  // Closed, or the page gone: off the list.
  assert.deepEqual(await other.say({ t: 'close-island' }), { t: 'kept', what: 'close-island' });
  keeper.drop(reopened.conn);
  assert.deepEqual((await anyone.say({ t: 'islands' })).islands, []);
  await keeper.stop();
});
