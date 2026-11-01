// Robot kits: furniture in the Home tab after the computer, found beside
// you; robots built of parts made safe and worked out (joined to the hub,
// ports, what is on each axle); programs made safe; the ready-made robots
// doing on the play mat what they say (a square back to the start, a lap
// round the line, dodging bricks, a spinning propeller); wheels that roll
// only the way they face; the sensors; and the island keeping each kit's
// robot, passing it on, telling newcomers, saving it and dropping it with
// its kit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { modelBoxes } from '../public/js/shared/furniture.js';
import {
  analyse,
  BLOCK_CM,
  IslandEnv,
  seenColorOf,
  startFrom,
  cleanCode,
  cleanKit,
  cleanParts,
  countBlocks,
  DEFAULT_BRICKS,
  GRID,
  isKit,
  kitNear,
  lineDistance,
  MAT_D,
  MAT_W,
  matColor,
  MAX_BLOCKS,
  MAX_DEPTH,
  MAX_PARTS,
  problems,
  RobotSim,
  START,
  TEMPLATES,
} from '../public/js/shared/robokit.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { XP_FOR } from '../public/js/shared/levels.js';
import { STAT_KEYS, STICKERS } from '../public/js/shared/stickers.js';

const template = (key) => TEMPLATES.find((t) => t.key === key);
const runFor = (sim, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(1 / 60);
};
const deg = (a) => (a * 180) / Math.PI;

test('the robot kit is furniture that turns, in the Home tab after the computer, found beside you', () => {
  const home = B.blocksIn('home');
  assert.equal(home[home.indexOf(B.COMPUTER) + 1], B.ROBOT_KIT);
  for (let k = 0; k < 4; k++) assert.ok(isKit(B.ROBOT_KIT + k));
  for (const id of [B.COMPUTER, B.GO_BOARD, B.AIR]) assert.ok(!isKit(id));
  for (const [x0, y0, z0, x1, y1, z1] of modelBoxes(B.ROBOT_KIT)) assert.ok(x0 >= 0 && z0 >= 0 && y0 >= 0 && x1 <= 1 && z1 <= 1 && y1 <= 1 && x1 > x0 && y1 > y0 && z1 > z0);
  const world = { get: (x, y, z) => (x === 5 && y === 1 && z === 5 ? B.ROBOT_KIT : B.AIR) };
  assert.deepEqual(kitNear(world, { x: 6.6, y: 1, z: 5.5 }), { x: 5, y: 1, z: 5, key: '5,1,5' });
  assert.equal(kitNear(world, { x: 9, y: 1, z: 5.5 }), null);
});

test('a robot is made safe: on the plate, not overlapping, one hub, so many parts', () => {
  const parts = cleanParts([
    { k: 'hub', x: 3, z: 3, r: 1 },
    { k: 'hub', x: 0, z: 0 },
    { k: 'motor', x: 4, z: 4 },
    { k: 'motor', x: 2, z: 3, r: 7 },
    { k: 'wheel', x: GRID - 1, z: GRID },
    { k: 'hub', x: GRID - 1, z: 0 },
    { k: 'rocket', x: 0, z: 0 },
    { k: 'caster', x: 1.5, z: 0 },
    { k: 'beam', x: 0, z: 0, r: 2 },
    null,
  ]);
  assert.deepEqual(parts, [
    { k: 'hub', x: 3, z: 3, r: 1 },
    { k: 'motor', x: 2, z: 3, r: 3 },
    { k: 'beam', x: 0, z: 0, r: 0 },
  ]);
  const many = cleanParts(Array.from({ length: 100 }, (_, i) => ({ k: 'beam', x: i % GRID, z: Math.floor(i / GRID) })));
  assert.equal(many.length, MAX_PARTS);
});

