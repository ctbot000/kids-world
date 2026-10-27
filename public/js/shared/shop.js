// The shop: sell what is in your basket for coins, and spend the coins on
// gear: running shoes for your feet (walking, running and swimming), flying
// gear for the sky, roller skates to glide over the ground on (in place of
// the shoes), toy weapons for popping monsters, and clothes, some for
// looks and some with a power. Each kind of gear
// comes in levels, bought one after another, each better than the last; you
// wear the best you have (the weapon you pick of them), and can take it
// off in your backpack (ui.js backpackDialog). HP potions are used up when
// you drink them, and vegetables to plant go in the basket. Coins, potions
// and gear are yours, kept with your basket (profile.js) and at the keeper
// (keeper.js).
import { COLLECTABLES } from './blocks.js';
import { cleanToys } from './gashapon.js';
import { maxHp } from './monsters.js';
import { MOVE } from './physics.js';

export const COINS_MAX = 99999;
// A new island: your first is free, and each after it costs this.
export const ISLAND_PRICE = 50;

// Coins for one of each thing in the basket: fruit grows back on the trees,
// vegetables take growing (the bigger, the longer), a diamond is found once
// in a mine. Flowers the mower gathers are as easy to come by as fruit.
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
  pearl: 5,
  star: 5,
  flower: 1,
  ruby: 10,
  sapphire: 10,
  emerald: 12,
  amethyst: 15,
  diamond: 50,
};

export const sellPrice = (key) => SELL_PRICES[key] ?? 0;

