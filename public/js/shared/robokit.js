// Robot kits: a box of programmable robot parts (a piece of furniture,
// blocks.js), like a real robotics kit. Walk up to one and its window opens
// (ui-robokit.js) on three tabs:
//
// - 🔧 Build: snap parts onto a build plate of GRID by GRID studs — the hub
//   (the brain: a 5×5 light matrix, a speaker, a gyro and six ports A to F),
//   motors, wheels (on a motor's axle they drive, anywhere else they just
//   roll), a ball wheel, beams to join things up, a distance sensor, a
//   colour sensor, a bumper, a lamp and a propeller. Each motor and sensor
//   joined to the hub gets a port and a cable, in the order they went on.
// - 🧩 Code: a program of word blocks under "when program starts", as in
//   the apps of real kits: motors, movement, lights, sounds, waiting,
//   loops and "if" on what the sensors see.
// - ▶ Play mat: the robot runs its program on a play mat, a white mat with a
//   black line round it, four coloured squares and toy bricks in the way.
//   It drives as a real one does: each wheel rolls only the way it faces
//   and its motor turns it (wheels pulling different ways skid), and the
//   sensors see the mat and the bricks.
//
// The island keeps each kit's robot and program (room.js), so friends see
// the robot standing on its kit and can open it, change it and run it too.
// The play mat is your own: runs are never sent anywhere.
//
// No DOM here: the island, the pages and the tests all share it. Lengths
// are in centimetres, as on a real kit; one stud of the plate is CELL.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

export const isKit = (id) => BLOCKS[id]?.model === 'robot-kit';

// The kit nearest a body standing beside it: { x, y, z, key }, or null.
export const kitNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isKit(id) ? {} : null), reach);

// The build plate, GRID by GRID studs of CELL centimetres.
export const GRID = 9;
export const CELL = 4;
// The most parts one robot has, and the most robots an island keeps.
export const MAX_PARTS = 40;
export const MAX_KITS = 64;
// The most blocks one program has, and how deep loops and ifs may go.
export const MAX_BLOCKS = 80;
export const MAX_DEPTH = 5;

// The ways a part can face on the plate: 0 up the plate (-z), 1 right (+x),
// 2 down (+z) and 3 left (-x). The hub's way is the robot's front.
export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'];

// The parts. `size` in studs (the hub is 2×2, the rest 1×1); `port` if it
// plugs into one; `turns` if which way it faces matters.
export const PARTS = {
  hub: { name: 'Hub', icon: '🟨', size: 2, turns: true, about: 'The brain: a light matrix, a speaker, a gyro and six ports. Its light matrix faces the robot\'s front.' },
  motor: { name: 'Motor', icon: '⚙️', port: true, turns: true, about: 'Turns its axle round. Put a wheel or a propeller on the axle side.' },
  wheel: { name: 'Wheel', icon: '🛞', turns: true, about: 'On a motor\'s axle it drives. Anywhere else it just rolls along.' },
  caster: { name: 'Ball Wheel', icon: '⚪', about: 'A ball that rolls any way: a third wheel to lean on.' },
  beam: { name: 'Beam', icon: '🟦', about: 'Joins parts together. Everything must be joined to the hub.' },
  distance: { name: 'Distance Sensor', icon: '👀', port: true, turns: true, about: 'Sees how far away the nearest thing in front of it is, up to 200 cm.' },
  color: { name: 'Color Sensor', icon: '🔴', port: true, about: 'Looks down at the mat and tells its colour.' },
  bumper: { name: 'Bumper', icon: '🔘', port: true, turns: true, about: 'A button on the front: it knows when it bumps into something.' },
  lamp: { name: 'Lamp', icon: '💡', port: true, about: 'A light that shines any colour you tell it to.' },
  propeller: { name: 'Propeller', icon: '🌀', turns: true, about: 'Spins on a motor\'s axle: make a fan, a windmill or a helicopter!' },
};
export const PART_KEYS = Object.keys(PARTS);

// Colours a lamp shines and the colour sensor sees.
export const COLORS = {
  off: { name: 'Off', hex: '#3a3f4a' },
  white: { name: 'White', hex: '#ffffff' },
  black: { name: 'Black', hex: '#1d2026' },
  red: { name: 'Red', hex: '#f0453a' },
  orange: { name: 'Orange', hex: '#ff9a2a' },
  yellow: { name: 'Yellow', hex: '#ffd52e' },
  green: { name: 'Green', hex: '#2fbf5a' },
  blue: { name: 'Blue', hex: '#2f7cf0' },
  purple: { name: 'Purple', hex: '#9b5cf0' },
};
export const LAMP_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'off'];
export const SEEN_COLORS = ['black', 'white', 'red', 'green', 'blue', 'yellow'];

