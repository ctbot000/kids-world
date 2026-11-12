// The bosses of Adventure Isle (shared/bosses.js), each one its own kind's
// monster grown big and dressed up:
//
// - Captain Clawbeard: a Snappy Crab (isle-monsters.js) the size of a car,
//   bright red, in a black captain's hat with a gold band, with a patch
//   over one eye and a great bushy beard.
// - Old Puffcap: a Puffshroom grown as tall as a door, his cap deep purple
//   with glowing yellow spots, with a long white beard and white brows.
// - Frostfang: a Little Yeti grown huge, in a crown of icicles, with two
//   great fangs.
// - Gumbo the Gummy Giant: a red Gummy Bear grown huge, in a crown of
//   gumdrops and a striped bow tie.
// - Bogmaw the Bog Toad: a great warty toad (ToadModel, below), with
//   bulging eyes, a wide grumpy mouth and a lily pad on his head, his throat
//   swelling up before he burps his swamp gas.
// - Moltok the Lava Golem: a Stone Golem (monster-model.js) of black rock
//   grown huge, its top glowing lava, horns of black glass and lava glowing
//   through the cracks.
//
// - Sir Scarabold, Old Glimmershell, Baron Boo, Big Sprocket and Old Nimbus:
//   creatures of their own, built at their full size (captain-models.js),
//   which take their moves' states as they are (raw): the scarab's wing cases
//   opening as he flies up, the tortoise spinning along in his shell, arms up
//   to throw.
//
// - Lady Dotty, Duke Bushytail, Baroness Bumble, Sir Blendalot, Admiral
//   Inkwell, Mochi the Moon Rabbit and Queen Grizzle, of the story's second
//   episode: creatures of their own too (rainbow-models.js), raw as well.
//
// King Grumble is adventure-models.js KingModel, with the same parts as
// these (addBossParts): the bubble round it while any camp is not free, a
// ring on the ground as far as its stomp reaches while it crouches for
// one, what it is about to throw held up over its head, and its poses for
// each move (bossPose).
import * as THREE from '../../vendor/three.module.js';
import { BOSSES, stompMove } from '../shared/bosses.js';
import { heldUp, thrownMesh } from './boss-fx.js';
import { MonsterModel } from './monster-model.js';
import { ShroomModel, SnapperModel } from './isle-monsters.js';
import { BaronModel, CloudModel, ScarabModel, SprocketModel, TortoiseModel } from './captain-models.js';
import { BeeModel, ChameleonModel, GrizzleModel, LadybirdModel, OctopusModel, RabbitModel, SquirrelModel } from './rainbow-models.js';
import { blobShadow, cone, cylinder, mesh, onSurface, sphere, toon, torus } from './toon.js';

const DARK = '#2b2530';

// A boss's model grown from its kind's own: its body into a holder grown to
// side across and up tall (the model's own scale left out), squashing and
// stretching in there as it always does.
function grow(m, side, up) {
  const holder = new THREE.Group();
  m.group.remove(m.body);
  holder.add(m.body);
  holder.scale.set(side, up, side);
  m.group.scale.setScalar(1);
  m.group.add(holder);
  m.holder = holder;
}

