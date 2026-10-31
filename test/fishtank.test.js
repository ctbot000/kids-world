// Feeding the fish in the fish tanks and goldfish bowls: the tank beside you
// found; where each flake of a pinch lands, the same for everyone; the island
// passing a pinch on to everyone on it, and saying when the fish are full;
// and the model's flakes and darting fish.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { FEED_MS, feedTank, FED_FOR_MS, FLAKES, flakeLayout, isTank, tankNear } from '../public/js/shared/fishtank.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

const THREE = await import('../public/vendor/three.module.js');
const { tankMaterials, tankModel, TANK, BOWL } = await import('../public/js/render/fishtank-model.js');

test('a fish tank and a fish bowl are tanks, and the one beside you is found', () => {
  for (const id of [B.FISH_TANK, B.FISH_BOWL]) assert.ok(isTank(id), 'a tank');
  for (const id of [B.AIR, B.STONE, B.CUCKOO_CLOCK, B.PIANO]) assert.ok(!isTank(id));
  const w = new World({ W: 16, H: 16, D: 16, sea: 1 });
  w.set(8, 5, 8, B.FISH_TANK);
  const near = tankNear(w, { x: 8.5, y: 5, z: 6.9 });
  assert.deepEqual({ x: near.x, y: near.y, z: near.z, kind: near.kind }, { x: 8, y: 5, z: 8, kind: 'fish-tank' });
  assert.equal(tankNear(w, { x: 8.5, y: 5, z: 4.5 }), null, 'too far');
  assert.equal(tankNear(w, { x: 8.5, y: 9, z: 7 }), null, 'up above it');
  w.set(8, 5, 8, B.FISH_BOWL);
  assert.equal(tankNear(w, { x: 8.5, y: 5, z: 6.9 }).kind, 'fish-bowl');
  // One row above your feet too: the tank stands on its own cabinet.
  w.set(8, 5, 8, B.AIR);
  w.set(8, 6, 8, B.FISH_BOWL);
  const above = tankNear(w, { x: 8.5, y: 5, z: 6.9 });
  assert.ok(above && above.x === 8 && above.y === 6 && above.z === 8, 'found above your feet');
});

test('the flakes of a pinch land spread over the water, the same every time', () => {
  for (const kind of ['fish-tank', 'fish-bowl']) {
    const flakes = flakeLayout(kind);
    assert.equal(flakes.length, FLAKES, kind);
    assert.deepEqual(flakeLayout(kind), flakes, `${kind}: the same every time`);
    assert.ok(new Set(flakes.map((f) => `${f.x},${f.z}`)).size >= FLAKES / 2, `${kind}: not all in one spot`);
    for (const f of flakes) {
      assert.ok(f.t >= 0 && f.t <= FEED_MS / 1000 - 1, `${kind}: it comes down during the feeding`);
      if (kind === 'fish-bowl') assert.ok(Math.hypot(f.x, f.z) < BOWL.r * 0.6, `${kind}: on the water`);
      else assert.ok(Math.abs(f.x) < TANK.x && Math.abs(f.z) < TANK.z + 0.05, `${kind}: on the water`);
    }
  }
});

test('a tank may be fed again only once its fish are no longer full', () => {
  const fed = new Map();
  const now = 1_000_000;
  assert.deepEqual(feedTank({ x: 1, y: 2, z: 3 }, fed, now), { at: now });
  assert.equal(feedTank({ x: 1, y: 2, z: 3 }, fed, now + 1000).full, true, 'right away, full');
  assert.equal(feedTank({ x: 1, y: 2, z: 3, key: '1,2,3' }, fed, now + FED_FOR_MS - 1).full, true, 'still full');
  assert.deepEqual(feedTank({ x: 1, y: 2, z: 3 }, fed, now + FED_FOR_MS), { at: now + FED_FOR_MS }, 'a few minutes later');
  // Another tank is its own fish.
  assert.deepEqual(feedTank({ x: 4, y: 5, z: 6 }, fed, now + 1000), { at: now + 1000 });
});

