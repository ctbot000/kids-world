// How you get about a story of the Storybook (level.js): run left and right,
// jump (higher the longer it is held), land on whatever is solid or on a plank
// from above, drop through a plank with Down, bounce off springs and off the
// heads of foes, and bump your head on what is over you. Everything is in
// tiles (metres) and seconds; the same on every page and in every test, so a
// story made to be played (maker.js) is one that can be.
import { THORN_H, TILE } from './level.js';
import { moverAt } from './foes.js';

// The size of anyone in a story, standing: as wide and as tall as their box.
export const HERO = { w: 0.7, h: 1.7 };

// run: how fast you run; fast: with Run held (or the thumbstick right over);
// accel, decel: how quickly you get going and stop on the ground; airAccel,
// airDecel: in the air; gravity; jump: how fast you leave the ground (3.4 m up
// at the top, held all the way); cut: what is left of that, let go early;
// fall: how fast you can fall at most; coyote: how long after running off an
// edge a jump still goes; buffer: how long before landing a jump pressed
// still goes as you land; spring, springHeld: how fast a spring sends you up
// (with jump held); stomp, stompHeld: and a foe's head.
export const MOVE = {
  run: 6.2,
  fast: 7.8,
  accel: 50,
  decel: 70,
  airAccel: 32,
  airDecel: 10,
  gravity: 40,
  jump: 16.5,
  cut: 0.5,
  fall: 21,
  coyote: 0.1,
  buffer: 0.13,
  spring: 23,
  springHeld: 26,
  stomp: 12,
  stompHeld: 16,
  step: 1 / 120,
};

const EPS = 1e-4;

export function makeHero(x, y) {
  return { x, y, vx: 0, vy: 0, ground: true, on: -1, coyote: 0, buffer: 0, held: false, downHeld: false, cut: true, drop: 0, face: 1, knock: 0, air: 0 };
}

// How high a jump goes and how long it is up, on a page (its gravity, and
// how strongly you jump there).
export function jumpOf(level, stride = MOVE) {
  const g = stride.gravity * (level.gravity ?? 1);
  const v = stride.jump * (level.jump ?? 1);
  return { g, v, high: (v * v) / (2 * g), secs: (2 * v) / g };
}

// Moves h on by dt seconds at time t (the story's clock, for the platforms
// that move) as ctl says: { x (-1 left to 1 right), jump, down (held), fast }.
// gone: the crates bopped to bits. What came of it: { jumped, landed (how fast
// you came down, as you land), sprung, thorns, fell, bumped }.
export function stepHero(level, h, ctl, dt, t = 0, { gone = null, movers = [], stride = MOVE } = {}) {
  const ev = { jumped: false, landed: 0, sprung: false, thorns: false, fell: false, bumped: false };
  const { g, v: jumpV } = jumpOf(level, stride);
  const pressed = Boolean(ctl.jump) && !h.held;
  h.held = Boolean(ctl.jump);
  const downPressed = Boolean(ctl.down) && !h.downHeld;
  h.downHeld = Boolean(ctl.down);
  if (pressed) h.buffer = stride.buffer;
  const was = h.ground;

  // Carried along by what you stand on, if it moves.
  if (h.on >= 0 && movers[h.on]) {
    const m = movers[h.on];
    const a = moverAt(m, t - dt);
    const b = moverAt(m, t);
    h.x += b.x - a.x;
    h.y = b.y;
  }

  // Left and right.
  const x = Math.max(-1, Math.min(1, ctl.x || 0));
  const want = x * (ctl.fast ? stride.fast : stride.run);
  if (h.knock > 0) h.knock = Math.max(0, h.knock - dt);
  else {
    const turning = want && h.vx && Math.sign(want) !== Math.sign(h.vx);
    const a = h.ground ? (want ? stride.accel * (turning ? 1.6 : 1) : stride.decel) : want ? stride.airAccel : stride.airDecel;
    h.vx = approach(h.vx, want, a * dt);
  }
  if (Math.abs(x) > 0.2 && h.knock <= 0) h.face = Math.sign(x);

  // Up: a jump pressed a moment before you land, or a moment after you ran
  // off an edge, still goes.
  h.coyote = h.ground ? stride.coyote : h.coyote - dt;
  h.buffer -= dt;
  if (h.buffer > 0 && h.coyote > 0) {
    h.vy = jumpV;
    h.ground = false;
    h.on = -1;
    h.coyote = 0;
    h.buffer = 0;
    h.cut = false;
    ev.jumped = true;
  }
  if (!h.cut && h.vy > 0 && !ctl.jump) {
    h.vy *= stride.cut;
    h.cut = true;
  }
  if (h.vy <= 0) h.cut = true;

  // Down, standing on a plank: through it.
  if (downPressed && h.ground && onPlankOnly(level, h, gone)) {
    h.drop = 0.28;
    h.ground = false;
    h.on = -1;
    h.y -= 0.03;
  }
  h.drop = Math.max(0, h.drop - dt);

  const n = Math.max(1, Math.ceil(dt / stride.step));
  const s = dt / n;
  h.ground = false;
  const fall = stride.fall * Math.sqrt(level.gravity ?? 1);
  for (let k = 0; k < n; k++) {
    h.vy = Math.max(-fall, h.vy - g * s);
    moveX(level, h, h.vx * s, gone);
    moveY(level, h, h.vy * s, gone, movers, t - dt + s * (k + 1), ev, stride, was);
  }
  if (h.ground) h.air = 0;
  else h.air += dt;
  if (thornsAt(level, h)) ev.thorns = true;
  if (h.y < -2.5) ev.fell = true;
  return ev;
}

