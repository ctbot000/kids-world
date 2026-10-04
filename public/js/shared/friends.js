// Players: everyone with a login, in a list a logged-in player can look
// through, with who is playing right now, and invitations to an island. The
// keeper keeps the list (see server/keeper.js), and passes an invitation on
// to the pages of the player invited that are open right now; a page shows it
// as a card to say yes or no to (ui.js).
//
// Players show up by their display name and look, the way friends see them,
// never by their username, and under an id made for the list (never the
// folder the keeper files them in). A player can leave the list, and then
// nobody can invite them.
//
// An invitation is to an island by its code: { code, name, theme, size,
// server, pass? }. server: whether it is on a dedicated server (the code
// means nothing peer to peer). pass: from the island's owner, for an island
// with a passcode: it lets the friend in once instead (see Room.givePass).

import { isValidCode } from './codes.js';
import { SIZES, THEMES } from './worldgen.js';
import { cleanIslandName } from './words.js';

// The most players the list shows.
export const PLAYERS_MAX = 200;

export const isFriendId = (v) => typeof v === 'string' && /^[0-9a-f]{20}$/.test(v);
export const isPass = (v) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);

// An invitation's island as sent by someone else, tidied, or null.
export function cleanInvite(raw) {
  if (!raw || typeof raw !== 'object' || !isValidCode(raw.code)) return null;
  const name = cleanIslandName(raw.name);
  if (!name) return null;
  return {
    code: raw.code,
    name,
    theme: THEMES.some((t) => t.key === raw.theme) ? raw.theme : 'sunny',
    size: SIZES.some((s) => s.key === raw.size) ? raw.size : SIZES[0].key,
    server: raw.server === true,
    ...(isPass(raw.pass) ? { pass: raw.pass } : {}),
  };
}

// Who is playing now first, then by name; at most PLAYERS_MAX.
//   players: [{ id, name, look, online }]
export function sortPlayers(players) {
  return [...players].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1)).slice(0, PLAYERS_MAX);
}
