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
  Am: ['A2', 'E3', 'A3', 'C4'],
  E: ['E2', 'B2', 'E3', 'G#3'],
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
    // (Quieter while anyone speaks: voices().)
    this.duck = ac.createGain();
    this.out.connect(master).connect(this.duck).connect(ac.destination);
    // The voices, over it all, a little evened out.
    this.voice = ac.createDynamicsCompressor();
    this.voice.threshold.value = -20;
    this.voice.ratio.value = 2.5;
    this.voice.attack.value = 0.004;
    this.voice.release.value = 0.2;
    const lift = ac.createGain();
    lift.gain.value = 1.5;
    this.voice.connect(lift).connect(ac.destination);
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

  // Chords from t0 to t1, round and round the list, a bar each (the last one
  // as long as there is room for).
  bed(t0, t1, bpm, list, gain = 0.035, opts = {}) {
    const bar = (60 / bpm) * 4;
    for (let i = 0, t = t0; t < t1 - 0.4; i++, t += bar) {
      const c = list[i % list.length];
      const len = Math.min(bar * 1.02, t1 - t + 0.5);
      this.strings(t, len, CHORDS[c], gain, { ...opts, release: Math.min(opts.release ?? 0.8, len * 0.45) });
      this.bass(t, Math.min(bar * 0.48, len), CHORDS[c][0], 0.1);
      if (t + bar / 2 < t1 - 0.3) this.bass(t + bar / 2, Math.min(bar * 0.45, t1 - t - bar / 2), CHORDS[c][0], 0.08);
    }
  }

  // A music box's arpeggios from t0 to t1, round and round the chords.
  twinkle(t0, t1, bpm, list, gain = 0.05) {
    const e = 60 / bpm / 2;
    for (let k = 0, t = t0; t < t1 - 0.1; k++, t += e) {
      const n = CHORDS[list[Math.floor(k / 8) % list.length]];
      const seq = [n[1], n[2], n[3], n[2]].map((x) => x.replace(/\d/, (d) => String(Number(d) + 2)));
      this.pluck(t, hz(seq[k % 4]), { bell: true, gain, decay: 1.4 });
    }
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

  // Every line said in the film (cues.lines: { at, dur, key, pan, gain } each,
  // its sound at /voices/<key>.wav), the music and sound going quieter under
  // them: down as each starts, up again a little after it ends (lines close
  // together as one).
  async voices(lines) {
    const ac = this.ac;
    const said = lines.filter((l) => l.key).sort((a, b) => a.at - b.at);
    const sounds = await Promise.all(said.map((l) => fetch(`/voices/${l.key}.wav`).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b))));
    said.forEach((l, i) => {
      const src = ac.createBufferSource();
      src.buffer = sounds[i];
      const g = ac.createGain();
      g.gain.value = l.gain ?? 1;
      const p = ac.createStereoPanner();
      p.pan.value = l.pan ?? 0;
      src.connect(g).connect(p).connect(this.voice);
      // (A touch of the hall, so they are in the same place as the music.)
      const w = ac.createGain();
      w.gain.value = 0.05;
      p.connect(w).connect(this.wet);
      src.start(l.at);
    });
    const spans = [];
    for (const l of said) {
      const last = spans.at(-1);
      if (last && l.at - last[1] < 1) last[1] = Math.max(last[1], l.at + l.dur);
      else spans.push([l.at, l.at + l.dur]);
    }
    const g = this.duck.gain;
    g.setValueAtTime(1, 0);
    for (const [a, b] of spans) {
      g.setValueAtTime(1, Math.max(0, a - 0.25));
      g.linearRampToValueAtTime(DUCK, Math.max(0.01, a));
      g.setValueAtTime(DUCK, b);
      g.linearRampToValueAtTime(1, b + 0.6);
    }
  }

  async render() {
    const buf = await this.ac.startRendering();
    return wav(buf);
  }
}

// How loud the music and sound are under the words.
const DUCK = 0.42;