// Pictures for the hub's 5×5 light matrix, row by row from the top.
export const IMAGES = {
  happy: { name: 'Happy', px: '.....' + '.#.#.' + '.....' + '#...#' + '.###.' },
  sad: { name: 'Sad', px: '.....' + '.#.#.' + '.....' + '.###.' + '#...#' },
  heart: { name: 'Heart', px: '.#.#.' + '#####' + '#####' + '.###.' + '..#..' },
  star: { name: 'Star', px: '..#..' + '#####' + '.###.' + '.#.#.' + '#...#' },
  surprised: { name: 'Surprised', px: '.#.#.' + '.....' + '..#..' + '.#.#.' + '..#..' },
  up: { name: 'Arrow up', px: '..#..' + '.###.' + '#.#.#' + '..#..' + '..#..' },
  down: { name: 'Arrow down', px: '..#..' + '..#..' + '#.#.#' + '.###.' + '..#..' },
  left: { name: 'Arrow left', px: '..#..' + '.#...' + '#####' + '.#...' + '..#..' },
  right: { name: 'Arrow right', px: '..#..' + '...#.' + '#####' + '...#.' + '..#..' },
  yes: { name: 'Yes', px: '.....' + '....#' + '...#.' + '#.#..' + '.#...' },
  no: { name: 'No', px: '#...#' + '.#.#.' + '..#..' + '.#.#.' + '#...#' },
  square: { name: 'Square', px: '#####' + '#...#' + '#...#' + '#...#' + '#####' },
};
export const BLANK = '.'.repeat(25);

// Notes the speaker beeps, as MIDI numbers, and their names.
export const NOTES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteName = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

// How the motors and wheels go: a wheel 5.6 cm across, and a motor at 100%
// turning MAX_DPS degrees a second.
export const WHEEL_D = 5.6;
export const MAX_DPS = 660;
export const DEFAULT_SPEED = 50;
// How far the distance sensor sees.
export const SEE_CM = 200;

// ------------------------------------------------------------ building

const clampInt = (v, lo, hi, def) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : def);

// The studs a part covers.
export function cellsOf(part) {
  const n = PARTS[part.k]?.size ?? 1;
  const out = [];
  for (let dx = 0; dx < n; dx++) for (let dz = 0; dz < n; dz++) out.push([part.x + dx, part.z + dz]);
  return out;
}

// Where a part's middle is on the plate, in studs.
export const middleOf = (part) => {
  const n = PARTS[part.k]?.size ?? 1;
  return [part.x + n / 2, part.z + n / 2];
};

// A robot as it came from anywhere, made safe: { parts: [{ k, x, z, r }] },
// parts on the plate that do not overlap, one hub at most, MAX_PARTS at most.
export function cleanParts(raw) {
  const parts = [];
  const taken = new Set();
  let hub = false;
  for (const p of Array.isArray(raw) ? raw.slice(0, MAX_PARTS * 2) : []) {
    if (parts.length >= MAX_PARTS) break;
    if (!p || !PARTS[p.k]) continue;
    const part = { k: p.k, x: clampInt(p.x, 0, GRID - 1, -1), z: clampInt(p.z, 0, GRID - 1, -1), r: PARTS[p.k].turns ? clampInt(p.r, 0, 3, 0) : 0 };
    if (part.x !== Number(p.x) || part.z !== Number(p.z)) continue;
    if (part.k === 'hub' && hub) continue;
    const cells = cellsOf(part);
    if (cells.some(([x, z]) => x >= GRID || z >= GRID || taken.has(x * GRID + z))) continue;
    for (const [x, z] of cells) taken.add(x * GRID + z);
    if (part.k === 'hub') hub = true;
    parts.push(part);
  }
  return parts;
}

// What a robot is made of, worked out: which parts are joined to the hub
// (through any parts touching side by side), the ports and what is in them,
// the wheels and what drives them, and the robot's middle.
export function analyse(parts) {
  const at = new Map();
  parts.forEach((p, i) => {
    for (const [x, z] of cellsOf(p)) at.set(x * GRID + z, i);
  });
  const hubIndex = parts.findIndex((p) => p.k === 'hub');
  const joined = new Set();
  if (hubIndex >= 0) {
    const todo = [hubIndex];
    joined.add(hubIndex);
    while (todo.length) {
      const i = todo.pop();
      for (const [x, z] of cellsOf(parts[i])) {
        for (const [dx, dz] of DIRS) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
          const j = at.get(nx * GRID + nz);
          if (j !== undefined && !joined.has(j)) {
            joined.add(j);
            todo.push(j);
          }
        }
      }
    }
  }
  // Ports, in the order the parts went on; a seventh has none.
  const ports = {};
  const portOf = new Map();
  let next = 0;
  parts.forEach((p, i) => {
    if (!PARTS[p.k].port || !joined.has(i) || next >= PORTS.length) return;
    ports[PORTS[next]] = i;
    portOf.set(i, PORTS[next]);
    next++;
  });
  // What sits on each motor's axle: the part in the stud it faces.
  const onAxle = new Map();
  const driver = new Map();
  parts.forEach((p, i) => {
    if (p.k !== 'motor' || !joined.has(i)) return;
    const [dx, dz] = DIRS[p.r];
    const j = at.get((p.x + dx) * GRID + (p.z + dz));
    if (p.x + dx < 0 || p.z + dz < 0 || p.x + dx >= GRID || p.z + dz >= GRID || j === undefined) return;
    if (parts[j].k === 'wheel' || parts[j].k === 'propeller') {
      onAxle.set(i, j);
      driver.set(j, i);
    }
  });
  // The middle of everything joined, which the robot turns about.
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const i of joined) {
    for (const [x, z] of cellsOf(parts[i])) {
      sx += x + 0.5;
      sz += z + 0.5;
      n++;
    }
  }
  const middle = n ? [sx / n, sz / n] : [GRID / 2, GRID / 2];
  const hub = hubIndex >= 0 ? parts[hubIndex] : null;
  return { at, hubIndex, hub, joined, ports, portOf, onAxle, driver, middle, front: hub ? hub.r : 0 };
}

