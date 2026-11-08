// The public adventure island: the one adventure island the dedicated server
// keeps for everyone to conquer together, on the list of open islands even
// while nobody is on it; its stages one after another, each harder than the
// last, up to the last chapter of its story, and that one won, a new journey
// from stage 1 (and nothing else starting it over); nobody owning it, so
// nobody can be turned away; and the conquered island waiting for its players
// before it goes.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { after, before, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { ambushFor, cleanStage, guardBackMs, guardsFor, hazardEvery, kingHearts, raiseSeconds, reserveFor, slideFor, stageGap } from '../public/js/shared/adventure.js';
import { chapterOf, STAGES } from '../public/js/shared/isle-story.js';
import { CRITTER_INFO } from '../public/js/shared/critters.js';
import { cleanListing, sortListings } from '../public/js/shared/listing.js';
import { EDIT_KINDS, PROTOCOL } from '../public/js/shared/room.js';
import { MAX_RUNS, NEW_RUN_MS, PUBLIC_ISLAND_NAME, PublicAdventure, RUN_IDLE_MS } from '../server/adventure.js';
import { isValidCode } from '../public/js/shared/codes.js';
import { adminHandler } from '../server/admin.js';
import { createGameServer } from '../server/server.js';

// A fake clock that starts at a set noon, not the real time: a test that
// jumps to "midnight" means the next one, a full half day of its own away,
// so islands retired a few minutes earlier are long past their while
// whatever hour the tests run at (from real time, just before midnight they
// were not).
function clock(start = new Date(2026, 9, 11, 12).getTime()) {
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

test('each stage is harder than the last, up to the last, and none is ever hopeless', () => {
  // A stage as told: none or nonsense is stage 1, and no stage goes past 9999.
  assert.equal(cleanStage(undefined), 1);
  assert.equal(cleanStage(0), 1);
  assert.equal(cleanStage(2.5), 1);
  assert.equal(cleanStage(99999), 9999);

  // Guards in a camp: one more than there are friends (up to five), one more
  // again every second stage, nine at the most.
  assert.deepEqual([1, 2, 3, 4, 8].map((n) => guardsFor(n)), [2, 3, 4, 5, 5]);
  assert.deepEqual([1, 3, 5, 7, 40].map((s) => guardsFor(2, s)), [3, 4, 5, 6, 9]);

  // The boss: a quarter more hearts each stage, four times as many at most,
  // and quicker with its moves.
  assert.equal(kingHearts(1), 18);
  assert.equal(kingHearts(1, 1), 18);
  assert.equal(kingHearts(1, 5), 36);
  assert.equal(kingHearts(4, 1), 36);
  assert.equal(kingHearts(4, STAGES), 135);
  assert.equal(kingHearts(4, 400), 144, 'no harder than four times');
  assert.deepEqual([1, 12, 400].map(stageGap), [1, 0.725, 2 / 3]);

  // Popped monsters back sooner, but only so many times from the third stage
  // (so a camp is never hopeless); a flag sliding back while they hold it
  // from the second, and an ambush half way up it from the third.
  assert.deepEqual([1, 12].map((s) => guardBackMs(s)), [20000, 13400]);
  assert.deepEqual([[1, 2], [1, 3], [1, 12]].map(([n, s]) => reserveFor(n, s)), [Infinity, 3, 14]);
  assert.deepEqual([1, 2, 12].map((s) => slideFor(s)), [0, 0.01, 0.04]);
  assert.deepEqual([[1, 2], [1, 3], [3, 12], [8, 400]].map(([n, s]) => ambushFor(n, s)), [0, 1, 6, 6]);
  assert.deepEqual([2, 12].map(hazardEvery), [12000, 5000]);

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
  assert.deepEqual(listing.adventure, { camps: room.adventure.camps.filter((c) => c.kind === 'camp').length, freed: 0, won: false, stage: 1, run: 1, journey: 1 });
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
  assert.equal(next.adventure.story.key, 'woods', 'each stage the next chapter of the story, on its own map');
  assert.equal(next.world.theme, chapterOf(2).theme);
  assert.notDeepEqual(next.adventure.camps.map((c) => [c.x, c.z]), room.adventure.camps.map((c) => [c.x, c.z]), 'not the same island again');
  assert.equal(next.adventure.stage, 2);
  assert.equal(next.world.name, PUBLIC_ISLAND_NAME);
  assert.deepEqual(next.listing().adventure, { camps: next.adventure.camps.filter((c) => c.kind === 'camp').length, freed: 0, won: false, stage: 2, run: 1, journey: 1 });
  assert.equal(room.closed, false, 'the conquered island stays open a while');
  assert.ok(a.last('notice').text.includes('stage 2'), 'those there hear where the next one is');
  assert.deepEqual(a.last('next'), { t: 'next', code: next.code, stage: 2 }, 'and their pages where to take them on to');
  const late = join(room, 'Late Llama');
  assert.deepEqual(late.last('welcome').next, { code: next.code, stage: 2 }, 'whoever comes back to it hears too');
  const fresh = join(next, 'Fresh Fox');
  assert.equal(fresh.last('welcome').next, undefined, 'the next stage has no next stage yet');
  room.receive(late, { t: 'leave' });
  next.receive(fresh, { t: 'leave' });

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

// Every stage won, one after another, up to the last.
function winAll(one, time, upTo = STAGES) {
  while (one.stage < upTo) {
    one.room.adventure.win(one.room.monsters);
    one.tick(time.now());
  }
}

test('the journey, the stage and the camps freed are kept over a restart, whatever the day', (t) => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'kw-isle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = joinPath(dir, 'adventure-isle.json');
  const time = clock(new Date(2026, 9, 11, 12).getTime());
  const make = () => new PublicAdventure({ rooms: new Map(), now: time.now, log: () => {}, file }).start();

  const one = make();
  assert.deepEqual([one.stage, one.journey], [1, 1]);
  winAll(one, time, 3);
  // A camp freed on stage 3 is kept as soon as it is.
  const adv = one.room.adventure;
  one.room.campFreed(adv.free(adv.campById(1), [], one.room.monsters));
  one.tick(time.now());
  const seed = one.room.world.seed;
  one.stop();

  // The server starts again, days later: on at stage 3, the very same island,
  // with its first camp still free and its gate open.
  time.advance(3 * 24 * 60 * 60 * 1000);
  const again = make();
  assert.deepEqual([again.stage, again.journey, again.room.stage, again.room.world.seed], [3, 1, 3, seed]);
  assert.deepEqual(again.room.adventure.camps.filter((c) => c.freed).map((c) => c.id), [1]);
  assert.equal(again.room.adventure.gates[0].open, true);
  again.stop();

  // From before there could be more than one game, a file of one: that game
  // is kept, at its stage, and a new one from stage 1 starts first beside it,
  // so the story can be begun again from the start. One past the last
  // chapter is that game's next journey.
  writeFileSync(file, JSON.stringify({ day: '2026-10-11', stage: 4 }));
  const legacy = make();
  assert.deepEqual(legacy.runs.map((r) => [r.stage, r.journey]), [[1, 1], [4, 1]]);
  assert.deepEqual([legacy.stage, legacy.room.stage], [1, 1], 'the new one first');
  legacy.stop();
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).runs.map((r) => r.stage), [1, 4], 'and kept that way');
  writeFileSync(file, JSON.stringify({ journey: 1, stage: STAGES + 3 }));
  const past = make();
  assert.deepEqual(past.runs.map((r) => [r.stage, r.journey]), [[1, 1], [1, 2]]);
  past.stop();

  // Nonsense in the file is stage 1, not a crash.
  writeFileSync(file, 'not json');
  assert.equal(make().stage, 1);
});

