// The challenges of Adventure Isle's fourth episode, "The Golden Bells"
// (isle-story.js): Jinx the Magpie's games, in place of camps to free and a
// boss to pop. Each chapter's island has a few, each laid out on its map
// (isle-bells.js) and each opening one lock on the cage of that chapter's
// Golden Bell once it is beaten; every lock open, the cage opens and the
// stage is won (adventure.js). Nobody fights anybody. Everyone on the island
// plays every challenge together, in any order, and the host decides it all
// from where everyone is (people, as for the monsters):
//
// - finds:  shinies lying about the island, each a little item block that
//           glints (blocks.js TRINKET); walking into one picks it up.
// - climb:  a golden key at the top of something tall (blocks.js GOLD_KEY);
//           whoever gets up to it and touches it has it.
// - chase:  a monkey that has run off with a golden key: it ambles about
//           its patch until someone comes near, then dashes off, jinking
//           aside when someone is about to touch it, until it runs out of
//           puff and has to slow down for a moment. Touch it to catch it,
//           and again if the challenge says so (catches).
// - lead:   lost chicks (or sheep) all over the island, each waiting where
//           it is until someone comes up to it, then following in their
//           footsteps — and scrambling up beside them if it is stuck
//           somewhere it cannot climb out of — until it is led into its
//           coop (or fold) and settles there.
// - fires:  bonfires to light, standing by each; a bonfire lit burns only so
//           long (burn), so all of them have to burn at once — a run for one
//           person, easy for friends.
// - stones: a ring of four Singing Stones round a middle stone. Stepping into
//           the middle, the ring sings a tune, one stone after another; then
//           the stones have to be stepped on in the same order. Each round
//           the tune is a note longer (it always starts the same way), and
//           a wrong stone has it sung again.
// - jinx:   the very last, on his own island: Jinx perches up on his nest,
//           out of reach, until every beacon round it burns at once; then he
//           tumbles down, dazzled, to a spot shown beforehand, and sits there
//           a while for someone to catch him before he flies back up. Three
//           catches, and he gives up. Open only once every other challenge
//           of the chapter is beaten (after).
//
// What moves — the monkeys, the lost animals, Jinx — are the island's own
// critters (critters.js), steered from here (held) or following someone
// (follow). What changes in the world (a shiny gone, a bonfire alight) is an
// edit the room makes and tells everyone of.
import * as B from './blocks.js';
import { CRITTER_INFO, standHeight } from './critters.js';
import { Rng } from './rng.js';

// What each challenge is, at a glance.
export const QUEST_ICONS = { finds: '🔍', climb: '🧗', chase: '🐒', lead: '🐥', fires: '🔥', stones: '🎵', jinx: '🐦' };
export const questIcon = (q) => (q?.kind === 'lead' && q.animal === 'sheep' ? '🐑' : (QUEST_ICONS[q?.kind] ?? '⭐'));
// At most this many challenges on an island: one lock on the cage each, one
// of each colour (blocks.js ESCAPE_COLORS: red, yellow, green, blue).
export const MAX_QUESTS = 4;
export const LOCK_COLORS = ['#ef4b3f', '#ffd23a', '#4cc35a', '#3f7ee8'];

// Points for the stage's results (adventure.js DEEDS.play): a shiny found, a
// key reached, a catch, an animal home, a bonfire lit, a right note, a whole
// tune sung back, Jinx caught.
export const PLAY = { find: 4, top: 8, catch: 6, home: 4, light: 2, note: 1, tune: 4, jinx: 10 };

// Touching something: how near across, and how far above or below it.
const TOUCH = { reach: 1.4, up: 1.9 };
// The monkeys (see the top): how fast each goes, by the challenge's pace (1 to 3),
// in blocks a second (someone walks at 4.6, runs at 7); how long a dash lasts
// before it is puffed out, and how long it is then; how near someone has to
// come to set it off, or to make it jink aside, and how often it can; how
// near a touch catches it, counting where it was this long ago too (screens
// draw it a little late); how long it giggles after a catch, uncatchable.
export const CHASE = {
  amble: 1.5,
  dash: [5.0, 5.4, 5.8],
  dashMs: [3000, 3400, 3600],
  puffMs: [1900, 1600, 1400],
  puffed: [1.3, 1.6, 1.8],
  notice: 10,
  calm: 18,
  calmMs: 4000,
  jink: 3.2,
  jinkEvery: [2200, 1700, 1300],
  jinkMs: 320,
  jinkSpeed: 9,
  reach: 1.45,
  lag: 350,
  giggle: 2600,
  // ...and then off it springs, a head start this long before it can be
  // caught again (or whoever caught it would catch it again at once).
  headStart: 1500,
  home: 6,
};
// The lost animals: how near someone comes for one to follow them; how close
// behind them it stops; how far apart the footsteps it follows are, and how
// many it remembers; how fast it walks after them (by kind); how far down it
// will hop; how long it stands stuck before it scrambles up beside them; how
// far behind it gives up (and is lost again where it is); how fast it potters
// to its place once home.
export const LEAD = { pick: 2.4, near: 2, crumb: 0.7, trail: 240, speed: { chick: 4.3, sheep: 3.9 }, drop: 3, stuckMs: 1500, stray: 36, settle: 1.1 };
// Bonfires and beacons: how near (across, and up) lights one.
export const FIRE = { reach: 2.6, up: 3 };
// The Singing Stones: a note every gap ms as the tune is sung; a pause after
// a round, or a wrong stone, before the next is sung; a tune's first length;
// how long with nobody near before it starts over from its first round, and
// what near is.
export const STONES = { gap: 700, pause: 1500, first: 3, idleMs: 25000, near: 26 };
// Jinx: how long his tumble down takes, and his flight back up; how long he
// sits dazzled (by the challenge's pace); how near a touch catches him; how
// many catches it takes.
export const JINX = { fall: 1400, up: 1700, dazed: [9000, 8000, 7000], reach: 1.9, catches: 3 };

