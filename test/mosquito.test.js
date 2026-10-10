// Giant mosquitos as monsters: the animals that used to drone about the
// meadows as friends turned hostile. No island has a friendly one any more
// (and an old save with one loads without it); as a monster it never
// touches the ground — it hangs in the air well out of reach of arm and
// jump, whining, and darts down at whoever it sees, quicker than you walk,
// to bump a heart off them. Nobody can jump on it: two bops see it off.
// Being a flyer it crosses the water where the others cannot, keeps out of
// the safe places as they do, flits along a tower defense road quicker
// than the marching blobs, hangs over a camp on an adventure island and
// comes back when popped — and its wings beat together, its eyes glowing
// red at night.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import * as B from '../public/js/shared/blocks.js';
import { GUARD_BACK_MS } from '../public/js/shared/adventure.js';
import { CRITTER_TYPES } from '../public/js/shared/critters.js';
import { LEAK, waveOf } from '../public/js/shared/defense.js';
import { HIT_MS, KINDS, MAX_HEARTS, MONSTER_KINDS, MONSTER_STATES, MonsterSim, MOSQUITO_HOVER, SAFE_RADIUS, unpackMonster } from '../public/js/shared/monsters.js';
import { MosquitoModel } from '../public/js/render/mosquito-model.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

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

test('the mosquito is a monster now, on the end of the kinds, and no animal any more', () => {
  assert.equal(MONSTER_KINDS.indexOf('mosquito'), 4, 'new kinds go on the end: the wire sends the index');
  assert.equal(MONSTER_KINDS.at(-1), 'mosquito');
  assert.ok(!CRITTER_TYPES.includes('mosquito'), 'no critter of them');
  assert.equal(CRITTER_TYPES.at(-1), 'scooter');
  const sim = new MonsterSim(1);
  const w = meadow();
  const m = sim.add(w, 20.5, 11, 20.5, { kind: 'mosquito' });
  assert.ok(m, 'one comes out');
  assert.equal(m.body.flying, true, 'already on the wing');
  assert.equal(m.body.radius, 0.5);
  assert.equal(m.body.height, 1.15);
  const back = unpackMonster(sim.pack()[0]);
  assert.equal(back.kind, 'mosquito');
  assert.deepEqual([back.hearts, back.max], [KINDS.mosquito.hearts, KINDS.mosquito.hearts]);
});

test('no island starts with a friendly giant mosquito, and an old save with one loads without it', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    for (const seed of [7, 4242]) {
      const { critters } = generate({ seed, theme });
      assert.ok(critters.every((c) => c.type !== 'mosquito'), `${theme} ${seed}: none as an animal`);
    }
  }
  const room = new Room({ code: '123456', theme: 'sunny', seed: 77, now: () => 1000 });
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const old = { ...save, v: 9, critters: [...save.critters, { type: 'mosquito', name: 'Whizzy', x: 10, y: 10, z: 10, yaw: 0 }] };
  const load = new Room({ code: '654321', save: JSON.parse(JSON.stringify(old)), now: () => 2000 });
  assert.ok(load.critters.list.every((c) => c.type !== 'mosquito'), 'the saved one does not come back');
});

test('a mosquito never touches the ground: it hangs in the air out of reach, and darts down at you to bump', () => {
  const w = meadow();
  const sim = new MonsterSim(3);
  // Nobody near enough to chase (but near enough it does not go away).
  const m = sim.add(w, 20.5, 11, 37.5, { kind: 'mosquito' });
  step(sim, w, 2000, [onFoot(1, 20.5, 54.5)]);
  assert.ok(['idle', 'hop'].includes(m.state), `hanging about (${m.state})`);
  assert.ok(m.body.y >= 11 + MOSQUITO_HOVER.high - 0.4, `well up at ${m.body.y.toFixed(2)}`);
  assert.equal(sim.canBop(m.id, { x: m.body.x, y: 11, z: m.body.z }), null, 'out of reach of a bop from below');
  // Someone it can get at: down it comes, and bumps them.
  const me = onFoot(1, 23.5, 37.5);
  let dived = false;
  const bumps = [];
  let bumpedAt = 0;
  for (let t = 0; t < 12000 && bumps.length === 0; t += 100) {
    const got = sim.step(w, 0.1, t + 3000, [me], false, { roam: false });
    if (got.length) {
      bumps.push(...got);
      bumpedAt = t + 3000;
    }
    if (m.state === 'chase' && m.body.y <= 11 + MOSQUITO_HOVER.low + 0.8) dived = true;
    assert.ok(m.body.y > w.top(FL(m.body.x), FL(m.body.z)) + 1 + 0.4, `never touching the ground (${m.body.y.toFixed(2)})`);
    assert.ok(!B.SOLID[w.get(FL(m.body.x), FL(m.body.y + 0.6), FL(m.body.z))], 'never inside a block');
  }
  assert.ok(dived, 'it came down to bump height');
  assert.deepEqual(bumps.map((b) => b.pid), [1], 'it bumped them');
  // Close as it darted, it was close enough to swat.
  assert.ok(sim.canBop(m.id, { x: m.body.x + 1.4, y: 11, z: m.body.z }), 'within arm’s reach on the dart');
  sim.step(w, 0.1, bumpedAt + 200, [me], false, { roam: false });
  assert.equal(m.state, 'giggle', 'and giggled');
});

