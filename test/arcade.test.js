// The video arcade: arcade machines as furniture (a glowing screen, a
// joystick, a marquee), the Video Arcade stamp with six of them facing in
// over a checked floor, and the two mini-games they run — Bop-a-Blob
// (blobs popping out of nine holes, everyone at the machine racking up one
// score together) and Picture Pairs (turns taken flipping cards, pairs
// kept by whoever finds them) — with everything the host checks: who is
// playing, how near they stand, what happens when a machine goes or a
// player leaves, and that none of it is ever saved.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARCADE_GAMES,
  ArcadeSim,
  BOARD_DONE_MS,
  COUNTDOWN_MS,
  DONE_MS,
  FACES,
  gameOfBlock,
  HOLES,
  keyOf,
  MISS_MS,
  MOST_UP,
  POP_POINTS,
  GOLD_POINTS,
  REACH,
  ROUND_MS,
} from '../public/js/shared/arcade.js';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { stampByKey, placeTemplate } from '../public/js/shared/stamps.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

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

function arcadeRoom(seed = 21) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'sunny', size: 'small', seed, now: time.now });
  return { room, time };
}

// Steps the room for ms, a tenth of a second at a time.
function play(room, time, ms) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
}

// A machine by the start, host-side, and a player stood beside it.
function machine(room, kind = B.ARCADE_BLOB, dx = 2) {
  const w = room.world;
  const spawn = w.spawn;
  const x = Math.floor(spawn.x) + dx;
  const z = Math.floor(spawn.z);
  const y = w.top(x, z) + 1;
  w.set(x, y, z, kind);
  return { x, y, z };
}

const stand = (room, c, at) => room.receive(c, { t: 'm', s: [at.x + 0.5, at.y, at.z + 0.5, 0, 0, 0] });

// ---------------------------------------------------------------- the machines

test('arcade machines are furniture that turn, with glowing screens, light and a game each', () => {
  for (const [id, key, game] of [
    [B.ARCADE_BLOB, 'arcade-blob', 'blob'],
    [B.ARCADE_PAIRS, 'arcade-pairs', 'pairs'],
  ]) {
    const def = B.block(id);
    assert.equal(def.kind, 'furniture', key);
    assert.equal(def.model, key);
    assert.equal(gameOfBlock(id), game, `${key} runs ${game}`);
    assert.ok(def.light > 0, `${key} lights the room a little`);
    assert.ok(B.blocksIn('home').includes(id), `${key} is in the toy box's Home tab`);
    // Four of it, one per way it can face, and turning picks the right one.
    for (let front = 0; front < 4; front++) assert.equal(B.BLOCKS[B.turnedTo(id, front)].front, front);
    // A machine to look at: a body, a lit screen, a marquee and a panel —
    // every box in its cell, none outside.
    const boxes = modelBoxes(id);
    assert.ok(boxes.length >= 10, `${key}: ${boxes.length} boxes`);
    assert.ok(boxes.some(([, , , , , , , tile]) => tile === 'glow'), `${key} has a lit screen`);
    for (const b of boxes) {
      assert.ok(b[0] >= 0 && b[1] >= 0 && b[2] >= 0 && b[3] <= 1 && b[4] <= 1.05 && b[5] <= 1, `${key} box ${b} stays in its cell`);
    }
    assert.ok(ARCADE_GAMES[game].name && ARCADE_GAMES[game].how, `${key}'s game says its name and how to play it`);
  }
  // Nothing else runs a game, and no machine is a seat.
  assert.equal(gameOfBlock(B.CHAIR), null);
  assert.equal(gameOfBlock(B.TV), null);
});