test('what joins the hub, the ports in the order parts went on, and what turns on each axle', () => {
  const t = template('car');
  const info = analyse(cleanParts(t.parts));
  assert.equal(info.joined.size, t.parts.length);
  assert.deepEqual(Object.keys(info.ports), ['A', 'B']);
  assert.deepEqual([...info.onAxle], [[1, 3], [2, 4]], 'each wheel on its motor');
  assert.deepEqual(problems(cleanParts(t.parts)), []);
  // A part not touching the rest has no port, and is said to be loose.
  const loose = cleanParts([...t.parts, { k: 'distance', x: 8, z: 8 }]);
  const li = analyse(loose);
  assert.ok(!li.joined.has(loose.length - 1));
  assert.equal(li.portOf.get(loose.length - 1), undefined);
  assert.match(problems(loose)[0], /distance sensor is not joined/);
  assert.match(problems([])[0], /hub/);
  // Only six ports.
  const seven = cleanParts([{ k: 'hub', x: 0, z: 0 }, ...Array.from({ length: 7 }, (_, i) => ({ k: 'lamp', x: 2 + (i % 4), z: Math.floor(i / 4) }))]);
  assert.equal(Object.keys(analyse(seven).ports).length, 6);
  assert.ok(problems(seven).some((p) => /six ports/.test(p)));
});

test('a program is made safe: known blocks, fields in range, so many blocks, so deep', () => {
  const code = cleanCode([
    { op: 'move', dir: 'sideways', cm: 9999 },
    { op: 'explode' },
    { op: 'run', p: 'Z', dir: -1, sec: -3 },
    { op: 'ifelse', c: { s: 'color', p: 'B', col: 'pink' }, do: [{ op: 'beep', note: 61, sec: 9 }], else: 'nope' },
    { op: 'until', c: { s: 'near', cm: 'far' } },
  ]);
  assert.deepEqual(code, [
    { op: 'move', dir: 'fwd', cm: 200 },
    { op: 'run', p: 'A', dir: -1, sec: 0.1 },
    { op: 'ifelse', c: { s: 'color', p: 'B', col: 'black' }, do: [{ op: 'beep', note: 60, sec: 4 }], else: [] },
    { op: 'until', c: { s: 'near', p: 'A', cm: 10 } },
  ]);
  const deep = (n) => (n ? [{ op: 'forever', do: deep(n - 1) }] : [{ op: 'halt' }]);
  let b = cleanCode(deep(10))[0];
  let depth = 1;
  while (b.do.length) {
    b = b.do[0];
    depth++;
  }
  assert.equal(depth, MAX_DEPTH);
  assert.equal(countBlocks(cleanCode(Array.from({ length: 200 }, () => ({ op: 'repeat', n: 2, do: [{ op: 'halt' }] })))), MAX_BLOCKS);
  assert.equal(cleanKit({ parts: [], code: [] }), null, 'an empty kit is nothing to keep');
  for (const t of TEMPLATES) assert.deepEqual(cleanCode(t.code), t.code, `${t.key}'s program is already clean`);
});

test('the play mat: a black line round a stadium, coloured squares, white elsewhere', () => {
  assert.equal(matColor(START.x, START.z), 'black', 'robots start on the line');
  assert.equal(matColor(0, 0), 'white');
  assert.equal(matColor(-66, -43), 'red');
  assert.equal(matColor(66, 43), 'yellow');
  assert.equal(lineDistance(35 + 28, 0), 0, 'round the end');
});

test('the Driving Base drives a square and comes back to where it started, facing the same way', () => {
  const t = template('car');
  const sim = new RobotSim(cleanParts(t.parts));
  sim.start(cleanCode(t.code));
  runFor(sim, 4);
  assert.ok(sim.x > 10, 'off along the line');
  runFor(sim, 20);
  assert.equal(sim.running, false, 'done');
  assert.ok(Math.hypot(sim.x - START.x, sim.z - START.z) < 3, `back at the start (${sim.x.toFixed(1)}, ${sim.z.toFixed(1)})`);
  assert.ok(Math.abs(((deg(sim.a - START.a) % 360) + 540) % 360 - 180) < 3, 'facing the same way');
  assert.equal(sim.matrix, '.....' + '.#.#.' + '.....' + '#...#' + '.###.', 'smiling');
  assert.deepEqual(sim.sounds.at(-1), { note: 72, sec: 0.5 });
});

test('the Line Follower goes all the way round the line and never leaves it', () => {
  const t = template('line');
  const sim = new RobotSim(cleanParts(t.parts));
  sim.start(cleanCode(t.code));
  const seen = new Set();
  let far = 0;
  for (let i = 0; i < 60 * 45; i++) {
    sim.step(1 / 60);
    const s = sim.placeOf(sim.info.ports.C);
    far = Math.max(far, lineDistance(s.x, s.z));
    seen.add(`${Math.sign(Math.round(sim.x / 30))},${Math.sign(Math.round(sim.z / 20))}`);
  }
  assert.ok(far < 3, `its sensor within 3 cm of the line (${far.toFixed(1)})`);
  for (const side of ['1,0', '-1,0', '0,1', '0,-1']) assert.ok(seen.has(side), `went by ${side}`);
  assert.ok(sim.running, 'forever');
});

