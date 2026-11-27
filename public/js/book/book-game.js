// A visit to a story of the Storybook, from this player's side (game.js makes
// one of these on a chapter of Adventure Isle's seventh episode, and it takes
// over from there): you running and jumping about its flat page (shared/book
// hero.js), the camera alongside, its foes where the story's clock says they
// are (foes.js), landed on or bopped, its stars to pick up, its crates to bop
// open, its bookmarks, its boss — and friends drawn where they are, a moment
// behind. What happens that matters to everyone, the island is told
// (room.js bookOp) and tells everyone.
import { bossSays } from '../boss-voice.js';
import { ANIM } from '../render/avatar.js';
import { advanceTime } from '../shared/env.js';
import { bossAt, bossSpec, unpackBoss } from '../shared/book/bosses.js';
import { foeAt, foeBox, FOES, shotsOf, stompable } from '../shared/book/foes.js';
import { HERO, MOVE, makeHero, overlaps, stepHero } from '../shared/book/hero.js';
import { TILE } from '../shared/book/level.js';
import { bookLevel } from '../shared/book/stories/index.js';

// How long you are safe after a knock (as the island has it: monsters.js
// SAFE_MS), blinking.
const SAFE_MS = 1600;
// A star is picked up this close to the middle of you.
const STAR_R = 0.5;
// How far a bop reaches in front of you, and how soon after one the next.
const BOP_REACH = 1.7;
const BOP_MS = 380;
// A popped foe is left out of the picture this long while the island says so.
const POP_WAIT_MS = 1500;
// Friends are drawn this far behind (they are a moment behind anyway).
const INTERP_MS = 120;
// Avatars' poses move on so many times a second: drawn as a flip-book is.
const FLIP_FPS = 15;
// How far ahead of you the camera looks, the way you are going.
const LOOK_AHEAD = 2.2;

export class BookGame {
  // info: how the island says the story is going (shared/book/tale.js
  // describe, with the stars you have picked up).
  constructor(game, info) {
    this.g = game;
    this.key = info.key;
    this.level = bookLevel(info.key);
    this.view = game.renderer.book;
    this.fast = Number.isFinite(info.fast) ? info.fast : 1;
    this.lit = new Set((info.lit ?? []).filter(Number.isInteger));
    this.gone = new Set((info.gone ?? []).filter(Number.isInteger));
    this.broken = new Set((info.broken ?? []).filter(Number.isInteger));
    this.got = new Set((info.stars ?? []).filter(Number.isInteger));
    this.popping = new Map();
    this.boss = unpackBoss(info.boss);
    this.bossState = info.bs ?? 'idle';
    this.off = null;
    this.tick(info.clock ?? 0);
    const at = this.homeAt();
    this.h = makeHero(at.x, at.y);
    // What the rest of the game asks of anyone's body.
    Object.assign(this.h, { z: 0, flying: false, inWater: false, inLava: false, headInWater: false, onGround: true });
    game.me.body = this.h;
    this.safeUntil = 0;
    this.swungAt = 0;
    this.stepAcc = 0;
    this.flip = new Map();
    this.bossHitAt = 0;
    this.told = new Set();
    this.cam = { x: at.x, y: at.y + 3, ready: false };
    this.view?.setState(this.state());
  }

  dispose() {}

  // ------------------------------------------------ the story's clock

  // The island's news of its clock (room.js stepTale, every half second): ours
  // is kept that far ahead of our own, as near as it comes in soonest.
  tick(c) {
    if (!Number.isFinite(c)) return;
    const sample = c - performance.now();
    this.off = this.off === null ? sample : Math.max(sample, this.off - 2);
  }

  // The story's clock now, ms (a moment on from what the island last said,
  // for the time its news takes to come).
  clock() {
    return performance.now() + (this.off ?? 0) + 30;
  }

  // ------------------------------------------------ where you are

  // Where to come back to: by the last bookmark lit, or the start.
  homeAt() {
    let best = null;
    for (const m of this.level.marks) if (this.lit.has(m.id) && (!best || m.x > best.x)) best = m;
    return best ? { x: best.x + 1.2, y: best.y + 0.01 } : { x: this.level.start.x, y: this.level.start.y + 0.01 };
  }

