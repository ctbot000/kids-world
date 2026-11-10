// What shows on the ground before a boss's move comes (shared/bosses.js),
// so there is time to get out of the way: a red ring where something it
// threw (or it, leaping) will come down, filling in as the moment comes;
// a strip the way it is about to charge; and the things it throws, flying
// there in an arc and bursting as they land.
import * as THREE from '../../vendor/three.module.js';
import { cone, cylinder, mesh, sphere, toon, torus } from './toon.js';

const WARN = '#ff4a3d';
// A lava rock's shape.
const ROCK = new THREE.DodecahedronGeometry(1, 0);
// A crystal's shape.
const OCTA = new THREE.OctahedronGeometry(1, 0);
// What does not fly there from whoever threw it: a bolt or a star comes down out
// of the sky, a root up out of the ground.
const FROM_SKY = { star: true };
const FROM_GROUND = { root: true };
// A bolt is only the ring until it strikes (renderer.js hurl draws it).
const UNSEEN = { bolt: true };

// A ring flat on the ground at (x, y, z), as wide as r, pulsing, with a
// disc inside it growing out to its edge as the moment it shows comes.
export class WarnRing {
  constructor(scene, x, y, z, r, ms, color = WARN) {
    this.life = ms / 1000;
    this.age = 0;
    this.group = new THREE.Group();
    this.group.position.set(x, y + 0.07, z);
    const mat = (opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(r - Math.min(0.3, r * 0.15), r, 48), mat(0.7));
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat(0.22));
    for (const m of [this.ring, this.fill]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      this.group.add(m);
    }
    scene.add(this.group);
  }

  // Returns false once it is over.
  update(dt) {
    this.age += dt;
    const k = Math.min(1, this.age / this.life);
    this.fill.scale.setScalar(Math.max(0.01, k));
    this.ring.material.opacity = 0.45 + 0.35 * Math.abs(Math.sin(this.age * 10));
    if (k < 1) return true;
    this.dispose();
    return false;
  }

  dispose() {
    this.group.removeFromParent();
    for (const m of [this.ring, this.fill]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

// A strip flat on the ground from (x, y, z) the way yaw faces, d long and w
// wide, with an arrow along it, showing for ms where a boss will charge.
export class WarnStrip {
  constructor(scene, x, y, z, yaw, d, w, ms) {
    this.life = ms / 1000;
    this.age = 0;
    this.group = new THREE.Group();
    this.group.position.set(x, y + 0.07, z);
    this.group.rotation.y = yaw;
    const mat = (opacity) => new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    this.strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0.25));
    this.strip.rotation.x = -Math.PI / 2;
    this.strip.position.z = d / 2;
    // The arrows along it, pointing the way it will go.
    const shape = new THREE.Shape();
    shape.moveTo(-w * 0.35, 0);
    shape.lineTo(0, w * 0.4);
    shape.lineTo(w * 0.35, 0);
    shape.lineTo(w * 0.18, 0);
    shape.lineTo(0, w * 0.2);
    shape.lineTo(-w * 0.18, 0);
    this.arrowGeo = new THREE.ShapeGeometry(shape);
    this.arrowMat = mat(0.6);
    this.arrows = [];
    for (let i = 0; i < Math.max(1, Math.floor(d / 3)); i++) {
      const a = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      a.rotation.x = -Math.PI / 2;
      a.position.z = 1.5 + i * 3;
      a.position.y = 0.01;
      this.group.add(a);
      this.arrows.push(a);
    }
    this.strip.renderOrder = 3;
    this.group.add(this.strip);
    scene.add(this.group);
    this.d = d;
  }

  update(dt) {
    this.age += dt;
    const k = Math.min(1, this.age / this.life);
    this.strip.material.opacity = 0.18 + 0.2 * k + 0.08 * Math.sin(this.age * 12);
    // The arrows run along it, quicker as it comes.
    for (const [i, a] of this.arrows.entries()) a.position.z = ((1.5 + i * 3 + this.age * (4 + 8 * k)) % this.d) + 0.2;
    if (k < 1) return true;
    this.dispose();
    return false;
  }

  dispose() {
    this.group.removeFromParent();
    this.strip.geometry.dispose();
    this.strip.material.dispose();
    this.arrowGeo.dispose();
    this.arrowMat.dispose();
  }
}

