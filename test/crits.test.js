// Critical hits (crits.js): the island deals each swing's luck a swing ahead,
// tells the swinger alone of a critical one, by the number their page gives
// their swings, and every blow of that swing takes twice as much — on a
// monster, a boss, a wild dragon, and all a Bomb Rod's bomb catches — told to
// everyone. Never a bop of no swing it heard, nor a landing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { KING_HIT_MS } from '../public/js/shared/adventure.js';
import { CRIT_CHANCE, CRIT_TIMES, critRoll, isSwing } from '../public/js/shared/crits.js';
import { BLOB_HEARTS, HIT_MS } from '../public/js/shared/monsters.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { ROD_LOB_MS, weaponOf } from '../public/js/shared/shop.js';
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

function join(room, name = 'Happy Panda', look = {}) {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap', ...look } });
  return c;
}

// Luck that always (or never) makes a swing critical, from here on.
const lucky = (room, crit = true) => (room.critRng = { next: () => (crit ? 0 : 0.999) });

// A flat meadow with monsters on and none coming out by themselves, a player
// standing in the middle of it (and, at luck, every swing critical or none).
function meadow({ luck = null, look = {} } = {}) {
  const time = clock();
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: time.now, settings: { monsters: true } });
  const W = 96;
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  room.world = w;
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  if (luck !== null) lucky(room, luck);
  const a = join(room, 'Happy Panda', look);
  const b = join(room, 'Brave Otter');
  const at = { x: w.spawn.x + 20, z: w.spawn.z };
  room.receive(a, { t: 'm', s: [at.x, 11, at.z, 0, 0, 0] });
  // One held right in front of them (dz along their way), as many hearts as said.
  const monster = (hearts = BLOB_HEARTS, dx = 0, dz = 1.2) => {
    const m = room.monsters.add(w, at.x + dx, 11, at.z + dz);
    Object.assign(m.body, { x: at.x + dx, y: 11, z: at.z + dz, vx: 0, vy: 0, vz: 0 });
    Object.assign(m, { hearts, max: hearts, giggle: Infinity });
    return m;
  };
  return { room, time, w, a, b, at, monster };
}

test('a test can say what the luck is; a swing is numbered from 1', () => {
  assert.equal(CRIT_CHANCE, 1 / 8);
  assert.equal(CRIT_TIMES, 2);
  const rolls = (n) => Array.from({ length: n }, (_, i) => critRoll(() => (i + 0.5) / n)).filter(Boolean).length;
  assert.equal(rolls(800), 100, 'one in eight');
  try {
    globalThis.kidsWorldLuck = 0;
    assert.equal(rolls(800), 0, 'never');
    globalThis.kidsWorldLuck = 1;
    assert.equal(rolls(800), 800, 'always');
  } finally {
    delete globalThis.kidsWorldLuck;
  }
  assert.ok(isSwing(1) && isSwing(40));
  for (const n of [0, -1, 1.5, '1', null, undefined, NaN, Infinity]) assert.equal(isSwing(n), false, String(n));
});

test('a critical swing takes twice the hearts off every monster it lands on, and everyone is told', () => {
  const { room, time, a, b, monster } = meadow({ luck: true });
  assert.equal(a.last('welcome').luck, 1, 'their first swing will be one, as they come');
  const m = monster(5, -0.5);
  const n = monster(5, 0.5);
  a.inbox.length = 0;
  b.inbox.length = 0;
  room.receive(a, { t: 'swing', n: 1 });
  time.t += HIT_MS;
  room.receive(a, { t: 'bop', id: m.id, n: 1 });
  room.receive(a, { t: 'bop', id: n.id, n: 1 });
  assert.equal(m.hearts, 5 - CRIT_TIMES);
  assert.equal(n.hearts, 5 - CRIT_TIMES, 'both it swept');
  assert.deepEqual(b.all('mhit'), [
    { t: 'mhit', id: m.id, by: 1, hearts: 3, crit: true },
    { t: 'mhit', id: n.id, by: 1, hearts: 3, crit: true },
  ]);
  // Its next swing's luck, to the swinger alone.
  assert.deepEqual(a.all('luck'), [{ t: 'luck', n: 2 }]);
  assert.deepEqual(b.all('luck'), [], 'nobody else hears it');
  // The last of its hearts, critically: it pops, and the pop says so.
  m.hearts = 2;
  room.receive(a, { t: 'swing', n: 2 });
  time.t += HIT_MS;
  room.receive(a, { t: 'bop', id: m.id, n: 2 });
  assert.equal(room.monsters.get(m.id), null);
  assert.equal(b.last('pop').crit, true);
});