// The way a wheel's axle points: its motor's, when it is on one.
export function axleOf(parts, info, i) {
  const m = info.driver.get(i);
  return m === undefined ? parts[i].r : parts[m].r;
}

// What is wrong with a robot, for the window to say: [] when nothing is.
export function problems(parts) {
  const info = analyse(parts);
  const out = [];
  if (!info.hub) {
    out.push(parts.length ? 'Every robot needs a hub — put one on the plate.' : 'Start with the hub, the robot\'s brain.');
    return out;
  }
  const loose = parts.filter((_, i) => !info.joined.has(i));
  if (loose.length) out.push(`${loose.length === 1 ? `The ${PARTS[loose[0].k].name.toLowerCase()} is` : `${loose.length} parts are`} not joined to the hub — join ${loose.length === 1 ? 'it' : 'them'} on with a beam.`);
  const unplugged = parts.filter((p, i) => PARTS[p.k].port && info.joined.has(i) && !info.portOf.has(i));
  if (unplugged.length) out.push('The hub has only six ports: the rest have no cable.');
  return out;
}

// ------------------------------------------------------------ programs
//
// A program is a list of blocks, each { op, ...its fields }; loops and ifs
// hold lists of their own in `do` (and `else`).

export const CATEGORIES = {
  motors: { name: 'Motors', color: '#2c8cf0' },
  move: { name: 'Movement', color: '#ff4fc3' },
  light: { name: 'Light', color: '#9966ff' },
  sound: { name: 'Sound', color: '#c75fd6' },
  control: { name: 'Control', color: '#ffab19' },
  sensors: { name: 'Sensors', color: '#3cb6d9' },
};

const SEC = (v, def = 1) => clampNum(v, 0.1, 10, def);
function clampNum(v, lo, hi, def) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10 : def;
}
const pick = (v, list, def) => (list.includes(v) ? v : def);
const port = (v) => pick(v, PORTS, 'A');

export const MOVE_DIRS = ['fwd', 'back'];
export const TURN_DIRS = ['right', 'left'];
export const GO_DIRS = ['fwd', 'back', 'right', 'left', 'fr', 'fl'];
export const GO_NAMES = { fwd: 'forward', back: 'back', right: 'turning right', left: 'turning left', fr: 'curving right', fl: 'curving left' };

// Each block: its category, its fields made safe, and whether it holds blocks.
export const OPS = {
  run: { cat: 'motors', clean: (b) => ({ p: port(b.p), dir: b.dir === -1 ? -1 : 1, sec: SEC(b.sec) }) },
  start: { cat: 'motors', clean: (b) => ({ p: port(b.p), dir: b.dir === -1 ? -1 : 1 }) },
  stop: { cat: 'motors', clean: (b) => ({ p: port(b.p) }) },
  speed: { cat: 'motors', clean: (b) => ({ p: port(b.p), v: clampInt(b.v, 0, 100, DEFAULT_SPEED) }) },
  move: { cat: 'move', clean: (b) => ({ dir: pick(b.dir, MOVE_DIRS, 'fwd'), cm: clampInt(b.cm, 1, 200, 10) }) },
  turn: { cat: 'move', clean: (b) => ({ dir: pick(b.dir, TURN_DIRS, 'right'), deg: clampInt(b.deg, 1, 720, 90) }) },
  go: { cat: 'move', clean: (b) => ({ dir: pick(b.dir, GO_DIRS, 'fwd') }) },
  halt: { cat: 'move', clean: () => ({}) },
  mspeed: { cat: 'move', clean: (b) => ({ v: clampInt(b.v, 10, 100, DEFAULT_SPEED) }) },
  show: { cat: 'light', clean: (b) => ({ img: pick(b.img, Object.keys(IMAGES), 'happy') }) },
  clear: { cat: 'light', clean: () => ({}) },
  lamp: { cat: 'light', clean: (b) => ({ p: port(b.p), col: pick(b.col, LAMP_COLORS, 'red') }) },
  beep: { cat: 'sound', clean: (b) => ({ note: pick(Number(b.note), NOTES, 60), sec: clampNum(b.sec, 0.1, 4, 0.5) }) },
  wait: { cat: 'control', clean: (b) => ({ sec: SEC(b.sec) }) },
  repeat: { cat: 'control', holds: true, clean: (b) => ({ n: clampInt(b.n, 1, 100, 4) }) },
  forever: { cat: 'control', holds: true, clean: () => ({}) },
  if: { cat: 'control', holds: true, test: true, clean: () => ({}) },
  ifelse: { cat: 'control', holds: true, test: true, otherwise: true, clean: () => ({}) },
  until: { cat: 'control', test: true, clean: () => ({}) },
  end: { cat: 'control', clean: () => ({}) },
};

