// The dragon fight (dragon.js): a volcano island's own dragon is wild — it
// wakes when someone comes near, breathes fire at them and is bopped tame,
// and then anyone may ride it; everyone who bopped it has tamed it once
// more (gear, shop.js), and tamed often enough, a dragon of your own comes
// from the toy box, tame from the start.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { CRITTER_INFO, CritterSim, unpackCritter } from '../public/js/shared/critters.js';
import { canRide, DRAGON_HEARTS, FIRE, hitDragon, inFlames, isWild, stepDragons, TAME_MS, TAMES_TO_INVITE, WAKE } from '../public/js/shared/dragon.js';
import { addProgress } from '../public/js/shared/keeper.js';
import { BUMP_HP, maxHp } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { cleanGear } from '../public/js/shared/shop.js';
import { World } from '../public/js/shared/world.js';

// ------------------------------------------------------------ the fight itself

function lone() {
  const sim = new CritterSim(3);
  const c = sim.add('dragon', 30.5, 11, 20.5, 'Ember', 0);
  return { sim, c };
}

test('a wild dragon sleeps until someone comes near, then wakes and goes after them', () => {
  const { sim, c } = lone();
  assert.ok(isWild(c));
  assert.ok(!canRide(c), 'nobody rides it wild');
  let news = stepDragons(sim, [{ id: 1, x: 30.5 + WAKE + 3, y: 11, z: 20.5 }], 0);
  assert.equal(c.fight.mood, 'asleep', 'still asleep with nobody near');
  assert.equal(news.woke.length, 0);
  news = stepDragons(sim, [{ id: 1, x: 30.5 + WAKE - 2, y: 11, z: 20.5 }], 100);
  assert.deepEqual(news.woke, [c], 'woke');
  assert.equal(c.fight.target, 1);
  assert.ok(c.fight.chase && Number.isFinite(c.fight.chase.x), 'stomping after them');
  // Someone riding, sitting dizzy or in a tent wakes nothing.
  const other = lone();
  for (const p of [{ riding: true }, { dizzy: true }, { sheltered: true }]) {
    stepDragons(other.sim, [{ id: 2, x: 32, y: 11, z: 20.5, ...p }], 0);
    assert.equal(other.c.fight.mood, 'asleep', JSON.stringify(p));
  }
});

test('it rears back, then breathes fire the way it faced, burning each one in the flames once', () => {
  const { sim, c } = lone();
  const front = { id: 1, x: 30.5, y: 11, z: 20.5 + 4 };
  const behind = { id: 2, x: 30.5, y: 11, z: 20.5 - 4 };
  stepDragons(sim, [front, behind], 0);
  assert.equal(c.fight.mood, 'awake');
  let fired = null;
  const burns = [];
  for (let t = 0; t <= FIRE.first + FIRE.windup + FIRE.ms + 200; t += 50) {
    const news = stepDragons(sim, [front, behind], t);
    if (news.fires.length) fired = { t, yaw: news.fires[0].yaw };
    burns.push(...news.burns.map((b) => b.pid));
  }
  assert.ok(fired, 'it breathed fire');
  assert.ok(fired.t >= FIRE.first + FIRE.windup, `only after it rears back (${fired.t} ms)`);
  assert.ok(Math.abs(fired.yaw - Math.atan2(front.x - c.x, front.z - c.z)) < 0.01, 'at whoever it is after');
  assert.deepEqual(burns, [1], 'the one in front burned once; the one behind not at all');
  // The flames: in front as far as they reach, and not off to the side.
  assert.ok(inFlames(c, 0, c.x, c.y, c.z + FIRE.reach - 0.5));
  assert.ok(!inFlames(c, 0, c.x, c.y, c.z + FIRE.reach + 1));
  assert.ok(!inFlames(c, 0, c.x + 6, c.y, c.z + 2), 'out of the cone');
});

