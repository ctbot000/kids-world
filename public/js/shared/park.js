// A fun park island's park, in the middle of the island (worldgen.js makes
// the ground there flat for it): a square plaza paved in bricks, with
//
// - a roller coaster: a loop of rails up on a track of bricks, with a station
//   at the ground and its cars waiting there (mine carts, riding.js: push
//   to get going, and they race down its hills and slow up them), up a long
//   lift hill, along a high straight, down a big drop and over two humps;
// - a Ferris wheel and a merry-go-round, the island's own rides that turn
//   by themselves for everyone to hop on (critters.js spinSeat);
// - a fountain in the middle, a bouncy castle, a video arcade with gashapon
//   machines by its door, a patch of trampolines, lamp posts round the edge
//   and a rainbow gate at the front, just behind where everyone comes in.
//
// Everything is laid out from the plaza's middle (cx, cz): x across, z
// towards the gate, as `o` offsets.
import * as B from './blocks.js';
import { placeTemplate, stampByKey } from './stamps.js';

const [RED, ORANGE, YELLOW, , GREEN, , SKY, BLUE, PURPLE, , PINK, WHITE, , , , TAN] = B.TOY_BRICKS;
const RAINBOW = [RED, ORANGE, YELLOW, GREEN, SKY, BLUE, PURPLE, PINK];

// How far the plaza reaches from its middle, each way (it is a square), and
// how far past that the land eases back into the island's own.
export const PARK_HALF = 24;
export const PARK_BLEND = 7;

// Whether (x, z) is in the park (or its edge, `margin` more), where nothing
// else grows or is put down: no trees, flowers or rocks of the island's own.
export const inPark = (park, x, z, margin = 1) => Boolean(park) && Math.max(Math.abs(x - park.cx), Math.abs(z - park.cz)) <= PARK_HALF + margin;

// The roller coaster's loop: round a rectangle, from its station on the
// east side heading north (-z), each cell's height over the plaza. The
// corners, and the cells either side of them, are level.
const COASTER = { x0: -22, x1: -10, z0: -19, z1: 19 };
function coasterPath() {
  const { x0, x1, z0, z1 } = COASTER;
  const out = [];
  // East side, north: the station (z 19 to 7), then the lift hill, one up
  // every other cell, to 8; along the top to the corner.
  for (let i = 0; i <= z1 - z0; i++) out.push([x1, z1 - i, i <= 12 ? 0 : Math.min(8, Math.floor((i - 12) / 2))]);
  // North side, west: the high straight.
  for (let x = x1 - 1; x >= x0; x--) out.push([x, z0, 8]);
  // West side, south: the big drop, a hump, another drop, a little hump.
  const west = [8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 2, 3, 4, 5, 5, 5, 4, 3, 2, 1, 1, 1, 1, 1, 2, 3, 3, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1];
  for (let j = 0; j < z1 - z0; j++) out.push([x0, z0 + 1 + j, west[j] ?? 1]);
  // South side, east, back down to the station.
  for (let x = x0 + 1; x < x1; x++) out.push([x, z1, x - x0 <= 4 ? 1 : 0]);
  return out;
}

