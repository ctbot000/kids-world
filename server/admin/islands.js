// The admin page's Islands tab: every island being played now that the
// keeper knows of: those open to friends (the list pages see in Visit a
// friend) and, hidden from that list, those played alone or closed to new
// visitors. Each has 👁️ Watch, which opens the game in a new tab watching
// it unseen (see public/js/shared/watch.js): nobody there sees or hears of it.
// An island the keeper kept (the Players tab) is watched live while it is
// being played, and otherwise its copy is opened to look round, as nobody.
import { prettyCode } from '/js/shared/codes.js';
import { THEMES } from '/js/shared/worldgen.js';

const $ = (id) => document.getElementById(id);

function islandRow(h, island, watch) {
  const theme = THEMES.find((t) => t.key === island.theme);
  // (A stage of Adventure Isle already won is no longer the public one.)
  const kind = island.public || island.adventure ? '🌟 Adventure Isle' : island.watch ? '🏢 CTB' : island.defense ? '🛡️ Tower defense' : '';
  const stage = island.adventure ? `stage ${island.adventure.stage}, ${island.adventure.won ? 'won' : `${island.adventure.freed} of ${island.adventure.camps} camps free`}` : island.defense ? `wave ${island.defense.wave} of ${island.defense.waves}` : '';
  return h(
    'li',
    { class: 'island-open' },
    h('span', { class: 'island-icon', 'aria-hidden': 'true' }, theme?.icon ?? '🏝️'),
    h(
      'div',
      { class: 'island-about' },
      h('b', {}, island.name),
      h('span', { class: 'muted' }, [`Code ${prettyCode(island.code)}`, `${island.players} of ${island.max} playing`, island.passcode ? '🔒 passcode' : '', kind, stage].filter(Boolean).join(' · ')),
    ),
    island.hidden ? h('span', { class: 'badge', title: 'Played alone or closed to new visitors: not on the list friends see' }, 'Not open to friends') : null,
    h('button', { type: 'button', class: 'primary', 'aria-label': `Watch ${island.name} unseen`, onclick: () => watch(island) }, '👁️ Watch'),
  );
}

// Returns { refresh(keeper), watchKept(device, island, day) }: refresh shows
// the list again, with the keeper's status (null: no keeper here, and the
// tab goes); watchKept watches a kept island (day: which copy, '' the latest).
export function setUpIslands({ h }) {
  let shown = '';
  const section = $('islands-section');

  // Opened before asking, so no pop-up blocker stops it.
  const show = (tab, url) => {
    if (tab) tab.location.href = url.href;
    else location.href = url.href;
  };

  async function watchKept(device, island, day = '') {
    const tab = window.open('about:blank', '_blank');
    let live = null;
    try {
      const res = await fetch('/admin/api/islands', { cache: 'no-store' });
      if (res.ok) live = (await res.json()).islands.find((i) => i.code === island.code) ?? null;
    } catch {}
    // The latest copy asked for, and it is being played: watch it live.
    if (live && !day) return watch(live, tab);
    const url = new URL('/', location.href);
    url.searchParams.set('p2p', '1');
    url.searchParams.set('copy', `${device}/${island.id}`);
    if (day) url.searchParams.set('day', day);
    show(tab, url);
  }

  async function watch(island, tab = window.open('about:blank', '_blank')) {
    try {
      const res = await fetch(`/admin/api/islands/${island.code}/watch`, { method: 'POST', cache: 'no-store', headers: { 'X-Kids-World-Admin': '1' } });
      const reply = res.ok ? await res.json() : null;
      if (!reply?.ticket) throw new Error();
      // Peer to peer, as the islands are, whatever this server is.
      const url = new URL('/', location.href);
      url.searchParams.set('p2p', '1');
      if (reply.signal) url.searchParams.set('signal', reply.signal);
      url.searchParams.set('watch', island.code);
      url.searchParams.set('ticket', reply.ticket);
      show(tab, url);
    } catch {
      tab?.close();
      alert(`${island.name} is not being played any more.`);
    }
  }

  async function refresh(keeper) {
    section.hidden = !keeper;
    if (!keeper) return;
    let islands = null;
    try {
      const res = await fetch('/admin/api/islands', { cache: 'no-store' });
      if (res.ok) islands = (await res.json()).islands;
    } catch {
      islands = null;
    }
    if (!Array.isArray(islands)) return;
    $('islands-count').textContent = islands.length || '';
    const key = JSON.stringify(islands);
    if (key === shown) return;
    shown = key;
    $('islands').replaceChildren(
      h('p', { class: 'muted' }, 'The islands being played now, open to friends or not. 👁️ Watch flies over one in a new tab, unseen: nobody there sees you, hears of you or counts you, and you touch nothing.'),
      islands.length ? h('ol', { class: 'recent island-list card' }, ...islands.map((i) => islandRow(h, i, watch))) : h('p', { class: 'empty' }, 'No island is being played right now.'),
    );
  }

  return { refresh, watchKept };
}
