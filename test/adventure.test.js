// Adventure Isle's camps and its boss, as the room plays them (adventure.js):
// a camp's monsters coming out as friends come near and keeping to their
// camp; a flag going up only with no monster in the camp, faster with more
// friends; a camp freed turning back into grass and flowers, a safe place;
// sitting dizzy out of hearts until a friend helps you up; the boss in its
// bubble until every camp is free, then popped sooner by more friends, with
// helpers, a stomp that misses anyone jumping, and the stage won. An island
// made with ⚔️ Adventure on, back when any island could be one, opens as an
// island like any other. And the monster collection's book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdventureSim, bossHearts, CAMP_RADIUS, campFence, CASTLE_RADIUS, castleWalls, DIZZY_MS, flatten, GUARD_BACK_MS, groundMap, guardsFor, helpHp, KING_HEAL_MS, KING_HIT_MS, kingHearts, MONSTER_BOOK, monsterStats, raiseSeconds, WAKE } from '../public/js/shared/adventure.js';
import { keptProfile } from '../public/js/shared/keeper.js';
import { BOSSES, stompMove } from '../public/js/shared/bosses.js';
import { chapterOf } from '../public/js/shared/isle-story.js';
import { campDistance, DAZE_MS, DAZED_HIT, HIT_MS, maxHp, MONSTER_KINDS, STOMP, unpackMonster } from '../public/js/shared/monsters.js';
import { popKey, seenKey, STAT_KEYS } from '../public/js/shared/stickers.js';
import * as B from '../public/js/shared/blocks.js';
import { Rng } from '../public/js/shared/rng.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { palette } from '../public/js/shared/worldgen.js';

function clock(start = 1_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

// Two camps and a lair round the start of a big island of flat land, each
// well out of reach of it, built as the isle's maps build theirs (adventure.js
// flatten, campFence and castleWalls: isle-maps.js lays them along its way):
// levelled, gloomy, fenced or walled. Returns them as the adventure takes
// them, the lair last.
function layCamps(w) {
  const s = w.spawn;
  const level = Math.floor(s.y) - 1;
  const map = groundMap(w);
  const pal = palette(w.theme);
  const rng = new Rng(7);
  return [
    [s.x, s.z - 50, 'camp'],
    [s.x + 50, s.z, 'camp'],
    [s.x - 50, s.z, 'castle'],
  ].map(([x, z, kind], i) => {
    const r = kind === 'castle' ? CASTLE_RADIUS : CAMP_RADIUS;
    const spot = { cx: Math.floor(x), cz: Math.floor(z), x, z, level, r, square: kind === 'castle' };
    flatten(w, map, pal, spot);
    // Its ways in: one from the start, one behind.
    const toStart = Math.atan2(s.z - z, s.x - x);
    if (kind === 'castle') castleWalls(w, spot, [1, 0]);
    else campFence(w, rng, spot, [toStart, toStart + Math.PI]);
    return { id: i + 1, kind, x, y: level + 1, z, r };
  });
}

// A stage of Adventure Isle on flat land, so the monsters' ways about it are
// easy to follow: its camps (layCamps), and the stage's adventure — stage 1
// unless told, Shipwreck Shore, its Snappy Crabs among the guards and Captain
// Clawbeard in the lair.
function isleRoom(stage = 1) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', size: 'big', seed: 5, now: time.now });
  room.adventure = new AdventureSim({ camps: layCamps(room.world), stage }, 5);
  room.stage = stage;
  return { room, time };
}

const camps = (room) => room.adventure.camps.filter((c) => c.kind === 'camp');
const guards = (room, c) => room.monsters.list.filter((m) => m.camp === c.id);

// Moves the players (each as [conn, x, z, y?]) and steps the room, for ms.
function play(room, time, ms, ...where) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    for (const [c, x, z, y] of where) room.receive(c, { t: 'm', s: [x, y ?? room.world.top(Math.floor(x), Math.floor(z)) + 1, z, 0, 0, 0] });
    room.tick();
  }
}

