// What shows on the ground before a boss's move comes (shared/bosses.js),
// so there is time to get out of the way: a red ring where something it
// threw (or it, leaping) will come down, filling in as the moment comes;
// a strip the way it is about to charge; and the things it throws, flying
// there in an arc and bursting as they land.
import * as THREE from '../../vendor/three.module.js';
import { cone, cylinder, mesh, sphere, toon } from './toon.js';

const WARN = '#ff4a3d';
// A lava rock's shape.
const ROCK = new THREE.DodecahedronGeometry(1, 0);

// A ring flat on the ground at (x, y, z), as wide as r, pulsing, with a
// disc inside it growing out to its edge as the moment it shows comes.
export class WarnRing {
  constructor(scene, x, y, z, r, ms) {
    this.life = ms / 1000;
    this.age = 0;
    this.group = new THREE.Group();
    this.group.position.set(x, y + 0.07, z);
    const mat = (opacity) => new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
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
// mud, a lava rock or a grumble bomb.
export function thrownMesh(what) {
  const g = new THREE.Group();
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
// and effects burst it there.
export class Thrown {
  constructor(scene, effects, from, to, ms, r, what, land) {
    this.life = ms / 1000;
    this.age = 0;
    this.from = from;
    this.effects = effects;
    this.what = what;
    this.land = land;
    this.rings = to.map(([x, y, z]) => new WarnRing(scene, x, y, z, r, ms));
    this.shots = to.map((at) => {
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
    for (const s of this.shots) {
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
    for (const s of this.shots) {
      this.burst(s.at);
      this.land?.(s.at);
      s.g.removeFromParent();
    }
    for (const r of this.rings) r.dispose();
    return false;
  }

  // What it does as it lands: a splat of snow, a splash of mud, a burst of
  // spores, a puff of smoke and sparks.
  burst([x, y, z]) {
    const fx = this.effects;
    const colors = { coconut: ['#7a4a26', '#e9dcc0', '#ffffff'], pod: ['#e6f28a', '#c9e46a', '#f4f7c0'], snowball: ['#ffffff', '#dfeefc', '#bfe8ff'], gumdrop: ['#ff5aa5', '#ffd23f', '#5fd36a'], mud: ['#6b4a2b', '#4f3620', '#8a6a48'], lava: ['#ff7a1a', '#ffd84d', '#3b3438'], bomb: ['#ffd84d', '#ff8fc4', '#b18cff'] }[this.what] ?? ['#ffffff'];
    if (this.what === 'pod') fx.spores(x, y, z, 1.6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = 2 + Math.random() * 2.5;
      fx.add(i % 3 ? 'square' : 'puff', x, y + 0.3, z, { vx: Math.cos(a) * s, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * s, size: i % 3 ? 0.1 : 0.3, life: 0.6, gravity: 12, drag: 0.8, color: colors[i % colors.length] });
    }
    if (this.what === 'bomb' || this.what === 'lava') fx.bang(x, y + 0.8, z);
    fx.dust(x, y, z);
  }
}
