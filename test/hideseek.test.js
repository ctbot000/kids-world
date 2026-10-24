// Hide and seek: the seeker counts while everyone else hides, then finds
// them by coming close with nothing solid in between, and the round ends
// when all are found or the time is up — with everything the host checks:
// who may start and stop it, newcomers, players leaving, and that it is
// never saved.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { canSee, cleanRound, DONE_MS, FIND_REACH, finds, HIDE_MS, HideSeekSim, SEEK_MS } from '../public/js/shared/hideseek.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { World } from '../public/js/shared/world.js';

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

function play(room, time, ms) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
}

// A flat floor of grass at y 10.
function flat() {
  const w = new World({ W: 32, H: 24, D: 32, sea: 2, theme: 'flat', spawn: { x: 16.5, y: 11, z: 16.5 } });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) w.set(x, 10, z, B.GRASS);
  return w;
}

test('a hider is found close by, never through a wall, but through glass', () => {
  const w = flat();
  const seeker = { x: 10.5, y: 11, z: 10.5 };
  assert.ok(finds(w, seeker, { x: 12.5, y: 11, z: 10.5 }), 'two blocks off, in the open');
  assert.ok(!finds(w, seeker, { x: 10.5 + FIND_REACH + 0.2, y: 11, z: 10.5 }), 'too far');
  assert.ok(!finds(w, seeker, { x: 11.5, y: 14, z: 10.5 }), 'a storey up');
  // A wall two high between them.
  w.set(11, 11, 10, B.WOOD);
  w.set(11, 12, 10, B.WOOD);
  assert.ok(!canSee(w, seeker, { x: 12.5, y: 11, z: 10.5 }), 'behind a wall');
  assert.ok(!finds(w, seeker, { x: 12.5, y: 11, z: 10.5 }));
  // Window glass hides nobody.
  w.set(11, 11, 10, B.GLASS);
  w.set(11, 12, 10, B.GLASS);
  assert.ok(finds(w, seeker, { x: 12.5, y: 11, z: 10.5 }), 'behind glass');
  // Crouched behind a low wall, your head still shows.
  w.set(11, 12, 10, B.AIR);
  w.set(11, 11, 10, B.WOOD);
  assert.ok(canSee(w, seeker, { x: 12.5, y: 11, z: 10.5 }), 'over a low wall');
});

test('a round: counting, seeking, found one by one, and over', () => {
  const w = flat();
  const sim = new HideSeekSim();
  assert.equal(sim.start(1, [1], 0).why, 'alone', 'nobody to find');
  assert.ok(sim.start(1, [1, 2, 3], 0).ok);
  assert.equal(sim.start(2, [1, 2, 3], 0).why, 'busy');
  assert.ok(sim.isSeeker(1) && sim.hiding(2) && sim.hiding(3) && !sim.hiding(1));
  const where = new Map([
    [1, { x: 5.5, y: 11, z: 5.5 }],
    [2, { x: 6.5, y: 11, z: 5.5 }],
    [3, { x: 25.5, y: 11, z: 25.5 }],
  ]);
  // Nobody is found while the seeker counts, however near.
  assert.deepEqual(sim.step(w, HIDE_MS - 1, where), []);
  assert.equal(sim.pack(HIDE_MS - 1).phase, 'hide');
  assert.equal(sim.pack(0).left, HIDE_MS);
  const fx = sim.step(w, HIDE_MS, where);
  assert.deepEqual(fx, [{ f: 'seek' }, { f: 'found', pid: 2, by: 1 }]);
  assert.ok(!sim.hiding(2) && sim.hiding(3));
  assert.deepEqual(sim.pack(HIDE_MS).found, [2]);
  // The last one found: the round is over, the seeker winning.
  where.set(1, { x: 24.5, y: 11, z: 25.5 });
  const end = sim.step(w, HIDE_MS + 5000, where);
  assert.deepEqual(end, [{ f: 'found', pid: 3, by: 1 }, { f: 'end', seeker: 1, found: [2, 3], hidden: [] }]);
  assert.ok(!sim.playing && sim.pack(HIDE_MS + 5000).phase === 'done');
  // After a while the round's end is cleared away.
  assert.deepEqual(sim.step(w, HIDE_MS + 5000 + DONE_MS, where), [{ f: 'over' }]);
  assert.equal(sim.pack(0), null);
});

test('time up: whoever is still hidden wins', () => {
  const w = flat();
  const sim = new HideSeekSim();
  sim.start(1, [1, 2], 0);
  const where = new Map([
    [1, { x: 5.5, y: 11, z: 5.5 }],
    [2, { x: 25.5, y: 11, z: 25.5 }],
  ]);
  sim.step(w, HIDE_MS, where);
  assert.deepEqual(sim.step(w, HIDE_MS + SEEK_MS, where), [{ f: 'end', seeker: 1, found: [], hidden: [2] }]);
});