// Pops every monster of a camp: each by landing on it, except the
// mosquito, which nobody can land on — two bops from beside it, up where it
// hovers.
function popAll(room, c, who, time) {
  for (const m of guards(room, c)) {
    if (m.kind === 'mosquito') {
      for (let i = 0; i < 2 && room.monsters.get(m.id); i++) {
        time.t += HIT_MS;
        room.receive(who, { t: 'm', s: [m.body.x + 1.4, m.body.y, m.body.z, 0, 0, 0] });
        room.receive(who, { t: 'bop', id: m.id });
        room.tick();
      }
    } else {
      room.receive(who, { t: 'm', s: [m.body.x, m.body.y + m.body.height, m.body.z, 0, 0, 0] });
      room.receive(who, { t: 'bop', id: m.id, on: true });
    }
  }
}

// Where to stand by a camp's flag: just off its stone floor.
const byFlag = (c, dx = 2.5) => [c.x + dx, c.z, c.y];

test('a camp’s monsters come out as someone comes near, one more than there are friends (up to five), and keep to their camp', () => {
  assert.deepEqual([1, 2, 3, 4, 8].map((n) => guardsFor(n)), [2, 3, 4, 5, 5]);
  const { room, time } = isleRoom();
  const a = join(room);
  const spawn = room.world.spawn;
  const [c] = camps(room);
  assert.ok(Math.hypot(c.x - spawn.x, c.z - spawn.z) > c.r + WAKE, 'out of reach of the start');
  play(room, time, 2000, [a, spawn.x, spawn.z]);
  assert.equal(room.monsters.list.length, 0, 'asleep while nobody is near');
  // Just outside, not near enough to be chased.
  const edge = [c.x + c.r + 10, c.z];
  play(room, time, 300, [a, ...edge]);
  assert.equal(guards(room, c).length, guardsFor(1));
  const kinds = a.last('mon').m.map(unpackMonster).map((m) => m.kind);
  assert.equal(kinds.filter((k) => k === 'mosquito').length, 1, 'one mosquito hanging over the camp');
  assert.ok(kinds.every((k) => k === 'blob' || k === 'mosquito' || chapterOf(1).guards.includes(k)), 'the rest the chapter’s own, and blobs');
  play(room, time, 20000, [a, ...edge]);
  for (const m of guards(room, c)) {
    assert.ok(campDistance(c, m.body.x, m.body.z) <= c.r, 'in their camp');
    assert.equal(m.target, 0);
  }
  // Another friend: another monster, on its way a while after.
  const b = join(room, 'Brave Otter');
  play(room, time, GUARD_BACK_MS + 500, [a, ...edge], [b, ...edge]);
  assert.equal(guards(room, c).length, guardsFor(2));
  // Everyone gone a while: back they go, and come out afresh next time.
  play(room, time, 20000, [a, spawn.x, spawn.z], [b, spawn.x, spawn.z]);
  assert.equal(guards(room, c).length, 0, 'asleep again');
});

test('one comes after whoever goes into its camp, gives up once they are well out of it, and goes back', () => {
  const { room, time } = isleRoom();
  const a = join(room);
  const [c] = camps(room);
  play(room, time, 300, [a, c.x + c.r + 10, c.z]);
  // In the camp: chased, and bumped.
  play(room, time, 8000, [a, ...byFlag(c)]);
  assert.ok(a.all('bump').length >= 1, 'caught');
  assert.ok(a.last('bump').hp < maxHp(1));
  // Well out: they give up, and go back in.
  play(room, time, 15000, [a, c.x + c.r + 16, c.z]);
  for (const m of guards(room, c)) {
    assert.equal(m.target, 0);
    assert.ok(campDistance(c, m.body.x, m.body.z) <= c.r, `back in, at ${campDistance(c, m.body.x, m.body.z).toFixed(1)}`);
  }
});

