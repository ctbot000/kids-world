// The foes in the stories of the Storybook (level.js), and the platforms that
// move. None of them chases anyone: each goes about its business the way
// foes in a picture book do, back and forth along its ledge, hopping, flying
// round and round, popping up out of the ground, spitting, dangling on a
// thread or rolling along — and where each one is at any moment is worked
// out from the story's clock alone (foeAt), the same on every page and on the
// island, so nobody's screen is behind anybody else's. Which of them are about
// (not popped) is the island's to say (tale.js).

// Each kind: how big it is (w, h), how fast it goes (tiles a second), whether
// it can be stomped on (landed on, from above) and bopped, and how it moves:
// walk (back and forth along its ledge), hop, fly, pop, shoot, drop or roll.
export const FOES = {
  walker: { w: 0.95, h: 0.9, speed: 1.5, stomp: true, bop: true, move: 'walk' },
  hopper: { w: 0.95, h: 0.85, speed: 2.6, stomp: true, bop: true, move: 'hop', hop: { every: 1.9, secs: 0.62, high: 2.1 } },
  spiky: { w: 0.95, h: 0.85, speed: 1.2, stomp: false, bop: true, move: 'walk' },
  flyer: { w: 1.05, h: 0.75, stomp: true, bop: true, move: 'fly' },
  popper: { w: 1.0, h: 1.05, stomp: true, bop: true, move: 'pop', pop: { up: 2.1, down: 2.0, rise: 0.35 } },
  shooter: { w: 1.0, h: 1.0, stomp: true, bop: true, move: 'shoot', shoot: { every: 2.8, speed: 4.5, r: 0.3, life: 6, wind: 0.45 } },
  dropper: { w: 0.95, h: 0.8, stomp: true, bop: true, move: 'drop', drop: { wait: 1.3, down: 0.45, low: 1.1, up: 1.4 } },
  roller: { w: 1.1, h: 1.1, speed: 3.6, stomp: false, bop: false, move: 'roll' },
};

export const FOE_KINDS = Object.keys(FOES);

export const foeSpec = (kind) => FOES[kind] ?? FOES.walker;

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;

// Back and forth from x0 to x1 at speed v, at time t, starting a share phase of
// the way round: { x, face }.
function patrol(x0, x1, v, t, phase = 0) {
  const span = Math.max(0, x1 - x0);
  if (span < 0.05 || !(v > 0)) return { x: x0, face: phase < 0.5 ? 1 : -1 };
  const u = mod(t * v + phase * 2 * span, 2 * span);
  return u < span ? { x: x0 + u, face: 1 } : { x: x1 - (u - span), face: -1 };
}

