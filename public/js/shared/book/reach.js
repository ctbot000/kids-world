// Where on a story of the Storybook (level.js) you can get to from its start,
// moving just as anyone does (hero.js): every run, jump and fall off a ledge
// tried from every ledge reached, left and right, held for longer and
// shorter, steered on or back in the air. Foes are left out (they can all be
// stomped, bopped, waited for or jumped over); platforms that move stand
// still at a few points of their swing. For the tests, which want every
// bookmark and the boss's page to be got to, and most of the stars.
import { moverAt } from './foes.js';
import { HERO, MOVE, makeHero, stepHero } from './hero.js';

const DT = 1 / 60;
const HOLDS = [0.05, 0.12, 0.2, 0.3, 0.6];
const STEERS = ['on', 'stop', 'back', 'late'];
const STAR_R = 0.45;

// The ledges of a page: each run of columns side by side that you can stand
// on at the same height (with room over it to stand up), { id, y, x0, x1 }
// (x1 the last column), and which is at each (column, height).
export function ledges(level) {
  const out = [];
  const at = new Map();
  const free = (i, j) => !level.solid(i, j) && level.at(i, j) !== 4;
  for (let j = 1; j < level.h; j++) {
    let run = null;
    for (let i = 0; i < level.w; i++) {
      const under = level.solid(i, j - 1) || level.plank(i, j - 1);
      const ok = under && level.at(i, j - 1) !== 5 && free(i, j) && free(i, j + 1);
      if (ok) {
        if (!run) {
          run = { id: out.length, y: j, x0: i, x1: i };
          out.push(run);
        } else run.x1 = i;
        at.set(`${i},${j}`, run.id);
      } else run = null;
    }
  }
  return { list: out, at };
}

// Everything that can be got to from the start: { ledges (the list), seen (a
// Set of their ids), stars (a Set of the stars' i touched on the way), marks
// (the bookmarks' ids stood by), arena (whether the boss's page was) }.
export function reach(level, { stride = MOVE, sample = [0, 0.25, 0.5, 0.75] } = {}) {
  const { list, at } = ledges(level);
  const movers = [];
  for (const m of level.movers) for (const p of sample) movers.push({ ...m, period: 1e12, phase: (m.phase ?? 0) + p });
  // Each platform that moves, at each point of its swing, is a ledge too.
  const moverLedge = movers.map((m, k) => {
    const at = moverAt(m, 0);
    return { id: list.length + k, y: at.y, x0: at.x, x1: at.x + m.w - 1, mover: k };
  });
  const all = [...list, ...moverLedge];
  const seen = new Set();
  const stars = new Set();
  const queue = [];
  const startId = ledgeAt(level.start.x, level.start.y);
  visit(startId);

  // The ledge under someone standing at (x, y): under their middle, or
  // either side of their box.
  function ledgeAt(x, y, on = -1) {
    if (on >= 0) return list.length + on;
    const j = Math.round(y);
    for (const dx of [0, -HERO.w / 2 + 0.03, HERO.w / 2 - 0.03]) {
      const id = at.get(`${Math.floor(x + dx)},${j}`);
      if (id !== undefined) return id;
    }
    return null;
  }
  function visit(id) {
    if (id === null || id === undefined || seen.has(id)) return;
    seen.add(id);
    queue.push(all[id]);
  }

  while (queue.length) {
    const led = queue.shift();
    const xs = launchPoints(led);
    for (const x of xs) {
      for (const dir of [-1, 1]) {
        // Walked off the end.
        tryRun(x, led, dir, null, null);
        for (const hold of HOLDS) for (const steer of STEERS) for (const fast of [false, true]) tryRun(x, led, dir, hold, steer, fast);
      }
      // Straight up.
      for (const hold of HOLDS) tryRun(x, led, 0, hold, 'on');
    }
  }

  function tryRun(x, led, dir, hold, steer, running = false) {
    const h = makeHero(x, led.y);
    if (running) h.vx = dir * stride.run;
    h.on = led.mover ?? -1;
    let t = 0;
    let airborne = false;
    const touched = [];
    for (let n = 0; n < 240; n++) {
      t += DT;
      const d = steer === 'stop' && t > 0.25 ? 0 : steer === 'back' && t > 0.3 ? -dir : steer === 'late' && t < 0.15 ? 0 : dir;
      const ev = stepHero(level, h, { x: d, jump: hold !== null && t <= hold + 1e-9 }, DT, t, { movers, stride });
      if (ev.thorns || ev.fell) return;
      for (const s of level.stars) {
        if (Math.abs(s.x - h.x) < HERO.w / 2 + STAR_R && s.y > h.y - STAR_R && s.y < h.y + HERO.h + STAR_R) touched.push(s.i);
      }
      if (!h.ground) airborne = true;
      if (h.ground && (airborne || hold === null)) {
        // Walked off nothing, still on the same ledge: on along it.
        if (!airborne && Math.abs(h.x - x) < 0.01) return;
        const id = ledgeAt(h.x, h.y, h.on);
        if (id === null) return;
        if (!airborne && id === led.id && n < 200) continue;
        for (const i of touched) stars.add(i);
        visit(id);
        return;
      }
    }
  }

  // Where along a ledge to set off from: its ends, and every few tiles.
  function launchPoints(led) {
    const xs = new Set();
    const lo = led.x0 + HERO.w / 2 + 0.02;
    const hi = led.x1 + 1 - HERO.w / 2 - 0.02;
    xs.add(+lo.toFixed(2));
    xs.add(+hi.toFixed(2));
    for (let x = lo + 2; x < hi - 1; x += 2.5) xs.add(+x.toFixed(2));
    return [...xs];
  }

  // Walking along a ledge touches its stars too.
  for (const id of seen) {
    const led = all[id];
    for (const s of level.stars) if (s.x >= led.x0 && s.x <= led.x1 + 1 && s.y >= led.y && s.y < led.y + HERO.h + STAR_R) stars.add(s.i);
  }
  const marks = level.marks.filter((m) => [...seen].some((id) => all[id].y === m.y && m.x >= all[id].x0 && m.x <= all[id].x1 + 1)).map((m) => m.id);
  const a = level.arena;
  const arena = Boolean(a) && [...seen].some((id) => all[id].y === a.floor && all[id].x1 >= a.x0 + 2);
  return { ledges: all, seen, stars, marks, arena };
}
