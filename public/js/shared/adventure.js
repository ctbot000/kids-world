// The adventure on Adventure Isle, the one island the dedicated server keeps
// for everyone to conquer together (server/adventure.js): grumpy monsters
// have taken over parts of it. Each of their camps is gloomy ground behind a
// fence, with their flag in the middle, and the chapter's boss (bosses.js)
// sits in its lair, safe in a magic bubble. Friends free it together:
//
// - A camp's monsters come out when someone comes near, and keep to their
//   camp, chasing whoever comes in. One of them is a mosquito, hanging over
//   the camp on the wing. One popped comes back a while later, until the
//   camp is free.
// - Standing by the flag with no monster in the camp lowers it and raises
//   the island's own, and the more friends stand there, the faster it goes.
//   Up all the way, the camp is free: its ground turns back into grass and
//   flowers, its monsters go, and it is a safe place, where anyone out of
//   hearts comes back.
// - With every camp free, the boss's bubble pops. Big and slow, it has
//   moves of its own, and sits dazed after some of them, when a bop counts
//   three times. It calls its minions to help it, and the fewer hearts it
//   has, the crosser it gets. Left alone, it gets hearts back. Each friend
//   can bop it about once a second, so the more of you there are, the
//   sooner it goes pop, and the whole stage is won.
// - Out of HP with a friend on the island, you sit dizzy for a while,
//   until a friend comes and taps you to help you up (or you go back to the
//   nearest safe place).
// - There is no way round a gate that is still shut: whoever gets past one
//   all the same — swimming round by the sea, in a boat, over a wall with a
//   Hero Cape — is sent back to the nearest safe place (stepSneaks).
//
// Each stage is a chapter of the isle's story (isle-story.js) with a map of
// its own, made with its camps and its lair (isle-maps.js, with the
// builders here), and the host runs the rest (AdventureSim, from room.js),
// as it runs the monsters. Each stage is harder than the last; a stage
// number scales everything below that says so.
//
// A chapter of the fourth episode has none of that: no camps, no gates, no
// lair, no monsters. Its island has Jinx the Magpie's challenges instead
// (isle-quests.js), and a cage by where everyone arrives with that chapter's
// Golden Bell in it and a lock for each challenge (its hub, isle-bells.js):
// each challenge beaten lights its lock, every lock lit opens the cage and
// the stage is won — and Jinx, perched on the cage all along, flies off.
//
// Nor has a chapter of the fifth episode, on Toon Isle: its island is far
// bigger, hidden under clouds until someone gets there, and has battles of
// other kinds instead — gangs roaming its ways, ambushes, sieges, nests,
// hunts and, at the very end, Baron Bluster himself (isle-battles.js). Each
// battle won lights a lamp on its Sky Lantern by where everyone arrives, and
// every one won wins the stage.
import { BEASTS, isBeast } from './beasts.js';
import * as B from './blocks.js';
import { standHeight } from './critters.js';
import { BOSSES, breathMove, isBoss, planOf } from './bosses.js';
import { bodyOf, BUMP_HP, campDistance, DAZED_HIT, GHOST_FIRE, kindOf, SAFE_RADIUS } from './monsters.js';
import { bodyOverlapsSolid, MOVE } from './physics.js';
import { MONSTER_LOG } from './stickers.js';
import { isMonsterGashapon, MONSTER_GASHA } from './gashapon.js';
import { hash2, Rng } from './rng.js';
import { Chests } from './treasure.js';
import { chapterOf } from './isle-story.js';
import { Quests } from './isle-quests.js';
import { Battles, FOG_TILE } from './isle-battles.js';
import { Dream } from './nod/dream.js';

// A camp's fence goes round this far from its flag; a boss's lair (its
// castle) is a square this far from its middle to its walls.
export const CAMP_RADIUS = 7;
export const CASTLE_RADIUS = 10;
// How near the flag you stand to raise it, and how many seconds that takes
// for one friend, two, three, and four or more.
export const FLAG_REACH = 3.5;
const RAISE_SECONDS = [Infinity, 10, 6, 4.5, 4];
export const raiseSeconds = (friends, stage = 1) => stageRaise(RAISE_SECONDS[Math.max(0, Math.min(4, friends))], stage);
// Anyone this far beyond a camp's fence wakes its monsters; with nobody near
// for a while, they go back to sleep.
export const WAKE = 34;
export const SLEEP_MS = 15000;
// A camp's monster popped comes back this long after, while the camp is not free.
export const GUARD_BACK_MS = 20000;
// How many monsters keep a camp: more with more friends on the island.
export const guardsFor = (players, stage = 1) => stageGuards(Math.min(5, 1 + Math.max(1, players)), stage);
// The hearts a boss starts from, more with more friends on the island; each
// friend can bop it once in this long. Nobody bopping it for KING_HEAL_MS,
// it gets a heart back, and another every KING_HEAL_EVERY after.
export const kingHearts = (players, stage = 1) => stageKing(12 + 6 * Math.min(8, Math.max(1, players)), stage);
// A boss's (bosses.js), which has as many again as its hearts say.
export const bossHearts = (plan, players, stage = 1) => Math.round(kingHearts(players, stage) * (plan?.hearts ?? 1));
export const KING_HIT_MS = 800;
// How many of his hearts King Grumble gets back as he puffs himself up, at
// the end of the story (hitKing).
export const SECOND_WIND = 0.6;
export const KING_HEAL_MS = 8000;
const KING_HEAL_EVERY = 2000;
// Out of HP with a friend about: dizzy this long, unless a friend this
// near taps you, which gets you up with this share of your HP.
export const DIZZY_MS = 10000;
export const HELP_REACH = 4;
export const HELP_SHARE = 0.6;
export const helpHp = (max) => Math.round(max * HELP_SHARE);

// Adventure Isle is conquered stage by stage (server/adventure.js), each
// stage harder than the last, up to the last chapter of its story
// (isle-story.js): every stage after the first has one more guard in each
// camp every second stage (up to nine), its boss with a quarter more hearts
// each stage (up to four times as many) and quicker with its moves, and
// flags that take a tenth longer to raise each stage (up to twice as long).
// From the second stage, a flag slides back down while the camp's monsters
// hold it, hazards come down on the way between the camps, and from the
// third a camp's monsters come back quicker but only so many times (its
// reserve: once that is gone, a monster popped stays popped, so a camp is
// never hopeless), and half way up its flag they ambush whoever is raising
// it.
// And on the stages after the first, tougher monsters among each camp's
// guards (monsters.js), more of them and tougher the higher the stage: a
// Spiky from stage 2, a Grumble Knight from 3, a Big Bruiser from 4, a
// Stone Golem from 5, then another Knight at 6, and a
// Giant Spider at 7; and the beasts (beasts.js): a Shadow Wolf at 8, a
// Stingtail at 9, Rattlebones at 10, a Thunderhawk at 11 and a Mimic at 12,
// the last. They take the place of blobs, so a camp keeps as many guards as
// before (and its mosquito); with fewer guards than that, the toughest go
// first.
export const STAGE_TOUGH = [
  [2, 'spiky'],
  [3, 'knight'],
  [4, 'big'],
  [5, 'golem'],
  [6, 'knight'],
  [7, 'spider'],
  [8, 'wolf'],
  [9, 'stinger'],
  [10, 'rattle'],
  [11, 'hawk'],
  [12, 'mimic'],
];
// The kinds among a camp's guards at a stage, toughest first.
export const toughGuards = (stage) => {
  const s = cleanStage(stage);
  const rank = { golem: 0, stinger: 1, wolf: 2, hawk: 3, mimic: 4, rattle: 5, knight: 6, big: 7, spider: 8, spiky: 9 };
  return STAGE_TOUGH.filter(([from]) => s >= from)
    .map(([, kind]) => kind)
    .sort((a, b) => rank[a] - rank[b]);
};
export const STAGE_GUARDS = 9;
export const STAGE_KING = 4;
export const STAGE_RAISE = 2;
// How long after a stage of Adventure Isle is conquered the page takes
// everyone there on to the next one by itself (ui.js) — the fireworks
// first, and never while a window (a quiz, say) is open.
export const NEXT_STAGE_SECONDS = 15;

// A stage as told: 1 when it is none or nonsense, and never past 9999.
export const cleanStage = (stage) => (Number.isInteger(stage) && stage >= 1 ? Math.min(stage, 9999) : 1);
export const stageGuards = (base, stage) => Math.min(STAGE_GUARDS, base + Math.floor((cleanStage(stage) - 1) / 2));
export const stageKing = (base, stage) => Math.round(base * Math.min(STAGE_KING, 1 + (cleanStage(stage) - 1) / 4));
// How much sooner a boss's moves come on a stage, against stage 1's: a
// fortieth sooner each stage, up to a third (monsters.js gapOf).
export const stageGap = (stage) => Math.max(2 / 3, 1 - (cleanStage(stage) - 1) / 40);

// ------------------------------------------------ the higher stages' dangers

