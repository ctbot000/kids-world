// What a popped monster drops (shared/loot.js): coins (in bags from the
// bigger ones), and now and then a heart, an HP potion or a jewel, more the
// tougher it is, a beast its own coins and a boss a fountain; where each
// thing comes down (on the ground, on the water, never in a wall, the lava or
// past a wall; in the Land of Nod, on the ground of its body); and on an
// island: told with the pop, everyone's who helped whoever picks it up, a
// heart HP back, flying off by itself after a while, told to whoever comes,
// and a boss's for everyone.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEASTS } from '../public/js/shared/beasts.js';
import * as B from '../public/js/shared/blocks.js';
import { BOSSES } from '../public/js/shared/bosses.js';
import { firstStage } from '../public/js/shared/isle-story.js';
import { BAG, BOSS_LOOT_MS, bossCoins, coinPieces, dropsOf, HEART_HP, HELP_MS, JEWELS, landOn, Loot, LOOT_KINDS, LOOT_LIFE_MS, lootOf, lootSpots, MAX_LOOT, nodLootSpots, packLoot, PICK_REACH, TAKE_SLACK, tierOf, unpackLoot } from '../public/js/shared/loot.js';
import { HIT_MS, KINDS } from '../public/js/shared/monsters.js';
import { Rng } from '../public/js/shared/rng.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { nodWorld } from '../public/js/shared/nod/worlds/index.js';
import { World } from '../public/js/shared/world.js';

const seeded = (seed = 1) => {
  const rng = new Rng(seed);
  return () => rng.next();
};
const coinsIn = (list) => list.reduce((n, d) => n + (d.k === 'coin' || d.k === 'bag' ? d.n : 0), 0);

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name = 'Happy Panda', look = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', ...look }, tickets: [2, 3, 4, 5, 6] });
  c.pid = c.last('welcome').you;
  return c;
}

