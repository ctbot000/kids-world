// Adventure Isle's fifth episode, "Toon Isle" (shared/isle-story.js): told in
// battles instead of camps (shared/isle-battles.js), on islands twice as far
// across as any before (shared/isle-toon.js), hidden under Baron Bluster's
// Cloud Blanket until someone gets there. Every map's battles are walked to
// here, and each kind of battle is played through on the real island the
// way someone does: an ambush sprung and every wave popped (and reset when
// everyone inside is out of the fight), a beacon lit and kept alight (and
// out when the Storm Gang puts it out), Storm Nests burst, a Big Bad run
// down as it runs off to rest, and Baron Bluster zapped down by his own
// lightning rods and popped. The clouds and the battles won are kept over a
// restart.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { walkReach } from '../public/js/shared/adventure.js';
import { buildIsle, ISLE_SIDE } from '../public/js/shared/isle-maps.js';
import { AMBUSH, Battles, DROP, FIERCE, FOG_TILE, Fog, GANG, geared, HUNT, REVEAL, REVEAL_START, SIEGE, standNear, unpackFog, walkableAround } from '../public/js/shared/isle-battles.js';
import { chapterOf, CHAPTERS, firstStage } from '../public/js/shared/isle-story.js';
import { BUMP_HP, kindOf } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { PublicAdventure } from '../server/adventure.js';

const FIRST = firstStage(5);

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  c.fx = (k) => c.inbox.filter((m) => m.t === 'bfx' && m.k === k);
  return c;
}

// (Someone holding every episode's ticket: the fifth is only for those who
// hold the Toon Isle Map.)
function join(room, name = 'Brave Fox', look = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', ...look }, tickets: [2, 3, 4, 5] });
  c.pid = c.last('welcome').you;
  return c;
}

const isleRoom = (stage, time, seed = 9) => new Room({ code: '717171', adventure: true, shared: true, stage, seed, now: () => time.t });

// Where someone stands on the ground of the column at (x, z), from the top.
const ground = (world, x, z) => standNear(world, x, z, world.H / 2, world.H / 2);

// Someone standing at (x, y, z) for ms, the island going on round them.
function stay(room, time, c, at, ms = 300) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [...at, 0, 0, 0] });
    room.tick();
  }
}

// Someone fighting for ms: each moment beside the nearest monster `which`
// lets through (nearest to `from`, or to where they are), bopping it.
function fight(room, time, c, ms, which, { from = null, until = () => false } = {}) {
  let at = room.players.get(c.pid).s.slice(0, 3);
  for (let t = 0; t < ms && !until(); t += 100) {
    const o = from ?? { x: at[0], z: at[2] };
    const list = room.monsters.list.filter(which).sort((a, b) => Math.hypot(a.body.x - o.x, a.body.z - o.z) - Math.hypot(b.body.x - o.x, b.body.z - o.z));
    const m = list[0];
    if (m) {
      at = [m.body.x - 1.2, m.body.y, m.body.z];
      room.receive(c, { t: 'm', s: [...at, 0, 0, 0] });
      room.receive(c, { t: 'bop', id: m.id });
    }
    time.t += 100;
    room.receive(c, { t: 'm', s: [...at, 0, 0, 0] });
    room.tick();
  }
}

// Nothing bumps anyone's HP down for the length of a test of how a battle
// goes (the bot is perfect, not invincible: without this it can be out of
// hearts at a bad moment, and the battle with it).
const sturdy = (room, c) => {
  const p = room.players.get(c.pid);
  Object.defineProperty(p, 'hp', { get: () => p.maxHp ?? 100, set: () => {}, configurable: true });
};

// ---------------------------------------------------------------- the maps