// A camp's monster popped comes back sooner on the higher stages: 600 ms a
// stage, down to 12 seconds.
export const guardBackMs = (stage = 1) => Math.max(12000, GUARD_BACK_MS - 600 * (cleanStage(stage) - 1));
// From stage RESERVE_FROM on, how many times a camp's monsters come back in
// all: as many as guard it, and a third again on the higher stages. Once
// they have, a monster popped stays popped (Infinity: always back).
export const RESERVE_FROM = 3;
export const reserveFor = (players, stage = 1) => (cleanStage(stage) >= RESERVE_FROM ? Math.round(guardsFor(players, stage) * (1 + (cleanStage(stage) - RESERVE_FROM) / 9)) : Infinity);
// From stage 2 on a flag slides back down while the camp's monsters hold
// it, this much of the way a second (and never below nought).
export const slideFor = (stage = 1) => (cleanStage(stage) >= 2 ? 0.01 + 0.003 * (cleanStage(stage) - 2) : 0);
// From stage AMBUSH_FROM on, half way up a camp's flag its monsters ambush
// whoever is raising it: this many more come running, once a camp.
export const AMBUSH_FROM = 3;
export const AMBUSH_AT = 0.5;
export const ambushFor = (players, stage = 1) => (cleanStage(stage) >= AMBUSH_FROM ? Math.min(6, 1 + Math.floor((cleanStage(stage) - 1) / 3) + Math.min(2, Math.max(0, players - 1))) : 0);
// From stage 2 on, hazards come down on whoever is out on the way
// between the camps (isle-story.js, each chapter's own: coconuts, snowballs,
// bolts of lightning…): a red ring where each comes down, a moment ahead,
// on each of them about every this long (ms), sooner the higher the stage,
// more of them at once on the highest, each this many bumps of HP.
export const HAZARD = { from: 2, ms: 1500, reach: 1.8, high: 22 };
export const hazardEvery = (stage) => Math.max(5000, 12000 - 700 * (cleanStage(stage) - 2));
export const hazardCount = (stage) => 1 + Math.floor((cleanStage(stage) - 1) / 5);
export const hazardBumps = (stage) => (cleanStage(stage) >= 8 ? 1 : 0.5);
// How long someone has been past a gate still shut before they are sent
// back: long enough to be no slip of a moment. And how far over the ground
// still counts as there: someone jumping, or up on an animal's back.
export const SNEAK_MS = 800;
const SNEAK_OVER = 6;
export const stageRaise = (base, stage) => {
  const by = Math.min(STAGE_RAISE, 1 + (cleanStage(stage) - 1) / 10);
  return by === 1 ? base : Math.round(base * by);
};

// ------------------------------------------------------- the monster book

// Every monster there is, for the monster collection of Adventure Isle
// (ui.js monsterBook): one seen near you on the isle goes in as seen, and
// one you popped there as defeated, with how many and its stats.
const BOOK = {
  blob: { icon: '👾', name: 'Grumpy Blob' },
  mosquito: { icon: '🦟', name: 'Giant Mosquito' },
  spiky: { icon: '🦔', name: 'Spiky' },
  mole: { icon: '🐹', name: 'Mr. Mole' },
  spider: { icon: '🕷️', name: 'Giant Spider' },
  big: { icon: '💪', name: 'Big Bruiser' },
  knight: { icon: '🛡️', name: 'Grumble Knight' },
  ghost: { icon: '👻', name: 'Lava Ghost' },
  mummy: { icon: '🩹', name: 'Mummy' },
  golem: { icon: '🗿', name: 'Stone Golem' },
  queen: { icon: '👑', name: 'Queen Mosquito' },
  snapper: { icon: '🦀', name: 'Snappy Crab' },
  shroom: { icon: '🍄', name: 'Puffshroom' },
  yeti: { icon: '❄️', name: 'Little Yeti' },
  gummy: { icon: '🧸', name: 'Gummy Bear' },
  cub: { icon: '🍬', name: 'Gummy Cub' },
  fox: { icon: '🦊', name: 'Grumpy Fox' },
  nest: { icon: '🥚', name: 'Storm Nest' },
  // The beasts, by their names and icons (beasts.js).
  ...Object.fromEntries(Object.entries(BEASTS).map(([kind, b]) => [kind, { icon: b.icon, name: b.name }])),
  // The bosses, by their names and icons (bosses.js).
  ...Object.fromEntries(Object.entries(BOSSES).map(([kind, b]) => [kind, { icon: b.icon, name: b.name }])),
  king: { icon: '🤴', name: 'King Grumble' },
};
export const MONSTER_BOOK = MONSTER_LOG.map((kind) => ({ kind, ...BOOK[kind] }));

// A monster's stats, as the collection shows them: its hearts (HP), the HP
// a bump of it takes off you (ATK, fire for a Lava Ghost), what jumping on
// it does (JMP) and how quick it comes after you (before a bop makes it
// cross), against how quick you run (SPD). A boss's hearts are for one
// friend on stage 1: more friends, and higher stages, give it more.
export function monsterStats(kind) {
  const pct = (run) => Math.round((100 * run) / MOVE.run);
  if (isBoss(kind)) {
    const plan = planOf(kind);
    return { hp: bossHearts(plan, 1), atk: Math.round(plan.bump * BUMP_HP), fire: Boolean(breathMove(plan)), jump: 'Counts as a bop', speed: pct(plan.run[0]) };
  }
  const k = kindOf(kind);
  const jump = k.land === Infinity ? 'Pops at once' : k.land ? `${Math.ceil(k.hearts / k.land)} jumps` : 'No jumping!';
  const fire = kind === 'ghost';
  return { hp: k.hearts, atk: Math.round((fire ? GHOST_FIRE.bumps : k.bump) * BUMP_HP), fire, jump, speed: pct(k.move.run) };
}

const FL = Math.floor;
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const PURPLE = B.TOY_BRICKS[8];

// ---------------------------------------------------------------- making them

// What is not the ground: trees (candy trees have trunks of white bricks).
const TREE = new Uint8Array(B.BLOCK_IDS);
for (const id of [B.WOOD, B.LEAVES, B.PINE_LEAVES, B.KATSURA_WOOD, B.KATSURA_LEAVES, B.KATSURA_TREE, B.KATSURA_GIANT, B.TREE_CORE, B.SNOWY_LEAVES, B.COTTON_CANDY, B.TOY_BRICKS[11], ...B.WILD_TREES, ...B.TOON_TREES]) TREE[id] = 1;

// The height of the ground in every column, under any tree, and whether it
// is under water: the sea (1), or a pond or ice above the sea (2).
export function groundMap(world) {
  const { W, D, H, sea } = world;
  const ground = new Int16Array(W * D);
  const wet = new Uint8Array(W * D);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const base = (x * D + z) * H;
      let y = H - 1;
      for (; y > 0; y--) {
        const id = world.blocks[base + y];
        if (B.SOLID[id] && !TREE[id]) break;
      }
      const k = x * D + z;
      ground[k] = y;
      let top = y;
      while (top + 1 < H && world.blocks[base + top + 1] === B.WATER) top++;
      if (world.blocks[base + y] === B.ICE || top > Math.max(y, sea)) wet[k] = 2;
      else if (top > y || y < sea) wet[k] = 1;
    }
  }
  return { ground, wet };
}

// Levels the ground round a camp at its height, out to just past its fence,
// sloping back to the land as it was a little further out (where the sea
// is, it stays; and land much higher or lower than the camp is left as it
// is — a cliff stays a cliff — rather than eased into a slope, one that
// would be a way up it), and lays the gloomy ground: all of the camp, and
// some round it, ragged at the edge. Nothing stays standing on it, and no
// jewel shows in it.
export function flatten(world, map, pal, spot) {
  const { cx, cz, level, r, square } = spot;
  const { H, D } = world;
  const outer = r + 3;
  for (let dx = -outer; dx <= outer; dx++) {
    for (let dz = -outer; dz <= outer; dz++) {
      const d = square ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
      if (d > outer + 0.5) continue;
      const x = cx + dx;
      const z = cz + dz;
      const k = x * D + z;
      const wet = map.wet[k];
      if (wet && d > r + 1) continue;
      const g = map.ground[k];
      const t = d <= r + 1 ? 0 : Math.min(1, (d - (r + 1)) / (outer + 0.5 - (r + 1)));
      if (t > 0 && Math.abs(g - level) >= 3) continue;
      const target = wet ? level : Math.round(level + (g - level) * t * t * (3 - 2 * t));
      for (let y = target + 1; y < H; y++) if (world.get(x, y, z) !== B.AIR) world.set(x, y, z, B.AIR);
      if (target > g) for (let y = g + 1; y <= target; y++) world.set(x, y, z, y === target ? pal.top : pal.under);
      else if (target < g || d <= r + 1) world.set(x, target, z, pal.top);
      for (let y = target - 2; y < target; y++) if (B.GEM_ROCK[world.get(x, y, z)]) world.set(x, y, z, pal.under);
      if (d <= r + 0.6 + hash2(world.seed + 97, x, z) * 2.2) world.set(x, target, z, B.GLOOM);
    }
  }
}