// What a sensor test asks, made safe: is something nearer (or further) than
// cm, is the colour under it one of SEEN_COLORS, is the bumper pressed.
export const TESTS = ['near', 'far', 'color', 'pressed'];
export function cleanTest(c) {
  const s = pick(c?.s, TESTS, 'near');
  if (s === 'color') return { s, p: port(c.p), col: pick(c.col, SEEN_COLORS, 'black') };
  if (s === 'pressed') return { s, p: port(c.p) };
  return { s, p: port(c?.p), cm: clampInt(c?.cm, 1, SEE_CM, 10) };
}

// A program as it came from anywhere, made safe: known blocks with their
// fields in range, MAX_BLOCKS in all, nested MAX_DEPTH deep at most.
export function cleanCode(raw) {
  let count = 0;
  const list = (items, depth) => {
    const out = [];
    for (const b of Array.isArray(items) ? items : []) {
      if (count >= MAX_BLOCKS) break;
      const op = OPS[b?.op];
      if (!op) continue;
      count++;
      const block = { op: b.op, ...op.clean(b) };
      if (op.test) block.c = cleanTest(b.c);
      if (op.holds) block.do = depth < MAX_DEPTH ? list(b.do, depth + 1) : [];
      if (op.otherwise) block.else = depth < MAX_DEPTH ? list(b.else, depth + 1) : [];
      out.push(block);
    }
    return out;
  };
  return list(raw, 1);
}

// How many blocks a program has, those inside loops and ifs too.
export const countBlocks = (code) => code.reduce((n, b) => n + 1 + countBlocks(b.do ?? []) + countBlocks(b.else ?? []), 0);

// A kit's robot and program, made safe; null when it holds nothing at all.
export function cleanKit(raw) {
  const parts = cleanParts(raw?.parts);
  const code = cleanCode(raw?.code);
  return parts.length || code.length ? { parts, code } : null;
}

// ------------------------------------------------------------ ready-made robots
//
// To start from, in the 🔧 Build tab: each a robot and a program for it.

const drivingBase = () => [
  { k: 'hub', x: 3, z: 3, r: 0 },
  { k: 'motor', x: 2, z: 3, r: 3 },
  { k: 'motor', x: 5, z: 3, r: 1 },
  { k: 'wheel', x: 1, z: 3, r: 3 },
  { k: 'wheel', x: 6, z: 3, r: 1 },
  { k: 'beam', x: 3, z: 5, r: 0 },
  { k: 'beam', x: 4, z: 5, r: 0 },
  { k: 'caster', x: 4, z: 6, r: 0 },
];