for (let stage = FIRST; stage < firstStage(6); stage++) {
  const ch = chapterOf(stage);
  test(`chapter ${stage}, ${ch.name}: a big island hidden under the clouds, every one of its battles walked to from the start`, () => {
    for (const [seed, journey] of [[12345, 1], [987654321, 1], [4242, 2], [77, 3], [31337, 4]]) {
      const made = buildIsle({ stage, seed, journey });
      const { world } = made;
      // Twice as far across as any other chapter's: four times the land.
      assert.deepEqual([world.W, world.D, world.theme], [2 * ISLE_SIDE, 2 * ISLE_SIDE, ch.theme]);
      // No camps, no gates: its battles, in the story's order, and its Sky
      // Lantern with a lamp for each.
      assert.deepEqual([made.camps.length, made.gates.length], [0, 0]);
      assert.deepEqual(made.battles.map((b) => b.kind), ch.battles.map((b) => b.kind), `${ch.key}: the story's battles, in its order`);
      assert.equal(world.get(...made.hub.lantern), B.SKY_LANTERN);
      assert.equal(made.hub.lamps.length, made.battles.length);
      made.hub.lamps.forEach((c, i) => assert.equal(world.get(...c), B.LANTERN_LAMP, `${ch.key}: lamp ${i + 1}`));
      assert.ok(made.roads.length >= made.battles.length && made.roads.every((r) => r.length >= 2), 'ways for the gangs to go along');
      assert.ok(made.chestSpots.length > 20, 'room for treasure chests about it');
      const reach = walkReach(world, [[world.spawn.x, world.spawn.y, world.spawn.z]]);
      const { W, D, H } = world;
      // Someone standing within r across (and up to `up` up or down) of a point.
      const near = (x, z, y, r = 2.5, up = 4) => {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
            if (Math.hypot(dx, dz) > r) continue;
            const cx = Math.floor(x) + dx;
            const cz = Math.floor(z) + dz;
            if (cx < 0 || cz < 0 || cx >= W || cz >= D) continue;
            for (let yy = Math.max(1, Math.floor(y) - up); yy <= Math.min(H - 2, Math.floor(y) + up); yy++) if (reach[(cx * D + cz) * H + yy]) return true;
          }
        }
        return false;
      };
      for (const b of made.battles) {
        const where = `${ch.key} (seed ${seed}, journey ${journey}): the ${b.kind}`;
        assert.ok(near(b.x, b.z, b.y, 3), `${where} is walked to`);
        if (b.kind === 'ambush') {
          assert.equal(world.get(...b.prize), B.SPARK, `${where}: its Lantern Spark`);
          assert.ok(near(b.prize[0] + 0.5, b.prize[2] + 0.5, b.prize[1], AMBUSH.spring - 0.3), `${where}: its spark reached`);
        }
        if (b.kind === 'siege') {
          assert.equal(world.get(...b.beacon), B.LOGS, `${where}: its beacon, unlit`);
          assert.ok(near(b.beacon[0] + 0.5, b.beacon[2] + 0.5, b.beacon[1], SIEGE.reach - 0.4), `${where}: its beacon reached`);
          // The Storm Gang has ground to come at it over.
          assert.ok(walkableAround(world, b.beacon[0] + 0.5, b.beacon[1], b.beacon[2] + 0.5, SIEGE.from[1]).filter(([x, , z]) => Math.hypot(x - b.beacon[0] - 0.5, z - b.beacon[2] - 0.5) >= SIEGE.from[0]).length > 40, `${where}: ground round it`);
        }
        if (b.kind === 'nest') {
          assert.ok(b.spots.length >= 3);
          for (const s of b.spots) assert.ok(near(s[0] + 0.5, s[2] + 0.5, s[1], 2.4), `${where}: a nest reached`);
        }
        if (b.kind === 'showdown') {
          assert.equal(b.rods.length, 3);
          for (const r of b.rods) {
            assert.equal(world.get(...r), B.LIGHTNING_ROD);
            assert.ok(near(r[0] + 0.5, r[2] + 0.5, r[1], 1.8), `${where}: a rod reached`);
          }
        }
        if (b.kind === 'hunt') {
          assert.ok(b.range.length > 30, `${where}: a long way round`);
          const off = b.range.filter(([x, z]) => !near(x, z, world.top(Math.floor(x), Math.floor(z)) + 1, 2, 6));
          assert.equal(off.length, 0, `${where}: its whole range walked`);
        }
      }
    }
  });
}

// ---------------------------------------------------------------- the clouds