// A flat meadow: grass at y 10 everywhere (standing at 11).
function meadow(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'sunny', spawn: { x: 12.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

function meadowRoom() {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  room.world = meadow();
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  room.critters.list.length = 0;
  const tick = (ms = 100) => {
    for (let t = 0; t < ms; t += 100) {
      time.t += 100;
      room.tick();
    }
  };
  return { room, time, tick };
}

const stand = (room, c, x, z, y = 11) => room.receive(c, { t: 'm', s: [x, y, z, 0, 0, 0] });

// A blob popped by a's bops, with b's bop on it first if b is given.
function popBlob(room, time, a, { x = 50.5, z = 48.5, b = null, kind = 'blob' } = {}) {
  const m = room.monsters.add(room.world, x, 11, z, { kind });
  m.giggle = Infinity;
  if (b) {
    stand(room, b, x - 1.2, z);
    room.receive(b, { t: 'bop', id: m.id });
  }
  stand(room, a, x + 1.2, z);
  for (let i = 0; i < 40 && room.monsters.get(m.id); i++) {
    time.t += HIT_MS;
    Object.assign(m.body, { x, y: 11, z, vx: 0, vy: 0, vz: 0 });
    room.receive(a, { t: 'bop', id: m.id });
  }
  assert.equal(room.monsters.get(m.id), null, 'popped');
  return m;
}

test('what each kind of monster drops: the tougher, the more, a beast its own coins, a Mimic a jewel and a boss a fountain', () => {
  // Each kind sorted by how tough it is.
  assert.equal(tierOf('blob'), 'little');
  assert.equal(tierOf('cub'), 'tiny');
  assert.equal(tierOf('spiky'), 'middling');
  assert.equal(tierOf('golem'), 'tough');
  assert.equal(tierOf('queen'), 'queen');
  assert.equal(tierOf('wolf'), 'beast');
  assert.equal(tierOf('rex'), 'mighty');
  assert.equal(tierOf('king'), 'boss');
  assert.equal(tierOf('king', { march: true }), 'tough', 'marching on a road, King Grumble is only tough');
  for (const kind of Object.keys(BOSSES)) assert.equal(tierOf(kind), 'boss', kind);
  const many = (kind, opts, n = 400) => Array.from({ length: n }, (_, i) => lootOf(kind, seeded(i + 1), opts));
  // A blob: a coin or two, now and then something more.
  const blobs = many('blob');
  for (const l of blobs) assert.ok(coinsIn(l) >= 1 && coinsIn(l) <= 2 && l.length <= 5);
  assert.ok(blobs.some((l) => coinsIn(l) === 1) && blobs.some((l) => coinsIn(l) === 2));
  const hearts = blobs.filter((l) => l.some((d) => d.k === 'heart')).length;
  assert.ok(hearts > 20 && hearts < 90, `a heart now and then: ${hearts} of 400`);
  // Tougher: more.
  const mean = (list) => list.reduce((n, l) => n + coinsIn(l), 0) / list.length;
  assert.ok(mean(many('golem')) > mean(many('spiky')) && mean(many('spiky')) > mean(blobs) && mean(blobs) > mean(many('cub')));
  for (const l of many('cub')) assert.equal(coinsIn(l), 1);
  // A beast drops its own coins, every time; a Mimic a jewel too, and the
  // mightiest a jewel always.
  for (const [kind, beast] of Object.entries(BEASTS)) for (const l of many(kind, {}, 20)) assert.equal(coinsIn(l), beast.coins, kind);
  for (const l of many('mimic', {}, 50)) assert.ok(l.some((d) => JEWELS.includes(d.k)), 'a Mimic is a treasure chest');
  for (const kind of Object.keys(BEASTS).filter((k) => BEASTS[k].tier === 2)) for (const l of many(kind, {}, 20)) assert.ok(l.some((d) => JEWELS.includes(d.k)), kind);
  // The Queen Mosquito: more than before (5 over a monster's) and a heart, always.
  for (const l of many('queen', {}, 50)) {
    assert.ok(coinsIn(l) >= 8 && coinsIn(l) <= 10);
    assert.ok(l.some((d) => d.k === 'heart'));
  }
  // A boss: a fountain, more on the higher stages, with an HP potion and two jewels.
  for (const level of [1, 5, 10, 30]) {
    const l = lootOf('king', seeded(3), { level });
    assert.equal(coinsIn(l), bossCoins(level));
    assert.ok(l.some((d) => d.k === 'potion'));
    assert.ok(l.filter((d) => JEWELS.includes(d.k)).length >= 2);
  }
  assert.ok(bossCoins(10) > bossCoins(1) && bossCoins(30) === bossCoins(10));
  // The rarer things oftener on the higher stages.
  const rare = (level) => many('spiky', { level }, 1000).filter((l) => l.some((d) => d.k === 'potion' || JEWELS.includes(d.k))).length;
  assert.ok(rare(21) > rare(1) * 1.5, `${rare(21)} against ${rare(1)}`);
  // A fright of the Land of Nod, by its own spec: one with no guard little,
  // the boss a fountain.
  assert.equal(tierOf('dustbunny', { nod: { guard: 'none', hearts: 1 } }), 'little');
  assert.equal(tierOf('ram', { nod: { guard: 'front', hearts: 2 } }), 'middling');
  assert.equal(tierOf('clock', { nod: { guard: 'all', hearts: 3 } }), 'tough');
  assert.equal(tierOf('mare', { nod: { boss: true } }), 'boss');
  // Every kind it drops is one the wire knows.
  for (const kind of Object.keys(KINDS)) for (const l of many(kind, {}, 30)) for (const d of l) assert.ok(LOOT_KINDS.includes(d.k) && d.n >= 1, `${kind}: ${d.k}`);
});

test('the monster collection says what each kind drops: its coins, and whether more comes with them', () => {
  assert.deepEqual(dropsOf('blob'), { coins: [1, 2], heart: 0.12, potion: 0.02, jewel: 0.02 });
  assert.deepEqual(dropsOf('rattle').coins, [BEASTS.rattle.coins, BEASTS.rattle.coins]);
  assert.equal(dropsOf('mimic').jewel, 1);
  assert.equal(dropsOf('queen').heart, 1);
  assert.deepEqual(dropsOf('king').coins, [bossCoins(1), bossCoins(10)]);
  assert.equal(dropsOf('king').jewel, 1);
  // Never less than what it really drops, nor more.
  for (const kind of Object.keys(KINDS)) {
    const [lo, hi] = dropsOf(kind).coins;
    for (let i = 1; i < 60; i++) {
      const n = coinsIn(lootOf(kind, seeded(i)));
      assert.ok(n >= lo && n <= hi, `${kind}: ${n} of ${lo}–${hi}`);
    }
  }
});

test('coins come as single coins up to six, past that in bags, never too many things', () => {
  assert.deepEqual(coinPieces(0), []);
  assert.deepEqual(coinPieces(3), [{ k: 'coin', n: 1 }, { k: 'coin', n: 1 }, { k: 'coin', n: 1 }]);
  assert.equal(coinPieces(6).length, 6);
  assert.deepEqual(coinPieces(7).map((d) => d.k), ['bag', 'coin', 'coin']);
  for (let n = 0; n <= 300; n++) {
    const pieces = coinPieces(n);
    assert.equal(coinsIn(pieces), n, `all ${n} of them`);
    assert.ok(pieces.length <= 14);
    assert.ok(pieces.filter((d) => d.k === 'coin').length <= 6);
    assert.ok(pieces.every((d) => d.k === 'coin' ? d.n === 1 : d.n >= BAG));
  }
});

test('what drops comes down round where the monster went pop: on the ground or the water, never in a wall, the lava or past a wall', () => {
  const w = meadow(64);
  const from = { x: 30.5, y: 11, z: 30.5 };
  for (let seed = 1; seed < 40; seed++) {
    const spots = lootSpots(w, from, 6, seeded(seed));
    assert.equal(spots.length, 6);
    for (const s of spots) {
      assert.equal(s.y, 11, 'on the grass');
      assert.ok(Math.hypot(s.x - from.x, s.z - from.z) <= 3.6, 'near it');
      assert.equal(s.wet, false);
    }
    // Spread out, not all in a heap.
    const far = Math.max(...spots.map((s) => Math.hypot(s.x - from.x, s.z - from.z)));
    assert.ok(far > 0.6, `spread out: ${far}`);
  }
  // From a monster in the air (a mosquito), down on the ground under it.
  for (const s of lootSpots(w, { x: 30.5, y: 13.3, z: 30.5 }, 4, seeded(2))) assert.equal(s.y, 11);
  // A wall two blocks high just east of it: nothing past it, nor in it.
  const walled = meadow(64);
  for (let z = 20; z < 40; z++) for (const y of [11, 12]) walled.set(31, y, z, B.STONE);
  for (let seed = 1; seed < 60; seed++) {
    for (const s of lootSpots(walled, from, 8, seeded(seed))) {
      assert.ok(s.x < 31, `never past the wall: ${s.x}`);
      assert.ok(!B.SOLID[walled.get(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z))], 'never in it');
    }
  }
  // A step up beside it is fine: on top of it.
  const step = meadow(64);
  for (let x = 31; x < 40; x++) for (let z = 20; z < 40; z++) step.set(x, 11, z, B.STONE);
  const up = lootSpots(step, from, 8, seeded(5));
  assert.ok(up.every((s) => s.y === (s.x >= 31 ? 12 : 11)));
  // Lava all round it but its own block: nothing comes down in the lava.
  const lava = meadow(64);
  for (let x = 20; x < 42; x++) for (let z = 20; z < 42; z++) if (x !== 30 || z !== 30) lava.set(x, 10, z, B.LAVA);
  for (const s of lootSpots(lava, from, 6, seeded(4))) assert.deepEqual([Math.floor(s.x), s.y, Math.floor(s.z)], [30, 11, 30], 'on the one block that is not lava');
  // On the water, it floats.
  const pond = meadow(64);
  for (let x = 20; x < 42; x++) for (let z = 20; z < 42; z++) pond.set(x, 10, z, B.WATER);
  for (const s of lootSpots(pond, from, 5, seeded(6))) {
    assert.equal(s.wet, true);
    assert.ok(s.y > 10.5 && s.y < 11, 'on its surface');
  }
  assert.deepEqual(landOn(pond, 30.5, 12, 30.5), { y: 10.88, wet: true });
  assert.equal(landOn(lava, 25.5, 12, 25.5), null);
  assert.equal(landOn(w, -1, 12, 5), null, 'off the island');
  // Shut in by walls all round, with nowhere at all: at whoever popped it.
  const shut = meadow(64);
  for (let x = 20; x < 42; x++) for (let z = 20; z < 42; z++) for (let y = 10; y < 20; y++) shut.set(x, y, z, B.STONE);
  for (const s of lootSpots(shut, { x: 30.5, y: 12, z: 30.5 }, 3, seeded(7), { fallback: { x: 10.5, y: 11, z: 10.5 } })) assert.deepEqual([s.x, s.y, s.z], [10.5, 11, 10.5]);
});

test('in the Land of Nod it comes down on the ground of the body the fright was on, clear of what stands on it', () => {
  const world = nodWorld('pillow');
  const { space } = world;
  for (const body of space.bodies.slice(0, 4)) {
    const at = body.spot({ x: 0.4, y: 0.8, z: 0.3 });
    const from = { x: at.x + at.up.x * 0.6, y: at.y + at.up.y * 0.6, z: at.z + at.up.z * 0.6 };
    const spots = nodLootSpots(space, from, 6, seeded(3));
    assert.equal(spots.length, 6);
    for (const s of spots) {
      assert.ok(Math.abs(body.ground(s.x, s.y, s.z)) < 0.05, `on the ground of ${body.key}`);
      assert.ok(Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z) < 4.5, 'near it');
    }
  }
});

