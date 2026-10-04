// Riding a big animal, from the rider's side. The rider's page moves the
// animal and its rider together, steered the way walking is (physics.js),
// and tells everyone where the rider sits; the host puts the animal under
// them (CritterSim.carry). A dolphin or the whale takes its rider through
// the sea, and never out of it: a dolphin leaps, and the whale spouts.
//
// Vehicles are driven the same way. The car and the boat honk; the digger
// digs out the ground it drives into; a mine cart rolls along rails, round
// their corners and up and down their slopes, and rolls on by itself.
import * as B from './blocks.js';
import { CRITTER_INFO, leapFrom, standHeight, SURFACE, swimmable, waterColumn } from './critters.js';
import { bodyOverlapsSolid, makeBody, stepBody, unstick } from './physics.js';

const FL = Math.floor;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));
const turn = (a, b, k) => {
  const d = b - a - Math.PI * 2 * Math.floor((b - a + Math.PI) / (Math.PI * 2));
  return a + d * k;
};

// Getting on an animal of this kind at m = { x, y, z, yaw } (its feet, or
// its middle in the sea): the ride, or null where there is no room for it
// with a rider on.
export function startRide(world, type, m) {
  const r = CRITTER_INFO[type]?.ride;
  if (!r) return null;
  const body = makeBody(m.x, m.y, m.z);
  if (!r.sea) {
    Object.assign(body, { radius: r.radius, height: r.height, float: r.float });
    if (bodyOverlapsSolid(world, body)) return null;
  }
  return { type, r, body, yaw: m.yaw, leap: null, held: false, rail: null, drillIn: 0 };
}

// One step of the ride: input is { mx, mz } (which way, in the world), jump,
// down and run. Returns what happened: jumped, landed (how hard), splashed,
// leapt, trick (the whale's spout, the elephant's spray or a honk), dig (the
// cells the digger's drill takes out: see drillCells), and rolled (how far a
// mine cart went along its rails) and bumped (into the end of them).
export function stepRide(world, ride, input, dt) {
  const r = ride.r;
  if (r.rails && !ride.rail) ride.rail = ontoRails(world, ride);
  const ev = r.sea ? swim(world, ride, input, dt) : ride.rail ? roll(world, ride, input, dt) : walk(world, ride, input, dt);
  ride.held = Boolean(input.jump);
  const b = ride.body;
  if (!ride.rail && Math.hypot(b.vx, b.vz) > 0.3) ride.yaw = turn(ride.yaw, Math.atan2(b.vx, b.vz), Math.min(1, dt * 8));
  if (r.drill) ev.dig = drill(world, ride, input, dt);
  return ev;
}

// On land: as a player walks, but at its own speeds and with its own jump.
// The elephant sprays water instead of jumping (it still climbs steps, and
// out of the water).
function walk(world, ride, input, dt) {
  const r = ride.r;
  const b = ride.body;
  const trick = Boolean(r.trick) && input.jump && !ride.held && !b.inWater;
  // The digger turns to face the way you push, even pushing at a wall it
  // has not dug through yet.
  if (r.drill && Math.hypot(input.mx || 0, input.mz || 0) > 0.3) ride.yaw = turn(ride.yaw, Math.atan2(input.mx, input.mz), Math.min(1, dt * 6));
  const ev = stepBody(world, b, { mx: input.mx, mz: input.mz, run: input.run, jump: input.jump && (!r.trick || b.inWater) }, dt, { move: r });
  ev.trick = trick;
  return ev;
}