test('a mosquito bumps a heart off you, nobody can jump on it, and two bops see it off', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  room.monsters.spawnAt = Infinity;
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const m = room.monsters.add(room.world, x + 5, 11, spawn.z, { kind: 'mosquito' });
  for (let t = 0; t < 10000 && !a.last('bump'); t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [x, 11, spawn.z, 0, 0, 0] });
    room.tick();
  }
  const bump = a.last('bump');
  assert.ok(bump, 'it caught them');
  assert.equal(bump.hearts, MAX_HEARTS - KINDS.mosquito.bump, 'one heart');
  assert.equal(bump.big ?? false, false, 'no bigger knock back');
  // Nobody can jump on it: a landing on it counts for nothing at all.
  assert.equal(KINDS.mosquito.land, 0);
  const at = { x: m.body.x, y: m.body.y + 0.9, z: m.body.z };
  if (room.monsters.landsOn(m.id, at) === m) {
    time.t += HIT_MS;
    room.receive(a, { t: 'm', s: [at.x, at.y, at.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: m.id, on: true });
    room.tick();
    assert.equal(a.last('mhit'), undefined, 'a landing does nothing to it');
  }
  // As it darts back in: swat, twice, and it goes pop.
  for (let t = 0; t < 20000 && room.monsters.get(m.id); t += 100) {
    time.t += 100;
    const b = m.body;
    const p = { x: b.x + 1.4, y: 11, z: b.z };
    room.receive(a, { t: 'm', s: [p.x, p.y, p.z, 0, 0, 0] });
    if (room.monsters.canBop(m.id, p)) room.receive(a, { t: 'bop', id: m.id });
    room.tick();
  }
  assert.equal(room.monsters.get(m.id), null, 'popped');
  assert.equal(a.all('mhit').filter((h) => h.id === m.id).length, KINDS.mosquito.hearts - 1, 'one heart off per bop');
  assert.equal(a.last('pop').id, m.id, 'the last bop saw it off');
});

test('a mosquito crosses the water where the others cannot', () => {
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
  const bug = across('mosquito');
  assert.ok(bug.m.body.z < 26, `the mosquito got across (${bug.m.body.z.toFixed(1)})`);
  assert.equal(bug.wet, 0, 'never in the water');
  assert.ok(bug.m.body.y >= 10 + MOSQUITO_HOVER.low - 0.3, `over the water at ${bug.m.body.y.toFixed(2)}`);
  const blob = across('blob');
  assert.ok(blob.m.body.z > 35, `the blob never crossed (${blob.m.body.z.toFixed(1)})`);
});

test('a mosquito keeps out of the safe place round the start', () => {
  const w = meadow();
  const sim = new MonsterSim(9);
  const spawn = w.spawn;
  // You on one side of the start, it on the other, close enough to chase.
  const m = sim.add(w, spawn.x - 14, 11, spawn.z + 6, { kind: 'mosquito' });
  const haven = { x: spawn.x, z: spawn.z, r: SAFE_RADIUS };
  for (let t = 0; t < 20000; t += 100) {
    sim.step(w, 0.1, t + 100, [onFoot(1, spawn.x + 6, spawn.z + 6)], false, { roam: false, havens: [haven] });
    const d = Math.hypot(m.body.x - haven.x, m.body.z - haven.z);
    assert.ok(d >= SAFE_RADIUS - 0.05, `never into the safe place (${d.toFixed(2)} in)`);
  }
});