const pick3 = (list, pace) => list[Math.max(0, Math.min(list.length - 1, (pace ?? 1) - 1))];
const near = (p, x, y, z, reach = TOUCH.reach, up = TOUCH.up) => Math.hypot(p.x - x, p.z - z) <= reach && p.y > y - up && p.y < y + up;
const center = ([x, y, z]) => ({ x: x + 0.5, y, z: z + 0.5 });
// Who can do anything about a challenge: anyone on foot (or up on an animal),
// not flying about, not dizzy.
const able = (people) => people.filter((p) => !p.flying && !p.dizzy);

// ---------------------------------------------------------------- moving about

// Where something walking on the ground stands at (x, z), coming from height
// y: one step up at most, a drop of `drop` at most, never in the water; or null.
function footing(world, x, z, y, drop = 2.6) {
  const ny = standHeight(world, x, z, y);
  if (ny === null || ny - y > 1.05 || y - ny > drop) return null;
  const id = world.get(Math.floor(x), ny, Math.floor(z));
  if (id === B.WATER || id === B.LAVA) return null;
  // (Room to stand, not under a roof a block over its head.)
  if (B.SOLID[world.get(Math.floor(x), ny + 1, Math.floor(z))]) return null;
  return ny;
}

// Whether a monkey can go `dist` along angle a from (x, y, z), staying
// within r of (cx, cz): its footing at the end, or null.
function clearRun(world, x, y, z, a, dist, cx, cz, r) {
  let fy = y;
  const steps = Math.max(1, Math.ceil(dist / 0.5));
  for (let i = 1; i <= steps; i++) {
    const tx = x + Math.sin(a) * (dist * i) / steps;
    const tz = z + Math.cos(a) * (dist * i) / steps;
    if (Math.hypot(tx - cx, tz - cz) > r) return null;
    const ny = footing(world, tx, tz, fy);
    if (ny === null) return null;
    fy = ny;
  }
  return fy;
}

// ---------------------------------------------------------------- the challenges

export class Quests {
  // specs: as the chapter's map lays them out (isle-bells.js), in the
  // chapter's order, each { kind, x, y, z } (where its tag floats, over the
  // ground there) and what its kind needs: finds { spots: [[x, y, z]...] },
  // climb { at: [x, y, z] }, chase { r, catches, pace }, lead { animal,
  // spots, home: { x, y, z, r }, slots }, fires { fires: [[x, y, z]...],
  // burn (seconds) }, stones { pads: [[x, y, z]...] (each the middle of a
  // 3 by 3 stone, at the height someone stands on it), start: [x, y, z] (the
  // middle stone), rounds }, jinx { perch, land, fires,
  // burn, catches, pace }. story: the chapter's own (isle-story.js quests),
  // for their names and whether each waits for the rest (after).
  constructor(specs = [], story = [], seed = 1) {
    this.rng = new Rng((seed ^ 0x2545f491) >>> 0);
    // The time it last went on at (ms), for what is told of it in between.
    this.clock = 0;
    this.list = specs.slice(0, MAX_QUESTS).map((s, i) => {
      const told = story[i] ?? {};
      const q = { ...s, id: i + 1, kind: s.kind ?? told.kind, animal: s.animal ?? told.animal, who: told.who ?? null, after: Boolean(told.after ?? s.after), done: false };
      if (q.kind === 'finds') q.left = q.spots.map((_, k) => k);
      if (q.kind === 'lead') q.home = { ...q.home };
      if (q.kind === 'fires' || q.kind === 'jinx') q.until = q.fires.map(() => 0);
      if (q.kind === 'stones') {
        // Its tune, as long as its last round sings it: never the same
        // stone twice running.
        const n = STONES.first + (q.rounds ?? 3) - 1;
        q.tune = [];
        for (let k = 0; k < n; k++) {
          let s2;
          do s2 = Math.floor(this.rng.next() * q.pads.length);
          while (q.tune.length && s2 === q.tune.at(-1));
          q.tune.push(s2);
        }
        Object.assign(q, { round: 1, step: 0, phase: 'idle', at: 0, on: new Map(), quietAt: 0 });
      }
      return q;
    });
  }

  get(id) {
    return this.list.find((q) => q.id === id) ?? null;
  }

  // Whether a challenge can be played yet: open from the start, or (after)
  // once every other one is beaten.
  open(q) {
    return !q.done && (!q.after || this.list.every((o) => o === q || o.done));
  }

  get allDone() {
    return this.list.length > 0 && this.list.every((q) => q.done);
  }

