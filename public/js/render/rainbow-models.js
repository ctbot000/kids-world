// The bosses of the second episode of Adventure Isle's story (shared/isle-
// story.js, shared/bosses.js): the six who each keep a colour of the rainbow
// for Queen Grizzle in the Rainbow Lands, and the Queen herself. Each is a
// creature of its own, built at its full size, on its feet (or hovering) at
// y = 0 and facing +z, its eyes aglow at night, as the beasts are
// (beast-kit.js):
//
// - Lady Dotty, of the Tulip Fields: a ladybird as big as a cart, shiny red
//   with black spots, a pink bow between her feelers. She tucks in her legs
//   and comes rolling, and her wing cases open as she flies up to land on you.
// - Duke Bushytail, of Maple Ridge: a russet squirrel as tall as a shed, his
//   cheeks full, a coronet between his ears and a tail bigger than he is.
// - Baroness Bumble, of the Honeycomb Hills: a great striped bee in a little
//   crown and a string of pearls, humming along over the ground, her sting
//   curled under her as she comes at you.
// - Sir Blendalot, of Tangle Jungle: a chameleon with a crest like a helmet
//   and a plume on it, his eyes looking two ways at once, his tail in a curl,
//   his colour changing as he goes. He fades away to blink somewhere else.
// - Admiral Inkwell, of Bubble Lagoon: a blue octopus in an admiral's hat,
//   eight arms that he lifts all at once to slam down round him.
// - Mochi the Moon Rabbit, of Moonbeam Moor: a great white rabbit in a scarf,
//   a moon on his brow, with the mallet he pounds rice cakes with.
// - Queen Grizzle, of Castle Drab: King Grumble's big sister, a grey blob
//   with her hair piled high, a crown with the one violet jewel left in the
//   world, and her great grey umbrella, which opens to carry her off.
//
// makeBoss (boss-models.js) gives each the parts every boss has: its bubble,
// its stomp ring, what it holds up to throw, and its poses for its moves.
// These take their moves' own states (rear, charge, hurl, leap) as they are.
import * as THREE from '../../vendor/three.module.js';
import { Beast, crossEye, DARK, ease, group, joint, limb, moving, pace } from './beast-kit.js';
import { capsule, cone, cylinder, lathe, mesh, roundedBox, sphere, toon, torus, toyMaterial } from './toon.js';

// A quarter of a sphere, for a wing case.
const HALF_DOME = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI, 0, Math.PI / 2);
const GOLD = '#ffcc33';
const MOUTH = '#3a1f3f';

// A little crown round (0, y, 0) on parent: a band r across, n points on it,
// a jewel at its front.
function coronet(parent, y, r, { color = GOLD, n = 5, jewel = '#e0342a', glow = 0.4 } = {}) {
  const gold = toon(color, { emissive: 0.25 });
  parent.add(mesh(torus(r, r * 0.16), gold, 0, y, 0).rotateX(Math.PI / 2));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    parent.add(mesh(cone(r * 0.2, r * 0.55, 8), gold, Math.sin(a) * r, y + r * 0.3, Math.cos(a) * r));
  }
  parent.add(mesh(sphere(1, 10, 8), toon(jewel, { emissive: glow }), 0, y, r * 1.05, r * 0.2));
}

// ---------------------------------------------------------------- Lady Dotty

