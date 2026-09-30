// Walking, jumping, swimming and flying through a world of blocks. A body is
// an upright box: (x, z) its centre, y its feet.
import { SOLID, WATER } from './blocks.js';

export const BODY = { radius: 0.3, height: 1.5, eye: 1.3 };

export const MOVE = {
  walk: 4.6,
  run: 7,
  swim: 3,
  fly: 9,
  gravity: 26,
  jump: 8.7, // about 1.45 blocks high
  groundAccel: 45,
  airAccel: 16,
  maxFall: 30,
};

const EPS = 1e-4;

export function makeBody(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false, inWater: false, headInWater: false, flying: false, radius: BODY.radius, height: BODY.height };
}

function overlapsSolid(world, x0, y0, z0, x1, y1, z1) {
  for (let x = Math.floor(x0); x <= Math.floor(x1 - EPS); x++) {
    for (let y = Math.floor(y0); y <= Math.floor(y1 - EPS); y++) {
      for (let z = Math.floor(z0); z <= Math.floor(z1 - EPS); z++) {
        if (SOLID[world.get(x, y, z)]) return true;
      }
    }
  }
  return false;
}

export function bodyOverlapsSolid(world, b) {
  return overlapsSolid(world, b.x - b.radius, b.y, b.z - b.radius, b.x + b.radius, b.y + b.height, b.z + b.radius);
}

// Moves the body along one axis, stopping at the first solid block. Returns
// true if something was in the way.
function sweep(world, b, axis, delta) {
  if (delta === 0) return false;
  const r = b.radius;
  if (axis === 1) {
    const x0 = b.x - r;
    const x1 = b.x + r;
    const z0 = b.z - r;
    const z1 = b.z + r;
    if (delta < 0) {
      const target = b.y + delta;
      for (let y = Math.floor(b.y - EPS); y >= Math.floor(target); y--) {
        if (overlapsSolid(world, x0, y, z0, x1, y + 1, z1)) {
          b.y = y + 1;
          return true;
        }
      }
      b.y = target;
    } else {
      const target = b.y + delta;
      const top = b.y + b.height;
      for (let y = Math.floor(top + EPS); y <= Math.floor(target + b.height); y++) {
        if (overlapsSolid(world, x0, y, z0, x1, y + 1, z1)) {
          b.y = Math.min(target, y - b.height);
          return true;
        }
      }
      b.y = target;
    }
    return false;
  }
  const y0 = b.y;
  const y1 = b.y + b.height;
  if (axis === 0) {
    const z0 = b.z - r;
    const z1 = b.z + r;
    const target = b.x + delta;
    if (delta > 0) {
      for (let x = Math.floor(b.x + r + EPS); x <= Math.floor(target + r); x++) {
        if (overlapsSolid(world, x, y0, z0, x + 1, y1, z1)) {
          b.x = Math.min(target, x - r - EPS);
          return true;
        }
      }
    } else {
      for (let x = Math.floor(b.x - r - EPS); x >= Math.floor(target - r); x--) {
        if (overlapsSolid(world, x, y0, z0, x + 1, y1, z1)) {
          b.x = Math.max(target, x + 1 + r + EPS);
          return true;
        }
      }
    }
    b.x = target;
    return false;
  }
  const x0 = b.x - r;
  const x1 = b.x + r;
  const target = b.z + delta;
  if (delta > 0) {
    for (let z = Math.floor(b.z + r + EPS); z <= Math.floor(target + r); z++) {
      if (overlapsSolid(world, x0, y0, z, x1, y1, z + 1)) {
        b.z = Math.min(target, z - r - EPS);
        return true;
      }
    }
  } else {
    for (let z = Math.floor(b.z - r - EPS); z >= Math.floor(target - r); z--) {
      if (overlapsSolid(world, x0, y0, z, x1, y1, z + 1)) {
        b.z = Math.max(target, z + 1 + r + EPS);
        return true;
      }
    }
  }
  b.z = target;
  return false;
}

// Could the body stand one block higher here — a ledge it can hop onto?
function canStepUp(world, b, dx, dz) {
  const r = b.radius;
  const x = b.x + Math.sign(dx) * 0.35;
  const z = b.z + Math.sign(dz) * 0.35;
  const y = Math.floor(b.y + EPS) + 1;
  const blocked = overlapsSolid(world, x - r, b.y + 0.05, z - r, x + r, b.y + 1, z + r);
  const free = !overlapsSolid(world, x - r, y, z - r, x + r, y + b.height, z + r);
  const headroom = !overlapsSolid(world, b.x - r, b.y + b.height, b.z - r, b.x + r, y + b.height, b.z + r);
  return blocked && free && headroom;
}

