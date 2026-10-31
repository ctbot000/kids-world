// Pianos: an upright piano and a grand piano (pieces of furniture,
// blocks.js) to play. Walk up to one and its keyboard opens in a window:
// two octaves of keys, from middle C up, to tap or to play on your own
// keyboard, and a few songs to follow, the next key lit up each time.
//
// You hear your own notes at once, and they go to the island to be passed
// on to everyone else (room.js), who hear them from your piano when they
// are near it.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';

// The keys, middle C (MIDI 60) to the C two octaves up, white and black:
// each with its note's MIDI number, its name and the key on a computer
// keyboard that plays it: the low octave along the Z row with its black
// keys on the A row above, and the high one along the Q row with its black
// keys on the number row, laid out like a piano's.
export const LOW = 60;
export const HIGH = 84;
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const WHITE_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i'];
const BLACK_KEYS = { 61: 's', 63: 'd', 66: 'g', 68: 'h', 70: 'j', 73: '2', 75: '3', 78: '5', 80: '6', 82: '7' };
export const KEYS = [];
{
  let white = 0;
  for (let n = LOW; n <= HIGH; n++) {
    const black = NAMES[n % 12].length > 1;
    KEYS.push({ n, name: NAMES[n % 12], black, key: black ? BLACK_KEYS[n] : WHITE_KEYS[white++] });
  }
}

// The key on a computer keyboard for each note, and the note for each key.
export const noteOfKey = (key) => KEYS.find((k) => k.key === key?.toLowerCase())?.n ?? null;

// Whether a note is one a piano here has: a whole number from LOW to HIGH.
export const isNote = (n) => Number.isInteger(n) && n >= LOW && n <= HIGH;

// Whether a block is a piano, upright or grand (any way it faces).
export const isPiano = (id) => BLOCKS[id]?.model === 'piano' || BLOCKS[id]?.model === 'grand-piano';

// The piano nearest a body standing beside it: { x, y, z, key, grand } of
// its cell, or null.
export const pianoNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isPiano(id) ? { grand: BLOCKS[id].model === 'grand-piano' } : null), reach);

// Songs to follow: the notes of each tune, in order. The window lights the
// next key to play, and a whole song played through counts.
const tune = (s) => s.split(' ').map((x) => LOW + Number(x));
export const SONGS = [
  // C C G G A A G, F F E E D D C, and on.
  { key: 'twinkle', icon: '⭐', name: 'Twinkle, Twinkle, Little Star', notes: tune('0 0 7 7 9 9 7 5 5 4 4 2 2 0 7 7 5 5 4 4 2 7 7 5 5 4 4 2 0 0 7 7 9 9 7 5 5 4 4 2 2 0') },
  { key: 'lamb', icon: '🐑', name: 'Mary Had a Little Lamb', notes: tune('4 2 0 2 4 4 4 2 2 2 4 7 7 4 2 0 2 4 4 4 4 2 2 4 2 0') },
  { key: 'joy', icon: '🎉', name: 'Ode to Joy', notes: tune('4 4 5 7 7 5 4 2 0 0 2 4 4 2 2 4 4 5 7 7 5 4 2 0 0 2 4 2 0 0') },
  { key: 'birthday', icon: '🎂', name: 'Happy Birthday', notes: tune('7 7 9 7 12 11 7 7 9 7 14 12 7 7 19 16 12 11 9 17 17 16 12 14 12') },
];

export const songOf = (key) => SONGS.find((s) => s.key === key) ?? null;

// Your own song, made at the piano: ⏺ Record takes down each note you
// play, when each came after the first one, and ▶ Play sounds them back
// with their timing. It lasts only while you sit there: nothing is saved.
export const REC_MAX = 200;

export class Recorder {
  constructor() {
    this.notes = [];
    this.on = false;
    this.last = 0;
  }

  // Recording starts over, from the next note you play (whose moment is the
  // song's own start, so a slow beginning is not a slow song).
  start() {
    this.notes = [];
    this.on = true;
    this.last = 0;
  }

  stop() {
    this.on = false;
  }

  // A note played secs after the last one taken down: kept with how far it
  // is into the song. Only so many fit, so a very long noodle is cut short
  // rather than going on for ever.
  note(n, secs) {
    if (!this.on || !isNote(n) || this.notes.length >= REC_MAX) return false;
    this.last += this.notes.length ? Math.max(0, secs) : 0;
    this.notes.push({ n, at: this.last });
    return true;
  }

  // How far the song runs, from its first note to its last.
  get length() {
    return this.notes.length ? this.notes[this.notes.length - 1].at : 0;
  }

  // The notes that fall between secs and to (the first at 0, so it sounds
  // from the moment ▶ Play is tapped): what a moment of playing back sounds.
  due(secs, to) {
    return this.notes.filter((x) => x.at > secs && x.at <= to).map((x) => x.n);
  }
}

// How high the piano bench is that you sit on to play (render/avatar.js
// draws it under you), and how far in front of the piano's middle you sit:
// the grand's keys stick out further, so you sit further out.
export const BENCH_H = 0.4;
const SIT_OUT = { piano: 0.68, 'grand-piano': 0.9 };

// The four ways along the ground, as RAIL_DIRS.
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

// Where you sit to play the piano in cell (x, y, z): on the bench in front
// of its keys, facing it: { x, y, z, yaw } (an avatar faces +z at yaw 0),
// the root at the top of the bench; or null if it is no piano.
export function pianoSeat(world, x, y, z) {
  const def = BLOCKS[world.get(x, y, z)];
  if (!isPiano(def?.id)) return null;
  const [fx, fz] = DIRS[def.front];
  const out = SIT_OUT[def.model];
  return { x: x + 0.5 + fx * out, y: y + BENCH_H, z: z + 0.5 + fz * out, yaw: Math.atan2(-fx, -fz) };
}