test('the Video Arcade stamp lays out six machines facing in over a checked floor, with a way in', () => {
  const stamp = stampByKey('video-arcade');
  assert.ok(stamp, 'the stamp is there');
  const machines = stamp.cells.filter(([, , , id]) => gameOfBlock(id));
  assert.equal(machines.length, 6, 'three machines down each side');
  for (const game of ['blob', 'pairs']) assert.equal(machines.filter(([, , , id]) => gameOfBlock(id) === game).length, 3, `three of ${game}`);
  const at = (x, y, z) => {
    const c = stamp.cells.find(([dx, dy, dz]) => dx === x && dy === y && dz === z);
    return c ? c[3] : B.AIR;
  };
  // Every machine in it faces the middle of the hall (the way it goes down
  // turns them along with it, as placeTemplate does for any furniture).
  for (const [dx, dy, dz, id] of machines) {
    const front = B.BLOCKS[id].front;
    assert.equal(front, dx < 0 ? 0 : 2, `the machine at ${dx},${dz} faces in`);
    assert.ok(B.SOLID[at(dx, dy - 1, dz)], `floor under the machine at ${dx},${dz}`);
    assert.equal(at(dx, dy + 1, dz), B.AIR, `room over the machine at ${dx},${dz}`);
  }
  assert.equal(at(0, 0, 5), B.CHECKER_FLOOR, 'checked floor in the middle');
  assert.equal(at(0, 1, 0), B.AIR, 'nothing in the way in');
  assert.equal(at(0, 2, 0), B.AIR);
  assert.equal(at(0, 3, 0), B.AIR);
  // Walls all round otherwise, and a roof over it.
  for (const y of [1, 2, 3]) assert.ok(B.SOLID[at(-6, y, 5)] && B.SOLID[at(6, y, 5)] && B.SOLID[at(0, y, 10)], `walls at ${y}`);
  assert.ok(stamp.cells.some(([, , , id]) => id === B.LAMP), 'lamps inside');
});

// ---------------------------------------------------------------- Bop-a-Blob

test('a round of Bop-a-Blob: a count, blobs popping up and going down, and bops that score', () => {
  const time = clock();
  const sim = new ArcadeSim(3);
  const k = keyOf(5, 2, 5);
  const s = sim.play(5, 2, 5, 'blob', 1, time.now());
  assert.equal(s.phase, 'count');
  // The round starts after the count, and blobs come up in the holes.
  assert.deepEqual(sim.step(time.now()), []);
  time.t += COUNTDOWN_MS;
  sim.step(time.now());
  assert.equal(s.phase, 'play');
  const up = () => s.holes.filter((h) => h.kind).length;
  let seen = 0;
  for (let i = 0; i < 40; i++) {
    time.t += 250;
    sim.step(time.now());
    seen = Math.max(seen, up());
  }
  assert.ok(seen > 0, 'a blob came up');
  assert.ok(up() <= MOST_UP, `never more than ${MOST_UP} up at once (${up()})`);
  // A bop pops it, scores, and counts for whoever bopped it; another bop at
  // the now-empty hole does nothing, nor does one from nobody playing.
  const hole = s.holes.findIndex((h) => h.kind);
  const wasGold = s.holes[hole].kind === 2;
  const pop = sim.bop(k, hole, 1, time.now());
  assert.deepEqual(Object.keys(pop).sort(), ['by', 'f', 'i', 'k', 'pts', 's']);
  assert.equal(pop.f, 'pop');
  assert.equal(pop.pts, wasGold ? GOLD_POINTS : POP_POINTS);
  assert.equal(pop.s, pop.pts);
  assert.equal(sim.bop(k, hole, 1, time.now()), null, 'nothing left in that hole');
  assert.equal(sim.bop(k, hole, 99, time.now()), null, 'nobody who is not playing');
  assert.equal(sim.bop(k, -1, 1, time.now()), null, 'no such hole');
  assert.equal(sim.bop(k, HOLES, 1, time.now()), null);
  assert.equal(s.pops.get(1), 1);
  // The round ends after its time, with the scores for everyone, and the
  // game is over for good a moment after.
  time.t += ROUND_MS;
  const news = sim.step(time.now());
  assert.equal(s.phase, 'done');
  assert.deepEqual(news, [{ f: 'round', k, s: s.score, ps: [...s.pops] }]);
  time.t += DONE_MS;
  sim.step(time.now());
  assert.equal(sim.sessions.size, 0, 'the game packs up after the scores');
});

test('everyone at a Bop-a-Blob machine plays one round together, joining even once it has begun', () => {
  const time = clock();
  const sim = new ArcadeSim(4);
  const k = keyOf(1, 1, 1);
  const s = sim.play(1, 1, 1, 'blob', 1, time.now());
  time.t += COUNTDOWN_MS;
  sim.step(time.now());
  // A friend walks up and joins in.
  sim.play(1, 1, 1, 'blob', 2, time.now());
  assert.deepEqual(s.players, [1, 2]);
  assert.deepEqual([...s.pops.keys()], [1, 2]);
  let bops1 = 0;
  let bops2 = 0;
  for (let i = 0; i < 200; i++) {
    time.t += 150;
    sim.step(time.now());
    for (let h = s.holes.findIndex((x) => x.kind); h >= 0; h = s.holes.findIndex((x) => x.kind)) {
      const pop = sim.bop(k, h, i % 2 ? 1 : 2, time.now());
      if (!pop) break;
      if (pop.by === 1) bops1++;
      else bops2++;
    }
    if (s.phase === 'done') break;
  }
  assert.ok(bops1 > 0 && bops2 > 0, `both bopped (${bops1} and ${bops2})`);
  const pops = [...s.pops.values()].reduce((n, p) => n + p, 0);
  assert.ok(pops >= bops1 + bops2, `every pop counted for someone (${pops} of them)`);
  assert.ok(s.score >= pops, `one score between them (${s.score} from ${bops1} and ${bops2} bops)`);
  // Playing again starts afresh.
  time.t += DONE_MS;
  sim.step(time.now());
  const again = sim.play(1, 1, 1, 'blob', 2, time.now());
  assert.equal(again.score, 0);
  assert.equal(again.phase, 'count');
  assert.deepEqual(again.players, [2]);
});

