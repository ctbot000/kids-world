// A racing island's race track, in the middle of the island (worldgen.js
// makes the ground there flat for it, as for a fun park's plaza: the same
// square, park.js PARK_HALF), with
//
// - an oval track of asphalt (blocks.js RACE_TRACK): two straights joined by
//   two round bends, red and white kerbs along both edges, and a checkered
//   finish line across the near straight;
// - go-karts waiting on the starting grid just behind the line, facing the
//   way round (anticlockwise, seen from above);
// - a grandstand of coloured steps along the near straight, a podium and a
//   checkered flag in the grass inside the oval, a pit garage across the
//   far straight, stacks of tyres round the bends, lamp posts and flags.
//
// Driving anything round it times your laps (lapStep, below; game.js shows
// them): cross the line to start the clock, go all the way round, and cross
// it again.
//
// Everything is laid out from the middle (cx, cz): x across, z towards the
// grandstand and where everyone comes in, as `o` offsets.
import * as B from './blocks.js';
import { PARK_HALF } from './park.js';
import { placeTemplate, stampByKey } from './stamps.js';

const [RED, ORANGE, YELLOW, , GREEN, , SKY, BLUE, PURPLE, , PINK, WHITE, GRAY, CHARCOAL] = B.TOY_BRICKS;

// The oval's centre line: two straights 2L long, along x, joined by half
// circles of radius R round (±L, 0); the track reaches W either side of it.
export const OVAL = { L: 9, R: 10, W: 3.5 };
const LAP = 4 * OVAL.L + 2 * Math.PI * OVAL.R;

// Where (ox, oz), from the middle, is on the oval: how far from its centre
// line (off, plus outside, minus inside) and how far round from the finish
// line (at, 0 to 1), going the way the karts go: west along the near
// straight (+z), round the west bend, east along the far one, round the
// east bend and back.
export function ovalAt(ox, oz) {
  const { L, R } = OVAL;
  let s;
  let d;
  if (Math.abs(ox) <= L) {
    d = Math.abs(oz) - R;
    s = oz > 0 ? (ox <= 0 ? -ox : 3 * L + 2 * Math.PI * R + (L - ox)) : L + Math.PI * R + (ox + L);
  } else if (ox < -L) {
    d = Math.hypot(ox + L, oz) - R;
    let a = Math.atan2(oz, ox + L);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    s = L + R * (a - Math.PI / 2);
  } else {
    d = Math.hypot(ox - L, oz) - R;
    s = 3 * L + Math.PI * R + R * (Math.atan2(oz, ox - L) + Math.PI / 2);
  }
  return { off: d, at: (((s / LAP) % 1) + 1) % 1 };
}

// Whether the cell at (ox, oz) is the track's (its middle on it).
export const onTrack = (ox, oz) => Math.abs(ovalAt(ox, oz).off) <= OVAL.W;

// The island's race track, if it has one: where it is in the world, for
// lapStep.
export function raceTrack(world) {
  if (world?.theme !== 'race') return null;
  return { cx: Math.floor(world.W / 2) + 0.5, cz: Math.floor(world.D / 2) + 0.5, y: world.sea + 5 };
}

// A lap's checkpoints, a quarter of the way round each, to be passed in turn
// so that cutting across the grass or turning back at the line is no lap.
const GATES = 3;
const NEAR = 3;

// One step of someone's lap clock: lap (their own, {} to begin with) is
// updated from where they are now, at now (ms). Returns { start } as they
// cross the line to begin, { lap: ms, best } as they finish one going all
// the way round (and start the next), or nothing.
export function lapStep(lap, track, x, y, z, now) {
  const { off, at } = ovalAt(x - track.cx, z - track.cz);
  // Off the track by more than a little (or up in the air), the clock
  // carries on but nothing is passed.
  if (Math.abs(off) > OVAL.W + NEAR || Math.abs(y - track.y) > 3) return null;
  const was = lap.at;
  lap.at = at;
  if (was === undefined) return null;
  // Over the line forwards…
  if (was > 0.8 && at < 0.2) {
    const done = lap.start !== undefined && lap.gate === GATES;
    const ms = now - lap.start;
    lap.start = now;
    lap.gate = 0;
    if (!done) return { start: true };
    const best = !(lap.best <= ms);
    if (best) lap.best = ms;
    return { lap: ms, best };
  }
  // …or back over it, which starts nothing.
  if (was < 0.2 && at > 0.8) {
    lap.start = undefined;
    lap.gate = 0;
    return null;
  }
  const next = ((lap.gate ?? 0) + 1) / (GATES + 1);
  if (lap.start !== undefined && (lap.gate ?? 0) < GATES && at >= next && at < next + 0.15) lap.gate = (lap.gate ?? 0) + 1;
  return null;
}

