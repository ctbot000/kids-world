// Elevators: stand on an elevator pad and jump to glide up to the next pad
// above in the same column, or go down to the one below. The pads stay where
// they are; the body is carried between them, through whatever is in between
// (a shaft of glass, a floor), so there is nothing to keep in step between
// players: everyone just sees the rider's position change.
import { ELEVATOR } from './blocks.js';

export const LIFT_SPEED = 6;

// The pad the body stands on, if it does.
export function padUnder(world, b) {
  if (!b.onGround || b.flying || b.inWater) return null;
  const x = Math.floor(b.x);
  const z = Math.floor(b.z);
  const y = Math.floor(b.y - 0.05);
  return world.get(x, y, z) === ELEVATOR ? { x, y, z } : null;
}

// The feet height on the next pad up (dir 1) or down (dir -1), or null.
export function nextPad(world, pad, dir) {
  for (let y = pad.y + dir; y >= 0 && y < world.H; y += dir) {
    if (world.get(pad.x, y, pad.z) === ELEVATOR) return y + 1;
  }
  return null;
}

// A body standing on a pad, asked to go up (dir 1) or down (dir -1): the ride
// to take, or null if there is no pad to go to.
export function startLift(world, b, dir) {
  const pad = padUnder(world, b);
  if (!pad) return null;
  const to = nextPad(world, pad, dir);
  return to === null ? null : { x: pad.x + 0.5, z: pad.z + 0.5, to, dir };
}

// Carries the body along its ride for dt seconds, easing it to the middle of
// the pad. Returns true once it has arrived, standing on the pad.
export function stepLift(b, lift, dt) {
  const k = Math.min(1, dt * 10);
  b.x += (lift.x - b.x) * k;
  b.z += (lift.z - b.z) * k;
  b.vx = b.vz = b.vy = 0;
  b.onGround = true;
  b.y += lift.dir * LIFT_SPEED * dt;
  if ((b.y - lift.to) * lift.dir >= 0) {
    b.y = lift.to;
    b.x = lift.x;
    b.z = lift.z;
    return true;
  }
  return false;
}
