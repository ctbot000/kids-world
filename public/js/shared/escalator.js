// Escalators: moving stairs (blocks.js ESCALATOR, ESCALATOR_DOWN). Each
// piece is a slope of steps across its cell, from its foot at the front, on
// the floor, up to its head at the back, level with the floor of the cell
// above; a run of the same piece, each one a step up and along from the
// last, is one long escalator. Stand on one and its steps carry you along
// it, up an up escalator and down a down one. Walking adds to them: quicker
// the way it goes, slower the other (or, quick enough, back the way it
// came, as children do), and a jump is a hop on the steps as they go. At
// its end the steps put you on the floor beyond. Like a lift
// (shared/elevator.js), the body is carried along the slope, not stood on
// anything: the cells are not solid, and everyone just sees the rider's
// position change.
//
// Along an escalator a point is measured by `a`, how far it is along the
// escalator's run (from its foot towards its head) in blocks: every piece's
// foot is at a whole number, and feet on its steps are as high as `a` plus
// the escalator's `rise`.
import { BLOCKS } from './blocks.js';
import { bodyOverlapsSolid, MOVE } from './physics.js';

// How fast the steps go: blocks a second along, and as many up (or down).
export const ESCALATOR_SPEED = 1.8;
// How far past an end the steps carry you, out onto the floor beyond, before
// you are let go to walk on by yourself: far enough for all of you to be off.
export const STEP_OFF = 0.45;
// How far under the slope of the steps (or over it) feet in a piece's cell
// may be for it to take them on: walking in at its foot, or coming down
// onto it (from fromY, over it a moment before, however fast).
const UNDER = 0.55;
const OVER = 0.35;

// The ways furniture faces (blocks.js), as RAIL_DIRS.
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

// Up (1), down (-1), or no escalator at all (0).
export const escalatorWay = (id) => BLOCKS[id]?.escalator ?? 0;

// The way a piece runs (dx, dz), from its foot up to its head: away from
// its front, which faces whoever put it down.
export const runOf = (id) => DIRS[((BLOCKS[id]?.front ?? 3) + 2) % 4];

// The cell of escalator e's piece whose foot is k along it.
function cellOf(e, k) {
  const along = e.s > 0 ? k : -k - 1;
  const across = e.mid - 0.5;
  return e.alongX ? [along, k + e.rise, across] : [across, k + e.rise, along];
}

const pieceAt = (world, e, k) => {
  const [x, y, z] = cellOf(e, k);
  return world.get(x, y, z) === e.id;
};

// How far escalator e runs, from the foot of its lowest piece (from) to the
// head of its highest (to), looking out from its piece with its foot at k.
function reach(world, e, k) {
  e.from = k;
  e.to = k + 1;
  while (pieceAt(world, e, e.from - 1)) e.from--;
  while (pieceAt(world, e, e.to)) e.to++;
  return e;
}

// The escalator the piece in cell (x, y, z) is part of, or null: its block
// (every piece of one is the same), up or down (way), the way it runs, the
// line along its middle (mid, across it), how high feet are along it (a +
// rise), and where it starts and ends (from, to).
export function escalatorOf(world, x, y, z) {
  const id = world.get(x, y, z);
  const way = escalatorWay(id);
  if (!way) return null;
  const [dx, dz] = runOf(id);
  const alongX = dx !== 0;
  const s = dx || dz;
  const foot = (alongX ? x : z) * s - (s < 0 ? 1 : 0);
  const e = { id, way, dx, dz, alongX, s, mid: (alongX ? z : x) + 0.5, rise: y - foot, from: foot, to: foot + 1 };
  return reach(world, e, foot);
}

// How far along escalator e a point (x, z) is.
export const alongOf = (e, x, z) => (e.alongX ? x : z) * e.s;

// How high feet are at a along escalator e: on its steps, and on the floor
// past either end.
export const feetAt = (e, a) => Math.min(e.to, Math.max(e.from, a)) + e.rise;

// Whether the pieces before and after the one in cell (x, y, z) are there
// (the same piece, one down and back, one up and along): the first of an
// escalator has its steps come up out of the floor, the last has them go
// under the floor at the top (render/escalator-model.js).
export function piecesBeside(world, x, y, z) {
  const id = world.get(x, y, z);
  const [dx, dz] = runOf(id);
  return { below: world.get(x - dx, y - 1, z - dz) === id, above: world.get(x + dx, y + 1, z + dz) === id };
}