// A lap time to show: 23.4 s, or 1:05.2.
export function lapTime(ms) {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

// The race track, built into the world round (cx, cz) with the ground at
// height level. Returns { spawn, rides (the go-karts on the grid), clear
// (what other vehicles keep clear of, as { x, z, r }) }.
export function buildRace(world, { cx, cz, level, pal }) {
  const set = (ox, y, oz, id) => world.set(cx + ox, y, cz + oz, id);
  const get = (ox, y, oz) => world.get(cx + ox, y, cz + oz);
  const place = (cells) => {
    for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z)) world.set(x, y, z, id);
  };
  const H = PARK_HALF;
  // The ground: the track, its kerbs, and grass everywhere else, with
  // nothing on any of it.
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      for (let y = level + 1; y < world.H; y++) set(ox, y, oz, B.AIR);
      const { off } = ovalAt(ox, oz);
      let id = pal.top;
      if (Math.abs(off) <= OVAL.W) id = B.RACE_TRACK;
      else if (Math.abs(off) <= OVAL.W + 1) id = Math.floor((ox + oz) / 2) & 1 ? RED : WHITE;
      set(ox, level, oz, id);
    }
  }
  // The finish line: checkered, two cells wide, across the near straight.
  for (let oz = 0; oz <= H; oz++) {
    for (const ox of [-1, 0]) if (Math.abs(ovalAt(ox, oz).off) <= OVAL.W) set(ox, level, oz, B.CHECKER_FLOOR);
  }
  // Over it, a gantry: grey posts either side and a checkered beam across.
  const lineIn = OVAL.R - OVAL.W - 2;
  const lineOut = OVAL.R + OVAL.W + 2;
  for (const oz of [Math.floor(lineIn), Math.ceil(lineOut)]) for (let y = level + 1; y <= level + 6; y++) set(0, y, oz, GRAY);
  for (let oz = Math.floor(lineIn); oz <= Math.ceil(lineOut); oz++) set(0, level + 7, oz, oz % 2 ? B.CHECKER_FLOOR : CHARCOAL);
  for (const oz of [Math.floor(lineIn), Math.ceil(lineOut)]) set(0, level + 8, oz, B.LAMP);

  // The go-karts, two by two on the grid just behind the line, facing west
  // (a yaw of -π/2 faces -x).
  const rides = [];
  const grid = [
    [3, OVAL.R - 1.5],
    [5, OVAL.R + 1.5],
    [7, OVAL.R - 1.5],
    [9, OVAL.R + 1.5],
  ];
  for (const [ox, oz] of grid) rides.push({ type: 'kart', x: cx + ox + 0.5, y: level + 1, z: cz + oz + 0.5, yaw: -Math.PI / 2 });
  // The grid's boxes, white lines on the asphalt.
  for (const [ox, oz] of grid) for (const dz of [-1, 0, 1]) set(ox - 1, level, Math.round(oz) + dz, WHITE);

  // The grandstand along the near straight: five steps of seats in the
  // colours of the rainbow, rising away from the track, with a back wall and
  // flags along the top.
  const STEPS = [RED, ORANGE, YELLOW, GREEN, BLUE];
  const stand0 = Math.ceil(lineOut) + 2;
  for (let ox = -12; ox <= 12; ox++) {
    STEPS.forEach((id, k) => {
      for (let y = level + 1; y <= level + 1 + k; y++) set(ox, y, stand0 + k, y === level + 1 + k ? id : WHITE);
    });
    for (let y = level + 1; y <= level + 7; y++) set(ox, y, stand0 + STEPS.length, WHITE);
  }
  for (let ox = -12; ox <= 12; ox += 4) {
    set(ox, level + 8, stand0 + STEPS.length, GRAY);
    set(ox, level + 9, stand0 + STEPS.length, [RED, YELLOW, SKY, PINK, GREEN, PURPLE, ORANGE][((ox + 12) / 4) % 7]);
  }
  // Stairs up the middle and at the ends, to get to the seats.
  for (const ox of [-13, 13]) for (let k = 0; k < STEPS.length; k++) set(ox, level + 1 + k, stand0 + k, GRAY);

  // The pit garage across the far straight: a long box of bricks open to the
  // track, with a striped roof and the karts' tool racks inside.
  const pit0 = -Math.ceil(lineOut) - 2;
  for (let ox = -12; ox <= 12; ox++) {
    for (let oz = pit0 - 4; oz <= pit0; oz++) {
      set(ox, level, oz, GRAY);
      const wall = ox === -12 || ox === 12 || oz === pit0 - 4;
      for (let y = level + 1; y <= level + 4; y++) if (wall || (oz === pit0 && ox % 6 === 0)) set(ox, y, oz, WHITE);
      set(ox, level + 5, oz, (ox + 12) % 4 < 2 ? RED : WHITE);
    }
  }
  for (let ox = -10; ox <= 10; ox += 5) set(ox, level + 1, pit0 - 3, B.turnedTo(B.COUNTER, 0));

  // In the grass inside the oval: the podium, gold in the middle with silver
  // and bronze either side, and a tall pole with a checkered flag.
  for (const [ox, h, id] of [[0, 3, YELLOW], [-2, 2, GRAY], [2, 1, ORANGE]]) {
    for (let dx = 0; dx < 2; dx++) for (let y = level + 1; y <= level + h; y++) set(ox + dx, y, 0, id);
  }
  for (let y = level + 1; y <= level + 9; y++) set(-7, y, 0, WHITE);
  for (let dx = 1; dx <= 3; dx++) for (let dy = 0; dy < 2; dy++) set(-7 + dx, level + 8 + dy, 0, (dx + dy) % 2 ? CHARCOAL : WHITE);
  // Flowers round the podium.
  for (let ox = -3; ox <= 4; ox++) for (const oz of [-2, 2]) set(ox, level + 1, oz, [B.TULIP, B.SUNFLOWER, B.DAISY][(ox + 3) % 3]);

  // Stacks of tyres just outside each bend, where a kart going too fast
  // might end up.
  for (const side of [-1, 1]) {
    for (let a = -1.2; a <= 1.2; a += 0.3) {
      const ox = Math.round(side * (OVAL.L + Math.cos(a) * (OVAL.R + OVAL.W + 2)));
      const oz = Math.round(Math.sin(a) * (OVAL.R + OVAL.W + 2));
      if (get(ox, level + 1, oz) !== B.AIR || Math.abs(ox) > H || Math.abs(oz) > H || Math.abs(ovalAt(ox, oz).off) < OVAL.W + 2) continue;
      set(ox, level + 1, oz, CHARCOAL);
      set(ox, level + 2, oz, CHARCOAL);
    }
  }
  // Lamp posts in the corners.
  const lamp = stampByKey('lamp-post').cells;
  for (const [ox, oz] of [[-H + 1, -H + 1], [H - 1, -H + 1], [-H + 1, H - 1], [H - 1, H - 1]]) place(placeTemplate(lamp, cx + ox, level + 1, cz + oz, 0));

  // Everyone comes in beside the grid, looking across the track at the
  // karts (a camera yaw of 0 looks towards -z).
  const spawn = { x: cx + 6.5, y: level + 1, z: cz + Math.ceil(lineOut) + 0.5, yaw: 0 };
  // (The whole square, corners and all.)
  const clear = [{ x: cx + 0.5, z: cz + 0.5, r: Math.ceil(H * Math.SQRT2) + 1 }];
  return { spawn, rides, clear };
}
