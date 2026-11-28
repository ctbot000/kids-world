// A duel with the soul of a soul weapon (shared/souls.js): put together at the Soul
// Forge, the weapon is nobody's till its soul is beaten, alone, on a little world of
// its own (worlds/souls.js). It is a dream of the Land of Nod (dream.js) of nothing
// but its boss (soul-foes.js), on an island that is in one page alone (room.js, soul:
// whose) — kept by nobody, listed nowhere, and gone as that page leaves it. Nobody
// helps, nothing is drunk, and out of HP it is lost; it can be tried as often as it
// takes, the weapon waiting at the forge all the while.
import { World } from '../world.js';
import { Rng } from '../rng.js';
import { soulName, soulOf } from '../souls.js';
import { Dream } from './dream.js';
import { frightOf } from './foes.js';
import { nodTheme, nodWorld } from './worlds/index.js';

// How hard each is, as a chapter of the isle's story has a level (foes.js haste).
export const DUEL_LEVEL = { star: 15, rainbow: 15, wild: 16, bells: 16, toon: 17, nod: 18, book: 19 };

// What is told of it, as a chapter's story is (isle-story.js).
export function duelStory(key) {
  const w = soulOf(key);
  if (!w) return null;
  const name = soulName(w);
  return {
    duel: key,
    key: `soul${key}`,
    icon: w.icon,
    name: `The soul of ${w.name}`,
    episode: { n: 0, icon: w.icon, title: w.name, films: {} },
    n: 1,
    of: 1,
    stage: 1,
    shards: 0,
    level: DUEL_LEVEL[key],
    day: 'night',
    weather: ['clear'],
    nightmares: [{ icon: w.icon, name, hint: frightOf(`soul${key}`).told, done: '' }],
  };
}

// Its island, as the rest of the game that goes by blocks has of it: a box of
// nothing but air (isle-maps.js dream).
export function duelWorld(key, seed = 1) {
  const { start } = nodWorld(`soul${key}`);
  const world = new World({ W: 16, H: 16, D: 16, sea: 1, theme: nodTheme(`soul${key}`), seed: seed >>> 0 || 1 });
  world.spawn = { x: start.x, y: start.y, z: start.z };
  return world;
}

// The duel, in the place of the adventure of a stage of the isle (adventure.js
// AdventureSim), which its room asks the same things of.
export class SoulDuel {
  constructor(key, seed = 1) {
    this.duel = key;
    this.story = duelStory(key);
    this.stage = 1;
    this.journey = 1;
    this.camps = [];
    this.deeds = new Map();
    this.rng = new Rng(seed);
    this.won = false;
    this.lost = false;
    this.dream = new Dream({ key: `soul${key}`, story: this.story, level: this.story.level }, (seed ^ 0x2545f491) >>> 0);
  }

  get active() {
    return !this.won && !this.lost;
  }

  credit() {}

  popped() {}

  guardGone() {}

  homeFor() {
    return this.dream.homeFor(0);
  }

  win() {
    this.won = true;
    return [];
  }

  tally() {
    return { camps: 1, freed: this.won ? 1 : 0, won: this.won, stage: 1, nod: true };
  }

  doneIds() {
    return [];
  }

  describe() {
    return { duel: this.duel, stage: 1, journey: 1, won: this.won, nod: this.dream.describe(), ...this.pack() };
  }

  pack() {
    return { c: [], k: this.dream.kingPack(), shield: false, n: this.dream.pack() };
  }
}