// The ride a body takes on the escalator in its cell, when it stands on its
// steps or has just come down onto them (from fromY), or null. It keeps the
// speed it had along it, so walking on goes on.
export function boardEscalator(world, b, fromY = b.y) {
  if (b.flying || b.inWater || b.inLava || b.vy > 0) return null;
  const x = Math.floor(b.x);
  const z = Math.floor(b.z);
  const y = Math.floor(b.y);
  for (const cy of [y, y - 1, y + 1]) {
    const e = escalatorOf(world, x, cy, z);
    if (!e) continue;
    const a = alongOf(e, b.x, b.z);
    const h = feetAt(e, a);
    if ((b.y - h >= -UNDER && b.y - h <= OVER) || (fromY >= h && b.y <= h)) return { ...e, a, v: b.vx * e.dx + b.vz * e.dz, hop: 0, hopV: 0 };
  }
  return null;
}

const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

// Whether a body standing at a along escalator e (on the floor, past an
// end) would be in a block.
function blocked(world, b, e, a) {
  const at = { x: e.mid, y: feetAt(e, a), z: e.mid, radius: b.radius, height: b.height };
  if (e.alongX) at.x = a * e.s;
  else at.z = a * e.s;
  return bodyOverlapsSolid(world, at);
}

// Carries a body along its ride for dt seconds. walk: how fast it walks
// along the escalator itself (blocks a second, less than 0 back down its
// run); jump: how fast a hop goes up, if one starts now. What happened, as
// physics.js stepBody says it, and whether it stepped off an end (off) or
// the steps under it are gone (gone: picked up, or flown off), to fall.
export function stepEscalator(world, b, ride, dt, { walk = 0, jump = 0, accel = MOVE.groundAccel, gravity = MOVE.gravity } = {}) {
  const events = { jumped: false, landed: 0, splashed: false, bumped: false, off: false, gone: false };
  // The steps under the feet still there, and the escalator as long as it
  // is now (built on, or a piece picked up). A body that is somewhere else
  // altogether (sent home, or flying) has left it.
  const k = Math.floor(Math.min(ride.to - 1, Math.max(ride.from, ride.a)));
  const away = Math.abs(alongOf(ride, b.x, b.z) - ride.a) + Math.abs((ride.alongX ? b.z : b.x) - ride.mid) + Math.abs(b.y - feetAt(ride, ride.a) - ride.hop);
  if (b.flying || away > 1.5 || !pieceAt(world, ride, k)) {
    events.gone = true;
    return events;
  }
  reach(world, ride, k);
  ride.v = approach(ride.v, ride.way * ESCALATOR_SPEED + walk, accel * dt);
  let a = ride.a + ride.v * dt;
  // At an end, out onto the floor beyond, unless something stands in the
  // way there: then the steps keep you at the end.
  if ((a > ride.to && blocked(world, b, ride, ride.to + STEP_OFF)) || (a < ride.from && blocked(world, b, ride, ride.from - STEP_OFF))) {
    a = Math.min(ride.to, Math.max(ride.from, a));
    ride.v = 0;
  }
  ride.a = a;
  // A hop on the steps, carried along all the while.
  if (jump && ride.hop === 0) {
    ride.hopV = jump;
    events.jumped = true;
  }
  if (ride.hop > 0 || ride.hopV > 0) {
    ride.hopV -= gravity * dt;
    ride.hop += ride.hopV * dt;
    if (ride.hop <= 0) {
      events.landed = -ride.hopV;
      ride.hop = 0;
      ride.hopV = 0;
    }
  }
  const k2 = Math.min(1, dt * 10);
  if (ride.alongX) {
    b.x = a * ride.s;
    b.z += (ride.mid - b.z) * k2;
  } else {
    b.z = a * ride.s;
    b.x += (ride.mid - b.x) * k2;
  }
  b.y = feetAt(ride, a) + ride.hop;
  b.vx = ride.v * ride.dx;
  b.vz = ride.v * ride.dz;
  b.vy = ride.hopV;
  b.onGround = ride.hop === 0;
  events.off = ride.hop === 0 && (a > ride.to + STEP_OFF || a < ride.from - STEP_OFF);
  return events;
}
