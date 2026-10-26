// A racing island's race track, in the middle of the island (worldgen.js
// makes the ground there flat for it, as for a fun park's plaza: the same
// square, park.js PARK_HALF), with
//
// - an oval track of asphalt (blocks.js RACE_TRACK): two straights joined by
//   two round bends, red and white kerbs along both edges, and a checkered
//   finish line across the near straight;
// - go-karts waiting on the starting grid just behind the line, facing the
//   way round (anticlockwise, seen from above);
// - a grandstand of coloured steps along the near straight, a podium and a
//   checkered flag in the grass inside the oval, a pit garage across the
//   far straight, stacks of tyres round the bends, lamp posts and flags.
//
// Driving anything round it times your laps (lapStep, below; game.js shows
// them): cross the line to start the clock, go all the way round, and cross
// it again. And anyone in a go-kart can start a race (RaceSim, below, run by
// the island as it runs hide and seek): everyone in a kart lines up, the
// island's own karts left over join in driven by the computer, and after a
// countdown it is three laps, first over the line wins.
//
// Everything is laid out from the middle (cx, cz): x across, z towards the
// grandstand and where everyone comes in, as `o` offsets.
import * as B from './blocks.js';
import { PARK_HALF } from './park.js';
import { placeTemplate, stampByKey } from './stamps.js';

const [RED, ORANGE, YELLOW, , GREEN, , SKY, BLUE, PURPLE, , PINK, WHITE, GRAY, CHARCOAL] = B.TOY_BRICKS;

// The oval's centre line: two straights 2L long, along x, joined by half
// circles of radius R round (±L, 0); the track reaches W either side of it.
export const OVAL = { L: 9, R: 10, W: 3.5 };
const LAP = 4 * OVAL.L + 2 * Math.PI * OVAL.R;

// The starting grid's boxes, two by two just behind the line, from the
// middle (front first).
export const GRID = [
  [3, OVAL.R - 1.5],
  [5, OVAL.R + 1.5],
  [7, OVAL.R - 1.5],
  [9, OVAL.R + 1.5],
];

// Where (ox, oz), from the middle, is on the oval: how far from its centre
// line (off, plus outside, minus inside) and how far round from the finish
// line (at, 0 to 1), going the way the karts go: west along the near
// straight (+z), round the west bend, east along the far one, round the
// east bend and back.
export function ovalAt(ox, oz) {
  const { L, R } = OVAL;
  let s;
  let d;
  if (Math.abs(ox) <= L) {
    d = Math.abs(oz) - R;
    s = oz > 0 ? (ox <= 0 ? -ox : 3 * L + 2 * Math.PI * R + (L - ox)) : L + Math.PI * R + (ox + L);
  } else if (ox < -L) {
    d = Math.hypot(ox + L, oz) - R;
    let a = Math.atan2(oz, ox + L);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    s = L + R * (a - Math.PI / 2);
  } else {
    d = Math.hypot(ox - L, oz) - R;
    s = 3 * L + Math.PI * R + R * (Math.atan2(oz, ox - L) + Math.PI / 2);
  }
  return { off: d, at: (((s / LAP) % 1) + 1) % 1 };
}

// Whether the cell at (ox, oz) is the track's (its middle on it).
export const onTrack = (ox, oz) => Math.abs(ovalAt(ox, oz).off) <= OVAL.W;

// The island's race track, if it has one: where it is in the world, for
// lapStep.
export function raceTrack(world) {
  if (world?.theme !== 'race') return null;
  return { cx: Math.floor(world.W / 2) + 0.5, cz: Math.floor(world.D / 2) + 0.5, y: world.sea + 5 };
}

// A lap's checkpoints, a quarter of the way round each, to be passed in turn
// so that cutting across the grass or turning back at the line is no lap.
const GATES = 3;
const NEAR = 3;

