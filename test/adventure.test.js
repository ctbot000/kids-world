// Adventure islands: monster camps all over the island, more on a bigger
// one, with King Grumble's castle furthest from the start; built on top of
// the island as it would be without them, each with a way in to its flag;
// a camp's monsters coming out as friends come near and keeping to their
// camp; a flag going up only with no monster in the camp, faster with more
// friends; a camp freed turning back into grass and flowers, a safe place;
// sitting dizzy out of hearts until a friend helps you up; King Grumble in
// his bubble until every camp is free, then popped sooner by more friends,
// with helpers, a stomp that misses anyone jumping, and the island free;
// and all of it kept when saved, and on the list of open islands.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMP_RADIUS, CASTLE_RADIUS, campCount, DIZZY_MS, FLAG_REACH, GUARD_BACK_MS, guardsFor, HELP_HEARTS, KING_HEAL_MS, KING_HIT_MS, kingHearts, raiseSeconds, WAKE } from '../public/js/shared/adventure.js';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO } from '../public/js/shared/critters.js';
import { cleanListing } from '../public/js/shared/listing.js';
import { campDistance, DAZE_MS, DAZED_HIT, HIT_MS, MAX_HEARTS, MonsterSim, SAFE_RADIUS, STOMP, unpackMonster } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { generate, SIZES, THEMES } from '../public/js/shared/worldgen.js';

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

// An adventure island of flat land: level ground, so the monsters' ways about
// it are easy to follow.
function adventureRoom(seed = 5, size = 'small') {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', size, seed, adventure: true, now: time.now });
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

// Columns a kid can walk to from the start, and the height of their feet in
// each: up a block at a time, down any way, swimming where there is water,
// never through anything solid.
function walkable(world) {
  const { W, D, H } = world;
  const feet = new Int16Array(W * D).fill(-1);
  const open = (x, y, z) => !B.SOLID[world.get(x, y, z)] && !B.SOLID[world.get(x, y + 1, z)];
  const stand = (x, z, from) => {
    for (let y = Math.min(H - 2, from + 1); y >= Math.max(1, from - 12); y--) if (B.SOLID[world.get(x, y - 1, z)] && open(x, y, z)) return y;
    return -1;
  };
  const sx = Math.floor(world.spawn.x);
  const sz = Math.floor(world.spawn.z);
  const queue = [[sx, sz, stand(sx, sz, Math.floor(world.spawn.y))]];
  feet[sx * D + sz] = queue[0][2];
  while (queue.length) {
    const [x, z, y] = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D || feet[nx * D + nz] >= 0) continue;
      const ny = stand(nx, nz, y);
      // Standing up there takes room to go up into first.
      if (ny < 0 || (ny > y && !open(x, y + 1, z))) continue;
      feet[nx * D + nz] = ny;
      queue.push([nx, nz, ny]);
    }
  }
  return feet;
}