  putAt(at) {
    const h = this.h;
    Object.assign(h, { x: at.x, y: at.y, vx: 0, vy: 0, ground: false, on: -1, knock: 0, air: 0 });
    this.cam.ready = false;
  }

  // Sent back by the island (out of HP: room.js goHome), or fallen off the page.
  home(at) {
    this.putAt(at ? { x: at.x, y: at.y } : this.homeAt());
    this.safeUntil = performance.now() + SAFE_MS;
    this.g.renderer.effects.sparkles(this.h.x, this.h.y + 1, 0, 14, ['#fff3a0', '#ffffff', '#ffd6ec']);
  }

  get movers() {
    return this.level.movers;
  }

  // ------------------------------------------------ each frame

  update(dt, input) {
    const g = this.g;
    g.env.time = advanceTime(g.env.time, dt, g.env.mode);
    g.touch = input.touchMode;
    const now = performance.now();
    const t = this.clock();
    if (g.watching) this.drift(dt, input);
    else this.run(dt, input, t, now);
    this.poseMe(dt);
    this.poseFriends(dt);
    this.hidePets();
    this.emotes(now);
    if (!g.watching) g.sendMove();
    for (const [id, until] of this.popping) if (now > until) this.popping.delete(id);
    g.loot.update(dt);
    g.updateAdventure(dt);
    const r = g.renderer;
    g.selfVisible(true);
    this.aim(dt);
    r.frame(dt, { book: this.state(t), focus: { x: this.cam.x, y: this.cam.y, z: 0 }, me: this.h, safe: now < this.safeUntil });
    g.sound.wind(0);
    g.sound.fireLoop(0);
  }

  // What the picture needs to know of it all (render/book/view.js).
  state(t = this.clock()) {
    return { t, fast: this.fast, gone: this.gone, popping: this.popping, broken: this.broken, got: this.got, lit: this.lit, boss: this.boss, bossState: this.bossState, cam: this.cam };
  }

  // What the keys (or the thumb) say: left and right, jump, down, run.
  control(input) {
    const k = input.keys;
    const move = input.readMove();
    const x = Math.abs(move.x) > 0.25 ? Math.sign(move.x) * Math.min(1, Math.abs(move.x) * 1.4) : 0;
    const jump = input.jump || k.has('KeyW') || k.has('ArrowUp');
    const down = input.down || k.has('KeyS') || k.has('ArrowDown') || (input.joy ? input.joy.y < -0.7 : false);
    return { x, jump, down, fast: input.run };
  }

  run(dt, input, t, now) {
    const g = this.g;
    const h = this.h;
    const still = g.dizzy;
    const ctl = still ? { x: 0, jump: false, down: false } : this.control(input);
    const before = { x: h.x, y: h.y, vy: h.vy };
    const ev = stepHero(this.level, h, ctl, Math.min(dt, 0.05), t, { gone: this.brokenTiles(), movers: this.movers, stride: MOVE });
    h.onGround = h.ground;
    if (ev.jumped) g.sound.play('jump', { hop: true });
    if (ev.sprung) {
      g.sound.play('boing', { speed: 12 });
      this.view?.spring(Math.floor(h.x), Math.round(h.y) - 1);
      g.profile.count('bounces');
    }
    if (ev.landed > 9) {
      g.sound.play('land');
      g.renderer.effects.dust(h.x, h.y, 0);
    }
    if (h.ground && Math.abs(h.vx) > 0.5) {
      this.stepAcc += Math.abs(h.vx) * dt;
      if (this.stepAcc > 1.2) {
        this.stepAcc = 0;
        g.sound.play('step', { kind: 'grass' });
        g.profile.count('steps');
      }
    }
    if (ev.fell) {
      this.fall();
      return;
    }
    if (ev.thorns) this.hurt('thorns', { up: 11 });
    this.meet(before, t, now);
    this.stars();
    this.pageHints();
    g.me.speed = Math.abs(h.vx);
    g.me.yaw = faceYaw(h.face);
    g.me.anim = g.dizzy ? ANIM.dizzy : !h.ground && h.air > 0.06 ? ANIM.air : Math.abs(h.vx) > (MOVE.run + MOVE.fast) / 2 ? ANIM.run : Math.abs(h.vx) > 0.4 ? ANIM.walk : ANIM.idle;
  }

