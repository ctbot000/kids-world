// The beasts (shared/beasts.js): ten mightier species of monster, each with moves
// of its own, showing before they come. Rattlebones falls into a heap and gets up
// again; a Stingtail lunges; Shadow Wolves hunt in twos, pounce and howl for help;
// a Thunderhawk stays out of reach and calls lightning; a Mimic is a chest until
// you are near; a Grumble Oak bursts its roots out of the ground and hates fire; a
// Grumble Wizard rains stars, blinks away and calls blobs; a Swamp Hydra breathes
// venom; a Cyclops throws boulders; Rumble Rex charges, stomps and roars.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../public/vendor/three.module.js';
import { AdventureSim, MONSTER_BOOK, monsterStats, toughGuards } from '../public/js/shared/adventure.js';
import { BEASTS, beastsOfTier, isBeast, SCATTER, weakTo } from '../public/js/shared/beasts.js';
import * as B from '../public/js/shared/blocks.js';
import { LEAK, waveOf, WAVES } from '../public/js/shared/defense.js';
import { MONSTER_FIGURES } from '../public/js/shared/gashapon.js';
import { buildIsle } from '../public/js/shared/isle-maps.js';
import { CHAPTERS } from '../public/js/shared/isle-story.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { ARM_REACH, BOP_SLACK, bodyOf, BUMP_HP, HIT_MS, isHeavy, KINDS, kindOf, maxHp, MONSTER_KINDS, MONSTER_STATES, MonsterSim, unpackMonster } from '../public/js/shared/monsters.js';
import { MOVE } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';
import { World } from '../public/js/shared/world.js';
import { makeBeast } from '../public/js/render/beasts.js';
import { shownBox } from '../public/js/render/monster-figures.js';

const KINDS_NEW = ['rattle', 'stinger', 'wolf', 'hawk', 'mimic', 'oak', 'wizard', 'hydra', 'cyclops', 'rex'];

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t, kind) => c.inbox.filter((m) => m.t === t && (!kind || m.kind === kind));
  return c;
}

// A flat meadow with someone on it, and a beast of this kind as far off as dx.
function arena(kind, { dx = 6, weapon = null, outfit = null, water = false } = {}) {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  const W = 128;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'sunny', spawn: { x: 12.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? (water && x >= 60 && x <= 70 ? B.WATER : B.GRASS) : B.DIRT);
  room.world = w;
  room.hookWorld();
  room.critters.list.length = 0;
  room.monsters.spawnAt = Infinity;
  const a = conn();
  room.attach(a);
  room.receive(a, { t: 'join', protocol: PROTOCOL, name: 'Brave Otter', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'none', ...(weapon ? { weapon } : {}), ...(outfit ? { outfit } : {}) } });
  a.pid = a.last('welcome').you;
  const me = { x: 50.5, y: 11, z: W / 2 + 0.5 };
  const stand = (x = me.x, z = me.z, y = me.y) => {
    Object.assign(me, { x, y, z });
    room.receive(a, { t: 'm', s: [x, y, z, 0, 0, 0] });
  };
  stand();
  const m = kind ? room.monsters.add(w, me.x + dx, 11, me.z, { kind }) : null;
  // Time passing with them standing where they are.
  const wait = (ms, until = null) => {
    for (let t = 0; t < ms; t += 50) {
      time.t += 50;
      room.receive(a, { t: 'm', s: [me.x, me.y, me.z, 0, 0, 0] });
      room.tick();
      if (until?.()) return true;
    }
    return false;
  };
  return { room, time, w, a, m, me, stand, wait, hp: () => room.players.get(a.pid).hp };
}

// Its next move due at once, the one in turn at index i.
const due = (m, i = 0) => {
  m.moveAt = 1;
  m.turn = i;
};

