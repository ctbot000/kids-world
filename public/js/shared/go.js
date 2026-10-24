// Go (바둑), at a Go board (a piece of furniture, blocks.js): two players
// take turns putting black and white stones on the crossings of the lines,
// black first. A stone's liberties are the empty crossings next to it (along
// the lines), shared by every stone joined to it; a group with none left is
// captured and taken off. A stone may not go where it would have no
// liberties (unless it captures), nor take back a single stone just taken
// (ko). The game ends when both pass in a row, or one gives up, and each
// side's area is counted: its stones, and the empty places only its stones
// reach. More wins; there is no komi, for children.
//
// Small boards only, to learn on: 5×5, 7×7 and 9×9.
//
// Gomoku (오목) is played at the same boards with the same stones: black
// and white take turns, black first, and the first to get five (or more) in
// a row — across, down or slanting — wins; nothing is ever captured. A board
// filled up with no five is a draw. On 9×9, 13×13 and 15×15 boards.
//
// The host runs the games (GoSim, from room.js) as it runs the arcade's, and
// tells every page how they are going ('go') and what just happened
// ('gofx'). Anyone at a board can sit down to play it; a second player joins
// as white, or the AI friend does, called over with 🤖 Play with Pip: it
// walks up, teaches the rules as you go and plays its moves (pickMove; see
// server/buddy.js). A game is never saved: an island opened again starts
// with none.
import { BLOCKS } from './blocks.js';
import { cellNear, keyOf } from './arcade.js';

// The games a board plays, each with its sizes and the one it starts on.
export const GAMES = {
  go: { key: 'go', name: 'Go', icon: '⚫', sizes: [5, 7, 9], size: 5 },
  gomoku: { key: 'gomoku', name: 'Gomoku', icon: '⭕', sizes: [9, 13, 15], size: 15 },
};
export const gameOf = (kind) => GAMES[kind] ?? GAMES.go;
export const SIZES = GAMES.go.sizes;
export const DEFAULT_SIZE = GAMES.go.size;
// How many in a row win at Gomoku.
export const ROW = 5;
// How near a board you must stand to play at it.
export const REACH = 3.5;
// Black, white, and nobody's.
export const BLACK = 'b';
export const WHITE = 'w';
export const EMPTY = '.';
export const other = (c) => (c === BLACK ? WHITE : BLACK);
export const colorName = (c) => (c === BLACK ? 'black' : 'white');

export const isGoBoard = (id) => BLOCKS[id]?.model === 'go-board';

// The board nearest a body standing beside it: { x, y, z, key }, or null.
export const goBoardNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isGoBoard(id) ? {} : null), reach);

// Where the playing surface is, in the board's cell (furniture.js draws the
// wood, render/go-boards.js the lines and stones over it).
export const SURFACE = { x0: 0.08, x1: 0.92, z0: 0.08, z1: 0.92, y: 0.465 };

// ---------------------------------------------------------------- the rules
// A board is a string of n×n places, row by row: '.', 'b' or 'w'.

export const emptyBoard = (n) => EMPTY.repeat(n * n);