// A camp's fence: logs round it, every other one a little taller, with a
// way in at each of ways (the angles the path comes in and goes out by,
// isle-maps.js), each with a lamp on a post at either side; a little stone
// floor for the flag in the middle, and hay bales for the monsters to sleep
// on. style: what the fence is made of, its posts, lamps, floor and beds
// (each camp is made of what its corner of the isle has).
export function campFence(world, rng, spot, ways, style = {}) {
  const { post = B.WOOD, lamp = B.LAMP, floor = B.PEBBLES, bed = B.HAY } = style;
  const { cx, cz, r } = spot;
  const y0 = spot.level + 1;
  const half = 1.6 / r;
  for (let dx = -r - 1; dx <= r + 1; dx++) {
    for (let dz = -r - 1; dz <= r + 1; dz++) {
      const d = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx);
      if (d < r - 0.5 || d >= r + 0.5 || ways.some((w) => Math.abs(wrap(a - w)) < half)) continue;
      const tall = ((dx + dz) & 1) === 0 ? 3 : 2;
      for (let y = 0; y < tall; y++) world.set(cx + dx, y0 + y, cz + dz, post);
    }
  }
  for (const w of ways) {
    for (const side of [-1, 1]) {
      const a = w + side * (half + 0.9 / r);
      const x = cx + Math.round(Math.cos(a) * r);
      const z = cz + Math.round(Math.sin(a) * r);
      for (let y = 0; y < 3; y++) world.set(x, y0 + y, z, post);
      world.set(x, y0 + 3, z, lamp);
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + dx, y0, cz + dz, floor);
  for (let tries = 0, hay = 0; tries < 40 && hay < 3; tries++) {
    const a = rng.range(-Math.PI, Math.PI);
    if (ways.some((w) => Math.abs(wrap(a - w)) < 0.8)) continue;
    const d = rng.range(3, r - 2.5);
    const x = cx + Math.round(Math.cos(a) * d);
    const z = cz + Math.round(Math.sin(a) * d);
    if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) <= 2 || world.get(x, y0, z) !== B.AIR) continue;
    world.set(x, y0, z, bed);
    hay++;
  }
}

// A boss's lair, a castle: stone walls five high with battlements and a
// purple stripe, a tower at each corner with a lamp on top, lamps in the
// middle of the walls, and a way in, three wide and four high, in the wall
// on side (the way the path comes from); the stone floor for its flag in
// the middle of the yard. style: what it is made of (each lair its own,
// isle-maps.js): its walls, the stripe along them, its towers, lamps and
// floor.
export function castleWalls(world, spot, side, style = {}) {
  const { wall = B.BRICK_WALL, stripe = PURPLE, tower = wall, lamp = B.LAMP, floor = B.PEBBLES } = style;
  const { cx, cz, r: R } = spot;
  const y0 = spot.level + 1;
  for (let dx = -R - 1; dx <= R + 1; dx++) {
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      const ax = Math.abs(dx);
      const az = Math.abs(dz);
      const x = cx + dx;
      const z = cz + dz;
      if (ax >= R - 1 && az >= R - 1) {
        for (let y = 0; y < 8; y++) world.set(x, y0 + y, z, tower);
        if (ax === R && az === R) world.set(x, y0 + 8, z, lamp);
        else if (((dx + dz) & 1) === 0) world.set(x, y0 + 8, z, tower);
        continue;
      }
      if (Math.max(ax, az) !== R) continue;
      for (let y = 0; y < 5; y++) world.set(x, y0 + y, z, y === 3 && ((dx + dz) & 3) === 0 ? stripe : wall);
      if (((dx + dz) & 1) === 0) world.set(x, y0 + 5, z, wall);
    }
  }
  for (const [sx, sz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = cx + sx * R;
    const z = cz + sz * R;
    if (sx === side[0] && sz === side[1]) {
      for (let p = -1; p <= 1; p++) for (let y = 0; y < 4; y++) world.set(x + (sz ? p : 0), y0 + y, z + (sx ? p : 0), B.AIR);
    } else {
      world.set(x, y0 + 2, z, lamp);
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) world.set(cx + dx, y0, cz + dz, floor);
}

// A camp freed: its gloomy ground back to the island's own (pal.top), with
// flowers coming up here and there. Returns the cells, as an edit.
export function freeCells(world, camp, pal, rng) {
  const cells = [];
  const reach = camp.r + 4;
  const cx = FL(camp.x);
  const cz = FL(camp.z);
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (campDistance(camp, x + 0.5, z + 0.5) > reach) continue;
      for (let y = 1; y < world.H - 1; y++) {
        if (world.get(x, y, z) !== B.GLOOM) continue;
        cells.push(x, y, z, pal.top);
        if (world.get(x, y + 1, z) === B.AIR && rng.chance(0.2)) cells.push(x, y + 1, z, rng.pick(pal.flowers));
      }
    }
  }
  return cells;
}

// ---------------------------------------------------------------- the way on foot

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Walking over an island's blocks: a step up at a time, down any drop, never
// through water or lava, nor through anything solid — as the gates of the
// isle's maps are meant to hold (isle-maps.js). Cells go by their number
// among the world's.
//   stand(x, y, z)         whether someone can stand in this cell: ground
//                          under them, room for them, and dry;
//   step(x, y, z, dx, dz)  how high they stand after a step that way from
//                          where they stand, or -1 where there is no going;
//   spot([x, y, z])        the cell someone stands in at a spot — on the
//                          ground at their feet, or just under them — or -1.
function walker(world) {
  const { W, D, H, blocks } = world;
  const at = (x, y, z) => blocks[(x * D + z) * H + y];
  const free = (x, y, z) => y >= H || !B.SOLID[at(x, y, z)];
  const wet = (x, y, z) => at(x, y, z) === B.WATER || at(x, y, z) === B.LAVA;
  const stand = (x, y, z) => Boolean(B.SOLID[at(x, y - 1, z)]) && free(x, y, z) && free(x, y + 1, z) && !wet(x, y, z);
  const step = (x, y, z, dx, dz) => {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= W || nz >= D) return -1;
    if (free(nx, y, nz) && free(nx, y + 1, nz)) {
      // Across on the level, or off an edge and down to whatever is below
      // (into water or lava, there is no walking on).
      let ny = y;
      while (!wet(nx, ny, nz) && ny > 1 && !B.SOLID[at(nx, ny - 1, nz)]) ny--;
      return !wet(nx, ny, nz) && B.SOLID[at(nx, ny - 1, nz)] ? ny : -1;
    }
    // Up a step, with room overhead to take it.
    return y + 2 < H && B.SOLID[at(nx, y, nz)] && free(nx, y + 1, nz) && free(nx, y + 2, nz) && free(x, y + 2, z) && !wet(nx, y + 1, nz) ? y + 1 : -1;
  };
  const spot = ([fx, fy, fz]) => {
    const x = FL(fx);
    const z = FL(fz);
    if (x < 0 || z < 0 || x >= W || z >= D) return -1;
    const top = Math.min(H - 2, Math.round(fy) + 1);
    for (let y = top; y >= 1 && y >= top - 4; y--) if (stand(x, y, z)) return (x * D + z) * H + y;
    return -1;
  };
  return { stand, step, spot };
}

// Everywhere on an island that can be walked to from the spots given ([x, y,
// z] each, where someone stands). Returns marks, a byte for every cell of
// the world: 1 where someone has walked to and stands.
export function walkReach(world, from) {
  const { W, D, H } = world;
  const { step, spot } = walker(world);
  const seen = new Uint8Array(W * D * H);
  const todo = [];
  const mark = (i) => {
    if (i < 0 || seen[i]) return;
    seen[i] = 1;
    todo.push(i);
  };
  for (const s of from) mark(spot(s));
  while (todo.length) {
    const i = todo.pop();
    const y = i % H;
    const z = ((i - y) / H) % D;
    const x = (i - y - z * H) / (H * D);
    for (const [dx, dz] of STEPS) {
      const ny = step(x, y, z, dx, dz);
      if (ny >= 0) mark(((x + dx) * D + z + dz) * H + ny);
    }
  }
  return seen;
}

// And the other way round: everywhere the spots given can be walked to from
// (not the same: a drop goes down only). Marks as walkReach's: 1 where
// someone stands who can walk there.
export function walkBack(world, to) {
  const { W, D, H } = world;
  const { stand, step, spot } = walker(world);
  // Every step there is to take on the island, by where it ends: the last
  // one found ending in each cell, and for each step the one found before it
  // that ends there too, and where it starts.
  const last = new Int32Array(W * D * H).fill(-1);
  const before = [];
  const start = [];
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      for (let y = 1; y < H; y++) {
        if (!stand(x, y, z)) continue;
        for (const [dx, dz] of STEPS) {
          const ny = step(x, y, z, dx, dz);
          if (ny < 0) continue;
          const j = ((x + dx) * D + z + dz) * H + ny;
          before.push(last[j]);
          start.push((x * D + z) * H + y);
          last[j] = start.length - 1;
        }
      }
    }
  }
  const seen = new Uint8Array(W * D * H);
  const todo = [];
  const mark = (i) => {
    if (i < 0 || seen[i]) return;
    seen[i] = 1;
    todo.push(i);
  };
  for (const s of to) mark(spot(s));
  while (todo.length) for (let e = last[todo.pop()]; e >= 0; e = before[e]) mark(start[e]);
  return seen;
}

// ---------------------------------------------------------------- playing them

const noKing = () => ({ id: 0, hearts: 0, max: 0, minions: 0, hits: new Map(), hitAt: 0, healAt: 0 });