export class LadybirdModel extends Beast {
  constructor() {
    super({ height: 1.5, center: 0.75, pick: 1.2, radius: 1.2, glow: '#fff27a' });
    const red = toon('#e3342b');
    const black = toon(DARK);
    // (All of her in a group of its own, to roll along in as she charges.)
    this.roll = group(this.body, 0, 0.62, 0);
    const b = group(this.roll, 0, -0.62, 0);
    b.add(mesh(sphere(1, 22, 14), black, 0, 0.5, -0.1, 0.95, 0.34, 1.05));
    // Her wing cases, two halves of a red dome with five spots each, a seam
    // down the middle; under them, her thin wings.
    this.cases = [];
    this.wings = [];
    for (const side of [-1, 1]) {
      const hinge = group(b, 0, 0.55, -0.1);
      const half = mesh(HALF_DOME, red, 0, 0, 0, 1.02, 0.98, 1.15);
      half.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      hinge.add(half);
      for (const [x, z] of [[0.3, 0.62], [0.66, 0.15], [0.3, -0.3], [0.72, -0.5], [0.24, -0.82]]) {
        const y = 0.98 * Math.sqrt(Math.max(0, 1 - (x / 1.02) ** 2 - (z / 1.15) ** 2));
        hinge.add(mesh(sphere(1, 12, 8), black, side * x * 0.95, y * 0.95, z * 0.95, 0.19));
      }
      hinge.userData.side = side;
      this.cases.push(hinge);
      const wing = mesh(sphere(1, 14, 8), toon('#dff1ff', { transparent: true, opacity: 0.45 }), side * 0.55, 0.7, -0.4, 0.55, 0.03, 0.9);
      wing.visible = false;
      b.add(wing);
      this.wings.push(wing);
    }
    b.add(mesh(cylinder(0.03, 0.03, 2.0, 6), black, 0, 1.5, -0.1).rotateX(Math.PI / 2));
    // Her black head, a white patch at each cheek, feelers, and a pink bow.
    const head = group(b, 0, 0.6, 1.02);
    this.head = head;
    head.add(mesh(sphere(1, 20, 14), black, 0, 0, 0, 0.56, 0.44, 0.42));
    for (const side of [-1, 1]) {
      head.add(mesh(sphere(1, 12, 8), toon('#fff7ea'), side * 0.36, 0.14, 0.2, 0.17, 0.15, 0.12));
      const feeler = group(head, side * 0.16, 0.3, 0.16);
      limb(feeler, [0, 0, 0], [side * 0.22, 0.42, 0.18], 0.028, 0.02, black, 6);
      joint(feeler, [side * 0.22, 0.42, 0.18], 0.065, red);
      const bow = mesh(cone(0.11, 0.22, 10), toon('#ff8fc4'), side * 0.11, 0.47, 0.02);
      bow.rotation.z = side * Math.PI / 2;
      head.add(bow);
    }
    head.add(mesh(sphere(1, 8, 6), toon('#ff5fa8'), 0, 0.47, 0.03, 0.06));
    crossEye(this, head, -1, -0.2, 0.06, 0.34, { w: 0.115, brow: '#ffffff', slope: 0.35 });
    crossEye(this, head, 1, 0.2, 0.06, 0.34, { w: 0.115, brow: '#ffffff', slope: 0.35 });
    this.mouth = mesh(sphere(1, 12, 8), toon('#ff8fa8'), 0, -0.2, 0.36, 0.14, 0.025, 0.05);
    head.add(this.mouth);
    // Six legs, three a side.
    this.legs = [];
    for (const side of [-1, 1]) {
      for (const [i, z] of [0.6, 0.0, -0.6].entries()) {
        const l = group(b, side * 0.78, 0.42, z);
        l.userData.side = side;
        l.userData.i = i;
        limb(l, [0, 0, 0], [side * 0.42, 0.18, 0], 0.07, 0.06, black, 8);
        limb(l, [side * 0.42, 0.18, 0], [side * 0.66, -0.42, (1 - i) * 0.15], 0.06, 0.035, black, 8);
        this.legs.push(l);
      }
    }
    this.open = 0;
    this.spin = 0;
    this.tuck = 0;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const sy = 1 - this.squash * 0.45;
    this.body.scale.set(1 + this.squash * 0.2, sy, 1 + this.squash * 0.2);
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 20) * 0.08 : state === 'dazed' ? Math.sin(t * 5) * 0.08 : 0);
    // Charging, she tucks in her legs and comes rolling like a ball.
    const rolling = state === 'charge';
    this.spin = rolling ? this.spin + dt * 13 : ease(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2, 6, dt);
    this.roll.rotation.x = this.spin;
    this.tuck = ease(this.tuck, rolling || state === 'rear' ? 1 : 0, 9, dt);
    const go = moving(state) && !rolling && air < 0.2;
    const speed = pace(state, 10, 18);
    for (const l of this.legs) {
      const phase = l.userData.i * 2.1 + (l.userData.side > 0 ? Math.PI : 0);
      l.scale.setScalar(Math.max(0.1, 1 - this.tuck * 0.9));
      l.rotation.x = go ? Math.sin(t * speed + phase) * 0.35 : 0;
      l.rotation.z = go ? l.userData.side * Math.max(0, Math.cos(t * speed + phase)) * 0.18 : 0;
    }
    // Up in the air (or crouched to fly), her wing cases open and her wings buzz.
    const flying = state === 'leap' || air > 0.3;
    this.open = ease(this.open, flying && !rolling ? 1 : 0, 10, dt);
    for (const c of this.cases) c.rotation.z = c.userData.side * this.open * 0.9;
    for (const [i, w] of this.wings.entries()) {
      w.visible = this.open > 0.2;
      w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(t * 60) * 0.35);
    }
    this.head.rotation.x = state === 'rear' ? 0.3 : Math.sin(t * 1.6) * 0.04;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Duke Bushytail

