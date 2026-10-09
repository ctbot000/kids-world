// Soft cartoon materials shared by everyone and everything that moves: three
// flat bands of light instead of smooth shading, like a picture book.
import * as THREE from '../../vendor/three.module.js';

let gradient = null;
const cache = new Map();

function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([120, 185, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toon(color, { emissive = 0, transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
  const key = `${color}|${emissive}|${transparent}|${opacity}|${side}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), transparent, opacity, side });
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    cache.set(key, m);
  }
  return m;
}

// Shared shapes, made once.
const geos = new Map();
export function geo(key, make) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}

export const sphere = (r = 1, w = 20, h = 14) => geo(`sphere${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
export const capsule = (r, len) => geo(`capsule${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));
export const cone = (r, h, s = 16) => geo(`cone${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
export const cylinder = (rt, rb, h, s = 18) => geo(`cyl${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const torus = (r, t, arc = Math.PI * 2) => geo(`torus${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));

export function mesh(geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// The soft round shadow under everyone's feet: a blob that fades out at the
// edges, lying flat on the ground. The texture is shared and never disposed.
let blobMap = null;

// How opaque the blob is, from its middle (0) out to its edge (1).
const BLOB_STOPS = [
  [0, 1],
  [0.45, 0.85],
  [0.75, 0.35],
  [1, 0],
];

function blobAlpha(r) {
  for (let i = 0; i < BLOB_STOPS.length - 1; i++) {
    const [r0, a0] = BLOB_STOPS[i];
    const [r1, a1] = BLOB_STOPS[i + 1];
    if (r <= r1) return a0 + (a1 - a0) * ((r - r0) / (r1 - r0));
  }
  return 0;
}

export function blobShadow(radius = 0.32, opacity = 0.22) {
  if (!blobMap) {
    // Painted by hand rather than on a canvas: tests draw models with no page.
    const s = 64;
    const data = new Uint8Array(s * s * 4);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = (x + 0.5) / s - 0.5;
        const dy = (y + 0.5) / s - 0.5;
        const a = blobAlpha(Math.min(1, Math.hypot(dx, dy) * 2));
        const i = (y * s + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    }
    blobMap = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
    blobMap.needsUpdate = true;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, map: blobMap, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// A point on the front of an ellipsoid (centre at the origin), `out` along the surface normal.
export function onSurface(rx, ry, rz, fx, fy, out = 0) {
  const k = 1 - (fx / rx) ** 2 - (fy / ry) ** 2;
  const z = rz * Math.sqrt(Math.max(0, k));
  const n = new THREE.Vector3(fx / (rx * rx), fy / (ry * ry), z / (rz * rz)).normalize();
  return new THREE.Vector3(fx, fy, z).addScaledVector(n, out);
}
