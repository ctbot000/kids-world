// The Wild Isle's animals (render/real.js), as real animals rather than
// toys: the monsters of its camps and its bosses, each one made grumpy by
// Old Murk's fog. The furry ones are made as the real dogs are
// (dog-model.js: one sculpted skin over bones, fur on it, legs that bend
// where they should), each a breed of its own — a grey wolf, a red fox, a
// wild boar with its tusks, a brown bear, a beaver with its flat tail and
// orange teeth, a mountain ram with its curling horns, and Old Murk, a wolf
// as big as a pony with eyes like lamps. A crab is shell and jointed legs.
//
// Each is a monster's model as game.js drives it (render/beast-kit.js Beast):
// group, shadow, update(dt, state, air, night, shielded), and so on.
import * as THREE from '../../vendor/three.module.js';
import { addBossParts, bossPose, disposeBossParts } from './boss-models.js';
import { chestPatch, crest, defineBreed, DOUBLE, earsOf, legsBelow, saddle, SHORT, snout, tailTip, under } from './dog-breeds.js';
import { DogRig } from './dog-model.js';
import { blobShadow } from './toon.js';
import { smooth as ss } from './dog-sculpt.js';

// ---------------------------------------------------------------- breeds

const wolfCoat = (base, pale, dark) => ({
  palette: [base, pale, dark],
  dither: 0.85,
  eye: '#c8952f',
  rim: '#1b1614',
  nose: '#1d1817',
  paint(v, set) {
    set(1, under(v, -0.1, -0.75) * 0.85 + v.tag.throat * 0.8 + chestPatch(v) * 0.7 + legsBelow(v, 0.3, 0.12) * 0.55);
    set(1, snout(v, 0.0, 0.25) * 0.55 + (v.tag.cheek + v.tag.chin + v.tag.lip) * 0.6);
    set(2, saddle(v, 0.05) * 0.55 + crest(v, 0.0) * 0.5 + v.tag.tail * ss(0.0, 0.5, v.ny) * 0.4 + tailTip(v, 0.82) * 0.9 + earsOf(v) * 0.35);
  },
});

defineBreed('wild-wolf', {
  size: 0.8,
  len: 1.16,
  elbow: 0.55,
  croup: 0.96,
  chestW: 0.128,
  waistW: 0.1,
  hipW: 0.112,
  tuck: 0.66,
  bone: 1.18,
  paw: 1.12,
  angle: 1.1,
  neck: { len: 0.36, r0: 0.13, r1: 0.094, up: 0.62 },
  head: { len: 0.47, muzzle: 0.5, skullW: 0.118, skullH: 0.09, stop: 0.26, muzzleW: 0.058, muzzleH: 0.056, taper: 0.78, flews: 0.06, noseW: 0.031, cheek: 0.7, eyeX: 0.07, eyeY: 0.024, eyeR: 0.019, eyeOut: 0.5, eyeHigh: 0.5, pitch: 0.22 },
  ear: { type: 'prick', len: 0.13, wide: 0.07, x: 0.7, y: 0.82, z: 0.38, lean: 0.3, back: 0.06, point: 0.32, turn: 0.5 },
  tail: { type: 'saber', len: 0.62, r: 0.05, tipR: 0.024 },
  fur: { ...DOUBLE, body: 0.06, chest: 0.08, neck: 0.1, throat: 0.09, shoulder: 0.05, thigh: 0.055, tail: 0.11, skull: 0.016, cheek: 0.045, armU: 0.02, armL: 0.01, legU: 0.022, legL: 0.009, pants: 0.04, ruff: 0.06, plume: 0.06, lie: 1.2 },
  coats: {
    grey: wolfCoat('#7b766d', '#d8cfbf', '#3b3732'),
    white: wolfCoat('#e9e6df', '#fbfaf6', '#c9c4ba'),
    fog: { ...wolfCoat('#55565b', '#8d8e93', '#232428'), eye: '#ffd76a' },
  },
});

