// The Golden Mimic (shared/beasts.js), a fake golden chest found out
// (shared/treasure.js): shut, nothing but the golden chest it was — the very
// same model as a golden chest's own (chest-model.js), in the same gold,
// purple bands and jewels, padlock and all, so it does not change a hair as
// it takes the chest's place. Then its padlock drops away, the lid flies up
// on rows of teeth, a long tongue lolls out over the rim, two eyes glare out
// of the dark inside, and up it gets on four golden clawed feet, growing a
// third as big again. Cross, it holds a coin of fool's gold up in its mouth
// before it spits it. Shut again, it is a golden chest once more, but now and
// then it lifts its lid a crack and peeks.
//
// On its feet at y = 0 and facing +z, as every beast's (beast-kit.js).
import { at, baked, Beast, crossEye, ease, group, moving } from './beast-kit.js';
import { chestMaterials, chestPieces } from './chest-model.js';
import { capsule, cone, cylinder, mesh, sphere, toon, torus, toyMaterial } from './toon.js';

// The chest's own materials, made once for every Golden Mimic (a blow's
// white flash swaps a mesh's material, never changes these).
let materials = null;
// How much bigger it grows up on its feet, and how high they lift it.
const GROW = 0.3;
const LEGS = 0.16;

export class GoldMimicModel extends Beast {
  // Mouth open: shut, it would be only a golden chest.
  figurePose() {
    this.update(1, 'giggle', 0, false);
  }

  constructor() {
    super({ height: 1.05, center: 0.5, pick: 0.6, radius: 0.5, glow: '#ffef7a', white: '#fff7d6' });
    materials ??= chestMaterials(toyMaterial);
    const { box, lid, lock, size } = chestPieces(materials, true);
    const { w: W, d: D, h: H } = size;
    this.size = size;
    const b = this.body;
    // All that stands on its feet, lifted as they come out.
    this.top = group(b);
    // The chest, turned to face +z as a monster does (a chest faces -z).
    this.chest = group(this.top);
    this.chest.rotation.y = Math.PI;
    this.chest.add(box, lid, lock);
    this.lid = lid;
    this.lock = lock;
    const tooth = toon('#fffdf0');
    // Teeth all round the rim of the box, but along the hinge.
    const rim = [];
    for (let i = -4; i <= 4; i++) rim.push([cone(0.03, 0.09, 6), at(i * 0.075, H + 0.035, D / 2 - 0.04)]);
    for (const x of [-1, 1]) for (let i = -2; i <= 1; i++) rim.push([cone(0.026, 0.075, 6), at(x * (W / 2 - 0.04), H + 0.028, i * 0.09 + 0.06)]);
    this.top.add(baked('goldmimic-teeth', tooth, rim));
    // And under the lid's rim, in the lid's own frame (a chest's: its hinge
    // at the origin, its front edge 2R towards -z), pointing down.
    const R = size.r;
    const top = [];
    for (let i = -4; i <= 4; i++) top.push([cone(0.03, 0.09, 6), at(i * 0.075, -0.03, -2 * R + 0.04, 1, 1, 1, Math.PI, 0, 0)]);
    for (const x of [-1, 1]) for (let i = 0; i < 3; i++) top.push([cone(0.026, 0.075, 6), at(x * (W / 2 - 0.04), -0.025, -0.12 - i * 0.11, 1, 1, 1, Math.PI, 0, 0)]);
    lid.add(baked('goldmimic-lid-teeth', tooth, top));
    // Gold coins heaped at the back of its throat, glinting.
    const coin = toon('#ffcc33', { emissive: 0.45 });
    this.top.add(baked('goldmimic-coins', coin, [[-0.2, -0.1], [-0.08, -0.14], [0.05, -0.1], [0.18, -0.13], [-0.13, -0.03], [0.12, -0.04]].map(([x, z], i) => [cylinder(0.05, 0.05, 0.016, 12), at(x, H - 0.07 + (i % 3) * 0.01, z, 1, 1, 1, 0.25 * (i % 2 ? 1 : -1), 0, 0.2 * (i - 2))])));
    // Two eyes in the dark inside, at the back, over the coins.
    for (const side of [-1, 1]) crossEye(this, this.top, side, side * 0.14, H + 0.07, -0.08, { w: 0.075, slope: 0.5 });
    // A long tongue, lolling out over the front of the rim.
    this.tongue = group(this.top, 0, H - 0.02, 0);
    this.tongue.add(mesh(sphere(1, 12, 8), toon('#ff6f8e'), 0, 0, 0.2, 0.12, 0.028, 0.3));
    this.tongue.add(mesh(sphere(1, 8, 6), toon('#e8526f'), 0, 0.022, 0.2, 0.01, 0.008, 0.24));
    // A coin of fool's gold held up in its mouth, about to be spat.
    this.spit = group(this.top, 0, H + 0.12, 0.08);
    this.spit.add(mesh(cylinder(0.11, 0.11, 0.03, 18), toon('#ffcc33', { emissive: 0.5 }), 0, 0, 0).rotateX(Math.PI / 2));
    this.spit.add(mesh(torus(0.105, 0.012), toon('#e0a21c', { emissive: 0.3 }), 0, 0, 0));
    this.spit.visible = false;
    this.mouth = group(this.top, 0, H + 0.1, 0.12);
    // Four golden legs, tucked away under it while it is a chest, each with a
    // clawed foot.
    const leg = toon('#e3b23b');
    const claw = toon('#fff4d6');
    this.feet = [];
    for (const [x, z] of [[-0.27, 0.16], [0.27, 0.16], [-0.27, -0.16], [0.27, -0.16]]) {
      const foot = group(b, x, LEGS, z);
      foot.add(mesh(capsule(0.05, 0.1), leg, 0, -LEGS / 2, 0));
      foot.add(mesh(sphere(1, 10, 8), leg, 0, -LEGS + 0.03, 0.02, 0.075, 0.035, 0.09));
      for (const c of [-1, 0, 1]) foot.add(mesh(cone(0.018, 0.05, 5), claw, c * 0.04, -LEGS + 0.025, 0.1).rotateX(Math.PI / 2));
      this.feet.push(foot);
    }
    this.open = 0;
    this.lift = 0;
    this.shadowBase = this.shadowScale;
    this.update(0, 'idle');
  }