test('the beasts go on the end of the kinds and states, each tougher than most, never as quick as you run, and in the collection', () => {
  assert.deepEqual(MONSTER_KINDS.slice(22), KINDS_NEW, 'new kinds go on the end: the wire sends the index');
  assert.equal(MONSTER_KINDS.indexOf('moltok'), 21, 'the old ones where they were');
  assert.deepEqual(MONSTER_STATES.slice(13), ['heap', 'howl', 'blink']);
  assert.deepEqual(Object.keys(BEASTS).sort(), [...KINDS_NEW].sort());
  for (const kind of KINDS_NEW) {
    const k = kindOf(kind);
    assert.equal(k, BEASTS[kind], 'monsters.js takes it in');
    assert.ok(isBeast(kind));
    assert.ok(k.cross.run < MOVE.run && k.move.run < MOVE.run, `${kind} is never as quick as you run`);
    assert.ok(k.hearts >= KINDS.knight.hearts, `${kind} has as many hearts as a Grumble Knight at least`);
    assert.ok(k.bump >= 1 && k.bump <= 4);
    assert.equal(bodyOf(kind), k.body);
    assert.ok(k.coins > 0 && k.gap.length === 3 && k.moves.length > 0, kind);
    for (const mv of k.moves) {
      assert.ok(mv.windup >= 500, `${kind}'s ${mv.move} shows before it comes`);
      assert.ok(mv.from >= 0 && mv.from <= 2);
    }
    const book = MONSTER_BOOK.find((b) => b.kind === kind);
    assert.ok(book?.name === k.name && book.icon === k.icon, kind);
    const s = monsterStats(kind);
    assert.equal(s.hp, k.hearts);
    assert.equal(s.atk, k.bump * BUMP_HP);
    assert.ok(s.speed < 100);
    assert.ok(STAT_KEYS.includes(`seen${kind}`) && STAT_KEYS.includes(`pop${kind}`));
    assert.ok(MONSTER_FIGURES.some((f) => f.monster === kind), `${kind} has a figure`);
  }
  // The mightiest are far tougher than a Stone Golem, and heavy.
  for (const kind of beastsOfTier(2)) {
    assert.ok(kindOf(kind).hearts > KINDS.golem.hearts, kind);
    assert.ok(isHeavy(kind), kind);
    assert.ok(kindOf(kind).stagger < 0.7, `${kind} hardly feels a blow`);
  }
  for (const kind of beastsOfTier(1)) assert.ok(!isHeavy(kind), kind);
  assert.deepEqual([beastsOfTier(1).length, beastsOfTier(2).length], [5, 5]);
  assert.ok(kindOf('rex').bump > KINDS.golem.bump, 'Rumble Rex bumps harder than anything');
  // On the wire, like any other.
  const sim = new MonsterSim(3);
  const w = arena(null).w;
  const m = sim.add(w, 30.5, 11, 30.5, { kind: 'rex' });
  assert.equal(unpackMonster(sim.pack()[0]).kind, 'rex');
  assert.equal(unpackMonster(sim.pack()[0]).hearts, m.hearts);
  // XP and stickers for popping them.
  assert.ok(XP_FOR.beasts.xp > XP_FOR.popped.xp && STAT_KEYS.includes('beasts'));
  const hunter = STICKERS.find((s) => s.key === 'beast-hunter');
  assert.ok(!hunter.test({ beasts: 9 }) && hunter.test({ beasts: 10 }));
});

test('now and then one comes out among the others, oftener at night, and the mightiest only at night; wolves come in twos', () => {
  const sim = new MonsterSim(11);
  const tally = (night) => {
    const n = {};
    for (let i = 0; i < 6000; i++) {
      const k = sim.pickKind(night, 'sunny');
      n[k] = (n[k] ?? 0) + 1;
    }
    return n;
  };
  const share = (n, list) => list.reduce((sum, k) => sum + (n[k] ?? 0), 0) / 6000;
  const day = tally(false);
  const night = tally(true);
  assert.equal(share(day, beastsOfTier(2)), 0, 'none of the mightiest by day');
  assert.ok(share(day, beastsOfTier(1)) > 0.02 && share(day, beastsOfTier(1)) < 0.06);
  assert.ok(share(night, KINDS_NEW) > 0.09 && share(night, KINDS_NEW) < 0.15, 'oftener at night');
  for (const k of KINDS_NEW) assert.ok(night[k] > 0, `${k} comes out`);
  // In twos, and never past what the island holds.
  const { w } = arena(null);
  const two = new MonsterSim(1);
  two.spawn(w, { x: 40.5, y: 11, z: 40.5 }, 'wolf');
  assert.deepEqual(two.list.map((m) => m.kind), ['wolf', 'wolf']);
  // Too big for the spot: a blob instead of one stuck in a wall.
  w.set(41, 11, 80, B.STONE);
  const tight = new MonsterSim(1);
  assert.equal(tight.spawn(w, { x: 40.5, y: 11, z: 80.5 }, 'rex').kind, 'blob');
});

