// The Storybook, Adventure Isle's seventh episode (shared/book): its five
// stories, made to be played through — every bookmark, the boss's page and
// the stars got to the way anyone moves (reach.js) — its physics, its foes
// and their clocks, its bosses' moves, and a story as the island plays it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_KINDS, bossAt, bossSpec, hitBoss, newBoss, packBoss, phaseMs, stepBoss, unpackBoss } from '../public/js/shared/book/bosses.js';
import { FOES, foeAt, foeBox, foeSpec, moverAt, shotsOf, stompable } from '../public/js/shared/book/foes.js';
import { HERO, jumpOf, makeHero, MOVE, stepHero, thornsAt } from '../public/js/shared/book/hero.js';
import { Level, TILE } from '../public/js/shared/book/level.js';
import { reach } from '../public/js/shared/book/reach.js';
import { BOOK_KEYS, bookKey, bookLevel, bookTheme } from '../public/js/shared/book/stories/index.js';
import { BACK_MS, Tale } from '../public/js/shared/book/tale.js';
import { buildIsle } from '../public/js/shared/isle-maps.js';
import { chapterOf, CHAPTERS, EPISODES, firstStage, stagesOf } from '../public/js/shared/isle-story.js';
import { Rng } from '../public/js/shared/rng.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { normalizeMeta } from '../public/js/shared/world.js';

const FIRST = firstStage(7);
const book = CHAPTERS.filter((c) => c.episode === 7);

// ------------------------------------------------ the story

test('the seventh episode is five stories of the Storybook, each a page of tiles with its pages, bookmarks and boss', () => {
  const ep = EPISODES[6];
  assert.ok(ep.book && ep.n === 7 && ep.villain === 'Count Inkblot' && ep.token.icon === '💖');
  assert.equal(stagesOf(7), 5);
  assert.deepEqual(book.map((c) => c.key), ['meadow', 'harbor', 'turret', 'starry', 'inkwell']);
  assert.deepEqual(BOOK_KEYS, book.map((c) => c.key));
  for (const ch of book) {
    const L = bookLevel(ch.key);
    assert.ok(L instanceof Level, ch.key);
    assert.equal(ch.theme, bookTheme(ch.key));
    assert.equal(bookKey(ch.theme), ch.key);
    assert.equal(normalizeMeta({ theme: ch.theme }).theme, ch.theme, `${ch.key}: a kind of island pages know`);
    // A page of the story for each bookmark, and the boss's last of all.
    assert.equal(ch.pages.length, L.marks.length + 1, `${ch.key}: a page for each bookmark, and the boss's`);
    assert.equal(L.pages.length, ch.pages.length);
    ch.pages.forEach((p, i) => assert.ok(p.name && p.icon && p.hint.length > 40, `${ch.key}: ${p.name} told in full`));
    assert.equal(ch.pages.at(-1).boss, true);
    assert.equal(ch.pages.filter((p) => p.boss).length, 1);
    assert.equal(ch.boss, L.boss.kind, `${ch.key}: its boss at the end`);
    assert.ok(BOSS_KINDS.includes(ch.boss));
    assert.ok(ch.pages.at(-1).name === bossSpec(ch.boss).name, `${ch.key}: its last page is its boss's`);
    assert.ok(ch.intro.length > 200 && ch.won, ch.key);
    assert.ok(!ch.camps && !ch.lair && !ch.hazard && !ch.quests && !ch.battles && !ch.nightmares, `${ch.key}: nothing of camps`);
  }
  book.forEach((ch, i) => assert.match(ch.won, i === 4 ? /All five Happy Endings/ : /Happy Ending is back/, ch.key));
  // Each harder than the last, and than the sixth.
  const levels = book.map((c) => c.level);
  assert.ok(levels.every((l, i) => i === 0 || l > levels[i - 1]));
  assert.ok(levels[0] > chapterOf(firstStage(6)).level && levels.at(-1) > chapterOf(FIRST - 1).level, 'harder than the sixth');
  // Only the moon's story falls slowly.
  assert.deepEqual(book.map((c) => bookLevel(c.key).gravity), [1, 1, 1, 0.55, 1]);
});

