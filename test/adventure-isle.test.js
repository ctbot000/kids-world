// The public adventure island: the one adventure island the dedicated server
// keeps for everyone to conquer together, on the list of open islands even
// while nobody is on it; its stages one after another, each a little harder,
// on and on; the beginning of a day back at stage 1; nobody owning it, so
// nobody can be turned away; and the conquered island waiting for its players
// before it goes.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { campCount, cleanStage, guardsFor, kingHearts, raiseSeconds } from '../public/js/shared/adventure.js';
import { cleanListing, sortListings } from '../public/js/shared/listing.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { PUBLIC_ISLAND_NAME, PublicAdventure } from '../server/adventure.js';
import { createGameServer } from '../server/server.js';

function clock(start = Date.now()) {
  const c = { t: start };
  c.now = () => c.t;
  c.advance = (ms) => (c.t += ms);
  return c;
}

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  return c;
}

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

// The stage of one day's island: always the same one, however often the
// server starts again that day.
function isle({ rooms = new Map(), time = clock(), retiredKeepMs = 10 * 60 * 1000 } = {}) {
  return { rooms, time, isle: new PublicAdventure({ rooms, now: time.now, log: () => {}, retiredKeepMs }).start() };
}

const publicEntries = (rooms) => [...rooms.values()].filter((e) => e.public);

// ------------------------------------------------ how the stages grow harder

test('each stage is a little harder than the last, and none is ever hopeless', () => {
  // A stage as told: none or nonsense is stage 1, and no stage goes past 9999.
  assert.equal(cleanStage(undefined), 1);
  assert.equal(cleanStage(0), 1);
  assert.equal(cleanStage(2.5), 1);
  assert.equal(cleanStage(99999), 9999);

  // Camps: three on a cozy island at stage 1, one more every second stage,
  // four more at the most.
  const cozy = { W: 128, D: 128 };
  assert.deepEqual([1, 3, 5, 9, 50].map((s) => campCount(cozy, s)), [3, 4, 5, 7, 7]);
  assert.equal(campCount(cozy), campCount(cozy, 1), 'an island on its own is stage 1');

  // Guards in a camp: one more than there are friends (up to five), one more
  // again every third stage, eight at the most.
  assert.deepEqual([1, 2, 3, 4, 8].map((n) => guardsFor(n)), [2, 3, 4, 5, 5]);
  assert.deepEqual([1, 4, 7, 10, 40].map((s) => guardsFor(2, s)), [3, 4, 5, 6, 8]);

  // King Grumble: a fifth more hearts each stage, four times as many at most.
  assert.equal(kingHearts(1), 18);
  assert.equal(kingHearts(1, 1), 18);
  assert.equal(kingHearts(1, 6), 36);
  assert.equal(kingHearts(4, 1), 36);
  assert.equal(kingHearts(4, 16), 144);
  assert.equal(kingHearts(4, 400), 144, 'no harder than four times');

  // Flags: a tenth longer to raise each stage, twice as long at most.
  assert.deepEqual([1, 2, 3, 4, 6].map((n) => raiseSeconds(n)), [10, 6, 4.5, 4, 4]);
  assert.equal(raiseSeconds(1, 1), 10);
  assert.equal(raiseSeconds(1, 6), 15);
  assert.equal(raiseSeconds(1, 11), 20);
  assert.equal(raiseSeconds(1, 90), 20, 'never twice as long as that');
});

// ------------------------------------------------ the island itself

