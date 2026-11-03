// Adventure Isle's own monsters, one for a corner of the isle each
// (shared/isle-story.js): a Snappy Crab on Shipwreck Shore, quick and popped
// by one jump; a Puffshroom in the Whispering Woods, which swells up and
// puffs a cloud of spores all round it; a Little Yeti on Frostpeak Pass,
// which stomps the ground as King Grumble does, nearer; and a Gummy Bear in
// Candy Canyon, which splits into two Gummy Cubs when it pops.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { AdventureSim, MONSTER_BOOK, monsterStats } from '../public/js/shared/adventure.js';
import { BUMP_HP, bodyOf, isHeavy, KINDS, maxHp, MONSTER_KINDS, MONSTER_STATES, MonsterSim, SPORES, stompOf, STOMP, YETI_STOMP } from '../public/js/shared/monsters.js';
import { MOVE } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

const NEW = ['snapper', 'shroom', 'yeti', 'gummy', 'cub'];

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
  c.pid = c.last('welcome').you;
  return c;
}

// A flat meadow: grass at y 10 everywhere (standing at 11), the start in the middle.
function meadowRoom() {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  const W = 96;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'sunny', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.world = w;
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  return { room, time };
}

const onFoot = (id, x, z, y = 11) => ({ id, x, y, z, flying: false, riding: false, dizzy: false, safeUntil: 0 });

test('the isle’s monsters go on the end of the kinds, never roam by themselves, and are in the monster collection', () => {
  assert.deepEqual(MONSTER_KINDS.slice(11, 11 + NEW.length), NEW, 'new kinds go on the end: the wire sends the index');
  assert.equal(MONSTER_KINDS.indexOf('queen'), 10, 'the old ones where they were');
  assert.equal(MONSTER_STATES.indexOf('puff'), 8);
  assert.deepEqual(NEW.map((k) => [KINDS[k].hearts, KINDS[k].bump, KINDS[k].land]), [
    [2, 1, Infinity],
    [4, 1, 2],
    [6, 2, 2],
    [4, 1, 2],
    [1, 1, Infinity],
  ]);
  // None of them quicker than you run.
  for (const k of NEW) assert.ok(KINDS[k].cross.run < MOVE.run, k);
  assert.ok(isHeavy('yeti') && !isHeavy('snapper'));
  assert.ok(bodyOf('cub').height < bodyOf('gummy').height);
  const sim = new MonsterSim(9);
  const picked = new Set(Array.from({ length: 600 }, (_, i) => sim.pickKind(i % 2 === 0, 'sunny')));
  for (const k of NEW) assert.ok(!picked.has(k), `${k} keeps to the isle's camps`);
  for (const k of NEW) {
    const entry = MONSTER_BOOK.find((m) => m.kind === k);
    assert.ok(entry?.name && entry.icon, k);
    assert.ok(monsterStats(k).hp > 0);
  }
  assert.equal(monsterStats('snapper').jump, 'Pops at once');
  assert.equal(monsterStats('yeti').jump, '3 jumps');
});

