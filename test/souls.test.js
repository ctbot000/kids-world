// The soul weapons of Adventure Isle (shared/souls.js): six no shop sells, one for
// each episode of its story, in pieces in the golden chests of its stages. Which
// part a chest holds, and never a whole weapon out of one game; putting one together
// and beating its soul, alone, on a world of its own (nod/duel.js); combining them
// and taking them apart; and what each does at the host, and in the hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { EPISODES, stagesOf } from '../public/js/shared/isle-story.js';
import { addProgress, keptProfile, mergeProfiles } from '../public/js/shared/keeper.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { MOVES } from '../public/js/shared/nod/attacks.js';
import { NOD_BOSSES } from '../public/js/shared/nod/bosses.js';
import { Dream } from '../public/js/shared/nod/dream.js';
import { DUEL_LEVEL, duelStory, SoulDuel } from '../public/js/shared/nod/duel.js';
import { FRIGHTS, OPENINGS } from '../public/js/shared/nod/foes.js';
import { SOUL_FOES } from '../public/js/shared/nod/soul-foes.js';
import { dist3, dot } from '../public/js/shared/nod/shape.js';
import { ARENA_KEYS, isNodKey, NOD_KEYS, nodKey, nodTheme, nodWorld } from '../public/js/shared/nod/worlds/index.js';
import { ARM_REACH } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanGear, lookWithGear, nextLevel, WEAPONS, weaponOf, wornWeapon } from '../public/js/shared/shop.js';
import * as S from '../public/js/shared/souls.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { cleanLook } from '../public/js/shared/words.js';
import { normalizeMeta, World } from '../public/js/shared/world.js';
import { Avatar, SOUL_SWINGS, swingOf, swingPose } from '../public/js/render/avatar.js';

const LOOK = { animal: 'cat', fur: 'orange', shirt: 3, hat: 'none' };
const key = (id) => `${S.SOUL_KEY}${id}`;
const full = (k) => S.soulOf(k).parts.map(() => 1);
// A draw of one's own, the same every time.
const dice = (seed) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};

// ---------------------------------------------------------------- the weapons

test('six of them, one for each episode, none of them in any shop, each of parts all its own', () => {
  assert.deepEqual(S.SOULS.map((w) => w.episode), EPISODES.map((e) => e.n));
  assert.equal(new Set(S.SOULS.map((w) => w.name)).size, 6);
  const names = S.SOULS.flatMap((w) => w.parts.map((p) => p.name));
  assert.equal(new Set(names).size, names.length, 'no two parts alike, of any of them');
  for (const w of S.SOULS) {
    assert.ok(w.parts.length >= 6 && w.parts.length <= 8, w.name);
    assert.ok(w.parts.every((p) => p.icon && p.name.length > 4), w.name);
    assert.ok(w.soul.name && w.soul.title && w.soul.lines.length === 3 && w.soul.yields, w.name);
    assert.ok(w.does.length > 30 && w.title.startsWith('the '), w.name);
    assert.equal(S.soulOfEpisode(w.episode), w);
    assert.ok(S.whereFound(w).includes(`${stagesOf(w.episode)} stages`), S.whereFound(w));
    assert.ok(!WEAPONS.some((s) => s.key === w.key || s.name === w.name));
  }
  // Nothing a shop sells ever comes to one.
  for (let i = 0; i <= WEAPONS.length; i++) assert.ok(!nextLevel(cleanGear({ weapon: i }), 'weapon')?.soul);
  const best = Math.max(...WEAPONS.map((w) => w.power));
  for (const k of S.SOUL_KEYS) {
    const spec = S.soulWeapon(key(k));
    assert.ok(spec.power > best, `${spec.name} hits harder than anything in the shop`);
    assert.ok(spec.king > Math.max(...WEAPONS.map((w) => w.king)), 'and a boss feels it more');
    assert.equal(spec.uses, Infinity);
    assert.equal(weaponOf(key(k)), spec, 'in hand by its key');
    assert.equal(cleanLook({ ...LOOK, weapon: key(k) }).weapon, key(k), 'and in the look friends see');
  }
});