test('bopped until its hearts are gone, it is tame, and everyone who bopped it tamed it', () => {
  const { sim, c } = lone();
  assert.equal(hitDragon(c, 1, 0).hearts, DRAGON_HEARTS - 1, 'a fist takes one heart');
  assert.ok(hitDragon(c, 1, 100).wait, 'not again so soon');
  assert.equal(c.fight.mood, 'awake', 'a bop wakes it');
  let t = 1000;
  let last = null;
  for (let pid = 2; !last?.tamed; pid = pid === 2 ? 3 : 2) {
    last = hitDragon(c, pid, (t += 500), 4);
  }
  assert.equal(last.hearts, 0);
  assert.deepEqual(last.fighters.sort(), [1, 2, 3], 'all three who bopped it');
  assert.equal(c.fight.mood, 'tame');
  assert.ok(canRide(c), 'and now anyone may ride it');
  assert.equal(hitDragon(c, 1, (t += 500)), null, 'nothing to bop once tame');
  // Ridden it stays tame; alone a while after, it is wild and asleep again.
  c.rider = 1;
  stepDragons(sim, [], t + TAME_MS * 2);
  assert.equal(c.fight.mood, 'tame', 'tame while ridden');
  c.rider = 0;
  let news = stepDragons(sim, [], t + TAME_MS * 2 + 1000);
  assert.equal(c.fight.mood, 'tame', 'a while yet');
  news = stepDragons(sim, [], t + TAME_MS * 3 + 2000);
  assert.deepEqual(news.wild, [c], 'wild again');
  assert.equal(c.fight.mood, 'asleep');
  assert.equal(c.fight.hearts, DRAGON_HEARTS);
});

test('left alone mid-fight it gets its hearts back, and with nobody near it goes back to sleep', () => {
  const { sim, c } = lone();
  const p = { id: 1, x: 30.5, y: 11, z: 26 };
  stepDragons(sim, [p], 0);
  hitDragon(c, 1, 100, 4);
  assert.equal(c.fight.hearts, DRAGON_HEARTS - 4);
  for (let t = 200; t < 20000; t += 100) stepDragons(sim, [{ ...p, z: 80 }], t);
  assert.equal(c.fight.mood, 'asleep', 'back to sleep');
  assert.equal(c.fight.hearts, DRAGON_HEARTS, 'with all its hearts');
});

test('one brought from the toy box is tame from the start, and never fights', () => {
  const sim = new CritterSim(5);
  const c = sim.add('dragon', 10, 11, 10);
  c.tame = true;
  assert.ok(!isWild(c));
  assert.ok(canRide(c));
  assert.equal(hitDragon(c, 1, 0), null);
  stepDragons(sim, [{ id: 1, x: 11, y: 11, z: 10 }], 0);
  assert.equal(c.fight, undefined, 'no fight at all');
  assert.equal(unpackCritter(sim.pack()[0]).fight.mood, 'tame');
});

test('the dragon is big: its ride box more than twice a pony’s', () => {
  const d = CRITTER_INFO.dragon.ride;
  const pony = CRITTER_INFO.pony.ride;
  assert.ok(d.radius >= pony.radius * 2.5 && d.height >= pony.height * 2, `${d.radius} × ${d.height}`);
});

test('the times you tamed it are kept with your gear, and added up when two profiles join', () => {
  assert.equal(cleanGear({}).tames, 0);
  assert.equal(cleanGear({ tames: 7 }).tames, 7);
  assert.equal(cleanGear({ tames: -2 }).tames, 0);
  assert.equal(cleanGear({ tames: 1.5 }).tames, 0);
  const a = { name: 'A', look: {}, gear: { tames: 6 } };
  const b = { name: 'B', look: {}, gear: { tames: 5 } };
  assert.equal(addProgress(a, b).gear.tames, 11);
  assert.ok(TAMES_TO_INVITE === 10);
});

// ------------------------------------------------------------ on the island

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

function join(room, name, look = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', ...look } });
  return c;
}

