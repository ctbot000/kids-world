// The keeper's admin page: who has sent copies, their islands seen from above
// (drawn with the game's own map code), and downloads or deletes, and their
// logins: a new password for a player who forgot theirs, none at all, the
// copies of a device that is gone moved into a player's login, or a player
// taken out of the ranking, and where each was last seen from; and the AI
// friend: its settings, what it is doing now, its own island and what it
// builds there, the islands it is on and what is said there, how its model
// answers and what it did lately, with a line to talk with it on an island
// it is on, which its model answers, a line for it to say there, as its own
// words, and its model log: what it asked the model, word for word, and what
// came back. It reads /admin/api/state and /admin/api/friend every few
// seconds — every moment, for a while, after something is said to it, so its
// answer shows as it comes — and /admin/api/friend/llm too while
// the model log is open.
import { buildAtlas } from '/js/render/atlas.js';
import { shirtColor } from '/js/render/avatar.js';
import { MapImage } from '/js/minimap.js';
import { STICKERS } from '/js/profile.js';
import { prettyCode } from '/js/shared/codes.js';
import { passwordProblem, usernameProblem } from '/js/shared/keeper.js';
import { World } from '/js/shared/world.js';
import { CHAT_MAX, lookIcon } from '/js/shared/words.js';
import { THEMES } from '/js/shared/worldgen.js';

const REFRESH_MS = 5000;
const REDRAW_MS = 60000;
// Once something has been said to the AI friend, its state is read this
// often, until this long has passed without another line.
const ANSWER_MS = 1200;
const ANSWER_WATCH_MS = 20000;
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

const countries = new Intl.DisplayNames(undefined, { type: 'region' });

