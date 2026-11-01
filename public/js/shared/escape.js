// An escape island's escape house, in the middle of the island (worldgen.js
// makes the ground there flat for it, as for a fun park's plaza: the same
// square, park.js PARK_HALF): three rooms in a row, each shut by a locked
// door that only its puzzle opens, and nothing of the house (blocks.js
// ESCAPE_WALL and the rest, all island-only) to be dug through or picked
// apart. Everyone on the island solves it together:
//
// 1. The buttons: four in the north wall, red, yellow, green and blue, to
//    press in the order the four star tiles over the numbers 1 to 4 on the
//    west wall show. A wrong one and they all go dark again.
// 2. The treasure map: nine crates on the floor, three by three, and on the
//    north wall a map of them with an X on one. Opening the crate under the
//    X finds the key; any other is empty.
// 3. The dials: a red, a blue and a yellow one in the north wall, each
//    turned a number on at a time. Star tiles of those colours (and a green
//    one or two, which count for nothing) are set in the other walls: each
//    dial turned to how many stars there are of its colour opens the way
//    out.
//
// The answers are never kept anywhere but in the house itself, so the
// island works them out from its blocks every time (clues): a house saved
// half solved comes back just as it was. Once it has been played and
// nobody is in it, the island locks it all up again with new puzzles
// (buildHouse, from room.js).
//
// Everything is laid out from the middle (cx, cz): x across (room 1 to the
// west), z towards the front of the house and where everyone comes in, as
// `o` offsets.
import * as B from './blocks.js';
import { PARK_HALF } from './park.js';
import { Rng } from './rng.js';
import { oakTree, placeTemplate, stampByKey } from './stamps.js';

const [RED, ORANGE, YELLOW, , GREEN, , SKY, , PURPLE, , , WHITE] = B.TOY_BRICKS;

// The house: its rooms' walls from x -15 to 15, z -11 (the back) to -1
// (the front), its floor at the ground's own height and its roof six over
// it; round that, an outer wall a block further out, so the clues set in
// the walls inside are not to be seen from outside (OUTER).
export const HOUSE = { x0: -15, x1: 15, z0: -11, z1: -1, roof: 6, top: 13 };
const OUTER = { x0: HOUSE.x0 - 1, x1: HOUSE.x1 + 1, z0: HOUSE.z0 - 1, z1: HOUSE.z1 + 1 };
// The rooms' middles across, each nine by nine inside, and along.
export const ROOM_X = [-10, 0, 10];
export const ROOM_Z = -6;
// The way in (into room 1), the locked doors between the rooms, and the
// way out (of room 3), each at the floor and one over it.
export const ENTRANCE = [-10, -1];
export const DOORS = [
  [-5, ROOM_Z],
  [5, ROOM_Z],
  [10, -1],
];
// Room 1's buttons (in the north wall, in colour order), and its clue (in
// the west wall: stars over numbers, from left to right as you face it).
const BUTTON_X = [-13, -11, -9, -7];
const CLUE_Z = (k) => -5 - k;
// Room 2's crates, and the map of them in the north wall.
const CRATE_X = [-2, 0, 2];
const CRATE_Z = [-8, -6, -4];
const MAP_X0 = -1;
// Room 3's dials, red, blue and yellow (blocks.js DIAL_COLORS).
const DIAL_X = [8, 10, 12];

// How long after it was last played, with nobody in it, the house locks up
// again with new puzzles.
export const RESET_MS = 20000;

// The island's escape house, if it has one: where it is in the world.
export function escapeHouse(world) {
  if (world?.theme !== 'escape') return null;
  return { cx: Math.floor(world.W / 2), cz: Math.floor(world.D / 2), level: world.sea + 4 };
}

// Which room (1 to 3) the spot (x, y, z) is inside, or 0.
export function roomAt(house, x, y, z) {
  if (!house) return 0;
  const ox = Math.floor(x) - house.cx;
  const oz = Math.floor(z) - house.cz;
  const oy = Math.floor(y) - house.level;
  if (oy < 1 || oy >= HOUSE.roof || oz <= HOUSE.z0 || oz >= HOUSE.z1) return 0;
  const i = ROOM_X.findIndex((rx) => Math.abs(ox - rx) <= 4);
  return i + 1;
}

// Whether (x, y, z) is in the house, its walls and roof and all.
export function inHouse(house, x, y, z) {
  if (!house) return false;
  const ox = Math.floor(x) - house.cx;
  const oz = Math.floor(z) - house.cz;
  const oy = Math.floor(y) - house.level;
  return ox >= OUTER.x0 && ox <= OUTER.x1 && oz >= OUTER.z0 && oz <= OUTER.z1 && oy >= 0 && oy <= HOUSE.roof;
}

