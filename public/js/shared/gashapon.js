// Gashapon: capsule toy machines (a piece of furniture, blocks.js) with a
// glass globe full of coloured capsules. Walk up to one, put in a few
// 🪙 coins and turn the handle: a capsule rolls out, and inside it is one
// of the little capsule toys below — most of them easy to get, some rare,
// and a few super rare. The toys are yours, kept with your gear (shop.js
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
// most turns, a rare one now and then, and a super rare one seldom. stars:
// how a toy's card shows how rare it is.
export const RARITIES = [
  { key: 'common', name: 'Common', stars: '★', weight: 10, shells: ['#f47fb8', '#62c4f5', '#fcd535', '#9bd44a', '#f59331'] },
  { key: 'rare', name: 'Rare', stars: '★★', weight: 4, shells: ['#8c5bd6'] },
  { key: 'super', name: 'Super rare', stars: '★★★', weight: 1, shells: ['#f5c542'] },
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
  { key: 'penguin', icon: '🐧', name: 'Waddle Penguin', rare: 1 },
  { key: 'luckycat', icon: '🐱', name: 'Lucky Cat', rare: 1 },
  { key: 'turtle', icon: '🐢', name: 'Sea Turtle', rare: 1 },
  { key: 'fox', icon: '🦊', name: 'Little Fox', rare: 1 },
  { key: 'dragon', icon: '🐉', name: 'Golden Dragon', rare: 2 },
  { key: 'phoenix', icon: '🐦‍🔥', name: 'Rainbow Phoenix', rare: 2 },
  { key: 'jellyfish', icon: '🪼', name: 'Starlight Jellyfish', rare: 2 },
];

// The monster figures, out of the Monster Gashapon that turns up now and
// then on adventure islands (adventure.js): the island's own monsters
// (monsters.js), each a little figure of the real thing.
export const MONSTER_FIGURES = [
  { key: 'm-blob', icon: '👾', name: 'Grumpy Blob', rare: 0, monster: 'blob' },
  { key: 'm-frosty', icon: '🧊', name: 'Frosty Blob', rare: 0, monster: 'blob', theme: 'snowy' },
  { key: 'm-sour', icon: '🍏', name: 'Sour Blob', rare: 0, monster: 'blob', theme: 'candy' },
  { key: 'm-mosquito', icon: '🦟', name: 'Giant Mosquito', rare: 0, monster: 'mosquito' },
  { key: 'm-spiky', icon: '🦔', name: 'Spiky', rare: 0, monster: 'spiky' },
  { key: 'm-big', icon: '💪', name: 'Big Bruiser', rare: 1, monster: 'big' },
  { key: 'm-spider', icon: '🕷️', name: 'Giant Spider', rare: 1, monster: 'spider' },
  { key: 'm-knight', icon: '🛡️', name: 'Grumble Knight', rare: 1, monster: 'knight' },
  { key: 'm-golem', icon: '🗿', name: 'Stone Golem', rare: 2, monster: 'golem' },
  { key: 'm-king', icon: '👑', name: 'King Grumble', rare: 2, monster: 'king' },
];
// Every toy and figure there is, the way they are kept.
export const ALL_TOYS = [...TOYS, ...MONSTER_FIGURES];

// A turn of the Monster Gashapon costs more.
export const MONSTER_PRICE = 10;

// The higher the stage of an adventure island, the likelier a rare monster
// figure: a rare one's weight grows by a quarter each stage (up to three
// times), a super rare one's by a half (up to eight times). The capsule
// toys, and stage 1, keep RARITIES' weights.
export const rarityWeight = (rare, stage = 1) => {
  const s = Number.isInteger(stage) && stage > 1 ? Math.min(stage, 9999) : 1;
  const w = RARITIES[rare].weight;
  if (rare === 1) return w * Math.min(3, 1 + (s - 1) / 4);
  if (rare === 2) return w * Math.min(8, 1 + (s - 1) / 2);
  return w;
};

// The chance of each rarity coming out of a turn, from a list at a stage:
// [common, rare, super rare], adding up to 1.
export function rarityOdds(list = TOYS, stage = 1) {
  const by = [0, 0, 0];
  for (const t of list) by[t.rare] += rarityWeight(t.rare, stage);
  const total = by[0] + by[1] + by[2];
  return by.map((n) => n / total);
}

// The Monster Gashapon on an adventure island: it turns up on its own a
// while after someone is there, somewhere a little way off from one of
// them, stays a while for anyone to find, and goes again, to turn up
// somewhere else later (adventure.js AdventureSim.stepGasha).
export const MONSTER_GASHA = {
  first: [45000, 90000],
  stay: 90000,
  again: [120000, 240000],
  // How far from the one it turns up near.
  near: [7, 14],
};

export const toyOf = (key) => ALL_TOYS.find((t) => t.key === key) ?? null;
export const rarityOf = (toy) => RARITIES[toy?.rare ?? 0];

// Whether a block is a gashapon machine (any way it faces), and whether
// it is the Monster Gashapon.
export const isMonsterGashapon = (id) => BLOCKS[id]?.model === 'monster-gashapon';
export const isGashapon = (id) => BLOCKS[id]?.model === 'gashapon' || isMonsterGashapon(id);

// The machine nearest a body standing beside it: { x, y, z, key, monster }
// of its cell, or null.
export const gashaponNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isGashapon(id) ? { monster: isMonsterGashapon(id) } : null), reach);

// One turn of the handle: the toy in the capsule, and the colour of its
// shell. rand: a function giving 0 to 1, Math.random by default; list: the
// machine's toys (the Monster Gashapon's are MONSTER_FIGURES); stage: the
// adventure island's, for how likely the rare ones are.
export function drawToy(rand = Math.random, { list = TOYS, stage = 1 } = {}) {
  const total = list.reduce((n, t) => n + rarityWeight(t.rare, stage), 0);
  let r = rand() * total;
  let toy = list[list.length - 1];
  for (const t of list) {
    r -= rarityWeight(t.rare, stage);
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
  for (const t of ALL_TOYS) {
    const n = raw[t.key];
    if (Number.isInteger(n) && n > 0) out[t.key] = Math.min(TOY_MAX, n);
  }
  return out;
}

// How many different toys of a list (the capsule toys, by default) you have.
export const toysFound = (toys, list = TOYS) => list.filter((t) => (toys?.[t.key] ?? 0) > 0).length;

// Two collections put together: every toy of both, counted up.
export function addToys(a, b) {
  const out = cleanToys(a);
  for (const [key, n] of Object.entries(cleanToys(b))) out[key] = Math.min(TOY_MAX, (out[key] ?? 0) + n);
  return out;
}
