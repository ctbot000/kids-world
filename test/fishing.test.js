// Fishing from the shore: where the bobber can land, what comes up on the
// line and how often, when a fish bites and lets go, the island passing a
// cast and a reel on to everyone else, the fish in the basket and the shop,
// and the rod in a fisher's hand with the line out to the bobber.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { BITE_MS, canFloat, CAST_FAR, castSpot, CATCHES, catchFor, FIGHT, fightStep, lineState, newFight, NIBBLE_MS, NIBBLES, planBites, STRIKE_MS } from '../public/js/shared/fishing.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { sellPrice } from '../public/js/shared/shop.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { World } from '../public/js/shared/world.js';

const THREE = await import('../public/vendor/three.module.js');
const { ANIM, Avatar } = await import('../public/js/render/avatar.js');
const { drawnLength, fishModel, FishingLine, ROD_LEN } = await import('../public/js/render/fishing-rod.js');

// A seeded random number generator (0-1), the same run every time.
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

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

test('a fish nibbles a few times first, then bites, and swims off if you are too slow', () => {
  const r = seeded(7);
  const counts = new Set();
  for (let k = 0; k < 200; k++) {
    const now = 10_000 * k;
    const line = planBites(r, now);
    counts.add(line.nibbles.length);
    assert.ok(line.strikeAt >= now + BITE_MS[0] && line.strikeAt <= now + BITE_MS[1], 'bites in time');
    assert.ok(line.nibbles.length >= NIBBLES[0] && line.nibbles.length <= NIBBLES[1]);
    // Each nibble its own twitch, all of them before the bite, with a gap.
    let last = now;
    for (const t of line.nibbles) {
      assert.ok(t >= last + 300, 'apart');
      last = t + NIBBLE_MS;
    }
    assert.ok(last <= line.strikeAt, 'before the bite');
    assert.equal(lineState(line, now), 'wait');
    for (const t of line.nibbles) assert.equal(lineState(line, t + 1), 'nibble');
    assert.equal(lineState(line, line.strikeAt), 'strike');
    assert.equal(lineState(line, line.strikeAt + STRIKE_MS - 1), 'strike');
    assert.equal(lineState(line, line.strikeAt + STRIKE_MS), 'gone');
  }
  assert.deepEqual([...counts].sort(), [0, 1, 2, 3], 'some bite at once, some nibble three times');
});

// A fight played to its end at 30 steps a second by `reel`, which sees the
// fight as it was a fifth of a second ago, as a child reacting would.
function play(power, reel, r, still = false) {
  const f = newFight(power, still);
  const seen = [];
  let t = 0;
  while (!f.over && t < 90) {
    seen.push(reel(f));
    fightStep(f, 1 / 30, seen.length > 6 ? seen.at(-7) : false, r);
    t += 1 / 30;
  }
  return { over: f.over, t };
}

test('the fight: a little fish comes in held all the way; a big one snaps the line held all the way, and lands let go in the red', () => {
  const r = seeded(11);
  const rate = (power, reel) => {
    let won = 0;
    for (let i = 0; i < 200; i++) won += play(power, reel, r).over === 'landed' ? 1 : 0;
    return won / 200;
  };
  const always = () => true;
  const never = () => false;
  const careful = (f) => f.tension < 0.72;
  for (const c of CATCHES) {
    const power = catchFor((CATCHES.indexOf(c) + 0.5) / CATCHES.length).power;
    assert.equal(rate(c.fight, never), 0, `${c.key}: never reeled, it gets away`);
    assert.ok(rate(c.fight, careful) >= 0.95, `${c.key}: reeled with care, it comes in`);
    assert.ok(power >= 0 && power <= 1);
  }
  assert.equal(rate(catchFor(0).power, always), 1, 'a minnow comes in held all the way');
  const gold = CATCHES.find((c) => c.key === 'goldfish').fight;
  assert.ok(rate(gold, always) < 0.1, 'a golden fish snaps a line held all the way');
  // How it ends: in the red too long it snaps; let go too long it escapes.
  assert.equal(play(gold, always, seeded(3)).over, 'snapped');
  assert.equal(play(0.5, never, seeded(3)).over, 'escaped');
  // Bigger fish take longer.
  const time = (power) => play(power, careful, seeded(5)).t;
  assert.ok(time(0.15) < time(0.95), 'a golden fish takes longer than a minnow');
  // Dead weight never runs.
  const boot = newFight(0.35, true);
  for (let i = 0; i < 300; i++) fightStep(boot, 1 / 30, true, r);
  assert.equal(boot.over, 'landed');
});