defineBreed('wild-fox', {
  size: 0.42,
  len: 1.22,
  elbow: 0.5,
  chestW: 0.12,
  waistW: 0.095,
  hipW: 0.108,
  tuck: 0.7,
  bone: 0.95,
  paw: 0.9,
  neck: { len: 0.34, r0: 0.11, r1: 0.08, up: 0.75 },
  head: { len: 0.46, muzzle: 0.55, skullW: 0.12, skullH: 0.085, stop: 0.22, muzzleW: 0.048, muzzleH: 0.046, taper: 0.62, flews: 0.04, noseW: 0.026, cheek: 0.78, eyeX: 0.07, eyeY: 0.028, eyeR: 0.02, eyeOut: 0.46, eyeHigh: 0.5, pitch: 0.18 },
  ear: { type: 'prick', len: 0.2, wide: 0.085, x: 0.7, y: 0.86, z: 0.4, lean: 0.24, back: 0.04, point: 0.22, turn: 0.42 },
  tail: { type: 'saber', len: 0.82, r: 0.06, tipR: 0.03 },
  fur: { ...DOUBLE, body: 0.04, chest: 0.05, neck: 0.06, throat: 0.06, thigh: 0.04, tail: 0.15, skull: 0.012, cheek: 0.04, armU: 0.012, armL: 0.006, legU: 0.014, legL: 0.006, plume: 0.09, lie: 1.3 },
  coats: {
    red: {
      palette: ['#b85a22', '#f3ebe0', '#2a1c16'],
      eye: '#c98a2a',
      dither: 0.6,
      paint(v, set) {
        set(1, under(v, -0.05, -0.6) + v.tag.throat + chestPatch(v) + (v.tag.cheek + v.tag.chin + v.tag.lip) * 0.9 + snout(v, 0.3, 0.7) * 0.5);
        set(1, tailTip(v, 0.84));
        set(2, legsBelow(v, 0.36, 0.12) + earsOf(v) * ss(0.2, 0.6, v.earT ?? 0.5) * 0.9);
      },
    },
  },
});

defineBreed('wild-boar', {
  size: 0.74,
  len: 1.32,
  elbow: 0.42,
  croup: 0.88,
  chestW: 0.17,
  waistW: 0.15,
  hipW: 0.14,
  tuck: 0.86,
  rump: 0.78,
  bone: 1.2,
  paw: 0.7,
  neck: { len: 0.2, r0: 0.18, r1: 0.15, up: 0.3, flat: 0.9 },
  head: { len: 0.62, muzzle: 0.6, skullW: 0.12, skullH: 0.12, stop: 0.18, muzzleW: 0.062, muzzleH: 0.07, taper: 0.66, flews: 0.05, noseW: 0.046, noseUp: 0.0, cheek: 0.8, eyeX: 0.078, eyeY: 0.035, eyeR: 0.014, eyeOut: 0.62, eyeHigh: 0.42, pitch: 0.62 },
  ear: { type: 'prick', len: 0.12, wide: 0.07, x: 0.74, y: 0.78, z: 0.3, lean: 0.5, back: 0.2, point: 0.3, turn: 0.6 },
  tail: { type: 'saber', len: 0.3, r: 0.02, tipR: 0.012 },
  fur: { ...SHORT, body: 0.035, chest: 0.03, neck: 0.06, throat: 0.04, skull: 0.02, cheek: 0.03, thigh: 0.025, tail: 0.03, crest: 0.05, lie: 0.8, locks: 0.22 },
  coats: {
    brown: {
      palette: ['#4b3a2e', '#6d5a4a', '#211913'],
      eye: '#24160e',
      nose: '#4a3434',
      dither: 0.9,
      paint(v, set) {
        set(2, saddle(v, -0.2) * 0.6 + crest(v, -0.1) * 0.8 + legsBelow(v, 0.25, 0.08));
        set(1, snout(v, 0.0, 0.4) * 0.5 + under(v) * 0.3);
      },
    },
  },
});

