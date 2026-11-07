// The bosses of Adventure Isle (shared/bosses.js): each chapter's lair held
// by one of King Grumble's captains, King Grumble himself at the last, each
// with moves of its own that show before they come — a charge (step aside),
// things thrown (out of the red ring), a leap (out of the ring, or jump), a
// puff and a breath of fire — getting more of them, sooner, the crosser it
// gets. King Grumble anywhere else only stomps, as ever (adventure.test.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { bossHearts, KING_HIT_MS, MONSTER_BOOK, monsterStats } from '../public/js/shared/adventure.js';
import { BOSSES, isBoss, KING, planOf } from '../public/js/shared/bosses.js';
import { CHAPTERS } from '../public/js/shared/isle-story.js';
import { BUMP_HP, bodyOf, isHeavy, MONSTER_KINDS, MONSTER_STATES, MonsterSim } from '../public/js/shared/monsters.js';
import { MOVE } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

const KINDS = ['clawbeard', 'puffcap', 'frostfang', 'gumbo', 'bogmaw', 'moltok'];
// The captains of the later chapters, on the end of the kinds after the beasts.
const LATER = ['scarabold', 'glimmershell', 'baronboo', 'sprocket', 'nimbus'];
const MOVES = ['stomp', 'leap', 'charge', 'hurl', 'puff', 'breath', 'blink', 'call'];

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  c.all = (t) => c.inbox.filter((m) => m.t === t);
  return c;
}

