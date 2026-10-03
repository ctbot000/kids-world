// The keeper's admin page: who has sent copies, their islands seen from above
// (drawn with the game's own map code), and downloads or deletes, and their
// logins: a new password for a player who forgot theirs, none at all, or the
// copies of a device that is gone moved into a player's login. It reads
// /admin/api/state every few seconds.
import { buildAtlas } from '/js/render/atlas.js';
import { shirtColor } from '/js/render/avatar.js';
import { MapImage } from '/js/minimap.js';
import { STICKERS } from '/js/profile.js';
import { prettyCode } from '/js/shared/codes.js';
import { passwordProblem, usernameProblem } from '/js/shared/keeper.js';
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

// While a password is being typed, the page is not redrawn under it.
let editing = 0;

const PASSWORD_WORDS = { short: 'A password needs at least 6 characters.', long: 'At most 64 characters.', name: 'Not the username.' };
const USERNAME_WORDS = { short: 'A username needs at least 2 characters.', long: 'At most 32 characters.', odd: 'Only characters you can see.' };

// A new password for a player, typed here to be told to them, or for one
// with no login yet, a username too; done() once saved or cancelled.
function passwordForm(device, done) {
  editing++;
  const name = device.profile?.name ?? '';
  const username = device.login ? null : h('input', { type: 'text', autocomplete: 'off', placeholder: 'Username', 'aria-label': `Username for ${name || 'the player'}` });
  const input = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Password', 'aria-label': `New password for ${name || 'the player'}` });
  for (const box of [username, input]) if (box) box.spellcheck = false;
  const note = h('span', { class: 'muted', 'aria-live': 'polite' });
  const close = () => {
    editing--;
    done();
  };
  const save = async (e) => {
    e.preventDefault();
    const odd = username ? usernameProblem(username.value) : '';
    if (odd) {
      note.textContent = USERNAME_WORDS[odd];
      return;
    }
    const problem = passwordProblem(input.value, username ? username.value : device.login.username);
    if (problem) {
      note.textContent = PASSWORD_WORDS[problem];
      return;
    }
    const res = await api(`devices/${device.id}/login`, {
      method: 'PUT',
      headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input.value, ...(username ? { username: username.value } : {}) }),
    });
    if (!res.ok) {
      note.textContent = (await res.json().catch(() => null))?.error ?? 'That did not work. Is the keeper still running?';
      return;
    }
    close();
    refresh(true);
  };
  setTimeout(() => (username ?? input).focus(), 0);
  return h(
    'form',
    { class: 'picker', onsubmit: save },
    h(
      'div',
      { class: 'muted' },
      username
        ? `Type a username and a password for ${name || 'the player'}, then tell them what they are.`
        : `Type a new password, then tell ${name || 'the player'} what it is. Devices logged in as them stay so.`,
    ),
    h('div', { class: 'actions' }, username, input, h('button', { type: 'submit' }, 'Save'), h('button', { type: 'button', onclick: close }, 'Cancel'), note),
  );
}

// A player's login: its username, on how many devices it is, and whether it
// still needs a password (one made with secret pictures, before passwords);
// a new password for one who forgot theirs, or none. A device with no login
// can have its copies moved into a player's login instead, say once a
// tablet is replaced and its player logs in on the new one.
function loginRow(device, players) {
  const login = device.login;
  const name = device.profile?.name || 'this player';
  const slot = h('div');
  const type = () => slot.replaceChildren(passwordForm(device, () => slot.replaceChildren()));
  const into = h('select', { 'aria-label': `Player to move ${name}'s copies to` }, ...players.map((p) => h('option', { value: p.id }, `${p.login.username || p.profile?.name || p.id}${p.profile?.name ? ` (${p.profile.name})` : ''}`)));
  const move = async () => {
    const to = players.find((p) => p.id === into.value);
    const what = plural(device.islands.length, 'island', 'islands');
    const whose = to?.login.username || to?.profile?.name || 'that player';
    if (!to || !confirm(`Move ${name}'s ${what} and stickers into ${whose}'s login? These copies then show up on every device logged in as them, and ${name} goes from this list.`)) return;
    const res = await api(`devices/${device.id}/move`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ to: to.id }) });
    if (!res.ok) alert(`That could not be moved: ${(await res.json().catch(() => null))?.error ?? 'is the keeper still running?'}`);
    refresh(true);
  };
  const words = login
    ? `🔑 Logs in as ${login.username || name} on ${plural(login.devices, 'device', 'devices')}${login.password ? '' : ' · needs a password (it had secret pictures)'}`
    : '🔑 No login';
  return h(
    'div',
    { class: 'login' },
    h(
      'div',
      { class: 'login-line' },
      h('span', {}, words),
      h('button', { type: 'button', onclick: type }, login ? (login.password ? 'New password' : 'Set a password') : 'Make a login'),
      login
        ? h(
            'button',
            { class: 'danger', type: 'button', onclick: () => remove(`devices/${device.id}/login`, `Remove ${name}'s login? Every device logged in as ${name} is logged out.`) },
            'Remove login',
          )
        : null,
      !login && players.length ? h('span', { class: 'move' }, into, h('button', { type: 'button', onclick: move }, 'Move into this login')) : null,
    ),
    slot,
  );
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

const DID = {
  island: (e) => ` sent “${e.island}”`,
  profile: () => ' sent their profile',
  login: (e) => ` logged in on a device${e.username ? ` as ${e.username}` : ''}`,
  'made-login': (e) => ` made a login${e.username ? `, ${e.username}` : ''}`,
  'new-password': () => ' picked a new password',
  adopt: (e) => ` brought ${e.islands ? (e.islands === 1 ? 'an island' : `${e.islands} islands`) : 'what they did'} from before into their login`,
};

function renderRecent(state) {
  const recent = state.keeper?.recent ?? [];
  $('recent-section').hidden = recent.length === 0;
  $('recent').replaceChildren(
    ...recent.slice(0, 8).map((e) => h('li', {}, h('time', {}, time.format(e.at)), ' ', h('b', {}, e.player || 'A player'), (DID[e.what] ?? DID.profile)(e))),
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
      island.forgotten ? h('div', { class: 'muted' }, `🗑️ Said goodbye to ${ago(island.forgotten)}, on one of their devices`) : null,
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

function deviceCard(device, players) {
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
    loginRow(device, players.filter((p) => p.id !== device.id)),
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
  if (editing || (key === shown && Date.now() - drawnAt < REDRAW_MS)) return;
  shown = key;
  drawnAt = Date.now();
  $('devices').replaceChildren(
    ...(state.devices.length
      ? state.devices.map((d) => deviceCard(d, state.devices.filter((p) => p.login)))
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
