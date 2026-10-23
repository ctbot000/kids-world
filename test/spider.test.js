// Giant spiders as monsters: low and wide on eight legs, mostly out at
// night. Unlike a Spiky or a giant mosquito you can jump on one — two of
// its four hearts come off with each landing, so two jumps see it off, or
// four bops — but it scuttles as quick as a mosquito, quicker than you
// walk, so one that sees you catches you walking and only running away
// works. It keeps to the ground as the blobs do: out of the water (where a
// mosquito flies across) and the safe places, and its legs skitter, its
// eyes glowing green at night.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import * as B from '../public/js/shared/blocks.js';
import { BUMP_HP, HIT_MS, KINDS, maxHp, MONSTER_KINDS, MONSTER_STATES, MonsterSim, SAFE_RADIUS, SPIDER_BODY, unpackMonster } from '../public/js/shared/monsters.js';
import { SpiderModel } from '../public/js/render/spider-model.js';
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

// A player standing at (x, z), as the monsters see them.
const onFoot = (id, x, z, y = 11) => ({ id, x, y, z, flying: false, riding: false, dizzy: false, safeUntil: 0 });

// Steps the monsters on by ms, a tenth of a second at a time, gathering
// the bumps.
function step(sim, world, ms, people, night = false) {
  const bumps = [];
  for (let t = 0; t < ms; t += 100) bumps.push(...sim.step(world, 0.1, t + 100, people, night, { roam: false }));
  return bumps;
}

test('a giant spider is a monster, after the kinds before it', () => {
  assert.equal(MONSTER_KINDS.indexOf('spider'), 5, 'new kinds go on the end: the wire sends the index');
  assert.deepEqual(MONSTER_KINDS.slice(0, 6), ['blob', 'king', 'big', 'spiky', 'mosquito', 'spider'], 'the kinds before it keep their places');
  const sim = new MonsterSim(1);
  const w = meadow();
  const m = sim.add(w, 20.5, 11, 20.5, { kind: 'spider' });
  assert.ok(m, 'one comes out');
  assert.equal(m.body.flying, false, 'it keeps to the ground');
  assert.equal(m.body.radius, SPIDER_BODY.radius);
  assert.equal(m.body.height, SPIDER_BODY.height);
  assert.equal(m.hearts, KINDS.spider.hearts);
  const back = unpackMonster(sim.pack()[0]);
  assert.equal(back.kind, 'spider');
  assert.deepEqual([back.hearts, back.max], [KINDS.spider.hearts, KINDS.spider.hearts]);
});

test('a spider scuttles quicker than you walk: it catches you walking without ever being tapped, but never catches you running', () => {
  const sim = new MonsterSim(5);
  const w = meadow(128);
  // You at x 40, one two steps behind you (west), then walking or running
  // east. cross: whether it was bopped first (the quicker still).
  const chase = (speed, cross = false) => {
    sim.clear();
    const m = sim.add(w, 38.5, 11, 64.5, { kind: 'spider' });
    let now = 1000;
    const p = { id: 1, x: 40.5, y: 11, z: 64.5 };
    if (cross) sim.hit(m, 1, p, now);
    else m.target = 1;
    for (let t = 0; t < 8000; t += 50) {
      now += 50;
      p.x += speed * 0.05;
      if (sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] }).length) return t;
    }
    return null;
  };
  assert.ok(chase(4.6) !== null, 'it catches you walking without ever being tapped');
  assert.ok(chase(4.6, true) !== null, 'and all the sooner bopped');
  assert.equal(chase(7), null, 'never caught running');
});

test('a spider bumps a heart off you, two landings or four bops see it off', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  room.monsters.spawnAt = Infinity;
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const m = room.monsters.add(room.world, x + 6, 11, spawn.z, { kind: 'spider' });
  for (let t = 0; t < 10000 && !a.last('bump'); t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [x, 11, spawn.z, 0, 0, 0] });
    room.tick();
  }
  const bump = a.last('bump');
  assert.ok(bump, 'it caught up');
  assert.equal(bump.hp, maxHp(1) - KINDS.spider.bump * BUMP_HP, 'one bump');
  assert.equal(bump.big ?? false, false, 'no bigger knock back');
  // A landing on it: two of its four hearts, not a pop; again, and it pops.
  const land = () => {
    time.t += HIT_MS;
    const b = m.body;
    room.receive(a, { t: 'm', s: [b.x + 0.1, b.y + 1.2, b.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: m.id, on: true });
  };
  land();
  assert.equal(m.hearts, KINDS.spider.hearts - KINDS.spider.land, 'two hearts off a landing');
  land();
  assert.equal(room.monsters.get(m.id), null, 'popped at the second');
  assert.equal(a.last('pop').id, m.id, 'and everyone saw it go');
  // Bopped: four of them.
  const n = room.monsters.add(room.world, x + 6, 11, spawn.z, { kind: 'spider' });
  let bops = 0;
  while (room.monsters.get(n.id) && bops < 10) {
    time.t += HIT_MS;
    const b = n.body;
    room.receive(a, { t: 'm', s: [b.x - 1.2, b.y, b.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: n.id });
    bops++;
  }
  assert.equal(bops, KINDS.spider.hearts, 'four bops');
  assert.equal(room.monsters.get(n.id), null, 'popped');
});