  brokenTiles() {
    return this.broken;
  }

  // Off the page: back by the last bookmark, a heart the poorer.
  fall() {
    const g = this.g;
    g.send({ t: 'book', op: 'fall', at: Math.round(this.clock()) });
    g.sound.play('ouch');
    this.home(null);
    this.tellOnce('fall', '📖', 'Whoops, off the page! Back you go to the last bookmark.');
  }

  // Something hurt you (what: a foe, what one spat, the boss, thorns): the
  // island takes the HP; you are knocked back, and safe a moment.
  hurt(what, { away = 0, up = 8 } = {}) {
    const now = performance.now();
    if (now < this.safeUntil || this.g.dizzy) return;
    this.safeUntil = now + SAFE_MS;
    const h = this.h;
    h.vx = (away || -h.face) * 6;
    h.vy = Math.max(h.vy, up);
    h.ground = false;
    h.on = -1;
    h.knock = 0.32;
    this.g.send({ t: 'book', op: 'hurt', k: what, at: Math.round(this.clock()) });
    if (what === 'thorns') this.tellOnce('thorns', '🌵', 'Ouch, thorns! Jump right over them.');
  }

  // What you bump into, land on or are hit by: foes, what they spat, the
  // boss and what it throws.
  meet(before, t, now) {
    const h = this.h;
    const me = { x: h.x, y: h.y, w: HERO.w, h: HERO.h };
    const falling = h.vy <= 0.5 || before.vy < 0;
    for (const f of this.level.foes) {
      if (!this.about(f.id)) continue;
      const pose = foeAt({ ...f, fast: this.fast }, t / 1000);
      const box = foeBox(f, pose);
      for (const s of shotsOf(f, t / 1000)) if (circleHits(me, s)) this.hurt('shot', { away: Math.sign(h.x - s.x) || 1 });
      if (!box || !overlaps(me, box, 0.08)) continue;
      const top = box.y + box.h;
      // Come down on top of it.
      if (falling && before.y >= top - 0.4 && h.y <= top + 0.3) {
        if (stompable(f, pose)) {
          this.stomp(f, pose, t);
          continue;
        }
        // (Prickly on top: up you go, and it hurts.)
        this.hurt('foe', { away: Math.sign(h.x - box.x) || -h.face, up: 13 });
        this.tellOnce(`prickly${f.kind}`, '🦔', 'Ouch, prickles! Bop that one (X, or 👊), or jump right over it.');
        continue;
      }
      this.hurt('foe', { away: Math.sign(h.x - box.x) || -h.face });
    }
    if (this.boss && this.bossState === 'on' && this.level.arena) {
      const p = bossAt(this.boss, t, this.level.arena);
      for (const s of p.shots) {
        if (s.flood ? h.y < this.level.arena.floor + s.y && h.y < this.level.arena.floor + 0.6 && h.x > this.level.arena.x0 : circleHits(me, s)) this.hurt('boss', { away: s.flood ? -h.face : Math.sign(h.x - s.x) || 1 });
      }
      const spot = p.spot;
      if (spot && falling && overlaps(me, spot, 0.05) && before.y >= spot.y + spot.h - 0.55) {
        this.stompBoss(t, spot);
        return;
      }
      for (const b of p.bodies) if (overlaps(me, b, 0.12)) this.hurt('boss', { away: Math.sign(h.x - b.x) || 1 });
    }
  }

  // Whether a foe is about: not popped, nor being popped.
  about(id) {
    return !this.gone.has(id) && !this.popping.has(id);
  }

  stomp(f, pose, t) {
    const g = this.g;
    const h = this.h;
    h.vy = h.held ? MOVE.stompHeld : MOVE.stomp;
    h.ground = false;
    h.cut = true;
    this.popping.set(f.id, performance.now() + POP_WAIT_MS);
    g.sendMove(true);
    g.send({ t: 'book', op: 'stomp', f: f.id, at: Math.round(t) });
    g.sound.play('stomp');
    g.renderer.jolt(0, 0, { kick: 0.006, roll: 0.003, zoom: 0.006 });
    this.view?.popFoe(f, pose, 'stomp');
    g.profile.count('pops');
  }

