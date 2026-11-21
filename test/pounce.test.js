// Pouncing: most monsters, once near enough, stop a little further off than an
// arm reaches and crouch, a strip on the ground showing the way they will
// spring; then they spring along it quicker than anyone runs. Standing still,
// it gets you; a step aside (or a jump) and it misses, and sits dizzy a moment,
// when a bop counts twice and knocks it nowhere. A bop cuts a crouch short,
// but once it has sprung nothing stops it. Someone getting away is chased as
// ever, not pounced at, and bosses and beasts keep to moves of their own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { ARM_REACH, bodyOf, kindPounces, KINDS, MONSTER_STATES, MonsterSim, POUNCE, TIRED_HIT } from '../public/js/shared/monsters.js';
import { MOVE } from '../public/js/shared/physics.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';

function meadow(W = 128) {
  const w = new World({ W, H: 32, D: W, sea: 4, theme: 'flat', spawn: { x: 10.5, y: 11, z: 10.5 } });
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y <= 10; y++) w.set(x, y, z, y === 10 ? B.GRASS : B.DIRT);
  return w;
}

const onFoot = (x, z) => ({ id: 1, x, y: 11, z, flying: false, riding: false, dizzy: false, safeUntil: 0 });
// From the side of the one at b to the side of someone at p (as monsters.js bopGap).
const gapOf = (b, p) => Math.hypot(b.x - p.x, b.z - p.z) - b.radius - 0.3;

// One of kind coming after someone standing at p, stepped until it crouches.
function untilCrouch(kind, p, from = 7) {
  const sim = new MonsterSim(4);
  const w = meadow();
  const m = sim.add(w, p.x, 11, p.z + from, { kind });
  let now = 1_000_000;
  for (let t = 0; t < 8000 && m.state !== 'crouch'; t += 50) {
    now += 50;
    sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] });
  }
  return { sim, w, m, now };
}

test('most monsters pounce; bosses, beasts and those with a trick of their own never do', () => {
  for (const kind of ['blob', 'big', 'spiky', 'spider', 'knight', 'golem', 'snapper', 'mummy', 'gummy', 'cub', 'fox']) assert.ok(kindPounces(kind), kind);
  for (const kind of ['mosquito', 'queen', 'ghost', 'shroom', 'yeti', 'mole', 'king', 'clawbeard', 'grizzle', 'wolf', 'rex', 'boar']) assert.ok(!kindPounces(kind), kind);
  assert.deepEqual(MONSTER_STATES.slice(16), ['crouch', 'pounce'], 'new states go on the end: the wire sends the index');
  for (const [kind, k] of Object.entries(KINDS)) {
    if (!k.pounce || !kindPounces(kind)) continue;
    const p = k.pounce;
    assert.ok(p.speed > MOVE.run, `${kind}: quicker than you run, for a moment`);
    assert.ok(p.windup >= 450, `${kind}: crouched long enough to see it coming`);
    assert.ok(p.gap > ARM_REACH, `${kind}: crouched out of an arm's reach`);
    assert.ok(p.far > p.gap + bodyOf(kind).radius + 0.3, `${kind}: springing through where you stood`);
    assert.ok(p.tired >= 900, `${kind}: dizzy long enough for a bop or two`);
  }
});