test('what lies about an island is kept with whom it is for, taken only near enough, flies off when its time is up, and only so much at once', () => {
  const loot = new Loot(3);
  const made = loot.add([{ k: 'coin', n: 1 }, { k: 'heart', n: 1 }], [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }], [7, 8], 1000);
  assert.deepEqual(made.map((d) => [d.k, d.end, d.to]), [['coin', 1000 + LOOT_LIFE_MS, [7, 8]], ['heart', 1000 + LOOT_LIFE_MS, [7, 8]]]);
  // On the wire, and back.
  const row = packLoot(made[0]);
  assert.deepEqual(unpackLoot(row), { id: made[0].id, k: 'coin', n: 1, x: 1, y: 2, z: 3 });
  for (const bad of [null, [], [1, 99, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0], ['a', 0, 1, 0, 0, 0], [1, 0, 1, 0, NaN, 0]]) assert.equal(unpackLoot(bad), null, JSON.stringify(bad));
  assert.deepEqual(loot.take([made[0].id], () => false), [], 'not near enough');
  assert.deepEqual(loot.take([made[0].id, made[0].id, 999], () => true).map((d) => d.id), [made[0].id], 'taken once');
  assert.equal(loot.list.length, 1);
  // A stage won: off it goes soon.
  loot.hurry(2000);
  assert.deepEqual(loot.due(1999), []);
  assert.equal(loot.due(2000).length, 1);
  assert.equal(loot.list.length, 0);
  // Only so much at once: the oldest goes.
  for (let i = 0; i < MAX_LOOT + 5; i++) loot.add([{ k: 'coin', n: 1 }], [{ x: i, y: 0, z: 0 }], [1], 3000);
  assert.equal(loot.list.length, MAX_LOOT);
  assert.equal(loot.due(3000).length, 5, 'the oldest five, off to whoever they were for');
  // The island growing under it.
  loot.shift(2, 3);
  assert.deepEqual([loot.list[0].x, loot.list[0].z], [5 + 2, 3]);
});