test('combined, each more soul is mightier; every two have a name of their own, and all six are Everheart', () => {
  const names = new Set();
  for (const a of S.SOUL_KEYS) {
    for (const b of S.SOUL_KEYS) {
      if (a === b) continue;
      const spec = S.soulWeapon(key(S.idOf([a, b])));
      assert.equal(spec.form, S.soulOf(a).form, 'in the form of the first');
      assert.equal(spec.name, S.soulWeapon(key(S.idOf([b, a]))).name, 'whichever way round');
      names.add(spec.name);
      assert.ok(spec.power > S.soulWeapon(key(a)).power && spec.king > S.soulWeapon(key(a)).king);
      assert.ok(spec.reach >= Math.max(S.soulWeapon(key(a)).reach, S.soulWeapon(key(b)).reach));
    }
  }
  assert.equal(names.size, 15);
  let ids = [];
  let power = 0;
  for (const k of S.SOUL_KEYS) {
    ids = [...ids, k];
    const spec = S.soulWeapon(key(S.idOf(ids)));
    assert.ok(spec.power > power, `${ids.length} souls: ${spec.power}`);
    power = spec.power;
    assert.equal(spec.souls.length, ids.length);
  }
  const all = S.soulWeapon(key(S.idOf(S.SOUL_KEYS)));
  assert.equal(all.name, S.EVERHEART);
  assert.ok(all.line && all.round && all.chain && all.daze && all.sweep, 'it strikes every way there is');
  // Said one way only: anything else is no weapon.
  for (const bad of ['', 'star', 'soul:', 'soul:moon', 'soul:star+star', 'soul:star+nod+wild', 'soul:constructor', `soul:${'star+'.repeat(20)}`, 7, null]) assert.equal(S.soulWeapon(bad), null, String(bad));
  assert.equal(S.soulWeapon('soul:nod+star+wild').name, 'Three-Soul Lullaby');
  assert.equal(cleanLook({ ...LOOK, weapon: 'soul:star+nod+wild' }).weapon, undefined);
});

// ---------------------------------------------------------------- parts

const place = (game, stage) => S.placeOf({ run: game, journey: 1, stage });

test('a golden chest holds one part on each island; any of them, so one you have already now and then', () => {
  const souls = S.emptySouls();
  const rand = dice(5);
  const got = S.drawPart(souls, 'wild', place(1, 20), rand);
  assert.ok(got.fresh && !got.spare);
  assert.equal(S.takePart(souls, 'wild', got.i, place(1, 20)), 1);
  assert.equal(S.drawPart(souls, 'wild', place(1, 20), rand), null, 'no more on that one');
  assert.ok(!S.partWaits(souls, 'wild', place(1, 20)) && S.partWaits(souls, 'wild', place(1, 21)) && S.partWaits(souls, 'wild', place(2, 20)));
  assert.ok(S.partWaits(souls, 'star', place(1, 20)), 'another weapon’s is another matter');
  // Every part comes of it as likely as another.
  const seen = [0, 0, 0, 0, 0, 0];
  for (let n = 0; n < 6000; n++) seen[S.drawPart(S.emptySouls(), 'wild', place(1, 20), rand).i]++;
  for (const c of seen) assert.ok(c > 850 && c < 1150, seen.join());
  // One you have already, about as often as you would think.
  const some = S.emptySouls();
  some.parts.wild = [1, 1, 1, 0, 0, 0];
  let dupes = 0;
  for (let n = 0; n < 2000; n++) if (!S.drawPart(some, 'wild', place(3, 20), rand).fresh) dupes++;
  assert.ok(dupes > 850 && dupes < 1150, `${dupes}`);
});

test('an episode is always gone through more than once for a whole weapon, and it does come in the end', () => {
  for (const w of S.SOULS) {
    const stages = stagesOf(w.episode);
    const games = [];
    for (let seed = 1; seed <= 400; seed++) {
      const souls = S.emptySouls();
      const rand = dice(seed * 7919 + w.episode);
      let game = 0;
      while (!S.canForge(souls, w.key)) {
        game++;
        assert.ok(game < 12, `${w.name} in the end`);
        for (let stage = 1; stage <= stages && !S.canForge(souls, w.key); stage++) {
          const got = S.drawPart(souls, w.key, place(game, stage), rand);
          S.takePart(souls, w.key, got.i, place(game, stage));
        }
      }
      games.push(game);
    }
    assert.ok(Math.min(...games) >= 2, `${w.name}: never out of one game`);
    const mean = games.reduce((a, b) => a + b, 0) / games.length;
    assert.ok(mean < 4, `${w.name}: ${mean.toFixed(2)} games`);
  }
});

test('the last part is never in the one game that had all the rest, and nobody is unlucky for ever', () => {
  const souls = S.emptySouls();
  souls.parts.toon = [1, 1, 1, 1, 1, 0];
  souls.got.toon = [place(4, 30), place(4, 31), place(4, 32), place(4, 33)];
  for (let n = 1; n <= 300; n++) assert.notEqual(S.drawPart(souls, 'toon', place(4, 34), dice(n * 7919)).i, 5);
  let found = 0;
  for (let n = 1; n <= 300; n++) if (S.drawPart(souls, 'toon', place(5, 30), dice(n * 7919)).i === 5) found++;
  assert.ok(found > 0, 'in another game it may be');
  // Four running they had already, and the next is one they have not.
  const unlucky = S.emptySouls();
  unlucky.parts.star = [1, 1, 1, 1, 1, 1, 0, 0];
  unlucky.got.star = [place(1, 1), place(2, 1)];
  for (let n = 0; n < 4; n++) S.takePart(unlucky, 'star', 0, place(2, 2 + n));
  for (let n = 1; n <= 200; n++) assert.ok([6, 7].includes(S.drawPart(unlucky, 'star', place(3, 1), dice(n * 7919)).i));
  S.takePart(unlucky, 'star', 6, place(3, 1));
  assert.equal(unlucky.dupes.star, undefined, 'and it counts from the start again');
});

