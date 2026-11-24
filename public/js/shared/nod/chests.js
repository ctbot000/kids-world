// Treasure chests in the Land of Nod, as on any island of Adventure Isle
// (treasure.js): each locked, one of them golden, and a key from a quiz opens
// one. They stand about a dream's bodies, at spots of its own (maker.js
// hideChests), away from where its nightmares are; opened, one shows its gold a
// while and goes, and another turns up at another spot later. The host keeps
// them; a page is told where they are, and draws them (nod/chests-view.js).
import { Rng } from '../rng.js';
import { CHEST_AGAIN_MS, CHEST_OPEN_MS, CHEST_REACH } from '../treasure.js';
import { dist3 } from './shape.js';

// How many are out at once.
export const CHESTS_OUT = 5;

export class DreamChests {
  // spots: where one may stand, { x, y, z, up } each.
  constructor(spots, seed = 1) {
    this.spots = spots;
    this.rng = new Rng(seed);
    // { i (which spot), gold, openedAt (0: still locked) } each.
    this.list = [];
    // When the next one turns up (0: not counting yet).
    this.next = 0;
    for (let k = 0; k < Math.min(CHESTS_OUT, spots.length); k++) this.put();
  }

  // A new one at a spot with none: a golden one whenever there is none.
  put() {
    const free = this.spots.map((_, i) => i).filter((i) => !this.list.some((c) => c.i === i));
    if (!free.length) return;
    this.list.push({ i: this.rng.pick(free), gold: !this.list.some((c) => c.gold), openedAt: 0 });
  }

  // Now and then: whether anything changed.
  step(now) {
    const was = this.list.length;
    this.list = this.list.filter((c) => !c.openedAt || now - c.openedAt < CHEST_OPEN_MS);
    let changed = this.list.length !== was;
    if (this.list.length >= Math.min(CHESTS_OUT, this.spots.length)) this.next = 0;
    else if (!this.next) this.next = now + this.rng.range(...CHEST_AGAIN_MS);
    else if (now >= this.next) {
      this.put();
      this.next = 0;
      changed = true;
    }
    return changed;
  }

  // Somebody at p opening the one at spot i: it, or null when there is none
  // there to be opened, or they are nowhere near it.
  open(p, i, now) {
    const c = this.list.find((o) => o.i === i);
    if (!c || c.openedAt || dist3(this.spots[i], p) > CHEST_REACH) return null;
    c.openedAt = now;
    return c;
  }

  // Each for the wire: [spot, golden, open].
  pack() {
    return this.list.map((c) => [c.i, c.gold ? 1 : 0, c.openedAt ? 1 : 0]);
  }
}