test('nothing starts the stages over but the last stage won: then a new journey begins at stage 1', () => {
  const { rooms, time, isle: one } = isle();
  winAll(one, time, 4);
  // Midnight, and days after: still the same stage.
  time.advance(2 * 24 * 60 * 60 * 1000);
  one.tick(time.now());
  assert.deepEqual([one.stage, one.journey], [4, 1]);

  winAll(one, time);
  assert.equal(one.stage, STAGES);
  assert.equal(one.room.adventure.story.final, true, 'the last chapter');
  assert.equal(one.room.adventure.describe().final, true, 'and the pages are told so');
  const last = one.room;
  const b = join(last, 'Brave Fox');
  last.adventure.win(last.monsters);
  one.tick(time.now());
  assert.deepEqual([one.stage, one.journey], [1, 2], 'a new journey');
  assert.equal(one.room.adventure.describe().journey, 2);
  assert.equal(publicEntries(rooms).length, 1);
  assert.deepEqual(b.last('next'), { t: 'next', code: one.room.code, stage: 1 }, 'those there sent on to it, after the ending');
  assert.match(b.last('notice').text, /shines again/);
  // The new journey's islands are their own, its maps turned over.
  assert.notDeepEqual(one.room.adventure.camps.map((c) => [c.x, c.z]), last.adventure.camps.map((c) => [c.x, c.z]));
  one.room.adventure.win(one.room.monsters);
  one.tick(time.now());
  assert.deepEqual([one.stage, one.journey], [2, 2], 'and on the stages go');
});

