// The shop: sell what is in your basket for coins, and spend the coins on
// gear: running shoes for your feet (walking, running and swimming), flying
// gear for the sky, toy weapons for popping monsters, and clothes, some for
// looks and some with a power. Each kind of gear
// comes in levels, bought one after another, each better than the last; you
// wear the best you have (the weapon you pick of them), and can take it
// off. HP potions are used up when you drink them, and vegetables to plant
// go in the basket. Coins, potions and gear are yours, kept with your basket
// (profile.js) and at the keeper (keeper.js).
import { COLLECTABLES } from './blocks.js';
import { cleanToys } from './gashapon.js';

export const COINS_MAX = 99999;

// Coins for one of each thing in the basket: fruit grows back on the trees,
// vegetables take growing (the bigger, the longer), a diamond is found once
// in a mine.
export const SELL_PRICES = {
  apple: 1,
  orange: 1,
  peach: 1,
  pear: 1,
  cherry: 1,
  carrot: 1,
  strawberry: 1,
  tomato: 1,
  corn: 2,
  pumpkin: 3,
  watermelon: 3,
  shell: 2,
  star: 5,
  ruby: 10,
  sapphire: 10,
  emerald: 12,
  amethyst: 15,
  diamond: 50,
};

export const sellPrice = (key) => SELL_PRICES[key] ?? 0;

// Each level: its name, icon, price and how much faster it makes you
// (1.25: a quarter faster).
export const GEAR = [
  {
    key: 'shoes',
    name: 'Running shoes',
    about: 'Walk, run and swim faster.',
    levels: [
      { name: 'Bouncy Sneakers', icon: '👟', price: 20, boost: 1.2 },
      { name: 'Zoomy Sneakers', icon: '⚡', price: 60, boost: 1.4 },
      { name: 'Rocket Boots', icon: '🚀', price: 150, boost: 1.65 },
    ],
  },
  {
    key: 'wings',
    name: 'Flying gear',
    about: 'Fly faster, up and down too.',
    levels: [
      { name: 'Feather Wings', icon: '🪶', price: 30, boost: 1.25 },
      { name: 'Fairy Wings', icon: '🧚', price: 80, boost: 1.5 },
      { name: 'Jet Pack', icon: '🛩️', price: 200, boost: 1.8 },
    ],
  },
  {
    key: 'weapon',
    name: 'Toy weapons',
    about: 'Pop monsters with fewer bops, from a little further away.',
    // power: the hearts a bop takes; reach: how much further than an arm it
    // reaches (monsters.js ARM_REACH); king: how many times over King
    // Grumble feels a bop. Any you have can be the one in your hand — carry
    // whichever you like (profile.js pickWeapon, ui.js): a long reach or a
    // hard hit, by what you are popping.
    levels: [
      { key: 'sword', name: 'Foam Sword', icon: '🗡️', price: 40, power: 2, reach: 1, king: 1, does: 'Two bops pop a monster, and it reaches a step further than your arm.' },
      { key: 'blaster', name: 'Bubble Blaster', icon: '🫧', price: 100, power: 2, reach: 3.5, king: 1, does: 'Two bubbles pop a monster, a few steps in front of you.' },
      { key: 'hammer', name: 'Star Hammer', icon: '🔨', price: 250, power: 3, reach: 0.6, king: 2, does: 'One bop pops a monster right in front of you, and King Grumble feels every bop twice.' },
      { key: 'lavablade', name: 'Lava Blade', icon: '🔥', price: 400, power: 4, reach: 1.2, king: 3, does: 'One bop pops any monster from a step away, and King Grumble feels every bop three times over.' },
    ],
  },
];

// Clothes: bought one at a time, in any order, and worn over your t-shirt
// one at a time (gear.clothes, gear.outfit). Some are just for looks; some
// give you a power while you have them on: power names it, for whoever
// gives it — the host (room.js: armor, fireproof) or your own page (jump,
// physics.js MOVE.jump). They are part of your look (look.outfit), so
// friends see them on you and the host knows what you have on.
export const CLOTHES = [
  { key: 'scarf', name: 'Cozy Scarf', icon: '🧣', price: 15, does: 'Just for looks: a stripy scarf that flaps as you run.' },
  { key: 'cape', name: 'Hero Cape', icon: '🦸', price: 120, power: 'jump', jump: 10.6, does: 'Jump half as high again: right up onto a wall two blocks tall!' },
  { key: 'armor', name: 'Knight Armor', icon: '🛡️', price: 180, power: 'armor', does: 'Monster bumps and King Grumble’s stomps take only half as much HP.' },
  { key: 'firesuit', name: 'Fire Suit', icon: '🧑‍🚒', price: 220, power: 'fireproof', does: 'Lava never burns you: swim in it on a volcano island!' },
  { key: 'robe', name: 'Royal Robe', icon: '👑', price: 500, does: 'Just for looks: a long velvet robe with a fluffy white collar, fit for a king or a queen.' },
];
export const outfitOf = (key) => CLOTHES.find((c) => c.key === key) ?? null;

// The clothes you have on (from gear), or null.
export const wornOutfit = (gear) => (gear?.clothes?.includes(gear.outfit) ? outfitOf(gear.outfit) : null);

// Whether a look (yours, or a friend's as the host sees it) has on clothes
// with this power.
export const hasPower = (look, power) => outfitOf(look?.outfit)?.power === power;

