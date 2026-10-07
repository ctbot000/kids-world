// Pets: a friend of your very own (PETS in words.js, in your look), who
// comes along to every island you go to. No island keeps them: every page
// moves each pet on the island itself, after its owner as it sees them, the
// way it moves name tags about. A pet is right beside its owner on every
// screen however their moves come in, and the island has nothing to do.
//
// A walking pet goes the way you went (along a trail of crumbs you leave),
// runs to catch up when it falls behind, hops up steps and swims; when you
// stop it comes to sit beside you, lies down after a while, and sleeps at
// night. On a ride it rides along with you. A parrot flies round you and
// sits on your head when you stand still; a baby dragon flies round you and
// lands beside you. Left far behind, or stuck, a pet pops over to you. And
// it does tricks: whatever you do (a wave, a dance), it does too.
//
// Everything is timed by the steps it is given, never by the clock, so a
// test stepping time along sees what a player would.
import * as B from './blocks.js';
import { bodyOverlapsSolid, makeBody, stepBody, unstick } from './physics.js';
import { Rng } from './rng.js';

// How each kind gets about: the box it fills (radius, height) and how high
// over its feet the top of the water is when it swims (float); how fast it
// walks and runs. A flyer flies at up to fly, and keeps hover over your feet.
export const PET_INFO = {
  puppy: { radius: 0.2, height: 0.55, float: 0.32, walk: 4.6, run: 9.5 },
  kitten: { radius: 0.18, height: 0.5, float: 0.3, walk: 4.6, run: 9.5 },
  bunny: { radius: 0.18, height: 0.5, float: 0.28, walk: 4.6, run: 9.5 },
  hamster: { radius: 0.15, height: 0.3, float: 0.2, walk: 4.6, run: 9.5 },
  piglet: { radius: 0.2, height: 0.5, float: 0.3, walk: 4.6, run: 9.5 },
  duckling: { radius: 0.15, height: 0.4, float: 0.15, walk: 4.6, run: 9.5 },
  parrot: { radius: 0.15, height: 0.4, float: 0.2, walk: 4.6, run: 9.5, flies: true, fly: 18, hover: 1.75, perch: 'head' },
  dragon: { radius: 0.2, height: 0.55, float: 0.3, walk: 4.6, run: 9.5, flies: true, fly: 18, hover: 1.45, perch: 'ground' },
};

// How far behind you it keeps on the move; how close by is close enough
// when you stop (where it then sits, beside you); further off than POP (or
// FLY_POP for a flyer) it pops over to you, and so it does after STUCK
// seconds of getting nowhere.
const FOLLOW = 1.6;
const NEAR = 2.6;
const HEEL = 1.05;
const RUN_AT = 3.6;
const POP = 16;
const FLY_POP = 26;
const STUCK = 2;
// How far apart the crumbs of your trail are, and how many it remembers.
const CRUMB = 0.6;
const TRAIL = 80;
// Resting: how long it sits before lying down, and before falling asleep
// (by day; at night, soon).
const LIE_AFTER = 14;
const SLEEP_AFTER = 45;
const NIGHT_SLEEP = 3;

// What a pet does when its owner does something (an emote), and how long
// each trick takes.
export const TRICKS = { happy: 2.2, eat: 1.8, beg: 2.2, spin: 1.6, jump: 1, roll: 2, nap: 3.5 };
export const EMOTE_TRICKS = { wave: 'beg', dance: 'spin', cheer: 'jump', hearts: 'happy', clap: 'jump', sleepy: 'nap', laugh: 'roll', surprise: 'jump' };

const FL = Math.floor;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const turn = (from, to, rate) => wrap(from + clamp(wrap(to - from), -rate, rate));