// Where things are in a film (stage.js cuesOf), for its music to go by: c(name)
// → { at, end, dur, m } of the shot of that name (c(i): the i-th; m: the
// moments it marks, by name, in the film's time); c.total: how long the film
// is; c.lines: what is said, and when.
function cueBook(cues) {
  const c = (which) => {
    const s = typeof which === 'number' ? cues.shots.at(which) : cues.shots.find((x) => x.name === which);
    if (!s) throw new Error(`no shot ${which} in the film`);
    return { at: s.at, end: s.at + s.dur, dur: s.dur, m: s.marks ?? {} };
  };
  c.total = cues.length;
  c.lines = cues.lines;
  c.shots = cues.shots;
  // Every shot whose name starts so, in order (a montage: 'cap0', 'cap1', …).
  c.all = (prefix) => cues.shots.filter((x) => x.name?.startsWith(prefix)).map((x) => ({ at: x.at, end: x.at + x.dur, dur: x.dur, m: x.marks ?? {} }));
  return c;
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

function intro(b, c) {
  const night = c('night');
  const village = c('village');
  const storm = c('storm');
  const smash = c('break');
  const caps = c.all('cap');
  const throne = c('throne');
  const boat = c('boat');
  const morning = c('morning');
  // The isle at peace: a music box and strings, the theme on a flute.
  b.bed(0, village.end, BPM, ['D', 'Bm', 'G', 'A'], 0.022, { attack: 1.2, release: 1.4 });
  b.twinkle(0, village.end - 0.5, BPM, ['D', 'Bm', 'G', 'A'], 0.04);
  b.tune(night.at + 2.5, BPM, THEME.slice(0, 14), 'flute', 0.07);
  b.sea(0, village.end, 0.03);
  // The storm and the theft, low and dark, thunder at each bolt.
  b.strings(storm.at, storm.m.grab - storm.at, ['D2', 'A2', 'D3', 'F3'], 0.04, { attack: 1, release: 1, tremolo: true });
  b.strings(storm.m.grab, smash.end - storm.m.grab, ['Bb1', 'F2', 'Bb2', 'D3'], 0.04, { attack: 0.3, release: 1, tremolo: true });
  b.rain(storm.at, smash.end - storm.at, 0.05);
  for (const at of [storm.at + 0.5, storm.m.grab + 0.2, storm.m.leap + 0.9]) b.thunder(at, 0.45);
  b.timpaniRoll(storm.m.grab - 1.6, 1.6, 'D2', 0.18);
  b.sparkle(storm.m.grab, 6, 0.05);
  b.whoosh(storm.m.leap, 0.12, 0.6);
  b.tune(storm.m.grab + 0.4, BPM, GRUMBLE.slice(0, 8), 'bassoon', 0.05);
  // The Star broken: a crash, glass, and the shards whooshing away.
  b.crash(smash.m.smash, 0.16, 4);
  b.drum(smash.m.smash, { f: 90, to: 40, decay: 1.2, gain: 0.6 });
  b.sparkle(smash.m.smash, 16, 0.06);
  for (let k = 0; k < 6; k++) b.whoosh(smash.m.smash + 0.2 + k * 0.18, 0.06, 0.8, (k % 2) - 0.5);
  // The captains, a bar each, driving: drums, a low ostinato, a horn hit at each cut.
  const m0 = caps[0].at;
  b.beat(m0, BPM, caps.length, 0.3);
  const capChords = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'C', 'A', 'Dm', 'Bb', 'A'];
  b.chords(m0, BPM, capChords, 0.03, { attack: 0.08, release: 0.3 });
  capChords.forEach((ch, i) => {
    const t = m0 + i * BAR;
    b.horn(t, 0.35, CHORDS[ch][2], 0.08);
    b.horn(t, 0.35, CHORDS[ch][3], 0.06);
    for (let k = 0; k < 8; k++) b.pluck(t + k * (BAR / 8), hz(CHORDS[ch][k % 2 ? 1 : 0]), { gain: 0.08, decay: 0.3, type: 'sawtooth', verb: 0.15 });
  });
  // King Grumble on Gloom Rock: his tune, round again while he gloats.
  b.tune(throne.at + 0.1, BPM, GRUMBLE, 'bassoon', 0.09);
  b.bed(throne.at, throne.end, BPM, ['Dm', 'A'], 0.025, { attack: 0.1, release: 0.5 });
  for (let t = throne.at; t < throne.end - 0.3; t += 0.625) b.pluck(t, hz(Math.round((t - throne.at) / 0.625) % 2 ? 'A2' : 'D2'), { gain: 0.1, decay: 0.4, type: 'triangle', verb: 0.2 });
  // The boat in the storm: rain, the sea, thunder, a choir.
  b.rain(boat.at, boat.dur + 0.3, 0.06);
  b.sea(boat.at, boat.dur + 0.3, 0.07);
  b.thunder(boat.at + 1.2, 0.5);
  b.thunder(boat.at + 4.6, 0.45);
  b.choir(boat.at, boat.dur, ['D3', 'A3', 'D4'], 0.03);
  b.strings(boat.at, boat.dur, ['D2', 'A2', 'F3'], 0.03, { attack: 1.5, release: 1.5 });
  // Morning, the heroes: the sea and a harp; then the title: the theme in full.
  b.swell(morning.at, 2.5, 0.08);
  b.sea(morning.at, morning.dur, 0.03);
  b.bed(morning.at, morning.m.title, BPM, ['D', 'G', 'A', 'D'], 0.02, { attack: 0.8, release: 1 });
  b.twinkle(morning.at + 0.5, morning.m.title - 0.6, BPM, ['D', 'G', 'A', 'D'], 0.035);
  const title = morning.m.title;
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.crash(title, 0.12, 3);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.strings(morning.end - 2.3, 2.3, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
  b.sparkle(title, 10, 0.04);
}

function ending(b, c) {
  const last = c('pop');
  const home = c('home');
  const whole = c('whole');
  const cheers = c.all('cheer');
  const beach = c('beach');
  const credits = c('credits');
  const teaser = c('teaser');
  const pop = last.m.pop;
  // The last bop: a drum roll as he swells, a pop, a fanfare.
  b.timpaniRoll(last.at + 0.2, pop - last.at - 0.2, 'A2', 0.2);
  b.pop(pop, 0.35);
  b.crash(pop, 0.14, 3);
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.horn(pop + 0.05 + i * 0.12, 1.8 - i * 0.12, n, 0.08);
  b.sparkle(pop + 0.1, 14, 0.05);
  b.cheer(pop + 0.3, 3.5, 0.03);
  b.choir(pop + 1, last.end - pop - 0.6, ['D4', 'A4', 'D5'], 0.025);
  // The shards flying home: harp rising, strings, sparkles.
  b.bed(home.at, home.end, BPM, ['G', 'A', 'Bm'], 0.03, { attack: 0.6, release: 0.8 });
  for (let t = home.at, k = 0; t < home.end - 0.2; t += 0.25, k++) b.pluck(t, hz(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5'][k % 7]), { gain: 0.07, decay: 1.4, type: 'triangle', verb: 0.45 });
  for (let k = 0; k < 6; k++) b.whoosh(home.at + 0.5 + k * 1.1, 0.05, 1.2, (k % 2) - 0.5);
  // Round the lighthouse, and the Star whole: a big swell and chord.
  const won = whole.at + 3.1;
  b.choir(whole.at, whole.dur, ['A3', 'D4', 'F#4', 'A4'], 0.03);
  b.swell(whole.at, 3.1, 0.1);
  b.crash(won, 0.16, 4);
  b.drum(won, { f: 80, to: 40, decay: 1.5, gain: 0.55 });
  b.sparkle(won, 20, 0.06);
  b.strings(won, whole.end - won, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.045, { attack: 0.05, release: 2 });
  b.horn(won, 4, 'D5', 0.08);
  b.horn(won, 4, 'A4', 0.06);
  // All over the isle: the theme, bright, with drums.
  const c0 = cheers[0].at;
  const c1 = cheers.at(-1).end;
  b.beat(c0, BPM, Math.ceil((c1 - c0) / BAR), 0.26);
  b.bed(c0, c1, BPM, THEME_CHORDS.slice(0, 6), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(c0, BPM, THEME.slice(0, 22), 'horn', 0.085);
  b.twinkle(c0, c1, BPM, THEME_CHORDS.slice(0, 6), 0.035);
  // The party on the beach: fireworks, cheering, the theme's end.
  b.bed(beach.at, beach.end, BPM, ['G', 'A7', 'D', 'D'], 0.035, { attack: 0.05, release: 0.5 });
  b.tune(beach.at, BPM, THEME.slice(14), 'flute', 0.08);
  b.beat(beach.at, BPM, Math.floor(beach.dur / BAR), 0.22);
  for (let t = beach.at + 0.3; t < beach.end - 0.5; t += 1.05) b.firework(t, 0.1);
  b.cheer(beach.at + 0.2, 6, 0.035);
  // The credits, gently: a music box and strings.
  b.bed(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(credits.at + 1.2, 80, THEME.slice(0, 14), 'flute', 0.06);
  b.sea(credits.at, credits.dur, 0.025);
  // But out at sea… King Grumble's tune, and a question.
  b.sea(teaser.at, teaser.dur, 0.05);
  b.tune(teaser.at + 1.9, BPM, GRUMBLE, 'bassoon', 0.08);
  const q = teaser.m.title;
  b.pluck(q, hz('D2'), { gain: 0.14, decay: 0.6 });
  b.strings(q - 1, teaser.end - q + 1, ['D3', 'A3', 'G#4'], 0.03, { attack: 0.3, release: 1.6 });
  b.horn(q + 0.2, 1.8, 'A4', 0.07);
}

// Queen Grizzle's tune: her little brother's, prim and an octave up, with a
// sniff at the end of it.
const GRIZZLE = [
  ['D4', 0.5], [null, 0.25], ['D4', 0.25], ['F4', 0.5], ['A4', 0.5], ['G#4', 0.5], ['A4', 0.5], [null, 1],
  ['Bb4', 0.5], ['A4', 0.5], ['G4', 0.5], ['F4', 0.5], ['E4', 0.5], ['C#4', 0.5], ['D4', 0.5], ['A4', 0.25], ['D5', 0.25],
];

function intro2(b, c) {
  const morning = c('morning');
  const down = c('grizzle');
  const catchIt = c('catch');
  const help = c.all('help');
  const drab = c('drab');
  const fields = c('fields');
  // A rainbow over the happy isle: a music box, strings, the theme on a flute.
  b.bed(0, morning.end, BPM, ['D', 'G', 'A'], 0.022, { attack: 1.2, release: 1.2 });
  b.twinkle(0, morning.end - 0.4, BPM, ['D', 'G', 'A'], 0.045);
  b.tune(1.2, BPM, THEME.slice(0, 8), 'flute', 0.07);
  b.sea(0, morning.end + 0.5, 0.03);
  b.sparkle(0.6, 8, 0.04);
  // Queen Grizzle comes down: the sky goes grey, her tune.
  b.strings(down.at, down.dur, ['D2', 'A2', 'D3', 'F3'], 0.035, { attack: 1, release: 1, tremolo: true });
  b.tune(down.at + 0.7, BPM, GRIZZLE, 'bassoon', 0.08);
  b.whoosh(down.at + 2.7, 0.08, 1.1);
  b.drum(down.at + 3.4, { f: 100, to: 50, decay: 0.5, gain: 0.35 });
  // The rainbow caught: a long whoosh down, a crash, the jars flying off.
  const shake = catchIt.at + 4.5;
  b.strings(catchIt.at, 4.6, ['Bb1', 'F2', 'Bb2', 'D3'], 0.04, { attack: 0.4, release: 0.6, tremolo: true });
  for (let k = 0; k < 6; k++) b.whoosh(catchIt.at + 1.2 + k * 0.5, 0.07, 1, (k % 2) - 0.5);
  b.timpaniRoll(shake - 1.6, 1.6, 'D2', 0.2);
  b.crash(shake, 0.16, 3.5);
  b.drum(shake, { f: 90, to: 40, decay: 1.2, gain: 0.55 });
  b.sparkle(shake, 16, 0.06);
  for (let k = 0; k < 7; k++) b.whoosh(shake + 0.2 + k * 0.16, 0.06, 0.8, (k % 2) - 0.5);
  b.bed(shake + 0.5, catchIt.end, BPM, ['Dm', 'Gm', 'A'], 0.022, { attack: 0.6, release: 0.8 });
  b.tune(shake + 0.8, BPM, GRIZZLE.slice(8), 'bassoon', 0.06);
  // Her helpers, a bar each: drums, a low ostinato, a horn hit at each cut.
  const m0 = help[0].at;
  b.beat(m0, BPM, help.length, 0.3);
  const helpers = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'A'];
  b.chords(m0, BPM, helpers, 0.03, { attack: 0.08, release: 0.3 });
  helpers.forEach((ch, i) => {
    const t = m0 + i * BAR;
    b.horn(t, 0.35, CHORDS[ch][2], 0.08);
    b.horn(t, 0.35, CHORDS[ch][3], 0.06);
    for (let k = 0; k < 8; k++) b.pluck(t + k * (BAR / 8), hz(CHORDS[ch][k % 2 ? 1 : 0]), { gain: 0.08, decay: 0.3, type: 'sawtooth', verb: 0.15 });
  });
  // Queen Grizzle in Castle Drab: her tune, low.
  b.tune(drab.at + 0.1, BPM, GRIZZLE.slice(0, 8), 'bassoon', 0.09);
  b.bed(drab.at, drab.end, BPM, ['Dm', 'A'], 0.025, { attack: 0.1, release: 0.5 });
  for (let t = drab.at; t < drab.end - 0.3; t += 0.625) b.pluck(t, hz(Math.round((t - drab.at) / 0.625) % 2 ? 'A2' : 'D2'), { gain: 0.1, decay: 0.4, type: 'triangle', verb: 0.2 });
  // You and the title: the theme in full.
  const title = fields.m.title;
  b.swell(fields.at, 2.5, 0.08);
  b.bed(fields.at + 1, title, BPM, ['Bm', 'G', 'A'], 0.022, { attack: 0.8, release: 0.8 });
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.crash(title, 0.12, 3);
  b.sparkle(title, 10, 0.04);
  b.strings(fields.end - 2.3, 2.3, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
}

function ending2(b, c) {
  const last = c('pop');
  const bow = c('bow');
  const party = c('party');
  const credits = c('credits');
  const teaser = c('teaser');
  const pop = last.m.pop;
  // The last bop, a pop, a fanfare.
  b.timpaniRoll(last.at + 0.2, pop - last.at - 0.2, 'A2', 0.2);
  b.pop(pop, 0.35);
  b.crash(pop, 0.14, 3);
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.horn(pop + 0.05 + i * 0.12, 1.8 - i * 0.12, n, 0.08);
  b.sparkle(pop + 0.1, 14, 0.05);
  b.cheer(pop + 0.3, 3.6, 0.03);
  b.choir(pop + 1, last.end - pop - 0.6, ['D4', 'A4', 'D5'], 0.025);
  // The colours flying up: a harp rising, a swell, and the rainbow whole.
  const whole = bow.at + 3.6;
  b.chords(bow.at, BPM, ['G', 'A'], 0.03, { attack: 0.6, release: 0.8 });
  for (let k = 0; k < 14; k++) b.pluck(bow.at + 0.2 + k * 0.25, hz(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5'][k % 7]), { gain: 0.07, decay: 1.4, type: 'triangle', verb: 0.45 });
  for (let k = 0; k < 7; k++) b.whoosh(bow.at + 0.3 + k * 0.25, 0.05, 1.2, (k % 2) - 0.5);
  b.swell(whole - 2, 2, 0.1);
  b.crash(whole, 0.16, 4);
  b.drum(whole, { f: 80, to: 40, decay: 1.5, gain: 0.5 });
  b.sparkle(whole, 20, 0.06);
  b.strings(whole, bow.end - whole, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.045, { attack: 0.05, release: 1.6 });
  b.horn(whole, 3.4, 'D5', 0.08);
  b.horn(whole, 3.4, 'A4', 0.06);
  // The party on the beach: the theme, bright, with drums and fireworks.
  b.beat(party.at, BPM, Math.floor(party.dur / BAR), 0.26);
  b.bed(party.at, party.end, BPM, THEME_CHORDS.slice(0, 4), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(party.at, BPM, THEME.slice(0, 14), 'horn', 0.085);
  b.twinkle(party.at, party.end, BPM, THEME_CHORDS.slice(0, 4), 0.035);
  for (let t = party.at + 0.4; t < party.end - 0.5; t += 1.1) b.firework(t, 0.1);
  b.cheer(party.at + 0.2, 6.5, 0.035);
  // The credits, gently: a music box and strings.
  b.bed(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(credits.at + 1.2, 80, THEME.slice(0, 14), 'flute', 0.06);
  b.sea(credits.at, credits.dur, 0.025);
  // Queen Grizzle floating home: her tune, and — for once — a happy end to it.
  const title = teaser.m.title;
  b.sea(teaser.at, teaser.dur, 0.05);
  b.tune(teaser.at + 0.6, BPM, GRIZZLE.slice(0, 8), 'bassoon', 0.075);
  b.strings(title - 1, teaser.end - title + 1, ['D3', 'A3', 'F#4'], 0.035, { attack: 0.4, release: 1.6 });
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.pluck(title + i * 0.16, hz(n), { gain: 0.09, decay: 1.6, type: 'triangle', bell: true, verb: 0.45 });
  b.sparkle(title + 0.6, 8, 0.04);
}

// Old Murk's tune: slow and low, a howl rising at the end of it.
const MURK = [
  ['A3', 1], ['C4', 0.5], ['B3', 0.5], ['A3', 1], ['E3', 1],
  ['F3', 0.5], ['E3', 0.5], ['D3', 0.5], ['E3', 0.5], ['A3', 1.5], [null, 0.5],
];

function intro3(b, c) {
  const bow = c('rainbow');
  const wild = c('wild');
  const howl = c('howl');
  const beasts = c.all('beast');
  const tower = c('tower');
  const beach = c('beach');
  // The rainbow over the happy isle, its end out to sea.
  b.bed(0, bow.end, BPM, ['D', 'G', 'A'], 0.022, { attack: 1.2, release: 1.2 });
  b.twinkle(0, bow.end - 0.3, BPM, ['D', 'G', 'A'], 0.04);
  b.tune(1, BPM, THEME.slice(0, 8), 'flute', 0.06);
  b.sea(0, bow.end + 0.5, 0.03);
  // Out of the fog, the Wild Isle: the sea, wide strings, a swell.
  b.sea(wild.at, wild.dur, 0.06);
  b.bed(wild.at, wild.end, 72, ['D', 'Em', 'G', 'D'], 0.04, { attack: 1.4, release: 1.4 });
  b.swell(wild.end - 3, 3, 0.07);
  b.horn(wild.end - 2.1, 2, 'A4', 0.06);
  // Old Murk, the fog coming in, his howl, the Sunstones scattering.
  const at = howl.m.howl;
  b.strings(howl.at, howl.dur, ['A1', 'E2', 'A2', 'C3'], 0.04, { attack: 0.8, release: 1, tremolo: true });
  b.tune(at, BPM, MURK, 'bassoon', 0.08);
  b.whoosh(at + 1, 0.09, 1.4);
  b.timpaniRoll(at + 0.4, 0.8, 'A1', 0.2);
  b.crash(at + 1.2, 0.12, 3);
  for (let k = 0; k < 5; k++) b.whoosh(at + 1.3 + k * 0.2, 0.06, 0.8, (k % 2) - 0.5);
  // His helpers, a bar each.
  const m0 = beasts[0].at;
  b.beat(m0, 92.3, beasts.length, 0.28);
  const helpers = ['Am', 'F', 'Dm', 'E'];
  helpers.forEach((ch, i) => {
    const t = m0 + i * 2.6;
    b.strings(t, 2.65, CHORDS[ch], 0.03, { attack: 0.08, release: 0.3 });
    b.bass(t, 1.25, CHORDS[ch][0], 0.1);
    b.horn(t, 0.35, CHORDS[ch][2], 0.08);
    for (let k = 0; k < 8; k++) b.pluck(t + k * 0.325, hz(CHORDS[ch][k % 2 ? 1 : 0]), { gain: 0.08, decay: 0.3, type: 'sawtooth', verb: 0.15 });
  });
  // Old Murk in Murk Tower: his tune, low.
  b.tune(tower.at + 0.2, BPM, MURK.slice(0, 5), 'bassoon', 0.09);
  b.bed(tower.at, tower.end, BPM, ['Am', 'E'], 0.03, { attack: 0.4, release: 1 });
  // You and the title: the theme in full.
  const title = beach.m.title;
  b.swell(beach.at, 2.5, 0.08);
  b.sea(beach.at, beach.dur, 0.03);
  b.bed(beach.at + 1, title, BPM, ['Bm', 'G', 'A'], 0.022, { attack: 0.8, release: 0.8 });
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.crash(title, 0.12, 3);
  b.sparkle(title, 10, 0.04);
  b.strings(beach.end - 2.3, 2.3, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
}

function ending3(b, c) {
  const last = c('pop');
  const sun = c('sun');
  const party = c('party');
  const credits = c('credits');
  const teaser = c('teaser');
  const pop = last.m.pop;
  // The last bop, a pop, a fanfare.
  b.timpaniRoll(last.at + 0.2, pop - last.at - 0.2, 'A2', 0.2);
  b.pop(pop, 0.35);
  b.crash(pop, 0.14, 3);
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.horn(pop + 0.05 + i * 0.12, 1.8 - i * 0.12, n, 0.08);
  b.sparkle(pop + 0.1, 14, 0.05);
  b.cheer(pop + 0.3, 3.6, 0.03);
  // The Sunstones flying up, the sun coming out.
  const out = sun.at + 4;
  b.chords(sun.at, BPM, ['G', 'A'], 0.03, { attack: 0.6, release: 0.8 });
  for (let k = 0; k < 10; k++) b.pluck(sun.at + 0.2 + k * 0.3, hz(['D4', 'E4', 'F#4', 'A4', 'B4'][k % 5]), { gain: 0.07, decay: 1.4, type: 'triangle', verb: 0.45 });
  b.swell(out - 2, 2, 0.1);
  b.crash(out, 0.16, 4);
  b.drum(out, { f: 80, to: 40, decay: 1.5, gain: 0.5 });
  b.sparkle(out, 20, 0.06);
  b.strings(out, sun.end - out, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.045, { attack: 0.05, release: 1.6 });
  b.choir(out + 0.2, sun.end - out - 0.2, ['D4', 'A4', 'D5'], 0.025);
  // The party on the beach.
  b.beat(party.at, BPM, Math.floor(party.dur / BAR), 0.26);
  b.bed(party.at, party.end, BPM, THEME_CHORDS.slice(0, 4), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(party.at, BPM, THEME.slice(0, 14), 'horn', 0.085);
  for (let t = party.at + 0.4; t < party.end - 0.5; t += 1.1) b.firework(t, 0.1);
  b.cheer(party.at + 0.2, 6.5, 0.035);
  // The credits, gently.
  b.bed(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(credits.at + 1.2, 80, THEME.slice(0, 14), 'flute', 0.06);
  b.sea(credits.at, credits.dur, 0.025);
  // Old Murk asleep in the sun: his tune, warm at last; and a magpie.
  const title = teaser.m.title;
  b.tune(teaser.at + 0.4, BPM, MURK.slice(0, 5), 'flute', 0.06);
  b.bed(teaser.at + 2, title, 72, ['D', 'G'], 0.03, { attack: 0.6, release: 1 });
  b.whoosh(teaser.m.shiny - 0.4, 0.05, 0.8, 0.4);
  b.sparkle(teaser.m.shiny, 6, 0.04);
  b.strings(title - 0.4, teaser.end - title + 0.4, ['D3', 'A3', 'F#4'], 0.035, { attack: 0.4, release: 1.6 });
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.pluck(title + i * 0.16, hz(n), { gain: 0.09, decay: 1.6, type: 'triangle', bell: true, verb: 0.45 });
}

// Jinx the Magpie's tune: cheeky and quick, hopping about, a cackle at the end.
const JINX = [
  ['G4', 0.25], ['E4', 0.25], ['G4', 0.25], ['C5', 0.5], [null, 0.25], ['B4', 0.25], ['G4', 0.25],
  ['A4', 0.25], ['F4', 0.25], ['A4', 0.25], ['D5', 0.5], [null, 0.25], ['C5', 0.25], ['B4', 0.25], ['G4', 0.75],
];
// The Golden Bells' peal: down a scale and back, as a ring of bells rings.
const PEAL = ['D5', 'B4', 'A4', 'F#4', 'E4', 'D4'];
const peal = (b, t, gap = 0.32, gain = 0.09, times = 1) => {
  for (let r = 0; r < times; r++) PEAL.forEach((n, i) => b.pluck(t + (r * PEAL.length + i) * gap, hz(n), { gain, decay: 2.2, type: 'triangle', bell: true, verb: 0.5, pan: (i % 2) - 0.5 }));
};

function intro4(b, c) {
  const dawn = c('dawn');
  const swoop = c('swoop');
  const cages = c.all('cage');
  const nest = c('nest');
  const bay = c('bay');
  // Dawn, the five Golden Bells ringing round the lighthouse.
  b.bed(0, dawn.end, BPM, ['D', 'G', 'A'], 0.022, { attack: 1.2, release: 1.2 });
  peal(b, 0.6, 0.36, 0.08, 2);
  b.sea(0, dawn.end + 0.5, 0.03);
  b.tune(3.6, BPM, THEME.slice(0, 6), 'flute', 0.05);
  // Night, Jinx swooping down and off with the bells.
  const off = swoop.m.off;
  b.strings(swoop.at, swoop.dur, ['A2', 'E3', 'A3', 'C4'], 0.035, { attack: 0.6, release: 1, tremolo: true });
  b.tune(swoop.at + 0.4, 132, JINX, 'flute', 0.07);
  for (let t = swoop.at + 0.2; t < off; t += 0.45) b.pluck(t, hz(Math.round((t - swoop.at) / 0.45) % 2 ? 'E3' : 'A2'), { gain: 0.06, decay: 0.3, type: 'sawtooth', verb: 0.15 });
  b.whoosh(swoop.at + 1.6, 0.08, 1.2);
  b.crash(off - 0.2, 0.1, 2.5);
  b.sparkle(off - 0.2, 6, 0.05);
  for (let k = 0; k < 5; k++) b.pluck(off - 0.1 + k * 0.12, hz(PEAL[k]), { gain: 0.07, decay: 1.2, type: 'triangle', bell: true, verb: 0.5 });
  b.whoosh(off + 0.6, 0.09, 1.6);
  b.tune(off + 1.2, 150, JINX, 'flute', 0.05);
  // His Puzzle Isles, a bar each, cheeky.
  const m0 = cages[0].at;
  const bar = 240 / 2.9;
  b.beat(m0, bar, cages.length, 0.22);
  const isles = ['C', 'Am', 'F', 'G'];
  b.chords(m0, bar, isles, 0.028, { attack: 0.05, release: 0.3 });
  isles.forEach((ch, i) => {
    const t = m0 + i * 2.9;
    b.pluck(t, hz(CHORDS[ch][3]), { gain: 0.1, decay: 1.6, type: 'triangle', bell: true, verb: 0.4 });
    for (let k = 0; k < 6; k++) b.pluck(t + 0.3 + k * 0.4, hz(CHORDS[ch][k % 2 ? 2 : 3]), { gain: 0.06, decay: 0.25, type: 'square', verb: 0.1 });
  });
  // Jinx on his nest, chattering: his tune, quicker.
  b.tune(nest.at + 0.2, 150, JINX, 'flute', 0.08);
  b.bed(nest.at, nest.end, BPM, ['C', 'G'], 0.025, { attack: 0.3, release: 1 });
  b.pluck(nest.end - 1.6, hz('C5'), { gain: 0.1, decay: 2, type: 'triangle', bell: true, verb: 0.5 });
  // You and the title: the theme in full, the bells pealing.
  const title = bay.m.title;
  b.swell(bay.at, 2.5, 0.07);
  b.bed(bay.at + 1, title, BPM, ['G', 'D', 'A'], 0.022, { attack: 0.8, release: 0.8 });
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.crash(title, 0.12, 3);
  peal(b, title + 0.1, 0.3, 0.06, 1);
  b.sparkle(title, 8, 0.04);
  b.strings(bay.end - 2.3, 2.3, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
}

function ending4(b, c) {
  const caught = c('caught');
  const home = c('home');
  const party = c('party');
  const credits = c('credits');
  const teaser = c('teaser');
  const at = caught.m.caught;
  // Jinx dazzled, and caught: a pop, a fanfare.
  b.tune(caught.at + 0.2, 150, JINX.slice(0, 7), 'flute', 0.06);
  b.timpaniRoll(at - 1.2, 1.2, 'A2', 0.2);
  b.pop(at, 0.35);
  b.crash(at, 0.14, 3);
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.horn(at + 0.05 + i * 0.12, 1.8 - i * 0.12, n, 0.08);
  b.sparkle(at + 0.1, 14, 0.05);
  b.cheer(at + 0.3, 3.6, 0.03);
  // The bells flying home, pealing as they go.
  b.bed(home.at, home.end, BPM, ['G', 'A', 'Bm'], 0.03, { attack: 0.6, release: 0.8 });
  peal(b, home.at + 0.3, 0.34, 0.06, 3);
  b.swell(home.end - 3.5, 2, 0.08);
  b.strings(home.end - 3, 3, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.04, { attack: 0.1, release: 1.6 });
  b.choir(home.end - 2.9, 2.9, ['D4', 'A4', 'D5'], 0.02);
  // The party round the open cage, the bells ringing over it.
  b.beat(party.at, BPM, Math.floor(party.dur / BAR), 0.26);
  b.bed(party.at, party.end, BPM, THEME_CHORDS.slice(0, 4), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(party.at, BPM, THEME.slice(0, 14), 'horn', 0.085);
  peal(b, party.at + 0.1, 0.5, 0.04, 2);
  for (let t = party.at + 0.4; t < party.end - 0.5; t += 1.1) b.firework(t, 0.1);
  b.cheer(party.at + 0.2, 6.5, 0.035);
  // The credits, gently.
  b.bed(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(credits.at + 1.2, 80, THEME.slice(0, 14), 'flute', 0.06);
  b.sea(credits.at, credits.dur, 0.025);
  // Dawn, the bells, and Jinx listening — his tune, and a wink at the end.
  const title = teaser.m.title;
  peal(b, teaser.at + 0.3, 0.4, 0.05);
  b.bed(teaser.at + 2, title, 72, ['D', 'G'], 0.022, { attack: 0.6, release: 1 });
  b.tune(title - 2.4, 132, JINX.slice(0, 7), 'flute', 0.05);
  b.strings(title - 0.3, teaser.end - title + 0.3, ['D3', 'A3', 'F#4'], 0.035, { attack: 0.4, release: 1.6 });
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.pluck(title + i * 0.16, hz(n), { gain: 0.09, decay: 1.6, type: 'triangle', bell: true, verb: 0.45 });
}

// The fifth episode's: the Baron's pompous little march, a tuba's, and the
// theme in full when the lanterns float up.
const BLUSTER = [
  ['D3', 0.5], ['F3', 0.5], ['A3', 1], ['G3', 0.5], ['F3', 0.5], ['E3', 1],
  ['D3', 0.5], ['E3', 0.5], ['F3', 0.5], ['A3', 0.5], ['D4', 2],
];

function intro5(b, c) {
  const sea = c('sea');
  const blow = c('blow');
  const bads = c.all('bad');
  const top = c('top');
  const walk = c('walk');
  // Out at sea, sailing up to the clouds.
  b.sea(0, sea.end + 0.5, 0.035);
  b.bed(0, sea.end, BPM, ['D', 'G', 'A'], 0.022, { attack: 1.2, release: 1.2 });
  b.tune(2.4, BPM, THEME.slice(0, 6), 'flute', 0.05);
  // Baron Bluster, laughing, blowing out the lanterns one by one.
  b.strings(blow.at, blow.dur, ['D2', 'A2', 'D3', 'F3'], 0.035, { attack: 0.5, release: 1, tremolo: true });
  b.tune(blow.at + 0.4, 112, BLUSTER, 'horn', 0.06);
  for (let k = 0; k < 5; k++) b.whoosh(blow.at + 1.4 + k * 1.3, 0.07, 0.6);
  b.tune(blow.at + 7.2, 112, BLUSTER, 'horn', 0.04);
  // The Big Bads of each corner, a bar each.
  const m0 = bads[0].at;
  const bar = 240 / 3;
  b.beat(m0, bar, bads.length, 0.22);
  const corners = ['Dm', 'Bb', 'C', 'A'];
  b.chords(m0, bar, corners, 0.03, { attack: 0.05, release: 0.3 });
  corners.forEach((ch, i) => b.timpaniRoll(m0 + i * 3, 0.5, 'D2', 0.12));
  // Thunder Top, lightning.
  b.strings(top.at, top.dur, ['D2', 'A2', 'F3'], 0.04, { attack: 0.2, release: 1, tremolo: true });
  for (const k of [1.2, 3, 4.6, 6.6]) if (k < top.dur) b.thunder(top.at + k, 0.25);
  b.tune(top.at + 1.4, 140, BLUSTER, 'horn', 0.05);
  // You on the beach, the clouds rolling back; the title.
  const title = walk.m.title;
  b.swell(walk.at, 2.4, 0.07);
  b.bed(walk.at + 1, title, BPM, ['G', 'D', 'A'], 0.022, { attack: 0.8, release: 0.8 });
  b.twinkle(walk.at + 1, title - 0.3, BPM, ['G', 'D', 'A'], 0.03);
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.crash(title, 0.12, 3);
  b.sparkle(title, 8, 0.04);
  b.strings(walk.end - 2.3, 2.3, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
}

function ending5(b, c) {
  const pop = c('pop');
  const lanterns = c('lanterns');
  const clear = c('clear');
  const party = c('party');
  const credits = c('credits');
  const teaser = c('teaser');
  const at = pop.m.pop;
  // The Baron popped, whizzing round and shrinking.
  b.timpaniRoll(pop.at + 0.2, at - pop.at - 0.2, 'A2', 0.2);
  b.pop(at, 0.35);
  b.crash(at, 0.14, 3);
  b.whoosh(at + 0.2, 0.08, pop.end - at - 0.5);
  b.tune(at + 0.6, 180, BLUSTER, 'flute', 0.05);
  b.tune(at + 3.4, 180, BLUSTER, 'flute', 0.04);
  b.cheer(at + 0.4, 5, 0.03);
  // The five lanterns floating up.
  b.bed(lanterns.at, lanterns.end, BPM, ['G', 'A', 'Bm'], 0.03, { attack: 0.6, release: 0.8 });
  b.choir(lanterns.at + 0.4, lanterns.dur - 0.6, ['D4', 'A4', 'D5'], 0.02);
  b.sparkle(lanterns.at + 0.4, 6, 0.04);
  // The Cloud Blanket blowing away.
  b.swell(clear.at, 2, 0.08);
  b.whoosh(clear.at + 0.6, 0.1, 3);
  b.strings(clear.at + 1, clear.dur - 1, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.04, { attack: 0.3, release: 1.6 });
  b.tune(clear.at + 2, BPM, THEME.slice(0, 10), 'horn', 0.08);
  // Everyone on the beach, fireworks.
  b.beat(party.at, BPM, Math.floor(party.dur / BAR), 0.26);
  b.bed(party.at, party.end, BPM, THEME_CHORDS.slice(0, 4), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(party.at, BPM, THEME.slice(0, 14), 'horn', 0.085);
  for (let t = party.at + 0.4; t < party.end - 0.5; t += 1.1) b.firework(t, 0.1);
  b.cheer(party.at + 0.2, 7, 0.035);
  // The credits, gently.
  b.bed(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(credits.at + 1.2, 80, THEME.slice(0, 14), 'flute', 0.06);
  b.sea(credits.at, credits.dur, 0.025);
  // The little cloud and the toadstools.
  const title = teaser.m.title;
  b.tune(teaser.at + 0.6, 132, BLUSTER.slice(0, 6), 'flute', 0.05);
  b.bed(teaser.at + 2, title, 72, ['D', 'G'], 0.022, { attack: 0.6, release: 1 });
  b.strings(title - 0.4, teaser.end - title + 0.4, ['D3', 'A3', 'F#4'], 0.035, { attack: 0.4, release: 1.6 });
  for (const [i, n] of ['D4', 'F#4', 'A4', 'D5'].entries()) b.pluck(title + i * 0.16, hz(n), { gain: 0.09, decay: 1.6, type: 'triangle', bell: true, verb: 0.45 });
}

// The sixth episode's: a cradle song, on a music box, and the Night Mare's
// gallop, low and quick, in threes.
const CRADLE = [
  ['G4', 1], ['C5', 0.5], ['B4', 0.5], ['A4', 1], ['E4', 1], ['G4', 0.5], ['A4', 0.5], ['G4', 2],
  ['F4', 1], ['A4', 0.5], ['G4', 0.5], ['E4', 1], ['C4', 1], ['D4', 0.5], ['E4', 0.5], ['D4', 2],
];
const GALLOP = ['E2', 'E2', 'B2', 'E2', 'E2', 'G2', 'E2', 'E2', 'F#2', 'E2', 'E2', 'D2'];
const gallop = (b, t, secs, gain = 0.09, step = 0.15) => {
  for (let k = 0; k * step * 4 < secs; k++) for (let i = 0; i < 3; i++) b.pluck(t + k * step * 4 + i * step, hz(GALLOP[(k * 3 + i) % GALLOP.length]), { gain: gain * (i === 2 ? 1.2 : 0.8), decay: 0.22, type: 'sawtooth', verb: 0.2 });
};
const musicBox = (b, t, bpm, notes, gain = 0.07) => {
  let at = t;
  for (const [n, beats] of notes) {
    if (n) b.pluck(at, hz(n) * 2, { gain, decay: 1.5, type: 'triangle', bell: true, verb: 0.5 });
    at += (beats * 60) / bpm;
  }
};

function intro6(b, c) {
  const pillow = c('pillow');
  const fall = c('fall');
  const mare = c('mare');
  const dreams = c.all('dream');
  const frights = c('frights');
  const start = c('start');
  // Dusk on the beach, the cradle song on a music box, and down they sink.
  b.sea(0, pillow.end, 0.028);
  musicBox(b, 0.6, 76, CRADLE.slice(0, 8), 0.07);
  b.bed(0.4, pillow.end, 76, ['C', 'F', 'G'], 0.02, { attack: 1.2, release: 1.2 });
  b.whoosh(pillow.at + 5.6, 0.05, 2.6);
  b.sparkle(pillow.at + 5.6, 10, 0.05);
  // Down through the sky of the dream.
  b.swell(fall.at, 2.2, 0.06);
  b.choir(fall.at + 0.6, fall.dur - 0.8, ['C4', 'G4', 'E5'], 0.022);
  b.bed(fall.at + 0.4, fall.end, 70, ['C', 'Am', 'F', 'G'], 0.03, { attack: 0.8, release: 1.2 });
  musicBox(b, fall.at + 1, 84, CRADLE, 0.06);
  b.sparkle(fall.at + 2, 12, 0.04);
  // The Night Mare galloping round her moon.
  gallop(b, mare.at, mare.dur, 0.09);
  b.strings(mare.at, mare.dur, ['E2', 'B2', 'E3', 'G3'], 0.04, { attack: 0.5, release: 0.8, tremolo: true });
  b.crash(mare.at, 0.1, 2);
  b.timpaniRoll(mare.at + 3.6, 0.8, 'E2', 0.16);
  b.tune(mare.at + 1, 100, [['E4', 1], ['G4', 1], ['F#4', 2], ['D4', 1], ['E4', 3]], 'horn', 0.06);
  // A dream after another, a bar each.
  const m0 = dreams[0].at;
  const bar = 240 / 3;
  b.beat(m0, bar, dreams.length, 0.22);
  const keys = ['C', 'F', 'Am', 'G'];
  b.chords(m0, bar, keys, 0.03, { attack: 0.05, release: 0.3 });
  keys.forEach((ch, i) => {
    b.pluck(m0 + i * 3, hz(CHORDS[ch][3]), { gain: 0.1, decay: 1.6, type: 'triangle', bell: true, verb: 0.4 });
    musicBox(b, m0 + 0.4 + i * 3, 150, CRADLE.slice(i * 4, i * 4 + 4), 0.06);
  });
  // Her frights, coming.
  gallop(b, frights.at, frights.dur - 0.4, 0.06, 0.2);
  b.strings(frights.at, frights.dur, ['E2', 'B2', 'G3'], 0.035, { attack: 0.4, release: 1, tremolo: true });
  for (let t = frights.at + 0.4; t < frights.end - 0.5; t += 0.9) b.pluck(t, hz(['E3', 'G3', 'F#3'][Math.round((t - frights.at) / 0.9) % 3]), { gain: 0.08, decay: 0.5, type: 'square', verb: 0.2 });
  b.timpaniRoll(frights.end - 1.4, 1.2, 'G2', 0.2);
  // You, and the title: the theme in full, the cradle song over it.
  const title = start.m.title;
  b.swell(start.at, 1.6, 0.07);
  b.bed(start.at + 1, title, 76, ['C', 'F', 'G'], 0.022, { attack: 0.8, release: 0.8 });
  musicBox(b, start.at + 1.2, 76, CRADLE.slice(8), 0.05);
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.crash(title, 0.12, 3);
  b.sparkle(title, 10, 0.05);
  b.strings(start.end - 2.4, 2.4, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
}

function ending6(b, c) {
  const calm = c('calm');
  const light = c('light');
  const dreams = c('dreams');
  const party = c('party');
  const credits = c('credits');
  const morning = c('morning');
  // The Night Mare in the light, trembling: her gallop, slowing down.
  b.strings(calm.at, calm.dur, ['E3', 'B3', 'G4'], 0.025, { attack: 0.8, release: 1.4, tremolo: true });
  for (let k = 0, t = calm.at + 0.4; k < 12 && t < calm.end; k++, t += 0.36 + k * 0.05) b.pluck(t, hz(['E2', 'B2', 'G2'][k % 3]), { gain: Math.max(0.02, 0.07 - k * 0.005), decay: 0.4, type: 'triangle', verb: 0.3 });
  b.tune(calm.end - 3.6, 72, [['E4', 1], ['G4', 1], ['C5', 2]], 'flute', 0.05);
  // The night-light, and she sleeps.
  b.bed(light.at, light.end, 66, ['C', 'F', 'G', 'C'], 0.026, { attack: 1, release: 1.6 });
  musicBox(b, light.at + 0.8, 70, CRADLE.slice(0, 8), 0.06);
  b.choir(light.at + 3, light.dur - 3, ['C4', 'E4', 'G4'], 0.016);
  // The five Sweet Dreams, floating home.
  b.swell(dreams.at, 2, 0.08);
  for (let k = 0; k < 5; k++) b.pluck(dreams.at + 0.6 + k * 0.5, hz(['C5', 'E5', 'G5', 'B5', 'C6'][k]), { gain: 0.09, decay: 2.4, type: 'triangle', bell: true, verb: 0.5 });
  b.strings(dreams.at + 1, dreams.dur - 1, ['C3', 'G3', 'C4', 'E4', 'G4'], 0.04, { attack: 0.4, release: 1.6 });
  b.choir(dreams.at + 1.4, dreams.dur - 1.6, ['C4', 'G4', 'E5'], 0.024);
  b.tune(dreams.at + 2.4, 92, CRADLE.slice(0, 8), 'horn', 0.07);
  b.sparkle(dreams.at + 1, 14, 0.05);
  // The party on the great pillow.
  b.beat(party.at, BPM, Math.floor(party.dur / BAR), 0.26);
  b.bed(party.at, party.end, BPM, THEME_CHORDS.slice(0, 4), 0.035, { attack: 0.05, release: 0.4 });
  b.tune(party.at, BPM, THEME.slice(0, 14), 'horn', 0.085);
  for (let t = party.at + 0.4; t < party.end - 0.5; t += 1.1) b.firework(t, 0.1);
  b.cheer(party.at + 0.2, 7, 0.035);
  // The credits, gently.
  b.bed(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 80, ['D', 'Bm', 'G', 'A', 'D'], 0.04);
  b.tune(credits.at + 1.2, 80, THEME.slice(0, 14), 'flute', 0.06);
  // Morning on the beach.
  const title = morning.m.title;
  b.sea(morning.at, morning.dur, 0.03);
  musicBox(b, morning.at + 0.6, 80, CRADLE.slice(0, 8), 0.06);
  b.bed(morning.at + 0.4, title, 80, ['C', 'G'], 0.022, { attack: 0.6, release: 1.2 });
  b.strings(title - 0.4, morning.end - title + 0.4, ['C3', 'G3', 'E4'], 0.03, { attack: 0.4, release: 1.6 });
  for (const [i, n] of ['C4', 'E4', 'G4', 'C5'].entries()) b.pluck(title + i * 0.16, hz(n), { gain: 0.09, decay: 1.6, type: 'triangle', bell: true, verb: 0.45 });
}

// The seventh episode's: a storybook's tune, bright and bouncy, played on a
// xylophone as the pages turn, and Count Inkblot's own, low and sly, on a
// bassoon.
const STORY = [
  ['C5', 0.5], ['E5', 0.5], ['G5', 1], ['E5', 0.5], ['G5', 0.5], ['A5', 1], ['G5', 0.5], ['E5', 0.5], ['C5', 1], ['D5', 2],
  ['D5', 0.5], ['F5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5], ['E5', 1], ['D5', 0.5], ['B4', 0.5], ['C5', 2],
];
const INK = [['D3', 0.75], ['F3', 0.25], ['E3', 0.75], ['C#3', 0.25], ['D3', 1], ['A2', 1], ['Bb2', 0.75], ['A2', 0.25], ['D3', 2]];
const xylo = (b, t, bpm, notes, gain = 0.09) => {
  let at = t;
  for (const [n, beats] of notes) {
    if (n) b.pluck(at, hz(n), { gain, decay: 0.7, type: 'triangle', bell: true, verb: 0.3 });
    at += (beats * 60) / bpm;
  }
  return at;
};
// A page turning: a soft swish of paper.
const turnPage = (b, t, gain = 0.05) => b.hiss(t, 0.45, { type: 'bandpass', f: 2600, f2: 900, q: 0.8, gain, attack: 0.03, verb: 0.2 });

function intro7(b, c) {
  const gift = c('gift');
  const open = c('open');
  const flat = c('flat');
  const count = c('count');
  const pages = [c('harbor'), c('castle'), c('moon')];
  const go = c('go');
  // The Night Mare asleep: the cradle song, softly, on a music box.
  b.bed(0.4, gift.end, 72, ['C', 'F', 'G', 'C'], 0.022, { attack: 1.2, release: 1.2 });
  musicBox(b, 0.8, 72, CRADLE.slice(0, 8), 0.055);
  b.sparkle(gift.at + 2, 8, 0.04);
  // The book opening, the tune's first notes, and a rush of light.
  b.swell(open.at + 0.6, 2.4, 0.07);
  xylo(b, open.at + 0.8, 88, STORY.slice(0, 5), 0.07);
  b.choir(open.at + 2, open.dur - 2, ['C4', 'G4', 'E5'], 0.02);
  b.sparkle(open.at + 2.2, 14, 0.05);
  b.whoosh(open.end - 0.8, 0.09, 1.2);
  // On the page: boing, boing, boing — and the tune, bright.
  for (let i = 0; i < 3; i++) b.pluck(flat.at + 1.2 + i * 0.35, hz(['G4', 'C5', 'E5'][i]), { gain: 0.12, decay: 0.5, type: 'sine', verb: 0.2 });
  b.beat(flat.at + 1.6, 112, Math.floor((flat.dur - 1.6) / ((60 / 112) * 4)), 0.18);
  b.bed(flat.at + 1.6, flat.end, 112, ['C', 'F', 'G', 'C'], 0.03, { attack: 0.05, release: 0.3 });
  xylo(b, flat.at + 1.6, 112, STORY, 0.08);
  // Count Inkblot: his own tune, low and sly, and something rising.
  b.strings(count.at, count.dur, ['D2', 'A2', 'D3', 'F3'], 0.035, { attack: 0.6, release: 1, tremolo: true });
  b.tune(count.at + 0.5, 84, INK, 'bassoon', 0.1);
  b.tune(count.at + 4.4, 84, INK, 'bassoon', 0.08);
  b.timpaniRoll(count.end - 1.6, 1.4, 'D2', 0.18);
  // A story after another, a page turned for each.
  for (const [i, p] of pages.entries()) {
    turnPage(b, p.at, 0.06);
    b.chords(p.at + 0.2, 112, [['F', 'Am', 'G'][i]], 0.03, { attack: 0.05, release: 0.4 });
    xylo(b, p.at + 0.25, 112, STORY.slice(i * 3, i * 3 + 4), 0.07);
  }
  // Off you go, and the title.
  const title = go.m.title;
  b.beat(go.at, BPM, Math.floor(go.dur / BAR), 0.24);
  b.bed(go.at, title, BPM, THEME_CHORDS.slice(0, 4), 0.032, { attack: 0.05, release: 0.4 });
  xylo(b, go.at + 0.2, BPM, STORY.slice(0, 10), 0.07);
  b.pop(go.at + go.m.stomp, 0.22);
  b.timpaniRoll(title - 0.8, 0.8, 'D2', 0.2);
  b.chords(title, BPM, THEME_CHORDS.slice(0, 2), 0.04, { attack: 0.2, release: 0.6 });
  b.tune(title, BPM, THEME.slice(0, 9), 'horn', 0.1);
  b.crash(title, 0.12, 3);
  b.sparkle(title, 10, 0.05);
  b.strings(go.end - 2.4, 2.4, CHORDS.D, 0.04, { attack: 0.1, release: 1.6 });
}

function ending7(b, c) {
  const splosh = c('splosh');
  const end = c('theend');
  const happy = [c('meadow'), c('harbor'), c('moon')];
  const credits = c('credits');
  const night = c('goodnight');
  // Count Inkblot, puffed out; then SPLOSH.
  b.strings(splosh.at, splosh.dur, ['D3', 'A3', 'F4'], 0.03, { attack: 0.5, release: 1.2, tremolo: true });
  b.tune(splosh.at + 0.4, 72, INK.slice(0, 5), 'bassoon', 0.08);
  const pop = splosh.m.pop;
  b.pop(pop, 0.3);
  b.crash(pop, 0.12, 2.4);
  b.firework(pop + 0.2, 0.1);
  b.swell(pop, 1.6, 0.07);
  // Back into the inkwell, and THE END, written.
  b.bed(end.at, end.end, 70, ['F', 'C', 'G', 'C'], 0.026, { attack: 1, release: 1.4 });
  for (let k = 0; k < 10; k++) b.pluck(end.at + 0.4 + k * 0.28, hz(['C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'C5'][k]), { gain: 0.05, decay: 0.4, type: 'sine', verb: 0.35 });
  b.choir(end.end - 3, 3, ['C4', 'E4', 'G4', 'C5'], 0.022);
  // Every story's Happy Ending, a page turned for each.
  for (const [i, p] of happy.entries()) {
    turnPage(b, p.at, 0.06);
    b.chords(p.at + 0.1, 112, [['C', 'F', 'G'][i], ['Am', 'C', 'C'][i]], 0.034, { attack: 0.05, release: 0.4 });
    xylo(b, p.at + 0.2, 112, STORY.slice(i * 6, i * 6 + 6), 0.08);
  }
  b.cheer(happy[0].at + 0.2, 3.5, 0.035);
  for (let t = happy[0].at + 0.4; t < happy[0].end - 0.4; t += 1.2) b.firework(t, 0.08);
  // The credits, gently.
  b.bed(credits.at, credits.end, 84, ['C', 'Am', 'F', 'G', 'C'], 0.025, { attack: 1, release: 1.4 });
  b.twinkle(credits.at, credits.end, 84, ['C', 'Am', 'F', 'G', 'C'], 0.04);
  xylo(b, credits.at + 1, 84, STORY, 0.06);
  b.tune(credits.at + 6.8, 84, STORY.slice(0, 9), 'flute', 0.05);
  // Back in the Land of Nod: the cradle song, and the book shut.
  const title = night.m.title;
  musicBox(b, night.at + 0.5, 72, CRADLE.slice(0, 8), 0.06);
  b.bed(night.at + 0.3, title, 72, ['C', 'F', 'G', 'C'], 0.022, { attack: 0.8, release: 1.2 });
  b.drum(night.at + night.m.shut + 1.4, { f: 90, to: 50, decay: 0.3, gain: 0.25 });
  b.strings(title - 0.4, night.end - title + 0.4, ['C3', 'G3', 'E4'], 0.03, { attack: 0.4, release: 1.6 });
  for (const [i, n] of ['C4', 'E4', 'G4', 'C5'].entries()) b.pluck(title + i * 0.16, hz(n), { gain: 0.09, decay: 1.6, type: 'triangle', bell: true, verb: 0.45 });
}

export async function score(name, secs, cues) {
  const b = new Band(secs);
  const c = cueBook(cues);
  ({ intro, ending, intro2, ending2, intro3, ending3, intro4, ending4, intro5, ending5, intro6, ending6, intro7, ending7 }[name] ?? ending)(b, c);
  await b.voices(cues.lines);
  return b.render();
}
