// Monsters: an island rule the owner can turn on (off unless they do).
// Grumpy little jelly blobs hop out of the bushes, more of them at night,
// and come after whoever is near. One that bumps into you knocks you back
// and takes a heart; with no hearts left you pop back home with them all
// again. Tap one, or jump on it, and it goes pop.
//
// Nobody gets hurt: hearts come back by themselves, the start of the island
// is a safe place no monster goes into, and they cannot swim, reach someone
// riding an animal or catch anyone who runs.
//
// The host moves them (Room.tick); everyone sees them a few times a second,
// as they see the animals. They are never saved: turning monsters off, or
// opening the island again, starts it without any.
import * as B from './blocks.js';
import { makeBody, stepBody } from './physics.js';
import { Rng } from './rng.js';

export const MAX_HEARTS = 5;
// A heart back this long after the last bump, and every this long after that.
export const HEART_BACK_MS = 6000;
// After a bump, a moment when nothing can bump you again.
export const SAFE_MS = 1600;
// How far round the island's start a monster never goes.
export const SAFE_RADIUS = 9;
// How many there are for each player on the island, by day and at night,
// and never more than this many on the whole island.
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
// Off by itself this far from everyone for this long, it goes away.
const LONELY = 44;
const LONELY_MS = 15000;
// Hopping about: slower than you walk (4.6), much slower than you run (7);
// a hop gets it up a step a block high, never two.
const MOVE = { walk: 1.6, run: 3.4, jump: 8 };
// Its size: as wide as it is round, and up to a player's middle.
export const MONSTER_BODY = { radius: 0.42, height: 0.8 };
// Bumping: how close (between middles, side to side) and how long it stops
// to giggle after.
const BUMP_REACH = MONSTER_BODY.radius + 0.38;
const GIGGLE_MS = 1400;
// Tapping one: from this far (from your eyes; nearer than a tool reaches, so
// you have to go up to one), and the host lets a little more through, as a
// monster on the move is a little further on there than on your screen.
export const TAP_REACH = 7.5;
export const BOP_REACH = TAP_REACH + 1.5;

// New states go on the end: the wire sends the index.
export const MONSTER_STATES = ['idle', 'hop', 'chase', 'giggle'];

const FL = Math.floor;
const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

// Somewhere a monster can stand: on the ground (not a tree, not in the
// water), with room above it.
function groundAt(world, x, z) {
  const cx = FL(x);
  const cz = FL(z);
  if (cx < 1 || cz < 1 || cx >= world.W - 1 || cz >= world.D - 1) return null;
  const y = world.top(cx, cz);
  if (y < 1 || y >= world.H - 2) return null;
  const under = world.get(cx, y, cz);
  if (!B.SOLID[under] || B.TREE_PART[under]) return null;
  if (B.SOLID[world.get(cx, y + 1, cz)] || B.SOLID[world.get(cx, y + 2, cz)] || world.get(cx, y + 1, cz) === B.WATER) return null;
  return y + 1;
}

// Whether the column at (x, z) is water a monster would fall into.
function wet(world, x, y, z) {
  const cx = FL(x);
  const cz = FL(z);
  for (let yy = FL(y + 0.5); yy >= Math.max(0, FL(y) - 3); yy--) {
    const id = world.get(cx, yy, cz);
    if (id === B.WATER) return true;
    if (B.SOLID[id]) return false;
  }
  return false;
}

