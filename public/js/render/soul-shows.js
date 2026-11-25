// What is played on the soul weapons' stage (soul-stage.js): a part found in a
// golden chest (PartShow), a weapon put together and its soul waking (ForgeShow),
// its soul beaten (WonShow), two weapons made one (FuseShow) and one taken apart
// again (SplitShow). Each plays by itself, says what is to be written over it as it
// comes to it (say) and what is heard (sound), and then holds, turning slowly, for
// as long as it is looked at. skip(): straight to where it holds.
import * as THREE from '../../vendor/three.module.js';
import { soulOf } from '../shared/souls.js';
import { soulFigure } from './nod/frights-souls.js';
import { soulBox } from './soul-models.js';
import { back, clamp01, easeIn, easeIO, easeOut, TAU, V } from './soul-stage.js';

const WHITE = '#ffffff';

class Show {
  constructor(stage, { say = () => {}, sound = () => {} } = {}) {
    this.stage = stage;
    this.sayIt = say;
    this.soundIt = sound;
    this.t = 0;
    this.cues = [];
    this.group = new THREE.Group();
    stage.scene.add(this.group);
    // Where it has nothing more to do but turn.
    this.holdAt = 4;
    this.muted = false;
    stage.show = this;
  }

  cue(at, fn) {
    this.cues.push({ at, fn });
  }

  say(what, detail) {
    this.sayIt(what, detail);
  }

  sound(name, opts) {
    if (!this.muted) this.soundIt(name, opts);
  }

  update(dt) {
    this.t += dt;
    const due = this.cues.filter((c) => c.at <= this.t).sort((a, b) => a.at - b.at);
    if (due.length) {
      this.cues = this.cues.filter((c) => c.at > this.t);
      for (const c of due) c.fn();
    }
    this.step(this.t, dt);
  }

  step() {}

  skip() {
    this.muted = true;
    while (this.t < this.holdAt) this.update(1 / 20);
    this.muted = false;
  }

  get held() {
    return this.t >= this.holdAt;
  }

  // A hot little ball of light.
  ball(color, size = 0.12) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3.2) }));
    m.scale.setScalar(size);
    this.group.add(m);
    this.stage.extras.push(m.material);
    return m;
  }

  dispose() {
    this.group.removeFromParent();
  }
}

// ---------------------------------------------------------------- a part

export class PartShow extends Show {
  // got: { key, i, fresh, spare, have, found } (profile.js findPart).
  constructor(stage, got, opts) {
    super(stage, opts);
    const w = soulOf(got.key);
    this.got = got;
    this.w = w;
    stage.tall = 2.5;
    stage.wide = 2.2;
    stage.fit();
    stage.colors(w.color, w.glow);
    stage.sky.uniforms.uPrism.value = got.key === 'rainbow' ? 0.7 : 0;
    this.part = stage.part(got.key, got.i, 1.15);
    this.group.add(this.part.group);
    this.full = Math.min(4, 1.75 / this.part.size);
    this.part.group.scale.setScalar(0.001);
    this.part.kit.shared.uIn.value = 0;
    this.core = this.ball(w.color, 0.02);
    this.tones = [w.color, w.glow, WHITE];
    const at = (this.hit = 1.45);
    this.holdAt = at + 1.6;
    this.cue(0, () => {
      this.sound('soul-hush');
      stage.gather(V(), 150, { colors: this.tones, from: 2.6, secs: 1.4, size: 0.07, swirl: 5, spread: 0.5 });
    });
    this.cue(0.55, () => stage.gather(V(), 190, { colors: this.tones, from: 2.2, secs: 0.9, size: 0.08, swirl: 7, spread: 0.25 }));
    this.cue(at, () => this.comes());
    this.cue(at + 0.75, () => this.say('part', got));
  }

  comes() {
    const { stage, got, w } = this;
    const big = got.fresh;
    this.sound(big ? 'soul-part' : 'soul-again');
    stage.flash(big ? 1 : 0.6, big ? WHITE : w.glow);
    stage.shake(big ? 0.9 : 0.4);
    stage.ring(V(), { color: w.color, size: 2.6, secs: 0.9, prism: got.key === 'rainbow' ? 1 : 0 });
    stage.ring(V(), { color: w.glow, size: 1.8, secs: 0.6, thin: 0.16 });
    stage.ring(V(0, -0.9, 0), { color: w.color, size: 3.4, secs: 1.3, flat: true });
    stage.burst(V(), big ? 340 : 130, { colors: this.tones, speed: 4.2, life: 1.5, size: 0.085, drag: 2.6, gravity: 0.5 });
    if (big) stage.burst(V(), 70, { colors: [WHITE, w.glow], speed: 1.6, life: 2.6, size: 0.13, drag: 1.4, swirl: 0.6 });
  }