test('the luck is dealt a swing ahead: a plain one is a plain bop, and the swinger hears only of critical ones', () => {
  const { room, time, a, b, monster } = meadow({ luck: false });
  assert.equal(a.last('welcome').luck, undefined, 'their first swing is plain');
  const m = monster(9);
  const swing = (n) => {
    room.receive(a, { t: 'swing', n });
    time.t += HIT_MS;
    room.receive(a, { t: 'bop', id: m.id, n });
  };
  swing(1);
  assert.equal(m.hearts, 8, 'a heart, as ever');
  assert.equal(b.last('mhit').crit, undefined);
  assert.deepEqual(a.all('luck'), [], 'no word of a plain one');
  // Lucky from now: the next swing was dealt already, plain; the one after is critical.
  lucky(room);
  swing(2);
  assert.equal(m.hearts, 7, 'dealt before the luck turned');
  assert.deepEqual(a.all('luck'), [{ t: 'luck', n: 3 }]);
  swing(3);
  assert.equal(m.hearts, 5, 'twice over');
  assert.equal(b.last('mhit').crit, true);
});

test('never critical: a bop of no swing, of a swing the island never heard, a swing it heard too long ago, or a landing', () => {
  const { room, time, a, monster } = meadow({ luck: true });
  const m = monster(9);
  const bop = (msg) => {
    time.t += HIT_MS;
    room.receive(a, { t: 'bop', id: m.id, ...msg });
  };
  // A page from before critical hits: its swings have no number, nor its bops.
  room.receive(a, { t: 'swing' });
  bop({});
  assert.equal(m.hearts, 8);
  bop({ n: 1 });
  assert.equal(m.hearts, 7, 'swing 1 never came');
  bop({ n: '1' });
  assert.equal(m.hearts, 6);
  // What a swing shot lands a while on, after the next swing has gone: still
  // as critical as its own swing. Four swings on, it is forgotten.
  room.receive(a, { t: 'swing', n: 1 });
  room.receive(a, { t: 'swing', n: 2 });
  bop({ n: 1 });
  assert.equal(m.hearts, 4, 'an arrow of swing 1, landing after swing 2');
  for (let n = 3; n <= 6; n++) room.receive(a, { t: 'swing', n });
  bop({ n: 1 });
  assert.equal(m.hearts, 3, 'too long ago');
  // Landing on a Big Bruiser takes three hearts, whatever the luck.
  const big = room.monsters.add(room.world, m.body.x + 6, 11, m.body.z);
  Object.assign(big.body, { x: m.body.x + 6, y: 11, z: m.body.z, vx: 0, vy: 0, vz: 0 });
  Object.assign(big, { kind: 'big', hearts: 6, max: 6, giggle: Infinity });
  room.receive(a, { t: 'swing', n: 7 });
  room.receive(a, { t: 'm', s: [big.body.x, 11 + big.body.height * 0.8, big.body.z, 0, 0, 0] });
  time.t += HIT_MS;
  room.receive(a, { t: 'bop', id: big.id, on: true, n: 7 });
  assert.equal(big.hearts, 3, 'a landing is no swing');
});

test('the welcome deals the first swing again: numbers start over from 1', () => {
  const { room, time, a, monster } = meadow({ luck: true });
  const m = monster(9);
  room.receive(a, { t: 'swing', n: 1 });
  room.receive(a, { t: 'swing', n: 2 });
  // Back again (another tab, a reload): its first swing is swing 1 once more.
  const p = room.players.get(1);
  const again = conn();
  room.attach(again);
  room.receive(again, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: p.look, token: a.last('welcome').token });
  assert.equal(again.last('welcome').you, 1);
  assert.equal(again.last('welcome').luck, 1);
  time.t += HIT_MS;
  room.receive(again, { t: 'bop', id: m.id, n: 2 });
  assert.equal(m.hearts, 8, 'swing 2 was before: forgotten');
  room.receive(again, { t: 'swing', n: 1 });
  time.t += HIT_MS;
  room.receive(again, { t: 'bop', id: m.id, n: 1 });
  assert.equal(m.hearts, 6);
});

test('about one swing in eight is critical, from luck of its own: nothing else on the island goes another way for it', () => {
  const { room, a } = meadow();
  const before = { world: room.rng.state, monsters: room.monsters.rng.state, camps: room.monsters.campRng?.state, loot: room.loot.rng.state };
  const N = 8000;
  // (Straight in: so many at once, the island would take them for flooding it.)
  const p = room.players.get(1);
  for (let n = 1; n <= N; n++) room.swung(p, n);
  assert.equal(p.swings.size, 4, 'only the last few kept');
  const told = a.all('luck').length;
  assert.ok(Math.abs(told / N - CRIT_CHANCE) < 0.015, `${told} of ${N}`);
  assert.deepEqual({ world: room.rng.state, monsters: room.monsters.rng.state, camps: room.monsters.campRng?.state, loot: room.loot.rng.state }, before);
});