test('an adventure island has monster camps all over it, more on a bigger one, and King Grumble’s castle', () => {
  const counts = SIZES.map((s) => campCount(generate({ seed: 3, theme: 'flat', size: s.key }).world));
  assert.deepEqual(counts, [3, 5, 7], 'three on a cozy island, more on a bigger one');
  for (const size of SIZES) {
    for (const theme of THEMES) {
      for (const seed of [11, 4242]) {
        const label = `${theme.key} ${size.key} island ${seed}`;
        const { world, camps } = generate({ seed, theme: theme.key, size: size.key, adventure: true });
        const spawn = world.spawn;
        assert.equal(camps.filter((c) => c.kind === 'camp').length, campCount(world), label);
        assert.equal(camps.at(-1).kind, 'castle', `${label}: the castle last`);
        assert.equal(camps.filter((c) => c.kind === 'castle').length, 1);
        assert.deepEqual(
          camps.map((c) => c.id),
          camps.map((_, i) => i + 1),
        );
        const away = (c) => Math.hypot(c.x - spawn.x, c.z - spawn.z);
        const plain = camps.filter((c) => c.kind === 'camp');
        assert.deepEqual(
          plain.map(away),
          plain.map(away).sort((a, b) => a - b),
          `${label}: numbered from the nearest`,
        );
        for (const c of camps) {
          const reach = c.kind === 'castle' ? c.r * Math.SQRT2 : c.r;
          assert.equal(c.r, c.kind === 'castle' ? CASTLE_RADIUS : CAMP_RADIUS);
          assert.ok(away(c) > reach + SAFE_RADIUS + 4, `${label}: camp ${c.id} is well away from the start`);
          for (const o of camps) if (o !== c) assert.ok(Math.hypot(o.x - c.x, o.z - c.z) > reach + (o.kind === 'castle' ? o.r * Math.SQRT2 : o.r) + 4, `${label}: camps ${c.id} and ${o.id} keep apart`);
          // Its flag stands on a little stone floor, with room over it, in the
          // middle of gloomy ground as far as its fence and a little beyond.
          const cx = Math.floor(c.x);
          const cz = Math.floor(c.z);
          assert.equal(world.get(cx, c.y, cz), B.PEBBLES, `${label}: camp ${c.id}'s flag floor`);
          for (let y = c.y + 1; y < c.y + 6; y++) assert.equal(world.get(cx, y, cz), B.AIR);
          for (let dx = -c.r + 1; dx < c.r; dx++) {
            for (let dz = -c.r + 1; dz < c.r; dz++) {
              if (campDistance(c, c.x + dx, c.z + dz) > c.r - 1) continue;
              assert.equal(world.get(cx + dx, c.y - 1, cz + dz), B.GLOOM, `${label}: camp ${c.id} at ${dx}, ${dz}`);
            }
          }
        }
      }
    }
  }
});

test('every camp has a fence of logs and the castle stone walls, each with a way in from the start to its flag', () => {
  for (const [theme, size, seed] of [
    ['sunny', 'small', 11],
    ['snowy', 'small', 4242],
    ['candy', 'big', 11],
    ['flat', 'small', 4242],
  ]) {
    const { world, camps } = generate({ seed, theme, size, adventure: true });
    const feet = walkable(world);
    for (const c of camps) {
      const cx = Math.floor(c.x);
      const cz = Math.floor(c.z);
      const label = `${theme} island ${seed}, ${c.kind} ${c.id}`;
      // Round it, logs (or stone): most of the way round, at the fence.
      let wall = 0;
      let all = 0;
      for (let a = 0; a < 64; a++) {
        const x = cx + Math.round(Math.cos((a / 64) * Math.PI * 2) * c.r);
        const z = cz + Math.round(Math.sin((a / 64) * Math.PI * 2) * c.r);
        if (c.kind === 'castle') continue;
        all++;
        if (world.get(x, c.y, z) === B.WOOD) wall++;
      }
      if (c.kind === 'camp') assert.ok(wall / all >= 0.7, `${label}: ${wall} of ${all} round it are logs`);
      else {
        let stone = 0;
        for (let d = -c.r; d <= c.r; d++) for (const [x, z] of [[cx + d, cz - c.r], [cx + d, cz + c.r], [cx - c.r, cz + d], [cx + c.r, cz + d]]) if (world.get(x, c.y + 4, z) === B.BRICK_WALL || world.get(x, c.y + 4, z) === B.LAMP) stone++;
        assert.ok(stone >= 4 * (2 * c.r + 1) - 4, `${label}: walls all round (${stone})`);
      }
      // ...and a way in from the start, to stand by the flag.
      let reached = false;
      for (let dx = -3; dx <= 3 && !reached; dx++) {
        for (let dz = -3; dz <= 3 && !reached; dz++) {
          const f = feet[(cx + dx) * world.D + cz + dz];
          reached = Math.hypot(dx, dz) <= FLAG_REACH && f >= c.y - 1 && f <= c.y + 2;
        }
      }
      assert.ok(reached, `${label}: a way in to the flag`);
    }
  }
});

