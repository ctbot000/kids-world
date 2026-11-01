// Fishing (shared/fishing.js): the rod in a fisher's hand (render/avatar.js
// ANIM.fish); the line from its tip out to the bobber on the water; the
// shadow of a fish circling under it, nibbling, biting and fighting; and
// what comes up, leaping out of the water and hanging from the line.
import * as THREE from '../../vendor/three.module.js';
import { cone, cylinder, mesh, sphere, toon, torus } from './toon.js';

// How long the rod is, from the grip in the hand to its tip.
export const ROD_LEN = 1.35;
// How far under the water's top the fish's shadow swims: a flat dark shape
// lying just on it, as the water's ripples draw over anything lower.
const DEEP = -0.07;
// The water's top in a water cell, as critters.js has it.
const TOP = 0.875;

// A toy fishing rod, its grip at the origin and its tip up +y: a cork
// handle, a yellow reel on the side, a bright blue pole tapering up through
// little rings to a red tip. `tip` marks where the line leaves it.
export function fishingRod() {
  const g = new THREE.Group();
  g.name = 'fishing rod';
  g.add(
    mesh(cylinder(0.026, 0.03, 0.26), toon('#c8955a'), 0, 0, 0),
    mesh(cylinder(0.03, 0.03, 0.03), toon('#3a3a48'), 0, 0.14, 0),
    mesh(cylinder(0.014, 0.022, ROD_LEN - 0.15), toon('#3f8ff0'), 0, 0.15 + (ROD_LEN - 0.15) / 2, 0),
    mesh(sphere(0.02, 10, 8), toon('#ff4a4a'), 0, ROD_LEN, 0),
  );
  // The reel, under the pole by the grip, its handle out to the side.
  const reel = new THREE.Group();
  reel.name = 'reel';
  reel.position.set(0, 0.06, 0.05);
  const drum = mesh(cylinder(0.045, 0.045, 0.035, 16), toon('#ffcf3f'));
  drum.rotation.z = Math.PI / 2;
  const handle = new THREE.Group();
  handle.name = 'handle';
  handle.position.x = 0.03;
  const arm = mesh(cylinder(0.008, 0.008, 0.07, 8), toon('#3a3a48'), 0, -0.03, 0);
  handle.add(arm, mesh(sphere(0.016, 8, 6), toon('#ff7fb2'), 0.012, -0.065, 0));
  reel.add(drum, handle);
  g.add(reel);
  for (const y of [0.45, 0.8, 1.1]) g.add(mesh(torus(0.018, 0.004), toon('#d8dde8'), 0, y, 0.022));
  const tip = new THREE.Object3D();
  tip.name = 'tip';
  tip.position.y = ROD_LEN;
  g.add(tip);
  return g;
}

// How long a catch is drawn, from its length in centimetres: toy-sized, so
// a minnow still shows and a big trout is not a shark.
export const drawnLength = (cm) => 0.26 + Math.min(60, cm) * 0.008;

// A fish's shadow in the water: dark and unlit, whatever the sun does, and
// solid, so the see-through water is never drawn over it.
const SHADOW = new THREE.MeshBasicMaterial({ color: '#245272' });

// Each kind's colours: body, belly, fins, and its stripes or spots.
const FISH_LOOKS = {
  minnow: { body: '#a9bccb', belly: '#eef3f6', fin: '#8aa0b0' },
  perch: { body: '#e8b23a', belly: '#fff0b8', fin: '#ff7a3a', stripes: '#5f8a3a' },
  clownfish: { body: '#ff7a1f', belly: '#ff9a4a', fin: '#ff7a1f', bands: '#ffffff' },
  trout: { body: '#7fa06a', belly: '#f4ead8', fin: '#6a8a58', stripe: '#ff7fa8', spots: '#3d4a2e' },
  puffer: { body: '#f2d25a', belly: '#fff6d0', fin: '#e8b030', spots: '#8a6a2a', round: true },
  goldfish: { body: '#ffc83a', belly: '#fff2a0', fin: '#ffaa20', glow: true },
};

