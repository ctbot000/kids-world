// The ranking: players with a login side by side, on a few boards, each
// counting one thing they did. The keeper ranks them from the profiles their
// devices sent (see server/keeper.js), and a page shows the boards (ui.js).
// Players show up by their display name and look, the way friends see them,
// never by their username; a player can leave the ranking, and a grown-up
// can take them out of it on the admin pages.
import { STICKERS } from './stickers.js';

// The players each board shows; anyone further down sees only their own place.
export const RANKING_TOP = 10;

// More than anyone does: a count above it is taken as this.
const MOST = 10_000_000;

const count = (n) => (Number.isFinite(n) && n > 0 ? Math.min(MOST, Math.floor(n)) : 0);

// score: from a profile as the keeper keeps it (keptProfile). hint: how to
// get on the board.
export const BOARDS = [
  { key: 'stickers', icon: '⭐', name: 'Stickers', text: 'Most stickers', hint: 'Earn a sticker', score: (p) => STICKERS.filter((s) => p.stickers[s.key]).length },
  { key: 'builders', icon: '🧱', name: 'Builders', text: 'Most blocks put down', hint: 'Put a block down', score: (p) => count(p.stats.placed) },
  { key: 'animals', icon: '🐰', name: 'Animals', text: 'Most animals petted', hint: 'Pet an animal', score: (p) => count(p.stats.petted) },
  { key: 'treasures', icon: '🍎', name: 'Treasures', text: 'Most fruit, seashells and star pieces found', hint: 'Pick a fruit', score: (p) => count(count(p.stats.fruit) + count(p.stats.shells) + count(p.stats.stars)) },
  { key: 'explorers', icon: '🧭', name: 'Explorers', text: 'Most steps walked', hint: 'Go for a walk', score: (p) => count(p.stats.steps) },
];

// Every board for these players: [{ id, profile }], profiles as kept. On
// each, the top RANKING_TOP who have done any of it, most first; players
// with the same score share a place (1, 2, 2, 4), and are in the order of
// their names. me: the id of the player asking, who also gets their own
// place on each board they are on, wherever it is, and is marked in the top.
//   → { players, boards: [{ key, top: [{ rank, name, look, score, you? }], you?: { rank, score } }] }
export function rankBoards(players, me = null, top = RANKING_TOP) {
  const named = players.filter((p) => p.profile?.name);
  return {
    players: named.length,
    boards: BOARDS.map((board) => {
      const scored = named.map((p) => ({ id: p.id, name: p.profile.name, look: p.profile.look, score: board.score(p.profile) })).filter((p) => p.score > 0);
      scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1));
      scored.forEach((p, i) => (p.rank = i > 0 && p.score === scored[i - 1].score ? scored[i - 1].rank : i + 1));
      const mine = me ? scored.find((p) => p.id === me) : null;
      return {
        key: board.key,
        top: scored.slice(0, top).map((p) => ({ rank: p.rank, name: p.name, look: p.look, score: p.score, ...(p.id === me ? { you: true } : {}) })),
        ...(mine ? { you: { rank: mine.rank, score: mine.score } } : {}),
      };
    }),
  };
}
