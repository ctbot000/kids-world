// Watching an island unseen from the keeper's admin page (shared/watch.js):
// the admin page lists the islands open now and gets a ticket the keeper
// signed for one; the island lets that ticket's page in without a player,
// hearing everything and heard by nobody, and turns away any other.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { KEEPER_VERSION } from '../public/js/shared/keeper.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { canWatch, WATCH_MS } from '../public/js/shared/watch.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, Keeper, KeeperStore } from '../server/keeper.js';
import { createGameServer } from '../server/server.js';

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const CODE = '123456';
const listing = { code: CODE, name: 'Sunny Cove', theme: 'sunny', size: 'small', players: 1, max: 8, passcode: true };

async function keeperHere() {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-watch-'));
  dirs.push(dir);
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity: await createIdentity(dir), log: () => {} });
  await keeper.loadKey();
  return { store, keeper };
}

function conn() {
  const c = { inbox: [], closed: false };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => (c.closed = true);
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  return c;
}

function joinAs(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

// A watch message, and time for the island to check its ticket.
async function watchWith(room, ticket) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'watch', ticket });
  await new Promise((done) => setTimeout(done, 50));
  return c;
}

test('the admin page lists the islands open now and gets a ticket to watch one, with the admin header', async () => {
  const { store, keeper } = await keeperHere();
  keeper.listIsland(CODE, () => listing);
  const server = createGameServer({ log: () => {}, admin: adminHandler({ store, keeper }) });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://localhost:${server.address().port}/admin/api/islands`;
  const headers = { 'X-Kids-World-Admin': '1' };
  try {
    const { islands } = await (await fetch(base)).json();
    assert.deepEqual(
      islands.map((i) => [i.code, i.name, i.players]),
      [[CODE, 'Sunny Cove', 1]],
    );
    assert.equal((await fetch(`${base}/${CODE}/watch`, { method: 'POST' })).status, 403, 'not without the admin header');
    assert.equal((await fetch(`${base}/654321/watch`, { method: 'POST', headers })).status, 404, 'no island open with that code');
    assert.equal((await fetch(`${base}/${CODE}/watch`, { headers })).status, 405);
    const reply = await (await fetch(`${base}/${CODE}/watch`, { method: 'POST', headers })).json();
    assert.equal(reply.code, CODE);
    assert.ok(await canWatch(CODE, reply.ticket), 'a good ticket for that island');
    assert.equal(await canWatch('654321', reply.ticket), false, 'and for no other');
  } finally {
    server.close();
    await keeper.stop();
  }
});

