// Monsters: an island rule the owner can turn on (off unless they do).
// Grumpy little jelly blobs hop out of the bushes, more of them at night,
// and come after whoever is near. One that bumps into you knocks you back
// and takes some of your HP; with none left you pop back home with all of
// it again. Jump on one and it goes pop. Bopping one (the 👊 button, or X)
// works too, but only right up close, as far as your arm (or the toy weapon
// in it) reaches, and it takes a few bops: each one knocks it back a little,
// and it comes straight back at you, crosser and quicker than before.
//
// Tougher ones come out among them too, more of them at night: a Big
// Bruiser, twice the size, that bumps twice as much HP off you and takes six bops
// (a landing on it takes three, and you can land on it again and again),
// and a Spiky, quick and prickly, that no one can jump on (landing on it
// counts as a bump) and that takes four bops.
//
// And a giant mosquito, the one that used to drone about the meadows as a
// friend: it never touches the ground now, but hangs in the air well up out
// of reach, whining, and darts down at whoever it sees quicker than you
// walk (never as quick as you run) to bump some HP off them. Nobody can
// jump on one — it is up in the air — so swat it instead: two bops and it
// goes pop. Being a flyer, it crosses the water, where the others cannot
// follow, but it keeps out of the safe places like any of them.
//
// And a giant spider, low and wide on eight legs, mostly out at night: it
// scuttles as quick as a mosquito darts, quicker than you walk (never as
// quick as you run), so run away from one rather than walk. Unlike a Spiky
// or a mosquito you can jump on it: two of its four hearts come off with
// each landing, so two jumps see it off — or four bops. It keeps to the
// ground, out of the water and the safe places like the others.
//
// And on the higher stages of the public adventure island, two tougher
// still keep the camps (adventure.js): a Grumble Knight, a blob in a steel
// helmet with a shield, that bumps twice as much HP off you, takes eight
// bops and only gives up two hearts to a landing on its helmet, and when
// cross comes after you nearly as quick as you run; and a Stone Golem, a
// great lump of mossy rock nearly twice your height, slow, that bumps three
// times as much HP off you and takes twelve bops (a landing, two).
//
// And a Lava Ghost, on a volcano island only: a floating wisp of molten
// rock that drifts slowly after you over the ground and the lava lakes alike
// (never over water, nor into a tent or the safe place round the start, like
// any of them) and every few seconds breathes a short jet of fire from its
// mouth (GHOST_FIRE), the dragon's breath drawn smaller, burning whoever is
// in it. Nobody lands on one — it is up in the air — so bop it three times
// and it goes pop.
//
// And the Queen Mosquito, the giant one's mother and much bigger, with a
// little crown: she guards the deepest camp of an adventure island. Like her
// little cousins she darts down out of the air to bump HP off you — twice as
// much — and nobody can jump on her, and she takes a lot of bops to pop. Her
// own trick: with nobody within a few steps of her for a few seconds, she gets
// a heart back every two seconds, so friends have to keep at her together.
//
// On a tower defense island (defense.js) they march along the road from
// their gate to the Star Stone instead, bumping nobody on the way.
//
// On an adventure island (adventure.js) monsters also keep to their camps,
// whether the rule is on or not: guards that chase whoever comes into their
// camp and go back to it after, and in his castle King Grumble, big and
// slow, who stomps the ground now and then.
//
// Nobody gets hurt: HP comes back by itself, the start of the island
// (and every camp freed) and every tent are safe places no monster goes
// into, and they cannot swim, reach someone riding an animal or catch
// anyone who runs.
//
// The host moves them (Room.tick); everyone sees them a few times a second,
// as they see the animals. They are never saved: turning monsters off, or
// opening the island again, starts it without any.
import * as B from './blocks.js';
import { makeBody, pushOut, shove, stepBody } from './physics.js';
import { MAX_LEVEL } from './levels.js';
import { Rng } from './rng.js';
import { underTent } from './tents.js';

