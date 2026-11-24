// Adventure Isle's sixth episode, "The Land of Nod" (shared/isle-story.js): told
// in nightmares, in skies of little worlds of any shape with a down of their own
// (shared/nod/), and with no block in sight. The shapes and the walking on them;
// every dream's worlds, with everything there is to do in it got to the way
// someone does; the frights and their guards, that no weapon gets past; each
// nightmare and each boss on the real room; and what is kept over a restart.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { test } from 'node:test';
import { aimedPath, laneAt, offPath } from '../public/js/shared/nod/attacks.js';
import { NOD_BOSSES } from '../public/js/shared/nod/bosses.js';
import { BURST_R, Dream } from '../public/js/shared/nod/dream.js';
import { BOP_MS, CHIPS, FRIGHT_KINDS, FRIGHTS, Frights, frightOf, mightOf, OPENINGS, readFright } from '../public/js/shared/nod/foes.js';
import { flightAt } from '../public/js/shared/nod/maker.js';
import { add, Band, Body, Can, Chain, Crate, carry, dist3, dot, Dot, flatUnit, headingOf, len, Loop, Plate, Post, Space, sub, turn, unit, v3, yawOf } from '../public/js/shared/nod/shape.js';
import { makeWalker, standAt, stepWalker, STRIDE } from '../public/js/shared/nod/walker.js';
import { isNodKey, nodKey, nodWorld, NOD_KEYS } from '../public/js/shared/nod/worlds/index.js';
import { CHAPTERS, chapterOf, firstStage, STAGES } from '../public/js/shared/isle-story.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { WEAPONS } from '../public/js/shared/shop.js';
import { PublicAdventure } from '../server/adventure.js';

const FIRST = firstStage(6);
const DREAMS = CHAPTERS.filter((c) => c.nightmares);

// ---------------------------------------------------------------- shapes

const shapes = () => [
  new Body('ball', new Dot(v3(0, 0, 0)), 10, { bumps: [{ c: v3(0, 10, 0), r: 2, k: 3 }] }),
  new Body('ring', new Loop(v3(40, 0, 0), v3(0, 1, 0.3), 10), 4),
  new Body('coin', new Plate(v3(80, 0, 0), v3(0, 1, 0), 10), 1.5),
  new Body('tube', new Can(v3(0, 0, 60), v3(1, 0, 0), 9, 14), 1.2),
  new Body('band', new Band(v3(60, 0, 60), v3(0, 1, 0), 14, 3.5, 0.5), 0.9),
  new Body('log', new Chain([v3(0, 40, 0), v3(10, 44, 5), v3(22, 40, 0)]), 3),
  new Body('box', new Crate(v3(-40, 0, 0), v3(1, 0, 0), v3(0, 1, 0), 5, 0.5, 5), 2.2),
];

test('a body of any shape knows how far off everything is, and up is away from it', () => {
  for (const b of shapes()) {
    for (let i = 0; i < 200; i++) {
      const a = i * 2.399963;
      const y = 1 - ((i + 0.5) / 200) * 2;
      const r = Math.sqrt(1 - y * y);
      const s = b.spotNear(add(b.c, v3(Math.cos(a) * r, y, Math.sin(a) * r), b.reach * 0.9));
      assert.ok(Math.abs(b.ground(s.x, s.y, s.z)) < 0.12, `${b.key}: a spot is on the ground`);
      assert.ok(Math.abs(len(s.up) - 1) < 1e-6, `${b.key}: up is one long`);
      // A little way up is so far off; a little way down is inside.
      const over = add(s, s.up, 1);
      const under = add(s, s.up, -0.3);
      assert.ok(b.ground(over.x, over.y, over.z) > 0.5, `${b.key}: over it`);
      assert.ok(b.ground(under.x, under.y, under.z) < 0, `${b.key}: under it`);
      // And it is not far from what it says: nowhere nearer than that.
      const far = add(s, s.up, 3);
      assert.ok(dist3(far, s) >= b.ground(far.x, far.y, far.z) - 0.35, `${b.key}: never says further than it is`);
    }
  }
});

test('which way someone faces is one number over the wire, whichever way up they are', () => {
  for (let i = 0; i < 300; i++) {
    const up = unit(v3(Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9 + 1)));
    const h = flatUnit(v3(Math.cos(i * 3.1), Math.sin(i * 1.3), Math.cos(i * 0.7)), up);
    const back = headingOf(yawOf(h, up), up);
    assert.ok(dot(h, back) > 0.99999, `${i}`);
    assert.ok(Math.abs(dot(back, up)) < 1e-6);
  }
  // (On an island up is up, and it is the yaw it always was.)
  const h = headingOf(0.7, v3(0, 1, 0));
  assert.ok(Math.abs(h.x - Math.sin(0.7)) < 1e-9 && Math.abs(h.z - Math.cos(0.7)) < 1e-9);
});

test('a body is walked right round, whatever its shape, with no edge to fall off', () => {
  const bodies = shapes();
  const space = new Space(bodies);
  for (const b of bodies) {
    const w = standAt(makeWalker(0, 0, 0), b.spot(v3(0.3, b.reach, 0.2)));
    let dir = flatUnit(v3(1, 0, 0.4), w.up);
    let ground = 0;
    let turned = 1;
    const first = { ...w.up };
    for (let i = 0; i < 60 * 20; i++) {
      const was = w.up;
      stepWalker(space, w, { dir, run: true }, 1 / 60);
      dir = flatUnit(carry(dir, was, w.up), w.up);
      if (w.onGround) ground++;
      turned = Math.min(turned, dot(first, w.up));
      assert.equal(w.body, b, `${b.key}: still on it`);
      assert.ok(Math.abs(b.ground(w.x, w.y, w.z)) < 0.9, `${b.key}: on its ground`);
    }
    assert.ok(ground > 60 * 20 * 0.85, `${b.key}: on its feet nearly all the way (${ground})`);
    assert.ok(turned < -0.5, `${b.key}: and upside down on the way round`);
  }
});