test('a part to spare melts into coins, and never the last one the weapon wants', () => {
  const souls = S.emptySouls();
  souls.parts.bells = [1, 3, 0, 0, 0, 0];
  assert.equal(S.spareOf(souls, 'bells', 0), 0);
  assert.equal(S.spareOf(souls, 'bells', 1), 2);
  assert.ok(!S.meltPart(souls, 'bells', 0) && !S.meltPart(souls, 'bells', 2) && !S.meltPart(souls, 'bells', 99));
  assert.ok(S.meltPart(souls, 'bells', 1) && S.meltPart(souls, 'bells', 1) && !S.meltPart(souls, 'bells', 1));
  assert.deepEqual(souls.parts.bells, [1, 1, 0, 0, 0, 0]);
  // Put together, whatever is left is to spare.
  souls.parts.bells = full('bells');
  souls.parts.bells[0] = 2;
  assert.ok(S.forge(souls, 'bells'));
  assert.deepEqual(souls.parts.bells, [1, 0, 0, 0, 0, 0]);
  assert.deepEqual(S.drawPart(souls, 'bells', place(9, 25), dice(1)).spare, true);
  assert.ok(S.meltPart(souls, 'bells', 0));
  assert.equal(souls.parts.bells, undefined);
});

// ---------------------------------------------------------------- the forge

test('put together out of every part, its soul beaten, and only then is it theirs', () => {
  const souls = S.emptySouls();
  assert.ok(!S.canForge(souls, 'nod') && !S.forge(souls, 'nod'));
  souls.parts.nod = full('nod');
  souls.parts.nod[2] = 0;
  assert.ok(!S.forge(souls, 'nod'), 'not with one missing');
  souls.parts.nod[2] = 1;
  assert.ok(!S.winSoul(souls, 'nod'), 'nor is a soul there to beat before it is put together');
  assert.ok(S.forge(souls, 'nod'));
  assert.ok(S.isMade(souls, 'nod') && !S.ownsSoul(souls, 'nod') && !S.forge(souls, 'nod'));
  assert.equal(S.pickedSoul(souls), null, 'nobody holds it yet');
  assert.ok(S.winSoul(souls, 'nod') && !S.winSoul(souls, 'nod'));
  assert.ok(S.ownsSoul(souls, 'nod') && !S.isMade(souls, 'nod'));
  assert.equal(S.pickedSoul(souls).name, 'Lullaby');
});

test('two combined keep the form of the first and lose nothing: taken apart again, both are there', () => {
  const souls = S.emptySouls();
  souls.held = ['star', 'nod', 'wild'];
  assert.equal(S.fusionOf(souls, 'star', 'star'), '');
  assert.equal(S.fusionOf(souls, 'star', 'toon'), '', 'not one that is not theirs');
  assert.equal(S.fuse(souls, 'nod', 'star'), 'nod+star');
  assert.deepEqual(souls.held, ['nod+star', 'wild']);
  assert.equal(S.pickedSoul(souls).name, 'Moonstar');
  assert.equal(S.fuse(souls, 'wild', 'nod+star'), 'wild+star+nod');
  assert.deepEqual(souls.held, ['wild+star+nod']);
  assert.equal(S.ownedCount(souls), 3);
  assert.equal(S.split(souls, 'nod'), null);
  assert.deepEqual(S.split(souls, 'wild+star+nod'), ['wild', 'star', 'nod']);
  assert.deepEqual(souls.held, ['wild', 'star', 'nod']);
  assert.equal(S.pickedSoul(souls).name, 'Wildheart');
  // All six, one after another.
  const all = S.emptySouls();
  all.held = [...S.SOUL_KEYS];
  let id = 'toon';
  for (const k of S.SOUL_KEYS) if (k !== 'toon') id = S.fuse(all, id, k);
  assert.equal(S.pickedSoul(all).name, S.EVERHEART);
  assert.equal(all.held.length, 1);
});

