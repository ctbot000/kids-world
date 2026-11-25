// A dream of the Land of Nod as it is played, on the host: a chapter of
// Adventure Isle's sixth episode (isle-story.js), in place of camps or battles.
// Its nightmares, each on a body of its own and over when its last wave of
// frights (foes.js) is popped; then its boss (bosses.js), on a little world of
// its own; the frights that roam about the rest; and its forty winks, to find.
// Everyone in it is in it together.
import { Rng } from '../rng.js';
import { dist3, dot, flatUnit, turn } from './shape.js';
import { DreamChests } from './chests.js';
import { Frights, mightOf } from './foes.js';
import './bosses.js';
import './soul-foes.js';
import { nodWorld } from './worlds/index.js';

// Somebody on its body this long sets a nightmare off; nobody there this long,
// and it is as it was.
const WAKE_MS = 1300;
const QUIET_MS = 7000;
// Between one wave and the next.
const WAVE_MS = 1500;
// The next wave comes out once this few of the one before are left (so there is
// hardly a lull), unless it is a small one.
const LEFT = 1;
// How long till the frights roaming a body are all back, once popped.
const ROAM_MS = 22000;
// The boss comes a moment after someone lands on its world.
const BOSS_MS = 2200;
// A Brave Burst reaches this far, and one player's comes no oftener than this.
export const BURST_R = 9;
const BURST_MS = 6000;
// Nobody's bop reaches further than this (a page says what it bopped, and is a
// moment behind on where that is).
const REACH = 6;
// How long after a blow a page may still say it was hit by it.
const LATE_MS = 6000;

export class Dream {
  // key: which dream (worlds/); story: its chapter; level: how hard.
  constructor({ key, story, level = 14, done = [] }, seed = 1) {
    this.key = key;
    this.story = story;
    this.level = level;
    this.world = nodWorld(key);
    this.space = this.world.space;
    this.rng = new Rng(seed);
    this.frights = new Frights(this.space, { level, seed: (seed ^ 0x51ed270b) >>> 0 });
    const body = (k) => this.space.byKey.get(k);
    this.list = this.world.nightmares.map((n) => ({ id: n.id, spec: n, body: body(n.body), at: n.at, done: false, state: 'idle', wave: -1, waveAt: 0, since: 0, quiet: 0, by: new Set() }));
    const b = this.world.boss;
    // The boss is the last of them, and shut away till the rest are over.
    this.boss = { id: this.list.length + 1, boss: true, spec: b, body: body(b.body), at: b.at, done: false, state: 'idle', since: 0, quiet: 0, fright: 0, by: new Set() };
    this.roams = this.world.roam.map((r, i) => ({ spec: r, body: body(r.body), camp: `roam${i}`, backAt: 0, out: false }));
    this.winks = new Set();
    this.chests = new DreamChests(this.world.chests, (seed ^ 0x3c6ef372) >>> 0);
    // Where each person was safe last, and which body they are on.
    this.safe = new Map();
    this.on = new Map();
    this.burstAt = new Map();
    this.now = 0;
    this.restore(done);
  }

  get all() {
    return [...this.list, this.boss];
  }

  get bossReady() {
    return this.list.every((n) => n.done);
  }

  get won() {
    return this.boss.done;
  }

  byId(id) {
    return this.all.find((n) => n.id === id) ?? null;
  }

  // What was done before (over a restart): nightmares by their ids, winks found
  // as 100 and up. all: the boss too (or it is there to be beaten once more: its
  // end is the dream's, which had not come yet).
  restore(ids, all = true) {
    for (const id of ids) {
      const n = this.byId(id);
      if (n?.boss && !all) continue;
      if (n) Object.assign(n, { done: true, state: 'done' });
      else if (id >= 100 && id - 100 < this.world.winks.length) this.winks.add(id - 100);
    }
  }

  doneIds() {
    return [...this.all.filter((n) => n.done).map((n) => n.id), ...[...this.winks].map((i) => 100 + i)];
  }