test('mostly fish come up, each a length of its kind, now and then something else', () => {
  const seen = new Map();
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const c = catchFor((i + 0.5) / N, (i * 7919) % N / N);
    seen.set(c.key, (seen.get(c.key) ?? 0) + 1);
    if (c.basket === 'fish') assert.ok(c.length >= c.cm[0] && c.length <= c.cm[1] && Number.isInteger(c.length), `${c.key} ${c.length} cm`);
    else assert.equal(c.length, 0);
    assert.ok(c.power > 0 && c.power <= 1, `${c.key} fights`);
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
  const got = STICKERS.filter((s) => s.test({ fished: 250, fishcm: 40 }) && !s.test({ fished: 0, fishcm: 0 }));
  assert.deepEqual(got.map((s) => s.key), ['gone-fishing', 'angler', 'big-one', 'master-angler']);
  assert.ok(STAT_KEYS.includes('fishcm'));
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
  room.receive(a, { t: 'rod', op: 'hook' });
  room.receive(a, { t: 'rod', op: 'pull', p: 0.456, pull: 7 });
  room.receive(a, { t: 'rod', op: 'land', caught: 'trout', cm: 37 });
  room.receive(a, { t: 'rod', op: 'reel', caught: 'trout' });
  assert.deepEqual(b.all('rod').slice(1), [
    { t: 'rod', pid, op: 'hook' },
    { t: 'rod', pid, op: 'pull', p: 0.46, pull: 1 },
    { t: 'rod', pid, op: 'land', caught: 'trout', cm: 37 },
    { t: 'rod', pid, op: 'reel', caught: 'trout', lost: false },
  ]);
  room.receive(a, { t: 'rod', op: 'reel', caught: { no: 1 }, lost: true });
  room.receive(a, { t: 'rod', op: 'land', caught: '<b>', cm: 1e9 });
  room.receive(a, { t: 'rod', op: 'pull', p: 'far' });
  assert.deepEqual(b.all('rod').slice(5), [
    { t: 'rod', pid, op: 'reel', caught: '', lost: true },
    { t: 'rod', pid, op: 'land', caught: '', cm: 99 },
    { t: 'rod', pid, op: 'pull', p: 0, pull: 0 },
  ], 'only words and numbers in range pass on');
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
  assert.equal(b.all('rod').length, 8, 'nothing more passed on');
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

  // The line: the bobber flies out in an arc, then floats on the water with
  // a fish's shadow circling it; it twitches at a nibble and goes under at
  // a bite; hooked, the fish drags it about and in towards the shore.
  const line = new FishingLine(scene, { x: 5, y: 4, z: 9 });
  const from = new THREE.Vector3(5.5, 6, 5);
  const shore = new THREE.Vector3(5.5, 5, 5.5);
  line.update(from, line.flight / 2, 0, { phase: 'wait', shore });
  assert.ok(line.bobber.position.y > 6, 'up in the air on its way');
  for (let i = 0; i < 30; i++) line.update(from, 0.05, 1 + i * 0.05, { phase: 'wait', shore });
  const floating = line.bobber.position.y;
  assert.ok(Math.abs(floating - (4 + 0.92)) < 0.05, `floating on the water (${floating})`);
  const round = line.shadow.position.distanceTo(line.at);
  assert.ok(line.shadow.visible && round > 0.5 && round < 1.6, `a shadow circling it (${round.toFixed(2)})`);
  for (let i = 0; i < 10; i++) line.update(from, 0.05, 3 + i * 0.05, { phase: 'nibble', shore });
  assert.ok(line.shadow.position.distanceTo(line.at) < 0.35, 'in to nibble');
  line.update(from, 0.05, 4, { phase: 'strike', shore });
  assert.ok(line.bobber.position.y < floating - 0.1, 'under, with a fish on');
  const pos = line.line.geometry.attributes.position;
  assert.ok(Math.hypot(pos.getX(0) - from.x, pos.getY(0) - from.y, pos.getZ(0) - from.z) < 1e-4, 'from the tip');
  const last = pos.count - 1;
  assert.ok(Math.hypot(pos.getX(last) - line.bobber.position.x, pos.getZ(last) - line.bobber.position.z) < 1e-4, 'to the bobber');
  const dist = (progress) => {
    for (let i = 0; i < 40; i++) line.update(from, 0.05, 5 + i * 0.05, { phase: 'fight', progress, pull: 0, shore });
    return Math.hypot(line.hook.x - shore.x, line.hook.z - shore.z);
  };
  assert.ok(dist(0.9) < dist(0.1) - 1.5, 'reeled in towards the shore');
  assert.ok(line.leap('trout', 30) && !line.leap('trout', 30), 'it leaps out, once at a time');
  line.update(from, 0.35, 7, { phase: 'fight', progress: 0.9, pull: 0.8, shore });
  assert.ok(line.leaping.position.y > line.top + 0.5, 'up out of the water');
  // Landed: up out of the water and hanging from the line under the tip.
  line.land('trout', 30);
  for (let i = 0; i < 20; i++) line.update(from, 0.05, 8 + i * 0.05, { phase: 'landed', shore });
  assert.ok(!line.leaping, 'the leap over');
  assert.ok(line.caught.position.distanceTo(from) < 0.6 && line.caught.position.y < from.y, 'hanging under the tip');
  assert.ok(!line.bobber.visible && !line.shadow.visible, 'the bobber and the shadow gone with it');
  // A fish that got away: the shadow swims off and shrinks away.
  const lost = new FishingLine(scene, { x: 5, y: 4, z: 9 });
  for (let i = 0; i < 20; i++) lost.update(from, 0.05, i * 0.05, { phase: 'wait', shore });
  const was = lost.shadow.position.clone();
  for (let i = 0; i < 18; i++) lost.update(from, 0.05, 2 + i * 0.05, { phase: 'lost', shore });
  assert.ok(lost.shadow.position.distanceTo(was) > 2 && lost.shadow.scale.x < 0.5, 'off it goes');
  lost.dispose();
  line.dispose();
  assert.ok(!line.bobber.parent && !line.line.parent && !line.caught.parent && !line.shadow.parent, 'gone when reeled in');
})

test('every kind of fish is drawn, longer for a longer fish, and a pufferfish round', () => {
  for (const c of CATCHES.filter((k) => k.cm)) {
    const fish = fishModel(c.key, drawnLength(c.cm[1]));
    const box = new THREE.Box3().setFromObject(fish).getSize(new THREE.Vector3());
    assert.ok(box.z > 0.2 && box.z < 1.2, `${c.key}: ${box.z.toFixed(2)} long`);
    if (c.key === 'puffer') assert.ok(box.x > box.z * 0.6, 'round');
    else assert.ok(box.x < box.z * 0.5, `${c.key}: slim`);
    assert.ok(fish.userData.tail && fish.userData.nose > 0);
  }
  assert.ok(drawnLength(50) > drawnLength(5));
});
