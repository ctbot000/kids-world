// Sitting on chairs and sofas, at school and study desks, soaking in a hot
// tub, and lying in bed (curled up in a bed one block long, stretched out in
// a longer one). Walk up to one and press Q (or the Sit button beside it):
// you sit facing the way it faces, or lie down with your head at the head of
// the bed. Moving, jumping, Shift or Q gets you up again, in front of it.
// Friends see you sit (render/avatar.js ANIM.sit and ANIM.lie, sent with
// where you are like any other pose).
import { BLOCKS } from './blocks.js';

// For each kind of seat: lie down or sit, and for sitting how high the seat
// is and where on it you sit (across, and back from the front, as the model
// is laid out in shared/furniture.js, facing -z).
export const SEATS = {
  chair: { pose: 'sit', h: 0.54, at: [0.5, 0.52] },
  // A rocking chair rocks while you sit in it (game.js), so its seat is a
  // little higher off the ground on its rockers.
  'rocking-chair': { pose: 'sit', h: 0.56, at: [0.5, 0.5] },
  sofa: { pose: 'sit', h: 0.48, at: [0.5, 0.46] },
  bed: { pose: 'lie', h: 0.56 },
  'school-desk': { pose: 'sit', h: 0.48, at: [0.5, 0.7] },
  'study-desk': { pose: 'sit', h: 0.48, at: [0.5, 0.7] },
  // Soaking in a hot tub (game.js draws the steam and the hearts): low down,
  // so the water comes up to your shoulders, with room for two side by side
  // (spots, the first one free).
  'hot-tub': { pose: 'soak', h: 0.12, spots: [[0.32, 0.5], [0.68, 0.5]] },
};

// The four ways along the ground, as RAIL_DIRS.
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export const seatOf = (id) => SEATS[BLOCKS[id]?.model] ?? null;

// A point of a cell's layout (as the model's: x across, z back from its
// front) in the world, for a piece facing `front`.
function layoutPoint(front, lx, lz) {
  let [x, z] = [lx, lz];
  // Quarter turns from -z (the layout's front) round to `front`, as furniture.js.
  for (let i = 0; i < (front + 1) % 4; i++) [x, z] = [1 - z, x];
  return [x, z];
}

// Whether the cell one step (dx, dz) from (x, y, z) holds the same piece,
// facing the same way, as `def`: one joined to it.
function joined(world, x, y, z, def, dx, dz) {
  const next = BLOCKS[world.get(x + dx, y, z + dz)];
  return next?.model === def.model && next.front === def.front;
}

// The yaw an avatar has facing way `front` (it faces +z at yaw 0).
const yawFacing = (front) => Math.atan2(DIRS[front][0], DIRS[front][1]);

// The seat nearest a body standing beside it (or on it), within `reach`
// blocks: { x, y, z } of its cell, or null. taken(x, y, z): whether someone
// else is already in the seat in that cell, so it is passed over.
export function seatNear(world, body, reach = 1.6, taken = () => false) {
  const bx = Math.floor(body.x);
  const bz = Math.floor(body.z);
  const by = Math.floor(body.y + 0.05);
  let best = null;
  let near = reach;
  for (let x = bx - 2; x <= bx + 2; x++) {
    for (let z = bz - 2; z <= bz + 2; z++) {
      for (let y = by - 1; y <= by; y++) {
        if (!seatOf(world.get(x, y, z)) || taken(x, y, z)) continue;
        const d = Math.hypot(x + 0.5 - body.x, z + 0.5 - body.z);
        if (d < near) {
          near = d;
          best = { x, y, z };
        }
      }
    }
  }
  return best;
}