export class SquirrelModel extends Beast {
  constructor() {
    super({ height: 2.5, center: 1.25, pick: 1.2, radius: 1.0, glow: '#fff27a' });
    const fur = toon('#c7652b');
    const dark = toon('#8f4318');
    const cream = toon('#f6e3c0');
    const b = this.body;
    // Haunches, a chest, a cream front, and big feet.
    b.add(mesh(sphere(1, 22, 16), fur, 0, 0.78, -0.05, 0.78, 0.8, 0.72));
    b.add(mesh(sphere(1, 20, 14), fur, 0, 1.38, 0.02, 0.6, 0.62, 0.55));
    b.add(mesh(sphere(1, 18, 12), cream, 0, 1.0, 0.36, 0.5, 0.72, 0.42));
    for (const side of [-1, 1]) b.add(mesh(sphere(1, 14, 10), dark, side * 0.45, 0.14, 0.35, 0.3, 0.14, 0.48));
    // His tail, bigger than he is: up behind him and curling over at the top.
    this.tail = group(b, 0, 0.5, -0.55);
    for (const [i, [y, z, r]] of [[0.05, -0.2, 0.4], [0.5, -0.5, 0.5], [1.0, -0.62, 0.55], [1.5, -0.55, 0.55], [1.88, -0.3, 0.47], [2.02, 0.0, 0.36]].entries()) {
      this.tail.add(mesh(sphere(1, 16, 12), i >= 4 ? cream : fur, 0, y, z, r, r, r * 0.9));
    }
    // His head: full cheeks, a dark nose, two front teeth, tufted ears and a
    // duke's coronet between them.
    const head = group(b, 0, 1.95, 0.1);
    this.head = head;
    head.add(mesh(sphere(1, 22, 16), fur, 0, 0, 0, 0.56, 0.5, 0.52));
    this.cheeks = [];
    for (const side of [-1, 1]) {
      const cheek = mesh(sphere(1, 14, 10), cream, side * 0.34, -0.14, 0.26, 0.27, 0.23, 0.25);
      head.add(cheek);
      this.cheeks.push(cheek);
      const ear = mesh(cone(0.13, 0.36, 10), fur, side * 0.32, 0.5, -0.05);
      ear.rotation.z = -side * 0.25;
      head.add(ear);
      head.add(mesh(cone(0.05, 0.2, 6), dark, side * 0.37, 0.74, -0.05));
    }
    head.add(mesh(sphere(1, 10, 8), toon(DARK), 0, -0.02, 0.52, 0.08, 0.06, 0.05));
    head.add(mesh(roundedBox(0.13, 0.15, 0.04, 0.015), toon('#ffffff'), 0, -0.27, 0.45));
    this.mouth = mesh(sphere(1, 12, 8), toon(MOUTH), 0, -0.17, 0.47, 0.12, 0.025, 0.04);
    head.add(this.mouth);
    crossEye(this, head, -1, -0.22, 0.12, 0.42, { w: 0.11, brow: '#5a2a10' });
    crossEye(this, head, 1, 0.22, 0.12, 0.42, { w: 0.11, brow: '#5a2a10' });
    coronet(head, 0.46, 0.24);
    // Little arms, held up in front of him.
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = group(b, side * 0.5, 1.55, 0.2);
      arm.add(mesh(capsule(0.11, 0.34, 5, 10), fur, 0, -0.16, 0.16).rotateX(-0.9));
      arm.add(mesh(sphere(1, 10, 8), dark, 0, -0.26, 0.36, 0.11));
      arm.userData.side = side;
      this.arms.push(arm);
    }
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const stretch = air > 0.05 ? Math.min(0.2, Math.abs(this.vy) * 0.03) : 0;
    this.body.scale.set(1 + this.squash * 0.2, 1 + stretch - this.squash * 0.4, 1 + this.squash * 0.2);
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 18) * 0.1 : state === 'dazed' ? Math.sin(t * 4) * 0.1 : 0);
    // His tail sways, and streams out behind him when he scampers.
    this.tail.rotation.x = state === 'charge' ? -0.9 : Math.sin(t * 2) * 0.07 - (air > 0.2 ? 0.3 : 0);
    this.tail.rotation.z = Math.sin(t * 1.3) * 0.06;
    // Chewing all the while; his cheeks swell as he gets an acorn ready.
    const chew = state === 'hurl' ? 1.35 : 1 + Math.abs(Math.sin(t * 7)) * 0.06;
    for (const c of this.cheeks) c.scale.set(0.27 * chew, 0.23 * chew, 0.25 * chew);
    for (const a of this.arms) a.rotation.x = state === 'hurl' ? -2.2 : state === 'charge' ? 0.9 : Math.sin(t * 3 + a.userData.side) * 0.12;
    this.head.rotation.x = state === 'rear' ? -0.25 : Math.sin(t * 1.7) * 0.05;
    this.head.rotation.z = state === 'dazed' ? Math.sin(t * 6) * 0.2 : 0;
    this.mouth.scale.y = state === 'giggle' || state === 'howl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Baroness Bumble

