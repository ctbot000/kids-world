// A zoo island's zoo, in the middle of the island (worldgen.js makes the
// ground there flat for it, as for a fun park's plaza: the same square,
// park.js PARK_HALF), with
//
// - paths in a cross from the gate at the front, round a fountain in the
//   middle, flowers along them, and a path all round the edge;
// - four pens, one in each corner of the cross, each walled in a brick
//   kerb with glass on top, three blocks high, too high for any animal to
//   get out (nor anyone to climb in) and clear to see them through:
//   - the savanna (back left): elephants and giraffes on sand, a water hole
//     and flat-topped acacia trees;
//   - the polar pool (back right): penguins and seals on snow round a deep
//     pool with floes of ice, and a polar bear with a pool of its own
//     behind glass beside them;
//   - the petting farm (front left): sheep, bunnies, chicks, a cow and
//     ducks on a pond, hay bales, a door in to pet them;
//   - the pony paddock (front right): ponies, a unicorn and a reindeer, a
//     door in, and room to ride them round;
// - a gate at the front, just behind where everyone comes in, lamp posts
//   in the corners, and a lamp on every pen's corner posts.
//
// Everything is laid out from the middle (cx, cz): x across, z towards the
// gate, as `o` offsets.
import * as B from './blocks.js';
import { PARK_HALF } from './park.js';
import { placeTemplate, stampByKey } from './stamps.js';

const [RED, ORANGE, YELLOW, , GREEN, , SKY, , PURPLE, , , , , , BROWN, TAN] = B.TOY_BRICKS;

// The pens, from the middle: their walls run round x0..x1 by z0..z1, the
// ground inside, what the animals stand on, the colour of their kerb and
// posts, and a door (in the wall nearest the middle) for those anyone may
// walk into.
export const PENS = [
  { key: 'savanna', name: 'Savanna', x0: -21, x1: -5, z0: -21, z1: -5, ground: B.SAND, kerb: ORANGE },
  { key: 'polar', name: 'Polar Pool', x0: 5, x1: 21, z0: -21, z1: -5, ground: B.SNOW, kerb: SKY },
  { key: 'farm', name: 'Petting Farm', x0: -21, x1: -5, z0: 5, z1: 21, ground: B.GRASS, kerb: RED, door: true },
  { key: 'paddock', name: 'Pony Paddock', x0: 5, x1: 21, z0: 5, z1: 21, ground: B.GRASS, kerb: PURPLE, door: true },
];
// How high a pen's wall is: a brick kerb and glass on it.
export const WALL = 3;
// The polar pool's glass between the penguins' side and the polar bear's.
const BEAR_X = 14;

// The animals in each pen: type, and where, from the middle.
export const ZOO_ANIMALS = [
  ['elephant', -17, -17],
  ['elephant', -9, -16],
  ['giraffe', -16, -9],
  ['giraffe', -10, -10],
  ['penguin', 7, -18],
  ['penguin', 8, -17],
  ['penguin', 7, -8],
  ['penguin', 9, -7],
  ['seal', 11, -18],
  ['seal', 11, -7],
  ['polarbear', 17, -17],
  ['sheep', -17, 9],
  ['sheep', -15, 11],
  ['bunny', -10, 9],
  ['bunny', -9, 12],
  ['bunny', -11, 15],
  ['chick', -13, 17],
  ['chick', -12, 18],
  ['chick', -14, 18],
  ['cow', -9, 18],
  ['duck', -18, 17],
  ['duck', -17, 18],
  ['pony', 9, 10],
  ['pony', 15, 15],
  ['unicorn', 17, 9],
  ['reindeer', 10, 17],
];

// Which pen (from PENS) the cell at (ox, oz) from the middle is inside,
// walls and all, or null.
export const penAt = (ox, oz) => PENS.find((p) => ox >= p.x0 && ox <= p.x1 && oz >= p.z0 && oz <= p.z1) ?? null;
// Whether it is inside a pen's walls, and not on them.
export const inPen = (p, ox, oz) => ox > p.x0 && ox < p.x1 && oz > p.z0 && oz < p.z1;