test('one public adventure island, on the list even with nobody on it, owned by nobody', () => {
  const { rooms, time, isle: one } = isle();
  assert.equal(rooms.size, 1, 'one island');
  const [entry] = [...rooms.values()];
  assert.equal(entry.public, true);
  const room = entry.room;
  assert.equal(room.world.name, PUBLIC_ISLAND_NAME);
  assert.equal(room.shared, true);
  assert.equal(room.settings.locked, false);

  // On the list of open islands with nobody on it, and first.
  const listing = room.listing();
  assert.equal(listing.players, 0);
  assert.equal(listing.public, true);
  assert.deepEqual(listing.adventure, { camps: room.adventure.camps.filter((c) => c.kind === 'camp').length, freed: 0, won: false, stage: 1 });
  const cleaned = cleanListing(listing);
  assert.equal(cleaned.public, true);
  assert.equal(cleaned.adventure.stage, 1);
  const busier = cleanListing({ ...listing, code: '111111', name: 'Bunny Bay', players: 3, public: false });
  assert.deepEqual(
    sortListings([busier, cleaned]).map((i) => i.code),
    [listing.code, '111111'],
    'the public island heads the list',
  );

  // Anyone comes and goes; nobody becomes its owner, so its rules are nobody's to change.
  const a = join(room, 'Sunny Otter');
  const b = join(room, 'Brave Fox');
  assert.equal(room.host, 0, 'nobody is the owner');
  assert.equal(a.last('welcome').host, 0);
  assert.equal(room.online, 2);
  room.receive(a, { t: 'host', cmd: 'settings', settings: { locked: true } });
  assert.deepEqual(a.last('notice'), { t: 'notice', level: 'info', text: 'This island is everyone’s, so nobody is its owner. Everybody is welcome!' });
  assert.equal(room.settings.locked, false, 'still open to everyone');
  assert.equal(room.listing().players, 2);
  assert.equal(one.room, room);

  // The island of a stage is the same one all day, however often the server
  // starts again: the same day and stage make the same island.
  const again = isle({ time: clock(time.t) });
  assert.equal(again.isle.room.world.seed, one.room.world.seed);
});

test('conquered: the next stage is up at once, the conquered one waits for its players', () => {
  const { rooms, time, isle: one } = isle({ retiredKeepMs: 60 * 1000 });
  const room = one.room;
  const a = join(room, 'Sunny Otter');
  one.tick(time.now());
  assert.equal(rooms.size, 1, 'nothing happens until it is conquered');

  room.adventure.win(room.monsters);
  one.tick(time.now());
  assert.equal(one.stage, 2);
  assert.equal(rooms.size, 2, 'the conquered island still there for its players');
  assert.equal(publicEntries(rooms).length, 1, 'one public island at a time');
  const next = publicEntries(rooms)[0].room;
  assert.notEqual(next, room);
  assert.equal(next.stage, 2);
  assert.equal(next.world.theme, 'snowy', 'each stage its own kind of island');
  assert.equal(next.adventure.stage, 2);
  assert.equal(next.world.name, PUBLIC_ISLAND_NAME);
  assert.deepEqual(next.listing().adventure, { camps: next.adventure.camps.filter((c) => c.kind === 'camp').length, freed: 0, won: false, stage: 2 });
  assert.equal(room.closed, false, 'the conquered island stays open a while');
  assert.ok(a.last('notice').text.includes('stage 2'), 'those there hear where the next one is');

  // A second conquest, and a third: on and on, one at a time.
  for (const stage of [3, 4]) {
    const current = publicEntries(rooms)[0].room;
    current.adventure.win(current.monsters);
    one.tick(time.now());
    assert.equal(one.stage, stage);
    assert.equal(publicEntries(rooms).length, 1);
  }
  assert.equal(publicEntries(rooms)[0].room.adventure.stage, 4);

  // The retired islands go once everyone has left them (and a while after).
  time.advance(59 * 1000);
  one.tick(time.now());
  assert.equal(rooms.size, 4, 'their while not yet past');
  time.advance(2 * 1000);
  one.tick(time.now());
  assert.equal(rooms.size, 2, 'the empty ones gone, the one with a player waiting');
  room.receive(a, { t: 'leave' });
  for (let t = 0; t < 62 && rooms.size > 1; t++) {
    time.advance(1000);
    one.tick(time.now());
  }
  assert.equal(rooms.size, 1, 'gone once empty and their while past');
  assert.equal(publicEntries(rooms)[0].room.adventure.stage, 4);
});