  // The island's critters that play a part, put on the island: the monkeys,
  // the lost animals, Jinx. Called once, as the island is made.
  setup(world, critters) {
    for (const q of this.list) {
      if (q.kind === 'chase') {
        // (By the name the story gives it: Coco, Kiki, Bobo.)
        const c = critters.add(q.animal ?? 'monkey', q.x + 0.5, q.y, q.z + 0.5, q.who);
        if (!c) continue;
        c.held = true;
        Object.assign(q, { cid: c.id, caught: 0, mode: 'amble', modeUntil: 0, dashUntil: 0, jinkAt: 0, jink: null, trail: [], goal: null, calmAt: 0, giggleUntil: 0, heading: 0 });
      } else if (q.kind === 'lead') {
        // (Each one steered from here, lost or led, never left to wander off
        // by itself, down a drop it could not climb back up.)
        q.flock = [];
        const names = new Set();
        for (const [x, y, z] of q.spots) {
          const c = critters.add(q.animal ?? 'chick', x + 0.5, y, z + 0.5);
          if (!c) continue;
          // (Each its own name: two Fluffys lost at once cannot be told apart.)
          if (names.has(c.name)) c.name = CRITTER_INFO[c.type].names.find((n) => !names.has(n)) ?? c.name;
          names.add(c.name);
          Object.assign(c, { held: true, state: 'idle', home: { x: x + 0.5, z: z + 0.5 } });
          q.flock.push({ cid: c.id, home: false, leader: 0, trail: [], stuck: 0 });
        }
      } else if (q.kind === 'jinx') {
        const [px, py, pz] = q.perch;
        const c = critters.add('magpie', px + 0.5, py, pz + 0.5);
        if (!c) continue;
        c.held = true;
        c.state = 'idle';
        Object.assign(q, { cid: c.id, caught: 0, phase: 'perch', phaseAt: 0, trail: [] });
      }
    }
  }

  // Moves them all on by dt seconds (now in ms). people: everyone on the
  // island, as for the monsters. Returns what happened, for the room:
  // { fx: [{ id, k, ... }] (to show everyone: the room sends each as
  // { t: 'qfx', ... }), cells: [x, y, z, id, ...] (an edit for everyone),
  // done: [the challenges beaten just now], credit: [[person id, points]] }.
  step(world, dt, now, people, critters) {
    const out = { fx: [], cells: [], done: [], credit: [] };
    this.clock = now;
    const here = able(people);
    for (const q of this.list) {
      if (q.done) continue;
      const open = this.open(q);
      STEP[q.kind]?.(this, q, { world, dt, now, people: here, critters, out, open });
    }
    return out;
  }

  // A challenge beaten, by whoever is credited: told to the room.
  beat(q, out, by = []) {
    q.done = true;
    out.done.push({ quest: q, by });
  }

  // Challenges beaten before (as server/adventure.js keeps them over a
  // restart): beaten again now, with nobody there to see. Returns the edit
  // that puts the island as it would be (shinies gone, bonfires alight...).
  restore(ids, world, critters) {
    const cells = [];
    for (const id of ids) {
      const q = this.get(id);
      if (!q || q.done) continue;
      q.done = true;
      cells.push(...this.finish(q, world, critters));
    }
    return cells;
  }

  // What is left of a challenge once it is beaten (as it is, or kept from
  // before): its shinies all gone, its key gone, its monkey sat down at home,
  // its animals home, its bonfires alight for good. Returns the edit.
  finish(q, world, critters) {
    const cells = [];
    if (q.kind === 'finds') {
      for (const k of q.left ?? []) {
        const [x, y, z] = q.spots[k];
        if (B.SHINIES.includes(world.get(x, y, z))) cells.push(x, y, z, B.AIR);
      }
      q.left = [];
    } else if (q.kind === 'climb') {
      const [x, y, z] = q.at;
      if (world.get(x, y, z) === B.GOLD_KEY) cells.push(x, y, z, B.AIR);
    } else if (q.kind === 'chase') {
      const c = critters.get(q.cid);
      if (c) Object.assign(c, { held: false, x: q.x + 0.5, y: q.y, z: q.z + 0.5, home: { x: q.x + 0.5, z: q.z + 0.5 }, state: 'idle' });
    } else if (q.kind === 'lead') {
      for (const [i, f] of (q.flock ?? []).entries()) {
        const c = critters.get(f.cid);
        const slot = q.slots[i % q.slots.length];
        f.home = true;
        if (c) Object.assign(c, { follow: 0, held: true, x: slot[0] + 0.5, y: slot[1], z: slot[2] + 0.5, state: 'eat' });
      }
    } else if (q.kind === 'fires' || q.kind === 'jinx') {
      for (const [x, y, z] of q.fires) if (world.get(x, y, z) !== B.CAMPFIRE) cells.push(x, y, z, B.CAMPFIRE);
    }
    return cells;
  }

  // What everyone needs to know as they arrive: each challenge, where it is
  // and how it is going (as pack, with where its parts are).
  describe() {
    return this.list.map((q) => ({
      id: q.id,
      kind: q.kind,
      x: q.x,
      y: q.y,
      z: q.z,
      done: q.done,
      ...(q.after ? { after: true } : {}),
      ...(q.kind === 'finds' ? { spots: q.spots } : {}),
      ...(q.kind === 'climb' ? { at: q.at } : {}),
      ...(q.kind === 'chase' ? { cid: q.cid ?? 0, catches: q.catches ?? 1, r: q.r } : {}),
      ...(q.kind === 'lead' ? { animal: q.animal, home: q.home, flock: (q.flock ?? []).map((f) => f.cid) } : {}),
      ...(q.kind === 'fires' || q.kind === 'jinx' ? { fires: q.fires, burn: q.burn } : {}),
      ...(q.kind === 'stones' ? { pads: q.pads, start: q.start, rounds: q.rounds ?? 3 } : {}),
      ...(q.kind === 'jinx' ? { cid: q.cid ?? 0, perch: q.perch, land: q.land, catches: q.catches ?? JINX.catches } : {}),
      p: this.packOne(q),
    }));
  }

