// What a monster drops when it is popped: its loot. Out of it comes a little
// shower of treasure for everyone on the island to see — 🪙 coins (a 💰 bag
// of them, from the bigger ones), and now and then a ❤️ heart, a 🧪 HP potion
// or a jewel — tumbling down round where it went pop and lying there,
// glinting, until somebody walks up to it. Then it flies to them.
//
// It is everybody's who helped: whoever picks it up, they and everyone who
// had a bop at that monster lately all get the same (so nobody takes anything
// from anybody, and friends can fetch it for each other). Left lying, it
// flies to them by itself after a while, wherever on the island they are, so
// nothing anyone earned is ever lost. A heart is HP back, at once (the
// island's to give: room.js); the rest goes in your purse, your pocket and
// your basket, on your own page (game.js lootGot).
//
// The bigger and tougher the monster, the more it drops: a few coins for a
// blob, a bag of them from the mightiest beasts, and from a chapter's boss a
// fountain of them for everyone on the island, jewels and an HP potion among
// them, flying to everyone a moment after. The rarer things come oftener on
// the higher stages of Adventure Isle.
//
// The island works out what drops and where each thing comes down (lootOf,
// lootSpots), and keeps what is lying about (Loot), never saved; each page
// draws it (loot-view.js).
import { BEASTS } from './beasts.js';
import * as B from './blocks.js';
import { isBoss } from './bosses.js';
import { KINDS } from './monsters.js';
import { raycast } from './raycast.js';
import { Rng } from './rng.js';
import { add, flatUnit, turn } from './nod/shape.js';

// What there is to drop, in the order the wire sends them (new ones go on
// the end).
export const LOOT_KINDS = ['coin', 'bag', 'heart', 'potion', 'ruby', 'sapphire', 'emerald', 'amethyst', 'diamond'];
export const JEWELS = ['ruby', 'sapphire', 'emerald', 'amethyst', 'diamond'];
// How a jewel is picked when one drops: rubies the commonest, amethysts the
// rarest (a diamond only ever from a boss or the mightiest beasts).
const JEWEL_ODDS = [
  ['ruby', 0.38],
  ['sapphire', 0.3],
  ['emerald', 0.2],
  ['amethyst', 0.12],
];
// A bag holds this many coins.
export const BAG = 5;
// A heart picked up gives this much HP back (two bumps' worth).
export const HEART_HP = 40;
// What is left lying flies by itself to whoever it is for after this long;
// a boss's fountain, after a moment to see it.
export const LOOT_LIFE_MS = 30_000;
export const BOSS_LOOT_MS = 3_500;
// A bop within this long before the pop is helping.
export const HELP_MS = 20_000;
// How near you walk to something lying there to pick it up (side to side,
// from your middle to its; and up or down), as your page sees it; the island
// lets a little more through, as you have moved on a little by the time it
// hears.
export const PICK_REACH = 1.9;
export const PICK_HIGH = [-1.6, 2.4];
export const TAKE_SLACK = 4;
// At most this much lies about an island at once: past it, the oldest flies
// off to whoever it is for.
export const MAX_LOOT = 96;

// How much each kind of monster drops: coins (as few and as many), and the
// chance of a heart, an HP potion and a jewel. A beast drops its own coins
// (beasts.js) and the boss its own (bossCoins).
const TIERS = {
  tiny: { coins: [1, 1], heart: 0.05, potion: 0, jewel: 0.01 },
  little: { coins: [1, 2], heart: 0.12, potion: 0.02, jewel: 0.02 },
  middling: { coins: [2, 3], heart: 0.18, potion: 0.04, jewel: 0.05 },
  tough: { coins: [3, 5], heart: 0.25, potion: 0.06, jewel: 0.1 },
  queen: { coins: [8, 10], heart: 1, potion: 0.3, jewel: 0.6 },
  beast: { heart: 0.4, potion: 0.1, jewel: 0.25 },
  mighty: { heart: 0.7, potion: 0.3, jewel: 1, diamond: 0.1 },
  boss: { heart: 0, potion: 1, jewels: 2, diamond: 0.25 },
};

// Which of those a monster is. march: one marching on a tower defense
// island (King Grumble there is only tough); nod: a fright of the Land of
// Nod (shared/nod/foes.js), by its spec.
export function tierOf(kind, { march = false, nod = null } = {}) {
  if (nod) return nod.boss ? 'boss' : nod.guard === 'none' ? 'little' : nod.hearts >= 3 ? 'tough' : 'middling';
  if (isBoss(kind)) return march ? 'tough' : 'boss';
  const beast = BEASTS[kind];
  if (beast) return beast.tier === 2 ? 'mighty' : 'beast';
  if (kind === 'queen') return 'queen';
  if (kind === 'cub') return 'tiny';
  const hearts = KINDS[kind]?.hearts ?? 3;
  return hearts >= 8 ? 'tough' : hearts >= 4 ? 'middling' : 'little';
}

// A boss's coins: more on the higher stages.
export const bossCoins = (level = 1) => 14 + 2 * Math.min(10, Math.max(1, level));