const colorOf = (list, id) => list.indexOf(id);
const dialOf = (id) => {
  for (let i = 0; i < B.DIALS.length; i++) if (id >= B.DIALS[i] && id < B.DIALS[i] + 10) return { dial: i, digit: id - B.DIALS[i] };
  return null;
};

// What the puzzle piece in cell (x, y, z) is, or null: { kind: 'button',
// color, lit } in room 1, { kind: 'crate', open } in room 2, { kind: 'dial',
// dial, digit } in room 3.
export function puzzleAt(world, x, y, z) {
  const id = world.get(x, y, z);
  let c = colorOf(B.ESCAPE_BUTTONS, id);
  if (c >= 0) return { kind: 'button', room: 1, color: c, lit: false };
  c = colorOf(B.ESCAPE_BUTTONS_ON, id);
  if (c >= 0) return { kind: 'button', room: 1, color: c, lit: true };
  if (id === B.CRATE || id === B.CRATE_OPEN) return { kind: 'crate', room: 2, open: id === B.CRATE_OPEN };
  const d = dialOf(id);
  if (d) return { kind: 'dial', room: 3, ...d };
  return null;
}

// The puzzle piece a body standing at it faces (yaw: which way, as a
// player's yaw: sin and cos of it along x and z), within reach, and with
// something left to do: { x, y, z, ...puzzleAt }, or null. A lit button,
// an open crate, or anything in a room solved already, is not one.
export function puzzleNear(world, house, body, yaw, reach = 3) {
  if (!house || !inHouse(house, body.x, body.y, body.z)) return null;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const bx = Math.floor(body.x);
  const bz = Math.floor(body.z);
  const by = Math.floor(body.y + 0.05);
  let best = null;
  let bestScore = -Infinity;
  for (let x = bx - 3; x <= bx + 3; x++) {
    for (let z = bz - 3; z <= bz + 3; z++) {
      for (let y = by; y <= by + 2; y++) {
        const p = puzzleAt(world, x, y, z);
        if (!p || p.lit || p.open || doorOpen(world, house, p.room)) continue;
        const dx = x + 0.5 - body.x;
        const dz = z + 0.5 - body.z;
        const d = Math.hypot(dx, dz);
        if (d > reach) continue;
        const facing = d < 0.3 ? 1 : (dx * fx + dz * fz) / d;
        if (facing < 0.35) continue;
        const score = facing * 2 - d;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y, z, ...p };
        }
      }
    }
  }
  return best;
}

// The answers, read off the house's own walls: room 1's order of colours
// (the stars over 1, 2, 3, 4), room 2's crate under the map's X ([column,
// row], column from the west, row from the north), and room 3's count of
// stars of each dial's colour.
export function clues(world, house) {
  const { cx, cz, level } = house;
  const at = (ox, y, oz) => world.get(cx + ox, level + y, cz + oz);
  const order = [];
  for (let k = 0; k < 4; k++) order.push(colorOf(B.STAR_TILES, at(HOUSE.x0, 3, CLUE_Z(k))));
  let crate = null;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (at(MAP_X0 + c, 4 - r, HOUSE.z0) === B.MAP_X) crate = [c, r];
  const counts = B.DIAL_COLORS.map(() => 0);
  for (const [ox, y, oz] of starWalls()) {
    const c = colorOf(B.STAR_TILES, at(ox, y, oz));
    const i = B.DIAL_COLORS.indexOf(c);
    if (i >= 0) counts[i]++;
  }
  return { order, crate, counts };
}

// Whether room n's locked door (1 to 3, the last the way out) is open.
export function doorOpen(world, house, n) {
  const [ox, oz] = DOORS[n - 1];
  return world.get(house.cx + ox, house.level + 1, house.cz + oz) !== B.LOCKED_DOOR;
}

// Whether the house has been played at all since it was last locked up: a
// door open, a button lit, a crate open or a dial turned.
export function houseUsed(world, house) {
  if ([1, 2, 3].some((n) => doorOpen(world, house, n))) return true;
  const { cx, cz, level } = house;
  for (const ox of BUTTON_X) if (puzzleAt(world, cx + ox, level + 2, cz + HOUSE.z0)?.lit) return true;
  for (const ox of CRATE_X) for (const oz of CRATE_Z) if (puzzleAt(world, cx + ox, level + 1, cz + oz)?.open) return true;
  for (const ox of DIAL_X) if (puzzleAt(world, cx + ox, level + 2, cz + HOUSE.z0)?.digit) return true;
  return false;
}

