// Fire from the saddle (issue #11): a tame dragon with its rider on breathes
// a short burst of fire ahead of it (the 👊 button, or X), about once a second
// at most, and every monster in the flames takes one bop — flash, hop back,
// pop — counting as the rider's, for XP and stickers as any bop. A ridden
// dragon has hearts of its own, more than a player's: a monster's bump takes
// those instead of the rider's HP, they refill by themselves when no monster
// is near, and with them gone the rider is set down beside it, safe, while it
// rests a short while before it can be ridden again. The wild dragon's own
// tame fight never changes (its 16 hearts stay).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, unpackCritter } from '../public/js/shared/critters.js';
import { canRide, isWild, RIDE_FIRE, RIDE_HEARTS, RIDE_HEAL_MS, RIDE_REST_MS, rideOf } from '../public/js/shared/dragon.js';
import { BLOB_HEARTS, BUMP_HP, maxHp } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

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
  return c;
}

// A flat island with monsters on, its first player riding a tame dragon
// (facing +z), and a second player on the ground to hear what everyone is told.
function ridden() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, settings: { monsters: true } });
  const rider = join(room, 'Brave Rider');
  const friend = join(room, 'Happy Panda');
  const p = room.players.get(1);
  const c = room.critters.add('dragon', 40.5, 11, 40.5);
  c.tame = true;
  c.rider = 1;
  c.yaw = 0;
  assert.ok(canRide(c) && !isWild(c));
  return { room, time, c, p, rider, friend };
}

// A blob standing at (x, y, z), wherever it came out.
function blob(room, x, y, z) {
  const m = room.monsters.add(room.world, x, y, z);
  m.body.x = x;
  m.body.y = y;
  m.body.z = z;
  return m;
}

// ------------------------------------------------------------ the fire

test('at its rider’s word it breathes fire ahead of it, at most about once a second', () => {
  const { room, time, c, rider } = ridden();
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  const fire = rider.last('dragon');
  assert.ok(fire, 'the flames were told to everyone');
  assert.equal(fire.id, c.id);
  assert.equal(fire.fx, 'fire');
  assert.equal(fire.yaw, 0);
  assert.equal(fire.ms, RIDE_FIRE.ms);
  // Not again before the breath is over and its pace allows.
  time.t += 200;
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  assert.equal(rider.all('dragon').length, 1, 'too soon after the last');
  time.t += RIDE_FIRE.every;
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  assert.equal(rider.all('dragon').length, 2, 'ready again about a second on');
});

test('nothing at all when you are not riding, nor from anyone but its rider', () => {
  const { room, c, rider, friend } = ridden();
  c.rider = 2;
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  assert.ok(!rider.last('dragon'), 'not from someone else’s dragon');
  c.rider = 0;
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  assert.ok(!rider.last('dragon'), 'not from the ground');
  // Nor on a pony, say: only a dragon breathes.
  const pony = room.critters.add('pony', 44.5, 11, 40.5);
  pony.rider = 1;
  room.receive(rider, { t: 'critter', op: 'fire', id: pony.id });
  assert.ok(!rider.last('dragon'), 'not off any other animal');
  assert.ok(!friend.last('dragon'), 'nobody on the island heard a breath');
});

test('every monster in the flames takes one bop — and pops with the last', () => {
  const { room, time, c, rider } = ridden();
  // One right in front of the dragon (it faces +z), one behind it.
  const front = blob(room, 40.5, 11, 46.5);
  const back = blob(room, 40.5, 11, 34.5);
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  const hits = rider.all('mhit').map((m) => m.id);
  assert.deepEqual(hits, [front.id], 'the one ahead bonked; the one behind not');
  assert.equal(front.hearts, BLOB_HEARTS - 1);
  assert.equal(rider.last('mhit').by, 1, 'told as the rider’s bop');
  // A one-hearted monster pops, like any bop.
  const last = blob(room, 42.5, 11, 44.5);
  last.hearts = 1;
  time.t += RIDE_FIRE.every;
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  assert.ok(rider.all('pop').some((m) => m.id === last.id && m.by === 1), 'pop! as any bop');
  assert.ok(room.monsters.get(front.id), 'the full-hearted one is still there');
  assert.equal(room.monsters.get(last.id), null, 'the popped one is gone');
});

// ------------------------------------------------------------ its own hearts

