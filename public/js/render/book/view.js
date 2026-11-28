// A story of the Storybook on screen (shared/book/stories): its flat page —
// the ground (terrain.js), its sky and the scenery behind it (backdrop.js),
// and all that stands on it, as paper cut-outs (sprites.js): foes where the
// story's clock says they are, stars, bookmarks, platforms that move, springs,
// crates, the things stood about for show, what is spat and thrown, and the
// boss (puppets.js). Everyone playing is drawn by the game as anywhere, stood
// on the page facing along it (book/book-game.js).
import * as THREE from '../../../vendor/three.module.js';
import { bossAt } from '../../shared/book/bosses.js';
import { foeAt, foeSpec, moverAt, shotsOf } from '../../shared/book/foes.js';
import { TILE } from '../../shared/book/level.js';
import { Backdrop } from './backdrop.js';
import { cutout, ellipse, INK, Sheet, starPath } from './paint.js';
import { Puppet, setUv } from './puppets.js';
import { DECOR, FRAMES, paintCrate, paintMark, paintMover, paintShot, paintSkin, paintSpring, paintStar, SHOT_KINDS } from './sprites.js';
import { terrainMeshes } from './terrain.js';
import { themeOf } from './themes.js';

// How deep things stand: the ground at TERRAIN_Z (terrain.js), and from back
// to front, what stands behind it, platforms, bookmarks, foes and stars, the
// boss, everyone (at 0), what is thrown, and the water in front.
const Z = { back: -0.8, mover: -0.42, mark: -0.4, front: -0.36, foe: -0.3, star: -0.3, boss: -0.25, shot: 0.35, fx: 0.5 };
const WORDS = ['POP!', 'BOP!', 'BONK!'];