  // Where someone out of HP comes round: where they were last safe.
  homeFor(id) {
    const s = this.safe.get(id) ?? this.world.start;
    return { x: s.x, y: s.y, z: s.z };
  }

  // Moves it all on. people: { id, x, y, z, dizzy, power }. What happened:
  // { acts, fx, gone, done: [{ n, by, won }], credit }.
  step(dt, now, people) {
    this.now = now;
    const out = { acts: [], fx: [], gone: [], done: [] };
    for (const p of people) {
      const prev = this.on.get(p.id) ?? null;
      p.body = this.space.bodyAt(p.x, p.y, p.z, prev) ?? this.space.bodies[0];
      this.on.set(p.id, p.body);
      // (Safe: standing on a body with no nightmare left on it.)
      if (!p.dizzy && !this.danger(p.body) && Math.abs(p.body.ground(p.x, p.y, p.z)) < 0.35) this.safe.set(p.id, { x: p.x, y: p.y, z: p.z });
    }
    if (!this.won) {
      for (const n of this.list) if (!n.done) this.stepNightmare(n, dt, now, people, out);
      this.stepBoss(dt, now, people, out);
    }
    this.stepRoams(now, people);
    if (this.chests.step(now)) out.fx.push({ k: 'chests', c: this.chests.pack() });
    this.frights.step(dt, now, people);
    out.acts = this.frights.take('acts');
    out.fx.push(...this.frights.take('fx'));
    out.gone = this.frights.take('gone');
    return out;
  }

  // Whether a body is one to be wary of: a nightmare not over on it, or the boss's.
  danger(body) {
    return this.all.some((n) => n.body === body && !n.done);
  }

  // How hard blows hit here: harder the later the dream.
  get fierce() {
    return 1 + Math.max(0, this.level - 14) * 0.06;
  }

  // Whether someone is in the thick of a fight.
  fighting(id) {
    const body = this.on.get(id);
    return Boolean(body) && this.all.some((n) => n.body === body && n.state === 'on');
  }

  // Whether a body's springs are shut: a fight is on there.
  shut(key) {
    return this.all.some((n) => n.body.key === key && n.state === 'on');
  }

  here(n, people) {
    return people.filter((p) => p.body === n.body && !p.dizzy);
  }

  stepNightmare(n, dt, now, people, out) {
    const here = this.here(n, people);
    if (n.state === 'idle') {
      if (!here.length) {
        n.since = 0;
        return;
      }
      n.since ||= now;
      if (now - n.since < WAKE_MS) return;
      Object.assign(n, { state: 'on', wave: 0, waveAt: now + 900, quiet: 0, by: new Set(), out: false });
      out.fx.push({ k: 'wake', n: n.id });
      return;
    }
    for (const p of here) n.by.add(p.id);
    if (!here.length) {
      n.quiet ||= now;
      if (now - n.quiet > QUIET_MS) {
        this.frights.clear(`n${n.id}`);
        Object.assign(n, { state: 'idle', wave: -1, since: 0, quiet: 0 });
        out.fx.push({ k: 'quiet', n: n.id });
      }
      return;
    }
    n.quiet = 0;
    const waves = n.spec.waves;
    const left = this.frights.of(`n${n.id}`).length;
    if (!n.out) {
      if (now < n.waveAt) return;
      n.out = true;
      n.came = this.comeOut(n, waves[n.wave], here, now);
      out.fx.push({ k: 'wave', n: n.id, w: n.wave + 1, of: waves.length });
      return;
    }
    const last = n.wave === waves.length - 1;
    if (left > (last || n.came < 4 ? 0 : LEFT)) return;
    if (!last) {
      Object.assign(n, { wave: n.wave + 1, waveAt: now + WAVE_MS, out: false });
      return;
    }
    Object.assign(n, { done: true, state: 'done' });
    out.done.push({ n, by: [...n.by], won: false });
  }