test('everything but the camps comes out just as it would on the island without them', () => {
  for (const theme of THEMES) {
    const plain = generate({ seed: 77, theme: theme.key, size: 'small' });
    const made = generate({ seed: 77, theme: theme.key, size: 'small', adventure: true });
    assert.deepEqual(plain.camps, []);
    const w = made.world;
    // Far enough from every camp for its trees and slopes, the same.
    const clear = (x, z) => made.camps.every((c) => Math.hypot(x - c.x, z - c.z) > (c.kind === 'castle' ? (c.r + 3) * Math.SQRT2 : c.r + 3) + 9);
    let same = 0;
    for (let x = 0; x < w.W; x++) {
      for (let z = 0; z < w.D; z++) {
        if (!clear(x + 0.5, z + 0.5)) continue;
        for (let y = 0; y < w.H; y++) assert.equal(w.get(x, y, z), plain.world.get(x, y, z), `${theme.key}: ${x}, ${y}, ${z}`);
        same++;
      }
    }
    assert.ok(same > w.W * w.D * 0.3, `${theme.key}: most of the island (${same} columns)`);
    assert.deepEqual(w.spawn, plain.world.spawn);
    // Every vehicle, and every animal away from the camps; none in them.
    // (Not the ones that come after the camps, kept clear of them, which
    // can find room where a camp levelled the ground: see placeBuses.)
    const after = new Set(['bus', 'ferry', 'helicopter', 'balloon', 'scooter']);
    const key = (c) => `${c.type}@${c.x},${c.y},${c.z}`;
    const kept = new Set(made.critters.map(key));
    for (const c of plain.critters) {
      if (after.has(c.type)) continue;
      if (CRITTER_INFO[c.type].vehicle || clear(c.x, c.z)) assert.ok(kept.has(key(c)), `${theme.key}: ${key(c)} kept`);
    }
    for (const c of made.critters) {
      if (CRITTER_INFO[c.type].vehicle) continue;
      for (const camp of made.camps) assert.ok(campDistance(camp, c.x, c.z) > camp.r + 1, `${theme.key}: no ${c.type} in camp ${camp.id}`);
    }
  }
});

test('a camp’s monsters come out as someone comes near, one more than there are friends (up to five), and keep to their camp', () => {
  assert.deepEqual([1, 2, 3, 4, 8].map(guardsFor), [2, 3, 4, 5, 5]);
  const { room, time } = adventureRoom();
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
  assert.ok(kinds.every((k) => k === 'blob' || k === 'mosquito'), 'the rest blobs');
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
  const { room, time } = adventureRoom();
  const a = join(room);
  const [c] = camps(room);
  play(room, time, 300, [a, c.x + c.r + 10, c.z]);
  // In the camp: chased, and bumped.
  play(room, time, 8000, [a, ...byFlag(c)]);
  assert.ok(a.all('bump').length >= 1, 'caught');
  assert.ok(a.last('bump').hearts < MAX_HEARTS);
  // Well out: they give up, and go back in.
  play(room, time, 15000, [a, c.x + c.r + 16, c.z]);
  for (const m of guards(room, c)) {
    assert.equal(m.target, 0);
    assert.ok(campDistance(c, m.body.x, m.body.z) <= c.r, `back in, at ${campDistance(c, m.body.x, m.body.z).toFixed(1)}`);
  }
});

test('a flag goes up only with nobody of its camp in it, faster with more friends; a monster popped comes back a while after', () => {
  assert.deepEqual([1, 2, 3, 4, 6].map(raiseSeconds), [10, 6, 4.5, 4, 4]);
  const { room, time } = adventureRoom();
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
  const { room, time } = adventureRoom();
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
  // Out of hearts near it, with nobody to help: back you come, by its flag.
  room.receive(b, { t: 'leave' });
  room.players.get(a.pid).hearts = 1;
  play(room, time, 300, [a, d.x + d.r + 10, d.z]);
  play(room, time, 10000, [a, ...byFlag(d)]);
  const home = a.all('bump').find((m) => m.home);
  assert.ok(home, 'sent back');
  const nearest = [room.world.spawn, c].sort((p, q) => Math.hypot(p.x - d.x, p.z - d.z) - Math.hypot(q.x - d.x, q.z - d.z))[0];
  assert.ok(Math.hypot(home.at[0] - nearest.x, home.at[2] - nearest.z) < 3, 'to the nearest safe place');
  assert.equal(home.hearts, MAX_HEARTS);
});

