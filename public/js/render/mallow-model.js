// A marshmallow on a stick (shared/mallow.js), held in a toaster's hand
// (render/avatar.js ANIM.toast): a pale wooden stick, and the marshmallow
// itself on its tip, its colour told by how brown it is, from white to
// golden to burnt black (mallowColor). The stick's grip at the origin and
// the marshmallow up +y, the way the fishing rod is held.
import * as THREE from '../../vendor/three.module.js';
import { mallowColor } from '../shared/mallow.js';
import { cone, cylinder, mesh, toyMaterial } from './toon.js';

// How long the stick is from its grip to the marshmallow's middle.
export const STICK_LEN = 0.52;

// A marshmallow on a stick, its grip at the origin and the marshmallow up
// +y. `brown` is how brown the marshmallow is already (shared/mallow.js);
// group.userData.setBrown(brown) browns it further as it toasts.
export function marshmallowStick(brown = 0) {
  const g = new THREE.Group();
  g.name = 'marshmallow';
  // The stick's own wood, and the marshmallow's material, which browns.
  const wood = toyMaterial({ color: '#b98a52', roughness: 0.7, envMapIntensity: 0.5 });
  const mallow = toyMaterial({ color: '#ffffff', roughness: 0.5, envMapIntensity: 0.7 });
  g.add(mesh(cylinder(0.014, 0.016, STICK_LEN), wood, 0, STICK_LEN / 2, 0));
  // The marshmallow: a short cylinder, rounded a little at each end.
  g.add(mesh(cylinder(0.05, 0.05, 0.08, 14), mallow, 0, STICK_LEN, 0));
  for (const s of [-1, 1]) {
    const cap = mesh(cone(0.05, 0.032, 14), mallow, 0, STICK_LEN + s * 0.054, 0);
    cap.rotation.x = (s * Math.PI) / 2;
    g.add(cap);
  }
  g.userData.setBrown = (b) => mallow.color.set(mallowColor(b));
  g.userData.setBrown(brown);
  return g;
}

// Where the marshmallow itself is in the world, while it is held: into `out`,
// or null when there is none.
export function stickTip(stick, out = new THREE.Vector3()) {
  if (!stick?.parent) return null;
  stick.updateWorldMatrix(true, false);
  out.set(0, STICK_LEN, 0).applyMatrix4(stick.matrixWorld);
  return out;
}
