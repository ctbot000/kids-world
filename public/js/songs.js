// The songs island owners picked for their islands (see shared/song.js),
// kept in this browser by island id so an island plays its song again when
// it is opened. They are too big for localStorage, so they live in
// IndexedDB (through idb-keyval), and they never go to the keeper. Storage
// can be switched off or full, so nothing here ever throws.
import { del, get, set } from '../vendor/idb-keyval.js';

const key = (islandId) => `song.${islandId}`;

export async function keepSong(islandId, blob, name) {
  try {
    await set(key(islandId), { name, blob });
    return true;
  } catch {
    return false;
  }
}

// { name, blob }, or null.
export async function loadSong(islandId) {
  try {
    const kept = await get(key(islandId));
    return kept?.blob instanceof Blob && typeof kept.name === 'string' ? kept : null;
  } catch {
    return null;
  }
}

export function forgetSong(islandId) {
  del(key(islandId)).catch(() => {});
}