// One step of someone's lap clock: lap (their own, {} to begin with) is
// updated from where they are now, at now (ms). Returns { start } as they
// cross the line to begin, { lap: ms, best } as they finish one going all
// the way round (and start the next), or nothing.
export function lapStep(lap, track, x, y, z, now) {
  const { off, at } = ovalAt(x - track.cx, z - track.cz);
  // Off the track by more than a little (or up in the air), the clock
  // carries on but nothing is passed.
  if (Math.abs(off) > OVAL.W + NEAR || Math.abs(y - track.y) > 3) return null;
  const was = lap.at;
  lap.at = at;
  if (was === undefined) return null;
  // Over the line forwards…
  if (was > 0.8 && at < 0.2) {
    const done = lap.start !== undefined && lap.gate === GATES;
    const ms = now - lap.start;
    lap.start = now;
    lap.gate = 0;
    if (!done) return { start: true };
    const best = !(lap.best <= ms);
    if (best) lap.best = ms;
    return { lap: ms, best };
  }
  // …or back over it, which starts nothing.
  if (was < 0.2 && at > 0.8) {
    lap.start = undefined;
    lap.gate = 0;
    return null;
  }
  const next = ((lap.gate ?? 0) + 1) / (GATES + 1);
  if (lap.start !== undefined && (lap.gate ?? 0) < GATES && at >= next && at < next + 0.15) lap.gate = (lap.gate ?? 0) + 1;
  return null;
}