test('one near you crouches out of reach, shows the way it will spring, then springs quicker than you run: standing still, it gets you', () => {
  const p = onFoot(60.5, 50.5);
  const { sim, w, m, now: start } = untilCrouch('blob', p);
  assert.equal(m.state, 'crouch', 'it crouched');
  const gap = gapOf(m.body, p);
  assert.ok(gap > ARM_REACH && gap <= POUNCE.gap, `out of an arm's reach, and near: ${gap.toFixed(2)}`);
  const [rear] = sim.takeRears();
  assert.equal(rear?.monster, m, 'everyone is told, to show it on the ground');
  assert.deepEqual([rear.far, rear.ms], [POUNCE.far, POUNCE.windup]);
  assert.ok(rear.w > m.body.radius * 2, 'as wide as it bumps, not only as wide as it is');
  const at = { x: m.body.x, z: m.body.z };
  let now = start;
  let fastest = 0;
  let bump = null;
  for (let t = 0; t < 3000 && !bump; t += 50) {
    now += 50;
    [bump] = sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] });
    if (m.state === 'crouch') assert.ok(Math.hypot(m.body.x - at.x, m.body.z - at.z) < 0.05, 'still while it crouches');
    if (m.state === 'crouch') assert.ok(now - start < POUNCE.windup, 'crouched no longer than its windup');
    if (m.state === 'pounce') fastest = Math.max(fastest, Math.hypot(m.body.vx, m.body.vz));
  }
  assert.ok(bump, 'it got them');
  assert.equal(bump.pounce, true, 'with a pounce');
  assert.ok(now - start >= POUNCE.windup, 'not before its crouch was over');
  assert.ok(fastest > MOVE.run, `quicker than you run: ${fastest.toFixed(1)}`);
});

test('a step aside and it misses: it sits dizzy, when a bop counts twice and knocks it nowhere', () => {
  const p = onFoot(60.5, 50.5);
  const { sim, w, m, now: start } = untilCrouch('knight', p);
  // Two steps across the way it will spring.
  Object.assign(p, { x: p.x - m.aim.z * 2, z: p.z + m.aim.x * 2 });
  let now = start;
  let bumps = 0;
  for (let t = 0; t < 3000 && m.state !== 'dazed'; t += 50) {
    now += 50;
    bumps += sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] }).length;
  }
  assert.equal(bumps, 0, 'it missed');
  assert.equal(m.state, 'dazed', 'and sits dizzy');
  assert.equal(m.tired, true);
  const hearts = m.hearts;
  const slide = Math.hypot(m.body.vx, m.body.vz);
  const hit = sim.hit(m, 1, p, now);
  assert.equal(hit.still, true, 'taken where it sits');
  assert.equal(m.hearts, hearts - TIRED_HIT, 'twice over');
  assert.equal(Math.hypot(m.body.vx, m.body.vz), slide, 'and not knocked anywhere');
  // Its dizzy spell over: a bop as ever, a heart and a knock.
  for (let t = 0; t < KINDS.knight.pounce.tired + 200; t += 50) {
    now += 50;
    sim.step(w, 0.05, now, [onFoot(p.x + 30, p.z)], false, { roam: false, havens: [] });
  }
  assert.equal(m.tired, false, 'up again');
  const again = sim.hit(m, 1, { x: m.body.x - 1, y: 11, z: m.body.z }, now + 1000);
  assert.ok(!again.still);
  assert.equal(m.hearts, hearts - TIRED_HIT - 1, 'one heart');
  assert.ok(Math.hypot(m.body.vx, m.body.vz) > 3, 'and knocked back');
});

test('a bop cuts a crouch short; once it has sprung, a bop lands but it keeps coming', () => {
  const p = onFoot(60.5, 50.5);
  const crouched = untilCrouch('knight', p);
  const hit = crouched.sim.hit(crouched.m, 1, p, crouched.now);
  assert.ok(!hit.still);
  assert.equal(crouched.m.crouch, 0, 'no more crouching');
  assert.ok(Math.hypot(crouched.m.body.vx, crouched.m.body.vz) > 3, 'knocked back out of it');

  const { sim, w, m, now: start } = untilCrouch('knight', p);
  let now = start;
  while (m.state !== 'pounce' && now < start + 3000) {
    now += 50;
    sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] });
  }
  assert.equal(m.state, 'pounce', 'springing');
  const hearts = m.hearts;
  const mid = sim.hit(m, 1, p, now);
  assert.equal(mid.still, true, 'the bop lands');
  assert.equal(m.hearts, hearts - 1);
  assert.ok(m.pounce, 'but on it comes');
  let bump = null;
  for (let t = 0; t < 1500 && !bump; t += 50) {
    now += 50;
    [bump] = sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] });
  }
  assert.ok(bump?.pounce, 'and gets them');
});

