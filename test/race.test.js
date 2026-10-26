// Racing islands: the race track in the middle (an oval of asphalt with
// kerbs, a finish line, nothing standing on it), the go-karts on its grid, a
// kart driven round it, and the lap clock that times it — and that cutting
// across the grass or turning back at the line does not fool.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, VEHICLES } from '../public/js/shared/critters.js';
import { inPark, PARK_HALF } from '../public/js/shared/park.js';
import { lapStep, lapTime, onTrack, OVAL, ovalAt, raceTrack } from '../public/js/shared/race.js';
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
