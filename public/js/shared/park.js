// A fun park island's park, in the middle of the island (worldgen.js makes
// the ground there flat for it): a square plaza paved in bricks, with
//
// - a roller coaster (coaster.js): a steel track with a lift hill, a big
//   drop, a vertical loop and banked turns, its train waiting at a station
//   under a striped roof, going round by itself;
// - a Ferris wheel and a merry-go-round, the island's own rides that turn
//   by themselves for everyone to hop on (critters.js spinSeat);
// - a fountain in the middle, a bouncy castle, a video arcade with gashapon
//   machines by its door, a patch of trampolines, lamp posts round the edge
//   and a rainbow gate at the front, just behind where everyone comes in.
//
// Everything is laid out from the plaza's middle (cx, cz): x across, z
// towards the gate, as `o` offsets.
import * as B from './blocks.js';
import { TRACK } from './coaster.js';
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

// The roller coaster's corner of the park, a lawn inside its track; and
// where the coaster stands (the middle of its station: coaster.js), from
// the plaza's middle.
const COASTER = { x0: -22, x1: -10, z0: -19, z1: 19 };
const STATION = { ox: -9.5, oz: 11.2 };

// The park, built into the world round (cx, cz) with the plaza at height
// level. Returns { spawn, rides (the critters it brings: the roller
// coaster, the Ferris wheel and the merry-go-round), clear (what vehicles
// keep clear of, as { x, z, r }), track ([x, y, z] along the coaster's
// track, every block or so, in order round it) }.
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
  // Its track (a model of its own, not blocks), for keeping clear of.
  const track = TRACK.pts.filter((_, i) => i % 4 === 0).map(({ p }) => [cx + STATION.ox + p[0], level + 1 + p[1], cz + STATION.oz + p[2]]);
  // The station: a platform beside the train, under a striped roof on posts.
  for (let oz = 8; oz <= 15; oz++) {
    set(COASTER.x1 + 1, level, oz, B.PLANKS);
    // (Its posts a block clear of the train either side.)
    for (const ox of [COASTER.x1 - 2, COASTER.x1 + 2]) if (oz === 8 || oz === 15) for (let y = level + 1; y <= level + 4; y++) set(ox, y, oz, WHITE);
    // (A roof of bricks, not tent cloth, which would make it a tent to camp out in.)
    for (let ox = COASTER.x1 - 2; ox <= COASTER.x1 + 2; ox++) set(ox, level + 5, oz, (oz + ox) % 2 ? RED : WHITE);
  }
  const rides = [{ type: 'coaster', x: cx + STATION.ox, y: level + 1, z: cz + STATION.oz, yaw: 0 }];

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
      const byTrack = track.some(([tx, , tz]) => Math.hypot(tx - x - 0.5, tz - z - 0.5) < 2);
      if (!byTrack && world.get(x, level + 1, z) === B.AIR && world.get(x, level + 2, z) === B.AIR && world.get(x, level, z) !== pal.top) place(placeTemplate(lamp, x, level + 1, z, 0));
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
    ...track.map(([x, , z]) => ({ x, z, r: 1.5 })),
  ];
  return { spawn, rides, clear, track };
}
