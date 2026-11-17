// Things on the Wild Isle that are drawn as real models rather than from
// their blocks (render/real.js): its landmarks — a lighthouse of whitewashed
// stone, round and tapering, with its lantern room and gallery — whose
// blocks are only there to bump into, and the camps' flags: cloth on a
// wooden pole, the fog's grey flag and the island's own green one with the
// sun on it.
import * as THREE from '../../vendor/three.module.js';
import { layerTextures } from './real-plants.js';
import { MAT } from './real-textures.js';

// ---------------------------------------------------------------- the flags

const POLE = { camp: 4.8, castle: 7.4 };
const CLOTH = { camp: [1.7, 1.1], castle: [2.6, 1.7] };

function clothTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 168;
  const g = c.getContext('2d');
  const grump = kind === 'grump';
  g.fillStyle = grump ? '#3c3d42' : '#2f6b3a';
  g.fillRect(0, 0, 256, 168);
  // The weave and the weather on it.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${grump ? '255,255,255' : '255,255,220'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 168, 1 + Math.random() * 3, 1);
  }
  for (let y = 0; y < 168; y += 3) {
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(0, y, 256, 1);
  }
  if (grump) {
    // A swirl of fog, and a grey wolf's head howling in it.
    g.strokeStyle = 'rgba(190,192,200,0.75)';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    for (let t = 0; t < 14; t += 0.1) {
      const r = 8 + t * 4.4;
      const x = 128 + Math.cos(t) * r;
      const y = 84 + Math.sin(t) * r * 0.7;
      if (t) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#1d1e22';
    g.beginPath();
    g.moveTo(96, 132);
    g.lineTo(104, 92);
    g.lineTo(96, 58);
    g.lineTo(112, 74);
    g.lineTo(128, 70);
    g.lineTo(150, 38);
    g.lineTo(158, 50);
    g.lineTo(150, 78);
    g.lineTo(162, 100);
    g.lineTo(150, 108);
    g.lineTo(140, 132);
    g.closePath();
    g.fill();
  } else {
    // The sun the Sunstones bring back.
    g.fillStyle = '#f5c542';
    g.beginPath();
    g.arc(128, 84, 30, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f5c542';
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 40, 84 + Math.sin(a) * 40);
      g.lineTo(128 + Math.cos(a) * 58, 84 + Math.sin(a) * 58);
      g.stroke();
    }
  }
  // Frayed at the fly end.
  g.clearRect(250, 0, 6, 168);
  for (let y = 0; y < 168; y += 6) g.clearRect(244 + Math.random() * 8, y, 12, 4 + Math.random() * 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let flagMats = null;
function flagMaterials(gl) {
  if (flagMats) return flagMats;
  const pole = layerTextures(gl, MAT.bark);
  flagMats = {
    grump: new THREE.MeshStandardMaterial({ map: clothTexture('grump'), side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.4 }),
    sun: new THREE.MeshStandardMaterial({ map: clothTexture('sun'), side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.4 }),
    pole: new THREE.MeshStandardMaterial({ map: pole.map, normalMap: pole.normalMap, color: 0xc8b8a0, roughness: 0.85 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xcdbb94, roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.5, metalness: 0.7 }),
  };
  return flagMats;
}

// A cloth hung from the pole by its edge, rippling in the wind.
class Cloth {
  constructor(material, w, h) {
    this.w = w;
    this.h = h;
    this.geometry = new THREE.PlaneGeometry(w, h, 16, 8);
    this.geometry.translate(w / 2 + 0.06, 0, 0);
    this.rest = this.geometry.attributes.position.array.slice();
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.phase = Math.random() * 10;
  }

  wave(t) {
    const a = this.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = this.rest[i];
      const y = this.rest[i + 1];
      const k = x / this.w;
      a[i + 2] = (Math.sin(t * 3.1 + this.phase - x * 2.2 + y * 0.6) * 0.14 + Math.sin(t * 5.3 - x * 4.1) * 0.04) * k;
      a[i] = x - k * k * 0.06 * (1 + Math.sin(t * 2 + this.phase));
      a[i + 1] = y - k * k * 0.1;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

// A camp's flag (render/adventure-models.js FlagModel, real): the fog's
// grey flag at the top at first, the island's own at the foot of the pole;
// raised (progress, 0 to 1) the one comes down as the other goes up.
export class RealFlagModel {
  constructor(gl, kind = 'camp') {
    const castle = kind === 'castle';
    const [w, h] = CLOTH[castle ? 'castle' : 'camp'];
    this.pole = POLE[castle ? 'castle' : 'camp'];
    this.clothHeight = h;
    const mats = flagMaterials(gl);
    this.group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, this.pole, 10), mats.pole);
    pole.position.y = this.pole / 2;
    pole.castShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mats.iron);
    knob.position.y = this.pole + 0.06;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, this.pole - 0.3, 4), mats.rope);
    rope.position.set(0.1, this.pole / 2, 0);
    this.group.add(pole, knob, rope);
    this.geometries = [pole.geometry, knob.geometry, rope.geometry];
    this.grump = new Cloth(mats.grump, w, h);
    this.sun = new Cloth(mats.sun, w, h);
    this.group.add(this.grump.mesh, this.sun.mesh);
    this.time = Math.random() * 10;
    this.shown = 0;
    this.update(0, 0, false);
  }

  get top() {
    return this.pole + 0.3;
  }

  update(dt, progress, freed) {
    this.time += dt;
    const want = freed ? 1 : Math.max(0, Math.min(1, progress));
    this.shown += (want - this.shown) * Math.min(1, dt * 6);
    if (Math.abs(want - this.shown) < 0.002) this.shown = want;
    const high = this.pole - 0.12 - this.clothHeight / 2;
    const low = 0.5 + this.clothHeight / 2;
    this.grump.mesh.position.y = high - (high - low) * this.shown;
    this.sun.mesh.position.y = low + (high - low) * this.shown;
    this.grump.mesh.visible = !freed && this.shown < 0.999;
    this.sun.mesh.visible = freed || this.shown > 0.001;
    this.grump.wave(this.time);
    this.sun.wave(this.time + 1.3);
  }

  dispose() {
    this.group.removeFromParent();
    this.grump.geometry.dispose();
    this.sun.geometry.dispose();
    for (const g of this.geometries) g.dispose();
  }
}

