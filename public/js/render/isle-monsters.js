// Two of Adventure Isle's own monsters (shared/monsters.js), each from its
// corner of the isle (shared/isle-story.js):
//
// - A Snappy Crab, of Shipwreck Shore: a grumpy plum-red crab (the beach's
//   friendly crabs are orange), its round shell low and wide, eyes up on
//   stalks under cross brows, two big claws held up in front, snapping as it
//   comes at you, and six little legs. It scuttles sideways, the way crabs
//   do, turning to face you only when it stops.
// - A Puffshroom, of the Whispering Woods: a grumpy mushroom, a cream stalk
//   with a face on it and a red cap with white spots. Before it puffs its
//   cloud of spores its cap swells up (long enough to see it coming), and
//   down it goes again as the cloud comes out.
import * as THREE from '../../vendor/three.module.js';
import { blobShadow, cone, cylinder, mesh, sphere, toon } from './toon.js';

const DARK = '#2b2530';
// A cap's dome.
const DOME = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

// Two cross eyes and a frown on a face facing +z, centred at (0, y, z): the
// eyes glow at night (eyeWhite and eyeGlow on the model).
function face(model, parent, y, z, { spread = 0.12, size = 1, mouth = true } = {}) {
  model.eyeWhite ??= toon('#fff7d6');
  model.eyeGlow ??= toon('#fff27a', { emissive: 0.9 });
  model.eyes ??= [];
  model.brows ??= [];
  for (const side of [-1, 1]) {
    const eye = mesh(sphere(1, 12, 8), model.eyeWhite, side * spread, y, z, 0.07 * size, 0.08 * size, 0.04 * size);
    parent.add(eye);
    model.eyes.push(eye);
    parent.add(mesh(sphere(1, 8, 6), toon(DARK), side * (spread - 0.008), y - 0.01 * size, z + 0.03 * size, 0.034 * size, 0.04 * size, 0.02 * size));
    const brow = mesh(sphere(1, 8, 6), toon(DARK), side * (spread - 0.008), y + 0.09 * size, z + 0.01, 0.07 * size, 0.02 * size, 0.022 * size);
    brow.rotation.z = side * 0.45;
    parent.add(brow);
    model.brows.push({ mesh: brow, side });
  }
  if (mouth) {
    model.mouth = mesh(sphere(1, 10, 6), toon('#3a1f3f'), 0, y - 0.12 * size, z + 0.005, 0.08 * size, 0.022 * size, 0.02 * size);
    parent.add(model.mouth);
  }
}

// What every monster model does each frame: track how fast it rises and
// falls, and squash flat as it lands.
function bounce(model, dt, air) {
  model.time += dt;
  const y = model.group.position.y;
  if (model.lastY !== null && dt > 0) model.vy += ((y - model.lastY) / dt - model.vy) * Math.min(1, dt * 20);
  model.lastY = y;
  if (air < 0.05 && model.vy < -1.5) model.squash = 0.35;
  model.squash = Math.max(0, model.squash - dt * 2.2);
}

function glow(model, night) {
  const mat = night ? model.eyeGlow : model.eyeWhite;
  for (const eye of model.eyes) if (eye.material !== mat) eye.material = mat;
}

