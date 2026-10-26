// You: your name and look, your settings, your basket of treasures, and the
// stickers you have earned. Kept on this device, and copied to the keeper
// (see keeper.js) unless that is switched off. Logged in, you are the same on
// every device: what another one sent the keeper is merged in here.
//
// The shared isle keeps a profile of its own under its own key (see main.js):
// a world of its own, so what you earn and carry there stays apart from all
// this, and never goes to the keeper.
import { COLLECTABLES, TOY_BRICKS, GRASS, DIRT, STONE, PLANKS, GLASS, TULIP, LAMP } from './shared/blocks.js';
import { addToGallery, cleanGallery, removeFromGallery } from './shared/drawing.js';
import { drawToy, GASHA_PRICE, MONSTER_FIGURES, MONSTER_PRICE, TOY_MAX, TOYS, toysFound } from './shared/gashapon.js';
import { mergeProfiles } from './shared/keeper.js';
import { progressOf } from './shared/levels.js';
import { CLOTHES, cleanCoins, cleanGear, cleanTames, cleanPotions, COINS_MAX, fixPrice, ISLAND_PRICE, isBroken, lookWithGear, nextLevel, POTION, sale, SEED_PACK, seedPrice, usesLeft, WEAPONS, weaponOf, wornWeapon } from './shared/shop.js';
import { STAT_KEYS, STICKERS } from './shared/stickers.js';
import { cleanLook, isValidName, randomLook, randomName } from './shared/words.js';
import { load, save } from './storage.js';

export { STICKERS };

export const DEFAULT_HOTBAR = [GRASS, DIRT, STONE, PLANKS, GLASS, TOY_BRICKS[0], TOY_BRICKS[2], TOY_BRICKS[7], TULIP, LAMP];

export const DEFAULT_SETTINGS = { music: 0.5, sound: 0.8, studs: true, autoJump: true, map: true, readAloud: false, quality: 'auto', keeper: true };

function clean(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS, ...(p.settings && typeof p.settings === 'object' ? p.settings : {}) };
  const basket = {};
  for (const c of COLLECTABLES) basket[c.key] = Number.isInteger(p.basket?.[c.key]) && p.basket[c.key] > 0 ? Math.min(999, p.basket[c.key]) : 0;
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = Number.isFinite(p.stats?.[k]) ? p.stats[k] : 0;
  const hotbar = Array.isArray(p.hotbar) && p.hotbar.length === DEFAULT_HOTBAR.length && p.hotbar.every(Number.isInteger) ? p.hotbar : [...DEFAULT_HOTBAR];
  return {
    name: isValidName(p.name) ? p.name : randomName(),
    look: p.look ? cleanLook(p.look) : randomLook(),
    settings,
    basket,
    coins: cleanCoins(p.coins),
    potions: cleanPotions(p.potions),
    gear: cleanGear(p.gear),
    stats,
    stickers: p.stickers && typeof p.stickers === 'object' ? p.stickers : {},
    gallery: cleanGallery(p.gallery),
    tokens: p.tokens && typeof p.tokens === 'object' ? p.tokens : {},
    hotbar,
    seenHelp: p.seenHelp === true,
    made: p.made === true,
    // When your name, look, basket, coins, potions or gear last changed: 0 for a profile nobody has
    // touched yet, which loses to any other when two are merged.
    changedAt: Number.isFinite(p.changedAt) && p.changedAt > 0 ? p.changedAt : 0,
  };
}

export class Profile extends EventTarget {
  // key: what this one is kept under on this device (storage.js) — 'profile'
  // for you, 'adventure' for the shared isle's own world of you.
  constructor(key = 'profile') {
    super();
    this.key = key;
    this.data = clean(load(key, null));
    this.store();
  }

  get name() {
    return this.data.name;
  }

  get look() {
    return this.data.look;
  }

  get settings() {
    return this.data.settings;
  }

  get basket() {
    return this.data.basket;
  }