test('a watcher hears everything on the island and nobody hears of it', async () => {
  const { keeper } = await keeperHere();
  keeper.listIsland(CODE, () => listing);
  const room = new Room({ code: CODE, theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  try {
    const owner = joinAs(room, 'Happy Panda');
    room.receive(owner, { t: 'passcode', passcode: '1234' });
    const before = owner.inbox.length;
    const watcher = await watchWith(room, await keeper.watchTicket(CODE));
    const w = watcher.last('welcome');
    assert.ok(w, 'the whole island arrives');
    assert.equal(w.you, -1, 'as nobody on it');
    assert.equal(w.token, '');
    assert.equal('passcode' in w, false, 'the passcode is the owner’s alone');
    assert.deepEqual(
      w.players.map((p) => p.name),
      ['Happy Panda'],
    );
    assert.equal(room.online, 1, 'not counted');
    assert.equal(room.listing().players, 1, 'nor listed as playing');
    assert.deepEqual(owner.inbox.slice(before), [], 'nobody is told');

    room.receive(owner, { t: 'm', s: [10, 12, 10, 0, 1, 0] });
    assert.deepEqual(watcher.last('m')?.s.slice(0, 3), [10, 12, 10], 'it sees friends move');
    const friend = joinAs(room, 'Brave Fox');
    assert.equal(watcher.last('joined')?.player.name, 'Brave Fox', 'and come and go');
    assert.equal(friend.last('welcome').players.length, 2, 'the newcomer sees two players, not three');

    const heard = owner.inbox.length;
    room.receive(watcher, { t: 'say', text: 'hi' });
    room.receive(watcher, { t: 'm', s: [20, 12, 20, 0, 1, 0] });
    room.receive(watcher, { t: 'join', protocol: PROTOCOL, name: 'Sneaky', look: {} });
    room.receive(watcher, { t: 'emote', e: 'wave' });
    assert.deepEqual(owner.inbox.slice(heard), [], 'nothing it sends is heard');
    assert.equal(room.online, 2);
    room.receive(watcher, { t: 'ping' });
    assert.ok(watcher.last('pong'), 'but its pings are answered');
    room.receive(watcher, { t: 'leave' });
    assert.equal(watcher.closed, true);
    assert.deepEqual(owner.inbox.slice(heard), [], 'and it leaves unheard');
  } finally {
    room.close();
    await keeper.stop();
  }
});

test('an island turns away a watcher without a good ticket', async () => {
  const { keeper } = await keeperHere();
  keeper.listIsland(CODE, () => listing);
  const room = new Room({ code: CODE, theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  try {
    joinAs(room, 'Happy Panda');
    const ticket = await keeper.watchTicket(CODE);
    const [until, sig] = ticket.split('.');
    const bad = [undefined, '', 'nope', `${until}.${sig.slice(0, -2)}AA`, `${Number(until) + 1}.${sig}`, `${until}.${sig}x`];
    for (const t of bad) {
      const c = await watchWith(room, t);
      assert.equal(c.last('welcome'), undefined, `not with ${t}`);
      room.receive(c, { t: 'm', s: [1, 1, 1, 0, 0, 0] });
    }
    assert.equal(await keeper.watchTicket('654321'), null, 'no ticket for an island not open');
    assert.equal(await canWatch(CODE, ticket, Date.now() + WATCH_MS + 1000), false, 'nor once it has run out');
    assert.ok(await canWatch(CODE, ticket));
  } finally {
    room.close();
    await keeper.stop();
  }
});

// A page connected to the keeper, as in lock.test.js: say() sends it a
// message, and heard() is everything the keeper sent it.
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
    for (const part of parts) await keeper.receive(conn, part);
    return replies.at(-1);
  };
  await say({ t: 'hello', v: KEEPER_VERSION, nonce: 'ab'.repeat(16) });
  await say({ t: 'me', device });
  return { say, heard: () => replies };
}

test('an island not open to friends is on the admin page’s list alone, and its page is asked to let a watcher in', async () => {
  const { keeper } = await keeperHere();
  try {
    const alone = await page(keeper, 'a1'.repeat(16));
    const open = await page(keeper, 'b2'.repeat(16));
    assert.equal((await alone.say({ t: 'open-island', island: { ...listing, hidden: true } })).what, 'open-island');
    await open.say({ t: 'open-island', island: { ...listing, code: '222333', name: 'Open Bay' } });
    assert.deepEqual(
      keeper.openIslands().map((i) => i.name),
      ['Open Bay'],
      'players never see it',
    );
    assert.deepEqual(
      keeper.allIslands().map((i) => [i.name, i.hidden === true]),
      [
        ['Open Bay', false],
        ['Sunny Cove', true],
      ],
    );
    assert.ok(await keeper.watchTicket(CODE));
    assert.deepEqual(alone.heard().at(-1), { t: 'watch-news', code: CODE }, 'its page is asked to open up for watching');
    assert.ok(await keeper.watchTicket('222333'));
    assert.equal(
      open.heard().some((m) => m.t === 'watch-news'),
      false,
      'one open to friends already lets watchers in',
    );
  } finally {
    await keeper.stop();
  }
});

test('a connection only for watchers lets a watcher in and nobody else', async () => {
  const { keeper } = await keeperHere();
  keeper.listIsland(CODE, () => listing);
  const room = new Room({ code: CODE, theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  try {
    const owner = joinAs(room, 'Happy Panda');
    const sneak = conn();
    sneak.watchOnly = true;
    room.attach(sneak);
    room.receive(sneak, { t: 'join', protocol: PROTOCOL, name: 'Sneaky', look: {} });
    assert.equal(sneak.last('welcome'), undefined);
    assert.equal(sneak.last('error').code, 'locked');
    assert.equal(room.online, 1);
    const watcher = conn();
    watcher.watchOnly = true;
    room.attach(watcher);
    room.receive(watcher, { t: 'watch', ticket: await keeper.watchTicket(CODE) });
    await new Promise((done) => setTimeout(done, 50));
    assert.equal(watcher.last('welcome').you, -1);
    room.receive(owner, { t: 'm', s: [10, 12, 10, 0, 1, 0] });
    assert.ok(watcher.last('m'));
    room.settings.locked = true;
    assert.equal(room.listing(), null, 'closed to new visitors: on no list friends see');
    assert.equal(room.listing({ anyway: true }).code, CODE, 'but the admin page’s');
  } finally {
    room.close();
    await keeper.stop();
  }
});