test('someone getting away is chased as ever, never crept up on or pounced at', () => {
  const sim = new MonsterSim(4);
  const w = meadow();
  const p = onFoot(30.5, 64.5);
  // A cross one right behind them, as they walk away.
  const m = sim.add(w, 28.5, 11, 64.5);
  let now = 1_000_000;
  sim.hit(m, 1, { x: 27.5, y: 11, z: 64.5 }, now);
  m.target = 1;
  let caught = false;
  for (let t = 0; t < 5000 && !caught; t += 50) {
    now += 50;
    p.x += 4.6 * 0.05;
    caught = sim.step(w, 0.05, now, [p], false, { roam: false, havens: [] }).length > 0;
    assert.notEqual(m.state, 'crouch', 'no crouching at someone walking away');
  }
  assert.ok(caught, 'caught walking, as before');
});

function conn() {
  const c = { inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.close = () => {};
  c.last = (t) => [...c.inbox].reverse().find((m) => m.t === t);
  return c;
}

test('everyone sees a crouch on the ground; a pounce that gets you says so, and a bop on one sitting dizzy is told as still', () => {
  const time = { t: 1_000_000 };
  const room = new Room({ code: '123456', theme: 'flat', seed: 7, now: () => time.t, settings: { monsters: true } });
  room.world = meadow();
  room.hookWorld();
  room.monsters.spawnAt = Infinity;
  const a = conn();
  room.attach(a);
  room.receive(a, { t: 'join', protocol: PROTOCOL, name: 'Happy Panda', look: { animal: 'cat', fur: 'orange', shirt: 3, hat: 'cap' } });
  const me = { x: 60.5, z: 50.5 };
  const m = room.monsters.add(room.world, me.x, 11, me.z + 7, { kind: 'knight' });
  const stand = () => room.receive(a, { t: 'm', s: [me.x, 11, me.z, 0, 0, 0] });
  // Each bump knocks them back, as the page does (game.js bumped): a few steps.
  let bumps = 0;
  const knocked = () => {
    const n = a.inbox.filter((x) => x.t === 'bump').length;
    if (n === bumps) return;
    bumps = n;
    const d = Math.hypot(me.x - m.body.x, me.z - m.body.z) || 1;
    Object.assign(me, { x: m.body.x + ((me.x - m.body.x) / d) * 4, z: m.body.z + ((me.z - m.body.z) / d) * 4 });
  };
  for (let t = 0; t < 8000 && !a.last('bump'); t += 100) {
    time.t += 100;
    stand();
    room.tick();
  }
  knocked();
  const rear = a.inbox.find((x) => x.t === 'mfx' && x.kind === 'rear' && x.id === m.id);
  assert.ok(rear, 'the strip everyone sees');
  assert.deepEqual([rear.d, rear.ms], [KINDS.knight.pounce.far, KINDS.knight.pounce.windup]);
  assert.ok(rear.w > m.body.radius * 2);
  assert.equal(a.last('bump')?.pounce, true, 'a pounce got them');
  // The next one missed (they step aside as it crouches), then a bop.
  let dazed = false;
  for (let t = 0; t < 12000 && !dazed; t += 100) {
    time.t += 100;
    if (m.state === 'crouch' && !m.dodged) {
      m.dodged = true;
      Object.assign(me, { x: me.x - m.aim.z * 2.2, z: me.z + m.aim.x * 2.2 });
    }
    stand();
    room.tick();
    knocked();
    dazed = m.state === 'dazed' && m.tired;
  }
  assert.ok(dazed, 'it missed, and sits dizzy');
  room.receive(a, { t: 'm', s: [m.body.x - 1, 11, m.body.z, 0, 0, 0] });
  room.receive(a, { t: 'bop', id: m.id });
  const hit = a.last('mhit');
  assert.equal(hit?.id, m.id);
  assert.equal(hit.still, true, 'still: the page does not knock it back');
  assert.equal(hit.hearts, KINDS.knight.hearts - TIRED_HIT, 'and it took two');
});