  // Your XP and level (levels.js), from what you have done.
  get progress() {
    return progressOf(this.data.stats, this.data.stickers);
  }

  // Your look as the island sees it: with your toy weapon and your level.
  get shownLook() {
    return lookWithGear(this.data.look, this.data.gear, this.progress.level);
  }

  update(changes) {
    Object.assign(this.data, changes);
    if ('name' in changes || 'look' in changes) this.data.changedAt = Date.now();
    this.store();
    this.dispatchEvent(new CustomEvent('change'));
  }

  // You, as another device of yours left you with the keeper (see
  // mergeProfiles). Returns whether anything here changed.
  merge(kept) {
    if (!kept || typeof kept !== 'object') return false;
    const merged = mergeProfiles(this.data, kept);
    const before = JSON.stringify(this.data);
    Object.assign(this.data, merged);
    if (JSON.stringify(this.data) === before) return false;
    this.store();
    this.dispatchEvent(new CustomEvent('change'));
    this.dispatchEvent(new CustomEvent('basket'));
    this.dispatchEvent(new CustomEvent('gallery'));
    return true;
  }

  // Your gallery of drawings (shared/drawing.js). A picture saved: the
  // picture in it, or { why } it is not ('same', 'full', 'blank').
  saveDrawing(px, island) {
    const { gallery, why } = addToGallery(this.data.gallery, { px, island });
    if (!gallery) return { why };
    this.data.gallery = gallery;
    this.store();
    this.dispatchEvent(new CustomEvent('gallery'));
    return { picture: gallery.items[0] };
  }

  takeDownDrawing(id) {
    this.data.gallery = removeFromGallery(this.data.gallery, id);
    this.store();
    this.dispatchEvent(new CustomEvent('gallery'));
  }

  setting(key, value) {
    this.data.settings[key] = value;
    this.store();
    this.dispatchEvent(new CustomEvent('change'));
  }

  addToBasket(key, n = 1) {
    if (!(key in this.data.basket)) return;
    this.data.basket[key] = Math.max(0, Math.min(999, this.data.basket[key] + n));
    this.data.changedAt = Date.now();
    this.store();
    this.dispatchEvent(new CustomEvent('basket'));
  }

  // The shop (shop.js). Each says whether it happened.
  // Coins that came from somewhere other than selling: the prizes a round
  // at the arcade pays out (see shared/arcade.js).
  earn(n = 0) {
    if (n <= 0) return;
    this.data.coins = Math.min(COINS_MAX, this.data.coins + n);
    this.shopped();
  }

  sell(key, n = 1) {
    const coins = sale(this.data.basket, key, n);
    if (!coins) return false;
    this.data.basket[key] -= n;
    this.data.coins = Math.min(COINS_MAX, this.data.coins + coins);
    this.shopped();
    return true;
  }

  buy(kind) {
    const next = nextLevel(this.data.gear, kind);
    if (!next || this.data.coins < next.price) return false;
    this.data.coins -= next.price;
    this.data.gear[kind] = next.level;
    delete this.data.gear.off[kind];
    // New skates go on in place of your shoes, and new shoes of your skates.
    const other = { shoes: 'skates', skates: 'shoes' }[kind];
    if (other && this.data.gear[other]) this.data.gear.off[other] = true;
    if (kind === 'weapon') delete this.data.gear.wear[next.key];
    // A new weapon goes straight into your hand (choose another any time).
    if (kind === 'weapon') this.data.gear.pick.weapon = next.level;
    this.shopped();
    return true;
  }

  // Clothes (shop.js CLOTHES): bought once, and put straight on.
  buyClothes(key) {
    const c = CLOTHES.find((x) => x.key === key);
    const g = this.data.gear;
    if (!c || g.clothes.includes(key) || this.data.coins < c.price) return false;
    this.data.coins -= c.price;
    g.clothes = CLOTHES.filter((x) => x.key === key || g.clothes.includes(x.key)).map((x) => x.key);
    g.outfit = key;
    this.shopped();
    return true;
  }