export const TEMPLATES = [
  {
    key: 'car',
    name: 'Driving Base',
    icon: '🚗',
    about: 'Two motors with wheels and a ball wheel at the back. It drives a square.',
    parts: drivingBase(),
    code: [
      { op: 'show', img: 'up' },
      { op: 'repeat', n: 4, do: [{ op: 'move', dir: 'fwd', cm: 20 }, { op: 'turn', dir: 'left', deg: 90 }] },
      { op: 'show', img: 'happy' },
      { op: 'beep', note: 72, sec: 0.5 },
    ],
  },
  {
    key: 'line',
    name: 'Line Follower',
    icon: '〰️',
    about: 'A colour sensor in front looks at the mat: it follows the edge of the black line.',
    parts: [...drivingBase(), { k: 'beam', x: 3, z: 2, r: 0 }, { k: 'color', x: 4, z: 2, r: 0 }],
    code: [
      { op: 'mspeed', v: 40 },
      { op: 'forever', do: [{ op: 'ifelse', c: { s: 'color', p: 'C', col: 'black' }, do: [{ op: 'go', dir: 'fr' }], else: [{ op: 'go', dir: 'fl' }] }] },
    ],
  },
  {
    key: 'bumper',
    name: 'Brick Dodger',
    icon: '🚧',
    about: 'A distance sensor in front sees bricks coming, backs off and turns away.',
    parts: [...drivingBase(), { k: 'distance', x: 3, z: 2, r: 0 }, { k: 'lamp', x: 4, z: 2, r: 0 }],
    code: [
      {
        op: 'forever',
        do: [
          {
            op: 'ifelse',
            c: { s: 'near', p: 'C', cm: 12 },
            do: [{ op: 'show', img: 'surprised' }, { op: 'lamp', p: 'D', col: 'red' }, { op: 'beep', note: 60, sec: 0.2 }, { op: 'move', dir: 'back', cm: 6 }, { op: 'turn', dir: 'right', deg: 90 }],
            else: [{ op: 'show', img: 'happy' }, { op: 'lamp', p: 'D', col: 'green' }, { op: 'go', dir: 'fwd' }],
          },
        ],
      },
    ],
  },
  {
    key: 'fan',
    name: 'Disco Fan',
    icon: '🌀',
    about: 'A motor spins a propeller while the lamp flashes colours and the hub plays a tune.',
    parts: [
      { k: 'hub', x: 3, z: 4, r: 0 },
      { k: 'motor', x: 3, z: 3, r: 0 },
      { k: 'propeller', x: 3, z: 2, r: 0 },
      { k: 'lamp', x: 4, z: 3, r: 0 },
      { k: 'caster', x: 3, z: 6, r: 0 },
      { k: 'caster', x: 4, z: 6, r: 0 },
    ],
    code: [
      { op: 'start', p: 'A', dir: 1 },
      {
        op: 'repeat',
        n: 3,
        do: [
          { op: 'lamp', p: 'B', col: 'red' },
          { op: 'beep', note: 60, sec: 0.3 },
          { op: 'lamp', p: 'B', col: 'yellow' },
          { op: 'beep', note: 64, sec: 0.3 },
          { op: 'lamp', p: 'B', col: 'blue' },
          { op: 'beep', note: 67, sec: 0.3 },
          { op: 'show', img: 'heart' },
          { op: 'beep', note: 72, sec: 0.6 },
          { op: 'clear' },
        ],
      },
      { op: 'stop', p: 'A' },
    ],
  },
  { key: 'empty', name: 'Empty plate', icon: '⬜', about: 'Nothing but the plate: build anything you like!', parts: [], code: [] },
];

// ------------------------------------------------------------ the play mat
//
// MAT_W by MAT_D centimetres, its middle at 0, 0, with a low wooden fence
// round it. A black line runs round a stadium shape (two straights joined
// by half circles), with a coloured square in each corner.

export const MAT_W = 160;
export const MAT_D = 110;
export const LINE = { half: 35, r: 28, w: 2.4 };
export const PATCHES = [
  { col: 'red', x: -66, z: -43 },
  { col: 'green', x: 66, z: -43 },
  { col: 'blue', x: -66, z: 43 },
  { col: 'yellow', x: 66, z: 43 },
];
export const PATCH = 7;
// Where a robot starts: on the line's bottom straight, heading right.
export const START = { x: 0, z: LINE.r, a: Math.PI / 2 };
// A toy brick on the mat is BRICK across, put down on a grid of that.
export const BRICK = 8;
export const MAX_BRICKS = 24;
export const DEFAULT_BRICKS = [
  [-4, -1],
  [-4, 0],
];

// How far a point is from the middle of the black line.
export function lineDistance(x, z) {
  const ax = Math.abs(x);
  return ax <= LINE.half ? Math.abs(Math.abs(z) - LINE.r) : Math.abs(Math.hypot(ax - LINE.half, z) - LINE.r);
}

// The colour of the mat at a point.
export function matColor(x, z) {
  for (const p of PATCHES) if (Math.abs(x - p.x) <= PATCH && Math.abs(z - p.z) <= PATCH) return p.col;
  if (lineDistance(x, z) <= LINE.w / 2) return 'black';
  return 'white';
}

// A brick's box on the mat, from its grid place.
export const brickBox = ([i, j]) => ({ x0: i * BRICK, z0: j * BRICK, x1: (i + 1) * BRICK, z1: (j + 1) * BRICK });

// ------------------------------------------------------------ running

const rot = (a, x, z) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];

// Solves the 3×3 system m·v = b (Gaussian elimination); m is row by row.
function solve3(m, b) {
  const a = [
    [m[0], m[1], m[2], b[0]],
    [m[3], m[4], m[5], b[1]],
    [m[6], m[7], m[8], b[2]],
  ];
  for (let c = 0; c < 3; c++) {
    let best = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[best][c])) best = r;
    [a[c], a[best]] = [a[best], a[c]];
    if (Math.abs(a[c][c]) < 1e-12) return [0, 0, 0];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

// The blocks of a program, run one at a time: a generator that yields at
// the end of each tick it has to wait. Loops yield at the end of every time
// round, as Scratch's do, so a loop that never waits cannot hang the page.
function* runList(list, sim) {
  for (const b of list) {
    if (sim.ended) return;
    yield* runBlock(b, sim);
  }
}

