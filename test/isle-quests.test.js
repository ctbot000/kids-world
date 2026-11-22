// Adventure Isle's fourth episode, "The Golden Bells" (shared/isle-story.js):
// told in Jinx the Magpie's challenges instead of camps (shared/isle-quests.js),
// on maps with none of camps, gates or a lair (shared/isle-bells.js). Every
// challenge is played through here on the real island, the way someone does
// on foot: shinies picked up by walking into them, a key reached at the top
// of a climb, a monkey run down, lost chicks led home, bonfires lit all at
// once, a tune sung back on the Singing Stones, and Jinx dazzled and caught;
// each beaten lighting its lock on the bell's cage, every lock lit winning
// the stage. And what is beaten is kept over a restart.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { DEEDS, stageResults, walkReach } from '../public/js/shared/adventure.js';
import { standHeight } from '../public/js/shared/critters.js';
import { buildIsle } from '../public/js/shared/isle-maps.js';
import { CHASE, JINX, LEAD, MAX_QUESTS, PLAY, Quests, STONES } from '../public/js/shared/isle-quests.js';
import { burnFor, herdLand } from '../public/js/shared/isle-bells.js';
import { chapterOf, CHAPTERS, firstStage, STAGES } from '../public/js/shared/isle-story.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { PublicAdventure } from '../server/adventure.js';

const FIRST = firstStage(4);
const BELLBUOY = FIRST;
const HENHOUSE = FIRST + 1;
const TOPSY = FIRST + 2;
const KITE = FIRST + 3;
const NEST = FIRST + 4;

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  c.fx = (k) => c.inbox.filter((m) => m.t === 'qfx' && m.k === k);
  return c;
}

// (Someone holding every episode's ticket: the fourth is only for those who
// hold the Magpie Feather.)
function join(room, name = 'Brave Fox') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat' }, tickets: [2, 3, 4] });
  c.pid = c.last('welcome').you;
  return c;
}

const isleRoom = (stage, time, seed = 9) => new Room({ code: '616161', adventure: true, shared: true, stage, seed, now: () => time.t });

// Someone standing at (x, y, z) for ms, the island going on round them.
function stay(room, time, c, at, ms = 300) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [...at, 0, 0, 0] });
    room.tick();
  }
}
const on = ([x, y, z]) => [x + 0.5, y, z + 0.5];

// ---------------------------------------------------------------- the maps

