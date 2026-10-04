// You: your name and look, your settings, your basket of treasures, and the
// stickers you have earned. Kept on this device, and copied to the keeper
// (see keeper.js) unless that is switched off. Logged in, you are the same on
// every device: what another one sent the keeper is merged in here.
import { COLLECTABLES, TOY_BRICKS, GRASS, DIRT, STONE, PLANKS, GLASS, TULIP, LAMP } from './shared/blocks.js';
import { mergeProfiles } from './shared/keeper.js';
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
    stats,
    stickers: p.stickers && typeof p.stickers === 'object' ? p.stickers : {},
    tokens: p.tokens && typeof p.tokens === 'object' ? p.tokens : {},
    hotbar,
    seenHelp: p.seenHelp === true,
    made: p.made === true,
    // When your name, look or basket last changed: 0 for a profile nobody has
    // touched yet, which loses to any other when two are merged.
    changedAt: Number.isFinite(p.changedAt) && p.changedAt > 0 ? p.changedAt : 0,
  };
}

export class Profile extends EventTarget {
  constructor() {
    super();
    this.data = clean(load('profile', null));
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
    return true;
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

  // Counts something you did, and hands out any sticker it earned.
  count(stat, n = 1, { max = false } = {}) {
    const s = this.data.stats;
    if (!(stat in s)) return;
    s[stat] = max ? Math.max(s[stat], n) : s[stat] + n;
    for (const sticker of STICKERS) {
      if (this.data.stickers[sticker.key] || !sticker.test(s)) continue;
      this.data.stickers[sticker.key] = Date.now();
      this.dispatchEvent(new CustomEvent('sticker', { detail: sticker }));
    }
    this.storeSoon();
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
    if (!this.frozen) save('profile', this.data);
  }

  // Writes no more: the page is about to reload as a player these things
  // went to, and must not write them back here.
  freeze() {
    this.store();
    this.frozen = true;
  }
}