// What a boss throws (bosses.js hurl what), as a little group about a unit
// across at most: a coconut, a spore pod, a snowball, a gumdrop, a ball of
// mud, a lava rock or a grumble bomb; or a beast's (beasts.js): a boulder, a bone,
// a glob of venom, a falling star or a root; or, in the story's second episode,
// a strawberry, an acorn, a blob of honey, a bunch of bananas, a blob of ink, a
// rice cake or a smudge of grey.
export function thrownMesh(what) {
  const g = new THREE.Group();
  if (what === 'boulder') {
    g.add(mesh(ROCK, toon('#8d929c'), 0, 0, 0, 0.42));
    g.add(mesh(ROCK, toon('#a2a7b0'), 0.14, 0.14, 0.12, 0.26));
    g.add(mesh(ROCK, toon('#6d727c'), -0.16, -0.08, 0.1, 0.22));
    g.add(mesh(sphere(1, 8, 6), toon('#5f9e4a'), 0.05, 0.3, -0.06, 0.2, 0.08, 0.2));
    return g;
  }
  if (what === 'bone') {
    const bone = toon('#f3ead2');
    g.add(mesh(cylinder(0.05, 0.05, 0.5, 8), bone, 0, 0, 0));
    for (const y of [-0.27, 0.27]) for (const x of [-0.055, 0.055]) g.add(mesh(sphere(1, 8, 6), bone, x, y, 0, 0.075));
    return g;
  }
  if (what === 'venom') {
    const venom = toon('#a6e04a', { transparent: true, opacity: 0.85 });
    g.add(mesh(sphere(1, 14, 10), venom, 0, 0, 0, 0.26));
    g.add(mesh(sphere(1, 8, 6), venom, 0.2, 0.14, -0.1, 0.09));
    g.add(mesh(sphere(1, 8, 6), venom, -0.18, -0.12, 0.12, 0.07));
    g.add(mesh(sphere(1, 8, 6), toon('#ffffff', { emissive: 0.5, transparent: true, opacity: 0.6 }), -0.08, 0.1, 0.18, 0.05));
    return g;
  }
  if (what === 'star') {
    const gold = toon('#ffe14d', { emissive: 0.9 });
    g.add(mesh(sphere(1, 12, 8), gold, 0, 0, 0, 0.17));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = mesh(cone(0.12, 0.34, 6), gold, Math.sin(a) * 0.22, Math.cos(a) * 0.22, 0, 1, 1, 0.5);
      spike.rotation.z = -a;
      g.add(spike);
    }
    return g;
  }
  if (what === 'root') {
    const wood = toon('#6b4a2f');
    for (const [x, z, tilt, h] of [[0, 0, 0, 1.3], [0.34, 0.1, -0.35, 0.95], [-0.3, 0.16, 0.35, 0.85], [0.05, -0.34, 0.3, 0.9]]) {
      const root = mesh(cone(0.17, h, 8), wood, x, h / 2, z);
      root.rotation.set(tilt * (z < 0 ? -1 : 0.4), 0, tilt);
      g.add(root);
    }
    return g;
  }
  if (what === 'berry') {
    // A strawberry: red, pointed, seeds all over, green leaves on top.
    g.add(mesh(cone(0.3, 0.52, 14), toon('#e3342b'), 0, -0.04, 0).rotateX(Math.PI));
    g.add(mesh(sphere(1, 14, 10), toon('#e3342b'), 0, 0.2, 0, 0.3, 0.16, 0.3));
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4;
      const y = 0.16 - (i % 4) * 0.1;
      const r = 0.29 * (1 - (0.22 - y) / 0.6);
      g.add(mesh(sphere(1, 6, 4), toon('#ffe14d'), Math.sin(a) * r, y, Math.cos(a) * r, 0.03));
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(sphere(1, 8, 6), toon('#35a852'), Math.sin(a) * 0.14, 0.33, Math.cos(a) * 0.14, 0.12, 0.03, 0.07).rotateY(a));
    }
    return g;
  }
  if (what === 'acorn') {
    g.add(mesh(sphere(1, 14, 10), toon('#d9a35c'), 0, -0.06, 0, 0.24, 0.32, 0.24));
    g.add(mesh(sphere(1, 14, 10), toon('#7a4a26'), 0, 0.14, 0, 0.27, 0.16, 0.27));
    g.add(mesh(cylinder(0.03, 0.03, 0.14, 6), toon('#7a4a26'), 0, 0.33, 0));
    return g;
  }
  if (what === 'honey') {
    const honey = toon('#ffb21f', { transparent: true, opacity: 0.88 });
    g.add(mesh(sphere(1, 14, 10), honey, 0, 0, 0, 0.3, 0.26, 0.3));
    g.add(mesh(sphere(1, 10, 8), honey, 0.05, -0.26, 0.02, 0.12, 0.2, 0.12));
    g.add(mesh(sphere(1, 8, 6), honey, -0.2, 0.1, 0.1, 0.11));
    g.add(mesh(sphere(1, 8, 6), toon('#ffffff', { emissive: 0.5, transparent: true, opacity: 0.6 }), -0.08, 0.1, 0.22, 0.05));
    return g;
  }
  if (what === 'banana') {
    // A bunch of three, curved, yellow with dark tips.
    for (const [i, a] of [-0.5, 0, 0.5].entries()) {
      const one = mesh(torus(0.26, 0.075, Math.PI * 0.8), toon('#ffd93d'), 0, 0, 0);
      one.rotation.set(0, a, Math.PI * 0.6);
      one.position.set(Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08 - 0.05);
      g.add(one);
      g.add(mesh(sphere(1, 6, 4), toon('#5a3a1c'), Math.sin(a) * 0.3, -0.24 + i * 0.01, Math.cos(a) * 0.3 - 0.05, 0.04));
    }
    g.add(mesh(cylinder(0.05, 0.05, 0.12, 6), toon('#5a3a1c'), 0, 0.27, -0.05));
    return g;
  }
  if (what === 'ink' || what === 'smudge') {
    // A blob of ink, blue-black; or a smudge of Queen Grizzle's grey.
    const dark = toon(what === 'ink' ? '#1c2440' : '#8b9099', { transparent: true, opacity: 0.92 });
    g.add(mesh(sphere(1, 14, 10), dark, 0, 0, 0, 0.3, 0.27, 0.3));
    g.add(mesh(sphere(1, 8, 6), dark, 0.22, 0.12, -0.08, 0.12));
    g.add(mesh(sphere(1, 8, 6), dark, -0.2, -0.1, 0.12, 0.1));
    g.add(mesh(sphere(1, 8, 6), dark, 0.02, -0.26, 0.04, 0.09, 0.14, 0.09));
    g.add(mesh(sphere(1, 8, 6), toon('#ffffff', { emissive: 0.4, transparent: true, opacity: 0.5 }), -0.1, 0.12, 0.2, 0.045));
    return g;
  }
  if (what === 'ricecake') {
    // A rice cake fresh from the mortar: round, white and soft, a leaf under it.
    g.add(mesh(sphere(1, 16, 12), toon('#fbf7ee'), 0, 0.02, 0, 0.33, 0.22, 0.33));
    g.add(mesh(sphere(1, 10, 8), toon('#ffffff'), 0.08, 0.14, 0.1, 0.12, 0.06, 0.12));
    g.add(mesh(sphere(1, 10, 8), toon('#5fa84a'), 0, -0.18, 0, 0.3, 0.03, 0.2));
    return g;
  }
  if (what === 'coconut') {
    g.add(mesh(sphere(1, 14, 10), toon('#7a4a26'), 0, 0, 0, 0.3, 0.27, 0.3));
    for (const [x, z] of [[0.08, 0.26], [-0.08, 0.26], [0, 0.29]]) g.add(mesh(sphere(1, 6, 4), toon('#3a2414'), x, 0.08, z * 0.95, 0.04));
  } else if (what === 'pod') {
    g.add(mesh(sphere(1, 14, 10), toon('#b8d870'), 0, 0, 0, 0.26, 0.3, 0.26));
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05;
      g.add(mesh(sphere(1, 6, 4), toon('#f4f7c0', { emissive: 0.3 }), Math.sin(a) * 0.22, Math.cos(a * 1.7) * 0.15, Math.cos(a) * 0.22, 0.05));
    }
  } else if (what === 'snowball') {
    g.add(mesh(sphere(1, 16, 12), toon('#ffffff'), 0, 0, 0, 0.36));
    g.add(mesh(sphere(1, 10, 8), toon('#dfeefc'), 0.12, -0.1, 0.18, 0.18));
  } else if (what === 'gumdrop') {
    g.add(mesh(cone(0.3, 0.42, 14), toon('#ff5aa5', { transparent: true, opacity: 0.85 }), 0, 0, 0));
    g.add(mesh(sphere(1, 10, 8), toon('#ffffff', { transparent: true, opacity: 0.5 }), 0.06, 0.06, 0.12, 0.06));
  } else if (what === 'mud') {
    g.add(mesh(sphere(1, 12, 8), toon('#6b4a2b'), 0, 0, 0, 0.34, 0.3, 0.34));
    g.add(mesh(sphere(1, 8, 6), toon('#4f3620'), 0.18, 0.12, 0.1, 0.14));
    g.add(mesh(sphere(1, 8, 6), toon('#7d5a36'), -0.16, -0.08, 0.14, 0.12));
  } else if (what === 'sandball') {
    // A ball of packed sand, crumbling at its edges.
    g.add(mesh(sphere(1, 14, 10), toon('#e8c77a'), 0, 0, 0, 0.36));
    for (const [x, y, z] of [[0.2, 0.18, 0.15], [-0.22, 0.1, 0.12], [0.05, -0.2, 0.25], [-0.1, 0.25, -0.2]]) g.add(mesh(sphere(1, 6, 4), toon('#cfa95a'), x, y, z, 0.09));
  } else if (what === 'crystal') {
    // A glowing crystal off Old Glimmershell's back (or the cave's roof).
    g.add(mesh(OCTA, toon('#b98cff', { emissive: 0.8, transparent: true, opacity: 0.9 }), 0, 0, 0, 0.2, 0.42, 0.2));
    g.add(mesh(OCTA, toon('#7fe8ff', { emissive: 0.8, transparent: true, opacity: 0.9 }), 0.16, -0.08, 0.05, 0.11, 0.24, 0.11));
  } else if (what === 'pumpkin') {
    // A grinning pumpkin, its face aglow.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(mesh(sphere(1, 12, 10), toon('#ff8a1f'), Math.sin(a) * 0.14, 0, Math.cos(a) * 0.14, 0.22, 0.3, 0.22));
    }
    g.add(mesh(cylinder(0.04, 0.05, 0.16, 8), toon('#4f7a2a'), 0, 0.32, 0));
    const lit = toon('#ffe14d', { emissive: 1 });
    for (const side of [-1, 1]) g.add(mesh(cone(0.06, 0.08, 3), lit, side * 0.1, 0.08, 0.33).rotateX(Math.PI / 2));
    g.add(mesh(sphere(1, 8, 6), lit, 0, -0.1, 0.33, 0.14, 0.04, 0.03));
  } else if (what === 'gear') {
    // A steel cog, spinning.
    const steel = toon('#9aa3ad');
    g.add(mesh(cylinder(0.3, 0.3, 0.12, 18), steel, 0, 0, 0).rotateX(Math.PI / 2));
    g.add(mesh(cylinder(0.09, 0.09, 0.14, 10), toon('#4a5260'), 0, 0, 0).rotateX(Math.PI / 2));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tooth = mesh(cylinder(0.06, 0.06, 0.12, 4), steel, Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0);
      tooth.rotation.set(Math.PI / 2, 0, a);
      g.add(tooth);
    }
  } else if (what === 'lava') {
    g.add(mesh(ROCK, toon('#3b3438'), 0, 0, 0, 0.34));
    g.add(mesh(sphere(1, 10, 8), toon('#ff7a1a', { emissive: 1 }), 0, 0, 0, 0.3));
  } else {
    // A grumble bomb: round and purple, with a fuse and a spark.
    g.add(mesh(sphere(1, 16, 12), toon('#4b2f73'), 0, 0, 0, 0.34));
    g.add(mesh(cylinder(0.1, 0.1, 0.1, 10), toon('#2b2530'), 0, 0.34, 0));
    g.add(mesh(cylinder(0.02, 0.02, 0.14, 6), toon('#c9a26b'), 0.03, 0.44, 0).rotateZ(-0.4));
    g.add(mesh(sphere(1, 8, 6), toon('#ffd84d', { emissive: 1 }), 0.07, 0.52, 0, 0.06));
  }
  return g;
}

