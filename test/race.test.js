// Racing islands: the race track in the middle (an oval of asphalt with
// kerbs, a finish line, nothing standing on it), the go-karts on its grid, a
// kart driven round it, and the lap clock that times it — and that cutting
// across the grass or turning back at the line does not fool.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, VEHICLES } from '../public/js/shared/critters.js';
import { inPark, PARK_HALF } from '../public/js/shared/park.js';
import { BOTS, cleanRace, DONE_MS, GRID, GRID_MS, lapStep, lapTime, onTrack, OVAL, ovalAt, pathAt, ordinal, raceTrack } from '../public/js/shared/race.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { startRide, stepRide } from '../public/js/shared/riding.js';
import { randomIslandName } from '../public/js/shared/words.js';
import { normalizeMeta } from '../public/js/shared/world.js';
import { generate, THEMES } from '../public/js/shared/worldgen.js';

// The point on the oval's centre line `at` of the way round from the line.
function pointAt(at) {
  const { L, R } = OVAL;
  const lap = 4 * L + 2 * Math.PI * R;
  let s = (((at % 1) + 1) % 1) * lap;
  if (s < L) return [-s, R];
  s -= L;
  if (s < Math.PI * R) {
    const a = Math.PI / 2 + s / R;
    return [-L + Math.cos(a) * R, Math.sin(a) * R];
  }
  s -= Math.PI * R;
  if (s < 2 * L) return [-L + s, -R];
  s -= 2 * L;
  if (s < Math.PI * R) {
    const a = -Math.PI / 2 + s / R;
    return [L + Math.cos(a) * R, Math.sin(a) * R];
  }
  return [L - (s - Math.PI * R), R];
}

test('a racing island is a kind of island, saved and named as one, and the go-kart is in the toy box', () => {
  assert.ok(THEMES.some((t) => t.key === 'race' && t.icon === '🏁'));
  assert.equal(normalizeMeta({ theme: 'race' }).theme, 'race');
  for (let i = 0; i < 20; i++) assert.match(randomIslandName('race', Math.random), /^\S+ (Speedway|Raceway|Circuit|Island|Isle|Track)$/);
  assert.ok(VEHICLES.includes('kart'));
  assert.ok(CRITTER_INFO.kart.ride.run > CRITTER_INFO.car.ride.run, 'quicker than the car');
});

test('ovalAt goes round the track the way the karts go, from the finish line', () => {
  for (let k = 0; k < 200; k++) {
    const at = k / 200;
    const [x, z] = pointAt(at);
    const o = ovalAt(x, z);
    assert.ok(Math.abs(o.off) < 1e-9, `on the centre line at ${at}`);
    assert.ok(Math.min(Math.abs(o.at - at), 1 - Math.abs(o.at - at)) < 1e-9, `${o.at} for ${at}`);
  }
  assert.equal(ovalAt(0, OVAL.R + 2).off, 2, 'outside is plus');
  assert.ok(onTrack(0, OVAL.R) && !onTrack(0, 0) && !onTrack(0, OVAL.R + OVAL.W + 1));
});