test('a stage of the seventh episode is a box of air as long as its story, and everything there is told as you arrive', () => {
  for (const [i, ch] of book.entries()) {
    const made = buildIsle({ stage: FIRST + i, seed: 5 });
    const L = bookLevel(ch.key);
    const w = made.world;
    assert.equal(w.theme, ch.theme);
    assert.ok(w.W >= L.w && w.W <= 512 && w.H >= L.h && w.H <= 128 && w.D >= 16, ch.key);
    let solid = 0;
    for (let x = 0; x < w.W; x++) for (let y = 0; y < w.H; y++) for (let z = 0; z < w.D; z++) if (w.get(x, y, z)) solid++;
    assert.equal(solid, 0, `${ch.key}: not one block`);
    assert.deepEqual([w.spawn.x, w.spawn.y], [L.start.x, L.start.y]);
  }
});

// ------------------------------------------------ the stories, played through

for (const ch of book) {
  test(`${ch.name}: every bookmark, the boss's page and every star are got to, as anyone moves`, () => {
    const L = bookLevel(ch.key);
    const r = reach(L);
    assert.deepEqual(r.marks, L.marks.map((m) => m.id), `${ch.key}: every bookmark`);
    assert.ok(r.arena, `${ch.key}: the boss's page`);
    // On the boss's page, every plank too (out of the way of what it does).
    const A = L.arena;
    const missed = r.ledges.filter((l) => l.mover === undefined && l.x0 >= A.x0 && l.x1 <= A.x1 && !r.seen.has(l.id));
    assert.deepEqual(missed.map((l) => `${l.x0}-${l.x1}@${l.y}`), [], `${ch.key}: every plank on the boss's page got up on`);
    assert.equal(r.stars.size, L.stars.length, `${ch.key}: every star (missed: ${L.stars.filter((s) => !r.stars.has(s.i)).map((s) => `${s.x},${s.y}`).join(' ')})`);
    // Bookmarks along the story, one after another, each on the ground.
    L.marks.forEach((m, k) => {
      assert.equal(m.id, k + 1);
      assert.ok(k === 0 || m.x > L.marks[k - 1].x);
      assert.equal(L.ground(Math.floor(m.x), m.y + 2), m.y, `${ch.key}: bookmark ${m.id} stands on the ground`);
    });
    assert.ok(L.marks.at(-1).x < L.arena.x0, 'the last bookmark before the boss’s page');
  });

  test(`${ch.name}: its foes stand where they can, its stars and platforms are out in the open`, () => {
    const L = bookLevel(ch.key);
    const free = (x, y) => !L.solid(Math.floor(x), Math.floor(y));
    for (const s of L.stars) assert.ok(free(s.x, s.y), `${ch.key}: star ${s.i} at ${s.x},${s.y} is not in the ground`);
    for (const f of L.foes) {
      const spec = foeSpec(f.kind);
      assert.ok(FOES[f.kind], `${ch.key}: ${f.kind}`);
      assert.ok(f.skin, `${ch.key}: foe ${f.id} has a look`);
      // Wherever it goes in a long while, never in the ground.
      for (let t = 0; t < 60; t += 0.37) {
        const p = foeAt(f, t);
        const box = foeBox(f, p);
        if (!box) continue;
        const mid = box.y + box.h / 2;
        assert.ok(free(box.x - box.w / 2 + 0.06, mid) && free(box.x + box.w / 2 - 0.06, mid), `${ch.key}: foe ${f.id} (${f.kind}) at t ${t.toFixed(2)} not in the ground (${box.x.toFixed(2)}, ${mid.toFixed(2)})`);
      }
      // Those that walk do it on something.
      if (['walk', 'roll', 'hop', 'pop', 'shoot'].includes(spec.move)) {
        const under = (x) => L.solid(Math.floor(x), f.y - 1) || L.plank(Math.floor(x), f.y - 1);
        for (const x of [f.x0 ?? f.x, f.x1 ?? f.x, f.x]) assert.ok(under(x), `${ch.key}: foe ${f.id} (${f.kind}) has ground under it at ${x}`);
        assert.equal(f.y, Math.round(f.y), `${ch.key}: foe ${f.id} on a tile's top`);
      }
      if (spec.move === 'walk' || spec.move === 'roll') assert.ok(f.x1 - f.x0 >= 0.5, `${ch.key}: foe ${f.id} has room to walk`);
    }
    // Platforms that move, never through the ground.
    for (const m of L.movers) {
      for (let t = 0; t < m.period; t += m.period / 24) {
        const at = moverAt(m, t);
        for (let x = at.x + 0.1; x < at.x + m.w - 0.1; x += 0.4) assert.ok(free(x, at.y - 0.1) && free(x, at.y + 0.6), `${ch.key}: platform ${m.id} clear of the ground`);
      }
    }
    for (const c of L.crates) assert.equal(L.at(c.x, c.y), TILE.CRATE);
    // Its boss's page: flat floor, wide enough, the boss on it.
    const A = L.arena;
    assert.ok(A.x1 - A.x0 >= 24, `${ch.key}: a wide boss's page`);
    for (let x = A.x0; x < A.x1; x++) assert.equal(L.ground(x, A.floor), A.floor, `${ch.key}: flat floor at ${x}`);
    assert.ok(L.boss.x > A.x0 && L.boss.x < A.x1);
    assert.ok(L.w <= 510 && L.h + 10 <= 128);
  });
}

