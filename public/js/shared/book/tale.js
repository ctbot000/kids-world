// A story of the Storybook as it is played, on the island (room.js): a
// chapter of Adventure Isle's seventh episode (isle-story.js), in place of
// camps or battles. Its bookmarks, each lit for good once anybody gets to it
// (the end of a page of the story); its foes, popped by whoever lands on them
// or bops them and back a while after (if nobody is near); its crates, broken
// for good; the stars each person has picked up (each picks up their own); and
// at the end of it all its boss, who comes out once someone is on its page and
// goes back to the start of the fight if everyone leaves. Everyone in it is in
// it together. And its treasure chests, as on every island of the isle: a few
// out at a time at spots of its own, one of them golden (the same as a dream's
// of the Land of Nod: nod/chests.js).
//
// Where everything is, is the story's clock's to say (foes.js foeAt, bosses.js
// bossAt): ms since it began, the island's; every page keeps in step with it.
// Pages say what they stomped, bopped, broke or picked up, and when; the
// island checks it was there to be, and tells everyone.
import { Rng } from '../rng.js';
import { DreamChests } from '../nod/chests.js';
import { bossAt, bossSpec, hitBoss, newBoss, packBoss, stepBoss } from './bosses.js';
import { FOES, foeAt, foeBox } from './foes.js';
import { HERO } from './hero.js';
import { bookLevel } from './stories/index.js';

// A popped foe is back this long after (once nobody is near where it lives).
export const BACK_MS = 35000;
const BACK_NEAR = 15;
// Somebody on the boss's page this long brings it out; nobody there this
// long, and its fight is as it was before it began.
const BOSS_MS = 1600;
const QUIET_MS = 9000;
// The boss's last heart off, its stage is won this long after (it goes pop).
const BEATEN_MS = 2600;
const UP = { x: 0, y: 1, z: 0 };
const FRONT = { x: 0, y: 0, z: 1 };
// How far from where the island last had them a page may say someone stomped,
// bopped or picked up something (it is a moment behind), and how far back in
// time, or ahead.
const REACH = 3.6;
const LATE_MS = 1600;
const EARLY_MS = 400;

export class Tale {
  // key: which story (stories/); story: its chapter; level: how hard (the
  // later the chapter, the quicker its foes); done: the bookmarks lit before
  // (over a restart), by their ids, and the boss's (marks + 1) for a stage
  // won; now: the island's clock.
  constructor({ key, story, level = 16, done = [], now = null }, seed = 1) {
    this.key = key;
    this.story = story;
    this.difficulty = level;
    this.level = bookLevel(key);
    this.rng = new Rng(seed);
    this.epoch = now;
    this.clock = 0;
    this.lit = new Set();
    this.gone = new Map();
    this.broken = new Set();
    this.stars = new Map();
    this.boss = null;
    this.bossState = 'idle';
    this.bossSince = 0;
    this.bossQuiet = 0;
    this.bossBy = new Set();
    this.beatenAt = 0;
    this.won = false;
    // Where each person was last, as the island has it, and the people on the
    // boss's page.
    this.where = new Map();
    // (Upright, every one of them: the page is flat.)
    this.chests = new DreamChests(this.level.chests.map((c) => ({ x: c.x, y: c.y, z: 0, up: UP, dir: FRONT })), (seed ^ 0x3c6ef372) >>> 0);
    this.restore(done);
  }

  // The bookmarks' ids, and the boss's after them.
  get bossId() {
    return this.level.marks.length + 1;
  }

  // Everything to do here, in the story's order: each bookmark (a page of the
  // story) and the boss.
  get all() {
    return [...this.level.marks.map((m) => ({ id: m.id, done: this.lit.has(m.id) })), { id: this.bossId, boss: true, done: this.won }];
  }

  get bossReady() {
    return this.level.marks.every((m) => this.lit.has(m.id));
  }

  restore(ids) {
    for (const id of ids) {
      if (id === this.bossId) this.won = true;
      else if (this.level.marks.some((m) => m.id === id)) this.lit.add(id);
    }
    if (this.won) {
      for (const m of this.level.marks) this.lit.add(m.id);
      this.bossState = 'done';
    }
  }

  doneIds() {
    return [...[...this.lit].sort((a, b) => a - b), ...(this.won ? [this.bossId] : [])];
  }