// The parts every boss has (bubble, radius round its middle at y; reach, its
// stomp's, for the ring; hurl, what it throws, held up over its head at top
// as it winds up), put on model m.
export function addBossParts(m, { bubble, y, reach = 0, hurl = null, top = 2 }) {
  m.bubble = mesh(sphere(1, 28, 20), new THREE.MeshBasicMaterial({ color: '#cdeeff', transparent: true, opacity: 0.22, depthWrite: false }), 0, y, 0, bubble);
  m.bubbleRim = mesh(sphere(1, 28, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.BackSide }), 0, y, 0, bubble * 1.03);
  m.bubbleSize = bubble;
  m.group.add(m.bubble, m.bubbleRim);
  if (reach) {
    m.ring = new THREE.Mesh(new THREE.RingGeometry(reach - 0.35, reach, 56), new THREE.MeshBasicMaterial({ color: '#ff6a3d', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    m.ring.rotation.x = -Math.PI / 2;
    m.ring.position.y = 0.06;
    m.ring.renderOrder = 2;
    m.group.add(m.ring);
  }
  // (Old Nimbus calls his lightning down: nothing to hold up.)
  if (heldUp(hurl)) {
    m.held = thrownMesh(hurl);
    m.held.scale.setScalar(1.4);
    m.held.position.y = top + 0.5;
    m.held.visible = false;
    m.group.add(m.held);
  }
  m.bounce = 0;
  m.throwAt = -Infinity;
  // Its bubble shaking off a bop.
  m.bubbleBounce = () => {
    m.bounce = 0.6;
  };
  // What it was holding up thrown: gone from over its head at once.
  m.thrown = () => {
    m.throwAt = m.time;
  };
}

// What addBossParts made, let go of with the model.
export function disposeBossParts(m) {
  for (const o of [m.bubble, m.bubbleRim, m.ring]) o?.material.dispose();
  m.ring?.geometry.dispose();
}

// Each frame, after the model's own update: the bubble wobbling (shown
// while shielded), the stomp ring while it crouches for one, and how it
// stands for each of its moves (shared/bosses.js: crouched to stomp or
// leap, rearing back to charge and leaning into it, up tall holding what it
// is about to throw, swelling up to puff, sagging dazed).
export function bossPose(m, dt, state, air, shielded) {
  const t = m.time;
  m.bounce = Math.max(0, m.bounce - dt);
  const wobble = 1 + Math.sin(t * 2.2) * 0.025 + Math.sin(m.bounce * 18) * m.bounce * 0.12;
  m.bubble.visible = shielded;
  m.bubbleRim.visible = shielded;
  m.bubble.scale.setScalar(m.bubbleSize * wobble);
  m.bubbleRim.scale.setScalar(m.bubbleSize * 1.03 * wobble);
  if (m.ring) {
    m.ring.visible = state === 'stomp' && air < 0.1;
    m.ring.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * 9));
  }
  if (m.held) {
    m.held.visible = state === 'hurl' && t - m.throwAt > 0.6;
    m.held.position.x = Math.sin(t * 14) * 0.04;
    m.held.rotation.y = t * 2;
  }
  const b = m.body;
  if (state === 'stomp' || (state === 'leap' && air < 0.1)) {
    // Crouched to stomp or to leap: down low, shaking.
    b.scale.y *= 0.72;
    b.rotation.z = Math.sin(t * 30) * 0.05;
  } else if (state === 'leap') {
    // Up in the air on a leap: stretched out.
    b.scale.y *= 1.12;
  } else if (state === 'rear') {
    // Rearing back to charge, pawing at the ground.
    b.scale.y *= 0.86;
    b.rotation.x = -0.32 + Math.sin(t * 24) * 0.04;
  } else if (state === 'charge') {
    // Charging: leaning into it.
    b.rotation.x = 0.28;
    b.rotation.z = Math.sin(t * 18) * 0.06;
  } else if (state === 'hurl') {
    // Up tall, holding it up, about to throw.
    b.scale.y *= 1.08;
    b.rotation.x = -0.12;
  } else if (state === 'puff') {
    // Swelling up to puff.
    const k = 1.12 + Math.sin(t * 26) * 0.03;
    b.scale.x *= k;
    b.scale.z *= k;
  } else if (state === 'dazed') {
    // Dazed from a stomp, a leap or a bonk: sagging, swaying slowly, mouth
    // hanging open.
    b.scale.y *= 0.88;
    b.rotation.z = Math.sin(t * 3) * 0.12;
    if (m.mouth) m.mouth.scale.y = 0.07;
  }
}

// What a boss's own model makes of its states: its moves' are its own (see
// bossPose), so the model underneath is just cross (or hopping, on a leap).
export const underState = (state) => ({ rear: 'chase', charge: 'chase', hurl: 'chase', leap: 'hop' })[state] ?? state;

