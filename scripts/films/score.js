// The music and sound of Adventure Isle's films (films.js), made in the
// browser with Web Audio, offline, to the film's own clock: an orchestra of
// simple voices (strings, horns, a flute, a music box, harp, timpani and
// drums, a choir) and the sounds of the story (thunder and rain, the sea,
// sparkles, whooshes, pops and fireworks), through a hall's reverb.
// score(name, secs) → a WAV file, as base64.
//
// The tune is the isle's own: a theme in D major that the films come back
// to, and King Grumble's sly little bassoon tune in D minor.

const RATE = 48000;
const NOTES = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
// A note's frequency: 'D4', 'F#5', 'Bb3'.
function hz(note) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  const semis = NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}
// Chords as notes, low to high.
const CHORDS = {
  D: ['D3', 'A3', 'D4', 'F#4'],
  A: ['A2', 'E3', 'A3', 'C#4'],
  Bm: ['B2', 'F#3', 'B3', 'D4'],
  G: ['G2', 'D3', 'G3', 'B3'],
  Em: ['E3', 'B3', 'E4', 'G4'],
  Dm: ['D3', 'A3', 'D4', 'F4'],
  Bb: ['Bb2', 'F3', 'Bb3', 'D4'],
  Gm: ['G2', 'D3', 'G3', 'Bb3'],
  A7: ['A2', 'E3', 'G3', 'C#4'],
  F: ['F2', 'C3', 'F3', 'A3'],
  C: ['C3', 'G3', 'C4', 'E4'],
};

class Band {
  constructor(secs) {
    this.ac = new OfflineAudioContext(2, Math.ceil(secs * RATE), RATE);
    const ac = this.ac;
    this.out = ac.createDynamicsCompressor();
    this.out.threshold.value = -14;
    this.out.ratio.value = 3;
    const master = ac.createGain();
    master.gain.value = 0.8;
    this.out.connect(master).connect(ac.destination);
    // A hall: a long tail of noise, dying away.
    const verb = ac.createConvolver();
    const len = Math.floor(RATE * 2.6);
    const ir = ac.createBuffer(2, len, RATE);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    verb.buffer = ir;
    this.wet = ac.createGain();
    this.wet.gain.value = 0.32;
    this.wet.connect(verb).connect(this.out);
    this.dry = ac.createGain();
    this.dry.connect(this.out);
    this.noise = ac.createBuffer(1, RATE * 2, RATE);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  }

  // Into the mix, with this much of it in the hall (and panned).
  send(node, verb = 0.3, pan = 0) {
    const p = this.ac.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    p.connect(this.dry);
    const w = this.ac.createGain();
    w.gain.value = verb;
    p.connect(w).connect(this.wet);
  }

