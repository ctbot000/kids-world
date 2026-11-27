// What the stories of the Storybook are made with (stories/): a page of tiles
// (level.js) laid out a stretch at a time, left to right — the ground at its
// height, pits, blocks, planks, thorns, springs and crates — and what goes on
// it: stars, foes (each with how far along its ledge it can go, worked out
// here: foes.js), platforms that move, bookmarks at the end of each page of
// the story, things drawn about for show, and at the very end the boss's own
// page. The same every time it is made, from the story's own seed.
import { Rng } from '../rng.js';
import { foeSpec } from './foes.js';
import { Level, TILE } from './level.js';

export class Maker {
  // key: the chapter's; w, h: how big the page is; gravity, jump: how strongly
  // things fall there and you jump (1 as anywhere); seed: for whatever is
  // scattered about.
  constructor({ key, w = 600, h = 22, gravity = 1, jump = 1, seed = 1 }) {
    this.L = new Level({ key, w, h, gravity });
    this.L.jump = jump;
    this.rng = new Rng(seed);
    this.nextFoe = 1;
    // Where the next stretch goes (run, gap, hill).
    this.x = 0;
  }

  // The next n columns of ground, standing at height top; then a pit n wide;
  // then steps up (or down) to height top, w wide each. Each from where the
  // last left off, and on after it.
  // on(x0, top): whatever goes on that stretch, from its first column.
  run(n, top, on = null, kind = TILE.GROUND) {
    const x0 = this.x;
    this.ground(x0, x0 + n, top, kind);
    this.x += n;
    on?.(x0, top);
    return this;
  }

  gap(n, on = null) {
    const x0 = this.x;
    this.pit(x0, x0 + n);
    this.x += n;
    on?.(x0);
    return this;
  }

  get w() {
    return this.L.w;
  }

  // The ground from column x0 up to (not including) x1, solid up to height
  // top (that is where you stand on it): of kind, or the chapter's own.
  ground(x0, x1, top, kind = TILE.GROUND) {
    for (let x = x0; x < x1; x++) {
      for (let y = 0; y < this.L.h; y++) this.L.set(x, y, y < top ? kind : TILE.AIR);
    }
    return this;
  }

  // Nothing at all from x0 up to x1: a pit to fall down.
  pit(x0, x1) {
    for (let x = x0; x < x1; x++) for (let y = 0; y < this.L.h; y++) this.L.set(x, y, TILE.AIR);
    return this;
  }