  stompBoss(t, spot) {
    const g = this.g;
    const h = this.h;
    h.vy = MOVE.stompHeld;
    h.ground = false;
    h.cut = true;
    h.vx = (Math.sign(h.x - spot.x) || 1) * 4;
    const now = performance.now();
    if (now - this.bossHitAt < 700) return;
    this.bossHitAt = now;
    g.sendMove(true);
    g.send({ t: 'book', op: 'boss', at: Math.round(t) });
    g.sound.play('stomp');
    g.sound.play('whack', { kind: 'hammer' });
    g.renderer.jolt(0, 0, { kick: 0.012, roll: 0.006, zoom: 0.012 });
    this.view?.burst(spot.x, spot.y + spot.h, 'BONK!');
  }

  // The 👊 button (or X, or a click): a swing in front of you, as far as an
  // arm (or what is in it) reaches. Bops foes that can be bopped, crates to
  // bits, and the boss where it is weak.
  attack() {
    const g = this.g;
    if (g.dizzy || g.watching) return null;
    const now = performance.now();
    // A friend sitting dizzy beside you: up they get.
    const friend = this.dizzyFriend();
    if (friend) {
      g.send({ t: 'help', pid: friend.id });
      return null;
    }
    if (now < this.swungAt) return null;
    this.swungAt = now + BOP_MS;
    const avatar = g.players.get(g.pid)?.avatar;
    const lands = Math.min(0.16, avatar?.swing() ?? 0.1);
    g.send({ t: 'swing' });
    g.sound.play('swish', { lands });
    const key = this.key;
    setTimeout(() => {
      if (g.book !== this || this.key !== key) return;
      this.bopLands();
    }, lands * 1000);
    return null;
  }

  bopLands() {
    const g = this.g;
    const h = this.h;
    const t = this.clock();
    const reach = { x: h.x + h.face * (HERO.w / 2 + BOP_REACH / 2 - 0.2), y: h.y - 0.25, w: BOP_REACH + 0.4, h: HERO.h + 0.6 };
    const ids = [];
    for (const f of this.level.foes) {
      if (!this.about(f.id) || !FOES[f.kind].bop) continue;
      const pose = foeAt({ ...f, fast: this.fast }, t / 1000);
      const box = foeBox(f, pose);
      if (!box || !overlaps(reach, box)) continue;
      ids.push(f.id);
      this.popping.set(f.id, performance.now() + POP_WAIT_MS);
      this.view?.popFoe(f, pose, 'bop');
    }
    if (ids.length) {
      g.sendMove(true);
      g.send({ t: 'book', op: 'bop', ids, at: Math.round(t) });
      g.sound.play('whack', { kind: 'punch' });
      g.profile.count('pops', ids.length);
    }
    for (const c of this.level.crates) {
      if (this.broken.has(c.i) || !overlaps(reach, { x: c.x + 0.5, y: c.y, w: 1, h: 1 })) continue;
      this.broken.add(c.i);
      g.sendMove(true);
      g.send({ t: 'book', op: 'crate', i: c.i });
      g.sound.play('creak');
      this.view?.crate(c, true);
    }
    if (this.boss && this.bossState === 'on') {
      const p = bossAt(this.boss, t, this.level.arena);
      if (p.spot && overlaps(reach, p.spot)) this.stompBoss(t, p.spot);
    }
  }

  dizzyFriend() {
    for (const p of this.g.players.values()) {
      if (p.me || !p.dizzy || !p.avatar) continue;
      const a = p.avatar.root.position;
      if (Math.abs(a.x - this.h.x) < 2.2 && Math.abs(a.y - this.h.y) < 2) return p;
    }
    return null;
  }

  // The stars you are touching, picked up (each person picks up every one).
  stars() {
    const h = this.h;
    const mx = h.x;
    const near = (s) => Math.abs(s.x - mx) < HERO.w / 2 + STAR_R && s.y > h.y - STAR_R && s.y < h.y + HERO.h + STAR_R;
    for (const s of this.level.stars) {
      if (this.got.has(s.i) || !near(s)) continue;
      this.pick(s.i, s.x, s.y);
    }
    this.level.crates.forEach((c, k) => {
      if (!c.star || !this.broken.has(c.i) || this.got.has(1000 + k)) return;
      const s = { x: c.x + 0.5, y: c.y + 0.5 };
      if (near(s)) this.pick(1000 + k, s.x, s.y);
    });
  }