test('the Brick Dodger never drives into a brick or the fence, and backs off when one is near', () => {
  const t = template('bumper');
  const sim = new RobotSim(cleanParts(t.parts));
  sim.start(cleanCode(t.code));
  let surprised = 0;
  for (let i = 0; i < 60 * 60; i++) {
    sim.step(1 / 60);
    assert.ok(!sim.hits(sim.x, sim.z, sim.a));
    if (sim.lamps.D === 'red') surprised++;
  }
  assert.ok(surprised > 0, 'saw something coming');
  assert.ok(Math.abs(sim.x) < MAT_W / 2 && Math.abs(sim.z) < MAT_D / 2);
});

test('the Disco Fan spins its propeller, flashes its lamp and stays put', () => {
  const t = template('fan');
  const sim = new RobotSim(cleanParts(t.parts));
  sim.start(cleanCode(t.code));
  const lamps = new Set();
  for (let i = 0; i < 60 * 3; i++) {
    sim.step(1 / 60);
    lamps.add(sim.lamps.B);
  }
  assert.ok(sim.motors.A.deg > 500, 'going round');
  assert.ok(['red', 'yellow', 'blue'].every((c) => lamps.has(c)));
  assert.deepEqual([sim.x, sim.z], [START.x, START.z], 'no wheels, nowhere to go');
  runFor(sim, 10);
  assert.equal(sim.running, false);
  assert.equal(sim.motors.A.on, 0, 'stopped at the end');
});

test('wheels roll only the way they face: one wheel driven turns the robot about the other, and wheels set across go nowhere', () => {
  const parts = cleanParts(template('car').parts);
  const sim = new RobotSim(parts, []);
  const right = () => sim.placeOf(4);
  const before = right();
  sim.start(cleanCode([{ op: 'run', p: 'A', dir: 1, sec: 2 }]));
  runFor(sim, 2.5);
  const after = right();
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.5, 'the right wheel stays where it is');
  assert.ok(deg(sim.a - START.a) > 30, 'turning right about it');
  // Motors with their axles to the front: the wheels roll sideways, so
  // moving forward goes nowhere.
  const across = new RobotSim(cleanParts([{ k: 'hub', x: 3, z: 3 }, { k: 'motor', x: 3, z: 2, r: 0 }, { k: 'wheel', x: 3, z: 1 }, { k: 'caster', x: 4, z: 5 }]), []);
  across.start(cleanCode([{ op: 'move', dir: 'fwd', cm: 20 }]));
  runFor(across, 2);
  assert.deepEqual([across.x, across.z, across.running], [START.x, START.z, false]);
});

test('the sensors: how far a brick is, the colour under it, the bumper pressed', () => {
  const parts = cleanParts([...template('car').parts, { k: 'distance', x: 3, z: 2 }, { k: 'bumper', x: 4, z: 2 }, { k: 'beam', x: 2, z: 4 }, { k: 'color', x: 2, z: 5 }]);
  const sim = new RobotSim(parts, [[3, 3]]);
  // Facing +x on the start line; the brick from x = 24 to 32.
  const front = sim.placeOf(sim.info.ports.C);
  assert.equal(sim.distance('C'), Math.round(24 - (front.x + 2)));
  assert.equal(sim.distance('A'), null, 'a motor sees nothing');
  assert.ok(sim.test({ s: 'near', p: 'C', cm: 30 }) && !sim.test({ s: 'far', p: 'C', cm: 30 }));
  assert.equal(sim.color('E'), 'white');
  assert.ok(!sim.pressed('D'));
  sim.start(cleanCode([{ op: 'go', dir: 'fwd' }, { op: 'until', c: { s: 'pressed', p: 'D' } }, { op: 'show', img: 'heart' }, { op: 'halt' }]));
  runFor(sim, 5);
  assert.ok(sim.pressed('D'), 'bumped into it');
  assert.equal(sim.matrix, '.#.#.' + '#####' + '#####' + '.###.' + '..#..');
  assert.ok(sim.distance('C') <= 2);
  assert.ok(!sim.hits(sim.x, sim.z, sim.a));
});