// A lap time to show: 23.4 s, or 1:05.2.
export function lapTime(ms) {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

// The race track, built into the world round (cx, cz) with the ground at
// height level. Returns { spawn, rides (the go-karts on the grid), clear
// (what other vehicles keep clear of, as { x, z, r }) }.
export function buildRace(world, { cx, cz, level, pal }) {
  const set = (ox, y, oz, id) => world.set(cx + ox, y, cz + oz, id);
  const get = (ox, y, oz) => world.get(cx + ox, y, cz + oz);
  const place = (cells) => {
    for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z)) world.set(x, y, z, id);
  };
  const H = PARK_HALF;
  // The ground: the track, its kerbs, and grass everywhere else, with
  // nothing on any of it.
  for (let ox = -H; ox <= H; ox++) {
    for (let oz = -H; oz <= H; oz++) {
      for (let y = level + 1; y < world.H; y++) set(ox, y, oz, B.AIR);
      const { off } = ovalAt(ox, oz);
      let id = pal.top;
      if (Math.abs(off) <= OVAL.W) id = B.RACE_TRACK;
      else if (Math.abs(off) <= OVAL.W + 1) id = Math.floor((ox + oz) / 2) & 1 ? RED : WHITE;
      set(ox, level, oz, id);
    }
  }
  // The finish line: checkered, two cells wide, across the near straight.
  for (let oz = 0; oz <= H; oz++) {
    for (const ox of [-1, 0]) if (Math.abs(ovalAt(ox, oz).off) <= OVAL.W) set(ox, level, oz, B.CHECKER_FLOOR);
  }
  // Over it, a gantry: grey posts either side and a checkered beam across.
  const lineIn = OVAL.R - OVAL.W - 2;
  const lineOut = OVAL.R + OVAL.W + 2;
  for (const oz of [Math.floor(lineIn), Math.ceil(lineOut)]) for (let y = level + 1; y <= level + 6; y++) set(0, y, oz, GRAY);
  for (let oz = Math.floor(lineIn); oz <= Math.ceil(lineOut); oz++) set(0, level + 7, oz, oz % 2 ? B.CHECKER_FLOOR : CHARCOAL);
  for (const oz of [Math.floor(lineIn), Math.ceil(lineOut)]) set(0, level + 8, oz, B.LAMP);

  // The go-karts, two by two on the grid just behind the line, facing west
  // (a yaw of -π/2 faces -x).
  const rides = [];
  for (const [ox, oz] of GRID) rides.push({ type: 'kart', x: cx + ox + 0.5, y: level + 1, z: cz + oz + 0.5, yaw: -Math.PI / 2 });
  // The grid's boxes, white lines on the asphalt.
  for (const [ox, oz] of GRID) for (const dz of [-1, 0, 1]) set(ox - 1, level, Math.round(oz) + dz, WHITE);

  // The grandstand along the near straight: five steps of seats in the
  // colours of the rainbow, rising away from the track, with a back wall and
  // flags along the top.
  const STEPS = [RED, ORANGE, YELLOW, GREEN, BLUE];
  const stand0 = Math.ceil(lineOut) + 2;
  for (let ox = -12; ox <= 12; ox++) {
    STEPS.forEach((id, k) => {
      for (let y = level + 1; y <= level + 1 + k; y++) set(ox, y, stand0 + k, y === level + 1 + k ? id : WHITE);
    });
    for (let y = level + 1; y <= level + 7; y++) set(ox, y, stand0 + STEPS.length, WHITE);
  }
  for (let ox = -12; ox <= 12; ox += 4) {
    set(ox, level + 8, stand0 + STEPS.length, GRAY);
    set(ox, level + 9, stand0 + STEPS.length, [RED, YELLOW, SKY, PINK, GREEN, PURPLE, ORANGE][((ox + 12) / 4) % 7]);
  }
  // Stairs up the middle and at the ends, to get to the seats.
  for (const ox of [-13, 13]) for (let k = 0; k < STEPS.length; k++) set(ox, level + 1 + k, stand0 + k, GRAY);

  // The pit garage across the far straight: a long box of bricks open to the
  // track, with a striped roof and the karts' tool racks inside.
  const pit0 = -Math.ceil(lineOut) - 2;
  for (let ox = -12; ox <= 12; ox++) {
    for (let oz = pit0 - 4; oz <= pit0; oz++) {
      set(ox, level, oz, GRAY);
      const wall = ox === -12 || ox === 12 || oz === pit0 - 4;
      for (let y = level + 1; y <= level + 4; y++) if (wall || (oz === pit0 && ox % 6 === 0)) set(ox, y, oz, WHITE);
      set(ox, level + 5, oz, (ox + 12) % 4 < 2 ? RED : WHITE);
    }
  }
  for (let ox = -10; ox <= 10; ox += 5) set(ox, level + 1, pit0 - 3, B.turnedTo(B.COUNTER, 0));

  // In the grass inside the oval: the podium, gold in the middle with silver
  // and bronze either side, and a tall pole with a checkered flag.
  for (const [ox, h, id] of [[0, 3, YELLOW], [-2, 2, GRAY], [2, 1, ORANGE]]) {
    for (let dx = 0; dx < 2; dx++) for (let y = level + 1; y <= level + h; y++) set(ox + dx, y, 0, id);
  }
  for (let y = level + 1; y <= level + 9; y++) set(-7, y, 0, WHITE);
  for (let dx = 1; dx <= 3; dx++) for (let dy = 0; dy < 2; dy++) set(-7 + dx, level + 8 + dy, 0, (dx + dy) % 2 ? CHARCOAL : WHITE);
  // Flowers round the podium.
  for (let ox = -3; ox <= 4; ox++) for (const oz of [-2, 2]) set(ox, level + 1, oz, [B.TULIP, B.SUNFLOWER, B.DAISY][(ox + 3) % 3]);

  // Stacks of tyres just outside each bend, where a kart going too fast
  // might end up.
  for (const side of [-1, 1]) {
    for (let a = -1.2; a <= 1.2; a += 0.3) {
      const ox = Math.round(side * (OVAL.L + Math.cos(a) * (OVAL.R + OVAL.W + 2)));
      const oz = Math.round(Math.sin(a) * (OVAL.R + OVAL.W + 2));
      if (get(ox, level + 1, oz) !== B.AIR || Math.abs(ox) > H || Math.abs(oz) > H || Math.abs(ovalAt(ox, oz).off) < OVAL.W + 2) continue;
      set(ox, level + 1, oz, CHARCOAL);
      set(ox, level + 2, oz, CHARCOAL);
    }
  }
  // Lamp posts in the corners.
  const lamp = stampByKey('lamp-post').cells;
  for (const [ox, oz] of [[-H + 1, -H + 1], [H - 1, -H + 1], [-H + 1, H - 1], [H - 1, H - 1]]) place(placeTemplate(lamp, cx + ox, level + 1, cz + oz, 0));

  // Everyone comes in beside the grid, looking across the track at the
  // karts (a camera yaw of 0 looks towards -z).
  const spawn = { x: cx + 6.5, y: level + 1, z: cz + Math.ceil(lineOut) + 0.5, yaw: 0 };
  // (The whole square, corners and all.)
  const clear = [{ x: cx + 0.5, z: cz + 0.5, r: Math.ceil(H * Math.SQRT2) + 1 }];
  return { spawn, rides, clear };
}