function* waitFor(sim, sec) {
  const end = sim.t + sec;
  while (sim.t < end - 1e-6) yield;
}

function* runBlock(b, sim) {
  sim.doing = b;
  switch (b.op) {
    case 'run':
      sim.motor(b.p, b.dir);
      yield* waitFor(sim, b.sec);
      sim.motor(b.p, 0);
      break;
    case 'start':
      sim.motor(b.p, b.dir);
      break;
    case 'stop':
      sim.motor(b.p, 0);
      break;
    case 'speed':
      sim.setSpeed(b.p, b.v);
      break;
    case 'move': {
      // Until the wheels have rolled that far (or it is stuck a while),
      // slowing down at the end as a real one does, to stop on the spot.
      const from = sim.rolled;
      const by = sim.t + (b.cm / sim.cmPerSec()) * 2 + 1;
      for (let left = b.cm; left > 0.05 && sim.t < by && sim.canDrive(); left = b.cm - Math.abs(sim.rolled - from)) {
        sim.drive(b.dir, Math.min(1, Math.max(0.06, left / 4)));
        yield;
      }
      sim.drive(null);
      break;
    }
    case 'turn': {
      // Until the hub's gyro has turned that far, slowing down at the end.
      const from = sim.turned;
      const want = (b.deg * Math.PI) / 180;
      const by = sim.t + 12;
      for (let left = want; left > 0.002 && sim.t < by && sim.canDrive(); left = want - Math.abs(sim.turned - from)) {
        sim.drive(b.dir, Math.min(1, Math.max(0.04, left / 0.3)));
        yield;
      }
      sim.drive(null);
      break;
    }
    case 'go':
      sim.drive(b.dir);
      break;
    case 'halt':
      sim.drive(null);
      break;
    case 'mspeed':
      sim.moveSpeed = b.v;
      break;
    case 'show':
      sim.matrix = IMAGES[b.img].px;
      break;
    case 'clear':
      sim.matrix = BLANK;
      break;
    case 'lamp':
      sim.lamp(b.p, b.col);
      break;
    case 'beep':
      sim.sounds.push({ note: b.note, sec: b.sec });
      yield* waitFor(sim, b.sec);
      break;
    case 'wait':
      yield* waitFor(sim, b.sec);
      break;
    case 'repeat':
      for (let i = 0; i < b.n && !sim.ended; i++) {
        yield* runList(b.do, sim);
        yield;
      }
      break;
    case 'forever':
      while (!sim.ended) {
        yield* runList(b.do, sim);
        yield;
      }
      break;
    case 'if':
      if (sim.test(b.c)) yield* runList(b.do, sim);
      break;
    case 'ifelse':
      yield* runList(sim.test(b.c) ? b.do : b.else, sim);
      break;
    case 'until':
      while (!sim.test(b.c) && !sim.ended) yield;
      break;
    case 'end':
      sim.ended = true;
      break;
  }
}

// A robot on the play mat: built from its parts, it runs a program tick by
// tick (step). `bricks` are the toy bricks' grid places.
export class RobotSim {
  constructor(parts, bricks = DEFAULT_BRICKS) {
    this.parts = parts;
    this.info = analyse(parts);
    this.bricks = bricks;
    const { middle, front } = this.info;
    // Each joined part's middle about the robot's middle, in cm, and the
    // way it faces, both turned so the robot's front is up the plate.
    const back = -front * (Math.PI / 2);
    this.local = parts.map((p, i) => {
      const [mx, mz] = middleOf(p);
      const [x, z] = rot(back, (mx - middle[0]) * CELL, (mz - middle[1]) * CELL);
      return { i, x, z, r: (p.r - front + 4) % 4, joined: this.info.joined.has(i) };
    });
    // The studs everything joined covers, as little circles to bump with.
    this.body = [];
    parts.forEach((p, i) => {
      if (!this.info.joined.has(i)) return;
      for (const [cx, cz] of cellsOf(p)) {
        const [x, z] = rot(back, (cx + 0.5 - middle[0]) * CELL, (cz + 0.5 - middle[1]) * CELL);
        this.body.push([x, z]);
      }
    });
    this.reset();
  }

  reset(pose = START) {
    this.x = pose.x;
    this.z = pose.z;
    this.a = pose.a;
    this.t = 0;
    this.rolled = 0;
    this.turned = 0;
    this.moveSpeed = DEFAULT_SPEED;
    this.matrix = BLANK;
    this.lamps = {};
    this.motors = {};
    for (const [p, i] of Object.entries(this.info.ports)) if (this.parts[i].k === 'motor') this.motors[p] = { i, on: 0, speed: DEFAULT_SPEED, deg: 0 };
    this.sounds = [];
    this.program = null;
    this.running = false;
    this.ended = false;
    this.doing = null;
    this.bumped = false;
  }

  // ---- what blocks do