  update(dt, state, air = 0, night = false) {
    this.bounce(dt, air);
    const t = this.time;
    const shut = state === 'idle';
    // Shut, now and then it lifts its lid a crack and peeks.
    const peek = Math.max(0, Math.sin(t * 0.6) - 0.97) * 4;
    // Chomp, chomp as it comes; wide open giggling, leaping or about to spit.
    const chomp = 0.35 + Math.abs(Math.sin(t * (state === 'chase' ? 9 : 5))) * 0.6;
    const want = shut ? peek : state === 'giggle' || state === 'leap' ? 1.1 : state === 'hurl' ? 1.25 : state === 'dazed' ? 0.3 : moving(state) ? chomp : 0.6;
    this.open = ease(this.open, want, shut ? 14 : 20, dt);
    // (A chest's lid opens turning +x about its hinge.)
    this.lid.rotation.x = this.open * 1.1;
    this.tongue.visible = this.open > 0.2;
    const tongue = Math.min(1, this.open * 1.3);
    this.tongue.scale.set(0.7 + tongue * 0.3, 1, Math.max(0.01, tongue));
    this.tongue.rotation.x = state === 'giggle' ? 0.45 + Math.sin(t * 22) * 0.2 : 0.2 + Math.sin(t * 7) * 0.08;
    this.spit.visible = state === 'hurl';
    if (this.spit.visible) this.spit.rotation.y = t * 9;
    // Up on its feet, bigger, once it is up and about; and back down to just
    // a chest's size, shut.
    this.lift = ease(this.lift, shut ? 0 : 1, shut ? 8 : 14, dt);
    if (shut && this.lift < 0.002) this.lift = 0;
    // Its padlock gone as it wakes (and back on, shut again).
    this.lock.visible = this.lift < 0.05 && this.open < 0.15;
    const crouch = state === 'leap' && air < 0.1;
    this.top.position.y = this.lift * (crouch ? 0.04 : LEGS);
    this.feet.forEach((f, i) => {
      const k = moving(state) && air < 0.2 ? Math.sin(t * 16 + i * Math.PI) * 0.45 : 0;
      f.visible = this.lift > 0.05;
      f.rotation.x = k;
      f.scale.set(1, Math.max(0.01, this.lift) * (crouch ? 0.3 : 1), 1);
    });
    const grow = 1 + GROW * this.lift;
    this.body.scale.set(grow * (1 + this.squash * 0.3), grow * (1 - this.squash * 0.55), grow * (1 + this.squash * 0.3));
    this.body.rotation.set(0, 0, state === 'giggle' ? Math.sin(t * 22) * 0.1 : state === 'dazed' ? Math.sin(t * 6) * 0.1 : crouch ? Math.sin(t * 40) * 0.03 : 0);
    // No round shadow under a chest.
    this.shadowScale = this.shadowBase * (0.02 + 0.98 * this.lift) * grow;
    this.mood(state, night);
  }
}