export function neighbours(n, i) {
  const r = Math.floor(i / n);
  const c = i % n;
  const out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

// The group of stones joined to the one at i, and its liberties.
export function groupAt(board, n, i) {
  const c = board[i];
  const stones = [i];
  const libs = new Set();
  if (c === EMPTY) return { stones: [], libs };
  const seen = new Set(stones);
  for (let k = 0; k < stones.length; k++) {
    for (const j of neighbours(n, stones[k])) {
      if (board[j] === EMPTY) libs.add(j);
      else if (board[j] === c && !seen.has(j)) {
        seen.add(j);
        stones.push(j);
      }
    }
  }
  return { stones, libs };
}

// A stone of colour c at i: { board, captured (places), ko } after it, or
// { why } for a move that cannot be played: 'taken' (a stone is there),
// 'suicide' (it would have no liberties) or 'ko' (it would take back the
// stone just taken). `ko` is the place nobody may play at next, or -1.
export function tryMove(board, n, i, c, ko = -1) {
  if (!Number.isInteger(i) || i < 0 || i >= n * n) return { why: 'off' };
  if (board[i] !== EMPTY) return { why: 'taken' };
  if (i === ko) return { why: 'ko' };
  const cells = board.split('');
  cells[i] = c;
  const captured = [];
  for (const j of neighbours(n, i)) {
    if (cells[j] !== other(c)) continue;
    const g = groupAt(cells, n, j);
    if (g.libs.size === 0) for (const s of g.stones) if (cells[s] !== EMPTY) (cells[s] = EMPTY), captured.push(s);
  }
  const mine = groupAt(cells, n, i);
  if (mine.libs.size === 0) return { why: 'suicide' };
  // One stone taking one stone, left with one liberty: taking it straight
  // back would repeat the board, so not next move.
  const nextKo = captured.length === 1 && mine.stones.length === 1 && mine.libs.size === 1 ? captured[0] : -1;
  return { board: cells.join(''), captured, ko: nextKo };
}

// Who has which places at the end: each side's stones, and the empty places
// reached only by its stones. { b, w } counts.
export function score(board, n) {
  const out = { b: 0, w: 0 };
  const seen = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (board[i] !== EMPTY) {
      out[board[i]]++;
      continue;
    }
    if (seen[i]) continue;
    const region = [i];
    seen[i] = 1;
    const touches = new Set();
    for (let k = 0; k < region.length; k++) {
      for (const j of neighbours(n, region[k])) {
        if (board[j] === EMPTY) {
          if (!seen[j]) (seen[j] = 1), region.push(j);
        } else touches.add(board[j]);
      }
    }
    if (touches.size === 1) out[[...touches][0]] += region.length;
  }
  return out;
}

// A place's name as a player reads it: a letter for the column (left to
// right, skipping I as Go boards do) and a number for the row (from the
// bottom), like "C3".
export function placeName(n, i) {
  const letters = 'ABCDEFGHJKLMNOP';
  return `${letters[i % n]}${n - Math.floor(i / n)}`;
}

// ---------------------------------------------------------------- the AI friend's moves
// Kind, not cunning: it takes stones that can be taken, saves its own in
// danger, keeps out of its own eyes and away from moves that leave a stone
// with one liberty, and otherwise plays near the stones already down, with
// a little chance in it, so a child can beat it. It passes once nothing it
// could play still matters.

// A place surrounded by c's stones alone (the edge counts as c's), none of
// them in danger: c's own eye, never to be filled.
function isEye(board, n, i, c) {
  for (const j of neighbours(n, i)) {
    if (board[j] !== c) return false;
    if (groupAt(board, n, j).libs.size < 2) return false;
  }
  return true;
}

// Whose the empty place i is: the colour all round its empty region, or
// null for one both sides reach.
function regionOwner(board, n, i) {
  const region = [i];
  const seen = new Set(region);
  const touches = new Set();
  for (let k = 0; k < region.length; k++) {
    for (const j of neighbours(n, region[k])) {
      if (board[j] !== EMPTY) touches.add(board[j]);
      else if (!seen.has(j)) seen.add(j), region.push(j);
    }
  }
  return touches.size === 1 ? [...touches][0] : null;
}

// How good a move at i is for c, or -Infinity for one it should not play.
export function moveValue(board, n, i, c, ko = -1) {
  if (board[i] !== EMPTY || isEye(board, n, i, c)) return -Infinity;
  const res = tryMove(board, n, i, c, ko);
  if (res.why) return -Infinity;
  const them = other(c);
  let v = res.captured.length * 40;
  const mine = groupAt(res.board, n, i);
  // Saving a group of its own that had one liberty left.
  for (const j of neighbours(n, i)) {
    if (board[j] === c && groupAt(board, n, j).libs.size === 1 && mine.libs.size >= 2) v += 30 + groupAt(board, n, j).stones.length * 5;
  }
  // Leaving its own stones with one liberty, to be taken next.
  if (mine.libs.size === 1 && !res.captured.length) v -= 45 + mine.stones.length * 5;
  else v += Math.min(mine.libs.size, 4) * 2;
  // Squeezing a group of theirs down to one liberty, or two.
  const counted = new Set();
  for (const j of neighbours(n, i)) {
    if (res.board[j] !== them || counted.has(j)) continue;
    const g = groupAt(res.board, n, j);
    for (const s of g.stones) counted.add(s);
    if (g.libs.size === 1) v += 14 + g.stones.length * 3;
    else if (g.libs.size === 2) v += 4;
  }
  // Inside its own area already: no point.
  const before = score(board, n);
  const after = score(res.board, n);
  const gain = after[c] - before[c] + (before[them] - after[them]);
  v += gain * 1.5;
  if (regionOwner(board, n, i) === c) v -= 8;
  const r = Math.floor(i / n);
  const col = i % n;
  const edge = Math.min(r, col, n - 1 - r, n - 1 - col);
  // Off the very edge, early on, on the bigger boards.
  if (n > 5 && edge === 0) v -= 4;
  // Near the stones already down.
  let near = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr;
    const cc = col + dc;
    if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n && board[rr * n + cc] !== EMPTY) near++;
  }
  v += near ? 3 : 0;
  return v;
}