for (let stage = FIRST; stage < firstStage(5); stage++) {
  const ch = chapterOf(stage);
  test(`chapter ${stage}, ${ch.name}: an island to roam, every one of its challenges walked to from the start`, () => {
    for (const [seed, journey] of [[12345, 1], [987654321, 1], [4242, 2], [77, 3]]) {
      const made = buildIsle({ stage, seed, journey });
      const { world } = made;
      // No camps, no gates: its challenges, and the bell's cage with a lock for each.
      assert.deepEqual([made.camps.length, made.gates.length], [0, 0]);
      assert.deepEqual(made.quests.map((q) => q.kind), ch.quests.map((q) => q.kind), `${ch.key}: the story's challenges, in its order`);
      assert.equal(made.hub.locks.length, made.quests.length);
      made.hub.locks.forEach(([x, y, z], i) => assert.equal(world.get(x, y, z), B.ESCAPE_BUTTONS[i], `${ch.key}: lock ${i + 1}`));
      assert.ok(made.hub.open.length >= 4 * 10 && made.hub.open.every(Number.isInteger));
      assert.ok(made.chestSpots.length > 10, 'room for treasure chests about it');
      const reach = walkReach(world, [[world.spawn.x, world.spawn.y, world.spawn.z]]);
      const at = (x, y, z) => reach[(x * world.D + z) * world.H + y] === 1;
      // Someone standing within d across (and dy up or down) of a cell.
      const near = ([x, y, z], d = 1, dy = 1) => {
        for (let ox = -d; ox <= d; ox++) for (let oz = -d; oz <= d; oz++) for (let oy = -dy; oy <= dy; oy++) if (at(x + ox, y + oy, z + oz)) return true;
        return false;
      };
      const where = `${ch.key} (seed ${seed}, journey ${journey})`;
      for (const q of made.quests) {
        if (q.kind === 'finds') {
          assert.ok(q.spots.length >= 5, where);
          for (const c of q.spots) {
            assert.ok(B.SHINIES.includes(world.get(...c)), `${where}: a shiny at ${c}`);
            assert.ok(near(c), `${where}: the shiny at ${c} is walked to`);
          }
          assert.ok(q.spots.every((c, i) => q.spots.every((o, k) => k === i || Math.hypot(c[0] - o[0], c[2] - o[2]) >= 4)), `${where}: shinies apart`);
        } else if (q.kind === 'climb') {
          assert.equal(world.get(...q.at), B.GOLD_KEY, where);
          assert.ok(near(q.at), `${where}: the key at the top is climbed to, a step at a time`);
          assert.ok(q.at[1] > world.spawn.y + 8, `${where}: and it is a climb`);
        } else if (q.kind === 'chase') {
          assert.ok(near([q.x, q.y, q.z], 1, 1) && q.r >= 10 && q.catches >= 1, where);
        } else if (q.kind === 'lead') {
          assert.ok(near([Math.floor(q.home.x), q.home.y, Math.floor(q.home.z)], 1, 0), `${where}: into the pen`);
          assert.equal(q.spots.length, 5);
          for (const c of q.spots) assert.ok(near(c, 0, 0) && Math.hypot(c[0] - q.home.x, c[2] - q.home.z) > 15, `${where}: a stray at ${c}`);
          // And from each, an animal could walk home by itself: up a step of
          // one at most, down three at most, never through water — on ground
          // with no ledge round it that it could not climb off again.
          const herd = herdLand(world, q.home);
          for (const [x, y, z] of q.spots) {
            assert.equal(herd[x * world.D + z], y, `${where}: the stray at ${x},${y},${z} can walk home`);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(Math.abs(herd[(x + dx) * world.D + z + dz] - y) <= 1, `${where}: the stray at ${x},${y},${z} is on gentle ground`);
          }
          assert.ok(q.slots.length >= 5);
        } else if (q.kind === 'fires' || q.kind === 'jinx') {
          for (const c of q.fires) {
            assert.equal(world.get(...c), B.LOGS, `${where}: logs to light at ${c}`);
            assert.ok(near(c, 2, 3), `${where}: a bonfire walked up to`);
          }
          assert.equal(q.burn, burnFor(q.fires, q.kind === 'jinx' ? 14 : 12));
          assert.ok(q.burn >= 25 && q.burn <= 90, `${where}: ${q.burn} s to burn`);
          if (q.kind === 'jinx') {
            assert.ok(near(q.land), `${where}: where Jinx lands is walked to`);
            assert.ok(q.perch[1] > q.land[1] + 10, `${where}: and he perches out of reach`);
          }
        } else if (q.kind === 'stones') {
          assert.ok(near(q.start, 0, 0), where);
          q.pads.forEach((c, i) => {
            assert.ok(near(c, 0, 0), `${where}: stone ${i}`);
            assert.equal(world.get(c[0], c[1] - 1, c[2]), B.STAR_TILES[i]);
          });
        }
      }
    }
  });
}

test('the challenges of a chapter: open from the start, but the last of all only once the rest are done', () => {
  const made = buildIsle({ stage: NEST, seed: 3 });
  const qs = new Quests(made.quests, chapterOf(NEST).quests, 3);
  assert.equal(qs.list.length, 4);
  assert.ok(qs.list.length <= MAX_QUESTS);
  const jinx = qs.list.at(-1);
  assert.deepEqual(qs.list.map((q) => qs.open(q)), [true, true, true, false]);
  for (const q of qs.list.slice(0, 3)) q.done = true;
  assert.equal(qs.open(jinx), true);
  assert.equal(qs.allDone, false);
  // How each is told: [id, done, so far, of how many, its own].
  assert.deepEqual(qs.pack(0).map((r) => r.slice(0, 4)), [[1, 1, 0, 6], [2, 1, 0, 3], [3, 1, 1, 1], [4, 0, 0, 3]]);
});

