// Mr. Mole as a monster: he travels under the ground as a mound of dirt
// gliding along, quicker than you walk and never as quick as you run, and
// pops up beside whoever he is after with a burst of dirt to bump them, as a
// blob does. Under the ground nobody can bop him and nobody can jump on
// him; up top, three bops or one landing sees him off. He keeps every rule
// the others keep: out of the water and the tents and the safe start, and
// never saved with the island.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BUMP_HP, HIT_MS, KINDS, maxHp, MAX_MONSTERS, MONSTER_KINDS, MONSTER_STATES, MOLE_BODY, MOLE_DIG, MonsterSim, SAFE_RADIUS, unpackMonster } from '../public/js/shared/monsters.js';
import { MoleModel } from '../public/js/render/mole-model.js';
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

// A flat meadow: grass at y 10 everywhere (standing at 11), with the start
// in the middle.
function meadow(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

function meadowRoom(settings = { monsters: true }) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, settings });
  room.world = meadow();
  room.hookWorld();
  return { room, time };
}

// Steps the monsters on by ms, a tenth of a second at a time, gathering
// the bumps.
function step(sim, world, ms, people, night = false, at = 0) {
  const bumps = [];
  for (let t = 0; t < ms; t += 100) bumps.push(...sim.step(world, 0.1, at + t + 100, people, night, { roam: false, havens: [] }));
  return bumps;
}

test('Mr. Mole is a monster, on the end of the kinds', () => {
  assert.equal(MONSTER_KINDS.indexOf('mole'), 8, 'new kinds go on the end: the wire sends the index');
  assert.deepEqual(MONSTER_KINDS.slice(0, 8), ['blob', 'king', 'big', 'spiky', 'mosquito', 'spider', 'knight', 'golem'], 'the kinds before him keep their places');
  assert.ok(MONSTER_STATES.includes('dig'), 'burrowing is a state of its own');
  const sim = new MonsterSim(1);
  const w = meadow();
  const m = sim.add(w, 20.5, 11, 20.5, { kind: 'mole' });
  assert.ok(m, 'one comes out');
  assert.equal(m.under, true, 'he comes out under the ground');
  assert.equal(m.body.flying, false);
  assert.equal(m.body.radius, MOLE_BODY.radius);
  assert.equal(m.body.height, MOLE_BODY.height);
  assert.equal(m.hearts, KINDS.mole.hearts);
  const back = unpackMonster(sim.pack()[0]);
  assert.equal(back.kind, 'mole');
  assert.deepEqual([back.hearts, back.max], [KINDS.mole.hearts, KINDS.mole.hearts]);
});

test('his mound glides along under the ground, then he pops up beside you and bumps', () => {
  const sim = new MonsterSim(5);
  const w = meadow(128);
  sim.clear();
  const m = sim.add(w, 40.5, 11, 64.5, { kind: 'mole' });
  m.target = 1;
  let now = 1000;
  const p = { id: 1, x: 40.5, y: 11, z: 68.5, safeUntil: 0, dizzy: false, riding: false };
  let popped = null;
  let bumped = false;
  for (let t = 0; t < 20000 && !bumped; t += 100) {
    now += 100;
    const bumps = sim.step(w, 0.1, now, [p], false, { roam: false, havens: [] });
    if (!m.under && popped === null) popped = now;
    bumped = bumps.length > 0;
  }
  assert.ok(popped !== null, 'he came up out of the ground');
  assert.ok(sim.takeUps().length > 0, 'his popping up is told of');
  assert.ok(bumped, 'he bumped whoever he came up beside');
});

test('his mound glides quicker than you walk: it catches you walking, never you running', () => {
  const sim = new MonsterSim(5);
  const w = meadow(128);
  const chase = (speed) => {
    sim.clear();
    const m = sim.add(w, 38.5, 11, 64.5, { kind: 'mole' });
    let now = 1000;
    const p = { id: 1, x: 40.5, y: 11, z: 64.5, safeUntil: 0, dizzy: false, riding: false };
    m.target = 1;
    for (let t = 0; t < 8000; t += 50) {
      now += 50;
      p.x += speed * 0.05;
      if (sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] }).length) return t;
    }
    return null;
  };
  assert.ok(chase(4.6) !== null, 'his mound catches you walking');
  assert.equal(chase(7), null, 'never caught running');
});

test('nobody bops him and nobody jumps on him while he is under the ground', () => {
  const sim = new MonsterSim(3);
  const w = meadow();
  const m = sim.add(w, 20.5, 11, 20.5, { kind: 'mole' });
  assert.equal(m.under, true);
  // Right up against him, arm and all: nothing to bop.
  const p = { id: 1, x: m.body.x + 0.4, y: 11, z: m.body.z };
  assert.equal(sim.canBop(m.id, p, 0), null, 'no bopping a mound of dirt');
  assert.equal(sim.landsOn(m.id, { x: m.body.x, y: m.body.y + 1, z: m.body.z }), null, 'no jumping on a mound of dirt');
  // Up out of the ground, both work as for any monster.
  m.under = false;
  assert.equal(sim.canBop(m.id, p, 0), m, 'up top, a bop finds him');
  assert.equal(sim.landsOn(m.id, { x: m.body.x, y: m.body.y + 1, z: m.body.z }), m, 'and so does a jump');
});

