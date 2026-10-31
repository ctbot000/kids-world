// What the 3D kitchen of a cooking class (render/kitchen3d.js) is made of:
// its materials — a speckled granite counter, end-grain wood, glazed
// ceramic, brushed steel, non-stick enamel, porcelain, and the food's own:
// glossy egg, matt flour, dough, crumb — their textures painted on canvases,
// and the shapes it is built from: turned shapes (a bowl, a pan, a plate),
// lumps with a little noise in them, and positions in the kitchen's units
// (render/kitchen.js, a millimetre each) turned into metres.
import * as THREE from '../../vendor/three.module.js';
import { SimplexNoise } from '../../vendor/three-addons/math/SimplexNoise.js';
import { mergeVertices } from '../../vendor/three-addons/utils/BufferGeometryUtils.js';
import { Rng } from '../shared/rng.js';
import { VESSEL } from './kitchen.js';

export const TAU = Math.PI * 2;
// The kitchen's units (render/kitchen.js) are millimetres: in metres, with
// the vessel's middle at the origin.
export const MM = 0.001;
export const wx = (x) => (x - VESSEL.x) * MM;
export const wz = (y) => (y - VESSEL.y) * MM;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const lerp = (a, b, t) => a + (b - a) * t;

const noise = new SimplexNoise({ random: ((rng) => () => rng.next())(new Rng(7)) });
export const noise3 = (x, y, z) => noise.noise3d(x, y, z);

// A canvas of a size, drawn on, as a texture (colour, so sRGB, unless
// `data` says it is a bump or a mask).
export function paintTexture(w, h, draw, { repeat = 1, data = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (!data) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

// Specks of colour scattered over a canvas, by a seed.
function specks(x, w, h, n, colours, size, seed) {
  const rng = new Rng(seed);
  for (let i = 0; i < n; i++) {
    x.fillStyle = colours[Math.floor(rng.next() * colours.length)];
    const r = size * (0.4 + rng.next());
    x.beginPath();
    x.ellipse(rng.next() * w, rng.next() * h, r, r * (0.5 + rng.next() * 0.5), rng.next() * TAU, 0, TAU);
    x.fill();
  }
}

// A grey bump map of fine noise, for flour, dough and crumb.
export const grainBump = (scale = 18, seed = 3) =>
  paintTexture(
    128,
    128,
    (x, w, h) => {
      const img = x.createImageData(w, h);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          // Tiled: the noise wraps round a torus, so the edges meet.
          const a = (i / w) * TAU;
          const b = (j / h) * TAU;
          const v = noise.noise4d(Math.cos(a) * scale * 0.16, Math.sin(a) * scale * 0.16, Math.cos(b) * scale * 0.16 + seed, Math.sin(b) * scale * 0.16);
          const g = 128 + v * 90;
          const k = (j * w + i) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = g;
          img.data[k + 3] = 255;
        }
      }
      x.putImageData(img, 0, 0);
    },
    { data: true },
  );