export class BeeModel extends Beast {
  constructor() {
    super({ height: 2.3, center: 1.3, pick: 1.2, radius: 1.15, glow: '#fff27a' });
    const yellow = toon('#ffc928');
    const fuzz = toon('#ffe07a');
    const black = toon(DARK);
    this.float = group(this.body, 0, 0.55, 0);
    const f = this.float;
    // Her striped tail end, behind her waist, a sting at the tip of it.
    this.tailEnd = group(f, 0, 0.98, -0.2);
    for (const [i, [z, r]] of [[-0.22, 0.6], [-0.52, 0.68], [-0.84, 0.62], [-1.12, 0.48], [-1.34, 0.3]].entries()) {
      this.tailEnd.add(mesh(sphere(1, 18, 12), i % 2 ? black : yellow, 0, -0.06 - i * 0.03, z, r, r * 0.92, 0.36));
    }
    this.tailEnd.add(mesh(cone(0.09, 0.42, 10), black, 0, -0.2, -1.66).rotateX(-Math.PI / 2));
    // A fuzzy middle, and six thin legs dangling under it.
    f.add(mesh(sphere(1, 20, 14), fuzz, 0, 1.0, 0.12, 0.62, 0.58, 0.6));
    this.legs = [];
    for (const side of [-1, 1]) {
      for (const z of [0.4, 0.12, -0.16]) {
        const l = group(f, side * 0.36, 0.62, z);
        limb(l, [0, 0, 0], [side * 0.2, -0.26, 0.06], 0.045, 0.035, black, 6);
        limb(l, [side * 0.2, -0.26, 0.06], [side * 0.14, -0.5, 0.0], 0.035, 0.025, black, 6);
        this.legs.push(l);
      }
    }
    // Her head: big eyes, feelers, a little crown and a string of pearls.
    const head = group(f, 0, 1.14, 0.8);
    this.head = head;
    head.add(mesh(sphere(1, 20, 14), yellow, 0, 0, 0, 0.5, 0.46, 0.42));
    crossEye(this, head, -1, -0.22, 0.06, 0.34, { w: 0.14, slope: 0.4 });
    crossEye(this, head, 1, 0.22, 0.06, 0.34, { w: 0.14, slope: 0.4 });
    this.mouth = mesh(sphere(1, 12, 8), toon(MOUTH), 0, -0.2, 0.37, 0.12, 0.025, 0.04);
    head.add(this.mouth);
    for (const side of [-1, 1]) {
      limb(head, [side * 0.16, 0.36, 0.1], [side * 0.3, 0.72, 0.3], 0.025, 0.02, black, 6);
      joint(head, [side * 0.3, 0.72, 0.3], 0.06, black);
    }
    coronet(head, 0.42, 0.2, { jewel: '#5fc7e6' });
    for (let i = 0; i < 7; i++) {
      const a = ((i - 3) / 3) * 1.1;
      f.add(mesh(sphere(1, 8, 6), toon('#ffffff', { emissive: 0.15 }), Math.sin(a) * 0.5, 0.78 - Math.cos(a) * 0.1, 0.52 + Math.cos(a) * 0.22, 0.06));
    }
    // Four thin wings, always humming.
    this.wings = [];
    const glass = toon('#e6f6ff', { transparent: true, opacity: 0.5 });
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) {
        const pivot = group(f, side * 0.3, 1.5, k ? -0.2 : 0.1);
        pivot.add(mesh(sphere(1, 14, 8), glass, side * (k ? 0.5 : 0.72), 0, 0, k ? 0.5 : 0.75, 0.03, k ? 0.26 : 0.36));
        pivot.userData.side = side;
        this.wings.push(pivot);
      }
    }
    this.curl = 0;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    this.float.position.y = 0.55 + Math.sin(t * 2.4) * 0.1;
    const puff = state === 'puff' ? 1.1 + Math.sin(t * 26) * 0.03 : 1;
    this.body.scale.set(puff * (1 + this.squash * 0.15), 1 - this.squash * 0.3, puff * (1 + this.squash * 0.15));
    this.body.rotation.set(state === 'chase' ? 0.1 : 0, 0, state === 'giggle' ? Math.sin(t * 18) * 0.1 : state === 'dazed' ? Math.sin(t * 4) * 0.14 : Math.sin(t * 1.4) * 0.04);
    for (const w of this.wings) w.rotation.z = w.userData.side * (0.2 + Math.sin(t * 70 + w.position.z * 9) * (state === 'dazed' ? 0.15 : 0.5));
    // Her sting curls under her as she gets ready to come at you.
    this.curl = ease(this.curl, state === 'rear' || state === 'charge' ? 1 : 0, 8, dt);
    this.tailEnd.rotation.x = this.curl * 0.95 + Math.sin(t * 2.2) * 0.06;
    for (const [i, l] of this.legs.entries()) l.rotation.x = Math.sin(t * 3 + i) * 0.15;
    this.head.rotation.z = state === 'howl' ? Math.sin(t * 14) * 0.12 : 0;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' || state === 'howl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Sir Blendalot

