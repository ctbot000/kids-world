// Watching an island unseen, from the keeper's admin page: the page there
// asks the keeper for a ticket for one island, signed with its private key,
// and opens the game with it (?watch=code&ticket=...). The island (room.js)
// checks the ticket with the keeper's public key (keeper.json) and lets the
// watcher in without a player: nobody on the island is told, it is not on
// the players list nor counted as one, and nothing it sends is heard but its
// pings. Anyone else's watch message is ignored.

import { fromBase64Url, isPublicKey, KEY_ALGORITHM, SIGN_ALGORITHM, toBase64Url } from './keeper.js';
import { isValidCode } from './codes.js';

// How long a ticket lets its page in (again, after a lost connection).
export const WATCH_MS = 6 * 60 * 60 * 1000;

// The key tickets are checked with: a promise of it, or null for none (no
// keeper, so nobody can watch).
let trusted = null;

export function trustWatchKey(jwk) {
  trusted = isPublicKey(jwk) && globalThis.crypto?.subtle ? globalThis.crypto.subtle.importKey('jwk', jwk, KEY_ALGORITHM, false, ['verify']).catch(() => null) : null;
}

function watchText(code, until) {
  return new TextEncoder().encode(`kids-world watch\n${code}\n${until}`);
}

// A ticket for the island with this code, as text: "until.signature".
export async function signWatch(privateKey, code, now = Date.now()) {
  const until = now + WATCH_MS;
  const sig = await globalThis.crypto.subtle.sign(SIGN_ALGORITHM, privateKey, watchText(code, until));
  return `${until}.${toBase64Url(sig)}`;
}

// Whether a ticket lets its page watch the island with this code now.
export async function canWatch(code, ticket, now = Date.now()) {
  if (!trusted || !isValidCode(code) || typeof ticket !== 'string' || ticket.length > 200) return false;
  const m = /^(\d{1,15})\.([A-Za-z0-9_-]+)$/.exec(ticket);
  const until = m ? Number(m[1]) : 0;
  if (!m || until < now || until > now + WATCH_MS + 60000) return false;
  const key = await trusted;
  const sig = fromBase64Url(m[2]);
  if (!key || !sig) return false;
  try {
    return await globalThis.crypto.subtle.verify(SIGN_ALGORITHM, key, sig, watchText(code, until));
  } catch {
    return false;
  }
}
