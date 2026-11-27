// Adventure Isle's story and its maps: every stage a chapter of an episode
// of it ("The Star of Adventure Isle", "The Rainbow of Adventure Isle", then
// "The Wild Isle"),
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
import { campName, CHAPTERS, chapterOf, EPISODES, episodeOf, firstStage, introOf, RAINBOW, SHARDS, stageName, STAGES, stagesOf, ticketFits, ticketNeeded, ticketOf, ticketsHeld, tokensBack, toldKey } from '../public/js/shared/isle-story.js';
import { keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { STAT_KEYS } from '../public/js/shared/stickers.js';
import { kindOf, MONSTER_KINDS, MonsterSim } from '../public/js/shared/monsters.js';
import { MAX_QUESTS, QUEST_ICONS } from '../public/js/shared/isle-quests.js';
import { BATTLE_ICONS, MAX_BATTLES } from '../public/js/shared/isle-battles.js';
import { isBeast } from '../public/js/shared/beasts.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { PublicAdventure } from '../server/adventure.js';

// ------------------------------------------------ the story

test('the story has a chapter for every Star Shard and every colour of the rainbow, each told in full', () => {
  assert.equal(stagesOf(1), SHARDS, 'the first episode: a chapter for each Star Shard');
  assert.equal(stagesOf(2), RAINBOW.length, 'the second: one for each colour of the rainbow');
  assert.equal(stagesOf(3), 5, 'the third: one for each of the Wild Isle’s five Sunstones');
  assert.equal(stagesOf(4), 5, 'the fourth: one for each of the five Golden Bells');
  assert.equal(stagesOf(5), 5, 'the fifth: one for each of Toon Isle’s five Sky Lanterns');
  assert.equal(stagesOf(6), 5, 'the sixth: one for each of the five Sweet Dreams');
  assert.equal(stagesOf(7), 5, 'the seventh: one for each of the five Happy Endings');
  assert.equal(STAGES, CHAPTERS.length, 'a stage for each chapter, and no more');
  assert.equal(STAGES, EPISODES.reduce((n, ep) => n + stagesOf(ep.n), 0), 'every chapter in an episode');
  assert.equal(new Set(CHAPTERS.map((c) => c.key)).size, STAGES, 'each chapter its own map');
  // (The fourth episode's chapters are told in challenges instead, the
  // fifth's in battles, the sixth's in nightmares, the seventh's in the pages
  // of its stories: below.)
  const camped = CHAPTERS.filter((c) => !c.quests && !c.battles && !c.nightmares && !c.pages);
  for (const ch of camped) {
    assert.ok(['sunny', 'snowy', 'candy', 'volcano', 'dunes', 'crystal', 'hollow', 'works', 'spires', 'tulip', 'maple', 'honey', 'jungle', 'lagoon', 'moor', 'vale', 'wildcoast', 'wildwood', 'wildfalls', 'wildpeak', 'wildfen'].includes(ch.theme), ch.key);
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
  assert.equal(new Set(camped.map((c) => c.boss)).size, camped.length, 'a boss of its own for every chapter with camps');
  assert.equal(CHAPTERS[SHARDS - 1].boss, 'king', 'King Grumble himself at the last of the first episode');
  // Its last chapter ends that tale: King Grumble popped for good, the Star whole.
  assert.match(CHAPTERS[SHARDS - 1].won, /once and for all/);
  // And Queen Grizzle at the last of the second, the rainbow back.
  const grizzle = CHAPTERS[firstStage(3) - 2];
  assert.equal(grizzle.boss, 'grizzle');
  assert.match(grizzle.won, /the rainbow stands over Adventure Isle again/);
  // And Old Murk at the last of the third, the Sunstones back.
  const murk = CHAPTERS[firstStage(4) - 2];
  assert.equal(murk.boss, 'murk');
  assert.match(murk.won, /all five Sunstones fly up together/);
  // Each episode: a tale of its own, with its films and what its chapters win back.
  assert.deepEqual(EPISODES.map((ep) => ep.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(EPISODES.flatMap((ep) => [ep.key, ep.title, ep.films.intro, ep.films.ending])).size, 28);
  // Only the third is drawn as the real thing, its own animals in its camps;
  // only the fifth as a cartoon, on islands twice as far across, told in
  // battles (isle-battles.js).
  assert.deepEqual(EPISODES.map((ep) => Boolean(ep.real)), [false, false, true, false, false, false, false]);
  assert.deepEqual(EPISODES.map((ep) => Boolean(ep.cartoon)), [false, false, false, false, true, false, false]);
  assert.deepEqual(EPISODES.map((ep) => Boolean(ep.battles)), [false, false, false, false, true, false, false]);
  assert.equal(EPISODES[4].side, 2 * ISLE_SIDE);
  // Only the fourth is told in challenges (isle-quests.js), with no camps,
  // no lair, no boss and nothing coming down on the way: three or four of
  // Jinx's challenges on each island, never the same kind twice on one,
  // each with its name, what to do and what is told once it is done, the
  // last of all catching Jinx himself, once the rest are done.
  assert.deepEqual(EPISODES.map((ep) => Boolean(ep.quests)), [false, false, false, true, false, false, false]);
  const bells = CHAPTERS.filter((c) => c.episode === 4);
  assert.deepEqual(bells.map((c) => c.key), ['bellbuoy', 'henhouse', 'topsy', 'kite', 'nest']);
  for (const ch of bells) {
    assert.ok(ch.quests.length >= 3 && ch.quests.length <= MAX_QUESTS, `${ch.key}: three or four challenges`);
    assert.equal(new Set(ch.quests.map((q) => q.kind)).size, ch.quests.length, `${ch.key}: each a different kind`);
    for (const q of ch.quests) {
      assert.ok(QUEST_ICONS[q.kind], `${ch.key}: ${q.kind} is a challenge`);
      assert.ok(q.name && q.hint.length > 30 && q.done, `${ch.key}: ${q.kind} told in full`);
      if (q.kind === 'chase') assert.equal(q.animal, 'monkey');
      if (q.kind === 'lead') assert.ok(['chick', 'sheep'].includes(q.animal));
    }
    assert.ok(!ch.camps && !ch.boss && !ch.lair && !ch.hazard, `${ch.key}: nothing of camps`);
    assert.ok(ch.intro && ch.won && ch.icon && ch.name, ch.key);
    assert.ok(['sunny', 'honey', 'tulip', 'maple', 'moor'].includes(ch.theme), ch.key);
  }
  assert.deepEqual(bells.flatMap((c) => c.quests.filter((q) => q.after).map((q) => `${c.key}:${q.kind}`)), ['nest:jinx']);
  assert.equal(bells.at(-1).quests.at(-1).kind, 'jinx', 'catching Jinx comes last');
  // Every kind of challenge comes up at least once.
  assert.deepEqual([...new Set(bells.flatMap((c) => c.quests.map((q) => q.kind)))].sort(), Object.keys(QUEST_ICONS).sort());
  bells.forEach((ch, i) => assert.match(ch.won, i === 4 ? /every Golden Bell/ : /Golden Bell rings out/, ch.key));
  // The fifth: three to five battles on each island, every kind at least
  // once, Baron Bluster's showdown last of all, once the rest are won; each
  // chapter wins back a Sky Lantern, and says so.
  const toon = CHAPTERS.filter((c) => c.episode === 5);
  assert.deepEqual(toon.map((c) => c.key), ['lollipop', 'toadstool', 'rumble', 'snowball', 'thunder']);
  for (const ch of toon) {
    assert.ok(ch.battles.length >= 3 && ch.battles.length <= MAX_BATTLES, `${ch.key}: three to five battles`);
    for (const b of ch.battles) {
      assert.ok(BATTLE_ICONS[b.kind], `${ch.key}: ${b.kind} is a battle`);
      assert.ok(b.name && b.hint.length > 30 && b.done, `${ch.key}: ${b.kind} told in full`);
      if (b.kind === 'hunt') assert.ok(isBeast(b.beast) && b.who, `${ch.key}: its Big Bad`);
    }
    assert.ok(ch.theme.startsWith('toon') && ch.gang.every((k) => MONSTER_KINDS.includes(k)), ch.key);
    assert.ok(!ch.camps && !ch.lair && !ch.hazard && !ch.quests, `${ch.key}: nothing of camps`);
    assert.ok(ch.intro && ch.won && ch.icon && ch.name, ch.key);
  }
  assert.deepEqual([...new Set(toon.flatMap((c) => c.battles.map((b) => b.kind)))].sort(), Object.keys(BATTLE_ICONS).sort());
  assert.deepEqual(toon.flatMap((c) => c.battles.filter((b) => b.after).map((b) => `${c.key}:${b.kind}`)), ['thunder:showdown']);
  assert.equal(toon.at(-1).battles.at(-1).kind, 'showdown', 'the Baron comes last');
  toon.forEach((ch, i) => assert.match(ch.won, i === 4 ? /All five Sky Lanterns/ : /Sky Lantern/, ch.key));
  assert.ok(EPISODES[4].villain === 'Baron Bluster' && EPISODES[4].token.icon === '🏮');
  // The sixth: no island at all, but dreams (nod/worlds), three nightmares in
  // each and then its boss, each with what to do and what is told once it is
  // over; each chapter wins back a Sweet Dream, and says so.
  assert.deepEqual(EPISODES.map((ep) => Boolean(ep.nod)), [false, false, false, false, false, true, false]);
  const nod = CHAPTERS.filter((c) => c.episode === 6);
  assert.deepEqual(nod.map((c) => c.key), ['pillow', 'garden', 'music', 'clock', 'mare']);
  for (const ch of nod) {
    assert.equal(ch.nightmares.length, 4, `${ch.key}: three nightmares, and its boss`);
    assert.equal(new Set(ch.nightmares.map((n) => n.name)).size, 4, ch.key);
    for (const n of ch.nightmares) assert.ok(n.icon && n.name && n.hint.length > 30 && n.done, `${ch.key}: ${n.name} told in full`);
    assert.equal(ch.theme, `nod${ch.key}`);
    assert.ok(!ch.camps && !ch.boss && !ch.lair && !ch.hazard && !ch.quests && !ch.battles, `${ch.key}: nothing of camps`);
    assert.ok(ch.intro && ch.won && ch.icon && ch.name, ch.key);
  }
  nod.forEach((ch, i) => assert.match(ch.won, i === 4 ? /All five Sweet Dreams/ : /Sweet Dream is back/, ch.key));
  assert.ok(EPISODES[5].villain === 'the Night Mare' && EPISODES[5].token.icon === '💤');
  // The seventh: as flat as a page, its chapters the stories of the Storybook,
  // each told in its pages and with a boss of its own at the end
  // (test/book.test.js has the rest); each wins back a Happy Ending.
  assert.deepEqual(EPISODES.map((ep) => Boolean(ep.book)), [false, false, false, false, false, false, true]);
  const book = CHAPTERS.filter((c) => c.episode === 7);
  assert.deepEqual(book.map((c) => c.key), ['meadow', 'harbor', 'turret', 'starry', 'inkwell']);
  for (const ch of book) assert.ok(ch.pages.length === 5 && ch.theme === `book${ch.key}` && ch.boss && ch.intro && ch.won, ch.key);
  assert.ok(EPISODES[6].villain === 'Count Inkblot' && EPISODES[6].token.icon === '💖');
  for (const ch of CHAPTERS.filter((c) => c.episode === 3)) assert.ok(ch.theme.startsWith('wild') && ch.guards.every((k) => ['snapper', 'fox', 'boar', 'wolf'].includes(k)), ch.key);
  assert.ok(EPISODES[3].villain === 'Jinx the Magpie' && EPISODES[3].token.icon === '🔔');
  for (const ep of EPISODES) {
    assert.ok(ep.icon && ep.villain && ep.token.one && ep.token.many && ep.films.endingMs > 10000, ep.key);
    assert.match(ep.again(3), /^Journey 3! /);
    assert.ok(ep.again(2).includes(ep.villain));
  }
  assert.deepEqual(RAINBOW.map((c) => c.name), ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet']);
  assert.equal(EPISODES[1].token.colours, RAINBOW);
  // The second episode's chapters each win back their colour, and say so.
  CHAPTERS.slice(SHARDS, SHARDS + RAINBOW.length).forEach((ch, i) => assert.match(ch.won, new RegExp(i === 6 ? 'seven colours' : `${RAINBOW[i].name[0].toUpperCase()}${RAINBOW[i].name.slice(1)} is back`), ch.key));
  // The third episode's each win back a Sunstone, and say so.
  CHAPTERS.slice(SHARDS + RAINBOW.length, firstStage(4) - 1).forEach((ch, i) => assert.match(ch.won, i === 4 ? /five Sunstones/ : /Sunstone/, ch.key));
});

test('each stage is a chapter of an episode, its last the end of that tale, told again on a new journey', () => {
  assert.deepEqual([1, 2, 5, 12, 13, 19].map((s) => chapterOf(s).key), ['shore', 'woods', 'dunes', 'castle', 'tulip', 'vale']);
  assert.deepEqual([chapterOf(1).n, chapterOf(1).shards, chapterOf(1).final], [1, 1, false]);
  assert.deepEqual([chapterOf(SHARDS).shards, chapterOf(SHARDS).final, chapterOf(SHARDS).last], [SHARDS, true, false], 'the end of the first episode, not of the story');
  const vale = SHARDS + RAINBOW.length;
  assert.deepEqual([chapterOf(vale).shards, chapterOf(vale).final, chapterOf(vale).last], [RAINBOW.length, true, false], 'the end of the second, not of the story');
  assert.deepEqual([chapterOf(STAGES).shards, chapterOf(STAGES).final, chapterOf(STAGES).last], [5, true, true]);
  const nest = firstStage(5) - 1;
  assert.deepEqual([chapterOf(nest).key, chapterOf(nest).final, chapterOf(nest).last], ['nest', true, false], 'the end of the fourth, not of the story');
  const fen = firstStage(4) - 1;
  assert.deepEqual([chapterOf(fen).key, chapterOf(fen).final, chapterOf(fen).last], ['fen', true, false], 'the end of the third, not of the story');
  assert.equal(chapterOf(STAGES + 5).key, 'inkwell', 'past the last, the last');
  const mare = firstStage(7) - 1;
  assert.deepEqual([chapterOf(mare).key, chapterOf(mare).final, chapterOf(mare).last], ['mare', true, false], 'the end of the sixth, not of the story');
  const thunder = firstStage(6) - 1;
  assert.deepEqual([chapterOf(thunder).key, chapterOf(thunder).final, chapterOf(thunder).last], ['thunder', true, false], 'the end of the fifth, not of the story');
  // The second episode's stages come after the first's, counted from 1 again,
  // and the third's after the second's.
  assert.deepEqual([firstStage(1), firstStage(2), firstStage(3), firstStage(99)], [1, SHARDS + 1, vale + 1, 1]);
  assert.deepEqual([vale + 1, vale + 5].map((st) => chapterOf(st).key), ['cove', 'fen']);
  assert.equal(episodeOf(2), EPISODES[1]);
  assert.equal(episodeOf(0), EPISODES[0], 'no such episode is the first');
  const tulip = chapterOf(SHARDS + 1);
  assert.deepEqual([tulip.stage, tulip.episode.n, tulip.n, tulip.of, tulip.shards, tulip.final], [SHARDS + 1, 2, 1, RAINBOW.length, 1, false]);
  // How hard: a stage of the first episode as its number, the second's as each says.
  assert.deepEqual([1, 6, 12].map((s) => chapterOf(s).level), [1, 6, 12]);
  const levels = CHAPTERS.slice(SHARDS, vale).map((_, i) => chapterOf(SHARDS + 1 + i).level);
  assert.ok(levels.every((l, i) => l >= 6 && (i === 0 || l > levels[i - 1])), 'each harder than the last');
  assert.ok(levels.at(-1) > SHARDS, 'Queen Grizzle harder than King Grumble');
  const wild = CHAPTERS.slice(vale, fen).map((_, i) => chapterOf(vale + 1 + i).level);
  assert.ok(wild.every((l, i) => l >= 9 && (i === 0 || l > wild[i - 1])), 'and the third, each harder than the last');
  assert.ok(wild.at(-1) > SHARDS, 'Old Murk harder than King Grumble');
  const bells = CHAPTERS.slice(fen, nest).map((_, i) => chapterOf(fen + 1 + i).level);
  assert.ok(bells.every((l, i) => l >= 10 && (i === 0 || l > bells[i - 1])), 'and the fourth');
  const toon = CHAPTERS.slice(nest, thunder).map((_, i) => chapterOf(nest + 1 + i).level);
  assert.ok(toon.every((l, i) => l >= 12 && (i === 0 || l > toon[i - 1])), 'and the fifth');
  assert.ok(toon[0] > bells[0] && toon.at(-1) > bells.at(-1), 'harder than the fourth');
  const nod = CHAPTERS.slice(thunder, mare).map((_, i) => chapterOf(thunder + 1 + i).level);
  assert.ok(nod.every((l, i) => l >= 14 && (i === 0 || l > nod[i - 1])), 'and the sixth, the hardest of all');
  assert.ok(nod[0] > toon[0] && nod.at(-1) > toon.at(-1), 'harder than the fifth');
  const stories = CHAPTERS.slice(mare).map((_, i) => chapterOf(mare + 1 + i).level);
  assert.ok(stories.every((l, i) => i === 0 || l > stories[i - 1]), 'and the seventh');
  assert.ok(stories[0] > nod[0] && stories.at(-1) > nod.at(-1), 'harder than the sixth');
  assert.deepEqual([stageName(3), stageName(3, true), stageName(SHARDS + 3), stageName(SHARDS + 3, true)], ['Stage 3 of 12', 'Stage 3', 'Episode 2 · Stage 3 of 7', 'Episode 2 · Stage 3']);
  assert.deepEqual([tokensBack(chapterOf(3)), tokensBack(chapterOf(SHARDS)), tokensBack(tulip), tokensBack(chapterOf(vale)), tokensBack(chapterOf(vale + 2)), tokensBack(chapterOf(fen)), tokensBack(chapterOf(fen + 2)), tokensBack(chapterOf(nest)), tokensBack(chapterOf(nest + 2)), tokensBack(chapterOf(thunder)), tokensBack(chapterOf(thunder + 3)), tokensBack(chapterOf(mare)), tokensBack(chapterOf(mare + 2)), tokensBack(chapterOf(STAGES))], ['3 of 12 Star Shards back!', 'All 12 Star Shards!', '1 of 7 colours of the rainbow back!', 'All 7 colours of the rainbow!', '2 of 5 Sunstones back!', 'All 5 Sunstones!', '2 of 5 Golden Bells back!', 'All 5 Golden Bells!', '2 of 5 Sky Lanterns back!', 'All 5 Sky Lanterns!', '3 of 5 Sweet Dreams back!', 'All 5 Sweet Dreams!', '2 of 5 Happy Endings back!', 'All 5 Happy Endings!']);
  assert.match(introOf(nest + 1, 2), /^Journey 2! Baron Bluster huffed and puffed/);
  assert.deepEqual([campName(nest + 1, 1), campName(thunder, 5), campName(thunder, 9)], ['The Shipwreck', 'Baron Bluster!', null]);
  assert.match(introOf(thunder + 1, 2), /^Journey 2! One night the Night Mare’s night-light went out/);
  assert.deepEqual([campName(thunder + 1, 2), campName(mare, 4), campName(mare, 9)], ['The Thimble Ring', 'The Night Mare', null]);
  assert.deepEqual([stageName(thunder + 2), stageName(mare, true)], ['Episode 6 · Stage 2 of 5', 'Episode 6 · Stage 5']);
  assert.match(introOf(mare + 1, 2), /^Journey 2! Count Inkblot oozed back/);
  assert.deepEqual([campName(mare + 1, 2), campName(STAGES, 5), campName(STAGES, 9)], ['Puddle Lane', 'Count Inkblot', null]);
  assert.deepEqual([stageName(mare + 3), stageName(STAGES, true)], ['Episode 7 · Stage 3 of 5', 'Episode 7 · Stage 5']);
  assert.deepEqual([stageName(vale + 2), stageName(vale + 2, true), stageName(fen + 4)], ['Episode 3 · Stage 2 of 5', 'Episode 3 · Stage 2', 'Episode 4 · Stage 4 of 5']);
  assert.match(introOf(fen + 1, 3), /^Journey 3! Jinx the Magpie never could keep away/);
  assert.deepEqual([campName(fen + 1, 2), campName(fen + 5, 4), campName(fen + 5, 9)], ['The Crow’s Nest', 'Catch Jinx!', null]);
  assert.match(introOf(vale + 1, 2), /^Journey 2! Old Murk crept back/);
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
  // (The fourth episode's maps have no camps: test/isle-quests.test.js; nor
  // the fifth's: test/isle-battles.test.js; and the sixth has no maps: test/nod.test.js.)
  if (ch.quests || ch.battles || ch.nightmares || ch.pages) continue;
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

test('an episode after the first needs its ticket, which the episode before it gives, told to its end', () => {
  // The first is open to everyone; every other has a ticket of its own.
  assert.equal(ticketOf(1), null);
  assert.deepEqual(ticketOf(2), { icon: '🎫', name: 'Rainbow Ticket' });
  assert.deepEqual(ticketOf(3), { icon: '🧭', name: 'Wild Isle Compass' });
  assert.deepEqual(ticketOf(4), { icon: '🪶', name: 'Magpie Feather' });
  assert.deepEqual(ticketOf(5), { icon: '🗺️', name: 'Toon Isle Map' });
  assert.deepEqual(ticketOf(6), { icon: '🛏️', name: 'Cloud Pillow' });
  assert.deepEqual(ticketOf(7), { icon: '📕', name: 'Bedtime Storybook' });
  for (const ep of EPISODES.slice(1)) assert.ok(ep.ticket?.icon && ep.ticket.name, `episode ${ep.n}`);
  // What is counted: the times you were there as each episode was told to
  // its end, kept with everything else the isle's own world of you counts.
  assert.deepEqual(EPISODES.map((ep) => toldKey(ep.n)), ['toldstar', 'toldrainbow', 'toldwild', 'toldbells', 'toldtoon', 'toldnod', 'toldbook']);
  for (const ep of EPISODES) assert.ok(STAT_KEYS.includes(toldKey(ep.n)), toldKey(ep.n));
  // The ticket to an episode: the one before it told to its end, once or often.
  assert.deepEqual(ticketsHeld({}), []);
  assert.deepEqual(ticketsHeld(null), []);
  assert.deepEqual(ticketsHeld({ kings: 40, popking: 3, toldbook: 2 }), [], 'not for stages won, nor for the last episode');
  assert.deepEqual(ticketsHeld({ toldnod: 1 }), [7]);
  assert.deepEqual(ticketsHeld({ toldbells: 1 }), [5]);
  assert.deepEqual(ticketsHeld({ toldtoon: 1 }), [6]);
  assert.deepEqual(ticketsHeld({ toldstar: 1 }), [2]);
  assert.deepEqual(ticketsHeld({ toldrainbow: 1 }), [3]);
  assert.deepEqual(ticketsHeld({ toldwild: 1 }), [4]);
  assert.deepEqual(ticketsHeld({ toldstar: 7, toldrainbow: 1 }), [2, 3]);
  assert.equal(ticketNeeded(4), 'Episode 4 needs the 🪶 Magpie Feather. Pop Old Murk at the end of Episode 3 to get yours!');
  assert.equal(ticketNeeded(6), 'Episode 6 needs the 🛏️ Cloud Pillow. Pop Baron Bluster at the end of Episode 5 to get yours!');
  assert.equal(ticketNeeded(7), 'Episode 7 needs the 📕 Bedtime Storybook. Calm the Night Mare at the end of Episode 6 to get yours!');
  // Whether tickets let into an episode.
  assert.equal(ticketFits(1, []), true);
  assert.equal(ticketFits(1, undefined), true);
  assert.equal(ticketFits(2, [2]), true);
  for (const none of [[], [1], [3], undefined, null, 2, '2']) assert.equal(ticketFits(2, none), false, JSON.stringify(none));
  assert.equal(ticketFits(99, []), true, 'nonsense is the first episode');
  // And what someone without one is told.
  assert.equal(ticketNeeded(1), '');
  assert.equal(ticketNeeded(2), 'Episode 2 needs the 🎫 Rainbow Ticket. Pop King Grumble at the end of Episode 1 to get yours!');
  assert.equal(ticketNeeded(3), 'Episode 3 needs the 🧭 Wild Isle Compass. Pop Queen Grizzle at the end of Episode 2 to get yours!');
  assert.equal(ticketFits(3, [3]), true);
  assert.equal(ticketFits(3, [2]), false);
  // It is kept at the keeper, and is yours on every device: the most either has.
  assert.equal(keptProfile({ stats: { toldstar: 1 } }).stats.toldstar, 1);
  const here = { name: 'Brave Fox', stats: { toldstar: 0, kings: 3 } };
  const there = { name: 'Brave Fox', stats: { toldstar: 1, kings: 1 } };
  assert.deepEqual(ticketsHeld(mergeProfiles(here, there).stats), [2]);
  assert.deepEqual(ticketsHeld(mergeProfiles(there, here).stats), [2]);
});

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