export class AdventureSim {
  // camps: as the stage's map makes them (isle-maps.js), each
  // { id, kind: 'camp' or 'castle', x, y, z, r } — numbered along the way,
  // the lair (the castle) last, (x, y, z) where its flag stands — with
  // whether each is free; won: the lair's boss popped, and the whole stage
  // free; stage: which stage of Adventure Isle this is, a chapter of its
  // story (isle-story.js), for how hard its monsters are and which they are
  // (its guards, and the helpers its boss calls); journey: how many times
  // round the story this is (server/adventure.js); gates: the gates shut
  // across its way, each { camp, x, y, z, cells } — freeing that camp opens
  // it (cells, an edit, are what it becomes); chestSpots: where its treasure
  // chests may turn up, beside its way (treasure.js). On a chapter told in
  // challenges (the fourth episode's), quests: each laid out as the map has it
  // (isle-quests.js), and hub: its bell's cage, { bell: [x, y, z] (where the
  // bell hangs), locks: [[x, y, z]...] (a lock for each challenge, in their
  // order), open: an edit opening the cage, perch: [x, y, z] (where Jinx sits
  // on it) }.
  // On a chapter told in battles (the fifth episode's), battles: each laid
  // out as the map has it (isle-battles.js), hub: its Sky Lantern, { lantern:
  // [x, y, z], lamps: [[x, y, z]...] (a lamp for each battle, in their
  // order) }, roads: the ways its gangs go along, and world: its island.
  constructor({ camps = [], won = false, stage = 1, journey = 1, gates = [], chestSpots = null, quests = null, hub = null, battles = null, roads = null, world = null } = {}, seed = 1) {
    this.rng = new Rng(seed);
    this.stage = cleanStage(stage);
    this.journey = Number.isInteger(journey) && journey >= 1 ? journey : 1;
    this.story = chapterOf(this.stage);
    // How hard it is: its chapter says (isle-story.js), as a stage of the
    // first episode.
    this.level = this.story.level;
    // Who holds the lair: the chapter's boss (bosses.js).
    this.boss = this.story.boss;
    this.plan = planOf(this.boss);
    this.gates = gates.map((g) => ({ ...g, open: Boolean(won) }));
    this.camps = camps.map((c) => {
      const freed = Boolean(c.freed) || Boolean(won);
      return { id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed, progress: freed ? 1 : 0, awake: false, quiet: 0, back: [], holders: 0, guarded: false, queen: false, reserve: Infinity, ambushed: false };
    });
    // The deepest camp — the one furthest from the start — wakes the Queen
    // Mosquito with its own monsters, as a tougher extra guard (but on the
    // Wild Isle, where every creature is a real one: isle-story.js real).
    const deepest = this.camps.filter((c) => c.kind === 'camp').pop();
    if (deepest && !this.story.episode.real) deepest.queen = true;
    this.won = Boolean(won) || (this.camps.length > 0 && this.camps.every((c) => c.freed));
    this.king = noKing();
    // The Monster Gashapon (stepGasha): where it is ({ x, y, z, until }) or
    // null, when it turns up next (0: not yet counting), and randomness of
    // its own, so the rest goes just as it did before there was one.
    this.gasha = null;
    this.gashaNext = 0;
    this.gashaRng = new Rng((seed ^ 0x9e3779b9) >>> 0);
    // The treasure chests (treasure.js), with randomness of their own too.
    this.chests = new Chests((seed ^ 0x85ebca6b) >>> 0, chestSpots);
    // The hazards on the way (stepHazards): when each person is next in for
    // one, by id, with randomness of their own as well.
    this.hazardAt = new Map();
    this.hazardRng = new Rng((seed ^ 0xc2b2ae35) >>> 0);
    // No way round a gate (stepSneaks): the way through the island as it is
    // now (ways), worked out when it is first wanted and again as a camp is
    // freed; and since when each person has been past a gate still shut.
    this.way = null;
    this.sneakAt = new Map();
    // What each person has done for the stage so far, by id (credit): for
    // the results everyone sees once it is won (stageResults).
    this.deeds = new Map();
    // Jinx's challenges, on a chapter told in them, and the cage of its bell
    // (see the top); Jinx on the cage (a critter of the island's, as set up),
    // and how his flight off is going once the stage is won.
    this.quests = this.story.quests ? new Quests(quests ?? [], this.story.quests, seed) : null;
    this.hub = hub;
    this.perched = null;
    if (this.quests && won) for (const q of this.quests.list) q.done = true;
    // The battles of Toon Isle, on a chapter told in them (see the top), with
    // their clouds; and when it was last moved on, for how long each has left.
    this.battles = this.story.battles && world ? new Battles({ specs: battles ?? [], story: this.story, level: this.level, roads: roads ?? [], spawn: world.spawn, W: world.W, D: world.D }, (seed ^ 0x1b873593) >>> 0) : null;
    this.now = 0;
    // A dream of the Land of Nod, on a chapter told in its nightmares (the
    // sixth episode's: nod/dream.js), which has no island at all.
    this.dream = this.story.nightmares ? new Dream({ key: this.story.key, story: this.story, level: this.level, done: won ? this.story.nightmares.map((_, i) => i + 1) : [] }, (seed ^ 0x2545f491) >>> 0) : null;
    if (this.battles && won) for (const b of this.battles.list) Object.assign(b, { done: true, state: 'done' });
  }

  // The island's critters that play a part in its challenges, put on it (and
  // Jinx on his bell's cage), once, as the island is made: critters, the
  // island's (critters.js CritterSim), kept for the challenges to steer.
  setup(world, critters) {
    this.critters = critters;
    if (!this.quests) return;
    this.quests.setup(world, critters);
    const perch = this.hub?.perch;
    if (perch && !this.won) {
      const c = critters.add('magpie', perch[0] + 0.5, perch[1], perch[2] + 0.5, null, Math.atan2(world.spawn.x - perch[0], world.spawn.z - perch[2]));
      if (c) {
        c.held = true;
        this.perched = { cid: c.id, off: 0 };
      }
    }
  }

  // Something done for the stage by person id: what, one of DEEDS' keys, n
  // times (or seconds, for raising a flag).
  credit(id, what, n = 1) {
    if (this.won || !(what in DEEDS) || !(n > 0)) return;
    let d = this.deeds.get(id);
    if (!d) this.deeds.set(id, (d = { pops: 0, boss: 0, flag: 0, helps: 0, play: 0 }));
    d[what] += n;
  }

  // The treasure chests, now and then: the cells that changed, [x, y, z,
  // id] each.
  stepChests(world, now) {
    return this.chests.step(world, now, { stage: this.level, camps: this.camps });
  }

  // Whether there is anything left to free (or a challenge to beat).
  get active() {
    return !this.won && (this.camps.length > 0 || Boolean(this.quests?.list.length) || Boolean(this.battles?.list.length) || Boolean(this.dream));
  }

  get castle() {
    return this.camps.find((c) => c.kind === 'castle') ?? null;
  }

  // The boss is in its bubble while any camp is not free.
  get shielded() {
    return this.camps.some((c) => c.kind === 'camp' && !c.freed);
  }

  campById(id) {
    return this.camps.find((c) => c.id === id) ?? this.battles?.campById(id) ?? null;
  }

  // How the adventure is going, for the list of open islands (on a chapter
  // told in challenges, its challenges and how many are beaten).
  tally() {
    if (this.dream) return { camps: this.dream.all.length, freed: this.dream.all.filter((n) => n.done).length, won: this.won, stage: this.stage, nod: true };
    if (this.battles) return { camps: this.battles.list.length, freed: this.battles.list.filter((b) => b.done).length, won: this.won, stage: this.stage, battles: true };
    if (this.quests) return { camps: this.quests.list.length, freed: this.quests.list.filter((q) => q.done).length, won: this.won, stage: this.stage, quests: true };
    const camps = this.camps.filter((c) => c.kind === 'camp');
    return { camps: camps.length, freed: camps.filter((c) => c.freed).length, won: this.won, stage: this.stage };
  }

  // What has been done that is kept over a restart (server/adventure.js): the
  // camps freed, or the challenges beaten, by their ids.
  doneIds() {
    if (this.dream) return this.dream.doneIds();
    if (this.battles) return this.battles.list.filter((b) => b.done).map((b) => b.id);
    return this.quests ? this.quests.list.filter((q) => q.done).map((q) => q.id) : this.camps.filter((c) => c.freed).map((c) => c.id);
  }

  // The safe places no monster goes into: the island's start, and every
  // camp freed (the castle too, once the island is).
  havens(world) {
    // (On Toon Isle, where everyone arrives and every battle won.)
    if (this.battles) return this.battles.havens(SAFE_RADIUS);
    const out = [{ x: world.spawn.x, z: world.spawn.z, r: SAFE_RADIUS }];
    for (const c of this.camps) if (c.freed) out.push({ x: c.x, z: c.z, r: c.r + 0.5, kind: c.kind });
    return out;
  }