  // A wave coming out, round whoever is there: how many.
  comeOut(n, wave, here, now) {
    let made = 0;
    const more = 1 + (here.length - 1) * 0.5;
    for (const [kind, count] of wave) {
      for (let i = 0; i < Math.round(count * more); i++) {
        const s = this.spotFor(n.body, here);
        const f = this.frights.add(kind, s, { camp: `n${n.id}` });
        f.cool = now + 900 + made * 350 + this.rng.range(0, 500);
        made++;
      }
    }
    return made;
  }

  // Somewhere on a body for one to come out: some way off everyone there, clear
  // of what stands about.
  spotFor(body, here, near = 5.5, far = 9.5) {
    let best = null;
    for (let tries = 0; tries < 14; tries++) {
      const p = here[Math.floor(this.rng.next() * here.length)];
      const at = p ?? this.world.start;
      const up = body.up(at.x, at.y, at.z);
      const way = turn(flatUnit({ x: 0.31, y: 0.22, z: 0.9 }, up), up, this.rng.range(0, Math.PI * 2));
      const q = body.walk(body.land(at), way, this.rng.range(near, far), 1).at(-1);
      const s = { x: q.x, y: q.y, z: q.z, up: q.up, body };
      best = s;
      if (body.clutter(q.x + q.up.x * 0.6, q.y + q.up.y * 0.6, q.z + q.up.z * 0.6) < 0.9) continue;
      if (here.some((o) => dist3(o, q) < near - 1)) continue;
      return s;
    }
    return best;
  }

  stepBoss(dt, now, people, out) {
    const b = this.boss;
    if (!this.bossReady || b.done) return;
    const here = this.here(b, people);
    if (b.state === 'idle') {
      if (!here.length) {
        b.since = 0;
        return;
      }
      if (!b.since) {
        b.since = now;
        out.fx.push({ k: 'bosscomes', n: b.id });
      }
      if (now - b.since < BOSS_MS) return;
      const f = this.frights.add(b.spec.kind, { ...b.at, dir: b.at.dir }, { camp: 'boss' });
      f.hearts = f.max = f.spec.hearts;
      f.cool = now + 2400;
      f.born = now;
      this.frights.now = now;
      f.spec.begin?.(this.frights, f, this);
      Object.assign(b, { state: 'on', fright: f.id, quiet: 0, by: new Set() });
      out.fx.push({ k: 'boss', n: b.id, f: f.id });
      return;
    }
    for (const p of here) b.by.add(p.id);
    if (here.length) {
      b.quiet = 0;
      return;
    }
    b.quiet ||= now;
    if (now - b.quiet > QUIET_MS) {
      this.frights.clear('boss');
      Object.assign(b, { state: 'idle', since: 0, quiet: 0, fright: 0 });
      out.fx.push({ k: 'quiet', n: b.id });
    }
  }

  // The frights roaming the rest of it: out while there is anyone about, a few
  // at a time, and back a while after they are popped.
  stepRoams(now, people) {
    for (const r of this.roams) {
      const near = people.some((p) => p.body === r.body || dist3(p, r.body.c) < r.body.reach + 14);
      const left = this.frights.of(r.camp).length;
      if (!near || this.won) {
        if (r.out) this.frights.clear(r.camp);
        r.out = false;
        continue;
      }
      if (r.out && left === 0 && !r.backAt) r.backAt = now + ROAM_MS;
      if (!r.out || (r.backAt && now >= r.backAt)) {
        r.backAt = 0;
        r.out = true;
        if (left) continue;
        const here = people.filter((p) => p.body === r.body);
        for (const [kind, count] of r.spec.kinds) {
          for (let i = 0; i < count; i++) {
            const s = here.length ? this.spotFor(r.body, here, 8, 14) : this.anySpot(r.body);
            this.frights.add(kind, s, { camp: r.camp });
          }
        }
      }
    }
  }

