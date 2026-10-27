// A tornado: a grey funnel of swirling wind, narrow at the ground and wide
// up in the clouds, its rings swaying so it bends as it wanders, with a
// cloud of dust round its foot and bits of grass, dirt and leaves whirling
// up it. Where it is comes from the game (shared/env.js tornadoAt).
import * as THREE from '../../vendor/three.module.js';
import { TORNADO_HEIGHT } from '../shared/env.js';

const RINGS = 14;
const BITS = 48;

// Soft streaks of wind going round and up, to wrap round the funnel.
function windTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  for (let i = 0; i < 26; i++) {
    const y = (i * 37) % 64;
    const x = (i * 53) % 128;
    const a = 0.25 + ((i * 7) % 10) / 20;
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = 2 + (i % 4) * 2;
    g.lineCap = 'round';
    // Each streak slants a little, drawn twice so it wraps round the edge.
    for (const dx of [0, -128, 128]) {
      g.beginPath();
      g.moveTo(x + dx, y);
      g.lineTo(x + dx + 40 + (i % 5) * 10, y - 6);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// How wide the funnel is k of the way up (0 at the ground, 1 at the top).
const radiusAt = (k) => 0.7 + 7.5 * k * k + 1.2 * k;

export class Tornado {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.alpha = 0;
    scene.add(this.group);
    const tex = windTexture();
    // Two skins, one inside the other, turning at speeds of their own.
    this.skins = [0, 1].map((n) => {
      const map = tex.clone();
      map.needsUpdate = true;
      map.repeat.set(n ? 3 : 2, n ? 2 : 1.5);
      return new THREE.MeshBasicMaterial({ color: n ? 0xb9c2cc : 0x8a939e, map, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    });
    this.body = new THREE.MeshBasicMaterial({ color: 0x737c88, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.rings = [];
    const h = TORNADO_HEIGHT / RINGS;
    for (let i = 0; i < RINGS; i++) {
      const k0 = i / RINGS;
      const k1 = (i + 1) / RINGS;
      const ring = new THREE.Group();
      ring.position.y = i * h;
      for (const [m, grow] of [[this.body, 0.82], [this.skins[0], 1], [this.skins[1], 1.12]]) {
        const geo = new THREE.CylinderGeometry(radiusAt(k1) * grow, radiusAt(k0) * grow, h * 1.08, 28, 1, true);
        geo.translate(0, h / 2, 0);
        const mesh = new THREE.Mesh(geo, m);
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        ring.add(mesh);
      }
      this.group.add(ring);
      this.rings.push(ring);
    }
    // Dust kicked up round its foot.
    const dustGeo = new THREE.TorusGeometry(2.4, 1.1, 8, 24);
    dustGeo.rotateX(Math.PI / 2);
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xa08a6a, transparent: true, opacity: 0, depthWrite: false });
    this.dust = new THREE.Mesh(dustGeo, this.dustMat);
    this.dust.position.y = 0.6;
    this.group.add(this.dust);
    // Bits of the island whirling up it.
    this.bitMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0 });
    this.bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), this.bitMat, BITS);
    this.bits.frustumCulled = false;
    const colors = ['#5aa83c', '#7a5534', '#3f8a2e', '#9a7a52', '#c9b27a'].map((c) => new THREE.Color(c));
    for (let i = 0; i < BITS; i++) this.bits.setColorAt(i, colors[i % colors.length]);
    this.group.add(this.bits);
    this.tmp = new THREE.Object3D();
  }

  // at: { x, y, z } of its foot, or null when there is none; day: 0 to 1.
  update(dt, time, at, day = 1) {
    const want = at ? 1 : 0;
    this.alpha += (want - this.alpha) * Math.min(1, dt * 0.8);
    if (!at && this.alpha < 0.01) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    if (at) this.group.position.set(at.x, at.y, at.z);
    // It grows up out of the ground as it comes, and shrinks back as it goes.
    this.group.scale.set(1, 0.3 + 0.7 * this.alpha, 1);
    const a = this.alpha;
    const shade = 0.45 + 0.55 * day;
    this.skins[0].opacity = 0.85 * a;
    this.skins[1].opacity = 0.45 * a;
    this.body.opacity = 0.7 * a;
    this.dustMat.opacity = 0.5 * a;
    this.bitMat.opacity = a;
    for (const m of [...this.skins, this.body]) m.color.setScalar(shade).multiply(m === this.body ? DARK : m === this.skins[0] ? MID : LIGHT);
    this.skins[0].map.offset.set(-time * 1.6, -time * 0.5);
    this.skins[1].map.offset.set(-time * 2.6, -time * 0.9);
    // Each ring sways a little more than the one below it, so the funnel bends.
    this.rings.forEach((ring, i) => {
      const k = i / RINGS;
      const sway = k * k * 3.2;
      ring.position.x = Math.sin(time * 0.9 + k * 2.2) * sway;
      ring.position.z = Math.cos(time * 0.7 + k * 1.7) * sway;
      ring.rotation.y = -time * (3 - k);
    });
    this.dust.rotation.y = -time * 2;
    this.dust.scale.setScalar(1 + 0.12 * Math.sin(time * 5));
    // The bits go round and up, and round again from the bottom.
    for (let i = 0; i < BITS; i++) {
      const k = (i / BITS + time * (0.08 + (i % 5) * 0.012)) % 1;
      const r = radiusAt(k) * (0.9 + (i % 3) * 0.12);
      const ang = -time * (5 - 3 * k) + i * 2.39;
      const t = this.tmp;
      const sway = k * k * 3.2;
      t.position.set(Math.cos(ang) * r + Math.sin(time * 0.9 + k * 2.2) * sway, k * TORNADO_HEIGHT, Math.sin(ang) * r + Math.cos(time * 0.7 + k * 1.7) * sway);
      t.rotation.set(time * 3 + i, time * 2 + i, 0);
      t.scale.setScalar(0.6 + (i % 4) * 0.35);
      t.updateMatrix();
      this.bits.setMatrixAt(i, t.matrix);
    }
    this.bits.instanceMatrix.needsUpdate = true;
  }
}

const DARK = new THREE.Color(0x737c88);
const MID = new THREE.Color(0x8a939e);
const LIGHT = new THREE.Color(0xb9c2cc);