// ------------------------------------------------ getting about

const flat = (w = 40) => {
  const L = new Level({ key: 'test', w, h: 16 });
  for (let x = 0; x < w; x++) for (let y = 0; y < 4; y++) L.set(x, y, TILE.GROUND);
  return L;
};

function run(L, h, ctl, secs, t0 = 0) {
  const out = [];
  for (let t = 0; t < secs; t += 1 / 60) out.push({ ...stepHero(L, h, typeof ctl === 'function' ? ctl(t) : ctl, 1 / 60, t0 + t), x: h.x, y: h.y });
  return out;
}

test('a jump goes as high as held, from the ground or just off an edge; a plank is stood on from above and dropped through', () => {
  const L = flat();
  const { high } = jumpOf(L);
  assert.ok(Math.abs(high - 3.4) < 0.05);
  const h = makeHero(5.5, 4);
  const full = Math.max(...run(L, h, (t) => ({ jump: t < 0.6 }), 1.2).map((e) => e.y));
  assert.ok(Math.abs(full - 4 - high) < 0.15, `held, as high as a jump goes (${full})`);
  const h2 = makeHero(5.5, 4);
  const tap = Math.max(...run(L, h2, (t) => ({ jump: t < 0.05 }), 1.2).map((e) => e.y));
  assert.ok(tap - 4 < high * 0.45, `tapped, much less (${tap})`);
  assert.equal(h2.y, 4, 'and down again');
  // Off an edge: a jump a moment after still goes.
  const E = flat(40);
  for (let x = 10; x < 40; x++) for (let y = 0; y < 4; y++) E.set(x, y, TILE.AIR);
  const h3 = makeHero(9.4, 4);
  h3.vx = MOVE.run;
  let jumped = false;
  run(E, h3, (t) => ({ x: 1, jump: t > 0.09 && t < 0.3 }), 0.25).forEach((e) => (jumped ||= e.jumped));
  assert.ok(jumped, 'coyote time');
  // A plank: through it from below, on to it from above, and Down drops you through.
  L.set(8, 6, TILE.PLANK);
  L.set(9, 6, TILE.PLANK);
  const h4 = makeHero(8.8, 4);
  run(L, h4, (t) => ({ jump: t < 0.6 }), 1.5);
  assert.equal(h4.y, 7, 'up through the plank and stood on it');
  run(L, h4, (t) => ({ down: t > 0.1 && t < 0.2 }), 1);
  assert.equal(h4.y, 4, 'dropped back through it');
  // A wall in the way, and a ceiling to bump your head on.
  L.set(14, 4, TILE.BLOCK);
  L.set(14, 5, TILE.BLOCK);
  const h5 = makeHero(11, 4);
  run(L, h5, { x: 1 }, 1);
  assert.ok(h5.x <= 14 - HERO.w / 2 + 1e-3 && h5.x > 13, `stopped by the wall (${h5.x})`);
  L.set(3, 7, TILE.BLOCK);
  const h6 = makeHero(3.5, 4);
  const bumped = run(L, h6, { jump: true }, 0.6).some((e) => e.bumped);
  assert.ok(bumped && Math.max(h6.y) < 7, 'a head bumped');
});

test('a spring bounces you up high, thorns prick, and off the foot of the page you fall', () => {
  const L = flat();
  L.set(6, 4, TILE.SPRING);
  const h = makeHero(6.5, 7);
  const evs = run(L, h, {}, 1);
  assert.ok(evs.some((e) => e.sprung));
  assert.ok(Math.max(...evs.map((e) => e.y)) > 10, 'up high');
  L.set(10, 4, TILE.THORNS);
  assert.equal(thornsAt(L, makeHero(10.5, 4)), true);
  assert.equal(thornsAt(L, makeHero(12.5, 4)), false);
  assert.equal(thornsAt(L, makeHero(10.5, 5.5)), false, 'not over them');
  for (let x = 20; x < 24; x++) for (let y = 0; y < 4; y++) L.set(x, y, TILE.AIR);
  const h2 = makeHero(21.5, 4.5);
  assert.ok(run(L, h2, {}, 2).some((e) => e.fell));
});