  anySpot(body) {
    for (let i = 0; ; i++) {
      const s = body.spot({ x: this.rng.range(-1, 1) * body.reach, y: this.rng.range(-1, 1) * body.reach, z: this.rng.range(-1, 1) * body.reach });
      if (i > 12 || body.clutter(s.x + s.up.x * 0.6, s.y + s.up.y * 0.6, s.z + s.up.z * 0.6) > 0.9) return s;
    }
  }

  // ------------------------------------------------ what pages say

  // Bops by player p (its position) on frights by their ids: what came of each,
  // { id, clang, hearts, broke, pop }.
  bop(p, ids, now, power = 1) {
    const out = [];
    for (const id of ids.slice(0, 12)) {
      const f = this.frights.get(id);
      if (!f || f.state === 'come') continue;
      // (Within anybody's reach, and on the same side of what they both stand on.)
      if (dist3(f, p) - f.spec.radius > REACH || dot(this.upOf(p), f.up) < -0.4) continue;
      const hit = this.frights.hit(f, p.id, p, now, mightOf(power));
      if (hit.wait) continue;
      out.push({ id, ...hit, f });
      if (hit.pop) this.pop(f);
    }
    return out;
  }

  // Which way is up for someone.
  upOf(p) {
    return (this.on.get(p.id) ?? this.space.bodyAt(p.x, p.y, p.z) ?? this.space.bodies[0]).up(p.x, p.y, p.z);
  }

  pop(f) {
    this.frights.remove(f);
    f.onPop?.(this, f);
    if (f.id !== this.boss.fright) return;
    this.boss.done = true;
    this.boss.state = 'done';
    this.frights.clear('boss');
  }

  // The boss beaten some other way than by its last heart.
  beaten(f) {
    this.frights.remove(f);
    this.boss.done = true;
    this.boss.state = 'done';
    this.frights.clear('boss');
    this.boss.hero = true;
  }

  // Somebody came down out of the air at p.
  slammed(p, now) {
    const f = this.boss.fright ? this.frights.get(this.boss.fright) : null;
    f?.onSlam?.(this.frights, f, p, now);
  }

  act(id) {
    const a = this.frights.acts.get(id);
    return a && this.now - a.strike < LATE_MS ? a : null;
  }

  // A Brave Burst by p: every fright near is stunned, those with no guard popped.
  burst(p, now) {
    if (now - (this.burstAt.get(p.id) ?? -Infinity) < BURST_MS) return null;
    this.burstAt.set(p.id, now);
    const out = [];
    for (const f of [...this.frights.list]) {
      if (dist3(f, p) - f.spec.radius > BURST_R || f.state === 'come') continue;
      if (f.spec.guard === 'none') {
        this.pop(f);
        out.push({ id: f.id, pop: true, f });
      } else if (this.frights.opens(f, f.spec.alt ? 'fall' : 'stun', now)) out.push({ id: f.id, f });
    }
    return out;
  }

  // A wink found by p: whether it was there to be found.
  wink(p, i) {
    const w = this.world.winks[i];
    if (!w || this.winks.has(i) || dist3(w, p) > 5) return false;
    this.winks.add(i);
    return true;
  }

  // ------------------------------------------------ the wire

  // How it is all going, for someone arriving.
  describe() {
    return { key: this.key, n: this.pack(), winks: [...this.winks], chests: this.chests.pack(), k: this.kingPack() };
  }

  pack() {
    return this.all.map((n) => [n.id, ['idle', 'on', 'done'].indexOf(n.done ? 'done' : n.state), Math.max(0, (n.wave ?? -1) + 1), n.boss ? 0 : n.spec.waves.length, n.boss ? 0 : this.frights.of(`n${n.id}`).length]);
  }

  kingPack() {
    const f = this.boss.fright ? this.frights.get(this.boss.fright) : null;
    return f ? [f.hearts, f.max] : null;
  }
}
