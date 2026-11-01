// Fishing from the shore: where the bobber can land, what comes up on the
// line and how often, when a fish bites and lets go, the island passing a
// cast and a reel on to everyone else, the fish in the basket and the shop,
// and the rod in a fisher's hand with the line out to the bobber.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BITE_FOR_MS, BITE_MS, biteWait, canFloat, CAST_FAR, castSpot, CATCHES, catchFor, lineState } from '../public/js/shared/fishing.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { sellPrice } from '../public/js/shared/shop.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { World } from '../public/js/shared/world.js';

const THREE = await import('../public/vendor/three.module.js');
const { ANIM, Avatar } = await import('../public/js/render/avatar.js');
const { FishingLine, ROD_LEN } = await import('../public/js/render/fishing-rod.js');

// A beach along x = 8: sand on the shore side (x < 8), the sea out to +x,
// its water at y = 4 under open air.
function shore() {
  const w = new World({ W: 24, H: 16, D: 24, sea: 4 });
  for (let x = 0; x < 24; x++) {
    for (let z = 0; z < 24; z++) {
      for (let y = 1; y <= 3; y++) w.set(x, y, z, B.SAND);
      if (x < 8) w.set(x, 4, z, B.SAND);
      else w.set(x, 4, z, B.WATER);
    }
  }
  return w;
}
const EAST = Math.PI / 2;

test('the bobber lands on the water in front of you, as far out as it goes', () => {
  const w = shore();
  const body = { x: 6.5, y: 5, z: 10.5 };
  assert.deepEqual(castSpot(w, body, EAST), { x: 12, y: 4, z: 10 }, 'six blocks out, on the water');
  assert.equal(castSpot(w, body, -EAST), null, 'facing the land: no water');
  assert.equal(castSpot(w, { x: 1.5, y: 5, z: 10.5 }, EAST), null, 'too far back from the water');
  // A wall in front stops the cast short; a boat on the water too.
  w.set(10, 5, 10, B.STONE);
  assert.deepEqual(castSpot(w, body, EAST), { x: 9, y: 4, z: 10 }, 'up to the wall');
  w.set(9, 5, 10, B.STONE);
  assert.deepEqual(castSpot(w, body, EAST), { x: 8, y: 4, z: 10 }, 'the water before the wall');
  // A low wall the line goes over; a tall one stops it.
  w.set(8, 5, 10, B.STONE);
  assert.deepEqual(castSpot(w, body, EAST), { x: 12, y: 4, z: 10 }, 'over low walls, out onto the water past them');
  w.set(8, 6, 10, B.STONE);
  assert.equal(castSpot(w, body, EAST), null, 'walled off');
  // Water under something: no bobber floats there.
  const pond = shore();
  for (let x = 8; x < 24; x++) pond.set(x, 5, 9, B.GLASS);
  assert.ok(castSpot(pond, body, EAST), 'open water beside');
  assert.ok(!canFloat(pond, [10, 4, 9], [6.5, 5, 9.5]), 'under glass');
  assert.ok(canFloat(pond, [10, 4, 10], [6.5, 5, 10.5]), 'open water in reach');
  assert.ok(!canFloat(pond, [10, 4, 10], [10.5 - CAST_FAR - 4, 5, 10.5]), 'out of reach');
  assert.ok(!canFloat(pond, [2, 4, 10], [2.5, 5, 10.5]), 'sand is no water');
  assert.ok(!canFloat(pond, ['a', 4, 10], [2.5, 5, 10.5]) && !canFloat(pond, null, [0, 0, 0]), 'nonsense');
});

test('a bite comes after a wait, lasts a moment, and then the fish lets go', () => {
  assert.equal(biteWait(0), BITE_MS[0]);
  assert.equal(biteWait(1), BITE_MS[1]);
  const line = { biteAt: 5000 };
  assert.equal(lineState(line, 4999), 'wait');
  assert.equal(lineState(line, 5000), 'bite');
  assert.equal(lineState(line, 5000 + BITE_FOR_MS - 1), 'bite');
  assert.equal(lineState(line, 5000 + BITE_FOR_MS), 'gone');
});

test('mostly fish come up, each a length of its kind, now and then something else', () => {
  const seen = new Map();
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const c = catchFor((i + 0.5) / N, (i * 7919) % N / N);
    seen.set(c.key, (seen.get(c.key) ?? 0) + 1);
    if (c.basket === 'fish') assert.ok(c.length >= c.cm[0] && c.length <= c.cm[1] && Number.isInteger(c.length), `${c.key} ${c.length} cm`);
    else assert.equal(c.length, 0);
  }
  assert.deepEqual([...seen.keys()].sort(), CATCHES.map((c) => c.key).sort(), 'everything comes up sometime');
  const fish = CATCHES.filter((c) => c.basket === 'fish').reduce((n, c) => n + seen.get(c.key), 0);
  assert.ok(fish / N > 0.8, 'mostly fish');
  assert.ok(seen.get('pearl') < seen.get('shell') && seen.get('goldfish') < seen.get('minnow'), 'rare ones rarer');
  assert.equal(catchFor(0.9999999).key, CATCHES.at(-1).key, 'the very end of the range');
  // What goes in the basket is something the basket has room for.
  for (const c of CATCHES) if (c.basket) assert.ok(B.COLLECTABLES.some((k) => k.key === c.basket), c.key);
});