test('the track: flat asphalt all the way round with nothing on it, kerbs, a finish line, karts on the grid and everyone arriving beside it', () => {
  for (const [seed, size] of [
    [1, 'small'],
    [2, 'small'],
    [77, 'big'],
    [5, 'huge'],
  ]) {
    const where = `${seed} ${size}`;
    const { world, critters } = generate({ seed, theme: 'race', size });
    const cx = Math.floor(world.W / 2);
    const cz = Math.floor(world.D / 2);
    const level = world.sea + 4;
    let line = 0;
    for (let ox = -PARK_HALF; ox <= PARK_HALF; ox++) {
      for (let oz = -PARK_HALF; oz <= PARK_HALF; oz++) {
        const ground = world.get(cx + ox, level, cz + oz);
        assert.ok(B.SOLID[ground], `${where}: ground at ${ox},${oz}`);
        const { off } = ovalAt(ox, oz);
        if (Math.abs(off) > OVAL.W + 1) continue;
        // Nothing on the track or its kerbs, all the way up.
        for (let y = level + 1; y < level + 6; y++) assert.equal(world.get(cx + ox, y, cz + oz), B.AIR, `${where}: clear over ${ox},${oz}`);
        if (Math.abs(off) <= OVAL.W) {
          assert.ok([B.RACE_TRACK, B.CHECKER_FLOOR, B.TOY_BRICKS[11]].includes(ground), `${where}: track at ${ox},${oz}`);
          if (ground === B.CHECKER_FLOOR) line++;
        } else assert.ok([B.TOY_BRICKS[0], B.TOY_BRICKS[11]].includes(ground), `${where}: a kerb at ${ox},${oz}`);
      }
    }
    assert.equal(line, 2 * (2 * OVAL.W), `${where}: the finish line across the track`);
    const karts = critters.filter((c) => c.type === 'kart');
    assert.equal(karts.length, 4, `${where}: karts on the grid`);
    for (const k of karts) {
      const o = ovalAt(k.x - cx - 0.5, k.z - cz - 0.5);
      assert.ok(Math.abs(o.off) < OVAL.W - 0.5 && o.at > 0.9 && k.y === level + 1, `${where}: a kart just behind the line`);
    }
    // Nothing walking about on it to begin with.
    for (const c of critters) if (!CRITTER_INFO[c.type].vehicle && !CRITTER_INFO[c.type].flies) assert.ok(!inPark({ cx, cz }, c.x, c.z), `${where}: the ${c.type} off the square`);
    // No other vehicle parked anywhere on the square.
    for (const c of critters) if (c.type !== 'kart' && CRITTER_INFO[c.type].vehicle) assert.ok(!inPark({ cx, cz }, c.x, c.z, 0), `${where}: the ${c.type} off the square`);
    const s = world.spawn;
    assert.ok(inPark({ cx, cz }, s.x, s.z, 0) && s.y === level + 1 && !onTrack(s.x - cx - 0.5, s.z - cz - 0.5), `${where}: the start beside the track`);
    assert.equal(world.get(Math.floor(s.x), level + 1, Math.floor(s.z)), B.AIR);
  }
});

test('a go-kart driven round the track times its laps, the first one starting at the line', () => {
  const { world, critters } = generate({ seed: 3, theme: 'race' });
  const track = raceTrack(world);
  const kart = critters.find((c) => c.type === 'kart');
  const ride = startRide(world, 'kart', kart);
  const lap = {};
  const heard = [];
  let now = 0;
  for (let t = 0; t < 40; t += 1 / 60) {
    // Steering for a point a little further round, flat out.
    const b = ride.body;
    const { at } = ovalAt(b.x - track.cx, b.z - track.cz);
    const [tx, tz] = pointAt(at + 0.04);
    const dx = tx + track.cx - b.x;
    const dz = tz + track.cz - b.z;
    const d = Math.hypot(dx, dz);
    stepRide(world, ride, { mx: dx / d, mz: dz / d, run: true }, 1 / 60);
    now += 1000 / 60;
    const ev = lapStep(lap, track, b.x, b.y, b.z, now);
    if (ev) heard.push(ev);
    assert.ok(Math.abs(ovalAt(b.x - track.cx, b.z - track.cz).off) < OVAL.W + 1, 'on the track');
  }
  assert.deepEqual(heard[0], { start: true });
  const laps = heard.slice(1);
  assert.ok(laps.length >= 3, `round and round (${laps.length} laps)`);
  for (const l of laps) assert.ok(l.lap > 5000 && l.lap < 15000, `a lap of ${lapTime(l.lap)}`);
  assert.equal(laps[0].best, true, 'the first is the best yet');
  assert.equal(lap.best, Math.min(...laps.map((l) => l.lap)));
});