test('anyone can start a new game from stage 1, kept apart from the others, each kept over a restart', (t) => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'kw-isle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = joinPath(dir, 'adventure-isle.json');
  const time = clock();
  const rooms = new Map();
  const make = () => new PublicAdventure({ rooms, now: time.now, log: () => {}, file }).start();
  const one = make();
  winAll(one, time, 3);
  const a = join(one.room, 'Brave Fox');
  // From the isle: a new game, and the one who asked is told where it is.
  one.room.receive(a, { t: 'isle', op: 'new' });
  const started = a.last('isle-run');
  assert.ok(isValidCode(started.code));
  assert.equal(started.stage, 1);
  assert.equal(one.runs.length, 2);
  const fresh = rooms.get(started.code).room;
  assert.deepEqual([fresh.stage, fresh.public, fresh.journey], [1, true, 1]);
  assert.deepEqual(fresh.listing().adventure, { camps: fresh.adventure.camps.filter((c) => c.kind === 'camp').length, freed: 0, won: false, stage: 1, run: 2, journey: 1, by: 'Brave Fox' });
  assert.equal(one.room.stage, 3, 'the first game where it was');
  assert.equal(publicEntries(rooms).length, 2, 'both on the list');
  // Not again at once by the same player.
  one.room.receive(a, { t: 'isle', op: 'new' });
  assert.equal(a.inbox.filter((m) => m.t === 'isle-run').length, 1);
  // From the title, a moment later: a join asking for a new game is told
  // where one is — the one just started, to start it together — and no more.
  const c = conn();
  one.room.attach(c);
  one.room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' }, isle: 'new' });
  assert.deepEqual(c.last('isle-run'), { t: 'isle-run', code: started.code, stage: 1 });
  assert.equal(c.last('welcome'), undefined, 'nobody came to this one');
  assert.equal(one.runs.length, 2);
  // Each goes on by itself.
  fresh.adventure.win(fresh.monsters);
  one.tick(time.now());
  assert.deepEqual(one.runs.map((r) => r.stage), [3, 2]);
  // And each is kept over a restart.
  one.stop();
  const again = make();
  assert.deepEqual(again.runs.map((r) => [r.id, r.stage, r.by]), [[1, 3, ''], [2, 2, 'Brave Fox']]);
  // As many games as there may be: no more, until one nobody has played for
  // days makes room for a new one.
  while (again.runs.length < MAX_RUNS) {
    time.advance(NEW_RUN_MS + 1);
    assert.ok(again.newRun('Quick Owl').code);
  }
  time.advance(NEW_RUN_MS + 1);
  assert.match(again.newRun('Late Llama').error, /games on Adventure Isle already/);
  time.advance(RUN_IDLE_MS);
  const late = again.newRun('Late Llama');
  assert.ok(late.code);
  assert.equal(again.runs.length, MAX_RUNS);
  assert.ok(!again.runs.some((r) => r.id === 1), 'the one played longest ago made room');
  again.stop();
});