test('a critical Bomb Rod throw: everything its blast catches takes twice its blow', () => {
  const { room, time, a, monster } = meadow({ luck: true, look: { weapon: 'bombrod' } });
  const power = weaponOf('bombrod').power;
  const m = monster(10, 0, 3);
  room.receive(a, { t: 'swing', n: 1 });
  room.receive(a, { t: 'bomb', d: 3, n: 1 });
  time.t += ROD_LOB_MS;
  room.tick();
  assert.equal(m.hearts, 10 - power * CRIT_TIMES);
  assert.equal(a.last('mhit').crit, true);
  // A throw of no swing (a page from before): a plain blast.
  time.t += HIT_MS;
  room.receive(a, { t: 'bomb', d: 3 });
  time.t += ROD_LOB_MS;
  room.tick();
  assert.equal(m.hearts, 10 - power * CRIT_TIMES - power);
});

test('a Thunder Spear’s critical stab: its bolt leaps on critically too', () => {
  const { room, time, a, b, monster } = meadow({ luck: true, look: { weapon: 'thunderspear' } });
  const power = weaponOf('thunderspear').power;
  const m = monster(20, 0, 1.5);
  const next = monster(20, 0, 4);
  room.receive(a, { t: 'swing', n: 1 });
  time.t += HIT_MS;
  room.receive(a, { t: 'bop', id: m.id, n: 1 });
  assert.equal(m.hearts, 20 - power * CRIT_TIMES);
  assert.equal(next.hearts, 20 - power * CRIT_TIMES, 'leapt on to');
  assert.deepEqual(b.all('mhit').map((msg) => [msg.id, msg.crit]), [
    [next.id, true],
    [m.id, true],
  ]);
});

test('a critical hit on a wild dragon, and on a boss out of its bubble, counts twice', () => {
  // The dragon.
  const time = clock();
  const room = new Room({ code: '123456', theme: 'volcano', seed: 7, now: time.now, settings: {} });
  const w = new World({ W: 64, H: 32, D: 48, sea: 4, theme: 'volcano', spawn: { x: 6.5, y: 11, z: 24.5 } });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 48; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.BASALT : B.STONE);
  room.world = w;
  room.critters.list.length = 0;
  room.hookWorld();
  const dragon = room.critters.add('dragon', 44.5, 11, 24.5, 'Ember', -Math.PI / 2);
  lucky(room, false);
  const a = join(room, 'Brave');
  room.receive(a, { t: 'm', s: [dragon.x - 3, 11, dragon.z, 0, 0, 0] });
  const hit = (n) => {
    room.receive(a, { t: 'swing', n });
    time.t += 450;
    room.receive(a, { t: 'critter', op: 'hit', id: dragon.id, n });
    return a.last('dhit');
  };
  const plain = hit(1);
  lucky(room);
  hit(2);
  const crit = hit(3);
  assert.equal(plain.crit, undefined);
  assert.equal(crit.crit, true);
  const fight = room.critters.get(dragon.id).fight;
  assert.equal(fight.hearts, fight.max - 1 - 1 - CRIT_TIMES, 'plain, plain, critical');
  // A boss, every camp freed.
  const t = { t: 1_000_000 };
  const isle = new Room({ code: '424242', adventure: true, shared: true, stage: 3, seed: 5, now: () => t.t });
  const adv = isle.adventure;
  const c = join(isle);
  isle.players.get(1).safeUntil = Infinity;
  const castle = adv.castle;
  const near = () => {
    t.t += 100;
    isle.receive(c, { t: 'm', s: [castle.x + castle.r + 12, castle.y, castle.z, 0, 0, 0] });
    isle.tick();
  };
  near();
  const boss = isle.monsters.list.find((m) => m.camp === castle.id);
  for (const camp of adv.camps) if (camp.kind === 'camp') isle.campFreed(adv.free(camp, [], isle.monsters));
  near();
  const bop = (n) => {
    t.t += KING_HIT_MS;
    isle.receive(c, { t: 'm', s: [boss.body.x + boss.body.radius + 1, boss.body.y, boss.body.z, 0, 0, 0] });
    isle.receive(c, { t: 'swing', n });
    isle.receive(c, { t: 'bop', id: boss.id, n });
    return c.last('kinghit');
  };
  lucky(isle, false);
  const start = adv.king.hearts;
  bop(1);
  lucky(isle);
  bop(2);
  const told = bop(3);
  assert.equal(told.crit, true);
  assert.equal(adv.king.hearts, start - 1 - 1 - CRIT_TIMES, 'plain, plain, critical');
});