test('a Snappy Crab scuttles after you quicker than a blob hops, and one jump on its shell pops it', () => {
  assert.ok(KINDS.snapper.move.run > KINDS.blob.move.run);
  const { room, time } = meadowRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const m = room.monsters.add(room.world, spawn.x + 25, 11, spawn.z, { kind: 'snapper' });
  const b = m.body;
  room.receive(a, { t: 'm', s: [b.x, b.y + b.height, b.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: m.id, on: true });
  assert.equal(room.monsters.get(m.id), null, 'popped at once');
  assert.equal(a.last('pop').id, m.id);
  time.t += 1;
});

test('a Puffshroom swells up, then puffs a cloud of spores all round it: whoever is in it loses HP, everyone sees it', () => {
  const { room, time } = meadowRoom();
  const near = join(room, 'Happy Panda');
  const far = join(room, 'Brave Otter');
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const m = room.monsters.add(room.world, x, 11, spawn.z, { kind: 'shroom' });
  let swelled = false;
  for (let t = 0; t < 15000 && !near.last('bump'); t += 100) {
    time.t += 100;
    // Keeping a step or two away: in its cloud's reach, out of a bump's.
    room.receive(near, { t: 'm', s: [m.body.x + 2.2, 11, m.body.z, 0, 0, 0] });
    room.receive(far, { t: 'm', s: [x - SPORES.reach - 6, 11, spawn.z, 0, 0, 0] });
    room.tick();
    if (m.state === 'puff' && !near.last('mfx')) swelled = true;
  }
  assert.ok(swelled, 'it swells up first, long enough to see it coming');
  const bump = near.last('bump');
  assert.ok(bump?.spores, 'spores got them');
  assert.equal(bump.hp, maxHp(1) - SPORES.bumps * BUMP_HP);
  const puff = far.last('mfx');
  assert.equal(puff.kind, 'spores', 'a friend further off sees the cloud');
  assert.equal(puff.id, m.id);
  assert.equal(far.all('bump').filter((x) => x.pid === far.pid).length, 0, 'out of its reach, out of trouble');
});

test('a Little Yeti stomps the ground as King Grumble does, nearer, sits dazed after, and everyone sees how far it reached', () => {
  assert.equal(stompOf('yeti'), YETI_STOMP);
  assert.equal(stompOf('king'), STOMP);
  assert.equal(stompOf('blob'), null);
  assert.ok(YETI_STOMP.reach < STOMP.reach);
  const sim = new MonsterSim(3);
  const w = meadowRoom().room.world;
  const m = sim.add(w, 30.5, 11, 30.5, { kind: 'yeti' });
  let stomp = null;
  for (let t = 0; t < 30000 && !stomp; t += 50) {
    sim.step(w, 0.05, 1_000_000 + t, [onFoot(1, 32.5, 30.5)], false, { roam: false });
    stomp = sim.takeStomps()[0] ?? null;
  }
  assert.ok(stomp, 'it stomped');
  assert.equal(stomp.monster, m);
  assert.equal(stomp.reach, YETI_STOMP.reach);
  assert.ok(m.dazed > 0, 'and sits dazed after');

  // Over the room: the thump everyone sees says how far it reaches.
  const { room, time } = meadowRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const yeti = room.monsters.add(room.world, spawn.x + 25, 11, spawn.z, { kind: 'yeti' });
  for (let t = 0; t < 30000 && !a.last('stomp'); t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [yeti.body.x + 2, 11, yeti.body.z, 0, 0, 0] });
    room.tick();
  }
  assert.equal(a.last('stomp').r, YETI_STOMP.reach);
});

test('a Gummy Bear splits into two Gummy Cubs as it pops, keeping to its camp; the cubs pop at one jump and never come back', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const camp = { id: 1, kind: 'camp', x: spawn.x + 25, y: 11, z: spawn.z, r: 7 };
  room.adventure = new AdventureSim({ camps: [camp] }, 1);
  const c = room.adventure.campById(1);
  c.awake = true;
  const bear = room.monsters.add(room.world, camp.x, 11, camp.z, { camp: 1, kind: 'gummy' });
  for (let t = 0; t < 20000 && room.monsters.get(bear.id); t += 100) {
    time.t += 100;
    const p = { x: bear.body.x + 1.2, y: 11, z: bear.body.z };
    room.receive(a, { t: 'm', s: [p.x, p.y, p.z, 0, 0, 0] });
    if (room.monsters.canBop(bear.id, p)) room.receive(a, { t: 'bop', id: bear.id });
  }
  assert.equal(room.monsters.get(bear.id), null, 'popped');
  const cubs = room.monsters.list.filter((m) => m.kind === 'cub');
  assert.equal(cubs.length, 2, 'two cubs');
  for (const cub of cubs) assert.equal(cub.camp, 1, 'keeping to its camp');
  assert.equal(c.back.length, 1, 'the bear comes back in a while, whole');
  for (const cub of cubs) {
    const b = cub.body;
    room.receive(a, { t: 'm', s: [b.x, b.y + b.height, b.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: cub.id, on: true });
    assert.equal(room.monsters.get(cub.id), null, 'one jump pops a cub');
  }
  assert.equal(c.back.length, 1, 'and a cub never comes back');
});
