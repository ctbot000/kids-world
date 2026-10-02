// What this browser remembers: who you are (name, look, settings, basket,
// stickers) and the islands you made. Everything lives in localStorage; the
// keeper (keeper.js) gets a copy of your islands and of you, unless that is
// switched off. Storage can be full or switched off, so every read and write
// is guarded, and a copy is kept in memory so the session never contradicts
// itself when a write is refused.

const PREFIX = 'kidsworld.';
const memory = new Map();

export function load(key, fallback) {
  if (memory.has(key)) return structuredClone(memory.get(key));
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) {
      const value = JSON.parse(raw);
      memory.set(key, value);
      return structuredClone(value);
    }
  } catch {
    // unreadable or blocked: use the fallback
  }
  return fallback;
}

// Returns false when the browser refused to store it (the value is still
// remembered for this visit).
export function save(key, value) {
  memory.set(key, structuredClone(value));
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // nothing to do
  }
}

// ---------------------------------------------------------------- islands

const MAX_ISLANDS = 12;

export function listIslands() {
  const list = load('islands', []);
  return Array.isArray(list) ? list.filter((i) => i && typeof i.id === 'string') : [];
}

export function loadIsland(id) {
  return load(`island.${id}`, null);
}

// Stores an island's save under its id and keeps the list tidy.
export function storeIsland(id, snapshot) {
  const ok = save(`island.${id}`, snapshot);
  const list = listIslands().filter((i) => i.id !== id);
  list.unshift({ id, name: snapshot.meta?.name ?? 'My Island', theme: snapshot.meta?.theme ?? 'sunny', code: snapshot.code ?? '', savedAt: snapshot.savedAt ?? Date.now() });
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