export class ChameleonModel extends Beast {
  constructor() {
    super({ height: 1.8, center: 0.9, pick: 1.2, radius: 1.15, glow: '#fff27a' });
    // (His own skin, to change the colour of.)
    const sheen = { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.22, envMapIntensity: 0.8 };
    this.skin = toyMaterial({ color: '#4fbf4a', ...sheen });
    this.pale = toyMaterial({ color: '#c4ec9a', ...sheen });
    const { skin, pale } = this;
    this.whole = group(this.body, 0, 0, 0);
    const g = this.whole;
    // A fat arched body with a ridge of little spikes down his back.
    g.add(mesh(sphere(1, 22, 16), skin, 0, 0.8, -0.1, 0.62, 0.6, 1.0));
    g.add(mesh(sphere(1, 18, 12), pale, 0, 0.62, -0.05, 0.5, 0.44, 0.86));
    for (let i = 0; i < 7; i++) g.add(mesh(cone(0.07, 0.22, 6), pale, 0, 1.4 - Math.abs(i - 3) * 0.045, 0.55 - i * 0.24));
    // His tail, curled up in a spiral behind him.
    this.tail = group(g, 0, 0.72, -1.02);
    this.tail.add(mesh(torus(0.4, 0.14, Math.PI * 1.5), skin, 0, 0, -0.25).rotateY(Math.PI / 2));
    this.tail.add(mesh(torus(0.19, 0.1, Math.PI * 1.6), skin, 0, -0.05, -0.2).rotateY(Math.PI / 2).rotateZ(Math.PI * 0.9));
    // His head: a snout, a crest like a helmet with a red plume, a wide
    // mouth, and an eye on a turret at each side, each looking its own way.
    const head = group(g, 0, 0.98, 0.85);
    this.head = head;
    head.add(mesh(sphere(1, 20, 14), skin, 0, 0, 0.12, 0.46, 0.4, 0.56));
    const crest = mesh(cone(0.36, 0.66, 14), skin, 0, 0.42, -0.1);
    crest.rotation.x = -0.4;
    head.add(crest);
    for (let i = 0; i < 4; i++) head.add(mesh(sphere(1, 10, 8), toon('#e0342a'), 0, 0.72 + i * 0.06, -0.3 - i * 0.1, 0.12 - i * 0.015));
    this.mouth = mesh(sphere(1, 14, 8), toon(MOUTH), 0, -0.14, 0.6, 0.3, 0.025, 0.06);
    head.add(this.mouth);
    this.turrets = [];
    for (const side of [-1, 1]) {
      const turret = group(head, side * 0.36, 0.12, 0.3);
      turret.add(mesh(sphere(1, 14, 10), skin, 0, 0, 0, 0.21));
      crossEye(this, turret, side, side * 0.1, 0, 0.14, { w: 0.085, brow: null });
      turret.userData.side = side;
      this.turrets.push(turret);
    }
    // Four bent legs, toes gripping.
    this.legs = [];
    for (const [i, [x, z]] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.6], [0.6, -0.6]].entries()) {
      const side = Math.sign(x);
      const l = group(g, x, 0.62, z);
      limb(l, [0, 0, 0], [side * 0.36, 0.1, 0], 0.11, 0.09, skin, 8);
      limb(l, [side * 0.36, 0.1, 0], [side * 0.46, -0.5, 0.05], 0.09, 0.07, skin, 8);
      for (const o of [-1, 1]) l.add(mesh(sphere(1, 8, 6), pale, side * 0.46, -0.57, 0.05 + o * 0.09, 0.09, 0.05, 0.07));
      l.userData.i = i;
      this.legs.push(l);
    }
    this.hue = 0.33;
    this.fade = 1;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    this.body.scale.set(1 + this.squash * 0.2, 1 - this.squash * 0.4, 1 + this.squash * 0.2);
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 18) * 0.08 : state === 'dazed' ? Math.sin(t * 4) * 0.1 : 0);
    // His colour drifts all the while, and runs through them all as he
    // fades away to turn up somewhere else.
    this.hue = (this.hue + dt * (state === 'blink' ? 1.6 : state === 'dazed' ? 0.9 : 0.05)) % 1;
    this.skin.color.setHSL(this.hue, 0.62, 0.45, THREE.SRGBColorSpace);
    this.pale.color.setHSL(this.hue, 0.62, 0.76, THREE.SRGBColorSpace);
    this.fade = ease(this.fade, state === 'blink' ? 0.05 : 1, 7, dt);
    this.whole.scale.setScalar(0.35 + 0.65 * this.fade);
    const go = moving(state) && air < 0.2;
    const speed = pace(state, 7, 12);
    for (const l of this.legs) l.rotation.x = go ? Math.sin(t * speed + (l.userData.i % 3 ? Math.PI : 0)) * 0.4 : 0;
    this.tail.rotation.x = Math.sin(t * 1.8) * 0.12 + (state === 'charge' ? -0.5 : 0);
    for (const u of this.turrets) u.rotation.set(Math.sin(t * 1.1 + u.userData.side * 2) * 0.35, Math.sin(t * 1.7 + u.userData.side) * 0.6, 0);
    this.head.rotation.x = state === 'rear' ? -0.3 : state === 'hurl' ? -0.2 : Math.sin(t * 1.3) * 0.05;
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.09 : 0.025;
    this.mood(state, night);
  }

  dispose() {
    super.dispose();
    this.skin.dispose();
    this.pale.dispose();
  }
}

// ---------------------------------------------------------------- Admiral Inkwell

