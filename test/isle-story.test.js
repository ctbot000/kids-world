// Adventure Isle's story and its maps: every stage a chapter of "The Star
// of Adventure Isle", with a map drawn for it, its camps one after another
// along a way that a gate shuts between each camp and the next — freeing a
// camp opens the gate on to the next, so the isle is crossed like a real
// journey — and King Grumble's lair at the end.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { AdventureSim, CAMP_RADIUS } from '../public/js/shared/adventure.js';
import { CRITTER_INFO } from '../public/js/shared/critters.js';
import { buildIsle, ISLE_SIDE } from '../public/js/shared/isle-maps.js';
import { campName, CHAPTERS, chapterOf, introOf, SHARDS } from '../public/js/shared/isle-story.js';
import { kindOf, MONSTER_KINDS, MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { PublicAdventure } from '../server/adventure.js';

// ------------------------------------------------ the story

test('the story has a chapter for every Star Shard, each told in full', () => {
  assert.equal(CHAPTERS.length, SHARDS);
  assert.equal(new Set(CHAPTERS.map((c) => c.key)).size, SHARDS, 'each chapter its own map');
  for (const ch of CHAPTERS) {
    assert.ok(['sunny', 'snowy', 'candy', 'volcano'].includes(ch.theme), ch.key);
    assert.ok(ch.icon && ch.name && ch.lair && ch.intro && ch.won, ch.key);
    assert.equal(ch.camps.length, 3, `${ch.key}: three camps along the way`);
    assert.equal(ch.freed.length, ch.camps.length, `${ch.key}: a line for each camp freed`);
    ch.freed.forEach((line, i) => assert.ok(line.includes(ch.camps[i].replace(/^The /, '')), `${ch.key}: freeing ${ch.camps[i]} says so`));
    for (const kind of [...ch.guards, ch.minion]) assert.ok(MONSTER_KINDS.includes(kind), `${ch.key}: ${kind} is a monster`);
  }
  // The last chapter ends the story: King Grumble popped for good, the Star whole.
  assert.match(CHAPTERS.at(-1).won, /once and for all/);
});

test('each stage is a chapter, the story going round again after the last', () => {
  assert.deepEqual([1, 2, 7].map((s) => chapterOf(s).key), ['shore', 'woods', 'castle']);
  assert.deepEqual([chapterOf(1).n, chapterOf(1).round, chapterOf(1).shards], [1, 1, 1]);
  const again = chapterOf(8);
  assert.equal(again.key, 'shore');
  assert.equal(again.round, 2);
  assert.match(introOf(8), /^Round 2!/);
  assert.equal(introOf(1), CHAPTERS[0].intro);
  assert.equal(chapterOf(undefined).key, 'shore', 'no stage is stage 1');
  assert.equal(campName(2, 1), 'Mushroom Ring');
  assert.equal(campName(2, 4, 'castle'), 'Hollow Tree Hideout');
});

// ------------------------------------------------ the maps

// Where a body walking on foot could stand on the column (x, z) near height
// y: on something solid with room for it above, never in water or lava.
function walker(world) {
  const solid = (x, y, z) => B.SOLID[world.get(x, y, z)];
  const wet = (id) => id === B.WATER || id === B.LAVA;
  const standAt = (x, z, y) => {
    for (let yy = y + 1; yy >= y - 6; yy--) {
      if (yy < 1 || wet(world.get(x, yy, z))) return null;
      if (solid(x, yy - 1, z) && !solid(x, yy, z) && !solid(x, yy + 1, z)) return wet(world.get(x, yy - 1, z)) ? null : yy;
    }
    return null;
  };
  // Every spot walked to from the start: a step up at a time (a jump),
  // and down any drop; no swimming.
  return () => {
    const sx = Math.floor(world.spawn.x);
    const sz = Math.floor(world.spawn.z);
    const sy = standAt(sx, sz, Math.floor(world.spawn.y));
    const seen = new Set([`${sx},${sz},${sy}`]);
    const todo = [[sx, sy, sz]];
    while (todo.length) {
      const [x, y, z] = todo.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = standAt(x + dx, z + dz, y + 1);
        if (ny === null || ny > y + 1 || (ny === y + 1 && solid(x, y + 2, z))) continue;
        const key = `${x + dx},${z + dz},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        todo.push([x + dx, ny, z + dz]);
      }
    }
    return seen;
  };
}

// Whether a camp's flag is walked to (any spot beside it, about its height).
const reaches = (seen, c) => {
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) if (seen.has(`${Math.floor(c.x) + dx},${Math.floor(c.z) + dz},${c.y + dy}`)) return true;
  return false;
};

for (const [i, ch] of CHAPTERS.entries()) {
  const stage = i + 1;
  test(`chapter ${stage}, ${ch.name}: its own map, crossed one camp at a time`, () => {
    for (const seed of [12345, 987654321]) {
      const made = buildIsle({ stage, seed });
      const { world } = made;
      assert.equal(world.W, ISLE_SIDE);
      assert.equal(world.theme, ch.theme);
      // Three camps along the way, then King Grumble's lair.
      assert.deepEqual(made.camps.map((c) => [c.id, c.kind]), [[1, 'camp'], [2, 'camp'], [3, 'camp'], [4, 'castle']]);
      for (const c of made.camps) {
        assert.ok(B.SOLID[world.get(Math.floor(c.x), c.y - 1, Math.floor(c.z))], `${ch.key} camp ${c.id}: its flag stands on the ground`);
        assert.equal(world.get(Math.floor(c.x), c.y + 1, Math.floor(c.z)), B.AIR, `${ch.key} camp ${c.id}: with room over it`);
      }
      // No animal lives in a camp, and nothing flies over the gates.
      for (const c of made.critters) {
        if (CRITTER_INFO[c.type]?.flies || CRITTER_INFO[c.type]?.sea) continue;
        assert.ok(!made.camps.some((o) => Math.hypot(c.x - o.x, c.z - o.z) < (o.kind === 'castle' ? 14 : CAMP_RADIUS + 1)), `${ch.key}: a ${c.type} in a camp`);
        assert.ok(!['helicopter', 'balloon'].includes(c.type), `${ch.key}: no ${c.type}`);
      }
      // A gate after each camp, opened by freeing it.
      assert.deepEqual(made.gates.map((g) => g.camp), [1, 2, 3]);
      for (const g of made.gates) assert.ok(g.cells.length >= 8 && g.cells.length % 4 === 0, `${ch.key}: gate ${g.camp} has cells`);
      // From the start, on foot: the first camp, and no further until its
      // gate opens; then the next, and so on to the lair.
      const walk = walker(world);
      const got = () => {
        const seen = walk();
        return made.camps.map((c) => reaches(seen, c));
      };
      assert.deepEqual(got(), [true, false, false, false], `${ch.key} (seed ${seed}): only the first camp to begin with`);
      for (const g of made.gates) {
        for (let k = 0; k < g.cells.length; k += 4) world.set(g.cells[k], g.cells[k + 1], g.cells[k + 2], g.cells[k + 3]);
        assert.deepEqual(got(), made.camps.map((c) => c.id <= g.camp + 1), `${ch.key} (seed ${seed}): gate ${g.camp} open`);
      }
    }
  });
}

test('told again on a later round, a chapter is its own map turned over, the way going the other way round', () => {
  const first = buildIsle({ stage: 1, seed: 5 });
  for (const [stage, alongX, alongZ] of [[8, true, false], [15, false, true], [22, true, true], [29, false, false]]) {
    const made = buildIsle({ stage, seed: 5 });
    assert.equal(chapterOf(stage).key, 'shore');
    const fx = (x) => (alongX ? ISLE_SIDE - x : x);
    const fz = (z) => (alongZ ? ISLE_SIDE - z : z);
    assert.deepEqual(made.camps.map((c) => [c.x, c.z]), first.camps.map((c) => [fx(c.x), fz(c.z)]), `round ${chapterOf(stage).round}`);
    assert.deepEqual([made.world.spawn.x, made.world.spawn.z], [fx(first.world.spawn.x), fz(first.world.spawn.z)]);
    const [x, z] = [10, 20];
    assert.equal(made.world.get(alongX ? ISLE_SIDE - 1 - x : x, 22, alongZ ? ISLE_SIDE - 1 - z : z), first.world.get(x, 22, z));
    // And it is crossed the same way, one camp at a time.
    const walk = walker(made.world);
    assert.deepEqual(made.camps.map((c) => reaches(walk(), c)), [true, false, false, false]);
    for (const g of made.gates) for (let k = 0; k < g.cells.length; k += 4) made.world.set(g.cells[k], g.cells[k + 1], g.cells[k + 2], g.cells[k + 3]);
    assert.ok(made.camps.every((c) => reaches(walk(), c)), 'all the way to the lair with the gates open');
  }
});

test('the same stage and seed make the very same map, and the seed only moves the little things', () => {
  const a = buildIsle({ stage: 3, seed: 42 });
  const b = buildIsle({ stage: 3, seed: 42 });
  assert.deepEqual(a.world.blocks, b.world.blocks);
  assert.deepEqual(a.camps, b.camps);
  const c = buildIsle({ stage: 3, seed: 43 });
  assert.deepEqual(c.camps.map((o) => [o.x, o.z]), a.camps.map((o) => [o.x, o.z]), 'the camps where the chapter has them');
  assert.notDeepEqual(c.world.blocks, a.world.blocks, 'the trees and flowers its own');
});

// ------------------------------------------------ on the isle itself

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  return c;
}

test('on the isle, freeing a camp opens its gate for everyone', () => {
  const isle = new PublicAdventure({ rooms: new Map(), now: () => new Date(2026, 10, 2, 12).getTime(), log: () => {} }).start();
  const room = isle.room;
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Brave Fox', look: { animal: 'cat' } });
  const adv = room.adventure;
  assert.equal(adv.story.key, 'shore');
  assert.equal(adv.gates.length, 3);
  const [gate] = adv.gates;
  const at = (k) => room.world.get(gate.cells[k], gate.cells[k + 1], gate.cells[k + 2]);
  assert.notEqual(at(0), gate.cells[3], 'shut to begin with');
  room.campFreed(adv.free(adv.campById(1), [], room.monsters));
  for (let k = 0; k < gate.cells.length; k += 4) assert.equal(at(k), gate.cells[k + 3], 'every cell of it opened');
  const freed = c.inbox.find((m) => m.t === 'freed');
  assert.deepEqual(freed.gate, [gate.x, gate.y, gate.z], 'told where it stood, for the sparkles');
  assert.ok(c.inbox.some((m) => m.t === 'edit' && m.kind === 'nature' && m.cells.length === gate.cells.length), 'and everyone sees it open');
  assert.equal(adv.gates[1].open, false, 'the next one still shut');
  // Its treasure chests turn up beside the way, never up on a wall or a roof.
  room.adventure.stepChests(room.world, 1000);
  assert.ok(room.adventure.chests.list.length > 0);
  for (const chest of room.adventure.chests.list) {
    assert.ok(adv.chests.spots.some(([x, y, z]) => x === chest.x && y === chest.y && z === chest.z), 'one of the spots beside the way');
    assert.ok(B.TERRAIN[room.world.get(chest.x, chest.y - 1, chest.z)], 'on the ground');
  }
  // King Grumble popped: anything still shut opens too.
  const king = room.monsters.add(room.world, adv.castle.x, adv.castle.y, adv.castle.z, { camp: adv.castle.id, kind: 'king' });
  room.winAdventure(room.players.get(c.inbox.find((m) => m.t === 'welcome').you), king);
  assert.ok(adv.gates.every((g) => g.open));
  isle.stop();
});

test('a chapter’s own monsters come out among its camps’ guards, and King Grumble calls its helpers', () => {
  const world = buildIsle({ stage: 1, seed: 7 }).world;
  const camps = buildIsle({ stage: 1, seed: 7 }).camps;
  const sim = new AdventureSim({ camps, stage: 1, story: true }, 1);
  const monsters = new MonsterSim(1);
  sim.wake(world, sim.campById(1), [], monsters, 2);
  const kinds = monsters.list.filter((m) => m.camp === 1).map((m) => m.kind);
  assert.deepEqual(kinds.slice(0, 2), ['mosquito', 'snapper'], 'on Shipwreck Shore: its mosquito, then a Snappy Crab');
  // Not on an island of your own: blobs as ever.
  const plain = new AdventureSim({ camps, stage: 1 }, 1);
  const theirs = new MonsterSim(1);
  plain.wake(world, plain.campById(1), [], theirs, 2);
  assert.ok(!theirs.list.some((m) => m.kind === 'snapper'));
  // The Whispering Woods' camps keep Puffshrooms; its King Grumble calls spiders.
  const woods = buildIsle({ stage: 2, seed: 7 });
  const w2 = new AdventureSim({ camps: woods.camps, stage: 2, story: true }, 1);
  const m2 = new MonsterSim(1);
  w2.wake(woods.world, w2.campById(1), [], m2, 1);
  assert.ok(m2.list.some((m) => m.kind === 'shroom'));
  for (const c of w2.camps) if (c.kind === 'camp') c.freed = true;
  w2.wake(woods.world, w2.castle, [], m2, 1);
  w2.king.hearts = 1;
  w2.stepCastle(woods.world, w2.castle, 1000, m2);
  assert.deepEqual(m2.list.filter((m) => m.camp === w2.castle.id && m.kind !== 'king').map((m) => m.kind), ['spider', 'spider', 'spider', 'spider']);
  assert.ok(kindOf('spider').hearts > 0);
});
