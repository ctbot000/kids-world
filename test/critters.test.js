// The animal friends that fly: where they start out, getting about without
// flying into anything, day and night, bees and flowers, seagulls up high,
// following you onto your head, and their models' wings.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { CritterModel } from '../public/js/render/critter-models.js';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CritterSim, FLOWERS, headTop, perchAt, skyline } from '../public/js/shared/critters.js';
import { World } from '../public/js/shared/world.js';
import { generate } from '../public/js/shared/worldgen.js';

const FLYERS = ['bird', 'owl', 'bee', 'seagull', 'butterfly'];
const FL = Math.floor;

function island(theme, seed) {
  const { world, critters } = generate({ seed, theme });
  const sim = new CritterSim(seed);
  for (const c of critters) sim.add(c.type, c.x, c.y, c.z);
  return { world, sim };
}

// Days of 8 minutes and nights of 2, in steps of a tenth of a second (as the
// host ticks); look(c, night, t) sees every animal after every step.
function run(world, sim, minutes, look = () => {}, players = new Map()) {
  for (let i = 0; i < minutes * 600; i++) {
    const t = i / 10;
    const night = t % 600 >= 480;
    sim.step(world, 0.1, t * 1000, players, night);
    for (const c of sim.list) look(c, night, t);
  }
}

// A meadow: magic floor, stone, and grass on top at y = 5.
function meadow(W = 48, D = 48) {
  const w = new World({ W, H: 32, D, sea: 3 });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 5; y++) w.set(x, y, z, y === 5 ? B.GRASS : B.STONE);
    }
  }
  return w;
}

// On something: a block underfoot, a flower for the little ones, water for a seagull.
function sitting(world, c) {
  if (B.SOLID[world.get(FL(c.x), FL(c.y - 0.05), FL(c.z))]) return true;
  const here = world.get(FL(c.x), FL(c.y), FL(c.z));
  return (here === B.WATER && CRITTER_INFO[c.type].swims) || (B.KIND[here] === B.K_PLANT && (c.type === 'bee' || c.type === 'butterfly'));
}

test('flying friends start out in the trees, at the flowers and by the sea', () => {
  for (const theme of ['sunny', 'snowy', 'candy', 'flat']) {
    const { world, critters } = generate({ seed: 4242, theme });
    const of = (type) => critters.filter((c) => c.type === type);
    assert.equal(of('bird').length, 3, `${theme} birds`);
    assert.equal(of('owl').length, theme === 'snowy' ? 2 : 1, `${theme} owls`);
    assert.equal(of('bee').length, theme === 'snowy' ? 0 : 3, `${theme} bees`);
    assert.equal(of('seagull').length, 2, `${theme} seagulls`);
    for (const c of [...of('bird'), ...of('owl')]) {
      const p = perchAt(world, c.x, c.z);
      assert.equal(c.y, p.y, `${theme}: a ${c.type} sits right on top of things`);
      if (theme !== 'flat' || c.type === 'owl') assert.equal(p.kind, 'tree', `${theme}: a ${c.type} up a tree`);
    }
    for (const c of of('bee')) assert.ok(perchAt(world, c.x, c.z).flower, `${theme}: a bee at a flower`);
    for (const c of of('seagull')) {
      const p = perchAt(world, c.x, c.z);
      assert.ok(p.kind === 'water' || (p.ground === B.SAND && p.y <= world.sea + 3), `${theme}: a seagull by the sea, not on ${p.kind}`);
    }
  }
});

test('flying friends get about without flying into hills, trees or houses', () => {
  for (const [theme, seed] of [
    ['sunny', 4242],
    ['snowy', 77],
    ['candy', 1],
    ['flat', 999],
  ]) {
    const { world, sim } = island(theme, seed);
    run(world, sim, 20, (c, night, t) => {
      if (!CRITTER_INFO[c.type].flies) return;
      const where = `${theme}: a ${c.type} at ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)} after ${t.toFixed(1)}s`;
      assert.ok([c.x, c.y, c.z, c.yaw].every(Number.isFinite), `${theme}: a ${c.type} is somewhere`);
      assert.ok(c.x >= 0 && c.x <= world.W && c.z >= 0 && c.z <= world.D && c.y >= 1 && c.y <= world.H + 6, `${where} is off the island`);
      const here = world.get(FL(c.x), FL(c.y + 0.15), FL(c.z));
      assert.ok(!B.SOLID[here], `${where} is inside a block`);
      assert.ok(here !== B.WATER || CRITTER_INFO[c.type].swims, `${where} is under water`);
      if (c.state === 'sleep') assert.ok(sitting(world, c), `${where} is asleep in mid-air`);
    });
  }
});

