// The Monster Gashapon and the tougher monsters of the adventure islands'
// higher stages: the figures (the real monsters, rarer ones likelier the
// higher the stage), the machine (out of the toy box, nobody's to put down,
// pick up or build over), the island putting it down now and then near
// someone and taking it away again (and never keeping it), a turn of it
// through your profile with its stickers; and the Grumble Knight and the
// Stone Golem, tougher than a Big Bruiser, among a camp's guards more and
// more from stage 2 on.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdventureSim, toughGuards } from '../public/js/shared/adventure.js';
import * as B from '../public/js/shared/blocks.js';
import { ALL_TOYS, cleanToys, drawToy, gashaponNear, isGashapon, isMonsterGashapon, MONSTER_FIGURES, MONSTER_GASHA, MONSTER_PRICE, rarityOdds, TOYS, toysFound } from '../public/js/shared/gashapon.js';
import { bodyOf, isHeavy, kindOf, MONSTER_KINDS, MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { validCells } from '../public/js/shared/tools.js';
import { World } from '../public/js/shared/world.js';

// Flat ground at y = 5 (standing at 6).
function flat(W = 64, D = 64) {
  const w = new World({ W, H: 32, D, sea: 2 });
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
  w.spawn = { x: 32, y: 6, z: 32 };
  return w;
}

test('the monster figures are the island’s own monsters, five common, three rare and two super rare', () => {
  assert.equal(MONSTER_FIGURES.length, 10);
  assert.deepEqual([0, 1, 2].map((r) => MONSTER_FIGURES.filter((f) => f.rare === r).length), [5, 3, 2]);
  for (const f of MONSTER_FIGURES) {
    assert.ok(MONSTER_KINDS.includes(f.monster), `${f.key} is a real monster`);
    assert.ok(f.key.startsWith('m-'));
  }
  assert.equal(new Set(ALL_TOYS.map((t) => t.key)).size, TOYS.length + MONSTER_FIGURES.length, 'no key twice');
  assert.deepEqual(cleanToys({ 'm-king': 1, 'm-nope': 2, dino: 1 }), { dino: 1, 'm-king': 1 }, 'kept with the toys');
  assert.equal(toysFound({ 'm-king': 1, dino: 1 }), 1, 'the capsule toys counted apart');
  assert.equal(toysFound({ 'm-king': 1, dino: 1 }, MONSTER_FIGURES), 1);
  // Only monster figures out of the Monster Gashapon.
  for (let i = 0; i < 200; i++) assert.ok(drawToy(() => (i + 0.5) / 200, { list: MONSTER_FIGURES }).toy.key.startsWith('m-'));
});

test('the higher the stage, the likelier a rare monster figure, up to a limit', () => {
  const at = (stage) => rarityOdds(MONSTER_FIGURES, stage);
  for (const odds of [at(1), at(5), at(50)]) assert.ok(Math.abs(odds[0] + odds[1] + odds[2] - 1) < 1e-9);
  let last = at(1);
  for (const stage of [2, 3, 5, 8, 12, 20]) {
    const now = at(stage);
    assert.ok(now[1] + now[2] > last[1] + last[2] && now[2] > last[2], `stage ${stage} better than before`);
    last = now;
  }
  assert.ok(at(1)[2] < 0.05, 'a super rare one is hard to get at first');
  assert.ok(at(15)[2] > 0.12, 'and much likelier high up');
  assert.deepEqual(at(100), at(9999), 'as good as it gets past a while');
  // The capsule toys are the same on any stage when drawn without one.
  assert.deepEqual(rarityOdds(TOYS), rarityOdds(TOYS, 1));
  // Walking rand over a turn at stage 8, a super rare one comes out its share.
  const N = 4000;
  let supers = 0;
  for (let i = 0; i < N; i++) if (drawToy(() => (i + 0.5) / N, { list: MONSTER_FIGURES, stage: 8 }).toy.rare === 2) supers++;
  assert.ok(Math.abs(supers / N - at(8)[2]) < 0.01);
});

test('the Monster Gashapon is a gashapon nobody but the island puts down, picks up or builds over', () => {
  const d = B.BLOCKS[B.MONSTER_GASHAPON];
  assert.equal(d.kind, 'furniture');
  assert.equal(d.category, null, 'not in the toy box');
  for (const tab of B.CATEGORIES) assert.ok(!B.blocksIn(tab.key).includes(B.MONSTER_GASHAPON));
  assert.ok(d.islandOnly && d.real === 'monster-gashapon');
  for (let k = 0; k < 4; k++) assert.ok(isGashapon(B.MONSTER_GASHAPON + k) && isMonsterGashapon(B.MONSTER_GASHAPON + k));
  assert.ok(!isMonsterGashapon(B.GASHAPON));
  const w = flat();
  w.set(20, 6, 20, B.MONSTER_GASHAPON);
  assert.equal(gashaponNear(w, { x: 20.5, y: 6, z: 18.8 }).monster, true);
  w.set(24, 6, 20, B.GASHAPON);
  assert.equal(gashaponNear(w, { x: 24.5, y: 6, z: 18.8 }).monster, false);
  assert.equal(validCells(w, [21, 6, 20, B.MONSTER_GASHAPON]), null, 'nobody puts one down');
});

test('a player picking up the Monster Gashapon, or building over it, gets it put back', () => {
  const room = new Room({ code: '123456', theme: 'flat', size: 'small', seed: 3 });
  const c = { inbox: [], send: (t) => c.inbox.push(JSON.parse(t)), close: () => {} };
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' } });
  const s = room.world.spawn;
  const x = Math.floor(s.x) + 3;
  const z = Math.floor(s.z);
  const y = room.world.top(x, z) + 1;
  room.natureCell([x, y, z], B.MONSTER_GASHAPON);
  room.receive(c, { t: 'edit', seq: 7, kind: 'pick', cells: [x, y, z, B.AIR] });
  assert.equal(room.world.get(x, y, z), B.MONSTER_GASHAPON, 'still there');
  const ack = c.inbox.findLast((m) => m.t === 'ack' && m.seq === 7);
  assert.deepEqual(ack.fix, [x, y, z, B.MONSTER_GASHAPON], 'and put back on the picker’s screen');
});

test('on an adventure island the Monster Gashapon turns up near someone a while after they come, and goes after a while', () => {
  const w = flat();
  const adv = new AdventureSim({ camps: [{ id: 1, kind: 'camp', x: 50.5, y: 6, z: 50.5, r: 7 }] }, 9);
  const me = [{ id: 1, x: 20.5, y: 6, z: 20.5 }];
  let now = 1_000_000;
  assert.deepEqual(adv.stepGasha(w, now, []), [], 'nobody about: nothing');
  assert.deepEqual(adv.stepGasha(w, now, me), [], 'not straight away');
  now += MONSTER_GASHA.first[0] - 1000;
  assert.deepEqual(adv.stepGasha(w, now, me), [], 'not yet');
  now += MONSTER_GASHA.first[1] - MONSTER_GASHA.first[0] + 2000;
  const [up] = adv.stepGasha(w, now, me);
  assert.equal(up.t, 'gasha');
  assert.ok(isMonsterGashapon(up.id));
  const d = Math.hypot(up.x + 0.5 - me[0].x, up.z + 0.5 - me[0].z);
  assert.ok(d >= MONSTER_GASHA.near[0] - 1 && d <= MONSTER_GASHA.near[1] + 1, 'a little way off');
  assert.equal(up.y, 6, 'on the ground');
  assert.ok(Math.hypot(up.x + 0.5 - 50.5, up.z + 0.5 - 50.5) > 9, 'never in a camp to free');
  // It faces whoever it turned up for.
  const f = B.BLOCKS[up.id].front;
  const dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][f];
  assert.ok(dir[0] * (me[0].x - up.x - 0.5) + dir[1] * (me[0].z - up.z - 0.5) > 0);
  w.set(up.x, up.y, up.z, up.id);
  assert.deepEqual(adv.stepGasha(w, now + MONSTER_GASHA.stay - 1000, me), [], 'still there a while');
  const [gone] = adv.stepGasha(w, now + MONSTER_GASHA.stay + 1, me);
  assert.deepEqual(gone, { t: 'gasha-gone', x: up.x, y: up.y, z: up.z });
  w.set(up.x, up.y, up.z, B.AIR);
  now += MONSTER_GASHA.stay + 1;
  assert.deepEqual(adv.stepGasha(w, now + MONSTER_GASHA.again[0] - 1000, me), [], 'a while before the next');
  const [again] = adv.stepGasha(w, now + MONSTER_GASHA.again[1] + 1000, me);
  assert.equal(again?.t, 'gasha', 'and back again later');
});