// ---------------------------------------------------------------- playing them

test('Bellbuoy Bay played through: shinies found, the crow’s nest climbed, Coco caught — every lock open, the bell rings', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(BELLBUOY, time);
  const adv = room.adventure;
  assert.equal(adv.active, true);
  assert.equal(adv.shielded, false);
  const a = join(room);
  const welcome = a.last('welcome');
  assert.deepEqual(welcome.adventure.quests.map((q) => q.kind), ['finds', 'climb', 'chase']);
  assert.ok(welcome.adventure.hub.locks.length === 3);
  const [finds, climb, chase] = adv.quests.list;
  // Jinx sits on the cage, and Coco is about, steered by the island.
  const jinx = room.critters.list.find((c) => c.type === 'magpie');
  assert.ok(jinx?.held && room.critters.get(chase.cid)?.held);
  // The shinies: each picked up by walking into it, for everyone.
  for (const [i, spot] of finds.spots.entries()) {
    stay(room, time, a, on(spot));
    assert.equal(room.world.get(...spot), B.AIR, `shiny ${i} picked up`);
    assert.equal(a.fx('found').length, i + 1);
  }
  assert.equal(a.last('quest').id, 1, 'the first lock opens');
  assert.equal(room.world.get(...adv.hub.locks[0]), B.ESCAPE_BUTTONS_ON[0], 'and lights up');
  assert.equal(room.world.get(...adv.hub.locks[1]), B.ESCAPE_BUTTONS[1]);
  // The key at the top of the mast.
  stay(room, time, a, on(climb.at));
  assert.equal(room.world.get(...climb.at), B.AIR);
  assert.equal(a.last('quest').id, 2);
  assert.equal(adv.won, false);
  // Coco: touch him, and he is caught.
  const coco = room.critters.get(chase.cid);
  stay(room, time, a, [coco.x + 0.4, coco.y, coco.z], 100);
  assert.equal(a.fx('caught').length, 1);
  assert.equal(a.last('quest').id, 3);
  // Every lock open: the cage opens, the stage is won, and everyone's points.
  assert.equal(adv.won, true);
  const won = a.last('won');
  assert.deepEqual(won.by, [a.pid]);
  const row = won.board.find((r) => r.id === a.pid);
  assert.equal(row.play, PLAY.find * 5 + PLAY.top + PLAY.catch);
  assert.equal(row.score, row.play * DEEDS.play);
  for (let i = 0; i < adv.hub.open.length; i += 4) assert.equal(room.world.get(adv.hub.open[i], adv.hub.open[i + 1], adv.hub.open[i + 2]), B.AIR, 'its front bars gone');
  // And off Jinx flies, over the sea.
  const perch = [jinx.x, jinx.y];
  for (let t = 0; t < 30; t++) {
    time.t += 100;
    room.tick();
  }
  assert.ok(jinx.y > perch[1] + 4 && jinx.state === 'fly', 'flown off');
});

