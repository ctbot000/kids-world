// A visit to a dream of the Land of Nod, from this player's side (game.js makes
// one of these on a chapter of Adventure Isle's sixth episode, and it takes over
// from there): you walking about bodies of any shape, each with a down of its
// own (shared/nod/walker.js), the camera turning with you, springs that fling you
// from one to another, friends and pets the right way up wherever they are, the
// winks to find — and everything to do with fighting, in fight.js.
import { ANIM } from '../render/avatar.js';
import { quatOf } from '../render/nod/kit.js';
import { gearMove, wornWeapon } from '../shared/shop.js';
import { advanceTime } from '../shared/env.js';
import { petPose } from '../shared/pets.js';
import { flightAt } from '../shared/nod/maker.js';
import { add, carry, cross, dist3, dot, flat, flatUnit, headingOf, len, mul, sub, turn, unit, yawOf } from '../shared/nod/shape.js';
import { makeWalker, standAt, STRIDE, stepWalker } from '../shared/nod/walker.js';
import { nodWorld } from '../shared/nod/worlds/index.js';
import * as THREE from '../../vendor/three.module.js';
import { setTwinLook } from '../render/nod/frights-mare.js';
import { ChestsView } from './chests-view.js';
import { Fight, ROLL } from './fight.js';

const INTERP_MS = 130;
const SPRING_R = 1.05;
const WINK_R = 1.5;
// Lost in the sky for this long (fallen right off everything), you wake with a
// start and are back where you were last safe.
const LOST_SECS = 5;

const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

export class NodGame {
  // info: how the island says it is going (shared/nod/dream.js describe).
  constructor(game, info, at = null) {
    this.g = game;
    this.world = nodWorld(info.key);
    this.space = this.world.space;
    this.view = game.renderer.nod;
    const start = this.world.start;
    this.w = standAt(makeWalker(0, 0, 0), start);
    // What the rest of the game asks of anyone's body.
    Object.assign(this.w, { flying: false, inWater: false, inLava: false, headInWater: false });
    this.h = { ...start.dir };
    if (at) this.putAt(at);
    game.me.body = this.w;
    this.cam = { fwd: { ...this.h }, up: { ...this.w.up }, yaw: null, pos: null };
    game.renderer.view.pitch = 0.42;
    game.renderer.view.ready = false;
    this.flight = null;
    this.flownAt = 0;
    this.lost = 0;
    this.winks = new Set(info.winks ?? []);
    this.nightmares = new Map();
    this.trails = new Map();
    this.stepAcc = 0;
    this.downAt = -Infinity;
    setTwinLook(game.profile.shownLook);
    this.fight = new Fight(this);
    this.view.showWinks(this.world.winks, this.winks);
    this.chests = new ChestsView(this, info.chests);
    this.zones = [];
    this.told = new Set();
    this.view.build(this.w, 60);
  }

  dispose() {
    this.fight.dispose();
    this.chests.dispose();
  }

  // Put down somewhere (come round, or arriving again).
  putAt(p) {
    const body = this.space.bodyAt(p.x, p.y, p.z) ?? this.space.bodies[0];
    const q = body.land(p);
    standAt(this.w, { ...q, up: body.up(q.x, q.y, q.z), body });
    this.h = flatUnit(this.h, this.w.up);
    this.flight = null;
    if (this.cam) {
      this.cam.up = { ...this.w.up };
      this.cam.fwd = flatUnit(this.cam.fwd, this.w.up);
      this.g.renderer.view.ready = false;
    }
  }

  get lit() {
    const all = this.world.nightmares.length + 1;
    let n = 0;
    for (const s of this.nightmares.values()) if (s.done) n++;
    return n / all;
  }

  // ------------------------------------------------ each frame