  pick(i, x, y) {
    const g = this.g;
    this.got.add(i);
    g.sendMove(true);
    g.send({ t: 'book', op: 'star', i });
    g.sound.play('star');
    this.view?.starGot(i, x, y);
    g.emit('hp');
  }

  // As you come to each page of the story, what is new on it.
  pageHints() {
    const n = this.level.pageAt(this.h.x);
    const page = this.g.adventure?.story.pages?.[n];
    if (!page || n === 0 || this.told.has(`page${n}`)) return;
    this.told.add(`page${n}`);
    this.g.emit('toast', { icon: page.icon ?? '📖', text: `${page.name}: ${page.hint}` });
  }

  tellOnce(key, icon, text) {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.g.emit('toast', { icon, text });
  }

  // Watching unseen (the admin page): adrift over the page.
  drift(dt, input) {
    const move = input.readMove();
    const speed = input.run ? 30 : 12;
    this.h.x = Math.max(0, Math.min(this.level.w, this.h.x + move.x * speed * dt));
    this.h.y = Math.max(0, Math.min(this.level.h, this.h.y + ((input.jump ? 1 : 0) - (input.down ? 1 : 0) + move.y) * speed * dt));
    this.g.me.anim = ANIM.fly;
    this.g.me.speed = 0;
  }

  // ------------------------------------------------ the camera

  // Alongside you, a little ahead of the way you are facing and a little
  // over you; held still over the boss's page while you are on it.
  aim(dt) {
    const h = this.h;
    const cam = this.cam;
    const r = this.g.renderer;
    const A = this.level.arena;
    const view = r.bookView?.() ?? { w: 26, h: 14.6 };
    let x = h.x + h.face * LOOK_AHEAD;
    let y = h.y + 2.4;
    // On the boss's page: its floor at the foot of the picture, so whatever
    // flies over it shows (all of it across, too, if the screen is wide enough).
    if (A && h.x > A.x0 + 1) {
      if (view.w >= A.x1 - A.x0 + 1) x = (A.x0 + A.x1 + 1) / 2;
      y = A.floor + view.h / 2 - 1.2;
    }
    // (Never off the page.)
    x = Math.max(view.w / 2, Math.min(this.level.w - view.w / 2, x));
    y = Math.max(view.h / 2 - 1.2, Math.min(this.level.h - view.h / 2 + 1, y));
    if (!cam.ready) {
      cam.x = x;
      cam.y = y;
      cam.ready = true;
    }
    const kx = 1 - Math.exp(-dt * 5);
    const ky = 1 - Math.exp(-dt * (h.ground ? 4 : 1.6));
    cam.x += (x - cam.x) * kx;
    cam.y += (y - cam.y) * ky;
  }

  // ------------------------------------------------ everyone

  poseMe(dt) {
    const g = this.g;
    const self = g.players.get(g.pid);
    const a = self?.avatar;
    if (!a) return;
    a.root.position.set(this.h.x, this.h.y, 0);
    a.root.rotation.set(0, g.me.yaw, 0);
    // (Blinking while safe after a knock.)
    const now = performance.now();
    a.root.visible = !(now < this.safeUntil && Math.floor(now / 90) % 2 === 0);
    this.flipUpdate(g.pid, a, dt, g.me.anim, g.me.speed);
    if (a.shadow) a.shadow.visible = false;
  }

  poseFriends(dt) {
    const g = this.g;
    for (const p of g.players.values()) {
      if (p.me || !p.avatar) continue;
      const s = g.interpolate(p.snaps, INTERP_MS);
      if (!s) continue;
      const a = p.avatar;
      const prev = a.root.position;
      const speed = Math.hypot(s.x - prev.x, s.y - prev.y) / Math.max(dt, 1e-3);
      a.root.position.set(s.x, s.y, 0);
      a.root.rotation.set(0, s.yaw, 0);
      a.root.visible = true;
      this.flipUpdate(p.id, a, dt, s.anim, Math.min(speed, 10));
      if (a.shadow) a.shadow.visible = false;
      p.seated = false;
    }
    for (const p of g.players.values()) if (p.bubble && (p.bubble.left -= dt) <= 0) p.bubble = null;
  }

