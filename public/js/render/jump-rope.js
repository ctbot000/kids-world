// A jump rope in someone's hands (render/avatar.js ANIM.rope, turned as far
// as shared/jump-rope.js says). Coiled up on the ground it is one of the
// vehicle models (render/vehicle-models.js), in the same colours.
import * as THREE from '../../vendor/three.module.js';
import { cylinder, geo, mesh, toon } from './toon.js';

export const ROPE_TONE = '#ff5f9e';
export const GRIP_TONE = '#3f8ff0';
// How far each hand is from the middle in the rope as it is made (it is
// stretched to fit the hands that hold it).
const REACH = 0.3;

// From one hand out and down, under the feet (a drop of 1, stretched to what
// it has to reach) and back up to the other: squarish, so that it stays wide
// enough round a big head at the top.
class Loop extends THREE.Curve {
  getPoint(u, out = new THREE.Vector3()) {
    const down = Math.sin(u * Math.PI);
    const side = Math.cos(u * Math.PI);
    return out.set((REACH + 0.2 * down) * Math.sign(side) * Math.abs(side) ** 0.6, -(down ** 0.85), 0);
  }
}

export function heldRope() {
  const g = new THREE.Group();
  g.name = 'jump rope';
  g.add(mesh(geo('jump-rope', () => new THREE.TubeGeometry(new Loop(), 40, 0.017, 6)), toon(ROPE_TONE)));
  for (const side of [-1, 1]) g.add(mesh(cylinder(0.021, 0.021, 0.15, 10), toon(GRIP_TONE), side * REACH, -0.02, 0));
  return g;
}

// Hung between two hands (where they are on the body), turn of the way round
// them: reaching below down from them at the bottom, above up from them at
// the top, and as far as it comes between the two on the way.
export function placeRope(rope, left, right, turn, below, above) {
  rope.position.addVectors(left, right).multiplyScalar(0.5);
  rope.rotation.x = turn;
  rope.scale.set(Math.abs(right.x - left.x) / (2 * REACH), below + ((above - below) * (1 - Math.cos(turn))) / 2, 1);
}
