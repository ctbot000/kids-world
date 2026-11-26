// Fighting in the Land of Nod, from this player's side (nod-game.js): the frights
// as the island tells of them (shared/nod/foes.js), each of their blows drawn as
// it is told and judged here, on what you saw — did it get you, did you roll out
// of its way, did you bop it back — and what you do yourself: a bop, a slam down
// out of the air, a roll, and once you have been brave enough often enough, a
// Brave Burst.
import * as THREE from '../../vendor/three.module.js';
import { swingOf } from '../render/avatar.js';
import { LaneMark, Shot, Beam, BurstDome } from '../render/nod/fx.js';
import { makeFright } from '../render/nod/frights.js';
import { quatOf } from '../render/nod/kit.js';
import { flashModel } from '../render/toon.js';
import { ARM_REACH } from '../shared/monsters.js';
import { wornWeapon } from '../shared/shop.js';
import { soulOf } from '../shared/souls.js';
import { aimedPath, beamPath, laneAt, lanePath, offPath, pathOf, waveR } from '../shared/nod/attacks.js';
import { BURST_R } from '../shared/nod/dream.js';
import { CHIPS, frightOf, readFright } from '../shared/nod/foes.js';
import { add, carry, cross, dist3, dot, flat, flatUnit, len, mul, sub, turn, unit, yawOf } from '../shared/nod/shape.js';

// A roll: how long it takes (ms), how long of it nothing can touch you, how
// fast it goes, and how soon after it the next.
export const ROLL = { ms: 430, safe: 380, speed: 11.5, cool: 260 };
// A slam: how far off it tips things over, and how high you must be for one.
const SLAM = { r: 2.7, high: 0.45 };
// After a blow got you, nothing else does for this long.
const SAFE_MS = 1500;
// A bop this soon before a flashing blow lands (or this soon after it starts)
// turns it: plenty for small hands, not for holding the button down.
const PARRY = { before: 330, after: 170, far: 3.6 };
// Bops count towards nothing for this long after one that clanged, so mashing
// is never the way in.
const CLANG_MS = 420;
// A bop turns back what comes flying within this of you.
const RETURN_R = 2.7;
// Bops land this much further off than an arm; and the longest weapon's.
const REACH_MOST = 3.4;
export const COURAGE = 5;
const INTERP_MS = 120;
const RED = new THREE.Color('#ff3d63');
const GOLD = new THREE.Color('#ffc53d');
const WAVE = new THREE.Color('#ff8fd0');
const FOG = new THREE.Color('#8a4fe0');
const LAMP = new THREE.Color('#ffd9a0');
const KIND_COLOR = { wave: WAVE };
const at3 = (a) => ({ x: a[0], y: a[1], z: a[2] });
const finite = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);

export class Fight {
  constructor(nod) {
    this.nod = nod;
    this.g = nod.g;
    this.scene = nod.g.renderer.scene;
    this.frights = new Map();
    this.acts = new Map();
    this.domes = [];
    this.courage = 0;
    this.rolling = null;
    this.rollAt = -Infinity;
    this.slamming = false;
    this.safeUntil = 0;
    this.hurtAt = -Infinity;
    this.stopUntil = 0;
    this.swingAt = -Infinity;
    this.swungAt = -Infinity;
    this.clangUntil = 0;
    this.facing = 0;
    this.combo = 0;
    this.met = new Set();
    this.seenRows = 0;
    this.soon = 0;
  }

  dispose() {
    for (const f of this.frights.values()) f.model.dispose();
    this.frights.clear();
    for (const a of this.acts.values()) this.endFx(a);
    this.acts.clear();
    for (const d of this.domes) d.dispose();
  }

  get w() {
    return this.nod.w;
  }

  // ------------------------------------------------ the frights

  // Where they all are (room.js stepDream), ten times a second.
  rows(rows) {
    const now = performance.now();
    const seen = new Set();
    for (const raw of Array.isArray(rows) ? rows.slice(0, 80) : []) {
      const s = readFright(raw);
      if (!s) continue;
      seen.add(s.id);
      let f = this.frights.get(s.id);
      if (!f) {
        const spec = frightOf(s.kind);
        const model = makeFright(s.kind);
        this.g.renderer.entities.add(model.group, model.shadow);
        f = { id: s.id, kind: s.kind, spec, model, snaps: [], born: now, x: s.x, y: s.y, z: s.z, up: this.nod.space.up(s.x, s.y, s.z), h: s.h, body: this.nod.space.bodyAt(s.x, s.y, s.z), alt: s.alt, hearts: s.hearts, max: s.max, speed: 0, struckAt: -Infinity, act: null, left: CHIPS };
        this.frights.set(s.id, f);
        model.group.visible = false;
      }
      f.snaps.push({ t: now, x: s.x, y: s.y, z: s.z, h: s.h, alt: s.alt });
      if (f.snaps.length > 8) f.snaps.shift();
      if (s.hearts < f.hearts) f.lostAt = now;
      Object.assign(f, { state: s.state, hearts: s.hearts, max: s.max, open: s.open, more: s.more });
    }
    for (const [id, f] of this.frights) {
      if (seen.has(id) || f.popping) continue;
      this.drop(id);
    }
  }

  drop(id) {
    const f = this.frights.get(id);
    if (!f) return;
    f.model.dispose();
    this.frights.delete(id);
  }

  gone(ids) {
    for (const id of ids) {
      const f = this.frights.get(id);
      if (!f) continue;
      this.g.renderer.effects.puffs?.(f.x, f.y, f.z);
      this.poof(f, 12);
      this.drop(id);
    }
  }

