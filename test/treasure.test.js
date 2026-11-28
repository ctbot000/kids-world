// Treasure chests on Adventure Isle: the chest blocks (island-only, out of
// the toy box), the island putting them down about the isle (out of the
// camps, away from the start and each other), opening one for whoever has a
// key and stands by it (the first of two at once), the open one going a
// while after and another turning up later, and what is inside. And the fake
// golden chest among them: a Golden Mimic shut up as one, found out by
// whoever comes up beside it or tries a golden key in it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdventureSim, grownHearts } from '../public/js/shared/adventure.js';
import { BEASTS } from '../public/js/shared/beasts.js';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { CHAPTERS } from '../public/js/shared/isle-story.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { lootOf } from '../public/js/shared/loot.js';
import { SAFE_RADIUS, unpackMonster } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { validCells } from '../public/js/shared/tools.js';
import { CHEST_AGAIN_MS, CHEST_OPEN_MS, CHEST_REACH, chestCount, chestNear, Chests, chestTreasure, FAKE_NEAR, FRONT_YAW, isChest, isGoldChest, isOpenChest } from '../public/js/shared/treasure.js';
import { World } from '../public/js/shared/world.js';

// Flat ground at y = 5 (standing at 6).
function flat(W = 96, D = 96) {
  const w = new World({ W, H: 32, D, sea: 2 });
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 0; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
  w.spawn = { x: 48, y: 6, z: 48 };
  return w;
}

const chestsIn = (w) => {
  const out = [];
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 1; y < w.H; y++) if (isChest(w.get(x, y, z)) || isOpenChest(w.get(x, y, z))) out.push({ x, y, z, id: w.get(x, y, z) });
  return out;
};

function join(room, name) {
  const c = { inbox: [], send: (t) => c.inbox.push(JSON.parse(t)), close: () => {} };
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat' } });
  c.pid = c.inbox.find((m) => m.t === 'welcome').you;
  return c;
}

// Stands a player at (x, z), on the ground.
function standAt(room, c, x, y, z) {
  room.players.get(c.pid).s = [x, y, z, 0, 0, 0];
}

test('treasure chests are island-only furniture, shut and open, facing every way, out of the toy box', () => {
  for (const base of [B.CHEST, B.CHEST_OPEN, B.GOLD_CHEST, B.GOLD_CHEST_OPEN]) {
    for (let k = 0; k < 4; k++) {
      const d = B.BLOCKS[base + k];
      assert.equal(d.kind, 'furniture');
      assert.ok(d.islandOnly, 'nobody puts one down or picks one up');
      assert.equal(d.category, null, 'not in the toy box');
      assert.ok(modelBoxes(base + k).length > 4, 'drawn as a chest');
    }
  }
  assert.ok(isChest(B.CHEST + 2) && !isChest(B.CHEST_OPEN) && isOpenChest(B.CHEST_OPEN + 3));
  assert.ok(isChest(B.GOLD_CHEST + 1) && isOpenChest(B.GOLD_CHEST_OPEN + 2) && isGoldChest(B.GOLD_CHEST) && isGoldChest(B.GOLD_CHEST_OPEN) && !isGoldChest(B.CHEST));
  for (const tab of B.CATEGORIES) assert.ok(!B.blocksIn(tab.key).some((id) => isChest(id) || isOpenChest(id)));
  const w = flat();
  assert.equal(validCells(w, [10, 6, 10, B.CHEST]), null);
  w.set(20, 6, 20, B.CHEST + 1);
  assert.deepEqual(chestNear(w, { x: 20.5, y: 6, z: 18.8 }), { x: 20, y: 6, z: 20, open: false, gold: false, key: chestNear(w, { x: 20.5, y: 6, z: 18.8 }).key });
  w.set(20, 6, 20, B.CHEST_OPEN + 1);
  assert.equal(chestNear(w, { x: 20.5, y: 6, z: 18.8 }).open, true);
  assert.equal(chestNear(w, { x: 30.5, y: 6, z: 30.5 }), null);
});

