// The keeper: a computer that keeps a copy of every player's islands and of
// who they are, sent by their browsers peer to peer whenever it is online. A
// player can also make a login there, a username and a password, and log in
// with it on any other device to play as themselves: the same look,
// stickers, basket and islands everywhere. The username is theirs alone:
// other players only ever see the made-up name from the word lists.
// This is what the page and the keeper (server/keeper.js) agree on: the
// messages, how the keeper proves it is the real one, and the limits.
//
//   page → keeper   { t: 'hello', v, nonce }
//   keeper → page   { t: 'hello', v, sig }           sig: the challenge, signed
// Only then does the page say who it is, which takes a secret:
//   page → keeper   { t: 'me', device, login? }      login: { player, token }
//   keeper → page   { t: 'me', player? }             player: the login, unless it is gone
// Then one message at a time, each answered before the next:
//   page → keeper   { t: 'island', id, save },  { t: 'profile', profile }
//                    or { t: 'adventure', profile }  (the isle's own world of you)
//   keeper → page   { t: 'kept', what, id?, savedAt? }  or  { t: 'error', code, text }
// Logins:
//   { t: 'login', username, password }                → { t: 'login', player, token, username, profile }
//   { t: 'make-login', username, password, profile }  → { t: 'login', player, token?, username }
//                                                       (a new password, once logged in, without a username)
//   { t: 'adopt', player, token }           → { t: 'kept', what: 'adopt', islands }
//                                             (this device's copies from before become the player's)
//   { t: 'logout' }                         → { t: 'kept', what: 'logout' }
// The 'me' answer says the login's username, and needsPassword for a login
// made with secret pictures, before passwords: a device logged in to one
// sets one. Pages from before usernames sent the made-up name as `name`.
// A logged-in page also brings back what its other devices sent:
//   { t: 'list' }                         → { t: 'list', profile, adventure?, islands, forgotten }
//   { t: 'fetch', id }                    → { t: 'island', id, save }
//   { t: 'forget', id }                   → { t: 'kept', what: 'forget', id }
// The ranking of the players with a login (see ranking.js), for any page:
//   { t: 'ranking', watch?, world? }      → { t: 'ranking', players, boards, shown? }
//                                           (world: 'isle' for the isle's own boards;
//                                            shown: logged in, whether you are in it)
//   { t: 'unwatch' }                      → { t: 'kept', what: 'unwatch' }
//   { t: 'ranked', on }                   → { t: 'kept', what: 'ranked', on }
//                                           (logged in: in the ranking, or left out)
// A page that asked with watch: true also hears, unasked, whenever the
// ranking looks different to it, until it says 'unwatch' (pages tell this
// news from answers by its t):
//   keeper → page   { t: 'ranking-news', players, boards, shown? }
// The list of open islands (see listing.js), for any page. A host's page
// lists its island while it is open to visitors, and stays connected
// meanwhile: the island leaves the list when the page goes.
//   { t: 'open-island', island }          → { t: 'kept', what: 'open-island', code }
//   { t: 'close-island' }                 → { t: 'kept', what: 'close-island' }
//   { t: 'islands' }                      → { t: 'islands', islands }
// Players and invitations (see friends.js), logged in. A page on screen says
// its player is playing now, and stays connected meanwhile; others see so on
// the players list, and can invite them to an island, which comes unasked:
//   { t: 'online', on }                   → { t: 'kept', what: 'online', on }
//   { t: 'players' }                      → { t: 'players', players, shown }
//   { t: 'findable', on }                 → { t: 'kept', what: 'findable', on }
//                                           (on the players list, or left off)
//   { t: 'invite', to, island }           → { t: 'kept', what: 'invite', to }
//                                           (or error away: not playing now)
//   keeper → page   { t: 'invite-news', from: { id, name, look }, island }
//
// Anyone can register a peer id while the keeper is away, so the page sends
// nothing but its nonce until the keeper has signed it with the key whose
// public half is in keeper.json. The data channel itself is encrypted end to
// end, as every WebRTC channel is. Pages of version 1 sent their device key
// in the hello, before that check; the keeper still answers them.
import { COLLECTABLES } from './blocks.js';
import { CHUNK } from './framing.js';
import { addToys } from './gashapon.js';
import { cleanGallery, joinGalleries } from './drawing.js';
import { cleanCoins, cleanGear, cleanPotions, cleanTames, COINS_MAX } from './shop.js';
import { cleanLook, isMadeUpName, isValidName } from './words.js';