test('Rattlebones throws bones, falls into a heap with its last heart gone, gets up again if left, and a blow on the heap pops it', () => {
  const { room, a, m, me, stand, wait, hp } = arena('rattle');
  due(m);
  assert.ok(wait(2000, () => a.all('mfx', 'hurl').length));
  const shot = a.last('mfx');
  assert.equal(shot.what, 'bone');
  assert.ok(Math.hypot(shot.to[0][0] - me.x, shot.to[0][2] - me.z) < 0.01, 'at where you stand');
  // A bone that lands on you takes its bump.
  const was = hp();
  assert.ok(wait(1200, () => a.all('bump').some((b) => b.hurl === 'bone')));
  assert.equal(hp(), was - BEASTS.rattle.moves[0].bumps * BUMP_HP);
  // Its last heart: no pop, a heap.
  m.hearts = 1;
  m.giggle = 0;
  stand(m.body.x - 1, m.body.z);
  room.receive(a, { t: 'bop', id: m.id });
  assert.ok(room.monsters.get(m.id), 'still there');
  assert.equal(a.all('pop').length, 0);
  assert.equal(m.hearts, 1);
  assert.ok(m.heap > 0);
  const bumps = a.all('bump').length;
  wait(BEASTS.rattle.rises.ms - 500);
  assert.equal(m.state, 'heap', 'it lies there');
  assert.equal(a.all('bump').length, bumps, 'bumping nobody');
  assert.equal(unpackMonster(room.monsters.pack()[0]).state, 'heap');
  // Left alone, up it gets with half its hearts, everyone told.
  assert.ok(wait(1000, () => m.state !== 'heap'));
  assert.equal(m.hearts, BEASTS.rattle.hearts * BEASTS.rattle.rises.share);
  assert.equal(a.all('mfx', 'rise').length, 1);
  // Beaten again, this time with a bop while it is down: gone for good.
  m.hearts = 1;
  m.hits.clear();
  stand(m.body.x - 1, m.body.z);
  room.receive(a, { t: 'bop', id: m.id });
  assert.ok(m.heap);
  wait(HIT_MS + 50);
  stand(m.body.x - 1, m.body.z);
  room.receive(a, { t: 'bop', id: m.id });
  assert.equal(room.monsters.get(m.id), null);
  assert.equal(a.last('pop').id, m.id);
});

test('a Stingtail lunges down a strip shown first, nobody lands on it, and into a wall it sits dazed a moment', () => {
  const { room, a, m, me, stand, wait, w } = arena('stinger');
  // A landing is a bump, not a blow.
  stand(m.body.x, m.body.z, m.body.y + m.body.height);
  room.receive(a, { t: 'bop', id: m.id, on: true });
  assert.equal(m.hearts, BEASTS.stinger.hearts);
  stand(me.x - 0, m.body.z, 11);
  stand(m.body.x - 6, m.body.z);
  due(m);
  assert.ok(wait(1000, () => a.all('mfx', 'rear').length));
  const rear = a.last('mfx');
  assert.equal(rear.d, BEASTS.stinger.moves[0].far);
  assert.equal(m.state, 'rear');
  // Standing in the way: charged.
  assert.ok(wait(2500, () => a.all('bump').some((b) => b.charge)));
  const hit = a.all('bump').find((b) => b.charge);
  assert.equal(hit.hp, maxHp(1) - BEASTS.stinger.moves[0].bumps * BUMP_HP);
  // A wall in the way: it bonks.
  const y = Math.floor(m.body.y);
  stand(m.body.x - 8, m.body.z);
  for (let z = -4; z <= 4; z++) for (let dy = 0; dy < 3; dy++) w.set(Math.floor(m.body.x) - 4, y + dy, Math.floor(m.body.z) + z, B.STONE);
  stand(m.body.x - 6, m.body.z);
  room.players.get(a.pid).safeUntil = 0;
  m.giggle = 0;
  due(m);
  assert.ok(wait(3000, () => a.all('mfx', 'bonk').length), 'bonk');
  assert.equal(m.state, 'charge');
  wait(50);
  assert.equal(m.state, 'dazed');
  const left = m.dazed - room.now();
  assert.ok(left > 0 && left <= BEASTS.stinger.moves[0].daze);
});

test('Shadow Wolves pounce on a ring shown first, and hurt, one howls for another, once, who never howls himself', () => {
  const { room, a, m, wait, hp } = arena('wolf');
  due(m);
  assert.ok(wait(1000, () => a.all('mfx', 'leap').length));
  const leap = a.last('mfx');
  assert.equal(leap.r, BEASTS.wolf.moves[0].reach);
  // Comes down on you, standing in the ring.
  assert.ok(wait(2500, () => a.all('stomp').length));
  assert.equal(a.last('stomp').r, BEASTS.wolf.moves[0].reach);
  assert.ok(wait(800, () => hp() < maxHp(1)), 'knocked over');
  assert.equal(hp(), maxHp(1) - BEASTS.wolf.moves[0].bumps * BUMP_HP);
  assert.ok(m.dazed - room.now() <= BEASTS.wolf.moves[0].daze, 'hardly dazed');
  // Hurt: a howl.
  m.hearts = 5;
  m.hitAt = room.now();
  m.turn = 1;
  m.moveAt = 1;
  m.dazed = 0;
  m.giggle = 0;
  assert.ok(wait(1500, () => a.all('mfx', 'howl').length));
  const pack = room.monsters.list.filter((o) => o.kind === 'wolf');
  assert.equal(pack.length, 2, 'another one, beside it');
  const helper = pack.find((o) => o !== m);
  assert.equal(helper.helper, true);
  assert.equal(helper.target, m.target, 'after the same one');
  // Only the once, and the help never calls for more.
  assert.deepEqual(room.monsters.nextMove(room.world, m, { x: m.body.x + 5, z: m.body.z }, []).move, 'leap');
  helper.hearts = 2;
  helper.rage = 2;
  helper.turn = 1;
  assert.equal(room.monsters.nextMove(room.world, helper, { x: helper.body.x + 5, z: helper.body.z }, []).move, 'leap');
});

