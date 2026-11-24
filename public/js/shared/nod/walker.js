// Walking, running, jumping and rolling about the bodies of the Land of Nod
// (shape.js), each of which pulls you to it: there is no up but the one under
// your feet. Someone walking is an upright pair of balls — one at the feet,
// one at the head — pushed out of anything solid, the ground of a hill under
// them followed as it rises and falls.
import { add, carry, dot, flat, len, mul, unit } from './shape.js';

export const WALKER = { radius: 0.3, height: 1.5 };
// Speeds and a jump, as physics.js MOVE has them on an island (a jump a
// little floatier, as in a dream).
export const STRIDE = { walk: 4.6, run: 7, jump: 9.2, gravity: 22, accel: 45, air: 16, fall: 28 };
// The ground counts as ground no steeper than this (the cosine of it).
const STEEP = 0.5;
// Walking off a rise, the ground is followed down this far.
const SNAP = 0.5;

export function makeWalker(x, y, z, body = null) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, up: { x: 0, y: 1, z: 0 }, body, onGround: false, air: 0, radius: WALKER.radius, height: WALKER.height };
}

// Puts a walker down at a spot (shape.js spotNear), standing still.
export function standAt(w, spot) {
  Object.assign(w, { x: spot.x, y: spot.y, z: spot.z, vx: 0, vy: 0, vz: 0, up: { ...spot.up }, body: spot.body, onGround: true, air: 0 });
  return w;
}

const n = { x: 0, y: 0, z: 0 };
const c = { x: 0, y: 0, z: 0 };

// Moves one on by dt seconds. input: { dir (the way it wants to go, along the
// ground, up to 1 long), jump, run, hop (a ledge in the way is hopped onto) }.
// stride: speeds of its own in place of STRIDE's; dash: { x, y, z, speed }, a
// roll under way: along that and no other way. Returns what happened: { jumped,
// landed (how fast it came down), bumped }.
export function stepWalker(space, w, input, dt, stride = null, dash = null) {
  const s = stride ? { ...STRIDE, ...stride } : STRIDE;
  const events = { jumped: false, landed: 0, bumped: false };
  let left = Math.min(dt, 0.2);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 90);
    left -= h;
    once(space, w, input, h, s, dash, events);
  }
  return events;
}

function once(space, w, input, h, s, dash, events) {
  const r = w.radius;
  const was = w.body;
  w.body = space.bodyAt(w.x + w.up.x * 0.5, w.y + w.up.y * 0.5, w.z + w.up.z * 0.5, was) ?? was;
  const old = w.up;
  const up = w.body.up(w.x + old.x * 0.1, w.y + old.y * 0.1, w.z + old.z * 0.1);
  let v = { x: w.vx, y: w.vy, z: w.vz };
  // Round the body on foot, the way you go turns with the ground.
  if (w.onGround && was === w.body) v = carry(v, old, up);
  w.up = up;
  let rise = dot(v, up);
  let along = add(v, up, -rise);
  if (dash) {
    const d = flat(dash, up);
    const l = len(d) || 1;
    along = mul(d, dash.speed / l);
    dash.x = d.x / l;
    dash.y = d.y / l;
    dash.z = d.z / l;
  } else {
    const wish = input.dir ? flat(input.dir, up) : { x: 0, y: 0, z: 0 };
    const wl = Math.min(1, len(wish));
    const speed = (input.run ? s.run : s.walk) * wl;
    const to = wl > 1e-3 ? mul(unit(wish), speed) : { x: 0, y: 0, z: 0 };
    const dx = to.x - along.x;
    const dy = to.y - along.y;
    const dz = to.z - along.z;
    const gap = Math.hypot(dx, dy, dz);
    const most = (w.onGround ? s.accel : s.air) * h;
    const k = gap > most ? most / gap : 1;
    along = { x: along.x + dx * k, y: along.y + dy * k, z: along.z + dz * k };
  }
  let jumped = false;
  if (input.jump && w.onGround && !dash) {
    rise = s.jump;
    w.onGround = false;
    jumped = true;
    events.jumped = true;
  } else {
    rise = Math.max(-s.fall, rise - s.gravity * h);
  }
  v = add(along, up, rise);
  w.x += v.x * h;
  w.y += v.y * h;
  w.z += v.z * h;
  const falling = rise;
  let grounded = false;
  let wall = null;
  for (let i = 0; i < 3; i++) {
    let pushed = false;
    for (const at of [r, w.height - r]) {
      c.x = w.x + up.x * at;
      c.y = w.y + up.y * at;
      c.z = w.z + up.z * at;
      const d = space.dist(c.x, c.y, c.z);
      if (d >= r - 1e-3) continue;
      space.normal(c.x, c.y, c.z, n);
      const push = r - d;
      w.x += n.x * push;
      w.y += n.y * push;
      w.z += n.z * push;
      pushed = true;
      const into = dot(v, n);
      if (into < 0) v = add(v, n, -into);
      const level = dot(n, up);
      if (at === r && level > STEEP) grounded = true;
      else if (Math.abs(level) < 0.45) wall = { x: n.x, y: n.y, z: n.z };
    }
    if (!pushed) break;
  }
  if (wall) {
    events.bumped = true;
    // Up onto a ledge in the way, not too high, with room over it.
    const wish = input.dir ?? { x: 0, y: 0, z: 0 };
    const wl = len(wish);
    if (input.hop && !dash && w.onGround && wl > 0.2 && dot(wish, wall) / wl < -0.5) {
      const to = mul(wish, 0.5 / wl);
      const clear = [1.25, 1.9].every((at) => space.dist(w.x + up.x * at + to.x, w.y + up.y * at + to.y, w.z + up.z * at + to.z) > r * 0.9);
      if (clear) {
        v = add(flat(v, up), up, s.jump * 0.92);
        grounded = false;
        jumped = true;
        events.jumped = true;
      }
    }
  }
  if (!grounded && !jumped && w.onGround) {
    const gap = space.dist(w.x + up.x * r, w.y + up.y * r, w.z + up.z * r) - r;
    if (gap < SNAP) {
      w.x -= up.x * gap;
      w.y -= up.y * gap;
      w.z -= up.z * gap;
      grounded = true;
    }
  }
  if (grounded && !jumped) {
    if (!w.onGround && falling < -2) events.landed = Math.max(events.landed, -falling);
    // (Along the ground as it lies, up hill and down.)
    const k = dot(v, up);
    if (k < 0 || w.onGround) v = add(v, up, -k);
    w.onGround = true;
    w.air = 0;
  } else {
    w.onGround = false;
    w.air += h;
  }
  w.vx = v.x;
  w.vy = v.y;
  w.vz = v.z;
}