// An HP potion: the one thing the shop sells that is used up. Bought with
// coins, carried with them (profile.js) and drunk to fill your HP right up,
// at once, even mid-fight — or sitting dizzy on an adventure island, to get
// up on your own (the island's half of it is room.js, 'potion').
export const POTION = {
  key: 'potion',
  name: 'HP Potion',
  icon: '🧪',
  price: 10,
  does: 'Fills your HP right up at once — even while a monster is after you, or to get up on your own when you are sitting dizzy.',
};

// Vegetables to plant, to start a farm with (blocks.js CROPS): SEED_PACK of
// a kind at a time, into the basket, for more than they would sell for —
// it is the farm that pays, each ripe one giving more than was planted.
export const SEED_PACK = 5;
export const SEED_PRICES = { carrot: 8, strawberry: 8, tomato: 8, corn: 15, pumpkin: 20, watermelon: 20 };
export const seedPrice = (key) => SEED_PRICES[key] ?? 0;

// Potions as kept: a whole number, never silly (like coins, but no more than
// a basket holds).
export const cleanPotions = (n) => (Number.isInteger(n) && n > 0 ? Math.min(999, n) : 0);

// What a level of gear does, for the shop.
export const levelDoes = (level) => level.does ?? `${Math.round((level.boost - 1) * 100)}% faster.`;

// The toy weapons: carried in your hand, so they are part of the look the
// island sees (look.weapon, by key; see words.js cleanLook), which is how
// the host knows how hard and how far you bop (room.js) and friends see it.
export const WEAPONS = GEAR.find((g) => g.key === 'weapon').levels;
export const weaponOf = (key) => WEAPONS.find((w) => w.key === key) ?? null;

// Your look as the island sees it: with the weapon you have on, if any, and
// your level (levels.js), if given.
export function lookWithGear(look, gear, level = 0) {
  const { weapon: _, level: __, outfit: ___, ...rest } = look ?? {};
  const worn = wornWeapon(gear);
  const outfit = wornOutfit(gear);
  return { ...rest, ...(worn ? { weapon: worn.key } : {}), ...(outfit ? { outfit: outfit.key } : {}), ...(level ? { level } : {}) };
}

// The weapon you have on: the one you have chosen to carry of those you own
// (pick, by its level), or the best you have. Null with none, or it taken off.
export const wornWeapon = (gear) => {
  if (gear?.off?.weapon) return null;
  const have = gear?.weapon ?? 0;
  if (!have) return null;
  const pick = gear?.pick?.weapon;
  const level = Number.isInteger(pick) && pick >= 1 && pick <= have ? pick : have;
  return WEAPONS[level - 1];
};

export const gearKind = (key) => GEAR.find((g) => g.key === key) ?? null;

// Gear as kept: the level of each kind you have (0 for none), which you
// have taken off, and for the weapons which of them you carry (pick: its
// level, 1 for the first; without one, the best you have); the clothes you
// have (in CLOTHES order) and the ones you have on ('' for none); and the
// capsule toys from gashapon machines, how many of each (gashapon.js).
export function cleanGear(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = { off: {}, pick: {} };
  for (const g of GEAR) {
    const n = p[g.key];
    out[g.key] = Number.isInteger(n) && n > 0 ? Math.min(g.levels.length, n) : 0;
    if (p.off?.[g.key] === true) out.off[g.key] = true;
  }
  const pick = Number.isInteger(p.pick?.weapon) ? p.pick.weapon : 0;
  out.pick.weapon = pick >= 1 && pick <= out.weapon ? pick : 0;
  const clothes = Array.isArray(p.clothes) ? p.clothes : [];
  out.clothes = CLOTHES.filter((c) => clothes.includes(c.key)).map((c) => c.key);
  out.outfit = out.clothes.includes(p.outfit) ? p.outfit : '';
  out.toys = cleanToys(p.toys);
  return out;
}

export const cleanCoins = (n) => (Number.isInteger(n) && n > 0 ? Math.min(COINS_MAX, n) : 0);

// The level of a kind of gear you are wearing (0: none).
export const wearing = (gear, key) => (gear?.off?.[key] ? 0 : (gear?.[key] ?? 0));

const boost = (gear, key) => {
  const level = wearing(gear, key);
  return level ? gearKind(key).levels[level - 1].boost : 1;
};

// Speeds for physics.js (stepBody's options.move) with the gear worn, or
// null with none, to go as fast as anyone.
// The Hero Cape jumps higher, too.
export function gearMove(gear, base) {
  const feet = boost(gear, 'shoes');
  const sky = boost(gear, 'wings');
  const jump = wornOutfit(gear)?.jump;
  if (feet === 1 && sky === 1 && !jump) return null;
  return { walk: base.walk * feet, run: base.run * feet, swim: base.swim * feet, fly: base.fly * sky, flyUp: base.flyUp * sky, ...(jump ? { jump } : {}) };
}

// Selling n of a basket's key: the coins it brings, or 0 when it cannot be
// sold (nothing that many, or not something the shop buys).
export function sale(basket, key, n) {
  if (!COLLECTABLES.some((c) => c.key === key) || !Number.isInteger(n) || n < 1) return 0;
  if ((basket?.[key] ?? 0) < n) return 0;
  return sellPrice(key) * n;
}

// The next level of a kind of gear to buy: { level, ...that level }, or null
// when you have the best.
export function nextLevel(gear, key) {
  const g = gearKind(key);
  if (!g) return null;
  const have = gear?.[key] ?? 0;
  return have < g.levels.length ? { level: have + 1, ...g.levels[have] } : null;
}