test('a loop that never waits does not hang: it goes round once a tick', () => {
  const sim = new RobotSim(cleanParts(template('car').parts), DEFAULT_BRICKS);
  sim.start(cleanCode([{ op: 'forever', do: [{ op: 'show', img: 'star' }] }]));
  runFor(sim, 1);
  assert.ok(sim.running);
  sim.stop();
  assert.ok(!sim.running && !sim.program);
});

test('runs are counted, with XP and the Robot Maker sticker for 10', () => {
  assert.ok(STAT_KEYS.includes('robotruns') && XP_FOR.robotruns);
  const s = STICKERS.find((k) => k.key === 'robot-maker');
  assert.ok(s.test({ robotruns: 10 }) && !s.test({ robotruns: 9 }));
});

function island() {
  const time = { t: 1e6 };
  const room = new Room({ code: '123456', theme: 'sunny', name: 'Sunny Cove', seed: 42, now: () => time.t });
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
  room.world.set(x, y, z, B.ROBOT_KIT);
  p.s = [x - 0.5, y, z + 0.5, 0, 0, 0];
  return { room, conn, a, b, pid, p, x, y, z, time };
}

// A floor of snow round (x, y - 1, z), clear above it.
function floor(room, x, y, z) {
  for (let dx = -2; dx <= 8; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      room.world.set(x + dx, y - 1, z + dz, B.SNOW);
      for (let dy = 0; dy < 3; dy++) if (dx || dz || dy) room.world.set(x + dx, y + dy, z + dz, B.AIR);
    }
  }
}

test('the island keeps a kit\'s robot from someone at it, passes it on, tells newcomers, saves it, and drops it with its kit', () => {
  const { room, conn, a, b, pid, p, x, y, z } = island();
  const t = template('line');
  room.receive(a, { t: 'kit', at: [x, y, z], kit: { parts: t.parts, code: t.code, junk: 1 } });
  const kit = { parts: cleanParts(t.parts), code: t.code };
  assert.deepEqual(b.all('kit'), [{ t: 'kit', pid, at: [x, y, z], kit }]);
  assert.equal(a.all('kit').length, 0, 'not back to the one building');
  for (const bad of [{ at: [x, y + 1, z] }, { at: [x, y] }, { at: 'here' }]) room.receive(a, { t: 'kit', at: [x, y, z], kit, ...bad });
  p.s = [x + 8, y, z, 0, 0, 0];
  room.receive(a, { t: 'kit', at: [x, y, z], kit });
  assert.equal(b.all('kit').length, 1, 'nothing at no kit, nor from too far away');
  const c = conn();
  assert.deepEqual(c.inbox.find((m) => m.t === 'welcome').kits, [[x, y, z, kit]]);
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  assert.deepEqual(new Room({ save }).packKits(), [[x, y, z, kit]]);
  const broken = { ...save, kits: [...save.kits, [x + 1, y, z, kit], [x, y, z + 1, 'nonsense'], 'oops'] };
  assert.equal(new Room({ save: broken }).kits.size, 1);
  // Emptied, it is nothing to keep.
  p.s = [x - 0.5, y, z + 0.5, 0, 0, 0];
  room.receive(a, { t: 'kit', at: [x, y, z], kit: { parts: [], code: [] } });
  assert.equal(room.kits.size, 0);
  room.receive(a, { t: 'kit', at: [x, y, z], kit });
  // Picked up: its robot goes with it, for everyone.
  room.world.set(x, y, z, B.AIR);
  assert.equal(room.kits.size, 0);
  assert.deepEqual(b.all('kit').at(-1), { t: 'kit', at: [x, y, z], kit: null });
  assert.equal(room.exportSave().kits, undefined, 'none saved');
});