test('the lap clock is not fooled by cutting across the grass or turning back at the line', () => {
  const track = { cx: 0.5, cz: 0.5, y: 25 };
  const go = (lap, at, now) => {
    const [x, z] = pointAt(at);
    return lapStep(lap, track, x + 0.5, 25, z + 0.5, now);
  };
  // All the way round: a lap.
  let lap = {};
  const steps = (from, to, t0) => {
    const out = [];
    for (let k = 0; k <= 100; k++) {
      const e = go(lap, from + ((to - from) * k) / 100, t0 + k * 100);
      if (e) out.push(e);
    }
    return out;
  };
  assert.deepEqual(steps(0.95, 2.05, 0), [{ start: true }, { lap: 9100, best: true }]);
  // Over the line, then straight across the infield to come back over it.
  lap = {};
  assert.deepEqual(steps(0.95, 1.1, 0), [{ start: true }]);
  for (let k = 0; k < 20; k++) lapStep(lap, track, 0.5, 25, 0.5 - k, 20000 + k * 100);
  assert.deepEqual(steps(0.9, 1.05, 30000), [{ start: true }], 'no lap for a short cut: the clock starts again');
  // Back and forth over the line: nothing.
  lap = {};
  assert.deepEqual([...steps(0.95, 1.05, 0), ...steps(1.05, 0.95, 20000), ...steps(0.95, 1.05, 40000)].filter((e) => e.lap), []);
  // Up in the air over it (a helicopter), nothing at all.
  lap = {};
  const [x, z] = pointAt(0.99);
  lapStep(lap, track, x + 0.5, 40, z + 0.5, 0);
  assert.equal(lap.at, undefined);
  assert.equal(lapTime(23_450), '23.4 s');
  assert.equal(lapTime(65_200), '1:05.2');
  assert.equal(raceTrack({ theme: 'park' }), null);
});

// ---------------------------------------------------------------- races

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

function join(room, name) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

// A racing island with Ann in the front kart on the grid, and Bo on foot.
function raceIsland() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'race', seed: 3, now: time.now });
  const track = raceTrack(room.world);
  const ann = join(room, 'Ann');
  const bo = join(room, 'Bo');
  const karts = room.critters.list.filter((c) => c.type === 'kart');
  const front = karts.find((c) => Math.abs(c.x - (track.cx + GRID[0][0])) < 0.6);
  room.receive(ann, { t: 'm', s: [front.x, front.y, front.z + 1, 0, 0, 0] });
  room.receive(ann, { t: 'critter', op: 'ride', id: front.id });
  assert.equal(front.rider, ann.pid);
  const home = new Map(karts.map((c) => [c.id, { x: c.x, z: c.z }]));
  return { time, room, track, ann, bo, karts, front, home };
}

// Ann driving round at `speed` blocks a second from the front of the grid,
// till the race is over (or `ms` is up).
function drive(room, time, track, ann, speed, ms = 120000) {
  let s = -GRID[0][0];
  for (let t = 0; t < ms && room.race.round?.phase === 'race'; t += 100) {
    s += speed * 0.1;
    const p = pathAt(s);
    room.receive(ann, { t: 'm', s: [track.cx + p.x, track.y, track.cz + p.z, 0, 0, 0] });
    time.t += 100;
    room.tick();
  }
}

const wait = (room, time, ms) => {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.tick();
  }
};

