// The sounds of soul weapons (shared/souls.js): each soul's own as its weapon is
// swung, a part coming out of a golden chest, the Soul Forge, and their souls.
// Made as they are heard (sound.js tone and noise).
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
const r = () => 0.96 + Math.random() * 0.08;

// What each soul sounds like as a swing of its weapon lands (g: how loud).
const SWINGS = {
  // A bright blade of light, ringing off into the distance.
  star: (s, g) => {
    s.noise(0.42, { type: 'bandpass', freq: 2600, sweep: 700, q: 1.1, gain: 0.26 * g });
    s.tone(1480 * r(), { type: 'triangle', decay: 0.34, gain: 0.1 * g, slide: 520, slideTime: 0.3 });
    for (const [i, n] of [91, 95, 98, 103].entries()) s.tone(NOTE(n) * r(), { at: 0.03 + i * 0.045, decay: 0.34, gain: 0.04 * g, type: 'triangle' });
  },
  // Whirring out, and back, a colour at a time.
  rainbow: (s, g) => {
    for (let i = 0; i < 7; i++) s.tone(NOTE(72 + [0, 2, 4, 5, 7, 9, 11][i]), { at: i * 0.05, decay: 0.13, gain: 0.05 * g, type: 'triangle' });
    for (let i = 0; i < 7; i++) s.tone(NOTE(83 - [0, 2, 4, 5, 7, 9, 11][i]), { at: 0.4 + i * 0.05, decay: 0.12, gain: 0.035 * g, type: 'triangle' });
    s.noise(0.4, { type: 'bandpass', freq: 700, sweep: 2200, q: 2.4, gain: 0.2 * g });
    s.noise(0.42, { at: 0.38, type: 'bandpass', freq: 2200, sweep: 600, q: 2.4, gain: 0.18 * g });
  },
  // Claws through the air.
  wild: (s, g) => {
    for (let i = 0; i < 3; i++) s.noise(0.12, { at: i * 0.045, type: 'bandpass', freq: 3400 - i * 500, sweep: 900, q: 1.6, gain: 0.24 * g });
    s.tone(150 * r(), { type: 'sawtooth', decay: 0.26, gain: 0.1 * g, slide: 74, slideTime: 0.24, vibrato: 22 });
  },
  // DONG.
  bells: (s, g) => {
    for (const [k, v, d] of [[1, 0.26, 1.5], [2.0, 0.14, 1.1], [2.4, 0.1, 0.9], [3.0, 0.07, 0.7], [4.5, 0.05, 0.5]]) s.tone(196 * k * r(), { decay: d, gain: v * g, type: k > 2.2 ? 'triangle' : 'sine' });
    s.noise(0.05, { type: 'highpass', freq: 2600, gain: 0.2 * g, attack: 0.001 });
    s.tone(84, { decay: 0.4, gain: 0.3 * g, slide: 46 });
  },
  // A great wet slap of paint.
  toon: (s, g) => {
    s.noise(0.3, { type: 'bandpass', freq: 500, sweep: 2400, q: 1.1, gain: 0.26 * g });
    s.noise(0.2, { at: 0.2, type: 'lowpass', freq: 1500, sweep: 260, gain: 0.34 * g });
    s.tone(230 * r(), { at: 0.2, decay: 0.16, gain: 0.2 * g, slide: 620, slideTime: 0.1 });
    for (let i = 0; i < 4; i++) s.tone((420 + Math.random() * 500) * r(), { at: 0.28 + i * 0.07, decay: 0.07, gain: 0.07 * g, slide: 1100, slideTime: 0.05 });
  },
  // A hush, and a music box.
  nod: (s, g) => {
    s.noise(0.6, { type: 'bandpass', freq: 900, sweep: 320, q: 1.4, gain: 0.2 * g, attack: 0.12 });
    for (const [i, n] of [88, 84, 81, 76, 72].entries()) s.tone(NOTE(n), { at: 0.04 + i * 0.1, decay: 0.5, gain: 0.05 * g });
    s.tone(98, { decay: 0.6, gain: 0.14 * g, slide: 74 });
  },
};

// A chord of a choir: notes, for long, how loud.
function choir(s, notes, at, long, gain) {
  for (const n of notes) {
    s.tone(NOTE(n), { at, attack: long * 0.25, decay: long * 0.75, gain, type: 'triangle', vibrato: 5 });
    s.tone(NOTE(n) * 2.003, { at, attack: long * 0.3, decay: long * 0.7, gain: gain * 0.35 });
  }
}