test('the Cloud Blanket: a tile at a time, rolled back round anyone for good, kept and read back', () => {
  const fog = new Fog(256, 256);
  assert.deepEqual([fog.w, fog.h, fog.count], [256 / FOG_TILE, 256 / FOG_TILE, 0]);
  assert.equal(fog.isSeen(-5, 10), true, 'off the map is the open sea');
  assert.equal(fog.isSeen(100, 100), false);
  const got = fog.reveal(100, 100);
  assert.ok(got.length > 20 && got.length < 40, `${got.length} tiles round someone`);
  assert.equal(fog.isSeen(100 + REVEAL - 1, 100), true);
  assert.equal(fog.isSeen(100 + REVEAL + FOG_TILE + 1, 100), false, 'no further');
  assert.deepEqual(fog.reveal(100, 100), [], 'never twice');
  const kept = fog.pack();
  const again = new Fog(256, 256);
  assert.equal(again.load(kept).length, fog.count);
  assert.deepEqual([...again.seen], [...fog.seen]);
  assert.deepEqual([...unpackFog(kept, fog.seen.length)], [...fog.seen], 'as a page reads it');
  assert.deepEqual(again.load('not base64 at all!'), [], 'nonsense is nothing');
  assert.equal(fog.revealAll().length, fog.seen.length - got.length);
  assert.equal(fog.all, true);
});

test('arriving, only the landing is clear; walking about rolls the clouds back for everyone, and a battle shows once its ground does', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room, 'Brave Fox');
  const b = join(room, 'Calm Owl');
  const adv = room.adventure;
  const w = room.world;
  const sent = adv.describe().fog;
  assert.deepEqual([sent.tile, sent.w, sent.h], [FOG_TILE, w.W / FOG_TILE, w.D / FOG_TILE]);
  const start = adv.battles.fog.count;
  assert.ok(start > 0 && start < 80, `the landing only (${start} tiles)`);
  assert.equal(adv.battles.fog.isSeen(w.spawn.x, w.spawn.z), true);
  for (const battle of adv.battles.list) assert.equal(adv.battles.fog.isSeen(battle.x, battle.z), false, `${battle.kind} still hidden`);
  // Off towards the first battle: everyone told of the tiles newly seen.
  const target = adv.battles.list[0];
  for (let k = 1; k <= 10; k++) {
    const x = w.spawn.x + (target.x - w.spawn.x) * (k / 10);
    const z = w.spawn.z + (target.z - w.spawn.z) * (k / 10);
    stay(room, time, a, [x, ground(w, x, z), z], 200);
  }
  assert.ok(adv.battles.fog.isSeen(target.x, target.z), 'there now');
  const told = new Set(b.all('fog').flatMap((m) => m.a));
  assert.equal(told.size, adv.battles.fog.count - start, 'every tile told, once');
  assert.ok(REVEAL_START > REVEAL);
});

// ---------------------------------------------------------------- an ambush

test('an ambush: walking up to its spark springs a ring of thorns, the Storm Gang comes in waves, and every wave popped wins it', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const w = room.world;
  const b = adv.battles.list.find((o) => o.kind === 'ambush');
  const [px, py, pz] = b.prize;
  stay(room, time, a, [px + 0.5, py, pz + 0.5], 300);
  assert.equal(b.state, 'on');
  assert.equal(a.fx('spring').length, 1);
  // The ring: thorns all round, too high to jump, no way out.
  const ring = b.ring;
  assert.ok(ring.length > 4 * 60, 'thorns all round');
  for (let i = 0; i < ring.length; i += 4) assert.equal(w.get(ring[i], ring[i + 1], ring[i + 2]), B.BRAMBLE);
  const inside = walkReach(w, [[px + 0.5, py, pz + 0.5]]);
  const out = (x, z) => {
    for (let y = 1; y < w.H; y++) if (inside[(x * w.D + z) * w.H + y]) return true;
    return false;
  };
  assert.equal(out(Math.floor(b.x + b.r + 3), Math.floor(b.z)), false, 'nobody walks out of the ring');
  // Wave after wave, tougher and tougher, to the last.
  fight(room, time, a, 240000, (m) => m.camp === b.camp.id, { until: () => b.done });
  assert.equal(b.done, true);
  assert.deepEqual(a.fx('wave').map((m) => m.n), Array.from({ length: b.waves }, (_, i) => i + 1));
  assert.ok(a.last('battle')?.id === b.id && a.last('battle').by.includes(a.pid));
  for (let i = 0; i < ring.length; i += 4) assert.notEqual(w.get(ring[i], ring[i + 1], ring[i + 2]), B.BRAMBLE, 'the thorns gone');
  assert.equal(w.get(px, py, pz), B.AIR, 'the spark taken');
  assert.equal(w.get(...adv.hub.lamps[b.id - 1]), B.LANTERN_LAMP_ON, 'its lamp lit');
  // A safe place now, where anyone out of hearts comes back.
  assert.ok(adv.havens(w).some((h) => Math.hypot(h.x - b.x, h.z - b.z) < 1));
});