  step(t, dt) {
    const { stage, part, hit } = this;
    const u = stage.sky.uniforms;
    if (t < hit) {
      const k = t / hit;
      u.uLight.value = easeIn(k) * 0.9;
      u.uPull.value = k * 0.7;
      this.core.scale.setScalar(0.02 + easeIn(k) * 0.16 * (1 + Math.sin(t * 40) * 0.12));
      stage.cam.dist = 4.6 - easeIn(k) * 0.9;
      return;
    }
    const s = t - hit;
    this.core.visible = s < 0.12;
    u.uPull.value = Math.max(0, 0.7 - s * 2);
    u.uLight.value = 0.36 + 0.7 * Math.exp(-s * 2.2);
    u.uRays.value = (this.got.fresh ? 0.95 : 0.45) * easeOut(s / 0.6) * (0.72 + 0.28 * Math.exp(-s));
    part.kit.shared.uIn.value = clamp01(s / 0.85);
    part.kit.shared.uHot.value = Math.max(0, 1.5 * Math.exp(-s * 3.2) - 0.02);
    const grow = back(Math.min(1, s / 0.7));
    part.group.scale.setScalar(this.full * Math.max(0.001, grow));
    // Spinning as it comes, and then turning to be seen.
    part.group.rotation.y = 9 * (1 - Math.exp(-s * 1.6)) + s * 0.7;
    part.group.rotation.z = (part.size > 0.9 ? -0.5 : 0) + Math.sin(s * 0.9) * 0.1;
    part.group.rotation.x = 0.18 + Math.sin(s * 1.1) * 0.12;
    part.group.position.y = Math.sin(s * 1.5) * 0.06;
    stage.cam.dist = 3.7 + 0.5 * easeOut(s / 1.2);
    stage.cam.yaw = Math.sin(s * 0.4) * 0.12;
    stage.embers(dt, { colors: this.tones, rate: this.got.fresh ? 46 : 20 });
    if (this.got.fresh && s > 1.6 && Math.random() < dt * 0.7) stage.halo(this.w.color, 1.9);
  }
}

// ---------------------------------------------------------------- put together

export class ForgeShow extends Show {
  constructor(stage, key, opts) {
    super(stage, opts);
    const w = soulOf(key);
    this.key = key;
    this.w = w;
    const n = w.parts.length;
    this.n = n;
    stage.tall = 3.1;
    stage.wide = 3.3;
    stage.fit();
    stage.colors(w.color, w.glow);
    this.tones = [w.color, w.glow, WHITE];
    this.prism = key === 'rainbow' ? 1 : 0;
    this.core = new THREE.Group();
    this.group.add(this.core);
    this.rune = stage.rune(n, w.color, w.glow);
    const { mid } = soulBox(key);
    const big = stage.big(key);
    this.parts = w.parts.map((_, i) => {
      const p = stage.part(key, i);
      p.a = (i / n) * TAU;
      p.k = 0;
      p.to = p.mid.clone().sub(mid).multiplyScalar(big);
      p.small = Math.min(big, 0.62 / p.size);
      p.big = big;
      p.kit.shared.uIn.value = 0;
      this.core.add(p.group);
      return p;
    });
    // When each flies in, sooner and sooner after the one before.
    let t = 1.9;
    for (const [i, p] of this.parts.entries()) {
      p.go = t;
      p.lands = t + 0.62;
      t += 0.62 - 0.28 * (i / Math.max(1, n - 1));
    }
    this.end = this.parts.at(-1).lands + 0.25;
    this.blast = this.end + 1.9;
    this.wake = this.blast + 4;
    this.holdAt = this.wake + 3.2;
    this.spin = 0;
    this.turn = 0;
    this.ghost = null;
    this.cue(0, () => {
      this.sound('soul-hush');
      this.say('forging', { w });
    });
    for (const [i, p] of this.parts.entries()) {
      this.cue(0.5 + i * 0.1, () => stage.burst(this.where(p, 0.5), 16, { colors: this.tones, speed: 1, life: 0.8, size: 0.05 }));
      this.cue(p.go, () => this.sound('soul-draw', { i, n }));
      this.cue(p.lands, () => this.locks(p, i));
    }
    this.cue(this.end, () => {
      this.sound('soul-rise', { secs: this.blast - this.end });
      stage.gather(V(), 260, { colors: this.tones, from: 3, secs: 1.8, size: 0.07, swirl: 7, spread: 1.2 });
    });
    this.cue(this.end + 0.9, () => stage.gather(V(), 300, { colors: [WHITE, w.color], from: 2.4, secs: 0.9, size: 0.09, swirl: 9, spread: 0.3 }));
    this.cue(this.blast, () => this.whole());
    this.cue(this.blast + 1, () => this.say('forged', { w }));
    this.cue(this.wake, () => this.beats(0.35));
    this.cue(this.wake + 0.62, () => this.beats(0.5));
    this.cue(this.wake + 1.15, () => this.beats(0.75));
    this.cue(this.wake + 1.55, () => this.wakes());
    this.cue(this.wake + 2.5, () => this.say('awake', { w }));
  }

