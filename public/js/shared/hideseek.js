// Hide and seek (🙈), for everyone on an island. Whoever starts a round is
// it: their eyes close and they count (HIDE_MS) while everyone else runs off
// to hide, then they go looking (SEEK_MS). A hider is found as soon as the
// seeker comes within FIND_REACH of them with nothing solid in between
// (glass hides nobody); found, they are out and watch the rest. The round is
// over when everyone is found (the seeker wins) or the time is up (whoever is
// still hidden wins).
//
// The host runs it (HideSeekSim, from room.js) as it runs the arcade, and
// tells every page how it is going ('hs') and what just happened in it
// ('hsfx'). A round is never saved: an island opened again starts with none.
import * as B from './blocks.js';
import { raycast } from './raycast.js';

export const HIDE_MS = 20000;
export const SEEK_MS = 180000;
export const DONE_MS = 8000;
export const FIND_REACH = 2.5;
// How far up and down a seeker finds someone (a hider a storey up is not found).
export const FIND_UP = 2;
// Two to play: the seeker and somebody to find.
export const MIN_PLAYERS = 2;
export const PHASES = ['hide', 'seek', 'done'];

// What stands between two players, for the seeker to see past: solid blocks
// and furniture, but not glass (or water, or plants).
const blocksSight = (id) => B.SOLID[id] === 1 && B.block(id).kind !== 'glass';

// Whether nothing solid stands between a seeker and a hider, both { x, y, z }
// at their feet: from the seeker's eyes to the hider's head or tummy.
export function canSee(world, a, b) {
  const ey = a.y + 1.5;
  for (const dy of [1.4, 0.6]) {
    const dx = b.x - a.x;
    const dyy = b.y + dy - ey;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dyy, dz);
    if (dist < 0.3) return true;
    const hit = raycast(world, a.x, ey, a.z, dx, dyy, dz, dist, (id, x, y, z, start, t) => t > 0 && blocksSight(id));
    if (!hit) return true;
  }
  return false;
}

// Whether a seeker standing at `a` finds a hider at `b` (see canSee).
export function finds(world, a, b) {
  if (Math.hypot(b.x - a.x, b.z - a.z) > FIND_REACH || Math.abs(b.y - a.y) > FIND_UP) return false;
  return canSee(world, a, b);
}

export class HideSeekSim {
  constructor() {
    // The round going, or null: { phase, seeker, hiders (pids, in the order
    // they joined), found: Map of pid → when, phaseAt (when this phase
    // started), until (when it ends) }.
    this.round = null;
  }

  // Whether a round is under way (counting or seeking).
  get playing() {
    return Boolean(this.round) && this.round.phase !== 'done';
  }

  // A round started by `seeker`, with everyone in `ids` (the players on the
  // island) hiding: { ok: true }, or { why } when one cannot start.
  start(seeker, ids, now) {
    if (this.playing) return { why: 'busy' };
    const hiders = [...new Set(ids)].filter((id) => id !== seeker);
    if (hiders.length < MIN_PLAYERS - 1) return { why: 'alone' };
    this.round = { phase: 'hide', seeker, hiders, found: new Map(), phaseAt: now, until: now + HIDE_MS };
    return { ok: true };
  }

  // Whether a player is hiding (in the round and not found yet).
  hiding(pid) {
    const r = this.round;
    return Boolean(r) && r.phase !== 'done' && r.hiders.includes(pid) && !r.found.has(pid);
  }

  isSeeker(pid) {
    return this.playing && this.round.seeker === pid;
  }

  // The round going along: the count over, hiders found by where everyone
  // is (`where`: Map of pid → { x, y, z }), the time up, and the round's end
  // cleared away. What happened, for everyone to hear: { f: 'seek' },
  // { f: 'found', pid, by }, { f: 'end', ...results } and { f: 'over' }.
  step(world, now, where) {
    const r = this.round;
    if (!r) return [];
    const fx = [];
    if (r.phase === 'hide' && now >= r.until) {
      r.phase = 'seek';
      r.phaseAt = now;
      r.until = now + SEEK_MS;
      fx.push({ f: 'seek' });
    }
    if (r.phase === 'seek') {
      const s = where.get(r.seeker);
      if (s) {
        for (const pid of r.hiders) {
          if (r.found.has(pid)) continue;
          const h = where.get(pid);
          if (h && finds(world, s, h)) {
            r.found.set(pid, now);
            fx.push({ f: 'found', pid, by: r.seeker });
          }
        }
      }
      if (r.hiders.every((pid) => r.found.has(pid)) || now >= r.until) fx.push(this.end(now));
    } else if (r.phase === 'done' && now >= r.until) {
      this.round = null;
      fx.push({ f: 'over' });
    }
    return fx;
  }

  // The round over: who was found, who never was, and the seeker.
  end(now, why = '') {
    const r = this.round;
    r.phase = 'done';
    r.phaseAt = now;
    r.until = now + DONE_MS;
    const hidden = r.hiders.filter((pid) => !r.found.has(pid));
    return { f: 'end', seeker: r.seeker, found: [...r.found.keys()], hidden, ...(why ? { why } : {}) };
  }

  // Someone gone from the island: a hider is out of the round, and the
  // round is over with nobody left to hide or nobody to seek. What happened.
  left(pid, now) {
    const r = this.round;
    if (!r || r.phase === 'done') return [];
    if (r.seeker === pid) return [this.end(now, 'seeker')];
    const i = r.hiders.indexOf(pid);
    if (i < 0) return [];
    r.hiders.splice(i, 1);
    r.found.delete(pid);
    if (!r.hiders.length) return [this.end(now, 'hiders')];
    if (r.phase === 'seek' && r.hiders.every((id) => r.found.has(id))) return [this.end(now)];
    return [{ f: 'gone', pid }];
  }

  // The round for every page: { phase, seeker, hiders, found, left (ms to
  // the end of this phase) }, or null with none going.
  pack(now) {
    const r = this.round;
    if (!r) return null;
    return { phase: r.phase, seeker: r.seeker, hiders: [...r.hiders], found: [...r.found.keys()], left: Math.max(0, Math.round(r.until - now)) };
  }
}

// A round as an island tells of it (pack above), checked, or null.
export function cleanRound(raw) {
  if (!raw || typeof raw !== 'object' || !PHASES.includes(raw.phase) || !Number.isInteger(raw.seeker)) return null;
  const ids = (v) => (Array.isArray(v) ? v.filter(Number.isInteger) : []);
  const left = Number.isFinite(raw.left) ? Math.max(0, raw.left) : 0;
  return { phase: raw.phase, seeker: raw.seeker, hiders: ids(raw.hiders), found: ids(raw.found), left };
}
