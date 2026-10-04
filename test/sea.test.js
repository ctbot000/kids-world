// The sea creatures: where they start out, never leaving the water (nor the
// edge of it, for crabs), dolphins leaping and the whale spouting, following
// you as far as the water goes; penguins and seals on snowy islands, ashore
// and in the sea; and every animal's model in every state.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CRITTER_TYPES, CritterSim, nearestWater, perchAt, polarCounts, scaleCounts, seaCounts, STATES, SURFACE, waterColumn } from '../public/js/shared/critters.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const SEA = ['fish', 'dolphin', 'whale', 'turtle', 'crab', 'octopus'];
const SWIMMERS = ['fish', 'dolphin', 'whale', 'octopus'];
const FL = Math.floor;
const depth = (w) => (w ? w.top - w.floor : 0);

function island(theme, seed) {
  const { world, critters } = generate({ seed, theme });
  const sim = new CritterSim(seed);
  for (const c of critters) sim.add(c.type, c.x, c.y, c.z);
  return { world, sim, critters };
}

// Days of 8 minutes and nights of 2, in tenths of a second, as the host ticks.
function run(world, sim, minutes, look = () => {}, players = new Map()) {
  for (let i = 0; i < minutes * 600; i++) {
    const t = i / 10;
    const night = t % 600 >= 480;
    sim.step(world, 0.1, t * 1000, players, night);
    for (const c of sim.list) look(c, night, t);
  }
}