  // Where a part is on its way in (k: how far).
  where(p, t) {
    const e = easeIO(p.k);
    const a = p.a + t * 0.5 + e * 3.4;
    const r = 1.42 * (1 - e);
    return V(Math.sin(a) * r + p.to.x * e, (0.05 + Math.sin(t * 1.4 + p.a * 2) * 0.12) * (1 - e) + p.to.y * e, Math.cos(a) * r + p.to.z * e);
  }

  locks(p, i) {
    const { stage, w } = this;
    this.sound('soul-snap', { i });
    p.kit.shared.uHot.value = 1.4;
    for (const q of this.parts) if (q.k >= 1) q.kit.shared.uHot.value = Math.max(q.kit.shared.uHot.value, 0.5);
    const at = this.core.localToWorld(p.to.clone());
    stage.burst(at, 60, { colors: this.tones, speed: 2.6, life: 0.8, size: 0.065, drag: 3 });
    stage.ring(at, { color: w.color, size: 0.95, secs: 0.5, thin: 0.14, prism: this.prism });
    stage.flash(0.16 + 0.1 * (i / this.n), w.color, 7);
    stage.shake(0.35 + 0.3 * (i / this.n));
    this.spin += 1.2;
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * TAU;
      stage.arc(V(Math.sin(a) * 1.7, -1.12, Math.cos(a) * 1.7), at, w.glow, 0.28, { width: 0.035 });
    }
  }

  whole() {
    const { stage, w } = this;
    this.sound('soul-forged');
    stage.flash(1.25, WHITE, 6.5);
    stage.shake(1.3);
    stage.ring(V(), { color: WHITE, size: 5, secs: 1.1, thin: 0.06, prism: this.prism });
    stage.ring(V(), { color: w.color, size: 3.4, secs: 1.4, thin: 0.05, prism: this.prism });
    stage.ring(V(), { color: w.glow, size: 4.4, secs: 1.6, thin: 0.04, turn: [0.9, 0.5, 0] });
    stage.ring(V(0, -1.1, 0), { color: w.color, size: 6, secs: 1.7, thin: 0.04, flat: true });
    stage.burst(V(), 620, { colors: this.tones, speed: 6, life: 2, size: 0.1, drag: 2.1, gravity: 0.6 });
    stage.burst(V(), 160, { colors: [WHITE, w.color], speed: 2, life: 3.4, size: 0.12, drag: 1, swirl: 0.5 });
    for (const p of this.parts) p.kit.shared.uHot.value = 2.4;
    // Spun right round, and coming to rest facing whoever is looking.
    this.from = this.turn;
    this.to = Math.ceil((this.turn + 13) / TAU) * TAU;
  }

  beats(k) {
    const { stage, w } = this;
    this.sound('soul-snap', { i: 0 });
    stage.shake(k);
    stage.ring(V(), { color: w.glow, size: 2 + k * 2, secs: 0.8, thin: 0.1 });
    for (const p of this.parts) p.kit.shared.uHot.value = 0.35 + k * 0.8;
    stage.burst(V(), 40, { colors: [w.glow, WHITE], speed: 2, life: 0.7, size: 0.06 });
  }

  wakes() {
    const { stage, w } = this;
    this.sound('soul-wake');
    stage.flash(0.8, w.glow, 3.5);
    stage.shake(1.5);
    stage.ring(V(0, 0.2, -0.6), { color: w.glow, size: 5, secs: 1.2, thin: 0.1, prism: this.prism });
    stage.burst(V(0, 0.2, -0.5), 320, { colors: [w.glow, w.color, WHITE], speed: 4.6, life: 1.6, size: 0.09, drag: 2 });
    this.ghost = ghostOf(stage, this.key);
    this.group.add(this.ghost.group);
    this.wokeAt = this.t;
  }

  step(t, dt) {
    const { stage } = this;
    const u = stage.sky.uniforms;
    this.rune.uDraw.value = easeIO(t / 1.6);
    u.uLight.value = 0.12 + 0.2 * easeOut(t / 1.5);
    const rising = clamp01((t - this.end) / (this.blast - this.end));
    const done = t - this.blast;
    const waking = t - this.wake;
    if (t < this.blast) {
      this.spin = Math.max(0.35, this.spin - dt * 1.6) + rising * dt * 22;
      u.uPull.value = rising * 1.3;
      u.uLight.value += rising * 0.8;
      stage.cam.dist = 4.3 - easeIn(rising) * 1.3;
      stage.cam.yaw = Math.sin(t * 0.35) * 0.25;
      stage.cam.pitch = 0.2 - rising * 0.12;
    } else {
      this.turn = this.from + (this.to - this.from) * (1 - Math.exp(-done * 1.9)) + Math.sin(done * 0.8) * 0.5 * clamp01(done / 2);
      u.uPull.value = Math.max(0, 1.3 - done * 3);
      u.uLight.value = 0.6 + 0.8 * Math.exp(-done * 1.4);
      u.uRays.value = 0.95 * easeOut(done / 0.8);
      u.uPrism.value = this.prism;
      stage.cam.dist = 2.8 + 0.75 * easeOut(done / 1.6);
      stage.cam.yaw = Math.sin(t * 0.3) * 0.16;
      stage.cam.pitch = 0.08;
      stage.embers(dt, { colors: this.tones, rate: 50 });
    }
    if (waking > 0) {
      const k = clamp01(waking / 1.5);
      u.uDark.value = k * 0.55;
      u.uRays.value *= 1 - k * 0.75;
      u.uLight.value *= 1 - k * 0.35;
      this.rune.uOn.value = 1 + Math.sin(t * 9) * 0.25 * k;
      stage.cam.dist = 3.55 + 1.15 * easeIO(waking / 1.4);
    }
    if (t < this.blast) this.turn += this.spin * dt;
    this.core.rotation.y = this.turn;
    for (const p of this.parts) {
      p.k = clamp01((t - p.go) / 0.62);
      const at = this.where(p, t);
      const e = easeIO(p.k);
      p.group.position.copy(at);
      const s = p.small + (p.big - p.small) * easeIn(e);
      const come = back(clamp01((t - 0.35 - p.i * 0.1) / 0.5));
      p.group.scale.setScalar(Math.max(0.001, s * come));
      p.group.rotation.set((1 - e) * (0.3 + t * 0.5), (1 - e) * (p.a + t * 1.2), (1 - e) * 0.4);
      p.kit.shared.uIn.value = clamp01((t - 0.35 - p.i * 0.1) / 0.7);
      const hot = p.kit.shared.uHot;
      hot.value = Math.max(t < this.blast ? rising * rising * 1.5 : 0, hot.value - dt * (t < this.blast ? 2.4 : 1.5));
      if (p.k > 0.05 && p.k < 1 && Math.random() < dt * 70) {
        const q = this.core.localToWorld(at.clone());
        stage.sparks.add(q, { v: V((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6), life: 0.7, size: 0.06, color: this.tones[Math.floor(Math.random() * 3)] });
      }
    }
    // Lightning all about it as it gathers.
    if (rising > 0 && t < this.blast && Math.random() < dt * (4 + rising * 26)) {
      const a = Math.random() * TAU;
      const far = 1.4 + Math.random() * 1.2;
      stage.arc(V(Math.sin(a) * far, (Math.random() - 0.5) * 2.4, Math.cos(a) * far * 0.6), V((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2, 0), Math.random() < 0.5 ? this.w.glow : this.w.color, 0.18, { width: 0.04 + rising * 0.03 });
      if (Math.random() < 0.3) stage.shake(0.3 + rising * 0.4);
    }
    if (this.ghost) {
      const s = t - this.wokeAt;
      this.ghost.update(dt, s);
      const k = back(clamp01(s / 0.9));
      this.ghost.group.scale.setScalar(Math.max(0.001, this.ghost.k * k));
      this.ghost.group.position.set(0, 0.06 + Math.sin(s * 1.3) * 0.05, -1.6 + Math.min(0.3, s * 0.1));
      if (Math.random() < dt * 2.5) stage.arc(V((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2, -1), V(0, (Math.random() - 0.5) * 1.2, 0), this.w.glow, 0.2, { width: 0.03 });
    }
  }
}

// The soul of a weapon, as a ghost of light on the stage: { group, k (how big it is
// to be), update(dt, t) }.
export function ghostOf(stage, key) {
  const w = soulOf(key);
  const fig = soulFigure(key);
  const body = stage.ghost(w.glow, { strength: 0.85, lines: 0.35, flow: 0.8 });
  const eyes = stage.ghost(WHITE, { strength: { toon: 0.85, bells: 1.5 }[key] ?? 2.4, lines: 0 });
  eyes.fragmentShader = 'uniform vec3 uColor; uniform float uOn; void main() { gl_FragColor = vec4(uColor * uOn, 1.0); }';
  // (Only what is nearest of it is seen: the light of all that is behind would be
  // too much of it.)
  const near = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 4 });
  stage.extras.push(near);
  const meshes = [];
  fig.group.traverse((o) => o.isMesh && meshes.push(o));
  for (const o of meshes) {
    if (o.userData.plume) {
      o.removeFromParent();
      continue;
    }
    o.material = o.userData.eye ? eyes : body;
    o.castShadow = false;
    o.receiveShadow = false;
    o.renderOrder = 2;
    const front = new THREE.Mesh(o.geometry, near);
    front.renderOrder = 1;
    o.add(front);
  }
  const group = new THREE.Group();
  fig.group.position.y = -fig.height * 0.5;
  if (key === 'rainbow') fig.group.rotation.y = -0.75;
  group.add(fig.group);
  return {
    group,
    k: (key === 'rainbow' ? 2.6 : 3) / (fig.height + 0.45),
    update(dt, t) {
      fig.update(dt, { state: 'idle', time: t });
    },
  };
}