  update(dt, input) {
    const g = this.g;
    g.env.time = advanceTime(g.env.time, dt, g.env.mode);
    g.touch = input.touchMode;
    const now = performance.now();
    if (g.watching) this.drift(dt, input);
    else if (this.flight) this.fly(dt);
    else this.walk(dt, input);
    this.turnCamera(dt, input);
    this.poseMe(dt);
    if (!g.watching) {
      this.findSprings(now);
      this.findWinks();
      g.sendMove();
    }
    this.poseFriends(dt);
    this.movePets(dt);
    this.fight.update(dt);
    this.chests.update(dt);
    // (What popped frights dropped: loot-view.js.)
    g.loot.update(dt);
    this.emotes(now);
    g.updateAdventure(dt);
    const r = g.renderer;
    g.selfVisible(r.camDist > 1.3);
    r.frame(dt, { focus: { x: this.w.x, y: this.w.y, z: this.w.z }, up: this.w.up, lit: this.lit, asleep: (s) => this.asleep(s), zones: this.fight.zones() });
    g.sound.wind(0);
    g.sound.fireLoop(0);
  }

  // Which way the keys (or the thumb) want to go, along the ground.
  wish(move) {
    const up = this.w.up;
    const fwd = flatUnit(this.cam.fwd, up);
    const right = cross(fwd, up);
    return add(mul(fwd, move.y), right, move.x);
  }

  walk(dt, input) {
    const g = this.g;
    const w = this.w;
    const still = g.dizzy;
    const move = still ? { x: 0, y: 0 } : input.readMove();
    // Through your own eyes, left and right turn you.
    if (g.renderer.camDist <= 1.3 && move.x && !still) {
      g.renderer.view.yaw -= move.x * 2.4 * dt;
      move.x = 0;
    }
    const dir = this.wish(move);
    const gear = gearMove(g.profile.data.gear, STRIDE);
    const stride = { ...STRIDE, ...(gear ? { walk: gear.walk, run: gear.run, ...(gear.jump ? { jump: Math.min(11, gear.jump) } : {}) } : {}) };
    const dash = this.fight.dash(now());
    const heavy = this.fight.heavy;
    if (this.fight.slamming) {
      // Coming down out of the air, straight down.
      const v = dot({ x: w.vx, y: w.vy, z: w.vz }, w.up);
      Object.assign(w, vec3(mul(w.up, Math.min(v, -24))));
    }
    const ev = stepWalker(this.space, w, { dir: this.fight.slamming ? null : mul(dir, heavy ? 0.35 : 1), jump: !still && input.jump && !this.fight.slamming, run: input.run || (g.touch && len(dir) > 0.9), hop: g.profile.settings.autoJump !== false }, this.fight.hitStop(dt), stride, dash);
    this.after(ev, dt, dir);
    // Off everything, with nothing to land on: back where you were.
    const gap = w.body ? w.body.base(w.x, w.y, w.z) : 99;
    this.lost = !w.onGround && gap > 14 ? this.lost + dt : 0;
    if (this.lost > LOST_SECS) {
      this.lost = 0;
      this.putAt(this.lastGround ?? this.world.start);
      g.emit('toast', { icon: '😴', text: 'You woke up with a start — and fell asleep again.' });
    }
    if (w.onGround) this.lastGround = { x: w.x, y: w.y, z: w.z };
  }

  after(ev, dt, dir) {
    const g = this.g;
    const w = this.w;
    const v = { x: w.vx, y: w.vy, z: w.vz };
    const along = flat(v, w.up);
    const speed = len(along);
    if (speed > 0.3 && !this.fight.facing) {
      const to = flatUnit(along, w.up);
      this.h = this.turnTo(this.h, to, w.up, Math.min(1, dt * 12));
    } else this.h = flatUnit(this.h, w.up);
    g.me.speed = speed;
    g.me.yaw = yawOf(this.h, w.up);
    const s = STRIDE;
    g.me.anim = g.dizzy ? ANIM.dizzy : !w.onGround && w.air > 0.08 ? ANIM.air : speed > (s.walk + s.run) / 2 ? ANIM.run : speed > 0.4 ? ANIM.walk : ANIM.idle;
    if (ev.jumped) g.sound.play('jump', { hop: true });
    if (ev.landed > 7) {
      g.sound.play('land');
      g.renderer.effects.dust(w.x, w.y, w.z);
    }
    if (ev.landed) this.fight.landed(ev.landed);
    this.playKeys(dt);
    if (w.onGround && speed > 0.5) {
      this.stepAcc += speed * dt;
      if (this.stepAcc > 1.1) {
        this.stepAcc = 0;
        g.sound.play('step', { kind: 'grass' });
        g.profile.count('steps');
      }
    }
  }