// At sea: along the top of the water (or down under it), only where this
// kind can swim, and up out of it in a leap.
function swim(world, ride, input, dt) {
  const r = ride.r;
  const b = ride.body;
  const ev = { jumped: false, landed: 0, splashed: false, leapt: false, trick: false };
  if (ride.leap) {
    const j = ride.leap;
    j.t += dt;
    const k = Math.min(1, j.t / j.T);
    b.x = j.x + j.fx * j.len * k;
    b.z = j.z + j.fz * j.len * k;
    b.y = j.y + 4 * j.h * k * (1 - k);
    if (k >= 1) {
      ride.leap = null;
      ev.splashed = true;
    }
    return ev;
  }
  const speed = input.run ? r.run : r.swim;
  b.vx = approach(b.vx, (input.mx || 0) * speed, 9 * dt);
  b.vz = approach(b.vz, (input.mz || 0) * speed, 9 * dt);
  // Never into water too shallow or too narrow for it (but out of such
  // water, if it is in some, any water will do).
  const stuck = !swimmable(world, ride.type, b.x, b.z);
  const ok = (x, z) => swimmable(world, ride.type, x, z) || (stuck && Boolean(waterColumn(world, x, z)));
  if (ok(b.x + b.vx * dt, b.z)) b.x += b.vx * dt;
  else b.vx = 0;
  if (ok(b.x, b.z + b.vz * dt)) b.z += b.vz * dt;
  else b.vz = 0;
  const w = waterColumn(world, b.x, b.z);
  if (w) {
    const top = w.top + SURFACE;
    const want = input.down ? Math.max(w.floor + 1.3, top - r.dive) : top - r.float;
    b.y += clamp(want - b.y, -2.2 * dt, 2.2 * dt);
    // A dolphin leaps whenever it can while jump is held, one leap after
    // another; the whale blows water once for each press.
    if (input.jump && !input.down && r.trick === 'leap' && b.y > top - 1.1) {
      ride.leap = leapFrom(world, ride.type, b.x, b.z, ride.yaw);
      ev.leapt = Boolean(ride.leap);
    } else if (input.jump && !ride.held && r.trick && r.trick !== 'leap') {
      ev.trick = true;
    }
  }
  b.inWater = true;
  b.onGround = false;
  return ev;
}

// ------------------------------------------------ rails

// The four ways along the ground: +x, +z, -x, -z.
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const isRail = (world, x, y, z) => world.get(x, y, z) === B.RAIL;

// The rail beside (x, y, z) the way d: level with it, a step up or a step
// down; with room over it for a cart and its rider. Null where there is none.
export function railNext(world, x, y, z, d) {
  const [dx, dz] = DIRS[d];
  for (const dy of [0, 1, -1]) {
    const n = { x: x + dx, y: y + dy, z: z + dz };
    if (isRail(world, n.x, n.y, n.z)) return B.SOLID[world.get(n.x, n.y + 1, n.z)] ? null : n;
  }
  return null;
}

// Where a cart's wheels are over the middle of a rail: on it, or half a
// block up if it is the bottom of a slope (it rises to a rail a step up
// beside it, as render/mesher.js draws it).
function railHeight(world, c) {
  for (const [dx, dz] of DIRS) if (isRail(world, c.x + dx, c.y + 1, c.z + dz)) return c.y + 0.5;
  return c.y;
}

// Onto the rails the cart is on, if it is on any: heading the way along
// them it faces most, at the middle of its rail.
function ontoRails(world, ride) {
  const b = ride.body;
  const at = { x: FL(b.x), y: FL(b.y + 0.05), z: FL(b.z) };
  if (!isRail(world, at.x, at.y, at.z)) return null;
  const fx = Math.sin(ride.yaw);
  const fz = Math.cos(ride.yaw);
  let best = null;
  for (let d = 0; d < 4; d++) {
    const n = railNext(world, at.x, at.y, at.z, d);
    const score = DIRS[d][0] * fx + DIRS[d][1] * fz + (n ? 2 : 0);
    if (!best || score > best.score) best = { d, next: n, score };
  }
  const v = best.next ? Math.max(0, b.vx * DIRS[best.d][0] + b.vz * DIRS[best.d][1]) : 0;
  const rail = { ...at, d: best.d, next: best.next, t: 0, v };
  place(world, ride, rail);
  return rail;
}

// Puts the cart where it is along its rails, facing along them (whichever
// way round it was).
function place(world, ride, rail) {
  const b = ride.body;
  const n = rail.next;
  const t = rail.t;
  const here = railHeight(world, rail);
  if (!n) {
    Object.assign(b, { x: rail.x + 0.5, y: here, z: rail.z + 0.5 });
  } else {
    // Up or down to the edge between the two rails, then on to the middle of the next.
    const edge = Math.max(rail.y, n.y);
    const y = t < 0.5 ? here + (edge - here) * t * 2 : edge + (railHeight(world, n) - edge) * (t - 0.5) * 2;
    Object.assign(b, { x: rail.x + 0.5 + (n.x - rail.x) * t, y, z: rail.z + 0.5 + (n.z - rail.z) * t });
  }
  const [dx, dz] = DIRS[rail.d];
  Object.assign(b, { vx: dx * rail.v, vz: dz * rail.v, vy: 0, onGround: true, inWater: false });
  const along = Math.atan2(dx, dz);
  ride.yaw = turn(ride.yaw, Math.cos(along - ride.yaw) >= 0 ? along : along + Math.PI, 0.35);
}

