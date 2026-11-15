// Treasure chests on Adventure Isle, the shared isle (blocks.js CHEST):
// a few lie about the island, each locked. A key opens one, and keys come
// only from quizzes (quiz.js) after a win: each camp you help free offers
// one quiz for a key (game.js keyOffers), answered right a 🔑 key, and a
// whole stage won offers one for a 👑 golden key. One of the chests is a
// golden chest (blocks.js GOLD_CHEST), which only a golden key opens and
// which holds far more. Opened, a chest shows its gold for everyone and
// pays its treasure to whoever opened it (coins, and now and then an HP
// potion); a while after, it goes, and another turns up somewhere else on
// the island later.
//
// The island keeps the chests (Chests, run by the room on the shared isle
// only, as it runs the Monster Gashapon): where they are and when each was
// opened. Your keys are your own, kept with the rest of what you carry on
// the isle (profile.js keys), and spent only once the island says it was
// you who opened the chest, so two at one chest never both lose a key.
import * as B from './blocks.js';
import { cellNear } from './arcade.js';
import { campDistance } from './monsters.js';
import { Rng } from './rng.js';

export { KEYS_MAX } from './shop.js';

export const isChest = (id) => B.BLOCKS[id]?.model === 'treasure-chest' || B.BLOCKS[id]?.model === 'gold-chest';
export const isOpenChest = (id) => B.BLOCKS[id]?.model === 'treasure-chest-open' || B.BLOCKS[id]?.model === 'gold-chest-open';
// A golden chest, shut or open: the special one.
export const isGoldChest = (id) => B.BLOCKS[id]?.model === 'gold-chest' || B.BLOCKS[id]?.model === 'gold-chest-open';

// The chest nearest a body standing beside it (or a step below it, as one
// on a ledge), shut or open: { x, y, z, open, gold, key } of its cell, or
// null.
export const chestNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isChest(id) ? { open: false, gold: isGoldChest(id) } : isOpenChest(id) ? { open: true, gold: isGoldChest(id) } : null), reach, 1);

// How many chests lie about the island: four on stage 1, one more every
// second stage after, eight at the most.
export const chestCount = (stage = 1) => Math.min(8, 4 + Math.floor((Math.max(1, stage) - 1) / 2));
// An opened chest stays open this long, and the next turns up somewhere
// else between these long after it went.
export const CHEST_OPEN_MS = 30_000;
export const CHEST_AGAIN_MS = [40_000, 90_000];
// How far from a chest (to its middle) you open it, as the island checks.
export const CHEST_REACH = 3.2;
// No chest lies this near the island's start, or another chest.
const APART = 8;

// What is in a chest, for whoever opened it: coins, more on the higher
// stages, and one time in four an HP potion. A golden chest holds four
// times the coins, an HP potion always and a diamond. rand: 0 to 1.
export function chestTreasure(rand = Math.random, stage = 1, gold = false) {
  const s = Math.min(10, Math.max(1, stage));
  const coins = 5 + 2 * s + Math.floor(rand() * 6);
  return gold ? { coins: coins * 4, potion: true, diamond: true } : { coins, potion: rand() < 0.25, diamond: false };
}

export class Chests {
  // spots: where a chest may go ([x, y, z] each, on the ground beside the
  // way through one of Adventure Isle's maps: isle-maps.js), or none for
  // anywhere on open ground.
  constructor(seed = 1, spots = null) {
    this.rng = new Rng(seed);
    this.spots = Array.isArray(spots) && spots.length ? spots : null;
    // { x, y, z, openedAt (0: still locked) } each.
    this.list = [];
    // When the next one turns up (0: not counting yet); placed: whether the
    // first lot has gone down.
    this.next = 0;
    this.placed = false;
  }

  // Now and then: opened chests gone once their while is up, and new ones
  // put down until there are as many as the stage has (all at once at
  // first, then one at a time). camps: the adventure's (none goes in one).
  // Returns the cells changed: [x, y, z, id] each.
  step(world, now, { stage = 1, camps = [] } = {}) {
    const out = [];
    this.list = this.list.filter((c) => {
      const id = world.get(c.x, c.y, c.z);
      if (!isChest(id) && !isOpenChest(id)) return false;
      if (!c.openedAt || now - c.openedAt < CHEST_OPEN_MS) return true;
      out.push([c.x, c.y, c.z, B.AIR]);
      return false;
    });
    const want = chestCount(stage);
    if (this.list.length >= want) {
      this.next = 0;
    } else if (!this.placed) {
      for (let i = this.list.length; i < want; i++) this.put(world, camps, out);
      this.placed = true;
    } else if (!this.next) {
      this.next = now + this.rng.range(...CHEST_AGAIN_MS);
    } else if (now >= this.next) {
      this.put(world, camps, out);
      this.next = 0;
    }
    for (const [x, y, z, id] of out) world.set(x, y, z, id);
    return out;
  }

  // A new chest somewhere on open ground, facing a way of its own: a
  // golden one whenever the island has none, a wooden one otherwise.
  put(world, camps, out) {
    const spot = this.spot(world, camps);
    if (!spot) return;
    const gold = !this.list.some((c) => c.gold);
    this.list.push({ ...spot, gold, openedAt: 0 });
    out.push([spot.x, spot.y, spot.z, B.turnedTo(gold ? B.GOLD_CHEST : B.CHEST, this.rng.int(0, 3))]);
  }

  // Somewhere for a chest: on top of the ground (not on a tree, a tent or
  // furniture, or under the water), out of every camp and the castle, and
  // away from the start and the other chests. Null when nowhere will do.
  spot(world, camps = []) {
    const rng = this.rng;
    const edge = 4;
    for (let tries = 0; tries < 200; tries++) {
      const at = this.spots ? rng.pick(this.spots) : null;
      const x = at ? at[0] : rng.int(edge, world.W - 1 - edge);
      const z = at ? at[2] : rng.int(edge, world.D - 1 - edge);
      let y = at ? at[1] : world.H - 2;
      while (!at && y > 1 && world.get(x, y - 1, z) === B.AIR) y--;
      const under = world.get(x, y - 1, z);
      if (!B.SOLID[under] || B.TREE_PART[under] || B.CLOTH[under] || B.KIND[under] === B.K_FURNITURE || under === B.GLOOM) continue;
      if (y <= world.sea || world.get(x, y, z) !== B.AIR || world.get(x, y + 1, z) !== B.AIR) continue;
      if (camps.some((c) => campDistance(c, x + 0.5, z + 0.5) <= c.r + 3)) continue;
      if (Math.hypot(world.spawn.x - x - 0.5, world.spawn.z - z - 0.5) < APART) continue;
      if (this.list.some((c) => Math.hypot(c.x - x, c.z - z) < APART)) continue;
      return { x, y, z };
    }
    return null;
  }

  // Someone opening the chest at (x, y, z): the cells that open it, or null
  // when there is no locked chest there.
  open(world, x, y, z, now) {
    const c = this.list.find((o) => o.x === x && o.y === y && o.z === z);
    const id = world.get(x, y, z);
    if (!c || c.openedAt || !isChest(id)) return null;
    c.openedAt = now;
    const cells = [x, y, z, B.turnedTo(isGoldChest(id) ? B.GOLD_CHEST_OPEN : B.CHEST_OPEN, B.BLOCKS[id].front)];
    world.set(...cells);
    return cells;
  }
}
