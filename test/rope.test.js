// The jump rope: put down from the toy box like a hula hoop and taken up by
// one player at a time (going with them at the island, dropped where they
// stand), and its rules, played here with a body on real ground: keeping time
// goes on as long as you like, at any frame rate, and nothing else does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, critterBox, heldToy, VEHICLES } from '../public/js/shared/critters.js';
import { newRope, packTurn, ROPE, ropeDue, ropeRate, ropeTurn, stepRope, unpackTurn } from '../public/js/shared/jump-rope.js';
import { makeBody, stepBody } from '../public/js/shared/physics.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { addProgress } from '../public/js/shared/keeper.js';
import { NEWS } from '../public/js/news.js';
import { ANIM } from '../public/js/render/avatar.js';

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
  return c;
}

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  return c;
}

// A flat meadow: grass at y 10 everywhere, with the start in the middle.
function meadow() {
  const W = 64;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

function meadowRoom() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now });
  room.world = meadow();
  room.hookWorld();
  for (const c of [...room.critters.list]) room.critters.remove(c.id);
  return { room, time };
}

const at = (x, z, y = 11) => ({ t: 'm', s: [x, y, z, 0, 0, 0] });
const step = (room, time, ms = 100) => {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
};

// Plays until the rope has caught you or `rounds` have gone by, in steps of
// dt, as game.js does: the rope, then the hop it says to go. press(rope, dt)
// is whether jump goes down this frame.
function play(press, { dt = 1 / 60, rounds = 200 } = {}) {
  const w = meadow();
  const b = makeBody(20.5, 11, 20.5);
  const r = newRope();
  let hops = 0;
  let high = 0;
  for (let i = 0; i < 10; i++) stepBody(w, b, { mx: 0, mz: 0 }, 1 / 60);
  while (r.passes < rounds) {
    const now = stepRope(r, dt, { up: !b.onGround, pressed: press(r, dt) });
    if (now.caught) return { rope: r, caught: true, hops, high };
    if (now.hop) hops++;
    stepBody(w, b, { mx: 0, mz: 0, jump: now.hop }, dt, { move: { jump: ROPE.hop } });
    high = Math.max(high, b.y - 11);
  }
  return { rope: r, caught: false, hops, high };
}

// Pressing jump once a turn, this long before the rope gets to your feet.
function keepingTime(before) {
  let done = -1;
  return (r) => {
    const left = (Math.PI * 2 * (r.passes + 1) - r.turn) / ropeRate(r.secs);
    if (left > before || done === r.passes) return false;
    done = r.passes;
    return true;
  };
}

test('a jump rope is in the toy box with the vehicles, nobody rides it, and it lies flat without bumping anyone', () => {
  assert.ok(VEHICLES.includes('rope'));
  assert.equal(CRITTER_INFO.rope.ride, undefined);
  assert.equal(critterBox('rope'), null);
  assert.ok(heldToy('rope') && heldToy('hoop') && !heldToy('car') && !heldToy('bunny'));
});

test('it goes round by the clock, from under your heels, faster the longer you keep going, and then no faster', () => {
  assert.equal(ropeTurn(0), 0);
  assert.equal(ropeRate(0), ROPE.slow);
  assert.equal(ropeRate(ROPE.ramp), ROPE.fast);
  assert.equal(ropeRate(ROPE.ramp * 3), ROPE.fast);
  // ropeTurn is what all that speed adds up to, frame by frame.
  let sum = 0;
  const dt = 1 / 240;
  for (let t = dt / 2; t < ROPE.ramp + 20; t += dt) {
    sum += ropeRate(t) * dt;
    if (Math.abs(t + dt / 2 - 30) < dt / 2) assert.ok(Math.abs(sum - ropeTurn(30)) < 1e-3, `after 30 s: ${sum} and ${ropeTurn(30)}`);
  }
  assert.ok(Math.abs(sum - ropeTurn(ROPE.ramp + 20)) < 1e-2, 'and after it is up to speed');
  // There is time for a hop and the rest after it each time round, even at its fastest.
  const air = (2 * ROPE.hop) / 26;
  assert.ok(air + ROPE.rest < (Math.PI * 2) / ROPE.fast, `${air + ROPE.rest} s for a hop and a rest`);
});

test('keeping time goes on as long as you like, jumping every time, at any frame rate and pressing a little early or a little late', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 15, 0.1]) {
    for (const before of [0.08, 0.18, 0.28]) {
      const { rope, caught, hops, high } = play(keepingTime(before), { dt, rounds: 300 });
      const how = `${before} s before, in steps of ${dt}`;
      assert.equal(caught, false, how);
      assert.equal(rope.jumps, 300, how);
      assert.equal(hops, 300, how);
      assert.ok(high > 0.3 && high < 0.6, `a little hop, ${high} blocks, ${how}`);
    }
  }
});