// A flat little volcano island (basalt at y 10) with its dragon at the far end.
function dragonRoom() {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'volcano', seed: 7, now: time.now, settings: {} });
  const w = new World({ W: 64, H: 32, D: 48, sea: 4, theme: 'volcano', spawn: { x: 6.5, y: 11, z: 24.5 } });
  for (let x = 0; x < 64; x++) {
    for (let z = 0; z < 48; z++) {
      w.set(x, 0, z, B.MAGIC_FLOOR);
      for (let y = 1; y <= 10; y++) w.set(x, y, z, y === 10 ? B.BASALT : B.STONE);
    }
  }
  room.world = w;
  room.critters.list.length = 0;
  room.hookWorld();
  const dragon = room.critters.add('dragon', 44.5, 11, 24.5, 'Ember', -Math.PI / 2);
  return { room, time, dragon };
}

function standFor(room, time, c, [x, y, z], ms) {
  for (let t = 0; t < ms; t += 100) {
    time.t += 100;
    room.receive(c, { t: 'm', s: [x, y, z, 0, 0, 0] });
    room.tick();
  }
}

test('on the island: it wakes, its fire burns, it cannot be ridden or sent away wild, and bopped tame it can be ridden', () => {
  const { room, time, dragon } = dragonRoom();
  const a = join(room, 'Brave', { weapon: 'lavablade' });
  const b = join(room, 'Bold');
  const pid = a.last('welcome').you;
  // Wild: no ride, and nobody sends it away.
  room.receive(a, { t: 'critter', op: 'ride', id: dragon.id });
  assert.ok(!dragon.rider, 'no ride while wild');
  assert.match(a.last('notice')?.text ?? '', /wild/);
  room.receive(a, { t: 'critter', op: 'bye', id: dragon.id });
  assert.ok(room.critters.get(dragon.id), 'it stays');
  // Near it, it wakes, and its fire burns.
  standFor(room, time, b, [6.5, 11, 24.5], 100);
  standFor(room, time, a, [37.5, 11, 24.5], 4000);
  assert.ok(a.all('dragon').some((m) => m.fx === 'wake'), 'woke, and everyone hears');
  assert.ok(b.all('dragon').some((m) => m.fx === 'fire'), 'breathed fire');
  const burn = a.all('bump').find((m) => m.fire);
  assert.ok(burn, 'burned');
  assert.equal(burn.hp, maxHp(1) - FIRE.bumps * BUMP_HP);
  // Bop it tame, from up close.
  for (let i = 0; i < 40 && !a.last('tamed'); i++) {
    time.t += 450;
    const at = [dragon.x - 3, 11, dragon.z];
    room.receive(a, { t: 'm', s: [...at, 0, 0, 0] });
    room.receive(a, { t: 'critter', op: 'hit', id: dragon.id });
    room.tick();
  }
  const tamed = b.last('tamed');
  assert.ok(tamed, 'tamed, and everyone hears');
  assert.deepEqual(tamed.by, [pid], 'only the one who bopped it');
  assert.ok(a.all('dhit').length >= DRAGON_HEARTS / 4, 'each bop told');
  room.receive(a, { t: 'critter', op: 'ride', id: dragon.id });
  assert.equal(dragon.rider, pid, 'and now it can be ridden');
});

test('a dragon brought from the toy box is tame, can be sent away, and stays tame when the island is saved', () => {
  const { room, time } = dragonRoom();
  const a = join(room, 'Keeper');
  standFor(room, time, a, [10.5, 11, 24.5], 100);
  room.receive(a, { t: 'critter', op: 'invite', type: 'dragon', x: 20.5, y: 11, z: 10.5 });
  const added = a.last('cadd');
  assert.ok(added, 'it came');
  const c = room.critters.get(added.critter.id);
  assert.ok(c.tame && !isWild(c));
  assert.equal(unpackCritter(added.s).fight.mood, 'tame');
  const again = new Room({ save: room.exportSave(), now: time.now });
  const kept = again.critters.list.filter((d) => d.type === 'dragon');
  assert.equal(kept.length, 2);
  assert.equal(kept.filter((d) => d.tame).length, 1, 'the one brought stays tame, the island’s own wild');
  room.receive(a, { t: 'critter', op: 'bye', id: c.id });
  assert.ok(!room.critters.get(c.id), 'sent away');
});