test('the admin can start a game over from stage 1 or remove it, whoever is on it sent on', (t) => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'kw-isle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = joinPath(dir, 'adventure-isle.json');
  const time = clock();
  const rooms = new Map();
  const one = new PublicAdventure({ rooms, now: time.now, log: () => {}, file }).start();
  winAll(one, time, 4);
  time.advance(NEW_RUN_MS + 1);
  const second = one.newRun('Brave Fox');
  const a = join(one.room, 'Sunny Otter');
  one.tick(time.now());
  assert.deepEqual(one.adminList().map((g) => [g.id, g.first, g.stage, g.journey, g.by, g.players]), [[1, true, 4, 1, '', 1], [2, false, 1, 1, 'Brave Fox', 0]]);

  // Started over: back to stage 1, whoever was on it sent on there.
  const old = one.room;
  const to = one.resetRun(1);
  assert.deepEqual(to, { code: one.room.code, stage: 1 });
  assert.deepEqual(one.runs.map((r) => [r.id, r.stage, r.journey]), [[1, 1, 1], [2, 1, 1]]);
  assert.equal(old.public, false, 'its old island retired');
  assert.deepEqual(a.last('next'), { t: 'next', code: to.code, stage: 1 });
  assert.match(a.last('notice').text, /starts over from stage 1/);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).runs.map((r) => r.stage), [1, 1], 'and kept');

  // Removed: gone for good, whoever is on it sent on to another game.
  const b = join(rooms.get(second.code).room, 'Happy Panda');
  const gone = one.removeRun(2);
  assert.deepEqual(gone, { code: one.room.code, stage: 1 });
  assert.deepEqual(one.runs.map((r) => r.id), [1]);
  assert.deepEqual(b.last('next'), { t: 'next', code: one.room.code, stage: 1 });
  assert.equal(rooms.has(second.code), true, 'its island waits for its player');
  rooms.get(second.code).room.receive(b, { t: 'leave' });
  one.tick(time.now());
  time.advance(11 * 60 * 1000);
  one.tick(time.now());
  assert.equal(rooms.has(second.code), false, 'and goes once they have');
  // The only game removed: a new one from stage 1 takes its place.
  const last = one.room.code;
  assert.ok(one.removeRun(1));
  assert.equal(one.runs.length, 1);
  assert.notEqual(one.room.code, last);
  assert.equal(one.stage, 1);
  assert.equal(one.removeRun(99), null, 'no such game');
  assert.equal(one.resetRun(99), null);
  one.stop();
});

test('the admin page lists the isle’s games and starts one over, removes one or starts a new one', async () => {
  const web = createGameServer({ log: () => {}, admin: adminHandler({ store: { dir: tmpdir() }, isle: () => web.publicAdventure }) });
  await new Promise((done) => web.listen(0, '127.0.0.1', done));
  try {
    const api = async (path, method = 'GET', headers = { 'X-Kids-World-Admin': '1' }) => {
      const res = await fetch(`http://127.0.0.1:${web.address().port}/admin/api/isle${path}`, { method, headers });
      return { status: res.status, body: await res.json().catch(() => null) };
    };
    const listed = await api('');
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.games.map((g) => [g.id, g.stage]), [[1, 1]]);
    assert.equal(listed.body.max, MAX_RUNS);
    // Changes need the admin header.
    assert.equal((await api('/games', 'POST', {})).status, 403);
    const made = await api('/games', 'POST');
    assert.equal(made.status, 200);
    assert.deepEqual(made.body.games.map((g) => g.id), [1, 2]);
    web.publicAdventure.room.adventure.win(web.publicAdventure.room.monsters);
    web.publicAdventure.tick();
    assert.equal(web.publicAdventure.stage, 2);
    const reset = await api('/games/1/reset', 'POST');
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.body.games.map((g) => [g.id, g.stage]), [[1, 1], [2, 1]]);
    const removed = await api('/games/2', 'DELETE');
    assert.deepEqual(removed.body.games.map((g) => g.id), [1]);
    assert.equal((await api('/games/2', 'DELETE')).status, 404);
    assert.equal((await api('/games/1', 'PUT')).status, 405);
  } finally {
    await web.shutdown();
  }
});

