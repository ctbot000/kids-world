// The mightiest beasts (shared/beasts.js), a coat for each theme of island:
//
// - Grumble Oak: a walking tree, a great bark trunk with a cross face in it, two
//   glowing eyes deep in their hollows, branches for arms and thick roots it
//   drags itself along on, its crown rustling, apples among the leaves.
// - Grumble Wizard: an old blob in a star-spangled robe and a tall bent hat, with
//   a long white beard, gliding along over the ground with his staff, its orb
//   aglow. He shrinks away to nothing as he blinks.
// - Swamp Hydra: a low scaly barrel of a body on four stumpy legs, a tail, and
//   three long necks swaying each its own way, each head with its own teeth.
// - Cyclops: a huge pot-bellied giant in a loincloth, one horn and one enormous
//   eye that blinks, two tusks, and a studded club in its fist.
// - Rumble Rex: a towering tyrant lizard leaning forward over two great legs, its
//   long tail wagging behind for balance, plates down its back, a huge head with
//   a jaw full of teeth, and two ridiculous little arms.
import * as THREE from '../../vendor/three.module.js';
import { at, baked, Beast, crossEye, DARK, ease, group, joint, limb, moving, pace } from './beast-kit.js';
import { thrownMesh } from './boss-fx.js';
import { capsule, cone, cylinder, lathe, loft, mesh, sphere, toon, torus } from './toon.js';

// ---------------------------------------------------------------- Grumble Oak

const OAK = {
  sunny: { bark: '#7a5433', groove: '#5a3b22', leaf: ['#4f9e3f', '#3f8a35', '#66b24d'], fruit: '#e8453c' },
  snowy: { bark: '#6b5a50', groove: '#4a3d36', leaf: ['#e9f2f8', '#ffffff', '#cfe0ec'], fruit: '#6fc7e8' },
  candy: { bark: '#6b3f2a', groove: '#4a2a1b', leaf: ['#ff9ad4', '#8fd8ff', '#ffc6e8'], fruit: '#fff06a' },
  volcano: { bark: '#332b2c', groove: '#1c1718', leaf: ['#ff7a1a', '#c9400f', '#ffb13b'], fruit: '#ffe14d', hot: true },
};

export class OakModel extends Beast {
  constructor(theme = 'sunny') {
    const c = OAK[theme] ?? OAK.sunny;
    super({ height: 3.3, center: 1.6, pick: 1.5, radius: 0.95, glow: '#fff27a', white: '#ffe45c' });
    const bark = toon(c.bark);
    const groove = toon(c.groove);
    const leaf = c.leaf.map((l) => toon(l, c.hot ? { emissive: 0.45 } : {}));
    const b = this.body;
    this.trunk = group(b);
    const t = this.trunk;
    t.add(mesh(lathe([[0.62, 0.1], [0.56, 0.24], [0.46, 0.55], [0.42, 1.1], [0.44, 1.7], [0.52, 2.2], [0.46, 2.6], [0.2, 2.9], [0.01, 2.95]], 22), bark));
    // Bark, in long grooves all round but for its face.
    const lines = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.22;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.62) continue;
      const y = 1.25 + (i % 3) * 0.14;
      lines.push([capsule(0.025, 1.3 + (i % 2) * 0.3, 3, 6), at(Math.sin(a) * 0.45, y, Math.cos(a) * 0.45)]);
    }
    t.add(baked('oak-bark', groove, lines));
    // Its face: deep hollows with glowing eyes in them, heavy brows of bark, a
    // knot of a nose and a jagged mouth.
    for (const side of [-1, 1]) {
      t.add(mesh(sphere(1, 14, 10), toon(DARK), side * 0.18, 1.78, 0.36, 0.15, 0.17, 0.09));
      const eye = mesh(sphere(1, 12, 8), this.eyeWhite, side * 0.175, 1.76, 0.43, 0.08, 0.09, 0.035);
      t.add(eye);
      this.eyes.push(eye);
      const brow = mesh(capsule(0.05, 0.26, 4, 8), groove, side * 0.17, 1.96, 0.43);
      brow.rotation.z = Math.PI / 2 + side * 0.42;
      t.add(brow);
      this.brows.push({ mesh: brow, side, slope: 0 });
    }
    t.add(mesh(sphere(1, 10, 8), bark, 0, 1.56, 0.45, 0.075, 0.1, 0.08));
    t.add(mesh(sphere(1, 16, 10), toon('#2a1a12'), 0, 1.24, 0.38, 0.22, 0.11, 0.08));
    t.add(baked('oak-teeth', bark, [[-0.13, 1.3, 1], [-0.04, 1.31, 1], [0.05, 1.31, 1], [0.13, 1.3, 1], [-0.08, 1.17, 0], [0.08, 1.17, 0]].map(([x, y, down]) => [cone(0.04, 0.09, 5), at(x, y, 0.44, 1, 1, 1, down ? Math.PI : 0, 0, 0)])));
    this.mouth = group(t, 0, 1.24, 0.44);
    // Its arms: a branch to the elbow, a branch to the wrist, twigs for fingers.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = group(t, side * 0.42, 2.12, 0.02);
      arm.userData.side = side;
      limb(arm, [0, 0, 0], [side * 0.42, -0.3, 0.06], 0.16, 0.1, bark, 10);
      joint(arm, [0, 0, 0], 0.17, bark);
      const fore = group(arm, side * 0.42, -0.3, 0.06);
      joint(fore, [0, 0, 0], 0.105, bark);
      limb(fore, [0, 0, 0], [side * 0.14, -0.5, 0.14], 0.095, 0.06, bark, 8);
      joint(fore, [side * 0.14, -0.5, 0.14], 0.085, bark);
      for (const [dx, dz] of [[-0.075, 0.03], [0, 0.07], [0.075, 0.03]]) {
        const twig = mesh(cone(0.05, 0.3, 6), groove, side * 0.14 + dx, -0.66, 0.14 + dz);
        twig.rotation.x = Math.PI - dz * 5;
        twig.rotation.z = dx * 4.5;
        fore.add(twig);
      }
      // A tuft of leaves at its elbow.
      fore.add(mesh(sphere(1, 10, 8), leaf[1], side * 0.03, 0.12, -0.05, 0.2, 0.15, 0.18));
      arm.userData.fore = fore;
      this.arms.push(arm);
    }
    // Its crown, in great clumps, with fruit among them.
    this.crown = group(t, 0, 2.75, 0);
    const clumps = [
      [0, 0.18, 0, 0.82, 0.62, 0.82],
      [-0.58, -0.06, 0.14, 0.52, 0.42, 0.52],
      [0.58, -0.04, 0.12, 0.54, 0.42, 0.52],
      [0.1, 0.02, -0.58, 0.56, 0.44, 0.5],
      [-0.2, 0.1, 0.5, 0.42, 0.34, 0.38],
      [0.28, 0.48, 0.14, 0.44, 0.34, 0.42],
      [-0.26, 0.44, -0.16, 0.42, 0.32, 0.42],
    ];
    for (const m of [0, 1, 2]) {
      this.crown.add(baked(`oak-leaves-${m}`, leaf[m], clumps.filter((_, i) => i % 3 === m).map(([x, y, z, sx, sy, sz]) => [sphere(1, 12, 10), at(x, y, z, sx, sy, sz)])));
    }
    this.crown.add(baked('oak-fruit', toon(c.fruit, c.hot ? { emissive: 0.8 } : {}), [[-0.6, 0.05, 0.56], [0.62, 0.05, 0.54], [0.2, 0.3, 0.72], [-0.3, 0.5, 0.42], [0.68, 0.3, -0.25], [-0.72, 0.15, -0.3]].map(([x, y, z]) => [sphere(1, 10, 8), at(x, y, z, 0.085)])));
    // Its roots, in two bunches it heaves along one after the other.
    this.roots = [];
    for (const [i, side] of [-1, 1].entries()) {
      const bunch = group(b, side * 0.3, 0.32, 0);
      for (const [a, far] of side < 0 ? [[-2.3, 0.62], [-1.4, 0.72], [-0.5, 0.66]] : [[2.3, 0.62], [1.4, 0.72], [0.5, 0.66]]) {
        const x = Math.sin(a) * far;
        const z = Math.cos(a) * far;
        const mid = [x * 0.55, -0.02, z * 0.55];
        limb(bunch, [0, 0.06, 0], mid, 0.17, 0.12, bark, 8);
        joint(bunch, mid, 0.125, bark);
        limb(bunch, mid, [x, -0.28, z], 0.115, 0.03, bark, 8);
      }
      bunch.userData.i = i;
      this.roots.push(bunch);
    }
    this.raise = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 3, 5);
    const step = Math.sin(t * speed);
    const crouch = state === 'stomp';
    const sy = 1 - this.squash * 0.35 - (crouch ? 0.14 : 0) + Math.sin(t * 1.4) * 0.006;
    this.body.scale.set(1 + this.squash * 0.15 + (crouch ? 0.06 : 0), sy, 1 + this.squash * 0.15 + (crouch ? 0.06 : 0));
    this.roots.forEach((r, i) => {
      const k = i ? -step : step;
      r.position.y = 0.32 + (go ? Math.max(0, k) * 0.2 : 0);
      r.rotation.x = go ? k * 0.22 : 0;
      r.position.z = go ? k * 0.1 : 0;
    });
    // It heaves itself along, rocking from side to side.
    this.trunk.rotation.set(state === 'dazed' ? Math.sin(t * 2) * 0.03 : 0, go ? step * 0.05 : Math.sin(t * 0.6) * 0.03, go ? step * 0.045 : state === 'giggle' ? Math.sin(t * 16) * 0.05 : state === 'dazed' ? Math.sin(t * 3) * 0.07 : 0);
    this.trunk.position.y = go ? Math.abs(step) * 0.07 : 0;
    // Its arms hang and swing; up over its head, then down, driving its roots
    // up out of the ground; shaken, giggling.
    this.raise = ease(this.raise, state === 'hurl' ? (t - this.throwAt < 0.3 ? 0.1 : 1) : crouch ? 0.7 : 0, 7, dt);
    this.arms.forEach((a, i) => {
      const side = a.userData.side;
      const k = go ? (i ? step : -step) * 0.28 : Math.sin(t * 0.9 + i) * 0.04;
      a.rotation.set(k - this.raise * 1.9, 0, side * (0.08 + this.raise * 0.5) + (state === 'giggle' ? Math.sin(t * 20 + i) * 0.1 : 0));
      a.userData.fore.rotation.x = -0.25 - this.raise * 0.6;
    });
    this.crown.rotation.z = Math.sin(t * 1.7) * 0.02 + (go ? step * 0.03 : 0);
    this.crown.rotation.x = Math.sin(t * 1.3) * 0.015;
    const mat = night ? this.eyeGlow : this.eyeWhite;
    for (const eye of this.eyes) if (eye.material !== mat) eye.material = mat;
  }
}

