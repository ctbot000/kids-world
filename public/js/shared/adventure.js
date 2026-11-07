// Adventure islands: grumpy monsters have taken over parts of the island.
// Each of their camps is gloomy ground behind a fence of logs, with their
// flag in the middle, and King Grumble sits in his castle, safe in a magic
// bubble. Friends free the island together:
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
// - With every camp free, King Grumble's bubble pops. Big and slow, he
//   stomps the ground (jump, and it misses you), and sits dazed after,
//   when a bop counts three times. He calls little monsters to help him,
//   and the fewer hearts he has, the quicker he is and the more often he
//   stomps. Left alone, he gets hearts back. Each friend can bop him about
//   once a second, so the more of you there are, the sooner he goes pop,
//   and the whole island is free.
// - Out of HP with a friend on the island, you sit dizzy for a while,
//   until a friend comes and taps you to help you up (or you go back to the
//   nearest safe place).
//
// The island is made with its camps (buildCamps, from worldgen.js), and the
// host runs the rest (AdventureSim, from room.js), as it runs the monsters.
// The dedicated server also keeps one public adventure island for everyone,
// conquered stage by stage, each harder than the last (server/adventure.js);
// a stage number scales everything below that says so.
import { BEASTS, beastsOfTier, isBeast } from './beasts.js';
import * as B from './blocks.js';
import { CRITTER_INFO, standHeight } from './critters.js';
import { BOSSES, breathMove, isBoss, planOf } from './bosses.js';
import { bodyOf, BUMP_HP, campDistance, DAZED_HIT, GHOST_FIRE, kindOf, SAFE_RADIUS } from './monsters.js';
import { bodyOverlapsSolid, MOVE } from './physics.js';
import { MONSTER_LOG } from './stickers.js';
import { isMonsterGashapon, MONSTER_GASHA } from './gashapon.js';
import { hash2, Rng } from './rng.js';
import { Chests } from './treasure.js';
import { chapterOf } from './isle-story.js';

// A camp's fence goes round this far from its flag; King Grumble's castle
// is a square this far from its middle to its walls.
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
// King Grumble's hearts, more with more friends on the island; each friend
// can bop him once in this long. Nobody bopping him for KING_HEAL_MS, he
// gets a heart back, and another every KING_HEAL_EVERY after.
export const kingHearts = (players, stage = 1) => stageKing(12 + 6 * Math.min(8, Math.max(1, players)), stage);
// A boss's (bosses.js), which has as many again as its hearts say.
export const bossHearts = (plan, players, stage = 1) => Math.round(kingHearts(players, stage) * (plan?.hearts ?? 1));
export const KING_HIT_MS = 800;
export const KING_HEAL_MS = 8000;
const KING_HEAL_EVERY = 2000;
// Out of HP with a friend about: dizzy this long, unless a friend this
// near taps you, which gets you up with this share of your HP.
export const DIZZY_MS = 10000;
export const HELP_REACH = 4;
export const HELP_SHARE = 0.6;
export const helpHp = (max) => Math.round(max * HELP_SHARE);

// The public adventure island the dedicated server keeps for everyone
// (server/adventure.js) is conquered stage by stage, each stage a little
// harder, on and on without end. Stage 1 plays as any adventure island;
// every stage after has more camps (up to four more), one more guard in
// each of them every third stage (up to eight), King Grumble with a fifth
// more hearts each stage (up to four times as many), and flags that take a
// tenth longer to raise each stage (up to twice as long). Past those the
// stages go on as hard as they ever get, so none is ever hopeless.
export const STAGE_CAMPS = 4;
// And on the stages after the first, tougher monsters among each camp's
// guards (monsters.js), more of them and tougher the higher the stage: a
// Spiky from stage 2, a Grumble Knight from 3, a Big Bruiser from 4, a
// Stone Golem from 5, then another Knight at 7, another Golem at 9 and a
// Giant Spider at 11; and from the second time round the story, the beasts
// (beasts.js): a Shadow Wolf at 13, a Stingtail at 15, Rattlebones at 17, a
// Thunderhawk at 19 and a Mimic at 21. They take the place of blobs, so a camp
// keeps as many guards as before (and its mosquito); with fewer guards than
// that, the toughest go first.
export const STAGE_TOUGH = [
  [2, 'spiky'],
  [3, 'knight'],
  [4, 'big'],
  [5, 'golem'],
  [7, 'knight'],
  [9, 'golem'],
  [11, 'spider'],
  [13, 'wolf'],
  [15, 'stinger'],
  [17, 'rattle'],
  [19, 'hawk'],
  [21, 'mimic'],
];
// The kinds among a camp's guards at a stage, toughest first.
export const toughGuards = (stage) => {
  const s = cleanStage(stage);
  const rank = { golem: 0, stinger: 1, wolf: 2, hawk: 3, mimic: 4, rattle: 5, knight: 6, big: 7, spider: 8, spiky: 9 };
  return STAGE_TOUGH.filter(([from]) => s >= from)
    .map(([, kind]) => kind)
    .sort((a, b) => rank[a] - rank[b]);
};
export const STAGE_GUARDS = 8;
export const STAGE_KING = 4;
export const STAGE_RAISE = 2;
// How long after a stage of the public adventure island is conquered the
// page takes everyone there on to the next one by itself (ui.js) — the
// fireworks first, and never while a window (a quiz, say) is open.
export const NEXT_STAGE_SECONDS = 15;