test('an ambush with everyone inside out of the fight resets, to be sprung again a while later', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room);
  const adv = room.adventure;
  const b = adv.battles.list.find((o) => o.kind === 'ambush');
  const [px, py, pz] = b.prize;
  stay(room, time, a, [px + 0.5, py, pz + 0.5], 2000);
  assert.equal(b.state, 'on');
  const ring = b.ring.slice();
  // Out of hearts, with nobody to help: home they go, and the trap is lost.
  const p = room.players.get(a.pid);
  p.hp = 1;
  room.knock(p, time.t, 0, { t: 'bump', pid: p.id, id: 0, x: px, z: pz });
  stay(room, time, a, [room.world.spawn.x, room.world.spawn.y, room.world.spawn.z], AMBUSH.lost + 500);
  assert.equal(b.state, 'idle');
  assert.equal(a.fx('fail').length, 1);
  assert.equal(room.monsters.list.filter((m) => m.camp === b.camp.id).length, 0, 'its Storm Gang gone');
  for (let i = 0; i < ring.length; i += 4) assert.notEqual(room.world.get(ring[i], ring[i + 1], ring[i + 2]), B.BRAMBLE);
  // Not again at once…
  stay(room, time, a, [px + 0.5, py, pz + 0.5], 1000);
  assert.equal(b.state, 'idle');
  // …but after a rest.
  stay(room, time, a, [px + 0.5, py, pz + 0.5], AMBUSH.rest);
  assert.equal(b.state, 'on');
});

// ---------------------------------------------------------------- a siege

test('a siege: the beacon lit by standing by it, the Storm Gang going for it, and kept alight to the end it is won', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const w = room.world;
  const b = adv.battles.list.find((o) => o.kind === 'siege');
  const [bx, by, bz] = b.beacon;
  stay(room, time, a, [bx + 2.5, by, bz + 0.5], SIEGE.light + 400);
  assert.equal(b.state, 'on');
  assert.equal(w.get(bx, by, bz), B.CAMPFIRE, 'alight');
  assert.ok(a.fx('lit').length === 1 && b.hearts === b.max && b.max >= 14);
  // Monsters come for it from round about, and only its own go for it.
  stay(room, time, a, [bx + 2.5, by, bz + 0.5], 3000);
  const gang = room.monsters.list.filter((m) => m.camp === b.camp.id);
  assert.ok(gang.length >= 2, 'the Storm Gang is out');
  for (const m of gang) {
    const d = Math.hypot(m.body.x - bx - 0.5, m.body.z - bz - 0.5);
    assert.ok(d <= SIEGE.from[1] + 2, `${m.kind} let out near it (${d.toFixed(1)})`);
  }
  // Defended to the end: won.
  fight(room, time, a, b.ms + 5000, (m) => m.camp === b.camp.id, { from: { x: bx, z: bz }, until: () => b.done });
  assert.equal(b.done, true);
  assert.ok(a.last('battle')?.id === b.id);
  assert.equal(room.monsters.list.filter((m) => m.camp === b.camp.id).length, 0, 'what was left of them ran off');
});

test('a beacon the Storm Gang puts out goes out, to be lit again', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const b = adv.battles.list.find((o) => o.kind === 'siege');
  const [bx, by, bz] = b.beacon;
  stay(room, time, a, [bx + 2.5, by, bz + 0.5], SIEGE.light + 400);
  assert.equal(b.state, 'on');
  // Nobody stops them: off out of the way, they get at it.
  const far = [bx + 40, ground(room.world, bx + 40, bz), bz];
  for (let t = 0; t < 60000 && b.state === 'on'; t += 1000) stay(room, time, a, far, 1000);
  assert.equal(b.state, 'idle');
  assert.ok(a.fx('hit').length >= b.max / 2, 'bumped, a heart at a time');
  assert.equal(a.fx('out').length, 1);
  assert.equal(room.world.get(bx, by, bz), B.LOGS, 'out');
  assert.equal(b.done, false);
});