test('out of hearts with a friend on the island you sit dizzy, nothing bumps you, and a friend beside you helps you up', () => {
  const { room, time } = adventureRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const [c] = camps(room);
  const spawn = room.world.spawn;
  play(room, time, 300, [a, c.x + c.r + 10, c.z], [b, spawn.x, spawn.z]);
  room.players.get(a.pid).hearts = 1;
  play(room, time, 8000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  const dizzy = b.all('bump').find((m) => m.pid === a.pid && m.dizzy);
  assert.ok(dizzy, 'dizzy');
  assert.equal(dizzy.hearts, 0);
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
  assert.deepEqual(b.last('helped'), { t: 'helped', pid: a.pid, by: b.pid, hearts: HELP_HEARTS });
  assert.equal(room.players.get(a.pid).hearts, HELP_HEARTS);
  // Dizzy for too long, with nobody coming: back to the start.
  room.players.get(a.pid).hearts = 1;
  room.players.get(a.pid).safeUntil = 0;
  play(room, time, 8000, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  assert.ok(a.all('bump').some((m) => m.pid === a.pid && m.dizzy));
  for (let t = 0; t < DIZZY_MS + 200 && !b.last('home'); t += 100) play(room, time, 100, [a, ...byFlag(c)], [b, spawn.x, spawn.z]);
  const home = b.last('home');
  assert.equal(home.pid, a.pid);
  assert.deepEqual(home.at, [spawn.x, spawn.y, spawn.z]);
  assert.equal(home.hearts, MAX_HEARTS);
  assert.equal(room.players.get(a.pid).hearts, MAX_HEARTS);
});

// An adventure island with every camp but the castle free, someone at the
// castle's gate and King Grumble awake.
function atTheCastle({ free = true, friends = 1 } = {}) {
  const { room, time } = adventureRoom();
  const who = Array.from({ length: friends }, (_, i) => join(room, `Friend ${i + 1}`));
  if (free) for (const c of camps(room)) room.campFreed(room.adventure.free(c, [], room.monsters));
  const castle = room.adventure.castle;
  play(room, time, 300, ...who.map((p) => [p, castle.x + castle.r + 12, castle.z]));
  const king = room.monsters.list.find((m) => m.kind === 'king');
  return { room, time, who, castle, king };
}

test('King Grumble stays in his bubble while any camp is not free: no trouble, and no bop gets through', () => {
  const { room, time, who, castle, king } = atTheCastle({ free: false });
  const [a] = who;
  assert.ok(king, 'he is there');
  assert.equal(king.camp, castle.id);
  assert.equal(a.last('adv').k[0], kingHearts(1));
  assert.equal(a.last('adv').shield, true);
  for (let i = 0; i < 5; i++) {
    play(room, time, 1000, [a, king.body.x + 1.6, king.body.z]);
    room.receive(a, { t: 'bop', id: king.id });
  }
  assert.equal(a.last('kinghit').shielded, true);
  assert.equal(room.adventure.king.hearts, kingHearts(1), 'not a heart');
  assert.deepEqual(a.all('bump'), [], 'nor a bump');
  // The last camp freed pops his bubble, and everyone hears.
  for (const c of camps(room)) room.campFreed(room.adventure.free(c, [], room.monsters));
  assert.equal(a.last('shield').up, false);
  play(room, time, 300, [a, castle.x + castle.r + 12, castle.z]);
  assert.equal(a.last('adv').shield, false);
});

test('out of his bubble, each friend can bop King Grumble once a moment: more friends pop him sooner, and the island is free', () => {
  const { room, time, who, castle, king } = atTheCastle({ friends: 2 });
  const [a, b] = who;
  const k = room.adventure.king;
  assert.equal(k.max, kingHearts(2));
  king.giggle = Infinity;
  const bop = (p) => {
    room.receive(p, { t: 'm', s: [king.body.x + 2, king.body.y, king.body.z, 0, 0, 0] });
    room.receive(p, { t: 'bop', id: king.id });
  };
  bop(a);
  bop(a);
  assert.equal(k.hearts, k.max - 1, 'once a moment each');
  bop(b);
  assert.equal(k.hearts, k.max - 2, 'and a friend too');
  assert.equal(a.last('kinghit').hearts, k.max - 2);
  // Down to two thirds of his hearts, he calls two helpers; at a third, two more.
  const helpers = () => room.monsters.list.filter((m) => m.camp === castle.id && m.kind === 'blob').length;
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
  // Popped: the whole island is free, every camp's monster gone.
  assert.equal(room.adventure.won, true);
  assert.equal(room.monsters.list.length, 0);
  const won = b.last('won');
  assert.deepEqual(won.by.sort(), [a.pid, b.pid].sort());
  assert.equal(castle.freed, true);
  assert.equal(room.world.get(Math.floor(castle.x) + 3, castle.y - 1, Math.floor(castle.z)), B.GRASS, 'his yard all grass');
  assert.equal(room.adventure.active, false);
  // Kept when saved.
  const again = new Room({ save: room.exportSave(), now: time.now });
  assert.equal(again.adventure.won, true);
  assert.ok(again.adventure.camps.every((c) => c.freed));
  assert.deepEqual(again.listing().adventure, { camps: camps(room).length, freed: camps(room).length, won: true });
});

test('King Grumble’s stomp knocks over whoever is on the ground near him as he lands, and misses anyone jumping', () => {
  const { room, time, who, castle, king } = atTheCastle({ friends: 2 });
  const [a, b] = who;
  let stomped = null;
  for (let t = 0; t < 20000 && !stomped; t += 100) {
    time.t += 100;
    const ground = castle.y;
    // Both four blocks from him, out of his reach; one always in the air.
    room.receive(a, { t: 'm', s: [king.body.x + 4, ground, king.body.z, 0, 0, 0] });
    room.receive(b, { t: 'm', s: [king.body.x - 4, ground + 1.2, king.body.z, 0, 3, 0] });
    room.tick();
    stomped = a.last('stomp') && a.all('bump').find((m) => m.stomp);
  }
  assert.ok(a.last('stomp'), 'he stomped');
  assert.ok(stomped, 'the one on the ground knocked over');
  assert.equal(stomped.pid, a.pid);
  assert.equal(stomped.big, true);
  assert.equal(a.all('bump').filter((m) => m.pid === b.pid).length, 0, 'the one in the air missed');
  assert.ok(Math.hypot(a.last('stomp').x - king.body.x, a.last('stomp').z - king.body.z) < 1, 'where he came down');
  assert.ok(STOMP.reach > 4);
});

test('King Grumble sits dazed after a stomp, bumping nobody, and a bop then takes three hearts; he is never knocked back', () => {
  const { room, time, who, king } = atTheCastle({ friends: 1 });
  const [a] = who;
  const k = room.adventure.king;
  const x0 = king.body.x;
  room.receive(a, { t: 'm', s: [king.body.x + 2, king.body.y, king.body.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: king.id });
  assert.equal(k.hearts, k.max - 1, 'one heart when he is not dazed');
  assert.ok(Math.abs(king.body.vx) < 0.5 && Math.abs(king.body.x - x0) < 0.5, 'not knocked back');
  // Wait for his stomp, jumping each time it comes, out of his reach.
  let t = 0;
  for (; t < 30000 && king.state !== 'dazed'; t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [king.body.x + 7, king.body.y + 1.2, king.body.z, 0, 3, 0] });
    room.tick();
  }
  assert.equal(king.state, 'dazed', 'dazed after his stomp');
  const before = k.hearts;
  // Right up against him while he is dazed: no bump.
  room.receive(a, { t: 'm', s: [king.body.x + 1, king.body.y, king.body.z, 0, 0, 0] });
  const bumps = a.all('bump').length;
  time.t += 100;
  room.tick();
  assert.equal(a.all('bump').length, bumps, 'no bump while dazed');
  time.t += KING_HIT_MS;
  room.receive(a, { t: 'bop', id: king.id });
  assert.equal(k.hearts, before - DAZED_HIT);
  assert.equal(a.last('kinghit').dazed, true);
  // After a while, he is up again.
  for (let i = 0; i < DAZE_MS / 100 + 2; i++) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [king.body.x + 12, king.body.y, king.body.z, 0, 0, 0] });
    room.tick();
  }
  assert.notEqual(king.state, 'dazed');
});