test('a jump comes down again where you are, a roll goes faster than a run, and something in the way stops both', () => {
  const body = new Body('ball', new Dot(v3(0, 0, 0)), 12);
  body.addProp(new Post(v3(0, 11, 6), v3(0, 15, 8), 0.8));
  const space = new Space([body]);
  const w = standAt(makeWalker(0, 0, 0), body.spot(v3(0, 12, 0)));
  const at = { x: w.x, y: w.y, z: w.z };
  assert.equal(stepWalker(space, w, { jump: true }, 1 / 60).jumped, true);
  let high = 0;
  let landed = 0;
  for (let i = 0; i < 120 && !landed; i++) {
    landed = stepWalker(space, w, {}, 1 / 60).landed;
    high = Math.max(high, body.ground(w.x, w.y, w.z));
  }
  assert.ok(high > 1.4 && high < 2.6, `about as high as on an island (${high.toFixed(2)})`);
  assert.ok(landed > 4 && dist3(w, at) < 0.2, 'down again in the same place');
  // Running, and rolling.
  const go = (dash) => {
    standAt(w, body.spot(v3(0, 12, 0)));
    const from = { x: w.x, y: w.y, z: w.z };
    for (let i = 0; i < 24; i++) stepWalker(space, w, { dir: v3(1, 0, 0), run: true }, 1 / 60, null, dash ? { x: 1, y: 0, z: 0, speed: 11.5 } : null);
    return dist3(w, from);
  };
  assert.ok(go(true) > go(false) * 1.3);
  // Up against the post.
  standAt(w, body.spot(v3(0, 12, 0)));
  for (let i = 0; i < 240; i++) stepWalker(space, w, { dir: v3(0, 0, 1), run: true }, 1 / 60);
  assert.ok(body.clutter(w.x + w.up.x * 0.5, w.y + w.up.y * 0.5, w.z + w.up.z * 0.5) > 0.2, 'out of the post');
  assert.ok(STRIDE.run > STRIDE.walk);
});

test('near two bodies, you are on whichever you are nearer to, and not off it for a little', () => {
  const space = new Space([new Body('a', new Dot(v3(0, 0, 0)), 8), new Body('b', new Dot(v3(22, 0, 0)), 8)]);
  const [a, b] = space.bodies;
  assert.equal(space.bodyAt(9, 0, 0), a);
  assert.equal(space.bodyAt(13.5, 0, 0), b);
  assert.equal(space.bodyAt(11.3, 0, 0, a), a, 'kept to the one it was on');
  assert.equal(space.bodyAt(10.7, 0, 0, b), b);
  assert.equal(space.bodyAt(13.5, 0, 0, a), b, 'until the other is a good deal nearer');
});

test('a blow follows the ground it is aimed over, all the way to whoever it is for', () => {
  for (const b of shapes()) {
    const from = b.spot(v3(0.3, b.reach, 0.2));
    const to = b.walk(from, flatUnit(v3(0.4, 0, 1), from.up), 4.5, 0.5).at(-1);
    const path = aimedPath(b, from, to, 8);
    assert.ok(offPath(path, to) < 0.6, `${b.key}: it gets there`);
    for (const q of path) assert.ok(Math.abs(b.ground(q.x, q.y, q.z)) < 0.2, `${b.key}: along the ground`);
    assert.ok(dist3(laneAt(path, 0, 8), from) < 0.05 && dist3(laneAt(path, 8, 8), path.at(-1)) < 0.05);
  }
});

// ---------------------------------------------------------------- the dreams

// Someone (the real walker) going from a spot to a point as a player would: at
// it, hopping up ledges, jumping when stuck, and off another way for a moment when
// that gets them no nearer. Whether they got there.
function walkTo(space, from, to, near = 1.9, secs = 60) {
  const w = standAt(makeWalker(0, 0, 0), from);
  let seed = 7;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let way = 0;
  let until = 0;
  let stuck = 0;
  let best = Infinity;
  let since = 0;
  let on = flatUnit(sub(to, w), w.up);
  for (let t = 0; t < secs; t += 1 / 30) {
    const d = sub(to, w);
    const gap = len(d);
    if (gap < near) return true;
    if (gap < best - 0.5) {
      best = gap;
      since = t;
    }
    // (On the other side of something flat: straight on, over the edge of it.)
    let dir = flatUnit(to.up && dot(w.up, to.up) < -0.3 && len(sub(to, w)) < 14 ? on : d, w.up);
    if (t < until) dir = flatUnit(turn(dir, w.up, way), w.up);
    else if (t - since > 2.5 || stuck > 0.5) {
      way = (rnd() - 0.5) * 4.5;
      until = t + 0.7 + rnd() * 1.6;
      since = t;
      best = gap;
      stuck = 0;
    }
    const was = { x: w.x, y: w.y, z: w.z };
    const up = w.up;
    stepWalker(space, w, { dir, run: true, hop: true, jump: stuck > 0.2 && rnd() < 0.3 }, 1 / 30);
    on = carry(dir, up, w.up);
    stuck = dist3(w, was) < 0.06 ? stuck + 1 / 30 : 0;
  }
  return false;
}

// Whether a body touches another, to be walked (or jumped) on to from it.
function touches(a, b) {
  for (let i = 0; i < 400; i++) {
    const y = 1 - ((i + 0.5) / 400) * 2;
    const r = Math.sqrt(1 - y * y);
    const s = a.spotNear(add(a.c, v3(Math.cos(i * 2.4) * r, y, Math.sin(i * 2.4) * r), a.reach));
    if (b.ground(s.x, s.y, s.z) < 1) return true;
  }
  return false;
}

test('there is a dream for each chapter, made the same every time, of bodies and not of blocks', () => {
  assert.deepEqual(NOD_KEYS, DREAMS.map((c) => c.key));
  assert.ok(NOD_KEYS.every((k) => isNodKey(k)) && !isNodKey('shore') && !isNodKey('constructor'));
  for (const ch of DREAMS) assert.equal(nodKey(ch.theme), ch.key);
  for (const t of ['sunny', 'nod', 'nodshore', '', undefined, null]) assert.ok(!nodKey(t), String(t));
  for (const key of NOD_KEYS) assert.equal(nodWorld(key), nodWorld(key), 'made once');
  // Every one of them has bodies of shapes of its own: no two dreams the same.
  const kinds = NOD_KEYS.map((k) => nodWorld(k).space.bodies.map((b) => b.skel.constructor.name).sort().join());
  assert.equal(new Set(kinds).size, kinds.length);
  assert.ok(new Set(kinds.join().split(',')).size >= 6, 'balls, chains, rings, plates, crates, cans, bands');
});