export class MonsterSim {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.list = [];
    this.nextId = 1;
    this.spawnAt = 0;
  }

  get(id) {
    return this.list.find((m) => m.id === id) ?? null;
  }

  add(world, x, y, z) {
    if (this.list.length >= MAX_MONSTERS) return null;
    const body = makeBody(x, y, z);
    body.radius = MONSTER_BODY.radius;
    body.height = MONSTER_BODY.height;
    const m = { id: this.nextId++, body, yaw: this.rng.range(-Math.PI, Math.PI), state: 'idle', target: 0, wander: null, rest: this.rng.range(0.5, 2), lonely: 0, giggle: 0 };
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

  // How many there should be with these players on the island.
  wanted(players, night) {
    return Math.min(MAX_MONSTERS, players * PER_PLAYER[night ? 'night' : 'day']);
  }

  // A spot for a new one: out of sight round one of the players, away from
  // all of them and from the island's start.
  findSpot(world, people) {
    if (!people.length) return null;
    const spawn = world.spawn;
    for (let tries = 0; tries < 40; tries++) {
      const p = this.rng.pick(people);
      const a = this.rng.range(-Math.PI, Math.PI);
      const d = this.rng.range(SPAWN_NEAR, SPAWN_FAR);
      const x = FL(p.x + Math.sin(a) * d) + 0.5;
      const z = FL(p.z + Math.cos(a) * d) + 0.5;
      const y = groundAt(world, x, z);
      if (y === null) continue;
      if (Math.hypot(x - spawn.x, z - spawn.z) < SAFE_RADIUS + 3) continue;
      if (people.some((q) => Math.hypot(q.x - x, q.z - z) < SPAWN_NEAR - 2)) continue;
      return { x, y, z };
    }
    return null;
  }

  // Moves them on by dt seconds. people: the players on the island, as
  // { id, x, y, z, flying, riding }. Returns who each one bumped into, as
  // [{ monster, pid }].
  step(world, dt, now, people, night) {
    if (now >= this.spawnAt) {
      this.spawnAt = now + SPAWN_MS;
      if (this.list.length < this.wanted(people.length, night)) {
        const at = this.findSpot(world, people);
        if (at) this.add(world, at.x, at.y, at.z);
      }
    }
    const bumps = [];
    const spawn = world.spawn;
    for (const m of [...this.list]) {
      const b = m.body;
      // Lonely, far from everyone: off it goes.
      const nearest = people.reduce((best, p) => Math.min(best, Math.hypot(p.x - b.x, p.z - b.z)), Infinity);
      m.lonely = nearest > LONELY ? m.lonely + dt * 1000 : 0;
      if (m.lonely > LONELY_MS || b.inWater || b.y < 2) {
        this.remove(m.id);
        continue;
      }
      // Whom it is after: the nearest it can get at (not someone riding or
      // flying high), until they get away.
      let target = people.find((p) => p.id === m.target) ?? null;
      if (target && (target.riding || Math.hypot(target.x - b.x, target.z - b.z) > GIVE_UP)) target = null;
      if (!target) {
        let best = NOTICE;
        for (const p of people) {
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          if (d < best && !p.riding && p.y - b.y < 4) {
            best = d;
            target = p;
          }
        }
      }
      m.target = target?.id ?? 0;
      let mx = 0;
      let mz = 0;
      let jump = false;
      if (now < m.giggle) {
        m.state = 'giggle';
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
      } else {
        m.rest -= dt;
        if (m.rest <= 0) {
          m.rest = this.rng.range(2, 5);
          // Mostly roughly towards the nearest player, so it finds them in the end.
          const near = people.reduce((best, p) => (!best || Math.hypot(p.x - b.x, p.z - b.z) < Math.hypot(best.x - b.x, best.z - b.z) ? p : best), null);
          const a = near && this.rng.chance(0.65) ? Math.atan2(near.x - b.x, near.z - b.z) + this.rng.range(-0.7, 0.7) : this.rng.range(-Math.PI, Math.PI);
          m.wander = this.rng.chance(0.25) ? null : { x: Math.sin(a), z: Math.cos(a) };
        }
        if (m.wander) {
          mx = m.wander.x;
          mz = m.wander.z;
        }
        m.state = m.wander ? 'hop' : 'idle';
      }
      // Never into the safe place round the start (round its edge instead),
      // nor into the water.
      if (mx || mz) {
        const inside = (x, z) => Math.hypot(x - spawn.x, z - spawn.z) < SAFE_RADIUS && Math.hypot(x - spawn.x, z - spawn.z) < Math.hypot(b.x - spawn.x, b.z - spawn.z);
        if (inside(b.x + mx * 0.9, b.z + mz * 0.9)) {
          const rx = b.x - spawn.x;
          const rz = b.z - spawn.z;
          const r = Math.hypot(rx, rz) || 1;
          const side = mx * -rz + mz * rx >= 0 ? 1 : -1;
          mx = (side * -rz) / r;
          mz = (side * rx) / r;
        }
        if (inside(b.x + mx * 0.9, b.z + mz * 0.9) || wet(world, b.x + mx * 0.9, b.y, b.z + mz * 0.9)) {
          mx = 0;
          mz = 0;
          m.wander = null;
          if (m.state === 'hop') m.state = 'idle';
        }
      }
      // It gets about in hops.
      if ((mx || mz) && b.onGround) jump = true;
      const events = stepBody(world, b, { mx, mz, jump, run: m.state === 'chase' }, dt, { autoJump: true, move: MOVE });
      if (events.bumped && m.state === 'hop') m.rest = 0;
      // Stuck at a wall while chasing: off to one side for a moment.
      if (events.bumped && m.state === 'chase' && !(m.detour && now < m.detour.until) && Math.hypot(b.vx, b.vz) < 0.5) {
        const side = this.rng.chance(0.5) ? 1 : -1;
        m.detour = { x: -mz * side, z: mx * side, until: now + this.rng.range(700, 1500) };
      }
      if (mx || mz) m.yaw = Math.atan2(mx, mz);
      // Bumping into someone: they are knocked back, and it giggles a moment.
      if (now >= m.giggle) {
        for (const p of people) {
          if (p.riding || now < (p.safeUntil ?? 0)) continue;
          if (Math.hypot(p.x - b.x, p.z - b.z) > BUMP_REACH) continue;
          // Their feet over its top: they are jumping on it, not bumped (see bop).
          if (p.y > b.y + MONSTER_BODY.height - 0.25 || p.y + 1.5 < b.y) continue;
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

  // Whether someone at p can bop the one numbered id: by tapping it from as
  // far as a tool reaches, or by landing on it.
  canBop(id, p) {
    const m = this.get(id);
    if (!m) return null;
    const b = m.body;
    return Math.hypot(p.x - b.x, p.y + 1.3 - (b.y + 0.4), p.z - b.z) <= BOP_REACH ? m : null;
  }

  // Compact numbers for the wire: [id, x, y, z, yaw, state] in hundredths.
  pack() {
    return this.list.map((m) => [
      m.id,
      Math.round(m.body.x * 100),
      Math.round(m.body.y * 100),
      Math.round(m.body.z * 100),
      Math.round((wrap(m.yaw) + Math.PI) * 100),
      MONSTER_STATES.indexOf(m.state),
    ]);
  }
}

export function unpackMonster(row) {
  if (!Array.isArray(row) || row.length < 6 || !row.every(Number.isFinite)) return null;
  return { id: row[0], x: row[1] / 100, y: row[2] / 100, z: row[3] / 100, yaw: row[4] / 100 - Math.PI, state: MONSTER_STATES[row[5]] ?? 'idle' };
}

// Hearts, for one player: how many after a bump (0: home they go, and back
// to all of them), and how many come back while nothing bumps them.
export function heartsAfterBump(hearts) {
  return Math.max(0, hearts - 1);
}

export function heartsBack(hearts, sinceBumpMs) {
  if (hearts >= MAX_HEARTS || sinceBumpMs < HEART_BACK_MS) return hearts;
  return Math.min(MAX_HEARTS, hearts + 1);
}