function join(room, name = 'Happy Panda') {
  const c = conn();
  room.attach(c);
  room.receive(c, { t: 'join', protocol: PROTOCOL, name, look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  c.pid = c.last('welcome').you;
  return c;
}

// A flat meadow: grass at y 10 everywhere (standing at 11).
function meadow(W = 96) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'sunny', spawn: { x: W / 2 + 0.5, y: 11, z: W / 2 + 0.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

function meadowRoom() {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  room.world = meadow();
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  return { room, time };
}

const onFoot = (id, x, z, y = 11, safeUntil = 0) => ({ id, x, y, z, flying: false, riding: false, dizzy: false, safeUntil });

// Steps a boss along with people (a function of the time and of what has
// happened so far) until done(what happened) says so, or for ms at most;
// returns what happened.
function run(sim, w, people, done, ms = 20000) {
  const seen = { states: new Set(), rears: [], leaps: [], hurls: [], puffs: [], fires: [], burns: [], bonks: [], stomps: [], bumps: [] };
  for (let t = 0; t < ms; t += 50) {
    const now = 1_000_000 + t;
    seen.bumps.push(...sim.step(w, 0.05, now, people(now, seen), false, { roam: false, havens: [] }));
    seen.rears.push(...sim.takeRears());
    seen.leaps.push(...sim.takeLeaps());
    seen.hurls.push(...sim.takeHurls());
    seen.puffs.push(...sim.takePuffs());
    seen.fires.push(...sim.takeFires());
    seen.burns.push(...sim.takeBurns());
    seen.bonks.push(...sim.takeBonks());
    seen.stomps.push(...sim.takeStomps());
    for (const m of sim.list) seen.states.add(m.state);
    if (done(seen)) return { ...seen, at: now };
  }
  return seen;
}

test('every chapter has a boss of its own, on the end of the kinds, in the collection, with its own moves, none of them quicker than you run', () => {
  assert.deepEqual(MONSTER_KINDS.slice(16, 16 + KINDS.length), KINDS, 'new kinds go on the end: the wire sends the index');
  assert.deepEqual(MONSTER_KINDS.slice(-LATER.length), LATER, 'and the later captains after the beasts');
  assert.equal(MONSTER_KINDS.indexOf('king'), 1, 'King Grumble where he was');
  assert.deepEqual(MONSTER_STATES.slice(9, 13), ['rear', 'charge', 'hurl', 'leap']);
  assert.deepEqual(CHAPTERS.map((c) => c.boss), ['clawbeard', 'puffcap', 'frostfang', 'gumbo', 'scarabold', 'bogmaw', 'glimmershell', 'baronboo', 'moltok', 'sprocket', 'nimbus', 'king']);
  for (const kind of [...KINDS, ...LATER, 'king']) {
    const plan = BOSSES[kind];
    assert.ok(isBoss(kind) && isHeavy(kind), kind);
    assert.deepEqual(bodyOf(kind), plan.body);
    assert.ok(plan.run.every((run) => run < MOVE.run), `${kind}: never as quick as you run`);
    assert.ok(plan.gap[0] > plan.gap[1] && plan.gap[1] > plan.gap[2], `${kind}: the crosser, the sooner`);
    const at = (rage) => plan.moves.filter((v) => v.from <= rage).length;
    assert.ok(at(0) >= 1 && at(2) > at(0), `${kind}: more moves the crosser it gets`);
    for (const v of plan.moves) {
      assert.ok(MOVES.includes(v.move), `${kind}: ${v.move}`);
      assert.ok(v.windup >= 800 && (v.bumps > 0 || v.move === 'blink' || v.move === 'call'), `${kind}: its ${v.move} shows coming`);
    }
    assert.ok(MONSTER_KINDS.includes(plan.minion) && !isBoss(plan.minion), `${kind}: its minions`);
    assert.ok(MONSTER_BOOK.some((m) => m.kind === kind && m.name === (kind === 'king' ? 'King Grumble' : plan.name)), `${kind}: in the collection`);
    const s = monsterStats(kind);
    assert.equal(s.hp, bossHearts(plan, 1));
    assert.ok(s.speed < 100 && s.atk >= BUMP_HP, kind);
  }
  assert.ok(!isBoss('blob') && !isBoss('queen'));
  assert.equal(planOf('king'), KING, 'King Grumble anywhere else: his stomp alone');
  assert.equal(planOf('king', true), BOSSES.king, 'on Gloom Rock, all his captains’ tricks');
  assert.deepEqual(KING.moves.map((v) => v.move), ['stomp']);
  assert.equal(planOf('blob'), null);
});

test('Captain Clawbeard rears back with the way shown, then charges along it, harder than a bump', () => {
  const sim = new MonsterSim(3);
  const w = meadow();
  const m = sim.add(w, 30.5, 11, 48.5, { kind: 'clawbeard' });
  assert.equal(m.plan, BOSSES.clawbeard);
  // Keeping ahead of him until he rears back, then standing still.
  let at = null;
  const got = run(sim, w, (now, seen) => {
    if (!at && seen.rears.length) at = { x: m.body.x + 8, z: m.body.z };
    return [onFoot(1, at?.x ?? m.body.x + 8, at?.z ?? m.body.z)];
  }, (s) => s.bumps.length > 0);
  const [rear] = got.rears;
  assert.ok(rear, 'he reared back');
  assert.equal(rear.monster, m);
  assert.ok(Math.abs(rear.yaw - Math.PI / 2) < 0.2, 'facing whoever he is after');
  assert.equal(rear.far, BOSSES.clawbeard.moves[0].far);
  assert.ok(got.states.has('rear') && got.states.has('charge'));
  const [bump] = got.bumps;
  assert.equal(bump.pid, 1);
  assert.equal(bump.charge, true);
  assert.equal(bump.bumps, BOSSES.clawbeard.moves[0].bumps, 'harder than his bump');
  assert.equal(m.dash, null, 'that is his charge done');
});

test('a boss charging into a wall is held there: bonk, and it sits dazed', () => {
  const sim = new MonsterSim(5);
  const w = meadow();
  // A wall three blocks high between him and whoever he is after, too long to get round.
  for (let z = 10; z < 86; z++) for (let y = 11; y < 14; y++) w.set(36, y, z, B.STONE);
  const m = sim.add(w, 31.5, 11, 48.5, { kind: 'clawbeard' });
  const got = run(sim, w, () => [onFoot(1, 41.5, 48.5)], (s) => s.bonks.length > 0);
  assert.ok(got.bonks.length, 'bonk');
  assert.equal(got.bonks[0].monster, m);
  assert.ok(m.dazed > got.at, 'dazed');
  assert.ok(m.body.x < 36, 'still his side of the wall');
});

test('a boss throws one at each of the nearest few, coming down where they stood: only whoever is still there is hit', () => {
  const { room, time } = meadowRoom();
  const a = join(room, 'Stays Put');
  const b = join(room, 'Runs Off');
  // (Away from the island's start, a safe place nothing is thrown at.)
  const boss = room.monsters.add(room.world, 20.5, 11, 20.5, { kind: 'frostfang' });
  // Both well out of his stomp's reach, a ahead of him and b to one side,
  // until he throws; then b runs.
  let hurl = null;
  for (let t = 0; t < 20000 && !hurl; t += 100) {
    time.t += 100;
    room.receive(a, { t: 'm', s: [boss.body.x + 10, 11, boss.body.z, 0, 0, 0] });
    room.receive(b, { t: 'm', s: [boss.body.x, 11, boss.body.z + 10, 0, 0, 0] });
    room.tick();
    hurl = a.last('mfx')?.kind === 'hurl' ? a.last('mfx') : null;
  }
  assert.ok(hurl, 'he threw');
  assert.equal(hurl.what, 'snowball');
  assert.equal(hurl.to.length, 2, 'one at each');
  assert.equal(hurl.r, BOSSES.frostfang.moves[1].reach);
  const [bx, , bz] = hurl.to.find(([x, , z]) => Math.abs(z - boss.body.z) > 6);
  room.receive(b, { t: 'm', s: [bx + 5, 11, bz, 0, 0, 0] });
  assert.deepEqual(a.all('bump'), [], 'nothing yet: it is in the air');
  for (let t = 0; t < hurl.ms + 300; t += 100) {
    time.t += 100;
    room.tick();
  }
  const hit = a.all('bump').filter((m) => m.hurl === 'snowball');
  assert.deepEqual(hit.map((m) => m.pid), [a.pid], 'the one who stayed is hit, the one who ran is not');
  assert.equal(hit[0].hp, room.players.get(a.pid).maxHp - BOSSES.frostfang.moves[1].bumps * BUMP_HP);
});

test('Gumbo leaps onto where you stood, the ring there showing where, and lands with a thump, dazed', () => {
  const sim = new MonsterSim(9);
  const w = meadow();
  const m = sim.add(w, 30.5, 11, 48.5, { kind: 'gumbo' });
  // Keeping ahead of him until he crouches, then standing still.
  let at = null;
  let was = null;
  const got = run(sim, w, (now, seen) => {
    if (!at && seen.leaps.length) at = was;
    was = at ?? { x: m.body.x + 8, z: m.body.z + 2 };
    return [onFoot(1, was.x, was.z, 11, Infinity)];
  }, (s) => s.stomps.length > 0);
  const [leap] = got.leaps;
  assert.ok(leap, 'he crouched to leap');
  assert.ok(Math.hypot(leap.x - at.x, leap.z - at.z) < 0.01, 'at where you stood');
  assert.equal(leap.reach, BOSSES.gumbo.moves[0].reach);
  assert.ok(leap.ms > BOSSES.gumbo.moves[0].windup, 'shown from his crouch to his landing');
  const [stomp] = got.stomps;
  assert.equal(stomp.leap, true);
  assert.ok(Math.hypot(stomp.x - leap.x, stomp.z - leap.z) < 1.2, `came down there (${Math.hypot(stomp.x - leap.x, stomp.z - leap.z).toFixed(2)} off)`);
  assert.equal(stomp.reach, leap.reach);
  assert.ok(m.dazed > got.at - 100, 'and sits dazed');
  assert.ok(got.states.has('leap'));
});

test('Bogmaw, very cross, puffs a cloud of swamp gas all round him; Moltok breathes fire the way he faces', () => {
  const sim = new MonsterSim(11);
  const w = meadow();
  const toad = sim.add(w, 30.5, 11, 48.5, { kind: 'bogmaw' });
  toad.rage = 2;
  toad.turn = 2;
  const got = run(sim, w, () => [onFoot(1, 33.5, 48.5, 11), onFoot(2, 40.5, 48.5, 11)], (s) => s.puffs.length > 0);
  const [puff] = got.puffs;
  assert.ok(puff, 'he puffed');
  assert.equal(puff.what, 'gas');
  assert.equal(puff.reach, 5);
  assert.deepEqual(got.burns.map((b) => [b.pid, b.spores, b.bumps]), [[1, true, 1.5]], 'only whoever was in it');
  sim.clear();
  const golem = sim.add(w, 30.5, 11, 48.5, { kind: 'moltok' });
  // One in front of him, one behind.
  const fire = run(sim, w, () => [onFoot(1, golem.body.x + 4, golem.body.z, 11), onFoot(2, golem.body.x - 4, golem.body.z + 0.5, 11, Infinity)], (s) => s.fires.length > 0 && s.burns.length > 0, 20000);
  assert.ok(fire.fires.length, 'he breathed fire');
  assert.ok(fire.states.has('breathe'));
  assert.deepEqual(fire.burns.map((b) => [b.pid, b.bumps]), [[1, 1.5]]);
});

test('each isle stage’s lair holds its chapter’s boss, with its hearts, in a bubble until every camp is free; popped, the stage is won', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '424242', adventure: true, shared: true, stage: 3, seed: 5, now: () => time.t });
  const adv = room.adventure;
  assert.equal(adv.boss, 'frostfang');
  const a = join(room);
  room.players.get(a.pid).safeUntil = Infinity;
  const castle = adv.castle;
  const near = () => {
    time.t += 100;
    room.receive(a, { t: 'm', s: [castle.x + castle.r + 12, castle.y, castle.z, 0, 0, 0] });
    room.tick();
  };
  near();
  const boss = room.monsters.list.find((m) => m.camp === castle.id);
  assert.equal(boss.kind, 'frostfang');
  assert.equal(boss.plan, BOSSES.frostfang);
  assert.equal(adv.king.max, bossHearts(BOSSES.frostfang, 1, 3));
  assert.equal(boss.passive, true, 'in his bubble');
  for (const c of adv.camps) if (c.kind === 'camp') room.campFreed(adv.free(c, [], room.monsters));
  near();
  assert.equal(boss.passive, false);
  for (let t = 0; t < 120000 && !adv.won; t += KING_HIT_MS) {
    time.t += KING_HIT_MS;
    room.receive(a, { t: 'm', s: [boss.body.x + boss.body.radius + 1, boss.body.y, boss.body.z, 0, 0, 0] });
    room.receive(a, { t: 'bop', id: boss.id });
    room.tick();
  }
  assert.equal(adv.won, true, 'popped');
  assert.ok(a.all('kinghit').length > 0);
  assert.equal(a.last('won').hero, a.pid);
});