// ---------------------------------------------------------------- beaten

export class WonShow extends Show {
  constructor(stage, key, spec, opts) {
    super(stage, opts);
    const w = soulOf(key);
    this.w = w;
    stage.tall = 3;
    stage.wide = 3;
    stage.fit();
    stage.colors(w.color, w.glow);
    this.tones = [w.color, w.glow, WHITE];
    this.prism = key === 'rainbow' ? 1 : 0;
    this.weapon = stage.weapon(spec);
    this.group.add(this.weapon.group);
    this.weapon.kit.shared.uIn.value = 0;
    this.ghost = ghostOf(stage, key);
    this.group.add(this.ghost.group);
    this.orb = this.ball(w.glow, 0.001);
    this.melt = 1.5;
    this.dive = 4.1;
    this.holdAt = this.dive + 1.8;
    this.rune = stage.rune(w.parts.length, w.color, w.glow);
    this.cue(0, () => {
      this.sound('soul-gone');
      this.say('beaten', { w });
    });
    this.cue(this.melt, () => {
      stage.flash(0.5, w.glow);
      stage.burst(V(0, 0.3, -1.2), 260, { colors: this.tones, speed: 2.6, life: 1.4, size: 0.08, drag: 2 });
    });
    this.cue(this.dive - 1.4, () => this.sound('soul-rise', { secs: 1.4 }));
    this.cue(this.dive, () => {
      this.sound('soul-won');
      stage.flash(1.2, WHITE, 6.5);
      stage.shake(1);
      for (const [size, secs, c] of [[4.6, 1.2, WHITE], [3, 1.5, w.color], [3.8, 1.8, w.glow]]) stage.ring(V(), { color: c, size, secs, prism: this.prism });
      stage.ring(V(0, -1.1, 0), { color: w.color, size: 6, secs: 1.8, thin: 0.04, flat: true });
      stage.burst(V(), 560, { colors: this.tones, speed: 5.4, life: 2, size: 0.1, drag: 2.1, gravity: 0.6 });
      stage.burst(V(), 160, { colors: [WHITE, w.color], speed: 1.8, life: 3.4, size: 0.12, drag: 1, swirl: 0.5 });
      this.weapon.kit.shared.uHot.value = 2.2;
    });
    this.cue(this.dive + 0.9, () => this.say('won', { w, spec }));
  }