test('the island puts its chests about on open ground, out of the camps, away from the start and each other', () => {
  assert.deepEqual([1, 2, 3, 5, 9, 50].map(chestCount), [4, 4, 5, 6, 8, 8]);
  const w = flat();
  const camp = { id: 1, kind: 'camp', x: 70.5, y: 6, z: 70.5, r: 7 };
  const castle = { id: 2, kind: 'castle', x: 22.5, y: 6, z: 70.5, r: 10 };
  const chests = new Chests(7);
  const cells = chests.step(w, 1000, { stage: 3, camps: [camp, castle] });
  assert.equal(cells.length, 5, 'all at once at first');
  const found = chestsIn(w);
  assert.equal(found.length, 5);
  for (const c of found) {
    assert.ok(isChest(c.id), 'locked');
    assert.equal(c.y, 6, 'on the ground');
    assert.ok(Math.hypot(c.x + 0.5 - camp.x, c.z + 0.5 - camp.z) > camp.r + 3, 'out of the camp');
    assert.ok(Math.max(Math.abs(c.x + 0.5 - castle.x), Math.abs(c.z + 0.5 - castle.z)) > castle.r + 3, 'out of the castle');
    assert.ok(Math.hypot(c.x + 0.5 - w.spawn.x, c.z + 0.5 - w.spawn.z) >= 8, 'away from the start');
    for (const o of found) if (o !== c) assert.ok(Math.hypot(o.x - c.x, o.z - c.z) >= 8, 'away from each other');
  }
  assert.equal(found.filter((c) => isGoldChest(c.id)).length, 1, 'one of them golden');
  assert.deepEqual(chests.step(w, 2000, { stage: 3 }), [], 'nothing more while all are there');
});

test('a chest opened stays open a while, then goes, and another turns up later somewhere else', () => {
  const w = flat();
  const chests = new Chests(3);
  let now = 1_000_000;
  chests.step(w, now);
  const [c] = chestsIn(w);
  assert.equal(chests.open(w, c.x, c.y + 1, c.z, now), null, 'no chest there');
  const cells = chests.open(w, c.x, c.y, c.z, now);
  assert.ok(isOpenChest(cells[3]));
  assert.equal(B.BLOCKS[cells[3]].front, B.BLOCKS[c.id].front, 'facing the same way');
  assert.ok(isOpenChest(w.get(c.x, c.y, c.z)));
  assert.equal(chests.open(w, c.x, c.y, c.z, now), null, 'open already');
  assert.deepEqual(chests.step(w, now + CHEST_OPEN_MS - 1), [], 'open a while');
  now += CHEST_OPEN_MS;
  assert.deepEqual(chests.step(w, now), [[c.x, c.y, c.z, B.AIR]], 'then gone');
  assert.equal(chestsIn(w).length, 3);
  assert.deepEqual(chests.step(w, now + CHEST_AGAIN_MS[0] - 1), [], 'not straight back');
  const [back] = chests.step(w, now + CHEST_AGAIN_MS[1] + 1);
  assert.ok(isChest(back[3]), 'another later');
  assert.equal(chestsIn(w).length, 4);
});