// Your HP (hit points): BASE_HP at level 1 and HP_PER_LEVEL more with each
// level up (levels.js), so the higher your level the more bumps you can take.
// A bump takes BUMP_HP (twice that from a Big Bruiser), so five of them send
// someone at level 1 home.
export const BASE_HP = 100;
export const HP_PER_LEVEL = 5;
export const BUMP_HP = 20;
export const maxHp = (level) => BASE_HP + HP_PER_LEVEL * (Math.max(1, Math.min(MAX_LEVEL, Number.isInteger(level) ? level : 1)) - 1);
// HP_BACK of it back this long after the last bump, and every this long after that.
export const HP_BACK_MS = 6000;
export const HP_BACK = 20;
// After a bump, a moment when nothing can bump you again.
export const SAFE_MS = 1600;
// Standing in lava takes this many bumps' worth of HP off (twice a monster
// bump's 20: much more than any of them), again and again while you stay in
// it, each hit as far apart apart as a bump — get out of the lava!
// (shared/room.js does the taking.)
export const LAVA_BUMPS = 2;
// How far round the island's start a monster never goes.
export const SAFE_RADIUS = 9;
// How many there are for each player on the island, by day and at night,
// and never more than this many on the whole island (not counting those
// that keep to a camp).
const PER_PLAYER = { day: 2, night: 4 };
export const MAX_MONSTERS = 16;
const SPAWN_MS = 3500;
// Where one comes out, round a player: further than this...
const SPAWN_NEAR = 14;
// ...and nearer than this.
const SPAWN_FAR = 30;
// How near someone has to be for one to come after them, and how far they
// get away before it gives up.
const NOTICE = 11;
const GIVE_UP = 18;
// A camp's monsters come after anyone this far beyond its fence, and give
// up on whoever gets this far beyond it.
const WATCH = 4;
const LEASH = 9;
// Off by itself this far from everyone for this long, it goes away.
const LONELY = 44;
const LONELY_MS = 15000;
// Hopping about: slower than you walk (4.6), much slower than you run (7);
// a hop gets it up a step a block high, never two.
const MOVE = { walk: 1.6, run: 3.4, jump: 8 };
// Its size: as wide as it is round, and up to a player's middle.
export const MONSTER_BODY = { radius: 0.42, height: 0.8 };
// A Big Bruiser: about as tall as a player, and wide.
export const BIG_BODY = { radius: 0.7, height: 1.3 };
// A Spiky: a blob's size, with its spikes.
export const SPIKY_BODY = { radius: 0.45, height: 0.85 };
// A giant mosquito: about a Big Bruiser's height, rounder, and it never
// touches the ground.
export const MOSQUITO_BODY = { radius: 0.5, height: 1.15 };
// A giant spider: wider than a Big Bruiser is round but only up to your
// middle, skittering about on its eight legs.
export const SPIDER_BODY = { radius: 0.55, height: 0.95 };
// Mr. Mole: a little wider than a blob, and only as far out of the ground
// as he is tall when he pops up.
export const MOLE_BODY = { radius: 0.5, height: 1.0 };
// A Queen Mosquito: bigger than the giant one, crown and all.
export const QUEEN_BODY = { radius: 0.8, height: 1.8 };
// A Grumble Knight: a blob a little bigger than most, its helmet on top.
export const KNIGHT_BODY = { radius: 0.52, height: 1.05 };
// A Stone Golem: taller than a player and wider than a Big Bruiser.
export const GOLEM_BODY = { radius: 0.85, height: 1.75 };
// A Lava Ghost: a blob's width but taller, hanging in the air a little way.
export const GHOST_BODY = { radius: 0.45, height: 0.95 };
// King Grumble: as tall as a player and much wider, slower still, with
// bigger hops.
export const KING_BODY = { radius: 0.95, height: 1.8 };
// The crosser he gets (rage: 0, 1 at two thirds of his hearts, 2 at a
// third), the quicker: at the last as quick as you walk, never as you run.
const KING_MOVES = [3, 3.8, 4.6].map((run) => ({ walk: 1.8, run, jump: 9 }));
// Marching along a tower defense island's road: a little quicker than they
// hop about, and King Grumble slower.
const MARCH = { walk: 2.5, run: 2.5, jump: 8 };
const KING_MARCH = { walk: 1.4, run: 1.4, jump: 9 };
// His stomp: now and then, near whoever he is after, he crouches (long
// enough to see it coming, with a ring on the ground as far as it reaches),
// jumps straight up and lands with a thump that knocks over anyone on the
// ground that near. Anyone in the air then is missed. Down from one, he sits
// dazed a moment: he bumps nobody, and a bop then takes DAZED_HIT hearts.
// The crosser he gets, the sooner the next (every, by rage, from landing).
export const STOMP = { every: 6500, windup: 900, reach: 6, jump: 10.5 };
const STOMP_EVERY = [6500, 4500, 3200];
export const DAZE_MS = 2200;
export const DAZED_HIT = 3;
// Bumping: how close (between middles, side to side) and how long it stops
// to giggle after.
const BUMP_PAD = 0.38;
const GIGGLE_MS = 1400;
// Bopping one: a swing sweeps round in front of you (game.js), as far as your arm
// reaches (ARM_REACH, from your side to its side, and about level with you),
// further with a toy weapon in it (see shop.js). The host lets a little more
// through (BOP_SLACK), as a monster on the move is a little further on there
// than on your screen.
export const ARM_REACH = 1.2;
export const BOP_SLACK = 1.2;
// How far a body b (a monster's) is from the side of someone standing at p,
// if it is about level with them and no further than reach, else null.
export function bopGap(p, b, reach) {
  if (b.y > p.y + 2.1 || b.y + b.height < p.y - 0.6) return null;
  const gap = Math.max(0, Math.hypot(b.x - p.x, b.z - p.z) - b.radius - 0.3);
  return gap <= reach ? gap : null;
}
// A blob's hearts: one comes off with each bop (each friend can bop it once
// in HIT_MS), and with none left it goes pop. Left alone this long, it has
// them all again.
export const BLOB_HEARTS = 3;
export const HIT_MS = 400;
const HEAL_MS = 5000;
// The Queen Mosquito's healing (see step): a heart back this long apart, but
// only once nobody has been within QUEEN_NEAR steps of her for this long.
export const QUEEN_HEAL_MS = 2000;
export const QUEEN_NEAR = 12;
export const QUEEN_LONELY_MS = 3000;
// A bop knocks it back this fast, and up a little; then for a while it comes
// after whoever tapped it this fast: quicker than you walk, slower than you run.
const HIT_PUSH = 7;
const CROSS_MS = 5000;
const CROSS_RUN = 6.5;
const CROSS_MOVE = { ...MOVE, run: CROSS_RUN };
// Mr. Mole's burrowing: how fast his mound of dirt glides along under the
// ground (quicker than you walk, never as quick as you run), how near you he
// comes up out of it, how long he stays up for a bop or a jump, and how long
// the dip back down takes before he is under again.
export const MOLE_DIG = { run: 5.4, pop: 3.0, up: 2600, down: 800 };
// The roaming kinds, and how tough each is: its hearts, how many it bumps
// off you, how many a landing on it takes (Infinity: it pops at once; 0:
// nobody lands on it, it bumps them), and how it gets about, usually and
// cross. A Big Bruiser is slow, but cross as quick as you walk; a Spiky is
// quicker than a blob, though never as quick as you run.
export const KINDS = {
  blob: { hearts: BLOB_HEARTS, bump: 1, land: Infinity, move: MOVE, cross: CROSS_MOVE },
  big: { hearts: 6, bump: 2, land: 3, move: { walk: 1.4, run: 3.6, jump: 9 }, cross: { walk: 1.4, run: 4.6, jump: 9 } },
  spiky: { hearts: 4, bump: 1, land: 0, move: { walk: 2, run: 4.2, jump: 8 }, cross: { ...MOVE, run: CROSS_RUN } },
  // A mosquito darts at you, so its run is how fast it flies; cross (after
  // a bop) as quick as the others get, still never as quick as you run.
  mosquito: { hearts: 2, bump: 1, land: 0, move: { walk: 2.2, run: 5.2 }, cross: { walk: 2.2, run: 6.5 } },
  // A giant spider scuttles: as quick as a mosquito, so quicker than you
  // walk (never as quick as you run); cross as quick as the others get. A
  // landing on its back takes two of its four hearts.
  spider: { hearts: 4, bump: 1, land: 2, move: { walk: 2.4, run: 5.2, jump: 8 }, cross: { walk: 2.4, run: 6.5, jump: 8 } },
  // A Grumble Knight marches about steadily, and cross is nearly as quick
  // as you run (6.6 against 7). Its helmet takes the worst of a landing.
  knight: { hearts: 8, bump: 2, land: 2, move: { walk: 1.8, run: 4.6, jump: 8 }, cross: { walk: 1.8, run: 6.6, jump: 8 } },
  // A Stone Golem lumbers, slower than a Big Bruiser, but bumps the hardest.
  golem: { hearts: 12, bump: 3, land: 2, move: { walk: 1.2, run: 3.2, jump: 9 }, cross: { walk: 1.2, run: 4.4, jump: 9 } },
  // A Lava Ghost drifts after you, slow as a Big Bruiser and never as quick
  // as you walk, and its fire does the hurting (GHOST_FIRE): it bumps nobody.
  ghost: { hearts: 3, bump: 0, land: 0, move: { walk: 1.1, run: 2.4 }, cross: { walk: 1.1, run: 3.4 } },
  // Mr. Mole burrows: the run is how fast his mound of dirt glides along
  // under the ground, quicker than you walk and never as quick as you run.
  // Above ground he is only up a moment, and one bop or landing counts the
  // same (see MOLE_DIG and step).
  mole: { hearts: 3, bump: 1, land: Infinity, move: { walk: 2, run: MOLE_DIG.run, jump: 8 }, cross: { walk: 2, run: 6.5, jump: 8 } },
  // The Queen Mosquito: many hearts, a bump twice a giant mosquito's, and
  // nobody lands on her — she is up in the air, like her little cousins.
  queen: { hearts: 14, bump: 2, land: 0, move: { walk: 2, run: 5 }, cross: { walk: 2, run: 6.4 } },
};
export const kindOf = (kind) => KINDS[kind] ?? KINDS.blob;
// Which kind comes out, by day and at night: the rest are blobs. A giant
// spider is hardly ever about by day and oftener at night.
const TOUGH = { day: { spiky: 0.2, mosquito: 0.12, spider: 0.08, mole: 0.1 }, night: { big: 0.2, spiky: 0.25, mosquito: 0.2, spider: 0.16, mole: 0.14 } };
// How often the one that comes out on a volcano island is a Lava Ghost.
const GHOST_SHARE = 0.3;
// How high a mosquito keeps itself over the ground (or the water) beneath
// it: well up out of reach of arm and jump until it darts at someone, when
// it comes down to bump height; and how quickly it rises and sinks.
export const MOSQUITO_HOVER = { high: 2.3, low: 1.0, march: 1.1, up: 3 };
// A Lava Ghost's breath of fire (dragon.js FIRE, drawn smaller): it rears
// back this long first — long enough to see it coming — then a short jet of
// flames pours out as far as GHOST_FIRE.reach in front of its mouth, in a
// cone GHOST_FIRE.angle either side, and burns whoever is in it for this many
// bumps' worth of HP (monsters.js BUMP_HP): half that in Knight Armor or a
// Fire Suit. One breath every GHOST_FIRE.every while it is after someone.
export const GHOST_FIRE = { first: 1500, every: 3200, windup: 750, ms: 1000, reach: 4.5, angle: 0.4, bumps: 1.5 };
// How high a Lava Ghost floats over the ground (or the lava) beneath it: low
// enough to bop, high enough that nobody lands on it by jumping.
export const GHOST_HOVER = { high: 1.5, chase: 1.0, up: 2.5 };
// Landing on one: your feet this far above its middle at least, and this
// close side to side (a little more than touching, as you have moved on a
// little by the time the host hears of it).
const LAND_PAD = 0.9;