  // A block of tiles, w by h, its lower left corner at (x, y).
  block(x, y, w, h = 1, kind = TILE.BLOCK) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) this.L.set(i, j, kind);
    return this;
  }

  // A plank along row y from x0 up to x1: stood on at y + 1.
  plank(x0, x1, y) {
    for (let x = x0; x < x1; x++) this.L.set(x, y, TILE.PLANK);
    return this;
  }

  // Thorns along row y from x0 up to x1 (on whatever is under them).
  thorns(x0, x1, y = null) {
    for (let x = x0; x < x1; x++) this.L.set(x, y ?? this.top(x), TILE.THORNS);
    return this;
  }

  // A spring at column x, on whatever is under it (or in row y).
  spring(x, y = null) {
    this.L.set(x, y ?? this.top(x), TILE.SPRING);
    return this;
  }

  // A crate at (x, y) (or on whatever is under it), with a star in it or not.
  crate(x, y = null, star = false) {
    const j = y ?? this.top(x);
    this.L.set(x, j, TILE.CRATE);
    this.L.crates.push({ i: this.L.index(x, j), x, y: j, star });
    return this;
  }

  // Steps from column x, each w wide and one higher (or lower, down) than
  // the one before, n of them, from the height the ground is at there.
  stairs(x, n, { w = 2, down = false, kind = TILE.BLOCK } = {}) {
    let top = this.top(x - (down ? 1 : 0));
    for (let k = 0; k < n; k++) {
      top += down ? -1 : 1;
      for (let i = x + k * w; i < x + (k + 1) * w; i++) for (let j = 0; j < top; j++) if (this.L.at(i, j) === TILE.AIR) this.L.set(i, j, kind);
    }
    return this;
  }

  // Where you stand at column x: the height of the highest top there.
  top(x) {
    return this.L.ground(Math.floor(x)) ?? 0;
  }

  // ------------------------------------------------ what goes on it

  // A star at (x, y), its middle (y: over the ground there, one up).
  star(x, y = null) {
    this.L.stars.push({ i: this.L.stars.length, x, y: y ?? this.top(x) + 0.9 });
    return this;
  }

  // A row of stars from x0 to x1, every gap, at height y (or over the ground).
  stars(x0, x1, y = null, gap = 1.2) {
    for (let x = x0; x <= x1 + 1e-6; x += gap) this.star(+x.toFixed(2), y === null ? null : y);
    return this;
  }

  // Stars in an arc from x0 to x1, high over a line from y0 to y1: the way a
  // jump goes, to show it.
  arc(x0, x1, y0, high = 2.4, n = 5, y1 = y0) {
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0.5 : k / (n - 1);
      this.star(+(x0 + (x1 - x0) * u).toFixed(2), +(y0 + (y1 - y0) * u + high * 4 * u * (1 - u)).toFixed(2));
    }
    return this;
  }

  // A foe of a kind at x (its middle), standing on what is under it (or at
  // y). Back and forth as far as its ledge goes (or range either way, at most).
  // opts as foes.js has them for its kind (fly: ax, ay, period; drop: deep;
  // shoot: face) and skin, how it is drawn (stories' own); phase: where in
  // its round it starts.
  // (How far it can go is worked out once the whole page is made: done.)
  foe(kind, x, { y = null, range = 7, phase = null, ...opts } = {}) {
    const f = { id: this.nextFoe++, kind, x, y: y ?? this.top(x), phase: phase ?? +this.rng.range(0, 1).toFixed(3), ...opts };
    this.L.foes.push(f);
    this.ranges ??= new Map();
    this.ranges.set(f.id, range);
    return this;
  }

  // Every foe's ledge (or how far it spits), on the page as it is now.
  settle() {
    for (const f of this.L.foes) {
      const spec = foeSpec(f.kind);
      if (spec.move === 'walk' || spec.move === 'roll' || spec.move === 'hop') {
        const [x0, x1] = this.ledge(f.x, f.y, spec, this.ranges?.get(f.id) ?? 7);
        Object.assign(f, { x0, x1 });
      }
      if (spec.move === 'shoot') f.range = this.room(f.x, f.y + 0.55, f.face ?? 1);
    }
  }

  // How far a foe standing at (x, y) can go either way along its ledge, at
  // most range: where its middle can be, [x0, x1].
  ledge(x, y, spec, range) {
    const half = spec.w / 2;
    const rows = Math.max(1, Math.ceil(spec.h));
    const fits = (i) => {
      if (this.L.solid(i, Math.floor(y) - 1) === false && !this.L.plank(i, Math.floor(y) - 1)) return false;
      for (let j = Math.floor(y); j < Math.floor(y) + rows; j++) if (this.L.solid(i, j) || this.L.at(i, j) === TILE.THORNS) return false;
      return true;
    };
    let a = Math.floor(x);
    let b = Math.floor(x);
    while (a - 1 >= Math.floor(x - range) && fits(a - 1)) a--;
    while (b + 1 <= Math.floor(x + range) && fits(b + 1)) b++;
    return [+(a + half + 0.05).toFixed(2), +(b + 1 - half - 0.05).toFixed(2)];
  }

  // How far there is to go from (x, y) along its row before something solid.
  room(x, y, dir) {
    for (let d = 1; d < 40; d++) if (this.L.solid(Math.floor(x + dir * d), Math.floor(y))) return d - 0.6;
    return 40;
  }

  // A platform that moves: w tiles wide, its top at y and its left end at x,
  // swinging dx across and dy up either way of there, once round each period
  // seconds. kind: how it is drawn.
  mover(x, y, w, { dx = 0, dy = 0, period = 4, phase = 0, kind = 'raft' } = {}) {
    this.L.movers.push({ id: this.L.movers.length, kind, x, y, w, dx, dy, period, phase });
    return this;
  }

  // A bookmark at column x, on the ground there: the end of a page of the story.
  mark(x) {
    this.L.marks.push({ id: this.L.marks.length + 1, x: x + 0.5, y: this.top(x) });
    return this;
  }

  // Something drawn there for show: kind (the chapter's: render/book), at x on
  // the ground (or at y); s: how big; back: behind everything, not in front.
  decor(kind, x, { y = null, s = 1, flip = false, back = false } = {}) {
    this.L.decor.push({ kind, x, y: y ?? this.top(x), s, flip, back });
    return this;
  }

  // Things of the kinds given scattered along the ground from x0 to x1, about
  // one every gap tiles, wherever there is ground to stand them on.
  scatter(kinds, x0, x1, { gap = 4, back = false, s = [0.8, 1.2] } = {}) {
    for (let x = x0 + this.rng.range(0, gap); x < x1; x += gap * this.rng.range(0.6, 1.4)) {
      const i = Math.floor(x);
      const top = this.L.ground(i);
      if (top === null || this.L.at(i, top) !== TILE.AIR || this.L.at(i, top - 1) === TILE.PLANK) continue;
      const kind = kinds[Math.floor(this.rng.next() * kinds.length)];
      this.decor(kind, +x.toFixed(2), { y: top, s: +this.rng.range(s[0], s[1]).toFixed(2), flip: this.rng.next() < 0.5, back });
    }
    return this;
  }

  // The boss's page: the next n columns, on flat ground (of the kind ground)
  // at height floor, a wall at the far end (the end of the story); the boss of
  // kind a little way in from its middle. on(x0, floor): whatever else goes
  // on it.
  arena(n, floor, kind, on = null, ground = TILE.GROUND) {
    const x0 = this.x;
    this.run(n, floor, null, ground);
    const x1 = x0 + n - 1;
    for (let y = 0; y < this.L.h; y++) this.L.set(x1, y, TILE.BLOCK);
    this.L.arena = { x0, x1, floor, door: x0 };
    this.L.boss = { kind, x: x0 + n * 0.62, y: floor };
    on?.(x0, floor);
    return this;
  }

  // Done: the page as made, as wide as its boss's page goes, everyone
  // starting at column start; its pages of the story worked out from its
  // bookmarks (from the start to the first, and so on to the boss's).
  done(start) {
    const L = this.L;
    const w = L.arena ? L.arena.x1 + 1 : this.x;
    if (w < L.w) {
      const t = new Uint8Array(w * L.h);
      for (let j = 0; j < L.h; j++) t.set(L.t.subarray(j * L.w, j * L.w + w), j * w);
      L.t = t;
      L.w = w;
      for (const c of L.crates) c.i = L.index(c.x, c.y);
    }
    L.start = { x: start + 0.5, y: this.top(start) };
    this.settle();
    let from = 0;
    for (const m of L.marks) {
      L.pages.push({ x0: from, x1: m.x });
      from = m.x;
    }
    L.pages.push({ x0: from, x1: L.w });
    return L;
  }
}
