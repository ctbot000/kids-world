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
import { CritterSim } from '../public/js/shared/critters.js';
import { canRide, isWild, RIDE_FIRE, RIDE_HEARTS, RIDE_REST_MS, rideOf } from '../public/js/shared/dragon.js';
import { BUMP_HP, maxHp, MonsterSim } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

const FLAT = { W: 64, H: 32, D: 64, sea: 6 };

// A little island with its host, a tame dragon ridden by player 1, and a
// monster lump beside it.
function ridden(rooms = {}) {
  const world = new World({ ...FLAT, seed: 7, name: 'test' }, () => {});
  for (let x = 20; x < 44; x++) for (let z = 20; z < 44; z++) for (let y = 6; y < 9; y++) world.set(x, y, z, 2);
  const room = new Room(world, { protocol: PROTOCOL, ...rooms });
  const conn = { send() {}, close() {}, hosting: false };
  room.join(conn, { pid: 1, name: 'rider', look: {} });
  const p = room.players.get(1);
  p.s = [30, 8, 30, 0, 0, 0];
  const sim = room.critters;
  const c = sim.add('dragon', 30.5, 9, 30.5);
  c.tame = true;
  c.rider = 1;
  assert.ok(canRide(c) && !isWild(c));
  return { room, world, c, p, conn };
}

// ------------------------------------------------------------ the fire

test('at its rider’s word it breathes fire ahead of it, at most about once a second', () => {
  const { room, c, p } = ridden();
  const seen = [];
  room.broadcast = (msg) => seen.push(msg);
  p.s = [30, 9, 30, 0, 0, 0];
  room.critterOp(p, { op: 'fire', id: c.id });
  let fire = seen.find((m) => m.t === 'dragon' && m.fx === 'fire');
  assert.ok(fire, 'the flames were told to everyone');
  assert.equal(fire.id, c.id);
  assert.ok(Number.isFinite(fire.yaw));
  assert.equal(fire.ms, RIDE_FIRE.ms);
  // Not again before the breath is over and its pace allows.
  seen.length = 0;
  room.now = () => 200;
  room.critterOp(p, { op: 'fire', id: c.id });
  assert.ok(!seen.some((m) => m.t === 'dragon'), 'too soon after the last');
  room.now = () => RIDE_FIRE.every + 200;
  room.critterOp(p, { op: 'fire', id: c.id });
  assert.ok(seen.some((m) => m.t === 'dragon' && m.fx === 'fire'), 'ready again about a second on');
});

test('nothing at all when you are not riding, nor from anyone but its rider', () => {
  const { room, c, p, conn } = ridden();
  const seen = [];
  room.broadcast = (msg) => seen.push(msg);
  c.rider = 2;
  room.critterOp(p, { op: 'fire', id: c.id });
  assert.ok(!seen.some((m) => m.t === 'dragon'), 'not from someone else’s dragon');
  c.rider = 0;
  room.critterOp(p, { op: 'fire', id: c.id });
  assert.ok(!seen.some((m) => m.t === 'dragon'), 'not from the ground');
  // Nor on a horse, say: only a dragon breathes.
  const horse = room.critters.add('horse', 34.5, 9, 30.5);
  horse.rider = 1;
  room.critterOp(p, { op: 'fire', id: horse.id });
  assert.ok(!seen.some((m) => m.t === 'dragon'), 'not off any other animal');
  room.clients.set(conn, { pid: 1 });
  assert.equal(typeof room.dragonBreath, 'function');
});

test('every monster in the flames takes one bop — and pops with the last', () => {
  const { room, c, p } = ridden();
  const seen = [];
  room.broadcast = (msg) => seen.push(msg);
  const monsters = new MonsterSim(1);
  room.monsters = monsters;
  room.settings.monsters = true;
  // One right in front of the dragon, one behind it, both on the ground.
  const front = monsters.add(world0(), 30.5, 9, 36.5, {});
  const back = monsters.add(world0(), 30.5, 9, 24.5, {});
  front.body.x = 30.5;
  front.body.y = 9;
  front.body.z = 36.5;
  back.body.x = 30.5;
  back.body.y = 9;
  back.body.z = 24.5;
  room.critterOp(p, { op: 'fire', id: c.id });
  const hits = seen.filter((m) => m.t === 'mhit').map((m) => m.id);
  assert.deepEqual(hits, [front.id], 'the one ahead bonked; the one behind not');
  assert.equal(front.hearts, 2 - 1);
  assert.ok(seen.some((m) => m.t === 'mhit' && m.by === 1), 'told as the rider’s bop');
  // A one-hearted monster pops, like any bop.
  const last = monsters.add(world0(), 32, 9, 34, {});
  last.body.x = 32;
  last.body.y = 9;
  last.body.z = 34;
  last.hearts = 1;
  seen.length = 0;
  room.now = () => RIDE_FIRE.every + 100;
  room.critterOp(p, { op: 'fire', id: c.id });
  assert.ok(seen.some((m) => m.t === 'pop' && m.by === 1), 'pop! as any bop');
  assert.equal(monsters.get(front.id), front, 'the two-hearted one is still there');
  assert.equal(monsters.get(last.id), undefined, 'the popped one is gone');
});