// ---------------------------------------------------------------- Grumble Wizard

const WIZARD = {
  sunny: { robe: '#4b2f8f', trim: '#ffcc33', skin: '#9b6bff', hat: '#3a2370', orb: '#7ae0ff' },
  snowy: { robe: '#2f6fb0', trim: '#e9f6ff', skin: '#5fc7e6', hat: '#22538a', orb: '#ffffff' },
  candy: { robe: '#d84f9a', trim: '#fff06a', skin: '#8ee05a', hat: '#a83478', orb: '#ff9ad4' },
  volcano: { robe: '#7a1f1a', trim: '#ff9a2a', skin: '#ff7a2f', hat: '#4a1410', orb: '#ffe14d' },
};

export class WizardModel extends Beast {
  constructor(theme = 'sunny') {
    const c = WIZARD[theme] ?? WIZARD.sunny;
    super({ height: 2.3, center: 0.95, pick: 0.8, radius: 0.45, glow: '#fff27a' });
    const robe = toon(c.robe);
    const trim = toon(c.trim);
    const skin = toon(c.skin);
    const hat = toon(c.hat);
    const star = toon(c.trim, { emissive: 0.8 });
    const b = this.body;
    this.figure = group(b);
    const f = this.figure;
    f.add(mesh(lathe([[0.01, 0.06], [0.47, 0.06], [0.46, 0.14], [0.39, 0.34], [0.32, 0.66], [0.26, 0.96], [0.2, 1.14], [0.01, 1.18]], 24), robe));
    f.add(mesh(torus(0.455, 0.03), trim, 0, 0.12, 0).rotateX(Math.PI / 2));
    f.add(mesh(torus(0.31, 0.025), trim, 0, 0.72, 0).rotateX(Math.PI / 2));
    f.add(mesh(sphere(1, 8, 6), trim, 0, 0.72, 0.31, 0.05));
    // Stars on his robe.
    const spots = [];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const y = 0.22 + (i % 5) * 0.11;
      const r = 0.455 - y * 0.42;
      spots.push([sphere(1, 6, 4), at(Math.sin(a) * r, y, Math.cos(a) * r, 0.022 + (i % 3) * 0.005)]);
    }
    f.add(baked('wizard-stars', star, spots));
    // His head: a round old blob, with cross brows and a beard to his belt.
    this.head = group(f, 0, 1.35, 0.03);
    const h = this.head;
    h.add(mesh(sphere(1, 20, 16), skin, 0, 0, 0, 0.26, 0.25, 0.25));
    crossEye(this, h, -1, -0.095, 0.03, 0.21, { w: 0.07, brow: '#ffffff' });
    crossEye(this, h, 1, 0.095, 0.03, 0.21, { w: 0.07, brow: '#ffffff' });
    h.add(mesh(sphere(1, 10, 8), skin, 0, -0.03, 0.26, 0.05, 0.045, 0.05));
    const beard = mesh(cone(0.2, 0.62, 14), toon('#ffffff'), 0, -0.34, 0.15);
    beard.rotation.x = Math.PI - 0.08;
    h.add(beard);
    for (const side of [-1, 1]) {
      const m = mesh(sphere(1, 10, 8), toon('#ffffff'), side * 0.075, -0.075, 0.235, 0.09, 0.035, 0.04);
      m.rotation.z = side * -0.3;
      h.add(m);
    }
    this.mouth = group(h, 0, -0.1, 0.25);
    // His hat, tall and bent, with a gold band and a star on it.
    h.add(mesh(cylinder(0.36, 0.36, 0.03, 26), hat, 0, 0.2, 0));
    h.add(mesh(cylinder(0.22, 0.24, 0.1, 22), trim, 0, 0.26, 0));
    h.add(mesh(cylinder(0.14, 0.22, 0.32, 20), hat, 0, 0.45, -0.005));
    this.hatTop = group(h, 0, 0.6, -0.01);
    this.hatTop.rotation.x = -0.5;
    this.hatTop.add(mesh(cone(0.145, 0.48, 18), hat, 0, 0.22, 0));
    this.hatTop.add(mesh(sphere(1, 8, 6), star, 0, 0.47, 0, 0.055));
    h.add(mesh(sphere(1, 8, 6), star, 0, 0.27, 0.235, 0.05));
    // His arms, in wide sleeves; his staff in his right hand.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = group(f, side * 0.22, 1.08, 0.02);
      arm.userData.side = side;
      limb(arm, [0, 0, 0], [side * 0.14, -0.34, 0.16], 0.085, 0.12, robe, 12);
      joint(arm, [0, 0, 0], 0.09, robe);
      limb(arm, [side * 0.135, -0.33, 0.155], [side * 0.145, -0.355, 0.167], 0.128, 0.13, trim, 14);
      arm.add(mesh(sphere(1, 10, 8), skin, side * 0.155, -0.41, 0.19, 0.075));
      this.arms.push(arm);
    }
    this.staff = group(this.arms[1], 0.15, -0.4, 0.2);
    this.staff.add(mesh(cylinder(0.024, 0.03, 1.66, 8), toon('#6b4a2f'), 0, 0.28, 0));
    this.staff.add(mesh(torus(0.13, 0.024, Math.PI * 1.5), trim, 0, 1.2, 0).rotateZ(-Math.PI * 0.25));
    this.orb = toon(c.orb, { emissive: 0.9 });
    this.ball = mesh(sphere(1, 14, 10), this.orb, 0, 1.2, 0, 0.09);
    this.staff.add(this.ball);
    this.shrink = 1;
    this.cast = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    this.squash = Math.min(this.squash, 0.2);
    // He glides, hardly touching the ground.
    this.figure.position.y = 0.05 + Math.sin(t * 2.2) * 0.035;
    const go = moving(state);
    this.figure.rotation.x = go ? 0.08 : 0;
    this.figure.rotation.z = state === 'giggle' ? Math.sin(t * 22) * 0.1 : state === 'dazed' ? Math.sin(t * 6) * 0.1 : Math.sin(t * 1.1) * 0.015;
    // Off he goes: spinning away to nothing, and back from it.
    const blink = state === 'blink';
    this.shrink = ease(this.shrink, blink ? 0.04 : 1, blink ? 5 : 9, dt);
    this.figure.rotation.y = blink ? t * 14 : 0;
    const sy = 1 - this.squash * 0.5;
    this.body.scale.set(this.shrink * (1 + this.squash * 0.2), this.shrink * sy * (blink ? 1.15 : 1), this.shrink * (1 + this.squash * 0.2));
    // His staff up and his other hand out, casting or calling.
    const casting = state === 'hurl' || state === 'howl';
    this.cast = ease(this.cast, casting ? 1 : 0, 8, dt);
    const [left, right] = this.arms;
    left.rotation.set(Math.sin(t * 2) * 0.03 - this.cast * 1.5, 0, -0.08 - this.cast * 0.35);
    right.rotation.set((go ? Math.sin(t * 5) * 0.08 : 0) - this.cast * 0.55, 0, 0.05 + this.cast * 0.1);
    this.staff.rotation.x = this.cast * 0.5;
    const pulse = 1 + this.cast * (0.5 + Math.sin(t * 16) * 0.25) + Math.sin(t * 3) * 0.06;
    this.ball.scale.setScalar(0.09 * pulse);
    this.head.rotation.x = casting ? -0.16 : go ? 0.06 : 0;
    this.hatTop.rotation.x = -0.5 + Math.sin(t * 2.4) * 0.07;
    this.hatTop.rotation.z = Math.sin(t * 1.7) * 0.06;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Swamp Hydra