for (const [i, ch] of DREAMS.entries()) {
  test(`${ch.name}: everything there is to do in it is got to, on foot and by spring`, () => {
    const w = nodWorld(ch.key);
    const { space } = w;
    const body = (k) => space.byKey.get(k);
    // Where everyone arrives: on the ground, with room, and no nightmare there.
    const home = space.bodyAt(w.start.x, w.start.y, w.start.z);
    const clear = (s, what) => {
      const b = space.bodyAt(s.x, s.y, s.z);
      assert.ok(Math.abs(b.ground(s.x, s.y, s.z)) < 0.2, `${what}: on the ground`);
      const c = add(s, s.up, 0.9);
      assert.ok(b.clutter(c.x, c.y, c.z) > 0.3, `${what}: room to stand`);
    };
    clear(w.start, 'the start');
    assert.ok(w.nightmares.every((n) => body(n.body) !== home) && body(w.boss.body) !== home, 'nothing to fight where everyone arrives');
    // Three nightmares, each on a body of its own, as the story has them.
    assert.equal(w.nightmares.length, ch.nightmares.length - 1);
    assert.deepEqual(w.nightmares.map((n) => n.id), [1, 2, 3]);
    assert.equal(new Set([...w.nightmares.map((n) => n.body), w.boss.body]).size, 4);
    for (const n of w.nightmares) {
      clear(n.at, ch.nightmares[n.id - 1].name);
      assert.ok(n.waves.length >= 3 && n.waves.every((wave) => wave.length && wave.every(([kind, k]) => FRIGHT_KINDS.includes(kind) && k >= 1 && k <= 8)), `${ch.key} ${n.id}: its waves`);
    }
    assert.ok(NOD_BOSSES[w.boss.kind] && frightOf(w.boss.kind).boss, 'its boss');
    assert.equal(NOD_BOSSES[w.boss.kind].name, ch.nightmares.at(-1).name);
    // Springs: each flings you from the ground of one body on to that of another,
    // the right way up at both ends, and through nothing on the way.
    for (const s of w.springs) {
      const to = body(s.to.body);
      assert.notEqual(s.from.body, s.to.body, `${ch.key} spring ${s.id}`);
      assert.ok(Math.abs(to.ground(s.to.x, s.to.y, s.to.z)) < 0.25, `${ch.key} spring ${s.id}: lands on the ground`);
      assert.ok(to.clutter(s.to.x + s.to.up.x * 0.9, s.to.y + s.to.up.y * 0.9, s.to.z + s.to.up.z * 0.9) > 0.25, `${ch.key} spring ${s.id}: with room`);
      const a = flightAt(s, 0);
      const z = flightAt(s, 1);
      assert.ok(dist3(a, s.from) < 0.01 && dist3(z, s.to) < 0.01 && dot(a.up, s.from.up) > 0.999 && dot(z.up, s.to.up) > 0.999, `${ch.key} spring ${s.id}`);
      for (let k = 0.12; k < 0.9; k += 0.04) {
        const q = flightAt(s, k);
        assert.ok(space.dist(q.x, q.y, q.z, 4) > 0.1, `${ch.key} spring ${s.id}: clear of everything on the way (${k.toFixed(2)})`);
      }
    }
    // From the start, springs are walked to, and flung by; all but the golden one
    // from the beginning.
    const got = (boss) => {
      const seen = new Map([[home.key, w.start]]);
      const todo = [home.key];
      while (todo.length) {
        const key = todo.pop();
        for (const s of w.springs) {
          if (s.from.body !== key || seen.has(s.to.body) || (s.need === 'boss' && !boss)) continue;
          const at = seen.get(key);
          const spot = body(key).spotNear(at);
          assert.ok(walkTo(space, spot, s.from), `${ch.key}: spring ${s.id} walked to on ${key}`);
          seen.set(s.to.body, s.to);
          todo.push(s.to.body);
        }
      }
      return seen;
    };
    const before = got(false);
    for (const n of w.nightmares) {
      assert.ok(before.has(n.body), `${ch.key}: ${n.body} reached`);
      assert.ok(walkTo(space, body(n.body).spotNear(before.get(n.body)), n.at, 3), `${ch.key}: its nightmare walked to on ${n.body}`);
    }
    assert.ok(!before.has(w.boss.body), 'the boss only once the golden spring is awake');
    const after = got(true);
    // (Anywhere at all: what nothing stands on or leads to is only to look at.)
    const led = new Set(w.springs.map((s) => s.to.body));
    assert.deepEqual([...after.keys()].sort(), space.bodies.map((b) => b.key).filter((k) => k === home.key || led.has(k)).sort(), 'and then everywhere');
    const on = new Set(after.keys());
    for (let more = true; more; ) {
      more = false;
      for (const o of space.bodies) {
        if (on.has(o.key) || ![...on].some((k) => touches(o, body(k)) || touches(body(k), o))) continue;
        on.add(o.key);
        more = true;
      }
    }
    for (const d of [...w.roam.map((r) => r.body), ...w.winks.map((q) => space.bodyAt(q.x, q.y, q.z).key)]) assert.ok(on.has(d), `${ch.key}: ${d} is got to`);
    // Back again from every one of them but the boss's.
    for (const s of w.springs) if (!s.need) assert.ok(w.springs.some((o) => o.from.body === s.to.body && o.to.body === s.from.body), `${ch.key}: back from ${s.to.body}`);
    // Forty winks, each within a jump of the ground, on bodies of the dream's.
    assert.equal(w.winks.length, 40, `${ch.key}: forty winks`);
    for (const [k, q] of w.winks.entries()) {
      const b = space.bodyAt(q.x, q.y, q.z);
      const high = b.ground(q.x, q.y, q.z);
      assert.ok(high > 0.1 && high < 2.4, `${ch.key}: wink ${k} within reach (${high.toFixed(2)})`);
      assert.ok(b.key !== w.boss.body, `${ch.key}: wink ${k} not on the boss's`);
    }
    // Lamps round the night-light, one for each nightmare and one for the boss.
    assert.deepEqual(w.dress.filter((d) => d.kind === 'lamp').map((d) => d.lamp).sort(), [1, 2, 3, 4]);
    assert.equal(w.dress.filter((d) => d.kind === 'nightlight').length, 1);
    assert.ok(chapterOf(FIRST + i).key === ch.key);
  });
}

// ---------------------------------------------------------------- the frights

