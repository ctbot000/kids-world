// The island's song: an MP3 the island's owner picks from their device to
// play for everyone on the island instead of the island music. It travels
// as base64 text in numbered pieces, each one message, so that a song never
// makes one message too big for a data channel or the dedicated server and
// moves and edits still get through while it does.

// The biggest MP3 an owner can pick: a few songs' worth.
export const SONG_MAX_BYTES = 8 * 1024 * 1024;
// Base64 characters in one piece (a multiple of 4, so each decodes alone).
export const SONG_PIECE = 256 * 1024;
export const SONG_MAX_PIECES = Math.ceil((4 * Math.ceil(SONG_MAX_BYTES / 3)) / SONG_PIECE);
export const SONG_NAME_MAX = 60;

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const ID = /^[0-9a-z]{1,32}$/;

// What the song is called: its file name without the .mp3, tidied, or 'A song'.
export function songName(raw) {
  const name = String(raw ?? '')
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .replace(/\s*\.mp3$/i, '');
  const chars = [...name];
  return chars.length ? (chars.length > SONG_NAME_MAX ? `${chars.slice(0, SONG_NAME_MAX - 1).join('').trimEnd()}…` : name) : 'A song';
}

// A piece of a song as sent ({ id, name, i, n, data }), checked, or null.
export function cleanPiece(msg) {
  const { id, i, n, data } = msg ?? {};
  if (typeof id !== 'string' || !ID.test(id)) return null;
  if (!Number.isInteger(n) || n < 1 || n > SONG_MAX_PIECES) return null;
  if (!Number.isInteger(i) || i < 0 || i >= n) return null;
  if (typeof data !== 'string' || data.length === 0 || data.length > SONG_PIECE || !BASE64.test(data)) return null;
  // Only the last piece may be short (or padded).
  if (i < n - 1 && (data.length !== SONG_PIECE || data.endsWith('='))) return null;
  return { id, name: songName(msg.name), i, n, data };
}

// Base64 text in pieces for sending, and a new id for the song.
export function songPieces(base64) {
  const n = Math.max(1, Math.ceil(base64.length / SONG_PIECE));
  const id = Math.floor(Math.random() * 36 ** 8).toString(36);
  return { id, n, pieces: Array.from({ length: n }, (_, i) => base64.slice(i * SONG_PIECE, (i + 1) * SONG_PIECE)) };
}

// Collects a song's pieces as they arrive (in any order); add() returns the
// whole base64 text once the last one is in, else null.
export class SongPieces {
  constructor() {
    this.id = '';
    this.name = '';
    this.parts = [];
    this.count = 0;
  }

  add(piece) {
    if (piece.id !== this.id || piece.n !== this.parts.length) {
      this.id = piece.id;
      this.name = piece.name;
      this.parts = new Array(piece.n);
      this.count = 0;
    }
    if (this.parts[piece.i] !== undefined) return null;
    this.parts[piece.i] = piece.data;
    this.count++;
    return this.count === this.parts.length ? this.parts.join('') : null;
  }
}