test('a race: called from a go-kart, the computer filling the grid, a countdown, three laps, places, and the karts home again', () => {
  const { time, room, track, ann, bo, karts, front, home } = raceIsland();
  // On foot, no race.
  room.receive(bo, { t: 'race', op: 'start' });
  assert.match(bo.last('notice').text, /go-kart/);
  assert.equal(room.race?.round ?? null, null);
  room.receive(ann, { t: 'race', op: 'start' });
  assert.deepEqual(bo.last('rcfx'), { t: 'rcfx', f: 'start', by: ann.pid });
  let pack = bo.last('rc').s;
  assert.equal(pack.phase, 'grid');
  assert.deepEqual(pack.racers.map((q) => q.name ?? q.pid), [ann.pid, ...BOTS.map((b) => b.name).reverse()], 'Ann, and the computer in the other three karts');
  // The computer's karts lined up on the grid, the quickest at the front.
  const bots = karts.filter((c) => c !== front);
  for (const c of bots) assert.ok(GRID.some(([ox, oz]) => Math.abs(c.x - track.cx - ox) < 0.01 && Math.abs(c.z - track.cz - oz) < 0.01) && c.racing && c.state === 'race');
  room.receive(bo, { t: 'race', op: 'start' });
  // Nobody moves on the grid; then GO.
  wait(room, time, GRID_MS - 500);
  assert.equal(bo.last('rc').s.phase, 'grid');
  for (const c of bots) assert.ok(GRID.some(([ox]) => Math.abs(c.x - track.cx - ox) < 0.01), 'still on the grid');
  wait(room, time, 600);
  assert.ok(bo.all('rcfx').some((m) => m.f === 'go'));
  // Ann, quicker than the computer, wins.
  drive(room, time, track, ann, 11);
  const fx = bo.all('rcfx');
  assert.deepEqual(fx.filter((m) => m.f === 'lap' && m.key === `p${ann.pid}`).map((m) => m.lap), [2, 3]);
  const won = fx.find((m) => m.f === 'finish' && m.key === `p${ann.pid}`);
  assert.equal(won.place, 1);
  assert.ok(won.ms > 20000 && won.ms < 40000, `in ${won.ms} ms`);
  const end = fx.find((m) => m.f === 'end');
  assert.equal(end.why, undefined, 'over with every player over the line');
  assert.deepEqual(end.results.map((q) => q.place), [1, 2, 3, 4]);
  assert.equal(end.results[0].pid, ann.pid);
  // The computer's karts went round the track meanwhile.
  for (const c of bots) {
    assert.ok(Math.abs(ovalAt(c.x - track.cx, c.z - track.cz).off) < OVAL.W, 'on the track');
    assert.ok(Math.hypot(c.x - home.get(c.id).x, c.z - home.get(c.id).z) > 3, 'gone from the grid');
  }
  pack = bo.last('rc').s;
  assert.equal(pack.phase, 'done');
  // And after the podium, back where they were, parked.
  wait(room, time, DONE_MS + 200);
  assert.deepEqual(bo.last('rcfx'), { t: 'rcfx', f: 'over' });
  assert.equal(bo.last('rc').s, null);
  for (const c of bots) assert.deepEqual({ x: c.x, z: c.z, racing: c.racing }, { ...home.get(c.id), racing: false });
});

test('a slow driver is beaten by the computer, and the race waits for them', () => {
  const { time, room, track, ann, bo } = raceIsland();
  room.receive(ann, { t: 'race', op: 'start' });
  wait(room, time, GRID_MS + 100);
  drive(room, time, track, ann, 6);
  const fx = bo.all('rcfx');
  const finishes = fx.filter((m) => m.f === 'finish');
  assert.deepEqual(finishes.map((m) => m.place), [1, 2, 3, 4]);
  assert.ok(finishes[0].key.startsWith('b'), 'the computer first');
  assert.equal(finishes.at(-1).key, `p${ann.pid}`, 'Ann last, but she finished');
  assert.deepEqual(BOTS.map((b) => b.name).reverse(), fx.find((m) => m.f === 'end').results.slice(0, 3).map((q) => q.name), 'quickest first');
});

test('stopping a race, and a race nobody lined up for', () => {
  const { time, room, ann, bo, front } = raceIsland();
  room.receive(ann, { t: 'race', op: 'start' });
  // Only whoever called it (or the owner) stops it.
  room.receive(bo, { t: 'race', op: 'stop' });
  assert.equal(room.race.round.phase, 'grid');
  room.receive(ann, { t: 'race', op: 'stop' });
  assert.equal(bo.last('rcfx').why, 'stopped');
  wait(room, time, DONE_MS + 200);
  assert.equal(room.race.round, null);
  // Called, then out of the kart before GO: no race.
  room.receive(ann, { t: 'race', op: 'start' });
  room.receive(ann, { t: 'critter', op: 'off' });
  assert.equal(front.rider, 0);
  wait(room, time, GRID_MS + 200);
  assert.deepEqual(bo.last('rcfx'), { t: 'rcfx', f: 'end', results: [], why: 'empty' });
  // A newcomer hears of a race going.
  room.receive(ann, { t: 'critter', op: 'ride', id: front.id });
  wait(room, time, DONE_MS + 200);
  room.receive(ann, { t: 'race', op: 'start' });
  const cy = join(room, 'Cy');
  assert.equal(cy.last('welcome').race.phase, 'grid');
  assert.equal(cleanRace(cy.last('welcome').race).racers.length, 4);
  assert.equal(ordinal(1) + ordinal(2) + ordinal(3) + ordinal(11) + ordinal(22), '1st2nd3rd11th22nd');
});
