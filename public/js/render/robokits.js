// The robots built at the island's robot kits (shared/robokit.js), each
// standing on the little play mat in front of its kit's box, smiling on its
// light matrix, so everyone sees what was made there; and those let out,
// driving about the island as the island runs their programs, wheels
// turning, lamps and light matrix shining. Real models of their parts
// (render/robokit-parts.js) in toy materials, lit like the island.
import * as THREE from '../../vendor/three.module.js';
import { BLOCKS } from '../shared/blocks.js';
import { furnitureDrop } from '../shared/furniture.js';
import { BLOCK_CM, IMAGES } from '../shared/robokit.js';
import { kitMaterials, robotModel } from './robokit-parts.js';
import { STUD_HEIGHT } from './terrain.js';
import { toyMaterial } from './toon.js';

// How big a robot is on the island: its plate's 36 cm nearly a whole block.
const SCALE = 1 / BLOCK_CM;
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
    // The robots out on the island, by their kit's cell key: { model, sig,
    // info, to (where the island last said), at (where it is drawn) }.
    this.out = new Map();
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
    robot.visible = !this.out.has(key);
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
    for (const key of [...this.out.keys()]) this.dropBot(key);
  }

  // The robots out on the island (game.js bots, by kit key); `kitOf(key)`
  // gives a kit's { parts, id }, and `studded(x, y, z)` whether the floor a
  // robot is on has studs drawn on it: it rides on their tops, as a real one
  // on a baseplate does. Each out of its kit leaves the kit's mat empty.
  setBots(bots, kitOf, studded = () => false) {
    this.studded = studded;
    for (const key of [...this.out.keys()]) if (!bots.has(key)) this.dropBot(key);
    for (const [key, b] of bots) {
      const { parts } = kitOf(key);
      const sig = JSON.stringify(parts);
      let d = this.out.get(key);
      if (d && d.sig !== sig) {
        this.dropBot(key);
        d = null;
      }
      if (!d) {
        if (!parts.length) continue;
        this.mats ??= kitMaterials(toyMaterial);
        const model = robotModel(parts, this.mats);
        model.scale.setScalar(SCALE);
        this.group.add(model);
        d = { model, sig, info: model.userData.info, at: { ...b, d: { ...b.d } } };
        this.out.set(key, d);
      }
      d.to = b;
      const kit = this.shown.get(key);
      if (kit) kit.robot.visible = false;
    }
  }

  dropBot(key) {
    const d = this.out.get(key);
    if (!d) return;
    this.group.remove(d.model);
    d.model.userData.dispose();
    this.out.delete(key);
    const kit = this.shown.get(key);
    if (kit) kit.robot.visible = true;
  }

  // Each frame: the robots out glide on to where the island last said they
  // were (it says ten times a second), their wheels turning on with them.
  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const d of this.out.values()) {
      const { at, to } = d;
      if (Math.hypot(to.x - at.x, to.z - at.z) > 2 || Math.abs(to.y - at.y) > 3) Object.assign(at, { x: to.x, z: to.z, a: to.a });
      at.x += (to.x - at.x) * k;
      at.z += (to.z - at.z) * k;
      // It drops down a step quickly, as things fall.
      at.y += (to.y - at.y) * Math.min(1, k * 2);
      let da = to.a - at.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      at.a += da * k;
      const motors = {};
      for (const [p, deg] of Object.entries(to.d ?? {})) {
        at.d[p] = (at.d[p] ?? deg) + (deg - (at.d[p] ?? deg)) * k;
        motors[p] = { i: d.info.ports[p], deg: at.d[p] };
      }
      d.model.position.set(at.x, at.y + (this.studded?.(at.x, to.y, at.z) ? STUD_HEIGHT : 0), at.z);
      d.model.rotation.y = -(at.a - (d.info.front * Math.PI) / 2);
      d.model.userData.update({ motors, matrix: to.m, lamps: to.l ?? {} });
    }
  }
}