test('what someone has is tidied, kept at the keeper, and added up for a guest', () => {
  assert.deepEqual(S.cleanSouls(null), S.emptySouls());
  const messy = S.cleanSouls({
    parts: { star: [1, -2, 'x', 1e9, 1.5], moon: [1], wild: [0, 0, 0, 0, 0, 0] },
    made: ['star', 'nod', 'nope', 'nod'],
    held: ['nod+star', 'star', 'bells', 'bells', '<b>', null],
    pick: 'toon',
    dupes: { star: 99, wild: -1 },
    got: { star: ['1/1:3', '1/1:3', 'nonsense', 7], bells: 'x' },
  });
  assert.deepEqual(messy.parts, { star: [1, 0, 0, S.PART_MAX, 0, 0, 0, 0] });
  assert.deepEqual(messy.held, ['nod+star', 'bells'], 'each soul only ever in one');
  assert.deepEqual(messy.made, [], 'and never both made and theirs');
  assert.equal(messy.pick, '');
  assert.deepEqual(messy.got, { star: ['1/1:3'] });
  assert.deepEqual(S.cleanSouls(JSON.parse(JSON.stringify(messy))), messy, 'the same again');
  const mine = { ...S.emptySouls(), parts: { wild: [1, 0, 2, 0, 0, 0] }, held: ['star'], got: { wild: ['1/1:20'] } };
  const theirs = { ...S.emptySouls(), parts: { wild: [1, 1, 0, 0, 0, 0] }, held: ['star+bells'], made: ['nod', 'star'], got: { wild: ['1/1:21'] } };
  const sum = S.addSouls(mine, theirs);
  assert.deepEqual(sum.parts.wild, [2, 1, 2, 0, 0, 0]);
  assert.deepEqual(sum.held, ['star', 'bells']);
  assert.deepEqual(sum.made, ['nod']);
  assert.deepEqual(sum.got.wild, ['1/1:20', '1/1:21']);
  // In a profile at the keeper, beside the rest of the gear.
  const kept = keptProfile({ name: 'Sunny Otter', gear: { weapon: 2, souls: { held: ['star'], pick: 'star', parts: { wild: [1, 0, 0, 0, 0, 0] } } }, changedAt: 5 });
  assert.deepEqual(kept.gear.souls.held, ['star']);
  const merged = mergeProfiles({ name: 'Sunny Otter', gear: { souls: { held: ['star'] } }, changedAt: 10 }, { name: 'Sunny Otter', gear: { souls: { held: ['star', 'nod'] } }, changedAt: 20 });
  assert.deepEqual(merged.gear.souls.held, ['star', 'nod'], 'the one that changed last');
  const added = addProgress({ name: 'A', gear: { souls: { parts: { star: full('star') } } } }, { name: 'B', gear: { souls: { parts: { star: full('star') }, made: ['toon'] } } });
  assert.ok(added.gear.souls.parts.star.every((n) => n === 2));
  assert.deepEqual(added.gear.souls.made, ['toon']);
});

test('the one in hand is worn as any weapon is, and shows in the look', () => {
  const gear = cleanGear({ weapon: 3, souls: { held: ['bells', 'star+nod'], pick: 'star+nod' } });
  assert.equal(wornWeapon(gear).name, 'Moonstar');
  assert.equal(lookWithGear(LOOK, gear).weapon, 'soul:star+nod');
  assert.equal(wornWeapon({ ...gear, off: { weapon: true } }), null, 'put away');
  gear.souls.pick = '';
  assert.equal(wornWeapon(gear).key, WEAPONS[2].key, 'or one from the shop');
  assert.equal(wornWeapon(cleanGear({ souls: { held: ['toon'], pick: 'toon' } })).name, 'Doodle', 'with none from the shop at all');
});

test('yours, on the isle: found, put together, won, combined, held and melted, each counted', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    const { Profile } = await import('../public/js/profile.js');
    const p = new Profile();
    const rand = dice(11);
    const first = p.findPart('rainbow', place(1, 13), rand);
    assert.deepEqual({ fresh: first.fresh, have: first.have, found: first.found }, { fresh: true, have: 1, found: 1 });
    assert.equal(p.findPart('rainbow', place(1, 13), rand), null);
    assert.equal(p.data.stats.parts, 1);
    assert.equal(p.forgeSoul('rainbow'), false);
    p.data.gear.souls.parts = { rainbow: full('rainbow'), star: [3, ...full('star').slice(1)] };
    const coins = p.data.coins;
    assert.ok(p.meltPart('star', 0) && p.data.coins === coins + S.MELT_COINS);
    assert.ok(p.forgeSoul('rainbow') && p.forgeSoul('star') && !p.forgeSoul('star'));
    assert.ok(!p.beatSoul('nod'));
    p.data.gear.weapon = 2;
    assert.ok(p.beatSoul('rainbow'));
    assert.equal(wornWeapon(p.data.gear).name, 'Prisma', 'in your hand');
    assert.equal(p.useWeapon(), null, 'and it never wears');
    assert.ok(p.beatSoul('star'));
    assert.deepEqual(p.weapons.map((w) => w.name), [WEAPONS[0].name, WEAPONS[1].name, 'Prisma', 'Starfall']);
    // Round them all, with the button by the bop button.
    const round = Array.from({ length: 4 }, () => p.nextWeapon().name);
    assert.deepEqual(round, [WEAPONS[0].name, WEAPONS[1].name, 'Prisma', 'Starfall']);
    assert.equal(p.pickWeapon(2).key, WEAPONS[1].key);
    assert.equal(p.data.gear.souls.pick, '');
    p.wear('weapon', false);
    assert.equal(wornWeapon(p.data.gear), null);
    assert.equal(p.pickSoul('star').name, 'Starfall');
    assert.equal(p.pickSoul('bells'), null);
    assert.equal(p.fuseSouls('star', 'rainbow').name, 'Starbow');
    assert.deepEqual(p.data.gear.souls.held, ['star+rainbow']);
    assert.deepEqual(p.splitSoul('star+rainbow'), ['star', 'rainbow']);
    const { stats } = p.data;
    assert.deepEqual([stats.forged, stats.souls, stats.fused, stats.soulmax], [2, 2, 1, 2]);
    for (const k of ['parts', 'forged', 'souls', 'fused', 'soulmax']) assert.ok(STAT_KEYS.includes(k), k);
    for (const k of ['parts', 'forged', 'souls', 'fused', 'soulmax']) assert.ok(XP_FOR[k].xp > 0, `${k} earns XP`);
    for (const s of ['soul-part', 'soul-smith', 'soul-keeper', 'soul-fusion', 'everheart']) assert.ok(STICKERS.some((x) => x.key === s), s);
    assert.deepEqual(new Profile().data.gear.souls.held, ['star', 'rainbow'], 'kept');
  } finally {
    delete globalThis.localStorage;
  }
});