export const SOUL_SOUNDS = {
  'soul-swing': (s, o) => {
    const near = o.near ?? 1;
    (o.souls ?? []).forEach((k, i) => SWINGS[k]?.(s, (near * (i ? 0.55 : 1)) / Math.sqrt(Math.max(1, (o.souls.length ?? 1) * 0.6))));
  },
  // Wildheart's wolf, springing.
  'soul-wolf': (s, o) => {
    const g = o.near ?? 1;
    s.tone(420 * r(), { type: 'sawtooth', attack: 0.04, decay: 0.42, gain: 0.07 * g, slide: 640, slideTime: 0.2, vibrato: 26 });
    s.tone(210 * r(), { type: 'triangle', attack: 0.03, decay: 0.4, gain: 0.14 * g, slide: 330, slideTime: 0.2 });
    s.noise(0.3, { type: 'bandpass', freq: 600, sweep: 1500, q: 1.2, gain: 0.14 * g });
  },
  // A pillar of light out of a golden chest.
  'soul-beam': (s, o) => {
    const g = o.near ?? 1;
    s.tone(70, { decay: 1.4, gain: 0.4 * g, slide: 120, slideTime: 1.2 });
    s.noise(2.2, { type: 'bandpass', freq: 400, sweep: 4200, q: 0.9, gain: 0.16 * g, attack: 0.4 });
    [60, 64, 67, 71, 74, 79, 83, 86].forEach((n, i) => s.tone(NOTE(n), { at: i * 0.11, decay: 1.1, gain: 0.06 * g, type: 'triangle' }));
    choir(s, [60, 67, 72, 76], 0.7, 2.2, 0.035 * g);
  },
  // On the stage: the dark, waiting; and a light coming.
  'soul-hush': (s) => {
    s.tone(58, { attack: 0.6, decay: 2.2, gain: 0.22 });
    s.noise(2, { type: 'lowpass', freq: 300, sweep: 1100, gain: 0.1, attack: 0.8 });
    for (let i = 0; i < 6; i++) s.tone(NOTE(84 + [0, 4, 7, 11, 14, 16][i]), { at: 0.2 + i * 0.16, decay: 0.7, gain: 0.025 });
  },
  // A part you did not have.
  'soul-part': (s) => {
    s.tone(92, { decay: 0.9, gain: 0.5, slide: 44 });
    s.noise(0.5, { type: 'lowpass', freq: 2400, sweep: 200, gain: 0.3 });
    s.noise(1.6, { type: 'highpass', freq: 6500, gain: 0.07 });
    [67, 71, 74, 79, 83, 86].forEach((n, i) => s.tone(NOTE(n), { at: i * 0.07, decay: 0.9 + i * 0.1, gain: 0.1, type: 'triangle' }));
    choir(s, [55, 62, 67, 71, 74], 0.2, 2.6, 0.045);
    [91, 95, 98, 103].forEach((n, i) => s.tone(NOTE(n), { at: 0.7 + i * 0.09, decay: 0.6, gain: 0.035 }));
  },
  // One you had already.
  'soul-again': (s) => {
    s.tone(110, { decay: 0.5, gain: 0.3, slide: 70 });
    [67, 70, 74].forEach((n, i) => s.tone(NOTE(n), { at: i * 0.09, decay: 0.7, gain: 0.09, type: 'triangle' }));
    s.noise(0.8, { type: 'highpass', freq: 6000, gain: 0.035 });
  },
  // A part drawn in to the forge, and locking on: the i-th of n, a note higher each.
  'soul-draw': (s, o) => {
    const k = o.n > 1 ? (o.i ?? 0) / (o.n - 1) : 0;
    s.noise(0.5, { type: 'bandpass', freq: 500 + k * 400, sweep: 2600 + k * 1400, q: 1.8, gain: 0.18, attack: 0.3 });
    s.tone(NOTE(50 + k * 12), { attack: 0.3, decay: 0.25, gain: 0.08, slide: NOTE(62 + k * 12), slideTime: 0.5 });
  },
  'soul-snap': (s, o) => {
    const n = 60 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, o.i ?? 0)];
    s.noise(0.03, { type: 'highpass', freq: 3200, gain: 0.4, attack: 0.001 });
    s.tone(120 * r(), { decay: 0.24, gain: 0.5, slide: 52 });
    for (const f of [1870, 2630, 3910]) s.tone(f * r(), { decay: 0.3, gain: 0.04, type: 'triangle' });
    s.tone(NOTE(n), { decay: 0.7, gain: 0.16, type: 'triangle' });
    s.tone(NOTE(n + 12), { at: 0.02, decay: 0.5, gain: 0.07 });
  },
  // All of it gathering: secs long.
  'soul-rise': (s, o) => {
    const d = o.secs ?? 2;
    s.tone(48, { attack: d * 0.9, decay: 0.2, gain: 0.5, slide: 130, slideTime: d });
    s.tone(96, { type: 'sawtooth', attack: d * 0.9, decay: 0.15, gain: 0.05, slide: 520, slideTime: d });
    s.noise(d, { type: 'bandpass', freq: 220, sweep: 5200, q: 0.8, gain: 0.3, attack: d * 0.85 });
    const steps = Math.round(d * 9);
    for (let i = 0; i < steps; i++) s.tone(NOTE(48 + i * (36 / steps)), { at: (i / steps) * d, decay: 0.16, gain: 0.02 + 0.05 * (i / steps), type: 'triangle' });
  },
  // And there it is, whole.
  'soul-forged': (s) => {
    s.tone(64, { decay: 1.8, gain: 0.7, slide: 30 });
    s.noise(1.1, { type: 'lowpass', freq: 5200, sweep: 120, gain: 0.5 });
    s.noise(2.4, { type: 'highpass', freq: 7000, gain: 0.08 });
    choir(s, [48, 55, 60, 64, 67, 72], 0.05, 3.4, 0.06);
    [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => s.tone(NOTE(n), { at: 0.1 + i * 0.07, decay: 1, gain: 0.08, type: 'triangle' }));
  },
  // Its soul, waking.
  'soul-wake': (s) => {
    s.tone(62, { type: 'sawtooth', attack: 0.3, decay: 1.7, gain: 0.2, slide: 38, slideTime: 1.8, vibrato: 14 });
    s.tone(93, { type: 'square', attack: 0.2, decay: 1.3, gain: 0.06, slide: 52, slideTime: 1.4, vibrato: 18 });
    s.noise(1.7, { type: 'bandpass', freq: 320, sweep: 130, q: 1.2, gain: 0.4, attack: 0.25 });
    s.tone(38, { attack: 0.1, decay: 2.2, gain: 0.5 });
    [58, 61, 64, 67].forEach((n, i) => s.tone(NOTE(n), { at: 0.2 + i * 0.12, decay: 1.6, gain: 0.04, type: 'triangle', vibrato: 10 }));
  },
  // Beaten: it is yours.
  'soul-won': (s) => {
    s.tone(58, { decay: 1.6, gain: 0.6, slide: 32 });
    s.noise(0.9, { type: 'lowpass', freq: 4200, sweep: 160, gain: 0.4 });
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => s.tone(NOTE(n), { at: 0.15 + i * 0.12, decay: i === 6 ? 2 : 0.4, gain: 0.15, type: 'triangle' }));
    choir(s, [48, 55, 60, 64, 67, 72, 76], 0.9, 3.4, 0.06);
    [96, 100, 103, 108].forEach((n, i) => s.tone(NOTE(n), { at: 1.2 + i * 0.1, decay: 0.9, gain: 0.04 }));
    s.noise(2.4, { at: 0.9, type: 'highpass', freq: 7000, gain: 0.07 });
  },
  // Two weapons circling each other, faster and faster: secs long.
  'soul-circle': (s, o) => {
    const d = o.secs ?? 3;
    let t = 0;
    let gap = 0.42;
    let i = 0;
    while (t < d) {
      s.noise(0.2, { at: t, type: 'bandpass', freq: 500 + (t / d) * 1800, sweep: 900 + (t / d) * 3000, q: 1.8, gain: 0.1 + 0.16 * (t / d) });
      s.tone(NOTE(50 + (i % 2) * 7 + Math.floor((t / d) * 12)), { at: t, decay: 0.24, gain: 0.08, type: 'triangle' });
      t += gap;
      gap = Math.max(0.07, gap * 0.9);
      i++;
    }
    s.tone(50, { attack: d * 0.9, decay: 0.2, gain: 0.5, slide: 170, slideTime: d });
    s.noise(d, { type: 'bandpass', freq: 200, sweep: 6000, q: 0.7, gain: 0.26, attack: d * 0.9 });
  },
  // Drawn in to nothing; and out again, as one.
  'soul-hole': (s) => {
    s.tone(900, { decay: 0.6, gain: 0.2, slide: 40, slideTime: 0.6 });
    s.noise(0.6, { type: 'bandpass', freq: 5200, sweep: 120, q: 1, gain: 0.34 });
  },
  'soul-nova': (s) => {
    s.tone(52, { decay: 2.6, gain: 0.8, slide: 24 });
    s.tone(104, { decay: 1.2, gain: 0.4, slide: 40 });
    s.noise(1.8, { type: 'lowpass', freq: 7000, sweep: 100, gain: 0.6 });
    s.noise(3, { type: 'highpass', freq: 7500, gain: 0.09 });
    choir(s, [43, 50, 55, 59, 62, 67, 71, 74], 0.1, 4, 0.055);
    [67, 71, 74, 79, 83, 86, 91, 95, 98].forEach((n, i) => s.tone(NOTE(n), { at: 0.25 + i * 0.08, decay: 1.3, gain: 0.08, type: 'triangle' }));
  },
  // Taken apart again.
  'soul-split': (s) => {
    s.noise(0.5, { type: 'bandpass', freq: 3000, sweep: 400, q: 1.2, gain: 0.26 });
    [79, 74, 71, 67].forEach((n, i) => s.tone(NOTE(n), { at: i * 0.08, decay: 0.4, gain: 0.1, type: 'triangle' }));
  },
  // Melted down.
  'soul-melt': (s) => {
    s.noise(0.7, { type: 'highpass', freq: 3500, sweep: 7500, gain: 0.12 });
    for (let i = 0; i < 6; i++) s.tone(2400 + Math.random() * 1600, { at: 0.2 + i * 0.05, decay: 0.09, gain: 0.05, type: 'square' });
  },
  // A soul, far off, as you come to its world; and as it is beaten.
  'soul-gone': (s) => {
    s.tone(520, { attack: 0.1, decay: 1.6, gain: 0.12, slide: 1040, slideTime: 1.5, vibrato: 12 });
    s.noise(1.4, { type: 'bandpass', freq: 900, sweep: 4200, q: 1, gain: 0.18, attack: 0.2 });
    choir(s, [60, 64, 67, 72], 0.3, 2.4, 0.04);
  },
};