// The way on from the rail at c, having come along d: straight on, unless
// you push towards another way (at a fork), or there is none (a corner).
function wayOn(world, c, d, input) {
  const len = Math.hypot(input.mx || 0, input.mz || 0);
  let best = null;
  for (let e = 0; e < 4; e++) {
    if (d >= 0 && e === (d + 2) % 4) continue;
    const next = railNext(world, c.x, c.y, c.z, e);
    if (!next) continue;
    const push = len > 0.3 ? (DIRS[e][0] * input.mx + DIRS[e][1] * input.mz) / len : 0;
    const score = (e === d ? 0.5 : 0) + Math.max(0, push - 0.3);
    if (!best || score > best.score) best = { d: e, next, score };
  }
  return best;
}

// Rolling along the rails: pushing (any way but back) speeds it up, pulling
// back slows it down and then takes it back the other way, and by itself it
// rolls on, slowing down a little, faster down a slope and slower up one.
// At the end of the line it stops with a bump.
function roll(world, ride, input, dt) {
  const ev = { jumped: false, landed: 0, splashed: false, leapt: false, trick: false, rolled: 0, bumped: false };
  const rail = ride.rail;
  // The rails taken away from under it: off them.
  if (!isRail(world, rail.x, rail.y, rail.z) && !(rail.next && isRail(world, rail.next.x, rail.next.y, rail.next.z))) {
    ride.rail = null;
    return walk(world, ride, input, dt);
  }
  ev.trick = Boolean(input.jump) && !ride.held;
  const top = input.run ? ride.r.rails.run : ride.r.rails.speed;
  const len = Math.hypot(input.mx || 0, input.mz || 0);
  if (!rail.next) {
    // Standing still at the end of the line, it goes the way you push, if
    // there are rails that way.
    rail.v = 0;
    rail.t = 0;
    const w = len > 0.3 ? wayOn(world, rail, -1, input) : null;
    if (w && w.score > 0) Object.assign(rail, { d: w.d, next: w.next, v: 0.5 });
  } else {
    const [dx, dz] = DIRS[rail.d];
    const along = len > 0.3 ? (dx * input.mx + dz * input.mz) / len : 0;
    if (along < -0.3) rail.v -= 9 * dt;
    else if (len > 0.3) rail.v = Math.min(top, rail.v + 6 * dt);
    else rail.v = Math.max(0, rail.v - 0.8 * dt);
    // Faster down a slope, slower up one.
    rail.v -= (rail.next.y - rail.y) * 7 * dt;
    if (rail.v < 0) {
      // Back the other way: from the next rail towards this one.
      Object.assign(rail, { x: rail.next.x, y: rail.next.y, z: rail.next.z, d: (rail.d + 2) % 4, next: { x: rail.x, y: rail.y, z: rail.z }, t: 1 - rail.t, v: Math.min(top, -rail.v) });
    }
  }
  let go = rail.next ? rail.v * dt : 0;
  while (go > 0 && rail.next) {
    const step = Math.min(go, 1 - rail.t);
    rail.t += step;
    go -= step;
    ev.rolled += step;
    if (rail.t < 1) break;
    // At the next rail: on from it.
    const here = rail.next;
    Object.assign(rail, { x: here.x, y: here.y, z: here.z, t: 0 });
    const w = wayOn(world, here, rail.d, input);
    if (w) {
      rail.d = w.d;
      rail.next = w.next;
    } else {
      rail.next = null;
      ev.bumped = rail.v > 2;
      rail.v = 0;
    }
  }
  place(world, ride, rail);
  return ev;
}

// ------------------------------------------------ the digger

