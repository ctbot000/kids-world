// The beasts of the first tier (shared/beasts.js), a coat for each theme of
// island:
//
// - Rattlebones: a pirate skeleton, its big round skull in a knotted bandana with
//   a gold ring in its ear, its jaw clacking as it comes at you. It falls apart
//   into a heap of bones, and pulls itself back together.
// - Stingtail: a great armoured scorpion, plates down its back, two huge pincers
//   held up in front and a jointed tail arched over it, a glowing sting on the
//   end. Eight legs ripple along its sides.
// - Shadow Wolf: lean, with a shaggy mane and a bushy tail, four jointed legs that
//   gallop, and a mouth full of teeth. It throws its head back to howl.
// - Thunderhawk: a great bird of prey with a hooked beak and a crest, its wings
//   marked with lightning that glows, spreading them wide to call the bolts down.
// - Mimic: a treasure chest with gold bands and a lock, just like a real one,
//   until the lid comes up: rows of teeth, a long tongue, two eyes in the dark
//   inside, and four stubby feet. (Now and then, shut, it peeks.)
import * as THREE from '../../vendor/three.module.js';
import { aim, at, baked, Beast, crossEye, DARK, ease, group, joint, limb, moving, pace } from './beast-kit.js';
import { thrownMesh } from './boss-fx.js';
import { capsule, cone, cylinder, lathe, mesh, roundedBox, sphere, toon, torus } from './toon.js';

const DOME = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

// ---------------------------------------------------------------- Rattlebones

const RATTLE = {
  sunny: { bone: '#f3ead2', shade: '#d9ccab', cloth: '#d6372f', knot: '#a82720' },
  snowy: { bone: '#eef4f8', shade: '#c9d8e4', cloth: '#3f7fd6', knot: '#2c5ea8' },
  candy: { bone: '#fff4e6', shade: '#f0d8c8', cloth: '#ff6fb1', knot: '#d94c8e' },
  volcano: { bone: '#6b5f58', shade: '#4a403b', cloth: '#ff7a1a', knot: '#c9500f', glow: '#ff7a1a', white: '#ffb13b' },
};