  // Put on clothes you have (friends see them at once), or take them off
  // (none: '' or null).
  putOn(key) {
    const g = this.data.gear;
    const outfit = key && g.clothes.includes(key) ? key : '';
    if (key && !outfit) return false;
    g.outfit = outfit;
    this.shopped();
    return true;
  }

  // An HP potion (shop.js POTION): each says whether it happened.
  buyPotion(n = 1) {
    const count = Number.isInteger(n) && n > 0 ? Math.min(n, 999 - this.data.potions) : 0;
    const price = POTION.price * count;
    if (!count || this.data.coins < price) return false;
    this.data.coins -= price;
    this.data.potions += count;
    this.shopped();
    return true;
  }

  // A pack of a vegetable to plant (shop.js SEED_PACK), into the basket.
  buySeeds(key) {
    const price = seedPrice(key);
    if (!price || this.data.coins < price || !(key in this.data.basket) || this.data.basket[key] > 999 - SEED_PACK) return false;
    this.data.coins -= price;
    this.data.basket[key] += SEED_PACK;
    this.shopped();
    return true;
  }

  // A turn of a gashapon machine's handle (shared/gashapon.js): the coins
  // go in and a capsule toy comes out, into your collection. Returns { toy,
  // shell, have } (have: how many of it you have now, 1 for a new one), or
  // null without the coins. rand: for drawToy. later: counted (and its
  // stickers handed out) only once the capsule is opened, openCapsule, so
  // no sticker gives away what is inside. monster: the Monster Gashapon's
  // turn, for one of its figures (MONSTER_FIGURES, at its own price), the
  // rare ones likelier the higher the adventure island's stage.
  turnGashapon(rand = Math.random, { later = false, monster = false, stage = 1 } = {}) {
    const price = monster ? MONSTER_PRICE : GASHA_PRICE;
    if (this.data.coins < price) return null;
    const { toy, shell } = drawToy(rand, { list: monster ? MONSTER_FIGURES : TOYS, stage });
    const toys = this.data.gear.toys;
    this.data.coins -= price;
    toys[toy.key] = Math.min(TOY_MAX, (toys[toy.key] ?? 0) + 1);
    this.shopped();
    if (!later) this.openCapsule(monster);
    return { toy, shell, have: toys[toy.key] };
  }

  // A capsule opened: one more turned, and the toys (or monster figures)
  // you have counted.
  openCapsule(monster = false) {
    if (monster) {
      this.count('monsterfigs');
      this.count('monstertoys', toysFound(this.data.gear.toys, MONSTER_FIGURES), { max: true });
      return;
    }
    this.count('capsules');
    this.count('capsuletoys', toysFound(this.data.gear.toys), { max: true });
  }

  // One drunk (the island's half of it is game.js drink): out of your pocket.
  drinkPotion() {
    if (this.data.potions < 1) return false;
    this.data.potions--;
    this.shopped();
    return true;
  }

  // Skates go on your feet in place of running shoes: putting one on takes
  // the other off.
  wear(kind, on) {
    if (!this.data.gear[kind]) return;
    if (on) delete this.data.gear.off[kind];
    else this.data.gear.off[kind] = true;
    const other = { shoes: 'skates', skates: 'shoes' }[kind];
    if (on && other && this.data.gear[other]) this.data.gear.off[other] = true;
    this.shopped();
  }

  // Which of the weapons you own is in your hand (level: 1 for the first,
  // the Foam Sword). Any you like — a long reach or a hard hit — and friends
  // see it in your hand at once. Returns the weapon, or null.
  // A broken one cannot be picked until it is fixed.
  pickWeapon(level) {
    if (!Number.isInteger(level) || level < 1 || level > this.data.gear.weapon) return null;
    if (isBroken(this.data.gear, WEAPONS[level - 1])) return null;
    this.data.gear.pick.weapon = level;
    delete this.data.gear.off.weapon;
    this.shopped();
    return WEAPONS[level - 1];
  }