  // How each is going, a few times a second: [id, done (1/0), what of it is
  // done, of how many, and what changes as it goes for its kind]: the
  // seconds each bonfire has left (0, out); the Singing Stones' round and
  // whether they are singing (1) or listening (2); Jinx's catches, the
  // seconds each beacon has left, and whether he is up (0), tumbling (1),
  // dazzled (2) or flying back up (3).
  pack(now = this.clock) {
    return this.list.map((q) => this.packOne(q, now));
  }

  packOne(q, now = this.clock) {
    const left = (u) => Math.max(0, Math.ceil((u - now) / 1000));
    switch (q.kind) {
      case 'finds':
        return [q.id, q.done ? 1 : 0, q.spots.length - q.left.length, q.spots.length];
      case 'chase':
        return [q.id, q.done ? 1 : 0, q.caught ?? 0, q.catches ?? 1];
      case 'lead':
        return [q.id, q.done ? 1 : 0, (q.flock ?? []).filter((f) => f.home).length, (q.flock ?? []).length];
      case 'fires':
        return [q.id, q.done ? 1 : 0, q.until.filter((u) => u > now).length, q.fires.length, ...(q.done ? [] : q.until.map(left))];
      case 'stones':
        return [q.id, q.done ? 1 : 0, q.done ? (q.rounds ?? 3) : q.round - 1, q.rounds ?? 3, q.phase === 'show' ? 1 : q.phase === 'listen' ? 2 : 0];
      case 'jinx':
        return [q.id, q.done ? 1 : 0, q.caught ?? 0, q.catches ?? JINX.catches, { perch: 0, fall: 1, dazed: 2, up: 3 }[q.phase] ?? 0, ...(q.done ? [] : q.until.map(left))];
      default:
        return [q.id, q.done ? 1 : 0, q.done ? 1 : 0, 1];
    }
  }
}

// ---------------------------------------------------------------- each kind