  poof(f, n = 16) {
    const fx = this.g.renderer.effects;
    const c = { x: f.x + f.up.x * (f.alt + f.spec.height / 2), y: f.y + f.up.y * (f.alt + f.spec.height / 2), z: f.z + f.up.z * (f.alt + f.spec.height / 2) };
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      fx.add('puff', c.x, c.y, c.z, { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: (Math.random() - 0.2) * 3, size: 0.3 + Math.random() * 0.3 * f.spec.radius, life: 0.6 + Math.random() * 0.4, drag: 2.5, grow: 0.6, color: i % 3 ? f.model.color : '#8a6fd0' });
    }
  }

  poseFrights(dt, now) {
    const { space, w } = this.nod;
    const t = now - INTERP_MS;
    for (const f of this.frights.values()) {
      const a = f.act && this.acts.get(f.act.a) === f.act ? f.act : null;
      const was = { x: f.x, y: f.y, z: f.z };
      const placed = a ? this.placeInAct(f, a, now) : false;
      if (!placed) {
        const q = this.lerpSnaps(f, t);
        if (q) {
          // (Out of a blow run here, back to where the island says, gently.)
          const k = f.easeUntil > now ? 1 - Math.exp(-dt * 10) : 1;
          f.x += (q.x - f.x) * k;
          f.y += (q.y - f.y) * k;
          f.z += (q.z - f.z) * k;
          f.alt += (q.alt - f.alt) * k;
          f.h = k < 1 ? unit({ x: f.h.x + (q.h.x - f.h.x) * k, y: f.h.y + (q.h.y - f.h.y) * k, z: f.h.z + (q.h.z - f.h.z) * k }) : q.h;
        }
      } else f.easeUntil = now + 300;
      f.body = space.bodyAt(f.x, f.y, f.z, f.body) ?? f.body;
      f.up = f.body.up(f.x, f.y, f.z);
      f.h = flatUnit(f.h, f.up);
      const moved = Math.hypot(f.x - was.x, f.y - was.y, f.z - was.z) / Math.max(dt, 1e-3);
      f.speed += (Math.min(20, moved) - f.speed) * Math.min(1, dt * 10);
      const m = f.model;
      const g = m.group;
      const stop = now < (f.stopUntil ?? 0);
      const shake = stop ? (Math.random() - 0.5) * 0.12 : 0;
      const kick = f.kick && now < f.kick.until ? Math.sin(((f.kick.until - now) / f.kick.ms) * Math.PI) * f.kick.far : 0;
      const kx = kick ? f.kick.x * kick : 0;
      const ky = kick ? f.kick.y * kick : 0;
      const kz = kick ? f.kick.z * kick : 0;
      g.position.set(f.x + f.up.x * f.alt + kx + shake, f.y + f.up.y * f.alt + ky, f.z + f.up.z * f.alt + kz + shake);
      quatOf(f.up, f.h, g.quaternion);
      const under = f.state === 'under' || f.hidden;
      g.visible = !under && dist3(f, w) < 110;
      const wind = a && now < a.strike ? Math.max(0, Math.min(1, 1 - (a.strike - now) / a.ms)) : 0;
      const run = a && now >= a.strike ? Math.min(1, (now - a.strike) / Math.max(1, a.d)) : 0;
      const state = f.open ? 'open' : a ? (now < a.strike ? 'wind' : run < 1 ? 'act' : 'rest') : f.state;
      const come = Math.min(1, (now - f.born) / 700);
      if (g.visible) {
        m.update(stop ? 0 : dt, { state, k: wind, run, kind: a?.k ?? null, look: a?.look ?? null, open: f.open, speed: f.speed, alt: f.alt, come: come < 1 ? 1 - (1 - come) ** 3 + Math.sin(come * Math.PI) * 0.2 : 1, hearts: f.hearts, max: f.max, more: f.more, act: a });
        this.nod.blob(m.shadow, { x: f.x + f.up.x * f.alt, y: f.y + f.up.y * f.alt, z: f.z + f.up.z * f.alt }, f.up, f.body);
      } else m.shadow.visible = false;
      flashModel(g, now - f.struckAt < 120);
      if (f.open && Math.random() < dt * 14) {
        const c = add(f, f.up, f.alt + f.spec.height + 0.25);
        const r = f.spec.radius * 0.8;
        const e = now / 260 + Math.random() * 0.5;
        const side = cross(f.up, f.h);
        this.g.renderer.effects.add('star', c.x + f.h.x * Math.cos(e) * r + side.x * Math.sin(e) * r, c.y + f.h.y * Math.cos(e) * r + side.y * Math.sin(e) * r, c.z + f.h.z * Math.cos(e) * r + side.z * Math.sin(e) * r, { size: 0.24, life: 0.45, color: '#ffe27a', spin: 4 });
      }
    }
  }

  lerpSnaps(f, t) {
    const L = f.snaps;
    if (!L.length) return null;
    let a = L[0];
    if (t <= a.t) return a;
    for (let i = 1; i < L.length; i++) {
      const b = L[i];
      if (b.t >= t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        const m = (u, v) => u + (v - u) * k;
        return { x: m(a.x, b.x), y: m(a.y, b.y), z: m(a.z, b.z), alt: m(a.alt, b.alt), h: unit({ x: m(a.h.x, b.h.x), y: m(a.h.y, b.h.y), z: m(a.h.z, b.h.z) }) };
      }
      a = b;
    }
    return a;
  }

  // While it makes a blow that moves it, a fright is drawn where that blow has
  // it: the same on every page, with no lag to it.
  placeInAct(f, a, now) {
    if (a.k === 'lunge' || a.k === 'charge') {
      if (now < a.strike) {
        if (!finite([a.p.x, a.p.y, a.p.z], 3)) return false;
        const k = Math.min(1, 0.15);
        f.x += (a.p.x - f.x) * k;
        f.y += (a.p.y - f.y) * k;
        f.z += (a.p.z - f.z) * k;
        f.h = a.dir;
        if (a.swoop) f.alt += (2 - f.alt) * 0.05;
        return true;
      }
      if (now > a.strike + a.d + 60 || a.stopped) return false;
      const s = Math.min(a.l, ((now - a.strike) / 1000) * a.s);
      const q = laneAt(a.path, s, a.l);
      Object.assign(f, { x: q.x, y: q.y, z: q.z, h: flatUnit(q.dir, q.up) });
      if (a.swoop) f.alt += (0.35 - f.alt) * 0.25;
      return true;
    }
    if (a.k === 'leap') {
      if (now < a.strike || now > a.strike + a.d + 60) return false;
      const k = Math.min(1, (now - a.strike) / a.d);
      const q = laneAt(a.path, k * a.l, a.l);
      Object.assign(f, { x: q.x, y: q.y, z: q.z, h: flatUnit(q.dir, q.up), alt: Math.sin(k * Math.PI) * a.high });
      return true;
    }
    if (['shot', 'lob', 'out', 'beam'].includes(a.k) && a.dir && now < a.strike + a.d) f.h = flatUnit(a.k === 'beam' && now > a.strike ? turn(a.dir, f.up, a.sweep * Math.min(1, (now - a.strike) / a.d)) : a.dir, f.up);
    return false;
  }

  // ------------------------------------------------ their blows

  // One wound up (shared/nod/foes.js told): drawn from now, landing in ms.
  told(m) {
    if (!Number.isInteger(m.a) || typeof m.k !== 'string' || !Number.isFinite(m.ms)) return;
    const now = performance.now();
    const f = this.frights.get(m.f);
    const a = { a: m.a, f: m.f, k: m.k, ms: m.ms, t0: now, strike: now + m.ms, b: m.b ?? 1, d: m.d ?? 200, p: finite(m.p, 3) ? at3(m.p) : null, dir: finite(m.q, 3) ? at3(m.q) : null, l: m.l ?? 0, w: m.w ?? 0.5, r: m.r ?? 1, s: m.s ?? 8, reach: m.m ?? 20, n: m.n ?? 1, gap: m.g ?? 0, sweep: m.y ?? 0, high: m.h ?? 0, flash: m.flash === 1, back: m.back === 1, seek: Number.isFinite(m.u) ? m.u : 0, swoop: m.swoop === 1, look: m.look ?? null, at: m.at ?? 0, to: Array.isArray(m.to) ? m.to.filter((q) => finite(q, 3)).map(at3) : [], fx: [], passed: new Set(), got: false };
    this.acts.set(m.a, a);
    if (f) f.act = a;
    if (!a.p) return;
    const body = this.nod.space.bodyAt(a.p.x, a.p.y, a.p.z);
    a.body = body;
    a.up = body.up(a.p.x, a.p.y, a.p.z);
    if (a.dir) a.dir = flatUnit(a.dir, a.up);
    if (a.k === 'lunge' || a.k === 'charge') {
      a.path = pathOf(body, a.p, a.dir, a.l, a.to[0]);
      if (a.l > 1.2) a.mark = new LaneMark(this.scene, a.path, a.w + 0.12, a.l, { color: a.flash ? '#ff9a3d' : '#ff3d63', bonk: Boolean(frightOf(f?.kind).bonk) && a.k === 'charge' });
    } else if (a.k === 'leap') a.path = a.to[1] ? aimedPath(body, a.p, a.to[1], a.l) : lanePath(body, a.p, a.dir, a.l);
    else if (a.k === 'out') {
      a.path = lanePath(body, a.p, a.dir, a.l);
      a.mark = new LaneMark(this.scene, a.path, a.w + 0.12, a.l);
    } else if (a.k === 'shot') {
      a.shots = (a.to.length ? a.to : [null]).map((q) => ({ path: pathOf(body, a.p, a.dir, a.l, q), mesh: null, over: false }));
      if (f) f.h = flatUnit(a.dir, f.up);
    } else if (a.k === 'beam') {
      a.beam = new Beam(this.scene, a.w + 0.15, { color: a.look === 'dark' ? '#b05cff' : '#ff5c8a' });
    } else if (a.k === 'lob') {
      a.shots = a.to.map((q) => ({ to: q, mesh: null, over: false, up: this.nod.space.up(q.x, q.y, q.z) }));
    }
    if (f && dist3(f, this.w) < 26) {
      this.g.sound.play('grumble', { big: frightOf(f.kind).big });
      this.meet(f);
    }
  }

  // The first of a kind you have met: what to do about it.
  meet(f) {
    if (this.met.has(f.kind) || !f.spec.told) return;
    this.met.add(f.kind);
    // (Whose soul it is has been told of already: tale.)
    if (f.spec.boss && this.g.adventure?.duel) return;
    this.g.emit('toast', { icon: f.spec.icon, text: f.spec.told });
  }

  runActs(dt, now) {
    const me = this.w;
    const mid = add(me, me.up, 0.75);
    for (const [id, a] of this.acts) {
      const f = this.frights.get(a.f);
      const before = a.strike - now;
      const k = Math.max(0, Math.min(1, 1 - before / a.ms));
      a.mark?.update(k, now / 1000);
      if (a.mark && now > a.strike + (a.k === 'out' ? a.d : Math.min(a.d, 500)) + 150) {
        a.mark.dispose();
        a.mark = null;
      }
      // The flash just before: bop now!
      if (a.flash && !a.glinted && before < PARRY.before && f && !(a.k === 'charge' && a.l > 5)) this.glint(a, f);
      let end = a.strike + a.d + 400;
      if (a.k === 'wave') end = a.strike + (a.n - 1) * a.gap + (a.reach / a.s) * 1000 + 100;
      else if (a.k === 'shot') end = a.strike + (a.l / a.s) * 1000 + 100;
      if (now > end || (!f && !['shot', 'wave', 'lob'].includes(a.k) && now > a.strike)) {
        this.endFx(a);
        this.acts.delete(id);
        if (f?.act === a) f.act = null;
        continue;
      }
      if (a.over) continue;
      if (now < a.strike) {
        if (a.k === 'shot' && f && k > 0.2 && Math.random() < dt * 30) {
          const c = add(add(f, f.up, f.alt + f.spec.height * 0.5), f.h, f.spec.radius + 0.3);
          this.g.renderer.effects.add('sparkle', c.x, c.y, c.z, { size: 0.3 * k + 0.1, life: 0.3, color: '#d9c8ff' });
        }
        continue;
      }
      switch (a.k) {
        case 'lunge':
        case 'charge': {
          if (!f || a.stopped || now > a.strike + a.d + 40) break;
          this.test(a, f, (p) => {
            const d = sub(p, f);
            const high = dot(d, f.up) - f.alt;
            return len(flat(d, f.up)) < a.w + 0.32 && high < f.spec.height * 0.8 && high > -1.2;
          }, () => f.h);
          // (A long one flashes as it gets to you, not as it sets off.)
          if (a.flash && a.k === 'charge' && !a.glinted && dist3(f, me) - f.spec.radius < a.s * 0.34 && dot(sub(me, f), f.h) > 0) this.glint(a, f);
          if (f.spec.big && Math.random() < dt * 40) this.g.renderer.effects.dust(f.x, f.y, f.z);
          break;
        }
        case 'burst':
          if (!a.burst) {
            a.burst = true;
            this.boom(a.p, a.up, a.r, RED);
            if (this.thisSide(a.up)) this.test(a, f, (p, alt) => dist3(p, a.p) < a.r + 0.25 && alt < 2.2, (p) => flatUnit(sub(p, a.p), me.up));
          }
          break;
        case 'wave':
          for (let i = 0; i < a.n; i++) {
            const t = now - a.strike - i * a.gap;
            if (t < 0 || a.passed.has(i)) continue;
            if (!a.fx[i]) {
              a.fx[i] = true;
              this.g.sound.play('nod-ring');
              this.g.renderer.shake(dist3(me, a.p) < 14 ? 0.12 : 0.04);
            }
            const R = waveR(t, a.s);
            const d = dist3(me, a.p);
            if (R > d + a.w) a.passed.add(i);
            if (Math.abs(d - R) < a.w * 0.5 + 0.1 && this.alt() < 0.5 && me.body === a.body) {
              a.passed.add(i);
              this.strikesMe(a, f, flatUnit(sub(me, a.p), me.up), true);
            }
          }
          break;
        case 'spots':
          if (!a.burst) {
            a.burst = true;
            for (const q of a.to) {
              const up = this.nod.space.up(q.x, q.y, q.z);
              this.boom(q, up, a.r, RED);
              if (this.thisSide(up)) this.test(a, f, (p, alt) => dist3(p, q) < a.r + 0.2 && alt < 1.6, (p) => flatUnit(sub(p, q), me.up));
            }
          }
          break;
        case 'shot':
          this.flyShots(a, f, dt, now, mid);
          break;
        case 'lob':
          this.flyLobs(a, f, dt, now);
          break;
        case 'leap':
          if (!a.burst && now >= a.strike + a.d) {
            a.burst = true;
            const q = a.to[0] ?? a.p;
            const up = a.body.up(q.x, q.y, q.z);
            this.boom(q, up, a.r, RED, f?.spec.big);
            if (this.thisSide(up)) this.test(a, f, (p, alt) => dist3(p, q) < a.r + 0.2 && alt < 1.1, (p) => flatUnit(sub(p, q), me.up));
          }
          break;
        case 'dive':
          if (!a.burst) {
            a.burst = true;
            const q = a.to[0] ?? a.p;
            const up = a.body.up(q.x, q.y, q.z);
            this.boom(q, up, a.r * 0.8, RED);
            if (this.thisSide(up)) this.test(a, f, (p, alt) => dist3(p, q) < a.r + 0.2 && alt < 1.2, () => me.up);
          }
          break;
        case 'out': {
          if (now > a.strike + a.d + 120) break;
          this.test(a, f, (p, alt) => offPath(a.path, p) < a.w + 0.32 && alt < 1.4, () => a.dir);
          break;
        }
        case 'beam': {
          const kb = (now - a.strike) / a.d;
          if (kb > 1) break;
          const path = beamPath(a.body, a, kb);
          a.beam?.lay(path, 0.5, now / 1000, Math.min(1, kb * 12, (1 - kb) * 12));
          if (offPath(path, me) < a.w + 0.25 && this.alt() < 0.75 && me.body === a.body) this.strikesMe(a, f, me.up, true);
          break;
        }
        default:
          break;
      }
    }
  }

  // The flash of a blow that can be bopped back, just before it lands.
  glint(a, f) {
    a.glinted = true;
    const c = add(add(f, f.up, f.alt + f.spec.height * 0.75), f.h, f.spec.radius + 0.2);
    this.g.renderer.effects.add('sparkle', c.x, c.y, c.z, { size: f.spec.big ? 2.6 : 1.5, life: 0.34, color: '#fff6c0', spin: 5, over: true });
    this.g.renderer.effects.add('star', c.x, c.y, c.z, { size: f.spec.big ? 1.6 : 0.9, life: 0.3, color: '#ffd23d', spin: -4, over: true });
    if (dist3(f, this.w) < 16) this.g.sound.play('nod-glint');
  }

  // Whether up there is anything like up here: not right through a record, or a
  // clock's face, on the other side of it.
  thisSide(up) {
    return dot(this.w.up, up) > -0.2;
  }

  // How high over the ground you are.
  alt() {
    const w = this.w;
    return w.onGround ? 0 : Math.max(0, w.body.ground(w.x, w.y, w.z));
  }

  flyShots(a, f, dt, now, mid) {
    const s = ((now - a.strike) / 1000) * a.s;
    a.shots.forEach((shot, i) => {
      if (shot.over) return;
      if (s >= a.l) {
        this.shotOver(shot);
        return;
      }
      shot.mesh ??= new Shot(this.scene, a.look ?? 'dust', a.r);
      const q = a.seek ? this.seekOn(a, shot, s) : laneAt(shot.path, s, a.l);
      const high = 0.85 + Math.max(0, a.high - 0.4) * Math.max(0, 1 - s / 5);
      shot.at = add(q, q.up, high);
      shot.mesh.put(shot.at, dt);
      if (Math.random() < dt * 26) this.g.renderer.effects.add('puff', shot.at.x, shot.at.y, shot.at.z, { size: 0.2, life: 0.4, grow: 0.3, color: '#b9a8ea' });
      // Into something solid.
      if (s > 1.2 && q.body !== null && a.body.clutter(shot.at.x, shot.at.y, shot.at.z) < 0.05) {
        this.shotOver(shot);
        return;
      }
      // Bopped back, in the moment of a swing.
      if (a.back && now - this.swingAt < 230 && dist3(shot.at, mid) < RETURN_R && dot(sub(shot.at, mid), this.nod.h) > -0.6) {
        this.turnBack(a, i, shot, f);
        return;
      }
      if (dist3(shot.at, mid) < a.r + 0.5) {
        const was = a.got;
        this.strikesMe(a, f, flatUnit(sub(mid, shot.at), this.w.up), true);
        if (!this.rollSafe(now) || was !== a.got) this.shotOver(shot);
      }
    });
  }

  // Something thrown that bends round after whoever it was thrown at, s along
  // its way: as it goes on each page, which is judged only by whoever that is.
  seekOn(a, shot, s) {
    const q = (shot.q ??= { ...a.p, up: a.up, dir: flatUnit(shot.path[0].dir, a.up), s: 0 });
    const step = Math.max(0, s - q.s);
    q.s = s;
    const who = this.g.players.get(a.at);
    const t = a.at === this.g.pid ? this.w : who?.avatar?.root.position;
    if (t) {
      const want = flatUnit(sub(t, q), q.up);
      const c = Math.max(-1, Math.min(1, dot(q.dir, want)));
      // (Gone by, it has lost them.)
      if (c > -0.1) q.dir = turn(q.dir, q.up, (dot(cross(q.dir, want), q.up) >= 0 ? 1 : -1) * Math.min(Math.acos(c), (a.seek * step) / a.s));
    }
    const to = a.body.land(add(q, q.dir, step), 5);
    const up = a.body.up(to.x, to.y, to.z);
    Object.assign(q, { x: to.x, y: to.y, z: to.z, dir: flatUnit(carry(q.dir, q.up, up), up), up });
    return q;
  }

  shotOver(shot, quiet = false) {
    if (shot.over) return;
    shot.over = true;
    if (shot.mesh && shot.at && !quiet) for (let i = 0; i < 6; i++) this.g.renderer.effects.add('puff', shot.at.x, shot.at.y, shot.at.z, { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, size: 0.25, life: 0.4, color: '#cdbff0' });
    shot.mesh?.dispose();
    shot.mesh = null;
  }

  // Something thrown, bopped: back it goes at whoever threw it.
  turnBack(a, i, shot, f) {
    const from = shot.at;
    this.shotOver(shot, true);
    this.g.send({ t: 'nod', op: 'back', a: a.a, i });
    this.braver(0.5);
    this.flyBack(from, f, a.look ?? 'dust', a.r);
    this.g.sound.play('nod-ping');
    this.g.renderer.effects.impact(from.x, from.y, from.z, this.nod.h.x, this.nod.h.z, '#ffe27a', 1.2);
    this.g.renderer.jolt(this.nod.h.x, this.nod.h.z, { kick: 0.014, roll: 0.01, zoom: 0.015 });
    this.word(from, 'RIGHT BACK!', '#ffd84d');
    this.stop(70);
  }

  // A thing flying back at f, from a point.
  flyBack(from, f, look, r) {
    if (!f) return;
    const shot = new Shot(this.scene, look, r);
    const t0 = performance.now();
    const ms = Math.max(120, dist3(from, f) * 45);
    this.domes.push({
      update: (dt) => {
        const k = (performance.now() - t0) / ms;
        const to = add(f, f.up, f.alt + f.spec.height * 0.5);
        if (k >= 1 || !this.frights.has(f.id)) {
          shot.dispose();
          if (this.frights.has(f.id)) {
            this.g.renderer.effects.impact(to.x, to.y, to.z, 0, 0, '#ffffff', 1.4);
            f.struckAt = performance.now();
            f.model.squash = 0.6;
            this.g.sound.play('whack', { kind: 'hammer' });
          }
          return false;
        }
        const up = f.up;
        const arc = Math.sin(k * Math.PI) * 0.8;
        shot.put({ x: from.x + (to.x - from.x) * k + up.x * arc, y: from.y + (to.y - from.y) * k + up.y * arc, z: from.z + (to.z - from.z) * k + up.z * arc }, dt);
        return true;
      },
      dispose: () => shot.dispose(),
    });
  }

  flyLobs(a, f, dt, now) {
    const k = (now - a.strike) / a.d;
    a.shots.forEach((shot) => {
      if (shot.over) return;
      if (k >= 1) {
        this.shotOver(shot, true);
        this.boom(shot.to, shot.up, a.r, RED);
        if (this.thisSide(shot.up)) this.test(a, f, (p, alt) => dist3(p, shot.to) < a.r + 0.2 && alt < 1.6, (p) => flatUnit(sub(p, shot.to), this.w.up));
        return;
      }
      shot.mesh ??= new Shot(this.scene, a.look ?? 'dust', 0.42);
      const from = add(a.p, a.up, 1.2);
      const up = unit(add(a.up, shot.up));
      const h = Math.sin(k * Math.PI) * a.high;
      shot.at = { x: from.x + (shot.to.x - from.x) * k + up.x * h, y: from.y + (shot.to.y - from.y) * k + up.y * h, z: from.z + (shot.to.z - from.z) * k + up.z * h };
      shot.mesh.put(shot.at, dt);
    });
  }

  boom(p, up, r, color, big = false) {
    const fx = this.g.renderer.effects;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const side = turn(flatUnit({ x: 0.3, y: 0.2, z: 0.9 }, up), up, a);
      fx.add('puff', p.x + side.x * r * 0.6, p.y + side.y * r * 0.6, p.z + side.z * r * 0.6, { size: 0.4, life: 0.6, grow: 1.2, color: i % 2 ? '#e9dcff' : '#b9a0e6', vy: 1.2 });
    }
    const near = dist3(p, this.w);
    if (near < 20) {
      this.g.sound.play('boom', { near: Math.max(0.15, 1 - near / 20) * (big ? 1 : 0.6) });
      this.g.renderer.shake(Math.max(0, 0.3 - near * 0.012) * (big ? 1.4 : 1));
    }
  }

  endFx(a) {
    a.mark?.dispose();
    a.beam?.dispose();
    for (const s of a.shots ?? []) this.shotOver(s, true);
    a.mark = null;
    a.beam = null;
  }

  // Whether a blow gets you, hits(p, alt) being whether it would anyone at p, alt
  // over the ground: you as you are — or, rolling, you as you were when you set
  // off: clear of it in the very nick of time.
  test(a, f, hits, way, many = false) {
    const now = performance.now();
    if (hits(this.w, this.alt())) this.strikesMe(a, f, way(this.w), many);
    else if (this.rollSafe(now) && this.rollFrom && !a.dodged && !a.got && hits(this.rollFrom, 0)) {
      a.dodged = true;
      this.g.send({ t: 'nod', op: 'dodge', a: a.a });
      this.dodged(f);
    }
  }

  // A blow at you: clear of it (rolling, in the very nick of time), or it gets
  // you. many: it may come round again (a wave, a beam, one of a fan).
  strikesMe(a, f, way, many = false) {
    const now = performance.now();
    if (a.got || this.g.dizzy || this.nod.flight || this.g.watching || this.g.adventure?.won) return;
    if (this.rollSafe(now)) {
      if (a.dodged && !many) return;
      if (!a.dodged) {
        a.dodged = true;
        this.g.send({ t: 'nod', op: 'dodge', a: a.a });
        this.dodged(f);
      }
      return;
    }
    if (now < this.safeUntil) return;
    if (a.dodged && !many) return;
    a.got = true;
    this.safeUntil = now + SAFE_MS;
    this.hurtAt = now;
    this.g.send({ t: 'nod', op: 'hurt', a: a.a });
    this.ouch(way, a.b, f);
  }

  rollSafe(now) {
    return now - this.rollAt < ROLL.safe;
  }

  // Knocked back by a blow, at once.
  ouch(way, b, f) {
    const w = this.w;
    const hard = 6 + b * 3;
    const v = add(mul(flatUnit(way, w.up), hard), w.up, 5);
    Object.assign(w, { vx: v.x, vy: v.y, vz: v.z, onGround: false });
    this.rolling = null;
    this.slamming = false;
    this.courage = Math.max(0, this.courage - 1);
    this.combo = 0;
    this.g.sound.play('nod-hurt');
    this.g.renderer.jolt(way.x, way.z, { kick: 0.03, roll: 0.03, zoom: 0.02 });
    this.g.renderer.effects.impact(w.x + w.up.x * 0.8, w.y + w.up.y * 0.8, w.z + w.up.z * 0.8, 0, 0, '#ff7a8f', 1);
    this.g.buzz(60);
    const a = this.g.players.get(this.g.pid)?.avatar;
    if (a) a.hurtAt = performance.now();
    this.g.emit('hp');
  }

  // Out of its way at the very last moment.
  dodged(f) {
    this.braver(1);
    const w = this.w;
    const c = add(w, w.up, 0.8);
    this.word(add(w, w.up, 1.2), ['JUST IN TIME!', 'TOO SLOW!', 'MISSED ME!'][Math.floor(Math.random() * 3)], '#9fe8ff');
    this.g.sound.play('nod-dodge');
    this.g.renderer.effects.sparkles(c.x, c.y, c.z, 14, ['#9fe8ff', '#ffffff', '#cfd6ff']);
    this.g.renderer.jolt(0, 0, { zoom: 0.03 });
    this.domes.push(new BurstDome(this.scene, c, 1.8, '#9fe8ff', 380));
    this.stop(90);
  }

  // ------------------------------------------------ what you do

  get heavy() {
    return performance.now() < this.clangUntil - CLANG_MS * 0.45;
  }

  // Everything stops dead for a moment, as a blow lands.
  hitStop(dt) {
    return performance.now() < this.stopUntil ? 0 : dt;
  }

  stop(ms = 0) {
    if (ms) this.stopUntil = Math.max(this.stopUntil, performance.now() + ms);
    else {
      this.rolling = null;
      this.slamming = false;
    }
  }

  // A roll, the way you are going (or facing).
  roll(dirIn = null) {
    const g = this.g;
    const now = performance.now();
    if (g.dizzy || this.nod.flight || g.watching || this.slamming) return false;
    if (now - this.rollAt < ROLL.ms + ROLL.cool) {
      this.rollSoon = now + 160;
      return false;
    }
    const w = this.w;
    const v = flat({ x: w.vx, y: w.vy, z: w.vz }, w.up);
    const dir = dirIn ?? (len(v) > 1 ? unit(v) : this.nod.h);
    this.rolling = { ...dir, speed: ROLL.speed };
    this.rollAt = now;
    this.rollFrom = { x: w.x, y: w.y, z: w.z };
    this.rollSoon = 0;
    this.nod.h = flatUnit(dir, w.up);
    g.sound.play('nod-roll');
    g.renderer.effects.dust(w.x, w.y, w.z);
    g.send({ t: 'nod', op: 'roll', y: yawOf(this.nod.h, w.up) });
    return true;
  }

  // The roll as the walker has it (walker.js dash), while it lasts.
  dash(now) {
    if (!this.rolling) return null;
    const t = now - this.rollAt;
    if (t > ROLL.ms) {
      this.rolling = null;
      return null;
    }
    this.rolling.speed = ROLL.speed * (t < ROLL.ms * 0.6 ? 1 : 1 - ((t - ROLL.ms * 0.6) / (ROLL.ms * 0.4)) * 0.6);
    return this.rolling;
  }

  // How far through a roll you are, for how you are drawn (0: not).
  tumble() {
    if (!this.rolling) return 0;
    return Math.max(0.001, Math.min(1, (performance.now() - this.rollAt) / ROLL.ms));
  }

  // The bop button: a swing — or, up in the air, a slam.
  attack() {
    const g = this.g;
    const now = performance.now();
    if (g.dizzy || this.nod.flight || g.watching) return null;
    // (Hammering away at it is no way to turn a blow: that takes a bop kept for
    // the moment.)
    const kept = now - (this.pressAt ?? -Infinity) > 520;
    this.pressAt = now;
    if (this.rolling && now - this.rollAt < ROLL.ms * 0.55) return null;
    const friend = this.dizzyFriend();
    if (friend) {
      g.send({ t: 'help', pid: friend.id });
      return null;
    }
    const w = this.w;
    if (!w.onGround && this.alt() > SLAM.high) {
      this.slam();
      return null;
    }
    const weapon = wornWeapon(g.profile.data.gear);
    const swing = swingOf(weapon?.key);
    if (now < this.swungAt) {
      this.soon = now + 180;
      return null;
    }
    this.soon = 0;
    this.swungAt = now + Math.min(420, swing.secs * 1000);
    this.swingAt = now;
    // Face whoever is nearest in front (or right by you).
    const reach = this.reach(weapon);
    const aim = this.inReach(reach + 1.2, -0.2)[0] ?? null;
    if (aim) this.nod.h = flatUnit(sub(aim.f, w), w.up);
    this.rolling = null;
    // Turned right back on it, if it was just about to land.
    const parry = kept && this.parry(now);
    const avatar = g.players.get(g.pid)?.avatar;
    const lands = Math.min(0.16, avatar?.swing() ?? 0.1);
    g.send({ t: 'swing' });
    g.sound.play('swish', { lands });
    const look = slashFor(weapon);
    const world = g.world;
    setTimeout(() => {
      if (g.world !== world || g.nod !== this.nod) return;
      const up = w.up;
      const c = add(w, up, 0.95);
      const q = quatOf(up, this.nod.h);
      const round = Boolean(weapon?.spin || weapon?.round);
      g.renderer.effects.slash(c.x, c.y, c.z, 0, { reach: reach + 0.3, color: look, quat: q, ...(round ? { from: -3.2, to: 3.2 } : {}) });
      // (A soul weapon strikes with all its light here too, and no further for it.)
      if (weapon?.soul && avatar) g.soulSwingFrom(avatar, true, 0.5);
      if (parry) return;
      this.land(this.inReach(reach, round ? -1 : weapon?.soul ? weapon.arc : -0.17), weapon);
    }, lands * 1000);
    return aim?.f.id ?? null;
  }

  // How far a bop reaches here: a weapon of great reach a little further than
  // an arm, no more (in a dream nothing is as long as it looks).
  reach(weapon) {
    return Math.min(REACH_MOST, ARM_REACH + 0.5 + (weapon?.reach ?? 0) * 0.45);
  }

  // The frights within reach of you and in front (round to cos), nearest first.
  inReach(reach, cos) {
    const w = this.w;
    const out = [];
    for (const f of this.frights.values()) {
      // (Nor one on the other side of what you stand on, thin as that may be.)
      if (f.hidden || f.state === 'under' || f.popping || !this.thisSide(f.up)) continue;
      const d = sub(f, w);
      const high = dot(d, w.up) + f.alt;
      if (high > 2 || high + f.spec.height < -0.7) continue;
      const along = flat(d, w.up);
      const l = len(along);
      const gap = l - f.spec.radius - 0.3;
      if (gap > reach) continue;
      if (gap > 0.35 && l > 1e-3 && dot(along, this.nod.h) / l < cos) continue;
      out.push({ f, gap, way: l > 1e-3 ? mul(along, 1 / l) : this.nod.h });
    }
    return out.sort((a, b) => a.gap - b.gap);
  }

  // A swing landing on what it reached: told, and felt at once.
  land(hits, weapon) {
    if (!hits.length) return;
    const now = performance.now();
    const w = this.w;
    const g = this.g;
    let clang = null;
    let first = null;
    const ids = [];
    for (const h of hits) {
      const { f } = h;
      ids.push(f.id);
      if (this.bare(f)) {
        first ??= h;
        f.struckAt = now;
        f.stopUntil = now + 70;
        f.model.squash = Math.max(f.model.squash, 0.5);
        if (!f.spec.big) f.kick = { ...h.way, far: 0.35, ms: 180, until: now + 180 };
        const c = add(add(f, f.up, f.alt + f.spec.height * 0.5), h.way, -f.spec.radius * 0.7);
        g.renderer.effects.impact(c.x, c.y, c.z, h.way.x, h.way.z, slashFor(weapon), 1);
      } else clang ??= h;
    }
    g.send({ t: 'nod', op: 'bop', ids });
    if (first) {
      this.combo = now - (this.comboAt ?? -Infinity) < 1100 ? this.combo + 1 : 1;
      this.comboAt = now;
      this.stop(Math.min(90, 45 + this.combo * 8));
      g.renderer.jolt(first.way.x, first.way.z, { kick: 0.012, roll: 0.008, zoom: 0.01 });
      g.sound.play('whack', { kind: weapon?.key ?? 'punch', chain: this.combo });
      g.buzz(16);
    } else if (clang) this.clang(clang, now);
  }

  // Off its guard, with a clang: no good, and a moment lost.
  clang(h, now) {
    const { f } = h;
    const w = this.w;
    const c = add(add(f, f.up, f.alt + f.spec.height * 0.5), h.way, -f.spec.radius);
    this.g.sound.play('nod-clang');
    this.g.renderer.effects.impact(c.x, c.y, c.z, h.way.x, h.way.z, '#cfd6e6', 0.8);
    this.clangUntil = now + CLANG_MS;
    this.swungAt = Math.max(this.swungAt, now + CLANG_MS);
    const v = add(mul(h.way, -4.5), w.up, 0);
    Object.assign(w, { vx: w.vx + v.x, vy: w.vy + v.y, vz: w.vz + v.z });
    f.model.squash = Math.max(f.model.squash, 0.12);
    this.meet(f);
    this.clangs = (this.clangs ?? 0) + 1;
    if (this.clangs % 4 === 0 && f.spec.told) this.g.emit('toast', { icon: f.spec.icon, text: f.spec.told });
  }

  // Whether a bop from here gets past one's guard.
  bare(f) {
    if (f.spec.part) return f.more?.[0] === 1;
    // (Open or not, nothing of its own gets hurt: Old Tock, and Old Munch's head till
    // it is all there is of him.)
    if (f.spec.shell) return f.softNow === true;
    if (f.softNow !== undefined) return f.softNow;
    if (f.open || f.spec.guard === 'none') return true;
    if (f.spec.guard === 'front' && f.state === 'rest') return dot(f.h, flatUnit(sub(this.w, f), f.up)) < -0.35;
    return false;
  }

  // A blow about to land on you, flashing: turned by this very bop. Whether it was.
  parry(now) {
    const w = this.w;
    for (const a of this.acts.values()) {
      if (!a.flash || a.over || a.got || a.dodged) continue;
      const f = this.frights.get(a.f);
      if (!f) continue;
      const d = sub(f, w);
      const gap = len(flat(d, w.up)) - f.spec.radius;
      // (A short one, about when it sets off; a long one, as it gets to you.)
      if (a.k === 'charge' && a.l > 5) {
        if (now < a.strike - 80 || now > a.strike + a.d || gap > a.s * 0.3 + 0.4 || dot(sub(w, f), f.h) < -0.6) continue;
      } else if (now < a.strike - PARRY.before || now > a.strike + Math.min(a.d, PARRY.after) || gap > PARRY.far + (a.l > 5 ? 2.5 : 0)) continue;
      // (Coming at you, not at someone else across the way.)
      if (a.at !== this.g.pid && offPath(a.path ?? [f, add(f, f.h, 3)].map((q) => ({ ...q })), w) > a.w + 0.8) continue;
      a.over = true;
      a.stopped = true;
      this.nod.h = flatUnit(d, w.up);
      this.g.send({ t: 'nod', op: 'parry', a: a.a });
      this.braver(1);
      const c = add(add(w, w.up, 1), this.nod.h, 0.8);
      this.g.sound.play('nod-ping', { big: true });
      this.g.renderer.effects.impact(c.x, c.y, c.z, this.nod.h.x, this.nod.h.z, '#ffe27a', 1.6);
      this.domes.push(new BurstDome(this.scene, c, 2.2, '#ffe27a', 420));
      this.g.renderer.jolt(this.nod.h.x, this.nod.h.z, { kick: 0.02, roll: 0.02, zoom: 0.03 });
      this.word(add(w, w.up, 1.4), ['BOPPED BACK!', 'NOT TODAY!', 'CLANG!'][Math.floor(Math.random() * 3)], '#ffd84d');
      this.stop(120);
      f.struckAt = now;
      return true;
    }
    return false;
  }

  // Up in the air: down with a slam.
  slam() {
    if (this.slamming) return;
    this.slamming = true;
    this.g.sound.play('swish', { lands: 0.1 });
    this.g.players.get(this.g.pid)?.avatar?.swing();
    this.g.send({ t: 'swing' });
  }

  // Landed (speed: how hard).
  landed() {
    if (!this.slamming) return;
    this.slamming = false;
    const w = this.w;
    const g = this.g;
    g.sound.play('nod-slam');
    g.renderer.shake(0.16);
    g.renderer.effects.boing(w.x, w.y, w.z, false);
    this.rings ??= [];
    this.rings.push({ x: w.x, y: w.y, z: w.z, t0: performance.now(), r: SLAM.r, ms: 300, color: GOLD });
    g.send({ t: 'nod', op: 'slam' });
    const now = performance.now();
    for (const f of this.frights.values()) {
      if (dist3(f, w) - f.spec.radius > SLAM.r || f.alt > 1.6 || f.popping || !this.thisSide(f.up)) continue;
      f.model.squash = 0.6;
      f.stopUntil = now + 80;
      if (f.spec.slam && !f.open) this.braver(0.5);
      else if (this.bare(f)) f.struckAt = now;
    }
    g.buzz(24);
  }

  // Braver: one more (or so) towards a Brave Burst.
  braver(n) {
    const was = this.courage;
    this.courage = Math.min(COURAGE, this.courage + n);
    if (this.courage === COURAGE && was < COURAGE) {
      this.g.sound.play('nod-ready');
      this.nod.tellOnce('burst', 40000, '✨', `You are as brave as can be! ${this.g.touch ? 'Tap ✨' : 'Press V'} for a Brave Burst: every fright round you is stunned.`);
    }
    this.g.emit('hp');
  }

  // A Brave Burst: every fright round you stunned, and those with no guard gone.
  burst() {
    const g = this.g;
    if (this.courage < COURAGE || g.dizzy || this.nod.flight || g.watching) return false;
    this.courage = 0;
    g.send({ t: 'nod', op: 'burst' });
    this.burstFx(this.w, g.players.get(g.pid));
    this.safeUntil = Math.max(this.safeUntil, performance.now() + 900);
    g.emit('hp');
    return true;
  }

  burstFx(p, who) {
    const g = this.g;
    const up = who?.nodUp ?? this.w.up;
    const c = add(p, up, 0.9);
    this.domes.push(new BurstDome(this.scene, c, BURST_R, '#ffe27a', 720), new BurstDome(this.scene, c, BURST_R * 0.7, '#ff9fd0', 560));
    g.sound.play('nod-burst');
    g.renderer.shake(0.3);
    g.renderer.effects.sparkles(c.x, c.y, c.z, 40, ['#ffe27a', '#ffffff', '#ff9fd0', '#9fe8ff']);
    this.rings ??= [];
    this.rings.push({ x: p.x, y: p.y, z: p.z, t0: performance.now(), r: BURST_R, ms: 520, color: GOLD });
    this.word(add(p, up, 2), 'BRAVE BURST!', '#ffd84d', true);
  }

  // A friend sitting dizzy within reach, to be helped up.
  dizzyFriend() {
    for (const p of this.g.players.values()) {
      if (p.me || !p.dizzy || !p.avatar) continue;
      if (dist3(p.avatar.root.position, this.w) < 2.6) return p;
    }
    return null;
  }

  word(at, text, color, big = false) {
    this.g.emit('hit-word', { x: at.x, y: at.y, z: at.z, top: 0, text, color, big, chain: 1, up: this.w.up });
  }

  // ------------------------------------------------ what the island says

  news(m) {
    const f = this.frights.get(m.f);
    const g = this.g;
    const mine = m.pid === g.pid;
    switch (m.k) {
      case 'hit':
        for (const r of Array.isArray(m.r) ? m.r : []) {
          const e = this.frights.get(r.f);
          if (!e) continue;
          const now = performance.now();
          if (r.clang) {
            if (!mine && dist3(e, this.w) < 24) g.sound.play('nod-clang');
            continue;
          }
          e.left = r.l ?? CHIPS;
          if (!mine) {
            e.struckAt = now;
            e.model.squash = 0.45;
          }
          if (r.broke) {
            e.open = null;
            e.lostAt = now;
            e.model.squash = 0.7;
            const c = add(e, e.up, e.alt + e.spec.height * 0.6);
            g.renderer.effects.hearts(c.x, c.y, c.z, 3);
            g.renderer.effects.impact(c.x, c.y, c.z, 0, 0, '#ffd84d', 2);
            if (dist3(e, this.w) < 30) g.sound.play('whack', { kind: 'hammer', final: true });
            if (mine) {
              this.braver(0.5);
              this.stop(110);
              this.word(c, 'OUCH!', '#ffd84d', true);
            }
          }
        }
        break;
      case 'pop':
        this.popped(m, mine);
        break;
      case 'open':
        if (f) {
          f.open = m.how;
          f.model.squash = 0.5;
          const a = f.act;
          if (a) {
            a.over = a.k === 'lunge' || a.k === 'charge' || a.k === 'leap' ? true : a.over;
            a.stopped = true;
            a.mark?.dispose();
            a.mark = null;
          }
          f.easeUntil = performance.now() + 300;
          if (dist3(f, this.w) < 30) g.sound.play('nod-dazed');
          const c = add(f, f.up, f.alt + f.spec.height);
          g.renderer.effects.stars(c.x, c.y, c.z, 6);
        }
        break;
      case 'ouch':
        if (f) {
          f.model.squash = 0.6;
          f.struckAt = performance.now();
          this.g.sound.play('nod-bonk');
          this.g.renderer.shake(0.3);
          this.word(add(f, f.up, f.spec.height + 0.4), 'OW! OW! OW!', '#ffd84d', true);
        }
        break;
      case 'bare':
        if (f) f.softNow = true;
        break;
      case 'bonk':
        if (f && finite(m.p, 3)) {
          const p = at3(m.p);
          g.renderer.effects.dust(p.x, p.y, p.z);
          if (dist3(p, this.w) < 34) {
            g.sound.play('nod-bonk');
            g.renderer.shake(f.spec.big ? 0.5 : 0.18);
          }
          this.word(add(f, f.up, f.spec.height), 'BONK!', '#ffd84d', f.spec.big);
        }
        break;
      case 'back': {
        const a = this.acts.get(m.a);
        const shot = a?.shots?.[m.i];
        if (!mine && shot && !shot.over) {
          const from = shot.at ?? a.p;
          this.shotOver(shot, true);
          this.flyBack(from, f, a.look ?? 'dust', a.r);
        }
        break;
      }
      case 'parry': {
        const a = this.acts.get(m.a);
        if (a && !mine) {
          a.over = true;
          a.stopped = true;
        }
        break;
      }
      case 'roll': {
        const p = g.players.get(m.pid);
        if (p) {
          p.rolledAt = performance.now();
          if (p.avatar && dist3(p.avatar.root.position, this.w) < 24) g.sound.play('nod-roll', { far: true });
        }
        break;
      }
      case 'slam':
        if (finite(m.p, 3) && !mine) {
          const p = at3(m.p);
          this.rings ??= [];
          this.rings.push({ ...p, t0: performance.now(), r: SLAM.r, ms: 300, color: GOLD });
          if (dist3(p, this.w) < 24) g.sound.play('nod-slam');
        }
        break;
      case 'burst':
        if (!mine && finite(m.p, 3)) this.burstFx(at3(m.p), g.players.get(m.pid));
        break;
      case 'fling':
        this.nod.view.springs.get(m.s)?.fling();
        break;
      case 'wink':
        this.nod.winkNews(m);
        break;
      case 'chests':
        this.nod.chests.rows(m.c);
        break;
      case 'chest':
        this.nod.chests.opened(m);
        break;
      case 'gone':
        this.gone(Array.isArray(m.ids) ? m.ids : []);
        break;
      case 'wake':
      case 'wave':
      case 'quiet':
      case 'boss':
      case 'bosscomes':
        this.tale(m);
        break;
      default:
        this.bossNews(m, f);
        break;
    }
  }

  // What the bosses get up to (shared/nod/bosses.js).
  bossNews(m, f) {
    const g = this.g;
    const now = performance.now();
    const nod = this.nod;
    const here = f && f.body === this.w.body;
    switch (m.k) {
      case 'tune':
        if (!Array.isArray(m.seq)) break;
        this.tune = { f: m.f, seq: m.seq.filter((k) => PART_ICONS[k]).slice(0, 8), beat: m.beat ?? 600, shown: 0 };
        this.tune.seq.forEach((k, i) => {
          setTimeout(() => {
            if (g.nod !== nod || this.tune?.f !== m.f) return;
            this.tune.shown = Math.max(this.tune.shown, i + 1);
            if (here) g.sound.play('nod-note', { n: PART_NOTES[k], long: true });
          }, (i + 1) * this.tune.beat);
        });
        break;
      case 'part':
        if (here && this.tune) g.sound.play('nod-note', { n: PART_NOTES[this.tune.seq[m.i]] ?? 0 });
        break;
      case 'fluster':
        if (f) {
          f.model.squash = 0.5;
          this.word(add(f, f.up, f.spec.height + 0.5), m.n >= m.of ? 'FLUSTERED!' : `${m.n} OF ${m.of}!`, '#ffd84d', m.n >= m.of);
        }
        break;
      case 'hour':
        for (let i = 0; i < Math.min(12, m.n ?? 0); i++) setTimeout(() => g.nod === nod && g.sound.play('nod-note', { n: -12, long: true, gain: 1.6 }), 1200 + i * (m.gap ?? 600));
        this.nod.tellOnce('hour', 30000, '🕰️', 'Old Tock is striking the hour! Jump the rings — and get over the edge, to the key on the other side of the dial!');
        break;
      case 'keybare':
        if (f) {
          g.sound.play('nod-ready');
          this.nod.tellOnce('key', 20000, '🗝️', 'Old Tock has run right down, and his key has stopped: bop it!');
        }
        break;
      case 'phase':
        g.sound.play('nod-neigh');
        g.renderer.shake(0.4);
        g.emit('toast', { icon: '🐴', text: m.n === 1 ? 'The Night Mare rears — and now she is three! Only one of them strikes sparks.' : 'Out go the stars! It is quite dark, and only her eyes are to be seen. Slam down by all three lanterns to light them!' });
        break;
      case 'split':
        if (f) this.poof(f, 24);
        g.sound.play('nod-neigh');
        break;
      case 'dark':
        nod.view.setDark(m.on === true);
        if (g.adventure?.duel && m.on) nod.tellOnce('dark', 60000, '🌑', 'Out go the lights! Watch for a pair of eyes — and bop, or roll, as they flash.');
        break;
      // (A weapon's soul gathers itself: shared/nod/soul-foes.js.)
      case 'soulsays': {
        const said = soulOf(g.adventure?.duel)?.soul.lines?.[m.i];
        if (!said) break;
        g.sound.setDuel({ soul: g.adventure.duel, rage: m.i });
        g.sound.play(m.i ? 'soul-wake' : 'soul-circle', { secs: 1.2 });
        if (f && m.i) {
          const c = add(f, f.up, f.alt + f.spec.height * 0.5);
          this.domes.push(new BurstDome(this.scene, c, 7, f.model.color, 900), new BurstDome(this.scene, c, 4, '#ffffff', 620));
          this.poof(f, 40);
          g.renderer.effects.sparkles(c.x, c.y, c.z, 30, [f.model.color, '#ffffff', '#ffe27a']);
          g.renderer.shake(0.5);
        }
        g.emit('soul-says', { w: g.adventure.duel, i: m.i, text: said });
        break;
      }
      case 'lantern': {
        const list = nod.view.lanterns;
        if (m.i === -1) for (const l of list) l.set(false);
        else list[m.i]?.set(m.on === true);
        if (m.on) {
          g.sound.play('nod-ready');
          const n = list.filter((l) => l.on).length;
          this.word(add(this.w, this.w.up, 1.6), `${n} OF ${list.length} LANTERNS!`, '#ffd84d', n === list.length);
        }
        break;
      }
      default:
        break;
    }
  }

  // How a nightmare goes: what is said of it.
  tale(m) {
    const g = this.g;
    const n = this.nod.nightmares.get(m.n);
    const told = g.adventure?.story.nightmares?.[m.n - 1];
    const here = n && this.nod.w.body.key === n.body;
    if (!told) return;
    if (m.k === 'wake' && here) {
      g.sound.play('grumble', { big: true });
      g.renderer.shake(0.2);
      g.emit('toast', { icon: told.icon ?? '🌑', text: `${told.name}! ${told.hint}` });
    } else if (m.k === 'wave' && here && m.w > 1) g.emit('toast', { icon: '🌑', text: m.w === m.of ? 'Here come the last of them!' : `Here come more of them! (${m.w} of ${m.of})` });
    else if (m.k === 'quiet' && here) g.emit('toast', { icon: '💤', text: 'It has gone quiet here again. They will be back!' });
    else if (m.k === 'bosscomes' && here) {
      g.sound.play('grumble', { big: true });
      g.renderer.shake(0.4);
      g.emit('toast', { icon: told.icon ?? '🌑', text: `${told.name} is coming! ${told.hint}` });
    } else if (m.k === 'boss') {
      g.sound.play('roar');
      g.renderer.shake(0.5);
    }
  }

  popped(m, mine) {
    const f = this.frights.get(m.f);
    const g = this.g;
    if (!f) {
      // (One never seen here: what it dropped comes out where it was.)
      if (Array.isArray(m.loot) && finite(m.p, 3)) g.loot.burst(m.loot, at3(m.p));
      return;
    }
    // (The Night Mare does not pop: she lies down, and sleeps.)
    const sleeps = f.kind === 'mare';
    if (!sleeps) this.poof(f, f.spec.boss ? 60 : 18);
    const c = add(f, f.up, f.alt + f.spec.height * 0.5);
    g.renderer.effects.sparkles(c.x, c.y, c.z, f.spec.boss ? 60 : 16, ['#fff3a0', '#ffffff', '#ffd6ec', '#9fe8ff']);
    if (dist3(f, this.w) < 40) g.sound.play('pop', { big: f.spec.radius > 0.5 });
    if (f.spec.boss) {
      g.sound.play('nod-bosspop');
      g.renderer.shake(0.8);
      this.domes.push(new BurstDome(this.scene, c, 14, '#ffe27a', 1400));
    }
    // What it drops, on the ground of its body (shared/loot.js).
    if (Array.isArray(m.loot)) g.loot.burst(m.loot, c, { big: Boolean(f.spec.boss) });
    if (mine) {
      g.profile.count('popped');
      this.braver(f.spec.guard === 'none' ? 0.2 : 0.5);
      g.emit('popped', { kind: f.kind });
    }
    if (sleeps) {
      Object.assign(f, { popping: true, state: 'sleep', open: null, act: null, alt: 0, more: [0, 0] });
      f.snaps = [];
      this.nod.view.setDark(false);
    } else this.drop(m.f);
  }

  // A blow of theirs (the island agrees): HP off someone, and all that follows.
  bumped(msg) {
    const g = this.g;
    const p = g.players.get(msg.pid);
    if (msg.pid !== g.pid) {
      if (p) {
        p.dizzy = msg.dizzy === true;
        if (p.avatar && dist3(p.avatar.root.position, this.w) < 30) g.sound.play('bump');
        if (msg.dizzy) g.emit('toast', { icon: '💫', text: `${p.name} is sitting dizzy! Go and help them up.` });
        g.emit('players');
      }
      return;
    }
    g.setHp(msg);
    g.emit('hp');
    // (Out of HP, in a duel with a weapon's soul: shared/nod/duel.js.)
    if (msg.lost) {
      g.dizzy = true;
      g.sound.play('dizzy');
      this.stop();
      this.nod.view.setDark(false);
      g.sound.setDuel(null);
      g.emit('duel', { won: false, w: g.adventure?.duel });
      return;
    }
    if (msg.dizzy) {
      g.dizzy = true;
      g.sound.play('dizzy');
      g.emit('dizzy', true);
    } else if (msg.home && finite(msg.at, 3)) this.home(at3(msg.at));
  }

  // Come round where you were last safe.
  home(at) {
    const g = this.g;
    g.dizzy = false;
    g.emit('dizzy', false);
    this.courage = 0;
    this.nod.putAt(at);
    g.sound.play('nod-home');
    g.renderer.effects.sparkles(this.w.x, this.w.y + 0.8, this.w.z, 20);
    g.emit('toast', { icon: '💖', text: 'You woke up with a start — and here you are again, with all your HP.' });
    this.safeUntil = performance.now() + 2500;
    g.emit('hp');
  }

  // What you are fighting, as the camera has it (nod-game.js): the boss, or
  // whoever is nearest, and all the more if they are about to go for you.
  foe() {
    const now = performance.now();
    let best = null;
    let least = Infinity;
    for (const f of this.frights.values()) {
      if (f.popping || f.spec.part || f.shadow || f.state === 'come') continue;
      const d = dist3(f, this.w);
      if (d > (f.spec.boss ? 44 : 13)) continue;
      const s = d - (f.spec.boss ? 100 : 0) - (f.act && now < f.act.strike && f.act.at === this.g.pid ? 5 : 0) - (f.open ? 3 : 0);
      if (s >= least) continue;
      least = s;
      best = f;
    }
    return best;
  }

  // ------------------------------------------------ each frame

  update(dt) {
    const now = performance.now();
    this.poseFrights(dt, now);
    this.runActs(dt, now);
    this.domes = this.domes.filter((d) => d.update(dt));
    if (this.soon && now < this.soon && now >= this.swungAt) this.attack();
    if (this.rollSoon && now < this.rollSoon && now - this.rollAt >= ROLL.ms + ROLL.cool) this.roll();
    this.keepOut();
    if (this.rolling && Math.random() < dt * 30) this.g.renderer.effects.add('puff', this.w.x, this.w.y, this.w.z, { size: 0.25, life: 0.4, grow: 0.5, color: '#efe6ff' });
    this.facing = now - this.swingAt < 180;
  }

  // Out of any of them you have walked into (the big ones, above all).
  keepOut() {
    const w = this.w;
    if (this.rolling || this.nod.flight) return;
    for (const f of this.frights.values()) {
      if (f.hidden || f.state === 'under' || f.alt > 1.2) continue;
      const d = sub(w, f);
      const high = dot(d, f.up);
      if (high > f.spec.height * 0.9 || high < -1) continue;
      const along = flat(d, f.up);
      const l = len(along);
      const need = f.spec.radius * 0.9 + 0.28;
      if (l >= need || l < 1e-4) continue;
      const push = (need - l) * 0.6;
      w.x += (along.x / l) * push;
      w.y += (along.y / l) * push;
      w.z += (along.z / l) * push;
    }
  }

  // What is painted on the ground (render/nod/light.js): where blows are about
  // to land, waves, rings, the bounds of a fight.
  zones() {
    const now = performance.now();
    const out = [];
    for (const a of this.acts.values()) {
      if (a.over && a.k !== 'wave') continue;
      const k = Math.max(0, Math.min(1, 1 - (a.strike - now) / a.ms));
      if (a.k === 'burst' && now < a.strike + 60) out.push({ ...a.p, r: a.r, color: RED, a: 1, kind: 1, k });
      else if ((a.k === 'leap' || a.k === 'dive') && a.to[0] && now < a.strike + (a.k === 'leap' ? a.d : 60)) out.push({ ...a.to[0], r: a.r, color: RED, a: 1, kind: 1, k: a.k === 'leap' ? Math.max(0, Math.min(1, (now - a.t0) / (a.ms + a.d))) : k });
      else if (a.k === 'spots' && now < a.strike + 60) for (const q of a.to) out.push({ ...q, r: a.r, color: RED, a: 1, kind: 1, k });
      else if (a.k === 'lob' && now < a.strike + a.d) for (const q of a.to) out.push({ ...q, r: a.r, color: RED, a: 1, kind: 1, k: Math.max(0, Math.min(1, (now - a.t0) / (a.ms + a.d))) });
      else if (a.k === 'wave') {
        if (now < a.strike) out.push({ ...a.p, r: 1.6 + k, color: WAVE, a: 0.8 * k, kind: 1, k });
        for (let i = 0; i < a.n; i++) {
          const t = now - a.strike - i * a.gap;
          if (t <= 0) continue;
          const R = waveR(t, a.s);
          if (R < a.reach) out.push({ ...a.p, r: R, color: KIND_COLOR.wave, a: Math.min(1, (a.reach - R) / 4), kind: 2, k: a.w });
        }
      }
    }
    for (const r of this.rings ?? []) {
      const t = (now - r.t0) / r.ms;
      if (t < 1) out.push({ x: r.x, y: r.y, z: r.z, r: r.r * (1 - (1 - t) ** 2), color: r.color, a: 1 - t, kind: 2, k: 0.7 });
    }
    if (this.rings) this.rings = this.rings.filter((r) => now - r.t0 < r.ms);
    // In the dark, a little light round everyone, and round each lantern lit.
    if (this.nod.view.dark > 0.05) {
      out.push({ x: this.w.x, y: this.w.y, z: this.w.z, r: 6.5, color: LAMP, a: 0.22 * this.nod.view.dark, kind: 4, k: 0 });
      for (const l of this.nod.view.lanterns) if (l.on && out.length < 10) out.push({ x: l.at.x, y: l.at.y, z: l.at.z, r: 9, color: LAMP, a: 0.4, kind: 4, k: 0 });
    }
    // Where a nightmare waits: a dark pool of fog.
    for (const n of this.nod.nightmares.values()) {
      if (n.done || n.boss || out.length > 9) continue;
      if (dist3(n.at, this.w) < 60) out.push({ x: n.at.x, y: n.at.y, z: n.at.z, r: 3.4, color: FOG, a: n.on ? 0.3 : 0.8, kind: 3, k: 0 });
    }
    return out.slice(0, 12);
  }

  // Tags over things (ui.js adventureTags): the hearts of frights near you and
  // whether their guard is up, what waits where, the boss.
  tags() {
    const out = [];
    const w = this.w;
    const g = this.g;
    const story = g.adventure?.story;
    for (const f of this.frights.values()) {
      const d = dist3(f, w);
      if (d > (f.spec.boss ? 60 : 22) || f.popping) continue;
      const top = add(f, f.up, f.alt + f.spec.height + (f.spec.boss ? 0.9 : 0.45));
      if (f.spec.boss) {
        const tune = this.tune && this.tune.f === f.id ? ` · ${this.tune.seq.map((k, i) => (i < this.tune.shown ? PART_ICONS[k] : '·')).join(' ')}` : '';
        out.push({ key: `f${f.id}`, ...top, label: `${f.spec.icon} ${f.spec.name}${f.open ? ' 💫' : ' 🛡️'}${tune}`, share: f.hearts / Math.max(1, f.max), kind: 'king', left: f.open ? f.left : null });
        continue;
      }
      if (f.spec.part) {
        if (f.more?.[0] === 1) out.push({ key: `f${f.id}`, ...top, label: `💫 ${f.spec.icon} Bop it!`, share: null, kind: 'fright open' });
        continue;
      }
      if (f.spec.guard === 'none') continue;
      out.push({ key: `f${f.id}`, ...top, label: `${f.open ? '💫' : '🛡️'} ${'♥'.repeat(Math.max(0, f.hearts))}${'♡'.repeat(Math.max(0, f.max - f.hearts))}`, share: null, kind: f.open ? 'fright open' : 'fright' });
    }
    for (const n of this.nod.nightmares.values()) {
      if (n.done) continue;
      const told = story?.nightmares?.[n.id - 1];
      if (!told) continue;
      const d = dist3(n.at, w);
      if (n.on && w.body.key === n.body) {
        if (n.boss) continue;
        const at = add(w, w.up, 3.1);
        out.push({ key: `n${n.id}`, ...at, label: `🌑 ${told.name} · ${n.wave}/${n.waves} · ${n.left} left`, share: null, kind: 'quest' });
        continue;
      }
      if (n.boss && !this.nod.bossReady) continue;
      const top = add(n.at, n.at.up, 3.2);
      out.push({ key: `n${n.id}`, ...top, label: `${n.boss ? (told.icon ?? '🌙') : '🌑'} ${told.name}${d > 12 ? ` · ${Math.round(d)}m` : ''}`, share: null, kind: 'quest' });
    }
    return out;
  }
}

// What each part of the Maestro's tunes looks like, shown over his head, and the
// note of it.
const PART_ICONS = { ring: '⭕', note: '🎵', crash: '💥' };
const PART_NOTES = { ring: 0, note: 7, crash: -5 };
// How each weapon's swing looks here.
const slashFor = (weapon) => (weapon?.soul ? soulOf(weapon.souls[0])?.color : SLASH[weapon?.key]) ?? SLASH.punch;
const SLASH = { punch: '#ffe27a', sword: '#4fc3ff', hammer: '#ffc21a', lavablade: '#ff6a1f', punchglove: '#ffd84d', galaxyblade: '#b98cff', thunderspear: '#9fe8ff', rainbowray: '#ff9fd0', meteorstaff: '#ff8a4d', bow: '#ffd75e', blaster: '#9fd8ff', bombrod: '#ffb06a' };