// The AI friend's move as c: a place, or -1 to pass. `random` gives the
// little chance in it.
export function pickMove(game, c, random = Math.random) {
  const { n, b: board, ko } = game;
  const stones = [...board].filter((s) => s !== EMPTY).length;
  // The first stone in the middle, mostly.
  const mid = Math.floor((n * n) / 2);
  if (stones <= 1 && board[mid] === EMPTY && (stones === 0 || random() < 0.7)) return mid;
  let best = -1;
  let bestV = -Infinity;
  for (let i = 0; i < n * n; i++) {
    const v = moveValue(board, n, i, c, ko);
    if (v === -Infinity) continue;
    const noisy = v + random() * 6;
    if (noisy > bestV) {
      bestV = noisy;
      best = i;
    }
  }
  // Nothing worth playing: pass. With the other side passed already, only
  // something that really matters is worth going on for; and never for ever.
  if (best < 0 || bestV < (game.passes ? 20 : 3) || game.m >= n * n * 3) return -1;
  return best;
}

// ---------------------------------------------------------------- Gomoku

// The four ways a row can go: across, down and the two slants.
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// The row of c's stones through i one way (dr, dc), as if c's stone were at
// i: its places, and how many of its two ends are open (empty, on the board).
export function rowAt(board, n, i, c, [dr, dc]) {
  const r0 = Math.floor(i / n);
  const c0 = i % n;
  const places = [i];
  let open = 0;
  for (const s of [1, -1]) {
    let r = r0 + dr * s;
    let col = c0 + dc * s;
    while (r >= 0 && col >= 0 && r < n && col < n && board[r * n + col] === c) {
      places.push(r * n + col);
      r += dr * s;
      col += dc * s;
    }
    if (r >= 0 && col >= 0 && r < n && col < n && board[r * n + col] === EMPTY) open++;
  }
  return { places, open };
}

// Five or more in a row through i for the stone there: its places, or null.
export function fiveAt(board, n, i) {
  const c = board[i];
  if (c !== BLACK && c !== WHITE) return null;
  for (const d of DIRS) {
    const row = rowAt(board, n, i, c, d);
    if (row.places.length >= ROW) return row.places.sort((a, b) => a - b);
  }
  return null;
}

// The longest row the stone at i makes that is worth a word: { len, open }
// for four in a row (open at either end) or three open at both, or null.
export function threatAt(board, n, i) {
  const c = board[i];
  let best = null;
  for (const d of DIRS) {
    const { places, open } = rowAt(board, n, i, c, d);
    const len = places.length;
    if (len >= ROW) return null;
    if ((len === 4 && open > 0) || (len === 3 && open === 2)) {
      if (!best || len > best.len || (len === best.len && open > best.open)) best = { len, open };
    }
  }
  return best;
}

// What a row of len with `open` ends is worth to whoever makes it.
function rowWorth(len, open) {
  if (len >= ROW) return 1e6;
  if (open === 0) return 0;
  if (len === 4) return open === 2 ? 5e4 : 4000;
  if (len === 3) return open === 2 ? 3000 : 150;
  if (len === 2) return open === 2 ? 80 : 10;
  return open;
}

// How good a stone at i is for c: what it makes for c, and what it stops
// the other side making there.
export function gomokuValue(board, n, i, c, random = Math.random) {
  if (board[i] !== EMPTY) return -Infinity;
  let attack = 0;
  let defense = 0;
  for (const d of DIRS) {
    const mine = rowAt(board, n, i, c, d);
    attack += rowWorth(mine.places.length, mine.open);
    const theirs = rowAt(board, n, i, other(c), d);
    let stop = rowWorth(theirs.places.length, theirs.open);
    // Now and then it misses an open three coming, so a child can win.
    if (theirs.places.length === 3 && theirs.open === 2 && random() < 0.35) stop = 60;
    defense += stop;
  }
  return attack + defense * 0.9;
}