const HYDRA = {
  sunny: { skin: '#2f8a78', dark: '#1f6657', belly: '#e0d68f', frill: '#d4563a', glow: '#d6ff5a', spit: '#a6e04a' },
  snowy: { skin: '#6aa6cf', dark: '#467fa8', belly: '#e6f4fb', frill: '#2c5ea8', glow: '#bfe8ff', spit: '#9fe8ff' },
  candy: { skin: '#9a62d6', dark: '#7342a8', belly: '#ffd9ee', frill: '#ff6fb1', glow: '#ff9ad4', spit: '#ff9ad4' },
  volcano: { skin: '#a8352a', dark: '#6e1f1a', belly: '#ffb15a', frill: '#2b2428', glow: '#ffef7a', spit: '#ff9a2a' },
};

function hydraHead(model, parent, c) {
  const skin = toon(c.skin);
  const dark = toon(c.dark);
  const belly = toon(c.belly);
  const white = toon('#fffdf0');
  const h = group(parent);
  h.add(mesh(sphere(1, 16, 12), skin, 0, 0, 0.04, 0.19, 0.16, 0.24));
  h.add(mesh(sphere(1, 14, 10), skin, 0, -0.025, 0.28, 0.14, 0.085, 0.2));
  crossEye(model, h, -1, -0.09, 0.035, 0.215, { w: 0.055, h: 0.05, slope: 0.5 });
  crossEye(model, h, 1, 0.09, 0.035, 0.215, { w: 0.055, h: 0.05, slope: 0.5 });
  // A frill behind its head, and two little horns.
  h.add(baked('hydra-frill', toon(c.frill), [[-0.14, 0.05, -0.75], [0, 0.11, 0], [0.14, 0.05, 0.75], [-0.08, 0.1, -0.35], [0.08, 0.1, 0.35]].map(([x, y, tilt]) => [cone(0.05, 0.24, 6), at(x, y, -0.16, 1, 1, 0.35, -1.2, 0, -tilt * 0.75)])));
  h.add(baked('hydra-horns', white, [-1, 1].map((side) => [cone(0.028, 0.11, 6), at(side * 0.09, 0.15, 0.08, 1, 1, 1, -0.5, 0, -side * 0.3)])));
  h.add(baked('hydra-teeth', white, [[-0.1, 0.22], [0.1, 0.22], [-0.085, 0.31], [0.085, 0.31], [-0.055, 0.39], [0.055, 0.39]].map(([x, z]) => [cone(0.016, 0.05, 5), at(x, -0.08, z, 1, 1, 1, Math.PI, 0, 0)])));
  const jaw = group(h, 0, -0.07, 0.08);
  jaw.add(mesh(sphere(1, 12, 8), belly, 0, -0.035, 0.19, 0.125, 0.04, 0.22));
  jaw.add(mesh(sphere(1, 8, 6), dark, 0, -0.012, 0.18, 0.09, 0.012, 0.16));
  jaw.add(baked('hydra-low-teeth', white, [[-0.085, 0.16], [0.085, 0.16], [-0.07, 0.25], [0.07, 0.25], [-0.04, 0.32], [0.04, 0.32]].map(([x, z]) => [cone(0.014, 0.04, 5), at(x, 0.002, z)])));
  const mouth = group(h, 0, -0.04, 0.46);
  return { h, jaw, mouth };
}