// Thrown from `from` to each of `to` ([x, y, z]), coming down in ms: one of
// what flying up and over to each in an arc, spinning, with a ring as wide
// as r on the ground where it lands; land(at) is told as each one lands,
// and effects burst it there. sky: it falls out of the sky instead, whatever
// it is (Adventure Isle's hazards on the way, adventure.js).
export class Thrown {
  constructor(scene, effects, from, to, ms, r, what, land, sky = false) {
    this.life = ms / 1000;
    this.age = 0;
    this.from = from;
    this.effects = effects;
    this.what = what;
    this.land = land;
    this.spots = to;
    this.rings = to.map(([x, y, z]) => new WarnRing(scene, x, y, z, r, ms));
    this.sky = FROM_SKY[what] || sky;
    this.ground = FROM_GROUND[what];
    this.shots = (UNSEEN[what] ? [] : to).map((at) => {
      const g = thrownMesh(what);
      g.position.set(...from);
      scene.add(g);
      // As high over the higher end as half the way is long, at least a few.
      const high = Math.max(from[1], at[1]) + Math.max(3, Math.hypot(at[0] - from[0], at[2] - from[2]) * 0.45);
      return { g, at, high };
    });
  }

  update(dt) {
    this.age += dt;
    const k = Math.min(1, this.age / this.life);
    // Roots burst up as it lands, and sink back: the show goes on a while after.
    if (this.ground) {
      for (const s of this.shots) {
        const after = this.age - this.life;
        const up = after < 0 ? Math.max(0, (k - 0.82) / 0.18) * 0.12 : after < 0.12 ? 0.12 + (after / 0.12) * 0.88 : Math.max(0, 1 - (after - 0.3) / 0.35);
        s.g.position.set(s.at[0], s.at[1], s.at[2]);
        s.g.scale.set(Math.max(0.01, up), Math.max(0.01, up), Math.max(0.01, up));
      }
    }
    if (this.sky) {
      for (const s of this.shots) {
        // Out of the sky, late and fast, spinning as it comes.
        const fall = Math.max(0, (k - 0.25) / 0.75);
        s.g.position.set(s.at[0] + (1 - fall) * 3, s.at[1] + 0.4 + (1 - fall * fall) * 18, s.at[2] - (1 - fall) * 2);
        s.g.rotation.z += dt * 9;
        if (Math.random() < 0.6) this.effects.add('sparkle', s.g.position.x, s.g.position.y + 0.3, s.g.position.z, { vy: 1, size: 0.14, life: 0.45, color: '#ffef9a' });
      }
    }
    for (const s of this.sky || this.ground ? [] : this.shots) {
      const [fx, fy, fz] = this.from;
      const [tx, ty, tz] = s.at;
      // Along a curve up to high and down again (a quadratic, through the
      // top at the middle).
      const mid = 2 * s.high - (fy + ty) / 2;
      const y = (1 - k) * (1 - k) * fy + 2 * (1 - k) * k * mid + k * k * ty;
      s.g.position.set(fx + (tx - fx) * k, y + 0.3, fz + (tz - fz) * k);
      s.g.rotation.x += dt * 7;
      s.g.rotation.z += dt * 5;
    }
    this.rings = this.rings.filter((r) => r.update(dt));
    if (k < 1) return true;
    if (!this.landed) {
      this.landed = true;
      for (const at of this.spots) {
        this.burst(at);
        this.land?.(at);
      }
    }
    if (this.ground && this.age - this.life < 0.65) return true;
    for (const s of this.shots) s.g.removeFromParent();
    for (const r of this.rings) r.dispose();
    return false;
  }