export const KEEPER_VERSION = 2;
export const OLDEST_VERSION = 1;

// The longest message: an island, as JSON. A busy island is a few hundred KB.
export const MAX_TEXT = 4 * 1024 * 1024;
export const MAX_PARTS = Math.ceil(MAX_TEXT / CHUNK);
// What a player writes about a problem, at most (see report.js).
export const REPORT_TEXT_MAX = 1000;
// An idea for the game a player sends CTB's workers (server/ctb.js): at most
// this long, this many an hour, and this many waiting for an answer at once.
export const WISH_TEXT_MAX = 500;
export const WISHES_AN_HOUR = 3;
export const WISHES_WAITING = 5;
export const WISH_STATES = ['waiting', 'accepted', 'declined'];
// Where an accepted idea has got to since, as its issue on GitHub tells it
// (server/ctb.js stageOf): waiting for a grown-up to pick it, picked, being
// built, built and being checked, in the game; or not picked, or the
// workers stuck on it. '' before any news.
export const WISH_STAGES = ['proposed', 'approved', 'building', 'stuck', 'checking', 'done', 'dropped'];

// An idea as a page shows it, from the keeper: { id, at, text, state, by,
// reply, answeredAt, score, stage, stageAt }, or null. by is the worker who
// read it; reply what they said back; score how good the worker thought it,
// 0 to 100 (null before it was read).
export function cleanWish(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^\d{13}-[0-9a-f]{8}$/.test(raw.id)) return null;
  const text = typeof raw.text === 'string' ? raw.text.slice(0, WISH_TEXT_MAX) : '';
  if (!text) return null;
  return {
    id: raw.id,
    at: Number.isFinite(raw.at) ? raw.at : 0,
    text,
    state: WISH_STATES.includes(raw.state) ? raw.state : 'waiting',
    by: typeof raw.by === 'string' ? raw.by.slice(0, 40) : '',
    reply: typeof raw.reply === 'string' ? raw.reply.slice(0, 400) : '',
    answeredAt: Number.isFinite(raw.answeredAt) ? raw.answeredAt : 0,
    score: cleanScore(raw.score),
    stage: WISH_STAGES.includes(raw.stage) ? raw.stage : '',
    stageAt: Number.isFinite(raw.stageAt) ? raw.stageAt : 0,
  };
}

// A score out of 100, a whole number, or null.
export const cleanScore = (v) => (Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : null);

export const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };
export const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };

// The device key is a secret only that browser knows; the keeper files
// copies under a hash of it, so nobody else can overwrite them. A login's
// player id is the folder its copies are filed in, and its token is the
// secret one logged-in device holds.
export const isDeviceKey = (v) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
export const isNonce = isDeviceKey;
export const isToken = isDeviceKey;
export const isPlayerId = (v) => typeof v === 'string' && /^[0-9a-f]{20}$/.test(v);
export const isIslandId = (v) => typeof v === 'string' && /^[0-9a-f]{12}$/.test(v);
// What PeerServer accepts as an id.
export const isPeerId = (v) => typeof v === 'string' && v.length <= 64 && /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(v);

