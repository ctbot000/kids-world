// The video arcade: arcade machines (two pieces of furniture, blocks.js)
// that each run a mini-game, and everyone at a machine plays it together.
//
// - Bop-a-Blob (👾): nine holes, and the grumpy jelly blobs pop out of
//   them faster and faster for thirty seconds. Anyone at the machine can
//   bop them (a golden one is worth three), all of you racking up one
//   score together, with your own bops counted beside it.
// - Picture Pairs (🃏): sixteen cards face down, and you take turns
//   flipping two over. A pair stays up for whoever found it; with all
//   eight pairs found, the board is done.
//
// The host runs the games (ArcadeSim, from room.js) as it runs the
// monsters, and tells every page how they are going ('arc') and what just
// happened in them ('arcfx'). A game is never saved: an island opened
// again starts with none, like the monsters.
import { BLOCKS } from './blocks.js';
import { Rng } from './rng.js';

// The game each machine runs, by the model of its block.
export const ARCADE_MODELS = { 'arcade-blob': 'blob', 'arcade-pairs': 'pairs' };
export const gameOfBlock = (id) => ARCADE_MODELS[BLOCKS[id]?.model] ?? null;

export const ARCADE_GAMES = {
  blob: {
    icon: '👾',
    name: 'Bop-a-Blob',
    how: 'Bop the blobs as they pop up! Everyone at the machine plays one round together, and a golden blob is worth three.',
  },
  pairs: {
    icon: '🃏',
    name: 'Picture Pairs',
    how: 'Take turns flipping two cards. Find a pair and it stays up for you. Find all eight pairs together!',
  },
};

// How near a machine you must stand to play at it.
export const REACH = 3.5;

// Bop-a-Blob: a three-second count, a thirty-second round, then the scores.
export const COUNTDOWN_MS = 3000;
export const ROUND_MS = 30000;
export const DONE_MS = 6000;
export const HOLES = 9;
// Never more than this many blobs up at once.
export const MOST_UP = 3;
export const GOLD_CHANCE = 0.18;
export const POP_POINTS = 1;
export const GOLD_POINTS = 3;
// Blobs come out every so often and stay up for a while, both winding up
// over the round from the first of each pair of numbers to the second. A
// golden blob stays up for only two thirds as long.
export const SPAWN_EVERY = [1000, 550];
export const UP_FOR = [1150, 800];

// Picture Pairs: eight pairs of cards face down.
export const FACES = ['🍎', '🍊', '🍑', '🍐', '🍒', '🐚', '⭐', '💎'];
export const PAIRS = FACES.length;
// A wrong pair stays up this long before going back down.
export const MISS_MS = 900;
export const BOARD_DONE_MS = 8000;

export const PHASES = ['count', 'play', 'done'];

export const keyOf = (x, y, z) => `${x},${y},${z}`;

// The machine nearest a body standing beside it (or on it), within `reach`
// blocks: { x, y, z, game, key } of its cell, or null.
export function arcadeNear(world, body, reach = 2.2) {
  const bx = Math.floor(body.x);
  const bz = Math.floor(body.z);
  const by = Math.floor(body.y + 0.05);
  let best = null;
  let near = reach;
  for (let x = bx - 2; x <= bx + 2; x++) {
    for (let z = bz - 2; z <= bz + 2; z++) {
      for (let y = by - 1; y <= by; y++) {
        const game = gameOfBlock(world.get(x, y, z));
        if (!game) continue;
        const d = Math.hypot(x + 0.5 - body.x, z + 0.5 - body.z);
        if (d < near) {
          near = d;
          best = { x, y, z, game, key: keyOf(x, y, z) };
        }
      }
    }
  }
  return best;
}

