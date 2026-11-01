// Fishing (shared/fishing.js): the rod in a fisher's hand (render/avatar.js
// ANIM.fish), and the line from its tip out to the bobber on the water.
import * as THREE from '../../vendor/three.module.js';
import { cylinder, mesh, sphere, toon, torus } from './toon.js';

// How long the rod is, from the grip in the hand to its tip.
export const ROD_LEN = 1.35;

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
  reel.position.set(0, 0.06, 0.05);
  reel.add(mesh(cylinder(0.045, 0.045, 0.035, 16), toon('#ffcf3f'), 0, 0, 0, 1, 1, 1));
  reel.children[0].rotation.z = Math.PI / 2;
  reel.add(mesh(cylinder(0.008, 0.008, 0.06, 8), toon('#3a3a48'), 0.045, 0, 0));
  reel.children[1].rotation.z = Math.PI / 2;
  reel.add(mesh(sphere(0.014, 8, 6), toon('#ff7fb2'), 0.078, -0.02, 0));
  g.add(reel);
  for (const y of [0.45, 0.8, 1.1]) {
    const ring = mesh(torus(0.018, 0.004), toon('#d8dde8'), 0, y, 0.022);
    g.add(ring);
  }
  const tip = new THREE.Object3D();
  tip.name = 'tip';
  tip.position.y = ROD_LEN;
  g.add(tip);
  return g;
}

// How many points the line sags through, from the rod's tip to the bobber.
const POINTS = 14;

// A line out on the water: the bobber (red over white, bobbing on the
// ripples, dipping under when a fish bites) and the line from the rod's tip
// down to it, sagging a little. Lives in the scene till dispose().
export class FishingLine {
  constructor(scene, at) {
    this.scene = scene;
    this.at = new THREE.Vector3(at.x + 0.5, at.y + 0.92, at.z + 0.5);
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
    this.ring.position.copy(this.at).setY(this.at.y - 0.02);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3));
    this.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.9 }));
    this.line.frustumCulled = false;
    this.line.name = 'fishing line';
    // Flying out from the rod to the water, when cast, for this long.
    this.flight = 0.45;
    this.age = 0;
    scene.add(this.bobber, this.ring, this.line);
  }

  // Each frame: the tip of the rod in the world (or null to keep the line
  // where it was), the time in seconds, and whether a fish has the bobber.
  update(tip, dt, t, biting) {
    this.age += dt;
    const fly = Math.min(1, this.age / this.flight);
    const b = this.bobber.position;
    if (fly < 1 && tip) {
      // Out in an arc from the rod's tip to where it lands.
      b.lerpVectors(tip, this.at, fly);
      b.y += Math.sin(fly * Math.PI) * 1.4;
    } else {
      b.copy(this.at);
      b.y += biting ? -0.16 - Math.abs(Math.sin(t * 22)) * 0.06 : Math.sin(t * 2.4) * 0.025;
      b.x += biting ? Math.sin(t * 17) * 0.04 : 0;
    }
    this.ring.visible = fly >= 1;
    const ring = biting ? 1.2 + ((t * 3) % 1) * 1.2 : 1 + ((t * 0.6) % 1) * 0.6;
    this.ring.scale.set(ring, ring, ring);
    this.ring.material.opacity = biting ? 0.7 : 0.35;
    if (!tip) return;
    const pos = this.line.geometry.attributes.position;
    const sag = biting ? 0.05 : 0.35 * fly;
    for (let i = 0; i < POINTS; i++) {
      const u = i / (POINTS - 1);
      pos.setXYZ(i, tip.x + (b.x - tip.x) * u, tip.y + (b.y + 0.1 - tip.y) * u - Math.sin(u * Math.PI) * sag, tip.z + (b.z - tip.z) * u);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.bobber, this.ring, this.line);
    this.line.geometry.dispose();
    this.line.material.dispose();
  }
}