// A stage as told: 1 when it is none or nonsense, and never past 9999.
export const cleanStage = (stage) => (Number.isInteger(stage) && stage >= 1 ? Math.min(stage, 9999) : 1);
export const stageCamps = (base, stage) => base + Math.min(STAGE_CAMPS, Math.floor((cleanStage(stage) - 1) / 2));
export const stageGuards = (base, stage) => Math.min(STAGE_GUARDS, base + Math.floor((cleanStage(stage) - 1) / 3));
export const stageKing = (base, stage) => Math.round(base * Math.min(STAGE_KING, 1 + (cleanStage(stage) - 1) / 5));
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
  golem: { icon: '🗿', name: 'Stone Golem' },
  queen: { icon: '👑', name: 'Queen Mosquito' },
  snapper: { icon: '🦀', name: 'Snappy Crab' },
  shroom: { icon: '🍄', name: 'Puffshroom' },
  yeti: { icon: '❄️', name: 'Little Yeti' },
  gummy: { icon: '🧸', name: 'Gummy Bear' },
  cub: { icon: '🍬', name: 'Gummy Cub' },
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
// friend on stage 1, as it is on the isle: more friends, and higher stages,
// give it more.
export function monsterStats(kind) {
  const pct = (run) => Math.round((100 * run) / MOVE.run);
  if (isBoss(kind)) {
    const plan = planOf(kind, true);
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

// How many camps an island gets: three on a cozy one, more on a bigger one,
// and more again on the higher stages of the public adventure island.
export function campCount(world, stage = 1) {
  return stageCamps(Math.max(1, Math.round(4 * Math.sqrt((world.W * world.D) / (128 * 128)) - 1)), stage);
}

// ---------------------------------------------------------------- making them

// What is not the ground: trees (candy trees have trunks of white bricks).
const TREE = new Uint8Array(B.BLOCK_IDS);
for (const id of [B.WOOD, B.LEAVES, B.PINE_LEAVES, B.KATSURA_WOOD, B.KATSURA_LEAVES, B.KATSURA_TREE, B.KATSURA_GIANT, B.TREE_CORE, B.SNOWY_LEAVES, B.COTTON_CANDY, B.TOY_BRICKS[11]]) TREE[id] = 1;

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

// The ground round (cx, cz), reach out (in a square, or a circle): how high
// it lies (its middle height, never below just over the sea), how uneven it
// is and how much of it the sea covers; null where it does not fit, or a
// pond is in the way.
function survey(map, world, cx, cz, reach, square) {
  const { W, D } = world;
  if (cx - reach < 2 || cz - reach < 2 || cx + reach > W - 3 || cz + reach > D - 3) return null;
  const heights = [];
  let n = 0;
  let wet = 0;
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      if (!square && dx * dx + dz * dz > reach * reach) continue;
      const k = (cx + dx) * D + cz + dz;
      n++;
      if (map.wet[k] === 2) return null;
      if (map.wet[k]) wet++;
      else heights.push(map.ground[k]);
    }
  }
  if (heights.length < n * 0.6) return null;
  heights.sort((a, b) => a - b);
  const at = (q) => heights[Math.floor(q * (heights.length - 1))];
  return { level: Math.max(world.sea + 2, at(0.5)), spread: at(0.95) - at(0.05), wet: wet / n };
}

