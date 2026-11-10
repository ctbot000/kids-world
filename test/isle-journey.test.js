// Adventure Isle's harder later stages (shared/adventure.js): a camp's
// monsters coming back only so many times, its flag sliding back down while
// they hold it, an ambush half way up it, hazards coming down on the way
// between the camps, King Grumble getting his second wind at the end of the
// story, and the captains of the later chapters (shared/bosses.js) fighting
// in their lairs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdventureSim, ambushFor, HAZARD, reserveFor, SECOND_WIND } from '../public/js/shared/adventure.js';
import { BOSSES } from '../public/js/shared/bosses.js';
import { buildIsle } from '../public/js/shared/isle-maps.js';
import { chapterOf, STAGES, stagesOf } from '../public/js/shared/isle-story.js';
import { MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name = 'Brave Fox') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat' } });
  c.pid = c.last('welcome').you;
  return c;
}

const isleRoom = (stage, time) => new Room({ code: '515151', adventure: true, shared: true, stage, seed: 9, now: () => time.t });
const onFoot = (id, x, y, z) => ({ id, x, y, z, flying: false, riding: false, dizzy: false, safeUntil: 0 });

test('on the isle’s higher stages a camp’s monsters come back only so many times, so a camp is never hopeless', () => {
  const stage = 6;
  const made = buildIsle({ stage, seed: 3 });
  const sim = new AdventureSim({ camps: made.camps, stage }, 1);
  const monsters = new MonsterSim(1);
  const c = sim.campById(1);
  sim.wake(made.world, c, [], monsters, 1);
  assert.equal(c.reserve, reserveFor(1, stage));
  // Each one popped comes back out of the reserve, until it is gone.
  const start = c.reserve;
  for (let i = 0; i < start; i++) sim.guardGone(monsters.list.find((m) => m.camp === c.id && m.kind !== 'queen' && !m.champion), 1000 + i);
  assert.equal(c.reserve, 0);
  assert.equal(c.back.length, start);
  sim.guardGone(monsters.list.find((m) => m.camp === c.id && m.kind !== 'queen' && !m.champion), 9000);
  assert.equal(c.back.length, start, 'none comes back once the reserve is gone');
  // Asleep and awake again, the reserve stays as low as it got.
  sim.sleep(c, monsters);
  sim.wake(made.world, c, [], monsters, 1);
  assert.equal(c.reserve, 0);
  // On the first stages they always come back.
  const early = new AdventureSim({ camps: buildIsle({ stage: 2, seed: 3 }).camps, stage: 2 }, 1);
  early.wake(made.world, early.campById(1), [], new MonsterSim(2), 1);
  assert.equal(early.campById(1).reserve, Infinity);
});

test('a flag slides back down while the camp’s monsters hold it, and half way up they ambush whoever is raising it, once', () => {
  const stage = 5;
  const made = buildIsle({ stage, seed: 3 });
  const sim = new AdventureSim({ camps: made.camps, stage }, 1);
  const monsters = new MonsterSim(1);
  const c = sim.campById(1);
  const me = onFoot(1, c.x + 1, c.y, c.z);
  sim.wake(made.world, c, [me], monsters, 1);
  c.progress = 0.4;
  sim.stepCamp(made.world, c, 1, 1000, [me], monsters, 9, []);
  assert.ok(c.guarded && c.progress < 0.4, 'held by its monsters: sliding back');
  // Every monster gone, and the flag going up: half way, the ambush.
  for (const m of [...monsters.list]) monsters.remove(m.id);
  c.back = [];
  c.reserve = 0;
  const news = [];
  for (let t = 0; t < 40 && !news.length; t++) sim.stepCamp(made.world, c, 0.25, 2000 + t * 250, [me], monsters, 9, news);
  assert.deepEqual(news.map((n) => n.t), ['ambush']);
  assert.ok(c.progress >= 0.5);
  const ambush = monsters.list.filter((m) => m.camp === c.id);
  assert.equal(ambush.length, ambushFor(1, stage));
  assert.ok(ambush.every((m) => m.helper), 'they come only the once');
  // Popped, and up it goes, with no second ambush.
  for (const m of ambush) monsters.remove(m.id);
  const more = [];
  for (let t = 0; t < 200 && !more.some((n) => n.t === 'freed'); t++) sim.stepCamp(made.world, c, 0.25, 30000 + t * 250, [me], monsters, 9, more);
  assert.deepEqual(more.map((n) => n.t), ['freed']);
  // On stage 1 nothing slides back, and there is no ambush.
  const first = new AdventureSim({ camps: buildIsle({ stage: 1, seed: 3 }).camps, stage: 1 }, 1);
  const c1 = first.campById(1);
  const m1 = new MonsterSim(4);
  first.wake(made.world, c1, [me], m1, 1);
  c1.progress = 0.4;
  first.stepCamp(made.world, c1, 1, 1000, [me], m1, 9, []);
  assert.equal(c1.progress, 0.4);
});