const STEP = {
  // Shinies: walking into one picks it up, for everyone.
  finds(qs, q, { world, people, out }) {
    for (const k of [...q.left]) {
      const at = center(q.spots[k]);
      const who = people.find((p) => near(p, at.x, at.y, at.z));
      if (!who) continue;
      q.left.splice(q.left.indexOf(k), 1);
      const [x, y, z] = q.spots[k];
      if (B.SHINIES.includes(world.get(x, y, z))) out.cells.push(x, y, z, B.AIR);
      out.credit.push([who.id, PLAY.find]);
      out.fx.push({ id: q.id, k: 'found', at: q.spots[k], by: who.id, n: q.spots.length - q.left.length, of: q.spots.length });
      if (!q.left.length) qs.beat(q, out, [who.id]);
    }
  },

  // The key at the top: whoever touches it has it.
  climb(qs, q, { world, people, out }) {
    const at = center(q.at);
    const who = people.find((p) => near(p, at.x, at.y, at.z));
    if (!who) return;
    const [x, y, z] = q.at;
    if (world.get(x, y, z) === B.GOLD_KEY) out.cells.push(x, y, z, B.AIR);
    out.credit.push([who.id, PLAY.top]);
    out.fx.push({ id: q.id, k: 'top', at: q.at, by: who.id });
    qs.beat(q, out, [who.id]);
  },

  // The monkey (see the top).
  chase(qs, q, { world, dt, now, people, critters, out }) {
    const c = critters.get(q.cid);
    if (!c) return;
    const pace = q.pace ?? 1;
    // Where it has been just now: a touch on any of those catches it.
    q.trail.push({ x: c.x, y: c.y, z: c.z, at: now });
    while (q.trail.length && now - q.trail[0].at > CHASE.lag) q.trail.shift();
    if (now < q.giggleUntil) {
      c.state = 'happy';
      return;
    }
    if (q.giggled) {
      q.giggled = false;
      Object.assign(q, { mode: 'dash', modeUntil: now + pick3(CHASE.dashMs, pace), safeUntil: now + CHASE.headStart, calmAt: 0 });
      out.fx.push({ id: q.id, k: 'flee', cid: c.id });
    }
    const catcher = now >= (q.safeUntil ?? 0) ? people.find((p) => q.trail.some((t) => near(p, t.x, t.y, t.z, CHASE.reach, TOUCH.up))) : null;
    if (catcher) {
      q.caught++;
      q.giggleUntil = now + CHASE.giggle;
      Object.assign(q, { mode: 'amble', jink: null, goal: null, calmAt: 0, giggled: true });
      c.state = 'happy';
      c.yaw = Math.atan2(catcher.x - c.x, catcher.z - c.z);
      out.credit.push([catcher.id, PLAY.catch]);
      out.fx.push({ id: q.id, k: 'caught', cid: c.id, by: catcher.id, n: q.caught, of: q.catches ?? 1, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) });
      if (q.caught >= (q.catches ?? 1)) {
        qs.beat(q, out, [catcher.id]);
        // Done running: it potters about where it was caught, happy.
        Object.assign(c, { held: false, home: { x: c.x, z: c.z }, happyUntil: now + CHASE.giggle, state: 'happy' });
      }
      return;
    }
    const chasers = people.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < CHASE.notice && Math.abs(p.y - c.y) < 6);
    const close = people.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < CHASE.calm);
    if (chasers.length && q.mode === 'amble') {
      Object.assign(q, { mode: 'dash', modeUntil: now + pick3(CHASE.dashMs, pace) });
      out.fx.push({ id: q.id, k: 'flee', cid: c.id });
    }
    if (q.mode !== 'amble') {
      if (close.length) q.calmAt = 0;
      else if (!q.calmAt) q.calmAt = now;
      else if (now - q.calmAt > CHASE.calmMs) Object.assign(q, { mode: 'amble', goal: null, calmAt: 0 });
    }
    if (q.mode === 'dash' && now >= q.modeUntil) {
      Object.assign(q, { mode: 'puff', modeUntil: now + pick3(CHASE.puffMs, pace) });
      out.fx.push({ id: q.id, k: 'puff', cid: c.id });
    } else if (q.mode === 'puff' && now >= q.modeUntil) {
      Object.assign(q, { mode: chasers.length ? 'dash' : 'amble', modeUntil: now + pick3(CHASE.dashMs, pace) });
    }
    const cx = q.x + 0.5;
    const cz = q.z + 0.5;
    const R = q.r ?? 14;
    if (q.mode === 'amble') {
      // Pottering about its patch, now and then sitting a while.
      if (!q.goal || now > q.goal.until) {
        const a = qs.rng.range(-Math.PI, Math.PI);
        const d = qs.rng.range(1, CHASE.home);
        q.goal = qs.rng.chance(0.35) ? { sit: true, until: now + qs.rng.range(1500, 4000) } : { x: cx + Math.sin(a) * d, z: cz + Math.cos(a) * d, until: now + 6000 };
      }
      if (q.goal.sit) {
        c.state = 'idle';
        return;
      }
      walkToward(world, c, q.goal.x, q.goal.z, CHASE.amble * dt, cx, cz, R + 2) || (q.goal = null);
      c.state = 'walk';
      return;
    }
    // Running away: whoever is nearest.
    let nearest = null;
    let nd = Infinity;
    for (const p of chasers) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < nd) {
        nd = d;
        nearest = p;
      }
    }
    const speed = pick3(q.mode === 'puff' ? CHASE.puffed : CHASE.dash, pace);
    // A jink aside: someone about to touch it, now and then.
    if (nearest && nd < CHASE.jink && !q.jink && now >= q.jinkAt) {
      const side = qs.rng.chance(0.5) ? 1 : -1;
      const away = Math.atan2(c.x - nearest.x, c.z - nearest.z);
      for (const s of [side, -side]) {
        const a = away + s * 1.35;
        if (clearRun(world, c.x, c.y, c.z, a, CHASE.jinkSpeed * CHASE.jinkMs / 1000, cx, cz, R + 2) !== null) {
          q.jink = { a, until: now + CHASE.jinkMs };
          q.jinkAt = now + pick3(CHASE.jinkEvery, pace);
          // (Where it was is no use to anyone now: it is not there.)
          q.trail.length = 0;
          out.fx.push({ id: q.id, k: 'jink', cid: c.id });
          break;
        }
      }
    }
    if (q.jink) {
      if (now >= q.jink.until) q.jink = null;
      else {
        moveAlong(world, c, q.jink.a, CHASE.jinkSpeed * dt, cx, cz, R + 2);
        c.state = 'hop';
        return;
      }
    }
    // Of sixteen ways round, the one clear of anything in the way that
    // leaves it furthest from everyone after it once it has gone a little
    // way along it — keeping off the edge of its patch (where it would be
    // cornered), and to the way it was going when that is about as good.
    // (Steering away from where they are now, not from where it will be,
    // runs it into the edge and into their arms.)
    const look = Math.max(2, speed * 0.7);
    let best = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      if (clearRun(world, c.x, c.y, c.z, a, look, cx, cz, R) === null) continue;
      const px = c.x + Math.sin(a) * look;
      const pz = c.z + Math.cos(a) * look;
      let d = Infinity;
      for (const p of chasers) d = Math.min(d, Math.hypot(px - p.x, pz - p.z));
      const room = R - Math.hypot(px - cx, pz - cz);
      const score = Math.min(d, 14) - Math.max(0, 4.5 - room) * 2.5 + Math.cos(a - q.heading) * 0.6;
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (best === null) {
      // Cornered: nowhere to go but where it is.
      c.state = 'idle';
      return;
    }
    q.heading = best;
    moveAlong(world, c, best, speed * dt, cx, cz, R + 2);
    // (Puffed out, it is shown so: 'slide', which a monkey has no other use for.)
    c.state = q.mode === 'puff' ? 'slide' : 'run';
  },

  // The lost animals.
  lead(qs, q, { world, dt, now, people, critters, out }) {
    const h = q.home;
    let left = 0;
    for (const [i, f] of q.flock.entries()) {
      const c = critters.get(f.cid);
      if (!c) continue;
      if (f.home) {
        // Pottering to its place in the coop, then pecking about there.
        const [sx, sy, sz] = q.slots[i % q.slots.length];
        const d = Math.hypot(sx + 0.5 - c.x, sz + 0.5 - c.z);
        if (d > 0.15) {
          walkToward(world, c, sx + 0.5, sz + 0.5, LEAD.settle * dt, h.x, h.z, h.r + 2, true);
          c.state = 'walk';
        } else {
          c.y = sy;
          c.state = Math.sin(now / 1700 + i * 1.3) > 0 ? 'eat' : 'idle';
        }
        continue;
      }
      left++;
      // Home: in the coop.
      if (Math.hypot(c.x - h.x, c.z - h.z) <= h.r && Math.abs(c.y - h.y) < 2.5) {
        const by = f.leader;
        Object.assign(f, { home: true, leader: 0, trail: [], stuck: 0 });
        left--;
        if (by) out.credit.push([by, PLAY.home]);
        out.fx.push({ id: q.id, k: 'home', cid: c.id, by, n: q.flock.filter((o) => o.home).length, of: q.flock.length });
        continue;
      }
      // Lost, and waiting where it is (pecking about, or grazing), until
      // someone comes up to it.
      if (!f.leader) {
        c.state = Math.sin(now / 2300 + i * 1.7) > 0.2 ? 'eat' : 'idle';
        const who = people.find((p) => Math.hypot(p.x - c.x, p.z - c.z) <= LEAD.pick && Math.abs(p.y - c.y) < 2);
        if (!who) continue;
        Object.assign(f, { leader: who.id, trail: [], stuck: 0 });
        c.yaw = Math.atan2(who.x - c.x, who.z - c.z);
        out.fx.push({ id: q.id, k: 'follow', cid: c.id, by: who.id });
        continue;
      }
      // Following someone: until they go too far ahead (or away).
      const leader = people.find((p) => p.id === f.leader);
      if (!leader || Math.hypot(leader.x - c.x, leader.z - c.z) > LEAD.stray) {
        out.fx.push({ id: q.id, k: 'lost', cid: c.id, by: f.leader });
        Object.assign(f, { leader: 0, trail: [], stuck: 0 });
        c.state = 'idle';
        continue;
      }
      // In their footsteps: where they have been is a way that can be walked
      // (straight at them can be up a cliff, or over the sea).
      const last = f.trail.at(-1);
      if (!last || Math.hypot(leader.x - last.x, leader.z - last.z) >= LEAD.crumb || Math.abs(leader.y - last.y) > 0.6) f.trail.push({ x: leader.x, y: leader.y, z: leader.z });
      if (f.trail.length > LEAD.trail) f.trail.shift();
      if (Math.hypot(leader.x - c.x, leader.z - c.z) <= LEAD.near && Math.abs(leader.y - c.y) < 1.6) {
        // Close behind them: it waits, minding their footsteps to follow on
        // in (all but a loop of them that came back round by it).
        const by = f.trail.findLastIndex((t) => Math.hypot(t.x - c.x, t.z - c.z) < 0.9 && Math.abs(t.y - c.y) < 1.2);
        if (by > 0) f.trail.splice(0, by);
        f.stuck = 0;
        c.state = 'idle';
        c.yaw = Math.atan2(leader.x - c.x, leader.z - c.z);
        continue;
      }
      // Along them, step by step, as far as it walks in the time.
      let step = (LEAD.speed[q.animal] ?? 4) * dt;
      let moved = false;
      for (let n = 0; n < 8 && step > 0.01; n++) {
        while (f.trail.length > 1 && Math.hypot(f.trail[0].x - c.x, f.trail[0].z - c.z) < 0.1) f.trail.shift();
        const to = f.trail[0];
        const d = Math.hypot(to.x - c.x, to.z - c.z);
        if (d < 0.1) break;
        const [x, z] = [c.x, c.z];
        if (!trudge(world, c, to.x, to.z, Math.min(step, d), LEAD.drop)) break;
        moved = true;
        step -= Math.hypot(c.x - x, c.z - z);
      }
      if (moved) {
        f.stuck = 0;
        c.state = 'walk';
        continue;
      }
      // No way on from here (a step too high for it, a drop too deep, water
      // where they swam): stuck a moment, and then it scrambles up after them
      // rather than stay stuck.
      c.state = 'idle';
      f.stuck ||= now;
      if (now - f.stuck < LEAD.stuckMs) continue;
      const spot = scrambleTo(world, f, leader, c);
      if (!spot) continue;
      out.fx.push({ id: q.id, k: 'scramble', cid: c.id, from: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], to: [+spot.x.toFixed(2), +spot.y.toFixed(2), +spot.z.toFixed(2)] });
      Object.assign(c, { x: spot.x, y: spot.y, z: spot.z, yaw: Math.atan2(leader.x - spot.x, leader.z - spot.z) });
      f.stuck = 0;
    }
    if (!left && q.flock.length) qs.beat(q, out, []);
  },

  // Bonfires: lit by standing by them, out again once their time is up, and
  // all alight at once, alight for good.
  fires(qs, q, { world, now, people, out }) {
    lightFires(q, world, now, people, out);
    if (q.until.every((u) => u > now)) {
      qs.beat(q, out, []);
      for (let i = 0; i < q.until.length; i++) q.until[i] = Infinity;
    }
  },

  // The Singing Stones (see the top).
  stones(qs, q, { now, people, out }) {
    const near_ = people.filter((p) => Math.hypot(p.x - q.start[0] - 0.5, p.z - q.start[2] - 0.5) < STONES.near);
    if (!near_.length) {
      q.quietAt ||= now;
      if (now - q.quietAt > STONES.idleMs && (q.phase !== 'idle' || q.round > 1)) Object.assign(q, { phase: 'idle', round: 1, step: 0 });
      q.on.clear();
      return;
    }
    q.quietAt = 0;
    // Which stone each person stands on now (-1 none, -2 the middle one),
    // and who has just stepped onto one.
    const stepped = [];
    const seen = new Set();
    for (const p of near_) {
      seen.add(p.id);
      const at = padUnder(q, p);
      if (at !== q.on.get(p.id)) {
        q.on.set(p.id, at);
        if (at !== -1) stepped.push([p, at]);
      }
    }
    for (const id of [...q.on.keys()]) if (!seen.has(id)) q.on.delete(id);
    const length = STONES.first + q.round - 1;
    if (q.phase === 'idle') {
      if (stepped.some(([, at]) => at === -2)) sing(q, now, out);
      return;
    }
    if (q.phase === 'show') {
      if (now >= q.at) Object.assign(q, { phase: 'listen', step: 0 });
      return;
    }
    if (q.phase === 'pause') {
      if (now >= q.at) sing(q, now, out);
      return;
    }
    // Listening: each stone stepped on, the next note of the tune or not.
    for (const [p, at] of stepped) {
      if (at === -2) continue;
      if (at === q.tune[q.step]) {
        q.step++;
        out.credit.push([p.id, PLAY.note]);
        out.fx.push({ id: q.id, k: 'note', pad: at, by: p.id, n: q.step, of: length });
        if (q.step < length) continue;
        out.credit.push(...near_.map((o) => [o.id, PLAY.tune]));
        if (q.round >= (q.rounds ?? 3)) {
          out.fx.push({ id: q.id, k: 'sung', n: q.round, of: q.rounds ?? 3 });
          qs.beat(q, out, near_.map((o) => o.id));
          return;
        }
        q.round++;
        Object.assign(q, { phase: 'pause', at: now + STONES.pause, step: 0 });
        out.fx.push({ id: q.id, k: 'round', n: q.round, of: q.rounds ?? 3 });
        return;
      }
      out.fx.push({ id: q.id, k: 'oops', pad: at, by: p.id });
      Object.assign(q, { phase: 'pause', at: now + STONES.pause, step: 0 });
      return;
    }
  },

  // Jinx (see the top).
  jinx(qs, q, { world, now, people, critters, out, open }) {
    const c = critters.get(q.cid);
    if (!c) return;
    const [px, py, pz] = q.perch;
    const [lx, ly, lz] = q.land;
    const pace = q.pace ?? 1;
    q.trail.push({ x: c.x, y: c.y, z: c.z, at: now });
    while (q.trail.length && now - q.trail[0].at > CHASE.lag) q.trail.shift();
    if (q.phase === 'perch') {
      Object.assign(c, { x: px + 0.5, y: py, z: pz + 0.5, state: 'idle' });
      // Looking down at whoever is about.
      const p = people.reduce((a, b) => (!a || Math.hypot(b.x - c.x, b.z - c.z) < Math.hypot(a.x - c.x, a.z - c.z) ? b : a), null);
      if (p) c.yaw = Math.atan2(p.x - c.x, p.z - c.z);
      if (!open) return;
      lightFires(q, world, now, people, out);
      if (q.until.every((u) => u > now)) {
        Object.assign(q, { phase: 'fall', phaseAt: now });
        out.fx.push({ id: q.id, k: 'dazzle', cid: c.id, land: q.land, ms: JINX.fall });
      }
      return;
    }
    if (q.phase === 'fall') {
      const t = Math.min(1, (now - q.phaseAt) / JINX.fall);
      // A tumble down: out and over in a curve, faster as it goes.
      Object.assign(c, { x: px + 0.5 + (lx - px) * t, z: pz + 0.5 + (lz - pz) * t, y: py + (ly - py) * t * t + Math.sin(t * Math.PI) * 1.5, state: 'fly' });
      if (t >= 1) {
        Object.assign(q, { phase: 'dazed', phaseAt: now });
        Object.assign(c, { x: lx + 0.5, y: ly, z: lz + 0.5, state: 'sleep' });
        out.fx.push({ id: q.id, k: 'dazed', cid: c.id, ms: pick3(JINX.dazed, pace) });
      }
      return;
    }
    if (q.phase === 'dazed') {
      const catcher = people.find((p) => q.trail.some((s) => near(p, s.x, s.y, s.z, JINX.reach, TOUCH.up)));
      const over = now - q.phaseAt >= pick3(JINX.dazed, pace);
      if (!catcher && !over) return;
      // Caught (or up again before anyone could): back up to the nest he
      // flies, the beacons go out, and it all starts again.
      if (catcher) {
        q.caught++;
        out.credit.push([catcher.id, PLAY.jinx]);
      }
      out.fx.push({ id: q.id, k: catcher ? 'caught' : 'escaped', cid: c.id, by: catcher?.id ?? 0, n: q.caught, of: q.catches ?? JINX.catches });
      for (const [i, [x, y, z]] of q.fires.entries()) {
        q.until[i] = 0;
        if (world.get(x, y, z) === B.CAMPFIRE) out.cells.push(x, y, z, B.LOGS);
      }
      if (q.caught >= (q.catches ?? JINX.catches)) {
        qs.beat(q, out, catcher ? [catcher.id] : []);
        c.state = 'happy';
        return;
      }
      Object.assign(q, { phase: 'up', phaseAt: now });
      return;
    }
    if (q.phase === 'up') {
      const t = Math.min(1, (now - q.phaseAt) / JINX.up);
      const e = t * t * (3 - 2 * t);
      Object.assign(c, { x: lx + 0.5 + (px - lx) * e, z: lz + 0.5 + (pz - lz) * e, y: ly + (py - ly) * e + Math.sin(t * Math.PI) * 3, state: 'fly' });
      c.yaw = Math.atan2(px - lx, pz - lz);
      if (t >= 1) Object.assign(q, { phase: 'perch', phaseAt: now });
    }
  },
};