// Using the puzzle piece in cell (x, y, z) (pressing a button, opening a
// crate, turning a dial): what that does, worked out from the house as it
// is. Returns { cells (the house's blocks that change, x, y, z, id), fx:
// { f, room, ... } } or null when it does nothing — a lit button, an open
// crate, or a room already solved.
//   f: 'press' (a right button), 'wrong' (the buttons all go dark),
//      'empty' (a crate with nothing in it), 'turn' (a dial), or 'open'
//      (the room's door opens: with key: true from a crate, out: true for
//      the way out).
export function useEscape(world, house, x, y, z) {
  const p = puzzleAt(world, x, y, z);
  if (!p || doorOpen(world, house, p.room)) return null;
  const { cx, cz, level } = house;
  const answers = clues(world, house);
  const cells = [];
  const opened = () => {
    const [ox, oz] = DOORS[p.room - 1];
    cells.push(cx + ox, level + 1, cz + oz, B.AIR, cx + ox, level + 2, cz + oz, B.AIR);
  };
  if (p.kind === 'button') {
    if (p.lit) return null;
    const lit = BUTTON_X.filter((ox) => puzzleAt(world, cx + ox, level + 2, cz + HOUSE.z0)?.lit).length;
    if (answers.order[lit] !== p.color) {
      for (const [i, ox] of BUTTON_X.entries()) if (world.get(cx + ox, level + 2, cz + HOUSE.z0) !== B.ESCAPE_BUTTONS[i]) cells.push(cx + ox, level + 2, cz + HOUSE.z0, B.ESCAPE_BUTTONS[i]);
      return { cells, fx: { f: 'wrong', room: 1 } };
    }
    cells.push(x, y, z, B.ESCAPE_BUTTONS_ON[p.color]);
    if (lit + 1 < 4) return { cells, fx: { f: 'press', room: 1, n: lit + 1 } };
    opened();
    return { cells, fx: { f: 'open', room: 1 } };
  }
  if (p.kind === 'crate') {
    if (p.open) return null;
    cells.push(x, y, z, B.CRATE_OPEN);
    const [c, r] = answers.crate ?? [-1, -1];
    if (x !== cx + CRATE_X[c] || z !== cz + CRATE_Z[r]) return { cells, fx: { f: 'empty', room: 2 } };
    opened();
    return { cells, fx: { f: 'open', room: 2, key: true } };
  }
  const digit = (p.digit + 1) % 10;
  cells.push(x, y, z, B.DIALS[p.dial] + digit);
  const shown = DIAL_X.map((ox) => (cx + ox === x ? digit : (dialOf(world.get(cx + ox, level + 2, cz + HOUSE.z0))?.digit ?? -1)));
  if (!shown.every((d, i) => d === answers.counts[i])) return { cells, fx: { f: 'turn', room: 3, digit } };
  opened();
  return { cells, fx: { f: 'open', room: 3, out: true } };
}

// Room 3's walls inside, where its star tiles may go: the west, east and
// front ones, from the floor to one under the top, clear of the doors and
// their trim. As [ox, y over the floor, oz].
function starWalls() {
  const out = [];
  const [wx, ex] = [ROOM_X[2] - 5, ROOM_X[2] + 5];
  const [dx, dz] = DOORS[1];
  const [xx] = DOORS[2];
  for (let y = 1; y <= 4; y++) {
    for (let oz = HOUSE.z0 + 1; oz < HOUSE.z1; oz++) {
      if (!(Math.abs(oz - dz) <= 1 && dx === wx && y <= 3)) out.push([wx, y, oz]);
      out.push([ex, y, oz]);
    }
    for (let ox = wx + 1; ox < ex; ox++) if (!(Math.abs(ox - xx) <= 1 && y <= 3)) out.push([ox, y, HOUSE.z1]);
  }
  return out;
}