// Looser and looser, until there is a spot: flat dry land first.
const PASSES = [
  { spread: 3, wet: 0 },
  { spread: 6, wet: 0.03 },
  { spread: 10, wet: 0.15 },
  { spread: 18, wet: 0.35 },
];

// The best spot for a camp of radius r (a square castle, or a round camp):
// on ground flat enough to build on, away from the start, the other camps,
// the ways into the mines and the vehicles. far: as far from the start as it
// can be (the castle); otherwise as far as it can be from the start and the
// camps already there, so they spread out over the island.
function choose(world, map, rng, { r, square, far, taken, mines, vehicles }) {
  const reach = r + 3;
  const bound = square ? reach * Math.SQRT2 : reach;
  const spawn = world.spawn;
  const lo = reach + 3;
  for (const pass of PASSES) {
    let best = null;
    for (let tries = 0; tries < 500; tries++) {
      const cx = rng.int(lo, world.W - 1 - lo);
      const cz = rng.int(lo, world.D - 1 - lo);
      const x = cx + 0.5;
      const z = cz + 0.5;
      const start = Math.hypot(x - spawn.x, z - spawn.z) - bound;
      if (start < (far ? 10 : 12)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.bound + bound + 6)) continue;
      if (mines.some((m) => Math.hypot(m.x - cx, m.z - cz) < bound + 8 || m.way.some((w) => Math.hypot(w.x - cx, w.z - cz) < bound + 4))) continue;
      if (vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < bound + 2)) continue;
      const s = survey(map, world, cx, cz, reach, square);
      if (!s || s.spread > pass.spread || s.wet > pass.wet) continue;
      const room = far ? start : Math.min(start, ...taken.map((t) => Math.hypot(t.x - x, t.z - z) - t.bound));
      const score = room - s.spread * 2 - s.wet * 20 + rng.next();
      if (!best || score > best.score) best = { cx, cz, x, z, level: s.level, bound, r, square, score };
    }
    if (best) return best;
  }
  return null;
}

// Levels the ground round a camp at its height, out to just past its fence,
// sloping back to the land as it was a little further out (where the sea
// is, it stays), and lays the gloomy ground: all of the camp, and some
// round it, ragged at the edge. Nothing stays standing on it, and no jewel
// shows in it.
// sheer (Adventure Isle's maps): round its edge, land much higher or lower
// than the camp is left as it is — a cliff stays a cliff — rather than eased
// into a slope (one that would be a way up it).
export function flatten(world, map, pal, spot, sheer = false) {
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
      if (sheer && t > 0 && Math.abs(g - level) >= 3) continue;
      const target = wet ? level : Math.round(level + (g - level) * t * t * (3 - 2 * t));
      for (let y = target + 1; y < H; y++) if (world.get(x, y, z) !== B.AIR) world.set(x, y, z, B.AIR);
      if (target > g) for (let y = g + 1; y <= target; y++) world.set(x, y, z, y === target ? pal.top : pal.under);
      else if (target < g || d <= r + 1) world.set(x, target, z, pal.top);
      for (let y = target - 2; y < target; y++) if (B.GEM_ROCK[world.get(x, y, z)]) world.set(x, y, z, pal.under);
      if (d <= r + 0.6 + hash2(world.seed + 97, x, z) * 2.2) world.set(x, target, z, B.GLOOM);
    }
  }
}