test('the beacon is only its own Storm Gang’s to go for: a gang going by leaves it alone', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  join(room);
  const adv = room.adventure;
  const b = adv.battles.list.find((o) => o.kind === 'siege');
  const [bx, by, bz] = b.beacon;
  const decoy = { ...adv.decoys()[0], id: -1 };
  assert.equal(adv.decoys().length, 0, 'none while it is not alight');
  b.state = 'on';
  const [beacon] = adv.decoys();
  assert.equal(beacon.only, b.camp.id);
  void decoy;
  // A blob of some other gang right beside it never goes for it…
  const other = room.monsters.add(room.world, bx + 2.5, by, bz + 0.5, { camp: 999, kind: 'blob' });
  room.adventure.battles.gangs.push({ camp: { id: 999, kind: 'arena', x: bx, z: bz, r: 20 }, road: [[bx, bz]], at: 0, dir: 1, kinds: [], left: 1, awake: true, spawned: true, quiet: 0 });
  const bumps = room.monsters.step(room.world, 0.1, time.t, [beacon], false, { camps: adv, havens: [] });
  assert.equal(other.target, 0);
  assert.equal(bumps.length, 0);
});

// ---------------------------------------------------------------- a nest

test('Storm Nests hatch the Storm Gang while anyone is near, and every nest burst wins it', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST + 1, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const b = adv.battles.list.find((o) => o.kind === 'nest');
  stay(room, time, a, [b.x, b.y, b.z], 400);
  assert.equal(b.state, 'on');
  const nests = room.monsters.list.filter((m) => m.kind === 'nest');
  assert.equal(nests.length, b.spots.length);
  // They never move, nor bump anyone.
  const where = nests.map((m) => [m.body.x, m.body.z]);
  stay(room, time, a, [b.x, b.y, b.z], 8000);
  assert.deepEqual(nests.map((m) => [m.body.x, m.body.z]), where);
  assert.ok(a.fx('hatch').length >= nests.length, 'hatching');
  assert.ok(room.monsters.list.filter((m) => m.camp === b.camp.id && m.kind !== 'nest').every((m) => m.from), 'each hatched from a nest');
  // Burst, every one: won.
  fight(room, time, a, 240000, (m) => m.camp === b.camp.id && (m.kind === 'nest' || Math.hypot(m.body.x - b.x, m.body.z - b.z) < 6), { until: () => b.done });
  assert.equal(b.done, true);
  assert.equal(a.fx('burst').length, nests.length);
});

// ---------------------------------------------------------------- a hunt

test('a hunt: the Big Bad goes round its range, runs off to rest when hurt, and is popped in the end', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const w = room.world;
  const b = adv.battles.list.find((o) => o.kind === 'hunt');
  // Nobody near: it goes on round its range by itself.
  const from = b.along;
  stay(room, time, a, [w.spawn.x, w.spawn.y, w.spawn.z], 5000);
  assert.ok(b.along > from, 'on round its range');
  assert.equal(b.monster ?? 0, 0, 'asleep, nobody to see it');
  // Near it: out it comes, a beast with its helpers.
  stay(room, time, a, [b.camp.x + 4, ground(w, b.camp.x + 4, b.camp.z), b.camp.z], 300);
  const beast = room.monsters.get(b.monster);
  assert.ok(beast && beast.kind === b.beast && beast.keepHearts);
  assert.equal(beast.hearts, b.max);
  // Hurt a quarter of its hearts and more: off it runs, along its way.
  beast.hearts = Math.floor(b.max * 0.7);
  stay(room, time, a, [beast.body.x - 2, beast.body.y, beast.body.z], 200);
  assert.equal(a.fx('flee').length, 1);
  assert.ok(b.lure, 'running off');
  const before = { x: beast.body.x, z: beast.body.z };
  stay(room, time, a, [before.x - 40, ground(w, before.x - 40, before.z) ?? beast.body.y, before.z], 6000);
  assert.ok(Math.hypot(beast.body.x - before.x, beast.body.z - before.z) > 8, 'gone on');
  // Left alone, it gets hearts back, but never past where it ran off at.
  const hurt = beast.hearts;
  stay(room, time, a, [before.x - 40, ground(w, before.x - 40, before.z) ?? beast.body.y, before.z], 40000);
  assert.ok(beast.hearts > hurt || b.lure === null, 'resting');
  assert.ok(beast.hearts <= Math.round(beast.max * (1 - 1 / (HUNT.flees + 1))), 'never past three quarters');
  // Run down and popped: won.
  fight(room, time, a, 240000, (m) => m.camp === b.camp.id, { until: () => b.done });
  assert.equal(b.done, true);
  assert.ok(a.all('pop').some((m) => m.id === beast.id));
  assert.ok(HUNT.flee < 7, 'never as quick as you run');
});

