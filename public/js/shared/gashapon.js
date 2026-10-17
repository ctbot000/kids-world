// Gashapon: capsule toy machines (a piece of furniture, blocks.js) with a
// glass globe full of coloured capsules. Walk up to one, put in a few
// 🪙 coins and turn the handle: a capsule rolls out, and inside it is one
// of the little capsule toys below — most of them easy to get, a few rare,
// and one very rare. The toys are yours, kept with your gear (shop.js
// cleanGear, as gear.toys: how many of each you have), so your collection
// goes everywhere with you, and a second of one you have is counted too.
//
// It all happens on your own page, like buying in the shop: the island
// only sees the machine.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

// Coins a turn of the handle costs.
export const GASHA_PRICE = 5;

// How many of one toy are kept, at most.
export const TOY_MAX = 99;

// How likely each rarity is, against the others: a common toy comes out
// most turns, a rare one now and then, and the very rare one seldom.
export const RARITIES = [
  { key: 'common', name: 'Common', weight: 10, shells: ['#f47fb8', '#62c4f5', '#fcd535', '#9bd44a', '#f59331'] },
  { key: 'rare', name: 'Rare', weight: 4, shells: ['#8c5bd6'] },
  { key: 'super', name: 'Super rare', weight: 1, shells: ['#f5c542'] },
];

// The capsule toys, in the order the collection shows them.
export const TOYS = [
  { key: 'dino', icon: '🦖', name: 'Tiny Dino', rare: 0 },
  { key: 'octopus', icon: '🐙', name: 'Wiggly Octopus', rare: 0 },
  { key: 'frog', icon: '🐸', name: 'Hoppy Frog', rare: 0 },
  { key: 'robot', icon: '🤖', name: 'Beep Robot', rare: 0 },
  { key: 'rocket', icon: '🚀', name: 'Pocket Rocket', rare: 0 },
  { key: 'teddy', icon: '🧸', name: 'Little Teddy', rare: 0 },
  { key: 'ghost', icon: '👻', name: 'Friendly Ghost', rare: 0 },
  { key: 'chick', icon: '🐥', name: 'Fluffy Chick', rare: 0 },
  { key: 'unicorn', icon: '🦄', name: 'Sparkle Unicorn', rare: 1 },
  { key: 'whale', icon: '🐳', name: 'Splashy Whale', rare: 1 },
  { key: 'ufo', icon: '🛸', name: 'Flying Saucer', rare: 1 },
  { key: 'dragon', icon: '🐉', name: 'Golden Dragon', rare: 2 },
];

export const toyOf = (key) => TOYS.find((t) => t.key === key) ?? null;
export const rarityOf = (toy) => RARITIES[toy?.rare ?? 0];

// Whether a block is a gashapon machine (any way it faces).
export const isGashapon = (id) => BLOCKS[id]?.model === 'gashapon';

// The machine nearest a body standing beside it: { x, y, z, key } of its
// cell, or null.
export const gashaponNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isGashapon(id) ? {} : null), reach);

// One turn of the handle: the toy in the capsule, and the colour of its
// shell. rand: a function giving 0 to 1, Math.random by default.
export function drawToy(rand = Math.random) {
  const total = TOYS.reduce((n, t) => n + RARITIES[t.rare].weight, 0);
  let r = rand() * total;
  let toy = TOYS[TOYS.length - 1];
  for (const t of TOYS) {
    r -= RARITIES[t.rare].weight;
    if (r < 0) {
      toy = t;
      break;
    }
  }
  const shells = RARITIES[toy.rare].shells;
  return { toy, shell: shells[Math.min(shells.length - 1, Math.floor(rand() * shells.length))] };
}

// The toys as kept: how many of each you have (whole numbers, 1 to
// TOY_MAX), toys nobody knows of left out.
export function cleanToys(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const t of TOYS) {
    const n = raw[t.key];
    if (Number.isInteger(n) && n > 0) out[t.key] = Math.min(TOY_MAX, n);
  }
  return out;
}

// How many different toys you have.
export const toysFound = (toys) => TOYS.filter((t) => (toys?.[t.key] ?? 0) > 0).length;

// Two collections put together: every toy of both, counted up.
export function addToys(a, b) {
  const out = cleanToys(a);
  for (const [key, n] of Object.entries(cleanToys(b))) out[key] = Math.min(TOY_MAX, (out[key] ?? 0) + n);
  return out;
}
