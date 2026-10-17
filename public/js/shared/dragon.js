// The dragon fight: a volcano island's own dragon is wild. It sleeps near
// the crater until someone comes near, then wakes up, stomps after them and
// breathes fire: it rears back a moment (long enough to see it coming), then
// a cone of flames pours out in front of it, the way it faced as it reared,
// and burns whoever is in it. Bop it (the 👊 button, or X; a toy weapon
// hits harder) until its hearts are gone and it is tired out: then it is
// tamed, and anyone may climb on and ride it. Everyone who bopped it in
// that fight has tamed it once more (counted in their gear, shop.js); tame
// it TAMES_TO_INVITE times and a dragon of your own is yours to bring from
// the toy box to any island — one of those is tame from the start, and
// never fights.
//
// Tamed, it stays tame while anyone rides it and a while after; then, alone
// again, it goes wild and back to sleep, ready to be tamed again. Left alone
// in a fight it gets its hearts back, and with nobody near it goes back to
// sleep. Nobody gets hurt for long: HP comes back as ever, and riding
// anything, sitting dizzy or in a tent, the flames never reach you.
//
// The host runs it (room.js), on the dragon's critter (c.fight), and the
// critters move it (critters.js stepBig: asleep, chasing c.fight.chase, or
// standing still to breathe). Never saved: an island opened again has its
// dragon wild and asleep.

// How many hearts it has, and how close you get before it wakes, and how far
// you get before it gives up on you.
export const DRAGON_HEARTS = 16;
export const WAKE = 10;
const GIVE_UP = 22;
// With nobody near for this long it goes back to sleep; left alone in a
// fight (no bop for this long) it has all its hearts again.
const SLEEP_MS = 8000;
const HEAL_MS = 12000;
// Fire: the first breath this long after it wakes, then one every FIRE_EVERY;
// it rears back for FIRE_WINDUP first, and the flames pour for FIRE_MS, as
// far as FIRE_REACH in front of its middle, in a cone FIRE_ANGLE either side.
// Each breath burns each player once, for FIRE_BUMPS bumps' worth of HP
// (monsters.js BUMP_HP): half that in Knight Armor or a Fire Suit.
export const FIRE = { first: 1800, every: 3400, windup: 850, ms: 1300, reach: 9, angle: 0.5, bumps: 1.5 };
// It stomps after whoever it is after until it is this near them.
export const CHASE_NEAR = 5;
// Each friend can bop it once in this long (as a monster, monsters.js HIT_MS).
const HIT_MS = 400;
// Tamed, it stays tame this long once nobody rides it.
export const TAME_MS = 60000;
// How many times you tame the dragon to bring one of your own from the toy box.
export const TAMES_TO_INVITE = 10;
// New moods go on the end: the wire sends the index (critters.js pack).
export const MOODS = ['asleep', 'awake', 'tame'];

const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

// Whether this is a wild dragon: the island's own, not one brought from the toy box.
export const isWild = (c) => c?.type === 'dragon' && !c.tame;

// Its fight, made the first time it is asked for.
export function fightOf(c) {
  if (!c.fight) c.fight = fresh();
  return c.fight;
}

const fresh = () => ({ mood: 'asleep', hearts: DRAGON_HEARTS, max: DRAGON_HEARTS, target: 0, chase: null, fireAt: 0, windup: 0, breath: 0, yaw: 0, burned: new Set(), hits: new Map(), hitAt: 0, fighters: new Set(), alone: 0, tameAt: 0 });

// Whether someone can climb on: only once it is tamed (or one brought tame).
export const canRide = (c) => !isWild(c) || fightOf(c).mood === 'tame';

// Whether a point (x, y, z) is in the flames of a breath from c, facing yaw.
export function inFlames(c, yaw, x, y, z) {
  const dx = x - c.x;
  const dz = z - c.z;
  const d = Math.hypot(dx, dz);
  if (d > FIRE.reach || y < c.y - 3 || y > c.y + 5) return false;
  if (d < 1.2) return true;
  return Math.abs(wrap(Math.atan2(dx, dz) - yaw)) <= FIRE.angle;
}