const ballOf = (r = 14) => {
  const body = new Body('ball', new Dot(v3(0, 0, 0)), r);
  return { body, space: new Space([body]) };
};
// One of a kind on a ball, and someone some way off it.
function arena(kind, { far = 4, level = 14, seed = 3, r = 14 } = {}) {
  const { body, space } = ballOf(r);
  const sim = new Frights(space, { level, seed });
  const s = body.spot(v3(0, r, 0));
  const f = sim.add(kind, { ...s, body, dir: v3(0, 0, 1) });
  const q = body.walk(s, v3(0, 0, 1), far, 0.5).at(-1);
  const me = { id: 1, x: q.x, y: q.y, z: q.z, body, dizzy: false };
  let now = 1000;
  const go = (ms, each = () => {}) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50;
      sim.step(0.05, now, [me]);
      if (each(sim.take('acts'), now) === false) break;
    }
    return now;
  };
  return { sim, f, me, body, go, now: () => now };
}

test('a bop on a guard only clangs, whatever is in your hand and however often', () => {
  for (const [kind, spec] of Object.entries(FRIGHTS)) {
    if (spec.guard === 'none' || spec.part || spec.boss || spec.burrows) continue;
    const { sim, f, me, now, go } = arena(kind);
    go(1200);
    if (f.open || f.state === 'rest') continue;
    for (let i = 0; i < 60; i++) {
      const hit = sim.hit(f, 1, me, now() + i * (BOP_MS + 10), mightOf(999));
      assert.ok(hit.clang || hit.wait, `${kind}: clang`);
    }
    assert.equal(f.hearts, f.max, `${kind}: not a heart off it`);
  }
});

test('open, it loses one heart at most, and the mightiest weapon is hardly quicker than a bare hand', () => {
  const bops = (power) => {
    const { sim, f, me, go, now } = arena('thimble', { seed: 5 });
    go(1200);
    assert.ok(sim.opens(f, 'flip', now()));
    const was = f.hearts;
    let n = 0;
    let t = now();
    while (f.hearts === was) {
      t += BOP_MS + 1;
      n++;
      assert.ok(!sim.hit(f, 1, me, t, mightOf(power)).clang);
    }
    assert.equal(f.hearts, was - 1);
    assert.equal(f.open, null, 'its guard is up again');
    assert.ok(sim.hit(f, 1, me, t + BOP_MS + 1, mightOf(power)).clang, 'and no second heart in the same opening');
    return n;
  };
  const strongest = Math.max(...WEAPONS.map((w) => w.power));
  assert.equal(bops(1), CHIPS);
  assert.ok(bops(strongest) >= 2, 'the mightiest weapon there is takes two');
  assert.ok(mightOf(strongest) <= 2 && mightOf(1) === 1);
  // Nobody bops quicker than they can.
  const { sim, f, me, go, now } = arena('thimble');
  go(1200);
  sim.opens(f, 'flip', now());
  assert.ok(!sim.hit(f, 1, me, now(), 1).wait);
  assert.ok(sim.hit(f, 1, me, now() + 60, 1).wait, 'too soon after the last');
  assert.ok(!sim.hit(f, 2, me, now() + 60, 1).wait, 'though a friend may');
});

test('every fright with a guard has a way in, and shows each blow before it lands', () => {
  for (const [kind, spec] of Object.entries(FRIGHTS)) {
    if (spec.guard === 'none' || spec.boss || spec.part || spec.big) continue;
    const ways = new Set();
    for (const far of [2.5, 5, 9]) {
      const { sim, f, me, go } = arena(kind, { far, seed: 11 + far });
      if (spec.slam) {
        go(1500);
        me.x = f.x;
        me.y = f.y;
        me.z = f.z;
        for (const got of sim.slam(me, 3000)) if (got.flip) ways.add('slam');
        continue;
      }
      go(30000, (acts, now) => {
        for (const a of acts) {
          assert.ok(a.ms >= 250, `${kind}: ${a.k} told in good time (${a.ms})`);
          assert.ok(Array.isArray(a.p) && a.p.every(Number.isFinite), `${kind}: ${a.k} says where`);
          const act = sim.acts.get(a.a);
          if (a.flash) act.flashes = true;
          if (a.back) act.back = true;
        }
        if (f.open) {
          ways.add(f.open);
          return false;
        }
        const act = f.act;
        if (act && now >= act.strike) {
          if (act.mv.flash && sim.parried(act, now)) ways.add('parry');
          else if (act.mv.back && sim.returned(act, now)) ways.add('back');
          else if (sim.dodged(act, now)) ways.add('trip');
        }
        return true;
      });
    }
    assert.ok(ways.size >= 1, `${kind}: no way in`);
    for (const w of ways) assert.ok(w in OPENINGS || ['slam', 'back'].includes(w), `${kind}: ${w}`);
    assert.ok(spec.told.length > 30, `${kind}: what to do about it is told`);
    assert.ok(spec.icon && spec.name && spec.hearts >= 1 && spec.radius > 0.2 && spec.height > 0.3, kind);
  }
});

test('a fright aims at where you are off to as often as at where you are', () => {
  const { sim, me, body } = arena('moth', { far: 7, level: 18 });
  const dir = { d: flatUnit(v3(1, 0, 0), body.up(me.x, me.y, me.z)) };
  let now = 1000;
  // Standing still, it is always where they are.
  for (let i = 0; i < 20; i++) sim.step(0.05, (now += 50), [me]);
  for (let i = 0; i < 30; i++) assert.ok(dist3(sim.lead(me, 1500), me) < 0.01);
  // Walking on and on the same way, it is there, or ahead of them.
  for (let i = 0; i < 40; i++) {
    const q = body.land(add(me, dir.d, 0.2));
    const up = body.up(q.x, q.y, q.z);
    dir.d = flatUnit(carry(dir.d, body.up(me.x, me.y, me.z), up), up);
    Object.assign(me, { x: q.x, y: q.y, z: q.z });
    sim.step(0.05, (now += 50), [me]);
  }
  const ahead = Array.from({ length: 200 }, () => dot(sub(sim.lead(me, 1000), me), dir.d));
  const some = (lo, hi) => ahead.filter((a) => a >= lo && a < hi).length;
  assert.ok(some(-0.01, 0.1) > 30 && some(1.5, 3) > 30 && some(3, 5) > 40, `${some(-0.01, 0.1)} ${some(1.5, 3)} ${some(3, 5)}`);
  assert.ok(Math.max(...Array.from({ length: 60 }, () => dist3(sim.lead(me, 9000), me))) < 6.5, 'never far ahead');
  // (Less so in the first dream.)
  assert.ok(sim.leads > 0.9 && new Frights(new Space([body]), { level: 14 }).leads < 0.5);
});