  // Pets stay off the page (it has no room for them: they wait at home).
  hidePets() {
    for (const pet of this.g.pets.values()) {
      if (!pet.model) continue;
      pet.model.group.visible = false;
      if (pet.model.shadow) pet.model.shadow.visible = false;
    }
  }

  // Hearts, notes and the like over whoever is emoting.
  emotes(nowMs) {
    const g = this.g;
    for (const p of g.players.values()) {
      const e = p.emoteFx;
      if (!e || !p.avatar) continue;
      if (e.until < nowMs) {
        p.emoteFx = null;
        continue;
      }
      if (nowMs < e.next) continue;
      const a = p.avatar.root.position;
      const y = a.y + p.avatar.tall;
      const fx = g.renderer.effects;
      if (e.key === 'hearts') fx.hearts(a.x, y + 1.5, 0.4, 1);
      else if (e.key === 'dance') fx.notes(a.x, y + 1.6, 0.4);
      else if (e.key === 'sleepy') fx.zzz(a.x, y + 1.5, 0.4);
      else if (e.key === 'surprise' && !e.done) {
        fx.bang(a.x, y + 1.7, 0.4);
        e.done = true;
      } else if (e.key === 'cheer' || e.key === 'clap') fx.sparkles(a.x, y + 1.6, 0.4, 2);
      e.next = nowMs + (e.key === 'sleepy' ? 600 : 350);
    }
  }

  // Moves an avatar's pose on as a flip-book does, a few drawings a second.
  flipUpdate(id, a, dt, anim, speed) {
    const acc = (this.flip.get(id) ?? 0) + dt;
    if (acc < 1 / FLIP_FPS) {
      this.flip.set(id, acc);
      return;
    }
    this.flip.set(id, 0);
    a.update(acc, anim, speed);
  }

  // Where something h over someone's head is.
  over(p, h) {
    const a = p.avatar.root.position;
    return { x: a.x, y: a.y + h, z: 0 };
  }

  // ------------------------------------------------ the island's news

  // What happened, for everyone (room.js: t 'bx').
  news(msg) {
    const g = this.g;
    switch (msg.k) {
      case 'pop': {
        const f = this.level.foes.find((o) => o.id === msg.f);
        if (!f) break;
        this.gone.add(f.id);
        this.popping.delete(f.id);
        if (msg.pid !== g.pid) {
          const pose = foeAt({ ...f, fast: this.fast }, this.clock() / 1000);
          this.view?.popFoe(f, pose, msg.how);
          if (Math.abs(pose.x - this.h.x) < 20) g.sound.play(msg.how === 'bop' ? 'whack' : 'stomp');
        }
        break;
      }
      case 'back':
        this.gone.delete(msg.f);
        this.view?.foeBack(msg.f);
        break;
      case 'crate': {
        const c = this.level.crates.find((o) => o.i === msg.i);
        if (!c) break;
        if (!this.broken.has(c.i)) {
          this.broken.add(c.i);
          this.view?.crate(c, true);
          if (Math.abs(c.x - this.h.x) < 20) g.sound.play('creak');
        }
        break;
      }
      case 'bosscomes':
        if (this.level.inArena(this.h.x, this.h.y)) g.emit('toast', { icon: bossSpec(this.level.boss.kind).icon, text: `Here comes ${bossSpec(this.level.boss.kind).name}!` });
        g.sound.play('rumble');
        break;
      case 'boss': {
        const b = unpackBoss(msg.b);
        if (!b) break;
        const was = this.boss;
        this.boss = b;
        if (this.bossState !== 'on') {
          this.bossState = 'on';
          g.emit('adventure');
          // (It has something to say as it comes out: boss-voice.js.)
          if (this.level.inArena(this.h.x, this.h.y)) bossSays(g, b.kind, 'before');
        }
        // (Count Inkblot, half his hearts gone, floods his room.)
        if (msg.hit && was && was.hearts > b.max / 2 && b.hearts <= b.max / 2 && b.hearts > 0) bossSays(g, b.kind, 'again');
        if (msg.hit) {
          g.sound.play('ouch');
          if (b.hearts > 0 && was && was.hearts !== b.hearts) this.tellOnce('bosshit', '💥', `Got it! ${b.hearts} more ${b.hearts === 1 ? 'heart' : 'hearts'} to go.`);
          if (b.phase === 'beaten') {
            g.sound.play('kaboom');
            this.view?.bossBeaten();
            bossSays(g, b.kind, 'after');
          }
        }
        g.emit('hp');
        break;
      }
      case 'bossquiet':
        this.boss = null;
        this.bossState = 'idle';
        g.emit('hp');
        break;
      default:
        break;
    }
  }

