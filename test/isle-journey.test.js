// Adventure Isle's harder later stages (shared/adventure.js): a camp's
// monsters coming back only so many times, its flag sliding back down while
// they hold it, an ambush half way up it, hazards coming down on the way
// between the camps, nobody getting round a gate that is still shut, King
// Grumble getting his second wind at the end of the story, and the captains of
// the later chapters (shared/bosses.js) fighting in their lairs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { AdventureSim, ambushFor, HAZARD, reserveFor, SECOND_WIND, SNEAK_MS, walkBack, walkReach } from '../public/js/shared/adventure.js';
import { BOSSES } from '../public/js/shared/bosses.js';
import { buildIsle } from '../public/js/shared/isle-maps.js';
import { chapterOf, STAGES, stagesOf } from '../public/js/shared/isle-story.js';
import { MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

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

test('walking: a step up at a time, down any drop, never through water nor through anything solid', () => {
  // A floor at y 3 (so one stands at 4), sixteen across.
  const w = new World({ W: 16, H: 16, D: 16, sea: 1, theme: 'sunny', spawn: { x: 8.5, y: 4, z: 8.5 } });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y <= 3; y++) w.set(x, y, z, B.STONE);
  // A step one high, a pillar two high, a pool, a dry pit, a hollow under
  // the floor with no way in, and a wall right across with a hole to crawl
  // through that is only one high.
  w.set(4, 4, 4, B.STONE);
  for (const y of [4, 5]) w.set(12, y, 4, B.STONE);
  w.set(4, 3, 12, B.WATER);
  for (const y of [1, 2, 3]) w.set(12, y, 12, B.AIR);
  for (const y of [1, 2]) w.set(2, y, 8, B.AIR);
  for (let x = 0; x < 16; x++) for (const y of [4, 5, 6]) w.set(x, y, 1, B.STONE);
  w.set(8, 4, 1, B.AIR);
  const reach = walkReach(w, [[8.5, 4, 8.5]]);
  const at = (x, y, z) => reach[(x * w.D + z) * w.H + y];
  assert.equal(at(8, 4, 8), 1, 'where it starts');
  assert.equal(at(0, 4, 15), 1, 'all over the floor');
  assert.equal(at(4, 5, 4), 1, 'up a step');
  assert.equal(at(12, 6, 4), 0, 'not up two at once');
  assert.equal(at(4, 4, 12) + at(4, 3, 12), 0, 'not into the water');
  assert.equal(at(12, 1, 12), 1, 'down a drop, however deep');
  assert.equal(at(2, 1, 8) + at(2, 2, 8), 0, 'not through the floor into a hollow under it');
  assert.equal(at(8, 4, 0), 0, 'nor through a hole too low to stand in');
  // From nowhere one can stand, nowhere.
  assert.equal(walkReach(w, [[4.5, 4, 12.5], [99, 4, 99]]).some(Boolean), false);
  // And the other way round, from where a spot is walked to: down into the
  // pit from all over, and never out of it.
  const cell = (x, y, z) => (x * w.D + z) * w.H + y;
  const down = walkBack(w, [[12.5, 1, 12.5]]);
  assert.deepEqual([down[cell(12, 1, 12)], down[cell(8, 4, 8)], down[cell(4, 5, 4)], down[cell(8, 4, 0)]], [1, 1, 1, 0]);
  const up = walkBack(w, [[8.5, 4, 8.5]]);
  assert.deepEqual([up[cell(8, 4, 8)], up[cell(0, 4, 15)], up[cell(4, 5, 4)], up[cell(12, 1, 12)]], [1, 1, 1, 0]);
  assert.equal(walkBack(w, [[99, 4, 99]]).some(Boolean), false);
});