test('no more than a few frights go for one at once, and a moment apart', () => {
  for (const level of [14, 18]) {
    const { body, space } = ballOf(16);
    const sim = new Frights(space, { level, seed: 4 });
    const top = body.spot(v3(0, 16, 0));
    for (let i = 0; i < 9; i++) {
      const q = body.walk(top, turn(v3(0, 0, 1), top.up, (i / 9) * Math.PI * 2), 4, 0.5).at(-1);
      sim.add(['thimble', 'ram', 'bunny'][i % 3], { ...q, body });
    }
    const me = { id: 1, x: top.x, y: top.y, z: top.z, body, dizzy: false };
    let now = 1000;
    let last = -Infinity;
    let total = 0;
    for (let t = 0; t < 30000; t += 50) {
      now += 50;
      sim.step(0.05, now, [me]);
      for (const a of sim.take('acts')) {
        void a;
        total++;
        assert.ok(now - last >= 250, 'a moment apart');
        last = now;
      }
      const busy = sim.list.filter((f) => f.act && !f.act.over && now < f.act.ends).length;
      assert.ok(busy <= (level < 17 ? 2 : 3), `${busy} at once`);
    }
    assert.ok(total > 12, `but they do go for one (${total})`);
  }
});

test('what goes over the wire of one is read back the same', () => {
  const { sim, f } = arena('ram');
  f.alt = 1.25;
  sim.opens(f, 'bonk', 1000);
  f.more = () => [1, 0];
  const [row] = sim.pack();
  const back = readFright(JSON.parse(JSON.stringify(row)));
  assert.deepEqual([back.id, back.kind, back.hearts, back.max, back.open, back.alt, back.more], [f.id, 'ram', f.hearts, f.max, 'bonk', 1.25, [1, 0]]);
  assert.ok(dist3(back, f) < 0.02 && dot(back.h, f.h) > 0.99);
  for (const junk of [null, 'x', [], [1, 2], [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 'x']]) assert.equal(readFright(junk), null);
  assert.equal(new Set(FRIGHT_KINDS).size, FRIGHT_KINDS.length);
});

// ---------------------------------------------------------------- the bosses

// A dream with only its boss left, and someone on its world.
function bossOf(key, { seed = 5, level = 16 } = {}) {
  const dream = new Dream({ key, story: DREAMS.find((c) => c.key === key), level, done: [1, 2, 3] }, seed);
  const { body, at } = dream.boss;
  const q = body.walk(at, at.dir, 6, 0.5).at(-1);
  const me = { id: 1, x: q.x, y: q.y, z: q.z, dizzy: false };
  const t = { now: 1000 };
  const put = (p) => Object.assign(me, { x: p.x, y: p.y, z: p.z });
  const go = (ms, each = () => {}) => {
    for (let s = 0; s < ms; s += 50) {
      t.now += 50;
      const out = dream.step(0.05, t.now, [{ ...me }]);
      if (each(out, t.now) === false) return true;
    }
    return false;
  };
  const fright = () => dream.frights.get(dream.boss.fright);
  return { dream, me, put, go, t, fright, body };
}

// Bops whatever is open till its heart is off.
function bopIt(b, f, now) {
  return b.dream.bop({ id: 1, x: f.x, y: f.y, z: f.z }, [f.id], now, 1);
}

test('Rambunctious: all wool, till a bedpost stops him', () => {
  const b = bossOf('pillow', { level: 14 });
  b.go(5000);
  const f = b.fright();
  assert.ok(f && f.kind === 'rambunctious');
  // Bopped head on: clang.
  assert.ok(bopIt(b, f, b.t.now)[0].clang);
  // Behind a bedpost from wherever he is, all the time: sooner or later, bonk.
  const posts = b.dream.world.dress.filter((d) => d.kind === 'post');
  let bonks = 0;
  b.go(120000, (out, now) => {
    const post = posts.reduce((p, d) => (dist3(d, f) < dist3(p, f) ? d : p));
    const s = b.body.spotNear(post);
    const away = flatUnit(sub(s, f), s.up);
    b.put(b.body.walk(s, away, 2.6, 0.5).at(-1));
    if (out.fx.some((x) => x.k === 'bonk')) bonks++;
    if (f.open) {
      bopIt(b, f, now);
      return !b.dream.won;
    }
    return bonks < 1 || !b.dream.won;
  });
  assert.ok(bonks >= 1, 'bonk!');
  assert.ok(f.hearts < f.max, 'and hearts off him');
});

test('Old Munch: studs all along him, but a bare tail', () => {
  const b = bossOf('garden', { level: 15 });
  b.go(6000);
  const head = b.fright();
  assert.equal(head.kind, 'munch');
  const segs = () => b.dream.frights.list.filter((f) => f.kind === 'munchseg');
  const n = segs().length;
  assert.ok(n >= 4);
  assert.ok(bopIt(b, head, b.t.now)[0].clang, 'not his face');
  let gone = 0;
  b.go(90000, (out, now) => {
    const soft = segs().find((f) => f.soft === true);
    if (soft) bopIt(b, soft, now);
    gone = n - segs().length;
    return gone < 2;
  });
  assert.ok(gone >= 2, `joints off him, one at a time (${gone})`);
});

test('Maestro Crescendo: his tune shown, then played in the same order, and his notes sent back', () => {
  const b = bossOf('music');
  let tune = null;
  let parts = [];
  let open = 0;
  const waiting = [];
  b.go(60000, (out, now) => {
    for (const x of out.fx) {
      if (x.k === 'tune') {
        if (tune) assert.ok(parts.length <= tune.length);
        tune = x.seq;
        parts = [];
      }
      if (x.k === 'part') parts.push(x.i);
    }
    for (const a of out.acts) {
      const f = b.fright();
      if (a.f !== f.id) continue;
      const act = b.dream.frights.acts.get(a.a);
      const want = { ring: 'wave', note: 'shot', crash: 'spots' };
      if (['wave', 'shot', 'spots'].includes(a.k) && tune) assert.equal(a.k, want[tune[parts.length - 1]] ?? a.k, 'as it was shown');
      if (a.back) waiting.push(act);
    }
    for (const act of waiting.splice(0)) if (b.dream.frights.returned(act, now)) open++;
    const f = b.fright();
    if (f?.open) {
      assert.ok(!bopIt(b, f, now)[0]?.clang);
      return f.hearts === f.max;
    }
    return true;
  });
  assert.ok(open >= 2, 'two notes sent back, at least');
  assert.ok(b.fright().hearts < b.fright().max, 'and a heart off him');
});

