// Go at a Go board: the board as furniture (the first block past one byte),
// the rules (liberties, captures, no suicide, ko, counting areas), the AI
// friend's moves (taking what can be taken, saving its own, keeping out of
// its eyes, passing once nothing matters), the island's side (sitting down,
// a second player or the AI friend as white, turns, passes, giving up, a
// board picked up, a player gone), and the AI friend coming over when called,
// playing white and teaching the rules as the game goes.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import { BLACK, DEFAULT_SIZE, emptyBoard, GoSim, goBoardNear, groupAt, isGoBoard, LESSONS, moveValue, NO_MOVE, pickMove, placeName, score, SIZES, tryMove, WHITE } from '../public/js/shared/go.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { decodeBlocks, encodeBlocks } from '../public/js/shared/world.js';
import { Buddy, DEFAULT_NAME } from '../server/buddy.js';

// A board from its rows, as LESSONS draws them.
const rows = (...r) => r.join('');

// ---------------------------------------------------------------- the board

test('the Go Board is furniture in the Home tab after the study desk, on an id past one byte that saves and loads', () => {
  assert.ok(B.GO_BOARD >= 256, 'past one byte');
  assert.ok(B.GO_BOARD < B.BLOCK_IDS);
  assert.equal(B.block(B.GO_BOARD).name, 'Go Board');
  assert.equal(B.KIND[B.GO_BOARD], B.K_FURNITURE);
  assert.equal(B.SOLID[B.GO_BOARD], 1);
  assert.ok(isGoBoard(B.GO_BOARD));
  assert.ok(!isGoBoard(B.TABLE));
  const home = B.BLOCKS.filter((d) => d?.category === 'home').map((d) => d.id);
  assert.ok(home.includes(B.GO_BOARD));
  for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(B.GO_BOARD)) {
    assert.ok(x0 >= 0 && y0 >= 0 && z0 >= 0 && x1 <= 1 && y1 <= 1 && z1 <= 1, 'inside its cell');
  }
  // On an island: kept as it is, not read back as anything else.
  const cells = Uint16Array.from([B.GO_BOARD, B.GRASS, B.GO_BOARD, B.AIR, B.STUDY_DESK, B.GO_BOARD, 0, 0]);
  assert.deepEqual(decodeBlocks(encodeBlocks(cells, 2, 2, 2), 2, 2, 2), cells);
});

test('a board beside you is found, and none further away', () => {
  const room = new Room({ code: '111111', theme: 'flat', size: 'small', seed: 3 });
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 2;
  const z = Math.floor(w.spawn.z);
  const y = w.top(x, z) + 1;
  w.set(x, y, z, B.GO_BOARD);
  const near = goBoardNear(w, { x: x - 0.7, y, z: z + 0.5 });
  assert.deepEqual([near.x, near.y, near.z], [x, y, z]);
  assert.equal(goBoardNear(w, { x: x - 6, y, z: z + 0.5 }), null);
});

// ---------------------------------------------------------------- the rules

test('a stone with no breathing spaces left is captured, a group shares its breathing spaces', () => {
  // A white stone with black on three sides: the fourth captures it.
  const b = rows('.....', '..b..', '.bw..', '..b..', '.....');
  assert.equal(groupAt(b, 5, 12).libs.size, 1);
  const res = tryMove(b, 5, 13, BLACK);
  assert.deepEqual(res.captured, [12]);
  assert.equal(res.board[12], '.');
  // Two stones side by side share their breathing spaces.
  const two = rows('.....', '.....', '.bb..', '.....', '.....');
  assert.equal(groupAt(two, 5, 11).stones.length, 2);
  assert.equal(groupAt(two, 5, 11).libs.size, 6);
});

test('no stone where it would have no breathing space, unless it captures, and no taking back at once (ko)', () => {
  const eye = rows('.w...', 'w....', '.....', '.....', '.....');
  assert.equal(tryMove(eye, 5, 0, BLACK).why, 'suicide');
  assert.equal(tryMove(eye, 5, 1, BLACK).why, 'taken');
  // A ko: black takes the white stone at 12; white may not take straight back.
  const ko = rows('.....', '..bw.', '.bw.w', '..bw.', '.....');
  const take = tryMove(ko, 5, 13, BLACK);
  assert.deepEqual(take.captured, [12]);
  assert.equal(take.ko, 12);
  assert.equal(tryMove(take.board, 5, 12, WHITE, take.ko).why, 'ko');
  // Played elsewhere first, it may.
  assert.ok(!tryMove(take.board, 5, 12, WHITE, -1).why);
  for (const why of ['taken', 'suicide', 'ko', 'turn']) assert.ok(NO_MOVE[why], `says why for ${why}`);
});