  // On the ring of piano keys (the Music Box): each sounds, and lights, as you
  // step on it.
  playKeys(dt) {
    const mesh = this.view.meshes.get('keys');
    const own = mesh?.material.userData.nod;
    if (!own?.uPressed) return;
    const lit = own.uPressed.value;
    for (let i = 0; i < lit.length; i++) lit[i] = Math.max(0, lit[i] - dt * 2.2);
    const w = this.w;
    if (w.body?.key !== 'keys' || !w.onGround) {
      this.keyOn = -1;
      return;
    }
    const p = KEY.set(w.x, w.y, w.z).sub(own.uBodyC.value).applyMatrix3(own.uBodyM.value);
    const id = Math.floor((Math.atan2(p.z, p.x) / (Math.PI * 2) + 0.5) * 42);
    lit[((id % 12) + 12) % 12] = 1;
    if (id === this.keyOn) return;
    this.keyOn = id;
    const white = [0, 2, 4, 5, 7, 9, 11];
    this.g.sound.play('nod-note', { n: white[id % 7] + 12 * (Math.floor(id / 7) % 3) - 12 });
  }

  // A turned towards b, k of the way, round up.
  turnTo(a, b, up, k) {
    const c = Math.max(-1, Math.min(1, dot(a, b)));
    const t = Math.acos(c);
    if (t < 1e-3) return b;
    const side = dot(cross(a, b), up) >= 0 ? 1 : -1;
    return flatUnit(turn(a, up, side * t * k), up);
  }

  // Watching unseen (the admin page): adrift, any way you look.
  drift(dt, input) {
    const w = this.w;
    const move = input.readMove();
    const v = this.g.renderer.view;
    const speed = (input.run ? 36 : 14) * Math.max(1, v.dist / 10);
    const dir = this.wish(move);
    const rise = (input.jump ? 1 : 0) - (input.down ? 1 : 0);
    const to = add(add(w, dir, speed * dt), w.up, rise * speed * 0.7 * dt);
    Object.assign(w, { x: to.x, y: to.y, z: to.z, onGround: false, flying: true });
    this.g.me.anim = ANIM.fly;
    this.g.me.speed = len(dir) * speed;
  }

  // ------------------------------------------------ springs

  // Whether a spring is asleep: shut while a fight is on round it, or not yet
  // awake (the way up to the boss).
  asleep(s) {
    if (s.need === 'boss' && !this.bossReady) return true;
    return this.bodyShut(s.from.body);
  }

  bodyShut(key) {
    for (const n of this.nightmares.values()) if (n.on && n.body === key) return true;
    return false;
  }

  get bossReady() {
    for (const n of this.world.nightmares) if (!this.nightmares.get(n.id)?.done) return false;
    return true;
  }

  findSprings(now) {
    const w = this.w;
    if (this.flight || !w.onGround || this.g.dizzy || now - this.flownAt < 700) return;
    for (const s of this.world.springs) {
      if (dist3(w, s.from) > SPRING_R) continue;
      if (this.asleep(s)) {
        this.tellOnce(`spring${s.id}`, 9000, '💤', s.need === 'boss' && !this.bossReady ? `This spring is fast asleep. It wakes once every nightmare here is over — ${this.leftToDo()} to go!` : 'The springs are asleep till the fight is over!');
        continue;
      }
      this.startFlight(s);
      return;
    }
  }

  leftToDo() {
    return this.world.nightmares.filter((n) => !this.nightmares.get(n.id)?.done).length;
  }

  tellOnce(key, ms, icon, text) {
    const now = performance.now();
    this.toldAt ??= new Map();
    if (now < (this.toldAt.get(key) ?? 0)) return;
    this.toldAt.set(key, now + ms);
    this.g.emit('toast', { icon, text });
  }

  startFlight(s) {
    this.fight.stop();
    this.flight = { s, t: 0, from: { x: this.w.x, y: this.w.y, z: this.w.z } };
    this.flip = 0;
    this.view.springs.get(s.id)?.fling();
    this.g.sound.play('boing', { speed: 14 });
    this.g.renderer.effects.boing(this.w.x, this.w.y, this.w.z, true);
    this.g.send({ t: 'nod', op: 'fling', s: s.id });
  }