export function isPublicKey(jwk) {
  return Boolean(jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string' && !('d' in jwk));
}

// What the keeper signs: its own peer id and the page's nonce, so a
// signature is good for one keeper and one conversation only.
export function challenge(peer, nonce, v = KEEPER_VERSION) {
  return new TextEncoder().encode(`kids-world keeper ${v}\n${peer}\n${nonce}`);
}

export function randomHex(bytes) {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function toBase64Url(buffer) {
  let text = '';
  for (const b of new Uint8Array(buffer)) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function verifySignature(publicKey, peer, nonce, sig) {
  const bytes = fromBase64Url(sig);
  if (!bytes) return false;
  try {
    return await globalThis.crypto.subtle.verify(SIGN_ALGORITHM, publicKey, bytes, challenge(peer, nonce));
  } catch {
    return false;
  }
}

// The most counts and stickers a profile keeps: plenty of room past the
// game's own (stickers.js), so a new sticker or count needs no change here
// and is kept even by a keeper running older code, while a made-up profile
// stays small.
export const KEPT_MAX = 256;

// What is kept of a profile: your name and look, your basket, coins,
// potions and gear from the shop, what you have done and the stickers it
// earned, when your name, look, basket, coins, potions or gear last
// changed, and your gallery of drawings (drawing.js). Never your tokens,
// which let you back into islands as yourself, nor your settings. The page
// sends exactly this.
export function keptProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const numbers = (source, pattern, max) => {
    const out = {};
    const entries = source && typeof source === 'object' ? Object.entries(source) : [];
    for (const [key, value] of entries.slice(0, max)) {
      if (pattern.test(key) && Number.isFinite(value) && value >= 0) out[key] = value;
    }
    return out;
  };
  const basket = {};
  for (const c of COLLECTABLES) {
    const n = p.basket?.[c.key];
    basket[c.key] = Number.isInteger(n) && n > 0 ? Math.min(999, n) : 0;
  }
  return {
    name: isValidName(p.name) ? p.name : '',
    look: cleanLook(p.look),
    basket,
    coins: cleanCoins(p.coins),
    potions: cleanPotions(p.potions),
    gear: cleanGear(p.gear),
    stats: numbers(p.stats, /^[a-z]{1,24}$/i, KEPT_MAX),
    stickers: numbers(p.stickers, /^[a-z-]{1,32}$/, KEPT_MAX),
    gallery: cleanGallery(p.gallery),
    changedAt: Number.isFinite(p.changedAt) && p.changedAt > 0 ? p.changedAt : 0,
  };
}

// ---------------------------------------------------------------- logins

// A login's password: typed, never shown to anyone, PASSWORD_MIN to
// PASSWORD_MAX characters, and not just the name. Compared in Unicode NFC, so
// the same letters from any keyboard are the same password.
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;
export const cleanPassword = (v) => (typeof v === 'string' ? v.normalize('NFC') : '');

// What is wrong with a new password, for this username: 'short', 'long',
// 'name' (it is the username), or '' when nothing is.
export function passwordProblem(password, username = '') {
  const p = cleanPassword(password);
  const length = [...p].length;
  if (length < PASSWORD_MIN) return 'short';
  if (length > PASSWORD_MAX) return 'long';
  const squash = (text) => usernameKey(text).replace(/[\s_-]+/g, '');
  if (username && squash(p) === squash(username)) return 'name';
  return '';
}

// A player's name as a username, for logins from before usernames, which
// went by the name rolled from the word lists (without the number an island
// adds when two players there have the same one).
export const loginName = (name) => (isMadeUpName(name) ? name.replace(/ [2-9]$/, '') : isValidName(name) ? name : '');

// A username: any letters, numbers, signs and spaces, USERNAME_MIN to
// USERNAME_MAX of them, as typed (in NFC, trimmed, spaces inside made one).
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 32;
export const cleanUsername = (v) => (typeof v === 'string' ? v.normalize('NFC').trim().replace(/\s+/gu, ' ') : '');

// The same username however it was typed: in any case, and with letters
// of every width ("ＳＵＮＮＹ" is "sunny").
export const usernameKey = (v) => cleanUsername(v).normalize('NFKC').toLowerCase();

// What is wrong with a username: 'short', 'long', 'odd' (something
// invisible in it, which could make two look the same), or '' for nothing.
export function usernameProblem(v) {
  const u = cleanUsername(v);
  const length = [...u].length;
  if (length < USERNAME_MIN) return 'short';
  if (length > USERNAME_MAX) return 'long';
  if (/\p{C}/u.test(u)) return 'odd';
  return '';
}

// One player's profile from two devices, put together: the name, look,
// basket, coins, potions and gear from whichever changed them last, every
// sticker either has earned (dated the earlier day), and the most either has
// done of everything.
export function mergeProfiles(mine, theirs) {
  const a = keptProfile(mine);
  const b = keptProfile(theirs);
  const newer = b.name && (b.changedAt > a.changedAt || !a.name) ? b : a;
  const stickers = { ...a.stickers };
  for (const [key, at] of Object.entries(b.stickers)) stickers[key] = key in stickers ? Math.min(stickers[key], at) : at;
  const stats = { ...a.stats };
  for (const [key, n] of Object.entries(b.stats)) stats[key] = Math.max(stats[key] ?? 0, n);
  // The gallery as it was last changed, on whichever device: a picture taken
  // down on one stays down.
  const gallery = b.gallery.changedAt > a.gallery.changedAt ? b.gallery : a.gallery;
  return { name: newer.name, look: newer.look, basket: newer.basket, coins: newer.coins, potions: newer.potions, gear: newer.gear, changedAt: newer.changedAt, stats, stickers, gallery };
}

// What you did as the guest on a device, added to the player you logged in
// as there, once, when you say it was you: every sticker either has earned
// (dated the earlier day), the two baskets, their coins and what each has
// done added up (the highest you flew, and the facts known by heart, the
// higher of the two), and the better gear of each kind, and the clothes
// and capsule toys of both, the dragons both tamed, and the pictures in
// both galleries.
export function addProgress(player, guest) {
  const a = keptProfile(player);
  const b = keptProfile(guest);
  const stickers = { ...a.stickers };
  for (const [key, at] of Object.entries(b.stickers)) stickers[key] = key in stickers ? Math.min(stickers[key], at) : at;
  const stats = { ...a.stats };
  for (const [key, n] of Object.entries(b.stats)) stats[key] = key === 'highest' || key === 'byheart' ? Math.max(stats[key] ?? 0, n) : (stats[key] ?? 0) + n;
  const basket = {};
  for (const [key, n] of Object.entries(a.basket)) basket[key] = Math.min(999, n + (b.basket[key] ?? 0));
  const gear = cleanGear(a.gear);
  for (const key of ['shoes', 'wings', 'skates', 'weapon']) gear[key] = Math.max(gear[key], b.gear[key] ?? 0);
  gear.clothes = cleanGear({ clothes: [...gear.clothes, ...b.gear.clothes] }).clothes;
  gear.toys = addToys(gear.toys, b.gear.toys);
  gear.tames = cleanTames(gear.tames + b.gear.tames);
  return { stickers, stats, basket, coins: Math.min(COINS_MAX, a.coins + b.coins), potions: Math.min(999, a.potions + b.potions), gear, gallery: joinGalleries(a.gallery, b.gallery) };
}

// What a logged-in page does with the keeper's list of the player's islands:
// fetch the ones the keeper has a newer copy of (of the newest `max`, which
// is all a browser keeps), and drop the ones another device said goodbye to
// since this page last changed them. Islands newer here go up as usual.
//   mine: [{ id, savedAt }]   theirs: [{ id, savedAt }]   forgotten: [{ id, at }]
export function planSync(mine, theirs, forgotten = [], max = 12) {
  const here = new Map(mine.map((i) => [i.id, i.savedAt ?? 0]));
  const gone = new Map(forgotten.map((f) => [f.id, f.at ?? 0]));
  const drop = [...here].filter(([id, savedAt]) => gone.has(id) && savedAt <= gone.get(id)).map(([id]) => id);
  const newest = new Map();
  for (const [id, savedAt] of here) if (!drop.includes(id)) newest.set(id, savedAt);
  for (const i of theirs) if (!gone.has(i.id) && (i.savedAt ?? 0) > (newest.get(i.id) ?? -1)) newest.set(i.id, i.savedAt ?? 0);
  const keep = new Set(
    [...newest]
      .sort((x, y) => y[1] - x[1])
      .slice(0, max)
      .map(([id]) => id),
  );
  const fetch = theirs.filter((i) => keep.has(i.id) && !gone.has(i.id) && (i.savedAt ?? 0) > (here.get(i.id) ?? -1)).map((i) => i.id);
  return { fetch, drop };
}