test('a Thunderhawk hangs out of reach, calls lightning on rings round you, comes down to bump, and crosses the water', () => {
  const { room, a, m, me, stand, wait, hp } = arena('hawk', { dx: 30 });
  // Nobody near: up out of reach.
  wait(1500);
  assert.ok(m.body.y >= 11 + BEASTS.hawk.hover.high - 0.5, `up high: ${m.body.y}`);
  stand(m.body.x - 1, m.body.z);
  m.wander = null;
  assert.equal(room.monsters.canBop(m.id, { x: me.x, y: 11, z: me.z }, 8), null, 'out of reach of anything');
  // Nearly at you, it comes down and can be bopped.
  stand(m.body.x - 8, m.body.z);
  m.moveAt = room.now() + 100000;
  assert.ok(wait(3000, () => m.state === 'chase' && m.body.y < 12.6 && Math.hypot(m.body.x - me.x, m.body.z - me.z) < 3));
  assert.ok(room.monsters.canBop(m.id, { x: me.x, y: 11, z: me.z }, 2));
  // Up it goes to call its lightning: a ring where you are, and more round you.
  room.players.get(a.pid).safeUntil = 0;
  m.giggle = 0;
  stand(m.body.x - 8, m.body.z);
  due(m);
  assert.ok(wait(1500, () => a.all('mfx', 'hurl').length));
  const bolt = a.last('mfx');
  assert.equal(bolt.what, 'bolt');
  assert.equal(bolt.to.length, 1 + BEASTS.hawk.moves[0].scatter);
  assert.ok(Math.hypot(bolt.to[0][0] - me.x, bolt.to[0][2] - me.z) < 0.01);
  for (const at of bolt.to.slice(1)) assert.ok(Math.abs(Math.hypot(at[0] - me.x, at[2] - me.z) - SCATTER) < 0.01, 'round you');
  const was = hp();
  assert.ok(wait(1300, () => hp() < was), 'still in the ring: struck');
  assert.equal(hp(), was - BEASTS.hawk.moves[0].bumps * BUMP_HP);
});

test('a Thunderhawk flies over water after you, where the others stop', () => {
  for (const [kind, over] of [['hawk', true], ['stinger', false]]) {
    const { m, me, stand, wait } = arena(kind, { dx: 8, water: true });
    m.body.x = 58.5;
    m.moveAt = 1e12;
    stand(72.5, m.body.z);
    let far = m.body.x;
    for (let i = 0; i < 40; i++) {
      wait(100);
      stand(72.5, me.z);
      far = Math.max(far, m.body.x);
    }
    if (over) assert.ok(far > 70, `over: ${far}`);
    else assert.ok(far < 60.5, `stopped at the water: ${far}`);
  }
});

test('a Mimic sits shut and still until someone comes near, and then it bites; lost, it shuts again', () => {
  const { room, a, m, me, stand, wait, time } = arena('mimic', { dx: 7 });
  const at = [m.body.x, m.body.z];
  wait(4000);
  assert.equal(m.state, 'idle', 'only a chest');
  assert.equal(m.target, 0);
  assert.deepEqual([m.body.x, m.body.z], at, 'not moving');
  assert.equal(a.all('bump').length, 0);
  // Near enough: open it comes.
  stand(m.body.x - BEASTS.mimic.notice + 0.5, m.body.z);
  assert.ok(wait(300, () => m.state === 'chase'));
  assert.ok(wait(2500, () => a.all('bump').length || a.all('mfx', 'leap').length), 'and at you');
  // Run far off: it gives up, and is a chest again where it is.
  stand(me.x - 30, me.z);
  assert.ok(wait(3500, () => m.state === 'idle'));
  const still = [m.body.x, m.body.z];
  wait(1000);
  assert.deepEqual([m.body.x, m.body.z], still);
  // Bopped from afar while shut, it wakes for whoever did it.
  stand(m.body.x - 1.5, m.body.z);
  time.t += 1000;
  room.receive(a, { t: 'bop', id: m.id });
  assert.equal(m.target, a.pid);
  assert.ok(BEASTS.mimic.coins >= BEASTS.rex.coins, 'and it pays');
});

