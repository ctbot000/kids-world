// The treasure chests of a dream of the Land of Nod, on a page (shared/nod/
// chests.js): each where the island says one stands, its lid flying open as
// somebody opens it, and the one beside you, for the Open button (game.js
// chestTarget), as on any island of the isle.
import { CHEST_TAKE_MS, chestMaterials, chestModel, openingChest } from '../render/chest-model.js';
import { quatOf } from '../render/nod/kit.js';
import { nodMaterial } from '../render/nod/light.js';
import { add, cross, dist3, dot, flat, len, mul, sub } from '../shared/nod/shape.js';

const BIG = 1.35;
// This near one (and on its side of things), you can open it.
const NEAR = 2.2;
// How near its middle you can get.
const KEEP = 0.75;
let materials = null;

export class ChestsView {
  constructor(nod, rows) {
    this.nod = nod;
    this.g = nod.g;
    this.at = new Map();
    this.rows(rows, true);
  }

  dispose() {
    for (const c of this.at.values()) c.model.removeFromParent();
    this.at.clear();
    if (this.g.chestTarget?.nod !== undefined) this.g.chestTarget = null;
    this.g.chestAt = null;
  }

  // Where they are, as the island tells it. quiet: as you arrive.
  rows(rows, quiet = false) {
    const seen = new Set();
    for (const row of Array.isArray(rows) ? rows.slice(0, 32) : []) {
      if (!Array.isArray(row)) continue;
      const [i, gold, open] = row;
      const spot = this.nod.world.chests[i];
      if (!spot) continue;
      seen.add(i);
      const was = this.at.get(i);
      if (was && was.gold === (gold === 1) && was.open === (open === 1)) continue;
      was?.model.removeFromParent();
      this.put(i, spot, gold === 1, open === 1);
      if (!quiet && !was) this.g.renderer.effects.sparkles(spot.x + spot.up.x * 0.5, spot.y + spot.up.y * 0.5, spot.z + spot.up.z * 0.5, 12, ['#ffd84d', '#fff3b0', '#ffffff']);
    }
    for (const [i, c] of this.at) {
      if (seen.has(i)) continue;
      c.model.removeFromParent();
      this.at.delete(i);
    }
  }

  put(i, spot, gold, open) {
    materials ??= chestMaterials((f) => nodMaterial({ ...f, envMapIntensity: (f.envMapIntensity ?? 0.5) * 0.8 }, { skin: 'fuzz = 0.1;', key: 'chest', mode: 'object' }));
    const model = chestModel(materials, `${gold ? 'gold' : 'treasure'}-chest${open ? '-open' : ''}`, this.cell(i));
    model.position.set(spot.x, spot.y, spot.z);
    // (Its front is the other way from the way it is turned.)
    quatOf(spot.up, mul(spot.dir, -1), model.quaternion);
    model.scale.setScalar(BIG);
    model.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    this.nod.view.group.add(model);
    this.at.set(i, { i, spot, gold, open, model });
  }

  // (Its opening is played by a cell: one of its own, which no block is in.)
  cell(i) {
    return [i, -9000, this.nod.world.springs.length];
  }

  // Each frame: their lids, a glint now and then, you kept out of them, and the
  // one you could open.
  update(dt) {
    const { w } = this.nod;
    const time = performance.now() / 1000;
    let near = null;
    let least = NEAR;
    for (const c of this.at.values()) {
      const { spot } = c;
      c.model.userData.tick?.(time);
      const gap = dist3(spot, w);
      if (gap > 40) continue;
      if (!c.open && Math.random() < dt * 0.9) {
        const q = add(add(spot, spot.up, 0.3 + Math.random() * 0.6), cross(spot.up, spot.dir), (Math.random() - 0.5) * 1.1);
        this.g.renderer.effects.add('sparkle', q.x, q.y, q.z, { vy: 0.3, size: 0.14 + Math.random() * 0.12, life: 0.7, color: c.gold ? '#ffd84d' : '#fff3b0', spin: 3 });
      }
      if (dot(spot.up, w.up) < 0.2) continue;
      const d = sub(w, spot);
      const along = flat(d, spot.up);
      const l = len(along);
      const high = dot(d, spot.up);
      if (l < KEEP && l > 1e-3 && high > -0.6 && high < 0.7 && !this.nod.fight.rolling && !this.nod.flight) {
        const k = ((KEEP - l) / l) * 0.6;
        w.x += along.x * k;
        w.y += along.y * k;
        w.z += along.z * k;
      }
      if (c.open || gap >= least) continue;
      least = gap;
      near = c;
    }
    const free = near && w.onGround && !this.g.dizzy && !this.g.watching && !this.nod.flight;
    this.g.chestTarget = free ? { nod: near.i, x: near.spot.x, y: near.spot.y, z: near.spot.z, open: false, gold: near.gold } : null;
  }

  // Somebody opened one: its lid flies up, and what is in it goes to them.
  opened(m) {
    const c = this.at.get(m.i);
    if (!c || c.open) return;
    const { spot, gold } = c;
    const g = this.g;
    openingChest(...this.cell(c.i));
    c.model.removeFromParent();
    this.put(c.i, spot, gold, true);
    const top = add(spot, spot.up, 0.75);
    if (dist3(spot, this.nod.w) < 40) g.treasureBurst(top.x, top.y - 0.7, top.z, gold);
    const { nod } = this;
    setTimeout(() => {
      if (g.nod !== nod) return;
      const p = g.players.get(m.pid)?.avatar?.root.position;
      g.renderer.effects.sparkles(top.x, top.y, top.z, 14, ['#ffd84d', '#fff3b0', '#ffffff']);
      if (!p || dist3(spot, nod.w) > 40) return;
      const up = g.players.get(m.pid)?.me ? nod.w.up : (g.players.get(m.pid)?.nodUp ?? spot.up);
      const to = add(p, up, 1);
      for (let i = 0; i < (gold ? 26 : 16); i++) {
        const life = 0.45 + Math.random() * 0.2;
        const s = add(top, { x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }, 0.4);
        g.renderer.effects.add(i % 5 ? 'coin' : 'sparkle', s.x, s.y, s.z, { vx: (to.x - s.x) / life, vy: (to.y - s.y) / life, vz: (to.z - s.z) / life, straight: true, color: i % 3 ? '#ffd84d' : '#ffe98a', size: 0.17 + Math.random() * 0.06, life, spin: 10, delay: i * 0.03 });
      }
    }, CHEST_TAKE_MS);
    if (m.pid === g.pid) g.chestWon(gold, top);
  }
}