  step(t, dt) {
    const { stage, weapon } = this;
    const u = stage.sky.uniforms;
    this.rune.uDraw.value = easeIO(t / 1.4);
    weapon.kit.shared.uIn.value = clamp01(t / 1.1);
    weapon.kit.shared.uHot.value = Math.max(0, weapon.kit.shared.uHot.value - dt * 1.5);
    const s = t - this.melt;
    const g = clamp01(1 - s / 0.8);
    this.ghost.update(dt, t);
    this.ghost.group.scale.setScalar(Math.max(0.001, this.ghost.k * (s < 0 ? 1 : easeIn(g))));
    this.ghost.group.position.set(0, 0.1 - clamp01(t / this.melt) * 0.25, -1.4);
    this.ghost.group.rotation.x = clamp01(t / this.melt) * 0.4;
    this.ghost.group.visible = g > 0.02;
    u.uDark.value = 0.4 * (1 - clamp01((t - this.dive) * 3));
    if (s > 0 && t < this.dive) {
      // The light of it, twice round, and in.
      const k = clamp01(s / (this.dive - this.melt));
      const a = easeIO(k) * TAU * 2.5 + Math.PI;
      const r = 1.3 * (1 - easeIn(k)) + 0.02;
      this.orb.position.set(Math.sin(a) * r, Math.sin(k * 7) * 0.7 * (1 - k), Math.cos(a) * r);
      this.orb.scale.setScalar(0.04 + 0.1 * easeOut(s / 0.6));
      for (let i = 0; i < 3; i++) stage.sparks.add(this.orb.position, { v: V((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7), life: 0.9, size: 0.09, drag: 1.5, color: this.tones[i % 3] });
    }
    this.orb.visible = s > 0 && t < this.dive;
    const done = t - this.dive;
    weapon.group.rotation.y = done > 0 ? TAU * 2 * (1 - Math.exp(-done * 1.7)) + Math.sin(done * 0.8) * 0.5 * clamp01(done / 2) : Math.sin(t * 0.8) * 0.4 * clamp01((this.dive - t) * 2);
    weapon.group.position.y = Math.sin(t * 1.4) * 0.05;
    u.uLight.value = done > 0 ? 0.6 + 0.8 * Math.exp(-done * 1.4) : 0.25 + 0.5 * clamp01((t - this.dive + 1.4) / 1.4);
    u.uRays.value = done > 0 ? 0.95 * easeOut(done / 0.8) : 0;
    u.uPrism.value = this.prism;
    stage.cam.dist = done > 0 ? 3.3 + 1 * easeOut(done / 1.4) : 4.3 - clamp01(t / this.dive) * 1;
    stage.cam.yaw = Math.sin(t * 0.4) * 0.15;
    stage.embers(dt, { colors: this.tones, rate: done > 0 ? 54 : 14 });
  }
}

// ---------------------------------------------------------------- two made one

export class FuseShow extends Show {
  constructor(stage, specA, specB, specC, opts) {
    super(stage, opts);
    const a = soulOf(specA.souls[0]);
    const b = soulOf(specB.souls[0]);
    this.spec = specC;
    this.many = specC.souls.length;
    stage.tall = 3.1;
    stage.wide = 4;
    stage.fit();
    stage.colors(a.color, b.color);
    this.tones = [a.color, a.glow, b.color, b.glow, WHITE];
    this.all = [...specC.souls.map((k) => soulOf(k).color), WHITE];
    this.two = [
      { w: stage.weapon(specA), side: -1, c: a },
      { w: stage.weapon(specB), side: 1, c: b },
    ];
    for (const q of this.two) {
      q.w.kit.shared.uIn.value = 0;
      this.group.add(q.w.group);
    }
    this.one = stage.weapon(specC);
    this.one.group.visible = false;
    this.group.add(this.one.group);
    this.rune = stage.rune(Math.max(5, this.many + 3), a.color, b.color, -1.15, 2.7);
    // A hole in the dark, and the light going round into it.
    this.hole = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.hole.scale.setScalar(0.001);
    this.hole.renderOrder = 9;
    this.group.add(this.hole);
    stage.extras.push(this.hole.material);
    this.round = 1.4;
    this.fall = 4.9;
    this.nova = 5.9;
    this.holdAt = this.nova + 2;
    this.angle = 0;
    this.cue(0, () => {
      this.sound('soul-hush');
      this.say('fusing', { a: specA, b: specB });
    });
    this.cue(0.1, () => stage.burst(V(-1.3, 0, 0), 90, { colors: [a.color, a.glow, WHITE], speed: 2, life: 1.1, size: 0.07 }));
    this.cue(0.35, () => stage.burst(V(1.3, 0, 0), 90, { colors: [b.color, b.glow, WHITE], speed: 2, life: 1.1, size: 0.07 }));
    this.cue(this.round, () => this.sound('soul-circle', { secs: this.fall - this.round }));
    this.cue(this.fall, () => {
      this.sound('soul-hole');
      stage.gather(V(), 420, { colors: this.tones, from: 3.4, secs: 0.9, size: 0.08, swirl: 10, spread: 0.25 });
      stage.shake(0.8);
    });
    this.cue(this.nova, () => this.bursts());
    this.cue(this.nova + 1.1, () => this.say('fused', { a: specA, b: specB, c: specC }));
  }