test('the count is each side\'s stones and the empty places only it surrounds', () => {
  const b = rows('.b.w.', '.b.w.', '.b.w.', '.b.w.', '.b.w.');
  // Column 0 is black's, column 4 white's, column 2 both reach.
  assert.deepEqual(score(b, 5), { b: 10, w: 10 });
  assert.deepEqual(score(emptyBoard(5), 5), { b: 0, w: 0 });
  assert.equal(placeName(5, 0), 'A5');
  assert.equal(placeName(9, 80), 'J1');
});

test('the AI friend takes a stone it can take, saves its own, keeps out of its eyes, and passes once nothing matters', () => {
  // A black stone with one breathing space: white takes it.
  const take = rows('.....', '..w..', '.wbw.', '.....', '.....');
  assert.equal(pickMove({ n: 5, b: take, ko: -1, m: 6, passes: 0 }, WHITE, () => 0), 17);
  // A white stone with one breathing space: white saves it (the only way out).
  const save = rows('.....', '..b..', '.bw..', '..b..', '.....');
  assert.ok(moveValue(save, 5, 13, WHITE) > moveValue(save, 5, 0, WHITE));
  assert.equal(pickMove({ n: 5, b: save, ko: -1, m: 4, passes: 0 }, WHITE, () => 0), 13, 'out the open side');
  // Its own eye it never fills.
  const eyes = rows('.w.w.', 'wwwww', 'bbbbb', '.b.b.', 'bbbbb');
  assert.equal(moveValue(eyes, 5, 0, WHITE), -Infinity);
  // A board split up with nothing left to fight over: it passes.
  assert.equal(pickMove({ n: 5, b: eyes, ko: -1, m: 30, passes: 1 }, WHITE, () => 0), -1);
  // The first stone in the middle.
  assert.equal(pickMove({ n: 9, b: emptyBoard(9), ko: -1, m: 0, passes: 0 }, WHITE, () => 0), 40);
});

test('games against it end, on every size, and quickly', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const n of SIZES) {
    const sim = new GoSim();
    const g = sim.start(0, 0, 0, 1, n, 2);
    const began = Date.now();
    while (!g.over) {
      const pid = g.t === BLACK ? 1 : 2;
      const i = pickMove(g, g.t, random);
      const fx = i < 0 ? sim.pass(g.k, pid) : sim.move(g.k, pid, i);
      assert.ok(Array.isArray(fx), `a move it can play (${fx.why})`);
      assert.ok(g.m < n * n * 4, 'not for ever');
    }
    assert.ok(Date.now() - began < 3000, `${n}×${n} took ${Date.now() - began} ms`);
    assert.equal(g.over.b + g.over.w <= n * n, true);
  }
});

test('the lessons teach the rules a step at a time, each with a little board', () => {
  assert.deepEqual(LESSONS.map((l) => l.key), ['turns', 'liberties', 'capture', 'nowhere', 'area']);
  for (const l of LESSONS) {
    assert.ok(l.title && l.text.length > 40);
    assert.ok(l.board.every((r) => r.length === l.board.length && /^[.bwox]+$/.test(r)));
  }
});

// ---------------------------------------------------------------- the host's side

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

function join(room, name, extra = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat' }, ...extra });
  c.pid = c.last('welcome').you;
  return c;
}

function goRoom() {
  const time = clock();
  const room = new Room({ code: '222222', theme: 'flat', size: 'small', seed: 9, now: time.now });
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 2;
  const z = Math.floor(w.spawn.z);
  const y = w.top(x, z) + 1;
  w.set(x, y, z, B.GO_BOARD);
  return { room, time, at: { x, y, z } };
}

const stand = (room, c, at, dx = -1) => room.receive(c, { t: 'm', s: [at.x + 0.5 + dx, at.y, at.z + 0.5, 0, 0, 0] });
const op = (room, c, at, o, extra = {}) => room.receive(c, { t: 'go', op: o, x: at.x, y: at.y, z: at.z, ...extra });
const game = (c) => c.last('go')?.s?.[0];

