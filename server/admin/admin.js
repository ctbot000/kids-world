// The keeper's admin page: who has sent copies, their islands seen from above
// (drawn with the game's own map code), and downloads or deletes. It reads
// /admin/api/state every few seconds.
import { buildAtlas } from '/js/render/atlas.js';
import { shirtColor } from '/js/render/avatar.js';
import { MapImage } from '/js/minimap.js';
import { STICKERS } from '/js/profile.js';
import { prettyCode } from '/js/shared/codes.js';
import { World } from '/js/shared/world.js';
import { ANIMALS } from '/js/shared/words.js';
import { THEMES } from '/js/shared/worldgen.js';

const REFRESH_MS = 5000;
const REDRAW_MS = 60000;
const $ = (id) => document.getElementById(id);

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const at = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function ago(t) {
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return at.format(t);
}

function size(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const api = (path, options) => fetch(`/admin/api/${path}`, { cache: 'no-store', ...options });

// ---------------------------------------------------------------- pictures

let atlas = null;
let drawing = Promise.resolve();
const pictures = new Map();

// The island from above, one pixel per column, as a data URL. One island at a
// time, so a page full of them does not freeze; each copy is drawn only once.
function picture(device, island) {
  const key = `${device}/${island.id}/${island.keptAt}`;
  if (!pictures.has(key)) {
    const job = drawing.then(async () => {
      const res = await api(`devices/${device}/islands/${island.id}`);
      if (!res.ok) return null;
      const save = await res.json();
      const world = World.decode(save.meta, save.blocks);
      atlas ??= buildAtlas();
      const map = new MapImage(world, atlas.studTint);
      const canvas = document.createElement('canvas');
      canvas.width = world.W;
      canvas.height = world.D;
      canvas.getContext('2d').putImageData(new ImageData(map.rgba, world.W, world.D), 0, 0);
      return canvas.toDataURL();
    });
    drawing = job.catch(() => null);
    pictures.set(
      key,
      job.catch(() => null),
    );
  }
  return pictures.get(key);
}

// ---------------------------------------------------------------- changes

async function remove(path, question) {
  if (!confirm(question)) return;
  const res = await api(path, { method: 'DELETE', headers: { 'X-Kids-World-Admin': '1' } });
  if (!res.ok) alert('That could not be deleted. Is the keeper still running?');
  refresh(true);
}

// ---------------------------------------------------------------- drawing

function renderStatus(state) {
  const el = $('status');
  const k = state?.keeper;
  if (!state) {
    el.className = 'status off';
    el.textContent = 'The keeper is not running. Start it with npm start.';
    return;
  }
  if (!k) {
    el.className = 'status off';
    el.textContent = 'Not online as the keeper: run npm run keeper-setup, then npm start again.';
    return;
  }
  const words = {
    online: `Online as ${k.peer}`,
    connecting: 'Connecting to the signaling server…',
    reconnecting: 'Lost the signaling server; reconnecting…',
    'id-taken': 'Waiting for the keeper’s id to come free…',
    error: `The signaling server said no: ${k.detail}`,
    off: 'Off',
  };
  el.className = `status ${k.state === 'online' ? 'on' : 'wait'}`;
  el.replaceChildren(
    h(
      'span',
      {},
      h('b', {}, words[k.state] ?? k.state),
      k.state === 'online' ? ` since ${time.format(k.since)}` : null,
      k.connections ? ` · ${plural(k.connections, 'player', 'players')} sending now` : null,
    ),
  );
}

function renderSummary(state) {
  const islands = state.devices.reduce((n, d) => n + d.islands.length, 0);
  const full = state.bytes / state.maxBytes;
  $('summary').replaceChildren(
    h('div', { class: 'stat' }, h('b', {}, state.devices.length), h('span', {}, state.devices.length === 1 ? 'player' : 'players')),
    h('div', { class: 'stat' }, h('b', {}, islands), h('span', {}, islands === 1 ? 'island' : 'islands')),
    h('div', { class: `stat${full > 0.9 ? ' warn' : ''}` }, h('b', {}, size(state.bytes)), h('span', {}, `of ${size(state.maxBytes)}`)),
    h('p', { class: 'muted where' }, 'Copies are kept in ', h('code', {}, state.dataDir), `, one a day for the last ${state.keepDays} days each island was played.`),
  );
}

function renderRecent(state) {
  const recent = state.keeper?.recent ?? [];
  $('recent-section').hidden = recent.length === 0;
  $('recent').replaceChildren(
    ...recent.slice(0, 8).map((e) =>
      h('li', {}, h('time', {}, time.format(e.at)), ' ', h('b', {}, e.player || 'A player'), e.what === 'island' ? ` sent “${e.island}”` : ' sent their profile'),
    ),
  );
}

function islandCard(device, island) {
  const theme = THEMES.find((t) => t.key === island.theme);
  const img = h('img', { class: 'map', alt: `${island.name} from above`, width: 128, height: 128 });
  picture(device.id, island).then((url) => {
    if (url) img.src = url;
    else img.classList.add('missing');
  });
  const choice = h('select', { 'aria-label': `Which copy of ${island.name}` }, ...island.days.map((day, k) => h('option', { value: day }, k === 0 ? `Latest (${day})` : day)));
  const download = h('a', { class: 'button', download: '' }, '⬇️ Download');
  const point = () => download.setAttribute('href', `/admin/api/devices/${device.id}/islands/${island.id}?day=${choice.value}&download`);
  choice.addEventListener('change', point);
  point();
  const who = device.profile?.name || 'this player';
  return h(
    'article',
    { class: 'island' },
    img,
    h(
      'div',
      { class: 'about' },
      h('h4', {}, `${theme?.icon ?? '🏝️'} ${island.name}`),
      h('div', { class: 'muted' }, [theme?.name, island.code ? `code ${prettyCode(island.code)}` : null].filter(Boolean).join(' · ')),
      h('div', { class: 'muted' }, `Saved ${ago(island.savedAt)} · ${size(island.bytes)} · ${plural(island.days.length, 'copy', 'copies')}`),
      h(
        'div',
        { class: 'actions' },
        choice,
        download,
        h('button', { class: 'danger', type: 'button', onclick: () => remove(`devices/${device.id}/islands/${island.id}`, `Delete every copy of “${island.name}” from ${who}? This cannot be undone.`) }, 'Delete'),
      ),
    ),
  );
}

function deviceCard(device) {
  const p = device.profile;
  const animal = ANIMALS.find((a) => a.key === p?.look?.animal);
  const stickers = STICKERS.filter((s) => p?.stickers?.[s.key]);
  const treasures = Object.values(p?.basket ?? {}).reduce((a, b) => a + b, 0);
  const name = p?.name || 'A player';
  return h(
    'article',
    { class: 'device' },
    h(
      'header',
      { class: 'who' },
      h('span', { class: 'avatar', style: `--c:${p ? shirtColor(p.look.shirt) : '#d8cfe0'}`, 'aria-hidden': 'true' }, animal?.icon ?? '🙂'),
      h('div', { class: 'name' }, h('h3', {}, name), h('div', { class: 'muted' }, `Last seen ${ago(device.lastSeen)} · first seen ${at.format(device.firstSeen)}`)),
      h(
        'button',
        { class: 'danger quiet', type: 'button', onclick: () => remove(`devices/${device.id}`, `Delete everything kept from ${name}: ${plural(device.islands.length, 'island', 'islands')} and their profile? This cannot be undone.`) },
        'Delete player',
      ),
    ),
    p
      ? h(
          'div',
          { class: 'facts' },
          h('span', { title: stickers.map((s) => s.name).join(', ') || 'No stickers yet' }, `🏅 ${stickers.length} of ${STICKERS.length} stickers `, h('span', { class: 'icons' }, stickers.map((s) => s.icon).join(''))),
          h('span', {}, `🧺 ${plural(treasures, 'treasure', 'treasures')}`),
          h('span', {}, `🧱 ${plural(p.stats?.placed ?? 0, 'block', 'blocks')} built`),
        )
      : null,
    device.islands.length ? h('div', { class: 'islands' }, ...device.islands.map((i) => islandCard(device, i))) : h('p', { class: 'muted' }, 'No islands yet: this player has only visited friends.'),
  );
}

let shown = '';
let drawnAt = 0;

function render(state) {
  renderStatus(state);
  if (!state) return;
  renderSummary(state);
  renderRecent(state);
  const key = JSON.stringify(state.devices);
  if (key === shown && Date.now() - drawnAt < REDRAW_MS) return;
  shown = key;
  drawnAt = Date.now();
  $('devices').replaceChildren(
    ...(state.devices.length
      ? state.devices.map(deviceCard)
      : [h('p', { class: 'empty' }, 'Nothing kept yet. When someone plays while the keeper is online, their islands show up here.')]),
  );
}

let timer = 0;
async function refresh(now = false) {
  clearTimeout(timer);
  let state = null;
  try {
    const res = await api('state');
    if (res.ok) state = await res.json();
  } catch {
    state = null;
  }
  if (now) shown = '';
  render(state);
  timer = setTimeout(refresh, REFRESH_MS);
}

refresh();
