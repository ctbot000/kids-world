// Jumping rope (critters.js rope; game.js plays it, render/jump-rope.js draws
// it): the rules by themselves. The rope goes round by the clock, a little
// faster the longer you keep going, and each time it comes to your feet they
// have to be off the ground. A hop goes only on a fresh press of jump, and
// only after a moment's rest on the ground since the last one, so keeping
// time gets you as far as you can keep it up, and holding jump down or
// hammering at it does not.

// slow, fast: how fast it goes round at the start and once up to speed
// (radians a second), and ramp, how many seconds that takes. hop: how fast a
// hop leaves the ground (in the air for 0.37 s, 0.44 blocks high, with
// physics.js's gravity). rest: how long on the ground before you can hop
// again, and early: how long a press waits for that. zone: being in the air
// this long either side of the moment it goes under your feet will do.
// warn: how long before that it is time to say so.
export const ROPE = { slow: 5, fast: 10, ramp: 100, hop: 4.8, rest: 0.18, early: 0.2, zone: 0.035, warn: 0.45 };

const ROUND = Math.PI * 2;

// How fast it is going round, secs after it started.
export const ropeRate = (secs) => ROPE.slow + ((ROPE.fast - ROPE.slow) * Math.min(secs, ROPE.ramp)) / ROPE.ramp;

// How far round it has gone, secs after it started (radians): under your
// heels at 0, up behind you, over your head at half a turn, down in front of
// you and under your feet again at each whole turn.
export function ropeTurn(secs) {
  const up = Math.min(secs, ROPE.ramp);
  const more = ROPE.fast - ROPE.slow;
  return ROPE.slow * secs + (more * up * up) / (2 * ROPE.ramp) + more * (secs - up);
}

// How far round it is, as your moves tell your friends (the top seven bits of
// the byte whose lowest says whether you fly), so that they see it go under
// your feet just as you hop over it, however your frames go.
export const packTurn = (turn) => Math.round(((turn % ROUND) / ROUND) * 127) << 1;
export const unpackTurn = (flags) => ((flags >> 1) / 127) * ROUND;

// A rope just taken in hand. passes: how many times it has gone under your
// feet; jumps: how many of those you were over it; upAt: when your feet were
// last off the ground; wantAt: when jump was last pressed, not yet hopped on.
export const newRope = () => ({ secs: 0, turn: 0, passes: 0, jumps: 0, upAt: -Infinity, wantAt: -Infinity });

// One frame of it. up: whether your feet are off the ground; pressed: whether
// jump went down since the last frame. Says whether to hop now, whether it
// went under your feet just now (passed), with you over it (jumped) or not.
// It caught you if not, but for the very first time round, which shows you
// what is coming.
export function stepRope(r, dt, { up, pressed }) {
  r.secs += dt;
  r.turn = ropeTurn(r.secs);
  if (up) r.upAt = r.secs;
  if (pressed) r.wantAt = r.secs;
  const out = { hop: false, passed: false, jumped: false, caught: false };
  if (!up && r.secs - r.upAt >= ROPE.rest && r.secs - r.wantAt <= ROPE.early) {
    out.hop = true;
    r.wantAt = -Infinity;
    r.upAt = r.secs;
  }
  if (r.turn >= ROUND * (r.passes + 1) + ROPE.zone * ropeRate(r.secs)) {
    r.passes++;
    out.passed = true;
    out.jumped = r.secs - r.upAt <= 2 * ROPE.zone + dt;
    if (out.jumped) r.jumps++;
    else out.caught = r.passes > 1;
  }
  return out;
}

// Whether it is on its way down to your feet, close enough to get ready to hop.
export function ropeDue(r) {
  const left = (ROUND * (r.passes + 1) - r.turn) / ropeRate(r.secs);
  return left >= -ROPE.zone && left < ROPE.warn;
}