// The music of a duel with a weapon's soul (nod/duel.js): each soul's own key (its
// root) and pace, over four chords, a galloping bass and drums, and a tune.
const DUELS = {
  star: { root: 57, tempo: 152 },
  rainbow: { root: 59, tempo: 146 },
  wild: { root: 52, tempo: 160 },
  bells: { root: 50, tempo: 132 },
  toon: { root: 60, tempo: 166 },
  nod: { root: 54, tempo: 138 },
};
const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
const TUNES = [
  [12, null, 15, 14, 12, null, 10, 7, 12, null, 15, 17, 19, null, 17, 15],
  [19, null, 17, 15, 17, null, 14, null, 15, 14, 12, null, 10, 12, 14, null],
];
export const duelTempo = (soul) => (DUELS[soul] ?? DUELS.star).tempo;

// An eighth note of it, at seconds from now: fuller the crosser the soul is (rage,
// 0 to 2).
export function duelBeat(s, beat, at, { soul, rage = 0 }) {
  const { root } = DUELS[soul] ?? DUELS.star;
  const bar = Math.floor(beat / 8);
  const step = beat % 8;
  const chord = CHORDS[Math.floor(bar / 2) % 4].map((n) => root + n);
  const dest = s.music;
  if ([1, 0, 1, 1, 1, 0, 1, 1][step]) s.tone(NOTE(chord[0] - 24 + (step === 6 ? 12 : 0)), { at, decay: 0.17, gain: 0.16, type: 'triangle', dest });
  if (step % 4 === 0) s.tone(118, { at, decay: 0.15, gain: 0.3, slide: 46, dest });
  if (step % 4 === 2) s.noise(0.13, { at, type: 'bandpass', freq: 1900, q: 0.7, gain: 0.13, dest });
  if (rage || step % 2 === 0) s.noise(0.04, { at, type: 'highpass', freq: 7200, gain: 0.03 + rage * 0.01, dest });
  if (step === 0) for (const n of chord) s.tone(NOTE(n), { at, attack: 0.03, decay: 0.95, gain: 0.04, type: 'triangle', dest });
  if (rage && step === 4) for (const n of chord) s.tone(NOTE(n + 12), { at, decay: 0.3, gain: 0.022, type: 'triangle', dest });
  const n = TUNES[Math.floor(bar / 4) % 2][(bar % 2) * 8 + step];
  if (n === null || (!rage && bar % 8 < 2)) return;
  s.tone(NOTE(root + n), { at, decay: 0.26, gain: 0.075, type: 'triangle', dest });
  if (rage > 1) s.tone(NOTE(root + n + 12), { at, decay: 0.18, gain: 0.03, dest });
}

// What a blow of a soul weapon's sounds like, as one of the toy weapons' does
// (sound.js whack), by the soul its form is of.
export const SOUL_WHACKS = { star: 'galaxyblade', rainbow: 'rainbowray', wild: 'lavablade', bells: 'hammer', toon: 'punchglove', nod: 'galaxyblade' };