test('a platform that moves carries whoever stands on it', () => {
  const L = flat();
  for (let x = 10; x < 30; x++) for (let y = 0; y < 4; y++) L.set(x, y, TILE.AIR);
  const m = { id: 0, kind: 'raft', x: 12, y: 4, w: 3, dx: 3, dy: 0, period: 4, phase: 0 };
  const h = makeHero(13.5, 4.3);
  for (let t = 0; t < 1.3; t += 1 / 60) stepHero(L, h, {}, 1 / 60, t, { movers: [m] });
  assert.equal(h.on, 0);
  const at = moverAt(m, 1.3);
  assert.ok(Math.abs(h.y - at.y) < 1e-6 && h.x > at.x && h.x < at.x + m.w, `on it, carried along (${h.x}, platform at ${at.x})`);
});

// ------------------------------------------------ foes and bosses

test('foes go about by the clock alone: back and forth along their ledges, popping up, spitting', () => {
  const f = { id: 1, kind: 'walker', x: 5, y: 4, x0: 3, x1: 7, phase: 0.25 };
  const xs = Array.from({ length: 200 }, (_, i) => foeAt(f, i * 0.1).x);
  assert.ok(Math.min(...xs) >= 3 - 1e-9 && Math.max(...xs) <= 7 + 1e-9);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 3.9, 'end to end');
  assert.deepEqual(foeAt(f, 12.3), foeAt(f, 12.3), 'the same every time');
  const p = { id: 2, kind: 'popper', x: 5, y: 4, phase: 0 };
  const ups = Array.from({ length: 100 }, (_, i) => foeAt(p, i * 0.1));
  assert.ok(ups.some((o) => foeBox(p, o) === null) && ups.some((o) => stompable(p, o)), 'down in its hole, and up out of it');
  assert.equal(stompable({ kind: 'spiky' }, { up: 1 }), false, 'never land on a prickly one');
  const s = { id: 3, kind: 'shooter', x: 10, y: 4, face: -1, range: 6, phase: 0 };
  const shots = Array.from({ length: 80 }, (_, i) => shotsOf(s, i * 0.1)).flat();
  assert.ok(shots.length && shots.every((o) => o.x < 10 && o.x > 10 - 6.6), 'spat its way, no further than its room');
});