  // The next of your weapons round: for the button by the bop button (and
  // its key, N), flipping through them as it is pressed. With one put away
  // in the backpack, it is that one back into your hand.
  // Broken ones are skipped.
  nextWeapon() {
    const g = this.data.gear;
    const have = g.weapon;
    if (have < 2) return null;
    const worn = wornWeapon(g);
    if (!worn) {
      // Put away: back into your hand (the pick, or the best not broken).
      if (!g.off.weapon) return null;
      this.wear('weapon', true);
      return wornWeapon(g);
    }
    const from = WEAPONS.indexOf(worn);
    for (let i = 1; i < have; i++) {
      const level = ((from + i) % have) + 1;
      if (!isBroken(g, WEAPONS[level - 1])) return this.pickWeapon(level);
    }
    return null;
  }

  // A swing that landed, with the weapon in your hand: it wears a little.
  // Returns { weapon, left } (left: swings it has left; 0, it just broke),
  // or null with no weapon in hand.
  useWeapon() {
    const g = this.data.gear;
    const weapon = wornWeapon(g);
    if (!weapon) return null;
    g.wear[weapon.key] = (g.wear[weapon.key] ?? 0) + 1;
    this.shopped();
    return { weapon, left: usesLeft(g, weapon) };
  }

  // What a new island costs (ui.js newIslandDialog): nothing for your
  // first, ISLAND_PRICE once you have made one or have one (had: how many
  // are in My islands).
  islandPrice(had = 0) {
    return had > 0 || this.data.stats.islands > 0 ? ISLAND_PRICE : 0;
  }

  // Pays for a new island and counts it. Says whether it happened.
  payForIsland(had = 0) {
    const price = this.islandPrice(had);
    if (this.data.coins < price) return false;
    this.data.coins -= price;
    this.data.stats.islands++;
    this.shopped();
    return true;
  }

  // A worn or broken weapon fixed in the shop (shop.js fixPrice): as good
  // as new. A broken one you had picked is back in your hand.
  fixWeapon(key) {
    const w = weaponOf(key);
    const g = this.data.gear;
    if (!w || WEAPONS.indexOf(w) >= g.weapon) return false;
    const price = fixPrice(g, w);
    if (!price || this.data.coins < price) return false;
    this.data.coins -= price;
    delete g.wear[key];
    this.shopped();
    return true;
  }

  shopped() {
    this.data.changedAt = Date.now();
    this.store();
    this.dispatchEvent(new CustomEvent('basket'));
  }

  // Counts something you did, and hands out any sticker it earned. Says
  // 'count', for the ranking, and 'level' when it took you up a level.
  count(stat, n = 1, { max = false } = {}) {
    const s = this.data.stats;
    if (!(stat in s)) return;
    const before = this.progress.level;
    s[stat] = max ? Math.max(s[stat], n) : s[stat] + n;
    for (const sticker of STICKERS) {
      if (this.data.stickers[sticker.key] || !sticker.test(s)) continue;
      this.data.stickers[sticker.key] = Date.now();
      this.dispatchEvent(new CustomEvent('sticker', { detail: sticker }));
    }
    this.storeSoon();
    this.dispatchEvent(new CustomEvent('count'));
    const level = this.progress.level;
    if (level > before) this.dispatchEvent(new CustomEvent('level', { detail: { level } }));
  }

  token(key) {
    return this.data.tokens[key] ?? '';
  }

  setToken(key, token) {
    this.data.tokens[key] = token;
    const keys = Object.keys(this.data.tokens);
    for (const old of keys.slice(0, Math.max(0, keys.length - 40))) delete this.data.tokens[old];
    this.store();
  }

  storeSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.store(), 1500);
  }

  store() {
    clearTimeout(this.timer);
    if (!this.frozen) save(this.key, this.data);
  }

  // Writes no more: the page is about to reload as a player these things
  // went to, and must not write them back here.
  freeze() {
    this.store();
    this.frozen = true;
  }
}