// Bonfires (or Jinx's beacons) lit by whoever stands by one, out again once
// their time is up.
function lightFires(q, world, now, people, out) {
  for (const [i, [x, y, z]] of q.fires.entries()) {
    const lit = q.until[i] > now;
    const by = people.find((p) => near(p, x + 0.5, y, z + 0.5, FIRE.reach, FIRE.up));
    if (by) {
      if (!lit) {
        if (world.get(x, y, z) !== B.CAMPFIRE) out.cells.push(x, y, z, B.CAMPFIRE);
        out.credit.push([by.id, PLAY.light]);
        out.fx.push({ id: q.id, k: 'lit', fire: i, by: by.id });
      }
      q.until[i] = now + (q.burn ?? 30) * 1000;
    } else if (!lit && q.until[i] > 0) {
      // Burnt down to its logs again.
      q.until[i] = 0;
      if (world.get(x, y, z) === B.CAMPFIRE) out.cells.push(x, y, z, B.LOGS);
      out.fx.push({ id: q.id, k: 'out', fire: i });
    }
  }
}

// The stone someone stands on: its number, -2 for the middle one, -1 none.
function padUnder(q, p) {
  const x = Math.floor(p.x);
  const z = Math.floor(p.z);
  const on = (c) => Math.abs(x - c[0]) <= 1 && Math.abs(z - c[2]) <= 1 && p.y > c[1] - 0.6 && p.y < c[1] + 1.6;
  if (on(q.start)) return -2;
  return q.pads.findIndex(on);
}

