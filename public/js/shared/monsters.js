// Monsters: an island rule the owner can turn on (off unless they do).
// Grumpy little jelly blobs hop out of the bushes, more of them at night,
// and come after whoever is near. One that bumps into you knocks you back
// and takes a heart; with no hearts left you pop back home with them all
// again. Tap one, or jump on it, and it goes pop.
//
// On an adventure island (adventure.js) monsters also keep to their camps,
// whether the rule is on or not: guards that chase whoever comes into their
// camp and go back to it after, and in his castle King Grumble, big and
// slow, who stomps the ground now and then.
//
// Nobody gets hurt: hearts come back by themselves, the start of the island
// (and every camp freed) and every tent are safe places no monster goes
// into, and they cannot swim, reach someone riding an animal or catch
// anyone who runs.
//
// The host moves them (Room.tick); everyone sees them a few times a second,
// as they see the animals. They are never saved: turning monsters off, or
// opening the island again, starts it without any.
import * as B from './blocks.js';
import { makeBody, stepBody } from './physics.js';
import { Rng } from './rng.js';
import { underTent } from './tents.js';

export const MAX_HEARTS = 5;
// A heart back this long after the last bump, and every this long after that.
export const HEART_BACK_MS = 6000;
// After a bump, a moment when nothing can bump you again.
export const SAFE_MS = 1600;
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
// King Grumble: as tall as a player and much wider, slower still, with
// bigger hops.
export const KING_BODY = { radius: 0.95, height: 1.8 };
const KING_MOVE = { walk: 1.8, run: 3, jump: 9 };
// His stomp: now and then, near whoever he is after, he crouches (long
// enough to see it coming, with a ring on the ground as far as it reaches),
// jumps straight up and lands with a thump that knocks over anyone on the
// ground that near. Anyone in the air then is missed.
export const STOMP = { every: 6500, windup: 900, reach: 6, jump: 10.5 };
// Bumping: how close (between middles, side to side) and how long it stops
// to giggle after.
const BUMP_PAD = 0.38;
const GIGGLE_MS = 1400;
// Tapping one: from this far (from your eyes; nearer than a tool reaches, so
// you have to go up to one), and the host lets a little more through, as a
// monster on the move is a little further on there than on your screen. A
// bigger one can be tapped from as much further as it is bigger.
export const TAP_REACH = 7.5;
export const BOP_REACH = TAP_REACH + 1.5;

// New states and kinds go on the end: the wire sends the index.
export const MONSTER_STATES = ['idle', 'hop', 'chase', 'giggle', 'stomp'];
export const MONSTER_KINDS = ['blob', 'king'];

export const bodyOf = (kind) => (kind === 'king' ? KING_BODY : MONSTER_BODY);

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
  if (B.SOLID[world.get(cx, y + 1, cz)] || B.SOLID[world.get(cx, y + 2, cz)] || world.get(cx, y + 1, cz) === B.WATER) return null;
  return y + 1;
}