export class OctopusModel extends Beast {
  constructor() {
    super({ height: 2.2, center: 1.1, pick: 1.25, radius: 1.25, glow: '#b8f2ff' });
    const blue = toon('#3f7fe0');
    const deep = toon('#2a56a8');
    const pale = toon('#bcd8ff');
    const b = this.body;
    // A great round head, darker spots over the back of it.
    this.mantle = group(b, 0, 0.72, 0);
    const m = this.mantle;
    m.add(mesh(sphere(1, 24, 18), blue, 0, 0.58, -0.05, 0.85, 0.92, 0.85));
    for (const [x, y, z, r] of [[0.4, 1.2, -0.45, 0.16], [-0.5, 1.0, -0.5, 0.2], [0.1, 0.9, -0.85, 0.18], [-0.15, 1.35, -0.3, 0.13], [0.62, 0.75, -0.5, 0.14]]) m.add(mesh(sphere(1, 10, 8), deep, x, y, z, r, r, r * 0.5));
    crossEye(this, m, -1, -0.3, 0.52, 0.74, { w: 0.16, slope: 0.4 });
    crossEye(this, m, 1, 0.3, 0.52, 0.74, { w: 0.16, slope: 0.4 });
    this.mouth = mesh(sphere(1, 12, 8), toon(MOUTH), 0, 0.2, 0.82, 0.13, 0.03, 0.05);
    m.add(this.mouth);
    // His admiral's hat, worn across: black, trimmed with gold, a cockade.
    const hat = group(m, 0, 1.42, -0.02);
    hat.rotation.x = -0.1;
    hat.add(mesh(sphere(1, 18, 12), toon('#1f2433'), 0, 0.12, 0, 0.92, 0.3, 0.34));
    hat.add(mesh(sphere(1, 18, 10), toon(GOLD, { emissive: 0.25 }), 0, 0.02, 0, 0.94, 0.06, 0.36));
    hat.add(mesh(sphere(1, 10, 8), toon('#e0342a'), 0, 0.18, 0.33, 0.1, 0.1, 0.04));
    hat.add(mesh(sphere(1, 8, 6), toon(GOLD, { emissive: 0.3 }), 0, 0.18, 0.36, 0.045));
    // Eight arms all round, each thinning to its tip, pale underneath.
    this.arms = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const arm = group(b, Math.sin(a) * 0.5, 0.52, Math.cos(a) * 0.5);
      arm.rotation.y = a;
      const lift = group(arm, 0, 0, 0);
      for (const [y, z, r] of [[-0.02, 0.22, 0.27], [-0.18, 0.56, 0.23], [-0.33, 0.9, 0.18], [-0.42, 1.2, 0.13], [-0.44, 1.42, 0.09]]) {
        lift.add(mesh(sphere(1, 12, 10), blue, 0, y, z, r));
        lift.add(mesh(sphere(1, 8, 6), pale, 0, y - r * 0.75, z, r * 0.45, r * 0.3, r * 0.45));
      }
      lift.userData.i = i;
      this.arms.push(lift);
    }
    this.raise = 0;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const puff = state === 'puff' ? 1.12 + Math.sin(t * 26) * 0.03 : 1;
    this.body.scale.set(puff * (1 + this.squash * 0.25), 1 - this.squash * 0.4, puff * (1 + this.squash * 0.25));
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 16) * 0.08 : state === 'dazed' ? Math.sin(t * 3) * 0.1 : 0);
    this.mantle.position.y = 0.72 + Math.sin(t * 2) * 0.05;
    this.mantle.rotation.x = state === 'charge' ? -0.5 : state === 'rear' ? 0.3 : 0;
    // His arms ripple as he goes, and go up all together before they slam down.
    const up = state === 'stomp' || state === 'hurl' || air > 0.25 ? 1 : 0;
    this.raise = ease(this.raise, up, up ? 8 : 16, dt);
    const go = moving(state);
    for (const arm of this.arms) {
      const i = arm.userData.i;
      arm.rotation.x = -this.raise * 1.15 + Math.sin(t * (go ? 9 : 2.4) + i * 0.8) * (go ? 0.22 : 0.1) + (state === 'charge' ? 0.35 : 0);
    }
    this.mouth.scale.set(state === 'hurl' || state === 'puff' ? 0.09 : 0.13, state === 'giggle' || state === 'hurl' || state === 'puff' ? 0.09 : 0.03, 0.05);
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Mochi the Moon Rabbit