test('the first time round shows you what is coming, and then it catches you if you do not jump', () => {
  const { rope, caught, hops } = play(() => false);
  assert.ok(caught);
  assert.deepEqual([rope.passes, rope.jumps, hops], [2, 0, 0]);
});

test('too soon or too late, it catches your feet', () => {
  // So soon that the hop is over before it gets there.
  const soon = play(keepingTime((2 * ROPE.hop) / 26 + 0.12), { rounds: 20 });
  assert.ok(soon.caught && soon.rope.jumps === 0, `${soon.rope.jumps} jumps pressing too soon`);
  // And just as it has gone by.
  let seen = 0;
  const late = play(
    (r) => {
      const now = r.passes > seen;
      seen = r.passes;
      return now;
    },
    { rounds: 20 },
  );
  assert.ok(late.caught && late.rope.jumps === 0, `${late.rope.jumps} jumps pressing too late`);
});

test('holding jump down hops once, and hammering at it soon goes wrong', () => {
  let down = false;
  const held = play(() => {
    const fresh = !down;
    down = true;
    return fresh;
  });
  assert.ok(held.caught);
  assert.ok(held.hops <= 1, `${held.hops} hops`);
  // As fast as a finger could go, at many different speeds: nobody gets far.
  const got = [];
  for (let every = 1; every <= 20; every++) {
    let i = 0;
    const { rope, caught } = play(() => i++ % every === 0, { rounds: 300 });
    got.push(caught ? rope.jumps : Infinity);
  }
  assert.ok(got.every((n) => n < 80), `jumps before it caught them: ${got}`);
});

test('it is due as it comes down to your feet, and not as it goes up behind you', () => {
  const r = newRope();
  const seen = [];
  for (let i = 0; i < 90; i++) {
    stepRope(r, 1 / 60, { up: true, pressed: false });
    seen.push(ropeDue(r));
  }
  const first = seen.indexOf(true);
  assert.ok(first > 0, 'not at once');
  const secs = (first + 1) / 60;
  assert.ok(Math.abs((Math.PI * 2 - ropeTurn(secs)) / ropeRate(secs) - ROPE.warn) < 0.03, 'as long before as it says');
  assert.equal(seen[seen.length - 1], false, 'and not once it has gone by');
});

test('a rope put down is taken up by one player at a time, goes with them for as long as they keep at it, and drops where they stand', () => {
  const { room, time } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  const pa = a.last('welcome').you;
  const pb = b.last('welcome').you;
  room.receive(a, at(20.5, 20.5));
  room.receive(b, at(40.5, 40.5));
  room.receive(a, { t: 'critter', op: 'invite', type: 'rope', x: 21.5, y: 11, z: 20.5 });
  const added = b.last('cadd');
  assert.equal(added?.critter.type, 'rope');
  const rope = room.critters.get(added.critter.id);
  step(room, time, 2000);
  assert.ok(Math.abs(rope.y - 11) < 0.2, `on the grass: ${rope.y}`);
  // From far off: nothing.
  room.receive(b, { t: 'hoop', op: 'spin', id: rope.id });
  assert.equal(rope.hooper ?? 0, 0, 'too far away to take it up');
  // Beside it: in your hands, and everyone is told.
  room.receive(a, { t: 'hoop', op: 'spin', id: rope.id });
  assert.equal(rope.hooper, pa);
  assert.deepEqual(b.last('hoop'), { t: 'hoop', op: 'spin', id: rope.id, pid: pa });
  // It goes with you, hop or no hop, with no time limit to it.
  room.receive(a, at(21.5, 21.5, 11.3));
  step(room, time, 10 * 60 * 1000);
  assert.deepEqual([rope.x, rope.y, rope.z, rope.state, rope.hooper], [21.5, 11.3, 21.5, 'hoop', pa]);
  // A friend come over cannot take it from you, nor send it away.
  room.receive(b, at(21.5, 22.5));
  room.receive(b, { t: 'hoop', op: 'spin', id: rope.id });
  room.receive(b, { t: 'hoop', op: 'drop', id: rope.id });
  assert.equal(rope.hooper, pa);
  room.receive(b, { t: 'critter', op: 'bye', id: rope.id });
  assert.ok(room.critters.get(rope.id), 'still here');
  assert.match(b.last('notice').text, /jumping with/);
  // Dropped: down at your feet, and everyone is told.
  room.receive(a, { t: 'hoop', op: 'drop', id: rope.id });
  assert.equal(rope.hooper, 0);
  assert.deepEqual(b.last('hoop'), { t: 'hoop', op: 'drop', id: rope.id, pid: pa });
  step(room, time, 1000);
  assert.ok(Math.hypot(rope.x - 21.5, rope.z - 21.5) < 0.6 && rope.state === 'idle' && Math.abs(rope.y - 11) < 0.2, `where it dropped: ${rope.x}, ${rope.y}, ${rope.z}, ${rope.state}`);
  // Now the friend may take it up; going home drops it too.
  room.receive(b, { t: 'hoop', op: 'spin', id: rope.id });
  assert.equal(rope.hooper, pb);
  room.detach(b);
  assert.equal(rope.hooper, 0, 'dropped as they go');
  assert.deepEqual(a.last('hoop'), { t: 'hoop', op: 'drop', id: rope.id, pid: pb });
  // Nobody holding it, it can be sent away again.
  room.receive(a, { t: 'critter', op: 'bye', id: rope.id });
  assert.equal(room.critters.get(rope.id), null);
});