  bursts() {
    const { stage } = this;
    this.sound('soul-nova');
    for (const q of this.two) q.w.group.visible = false;
    this.hole.visible = false;
    this.one.group.visible = true;
    this.one.kit.shared.uHot.value = 2.6;
    // (Only the one to be seen now, so nearer.)
    stage.wide = 2.6;
    stage.fit();
    stage.flash(1.4, WHITE, 5.2);
    stage.shake(1.6);
    stage.ring(V(), { color: WHITE, size: 6, secs: 1.2, thin: 0.07, prism: 1 });
    stage.ring(V(), { color: this.all[0], size: 4.4, secs: 1.6, thin: 0.05, prism: 1 });
    stage.ring(V(), { color: this.all[1 % this.all.length], size: 5.2, secs: 1.8, thin: 0.04, turn: [1.1, 0.4, 0] });
    stage.ring(V(), { color: this.all[2 % this.all.length], size: 5.2, secs: 2, thin: 0.04, turn: [-0.9, 0.8, 0.3] });
    stage.ring(V(0, -1.1, 0), { color: WHITE, size: 7, secs: 1.9, thin: 0.045, flat: true, prism: 1 });
    stage.burst(V(), 900, { colors: this.all, speed: 7, life: 2.3, size: 0.105, drag: 2, gravity: 0.5 });
    stage.burst(V(), 260, { colors: this.all, speed: 2.2, life: 3.8, size: 0.13, drag: 0.9, swirl: 0.7 });
  }