test('a spider keeps to the ground: the water stops it where a mosquito flies across', () => {
  // A meadow with a lake all the way across it, between the monster and you.
  const w = meadow();
  for (let x = 0; x < w.W; x++) for (let z = 30; z <= 34; z++) w.set(x, 10, z, B.WATER);
  const across = (kind) => {
    const sim = new MonsterSim(5);
    const m = sim.add(w, 20.5, 11, 40.5, { kind });
    let wet = 0;
    for (let t = 0; t < 40000; t += 100) {
      sim.step(w, 0.1, t + 100, [onFoot(1, 20.5, 20.5)], false, { roam: false });
      if (m.body.inWater) wet++;
    }
    return { m, wet };
  };
  const bug = across('spider');
  assert.ok(bug.m.body.z > 35, `the spider never crossed (${bug.m.body.z.toFixed(1)})`);
  assert.equal(bug.wet, 0, 'never in the water');
});

test('a spider keeps out of the safe place round the start', () => {
  const w = meadow();
  const sim = new MonsterSim(9);
  const spawn = w.spawn;
  // You on one side of the start, it on the other, close enough to chase.
  const m = sim.add(w, spawn.x - 14, 11, spawn.z + 6, { kind: 'spider' });
  const haven = { x: spawn.x, z: spawn.z, r: SAFE_RADIUS };
  for (let t = 0; t < 20000; t += 100) {
    sim.step(w, 0.1, t + 100, [onFoot(1, spawn.x + 6, spawn.z + 6)], false, { roam: false, havens: [haven] });
    const d = Math.hypot(m.body.x - haven.x, m.body.z - haven.z);
    assert.ok(d >= SAFE_RADIUS - 0.05, `never into the safe place (${d.toFixed(2)} in)`);
  }
});

test('the giant spider’s eight legs skitter in every state, fold into a hop, and its eyes glow green at night', () => {
  const m = new SpiderModel('sunny', 4);
  m.time = 0;
  assert.equal(m.legs.length, 8, 'eight legs');
  // In left/right pairs, mirrored.
  for (let i = 0; i < 8; i += 2) {
    assert.equal(Math.abs(m.legs[i].position.x + m.legs[i + 1].position.x) < 1e-9, true, `pair ${i} mirrored`);
    assert.equal(m.legs[i].position.z, m.legs[i + 1].position.z);
  }
  // Its legs: knees up over its back, feet down on the ground and well out
  // from under its body, the front pair reaching forward and the back pair
  // swept behind.
  m.group.updateMatrixWorld(true);
  for (const l of m.legs) {
    const knee = l.localToWorld(l.userData.knee.clone());
    const foot = l.localToWorld(l.userData.foot.clone());
    assert.ok(knee.y > 0.9, `a knee above its back (${knee.y.toFixed(2)})`);
    assert.ok(Math.abs(foot.y) < 0.05, `a foot on the ground (${foot.y.toFixed(2)})`);
    assert.ok(Math.abs(foot.x) > 0.62, `a foot well out from under it (${foot.x.toFixed(2)})`);
  }
  assert.ok(m.legs[0].localToWorld(m.legs[0].userData.foot.clone()).z > 0.4, 'the front pair reaches forward');
  assert.ok(m.legs[7].localToWorld(m.legs[7].userData.foot.clone()).z < -0.3, 'the back pair sweeps behind');
  // All of it: wide on its legs, and low, about a body high.
  const size = new THREE.Box3().setFromObject(m.group).getSize(new THREE.Vector3());
  assert.ok(size.x > 1.3 && size.z > 1.0, `wide on its legs (${size.x.toFixed(2)} x ${size.z.toFixed(2)})`);
  assert.ok(size.y > 0.8 && size.y < 1.1, `low, about a body high (${size.y.toFixed(2)})`);
  // On the ground they skitter, each a quarter step behind the one before.
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < 60; i++) {
    m.update(0.013, 'hop', 0);
    low = Math.min(low, m.legs[0].rotation.x);
    high = Math.max(high, m.legs[0].rotation.x);
  }
  assert.ok(high - low > 0.2, `legs skitter (${(high - low).toFixed(3)})`);
  // Up in a hop they fold in under it.
  m.update(0.013, 'hop', 2);
  for (const l of m.legs) {
    assert.equal(l.rotation.x, -0.45, 'folded back');
    assert.equal(l.rotation.z, l.userData.side * 0.4, 'tucked in');
  }
  // Eyes pale by day, aglow green at night.
  assert.equal(m.eyes[0].material, m.eyeWhite);
  m.update(0.013, 'idle', 0, true);
  assert.equal(m.eyes[0].material, m.eyeGlow, 'aglow at night');
  m.update(0.013, 'idle', 0, false);
  assert.equal(m.eyes[0].material, m.eyeWhite, 'pale by day again');
  // Every state, and a bump's squash, all without coming apart.
  m.squash = 0.3;
  for (const state of MONSTER_STATES) {
    for (let i = 0; i < 6; i++) {
      m.group.position.x += 0.12;
      m.group.rotation.y += 0.05;
      m.update(1 / 30, state, i % 3 === 0 ? 2 : 0, i % 2 === 0);
    }
    m.group.updateMatrixWorld(true);
    m.group.traverse((o) => {
      if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${state}: every part is somewhere`);
    });
  }
  assert.ok(m.squash < 0.3, 'the squash dies away');
  m.dispose();
});

test('a spider left alone goes off, like the others', () => {
  const w = meadow();
  const sim = new MonsterSim(11);
  const m = sim.add(w, 20.5, 11, 20.5, { kind: 'spider' });
  // Everyone far away, for longer than it takes to give up.
  step(sim, w, 20000, [onFoot(1, 90.5, 90.5)]);
  assert.equal(sim.get(m.id), null, 'off it went');
});