test('a monkey runs from whoever comes near, jinks aside, runs out of puff — and someone walking after it catches it, as many times as it takes', () => {
  for (const [stage, catches] of [[BELLBUOY, 1], [NEST, 3]]) {
    const time = { t: 1_000_000 };
    const room = isleRoom(stage, time);
    const adv = room.adventure;
    const a = join(room);
    const chase = adv.quests.list.find((q) => q.kind === 'chase');
    assert.equal(chase.catches, catches);
    const monkey = room.critters.get(chase.cid);
    // Someone walking straight after it (as fast as a walk, no faster),
    // round whatever is in the way.
    const me = { x: chase.x + 0.5 + chase.r * 0.9, z: chase.z + 0.5 };
    me.y = standHeight(room.world, me.x, me.z, chase.y + 2) ?? chase.y;
    let ran = 0;
    const start = time.t;
    while (adv.quests.get(chase.id).caught < catches && time.t - start < 240_000) {
      const dx = monkey.x - me.x;
      const dz = monkey.z - me.z;
      const d = Math.hypot(dx, dz);
      const was = [monkey.x, monkey.z];
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
        const ang = Math.atan2(dx, dz) + turn;
        const nx = me.x + Math.sin(ang) * Math.min(d, 4.6 * 0.1);
        const nz = me.z + Math.cos(ang) * Math.min(d, 4.6 * 0.1);
        const ny = standHeight(room.world, nx, nz, me.y + 1.1);
        if (ny === null || ny - me.y > 1.05 || room.world.get(Math.floor(nx), ny, Math.floor(nz)) === B.WATER) continue;
        Object.assign(me, { x: nx, y: ny, z: nz });
        break;
      }
      stay(room, time, a, [me.x, me.y, me.z], 100);
      ran += Math.hypot(monkey.x - was[0], monkey.z - was[1]);
      // It keeps to its patch of the island.
      assert.ok(Math.hypot(monkey.x - chase.x - 0.5, monkey.z - chase.z - 0.5) <= chase.r + 3, 'in its patch');
    }
    const secs = (time.t - start) / 1000;
    assert.equal(adv.quests.get(chase.id).caught, catches, `${chapterOf(stage).name}: caught ${catches} times (in ${secs} s)`);
    assert.ok(ran > 15 * catches, `it ran (${ran.toFixed(0)} blocks)`);
    assert.ok(secs > 3, 'not at once');
    assert.ok(secs < 60 * catches, `not for ever: ${secs} s`);
    assert.ok(a.fx('flee').length >= 1 && a.fx('puff').length >= 1, 'off it dashes, and puffs out');
    assert.equal(a.last('quest').id, chase.id);
  }
});

test('a monkey never outruns someone running, and only the quickest of them keeps up with someone walking', () => {
  for (let pace = 0; pace < 3; pace++) {
    // A dash and a puff, all told: how far it gets against how far a walk
    // (4.6 a second) and a run (7) go meanwhile.
    const ms = CHASE.dashMs[pace] + CHASE.puffMs[pace];
    const away = CHASE.dash[pace] * CHASE.dashMs[pace] + CHASE.puffed[pace] * CHASE.puffMs[pace];
    assert.ok(7 * ms > away * 1.3 && CHASE.dash[pace] < 7, `pace ${pace + 1}: a run catches up`);
    // (Bobo, the quickest, about holds his own against a walk across open
    // ground: whoever walks after him corners him on his patch, or runs.)
    if (pace < 2) assert.ok(4.6 * ms > away * 1.05, `pace ${pace + 1}: so does a walk`);
    else assert.ok(4.6 * ms > away * 0.9, `pace ${pace + 1}: nearly`);
  }
});