test('a flag goes up only with nobody of its camp in it, faster with more friends; a monster popped comes back a while after', () => {
  assert.deepEqual([1, 2, 3, 4, 6].map((n) => raiseSeconds(n)), [10, 6, 4.5, 4, 4]);
  const { room, time } = isleRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const [c] = camps(room);
  const spawn = room.world.spawn;
  play(room, time, 300, [a, c.x + c.r + 10, c.z], [b, spawn.x, spawn.z]);
  assert.equal(guards(room, c).length, 3);
  for (const m of guards(room, c)) m.giggle = Infinity;
  // By the flag, with its monsters in the camp: it stays down.
  play(room, time, 3000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  assert.equal(c.progress, 0);
  assert.deepEqual(a.last('adv').c.find((r) => r[0] === c.id), [c.id, 0, 1, 1], 'everyone sees it guarded, with one by it');
  // Popped, all of them: up it goes, a tenth a second for one...
  popAll(room, c, a, time);
  assert.equal(guards(room, c).length, 0);
  play(room, time, 3000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  assert.ok(Math.abs(c.progress - 0.3) < 0.02, `one friend: ${c.progress}`);
  // ...a sixth a second for two; flying over it does not count.
  play(room, time, 1000, [a, ...byFlag(c)], [b, ...byFlag(c, -2.5)]);
  assert.ok(Math.abs(c.progress - (0.3 + 1 / 6)) < 0.02, `two friends: ${c.progress}`);
  room.receive(b, { t: 'm', s: [c.x - 2.5, c.y + 3, c.z, 0, 0, 1] });
  room.receive(a, { t: 'm', s: [c.x + 10, c.y, c.z, 0, 0, 0] });
  const before = c.progress;
  time.t += 100;
  room.tick();
  assert.equal(c.progress, before, 'nobody on foot by it');
  // A monster popped is back in a while.
  play(room, time, GUARD_BACK_MS - 3000, [a, c.x + c.r + 10, c.z], [b, spawn.x, spawn.z]);
  assert.ok(guards(room, c).length >= 1, 'back');
  assert.equal(c.freed, false);
});

test('a camp freed: its monsters go, its gloomy ground turns into grass and flowers, and it is a safe place to come back to', () => {
  const { room, time } = isleRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const [c, d] = camps(room);
  play(room, time, 300, [a, c.x + c.r + 10, c.z], [b, c.x + c.r + 10, c.z + 1]);
  popAll(room, c, a, time);
  play(room, time, raiseSeconds(2) * 1000 + 300, [a, ...byFlag(c)], [b, ...byFlag(c, -2.5)]);
  assert.equal(c.freed, true);
  const freed = b.last('freed');
  assert.equal(freed.id, c.id);
  assert.deepEqual(freed.by.sort(), [a.pid, b.pid].sort(), 'freed by both');
  assert.equal(guards(room, c).length, 0);
  const w = room.world;
  let gloom = 0;
  let flowers = 0;
  for (let dx = -c.r - 4; dx <= c.r + 4; dx++) {
    for (let dz = -c.r - 4; dz <= c.r + 4; dz++) {
      const x = Math.floor(c.x) + dx;
      const z = Math.floor(c.z) + dz;
      if (w.get(x, c.y - 1, z) === B.GLOOM) gloom++;
      if (w.get(x, c.y - 1, z) === B.GRASS && B.KIND[w.get(x, c.y, z)] === B.K_PLANT) flowers++;
    }
  }
  assert.equal(gloom, 0, 'no gloomy ground left');
  assert.ok(flowers > 10, `${flowers} flowers`);
  assert.ok(a.last('edit').cells.length > 100, 'everyone sees it');
  assert.equal(b.last('adv').c.some((r) => r[0] === c.id), false);
  // A safe place: monsters of the next camp chasing you stop at its edge.
  const havens = room.adventure.havens(w);
  assert.ok(havens.some((h) => h.x === c.x && h.z === c.z && h.r > c.r));
  // Out of hearts near the next one, with nobody to help: back you come, to
  // the nearest safe place.
  room.receive(b, { t: 'leave' });
  room.players.get(a.pid).hp = 1;
  play(room, time, 300, [a, d.x + d.r + 10, d.z]);
  play(room, time, 10000, [a, ...byFlag(d)]);
  const home = a.all('bump').find((m) => m.home);
  assert.ok(home, 'sent back');
  const nearest = [room.world.spawn, c].sort((p, q) => Math.hypot(p.x - d.x, p.z - d.z) - Math.hypot(q.x - d.x, q.z - d.z))[0];
  assert.ok(Math.hypot(home.at[0] - nearest.x, home.at[2] - nearest.z) < 3, 'to the nearest safe place');
  assert.equal(home.hp, maxHp(1));
});

test('out of HP with a friend on the island you sit dizzy, nothing bumps you, and a friend beside you helps you up', () => {
  const { room, time } = isleRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const [c] = camps(room);
  const spawn = room.world.spawn;
  play(room, time, 300, [a, c.x + c.r + 10, c.z], [b, spawn.x, spawn.z]);
  room.players.get(a.pid).hp = 1;
  play(room, time, 8000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  const dizzy = b.all('bump').find((m) => m.pid === a.pid && m.dizzy);
  assert.ok(dizzy, 'dizzy');
  assert.equal(dizzy.hp, 0);
  const bumps = a.all('bump').length;
  play(room, time, 3000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  assert.equal(a.all('bump').length, bumps, 'nobody bumps someone dizzy');
  for (const m of guards(room, c)) assert.notEqual(m.target, a.pid);
  // A friend from far off cannot; from beside you, up you get.
  room.receive(b, { t: 'help', pid: a.pid });
  assert.equal(b.last('helped'), undefined);
  const [x, z, y] = byFlag(c);
  room.receive(b, { t: 'm', s: [x + 1.5, y, z, 0, 0, 0] });
  room.receive(b, { t: 'help', pid: a.pid });
  assert.deepEqual(b.last('helped'), { t: 'helped', pid: a.pid, by: b.pid, hp: helpHp(maxHp(1)), max: maxHp(1) });
  assert.equal(room.players.get(a.pid).hp, helpHp(maxHp(1)));
  // Dizzy for too long, with nobody coming: back to the start.
  room.players.get(a.pid).hp = 1;
  room.players.get(a.pid).safeUntil = 0;
  play(room, time, 8000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  assert.ok(a.all('bump').some((m) => m.pid === a.pid && m.dizzy));
  for (let t = 0; t < DIZZY_MS + 200 && !b.last('home'); t += 100) play(room, time, 100, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  const home = b.last('home');
  assert.equal(home.pid, a.pid);
  assert.deepEqual(home.at, [spawn.x, spawn.y, spawn.z]);
  assert.equal(home.hp, maxHp(1));
  assert.equal(room.players.get(a.pid).hp, maxHp(1));
});

// A stage with every camp but the lair free, someone at the lair's gate and
// its boss awake. stomping: the boss only stomps, the one of its moves to
// watch.
function atTheLair({ free = true, friends = 1, stage = 1, stomping = false } = {}) {
  const { room, time } = isleRoom(stage);
  const who = Array.from({ length: friends }, (_, i) => join(room, `Friend ${i + 1}`));
  if (free) for (const c of camps(room)) room.campFreed(room.adventure.free(c, [], room.monsters));
  const castle = room.adventure.castle;
  play(room, time, 300, ...who.map((p) => [p, castle.x + castle.r + 12, castle.z]));
  const boss = room.monsters.list.find((m) => m.camp === castle.id);
  if (stomping) boss.plan = { ...boss.plan, moves: [stompMove(boss.plan)] };
  return { room, time, who, castle, boss };
}

test('the boss stays in its bubble while any camp is not free: no trouble, and no bop gets through', () => {
  const { room, time, who, castle, boss } = atTheLair({ free: false });
  const [a] = who;
  assert.ok(boss, 'it is there');
  assert.equal(boss.kind, 'clawbeard', 'Shipwreck Shore’s own');
  assert.equal(a.last('adv').k[0], bossHearts(BOSSES.clawbeard, 1));
  assert.equal(a.last('adv').shield, true);
  for (let i = 0; i < 5; i++) {
    play(room, time, 1000, [a, boss.body.x + boss.body.radius + 1, boss.body.z]);
    room.receive(a, { t: 'bop', id: boss.id });
  }
  assert.equal(a.last('kinghit').shielded, true);
  assert.equal(room.adventure.king.hearts, bossHearts(BOSSES.clawbeard, 1), 'not a heart');
  assert.deepEqual(a.all('bump'), [], 'nor a bump');
  // The last camp freed pops its bubble, and everyone hears.
  for (const c of camps(room)) room.campFreed(room.adventure.free(c, [], room.monsters));
  assert.equal(a.last('shield').up, false);
  play(room, time, 300, [a, castle.x + castle.r + 12, castle.z]);
  assert.equal(a.last('adv').shield, false);
});

test('out of its bubble, each friend can bop the boss once a moment: more friends pop it sooner, and the stage is won', () => {
  const { room, time, who, castle, boss } = atTheLair({ friends: 2 });
  const [a, b] = who;
  const k = room.adventure.king;
  assert.equal(k.max, bossHearts(BOSSES.clawbeard, 2));
  assert.ok(k.max > bossHearts(BOSSES.clawbeard, 1));
  boss.giggle = Infinity;
  const bop = (p) => {
    room.receive(p, { t: 'm', s: [boss.body.x + boss.body.radius + 1, boss.body.y, boss.body.z, 0, 0, 0] });
    room.receive(p, { t: 'bop', id: boss.id });
  };
  bop(a);
  bop(a);
  assert.equal(k.hearts, k.max - 1, 'once a moment each');
  bop(b);
  assert.equal(k.hearts, k.max - 2, 'and a friend too');
  assert.equal(a.last('kinghit').hearts, k.max - 2);
  // Down to two thirds of its hearts, it calls two helpers; at a third, two more.
  const helpers = () => room.monsters.list.filter((m) => m.camp === castle.id && m.kind === BOSSES.clawbeard.minion).length;
  const hits = [];
  while (k.hearts > 0) {
    time.t += KING_HIT_MS;
    room.tick();
    bop(a);
    bop(b);
    room.tick();
    hits.push([k.hearts, helpers()]);
  }
  for (const [hearts, n] of hits) if (hearts > 0) assert.equal(n, hearts <= k.max / 3 ? 4 : hearts <= (k.max * 2) / 3 ? 2 : 0, `${hearts} hearts`);
  // Popped: the whole stage is won, every camp's monster gone.
  assert.equal(room.adventure.won, true);
  assert.equal(room.monsters.list.length, 0);
  const won = b.last('won');
  assert.deepEqual(won.by.sort(), [a.pid, b.pid].sort());
  assert.equal(castle.freed, true);
  assert.equal(room.world.get(Math.floor(castle.x) + 3, castle.y - 1, Math.floor(castle.z)), B.GRASS, 'its yard all grass');
  assert.equal(room.adventure.active, false);
});

test('King Grumble’s stomp knocks over whoever is on the ground near him as he lands, and misses anyone jumping', () => {
  const { room, time, who, castle, boss } = atTheLair({ friends: 2, stage: 12, stomping: true });
  assert.equal(boss.kind, 'king', 'on Gloom Rock, at the end of the story');
  const [a, b] = who;
  let stomped = null;
  for (let t = 0; t < 20000 && !stomped; t += 100) {
    time.t += 100;
    const ground = castle.y;
    // Both four blocks from him (either side, off the stone floor of his
    // flag in the middle of the yard); one always in the air.
    room.receive(a, { t: 'm', s: [boss.body.x, ground, boss.body.z - 4, 0, 0, 0] });
    room.receive(b, { t: 'm', s: [boss.body.x, ground + 1.2, boss.body.z + 4, 0, 3, 0] });
    room.tick();
    stomped = a.last('stomp') && a.all('bump').find((m) => m.stomp);
  }
  assert.ok(a.last('stomp'), 'he stomped');
  assert.ok(stomped, 'the one on the ground knocked over');
  assert.equal(stomped.pid, a.pid);
  assert.equal(stomped.big, true);
  assert.equal(a.all('bump').filter((m) => m.pid === b.pid).length, 0, 'the one in the air missed');
  assert.ok(Math.hypot(a.last('stomp').x - boss.body.x, a.last('stomp').z - boss.body.z) < 1, 'where he came down');
  assert.ok(STOMP.reach > 4);
});

test('King Grumble sits dazed after a stomp, bumping nobody, and a bop then takes three hearts; he is never knocked back', () => {
  const { room, time, who, boss } = atTheLair({ stage: 12, stomping: true });
  const [a] = who;
  const k = room.adventure.king;
  const x0 = boss.body.x;
  room.receive(a, { t: 'm', s: [boss.body.x + boss.body.radius + 1, boss.body.y, boss.body.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: boss.id });
  assert.equal(k.hearts, k.max - 1, 'one heart when he is not dazed');
  assert.ok(Math.abs(boss.body.vx) < 0.5 && Math.abs(boss.body.x - x0) < 0.5, 'not knocked back');
  // Wait for his stomp, jumping each time it comes, out of his reach.
  for (let t = 0; t < 30000 && boss.state !== 'dazed'; t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [boss.body.x + 7, boss.body.y + 1.2, boss.body.z, 0, 3, 0] });
    room.tick();
  }
  assert.equal(boss.state, 'dazed', 'dazed after his stomp');
  const before = k.hearts;
  // Right up against him while he is dazed: no bump.
  room.receive(a, { t: 'm', s: [boss.body.x + boss.body.radius + 0.1, boss.body.y, boss.body.z, 0, 0, 0] });
  const bumps = a.all('bump').length;
  time.t += 100;
  room.tick();
  assert.equal(a.all('bump').length, bumps, 'no bump while dazed');
  time.t += KING_HIT_MS;
  room.receive(a, { t: 'bop', id: boss.id });
  assert.equal(k.hearts, before - DAZED_HIT);
  assert.equal(a.last('kinghit').dazed, true);
  // After a while, he is up again.
  for (let i = 0; i < DAZE_MS / 100 + 2; i++) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [boss.body.x + 12, boss.body.y, boss.body.z, 0, 0, 0] });
    room.tick();
  }
  assert.notEqual(boss.state, 'dazed');
});

test('the boss left alone gets its hearts back, and the fewer it has, the crosser it is', () => {
  const { room, time, who, boss } = atTheLair();
  const [a] = who;
  const k = room.adventure.king;
  k.hearts = Math.floor(k.max / 3);
  k.hitAt = time.t;
  room.tick();
  assert.equal(boss.rage, 2, 'very cross at a third');
  // Left alone, far from it: nothing for a while, then a heart every two seconds.
  const low = k.hearts;
  play(room, time, KING_HEAL_MS - 200, [a, boss.body.x + 40, boss.body.z]);
  assert.equal(k.hearts, low);
  play(room, time, 4500, [a, boss.body.x + 40, boss.body.z]);
  assert.equal(k.hearts, low + 3);
  // The crosser it is, the sooner its moves come (bosses.js).
  const { gap } = BOSSES.clawbeard;
  assert.ok(gap[0] > gap[1] && gap[1] > gap[2]);
});

test('an island made with ⚔️ Adventure on, back when any island could be one, opens as an island like any other', () => {
  const time = clock();
  // As one was saved then: its camps and its castle (the first camp freed),
  // and a Monster Gashapon that had turned up.
  const old = new Room({ code: '123456', theme: 'flat', size: 'big', seed: 5, now: time.now });
  const laid = layCamps(old.world);
  const s = old.world.spawn;
  const gasha = [Math.floor(s.x) + 3, Math.floor(s.y), Math.floor(s.z)];
  old.world.set(...gasha, B.MONSTER_GASHAPON);
  const save = JSON.parse(JSON.stringify(old.exportSave()));
  save.adventure = { camps: laid.map((c, i) => ({ ...c, freed: i === 0 })), won: false, stage: 1, gasha };
  const room = new Room({ save, now: time.now });
  assert.equal(room.adventure, null, 'no adventure');
  const w = room.world;
  for (const c of laid) {
    let gloom = 0;
    for (let dx = -c.r - 4; dx <= c.r + 4; dx++) for (let dz = -c.r - 4; dz <= c.r + 4; dz++) if (w.get(Math.floor(c.x) + dx, c.y - 1, Math.floor(c.z) + dz) === B.GLOOM) gloom++;
    assert.equal(gloom, 0, `${c.kind} ${c.id}: its ground green again`);
  }
  // Its fences and its castle stand where they were; its Monster Gashapon is gone.
  const [c, d, castle] = laid;
  let logs = 0;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    if (w.get(Math.floor(c.x) + Math.round(Math.cos(a) * c.r), c.y, Math.floor(c.z) + Math.round(Math.sin(a) * c.r)) === B.WOOD) logs++;
  }
  assert.ok(logs > 32, `${logs} of 64 round the fence are logs`);
  assert.equal(w.get(Math.floor(castle.x) - castle.r, castle.y + 1, Math.floor(castle.z) + 3), B.BRICK_WALL, 'the castle’s wall');
  assert.equal(w.get(...gasha), B.AIR);
  // Nothing comes out of the camps, it is listed as any other, and saved
  // again, nothing of the adventure is kept.
  const a = join(room);
  assert.equal(a.last('welcome').adventure, null);
  play(room, time, 3000, [a, ...byFlag(d)]);
  assert.equal(room.monsters.list.length, 0);
  assert.equal(room.listing().adventure, undefined);
  assert.equal(room.exportSave().adventure, undefined);
  // Nor is one made any more, whatever a page asks for: Adventure Isle is
  // the only adventure.
  const made = new Room({ code: '654321', theme: 'flat', seed: 9, adventure: true, now: time.now });
  assert.equal(made.adventure, null);
  assert.equal(made.world.blocks.indexOf(B.GLOOM), -1, 'no gloomy ground anywhere');
  // And a stage of the isle going on is never saved with its island.
  assert.equal(isleRoom().room.exportSave().adventure, undefined);
});

test('the monster book has every kind of monster, each with a name and stats, counted as seen and popped in stats the keeper keeps', () => {
  assert.deepEqual(MONSTER_BOOK.map((m) => m.kind).sort(), [...MONSTER_KINDS].sort());
  for (const m of MONSTER_BOOK) {
    assert.ok(m.icon && m.name, m.kind);
    const s = monsterStats(m.kind);
    assert.ok(s.hp > 0 && s.atk > 0 && s.speed > 0 && s.speed < 100 && s.jump, m.kind);
    assert.ok(STAT_KEYS.includes(seenKey(m.kind)) && STAT_KEYS.includes(popKey(m.kind)), m.kind);
  }
  assert.deepEqual(monsterStats('blob'), { hp: 3, atk: 20, fire: false, jump: 'Pops at once', speed: 49 });
  assert.deepEqual(monsterStats('golem'), { hp: 12, atk: 60, fire: false, jump: '6 jumps', speed: 46 });
  assert.equal(monsterStats('spiky').jump, 'No jumping!');
  assert.deepEqual([monsterStats('ghost').atk, monsterStats('ghost').fire], [30, true]);
  // A boss's, as it is on the isle: King Grumble on Gloom Rock has more.
  assert.equal(monsterStats('king').hp, bossHearts(BOSSES.king, 1));
  assert.ok(monsterStats('king').hp > kingHearts(1));
  assert.equal(monsterStats('moltok').fire, true, 'Moltok breathes fire');
  // The keeper keeps every count, these with the rest.
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 1]));
  assert.deepEqual(keptProfile({ name: 'Keen Owl', stats }).stats, stats);
});
