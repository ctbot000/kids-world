// The Monster Gashapon's figures (shared/gashapon.js MONSTER_FIGURES): the
// island's own monster models (monster-model.js and the rest), the very
// same ones that hop about, stood still in their idle pose, about a unit
// tall, standing on the origin and facing -z like the capsule toys
// (capsule-toys.js) — King Grumble without his bubble or his stomp ring.
//
// Their materials are the island's (toon.js), lit by its studio light: a
// window drawing them in a WebGL context of its own swaps them for copies
// lit there (render/gasha-stage.js).
import * as THREE from '../../vendor/three.module.js';
import { STOMP } from '../shared/monsters.js';
import { MONSTER_FIGURES } from '../shared/gashapon.js';
import { KingModel } from './adventure-models.js';
import { MonsterModel } from './monster-model.js';
import { MosquitoModel } from './mosquito-model.js';
import { SpiderModel } from './spider-model.js';

const TALL = 0.95;

// The box round what of a model shows (King Grumble's hidden bubble left out).
export function shownBox(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  obj.traverseVisible((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return box;
}

function modelOf(f) {
  if (f.monster === 'king') {
    const k = new KingModel(f.theme ?? 'sunny', STOMP.reach);
    k.update(0, 'idle', 0, false, false);
    k.bubble.visible = false;
    k.bubbleRim.visible = false;
    k.ring.visible = false;
    return k;
  }
  const m = f.monster === 'mosquito' ? new MosquitoModel(f.theme ?? 'sunny', 1) : f.monster === 'spider' ? new SpiderModel(f.theme ?? 'sunny', 1) : new MonsterModel(f.theme ?? 'sunny', f.monster);
  m.update(0, 'idle', 0, false);
  return m;
}

// The figure of a monster figure by its key, or null.
export function monsterFigure(key) {
  const f = MONSTER_FIGURES.find((t) => t.key === key);
  if (!f) return null;
  const model = modelOf(f);
  const inner = model.group;
  // The monsters face +z as they go; a figure faces -z.
  inner.rotation.y = Math.PI;
  const out = new THREE.Group();
  out.name = `figure ${key}`;
  out.add(inner);
  // Sized and stood on the ground, whatever its own size.
  const size = shownBox(out).getSize(new THREE.Vector3());
  const k = TALL / Math.max(size.y, size.x * 0.8, 0.01);
  inner.scale.multiplyScalar(k);
  const b2 = shownBox(out);
  const mid = b2.getCenter(new THREE.Vector3());
  inner.position.set(inner.position.x - mid.x, inner.position.y - b2.min.y, inner.position.z - mid.z);
  return out;
}