export class HydraModel extends Beast {
  constructor(theme = 'sunny') {
    const c = HYDRA[theme] ?? HYDRA.sunny;
    super({ height: 2.7, center: 1.1, pick: 1.25, radius: 1.1, glow: c.glow });
    const skin = toon(c.skin);
    const dark = toon(c.dark);
    const belly = toon(c.belly);
    this.spit = c.spit;
    const b = this.body;
    this.trunk = group(b);
    const t = this.trunk;
    t.add(mesh(loft([[-0.95, 0.12, 0.1, 0.1, 0.55], [-0.72, 0.36, 0.3, 0.28, 0.62], [-0.2, 0.68, 0.5, 0.44, 0.68], [0.3, 0.72, 0.54, 0.44, 0.72], [0.66, 0.52, 0.46, 0.34, 0.8], [0.9, 0.2, 0.2, 0.18, 0.92]], { along: 'z', segs: 26 }), skin));
    t.add(mesh(sphere(1, 18, 12), belly, 0, 0.42, 0.06, 0.56, 0.22, 0.74));
    // Rows of scales along its sides, and plates down its back.
    const scales = [];
    for (let i = 0; i < 26; i++) {
      const a = 0.6 + (i % 5) * 0.32;
      const z = -0.7 + ((i * 0.31) % 1.4);
      const k = 1 - Math.abs(z - 0.05) * 0.42;
      for (const side of [-1, 1]) scales.push([sphere(1, 8, 6), at(side * Math.cos(a) * 0.68 * k, 0.7 + Math.sin(a) * 0.5 * k, z, 0.075, 0.05, 0.075)]);
    }
    t.add(baked('hydra-scales', dark, scales));
    t.add(baked('hydra-plates', toon(c.frill), [-0.7, -0.45, -0.18, 0.1].map((z, i) => [cone(0.11, 0.24 + (i % 2) * 0.04, 6), at(0, 1.1 + (i === 0 ? -0.25 : i === 1 ? -0.1 : 0), z, 0.45, 1, 1)])));
    // Its legs, short and thick, each with three claws.
    this.legs = [];
    for (const [x, z] of [[-0.56, 0.38], [0.56, 0.38], [-0.56, -0.4], [0.56, -0.4]]) {
      const l = group(t, x, 0.48, z);
      joint(l, [0, 0, 0], 0.27, skin);
      limb(l, [0, 0, 0], [Math.sign(x) * 0.05, -0.34, 0.02], 0.22, 0.17, skin, 10);
      l.add(mesh(sphere(1, 12, 8), dark, Math.sign(x) * 0.05, -0.38, 0.06, 0.2, 0.09, 0.26));
      l.add(baked('hydra-claws', toon('#fffdf0'), [-0.1, 0, 0.1].map((dx) => [cone(0.03, 0.1, 6), at(dx, -0.41, 0.3, 1, 1, 1, Math.PI / 2 + 0.2, 0, 0)])));
      this.legs.push(l);
    }
    // Its tail, thick at the root and thin at the tip.
    this.tail = [];
    let parent = group(t, 0, 0.58, -0.92);
    for (let i = 0; i < 4; i++) {
      const r = 0.15 - i * 0.03;
      const seg = group(parent, 0, i ? -0.03 : 0, i ? -0.3 : 0);
      seg.add(mesh(sphere(1, 12, 10), i === 3 ? dark : skin, 0, -0.02, -0.14, r, r * 0.9, 0.22));
      this.tail.push(seg);
      parent = seg;
    }
    // Three necks, each its own way, and on each a head.
    this.necks = [];
    for (const [i, x] of [-0.44, 0, 0.44].entries()) {
      const out = (i - 1) * 0.62;
      const root = group(t, x, 0.98 + (i === 1 ? 0.1 : 0), 0.6);
      root.rotation.y = out;
      const segs = [];
      const rest = [0.3, 0.12, -0.18, -0.36];
      let p = root;
      for (let k = 0; k < 4; k++) {
        const s = group(p, 0, k ? 0.35 : 0, 0);
        s.rotation.x = rest[k];
        s.userData.rest = rest[k];
        const r = 0.2 - k * 0.022;
        s.add(mesh(capsule(r, 0.3, 4, 14), skin, 0, 0.18, 0));
        s.add(mesh(sphere(1, 10, 8), belly, 0, 0.18, r * 0.62, r * 0.68, 0.27, r * 0.5));
        if (k % 2 === 0) s.add(mesh(cone(0.05, 0.13, 5), toon(c.frill), 0, 0.2, -r * 0.92, 0.5, 1, 1).rotateX(-0.9));
        segs.push(s);
        p = s;
      }
      const neck = group(p, 0, 0.34, 0);
      neck.rotation.x = 1.15;
      neck.scale.setScalar(1.28);
      const head = hydraHead(this, neck, c);
      this.necks.push({ i, out, root, segs, neck, ...head });
    }
    this.lunge = 0;
    this.mouth = this.necks[1].mouth;
  }