  step(t, dt) {
    const { stage } = this;
    const u = stage.sky.uniforms;
    this.rune.uDraw.value = easeIO(t / 1.3);
    const k = clamp01((t - this.round) / (this.fall - this.round));
    const f = clamp01((t - this.fall) / 0.75);
    if (t < this.nova) {
      // Round each other, faster and faster, nearer and nearer.
      this.angle += dt * (0.25 + 13 * k * k * (t > this.round ? 1 : 0) + f * 26);
      const r = (1.3 - 0.75 * easeIO(k)) * (1 - easeIn(f));
      for (const q of this.two) {
        const g = q.w.group;
        g.position.set(Math.cos(this.angle) * q.side * r, Math.sin(t * 1.6 + q.side) * 0.06 * (1 - k), Math.sin(this.angle) * q.side * r);
        g.rotation.set(0, -this.angle + t * 0.6, -q.side * (0.18 + 0.25 * k));
        g.scale.setScalar(Math.max(0.001, back(clamp01((t - (q.side > 0 ? 0.3 : 0.05)) / 0.6)) * (1 - 0.22 * k) * (1 - easeIn(f))));
        q.w.kit.shared.uIn.value = clamp01((t - (q.side > 0 ? 0.3 : 0.05)) / 0.9);
        q.w.kit.shared.uHot.value = 0.9 * k * k + f * 2;
        stage.turnMoons(q.w, t, 0.5);
        if (k > 0.05 && Math.random() < dt * (30 + 120 * k)) {
          const p = g.position.clone().add(V(0, (Math.random() - 0.5) * 1.4, 0));
          const v = V(-Math.sin(this.angle), 0, Math.cos(this.angle)).multiplyScalar(q.side * -(0.6 + k * 1.6));
          stage.sparks.add(p, { v, life: 0.8, size: 0.075, drag: 1.5, color: [q.c.color, q.c.glow, WHITE][Math.floor(Math.random() * 3)], twinkle: Math.random() });
        }
      }
      if (t > this.round && f === 0 && Math.random() < dt * (3 + 30 * k)) {
        const [p, q] = this.two;
        stage.arc(() => p.w.group.position.clone().add(V(0, (Math.random() - 0.5) * 1.1, 0)), () => q.w.group.position.clone().add(V(0, (Math.random() - 0.5) * 1.1, 0)), this.tones[Math.floor(Math.random() * 5)], 0.16, { width: 0.03 + 0.04 * k });
        stage.shake(0.15 + 0.45 * k);
      }
      u.uPull.value = k * 1.4 + easeIn(f) * 2.4;
      u.uLight.value = (0.15 + 0.5 * k) * (1 - easeOut(f));
      u.uDark.value = easeIn(f) * 0.9;
      this.hole.scale.setScalar(Math.max(0.001, f > 0 ? 0.34 * Math.sin(clamp01((t - this.fall) / (this.nova - this.fall)) * Math.PI) + 0.001 : 0.001));
      stage.cam.dist = 4.5 - 0.9 * easeIO(k) + 0.35 * f;
      stage.cam.pitch = 0.16 - 0.1 * k;
      stage.cam.roll = Math.sin(t * 2) * 0.03 * k;
      return;
    }
    const s = t - this.nova;
    this.one.kit.shared.uHot.value = Math.max(0, 2.6 * Math.exp(-s * 1.7) - 0.02);
    this.one.group.scale.setScalar(Math.max(0.001, back(Math.min(1, s / 0.7))));
    this.one.group.rotation.y = TAU * 3 * (1 - Math.exp(-s * 1.4)) + Math.sin(s * 0.8) * 0.5 * clamp01(s / 2);
    this.one.group.position.y = Math.sin(s * 1.4) * 0.05;
    stage.turnMoons(this.one, t, 0.2 + 0.42 * easeOut(s / 1.2));
    u.uPull.value = Math.max(0, 2 - s * 5);
    u.uDark.value = Math.max(0, 0.9 - s * 4);
    u.uPrism.value = 0.35 + 0.1 * this.many;
    u.uLight.value = 0.34 + 1.1 * Math.exp(-s * 1.2);
    u.uRays.value = (0.82 + 0.4 * Math.exp(-s)) * easeOut(s / 0.7);
    stage.cam.roll = 0;
    stage.cam.dist = 2.9 + 1.5 * easeOut(s / 1.5);
    stage.cam.pitch = 0.08;
    stage.cam.yaw = Math.sin(s * 0.4) * 0.14;
    stage.embers(dt, { colors: this.all, rate: 64 });
    if (s > 1.8 && Math.random() < dt * 0.8) stage.halo(this.all[Math.floor(Math.random() * this.all.length)], 2.1);
  }
}

// ---------------------------------------------------------------- taken apart

export class SplitShow extends Show {
  constructor(stage, spec, specs, opts) {
    super(stage, opts);
    stage.tall = 3.1;
    stage.wide = 1.6 + specs.length * 1.1;
    stage.fit();
    this.all = [...spec.souls.map((k) => soulOf(k).color), WHITE];
    stage.colors(this.all[0], this.all[1 % this.all.length]);
    this.one = stage.weapon(spec);
    this.group.add(this.one.group);
    this.many = specs.map((s, i) => {
      const w = stage.weapon(s);
      w.group.visible = false;
      this.group.add(w.group);
      return { w, x: (i - (specs.length - 1) / 2) * 1.15 };
    });
    this.holdAt = 2.6;
    this.cue(0.1, () => this.sound('soul-rise', { secs: 0.9 }));
    this.cue(1, () => {
      this.sound('soul-split');
      stage.flash(1.1, WHITE, 4);
      stage.shake(0.8);
      stage.ring(V(), { color: WHITE, size: 4, secs: 1, prism: 1 });
      stage.burst(V(), 320, { colors: this.all, speed: 4.4, life: 1.5, size: 0.085, drag: 2.2 });
      this.one.group.visible = false;
      for (const q of this.many) {
        q.w.group.visible = true;
        q.w.kit.shared.uHot.value = 1.6;
      }
    });
    this.cue(1.5, () => this.say('split', { spec, specs }));
  }

