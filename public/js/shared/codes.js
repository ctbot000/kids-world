// Island codes: six digits, easy for a child to read out and type on any
// keyboard (and, being digits, they never spell a word). Shared by the server,
// which hands them out, and by peer-to-peer hosts, which use them as peer ids.

export const CODE_ALPHABET = '0123456789';
export const CODE_LENGTH = 6;

// The PeerJS signaling server is shared with every other app, so namespace our ids.
export const PEER_PREFIX = 'kids-world-';

const randomBytes = (count) => globalThis.crypto.getRandomValues(new Uint8Array(count));

export function generateCode(random = randomBytes) {
  // Drop bytes past the last whole multiple of the alphabet so every digit is equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(CODE_LENGTH)) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

export function normalizeCode(input) {
  return String(input ?? '').replace(/[^0-9]/g, '');
}

export function isValidCode(code) {
  return typeof code === 'string' && code.length === CODE_LENGTH && /^[0-9]+$/.test(code);
}

// "482753" is shown as "482 753".
export const prettyCode = (code) => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

export const peerIdFor = (code) => PEER_PREFIX + code;
