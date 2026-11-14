// Adventure Isle's story and its maps: every stage a chapter of an episode
// of it ("The Star of Adventure Isle", then "The Rainbow of Adventure Isle"),
// with a map drawn for it, its camps one after another
// along a way that a gate shuts between each camp and the next — freeing a
// camp opens the gate on to the next, so the isle is crossed like a real
// journey — and King Grumble's lair at the end.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { AdventureSim, CAMP_RADIUS, kingHearts } from '../public/js/shared/adventure.js';
import { BOSSES, isBoss } from '../public/js/shared/bosses.js';
import { CRITTER_INFO } from '../public/js/shared/critters.js';
import { buildIsle, ISLE_SIDE } from '../public/js/shared/isle-maps.js';
import { campName, CHAPTERS, chapterOf, EPISODES, episodeOf, firstStage, introOf, RAINBOW, SHARDS, stageName, STAGES, stagesOf, tokensBack } from '../public/js/shared/isle-story.js';
import { kindOf, MONSTER_KINDS, MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { PublicAdventure } from '../server/adventure.js';

// ------------------------------------------------ the story

test('the story has a chapter for every Star Shard and every colour of the rainbow, each told in full', () => {
  assert.equal(stagesOf(1), SHARDS, 'the first episode: a chapter for each Star Shard');
  assert.equal(stagesOf(2), RAINBOW.length, 'the second: one for each colour of the rainbow');
  assert.equal(STAGES, CHAPTERS.length, 'a stage for each chapter, and no more');
  assert.equal(STAGES, EPISODES.reduce((n, ep) => n + stagesOf(ep.n), 0), 'every chapter in an episode');
  assert.equal(new Set(CHAPTERS.map((c) => c.key)).size, STAGES, 'each chapter its own map');
  for (const ch of CHAPTERS) {
    assert.ok(['sunny', 'snowy', 'candy', 'volcano', 'dunes', 'crystal', 'hollow', 'works', 'spires', 'tulip', 'maple', 'honey', 'jungle', 'lagoon', 'moor', 'vale'].includes(ch.theme), ch.key);
    assert.ok(ch.icon && ch.name && ch.lair && ch.intro && ch.won && ch.hazard, ch.key);
    assert.ok(ch.camps.length >= 3 && ch.camps.length <= 4, `${ch.key}: three or four camps along the way`);
    assert.equal(ch.freed.length, ch.camps.length, `${ch.key}: a line for each camp freed`);
    ch.freed.forEach((line, i) => assert.ok(line.includes(ch.camps[i].replace(/^The /, '')), `${ch.key}: freeing ${ch.camps[i]} says so`));
    for (const kind of ch.guards) assert.ok(MONSTER_KINDS.includes(kind), `${ch.key}: ${kind} is a monster`);
    // Its boss, one of its own, calling monsters of the isle to help it.
    assert.ok(isBoss(ch.boss) && MONSTER_KINDS.includes(ch.boss), `${ch.key}: ${ch.boss} is a boss`);
    assert.ok(MONSTER_KINDS.includes(BOSSES[ch.boss].minion) && !isBoss(BOSSES[ch.boss].minion), `${ch.key}: its minions`);
    assert.ok(ch.intro.includes(BOSSES[ch.boss].name.split(' the ')[0]), `${ch.key}: the story tells of ${BOSSES[ch.boss].name}`);
  }
  assert.equal(new Set(CHAPTERS.map((c) => c.boss)).size, STAGES, 'a boss of its own for every chapter');
  assert.equal(CHAPTERS[SHARDS - 1].boss, 'king', 'King Grumble himself at the last of the first episode');
  // Its last chapter ends that tale: King Grumble popped for good, the Star whole.
  assert.match(CHAPTERS[SHARDS - 1].won, /once and for all/);
  // And Queen Grizzle at the last of the second, the rainbow back.
  assert.equal(CHAPTERS.at(-1).boss, 'grizzle');
  assert.match(CHAPTERS.at(-1).won, /the rainbow stands over Adventure Isle again/);
  // Each episode: a tale of its own, with its films and what its chapters win back.
  assert.deepEqual(EPISODES.map((ep) => ep.n), [1, 2]);
  assert.equal(new Set(EPISODES.flatMap((ep) => [ep.key, ep.title, ep.films.intro, ep.films.ending])).size, 8);
  for (const ep of EPISODES) {
    assert.ok(ep.icon && ep.villain && ep.token.one && ep.token.many && ep.films.endingMs > 10000, ep.key);
    assert.match(ep.again(3), /^Journey 3! /);
    assert.ok(ep.again(2).includes(ep.villain));
  }
  assert.deepEqual(RAINBOW.map((c) => c.name), ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet']);
  assert.equal(EPISODES[1].token.colours, RAINBOW);
  // The second episode's chapters each win back their colour, and say so.
  CHAPTERS.slice(SHARDS).forEach((ch, i) => assert.match(ch.won, new RegExp(i === 6 ? 'seven colours' : `${RAINBOW[i].name[0].toUpperCase()}${RAINBOW[i].name.slice(1)} is back`), ch.key));
});

test('each stage is a chapter of an episode, its last the end of that tale, told again on a new journey', () => {
  assert.deepEqual([1, 2, 5, 12, 13, 19].map((s) => chapterOf(s).key), ['shore', 'woods', 'dunes', 'castle', 'tulip', 'vale']);
  assert.deepEqual([chapterOf(1).n, chapterOf(1).shards, chapterOf(1).final], [1, 1, false]);
  assert.deepEqual([chapterOf(SHARDS).shards, chapterOf(SHARDS).final, chapterOf(SHARDS).last], [SHARDS, true, false], 'the end of the first episode, not of the story');
  assert.deepEqual([chapterOf(STAGES).shards, chapterOf(STAGES).final, chapterOf(STAGES).last], [RAINBOW.length, true, true]);
  assert.equal(chapterOf(STAGES + 5).key, 'vale', 'past the last, the last');
  // The second episode's stages come after the first's, counted from 1 again.
  assert.deepEqual([firstStage(1), firstStage(2), firstStage(99)], [1, SHARDS + 1, 1]);
  assert.equal(episodeOf(2), EPISODES[1]);
  assert.equal(episodeOf(0), EPISODES[0], 'no such episode is the first');
  const tulip = chapterOf(SHARDS + 1);
  assert.deepEqual([tulip.stage, tulip.episode.n, tulip.n, tulip.of, tulip.shards, tulip.final], [SHARDS + 1, 2, 1, RAINBOW.length, 1, false]);
  // How hard: a stage of the first episode as its number, the second's as each says.
  assert.deepEqual([1, 6, 12].map((s) => chapterOf(s).level), [1, 6, 12]);
  const levels = CHAPTERS.slice(SHARDS).map((_, i) => chapterOf(SHARDS + 1 + i).level);
  assert.ok(levels.every((l, i) => l >= 6 && (i === 0 || l > levels[i - 1])), 'each harder than the last');
  assert.ok(levels.at(-1) > SHARDS, 'Queen Grizzle harder than King Grumble');
  assert.deepEqual([stageName(3), stageName(3, true), stageName(SHARDS + 3), stageName(SHARDS + 3, true)], ['Stage 3 of 12', 'Stage 3', 'Episode 2 · Stage 3 of 7', 'Episode 2 · Stage 3']);
  assert.deepEqual([tokensBack(chapterOf(3)), tokensBack(chapterOf(SHARDS)), tokensBack(tulip), tokensBack(chapterOf(STAGES))], ['3 of 12 Star Shards back!', 'All 12 Star Shards!', '1 of 7 colours of the rainbow back!', 'All 7 colours of the rainbow!']);
  assert.match(introOf(SHARDS + 2, 2), /^Journey 2! Queen Grizzle is back/);
  assert.equal(introOf(SHARDS + 1), CHAPTERS[SHARDS].intro);
  // The later chapters are longer: four camps along the way.
  assert.ok(CHAPTERS.slice(4).some((c) => c.camps.length === 4));
  assert.match(introOf(3, 2), /^Journey 2!/);
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
      // Its camps along the way, then the lair.
      assert.deepEqual(made.camps.map((c) => [c.id, c.kind]), [...ch.camps.map((_, k) => [k + 1, 'camp']), [ch.camps.length + 1, 'castle']]);
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
      assert.deepEqual(made.gates.map((g) => g.camp), ch.camps.map((_, k) => k + 1));
      for (const g of made.gates) assert.ok(g.cells.length >= 8 && g.cells.length % 4 === 0, `${ch.key}: gate ${g.camp} has cells`);
      // From the start, on foot: the first camp, and no further until its
      // gate opens; then the next, and so on to the lair.
      const walk = walker(world);
      const got = () => {
        const seen = walk();
        return made.camps.map((c) => reaches(seen, c));
      };
      assert.deepEqual(got(), made.camps.map((c) => c.id === 1), `${ch.key} (seed ${seed}): only the first camp to begin with`);
      for (const g of made.gates) {
        for (let k = 0; k < g.cells.length; k += 4) world.set(g.cells[k], g.cells[k + 1], g.cells[k + 2], g.cells[k + 3]);
        assert.deepEqual(got(), made.camps.map((c) => c.id <= g.camp + 1), `${ch.key} (seed ${seed}): gate ${g.camp} open`);
      }
    }
  });
}

