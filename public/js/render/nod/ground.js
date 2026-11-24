// The ground of the Land of Nod's bodies (shared/nod/shape.js) as it is drawn:
// each body's own distances wrapped in one seamless skin, whatever its shape,
// with the shade that gathers in its folds (how much nearer something solid is,
// looking out from each point, than there would be on open ground) and which
// way is up at each point of it worked out as it is made.
import * as THREE from '../../../vendor/three.module.js';
import { gridLines, skinOver } from '../dog-sculpt.js';
import { nodMaterial } from './light.js';
import { SKINS } from './skins.js';

// How far out along the normal the shade is looked for.
const AO_STEPS = [0.35, 0.8, 1.6, 2.8];

// The skin of a body: positions, normals, which way is up and the shade at each.
// space: everything else that shades it too (its props, and what hangs near).
export function bodyGeometry(body, space = null, cell = body.cell) {
  const pad = cell * 2;
  // The box round it: as far as its ground goes, its bumps and all.
  let lo = null;
  if (body.box) lo = body.box;
  const R = body.reach + pad;
  const from = (a) => (lo ? body.c[a] - lo[a] - pad : body.c[a] - R);
  const to = (a) => (lo ? body.c[a] + lo[a] + pad : body.c[a] + R);
  const lines = (a) => gridLines(from(a), to(a), cell);
  const field = { at: (x, y, z) => body.ground(x, y, z) };
  const { points, tris } = skinOver(field, lines('x'), lines('y'), lines('z'));
  const count = points.length / 3;
  const normal = new Float32Array(points.length);
  const up = new Float32Array(points.length);
  const ao = new Float32Array(count);
  const n = {};
  const u = {};
  for (let i = 0; i < count; i++) {
    let x = points[i * 3];
    let y = points[i * 3 + 1];
    let z = points[i * 3 + 2];
    body.slope(x, y, z, n, cell * 0.3);
    // On to the surface itself.
    const d = body.ground(x, y, z);
    points[i * 3] = x -= n.x * d;
    points[i * 3 + 1] = y -= n.y * d;
    points[i * 3 + 2] = z -= n.z * d;
    body.slope(x, y, z, n, Math.min(0.12, cell * 0.25));
    body.up(x, y, z, u);
    normal.set([n.x, n.y, n.z], i * 3);
    up.set([u.x, u.y, u.z], i * 3);
    let shade = 0;
    let most = 0;
    for (const s of AO_STEPS) {
      const px = x + n.x * s;
      const py = y + n.y * s;
      const pz = z + n.z * s;
      const open = space ? space.dist(px, py, pz, 3) : body.solid(px, py, pz);
      const k = 1 / s;
      shade += k * Math.max(0, s - Math.max(0, open));
      most += k * s;
    }
    ao[i] = 1 - Math.min(1, (shade / most) * 1.5) * 0.85;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(points, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('aUp', new THREE.BufferAttribute(up, 3));
  g.setAttribute('aAo', new THREE.BufferAttribute(ao, 1));
  g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(tris) : new Uint16Array(tris), 1));
  g.computeBoundingSphere();
  return g;
}

// A body's own axes, for the patterns on it: its ring's or disc's axis is its y.
function axesOf(body) {
  const s = body.skel;
  const Y = body.axis ?? s.axis ?? s.Y ?? { x: 0, y: 1, z: 0 };
  const y = new THREE.Vector3(Y.x, Y.y, Y.z).normalize();
  const pick = s.X ? new THREE.Vector3(s.X.x, s.X.y, s.X.z) : Math.abs(y.x) < 0.8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const x = pick.clone().addScaledVector(y, -pick.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix3().set(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z);
}

// A body's material: its skin (skins.js), its own colours.
export function bodyMaterial(body) {
  const skin = SKINS[body.skin] ?? SKINS.plain;
  const uniforms = {};
  for (const [key, value] of Object.entries({ ...skin.uniforms, ...(body.look ?? {}) })) uniforms[key] = { value: Array.isArray(value) ? value.map((c) => (typeof c === 'string' ? new THREE.Color(c) : c)) : typeof value === 'string' ? new THREE.Color(value) : value };
  if (body.skel.R && !uniforms.uR) uniforms.uR = { value: body.skel.R };
  const m = nodMaterial(skin.params ?? {}, { skin: skin.glsl, head: skin.head ?? '', uniforms, key: body.skin });
  m.userData.nod.uBodyC.value.set(body.c.x, body.c.y, body.c.z);
  m.userData.nod.uBodyM.value.copy(axesOf(body));
  return m;
}