export class ArcadeSim {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    // One game going per machine, by its cell key. A Bop-a-Blob session
    // counts up (see fresh); a Picture Pairs one is played in turns.
    this.sessions = new Map();
  }

  // Play pressed at the machine in cell (x, y, z), which runs `game`: a
  // new game when none is going there (or the last is over), or joining
  // one that is. Returns the session.
  play(x, y, z, game, pid, now) {
    const key = keyOf(x, y, z);
    const going = this.sessions.get(key);
    if (going && going.phase !== 'done') {
      this.join(going, pid);
      return going;
    }
    const s = this.fresh(key, game, x, y, z, now);
    this.join(s, pid);
    this.sessions.set(key, s);
    return s;
  }

  join(s, pid) {
    if (s.players.includes(pid)) return;
    s.players.push(pid);
    if (s.game === 'blob') s.pops.set(pid, 0);
    else s.found.set(pid, 0);
  }

  fresh(key, game, x, y, z, now) {
    if (game === 'pairs') {
      // The cards of a board: each one's face (an index into FACES), face
      // down (u: the one or two just flipped up; w: a wrong pair waiting
      // to go back down; t: whose turn it is, by their place in players;
      // f: pairs found by each).
      const deck = [...FACES.keys(), ...FACES.keys()];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return { key, game, x, y, z, phase: 'play', at: now, players: [], deck: deck.map((f) => ({ f, s: 0 })), up: [], turn: 0, wait: 0, found: new Map() };
    }
    // The nine holes (a blob in one: kind 1, or 2 for a golden one, until
    // it goes back down), the score everyone at the machine shares, each
    // player's own bops, and when the next blob comes out.
    return { key, game, x, y, z, phase: 'count', at: now, players: [], holes: Array.from({ length: HOLES }, () => ({ kind: 0, until: 0 })), score: 0, pops: new Map(), nextAt: now };
  }

  // A bop at hole i of a Bop-a-Blob machine. Returns the pop for everyone
  // to see, or null: no game going there, not one of its players, or
  // nothing in the hole.
  bop(key, i, pid, now) {
    const s = this.sessions.get(key);
    if (!s || s.game !== 'blob' || s.phase !== 'play' || !s.players.includes(pid)) return null;
    const h = s.holes[i];
    if (!h || !h.kind || now >= h.until) return null;
    const pts = h.kind === 2 ? GOLD_POINTS : POP_POINTS;
    h.kind = 0;
    s.score += pts;
    s.pops.set(pid, (s.pops.get(pid) ?? 0) + 1);
    return { f: 'pop', k: key, i, by: pid, pts, s: s.score };
  }

  // A card flipped over at a Picture Pairs machine. Returns what happened
  // for everyone to see (the flip, and a pair found or a miss), or []
  // when it was not that player's flip to make.
  flip(key, i, pid, now) {
    const s = this.sessions.get(key);
    if (!s || s.game !== 'pairs' || s.phase !== 'play' || !s.players.includes(pid)) return [];
    if (s.wait || s.players[s.turn] !== pid) return [];
    const card = s.deck[i];
    if (!card || card.s !== 0) return [];
    card.s = 1;
    s.up.push(i);
    const news = [{ f: 'flip', k: key, i, by: pid, face: card.f }];
    if (s.up.length < 2) return news;
    // The second card: a pair stays up and is theirs; a miss waits a
    // moment before both go back down. Either way, the turn passes on.
    const [a, b] = s.up;
    s.turn = (s.turn + 1) % s.players.length;
    s.up = [];
    if (s.deck[a].f === s.deck[b].f) {
      s.deck[a].s = 2;
      s.deck[b].s = 2;
      s.found.set(pid, (s.found.get(pid) ?? 0) + 1);
      news.push({ f: 'pair', k: key, i: a, j: b, by: pid });
      if (s.deck.every((c) => c.s === 2)) {
        s.phase = 'done';
        s.at = now;
        news.push({ f: 'board', k: key, ps: [...s.found] });
      }
    } else {
      s.up = [a, b];
      s.wait = now + MISS_MS;
    }
    return news;
  }

  // Moves the games on to now, and returns what happened for the room to
  // tell everyone: the end of a round of Bop-a-Blob, or of a board of
  // Picture Pairs. (Blobs coming up and going down show up in pack().)
  step(now) {
    const news = [];
    for (const s of [...this.sessions.values()]) {
      if (s.game === 'blob') {
        if (s.phase === 'count' && now >= s.at + COUNTDOWN_MS) {
          s.phase = 'play';
          s.at = now;
        }
        if (s.phase === 'play') {
          for (const h of s.holes) if (h.kind && now >= h.until) h.kind = 0;
          const t = Math.min(1, (now - s.at) / ROUND_MS);
          if (now >= s.nextAt) {
            if (s.holes.filter((h) => h.kind).length < MOST_UP) {
              const empty = s.holes.map((h, i) => (h.kind ? -1 : i)).filter((i) => i >= 0);
              if (empty.length) {
                const h = s.holes[empty[Math.floor(this.rng.next() * empty.length)]];
                h.kind = this.rng.chance(GOLD_CHANCE) ? 2 : 1;
                h.until = now + (UP_FOR[0] + (UP_FOR[1] - UP_FOR[0]) * t) * (h.kind === 2 ? 0.65 : 1);
              }
            }
            s.nextAt = now + (SPAWN_EVERY[0] + (SPAWN_EVERY[1] - SPAWN_EVERY[0]) * t) * (0.85 + this.rng.next() * 0.3);
          }
          if (now >= s.at + ROUND_MS) {
            s.phase = 'done';
            s.at = now;
            for (const h of s.holes) h.kind = 0;
            news.push({ f: 'round', k: s.key, s: s.score, ps: [...s.pops] });
          }
        } else if (s.phase === 'done' && now >= s.at + DONE_MS) {
          this.sessions.delete(s.key);
        }
      } else {
        // A wrong pair goes back down.
        if (s.wait && now >= s.wait) {
          for (const i of s.up) s.deck[i].s = 0;
          s.up = [];
          s.wait = 0;
        }
        if (s.phase === 'done' && now >= s.at + BOARD_DONE_MS) this.sessions.delete(s.key);
      }
    }
    return news;
  }

  // A player gone from the island (or from the machine): the game they
  // were in goes on without them, and ends at once when nobody is left at
  // it. Returns whether anything changed.
  left(pid) {
    let changed = false;
    for (const s of [...this.sessions.values()]) {
      const at = s.players.indexOf(pid);
      if (at < 0) continue;
      s.players.splice(at, 1);
      if (s.game === 'blob') s.pops.delete(pid);
      else {
        s.found.delete(pid);
        s.turn %= s.players.length;
        // Cards they left face up go back down, and the next player goes.
        if (s.up.length && s.phase === 'play') {
          for (const i of s.up) s.deck[i].s = 0;
          s.up = [];
          s.wait = 0;
        }
      }
      if (!s.players.length) this.sessions.delete(s.key);
      changed = true;
    }
    return changed;
  }

  // The machine gone (picked up, say): its game goes with it. Returns
  // whether there was one.
  removeAt(x, y, z) {
    return this.sessions.delete(keyOf(x, y, z));
  }

  // What everyone needs to know about the games going, as they arrive and
  // as they change. Each game:
  //   blob:  { k, x, y, z, g: 0, p: 0|1|2 (count, play, done), t: seconds
  //            left of the part it is in, s: the shared score, h: what is
  //            in each of the nine holes (0 nothing, 1 a blob, 2 a golden
  //            one), ps: [pid, bops] for each player }
  //   pairs: { k, x, y, z, g: 1, p: 1|2 (play, done), d: the sixteen
  //            cards, each 0 face down, 1+f face up with face f, or 9+f a
  //            pair found with face f, t: whose turn it is, ps: [pid,
  //            pairs] for each player }
  pack(now) {
    return [...this.sessions.values()].map((s) => {
      const base = { k: s.key, x: s.x, y: s.y, z: s.z, g: s.game === 'blob' ? 0 : 1, p: PHASES.indexOf(s.phase), ps: [...(s.game === 'blob' ? s.pops : s.found)] };
      if (s.game === 'blob') {
        const whole = s.phase === 'count' ? COUNTDOWN_MS : s.phase === 'play' ? ROUND_MS : DONE_MS;
        return { ...base, t: Math.max(0, Math.ceil((s.at + whole - now) / 1000)), s: s.score, h: s.holes.map((h) => h.kind) };
      }
      return { ...base, d: s.deck.map((c) => (c.s === 2 ? 9 + c.f : c.s === 1 ? 1 + c.f : 0)), t: s.players[s.turn] ?? 0, w: s.wait > now ? 1 : 0 };
    });
  }
}
