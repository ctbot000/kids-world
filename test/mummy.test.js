// Mummies: a monster of desert islands only. It shambles after you, slower
// than you walk (and quicker once you have bopped it, like any of them),
// bumps one bump's worth of HP off you, and pops at three bops or one jump
// landing on it. It keeps to the ground, out of the water and the safe
// places, and it is a page of the 👾 Monster collection. Bopping one knocks a
// bandage loose that unravels off it (render/mummy-model.js) and winds back
// on again — everyone on the island sees it and its pops as any other monster.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { MONSTER_BOOK, monsterStats } from '../public/js/shared/adventure.js';
import { BUMP_HP, bodyOf, KINDS, MUMMY_SHARE, maxHp, MONSTER_KINDS, MonsterSim, SAFE_RADIUS } from '../public/js/shared/monsters.js';
import { MOVE } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

const FL = Math.floor;

// A flat desert: sand at y 10 everywhere (standing at 11), the start in the middle.
function desert(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'desert', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.SAND : B.STONE);
  return w;
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

function desertRoom() {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'desert', seed: 7, now: () => time.t, settings: { monsters: true } });
  room.world = desert();
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  return { room, time };
}

const onFoot = (id, x, z, y = 11) => ({ id, x, y, z, flying: false, riding: false, dizzy: false, safeUntil: 0 });

const kinds = (theme) => {
  const sim = new MonsterSim(9);
  return new Set(Array.from({ length: 400 }, (_, i) => sim.pickKind(i % 2 === 0, theme)));
};

test('a Mummy goes on the end of the kinds, and comes out on desert islands only', () => {
  // (It went on the end, after Queen Grizzle; kinds added since go after it.)
  assert.equal(MONSTER_KINDS.indexOf('mummy'), 44, 'new kinds go on the end: the wire sends the index');
  assert.equal(MONSTER_KINDS.indexOf('grizzle'), 43, 'the old ones keep their places before it');
  assert.deepEqual([KINDS.mummy.hearts, KINDS.mummy.bump, KINDS.mummy.land], [3, 1, Infinity]);
  assert.ok(KINDS.mummy.move.run < MOVE.run && KINDS.mummy.cross.run < MOVE.run, 'never as quick as you run');
  assert.ok(bodyOf('mummy').height >= 0.9, 'about a player-monster’s height');
  assert.ok(kinds('desert').has('mummy'));
  for (const theme of ['sunny', 'snowy', 'candy', 'volcano', 'flat', null]) assert.ok(!kinds(theme).has('mummy'), theme);
  // About as often as a Lava Ghost comes out on a volcano island.
  const sim = new MonsterSim(4);
  const n = Array.from({ length: 1000 }, () => sim.pickKind(false, 'desert')).filter((k) => k === 'mummy').length;
  assert.ok(n > 100 && n < 500, `${n} of 1000 (share ${MUMMY_SHARE})`);
  // And it is a page of the monster collection, with its stats.
  const page = MONSTER_BOOK.find((m) => m.kind === 'mummy');
  assert.ok(page?.name && page.icon);
  assert.equal(monsterStats('mummy').jump, 'Pops at once');
  assert.equal(monsterStats('mummy').fire, false);
});

test('it shambles after you and bumps you, and never into the water or a safe place', () => {
  const w = desert();
  // A river across its way, too wide to hop.
  for (let x = 0; x < w.W; x++) for (let z = 40; z <= 44; z++) w.set(x, 10, z, B.WATER);
  const sim = new MonsterSim(5);
  const m = sim.add(w, 20.5, 11, 50.5, { kind: 'mummy' });
  let over = false;
  for (let t = 0; t < 60000 && sim.get(m.id); t += 100) {
    sim.step(w, 0.1, t + 100, [onFoot(1, 20.5, 20.5)], false, { roam: false });
    if (FL(m.body.z) >= 40 && FL(m.body.z) <= 44) over = true;
    assert.ok(!m.body.inWater, 'never in the water');
  }
  assert.ok(!over, `it kept out of the water (z ${m.body.z.toFixed(1)})`);
  // It comes after you away from the start, and bumps you when it reaches you.
  const { room, time } = desertRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const x = spawn.x + 25;
  const m2 = room.monsters.add(room.world, x, 11, spawn.z + 6, { kind: 'mummy' });
  let bump = null;
  for (let t = 0; t < 30000 && !bump; t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [x, 11, spawn.z, 0, 0, 0] });
    room.tick();
    bump = a.all('bump').find((b) => b.pid === a.last('welcome').you);
  }
  assert.ok(bump, 'it bumped them');
  assert.equal(bump.hp, maxHp(1) - KINDS.mummy.bump * BUMP_HP);
  // And it keeps out of the safe place round the start, like the rest of them.
  const safe = sim.add(w, 20.5, 11, 50.5, { kind: 'mummy' });
  const haven = { x: 20.5, z: 30.5, r: SAFE_RADIUS };
  for (let t = 0; t < 20000; t += 100) {
    sim.step(w, 0.1, t + 100, [onFoot(1, 20.5, 12.5)], false, { roam: false, havens: [haven] });
    const d = Math.hypot(safe.body.x - haven.x, safe.body.z - haven.z);
    assert.ok(d >= haven.r - 0.05, `never into the safe place (${d.toFixed(2)} in)`);
  }
});

test('three bops pop it, and one jump landing on it pops it at once', () => {
  const { room, time } = desertRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const spawn = room.world.spawn;
  const m = room.monsters.add(room.world, spawn.x + 25, 11, spawn.z, { kind: 'mummy' });
  for (let t = 0; t < 20000 && room.monsters.get(m.id); t += 100) {
    time.t += 100;
    const p = { x: m.body.x + 1.2, y: 11, z: m.body.z };
    room.receive(a, { t: 'm', s: [p.x, p.y, p.z, 0, 0, 0] });
    if (room.monsters.canBop(m.id, p)) room.receive(a, { t: 'bop', id: m.id });
    room.tick();
  }
  assert.equal(room.monsters.get(m.id), null, 'popped');
  assert.equal(a.all('mhit').filter((h) => h.id === m.id).length, KINDS.mummy.hearts - 1, 'one heart off per bop');
  assert.equal(a.last('pop').id, m.id);
  assert.ok(b.last('pop'), 'a friend sees it pop too');
  // And a jump landing on it.
  const { room: room2, time: time2 } = desertRoom();
  const c = join(room2);
  const spawn2 = room2.world.spawn;
  const m2 = room2.monsters.add(room2.world, spawn2.x + 25, 11, spawn2.z, { kind: 'mummy' });
  room2.receive(c, { t: 'm', s: [m2.body.x, 11 + m2.body.height, m2.body.z, 0, 0, 0] });
  room2.receive(c, { t: 'bop', id: m2.id, on: true });
  assert.equal(room2.monsters.get(m2.id), null, 'popped at once');
  assert.equal(c.last('pop').id, m2.id);
  time2.t += 1;
});