test('each island as it comes and goes, told to whoever wants it (the server, to host it peer to peer)', () => {
  const { rooms, time, isle: one } = isle({ retiredKeepMs: 60 * 1000 });
  const opened = [];
  const retired = [];
  const gone = [];
  one.onOpen = (room) => opened.push(room);
  one.onRetire = (room) => retired.push(room);
  one.onGone = (room) => gone.push(room);
  assert.deepEqual([opened, retired, gone], [[], [], []], 'nothing until it changes');

  const first = one.room;
  first.adventure.win(first.monsters);
  one.tick(time.now());
  assert.deepEqual(opened, [one.room], 'the next stage opened');
  assert.deepEqual(retired, [first], 'the conquered one retired');
  assert.equal(rooms.has(first.code), true, 'still one of the rooms, until swept');
  assert.deepEqual(gone, [], 'not gone yet: whoever is on it stays on it, peer to peer too');

  const second = one.room;
  second.adventure.win(second.monsters);
  time.advance(61 * 1000);
  one.tick(time.now());
  assert.deepEqual(opened, [second, one.room], 'the third stage opened');
  assert.deepEqual(retired, [first, second]);
  assert.equal(rooms.has(first.code), false, 'the first one swept once its while was past');
  assert.deepEqual(gone, [first], 'and told of, so its sharing stops');
  assert.equal(rooms.has(second.code), true, 'the second one waits for its while');

  // Stopping tells of the current one too, so its sharing stops with it.
  const current = one.room;
  one.stop();
  assert.deepEqual(retired.at(-1), current);
  assert.deepEqual(gone, [first, current, second], 'every island there was, gone');
});

// The shared isle keeps its toy box shut and its players on their own feet:
// nobody builds on it, nothing is brought to it or sent away (flying there
// is a matter for each player's own page, not the island), and it has no
// helicopter or balloon to fly over its gates — though what it has, such
// as the boat at Shipwreck Shore's pier, anyone rides.
test('its toy box stays shut: nobody builds on it, nothing is brought to it or sent away', () => {
  const { isle: one } = isle();
  const room = one.room;
  const a = join(room, 'Sunny Otter');
  const w = room.world;

  // No helicopter or balloon: it is an adventure on foot. Its boat sails,
  // as on any island, for anyone.
  for (const type of ['helicopter', 'balloon']) assert.equal(room.critters.list.some((c) => c.type === type), false, `no ${type}`);
  const boat = room.critters.list.find((c) => c.type === 'boat');
  assert.ok(boat, 'the boat at the pier');
  room.receive(a, { t: 'm', s: [boat.x, boat.y, boat.z, 0, 0, 0] });
  room.receive(a, { t: 'critter', op: 'ride', id: boat.id });
  assert.equal(boat.rider, a.pid, 'sailing it works as anywhere');
  room.receive(a, { t: 'critter', op: 'off' });

  // But nothing is brought to it, animal or vehicle: its toy box stays shut.
  const before = room.critters.list.length;
  room.receive(a, { t: 'critter', op: 'invite', type: 'bunny', x: w.spawn.x + 3, y: w.spawn.y, z: w.spawn.z });
  room.receive(a, { t: 'critter', op: 'invite', type: 'helicopter', x: w.spawn.x + 3, y: w.spawn.y, z: w.spawn.z });
  assert.equal(room.critters.list.length, before, 'nothing came');
  assert.equal(a.last('notice').text, 'Adventure Isle stays just as it was made, so its toy box stays shut!');

  // Nor is anything sent away: what is on it is everyone's.
  const stays = room.critters.list.find((c) => !c.rider && !CRITTER_INFO[c.type].vehicle);
  room.receive(a, { t: 'critter', op: 'bye', id: stays.id });
  assert.ok(room.critters.get(stays.id), 'it stays');
  assert.equal(a.last('notice').text, 'Adventure Isle is everyone’s, so its animals and vehicles stay.');

  // Building: the island stays as it was made, whoever tries whatever tool.
  const x = Math.floor(w.spawn.x) + 3;
  const z = Math.floor(w.spawn.z);
  const y = w.top(x, z) + 1;
  for (const kind of EDIT_KINDS) {
    room.receive(a, { t: 'edit', seq: 7, kind, cells: [x, y, z, kind === 'pick' || kind === 'undo' ? B.AIR : B.STONE] });
    assert.equal(w.get(x, y, z), B.AIR, `${kind} changes nothing`);
  }
  assert.equal(a.last('notice').text, 'Adventure Isle stays just as it is — no building here!');
  assert.deepEqual(a.last('ack'), { t: 'ack', seq: 7, fix: [x, y, z, B.AIR] });
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