  // What it does as it lands: a splat of snow, a splash of mud, a burst of
  // spores, a puff of smoke and sparks.
  burst([x, y, z]) {
    const fx = this.effects;
    const colors = { coconut: ['#7a4a26', '#e9dcc0', '#ffffff'], pod: ['#e6f28a', '#c9e46a', '#f4f7c0'], snowball: ['#ffffff', '#dfeefc', '#bfe8ff'], gumdrop: ['#ff5aa5', '#ffd23f', '#5fd36a'], mud: ['#6b4a2b', '#4f3620', '#8a6a48'], lava: ['#ff7a1a', '#ffd84d', '#3b3438'], bomb: ['#ffd84d', '#ff8fc4', '#b18cff'], boulder: ['#8d929c', '#a2a7b0', '#6d727c'], bone: ['#f3ead2', '#d9ccab', '#ffffff'], venom: ['#a6e04a', '#d6ff5a', '#6f9440'], bolt: ['#ffffff', '#ffe14d', '#59c7ff'], star: ['#ffe14d', '#ffffff', '#ffb13b'], root: ['#6b4a2f', '#8a6a48', '#4f3620'], sandball: ['#e8c77a', '#cfa95a', '#fff1c4'], crystal: ['#b98cff', '#7fe8ff', '#ffffff'], pumpkin: ['#ff8a1f', '#ffe14d', '#4f7a2a'], gear: ['#9aa3ad', '#4a5260', '#ffd75a'], berry: ['#e3342b', '#ff8fa8', '#35a852'], acorn: ['#d9a35c', '#7a4a26', '#f6e3c0'], honey: ['#ffb21f', '#ffd93d', '#fff1b8'], banana: ['#ffd93d', '#fff1b8', '#5a3a1c'], ink: ['#1c2440', '#3a4a7a', '#0e1224'], ricecake: ['#fbf7ee', '#ffffff', '#5fa84a'], smudge: ['#8b9099', '#c9ced6', '#5d626c'] }[this.what] ?? ['#ffffff'];
    if (this.what === 'pod') fx.spores(x, y, z, 1.6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = 2 + Math.random() * 2.5;
      fx.add(i % 3 ? 'square' : 'puff', x, y + 0.3, z, { vx: Math.cos(a) * s, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * s, size: i % 3 ? 0.1 : 0.3, life: 0.6, gravity: 12, drag: 0.8, color: colors[i % colors.length] });
    }
    if (this.what === 'bomb' || this.what === 'lava' || this.what === 'boulder' || this.what === 'bolt' || this.what === 'star' || this.what === 'gear') fx.bang(x, y + 0.8, z);
    fx.dust(x, y, z);
  }
}