// Where a player was last seen from: the IP address, and the city, region
// and country it is in, as far as the keeper's database knows.
function whereFrom(device) {
  if (!device.ip) return null;
  const p = device.place;
  const ip = device.ip4 ? `${device.ip} (IPv4 ${device.ip4})` : device.ip;
  if (p?.local) return h('div', { class: 'muted where-from' }, `🌐 ${ip} · ${p.local === 'computer' ? 'this computer' : 'on this computer’s own network'}`);
  const country = p?.country ? countries.of(p.country) : '';
  const where = [p?.city, p?.region && p.region !== p?.city ? p.region : '', country].filter(Boolean).join(', ');
  return h('div', { class: 'muted where-from', title: p?.timezone ? `Time zone ${p.timezone}` : null }, `🌐 ${ip}`, where ? ` · ${where}` : ' · somewhere unknown');
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

// A player's login: its username, on how many devices it is, whether it
// still needs a password (one made with secret pictures, before passwords)
// and whether they are in the ranking; a new password for one who forgot
// theirs, none, or out of the ranking (or back in). A device with no login
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
  const rank = async () => {
    const res = await api(`devices/${device.id}/ranked`, { method: 'PUT', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !device.ranked }) });
    if (!res.ok) alert('That did not work. Is the keeper still running?');
    refresh(true);
  };
  const words = login
    ? `🔑 Logs in as ${login.username || name} on ${plural(login.devices, 'device', 'devices')}${login.password ? '' : ' · needs a password (it had secret pictures)'} · ${device.ranked ? '🏆 in the ranking' : 'left out of the ranking'}${device.findable === false ? ' · off the players list' : ''}`
    : '🔑 No login';
  return h(
    'div',
    { class: 'login' },
    h(
      'div',
      { class: 'login-line' },
      h('span', {}, words),
      h('button', { type: 'button', onclick: type }, login ? (login.password ? 'New password' : 'Set a password') : 'Make a login'),
      login ? h('button', { type: 'button', onclick: rank }, device.ranked ? 'Take out of the ranking' : 'Put back in the ranking') : null,
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
  invite: (e) => ` invited ${e.to || 'a player'} to “${e.island}”`,
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
  const stickers = STICKERS.filter((s) => p?.stickers?.[s.key]);
  const treasures = Object.values(p?.basket ?? {}).reduce((a, b) => a + b, 0);
  const name = p?.name || 'A player';
  return h(
    'article',
    { class: 'device' },
    h(
      'header',
      { class: 'who' },
      h('span', { class: 'avatar', style: `--c:${p ? shirtColor(p.look.shirt) : '#d8cfe0'}`, 'aria-hidden': 'true' }, lookIcon(p?.look)),
      h('div', { class: 'name' }, h('h3', {}, name), h('div', { class: 'muted' }, `Last seen ${ago(device.lastSeen)} · first seen ${at.format(device.firstSeen)}`), whereFrom(device)),
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
    device.islands.length ? islandList(device) : h('p', { class: 'muted' }, 'No islands yet: this player has only visited friends.'),
  );
}

// Which lists of islands are open, so a redraw keeps them that way.
const opened = new Set();

// A player's islands, folded away until asked for, and their maps drawn only
// then; the ones said goodbye to are folded again inside.
function islandList(device) {
  const kept = device.islands.filter((i) => !i.forgotten);
  const gone = device.islands.filter((i) => i.forgotten);
  const fold = (key, label, islands, more = null) => {
    const list = h('details', { class: 'fold', open: opened.has(key) }, h('summary', {}, label));
    const fill = () => {
      if (list.dataset.filled) return;
      list.dataset.filled = '1';
      list.append(...(islands.length ? [h('div', { class: 'islands' }, ...islands.map((i) => islandCard(device, i)))] : []), ...(more ? [more] : []));
    };
    list.addEventListener('toggle', () => {
      if (list.open) {
        opened.add(key);
        fill();
      } else opened.delete(key);
    });
    if (list.open) fill();
    return list;
  };
  const goodbyes = gone.length ? fold(`${device.id}/gone`, `🗑️ ${plural(gone.length, 'island', 'islands')} said goodbye to`, gone) : null;
  const label = [`🏝️ ${plural(kept.length, 'island', 'islands')}`, gone.length ? `and ${gone.length} said goodbye to` : null].filter(Boolean).join(' ');
  return fold(device.id, label, kept, goodbyes);
}

// ---------------------------------------------------------------- the AI friend

const MODE = { follow: 'following', stay: 'waiting where it is', dizzy: 'dizzy' };

// Its settings form, made once: a refresh fills it in only while nothing in
// it has been changed and not saved.
let friendForm = null;
function settingsForm() {
  const on = h('input', { type: 'checkbox' });
  const name = h('input', { type: 'text', autocomplete: 'off', 'aria-label': 'Its name', maxlength: 40 });
  name.spellcheck = false;
  const model = h('select', { 'aria-label': 'Its model' });
  const wander = h('input', { type: 'checkbox' });
  const visits = h('select', { 'aria-label': 'Islands at once' });
  const home = h('input', { type: 'checkbox' });
  const save = h('button', { type: 'submit', disabled: true }, 'Save');
  const note = h('span', { class: 'muted', 'aria-live': 'polite' });
  const form = h(
    'form',
    { class: 'settings' },
    h('label', {}, on, 'On'),
    h('label', {}, 'Name', name),
    h('label', {}, 'Model', model),
    h('label', { title: 'Now and then it visits an open island with somebody on it, the loneliest first. Off: it only comes when invited.' }, wander, 'Visits by itself'),
    h('label', {}, 'On up to', visits, 'islands at once'),
    h('label', { title: 'An island of its own on this server, on the list of open islands, where it builds big things and anyone can visit.' }, home, 'Has its own island'),
    save,
    note,
  );
  let dirty = false;
  const changed = () => {
    dirty = true;
    save.disabled = false;
    note.textContent = '';
  };
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!on.checked && friendForm.state.visits.length && !confirm('Turn the AI friend off? It goes home from every island it is on.')) return;
    save.disabled = true;
    const res = await api('friend', {
      method: 'PUT',
      headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: on.checked, name: name.value, model: model.value, wander: wander.checked, maxVisits: Number(visits.value), home: home.checked }),
    });
    if (!res.ok) {
      save.disabled = false;
      note.textContent = (await res.json().catch(() => null))?.error ?? 'That did not work. Is the keeper still running?';
      return;
    }
    dirty = false;
    note.textContent = 'Saved.';
    renderFriend(await res.json());
  });
  const fill = (state) => {
    if (dirty) return;
    const s = state.settings;
    on.checked = s.on;
    name.value = s.name;
    wander.checked = s.wander;
    home.checked = s.home;
    const provider = state.llms?.[0]?.name ?? 'Ollama';
    const models = state.models.includes(s.model) ? state.models : [s.model, ...state.models];
    model.replaceChildren(...models.map((m) => h('option', { value: m }, state.models.includes(m) ? m : `${m} (not in ${provider})`)));
    model.value = s.model;
    visits.replaceChildren(...Array.from({ length: state.maxVisits }, (_, k) => h('option', { value: k + 1 }, k + 1)));
    visits.value = String(s.maxVisits);
    save.disabled = true;
  };
  return { form, fill, state: null };
}