test('players leaving: a hider is out, the seeker gone ends it', () => {
  const sim = new HideSeekSim();
  sim.start(1, [1, 2, 3], 0);
  assert.deepEqual(sim.left(2, 10), [{ f: 'gone', pid: 2 }]);
  assert.deepEqual(sim.pack(10).hiders, [3]);
  assert.deepEqual(sim.left(9, 10), [], 'somebody not playing');
  assert.deepEqual(sim.left(1, 20), [{ f: 'end', seeker: 1, found: [], hidden: [3], why: 'seeker' }]);
  sim.round = null;
  sim.start(1, [1, 2], 0);
  assert.deepEqual(sim.left(2, 10), [{ f: 'end', seeker: 1, found: [], hidden: [], why: 'hiders' }]);
});

test('a round as told is checked', () => {
  assert.equal(cleanRound(null), null);
  assert.equal(cleanRound({ phase: 'nap', seeker: 1 }), null);
  assert.deepEqual(cleanRound({ phase: 'seek', seeker: 1, hiders: [2, 'x', 3], found: [3], left: -5 }), { phase: 'seek', seeker: 1, hiders: [2, 3], found: [3], left: 0 });
});

test('the island runs a round and tells everyone as it goes', () => {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', size: 'small', seed: 21, now: time.now });
  const a = join(room, 'A');
  const b = join(room, 'B');
  const stand = (c, x, z) => {
    const y = room.world.top(Math.floor(x), Math.floor(z)) + 1;
    room.receive(c, { t: 'm', s: [x, y, z, 0, 0, 0] });
  };
  const s = room.world.spawn;
  stand(a, s.x, s.z);
  stand(b, s.x + 1.5, s.z);
  room.receive(a, { t: 'hideseek', op: 'start' });
  for (const c of [a, b]) {
    assert.deepEqual(c.last('hsfx'), { t: 'hsfx', f: 'start', seeker: a.pid });
    assert.equal(c.last('hs').s.phase, 'hide');
    assert.deepEqual(c.last('hs').s.hiders, [b.pid]);
  }
  // A second start is turned away, and a newcomer watches.
  room.receive(b, { t: 'hideseek', op: 'start' });
  assert.match(b.last('notice').text, /going already/);
  const c = join(room, 'C');
  assert.equal(c.last('welcome').hideseek.phase, 'hide', 'a newcomer sees the round');
  assert.deepEqual(c.last('welcome').hideseek.hiders, [b.pid], 'but is not in it');
  // The count over: B, right by A, is found.
  play(room, time, HIDE_MS + 200);
  assert.ok(a.all('hsfx').some((m) => m.f === 'seek'));
  assert.ok(a.all('hsfx').some((m) => m.f === 'found' && m.pid === b.pid && m.by === a.pid));
  const end = a.last('hsfx');
  assert.equal(end.f, 'end');
  assert.deepEqual(end.hidden, []);
  assert.equal(a.last('hs').s.phase, 'done');
  // The 'hs' goes out as the round changes, not every tick.
  assert.ok(a.all('hs').length <= 4, `${a.all('hs').length} sent`);
  play(room, time, DONE_MS + 200);
  assert.equal(a.last('hs').s, null, 'cleared away');
  // Never saved.
  assert.equal(JSON.stringify(room.exportSave()).includes('hideseek'), false);
});

test('the seeker or the owner stops a round; nobody else does', () => {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', size: 'small', seed: 21, now: time.now });
  const owner = join(room, 'Owner');
  const b = join(room, 'B');
  const c = join(room, 'C');
  room.receive(b, { t: 'hideseek', op: 'start' });
  room.receive(c, { t: 'hideseek', op: 'stop' });
  assert.equal(room.hideseek.playing, true, 'a hider cannot stop it');
  room.receive(owner, { t: 'hideseek', op: 'stop' });
  assert.equal(room.hideseek.playing, false);
  assert.equal(owner.last('hsfx').why, 'stopped');
  play(room, time, DONE_MS + 200);
  // The seeker leaving the island ends a round too.
  room.receive(b, { t: 'hideseek', op: 'start' });
  room.detach(b);
  assert.equal(owner.last('hsfx').why, 'seeker');
  // Alone, there is nobody to find.
  play(room, time, DONE_MS + 200);
  room.detach(c);
  room.receive(owner, { t: 'hideseek', op: 'start' });
  assert.match(owner.last('notice').text, /needs a friend/);
});

test('hide and seek stickers and XP', () => {
  for (const key of ['hideseek', 'hidden', 'seekfound']) {
    assert.ok(STAT_KEYS.includes(key), `${key} is counted`);
    assert.ok(XP_FOR[key], `${key} earns XP`);
  }
  const byKey = (key) => STICKERS.find((s) => s.key === key);
  assert.ok(byKey('hide-and-seek').test({ hideseek: 1 }));
  assert.ok(!byKey('super-hider').test({ hidden: 0 }) && byKey('super-hider').test({ hidden: 1 }));
  assert.ok(!byKey('sharp-eyes').test({ seekfound: 9 }) && byKey('sharp-eyes').test({ seekfound: 10 }));
});