  step(t, dt) {
    const { stage } = this;
    const u = stage.sky.uniforms;
    const k = clamp01(t / 1);
    if (t < 1) {
      this.one.kit.shared.uHot.value = k * k * 1.6;
      this.one.group.rotation.y = t * 2 + Math.sin(t * 70) * 0.05 * k;
      this.one.group.position.x = Math.sin(t * 83) * 0.02 * k;
      stage.turnMoons(this.one, t);
      u.uLight.value = 0.2 + k * 0.5;
      return;
    }
    const s = t - 1;
    for (const q of this.many) {
      q.w.group.position.x = q.x * easeOut(s / 0.8);
      q.w.group.rotation.y = TAU * (1 - Math.exp(-s * 2)) + Math.sin(s * 0.8 + q.x) * 0.5 * clamp01(s / 2);
      q.w.group.position.y = Math.sin(t * 1.4 + q.x) * 0.05;
      q.w.kit.shared.uHot.value = Math.max(0, q.w.kit.shared.uHot.value - dt * 1.6);
    }
    u.uLight.value = 0.5 + 0.5 * Math.exp(-s * 1.5);
    u.uRays.value = 0.55 * easeOut(s);
    u.uPrism.value = 0.5;
    stage.embers(dt, { colors: this.all, rate: 30 });
  }
}

// ---------------------------------------------------------------- at the forge

// A weapon's plan, in the forge's own window: the parts there are, and the rest of
// it in thin blue light; or the weapon itself.
export class PlanShow extends Show {
  constructor(stage, key, have, spec = null) {
    super(stage);
    const w = soulOf(key);
    this.holdAt = 0;
    stage.colors(w.color, w.glow);
    stage.tall = spec ? 2.3 : 2.25;
    stage.wide = 1.9;
    stage.fit();
    this.tones = [w.color, w.glow];
    this.whole = null;
    this.parts = [];
    const u = stage.sky.uniforms;
    u.uLight.value = 0.16;
    if (spec) {
      this.whole = stage.weapon(spec);
      this.group.add(this.whole.group);
      u.uLight.value = 0.42;
      u.uRays.value = 0.32;
      u.uPrism.value = spec.souls.length > 1 ? 0.5 : 0;
      return;
    }
    this.ghostMat = stage.ghost(w.glow, { strength: 0.62 });
    const { mid } = soulBox(key);
    const big = stage.big(key);
    this.parts = w.parts.map((_, i) => {
      const p = stage.part(key, i);
      p.group.position.copy(p.mid).sub(mid).multiplyScalar(big);
      p.group.scale.setScalar(big);
      if (!have[i]) p.model.traverse((o) => o.isMesh && (o.material = this.ghostMat));
      this.group.add(p.group);
      return p;
    });
    u.uLight.value = 0.1 + (0.3 * have.filter(Boolean).length) / w.parts.length;
  }

  step(t, dt) {
    this.group.rotation.y = t * 0.55;
    this.group.position.y = Math.sin(t * 1.2) * 0.03;
    if (this.whole) {
      this.stage.turnMoons(this.whole, t, 0.5);
      this.stage.embers(dt, { colors: this.tones, rate: 14, r: 1 });
    }
  }
}