test('on the shared isle the room opens a chest for whoever stands by it, the first of two, and tells everyone', () => {
  const room = new Room({ code: '123456', theme: 'sunny', size: 'small', seed: 11, adventure: true, shared: true, stage: 1 });
  room.tick?.(0.05);
  // (And a fake golden one, over and above the stage's own: see below.)
  const found = chestsIn(room.world);
  assert.equal(found.length, chestCount(1) + 1, 'chests about the isle');
  const where = (list) => list.map(({ x, y, z }) => [x, y, z].join()).sort();
  assert.deepEqual(where(room.adventure.chests.list), where(found));
  const [c] = found.filter((o) => !room.adventure.chests.fakeAt(o.x, o.y, o.z));
  const a = join(room, 'Sunny Otter');
  const b = join(room, 'Happy Panda');
  // Too far off: nothing happens.
  standAt(room, a, c.x + 6.5, c.y, c.z + 0.5);
  room.receive(a, { t: 'chest', at: [c.x, c.y, c.z] });
  assert.ok(isChest(room.world.get(c.x, c.y, c.z)));
  // Beside it, both at once: the first opens it.
  standAt(room, a, c.x + 1.5, c.y, c.z + 0.5);
  standAt(room, b, c.x - 0.5, c.y, c.z + 0.5);
  room.receive(b, { t: 'chest', at: [c.x, c.y, c.z] });
  room.receive(a, { t: 'chest', at: [c.x, c.y, c.z] });
  assert.ok(isOpenChest(room.world.get(c.x, c.y, c.z)));
  for (const who of [a, b]) {
    assert.deepEqual(
      who.inbox.filter((m) => m.t === 'chest'),
      [{ t: 'chest', x: c.x, y: c.y, z: c.z, by: b.pid }],
      'one opening, by the first',
    );
    const told = who.inbox.findIndex((m) => m.t === 'chest');
    const opened = who.inbox.findIndex((m) => m.t === 'edit' && m.cells.join() === [c.x, c.y, c.z, room.world.get(c.x, c.y, c.z)].join());
    assert.ok(told >= 0 && told < opened, 'who opened it told before it shows open');
    assert.ok(who.inbox.some((m) => m.t === 'edit' && m.cells.join() === [c.x, c.y, c.z, room.world.get(c.x, c.y, c.z)].join()));
  }
  // Nobody picks one up.
  room.receive(a, { t: 'edit', seq: 3, kind: 'pick', cells: [found[1].x, found[1].y, found[1].z, B.AIR] });
  assert.ok(isChest(room.world.get(found[1].x, found[1].y, found[1].z)));
});

test('a fake golden chest lies among the chests when asked for, after the rest and from randomness of its own, so the rest lie just where they did', () => {
  const camp = { id: 1, kind: 'camp', x: 70.5, y: 6, z: 70.5, r: 7 };
  const plain = flat();
  new Chests(7).step(plain, 1000, { stage: 3, camps: [camp] });
  const w = flat();
  const chests = new Chests(7);
  const cells = chests.step(w, 1000, { stage: 3, camps: [camp], fakes: true });
  assert.equal(cells.length, chestCount(3) + 1, 'all at once, and one more');
  const fake = chests.list.find((c) => c.fake);
  const id = w.get(fake.x, fake.y, fake.z);
  assert.ok(isChest(id) && isGoldChest(id), 'a golden chest’s own block: no page can tell');
  assert.deepEqual(chests.list.at(-1), fake, 'the last put down');
  // The others just where they would be with none.
  const others = chestsIn(w).filter((c) => c.x !== fake.x || c.z !== fake.z);
  assert.deepEqual(others, chestsIn(plain));
  assert.equal(others.filter((c) => isGoldChest(c.id)).length, 1, 'the real golden one still there');
  assert.ok(Math.hypot(fake.x + 0.5 - w.spawn.x, fake.z + 0.5 - w.spawn.z) > SAFE_RADIUS + 3, 'well off the start, where no monster goes');
  for (const o of others) assert.ok(Math.hypot(o.x - fake.x, o.z - fake.z) >= 8, 'away from the others');
  assert.ok(Math.hypot(fake.x + 0.5 - camp.x, fake.z + 0.5 - camp.z) > camp.r + 3, 'out of the camp');
  // No key opens it; the island knows it for what it is.
  assert.equal(chests.open(w, fake.x, fake.y, fake.z, 2000), null);
  assert.ok(isChest(w.get(fake.x, fake.y, fake.z)));
  assert.equal(chests.fakeAt(fake.x, fake.y, fake.z), fake);
  const real = chests.list.find((c) => c.gold && !c.fake);
  assert.equal(chests.fakeAt(real.x, real.y, real.z), null);
  assert.deepEqual(chests.step(w, 2000, { stage: 3, camps: [camp], fakes: true }), [], 'only the one');
});