// The house itself, built (or built again) into the world round (cx, cz),
// its puzzles new from rng: walls, floor, roof and lamps, the doors locked,
// every button dark, every crate shut and every dial at 0, and the sign
// over the front. Everything inside it that is not the house goes.
export function buildHouse(world, house, rng) {
  const { cx, cz, level } = house;
  const set = (ox, y, oz, id) => world.set(cx + ox, level + y, cz + oz, id);
  const { x0, x1, z0, z1, roof } = HOUSE;
  for (let ox = x0; ox <= x1; ox++) {
    for (let oz = z0; oz <= z1; oz++) {
      const wall = ox === x0 || ox === x1 || oz === z0 || oz === z1 || ROOM_X.every((rx) => Math.abs(ox - rx) > 4);
      set(ox, 0, oz, wall ? B.ESCAPE_WALL : B.ESCAPE_FLOOR);
      for (let y = 1; y < roof; y++) set(ox, y, oz, wall ? B.ESCAPE_WALL : B.AIR);
      set(ox, roof, oz, B.ESCAPE_WALL);
      for (let y = roof + 1; y <= HOUSE.top; y++) set(ox, y, oz, B.AIR);
    }
  }
  // Lamps in each room's ceiling.
  for (const rx of ROOM_X) for (const dx of [-2, 2]) for (const dz of [-2, 2]) set(rx + dx, roof, ROOM_Z + dz, B.ESCAPE_LAMP);
  // The way in, framed in gold; the locked doors, framed the same, the way
  // out with EXIT over it.
  const frame = ([ox, oz], across) => {
    for (let y = 1; y <= 3; y++) for (const s of [-1, 1]) set(ox + (across ? s : 0), y, oz + (across ? 0 : s), B.ESCAPE_TRIM);
    set(ox, 3, oz, B.ESCAPE_TRIM);
  };
  frame(ENTRANCE, true);
  set(ENTRANCE[0], 1, ENTRANCE[1], B.AIR);
  set(ENTRANCE[0], 2, ENTRANCE[1], B.AIR);
  DOORS.forEach(([ox, oz], i) => {
    frame([ox, oz], i === 2);
    set(ox, 1, oz, B.LOCKED_DOOR);
    set(ox, 2, oz, B.LOCKED_DOOR_TOP);
  });
  set(DOORS[2][0], 3, DOORS[2][1], B.EXIT_SIGN);
  // The outer wall, with the way in and the way out through it, framed in
  // gold on the outside too.
  for (let ox = OUTER.x0; ox <= OUTER.x1; ox++) {
    for (let oz = OUTER.z0; oz <= OUTER.z1; oz++) {
      if (ox !== OUTER.x0 && ox !== OUTER.x1 && oz !== OUTER.z0 && oz !== OUTER.z1) continue;
      for (let y = 0; y <= roof; y++) set(ox, y, oz, B.ESCAPE_WALL);
      for (let y = roof + 1; y <= HOUSE.top; y++) set(ox, y, oz, B.AIR);
    }
  }
  for (const [ox] of [ENTRANCE, DOORS[2]]) {
    frame([ox, OUTER.z1], true);
    set(ox, 1, OUTER.z1, B.AIR);
    set(ox, 2, OUTER.z1, B.AIR);
  }
  set(DOORS[2][0], 3, OUTER.z1, B.EXIT_SIGN);

  // Room 1: the buttons, and the order to press them in.
  BUTTON_X.forEach((ox, i) => set(ox, 2, z0, B.ESCAPE_BUTTONS[i]));
  const order = shuffle([0, 1, 2, 3], rng);
  for (let k = -1; k <= 4; k++) for (let y = 1; y <= 4; y++) set(x0, y, CLUE_Z(k), B.ESCAPE_TRIM);
  order.forEach((c, k) => {
    set(x0, 3, CLUE_Z(k), B.STAR_TILES[c]);
    set(x0, 2, CLUE_Z(k), B.NUMBER_TILES[k]);
  });

  // Room 2: the crates, and the map with the X.
  for (const ox of CRATE_X) for (const oz of CRATE_Z) set(ox, 1, oz, B.CRATE);
  const [mc, mr] = [rng.int(0, 2), rng.int(0, 2)];
  for (let c = -1; c <= 3; c++) for (let r = -1; r <= 3; r++) set(MAP_X0 + c, 4 - r, z0, c < 0 || c > 2 || r < 0 || r > 2 ? B.ESCAPE_TRIM : c === mc && r === mr ? B.MAP_X : B.MAP_PAPER);

  // Room 3: the dials at 0, and the stars to count (and a green one or two
  // that count for nothing), here and there round the walls.
  DIAL_X.forEach((ox, i) => {
    set(ox, 2, z0, B.DIALS[i]);
    set(ox, 1, z0, B.ESCAPE_TRIM);
    set(ox, 3, z0, B.ESCAPE_TRIM);
  });
  const spots = shuffle(starWalls(), rng);
  const stars = [...B.DIAL_COLORS.flatMap((c) => Array(rng.int(1, 5)).fill(c)), ...Array(rng.int(1, 2)).fill(2)];
  stars.forEach((c, i) => set(...spots[i], B.STAR_TILES[c]));

  // The sign over the front: ESCAPE in gold on purple.
  const LETTERS = {
    E: ['###', '#..', '##.', '#..', '###'],
    S: ['###', '#..', '###', '..#', '###'],
    C: ['###', '#..', '#..', '#..', '###'],
    A: ['.#.', '#.#', '###', '#.#', '#.#'],
    P: ['##.', '#.#', '##.', '#..', '#..'],
  };
  const front = OUTER.z1;
  for (let ox = -12; ox <= 12; ox++) for (let y = roof + 1; y <= roof + 7; y++) set(ox, y, front, PURPLE);
  [...'ESCAPE'].forEach((ch, i) => {
    LETTERS[ch].forEach((row, r) => {
      for (let c = 0; c < 3; c++) if (row[c] === '#') set(-11 + i * 4 + c, roof + 6 - r, front, B.ESCAPE_TRIM);
    });
  });
  for (const ox of [-12, 12]) set(ox, roof + 8, front, B.LAMP);
}

