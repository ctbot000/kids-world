// The shop: sell what is in your basket for coins, and spend the coins on
// gear that makes you faster: running shoes for your feet (walking, running
// and swimming) and flying gear for the sky. Each kind of gear comes in
// levels, bought one after another, each faster than the last; you wear the
// best you have, and can take it off. Coins and gear are yours, kept with
// your basket (profile.js) and at the keeper (keeper.js).
import { COLLECTABLES } from './blocks.js';

export const COINS_MAX = 99999;

// Coins for one of each thing in the basket: fruit grows back on the trees,
// a diamond is found once in a mine.
export const SELL_PRICES = {
  apple: 1,
  orange: 1,
  peach: 1,
  pear: 1,
  cherry: 1,
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
];

export const gearKind = (key) => GEAR.find((g) => g.key === key) ?? null;

// Gear as kept: the level of each kind you have (0 for none), and which you
// have taken off.
export function cleanGear(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = { off: {} };
  for (const g of GEAR) {
    const n = p[g.key];
    out[g.key] = Number.isInteger(n) && n > 0 ? Math.min(g.levels.length, n) : 0;
    if (p.off?.[g.key] === true) out.off[g.key] = true;
  }
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
export function gearMove(gear, base) {
  const feet = boost(gear, 'shoes');
  const sky = boost(gear, 'wings');
  if (feet === 1 && sky === 1) return null;
  return { walk: base.walk * feet, run: base.run * feet, swim: base.swim * feet, fly: base.fly * sky, flyUp: base.flyUp * sky };
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
