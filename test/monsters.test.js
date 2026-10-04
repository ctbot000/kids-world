// Monsters, an island rule: off unless the owner turns them on; coming out
// round the players, more at night; chasing whoever is near, bumping them
// back and taking a heart (and sending them home with them all again when
// none are left); hearts coming back; popping when tapped or jumped on;
// never in the water or the safe place round the start; and all gone when
// turned off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { HEART_BACK_MS, heartsBack, MAX_HEARTS, MAX_MONSTERS, MonsterSim, SAFE_RADIUS, unpackMonster } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
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

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

// A flat meadow: grass at y 10 everywhere, with the start in the middle.
function meadow(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

// Steps the room with a player standing at (x, z), for ms.
function standFor(room, time, c, x, z, ms, y = room.world.top(Math.floor(x), Math.floor(z)) + 1) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [x, y, z, 0, 0, 0] });
    room.tick();
  }
}

function meadowRoom(settings = { monsters: true }) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, settings });
  room.world = meadow();
  room.hookWorld();
  return { room, time };
}

test('monsters are off unless the owner turns them on, and only the owner can', () => {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', seed: 42, now: time.now });
  assert.equal(room.settings.monsters, false);
  const a = join(room);
  const b = join(room, 'Brave Otter');
  assert.equal(a.last('welcome').settings.monsters, false);
  assert.deepEqual(a.last('welcome').monsters, []);
  assert.equal(a.last('welcome').hearts, MAX_HEARTS);
  standFor(room, time, a, room.world.spawn.x + 20, room.world.spawn.z, 20000);
  assert.equal(room.monsters.list.length, 0, 'none come out');
  room.receive(b, { t: 'host', cmd: 'settings', settings: { monsters: true } });
  assert.equal(room.settings.monsters, false, 'a visitor cannot');
  room.receive(a, { t: 'host', cmd: 'settings', settings: { monsters: true } });
  assert.equal(b.last('settings').settings.monsters, true);
  // Made with them on, and kept when saved.
  const made = new Room({ code: '654321', theme: 'sunny', seed: 42, now: time.now, settings: { monsters: true } });
  assert.equal(made.settings.monsters, true);
  assert.equal(new Room({ save: made.exportSave(), now: time.now }).settings.monsters, true);
  assert.equal(made.exportSave().monsters, undefined, 'the monsters themselves are never saved');
});

test('monsters come out round the players, away from them and the start, more at night', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  room.env.time = 0.3;
  // A player far from the start, so monsters have room round them.
  const x = spawn.x + 30;
  standFor(room, time, a, x, spawn.z, 1000);
  assert.ok(room.monsters.list.length >= 1, 'one comes out');
  for (const m of room.monsters.list) {
    assert.ok(Math.hypot(m.body.x - x, m.body.z - spawn.z) >= 12, 'out of reach at first');
    assert.ok(Math.hypot(m.body.x - spawn.x, m.body.z - spawn.z) >= SAFE_RADIUS, 'never at the start');
  }
  // By day, two for each player.
  assert.equal(room.monsters.wanted(1, false), 2);
  assert.equal(room.monsters.wanted(1, true), 4, 'more at night');
  assert.equal(room.monsters.wanted(8, true), MAX_MONSTERS);
  assert.ok(a.last('mon').m.length >= 1, 'everyone sees them');
  assert.ok(unpackMonster(a.last('mon').m[0]), 'in the compact form');
});

test('a monster chases you, bumps you back for a heart, and with none left sends you home with them all', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const z = spawn.z;
  room.monsters.spawnAt = Infinity;
  const m = room.monsters.add(room.world, x + 6, 11, z);
  standFor(room, time, a, x, z, 6000, 11);
  const bumps = a.all('bump');
  assert.ok(bumps.length >= 1, 'it caught up');
  assert.equal(bumps[0].id, m.id);
  assert.equal(bumps[0].hearts, MAX_HEARTS - 1);
  // Standing still, bumped again and again: never sooner than the safe moment
  // after each, and home with every heart at the last.
  for (let t = 0; t < 20000 && !a.last('bump').home; t += 100) standFor(room, time, a, x, z, 100, 11);
  const all = a.all('bump');
  const home = all.at(-1);
  assert.ok(home.home, 'out of hearts');
  assert.equal(all.length, MAX_HEARTS);
  assert.equal(home.hearts, MAX_HEARTS);
  for (let i = 1; i < all.length; i++) assert.ok(all[i].hearts === all[i - 1].hearts - 1 || all[i].home);
  const p = room.players.get(1);
  assert.deepEqual(p.s.slice(0, 3), [spawn.x, spawn.y, spawn.z], 'back at the start');
});