test('King Grumble left alone gets his hearts back, and the fewer he has, the more often he stomps', () => {
  const { room, time, who, king } = atTheCastle({ friends: 1 });
  const [a] = who;
  const k = room.adventure.king;
  k.hearts = Math.floor(k.max / 3);
  k.hitAt = time.t;
  room.tick();
  assert.equal(king.rage, 2, 'very cross at a third');
  // Left alone, far from him: nothing for a while, then a heart every two seconds.
  const low = k.hearts;
  play(room, time, KING_HEAL_MS - 200, [a, king.body.x + 40, king.body.z]);
  assert.equal(k.hearts, low);
  play(room, time, 4500, [a, king.body.x + 40, king.body.z]);
  assert.equal(k.hearts, low + 3);
  // How cross: chasing someone on flat ground for 40 seconds.
  const chase = (rage) => {
    const sim = new MonsterSim(4);
    const w = new World({ W: 96, H: 32, D: 96, sea: 4, theme: 'flat', spawn: { x: 48.5, y: 11, z: 48.5 } });
    for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
    const m = sim.add(w, 20.5, 11, 48.5, { kind: 'king' });
    m.rage = rage;
    let now = 1000;
    let stomps = 0;
    // Someone just ahead of him all the time, never bumped.
    const p = { id: 1, x: 23.5, y: 11, z: 48.5 };
    m.target = 1;
    for (let t = 0; t < 40000; t += 50) {
      now += 50;
      p.x = m.body.x + 3;
      sim.step(w, 0.05, now, [{ ...p, safeUntil: Infinity }], false, { roam: false, havens: [] });
      stomps += sim.takeStomps().length;
    }
    return stomps;
  };
  const [calm, cross, crossest] = [0, 1, 2].map(chase);
  assert.ok(calm < cross && cross < crossest, `stomps in 40 seconds: ${calm}, ${cross}, ${crossest}`);
});

