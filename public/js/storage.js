// What this browser remembers: who you are (name, look, settings, basket,
// stickers) and the islands you made. Everything lives in localStorage; the
// keeper (keeper.js) gets a copy of your islands and of you, unless that is
// switched off. Storage can be full or switched off, so every read and write
// is guarded, and a copy is kept in memory so the session never contradicts
// itself when a write is refused.
//
// Each player has a space of their own here: the guest (whoever plays without
// logging in) under the plain keys, and each player who logged in on this
// device under keys of their own, so that players taking turns on one device
// never mix up their islands. Which one is playing is remembered beside them.

const PREFIX = 'kidsworld.';
const memory = new Map();
let space = '';

const spaceOf = (player) => (player ? `@${player}.` : '');

// Whose things load() and save() read and write from now on: a logged-in
// player's, or the guest's (null).
export function useSpace(player) {
  space = spaceOf(player);
}

function read(full, fallback) {
  if (memory.has(full)) return structuredClone(memory.get(full));
  try {
    const raw = localStorage.getItem(full);
    if (raw != null) {
      const value = JSON.parse(raw);
      memory.set(full, value);
      return structuredClone(value);
    }
  } catch {
    // unreadable or blocked: use the fallback
  }
  return fallback;
}

function write(full, value) {
  memory.set(full, structuredClone(value));
  try {
    localStorage.setItem(full, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function erase(full) {
  memory.delete(full);
  try {
    localStorage.removeItem(full);
  } catch {
    // nothing to do
  }
}

export function load(key, fallback) {
  return read(PREFIX + space + key, fallback);
}

// Returns false when the browser refused to store it (the value is still
// remembered for this visit).
export function save(key, value) {
  return write(PREFIX + space + key, value);
}

export function remove(key) {
  erase(PREFIX + space + key);
}

// Writes into a player's space without playing as them, which a page that
// is about to reload as them does.
export function saveFor(player, key, value) {
  return write(PREFIX + spaceOf(player) + key, value);
}

export function loadFor(player, key, fallback) {
  return read(PREFIX + spaceOf(player) + key, fallback);
}

// ---------------------------------------------------------------- logins

// Who is logged in on this device: { player, token }, or null for the guest.
export function loadWho() {
  const who = read(`${PREFIX}who`, null);
  return typeof who?.player === 'string' && typeof who.token === 'string' ? who : null;
}

export function saveWho(who) {
  if (who) write(`${PREFIX}who`, { player: who.player, token: who.token });
  else erase(`${PREFIX}who`);
}

// The players who have logged in on this device, to pick from next time:
// [{ player, name, look }], the latest first.
export function knownPlayers() {
  const list = read(`${PREFIX}players`, []);
  return Array.isArray(list) ? list.filter((p) => typeof p?.player === 'string' && typeof p.name === 'string') : [];
}

export function notePlayer({ player, name, look }) {
  const list = knownPlayers().filter((p) => p.player !== player);
  list.unshift({ player, name, look });
  write(`${PREFIX}players`, list.slice(0, 8));
}

export function forgetPlayer(player) {
  write(
    `${PREFIX}players`,
    knownPlayers().filter((p) => p.player !== player),
  );
}

// The guest's things become a player's, when the guest makes a login: moved
// one key at a time, as there may not be room for two copies of every
// island. Returns false, with everything put back, if the browser refused.
export function moveGuestTo(player) {
  const islands = read(`${PREFIX}islands`, []);
  const keys = ['profile', 'keeper', 'islands', ...(Array.isArray(islands) ? islands : []).filter((i) => typeof i?.id === 'string').map((i) => `island.${i.id}`)];
  const moved = [];
  const to = PREFIX + spaceOf(player);
  for (const key of keys) {
    const value = read(PREFIX + key, undefined);
    if (value === undefined) continue;
    if (!write(to + key, value)) {
      for (const done of moved) {
        write(PREFIX + done, read(to + done, null));
        erase(to + done);
      }
      erase(to + key);
      return false;
    }
    erase(PREFIX + key);
    moved.push(key);
  }
  return true;
}

// ---------------------------------------------------------------- islands

export const MAX_ISLANDS = 12;

export function listIslands() {
  const list = load('islands', []);
  return Array.isArray(list) ? list.filter((i) => i && typeof i.id === 'string') : [];
}

export function loadIsland(id) {
  return load(`island.${id}`, null);
}

// Stores an island's save under its id and keeps the list tidy: the most
// recently played first, and the oldest let go past MAX_ISLANDS.
export function storeIsland(id, snapshot) {
  const ok = save(`island.${id}`, snapshot);
  const list = listIslands().filter((i) => i.id !== id);
  list.push({ id, name: snapshot.meta?.name ?? 'My Island', theme: snapshot.meta?.theme ?? 'sunny', code: snapshot.code ?? '', savedAt: snapshot.savedAt ?? Date.now() });
  list.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  for (const old of list.splice(MAX_ISLANDS)) remove(`island.${old.id}`);
  save('islands', list);
  return ok;
}

export function forgetIsland(id) {
  remove(`island.${id}`);
  save(
    'islands',
    listIslands().filter((i) => i.id !== id),
  );
}

export function newIslandId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