// ---------------------------------------------------------------- landmarks

// A lighthouse round (0, 0, 0), the middle of its foot: whitewashed stone
// tapering up `tall` blocks, two red bands, a door and little windows, a
// gallery with a railing, the lantern room of glass with its light, and a
// red dome. Its blocks (isle-wild.js lighthouse) stand inside it.
export function lighthouseModel(gl, tall = 13) {
  const group = new THREE.Group();
  const plaster = layerTextures(gl, MAT.plaster);
  const white = new THREE.MeshStandardMaterial({ map: plaster.map, normalMap: plaster.normalMap, roughness: 0.92 });
  const red = new THREE.MeshStandardMaterial({ map: plaster.map, normalMap: plaster.normalMap, color: 0xb8302a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.6, metalness: 0.3 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.45, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xdff2ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 2.5 });
  const stone = layerTextures(gl, MAT.masonry);
  const base = new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normalMap, roughness: 0.95 });
  const geos = [];
  const add = (geo, mat, x, y, z, shadow = true) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const r0 = 3.25;
  const r1 = 2.05;
  const rAt = (y) => r0 + (r1 - r0) * (y / tall);
  // A stone footing, then the tower in bands.
  const foot = new THREE.CylinderGeometry(r0 + 0.35, r0 + 0.5, 1.6, 40, 1);
  scaleUv(foot, 6, 1);
  add(foot, base, 0, -0.5, 0);
  const bands = [[0.3, 6.6, white], [6.6, 8.6, red], [8.6, tall, white]];
  for (const [a, b, mat] of bands) {
    const g = new THREE.CylinderGeometry(rAt(b), rAt(a), b - a, 48, 4);
    scaleUv(g, 5, (b - a) / 3);
    add(g, mat, 0, (a + b) / 2, 0);
  }
  // A door facing the way it is turned (its +z), and windows up the tower.
  add(new THREE.BoxGeometry(1.1, 2.1, 0.3), dark, 0, 1.35, rAt(1.3) - 0.05);
  for (const [y, a] of [[4.2, 0.3], [7.4, 2.4], [10.5, 4.2], [10.5, 1.2]]) {
    const r = rAt(y) - 0.04;
    add(new THREE.BoxGeometry(0.5, 0.8, 0.3), dark, Math.sin(a) * r, y, Math.cos(a) * r).rotation.y = a;
  }
  // The gallery: a ledge all round, a railing.
  add(new THREE.CylinderGeometry(r1 + 0.75, r1 + 0.75, 0.25, 40), iron, 0, tall + 0.12, 0);
  const rail = new THREE.TorusGeometry(r1 + 0.7, 0.04, 6, 48);
  rail.rotateX(Math.PI / 2);
  add(rail, iron, 0, tall + 1.05, 0, false);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), iron, Math.cos(a) * (r1 + 0.7), tall + 0.6, Math.sin(a) * (r1 + 0.7), false);
  }
  // The lantern room: glass in an iron frame, the light inside it, a dome.
  add(new THREE.CylinderGeometry(1.25, 1.25, 0.35, 24), iron, 0, tall + 0.42, 0);
  add(new THREE.CylinderGeometry(1.15, 1.15, 2.0, 16, 1, true), glass, 0, tall + 1.6, 0, false);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.08, 2.0, 0.08), iron, Math.cos(a) * 1.15, tall + 1.6, Math.sin(a) * 1.15);
  }
  add(new THREE.SphereGeometry(0.5, 16, 12), lamp, 0, tall + 1.55, 0, false);
  const dome = new THREE.SphereGeometry(1.35, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  add(dome, red, 0, tall + 2.6, 0);
  add(new THREE.CylinderGeometry(0.05, 0.12, 0.7, 8), iron, 0, tall + 4.2, 0);
  add(new THREE.SphereGeometry(0.13, 10, 8), iron, 0, tall + 4.6, 0);
  group.userData.dispose = () => {
    for (const g of geos) g.dispose();
    for (const m of [white, red, dark, iron, glass, lamp, base]) m.dispose();
  };
  group.userData.lamp = lamp;
  return group;
}

function scaleUv(geo, u, v) {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
}