  fly(dt) {
    const f = this.flight;
    const w = this.w;
    f.t += (dt * 1000) / f.s.ms;
    const k = Math.min(1, f.t);
    const q = flightAt(f.s, k);
    const ahead = flightAt(f.s, Math.min(1, k + 0.02));
    // (From where you stood on it, not quite its middle.)
    const off = (1 - Math.min(1, k * 4)) ** 2;
    const p = { x: q.x + (f.from.x - f.s.from.x) * off, y: q.y + (f.from.y - f.s.from.y) * off, z: q.z + (f.from.z - f.s.from.z) * off };
    const way = sub(ahead, q);
    const old = w.up;
    Object.assign(w, { x: p.x, y: p.y, z: p.z, up: q.up, onGround: false, air: 1, vx: 0, vy: 0, vz: 0 });
    this.cam.fwd = flatUnit(carry(this.cam.fwd, old, q.up), q.up);
    this.h = flatUnit(carry(this.h, old, q.up), q.up);
    if (len(way) > 1e-5 && k < 0.97) {
      const to = flat(way, q.up);
      if (len(to) > 1e-4) this.h = this.turnTo(this.h, unit(to), q.up, Math.min(1, dt * 6));
    }
    this.g.me.anim = ANIM.air;
    this.g.me.yaw = yawOf(this.h, w.up);
    this.g.me.speed = 8;
    if (Math.random() < dt * 30) this.g.renderer.effects.add('sparkle', p.x, p.y, p.z, { size: 0.25, life: 0.8, color: ['#fff3a0', '#ffd6ec', '#cfe8ff'][Math.floor(Math.random() * 3)], vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6 });
    if (k < 1) return;
    const body = this.space.byKey.get(f.s.to.body);
    standAt(w, { ...f.s.to, body });
    this.flight = null;
    this.flownAt = performance.now();
    this.g.sound.play('land');
    this.g.renderer.effects.dust(w.x, w.y, w.z);
    this.g.profile.count('bounces');
  }

  // ------------------------------------------------ winks

  findWinks() {
    const w = this.w;
    const mid = add(w, w.up, 0.8);
    this.world.winks.forEach((k, i) => {
      if (this.winks.has(i) || dist3(mid, k) > WINK_R) return;
      this.winks.add(i);
      this.view.winkGone(i);
      this.g.send({ t: 'nod', op: 'wink', i });
      this.g.sound.play('nod-wink');
      this.g.renderer.effects.sparkles(k.x, k.y, k.z, 10, ['#fff3a0', '#ffffff', '#ffd6ec']);
      this.g.emit('adventure');
    });
  }

  winkNews(msg) {
    if (!Number.isInteger(msg.i)) return;
    this.winks.add(msg.i);
    this.view.winkGone(msg.i);
    if (msg.n >= msg.of) this.g.emit('toast', { icon: '😉', text: `Every one of the ${msg.of} winks of this dream is found — forty winks! A diamond for everyone here! 💎` });
    if (msg.n >= msg.of) {
      this.g.profile.addToBasket('diamond', 1);
      this.g.sound.play('fanfare');
    }
    this.g.emit('adventure');
  }

  // ------------------------------------------------ the camera

  turnCamera(dt, input) {
    const { cam, w } = this;
    const r = this.g.renderer;
    const dy = cam.yaw === null ? 0 : r.view.yaw - cam.yaw;
    cam.yaw = r.view.yaw;
    // Up, as the camera has it, turning after you.
    const old = cam.up;
    const k = 1 - Math.exp(-dt * (this.flight ? 5 : 9));
    const next = unit({ x: old.x + (w.up.x - old.x) * k, y: old.y + (w.up.y - old.y) * k, z: old.z + (w.up.z - old.z) * k });
    cam.fwd = flatUnit(carry(cam.fwd, old, next), next);
    cam.up = next;
    if (dy) cam.fwd = flatUnit(turn(cam.fwd, next, dy), next);
    // Walking, with no hand on the camera, it comes round behind by and by.
    const move = input.move ?? { x: 0, y: 0 };
    if (!this.g.watching && !this.flight && !input.press?.moved && Math.abs(move.x) > 0.2 && r.camDist > 1.3) {
      const side = dot(cross(cam.fwd, this.h), next);
      cam.fwd = flatUnit(turn(cam.fwd, next, side * dt * (this.g.touch ? 1.1 : 0.7)), next);
    }
    this.watchFoe(dt, dy !== 0 || Boolean(input.press?.moved), next);
    if (this.g.portrait) {
      const v = r.view;
      cam.fwd = this.turnTo(cam.fwd, mul(flatUnit(this.h, next), -1), next, Math.min(1, dt * 4));
      v.pitch += (0.12 - v.pitch) * Math.min(1, dt * 4);
      v.dist += (this.g.pose.dist - v.dist) * Math.min(1, dt * 4);
    }
    r.nodCamera(dt, w, cam.up, cam.fwd, this.space, this.back);
  }