// ---------------------------------------------------------------- at the host

// A flat meadow with monsters on and someone on it with a soul weapon in hand.
function meadow(weapon) {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  const W = 96;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.world = w;
  room.hookWorld();
  room.critters.list.length = 0;
  room.monsters.spawnAt = Infinity;
  const c = { inbox: [], close() {} };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.all = (t, kind) => c.inbox.filter((m) => m.t === t && (!kind || m.kind === kind));
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Brave Otter', look: { ...LOOK, weapon } });
  const { x, z } = w.spawn;
  room.receive(c, { t: 'm', s: [x, 11, z, 0, 0, 0] });
  const monster = (dx, dz, hearts = 60) => {
    const m = room.monsters.add(w, x + dx, 11, z + dz);
    Object.assign(m.body, { x: x + dx, y: 11, z: z + dz, vx: 0, vy: 0, vz: 0 });
    m.giggle = Infinity;
    m.hearts = hearts;
    m.max = hearts;
    return m;
  };
  return { room, time, w, c, x, z, monster, pid: c.all('welcome')[0].you };
}

test('a blow of one takes all its hearts, as far off as it strikes and no further', () => {
  for (const k of S.SOUL_KEYS) {
    const { room, c, monster } = meadow(key(k));
    const spec = S.soulWeapon(key(k));
    const near = monster(0, 2.2);
    const far = monster(0, ARM_REACH + spec.reach - 0.4);
    const off = monster(0, ARM_REACH + spec.reach + 5);
    for (const m of [near, far, off]) room.receive(c, { t: 'bop', id: m.id });
    assert.equal(near.hearts, 60 - spec.power, spec.name);
    assert.equal(far.hearts, 60 - spec.power, `${spec.name}, as far as it goes`);
    assert.equal(off.hearts, 60, `${spec.name}, not across the meadow`);
  }
});

test('Wildheart’s wolf leaps on from one to the next, once a swing; Clarion’s din and Lullaby’s moon leave what they bop dizzy', () => {
  const wild = meadow('soul:wild');
  const spec = S.soulWeapon('soul:wild');
  const pack = [[0, 2.4], [2.5, 3], [2.5, 6], [0, 7.5], [-3, 8.5], [-5, 11]].map(([dx, dz]) => wild.monster(dx, dz));
  wild.c.inbox.length = 0;
  wild.room.receive(wild.c, { t: 'bop', id: pack[0].id });
  wild.room.receive(wild.c, { t: 'bop', id: pack[1].id });
  const bolts = wild.c.all('fx', 'bolt');
  assert.equal(bolts.length, 1, 'one wolf, however many the swing bops');
  assert.deepEqual(bolts[0].ids, pack.slice(0, 1 + spec.chain).map((m) => m.id));
  for (const m of pack.slice(0, 1 + spec.chain)) assert.equal(m.hearts, 60 - spec.power);
  assert.equal(pack[5].hearts, 60, 'four leaps and no more');
  for (const k of ['bells', 'nod']) {
    const { room, time, c, monster } = meadow(key(k));
    const m = monster(0, 2.2);
    room.receive(c, { t: 'bop', id: m.id });
    assert.ok(m.dazed > time.t + 1000, `${k}: dizzy`);
    // Bopped while it is, it feels it twice.
    time.t += 900;
    m.body.x = room.world.spawn.x;
    m.body.z = room.world.spawn.z + 2.2;
    room.receive(c, { t: 'bop', id: m.id });
    assert.equal(m.hearts, 60 - 3 * S.soulWeapon(key(k)).power, k);
  }
  const star = meadow('soul:star');
  const m = star.monster(0, 2.2);
  star.room.receive(star.c, { t: 'bop', id: m.id });
  assert.ok(!(m.dazed > star.time.t), 'Starfall’s does not');
});