  env(g, t, dur, peak, attack, release) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t + dur);
  }

  // A tone: oscillators of a type (detuned a little each), through a filter.
  tone(t, dur, f, { type = 'sawtooth', gain = 0.1, attack = 0.02, release = 0.2, cutoff = 3000, q = 0.7, detune = [0], vibrato = 0, verb = 0.3, pan = 0, sweep = 0 } = {}) {
    const ac = this.ac;
    const g = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(sweep ? cutoff * 0.25 : cutoff, t);
    if (sweep) lp.frequency.linearRampToValueAtTime(cutoff, t + sweep);
    lp.Q.value = q;
    for (const d of detune) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = d;
      if (vibrato) {
        const lfo = ac.createOscillator();
        const depth = ac.createGain();
        lfo.frequency.value = 5.2;
        depth.gain.value = f * vibrato;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.1);
      }
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    this.env(g, t, dur, gain / Math.sqrt(detune.length), attack, release);
    lp.connect(g);
    this.send(g, verb, pan);
  }

  // A plucked or struck note dying away: harp, music box, pizzicato.
  pluck(t, f, { gain = 0.12, decay = 1.2, type = 'triangle', bell = false, verb = 0.35, pan = 0 } = {}) {
    const ac = this.ac;
    for (const [mul, amp] of bell ? [[1, 1], [2.76, 0.35], [5.4, 0.12]] : [[1, 1], [2, 0.25]]) {
      const o = ac.createOscillator();
      o.type = bell ? 'sine' : type;
      o.frequency.value = f * mul;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mul ** 0.3);
      o.connect(g);
      this.send(g, verb, pan);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }

  // Noise through a filter, shaped: drums, thunder, rain, the sea, whooshes.
  hiss(t, dur, { type = 'bandpass', f = 1000, f2 = null, q = 1, gain = 0.1, attack = 0.005, release = null, verb = 0.2, pan = 0 } = {}) {
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bq = ac.createBiquadFilter();
    bq.type = type;
    bq.frequency.setValueAtTime(f, t);
    if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t + dur);
    bq.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    if (release === null) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else {
      g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
      g.gain.linearRampToValueAtTime(0, t + dur);
    }
    src.connect(bq).connect(g);
    this.send(g, verb, pan);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // A drum: a pitch falling fast (kick, tom, timpani), with a little noise.
  drum(t, { f = 120, to = 45, decay = 0.35, gain = 0.5, snap = 0, verb = 0.15 } = {}) {
    const ac = this.ac;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    this.send(g, verb);
    o.start(t);
    o.stop(t + decay + 0.05);
    if (snap) this.hiss(t, decay * 0.5, { f: 1800, q: 0.8, gain: snap, verb: verb + 0.1 });
  }

  // ---------------------------------------------------------- the voices

  strings(t, dur, notes, gain = 0.05, { attack = 0.5, release = 0.8, tremolo = false } = {}) {
    for (const [i, n] of notes.entries()) {
      this.tone(t, dur, hz(n), { type: 'sawtooth', gain, attack, release, cutoff: 1600, detune: [-9, 0, 9], vibrato: 0.004, verb: 0.45, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.6 });
      if (tremolo) for (let k = 0; k < dur * 8; k++) this.tone(t + k / 8, 0.1, hz(n), { type: 'sawtooth', gain: gain * 0.5, attack: 0.01, release: 0.05, cutoff: 1200, verb: 0.4 });
    }
  }

  horn(t, dur, note, gain = 0.09) {
    this.tone(t, dur, hz(note), { type: 'sawtooth', gain, attack: 0.05, release: 0.15, cutoff: 2400, sweep: 0.12, detune: [-5, 5], vibrato: 0.003, verb: 0.35 });
  }

  flute(t, dur, note, gain = 0.08) {
    this.tone(t, dur, hz(note), { type: 'sine', gain, attack: 0.06, release: 0.12, cutoff: 5000, vibrato: 0.006, verb: 0.45 });
    this.tone(t, dur, hz(note) * 2, { type: 'sine', gain: gain * 0.12, attack: 0.08, release: 0.12, verb: 0.45 });
  }

  bassoon(t, dur, note, gain = 0.09) {
    this.tone(t, dur, hz(note), { type: 'square', gain, attack: 0.02, release: 0.06, cutoff: 900, q: 2, verb: 0.25 });
  }

  bass(t, dur, note, gain = 0.12) {
    this.tone(t, dur, hz(note), { type: 'triangle', gain, attack: 0.02, release: 0.1, cutoff: 600, verb: 0.15 });
  }

  choir(t, dur, notes, gain = 0.04) {
    const ac = this.ac;
    for (const n of notes) {
      for (const formant of [700, 1150]) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = formant;
        bp.Q.value = 6;
        const g = ac.createGain();
        this.env(g, t, dur, gain, 0.9, 1.2);
        o.connect(bp).connect(g);
        this.send(g, 0.6);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  timpaniRoll(t, dur, note = 'D2', gain = 0.25) {
    for (let k = 0; k < dur * 14; k++) this.drum(t + k / 14, { f: hz(note) * 1.3, to: hz(note), decay: 0.5, gain: gain * (0.4 + 0.6 * (k / (dur * 14))), verb: 0.3 });
  }

  crash(t, gain = 0.12, dur = 3) {
    this.hiss(t, dur, { type: 'highpass', f: 5000, q: 0.5, gain, verb: 0.4 });
  }

  swell(t, dur, gain = 0.1) {
    this.hiss(t, dur, { type: 'highpass', f: 4000, q: 0.5, gain, attack: dur * 0.95, release: 0.05, verb: 0.5 });
  }

  // ---------------------------------------------------------- the story's sounds

  thunder(t, gain = 0.5) {
    this.hiss(t, 0.25, { type: 'highpass', f: 1500, gain: gain * 0.5, verb: 0.3 });
    this.hiss(t + 0.05, 3.5, { type: 'lowpass', f: 180, q: 0.7, gain, attack: 0.08, verb: 0.5 });
  }

  rain(t, dur, gain = 0.05) {
    this.hiss(t, dur, { type: 'highpass', f: 2500, q: 0.4, gain, attack: 0.8, release: 0.8, verb: 0.2 });
  }

  sea(t, dur, gain = 0.06) {
    for (let k = 0; k < dur / 2.4; k++) this.hiss(t + k * 2.4, 3.2, { type: 'lowpass', f: 600, q: 0.6, gain, attack: 1.2, release: 1.6, verb: 0.3 });
  }

  whoosh(t, gain = 0.08, dur = 0.7, pan = 0) {
    this.hiss(t, dur, { type: 'bandpass', f: 300, f2: 3200, q: 2, gain, attack: dur * 0.6, release: dur * 0.35, verb: 0.3, pan });
  }

  sparkle(t, count = 8, gain = 0.05) {
    const notes = ['D6', 'F#6', 'A6', 'D7', 'E6', 'B6'];
    for (let k = 0; k < count; k++) this.pluck(t + k * 0.07 + Math.random() * 0.03, hz(notes[k % notes.length]), { bell: true, gain, decay: 1.2, verb: 0.5, pan: Math.random() - 0.5 });
  }

  pop(t, gain = 0.25) {
    const ac = this.ac;
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    this.send(g, 0.2);
    o.start(t);
    o.stop(t + 0.2);
  }

  firework(t, gain = 0.12) {
    this.whoosh(t, gain * 0.4, 0.6, Math.random() - 0.5);
    this.hiss(t + 0.6, 1.2, { type: 'lowpass', f: 900, gain, verb: 0.5 });
    for (let k = 0; k < 10; k++) this.hiss(t + 0.8 + Math.random() * 0.8, 0.04, { type: 'highpass', f: 3000, gain: gain * 0.6, verb: 0.3 });
  }

  cheer(t, dur, gain = 0.05) {
    for (let k = 0; k < 6; k++) this.hiss(t + k * 0.05, dur, { type: 'bandpass', f: 900 + k * 180, q: 4, gain, attack: 0.3, release: 1, verb: 0.4 });
  }

  // A tune: [note, beats] pairs from t at bpm, played by voice (a method).
  tune(t, bpm, notes, voice, gain) {
    const beat = 60 / bpm;
    let at = t;
    for (const [n, beats] of notes) {
      if (n) this[voice](at, beats * beat * 0.95, n, gain);
      at += beats * beat;
    }
    return at;
  }

  // Chords under it, a bar each (four beats), by strings and a bass.
  chords(t, bpm, list, gain = 0.035, opts = {}) {
    const bar = (60 / bpm) * 4;
    list.forEach((c, i) => {
      this.strings(t + i * bar, bar * 1.02, CHORDS[c], gain, opts);
      this.bass(t + i * bar, bar * 0.48, CHORDS[c][0], 0.1);
      this.bass(t + i * bar + bar / 2, bar * 0.45, CHORDS[c][0], 0.08);
    });
    return t + list.length * bar;
  }

  // A music box's arpeggios over the chords, eighth notes.
  arps(t, bpm, list, gain = 0.06) {
    const e = 60 / bpm / 2;
    list.forEach((c, i) => {
      const n = CHORDS[c];
      const seq = [n[1], n[2], n[3], n[2]].map((x) => x.replace(/\d/, (d) => String(Number(d) + 2)));
      for (let k = 0; k < 8; k++) this.pluck(t + i * e * 8 + k * e, hz(seq[k % 4]), { bell: true, gain, decay: 1.4 });
    });
  }

  // A drum kit's beat for bars: kick, a snare of noise, and toms.
  beat(t, bpm, bars, gain = 0.35) {
    const b = 60 / bpm;
    for (let i = 0; i < bars * 4; i++) {
      const at = t + i * b;
      if (i % 2 === 0) this.drum(at, { f: 110, to: 45, decay: 0.3, gain });
      else this.drum(at, { f: 220, to: 160, decay: 0.15, gain: gain * 0.4, snap: gain * 0.35 });
      if (i % 4 === 3) this.drum(at + b / 2, { f: 150, to: 90, decay: 0.25, gain: gain * 0.5 });
    }
  }

  async render() {
    const buf = await this.ac.startRendering();
    return wav(buf);
  }
}

function wav(buf) {
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, RATE, true);
  out.setUint32(28, RATE * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, n * 4, true);
  // Faded in and out at the very ends, so it never clicks.
  for (let i = 0; i < n; i++) {
    const edge = Math.min(1, i / 480, (n - 1 - i) / 4800);
    for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i] * edge)) * 32767, true);
  }
  const bytes = new Uint8Array(out.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// The isle's theme, in D, as [note, beats]: two phrases of four bars.
const THEME = [
  ['D5', 1], ['A4', 0.5], ['F#4', 0.5], ['A4', 1], ['D5', 1],
  ['E5', 1.5], ['D5', 0.5], ['C#5', 1], ['A4', 1],
  ['B4', 1], ['G4', 0.5], ['B4', 0.5], ['D5', 1], ['G5', 1],
  ['F#5', 3], [null, 1],
  ['G5', 1], ['F#5', 0.5], ['E5', 0.5], ['D5', 1], ['B4', 1],
  ['A4', 1.5], ['B4', 0.5], ['A4', 1], ['F#4', 1],
  ['G4', 1], ['A4', 1], ['B4', 1], ['C#5', 1],
  ['D5', 4],
];
const THEME_CHORDS = ['D', 'A', 'G', 'D', 'G', 'D', 'A7', 'D'];
// King Grumble's tune: sly, on a bassoon, in D minor.
const GRUMBLE = [
  ['D3', 0.5], [null, 0.25], ['D3', 0.25], ['F3', 0.5], ['A3', 0.5], ['G#3', 0.5], ['A3', 0.5], [null, 1],
  ['Bb3', 0.5], ['A3', 0.5], ['G3', 0.5], ['F3', 0.5], ['E3', 0.5], ['C#3', 0.5], ['D3', 1],
];
const BPM = 96;
const BAR = (60 / BPM) * 4;

function intro(b) {
  // 0–14.5: the isle at peace, a music box and strings, the theme on a flute.
  b.chords(0, BPM, ['D', 'Bm', 'G', 'A', 'D', 'G'], 0.022, { attack: 1.2, release: 1.4 });
  b.arps(0, BPM, ['D', 'Bm', 'G', 'A', 'D', 'G'], 0.045);
  b.tune(2.5, BPM, THEME.slice(0, 14), 'flute', 0.07);
  b.sea(0, 15, 0.03);
  // 14.5–28.5: the storm and the theft, low and dark, thunder at each bolt.
  b.strings(14.5, 8, ['D2', 'A2', 'D3', 'F3'], 0.04, { attack: 1, release: 1, tremolo: true });
  b.strings(22.5, 6.5, ['Bb1', 'F2', 'Bb2', 'D3'], 0.04, { attack: 0.3, release: 1, tremolo: true });
  b.rain(14.5, 14, 0.05);
  for (const at of [14.9, 18, 20.9]) b.thunder(at, 0.45);
  b.timpaniRoll(16.5, 1.6, 'D2', 0.18);
  b.whoosh(19.9, 0.12, 0.6);
  b.sparkle(17.9, 6, 0.05);
  // The Star broken: a crash, glass, and the shards whooshing away.
  b.crash(24.7, 0.16, 4);
  b.drum(24.7, { f: 90, to: 40, decay: 1.2, gain: 0.6 });
  b.sparkle(24.7, 16, 0.06);
  for (let k = 0; k < 6; k++) b.whoosh(24.9 + k * 0.18, 0.06, 0.8, (k % 2) - 0.5);
  b.tune(25.5, BPM, GRUMBLE.slice(0, 8), 'bassoon', 0.06);
  // 29–56.5: the captains, a bar each, driving: drums, a low ostinato, a horn hit at each cut.
  const m0 = 29;
  b.beat(m0, BPM, 11, 0.3);
  const capChords = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'C', 'A', 'Dm', 'Bb', 'A'];
  b.chords(m0, BPM, capChords, 0.03, { attack: 0.08, release: 0.3 });
  capChords.forEach((c, i) => {
    const t = m0 + i * BAR;
    b.horn(t, 0.35, CHORDS[c][2], 0.08);
    b.horn(t, 0.35, CHORDS[c][3], 0.06);
    for (let k = 0; k < 8; k++) b.pluck(t + k * (BAR / 8), hz(CHORDS[c][k % 2 ? 1 : 0]), { gain: 0.08, decay: 0.3, type: 'sawtooth', verb: 0.15 });
  });
  // 56.5–62.5: King Grumble on Gloom Rock: his tune.
  b.tune(56.6, BPM, GRUMBLE, 'bassoon', 0.09);
  b.chords(56.5, BPM, ['Dm', 'A'], 0.025, { attack: 0.1, release: 0.5 });
  for (let k = 0; k < 8; k++) b.pluck(56.5 + k * 0.625, hz(k % 2 ? 'A2' : 'D2'), { gain: 0.1, decay: 0.4, type: 'triangle', verb: 0.2 });
  // 62.5–69.5: the boat in the storm: rain, the sea, thunder, a choir.
  b.rain(62.5, 7.3, 0.06);
  b.sea(62.5, 7.3, 0.07);
  b.thunder(63.7, 0.5);
  b.thunder(67.1, 0.45);
  b.choir(62.5, 7, ['D3', 'A3', 'D4'], 0.03);
  b.strings(62.5, 7, ['D2', 'A2', 'F3'], 0.03, { attack: 1.5, release: 1.5 });
  // 69.5–79.5: morning, the heroes, the title: the theme in full.
  b.swell(69.5, 2.5, 0.08);
  b.chords(72, BPM, THEME_CHORDS.slice(0, 3), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(72, BPM, THEME.slice(0, 14), 'horn', 0.1);
  b.crash(73.3, 0.12, 3);
  b.timpaniRoll(71.2, 0.8, 'D2', 0.2);
  b.strings(79.5 - 2.3, 2.3, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
  b.sparkle(73.3, 10, 0.04);
}

function ending(b) {
  // 0–6.5: the last bop, a pop, a fanfare.
  b.timpaniRoll(0, 1.5, 'A2', 0.2);
  b.pop(1.5, 0.35);
  b.crash(1.5, 0.14, 3);
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.horn(1.55 + i * 0.12, 1.8 - i * 0.12, n, 0.08);
  b.sparkle(1.6, 14, 0.05);
  b.cheer(1.8, 3.5, 0.03);
  b.choir(2.5, 4, ['D4', 'A4', 'D5'], 0.025);
  // 6.5–13.5: the shards flying home: harp rising, strings, sparkles.
  b.chords(6.5, BPM, ['G', 'A', 'Bm'], 0.03, { attack: 0.6, release: 0.8 });
  for (let k = 0; k < 28; k++) b.pluck(6.5 + k * 0.25, hz(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5'][k % 7]), { gain: 0.07, decay: 1.4, type: 'triangle', verb: 0.45 });
  for (let k = 0; k < 6; k++) b.whoosh(7 + k * 1.1, 0.05, 1.2, (k % 2) - 0.5);
  // 13.5–22: round the lighthouse, and the Star whole: a big swell and chord.
  b.choir(13.5, 8.5, ['A3', 'D4', 'F#4', 'A4'], 0.03);
  b.swell(13.5, 3.1, 0.1);
  b.crash(16.6, 0.16, 4);
  b.drum(16.6, { f: 80, to: 40, decay: 1.5, gain: 0.55 });
  b.sparkle(16.6, 20, 0.06);
  b.strings(16.6, 5.4, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.045, { attack: 0.05, release: 2 });
  b.horn(16.6, 4, 'D5', 0.08);
  b.horn(16.6, 4, 'A4', 0.06);
  // 22–37.6: all over the isle: the theme, bright, with drums.
  b.beat(22, BPM, 6, 0.26);
  b.chords(22, BPM, THEME_CHORDS.slice(0, 6), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(22, BPM, THEME.slice(0, 22), 'horn', 0.085);
  b.arps(22, BPM, THEME_CHORDS.slice(0, 6), 0.035);
  // 37.6–46.6: the party on the beach: fireworks, cheering, the theme's end.
  b.chords(37.6, BPM, ['G', 'A7', 'D', 'D'], 0.035, { attack: 0.05, release: 0.5 });
  b.tune(37.6, BPM, THEME.slice(14), 'flute', 0.08);
  b.beat(37.6, BPM, 3, 0.22);
  for (let k = 0; k < 8; k++) b.firework(37.9 + k * 1.05, 0.1);
  b.cheer(37.8, 6, 0.035);
  // 46.6–61.6: the credits, gently: a music box and strings.
  b.chords(46.6, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.arps(46.6, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(47.8, 80, THEME.slice(0, 14), 'flute', 0.06);
  b.sea(46.6, 15, 0.025);
  // 61.6–70: but out at sea… King Grumble's tune, and a question.
  b.sea(61.6, 8.4, 0.05);
  b.tune(63.5, BPM, GRUMBLE, 'bassoon', 0.08);
  b.pluck(67.6, hz('D2'), { gain: 0.14, decay: 0.6 });
  b.strings(66.5, 3.5, ['D3', 'A3', 'G#4'], 0.03, { attack: 0.3, release: 1.6 });
  b.horn(67.8, 1.8, 'A4', 0.07);
}

export async function score(name, secs) {
  const b = new Band(secs);
  (name === 'intro' ? intro : ending)(b);
  return b.render();
}