export class RabbitModel extends Beast {
  constructor() {
    super({ height: 2.6, center: 1.3, pick: 1.2, radius: 1.05, glow: '#ffd7f0', white: '#ffffff' });
    const white = toon('#f7f5ef');
    const pink = toon('#ffb3c9');
    const wood = toon('#a8743c');
    const b = this.body;
    // A round white body, a bobtail, big feet, and a scarf the colour of the night.
    b.add(mesh(sphere(1, 22, 16), white, 0, 0.82, -0.02, 0.74, 0.8, 0.68));
    b.add(mesh(sphere(1, 14, 10), white, 0, 0.55, -0.68, 0.25));
    for (const side of [-1, 1]) b.add(mesh(sphere(1, 14, 10), white, side * 0.42, 0.13, 0.4, 0.27, 0.13, 0.5));
    b.add(mesh(torus(0.48, 0.11), toon('#4b3fb5'), 0, 1.44, 0.03).rotateX(Math.PI / 2));
    b.add(mesh(roundedBox(0.2, 0.5, 0.08, 0.04), toon('#4b3fb5'), 0.22, 1.2, 0.5).rotateZ(-0.15));
    // His head: pink nose, front teeth, red eyes, a crescent moon on his brow,
    // and two long ears.
    const head = group(b, 0, 1.8, 0.08);
    this.head = head;
    head.add(mesh(sphere(1, 22, 16), white, 0, 0, 0, 0.56, 0.5, 0.52));
    for (const side of [-1, 1]) head.add(mesh(sphere(1, 12, 8), white, side * 0.2, -0.16, 0.38, 0.2, 0.15, 0.16));
    head.add(mesh(sphere(1, 10, 8), pink, 0, -0.06, 0.52, 0.07, 0.05, 0.04));
    head.add(mesh(roundedBox(0.12, 0.13, 0.04, 0.015), toon('#ffffff'), 0, -0.3, 0.46));
    this.mouth = mesh(sphere(1, 12, 8), toon(MOUTH), 0, -0.2, 0.49, 0.1, 0.025, 0.04);
    head.add(this.mouth);
    crossEye(this, head, -1, -0.22, 0.1, 0.42, { w: 0.11, pupil: '#b3243b', brow: '#c9c4b8' });
    crossEye(this, head, 1, 0.22, 0.1, 0.42, { w: 0.11, pupil: '#b3243b', brow: '#c9c4b8' });
    head.add(mesh(torus(0.1, 0.035, Math.PI), toon('#ffe14d', { emissive: 0.8 }), 0, 0.32, 0.44).rotateZ(-Math.PI / 2 - 0.4));
    this.ears = [];
    for (const side of [-1, 1]) {
      const ear = group(head, side * 0.2, 0.42, -0.05);
      ear.add(mesh(capsule(0.115, 0.5, 6, 12), white, 0, 0.36, 0));
      ear.add(mesh(capsule(0.06, 0.4, 5, 10), pink, 0, 0.36, 0.075));
      ear.userData.side = side;
      this.ears.push(ear);
    }
    // His arms, and the mallet he pounds rice cakes with over his shoulder.
    const left = group(b, -0.56, 1.3, 0.2);
    left.add(mesh(capsule(0.11, 0.3, 5, 10), white, 0, -0.14, 0.12).rotateX(-0.8));
    this.swing = group(b, 0.56, 1.32, 0.12);
    this.swing.add(mesh(capsule(0.11, 0.3, 5, 10), white, 0, -0.1, 0.14).rotateX(-1.2));
    const mallet = group(this.swing, 0.05, -0.1, 0.34);
    mallet.add(mesh(cylinder(0.05, 0.05, 1.5, 10), wood, 0, 0.55, 0));
    const head2 = group(mallet, 0, 1.3, 0);
    head2.add(mesh(cylinder(0.3, 0.3, 0.86, 18), wood, 0, 0, 0).rotateX(Math.PI / 2));
    for (const z of [-0.36, 0.36]) head2.add(mesh(cylinder(0.31, 0.31, 0.1, 18), toon('#e9d3a6'), 0, 0, z).rotateX(Math.PI / 2));
    this.lift = 0;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const stretch = air > 0.05 ? Math.min(0.22, Math.abs(this.vy) * 0.03) : 0;
    this.body.scale.set(1 + this.squash * 0.2, 1 + stretch - this.squash * 0.4, 1 + this.squash * 0.2);
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 18) * 0.1 : state === 'dazed' ? Math.sin(t * 4) * 0.1 : 0);
    // The mallet: over his shoulder, up high before it comes down, and out
    // in front of him once it has.
    const want = state === 'stomp' ? (air > 0.05 ? -2.7 : -2.3) : state === 'dazed' ? 0.9 : state === 'hurl' ? -1.9 : state === 'charge' ? 0.5 : -0.75 + Math.sin(t * 1.6) * 0.05;
    this.lift = ease(this.lift, want, state === 'dazed' ? 22 : 9, dt);
    this.swing.rotation.x = this.lift;
    // His ears: up when he is cross, flopping as he hops, drooping dazed.
    const droop = state === 'dazed' ? 1.3 : air > 0.1 ? 0.5 : state === 'chase' || state === 'stomp' ? -0.05 : 0.15;
    for (const e of this.ears) {
      e.rotation.z = -e.userData.side * (droop * 0.6 + Math.sin(t * 2 + e.userData.side) * 0.04);
      e.rotation.x = -droop * 0.4;
    }
    this.head.rotation.x = state === 'rear' ? -0.2 : Math.sin(t * 1.5) * 0.05;
    this.mouth.scale.y = state === 'giggle' || state === 'howl' ? 0.07 : 0.025;
    this.mood(state, night);
  }
}

// ---------------------------------------------------------------- Queen Grizzle