test('lost chicks wait where they are, follow whoever comes up to them, and settle in the coop once led into it', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(HENHOUSE, time);
  const adv = room.adventure;
  const a = join(room);
  const lead = adv.quests.list.find((q) => q.kind === 'lead');
  assert.equal(lead.flock.length, 5);
  const chicks = lead.flock.map((f) => room.critters.get(f.cid));
  assert.ok(chicks.every((c) => c?.type === 'chick' && c.held), 'steered by the island');
  // Left alone, they stay where they are (never wandering off, down a drop
  // they could not climb back up: at most nudged a little, on the level).
  const at = chicks.map((c) => [c.x, c.y, c.z]);
  stay(room, time, a, [5, 40, 5], 30000);
  chicks.forEach((c, i) => assert.ok(Math.hypot(c.x - at[i][0], c.z - at[i][2]) < 1 && c.y === at[i][1], `chick ${i} where it was`));
  const home = [lead.home.x, lead.home.y, lead.home.z];
  for (const [i, chick] of chicks.entries()) {
    // Up to it: it follows. Then into the coop, with it in tow from just
    // outside the gate.
    const f = lead.flock[i];
    stay(room, time, a, [chick.x + 1, chick.y, chick.z], 200);
    assert.equal(f.leader, a.pid, `chick ${i} follows`);
    assert.equal(a.fx('follow').length, i + 1);
    const gate = [lead.home.x - lead.home.r - 3, lead.home.y, lead.home.z];
    Object.assign(chick, { x: gate[0] - 1.5, y: lead.home.y, z: gate[2] });
    f.trail = [];
    stay(room, time, a, home, 6000);
    assert.equal(a.fx('home').length, i + 1, `chick ${i} home`);
    assert.ok(f.home && !f.leader);
  }
  assert.equal(a.last('quest').id, lead.id);
  // Settled, every one of them in the coop.
  stay(room, time, a, [home[0] + 30, home[1], home[2]], 4000);
  for (const c of chicks) assert.ok(Math.hypot(c.x - lead.home.x, c.z - lead.home.z) <= lead.home.r + 0.5);
  // Too far ahead, and one gives up following.
  const room2 = isleRoom(HENHOUSE, time);
  const b = join(room2);
  const f0 = room2.adventure.quests.list.find((q) => q.kind === 'lead').flock[0];
  const stray = room2.critters.get(f0.cid);
  stay(room2, time, b, [stray.x + 1, stray.y, stray.z], 200);
  assert.equal(f0.leader, b.pid);
  stay(room2, time, b, [stray.x + LEAD.stray + 6, stray.y + 30, stray.z], 200);
  assert.equal(f0.leader, 0);
  assert.equal(b.fx('lost').length, 1);
});

// A way an animal could walk from (x, z) to the column (tx, tz), as
// isle-quests.js has it walk (up one at most, down LEAD.drop at most, no
// water): its columns, each [x, y, z] with the height it stands at.
function herdWay(world, x0, z0, y0, tx, tz) {
  const key = (x, z) => x * world.D + z;
  const from = new Map([[key(x0, z0), null]]);
  const ys = new Map([[key(x0, z0), y0]]);
  const todo = [[x0, z0, y0]];
  while (todo.length) {
    const [x, z, y] = todo.shift();
    if (x === tx && z === tz) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (from.has(key(nx, nz))) continue;
      const ny = standHeight(world, nx + 0.5, nz + 0.5, y + 0.2);
      if (ny === null || ny - y > 1 || y - ny > LEAD.drop || world.get(nx, ny, nz) === B.WATER || B.SOLID[world.get(nx, ny + 1, nz)]) continue;
      from.set(key(nx, nz), [x, z]);
      ys.set(key(nx, nz), ny);
      todo.push([nx, nz, ny]);
    }
  }
  const way = [];
  for (let at = [tx, tz]; at; at = from.get(key(...at))) way.unshift([at[0], ys.get(key(...at)), at[1]]);
  return way;
}