// A meadow at y = 5 with a pool dug into it, three deep (water at y 3 to 5),
// over x and z 10 to 17.
function meadowWithPool() {
  const w = new World({ W: 48, H: 32, D: 48, sea: 5 });
  for (let x = 0; x < w.W; x++) {
    for (let z = 0; z < w.D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      const pool = x >= 10 && x <= 17 && z >= 10 && z <= 17;
      for (let y = 1; y <= 5; y++) w.set(x, y, z, pool && y >= 3 ? B.WATER : y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

test('sea creatures start out in the water, out at sea, and on the beach, on islands of every size', () => {
  for (const [theme, size] of [...['sunny', 'snowy', 'candy', 'flat'].map((t) => [t, 'small']), ['sunny', 'big'], ['snowy', 'huge'], ['flat', 'huge']]) {
    const { world, critters } = generate({ seed: 4242, theme, size });
    const counts = { ...scaleCounts(seaCounts(theme), world), ...scaleCounts(polarCounts(theme), world) };
    for (const [type, n] of Object.entries(counts)) assert.equal(critters.filter((c) => c.type === type).length, n, `${theme} ${size} ${type}`);
    for (const c of critters.filter((c) => SEA.includes(c.type))) {
      const w = waterColumn(world, c.x, c.z);
      if (c.type === 'crab' || c.type === 'turtle') {
        const p = perchAt(world, c.x, c.z);
        assert.ok((p?.ground === B.SAND && c.y === p.y) || depth(w) <= 3, `${theme}: a ${c.type} on the beach, or in the shallows`);
      } else {
        assert.equal(world.get(FL(c.x), FL(c.y), FL(c.z)), B.WATER, `${theme}: a ${c.type} in the water`);
        if (c.type === 'dolphin' || c.type === 'whale') assert.ok(w.top === world.sea && depth(w) >= (c.type === 'whale' ? 4 : 3), `${theme}: a ${c.type} out at sea`);
      }
    }
  }
});

test('swimmers never leave the water, crabs never go deeper than its edge, and nobody gets into a block', () => {
  for (const [theme, seed] of [
    ['sunny', 4242],
    ['snowy', 77],
    ['candy', 1],
    ['flat', 999],
  ]) {
    const { world, sim } = island(theme, seed);
    run(world, sim, 20, (c, night, t) => {
      if (!SEA.includes(c.type)) return;
      const where = `${theme}: a ${c.type} at ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)} after ${t.toFixed(1)}s`;
      assert.ok([c.x, c.y, c.z, c.yaw].every(Number.isFinite), `${theme}: a ${c.type} is somewhere`);
      const here = world.get(FL(c.x), FL(c.y), FL(c.z));
      assert.ok(!B.SOLID[here] && !B.SOLID[world.get(FL(c.x), FL(c.y + 0.15), FL(c.z))], `${where} is inside a block`);
      const w = waterColumn(world, c.x, c.z);
      if (SWIMMERS.includes(c.type) && c.state !== 'jump') assert.equal(here, B.WATER, `${where} is out of the water`);
      if (c.type === 'dolphin' && c.state === 'jump') assert.ok(w, `${where} leaps over dry land`);
      if (c.type === 'whale') assert.ok(w?.top === world.sea && depth(w) >= 3, `${where} is in water too shallow for it`);
      if (c.type === 'crab' && here === B.WATER) assert.ok(depth(w) <= 1, `${where} is out of its depth`);
    });
  }
});

test('dolphins leap out of the sea, the whale blows water, and fish jump now and then', () => {
  const { world, sim } = island('sunny', 4242);
  const leaps = new Map();
  let spouts = 0;
  let fishJumps = 0;
  let highest = -Infinity;
  run(world, sim, 8, (c) => {
    if (c.state === 'jump' && c.was !== 'jump') {
      if (c.type === 'dolphin') leaps.set(c.id, (leaps.get(c.id) ?? 0) + 1);
      if (c.type === 'fish') fishJumps++;
    }
    if (c.type === 'dolphin' && c.state === 'jump') highest = Math.max(highest, c.y - (waterColumn(world, c.x, c.z)?.top ?? 0) - SURFACE);
    if (c.type === 'whale' && c.state === 'spout' && c.was !== 'spout') spouts++;
    c.was = c.state;
  });
  assert.equal(leaps.size, 2, 'both dolphins leap');
  for (const n of leaps.values()) assert.ok(n >= 10, `a dolphin leaps ${n} times in a day`);
  assert.ok(highest > 1.5, `up to ${highest.toFixed(2)} out of the water`);
  assert.ok(spouts >= 10, `the whale blows water ${spouts} times in a day`);
  assert.ok(fishJumps >= 5, `${fishJumps} fish jumps`);
});

test('at night the sea goes to sleep', () => {
  const { world, sim } = island('sunny', 4242);
  const awake = new Map();
  run(world, sim, 10, (c, night, t) => {
    // A minute after dusk, everyone has settled.
    if (!SEA.includes(c.type) || !night || t % 600 < 540) return;
    if (c.state !== 'sleep' && !(c.type === 'turtle' && c.state === 'swim')) awake.set(c.type, c.state);
  });
  assert.deepEqual([...awake], [], 'asleep (a turtle afloat just drifts)');
});

test('fed a fruit, a sea creature comes along as far as the water goes, and waits at its edge', () => {
  const w = meadowWithPool();
  const sim = new CritterSim(9);
  const fish = sim.add('fish', 12.5, 4.5, 12.5);
  const me = { x: 18.5, y: 6, z: 13.5, yaw: 0, anim: 0, flying: false, hat: 'none' };
  const players = new Map([[1, me]]);
  let now = 0;
  const step = (n, move = () => {}) => {
    for (let i = 0; i < n; i++) {
      move();
      now += 100;
      sim.step(w, 0.1, now, players, false);
      assert.equal(w.get(FL(fish.x), FL(fish.y), FL(fish.z)), B.WATER, 'never out of the water');
    }
  };
  sim.feed(fish.id, 1, me, now);
  step(60);
  assert.ok(fish.x > 16 && Math.hypot(fish.x - me.x, fish.z - me.z) < 2.5, `it comes over to the edge by you (${fish.x.toFixed(1)}, ${fish.z.toFixed(1)})`);
  // Along the side of the pool, and it keeps up.
  step(40, () => (me.z += 0.1));
  assert.ok(Math.abs(fish.z - me.z) < 2, `it keeps up along the edge (${fish.z.toFixed(1)} for ${me.z.toFixed(1)})`);
  // Away inland: it waits at the edge nearest you.
  me.x = 30;
  step(60);
  assert.ok(fish.x > 16.5, `it waits at the near edge (${fish.x.toFixed(1)})`);
});

test('a crab walks sideways', () => {
  const w = new World({ W: 32, H: 16, D: 32, sea: 2 });
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 0; y <= 4; y++) w.set(x, y, z, y === 0 ? B.MAGIC_FLOOR : y === 4 ? B.SAND : B.STONE);
  const sim = new CritterSim(2);
  const crab = sim.add('crab', 16.5, 5, 16.5);
  let walks = 0;
  for (let i = 0; i < 3000; i++) {
    const [x, z] = [crab.x, crab.z];
    sim.step(w, 0.1, i * 100, new Map(), false);
    const d = Math.hypot(crab.x - x, crab.z - z);
    if (crab.state !== 'walk' || d < 0.05) continue;
    walks++;
    // Facing (sin yaw, cos yaw), moving at right angles to it.
    const along = (Math.sin(crab.yaw) * (crab.x - x) + Math.cos(crab.yaw) * (crab.z - z)) / d;
    assert.ok(Math.abs(along) < 1e-6, `moving ${along.toFixed(3)} of the way it faces`);
  }
  assert.ok(walks > 50, `it walked (${walks} steps)`);
});

test('a swimmer whose water is taken away goes back to the nearest water', () => {
  const w = meadowWithPool();
  // A second, little pond nearby.
  for (let y = 4; y <= 5; y++) w.set(22, y, 12, B.WATER);
  const sim = new CritterSim(4);
  const fish = sim.add('fish', 15.5, 4.5, 12.5);
  for (let x = 10; x <= 17; x++) for (let z = 10; z <= 17; z++) for (let y = 3; y <= 5; y++) w.set(x, y, z, B.AIR);
  sim.step(w, 0.1, 100, new Map(), false);
  assert.deepEqual([fish.x, fish.z], [22.5, 12.5], 'into the little pond');
  assert.equal(w.get(FL(fish.x), FL(fish.y), FL(fish.z)), B.WATER);
});

test('a swimmer is invited at the nearest water it can live in', () => {
  const w = meadowWithPool();
  // Fish swim from 1.25 over the floor (y 2) to 0.3 under the surface (y 5 + SURFACE).
  assert.deepEqual(nearestWater(w, 'fish', 20.5, 13.5), { x: 17.5, y: (2 + 1.25 + 5 + SURFACE - 0.3) / 2, z: 13.5 }, 'the near edge of the pool');
  assert.equal(nearestWater(w, 'whale', 13.5, 13.5), null, 'a pool is no place for a whale');
  assert.equal(nearestWater(w, 'fish', 40.5, 40.5), null, 'nor is dry land for a fish');
});

test('snowy islands have a little colony of penguins and some seals on the shore; others have neither', () => {
  for (const seed of [4242, 1, 77]) {
    const { world, critters } = island('snowy', seed);
    const penguins = critters.filter((c) => c.type === 'penguin');
    const seals = critters.filter((c) => c.type === 'seal');
    assert.equal(penguins.length, 5, `snowy ${seed}: penguins`);
    assert.equal(seals.length, 3, `snowy ${seed}: seals`);
    for (const p of penguins) assert.ok(penguins.some((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) <= 4.5), `snowy ${seed}: a penguin with the others`);
    for (const c of [...penguins, ...seals]) {
      const p = perchAt(world, c.x, c.z);
      assert.equal(c.y, p.y, `a ${c.type} stands on the ground`);
      let sea = false;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) sea ||= waterColumn(world, c.x + dx, c.z + dz)?.top === world.sea;
      assert.ok(sea, `snowy ${seed}: a ${c.type} by the sea`);
    }
  }
  for (const theme of ['sunny', 'candy', 'flat']) {
    assert.equal(island(theme, 4242).critters.filter((c) => c.type === 'penguin' || c.type === 'seal').length, 0, theme);
  }
});

test('penguins and seals go from the shore into the sea and back, dive under it, and never get into a block', () => {
  for (const seed of [4242, 1, 77]) {
    const { world, sim } = island('snowy', seed);
    const tally = { penguin: { land: 0, sea: 0, steps: 0, dives: 0, slides: 0, leaps: 0 }, seal: { land: 0, sea: 0, steps: 0, dives: 0, slides: 0, leaps: 0 } };
    run(world, sim, 10, (c, night, t) => {
      if (c.type !== 'penguin' && c.type !== 'seal') return;
      const k = tally[c.type];
      const where = `snowy ${seed}: a ${c.type} at ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)} after ${t.toFixed(1)}s`;
      const here = world.get(FL(c.x), FL(c.y), FL(c.z));
      assert.ok(!B.SOLID[here] && !B.SOLID[world.get(FL(c.x), FL(c.y + 0.2), FL(c.z))], `${where} is inside a block`);
      if (c.state === 'dive') assert.equal(here, B.WATER, `${where} dives out of the water`);
      const w = waterColumn(world, c.x, c.z);
      if (w && c.y < w.top + 0.5) assert.ok(['dive', 'jump', 'happy'].includes(c.state), `${where} is under water, ${c.state}`);
      if (!night) {
        k.steps++;
        if (here === B.WATER) k.sea++;
        else k.land++;
      }
      if (c.state !== c.was) {
        if (c.state === 'dive') k.dives++;
        if (c.state === 'slide') k.slides++;
        if (c.state === 'jump') k.leaps++;
      }
      c.was = c.state;
    });
    for (const [type, k] of Object.entries(tally)) {
      assert.ok(k.land / k.steps > 0.15 && k.sea / k.steps > 0.15, `snowy ${seed}: ${type}s ashore ${(k.land / k.steps).toFixed(2)} and at sea ${(k.sea / k.steps).toFixed(2)} of the day`);
      assert.ok(k.dives > 5, `snowy ${seed}: ${type}s dive (${k.dives})`);
    }
    assert.ok(tally.penguin.slides > 0, `snowy ${seed}: penguins slide on their tummies`);
    assert.ok(tally.penguin.leaps > 0, `snowy ${seed}: penguins leap out of the water`);
  }
});

test('at night penguins and seals come ashore to sleep', () => {
  // Some islands keep a few swimming all night (4242 has since its mine was
  // dug); this one does not.
  const { world, sim } = island('snowy', 1);
  let asleep = 0;
  let steps = 0;
  run(world, sim, 10, (c, night, t) => {
    // A minute after dusk, for them to get out of the water.
    if ((c.type !== 'penguin' && c.type !== 'seal') || !night || t % 600 < 540) return;
    steps++;
    if (c.state === 'sleep') {
      asleep++;
      assert.notEqual(world.get(FL(c.x), FL(c.y), FL(c.z)), B.WATER, 'asleep on dry land');
    }
  });
  assert.ok(asleep / steps > 0.6, `asleep ${(asleep / steps).toFixed(2)} of the night`);
});

test('every animal can be drawn in every state', () => {
  for (const type of CRITTER_TYPES) {
    for (const theme of ['sunny', 'snowy']) {
      const m = new CritterModel(type, 3, theme);
      for (const state of STATES) {
        for (let i = 0; i < 4; i++) {
          m.group.position.y += 0.05;
          m.update(1 / 60, state, i % 2 === 0, 1);
        }
        m.group.updateMatrixWorld(true);
        m.group.traverse((o) => {
          if (o.isMesh) assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${type} ${state}: every part is somewhere`);
        });
      }
      assert.ok(m.height > 0 && m.pick > 0 && m.seen > 0, `${type} has a size`);
      assert.equal(Boolean(CRITTER_INFO[type]), true);
      m.dispose();
    }
  }
});