test('a Grumble Oak drives its roots up under you, walks slower than anything, and fire does it twice the harm', () => {
  assert.ok(BEASTS.oak.move.run < KINDS.golem.move.run);
  const { a, m, me, wait, hp } = arena('oak');
  due(m);
  assert.ok(wait(1500, () => a.all('mfx', 'hurl').length));
  const roots = a.last('mfx');
  assert.equal(roots.what, 'root');
  assert.ok(Math.hypot(roots.to[0][0] - me.x, roots.to[0][2] - me.z) < 0.01);
  assert.equal(roots.to.length, 1 + BEASTS.oak.moves[0].scatter);
  assert.ok(wait(1200, () => hp() < maxHp(1)), 'in the ring: caught');
  assert.equal(weakTo('oak', 'lavablade'), 2);
  assert.equal(weakTo('oak', 'sword'), 1);
  assert.equal(weakTo('blob', 'fire'), 1);
  assert.equal(weakTo('rattle', 'hammer'), 2);
  // A Lava Blade's bop takes twice what it says, and a Foam Sword's what it says.
  for (const [weapon, took] of [['lavablade', 8], ['sword', 2]]) {
    const { room, a: c, m: oak, stand } = arena('oak', { weapon });
    stand(oak.body.x - 1.5, oak.body.z);
    room.receive(c, { t: 'bop', id: oak.id });
    assert.equal(oak.hearts, BEASTS.oak.hearts - took, weapon);
  }
  // And the fire of a dragon's breath.
  const fired = new MonsterSim(1);
  const tree = fired.add(arena(null).w, 30.5, 11, 30.5, { kind: 'oak' });
  fired.hit(tree, 1, { x: 28, y: 11, z: 30.5 }, 1000, 1, undefined, 'fire');
  assert.equal(tree.hearts, BEASTS.oak.hearts - 2);
  // The hardest blow hardly moves it.
  assert.ok(Math.hypot(tree.body.vx, tree.body.vz) < 2);
});

test('a Grumble Wizard rains stars round you, slips away a moment after a bop, staying in his camp, and calls blobs, at most twice', () => {
  const { room, a, m, me, stand, wait } = arena('wizard');
  due(m);
  assert.ok(wait(1500, () => a.all('mfx', 'hurl').length));
  const stars = a.last('mfx');
  assert.equal(stars.what, 'star');
  assert.equal(stars.to.length, 1 + BEASTS.wizard.moves[0].scatter);
  // Bopped: he blinks away from you, a way off.
  m.moveAt = room.now() + 100000;
  wait(100);
  stand(m.body.x - 1.5, m.body.z);
  room.receive(a, { t: 'bop', id: m.id });
  const hurt = m.hearts;
  assert.ok(hurt < BEASTS.wizard.hearts);
  assert.ok(wait(1600, () => a.all('mfx', 'blink').length), 'off he goes');
  const blink = a.last('mfx');
  assert.deepEqual([m.body.x, m.body.z].map((v) => +v.toFixed(2)), [blink.to[0], blink.to[2]]);
  const d = Math.hypot(m.body.x - me.x, m.body.z - me.z);
  assert.ok(d >= BEASTS.wizard.moves[1].to[0] - 1 && d <= BEASTS.wizard.moves[1].to[1] + 1, `a way off: ${d}`);
  // Cross, he calls blobs, which never come back.
  m.hearts = 4;
  m.hitAt = room.now();
  for (let i = 0; i < 2; i++) {
    m.turn = 2;
    m.moveAt = 1;
    const howls = a.all('mfx', 'howl').length;
    assert.ok(wait(1500, () => a.all('mfx', 'howl').length > howls));
    m.hitAt = room.now();
  }
  assert.equal(room.monsters.list.filter((o) => o.kind === 'blob' && o.helper).length, 4);
  m.turn = 2;
  assert.notEqual(room.monsters.nextMove(room.world, m, { x: m.body.x + 5, z: m.body.z }, []).move, 'call', 'twice at most');
  // One of a camp blinks only as far as his camp goes.
  const sim = new MonsterSim(4);
  const camp = { x: 30.5, z: 30.5, r: 7 };
  const w = arena(null).w;
  const one = sim.add(w, 30.5, 11, 30.5, { kind: 'wizard' });
  for (let i = 0; i < 40; i++) {
    const to = sim.blinkSpot(w, one, BEASTS.wizard.moves[1], { x: 33, y: 11, z: 30.5 }, [], camp);
    if (to) assert.ok(Math.hypot(to.x - camp.x, to.z - camp.z) <= camp.r - 1 + 0.01, 'in his camp');
  }
  assert.equal(sim.blinkSpot(w, one, BEASTS.wizard.moves[1], null, [], camp), null);
});

test('a Swamp Hydra breathes a wide jet of venom from where it faces, Knight Armor taking half of it and a Fire Suit none', () => {
  const breath = BEASTS.hydra.moves[0];
  for (const [outfit, n] of [[null, breath.bumps], ['armor', breath.bumps / 2], ['firesuit', breath.bumps]]) {
    const { a, m, wait, hp } = arena('hydra', { outfit });
    due(m);
    assert.ok(wait(1500, () => a.all('mfire').length));
    const fire = a.last('mfire');
    assert.deepEqual([fire.what, fire.r, fire.a], ['venom', breath.reach, breath.angle]);
    assert.ok(wait(1500, () => hp() < maxHp(1)), 'in it');
    const b = a.last('bump');
    assert.equal(b.what, 'venom');
    assert.ok(!b.fire, 'no fire');
    assert.equal(hp(), maxHp(1) - n * BUMP_HP, outfit ?? 'nothing on');
  }
  // Out of the way it faces, out of it.
  const { a, m, stand, wait, hp } = arena('hydra');
  due(m);
  assert.ok(wait(800, () => m.state === 'breathe'));
  assert.ok(wait(1500, () => a.all('mfire').length));
  stand(m.body.x, m.body.z + 6);
  wait(BEASTS.hydra.moves[0].ms);
  assert.equal(hp(), maxHp(1));
});