// A pet of this kind, at (x, y, z), facing yaw. seed: its own dice (a few
// idle choices), so that one pet's never move another's.
export function makePet(kind, x, y, z, { yaw = 0, seed = 1 } = {}) {
  const info = PET_INFO[kind] ?? PET_INFO.puppy;
  const body = Object.assign(makeBody(x, y, z), { radius: info.radius, height: info.height, float: info.float, wade: info.float / 2 });
  return {
    kind: PET_INFO[kind] ? kind : 'puppy',
    info,
    body,
    x,
    y,
    z,
    yaw,
    // follow, rest (beside you), ride (along with you), and for a flyer fly,
    // perch (on your head) and land (on the ground).
    mode: 'rest',
    state: 'sit',
    // Your trail, for it to follow; how long you have stood still, and it
    // has rested; how long it has got nowhere; where you were last.
    trail: [],
    still: 0,
    rest: 0,
    stuck: 0,
    lost: 0,
    best: Infinity,
    side: 1,
    last: null,
    bumped: false,
    // A trick it is doing, and for how much longer.
    trick: '',
    trickLeft: 0,
    // Which way it looks while it sits (a glance about now and then).
    glance: 0,
    glanceAt: 2,
    orbit: 0,
    time: 0,
    rng: new Rng(seed),
  };
}

// Puts a pet that has just come along beside its owner (see stepPet).
export function placePet(world, pet, owner) {
  const ev = {};
  if (pet.info.flies) popFlyer(world, pet, owner, ev, 'came');
  else popTo(world, pet, owner, ev, 'came');
  pet.last = { x: owner.x, y: owner.y, z: owner.z };
}

// Starts a trick (see TRICKS); a jump goes up off the ground.
export function startTrick(pet, trick) {
  if (!TRICKS[trick]) return;
  pet.trick = trick;
  pet.trickLeft = TRICKS[trick];
  pet.rest = 0;
  const b = pet.body;
  if (trick === 'jump' && pet.mode !== 'ride' && pet.mode !== 'perch' && pet.mode !== 'fly' && (b.onGround || b.inWater)) {
    b.vy = 6.5;
    b.onGround = false;
  }
}

// What it looks like it is doing: its trick, or what it is doing anyway.
export const petPose = (pet) => pet.trick || pet.state;

// One step of dt seconds, after its owner, as this page sees them:
// { x, y, z, yaw, speed, moving, flying, swimming, riding (what they ride,
// or ''), head (the top of their head over their feet), headTaken (a
// flying friend sits there), pose (posing while you choose how you look) }.
// Returns what happened: popped (over to you: why, as far, stuck, lost,
// moved (you went a long way at once) or pose), splashed (into the water),
// boarded (up onto your ride) and alighted (down off it).
export function stepPet(world, pet, owner, dt, { night = false } = {}) {
  const ev = { popped: false, splashed: false, boarded: false, alighted: false };
  pet.time += dt;
  pet.still = owner.moving ? 0 : pet.still + dt;
  if (pet.trickLeft > 0) {
    pet.trickLeft = Math.max(0, pet.trickLeft - dt);
    if (!pet.trickLeft) pet.trick = '';
  }
  // You went a long way at once (back to the start, say): it comes too.
  const jumped = pet.last && Math.hypot(owner.x - pet.last.x, owner.y - pet.last.y, owner.z - pet.last.z) > 8;
  pet.last = { x: owner.x, y: owner.y, z: owner.z };
  if (jumped && pet.mode !== 'ride') {
    if (pet.info.flies) popFlyer(world, pet, owner, ev, 'moved');
    else popTo(world, pet, owner, ev, 'moved');
    return ev;
  }
  if (pet.info.flies) stepFlyer(world, pet, owner, dt, night, ev);
  else stepWalker(world, pet, owner, dt, night, ev);
  return ev;
}

// ------------------------------------------------ walking pets