// ------------------------------------------------------------ its own hearts

test('a monster’s bump takes the dragon’s hearts, not the rider’s HP', () => {
  const { room, c, p } = ridden();
  const seen = [];
  room.broadcast = (msg) => seen.push(msg);
  const monsters = new MonsterSim(1);
  room.monsters = monsters;
  room.settings.monsters = true;
  const m = monsters.add(world0(), 31, 9, 31, {});
  m.body.x = 31.2;
  m.body.y = 9;
  m.body.z = 31.2;
  assert.equal(p.hp, maxHp(1));
  const before = p.hp;
  room.stepRides(1000);
  const ride = rideOf(c);
  assert.ok(ride.hearts < RIDE_HEARTS, 'a heart off the dragon');
  assert.equal(p.hp, before, 'the rider never felt it');
  assert.ok(seen.some((m2) => m2.t === 'chearts' && m2.hearts === ride.hearts), 'told to everyone');
  // Not again at once, and nobody bumped: the pace holds it apart.
  seen.length = 0;
  room.stepRides(1100);
  assert.equal(ride.hearts, RIDE_HEARTS - BUMP_HP, 'not two bumps in a blink');
});

test('with no monster near for a while its hearts come back by themselves', () => {
  const { room, c } = ridden();
  room.monsters = new MonsterSim(1);
  room.settings.monsters = true;
  const ride = rideOf(c);
  ride.hearts = 10;
  ride.bumpAt = 0;
  ride.healAt = 0;
  // A monster standing near holds the healing off.
  const m = room.monsters.add(world0(), 31, 9, 31, {});
  m.body.x = 31;
  m.body.y = 9;
  m.body.z = 31;
  room.stepRides(10000);
  assert.equal(ride.hearts, 10, 'not while one is near');
  m.body.x = 80;
  room.stepRides(10000 + 3000);
  room.stepRides(10000 + 6000);
  room.stepRides(10000 + 9000);
  assert.ok(ride.hearts > 10, 'back up once it is gone');
});

test('with its hearts gone the rider is set down beside it, safe, and it rests', () => {
  const { room, c, p } = ridden();
  const seen = [];
  room.broadcast = (msg) => seen.push(msg);
  const monsters = new MonsterSim(1);
  room.monsters = monsters;
  room.settings.monsters = true;
  const m = room.monsters.add(world0(), 31, 9, 31, {});
  m.body.x = 31.2;
  m.body.y = 9;
  m.body.z = 31.2;
  m.hearts = 1;
  const ride = rideOf(c);
  ride.hearts = BUMP_HP;
  const at = [...p.s];
  room.stepRides(500);
  assert.equal(ride.restUntil, 500 + RIDE_REST_MS, 'resting');
  assert.equal(c.rider, 0, 'nobody on its back');
  assert.equal(p.hp, maxHp(1), 'unhurt');
  assert.ok(seen.some((m2) => m2.t === 'chearts' && m2.rest), 'everyone saw it rest');
  // Too tired to be ridden on to, and no breath either, till the rest is over.
  seen.length = 0;
  room.critterOp(p, { op: 'fire', id: c.id });
  assert.ok(!seen.some((m2) => m2.t === 'dragon'), 'too tired to breathe');
  room.stepRides(500 + RIDE_REST_MS);
  assert.equal(ride.hearts, RIDE_HEARTS, 'all its hearts back after the rest');
  assert.equal(ride.restUntil, 0, 'and it can be ridden again');
});

test('the wild dragon’s tame fight never changes, and none of this touches it', () => {
  const sim = new CritterSim(3);
  const c = sim.add('dragon', 30.5, 11, 30.5);
  assert.ok(isWild(c));
  assert.equal(c.fight, undefined);
  const ride = rideOf(c);
  assert.equal(ride.max, RIDE_HEARTS, 'its own hearts, apart from the fight’s 16');
  assert.ok(RIDE_HEARTS > 100, 'more than a player’s HP');
});

function world0() {
  return new World({ ...FLAT, seed: 7, name: 'flat' }, () => {});
}
