// Soft cartoon materials shared by everyone and everything that moves: light
// that rolls smoothly from a gentle shade into full light, never down to
// black, like a picture book painted in soft gouache.
import * as THREE from '../../vendor/three.module.js';

let gradient = null;
const cache = new Map();

// How lit a surface is (0 to 1) for how much it faces the light, from facing
// away (0) to facing it (1): the shade, then an eased turn into the light.
export function shading(x) {
  const k = Math.min(1, Math.max(0, (x - 0.28) / 0.5));
  return 0.5 + 0.5 * k * k * (3 - 2 * k);
}

function gradientMap() {
  if (gradient) return gradient;
  const n = 32;
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.round(shading(i / (n - 1)) * 255);
  gradient = new THREE.DataTexture(data, n, 1, THREE.RedFormat);
  gradient.minFilter = THREE.LinearFilter;
  gradient.magFilter = THREE.LinearFilter;
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

// Something bopped flashes white for a moment, as in a Zelda game.
const FLASH = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
// Every part of a model drawn in FLASH (on), or as it was (off): each part's
// own material kept by it while it flashes, and taken up again afresh each
// frame, as a model may change one (eyes aglow at night) as it goes.
export function flashModel(group, on) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (on && o.material !== FLASH) {
      o.userData.unflash = o.material;
      o.material = FLASH;
    } else if (!on && o.material === FLASH) {
      o.material = o.userData.unflash;
      delete o.userData.unflash;
    }
  });
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
export const capsule = (r, len, cap = 6, rad = 14) => geo(`capsule${r}|${len}|${cap}|${rad}`, () => new THREE.CapsuleGeometry(r, len, cap, rad));
export const cone = (r, h, s = 16) => geo(`cone${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
export const cylinder = (rt, rb, h, s = 18) => geo(`cyl${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const torus = (r, t, arc = Math.PI * 2) => geo(`torus${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));
// A shape turned round an axis, like a pot on a wheel: points from bottom to
// top, each [x, y]. Rounded bodies, muzzles and horns come from this.
export const lathe = (points, segs = 24) => geo(`lathe${points.map((p) => `${p[0]},${p[1]}`).join(';')}|${segs}`, () => new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(p[0], p[1])), segs));
// A smooth tube through rings, each a rounded oval across it (a superellipse,
// squarer the bigger n is), for bodies and shoes: up y, each ring [y, half
// width, depth in front (+z), depth behind]; or forwards along z, each ring
// [z, half width, height above its middle, depth below, y of its middle].
// ends: whether the first and the last ring are closed over.
export const loft = (rings, { along = 'y', segs = 24, n = 2.2, ends = [true, true] } = {}) =>
  geo(`loft${along}|${segs}|${n}|${ends}|${rings.join(';')}`, () => {
    const e = 2 / n;
    const pow = (c) => Math.sign(c) * Math.abs(c) ** e;
    const positions = [];
    const index = [];
    for (const [at, w, a, b, mid = 0] of rings) {
      for (let i = 0; i < segs; i++) {
        const t = (i / segs) * Math.PI * 2;
        const c = pow(Math.cos(t));
        const s = pow(Math.sin(t));
        const d = s > 0 ? a : b;
        if (along === 'y') positions.push(w * c, at, d * s);
        else positions.push(w * c, mid + d * s, at);
      }
    }
    // Round from +x towards +z (or +y), so this way round faces out.
    const up = along === 'y';
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < segs; i++) {
        const p = j * segs + i;
        const q = j * segs + ((i + 1) % segs);
        if (up) index.push(p, p + segs, q, q, p + segs, q + segs);
        else index.push(p, q, p + segs, q, q + segs, p + segs);
      }
    }
    // An end closed over: a fan from a point in the middle of its ring.
    const close = (j, first) => {
      const [at, , , , mid = 0] = rings[j];
      const c = positions.length / 3;
      if (up) positions.push(0, at, 0);
      else positions.push(0, mid, at);
      for (let i = 0; i < segs; i++) {
        const p = j * segs + i;
        const q = j * segs + ((i + 1) % segs);
        if (first === up) index.push(c, p, q);
        else index.push(c, q, p);
      }
    };
    if (ends[0]) close(0, true);
    if (ends[1]) close(rings.length - 1, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  });

// A box with its edges and corners rounded by r, for cabs and soles.
export const roundedBox = (w, h, d, r = Math.min(w, h, d) * 0.2, s = 3) =>
  geo(`rbox${w}|${h}|${d}|${r}|${s}`, () => {
    const g = new THREE.BoxGeometry(w, h, d, s, s, s);
    const pos = g.attributes.position;
    const hx = w / 2 - r;
    const hy = h / 2 - r;
    const hz = d / 2 - r;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const cx = Math.max(-hx, Math.min(hx, v.x));
      const cy = Math.max(-hy, Math.min(hy, v.y));
      const cz = Math.max(-hz, Math.min(hz, v.z));
      const out = new THREE.Vector3(v.x - cx, v.y - cy, v.z - cz);
      const len = out.length();
      if (len > 1e-9) out.multiplyScalar(r / len);
      pos.setXYZ(i, cx + out.x, cy + out.y, cz + out.z);
    }
    g.computeVertexNormals();
    return g;
  });

export function mesh(geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// Many small shapes, each placed by a matrix, as one shape: one draw for all
// of them. parts: [{ g: the shape, m: where it goes }]. bake makes a fresh one
// of the caller's own (to dispose); bakeCached shares it for good, like every
// other shape here. Only for parts that never move on their own.
const bakeV = new THREE.Vector3();
const bakeN = new THREE.Matrix3();

function baked(parts) {
  let count = 0;
  for (const { g } of parts) count += g.attributes.position.count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const indices = new Uint32Array(parts.reduce((n, { g }) => n + g.index.count, 0));
  let v = 0;
  let t = 0;
  for (const { g, m } of parts) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    bakeN.getNormalMatrix(m);
    for (let i = 0; i < pos.count; i++) {
      bakeV.fromBufferAttribute(pos, i).applyMatrix4(m).toArray(positions, (v + i) * 3);
      bakeV.fromBufferAttribute(nor, i).applyMatrix3(bakeN).normalize().toArray(normals, (v + i) * 3);
    }
    for (let i = 0; i < g.index.count; i++) indices[t + i] = g.index.array[i] + v;
    v += pos.count;
    t += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

export function bake(parts) {
  return baked(parts);
}

export function bakeCached(key, parts) {
  return geo(key, () => baked(parts));
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