// The ring singing its tune, as long as the round it is on.
function sing(q, now, out) {
  const length = STONES.first + q.round - 1;
  const tune = q.tune.slice(0, length);
  Object.assign(q, { phase: 'show', at: now + STONES.gap * (length + 0.5), step: 0 });
  out.fx.push({ id: q.id, k: 'tune', tune, gap: STONES.gap, n: q.round, of: q.rounds ?? 3 });
}

// A held critter walked towards (tx, tz) by up to `step`, on ground it can
// stand on and within r of (cx, cz): false once it can go no further.
// inside: no step up at all (in a coop, its fence is its fence).
function walkToward(world, c, tx, tz, step, cx, cz, r, inside = false, drop = 2.6) {
  const dx = tx - c.x;
  const dz = tz - c.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return false;
  const s = Math.min(d, step);
  const nx = c.x + (dx / d) * s;
  const nz = c.z + (dz / d) * s;
  const ny = footing(world, nx, nz, c.y, drop);
  c.yaw = Math.atan2(dx, dz);
  if (ny === null || Math.hypot(nx - cx, nz - cz) > r || (inside && ny > c.y + 0.5)) return false;
  Object.assign(c, { x: nx, y: ny, z: nz });
  return true;
}

// A held animal's step toward (tx, tz): straight there if it can, or else
// along whichever of the two ways across is open (round the corner of a wall
// it clipped), but never down off an edge that way. Whether it moved.
function trudge(world, c, tx, tz, step, drop) {
  if (walkToward(world, c, tx, tz, step, c.x, c.z, Infinity, false, drop)) return true;
  const dx = tx - c.x;
  const dz = tz - c.z;
  for (const across of Math.abs(dx) >= Math.abs(dz) ? [true, false] : [false, true]) {
    const s = Math.min(step, Math.abs(across ? dx : dz));
    if (s < 0.02) continue;
    const nx = across ? c.x + Math.sign(dx) * s : c.x;
    const nz = across ? c.z : c.z + Math.sign(dz) * s;
    const ny = footing(world, nx, nz, c.y, 1);
    if (ny === null) continue;
    Object.assign(c, { x: nx, y: ny, z: nz });
    return true;
  }
  return false;
}

