// What the beasts' models are made with (shared/beasts.js; beast-models.js and
// beast-models-big.js): the same glossy toys as every other monster, each on its
// feet at y = 0 and facing +z, each with cross eyes that glow at night. Each has
// a coat for each theme of island, as the blobs do.
import * as THREE from '../../vendor/three.module.js';
import { bakeCached, blobShadow, cylinder, mesh, sphere, toon } from './toon.js';

const UP = new THREE.Vector3(0, 1, 0);
export const DARK = '#241d2b';

// A smooth round joint and a tapered bone from a to b ([x, y, z] each, in
// parent's units), as thick as ra at a and rb at b.
export function limb(parent, a, b, ra, rb, mat, seg = 10) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const bone = mesh(cylinder(rb, ra, d.length(), seg), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  bone.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(bone);
  return bone;
}

// A round joint at a point.
export const joint = (parent, [x, y, z], r, mat) => {
  const j = mesh(sphere(1, 10, 8), mat, x, y, z, r);
  parent.add(j);
  return j;
};

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Where a part goes in a baked shape: at (x, y, z), sized, then turned.
export const at = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// The same, for a part standing up +y turned to point along (dx, dy, dz).
export const aim = (x, y, z, dx, dy, dz, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(dx, dy, dz).normalize()), new THREE.Vector3(sx, sy, sz));

// Many small parts that never move on their own (teeth, scales, leaves), as one
// shape drawn at one go: parts, [geometry, matrix] each, made once for key.
export function baked(key, mat, parts) {
  return new THREE.Mesh(
    bakeCached(`beast-${key}`, parts.map(([g, m]) => ({ g, m }))),
    mat,
  );
}

// A big cross eye on a face looking +z, at (x, y, z): its white (or its glow at
// night, model.eyeWhite and model.eyeGlow), a pupil, a glint, and a brow sloping
// down towards the middle. side: which side of the face it is on.
export function crossEye(model, parent, side, x, y, z, { w = 0.085, h = w * 1.12, brow = DARK, slope = 0.45, pupil = DARK } = {}) {
  const white = mesh(sphere(1, 14, 10), model.eyeWhite, x, y, z, w, h, w * 0.5);
  parent.add(white);
  model.eyes.push(white);
  parent.add(mesh(sphere(1, 10, 8), toon(pupil), x - side * w * 0.12, y - h * 0.12, z + w * 0.36, w * 0.46, h * 0.5, w * 0.22));
  parent.add(mesh(sphere(1, 6, 4), toon('#ffffff', { emissive: 0.6 }), x + side * w * 0.16, y + h * 0.26, z + w * 0.48, w * 0.15, h * 0.15, w * 0.07));
  if (brow) {
    const b = mesh(sphere(1, 8, 6), toon(brow), x - side * w * 0.1, y + h * 1.12, z + w * 0.12, w * 1.05, h * 0.26, w * 0.32);
    b.rotation.z = side * slope;
    parent.add(b);
    model.brows.push({ mesh: b, side, slope });
  }
}

// What every beast is and does each frame.
export class Beast {
  // body: its size as the game has it (shared/beasts.js), for its shadow.
  constructor({ height, center, pick, radius, glow = '#fff27a', white = '#fff7d6' }) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.height = height;
    this.center = center;
    this.pick = pick;
    this.shadowScale = radius * 2.4;
    this.seen = height > 2 ? 140 : 90;
    this.shadow = blobShadow(0.5, 0.2);
    this.time = Math.random() * 10;
    this.lastY = null;
    this.vy = 0;
    this.squash = 0;
    this.throwAt = -Infinity;
    this.eyeWhite = toon(white);
    this.eyeGlow = toon(glow, { emissive: 1 });
    this.eyes = [];
    this.brows = [];
  }

  // How fast it rises and falls, and squashing flat as it lands.
  bounce(dt, air) {
    this.time += dt;
    const y = this.group.position.y;
    if (this.lastY !== null && dt > 0) this.vy += ((y - this.lastY) / dt - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    if (air < 0.05 && this.vy < -1.5) this.squash = 0.35;
    this.squash = Math.max(0, this.squash - dt * 2.2);
  }

  // Eyes aglow at night, and crosser brows when it is after you.
  mood(state, night) {
    const mat = night ? this.eyeGlow : this.eyeWhite;
    for (const eye of this.eyes) if (eye.material !== mat) eye.material = mat;
    const cross = state === 'chase' || state === 'charge' || state === 'rear' ? 0.2 : 0;
    for (const b of this.brows) b.mesh.rotation.z = b.side * (b.slope + cross);
  }

  // Held still for a figure of it (monster-figures.js).
  figurePose() {
    this.update(0, 'idle', 0, false);
  }

  // What it was holding up has been thrown (monster's hurl).
  thrown() {
    this.throwAt = this.time;
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

// A value eased towards a target, at rate per second.
export const ease = (from, to, rate, dt) => from + (to - from) * Math.min(1, dt * rate);
// Whether a state is one of getting about, and how fast its legs go.
export const moving = (state) => state === 'hop' || state === 'chase' || state === 'charge';
export const pace = (state, walk, run, dash = run * 1.5) => (state === 'charge' ? dash : state === 'chase' ? run : walk);