defineBreed('wild-bear', {
  size: 1.55,
  len: 1.2,
  elbow: 0.46,
  croup: 0.98,
  chestW: 0.2,
  waistW: 0.19,
  hipW: 0.19,
  tuck: 0.9,
  rump: 0.92,
  bone: 1.5,
  paw: 1.6,
  angle: 0.75,
  neck: { len: 0.26, r0: 0.17, r1: 0.14, up: 0.5, flat: 0.95 },
  head: { len: 0.46, muzzle: 0.4, skullW: 0.15, skullH: 0.12, stop: 0.32, muzzleW: 0.072, muzzleH: 0.07, taper: 0.8, flews: 0.08, noseW: 0.036, cheek: 0.75, eyeX: 0.078, eyeY: 0.03, eyeR: 0.016, eyeOut: 0.36, eyeHigh: 0.45, pitch: 0.3 },
  ear: { type: 'prick', len: 0.075, wide: 0.075, x: 0.82, y: 0.86, z: 0.3, lean: 0.3, back: 0.0, point: 0.9, turn: 0.4, cup: 3.2 },
  tail: { type: 'saber', len: 0.12, r: 0.03, tipR: 0.022 },
  fur: { ...DOUBLE, body: 0.08, chest: 0.09, neck: 0.11, throat: 0.09, shoulder: 0.09, thigh: 0.08, tail: 0.05, skull: 0.03, cheek: 0.06, armU: 0.05, armL: 0.04, legU: 0.05, legL: 0.04, paw: 0.03, pants: 0.03, ear: 0.03, muzzle: 0.01, lie: 0.9, locks: 0.2 },
  coats: {
    brown: {
      palette: ['#5e3c22', '#8a6340', '#2b1b10'],
      eye: '#2a170b',
      nose: '#1a1310',
      dither: 0.9,
      paint(v, set) {
        set(1, crest(v, 0.0) * 0.45 + saddle(v, 0.2) * 0.3);
        set(2, legsBelow(v, 0.4, 0.15) * 0.8 + snout(v, 0.5, 0.9) * 0.5);
        set(1, snout(v, 0.0, 0.4) * 0.5);
      },
    },
  },
});

defineBreed('wild-beaver', {
  size: 0.95,
  len: 1.55,
  elbow: 0.32,
  croup: 1.04,
  chestW: 0.2,
  waistW: 0.22,
  hipW: 0.22,
  tuck: 0.96,
  rump: 1.0,
  bone: 1.3,
  paw: 1.2,
  neck: { len: 0.18, r0: 0.2, r1: 0.17, up: 0.55, flat: 0.95 },
  head: { len: 0.5, muzzle: 0.34, skullW: 0.16, skullH: 0.13, stop: 0.42, muzzleW: 0.09, muzzleH: 0.08, taper: 0.95, flews: 0.2, noseW: 0.04, cheek: 0.85, eyeX: 0.098, eyeY: 0.05, eyeR: 0.02, eyeOut: 0.62, eyeHigh: 0.55, pitch: 0.18 },
  ear: { type: 'prick', len: 0.05, wide: 0.06, x: 0.82, y: 0.7, z: 0.3, lean: 0.4, back: 0.0, point: 0.95, turn: 0.6, cup: 3.6 },
  tail: { type: 'saber', len: 0.1, r: 0.06, tipR: 0.05 },
  fur: { ...DOUBLE, body: 0.06, chest: 0.06, neck: 0.06, throat: 0.06, thigh: 0.06, tail: 0.01, skull: 0.03, cheek: 0.04, armU: 0.03, armL: 0.02, legU: 0.03, legL: 0.02, paw: 0.006, ear: 0.01, muzzle: 0.012, lie: 1.6, locks: 0.12 },
  coats: {
    brown: {
      palette: ['#6e4a2c', '#8c6646', '#3c2716'],
      eye: '#160d08',
      nose: '#2a1d18',
      dither: 0.8,
      paint(v, set) {
        set(2, legsBelow(v, 0.25, 0.1) + earsOf(v));
        set(1, under(v) * 0.4 + snout(v, 0.0, 0.4) * 0.4);
      },
    },
  },
});