// ---------------------------------------------------------------- the showdown

test('Baron Bluster: shut in his arena until every other battle is won, out of reach on his cloud until his rods zap him down, popped in the end', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(firstStage(6) - 1, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const w = room.world;
  const sd = adv.battles.list.find((o) => o.kind === 'showdown');
  stay(room, time, a, [sd.x, sd.y, sd.z], 1000);
  assert.equal(sd.monster ?? 0, 0, 'not while the rest are to win');
  assert.equal(adv.battles.pack(time.t).find((r) => r[0] === sd.id)[1], 3, 'told as locked');
  for (const o of adv.battles.list) if (o !== sd) Object.assign(o, { done: true, state: 'done' });
  stay(room, time, a, [sd.x, sd.y, sd.z], 400);
  const baron = room.monsters.get(sd.monster);
  assert.ok(baron && baron.kind === 'bluster' && baron.held && baron.body.flying);
  assert.ok(baron.body.y > sd.y + 5, 'up on his cloud');
  // Out of reach up there: a bop does nothing.
  room.receive(a, { t: 'm', s: [baron.body.x - 1, baron.body.y, baron.body.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: baron.id });
  assert.equal(a.last('kinghit')?.shielded, true);
  // Lightning from the sky, rings first.
  stay(room, time, a, [sd.x, sd.y, sd.z], 4000);
  assert.ok(a.all('mfx').some((m) => m.kind === 'hurl' && m.sky && m.what === 'bolt'), 'lightning thrown');
  // Charging one rod is not enough; all three at once is.
  const [r0] = sd.rodSpots;
  stay(room, time, a, [r0[0] + 1.5, r0[1], r0[2] + 0.5], 1800);
  assert.equal(sd.phase, 'sky');
  for (const r of sd.rodSpots.slice(1)) stay(room, time, a, [r[0] + 1.5, r[1], r[2] + 0.5], 1800);
  assert.equal(sd.phase, 'ground', 'zapped down');
  assert.equal(a.fx('zap').length, 1);
  assert.ok(!baron.held && baron.dazed > time.t, 'dazed on the ground');
  // Bopped while dazed: three hearts a bop. Three turns, and he is popped.
  for (let turn = 0; turn < 8 && !adv.won; turn++) {
    if (sd.phase === 'sky') for (const r of sd.rodSpots) stay(room, time, a, [r[0] + 1.5, r[1], r[2] + 0.5], 1700);
    fight(room, time, a, 30000, (m) => m.kind === 'bluster', { until: () => adv.won || sd.phase === 'sky' });
  }
  assert.equal(adv.won, true);
  assert.ok(a.fx('up').length >= 1, 'he puffed himself back up at least once');
  assert.ok(a.last('won'));
  assert.deepEqual([adv.story.final, adv.story.last], [true, false], 'the end of the episode, not of the story');
  assert.equal(adv.battles.fog.all, true, 'the Cloud Blanket blown away');
  assert.ok(a.all('fog').some((m) => m.all));
  assert.equal(w.get(...adv.hub.lamps[sd.id - 1]), B.LANTERN_LAMP_ON, 'his lamp lit');
});

// ---------------------------------------------------------------- the gangs

test('gangs of the Storm Gang roam the paths well away from everyone, wake as someone comes, and another turns up once one is popped', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST + 2, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const w = room.world;
  stay(room, time, a, [w.spawn.x, w.spawn.y, w.spawn.z], 60000);
  const gangs = adv.battles.gangs;
  assert.equal(gangs.length, adv.battles.gangsWanted(1));
  for (const g of gangs) {
    assert.ok(Math.hypot(g.camp.x - w.spawn.x, g.camp.z - w.spawn.z) >= GANG.landing - 1, 'away from the landing');
    // (Far off ones asleep: only the near ones out.)
    if (Math.hypot(g.camp.x - w.spawn.x, g.camp.z - w.spawn.z) > GANG.far) assert.equal(g.awake, false, 'asleep, nobody near');
  }
  assert.equal(room.monsters.list.some((m) => Math.hypot(m.body.x - w.spawn.x, m.body.z - w.spawn.z) < 20), false, 'none of them at the landing');
  // One goes along its path.
  const g = gangs[0];
  const was = { x: g.camp.x, z: g.camp.z };
  stay(room, time, a, [w.spawn.x, w.spawn.y, w.spawn.z], 5000);
  assert.ok(Math.hypot(g.camp.x - was.x, g.camp.z - was.z) > 1, 'on the move');
  // Near it: it wakes, every one of it out.
  stay(room, time, a, [g.camp.x + 8, ground(w, g.camp.x + 8, g.camp.z), g.camp.z], 300);
  assert.equal(g.awake, true);
  const mine = room.monsters.list.filter((m) => m.camp === g.camp.id);
  assert.equal(mine.length, g.kinds.length);
  // Popped, the whole gang: gone, and another later.
  fight(room, time, a, 120000, (m) => m.camp === g.camp.id, { until: () => !adv.battles.gangs.includes(g) });
  assert.ok(!adv.battles.gangs.includes(g));
  assert.equal(a.fx('gang').length, 1);
  // (Roaming gangs: not those dropping out of the clouds, walking out here.)
  const roaming = () => adv.battles.gangs.filter((o) => !o.drop).length;
  const count = roaming();
  stay(room, time, a, [w.spawn.x, w.spawn.y, w.spawn.z], 80000);
  assert.equal(roaming(), count + 1, 'another, a while later');
});