test('hazards come down on the way between the camps, on rings shown first, and hit whoever is still there', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(3, time);
  const adv = room.adventure;
  const a = join(room);
  const p = room.players.get(a.pid);
  // Out on the way, between the first camp and the second, well away from both.
  const [c1, c2] = adv.camps;
  const spot = room.world.spawn;
  const way = [(c1.x + c2.x) / 2, (c1.z + c2.z) / 2];
  const far = (x, z) => adv.camps.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + 6) && Math.hypot(spot.x - x, spot.z - z) > 12;
  let at = null;
  for (let r = 0; r < 30 && !at; r++) {
    for (let k = 0; k < 16 && !at; k++) {
      const x = Math.floor(way[0] + Math.cos(k) * r) + 0.5;
      const z = Math.floor(way[1] + Math.sin(k) * r) + 0.5;
      const y = room.world.top(Math.floor(x), Math.floor(z)) + 1;
      if (far(x, z) && y > room.world.sea + 1) at = [x, y, z];
    }
  }
  assert.ok(at, 'a spot on the way');
  // (Nothing else about: no monsters, no camps waking.)
  adv.step = () => [];
  const hits = () => a.all('bump').length;
  let shown = null;
  for (let t = 0; t < 400 && !shown; t++) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [...at, 0, 0, 0] });
    p.safeUntil = 0;
    room.tick();
    shown = a.inbox.find((m) => m.t === 'mfx' && m.kind === 'hurl' && m.sky);
  }
  assert.ok(shown, 'one came');
  assert.equal(shown.what, chapterOf(3).hazard);
  assert.equal(shown.ms, HAZARD.ms);
  assert.ok(Math.hypot(shown.to[0][0] - at[0], shown.to[0][2] - at[2]) < 0.5, 'on whoever it was aimed at');
  const before = hits();
  const hp = p.hp;
  for (let t = 0; t < 20; t++) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [...at, 0, 0, 0] });
    room.tick();
  }
  assert.ok(hits() > before && p.hp < hp, 'stood still under it: hit');
  // None on the first stage.
  const quiet = isleRoom(1, time);
  assert.deepEqual(quiet.adventure.stepHazards(quiet.world, time.t, [onFoot(1, ...at)]), []);
});