test('a fake one wakes for whoever comes up beside it; found out, the next comes only once that one is gone, and a while after', () => {
  const w = flat();
  const chests = new Chests(5);
  let now = 1_000_000;
  chests.step(w, now, { fakes: true });
  const fake = chests.list.find((c) => c.fake);
  const at = (dx, more = {}) => ({ id: 1, x: fake.x + 0.5 + dx, y: fake.y, z: fake.z + 0.5, ...more });
  assert.deepEqual(chests.fakesWoken([at(FAKE_NEAR + 0.3)]), [], 'a step too far');
  assert.ok(FAKE_NEAR > 2.2, 'woken before the 🔒 button would show (chestNear)');
  assert.deepEqual(chests.fakesWoken([at(FAKE_NEAR - 0.5, { riding: true }), at(1, { dizzy: true }), at(1, { y: fake.y + 4 })]), [], 'not riding, dizzy, nor far over it');
  const near = at(1.2, { id: 2 });
  assert.deepEqual(chests.fakesWoken([at(2.5), near]), [{ chest: fake, person: near }], 'the nearest of them');
  // Found out: no chest there now, facing as it was.
  const front = B.BLOCKS[w.get(fake.x, fake.y, fake.z)].front;
  assert.deepEqual(chests.unmask(w, fake), { cells: [fake.x, fake.y, fake.z, B.AIR], yaw: FRONT_YAW[front] });
  assert.equal(w.get(fake.x, fake.y, fake.z), B.AIR);
  assert.ok(!chests.list.includes(fake));
  // While it is about, none more; then one a while after.
  for (let t = 0; t < CHEST_AGAIN_MS[1] * 2; t += 1000) assert.deepEqual(chests.step(w, (now += 1000), { fakes: true, lurking: true }), []);
  assert.deepEqual(chests.step(w, (now += 1000), { fakes: true }), [], 'not straight away');
  const [back] = chests.step(w, now + CHEST_AGAIN_MS[1] + 1, { fakes: true });
  assert.ok(isGoldChest(back[3]));
  assert.ok(chests.fakeAt(back[0], back[1], back[2]), 'another fake one');
  // With the island free, any still shut goes.
  assert.deepEqual(chests.dropFakes(w), [[back[0], back[1], back[2], B.AIR]]);
  assert.equal(w.get(back[0], back[1], back[2]), B.AIR);
  assert.equal(chests.list.filter((c) => c.fake).length, 0);
  assert.deepEqual(chests.step(w, now + CHEST_AGAIN_MS[1] * 3), [], 'and none more when there are to be none');
});

test('there is a fake golden chest wherever monsters are about on the isle, but not on the Wild Isle, the Golden Bells, the Land of Nod or the Storybook', () => {
  for (const [i, ch] of CHAPTERS.entries()) {
    const adv = new AdventureSim({ stage: i + 1 });
    const episode = ch.episode ?? 1;
    assert.equal(adv.fakesHere, ![3, 4, 6, 7].includes(episode), `stage ${i + 1}, episode ${episode}`);
    assert.equal(new AdventureSim({ stage: i + 1, won: true }).fakesHere, false, 'nor once it is free');
  }
});