// New states and kinds go on the end: the wire sends the index.
export const MONSTER_STATES = ['idle', 'hop', 'chase', 'giggle', 'stomp', 'dazed', 'breathe', 'dig'];
export const MONSTER_KINDS = ['blob', 'king', 'big', 'spiky', 'mosquito', 'spider', 'knight', 'golem', 'ghost', 'mole', 'queen'];

export const bodyOf = (kind) => ({ king: KING_BODY, big: BIG_BODY, spiky: SPIKY_BODY, mosquito: MOSQUITO_BODY, spider: SPIDER_BODY, knight: KNIGHT_BODY, golem: GOLEM_BODY, ghost: GHOST_BODY, mole: MOLE_BODY, queen: QUEEN_BODY })[kind] ?? MONSTER_BODY;
// Whether Mr. Mole is under the ground, from his state as the wire sends
// it: up out of it he only ever hops or giggles (see step).
export const moleUnder = (kind, state) => kind === 'mole' && state !== 'hop' && state !== 'giggle';
// The heavy ones: a bigger knock when they bump you, and a bigger pop.
export const isHeavy = (kind) => kind === 'king' || kind === 'big' || kind === 'golem' || kind === 'queen';

const FL = Math.floor;
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

// How far (x, z) is from the middle of a camp (or any safe place), the way
// its shape measures it: round, or square for a castle.
export function campDistance(camp, x, z) {
  const dx = x - camp.x;
  const dz = z - camp.z;
  return camp.kind === 'castle' ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
}

// Somewhere a monster can stand: on the ground (not a tree or a tent, not in
// the water), with room above it.
function groundAt(world, x, z) {
  const cx = FL(x);
  const cz = FL(z);
  if (cx < 1 || cz < 1 || cx >= world.W - 1 || cz >= world.D - 1) return null;
  const y = world.top(cx, cz);
  if (y < 1 || y >= world.H - 2) return null;
  const under = world.get(cx, y, cz);
  if (!B.SOLID[under] || B.TREE_PART[under] || B.CLOTH[under]) return null;
  if (B.SOLID[world.get(cx, y + 1, cz)] || B.SOLID[world.get(cx, y + 2, cz)] || world.get(cx, y + 1, cz) === B.WATER || world.get(cx, y + 1, cz) === B.LAVA) return null;
  return y + 1;
}

