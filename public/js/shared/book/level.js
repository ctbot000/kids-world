// A story of the Storybook (Adventure Isle's seventh episode, isle-story.js),
// as flat as the page it is printed on: there is only left and right, and up
// and down. Its ground is a grid of tiles, a metre on a side, x along the
// story (0 at its left edge) and y up (0 at the foot of the page); and on it
// everything else: where everyone starts, the bookmarks that keep your place,
// the stars to pick up, the foes, the platforms that move, what is drawn about
// for show, and the boss's own page at the end. stories/ has the five, made by
// maker.js.

// What a tile is. Ground and blocks are solid all round; a plank only from
// above (you jump up through it, and land on it, and Down drops you through);
// thorns hurt whoever touches them (they fill the lower half of their tile); a
// spring is solid, and bounces whoever lands on it high in the air; a crate is
// solid until someone bops it to bits.
export const TILE = { AIR: 0, GROUND: 1, BLOCK: 2, PLANK: 3, THORNS: 4, SPRING: 5, CRATE: 6 };

// How high thorns stand in their tile.
export const THORN_H = 0.55;

export class Level {
  // key: its chapter's (isle-story.js); w, h: how many tiles across and up.
  constructor({ key, w, h, gravity = 1 }) {
    this.key = key;
    this.w = w;
    this.h = h;
    // How strongly things fall here (1 as anywhere; less on the moon).
    this.gravity = gravity;
    this.t = new Uint8Array(w * h);
    this.start = { x: 2.5, y: 3 };
    // Bookmarks, from the first page's end: each { id, x, y } (its foot).
    this.marks = [];
    // The stars to pick up: each { i, x, y } (its middle).
    this.stars = [];
    // The foes: each { id, kind, x, y (feet), ... } as foes.js has them.
    this.foes = [];
    // Platforms that move: each { id, kind, x, y (top), w, dx, dy, period, phase }.
    this.movers = [];
    // The crates, by where they are: each { i, x, y, star }.
    this.crates = [];
    // Where a treasure chest may stand (tale.js chests): each { x (its middle),
    // y (its foot) }.
    this.chests = [];
    // What is drawn about for show: each { kind, x, y, s, flip }.
    this.decor = [];
    // The boss's page: { x0, x1, floor, door } and the boss { kind, x, y }.
    this.arena = null;
    this.boss = null;
    // Where each page of the story begins and ends along x: [{ x0, x1 }].
    this.pages = [];
  }

  index(i, j) {
    return j * this.w + i;
  }

  // The tile at column i, row j: off either side of the page is a wall (no
  // walking off it), and over the top and under the foot of it, nothing.
  at(i, j) {
    if (i < 0 || i >= this.w) return TILE.GROUND;
    if (j < 0 || j >= this.h) return TILE.AIR;
    return this.t[j * this.w + i];
  }

  set(i, j, kind) {
    if (i < 0 || i >= this.w || j < 0 || j >= this.h) return;
    this.t[j * this.w + i] = kind;
  }

  // Whether a tile stops you from every side. gone: the crates bopped to bits
  // (by their tile index), which are not there any more.
  solid(i, j, gone = null) {
    const k = this.at(i, j);
    if (k === TILE.CRATE) return !gone?.has(j * this.w + i);
    return k === TILE.GROUND || k === TILE.BLOCK || k === TILE.SPRING;
  }

  // Whether a tile is a plank: stood on from above only.
  plank(i, j) {
    return this.at(i, j) === TILE.PLANK;
  }

  // The highest solid (or plank) top at column i at or under row j (counting
  // down): the height you would stand at, or null with nothing under you.
  ground(i, j = this.h - 1, gone = null) {
    for (let y = Math.min(j, this.h - 1); y >= 0; y--) {
      if (this.solid(i, y, gone) || this.plank(i, y)) return y + 1;
    }
    return null;
  }

  // The page of the story that x is on (0 the first).
  pageAt(x) {
    for (let i = this.pages.length - 1; i >= 0; i--) if (x >= this.pages[i].x0) return i;
    return 0;
  }

  // Whether x is on the boss's page.
  inArena(x, y = null) {
    const a = this.arena;
    return Boolean(a) && x >= a.x0 && x <= a.x1 && (y === null || y > a.floor - 2);
  }
}