  // In a fight, with no hand on the camera for a while, it comes round by itself
  // to keep what you are fighting in the picture — a boss, from a little further
  // back and higher up; or whoever is about to go for you, if they are out of it.
  watchFoe(dt, hand, up) {
    const now = performance.now();
    const g = this.g;
    if (hand) this.handAt = now;
    const f = g.watching || this.flight || g.portrait ? null : this.fight.foe();
    const boss = f?.spec.boss ? 1 : 0;
    this.back = (this.back ?? 0) + (boss - (this.back ?? 0)) * Math.min(1, dt * 1.5);
    if (!f || now - (this.handAt ?? -Infinity) < 1500 || g.renderer.camDist <= 1.3) return;
    const to = flat(sub(f, this.w), up);
    if (len(to) < 0.8) return;
    const dir = unit(to);
    const off = Math.acos(Math.max(-1, Math.min(1, dot(this.cam.fwd, dir))));
    const slack = boss ? 0.4 : 0.8;
    if (off < slack) return;
    const by = Math.min(off - slack, dt * (boss ? 2 : 1.1) * Math.min(1, (off - slack) / 0.5));
    this.cam.fwd = flatUnit(turn(this.cam.fwd, up, (dot(cross(this.cam.fwd, dir), up) >= 0 ? 1 : -1) * by), up);
  }

  // ------------------------------------------------ everyone about

  // Where something h over someone's (or something's) head is.
  over(p, h) {
    const a = p.avatar.root.position;
    const up = p.me ? this.w.up : (p.nodUp ?? this.w.up);
    return { x: a.x + up.x * h, y: a.y + up.y * h, z: a.z + up.z * h };
  }

  poseMe(dt) {
    const g = this.g;
    const self = g.players.get(g.pid);
    const a = self?.avatar;
    if (!a) return;
    const w = this.w;
    self.nodUp = w.up;
    this.poseAvatar(a, w, w.up, this.h, this.fight.tumble(), this.flight ? this.flight.t : 0);
    a.update(this.fight.hitStop(dt), g.me.anim, g.me.speed);
    this.blob(a.shadow, w, w.up, w.body);
  }