test('a Cyclops throws a boulder from far off, on a ring where you stood, and stomps near', () => {
  const { a, m, me, stand, wait, hp } = arena('cyclops', { dx: 14 });
  due(m);
  assert.ok(wait(1500, () => a.all('mfx', 'hurl').length));
  const rock = a.last('mfx');
  assert.equal(rock.what, 'boulder');
  // Out of the ring by the time it lands: missed.
  const at = rock.to[0];
  assert.ok(Math.hypot(at[0] - me.x, at[2] - me.z) < 0.01);
  stand(me.x - 5, me.z);
  wait(BEASTS.cyclops.moves[0].ms + 200);
  assert.equal(hp(), maxHp(1));
  // Near, the ground shakes.
  stand(m.body.x - 3, m.body.z);
  due(m, 1);
  assert.ok(wait(3000, () => a.all('stomp').length));
  assert.equal(a.last('stomp').r, BEASTS.cyclops.moves[1].reach);
  assert.ok(wait(800, () => hp() < maxHp(1)));
  assert.equal(hp(), maxHp(1) - BEASTS.cyclops.moves[1].bumps * BUMP_HP);
});

test('Rumble Rex bumps harder than anything, and when it is cross it roars: a ring rushing out, and all in it knocked', () => {
  const { room, a, m, stand, wait, hp } = arena('rex', { dx: 3 });
  m.moveAt = room.now() + 100000;
  stand(m.body.x - 1.9, m.body.z);
  assert.ok(wait(1500, () => a.all('bump').length));
  const big = a.last('bump');
  assert.equal(big.big, true);
  assert.equal(hp(), Math.max(0, maxHp(1) - BEASTS.rex.bump * BUMP_HP));
  // A bop hardly shifts it.
  const felt = new MonsterSim(1);
  const rex = felt.add(arena(null).w, 30.5, 11, 30.5, { kind: 'rex' });
  felt.hit(rex, 1, { x: 28, y: 11, z: 30.5 }, 1000, 1, 14);
  assert.ok(rex.body.vx < 2);
  // Cross: it roars.
  const r = arena('rex', { dx: 5 });
  r.m.hearts = 20;
  r.m.hitAt = r.room.now();
  due(r.m, 2);
  assert.ok(r.wait(1500, () => r.a.all('mfx', 'spores').length));
  const roar = r.a.last('mfx');
  assert.deepEqual([roar.what, roar.r], ['roar', BEASTS.rex.moves[2].reach]);
  assert.ok(r.wait(200, () => r.hp() < maxHp(1)));
  assert.equal(r.a.all('bump').at(-1).what, 'roar');
  // Not cross, it does not.
  const calm = arena('rex', { dx: 5 });
  assert.notEqual(calm.room.monsters.nextMove(calm.w, calm.m, { x: calm.m.body.x + 5, z: calm.m.body.z }, []).move, 'puff');
});