test('a part out of a golden chest is for whoever opened it, for everyone there to see; nothing touches them as they look', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '717171', adventure: true, shared: true, stage: 1, seed: 9, now: () => time.t });
  const join = (name) => {
    const c = { inbox: [], close() {} };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: LOOK, tickets: [] });
    c.pid = c.inbox.find((m) => m.t === 'welcome').you;
    return c;
  };
  const a = join('Keen Owl');
  const b = join('Brave Fox');
  const said = () => b.inbox.filter((m) => m.t === 'soul');
  room.receive(a, { t: 'soul', op: 'part', w: 'star', i: 2, at: [0, 0, 0] });
  assert.equal(said().length, 0, 'not without having opened one');
  for (let i = 0; i < 12 * 40 && !room.adventure.chests.list.length; i++) {
    time.t += 100;
    room.tick();
  }
  const gold = room.adventure.chests.list.find((o) => B.BLOCKS[room.world.get(o.x, o.y, o.z)].model === 'gold-chest');
  assert.ok(gold, 'one of them is golden');
  const p = room.players.get(a.pid);
  p.s = [gold.x + 0.5, gold.y, gold.z + 1.5, 0, 0, 0];
  room.receive(a, { t: 'chest', at: [gold.x, gold.y, gold.z] });
  time.t += 1500;
  room.receive(a, { t: 'soul', op: 'part', w: 'star', i: 99, at: p.s.slice(0, 3) });
  assert.equal(said().length, 0, 'no such part');
  time.t += 1600;
  room.receive(a, { t: 'soul', op: 'part', w: 'star', i: 2, at: [gold.x + 0.5, gold.y + 0.5, gold.z + 0.5] });
  assert.deepEqual(said().map(({ op, pid, w, i }) => ({ op, pid, w, i })), [{ op: 'part', pid: a.pid, w: 'star', i: 2 }]);
  assert.ok(p.safeUntil >= time.t + 9000);
  time.t += 2000;
  room.receive(a, { t: 'soul', op: 'part', w: 'star', i: 3, at: p.s.slice(0, 3) });
  assert.equal(said().length, 1, 'one a chest');
  // What is done with them at the forge is told too, not too often.
  time.t += 2000;
  room.receive(a, { t: 'soul', op: 'forged', w: 'star' });
  room.receive(a, { t: 'soul', op: 'forged', w: 'star' });
  time.t += 2000;
  room.receive(a, { t: 'soul', op: 'won', w: 'star' });
  time.t += 2000;
  room.receive(a, { t: 'soul', op: 'fused', key: 'soul:star+nod' });
  time.t += 2000;
  for (const bad of [{ op: 'fused', key: 'soul:star' }, { op: 'forged', w: 'moon' }, { op: 'nope', w: 'star' }, {}]) {
    time.t += 2000;
    room.receive(a, { t: 'soul', ...bad });
  }
  assert.deepEqual(said().slice(1).map((m) => [m.op, m.w ?? m.key]), [['forged', 'star'], ['won', 'star'], ['fused', 'soul:star+nod']]);
});

// ---------------------------------------------------------------- the souls

test('each soul has a world of its own, where you and it stand clear of each other and of everything', () => {
  assert.deepEqual(ARENA_KEYS, S.SOUL_KEYS.map((k) => `soul${k}`));
  for (const k of ARENA_KEYS) {
    assert.ok(isNodKey(k) && !NOD_KEYS.includes(k), 'not one of the dreams');
    assert.equal(nodKey(nodTheme(k)), k);
    assert.equal(normalizeMeta({ theme: nodTheme(k) }).theme, nodTheme(k), 'and a page is told of it as it is');
    const w = nodWorld(k);
    assert.equal(nodWorld(k), w, 'made once');
    assert.deepEqual([w.nightmares.length, w.springs.length, w.winks.length, w.roam.length, w.chests.length], [0, 0, 0, 0, 0]);
    const floor = w.space.byKey.get('floor');
    for (const s of [w.start, w.boss.at]) {
      assert.equal(s.body, floor);
      assert.ok(Math.abs(floor.ground(s.x, s.y, s.z)) < 0.05, `${k}: on the ground`);
      assert.ok(floor.clutter(s.x + s.up.x, s.y + s.up.y, s.z + s.up.z) > 1.3, `${k}: room to stand`);
    }
    const apart = dist3(w.start, w.boss.at);
    assert.ok(apart > 9 && apart < 26, `${k}: ${apart.toFixed(1)} apart`);
    assert.equal(w.boss.kind, k);
    for (const b of w.space.bodies) if (b !== floor) assert.ok(dist3(b.c, floor.c) > floor.reach + b.reach * 0.6, `${k}: ${b.key} well off`);
  }
});