  // An avatar stood at p, up its up, facing h, part way through a roll (0 to 1)
  // or a somersault off a spring.
  poseAvatar(a, p, up, h, roll = 0, flip = 0) {
    quatOf(up, h, a.root.quaternion);
    let x = p.x;
    let y = p.y;
    let z = p.z;
    const turnBy = roll ? roll * Math.PI * 2 : flip > 0 && flip < 1 ? Math.min(1, flip * 1.6) * Math.PI * 2 : 0;
    if (turnBy) {
      // Head over heels round its middle.
      tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), turnBy);
      a.root.quaternion.multiply(tmpQ);
      const mid = roll ? 0.5 : 0.8;
      tmpV.set(0, mid, 0).applyQuaternion(a.root.quaternion);
      x += up.x * mid - tmpV.x;
      y += up.y * mid - tmpV.y;
      z += up.z * mid - tmpV.z;
    }
    a.root.position.set(x, y, z);
  }

  // The round shadow under something.
  blob(shadow, p, up, body, scale = 1) {
    const on = body ?? this.space.bodyAt(p.x, p.y, p.z);
    const high = on ? on.ground(p.x, p.y, p.z) : 99;
    if (high > 9) {
      shadow.visible = false;
      return;
    }
    shadow.visible = true;
    const q = { x: p.x - up.x * (high - 0.04), y: p.y - up.y * (high - 0.04), z: p.z - up.z * (high - 0.04) };
    shadow.position.set(q.x, q.y, q.z);
    shadow.quaternion.setFromUnitVectors(tmpV.set(0, 0, 1), FACE.set(up.x, up.y, up.z));
    const k = scale * Math.max(0.4, 1 - Math.max(0, high) * 0.12);
    shadow.scale.set(k, k, 1);
    shadow.material.opacity = 0.34 * Math.max(0.2, 1 - Math.max(0, high) * 0.16);
  }

  poseFriends(dt) {
    const g = this.g;
    const nowMs = performance.now();
    for (const p of g.players.values()) {
      if (p.me || !p.avatar) continue;
      const s = this.friendAt(p, nowMs);
      if (!s) continue;
      const a = p.avatar;
      const prev = a.root.position;
      const speed = Math.hypot(s.x - prev.x, s.y - prev.y, s.z - prev.z) / Math.max(dt, 1e-3);
      p.nodBody = this.space.bodyAt(s.x, s.y, s.z, p.nodBody) ?? p.nodBody;
      const up = p.nodBody.up(s.x, s.y, s.z);
      const k = 1 - Math.exp(-dt * 10);
      p.nodUp = p.nodUp ? unit({ x: p.nodUp.x + (up.x - p.nodUp.x) * k, y: p.nodUp.y + (up.y - p.nodUp.y) * k, z: p.nodUp.z + (up.z - p.nodUp.z) * k }) : up;
      const h = flatUnit(s.h, p.nodUp);
      const roll = p.rolledAt && nowMs - p.rolledAt < ROLL.ms ? (nowMs - p.rolledAt) / ROLL.ms : 0;
      this.poseAvatar(a, s, p.nodUp, h, roll);
      a.update(dt, s.anim, Math.min(speed, 12));
      this.blob(a.shadow, s, p.nodUp, p.nodBody);
      p.seated = false;
    }
    for (const p of g.players.values()) if (p.bubble && (p.bubble.left -= dt) <= 0) p.bubble = null;
  }

  // Where a friend is, a little in the past, and which way they face.
  friendAt(p, nowMs) {
    const t = nowMs - INTERP_MS;
    const snaps = p.snaps;
    if (!snaps.length) return null;
    const read = (s) => {
      if (!s.h) s.h = headingOf(s.yaw, this.space.up(s.x, s.y, s.z));
      return s;
    };
    let a = read(snaps[0]);
    if (t <= a.t) return a;
    for (let i = 1; i < snaps.length; i++) {
      const b = read(snaps[i]);
      if (b.t >= t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        const mix = (u, v) => u + (v - u) * k;
        return { x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z), h: unit({ x: mix(a.h.x, b.h.x), y: mix(a.h.y, b.h.y), z: mix(a.h.z, b.h.z) }), anim: b.anim };
      }
      a = b;
    }
    return a;
  }

  // Everyone's pet, at their heels: it follows where they have been.
  movePets(dt) {
    const g = this.g;
    for (const [pid, pet] of g.pets) {
      const p = g.players.get(pid);
      const m = pet.model;
      if (!p?.avatar || !m) continue;
      const at = p.me ? this.w : p.avatar.root.position;
      const up = p.nodUp ?? this.w.up;
      let t = this.trails.get(pid);
      if (!t || dist3(t.at, at) > 9) this.trails.set(pid, (t = { at: { x: at.x, y: at.y, z: at.z }, crumbs: [], h: p.me ? this.h : { x: 0, y: 0, z: 1 }, speed: 0 }));
      const last = t.crumbs.at(-1);
      if (!last || dist3(last, at) > 0.35) t.crumbs.push({ x: at.x, y: at.y, z: at.z, up: { ...up } });
      if (t.crumbs.length > 40) t.crumbs.shift();
      const gap = dist3(t.at, at);
      let to = null;
      while (t.crumbs.length > 1 && dist3(t.crumbs[0], t.at) < 0.4) t.crumbs.shift();
      if (gap > 1.5) to = t.crumbs[0];
      const want = to ? Math.min(13, 1.5 + gap * 2.4) : 0;
      t.speed += (want - t.speed) * Math.min(1, dt * 8);
      if (to && t.speed > 0.1) {
        const d = sub(to, t.at);
        const l = len(d);
        if (l > 1e-4) {
          const step = Math.min(l, t.speed * dt);
          t.at = add(t.at, d, step / l);
          t.h = flatUnit(add(t.h, mul(d, 1 / l), Math.min(1, dt * 10)), up);
        }
      }
      const body = this.space.bodyAt(t.at.x, t.at.y, t.at.z);
      const q = body && Math.abs(body.ground(t.at.x, t.at.y, t.at.z)) < 1.2 ? body.land(t.at, 4) : t.at;
      const pup = body ? body.up(q.x, q.y, q.z) : up;
      m.group.visible = true;
      m.group.position.set(q.x, q.y, q.z);
      quatOf(pup, flatUnit(t.h, pup), m.group.quaternion);
      const state = t.speed > 5 ? 'run' : t.speed > 0.5 ? 'walk' : petPose ? 'sit' : 'idle';
      m.update(dt, t.speed > 5 ? 'run' : t.speed > 0.5 ? 'walk' : state, t.speed, 0);
      this.blob(m.shadow, q, pup, body, 0.8);
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
      const at = this.over(p, 1.5 + p.avatar.tall);
      const fx = g.renderer.effects;
      if (e.key === 'hearts') fx.hearts(at.x, at.y, at.z, 1);
      else if (e.key === 'dance') fx.notes(at.x, at.y, at.z);
      else if (e.key === 'sleepy') fx.zzz(at.x, at.y, at.z);
      else if (e.key === 'surprise' && !e.done) {
        fx.bang(at.x, at.y, at.z);
        e.done = true;
      } else if (e.key === 'cheer' || e.key === 'clap') fx.sparkles(at.x, at.y, at.z, 2);
      e.next = nowMs + (e.key === 'sleepy' ? 600 : 350);
    }
  }

  // ------------------------------------------------ the island's news

  // How each nightmare is going (shared/nod/dream.js pack).
  rows(rows) {
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(row) || !row.every(Number.isFinite)) continue;
      const [id, state, wave, waves, left] = row;
      const spec = this.world.nightmares.find((n) => n.id === id);
      const boss = id === this.world.nightmares.length + 1;
      if (!spec && !boss) continue;
      const was = this.nightmares.get(id);
      const n = { id, boss, body: boss ? this.world.boss.body : spec.body, at: boss ? this.world.boss.at : spec.at, on: state === 1, done: state === 2 || Boolean(was?.done), wave, waves, left };
      this.nightmares.set(id, n);
      this.view.lamps.get(id)?.set(n.done);
    }
    this.g.emit('hp');
  }

  // A nightmare over: its lamp lit.
  over_(msg) {
    const n = this.nightmares.get(msg.id);
    const g = this.g;
    const told = g.adventure?.story.nightmares?.[msg.id - 1];
    if (n) Object.assign(n, { done: true, on: false });
    this.view.lamps.get(msg.id)?.set(true);
    const mine = Array.isArray(msg.by) && msg.by.includes(g.pid);
    if (n && dist3(n.at, this.w) < 60) {
      g.sound.play('fanfare');
      g.renderer.effects.sparkles(this.w.x, this.w.y, this.w.z, 40, ['#ffd84d', '#ffffff', '#ffd6ec', '#9fd8ff']);
    }
    if (told && !msg.won) g.emit('toast', { icon: '🌟', text: told.done });
    if (!msg.won && this.bossReady) setTimeout(() => this.g.nod === this && g.emit('toast', { icon: '🌙', text: `Every lamp round the night-light is lit, and the golden spring beside it is awake: up to ${this.bossName()}!` }), 2600);
    this.fight.braver(1);
    return mine;
  }

  bossName() {
    return this.g.adventure?.story.nightmares?.at(-1)?.name ?? 'the boss';
  }

  tags() {
    return this.fight.tags();
  }
}

const FACE = new THREE.Vector3();
const KEY = new THREE.Vector3();
const now = () => performance.now();
const vec3 = (v) => ({ vx: v.x, vy: v.y, vz: v.z });
export { wornWeapon };