defineBreed('wild-ram', {
  size: 1.25,
  len: 1.12,
  elbow: 0.56,
  croup: 0.98,
  chestW: 0.16,
  waistW: 0.15,
  hipW: 0.15,
  tuck: 0.82,
  bone: 1.0,
  paw: 0.62,
  neck: { len: 0.36, r0: 0.13, r1: 0.1, up: 0.9 },
  head: { len: 0.5, muzzle: 0.5, skullW: 0.1, skullH: 0.1, stop: 0.12, muzzleW: 0.052, muzzleH: 0.06, taper: 0.75, flews: 0.05, noseW: 0.034, cheek: 0.7, eyeX: 0.08, eyeY: 0.03, eyeR: 0.02, eyeOut: 0.72, eyeHigh: 0.45, pitch: 0.75 },
  ear: { type: 'prick', len: 0.1, wide: 0.05, x: 0.9, y: 0.5, z: 0.28, lean: 1.2, back: 0.0, point: 0.4, turn: 0.2 },
  tail: { type: 'saber', len: 0.18, r: 0.04, tipR: 0.03 },
  fur: { ...DOUBLE, body: 0.11, chest: 0.12, neck: 0.1, throat: 0.1, shoulder: 0.1, thigh: 0.1, tail: 0.06, skull: 0.02, cheek: 0.015, muzzle: 0.004, lip: 0.003, chin: 0.004, armU: 0.04, armL: 0.006, legU: 0.04, legL: 0.006, paw: 0.002, ear: 0.006, lie: 0.5, droop: 0.4, locks: 0.3 },
  coats: {
    cream: {
      palette: ['#d9cdb4', '#efe6d2', '#3a2f26'],
      eye: '#b4862e',
      nose: '#3a302a',
      dither: 0.7,
      paint(v, set) {
        set(2, legsBelow(v, 0.32, 0.06) + snout(v, -0.3, 0.1) * 0.6 + v.tag.skull * 0.35 + earsOf(v) * 0.6);
        set(1, saddle(v, 0.1) * 0.5);
      },
    },
  },
});

// ---------------------------------------------------------------- parts

let parts = null;
function partMaterials() {
  parts ??= {
    ivory: new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.4 }),
    snout: new THREE.MeshStandardMaterial({ color: 0x6a5450, roughness: 0.55 }),
    horn: new THREE.MeshStandardMaterial({ color: 0x9c8a6e, roughness: 0.65 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0xd8742a, roughness: 0.35 }),
    paddle: new THREE.MeshStandardMaterial({ map: scaleTexture(), color: 0x6a625c, roughness: 0.75 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffd76a }),
    fog: new THREE.MeshBasicMaterial({ color: 0xc8ccd6, transparent: true, opacity: 0.08, depthWrite: false }),
  };
  return parts;
}

function scaleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5d5550';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 10) {
    for (let x = (y / 10) % 2 ? 5 : 0; x < 128; x += 10) {
      g.fillStyle = `rgba(${30 + Math.random() * 30},${25 + Math.random() * 20},${22 + Math.random() * 20},0.55)`;
      g.beginPath();
      g.ellipse(x + 5, y + 5, 4.5, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

// A tube along a curve (fn(t) for t 0 to 1 gives a point), r0 to r1 thick.
function curveTube(fn, r0, r1, steps = 18, sides = 8) {
  class C extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
      return out.set(...fn(t));
    }
  }
  const g = new THREE.TubeGeometry(new C(), steps, 1, sides, false);
  // Tapered: each ring drawn in towards its middle by how far along it is.
  const p = g.getAttribute('position');
  const ring = sides + 1;
  for (let i = 0; i <= steps; i++) {
    const c = new THREE.Vector3(...fn(i / steps));
    const r = r0 + (r1 - r0) * (i / steps);
    for (let s = 0; s < ring; s++) {
      const k = i * ring + s;
      const v = new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

// The parts a breed has that a dog has not, on its head (in the head's own
// frame: from the back of the skull, forward along +z) and its tail.
function addParts(rig, kind) {
  const s = rig.s;
  const h = s.head;
  const HL = h.len;
  const SL = HL * (1 - h.muzzle);
  const my = -h.skullH * h.stop;
  const m = partMaterials();
  const frame = new THREE.Group();
  frame.rotation.x = h.pitch;
  rig.bones[5].add(frame);
  const geos = [];
  const add = (geo, mat) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    frame.add(mesh);
    return mesh;
  };
  if (kind === 'boar') {
    for (const side of [-1, 1]) {
      add(curveTube((t) => [side * (h.muzzleW * 0.85 + t * 0.045), my - h.muzzleH * 0.5 + t * 0.1, HL * 0.8 - t * 0.02], 0.016, 0.004, 10, 6), m.ivory);
    }
    // Its flat round snout.
    const disc = add(new THREE.CylinderGeometry(h.noseW * 1.35, h.noseW * 1.45, 0.03, 20), m.snout);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, my + h.muzzleH * 0.05, HL + 0.004);
  }
  if (kind === 'gnasher') {
    for (const side of [-1, 1]) {
      const tooth = add(new THREE.BoxGeometry(0.016, 0.045, 0.01), m.teeth);
      tooth.position.set(side * 0.009, my - h.muzzleH * 0.95, HL - 0.012);
    }
    // The flat scaly tail, on the end of its own.
    const paddle = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), m.paddle);
    geos.push(paddle.geometry);
    paddle.scale.set(0.2, 0.035, 0.38);
    paddle.position.set(0, -0.02, -0.3);
    paddle.castShadow = true;
    rig.bones[14].add(paddle);
  }
  if (kind === 'curlhorn') {
    // Great horns curling back, down and round past the ears.
    for (const side of [-1, 1]) {
      // From the top of the skull back, down behind the ear and round
      // forward under it, out from the side of the head as it goes.
      const R0 = 0.16;
      const fn = (t) => {
        const a = t * 1.7 * Math.PI;
        const R = R0 * (1 - t * 0.5);
        return [side * (h.skullW * 0.55 + t * 0.13), h.skullH * 0.55 - R0 + R * Math.cos(a), SL * 0.42 - R * Math.sin(a)];
      };
      add(curveTube(fn, 0.075, 0.018, 32, 12), m.horn);
    }
  }
  if (kind === 'murk') {
    // Eyes like lamps, and fog curling off him.
    for (const side of [-1, 1]) {
      const eye = add(new THREE.SphereGeometry(h.eyeR * 1.15, 10, 8), m.glow);
      eye.position.set(side * h.eyeX, h.eyeY, (h.eyeZ ?? 0.93) * SL + 0.004);
    }
  }
  return geos;
}

// ---------------------------------------------------------------- crabs