test('each soul shows every blow, has more than one way in, and a tip to its name', () => {
  for (const k of S.SOUL_KEYS) {
    const f = FRIGHTS[`soul${k}`];
    assert.equal(f, SOUL_FOES[`soul${k}`]);
    assert.equal(f.name, S.soulOf(k).soul.name);
    assert.ok(NOD_BOSSES[`soul${k}`].moves.length === 3 && f.told.includes(f.name));
    const ways = new Set();
    for (const m of f.moves) {
      assert.ok(MOVES[m.k] && m.windup >= 400, `${k} ${m.k}: shown before it lands`);
      if (m.k === 'wave' && m.n > 1) assert.ok(m.gap >= 800, `${k}: time to jump each ring`);
      if (m.open) assert.ok(OPENINGS[m.open], m.open) || ways.add(m.open);
      if (m.back) ways.add('back');
      if (m.flash) ways.add('flash');
      for (const o of m.also ?? []) assert.ok(MOVES[o.mv.k] && o.mv.windup >= 400 && o.after > 0);
    }
    if (f.bonk) ways.add('bonk');
    assert.ok(ways.size >= 3, `${k}: ${[...ways].join()}`);
    // Something for it to do from wherever you are, however cross it is.
    for (const gone of [0, 0.4, 0.7]) {
      const o = { max: 100, hearts: 100 * (1 - gone), camp: 'boss' };
      for (const far of [1, 4, 8, 14, 24]) assert.ok(f.moves.some((m) => far >= (m.near ?? 0) && far <= m.far && (!m.when || m.when(o, { of: () => [] }))), `${k} at ${far}, ${gone} gone`);
    }
    for (const m of f.moves.filter((o) => o.k === 'call')) assert.ok(FRIGHTS[m.kind], m.kind);
  }
});

const duelRoom = (k, time, seed = 9) => new Room({ code: '515151', soul: k, seed, now: () => time.t });
function duellist(room, look = {}) {
  const c = { inbox: [], close() {} };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.all = (t, what) => c.inbox.filter((m) => m.t === t && (!what || m.k === what));
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Keen Owl', look: { ...LOOK, ...look } });
  c.welcome = c.all('welcome')[0];
  c.pid = c.welcome.you;
  return c;
}
function stay(room, time, c, at, ms, each = null) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [at.x, at.y, at.z, 0, 0, 0] });
    room.tick();
    if (each?.() === false) return;
  }
}

test('a duel: its soul comes as you arrive, gathers itself at a third of its hearts and two, and beaten the weapon is won', () => {
  for (const k of S.SOUL_KEYS) {
    const time = { t: 1_000_000 };
    const room = duelRoom(k, time);
    assert.ok(room.adventure instanceof SoulDuel && room.shared && room.adventure.active);
    const c = duellist(room);
    const { adventure, meta, shared } = c.welcome;
    assert.ok(shared === true && adventure.duel === k && adventure.nod.key === `soul${k}`);
    assert.equal(meta.theme, `nodsoul${k}`);
    assert.equal(duelStory(k).nightmares[0].name, S.soulName(S.soulOf(k)));
    const { dream } = room.adventure;
    assert.equal(dream.level, DUEL_LEVEL[k]);
    const at = dream.world.start;
    stay(room, time, c, at, 1500);
    assert.equal(dream.frights.list.length, 0, 'a moment to look about');
    stay(room, time, c, at, 4500);
    const f = dream.frights.list.find((o) => o.kind === `soul${k}`);
    assert.ok(f, `${k} is here`);
    assert.deepEqual(c.all('nx', 'soulsays').map((m) => m.i), [0]);
    // A bop on its guard only clangs.
    room.receive(c, { t: 'm', s: [f.x, f.y, f.z, 0, 0, 0] });
    const hearts = f.hearts;
    room.receive(c, { t: 'nod', op: 'bop', ids: [f.id] });
    assert.equal(f.hearts, hearts);
    // Opened again and again, whatever else it does.
    let over = false;
    for (let n = 0; n < 900 && !over; n++) {
      time.t += 100;
      room.tick();
      room.players.get(c.pid).safeUntil = Infinity;
      if (!f.open) {
        f.immune = 0;
        dream.frights.opens(f, 'stun', time.t);
      }
      f.alt = 0;
      room.receive(c, { t: 'm', s: [f.x, f.y, f.z, 0, 0, 0] });
      room.receive(c, { t: 'nod', op: 'bop', ids: [f.id] });
      over = c.all('duel').length > 0;
    }
    assert.ok(over, `${k} is beaten`);
    assert.deepEqual(c.all('duel').map(({ won, w }) => [won, w]), [[true, k]]);
    assert.deepEqual(c.all('nx', 'soulsays').map((m) => m.i), [0, 1, 2]);
    assert.ok(room.adventure.won && !room.adventure.active);
    assert.equal(c.all('won').length, 0, 'no stage of the isle is won by it');
    stay(room, time, c, at, 6000);
    assert.equal(c.all('duel').length, 1, 'once');
    assert.equal(dream.frights.list.length, 0, 'and nothing is left of it');
  }
});