// ---------------------------------------------------------------- races

export const RACE_LAPS = 3;
// How long everyone has to line up after a race is called, the last of it
// counted down (3, 2, 1, GO), with nobody moving.
export const GRID_MS = 10000;
export const COUNT_MS = 3000;
// The longest a race goes on, how long the others have to finish once the
// first player is over the line, and how long the results stay up.
export const RACE_MS = 240000;
export const FINISH_MS = 30000;
export const DONE_MS = 10000;
export const PHASES = ['grid', 'race', 'done'];
// The computer's drivers, quickest last, and how fast each goes flat out
// (blocks a second: a go-kart driven well goes quicker).
export const BOTS = [
  { name: 'Robo Rosie', speed: 7.2, lane: -1.4 },
  { name: 'Turbo Tim', speed: 8, lane: 1.4 },
  { name: 'Zippy Zed', speed: 8.8, lane: 0 },
];
const BOT_ACCEL = 4;
// How far past the line a computer kart rolls to a stop once it is done.
const BOT_RUNOFF = 14;

// The point on the centre line `s` blocks round from the finish line, the way
// round there ({ dx, dz }), and the way out from the middle.
export function pathAt(s) {
  const { L, R } = OVAL;
  let k = ((s % LAP) + LAP) % LAP;
  if (k < L) return { x: -k, z: R, dx: -1, dz: 0, nx: 0, nz: 1 };
  k -= L;
  if (k < Math.PI * R) {
    const a = Math.PI / 2 + k / R;
    return { x: -L + Math.cos(a) * R, z: Math.sin(a) * R, dx: -Math.sin(a), dz: Math.cos(a), nx: Math.cos(a), nz: Math.sin(a) };
  }
  k -= Math.PI * R;
  if (k < 2 * L) return { x: -L + k, z: -R, dx: 1, dz: 0, nx: 0, nz: -1 };
  k -= 2 * L;
  if (k < Math.PI * R) {
    const a = -Math.PI / 2 + k / R;
    return { x: L + Math.cos(a) * R, z: Math.sin(a) * R, dx: -Math.sin(a), dz: Math.cos(a), nx: Math.cos(a), nz: Math.sin(a) };
  }
  return { x: L - (k - Math.PI * R), z: R, dx: -1, dz: 0, nx: 0, nz: 1 };
}

// 1st, 2nd, 3rd, 4th…
export const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

export class RaceSim {
  constructor(track) {
    this.track = track;
    // The race going, or null: { phase, by (who called it), at (when this
    // phase began), until (when it ends), racers }. A racer is a player
    // ({ key: 'p<pid>', pid, lap, clock (lapStep's), done, ms }) or one of
    // the island's karts driven by the computer ({ key: 'b<id>', bot (the
    // kart's id), name, speed, lane, s (how far round), v, lap, done, ms }).
    this.round = null;
  }

  get playing() {
    return Boolean(this.round) && this.round.phase !== 'done';
  }

  // A race called by `pid` (driving a go-kart: room.js checks), with the
  // island's karts nobody is in (`karts`, critters) lined up on the grid to
  // race too, driven by the computer. { ok } or { why: 'busy' }.
  start(pid, karts, now) {
    if (this.playing) return { why: 'busy' };
    const bots = karts.slice(0, BOTS.length).map((c, i) => {
      // From the back of the grid forwards, the quickest at the front.
      const slot = GRID[GRID.length - 1 - i];
      const b = BOTS[BOTS.length - 1 - i];
      const at = { x: this.track.cx + slot[0], z: this.track.cz + slot[1] };
      Object.assign(c, { x: at.x, y: this.track.y, z: at.z, yaw: -Math.PI / 2, racing: true, state: 'race', body: null, home: { x: c.x, y: c.y, z: c.z, yaw: c.yaw } });
      return { key: `b${c.id}`, bot: c.id, kart: c, name: b.name, speed: b.speed, lane: slot[1] - OVAL.R, aim: b.lane, s: -slot[0], v: 0, lap: 0, done: false, ms: 0 };
    });
    this.round = { phase: 'grid', by: pid, at: now, until: now + GRID_MS, racers: bots, entrants: [pid] };
    return { ok: true };
  }