// Every cell the house takes up, for building it again (room.js): x, y, z.
export function* houseCells(house) {
  const { cx, cz, level } = house;
  for (let ox = OUTER.x0; ox <= OUTER.x1; ox++) for (let oz = OUTER.z0; oz <= OUTER.z1; oz++) for (let y = 0; y <= HOUSE.top; y++) yield [cx + ox, level + y, cz + oz];
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The square round the house, built into the world round (cx, cz) with the
// ground at height level: a lawn with a path to the way in and from the way
// out, flower beds along the front, trees and lamp posts, and the house.
// Returns { spawn, rides (none), clear (what vehicles keep clear of) }.
export function buildEscape(world, { cx, cz, level, pal, seed }) {
  const set = (ox, y, oz, id) => world.set(cx + ox, y, cz + oz, id);
  const place = (cells) => {
    for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z)) world.set(x, y, z, id);
  };
  const H = PARK_HALF;
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      for (let y = level + 1; y < world.H; y++) set(ox, y, oz, B.AIR);
      set(ox, level, oz, pal.top);
    }
  }
  // Paths: up to the way in and down from the way out, joined along the
  // front, and out to the edge of the square.
  for (const [px] of [ENTRANCE, DOORS[2]]) for (let oz = 1; oz <= 4; oz++) for (let dx = -1; dx <= 1; dx++) set(px + dx, level, oz, B.PEBBLES);
  for (let ox = -11; ox <= 11; ox++) for (let oz = 4; oz <= 6; oz++) set(ox, level, oz, B.PEBBLES);
  for (let oz = 7; oz <= H; oz++) for (let dx = -1; dx <= 1; dx++) set(dx, level, oz, B.PEBBLES);
  // Flowers along the front, in the colours of the puzzles.
  const FLOWERS = [B.TULIP, B.SUNFLOWER, B.BLUEBELL, B.DAISY];
  for (let ox = OUTER.x0; ox <= OUTER.x1; ox++) {
    if (Math.abs(ox - ENTRANCE[0]) <= 1 || Math.abs(ox - DOORS[2][0]) <= 1) continue;
    set(ox, level + 1, OUTER.z1 + 1, FLOWERS[(ox + 16) % 4]);
  }
  // A finish arch over the path from the way out, for whoever escapes.
  for (const dx of [-2, 2]) for (let y = level + 1; y <= level + 4; y++) set(DOORS[2][0] + dx, y, 3, WHITE);
  for (let dx = -2; dx <= 2; dx++) set(DOORS[2][0] + dx, level + 5, 3, [RED, ORANGE, YELLOW, GREEN, SKY][dx + 2]);
  // Trees round the back and the sides, lamp posts at the corners.
  const rng = new Rng(seed ^ 0x45c4a9e);
  for (const [ox, oz] of [[-20, -18], [-8, -19], [6, -18], [19, -17], [-21, -5], [21, 0], [-19, 12], [18, 13]]) place(placeTemplate(oakTree(rng), cx + ox, level + 1, cz + oz, 0));
  const lamp = stampByKey('lamp-post').cells;
  for (const [ox, oz] of [[-H + 1, -H + 1], [H - 1, -H + 1], [-H + 1, H - 1], [H - 1, H - 1], [-4, 8], [4, 8]]) place(placeTemplate(lamp, cx + ox, level + 1, cz + oz, 0));

  buildHouse(world, { cx, cz, level }, new Rng(seed ^ 0x6e5c3a1));
  // Everyone comes in on the path in front of the way in, looking at the
  // house (a camera yaw of 0 looks towards -z).
  const spawn = { x: cx + ENTRANCE[0] + 0.5, y: level + 1, z: cz + 5.5, yaw: 0 };
  const clear = [{ x: cx + 0.5, z: cz + 0.5, r: Math.ceil(H * Math.SQRT2) + 1 }];
  return { spawn, rides: [], clear };
}