test('out of HP it is lost, there and then: no waking up with all of it again, and no potions', () => {
  const time = { t: 1_000_000 };
  const room = duelRoom('star', time);
  const c = duellist(room);
  const p = room.players.get(c.pid);
  const { dream } = room.adventure;
  stay(room, time, c, dream.world.start, 6000);
  const hurt = () => {
    let a = null;
    stay(room, time, c, dream.world.start, 20_000, () => {
      a = [...dream.frights.acts.values()].find((o) => !o.got?.has(c.pid) && o.strike - time.t < 300 && o.strike > time.t - 200);
      return !a;
    });
    assert.ok(a, 'a blow on its way');
    time.t = Math.max(time.t, p.safeUntil ?? 0) + 10;
    a.strike = time.t;
    room.receive(c, { t: 'nod', op: 'hurt', a: a.id });
  };
  hurt();
  assert.ok(p.hp < p.maxHp && p.hp > 0, `${p.hp}`);
  const hp = p.hp;
  room.receive(c, { t: 'potion' });
  assert.equal(p.hp, hp, 'no potions');
  for (let n = 0; n < 40 && p.hp > 0; n++) {
    p.hp = Math.min(p.hp, 25);
    hurt();
  }
  const last = c.all('bump').at(-1);
  assert.ok(last.lost && last.dizzy && !last.home, 'lost, where you are');
  assert.ok(room.adventure.lost && !room.adventure.active);
  stay(room, time, c, dream.world.start, 8000);
  assert.equal(p.hp, 0, 'and it stays so');
  assert.equal(c.all('home').length, 0);
});

test('nobody builds, saves or wins a stage in a duel; nonsense about one is shrugged off', () => {
  const time = { t: 1_000_000 };
  const room = duelRoom('toon', time);
  const c = duellist(room);
  assert.equal(room.host, 0, 'nobody’s island');
  for (const msg of [{ t: 'chest', at: [1, 1, 1] }, { t: 'soul', op: 'forged', w: 'star' }, { t: 'nod', op: 'chest', i: 0 }, { t: 'nod', op: 'wink', i: 0 }, { t: 'nod', op: 'fling', s: 1 }, { t: 'isle', op: 'new' }, { t: 'help', pid: 1 }, { t: 'nod', op: 'burst' }, { t: 'nod', op: 'slam' }]) {
    time.t += 2000;
    assert.doesNotThrow(() => room.receive(c, msg), JSON.stringify(msg));
  }
  room.tick();
  assert.equal(c.all('soul').length, 0);
  assert.equal(new Room({ code: '1', soul: 'moon', seed: 3 }).adventure, null, 'no such soul: an island like any other');
  assert.equal(duelStory('moon'), null);
  // (What fights there is the same dream of nothing but its boss.)
  const dream = new Dream({ key: 'soulnod', story: duelStory('nod'), level: 17 }, 4);
  assert.ok(dream.bossReady && !dream.won && dream.boss.id === 1);
});

// ---------------------------------------------------------------- in the hand

test('each is swung its own way, and is there in the hand of whoever holds it', () => {
  const forms = new Set();
  for (const w of S.SOULS) {
    const swing = swingOf(key(w.key));
    assert.equal(swing, SOUL_SWINGS[w.form]);
    forms.add(swing);
    assert.ok(swing.secs > 0.3 && swing.secs < 0.8 && swing.strike > 0.2 && swing.strike < 0.8, w.name);
    assert.deepEqual([swing.keys[0].w ?? 0, swing.keys.at(-1).w ?? 0], [0, 0], `${w.name}: from how the hand hangs, and back to it`);
    for (let k = 0; k <= 1; k += 0.02) for (const v of Object.values(swingPose(swing, k))) assert.ok(Number.isFinite(v), w.name);
  }
  assert.equal(forms.size, 6);
  assert.equal(swingOf('soul:moon'), swingOf('punch'));
  const a = new Avatar({ ...LOOK, weapon: 'soul:wild+star' });
  assert.equal(a.weaponKind, 'soul:wild+star');
  const lands = a.swing();
  assert.ok(lands > 0.05 && lands < 0.6);
  for (let i = 0; i < 60; i++) a.update(1 / 60, 0, 0);
  a.setLook({ ...LOOK });
  assert.notEqual(a.weaponKind, 'soul:wild+star');
  a.dispose();
});

test('every soul’s floor is level enough to fight on, and up is up all the way across it', () => {
  for (const k of ARENA_KEYS) {
    const w = nodWorld(k);
    const floor = w.space.byKey.get('floor');
    const path = floor.walk(w.start, { x: w.boss.at.x - w.start.x, y: w.boss.at.y - w.start.y, z: w.boss.at.z - w.start.z }, 10, 0.5);
    for (const q of path) {
      assert.ok(dot(floor.slope(q.x, q.y, q.z), q.up) > 0.7, `${k}: no cliffs in the way`);
    }
  }
});