test('at the very end of an episode its last boss gets a second wind before going pop for good', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(stagesOf(1), time);
  const adv = room.adventure;
  assert.equal(adv.story.final, true);
  const a = join(room);
  room.players.get(a.pid).safeUntil = Infinity;
  for (const c of adv.camps) if (c.kind === 'camp') room.campFreed(adv.free(c, [], room.monsters));
  const castle = adv.castle;
  time.t += 100;
  room.receive(a, { t: 'm', s: [castle.x + 4, castle.y, castle.z, 0, 0, 0] });
  room.tick();
  const king = room.monsters.list.find((m) => m.kind === 'king');
  assert.ok(king);
  const max = adv.king.max;
  adv.king.hearts = 1;
  const bop = () => {
    time.t += 1000;
    room.receive(a, { t: 'm', s: [king.body.x + king.body.radius + 0.8, king.body.y, king.body.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: king.id });
  };
  bop();
  assert.equal(a.last('kinghit').second, true, 'puffed up');
  assert.equal(adv.won, false);
  assert.equal(adv.king.hearts, Math.round(max * SECOND_WIND));
  assert.equal(adv.pack().k[2], 1, 'and pages arriving are told');
  adv.king.hearts = 1;
  bop();
  assert.equal(adv.won, true, 'popped for good');
  assert.equal(a.last('won').hero, a.pid);
  // Anywhere before the end of an episode, popped is popped.
  for (const stage of [stagesOf(1) - 1, stagesOf(1) + 1, STAGES - 1]) {
    const sim = isleRoom(stage, time).adventure;
    sim.king = { id: 1, hearts: 1, max: 10, minions: 0, hits: new Map(), hitAt: 0, healAt: 0 };
    for (const c of sim.camps) if (c.kind === 'camp') c.freed = true;
    assert.equal(sim.hitKing(1, 5000).beaten, true, `stage ${stage}`);
  }
  // And at the end of the second episode, Queen Grizzle puffs herself up the same way.
  const vale = isleRoom(STAGES, time).adventure;
  assert.deepEqual([vale.boss, vale.story.final, vale.story.last], ['grizzle', true, true]);
  vale.king = { id: 1, hearts: 1, max: 10, minions: 0, hits: new Map(), hitAt: 0, healAt: 0 };
  for (const c of vale.camps) if (c.kind === 'camp') c.freed = true;
  const puffed = vale.hitKing(1, 5000);
  assert.deepEqual([puffed.second, puffed.beaten, vale.king.hearts], [true, false, Math.round(10 * SECOND_WIND)]);
  vale.king.hearts = 1;
  assert.equal(vale.hitKing(1, 9000).beaten, true);
});

for (const stage of [5, 7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 19]) {
  const boss = chapterOf(stage).boss;
  test(`stage ${stage}: ${BOSSES[boss].name} holds the lair and fights with all its moves`, () => {
    const time = { t: 1_000_000 };
    const room = isleRoom(stage, time);
    const adv = room.adventure;
    assert.equal(adv.boss, boss);
    const a = join(room);
    const p = room.players.get(a.pid);
    for (const c of adv.camps) if (c.kind === 'camp') room.campFreed(adv.free(c, [], room.monsters));
    const castle = adv.castle;
    // (Now on one side of the yard, now the other: near and far.)
    let side = 5;
    const near = () => {
      time.t += 100;
      room.receive(a, { t: 'm', s: [castle.x + side, castle.y, castle.z + 1, 0, 0, 0] });
      p.hp = p.maxHp;
      p.dizzyUntil = 0;
      p.safeUntil = 0;
      room.tick();
    };
    near();
    const m = room.monsters.list.find((o) => o.kind === boss);
    assert.ok(m, 'out it comes');
    assert.ok(m.gapScale < 1, 'quicker than on the first stages');
    // Cross, with all its moves: each of them comes, at whoever is in reach of it.
    adv.king.hearts = Math.round(adv.king.max / 4);
    near();
    const moves = m.plan.moves.filter((mv) => mv.move !== 'call');
    for (const mv of moves) {
      let started = false;
      for (let t = 0; t < 80 && !started; t++) {
        // (Kept cross: left alone, it would get its hearts back.)
        adv.king.hearts = Math.round(adv.king.max / 4);
        if (!m.move && !m.windup) {
          m.turn = m.plan.moves.indexOf(mv);
          m.moveAt = 1;
        }
        // Close by for a stomp, a puff or a breath; a way off for the rest.
        const d = ['stomp', 'puff', 'breath'].includes(mv.move) ? 2.6 : 8;
        const toward = Math.atan2(castle.x - m.body.x, castle.z - m.body.z);
        side = m.body.x + Math.sin(toward) * d - castle.x;
        const zAt = m.body.z + Math.cos(toward) * d;
        time.t += 100;
        room.receive(a, { t: 'm', s: [castle.x + side, castle.y, zAt, 0, 0, 0] });
        p.hp = p.maxHp;
        p.dizzyUntil = 0;
        p.safeUntil = 0;
        room.tick();
        started = m.move?.move === mv.move;
      }
      assert.ok(started, `${boss}: ${mv.move}`);
      // Let it finish.
      for (let t = 0; t < 40 && (m.move || m.windup); t++) near();
    }
  });
}