// Where you are on the seat in cell (x, y, z): { x, y, z, yaw, pose, cell },
// the point your hips are at (and for a bed, your feet), or null if it is
// not a seat. In a bed you lie from its foot, the front of the bed in front
// of all the others joined to it, with your head towards its head. A seat
// with room for more than one (a hot tub) has spots: `spot` says which.
export function seatPose(world, x, y, z, spot = 0) {
  const id = world.get(x, y, z);
  const seat = seatOf(id);
  if (!seat) return null;
  const def = BLOCKS[id];
  const front = def.front;
  const yaw = yawFacing(front);
  if (seat.pose === 'lie') {
    const [fx, fz] = DIRS[front];
    let [cx, cz] = [x, z];
    for (let i = 0; i < 8 && joined(world, cx, y, cz, def, fx, fz); i++) {
      cx += fx;
      cz += fz;
    }
    // A bed one block long is too short to stretch out in: you curl up in
    // the middle of it (render/avatar.js shrinks you just enough to fit).
    if (cx === x && cz === z && !joined(world, x, y, z, def, -fx, -fz)) {
      const [mx, mz] = layoutPoint(front, 0.5, 0.5);
      return { x: x + mx, y: y + seat.h, z: z + mz, yaw, pose: 'curl', cell: { x, y, z } };
    }
    const [px, pz] = layoutPoint(front, 0.5, 0.14);
    return { x: cx + px, y: y + seat.h, z: cz + pz, yaw, pose: 'lie', cell: { x, y, z } };
  }
  const [ax, az] = seat.spots?.[spot] ?? seat.at;
  const [px, pz] = layoutPoint(front, ax, az);
  return { x: x + px, y: y + seat.h, z: z + pz, yaw, pose: seat.pose, cell: { x, y, z } };
}

// The spot free in the seat in cell (x, y, z), with friends sitting where
// `others` says ({ x, y, z } each): its number, or -1 if it is taken (each
// friend is in the spot nearest them). Two can soak in a hot tub together.
export function freeSpot(world, x, y, z, others) {
  const seat = seatOf(world.get(x, y, z));
  if (!seat) return -1;
  const spots = seat.spots ? seat.spots.map((_, k) => seatPose(world, x, y, z, k)) : [seatPose(world, x, y, z)];
  const taken = new Set();
  for (const o of others) {
    let best = -1;
    let near = 0.5;
    spots.forEach((s, k) => {
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d < near && Math.abs(o.y - s.y) < 0.8) [best, near] = [k, d];
    });
    if (best >= 0) taken.add(best);
  }
  for (let k = 0; k < spots.length; k++) if (!taken.has(k)) return k;
  return -1;
}

const open = (world, x, y, z) => !BLOCKS[world.get(x, y, z)]?.solid && !BLOCKS[world.get(x, y + 1, z)]?.solid;

// The tea table of a tea party you are having at the seat in cell (x, y, z):
// the Tea Table beside it, sharing an edge with it, or null. Sitting at it
// with a friend is a tea party (game.js checkTeaParty, the 🫖 sticker).
export function teaTableNear(world, x, y, z) {
  for (const [dx, dz] of DIRS) {
    if (BLOCKS[world.get(x + dx, y, z + dz)]?.model === 'tea-table') return { x: x + dx, y, z: z + dz };
  }
  return null;
}

// Where you stand up from a seat at cell (x, y, z): in front of it if there
// is room, else beside it, else on top of it.
export function standUpAt(world, x, y, z) {
  const front = BLOCKS[world.get(x, y, z)]?.front ?? 3;
  for (const k of [0, 1, 3, 2]) {
    const [dx, dz] = DIRS[(front + k) % 4];
    if (open(world, x + dx, y, z + dz) && BLOCKS[world.get(x + dx, y - 1, z + dz)]?.solid) return { x: x + dx + 0.5, y, z: z + dz + 0.5 };
  }
  return { x: x + 0.5, y: y + 1, z: z + 0.5 };
}

// The hot tubs two or more of `people` ({ x, y, z } each, where they are)
// are soaking in together: { x, y, z, in } for each, `in` the indexes of the
// people in it (game.js shows hearts over it).
export function tubsShared(world, people) {
  const tubs = new Map();
  people.forEach((p, i) => {
    const [x, y, z] = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
    if (BLOCKS[world.get(x, y, z)]?.model !== 'hot-tub') return;
    const key = `${x},${y},${z}`;
    if (!tubs.has(key)) tubs.set(key, { x, y, z, in: [] });
    tubs.get(key).in.push(i);
  });
  return [...tubs.values()].filter((t) => t.in.length > 1);
}