test('a gang drops out of the clouds on whoever rolls enough of them back, after them at once, and goes back up if left behind', () => {
  const time = { t: 1_000_000 };
  const room = isleRoom(FIRST, time);
  const a = join(room);
  sturdy(room, a);
  const adv = room.adventure;
  const w = room.world;
  // Walking the roads out from the landing, at a walk, into the clouds.
  const tour = adv.battles.roads.flatMap((r) => [...r, ...[...r].reverse()]);
  let at = [w.spawn.x, w.spawn.y, w.spawn.z];
  let k = 0;
  let drop = null;
  for (let t = 0; t < 240000 && !drop; t += 100) {
    let left = 0.46;
    while (left > 0) {
      const [tx, tz] = tour[k % tour.length];
      const d = Math.hypot(tx - at[0], tz - at[2]);
      if (d <= left) {
        at = [tx, 0, tz];
        left -= d;
        k++;
      } else {
        at = [at[0] + ((tx - at[0]) / d) * left, 0, at[2] + ((tz - at[2]) / d) * left];
        left = 0;
      }
    }
    at[1] = ground(w, at[0], at[2]) ?? w.spawn.y;
    stay(room, time, a, at, 100);
    drop = a.fx('cloud').at(-1) ?? null;
  }
  assert.ok(drop, 'a gang dropped out of the clouds');
  assert.equal(drop.to, a.pid, 'on the one who rolled them back');
  const d = Math.hypot(drop.x - at[0], drop.z - at[2]);
  assert.ok(d >= DROP.from[0] - 1 && d <= DROP.from[1] + 1, `a way off them: ${d}`);
  assert.ok(Math.hypot(drop.x - w.spawn.x, drop.z - w.spawn.z) >= GANG.landing - DROP.from[1], 'never at the landing');
  const g = adv.battles.gangs.find((o) => o.drop);
  assert.ok(g && g.awake, 'out at once');
  assert.ok(room.monsters.list.filter((m) => m.camp === g.camp.id).length >= GANG.size);
  // After them: it comes their way.
  const from = Math.hypot(g.camp.x - at[0], g.camp.z - at[2]);
  stay(room, time, a, at, 1500);
  assert.ok(Math.hypot(g.camp.x - at[0], g.camp.z - at[2]) < from, 'after them');
  // No other for a while.
  assert.equal(a.fx('cloud').length, 1);
  // Left far behind, it goes back up into the clouds.
  const far = [g.camp.x < w.W / 2 ? Math.min(w.W - 20, g.camp.x + 90) : Math.max(20, g.camp.x - 90), 0, g.camp.z];
  far[1] = ground(w, far[0], far[2]) ?? w.spawn.y;
  stay(room, time, a, far, GANG.sleepMs + 1000);
  assert.ok(!adv.battles.gangs.includes(g), 'gone back up');
  assert.equal(room.monsters.list.some((m) => m.camp === g.camp.id), false);
});