// A toy fish of kind `key`, `len` long, nose to tail along +z, its middle
// at the origin; `shadow`, a dark one seen through the water.
// Its tail (`tail`) wags.
export function fishModel(key, len, shadow = false) {
  const look = FISH_LOOKS[key] ?? FISH_LOOKS.minnow;
  const dark = shadow ? SHADOW : null;
  const m = (color, opts) => dark ?? toon(color, opts);
  const g = new THREE.Group();
  g.name = shadow ? 'fish shadow' : `fish ${key}`;
  // Its width, height and length: slim, or a ball for a pufferfish.
  const [w, h, l] = look.round ? [0.62 * len, 0.6 * len, 0.7 * len] : [0.22 * len, 0.34 * len, 0.86 * len];
  g.add(mesh(sphere(0.5, 20, 14), m(look.body, look.glow ? { emissive: 0.35 } : undefined), 0, 0, 0, w, h, l));
  if (!shadow) {
    g.add(mesh(sphere(0.5, 16, 10), toon(look.belly), 0, -h * 0.16, 0, w * 0.92, h * 0.7, l * 0.86));
    // Eyes, either side near the nose.
    for (const s of [-1, 1]) {
      g.add(mesh(sphere(1, 10, 8), toon('#ffffff'), s * w * 0.4, h * 0.12, l * 0.3, len * 0.05));
      g.add(mesh(sphere(1, 8, 6), toon('#1d2433'), s * w * 0.46, h * 0.13, l * 0.32, len * 0.03));
    }
    if (look.bands) for (const z of [0.18, -0.12]) g.add(mesh(sphere(0.5, 16, 10), toon(look.bands), 0, 0, l * z, w * 1.04, h * 1.02, l * 0.1));
    if (look.stripes) for (const z of [0.15, 0, -0.15]) g.add(mesh(sphere(0.5, 12, 8), toon(look.stripes), 0, h * 0.1, l * z, w * 1.03, h * 0.85, l * 0.05));
    if (look.stripe) g.add(mesh(sphere(0.5, 16, 10), toon(look.stripe), 0, 0, 0, w * 1.03, h * 0.28, l * 0.82));
    if (look.spots) {
      for (let i = 0; i < 8; i++) {
        const s = i % 2 ? 1 : -1;
        g.add(mesh(sphere(1, 8, 6), toon(look.spots), s * w * 0.48, h * (0.12 + 0.12 * Math.sin(i * 2.3)), l * (0.25 - i * 0.07), len * 0.022));
      }
    }
    // A pufferfish's spikes.
    if (look.round) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const spike = mesh(cone(len * 0.03, len * 0.08, 6), toon(look.fin), Math.cos(a) * w * 0.52, Math.sin(a) * h * 0.52, -len * 0.02);
        spike.rotation.z = a - Math.PI / 2;
        g.add(spike);
      }
    }
  }
  // A fin on top, and the tail, fanned out behind on a hinge to wag.
  const top = mesh(cone(len * 0.12, len * 0.2, 4), m(look.fin), 0, h * 0.5, -l * 0.05, 0.25, 1, 1);
  top.rotation.x = -0.5;
  g.add(top);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.z = -l * 0.45;
  const fan = mesh(cone(len * 0.2, len * 0.26, 4), m(look.fin), 0, 0, -len * 0.1, 0.22, 1, 1);
  fan.rotation.x = Math.PI / 2;
  tail.add(fan);
  g.add(tail);
  g.userData.tail = tail;
  // Where its mouth is, ahead of its middle, for the hook.
  g.userData.nose = l * 0.5;
  return g;
}

// What else comes up on a line: an old boot, a seashell or a pearl.
function thingModel(key) {
  const g = new THREE.Group();
  g.name = key;
  if (key === 'boot') {
    g.add(mesh(cylinder(0.09, 0.1, 0.26, 12), toon('#7a5230'), 0, 0.08, -0.05), mesh(sphere(0.5, 14, 10), toon('#6a4426'), 0, -0.06, 0.06, 0.2, 0.14, 0.34), mesh(torus(0.09, 0.015), toon('#4a2e18'), 0, 0.21, -0.05));
    g.children[2].rotation.x = Math.PI / 2;
  } else if (key === 'pearl') {
    g.add(mesh(sphere(0.07, 16, 12), toon('#f6f2ee', { emissive: 0.2 })));
  } else {
    g.add(mesh(sphere(0.12, 16, 10), toon('#ffc2cb'), 0, 0, 0, 1, 0.45, 1), mesh(sphere(0.05, 10, 8), toon('#ff9fb0'), 0, 0.02, -0.1));
  }
  g.userData.tail = null;
  return g;
}

// How many points the line sags through, from the rod's tip to the bobber.
const POINTS = 14;
const ease = (u) => u * u * (3 - 2 * u);