test('the room puts the Monster Gashapon down and takes it away, telling everyone; an island put away keeps none', () => {
  const room = new Room({ code: '123456', theme: 'flat', size: 'small', seed: 5, adventure: true });
  const c = { inbox: [], send: (t) => c.inbox.push(JSON.parse(t)), close: () => {} };
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' } });
  const s = room.world.spawn;
  const at = { x: Math.floor(s.x) + 4, y: room.world.top(Math.floor(s.x) + 4, Math.floor(s.z)) + 1, z: Math.floor(s.z) };
  room.gashaNews({ t: 'gasha', ...at, id: B.MONSTER_GASHAPON });
  room.adventure.gasha = { ...at, until: Infinity };
  assert.ok(isMonsterGashapon(room.world.get(at.x, at.y, at.z)));
  assert.deepEqual(c.inbox.findLast((m) => m.t === 'gasha'), { t: 'gasha', ...at });
  // Saved with it there, it is gone when the island is opened again.
  const again = new Room({ save: JSON.parse(JSON.stringify(room.exportSave())) });
  assert.equal(again.world.get(at.x, at.y, at.z), B.AIR, 'not kept');
  room.gashaNews({ t: 'gasha-gone', ...at });
  assert.equal(room.world.get(at.x, at.y, at.z), B.AIR);
  assert.deepEqual(c.inbox.findLast((m) => m.t === 'gasha'), { t: 'gasha', ...at, gone: true });
});

