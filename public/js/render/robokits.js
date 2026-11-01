// The robots built at the island's robot kits (shared/robokit.js), each
// standing on the little play mat in front of its kit's box, smiling on its
// light matrix, so everyone sees what was made there. Real models of their
// parts (render/robokit-parts.js) in toy materials, lit like the island.
import * as THREE from '../../vendor/three.module.js';
import { BLOCKS } from '../shared/blocks.js';
import { furnitureDrop } from '../shared/furniture.js';
import { IMAGES } from '../shared/robokit.js';
import { kitMaterials, robotModel } from './robokit-parts.js';
import { toyMaterial } from './toon.js';

// How big a robot is on the island: its plate's 36 cm nearly a whole block.
const SCALE = 0.025;
// Where it stands in its kit's cell (laid out facing -z): on the mat.
const SPOT = { x: 0, z: -0.2, y: 0.014 };
// A cell's turn for the way a block faces, as render/terrain.js has it.
const FACING = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

export class RoboKits {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'robot-kits';
    scene.add(this.group);
    // By cell key: { holder, robot, sig }.
    this.shown = new Map();
  }

  // The robot of the kit at (x, y, z), block `id` (which way it faces), new
  // or changed; `below` is the block under it (a table lifts it).
  show(key, id, below, x, y, z, parts) {
    let d = this.shown.get(key);
    const sig = `${id}|${below}|${JSON.stringify(parts)}`;
    if (d?.sig === sig) return;
    if (d) this.remove(key);
    if (!parts.length) return;
    this.mats ??= kitMaterials(toyMaterial);
    const holder = new THREE.Group();
    holder.position.set(x + 0.5, y + furnitureDrop(id, below), z + 0.5);
    holder.rotation.y = FACING[BLOCKS[id]?.front] ?? 0;
    const robot = robotModel(parts, this.mats);
    robot.scale.setScalar(SCALE);
    robot.position.set(SPOT.x, SPOT.y, SPOT.z);
    // Its hub's front the way the kit faces.
    robot.rotation.y = (robot.userData.info.front * Math.PI) / 2;
    robot.userData.update({ matrix: IMAGES.happy.px });
    holder.add(robot);
    this.group.add(holder);
    d = { holder, robot, sig };
    this.shown.set(key, d);
  }

  remove(key) {
    const d = this.shown.get(key);
    if (!d) return;
    this.group.remove(d.holder);
    d.robot.userData.dispose();
    this.shown.delete(key);
  }

  clear() {
    for (const key of [...this.shown.keys()]) this.remove(key);
  }
}
