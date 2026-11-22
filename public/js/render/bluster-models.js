// Toon Isle's own monsters (shared/isle-battles.js): Baron Bluster, who has
// pulled his Cloud Blanket over the island, and the Storm Nests his Storm
// Gang hatches out of.
import * as THREE from '../../vendor/three.module.js';
import { Beast, crossEye, DARK, group } from './beast-kit.js';
import { CloudModel } from './captain-models.js';
import { cylinder, mesh, sphere, toon, torus, toyMaterial } from './toon.js';

// Baron Bluster: a puffed-up storm cloud, as Old Nimbus is, but a baron —
// a tall black top hat with a purple band, a gold monocle over one eye and a
// grand curly moustache, his cloud a stormy lilac.
export class BlusterModel extends CloudModel {
  constructor() {
    super();
    // A stormier cloud: every white puff lilac. (Not too pale: Toon Isle's
    // light is bright, and anything much paler is lit past white and glows,
    // render/renderer.js buildFinish.)
    this.recolour([
      [toon('#f3f6fb'), toon('#d2c6ee')],
      [toon('#9aa5b8'), toon('#9b8fc4')],
    ]);
    const f = this.float;
    const black = toon('#2a2433');
    const band = toon('#8c5bd6');
    const gold = toon('#ffcf4a');
    // The top hat, tipped a little to one side: black silk with a soft sheen
    // (as glossy as toys' little black parts are, it would shine like
    // chrome, toon.js finish).
    const hat = group(f, 0.15, 2.45, -0.05);
    hat.rotation.z = -0.18;
    const silk = toyMaterial({ color: '#2a2433', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.45 });
    hat.add(mesh(cylinder(0.78, 0.78, 0.08, 24), silk, 0, 0.04, 0));
    hat.add(mesh(cylinder(0.5, 0.55, 1.0, 22), silk, 0, 0.55, 0));
    hat.add(mesh(cylinder(0.56, 0.56, 0.2, 22), band, 0, 0.2, 0));
    this.hat = hat;
    // The monocle over his right eye, on a gold chain.
    const monocle = group(f, 0.32, 1.65, 0.92);
    monocle.add(mesh(torus(0.2, 0.035), gold, 0, 0, 0));
    monocle.add(mesh(cylinder(0.19, 0.19, 0.01, 16), toon('#cfefff', { transparent: true, opacity: 0.45 }), 0, 0, 0, 1, 1, 1));
    monocle.children[1].rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) monocle.add(mesh(sphere(1, 6, 4), gold, 0.18 + i * 0.05, -0.2 - i * 0.12, -0.04 - i * 0.02, 0.025));
    // A grand curly moustache.
    this.tache = group(f, 0, 1.38, 0.9);
    for (const side of [-1, 1]) {
      const arm = mesh(torus(0.17, 0.06, Math.PI * 1.3), black, side * 0.2, 0, 0);
      arm.rotation.z = side > 0 ? -0.4 : Math.PI + 0.4;
      arm.rotation.y = side * 0.25;
      this.tache.add(arm);
      this.tache.add(mesh(sphere(1, 10, 8), black, side * 0.36, 0.08, -0.02, 0.07));
    }
  }

  // His puffs' materials swapped, each [from, to]. (By material, not by
  // colour: a colour's numbers are kept linear, not as written.)
  recolour(pairs) {
    const swap = new Map(pairs);
    this.float.traverse((o) => {
      if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material);
    });
  }

  // The storm all blown out of him, at the end of Toon Isle's story: a
  // little white cloud (still not too pale to show his face).
  calm() {
    this.recolour([
      [toon('#d2c6ee'), toon('#dde1ea')],
      [toon('#9b8fc4'), toon('#9aa5b8')],
    ]);
  }

  update(dt, state, air = 0, night = false) {
    super.update(dt, state, air, night);
    const t = this.time;
    // His hat bounces as he laughs, his moustache twitches when he is cross.
    this.hat.position.y = 2.45 + (state === 'giggle' || state === 'idle' ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);
    this.tache.rotation.z = Math.sin(t * (state === 'chase' ? 14 : 3)) * 0.06;
  }
}

// A Storm Nest: a heap of twigs with a grumpy little thundercloud squatting
// in it, crackling, swelling up and wobbling as something hatches out of it.
export class NestModel extends Beast {
  constructor() {
    super({ height: 1.5, center: 0.8, pick: 0.9, radius: 0.95, glow: '#fff27a', white: '#ffffff' });
    const twig = toon('#8a5a3c');
    const twig2 = toon('#6d4630');
    const cloud = toon('#7a6fa3');
    const dark = toon('#55497d');
    const b = this.body;
    // The twigs, round and round.
    for (let i = 0; i < 3; i++) {
      const ring = mesh(torus(0.82 - i * 0.08, 0.13, Math.PI * 2), i % 2 ? twig2 : twig, 0, 0.18 + i * 0.12, 0);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.08;
      ring.rotation.y = i * 0.7;
      b.add(ring);
    }
    // The cloud in it.
    this.puff = group(b, 0, 0, 0);
    for (const [x, y, z, r, m] of [[0, 0.85, 0, 0.62, cloud], [-0.42, 0.7, 0.1, 0.42, cloud], [0.42, 0.7, 0.1, 0.42, cloud], [0, 1.2, -0.1, 0.42, cloud], [0, 0.55, -0.2, 0.5, dark]]) this.puff.add(mesh(sphere(1, 16, 12), m, x, y, z, r));
    crossEye(this, this.puff, -1, -0.2, 0.92, 0.55, { w: 0.1, slope: 0.6 });
    crossEye(this, this.puff, 1, 0.2, 0.92, 0.55, { w: 0.1, slope: 0.6 });
    this.mouth = mesh(sphere(1, 10, 8), toon(DARK), 0, 0.72, 0.6, 0.12, 0.03, 0.04);
    this.puff.add(this.mouth);
    // A spark of lightning crackling over it.
    this.zap = new THREE.Group();
    const yellow = toon('#ffe14d', { emissive: 1 });
    for (const [x0, y0, x1, y1] of [[0, 0, 0.1, 0.18], [0.1, 0.18, -0.04, 0.26], [-0.04, 0.26, 0.08, 0.45]]) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const seg = mesh(cylinder(0.03, 0.03, len, 6), yellow, (x0 + x1) / 2, (y0 + y1) / 2, 0);
      seg.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
      this.zap.add(seg);
    }
    this.zap.position.set(0.25, 1.45, 0);
    b.add(this.zap);
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    // Breathing; and now and then a shiver, as something stirs inside.
    const shiver = Math.sin(t * 0.9) > 0.85 ? Math.sin(t * 40) * 0.05 : 0;
    const s = 1 + Math.sin(t * 2.2) * 0.04;
    this.puff.scale.set(s + shiver, 1 / s, s - shiver);
    this.zap.visible = Math.sin(t * 7) > 0.3;
    this.zap.rotation.y = t * 3;
    this.mood(state, night);
  }

  mouthAt() {
    return this.mouth.getWorldPosition(new THREE.Vector3());
  }
}