// Where foe f is at time t (seconds on the story's clock) and what it is
// doing: { x (its middle), y (its foot), face (1 right, -1 left), up (how far
// out of the ground, for one that pops up: 0 hidden to 1), step (where it is
// in its walk, for its feet), spin (a roller's turn), wind (about to spit,
// 0 to 1) }.
export function foeAt(f, t) {
  const spec = foeSpec(f.kind);
  const phase = f.phase ?? 0;
  const out = { x: f.x, y: f.y, face: f.face ?? 1, up: 1, step: 0, spin: 0, wind: 0 };
  switch (spec.move) {
    case 'walk':
    case 'roll': {
      const p = patrol(f.x0 ?? f.x, f.x1 ?? f.x, (f.speed ?? spec.speed) * (f.fast ?? 1), t, phase);
      out.x = p.x;
      out.face = p.face;
      out.step = t * (f.speed ?? spec.speed) * 2.2;
      out.spin = -p.x / (spec.h / 2);
      break;
    }
    case 'hop': {
      const { every, secs, high } = spec.hop;
      const e = every / (f.fast ?? 1);
      const k = Math.floor(t / e + phase);
      const s = mod(t / e + phase, 1) * e;
      // Only hopping does it get anywhere.
      const along = k * secs + Math.min(s, secs);
      const p = patrol(f.x0 ?? f.x, f.x1 ?? f.x, spec.speed, along, 0);
      out.x = p.x;
      out.face = p.face;
      const u = s < secs ? s / secs : -1;
      out.y = f.y + (u >= 0 ? high * 4 * u * (1 - u) : 0);
      out.step = u >= 0 ? 1 : 0;
      break;
    }
    case 'fly': {
      const period = f.period ?? 4.2;
      const a = TAU * (t / period + phase);
      const ax = f.ax ?? 2.5;
      const ay = f.ay ?? 0.7;
      out.x = f.x + ax * Math.sin(a);
      out.y = f.y + ay * Math.sin(2 * a);
      out.face = ax > 0.05 ? (Math.cos(a) >= 0 ? 1 : -1) : (f.face ?? 1);
      out.step = t * 9;
      break;
    }
    case 'pop': {
      const { up, down, rise } = spec.pop;
      const cycle = up + down + 2 * rise;
      const s = mod(t + phase * cycle, cycle);
      // Down below, then rising, out, and sinking back.
      out.up = s < down ? 0 : s < down + rise ? (s - down) / rise : s < down + rise + up ? 1 : 1 - (s - down - rise - up) / rise;
      break;
    }
    case 'shoot': {
      const { every, wind } = spec.shoot;
      const s = mod(t + phase * every, every);
      out.wind = s > every - wind ? (s - (every - wind)) / wind : 0;
      break;
    }
    case 'drop': {
      const { wait, down, low, up } = spec.drop;
      const cycle = wait + down + low + up;
      const s = mod(t + phase * cycle, cycle);
      const deep = f.deep ?? 4;
      const k = s < wait ? 0 : s < wait + down ? ease((s - wait) / down) : s < wait + down + low ? 1 : 1 - ease((s - wait - down - low) / up);
      out.y = f.y - deep * k;
      break;
    }
    default:
      break;
  }
  return out;
}

const ease = (u) => u * u * (3 - 2 * u);

// The box foe f takes up, posed so (foeAt): { x (middle), y (foot), w, h }; a
// foe down in the ground has none (null), and one coming up out of it only
// as much of one as is out.
export function foeBox(f, pose) {
  const spec = foeSpec(f.kind);
  if (spec.move === 'pop') {
    if (pose.up < 0.35) return null;
    return { x: pose.x, y: pose.y, w: spec.w, h: spec.h * pose.up };
  }
  return { x: pose.x, y: pose.y, w: spec.w, h: spec.h };
}

// Whether a foe so posed can be landed on and popped now (not with spikes on
// its back, nor half down in the ground).
export function stompable(f, pose) {
  const spec = foeSpec(f.kind);
  if (!spec.stomp) return false;
  return spec.move !== 'pop' || pose.up > 0.6;
}

// The ink a spitting foe has spat that is in the air at time t: each { x, y
// (its middle), r }. Each goes straight on along its row until its range
// (f.range, as far as there is room: maker.js) runs out.
export function shotsOf(f, t) {
  const spec = foeSpec(f.kind);
  if (spec.move !== 'shoot') return [];
  const { every, speed, r, life } = spec.shoot;
  const phase = f.phase ?? 0;
  const out = [];
  const reach = Math.min(life * speed, f.range ?? life * speed);
  const k1 = Math.floor((t + phase * every) / every);
  for (let k = k1; k > k1 - Math.ceil(life / every) - 1; k--) {
    const at = k * every - phase * every;
    const age = t - at;
    if (age < 0 || age * speed > reach) continue;
    out.push({ x: f.x + (f.face ?? 1) * (0.55 + age * speed), y: f.y + 0.55, r, n: k });
  }
  return out;
}

// Where a platform that moves is at time t: { x (its left end), y (its top) }.
// m: { x, y, w, dx, dy, period, phase }, swinging smoothly dx across and dy up
// either way of where it is put.
export function moverAt(m, t) {
  const s = Math.sin(TAU * (t / (m.period || 4) + (m.phase ?? 0)));
  return { x: m.x + (m.dx ?? 0) * s, y: m.y + (m.dy ?? 0) * s };
}