test('on the shared isle a fake golden chest turns into a Golden Mimic for whoever comes up beside it or tries a golden key in it, the key never spent', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'sunny', size: 'small', seed: 11, adventure: true, shared: true, stage: 1, now: () => time.t });
  const tick = (ms = 50) => {
    for (let t = 0; t < ms; t += 50) {
      time.t += 50;
      room.tick();
    }
  };
  tick();
  const adv = room.adventure;
  const fake = adv.chests.list.find((c) => c.fake);
  assert.ok(fake && isGoldChest(room.world.get(fake.x, fake.y, fake.z)), 'a golden chest, to look at');
  const front = B.BLOCKS[room.world.get(fake.x, fake.y, fake.z)].front;
  const a = join(room, 'Sunny Otter');
  const golden = () => room.monsters.list.filter((m) => m.kind === 'goldmimic');
  // A way off: a chest still.
  standAt(room, a, fake.x + 0.5 + FAKE_NEAR + 1, fake.y, fake.z + 0.5);
  tick(500);
  assert.ok(isChest(room.world.get(fake.x, fake.y, fake.z)));
  assert.equal(golden().length, 0);
  // Up beside it: a Golden Mimic where it stood, after them.
  a.inbox.length = 0;
  standAt(room, a, fake.x + 0.5 + FAKE_NEAR - 0.6, fake.y, fake.z + 0.5);
  tick();
  const [m] = golden();
  assert.ok(m, 'a Golden Mimic');
  assert.equal(room.world.get(fake.x, fake.y, fake.z), B.AIR, 'the chest gone');
  assert.equal(m.target, a.pid);
  assert.equal(m.max, grownHearts('goldmimic', adv.level, 1), 'as young on stage 1 as a champion');
  assert.ok(m.max < BEASTS.goldmimic.hearts);
  const iMon = a.inbox.findIndex((msg) => msg.t === 'mon' && msg.m.some((r) => r[0] === m.id));
  const iMimic = a.inbox.findIndex((msg) => msg.t === 'mimic');
  const iGone = a.inbox.findIndex((msg) => msg.t === 'edit' && msg.cells.join() === [fake.x, fake.y, fake.z, B.AIR].join());
  assert.ok(iMon >= 0 && iMon < iMimic && iMimic < iGone, `the monster there first, then the chest gone: ${iMon}, ${iMimic}, ${iGone}`);
  assert.deepEqual(a.inbox[iMimic], { t: 'mimic', id: m.id, x: fake.x, y: fake.y, z: fake.z, by: a.pid });
  const row = unpackMonster(a.inbox[iMon].m.find((r) => r[0] === m.id));
  assert.deepEqual([row.kind, row.x, row.y, row.z], ['goldmimic', fake.x + 0.5, fake.y, fake.z + 0.5], 'just where the chest was');
  assert.ok(Math.abs(row.yaw - FRONT_YAW[front]) < 0.01, 'facing as it did');
  assert.notEqual(row.state, 'idle', 'awake');
  assert.ok(!a.inbox.some((msg) => msg.t === 'chest'), 'nothing opened, so no key spent');
  // Popped, it pays as a golden chest would: a diamond, two jewels and its coins.
  const drops = lootOf('goldmimic', () => 0.5);
  assert.equal(drops.filter((d) => d.k === 'diamond').length, 1);
  assert.equal(drops.filter((d) => ['ruby', 'sapphire', 'emerald', 'amethyst'].includes(d.k)).length, 2);
  room.monsters.remove(m.id);
  // Another a while after, somewhere else; this time tried with a key from
  // just past where it would wake.
  tick(CHEST_AGAIN_MS[1] + 1000);
  const next = adv.chests.list.find((c) => c.fake);
  assert.ok(next, 'another fake one');
  a.inbox.length = 0;
  standAt(room, a, next.x + 0.5, next.y, next.z + 0.5 - (FAKE_NEAR + CHEST_REACH) / 2);
  room.receive(a, { t: 'chest', at: [next.x, next.y, next.z] });
  assert.equal(golden().length, 1, 'a Golden Mimic again');
  assert.equal(room.world.get(next.x, next.y, next.z), B.AIR);
  assert.ok(a.inbox.some((msg) => msg.t === 'mimic') && !a.inbox.some((msg) => msg.t === 'chest'), 'and the key kept');
});