  // Where each head's mouth is in the world, with how far it turns off the way
  // the whole beast faces, for each one's venom.
  mouthsAt() {
    return this.necks.map((n) => ({ at: n.mouth.getWorldPosition(new THREE.Vector3()), off: n.out * 0.7 }));
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.4;
    this.body.scale.set(1 + this.squash * 0.2, sy, 1 + this.squash * 0.2);
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 5, 9);
    this.legs.forEach((l, i) => {
      l.rotation.x = go ? Math.sin(t * speed + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4 : 0;
    });
    this.trunk.rotation.set(0, 0, go ? Math.sin(t * speed) * 0.04 : state === 'giggle' ? Math.sin(t * 22) * 0.05 : state === 'dazed' ? Math.sin(t * 3) * 0.05 : 0);
    this.trunk.position.y = go ? Math.abs(Math.sin(t * speed)) * 0.04 : 0;
    this.tail.forEach((s, i) => {
      s.rotation.y = Math.sin(t * (go ? 5 : 1.6) - i * 0.6) * (go ? 0.26 : 0.14);
    });
    // Each neck swaying its own way. Breathing, all three reach forward low;
    // spitting, they rear back and strike; dazed, they sag.
    const breathe = state === 'breathe';
    const spit = state === 'hurl';
    const strike = spit && t - this.throwAt < 0.35;
    this.lunge = ease(this.lunge, breathe ? 1 : strike ? 1.2 : spit ? -0.8 : state === 'dazed' ? 0.8 : 0, 8, dt);
    for (const n of this.necks) {
      const phase = n.i * 2.1;
      n.segs.forEach((s, k) => {
        s.rotation.x = s.userData.rest + this.lunge * (k < 2 ? 0.22 : 0.08) + Math.sin(t * 1.7 + phase + k * 0.65) * 0.055;
        s.rotation.z = Math.sin(t * 1.25 + phase + k * 0.55) * 0.065;
      });
      n.neck.rotation.x = 1.15 - this.lunge * 0.15 + (state === 'giggle' ? Math.sin(t * 22 + phase) * 0.2 : 0);
      n.neck.rotation.y = -n.out * (breathe ? 0.5 : 0.25);
      const open = breathe || strike ? 0.85 : spit ? 0.45 : state === 'giggle' ? 0.6 : state === 'chase' ? 0.15 + Math.max(0, Math.sin(t * 9 + phase)) * 0.25 : 0.05 + Math.max(0, Math.sin(t * 1.1 + phase)) * 0.08;
      n.jaw.rotation.x = open;
    }
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Cyclops

// A lid's dome.
const DOME = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

const CYCLOPS = {
  sunny: { skin: '#5f86c9', dark: '#46689f', belly: '#a9c6ee', cloth: '#8a5a33', iris: '#c9702f' },
  snowy: { skin: '#b9d6e8', dark: '#8eb2c9', belly: '#e6f4fb', cloth: '#5a6f88', iris: '#2f7fc9' },
  candy: { skin: '#f08cc0', dark: '#cf649e', belly: '#ffd2e8', cloth: '#7f4fd0', iris: '#6a3fd0' },
  volcano: { skin: '#b5493a', dark: '#853026', belly: '#e08a5a', cloth: '#2b2428', iris: '#ffb13b' },
};

export class CyclopsModel extends Beast {
  constructor(theme = 'sunny') {
    const c = CYCLOPS[theme] ?? CYCLOPS.sunny;
    super({ height: 3.45, center: 1.6, pick: 1.5, radius: 1.05, glow: '#ffe45c', white: '#fffdf2' });
    const skin = toon(c.skin);
    const dark = toon(c.dark);
    const belly = toon(c.belly);
    const cloth = toon(c.cloth);
    const b = this.body;
    this.trunk = group(b);
    const t = this.trunk;
    t.add(mesh(loft([[0.72, 0.42, 0.3, 0.3], [0.98, 0.68, 0.48, 0.4], [1.36, 0.8, 0.62, 0.48], [1.78, 0.84, 0.54, 0.48], [2.16, 0.78, 0.46, 0.44], [2.44, 0.5, 0.34, 0.34]], { segs: 26 }), skin));
    t.add(mesh(sphere(1, 22, 16), belly, 0, 1.4, 0.2, 0.64, 0.62, 0.52));
    t.add(mesh(sphere(1, 8, 6), dark, 0, 1.26, 0.7, 0.035, 0.05, 0.02));
    // A loincloth on a belt with a big buckle.
    t.add(mesh(torus(0.62, 0.05), toon('#4f3620'), 0, 0.98, 0.03, 1.08, 0.82, 1).rotateX(Math.PI / 2));
    t.add(mesh(cylinder(0.05, 0.05, 0.03, 12), toon('#ffcc33'), 0, 0.98, 0.54).rotateX(Math.PI / 2).rotateY(0));
    t.add(baked('cyclops-cloth', cloth, [-0.42, -0.14, 0.14, 0.42].map((x) => [cone(0.2, 0.46, 7), at(x, 0.74, 0.32 - Math.abs(x) * 0.15, 1, 1, 0.3, Math.PI, 0, 0)]).concat([-0.4, 0, 0.4].map((x) => [cone(0.22, 0.42, 7), at(x, 0.76, -0.34, 1, 1, 0.3, Math.PI, 0, 0)]))));
    // Its head, sunk between its shoulders.
    this.head = group(t, 0, 2.5, 0.04);
    const h = this.head;
    h.add(mesh(sphere(1, 22, 16), skin, 0, 0.14, 0, 0.56, 0.54, 0.5));
    h.add(mesh(cone(0.115, 0.36, 12), toon('#fff1d0'), 0, 0.8, -0.02));
    for (const side of [-1, 1]) {
      const ear = mesh(sphere(1, 12, 10), skin, side * 0.58, 0.16, -0.03, 0.09, 0.17, 0.12);
      ear.rotation.z = side * -0.25;
      h.add(ear);
      h.add(mesh(sphere(1, 8, 6), dark, side * 0.63, 0.16, 0, 0.04, 0.09, 0.07));
    }
    // Its one enormous eye, with a lid that blinks.
    const eye = mesh(sphere(1, 20, 16), this.eyeWhite, 0, 0.24, 0.38, 0.27, 0.28, 0.15);
    h.add(eye);
    this.eyes.push(eye);
    this.iris = group(h, 0, 0.22, 0.51);
    this.iris.add(mesh(sphere(1, 14, 10), toon(c.iris), 0, 0, 0, 0.155, 0.165, 0.035));
    this.iris.add(mesh(sphere(1, 12, 8), toon(DARK), 0, 0, 0.025, 0.08, 0.09, 0.02));
    this.iris.add(mesh(sphere(1, 6, 4), toon('#ffffff', { emissive: 0.6 }), 0.05, 0.06, 0.04, 0.035, 0.035, 0.012));
    this.lid = mesh(DOME, skin);
    group(h, 0, 0.24, 0.38).add(this.lid);
    this.lid.parent.scale.set(0.285, 0.295, 0.16);
    for (const side of [-1, 1]) {
      const brow = mesh(capsule(0.05, 0.28, 4, 10), toon('#2e3442'), side * 0.16, 0.5, 0.45);
      brow.rotation.z = Math.PI / 2 + side * 0.34;
      h.add(brow);
      this.brows.push({ mesh: brow, side, slope: 0 });
    }
    // A wide mouth, a big jaw and two tusks.
    h.add(mesh(sphere(1, 16, 10), toon('#3a1f2a'), 0, -0.14, 0.4, 0.34, 0.1, 0.1));
    this.jaw = group(h, 0, -0.17, 0.08);
    this.jaw.add(mesh(sphere(1, 16, 10), skin, 0, -0.08, 0.14, 0.42, 0.13, 0.34));
    this.jaw.add(baked('cyclops-tusks', toon('#fff1d0'), [-1, 1].map((side) => [cone(0.06, 0.24, 8), at(side * 0.22, 0.06, 0.38, 1, 1, 1, -0.15, 0, -side * 0.12)])));
    this.mouth = group(h, 0, -0.12, 0.48);
    // Its legs.
    this.legs = [];
    for (const side of [-1, 1]) {
      const l = group(b, side * 0.36, 0.88, 0);
      joint(l, [0, 0, 0], 0.32, skin);
      limb(l, [0, 0, 0], [side * 0.02, -0.44, 0.03], 0.3, 0.23, skin, 12);
      const shin = group(l, side * 0.02, -0.44, 0.03);
      joint(shin, [0, 0, 0], 0.24, skin);
      limb(shin, [0, 0, 0], [0, -0.34, -0.01], 0.22, 0.2, skin, 12);
      shin.add(mesh(sphere(1, 14, 10), dark, 0, -0.36, 0.1, 0.25, 0.1, 0.36));
      shin.add(baked('cyclops-toes', toon('#fff1d0'), [-0.14, 0, 0.14].map((dx) => [sphere(1, 8, 6), at(dx, -0.38, 0.42, 0.06, 0.04, 0.05)])));
      l.userData.shin = shin;
      this.legs.push(l);
    }
    // Its arms, and in its right fist a club studded with iron.
    this.arms = [];
    for (const side of [-1, 1]) {
      const a = group(t, side * 0.84, 2.08, 0.02);
      a.userData.side = side;
      joint(a, [0, 0, 0], 0.32, skin);
      limb(a, [0, 0, 0], [side * 0.18, -0.6, 0.06], 0.28, 0.22, skin, 12);
      const fore = group(a, side * 0.18, -0.6, 0.06);
      joint(fore, [0, 0, 0], 0.22, skin);
      limb(fore, [0, 0, 0], [0, -0.5, 0.18], 0.2, 0.17, skin, 12);
      fore.add(mesh(sphere(1, 14, 10), dark, 0, -0.56, 0.2, 0.22, 0.2, 0.22));
      a.userData.fore = fore;
      this.arms.push(a);
    }
    this.club = group(this.arms[1].userData.fore, 0, -0.56, 0.2);
    this.club.rotation.x = 1.25;
    const wood = toon('#7a5433');
    this.club.add(mesh(lathe([[0.06, -0.26], [0.07, 0.2], [0.14, 0.6], [0.24, 0.98], [0.25, 1.26], [0.14, 1.46], [0.01, 1.5]], 14), wood));
    const studs = [];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const y = 0.7 + (i % 5) * 0.14;
      const r = y < 0.98 ? 0.14 + (y - 0.6) * 0.26 : 0.25;
      const m = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
      studs.push([cone(0.035, 0.1, 6), new THREE.Matrix4().compose(m, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(a), 0, Math.cos(a))), new THREE.Vector3(1, 1, 1))]);
    }
    this.club.add(baked('cyclops-studs', toon('#b9bec7'), studs));
    // A boulder, held up over its head to throw.
    this.boulder = thrownMesh('boulder');
    this.boulder.scale.setScalar(1.5);
    this.boulder.position.set(0, 3.75, 0.1);
    this.boulder.visible = false;
    t.add(this.boulder);
    this.raise = 0;
    this.swing = 0;
    this.blink = 0;
    this.blinkAt = 2 + Math.random() * 4;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 4.5, 7.5);
    const step = go ? Math.sin(t * speed) : 0;
    const crouch = state === 'stomp' && air < 0.1;
    const sy = 1 - this.squash * 0.4 - (crouch ? 0.16 : 0);
    this.body.scale.set(1 + this.squash * 0.2 + (crouch ? 0.05 : 0), sy, 1 + this.squash * 0.2 + (crouch ? 0.05 : 0));
    this.legs.forEach((l, i) => {
      const k = i ? -step : step;
      l.rotation.x = k * 0.42;
      l.userData.shin.rotation.x = Math.max(0, -k) * 0.5;
    });
    this.trunk.rotation.set(state === 'hurl' ? -0.08 : go ? 0.04 : 0, go ? step * 0.08 : 0, go ? step * 0.05 : state === 'giggle' ? Math.sin(t * 18) * 0.05 : state === 'dazed' ? Math.sin(t * 3) * 0.07 : 0);
    this.trunk.position.y = go ? Math.abs(Math.sin(t * speed)) * 0.08 : 0;
    // Both arms up with a boulder; thrown, down they come. The club up over its
    // head for a stomp; down, it slams.
    const holding = state === 'hurl' && t - this.throwAt > 0.5;
    this.raise = ease(this.raise, holding ? 1 : 0, 8, dt);
    this.swing = ease(this.swing, state === 'stomp' ? 1 : 0, state === 'stomp' ? 9 : 16, dt);
    const [left, right] = this.arms;
    left.rotation.set(-this.raise * 2.75 + (go ? step * 0.3 : Math.sin(t * 1.2) * 0.03), 0, -0.1 - this.raise * -0.2);
    right.rotation.set(-this.raise * 2.75 - this.swing * 2.25 + (go ? -step * 0.3 : Math.sin(t * 1.1) * 0.03), 0, 0.1 + this.raise * -0.2 + this.swing * 0.3);
    left.userData.fore.rotation.x = -0.22 - this.raise * 0.4;
    right.userData.fore.rotation.x = -0.32 - this.raise * 0.4 - this.swing * 0.3;
    this.club.rotation.x = 1.25 - this.swing * 1.1;
    this.boulder.visible = holding;
    // A slow blink, now and then; half shut, dazed; wide, when it is cross.
    this.blinkAt -= dt;
    if (this.blinkAt <= 0) {
      this.blinkAt = 3 + Math.random() * 4;
      this.blink = 1;
    }
    this.blink = Math.max(0, this.blink - dt * 5);
    const shut = state === 'dazed' ? 0.55 : Math.sin(this.blink * Math.PI);
    this.lid.rotation.x = -0.75 + shut * 2;
    this.iris.position.x = Math.sin(t * 0.7) * 0.05;
    this.iris.position.y = 0.22 + (state === 'dazed' ? Math.sin(t * 5) * 0.04 : 0);
    this.jaw.rotation.x = state === 'giggle' ? 0.32 + Math.sin(t * 20) * 0.08 : holding ? 0.28 : state === 'chase' ? 0.1 : 0.02;
    this.head.rotation.set(state === 'dazed' ? 0.1 : holding ? -0.14 : 0, Math.sin(t * 0.8) * 0.06, state === 'dazed' ? Math.sin(t * 3) * 0.08 : 0);
    const mat = night ? this.eyeGlow : this.eyeWhite;
    for (const e of this.eyes) if (e.material !== mat) e.material = mat;
  }
}