test('on the island a block\'s colour is seen as the nearest colour the sensor knows, and a robot sets off in front of its kit', () => {
  assert.equal(seenColorOf('#2c2f36'), 'black');
  assert.equal(seenColorOf('#f7f5ef'), 'white');
  assert.equal(seenColorOf('#6cc24a'), 'green');
  const cells = new Map();
  const world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 5 ? B.STONE : B.AIR) };
  // Facing +x: the cell in front, on its floor, heading +x.
  const s = startFrom(world, 10, 5, 10, 0);
  assert.deepEqual(s, { x: 11.5 * BLOCK_CM, z: 10.5 * BLOCK_CM, a: Math.PI / 2, level: 5 });
  cells.set('11,5,10', B.STONE);
  assert.equal(startFrom(world, 10, 5, 10, 0), null, 'no room in front');
  // A wall ahead: the distance sensor sees it, and the robot stops short.
  cells.delete('11,5,10');
  cells.set('14,5,10', B.STONE);
  const env = new IslandEnv(world, 5);
  assert.equal(env.ray(11.5 * BLOCK_CM, 10.5 * BLOCK_CM, 1, 0, 200), 2.5 * BLOCK_CM);
  const sim = new RobotSim(cleanParts([...template('car').parts, { k: 'distance', x: 3, z: 2 }]), env);
  sim.reset(startFrom(world, 10, 5, 10, 0));
  sim.start(cleanCode([{ op: 'go', dir: 'fwd' }, { op: 'until', c: { s: 'near', p: 'C', cm: 5 } }, { op: 'halt' }]));
  runFor(sim, 20);
  assert.equal(sim.running, false, 'it saw the wall and stopped');
  assert.ok(sim.x < 14 * BLOCK_CM && sim.x > 12.5 * BLOCK_CM, `short of the wall (${(sim.x / BLOCK_CM).toFixed(2)})`);
  // Off the edge of a step it falls to the floor below; into water it is lost.
  for (let x = 12; x < 20; x++) cells.set(`${x},4,10`, B.AIR);
  cells.delete('14,5,10');
  const fall = new RobotSim(cleanParts(template('car').parts), new IslandEnv(world, 5));
  fall.reset(startFrom(world, 10, 5, 10, 0));
  fall.start(cleanCode([{ op: 'move', dir: 'fwd', cm: 60 }]));
  runFor(fall, 8);
  assert.equal(fall.env.level, 4);
  assert.ok(!fall.env.lost);
  for (let x = 12; x < 20; x++) cells.set(`${x},3,10`, B.WATER);
  const sink = new RobotSim(cleanParts(template('car').parts), new IslandEnv(world, 5));
  sink.reset(startFrom(world, 10, 5, 10, 0));
  sink.start(cleanCode([{ op: 'move', dir: 'fwd', cm: 60 }]));
  runFor(sink, 8);
  assert.ok(sink.env.lost);
});

test('a robot let out of its kit drives on the island for everyone, beeps, and is called back', () => {
  const { room, a, b, x, y, z, time } = island();
  floor(room, x, y, z);
  const id = B.turnedTo(B.ROBOT_KIT, 0);
  room.world.set(x, y, z, id);
  const t = template('car');
  room.receive(a, { t: 'kit', at: [x, y, z], kit: { parts: t.parts, code: [{ op: 'beep', note: 64, sec: 0.2 }, { op: 'move', dir: 'fwd', cm: 40 }] } });
  room.receive(a, { t: 'kitrun', at: [x, y, z], op: 'run' });
  const out = b.all('bots').at(-1).b;
  assert.equal(out.length, 1);
  assert.equal(out[0].k, `${x},${y},${z}`);
  assert.ok(Math.abs(out[0].x - (x + 1.5)) < 0.01 && out[0].y === y);
  for (let i = 0; i < 60; i++) {
    time.t += 100;
    room.tick();
  }
  const now = b.all('bots').at(-1).b[0];
  assert.ok(Math.abs(now.x - (x + 2.5)) < 0.05, `a block on (${now.x - x})`);
  assert.equal(now.r, false, 'its program done, it waits there');
  assert.deepEqual(b.all('botbeep')[0], { t: 'botbeep', k: `${x},${y},${z}`, n: 64, s: 0.2 });
  // Newcomers see it out; editing the kit calls it back.
  room.receive(a, { t: 'kitrun', at: [x, y, z], op: 'run' });
  assert.equal(room.packBots().length, 1);
  room.receive(a, { t: 'kitrun', at: [x, y, z], op: 'home' });
  assert.deepEqual(b.all('bots').at(-1).b, []);
  // No program, or no room in front: it stays in.
  room.world.set(x + 1, y, z, B.STONE);
  room.receive(a, { t: 'kitrun', at: [x, y, z], op: 'run' });
  assert.equal(room.bots.size, 0);
  assert.match(a.all('notice').at(-1).text, /no room/);
});