test('a sheep led over hilly ground follows in its leader’s footsteps all the way into the fold', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(KITE, time);
  const a = join(room);
  const lead = room.adventure.quests.list.find((q) => q.kind === 'lead');
  assert.equal(lead.animal, 'sheep');
  const names = lead.flock.map((f) => room.critters.get(f.cid).name);
  assert.equal(new Set(names).size, names.length, `each its own name: ${names}`);
  for (const [i, f] of lead.flock.entries()) {
    const sheep = room.critters.get(f.cid);
    const way = herdWay(room.world, Math.floor(sheep.x), Math.floor(sheep.z), sheep.y, Math.floor(lead.home.x), Math.floor(lead.home.z));
    assert.ok(way.length > 10 && way.at(-1)[0] === Math.floor(lead.home.x), `sheep ${i}: a way home`);
    // Up to it (on its own spot), then walking home along the way, no
    // faster than a walk.
    const me = { x: Math.floor(sheep.x) + 0.5, y: sheep.y, z: Math.floor(sheep.z) + 0.5 };
    stay(room, time, a, [me.x, me.y, me.z], 200);
    assert.equal(f.leader, a.pid);
    const start = time.t;
    for (const [x, y, z] of way) {
      while (Math.hypot(x + 0.5 - me.x, z + 0.5 - me.z) > 0.05) {
        const d = Math.hypot(x + 0.5 - me.x, z + 0.5 - me.z);
        const s = Math.min(d, 0.4);
        Object.assign(me, { x: me.x + ((x + 0.5 - me.x) / d) * s, z: me.z + ((z + 0.5 - me.z) / d) * s, y });
        stay(room, time, a, [me.x, me.y, me.z], 100);
      }
    }
    // Waiting in the fold for it to catch up.
    for (let t = 0; t < 20000 && !f.home; t += 100) stay(room, time, a, [me.x, me.y, me.z], 100);
    assert.ok(f.home, `sheep ${i} home, ${(time.t - start) / 1000} s along a way of ${way.length}`);
  }
  assert.equal(a.fx('scramble').length, 0, 'every step of the way one it could walk');
  assert.equal(a.last('quest').id, lead.id);
});

test('a sheep stuck on a ledge it cannot climb off scrambles up beside whoever leads it', () => {
  // The island of a real game (game 14, journey 1) of Kite Cliffs, where a
  // sheep was once put down on a ledge of the shore two blocks under the slope
  // above it and the sea beside it: nowhere to go.
  const fnv = (text) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const time = { t: 1_000_000 };
  const room = isleRoom(KITE, time, fnv(`14/1:${KITE}`));
  const a = join(room);
  const f = room.adventure.quests.list.find((q) => q.kind === 'lead').flock[0];
  const sheep = room.critters.get(f.cid);
  const ledge = [92.5, 22, 18.5];
  assert.equal(standHeight(room.world, 92.5, 18.5, 22.2), 22);
  Object.assign(sheep, { x: ledge[0], y: ledge[1], z: ledge[2] });
  // Fetched from beside it, then led away up the slope.
  stay(room, time, a, [ledge[0] - 0.4, ledge[1], ledge[2] + 0.4], 200);
  assert.equal(f.leader, a.pid);
  // It tries to come (along the ledge, as far as that goes), stuck down there
  // a moment...
  const up = [89.5, 26, 20.5];
  stay(room, time, a, up, LEAD.stuckMs - 300);
  assert.ok(Math.hypot(sheep.x - ledge[0], sheep.z - ledge[2]) < 3 && sheep.y === ledge[1], 'still down on the ledge');
  assert.equal(a.fx('scramble').length, 0);
  // ...and then up it scrambles.
  for (let t = 0; t < 5000 && !a.fx('scramble').length; t += 100) stay(room, time, a, up, 100);
  assert.equal(a.fx('scramble').length, 1, 'then up it scrambles');
  assert.ok(Math.hypot(sheep.x - up[0], sheep.z - up[2]) <= LEAD.near + 0.5 && Math.abs(sheep.y - up[1]) <= 1.2, 'beside its leader');
});