  // Where someone out of hearts at (x, z) comes back: the nearest safe
  // place, beside its flag (or the island's start).
  homeFor(world, x, z) {
    let best = { x: world.spawn.x, y: world.spawn.y, z: world.spawn.z };
    let far = Math.hypot(x - best.x, z - best.z);
    // (On Toon Isle, beside the nearest battle won.)
    for (const h of this.battles?.havenList ?? []) {
      const d = Math.hypot(x - h.x, z - h.z);
      if (d >= far) continue;
      const y = standHeight(world, h.x + 2, h.z + 2, (h.y ?? world.sea) + 6);
      if (y === null) continue;
      far = d;
      best = { x: h.x + 2, y, z: h.z + 2 };
    }
    for (const c of this.camps) {
      if (!c.freed) continue;
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < far) {
        far = d;
        best = { x: c.x, y: c.y, z: c.z + 2 };
      }
    }
    return best;
  }

  // Moves it all on by dt seconds: camps waking and sleeping, monsters coming
  // back, flags going up, the boss's helpers. people: as for the
  // monsters (MonsterSim.step); players: how many are on the island. Returns
  // what happened, for the room to make happen and tell everyone:
  //   { t: 'freed', camp, by, gone, shieldDown, won }
  step(world, dt, now, people, monsters, players) {
    const news = [];
    this.now = now;
    if (!this.active) return news;
    // (A dream is moved on by the room itself: room.js stepDream.)
    if (this.dream) return news;
    if (this.quests) return this.stepQuests(world, dt, now, people);
    if (this.battles) return this.stepBattles(world, dt, now, people, monsters, players);
    const want = guardsFor(players, this.level);
    for (const c of this.camps) {
      if (c.freed) continue;
      if (people.some((p) => campDistance(c, p.x, p.z) <= c.r + WAKE)) {
        c.quiet = 0;
        if (!c.awake) this.wake(world, c, people, monsters, players);
      } else if (c.awake) {
        c.quiet ||= now;
        if (now - c.quiet >= SLEEP_MS) this.sleep(c, monsters);
      }
      if (!c.awake) continue;
      if (c.kind === 'castle') this.stepCastle(world, c, now, monsters);
      else this.stepCamp(world, c, dt, now, people, monsters, want, news);
    }
    return news;
  }

  // A chapter told in challenges, moved on by dt seconds (isle-quests.js).
  // Returns what happened, for the room to make happen and tell everyone:
  //   { t: 'qfx', id, k, ... }  something to see or hear, on a challenge;
  //   { t: 'cells', cells }      an edit (a shiny gone, a bonfire alight);
  //   { t: 'quest', quest, by, cells, won }  a challenge beaten (cells: its
  //                              lock lit, and once it is the last, the cage
  //                              opening: won, the stage won).
  stepQuests(world, dt, now, people) {
    const news = [];
    const out = this.quests.step(world, dt, now, people, this.critters ?? { get: () => null, add: () => null });
    for (const [pid, n] of out.credit) this.credit(pid, 'play', n);
    for (const fx of out.fx) news.push({ t: 'qfx', ...fx });
    if (out.cells.length) news.push({ t: 'cells', cells: out.cells });
    for (const { quest, by } of out.done) {
      const cells = this.lockCells(world, [quest.id]);
      const won = this.quests.allDone;
      if (won) {
        this.won = true;
        cells.push(...(this.hub?.open ?? []));
      }
      news.push({ t: 'quest', quest, by, cells, won });
    }
    return news;
  }

  // A chapter told in battles, moved on by dt seconds (isle-battles.js).
  // Returns what happened, for the room to make happen and tell everyone:
  //   { t: 'fog', a }              tiles of the Cloud Blanket newly rolled back;
  //   { t: 'bfx', id, k, ... }     something to see or hear, of a battle;
  //   { t: 'cells', cells }        an edit (an ambush's ring of thorns, a beacon alight);
  //   { t: 'sky', ... }            lightning thrown down out of the sky (the Baron's);
  //   { t: 'battle', battle, by, cells, won }  a battle won (cells: its lamp lit
  //                                on the Sky Lantern; won, the stage won).
  stepBattles(world, dt, now, people, monsters, players) {
    const news = [];
    const out = this.battles.step(world, dt, now, people, monsters, players);
    if (out.fog.length) news.push({ t: 'fog', a: out.fog });
    for (const [pid, n] of out.credit) this.credit(pid, 'play', n);
    for (const [pid, n] of out.flag) this.credit(pid, 'flag', n);
    for (const fx of out.fx) news.push({ t: 'bfx', ...fx });
    if (out.cells.length) news.push({ t: 'cells', cells: out.cells });
    for (const h of out.hurls) news.push({ t: 'sky', ...h });
    for (const { battle, by } of out.done) {
      const cells = this.lampCells([battle.id]);
      const won = this.battles.won;
      if (won) this.won = true;
      news.push({ t: 'battle', battle, by, cells, won, fog: won ? this.battles.fog.revealAll() : [] });
    }
    // The Baron's hearts, for his bar, while he is about.
    const sd = this.battles.showdown;
    this.king = sd ? { ...noKing(), id: sd.monster, hearts: sd.hearts, max: sd.max } : noKing();
    return news;
  }

  // The lamps of battles won (by their ids), lit on the Sky Lantern: an edit.
  lampCells(ids) {
    const cells = [];
    for (const id of ids) {
      const at = this.hub?.lamps?.[id - 1];
      if (at) cells.push(at[0], at[1], at[2], B.LANTERN_LAMP_ON);
    }
    return cells;
  }

  // Battles won before, and the clouds rolled back before (kept over a
  // restart: server/adventure.js), as they were, with nobody there to see:
  // returns the edit that makes the island look it (and their lamps lit).
  restoreBattles(world, ids, fog = '') {
    if (!this.battles) return [];
    this.battles.fog.load(fog);
    const cells = this.battles.restore(ids, world);
    cells.push(...this.lampCells(this.battles.list.filter((b) => b.done).map((b) => b.id)));
    return cells;
  }

  // The clouds rolled back so far, as kept (Fog.pack), or '' with none.
  keptFog() {
    return this.battles ? this.battles.fog.pack() : '';
  }

  // Someone popped a monster (room.js popMonster): a battle may be waiting
  // on it (a hunt's Big Bad, a Storm Nest, the Baron).
  popped(m) {
    this.battles?.popped.add(m.id);
  }

  // Who the Storm Gang comes after besides everyone (isle-battles.js): its
  // beacons alight, and where a Big Bad runs off to.
  decoys() {
    return this.battles ? this.battles.beacons(this.now) : [];
  }

  // A monster bumped a decoy (a beacon, by its id): what everyone sees of it,
  // or null.
  decoyBumped(pid, monster, now) {
    return this.battles?.beaconBumped(pid, monster, now) ?? null;
  }

  // The locks of challenges beaten (by their ids), lit on the bell's cage: an edit.
  lockCells(world, ids) {
    const cells = [];
    for (const id of ids) {
      const at = this.hub?.locks?.[id - 1];
      if (at) cells.push(at[0], at[1], at[2], B.ESCAPE_BUTTONS_ON[(id - 1) % B.ESCAPE_BUTTONS_ON.length]);
    }
    return cells;
  }

  // Challenges beaten before (kept over a restart: server/adventure.js), beaten
  // again with nobody there to see: returns the edit that makes the island
  // look it (and their locks lit).
  restoreQuests(world, ids) {
    if (!this.quests) return [];
    const cells = this.quests.restore(ids, world, this.critters ?? { get: () => null });
    cells.push(...this.lockCells(world, this.quests.list.filter((q) => q.done).map((q) => q.id)));
    return cells;
  }

  // Jinx on his bell's cage (see setup): looking down at whoever is nearest
  // while the stage goes on, and once it is won, off he flies, over the sea
  // and away. Every tick, won or not.
  stepPerch(world, now, people) {
    const p = this.perched;
    const c = p && this.critters?.get(p.cid);
    if (!c) return;
    const [px, py, pz] = this.hub.perch;
    if (!this.won) {
      let best = null;
      for (const o of people) if (!best || Math.hypot(o.x - c.x, o.z - c.z) < Math.hypot(best.x - c.x, best.z - c.z)) best = o;
      if (best && Math.hypot(best.x - c.x, best.z - c.z) < 30) c.yaw = Math.atan2(best.x - c.x, best.z - c.z);
      Object.assign(c, { x: px + 0.5, y: py, z: pz + 0.5, state: 'idle' });
      return;
    }
    p.off ||= now;
    const t = Math.min(9, (now - p.off) / 1000);
    // Away from the middle of the island, out to sea, climbing as he goes.
    const ax = px - world.W / 2;
    const az = pz - world.D / 2;
    const d = Math.hypot(ax, az) || 1;
    Object.assign(c, { x: px + 0.5 + (ax / d) * t * 8, y: py + t * 2.6 + Math.min(1, t) * 1.5, z: pz + 0.5 + (az / d) * t * 8, yaw: Math.atan2(ax, az), state: 'fly' });
  }

  // Someone came near: out come its monsters (or the lair's boss, the
  // chapter's, bosses.js — with its hearts for as many friends as are on
  // the island now). The deepest camp wakes the Queen Mosquito too, as a
  // tougher extra guard.
  wake(world, c, people, monsters, players) {
    c.awake = true;
    c.back = [];
    if (c.kind === 'castle') {
      const at = this.kingSpot(world, c);
      const m = monsters.add(world, at.x, at.y, at.z, { camp: c.id, kind: this.boss, plan: this.plan });
      m.passive = this.shielded;
      // Quicker with its moves the higher the stage.
      m.gapScale = stageGap(this.level);
      const hearts = bossHearts(this.plan, players, this.level);
      this.king = { ...noKing(), id: m.id, hearts, max: hearts };
      return;
    }
    for (let i = 0; i < guardsFor(players, this.level); i++) this.addGuard(world, c, people, monsters);
    // (Their reserve is set once, the first time they come out: it does
    // not fill up again as they go back to sleep and wake.)
    if (c.reserve === Infinity) c.reserve = reserveFor(players, this.level);
    if (c.queen) this.addQueen(world, c, people, monsters);
    this.addChampion(world, c, people, monsters, players);
  }

  // Nobody near for a while: its monsters go back in, and come out afresh
  // next time (the boss with all its hearts again). How far a flag got
  // stays.
  sleep(c, monsters) {
    Object.assign(c, { awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    for (const m of [...monsters.list]) if (m.camp === c.id) monsters.remove(m.id);
    if (c.kind === 'castle') this.king = noKing();
  }

  // The boss's place in its yard: beside its flag, on the far side from the start.
  kingSpot(world, c) {
    const spawn = world.spawn;
    const spots = [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ].map(([dx, dz]) => ({ x: c.x + dx, y: c.y, z: c.z + dz }));
    return spots.reduce((a, b) => (Math.hypot(b.x - spawn.x, b.z - spawn.z) > Math.hypot(a.x - spawn.x, a.z - spawn.z) ? b : a));
  }

  // A camp's monster hopping out: somewhere in the camp, not right beside anyone.
  // One of them is a mosquito, hanging over the camp on the wing; on the
  // higher stages, tougher ones come next (toughGuards), and blobs after.
  addGuard(world, c, people, monsters) {
    const bug = this.guardKind(c, monsters);
    for (let tries = 0; tries < 30; tries++) {
      const a = this.rng.range(-Math.PI, Math.PI);
      const d = this.rng.range(2.5, Math.max(3, c.r - 2.5));
      const x = FL(c.x + Math.cos(a) * d) + 0.5;
      const z = FL(c.z + Math.sin(a) * d) + 0.5;
      const y = standHeight(world, x, z, c.y + 2);
      if (y === null || Math.abs(y - c.y) > 3) continue;
      if (people.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      // (A beast is wide: on ground it fits, not half in a fence.)
      if (isBeast(bug) && bodyOverlapsSolid(world, { x, y, z, ...bodyOf(bug) })) continue;
      return monsters.add(world, x, y, z, { camp: c.id, kind: bug });
    }
    return monsters.add(world, c.x + 2.5, c.y, c.z, { camp: c.id, kind: bug });
  }

  // The Queen Mosquito out over the deepest camp (see wake): on the wing
  // above its middle, where she can see whoever comes in. She comes back the
  // same way if she ever goes off by herself (into water someone poured in).
  addQueen(world, c, people, monsters) {
    const m = monsters.add(world, c.x, c.y + 1, c.z, { camp: c.id, kind: 'queen' });
    if (m) m.queen = true;
    return m;
  }

  // The beast (beasts.js) that is a camp's champion, or null: each chapter has
  // its own, from its second camp on (isle-story.js) — but none in the deepest
  // camp of the very first stage, where the Queen Mosquito is enough for anyone.
  championOf(c) {
    const i = this.camps.filter((o) => o.kind === 'camp').indexOf(c);
    if (i < 0 || (this.level === 1 && c.queen)) return null;
    return this.story.champions?.[i - 1] ?? null;
  }

  // A camp's champion out as the camp wakes, an extra guard as the Queen Mosquito
  // is (and popped, it is gone for good until the camp next sleeps): in the camp,
  // on ground it fits, a Mimic not far from the flag, where whoever comes to raise
  // it will find it. Young on the first stages, full grown from the sixth, and
  // tougher with more friends on the island, so the way never closes on anyone
  // by themselves, and a gang does not walk through it.
  addChampion(world, c, people, monsters, players = 1) {
    const kind = this.championOf(c);
    if (!kind) return null;
    const size = bodyOf(kind);
    const far = kindOf(kind).shut ? 3.5 : Math.max(3, c.r - 2.5);
    let spot = { x: c.x + 2.5, y: c.y, z: c.z };
    for (let tries = 0; tries < 30; tries++) {
      const a = this.rng.range(-Math.PI, Math.PI);
      const d = this.rng.range(2.5, far);
      const x = FL(c.x + Math.cos(a) * d) + 0.5;
      const z = FL(c.z + Math.sin(a) * d) + 0.5;
      const y = standHeight(world, x, z, c.y + 2);
      if (y === null || Math.abs(y - c.y) > 3) continue;
      if (people.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) continue;
      if (bodyOverlapsSolid(world, { x, y, z, radius: size.radius, height: size.height })) continue;
      spot = { x, y, z };
      break;
    }
    const m = monsters.add(world, spot.x, spot.y, spot.z, { camp: c.id, kind });
    if (m) {
      m.champion = true;
      const grown = Math.min(1, 0.4 + 0.1 * this.level);
      m.hearts = Math.max(3, Math.round(kindOf(kind).hearts * grown * (1 + 0.3 * (Math.min(8, Math.max(1, players)) - 1))));
      m.max = m.hearts;
    }
    return m;
  }

  // Which kind a camp needs next: its mosquito, then whichever of the
  // chapter's own monsters and the stage's tough ones it is missing, then a
  // blob. The queen is not one of them: she is the deepest camp's own extra
  // guard (addQueen).
  guardKind(c, monsters) {
    const here = monsters.list.filter((m) => m.camp === c.id && m.kind !== 'queen').map((m) => m.kind);
    // On the Wild Isle, only its own animals: the chapter's, a boar or a
    // wolf among them on the higher stages, and the chapter's again after.
    if (this.story.episode.real) {
      const have = new Map();
      for (const k of here) have.set(k, (have.get(k) ?? 0) + 1);
      const own = this.story.guards ?? ['fox'];
      const tough = this.level >= 12 ? ['boar', 'wolf'] : this.level >= 10 ? ['boar'] : [];
      for (const k of [...own, ...tough]) {
        if ((have.get(k) ?? 0) > 0) have.set(k, have.get(k) - 1);
        else return k;
      }
      return own[here.length % own.length];
    }
    if (!here.includes('mosquito')) return 'mosquito';
    const have = new Map();
    for (const k of here) have.set(k, (have.get(k) ?? 0) + 1);
    have.set('mosquito', have.get('mosquito') - 1);
    for (const k of [...(this.story.guards ?? []), ...toughGuards(this.level)]) {
      if ((have.get(k) ?? 0) > 0) have.set(k, have.get(k) - 1);
      else return k;
    }
    return 'blob';
  }

  // A camp awake: its popped monsters coming back, and its flag going up
  // while friends on foot stand by it with none of its monsters in the camp.
  stepCamp(world, c, dt, now, people, monsters, want, news) {
    let count = 0;
    for (const m of monsters.list) if (m.camp === c.id) count++;
    while (c.back.length && c.back[0] <= now) {
      c.back.shift();
      if (count < want && this.addGuard(world, c, people, monsters)) count++;
    }
    // A friend came to the island: one more on its way (out of the reserve,
    // on the higher stages, while there is one).
    if (count + c.back.length < want && c.reserve > 0) {
      c.back.push(now + guardBackMs(this.level));
      c.reserve--;
    }
    const holders = people.filter((p) => !p.flying && !p.riding && !p.dizzy && Math.hypot(p.x - c.x, p.z - c.z) <= FLAG_REACH && p.y > c.y - 1.5 && p.y < c.y + 3.5);
    c.holders = holders.length;
    // (A Mimic still shut guards nothing: nobody could tell what was holding the
    // flag down. Still, whoever comes to raise it is near enough to wake it.)
    c.guarded = monsters.list.some((m) => m.camp === c.id && campDistance(c, m.body.x, m.body.z) <= c.r + 0.5 && !(kindOf(m.kind).shut && m.state === 'idle'));
    // From the second stage the monsters pull a flag they hold back down.
    if (c.guarded) c.progress = Math.max(0, c.progress - dt * slideFor(this.level));
    if (!c.holders || c.guarded) return;
    c.progress = Math.min(1, c.progress + dt / raiseSeconds(c.holders, this.level));
    for (const p of holders) this.credit(p.id, 'flag', dt);
    // Half way up, on the higher stages: an ambush, once a camp.
    if (!c.ambushed && c.progress >= AMBUSH_AT) {
      const n = ambushFor(people.length, this.level);
      if (n) {
        c.ambushed = true;
        for (let i = 0; i < n; i++) {
          const m = this.addGuard(world, c, people.filter((p) => campDistance(c, p.x, p.z) <= c.r + 2), monsters);
          // (They come only the once: popped, they stay popped.)
          if (m) m.helper = true;
        }
        news.push({ t: 'ambush', camp: c, count: n });
        return;
      }
    }
    if (c.progress >= 1) news.push(this.free(c, people, monsters));
  }

  // The hazards on the way between the camps (HAZARD, the chapter's own:
  // isle-story.js), now and then on each person out there on foot — not
  // in a safe place, a camp or the lair, nor up on a ride or dizzy: where each
  // comes down, a moment ahead, for the room to show and work out. Returns
  // [{ pid, what, to: [{ x, y, z }], ms, reach, bumps }].
  stepHazards(world, now, people) {
    if (!this.story.hazard || this.level < HAZARD.from || this.won) return [];
    const out = [];
    const havens = this.havens(world);
    for (const p of people) {
      if (p.flying || p.riding || p.dizzy || now < (p.safeUntil ?? 0)) continue;
      const near = this.camps.some((c) => campDistance(c, p.x, p.z) <= c.r + 4) || havens.some((h) => campDistance(h, p.x, p.z) < h.r + 2);
      const due = this.hazardAt.get(p.id);
      if (near || due === undefined) {
        // Not out on the way (or just come out on it): the wait starts again.
        this.hazardAt.set(p.id, now + hazardEvery(this.level) * (0.6 + 0.6 * this.hazardRng.next()));
        continue;
      }
      if (now < due) continue;
      this.hazardAt.set(p.id, now + hazardEvery(this.level) * (0.8 + 0.4 * this.hazardRng.next()));
      const to = [];
      for (let i = 0; i < hazardCount(this.level) * 3 && to.length < hazardCount(this.level); i++) {
        // On them the first time, and round them after.
        const a = this.hazardRng.range(-Math.PI, Math.PI);
        const d = to.length ? this.hazardRng.range(2.5, 4.5) : 0;
        const x = p.x + Math.sin(a) * d;
        const z = p.z + Math.cos(a) * d;
        const y = standHeight(world, x, z, p.y + 2);
        if (y === null || Math.abs(y - p.y) > 3 || havens.some((h) => campDistance(h, x, z) < h.r)) continue;
        to.push({ x, y, z });
      }
      if (to.length) out.push({ pid: p.id, what: this.story.hazard, to, ms: HAZARD.ms, reach: HAZARD.reach, bumps: hazardBumps(this.level) });
    }
    for (const id of [...this.hazardAt.keys()]) if (!people.some((p) => p.id === id)) this.hazardAt.delete(id);
    return out;
  }

  // The way through the island as it is now, its gates as they are. on:
  // everywhere that can be walked to from its start and its freed camps
  // (walkReach). barred: the camps still held that cannot — each behind a
  // gate still shut. past: everywhere one of those can be walked to from
  // (walkBack).
  ways(world) {
    const beside = (c) => STEPS.map(([dx, dz]) => [c.x + dx * 2, c.y, c.z + dz * 2]);
    const { spot } = walker(world);
    const on = walkReach(world, [[world.spawn.x, world.spawn.y, world.spawn.z], ...this.camps.filter((c) => c.freed).flatMap(beside)]);
    const barred = this.camps.filter((c) => !c.freed && !beside(c).some((s) => on[spot(s)] === 1));
    return { on, barred, past: barred.length ? walkBack(world, barred.flatMap(beside)) : new Uint8Array(0) };
  }

  // Whoever has got past a gate that is still shut — by sea, in a boat, over
  // a wall — and been there a moment (SNEAK_MS): from the ground they stand
  // on, or are over (in the middle of a jump, up on what they ride:
  // SNEAK_OVER cells down at most), a camp that is not to be walked to yet
  // can be. Anywhere else — the sea, a roof, a tree, a beach under a cliff
  // with no way up — is nobody's business. Returns their ids, for the room
  // to send back to the nearest safe place.
  stepSneaks(world, now, people) {
    if (this.won || !this.gates.some((g) => !g.open)) {
      if (this.sneakAt.size) this.sneakAt.clear();
      return [];
    }
    this.way ??= this.ways(world);
    const { past } = this.way;
    const out = [];
    const { W, D, H, blocks } = world;
    for (const p of people) {
      const x = FL(p.x);
      const z = FL(p.z);
      let there = false;
      if (!p.flying && !p.dizzy && x >= 0 && z >= 0 && x < W && z < D) {
        const column = (x * D + z) * H;
        let y = Math.max(1, Math.min(H - 1, Math.round(p.y)));
        for (let down = 0; down < SNEAK_OVER && y > 1 && !B.SOLID[blocks[column + y - 1]]; down++) y--;
        there = past[column + y] === 1;
      }
      const since = this.sneakAt.get(p.id);
      if (!there) {
        if (since !== undefined) this.sneakAt.delete(p.id);
      } else if (since === undefined) {
        this.sneakAt.set(p.id, now);
      } else if (now - since >= SNEAK_MS) {
        this.sneakAt.delete(p.id);
        out.push(p.id);
      }
    }
    for (const id of [...this.sneakAt.keys()]) if (!people.some((p) => p.id === id)) this.sneakAt.delete(id);
    return out;
  }

  // The camp is free: its monsters go, and whoever was there helped. With
  // that the last camp, the boss's bubble pops (and on a map without a
  // lair, that is the stage won).
  free(c, people, monsters) {
    const shielded = this.shielded;
    Object.assign(c, { freed: true, progress: 1, awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    // (A safe place more, from where the way on is walked: stepSneaks.)
    this.way = null;
    const gone = [];
    for (const m of [...monsters.list]) if (m.camp === c.id) gone.push(monsters.remove(m.id));
    const by = people.filter((p) => campDistance(c, p.x, p.z) <= c.r + 12).map((p) => p.id);
    const won = !this.castle && this.camps.every((o) => o.freed);
    if (won) this.won = true;
    return { t: 'freed', camp: c, by, gone, shieldDown: shielded && !this.shielded, won, gates: this.openGates(c.id) };
  }

  // The castle's yard: in its bubble the boss is no trouble; out of it, it
  // calls two of its minions (bosses.js) to help it when it is down to two
  // thirds of its hearts, and two more at a third, getting crosser each time
  // (rage: its moves come sooner, more of them, and it gets about quicker);
  // and left alone a while, it gets its hearts back one by one.
  stepCastle(world, c, now, monsters) {
    const k = this.king;
    let king = monsters.get(k.id);
    // Gone by himself (into water someone poured in): back in his yard, as he was.
    if (!king) {
      const at = this.kingSpot(world, c);
      king = monsters.add(world, at.x, at.y, at.z, { camp: c.id, kind: this.boss, plan: this.plan });
      k.id = king.id;
    }
    king.passive = this.shielded;
    if (king.passive) return;
    if (k.hearts < k.max && now - Math.max(k.hitAt, k.healAt) >= (k.healAt > k.hitAt ? KING_HEAL_EVERY : KING_HEAL_MS)) {
      k.hearts++;
      k.healAt = now;
    }
    const due = k.second ? 2 : k.hearts <= k.max / 3 ? 2 : k.hearts <= (k.max * 2) / 3 ? 1 : 0;
    king.rage = due;
    king.second = Boolean(k.second);
    while (k.minions < due) {
      k.minions++;
      for (const side of [-1, 1]) {
        const a = king.yaw + side * 1.2;
        const x = king.body.x + Math.sin(a) * 2.2;
        const z = king.body.z + Math.cos(a) * 2.2;
        const y = standHeight(world, x, z, king.body.y + 1) ?? king.body.y;
        monsters.add(world, x, y, z, { camp: c.id, kind: this.plan.minion ?? 'blob' });
      }
    }
  }

  // The gates freeing camp `id` opens (all still shut, with none): opened
  // now, for the room to open on the island.
  openGates(id = 0) {
    const out = this.gates.filter((g) => !g.open && (!id || g.camp === id));
    for (const g of out) g.open = true;
    // (The way on is longer now: worked out again when next wanted.)
    if (out.length) this.way = null;
    return out;
  }

  // The Monster Gashapon, now and then: with someone on the island it turns
  // up a while later (MONSTER_GASHA.first) near one of them, stays a while and goes,
  // and turns up again later somewhere else (MONSTER_GASHA.again).
  // With nobody about, the wait starts again when someone comes. Returns
  // what happened, for the room to make happen and tell everyone:
  //   { t: 'gasha', x, y, z, id } it turned up (id: the block, turned to
  //   face whoever it turned up for), { t: 'gasha-gone', x, y, z } it went.
  stepGasha(world, now, people) {
    const g = this.gasha;
    const range = ([lo, hi]) => this.gashaRng.range(lo, hi);
    if (g) {
      if (now < g.until && isMonsterGashapon(world.get(g.x, g.y, g.z))) return [];
      this.gasha = null;
      this.gashaNext = now + range(MONSTER_GASHA.again);
      return [{ t: 'gasha-gone', x: g.x, y: g.y, z: g.z }];
    }
    if (!people.length) {
      this.gashaNext = 0;
      return [];
    }
    if (!this.gashaNext) this.gashaNext = now + range(MONSTER_GASHA.first);
    if (now < this.gashaNext) return [];
    const spot = this.gashaSpot(world, people);
    if (!spot) {
      this.gashaNext = now + 10000;
      return [];
    }
    this.gasha = { x: spot.x, y: spot.y, z: spot.z, until: now + MONSTER_GASHA.stay };
    return [{ t: 'gasha', ...spot }];
  }

  // Where the Monster Gashapon turns up: a little way off from one of the
  // people on the island, on open ground (not in the water, in a camp still
  // to free, or right beside anyone), facing them. Null when no spot will do.
  gashaSpot(world, people) {
    const rng = this.gashaRng;
    for (let tries = 0; tries < 40; tries++) {
      const p = people[Math.floor(rng.next() * people.length)];
      const a = rng.range(-Math.PI, Math.PI);
      const d = rng.range(...MONSTER_GASHA.near);
      const x = FL(p.x + Math.cos(a) * d);
      const z = FL(p.z + Math.sin(a) * d);
      const y = standHeight(world, x + 0.5, z + 0.5, p.y + 3);
      if (y === null || Math.abs(y - p.y) > 4) continue;
      const under = world.get(x, y - 1, z);
      if (!B.SOLID[under] || B.TREE_PART[under] || B.CLOTH[under] || B.KIND[under] === B.K_FURNITURE) continue;
      if (world.get(x, y, z) !== B.AIR || world.get(x, y + 1, z) !== B.AIR) continue;
      if (this.camps.some((c) => !c.freed && campDistance(c, x + 0.5, z + 0.5) <= c.r + 2)) continue;
      if (people.some((q) => Math.hypot(q.x - x - 0.5, q.z - z - 0.5) < 3)) continue;
      const dx = p.x - x - 0.5;
      const dz = p.z - z - 0.5;
      const front = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 2) : dz > 0 ? 1 : 3;
      return { x, y, z, id: B.turnedTo(B.MONSTER_GASHAPON, front) };
    }
    return null;
  }

  // One of a camp's monsters popped (or gone by itself): back it comes in a
  // while, while the camp is not free. The boss's helpers and the Queen
  // Mosquito do not: popping her is that camp's own little victory. Nor does its
  // champion, nor a beast's helpers. Nor do Gummy Cubs: a Gummy Bear split into
  // them, and it comes back whole.
  guardGone(m, now) {
    // (Toon Isle's battles keep count of their own: isle-battles.js.)
    if (this.battles) return;
    const c = this.campById(m.camp);
    if (!c || c.freed || !c.awake || c.kind !== 'camp' || isBoss(m.kind) || m.kind === 'queen' || m.kind === 'cub' || m.champion || m.helper) return;
    // (On the higher stages, only while its reserve lasts.)
    if (c.reserve <= 0) return;
    c.reserve--;
    c.back.push(now + guardBackMs(this.level));
  }

  // A friend bopping the lair's boss (the chapter's: bosses.js): nothing
  // gets through its bubble, each friend can bop it once a moment, and while
  // it sits dazed a bop takes DAZED_HIT hearts; times: how many times over a
  // bop counts (a Star Hammer's, see shop.js). Returns { shielded },
  // { wait }, or { hit, hearts, max, beaten, dazed }.
  hitKing(pid, now, dazed = false, times = 1) {
    // (Baron Bluster, at the end of Toon Isle: isle-battles.js hitBoss.)
    if (this.battles) {
      const hit = this.battles.hitBoss(pid, now, dazed, times);
      if (hit.hit) Object.assign(this.king, { hearts: hit.hearts, max: hit.max, hitAt: now });
      return hit;
    }
    if (this.shielded) return { shielded: true };
    const k = this.king;
    if (!k.id || k.hearts <= 0) return { wait: true };
    if (now - (k.hits.get(pid) ?? -Infinity) < KING_HIT_MS) return { wait: true };
    k.hits.set(pid, now);
    k.hearts = Math.max(0, k.hearts - (dazed ? DAZED_HIT : 1) * times);
    k.hitAt = now;
    // King Grumble, at the very end of the story, is not done the first time:
    // he puffs himself up bigger and grumpier, with more than half his hearts
    // back (SECOND_WIND), as cross as he ever gets.
    if (k.hearts <= 0 && this.story.final && !k.second) {
      k.second = true;
      k.hearts = Math.round(k.max * SECOND_WIND);
      return { hit: true, hearts: k.hearts, max: k.max, beaten: false, dazed, second: true };
    }
    return { hit: true, hearts: k.hearts, max: k.max, beaten: k.hearts <= 0, dazed };
  }

  // The lair's boss popped: the whole stage is won. Every monster of every
  // camp goes; returns them.
  win(monsters) {
    this.won = true;
    for (const c of this.camps) Object.assign(c, { freed: true, progress: 1, awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    for (const q of this.quests?.list ?? []) q.done = true;
    for (const b of this.battles?.list ?? []) Object.assign(b, { done: true, state: 'done' });
    for (const n of this.dream?.all ?? []) Object.assign(n, { done: true, state: 'done' });
    this.king = noKing();
    const gone = [];
    for (const m of [...monsters.list]) if (m.camp) gone.push(monsters.remove(m.id));
    return gone;
  }

  // What everyone needs to know as they arrive.
  describe() {
    return {
      camps: this.camps.map((c) => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed: c.freed, progress: +c.progress.toFixed(3) })),
      won: this.won,
      stage: this.stage,
      journey: this.journey,
      // Which of the isle's games it is (server/adventure.js), when it is one.
      ...(this.run ? { run: this.run } : {}),
      final: this.story.final,
      // A chapter told in challenges: each, where it is and its parts, and
      // the bell's cage with a lock for each.
      ...(this.quests ? { quests: this.quests.describe(), hub: this.hub ? { bell: this.hub.bell, locks: this.hub.locks } : null } : {}),
      // A chapter told in battles: each, where it is and its parts, its Sky
      // Lantern with a lamp for each, and the clouds rolled back so far.
      // A chapter told in nightmares: which dream, and how each is going.
      ...(this.dream ? { nod: this.dream.describe() } : {}),
      ...(this.battles ? { battles: this.battles.describe(), hub: this.hub ? { lantern: this.hub.lantern, lamps: this.hub.lamps } : null, fog: { tile: FOG_TILE, w: this.battles.fog.w, h: this.battles.fog.h, seen: this.battles.fog.pack() } } : {}),
      ...this.pack(),
    };
  }

  // What changes as it goes, a few times a second: how far up each flag is
  // that has been started on or is being guarded ([id, percent, friends by
  // it, guarded]), and the boss's hearts while it is about.
  pack() {
    return {
      c: this.camps.filter((c) => !c.freed && (c.awake || c.progress > 0)).map((c) => [c.id, Math.floor(c.progress * 100), c.holders, c.guarded ? 1 : 0]),
      k: this.dream ? this.dream.kingPack() : this.king.id ? [this.king.hearts, this.king.max, ...(this.king.second ? [1] : [])] : null,
      shield: this.shielded,
      // (And how each challenge is going: isle-quests.js pack; or each battle.)
      ...(this.quests ? { q: this.quests.pack() } : {}),
      ...(this.battles ? { b: this.battles.pack(this.now) } : {}),
      ...(this.dream ? { n: this.dream.pack() } : {}),
    };
  }

}

// ------------------------------------------------ who did what for a stage

// What counts towards a stage won, and how many points each is worth:
// a monster popped, a bop on the boss, a second spent raising a flag,
// a friend helped up, and a point of play at Jinx's challenges (each thing
// done there counted in points already: isle-quests.js PLAY).
export const DEEDS = { pops: 2, boss: 3, flag: 1, helps: 5, play: 1 };
// What a stage won pays each person on it, by their points: a few coins for
// being there, a coin for every RESULT_COINS_PER points more (up to
// RESULT_COINS_MAX), a diamond for anyone who did something for it, and
// another for whoever did the most.
export const RESULT_COINS_BASE = 5;
export const RESULT_COINS_PER = 4;
export const RESULT_COINS_MAX = 150;
// The most rows a stage's results list.
export const RESULT_ROWS = 32;

// A stage's results: everyone on the island (people: [{ id, name }]), and
// whoever did something for it and has left since (gone: [{ id, name }]),
// each with what they did (deeds, by id: Adventure.deeds), their points,
// their place (1 the most; the same points, the same place) and what it
// pays them; most points first. Only those on the island are paid.
export function stageResults(deeds, people, gone = []) {
  const row = (p, here) => {
    const d = deeds.get(p.id) ?? { pops: 0, boss: 0, flag: 0, helps: 0, play: 0 };
    const flag = Math.round(d.flag);
    const play = d.play ?? 0;
    const score = d.pops * DEEDS.pops + d.boss * DEEDS.boss + flag * DEEDS.flag + d.helps * DEEDS.helps + play * DEEDS.play;
    return { id: p.id, name: String(p.name ?? '').slice(0, 40), here, pops: d.pops, boss: d.boss, flag, helps: d.helps, ...(play ? { play } : {}), score, place: 0, coins: 0, gems: 0 };
  };
  const seen = new Set(people.map((p) => p.id));
  const rows = [...people.map((p) => row(p, true)), ...gone.filter((p) => !seen.has(p.id) && deeds.has(p.id)).map((p) => row(p, false)).filter((r) => r.score > 0)];
  rows.sort((a, b) => b.score - a.score || Number(b.here) - Number(a.here));
  for (const [i, r] of rows.entries()) {
    r.place = i && r.score === rows[i - 1].score ? rows[i - 1].place : i + 1;
    if (!r.here) continue;
    r.coins = RESULT_COINS_BASE + Math.min(RESULT_COINS_MAX - RESULT_COINS_BASE, Math.floor(r.score / RESULT_COINS_PER));
    r.gems = r.score > 0 ? (r.place === 1 ? 2 : 1) : 0;
  }
  return rows.slice(0, RESULT_ROWS);
}

// An island made with ⚔️ Adventure on, back when any island could have
// monster camps (Adventure Isle is the only adventure now): an island like
// any other once it is opened again. Its fences and its castle stay where
// they stand, but the gloomy ground of every camp is the island's own again,
// with flowers (pal: its ground, worldgen.js palette), and a Monster
// Gashapon it had then goes. raw: the adventure as the save kept it. Returns
// its camps, checked ({ x, z, r } each), for whatever comes to the island
// later to keep clear of; [] for none.
export function retireCamps(raw, world, pal, rng) {
  if (!raw || !Array.isArray(raw.camps)) return [];
  const camps = [];
  for (const c of raw.camps.slice(0, 32)) {
    if (c?.kind !== 'camp' && c?.kind !== 'castle') continue;
    if (![c.x, c.y, c.z, c.r].every(Number.isFinite)) continue;
    if (c.x < 0 || c.z < 0 || c.x > world.W || c.z > world.D || c.y < 1 || c.y > world.H || c.r < 2 || c.r > 20) continue;
    camps.push({ x: c.x, z: c.z, r: c.r });
    const cells = freeCells(world, c, pal, rng);
    for (let i = 0; i < cells.length; i += 4) world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
  }
  if (Array.isArray(raw.gasha) && raw.gasha.length === 3 && raw.gasha.every(Number.isInteger)) {
    const [x, y, z] = raw.gasha;
    if (world.inBounds(x, y, z) && isMonsterGashapon(world.get(x, y, z))) world.set(x, y, z, B.AIR);
  }
  return camps;
}