test('a monster’s bump takes the dragon’s hearts, not the rider’s HP', () => {
  const { room, time, c, p, friend } = ridden();
  const m = blob(room, 41, 11, 41); // right beside the dragon
  const before = p.hp;
  room.hurt(1, m, time.now());
  const ride = rideOf(c);
  assert.equal(ride.hearts, RIDE_HEARTS - BUMP_HP, 'a heart off the dragon');
  assert.equal(p.hp, before, 'the rider never felt it');
  assert.equal(friend.last('chearts')?.hearts, ride.hearts, 'told to everyone');
  // Not again at once: the pace holds the bumps apart.
  time.t += 100;
  room.hurt(1, m, time.now());
  assert.equal(ride.hearts, RIDE_HEARTS - BUMP_HP, 'not two bumps in a blink');
});

test('monsters go after someone on a dragon’s back, and bump the dragon', () => {
  const { room, time, c, p, rider } = ridden();
  // A clear meadow (grass at y 10), so nothing stands in the blob's way.
  const W = 96;
  room.world = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) room.world.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  const m = blob(room, 40.5, 11, 46.5);
  const before = p.hp;
  // Up on its back, standing still, for a while.
  const sit = (ms, y = 11) => {
    for (let t = 0; t < ms; t += 100) {
      time.t += 100;
      room.receive(rider, { t: 'm', s: [40.5, y + CRITTER_INFO.dragon.ride.seat, 40.5, 0, 0, 0] });
      room.tick();
    }
  };
  sit(6000);
  assert.ok(rideOf(c).hearts < RIDE_HEARTS, `the blob caught up and bumped it (it got to ${Math.hypot(m.body.x - c.x, m.body.z - c.z).toFixed(2)})`);
  assert.equal(p.hp, before, 'the rider never felt it');
  assert.equal(c.rider, 1, 'still on its back');
});

test('with no monster near for a while its hearts come back by themselves', () => {
  const { room, time, c } = ridden();
  const ride = rideOf(c);
  ride.hearts = 10;
  ride.healAt = time.now();
  // A monster near (but not touching) holds the healing off.
  const m = blob(room, 40.5, 11, 45.5);
  time.t += RIDE_HEAL_MS;
  room.stepRides(time.now());
  assert.equal(ride.hearts, 10, 'not while one is near');
  m.body.x = 80;
  for (let i = 0; i < 200 && ride.hearts < ride.max; i++) {
    time.t += RIDE_HEAL_MS;
    room.stepRides(time.now());
  }
  assert.equal(ride.hearts, RIDE_HEARTS, 'back up, a heart at a time, till full');
});

test('with its hearts gone the rider is set down beside it, safe, and it rests', () => {
  const { room, time, c, p, rider, friend } = ridden();
  const m = blob(room, 41, 11, 41); // right beside the dragon
  const ride = rideOf(c);
  ride.hearts = BUMP_HP;
  room.hurt(1, m, time.now());
  assert.equal(ride.restUntil, time.now() + RIDE_REST_MS, 'resting');
  assert.equal(c.rider, 0, 'nobody on its back');
  assert.equal(p.hp, maxHp(1), 'unhurt');
  assert.ok(friend.last('chearts')?.rest, 'everyone saw it rest');
  // Too tired to breathe, till the rest is over.
  room.receive(rider, { t: 'critter', op: 'fire', id: c.id });
  assert.ok(!rider.last('dragon'), 'too tired to breathe');
  time.t += RIDE_REST_MS;
  room.stepRides(time.now());
  assert.equal(ride.hearts, RIDE_HEARTS, 'all its hearts back after the rest');
  assert.equal(ride.restUntil, 0, 'and it can be ridden again');
});

test('the wild dragon’s tame fight never changes, and none of this touches it', () => {
  const { room, c } = ridden();
  const ride = rideOf(c);
  assert.equal(ride.max, RIDE_HEARTS, 'its own hearts, apart from the fight’s 16');
  assert.ok(RIDE_HEARTS > 100, 'more than a player’s HP');
  // The wire carries them along with the fight, so friends see how it is: the
  // fight's three numbers, then the ride-hearts as a fourth.
  const row = room.critters.pack().find((r) => r[0] === c.id);
  assert.equal(unpackCritter(row).fight.mood, 'tame');
  assert.equal(unpackCritter(row).fight.rideHearts, ride.hearts);
});