test('every chapter of the story has champions of its own in its later camps, extra guards that do not come back and must go before the flag can rise', () => {
  const champs = new Set();
  for (const ch of CHAPTERS) {
    assert.equal(ch.champions.length, 2, ch.key);
    for (const k of ch.champions) {
      assert.ok(isBeast(k), `${ch.key}: ${k}`);
      champs.add(k);
    }
  }
  assert.equal(champs.size, KINDS_NEW.length, 'every beast is somewhere in the story');
  const made = buildIsle({ stage: 1, seed: 7 });
  const sim = new AdventureSim({ camps: made.camps, stage: 1, story: true }, 1);
  const monsters = new MonsterSim(1);
  const count = (id) => monsters.list.filter((m) => m.camp === id);
  // The first camp has none.
  sim.wake(made.world, sim.campById(1), [], monsters, 1);
  assert.ok(!count(1).some((m) => m.champion));
  // The second, Rattlebones, young yet; the third has the Queen Mosquito, enough
  // for anyone on the very first stage.
  sim.wake(made.world, sim.campById(2), [], monsters, 1);
  const second = count(2).find((m) => m.champion);
  assert.equal(second.kind, 'rattle');
  assert.equal(second.hearts, Math.round(BEASTS.rattle.hearts * 0.5));
  assert.equal(second.max, second.hearts);
  sim.wake(made.world, sim.campById(3), [], monsters, 1);
  assert.ok(!count(3).some((m) => m.champion));
  assert.ok(count(3).some((m) => m.kind === 'queen'));
  // In its camp, on ground it fits.
  const c2 = sim.campById(2);
  assert.ok(Math.hypot(second.body.x - c2.x, second.body.z - c2.z) <= c2.r);
  // Popped: it does not come back, though a guard does.
  const before = c2.back.length;
  sim.guardGone(second, 1000);
  assert.equal(c2.back.length, before);
  sim.guardGone(count(2).find((m) => !m.champion), 1000);
  assert.equal(c2.back.length, before + 1);
  sim.guardGone({ camp: 2, kind: 'wolf', helper: true }, 1000);
  assert.equal(c2.back.length, before + 1, 'nor do helpers');
  // Further on, both, full grown from the sixth stage and tougher with friends;
  // the second time round the story, the first camp has one too.
  const later = (stage) => new AdventureSim({ camps: made.camps, stage, story: true }, 1);
  const championAt = (stage, id) => {
    const at = later(stage);
    return at.championOf(made.world, at.campById(id));
  };
  assert.equal(championAt(2, 3), 'oak');
  const round2 = later(8);
  assert.equal(round2.championOf(made.world, round2.campById(1)), 'rattle');
  const grownUp = (stage, players) => {
    const sim2 = later(stage);
    const list = new MonsterSim(2);
    return sim2.addChampion(made.world, sim2.campById(2), [], list, players).hearts;
  };
  assert.equal(grownUp(6, 1), BEASTS[championAt(6, 2)].hearts);
  assert.ok(grownUp(6, 4) > grownUp(6, 1) * 1.5);
  assert.ok(grownUp(2, 1) < BEASTS[championAt(2, 2)].hearts);
  // On an island of your own: from the second camp on, by the island's luck, the
  // same each time, of the first tier, and none in the deepest or the castle.
  const small = new AdventureSim({ camps: made.camps, stage: 1 }, 1);
  assert.equal(small.championOf(made.world, small.campById(1)), null);
  const first = small.championOf(made.world, small.campById(2));
  assert.equal(BEASTS[first].tier, 1);
  assert.equal(small.championOf(made.world, small.campById(2)), first);
  const camps = [1, 2, 3, 4, 5, 6].map((id) => ({ id, kind: id === 6 ? 'castle' : 'camp', x: id * 20, y: 11, z: 20, r: 7 }));
  const big = new AdventureSim({ camps }, 1);
  for (const id of [2, 3, 4]) assert.equal(BEASTS[big.championOf(made.world, big.campById(id))].tier, 1);
  assert.equal(big.championOf(made.world, big.campById(5)), null, 'the Queen Mosquito holds the deepest');
  assert.equal(big.championOf(made.world, big.campById(6)), null, 'none in the castle');
});

test('the beasts join the higher stages’ guards, and the old ones keep their places before them', () => {
  assert.ok(!toughGuards(11).some(isBeast));
  assert.ok(toughGuards(13).includes('wolf'));
  const high = toughGuards(40);
  for (const k of ['wolf', 'stinger', 'rattle', 'hawk', 'mimic']) assert.ok(high.includes(k), k);
  assert.ok(!high.some((k) => BEASTS[k]?.tier === 2), 'the mightiest are champions only: they would never be cleared before they came back');
  assert.ok(high.indexOf('wolf') < high.indexOf('knight'), 'tougher than a Knight, so sooner');
  assert.equal(high[0], 'golem');
});

test('from the fourth wave of a tower defense island beasts march among the blobs, each for two of them, with more hearts and more bricks', () => {
  assert.equal(waveOf(3).beasts.length, 0);
  assert.ok(waveOf(4).beasts.length > 0);
  assert.ok(waveOf(WAVES).beasts.includes('rex'));
  for (let n = 1; n <= WAVES; n++) {
    for (const k of waveOf(n).beasts) assert.ok(isBeast(k) && BEASTS[k].march > 0 && BEASTS[k].marchHearts > 1, k);
  }
  assert.ok(LEAK.rex > LEAK.blob);
  // On the road: each at its own pace, along the way to the end, a Thunderhawk
  // over it, one that walks never hopping, and none of their moves.
  const { w } = arena(null);
  const way = [];
  for (let x = 20; x < 90; x++) way.push({ x: x + 0.5, y: 11, z: 40.5 });
  const sim = new MonsterSim(5);
  const list = ['wolf', 'hawk', 'rex'].map((kind) => sim.add(w, 20.5, 11, 40.5, { kind, march: way }));
  let air = 0;
  for (let i = 0; i < 100; i++) {
    sim.step(w, 0.1, 1000 + i * 100, [], false, { roam: false });
    if (list[2].body.y > 11.3) air++;
  }
  assert.ok(list[0].along > list[2].along * 1.5, 'a wolf quicker than Rumble Rex');
  assert.ok(list[1].body.y > 11.5, 'a hawk in the air');
  assert.equal(air, 0, 'Rumble Rex walks');
  assert.equal(sim.takeHurls().length + sim.takeRears().length, 0);
});