function approach(v, to, step) {
  return v < to ? Math.min(to, v + step) : Math.max(to, v - step);
}

// The columns h's box covers, a hair in from its sides.
function columns(h, inset = 0.02) {
  const half = HERO.w / 2 - inset;
  return [Math.floor(h.x - half), Math.floor(h.x + half)];
}

function moveX(level, h, dx, gone) {
  if (!dx) return;
  const half = HERO.w / 2;
  const y0 = h.y + 0.02;
  const y1 = h.y + HERO.h - 0.02;
  const j0 = Math.floor(y0);
  const j1 = Math.floor(y1);
  let x = h.x + dx;
  if (dx > 0) {
    const i = Math.floor(x + half);
    for (let j = j0; j <= j1; j++) {
      if (!level.solid(i, j, gone)) continue;
      x = Math.min(x, i - half - EPS);
      h.vx = 0;
    }
  } else {
    const i = Math.floor(x - half);
    for (let j = j0; j <= j1; j++) {
      if (!level.solid(i, j, gone)) continue;
      x = Math.max(x, i + 1 + half + EPS);
      h.vx = 0;
    }
  }
  h.x = x;
}

function moveY(level, h, dy, gone, movers, t, ev, stride, was) {
  const [i0, i1] = columns(h);
  if (dy <= 0) {
    const from = h.y;
    const to = h.y + dy;
    // Each row whose top is between where you were and where you are going.
    for (let j = Math.floor(from - 1 + EPS); j >= Math.ceil(to - 1 - EPS); j--) {
      const top = j + 1;
      let land = false;
      let spring = false;
      for (let i = i0; i <= i1; i++) {
        if (level.solid(i, j, gone)) {
          land = true;
          if (level.at(i, j) === TILE.SPRING) spring = true;
        } else if (level.plank(i, j) && h.drop <= 0 && from >= top - EPS) land = true;
      }
      if (!land) continue;
      if (spring) {
        h.y = top;
        h.vy = h.held ? stride.springHeld : stride.spring;
        h.cut = true;
        h.on = -1;
        ev.sprung = true;
        return;
      }
      if (!was && !ev.landed) ev.landed = Math.max(0.01, -h.vy);
      h.y = top;
      h.vy = 0;
      h.ground = true;
      h.on = -1;
      return;
    }
    // A platform that moves, from above.
    for (let k = 0; k < movers.length; k++) {
      const m = movers[k];
      const top = moverAt(m, t).y;
      if (h.drop > 0 || from < top - 0.12 || to > top + EPS) continue;
      const mx = moverAt(m, t).x;
      if (h.x + HERO.w / 2 - 0.05 < mx || h.x - HERO.w / 2 + 0.05 > mx + m.w) continue;
      if (!was && !ev.landed) ev.landed = Math.max(0.01, -h.vy);
      h.y = top;
      h.vy = 0;
      h.ground = true;
      h.on = k;
      return;
    }
    h.y = to;
    return;
  }
  // Up: your head against whatever is over it (not a plank: up through that).
  const head = h.y + HERO.h;
  const to = head + dy;
  for (let j = Math.floor(head - EPS) + 1; j <= Math.floor(to - EPS); j++) {
    const hit = [];
    for (let i = i0; i <= i1; i++) if (level.solid(i, j, gone)) hit.push(i);
    if (!hit.length) continue;
    // Only just caught on a corner: slid off it, and on up.
    if (hit.length === 1 && i0 !== i1) {
      const half = HERO.w / 2;
      const i = hit[0];
      const left = i === i0;
      const over = left ? i + 1 - (h.x - half) : h.x + half - i;
      if (over < 0.3) {
        const nx = left ? i + 1 + half + EPS : i - half - EPS;
        const side = left ? Math.floor(nx + half - 0.02) : Math.floor(nx - half + 0.02);
        let clear = true;
        for (let jj = Math.floor(h.y + 0.02); jj <= j; jj++) if (level.solid(side, jj, gone)) clear = false;
        if (clear) {
          h.x = nx;
          h.y += dy;
          return;
        }
      }
    }
    h.y = j - HERO.h - EPS;
    h.vy = 0;
    ev.bumped = true;
    return;
  }
  h.y += dy;
}

// Whether all you stand on is planks (so Down drops you through).
function onPlankOnly(level, h, gone) {
  const [i0, i1] = columns(h);
  const j = Math.round(h.y) - 1;
  if (Math.abs(h.y - (j + 1)) > 0.02) return false;
  let plank = false;
  for (let i = i0; i <= i1; i++) {
    if (level.solid(i, j, gone)) return false;
    if (level.plank(i, j)) plank = true;
  }
  return plank;
}

// Whether h is touching thorns.
export function thornsAt(level, h) {
  const half = HERO.w / 2 - 0.12;
  const i0 = Math.floor(h.x - half);
  const i1 = Math.floor(h.x + half);
  const j0 = Math.floor(h.y + 0.05);
  const j1 = Math.floor(h.y + HERO.h - 0.1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (level.at(i, j) !== TILE.THORNS) continue;
      if (h.y + 0.05 < j + THORN_H && h.x + half > i + 0.1 && h.x - half < i + 0.9) return true;
    }
  }
  return false;
}

// Whether two boxes overlap: each { x (middle), y (foot), w, h }.
export function overlaps(a, b, slack = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - slack && a.y < b.y + b.h - slack && b.y < a.y + a.h - slack;
}