// Whether any of a monster standing at (x, y, z) would be in a tent: its
// corners, not just its middle, which could cut a tent's corner on the way.
function tentAt(world, x, y, z, r) {
  return underTent(world, x - r, y, z - r) || underTent(world, x + r, y, z - r) || underTent(world, x - r, y, z + r) || underTent(world, x + r, y, z + r);
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

// The safe places of an island without camps: just its start.
const startOnly = (world) => [{ x: world.spawn.x, z: world.spawn.z, r: SAFE_RADIUS }];

export class MonsterSim {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    // The camps' monsters draw from randomness of their own, so the others
    // do just as they would without them.
    this.campRng = new Rng((seed ^ 0x2f6b1d3a) >>> 0);
    this.list = [];
    this.nextId = 1;
    this.spawnAt = 0;
    // Camp monsters that went by themselves (into the water), and King
    // Grumble's landings, since they were last taken (see takeGone, takeStomps).
    this.gone = [];
    this.stomps = [];
  }

  get(id) {
    return this.list.find((m) => m.id === id) ?? null;
  }

  // How many hop about the island by themselves, not keeping to a camp.
  get roaming() {
    let n = 0;
    for (const m of this.list) if (!m.camp) n++;
    return n;
  }

  // camp: the id of the camp it keeps to (0: none); kind: 'blob' or 'king'.
  add(world, x, y, z, { camp = 0, kind = 'blob' } = {}) {
    if (!camp && this.roaming >= MAX_MONSTERS) return null;
    const size = bodyOf(kind);
    const body = makeBody(x, y, z);
    body.radius = size.radius;
    body.height = size.height;
    const rng = camp ? this.campRng : this.rng;
    const m = { id: this.nextId++, body, yaw: rng.range(-Math.PI, Math.PI), state: 'idle', target: 0, wander: null, rest: rng.range(0.5, 2), lonely: 0, giggle: 0, camp, kind: MONSTER_KINDS.includes(kind) ? kind : 'blob' };
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

  // Only the ones roaming about: those of the camps stay.
  clearRoaming() {
    this.list = this.list.filter((m) => m.camp);
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
  // { id, x, y, z, flying, riding, dizzy, safeUntil }. options: roam, whether
  // monsters come out round the players (the island rule); havens, the safe
  // places ({ x, z, r, kind }); camps, what the camp monsters keep to (an
  // AdventureSim, or anything with campById). Returns who each one bumped
  // into, as [{ monster, pid }].
  step(world, dt, now, people, night, { roam = true, havens = startOnly(world), camps = null } = {}) {
    if (roam && now >= this.spawnAt) {
      this.spawnAt = now + SPAWN_MS;
      if (this.roaming < this.wanted(people.length, night)) {
        const at = this.findSpot(world, people, havens);
        if (at) this.add(world, at.x, at.y, at.z);
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
      const b = m.body;
      const camp = m.camp ? (camps?.campById(m.camp) ?? null) : null;
      // Lonely, far from everyone: off it goes (one of a camp stays). In the
      // water, it goes too.
      if (!m.camp) {
        const nearest = people.reduce((best, p) => Math.min(best, Math.hypot(p.x - b.x, p.z - b.z)), Infinity);
        m.lonely = nearest > LONELY ? m.lonely + dt * 1000 : 0;
      }
      if (m.lonely > LONELY_MS || b.inWater || b.y < 2 || (m.camp && !camp)) {
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
      // King Grumble's stomp only ever counts down while he is after someone.
      if (!target) m.stompAt = 0;
      let mx = 0;
      let mz = 0;
      let jump = false;
      if (now < m.giggle) {
        m.state = 'giggle';
      } else if (m.windup || m.slam) {
        // Crouched for a stomp, then up he goes, straight up, so he comes
        // down just where the ring on the ground said he would.
        m.state = m.windup ? 'stomp' : 'chase';
        if (m.windup && now >= m.windup) {
          m.windup = 0;
          m.slam = true;
          b.vx = 0;
          b.vz = 0;
          b.vy = STOMP.jump;
          b.onGround = false;
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
        if (m.kind === 'king' && b.onGround && !m.slam) {
          if (!m.stompAt) m.stompAt = now + STOMP.every * 0.6;
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
      // Never into a safe place (round its edge instead), nor into the
      // water or a tent.
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
        if (into(ax, az) || wet(world, ax, b.y, az) || (tentAt(world, ax, b.y, az, b.radius) && !underTent(world, b.x, b.y, b.z))) {
          mx = 0;
          mz = 0;
          m.wander = null;
          if (m.state === 'hop') m.state = 'idle';
        }
      }
      // It gets about in hops.
      if ((mx || mz) && b.onGround) jump = true;
      const events = stepBody(world, b, { mx, mz, jump, run: m.state === 'chase' }, dt, { autoJump: true, move: m.kind === 'king' ? KING_MOVE : MOVE });
      if (events.bumped && m.state === 'hop') m.rest = 0;
      // Down from a stomp: the thump (see takeStomps), and a while till the next.
      if (m.slam && b.onGround) {
        m.slam = false;
        m.stompAt = now + STOMP.every;
        this.stomps.push({ monster: m, x: b.x, y: b.y, z: b.z });
      }
      // Stuck at a wall while chasing: off to one side for a moment.
      if (events.bumped && m.state === 'chase' && !(m.detour && now < m.detour.until) && Math.hypot(b.vx, b.vz) < 0.5) {
        const side = rng.chance(0.5) ? 1 : -1;
        m.detour = { x: -mz * side, z: mx * side, until: now + rng.range(700, 1500) };
      }
      if (mx || mz) m.yaw = Math.atan2(mx, mz);
      // Bumping into someone: they are knocked back, and it giggles a moment.
      if (now >= m.giggle && !m.passive) {
        for (const p of people) {
          if (p.riding || p.dizzy || now < (p.safeUntil ?? 0)) continue;
          if (Math.hypot(p.x - b.x, p.z - b.z) > b.radius + BUMP_PAD || sheltered(p)) continue;
          // Their feet over its top: they are jumping on it, not bumped (see bop).
          if (p.y > b.y + b.height - 0.25 || p.y + 1.5 < b.y) continue;
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
    const reach = BOP_REACH + b.radius - MONSTER_BODY.radius;
    return Math.hypot(p.x - b.x, p.y + 1.3 - (b.y + b.height / 2), p.z - b.z) <= reach ? m : null;
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
    ]);
  }
}

export function unpackMonster(row) {
  if (!Array.isArray(row) || row.length < 6 || !row.every(Number.isFinite)) return null;
  return { id: row[0], x: row[1] / 100, y: row[2] / 100, z: row[3] / 100, yaw: row[4] / 100 - Math.PI, state: MONSTER_STATES[row[5]] ?? 'idle', kind: MONSTER_KINDS[row[6]] ?? 'blob' };
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