test('the last one at a Bop-a-Blob machine leaves, and its round ends at once', () => {
  const time = clock();
  const sim = new ArcadeSim(5);
  const k = keyOf(2, 2, 2);
  sim.play(2, 2, 2, 'blob', 1, time.now());
  time.t += COUNTDOWN_MS;
  sim.step(time.now());
  assert.ok(sim.left(1));
  assert.equal(sim.sessions.size, 0);
  assert.equal(sim.bop(k, 0, 1, time.now()), null);
});

// ---------------------------------------------------------------- Picture Pairs

test('a board of Picture Pairs: turns taken, pairs kept, misses turned back', () => {
  const time = clock();
  const sim = new ArcadeSim(6);
  const k = keyOf(3, 1, 3);
  const s = sim.play(3, 1, 3, 'pairs', 1, time.now());
  sim.play(3, 1, 3, 'pairs', 2, time.now());
  assert.equal(s.phase, 'play');
  assert.equal(s.deck.length, FACES.length * 2, 'eight pairs of cards');
  const faces = new Map();
  for (const c of s.deck) faces.set(c.f, (faces.get(c.f) ?? 0) + 1);
  for (const [f, n] of faces) assert.equal(n, 2, `two of face ${f}`);
  // Only the one whose turn it is may flip, one card at a time.
  assert.deepEqual(sim.flip(k, 0, 2, time.now()), [], 'not their turn');
  assert.deepEqual(sim.flip(k, 0, 99, time.now()), [], 'nobody who is not playing');
  const flip = sim.flip(k, 0, 1, time.now());
  assert.equal(flip[0].f, 'flip');
  assert.equal(flip[0].face, s.deck[0].f);
  assert.deepEqual(sim.flip(k, 0, 1, time.now()), [], 'not the same card twice');
  assert.deepEqual(sim.flip(k, 1, 2, time.now()), [], 'still not their turn, mid-go');
  // A matching pair stays up and is theirs; the turn passes on either way.
  const mate = s.deck.findIndex((c, i) => i > 0 && c.f === s.deck[0].f);
  const pair = sim.flip(k, mate, 1, time.now());
  assert.equal(pair.at(-1).f, 'pair');
  assert.equal(s.deck[0].s, 2);
  assert.equal(s.deck[mate].s, 2);
  assert.equal(s.found.get(1), 1);
  assert.equal(s.players[s.turn], 2, 'the turn passed to the other');
  // A miss stays up a moment, during which nobody flips, then goes back
  // down and it is the next one's go.
  const a = s.deck.findIndex((c) => c.s === 0);
  const b = s.deck.findIndex((c, i) => i > a && c.s === 0 && c.f !== s.deck[a].f);
  sim.flip(k, a, 2, time.now());
  const miss = sim.flip(k, b, 2, time.now());
  assert.equal(miss.length, 1, 'only the flip itself');
  assert.deepEqual(sim.flip(k, s.deck.findIndex((c) => c.s === 0), 1, time.now()), [], 'nothing flips while a miss is showing');
  time.t += MISS_MS;
  sim.step(time.now());
  assert.equal(s.deck[a].s, 0, 'the miss went back down');
  assert.equal(s.deck[b].s, 0);
  assert.equal(s.players[s.turn], 1, 'the turn came round');
});