test('owls are up at night and asleep all day; the other flying friends the other way round', () => {
  const { world, sim } = island('sunny', 4242);
  const awake = {};
  run(world, sim, 20, (c, night, t) => {
    // Give them half a minute at dusk and dawn to get home.
    if (!CRITTER_INFO[c.type].flies || (t % 600) % 480 < 30) return;
    const tally = ((awake[c.type] ??= { day: [0, 0], night: [0, 0] })[night ? 'night' : 'day']);
    tally[0] += c.state === 'sleep' ? 0 : 1;
    tally[1]++;
  });
  for (const type of FLYERS) {
    const day = awake[type].day[0] / awake[type].day[1];
    const night = awake[type].night[0] / awake[type].night[1];
    if (type === 'owl') assert.ok(day === 0 && night === 1, `owls are awake ${day} of the day and ${night} of the night`);
    else assert.ok(day === 1 && night === 0, `${type}s are awake ${day} of the day and ${night} of the night`);
  }
});

test('bees go from flower to flower', () => {
  const { world, sim } = island('sunny', 4242);
  let sipping = 0;
  let atFlower = 0;
  const visited = new Map();
  run(world, sim, 8, (c) => {
    if (c.type !== 'bee' || c.state !== 'eat') return;
    sipping++;
    if (FLOWERS.has(world.get(FL(c.x), FL(c.y - 0.5), FL(c.z)))) atFlower++;
    visited.set(c.id, (visited.get(c.id) ?? new Set()).add(`${FL(c.x)},${FL(c.z)}`));
  });
  assert.ok(sipping > 0, 'bees stop at flowers');
  assert.equal(atFlower, sipping, 'always right over one');
  assert.equal(visited.size, 3);
  for (const flowers of visited.values()) assert.ok(flowers.size >= 3, `a bee visits ${flowers.size} flowers`);
});

test('seagulls circle high over the shore, and come down to the beach or the water', () => {
  const { world, sim } = island('sunny', 4242);
  let steps = 0;
  let high = 0;
  const down = new Set();
  run(world, sim, 8, (c) => {
    if (c.type !== 'seagull') return;
    steps++;
    if (c.y - skyline(world, c.x, c.z) > 6) high++;
    if (c.mode === 'perch') down.add(c.state === 'swim' ? 'water' : 'land');
  });
  assert.ok(high / steps > 0.3, `up high ${high} of ${steps} steps`);
  assert.deepEqual([...down].sort(), ['land', 'water']);
});

test('fed a fruit, a flying friend flies along with you, and sits on your head when you stand still', () => {
  const w = meadow();
  const sim = new CritterSim(7);
  const bird = sim.add('bird', 10.5, 6, 10.5);
  const bee = sim.add('bee', 12.5, 6, 10.5);
  const me = { x: 16.5, y: 6, z: 16.5, yaw: 1, anim: 0, flying: false, hat: 'party' };
  const players = new Map([[1, me]]);
  let now = 0;
  const step = (n, move = () => {}) => {
    for (let i = 0; i < n; i++) {
      move();
      now += 100;
      sim.step(w, 0.1, now, players, false);
    }
  };
  sim.feed(bird.id, 1, me, now);
  sim.feed(bee.id, 1, me, now);
  step(60);
  assert.deepEqual([bird.x, bird.y, bird.z], [me.x, me.y + headTop('party'), me.z], 'on top of the party hat');
  assert.equal(bird.state, 'idle');
  assert.equal(bird.yaw, me.yaw, 'looking the same way');
  assert.equal(bee.onHead, 0, 'one friend to a head');
  assert.equal(bee.state, 'fly');
  assert.ok(Math.hypot(bee.x - me.x, bee.z - me.z) < 1.2, 'the other buzzes round');
  // Off for a walk: it takes off and keeps up.
  me.anim = 1;
  let far = 0;
  step(40, () => {
    me.x += 0.46;
    far = Math.max(far, Math.hypot(bird.x - me.x, bird.z - me.z));
  });
  assert.equal(bird.onHead, 0);
  assert.ok(far < 3.5, `it keeps up (${far.toFixed(1)} behind at most)`);
  // Up into the sky, and it comes too.
  me.anim = 5;
  me.flying = true;
  step(30, () => (me.y += 0.5));
  assert.ok(Math.abs(bird.y - me.y) < 4, `it flies up too (${bird.y.toFixed(1)} for ${me.y.toFixed(1)})`);
  // Down and still again: back on top, with no hat this time.
  me.y = 6;
  me.anim = 0;
  me.flying = false;
  me.hat = 'none';
  step(40);
  assert.deepEqual([bird.x, bird.y, bird.z], [me.x, me.y + headTop('none'), me.z]);
  // After a minute it goes back to its own life, somewhere to sit.
  step(450);
  assert.equal(bird.follow, 0);
  assert.equal(bird.onHead, 0);
  step(100);
  assert.equal(bird.mode, 'perch');
  assert.ok(sitting(w, bird), 'it lands somewhere');
});