  // Whether nobody may move yet: the countdown before GO.
  frozen(now) {
    const r = this.round;
    return Boolean(r) && r.phase === 'grid' && now >= r.until - COUNT_MS;
  }

  // The race going along, from where everyone is (`where`: Map of pid →
  // { x, y, z }) and who is driving a go-kart (`drivers`: Set of pids).
  // What happened, for everyone to hear: { f: 'go' }, { f: 'lap', key, lap },
  // { f: 'finish', key, place, ms }, { f: 'end', results, why } and
  // { f: 'over' }.
  step(now, dt, where, drivers) {
    const r = this.round;
    if (!r) return [];
    const fx = [];
    const t = this.track;
    // A computer kart a player got into, or gone, is out of it.
    r.racers = r.racers.filter((q) => {
      if (!q.bot || !q.kart.rider) return true;
      Object.assign(q.kart, { racing: false, home: null });
      return false;
    });
    if (r.phase === 'grid') {
      // Lining up: everyone in a kart on the square is in it.
      r.entrants = [...drivers].filter((pid) => {
        const w = where.get(pid);
        return w && Math.max(Math.abs(w.x - t.cx), Math.abs(w.z - t.cz)) <= PARK_HALF + 1;
      });
      if (now < r.until) return fx;
      if (!r.entrants.length) return [this.end(now, 'empty')];
      r.racers = [...r.entrants.map((pid) => ({ key: `p${pid}`, pid, lap: 0, clock: {}, done: false, ms: 0 })), ...r.racers];
      r.phase = 'race';
      r.at = now;
      r.until = now + RACE_MS;
      fx.push({ f: 'go' });
      return fx;
    }
    if (r.phase === 'race') {
      const lap = LAP * RACE_LAPS;
      for (const q of r.racers) {
        if (q.bot) {
          // Round the centre line in its own lane, slowing a little in the
          // bends, and rolling to a stop past the line once it is done.
          const p = pathAt(q.s);
          const bend = Math.abs(p.x) > OVAL.L;
          const top = q.done ? Math.max(0, Math.min(q.speed, (lap + BOT_RUNOFF - q.s) * 0.8)) : q.speed * (bend ? 0.88 : 1);
          q.v = q.v < top ? Math.min(top, q.v + BOT_ACCEL * dt) : top;
          q.s += q.v * dt;
          q.lane += (q.aim - q.lane) * Math.min(1, dt * 0.6);
          const at = pathAt(q.s);
          Object.assign(q.kart, { x: t.cx + at.x + at.nx * q.lane, y: t.y, z: t.cz + at.z + at.nz * q.lane, yaw: Math.atan2(at.dx, at.dz) });
          const laps = q.s < 0 ? 0 : Math.min(RACE_LAPS + 1, Math.floor(q.s / LAP) + 1);
          if (!q.done && laps > q.lap) {
            q.lap = laps;
            if (q.lap > RACE_LAPS) fx.push(this.finish(q, now));
            else if (q.lap > 1) fx.push({ f: 'lap', key: q.key, lap: q.lap });
          }
          continue;
        }
        const w = where.get(q.pid);
        if (!w || q.done) continue;
        const ev = lapStep(q.clock, t, w.x, w.y, w.z, now);
        if (ev?.start && q.lap === 0) q.lap = 1;
        else if (ev?.lap !== undefined && q.lap > 0) {
          q.lap++;
          if (q.lap > RACE_LAPS) fx.push(this.finish(q, now));
          else fx.push({ f: 'lap', key: q.key, lap: q.lap });
        }
      }
      const players = r.racers.filter((q) => q.pid !== undefined);
      const first = r.racers.find((q) => q.pid !== undefined && q.done);
      if (!players.length) fx.push(this.end(now, 'empty'));
      else if (players.every((q) => q.done)) fx.push(this.end(now));
      else if (first && now >= first.doneAt + FINISH_MS) fx.push(this.end(now, 'time'));
      else if (now >= r.until) fx.push(this.end(now, 'time'));
      return fx;
    }
    if (now >= r.until) {
      // Done: the computer's karts back on the grid where they were.
      for (const q of r.racers) if (q.bot) this.park(q.kart);
      this.round = null;
      fx.push({ f: 'over' });
    }
    return fx;
  }