export class BookView {
  constructor(scene, level, { quality = 'high' } = {}) {
    this.level = level;
    this.key = level.key;
    this.theme = themeOf(level.key);
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'book';
    scene.add(this.group);
    this.time = 0;
    this.backdrop = new Backdrop(level, this.theme, level.key);
    this.group.add(this.backdrop.group);
    this.terrain = terrainMeshes(level, this.theme, 7);
    this.group.add(this.terrain.group);
    this.paintSheet();
    this.mat = new THREE.MeshBasicMaterial({ map: this.sheet.texture, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    this.disposables = [];
    this.makeDecor();
    this.makeMarks();
    this.makeMovers();
    this.makeSprings();
    this.makeCrates();
    this.makeStars();
    this.makeFoes();
    this.shots = [];
    this.fx = [];
    this.puppet = level.boss ? new Puppet(level.boss.kind, level.arena) : null;
    if (this.puppet) this.group.add(this.puppet.group);
    // Count Inkblot's flood, over the floor of his room.
    if (level.boss?.kind === 'inkblot') {
      const A = level.arena;
      const c = new Sheet(128, 2, 2);
      c.add('ink', (ctx, W, H) => {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#6a4a9a');
        g.addColorStop(0.15, '#2b2050');
        g.addColorStop(1, '#120b1f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }, 2, 2);
      this.floodMat = new THREE.MeshBasicMaterial({ map: c.done(), transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false });
      const g = new THREE.PlaneGeometry(A.x1 - A.x0 - 1, 1);
      g.translate(0, -0.5, 0);
      this.flood = new THREE.Mesh(g, this.floodMat);
      this.flood.position.set((A.x0 + A.x1) / 2, A.floor, 0.6);
      this.flood.renderOrder = 31;
      this.flood.visible = false;
      this.group.add(this.flood);
    }
    this.state = null;
  }

  // ------------------------------------------------ the pictures

  paintSheet() {
    const L = this.level;
    const sheet = new Sheet(128, 16, 3);
    const skins = [...new Set(L.foes.map((f) => f.skin ?? f.kind))];
    for (const skin of skins) for (const fr of FRAMES) sheet.add(`foe/${skin}/${fr}`, (c, W) => paintSkin(c, skin, fr, W));
    for (const k of SHOT_KINDS) sheet.add(`shot/${k}`, (c, W) => paintShot(c, k, W));
    sheet.add('star', (c, W) => paintStar(c, W));
    sheet.add('mark/off', (c, W, H) => paintMark(c, W, H, false), 1, 2);
    sheet.add('mark/on', (c, W, H) => paintMark(c, W, H, true), 1, 2);
    for (const kind of new Set(L.movers.map((m) => m.kind))) {
      for (const w of new Set(L.movers.filter((m) => m.kind === kind).map((m) => Math.round(m.w)))) sheet.add(`mover/${kind}/${w}`, (c, W, H) => paintMover(c, kind, W, H), w, 1);
    }
    sheet.add('spring/rest', (c, W) => paintSpring(c, L.key, W, false));
    sheet.add('spring/squash', (c, W) => paintSpring(c, L.key, W, true));
    sheet.add('crate', (c, W) => paintCrate(c, L.key, W));
    sheet.add('puff', (c, W) => cutout(c, (p) => {
      for (const [x, y, r] of [
        [0.35, 0.55, 0.22],
        [0.6, 0.45, 0.26],
        [0.5, 0.66, 0.2],
      ]) p.ellipse(W * x, W * y, W * r, W * r, 0, 0, Math.PI * 2);
    }, '#ffffff', { line: 0, edge: 0, shadeK: 0.1, grain: 0.02 }));
    sheet.add('spark', (c, W) => cutout(c, starPath(W / 2, W / 2, W * 0.4, W * 0.14, 4, 0), '#fff3a0', { line: 3, edge: 0, grain: 0 }));
    for (const w of WORDS) sheet.add(`word/${w}`, (c, W, H) => paintWord(c, w, W, H), 2, 1);
    for (const kind of new Set(L.decor.map((d) => d.kind))) {
      const d = DECOR[kind];
      if (d) sheet.add(`decor/${kind}`, (c, W, H) => d[2](c, W, H), d[0], d[1]);
    }
    sheet.add('thread', (c, W, H) => {
      c.fillStyle = '#ffffff';
      c.fillRect(W / 2 - 3, 0, 6, H);
      c.fillStyle = INK;
      c.fillRect(W / 2 - 1, 0, 2, H);
    });
    this.sheet = sheet;
    sheet.done();
  }

  // A cut-out on the page: picture key, w by h metres, its foot at its
  // origin (or its middle, centre), at depth z.
  sprite(key, w, h, z, { centre = false, order = 10 } = {}) {
    const g = new THREE.PlaneGeometry(1, 1);
    if (!centre) g.translate(0, 0.5, 0);
    const r = this.sheet.rects.get(key);
    if (r) setUv(g, r);
    const m = new THREE.Mesh(g, this.mat);
    m.scale.set(w, h, 1);
    m.position.z = z;
    m.renderOrder = order;
    m.userData.key = key;
    this.group.add(m);
    this.disposables.push(g);
    return m;
  }

  show(m, key) {
    if (m.userData.key === key) return;
    const r = this.sheet.rects.get(key);
    if (!r) return;
    m.userData.key = key;
    setUv(m.geometry, r);
  }

  makeDecor() {
    for (const d of this.level.decor) {
      const spec = DECOR[d.kind];
      if (!spec) continue;
      const m = this.sprite(`decor/${d.kind}`, spec[0] * d.s, spec[1] * d.s, d.back ? Z.back : Z.front, { order: d.back ? 0 : 6 });
      m.position.set(d.x, d.y - (d.back ? 0.15 : 0.04), m.position.z);
      if (d.flip) m.scale.x *= -1;
    }
  }

  makeMarks() {
    this.marks = new Map();
    for (const k of this.level.marks) {
      const m = this.sprite('mark/off', 1.3, 2.6, Z.mark, { order: 4 });
      m.position.set(k.x + 0.25, k.y - 0.05, Z.mark);
      this.marks.set(k.id, { m, lit: false, at: 0 });
    }
  }

  makeMovers() {
    this.movers = this.level.movers.map((mv) => {
      const w = Math.round(mv.w);
      const m = this.sprite(`mover/${mv.kind}/${w}`, w, 1, Z.mover, { order: 5 });
      return { mv, m };
    });
  }

  makeSprings() {
    this.springs = new Map();
    const L = this.level;
    for (let i = 0; i < L.w; i++) {
      for (let j = 0; j < L.h; j++) {
        if (L.at(i, j) !== TILE.SPRING) continue;
        const m = this.sprite('spring/rest', 1.15, 1.15, Z.front, { order: 6 });
        m.position.set(i + 0.5, j - 0.04, Z.front);
        this.springs.set(`${i},${j}`, { m, at: -9 });
      }
    }
  }

  makeCrates() {
    this.crates = new Map();
    for (const c of this.level.crates) {
      const m = this.sprite('crate', 1.04, 1.04, Z.front, { order: 6 });
      m.position.set(c.x + 0.5, c.y - 0.02, Z.front);
      const star = c.star ? this.sprite('star', 0.9, 0.9, Z.star, { centre: true, order: 8 }) : null;
      if (star) {
        star.visible = false;
        star.position.set(c.x + 0.5, c.y + 0.5, Z.star);
      }
      this.crates.set(c.i, { c, m, star, k: this.level.crates.indexOf(c) });
    }
  }

  makeStars() {
    this.stars = this.level.stars.map((s) => {
      const m = this.sprite('star', 0.9, 0.9, Z.star, { centre: true, order: 8 });
      m.position.set(s.x, s.y, Z.star);
      return { s, m };
    });
  }

  makeFoes() {
    this.foes = new Map();
    for (const f of this.level.foes) {
      const spec = foeSpec(f.kind);
      const size = Math.max(spec.w, spec.h) * 1.6;
      const roll = spec.move === 'roll';
      const m = this.sprite(`foe/${f.skin ?? f.kind}/a`, size, size, Z.foe, { centre: roll, order: 9 });
      const thread = spec.move === 'drop' ? this.sprite('thread', 0.25, 1, Z.foe - 0.01, { order: 8 }) : null;
      this.foes.set(f.id, { f, spec, m, size, thread, squash: null });
    }
  }

  // ------------------------------------------------ what happens

  setState(state) {
    this.state = state;
    for (const [id, k] of this.marks) if (state.lit?.has(id) && !k.lit) this.lightMark(id, true);
    for (const [i, c] of this.crates) if (state.broken?.has(i)) this.crate(c.c, false);
  }

  // A foe landed on (stomp) or bopped: squashed flat, then a puff.
  popFoe(f, pose, how = 'stomp') {
    const e = this.foes.get(f.id);
    if (!e) return;
    e.squash = { t: 0, x: pose.x, y: pose.y, face: pose.face, how };
    this.word(pose.x, pose.y + 1.6, how === 'bop' ? 'BOP!' : 'POP!');
  }

  foeBack(id) {
    const e = this.foes.get(id);
    if (e) e.squash = null;
  }

  crate(c, fx = true) {
    const e = this.crates.get(c.i);
    if (!e || e.broken) return;
    e.broken = true;
    e.m.visible = false;
    if (e.star && !this.state?.got?.has(1000 + e.k)) e.star.visible = true;
    if (fx) {
      this.puff(c.x + 0.5, c.y + 0.5, 1.4);
      for (let k = 0; k < 4; k++) this.bit(c.x + 0.5, c.y + 0.5, 'crate', (k - 1.5) * 2.5, 5 + k);
    }
  }

  starGot(i, x, y) {
    const e = i >= 1000 ? [...this.crates.values()].find((c) => c.k === i - 1000)?.star : this.stars[i]?.m;
    if (e) e.visible = false;
    this.fx.push({ m: this.sprite('star', 0.9, 0.9, Z.fx, { centre: true, order: 40 }), t: 0, life: 0.45, x, y, kind: 'rise' });
    for (let k = 0; k < 5; k++) this.fx.push({ m: this.sprite('spark', 0.4, 0.4, Z.fx, { centre: true, order: 40 }), t: 0, life: 0.5, x, y, vx: Math.cos(k * 1.26) * 3, vy: Math.sin(k * 1.26) * 3, kind: 'fly' });
  }

  spring(i, j) {
    const e = this.springs.get(`${i},${j}`) ?? this.springs.get(`${i + 1},${j}`) ?? this.springs.get(`${i - 1},${j}`);
    if (e) e.at = this.time;
  }

  lightMark(id, quiet = false) {
    const k = this.marks.get(id);
    if (!k || k.lit) return;
    k.lit = true;
    k.at = this.time;
    this.show(k.m, 'mark/on');
    if (!quiet) for (let n = 0; n < 8; n++) this.fx.push({ m: this.sprite('spark', 0.5, 0.5, Z.fx, { centre: true, order: 40 }), t: 0, life: 0.8, x: k.m.position.x, y: k.m.position.y + 2.2, vx: Math.cos(n * 0.785) * 4, vy: Math.sin(n * 0.785) * 4, kind: 'fly' });
  }

  burst(x, y, word = 'BONK!') {
    this.word(x, y + 0.8, word);
    this.puff(x, y, 1.6);
  }

  bossBeaten() {
    this.beatenAt = this.time;
  }

  word(x, y, w) {
    if (!WORDS.includes(w)) return;
    this.fx.push({ m: this.sprite(`word/${w}`, 2, 1, Z.fx, { centre: true, order: 41 }), t: 0, life: 0.7, x, y, kind: 'word' });
  }

  puff(x, y, s = 1) {
    this.fx.push({ m: this.sprite('puff', s, s, Z.fx, { centre: true, order: 39 }), t: 0, life: 0.45, x, y, s, kind: 'puff' });
  }

  bit(x, y, key, vx, vy) {
    this.fx.push({ m: this.sprite(key, 0.4, 0.4, Z.fx, { centre: true, order: 39 }), t: 0, life: 0.9, x, y, vx, vy, g: 18, spin: vx * 2, kind: 'fly' });
  }

  // ------------------------------------------------ each frame

  frame(dt, { state, camera }) {
    this.time += dt;
    this.state = state;
    const t = state.t;
    const secs = t / 1000;
    this.backdrop.frame(dt, state.cam, camera);
    // Platforms that move.
    for (const { mv, m } of this.movers) {
      const at = moverAt(mv, t / 1000);
      m.position.set(at.x + Math.round(mv.w) / 2, at.y + 0.22 - 1, Z.mover);
    }
    // Springs, squashed a moment as they bounce someone.
    for (const e of this.springs.values()) this.show(e.m, this.time - e.at < 0.18 ? 'spring/squash' : 'spring/rest');
    // Stars, spinning like coins.
    for (const { s, m } of this.stars) {
      if (state.got?.has(s.i)) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.scale.x = 0.9 * Math.max(0.15, Math.abs(Math.cos(this.time * 2.4 + s.i * 0.7)));
      m.position.y = s.y + Math.sin(this.time * 2 + s.i) * 0.06;
    }
    for (const e of this.crates.values()) if (e.star && e.star.visible) e.star.scale.x = 0.9 * Math.max(0.15, Math.abs(Math.cos(this.time * 2.4)));
    // Bookmarks, waving once lit.
    for (const k of this.marks.values()) k.m.rotation.z = k.lit ? Math.sin(this.time * 3) * 0.03 : 0;
    this.frameFoes(secs, state);
    this.frameBoss(t, state);
    this.frameShots(secs, t, state);
    this.frameFx(dt);
  }

  frameFoes(secs, state) {
    const fast = state.fast ?? 1;
    for (const e of this.foes.values()) {
      const { f, spec, m, size, thread } = e;
      const skin = f.skin ?? f.kind;
      if (e.squash) {
        e.squash.t += 1 / 60;
        const sq = e.squash;
        this.show(m, `foe/${skin}/flat`);
        m.visible = sq.t < 0.4;
        m.position.set(sq.x, sq.y, Z.foe);
        m.scale.set(size * (sq.face < 0 ? -1 : 1), size, 1);
        if (spec.move === 'roll') m.position.y = sq.y + size / 2;
        if (sq.t >= 0.4 && !sq.puffed) {
          sq.puffed = true;
          this.puff(sq.x, sq.y + 0.5, 1.3);
        }
        if (thread) thread.visible = false;
        if (!state.gone?.has(f.id) && !state.popping?.has(f.id) && sq.t > 1.6) e.squash = null;
        continue;
      }
      if (state.gone?.has(f.id)) {
        m.visible = false;
        if (thread) thread.visible = false;
        continue;
      }
      const p = foeAt({ ...f, fast }, secs);
      m.visible = true;
      let frame = 'a';
      if (spec.move === 'walk' || spec.move === 'roll') frame = Math.floor(p.step) % 2 ? 'b' : 'a';
      else if (spec.move === 'hop') frame = p.y > f.y + 0.05 ? 'b' : 'a';
      else if (spec.move === 'fly') frame = Math.floor(p.step) % 2 ? 'b' : 'x';
      else if (spec.move === 'shoot') frame = p.wind > 0 ? 'x' : 'a';
      else if (spec.move === 'pop') frame = p.up < 0.35 ? 'x' : 'a';
      this.show(m, `foe/${skin}/${frame}`);
      m.scale.set(size * (p.face < 0 ? -1 : 1), size, 1);
      m.rotation.z = spec.move === 'roll' ? p.spin * (p.face < 0 ? -1 : 1) : 0;
      if (spec.move === 'pop' && p.up >= 0.35) {
        // Up out of its hole, as far as it is: only that much of it shows.
        const r = this.sheet.rects.get(`foe/${skin}/a`);
        const k = Math.max(0.05, p.up);
        setUv(m.geometry, { ...r, v0: r.v1 - (r.v1 - r.v0) * k });
        m.userData.key = '';
        m.scale.y = size * k;
      }
      m.position.set(p.x, spec.move === 'roll' ? p.y + size / 2 - 0.05 : p.y - 0.06, Z.foe);
      if (thread) {
        const top = f.y + 0.9 + 4;
        const low = p.y + spec.h * 0.9;
        thread.visible = true;
        thread.position.set(p.x, low, Z.foe - 0.01);
        thread.scale.set(0.2, Math.max(0.01, top - low), 1);
      }
    }
  }

  frameBoss(t, state) {
    if (!this.puppet) return;
    const b = state.boss;
    const on = b && (state.bossState === 'on' || b.phase === 'beaten');
    const pose = on ? bossAt(b, t, this.level.arena) : null;
    this.puppet.update(1 / 60, pose, state.talk ?? 0);
    if (this.flood) {
      const f = pose?.flood ?? 0;
      this.flood.visible = f > 0.02;
      this.flood.scale.y = Math.max(0.01, f * 0.9 + 0.1);
      this.flood.position.y = this.level.arena.floor + f * 0.8;
    }
    if (this.beatenAt !== undefined && this.time - this.beatenAt < 0.05 && pose) {
      for (let n = 0; n < 14; n++) this.bit(pose.x, pose.y + 1.5, 'spark', Math.cos(n * 0.45) * 7, Math.sin(n * 0.45) * 7 + 4);
    }
  }

  // What foes have spat and the boss has thrown, in the air now.
  frameShots(secs, t, state) {
    const want = [];
    for (const f of this.level.foes) {
      if (foeSpec(f.kind).move !== 'shoot' || state.gone?.has(f.id)) continue;
      for (const s of shotsOf(f, secs)) want.push({ ...s, kind: 'ink' });
    }
    const b = state.boss;
    if (b && state.bossState === 'on' && this.level.arena) for (const s of bossAt(b, t, this.level.arena).shots) if (!s.flood) want.push(s);
    while (this.shots.length < want.length) this.shots.push(this.sprite('shot/ink', 1, 1, Z.shot, { centre: true, order: 20 }));
    this.shots.forEach((m, i) => {
      const s = want[i];
      m.visible = Boolean(s);
      if (!s) return;
      this.show(m, `shot/${SHOT_KINDS.includes(s.kind) ? s.kind : 'ink'}`);
      const size = s.r * 2.6;
      m.position.set(s.x, s.y, Z.shot);
      m.scale.set(size * (s.face < 0 ? -1 : 1), size, 1);
      m.rotation.z = s.spin ?? (s.kind === 'seed' ? this.time * 8 : 0);
    });
  }

  frameFx(dt) {
    this.fx = this.fx.filter((e) => {
      e.t += dt;
      const k = e.t / e.life;
      if (k >= 1) {
        this.group.remove(e.m);
        e.m.geometry.dispose();
        return false;
      }
      const m = e.m;
      if (e.kind === 'rise') {
        m.position.set(e.x, e.y + k * 1.4, Z.fx);
        m.scale.setScalar(0.9 * (1 - k * 0.5));
      } else if (e.kind === 'word') {
        const s = k < 0.2 ? k / 0.2 : 1;
        m.position.set(e.x, e.y + k * 0.6, Z.fx);
        m.scale.set(2 * s, 1 * s, 1);
        m.rotation.z = Math.sin(e.t * 20) * 0.06;
      } else if (e.kind === 'puff') {
        m.position.set(e.x, e.y + k * 0.4, Z.fx);
        m.scale.setScalar(e.s * (0.6 + k * 0.8));
      } else {
        e.x += (e.vx ?? 0) * dt;
        e.vy = (e.vy ?? 0) - (e.g ?? 6) * dt;
        e.y += e.vy * dt;
        m.position.set(e.x, e.y, Z.fx);
        m.rotation.z += (e.spin ?? 3) * dt;
      }
      return true;
    });
  }

  dispose() {
    this.backdrop.dispose();
    this.terrain.dispose();
    this.puppet?.dispose();
    for (const g of this.disposables) g.dispose();
    for (const e of this.fx) e.m.geometry.dispose();
    this.mat.dispose();
    this.sheet.texture.dispose();
    this.floodMat?.map?.dispose();
    this.floodMat?.dispose();
    this.flood?.geometry.dispose();
    this.group.parent?.remove(this.group);
  }
}

// A comic word, as on a picture book's page: fat letters, a white edge.
function paintWord(ctx, w, W, H) {
  ctx.font = `900 ${Math.round(H * 0.62)}px Fredoka, "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(w, W / 2, H / 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.strokeText(w, W / 2, H / 2);
  ctx.fillStyle = w === 'BONK!' ? '#ff5d8f' : w === 'BOP!' ? '#5bc0eb' : '#ffd23f';
  ctx.fillText(w, W / 2, H / 2);
  cutout(ctx, ellipse(0, 0, 0, 0), '#000', { line: 0, edge: 0, grain: 0 });
}