test('three bops or one landing sees him off once he is up', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  room.monsters.spawnAt = Infinity;
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const m = room.monsters.add(room.world, x, 11, spawn.z, { kind: 'mole' });
  // Up out of the ground, standing still (so he stays up for his moment).
  m.under = false;
  m.up = time.now() + 60_000;
  room.monsters.list[0].target = 0;
  const b = m.body;
  // A landing pops him at once.
  room.receive(a, { t: 'm', s: [b.x + 0.1, b.y + 1.5, b.z, 0, 0, 0] });
  const before = room.monsters.list.length;
  room.receive(a, { t: 'bop', id: m.id, on: true });
  assert.equal(room.monsters.list.length, before - 1, 'one landing pops him');
  assert.ok(a.last('pop'));
  // Without that, three bops do.
  const n = room.monsters.add(room.world, x, 11, spawn.z, { kind: 'mole' });
  n.under = false;
  n.up = time.now() + 60_000;
  let bops = 0;
  while (room.monsters.get(n.id) && bops < 10) {
    time.t += HIT_MS;
    const nb = n.body;
    room.receive(a, { t: 'm', s: [nb.x - 1.2, nb.y, nb.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: n.id });
    bops++;
  }
  assert.equal(bops, KINDS.mole.hearts);
});

test('a bump from him takes 20 HP, as a blob’s does', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  room.monsters.spawnAt = Infinity;
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const m = room.monsters.add(room.world, x, 11, spawn.z, { kind: 'mole' });
  m.under = false;
  m.up = time.now() + 60_000;
  m.target = 1;
  for (let t = 0; t < 10000 && !a.last('bump'); t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [x, 11, spawn.z, 0, 0, 0] });
    room.tick();
  }
  const bump = a.last('bump');
  assert.ok(bump, 'he bumped whoever stood there');
  assert.equal(bump.hp, maxHp(1) - BUMP_HP);
});

test('he keeps out of the water and the safe start', () => {
  const sim = new MonsterSim(11);
  const w = meadow(128);
  const spawn = w.spawn;
  // The start is a safe place, and a lake to the east.
  for (let x = 60; x < 76; x++) for (let z = 60; z < 76; z++) w.set(x, 10, z, B.WATER);
  const p = { id: 1, x: spawn.x + 40, y: 11, z: spawn.z + 20, safeUntil: 0, dizzy: false, riding: false };
  const m = sim.add(w, p.x + 12, 11, p.z, { kind: 'mole' });
  m.target = 1;
  for (let t = 0; t < 12000; t += 100) {
    const d = Math.hypot(m.body.x - spawn.x, m.body.z - spawn.z);
    assert.ok(d > SAFE_RADIUS - 1, `never into the safe start (at ${d})`);
    assert.ok(m.body.inWater === false, 'never into the water');
    sim.step(w, 0.1, t + 100, [p], false, { roam: false, havens: [{ x: spawn.x, z: spawn.z, r: SAFE_RADIUS }] });
  }
});

test('turning monsters on brings him out among the blobs, and never more than the island holds', () => {
  const sim = new MonsterSim(9);
  const tally = (night) => {
    const n = {};
    for (let i = 0; i < 4000; i++) {
      const k = sim.pickKind(night);
      n[k] = (n[k] ?? 0) + 1;
    }
    return n;
  };
  const day = tally(false);
  const night = tally(true);
  assert.ok(day.mole > 200, `moles by day: ${day.mole}`);
  assert.ok(night.mole > day.mole, 'more of them at night');
  assert.ok(sim.wanted(1, false) === 2 && sim.wanted(1, true) === 4, 'two per player by day, four at night');
});

test('the model shows a mound while he is under and him above it when he is up', () => {
  const m = new MoleModel('sunny', 3);
  assert.ok(m.group);
  assert.ok(m.mound, 'a mound of dirt shows where he is');
  assert.ok(m.mole, 'and him, once he is up');
  // Under: the mound whole, him away under the ground.
  m.update(0.016, 'dig', 0, false);
  assert.ok(m.mole.visible === false, 'he is under');
  assert.ok(m.mound.scale.y > 0.5, 'the mound is up');
  // A few steps after he pops up: him out of it, the mound flat.
  for (let i = 0; i < 30; i++) m.update(0.016, 'hop', 0, false);
  assert.ok(m.mole.visible === true, 'he is up');
  assert.ok(m.mound.scale.y < 0.3, 'the mound has flattened');
  // And back under again.
  for (let i = 0; i < 30; i++) m.update(0.016, 'dig', 0, false);
  assert.equal(m.mole.visible, false, 'under again');
  assert.ok(m.mound.scale.y > 0.5, 'the mound is back');
});

test('an island opened again starts without him, like any monster', () => {
  const { room } = meadowRoom();
  room.monsters.add(room.world, 30.5, 11, 30.5, { kind: 'mole' });
  assert.equal(room.monsters.list.length, 1);
  // A new room over the same island (as opening it again): none saved.
  const { room: again } = meadowRoom();
  assert.equal(again.monsters.list.length, 0);
});

// Keeps the imports honest (the wire and the bodies).
test('his constants hang together', () => {
  assert.ok(MOLE_DIG.run > 4.6 && MOLE_DIG.run < 7, 'quicker than a walk, slower than a run');
  assert.ok(MOLE_DIG.pop > 1 && MOLE_DIG.pop < 4);
  assert.ok(KINDS.mole.hearts === 3 && KINDS.mole.bump === 1);
  assert.ok(MAX_MONSTERS >= 4);
});