test('two friends play at a board: black sits down first, white joins, turns are kept, and a newcomer sees the game', () => {
  const { room, at } = goRoom();
  const a = join(room, 'A');
  const b = join(room, 'B');
  stand(room, a, at, -1);
  stand(room, b, at, 1);
  op(room, a, at, 'sit');
  assert.deepEqual(game(b).p, [a.pid, 0]);
  assert.equal(game(b).n, DEFAULT_SIZE);
  // Nobody plays before there is someone to play against.
  op(room, a, at, 'move', { i: 12 });
  assert.equal(a.last('gofx').why, 'turn');
  op(room, b, at, 'sit');
  assert.deepEqual(game(a).p, [a.pid, b.pid]);
  // A fresh, bigger board, by a player at it.
  op(room, a, at, 'new', { n: 7 });
  assert.equal(game(a).n, 7);
  op(room, a, at, 'move', { i: 24 });
  assert.equal(game(b).b[24], BLACK);
  assert.equal(game(b).t, WHITE);
  // Not black's turn again, and not where a stone is.
  op(room, a, at, 'move', { i: 25 });
  assert.equal(a.last('gofx').why, 'turn');
  op(room, b, at, 'move', { i: 24 });
  assert.equal(b.last('gofx').why, 'taken');
  op(room, b, at, 'move', { i: 25 });
  assert.equal(game(a).b[25], WHITE);
  // From far away, nothing.
  const before = JSON.stringify(game(a));
  room.receive(a, { t: 'm', s: [at.x + 30, at.y, at.z + 30, 0, 0, 0] });
  op(room, a, at, 'move', { i: 0 });
  assert.equal(JSON.stringify(game(a)), before);
  const c = join(room, 'C');
  assert.deepEqual(c.last('welcome').go.map((g) => [g.k, g.p]), [[`${at.x},${at.y},${at.z}`, [a.pid, b.pid]]]);
});

test('two passes end the game and count it, and giving up ends it too', () => {
  const { room, at } = goRoom();
  const a = join(room, 'A');
  const b = join(room, 'B');
  stand(room, a, at, -1);
  stand(room, b, at, 1);
  op(room, a, at, 'sit');
  op(room, b, at, 'sit');
  op(room, a, at, 'move', { i: 12 });
  op(room, b, at, 'pass');
  op(room, a, at, 'pass');
  const end = a.all('gofx').find((m) => m.f === 'end');
  assert.deepEqual([end.b, end.w, end.win, end.why], [25, 0, BLACK, 'score']);
  assert.deepEqual(end.p, [a.pid, b.pid]);
  op(room, a, at, 'new', { n: 5 });
  assert.equal(game(a).over, null);
  op(room, b, at, 'resign');
  assert.equal(game(a).over.win, BLACK);
  assert.equal(game(a).over.why, 'resign');
});

test('getting up, leaving the island or the board picked up: a board nobody is at is cleared', () => {
  const { room, at } = goRoom();
  const a = join(room, 'A');
  const b = join(room, 'B');
  stand(room, a, at, -1);
  stand(room, b, at, 1);
  op(room, a, at, 'sit');
  op(room, b, at, 'sit');
  // Black gets up: the seat waits for someone else.
  op(room, a, at, 'leave');
  assert.deepEqual(game(b).p, [0, b.pid]);
  op(room, a, at, 'sit');
  assert.deepEqual(game(b).p, [a.pid, b.pid]);
  room.receive(b, { t: 'leave' });
  assert.deepEqual(game(a).p, [a.pid, 0]);
  op(room, a, at, 'leave');
  assert.deepEqual(a.last('go').s, []);
  op(room, a, at, 'sit');
  room.world.set(at.x, at.y, at.z, B.AIR);
  assert.deepEqual(a.last('go').s, [], 'the board picked up, its game gone');
});

test('the AI friend is called over only when it is on the island, and only it sits down where it was called', () => {
  const { room, at } = goRoom();
  const a = join(room, 'A');
  stand(room, a, at, -1);
  op(room, a, at, 'sit');
  op(room, a, at, 'call');
  assert.match(a.last('notice').text, /AI friend is not on this island/);
  assert.equal(game(a).call, false);
  const pip = join(room, DEFAULT_NAME, { ai: true });
  assert.equal(a.last('joined').player.ai, true, 'pages know it is the AI friend');
  op(room, a, at, 'call');
  assert.equal(game(a).call, true);
  // A friend cannot take the AI friend's seat; it sits down as white.
  const b = join(room, 'B');
  stand(room, b, at, 1);
  op(room, b, at, 'sit');
  assert.deepEqual(game(a).p, [a.pid, 0]);
  stand(room, pip, at, 1.2);
  op(room, pip, at, 'sit');
  assert.deepEqual(game(a).p, [a.pid, pip.pid]);
  assert.equal(game(a).ai, pip.pid);
  // With only the AI friend left at it, the board clears.
  op(room, a, at, 'leave');
  assert.deepEqual(a.last('go').s, []);
});