test('Old Tock: nothing hurts him in front, and his key stops only once he has struck the hour', () => {
  const b = bossOf('clock', { level: 17 });
  b.go(6000);
  const f = b.fright();
  const key = b.dream.frights.list.find((o) => o.kind === 'tockkey');
  assert.ok(f.kind === 'tock' && key);
  assert.ok(dot(f.up, key.up) < -0.9, 'round the other side of the dial');
  assert.ok(bopIt(b, f, b.t.now)[0].clang && bopIt(b, key, b.t.now)[0].clang);
  let hour = false;
  b.go(60000, (out, now) => {
    if (out.fx.some((x) => x.k === 'hour')) hour = true;
    if (key.soft) {
      assert.ok(hour, 'after the hour');
      b.put(key);
      bopIt(b, key, now);
      return key.hearts === key.max;
    }
    return true;
  });
  assert.ok(key.hearts < key.max && f.hearts === key.hearts, 'a heart off the one is a heart off the other');
  assert.equal(key.soft, false, 'and it is wound up again');
});

test('the Night Mare: turned as she flashes; then three of her; then dark, but for three lanterns', () => {
  const b = bossOf('mare', { level: 18 });
  b.go(5000);
  const f = b.fright();
  assert.equal(f.kind, 'mare');
  const seen = { split: false, dark: false, lamps: 0, phases: [] };
  const turnIt = (now) => {
    const act = f.act;
    if (act && now >= act.strike && act.mv.flash) b.dream.frights.parried(act, now);
  };
  const watchFx = (out) => {
    for (const x of out.fx) {
      if (x.k === 'split') seen.split = true;
      if (x.k === 'dark' && x.on) seen.dark = true;
      if (x.k === 'lantern' && x.on) seen.lamps++;
      if (x.k === 'phase') seen.phases.push(x.n);
    }
  };
  b.go(240000, (out, now) => {
    watchFx(out);
    turnIt(now);
    if (f.open) bopIt(b, f, now);
    return !f.dark;
  });
  b.go(100, watchFx);
  assert.deepEqual(seen.phases, [1, 2], 'first three of her, then the dark');
  assert.ok(seen.split && seen.dark && f.dark);
  assert.ok(b.dream.frights.list.every((o) => o.id === f.id || !o.shadow), 'her shadows gone');
  // Slammed down by each of the lanterns: lit, and with all three she is dazzled.
  for (const l of f.lights) {
    b.put(l);
    b.dream.slammed({ id: 1, x: l.x, y: l.y, z: l.z }, b.t.now);
    b.go(300, watchFx);
  }
  assert.equal(seen.lamps, 3);
  assert.ok(f.open === 'stun' && !f.dark, 'dazzled');
  // And so to the end of her.
  b.go(240000, (out, now) => {
    turnIt(now);
    if (f.open) bopIt(b, f, now);
    return !b.dream.won;
  });
  assert.equal(b.dream.won, true);
});

// ---------------------------------------------------------------- on the real room

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  c.fx = (k) => c.inbox.filter((m) => m.t === 'nx' && m.k === k);
  return c;
}

function join(room, name = 'Brave Fox', look = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', ...look }, tickets: [2, 3, 4, 5, 6] });
  c.pid = c.last('welcome')?.you;
  return c;
}

const dreamRoom = (stage, time, seed = 9) => new Room({ code: '717171', adventure: true, shared: true, stage, seed, theme: chapterOf(stage).theme, now: () => time.t });

function stay(room, time, c, at, ms = 300, each = null) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [at.x, at.y, at.z, 0, 0, 0] });
    room.tick();
    if (each?.() === false) return true;
  }
  return false;
}

// Someone on a body, popping whatever comes out of a nightmare there, as if every
// blow of theirs were rolled clear of.
function popAll(room, time, c, at, ms, until) {
  const { dream } = room.adventure;
  return stay(room, time, c, at, ms, () => {
    for (const f of [...dream.frights.list]) {
      if (!f.camp.startsWith('n')) continue;
      if (f.spec.guard !== 'none' && !f.open) dream.frights.opens(f, 'stun', time.t);
      room.receive(c, { t: 'm', s: [f.x, f.y, f.z, 0, 0, 0] });
      room.receive(c, { t: 'nod', op: 'bop', ids: [f.id] });
    }
    return until() ? false : undefined;
  });
}

test('a stage of the sixth episode is a dream: an empty box of air, and everything there is in it told as you arrive', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  assert.ok(room.adventure.dream);
  assert.equal(room.adventure.active, true);
  assert.deepEqual([room.world.W, room.world.H, room.world.D, room.world.theme], [16, 16, 16, 'nodpillow']);
  let solid = 0;
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) if (room.world.get(x, y, z)) solid++;
  assert.equal(solid, 0, 'not one block');
  const a = join(room);
  const adv = a.last('welcome').adventure;
  assert.equal(adv.nod.key, 'pillow');
  assert.equal(adv.nod.n.length, 4);
  assert.deepEqual(adv.nod.winks, []);
  assert.deepEqual(room.adventure.tally(), { camps: 4, freed: 0, won: false, stage: FIRST, nod: true });
  // Anywhere in its sky is somewhere to be; nowhere beyond it.
  const far = room.adventure.dream.space.reach + 60;
  room.receive(a, { t: 'm', s: [-40.5, 60.25, 33, 1, 0, 0] });
  assert.deepEqual(room.players.get(a.pid).s.slice(0, 3), [-40.5, 60.25, 33]);
  room.receive(a, { t: 'm', s: [1e6, 0, 0, 1, 0, 0] });
  assert.ok(room.players.get(a.pid).s[0] <= room.adventure.dream.space.c.x + far + 0.01);
});

test('a nightmare wakes as you come, comes at you in waves, and lights its lamp; left alone it goes quiet', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  const a = join(room);
  const { dream } = room.adventure;
  const n = dream.list[0];
  const home = dream.world.start;
  stay(room, time, a, home, 3000);
  assert.equal(n.state, 'idle');
  stay(room, time, a, n.at, 1800);
  assert.equal(n.state, 'on');
  assert.equal(a.fx('wake').length, 1);
  assert.equal(dream.shut(n.body.key), true, 'its springs are shut');
  stay(room, time, a, n.at, 3000);
  assert.ok(dream.frights.of('n1').length >= 3, 'the first wave');
  assert.ok(a.last('nf').f.length >= 3, 'told of');
  // Off and away: after a while it is all quiet again.
  stay(room, time, a, home, 9000);
  assert.equal(n.state, 'idle');
  assert.equal(dream.frights.of('n1').length, 0);
  assert.equal(a.fx('quiet').length, 1);
  // Back, and every wave of it popped.
  assert.ok(popAll(room, time, a, n.at, 60000, () => n.done));
  assert.deepEqual(a.fx('wave').filter((m) => m.n === 1).map((m) => m.w).slice(-3), [1, 2, 3]);
  const over = a.last('nightmare');
  assert.deepEqual([over.id, over.by, over.won], [1, [a.pid], undefined]);
  assert.equal(room.adventure.tally().freed, 1);
  assert.equal(dream.shut(n.body.key), false);
  stay(room, time, a, n.at, 4000);
  assert.equal(n.state, 'done', 'for good');
});