// Whether any of a monster standing at (x, y, z) would be in a tent: its
// corners, not just its middle, which could cut a tent's corner on the way.
function tentAt(world, x, y, z, r) {
  return underTent(world, x - r, y, z - r) || underTent(world, x + r, y, z - r) || underTent(world, x - r, y, z + r) || underTent(world, x + r, y, z + r);
}

// Whether the column at (x, z) is water or lava a monster would fall into
// (a volcano island's sea and lakes are lava: into the fire, no monster goes).
// overLava: a Lava Ghost, which floats over the lava but keeps out of water.
function wet(world, x, y, z, overLava = false) {
  const cx = FL(x);
  const cz = FL(z);
  for (let yy = FL(y + 0.5); yy >= Math.max(0, FL(y) - 3); yy--) {
    const id = world.get(cx, yy, cz);
    if (id === B.WATER || (id === B.LAVA && !overLava)) return true;
    if (B.SOLID[id] || id === B.LAVA) return false;
  }
  return false;
}

// The safe places of an island without camps: just its start.
const startOnly = (world) => [{ x: world.spawn.x, z: world.spawn.z, r: SAFE_RADIUS }];

// Whether a point (x, y, z) is in a Lava Ghost's jet of fire, breathed from
// its body b the way yaw faces (dragon.js inFlames, drawn smaller).
export function inGhostFlames(b, yaw, x, y, z) {
  const dx = x - b.x;
  const dz = z - b.z;
  const d = Math.hypot(dx, dz);
  if (d > GHOST_FIRE.reach || y < b.y - 1.5 || y > b.y + 2.5) return false;
  if (d < 1) return true;
  return Math.abs(wrap(Math.atan2(dx, dz) - yaw)) <= GHOST_FIRE.angle;
}