test('a monster popped drops its loot, told with the pop for everyone to see, lying round where it went pop', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const m = popBlob(room, time, a);
  const pop = b.last('pop');
  assert.equal(pop.id, m.id);
  assert.ok(Array.isArray(pop.loot) && pop.loot.length >= 1, 'it dropped something');
  const lying = pop.loot.map(unpackLoot);
  assert.deepEqual(lying.map((d) => d.id), room.loot.list.map((d) => d.id));
  for (const d of lying) {
    assert.ok(LOOT_KINDS.includes(d.k));
    assert.ok(Math.hypot(d.x - m.body.x, d.z - m.body.z) < 3.6);
    assert.equal(d.y, 11, 'on the grass');
  }
  assert.ok(coinsIn(lying) >= 1);
  // Whoever comes later sees it lying there.
  const c = join(room, 'Late Lamb');
  assert.deepEqual(c.last('welcome').loot, pop.loot);
  // Jumped on, the same.
  const n = room.monsters.add(room.world, 60.5, 11, 48.5);
  stand(room, a, 60.7, 48.5, 11.6);
  time.t += HIT_MS;
  room.receive(a, { t: 'bop', id: n.id, on: true });
  assert.ok(b.last('pop').id === n.id && b.last('pop').loot.length >= 1);
});

