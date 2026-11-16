// A Mummy as a monster (shared/monsters.js), of the desert islands only: a
// little monster wrapped head to foot in bandages, strips of pale cloth wound
// round and round its body and its head with a gap left for its eyes, its
// arms held out stiff in front of it as it shambles after you, slower than
// you walk. Bopped, a bandage comes loose and unravels off it — the end
// flapping about loose as it hops back — and then it winds itself round
// again, tight as ever, as it comes back at you. One jump on it, or three
// bops, and it goes pop in a flurry of cloth (game.js popBurst).
import * as THREE from '../../vendor/three.module.js';
import { blobShadow, capsule, cylinder, mesh, sphere, toon, torus } from './toon.js';

const DARK = '#2b2530';
// Its bandages, a shade of cream of its own (by which one it is), and what
// shows through where the cloth has slipped.
const WRAPS = ['#efe4c8', '#e7dabc', '#f4ecd6'];
const UNDER = '#d9c9a3';
// How long it takes to wind a knocked-loose bandage back round itself:
// about as long as it takes to come back at you after the bop.
const REWRAP_SECS = 1.6;

export class MummyModel {
  // id: which one it is, for its bandages' own shade of cream.
  constructor(theme = 'sunny', id = 1) {
    const wraps = toon(WRAPS[Math.abs(id) % WRAPS.length]);
    const under = toon(UNDER);
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const b = this.body;
    // The body under the wrappings: a rounded trunk, the dark of it showing
    // through where the cloth has slipped.
    b.add(mesh(sphere(), under, 0, 0.42, 0, 0.3, 0.4, 0.26));
    // The wrappings: a strip wound round and round it, each turn a ring of
    // cloth, criss-crossing up its body. This group is what unravels.
    this.wrap = new THREE.Group();
    b.add(this.wrap);
    for (let i = 0; i < 9; i++) {
      const ring = mesh(torus(0.27 - Math.abs(i - 4) * 0.012, 0.055, Math.PI * 1.35), wraps, 0, 0.12 + i * 0.075, 0);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = (i % 2 ? 1 : -1) * 0.5 + i * 0.3;
      this.wrap.add(ring);
    }
    // The head: a smaller lump of it, wrapped too, with a gap for its face.
    const head = new THREE.Group();
    head.position.set(0, 0.82, 0.02);
    b.add(head);
    this.head = head;
    head.add(mesh(sphere(), under, 0, 0, 0, 0.21, 0.19, 0.2));
    for (let i = 0; i < 4; i++) {
      const band = mesh(torus(0.19 - i * 0.008, 0.045, Math.PI * 1.2), wraps, 0, -0.08 + i * 0.065, 0);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = (i % 2 ? 0.9 : -0.7) + i * 0.4;
      head.add(band);
    }
    // Two cross eyes in the gap, which glow at night, and a frown.
    this.eyeWhite = toon('#fff7d6');
    this.eyeGlow = toon('#ffd27a', { emissive: 0.9 });
    this.eyes = [];
    this.brows = [];
    for (const side of [-1, 1]) {
      const eye = mesh(sphere(1, 12, 8), this.eyeWhite, side * 0.08, 0.01, 0.17, 0.058, 0.066, 0.032);
      head.add(eye);
      this.eyes.push(eye);
      head.add(mesh(sphere(1, 8, 6), toon(DARK), side * 0.072, 0, 0.19, 0.028, 0.032, 0.016));
      const brow = mesh(sphere(1, 8, 6), toon(DARK), side * 0.072, 0.09, 0.16, 0.058, 0.014, 0.018);
      brow.rotation.z = side * 0.45;
      head.add(brow);
      this.brows.push({ mesh: brow, side });
    }
    this.mouth = mesh(sphere(1, 10, 6), toon('#3a1f3f'), 0, -0.1, 0.16, 0.06, 0.018, 0.016);
    head.add(this.mouth);
    // Its arms held out stiff in front of it, wrapped to the hands, swinging
    // a little as it shambles.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.24, 0.52, 0.08);
      arm.rotation.x = -1.15;
      arm.add(mesh(cylinder(0.05, 0.06, 0.34, 6), wraps, 0, 0.1, 0));
      arm.add(mesh(sphere(1, 8, 6), under, 0, 0.28, 0, 0.055, 0.05, 0.055));
      b.add(arm);
      this.arms.push(arm);
    }
    // Little wrapped feet.
    for (const side of [-1, 1]) b.add(mesh(sphere(1, 10, 8), wraps, side * 0.12, 0.04, 0.05, 0.09, 0.05, 0.11));
    // The loose end of a bandage, hanging off its middle once one has come
    // undone (see bopped): nothing of it shows while it is wound tight.
    this.tail = mesh(capsule(0.03, 0.3, 4, 8), wraps, 0, 0.45, -0.2);
    this.tail.rotation.x = 0.4;
    this.tail.visible = false;
    b.add(this.tail);
    this.height = 1.0;
    this.center = 0.5;
    this.pick = 0.6;
    this.shadowScale = 1;
    this.seen = 70;
    this.shadow = blobShadow(0.45, 0.2);
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.squash = 0;
    // How far its bandages have unravelled: 0 wound tight, 1 hanging loose.
    this.unravel = 0;
  }

  // A bop knocked a bandage loose: it unravels off it (game.js monsterHit).
  bopped() {
    this.unravel = 1;
  }

  // state: idle, hop (shambling about), chase or giggle (shared/monsters.js).
  // air: how high it is over the ground. night: eyes aglow.
  update(dt, state, air = 0, night = false) {
    this.time += dt;
    const t = this.time;
    const y = this.group.position.y;
    if (this.lastY !== null && dt > 0) this.vy += ((y - this.lastY) / dt - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    if (air < 0.05 && this.vy < -1.5) this.squash = 0.35;
    this.squash = Math.max(0, this.squash - dt * 2.2);
    const sy = 1 - this.squash + Math.sin(t * (state === 'chase' ? 6 : 2.2)) * 0.02;
    this.body.scale.set(1 + this.squash * 0.4, sy, 1 + this.squash * 0.4);
    this.body.rotation.set(0, 0, 0);
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.16;
    // Leaned forward a little as it shambles, arms out in front of it.
    this.body.rotation.x = state === 'hop' || state === 'chase' ? 0.1 : 0.04;
    this.head.rotation.z = Math.sin(t * (state === 'chase' ? 5 : 2)) * 0.08;
    this.arms.forEach((a, i) => {
      a.rotation.z = Math.sin(t * (state === 'chase' ? 7 : 3) + i * Math.PI) * 0.12;
    });
    // The bandage it lost hangs off it, the end flapping loose, and winds
    // itself back on as it comes back at you.
    this.unravel = Math.max(0, this.unravel - dt / REWRAP_SECS);
    const k = this.unravel * this.unravel;
    this.tail.visible = this.unravel > 0.02;
    this.tail.position.set(Math.sin(t * 9) * 0.1 * k, 0.45 - k * 0.1, -0.2 - k * 0.15);
    this.tail.rotation.set(0.4 + Math.sin(t * 11) * 0.5 * k, 0, Math.cos(t * 9) * 0.4 * k);
    this.tail.scale.setScalar(1 + k * 0.4);
    this.wrap.scale.set(1 - k * 0.08, 1 - k * 0.18, 1 - k * 0.08);
    this.wrap.rotation.y = -k * 2.2;
    this.mouth.scale.y = state === 'giggle' ? 0.05 : 0.018;
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