test('turning monsters off leaves the camps’ monsters be; an adventure is kept when saved, and shows on the list of open islands', () => {
  const { room, time } = adventureRoom(9, 'big');
  const a = join(room);
  room.receive(a, { t: 'host', cmd: 'settings', settings: { monsters: true } });
  const [c, d] = camps(room);
  play(room, time, 300, [a, c.x + c.r + 10, c.z]);
  assert.ok(guards(room, c).length > 0);
  room.receive(a, { t: 'host', cmd: 'settings', settings: { monsters: false } });
  assert.ok(guards(room, c).length > 0, 'the camp keeps its monsters');
  room.campFreed(room.adventure.free(d, [], room.monsters));
  const listing = room.listing();
  assert.deepEqual(listing.adventure, { camps: camps(room).length, freed: 1, won: false });
  assert.deepEqual(cleanListing(listing).adventure, listing.adventure);
  assert.equal(cleanListing({ ...listing, adventure: undefined }).adventure, undefined, 'none on other islands');
  const again = new Room({ save: room.exportSave(), now: time.now });
  assert.deepEqual(
    again.adventure.camps.map((o) => [o.id, o.kind, o.x, o.y, o.z, o.r, o.freed]),
    room.adventure.camps.map((o) => [o.id, o.kind, o.x, o.y, o.z, o.r, o.freed]),
  );
  assert.equal(again.adventure.won, false);
  assert.equal(new Room({ code: '654321', theme: 'flat', seed: 9, now: time.now }).adventure, null, 'an island made without one has none');
  const welcome = join(again).last('welcome');
  assert.equal(welcome.adventure.camps.find((o) => o.id === d.id).freed, true);
  assert.equal(welcome.adventure.shield, true);
});