test('loot is everyone’s who helped, whoever picks it up: walked up to, it goes to them all, and a heart is HP back', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const c = join(room, 'Late Lamb');
  // b had a bop at it, a popped it; c had nothing to do with it.
  popBlob(room, time, a, { b });
  const [first, ...rest] = room.loot.list;
  assert.deepEqual(first.to, [a.pid, b.pid]);
  // From too far, nothing.
  stand(room, c, first.x + TAKE_SLACK + 3, first.z);
  room.receive(c, { t: 'loot', ids: [first.id] });
  assert.equal(c.last('took'), undefined);
  assert.ok(room.loot.get(first.id), 'still there');
  // c walks up to it and picks it up: c gets it, and so do a and b.
  stand(room, c, first.x + PICK_REACH - 0.2, first.z);
  room.receive(c, { t: 'loot', ids: [first.id, 12345, 'x'] });
  const took = a.last('took');
  assert.equal(took.by, c.pid);
  assert.deepEqual(took.got, [{ id: first.id, k: first.k, n: first.n, to: [c.pid, a.pid, b.pid] }]);
  assert.deepEqual(b.last('took'), took, 'everyone told');
  assert.equal(room.loot.get(first.id), null, 'gone from the ground');
  // Picked up again (two at once): nothing more.
  room.receive(a, { t: 'loot', ids: [first.id] });
  assert.equal(a.all('took').length, 1);
  // Sitting dizzy, nothing is picked up.
  for (const d of rest) {
    stand(room, b, d.x, d.z);
    room.players.get(b.pid).dizzyUntil = time.t + 5000;
    room.receive(b, { t: 'loot', ids: [d.id] });
    assert.ok(room.loot.get(d.id));
    room.players.get(b.pid).dizzyUntil = 0;
  }
  // A heart: HP back for whoever picks it up and whoever helped, never past
  // their most.
  room.loot.list.length = 0;
  const [heart] = room.loot.add([{ k: 'heart', n: 1 }], [{ x: 40.5, y: 11, z: 40.5 }], [a.pid, b.pid], time.t);
  const pa = room.players.get(a.pid);
  const pb = room.players.get(b.pid);
  pa.hp = 30;
  pb.hp = pb.maxHp - 10;
  stand(room, a, 40.5, 40.5);
  room.receive(a, { t: 'loot', ids: [heart.id] });
  assert.equal(pa.hp, 30 + HEART_HP);
  assert.equal(pb.hp, pb.maxHp);
  assert.deepEqual(a.last('hp'), { t: 'hp', hp: 30 + HEART_HP, max: pa.maxHp });
  assert.deepEqual(b.last('hp'), { t: 'hp', hp: pb.maxHp, max: pb.maxHp });
  assert.equal(c.last('hp'), undefined, 'not for c, who had nothing to do with it');
});