// ---------------------------------------------------------------- Rumble Rex

const REX = {
  sunny: { skin: '#d9772f', dark: '#a34a1f', belly: '#f7e2b0', plate: '#2f6f7a', glow: '#fff27a' },
  snowy: { skin: '#a8c4d6', dark: '#7b9cb2', belly: '#f2f8fc', plate: '#3f7fd6', glow: '#bfe8ff' },
  candy: { skin: '#ff7fb6', dark: '#d9548f', belly: '#fff0a8', plate: '#6fd8c0', glow: '#fff27a' },
  volcano: { skin: '#3b3438', dark: '#241e22', belly: '#7a5a48', plate: '#ff7a1a', glow: '#ff7a1a', hot: true },
};

export class RexModel extends Beast {
  constructor(theme = 'sunny') {
    const c = REX[theme] ?? REX.sunny;
    super({ height: 3.35, center: 1.7, pick: 1.6, radius: 1.15, glow: c.glow, white: '#fff0b8' });
    const skin = toon(c.skin);
    const dark = toon(c.dark);
    const belly = toon(c.belly);
    const plate = toon(c.plate, c.hot ? { emissive: 0.8 } : {});
    const white = toon('#fffdf0');
    const b = this.body;
    // (Set back a little, so what bumps you is its head rather than thin air.)
    b.position.z = -0.4;
    this.trunk = group(b);
    const t = this.trunk;
    t.add(mesh(loft([[-1.05, 0.26, 0.26, 0.26, 1.62], [-0.75, 0.46, 0.48, 0.48, 1.66], [-0.3, 0.62, 0.64, 0.62, 1.68], [0.2, 0.6, 0.64, 0.62, 1.82], [0.6, 0.46, 0.5, 0.52, 2.02], [0.92, 0.33, 0.34, 0.36, 2.28], [1.14, 0.28, 0.27, 0.28, 2.46]], { along: 'z', segs: 28 }), skin));
    t.add(mesh(sphere(1, 18, 12), belly, 0, 1.42, 0.22, 0.48, 0.48, 0.72));
    // Darker stripes over its back, plates down it.
    t.add(baked('rex-stripes', dark, [[-0.7, 1.98, 0.3], [-0.36, 2.15, 0.36], [0.02, 2.3, 0.36], [0.4, 2.36, 0.3], [0.74, 2.46, 0.22]].map(([z, y, w]) => [sphere(1, 14, 10), at(0, y, z, w, 0.17, 0.11, -0.25, 0, 0)])));
    t.add(baked('rex-plates', plate, [[-0.9, 1.88, 0.12], [-0.62, 2.13, 0.16], [-0.3, 2.3, 0.2], [0.03, 2.46, 0.2], [0.34, 2.55, 0.18], [0.64, 2.62, 0.15], [0.9, 2.73, 0.11]].map(([z, y, r]) => [cone(r, r * 2, 6), at(0, y + r * 0.6, z, 0.5, 1, 1, -0.15, 0, 0)])));
    // Its head.
    this.head = group(t, 0, 2.48, 1.08);
    this.head.scale.setScalar(1.22);
    const h = this.head;
    h.add(mesh(sphere(1, 20, 14), skin, 0, 0.08, 0.14, 0.42, 0.37, 0.48));
    h.add(mesh(sphere(1, 18, 12), skin, 0, -0.02, 0.62, 0.34, 0.21, 0.5));
    // Bumps over its eyes, and nostrils.
    for (const side of [-1, 1]) {
      h.add(mesh(sphere(1, 10, 8), dark, side * 0.22, 0.385, 0.3, 0.11, 0.07, 0.16));
      h.add(mesh(sphere(1, 8, 6), toon(DARK), side * 0.1, 0.085, 1.0, 0.032, 0.024, 0.03));
    }
    crossEye(this, h, -1, -0.235, 0.23, 0.47, { w: 0.095, h: 0.09, slope: 0.5 });
    crossEye(this, h, 1, 0.235, 0.23, 0.47, { w: 0.095, h: 0.09, slope: 0.5 });
    // Its upper teeth, a long row each side and at the front.
    const upper = [];
    for (let i = 0; i < 8; i++) {
      for (const side of [-1, 1]) {
        const k = i / 7;
        upper.push([cone(0.04 - k * 0.012, 0.13 - k * 0.04, 6), at(side * (0.3 - k * k * 0.2), -0.17, 0.4 + k * 0.66, 1, 1, 1, Math.PI, 0, 0)]);
      }
    }
    h.add(baked('rex-teeth', white, upper));
    h.add(mesh(sphere(1, 14, 10), toon('#7a2a3a'), 0, -0.13, 0.62, 0.3, 0.05, 0.44));
    // Its jaw, on a hinge at the back, with teeth and a tongue.
    this.jaw = group(h, 0, -0.14, 0.14);
    this.jaw.add(mesh(sphere(1, 18, 10), belly, 0, -0.1, 0.4, 0.33, 0.1, 0.56));
    this.jaw.add(mesh(sphere(1, 12, 8), toon('#7a2a3a'), 0, -0.04, 0.4, 0.26, 0.03, 0.44));
    this.jaw.add(mesh(sphere(1, 12, 8), toon('#e8607a'), 0, -0.01, 0.34, 0.15, 0.04, 0.36));
    const lower = [];
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const k = i / 6;
        lower.push([cone(0.035 - k * 0.01, 0.1 - k * 0.03, 6), at(side * (0.27 - k * k * 0.18), 0.005, 0.28 + k * 0.56)]);
      }
    }
    this.jaw.add(baked('rex-low-teeth', white, lower));
    this.mouth = group(h, 0, -0.1, 0.9);
    // Two ridiculous little arms.
    this.arms = [];
    for (const side of [-1, 1]) {
      const a = group(t, side * 0.4, 1.72, 0.68);
      a.userData.side = side;
      joint(a, [0, 0, 0], 0.085, skin);
      limb(a, [0, 0, 0], [side * 0.05, -0.2, 0.08], 0.07, 0.05, skin, 8);
      const fore = group(a, side * 0.05, -0.2, 0.08);
      joint(fore, [0, 0, 0], 0.052, skin);
      limb(fore, [0, 0, 0], [0, -0.05, 0.16], 0.046, 0.036, skin, 8);
      fore.add(baked('rex-fingers', white, [-0.03, 0.03].map((dx) => [cone(0.018, 0.08, 6), at(dx, -0.07, 0.22, 1, 1, 1, Math.PI / 2 + 0.5, 0, 0)])));
      this.arms.push(a);
    }
    // Its legs, huge in the thigh, down to three great claws.
    this.legs = [];
    for (const side of [-1, 1]) {
      const l = group(b, side * 0.52, 1.56, -0.25);
      l.add(mesh(sphere(1, 20, 14), skin, side * 0.04, -0.3, 0.06, 0.42, 0.68, 0.6));
      const shin = group(l, 0, -0.78, 0.2);
      joint(shin, [0, 0, 0], 0.27, skin);
      limb(shin, [0, 0, 0], [0, -0.46, -0.28], 0.25, 0.16, skin, 12);
      const foot = group(shin, 0, -0.46, -0.28);
      joint(foot, [0, 0, 0], 0.16, skin);
      limb(foot, [0, 0, 0], [0, -0.18, 0.14], 0.15, 0.13, skin, 10);
      foot.add(mesh(sphere(1, 14, 10), dark, 0, -0.25, 0.32, 0.27, 0.09, 0.42));
      foot.add(baked('rex-claws', white, [-0.17, 0, 0.17].map((dx) => [cone(0.065, 0.2, 6), at(dx, -0.27, 0.74 - Math.abs(dx) * 0.5, 1, 1, 1, Math.PI / 2 + 0.2, 0, 0)])));
      l.userData.shin = shin;
      l.userData.foot = foot;
      this.legs.push(l);
    }
    // Its tail, long and heavy, wagging behind it.
    this.tail = [];
    let parent = group(t, 0, 1.62, -0.98);
    for (let i = 0; i < 6; i++) {
      const r = 0.27 - i * 0.042;
      const seg = group(parent, 0, i ? -0.05 : 0, i ? -0.42 : 0);
      seg.rotation.x = i ? -0.04 : 0;
      seg.add(mesh(sphere(1, 14, 10), skin, 0, -0.01, -0.21, r, r * 0.96, 0.3));
      if (i < 5) seg.add(mesh(cone(r * 0.42, r * 0.9, 6), plate, 0, r * 0.95, -0.2, 0.35, 1, 1));
      if (i % 2 === 0) seg.add(mesh(sphere(1, 10, 8), dark, 0, r * 0.72, -0.2, r * 0.68, 0.035, 0.08));
      this.tail.push(seg);
      parent = seg;
    }
    this.lean = 0;
    this.roar = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 5, 8.5, 15);
    const step = go ? Math.sin(t * speed) : 0;
    const crouch = state === 'stomp' && air < 0.1;
    const sy = 1 - this.squash * 0.35 - (crouch ? 0.14 : 0);
    this.body.scale.set(1 + this.squash * 0.15, sy, 1 + this.squash * 0.15);
    this.legs.forEach((l, i) => {
      const k = i ? -step : step;
      const reach = state === 'charge' ? 0.62 : state === 'chase' ? 0.5 : 0.36;
      l.rotation.x = -k * reach;
      l.userData.shin.rotation.x = Math.max(0, k) * 0.55;
      l.userData.foot.rotation.x = Math.max(0, -k) * 0.3;
    });
    // Rearing up, jaws wide, one foot pawing; head down and low in a charge.
    if (state === 'rear') {
      const paw = Math.max(0, Math.sin(t * 13));
      this.legs[0].rotation.x = -paw * 0.45;
      this.legs[0].userData.shin.rotation.x = paw * 0.5;
    }
    const lean = state === 'rear' ? -0.26 : state === 'charge' ? 0.14 : state === 'puff' ? 0.05 : state === 'dazed' ? 0.1 : go ? 0.05 : 0;
    this.lean = ease(this.lean, lean, 7, dt);
    this.trunk.rotation.set(this.lean, 0, go ? step * 0.035 : state === 'dazed' ? Math.sin(t * 3) * 0.04 : 0);
    this.trunk.position.y = go ? Math.abs(Math.sin(t * speed)) * 0.09 : 0;
    const roaring = state === 'puff' || state === 'rear';
    this.roar = ease(this.roar, roaring ? 1 : 0, 10, dt);
    const shake = roaring ? Math.sin(t * 42) * 0.022 : 0;
    this.head.rotation.set(
      state === 'rear' ? -0.3 : state === 'charge' ? 0.28 : state === 'puff' ? -0.1 + shake : state === 'dazed' ? 0.34 + Math.sin(t * 3) * 0.05 : state === 'chase' ? 0.1 : Math.sin(t * 1.3) * 0.03,
      state === 'giggle' ? Math.sin(t * 18) * 0.2 : state === 'dazed' ? Math.sin(t * 2) * 0.1 : go ? step * 0.05 : Math.sin(t * 0.7) * 0.12,
      shake,
    );
    this.jaw.rotation.x = 0.05 + this.roar * 0.82 + (state === 'giggle' ? 0.45 + Math.sin(t * 20) * 0.1 : 0) + (state === 'charge' ? 0.55 : 0) + (state === 'chase' ? Math.max(0, Math.sin(t * 7)) * 0.3 : 0);
    // Its little arms, waving about uselessly.
    this.arms.forEach((a, i) => {
      a.rotation.x = Math.sin(t * (roaring || state === 'chase' ? 15 : 3) + i * Math.PI) * (roaring || state === 'chase' ? 0.5 : 0.1);
    });
    this.tail.forEach((s, i) => {
      s.rotation.y = Math.sin(t * (go ? speed * 0.5 : 1.3) - i * 0.55) * (go ? 0.15 : 0.1);
      s.rotation.x = (i ? -0.04 : 0) + (state === 'rear' ? 0.05 : 0) + (state === 'charge' ? -0.03 : 0);
    });
    this.mood(state, night);
  }
}