  motor(p, dir) {
    const m = this.motors[p];
    if (!m) return;
    m.on = dir;
    m.pct = null;
  }

  setSpeed(p, v) {
    const m = this.motors[p];
    if (m) m.speed = v;
  }

  lamp(p, col) {
    const i = this.info.ports[p];
    if (i !== undefined && this.parts[i].k === 'lamp') this.lamps[p] = col;
  }

  // The motors that drive wheels: their port, the way their wheel rolls when
  // they turn forwards (in the robot's own frame, front up), and which side
  // of the middle they are on (+1 right).
  drivers() {
    const out = [];
    for (const [p, m] of Object.entries(this.motors)) {
      const w = this.info.onAxle.get(m.i);
      if (w === undefined || this.parts[w].k !== 'wheel') continue;
      const r = this.local[m.i].r;
      const [ax, az] = DIRS[r];
      const roll = [-az, ax];
      out.push({ p, m, forward: Math.sign(-roll[1]), side: Math.sign(this.local[w].x) });
    }
    return out;
  }

  canDrive() {
    return this.drivers().some((d) => d.forward !== 0);
  }

  // Movement blocks: every motor driving a wheel turned the way that moves
  // the robot as asked (null stops them), at the movement speed (times
  // `slow`).
  drive(dir, slow = 1) {
    for (const d of this.drivers()) {
      const m = d.m;
      if (!dir || !d.forward) {
        m.on = 0;
        m.pct = null;
        continue;
      }
      let k = 1;
      let pct = this.moveSpeed * slow;
      if (dir === 'back') k = -1;
      else if (dir === 'right') k = d.side > 0 ? -1 : d.side < 0 ? 1 : 0;
      else if (dir === 'left') k = d.side < 0 ? -1 : d.side > 0 ? 1 : 0;
      else if (dir === 'fr' && d.side > 0) pct *= 0.2;
      else if (dir === 'fl' && d.side < 0) pct *= 0.2;
      m.on = k * d.forward;
      m.pct = pct;
    }
  }

  cmPerSec() {
    return ((this.moveSpeed / 100) * MAX_DPS * Math.PI * WHEEL_D) / 360;
  }

  // ---- sensors

  // A part's place on the mat and the way it faces there.
  placeOf(i) {
    const l = this.local[i];
    const [x, z] = rot(this.a, l.x, l.z);
    const [fx, fz] = rot(this.a, DIRS[l.r][0], DIRS[l.r][1]);
    return { x: this.x + x, z: this.z + z, fx, fz };
  }

  partOn(p, kind) {
    const i = this.info.ports[p];
    return i !== undefined && this.parts[i].k === kind ? i : -1;
  }