// The AI friend's move at Gomoku: a place near the stones already down (the
// middle first), or -1 for a full board.
export function pickGomoku(game, c, random = Math.random) {
  const { n, b: board } = game;
  const mid = Math.floor((n * n) / 2);
  if (board[mid] === EMPTY && ![...board].some((s) => s !== EMPTY)) return mid;
  let best = -1;
  let bestV = -Infinity;
  for (let i = 0; i < n * n; i++) {
    if (board[i] !== EMPTY) continue;
    const r = Math.floor(i / n);
    const col = i % n;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2 && !near; dc++) {
      const rr = r + dr;
      const cc = col + dc;
      if (rr >= 0 && cc >= 0 && rr < n && cc < n && board[rr * n + cc] !== EMPTY) near = true;
    }
    if (!near) continue;
    const v = gomokuValue(board, n, i, c, random) * (1 + random() * 0.15) + random() * 5;
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  if (best < 0 && board[mid] === EMPTY) return mid;
  if (best < 0) best = board.indexOf(EMPTY);
  return best;
}

// The AI friend's move, at whichever game: a place, or -1 to pass.
export function pickFor(game, c, random = Math.random) {
  return game.kind === 'gomoku' ? pickGomoku(game, c, random) : pickMove(game, c, random);
}

// ---------------------------------------------------------------- teaching
// The rules in steps, as the window's 📖 How to play shows them and the AI
// friend teaches them as you play, each with a little picture: a board's
// rows, with 'o' marking a breathing space and 'x' a place not to play.
export const LESSONS = [
  {
    key: 'turns',
    title: 'Take turns',
    text: 'Black and white take turns putting one stone on a crossing of the lines. Black goes first. Stones never move once they are down.',
    board: ['.....', '.....', '..b..', '.w...', '.....'],
  },
  {
    key: 'liberties',
    title: 'Breathing spaces',
    text: 'The empty crossings right next to a stone, along the lines, are its breathing spaces (liberties). Stones side by side share them.',
    board: ['.....', '..o..', '.obo.', '..o..', '.....'],
  },
  {
    key: 'capture',
    title: 'Capture!',
    text: 'Fill in the last breathing space of a stone, or of a group, and it is captured: it comes off the board. Watch out when yours have only one left!',
    board: ['.....', '..w..', '.wbw.', '..o..', '.....'],
  },
  {
    key: 'nowhere',
    title: 'No breath, no stone',
    text: 'You may not put a stone where it would have no breathing space at all, unless it captures. And a single stone just taken cannot be taken straight back (that is ko).',
    board: ['.....', '..w..', '.wxw.', '..w..', '.....'],
  },
  {
    key: 'area',
    title: 'Make a home',
    text: 'Use your stones like a fence to surround empty places. When nothing more helps, pass. After two passes in a row, count your stones and the places only you surround: more wins!',
    board: ['..b..', '..bw.', '.bbw.', 'bbww.', '.bw..'],
  },
];

// Gomoku's rules, the same way ('o' marks where to play).
export const GOMOKU_LESSONS = [
  {
    key: 'five',
    title: 'Five in a row',
    text: 'Take turns putting one stone on a crossing, black first. The first to get five stones in a row wins: across, down or slanting!',
    board: ['.......', '.......', '.bbbbb.', '..www..', '...w...', '.......', '.......'],
  },
  {
    key: 'block',
    title: 'Block it!',
    text: 'Watch your friend\'s stones too. Three in a row with both ends open is dangerous: put your stone on one end to block it.',
    board: ['.......', '.......', '.owww..', '...b...', '..b....', '.......', '.......'],
  },
  {
    key: 'four',
    title: 'Open four',
    text: 'Four in a row with both ends open cannot be stopped: block one end and the other wins. Make one of your own, and block theirs at three!',
    board: ['.......', '.......', '.obbbbo', '.w.w...', '..w....', '.......', '.......'],
  },
];
export const lessonsOf = (kind) => (kind === 'gomoku' ? GOMOKU_LESSONS : LESSONS);