test('a bop long before the pop is no help; what is left lying flies off by itself to whoever it is for', () => {
  const { room, time, tick } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const m = room.monsters.add(room.world, 50.5, 11, 48.5, { kind: 'golem' });
  m.giggle = Infinity;
  m.keepHearts = true;
  stand(room, b, 49.3, 48.5);
  room.receive(b, { t: 'bop', id: m.id });
  time.t += HELP_MS + 1000;
  stand(room, b, 10.5, 10.5);
  stand(room, a, 51.7, 48.5);
  for (let i = 0; i < 40 && room.monsters.get(m.id); i++) {
    time.t += HIT_MS;
    Object.assign(m.body, { x: 50.5, y: 11, z: 48.5, vx: 0, vy: 0, vz: 0 });
    room.receive(a, { t: 'bop', id: m.id });
  }
  assert.equal(room.monsters.get(m.id), null);
  const lying = room.loot.list.map((d) => d.id);
  assert.ok(lying.length >= 3, 'a golem drops a few');
  for (const d of room.loot.list) assert.deepEqual(d.to, [a.pid], 'only a’s');
  // Nobody picks it up: after a while, it flies off by itself to a.
  stand(room, a, 10.5, 10.5);
  tick(LOOT_LIFE_MS - 1000);
  assert.equal(room.loot.list.length, lying.length, 'still lying there');
  tick(1500);
  assert.equal(room.loot.list.length, 0);
  const took = b.last('took');
  assert.equal(took.by, 0, 'by itself');
  assert.deepEqual(took.got.map((g) => g.id).sort(), [...lying].sort());
  for (const g of took.got) assert.deepEqual(g.to, [a.pid]);
  // Gone for someone no longer here: told, for everyone to see it go, but nobody gets it.
  room.loot.add([{ k: 'coin', n: 1 }], [{ x: 40.5, y: 11, z: 40.5 }], [99], time.t);
  tick(LOOT_LIFE_MS + 200);
  assert.deepEqual(b.last('took').got[0].to, []);
});

test('a boss drops a fountain for everyone on the island, flying to them all in a moment; a stage won sends the rest after it', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '424242', adventure: true, shared: true, stage: 3, seed: 5, now: () => time.t });
  const adv = room.adventure;
  const a = join(room);
  const b = join(room, 'Brave Otter');
  room.players.get(a.pid).safeUntil = Infinity;
  // Something left lying from before, b's alone.
  const [old] = room.loot.add([{ k: 'coin', n: 1 }], [{ x: adv.castle.x, y: adv.castle.y, z: adv.castle.z }], [b.pid], time.t);
  const king = room.monsters.add(room.world, adv.castle.x, adv.castle.y, adv.castle.z, { camp: adv.castle.id, kind: adv.boss });
  room.winAdventure(room.players.get(a.pid), king);
  const pop = b.all('pop').find((m) => m.id === king.id);
  assert.ok(pop.loot.length >= 8, `a fountain: ${pop.loot.length}`);
  const fountain = pop.loot.map(unpackLoot);
  assert.equal(coinsIn(fountain), bossCoins(adv.story.level));
  assert.ok(fountain.some((d) => d.k === 'potion'));
  for (const d of fountain) assert.deepEqual(room.loot.get(d.id).to.sort(), [a.pid, b.pid].sort(), 'for everyone');
  // In a moment, every bit of it flies to them, and what b had lying with it.
  for (let t = 0; t < BOSS_LOOT_MS + 300; t += 100) {
    time.t += 100;
    room.tick();
  }
  assert.equal(room.loot.list.length, 0);
  const got = b.all('took').flatMap((m) => m.got);
  assert.ok(got.some((g) => g.id === old.id));
  for (const d of fountain) assert.ok(got.some((g) => g.id === d.id && g.to.includes(a.pid) && g.to.includes(b.pid)));
});