export class RattleModel extends Beast {
  constructor(theme = 'sunny') {
    const c = RATTLE[theme] ?? RATTLE.sunny;
    super({ height: 1.65, center: 0.8, pick: 0.7, radius: 0.42, glow: c.glow ?? '#7dffb1', white: c.white ?? '#ffe45c' });
    const bone = toon(c.bone);
    const shade = toon(c.shade);
    const dark = toon(DARK);
    const cloth = toon(c.cloth);
    const b = this.body;
    // Each part, where it is when it stands and where it lands in the heap.
    this.parts = [];
    const part = (x, y, z, pile) => {
      const g = group(b, x, y, z);
      this.parts.push({ g, rest: new THREE.Vector3(x, y, z), pile: new THREE.Vector3(pile[0], pile[1], pile[2]), turn: new THREE.Euler(pile[3], pile[4], pile[5]) });
      return g;
    };
    // Its hips.
    this.hips = part(0, 0.66, 0, [0.02, 0.08, 0.06, 1.3, 0, 0.3]);
    this.hips.add(mesh(sphere(), bone, 0, 0, 0, 0.17, 0.085, 0.115));
    this.hips.add(mesh(sphere(1, 10, 8), shade, 0, 0.005, 0.07, 0.09, 0.05, 0.05));
    // Its spine and three ribs.
    this.chest = part(0, 0.72, 0, [-0.14, 0.14, -0.1, 1.35, 0.5, 0.5]);
    this.chest.add(mesh(cylinder(0.032, 0.04, 0.34, 8), shade, 0, 0.17, -0.05));
    for (const [y, w] of [[0.1, 0.8], [0.19, 1], [0.28, 0.98]]) {
      this.chest.add(mesh(torus(0.17, 0.024), bone, 0, y, 0, w, 0.78, 1).rotateX(Math.PI / 2));
    }
    this.chest.add(mesh(sphere(1, 8, 6), bone, 0, 0.2, 0.125, 0.032, 0.12, 0.02));
    this.chest.add(mesh(capsule(0.03, 0.38), bone, 0, 0.36, -0.01).rotateZ(Math.PI / 2));
    // Its head.
    this.head = part(0, 1.12, 0.02, [0.2, 0.2, 0.2, 0.3, 0.9, 1.3]);
    const h = this.head;
    h.add(mesh(sphere(1, 22, 16), bone, 0, 0.15, 0, 0.26, 0.24, 0.25));
    h.add(mesh(sphere(1, 16, 10), bone, 0, 0.03, 0.05, 0.18, 0.11, 0.17));
    // Eye holes, with a glow far in them, and cross ridges of bone over them.
    for (const side of [-1, 1]) {
      h.add(mesh(sphere(1, 14, 10), dark, side * 0.1, 0.13, 0.19, 0.082, 0.088, 0.055));
      const eye = mesh(sphere(1, 10, 8), this.eyeWhite, side * 0.098, 0.12, 0.235, 0.034, 0.04, 0.018);
      h.add(eye);
      this.eyes.push(eye);
      const ridge = mesh(sphere(1, 8, 6), shade, side * 0.1, 0.225, 0.2, 0.095, 0.022, 0.04);
      ridge.rotation.z = side * 0.42;
      h.add(ridge);
      this.brows.push({ mesh: ridge, side, slope: 0.42 });
    }
    const nose = mesh(cone(0.028, 0.06, 6), dark, 0, 0.06, 0.225);
    h.add(nose);
    // Its upper teeth, and its jaw hanging from a hinge, clacking.
    h.add(baked('rattle-teeth', bone, [-2, -1, 0, 1, 2].map((i) => [roundedBox(0.03, 0.05, 0.03), at(i * 0.034, -0.015, 0.205 - Math.abs(i) * 0.01)])));
    this.jaw = group(h, 0, -0.03, 0.03);
    this.jaw.add(mesh(sphere(1, 14, 8), bone, 0, -0.045, 0.05, 0.15, 0.05, 0.145));
    this.jaw.add(baked('rattle-jaw', bone, [-2, -1, 0, 1, 2].map((i) => [roundedBox(0.03, 0.04, 0.03), at(i * 0.034, -0.008, 0.165 - Math.abs(i) * 0.01)])));
    this.mouth = group(h, 0, 0, 0.22);
    // A bandana knotted behind, and a gold ring in one ear.
    h.add(mesh(DOME, cloth, 0, 0.2, -0.01, 0.262, 0.2, 0.255));
    h.add(mesh(torus(0.255, 0.018), toon(c.knot), 0, 0.205, -0.01, 1, 1, 1).rotateX(Math.PI / 2));
    for (const side of [-1, 1]) {
      const tail = mesh(sphere(1, 10, 8), toon(c.knot), side * 0.07, 0.17, -0.3, 0.06, 0.03, 0.11);
      tail.rotation.set(0.5, side * 0.55, side * 0.3);
      h.add(tail);
    }
    h.add(mesh(sphere(1, 8, 6), toon(c.knot), 0, 0.19, -0.26, 0.04));
    h.add(mesh(torus(0.04, 0.009), toon('#ffcc33', { emissive: 0.25 }), 0.26, 0.04, 0.02).rotateY(Math.PI / 2));
    // Its arms, and in its right hand a bone for throwing.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = part(side * 0.23, 1.07, 0, [side * 0.28, 0.06, side * 0.16, 1.5, side * 0.6, side * 0.6]);
      limb(arm, [0, 0, 0], [side * 0.04, -0.24, 0], 0.03, 0.026, bone, 8);
      joint(arm, [0, 0, 0], 0.045, bone);
      const fore = group(arm, side * 0.04, -0.24, 0);
      joint(fore, [0, 0, 0], 0.036, bone);
      limb(fore, [0, 0, 0], [0, -0.22, 0.03], 0.024, 0.02, bone, 8);
      joint(fore, [0, -0.24, 0.03], 0.05, bone);
      arm.userData.fore = fore;
      arm.userData.side = side;
      this.arms.push(arm);
    }
    this.held = thrownMesh('bone');
    this.held.position.set(0, -0.28, 0.06);
    this.held.scale.setScalar(0.9);
    this.held.visible = false;
    this.arms[1].userData.fore.add(this.held);
    // Its legs.
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = part(side * 0.1, 0.62, 0, [side * 0.22, 0.07, side * -0.2 - 0.05, 1.5, side * -0.9, 0]);
      joint(leg, [0, 0, 0], 0.05, bone);
      limb(leg, [0, 0, 0], [0, -0.28, 0.01], 0.034, 0.03, bone, 8);
      const shin = group(leg, 0, -0.28, 0.01);
      joint(shin, [0, 0, 0], 0.044, bone);
      limb(shin, [0, 0, 0], [0, -0.28, -0.01], 0.028, 0.024, bone, 8);
      shin.add(mesh(roundedBox(0.1, 0.05, 0.2, 0.024), bone, 0, -0.3, 0.05));
      leg.userData.shin = shin;
      leg.userData.side = side;
      this.legs.push(leg);
    }
    this.fall = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.5;
    this.body.scale.set(1 + this.squash * 0.25, sy, 1 + this.squash * 0.25);
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 7, 13);
    const swing = go ? Math.sin(t * speed) : 0;
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 22) * 0.12 : go ? swing * 0.05 : Math.sin(t * 2) * 0.012);
    const bob = go ? Math.abs(Math.sin(t * speed)) * 0.03 : 0;
    this.body.position.y = bob;
    // Clack, clack: quicker coming at you, wide open giggling.
    const clack = state === 'giggle' ? 0.5 : Math.max(0, Math.sin(t * (state === 'chase' ? 16 : 3))) * (go ? 0.35 : 0.12);
    this.jaw.rotation.x = clack;
    // Legs and arms in their poses, before the heap has its say.
    const rage = state === 'chase' ? 0.8 : 0.5;
    this.legs.forEach((l, i) => {
      const k = i ? -swing : swing;
      l.rotation.set(k * 0.6, 0, 0);
      l.userData.shin.rotation.x = Math.max(0, -k) * 0.8 + 0.02;
    });
    const up = state === 'hurl' && t - this.throwAt > 0.5;
    this.arms.forEach((a, i) => {
      const k = i ? swing : -swing;
      a.rotation.set(k * rage, 0, a.userData.side * -0.12);
      a.userData.fore.rotation.x = -0.45 - Math.max(0, k) * 0.4;
    });
    // Winding up to throw: its right arm back over its head; thrown, forwards.
    if (state === 'hurl') {
      const arm = this.arms[1];
      arm.rotation.x = up ? -2.6 + Math.sin(t * 16) * 0.05 : 0.5;
      arm.userData.fore.rotation.x = up ? -0.9 : -0.2;
    }
    if (state === 'dazed') this.body.rotation.z = Math.sin(t * 6) * 0.1;
    this.head.rotation.set(state === 'chase' ? 0.1 : 0, Math.sin(t * 1.3) * 0.08, 0);
    this.held.visible = up;
    // Falling apart in a moment; pulling itself back together a little slower,
    // each bone rattling up into its place.
    this.fall = ease(this.fall, state === 'heap' ? 1 : 0, state === 'heap' ? 12 : 4, dt);
    const f = this.fall;
    if (f > 0.002) {
      const shake = state === 'heap' ? 0 : Math.sin(t * 40) * 0.02 * f;
      for (const p of this.parts) {
        p.g.position.lerpVectors(p.rest, p.pile, f);
        p.g.position.y += shake;
        p.g.rotation.x += (p.turn.x - p.g.rotation.x) * f;
        p.g.rotation.y += (p.turn.y - p.g.rotation.y) * f;
        p.g.rotation.z += (p.turn.z - p.g.rotation.z) * f;
      }
    } else {
      for (const p of this.parts) p.g.position.copy(p.rest);
    }
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Stingtail

const STINGER = {
  sunny: { shell: '#b5651d', plate: '#d98a35', dark: '#6e3a12', under: '#e9c98f', sting: '#9dff3d' },
  snowy: { shell: '#5a8fc2', plate: '#8fbfe6', dark: '#2f5a8a', under: '#dcecf8', sting: '#a6f4ff' },
  candy: { shell: '#7a3fa8', plate: '#b77de0', dark: '#4a2470', under: '#f7c9e8', sting: '#ff6fb1' },
  volcano: { shell: '#3a3036', plate: '#55474e', dark: '#201a1e', under: '#7a5a48', sting: '#ff7a1a' },
};