// What a try that did not go on the board was, in words.
export const NO_MOVE = {
  taken: 'There is a stone there already.',
  suicide: 'Not there: your stone would have no breathing space, so it would be captured straight away.',
  ko: 'Not there yet: that would take back the stone just taken (ko). Play somewhere else first!',
  turn: 'Wait for your turn!',
  off: 'Put your stone on a crossing of the lines.',
};

// ---------------------------------------------------------------- the host's side

export class GoSim {
  constructor() {
    // By board cell key: { k, x, y, z, n, b (board), t (whose turn), p
    // ([black pid, white pid], 0 for an empty seat), cap ({ b, w }: stones
    // each has taken), ko, last (the last stone, or -1), passes (in a row),
    // m (moves played), over (null, or { b, w, win, why }), call (the AI
    // friend asked for), ai (its pid, sitting as white, or 0), kind ('go'
    // or 'gomoku') }; over has the five's places, `line`, at Gomoku.
    this.games = new Map();
  }

  // A new game at a board, with whoever sat at it as black.
  start(x, y, z, pid, n = DEFAULT_SIZE, white = 0, kind = 'go') {
    const k = keyOf(x, y, z);
    const game = gameOf(kind);
    const g = { k, x, y, z, kind: game.key, n: game.sizes.includes(n) ? n : game.size, b: '', t: BLACK, p: [pid, white], cap: { b: 0, w: 0 }, ko: -1, last: -1, passes: 0, m: 0, over: null, call: false, ai: 0 };
    g.b = emptyBoard(g.n);
    this.games.set(k, g);
    return g;
  }

  colorOf(g, pid) {
    if (g.p[0] === pid) return BLACK;
    if (g.p[1] === pid) return WHITE;
    return null;
  }

  // Sitting down at a board: a new game if none is going there, or the
  // empty seat of one that is. The AI friend (`ai`) sits only where it was
  // called, as white. [fx] of what happened.
  sit(x, y, z, pid, ai = false, kind = 'go') {
    const k = keyOf(x, y, z);
    const g = this.games.get(k);
    if (ai) {
      if (!g?.call || g.p[1] || g.over) return [];
      g.p[1] = pid;
      g.ai = pid;
      g.call = false;
      return [{ k, f: 'sit', by: pid, c: WHITE, ai: true }];
    }
    if (!g) {
      this.start(x, y, z, pid, undefined, 0, kind);
      return [{ k, f: 'sit', by: pid, c: BLACK }];
    }
    if (this.colorOf(g, pid)) return [];
    const seat = g.p[0] === 0 ? 0 : g.p[1] === 0 && !g.call ? 1 : -1;
    if (seat < 0) return [];
    g.p[seat] = pid;
    return [{ k, f: 'sit', by: pid, c: seat === 0 ? BLACK : WHITE }];
  }

  // Whether nobody but the AI friend is at a game any more.
  deserted(g) {
    return !g.p.some((pid) => pid && pid !== g.ai);
  }

  // A fresh board at size n, for a player at it (the same two playing), of
  // the same game or the other one.
  restart(k, pid, n, kind = null) {
    const g = this.games.get(k);
    if (!g || !this.colorOf(g, pid)) return [];
    const game = gameOf(kind ?? g.kind);
    const fresh = this.start(g.x, g.y, g.z, g.p[0], game.sizes.includes(n) ? n : game.key === g.kind ? g.n : game.size, g.p[1], game.key);
    fresh.call = g.call;
    fresh.ai = g.ai;
    return [{ k, f: 'new', by: pid, n: fresh.n, kind: fresh.kind }];
  }

  // 🤖 Play with Pip: the AI friend asked to come and play white.
  call(k, pid) {
    const g = this.games.get(k);
    if (!g || g.p[0] !== pid || g.p[1]) return [];
    g.call = true;
    return [{ k, f: 'call', by: pid }];
  }

  // A stone from a player whose turn it is: [fx], or { why } when it
  // cannot go there.
  move(k, pid, i) {
    const g = this.games.get(k);
    if (!g || g.over) return [];
    const c = this.colorOf(g, pid);
    if (!c) return [];
    if (c !== g.t || !g.p[0] || !g.p[1]) return { why: 'turn' };
    if (g.kind === 'gomoku') return this.moveGomoku(g, pid, c, i);
    const res = tryMove(g.b, g.n, i, c, g.ko);
    if (res.why) return { why: res.why };
    g.b = res.board;
    g.ko = res.ko;
    g.cap[c] += res.captured.length;
    g.last = i;
    g.passes = 0;
    g.m++;
    g.t = other(c);
    const fx = [{ k, f: 'move', by: pid, c, i, took: res.captured.length }];
    // Groups of the other side's left with one liberty (atari).
    const warned = new Set();
    for (const j of neighbours(g.n, i)) {
      if (g.b[j] !== other(c) || warned.has(j)) continue;
      const grp = groupAt(g.b, g.n, j);
      for (const s of grp.stones) warned.add(s);
      if (grp.libs.size === 1) fx.push({ k, f: 'atari', c: other(c), i: j, n: grp.stones.length });
    }
    return fx;
  }