// Where a stuck animal scrambles to: back along its leader's footsteps a
// couple of steps behind them (somewhere they have just walked, so it can
// follow on from there), past the one it is stuck short of; or else
// anywhere beside them. Drops the footsteps it skips.
function scrambleTo(world, f, leader, c) {
  let behind = Math.hypot(leader.x - (f.trail.at(-1)?.x ?? leader.x), leader.z - (f.trail.at(-1)?.z ?? leader.z));
  for (let i = f.trail.length - 1; i >= 1 && behind <= 6; i--) {
    const t = f.trail[i];
    if (i < f.trail.length - 1) behind += Math.hypot(f.trail[i + 1].x - t.x, f.trail[i + 1].z - t.z);
    if (behind < 1.4) continue;
    const y = footing(world, t.x, t.z, t.y, LEAD.drop);
    if (y === null) continue;
    f.trail.splice(0, i + 1);
    return { x: t.x, y, z: t.z };
  }
  f.trail.length = 0;
  return beside(world, leader, c);
}

// A spot to stand right beside someone (p) — behind them, as seen from where
// c is, or else any side — on ground about their height, dry, with room; or null.
function beside(world, p, c) {
  const back = Math.atan2(c.x - p.x, c.z - p.z);
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5, Math.PI]) {
    for (const d of [1.4, 2]) {
      const x = p.x + Math.sin(back + turn) * d;
      const z = p.z + Math.cos(back + turn) * d;
      const y = footing(world, x, z, p.y, 1.2);
      if (y !== null && Math.abs(y - p.y) <= 1.2) return { x, y, z };
    }
  }
  return null;
}

// A held critter moved `step` along angle a, if it can be.
function moveAlong(world, c, a, step, cx, cz, r) {
  return walkToward(world, c, c.x + Math.sin(a) * step * 1.0001, c.z + Math.cos(a) * step * 1.0001, step, cx, cz, r);
}