class IsleMonster {
  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.squash = 0;
    this.seen = 70;
  }

  mouthAt() {
    return this.mouth.getWorldPosition(new THREE.Vector3());
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

export class SnapperModel extends IsleMonster {
  // look: colours of its own ({ shell, under, bump }), for Captain
  // Clawbeard (boss-models.js).
  constructor(theme = 'sunny', id = 1, look = {}) {
    super();
    const shell = toon(look.shell ?? ['#b8336a', '#a82d62', '#c03a70'][id % 3]);
    const under = toon(look.under ?? '#e7a3b8');
    const bump = toon(look.bump ?? '#d4588c');
    const b = this.body;
    // The shell turns sideways as it scuttles (see update): everything is on it.
    this.shell = new THREE.Group();
    b.add(this.shell);
    const s = this.shell;
    s.add(mesh(sphere(), shell, 0, 0.3, 0, 0.42, 0.2, 0.34));
    s.add(mesh(sphere(), under, 0, 0.2, 0.02, 0.36, 0.1, 0.28));
    // Bumps along the top of the shell.
    for (const [x, z, r] of [[0, -0.05, 0.08], [-0.17, 0.02, 0.06], [0.17, 0.02, 0.06], [0, 0.15, 0.05]]) s.add(mesh(sphere(1, 8, 6), bump, x, 0.47, z, r, r * 0.55, r));
    // Eyes up on stalks, cross brows over them, and a frown under.
    for (const side of [-1, 1]) s.add(mesh(cylinder(0.025, 0.03, 0.18, 6), shell, side * 0.1, 0.52, 0.2));
    face(this, s, 0.64, 0.22, { spread: 0.1, size: 0.9, mouth: false });
    this.mouth = mesh(sphere(1, 10, 6), toon('#4a1830'), 0, 0.28, 0.33, 0.08, 0.02, 0.02);
    s.add(this.mouth);
    // Two big claws held up in front: an arm and a pincer, its top jaw
    // snapping as it comes at you.
    this.jaws = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.3, 0.3, 0.22);
      arm.rotation.y = side * -0.5;
      arm.add(mesh(cylinder(0.04, 0.05, 0.22, 6), shell, 0, 0.04, 0.08).rotateX(Math.PI / 2.4));
      const claw = new THREE.Group();
      claw.position.set(0, 0.12, 0.2);
      claw.add(mesh(sphere(1, 10, 8), shell, 0, 0, 0, 0.11, 0.08, 0.13));
      const jaw = new THREE.Group();
      jaw.position.set(0, 0.03, 0.04);
      jaw.add(mesh(sphere(1, 10, 8), bump, 0, 0.03, 0.08, 0.08, 0.04, 0.11));
      claw.add(jaw);
      claw.add(mesh(sphere(1, 10, 8), bump, 0, -0.04, 0.12, 0.07, 0.03, 0.09));
      arm.add(claw);
      s.add(arm);
      this.jaws.push(jaw);
    }
    // Six little legs, three a side.
    this.legs = [];
    for (const side of [-1, 1]) {
      for (const z of [-0.14, 0, 0.14]) {
        const l = new THREE.Group();
        l.position.set(side * 0.34, 0.24, z);
        const bone = mesh(cylinder(0.018, 0.026, 0.3, 5), shell, side * 0.1, -0.1, 0);
        bone.rotation.z = side * 0.9;
        l.add(bone);
        l.userData.side = side;
        s.add(l);
        this.legs.push(l);
      }
    }
    this.height = 0.7;
    this.center = 0.32;
    this.pick = 0.5;
    this.shadowScale = 1.1;
    this.shadow = blobShadow(0.55, 0.2);
    this.turn = 0;
  }

  // state: idle, hop, chase or giggle (shared/monsters.js). air: how high
  // it is over the ground. night: eyes aglow.
  update(dt, state, air = 0, night = false) {
    bounce(this, dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.5;
    this.body.scale.set(1 + this.squash * 0.3, sy, 1 + this.squash * 0.3);
    // Sideways as it goes about, the way crabs do; facing you when it stops.
    const moving = state === 'hop' || state === 'chase';
    this.turn += ((moving ? Math.PI / 2 : 0) - this.turn) * Math.min(1, dt * 8);
    this.shell.rotation.y = this.turn;
    this.body.rotation.set(0, 0, 0);
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.16;
    const speed = state === 'chase' ? 26 : 14;
    this.legs.forEach((l, i) => {
      l.rotation.x = moving && air < 0.05 ? Math.sin(t * speed + i * 1.3) * 0.4 : 0;
    });
    // Snap, snap: quicker coming at you.
    this.jaws.forEach((j, i) => {
      j.rotation.x = -Math.max(0, Math.sin(t * (state === 'chase' ? 16 : 3) + i * Math.PI)) * 0.5;
    });
    for (const brow of this.brows) brow.mesh.rotation.z = brow.side * (state === 'chase' ? 0.65 : 0.4);
    glow(this, night);
  }
}

