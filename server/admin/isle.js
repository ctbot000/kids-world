// The admin page's Adventure Isle tab: the isle's games going on (server/
// adventure.js), each kept apart at its own stage, with its chapter, journey,
// who started it and when, when it was last played, how many are on it now
// and its camps freed. Each can be started over from stage 1 (↺ Start over)
// or removed (🗑 Remove), asked first: whoever is on it is sent on, to its new
// stage 1 or to another game. 🆕 New game starts one from stage 1, of the
// story's first episode or of a later one.
import { prettyCode } from '/js/shared/codes.js';
import { chapterOf, EPISODES, stageName } from '/js/shared/isle-story.js';

const $ = (id) => document.getElementById(id);
const HEADERS = { 'X-Kids-World-Admin': '1' };

// Returns { refresh() }: refresh shows the games again (the tab goes where
// there is no Adventure Isle).
export function setUpIsle({ h, ago }) {
  const section = $('isle-section');
  let shown = '';
  let note = '';

  async function call(path, method) {
    try {
      const res = await fetch(`/admin/api/isle${path}`, { method, cache: 'no-store', headers: HEADERS });
      const reply = await res.json().catch(() => ({}));
      note = res.ok ? '' : reply.error || 'That did not work.';
    } catch {
      note = 'The keeper did not answer.';
    }
    shown = '';
    await refresh();
  }

  function row(game, count) {
    const ch = chapterOf(game.stage);
    const who = game.by ? `started by ${game.by}` : 'the first game';
    const about = [`${stageName(game.stage)}: ${ch.name}`, game.journey > 1 ? `journey ${game.journey}` : '', `${game.freed} of ${game.camps} camps free`].filter(Boolean).join(' · ');
    const when = [`${who}, ${ago(game.startedAt)}`, `last played ${ago(game.playedAt)}`, game.code ? `code ${prettyCode(game.code)}` : ''].filter(Boolean).join(' · ');
    return h(
      'li',
      { class: 'island-open isle-game-row', 'data-game': String(game.id) },
      h('span', { class: 'island-icon', 'aria-hidden': 'true' }, ch.icon),
      h('div', { class: 'island-about' }, h('b', {}, `Game ${game.id}`, game.first ? h('span', { class: 'badge accent' }, 'first on the list') : ''), h('span', {}, about), h('span', { class: 'muted' }, when)),
      game.players ? h('span', { class: 'badge ok' }, `${game.players} playing`) : null,
      h(
        'button',
        {
          type: 'button',
          title: 'Back to stage 1, the camps to free again; whoever is on it goes on there',
          onclick: () => confirm(`Start game ${game.id} over from stage 1?${game.players ? ` The ${game.players} playing it go on to its stage 1.` : ''}`) && call(`/games/${game.id}/reset`, 'POST'),
        },
        '↺ Start over',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'danger',
          title: count === 1 ? 'The only game: a new one from stage 1 takes its place' : 'Gone for good; whoever is on it goes on to another game',
          onclick: () => confirm(`Remove game ${game.id} (${stageName(game.stage, true)}) for good?${game.players ? ` The ${game.players} playing it go on to another game.` : ''}${count === 1 ? ' A new game from stage 1 takes its place.' : ''}`) && call(`/games/${game.id}`, 'DELETE'),
        },
        '🗑 Remove',
      ),
    );
  }

  async function refresh() {
    let reply = null;
    try {
      const res = await fetch('/admin/api/isle', { cache: 'no-store' });
      if (res.ok) reply = await res.json();
    } catch {
      reply = null;
    }
    section.hidden = !Array.isArray(reply?.games);
    if (section.hidden) return;
    const { games, max } = reply;
    $('isle-count').textContent = games.length || '';
    // (The times shown move on: drawn again every minute at least.)
    const key = JSON.stringify([games, note, Math.floor(Date.now() / 60000)]);
    if (key === shown) return;
    shown = key;
    $('isle').replaceChildren(
      h('p', { class: 'muted' }, `Adventure Isle’s games, each kept apart at its own stage. ↺ Start over sends a game back to stage 1; 🗑 Remove ends it for good. Whoever is playing goes on by themselves: to the new stage 1, or to another game. At most ${max} games go on at once.`),
      note ? h('p', { class: 'error', role: 'alert' }, note) : '',
      h('ol', { class: 'recent island-list card' }, ...games.map((g) => row(g, games.length))),
      h(
        'p',
        { class: 'isle-new' },
        ...EPISODES.map((ep) => h('button', { type: 'button', class: ep.n === 1 ? 'primary' : '', title: ep.title, onclick: () => call(ep.n === 1 ? '/games' : `/episodes/${ep.n}/games`, 'POST') }, ep.n === 1 ? '🆕 New game' : `${ep.icon} New game: Episode ${ep.n}`)),
      ),
    );
  }

  return { refresh };
}
