// The list of open islands: islands anyone can visit, picked from a list
// instead of typing a code. An island is on it while it is open to visitors
// (its host is online and it is not closed to new ones), and anyone can come
// in, unless its owner gave it a passcode: four numbers, which a new visitor
// types to come in. Friends who came in before come back without it.
//
// Peer to peer, a host's page tells the island keeper about its island while
// it is open (see shared/keeper.js); on the dedicated server, the server
// lists its own (GET api/islands). Either way the list is made of these:
//   { code, name, theme, size, players, max, passcode }
// passcode: whether the island has one (never the passcode itself).

import { isValidCode } from './codes.js';
import { SIZES, THEMES } from './worldgen.js';
import { cleanIslandName } from './words.js';

export const PASSCODE_LENGTH = 4;
// The most islands a list shows, the busiest first.
export const LIST_MAX = 50;

export const isPasscode = (v) => typeof v === 'string' && v.length === PASSCODE_LENGTH && /^[0-9]+$/.test(v);

// What was typed, as a passcode: its digits, or '' for none.
export function normalizePasscode(raw) {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  return isPasscode(digits) ? digits : '';
}

export function randomPasscode(random = Math.random) {
  let out = '';
  while (out.length < PASSCODE_LENGTH) out += Math.floor(random() * 10) % 10;
  return out;
}

// A listing as sent by someone else (a host's page, a server), tidied, or
// null when it is no listing.
export function cleanListing(raw) {
  if (!raw || typeof raw !== 'object' || !isValidCode(raw.code)) return null;
  const name = cleanIslandName(raw.name);
  if (!name) return null;
  const count = (v, lo, hi) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : lo);
  const max = count(raw.max, 1, 64);
  return {
    code: raw.code,
    name,
    theme: THEMES.some((t) => t.key === raw.theme) ? raw.theme : 'sunny',
    size: SIZES.some((s) => s.key === raw.size) ? raw.size : SIZES[0].key,
    players: count(raw.players, 0, max),
    max,
    passcode: raw.passcode === true,
  };
}

// The busiest first (full ones last, as nobody can come in), then by name;
// at most LIST_MAX.
export function sortListings(list) {
  const room = (i) => (i.players >= i.max ? -1 : i.players);
  return [...list].sort((a, b) => room(b) - room(a) || a.name.localeCompare(b.name) || a.code.localeCompare(b.code)).slice(0, LIST_MAX);
}