// Each level: its key (how friends see it on you: a look's shoes or wings,
// render/avatar.js), name, icon, price and how much faster it makes you
// (1.25: a quarter faster).
export const GEAR = [
  {
    key: 'shoes',
    name: 'Running shoes',
    about: 'Walk, run and swim faster.',
    levels: [
      { key: 'bouncy', name: 'Bouncy Sneakers', icon: '👟', price: 20, boost: 1.2 },
      { key: 'zoomy', name: 'Zoomy Sneakers', icon: '⚡', price: 60, boost: 1.4 },
      { key: 'rocket', name: 'Rocket Boots', icon: '🚀', price: 150, boost: 1.65 },
    ],
  },
  {
    key: 'wings',
    name: 'Flying gear',
    about: 'Fly faster, up and down too.',
    levels: [
      { key: 'feather', name: 'Feather Wings', icon: '🪶', price: 30, boost: 1.25 },
      { key: 'fairy', name: 'Fairy Wings', icon: '🧚', price: 80, boost: 1.5 },
      { key: 'jetpack', name: 'Jet Pack', icon: '🛩️', price: 200, boost: 1.8 },
    ],
  },
  {
    // On your feet in place of running shoes: faster than any of them over
    // the ground, but no help in the water, and you glide (see SKATE_GLIDE).
    key: 'skates',
    name: 'Roller skates',
    about: 'Glide over the ground, rolling on when you let go.',
    levels: [
      { key: 'roller', name: 'Roller Skates', icon: '🛼', price: 70, boost: 1.5 },
      { key: 'glowy', name: 'Light-up Skates', icon: '🌈', price: 180, boost: 1.8 },
    ],
  },
  {
    key: 'weapon',
    name: 'Toy weapons',
    about: 'Pop monsters with fewer bops, from a little further away.',
    // power: the hearts a bop takes; reach: how much further than an arm it
    // reaches (monsters.js ARM_REACH); king: how many times over King
    // Grumble feels a bop. Any you have can be the one in your hand — carry
    // whichever you like (profile.js pickWeapon, ui.js backpackDialog): a
    // long reach or a hard hit, by what you are popping. uses: how many
    // swings that land it lasts before it breaks (see wear, below).
    // Saves keep the weapons as how many levels you have (gear.weapon), so
    // a new one goes on the end: put in between, it would turn everyone's
    // saved weapons into others. The Bomb Rod is last for that.
    levels: [
      { key: 'sword', name: 'Foam Sword', icon: '🗡️', price: 40, power: 2, reach: 1, king: 1, uses: 60, does: 'Two bops pop a monster, and it reaches a step further than your arm.' },
      { key: 'blaster', name: 'Bubble Blaster', icon: '🫧', price: 100, power: 2, reach: 3.5, king: 1, uses: 80, does: 'Two bubbles pop a monster, a few steps in front of you.' },
      { key: 'hammer', name: 'Star Hammer', icon: '🔨', price: 250, power: 3, reach: 0.6, king: 2, uses: 100, does: 'One bop pops a monster right in front of you, and King Grumble feels every bop twice.' },
      { key: 'lavablade', name: 'Lava Blade', icon: '🔥', price: 400, power: 4, reach: 1.2, king: 3, uses: 120, does: 'One bop pops any monster from a step away, and King Grumble feels every bop three times over.' },
      { key: 'bombrod', name: 'Bomb Rod', icon: '💣', price: 450, power: 2, reach: 3.7, king: 1, uses: 70, does: 'Lobs a small bomb a few steps ahead: its pop bops every monster in the blast and shakes jewels out of gem rocks, without digging the ground.' },
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

// Your look as the island sees it: with the weapon, clothes, shoes (or
// skates) and wings you have on, if any (by key: friends see them on you),
// and your level (levels.js), if given.
export function lookWithGear(look, gear, level = 0) {
  const { weapon: _, level: __, outfit: ___, shoes: ____, wings: _____, skates: ______, ...rest } = look ?? {};
  const worn = wornWeapon(gear);
  const outfit = wornOutfit(gear);
  const skates = wornLevel(gear, 'skates');
  const shoes = skates ? null : wornLevel(gear, 'shoes');
  const wings = wornLevel(gear, 'wings');
  return {
    ...rest,
    ...(worn ? { weapon: worn.key } : {}),
    ...(outfit ? { outfit: outfit.key } : {}),
    ...(shoes ? { shoes: shoes.key } : {}),
    ...(skates ? { skates: skates.key } : {}),
    ...(wings ? { wings: wings.key } : {}),
    ...(level ? { level } : {}),
  };
}

// The running shoes or flying gear you have on (kind: 'shoes' or 'wings'),
// or null; and one of them by key, for a look.
const wornLevel = (gear, kind) => {
  const level = wearing(gear, kind);
  return level ? gearKind(kind).levels[level - 1] : null;
};
export const shoesOf = (key) => GEAR[0].levels.find((l) => l.key === key) ?? null;
export const wingsOf = (key) => GEAR[1].levels.find((l) => l.key === key) ?? null;
export const skatesOf = (key) => GEAR[2].levels.find((l) => l.key === key) ?? null;

// Toy weapons wear out: each swing that lands wears the one in your hand a
// little (gear.wear, by its key: the swings used), and after its uses it
// breaks. A broken one stays yours, but cannot be held until the shop fixes
// it (fixPrice), for less than a new one would cost.
export const usesLeft = (gear, w) => Math.max(0, w.uses - (gear?.wear?.[w.key] ?? 0));
export const isBroken = (gear, w) => usesLeft(gear, w) === 0;
export const fixPrice = (gear, w) => {
  const used = w.uses - usesLeft(gear, w);
  return used ? Math.max(1, Math.ceil(((w.price / 2) * used) / w.uses)) : 0;
};

// The weapon you have on: the one you have chosen to carry of those you own
// (pick, by its level), or the best you have — the best not broken, when
// that one is. Null with none, them all broken, or it taken off.
export const wornWeapon = (gear) => {
  if (gear?.off?.weapon) return null;
  const have = gear?.weapon ?? 0;
  if (!have) return null;
  const pick = gear?.pick?.weapon;
  const level = Number.isInteger(pick) && pick >= 1 && pick <= have ? pick : have;
  if (!isBroken(gear, WEAPONS[level - 1])) return WEAPONS[level - 1];
  return WEAPONS.slice(0, have).findLast((w) => !isBroken(gear, w)) ?? null;
};

export const gearKind = (key) => GEAR.find((g) => g.key === key) ?? null;

// Gear as kept: the level of each kind you have (0 for none), which you
// have taken off, and for the weapons which of them you carry (pick: its
// level, 1 for the first; without one, the best you have); the clothes you
// have (in CLOTHES order) and the ones you have on ('' for none); and the
// capsule toys from gashapon machines, how many of each (gashapon.js); how
// worn each weapon you own is (wear); and how many times you have tamed a
// volcano island's dragon (dragon.js).
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
  out.wear = {};
  for (const w of WEAPONS.slice(0, out.weapon)) {
    const n = p.wear?.[w.key];
    if (Number.isInteger(n) && n > 0) out.wear[w.key] = Math.min(w.uses, n);
  }
  const clothes = Array.isArray(p.clothes) ? p.clothes : [];
  out.clothes = CLOTHES.filter((c) => clothes.includes(c.key)).map((c) => c.key);
  out.outfit = out.clothes.includes(p.outfit) ? p.outfit : '';
  out.toys = cleanToys(p.toys);
  out.tames = cleanTames(p.tames);
  return out;
}

export const TAMES_MAX = 999;
export const cleanTames = (n) => (Number.isInteger(n) && n > 0 ? Math.min(TAMES_MAX, n) : 0);

export const cleanCoins = (n) => (Number.isInteger(n) && n > 0 ? Math.min(COINS_MAX, n) : 0);

// The level of a kind of gear you are wearing (0: none).
export const wearing = (gear, key) => (gear?.off?.[key] ? 0 : (gear?.[key] ?? 0));

const boost = (gear, key) => {
  const level = wearing(gear, key);
  return level ? gearKind(key).levels[level - 1].boost : 1;
};

// On roller skates you speed up gently as you push (push, in blocks a
// second each second) and roll on when you let go, slowing gently (coast)
// — on the ground only: in the air, the water and the sky as ever.
export const SKATE_GLIDE = { push: 16, coast: 4 };

// Speeds for physics.js (stepBody's options.move) with the gear worn, or
// null with none, to go as fast as anyone.
// Skates on, shoes are not: they are as fast as the skates on the ground,
// and swim as anyone does. The Hero Cape jumps higher, too.
export function gearMove(gear, base) {
  const skates = boost(gear, 'skates');
  const feet = skates > 1 ? skates : boost(gear, 'shoes');
  const swim = skates > 1 ? 1 : feet;
  const sky = boost(gear, 'wings');
  const jump = wornOutfit(gear)?.jump;
  if (feet === 1 && sky === 1 && !jump) return null;
  return {
    walk: base.walk * feet,
    run: base.run * feet,
    swim: base.swim * swim,
    fly: base.fly * sky,
    flyUp: base.flyUp * sky,
    ...(jump ? { jump } : {}),
    ...(skates > 1 ? { glide: SKATE_GLIDE } : {}),
  };
}

// Your stats, for the ⭐ window (ui.js): hp, the most HP you have at your
// level; ap, the hearts a bop takes off a monster (bare paws take 1) and
// king, off King Grumble; def, the share of a bump's HP that Knight Armor
// keeps off; speed, how fast your feet are, and jump, how high you jump,
// both as percent of anyone's with nothing on.
export function statsOf(level, gear) {
  const weapon = wornWeapon(gear);
  const outfit = wornOutfit(gear);
  const skates = boost(gear, 'skates');
  const jump = outfit?.jump ?? MOVE.jump;
  return {
    hp: maxHp(level),
    ap: weapon?.power ?? 1,
    king: weapon?.king ?? 1,
    weapon,
    def: outfit?.power === 'armor' ? 50 : 0,
    fireproof: outfit?.power === 'fireproof',
    speed: Math.round(100 * (skates > 1 ? skates : boost(gear, 'shoes'))),
    jump: Math.round((100 * jump * jump) / (MOVE.jump * MOVE.jump)),
  };
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
