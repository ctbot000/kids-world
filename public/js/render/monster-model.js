// A monster (shared/monsters.js): a grumpy jelly blob with cross eyebrows and
// two little teeth, squashing as it lands and stretching as it hops, its
// eyes glowing at night. A purple one on a sunny island, a frosty blue one
// on a snowy one, and a sour green one on a candy one. A Big Bruiser is one
// as tall as a player, deep red, with two horns; a Spiky a blob in orange
// with a crest of spikes on its back.
import * as THREE from '../../vendor/three.module.js';
import { blobShadow, cone, mesh, onSurface, sphere, toon } from './toon.js';

const JELLY = { sunny: ['#9b6bff', '#6c3fd6'], snowy: ['#5fc7e6', '#2f8fb8'], candy: ['#8ee05a', '#4fa82e'], flat: ['#9b6bff', '#6c3fd6'] };
// The tougher kinds: their colours, and how much bigger than a blob.
const KIND_JELLY = { big: ['#e2536a', '#9c2440'], spiky: ['#ffa53d', '#d4621a'] };
const KIND_SCALE = { big: 1.62, spiky: 1.07 };
const R = 0.42;
const H = 0.36;

export class MonsterModel {
  // kind: 'blob', 'big' or 'spiky' (shared/monsters.js).
  constructor(theme = 'sunny', kind = 'blob') {
    const [skin, core] = KIND_JELLY[kind] ?? JELLY[theme] ?? JELLY.sunny;
    const k = KIND_SCALE[kind] ?? 1;
    this.group = new THREE.Group();
    this.group.scale.setScalar(k);
    this.body = new THREE.Group();
    this.group.add(this.body);
    const b = this.body;
    // A see-through jelly round a softer layer, round a darker middle, with
    // bubbles rising through it.
    b.add(mesh(sphere(), toon(skin, { transparent: true, opacity: 0.82 }), 0, H, 0, R, H, R));
    b.add(mesh(sphere(), toon(skin, { transparent: true, opacity: 0.5 }), 0, H * 0.95, 0, R * 0.8, H * 0.8, R * 0.8));
    b.add(mesh(sphere(), toon(core), 0, H * 0.85, -0.04, R * 0.55, H * 0.5, R * 0.55));
    b.add(mesh(sphere(1, 10, 8), toon('#ffffff', { emissive: 0.4, transparent: true, opacity: 0.7 }), -0.16, H * 1.6, 0.2, 0.07, 0.04, 0.05));
    for (const [x, y, z, r] of [
      [0.12, H * 1.45, -0.06, 0.035],
      [-0.08, H * 1.2, 0.12, 0.028],
      [0.05, H * 0.7, 0.16, 0.022],
    ]) {
      b.add(mesh(sphere(1, 8, 6), toon('#ffffff', { transparent: true, opacity: 0.35 }), x, y, z, r));
    }
    // Little jelly feet under it.
    for (const side of [-1, 1]) b.add(mesh(sphere(1, 12, 8), toon(skin, { transparent: true, opacity: 0.82 }), side * 0.16, 0.03, 0.05, 0.09, 0.045, 0.1));
    // Eyes, which glow at night.
    this.eyeWhite = toon('#fff7d6');
    this.eyeGlow = toon('#fff27a', { emissive: 0.9 });
    this.eyes = [];
    this.brows = [];
    for (const side of [-1, 1]) {
      const p = onSurface(R, H, R, side * 0.14, 0.06, 0.005);
      const eye = mesh(sphere(1, 14, 10), this.eyeWhite, p.x, p.y + H, p.z, 0.082, 0.092, 0.04);
      b.add(eye);
      this.eyes.push(eye);
      b.add(mesh(sphere(1, 8, 6), toon('#2b2530'), p.x - side * 0.01, p.y + H - 0.012, p.z + 0.032, 0.038, 0.046, 0.02));
      b.add(mesh(sphere(1, 6, 4), toon('#ffffff', { emissive: 0.6 }), p.x + side * 0.012, p.y + H + 0.022, p.z + 0.042, 0.012, 0.014, 0.006));
      // Cross: the brows slope down towards the middle.
      const brow = mesh(sphere(1, 8, 6), toon('#2b2530'), p.x - side * 0.01, p.y + H + 0.105, p.z + 0.01, 0.085, 0.022, 0.025);
      brow.rotation.z = side * 0.45;
      b.add(brow);
      this.brows.push({ mesh: brow, side });
    }
    // A wide frown with two little teeth.
    const m = onSurface(R, H, R, 0, -0.12, 0.004);
    this.mouth = mesh(sphere(1, 12, 6), toon('#3a1f3f'), m.x, m.y + H, m.z, 0.11, 0.03, 0.02);
    b.add(this.mouth);
    for (const side of [-1, 1]) {
      const tooth = mesh(cone(0.022, 0.05, 6), toon('#ffffff'), side * 0.05, m.y + H - 0.005, m.z + 0.012);
      tooth.rotation.x = Math.PI;
      b.add(tooth);
    }
    // Horns on a Big Bruiser, curving up and out in two steps.
    if (kind === 'big') {
      for (const side of [-1, 1]) {
        const horn = new THREE.Group();
        horn.position.set(side * 0.2, H * 1.9, 0.05);
        horn.rotation.z = -side * 0.45;
        horn.add(mesh(cone(0.062, 0.16, 10), toon('#fff1d0'), 0, 0.08, 0));
        const tip = new THREE.Group();
        tip.position.y = 0.15;
        tip.rotation.z = -side * 0.5;
        tip.add(mesh(cone(0.042, 0.12, 10), toon('#f3dfae'), 0, 0.06, 0));
        horn.add(tip);
        b.add(horn);
      }
    }
    // Spikes on a Spiky: a crest from its head down its back, and a ring
    // of them round its sides (none over its face).
    if (kind === 'spiky') {
      const spike = toon('#fff4c2');
      const up = new THREE.Vector3(0, 1, 0);
      const add = (a, el, len) => {
        const x = R * Math.cos(el) * Math.sin(a);
        const y = H * Math.sin(el);
        const z = R * Math.cos(el) * Math.cos(a);
        const n = new THREE.Vector3(x / (R * R), y / (H * H), z / (R * R)).normalize();
        const s = mesh(cone(0.05, len, 6), spike, x + n.x * len * 0.4, H + y + n.y * len * 0.4, z + n.z * len * 0.4);
        s.quaternion.setFromUnitVectors(up, n);
        b.add(s);
      };
      for (const [el, len] of [[1.3, 0.15], [0.95, 0.19], [0.6, 0.21], [0.25, 0.17]]) add(Math.PI, el, len);
      for (let i = 0; i < 8; i++) add(Math.PI * (0.35 + (1.3 * i) / 7), 0.35, i % 2 ? 0.11 : 0.145);
    }
    this.height = H * 2 * k;
    this.center = H * k;
    this.pick = 0.5 * k;
    this.shadowScale = k;
    this.seen = 70;
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.squash = 0;
    const shadow = blobShadow(0.5, 0.2);
    this.shadow = shadow;
  }