// One step of every wild dragon's fight. people: the players on the island,
// as { id, x, y, z, riding, dizzy, sheltered }. Returns what happened, for
// the host to tell everyone: { woke: [c], fires: [{ c, yaw }], burns: [{ c,
// pid }], slept: [c], wild: [c] } (wild: tame ones gone wild again).
export function stepDragons(critters, people, now) {
  const out = { woke: [], fires: [], burns: [], slept: [], wild: [] };
  for (const c of critters.list) {
    if (!isWild(c)) continue;
    const f = fightOf(c);
    if (f.mood === 'tame') {
      if (c.rider) f.tameAt = now;
      else if (now - f.tameAt >= TAME_MS) {
        c.fight = fresh();
        out.wild.push(c);
      }
      continue;
    }
    // Someone it could go after: not riding, nor dizzy, nor in a tent.
    const fair = (p) => !p.riding && !p.dizzy && !p.sheltered;
    const dist = (p) => Math.hypot(p.x - c.x, p.z - c.z);
    if (f.mood === 'asleep') {
      const near = people.find((p) => fair(p) && dist(p) < WAKE && Math.abs(p.y - c.y) < 8);
      if (!near) continue;
      wake(c, near.id, now);
      out.woke.push(c);
    }
    let target = people.find((p) => p.id === f.target) ?? null;
    if (target && (!fair(target) || dist(target) > GIVE_UP)) target = null;
    if (!target) {
      let best = GIVE_UP;
      for (const p of people) {
        if (fair(p) && dist(p) < best) {
          best = dist(p);
          target = p;
        }
      }
    }
    f.target = target?.id ?? 0;
    f.alone = target ? 0 : f.alone || now;
    if (f.hitAt && now - f.hitAt >= HEAL_MS) {
      f.hearts = f.max;
      f.hitAt = 0;
      f.fighters.clear();
    }
    // Nobody about for a while (and not mid-breath): back to sleep, with all its hearts.
    if (!target && f.alone && now - f.alone >= SLEEP_MS && !f.windup && !f.breath) {
      c.fight = fresh();
      out.slept.push(c);
      continue;
    }
    // Rearing back, then the flames: it stands still for both.
    if (f.windup) {
      f.chase = null;
      if (now >= f.windup) {
        f.windup = 0;
        f.breath = now + FIRE.ms;
        f.burned.clear();
        out.fires.push({ c, yaw: f.yaw });
      }
      continue;
    }
    if (f.breath) {
      f.chase = null;
      for (const p of people) {
        if (f.burned.has(p.id) || !fair(p) || !inFlames(c, f.yaw, p.x, p.y, p.z)) continue;
        f.burned.add(p.id);
        out.burns.push({ c, pid: p.id });
      }
      if (now >= f.breath) {
        f.breath = 0;
        f.fireAt = now + FIRE.every;
      }
      continue;
    }
    if (!target) {
      f.chase = null;
      continue;
    }
    const d = dist(target);
    const face = Math.atan2(target.x - c.x, target.z - c.z);
    f.chase = d > CHASE_NEAR ? { x: target.x, z: target.z } : { face };
    if (now >= f.fireAt && d < FIRE.reach + 2) {
      f.windup = now + FIRE.windup;
      f.yaw = face;
      c.yaw = face;
      f.chase = null;
    }
  }
  return out;
}

function wake(c, pid, now) {
  const f = fightOf(c);
  f.mood = 'awake';
  f.target = pid;
  f.fireAt = now + FIRE.first;
  f.alone = 0;
}

// A bop on a wild dragon by the player pid (power: the hearts it takes, more
// with a toy weapon). It wakes if it was asleep and turns on them. Returns
// { wait } (they bopped it a moment ago), null (it is not to be bopped:
// tame already), or { hearts, max, woke, tamed } — tamed: it has none left,
// and is tame now, with fighters (the pids of all who bopped it this fight).
export function hitDragon(c, pid, now, power = 1) {
  if (!isWild(c)) return null;
  const f = fightOf(c);
  if (f.mood === 'tame') return null;
  if (now - (f.hits.get(pid) ?? -Infinity) < HIT_MS) return { wait: true };
  f.hits.set(pid, now);
  const woke = f.mood === 'asleep';
  if (woke) wake(c, pid, now);
  f.target = pid;
  f.fighters.add(pid);
  f.hearts = Math.max(0, f.hearts - Math.max(1, power));
  f.hitAt = now;
  if (f.hearts) return { hearts: f.hearts, max: f.max, woke };
  const fighters = [...f.fighters];
  c.fight = { ...fresh(), mood: 'tame', hearts: 0, tameAt: now };
  c.happyUntil = now + 2500;
  return { hearts: 0, max: f.max, woke, tamed: true, fighters };
}

// What the wire carries of a dragon's fight (critters.js pack): its mood,
// hearts and how many it had. Null for any other critter.
export function packFight(c) {
  if (c.type !== 'dragon') return null;
  if (c.tame) return [MOODS.indexOf('tame'), 0, DRAGON_HEARTS];
  const f = fightOf(c);
  return [MOODS.indexOf(f.mood), f.hearts, f.max];
}
