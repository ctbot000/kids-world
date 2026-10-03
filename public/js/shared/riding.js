// Riding a big animal, from the rider's side. The rider's page moves the
// animal and its rider together, steered the way walking is (physics.js),
// and tells everyone where the rider sits; the host puts the animal under
// them (CritterSim.carry). A dolphin or the whale takes its rider through
// the sea, and never out of it: a dolphin leaps, and the whale spouts.
import { CRITTER_INFO, leapFrom, standHeight, SURFACE, swimmable, waterColumn } from './critters.js';
import { bodyOverlapsSolid, makeBody, stepBody, unstick } from './physics.js';

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
  return { type, r, body, yaw: m.yaw, leap: null, held: false };
}

// One step of the ride: input is { mx, mz } (which way, in the world), jump,
// down and run. Returns what happened: jumped, landed (how hard), splashed,
// leapt, and trick (the whale's spout or the elephant's spray).
export function stepRide(world, ride, input, dt) {
  const ev = ride.r.sea ? swim(world, ride, input, dt) : walk(world, ride, input, dt);
  ride.held = Boolean(input.jump);
  const b = ride.body;
  if (Math.hypot(b.vx, b.vz) > 0.3) ride.yaw = turn(ride.yaw, Math.atan2(b.vx, b.vz), Math.min(1, dt * 8));
  return ev;
}

// On land: as a player walks, but at its own speeds and with its own jump.
// The elephant sprays water instead of jumping (it still climbs steps, and
// out of the water).
function walk(world, ride, input, dt) {
  const r = ride.r;
  const b = ride.body;
  const trick = Boolean(r.trick) && input.jump && !ride.held && !b.inWater;
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
    } else if (input.jump && !ride.held && r.trick === 'spout') {
      ev.trick = true;
    }
  }
  b.inWater = true;
  b.onGround = false;
  return ev;
}

// How the animal is moving under its rider, for its model.
export function rideState(ride) {
  const b = ride.body;
  if (ride.leap) return 'jump';
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