// If a block was put where the body stands, lift it to the nearest free spot above.
export function unstick(world, b) {
  if (!bodyOverlapsSolid(world, b)) return false;
  const start = b.y;
  for (let lift = 1; lift < world.H + 4; lift++) {
    b.y = Math.floor(start) + lift;
    if (!bodyOverlapsSolid(world, b)) {
      b.vy = 0;
      return true;
    }
  }
  b.y = start;
  return false;
}

const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

// input: { mx, mz } a wish direction in the world (length up to 1), jump,
// down (sink or descend), run. options: { autoJump }.
export function stepBody(world, b, input, dt, options = {}) {
  const autoJump = options.autoJump !== false;
  let remaining = Math.min(dt, 0.25);
  const events = { jumped: false, landed: 0, splashed: false, bumped: false };
  while (remaining > 1e-6) {
    const h = Math.min(remaining, 1 / 90);
    remaining -= h;
    stepOnce(world, b, input, h, autoJump, events);
  }
  return events;
}

function stepOnce(world, b, input, dt, autoJump, events) {
  const wasInWater = b.inWater;
  b.inWater = world.get(Math.floor(b.x), Math.floor(b.y + 0.5), Math.floor(b.z)) === WATER;
  b.headInWater = world.get(Math.floor(b.x), Math.floor(b.y + b.height - 0.2), Math.floor(b.z)) === WATER;
  if (b.inWater && !wasInWater && b.vy < -4) events.splashed = true;

  let mx = input.mx || 0;
  let mz = input.mz || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const speed = b.flying ? MOVE.fly : b.inWater ? MOVE.swim : input.run ? MOVE.run : MOVE.walk;
  const accel = (b.flying || b.onGround || b.inWater ? MOVE.groundAccel : MOVE.airAccel) * dt;
  b.vx = approach(b.vx, mx * speed, accel);
  b.vz = approach(b.vz, mz * speed, accel);

  if (b.flying) {
    const target = input.jump ? 7 : input.down ? -7 : 0;
    b.vy = approach(b.vy, target, 40 * dt);
  } else if (b.inWater) {
    if (input.jump) {
      // Swim up; at the surface, a kick is enough to climb out onto a ledge.
      b.vy = b.headInWater ? Math.min(4, b.vy + 22 * dt) : Math.max(b.vy, len > 0.1 && canStepUp(world, b, b.vx, b.vz) ? MOVE.jump * 0.85 : 3);
    } else if (input.down) {
      b.vy = approach(b.vy, -4, 20 * dt);
    } else {
      b.vy = approach(b.vy, b.headInWater ? 1.6 : -1.2, 9 * dt); // float up gently
    }
  } else {
    b.vy = Math.max(-MOVE.maxFall, b.vy - MOVE.gravity * dt);
    if (input.jump && b.onGround) {
      b.vy = MOVE.jump;
      b.onGround = false;
      events.jumped = true;
    }
  }

  const fallSpeed = b.vy;
  const hitY = sweep(world, b, 1, b.vy * dt);
  if (hitY) {
    if (b.vy < 0) {
      if (!b.onGround) events.landed = Math.max(events.landed, -fallSpeed);
      b.onGround = true;
    }
    b.vy = 0;
  } else if (b.vy !== 0 || !b.onGround) {
    b.onGround = b.vy <= 0 && overlapsSolid(world, b.x - b.radius, b.y - 0.05, b.z - b.radius, b.x + b.radius, b.y, b.z + b.radius);
  }
  if (b.flying && b.onGround && !input.jump) {
    // Flying down onto the ground lands you.
    b.flying = false;
  }

  const hitX = sweep(world, b, 0, b.vx * dt);
  const hitZ = sweep(world, b, 2, b.vz * dt);
  if (hitX || hitZ) {
    events.bumped = true;
    if (autoJump && !b.flying && b.onGround && len > 0.1 && canStepUp(world, b, hitX ? mx : 0, hitZ ? mz : 0)) {
      b.vy = MOVE.jump;
      b.onGround = false;
      events.jumped = true;
    }
    if (hitX) b.vx = 0;
    if (hitZ) b.vz = 0;
  }

  // The edges of the world are invisible walls; the sky is open for flyers.
  const r = b.radius;
  if (b.x < r) (b.x = r), (b.vx = 0);
  if (b.z < r) (b.z = r), (b.vz = 0);
  if (b.x > world.W - r) (b.x = world.W - r), (b.vx = 0);
  if (b.z > world.D - r) (b.z = world.D - r), (b.vz = 0);
  if (b.y > world.H + 6) (b.y = world.H + 6), (b.vy = Math.min(0, b.vy));
  if (b.y < 1) {
    b.y = 1;
    b.vy = 0;
    b.onGround = true;
  }
}

// Boxes overlap test, for keeping blocks out of people.
export function cellHitsBody(x, y, z, b) {
  return x < b.x + b.radius && x + 1 > b.x - b.radius && z < b.z + b.radius && z + 1 > b.z - b.radius && y < b.y + b.height && y + 1 > b.y;
}