test('hearts come back while nothing bumps you', () => {
  assert.equal(heartsBack(2, HEART_BACK_MS - 1), 2);
  assert.equal(heartsBack(2, HEART_BACK_MS), 3);
  assert.equal(heartsBack(MAX_HEARTS, HEART_BACK_MS * 10), MAX_HEARTS);
  const { room, time } = meadowRoom();
  const a = join(room);
  room.monsters.spawnAt = Infinity;
  room.players.get(1).hearts = 2;
  room.players.get(1).bumpAt = time.t;
  standFor(room, time, a, room.world.spawn.x, room.world.spawn.z, HEART_BACK_MS * 3 + 500);
  assert.deepEqual(a.all('hearts').map((m) => m.hearts), [3, 4, 5]);
});

test('jumping on a monster or tapping it pops it, but only from near enough', () => {
  const { room } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  room.monsters.spawnAt = Infinity;
  const spawn = room.world.spawn;
  const m = room.monsters.add(room.world, spawn.x + 30, 11, spawn.z);
  room.receive(a, { t: 'm', s: [spawn.x, 11, spawn.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: m.id });
  assert.ok(room.monsters.get(m.id), 'too far');
  room.receive(a, { t: 'm', s: [spawn.x + 27, 11, spawn.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: m.id });
  assert.equal(room.monsters.get(m.id), null, 'popped');
  assert.equal(b.last('pop').id, m.id);
  assert.equal(b.last('pop').by, 1);
  // With monsters off, nothing to pop.
  const n = room.monsters.add(room.world, spawn.x + 28, 11, spawn.z);
  room.settings.monsters = false;
  room.receive(a, { t: 'bop', id: n.id });
  assert.ok(room.monsters.get(n.id));
});

test('monsters never go into the water or the safe place round the start', () => {
  const sim = new MonsterSim(3);
  const w = meadow(64);
  // A pond to the east.
  for (let x = 44; x < 56; x++) for (let z = 20; z < 44; z++) w.set(x, 10, z, B.WATER);
  const spawn = w.spawn;
  let now = 0;
  sim.spawnAt = Infinity;
  const m = sim.add(w, 40.5, 11, 32.5);
  const s = sim.add(w, spawn.x - 14, 11, spawn.z);
  // Someone across the pond, and someone in the middle of the safe place.
  const people = [
    { id: 1, x: 58, y: 11, z: 32 },
    { id: 2, x: spawn.x, y: 11, z: spawn.z },
  ];
  for (let i = 0; i < 1200; i++) {
    now += 50;
    sim.step(w, 0.05, now, people, false);
    if (sim.get(m.id)) assert.ok(m.body.x < 44, 'stays out of the pond');
    if (sim.get(s.id)) assert.ok(Math.hypot(s.body.x - spawn.x, s.body.z - spawn.z) > SAFE_RADIUS - 1, 'keeps out of the start');
  }
});

test('a monster goes round the safe place, and round a wall, to get at you', () => {
  const w = meadow(64);
  const spawn = w.spawn;
  // A wall two blocks high between it and you, with a way round at either end.
  for (let z = spawn.z - 4; z < spawn.z + 4; z++) for (let y = 11; y <= 12; y++) w.set(Math.floor(spawn.x) + 15, y, Math.floor(z), B.STONE);
  for (const [from, you] of [
    [{ x: spawn.x - SAFE_RADIUS - 2, z: spawn.z }, { x: spawn.x + SAFE_RADIUS + 1, z: spawn.z }],
    [{ x: spawn.x + 12, z: spawn.z }, { x: spawn.x + 19, z: spawn.z }],
  ]) {
    const sim = new MonsterSim(11);
    sim.spawnAt = Infinity;
    sim.add(w, from.x, 11, from.z);
    let now = 0;
    let bumped = false;
    for (let i = 0; i < 1200 && !bumped; i++) {
      now += 50;
      bumped = sim.step(w, 0.05, now, [{ id: 1, x: you.x, y: 11, z: you.z }], false).length > 0;
    }
    assert.ok(bumped, `from ${from.x - spawn.x} to ${you.x - spawn.x}`);
  }
});

test('turning monsters off sends every one away and gives everyone all their hearts', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  room.monsters.spawnAt = Infinity;
  room.monsters.add(room.world, room.world.spawn.x + 20, 11, room.world.spawn.z);
  room.players.get(1).hearts = 1;
  standFor(room, time, a, room.world.spawn.x, room.world.spawn.z, 300);
  room.receive(a, { t: 'host', cmd: 'settings', settings: { monsters: false } });
  assert.equal(room.monsters.list.length, 0);
  assert.equal(a.last('hearts').hearts, MAX_HEARTS);
  standFor(room, time, a, room.world.spawn.x, room.world.spawn.z, 500);
  assert.deepEqual(a.last('mon').m, [], 'everyone hears they are gone');
});

test('someone riding a big animal is never bumped', () => {
  const sim = new MonsterSim(5);
  const w = meadow(64);
  sim.spawnAt = Infinity;
  sim.add(w, 20.5, 11, 20.5);
  let now = 0;
  const rider = { id: 1, x: 22, y: 11, z: 20.5, riding: true };
  for (let i = 0; i < 400; i++) {
    now += 50;
    assert.deepEqual(sim.step(w, 0.05, now, [rider], false), []);
  }
});