// The park, built into the world round (cx, cz) with the plaza at height
// level. Returns { spawn, rides (the critters it brings: the Ferris wheel,
// the merry-go-round and the coaster's cars), clear (what vehicles keep
// clear of, as { x, z, r }), track ([x, y, z] of each rail, in order round
// the loop) }.
export function buildPark(world, { cx, cz, level, pal }) {
  const at = (ox, oz) => [cx + ox, cz + oz];
  const set = (ox, y, oz, id) => world.set(cx + ox, y, cz + oz, id);
  const place = (cells) => {
    for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z)) world.set(x, y, z, id);
  };
  const H = PARK_HALF;
  // The ground: tan bricks in a diamond pattern of white, with nothing on them, the fountain's square in
  // checked tiles; a lawn inside the coaster's loop.
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      for (let y = level + 1; y < world.H; y++) set(ox, y, oz, B.AIR);
      const lawn = ox > COASTER.x0 && ox < COASTER.x1 && oz > COASTER.z0 && oz < COASTER.z1;
      const square = Math.abs(ox - 3) <= 6 && Math.abs(oz + 3) <= 6;
      set(ox, level, oz, lawn ? pal.top : square ? B.CHECKER_FLOOR : (ox + oz) % 8 === 0 || (ox - oz) % 8 === 0 ? WHITE : TAN);
    }
  }
  // Flowers in the lawn, in rows of colour.
  const flowers = [B.TULIP, B.DAISY, B.BLUEBELL, B.COSMOS, B.SUNFLOWER];
  for (let ox = COASTER.x0 + 2; ox <= COASTER.x1 - 2; ox += 2) {
    for (let oz = COASTER.z0 + 3; oz <= COASTER.z1 - 3; oz++) if ((oz + ox) % 3 !== 0) set(ox, level + 1, oz, flowers[Math.abs(oz >> 2) % flowers.length]);
  }

  // ------------------------------------------------ the roller coaster
  const track = [];
  const path = coasterPath();
  path.forEach(([ox, oz, h], i) => {
    const y = level + 1 + h;
    track.push([cx + ox, y, cz + oz]);
    set(ox, y, oz, B.RAIL);
    if (h === 0) return;
    // A brick track under the rails, in the colours of the rainbow round
    // the loop, on white posts every third cell.
    set(ox, y - 1, oz, RAINBOW[Math.floor(i / 6) % RAINBOW.length]);
    if (i % 3 === 0) for (let k = level + 1; k < y - 1; k++) set(ox, k, oz, WHITE);
  });
  // The station: a platform beside the cars, under a striped roof on posts.
  for (let oz = 8; oz <= 15; oz++) {
    set(COASTER.x1 + 1, level, oz, B.PLANKS);
    for (const ox of [COASTER.x1 - 1, COASTER.x1 + 2]) if (oz === 8 || oz === 15) for (let y = level + 1; y <= level + 4; y++) set(ox, y, oz, WHITE);
    for (let ox = COASTER.x1 - 1; ox <= COASTER.x1 + 2; ox++) set(ox, level + 5, oz, (oz + ox) % 2 ? B.CLOTHS[0] : B.CLOTHS[7]);
  }
  const rides = [];
  // Its cars, waiting at the station, facing up the line.
  for (const oz of [13, 11, 9]) rides.push({ type: 'minecart', x: cx + COASTER.x1 + 0.5, y: level + 1, z: cz + oz + 0.5, yaw: Math.PI });

  // ------------------------------------------------ the rides
  // The Ferris wheel at the back, facing the gate, and the merry-go-round
  // beside it, each on a round floor of white bricks.
  const ferris = { type: 'ferris', x: cx + 3.5, y: level + 1, z: cz - 16.5, yaw: 0 };
  const carousel = { type: 'carousel', x: cx + 17.5, y: level + 1, z: cz - 15.5, yaw: 0 };
  rides.push(ferris, carousel);
  for (let ox = -5; ox <= 5; ox++) for (let oz = -5; oz <= 5; oz++) if (Math.hypot(ox, oz) <= 4.6) set(17 + ox, level, -16 + oz, Math.hypot(ox, oz) <= 3.9 ? WHITE : PINK);
  for (let ox = -2; ox <= 9; ox++) for (let oz = -18; oz <= -15; oz++) set(ox, level, oz, WHITE);

  // ------------------------------------------------ everything else
  const stamp = (key, ox, oz, facing) => place(placeTemplate(stampByKey(key).cells, cx + ox, level + 1, cz + oz, facing));
  stamp('fountain', 3, -6, 0);
  stamp('bouncy-castle', 15, -7, 1);
  stamp('video-arcade', 13, 12, 1);
  // Gashapon machines by the arcade's door, facing the plaza.
  for (const oz of [2, 3, 4]) set(10, level + 1, oz, B.turnedTo(B.GASHAPON, 2));
  // Trampolines, set into the ground.
  for (let ox = -7; ox <= -4; ox++) for (let oz = 9; oz <= 12; oz++) set(ox, level, oz, B.TRAMPOLINE);
  // The gate: two striped posts and a rainbow over the way in, lamps on top.
  for (const ox of [-1, 7]) {
    for (let y = level + 1; y <= level + 5; y++) set(ox, y, 22, y % 2 ? RED : WHITE);
    set(ox, level + 7, 22, B.LAMP);
  }
  for (let ox = -1; ox <= 7; ox++) set(ox, level + 6, 22, RAINBOW[(ox + 1) % RAINBOW.length]);
  // Lamp posts round the edge, wherever nothing else is.
  const lamp = stampByKey('lamp-post').cells;
  for (let k = -H + 2; k <= H - 2; k += 6) {
    for (const [ox, oz] of [[k, -H + 1], [k, H - 1], [-H + 1, k], [H - 1, k]]) {
      const [x, z] = at(ox, oz);
      if (world.get(x, level + 1, z) === B.AIR && world.get(x, level + 2, z) === B.AIR && world.get(x, level, z) !== pal.top) place(placeTemplate(lamp, x, level + 1, z, 0));
    }
  }

  // Everyone comes in just inside the gate, looking up the plaza at the
  // fountain and the Ferris wheel (a camera yaw of 0 looks towards -z).
  const spawn = { x: cx + 3.5, y: level + 1, z: cz + 14.5, yaw: 0 };
  const clear = [
    { x: ferris.x, z: ferris.z, r: 8 },
    { x: carousel.x, z: carousel.z, r: 5 },
    { x: cx + 3.5, z: cz - 2.5, r: 4 },
    { x: cx + 18.5, z: cz - 6.5, r: 4 },
    { x: cx + 18, z: cz + 12, r: 7 },
    { x: cx - 5, z: cz + 11, r: 2 },
    ...track.map(([x, , z]) => ({ x: x + 0.5, z: z + 0.5, r: 1 })),
  ];
  return { spawn, rides, clear, track };
}