export class ShroomModel extends IsleMonster {
  // look: colours of its own ({ cap, spot, stalk }), for Old Puffcap
  // (boss-models.js).
  constructor(theme = 'sunny', id = 1, look = {}) {
    super();
    const b = this.body;
    const stalk = toon(look.stalk ?? '#f4ead6');
    b.add(mesh(sphere(), stalk, 0, 0.32, 0, 0.3, 0.32, 0.28));
    b.add(mesh(sphere(), toon('#e3d4b8'), 0, 0.14, 0, 0.26, 0.12, 0.24));
    // Little stubby feet.
    for (const side of [-1, 1]) b.add(mesh(sphere(1, 10, 8), toon('#e3d4b8'), side * 0.13, 0.04, 0.06, 0.09, 0.05, 0.11));
    face(this, b, 0.36, 0.26, { spread: 0.1, size: 0.95 });
    // The cap: red with white spots, swelling up before it puffs.
    this.cap = new THREE.Group();
    this.cap.position.y = 0.58;
    b.add(this.cap);
    const red = toon(look.cap ?? ['#e8453c', '#d63a52', '#e8573c'][id % 3]);
    const spot = look.spot ? toon(look.spot, { emissive: 0.35 }) : toon('#ffffff');
    this.cap.add(mesh(DOME, red, 0, 0, 0, 0.52, 0.36, 0.52));
    this.cap.add(mesh(cylinder(0.5, 0.52, 0.05, 20), toon('#f7e3c4'), 0, 0.005, 0));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const el = i % 2 ? 0.55 : 0.95;
      const x = 0.52 * Math.cos(el) * Math.sin(a);
      const y = 0.36 * Math.sin(el);
      const z = 0.52 * Math.cos(el) * Math.cos(a);
      this.cap.add(mesh(sphere(1, 8, 6), spot, x, y, z, 0.07, 0.035, 0.07));
    }
    this.cap.add(mesh(sphere(1, 8, 6), spot, 0, 0.35, 0, 0.08, 0.03, 0.08));
    this.height = 1.0;
    this.center = 0.45;
    this.pick = 0.6;
    this.shadowScale = 1;
    this.shadow = blobShadow(0.5, 0.2);
    this.swell = 0;
  }

  // state: idle, hop, chase, giggle, or puff — swelling up to puff its
  // spores (shared/monsters.js SPORES). air: how high it is over the ground.
  update(dt, state, air = 0, night = false) {
    bounce(this, dt, air);
    const t = this.time;
    // Its cap swells as it winds up, and sags straight back once it puffs.
    this.swell += ((state === 'puff' ? 1 : 0) - this.swell) * Math.min(1, dt * (state === 'puff' ? 2.2 : 10));
    const sy = 1 - this.squash + Math.sin(t * (state === 'chase' ? 8 : 3)) * 0.03;
    this.body.scale.set(1 + this.squash * 0.4, sy, 1 + this.squash * 0.4);
    const k = 1 + this.swell * 0.3 + (state === 'puff' ? Math.sin(t * 30) * 0.03 : 0);
    this.cap.scale.set(k, 1 + this.swell * 0.2, k);
    this.body.rotation.set(0, 0, 0);
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.16;
    else if (state === 'hop' || state === 'chase') this.body.rotation.z = Math.sin(t * 9) * 0.08;
    this.mouth.scale.y = state === 'giggle' || state === 'puff' ? 0.06 : 0.021;
    for (const brow of this.brows) brow.mesh.rotation.z = brow.side * (state === 'chase' || state === 'puff' ? 0.65 : 0.4);
    glow(this, night);
  }
}