  // How far the nearest brick or fence is in front of a distance sensor, in
  // whole cm from its front, or null when nothing is within SEE_CM.
  distance(p) {
    const i = this.partOn(p, 'distance');
    if (i < 0) return null;
    const s = this.placeOf(i);
    const ox = s.x + s.fx * (CELL / 2);
    const oz = s.z + s.fz * (CELL / 2);
    let best = Infinity;
    const slab = (b) => {
      let t0 = 0;
      let t1 = Infinity;
      for (const [o, d, lo, hi] of [
        [ox, s.fx, b.x0, b.x1],
        [oz, s.fz, b.z0, b.z1],
      ]) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) return;
          continue;
        }
        let a = (lo - o) / d;
        let c = (hi - o) / d;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (t0 <= t1) best = Math.min(best, t0);
    };
    for (const b of this.bricks) slab(brickBox(b));
    // The fence, from the inside.
    if (s.fx > 1e-9) best = Math.min(best, (MAT_W / 2 - ox) / s.fx);
    if (s.fx < -1e-9) best = Math.min(best, (-MAT_W / 2 - ox) / s.fx);
    if (s.fz > 1e-9) best = Math.min(best, (MAT_D / 2 - oz) / s.fz);
    if (s.fz < -1e-9) best = Math.min(best, (-MAT_D / 2 - oz) / s.fz);
    return best <= SEE_CM ? Math.max(0, Math.round(best)) : null;
  }

  color(p) {
    const i = this.partOn(p, 'color');
    if (i < 0) return null;
    const s = this.placeOf(i);
    return matColor(s.x, s.z);
  }

  pressed(p) {
    const i = this.partOn(p, 'bumper');
    if (i < 0) return false;
    const s = this.placeOf(i);
    const x = s.x + s.fx * (CELL * 0.65);
    const z = s.z + s.fz * (CELL * 0.65);
    if (Math.abs(x) >= MAT_W / 2 || Math.abs(z) >= MAT_D / 2) return true;
    return this.bricks.some((b) => {
      const box = brickBox(b);
      return x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
    });
  }

  test(c) {
    if (c.s === 'near') {
      const d = this.distance(c.p);
      return d !== null && d < c.cm;
    }
    if (c.s === 'far') {
      if (this.partOn(c.p, 'distance') < 0) return false;
      const d = this.distance(c.p);
      return d === null || d > c.cm;
    }
    if (c.s === 'color') return this.color(c.p) === c.col;
    if (c.s === 'pressed') return this.pressed(c.p);
    return false;
  }

  // What every port reads, for the window: [{ port, kind, value }].
  readings() {
    return Object.entries(this.info.ports).map(([p, i]) => {
      const kind = this.parts[i].k;
      let value = '';
      if (kind === 'motor') value = `${Math.round((((this.motors[p].deg % 360) + 360) % 360))}°`;
      else if (kind === 'distance') {
        const d = this.distance(p);
        value = d === null ? '— cm' : `${d} cm`;
      } else if (kind === 'color') value = COLORS[this.color(p)].name;
      else if (kind === 'bumper') value = this.pressed(p) ? 'pressed' : 'not pressed';
      else if (kind === 'lamp') value = COLORS[this.lamps[p] ?? 'off'].name;
      return { port: p, kind, value };
    });
  }

  // ---- running

  start(code) {
    this.reset({ x: this.x, z: this.z, a: this.a });
    this.program = runList(code, this);
    this.running = true;
  }

  stop() {
    this.program = null;
    this.running = false;
    this.doing = null;
    for (const m of Object.values(this.motors)) m.on = 0;
  }

  // One tick of dt seconds: the program goes on until it waits, then the
  // motors turn and the robot moves.
  step(dt) {
    this.t += dt;
    if (this.program) {
      const r = this.program.next();
      if (r.done || this.ended) this.stop();
    }
    this.physics(dt);
  }

  // How the robot moves for its wheels: each wheel's contact with the mat
  // wants it to roll at its motor's speed the way it faces (or freely, off
  // a motor) and not to slide sideways. The robot's speed and turn that
  // come closest to what all its wheels want (least squares), the way wheels
  // pulling against each other skid in a real one.
  physics(dt) {
    const want = [];
    for (const m of Object.values(this.motors)) {
      const dps = m.on * ((m.pct ?? m.speed) / 100) * MAX_DPS;
      m.deg += dps * dt;
      m.dps = dps;
    }
    this.parts.forEach((p, i) => {
      if (p.k !== 'wheel' || !this.info.joined.has(i)) return;
      const l = this.local[i];
      const r = (axleOf(this.parts, this.info, i) - this.info.front + 4) % 4;
      const [ax, az] = DIRS[r];
      const roll = [-az, ax];
      const m = this.info.driver.get(i);
      const motor = m === undefined ? null : Object.values(this.motors).find((mm) => mm.i === m);
      // No sliding along the axle.
      want.push({ d: [ax, az], x: l.x, z: l.z, s: 0 });
      if (motor) want.push({ d: roll, x: l.x, z: l.z, s: (motor.dps * Math.PI * WHEEL_D) / 360 });
    });
    if (!want.length) return;
    // Rows of [vx, vz, w]: a point at (x, z) on the robot moves at
    // v + w·(-z, x) as it turns.
    const M = new Array(9).fill(0);
    const B = [0, 0, 0];
    for (const { d, x, z, s } of want) {
      const row = [d[0], d[1], -z * d[0] + x * d[1]];
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) M[a * 3 + b] += row[a] * row[b];
        B[a] += row[a] * s;
      }
    }
    for (let a = 0; a < 3; a++) M[a * 4] += a === 2 ? 1e-2 : 1e-4;
    const [vx, vz, w] = solve3(M, B);
    // Moved by small steps, each undone if it would push into a brick or the fence.
    const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.5));
    for (let k = 0; k < steps; k++) {
      const h = dt / steps;
      const a = this.a + w * h;
      const [mx, mz] = rot(this.a + (w * h) / 2, vx * h, vz * h);
      if (!this.hits(this.x + mx, this.z + mz, a)) {
        this.x += mx;
        this.z += mz;
        this.a = a;
        this.turned += w * h;
        this.rolled += -vz * h;
        this.bumped = false;
      } else if (!this.hits(this.x, this.z, a)) {
        this.a = a;
        this.turned += w * h;
        this.bumped = true;
      } else this.bumped = true;
    }
  }

  // Whether the robot at (x, z) turned to a would be in a brick or the fence.
  hits(x, z, a) {
    const R = CELL / 2;
    for (const [bx, bz] of this.body) {
      const [px, pz] = rot(a, bx, bz);
      const cx = x + px;
      const cz = z + pz;
      if (Math.abs(cx) > MAT_W / 2 - R || Math.abs(cz) > MAT_D / 2 - R) return true;
      for (const b of this.bricks) {
        const box = brickBox(b);
        const nx = Math.max(box.x0, Math.min(cx, box.x1));
        const nz = Math.max(box.z0, Math.min(cz, box.z1));
        if ((cx - nx) ** 2 + (cz - nz) ** 2 < R * R) return true;
      }
    }
    return false;
  }
}