export class StingerModel extends Beast {
  constructor(theme = 'sunny') {
    const c = STINGER[theme] ?? STINGER.sunny;
    super({ height: 1.5, center: 0.45, pick: 0.8, radius: 0.72, glow: '#ffef7a' });
    const shell = toon(c.shell);
    const plate = toon(c.plate);
    const dark = toon(c.dark);
    const b = this.body;
    // The head end and three plates of its back, and a paler underside.
    b.add(mesh(sphere(), toon(c.under), 0, 0.24, -0.05, 0.36, 0.13, 0.66));
    b.add(mesh(sphere(1, 22, 14), shell, 0, 0.36, 0.2, 0.38, 0.21, 0.42));
    for (const [z, w, h] of [[-0.12, 0.36, 0.2], [-0.33, 0.31, 0.18], [-0.52, 0.25, 0.155]]) {
      b.add(mesh(sphere(1, 18, 12), shell, 0, 0.35, z, w, h, 0.17));
      b.add(mesh(torus(1, 0.05), dark, 0, 0.35, z - 0.12, w * 0.92, h * 0.92, 1));
    }
    // A ridge of lighter plates down its back.
    b.add(baked('stinger-plates', plate, [[0.5, 0.2, 0.2, 0.13], [0.54, 0.03, 0.15, 0.1], [0.53, -0.14, 0.13, 0.1], [0.5, -0.33, 0.11, 0.09], [0.46, -0.5, 0.09, 0.08]].map(([y, z, w, d]) => [sphere(1, 10, 8), at(0, y, z, w, 0.05, d)])));
    // Eyes up on its head, and two little jaws under them.
    crossEye(this, b, -1, -0.13, 0.46, 0.5, { w: 0.09 });
    crossEye(this, b, 1, 0.13, 0.46, 0.5, { w: 0.09 });
    this.mouth = group(b, 0, 0.3, 0.6);
    for (const side of [-1, 1]) {
      const m = mesh(cone(0.03, 0.1, 6), dark, side * 0.05, 0.28, 0.6);
      m.rotation.set(Math.PI / 2 + 0.3, 0, side * 0.3);
      b.add(m);
    }
    // Two huge pincers held up in front, the top jaw of each snapping.
    this.arms = [];
    this.jaws = [];
    for (const side of [-1, 1]) {
      const arm = group(b, side * 0.3, 0.36, 0.4);
      arm.userData.side = side;
      limb(arm, [0, 0, 0], [side * 0.26, 0.1, 0.2], 0.075, 0.06, shell, 10);
      joint(arm, [0, 0, 0], 0.09, shell);
      const fore = group(arm, side * 0.26, 0.1, 0.2);
      joint(fore, [0, 0, 0], 0.075, dark);
      limb(fore, [0, 0, 0], [-side * 0.1, 0.05, 0.2], 0.06, 0.08, shell, 10);
      const claw = group(fore, -side * 0.1, 0.05, 0.24);
      claw.add(mesh(sphere(1, 14, 10), shell, 0, 0, 0, 0.14, 0.11, 0.17));
      const top = group(claw, 0, 0.05, 0.08);
      top.add(mesh(sphere(1, 12, 8), plate, 0, 0.03, 0.12, 0.085, 0.05, 0.16));
      top.add(mesh(cone(0.04, 0.12, 8), dark, 0, 0.0, 0.28).rotateX(Math.PI / 2 + 0.25));
      const under = mesh(sphere(1, 12, 8), plate, 0, -0.06, 0.18, 0.075, 0.04, 0.13);
      claw.add(under);
      claw.add(mesh(cone(0.034, 0.1, 8), dark, 0, -0.04, 0.33).rotateX(Math.PI / 2 - 0.25));
      this.jaws.push(top);
      this.arms.push(arm);
    }
    // Eight legs, four a side, knees up over its back.
    this.legs = [];
    for (const side of [-1, 1]) {
      for (const [i, z] of [0.2, 0.05, -0.1, -0.25].entries()) {
        const l = group(b, side * 0.28, 0.3, z);
        l.userData.side = side;
        l.userData.i = i;
        const sweep = 0.14 - i * 0.1;
        limb(l, [0, 0, 0], [side * 0.28, 0.14, sweep], 0.032, 0.026, dark, 7);
        joint(l, [side * 0.28, 0.14, sweep], 0.03, dark);
        limb(l, [side * 0.28, 0.14, sweep], [side * 0.5, -0.29, sweep * 1.5], 0.024, 0.012, dark, 7);
        this.legs.push(l);
      }
    }
    // Its tail arched up and over, joint by joint, the sting on the end aglow.
    this.tail = [];
    let parent = group(b, 0, 0.42, -0.6);
    parent.rotation.x = -0.75;
    const base = parent;
    this.tailBase = base;
    for (let i = 0; i < 5; i++) {
      const r = 0.125 - i * 0.012;
      const seg = group(parent, 0, i ? 0.2 : 0, 0);
      seg.rotation.x = i ? 0.52 : 0;
      seg.userData.rest = seg.rotation.x;
      seg.add(mesh(sphere(1, 12, 10), shell, 0, 0.09, 0, r, 0.135, r));
      seg.add(mesh(torus(1, 0.045), dark, 0, 0.19, 0, r * 0.74, r * 0.74, 1).rotateX(Math.PI / 2));
      this.tail.push(seg);
      parent = seg;
    }
    const sting = group(parent, 0, 0.2, 0);
    sting.rotation.x = 0.5;
    sting.add(mesh(sphere(1, 12, 10), toon(c.sting, { emissive: 0.55 }), 0, 0.08, 0, 0.09, 0.11, 0.09));
    sting.add(mesh(cone(0.05, 0.18, 8), toon('#2b2530'), 0, 0.25, 0));
    this.open = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.5;
    this.body.scale.set(1 + this.squash * 0.25, sy, 1 + this.squash * 0.25);
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 12, 22);
    this.body.rotation.set(state === 'rear' ? -0.16 : state === 'charge' ? 0.05 : 0, 0, state === 'giggle' ? Math.sin(t * 22) * 0.1 : state === 'dazed' ? Math.sin(t * 6) * 0.06 : 0);
    this.legs.forEach((l) => {
      const phase = l.userData.i * 1.5 + (l.userData.side > 0 ? Math.PI : 0);
      l.rotation.x = go ? Math.sin(t * speed + phase) * 0.32 : 0;
      l.rotation.z = go ? l.userData.side * Math.max(0, Math.cos(t * speed + phase)) * 0.14 : 0;
    });
    // Pincers: wide open and high rearing back, held out together charging,
    // snapping coming at you, and now and then at nothing.
    const wide = state === 'rear' ? 1 : 0;
    this.open = ease(this.open, wide, 8, dt);
    this.arms.forEach((a, i) => {
      const side = a.userData.side;
      a.rotation.y = side * (state === 'charge' ? -0.5 : this.open * 0.55);
      a.rotation.x = state === 'charge' ? 0.15 : -this.open * 0.45 + Math.sin(t * 2 + i) * 0.04;
    });
    this.jaws.forEach((j, i) => {
      const k = state === 'rear' ? 1 : Math.max(0, Math.sin(t * (state === 'chase' || state === 'charge' ? 15 : 2.4) + i * Math.PI));
      j.rotation.x = -k * 0.6;
    });
    // The tail: swaying, cocked right back, whipped forward as it flicks its
    // venom, flat out behind in a charge, and drooped, dazed.
    const flick = state === 'hurl' ? (t - this.throwAt < 0.35 ? 0.5 : -0.18) : 0;
    const lie = state === 'charge' ? -0.3 : state === 'dazed' ? -0.28 : state === 'rear' ? 0.08 : 0;
    this.tail.forEach((s, i) => {
      if (i) s.rotation.x = s.userData.rest + flick + lie + Math.sin(t * 2.6 + i * 0.7) * 0.05;
      s.rotation.z = Math.sin(t * 1.7 + i * 0.5) * (go ? 0.09 : 0.05);
    });
    this.tailBase.rotation.x = -0.75 + flick * 0.5;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Shadow Wolf

const WOLF = {
  sunny: { fur: '#4d5573', mane: '#343a54', belly: '#9aa2bc', nose: '#191522', glow: '#ffcf4d' },
  snowy: { fur: '#e6edf5', mane: '#b9c8da', belly: '#ffffff', nose: '#2c3648', glow: '#7ae0ff' },
  candy: { fur: '#a06fd0', mane: '#7a4ca8', belly: '#f3c6ec', nose: '#3a1f4f', glow: '#ff9ad4' },
  volcano: { fur: '#2e2a30', mane: '#191618', belly: '#5a4a48', nose: '#0f0c0e', glow: '#ff7a1a', ember: true },
};

export class WolfModel extends Beast {
  constructor(theme = 'sunny') {
    const c = WOLF[theme] ?? WOLF.sunny;
    super({ height: 1.25, center: 0.65, pick: 0.7, radius: 0.5, glow: c.glow, white: '#fff0b8' });
    const fur = toon(c.fur);
    const mane = toon(c.ember ? '#ff7a1a' : c.mane, c.ember ? { emissive: 0.4 } : {});
    const belly = toon(c.belly);
    const nose = toon(c.nose);
    const b = this.body;
    // Lean and deep-chested, from its rump to its neck.
    this.trunk = group(b);
    const t = this.trunk;
    t.add(mesh(sphere(1, 20, 14), fur, 0, 0.74, -0.28, 0.22, 0.2, 0.34));
    t.add(mesh(sphere(1, 20, 14), fur, 0, 0.8, 0.14, 0.25, 0.27, 0.38));
    t.add(mesh(sphere(1, 18, 14), fur, 0, 0.94, 0.36, 0.19, 0.2, 0.2));
    t.add(mesh(sphere(1, 16, 10), belly, 0, 0.62, 0.12, 0.17, 0.15, 0.32));
    // A shaggy mane, tufts all pointing back, and a ridge of them down its back.
    const tufts = [];
    for (const [ring, z, r] of [[0, 0.46, 0.2], [1, 0.3, 0.27], [2, 0.14, 0.27]]) {
      for (let i = 0; i < 9; i++) {
        const a = (i + ring * 0.5) * (Math.PI / 4.5);
        const s = Math.sin(a);
        if (s < -0.75) continue;
        tufts.push([cone(0.105, 0.24, 7), aim(Math.cos(a) * r, 0.9 + s * r, z, Math.cos(a) * 0.55, s * 0.55, -0.85)]);
      }
    }
    for (const z of [-0.06, -0.24, -0.42]) tufts.push([cone(0.08, 0.18, 6), aim(0, 1.03 + z * 0.32, z, 0, 0.45, -0.9)]);
    t.add(baked('wolf-mane', mane, tufts));
    // Its head, low and forward, with a long muzzle and tall ears.
    this.head = group(t, 0, 1.05, 0.56);
    this.head.scale.setScalar(1.18);
    const h = this.head;
    h.add(mesh(sphere(1, 18, 14), fur, 0, 0, 0, 0.18, 0.165, 0.2));
    h.add(mesh(sphere(1, 14, 10), fur, 0, -0.035, 0.22, 0.095, 0.075, 0.18));
    h.add(mesh(sphere(1, 10, 8), belly, 0, -0.07, 0.24, 0.075, 0.035, 0.14));
    h.add(mesh(sphere(1, 10, 8), nose, 0, -0.005, 0.385, 0.038, 0.03, 0.028));
    for (const side of [-1, 1]) {
      const ear = mesh(cone(0.065, 0.17, 8), fur, side * 0.115, 0.17, -0.05);
      ear.rotation.z = -side * 0.22;
      h.add(ear);
      const inner = mesh(cone(0.034, 0.11, 6), mane, side * 0.118, 0.155, -0.018);
      inner.rotation.z = -side * 0.22;
      h.add(inner);
      h.add(mesh(sphere(1, 8, 6), mane, side * 0.16, -0.05, -0.02, 0.055, 0.09, 0.07));
    }
    crossEye(this, h, -1, -0.085, 0.045, 0.155, { w: 0.058, h: 0.05, slope: 0.6 });
    crossEye(this, h, 1, 0.085, 0.045, 0.155, { w: 0.058, h: 0.05, slope: 0.6 });
    // Teeth on top, and a jaw that drops open, with teeth of its own.
    const white = toon('#ffffff');
    h.add(baked('wolf-teeth', white, [[-0.065, 0.28], [0.065, 0.28], [-0.05, 0.33], [0.05, 0.33], [-0.022, 0.355], [0.022, 0.355]].map(([x, z], i) => [cone(0.014, i < 2 ? 0.07 : 0.04, 6), at(x, i < 2 ? -0.11 : -0.095, z, 1, 1, 1, Math.PI, 0, 0)])));
    this.jaw = group(h, 0, -0.08, 0.08);
    this.jaw.add(mesh(sphere(1, 12, 8), fur, 0, -0.03, 0.12, 0.08, 0.03, 0.16));
    this.jaw.add(mesh(sphere(1, 8, 6), toon('#d4566e'), 0, -0.012, 0.1, 0.055, 0.015, 0.12));
    this.jaw.add(baked('wolf-jaw', white, [[-0.055, 0.2], [0.055, 0.2], [-0.03, 0.25], [0.03, 0.25]].map(([x, z]) => [cone(0.012, 0.04, 6), at(x, 0.005, z)])));
    this.mouth = group(h, 0, -0.06, 0.34);
    // Four legs, each with a knee and a paw.
    this.legs = [];
    for (const [x, z, front] of [[-0.13, 0.28, true], [0.13, 0.28, true], [-0.14, -0.36, false], [0.14, -0.36, false]]) {
      const l = group(t, x * 1.15, 0.68, z);
      l.userData.front = front;
      const knee = front ? [0, -0.31, 0.03] : [0, -0.28, 0.09];
      joint(l, [0, 0.03, 0], front ? 0.125 : 0.15, fur);
      limb(l, [0, 0, 0], knee, front ? 0.1 : 0.12, 0.066, fur, 10);
      const shin = group(l, ...knee);
      joint(shin, [0, 0, 0], 0.068, fur);
      const foot = front ? [0, -0.29, -0.01] : [0, -0.33, -0.08];
      limb(shin, [0, 0, 0], foot, 0.06, 0.05, fur, 8);
      shin.add(mesh(sphere(1, 10, 8), toon(c.nose), foot[0], foot[1] - 0.005, foot[2] + 0.05, 0.072, 0.04, 0.1));
      l.userData.shin = shin;
      this.legs.push(l);
    }
    // A bushy tail, in three parts.
    this.tail = [];
    let parent = group(t, 0, 0.84, -0.56);
    parent.rotation.x = -1.95;
    for (let i = 0; i < 2; i++) {
      const seg = group(parent, 0, i ? 0.12 : 0, 0);
      seg.rotation.x = i ? 0.25 : 0;
      seg.userData.rest = seg.rotation.x;
      if (i) {
        seg.add(mesh(lathe([[0.04, 0], [0.11, 0.12], [0.135, 0.28], [0.11, 0.44], [0.06, 0.56], [0.005, 0.64]], 12), fur));
        seg.add(mesh(lathe([[0.075, 0.44], [0.075, 0.5], [0.05, 0.58], [0.005, 0.66]], 12), mane));
      } else {
        seg.add(mesh(sphere(1, 10, 8), fur, 0, 0.05, 0, 0.06, 0.1, 0.06));
      }
      this.tail.push(seg);
      parent = seg;
    }
    this.sit = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.5;
    this.body.scale.set(1 + this.squash * 0.2, sy, 1 + this.squash * 0.2);
    const go = moving(state) && air < 0.2;
    const up = state === 'leap' && air >= 0.2;
    const crouch = state === 'leap' && air < 0.2;
    const howl = state === 'howl';
    this.sit = ease(this.sit, howl ? 1 : 0, 7, dt);
    const speed = pace(state, 8, 15);
    // A gallop: the front pair together, the back pair half a stride after.
    const run = state === 'chase';
    this.legs.forEach((l, i) => {
      const front = l.userData.front;
      const left = i % 2 === 0;
      const phase = run ? (front ? 0 : Math.PI) + (left ? 0 : 0.5) : (front === left ? 0 : Math.PI);
      let k = go ? Math.sin(t * speed + phase) * (run ? 0.75 : 0.45) : 0;
      if (up) k = front ? -1 : 1;
      if (crouch) k = front ? 0.5 : -0.5;
      l.rotation.x = k - (front ? 0 : this.sit * 1.1);
      const bend = go ? Math.max(0, (front ? 1 : -1) * Math.cos(t * speed + phase)) * 0.8 : 0;
      l.userData.shin.rotation.x = (front ? -1 : 1) * (bend + (crouch ? 0.7 : 0)) + (front ? 0 : this.sit * 1.2);
    });
    this.trunk.rotation.x = up ? -0.08 : crouch ? 0.14 : -this.sit * 0.62;
    this.trunk.position.y = go ? Math.abs(Math.sin(t * speed)) * (run ? 0.07 : 0.03) : crouch ? -0.18 : -this.sit * 0.14;
    this.trunk.position.z = -this.sit * 0.1;
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 22) * 0.12 : state === 'dazed' ? Math.sin(t * 6) * 0.1 : 0);
    // Its head low on the hunt, thrown back to howl.
    this.head.rotation.x = howl ? -0.75 : state === 'chase' ? 0.18 : crouch ? 0.32 : Math.sin(t * 1.4) * 0.03;
    this.head.rotation.y = go ? 0 : Math.sin(t * 0.9) * 0.14;
    this.jaw.rotation.x = howl ? 0.8 : state === 'giggle' ? 0.5 : up ? 0.7 : state === 'chase' ? 0.18 + Math.max(0, Math.sin(t * 10)) * 0.2 : 0.05;
    this.tail.forEach((s, i) => {
      s.rotation.x = s.userData.rest + (run ? -0.1 : 0);
      s.rotation.z = Math.sin(t * (go ? 7 : 2.2) + i * 0.6) * (go ? 0.14 : 0.08);
    });
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Thunderhawk

const HAWK = {
  sunny: { top: '#3f4296', mid: '#5a5ec2', under: '#d9dcf5', bolt: '#ffe14d', beak: '#ffc23f' },
  snowy: { top: '#dfe9f4', mid: '#b4cbe2', under: '#ffffff', bolt: '#59c7ff', beak: '#ffc23f' },
  candy: { top: '#d65fa0', mid: '#f08cc0', under: '#ffe3f2', bolt: '#fff06a', beak: '#ffd23f' },
  volcano: { top: '#2b2730', mid: '#463f4c', under: '#6e5f62', bolt: '#ff8a2a', beak: '#e8a13a' },
};

function wing(model, parent, side, c) {
  const top = toon(c.top);
  const mid = toon(c.mid);
  const bolt = toon(c.bolt, { emissive: 0.75 });
  const w = group(parent, side * 0.2, 0.12, 0.08);
  w.add(mesh(sphere(1, 14, 8), top, side * 0.34, 0, 0, 0.42, 0.06, 0.34));
  w.add(mesh(sphere(1, 12, 8), toon(c.under), side * 0.34, -0.035, -0.01, 0.39, 0.035, 0.31));
  // A zigzag of lightning along it, on top and underneath.
  for (const y of [0.042, -0.05]) {
    const strip = mesh(sphere(1, 8, 6), bolt, side * 0.22, y, -0.03, 0.12, 0.012, 0.035);
    strip.rotation.y = side * 0.5;
    w.add(strip);
  }
  const outer = group(w, side * 0.64, 0, 0);
  outer.add(mesh(sphere(1, 14, 8), mid, side * 0.32, 0, -0.03, 0.4, 0.05, 0.3));
  for (const y of [0.034, -0.034]) {
    const a = mesh(sphere(1, 8, 6), bolt, side * 0.1, y, -0.03, 0.11, 0.012, 0.03);
    a.rotation.y = -side * 0.55;
    outer.add(a);
    const b = mesh(sphere(1, 8, 6), bolt, side * 0.28, y, -0.05, 0.11, 0.012, 0.03);
    b.rotation.y = side * 0.5;
    outer.add(b);
  }
  // The long feathers at its tip and along its back edge.
  for (let i = 0; i < 6; i++) {
    const f = mesh(cone(0.1, 0.5, 6), i < 3 ? top : mid, side * (0.68 - i * 0.12) + side * 0.02, 0, -0.14 - i * 0.04, 1, 1, 0.22);
    f.rotation.set(Math.PI / 2, 0, 0);
    f.rotation.z = side * (-1.3 + i * 0.22);
    outer.add(f);
  }
  w.userData.outer = outer;
  w.userData.side = side;
  model.wings.push(w);
  return w;
}

export class HawkModel extends Beast {
  // Wings up, or a figure of it would be all wing.
  figurePose() {
    this.update(1, 'hurl', 0, false);
    this.sparks.visible = false;
    for (const w of this.wings) w.rotation.z = w.userData.side * 1.05;
  }