test('bonfires each burn so long once lit: all of them alight at once and they burn for good', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(HENHOUSE, time);
  const adv = room.adventure;
  const a = join(room);
  const fires = adv.quests.list.find((q) => q.kind === 'fires');
  const by = ([x, y, z]) => [x + 2.2, y, z + 0.5];
  // One lit and left: it burns out, back to its logs.
  stay(room, time, a, by(fires.fires[0]), 200);
  assert.equal(room.world.get(...fires.fires[0]), B.CAMPFIRE);
  assert.equal(a.fx('lit').length, 1);
  stay(room, time, a, [5, 40, 5], fires.burn * 1000 + 300);
  assert.equal(room.world.get(...fires.fires[0]), B.LOGS, 'burnt out');
  assert.equal(a.fx('out').length, 1);
  // One after another, quickly enough: all three at once, alight for good.
  for (const f of fires.fires) stay(room, time, a, by(f), 400);
  assert.equal(a.last('quest').id, fires.id);
  stay(room, time, a, [5, 40, 5], fires.burn * 1000 * 2);
  for (const f of fires.fires) assert.equal(room.world.get(...f), B.CAMPFIRE);
});

test('the Singing Stones sing a tune a note longer each round, sung back in order — a wrong stone has it sung again', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(TOPSY, time);
  const adv = room.adventure;
  const a = join(room);
  const stones = adv.quests.list.find((q) => q.kind === 'stones');
  const step = (at) => stay(room, time, a, on(at), 200);
  const off = [stones.start[0] + 0.5, stones.start[1], stones.start[2] + 3.5];
  // Into the middle: the ring sings round 1.
  step(stones.start);
  let tune = a.last('qfx').tune;
  assert.equal(a.last('qfx').k, 'tune');
  assert.equal(tune.length, STONES.first);
  // Stepping on stones while it sings counts for nothing.
  step(stones.pads[(tune[0] + 1) % 4]);
  assert.equal(a.fx('oops').length, 0);
  stay(room, time, a, off, STONES.gap * (tune.length + 1));
  // A wrong stone: oops, and the tune again, the same one.
  step(stones.pads[(tune[0] + 1) % 4]);
  assert.equal(a.fx('oops').length, 1);
  stay(room, time, a, off, STONES.pause + 200);
  assert.deepEqual(a.last('qfx').tune, tune, 'sung again');
  for (let round = 1; round <= stones.rounds; round++) {
    stay(room, time, a, off, STONES.gap * (tune.length + 1));
    for (const pad of tune) {
      step(stones.pads[pad]);
      stay(room, time, a, off, 100);
    }
    if (round < stones.rounds) {
      assert.equal(a.last('qfx').k, 'round');
      stay(room, time, a, off, STONES.pause + 200);
      const next = a.last('qfx').tune;
      assert.equal(next.length, tune.length + 1, 'a note longer');
      assert.deepEqual(next.slice(0, tune.length), tune, 'the same tune so far');
      tune = next;
    }
  }
  assert.equal(a.last('quest').id, stones.id);
  assert.equal(a.fx('note').length, [3, 4, 5].reduce((n, k) => n + k, 0));
});

test('Jinx: out of reach until every other challenge is beaten, then dazzled by his beacons, tumbles down and is caught three times', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(NEST, time);
  const adv = room.adventure;
  const a = join(room);
  const q = adv.quests.list.find((o) => o.kind === 'jinx');
  const jinx = room.critters.get(q.cid);
  assert.ok(jinx.held && jinx.type === 'magpie');
  assert.ok(!room.critters.list.some((c) => c.type === 'magpie' && c !== jinx), 'and only the one Jinx (not on the cage)');
  const light = () => {
    for (const f of q.fires) stay(room, time, a, [f[0] + 2.2, f[1], f[2] + 0.5], 300);
  };
  // Not yet: the beacons stay dark.
  light();
  assert.equal(a.fx('lit').length, 0);
  // The rest beaten (as kept, say): now they light.
  room.restoreQuests([1, 2, 3]);
  assert.equal(adv.quests.list.filter((o) => o.done).length, 3);
  // (Watching from a few steps off where he will land.)
  const aside = [q.land[0] + 0.5, q.land[1], q.land[2] + 5.5];
  for (let n = 1; n <= JINX.catches; n++) {
    light();
    assert.equal(a.fx('dazzle').length, n + (n > 2 ? 1 : 0), 'every beacon at once: dazzled');
    stay(room, time, a, aside, JINX.fall + 200);
    assert.equal(q.phase, 'dazed');
    assert.ok(Math.hypot(jinx.x - q.land[0] - 0.5, jinx.z - q.land[2] - 0.5) < 0.1, 'down where it was shown');
    if (n === 2) {
      // Too slow once: up he flies again, and the beacons go out.
      stay(room, time, a, [5, 40, 5], JINX.dazed[q.pace - 1] + 200);
      assert.equal(a.fx('escaped').length, 1);
      for (const f of q.fires) assert.equal(room.world.get(...f), B.LOGS);
      stay(room, time, a, [5, 40, 5], JINX.up + 200);
      assert.equal(q.phase, 'perch');
      light();
      stay(room, time, a, aside, JINX.fall + 200);
      assert.equal(q.phase, 'dazed');
    }
    stay(room, time, a, [jinx.x + 0.5, jinx.y, jinx.z], 100);
    assert.equal(q.caught, n);
    if (n < JINX.catches) stay(room, time, a, [5, 40, 5], JINX.up + 200);
  }
  assert.equal(a.last('quest').id, q.id);
  assert.equal(adv.won, true);
  assert.ok(a.last('won'));
  assert.equal(adv.story.final, true, 'the end of its episode');
});