test('each one’s model stands on the ground facing +z, goes through every state with no trouble, and glows at night', () => {
  const v = new THREE.Vector3();
  for (const theme of ['sunny', 'snowy', 'candy', 'volcano', 'flat', undefined]) {
    for (const kind of KINDS_NEW) {
      const m = makeBeast(kind, theme);
      assert.ok(m.group && m.body && m.shadow, kind);
      assert.ok(m.height >= bodyOf(kind).height * 0.9, `${kind} is as tall as it is`);
      assert.ok(m.eyes.length > 0);
      assert.ok(m.mouthAt().isVector3);
      for (const state of MONSTER_STATES) {
        for (let i = 0; i < 4; i++) m.update(0.1, state, i % 2 ? 0.5 : 0, i > 1, false);
        m.group.updateMatrixWorld(true);
        m.group.traverse((o) => {
          if (!o.isMesh) return;
          o.getWorldPosition(v);
          assert.ok(Number.isFinite(v.x + v.y + v.z), `${kind} ${state}: ${o.geometry.type}`);
        });
      }
      m.thrown();
      m.update(0.1, 'hurl', 0, false);
      // Night and day.
      m.update(0.1, 'idle', 0, true);
      assert.equal(m.eyes[0].material, m.eyeGlow);
      m.update(0.1, 'idle', 0, false);
      assert.equal(m.eyes[0].material, m.eyeWhite);
      m.dispose();
    }
  }
  // Standing still, each stands on the ground, and most of it above it.
  for (const kind of KINDS_NEW) {
    const m = makeBeast(kind, 'sunny');
    m.update(0, 'idle', 0, false);
    m.group.updateMatrixWorld(true);
    const box = shownBox(m.group);
    assert.ok((kind === 'hawk' || box.min.y > -0.25) && box.max.y > bodyOf(kind).height * 0.8, `${kind}: ${box.min.y}..${box.max.y}`);
    assert.ok(kind === 'hawk' || box.max.y < m.height + 0.6, `${kind} no taller than it says: ${box.max.y} against ${m.height}`);
  }
});

test('a model does what its state says: a Mimic’s lid, a heap of bones, a wizard vanishing, a roaring jaw', () => {
  const run = (m, state, secs = 1) => {
    for (let t = 0; t < secs; t += 0.05) m.update(0.05, state, 0, false);
  };
  const mimic = makeBeast('mimic', 'sunny');
  mimic.time = 0;
  run(mimic, 'idle', 0.5);
  assert.ok(Math.abs(mimic.lid.rotation.x) < 0.1, 'shut');
  assert.ok(!mimic.feet[0].visible);
  run(mimic, 'giggle');
  assert.ok(mimic.lid.rotation.x < -0.9, 'wide open');
  assert.ok(mimic.feet[0].visible && mimic.tongue.visible);
  const bones = makeBeast('rattle', 'sunny');
  run(bones, 'idle');
  const standing = bones.head.position.y;
  run(bones, 'heap');
  assert.ok(bones.head.position.y < standing * 0.3, 'its skull on the ground');
  run(bones, 'idle', 2);
  assert.ok(Math.abs(bones.head.position.y - standing) < 0.02, 'and back on its neck');
  const wizard = makeBeast('wizard', 'sunny');
  run(wizard, 'blink');
  assert.ok(wizard.body.scale.y < 0.1, 'gone to nothing');
  run(wizard, 'idle');
  assert.ok(wizard.body.scale.y > 0.9);
  const rex = makeBeast('rex', 'sunny');
  run(rex, 'idle');
  const shut = rex.jaw.rotation.x;
  run(rex, 'puff');
  assert.ok(rex.jaw.rotation.x > shut + 0.5, 'a roar');
  const cyclops = makeBeast('cyclops', 'sunny');
  cyclops.throwAt = -100;
  run(cyclops, 'hurl');
  assert.ok(cyclops.boulder.visible, 'a boulder held up');
  cyclops.thrown();
  cyclops.update(0.05, 'hurl', 0, false);
  assert.ok(!cyclops.boulder.visible, 'gone as it throws');
  const hydra = makeBeast('hydra', 'sunny');
  hydra.group.updateMatrixWorld(true);
  const mouths = hydra.mouthsAt();
  assert.equal(mouths.length, 3);
  assert.ok(new Set(mouths.map((m) => Math.round(m.at.x * 100))).size === 3, 'three heads, apart');
});

test('nobody can hit a beast out of reach, but its own arm reach counts from its side', () => {
  const sim = new MonsterSim(1);
  const w = arena(null).w;
  const rex = sim.add(w, 30.5, 11, 30.5, { kind: 'rex' });
  const reach = ARM_REACH + BOP_SLACK;
  assert.ok(sim.canBop(rex.id, { x: 30.5 + rex.body.radius + 0.3 + reach - 0.1, y: 11, z: 30.5 }));
  assert.equal(sim.canBop(rex.id, { x: 30.5 + rex.body.radius + 0.3 + reach + 0.1, y: 11, z: 30.5 }), null);
});