test('a pinch is passed on to everyone on the island, and a full tank says so to its feeder only', () => {
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42 });
  const conn = () => {
    const c = { inbox: [] };
    c.send = (text) => c.inbox.push(JSON.parse(text));
    c.close = () => {};
    c.all = (t) => c.inbox.filter((m) => m.t === t);
    room.attach(c);
    room.receive(c, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat' } });
    return c;
  };
  const a = conn();
  const b = conn();
  const pid = a.inbox.find((m) => m.t === 'welcome').you;
  const p = room.players.get(pid);
  const [x, z] = [Math.floor(p.s[0]) + 2, Math.floor(p.s[2])];
  const y = room.world.top(x, z) + 1;
  room.world.set(x, y, z, B.FISH_TANK);
  p.s = [x - 0.5, y, z + 0.5];
  room.receive(a, { t: 'fish', at: [x, y, z] });
  assert.deepEqual(b.all('fish'), [{ t: 'fish', pid, at: [x, y, z] }]);
  assert.deepEqual(a.all('fish'), [{ t: 'fish', pid, at: [x, y, z] }], 'back to the feeder too, who sees the pinch with everyone');
  // Too soon: only the feeder is told the fish are full, and no one sees more flakes.
  room.receive(a, { t: 'fish', at: [x, y, z] });
  assert.equal(b.all('fish').length, 1, 'no second pinch for friends');
  assert.ok(a.all('notice').some((m) => /full/.test(m.text)), 'the feeder is told the fish are full');
  // Not at a tank, not from far away: nothing at all.
  const notices = a.all('notice').length;
  room.world.set(x, y, z, B.PIANO);
  room.receive(a, { t: 'fish', at: [x, y, z] });
  assert.equal(a.all('notice').length, notices, 'no notice for what is not a tank');
  room.world.set(x, y, z, B.FISH_TANK);
  p.s = [x + 8, y, z];
  room.receive(a, { t: 'fish', at: [x, y, z] });
  assert.equal(b.all('fish').length, 1, 'no pinch from far away');
});

test('the model: a pinch of flakes comes down, the fish dart over and eat them all up', () => {
  for (const kind of ['fish-tank', 'fish-bowl']) {
    const model = tankModel(tankMaterials(), kind);
    const fish = model.children.filter((o) => o.userData.tail);
    const flakes = model.userData.flakes;
    assert.equal(flakes.length, FLAKES, kind);
    // Nothing shows before anyone feeds, and the whole thing fits its cell.
    model.userData.tick(0);
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model);
    assert.ok(size.max.y <= 1 && size.min.y >= -1e-6 && size.min.x >= -0.5 && size.max.x <= 0.5 && size.min.z >= -0.5 && size.max.z <= 0.5, `${kind}: fits its cell as built`);
    // Feed it, and every flake comes down onto the water, is darted over to,
    // and ends up nibbled away.
    model.userData.feed();
    const ever = new Set();
    let darted = false;
    const homes = fish.map((f) => f.position.clone());
    for (let t = 0.016; t < FEED_MS / 1000 + 2; t += 0.05) {
      model.userData.tick(t);
      model.updateMatrixWorld(true);
      flakes.forEach((f, i) => f.m.visible && ever.add(i));
      for (const f of fish) {
        if (flakes.some((fl) => fl.m.visible && Math.hypot(f.position.x - fl.x, f.position.z - fl.z) < 0.05)) darted = true;
      }
    }
    assert.equal(ever.size, FLAKES, `${kind}: every flake comes down`);
    assert.ok(darted, `${kind}: the fish dart over to them`);
    assert.ok(flakes.every((f) => !f.m.visible), `${kind}: every flake nibbled up`);
    assert.ok(fish.some((f, i) => f.position.distanceTo(homes[i]) > 0.05), `${kind}: the fish back to swimming`);
  }
});

test('a bowl has no bubbles going up outside its glass; a tank\'s rise inside it', () => {
  const materials = tankMaterials();
  const bubbles = (g) => g.children.filter((m) => m.material === materials.bubble);
  const bowl = tankModel(materials, 'fish-bowl');
  bowl.userData.tick(3.7);
  for (const b of bubbles(bowl)) {
    assert.ok(Math.hypot(b.position.x, b.position.z) < BOWL.r && b.position.y < BOWL.top, `a bubble outside the bowl at ${b.position.x}, ${b.position.y}, ${b.position.z}`);
  }
  const tank = tankModel(materials, 'fish-tank');
  tank.userData.tick(3.7);
  assert.equal(bubbles(tank).length, 5);
  for (const b of bubbles(tank)) assert.ok(Math.abs(b.position.x) < TANK.x && b.position.y <= TANK.y1, 'inside the tank');
});
