// Monsters, an island rule: off unless the owner turns them on; coming out
// round the players, more at night; chasing whoever is near, bumping them
// back and taking a heart (and sending them home with them all again when
// none are left); hearts coming back; popping when tapped or jumped on;
// never in the water or the safe place round the start; and all gone when
// turned off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { ARM_REACH, BLOB_HEARTS, BOP_SLACK, bopGap, HEART_BACK_MS, heartsBack, HIT_MS, MAX_HEARTS, MAX_MONSTERS, MONSTER_BODY, MonsterSim, SAFE_RADIUS, unpackMonster } from '../public/js/shared/monsters.js';
import { BODY } from '../public/js/shared/physics.js';
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

test('jumping on a monster pops it at once; bopping it takes three bops, from right up close, and it knocks it back and makes it cross', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  room.monsters.spawnAt = Infinity;
  const spawn = room.world.spawn;
  const tap = (m, on = false) => {
    time.t += HIT_MS;
    room.receive(a, on ? { t: 'bop', id: m.id, on: true } : { t: 'bop', id: m.id });
  };
  // Landing on one: pop, but only with your feet over it.
  const m = room.monsters.add(room.world, spawn.x + 30, 11, spawn.z);
  room.receive(a, { t: 'm', s: [spawn.x + 30.2, 11.1, spawn.z, 0, 0, 0] });
  tap(m, true);
  assert.ok(room.monsters.get(m.id), 'beside it, not on it');
  room.receive(a, { t: 'm', s: [spawn.x + 30.2, 11.6, spawn.z, 0, 0, 0] });
  tap(m, true);
  assert.equal(room.monsters.get(m.id), null, 'landed on');
  assert.equal(b.last('pop').id, m.id);
  assert.equal(b.last('pop').by, 1);
  // Far off, nothing; from close up, a heart off it each tap, never two in a moment.
  const n = room.monsters.add(room.world, spawn.x + 30, 11, spawn.z);
  room.receive(a, { t: 'm', s: [spawn.x + 20, 11, spawn.z, 0, 0, 0] });
  tap(n);
  assert.equal(n.hearts, BLOB_HEARTS, 'too far');
  room.receive(a, { t: 'm', s: [spawn.x + 28, 11, spawn.z, 0, 0, 0] });
  tap(n);
  room.receive(a, { t: 'bop', id: n.id });
  assert.equal(n.hearts, BLOB_HEARTS - 1);
  assert.deepEqual(b.last('mhit'), { t: 'mhit', id: n.id, by: 1, hearts: BLOB_HEARTS - 1 });
  // Knocked back, away from you, and after you now.
  assert.ok(n.body.vx > 5, `pushed ${n.body.vx}`);
  assert.equal(n.target, 1);
  // Left alone a while, all its hearts are back.
  standFor(room, time, a, spawn.x + 20, spawn.z, 6000);
  const left = room.monsters.get(n.id);
  assert.ok(left);
  assert.equal(left.hearts, BLOB_HEARTS);
  // Tapped over and over: pop with the last heart.
  Object.assign(left.body, { x: spawn.x + 30, y: 11, z: spawn.z, vx: 0, vy: 0, vz: 0 });
  room.receive(a, { t: 'm', s: [spawn.x + 28, 11, spawn.z, 0, 0, 0] });
  for (let i = 0; i < BLOB_HEARTS; i++) {
    Object.assign(left.body, { x: spawn.x + 30, y: 11, z: spawn.z });
    tap(left);
  }
  assert.equal(room.monsters.get(n.id), null, 'popped');
  assert.equal(b.last('pop').id, n.id);
  // A bop from as far as an arm reaches on the page counts, even with the
  // monster a step further on at the island; a step past that does not.
  const side = ARM_REACH + MONSTER_BODY.radius + 0.3;
  const far = room.monsters.add(room.world, spawn.x + 20 + side + 1, 11, spawn.z);
  room.receive(a, { t: 'm', s: [spawn.x + 20, 11, spawn.z, 0, 0, 0] });
  tap(far);
  assert.equal(far.hearts, BLOB_HEARTS - 1, 'bopped from as far as an arm reaches');
  Object.assign(far.body, { x: spawn.x + 20 + side + BOP_SLACK + 0.2, vx: 0, vz: 0 });
  tap(far);
  assert.equal(far.hearts, BLOB_HEARTS - 1, 'out of reach');
  room.monsters.remove(far.id);
  // Only about level with you: not one up on a ledge over your head.
  assert.equal(bopGap({ x: 0, y: 10, z: 0 }, { x: 1, y: 12.2, z: 0, radius: 0.42, height: 0.8 }, 5), null);
  assert.ok(bopGap({ x: 0, y: 10, z: 0 }, { x: 1, y: 10, z: 0, radius: 0.42, height: 0.8 }, 5) < 0.3);
  // With monsters off, nothing to pop.
  const o = room.monsters.add(room.world, spawn.x + 28, 11, spawn.z);
  room.settings.monsters = false;
  room.receive(a, { t: 'm', s: [spawn.x + 28.2, 11.6, spawn.z, 0, 0, 0] });
  tap(o, true);
  assert.ok(room.monsters.get(o.id));
});

test('a monster tapped comes straight back at you, quicker than you walk, but never catches you running', () => {
  const sim = new MonsterSim(5);
  const w = meadow(128);
  // You at x 40, tapping one two steps behind you (west), then walking or
  // running east, or standing still.
  const chase = (speed, cross = true) => {
    sim.clear();
    const m = sim.add(w, 38.5, 11, 64.5);
    let now = 1000;
    const p = { id: 1, x: 40.5, y: 11, z: 64.5 };
    if (cross) sim.hit(m, 1, p, now);
    else m.target = 1;
    for (let t = 0; t < 5000; t += 50) {
      now += 50;
      p.x += speed * 0.05;
      if (sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] }).length) return t;
    }
    return null;
  };
  const back = chase(0);
  assert.ok(back !== null && back < 1500, `back and bumping you in ${back} ms`);
  assert.ok(chase(4.6) !== null, 'caught walking');
  assert.equal(chase(4.6, false), null, 'one not tapped never catches you walking');
  assert.equal(chase(7), null, 'never caught running');
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