// A camp's fence: logs round it, every other one a little taller, with two
// ways in (one facing the start, one behind), each with a lamp on a post at
// either side; a little stone floor for the flag in the middle, and hay
// bales for the monsters to sleep on. gate: the way in facing the start (the
// other is behind), or the angle of every way in; style: what the fence is
// made of, its posts, lamps, floor and beds (Adventure Isle's camps are
// each made of what their corner of the isle has, isle-maps.js).
export function campFence(world, rng, spot, gate, style = {}) {
  const { post = B.WOOD, lamp = B.LAMP, floor = B.PEBBLES, bed = B.HAY } = style;
  const { cx, cz, r } = spot;
  const y0 = spot.level + 1;
  const half = 1.6 / r;
  const ways = Array.isArray(gate) ? gate : [gate, gate + Math.PI];
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

// King Grumble's castle: stone walls five high with battlements and a purple
// stripe, a tower at each corner with a lamp on top, lamps in the middle of
// the walls, and a way in, three wide and four high, in the wall facing the
// start; the stone floor for his flag in the middle of the yard. style:
// what it is made of (Adventure Isle's lairs, isle-maps.js): its walls, the
// stripe along them, its towers, lamps and floor.
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

// Builds an adventure island's camps and King Grumble's castle on a newly
// made island (last, from randomness of their own, so the rest of it comes
// out as it would without). pal: the island's ground (worldgen.js palette);
// trees: as worldgen.js grew them, to take down those in the way; critters:
// the animals and vehicles, to keep out of the camps; mines: their ways in,
// to keep clear; stage: the public adventure island's stage, for how many
// camps it gets. Returns { camps, critters }: each camp as
// { id, kind: 'camp' or 'castle', x, y, z, r }, numbered from the one
// nearest the start, with the castle last; (x, y, z) is where its flag
// stands, on the ground in the middle; and the critters left.
export function buildCamps(world, rng, { pal, trees = [], critters = [], mines = [], stage = 1 }) {
  const map = groundMap(world);
  const vehicles = critters.filter((c) => CRITTER_INFO[c.type]?.vehicle);
  const spots = [];
  const castle = choose(world, map, rng, { r: CASTLE_RADIUS, square: true, far: true, taken: spots, mines, vehicles });
  if (castle) spots.push({ ...castle, kind: 'castle' });
  for (let i = 0; i < campCount(world, stage); i++) {
    const camp = choose(world, map, rng, { r: CAMP_RADIUS, square: false, far: false, taken: spots, mines, vehicles });
    if (!camp) break;
    spots.push({ ...camp, kind: 'camp' });
  }
  // The trees in the way come down.
  for (const t of trees) {
    if (!t.cells || !spots.some((s) => Math.hypot(t.x + 0.5 - s.x, t.z + 0.5 - s.z) < s.bound + 4)) continue;
    for (const [x, y, z, id] of t.cells) if (world.get(x, y, z) === id) world.set(x, y, z, B.AIR);
  }
  const spawn = world.spawn;
  for (const s of spots) {
    flatten(world, map, pal, s);
    const toStart = Math.atan2(spawn.z - s.z, spawn.x - s.x);
    if (s.kind === 'castle') {
      const dx = spawn.x - s.x;
      const dz = spawn.z - s.z;
      castleWalls(world, s, Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1]);
    } else {
      campFence(world, rng, s, toStart);
    }
  }
  const near = (s) => Math.hypot(s.x - spawn.x, s.z - spawn.z);
  const ordered = [...spots.filter((s) => s.kind === 'camp').sort((a, b) => near(a) - near(b)), ...spots.filter((s) => s.kind === 'castle')];
  const camps = ordered.map((s, i) => ({ id: i + 1, kind: s.kind, x: s.x, y: s.level + 1, z: s.z, r: s.r }));
  // No animal lives in a monsters' camp (the vehicles were kept clear of them).
  const left = critters.filter((c) => CRITTER_INFO[c.type]?.vehicle || !spots.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < s.bound + 1));
  return { camps, critters: left };
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

// ---------------------------------------------------------------- playing them

const noKing = () => ({ id: 0, hearts: 0, max: 0, minions: 0, hits: new Map(), hitAt: 0, healAt: 0 });

export class AdventureSim {
  // camps: as buildCamps makes them (and saves keep them), with whether
  // each is free; won: the castle's boss popped, and the whole island free;
  // stage: the public adventure island's, for how hard its monsters are;
  // story: whether this is that island, a chapter of its story with a map
  // of its own (isle-maps.js), whose monsters the chapter has (its guards,
  // and the helpers King Grumble calls), and gates: the gates shut across
  // its way, each { camp, x, y, z, cells } — freeing that camp opens it
  // (cells, an edit, are what it becomes); chestSpots: where its treasure
  // chests may turn up, beside its way (treasure.js).
  constructor({ camps = [], won = false, stage = 1, story = false, gates = [], chestSpots = null } = {}, seed = 1) {
    this.rng = new Rng(seed);
    this.stage = cleanStage(stage);
    this.story = story ? chapterOf(this.stage) : null;
    // Who holds the castle (bosses.js): the chapter's boss on the isle,
    // King Grumble with his stomp alone anywhere else.
    this.boss = this.story?.boss ?? 'king';
    this.plan = planOf(this.boss, Boolean(this.story));
    this.gates = gates.map((g) => ({ ...g, open: Boolean(won) }));
    this.camps = camps.map((c) => {
      const freed = Boolean(c.freed) || Boolean(won);
      return { id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed, progress: freed ? 1 : 0, awake: false, quiet: 0, back: [], holders: 0, guarded: false, queen: false };
    });
    // The deepest camp — the one furthest from the start — wakes the Queen
    // Mosquito with its own monsters, as a tougher extra guard.
    const deepest = this.camps.filter((c) => c.kind === 'camp').pop();
    if (deepest) deepest.queen = true;
    this.won = Boolean(won) || (this.camps.length > 0 && this.camps.every((c) => c.freed));
    this.king = noKing();
    // The Monster Gashapon (stepGasha): where it is ({ x, y, z, until }) or
    // null, when it turns up next (0: not yet counting), and randomness of
    // its own, so the rest goes just as it did before there was one.
    this.gasha = null;
    this.gashaNext = 0;
    this.gashaRng = new Rng((seed ^ 0x9e3779b9) >>> 0);
    // The treasure chests (treasure.js), on the shared isle only, with
    // randomness of their own too.
    this.chests = new Chests((seed ^ 0x85ebca6b) >>> 0, chestSpots);
  }