test('told again on a later journey, a chapter is its own map turned over, the way going the other way round', () => {
  const first = buildIsle({ stage: 1, seed: 5 });
  for (const [journey, alongX, alongZ] of [[2, true, false], [3, false, true], [4, true, true], [5, false, false]]) {
    const made = buildIsle({ stage: 1, seed: 5, journey });
    const fx = (x) => (alongX ? ISLE_SIDE - x : x);
    const fz = (z) => (alongZ ? ISLE_SIDE - z : z);
    assert.deepEqual(made.camps.map((c) => [c.x, c.z]), first.camps.map((c) => [fx(c.x), fz(c.z)]), `journey ${journey}`);
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

test('a chapter’s own monsters come out among its camps’ guards, and its boss holds the lair and calls its helpers', () => {
  const world = buildIsle({ stage: 1, seed: 7 }).world;
  const camps = buildIsle({ stage: 1, seed: 7 }).camps;
  const sim = new AdventureSim({ camps, stage: 1 }, 1);
  const monsters = new MonsterSim(1);
  sim.wake(world, sim.campById(1), [], monsters, 2);
  const kinds = monsters.list.filter((m) => m.camp === 1).map((m) => m.kind);
  assert.deepEqual(kinds.slice(0, 2), ['mosquito', 'snapper'], 'on Shipwreck Shore: its mosquito, then a Snappy Crab');
  // The Whispering Woods' camps keep Puffshrooms; Old Puffcap holds its
  // lair, and calls more of them.
  const woods = buildIsle({ stage: 2, seed: 7 });
  const w2 = new AdventureSim({ camps: woods.camps, stage: 2 }, 1);
  const m2 = new MonsterSim(1);
  w2.wake(woods.world, w2.campById(1), [], m2, 1);
  assert.ok(m2.list.some((m) => m.kind === 'shroom'));
  for (const c of w2.camps) if (c.kind === 'camp') c.freed = true;
  w2.wake(woods.world, w2.castle, [], m2, 1);
  const boss = m2.list.find((m) => m.camp === w2.castle.id);
  assert.equal(boss.kind, 'puffcap');
  assert.equal(boss.plan, BOSSES.puffcap, 'fighting as the chapter has it');
  assert.equal(w2.king.max, Math.round(kingHearts(1, 2) * BOSSES.puffcap.hearts));
  w2.king.hearts = 1;
  w2.stepCastle(woods.world, w2.castle, 1000, m2);
  assert.deepEqual(m2.list.filter((m) => m.camp === w2.castle.id && m !== boss).map((m) => m.kind), ['shroom', 'shroom', 'shroom', 'shroom']);
  assert.ok(kindOf('shroom').hearts > 0);
});