  // How quickly foes go here: a little quicker the later the chapter (the
  // first, Hopscotch Meadow, as their kinds have it).
  get fast() {
    return 1 + Math.max(0, this.difficulty - 16) * 0.05;
  }

  // Where someone out of HP (or fallen off the page) comes back: by the last
  // bookmark anyone has got to, or the start.
  homeFor() {
    let best = null;
    for (const m of this.level.marks) if (this.lit.has(m.id) && (!best || m.x > best.x)) best = m;
    const at = best ? { x: best.x + 1.2, y: best.y } : this.level.start;
    return { x: at.x, y: at.y + 0.01, z: 0 };
  }

  // A foe by its id, if it is about (not popped).
  foe(id) {
    const f = this.level.foes.find((o) => o.id === id);
    return f && !this.gone.has(id) ? f : null;
  }

  // ------------------------------------------------ as it goes

  // Moves it on to now (the island's clock). people: { id, x, y, dizzy }.
  // What happened: { fx (for everyone to see), lit [{ id, by }], won }.
  step(now, people) {
    // (Its clock starts as the island first moves it on.)
    this.epoch ??= now;
    const clock = (this.clock = now - this.epoch);
    const out = { fx: [], lit: [], won: false };
    for (const p of people) this.where.set(p.id, p);
    const up = people.filter((p) => !p.dizzy);
    // A bookmark got to.
    for (const m of this.level.marks) {
      if (this.lit.has(m.id)) continue;
      const by = up.find((p) => p.x >= m.x - 0.3 && p.y > m.y - 4);
      if (!by) continue;
      // (And every one before it, which they must have gone past.)
      for (const k of this.level.marks) {
        if (k.id > m.id || this.lit.has(k.id)) continue;
        this.lit.add(k.id);
        out.lit.push({ id: k.id, by: by.id });
      }
    }
    // Foes back.
    for (const [id, at] of this.gone) {
      if (clock < at) continue;
      const f = this.level.foes.find((o) => o.id === id);
      if (people.some((p) => Math.abs(p.x - f.x) < BACK_NEAR)) continue;
      this.gone.delete(id);
      out.fx.push({ k: 'back', f: id });
    }
    this.stepBoss(now, clock, up, out);
    if (this.chests.step(now)) out.fx.push({ k: 'chests', c: this.chests.pack() });
    return out;
  }

  stepBoss(now, clock, people, out) {
    if (this.won || !this.level.arena) return;
    const A = this.level.arena;
    const here = people.filter((p) => this.level.inArena(p.x, p.y));
    if (this.bossState === 'idle') {
      if (!this.bossReady || !here.length) {
        this.bossSince = 0;
        return;
      }
      if (!this.bossSince) {
        this.bossSince = now;
        out.fx.push({ k: 'bosscomes' });
      }
      if (now - this.bossSince < BOSS_MS) return;
      // (A heart more for every two more people on its page.)
      this.boss = newBoss(this.level.boss.kind, A, bossSpec(this.level.boss.kind).hearts + Math.floor((here.length - 1) / 2));
      this.boss.at = clock;
      this.bossState = 'on';
      this.bossQuiet = 0;
      this.bossBy = new Set(here.map((p) => p.id));
      out.fx.push({ k: 'boss', b: packBoss(this.boss) });
      return;
    }
    if (this.bossState !== 'on') return;
    const b = this.boss;
    if (b.phase === 'beaten') {
      if (clock - b.at >= BEATEN_MS) {
        this.won = true;
        this.bossState = 'done';
        out.won = true;
      }
      return;
    }
    for (const p of here) this.bossBy.add(p.id);
    if (!here.length) {
      this.bossQuiet ||= now;
      if (now - this.bossQuiet > QUIET_MS) {
        this.boss = null;
        this.bossState = 'idle';
        this.bossSince = 0;
        this.bossQuiet = 0;
        out.fx.push({ k: 'bossquiet' });
      }
      return;
    }
    this.bossQuiet = 0;
    if (stepBoss(b, clock, A, here, this.rng)) out.fx.push({ k: 'boss', b: packBoss(b) });
  }

  // ------------------------------------------------ what pages say