test('stickers and XP for playing and winning Go', () => {
  for (const k of ['gogames', 'gowins']) {
    assert.ok(STAT_KEYS.includes(k));
    assert.ok(XP_FOR[k].xp > 0);
  }
  const test1 = STICKERS.find((s) => s.key === 'go-player').test;
  assert.ok(test1({ gogames: 1 }));
  assert.ok(STICKERS.find((s) => s.key === 'go-master').test({ gowins: 10 }));
});

// ---------------------------------------------------------------- the AI friend

const buddies = [];
after(() => buddies.forEach((b) => b.stop()));

function model() {
  const asked = [];
  return {
    model: 'stand-in',
    asked,
    problem: async () => '',
    chat: async (messages) => {
      asked.push(messages.at(-1).content);
      return { say: '', action: 'none', stamp: 'none' };
    },
  };
}

async function eventually(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${fn}`);
    await new Promise((done) => setTimeout(done, 25));
  }
}

test('called over, the AI friend walks up, sits down as white, plays its moves and teaches the rules as they go', async () => {
  const room = new Room({ code: '482753', theme: 'flat', name: 'Maple Fields', seed: 7 });
  const timer = setInterval(() => room.tick(), 100);
  after(() => clearInterval(timer));
  const rooms = new Map([[room.code, { room }]]);
  const island = { code: room.code, name: room.world.name, theme: 'flat', size: 'small', server: true };
  const heard = [];
  const kid = { send: (text) => heard.push(JSON.parse(text)) };
  room.attach(kid);
  room.receive(kid, { t: 'join', protocol: PROTOCOL, name: 'Minji', look: { animal: 'bunny' } });
  const me = heard.find((m) => m.t === 'welcome').you;
  const llm = model();
  const buddy = new Buddy({ llm, rooms, log: () => {}, wander: false, tickMs: 20, pauses: 0.1 });
  buddies.push(buddy);
  await buddy.start();
  buddy.invited(island, 'Minji');
  const pip = await eventually(() => [...room.players.values()].find((p) => p.name === DEFAULT_NAME && p.online));
  assert.equal(pip.ai, true);
  // A board a little way off, and Minji at it.
  const w = room.world;
  const x = Math.floor(w.spawn.x) + 6;
  const z = Math.floor(w.spawn.z) + 3;
  const y = w.top(x, z) + 1;
  w.set(x, y, z, B.GO_BOARD);
  room.broadcast({ t: 'edit', cells: [x, y, z, B.GO_BOARD] });
  const at = { x, y, z };
  room.receive(kid, { t: 'm', s: [x - 0.5, y, z + 0.5, 0, 0, 0] });
  room.receive(kid, { t: 'go', op: 'sit', ...at });
  room.receive(kid, { t: 'go', op: 'call', ...at });
  const g = () => room.go.games.get(`${x},${y},${z}`);
  await eventually(() => g()?.p[1] === pip.id);
  // Beside the board (where the island saw it last may lag a step behind).
  await eventually(() => Math.hypot(pip.s[0] - x - 0.5, pip.s[2] - z - 0.5) < 2);
  await eventually(() => llm.asked.some((p) => /Black and white take turns/.test(p)));
  // Minji plays; it answers with a stone of its own.
  room.receive(kid, { t: 'go', op: 'move', ...at, i: 6 });
  await eventually(() => g().t === BLACK && g().m === 2);
  assert.equal([...g().b].filter((c) => c === WHITE).length, 1);
  await eventually(() => llm.asked.some((p) => /breathing spaces \(liberties\)/.test(p)));
  // A stone where it has no breathing space: it explains.
  room.receive(kid, { t: 'go', op: 'move', ...at, i: g().b.indexOf(WHITE) });
  await eventually(() => llm.asked.some((p) => /tried to put a stone where it cannot go/.test(p)));
  // Minji gets up: the board clears, and it goes back to being with her.
  room.receive(kid, { t: 'go', op: 'leave', ...at });
  assert.equal(g(), undefined);
  room.receive(kid, { t: 'm', s: [x - 8, w.top(x - 9, z) + 1, z + 0.5, 0, 0, 0] });
  await eventually(() => Math.hypot(pip.s[0] - (x - 8), pip.s[2] - z - 0.5) < 4.5);
  assert.ok(me);
});