// A line out on the water, for whoever fishes: the bobber (red over white),
// the line from the rod's tip down to it, a fish's shadow under the water,
// and what comes up. Each frame update() is told how the line is going (see
// game.js updateLines): { phase: 'wait' | 'nibble' | 'strike' | 'fight' |
// 'landed' | 'lost', progress, pull, shore }. Lives in the scene till dispose().
export class FishingLine {
  constructor(scene, at) {
    this.scene = scene;
    const top = at.y + TOP;
    this.at = new THREE.Vector3(at.x + 0.5, top + 0.045, at.z + 0.5);
    this.top = top;
    // Where the rod's tip is, kept up to date by whoever draws the line.
    this.tip = new THREE.Vector3();
    this.bobber = new THREE.Group();
    this.bobber.name = 'bobber';
    this.bobber.add(
      mesh(sphere(0.09, 14, 10), toon('#ff3b3b'), 0, 0.03, 0, 1, 0.9, 1),
      mesh(sphere(0.09, 14, 10), toon('#ffffff'), 0, -0.03, 0, 1, 0.8, 1),
      mesh(cylinder(0.012, 0.012, 0.09, 6), toon('#ffcf3f'), 0, 0.12, 0),
    );
    this.bobber.position.copy(this.at);
    this.ring = mesh(torus(0.2, 0.012), toon('#ffffff', { transparent: true, opacity: 0.5 }), 0, 0, 0);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.copy(this.at).setY(top + 0.01);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3));
    this.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.9 }));
    this.line.frustumCulled = false;
    this.line.name = 'fishing line';
    // The fish's shadow: a fish of no kind in particular, till it comes up.
    this.shadow = fishModel('minnow', 0.8, true);
    this.shadow.scale.set(1.7, 0.12, 1);
    this.shadow.position.copy(this.at).setY(top - DEEP);
    this.shadow.visible = false;
    this.shadowAt = Math.random() * Math.PI * 2;
    // Where the hook is: at the bobber, till a fish is on and pulls it about.
    this.hook = this.at.clone();
    // Flying out from the rod to the water, when cast, for this long.
    this.flight = 0.45;
    this.age = 0;
    this.caught = null;
    scene.add(this.bobber, this.ring, this.line, this.shadow);
  }

  // What came up: kind `key`, `cm` long (0 for what is not a fish). It
  // leaps out of the water from the hook and swings up to hang from the line.
  land(key, cm) {
    this.caught = cm ? fishModel(key, drawnLength(cm)) : thingModel(key);
    this.caught.position.copy(this.hook);
    this.landedAt = this.age;
    this.from = this.hook.clone();
    this.scene.add(this.caught);
  }

  // The fish on the hook leaping right out of the water as it runs: kind
  // `key`, `cm` long, up in an arc over where the hook is and back in.
  leap(key, cm) {
    if (this.leaping) return false;
    this.leaping = fishModel(key, drawnLength(cm));
    this.leaping.userData.at = this.age;
    this.scene.add(this.leaping);
    return true;
  }

  // Each frame: the tip of the rod in the world (or null to keep the line
  // where it was), the seconds since the last, the time in seconds, and how
  // the line is going.
  update(tip, dt, t, s = { phase: 'wait' }) {
    this.age += dt;
    const fly = Math.min(1, this.age / this.flight);
    const b = this.bobber.position;
    const sh = this.shadow;
    const phase = s.phase;
    const fighting = phase === 'fight';
    // Out from the shore, along the water: the way the fish runs.
    const out = s.shore ? new THREE.Vector3(this.at.x - s.shore.x, 0, this.at.z - s.shore.z).normalize() : new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3(-out.z, 0, out.x);
    if (fighting && s.shore) {
      // On the hook: dragged in to the shore as you reel, out again as it
      // runs, and from side to side, harder the harder it pulls.
      const far = this.at.clone().addScaledVector(out, 1.2);
      const near = new THREE.Vector3(s.shore.x, this.at.y, s.shore.z).addScaledVector(out, 0.6);
      const goal = far.lerp(near, s.progress ?? 0).addScaledVector(side, Math.sin(t * 2.6) * (0.25 + (s.pull ?? 0) * 0.9) + Math.sin(t * 9.1) * (s.pull ?? 0) * 0.15);
      this.hook.lerp(goal, Math.min(1, dt * 6));
    }
    if (this.leaping) {
      const u = (this.age - this.leaping.userData.at) / 0.75;
      if (u >= 1 || phase !== 'fight') {
        this.scene.remove(this.leaping);
        this.leaping = null;
      } else {
        const lf = this.leaping;
        lf.position.copy(this.hook).addScaledVector(out, (u - 0.5) * 0.6);
        lf.position.y = this.top + Math.sin(u * Math.PI) * 0.9;
        lf.rotation.set(-Math.cos(u * Math.PI) * 1.1, Math.atan2(out.x, out.z), Math.sin(t * 20) * 0.3);
        lf.userData.tail.rotation.y = Math.sin(t * 30) * 0.7;
      }
    }
    if (phase === 'landed' && this.caught) {
      // Out of the water in an arc, then hanging from the line, wriggling.
      const u = Math.min(1, (this.age - this.landedAt) / 0.6);
      const hang = tip ? tip.clone().add(new THREE.Vector3(0, -0.45, 0)) : this.from;
      this.caught.position.lerpVectors(this.from, hang, ease(u));
      this.caught.position.y += Math.sin(u * Math.PI) * 1.2;
      this.caught.rotation.set(-Math.PI / 2 + Math.sin(t * 7) * 0.25, t * 1.5, 0);
      const tail = this.caught.userData.tail;
      if (tail) tail.rotation.y = Math.sin(t * 22) * 0.6;
      this.bobber.visible = false;
      sh.visible = false;
      this.ring.visible = false;
      this.drawLine(tip, this.caught.position.clone().add(new THREE.Vector3(0, (this.caught.userData.nose ?? 0.1) - 0.1, 0)), 0);
      return;
    }
    // The bobber: flying out, then on the water, twitching at a nibble,
    // under at a bite, and pulled about with the fish once it is hooked.
    if (fly < 1 && tip) {
      b.lerpVectors(tip, this.at, fly);
      b.y += Math.sin(fly * Math.PI) * 1.4;
    } else if (fighting) {
      b.copy(this.hook);
      b.y += -0.1 - Math.abs(Math.sin(t * 18)) * 0.05 * (1 + (s.pull ?? 0) * 2);
    } else {
      b.copy(this.at);
      b.y += phase === 'strike' ? -0.17 - Math.abs(Math.sin(t * 22)) * 0.06 : phase === 'nibble' ? -0.06 * Math.abs(Math.sin(t * 30)) : Math.sin(t * 2.4) * 0.025;
      if (phase === 'strike') b.x += Math.sin(t * 17) * 0.04;
    }
    this.bobber.visible = true;
    this.ring.visible = fly >= 1 && phase !== 'lost';
    this.ring.position.set(b.x, this.top + 0.01, b.z);
    const busy = phase === 'strike' || fighting;
    const ring = busy ? 1 + ((t * 3) % 1) * 0.7 : phase === 'nibble' ? 1 + ((t * 5) % 1) * 0.8 : 1 + ((t * 0.6) % 1) * 0.6;
    this.ring.scale.set(ring, ring, ring);
    this.ring.material.opacity = busy ? 0.7 : 0.35;
    // The fish's shadow: circling the bobber, closer and closer, darting in
    // to nibble, right under it to bite; on the hook, thrashing under it;
    // got away, off out into the deep.
    sh.visible = fly >= 1;
    const tail = sh.userData.tail;
    if (phase === 'lost') {
      sh.position.addScaledVector(out, dt * 4);
      sh.rotation.y = Math.atan2(out.x, out.z);
      sh.scale.multiplyScalar(Math.max(0, 1 - dt * 1.5));
      tail.rotation.y = Math.sin(t * 25) * 0.7;
    } else if (fighting) {
      sh.position.set(this.hook.x, this.top - DEEP, this.hook.z);
      sh.rotation.y = Math.atan2(out.x, out.z) + Math.sin(t * 5) * 0.6;
      tail.rotation.y = Math.sin(t * (14 + (s.pull ?? 0) * 16)) * 0.7;
    } else {
      // Round the bobber, a little closer each time; in to it to nibble or bite.
      this.shadowAt += dt * 0.9;
      const r = phase === 'nibble' || phase === 'strike' ? 0.18 : Math.max(0.6, 1.5 - this.age * 0.08);
      const goal = new THREE.Vector3(this.at.x + Math.cos(this.shadowAt) * r, this.top - DEEP, this.at.z + Math.sin(this.shadowAt) * r);
      sh.position.lerp(goal, Math.min(1, dt * (phase === 'wait' ? 3 : 8)));
      sh.rotation.y = phase === 'wait' ? -this.shadowAt : Math.atan2(this.at.x - sh.position.x, this.at.z - sh.position.z);
      tail.rotation.y = Math.sin(t * (phase === 'wait' ? 6 : 14)) * 0.45;
    }
    this.drawLine(tip, b, fighting ? 0 : phase === 'strike' ? 0.05 : 0.35 * fly);
  }

  // The line from the rod's tip to `to`, sagging `sag` in the middle.
  drawLine(tip, to, sag) {
    this.line.visible = Boolean(tip);
    if (!tip) return;
    const pos = this.line.geometry.attributes.position;
    for (let i = 0; i < POINTS; i++) {
      const u = i / (POINTS - 1);
      pos.setXYZ(i, tip.x + (to.x - tip.x) * u, tip.y + (to.y + 0.1 - tip.y) * u - Math.sin(u * Math.PI) * sag, tip.z + (to.z - tip.z) * u);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.bobber, this.ring, this.line, this.shadow);
    if (this.caught) this.scene.remove(this.caught);
    if (this.leaping) this.scene.remove(this.leaping);
    this.line.geometry.dispose();
    this.line.material.dispose();
  }
}
