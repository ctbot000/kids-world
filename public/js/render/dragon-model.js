// The dragon of a volcano island, drawn to look like a real one rather than
// a toy: one smooth body swept along its spine (no balls stuck together),
// a reptile's skull with brow ridges, fangs and a lower jaw that drops open,
// slit-pupilled amber eyes, swept-back horns, a crest of spines from its
// head to the end of its tail, muscled digitigrade legs with clawed feet,
// and bat-like wings — bones and a membrane between them — folded against
// its sides on the ground and beating in the air. It is covered in
// overlapping scales (a texture drawn on a canvas, which also bumps the
// light) with ridged plates down its belly and throat, all in dull,
// natural greens, matte rather than glossy.
//
// It keeps the rig the other big animals have (critter-models.js bigRig,
// trot), so it walks, runs, lies down, rears and flies as they do: the
// parts are named the same (pivot, neck, head, eyes, tail, legs, wings),
// and drawn DRAGON_SCALE times as big as a pony's build.
import * as THREE from '../../vendor/three.module.js';
import { cone, mesh, sphere, toyMaterial } from './toon.js';

// How much bigger than a pony's build the dragon is drawn (its ride box in
// critters.js is as much bigger).
export const DRAGON_SCALE = 2.2;

// Coats: the scales, the paler belly plates, the wing membrane and the dark
// of its back and spines.
const COATS = [
  { coat: '#3e5a2a', belly: '#857c4e', wing: '#4b5a2c', dark: '#24331a' },
  { coat: '#2f5236', belly: '#7d7c55', wing: '#3d5236', dark: '#1a2e1e' },
  { coat: '#4b5e27', belly: '#8c7d4a', wing: '#56602c', dark: '#2b3516' },
  { coat: '#36583b', belly: '#7f7c58', wing: '#45583a', dark: '#1d3322' },
];

// ------------------------------------------------------------ textures

// Drawn once, on a page (never in Node, where there is no canvas: there the
// dragon is plain colour, which is all the tests look at).
let textures = null;
function texturesOf() {
  if (textures !== null) return textures;
  if (typeof document === 'undefined') return (textures = {});
  textures = { scales: scaleTexture(), plates: plateTexture(), membrane: membraneTexture() };
  return textures;
}

function canvasTexture(draw, size = 256, color = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Overlapping scales, row on row, each a little lighter in the middle and
// dark where the next one overlaps it, and no two quite the same shade.
function scaleTexture() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return canvasTexture((g, n) => {
    g.fillStyle = '#3a3a3a';
    g.fillRect(0, 0, n, n);
    const cols = 8;
    const w = n / cols;
    const h = w * 0.62;
    for (let row = -1; row <= n / h + 1; row++) {
      for (let col = -1; col <= cols; col++) {
        const x = (col + (row % 2 ? 0.5 : 0)) * w;
        const y = row * h;
        const shade = 150 + rand() * 70;
        const grad = g.createRadialGradient(x, y - h * 0.15, w * 0.05, x, y, w * 0.62);
        grad.addColorStop(0, `rgb(${shade + 30},${shade + 30},${shade + 30})`);
        grad.addColorStop(0.7, `rgb(${shade},${shade},${shade})`);
        grad.addColorStop(1, 'rgb(60,60,60)');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x, y, w * 0.56, h * 1.05, 0, 0, Math.PI);
        g.lineTo(x - w * 0.56, y - h * 0.4);
        g.ellipse(x, y - h * 0.4, w * 0.56, h * 0.5, 0, Math.PI, 0);
        g.closePath();
        g.fill();
      }
    }
  });
}

// The plates across a belly or a throat: broad bands, ridged at their edges.
function plateTexture() {
  return canvasTexture((g, n) => {
    const bands = 4;
    const h = n / bands;
    for (let i = 0; i < bands; i++) {
      const grad = g.createLinearGradient(0, i * h, 0, (i + 1) * h);
      grad.addColorStop(0, 'rgb(150,150,150)');
      grad.addColorStop(0.2, 'rgb(215,215,215)');
      grad.addColorStop(0.8, 'rgb(200,200,200)');
      grad.addColorStop(1, 'rgb(135,135,135)');
      g.fillStyle = grad;
      g.fillRect(0, i * h, n, h);
    }
  });
}