test('the beginning of a day starts the stages over at 1', () => {
  const { rooms, time, isle: one } = isle();
  let room = one.room;
  for (const stage of [2, 3]) {
    room.adventure.win(room.monsters);
    one.tick(time.now());
    room = one.room;
  }
  assert.equal(one.stage, 3);
  const b = join(room, 'Brave Fox');

  // However the third stage was going, the day after begins at stage 1.
  const midnight = new Date(time.t);
  midnight.setHours(24, 0, 0, 0);
  time.t = midnight.getTime();
  one.tick(time.now());
  assert.equal(one.stage, 1);
  assert.equal(publicEntries(rooms).length, 1);
  assert.equal(one.room.adventure.stage, 1);
  assert.ok(b.last('notice').text.includes('stage 1'), 'those there hear the new day');
  // The same day keeps its stages: a tick that stays in the day changes
  // nothing, and the retired one with a player waits for them (the ones
  // empty since before the day are long past their while).
  one.tick(time.now());
  assert.equal(one.stage, 1);
  assert.equal(rooms.size, publicEntries(rooms).length + 1, 'the retired one waits for its player');

  // The new day's stage 1 is its own island, not the day before's come again.
  const yesterday = one.room;
  yesterday.adventure.win(yesterday.monsters);
  one.tick(time.now());
  assert.equal(one.stage, 2, 'and on the stages go');
});

// ------------------------------------------------ over the real server

let server;
let port;

before(async () => {
  server = createGameServer({ log: () => {} });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  port = server.address().port;
});

after(async () => {
  await server.shutdown();
});

const islands = async () => (await (await fetch(`http://127.0.0.1:${port}/api/islands`)).json()).islands;

test('the server lists its public adventure island and anyone can come and conquer it', async () => {
  // First on the list with nobody on it.
  let listed = await islands();
  assert.equal(listed.filter((i) => i.public).length, 1);
  const isle = listed.find((i) => i.public);
  assert.equal(isle.name, PUBLIC_ISLAND_NAME);
  assert.equal(isle.players, 0);
  assert.equal(isle.adventure.stage, 1);

  // Anyone joins it over WebSocket, like any island.
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  ws.addEventListener('message', (e) => inbox.push(JSON.parse(e.data)));
  await new Promise((done, fail) => {
    ws.addEventListener('open', done);
    ws.addEventListener('error', fail);
  });
  ws.send(JSON.stringify({ t: 'join', protocol: PROTOCOL, code: isle.code, name: 'Clever Fox', look: { animal: 'frog' } }));
  const welcome = await new Promise((done) => {
    const timer = setInterval(() => {
      const msg = inbox.find((m) => m.t === 'welcome');
      if (msg) {
        clearInterval(timer);
        done(msg);
      }
    }, 20);
  });
  assert.equal(welcome.host, 0, 'nobody owns it');
  assert.equal(welcome.adventure.stage, 1);
  for (let tries = 0; tries < 50 && (await islands()).find((i) => i.public)?.players !== 1; tries++) await new Promise((done) => setTimeout(done, 20));
  assert.equal((await islands()).find((i) => i.public).players, 1);

  // Conquered: the next stage is the public one within a moment.
  const room = server.rooms.get(isle.code).room;
  room.adventure.win(room.monsters);
  let stage = 0;
  for (let tries = 0; tries < 100 && stage !== 2; tries++) {
    await new Promise((done) => setTimeout(done, 20));
    stage = (await islands()).find((i) => i.public)?.adventure.stage ?? 0;
  }
  listed = await islands();
  const now = listed.find((i) => i.public);
  assert.equal(stage, 2, 'the next stage is up');
  assert.equal(listed.filter((i) => i.public).length, 1, 'still just the one');
  assert.equal(listed[0].code, now.code, 'it heads the list');
  assert.equal(listed.find((i) => i.code === isle.code).players, 1, 'the conquered one waits for its player');
  ws.close();
});