test('a friend is told you are jumping rope, and how far round it is, within what a move has room for', () => {
  const { room } = meadowRoom();
  const a = join(room);
  const b = join(room, 'Brave Otter');
  // The island passes on every way of standing there is.
  for (const anim of Object.values(ANIM)) {
    room.receive(a, { t: 'm', s: [20.5, 11, 20.5, 0, anim, 0] });
    assert.equal(b.last('m').s[4], anim);
  }
  assert.equal(ANIM.rope, Math.max(...Object.values(ANIM)), 'the newest of them');
  for (let turn = 0; turn < 40; turn += 0.37) {
    room.receive(a, { t: 'm', s: [20.5, 11, 20.5, 0, ANIM.rope, packTurn(turn)] });
    const told = b.last('m').s[5];
    const off = Math.abs(unpackTurn(told) - (turn % (Math.PI * 2)));
    assert.ok(Math.min(off, Math.PI * 2 - off) < 0.03, `${turn} comes through as ${unpackTurn(told)}`);
    assert.equal(told & 1, 0, 'and that is not flying');
  }
});

test('taking up a rope puts down the hoop you had going, and the other way round', () => {
  const { room } = meadowRoom();
  const a = join(room);
  const pa = a.last('welcome').you;
  room.receive(a, at(20.5, 20.5));
  room.receive(a, { t: 'critter', op: 'invite', type: 'rope', x: 21.5, y: 11, z: 20.5 });
  room.receive(a, { t: 'critter', op: 'invite', type: 'hoop', x: 19.5, y: 11, z: 20.5 });
  const rope = room.critters.list.find((c) => c.type === 'rope');
  const hoop = room.critters.list.find((c) => c.type === 'hoop');
  room.receive(a, { t: 'hoop', op: 'spin', id: hoop.id });
  assert.deepEqual([hoop.hooper, rope.hooper ?? 0], [pa, 0]);
  room.receive(a, { t: 'hoop', op: 'spin', id: rope.id });
  assert.deepEqual([hoop.hooper, rope.hooper], [0, pa]);
  // And nothing else can be taken up so.
  room.receive(a, { t: 'critter', op: 'invite', type: 'bunny', x: 21.5, y: 11, z: 21.5 });
  const bunny = room.critters.list.find((c) => c.type === 'bunny');
  room.receive(a, { t: 'hoop', op: 'spin', id: bunny.id });
  assert.equal(bunny.hooper ?? 0, 0);
  assert.equal(rope.hooper, pa);
});

test('your best in a row is one number, the better of two on a merge, with stickers at 10 and 100 for it', () => {
  assert.ok(STAT_KEYS.includes('ropebest') && STAT_KEYS.includes('ropejumps'));
  const stats = (ropebest) => ({ ropebest });
  for (const [key, goal] of [['skip-to-it', 10], ['rope-champ', 100]]) {
    const s = STICKERS.find((x) => x.key === key);
    assert.ok(s.test(stats(goal)) && !s.test(stats(goal - 1)), key);
  }
  const merged = addProgress({ stats: { ropebest: 12, ropejumps: 50 } }, { stats: { ropebest: 30, ropejumps: 40 } });
  assert.deepEqual([merged.stats.ropebest, merged.stats.ropejumps], [30, 90]);
  assert.ok(NEWS.some((n) => n.id === 'jump-rope'));
});
