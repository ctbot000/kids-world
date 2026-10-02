// The keeper: a computer that keeps a copy of every player's islands and of
// who they are, sent by their browsers peer to peer whenever it is online.
// This is what the page and the keeper (server/keeper.js) agree on: the
// messages, how the keeper proves it is the real one, and the limits.
//
//   page → keeper   { t: 'hello', v, nonce, device }
//   keeper → page   { t: 'hello', v, sig }           sig: the challenge, signed
//   page → keeper   { t: 'island', id, save }  or  { t: 'profile', profile }
//   keeper → page   { t: 'kept', what, id?, savedAt? }  or  { t: 'error', code, text }
//
// Anyone can register a peer id while the keeper is away, so the page sends
// nothing until the keeper has signed the page's fresh nonce with the key
// whose public half is in keeper.json. The data channel itself is encrypted
// end to end, as every WebRTC channel is.
import { COLLECTABLES } from './blocks.js';
import { CHUNK } from './framing.js';
import { cleanLook, isValidName } from './words.js';

export const KEEPER_VERSION = 1;

// The longest message: an island, as JSON. A busy island is a few hundred KB.
export const MAX_TEXT = 4 * 1024 * 1024;
export const MAX_PARTS = Math.ceil(MAX_TEXT / CHUNK);

export const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };
export const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };

// The device key is a secret only that browser knows; the keeper files
// copies under a hash of it, so nobody else can overwrite them.
export const isDeviceKey = (v) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
export const isNonce = isDeviceKey;
export const isIslandId = (v) => typeof v === 'string' && /^[0-9a-f]{12}$/.test(v);
// What PeerServer accepts as an id.
export const isPeerId = (v) => typeof v === 'string' && v.length <= 64 && /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(v);

export function isPublicKey(jwk) {
  return Boolean(jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string' && !('d' in jwk));
}

// What the keeper signs: its own peer id and the page's nonce, so a
// signature is good for one keeper and one conversation only.
export function challenge(peer, nonce) {
  return new TextEncoder().encode(`kids-world keeper ${KEEPER_VERSION}\n${peer}\n${nonce}`);
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

// What is kept of a profile: your name and look, your basket, what you have
// done and the stickers it earned. Never your tokens, which let you back into
// islands as yourself, nor your settings. The page sends exactly this.
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
    stats: numbers(p.stats, /^[a-z]{1,24}$/i, 64),
    stickers: numbers(p.stickers, /^[a-z-]{1,32}$/, 64),
  };
}