test('a stage won pops every Golden Mimic with the other monsters, and any fake golden chest still shut', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '424242', adventure: true, shared: true, stage: 3, seed: 5, now: () => time.t });
  time.t += 50;
  room.tick();
  const adv = room.adventure;
  const a = join(room, 'Sunny Otter');
  const fake = adv.chests.list.find((c) => c.fake);
  // One found out already, and another still shut (put there as one).
  const sprung = adv.springFake(room.world, fake, { id: a.pid }, room.monsters, 1);
  assert.equal(sprung.monster.kind, 'goldmimic');
  const other = adv.chests.list.find((c) => !c.fake && !c.gold);
  other.fake = true;
  room.world.set(other.x, other.y, other.z, B.GOLD_CHEST);
  a.inbox.length = 0;
  const king = room.monsters.add(room.world, adv.castle.x, adv.castle.y, adv.castle.z, { camp: adv.castle.id, kind: adv.boss });
  room.winAdventure(room.players.get(a.pid), king);
  assert.ok(!room.monsters.list.some((m) => m.kind === 'goldmimic'), 'the Golden Mimic gone');
  assert.ok(a.inbox.some((m) => m.t === 'pop' && m.id === sprung.monster.id), 'with a pop');
  assert.ok(a.inbox.some((m) => m.t === 'pop' && m.id === 0 && m.x === other.x + 0.5 && m.z === other.z + 0.5), 'and the shut one too, where it stood');
  assert.equal(room.world.get(other.x, other.y, other.z), B.AIR);
  assert.ok(a.inbox.some((m) => m.t === 'edit' && m.cells.join() === [other.x, other.y, other.z, B.AIR].join()));
  assert.equal(adv.chests.list.filter((c) => c.fake).length, 0);
  // And no more of them now the island is free.
  for (let t = 0; t < CHEST_AGAIN_MS[1] * 2; t += 1000) {
    time.t += 1000;
    room.tick();
  }
  assert.equal(adv.chests.list.filter((c) => c.fake).length, 0);
});

test('a chest holds coins, more on higher stages, and now and then an HP potion; opening them earns a sticker', () => {
  assert.deepEqual(chestTreasure(() => 0, 1), { coins: 7, potion: true, diamond: false });
  assert.deepEqual(chestTreasure(() => 0.99, 1), { coins: 12, potion: false, diamond: false });
  assert.deepEqual(chestTreasure(() => 0.99, 1, true), { coins: 48, potion: true, diamond: true }, 'a golden chest: four times the coins, a potion and a diamond');
  assert.ok(chestTreasure(() => 0.5, 5).coins > chestTreasure(() => 0.5, 1).coins);
  assert.equal(chestTreasure(() => 0.5, 50).coins, chestTreasure(() => 0.5, 10).coins, 'up to a limit');
  assert.ok(STAT_KEYS.includes('chests') && STAT_KEYS.includes('keys'));
  assert.ok(XP_FOR.chests.xp > 0);
  const sticker = STICKERS.find((s) => s.key === 'chest-hunter');
  assert.equal(STICKERS.filter((s) => s.key === sticker.key).length, 1);
  assert.ok(!sticker.test({ chests: 9 }) && sticker.test({ chests: 10 }));
  // The 👑 legendary tier above it, on the same count.
  const great = STICKERS[STICKERS.indexOf(sticker) + 1];
  assert.equal(great.key, 'great-thief');
  assert.equal(great.of, 'chests');
  assert.ok(!great.test({ chests: 999 }) && great.test({ chests: 1000 }));
  assert.ok(sticker.test({ chests: 1000 }), 'the same count, not a fresh one');
});

test('keys are kept at the keeper with the rest of what you carry, from whichever device changed them last', () => {
  assert.equal(keptProfile({ keys: 3 }).keys, 3);
  assert.equal(keptProfile({ keys: -1 }).keys, 0);
  assert.equal(keptProfile({ keys: 5000 }).keys, 99);
  assert.equal(keptProfile({ keys: 1.5 }).keys, 0);
  const older = { name: 'Keen Owl', keys: 4, changedAt: 100 };
  const newer = { name: 'Keen Owl', keys: 1, changedAt: 200 };
  assert.equal(mergeProfiles(older, newer).keys, 1);
  assert.equal(mergeProfiles(newer, older).keys, 1);
  assert.equal(addProgress({ keys: 2 }, { keys: 3 }).keys, 5);
  // Golden keys too, apart from the others.
  assert.equal(keptProfile({ gkeys: 2 }).gkeys, 2);
  assert.equal(keptProfile({ keys: 2 }).gkeys, 0);
  assert.equal(mergeProfiles({ name: 'Keen Owl', gkeys: 4, changedAt: 100 }, { name: 'Keen Owl', gkeys: 1, changedAt: 200 }).gkeys, 1);
  assert.equal(addProgress({ gkeys: 1 }, { gkeys: 2 }).gkeys, 3);
});