  // The treasure chests, now and then (the room asks only on the shared
  // isle): the cells that changed, [x, y, z, id] each.
  stepChests(world, now) {
    return this.chests.step(world, now, { stage: this.stage, camps: this.camps });
  }

  // Whether there is anything left to free.
  get active() {
    return !this.won && this.camps.length > 0;
  }

  get castle() {
    return this.camps.find((c) => c.kind === 'castle') ?? null;
  }

  // King Grumble is in his bubble while any camp is not free.
  get shielded() {
    return this.camps.some((c) => c.kind === 'camp' && !c.freed);
  }

  campById(id) {
    return this.camps.find((c) => c.id === id) ?? null;
  }

  // How the adventure is going, for the list of open islands.
  tally() {
    const camps = this.camps.filter((c) => c.kind === 'camp');
    return { camps: camps.length, freed: camps.filter((c) => c.freed).length, won: this.won, stage: this.stage };
  }

  // The safe places no monster goes into: the island's start, and every
  // camp freed (the castle too, once the island is).
  havens(world) {
    const out = [{ x: world.spawn.x, z: world.spawn.z, r: SAFE_RADIUS }];
    for (const c of this.camps) if (c.freed) out.push({ x: c.x, z: c.z, r: c.r + 0.5, kind: c.kind });
    return out;
  }