async function friendAction(path, question = '') {
  if (question && !confirm(question)) return;
  const res = await api(`friend/${path}`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1' } });
  if (!res.ok) alert('That did not work. Is the keeper still running?');
  refreshFriend();
}

// An island it is on, kept from one refresh to the next and filled in anew,
// so a line being typed to say there (in Korean, say, mid-word) stays as it is.
function visitCard(code) {
  let v = null;
  const title = h('h4');
  const info = h('div');
  const chat = h('ol', { class: 'chat' });
  let said = '';
  const talk = h('input', { type: 'text', autocomplete: 'off', maxlength: CHAT_MAX, placeholder: 'Say something to it' });
  const input = h('input', { type: 'text', autocomplete: 'off', maxlength: CHAT_MAX, placeholder: 'Something for it to say' });
  const note = h('span', { class: 'muted', 'aria-live': 'polite' });
  // Said to it, as a player's words are: it answers through its model, and
  // the answer is said on the island (and shown here) as its own.
  const converse = async (e) => {
    e.preventDefault();
    const text = talk.value.trim();
    if (!text) return;
    const res = await api(`friend/visits/${code}/chat`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!res.ok) {
      note.textContent = (await res.json().catch(() => null))?.error ?? 'That did not work. Is the keeper still running?';
      return;
    }
    talk.value = '';
    note.textContent = '';
    refreshFriend();
    watchFriend();
  };
  const send = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const res = await api(`friend/visits/${code}/say`, { method: 'POST', headers: { 'X-Kids-World-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!res.ok) {
      note.textContent = (await res.json().catch(() => null))?.error ?? 'That did not work. Is the keeper still running?';
      return;
    }
    input.value = '';
    note.textContent = '';
    refreshFriend();
  };
  const home = () => friendAction(`visits/${code}/home`, `Send ${friendForm.state.settings.name} home from “${v.island}”? It does not come back there by itself for a while.`);
  const doing = h('div', { class: 'doing', 'aria-live': 'polite' });
  const builds = h('div');
  const actions = h('div', { class: 'actions' }, h('button', { class: 'danger', type: 'button', onclick: home }, 'Send home'));
  const el = h(
    'article',
    { class: 'visit' },
    title,
    info,
    doing,
    builds,
    chat,
    h('form', { class: 'say talk', onsubmit: converse }, talk, h('button', { type: 'submit' }, 'Chat')),
    h('form', { class: 'say', onsubmit: send }, input, h('button', { type: 'submit' }, 'Say')),
    note,
    actions,
  );
  const update = (next) => {
    v = next;
    const name = friendForm.state.settings.name;
    title.textContent = v.home ? `🏠 ${v.island} · its own island` : `🏝️ ${v.island}`;
    el.classList.toggle('home', Boolean(v.home));
    actions.hidden = Boolean(v.home);
    doing.replaceChildren(h('b', {}, '🔧 Now: '), v.doing, v.thinking ? ' · 💭 thinking what to say' : '', v.planning ? ' · 💭 thinking what to build' : '');
    builds.replaceChildren(...(v.home ? buildList(v) : []));
    talk.placeholder = `Say something to ${name}`;
    talk.setAttribute('aria-label', `Talk with ${name} on ${v.island}: what is said to it, it answers`);
    input.setAttribute('aria-label', `Something for ${name} to say on ${v.island}, as its own words`);
    chat.setAttribute('aria-label', `What was said on ${v.island}`);
    const people = v.players.length ? v.players.join(', ') : 'nobody';
    info.replaceChildren(
      h('div', { class: 'muted' }, [`code ${prettyCode(v.code)}`, v.server ? 'on this server' : 'peer to peer', v.owner ? `${v.owner}’s island` : null].filter(Boolean).join(' · ')),
      v.home
        ? h('div', { class: 'muted' }, `🏠 Lives here · ${plural(v.buildCount, 'thing', 'things')} built so far${v.shared === 'online' ? ' · 🌍 on the list of open islands everywhere' : v.shared ? ` · 🌍 not reachable from other websites yet (${v.shared})` : ' · only on this server (no keeper online)'}`)
        : v.arrivedAt
        ? h('div', { class: 'muted' }, `${v.invitedBy ? `💌 Invited by ${v.invitedBy}` : '🚶 Came by itself'} · came ${ago(v.arrivedAt)} · goes home by ${time.format(v.leaveAt)}`)
        : h('div', { class: 'muted' }, `${v.invitedBy ? `💌 Invited by ${v.invitedBy}` : '🚶 By itself'} · getting there…`),
      h('div', {}, `👥 ${people}`, v.friend ? ` · ${MODE[v.mode] ?? v.mode} ${v.mode === 'follow' ? v.friend : ''}`.trimEnd() : '', v.thinking ? ' · 💭 thinking' : ''),
    );
    const key = JSON.stringify(v.chat);
    if (key === said) return;
    said = key;
    // Kept at the newest line, unless scrolled up to read.
    const bottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 8;
    chat.replaceChildren(
      ...(v.chat.length
        ? v.chat.map((c) => h('li', { class: c.mine ? 'mine' : null }, h('b', {}, c.name), c.admin ? h('span', { class: 'muted', title: 'Said from this page' }, ' (from here)') : null, ': ', c.text))
        : [h('li', { class: 'muted' }, 'Nothing said yet.')]),
    );
    if (bottom) chat.scrollTop = chat.scrollHeight;
  };
  return { el, update };
}

// What it is building on its own island, and what it built there lately.
function buildList(v) {
  const p = v.project;
  const out = [];
  if (p) {
    out.push(
      h(
        'div',
        { class: 'project' },
        `${p.icon} Building ${p.title}${p.name ? ` · “${p.name}”` : ''}`,
        h('progress', { max: p.layers, value: p.layer, 'aria-label': `Layer ${p.layer} of ${p.layers}` }),
        h('span', { class: 'muted' }, `${p.layer} / ${p.layers} layers`),
      ),
    );
  }
  if (v.builds.length) {
    const key = `friend-builds`;
    out.push(
      h(
        'details',
        { class: 'fold', open: opened.has(key) || null, ontoggle: (e) => (e.target.open ? opened.add(key) : opened.delete(key)) },
        h('summary', {}, `🏗️ Built lately (${v.builds.length})`),
        h('ol', { class: 'recent' }, ...v.builds.map((b) => h('li', {}, h('time', {}, ago(b.at)), ` ${b.icon} ${b.title}`, b.name ? ` · “${b.name}”` : ''))),
      ),
    );
  }
  return out;
}

// What it is doing everywhere it is, one line each.
function nowList(state) {
  const all = [...(state.home ? [state.home] : []), ...state.visits];
  if (!state.running) return [];
  if (!all.length) return [h('li', { class: 'muted' }, 'Not on any island right now.')];
  return all.map((v) =>
    h('li', {}, h('b', {}, v.home ? `🏠 ${v.island}: ` : `🏝️ ${v.island}: `), v.doing, v.thinking ? ' · 💭 thinking what to say' : '', v.planning ? ' · 💭 thinking what to build' : ''),
  );
}

// ------------------------------------------------ its model log

// Its last questions to the model, word for word, and what came back: read
// from /admin/api/friend/llm only while the log is open.
const logView = {
  list: h('div', { class: 'calls' }),
  note: h('p', { class: 'muted' }),
  shown: '',
};
logView.el = h(
  'details',
  {
    class: 'fold model-log',
    ontoggle: (e) => {
      if (e.target.open) {
        opened.add('friend-llm');
        refreshLog();
      } else opened.delete('friend-llm');
    },
  },
  h('summary', {}, '🔍 Model log'),
  logView.note,
  logView.list,
);

const STATE = { waiting: '⏳', answered: '✅', failed: '⚠️' };
const secs = (ms) => (ms === null || ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`);

// Text as it is, or JSON laid out to read.
function pretty(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function callCard(c) {
  const key = `call-${c.at}-${c.id}`;
  const o = c.ollama ?? c.zai;
  const tokens = o ? [o.promptTokens !== null ? `${o.promptTokens} in` : null, o.tokens !== null ? `${o.tokens} out` : null].filter(Boolean).join(' · ') : '';
  const waited = c.sentAt ? c.sentAt - c.at : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(c, null, 2));
    } catch {
      alert('Could not copy it.');
    }
  };
  return h(
    'details',
    { class: `call ${c.state}`, open: opened.has(key) || null, ontoggle: (e) => (e.target.open ? opened.add(key) : opened.delete(key)) },
    h(
      'summary',
      {},
      h('time', {}, time.format(c.at)),
      ` ${STATE[c.state] ?? ''} ${c.about || 'a question'}`,
      h('span', { class: 'muted' }, [c.state === 'waiting' ? (c.sentAt ? ' · asking…' : ' · waiting its turn…') : ` · ${secs(c.ms)}`, tokens ? ` · ${tokens} tokens` : ''].join('')),
    ),
    h(
      'div',
      { class: 'call-body' },
      h(
        'div',
        { class: 'muted' },
        [
          c.model ? `Model ${c.model}` : null,
          c.fellBack ? `the local model answered instead (${c.fellBack})` : null,
          c.options ? Object.entries(c.options).map(([k, v]) => `${k} ${v}`).join(', ') : null,
          waited ? `waited ${secs(waited)} for the questions before it` : null,
          o?.loadMs >= 100 ? `loading the model ${secs(o.loadMs)}` : null,
          o?.promptMs !== null && o?.promptMs !== undefined ? `reading ${secs(o.promptMs)}` : null,
          o?.answerMs !== null && o?.answerMs !== undefined ? `answering ${secs(o.answerMs)}` : null,
          o?.doneReason ? `stopped: ${o.doneReason}${o.doneReason === 'length' ? ' (ran out of words)' : ''}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        ' ',
        h('button', { type: 'button', class: 'small', onclick: copy }, 'Copy as JSON'),
      ),
      ...c.messages.map((m) => h('div', { class: `msg ${m.role}` }, h('b', {}, m.role), h('pre', {}, m.content))),
      c.state === 'failed' ? h('div', { class: 'msg error' }, h('b', {}, 'no answer'), h('pre', {}, c.error)) : null,
      c.raw !== undefined ? h('div', { class: 'msg reply' }, h('b', {}, 'reply'), h('pre', {}, pretty(c.raw))) : c.answer !== undefined ? h('div', { class: 'msg reply' }, h('b', {}, 'answer'), h('pre', {}, JSON.stringify(c.answer, null, 2))) : null,
      c.schema ? h('details', { class: 'fold' }, h('summary', {}, 'Answer schema'), h('pre', {}, JSON.stringify(c.schema, null, 2))) : null,
    ),
  );
}