function stepWalker(world, pet, owner, dt, night, ev) {
  const b = pet.body;
  // On a ride: up behind you, wherever it goes (the page puts it on the
  // animal or in the vehicle), until you get off; then down beside you.
  if (owner.riding) {
    if (pet.mode !== 'ride') {
      pet.mode = 'ride';
      pet.trail = [];
      pet.trick = '';
      pet.trickLeft = 0;
      ev.boarded = true;
    }
    Object.assign(pet, { x: owner.x, y: owner.y, z: owner.z, yaw: owner.yaw, stuck: 0, lost: 0 });
    pet.rest = owner.moving ? 0 : pet.rest + dt;
    pet.state = night && pet.rest > NIGHT_SLEEP ? 'sleep' : 'sit';
    return;
  }
  if (pet.mode === 'ride') {
    pet.mode = 'follow';
    ev.alighted = true;
    const at = spotNear(world, pet, owner);
    Object.assign(b, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 4, vz: 0, onGround: false });
    unstick(world, b);
  }
  // Anything built where it is lifts it out on top.
  if (bodyOverlapsSolid(world, b)) unstick(world, b);
  crumbs(pet, owner);
  const d = Math.hypot(owner.x - b.x, owner.z - b.z);
  const dy = owner.y - b.y;
  // Out of its reach: high up on something you climbed or rode up to (not
  // flying, nor in the water, where it waits below you or swims about).
  const above = !owner.flying && !owner.swimming && Math.abs(dy) > 2.2;
  if (d > POP || pet.stuck > STUCK) {
    popTo(world, pet, owner, ev, d > POP ? 'far' : 'stuck');
    return;
  }
  // Somewhere it cannot get any nearer to you, standing still, for a while:
  // over to you. (Behind you on the move it only keeps up.)
  const away = d + (above ? Math.abs(dy) : 0);
  if (away > NEAR && pet.still > 0.5) {
    if (away < pet.best - 0.3) {
      pet.best = away;
      pet.lost = 0;
    } else {
      pet.lost += dt;
    }
    if (pet.lost > 2.5 && !owner.flying) {
      popTo(world, pet, owner, ev, 'lost');
      return;
    }
  } else {
    pet.best = Infinity;
    pet.lost = 0;
  }
  // Posing with you while you choose how you look: in front, facing out
  // (beside you, where there is no room in front).
  if (!owner.pose) pet.noPose = false;
  const posing = owner.pose && !pet.noPose;
  if (posing) {
    const spot = poseSpot(owner);
    if (Math.hypot(spot.x - b.x, spot.z - b.z) > 3 || Math.abs(spot.y - b.y) > 1.5 || pet.stuck > STUCK / 2) {
      popTo(world, pet, owner, ev, 'pose', spot);
      pet.noPose = Math.hypot(spot.x - b.x, spot.z - b.z) > 0.3;
      return;
    }
  }
  const going = owner.moving ? d > FOLLOW || above : d > NEAR || above;
  const tricking = pet.trickLeft > 0 && d < 5;
  if (!tricking && pet.trickLeft > 0) {
    pet.trick = '';
    pet.trickLeft = 0;
  }
  let target = null;
  let fast = false;
  if (!tricking && going && !(owner.flying && d < NEAR)) {
    pet.mode = 'follow';
    pet.rest = 0;
    target = trailTarget(pet, owner);
    fast = d > RUN_AT || owner.speed > 5.5;
  } else if (!tricking && !owner.moving) {
    // Settling beside you: on whichever side it is already, or in front
    // of you to pose.
    if (pet.mode === 'follow') {
      pet.mode = 'rest';
      pet.settle = 0;
      const sx = Math.cos(owner.yaw);
      const sz = -Math.sin(owner.yaw);
      pet.side = (b.x - owner.x) * sx + (b.z - owner.z) * sz >= 0 ? 1 : -1;
    }
    pet.settle = (pet.settle ?? 0) + dt;
    const spot = posing ? poseSpot(owner) : heelSpot(owner, pet.side);
    // (Posing, it shuffles over as you turn about.)
    if (Math.hypot(spot.x - b.x, spot.z - b.z) > 0.25 && (posing || pet.settle < 2)) target = spot;
  } else if (!tricking) {
    pet.mode = 'follow';
  }
  move(world, pet, owner, target, fast, dt, ev);
  // What it is doing, for the page to show.
  const speed = Math.hypot(b.vx, b.vz);
  if (target || speed > 0.4 || (!b.onGround && !b.inWater)) {
    pet.rest = 0;
    pet.state = b.inWater ? 'swim' : !b.onGround && b.vy > 1 ? 'jump' : speed > 6 ? 'run' : speed > 0.3 ? 'walk' : 'idle';
    if (speed > 0.3) pet.yaw = turn(pet.yaw, Math.atan2(b.vx, b.vz), dt * 10);
  } else {
    rest(pet, owner, dt, night);
  }
  pet.x = b.x;
  pet.y = b.y;
  pet.z = b.z;
}

