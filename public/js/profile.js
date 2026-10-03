// You: your name and look, your settings, your basket of treasures, and the
// stickers you have earned. Kept on this device, and copied to the keeper
// (see keeper.js) unless that is switched off.
import { COLLECTABLES, TOY_BRICKS, GRASS, DIRT, STONE, PLANKS, GLASS, TULIP, LAMP } from './shared/blocks.js';
import { cleanLook, isValidName, randomLook, randomName } from './shared/words.js';
import { load, save } from './storage.js';

export const STICKERS = [
  { key: 'first-block', icon: '🧱', name: 'First Brick', text: 'Put your first block down', test: (s) => s.placed >= 1 },
  { key: 'builder', icon: '🏗️', name: 'Builder', text: 'Put down 100 blocks', test: (s) => s.placed >= 100 },
  { key: 'master-builder', icon: '🏰', name: 'Master Builder', text: 'Put down 1,000 blocks', test: (s) => s.placed >= 1000 },
  { key: 'tidy', icon: '✋', name: 'Tidy Up', text: 'Pick up 50 blocks', test: (s) => s.picked >= 50 },
  { key: 'painter', icon: '🎨', name: 'Painter', text: 'Paint 30 blocks', test: (s) => s.painted >= 30 },
  { key: 'hill-maker', icon: '⛰️', name: 'Hill Maker', text: 'Shape the land 10 times', test: (s) => s.hills >= 10 },
  { key: 'stamp', icon: '🏠', name: 'Quick Builder', text: 'Use a stamp', test: (s) => s.stamps >= 1 },
  { key: 'green-thumb', icon: '🌷', name: 'Green Thumb', text: 'Plant 10 flowers', test: (s) => s.planted >= 10 },
  { key: 'gardener', icon: '🌳', name: 'Gardener', text: 'Plant a tree sprout', test: (s) => s.sprouts >= 1 },
  { key: 'fruit-picker', icon: '🍎', name: 'Fruit Picker', text: 'Collect 10 fruit', test: (s) => s.fruit >= 10 },
  { key: 'beachcomber', icon: '🐚', name: 'Beachcomber', text: 'Find 5 seashells', test: (s) => s.shells >= 5 },
  { key: 'star-catcher', icon: '⭐', name: 'Star Catcher', text: 'Catch a star piece', test: (s) => s.stars >= 1 },
  { key: 'animal-friend', icon: '🐰', name: 'Animal Friend', text: 'Pet 10 animals', test: (s) => s.petted >= 10 },
  { key: 'snack-time', icon: '🍑', name: 'Snack Time', text: 'Feed an animal some fruit', test: (s) => s.fed >= 1 },
  { key: 'welcome', icon: '🐣', name: 'Welcome Party', text: 'Invite an animal friend', test: (s) => s.invited >= 1 },
  { key: 'bird-buddy', icon: '🐦', name: 'Bird Buddy', text: 'Have a flying friend sit on your head', test: (s) => s.perched >= 1 },
  { key: 'chatty', icon: '💬', name: 'Chatty', text: 'Say 10 things to friends', test: (s) => s.said >= 10 },
  { key: 'dancer', icon: '💃', name: 'Dancer', text: 'Dance 5 times', test: (s) => s.danced >= 5 },
  { key: 'visitor', icon: '✈️', name: 'Visitor', text: "Visit a friend's island", test: (s) => s.visits >= 1 },
  { key: 'party-host', icon: '🏝️', name: 'Party Host', text: 'Have a friend visit your island', test: (s) => s.guests >= 1 },
  { key: 'swimmer', icon: '🏊', name: 'Swimmer', text: 'Go for a swim', test: (s) => s.swims >= 1 },
  { key: 'high-flyer', icon: '🎈', name: 'High Flyer', text: 'Fly way up high', test: (s) => s.highest >= 60 },
  { key: 'night-owl', icon: '🦉', name: 'Night Owl', text: 'Stay up to see the stars', test: (s) => s.nights >= 1 },
  { key: 'rainbow', icon: '🌈', name: 'Rainbow Watcher', text: 'See a rainbow', test: (s) => s.rainbows >= 1 },
  { key: 'explorer', icon: '🧭', name: 'Explorer', text: 'Walk 1,000 steps', test: (s) => s.steps >= 1000 },
];

const STAT_KEYS = ['placed', 'picked', 'painted', 'hills', 'stamps', 'planted', 'sprouts', 'fruit', 'shells', 'stars', 'petted', 'fed', 'invited', 'perched', 'said', 'danced', 'visits', 'guests', 'swims', 'highest', 'nights', 'rainbows', 'steps'];

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
    name: isValidName(p.name) ? p.name.replace(/ [2-9]$/, '') : randomName(),
    look: p.look ? cleanLook(p.look) : randomLook(),
    settings,
    basket,
    stats,
    stickers: p.stickers && typeof p.stickers === 'object' ? p.stickers : {},
    tokens: p.tokens && typeof p.tokens === 'object' ? p.tokens : {},
    hotbar,
    seenHelp: p.seenHelp === true,
    made: p.made === true,
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
    this.store();
    this.dispatchEvent(new CustomEvent('change'));
  }

  setting(key, value) {
    this.data.settings[key] = value;
    this.store();
    this.dispatchEvent(new CustomEvent('change'));
  }

  addToBasket(key, n = 1) {
    if (!(key in this.data.basket)) return;
    this.data.basket[key] = Math.max(0, Math.min(999, this.data.basket[key] + n));
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
    save('profile', this.data);
  }
}