// The island's zoo, if it has one: where its middle is in the world.
export function zooAt(world) {
  if (world?.theme !== 'zoo') return null;
  return { cx: Math.floor(world.W / 2), cz: Math.floor(world.D / 2), y: world.sea + 5 };
}

// The zoo, built into the world round (cx, cz) with the ground at height
// level. Returns { spawn, rides (the zoo's animals, in their pens), clear
// (what vehicles keep clear of, as { x, z, r }) }.
export function buildZoo(world, { cx, cz, level, pal }) {
  const set = (ox, y, oz, id) => world.set(cx + ox, y, cz + oz, id);
  const place = (cells) => {
    for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z)) world.set(x, y, z, id);
  };
  const H = PARK_HALF;
  // The ground: grass, the paths of pebbles (the cross, the fountain's
  // square and the way round the edge), flowers along the cross, and each
  // pen's own ground, with nothing on any of it.
  const flowers = [B.TULIP, B.DAISY, B.SUNFLOWER, B.BLUEBELL, B.COSMOS];
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      for (let y = level + 1; y < world.H; y++) set(ox, y, oz, B.AIR);
      const pen = penAt(ox, oz);
      const path = Math.abs(ox) <= 2 || Math.abs(oz) <= 2 || (Math.abs(ox) <= 4 && Math.abs(oz) <= 4) || Math.max(Math.abs(ox), Math.abs(oz)) >= 23;
      set(ox, level, oz, pen ? (pen.ground === B.GRASS ? pal.top : pen.ground) : path ? B.PEBBLES : pal.top);
      if (!pen && !path && (Math.abs(ox) === 3 || Math.abs(oz) === 3)) set(ox, level + 1, oz, flowers[(ox * 7 + oz * 3 + 99) % flowers.length]);
    }
  }
  // The walls: a kerb of the pen's colour, glass on it, and posts at the
  // corners with a lamp on each.
  for (const p of PENS) {
    for (let ox = p.x0; ox <= p.x1; ox++) {
      for (let oz = p.z0; oz <= p.z1; oz++) {
        if (inPen(p, ox, oz)) continue;
        const corner = (ox === p.x0 || ox === p.x1) && (oz === p.z0 || oz === p.z1);
        set(ox, level + 1, oz, p.kerb);
        for (let y = level + 2; y <= level + WALL; y++) set(ox, y, oz, corner ? p.kerb : B.GLASS);
        if (corner) set(ox, level + WALL + 1, oz, B.LAMP);
      }
    }
    // A door, two tall, in the middle of the wall nearest the cross path,
    // for a pen anyone may walk into.
    if (p.door) {
      const ox = Math.round((p.x0 + p.x1) / 2);
      set(ox, level + 1, p.z0, B.DOORS[0]);
      set(ox, level + 2, p.z0, B.DOORS[0]);
      set(ox, level + 3, p.z0, p.kerb);
    }
  }

  // The savanna: a water hole two deep, a few flat-topped acacia trees, and
  // hay for the elephants.
  for (let ox = -15; ox <= -11; ox++) {
    for (let oz = -14; oz <= -12; oz++) {
      set(ox, level, oz, B.WATER);
      set(ox, level - 1, oz, B.WATER);
      set(ox, level - 2, oz, B.SAND);
    }
  }
  for (const [ox, oz] of [[-19, -12], [-8, -19], [-7, -7]]) {
    for (let y = level + 1; y <= level + 5; y++) set(ox, y, oz, B.WOOD);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) < 4) set(ox + dx, level + 6, oz + dz, B.LEAVES);
  }
  for (const [ox, oz] of [[-19, -19], [-19, -18]]) set(ox, level + 1, oz, B.HAY);

  // The polar pool: deep water with floes of ice on the penguins' side, a
  // pool of its own on the bear's, and glass between them.
  const pool = (x0, x1, z0, z1) => {
    for (let ox = x0; ox <= x1; ox++) {
      for (let oz = z0; oz <= z1; oz++) {
        for (let y = level - 2; y <= level; y++) set(ox, y, oz, B.WATER);
        set(ox, level - 3, oz, B.ICE);
      }
    }
  };
  pool(7, 11, -15, -10);
  for (const [ox, oz] of [[8, -13], [10, -11]]) set(ox, level, oz, B.ICE);
  pool(16, 19, -12, -8);
  for (let oz = -20; oz <= -6; oz++) {
    set(BEAR_X, level + 1, oz, SKY);
    for (let y = level + 2; y <= level + WALL; y++) set(BEAR_X, y, oz, B.GLASS);
  }
  // Snowy rocks for the bear to climb.
  for (const [ox, oz, h] of [[19, -19, 2], [18, -19, 1], [19, -18, 1]]) for (let y = level + 1; y <= level + h; y++) set(ox, y, oz, B.STONE);
  set(19, level + 3, -19, B.SNOW);

  // The petting farm: a duck pond, hay bales, a trough of water and a
  // scarecrow.
  for (let ox = -19; ox <= -16; ox++) {
    for (let oz = 14; oz <= 16; oz++) {
      set(ox, level, oz, B.WATER);
      set(ox, level - 1, oz, B.DIRT);
    }
  }
  for (const [ox, oz] of [[-20, 7], [-19, 7], [-20, 8], [-7, 20]]) set(ox, level + 1, oz, B.HAY);
  set(-6, level + 1, 7, B.SCARECROW);

  // The pony paddock: a ring of planks to ride round, hay, and a trough.
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    set(Math.round(13 + Math.cos(t) * 5), level, Math.round(13 + Math.sin(t) * 5), TAN);
  }
  for (const [ox, oz] of [[20, 20], [19, 20], [20, 19]]) set(ox, level + 1, oz, B.HAY);
  for (let ox = 6; ox <= 8; ox++) set(ox, level, 20, B.WATER);

  // The fountain in the middle of the cross.
  place(placeTemplate(stampByKey('fountain').cells, cx, level + 1, cz - 3, 0));

  // The gate over the cross path at the front: brown posts and a beam of
  // giraffe yellow with spots, flags on top.
  const gz = H - 2;
  for (const ox of [-3, 3]) for (let y = level + 1; y <= level + 6; y++) set(ox, y, gz, BROWN);
  for (let ox = -3; ox <= 3; ox++) {
    set(ox, level + 7, gz, (ox + 3) % 3 === 1 ? ORANGE : YELLOW);
    set(ox, level + 8, gz, Math.abs(ox) === 3 ? B.LAMP : ox % 2 ? GREEN : YELLOW);
  }
  // Benches along the path round the edge, between the pens.
  for (const [ox, oz] of [[-8, 23], [8, 23], [-23, 0], [23, 0]]) set(ox, level + 1, oz, B.SOFA);
  // Lamp posts in the corners.
  const lamp = stampByKey('lamp-post').cells;
  for (const [ox, oz] of [[-H + 1, -H + 1], [H - 1, -H + 1], [-H + 1, H - 1], [H - 1, H - 1]]) place(placeTemplate(lamp, cx + ox, level + 1, cz + oz, 0));

  // The animals, each in its pen.
  const rides = ZOO_ANIMALS.map(([type, ox, oz]) => ({ type, x: cx + ox + 0.5, y: level + 1, z: cz + oz + 0.5 }));
  // Everyone comes in just inside the gate, looking up the path at it all
  // (a camera yaw of 0 looks towards -z).
  const spawn = { x: cx + 0.5, y: level + 1, z: cz + H - 3.5, yaw: 0 };
  const clear = [{ x: cx + 0.5, z: cz + 0.5, r: Math.ceil(H * Math.SQRT2) + 1 }];
  return { spawn, rides, clear };
}
