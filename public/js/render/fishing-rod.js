// Fishing (shared/fishing.js): the rod in a fisher's hand (render/avatar.js
// ANIM.fish); the line from its tip out to the bobber on the water; the fish
// that will bite, swimming in under the water and circling it, nibbling,
// biting and fighting, leaping out; and what comes up, hanging from the line.
import * as THREE from '../../vendor/three.module.js';
import { cone, cylinder, mesh, sphere, toon, torus } from './toon.js';

// How long the rod is, from the grip in the hand to its tip.
export const ROD_LEN = 1.35;
// How far under the water's top the fish swims (its middle), where the
// see-through water shows it, tinted, as it does the island's own fish.
const DEEP = 0.17;
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
export const drawnLength = (cm) => 0.3 + Math.min(60, cm) * 0.011;

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
// at the origin. Its tail (`tail`) wags.
export function fishModel(key, len) {
  const look = FISH_LOOKS[key] ?? FISH_LOOKS.minnow;
  const m = (color, opts) => toon(color, opts);
  const g = new THREE.Group();
  g.name = `fish ${key}`;
  // Its width, height and length: slim, or a ball for a pufferfish.
  const [w, h, l] = look.round ? [0.62 * len, 0.6 * len, 0.7 * len] : [0.22 * len, 0.34 * len, 0.86 * len];
  g.add(mesh(sphere(0.5, 20, 14), m(look.body, look.glow ? { emissive: 0.35 } : undefined), 0, 0, 0, w, h, l));
  {
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
// the line from the rod's tip down to it, the fish that will bite, under the
// water, and what comes up. Each frame update() is told how the line is
// going (see game.js updateLines): { phase: 'wait' | 'nibble' | 'strike' |
// 'fight' | 'landed' | 'lost', progress, pull, shore }. Lives in the scene
// till dispose().
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
    // The fish coming to the bobber (setFish), none till one is on its way.
    this.fish = null;
    this.fishAt = Math.random() * Math.PI * 2;
    // Where the hook is: at the bobber, till a fish is on and pulls it about.
    this.hook = this.at.clone();
    // Flying out from the rod to the water, when cast, for this long.
    this.flight = 0.45;
    this.age = 0;
    this.caught = null;
    scene.add(this.bobber, this.ring, this.line);
  }

  // The fish that will bite: kind `key`, `cm` long, swimming in from out in
  // the deep under the water (from the way `out`, { x, z }, if known). A seashell, a
  // pearl or a boot (cm 0) has no fish: the line snags on it.
  setFish(key, cm, out = null) {
    if (this.fish) this.scene.remove(this.fish);
    this.fish = cm ? fishModel(key, drawnLength(cm)) : null;
    if (!this.fish) return;
    this.fishKey = key;
    this.fishAt = Math.random() * Math.PI * 2;
    const from = out ? new THREE.Vector3(out.x, 0, out.z) : new THREE.Vector3(Math.cos(this.fishAt), 0, Math.sin(this.fishAt));
    this.fish.position.copy(this.at).addScaledVector(from, 4).setY(this.top - DEEP);
    this.fish.userData.came = this.age;
    this.scene.add(this.fish);
  }

  // What came up: kind `key`, `cm` long (0 for what is not a fish). The fish
  // on the hook itself leaps out of the water and swings up to hang from the
  // line; anything else comes up from under the bobber.
  land(key, cm) {
    if (this.fish && cm) {
      this.caught = this.fish;
      this.fish = null;
    } else {
      this.caught = cm ? fishModel(key, drawnLength(cm)) : thingModel(key);
      this.scene.add(this.caught);
    }
    this.landedAt = this.age;
    this.from = this.hook.clone().setY(this.top - DEEP);
  }

  // The fish on the hook leaping right out of the water as it runs, up in an
  // arc over where the hook is and back in. Whether it did (not twice at once).
  leap() {
    if (!this.fish || this.leapAt !== undefined) return false;
    this.leapAt = this.age;
    return true;
  }

  // Each frame: the tip of the rod in the world (or null to keep the line
  // where it was), the seconds since the last, the time in seconds, and how
  // the line is going.
  update(tip, dt, t, s = { phase: 'wait' }) {
    this.age += dt;
    const fly = Math.min(1, this.age / this.flight);
    const b = this.bobber.position;
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
    this.swim(dt, t, s, out, side);
    this.drawLine(tip, b, fighting ? 0 : phase === 'strike' ? 0.05 : 0.35 * fly);
  }

  // The fish under the water: swimming in and round the bobber, a little
  // closer each time; in to it, nose first, to nibble or bite; on the hook,
  // thrashing under it, leaping out now and then as it runs; got away, off
  // out into the deep, down out of sight.
  swim(dt, t, s, out, side) {
    const f = this.fish;
    if (!f) return;
    const phase = s.phase;
    const tail = f.userData.tail;
    const deep = this.top - DEEP;
    const p = f.position;
    if (phase === 'lost') {
      p.addScaledVector(out, dt * 4);
      p.y -= dt * 0.8;
      f.rotation.set(0.3, Math.atan2(out.x, out.z), 0);
      tail.rotation.y = Math.sin(t * 25) * 0.7;
      return;
    }
    if (phase === 'fight') {
      if (this.leapAt !== undefined) {
        // Up out of the water in an arc and back in, flipping as it goes.
        const u = (this.age - this.leapAt) / 0.75;
        if (u >= 1) this.leapAt = undefined;
        else {
          p.copy(this.hook).addScaledVector(out, (u - 0.5) * 0.6);
          p.y = deep + Math.sin(u * Math.PI) * (0.9 + DEEP);
          f.rotation.set(-Math.cos(u * Math.PI) * 1.1, Math.atan2(out.x, out.z), Math.sin(t * 20) * 0.3);
          tail.rotation.y = Math.sin(t * 30) * 0.7;
          return;
        }
      }
      // Under the hook, its nose to it, pulling away out to sea.
      const goal = this.hook.clone().addScaledVector(out, 0.15 + (f.userData.nose ?? 0.15)).setY(deep);
      p.lerp(goal, Math.min(1, dt * 10));
      f.rotation.set(0, Math.atan2(out.x, out.z) + Math.sin(t * 5) * 0.5, Math.sin(t * 13) * (s.pull ?? 0) * 0.4);
      tail.rotation.y = Math.sin(t * (14 + (s.pull ?? 0) * 16)) * 0.7;
      return;
    }
    const was = p.clone();
    if (phase === 'nibble' || phase === 'strike') {
      // Nose to the bobber, from where it was.
      const from = new THREE.Vector3(p.x - this.at.x, 0, p.z - this.at.z);
      if (from.lengthSq() < 1e-4) from.copy(out);
      from.normalize().multiplyScalar(f.userData.nose ?? 0.15);
      p.lerp(new THREE.Vector3(this.at.x + from.x, deep + (phase === 'strike' ? 0.05 : 0), this.at.z + from.z), Math.min(1, dt * 9));
      f.rotation.set(phase === 'strike' ? -0.35 : -0.1, Math.atan2(-from.x, -from.z), 0);
      tail.rotation.y = Math.sin(t * 18) * 0.5;
      return;
    }
    // Round the bobber, closer and closer; swimming in from afar first.
    this.fishAt += dt * 0.8;
    const r = Math.max(0.7, 1.6 - (this.age - (f.userData.came ?? 0)) * 0.08);
    const goal = new THREE.Vector3(this.at.x + Math.cos(this.fishAt) * r, deep, this.at.z + Math.sin(this.fishAt) * r);
    p.lerp(goal, Math.min(1, dt * 1.5));
    const go = p.clone().sub(was);
    if (go.lengthSq() > 1e-8) f.rotation.set(0, Math.atan2(go.x, go.z), 0);
    tail.rotation.y = Math.sin(t * 7) * 0.45;
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
    this.scene.remove(this.bobber, this.ring, this.line);
    if (this.fish) this.scene.remove(this.fish);
    if (this.caught) this.scene.remove(this.caught);
    this.line.geometry.dispose();
    this.line.material.dispose();
  }
}