test('on a tower defense island a monster popped by a friend drops loot and shows its bricks; one popped by a tower only its bricks', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '515151', theme: 'sunny', size: 'small', seed: 11, defense: true, now: () => time.t });
  const a = join(room);
  const def = room.defense;
  room.defendOp(null, room.players.get(a.pid), { t: 'defend', cmd: 'start' });
  // Out of the gate, the first: popped by a.
  let m = null;
  for (let t = 0; t < 20000 && !m; t += 100) {
    time.t += 100;
    room.tick();
    m = room.monsters.list.find((o) => o.march);
  }
  assert.ok(m, 'one marching');
  const before = def.bricks;
  for (let i = 0; i < 20 && room.monsters.get(m.id); i++) {
    time.t += HIT_MS;
    stand(room, a, m.body.x + 1, m.body.z, m.body.y);
    room.receive(a, { t: 'bop', id: m.id });
  }
  const pop = a.all('pop').find((p) => p.id === m.id);
  assert.ok(pop.bricks > 0 && def.bricks === before + pop.bricks, 'the bricks it was worth');
  assert.ok(pop.loot.length >= 1, 'and loot');
  // One popped by a tower: its bricks, no loot (nobody popped it).
  def.popped(room.monsters.add(room.world, 5, 11, 5, { kind: 'blob', march: def.route }), room.monsters);
  const tower = { t: 'pop', monster: { id: 999, body: { x: 1, y: 2, z: 3 } }, bricks: 2 };
  room.defense.step = () => [tower];
  room.defense.state = 'march';
  room.stepDefense(time.t);
  const told = a.all('pop').find((p) => p.id === 999);
  assert.equal(told.by, 0);
  assert.equal(told.bricks, 2);
  assert.equal(told.loot, undefined);
});

test('in the Land of Nod a fright popped drops its loot on the ground of its body, and it is picked up there', () => {
  const time = { t: 1_000_000 };
  const stage = firstStage(6);
  const room = new Room({ code: '717171', adventure: true, shared: true, stage, seed: 9, now: () => time.t });
  const { dream } = room.adventure;
  const a = join(room);
  const n = dream.list[0];
  // On the first nightmare's body, the first of its frights popped.
  for (let t = 0; t < 6000 && !dream.frights.of('n1').length; t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [n.at.x, n.at.y, n.at.z, 0, 0, 0] });
    room.tick();
  }
  const f = dream.frights.of('n1')[0];
  assert.ok(f, 'out it comes');
  for (let i = 0; i < 60 && dream.frights.get(f.id); i++) {
    if (f.spec.guard !== 'none' && !f.open) dream.frights.opens(f, 'stun', time.t);
    f.immune = 0;
    time.t += 450;
    room.receive(a, { t: 'm', s: [f.x, f.y, f.z, 0, 0, 0] });
    room.receive(a, { t: 'nod', op: 'bop', ids: [f.id] });
    room.tick();
  }
  const pop = a.all('nx').find((m) => m.k === 'pop' && m.f === f.id);
  assert.ok(pop, 'popped');
  assert.ok(pop.loot.length >= 1);
  for (const d of pop.loot.map(unpackLoot)) {
    const body = dream.space.bodyAt(d.x, d.y, d.z);
    assert.ok(Math.abs(body.ground(d.x, d.y, d.z)) < 0.05, 'on the ground of a body');
  }
  // Walked up to, picked up.
  const [d] = room.loot.list;
  room.receive(a, { t: 'm', s: [d.x, d.y, d.z, 0, 0, 0] });
  room.receive(a, { t: 'loot', ids: [d.id] });
  assert.equal(a.last('took').got[0].id, d.id);
});

test('a duel with a weapon’s soul drops nothing', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '818181', soul: 'star', seed: 3, now: () => time.t });
  const a = join(room);
  assert.equal(room.dropLoot('blob', { x: 1, y: 1, z: 1 }, room.players.get(a.pid), time.t), null);
  assert.deepEqual(a.last('welcome').loot, []);
});

test('picking up what monsters drop is counted, with stickers for it', () => {
  assert.ok(STAT_KEYS.includes('loot'));
  const keys = STICKERS.filter((s) => s.of === 'loot').map((s) => s.key);
  assert.deepEqual(keys, ['finders-keepers', 'treasure-magnet']);
  assert.ok(STICKERS.find((s) => s.key === 'finders-keepers').test({ loot: 25 }));
  assert.ok(!STICKERS.find((s) => s.key === 'finders-keepers').test({ loot: 24 }));
});