test('past a gate is where a camp still barred can be walked to from: a beach under its cliff is nobody’s business', () => {
  // A floor (one stands at 4), with a terrace three higher across the north
  // west of it and the second camp up there; the way up is a flight of
  // steps, which the first camp's gate builds. East of the terrace, behind a
  // wall, a beach at the foot of its cliff: down to it from the terrace, and
  // no way back up.
  const w = new World({ W: 20, H: 16, D: 20, sea: 1, theme: 'sunny', spawn: { x: 4.5, y: 4, z: 1.5 } });
  for (let x = 0; x < 20; x++) for (let z = 0; z < 20; z++) for (let y = 0; y <= (z >= 10 && x < 12 ? 6 : 3); y++) w.set(x, y, z, B.STONE);
  for (let x = 12; x < 20; x++) for (const y of [4, 5, 6]) w.set(x, y, 10, B.STONE);
  const steps = [4, 4, 8, B.STONE, 4, 4, 9, B.STONE, 4, 5, 9, B.STONE];
  const camps = [
    { id: 1, kind: 'camp', x: 12.5, y: 4, z: 4.5, r: 3 },
    { id: 2, kind: 'camp', x: 5.5, y: 7, z: 15.5, r: 3 },
  ];
  const sim = new AdventureSim({ camps, stage: 1, gates: [{ camp: 1, cells: steps }] }, 1);
  const cell = (x, y, z) => (x * w.D + z) * w.H + y;
  const way = sim.ways(w);
  assert.deepEqual(way.barred.map((c) => c.id), [2]);
  const [start, terrace, edge, beach] = [cell(4, 4, 1), cell(5, 7, 13), cell(11, 7, 18), cell(15, 4, 15)];
  assert.deepEqual([start, terrace, edge, beach].map((i) => way.on[i]), [1, 0, 0, 0], 'the way on: the floor before the steps');
  assert.deepEqual([start, terrace, edge, beach].map((i) => way.past[i]), [0, 1, 1, 0], 'past the gate: the terrace, not the beach under it');
  // Whoever is there a moment is told on: standing, jumping all the while, or
  // up on an animal's back; never on the way, on the beach, or flying.
  let now = 1000;
  const there = (x, y, z, more = {}) => {
    const told = [];
    for (let t = 0; t <= SNEAK_MS + 200; t += 100) told.push(...sim.stepSneaks(w, (now += 100), [{ ...onFoot(7, x, typeof y === 'function' ? y(t) : y, z), ...more }]));
    return told;
  };
  assert.deepEqual(there(4.5, 4, 1.5), []);
  assert.deepEqual(there(5.5, 7, 13.5), [7]);
  assert.deepEqual(there(5.5, (t) => (t % 200 ? 8.4 : 7.6), 13.5), [7], 'jumping');
  assert.deepEqual(there(5.5, 9.4, 13.5, { riding: true }), [7], 'riding');
  assert.deepEqual(there(15.5, 4, 15.5), [], 'the beach');
  assert.deepEqual(there(5.5, 7, 13.5, { flying: true }), []);
  assert.deepEqual(there(5.5, 7, 13.5, { dizzy: true }), []);
  assert.deepEqual(there(5.5, 15, 13.5), [], 'high over it');
  // A moment only: off it again in time, nothing.
  for (let t = 0; t < 3000; t += 100) assert.deepEqual(sim.stepSneaks(w, (now += 100), [onFoot(7, 5.5, t % 800 < 600 ? 7 : 15, 13.5)]), []);
  // The first camp freed, its gate builds the steps: the terrace is on the way.
  for (const g of sim.free(sim.campById(1), [], { list: [] }).gates) for (let k = 0; k < g.cells.length; k += 4) w.set(g.cells[k], g.cells[k + 1], g.cells[k + 2], g.cells[k + 3]);
  assert.deepEqual(there(5.5, 7, 13.5), []);
  const after = sim.ways(w);
  assert.deepEqual([after.barred.length, after.on[terrace], after.on[beach], after.past.length], [0, 1, 1, 0], 'the beach too, down off the terrace');
});

test('there is no way round a gate still shut: whoever stands past one is sent back to the nearest safe place', () => {
  const time = { t: 1_000_000 };
  // Sunscorch Dunes: the shore of its second terrace can be swum to.
  const room = isleRoom(5, time);
  const adv = room.adventure;
  const a = join(room);
  const p = room.players.get(a.pid);
  const [first, second, third] = adv.camps;
  const beside = (c) => [c.x, c.y, c.z + 2];
  // (Standing somewhere a while — until the room sends them home, when it does.)
  const stay = (at, ms = SNEAK_MS + 400) => {
    const homes = a.all('home').length;
    for (let t = 0; t < ms && a.all('home').length === homes; t += 100) {
      time.t += 100;
      room.receive(a, { t: 'm', s: [...at, 0, 0, 0] });
      p.dizzyUntil = 0;
      p.hp = 60;
      room.tick();
    }
  };
  const spawn = [room.world.spawn.x, room.world.spawn.y, room.world.spawn.z];
  // On the way, at the first camp: nothing.
  stay(beside(first));
  assert.equal(a.last('home'), undefined);
  // Past the first gate, at the second camp: a moment there, and back to the start.
  stay(beside(second), SNEAK_MS - 200);
  assert.equal(a.last('home'), undefined, 'not at once');
  stay(beside(second), 400);
  const home = a.last('home');
  assert.deepEqual([home.pid, home.why, home.at], [a.pid, 'gate', spawn]);
  assert.equal(home.hp, 60, 'as they are: no HP given');
  assert.deepEqual(p.s.slice(0, 3), spawn, 'and the room has them there');
  // Jumping all the while, or up on an animal's back, is no way round
  // either: it is the ground under them that counts.
  for (const lift of [(t) => (t % 200 ? 1.4 : 0.6), () => 2.6]) {
    a.inbox.length = 0;
    const [x, y, z] = beside(second);
    for (let t = 0; t < SNEAK_MS + 400 && !a.last('home'); t += 100) stay([x, y + lift(t), z], 100);
    assert.equal(a.last('home')?.why, 'gate');
  }
  // In the sea, or up where nobody walks: nobody's business.
  a.inbox.length = 0;
  stay([2.5, room.world.sea + 1, 2.5]);
  stay([second.x, second.y + 9, second.z]);
  assert.equal(a.last('home'), undefined);
  // The first camp freed, its gate opens: the second camp is on the way now.
  room.campFreed(adv.free(first, [], room.monsters));
  stay(beside(second));
  assert.equal(a.last('home'), undefined);
  // The third is not, yet: back to the nearest safe place, the camp just freed.
  stay(beside(third));
  assert.deepEqual([a.last('home').why, a.last('home').at], ['gate', [first.x, first.y, first.z + 2]]);
  // With every camp free and the boss popped, the whole island is.
  a.inbox.length = 0;
  for (const c of adv.camps) if (c.kind === 'camp' && !c.freed) room.campFreed(adv.free(c, [], room.monsters));
  stay(beside(adv.castle));
  assert.equal(a.last('home'), undefined);
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