// Sitting by you, looking up at you (or out with you, posing), and glancing
// about now and then; lying down after a while, and asleep at night.
function rest(pet, owner, dt, night) {
  const b = pet.body;
  pet.rest += dt;
  if (b.inWater) {
    pet.state = 'swim';
  } else if (owner.pose && !pet.noPose) {
    pet.state = 'sit';
  } else {
    pet.state = pet.rest > (night ? NIGHT_SLEEP : SLEEP_AFTER) ? 'sleep' : pet.rest > LIE_AFTER ? 'lie' : pet.rest > 0.25 ? 'sit' : 'idle';
  }
  const posing = owner.pose && !pet.noPose;
  const face = posing ? owner.yaw : Math.atan2(owner.x - b.x, owner.z - b.z);
  pet.glanceAt -= dt;
  if (pet.glanceAt <= 0) {
    pet.glance = pet.glance ? 0 : pet.rng.range(-0.9, 0.9);
    pet.glanceAt = pet.glance ? pet.rng.range(1, 2.2) : pet.rng.range(2.5, 6);
  }
  if (pet.state !== 'sleep' && pet.state !== 'lie') pet.yaw = turn(pet.yaw, face + (posing ? 0 : pet.glance * 0.5), dt * 6);
}

// Your trail: where you went on the ground or in the water, for it to go
// the same way, round corners and through doorways. Up in the air, you
// leave none.
function crumbs(pet, owner) {
  const t = pet.trail;
  if (owner.flying) return;
  const last = t[t.length - 1];
  if (!last || Math.hypot(owner.x - last.x, owner.z - last.z) >= CRUMB) t.push({ x: owner.x, y: owner.y, z: owner.z });
  if (t.length > TRAIL) t.shift();
}

// The next crumb along your trail it has not reached yet (dropping those it
// has, or has gone past), or you, at the end of it.
function trailTarget(pet, owner) {
  const t = pet.trail;
  const b = pet.body;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  while (t.length && (dist(b, t[0]) < 0.5 || (t[1] && dist(b, t[1]) < dist(t[0], t[1])))) t.shift();
  // Crumbs right by you are as far as it goes.
  while (t.length && dist(t[0], owner) < FOLLOW * 0.8) t.shift();
  return t[0] ?? owner;
}

// Beside you, on one side or the other, a little in front.
function heelSpot(owner, side) {
  const fx = Math.sin(owner.yaw);
  const fz = Math.cos(owner.yaw);
  return { x: owner.x + Math.cos(owner.yaw) * side * HEEL + fx * 0.25, y: owner.y, z: owner.z - Math.sin(owner.yaw) * side * HEEL + fz * 0.25 };
}

// In front of you and a little to the side, for a picture together.
export function poseSpot(owner) {
  const fx = Math.sin(owner.yaw);
  const fz = Math.cos(owner.yaw);
  return { x: owner.x + fx * 0.72 + Math.cos(owner.yaw) * 0.42, y: owner.y, z: owner.z + fz * 0.72 - Math.sin(owner.yaw) * 0.42 };
}