test('a board of Picture Pairs plays out to the end, with the pairs each found', () => {
  const time = clock();
  const sim = new ArcadeSim(8);
  const k = keyOf(4, 4, 4);
  const s = sim.play(4, 4, 4, 'pairs', 1, time.now());
  sim.play(4, 4, 4, 'pairs', 2, time.now());
  let boards = 0;
  for (let go = 0; go < 64 && s.phase === 'play'; go++) {
    const pid = s.players[s.turn];
    const first = s.deck.findIndex((c) => c.s === 0);
    const second = s.deck.findIndex((c, i) => i > first && c.s === 0 && c.f === s.deck[first].f);
    // Every other go, a miss first.
    if (go % 3 === 2) {
      const other = s.deck.findIndex((c, i) => i > first && c.s === 0 && c.f !== s.deck[first].f);
      sim.flip(k, first, pid, time.now());
      sim.flip(k, other, pid, time.now());
      time.t += MISS_MS;
      sim.step(time.now());
      continue;
    }
    sim.flip(k, first, pid, time.now());
    for (const news of sim.flip(k, second, pid, time.now())) if (news.f === 'board') boards++;
  }
  assert.equal(s.phase, 'done');
  assert.equal(boards, 1, 'one board done, told once');
  assert.equal([...s.found.values()].reduce((n, p) => n + p, 0), FACES.length, 'all eight pairs found between them');
  time.t += BOARD_DONE_MS;
  sim.step(time.now());
  assert.equal(sim.sessions.size, 0, 'the game packs up after the scores');
});

test('a player leaving a Picture Pairs board: their cards go back down and the board goes on', () => {
  const time = clock();
  const sim = new ArcadeSim(10);
  const k = keyOf(6, 1, 6);
  const s = sim.play(6, 1, 6, 'pairs', 1, time.now());
  sim.play(6, 1, 6, 'pairs', 2, time.now());
  sim.flip(k, 0, 1, time.now());
  assert.ok(sim.left(1), 'they were playing');
  assert.deepEqual(s.players, [2]);
  assert.equal(s.deck[0].s, 0, 'the card they left up went down');
  assert.equal(s.players[s.turn], 2, 'it is the one left behind\'s go');
  // The last one leaving ends the board at once.
  assert.ok(sim.left(2));
  assert.equal(sim.sessions.size, 0);
});

// ---------------------------------------------------------------- the room