test('a turn of the Monster Gashapon costs more, gives a monster figure and its stickers', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    const earned = [];
    p.addEventListener('sticker', (e) => earned.push(e.detail.key));
    p.earn(MONSTER_PRICE - 1);
    assert.equal(p.turnGashapon(Math.random, { monster: true }), null, 'not enough coins');
    p.earn(1 + MONSTER_PRICE * 60);
    const got = p.turnGashapon(() => 0, { monster: true, stage: 4 });
    assert.equal(got.toy.key, MONSTER_FIGURES[0].key);
    assert.equal(p.data.coins, MONSTER_PRICE * 60);
    assert.equal(p.data.stats.monsterfigs, 1);
    assert.equal(p.data.stats.capsules ?? 0, 0, 'not a capsule toy');
    assert.ok(earned.includes('monster-figure'));
    for (let i = 0; i < 40 && toysFound(p.data.gear.toys, MONSTER_FIGURES) < MONSTER_FIGURES.length; i++) {
      for (const f of MONSTER_FIGURES) if (!p.data.gear.toys[f.key]) p.data.gear.toys[f.key] = 1;
      p.turnGashapon(() => 0.5, { monster: true });
    }
    assert.ok(earned.includes('monster-collector'), 'every figure');
    for (const k of ['monsterfigs', 'monstertoys']) assert.ok(STAT_KEYS.includes(k));
    assert.ok(STICKERS.some((s) => s.key === 'monster-collector'));
  } finally {
    delete globalThis.localStorage;
  }
});

test('every monster figure is the real monster, about a unit tall, standing on the ground', async () => {
  const THREE = await import('../public/vendor/three.module.js');
  const { toyFigure } = await import('../public/js/render/capsule-toys.js');
  const { shownBox } = await import('../public/js/render/monster-figures.js');
  for (const f of MONSTER_FIGURES) {
    const fig = toyFigure(f.key, () => new THREE.MeshPhysicalMaterial());
    assert.ok(fig, f.key);
    const box = shownBox(fig);
    assert.ok(Math.abs(box.min.y) < 0.02, `${f.key} on the ground`);
    assert.ok(box.max.y > 0.6 && box.max.y < 1, `${f.key} about a unit tall`);
  }
});

test('the Grumble Knight and the Stone Golem are tougher than a Big Bruiser, and keep the camps of the higher stages', () => {
  for (const k of ['knight', 'golem']) {
    assert.ok(MONSTER_KINDS.includes(k));
    assert.ok(kindOf(k).hearts > kindOf('big').hearts, `${k} has more hearts`);
    assert.ok(kindOf(k).bump >= kindOf('big').bump, `${k} bumps as hard or harder`);
    assert.ok(kindOf(k).cross.run < 7, `${k} is never as quick as you run`);
  }
  assert.ok(kindOf('golem').bump > kindOf('big').bump && bodyOf('golem').height > bodyOf('big').height);
  assert.ok(isHeavy('golem') && !isHeavy('knight'));
  assert.deepEqual(toughGuards(1), [], 'stage 1 as before');
  assert.deepEqual(toughGuards(3), ['knight', 'spiky']);
  assert.deepEqual(toughGuards(5), ['golem', 'knight', 'big', 'spiky']);
  assert.ok(toughGuards(20).length > toughGuards(5).length);
  // A camp of stage 5 wakes with its mosquito and the tough ones first. Being
  // the only camp, it is the deepest, so the Queen Mosquito guards it too.
  const w = flat();
  const camp = { id: 1, kind: 'camp', x: 30.5, y: 6, z: 30.5, r: 7 };
  for (const [stage, want] of [[1, []], [5, ['golem', 'knight', 'big', 'spiky']]]) {
    const adv = new AdventureSim({ camps: [camp], stage }, 3);
    const monsters = new MonsterSim(3);
    const c = adv.camps[0];
    adv.wake(w, c, [{ id: 1, x: 10.5, y: 6, z: 10.5 }], monsters, 4);
    const kinds = monsters.list.map((m) => m.kind);
    assert.equal(kinds[0], 'mosquito');
    for (const k of want) assert.ok(kinds.includes(k), `stage ${stage} has a ${k}`);
    assert.ok(kinds.includes('queen'), `stage ${stage}: the queen guards the deepest camp`);
    if (!want.length) assert.ok(kinds.slice(1).every((k) => k === 'blob' || k === 'queen'), 'stage 1: blobs otherwise');
  }
});