// A step towards target (null: none), walking, or running (fast), as fast as
// you go if that is faster still, swimming, hopping up steps and kicking up
// out of the water onto a bank.
function move(world, pet, owner, target, fast, dt, ev) {
  const b = pet.body;
  const info = pet.info;
  let mx = 0;
  let mz = 0;
  if (target) {
    const dx = target.x - b.x;
    const dz = target.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      // Slowing down as it gets there.
      const k = Math.min(1, d / 0.5);
      mx = (dx / d) * k;
      mz = (dz / d) * k;
    }
  }
  const keepUp = Math.min(16, owner.speed * 1.12);
  const moveOpts = { walk: info.walk, run: Math.max(info.run, keepUp), swim: Math.max(3.4, Math.min(10, keepUp)), jump: 8.7 };
  const x0 = b.x;
  const z0 = b.z;
  const wasInWater = b.inWater;
  const events = stepBody(world, b, { mx, mz, run: fast, jump: b.inWater && pet.bumped && Boolean(mx || mz) }, dt, { move: moveOpts });
  pet.bumped = events.bumped;
  if (b.inWater && !wasInWater) ev.splashed = true;
  // Pushing on and getting nowhere: stuck.
  const want = Math.hypot(mx, mz);
  const went = Math.hypot(b.x - x0, b.z - z0);
  if (want > 0.5 && went < moveOpts.walk * dt * 0.2) pet.stuck += dt;
  else pet.stuck = Math.max(0, pet.stuck - dt * 2);
}

// Pops it over to you: to a spot beside you where it fits (spot, if given),
// standing or swimming, with nothing in between that it could not see past.
function popTo(world, pet, owner, ev, why, spot = null) {
  const at = spot ? (fitAt(world, pet, spot.x, spot.z, spot.y) ?? spotNear(world, pet, owner)) : spotNear(world, pet, owner);
  const b = pet.body;
  Object.assign(b, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, onGround: false });
  unstick(world, b);
  Object.assign(pet, { x: b.x, y: b.y, z: b.z, trail: [], stuck: 0, lost: 0, best: Infinity, rest: 0, trick: '', trickLeft: 0 });
  pet.yaw = Math.atan2(owner.x - b.x, owner.z - b.z);
  pet.mode = owner.flying && pet.info.flies ? 'fly' : 'rest';
  pet.settle = 9;
  ev.popped = why;
}

// Where it fits near you: behind you first, then round you, then where you
// are. Under you if you are up in the air.
function spotNear(world, pet, owner) {
  const back = owner.yaw + Math.PI;
  for (const r of [1.1, 1.8]) {
    for (const a of [0, 0.7, -0.7, 1.5, -1.5, 2.3, -2.3, Math.PI]) {
      const x = owner.x + Math.sin(back + a) * r;
      const z = owner.z + Math.cos(back + a) * r;
      const at = fitAt(world, pet, x, z, owner.y, owner.flying ? 40 : 3);
      if (at) return at;
    }
  }
  return fitAt(world, pet, owner.x, owner.z, owner.y, owner.flying ? 40 : 3) ?? { x: owner.x, y: owner.y, z: owner.z };
}

// Where its feet would be at (x, z), on the ground or the water near the
// height y (within depth below it), with room for it; null if nowhere.
function fitAt(world, pet, x, z, y, depth = 3) {
  const { radius, height } = pet.info;
  if (x < radius || z < radius || x > world.W - radius || z > world.D - radius) return null;
  for (let yy = Math.min(world.H, FL(y + 1)); yy >= Math.max(1, FL(y) - depth); yy--) {
    const under = world.get(FL(x), yy - 1, FL(z));
    const here = world.get(FL(x), yy, FL(z));
    const box = { x, y: yy, z, radius, height };
    if (here === B.WATER) {
      // The top of the water, floating there.
      let top = yy;
      while (world.get(FL(x), top + 1, FL(z)) === B.WATER) top++;
      const fy = top + 1 - pet.info.float;
      if (!bodyOverlapsSolid(world, { ...box, y: fy })) return { x, y: fy, z };
      return null;
    }
    if (B.SOLID[under] && !bodyOverlapsSolid(world, box)) return { x, y: yy, z };
  }
  return null;
}