// Every material the kitchen shares, made once for a kitchen.
export function kitchenMaterials() {
  const granite = paintTexture(
    512,
    512,
    (x, w, h) => {
      x.fillStyle = '#e4ddd2';
      x.fillRect(0, 0, w, h);
      // Soft clouds of warmer and cooler stone, then the specks.
      const rng = new Rng(11);
      for (let i = 0; i < 40; i++) {
        const cx = rng.next() * w;
        const cy = rng.next() * h;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, 60 + rng.next() * 90);
        g.addColorStop(0, rng.next() < 0.5 ? 'rgba(205,195,180,0.35)' : 'rgba(245,242,236,0.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }
      specks(x, w, h, 2600, ['#b9ad9c', '#8f8375', '#cfc5b6', '#6f665c', '#f7f3ec'], 1.3, 5);
      specks(x, w, h, 160, ['#4f4740', '#a08c75'], 2.4, 6);
    },
    { repeat: 3 },
  );
  const wood = paintTexture(
    512,
    256,
    (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#c8955a');
      g.addColorStop(0.5, '#d4a56a');
      g.addColorStop(1, '#c08c52');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      // The grain: long wavy lines, darker and lighter, and a knot.
      for (let k = 0; k < 70; k++) {
        const y0 = (k / 70) * h;
        x.strokeStyle = k % 3 ? 'rgba(120,72,30,0.18)' : 'rgba(250,215,160,0.18)';
        x.lineWidth = 0.6 + (k % 4) * 0.5;
        x.beginPath();
        for (let i = 0; i <= w; i += 8) {
          const y = y0 + noise.noise(i * 0.004, k * 0.7) * 9 + Math.sin(i * 0.01 + k) * 1.5;
          if (i) x.lineTo(i, y);
          else x.moveTo(i, y);
        }
        x.stroke();
      }
      const knot = x.createRadialGradient(360, 90, 2, 360, 90, 26);
      knot.addColorStop(0, 'rgba(90,50,20,0.55)');
      knot.addColorStop(1, 'rgba(90,50,20,0)');
      x.fillStyle = knot;
      x.fillRect(320, 50, 80, 80);
    },
    { repeat: 1 },
  );
  const crumb = paintTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#f2ddb0';
    x.fillRect(0, 0, w, h);
    specks(x, w, h, 900, ['rgba(214,180,120,0.55)', 'rgba(255,245,220,0.6)', 'rgba(190,150,95,0.35)'], 2.2, 9);
  });
  const shell = paintTexture(128, 128, (x, w, h) => {
    x.fillStyle = '#e9d2b4';
    x.fillRect(0, 0, w, h);
    specks(x, w, h, 260, ['rgba(160,110,70,0.35)', 'rgba(255,240,220,0.5)'], 1, 4);
  });
  const enamel = paintTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#26282d';
    x.fillRect(0, 0, w, h);
    specks(x, w, h, 900, ['rgba(140,150,170,0.25)', 'rgba(10,10,14,0.5)'], 0.8, 12);
  });
  const bump = grainBump();
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    granite: std({ map: granite, roughness: 0.6, metalness: 0 }),
    wood: std({ map: wood, roughness: 0.62 }),
    ceramicOut: phys({ color: '#7fb4d8', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
    ceramicIn: phys({ color: '#dfe9ef', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }),
    porcelain: phys({ color: '#fbfaf6', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    steel: std({ color: '#c9cdd3', metalness: 1, roughness: 0.24, side: THREE.DoubleSide }),
    alu: std({ color: '#b7bcc3', metalness: 0.9, roughness: 0.42, side: THREE.DoubleSide }),
    nonstick: std({ color: '#2b2c30', metalness: 0.25, roughness: 0.42, side: THREE.DoubleSide }),
    panOut: std({ color: '#3c3e44', metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
    bakelite: std({ color: '#1d1c1e', roughness: 0.55 }),
    iron: std({ color: '#1b1b1d', metalness: 0.4, roughness: 0.75 }),
    cooktop: phys({ color: '#141518', roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.2 }),
    enamel: std({ map: enamel, roughness: 0.55, side: THREE.DoubleSide }),
    parchment: std({ color: '#efe2c6', roughness: 0.92, side: THREE.DoubleSide }),
    eggWhite: phys({ color: '#f4efdf', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.88, sheen: 0.3, sheenColor: new THREE.Color('#fffbe8') }),
    yolk: phys({ color: '#ffae0f', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0.4, sheenColor: new THREE.Color('#ffd66b') }),
    shell: std({ map: shell, roughness: 0.55 }),
    milk: phys({ color: '#fbf8ef', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
    flour: std({ color: '#fbf9f3', roughness: 1, bumpMap: bump, bumpScale: 1.5 }),
    dough: std({ color: '#efd9ac', roughness: 0.78, bumpMap: bump, bumpScale: 0.6 }),
    crumb: std({ map: crumb, roughness: 0.9, bumpMap: bump, bumpScale: 1.2 }),
    crust: std({ color: '#9e6a3a', roughness: 0.72, bumpMap: bump, bumpScale: 0.5 }),
    butter: phys({ color: '#f6df86', roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    water: phys({ color: '#a9d6ef', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0 }),
    glass: phys({ color: '#e8f4fb', roughness: 0.04, transparent: true, opacity: 0.32, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    woodSpoon: std({ color: '#c99459', roughness: 0.6, bumpMap: bump, bumpScale: 0.3 }),
    bump,
  };
}

// A turned shape: [radius, height] points spun round the up axis.
export const lathe = (points, material, segments = 72) => {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), material);
  m.castShadow = m.receiveShadow = true;
  return m;
};

// A mesh that casts and takes shadows.
export const mesh = (geometry, material) => {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = m.receiveShadow = true;
  return m;
};

// A lump: a sphere pushed in and out by noise, then squashed to a size.
// `amp` is how lumpy (a share of its radius), `freq` how fine the lumps.
export function lumpGeometry(rx, ry, rz, { amp = 0.12, freq = 2, seed = 1, detail = 32, flatBottom = false } = {}) {
  let g = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.66));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + amp * noise.noise4d(v.x * freq, v.y * freq, v.z * freq, seed * 1.7);
    v.multiplyScalar(n);
    if (flatBottom && v.y < 0) v.y *= 0.15;
    p.setXYZ(i, v.x * rx, v.y * ry, v.z * rz);
  }
  g.computeVertexNormals();
  return g;
}

// A flat, wavy-edged sheet lying on the counter (a lettuce leaf, a splash
// of egg white): a disc whose edge goes in and out, and ruffles up and down.
export function sheetGeometry(r, { wobble = 0.18, ruffle = 0.004, freq = 3, seed = 1, segments = 64, rings = 10, dome = 0 } = {}) {
  const pos = [];
  const idx = [];
  const uv = [];
  pos.push(0, dome, 0);
  uv.push(0.5, 0.5);
  for (let k = 1; k <= rings; k++) {
    const t = k / rings;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * TAU;
      const edge = 1 + wobble * noise.noise(Math.cos(a) * freq + seed, Math.sin(a) * freq);
      const rr = r * t * edge;
      const px = Math.cos(a) * rr;
      const pz = Math.sin(a) * rr;
      const wave = Math.sin(a * freq * 1.6 + seed + 1.5 * noise.noise(Math.cos(a) * 2 + seed, Math.sin(a) * 2));
      const crinkle = noise.noise3d((px / r) * 4 + seed, (pz / r) * 4, seed * 0.37);
      const y = dome * (1 - t * t) + ruffle * (t ** 4 * wave + 0.45 * t * crinkle);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uv.push(0.5 + Math.cos(a) * t * 0.5, 0.5 + Math.sin(a) * t * 0.5);
    }
  }
  for (let s = 0; s < segments; s++) idx.push(0, 1 + ((s + 1) % segments), 1 + s);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * segments;
    const b0 = 1 + k * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      idx.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A soft round puff, for steam and splashes.
export const puffTexture = () =>
  paintTexture(
    64,
    64,
    (x, w) => {
      const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, w);
    },
    { data: false },
  );

// Colours eased from one to another, as THREE.Colors (b and c: past the
// first stop, like raw to golden to dark).
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
export const mixColor = (out, a, b, t) => out.copy(tmpA.set(a)).lerp(tmpB.set(b), clamp01(t));