// A wing's skin: mottled, with fine veins.
function membraneTexture() {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return canvasTexture((g, n) => {
    g.fillStyle = 'rgb(200,200,200)';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 160; i++) {
      const v = 170 + rand() * 60;
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.beginPath();
      g.arc(rand() * n, rand() * n, 4 + rand() * 18, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(70,70,70,0.45)';
    for (let i = 0; i < 26; i++) {
      g.lineWidth = 0.6 + rand() * 1.2;
      let x = rand() * n;
      let y = rand() * n;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rand() - 0.5) * 40;
        y += (rand() - 0.5) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

// ------------------------------------------------------------ materials

// Matte, as hide is: the scales bump the light, and only a little of the
// studio's light shines back off it. Shared by every dragon of a coat.
const materials = new Map();
function materialsOf(k) {
  const key = k.coat;
  if (materials.has(key)) return materials.get(key);
  const t = texturesOf();
  const hide = (color, map, bump, extra = {}) =>
    toyMaterial({ color, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.55, envMapIntensity: 0.4, ...(map ? { map, bumpMap: map, bumpScale: bump } : {}), ...extra });
  const m = {
    scales: hide(k.coat, t.scales, 2.2),
    back: hide(k.dark, t.scales, 2.2),
    plates: hide(k.belly, t.plates, 1.6, { roughness: 0.55 }),
    membrane: hide(k.wing, t.membrane, 0.6, { side: THREE.DoubleSide, roughness: 0.78, clearcoat: 0, envMapIntensity: 0.3 }),
    horn: toyMaterial({ color: '#a89c80', roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.45 }),
    spine: toyMaterial({ color: k.dark, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 0.45 }),
    claw: toyMaterial({ color: '#1f1b16', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.6 }),
    tooth: toyMaterial({ color: '#ece4cc', roughness: 0.35, clearcoat: 0.4, envMapIntensity: 0.5 }),
    eye: toyMaterial({ color: '#f2a516', emissive: new THREE.Color('#c86b00'), emissiveIntensity: 0.55, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 }),
    pupil: toyMaterial({ color: '#0b0906', roughness: 0.2, clearcoat: 1, envMapIntensity: 0.8 }),
    nostril: toyMaterial({ color: '#141a10', roughness: 0.6 }),
    mouth: new THREE.MeshBasicMaterial({ color: '#ffb23d' }),
    leather: toyMaterial({ color: '#5b3a22', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.5 }),
  };
  materials.set(key, m);
  return m;
}

// ------------------------------------------------------------ shapes

// A tube swept along a smooth path through pts ([x, y, z]), its cross
// section an ellipse rad[i] = [rx, ry] at each point (eased between them),
// rx across the side the path's sideways way (x, or whatever is most nearly
// x), ry round the other way. From angle a0 round to a1 only, for a strip
// (a belly's plates), else closed, and capped at both ends. Its UVs go by
// distance, tile to a texture, so the scales are one size all over.
function sweep(pts, rad, { seg = 40, sides = 18, a0 = 0, a1 = Math.PI * 2, tile = 0.26, grow = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const full = a1 - a0 >= Math.PI * 2 - 1e-6;
  const pos = [];
  const uv = [];
  const idx = [];
  const ring = sides + 1;
  const X = new THREE.Vector3(1, 0, 0);
  const T = new THREE.Vector3();
  const S = new THREE.Vector3();
  const N = new THREE.Vector3();
  const C = new THREE.Vector3();
  const radAt = (u) => {
    const f = u * (rad.length - 1);
    const i = Math.min(rad.length - 2, Math.floor(f));
    const k = f - i;
    const e = k * k * (3 - 2 * k);
    return [rad[i][0] + (rad[i + 1][0] - rad[i][0]) * e + grow, rad[i][1] + (rad[i + 1][1] - rad[i][1]) * e + grow];
  };
  const centres = [];
  let along = 0;
  let last = null;
  for (let r = 0; r <= seg; r++) {
    const u = r / seg;
    curve.getPointAt(u, C);
    curve.getTangentAt(u, T);
    // Sideways: x, or (on a path that runs along x, a wing's bone) z.
    const side = Math.abs(T.x) > 0.8 ? new THREE.Vector3(0, 0, -Math.sign(T.x)) : X;
    S.copy(side).addScaledVector(T, -side.dot(T)).normalize();
    N.crossVectors(T, S);
    if (last) along += C.distanceTo(last);
    last = C.clone();
    centres.push(C.clone());
    const [rx, ry] = radAt(u);
    let around = 0;
    let prev = null;
    for (let k = 0; k <= sides; k++) {
      const a = a0 + ((a1 - a0) * k) / sides;
      const p = C.clone().addScaledVector(S, rx * Math.cos(a)).addScaledVector(N, ry * Math.sin(a));
      if (prev) around += p.distanceTo(prev);
      prev = p;
      pos.push(p.x, p.y, p.z);
      uv.push(around / tile, along / tile);
    }
  }
  for (let r = 0; r < seg; r++) {
    for (let k = 0; k < sides; k++) {
      const a = r * ring + k;
      const b = a + 1;
      const c = a + ring;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (full) {
    // Caps, each a fan round the middle of its end.
    for (const [r, start] of [[0, true], [seg, false]]) {
      const centre = pos.length / 3;
      const p = centres[r];
      pos.push(p.x, p.y, p.z);
      uv.push(0, (r ? along : 0) / tile);
      for (let k = 0; k < sides; k++) {
        const a = r * ring + k;
        if (start) idx.push(centre, a + 1, a);
        else idx.push(centre, a, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A spine, a horn or a claw: a cone from base to tip, its base r round.
function spike(from, to, r, material, flat = 1) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const m = mesh(cone(1, 1, 10), material, 0, 0, 0, r * flat, len, r);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

// A curved horn: a sweep tapering to a point.
const horn = (pts, r, material) => new THREE.Mesh(sweep(pts, pts.map((_, i) => [r * (1 - i / (pts.length - 1)) + 0.002, r * (1 - i / (pts.length - 1)) + 0.002]), { seg: 16, sides: 10 }), material);

// ------------------------------------------------------------ the dragon

export function dragon(id, { bigRig }) {
  const k = COATS[id % COATS.length];
  const m = materialsOf(k);
  const { g, body, pivot } = bigRig(0.92);

  // Its body, from the root of its tail to the base of its neck: deep in the
  // chest, narrower at the waist, the top of its back where the saddle goes
  // (0.38 over the pivot) a little under it.
  const spine = [
    [0, 0.08, -0.74],
    [0, 0.05, -0.48],
    [0, 0.02, -0.2],
    [0, 0.03, 0.12],
    [0, 0.02, 0.4],
    [0, 0.1, 0.62],
    [0, 0.17, 0.72],
  ];
  const girth = [
    [0.2, 0.2],
    [0.32, 0.31],
    [0.3, 0.33],
    [0.33, 0.35],
    [0.34, 0.36],
    [0.24, 0.27],
    [0.15, 0.16],
  ];
  pivot.add(new THREE.Mesh(sweep(spine, girth), m.scales));
  // Its belly plates, a strip a hair outside the underside.
  pivot.add(new THREE.Mesh(sweep(spine.slice(1, 6), girth.slice(1, 6), { a0: Math.PI + 0.85, a1: Math.PI * 2 - 0.85, sides: 10, grow: 0.006, tile: 0.2 }), m.plates));
  // The darker scales down its back.
  pivot.add(new THREE.Mesh(sweep(spine.slice(0, 6), girth.slice(0, 6), { a0: 1.2, a1: Math.PI - 1.2, sides: 8, grow: 0.004 }), m.back));

  // Legs: a thigh down to the knee, a shin back down to the ankle, and a
  // broad foot with three claws forward and one behind, each leg one sweep.
  // (Front legs bend the other way at the elbow.)
  const legs = [
    [-1, 0.4],
    [1, 0.4],
    [-1, -0.42],
    [1, -0.42],
  ].map(([side, z]) => {
    const front = z > 0;
    const leg = new THREE.Group();
    leg.position.set(side * 0.2, -0.24, z);
    leg.userData = { side, front };
    const bend = front ? -1 : 1;
    // Its top rounded off well inside the body, so no edge shows.
    const path = [
      [0, 0.3, 0],
      [0, 0.16, 0],
      [0, 0.0, 0.02 * bend],
      [0, -0.24, 0.09 * bend],
      [0, -0.48, -0.03 * bend],
      [0, -0.62, 0.0],
    ];
    const thick = [
      [0.03, 0.04],
      [0.12, 0.19],
      [0.12, 0.17],
      [0.085, 0.1],
      [0.07, 0.075],
      [0.065, 0.065],
    ];
    leg.add(new THREE.Mesh(sweep(path, thick, { seg: 28, sides: 16, tile: 0.2 }), m.scales));
    leg.add(mesh(sphere(1, 14, 10), m.scales, 0, -0.63, 0.04, 0.085, 0.045, 0.12));
    for (const dx of [-0.05, 0, 0.05]) leg.add(spike([dx, -0.64, 0.12], [dx * 1.3, -0.67, 0.2], 0.018, m.claw));
    leg.add(spike([0, -0.62, -0.06], [0, -0.66, -0.12], 0.014, m.claw));
    pivot.add(leg);
    return leg;
  });

  // The neck: long, thick at the shoulders and slimmer up to the head,
  // with plates down the throat; it leans up and forward from the chest.
  const neck = new THREE.Group();
  neck.position.set(0, 0.18, 0.56);
  pivot.add(neck);
  const n = new THREE.Group();
  n.rotation.x = 0.75;
  neck.add(n);
  const neckPath = [
    [0, -0.14, -0.04],
    [0, 0.08, 0],
    [0, 0.3, 0.03],
    [0, 0.5, 0.01],
    [0, 0.62, -0.02],
  ];
  const neckGirth = [
    [0.21, 0.23],
    [0.16, 0.17],
    [0.125, 0.13],
    [0.1, 0.11],
    [0.09, 0.1],
  ];
  n.add(new THREE.Mesh(sweep(neckPath, neckGirth, { seg: 28 }), m.scales));
  // Its throat (the +z side, which the path's frame has at 3/2 π).
  n.add(new THREE.Mesh(sweep(neckPath.slice(0, 4), neckGirth.slice(0, 4), { a0: Math.PI + 0.9, a1: Math.PI * 2 - 0.9, sides: 8, grow: 0.005, tile: 0.16 }), m.plates));

  // The head: a long reptile's skull, broad at the cheeks, tapering to the snout.
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0.0);
  head.rotation.x = -0.55;
  n.add(head);
  const skull = [
    [0, 0.02, -0.15],
    [0, 0.035, -0.07],
    [0, 0.03, 0.05],
    [0, 0.005, 0.17],
    [0, -0.008, 0.28],
    [0, -0.015, 0.35],
    [0, -0.02, 0.378],
  ];
  const skullGirth = [
    [0.05, 0.05],
    [0.12, 0.1],
    [0.122, 0.092],
    [0.085, 0.064],
    [0.062, 0.05],
    [0.046, 0.036],
    [0.02, 0.016],
  ];
  head.add(new THREE.Mesh(sweep(skull, skullGirth, { seg: 28, tile: 0.28 }), m.scales));
  // Brow ridges over the eyes, and a ridge down the snout.
  for (const side of [-1, 1]) {
    const brow = mesh(sphere(1, 12, 8), m.back, side * 0.07, 0.085, 0.03, 0.035, 0.022, 0.085);
    brow.rotation.set(0.1, side * 0.25, side * 0.3);
    head.add(brow);
  }
  head.add(mesh(sphere(1, 12, 8), m.back, 0, 0.05, 0.2, 0.025, 0.02, 0.13));
  // Nostrils at the end of the snout.
  for (const side of [-1, 1]) head.add(mesh(sphere(1, 8, 6), m.nostril, side * 0.026, 0.018, 0.345, 0.012, 0.009, 0.014));
  // Fangs down from the upper jaw.
  for (const side of [-1, 1]) {
    for (const [z, len] of [[0.31, 0.035], [0.26, 0.05], [0.2, 0.03], [0.14, 0.028], [0.08, 0.024]]) {
      const x = side * (0.03 + (0.32 - z) * 0.18);
      head.add(spike([x, -0.035, z], [x * 0.95, -0.035 - len, z + 0.006], 0.008, m.tooth));
    }
  }

  // The lower jaw, which drops open to breathe fire (breathe, critter-models.js).
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.045, -0.06);
  head.add(jaw);
  jaw.add(new THREE.Mesh(sweep([[0, -0.01, -0.02], [0, -0.03, 0.14], [0, -0.032, 0.3], [0, -0.03, 0.375]], [[0.085, 0.04], [0.068, 0.034], [0.042, 0.024], [0.014, 0.01]], { seg: 20, sides: 12, tile: 0.28 }), m.scales));
  for (const side of [-1, 1]) {
    for (const z of [0.33, 0.27, 0.2, 0.13]) {
      const x = side * (0.022 + (0.36 - z) * 0.16);
      jaw.add(spike([x, -0.015, z], [x * 0.95, 0.018, z + 0.004], 0.007, m.tooth));
    }
  }
  // The fire's glow in its mouth, and where the flames come out (mouth, below).
  const glow = mesh(sphere(), m.mouth, 0, -0.05, 0.14, 0.04, 0.016, 0.1);
  glow.visible = false;
  head.add(glow);
  const tip = new THREE.Object3D();
  tip.position.set(0, -0.06, 0.39);
  head.add(tip);

  // Amber eyes with slit pupils, set into the sides of the skull under the
  // brows, in a group at their height so closing them squashes them shut.
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.052, 0.05);
  for (const side of [-1, 1]) {
    const eye = mesh(sphere(1, 14, 10), m.eye, side * 0.098, 0, 0, 0.018, 0.022, 0.03);
    eye.rotation.y = side * 0.35;
    eyes.add(eye);
    const pupil = mesh(sphere(1, 10, 8), m.pupil, side * 0.113, 0, 0.008, 0.005, 0.018, 0.008);
    pupil.rotation.y = side * 0.35;
    eyes.add(pupil);
  }
  head.add(eyes);

  // Horns: a great pair sweeping back from the top of its head, a smaller
  // pair under them, and spikes down the back of its jaw.
  for (const side of [-1, 1]) {
    head.add(horn([[side * 0.06, 0.07, -0.06], [side * 0.085, 0.11, -0.17], [side * 0.1, 0.16, -0.29], [side * 0.105, 0.24, -0.37]], 0.032, m.horn));
    head.add(horn([[side * 0.1, 0.02, -0.08], [side * 0.13, 0.03, -0.17], [side * 0.15, 0.06, -0.24]], 0.018, m.horn));
    for (const [z, y] of [[0.0, -0.05], [-0.06, -0.035]]) head.add(spike([side * 0.1, y, z], [side * 0.15, y - 0.02, z - 0.07], 0.012, m.horn));
  }

  // A crest of spines from the back of its head down its neck and back to
  // the end of its tail — none where the saddle goes.
  const spineFin = (parent, at, len, lean = -0.6) => parent.add(spike(at, [at[0], at[1] + len * Math.cos(lean), at[2] + len * Math.sin(lean)], len * 0.32, m.spine, 0.3));
  spineFin(head, [0, 0.07, -0.12], 0.06);
  // (The back of the neck is its -z side, the neck leaning forward.)
  for (let y = 0.56; y > -0.1; y -= 0.075) spineFin(n, [0, y, -(0.165 - y * 0.14)], 0.05 + (0.56 - y) * 0.06, -2.5);
  for (const z of [0.66, 0.58, 0.5, -0.36, -0.45, -0.54, -0.63, -0.72]) {
    const top = z > 0 ? 0.37 - (z - 0.45) * 0.7 : 0.355 - (-0.36 - z) * 0.4;
    spineFin(pivot, [0, top - 0.02, z], 0.085, -0.55);
  }

  // Bat-like wings at its shoulders: an arm (to the elbow and the wrist),
  // four long fingers fanning back from the wrist and a thumb claw, and the
  // skin between them, scalloped between the fingertips and down to its
  // flank. Folded at its sides on the ground; beating in the air (flapWings).
  const wings = [-1, 1].map((side) => {
    const w = new THREE.Group();
    w.position.set(side * 0.2, 0.3, 0.28);
    w.userData.wing = side;
    const s = (p) => [side * p[0], p[1], p[2]];
    const shoulder = [0, 0, 0];
    const elbow = [0.42, 0.07, -0.08];
    const wrist = [0.82, 0.12, 0.08];
    const tips = [
      [1.55, 0.02, -0.12],
      [1.38, -0.02, -0.55],
      [1.04, -0.04, -0.86],
      [0.62, -0.04, -1.0],
    ];
    const bone = (pts, r0, r1) => new THREE.Mesh(sweep(pts.map(s), pts.map((_, i) => { const r = r0 + ((r1 - r0) * i) / (pts.length - 1); return [r, r]; }), { seg: 10, sides: 10, tile: 0.2 }), m.scales);
    w.add(bone([shoulder, [0.2, 0.05, -0.04], elbow], 0.06, 0.04));
    w.add(bone([elbow, [0.62, 0.11, 0.0], wrist], 0.04, 0.028));
    for (const t of tips) {
      const mid = [(wrist[0] + t[0]) / 2, (wrist[1] + t[1]) / 2 + 0.02, (wrist[2] + t[2]) / 2];
      w.add(bone([wrist, mid, t], 0.022, 0.007));
    }
    w.add(spike(s(wrist), s([0.86, 0.15, 0.17]), 0.018, m.claw));
    // The skin: a fan of triangles from the wrist, round the fingertips (the
    // edge between each two sagging in towards the wrist) and the flank.
    const sag = (a, b, k = 0.24) => {
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[2] + b[2]) / 2;
      return [mx + (wrist[0] - mx) * k, (a[1] + b[1]) / 2 - 0.05, mz + (wrist[2] - mz) * k];
    };
    const flank = [0.08, -0.06, -0.78];
    const edge = [tips[0], sag(tips[0], tips[1]), tips[1], sag(tips[1], tips[2]), tips[2], sag(tips[2], tips[3]), tips[3], sag(tips[3], flank, 0.18), flank, [0.03, -0.03, -0.3], shoulder, elbow];
    // Shared corners, so it shades smoothly; each spoke from the wrist split
    // in a few, so the skin can sag between the bones.
    const pos = [];
    const uv = [];
    const idx = [];
    const SPOKE = 4;
    const put = (p) => {
      pos.push(...s(p));
      uv.push(p[0] * 1.6, p[2] * 1.6);
      return pos.length / 3 - 1;
    };
    const centre = put(wrist);
    const spokes = edge.map((e, i) => {
      const out = [];
      // The skin sags between the bones (the odd corners), not along them.
      const droop = i % 2 === 1 && i < 8 ? 0.035 : 0;
      for (let j = 1; j <= SPOKE; j++) {
        const f = j / SPOKE;
        out.push(put([wrist[0] + (e[0] - wrist[0]) * f, wrist[1] + (e[1] - wrist[1]) * f - droop * Math.sin(f * Math.PI), wrist[2] + (e[2] - wrist[2]) * f]));
      }
      return out;
    });
    for (let i = 0; i < edge.length - 1; i++) {
      const a = spokes[i];
      const b = spokes[i + 1];
      const tri = (p, q, r) => (side > 0 ? idx.push(p, q, r) : idx.push(p, r, q));
      tri(centre, a[0], b[0]);
      for (let j = 0; j < SPOKE - 1; j++) {
        tri(a[j], a[j + 1], b[j]);
        tri(b[j], a[j + 1], b[j + 1]);
      }
    }
    const skin = new THREE.BufferGeometry();
    skin.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    skin.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    skin.setIndex(idx);
    skin.computeVertexNormals();
    w.add(new THREE.Mesh(skin, m.membrane));
    pivot.add(w);
    return w;
  });

  // A long tail in bends that sway, tapering to a barbed tip, with its
  // spines going on down it.
  const tail = new THREE.Group();
  tail.position.set(0, 0.08, -0.7);
  pivot.add(tail);
  let at = tail;
  const bends = [];
  const widths = [0.2, 0.15, 0.105, 0.07, 0.04];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    if (i) b.position.z = -0.3;
    const r0 = widths[i];
    const r1 = widths[i + 1];
    b.add(new THREE.Mesh(sweep([[0, 0, 0.04], [0, -0.01, -0.15], [0, -0.02, -0.32]], [[r0, r0 * 0.95], [(r0 + r1) / 2, ((r0 + r1) / 2) * 0.95], [r1, r1 * 0.95]], { seg: 10, sides: 14 }), m.scales));
    for (const z of [-0.02, -0.12, -0.22]) spineFin(b, [0, (r0 + (r1 - r0) * (-z / 0.32)) * 0.88, z], 0.075 - i * 0.014, -0.5);
    at.add(b);
    bends.push(b);
    at = b;
  }
  at.add(spike([0, -0.02, -0.3], [0, -0.03, -0.46], 0.045, m.spine, 0.3));
  for (const side of [-1, 1]) at.add(spike([0, -0.02, -0.34], [side * 0.07, -0.02, -0.4], 0.016, m.spine, 0.5));

  // A rider's saddle: a blanket in their T-shirt's colour under a leather seat.
  const pad = toyMaterial({ color: '#ff6f6f', roughness: 0.8, envMapIntensity: 0.4 });
  const saddle = new THREE.Group();
  saddle.position.set(0, 0.38, -0.05);
  saddle.add(mesh(sphere(), pad, 0, -0.035, 0, 0.3, 0.05, 0.3));
  saddle.add(mesh(sphere(), m.leather, 0, 0.015, 0, 0.19, 0.05, 0.2));
  saddle.add(mesh(sphere(1, 12, 8), m.leather, 0, 0.045, -0.15, 0.13, 0.05, 0.035));
  saddle.visible = false;
  pivot.add(saddle);

  body.scale.setScalar(DRAGON_SCALE);
  const v = new THREE.Vector3();
  return {
    group: g,
    body,
    pivot,
    neck,
    head,
    eyes,
    tail,
    legs,
    wings,
    bends,
    jaw,
    glow,
    saddle,
    pad,
    owned: [pad],
    flapWings,
    // Where its flames come out, in the world, as drawn now.
    mouth: () => tip.getWorldPosition(v),
    height: 1.75 * DRAGON_SCALE,
    shadow: 0.75 * DRAGON_SCALE,
    pick: 0.9 * DRAGON_SCALE,
    center: 1.0 * DRAGON_SCALE,
    seen: 200,
    gait: { len: 0.8, run: 4, happy: 'rear', graze: 0.45 },
  };
}

// Its wings, each frame (model: the CritterModel): out and beating slowly and
// powerfully in the air; half raised, menacing, as it breathes fire; and
// folded close against its sides on the ground (shorter, the fingers drawn
// together, swept back along its flanks), lifting a little now and then.
function flapWings(model, state) {
  const t = model.time;
  for (const w of model.wings) {
    const side = w.userData.wing;
    if (state === 'fly') {
      const beat = Math.sin(t * 4.2);
      w.scale.set(1, 1, 1);
      w.rotation.set(beat * 0.08, side * 0.05, side * (beat * 0.75 + 0.1));
    } else if (state === 'fire') {
      w.scale.set(0.85, 1, 0.95);
      w.rotation.set(0, side * 0.25, side * (0.55 + Math.sin(t * 3) * 0.05));
    } else {
      const stir = Math.max(0, Math.sin(t * 0.7)) ** 8 * 0.12;
      w.scale.set(0.4, 1, 0.72);
      w.rotation.set(0.1, side * 0.32, side * (-0.5 + stir));
    }
  }
}