  park(c) {
    if (!c.home) return;
    Object.assign(c, c.home, { racing: false, home: null, body: null, state: 'idle' });
  }

  finish(q, now) {
    const r = this.round;
    q.done = true;
    q.doneAt = now;
    q.ms = now - r.at;
    q.place = r.racers.filter((o) => o.done).length;
    return { f: 'finish', key: q.key, place: q.place, ms: q.ms };
  }

  // Everyone in the order they are going: those over the line first, in the
  // order they finished, then the rest by how far round they have gone.
  standings() {
    const r = this.round;
    if (!r) return [];
    const far = (q) => {
      if (q.bot) return q.s / LAP;
      const at = q.clock?.at ?? 0;
      return q.lap === 0 ? at - 1 : q.lap - 1 + at;
    };
    return [...r.racers].sort((a, b) => (a.done || b.done ? (a.done ? (b.done ? a.place - b.place : -1) : 1) : far(b) - far(a)));
  }

  // The race over (why: '' all the players finished, 'time', 'empty' with
  // nobody racing, 'stopped', 'gone'): everyone's place, and the time of
  // those who finished.
  end(now, why = '') {
    const r = this.round;
    const results = r.phase === 'race' ? this.standings().map((q, i) => ({ key: q.key, ...(q.pid !== undefined ? { pid: q.pid } : { name: q.name }), place: i + 1, ...(q.done ? { ms: q.ms } : {}) })) : [];
    r.phase = 'done';
    r.at = now;
    r.until = now + DONE_MS;
    return { f: 'end', results, ...(why ? { why } : {}) };
  }

  // Someone gone from the island: out of the race.
  left(pid, now) {
    const r = this.round;
    if (!r || r.phase === 'done') return [];
    r.racers = r.racers.filter((q) => q.pid !== pid);
    r.entrants = r.entrants.filter((id) => id !== pid);
    if (r.phase === 'race' && !r.racers.some((q) => q.pid !== undefined)) return [this.end(now, 'gone')];
    return [];
  }

  // The race for every page: { phase, by, left (ms to the end of this phase),
  // laps, racers: [{ key, pid | name, lap, done, place, ms }] in the order
  // they are going }, or null with none.
  pack(now) {
    const r = this.round;
    if (!r) return null;
    const racers = r.phase === 'grid' ? [...r.entrants.map((pid) => ({ key: `p${pid}`, pid })), ...r.racers] : this.standings();
    return {
      phase: r.phase,
      by: r.by,
      left: Math.max(0, Math.round(r.until - now)),
      laps: RACE_LAPS,
      racers: racers.map((q) => ({ key: q.key, ...(q.pid !== undefined ? { pid: q.pid } : { name: q.name }), lap: Math.min(RACE_LAPS, q.lap ?? 0), ...(q.done ? { done: true, place: q.place, ms: q.ms } : {}) })),
    };
  }
}

// A race as an island tells of it (pack above), checked, or null.
export function cleanRace(raw) {
  if (!raw || typeof raw !== 'object' || !PHASES.includes(raw.phase)) return null;
  const n = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const racers = (Array.isArray(raw.racers) ? raw.racers : [])
    .filter((q) => q && typeof q.key === 'string')
    .slice(0, 16)
    .map((q) => ({ key: q.key.slice(0, 12), ...(Number.isInteger(q.pid) ? { pid: q.pid } : { name: String(q.name ?? '').slice(0, 24) }), lap: n(q.lap), done: q.done === true, place: n(q.place), ms: n(q.ms) }));
  return { phase: raw.phase, by: Number.isInteger(raw.by) ? raw.by : 0, left: Math.max(0, n(raw.left)), laps: n(raw.laps, RACE_LAPS), racers };
}