export class GrizzleModel extends Beast {
  constructor() {
    super({ height: 2.1, center: 1.05, pick: 1.1, radius: 1.0, glow: '#e3d4ff' });
    const grey = toon('#9ba1ab');
    const dark = toon('#5d626c');
    const pale = toon('#d3d7dd');
    const violet = toon('#9b4fd6', { emissive: 0.9 });
    this.whole = group(this.body, 0, 0, 0);
    const g = this.whole;
    // A grey blob of a body, like her little brother's, a pale ruff round it.
    g.add(mesh(sphere(1, 26, 18), grey, 0, 0.74, 0, 0.92, 0.78, 0.88));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(mesh(sphere(1, 10, 8), pale, Math.sin(a) * 0.62, 1.2, Math.cos(a) * 0.6, 0.17, 0.1, 0.17));
    }
    // Her hair piled up high, a white streak through it, and on top her crown,
    // with the one violet jewel left in the world.
    const hair = group(g, 0, 1.36, -0.06);
    for (const [y, r] of [[0, 0.5], [0.36, 0.4], [0.66, 0.29]]) hair.add(mesh(sphere(1, 18, 12), dark, 0, y, 0, r, r * 0.72, r * 0.95));
    hair.add(mesh(torus(0.3, 0.05, Math.PI * 1.2), pale, 0.05, 0.3, 0.1).rotateX(1.1).rotateZ(0.5));
    coronet(hair, 0.9, 0.2, { color: '#c9ced6', jewel: '#9b4fd6', glow: 0.9 });
    this.jewel = mesh(sphere(1, 10, 8), violet, 0, 1.22, 0, 0.09);
    hair.add(this.jewel);
    // Her face: cross eyes under long lashes, and lips pursed tight.
    crossEye(this, g, -1, -0.3, 0.98, 0.74, { w: 0.14, slope: 0.5, brow: '#3f434b' });
    crossEye(this, g, 1, 0.3, 0.98, 0.74, { w: 0.14, slope: 0.5, brow: '#3f434b' });
    for (const side of [-1, 1]) for (const k of [0, 1, 2]) g.add(mesh(cone(0.02, 0.12, 5), toon('#3f434b'), side * (0.36 + k * 0.07), 1.14 - k * 0.02, 0.72 - k * 0.04).rotateZ(-side * (0.5 + k * 0.3)));
    this.mouth = mesh(sphere(1, 12, 8), toon('#5b3f7a'), 0, 0.66, 0.86, 0.12, 0.035, 0.05);
    g.add(this.mouth);
    g.add(mesh(sphere(1, 6, 4), toon(DARK), 0.3, 0.72, 0.8, 0.025));
    // Her great grey umbrella: shut, she points it like a sceptre; open, it
    // carries her off.
    this.brolly = group(g, 0.8, 0.95, 0.25);
    const u = this.brolly;
    u.add(mesh(sphere(1, 10, 8), grey, 0, 0, 0, 0.17));
    u.add(mesh(cylinder(0.035, 0.035, 1.75, 8), toon(DARK), 0, 0.72, 0));
    u.add(mesh(torus(0.09, 0.03, Math.PI), toon(DARK), 0.09, -0.16, 0).rotateZ(Math.PI));
    this.canopy = group(u, 0, 1.5, 0);
    this.canopy.add(mesh(lathe([[0, 0.56], [0.4, 0.52], [0.78, 0.38], [1.08, 0.16], [1.25, -0.06]], 24), toon('#7d838d', { side: THREE.DoubleSide })));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.canopy.add(mesh(sphere(1, 8, 6), dark, Math.sin(a) * 1.25, -0.06, Math.cos(a) * 1.25, 0.08));
    }
    u.add(mesh(cone(0.04, 0.22, 8), toon(DARK), 0, 2.16, 0));
    this.open = 0;
    this.fade = 1;
  }

  update(dt, state, air = 0, night = false) {
    // (A boss's bubble keeps its own bounce: boss-models.js addBossParts.)
    Beast.prototype.bounce.call(this, dt, air);
    const t = this.time;
    const puff = state === 'puff' ? 1.1 + Math.sin(t * 26) * 0.03 : 1;
    const wobble = 1 + Math.sin(t * 2.4) * 0.02;
    this.body.scale.set(puff * (1 + this.squash * 0.3) / wobble, wobble * (1 - this.squash * 0.45), puff * (1 + this.squash * 0.3) / wobble);
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 18) * 0.1 : state === 'dazed' ? Math.sin(t * 3.5) * 0.12 : 0);
    // Her umbrella opens to carry her off (and for her drizzle, and as she
    // comes down), and shuts to point at you.
    const up = state === 'blink' || state === 'puff' || state === 'leap' || air > 0.3;
    this.open = ease(this.open, up ? 1 : 0, 9, dt);
    const o = this.open;
    this.canopy.scale.set(0.13 + 0.87 * o, 1.6 - 0.6 * o, 0.13 + 0.87 * o);
    this.brolly.rotation.set((1 - o) * (state === 'chase' || state === 'hurl' || state === 'rear' ? 1.0 : 0.25), 0, o * 0.42 + (1 - o) * -0.2);
    // Fading away under it as she floats off somewhere else.
    this.fade = ease(this.fade, state === 'blink' ? 0.05 : 1, 7, dt);
    this.whole.scale.setScalar(0.4 + 0.6 * this.fade);
    this.whole.position.y = (1 - this.fade) * 1.2;
    this.jewel.scale.setScalar(0.09 * (1 + Math.sin(t * 4) * 0.15));
    this.mouth.scale.set(state === 'giggle' || state === 'howl' ? 0.2 : 0.12, state === 'giggle' || state === 'hurl' || state === 'howl' ? 0.08 : 0.035, 0.05);
    this.mood(state, night);
  }
}