test('the boss only once every nightmare is over; beaten, the stage is won, with everyone’s results', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  const a = join(room);
  const c = join(room, 'Quick Otter');
  const { dream } = room.adventure;
  const b = dream.boss;
  stay(room, time, a, b.at, 5000);
  assert.equal(b.state, 'idle', 'not yet');
  for (const n of dream.list) Object.assign(n, { done: true, state: 'done' });
  stay(room, time, a, b.at, 5000);
  assert.equal(b.state, 'on');
  assert.equal(a.fx('boss').length, 1);
  const f = dream.frights.get(b.fright);
  assert.deepEqual(a.last('adv').k, [f.hearts, f.max]);
  // (Left, he is gone, and comes again with all his hearts.)
  for (let i = 0; i < 400 && !room.adventure.won; i++) {
    if (!f.open) dream.frights.opens(f, 'bonk', time.t);
    f.immune = 0;
    time.t += 300;
    room.receive(a, { t: 'm', s: [f.x, f.y, f.z, 0, 0, 0] });
    room.receive(a, { t: 'nod', op: 'bop', ids: [f.id] });
    room.tick();
  }
  assert.equal(room.adventure.won, true);
  const won = c.last('won');
  assert.equal(won.hero, a.pid);
  assert.deepEqual(won.by.sort(), [a.pid, c.pid].sort());
  const mine = won.board.find((r) => r.id === a.pid);
  assert.ok(mine.boss > 0 && mine.place === 1 && mine.coins > 0);
  assert.equal(a.last('nightmare').won, true);
  assert.equal(room.adventure.active, false);
  const left = dream.frights.list.length;
  assert.equal(left, 0, 'nobody left to fight');
});

test('a blow takes HP once, in a fair moment after another; out of HP, you come round where you were last safe', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  const a = join(room);
  const p = room.players.get(a.pid);
  const { dream } = room.adventure;
  stay(room, time, a, dream.world.start, 1500);
  const safe = dream.homeFor(a.pid);
  assert.ok(dist3(safe, dream.world.start) < 0.5);
  const body = dream.space.byKey.get('button');
  const s = body.spot(v3(0, 8, 0));
  const f = dream.frights.add('moth', { ...s, body }, { camp: 'x' });
  stay(room, time, a, s, 1500);
  const act = dream.frights.launch(f, { k: 'burst', windup: 400, r: 3, b: 1 }, { ...s, id: a.pid, body }, time.t);
  stay(room, time, a, s, 600);
  const was = p.hp;
  room.receive(a, { t: 'nod', op: 'hurt', a: act.id });
  assert.ok(p.hp < was, 'it took HP');
  const bump = a.last('bump');
  assert.deepEqual([bump.pid, bump.nod, bump.a], [a.pid, f.id, act.id]);
  const now = p.hp;
  room.receive(a, { t: 'nod', op: 'hurt', a: act.id });
  assert.equal(p.hp, now, 'once');
  room.receive(a, { t: 'nod', op: 'hurt', a: 99999 });
  assert.equal(p.hp, now, 'and no blow there was none of');
  // Blow upon blow, till there is none left.
  for (let i = 0; i < 40 && !(p.dizzyUntil > time.t) && p.hp > 0 && !a.last('bump').dizzy && !a.last('bump').home; i++) {
    const k = dream.frights.launch(f, { k: 'burst', windup: 300, r: 3, b: 2 }, { ...s, id: a.pid, body }, time.t);
    stay(room, time, a, s, 2600);
    room.receive(a, { t: 'nod', op: 'hurt', a: k.id });
  }
  const end = a.last('bump');
  assert.ok(end.dizzy || end.home, 'out of HP');
  for (let t = 0; t < 40000 && p.dizzyUntil; t += 500) {
    time.t += 500;
    room.tick();
  }
  assert.ok(p.hp > 0);
  assert.ok(dist3(v3(...p.s), dream.homeFor(a.pid)) < 8, 'where they were last safe');
});