test('the Storm Gang is tougher against mightier weapons, and bumps harder than other monsters', () => {
  // The first wave of the same ambush, sprung by someone with bare fists
  // and by someone with a Meteor Staff (twelve hearts a bop).
  const wave = (weapon) => {
    const time = { t: 1_000_000 };
    const room = isleRoom(FIRST, time);
    const a = join(room, 'Brave Fox', weapon ? { weapon } : {});
    sturdy(room, a);
    const b = room.adventure.battles.list.find((o) => o.kind === 'ambush');
    stay(room, time, a, [b.prize[0] + 0.5, b.prize[1], b.prize[2] + 0.5], 2500);
    return { room, a, time, list: room.monsters.list.filter((m) => m.camp === b.camp.id) };
  };
  const fist = wave(null);
  const staff = wave('meteorstaff');
  assert.ok(fist.list.length && staff.list.length);
  const kind = fist.list[0].kind;
  const one = fist.list.find((m) => m.kind === kind);
  const two = staff.list.find((m) => m.kind === kind);
  // (Each rounded to whole hearts.)
  const ratio = two.max / one.max;
  assert.ok(ratio >= geared(12) * 0.75 && ratio <= geared(12) * 1.25, `${one.max} → ${two.max}`);
  assert.ok(Math.ceil(two.max / 12) >= 2, 'never popped in one bop of the staff');
  // A bump of theirs: more than a monster's anywhere else.
  const p = fist.room.players.get(fist.a.pid);
  Object.defineProperty(p, 'hp', { value: 100, writable: true, configurable: true });
  fist.room.hurt(fist.a.pid, one, fist.time.t, {});
  assert.equal(p.hp, 100 - BUMP_HP * FIERCE * (kindOf(one.kind).bump ?? 1));
});

// ---------------------------------------------------------------- a restart

test('the clouds rolled back and the battles won are kept over a restart, the island put back as they left it', () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'toon-'));
  const file = joinPath(dir, 'isle.json');
  try {
    const time = { t: 1_000_000 };
    const now = () => time.t;
    const rooms = new Map();
    const make = () => new PublicAdventure({ rooms, file, now, log: () => {} }).start();
    const one = make();
    const { code } = one.newRun('Keen Owl', time.t, 5);
    const run = one.runs.find((r) => r.entry?.code === code);
    const room = run.entry.room;
    const adv = room.adventure;
    const b = adv.battles.list.find((o) => o.kind === 'ambush');
    adv.battles.fog.reveal(b.x, b.z, 30);
    const seen = adv.battles.fog.pack();
    b.done = true;
    b.state = 'done';
    time.t += 60000;
    one.tick(time.t);
    one.keep();
    one.stop();
    const two = make();
    const back = two.runs.find((r) => r.id === run.id).entry.room;
    assert.equal(back.stage, FIRST);
    assert.equal(back.adventure.battles.fog.pack(), seen, 'the clouds where they were');
    assert.deepEqual(back.adventure.doneIds(), [b.id]);
    assert.equal(back.world.get(...b.prize), B.AIR, 'its spark taken');
    assert.equal(back.world.get(...back.adventure.hub.lamps[b.id - 1]), B.LANTERN_LAMP_ON, 'its lamp lit');
    two.stop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the sim on its own: battles by the story, the havens, a pack for the wire', () => {
  const made = buildIsle({ stage: FIRST + 4, seed: 5 });
  const sim = new Battles({ specs: made.battles, story: chapterOf(FIRST + 4), level: 16, roads: made.roads, spawn: made.world.spawn, W: made.world.W, D: made.world.D }, 3);
  assert.deepEqual(sim.list.map((b) => b.name), chapterOf(FIRST + 4).battles.map((b) => b.name));
  assert.deepEqual(sim.list.map((b) => sim.open(b)), [true, true, true, true, false], 'the showdown after the rest');
  assert.deepEqual(sim.havens(9).length, 1, 'only the landing to start with');
  const pack = sim.pack(0);
  assert.equal(pack.length, sim.list.length);
  assert.ok(pack.every((r) => r.length === 5 && r.every(Number.isFinite)));
  assert.equal(CHAPTERS.filter((c) => c.battles).length, 5);
});