// What popping one drops: [{ k, n }], coins first (in pieces: coinPieces).
// rand: 0 to 1; level: how high a stage of Adventure Isle (1 anywhere else),
// the higher the likelier the rarer things.
export function lootOf(kind, rand = Math.random, { level = 1, march = false, nod = null } = {}) {
  const tier = TIERS[tierOf(kind, { march, nod })];
  const luck = 1 + Math.min(1, Math.max(0, level - 1) / 20);
  const beast = nod ? null : BEASTS[kind];
  const boss = tier === TIERS.boss;
  const [lo, hi] = tier.coins ?? [0, 0];
  const coins = boss ? bossCoins(level) : beast ? beast.coins : lo + Math.floor(rand() * (hi - lo + 1));
  const out = coinPieces(coins);
  if (tier.heart && rand() < tier.heart) out.push({ k: 'heart', n: 1 });
  if (tier.potion && rand() < Math.min(1, tier.potion * luck)) out.push({ k: 'potion', n: 1 });
  // A Mimic is a treasure chest: there is always a jewel in it.
  const jewels = tier.jewels ?? (kind === 'mimic' && beast ? 1 : rand() < Math.min(1, tier.jewel * luck) ? 1 : 0);
  for (let i = 0; i < jewels; i++) out.push({ k: pickJewel(rand), n: 1 });
  if (tier.diamond && rand() < Math.min(1, tier.diamond * luck)) out.push({ k: 'diamond', n: 1 });
  return out;
}

// What a kind of monster drops, for the monster collection (ui.js
// monsterBook): its coins, as few and as many (a boss's, from its first
// stage to its highest), and the chance of a heart, an HP potion and a jewel
// with them (1: always).
export function dropsOf(kind) {
  const tier = TIERS[tierOf(kind)];
  const beast = BEASTS[kind];
  const coins = tier === TIERS.boss ? [bossCoins(1), bossCoins(10)] : beast ? [beast.coins, beast.coins] : tier.coins;
  return { coins, heart: tier.heart ?? 0, potion: tier.potion ?? 0, jewel: tier.jewels || kind === 'mimic' ? 1 : (tier.jewel ?? 0) };
}

function pickJewel(rand) {
  let r = rand();
  for (const [k, share] of JEWEL_ODDS) {
    if (r < share) return k;
    r -= share;
  }
  return JEWEL_ODDS[0][0];
}

// So many coins as things to pick up: one coin each, up to six of them, and
// past that 💰 bags of BAG, and only so many things in all (the last bag
// holding whatever is left over).
export function coinPieces(total) {
  const out = [];
  let left = Math.max(0, Math.floor(total));
  while (left > 6 && out.length < 8) {
    out.push({ k: 'bag', n: BAG });
    left -= BAG;
  }
  if (left > 6) {
    out.at(-1).n += left - 6;
    left = 6;
  }
  for (; left > 0; left--) out.push({ k: 'coin', n: 1 });
  return out;
}

const FL = Math.floor;
const solid = (id) => B.SOLID[id] === 1;
// A place along one way, in hundredths for the wire, kept in the block it is
// in (30.996 is not to become 31, in the wall next to it).
const keep = (v) => +Math.min(FL(v) + 0.98, Math.max(FL(v) + 0.02, v)).toFixed(2);

// What a thing coming down at (x, z) from as high as y lands on: the top of
// the first solid block under it, or the surface of the water, as { y, wet };
// null in the lava, in a wall (solid right where it starts), off the island
// or over nothing within `deep`.
export function landOn(world, x, y, z, deep = 10) {
  const cx = FL(x);
  const cz = FL(z);
  if (cx < 0 || cz < 0 || cx >= world.W || cz >= world.D) return null;
  const top = Math.min(world.H - 1, FL(y));
  for (let yy = top; yy >= Math.max(0, top - deep); yy--) {
    const id = world.get(cx, yy, cz);
    if (id === B.LAVA) return null;
    if (id === B.WATER) return { y: yy + 0.88, wet: true };
    if (solid(id)) return yy === top ? null : { y: yy + 1, wet: false };
  }
  return null;
}

// Where each of n things out of a monster at `from` comes down: round about
// it, each a little way off in a way of its own, further the more there are,
// on the ground (or floating on the water), never in a wall, the lava or past
// a wall from where it went pop. One for which there is nowhere comes down
// where the monster was, or failing that at `fallback` (whoever popped it).
// Returns [{ x, y, z, wet }].
export function lootSpots(world, from, n, rand = Math.random, { fallback = null } = {}) {
  const spread = Math.min(2.6, 0.9 + 0.14 * n);
  const start = rand() * Math.PI * 2;
  const mid = { x: from.x, y: from.y + 0.5, z: from.z };
  const clear = (x, y, z) => {
    const dx = x - mid.x;
    const dy = y - mid.y;
    const dz = z - mid.z;
    const d = Math.hypot(dx, dy, dz);
    return d < 0.05 || !raycast(world, mid.x, mid.y, mid.z, dx, dy, dz, d, solid);
  };
  const under = landOn(world, from.x, from.y + 1, from.z, 14);
  const home = under ? { x: keep(from.x), y: under.y, z: keep(from.z), wet: under.wet } : fallback ? { x: +fallback.x.toFixed(2), y: +fallback.y.toFixed(2), z: +fallback.z.toFixed(2), wet: false } : { x: keep(from.x), y: +from.y.toFixed(2), z: keep(from.z), wet: false };
  const out = [];
  for (let i = 0; i < n; i++) {
    let spot = null;
    for (let tries = 0; tries < 6 && !spot; tries++) {
      // (The golden angle apart, so they spread out evenly round it.)
      const a = start + i * 2.39996 + (rand() - 0.5) * 0.6 + tries * 1.1;
      const d = (0.45 + rand() * spread) * (1 - tries * 0.14);
      const x = from.x + Math.sin(a) * d;
      const z = from.z + Math.cos(a) * d;
      const at = landOn(world, x, from.y + 1, z, 12);
      if (!at || !clear(x, at.y + 0.3, z)) continue;
      spot = { x: keep(x), y: +at.y.toFixed(2), z: keep(z), wet: at.wet };
    }
    out.push(spot ?? { ...home });
  }
  return out;
}

