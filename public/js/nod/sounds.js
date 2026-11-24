// The sounds of the Land of Nod (fight.js, nod-game.js), each made as it is
// heard (sound.js tone and noise).
export const NOD_SOUNDS = {
  // About to strike: bop now!
  'nod-glint': (s) => {
    s.tone(1760, { decay: 0.16, gain: 0.16 });
    s.tone(2637, { at: 0.03, decay: 0.2, gain: 0.12 });
  },
  // A bop off a guard.
  'nod-clang': (s) => {
    for (const [f, g] of [[620, 0.16], [1490, 0.1], [2350, 0.07]]) s.tone(f * (0.97 + Math.random() * 0.06), { type: 'triangle', decay: 0.28, gain: g });
    s.noise(0.05, { type: 'highpass', freq: 3000, gain: 0.14 });
  },
  // Bopped right back.
  'nod-ping': (s, o) => {
    s.noise(0.06, { type: 'bandpass', freq: 2200, q: 0.8, gain: 0.28 });
    s.tone(980, { type: 'triangle', decay: 0.2, gain: 0.26, slide: 1960 });
    s.tone(1960, { at: 0.03, decay: 0.4, gain: 0.16 });
    if (o.big) s.tone(130, { decay: 0.3, gain: 0.35, slide: 70 });
  },
  // Out of the way, just in time.
  'nod-dodge': (s) => {
    s.noise(0.22, { type: 'bandpass', freq: 500, sweep: 3200, q: 1.2, gain: 0.22 });
    s.tone(660, { at: 0.04, decay: 0.16, gain: 0.14, slide: 1320 });
    s.tone(1320, { at: 0.12, decay: 0.3, gain: 0.12 });
  },
  'nod-roll': (s, o) => {
    const k = o.far ? 0.3 : 1;
    s.noise(0.26, { type: 'bandpass', freq: 420, sweep: 1300, q: 0.9, gain: 0.2 * k });
    s.tone(180, { decay: 0.16, gain: 0.1 * k, slide: 320 });
  },
  'nod-slam': (s) => {
    s.tone(110, { decay: 0.36, gain: 0.5, slide: 42 });
    s.noise(0.3, { freq: 500, sweep: 110, gain: 0.34 });
    s.tone(880, { at: 0.02, type: 'triangle', decay: 0.14, gain: 0.08, slide: 400 });
  },
  // A ring let go over the ground.
  'nod-ring': (s) => {
    s.tone(520, { type: 'triangle', decay: 0.5, gain: 0.18, vibrato: 30, slide: 300 });
    s.tone(1040, { type: 'triangle', decay: 0.3, gain: 0.08, vibrato: 50 });
    s.noise(0.5, { type: 'bandpass', freq: 700, sweep: 220, q: 0.8, gain: 0.16 });
  },
  'nod-ready': (s) => {
    [523, 659, 784, 1047].forEach((f, i) => s.tone(f, { at: i * 0.07, decay: 0.3, gain: 0.16 }));
    s.tone(1568, { at: 0.3, decay: 0.6, gain: 0.1, vibrato: 12 });
  },
  'nod-burst': (s) => {
    s.tone(90, { decay: 0.8, gain: 0.5, slide: 40 });
    s.noise(0.7, { freq: 900, sweep: 120, gain: 0.4 });
    [784, 988, 1175, 1568, 1976].forEach((f, i) => s.tone(f, { at: i * 0.04, decay: 0.7, gain: 0.13 }));
  },
  // One of them dizzy.
  'nod-dazed': (s) => {
    [880, 740, 830, 700].forEach((f, i) => s.tone(f, { at: i * 0.09, type: 'triangle', decay: 0.14, gain: 0.12, vibrato: 20 }));
  },
  'nod-bonk': (s) => {
    s.tone(190, { type: 'square', decay: 0.12, gain: 0.22, slide: 90 });
    s.tone(95, { decay: 0.4, gain: 0.5, slide: 50 });
    s.noise(0.12, { freq: 1600, sweep: 300, gain: 0.35 });
    s.tone(660, { at: 0.06, type: 'triangle', decay: 0.3, gain: 0.1, vibrato: 60 });
  },
  'nod-home': (s) => {
    [392, 523, 659].forEach((f, i) => s.tone(f, { at: i * 0.12, decay: 0.4, gain: 0.14 }));
  },
  'nod-wink': (s) => {
    const f = 1047 * 2 ** (Math.floor(Math.random() * 4) / 6);
    s.tone(f, { decay: 0.14, gain: 0.14 });
    s.tone(f * 1.5, { at: 0.06, decay: 0.3, gain: 0.12 });
  },
  'nod-bosspop': (s) => {
    s.tone(220, { decay: 1.2, gain: 0.4, slide: 40 });
    s.noise(1.1, { freq: 1400, sweep: 80, gain: 0.4 });
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => s.tone(f, { at: 0.2 + i * 0.09, decay: 0.6, gain: 0.14 }));
  },
  'nod-hurt': (s) => {
    s.tone(300, { type: 'triangle', decay: 0.2, gain: 0.3, slide: 120 });
    s.noise(0.14, { freq: 900, gain: 0.3 });
  },
  // A note of a tune, n semitones over middle C.
  'nod-note': (s, o) => {
    const f = 261.6 * 2 ** ((o.n ?? 0) / 12);
    s.tone(f, { type: 'triangle', decay: o.long ? 0.9 : 0.4, gain: 0.22 * (o.gain ?? 1) });
    s.tone(f * 2, { decay: o.long ? 0.7 : 0.3, gain: 0.08 * (o.gain ?? 1) });
  },
  'nod-tick': (s, o) => {
    s.tone(o.tock ? 620 : 880, { type: 'square', decay: 0.03, gain: 0.07 });
    s.noise(0.02, { type: 'highpass', freq: 4000, gain: 0.08 });
  },
  'nod-neigh': (s) => {
    s.tone(1150, { type: 'sawtooth', decay: 0.9, gain: 0.12, slide: 420, vibrato: 90 });
    s.tone(760, { at: 0.05, type: 'sawtooth', decay: 0.8, gain: 0.08, slide: 300, vibrato: 70 });
    s.noise(0.7, { at: 0.1, type: 'bandpass', freq: 1500, sweep: 500, q: 0.7, gain: 0.1 });
  },
};