  // A stone at Gomoku: five in a row wins, a full board is a draw, and four
  // in a row (or an open three) is told of, to look out for.
  moveGomoku(g, pid, c, i) {
    if (!Number.isInteger(i) || i < 0 || i >= g.n * g.n) return { why: 'off' };
    if (g.b[i] !== EMPTY) return { why: 'taken' };
    g.b = g.b.slice(0, i) + c + g.b.slice(i + 1);
    g.last = i;
    g.m++;
    g.t = other(c);
    const fx = [{ k: g.k, f: 'move', by: pid, c, i, took: 0 }];
    const line = fiveAt(g.b, g.n, i);
    if (line) fx.push(this.finish(g, 'five', c, line));
    else if (!g.b.includes(EMPTY)) fx.push(this.finish(g, 'full', 'draw'));
    else {
      const threat = threatAt(g.b, g.n, i);
      if (threat) fx.push({ k: g.k, f: 'row', c, i, ...threat });
    }
    return fx;
  }

  pass(k, pid) {
    const g = this.games.get(k);
    if (!g || g.over || g.kind === 'gomoku') return [];
    const c = this.colorOf(g, pid);
    if (!c || c !== g.t || !g.p[1]) return [];
    g.passes++;
    g.m++;
    g.ko = -1;
    g.t = other(c);
    const fx = [{ k, f: 'pass', by: pid, c }];
    if (g.passes >= 2) fx.push(this.finish(g, 'score'));
    return fx;
  }

  resign(k, pid) {
    const g = this.games.get(k);
    if (!g || g.over) return [];
    const c = this.colorOf(g, pid);
    if (!c || !g.p[1]) return [];
    return [this.finish(g, 'resign', other(c))];
  }

  finish(g, why, winner = null, line = null) {
    if (g.kind === 'gomoku') {
      g.over = { win: winner, why, ...(line ? { line } : {}) };
      return { k: g.k, f: 'end', kind: g.kind, ...g.over, p: [...g.p] };
    }
    const s = score(g.b, g.n);
    const win = winner ?? (s.b > s.w ? BLACK : s.w > s.b ? WHITE : 'draw');
    g.over = { b: s.b, w: s.w, win, why };
    return { k: g.k, f: 'end', kind: g.kind, ...g.over, p: [...g.p] };
  }

  // Someone gone from the island, or up from a board: out of their seat,
  // and a board nobody is at any more is cleared. Whether anything changed.
  left(pid) {
    let changed = false;
    for (const [k, g] of this.games) {
      const seat = g.p.indexOf(pid);
      if (seat < 0) continue;
      g.p[seat] = 0;
      if (g.ai === pid) g.ai = 0;
      changed = true;
      if (this.deserted(g)) this.games.delete(k);
    }
    return changed;
  }

  // Getting up from one board.
  leave(k, pid) {
    const g = this.games.get(k);
    if (!g) return false;
    const seat = g.p.indexOf(pid);
    if (seat < 0) return false;
    g.p[seat] = 0;
    if (g.ai === pid) g.ai = 0;
    // Nobody but the AI friend left (or nobody at all): the game is over.
    if (this.deserted(g)) this.games.delete(k);
    return true;
  }

  removeAt(x, y, z) {
    return this.games.delete(keyOf(x, y, z));
  }

  // Every game, as the pages and the AI friend get them.
  pack() {
    return [...this.games.values()].map((g) => ({ k: g.k, kind: g.kind, x: g.x, y: g.y, z: g.z, n: g.n, b: g.b, t: g.t, p: [...g.p], cap: { ...g.cap }, ko: g.ko, last: g.last, passes: g.passes, m: g.m, over: g.over, call: g.call, ai: g.ai }));
  }
}