  // Where someone out of hearts at (x, z) comes back: the nearest safe
  // place, beside its flag (or the island's start).
  homeFor(world, x, z) {
    let best = { x: world.spawn.x, y: world.spawn.y, z: world.spawn.z };
    let far = Math.hypot(x - best.x, z - best.z);
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
  // back, flags going up, King Grumble's helpers. people: as for the
  // monsters (MonsterSim.step); players: how many are on the island. Returns
  // what happened, for the room to make happen and tell everyone:
  //   { t: 'freed', camp, by, gone, shieldDown, won }
  step(world, dt, now, people, monsters, players) {
    const news = [];
    if (!this.active) return news;
    const want = guardsFor(players, this.stage);
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

  // Someone came near: out come its monsters (or the castle's boss — King
  // Grumble, or on the isle the chapter's, bosses.js — with its hearts for
  // as many friends as are on the island now). The deepest camp
  // wakes the Queen Mosquito too, as a tougher extra guard.
  wake(world, c, people, monsters, players) {
    c.awake = true;
    c.back = [];
    if (c.kind === 'castle') {
      const at = this.kingSpot(world, c);
      const m = monsters.add(world, at.x, at.y, at.z, { camp: c.id, kind: this.boss, plan: this.plan });
      m.passive = this.shielded;
      const hearts = bossHearts(this.plan, players, this.stage);
      this.king = { ...noKing(), id: m.id, hearts, max: hearts };
      return;
    }
    for (let i = 0; i < guardsFor(players, this.stage); i++) this.addGuard(world, c, people, monsters);
    if (c.queen) this.addQueen(world, c, people, monsters);
    this.addChampion(world, c, people, monsters, players);
  }

  // Nobody near for a while: its monsters go back in, and come out afresh
  // next time (King Grumble with all his hearts again). How far a flag got
  // stays.
  sleep(c, monsters) {
    Object.assign(c, { awake: false, quiet: 0, back: [], holders: 0, guarded: false });
    for (const m of [...monsters.list]) if (m.camp === c.id) monsters.remove(m.id);
    if (c.kind === 'castle') this.king = noKing();
  }

  // King Grumble's place in his yard: beside his flag, on the far side from the start.
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

  // The beast (beasts.js) that is a camp's champion, or null. On Adventure Isle
  // each chapter has its own, from its second camp on (from its first, the
  // second time round the story). On any other adventure island the camps after
  // the first have one of the first tier, by the island's luck. Where the Queen
  // Mosquito is enough for anyone, the deepest camp of an island of your own and
  // of the isle's very first stage, there is none.
  championOf(world, c) {
    const camps = this.camps.filter((o) => o.kind === 'camp');
    const i = camps.indexOf(c);
    if (i < 0) return null;
    if (this.story) {
      if (this.stage === 1 && c.queen) return null;
      const own = this.story.champions ?? [];
      return (this.story.round > 1 ? own[Math.min(i, own.length - 1)] : own[i - 1]) ?? null;
    }
    if (i === 0 || c.queen) return null;
    const list = beastsOfTier(1);
    return list[Math.floor(hash2(world.seed + 131, c.id, 7) * list.length)];
  }

  // A camp's champion out as the camp wakes, an extra guard as the Queen Mosquito
  // is (and popped, it is gone for good until the camp next sleeps): in the camp,
  // on ground it fits, a Mimic not far from the flag, where whoever comes to raise
  // it will find it. Young on the isle's first stages, full grown from the sixth,
  // and tougher with more friends on the island, so the way never closes on anyone
  // by themselves, and a gang does not walk through it.
  addChampion(world, c, people, monsters, players = 1) {
    const kind = this.championOf(world, c);
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
      const grown = this.story ? Math.min(1, 0.4 + 0.1 * this.stage) : 0.6;
      m.hearts = Math.max(3, Math.round(kindOf(kind).hearts * grown * (1 + 0.3 * (Math.min(8, Math.max(1, players)) - 1))));
      m.max = m.hearts;
    }
    return m;
  }

  // Which kind a camp needs next: its mosquito, then whichever of the
  // chapter's own monsters (on Adventure Isle) and the stage's tough ones it
  // is missing, then a blob. The queen is not one of them: she is the
  // deepest camp's own extra guard (addQueen).
  guardKind(c, monsters) {
    const here = monsters.list.filter((m) => m.camp === c.id && m.kind !== 'queen').map((m) => m.kind);
    if (!here.includes('mosquito')) return 'mosquito';
    const have = new Map();
    for (const k of here) have.set(k, (have.get(k) ?? 0) + 1);
    have.set('mosquito', have.get('mosquito') - 1);
    for (const k of [...(this.story?.guards ?? []), ...toughGuards(this.stage)]) {
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
    // A friend came to the island: one more on its way.
    if (count + c.back.length < want) c.back.push(now + GUARD_BACK_MS);
    c.holders = people.filter((p) => !p.flying && !p.riding && !p.dizzy && Math.hypot(p.x - c.x, p.z - c.z) <= FLAG_REACH && p.y > c.y - 1.5 && p.y < c.y + 3.5).length;
    // (A Mimic still shut guards nothing: nobody could tell what was holding the
    // flag down. Still, whoever comes to raise it is near enough to wake it.)
    c.guarded = monsters.list.some((m) => m.camp === c.id && campDistance(c, m.body.x, m.body.z) <= c.r + 0.5 && !(kindOf(m.kind).shut && m.state === 'idle'));
    if (!c.holders || c.guarded) return;
    c.progress = Math.min(1, c.progress + dt / raiseSeconds(c.holders, this.stage));
    if (c.progress >= 1) news.push(this.free(c, people, monsters));
  }

  // The camp is free: its monsters go, and whoever was there helped. With
  // that the last camp, King Grumble's bubble pops (and on an island
  // without a castle, that is the island free).
  free(c, people, monsters) {
    const shielded = this.shielded;
    Object.assign(c, { freed: true, progress: 1, awake: false, quiet: 0, back: [], holders: 0, guarded: false });
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
    const due = k.hearts <= k.max / 3 ? 2 : k.hearts <= (k.max * 2) / 3 ? 1 : 0;
    king.rage = due;
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
    return out;
  }

  // The Monster Gashapon, now and then (the room asks only on the shared
  // isle, Adventure Isle): with someone on the island it turns up a while
  // later (MONSTER_GASHA.first) near one of them, stays a while and goes,
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
  // while, while the camp is not free. King Grumble's helpers and the Queen
  // Mosquito do not: popping her is that camp's own little victory. Nor does its
  // champion, nor a beast's helpers. Nor do Gummy Cubs: a Gummy Bear split into
  // them, and it comes back whole.
  guardGone(m, now) {
    const c = this.campById(m.camp);
    if (!c || c.freed || !c.awake || c.kind !== 'camp' || isBoss(m.kind) || m.kind === 'queen' || m.kind === 'cub' || m.champion || m.helper) return;
    c.back.push(now + GUARD_BACK_MS);
  }

  // A friend bopping the castle's boss (King Grumble, or on the isle the
  // chapter's: bosses.js): nothing gets through its bubble, each
  // friend can bop it once a moment, and while it sits dazed a bop takes
  // DAZED_HIT hearts; times: how many times over a bop counts (a Star
  // Hammer's, see shop.js). Returns { shielded }, { wait }, or
  // { hit, hearts, max, beaten, dazed }.
  hitKing(pid, now, dazed = false, times = 1) {
    if (this.shielded) return { shielded: true };
    const k = this.king;
    if (!k.id || k.hearts <= 0) return { wait: true };
    if (now - (k.hits.get(pid) ?? -Infinity) < KING_HIT_MS) return { wait: true };
    k.hits.set(pid, now);
    k.hearts = Math.max(0, k.hearts - (dazed ? DAZED_HIT : 1) * times);
    k.hitAt = now;
    return { hit: true, hearts: k.hearts, max: k.max, beaten: k.hearts <= 0, dazed };
  }

  // The castle's boss popped: the whole island is free. Every monster of every
  // camp goes; returns them.
  win(monsters) {
    this.won = true;
    for (const c of this.camps) Object.assign(c, { freed: true, progress: 1, awake: false, quiet: 0, back: [], holders: 0, guarded: false });
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
      ...this.pack(),
    };
  }

  // What changes as it goes, a few times a second: how far up each flag is
  // that has been started on or is being guarded ([id, percent, friends by
  // it, guarded]), and King Grumble's hearts while he is about.
  pack() {
    return {
      c: this.camps.filter((c) => !c.freed && (c.awake || c.progress > 0)).map((c) => [c.id, Math.floor(c.progress * 100), c.holders, c.guarded ? 1 : 0]),
      k: this.king.id ? [this.king.hearts, this.king.max] : null,
      shield: this.shielded,
    };
  }

  // (The Monster Gashapon and the treasure chests go when the island is put
  // away: where they stood is kept only so that load can take them away.)
  save() {
    return { camps: this.camps.map(({ id, kind, x, y, z, r, freed }) => ({ id, kind, x, y, z, r, freed })), won: this.won, stage: this.stage, ...(this.gasha ? { gasha: [this.gasha.x, this.gasha.y, this.gasha.z] } : {}), ...(this.chests.list.length ? { chests: this.chests.save() } : {}) };
  }

  // An adventure as saved, checked, or null for none.
  static load(raw, world, seed) {
    if (!raw || !Array.isArray(raw.camps)) return null;
    const camps = [];
    for (const c of raw.camps.slice(0, 32)) {
      if (!Number.isInteger(c?.id) || c.id < 1 || camps.some((o) => o.id === c.id)) continue;
      if (c.kind !== 'camp' && c.kind !== 'castle') continue;
      if (![c.x, c.y, c.z, c.r].every(Number.isFinite)) continue;
      if (c.x < 0 || c.z < 0 || c.x > world.W || c.z > world.D || c.y < 1 || c.y > world.H || c.r < 2 || c.r > 20) continue;
      camps.push({ id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z, r: c.r, freed: c.freed === true });
    }
    // A Monster Gashapon still there when the island was put away has gone.
    if (Array.isArray(raw.gasha) && raw.gasha.length === 3 && raw.gasha.every(Number.isInteger)) {
      const [x, y, z] = raw.gasha;
      if (world.inBounds(x, y, z) && isMonsterGashapon(world.get(x, y, z))) world.set(x, y, z, B.AIR);
    }
    // So have its treasure chests: new ones come.
    Chests.clear(world, raw.chests);
    return camps.length ? new AdventureSim({ camps, won: raw.won === true, stage: cleanStage(raw.stage) }, seed) : null;
  }
}