for (const kind of BOSS_KINDS) {
  test(`${bossSpec(kind).name} goes through its moves for ever, and can be landed on while weak, from the floor, till it pops`, () => {
    const A = { x0: 100, x1: 126, floor: 4 };
    const b = newBoss(kind, A);
    b.at = 0;
    const rng = new Rng(3);
    const people = [{ id: 1, x: 106, y: 4 }];
    const { high } = jumpOf({ gravity: kind === 'nibbles' ? 0.55 : 1, jump: kind === 'nibbles' ? 0.82 : 1 });
    let weak = 0;
    let t = 0;
    const seen = new Set();
    for (; t < 240000 && b.phase !== 'beaten'; t += 50) {
      people[0].x = 104 + ((t / 1000) % 18);
      stepBoss(b, t, A, people, rng);
      seen.add(b.phase);
      const p = bossAt(b, t, A);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${kind} ${b.phase}: somewhere`);
      assert.ok(p.x >= A.x0 && p.x <= A.x1, `${kind} ${b.phase}: on its page (${p.x})`);
      for (const s of p.shots) assert.ok(s.flood || (Number.isFinite(s.x) && Number.isFinite(s.y) && s.r > 0), `${kind}: what it throws`);
      if (!p.spot) continue;
      // Weak: its spot where a jump from the floor gets to.
      assert.ok(p.spot.y + p.spot.h - A.floor < high + 0.6, `${kind} ${b.phase}: landed on from the floor (${p.spot.y + p.spot.h - A.floor})`);
      weak++;
      if (weak % 10 === 0) assert.ok(hitBoss(b, t, A), `${kind}: a stomp while weak takes a heart`);
    }
    assert.equal(b.phase, 'beaten', `${kind}: popped at last (in ${(t / 1000).toFixed(0)} s, through ${[...seen].join(', ')})`);
    assert.equal(b.hearts, 0);
    assert.equal(hitBoss(b, t, A), false, 'and that is that');
    const round = (v) => +v.toFixed(2);
    assert.deepEqual(unpackBoss(packBoss(b)), { ...b, from: { x: round(b.from.x), y: round(b.from.y), face: b.from.face }, to: b.to ? { x: round(b.to.x ?? 0), pot: b.to.pot } : null });
    assert.ok(phaseMs(newBoss(kind, A), A) > 0);
  });
}

// ------------------------------------------------ on the island

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  c.fx = (k) => c.inbox.filter((m) => m.t === 'bx' && m.k === k);
  return c;
}

function join(room, name = 'Brave Fox') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat' }, tickets: [2, 3, 4, 5, 6, 7] });
  c.pid = c.last('welcome')?.you;
  return c;
}

const bookRoom = (stage, time) => new Room({ code: '727272', adventure: true, shared: true, stage, seed: 9, theme: chapterOf(stage).theme, now: () => time.t });

function stay(room, time, c, x, y, ms = 300) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [x, y, 0, 0, 0, 0] });
    room.tick();
  }
}

test('a story on the island: its bookmarks lit as anyone gets to them, foes popped and back, stars each person’s own', () => {
  const time = { t: 1_000_000 };
  const room = bookRoom(FIRST, time);
  const { tale } = room.adventure;
  assert.ok(tale && room.adventure.active);
  const a = join(room);
  const info = a.last('welcome').adventure.book;
  assert.deepEqual([info.key, info.lit, info.gone, info.stars], ['meadow', [], [], []]);
  assert.deepEqual(room.adventure.tally(), { camps: 5, freed: 0, won: false, stage: FIRST, book: true });
  // Anywhere along the page; z always 0.
  room.receive(a, { t: 'm', s: [1e6, 5, 33, 0, 0, 0] });
  assert.deepEqual(room.players.get(a.pid).s.slice(0, 3), [tale.level.w, 5, 0]);
  // A foe landed on, there and then, is popped; one far off is not.
  stay(room, time, a, 5, 4);
  const f = tale.level.foes[0];
  const p = foeAt({ ...f, fast: tale.fast }, tale.clock / 1000);
  room.receive(a, { t: 'book', op: 'stomp', f: f.id, at: tale.clock });
  assert.equal(a.fx('pop').length, 0, 'too far off');
  stay(room, time, a, p.x, p.y + 1, 100);
  room.receive(a, { t: 'book', op: 'stomp', f: f.id, at: tale.clock });
  assert.equal(a.fx('pop').length, 1);
  assert.equal(a.fx('pop')[0].f, f.id);
  room.receive(a, { t: 'book', op: 'stomp', f: f.id, at: tale.clock });
  assert.equal(a.fx('pop').length, 1, 'once');
  // Back a while later, once nobody is near.
  stay(room, time, a, 55, 4, BACK_MS + 500);
  assert.equal(a.fx('back').length, 1);
  // A star, picked up once by each person.
  const s = tale.level.stars[0];
  stay(room, time, a, s.x, s.y - 1, 100);
  room.receive(a, { t: 'book', op: 'star', i: s.i });
  room.receive(a, { t: 'book', op: 'star', i: s.i });
  assert.deepEqual(tale.starsOf(a.pid), [s.i]);
  const b = join(room, 'Keen Owl');
  room.receive(b, { t: 'm', s: [s.x, s.y - 1, 0, 0, 0, 0] });
  room.receive(b, { t: 'book', op: 'star', i: s.i });
  assert.deepEqual(tale.starsOf(b.pid), [s.i], 'theirs too');
  // A crate bopped to bits, for everyone.
  const crate = tale.level.crates[0];
  stay(room, time, a, crate.x - 0.5, crate.y, 100);
  room.receive(a, { t: 'book', op: 'crate', i: crate.i });
  assert.equal(b.fx('crate').length, 1);
  assert.equal(tale.broken.has(crate.i), true);
  // Bookmarks lit by getting to them, for good, and every one before.
  const m2 = tale.level.marks[1];
  stay(room, time, b, m2.x + 0.4, m2.y);
  assert.deepEqual(a.all('bookmark').map((m) => m.id), [1, 2]);
  assert.deepEqual(tale.doneIds(), [1, 2]);
  assert.deepEqual(room.adventure.tally().freed, 2);
  // Out of HP (or off the page), back by the last bookmark lit.
  assert.deepEqual(tale.homeFor(), { x: m2.x + 1.2, y: m2.y + 0.01, z: 0 });
  const hp = room.players.get(a.pid).hp;
  room.receive(a, { t: 'book', op: 'fall' });
  assert.ok(room.players.get(a.pid).hp < hp, 'a fall costs HP');
  const before = room.players.get(a.pid).hp;
  room.receive(a, { t: 'book', op: 'hurt', k: 'foe' });
  assert.equal(room.players.get(a.pid).hp, before, 'safe a moment after');
});

test('the boss comes out once every bookmark is lit and someone is on its page, and its stage is won as it pops', () => {
  const time = { t: 2_000_000 };
  const room = bookRoom(FIRST, time);
  const { tale } = room.adventure;
  const a = join(room);
  const A = tale.level.arena;
  // Not before the bookmarks.
  room.receive(a, { t: 'm', s: [A.x0 + 5, A.floor, 0, 0, 0, 0] });
  room.players.get(a.pid).s = [A.x0 + 5, A.floor, 0, 0, 0, 0];
  stay(room, time, a, A.x0 + 5, A.floor, 3000);
  // (Got to by going past them: every one lit at once.)
  assert.equal(tale.bossReady, true);
  assert.equal(tale.bossState, 'on');
  assert.ok(a.fx('boss').length >= 1);
  // Landed on while weak: a heart off, for everyone to see.
  let hits = 0;
  for (let k = 0; k < 4000 && !tale.won; k++) {
    time.t += 50;
    const p = tale.boss ? bossAt(tale.boss, tale.clock, A) : null;
    const x = p?.spot ? p.spot.x : A.x0 + 6;
    room.receive(a, { t: 'm', s: [x, p?.spot ? p.spot.y : A.floor, 0, 0, 0, 0] });
    if (p?.spot) {
      room.receive(a, { t: 'book', op: 'boss', at: tale.clock });
      hits = a.fx('boss').filter((m) => m.hit).length;
    }
    room.tick();
  }
  assert.equal(tale.won, true);
  assert.equal(hits, bossSpec('grumbleweed').hearts);
  assert.equal(room.adventure.won, true);
  assert.equal(a.all('won').length, 1);
  assert.equal(a.last('bookmark').won, true);
  assert.deepEqual(tale.doneIds(), [1, 2, 3, 4, 5]);
  // Kept over a restart: its bookmarks lit again (and the boss to beat again).
  const again = new Tale({ key: 'meadow', story: chapterOf(FIRST), level: 16 }, 3);
  again.restore([1, 2, 3, 4]);
  assert.deepEqual([again.bossReady, again.won], [true, false]);
});

test('a stomp on the boss only counts while it is weak and from near enough', () => {
  const time = { t: 3_000_000 };
  const room = bookRoom(FIRST + 1, time);
  const { tale } = room.adventure;
  const a = join(room);
  tale.restore([1, 2, 3, 4]);
  const A = tale.level.arena;
  stay(room, time, a, A.x0 + 5, A.floor, 2500);
  assert.equal(tale.bossState, 'on');
  const hearts = tale.boss.hearts;
  // Not weak yet (walking after you).
  room.receive(a, { t: 'book', op: 'boss', at: tale.clock });
  assert.equal(tale.boss.hearts, hearts);
  // Wait for it to be weak, then stomp from far off: nothing.
  for (let k = 0; k < 400 && !bossAt(tale.boss, tale.clock, A).spot; k++) stay(room, time, a, A.x0 + 3, A.floor, 100);
  const spot = bossAt(tale.boss, tale.clock, A).spot;
  assert.ok(spot, 'weak at last');
  room.players.get(a.pid).s = [A.x1 + 20, A.floor, 0, 0, 0, 0];
  room.receive(a, { t: 'book', op: 'boss', at: tale.clock });
  assert.equal(tale.boss.hearts, hearts);
  room.players.get(a.pid).s = [spot.x, spot.y + 0.4, 0, 0, 0, 0];
  room.receive(a, { t: 'book', op: 'boss', at: tale.clock });
  assert.equal(tale.boss.hearts, hearts - 1);
  // Everybody gone: back to the start of its fight.
  stay(room, time, a, A.x0 - 30, A.floor, 10000);
  assert.deepEqual([tale.bossState, tale.boss], ['idle', null]);
});