// ------------------------------------------------ flying pets

function stepFlyer(world, pet, owner, dt, night, ev) {
  const info = pet.info;
  const b = pet.body;
  // Landing beside you, or on your head, is for when you stand still on the
  // ground (or sit still on a ride, for a parrot).
  const settle = pet.still > 0.8 && !owner.flying && !owner.swimming;
  const onHead = info.perch === 'head' && !owner.headTaken;
  const d3 = Math.hypot(owner.x - pet.x, owner.y - pet.y, owner.z - pet.z);
  if (pet.trickLeft > 0 && d3 > 6) {
    pet.trick = '';
    pet.trickLeft = 0;
  }
  if (pet.mode === 'land') {
    // On the ground, resting as a walking pet does, until you go (or, for
    // a parrot, until your head is free again).
    const d = Math.hypot(owner.x - b.x, owner.z - b.z);
    const posing = owner.pose && Math.hypot(poseSpot(owner).x - b.x, poseSpot(owner).z - b.z) > 0.4;
    if (!settle || owner.riding || d > NEAR + 0.4 || Math.abs(owner.y - b.y) > 1.5 || posing || onHead) {
      takeOff(pet);
    } else {
      if (bodyOverlapsSolid(world, b)) unstick(world, b);
      stepBody(world, b, { mx: 0, mz: 0 }, dt, { move: { walk: info.walk, run: info.run, swim: 3.4, jump: 8.7 } });
      pet.x = b.x;
      pet.y = b.y;
      pet.z = b.z;
      rest(pet, owner, dt, night);
      return;
    }
  }
  if (pet.mode === 'perch') {
    if (!settle || !onHead) {
      takeOff(pet);
    } else {
      // Sitting on top of your head, facing the way you do.
      Object.assign(pet, { x: owner.x, y: owner.y + owner.head, z: owner.z, yaw: owner.yaw });
      pet.rest += dt;
      pet.state = night && pet.rest > NIGHT_SLEEP ? 'sleep' : 'perch';
      return;
    }
  }
  if (d3 > FLY_POP || pet.stuck > STUCK) {
    popFlyer(world, pet, owner, ev, d3 > FLY_POP ? 'far' : 'stuck');
    return;
  }
  pet.mode = 'fly';
  pet.rest = 0;
  let target;
  let goal = '';
  const head = { x: owner.x, y: owner.y + owner.head, z: owner.z };
  if (settle && onHead && !blocked(world, pet, head.x, head.y, head.z)) {
    target = head;
    goal = 'perch';
  } else if (settle && !owner.riding) {
    const spot = owner.pose ? poseSpot(owner) : heelSpot(owner, pet.side);
    const ground = fitAt(world, pet, spot.x, spot.z, owner.y, 2);
    if (ground) {
      target = ground;
      goal = 'land';
    }
  }
  if (!target) {
    // Round about you, beside and a little behind, bobbing; lower down, or
    // closer in, where a roof or a tree is in the way.
    pet.orbit += dt * (pet.trickLeft ? 0 : 0.9);
    const a = owner.yaw + Math.PI * 0.72 * pet.side + Math.sin(pet.orbit) * 0.5;
    const bob = Math.sin(pet.orbit * 2.3) * 0.12;
    for (const [r, up] of [[1.15 + Math.sin(pet.orbit * 0.7) * 0.15, info.hover + bob], [1.1, 1.1], [0.9, 0.6], [0.6, 0.3]]) {
      const spot = { x: owner.x + Math.sin(a) * r, y: owner.y + up, z: owner.z + Math.cos(a) * r };
      if (!blocked(world, pet, spot.x, spot.y, spot.z)) {
        target = spot;
        break;
      }
    }
    target ??= { x: owner.x, y: owner.y + 0.3, z: owner.z };
  }
  const there = flyTo(world, pet, target, owner, dt);
  if (there && goal === 'perch') {
    pet.mode = 'perch';
    Object.assign(pet, { x: target.x, y: target.y, z: target.z, yaw: owner.yaw, state: 'perch' });
    return;
  }
  if (there && goal === 'land') {
    pet.mode = 'land';
    Object.assign(b, { x: target.x, y: target.y, z: target.z, vx: 0, vy: 0, vz: 0, onGround: true });
    pet.state = 'idle';
    return;
  }
  pet.state = pet.trickLeft ? 'fly' : Math.hypot(pet.vx ?? 0, pet.vz ?? 0) > 0.6 || Math.abs(pet.vy ?? 0) > 0.6 ? 'fly' : 'hover';
}