  constructor(theme = 'sunny') {
    const c = HAWK[theme] ?? HAWK.sunny;
    super({ height: 1.1, center: 0.55, pick: 0.75, radius: 0.6, glow: '#fff27a' });
    const top = toon(c.top);
    const under = toon(c.under);
    const bolt = toon(c.bolt, { emissive: 0.75 });
    const beak = toon(c.beak);
    this.wings = [];
    this.pivot = group(this.body, 0, 0.55, 0);
    this.pivot.scale.setScalar(1.3);
    const p = this.pivot;
    p.add(mesh(sphere(1, 20, 14), top, 0, 0, -0.04, 0.26, 0.28, 0.5));
    p.add(mesh(sphere(1, 16, 12), under, 0, -0.07, 0.1, 0.2, 0.2, 0.34));
    // A flash of lightning down its chest.
    p.add(baked('hawk-chest', bolt, [[0.02, 0.05, 0.36, 0.5], [-0.03, -0.08, 0.37, -0.5], [0.02, -0.2, 0.3, 0.5]].map(([x, y, z, r]) => [sphere(1, 8, 6), at(x, y, z, 0.022, 0.085, 0.02, 0, 0, r)])));
    // Its head, with a crest of feathers tipped with lightning, and a beak
    // hooked over a smaller one.
    this.head = group(p, 0, 0.2, 0.42);
    const h = this.head;
    h.add(mesh(sphere(1, 18, 14), top, 0, 0, 0, 0.18, 0.17, 0.2));
    h.add(mesh(sphere(1, 12, 8), under, 0, -0.07, 0.07, 0.14, 0.09, 0.13));
    for (const [i, x] of [-0.07, 0, 0.07].entries()) {
      const feather = mesh(cone(0.055, 0.3, 7), i === 1 ? bolt : top, x, 0.15, -0.16, 1, 1, 0.4);
      feather.rotation.x = -0.95 - (i === 1 ? 0 : 0.15);
      h.add(feather);
    }
    h.add(mesh(sphere(1, 12, 10), beak, 0, -0.012, 0.2, 0.07, 0.062, 0.13));
    const hook = mesh(cone(0.04, 0.13, 8), beak, 0, -0.065, 0.3);
    hook.rotation.x = Math.PI - 0.5;
    h.add(hook);
    this.jaw = group(h, 0, -0.05, 0.14);
    this.jaw.add(mesh(sphere(1, 10, 8), toon('#e09a2c'), 0, -0.018, 0.07, 0.05, 0.022, 0.09));
    this.mouth = group(h, 0, -0.04, 0.34);
    crossEye(this, h, -1, -0.1, 0.05, 0.135, { w: 0.05, h: 0.05, slope: 0.65 });
    crossEye(this, h, 1, 0.1, 0.05, 0.135, { w: 0.05, h: 0.05, slope: 0.65 });
    wing(this, p, -1, c);
    wing(this, p, 1, c);
    // Its tail, a fan of long feathers.
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.26;
      const f = mesh(cone(0.09, 0.5, 6), i % 2 ? top : toon(c.mid), Math.sin(a) * 0.14, -0.02, -0.56 - Math.cos(a) * 0.08, 1, 1, 0.2);
      f.rotation.set(-Math.PI / 2, 0, 0);
      f.rotation.y = 0;
      f.rotation.z = a;
      p.add(f);
    }
    // Its feet tucked up, each with three talons.
    this.feet = [];
    for (const side of [-1, 1]) {
      const foot = group(p, side * 0.13, -0.24, -0.04);
      limb(foot, [0, 0, 0], [0, -0.14, 0.02], 0.03, 0.026, beak, 7);
      for (const a of [-0.45, 0, 0.45]) {
        const talon = mesh(cone(0.018, 0.1, 6), toon(DARK), Math.sin(a) * 0.05, -0.18, 0.05 + Math.cos(a) * 0.03);
        talon.rotation.set(Math.PI / 2 + 0.6, 0, -a);
        foot.add(talon);
      }
      this.feet.push(foot);
    }
    // Sparks crackling round it as it calls the lightning.
    this.sparks = group(p);
    for (let i = 0; i < 6; i++) {
      const s = mesh(sphere(1, 6, 4), bolt, 0, 0, 0, 0.03, 0.09, 0.03);
      s.userData.i = i;
      this.sparks.add(s);
    }
    this.sparks.visible = false;
    this.spread = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    this.squash = 0;
    const calling = state === 'hurl';
    const swoop = state === 'chase';
    this.spread = ease(this.spread, calling ? 1 : 0, 6, dt);
    // Great slow beats hanging there, quick shallow ones as it comes at you.
    const beat = swoop ? 13 : calling ? 5 : 7;
    const deep = swoop ? 0.35 : 0.62;
    const flap = Math.sin(t * beat);
    this.wings.forEach((w) => {
      const side = w.userData.side;
      const up = this.spread * 0.5 + (swoop ? 0.12 : 0.18) + flap * deep * (1 - this.spread * 0.75);
      w.rotation.z = side * up;
      w.rotation.y = side * (swoop ? -0.45 : 0);
      w.userData.outer.rotation.z = side * (Math.sin(t * beat - 0.9) * 0.4 * (1 - this.spread * 0.8) - this.spread * 0.15);
    });
    // Rising and falling with each beat; leaning into a swoop; up tall, calling.
    this.pivot.position.y = 0.55 - flap * 0.06 * (1 - this.spread);
    this.pivot.rotation.set(swoop ? 0.42 : calling ? -0.55 : 0.05 + Math.sin(t * 1.3) * 0.03, 0, state === 'giggle' ? Math.sin(t * 22) * 0.2 : state === 'dazed' ? Math.sin(t * 6) * 0.2 : Math.sin(t * 0.8) * 0.05);
    this.head.rotation.x = swoop ? -0.28 : calling ? 0.5 : 0;
    this.jaw.rotation.x = calling || state === 'giggle' ? 0.5 : swoop ? 0.2 : 0;
    this.feet.forEach((f) => {
      f.rotation.x = swoop ? -0.9 : 0.7;
    });
    this.sparks.visible = calling;
    if (calling) {
      for (const s of this.sparks.children) {
        const a = t * 9 + s.userData.i * 1.05;
        const r = 0.5 + Math.sin(t * 17 + s.userData.i * 2.1) * 0.22;
        s.position.set(Math.cos(a) * r, 0.2 + Math.sin(a * 1.7) * 0.42, Math.sin(a) * r);
        s.rotation.set(a, a * 0.7, a * 1.3);
      }
    }
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Mimic

const MIMIC = {
  sunny: { wood: '#a8692f', lid: '#8b4f22', band: '#ffcc33', plank: '#7a431b' },
  snowy: { wood: '#7f9fc2', lid: '#a9c6e2', band: '#e9f6ff', plank: '#5e7ea4', cap: '#ffffff' },
  candy: { wood: '#ff8cc4', lid: '#ff6fb1', band: '#fff4a8', plank: '#ee6aa9', bow: '#fff4a8' },
  volcano: { wood: '#3b3438', lid: '#2a2428', band: '#ff7a1a', plank: '#241e22', hot: true },
};

export class MimicModel extends Beast {
  // Mouth open: shut, it would be only a treasure chest.
  figurePose() {
    this.update(1, 'giggle', 0, false);
  }