// A crab: a broad flat shell, eyes on stalks, two pincers (the right one
// bigger) held up in front, and eight jointed legs splayed out to the sides
// that scuttle; red-brown and mottled on top, pale underneath, wet and shiny.
// giant: a coconut crab's colours, purple and orange.
class CrabRig {
  constructor(size, giant) {
    this.group = new THREE.Group();
    this.size = size;
    const top = giant ? 0x5a2c46 : 0x8e3a22;
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.05, vertexColors: true });
    const legMat = new THREE.MeshStandardMaterial({ color: giant ? 0xb85a2a : 0xa84a28, roughness: 0.42 });
    const clawMat = new THREE.MeshStandardMaterial({ color: giant ? 0x9a3a2e : 0xb0482a, roughness: 0.36 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x1e1412, roughness: 0.3 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.12 });
    this.materials = [shellMat, legMat, clawMat, tipMat, eyeMat];
    this.geos = [];
    const root = new THREE.Group();
    root.scale.setScalar(size);
    this.group.add(root);
    this.root = root;
    // The shell: wide, low, rounded, bumpy at its edges, mottled.
    const shell = new THREE.SphereGeometry(1, 48, 24);
    const p = shell.getAttribute('position');
    const col = [];
    const c0 = new THREE.Color(top);
    const c1 = new THREE.Color(giant ? 0x8a4a3a : 0xc0602e);
    const pale = new THREE.Color(0xe8d2b4);
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const rim = 1 + Math.max(0, Math.sin(Math.atan2(z, x) * 9)) * 0.04 * (1 - Math.abs(y));
      x *= 0.72 * rim;
      z *= 0.52 * rim;
      y = y > 0 ? y * 0.26 : y * 0.14;
      p.setXYZ(i, x, y, z);
      const spots = Math.sin(x * 17) * Math.sin(z * 19) * 0.5 + 0.5;
      tmp.copy(c0).lerp(c1, spots * 0.6);
      if (y < 0) tmp.copy(pale);
      col.push(tmp.r, tmp.g, tmp.b);
    }
    shell.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    shell.computeVertexNormals();
    const body = new THREE.Mesh(this.geo(shell), shellMat);
    body.position.y = 0.34;
    body.castShadow = true;
    root.add(body);
    this.body = body;
    // Eyes on stalks at the front of the shell.
    for (const side of [-1, 1]) {
      this.limb(root, [side * 0.1, 0.4, 0.42], [side * 0.13, 0.54, 0.46], 0.022, 0.02, legMat);
      const eye = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.04, 10, 8)), eyeMat);
      eye.position.set(side * 0.13, 0.56, 0.46);
      root.add(eye);
    }
    // Two pincers, held up in front, the right one bigger.
    this.claws = [];
    for (const side of [-1, 1]) {
      const big = side > 0 ? 1.4 : 1;
      const arm = new THREE.Group();
      arm.position.set(side * 0.42, 0.3, 0.32);
      root.add(arm);
      this.limb(arm, [0, 0, 0], [side * 0.22, 0.08, 0.12], 0.06, 0.055, legMat);
      this.limb(arm, [side * 0.22, 0.08, 0.12], [side * 0.18, 0.12, 0.36], 0.065 * big, 0.07 * big, clawMat);
      const hand = new THREE.Group();
      hand.position.set(side * 0.18, 0.12, 0.36);
      arm.add(hand);
      const palm = new THREE.Mesh(this.geo(new THREE.SphereGeometry(1, 18, 12)), clawMat);
      palm.scale.set(0.1 * big, 0.085 * big, 0.17 * big);
      palm.position.set(0, 0, 0.1 * big);
      palm.castShadow = true;
      hand.add(palm);
      this.limb(hand, [side * 0.03 * big, -0.03 * big, 0.2 * big], [side * 0.02 * big, -0.02 * big, 0.42 * big], 0.04 * big, 0.008, tipMat);
      const finger = new THREE.Group();
      finger.position.set(0, 0.045 * big, 0.2 * big);
      hand.add(finger);
      this.limb(finger, [0, 0, 0], [0, -0.02 * big, 0.21 * big], 0.035 * big, 0.007, tipMat);
      this.claws.push({ arm, finger, side });
    }
    // Eight legs, four a side, splayed out: up to the knee, down to the tip.
    this.legs = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const hip = new THREE.Group();
        const z = 0.18 - i * 0.15;
        hip.position.set(side * 0.58, 0.3, z);
        root.add(hip);
        const spread = (i - 1.5) * 0.18;
        const knee = [side * 0.4, 0.22, spread * 0.6];
        const foot = [side * 0.72, -0.3, spread * 1.4];
        this.limb(hip, [0, 0, 0], knee, 0.05, 0.04, legMat);
        this.limb(hip, knee, foot, 0.04, 0.012, legMat);
        this.legs.push({ hip, side, phase: (i % 2) * Math.PI + (side > 0 ? Math.PI : 0) });
      }
    }
    this.height = 0.62 * size;
    this.time = 0;
  }

  geo(g) {
    this.geos.push(g);
    return g;
  }

  // A tapered segment from a to b in parent.
  limb(parent, a, b, ra, rb, mat) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const m = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(rb, ra, d.length(), 8)), mat);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // pose: what it is doing; hs: how fast it goes.
  play(dt, pose, hs) {
    this.time += dt * (1 + Math.min(4, hs) * 1.6);
    const t = this.time;
    const scuttle = pose === 'walk' || pose === 'run' ? 1 : 0.12;
    for (const l of this.legs) {
      const a = t * 8 + l.phase;
      l.hip.rotation.y = Math.sin(a) * 0.32 * scuttle;
      l.hip.rotation.z = l.side * Math.max(0, Math.cos(a)) * 0.22 * scuttle;
    }
    // Pincers up and snapping when cross, or when it means to throw.
    const angry = pose === 'run' || pose === 'beg' || pose === 'jump';
    for (const c of this.claws) {
      c.arm.rotation.x = angry ? -0.45 + Math.sin(t * 4 + c.side) * 0.15 : -0.1 + Math.sin(t * 1.3 + c.side) * 0.05;
      c.finger.rotation.x = -(Math.sin(t * (angry ? 9 : 2) + c.side * 2) * 0.5 + 0.5) * (angry ? 0.55 : 0.15);
    }
    this.root.position.y = (pose === 'jump' ? -0.05 : 0) + Math.abs(Math.sin(t * 8)) * 0.012 * scuttle;
    this.root.rotation.z = pose === 'lie' ? 0.45 : 0;
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

// ---------------------------------------------------------------- models

// Each animal by the kind of monster it is: its breed (or a crab), its coat
// on each corner of the Wild Isle, its size, and its boss parts.
const ANIMALS = {
  wolf: { breed: 'wild-wolf', coat: (theme) => (theme === 'wildpeak' ? 'white' : theme === 'wildfen' ? 'fog' : 'grey'), size: 0.78 },
  fox: { breed: 'wild-fox', coat: () => 'red', size: 0.42 },
  boar: { breed: 'wild-boar', coat: () => 'brown', size: 0.72, extra: 'boar' },
  snapper: { crab: 0.42 },
  ironclaw: { crab: 1.25, giant: true, boss: { bubble: 2.1, y: 1.0, reach: 4.5 } },
  bramblepaw: { breed: 'wild-bear', coat: () => 'brown', size: 1.55, boss: { bubble: 2.6, y: 1.3, reach: 6 } },
  gnasher: { breed: 'wild-beaver', coat: () => 'brown', size: 1.0, extra: 'gnasher', boss: { bubble: 2.3, y: 1.0, reach: 6.5 } },
  curlhorn: { breed: 'wild-ram', coat: () => 'cream', size: 1.3, extra: 'curlhorn', boss: { bubble: 2.4, y: 1.3, reach: 5.5 } },
  murk: { breed: 'wild-wolf', coat: () => 'fog', size: 1.85, extra: 'murk', boss: { bubble: 2.8, y: 1.5, reach: 6.5 } },
};
// Which kinds are drawn so: the Wild Isle's own everywhere (they have no
// toy of their own), and on the Wild Isle the wolves and crabs too.
const WILD_ONLY = new Set(['fox', 'boar', 'ironclaw', 'bramblepaw', 'gnasher', 'curlhorn', 'murk']);
export const isRealAnimal = (kind, real = false) => WILD_ONLY.has(kind) || (real && Object.hasOwn(ANIMALS, kind));

// How the animal stands for what the monster is doing.
function poseOf(state, hs) {
  if (state === 'chase' || state === 'charge') return hs > 0.4 ? 'run' : 'stand';
  if (state === 'hop') return hs > 0.3 ? 'walk' : 'stand';
  if (state === 'leap' || state === 'stomp') return 'jump';
  if (state === 'hurl' || state === 'rear') return state === 'rear' ? 'jump' : 'beg';
  if (state === 'dazed') return 'lie';
  if (state === 'howl' || state === 'puff') return 'sit';
  if (state === 'giggle') return 'happy';
  return hs > 0.3 ? 'walk' : 'stand';
}

export class RealAnimal {
  constructor(kind, theme) {
    const def = ANIMALS[kind];
    this.kind = kind;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    if (def.crab) {
      this.rig = new CrabRig(def.crab, def.giant);
      this.geos = [];
    } else {
      this.rig = new DogRig(def.breed, def.coat(theme), def.size);
      this.rig.collar.visible = false;
      this.geos = def.extra ? addParts(this.rig, def.extra) : [];
    }
    this.body.add(this.rig.group);
    this.rig.group.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) o.castShadow = true;
    });
    this.height = this.rig.height;
    this.center = this.height * 0.55;
    this.pick = Math.max(0.35, this.height * 0.5);
    this.seen = def.boss ? 160 : 110;
    this.shadowScale = (def.crab ?? def.size) * 2.2;
    this.shadow = blobShadow(0.5, 0.2);
    this.time = Math.random() * 10;
    this.squash = 0;
    this.hs = 0;
    this.last = null;
    this.throwAt = -Infinity;
    if (def.boss) addBossParts(this, def.boss);
    this.boss = Boolean(def.boss);
    // Old Murk's fog, curling round him.
    if (kind === 'murk') {
      this.fog = [];
      const m = partMaterials().fog;
      for (let i = 0; i < 7; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), m);
        puff.scale.setScalar(0.5 + (i % 3) * 0.2);
        this.geos.push(puff.geometry);
        this.group.add(puff);
        this.fog.push(puff);
      }
    }
  }

  update(dt, state, air = 0, night = false, shielded = false) {
    this.time += dt;
    const p = this.group.position;
    if (this.last && dt > 0) this.hs += (Math.hypot(p.x - this.last.x, p.z - this.last.z) / dt - this.hs) * Math.min(1, dt * 8);
    this.last = p.clone();
    this.body.scale.set(1, 1, 1);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.rig.play(dt, poseOf(state, this.hs), this.hs);
    // Squashed flat a moment when bopped.
    this.squash = Math.max(0, this.squash - dt * 2.2);
    if (this.squash) this.body.scale.set(1 + this.squash * 0.25, 1 - this.squash * 0.35, 1 + this.squash * 0.25);
    if (this.boss) bossPose(this, dt, state, air, shielded);
    if (this.fog) {
      this.fog.forEach((f, i) => {
        const a = this.time * 0.4 + i * 0.9;
        f.position.set(Math.cos(a) * 1.4, 0.2 + ((this.time * 0.25 + i * 0.37) % 1) * 1.2, Math.sin(a) * 1.6);
        f.material.opacity = state === 'puff' ? 0.3 : 0.08;
      });
    }
  }

  figurePose() {
    this.update(0, 'idle', 0, false);
  }

  thrown() {
    this.throwAt = this.time;
  }

  mouthAt() {
    return this.rig.bones?.[6]?.getWorldPosition(new THREE.Vector3()) ?? this.group.position.clone().add(new THREE.Vector3(0, this.height * 0.7, 0));
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    for (const g of this.geos) g.dispose();
    this.rig.dispose();
    if (this.boss) disposeBossParts(this);
  }
}
