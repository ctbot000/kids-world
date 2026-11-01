// Treasure chests on Adventure Isle: the chest blocks (island-only, out of
// the toy box), the island putting them down about the isle (out of the
// camps, away from the start and each other), opening one for whoever has a
// key and stands by it (the first of two at once), the open one going a
// while after and another turning up later, none kept when the island is
// put away, and what is inside.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdventureSim } from '../public/js/shared/adventure.js';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { validCells } from '../public/js/shared/tools.js';
import { CHEST_AGAIN_MS, CHEST_OPEN_MS, chestCount, chestNear, Chests, chestTreasure, isChest, isOpenChest } from '../public/js/shared/treasure.js';
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
  for (const base of [B.CHEST, B.CHEST_OPEN]) {
    for (let k = 0; k < 4; k++) {
      const d = B.BLOCKS[base + k];
      assert.equal(d.kind, 'furniture');
      assert.ok(d.islandOnly, 'nobody puts one down or picks one up');
      assert.equal(d.category, null, 'not in the toy box');
      assert.ok(modelBoxes(base + k).length > 4, 'drawn as a chest');
    }
  }
  assert.ok(isChest(B.CHEST + 2) && !isChest(B.CHEST_OPEN) && isOpenChest(B.CHEST_OPEN + 3));
  for (const tab of B.CATEGORIES) assert.ok(!B.blocksIn(tab.key).some((id) => isChest(id) || isOpenChest(id)));
  const w = flat();
  assert.equal(validCells(w, [10, 6, 10, B.CHEST]), null);
  w.set(20, 6, 20, B.CHEST + 1);
  assert.deepEqual(chestNear(w, { x: 20.5, y: 6, z: 18.8 }), { x: 20, y: 6, z: 20, open: false, key: chestNear(w, { x: 20.5, y: 6, z: 18.8 }).key });
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
  const found = chestsIn(room.world);
  assert.equal(found.length, chestCount(1), 'chests about the isle');
  const where = (list) => list.map(({ x, y, z }) => [x, y, z].join()).sort();
  assert.deepEqual(where(room.adventure.chests.list), where(found));
  const [c] = found;
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
    assert.ok(who.inbox.some((m) => m.t === 'edit' && m.cells.join() === [c.x, c.y, c.z, room.world.get(c.x, c.y, c.z)].join()));
  }
  // Nobody picks one up.
  room.receive(a, { t: 'edit', seq: 3, kind: 'pick', cells: [found[1].x, found[1].y, found[1].z, B.AIR] });
  assert.ok(isChest(room.world.get(found[1].x, found[1].y, found[1].z)));
  // Put away and opened again, its chests are new ones.
  const again = new Room({ save: JSON.parse(JSON.stringify(room.exportSave())), shared: true });
  assert.equal(chestsIn(again.world).length, 0, 'none kept');
});

test('no chests on any adventure island but the shared isle', () => {
  const room = new Room({ code: '123456', theme: 'sunny', size: 'small', seed: 11, adventure: true });
  room.tick?.(0.05);
  assert.equal(chestsIn(room.world).length, 0);
  const adv = new AdventureSim({ camps: [] }, 1);
  assert.equal(adv.chests.list.length, 0);
});

test('a chest holds coins, more on higher stages, and now and then an HP potion; opening them earns a sticker', () => {
  assert.deepEqual(chestTreasure(() => 0, 1), { coins: 7, potion: true });
  assert.deepEqual(chestTreasure(() => 0.99, 1), { coins: 12, potion: false });
  assert.ok(chestTreasure(() => 0.5, 5).coins > chestTreasure(() => 0.5, 1).coins);
  assert.equal(chestTreasure(() => 0.5, 50).coins, chestTreasure(() => 0.5, 10).coins, 'up to a limit');
  assert.ok(STAT_KEYS.includes('chests') && STAT_KEYS.includes('keys'));
  assert.ok(XP_FOR.chests.xp > 0);
  const sticker = STICKERS.find((s) => s.key === 'chest-hunter');
  assert.equal(STICKERS.filter((s) => s.key === sticker.key).length, 1);
  assert.ok(!sticker.test({ chests: 9 }) && sticker.test({ chests: 10 }));
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
});