  // state: idle, hop, chase or giggle (shared/monsters.js). air: how high it
  // is over the ground. night: eyes aglow.
  update(dt, state, air = 0, night = false) {
    this.time += dt;
    const t = this.time;
    const y = this.group.position.y;
    if (this.lastY !== null && dt > 0) this.vy += ((y - this.lastY) / dt - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    // Squashed flat as it lands, stretched tall going up and coming down.
    if (air < 0.05 && this.vy < -1.5) this.squash = 0.35;
    this.squash = Math.max(0, this.squash - dt * 2.2);
    const stretch = Math.min(0.25, Math.abs(this.vy) * 0.04) * (air > 0.05 ? 1 : 0);
    const wobble = Math.sin(t * (state === 'chase' ? 9 : 4)) * 0.04;
    const sy = 1 + stretch - this.squash + wobble;
    const sxz = 1 / Math.sqrt(Math.max(0.4, sy));
    this.body.scale.set(sxz, sy, sxz);
    this.body.rotation.set(0, 0, 0);
    // A giggle: shaking side to side, mouth wide open.
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.18;
    this.mouth.scale.y = state === 'giggle' ? 0.08 : 0.03;
    // Crosser still, chasing.
    for (const brow of this.brows) brow.mesh.rotation.z = brow.side * (state === 'chase' ? 0.65 : 0.4);
    const mat = night ? this.eyeGlow : this.eyeWhite;
    for (const eye of this.eyes) if (eye.material !== mat) eye.material = mat;
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