async function refreshLog() {
  if (!logView.el.open) return;
  let calls = null;
  try {
    const res = await api('friend/llm');
    if (res.ok) calls = (await res.json()).calls;
  } catch {
    calls = null;
  }
  const key = JSON.stringify(calls);
  if (key === logView.shown) return;
  logView.shown = key;
  logView.note.textContent = !calls
    ? 'The log could not be read. Is the keeper still running?'
    : calls.length
      ? `Its last ${plural(calls.length, 'question', 'questions')} to the model, newest first: everything it was sent, and what came back. Kept only in memory, until the keeper stops.`
      : 'It has not asked the model anything yet.';
  logView.list.replaceChildren(...(calls ?? []).map(callCard));
}

// The section's parts, made once and filled in on every refresh.
let friendView = null;
const visitCards = new Map();

function renderFriend(state) {
  $('friend-section').hidden = !state;
  if (!state) return;
  friendForm ??= settingsForm();
  friendForm.state = state;
  friendForm.fill(state);
  if (!friendView) {
    friendView = { line: h('div', { class: 'friend-line' }), now: h('ul', { class: 'now', 'aria-label': 'What it is doing now' }), about: h('p', { class: 'muted' }), facts: h('div', { class: 'facts' }), visits: h('div', { class: 'visits' }), history: h('div') };
    const f = friendView;
    $('friend').replaceChildren(f.line, f.now, friendForm.form, f.about, f.facts, f.visits, f.history, logView.el);
  }
  const f = friendView;
  const s = state.settings;
  const [cls, words] = !state.running
    ? ['off', 'Off: it does not visit anyone.']
    : state.ready
      ? ['on', `${s.name} is awake, with ${s.model}${state.listed ? '' : ' · busy on as many islands as it may be on'}`]
      : ['wait', `${s.name} is asleep: ${state.problem || 'checking its model…'}`];
  f.line.replaceChildren(h('span', { class: `status ${cls}`, role: 'status' }, words), state.running ? h('button', { type: 'button', onclick: () => friendAction('check') }, 'Check the model now') : '');
  // What it talks with: the model it asks, and the local one that answers
  // when that cannot. A problem is only spelled out when the other one still
  // answers; when neither does, the line above says why it is asleep.
  const llms = state.llms ?? [{ name: 'Ollama', url: state.url, model: s.model, problem: state.problem ?? '' }];
  f.about.replaceChildren(
    ...llms.flatMap((l, k) => [
      k ? ', falling back to ' : '',
      `${l.name} at `,
      h('code', {}, l.url),
      ` (${l.model})`,
      l.problem && llms.some((o, i) => i !== k && !o.problem) ? `: ${l.problem}` : '',
    ]),
    '.',
    state.saved ? '' : ' These settings come from the environment until saved here.',
  );
  const st = state.stats;
  const facts = st
    ? [
        `💬 ${plural(st.answers, 'answer', 'answers')} from the model`,
        st.answers ? `${(st.totalMs / st.answers / 1000).toFixed(1)} s each on average (last ${(st.lastMs / 1000).toFixed(1)} s)` : null,
        st.failures ? `⚠️ ${plural(st.failures, 'answer', 'answers')} that did not come, last ${ago(st.lastErrorAt)}: ${st.lastError}` : null,
      ].filter(Boolean)
    : [];
  f.facts.hidden = !facts.length;
  f.facts.replaceChildren(...facts.map((x) => h('span', {}, x)));
  f.now.replaceChildren(...nowList(state));
  f.now.hidden = !state.running;
  // Cards come and go one by one; the ones staying are never moved. Its own island comes first.
  const places = [...(state.home ? [state.home] : []), ...state.visits];
  const codes = new Set(places.map((v) => v.code));
  for (const [code, card] of visitCards) {
    if (codes.has(code)) continue;
    card.el.remove();
    visitCards.delete(code);
  }
  for (const v of places) {
    let card = visitCards.get(v.code);
    if (!card) {
      card = visitCard(v.code);
      visitCards.set(v.code, card);
      if (v.home) f.visits.prepend(card.el);
      else f.visits.append(card.el);
    }
    card.update(v);
  }
  f.visits.hidden = !places.length;
  f.history.replaceChildren(
    ...(state.history.length
      ? [h('details', { class: 'fold', open: opened.has('friend-history') || null, ontoggle: (e) => (e.target.open ? opened.add('friend-history') : opened.delete('friend-history')) }, h('summary', {}, '📜 What it did lately'), h('ol', { class: 'recent' }, ...state.history.slice(0, 30).map((e) => h('li', {}, h('time', {}, time.format(e.at)), ' ', e.text))))]
      : []),
  );
}

async function refreshFriend() {
  let state = null;
  try {
    const res = await api('friend');
    if (res.ok) state = await res.json();
  } catch {
    state = null;
  }
  renderFriend(state);
  if (state) await refreshLog();
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

// After something is said to the AI friend, its answer comes in a few
// seconds: its state is read closely for a while, each new line starting the
// watch again, instead of waiting for the slow refresh the rest of the page
// uses. One watcher; a line while it runs just makes it last longer.
let watchUntil = 0;
let watching = false;
function watchFriend() {
  watchUntil = Date.now() + ANSWER_WATCH_MS;
  if (watching) return;
  watching = true;
  const tick = async () => {
    await refreshFriend();
    if (Date.now() < watchUntil) setTimeout(tick, ANSWER_MS);
    else watching = false;
  };
  setTimeout(tick, ANSWER_MS);
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
  await refreshFriend();
  timer = setTimeout(refresh, REFRESH_MS);
}

refresh();
