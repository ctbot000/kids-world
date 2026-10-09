// Keeping things out of each other: people, animals, monsters and pets each
// step out of whatever they walk into, never through a wall to do it, and
// two in the very same spot go opposite ways.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { critterBox, CritterSim } from '../public/js/shared/critters.js';
import { MonsterSim } from '../public/js/shared/monsters.js';
import { BODY, keepApart, makeBody, pushOut, stepBody } from '../public/js/shared/physics.js';
import { World } from '../public/js/shared/world.js';

// Grass on top at y = 5, so standing at 6.
function meadow(W = 48, D = 48) {
  const w = new World({ W, H: 32, D, sea: 3 });
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < 5; y++) w.set(x, y, z, B.STONE);
      w.set(x, 5, z, B.GRASS);
    }
  }
  return w;
}

const person = (x, z, key, y = 6) => ({ x, y, z, radius: BODY.radius, height: BODY.height, key });
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('a player walking into another stops against them, and slides round', () => {
  const w = meadow();
  const b = makeBody(10.5, 6, 20.5);
  const friend = person(14.5, 20.55, 'p2');
  let least = Infinity;
  for (let i = 0; i < 120; i++) {
    stepBody(w, b, { mx: 1, mz: 0 }, 1 / 60);
    keepApart(w, b, [friend], 'p1');
    least = Math.min(least, gap(b, friend));
  }
  assert.ok(least >= BODY.radius * 2 - 1e-6, `never in them (${least})`);
  // Pushed off to the side, it gets on past them.
  assert.ok(b.x > 15, `went on round them (${b.x})`);
});

test('two in the very same spot go opposite ways', () => {
  const a = person(10, 10, 'p1');
  const c = person(10, 10, 'p2');
  const pa = pushOut(a, [c], 'p1');
  const pc = pushOut(c, [a], 'p2');
  assert.ok(Math.hypot(pa.dx, pa.dz) > 0.5);
  assert.ok(Math.abs(pa.dx + pc.dx) < 1e-9 && Math.abs(pa.dz + pc.dz) < 1e-9);
});

test('feet over the middle of the other is standing on it, not in it', () => {
  const blob = { x: 10, y: 6, z: 10, radius: 0.42, height: 0.8, key: 'm1' };
  assert.deepEqual(pushOut(person(10.1, 10, 'p1', 6.5), [blob], 'p1'), { dx: 0, dz: 0 });
  const inIt = pushOut(person(10.1, 10, 'p1', 6.2), [blob], 'p1');
  assert.ok(inIt.dx > 0.6);
});

test('nobody is pushed through a wall', () => {
  const w = meadow();
  for (let y = 6; y < 9; y++) for (let z = 0; z < 48; z++) w.set(12, y, z, B.STONE);
  const b = makeBody(11.69, 6, 20.5);
  keepApart(w, b, [person(11.5, 20.5, 'p2')], 'p1');
  assert.ok(b.x + b.radius <= 12, `still this side of it (${b.x})`);
});

test('animals step out of players and each other, and leave ridden ones and vehicles be', () => {
  const w = meadow();
  const sim = new CritterSim(3);
  const sheep = sim.add('sheep', 20.5, 6, 20.5);
  const bunny = sim.add('bunny', 20.6, 6, 20.5);
  const pony = sim.add('pony', 30.5, 6, 30.5);
  const car = sim.add('car', 10.5, 6, 10.5);
  const ridden = sim.add('cow', 40.5, 6, 40.5);
  ridden.rider = 7;
  const people = [person(30.6, 30.5, 'p1'), person(10.7, 10.5, 'p2'), person(40.6, 40.5, 'p7')];
  sim.keepApart(w, people);
  assert.ok(gap(sheep, bunny) >= critterBox('sheep').radius + critterBox('bunny').radius - 1e-6);
  assert.ok(gap(pony, people[0]) >= critterBox('pony').radius + BODY.radius - 1e-6);
  assert.ok(pony.body && gap(pony.body, pony) < 1e-9, 'its body went with it');
  assert.deepEqual([car.x, car.z], [10.5, 10.5]);
  assert.deepEqual([ridden.x, ridden.z], [40.5, 40.5]);
  // Flying friends go over everyone.
  assert.equal(critterBox('butterfly'), null);
});

test('monsters step out of each other, still near enough to bump who they are after', () => {
  const w = meadow();
  const sim = new MonsterSim(5);
  const a = sim.add(w, 20.5, 6, 20.5);
  const b = sim.add(w, 20.6, 6, 20.5);
  const p = person(20.5, 21, 'p1');
  // A crowd sorts itself out over a few ticks of the host.
  for (let i = 0; i < 5; i++) sim.keepApart(w, [p]);
  assert.ok(gap(a.body, b.body) >= a.body.radius + b.body.radius - 0.01);
  for (const m of [a, b]) assert.ok(gap(m.body, p) >= m.body.radius + BODY.radius - 0.01);
  // The bump reaches a little further than that.
  const now = 1e6;
  const people = [{ id: 1, x: p.x, y: p.y, z: p.z, flying: false, riding: false, safeUntil: 0, dizzy: false }];
  let bumped = false;
  for (let i = 0; i < 100 && !bumped; i++) {
    bumped = sim.step(w, 0.05, now + i * 50, people, false, { roam: false }).length > 0;
    sim.keepApart(w, [p]);
  }
  assert.ok(bumped);
});
