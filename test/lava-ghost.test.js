// Lava Ghosts: a monster of volcano islands only. It floats after you over
// the ground and the lava lakes alike, never into the water, and every few
// seconds rears back and breathes a jet of fire the way it faces, burning
// 30 HP off whoever is in it (15 in Knight Armor or a Fire Suit). It bumps
// nobody, nobody can land on it, and three bops pop it. Everyone hears of
// each breath, so friends all see its flames.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BUMP_HP, GHOST_FIRE, GHOST_HOVER, KINDS, maxHp, MONSTER_KINDS, MONSTER_STATES, MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

const FL = Math.floor;

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

function join(room, name = 'Happy Panda', outfit = undefined) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', outfit } });
  return c;
}

// A flat meadow: grass at y 10 everywhere (standing at 11), with the start
// in the middle.
function meadow(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'volcano', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

function meadowRoom() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, settings: { monsters: true } });
  room.world = meadow();
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  return { room, time };
}

const onFoot = (id, x, z, y = 11) => ({ id, x, y, z, flying: false, riding: false, dizzy: false, safeUntil: 0 });

test('a Lava Ghost goes on the end of the kinds, and comes out on volcano islands only', () => {
  assert.equal(MONSTER_KINDS.at(-1), 'ghost', 'new kinds go on the end: the wire sends the index');
  assert.equal(MONSTER_STATES.at(-1), 'breathe');
  assert.deepEqual([KINDS.ghost.hearts, KINDS.ghost.bump, KINDS.ghost.land], [3, 0, 0]);
  const kinds = (theme) => {
    const sim = new MonsterSim(9);
    return new Set(Array.from({ length: 400 }, (_, i) => sim.pickKind(i % 2 === 0, theme)));
  };
  assert.ok(kinds('volcano').has('ghost'));
  for (const theme of ['sunny', 'snowy', 'candy', 'flat', null]) assert.ok(!kinds(theme).has('ghost'), theme);
});

test('it floats over a lava lake after you, but never into the water', () => {
  const across = (liquid) => {
    const w = meadow();
    for (let x = 0; x < w.W; x++) for (let z = 30; z <= 34; z++) w.set(x, 10, z, liquid);
    const sim = new MonsterSim(5);
    const m = sim.add(w, 20.5, 11, 40.5, { kind: 'ghost' });
    let over = false;
    for (let t = 0; t < 40000 && sim.get(m.id); t += 100) {
      sim.step(w, 0.1, t + 100, [onFoot(1, 20.5, 20.5)], false, { roam: false });
      const z = FL(m.body.z);
      if (z >= 30 && z <= 34) over = true;
      assert.ok(!m.body.inWater && !m.body.inLava, 'never in it');
    }
    return { m, over, sim };
  };
  const lava = across(B.LAVA);
  assert.ok(lava.sim.get(lava.m.id), 'still about');
  assert.ok(lava.over, 'it floated over the lava');
  assert.ok(lava.m.body.z < 26, `and got across (${lava.m.body.z.toFixed(1)})`);
  const water = across(B.WATER);
  assert.ok(!water.over, 'it keeps out of the water');
  assert.ok(water.m.body.z > 34, `stuck on its side (${water.m.body.z.toFixed(1)})`);
});

test('it floats low enough to bop, and never bumps anyone', () => {
  const w = meadow();
  const sim = new MonsterSim(3);
  const m = sim.add(w, 20.5, 11, 30.5, { kind: 'ghost' });
  const bumps = [];
  for (let t = 0; t < 20000; t += 100) bumps.push(...sim.step(w, 0.1, t + 100, [onFoot(1, 20.5, 26.5)], false, { roam: false }));
  assert.deepEqual(bumps, [], 'it bumps nobody: its fire does the hurting');
  assert.ok(m.body.y > 11 + 0.5 && m.body.y < 11 + GHOST_HOVER.high + 0.5, `floating at ${m.body.y.toFixed(2)}`);
});

test('it breathes fire for 30 HP, 15 in a Fire Suit, and everyone hears of each breath', () => {
  for (const [outfit, hp] of [
    [undefined, maxHp(1) - GHOST_FIRE.bumps * BUMP_HP],
    ['firesuit', maxHp(1) - (GHOST_FIRE.bumps / 2) * BUMP_HP],
  ]) {
    const { room, time } = meadowRoom();
    const a = join(room, 'Happy Panda', outfit);
    const b = join(room, 'Brave Otter');
    const spawn = room.world.spawn;
    const x = spawn.x + 25;
    const m = room.monsters.add(room.world, x, 11, spawn.z + 6, { kind: 'ghost' });
    for (let t = 0; t < 15000 && !a.last('bump'); t += 100) {
      time.t += 100;
      room.receive(a, { t: 'm', s: [x, 11, spawn.z, 0, 0, 0] });
      room.receive(b, { t: 'm', s: [x + 30, 11, spawn.z, 0, 0, 0] });
      room.tick();
    }
    const bump = a.last('bump');
    assert.ok(bump, 'its fire caught them');
    assert.equal(bump.fire, true);
    assert.equal(bump.ghost, true, 'told apart from a dragon’s fire');
    assert.equal(bump.hp, hp, outfit ?? 'no outfit');
    assert.equal(hp, outfit ? maxHp(1) - 15 : maxHp(1) - 30);
    const fire = b.last('mfire');
    assert.ok(fire, 'a friend far off hears of the breath too');
    assert.equal(fire.id, m.id);
    assert.equal(fire.ms, GHOST_FIRE.ms);
  }
});

test('three bops pop it', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const m = room.monsters.add(room.world, spawn.x + 25, 11, spawn.z, { kind: 'ghost' });
  for (let t = 0; t < 20000 && room.monsters.get(m.id); t += 100) {
    time.t += 100;
    const p = { x: m.body.x + 1.2, y: 11, z: m.body.z };
    room.receive(a, { t: 'm', s: [p.x, p.y, p.z, 0, 0, 0] });
    if (room.monsters.canBop(m.id, p)) room.receive(a, { t: 'bop', id: m.id });
    room.tick();
  }
  assert.equal(room.monsters.get(m.id), null, 'popped');
  assert.equal(a.all('mhit').filter((h) => h.id === m.id).length, KINDS.ghost.hearts - 1, 'one heart off per bop');
  assert.equal(a.last('pop').id, m.id);
});