  // When a page says something happened, on the story's clock: as it says, if
  // that is not too long ago or ahead.
  when(t) {
    return Number.isFinite(t) ? Math.max(this.clock - LATE_MS, Math.min(this.clock + EARLY_MS, t)) : this.clock;
  }

  // Someone (p: { id, x, y }, where the island has them) landing on a foe, or
  // bopping it (bop), at time t: whether it was there to be, and so is popped.
  pop(p, id, t, bop = false) {
    const f = this.foe(id);
    if (!f) return null;
    const spec = FOES[f.kind];
    if (bop ? !spec.bop : !spec.stomp) return null;
    const at = this.when(t);
    const box = foeBox({ ...f, fast: this.fast }, foeAt({ ...f, fast: this.fast }, at / 1000));
    if (!box) return null;
    if (Math.abs(box.x - p.x) > REACH + box.w / 2 || Math.abs(box.y + box.h / 2 - (p.y + HERO.h / 2)) > REACH + 1) return null;
    this.gone.set(id, this.clock + BACK_MS);
    return f;
  }

  // A crate bopped to bits by p: whether it was there to be (and what it held).
  crate(p, i) {
    const c = this.level.crates.find((o) => o.i === i);
    if (!c || this.broken.has(i)) return null;
    if (Math.abs(c.x + 0.5 - p.x) > REACH || Math.abs(c.y + 0.5 - (p.y + HERO.h / 2)) > REACH) return null;
    this.broken.add(i);
    return c;
  }

  // A star picked up by p: whether it was theirs to pick up (each person picks
  // up every star once).
  star(p, i) {
    const s = this.level.stars[i];
    if (!s || Math.abs(s.x - p.x) > REACH || Math.abs(s.y - (p.y + HERO.h / 2)) > REACH + 1) return false;
    let mine = this.stars.get(p.id);
    if (!mine) this.stars.set(p.id, (mine = new Set()));
    if (mine.has(i)) return false;
    mine.add(i);
    return true;
  }

  // A crate's star (one bopped open, i: the crate's) picked up by p.
  crateStar(p, i) {
    const c = this.level.crates.find((o) => o.i === i);
    if (!c?.star || !this.broken.has(i)) return false;
    let mine = this.stars.get(p.id);
    if (!mine) this.stars.set(p.id, (mine = new Set()));
    const key = 1000 + this.level.crates.indexOf(c);
    if (mine.has(key) || Math.abs(c.x + 0.5 - p.x) > REACH) return false;
    mine.add(key);
    return true;
  }

  // A treasure chest (by its spot, i) opened by p, standing by it, at the
  // island's time now: it, { i, gold }, or null when there is no shut one there.
  openChest(p, i, now) {
    return this.chests.open({ x: p.x, y: p.y, z: 0 }, i, now);
  }

  // A stomp by p on the boss at time t: whether it hurt it (a heart off). The
  // stage is won once its last one is.
  stompBoss(p, t) {
    if (this.bossState !== 'on' || !this.boss) return false;
    const A = this.level.arena;
    const at = Math.min(this.clock, this.when(t));
    const pose = bossAt(this.boss, at, A);
    const spot = pose.spot;
    if (!spot || Math.abs(spot.x - p.x) > REACH + spot.w / 2 || Math.abs(spot.y - p.y) > REACH) return false;
    if (!hitBoss(this.boss, at, A)) return false;
    this.bossBy.add(p.id);
    return true;
  }

  // ------------------------------------------------ the wire

  // How it is all going, for someone arriving (stars: theirs, by room.js).
  describe() {
    return {
      key: this.key,
      clock: Math.round(this.clock),
      lit: [...this.lit],
      gone: [...this.gone.keys()],
      broken: [...this.broken],
      boss: this.boss ? packBoss(this.boss) : null,
      bs: this.bossState,
      fast: this.fast,
      chests: this.chests.pack(),
    };
  }

  // The stars someone has picked up (crates' as 1000 and up).
  starsOf(id) {
    return [...(this.stars.get(id) ?? [])];
  }

  // How it is going, a few times a second: each page of the story's bookmark
  // lit or not, and the boss's: [id, done]; and the boss's hearts.
  pack() {
    return this.all.map((n) => [n.id, n.done ? 1 : 0]);
  }

  kingPack() {
    return this.bossState === 'on' && this.boss ? [this.boss.hearts, this.boss.max] : null;
  }
}