test('rolled clear of, bopped back, slammed, and a Brave Burst: what each does, and friends see it', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  const a = join(room);
  const c = join(room, 'Quick Otter');
  const { dream } = room.adventure;
  const body = dream.space.byKey.get('button');
  const s = body.spot(v3(0, 8, 0));
  stay(room, time, a, s, 300);
  stay(room, time, c, body.walk(s, flatUnit(v3(1, 0, 0), s.up), 3, 0.5).at(-1), 300);
  const addOne = (kind, far = 2) => {
    const q = body.walk(s, flatUnit(v3(0, 0, 1), s.up), far, 0.5).at(-1);
    const f = dream.frights.add(kind, { ...q, body }, { camp: 'x' });
    f.born = time.t - 5000;
    f.state = 'idle';
    f.cool = time.t + 60000;
    return f;
  };
  const blow = (f, mv) => {
    const act = dream.frights.start(f, { rest: 0, every: 0, ...mv }, { id: a.pid, ...s, body }, dream.frights.toward(f, s), time.t);
    return act;
  };
  // A roll, as it lands: it trips.
  const ram = addOne('ram');
  const charge = blow(ram, { k: 'lunge', windup: 300, len: 4, speed: 8, w: 0.6, b: 1 });
  stay(room, time, a, s, 300);
  room.receive(a, { t: 'nod', op: 'roll', y: 0.5 });
  room.receive(a, { t: 'nod', op: 'dodge', a: charge.id });
  assert.equal(ram.open, 'trip');
  assert.equal(c.fx('roll').length, 1, 'a friend sees the roll');
  assert.equal(a.fx('roll').length, 0);
  // A bop as it flashes.
  const ram2 = addOne('ram', 3);
  const flash = blow(ram2, { k: 'charge', windup: 300, len: 6, speed: 8, w: 0.6, b: 1, flash: true });
  stay(room, time, a, s, 300);
  room.receive(a, { t: 'nod', op: 'parry', a: flash.id });
  assert.equal(ram2.open, 'parry');
  // (Not one that does not flash.)
  const ram3 = addOne('ram', 4);
  const plain = blow(ram3, { k: 'charge', windup: 300, len: 6, speed: 8, w: 0.6, b: 1 });
  stay(room, time, a, s, 300);
  room.receive(a, { t: 'nod', op: 'parry', a: plain.id });
  assert.equal(ram3.open, null);
  // What it threw, sent back.
  const moth = addOne('moth', 5);
  const shot = blow(moth, { k: 'shot', windup: 300, n: 1, speed: 6, len: 12, r: 0.4, b: 1, back: true });
  stay(room, time, a, s, 500);
  room.receive(a, { t: 'nod', op: 'back', a: shot.id, i: 0 });
  assert.equal(moth.open, 'fall');
  assert.equal(c.fx('back').length, 1);
  // Down out of the air beside a thimble: over it goes.
  const thimble = addOne('thimble', 1.5);
  room.receive(a, { t: 'nod', op: 'slam' });
  assert.equal(thimble.open, 'flip');
  assert.equal(c.fx('slam').length, 1);
  // A Brave Burst: everything near is stunned, what has no guard is gone — and no
  // sooner again.
  const bunny = addOne('bunny', 3);
  const far = dream.frights.add('thimble', { ...dream.space.byKey.get('moon').spot(v3(0, 12, 0)), body: dream.space.byKey.get('moon') }, { camp: 'x' });
  const thimble2 = addOne('thimble', 4);
  const q = room.players.get(c.pid);
  q.hp = 20;
  room.receive(a, { t: 'nod', op: 'burst' });
  assert.equal(thimble2.open, 'stun');
  assert.equal(dream.frights.get(bunny.id), null, 'popped');
  assert.equal(far.open, null, `only within ${BURST_R}`);
  assert.ok(q.hp > 20, 'a friend near feels braver for it');
  const thimble3 = addOne('thimble', 4);
  room.receive(a, { t: 'nod', op: 'burst' });
  assert.equal(thimble3.open, null, 'not again so soon');
});

test('a wink is found by whoever is at it, once, and is nobody’s from afar', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  const a = join(room);
  const { dream } = room.adventure;
  const w = dream.world.winks[7];
  stay(room, time, a, dream.world.winks[30], 200);
  room.receive(a, { t: 'nod', op: 'wink', i: 7 });
  assert.equal(dream.winks.size, 0);
  stay(room, time, a, w, 200);
  for (const i of [7, 7, -1, 99, 'x', null]) room.receive(a, { t: 'nod', op: 'wink', i });
  assert.deepEqual([...dream.winks], [7]);
  assert.deepEqual(a.fx('wink').map((m) => [m.i, m.n, m.of]), [[7, 1, 40]]);
  const b = join(room, 'Quick Otter');
  assert.deepEqual(b.last('welcome').adventure.nod.winks, [7], 'and whoever comes later knows');
});

test('nonsense about a dream is shrugged off, and nothing of it works anywhere else', () => {
  const time = { t: 1_000_000 };
  const room = dreamRoom(FIRST, time);
  const a = join(room);
  for (const msg of [{}, { op: 1 }, { op: 'bop' }, { op: 'bop', ids: 'x' }, { op: 'bop', ids: [1.5, null] }, { op: 'bop', ids: [1, 2, 3] }, { op: 'hurt', a: 'x' }, { op: 'back', a: 4, i: {} }, { op: 'fling', s: 'x' }, { op: 'roll', y: 'x' }, { op: 'nope' }]) room.receive(a, { t: 'nod', ...msg });
  room.tick();
  const shore = new Room({ code: '717172', adventure: true, shared: true, stage: 1, seed: 9, now: () => time.t });
  const b = join(shore);
  for (const op of ['bop', 'hurt', 'dodge', 'burst', 'slam', 'wink']) shore.receive(b, { t: 'nod', op, ids: [1], a: 1, i: 1 });
  assert.equal(b.inbox.some((m) => m.t === 'nx'), false);
});

test('the nightmares over and the winks found are kept over a restart, and the boss is there to be beaten again', () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'nod-'));
  const file = joinPath(dir, 'isle.json');
  const time = { t: 1_000_000 };
  const make = () => new PublicAdventure({ rooms: new Map(), file, now: () => time.t, log: () => {} }).start();
  try {
    const one = make();
    const { code } = one.newRun('Brave Fox', time.t, 6);
    const run = one.runs.find((r) => r.entry.code === code);
    assert.equal(run.stage, FIRST);
    const { dream } = run.entry.room.adventure;
    Object.assign(dream.list[1], { done: true, state: 'done' });
    dream.winks.add(3);
    dream.winks.add(39);
    one.tick(time.t);
    assert.equal(one.adminList().find((g) => g.id === run.id).nod, true);
    const again = make();
    const kept = again.runs.find((r) => r.id === run.id).entry.room.adventure.dream;
    assert.deepEqual(kept.list.map((n) => n.done), [false, true, false]);
    assert.deepEqual([...kept.winks].sort((x, y) => x - y), [3, 39]);
    assert.equal(kept.boss.done, false);
    // (Even had it stopped in the very moment between the boss’s end and the next stage.)
    kept.restore([1, 2, 3, 4], false);
    assert.deepEqual([kept.bossReady, kept.boss.done, kept.won], [true, false, false]);
    kept.restore([4]);
    assert.equal(kept.won, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the story goes on into the dreams, and from the last of them a new journey begins', () => {
  assert.equal(STAGES, FIRST + 4);
  const time = { t: 1_000_000 };
  const one = new PublicAdventure({ rooms: new Map(), now: () => time.t, log: () => {} }).start();
  const { code } = one.newRun('Brave Fox', time.t, 5);
  const run = one.runs.find((r) => r.entry.code === code);
  while (run.stage < FIRST) {
    run.entry.room.adventure.win(run.entry.room.monsters);
    time.t += 1000;
    one.tick(time.t);
  }
  assert.ok(run.entry.room.adventure.dream, 'out of Toon Isle, into the first dream');
  for (let i = 0; i < 5; i++) {
    const room = run.entry.room;
    assert.equal(room.adventure.dream.key, DREAMS[i].key);
    room.adventure.win(room.monsters);
    time.t += 1000;
    one.tick(time.t);
  }
  assert.deepEqual([run.stage, run.journey], [1, 2]);
});