  constructor(theme = 'sunny') {
    const c = MIMIC[theme] ?? MIMIC.sunny;
    super({ height: 1.05, center: 0.5, pick: 0.65, radius: 0.55, glow: '#ffef7a', white: '#fff7d6' });
    const wood = toon(c.wood);
    const lidWood = toon(c.lid);
    const band = toon(c.band, c.hot ? { emissive: 0.7 } : {});
    const plank = toon(c.plank);
    const inside = toon('#58172a');
    const tooth = toon('#fffdf0');
    const b = this.body;
    this.box = group(b);
    const box = this.box;
    box.add(mesh(roundedBox(1, 0.44, 0.78, 0.06), wood, 0, 0.3, 0));
    box.add(baked('mimic-planks', plank, [0.2, 0.34].map((y) => [roundedBox(1.01, 0.012, 0.79, 0.004), at(0, y, 0)])));
    // Bands round it, and corners.
    box.add(baked('mimic-bands', band, [[-0.3, 0.075], [0.3, 0.075]].flatMap(([x, w]) => [[roundedBox(w, 0.46, 0.8, 0.02), at(x, 0.3, 0)]])));
    // Its mouth, dark red inside, and teeth all round the rim.
    box.add(mesh(roundedBox(0.9, 0.03, 0.68, 0.01), inside, 0, 0.51, 0));
    const rim = [];
    for (let i = -5; i <= 5; i++) rim.push([cone(0.042, 0.13, 6), at(i * 0.083, 0.56, 0.32)]);
    for (const x of [-0.44, 0.44]) for (let i = -2; i <= 2; i++) rim.push([cone(0.038, 0.11, 6), at(x, 0.55, i * 0.12 + 0.04)]);
    box.add(baked('mimic-teeth', tooth, rim));
    // Gold coins heaped at the back of its throat.
    box.add(baked('mimic-coins', toon('#ffcc33', { emissive: 0.4 }), [[-0.28, -0.22], [-0.14, -0.26], [0, -0.22], [0.14, -0.27], [0.28, -0.22], [-0.2, -0.15], [0.2, -0.14], [0.05, -0.15]].map(([x, z], i) => [cylinder(0.06, 0.06, 0.018, 12), at(x, 0.54 + (i % 3) * 0.012, z, 1, 1, 1, 0.2 * (i % 2 ? 1 : -1), 0, 0.15 * (i - 3))])));
    // Two eyes in the dark inside.
    for (const side of [-1, 1]) {
      const white = mesh(sphere(1, 14, 10), this.eyeWhite, side * 0.2, 0.62, 0.02, 0.1, 0.11, 0.075);
      box.add(white);
      this.eyes.push(white);
      box.add(mesh(sphere(1, 10, 8), toon(DARK), side * 0.185, 0.61, 0.085, 0.045, 0.06, 0.02));
      const brow = mesh(sphere(1, 8, 6), toon(DARK), side * 0.185, 0.73, 0.04, 0.11, 0.028, 0.03);
      brow.rotation.z = side * 0.5;
      box.add(brow);
      this.brows.push({ mesh: brow, side, slope: 0.5 });
    }
    // A long tongue, lolling out over the rim.
    this.tongue = group(box, 0, 0.53, -0.1);
    this.tongue.add(mesh(sphere(1, 12, 8), toon('#ff6f8e'), 0, 0, 0.26, 0.16, 0.035, 0.38));
    this.tongue.add(mesh(sphere(1, 8, 6), toon('#e8526f'), 0, 0.03, 0.26, 0.012, 0.01, 0.3));
    this.mouth = group(box, 0, 0.56, 0.3);
    // The lid, on its hinge along the back: arched, with its bands, its lock,
    // and teeth of its own underneath.
    this.lid = group(box, 0, 0.5, -0.39);
    const l = this.lid;
    l.add(mesh(roundedBox(1, 0.12, 0.78, 0.04), lidWood, 0, 0.06, 0.39));
    l.add(mesh(cylinder(0.39, 0.39, 1, 24), lidWood, 0, 0.12, 0.39, 0.5, 1, 1).rotateZ(Math.PI / 2));
    l.add(baked('mimic-lid-bands', band, [-0.3, 0.3].map((x) => [cylinder(0.4, 0.4, 0.075, 24), at(x, 0.12, 0.39, 0.52, 1, 1, 0, 0, Math.PI / 2)])));
    l.add(baked('mimic-lid-plank', plank, [[0.12, 0.16], [0.12, 0.62]].map(([y, z]) => [roundedBox(1.01, 0.012, 0.03, 0.004), at(0, y, z)])));
    l.add(mesh(roundedBox(0.18, 0.2, 0.05, 0.02), toon('#ffcc33'), 0, 0.03, 0.8));
    l.add(mesh(sphere(1, 8, 6), toon(DARK), 0, 0.05, 0.828, 0.024, 0.03, 0.006));
    l.add(mesh(roundedBox(0.012, 0.05, 0.01, 0.003), toon(DARK), 0, 0.012, 0.828));
    l.add(mesh(roundedBox(0.9, 0.02, 0.68, 0.008), inside, 0, 0.002, 0.39));
    const top = [];
    for (let i = -5; i <= 5; i++) top.push([cone(0.042, 0.13, 6), at(i * 0.083, -0.04, 0.72, 1, 1, 1, Math.PI, 0, 0)]);
    for (const x of [-0.44, 0.44]) for (let i = -2; i <= 2; i++) top.push([cone(0.038, 0.11, 6), at(x, -0.035, i * 0.12 + 0.43, 1, 1, 1, Math.PI, 0, 0)]);
    l.add(baked('mimic-lid-teeth', tooth, top));
    // A snowy island's has snow on top; a candy island's, a bow.
    if (c.cap) l.add(mesh(sphere(1, 16, 10), toon(c.cap), 0, 0.27, 0.39, 0.47, 0.1, 0.34));
    if (c.bow) {
      for (const side of [-1, 1]) {
        const loop = mesh(sphere(1, 10, 8), toon(c.bow), side * 0.11, 0.34, 0.39, 0.12, 0.05, 0.08);
        loop.rotation.z = side * 0.35;
        l.add(loop);
      }
      l.add(mesh(sphere(1, 8, 6), toon(c.band), 0, 0.33, 0.39, 0.05));
    }
    // Four stubby feet, tucked away while it is a chest.
    this.feet = [];
    for (const [x, z] of [[-0.36, 0.26], [0.36, 0.26], [-0.36, -0.26], [0.36, -0.26]]) {
      const foot = group(b, x, 0.1, z);
      foot.add(mesh(capsule(0.075, 0.05), plank, 0, -0.03, 0));
      foot.add(mesh(sphere(1, 10, 8), wood, 0, -0.08, 0.035, 0.09, 0.04, 0.12));
      this.feet.push(foot);
    }
    this.open = 0;
    this.lift = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const shut = state === 'idle';
    // Shut, now and then it lifts its lid a crack and peeks.
    const peek = Math.max(0, Math.sin(t * 0.7) - 0.965) * 4.5;
    // Chomp, chomp as it comes; wide open giggling or flying at you.
    const chomp = 0.34 + Math.abs(Math.sin(t * (state === 'chase' ? 9 : 5))) * 0.64;
    const want = shut ? peek : state === 'giggle' || state === 'leap' ? 1.05 : state === 'dazed' ? 0.3 : moving(state) ? chomp : 0.6;
    this.open = ease(this.open, want, shut ? 14 : 20, dt);
    this.lid.rotation.x = -this.open * 1.05;
    this.tongue.visible = this.open > 0.2;
    const tongue = Math.min(1, this.open * 1.3);
    this.tongue.scale.set(0.7 + tongue * 0.3, 1, tongue);
    this.tongue.rotation.x = state === 'giggle' ? 0.4 + Math.sin(t * 22) * 0.2 : 0.15 + Math.sin(t * 7) * 0.08;
    // Its feet come out once it is up and about.
    this.lift = ease(this.lift, shut ? 0 : 1, 14, dt);
    const crouch = state === 'leap' && air < 0.1;
    this.box.position.y = this.lift * (crouch ? 0.02 : 0.13) - (1 - this.lift) * 0.095;
    this.feet.forEach((f, i) => {
      const k = moving(state) && air < 0.2 ? Math.sin(t * 16 + i * Math.PI) * 0.45 : 0;
      f.visible = this.lift > 0.05;
      f.rotation.x = k;
      f.scale.setScalar(Math.max(0.01, this.lift));
    });
    const sy = 1 - this.squash * 0.55;
    this.body.scale.set(1 + this.squash * 0.3, sy, 1 + this.squash * 0.3);
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 22) * 0.1 : state === 'dazed' ? Math.sin(t * 6) * 0.1 : crouch ? Math.sin(t * 40) * 0.03 : 0);
    this.mood(state, night);
  }
}