  // A bookmark lit (a page of the story done), or the boss gone pop.
  bookmark(msg) {
    const g = this.g;
    if (!Number.isInteger(msg.id)) return false;
    const mark = this.level.marks.find((m) => m.id === msg.id);
    if (mark) {
      this.lit.add(mark.id);
      this.view?.lightMark(mark.id);
      if (Math.abs(mark.x - this.h.x) < 30) {
        g.sound.play('fanfare');
        g.renderer.effects.sparkles(mark.x, mark.y + 2, 0, 24, ['#ffd84d', '#ffffff', '#ff9ec7', '#9fd8ff']);
      }
      const name = g.adventure?.story.pages?.[mark.id - 1]?.name;
      const by = g.players.get(msg.by);
      g.emit('toast', { icon: '🔖', text: `${name ?? `Page ${mark.id}`} is done${by && !by.me ? ` — ${by.name} got to its bookmark` : ''}! Anyone who falls comes back here now.` });
    }
    g.emit('adventure');
    g.emit('hp');
    return msg.by === g.pid || (mark && Math.abs(mark.x - this.h.x) < 40);
  }

  // How each page of the story is going (tale.js pack: [id, done]).
  rows(rows) {
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(row) || !row.every(Number.isFinite)) continue;
      const [id, done] = row;
      if (done && this.level.marks.some((m) => m.id === id) && !this.lit.has(id)) {
        this.lit.add(id);
        this.view?.lightMark(id);
      }
    }
  }

  // Knocked about by the island (room.js knock): your HP as it says, and out
  // of it, dizzy or sent back.
  bumped(msg) {
    const g = this.g;
    g.setHp(msg);
    g.sound.play('bump');
    g.buzz?.(25);
    g.renderer.effects.bang(this.h.x, this.h.y + 1.7, 0);
    if (msg.dizzy) {
      g.dizzy = true;
      g.sound.play('dizzy');
      g.emit('dizzy', true);
      g.emit('toast', { icon: '💫', text: 'Out of HP! Sit tight: a friend can tap you to help you up.' });
    } else if (msg.home && Array.isArray(msg.at)) this.home({ x: msg.at[0], y: msg.at[1] });
  }

  // The pages done so far, and all of them.
  get pagesDone() {
    return this.lit.size + (this.g.adventure?.won ? 1 : 0);
  }

  get pagesAll() {
    return this.level.marks.length + 1;
  }

  get starsAll() {
    return this.level.stars.length + this.level.crates.filter((c) => c.star).length;
  }

  // The boss's name and hearts over its head (ui.js tags).
  tags() {
    if (!this.boss || this.bossState !== 'on' || !this.level.arena) return [];
    const spec = bossSpec(this.boss.kind);
    const p = bossAt(this.boss, this.clock(), this.level.arena);
    if (p.hide) return [];
    return [{ key: 'bookboss', x: p.x, y: p.y + 3.4, z: 0, label: `${spec.icon} ${spec.name}`, share: this.boss.hearts / Math.max(1, this.boss.max), kind: 'boss' }];
  }
}

// Which way an avatar faces, going one way or the other along the page: a
// little round towards you, so its face shows.
export function faceYaw(face) {
  return face >= 0 ? Math.PI / 2 - 0.6 : -Math.PI / 2 + 0.6;
}

function circleHits(box, s) {
  const cx = Math.max(box.x - box.w / 2, Math.min(box.x + box.w / 2, s.x));
  const cy = Math.max(box.y, Math.min(box.y + box.h, s.y));
  return Math.hypot(cx - s.x, cy - s.y) < s.r * 0.85;
}

export { TILE };