// What the digger's drill takes out in front of it, the way (dx, dz): three
// across and three high (how: 'ahead'), a step higher ('up', leaving a step
// to climb) or a step lower ('down', to drop down onto); or the ground right
// under it ('below'). Only natural ground and gem rocks: never anything
// built, nor the magic floor. Returns the cells, [[x, y, z], ...].
export function drillCells(world, body, dx, dz, how = 'ahead') {
  const fy = FL(body.y + 1e-3);
  const out = [];
  const add = (x, y, z) => {
    if (y >= 1 && world.inBounds(x, y, z) && B.TERRAIN[world.get(x, y, z)]) out.push([x, y, z]);
  };
  if (how === 'below') {
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) add(FL(body.x) + i, fy - 1, FL(body.z) + k);
    return out;
  }
  const reach = body.radius + 0.55;
  const ax = FL(body.x + dx * reach);
  const az = FL(body.z + dz * reach);
  const from = how === 'up' ? fy + 1 : how === 'down' ? fy - 1 : fy;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const row = (a, y) => {
    for (let k = -1; k <= 1; k++) {
      if (alongX) add(a, y, FL(body.z) + k);
      else add(FL(body.x) + k, y, a);
    }
  };
  for (let y = from; y <= from + 2; y++) row(alongX ? ax : az, y);
  // Going up, the roof over its front too, to rise into.
  if (how === 'up') {
    const back = alongX ? ax - Math.sign(dx) : az - Math.sign(dz);
    row(back, fy + 3);
    row(back - (alongX ? Math.sign(dx) : Math.sign(dz)), fy + 3);
  }
  return out;
}

// Pushing into the ground, the drill digs the way: on ahead, up a step with
// jump held, down a step with down held; or, standing still with down held,
// straight down. A few times a second, and only where there is something to dig.
function drill(world, ride, input, dt) {
  ride.drillIn -= dt;
  if (ride.drillIn > 0) return null;
  const b = ride.body;
  const len = Math.hypot(input.mx || 0, input.mz || 0);
  let cells = [];
  if (len > 0.3) {
    const [dx, dz] = [input.mx / len, input.mz / len];
    const how = input.down ? 'down' : input.jump ? 'up' : 'ahead';
    if (how === 'down' || drillCells(world, b, dx, dz).length) cells = drillCells(world, b, dx, dz, how);
  } else if (input.down && b.onGround) {
    cells = drillCells(world, b, 0, 0, 'below');
  }
  if (!cells.length) return null;
  ride.drillIn = 0.22;
  return cells;
}

// How the animal is moving under its rider, for its model.
export function rideState(ride) {
  const b = ride.body;
  if (ride.leap) return 'jump';
  if (ride.rail) return ride.rail.v > ride.r.rails.speed * 1.1 ? 'run' : ride.rail.v > 0.3 ? 'walk' : 'idle';
  if (ride.r.sea || b.inWater) return 'swim';
  if (!b.onGround) return 'jump';
  const v = Math.hypot(b.vx, b.vz);
  return v > ride.r.walk * 1.1 ? 'run' : v > 0.4 ? 'walk' : 'idle';
}

// Where the rider goes on getting off: down beside the animal (on its right,
// its left, behind it or in front of it), wherever a player fits standing,
// or swimming beside it; on top of where it is if there is no room about it.
export function getOffAt(world, ride) {
  const b = ride.body;
  const r = ride.r;
  const fx = Math.sin(ride.yaw);
  const fz = Math.cos(ride.yaw);
  const out = r.radius + 0.5;
  for (const [dx, dz] of [
    [-fz, fx],
    [fz, -fx],
    [-fx, -fz],
    [fx, fz],
  ]) {
    for (const k of [1, 1.5]) {
      const x = b.x + dx * out * k;
      const z = b.z + dz * out * k;
      const w = waterColumn(world, x, z);
      // In the water, at the top of it; on land, on the ground by its feet.
      const y = w && (r.sea || b.inWater) ? Math.max(w.floor + 1, w.top + SURFACE - 1.3) : standHeight(world, x, z, b.y + 0.5);
      if (y === null || x < 0.5 || z < 0.5 || x > world.W - 0.5 || z > world.D - 0.5) continue;
      if (!bodyOverlapsSolid(world, makeBody(x, y, z))) return { x, y, z };
    }
  }
  const p = makeBody(b.x, b.y, b.z);
  unstick(world, p);
  return { x: p.x, y: p.y, z: p.z };
}
