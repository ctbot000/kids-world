// Mr. Mole as a monster (shared/monsters.js): a mound of raised earth
// gliding along under the ground, the dirt tumbling off its top as it goes,
// and then up out of it he pops — a round velvety body, two big paddle paws,
// a pink snout and whiskers, squinting cross — knocking the dirt off his
// nose as he looks about for a bop or a jump on him before he dips back
// under. All that shows while he is under is the mound: low and ridged, with
// a little pile of fresh dirt being thrown up behind it. The paws paddle
// quicker as he burrows at someone; up top, he blinks, and his snout
// twitches as he sniffs for whoever is near.
import * as THREE from '../../vendor/three.module.js';
import { blobShadow, cone, mesh, sphere, toon } from './toon.js';

const FUR = '#5a4636';
const FUR_DARK = '#463628';
const SNOUT = '#e8a8a0';
const DIRT = ['#6e5236', '#7d5f3f', '#5e442c'];

export class MoleModel {
  constructor(theme = 'sunny', id = 1) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const b = this.body;
    // The mole himself, hidden in the ground until he pops up (see update).
    this.mole = new THREE.Group();
    b.add(this.mole);
    this.mole.add(mesh(sphere(), toon(FUR), 0, 0.42, 0, 0.3, 0.26, 0.32));
    this.mole.add(mesh(sphere(), toon(FUR_DARK), 0, 0.3, -0.16, 0.22, 0.18, 0.22));
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0.18);
    this.mole.add(head);
    this.head = head;
    head.add(mesh(sphere(), toon(FUR), 0, 0, 0, 0.19, 0.16, 0.17));
    // The pink snout, tipped with two little nostrils, and whiskers out of
    // its sides that twitch as he sniffs.
    head.add(mesh(cone(0.07, 0.16, 8), toon(SNOUT), 0, -0.02, 0.16, 1, 1, 0.8));
    head.add(mesh(sphere(1, 6, 4), toon('#c97f78'), -0.022, -0.02, 0.24, 0.02, 0.018, 0.014));
    head.add(mesh(sphere(1, 6, 4), toon('#c97f78'), 0.022, -0.02, 0.24, 0.02, 0.018, 0.014));
    this.whiskers = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const w = mesh(cone(0.006, 0.16, 4), toon('#f0e0d0'), side * 0.14, -0.02 - k * 0.012, 0.14 + k * 0.01);
        w.rotation.z = side * (Math.PI / 2 + 0.25 - k * 0.16);
        w.rotation.y = side * 0.4;
        head.add(w);
        this.whiskers.push(w);
      }
    }
    // Two squinting eyes, nearly shut underground, wide open and cross above.
    this.eyes = [];
    this.eyeWhite = toon('#fff4d6');
    this.eyeGlow = toon('#ffb35c', { emissive: 0.9 });
    for (const side of [-1, 1]) {
      const eye = mesh(sphere(1, 10, 8), this.eyeWhite, side * 0.075, 0.05, 0.13, 0.035, 0.03, 0.02);
      eye.scale.y = 0.01;
      head.add(eye);
      this.eyes.push(eye);
      const brow = mesh(sphere(1, 8, 6), toon('#241a10'), side * 0.075, 0.08, 0.12, 0.05, 0.012, 0.016);
      brow.rotation.z = side * 0.5;
      head.add(brow);
    }
    // Two big paddle paws, wide as spades, that paddle as he burrows and
    // scrabble in the dirt as he comes up.
    this.paws = [];
    for (const side of [-1, 1]) {
      const paw = new THREE.Group();
      paw.position.set(side * 0.24, 0.4, 0.12);
      this.mole.add(paw);
      paw.add(mesh(sphere(), toon(FUR_DARK), side * 0.02, 0, 0, 0.09, 0.06, 0.11));
      paw.add(mesh(sphere(), toon(SNOUT), side * 0.05, -0.01, 0.1, 0.07, 0.03, 0.06));
      this.paws.push(paw);
      paw.userData.side = side;
    }
    // The mound of raised earth he travels under: a low lump of dirt with a
    // ridge along its top, and a little heap of fresh dirt thrown up behind,
    // which is all of him there is to see while he is under. Sits on the
    // ground; only the ground hides the rest.
    this.mound = new THREE.Group();
    b.add(this.mound);
    const dirt = toon(DIRT[id % DIRT.length]);
    this.mound.add(mesh(sphere(1, 12, 8), dirt, 0, 0.16, 0, 0.55, 0.3, 0.6));
    this.mound.add(mesh(sphere(1, 10, 8), toon(DIRT[(id + 1) % DIRT.length]), 0, 0.3, 0, 0.3, 0.18, 0.36));
    this.mound.add(mesh(sphere(1, 8, 6), toon(DIRT[(id + 2) % DIRT.length]), 0.1, 0.34, -0.2, 0.18, 0.12, 0.2));
    this.mound.add(mesh(sphere(1, 8, 6), toon(DIRT[(id + 2) % DIRT.length]), -0.12, 0.36, -0.26, 0.15, 0.1, 0.16));
    this.height = 1.0;
    this.center = 0.5;
    this.pick = 0.6;
    this.shadowScale = 1.1;
    this.seen = 90;
    this.shadow = blobShadow(0.5, 0.2);
    this.time = Math.random() * 10;
    this.squash = 0;
  }

  // state: dig (burrowing along under the ground), chase (burrowing at
  // someone), hop (up out of the ground) or giggle (after he bumped
  // someone). air: how high he is over the ground. night: eyes aglow.
  // While he is under only the mound is drawn, gliding along; out of the
  // ground, the mound flattens away under him as he rises out of it.
  update(dt, state, air = 0, night = false) {
    this.time += dt;
    const t = this.time;
    const out = state === 'hop' || state === 'giggle';
    // Out of the ground and back under it: quick as a pop, either way.
    this.rise = (this.rise ?? 0) + (out ? 1 : -1) * Math.min(1, dt / 0.16);
    this.rise = Math.max(0, Math.min(1, this.rise));
    const up = this.rise;
    // The mole himself: out of the ground as far as he has come up, tipping
    // forward as he goes and settling upright as he stands.
    this.mole.position.y = (up - 1) * 0.5;
    this.mole.visible = up > 0.02;
    this.mole.rotation.x = (1 - up) * 0.5;
    // The mound sinks away flat under him as he comes up, and rises back as
    // he dips under again.
    this.mound.scale.set(1 + up * 0.2, Math.max(0.05, 1 - up * 0.95), 1 + up * 0.2);
    // His paws paddle quicker the crosser he is, and scrabble apart as he
    // comes up; the whiskers twitch, the quicker the nearer someone is.
    const dig = state === 'chase' ? 16 : 8;
    this.paws.forEach((p, i) => {
      const side = p.userData.side;
      if (out) {
        p.rotation.x = Math.sin(t * 10 + i * Math.PI) * 0.2;
        p.rotation.z = side * (0.5 + Math.sin(t * 6 + i * Math.PI) * 0.15);
      } else {
        p.rotation.x = Math.sin(t * dig + i * Math.PI) * 0.5;
        p.rotation.z = side * 0.2;
      }
    });
    this.whiskers.forEach((w, i) => {
      w.rotation.y = (w.position.x < 0 ? -1 : 1) * (0.4 + Math.sin(t * (state === 'chase' ? 14 : 6) + i * 1.7) * 0.2);
    });
    // His eyes open as he comes up (underground they stay nearly shut) and
    // go aglow at night.
    this.eyes.forEach((e) => {
      e.scale.y = 0.01 + up * 0.029;
      const mat = night ? this.eyeGlow : this.eyeWhite;
      if (e.material !== mat) e.material = mat;
    });
    // A giggle, after he bumped someone: shaking side to side.
    this.body.rotation.set(0, 0, 0);
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.18;
    // Squashed flat by a bop, springing back.
    this.squash = Math.max(0, this.squash - dt * 2.2);
    const sy = 1 - this.squash * 0.6;
    this.mole.scale.set(1 + this.squash * 0.35, sy, 1 + this.squash * 0.35);
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