// The same in the Land of Nod (shared/nod/shape.js), where down is towards
// whatever body you are on: round about `from` on the ground of its body,
// never inside anything standing on it. Returns [{ x, y, z }].
export function nodLootSpots(space, from, n, rand = Math.random) {
  const body = space.bodyAt(from.x, from.y, from.z) ?? space.bodies[0];
  const ground = body.land(from);
  const up = body.up(ground.x, ground.y, ground.z);
  const spread = Math.min(2.6, 0.9 + 0.14 * n);
  const start = rand() * Math.PI * 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    let spot = null;
    for (let tries = 0; tries < 6 && !spot; tries++) {
      const a = start + i * 2.39996 + (rand() - 0.5) * 0.6 + tries * 1.1;
      const d = (0.45 + rand() * spread) * (1 - tries * 0.14);
      const way = turn(flatUnit({ x: 0.31, y: 0.22, z: 0.9 }, up), up, a);
      const q = body.land(add(ground, way, d), 6);
      const u = body.up(q.x, q.y, q.z);
      if (body.clutter(q.x + u.x * 0.3, q.y + u.y * 0.3, q.z + u.z * 0.3) < 0.3) continue;
      spot = q;
    }
    const s = spot ?? ground;
    out.push({ x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2) });
  }
  return out;
}

// One for the wire: [id, kind, how many, x, y, z] (where it lies, in
// hundredths), and back ({ id, k, n, x, y, z }, or null for nonsense).
export const packLoot = (d) => [d.id, LOOT_KINDS.indexOf(d.k), d.n, Math.round(d.x * 100), Math.round(d.y * 100), Math.round(d.z * 100)];
export function unpackLoot(row) {
  if (!Array.isArray(row) || row.length < 6 || !row.every(Number.isFinite)) return null;
  const k = LOOT_KINDS[row[1]];
  if (!k || !Number.isInteger(row[0]) || !(row[2] > 0)) return null;
  return { id: row[0], k, n: Math.min(999, Math.floor(row[2])), x: row[3] / 100, y: row[4] / 100, z: row[5] / 100 };
}

// What lies about an island, as the island keeps it: each { id, k, n, x, y,
// z, to (whom it is for: who popped it and who helped), end (when it flies
// off by itself) }.
export class Loot {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.list = [];
    this.nextId = 1;
  }

  get(id) {
    return this.list.find((d) => d.id === id) ?? null;
  }

  // things ([{ k, n }]) at spots ([{ x, y, z }], one each), for `to`, lying
  // there until now + life. Returns them (and any old ones there is no more
  // room for, gone: in `over`).
  add(things, spots, to, now, life = LOOT_LIFE_MS) {
    const made = things.map((t, i) => ({ id: this.nextId++, k: t.k, n: t.n, x: spots[i].x, y: spots[i].y, z: spots[i].z, to: [...to], end: now + life }));
    this.list.push(...made);
    if (this.list.length > MAX_LOOT) this.over = [...(this.over ?? []), ...this.list.splice(0, this.list.length - MAX_LOOT)];
    return made;
  }

  // Those of ids still lying there that near(d) says are near enough: taken.
  take(ids, near) {
    const out = [];
    for (const id of new Set(ids)) {
      const i = this.list.findIndex((d) => d.id === id);
      if (i < 0 || !near(this.list[i])) continue;
      out.push(...this.list.splice(i, 1));
    }
    return out;
  }

  // Those whose time is up, and those there was no more room for: gone.
  due(now) {
    const out = [...(this.over ?? []), ...this.list.filter((d) => d.end <= now)];
    this.over = [];
    this.list = this.list.filter((d) => d.end > now);
    return out;
  }

  // Everything lying about to fly off no later than `until` (a stage won).
  hurry(until) {
    for (const d of this.list) d.end = Math.min(d.end, until);
  }

  // The island grew under it (a Grow Island, room.js resizeWorld).
  shift(dx, dz) {
    for (const d of this.list) {
      d.x += dx;
      d.z += dz;
    }
  }

  pack() {
    return this.list.map(packLoot);
  }
}