test('the island runs the games at its machines, and tells everyone as they go', () => {
  const { room, time } = arcadeRoom();
  const at = machine(room);
  const a = join(room, 'A');
  const b = join(room, 'B');
  stand(room, a, { x: at.x - 1, y: at.y, z: at.z });
  stand(room, b, { x: at.x + 1, y: at.y, z: at.z });
  const arc = (c) => c.last('arc')?.s ?? [];
  // Play: a game begins at that machine, told to everyone at once.
  room.receive(a, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
  for (const c of [a, b]) {
    assert.equal(c.all('arc').length, 1, `${c.pid} heard`);
    assert.deepEqual(arc(c).map((s) => [s.k, s.g, s.p]), [[keyOf(at.x, at.y, at.z), 0, 0]]);
    assert.equal(arc(c)[0].ps.length, 1);
  }
  // A newcomer is told about it as they arrive.
  const c = join(room, 'C');
  assert.deepEqual(c.last('welcome').arcade.map((s) => [s.k, s.g, s.p]), [[keyOf(at.x, at.y, at.z), 0, 0]], 'a newcomer sees the game going');
  // The round plays: blobs come up, and a bop pops one for everyone to see.
  play(room, time, COUNTDOWN_MS + 500);
  const holes = arc(a)[0].h;
  assert.ok(holes.some((kind) => kind > 0), 'a blob is up');
  const hole = holes.findIndex((kind) => kind);
  room.receive(b, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
  room.receive(b, { t: 'arcade', op: 'bop', x: at.x, y: at.y, z: at.z, i: hole });
  const pop = b.last('arcfx');
  assert.equal(pop.f, 'pop');
  assert.equal(pop.by, b.pid);
  assert.equal(pop.k, keyOf(at.x, at.y, at.z));
  assert.equal(arc(a)[0].s, pop.s, 'the score shows to everyone');
  assert.deepEqual(arc(a)[0].ps, arc(b)[0].ps);
  // A bop from far away, or at nothing, changes nothing.
  const before = JSON.stringify(arc(a));
  room.receive(c, { t: 'm', s: [at.x + 40, at.y, at.z + 40, 0, 0, 0] });
  room.receive(c, { t: 'arcade', op: 'bop', x: at.x, y: at.y, z: at.z, i: (hole + 1) % HOLES });
  room.receive(a, { t: 'arcade', op: 'bop', x: at.x, y: at.y, z: at.z, i: (hole + 2) % HOLES });
  assert.equal(JSON.stringify(arc(a)), before);
  // The round ends, everyone is told its scores, and the game packs up.
  play(room, time, ROUND_MS + 100);
  assert.ok(a.all('arcfx').some((m) => m.f === 'round' && m.ps.some(([pid]) => pid === a.pid || pid === b.pid)), 'the round\'s scores, for everyone who played');
  play(room, time, DONE_MS + 200);
  assert.equal(room.arcade.sessions.size, 0);
  assert.deepEqual(arc(a), []);
});

test('a machine picked up mid-game: its game goes with it', () => {
  const { room, time } = arcadeRoom();
  const at = machine(room);
  const a = join(room);
  stand(room, a, { x: at.x - 1, y: at.y, z: at.z });
  room.receive(a, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
  play(room, time, COUNTDOWN_MS);
  assert.equal(room.arcade.sessions.size, 1);
  room.world.set(at.x, at.y, at.z, B.AIR);
  assert.equal(room.arcade.sessions.size, 0);
  assert.deepEqual(a.last('arc').s, []);
  // And pressing Play where no machine is does nothing at all.
  room.receive(a, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
  assert.equal(room.arcade.sessions.size, 0);
});

test('a player leaving the island leaves the machines, and their game ends with the last of them', () => {
  const { room, time } = arcadeRoom();
  const at = machine(room, B.ARCADE_PAIRS);
  const a = join(room, 'A');
  const b = join(room, 'B');
  for (const c of [a, b]) {
    stand(room, c, { x: at.x - 1, y: at.y, z: at.z });
    room.receive(c, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
  }
  const s = room.arcade.sessions.get(keyOf(at.x, at.y, at.z));
  assert.deepEqual(s.players, [a.pid, b.pid]);
  // B closes the game's window: they leave the machine, and the board goes
  // on for A, who is told they are on their own at it now — from however
  // far away B has got to.
  room.receive(b, { t: 'm', s: [at.x + 40, at.y, at.z + 40, 0, 0, 0] });
  room.receive(b, { t: 'arcade', op: 'leave', x: at.x, y: at.y, z: at.z });
  assert.deepEqual(s.players, [a.pid]);
  assert.equal(b.last('arc').s[0].ps.length, 1, 'B told the game goes on with A alone');
  // A goes home from the island altogether: nothing is left at the machine.
  room.receive(a, { t: 'leave' });
  assert.equal(room.arcade.sessions.size, 0);
});

test('nobody plays at a machine from further away than beside it', () => {
  const { room } = arcadeRoom();
  const at = machine(room);
  const a = join(room);
  for (const [dx, dz, ok] of [
    [1, 0, true],
    [REACH, 0, true],
    [REACH + 2, 0, false],
    [0, REACH + 2, false],
  ]) {
    room.receive(a, { t: 'm', s: [at.x + 0.5 + dx, at.y, at.z + 0.5 + dz, 0, 0, 0] });
    room.receive(a, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
    assert.equal(room.arcade.sessions.size, ok ? 1 : 0, `${dx} to the side, ${dz} away`);
    if (ok) room.arcade.removeAt(at.x, at.y, at.z);
  }
});

test('arcade games are never saved, and machines come back with the island', () => {
  const { room, time } = arcadeRoom();
  const at = machine(room, B.ARCADE_PAIRS);
  const a = join(room);
  stand(room, a, { x: at.x - 1, y: at.y, z: at.z });
  room.receive(a, { t: 'arcade', op: 'play', x: at.x, y: at.y, z: at.z });
  play(room, time, 1000);
  const save = room.exportSave();
  assert.ok(!('arcade' in save), 'nothing of the games in the save');
  const again = new Room({ code: room.code, save, now: time.now });
  assert.equal(again.arcade.sessions.size, 0, 'the island opens again with no game going');
  assert.equal(again.world.get(at.x, at.y, at.z), B.ARCADE_PAIRS, 'the machine is where it was');
});

// ---------------------------------------------------------------- the stickers

test('three stickers for the arcade, on counts the game keeps', () => {
  for (const key of ['game-on', 'blob-bopper', 'sharp-memory']) {
    const sticker = STICKERS.find((s) => s.key === key);
    assert.ok(sticker, key);
    assert.ok(sticker.icon && sticker.name && sticker.text, `${key} says what it is`);
  }
  assert.ok(STICKERS.find((s) => s.key === 'game-on').test({ arcade: 1 }), 'a game played');
  assert.ok(STICKERS.find((s) => s.key === 'blob-bopper').test({ blobpops: 50 }), 'fifty blobs bopped');
  assert.ok(STICKERS.find((s) => s.key === 'sharp-memory').test({ pairsfound: 25 }), 'twenty-five pairs found');
  for (const key of ['arcade', 'blobpops', 'pairsfound']) assert.ok(STAT_KEYS.includes(key), `${key} is counted`);
});