test('challenges beaten are kept over a restart, the island put back as they left it', () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'bells-'));
  try {
    const file = joinPath(dir, 'isle.json');
    const time = { t: 1_000_000 };
    const rooms = new Map();
    const isle = new PublicAdventure({ rooms, now: () => time.t, log: () => {}, file }).start();
    const { code } = isle.newRun('Brave Fox', time.t, 4);
    const run = isle.runs.find((r) => r.entry.code === code);
    const room = run.entry.room;
    assert.equal(room.stage, FIRST);
    const a = join(room);
    const finds = room.adventure.quests.get(1);
    for (const spot of finds.spots) stay(room, time, a, on(spot));
    assert.equal(finds.done, true);
    isle.tick(time.t);
    isle.stop();
    // Up again: the shinies gone, the first lock lit, the rest still to do.
    const again = new PublicAdventure({ rooms: new Map(), now: () => time.t, log: () => {}, file }).start();
    const back = again.runs.find((r) => r.id === run.id).entry.room;
    assert.deepEqual(back.adventure.quests.list.map((q) => q.done), [true, false, false]);
    for (const spot of finds.spots) assert.equal(back.world.get(...spot), B.AIR);
    assert.equal(back.world.get(...back.adventure.hub.locks[0]), B.ESCAPE_BUTTONS_ON[0]);
    assert.equal(back.world.get(...back.adventure.hub.locks[1]), B.ESCAPE_BUTTONS[1]);
    assert.deepEqual(again.adminList().find((g) => g.id === run.id).freed, 1);
    again.stop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the results of a stage told in challenges count the points of play', () => {
  const deeds = new Map([[1, { pops: 0, boss: 0, flag: 0, helps: 0, play: 21 }], [2, { pops: 0, boss: 0, flag: 0, helps: 0, play: 4 }]]);
  const rows = stageResults(deeds, [{ id: 1, name: 'Brave Fox' }, { id: 2, name: 'Kind Owl' }, { id: 3, name: 'Shy Cat' }]);
  assert.deepEqual(rows.map((r) => [r.id, r.play ?? 0, r.score, r.place]), [[1, 21, 21, 1], [2, 4, 4, 2], [3, 0, 0, 3]]);
  assert.deepEqual(rows.map((r) => r.gems), [2, 1, 0]);
  // (Nothing to do with the other episodes' stages: no play, no column.)
  assert.equal(stageResults(new Map([[1, { pops: 3, boss: 0, flag: 0, helps: 0 }]]), [{ id: 1, name: 'A' }])[0].play, undefined);
  assert.equal(CHAPTERS.filter((c) => c.quests).length, 5);
});
