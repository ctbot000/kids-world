// What an adventure island (shared/adventure.js) adds to the picture: each
// camp's flag pole, with the monsters' grumpy purple flag coming down it as
// the island's own sky-blue star flag goes up; King Grumble, a big jelly
// blob with a crown, in his bubble until every camp is free, with a ring on
// the ground round him as he crouches to stomp; and the ring of a stomp
// rushing out over the ground.
import * as THREE from '../../vendor/three.module.js';
import { cone, cylinder, mesh, sphere, toon } from './toon.js';
import { MonsterModel } from './monster-model.js';

// The flags, drawn once: [width, height] of the cloth by the kind of camp.
const CLOTH = { camp: [1.5, 1], castle: [2.4, 1.6] };
const POLE = { camp: 4.6, castle: 7.2 };

function flagTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'grump') {
    // The monsters' flag: purple, with their cross face.
    ctx.fillStyle = '#7b4fd0';
    ctx.fillRect(0, 0, 192, 128);
    ctx.fillStyle = '#5b33a8';
    ctx.fillRect(0, 112, 192, 16);
    for (const side of [-1, 1]) {
      const x = 96 + side * 30;
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.ellipse(x, 56, 15, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2530';
      ctx.beginPath();
      ctx.ellipse(x - side * 3, 59, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, 32);
      ctx.rotate(side * -0.45);
      ctx.fillRect(-18, -5, 36, 10);
      ctx.restore();
    }
    ctx.strokeStyle = '#2b2530';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(96, 110, 26, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else {
    // The island's own: sky blue, with a big yellow star.
    ctx.fillStyle = '#5cc3f2';
    ctx.fillRect(0, 0, 192, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 192, 10);
    ctx.fillRect(0, 118, 192, 10);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 46 : 19;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(96 + Math.cos(a) * r, 66 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8a910';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let textures = null;
const flagMaterials = () => {
  textures ??= {
    grump: new THREE.MeshLambertMaterial({ map: flagTexture('grump'), side: THREE.DoubleSide }),
    star: new THREE.MeshLambertMaterial({ map: flagTexture('star'), side: THREE.DoubleSide }),
  };
  return textures;
};

// A cloth hanging from a pole by its left edge, which waves.
class Cloth {
  constructor(material, w, h) {
    this.w = w;
    this.h = h;
    this.geometry = new THREE.PlaneGeometry(w, h, 10, 2);
    this.geometry.translate(w / 2, 0, 0);
    this.rest = this.geometry.attributes.position.array.slice();
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.phase = Math.random() * 10;
  }

  wave(t) {
    const pos = this.geometry.attributes.position;
    const a = pos.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = this.rest[i];
      const k = x / this.w;
      a[i + 2] = Math.sin(t * 4 + this.phase - x * 2.6) * 0.16 * k;
      a[i + 1] = this.rest[i + 1] - k * k * 0.08;
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

// A camp's flag pole: the grumpy flag at the top and the star flag at the
// bottom at first; as the flag is raised (progress, 0 to 1) the one comes
// down and the other goes up, and a camp freed flies the star flag alone.
export class FlagModel {
  constructor(kind = 'camp') {
    const castle = kind === 'castle';
    const [w, h] = CLOTH[castle ? 'castle' : 'camp'];
    this.pole = POLE[castle ? 'castle' : 'camp'];
    this.clothHeight = h;
    this.group = new THREE.Group();
    this.group.add(mesh(cylinder(0.07, 0.08, this.pole, 10), toon('#f4f1ea'), 0, this.pole / 2, 0));
    this.group.add(mesh(sphere(1, 12, 8), toon('#ffd23f', { emissive: 0.25 }), 0, this.pole + 0.08, 0, 0.14));
    const mats = flagMaterials();
    this.grump = new Cloth(mats.grump, w, h);
    this.star = new Cloth(mats.star, w, h);
    this.group.add(this.grump.mesh, this.star.mesh);
    this.time = Math.random() * 10;
    this.shown = 0;
    this.update(0, 0, false);
  }

  // How high the top of the flag's cloth can go, over the ground.
  get top() {
    return this.pole + 0.3;
  }

  update(dt, progress, freed) {
    this.time += dt;
    // Smoothly to where the island says, a few times a second.
    const want = freed ? 1 : Math.max(0, Math.min(1, progress));
    this.shown += (want - this.shown) * Math.min(1, dt * 6);
    if (Math.abs(want - this.shown) < 0.002) this.shown = want;
    const high = this.pole - 0.1 - this.clothHeight / 2;
    const low = 0.4 + this.clothHeight / 2;
    this.grump.mesh.position.y = high - (high - low) * this.shown;
    this.star.mesh.position.y = low + (high - low) * this.shown;
    this.grump.mesh.visible = !freed && this.shown < 0.999;
    this.star.mesh.visible = freed || this.shown > 0.001;
    this.grump.wave(this.time);
    this.star.wave(this.time + 1.3);
  }

  dispose() {
    this.group.removeFromParent();
    this.grump.geometry.dispose();
    this.star.geometry.dispose();
  }
}

// How much bigger King Grumble is than a monster, side to side and up.
const KING_SCALE = [2.3, 2.5];

// King Grumble: a monster blob grown big, with a golden crown, in a bubble
// while any camp is not free, and a ring on the ground as far as his stomp
// reaches while he crouches for one.
export class KingModel extends MonsterModel {
  constructor(theme, reach) {
    super(theme);
    // The blob, grown: it still squashes and stretches inside its holder.
    const holder = new THREE.Group();
    this.group.remove(this.body);
    holder.add(this.body);
    holder.scale.set(KING_SCALE[0], KING_SCALE[1], KING_SCALE[0]);
    this.group.add(holder);
    const gold = toon('#ffcc33', { emissive: 0.25 });
    const crown = new THREE.Group();
    crown.position.y = 0.7;
    crown.add(mesh(cylinder(0.17, 0.19, 0.1, 16), gold, 0, 0.03, 0));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      crown.add(mesh(cone(0.05, 0.13, 6), gold, Math.sin(a) * 0.16, 0.14, Math.cos(a) * 0.16));
      crown.add(mesh(sphere(1, 8, 6), toon(['#ff4f6f', '#4fa8ff', '#7fe08c', '#ffd84d', '#c78cff'][k], { emissive: 0.3 }), Math.sin(a) * 0.185, 0.04, Math.cos(a) * 0.185, 0.025));
    }
    this.body.add(crown);
    this.crown = crown;
    this.bubble = mesh(sphere(1, 28, 20), new THREE.MeshBasicMaterial({ color: '#cdeeff', transparent: true, opacity: 0.22, depthWrite: false }), 0, 0.95, 0, 1.55);
    this.bubbleRim = mesh(sphere(1, 28, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.BackSide }), 0, 0.95, 0, 1.6);
    this.group.add(this.bubble, this.bubbleRim);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(reach - 0.35, reach, 56), new THREE.MeshBasicMaterial({ color: '#ff6a3d', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.ring.renderOrder = 2;
    this.group.add(this.ring);
    this.height = 1.8;
    this.center = 0.9;
    this.pick = 1.15;
    this.seen = 140;
    this.shadowScale = 2.4;
    this.bounce = 0;
  }

  // His bubble shaking off a bop.
  bubbleBounce() {
    this.bounce = 0.6;
  }

  update(dt, state, air = 0, night = false, shielded = false) {
    super.update(dt, state, air, night);
    const t = this.time;
    this.bounce = Math.max(0, this.bounce - dt);
    const wobble = 1 + Math.sin(t * 2.2) * 0.025 + Math.sin(this.bounce * 18) * this.bounce * 0.12;
    this.bubble.visible = shielded;
    this.bubbleRim.visible = shielded;
    this.bubble.scale.setScalar(1.55 * wobble);
    this.bubbleRim.scale.setScalar(1.6 * wobble);
    this.ring.visible = state === 'stomp' && air < 0.1;
    this.ring.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * 9));
    // Crouched to stomp: down low, shaking.
    if (state === 'stomp') {
      this.body.scale.y *= 0.72;
      this.body.rotation.z = Math.sin(t * 30) * 0.05;
    }
    this.crown.rotation.z = Math.sin(t * 3) * 0.06;
  }

  dispose() {
    super.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}

// The ring of a stomp rushing out over the ground from where he landed.
export class Shockwave {
  constructor(scene, x, y, z, reach) {
    this.reach = reach;
    this.age = 0;
    this.life = 0.55;
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 56), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, y + 0.08, z);
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }

  // Returns false once it is over.
  update(dt) {
    this.age += dt;
    const k = Math.min(1, this.age / this.life);
    this.mesh.scale.setScalar(0.5 + (this.reach - 0.5) * (1 - (1 - k) ** 2));
    this.mesh.material.opacity = 0.8 * (1 - k);
    if (k < 1) return true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    return false;
  }
}