export class MonsterSim {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    // The camps' monsters draw from randomness of their own, so the others
    // do just as they would without them.
    this.campRng = new Rng((seed ^ 0x2f6b1d3a) >>> 0);
    // And which kind comes out from randomness of its own, so where and
    // when they do is just as it was before there were tougher ones.
    this.kindRng = new Rng((seed ^ 0x5bd1e995) >>> 0);
    this.list = [];
    this.nextId = 1;
    this.spawnAt = 0;
    // Camp monsters that went by themselves (into the water), King
    // Grumble's landings and Lava Ghosts' breaths of fire, since they were
    // last taken (see takeGone, takeStomps, takeFires, takeBurns).
    this.gone = [];
    this.stomps = [];
    this.fires = [];
    this.burns = [];
    // And Mr. Mole's comings up out of the ground (see takeUps).
    this.ups = [];
    // And the hearts the Queen Mosquito got back (see takeHealed).
    this.healed = [];
  }

  get(id) {
    return this.list.find((m) => m.id === id) ?? null;
  }

  // How many hop about the island by themselves, not keeping to a camp
  // nor marching.
  get roaming() {
    let n = 0;
    for (const m of this.list) if (!m.camp && !m.march) n++;
    return n;
  }

  // camp: the id of the camp it keeps to (0: none); kind: 'blob' or 'king';
  // march: the way it marches along, as [{ x, y, z }] (a tower defense
  // island's road, see defense.js), or null.
  add(world, x, y, z, { camp = 0, kind = 'blob', march = null } = {}) {
    if (!camp && !march && this.roaming >= MAX_MONSTERS) return null;
    const size = bodyOf(kind);
    const body = makeBody(x, y, z);
    body.radius = size.radius;
    body.height = size.height;
    // A mosquito comes out already on the wing, and so do a Lava Ghost and
    // the Queen Mosquito.
    if (kind === 'mosquito' || kind === 'ghost' || kind === 'queen') body.flying = true;
    const rng = camp || march ? this.campRng : this.rng;
    const hearts = kindOf(kind).hearts;
    const m = { id: this.nextId++, body, yaw: rng.range(-Math.PI, Math.PI), state: 'idle', target: 0, wander: null, rest: rng.range(0.5, 2), lonely: 0, giggle: 0, hearts, max: hearts, hits: new Map(), hitAt: 0, healAt: 0, cross: 0, camp, kind: MONSTER_KINDS.includes(kind) ? kind : 'blob' };
    // Mr. Mole comes out under the ground, as a mound of dirt on the move.
    if (kind === 'mole') Object.assign(m, { under: true, up: 0 });
    if (march) Object.assign(m, { march, leg: 1, along: 0, stuck: 0, arrived: false, passive: true });
    this.list.push(m);
    return m;
  }

  remove(id) {
    const i = this.list.findIndex((m) => m.id === id);
    if (i < 0) return null;
    return this.list.splice(i, 1)[0];
  }

  clear() {
    this.list = [];
  }

  // Only the ones roaming about: those of the camps, and those marching, stay.
  clearRoaming() {
    this.list = this.list.filter((m) => m.camp || m.march);
  }

  takeGone() {
    const out = this.gone;
    this.gone = [];
    return out;
  }

  takeStomps() {
    const out = this.stomps;
    this.stomps = [];
    return out;
  }

  // The hearts the Queen Mosquito has got back since they were last taken, as
  // the ids of the moments she healed, for the room to show everyone.
  takeHealed() {
    const out = this.healed;
    this.healed = [];
    return out;
  }

  // Mr. Mole's poppings up, since they were last taken: for the burst of
  // dirt as he comes out of the ground (see room.js).
  takeUps() {
    const out = this.ups;
    this.ups = [];
    return out;
  }

  // The Lava Ghosts that breathed fire since last asked, and the people they
  // burned, for the host to tell everyone about.
  takeFires() {
    const out = this.fires;
    this.fires = [];
    return out;
  }

  takeBurns() {
    const out = this.burns;
    this.burns = [];
    return out;
  }

  // Which kind comes out next, by day or at night (see TOUGH). A Lava Ghost
  // comes out only on a volcano island, near the lava lakes and the sea of it.
  pickKind(night, theme = null) {
    if (theme === 'volcano' && this.kindRng.chance(GHOST_SHARE)) return 'ghost';
    let r = this.kindRng.next();
    for (const [kind, share] of Object.entries(TOUGH[night ? 'night' : 'day'])) {
      if (r < share) return kind;
      r -= share;
    }
    return 'blob';
  }

  // How many there should be with these players on the island.
  wanted(players, night) {
    return Math.min(MAX_MONSTERS, players * PER_PLAYER[night ? 'night' : 'day']);
  }

  // A spot for a new one: out of sight round one of the players, away from
  // all of them and from the safe places (the island's start, and on an
  // adventure island every camp freed).
  findSpot(world, people, havens = startOnly(world)) {
    if (!people.length) return null;
    for (let tries = 0; tries < 40; tries++) {
      const p = this.rng.pick(people);
      const a = this.rng.range(-Math.PI, Math.PI);
      const d = this.rng.range(SPAWN_NEAR, SPAWN_FAR);
      const x = FL(p.x + Math.sin(a) * d) + 0.5;
      const z = FL(p.z + Math.cos(a) * d) + 0.5;
      const y = groundAt(world, x, z);
      if (y === null) continue;
      if (havens.some((h) => campDistance(h, x, z) < h.r + 3)) continue;
      if (people.some((q) => Math.hypot(q.x - x, q.z - z) < SPAWN_NEAR - 2)) continue;
      return { x, y, z };
    }
    return null;
  }

  // Moves them on by dt seconds. people: the players on the island, as
  // { id, x, y, z, flying, riding, dizzy, safeUntil, mount }. options: roam, whether
  // monsters come out round the players (the island rule); havens, the safe
  // places ({ x, z, r, kind }); camps, what the camp monsters keep to (an
  // AdventureSim, or anything with campById). Returns who each one bumped
  // into, as [{ monster, pid }].
  step(world, dt, now, people, night, { roam = true, havens = startOnly(world), camps = null } = {}) {
    if (roam && now >= this.spawnAt) {
      this.spawnAt = now + SPAWN_MS;
      if (this.roaming < this.wanted(people.length, night)) {
        const at = this.findSpot(world, people, havens);
        if (at) this.add(world, at.x, at.y, at.z, { kind: this.pickKind(night, world.theme) });
      }
    }
    const bumps = [];
    // Who is in a tent, where nothing can get at them.
    const inTent = new Map();
    const sheltered = (p) => {
      if (!inTent.has(p)) inTent.set(p, underTent(world, p.x, p.y, p.z));
      return inTent.get(p);
    };
    for (const m of [...this.list]) {
      if (m.march) {
        this.marchOn(world, m, dt);
        continue;
      }
      const b = m.body;
      const fly = m.kind === 'mosquito' || m.kind === 'queen';
      // A Lava Ghost floats too, but it keeps out of the water where a
      // mosquito crosses it (into the fire of a lava lake, though, it goes).
      const float = m.kind === 'ghost';
      const swim = fly;
      const camp = m.camp ? (camps?.campById(m.camp) ?? null) : null;
      // Lonely, far from everyone: off it goes (one of a camp stays). In the
      // water or the lava, it goes too.
      if (!m.camp) {
        const nearest = people.reduce((best, p) => Math.min(best, Math.hypot(p.x - b.x, p.z - b.z)), Infinity);
        m.lonely = nearest > LONELY ? m.lonely + dt * 1000 : 0;
      }
      if (m.lonely > LONELY_MS || b.inWater || b.inLava || b.y < 2 || (m.camp && !camp)) {
        this.remove(m.id);
        if (m.camp) this.gone.push(m);
        continue;
      }
      const rng = m.camp ? this.campRng : this.rng;
      // Whom it is after: the nearest it can get at (not someone riding,
      // flying high, dizzy or in a tent), until they get away. One of a camp
      // is after whoever comes into it, as far as a little way out.
      const fair = (p) => !p.riding && !p.dizzy && p.y - b.y < 4 && !sheltered(p);
      let target = m.passive ? null : (people.find((p) => p.id === m.target) ?? null);
      if (camp) {
        if (target && (!fair(target) || campDistance(camp, target.x, target.z) > camp.r + LEASH)) target = null;
        if (!target && !m.passive) {
          let best = Infinity;
          for (const p of people) {
            const d = Math.hypot(p.x - b.x, p.z - b.z);
            if (d < best && campDistance(camp, p.x, p.z) <= camp.r + WATCH && fair(p)) {
              best = d;
              target = p;
            }
          }
        }
      } else {
        if (target && (target.riding || target.dizzy || Math.hypot(target.x - b.x, target.z - b.z) > GIVE_UP || sheltered(target))) target = null;
        if (!target) {
          let best = NOTICE;
          for (const p of people) {
            const d = Math.hypot(p.x - b.x, p.z - b.z);
            if (d < best && fair(p)) {
              best = d;
              target = p;
            }
          }
        }
      }
      m.target = target?.id ?? 0;
      // Left alone a while: all its hearts back. The Queen Mosquito is
      // another matter: while nobody is within a few steps of her for a few
      // seconds, she gets a heart back every two seconds (see takeHealed), so
      // friends have to keep at her together.
      if (m.kind === 'queen') {
        const near = people.some((p) => Math.hypot(p.x - b.x, p.z - b.z) <= QUEEN_NEAR);
        m.quiet = near ? 0 : (m.quiet ?? 0) + dt * 1000;
        if (m.hearts < m.max && m.quiet >= QUEEN_LONELY_MS && now - Math.max(m.hitAt, m.healAt ?? 0) >= QUEEN_HEAL_MS) {
          m.hearts++;
          m.healAt = now;
          this.healed.push(m.id);
        }
      } else if (m.hitAt && now - m.hitAt >= HEAL_MS) {
        m.hearts = m.max ?? BLOB_HEARTS;
        m.hitAt = 0;
      }
      // King Grumble's stomp only ever counts down while he is after someone.
      if (!target) m.stompAt = 0;
      // A Lava Ghost's breath of fire counts down only while it is after
      // someone too: with nobody to breathe at, it gives up on one.
      if (!target && m.kind === 'ghost') {
        m.windup = 0;
        m.fireAt = 0;
      }
      let mx = 0;
      let mz = 0;
      const every = STOMP_EVERY[m.rage ?? 0] ?? STOMP.every;
      if (now < (m.dazed ?? 0)) {
        m.state = 'dazed';
      } else if (now < m.giggle) {
        m.state = 'giggle';
      } else if (m.windup || m.slam) {
        // Crouched for a stomp, then up he goes, straight up, so he comes
        // down just where the ring on the ground said he would.
        // (A Lava Ghost rearing back to breathe fire uses the same windup.)
        m.state = m.windup ? (m.kind === 'ghost' ? 'breathe' : 'stomp') : 'chase';
        if (m.windup && now >= m.windup) {
          m.windup = 0;
          if (m.kind === 'ghost') {
            // Rearing back is over: the jet of fire pours out now, the way it
            // faced (see fires, which the host tells everyone about).
            m.state = 'breathe';
            m.breath = now + GHOST_FIRE.ms;
            m.burned = new Set();
            b.vx = 0;
            b.vz = 0;
            this.fires.push(m);
          } else {
            m.slam = true;
            b.vx = 0;
            b.vz = 0;
            b.vy = STOMP.jump;
            b.onGround = false;
          }
        }
      } else if (m.breath) {
        // A Lava Ghost breathing fire stands still while it lasts, burning
        // each of the people in the flames once (the host tells everyone:
        // see takeFires and takeBurns).
        m.state = 'breathe';
        for (const p of people) {
          if (p.riding || p.dizzy || m.burned.has(p.id) || sheltered(p) || now < (p.safeUntil ?? 0)) continue;
          if (inGhostFlames(b, m.yaw, p.x, p.y, p.z)) {
            m.burned.add(p.id);
            this.burns.push({ monster: m, pid: p.id });
          }
        }
        if (now >= m.breath) {
          m.breath = 0;
          m.fireAt = now + GHOST_FIRE.every;
        }
      } else if (target) {
        const dx = target.x - b.x;
        const dz = target.z - b.z;
        const d = Math.hypot(dx, dz) || 1;
        mx = dx / d;
        mz = dz / d;
        // Round a wall it could not hop over, for a moment.
        if (m.detour && now < m.detour.until) {
          mx = m.detour.x;
          mz = m.detour.z;
        }
        m.state = 'chase';
        // A Lava Ghost stops and breathes fire at whoever it is after, near
        // enough: it rears back first (see GHOST_FIRE), then a short jet of
        // flames pours out the way it faces, and it drifts on after them.
        if (m.kind === 'ghost' && !m.windup && !m.breath) {
          if (!m.fireAt) m.fireAt = now + GHOST_FIRE.first;
          else if (now >= m.fireAt && d < GHOST_FIRE.reach + 1.5) {
            m.fireAt = 0;
            m.windup = now + GHOST_FIRE.windup;
            m.state = 'breathe';
            mx = 0;
            mz = 0;
          }
        }
        if (m.kind === 'king' && b.onGround && !m.slam) {
          if (!m.stompAt) m.stompAt = now + every * 0.6;
          else if (now >= m.stompAt && d < STOMP.reach + 2) {
            m.stompAt = 0;
            m.windup = now + STOMP.windup;
            m.state = 'stomp';
            mx = 0;
            mz = 0;
          }
        }
      } else if (camp) {
        // Keeping to its camp: about inside it, and back in from outside.
        const home = campDistance(camp, b.x, b.z);
        m.rest -= dt;
        if (m.rest <= 0 || (home > camp.r - 1.5 && !m.homeward)) {
          m.rest = rng.range(2, 5);
          m.homeward = home > camp.r - 2.5;
          const a = m.homeward ? Math.atan2(camp.x - b.x, camp.z - b.z) + rng.range(-0.4, 0.4) : rng.range(-Math.PI, Math.PI);
          m.wander = !m.homeward && (m.passive || rng.chance(0.35)) ? null : { x: Math.sin(a), z: Math.cos(a) };
        }
        if (m.wander) {
          mx = m.wander.x;
          mz = m.wander.z;
          // Not out of the camp by itself.
          if (!m.homeward && campDistance(camp, b.x + mx, b.z + mz) > camp.r - 1.5) {
            mx = 0;
            mz = 0;
            m.wander = null;
          }
          if (m.homeward && home < camp.r - 3) m.homeward = false;
        }
        m.state = mx || mz ? 'hop' : 'idle';
      } else {
        m.rest -= dt;
        if (m.rest <= 0) {
          m.rest = rng.range(2, 5);
          // Mostly roughly towards the nearest player, so it finds them in the end.
          const near = people.reduce((best, p) => (!best || Math.hypot(p.x - b.x, p.z - b.z) < Math.hypot(best.x - b.x, best.z - b.z) ? p : best), null);
          const a = near && rng.chance(0.65) ? Math.atan2(near.x - b.x, near.z - b.z) + rng.range(-0.7, 0.7) : rng.range(-Math.PI, Math.PI);
          m.wander = rng.chance(0.25) ? null : { x: Math.sin(a), z: Math.cos(a) };
        }
        if (m.wander) {
          mx = m.wander.x;
          mz = m.wander.z;
        }
        m.state = m.wander ? 'hop' : 'idle';
      }
      // Never into a safe place (round its edge instead), nor, on the
      // ground, into the water or a tent (a mosquito flies over both).
      if (mx || mz) {
        const into = (x, z) => havens.find((h) => campDistance(h, x, z) < h.r && campDistance(h, x, z) < campDistance(h, b.x, b.z)) ?? null;
        const h = into(b.x + mx * 0.9, b.z + mz * 0.9);
        if (h) {
          const rx = b.x - h.x;
          const rz = b.z - h.z;
          const r = Math.hypot(rx, rz) || 1;
          const side = mx * -rz + mz * rx >= 0 ? 1 : -1;
          mx = (side * -rz) / r;
          mz = (side * rx) / r;
        }
        const ax = b.x + mx * 0.9;
        const az = b.z + mz * 0.9;
        if (into(ax, az) || (!swim && (wet(world, ax, b.y, az, float) || (tentAt(world, ax, b.y, az, b.radius) && !underTent(world, b.x, b.y, b.z))))) {
          mx = 0;
          mz = 0;
          m.wander = null;
          if (m.state === 'hop') m.state = 'idle';
        }
      }
      const pace = m.kind === 'king' ? KING_MOVES[m.rage ?? 0] : now < m.cross ? kindOf(m.kind).cross : kindOf(m.kind).move;
      let events;
      if (m.kind === 'mole') {
        // Mr. Mole: under the ground his mound of dirt glides along, up and
        // down the ground as it rises and falls (no hops, and no falling into
        // anything: a digger goes round the water, as the check above sees
        // to). Beside whoever he is after, up he pops for a bop or a jump,
        // then dips back under and carries on.
        if (m.under) {
          // Burrowing along: a mound of dirt on the move, chasing whoever he
          // is after (the model shows him under the ground either way).
          m.state = target ? 'chase' : 'dig';
          b.flying = false;
          const want = groundAt(world, b.x, b.z) ?? b.y;
          const d = want - b.y;
          b.y += Math.sign(d) * Math.min(Math.abs(d), 6 * dt);
          b.vy = 0;
          b.onGround = false;
          events = stepBody(world, b, { mx, mz, run: true }, dt, { autoJump: false, move: { ...pace, jump: 0 } });
          if (target) {
            const near = Math.hypot(target.x - b.x, target.z - b.z);
            if (near <= MOLE_DIG.pop) {
              // Up he comes, right beside them, with a burst of dirt.
              m.under = false;
              m.up = now + MOLE_DIG.up;
              m.state = 'hop';
              this.ups.push({ monster: m, x: b.x, y: b.y, z: b.z });
            }
          }
        } else {
          // Up out of the ground, on his feet a moment: he comes at whoever
          // he popped up beside, hopping as a blob does, to bump them — and
          // to give them their chance to bop him or jump on him.
          events = stepBody(world, b, { mx, mz, jump: (mx || mz) && b.onGround, run: m.state === 'chase' }, dt, { autoJump: true, move: pace });
          m.state = now < m.giggle ? 'giggle' : 'hop';
          // His moment up top over: back under, and on he goes.
          if (now >= (m.up ?? 0)) {
            m.under = true;
            m.state = 'idle';
            b.vx = 0;
            b.vz = 0;
          }
        }
      } else if (fly || float) {
        // A mosquito hangs in the air well up out of reach, coming down to
        // bump height only as it darts at someone; a Lava Ghost drifts low
        // over whatever is beneath it, a little lower on the chase.
        b.flying = true;
        const hover = fly ? (m.state === 'chase' ? MOSQUITO_HOVER.low : MOSQUITO_HOVER.high) : m.state === 'chase' || m.state === 'breathe' ? GHOST_HOVER.chase : GHOST_HOVER.high;
        // A Lava Ghost floats over the lava lakes too, so for it the surface
        // of any liquid above the ground counts as the ground.
        let base = Math.max(world.top(FL(b.x), FL(b.z)), world.sea) + 1;
        if (float) {
          for (let y = FL(base); y < world.H - 1; y++) {
            const id = world.get(FL(b.x), y, FL(b.z));
            if (B.SOLID[id] || id === B.WATER || id === B.LAVA) base = y + 1;
            else break;
          }
        }
        const want = base + hover;
        events = stepBody(world, b, { mx, mz, jump: b.y < want - 0.2, down: b.y > want + 0.2, run: false }, dt, { move: { fly: m.state === 'chase' ? pace.run : pace.walk, flyUp: fly ? MOSQUITO_HOVER.up : GHOST_HOVER.up } });
      } else {
        // The others get about in hops.
        events = stepBody(world, b, { mx, mz, jump: (mx || mz) && b.onGround, run: m.state === 'chase' }, dt, { autoJump: true, move: pace });
      }
      if (events.bumped && m.state === 'hop') m.rest = 0;
      // Down from a stomp: the thump (see takeStomps), and a while till the next.
      if (m.slam && b.onGround) {
        m.slam = false;
        m.stompAt = now + every;
        m.dazed = now + DAZE_MS;
        this.stomps.push({ monster: m, x: b.x, y: b.y, z: b.z });
      }
      // Stuck at a wall while chasing: off to one side for a moment.
      if (events.bumped && m.state === 'chase' && !(m.detour && now < m.detour.until) && Math.hypot(b.vx, b.vz) < 0.5) {
        const side = rng.chance(0.5) ? 1 : -1;
        m.detour = { x: -mz * side, z: mx * side, until: now + rng.range(700, 1500) };
      }
      if (mx || mz) m.yaw = Math.atan2(mx, mz);
      // Bumping into someone: they are knocked back, and it giggles a moment.
      // A Lava Ghost bumps nobody: its fire does the hurting (GHOST_FIRE).
      // Nor does Mr. Mole under the ground: he pops up first.
      if (now >= m.giggle && now >= (m.dazed ?? 0) && !m.passive && m.kind !== 'ghost' && !m.under) {
        for (const p of people) {
          if (p.riding || p.dizzy || now < (p.safeUntil ?? 0)) continue;
          // mount: the dragon someone rides (room.js), as wide as it is.
          if (Math.hypot(p.x - b.x, p.z - b.z) > b.radius + BUMP_PAD + (p.mount ?? 0) || sheltered(p)) continue;
          // Their feet over its top: they are jumping on it, not bumped (see
          // bop), unless it is a Spiky, which nobody lands on.
          const top = kindOf(m.kind).land ? b.height - 0.25 : b.height + 0.3;
          if (p.y > b.y + top || p.y + 1.5 < b.y) continue;
          bumps.push({ monster: m, pid: p.id });
          m.giggle = now + GIGGLE_MS;
          m.target = 0;
          m.yaw = Math.atan2(p.x - b.x, p.z - b.z);
          break;
        }
      }
    }
    return bumps;
  }

  // Where each one is, for keeping things out of it (see physics.js pushOut).
  boxes() {
    return this.list.map((m) => ({ x: m.body.x, y: m.body.y, z: m.body.z, radius: m.body.radius, height: m.body.height, key: `m${m.id}`, m }));
  }

  // Those that walked into someone, an animal or each other step back out
  // (others: boxes of the players and the animals, each with a key). Right
  // up against someone is still near enough to bump them. Those marching
  // along a tower defense road keep to it, single file.
  keepApart(world, others) {
    const boxes = this.boxes();
    const all = [...others, ...boxes];
    for (const box of boxes) {
      if (box.m.march) continue;
      const { dx, dz } = pushOut(box, all.filter((o) => o !== box), box.key);
      if (!dx && !dz) continue;
      const b = box.m.body;
      shove(world, b, dx, dz);
      [box.x, box.z] = [b.x, b.z];
    }
  }

  // One marching along its way (see add): hop by hop from one cell of the
  // road to the next, until it gets to the end of it (arrived). Stuck for a
  // while, it hops on to where it was going; into the water, it is gone.
  // along: how far it has got, in cells, for the towers to pick the one
  // furthest on.
  marchOn(world, m, dt) {
    const b = m.body;
    if (b.inWater || b.inLava || b.y < 2) {
      this.remove(m.id);
      this.gone.push(m);
      return;
    }
    const way = m.march;
    let to = way[m.leg];
    while (to && Math.hypot(to.x - b.x, to.z - b.z) < 0.75) {
      m.leg++;
      m.stuck = 0;
      to = way[m.leg];
    }
    if (!to) {
      m.arrived = true;
      m.along = way.length;
      m.state = 'idle';
      return;
    }
    const dx = to.x - b.x;
    const dz = to.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    m.along = m.leg - Math.min(1, d);
    const mx = dx / d;
    const mz = dz / d;
    m.yaw = Math.atan2(mx, mz);
    m.state = 'hop';
    // A mosquito flits along above the road, the same height all the way
    // and quicker than the hop-alongs; the others hop along it.
    if (m.kind === 'mosquito') {
      b.flying = true;
      const want = to.y + MOSQUITO_HOVER.march;
      stepBody(world, b, { mx, mz, jump: b.y < want - 0.2, down: b.y > want + 0.2, run: false }, dt, { move: { fly: 3.2, flyUp: MOSQUITO_HOVER.up } });
    } else {
      stepBody(world, b, { mx, mz, jump: b.onGround, run: false }, dt, { autoJump: true, move: m.kind === 'king' ? KING_MARCH : MARCH });
    }
    m.stuck = Math.hypot(b.vx, b.vz) < 0.4 ? m.stuck + dt : 0;
    if (m.stuck > 3) {
      m.stuck = 0;
      Object.assign(b, { x: to.x, y: Math.max(b.y, to.y), z: to.z, vx: 0, vy: 0, vz: 0 });
    }
  }

  // Whether someone with their feet at p is landing on the one numbered id.
  landsOn(id, p) {
    const m = this.get(id);
    if (!m || m.under) return null;
    const b = m.body;
    const up = p.y - b.y;
    if (up < b.height * 0.4 || up > b.height + 1.2) return null;
    return Math.hypot(p.x - b.x, p.z - b.z) <= b.radius + LAND_PAD ? m : null;
  }

  // A bop on a blob, by the player pid standing at p: a heart off it, a hop
  // back away from them, and it comes after them, crosser and quicker, for a
  // while. power: the hearts a bop takes (more with a toy weapon). Returns
  // { wait } (they tapped it a moment ago), or the hearts it has left (0: it
  // goes pop).
  hit(m, pid, p, now, power = 1) {
    if (now - (m.hits.get(pid) ?? -Infinity) < HIT_MS) return { wait: true };
    m.hits.set(pid, now);
    m.hearts = Math.max(0, m.hearts - power);
    m.hitAt = now;
    if (!m.hearts) return { hearts: 0 };
    const b = m.body;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    Object.assign(b, { vx: (dx / d) * HIT_PUSH, vz: (dz / d) * HIT_PUSH, vy: 4, onGround: false });
    m.yaw = Math.atan2(-dx, -dz);
    m.cross = now + CROSS_MS;
    if (!m.passive) m.target = pid;
    return { hearts: m.hearts };
  }

  // Whether someone at p can bop the one numbered id from where they stand:
  // as far as an arm reaches, and extra further with a toy weapon in it (see
  // shop.js).
  canBop(id, p, extra = 0) {
    const m = this.get(id);
    // Nobody bops Mr. Mole while he is under the ground: only his mound of
    // dirt is there, and that is not him.
    if (!m || m.under) return null;
    return bopGap(p, m.body, ARM_REACH + extra + BOP_SLACK) === null ? null : m;
  }

  // Compact numbers for the wire: [id, x, y, z, yaw, state, kind] in hundredths.
  pack() {
    return this.list.map((m) => [
      m.id,
      Math.round(m.body.x * 100),
      Math.round(m.body.y * 100),
      Math.round(m.body.z * 100),
      Math.round((wrap(m.yaw) + Math.PI) * 100),
      MONSTER_STATES.indexOf(m.state),
      MONSTER_KINDS.indexOf(m.kind),
      // Its hearts, and how many it had to start with, for the bar over it
      // (King Grumble's on an adventure island are adventure.js's instead).
      m.hearts,
      m.max ?? BLOB_HEARTS,
    ]);
  }
}

export function unpackMonster(row) {
  if (!Array.isArray(row) || row.length < 6 || !row.every(Number.isFinite)) return null;
  return { id: row[0], x: row[1] / 100, y: row[2] / 100, z: row[3] / 100, yaw: row[4] / 100 - Math.PI, state: MONSTER_STATES[row[5]] ?? 'idle', kind: MONSTER_KINDS[row[6]] ?? 'blob', hearts: row[7] ?? BLOB_HEARTS, max: Math.max(1, row[8] ?? BLOB_HEARTS) };
}

// HP, for one player: how much after a bump that counts n times over (0:
// home they go, and back to all of it), and how much comes back while
// nothing bumps them.
export function hpAfterBump(hp, n = 1) {
  return Math.max(0, hp - n * BUMP_HP);
}

export function hpBack(hp, max, sinceBumpMs) {
  if (hp >= max || sinceBumpMs < HP_BACK_MS) return hp;
  return Math.min(max, hp + HP_BACK);
}