test('a fish is a basket treasure that sells, with stickers for catching them', () => {
  const fish = B.COLLECTABLES.find((c) => c.key === 'fish');
  assert.equal(fish.item, B.FISH);
  assert.equal(B.block(B.FISH).collect, 'fish');
  assert.equal(B.block(B.FISH).kind, 'item');
  assert.equal(sellPrice('fish', 1), 2);
  assert.ok(STAT_KEYS.includes('fished'));
  const got = STICKERS.filter((s) => s.test({ fished: 250 }) && !s.test({ fished: 0 }));
  assert.deepEqual(got.map((s) => s.key), ['gone-fishing', 'angler', 'master-angler']);
});

test('a cast and a reel are passed on to everyone else, a cast only onto open water in reach', () => {
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
  const w = room.world;
  // Open water two steps from where they stand.
  const [x, z] = [Math.floor(p.s[0]) + 2, Math.floor(p.s[2])];
  const y = Math.floor(p.s[1]) - 1;
  w.set(x, y, z, B.WATER);
  w.set(x, y + 1, z, B.AIR);
  room.receive(a, { t: 'rod', op: 'cast', at: [x, y, z] });
  assert.deepEqual(b.all('rod'), [{ t: 'rod', pid, op: 'cast', at: [x, y, z] }]);
  assert.equal(a.all('rod').length, 0, 'the caster draws their own line already');
  room.receive(a, { t: 'rod', op: 'reel', caught: 'trout' });
  assert.deepEqual(b.all('rod')[1], { t: 'rod', pid, op: 'reel', caught: 'trout' });
  room.receive(a, { t: 'rod', op: 'reel', caught: { no: 1 } });
  assert.equal(b.all('rod')[2].caught, '', 'a catch is a word or nothing');
  // Not water, under a roof, or too far: no line for anyone.
  w.set(x, y, z, B.STONE);
  room.receive(a, { t: 'rod', op: 'cast', at: [x, y, z] });
  w.set(x, y, z, B.WATER);
  w.set(x, y + 1, z, B.STONE);
  room.receive(a, { t: 'rod', op: 'cast', at: [x, y, z] });
  w.set(x, y + 1, z, B.AIR);
  p.s = [x + 20, y, z];
  room.receive(a, { t: 'rod', op: 'cast', at: [x, y, z] });
  room.receive(a, { t: 'rod', op: 'wiggle' });
  assert.equal(b.all('rod').length, 3, 'nothing more passed on');
});

test('fishing, the rod is in your hand pointing out over the water, its line out to the bobber', () => {
  const a = new Avatar({ animal: 'bunny', fur: 'white', shirt: 1, hat: 'none', weapon: 'sword' });
  const scene = new THREE.Scene();
  scene.add(a.root);
  for (let i = 0; i < 3; i++) a.update(0.1, ANIM.idle, 0);
  assert.equal(a.rodTip(), null, 'no rod till you fish');
  for (let i = 0; i < 3; i++) a.update(0.1, ANIM.fish, 0);
  a.root.updateMatrixWorld(true);
  const tip = a.rodTip();
  assert.ok(tip, 'a rod out');
  const hand = a.hands[1].getWorldPosition(new THREE.Vector3());
  const grip = a.rod.getWorldPosition(new THREE.Vector3());
  assert.ok(grip.distanceTo(hand) < 0.06, `the grip in the hand (${grip.distanceTo(hand).toFixed(3)} off)`);
  assert.ok(tip.z > hand.z + 0.5 && tip.y > hand.y + 0.5, 'the tip out in front and up');
  assert.ok(Math.abs(tip.distanceTo(grip) - ROD_LEN * a.size) < 0.05, 'a rod as long as it is');
  assert.ok(!a.weapon.parent, 'the sword put away meanwhile');
  // A bite tips the rod down towards the water.
  a.rodDip = 1;
  a.update(0.1, ANIM.fish, 0);
  a.root.updateMatrixWorld(true);
  assert.ok(a.rodTip().y < tip.y, 'dipped');
  // Back to standing: the rod away and the sword back in hand.
  a.update(0.1, ANIM.idle, 0);
  assert.equal(a.rodTip(), null);
  assert.ok(a.weapon.parent, 'the sword back');

  // The line: the bobber flies out in an arc, then floats on the water,
  // and dips under while a fish has it; the line runs from the tip to it.
  const line = new FishingLine(scene, { x: 5, y: 4, z: 9 });
  const from = new THREE.Vector3(5.5, 6, 5);
  line.update(from, line.flight / 2, 0, false);
  assert.ok(line.bobber.position.y > 6, 'up in the air on its way');
  line.update(from, line.flight, 1, false);
  const floating = line.bobber.position.y;
  assert.ok(Math.abs(floating - (4 + 0.92)) < 0.05, `floating on the water (${floating})`);
  line.update(from, 0.1, 1.05, true);
  assert.ok(line.bobber.position.y < floating - 0.1, 'under, with a fish on');
  const pos = line.line.geometry.attributes.position;
  assert.ok(Math.hypot(pos.getX(0) - from.x, pos.getY(0) - from.y, pos.getZ(0) - from.z) < 1e-4, 'from the tip');
  const last = pos.count - 1;
  assert.ok(Math.hypot(pos.getX(last) - line.bobber.position.x, pos.getZ(last) - line.bobber.position.z) < 1e-4, 'to the bobber');
  line.dispose();
  assert.ok(!line.bobber.parent && !line.line.parent, 'gone when reeled in');
});