// Bogmaw the Bog Toad's model: a squat green toad, about a unit long,
// facing +z (as every monster model does), with eyes that glow at night.
export class ToadModel {
  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const b = this.body;
    const skin = toon('#5f8f3a');
    const dark = toon('#3f6a26');
    const belly = toon('#cbd98a');
    b.add(mesh(sphere(), skin, 0, 0.3, 0, 0.5, 0.3, 0.46));
    b.add(mesh(sphere(), belly, 0, 0.22, 0.16, 0.38, 0.2, 0.32));
    // Warts all over its back.
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39;
      const el = 0.35 + (i % 3) * 0.25;
      if (Math.cos(a) > 0.5 && el < 0.7) continue;
      b.add(mesh(sphere(1, 8, 6), dark, 0.5 * Math.cos(el) * Math.sin(a), 0.3 + 0.3 * Math.sin(el), 0.46 * Math.cos(el) * Math.cos(a), 0.05));
    }
    // Legs: big folded back ones and little front ones.
    for (const side of [-1, 1]) {
      b.add(mesh(sphere(1, 12, 8), skin, side * 0.42, 0.16, -0.16, 0.16, 0.14, 0.24));
      b.add(mesh(sphere(1, 10, 8), dark, side * 0.48, 0.03, 0.02, 0.12, 0.03, 0.16));
      b.add(mesh(sphere(1, 10, 8), skin, side * 0.26, 0.1, 0.34, 0.08, 0.1, 0.08));
      b.add(mesh(sphere(1, 10, 8), dark, side * 0.28, 0.02, 0.4, 0.09, 0.025, 0.08));
    }
    // A throat that swells before it burps.
    this.throat = mesh(sphere(1, 14, 10), toon('#e4eab0'), 0, 0.16, 0.36, 0.2, 0.12, 0.12);
    b.add(this.throat);
    // Bulging eyes on top, cross brows over them.
    this.eyeWhite = toon('#fff7d6');
    this.eyeGlow = toon('#fff27a', { emissive: 0.9 });
    this.eyes = [];
    this.brows = [];
    for (const side of [-1, 1]) {
      b.add(mesh(sphere(1, 12, 10), skin, side * 0.2, 0.55, 0.2, 0.14));
      const eye = mesh(sphere(1, 12, 8), this.eyeWhite, side * 0.2, 0.58, 0.28, 0.1, 0.1, 0.07);
      b.add(eye);
      this.eyes.push(eye);
      b.add(mesh(sphere(1, 8, 6), toon(DARK), side * 0.2, 0.57, 0.34, 0.045, 0.06, 0.02));
      const brow = mesh(sphere(1, 8, 6), toon(DARK), side * 0.19, 0.69, 0.27, 0.09, 0.022, 0.03);
      brow.rotation.z = side * 0.45;
      b.add(brow);
      this.brows.push({ mesh: brow, side });
    }
    // A wide grumpy mouth right across its front.
    this.mouth = mesh(sphere(1, 14, 8), toon('#3a1f3f'), 0, 0.3, 0.44, 0.3, 0.025, 0.04);
    b.add(this.mouth);
    // A lily pad on its head, with a pink flower.
    const pad = mesh(cylinder(0.2, 0.2, 0.02, 16, 1), toon('#7fbf4a'), 0, 0.62, -0.08);
    pad.rotation.x = -0.15;
    b.add(pad);
    b.add(mesh(cone(0.06, 0.08, 8), toon('#ff8fc4'), 0.05, 0.67, -0.1));
    this.height = 0.75;
    this.center = 0.35;
    this.pick = 0.55;
    this.shadowScale = 1.1;
    this.shadow = blobShadow(0.55, 0.2);
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.squash = 0;
    this.seen = 70;
    this.swell = 0;
  }

  update(dt, state, air = 0, night = false) {
    this.time += dt;
    const t = this.time;
    const y = this.group.position.y;
    if (this.lastY !== null && dt > 0) this.vy += ((y - this.lastY) / dt - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    if (air < 0.05 && this.vy < -1.5) this.squash = 0.35;
    this.squash = Math.max(0, this.squash - dt * 2.2);
    const stretch = Math.min(0.3, Math.abs(this.vy) * 0.05) * (air > 0.05 ? 1 : 0);
    const sy = 1 + stretch - this.squash + Math.sin(t * 2.5) * 0.02;
    this.body.scale.set(1 + this.squash * 0.3, sy, 1 + this.squash * 0.3);
    this.body.rotation.set(0, 0, 0);
    if (state === 'giggle') this.body.rotation.z = Math.sin(t * 22) * 0.14;
    // The throat swelling up as it winds up to burp, and going down again.
    this.swell += ((state === 'puff' ? 1 : 0) - this.swell) * Math.min(1, dt * (state === 'puff' ? 2 : 8));
    const k = 1 + this.swell * 1.4 + Math.sin(t * 5) * 0.06;
    this.throat.scale.set(0.2 * k, 0.12 * k, 0.12 * (1 + this.swell));
    this.mouth.scale.y = state === 'giggle' || state === 'hurl' ? 0.07 : 0.025;
    for (const brow of this.brows) brow.mesh.rotation.z = brow.side * (state === 'chase' ? 0.65 : 0.4);
    const mat = night ? this.eyeGlow : this.eyeWhite;
    for (const eye of this.eyes) if (eye.material !== mat) eye.material = mat;
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

// Each boss's model: what it is grown from, how much (side, up), and what it
// wears (dress, on its body in the model's own units, before it is grown).
const MAKE = {
  clawbeard: {
    make: (theme) => new SnapperModel(theme, 0, { shell: '#d2452f', under: '#f0b39a', bump: '#e86a4f' }),
    side: 2.5,
    up: 2.2,
    dress(m) {
      const s = m.shell;
      // A pirate captain's hat up behind his eyes, tipped back: a wide brim
      // turned up at three corners, a tall crown with a gold band, and a
      // white skull on the front.
      const black = toon('#1f1b24');
      const hat = new THREE.Group();
      hat.position.set(0, 0.6, -0.1);
      hat.rotation.x = -0.25;
      hat.add(mesh(cylinder(0.3, 0.3, 0.03, 24), black, 0, 0, 0));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const flap = mesh(sphere(1, 12, 8), black, Math.sin(a) * 0.2, 0.06, Math.cos(a) * 0.2, 0.16, 0.06, 0.05);
        flap.rotation.y = a;
        hat.add(flap);
      }
      hat.add(mesh(cylinder(0.15, 0.18, 0.2, 18), black, 0, 0.1, 0));
      hat.add(mesh(torus(0.172, 0.016), toon('#ffcc33', { emissive: 0.25 }), 0, 0.04, 0).rotateX(Math.PI / 2));
      hat.add(mesh(sphere(1, 10, 8), toon('#ffffff'), 0, 0.12, 0.17, 0.045, 0.045, 0.02));
      s.add(hat);
      // A patch over one eye, its strap round the stalk.
      s.add(mesh(cylinder(0.05, 0.05, 0.02, 12), toon(DARK), 0.1, 0.64, 0.27).rotateX(Math.PI / 2));
      s.add(mesh(torus(0.06, 0.008), toon(DARK), 0.1, 0.66, 0.22).rotateY(Math.PI / 2));
      // A great bushy beard under his mouth.
      for (const [x, y, z, r] of [[0, 0.22, 0.35, 0.085], [-0.1, 0.24, 0.33, 0.065], [0.1, 0.24, 0.33, 0.065], [-0.05, 0.15, 0.34, 0.065], [0.05, 0.15, 0.34, 0.065], [0, 0.08, 0.33, 0.055]]) {
        s.add(mesh(sphere(1, 10, 8), toon('#8a5a33'), x, y, z, r));
      }
    },
  },
  puffcap: {
    make: (theme) => new ShroomModel(theme, 0, { cap: '#7d43b8', spot: '#fff3a8', stalk: '#cdb48c' }),
    side: 2.3,
    up: 2.4,
    dress(m) {
      const b = m.body;
      // A long white beard and moustache, and white brows.
      const beard = mesh(cone(0.16, 0.34, 12), toon('#ffffff'), 0, 0.1, 0.29);
      beard.rotation.x = Math.PI;
      b.add(beard);
      for (const side of [-1, 1]) b.add(mesh(sphere(1, 10, 8), toon('#ffffff'), side * 0.07, 0.26, 0.3, 0.08, 0.035, 0.04));
      for (const brow of m.brows) brow.mesh.material = toon('#ffffff');
    },
  },
  frostfang: {
    make: (theme) => new MonsterModel(theme, 'yeti', 0),
    side: 2.6,
    up: 3.2,
    dress(m) {
      const b = m.body;
      // A crown of icicles round his top.
      const ice = toon('#9fe8ff', { emissive: 0.35, transparent: true, opacity: 0.85 });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        b.add(mesh(cone(0.04, k % 2 ? 0.12 : 0.18, 6), ice, Math.sin(a) * 0.17, 0.72 + (k % 2 ? 0.04 : 0.07), Math.cos(a) * 0.17 - 0.02));
      }
      // Two great fangs down from his mouth.
      for (const side of [-1, 1]) {
        const p = onSurface(0.42, 0.36, 0.42, side * 0.07, -0.14, 0.01);
        const fang = mesh(cone(0.03, 0.12, 8), toon('#ffffff'), p.x, p.y + 0.36 - 0.05, p.z);
        fang.rotation.x = Math.PI;
        b.add(fang);
      }
    },
  },
  gumbo: {
    make: (theme) => new MonsterModel(theme, 'gummy', 0),
    side: 2.6,
    up: 2.6,
    dress(m) {
      const b = m.body;
      // A crown of gumdrops between his ears.
      const colors = ['#ffd23f', '#5fd36a', '#5fc7e6', '#ff9a3d', '#c78cff'];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        b.add(mesh(cone(0.065, 0.1, 12), toon(colors[k], { transparent: true, opacity: 0.9 }), Math.sin(a) * 0.12, 0.77, Math.cos(a) * 0.12));
      }
      // A striped bow tie at his front.
      for (const side of [-1, 1]) {
        const half = mesh(cone(0.05, 0.1, 10), toon(side < 0 ? '#ffffff' : '#ff4f6f'), side * 0.05, 0.2, 0.4);
        half.rotation.z = side * Math.PI / 2;
        b.add(half);
      }
      b.add(mesh(sphere(1, 8, 6), toon('#ff4f6f'), 0, 0.2, 0.41, 0.025));
    },
  },
  bogmaw: {
    make: () => new ToadModel(),
    side: 2.3,
    up: 2.1,
    dress() {},
  },
  moltok: {
    make: (theme) => new MonsterModel(theme, 'golem', 0, { skin: '#3b3438', core: '#241e22', stones: ['#4a4247', '#2f292d', '#57494d'], top: '#ff6a1a', glow: true }),
    side: 2.7,
    up: 3.6,
    dress(m) {
      const b = m.body;
      // Horns of black glass.
      for (const side of [-1, 1]) {
        const horn = mesh(cone(0.05, 0.18, 8), toon('#1a1418'), side * 0.2, 0.74, 0.02);
        horn.rotation.z = -side * 0.45;
        b.add(horn);
      }
      // Lava glowing through cracks round its middle.
      const lava = toon('#ff7a1a', { emissive: 1 });
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + 2.2;
        const crack = mesh(cylinder(0.012, 0.012, 0.16, 5), lava, Math.sin(a) * 0.43, 0.3 + (i % 3) * 0.08, Math.cos(a) * 0.43);
        crack.rotation.set(0.4 * (i % 2 ? 1 : -1), a, 0.6);
        b.add(crack);
      }
    },
  },
  scarabold: { make: () => new ScarabModel(), side: 1, up: 1, raw: true, dress() {} },
  glimmershell: { make: () => new TortoiseModel(), side: 1, up: 1, raw: true, dress() {} },
  baronboo: { make: () => new BaronModel(), side: 1, up: 1, raw: true, dress() {} },
  sprocket: { make: () => new SprocketModel(), side: 1, up: 1, raw: true, dress() {} },
  nimbus: { make: () => new CloudModel(), side: 1, up: 1, raw: true, dress() {} },
  dotty: { make: () => new LadybirdModel(), side: 1, up: 1, raw: true, dress() {} },
  bushytail: { make: () => new SquirrelModel(), side: 1, up: 1, raw: true, dress() {} },
  bumble: { make: () => new BeeModel(), side: 1, up: 1, raw: true, dress() {} },
  blendalot: { make: () => new ChameleonModel(), side: 1, up: 1, raw: true, dress() {} },
  inkwell: { make: () => new OctopusModel(), side: 1, up: 1, raw: true, dress() {} },
  mochi: { make: () => new RabbitModel(), side: 1, up: 1, raw: true, dress() {} },
  grizzle: { make: () => new GrizzleModel(), side: 1, up: 1, raw: true, dress() {} },
};

// The model of a boss (shared/bosses.js) by its kind; theme, the island's.
export function makeBoss(kind, theme = 'sunny') {
  const look = MAKE[kind];
  const plan = BOSSES[kind];
  const m = look.make(theme);
  look.dress(m);
  grow(m, look.side, look.up);
  const height = plan.body.height;
  addBossParts(m, { bubble: Math.max(height, plan.body.radius * 2) * 0.78, y: height * 0.5, reach: stompMove(plan)?.reach ?? 0, hurl: plan.moves.find((v) => v.move === 'hurl')?.what ?? null, top: height });
  const update = m.update.bind(m);
  m.update = (dt, state, air = 0, night = false, shielded = false) => {
    update(dt, look.raw ? state : underState(state), air, night);
    bossPose(m, dt, state, air, shielded);
  };
  const dispose = m.dispose.bind(m);
  m.dispose = () => {
    dispose();
    disposeBossParts(m);
  };
  m.height = height;
  m.center = height * 0.5;
  m.pick = Math.max(plan.body.radius, height * 0.5);
  m.seen = 140;
  m.shadowScale = plan.body.radius * 2.4;
  return m;
}