function takeOff(pet) {
  pet.mode = 'fly';
  pet.rest = 0;
}

// Straight for the target, as fast as it is far behind (and as fast as you
// go), up and over anything in its way. True once there.
function flyTo(world, pet, target, owner, dt) {
  const dx = target.x - pet.x;
  const dy = target.y - pet.y;
  const dz = target.z - pet.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.06) {
    Object.assign(pet, { x: target.x, y: target.y, z: target.z, vx: 0, vy: 0, vz: 0 });
    pet.stuck = 0;
    return true;
  }
  const speed = Math.min(pet.info.fly, 1.5 + d * 3 + owner.speed);
  const step = Math.min(d, speed * dt);
  const nx0 = pet.x + (dx / d) * step;
  const ny0 = pet.y + (dy / d) * step;
  const nz0 = pet.z + (dz / d) * step;
  // Straight there; or up and over what is in the way; or along it, one
  // way or the other; or up or down to it.
  const way = [
    [nx0, ny0, nz0],
    [pet.x, pet.y + step, pet.z],
    [nx0, pet.y, pet.z],
    [pet.x, pet.y, nz0],
    [pet.x, ny0, pet.z],
  ].find(([x, y, z]) => !blocked(world, pet, x, y, z) && y < world.H + 4);
  if (!way) {
    pet.stuck += dt;
    return false;
  }
  const [nx, ny, nz] = way;
  if (way[0] === nx0 && way[2] === nz0) pet.stuck = Math.max(0, pet.stuck - dt * 2);
  else pet.stuck += dt * 0.25;
  pet.vx = (nx - pet.x) / dt;
  pet.vy = (ny - pet.y) / dt;
  pet.vz = (nz - pet.z) / dt;
  pet.x = nx;
  pet.y = ny;
  pet.z = nz;
  if (Math.hypot(dx, dz) > 0.05) pet.yaw = turn(pet.yaw, Math.atan2(dx, dz), dt * 9);
  Object.assign(pet.body, { x: nx, y: ny, z: nz });
  return Math.hypot(target.x - nx, target.y - ny, target.z - nz) < 0.06;
}

// Whether a flyer at (x, y, z) would be in a block (leaves too).
function blocked(world, pet, x, y, z) {
  return Boolean(B.SOLID[world.get(FL(x), FL(y + 0.1), FL(z))] || B.SOLID[world.get(FL(x), FL(y + pet.info.height), FL(z))]);
}

// Over to you, in the air beside you, or lower down where that is in a
// block, or where you are.
function popFlyer(world, pet, owner, ev, why) {
  const a = owner.yaw + Math.PI * 0.72 * pet.side;
  const spots = [[1.1, pet.info.hover], [1.1, 1.1], [0.8, 0.6], [0, 0.3]].map(([r, up]) => [owner.x + Math.sin(a) * r, owner.y + up, owner.z + Math.cos(a) * r]);
  const [x, y, z] = spots.find(([x, y, z]) => !blocked(world, pet, x, y, z)) ?? spots[3];
  Object.assign(pet, { x, y, z, vx: 0, vy: 0, vz: 0, mode: 'fly', stuck: 0, rest: 0, trick: '', trickLeft: 0 });
  Object.assign(pet.body, { x, y, z, vx: 0, vy: 0, vz: 0 });
  pet.yaw = Math.atan2(owner.x - x, owner.z - z);
  ev.popped = why;
}