test('a flying friend whose seat is taken away flies off and sits somewhere else', () => {
  const w = meadow();
  for (let y = 6; y <= 8; y++) w.set(20, y, 20, B.PLANKS);
  const sim = new CritterSim(3);
  const bird = sim.add('bird', 20.5, 9, 20.5);
  bird.timer = 1000;
  sim.step(w, 0.1, 100, new Map(), false);
  assert.equal(bird.mode, 'perch');
  assert.equal(bird.perch, 'block');
  for (let y = 6; y <= 8; y++) w.set(20, y, 20, B.AIR);
  sim.step(w, 0.1, 200, new Map(), false);
  assert.equal(bird.mode, 'fly', 'off it goes');
  for (let i = 0; i < 100; i++) {
    sim.step(w, 0.1, 300 + i * 100, new Map(), false);
    if (bird.mode === 'perch') assert.ok(sitting(w, bird), 'never sitting on thin air');
  }
});

test('flying friends in a house stay indoors', () => {
  const w = meadow();
  // Walls round x and z 18 to 22, three high, and a roof.
  for (let x = 18; x <= 22; x++) {
    for (let z = 18; z <= 22; z++) {
      for (let y = 6; y <= 8; y++) if (x === 18 || x === 22 || z === 18 || z === 22) w.set(x, y, z, B.BRICK_WALL);
      w.set(x, 9, z, B.PLANKS);
    }
  }
  const sim = new CritterSim(5);
  for (const type of FLYERS) sim.add(type, 20.5, 6, 20.5);
  run(w, sim, 10, (c) => {
    assert.ok(c.x > 19 && c.x < 22 && c.z > 19 && c.z < 22 && c.y >= 6 && c.y < 9, `a ${c.type} is still inside: ${c.x},${c.y},${c.z}`);
  });
});

test('an owl wakes up and flies between the trees at night', () => {
  const w = meadow();
  // Two trees, ten apart: a trunk and a bush of leaves on top.
  for (const tx of [15, 25]) {
    for (let y = 6; y <= 8; y++) w.set(tx, y, 20, B.WOOD);
    for (let x = tx - 1; x <= tx + 1; x++) for (let z = 19; z <= 21; z++) w.set(x, 9, z, B.LEAVES);
  }
  const sim = new CritterSim(11);
  const owl = sim.add('owl', 20.5, 6, 25.5);
  const trees = new Set();
  // Into the night and out the other side, to the next morning.
  run(w, sim, 11, (c, night) => {
    if (c.mode !== 'perch') return;
    if (!night) assert.equal(c.state, 'sleep', 'asleep by day');
    if (perchAt(w, c.x, c.z)?.kind === 'tree' && c.y === 10) trees.add(Math.round(c.x) < 20 ? 'west' : 'east');
  });
  assert.equal(owl.state, 'sleep');
  assert.equal(perchAt(w, owl.x, owl.z).kind, 'tree', 'it sleeps up a tree');
  assert.deepEqual([...trees].sort(), ['east', 'west'], 'it has been in both trees');
});

test('every flying model beats both wings together, up and down alike', () => {
  for (const type of FLYERS) {
    const m = new CritterModel(type, 1);
    m.time = 0;
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < 40; i++) {
      // Climbing: a seagull only beats its wings to climb, and glides otherwise.
      m.group.position.y += 0.02;
      m.update(0.013, 'fly', true, 2);
      // Each wing tip, where the wing hangs from (its parent: the body, or the pivot that leans).
      const [left, right] = m.wings.map((w) => new THREE.Vector3(w.userData.wing * 0.1, 0, 0).applyEuler(w.rotation).add(w.position));
      assert.ok(Math.abs(left.y - right.y) < 1e-9 && Math.abs(left.x + right.x) < 1e-9 && Math.abs(left.z - right.z) < 1e-9, `${type}: wings mirror each other`);
      low = Math.min(low, left.y);
      high = Math.max(high, left.y);
    }
    assert.ok(high - low > 0.02, `${type}: wings beat (${(high - low).toFixed(3)})`);
  }
  // Sitting, a butterfly holds its wings up together.
  const butterfly = new CritterModel('butterfly', 1);
  butterfly.update(0.1, 'idle', false, 0);
  for (const w of butterfly.wings) assert.ok(new THREE.Vector3(w.userData.wing * 0.1, 0, 0).applyEuler(w.rotation).y > 0.06);
});