test('mosquitos fly among the waves from the second one, spread through them and quicker along the road', () => {
  assert.deepEqual([1, 2, 3, 4, 8, 10].map((n) => waveOf(n).mosquitos), [0, 1, 1, 2, 4, 5]);
  assert.equal(LEAK.mosquito, 1);
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', seed: 2, defense: true, now: time.now });
  const a = join(room);
  const def = room.defense;
  def.wave = 2;
  room.receive(a, { t: 'defend', cmd: 'start' });
  const w = waveOf(2, 1);
  assert.equal(def.queue.filter((k) => k === 'mosquito').length, w.mosquitos, 'the wave has its mosquitos');
  assert.equal(def.queue.length, w.blobs + w.mosquitos);
  assert.equal(def.queue[0], 'blob', 'a blob first out of the gate');
  assert.equal(def.queue.at(-1), 'blob', 'and last');
  for (let i = 1; i < def.queue.length; i++) assert.ok(def.queue[i] !== 'mosquito' || def.queue[i - 1] !== 'mosquito', 'never two mosquitos together');
  // Out they come: the mosquito flies along above the road.
  for (let t = 0; t < 15000 && !room.monsters.list.some((m) => m.march && m.kind === 'mosquito'); t += 100) {
    time.t += 100;
    room.tick();
  }
  const bug = room.monsters.list.find((m) => m.march && m.kind === 'mosquito');
  assert.ok(bug, 'one came out of the gate');
  // Up into the air it goes, then along above the road, never touching it.
  for (let t = 0; t < 3000; t += 100) {
    time.t += 100;
    room.tick();
  }
  assert.equal(bug.body.flying, true, 'on the wing');
  for (let t = 0; t < 30000 && room.monsters.get(bug.id); t += 100) {
    time.t += 100;
    room.tick();
    const b = bug.body;
    const to = def.route[Math.min(bug.leg, def.route.length - 1)];
    assert.ok(b.y >= to.y + MOSQUITO_HOVER.march - 0.8, `above the road at ${b.y.toFixed(2)} (road ${to.y})`);
    assert.equal(b.inWater, false, 'never in the water');
  }
});

test('a mosquito guards a camp on the wing, and popped it comes back', () => {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', seed: 3, adventure: true, now: time.now });
  const a = join(room);
  const camp = room.adventure.camps.find((c) => c.kind === 'camp');
  const bug = () => room.monsters.list.filter((m) => m.camp === camp.id && m.kind === 'mosquito');
  const stand = (x) => room.receive(a, { t: 'm', s: [x, camp.y, camp.z, 0, 0, 0] });
  // Into the camp: out come its monsters, the mosquito among them, and it
  // dives at you. Swat it twice.
  for (let t = 0; t < 20000 && bug().length === 1 && room.monsters.get(bug()[0].id); t += 100) {
    time.t += 100;
    const m = bug()[0];
    const b = m.body;
    const p = { x: b.x + 1.4, y: camp.y, z: b.z };
    room.receive(a, { t: 'm', s: [p.x, p.y, p.z, 0, 0, 0] });
    if (room.monsters.canBop(m.id, p)) room.receive(a, { t: 'bop', id: m.id });
    room.tick();
  }
  assert.equal(bug().length, 0, 'swatted');
  // Out of reach of the others, but near enough the camp stays awake: a
  // while later, back comes a mosquito.
  for (let t = 0; t < GUARD_BACK_MS + 4000 && bug().length === 0; t += 100) {
    time.t += 100;
    stand(camp.x + camp.r + 6);
    room.tick();
  }
  assert.equal(bug().length, 1, 'a mosquito again');
  assert.ok(bug()[0].body.flying, 'on the wing over the camp');
});

test('the enemy mosquito’s wings beat together in every state, and its eyes glow red at night', () => {
  const m = new MosquitoModel('sunny', 4);
  m.time = 0;
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < 40; i++) {
    m.group.position.y += 0.02;
    m.update(0.013, 'hop', 2);
    const [left, right] = m.wings.map((w) => new THREE.Vector3(w.userData.wing * 0.1, 0, 0).applyEuler(w.rotation).add(w.position));
    assert.ok(Math.abs(left.y - right.y) < 1e-9 && Math.abs(left.x + right.x) < 1e-9, 'wings mirror each other');
    low = Math.min(low, left.y);
    high = Math.max(high, left.y);
  }
  assert.ok(high - low > 0.02, `wings beat (${(high - low).toFixed(3)})`);
  // No saddle any more: nobody rides one.
  assert.equal(m.saddle, undefined);
  // Eyes dark red by day, aglow at night.
  assert.equal(m.eyes[0].material, m.eyeDim);
  m.update(0.013, 'idle', 2, true);
  assert.equal(m.eyes[0].material, m.eyeGlow, 'aglow at night');
  m.update(0.013, 'idle', 2, false);
  assert.equal(m.eyes[0].material, m.eyeDim, 'dim by day again');
  // Every state, and a bump’s squash, all without coming apart.
  m.squash = 0.3;
  for (const state of MONSTER_STATES) {
    for (let i = 0; i < 6; i++) {
      m.group.position.x += 0.12;
      m.group.rotation.y += 0.05;
      m.update(1 / 30, state, 2, i % 2 === 0);
    }
    m.group.updateMatrixWorld(true);
    m.group.traverse((o) => {
      if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${state}: every part is somewhere`);
    });
  }
  assert.ok(m.squash < 0.3, 'the squash dies away');
  m.dispose();
});

test('a mosquito left alone goes off, like the others', () => {
  const w = meadow();
  const sim = new MonsterSim(11);
  const m = sim.add(w, 20.5, 11, 20.5, { kind: 'mosquito' });
  // Everyone far away, for longer than it takes to give up.
  step(sim, w, 20000, [onFoot(1, 90.5, 90.5)]);
  assert.equal(sim.get(m.id), null, 'off it went');
});
