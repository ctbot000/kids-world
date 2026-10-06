// Every sound is made on the spot with Web Audio: soft pops and clicks for
// building, boings and splashes, animal voices (birdsong, hoots, buzzing,
// whale song, neighs, moos and an elephant's trumpet among them), hoofbeats, a chime when a friend arrives, little "animal
// talk" babble when someone says something, and gentle music that changes
// with the time of day.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// Mixer levels at full volume: effects peak around -10 dB, music sits below them.
const SFX_GAIN = 2.5;
const MUSIC_GAIN = 0.6;
// C major pentatonic, the notes that always sound nice together.
const PENTA = [0, 2, 4, 7, 9];

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxLevel = 0.8;
    this.musicLevel = 0.5;
    this.musicOn = false;
    this.mood = 'day';
    this.weather = 'clear';
    this.nextBeat = 0;
    this.beat = 0;
    this.melodyNote = 7;
    this.ambienceAt = 0;
  }

  // Browsers only allow sound after the player has touched or clicked.
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.setup(new Ctx());
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // Builds the mixer on a context (an OfflineAudioContext works too, for tests).
  setup(ctx) {
    this.ctx = ctx;
    this.offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -12;
    this.master.ratio.value = 4;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxLevel * SFX_GAIN;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicLevel * MUSIC_GAIN;
    this.music.connect(this.master);
    this.rain = null;
  }

  get ready() {
    return this.offline || this.ctx?.state === 'running';
  }

  setLevels({ sound, music }) {
    if (sound !== undefined) this.sfxLevel = sound;
    if (music !== undefined) this.musicLevel = music;
    if (this.ctx) {
      this.sfx.gain.setTargetAtTime(this.sfxLevel * SFX_GAIN, this.ctx.currentTime, 0.05);
      this.music.gain.setTargetAtTime(this.musicLevel * MUSIC_GAIN, this.ctx.currentTime, 0.05);
    }
  }

  // ------------------------------------------------ building blocks

  // Neigh-eh-eh-eh, high for a unicorn (pitch).
  neigh(pitch = 1) {
    const r = () => 0.95 + Math.random() * 0.1;
    this.tone(950 * pitch * r(), { type: 'sawtooth', attack: 0.04, decay: 0.75, gain: 0.035, slide: 520 * pitch, slideTime: 0.7, vibrato: 90 });
    this.tone(1900 * pitch * r(), { type: 'triangle', attack: 0.04, decay: 0.6, gain: 0.015, slide: 1000 * pitch, slideTime: 0.6, vibrato: 120 });
    this.noise(0.15, { at: 0.75, type: 'lowpass', freq: 800, gain: 0.08 });
  }

  tone(freq, { type = 'sine', at = 0, attack = 0.005, decay = 0.2, gain = 0.3, slide = null, slideTime = null, dest = null, vibrato = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + (slideTime ?? decay));
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + attack + decay + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  noise(duration, { at = 0, type = 'lowpass', freq = 1200, q = 0.8, gain = 0.2, sweep = null, dest = null, attack = 0.005 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    this.noiseBuffer ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + duration);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(dest ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.05);
  }

  // ------------------------------------------------ effects

  play(name, opts = {}) {
    if (!this.ready) return;
    const r = () => 0.94 + Math.random() * 0.12;
    switch (name) {
      case 'place': {
        const base = { brick: 760, wood: 430, stone: 320, glass: 1250, soft: 380, grass: 300, dirt: 260, sand: 340, snow: 420, leaves: 520, candy: 880, water: 300, plant: 900 }[opts.kind] ?? 600;
        this.tone(base * r(), { decay: 0.09, gain: 0.35, slide: base * 0.8 });
        this.tone(base * 2 * r(), { decay: 0.05, gain: 0.08 });
        this.noise(0.04, { type: 'highpass', freq: 2500, gain: 0.08 });
        break;
      }
      case 'lift': {
        // Whirr up (or down) to the next floor.
        const up = opts.up !== false;
        this.tone(up ? 180 : 330, { type: 'triangle', decay: 0.6, gain: 0.06, slide: up ? 330 : 180 });
        this.noise(0.5, { freq: 500, gain: 0.04 });
        break;
      }
      case 'ding':
        this.tone(1320, { decay: 0.5, gain: 0.12 });
        this.tone(1760, { at: 0.12, decay: 0.6, gain: 0.1 });
        break;
      case 'boing': {
        // Off a trampoline: a springy boing, higher the higher you go.
        const k = Math.min(1, (opts.speed ?? 12) / 21);
        const f = (140 + 120 * k) * r();
        this.tone(f, { type: 'triangle', decay: 0.34, gain: 0.18, slide: f * 2.6, slideTime: 0.2, vibrato: 14 + 10 * k });
        this.tone(f * 0.5, { decay: 0.1, gain: 0.12, slide: f * 0.8 });
        break;
      }
      case 'pop':
        this.tone(320 * r(), { decay: 0.12, gain: 0.3, slide: 760, slideTime: 0.09 });
        this.tone(900 * r(), { at: 0.04, decay: 0.06, gain: 0.08 });
        break;
      case 'paint':
        this.noise(0.22, { type: 'bandpass', freq: 700, sweep: 3200, q: 2, gain: 0.18 });
        this.tone(1400 * r(), { at: 0.08, decay: 0.12, gain: 0.08, type: 'triangle' });
        break;
      case 'hills':
        this.tone(140, { decay: 0.3, gain: 0.3, slide: 70 });
        this.noise(0.25, { type: 'lowpass', freq: 400, gain: 0.18 });
        break;
      case 'stamp':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), { at: i * 0.06, decay: 0.25, gain: 0.14, type: 'triangle' }));
        this.noise(0.3, { type: 'highpass', freq: 5000, gain: 0.05, at: 0.1 });
        break;
      case 'jump':
        this.tone(260 * r(), { decay: 0.16, gain: 0.16, slide: 560, slideTime: 0.12 });
        break;
      case 'land':
        this.tone(95, { decay: 0.08, gain: 0.18, slide: 55 });
        break;
      case 'step': {
        const kind = opts.kind ?? 'grass';
        if (kind === 'wood' || kind === 'brick' || kind === 'stone' || kind === 'glass' || kind === 'candy') {
          this.tone((kind === 'wood' ? 260 : kind === 'stone' ? 200 : 360) * r(), { decay: 0.035, gain: 0.07 });
        } else {
          this.noise(0.06, { type: 'lowpass', freq: kind === 'sand' ? 2400 : kind === 'snow' ? 1600 : 1100, gain: 0.07 });
        }
        break;
      }
      case 'splash':
        this.noise(0.4, { type: 'bandpass', freq: 900, q: 0.7, gain: 0.3 });
        for (let i = 0; i < 4; i++) this.tone(600 + Math.random() * 600, { at: 0.05 + i * 0.05, decay: 0.05, gain: 0.05, slide: 1400 });
        break;
      case 'pet':
        this.tone(NOTE(88), { decay: 0.3, gain: 0.12 });
        this.tone(NOTE(91), { at: 0.1, decay: 0.35, gain: 0.12 });
        break;
      case 'yum':
        for (let i = 0; i < 3; i++) this.noise(0.05, { at: i * 0.1, type: 'bandpass', freq: 1800, q: 3, gain: 0.12 });
        this.tone(NOTE(84), { at: 0.35, decay: 0.3, gain: 0.1 });
        break;
      case 'dig':
        this.noise(0.07, { type: 'bandpass', freq: 2600, q: 4, gain: 0.22 });
        this.tone(NOTE(96), { decay: 0.1, gain: 0.07, type: 'triangle' });
        this.noise(0.12, { at: 0.04, type: 'lowpass', freq: 700, gain: 0.12 });
        break;
      case 'collect':
        this.tone(NOTE(88), { decay: 0.12, gain: 0.14, type: 'triangle' });
        this.tone(NOTE(93), { at: 0.07, decay: 0.3, gain: 0.14, type: 'triangle' });
        break;
      case 'ui':
        this.tone(900, { decay: 0.04, gain: 0.08 });
        break;
      case 'photo':
        this.noise(0.05, { type: 'highpass', freq: 3000, gain: 0.25 });
        this.noise(0.08, { at: 0.07, type: 'bandpass', freq: 1800, q: 2, gain: 0.18 });
        break;
      case 'open':
        this.tone(500, { decay: 0.12, gain: 0.1, slide: 900 });
        break;
      case 'close':
        this.tone(900, { decay: 0.12, gain: 0.08, slide: 500 });
        break;
      case 'join':
        this.tone(NOTE(76), { decay: 0.6, gain: 0.16 });
        this.tone(NOTE(88), { decay: 0.4, gain: 0.04 });
        this.tone(NOTE(72), { at: 0.35, decay: 0.8, gain: 0.16 });
        this.tone(NOTE(84), { at: 0.35, decay: 0.5, gain: 0.04 });
        break;
      case 'leave':
        this.tone(NOTE(79), { decay: 0.3, gain: 0.1 });
        this.tone(NOTE(72), { at: 0.18, decay: 0.45, gain: 0.1 });
        break;
      case 'sticker':
        [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), { at: i * 0.1, decay: i === 3 ? 0.7 : 0.18, gain: 0.15, type: 'triangle' }));
        this.noise(0.6, { at: 0.35, type: 'highpass', freq: 6000, gain: 0.06 });
        break;
      case 'grow':
        for (let i = 0; i < 6; i++) this.tone(NOTE(72 + PENTA[i % 5] + 12 * Math.floor(i / 5)), { at: i * 0.07, decay: 0.2, gain: 0.08, type: 'triangle' });
        break;
      case 'star':
        for (let i = 0; i < 5; i++) this.tone(NOTE(96 - i * 3), { at: i * 0.08, decay: 0.3, gain: 0.06 });
        break;
      case 'no':
        this.tone(220, { decay: 0.08, gain: 0.12, type: 'triangle' });
        this.tone(185, { at: 0.1, decay: 0.12, gain: 0.12, type: 'triangle' });
        break;
      // Monsters: bumped (a soft boing), popped (a squelch and a sparkle),
      // and a grumble now and then.
      case 'bump':
        this.tone(180 * r(), { decay: 0.3, gain: 0.25, type: 'triangle', slide: 90, slideTime: 0.25, vibrato: 18 });
        this.noise(0.08, { type: 'lowpass', freq: 600, gain: 0.15 });
        break;
      case 'splat':
        this.noise(0.12, { type: 'bandpass', freq: 700, sweep: 2400, q: 1.5, gain: 0.25 });
        this.tone(420 * r(), { decay: 0.1, gain: 0.2, slide: 1100, slideTime: 0.08 });
        this.tone(NOTE(91), { at: 0.1, decay: 0.3, gain: 0.08, type: 'triangle' });
        break;
      case 'grumble':
        this.tone(110 * r(), { decay: 0.35, gain: 0.12, type: 'sawtooth', slide: 85, vibrato: 12 });
        break;
      case 'bye':
        this.noise(0.3, { type: 'bandpass', freq: 1500, sweep: 400, gain: 0.15 });
        this.tone(NOTE(84), { at: 0.1, decay: 0.3, gain: 0.08 });
        break;
      case 'bunny':
        this.tone(1300 * r(), { decay: 0.07, gain: 0.08, slide: 1700 });
        this.tone(1500 * r(), { at: 0.1, decay: 0.06, gain: 0.06, slide: 1900 });
        break;
      case 'chick':
        for (let i = 0; i < 2; i++) this.tone(2100 * r(), { at: i * 0.13, decay: 0.07, gain: 0.07, slide: 2700 });
        break;
      case 'sheep':
        this.baa();
        break;
      case 'duck':
        for (let i = 0; i < 2; i++) this.quack(i * 0.18);
        break;
      case 'butterfly':
        for (let i = 0; i < 3; i++) this.tone(NOTE(96 + PENTA[i]), { at: i * 0.05, decay: 0.12, gain: 0.04 });
        break;
      case 'bird': {
        // A little song of quick whistles, never quite the same twice.
        const notes = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < notes; i++) {
          const f = 2300 + Math.random() * 1500;
          this.tone(f, { at: i * 0.11, decay: 0.07, gain: 0.05, slide: f * (Math.random() < 0.5 ? 1.35 : 0.75), slideTime: 0.06 });
        }
        break;
      }
      case 'owl':
        // Hoo... hoo-hoo.
        [0, 0.45, 0.62].forEach((at, i) => this.tone(i ? 390 : 420, { at, attack: 0.04, decay: i === 2 ? 0.45 : 0.25, gain: 0.09, slide: i ? 360 : 400, vibrato: 4 }));
        break;
      case 'bee':
        this.tone(190 * r(), { type: 'sawtooth', attack: 0.06, decay: 0.55, gain: 0.025, vibrato: 14, slide: 215 * r() });
        this.tone(380 * r(), { type: 'triangle', attack: 0.06, decay: 0.5, gain: 0.015, vibrato: 20 });
        break;
      case 'fish':
        // Blub, blub.
        for (let i = 0; i < 2; i++) this.tone(500 * r(), { at: i * 0.12, decay: 0.08, gain: 0.06, slide: 900, slideTime: 0.06 });
        break;
      case 'dolphin':
        // Clicks, and a whistle.
        for (let i = 0; i < 4; i++) this.noise(0.012, { at: i * 0.045, type: 'highpass', freq: 3500, gain: 0.12 });
        this.tone(1800 * r(), { at: 0.22, decay: 0.3, gain: 0.05, slide: 2900, slideTime: 0.25, vibrato: 60 });
        break;
      case 'whale':
        // A long, low song.
        this.tone(170 * r(), { attack: 0.3, decay: 1.4, gain: 0.12, slide: 120, slideTime: 1.2, vibrato: 3 });
        this.tone(250 * r(), { at: 0.9, attack: 0.3, decay: 1.2, gain: 0.08, slide: 330, slideTime: 1, vibrato: 4 });
        break;
      case 'turtle':
        this.tone(220 * r(), { decay: 0.18, gain: 0.07, type: 'triangle', slide: 180 });
        break;
      case 'crab':
        // Snip, snip.
        for (let i = 0; i < 2; i++) this.noise(0.03, { at: i * 0.14, type: 'bandpass', freq: 2600, q: 4, gain: 0.18 });
        break;
      case 'octopus':
        this.tone(650 * r(), { decay: 0.16, gain: 0.08, slide: 220, slideTime: 0.14 });
        break;
      case 'penguin':
        // Aah, aah!
        for (let i = 0; i < 2; i++) this.tone(620 * r(), { at: i * 0.2, type: 'sawtooth', decay: 0.13, gain: 0.05, slide: 480, vibrato: 25 });
        break;
      case 'seal':
        // Arf! Arf!
        for (let i = 0; i < 2 + (Math.random() < 0.5 ? 1 : 0); i++) this.tone(360 * r(), { at: i * 0.22, type: 'sawtooth', decay: 0.12, gain: 0.07, slide: 230 });
        break;
      case 'spout':
        // Pfoosh!
        this.noise(0.9, { type: 'bandpass', freq: 1200, sweep: 500, q: 0.6, gain: 0.22, attack: 0.05 });
        break;
      case 'pony':
        this.neigh(1);
        break;
      case 'unicorn':
        this.neigh(1.25);
        // ...and a sparkle.
        for (let i = 0; i < 4; i++) this.tone(NOTE(88 + PENTA[(i * 2) % 5]), { at: 0.5 + i * 0.07, decay: 0.25, gain: 0.04 });
        break;
      case 'reindeer':
        // A snort, and the bell on its collar.
        this.noise(0.18, { type: 'lowpass', freq: 700, gain: 0.12 });
        for (let i = 0; i < 3; i++) this.tone(2350 * r(), { at: 0.15 + i * 0.09, decay: 0.3, gain: 0.03 });
        break;
      case 'cow':
        // Moooo.
        this.tone(150 * r(), { type: 'sawtooth', attack: 0.12, decay: 0.85, gain: 0.05, slide: 118, slideTime: 0.8, vibrato: 2 });
        this.tone(300 * r(), { type: 'triangle', attack: 0.12, decay: 0.7, gain: 0.03, slide: 236, slideTime: 0.7 });
        break;
      case 'elephant':
      case 'trumpet':
        // A trumpet, high and wobbly.
        this.tone(520 * r(), { type: 'sawtooth', attack: 0.05, decay: 0.7, gain: 0.06, slide: 760, slideTime: 0.25, vibrato: 30 });
        this.tone(1040 * r(), { type: 'square', attack: 0.05, decay: 0.55, gain: 0.015, slide: 1500, slideTime: 0.25, vibrato: 30 });
        break;
      case 'giraffe':
        // A soft hum.
        this.tone(105 * r(), { type: 'triangle', attack: 0.2, decay: 0.7, gain: 0.08, vibrato: 3 });
        break;
      case 'polarbear':
        // A gentle rumble.
        this.tone(170 * r(), { type: 'sawtooth', attack: 0.08, decay: 0.55, gain: 0.04, slide: 120, vibrato: 18 });
        this.noise(0.4, { type: 'lowpass', freq: 400, gain: 0.08, attack: 0.05 });
        break;
      case 'hoof':
        // Clip-clop, or big soft paws (big).
        this.noise(0.05, { type: 'bandpass', freq: opts.big ? 300 : 1400 * r(), q: opts.big ? 1 : 3, gain: opts.big ? 0.14 : 0.1 });
        this.tone(opts.big ? 70 : 220 * r(), { decay: 0.06, gain: opts.big ? 0.1 : 0.04 });
        break;
      case 'seagull':
        // Kee-ow, kee-ow!
        for (let i = 0, n = Math.random() < 0.5 ? 2 : 3; i < n; i++) {
          this.tone(1500 * r(), { at: i * 0.32, type: 'triangle', decay: 0.22, gain: 0.07, slide: 900, slideTime: 0.2, vibrato: 30 });
          this.tone(3000 * r(), { at: i * 0.32, decay: 0.12, gain: 0.015, slide: 1800 });
        }
        break;
      // Vehicles: each starts up with its own sound, and honks its own way
      // (type): the car beep-beeps, the boat toots, the mine cart rings its
      // bell, and the digger goes vrrrm.
      case 'car':
      case 'boat':
      case 'digger':
      case 'minecart':
        this.tone(70 * r(), { type: 'sawtooth', attack: 0.05, decay: 0.45, gain: 0.05, slide: 110, slideTime: 0.3, vibrato: 14 });
        this.play('honk', { type: name });
        break;
      case 'honk':
        if (opts.type === 'boat') {
          this.tone(NOTE(55), { type: 'square', attack: 0.04, decay: 0.7, gain: 0.05, vibrato: 3 });
          this.tone(NOTE(62), { type: 'triangle', attack: 0.04, decay: 0.7, gain: 0.06 });
        } else if (opts.type === 'minecart') {
          for (let i = 0; i < 2; i++) this.tone(2100 * r(), { at: i * 0.16, decay: 0.45, gain: 0.05 });
        } else if (opts.type === 'digger') {
          this.noise(0.5, { type: 'bandpass', freq: 900, sweep: 1600, q: 2, gain: 0.12, attack: 0.03 });
          this.tone(90 * r(), { type: 'sawtooth', attack: 0.04, decay: 0.5, gain: 0.05, slide: 130, vibrato: 25 });
        } else {
          for (let i = 0; i < 2; i++) {
            this.tone(NOTE(71), { at: i * 0.17, type: 'square', attack: 0.01, decay: 0.12, gain: 0.04 });
            this.tone(NOTE(75), { at: i * 0.17, type: 'triangle', attack: 0.01, decay: 0.12, gain: 0.06 });
          }
        }
        break;
      case 'motor':
        // A puttering engine, higher the faster it goes; the digger grinds.
        this.tone((opts.type === 'digger' ? 55 : 80) + (opts.speed ?? 0) * 6, { type: 'sawtooth', attack: 0.02, decay: 0.18, gain: 0.025, vibrato: 20 });
        this.noise(0.12, { type: 'lowpass', freq: opts.type === 'boat' ? 900 : 400, gain: 0.05 });
        break;
      case 'clack':
        // Clickety-clack over the joins of the rails.
        this.noise(0.04, { type: 'bandpass', freq: 2000 * r(), q: 5, gain: 0.12 });
        this.noise(0.04, { at: 0.07, type: 'bandpass', freq: 1700 * r(), q: 5, gain: 0.1 });
        break;
      case 'emote':
        this.emote(opts.emote);
        break;
      default:
        break;
    }
  }

  baa() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.linearRampToValueAtTime(260, t + 0.5);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 18;
    depth.gain.value = 18;
    lfo.connect(depth).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.6);
    lfo.stop(t + 0.6);
  }

  quack(at) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1000;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.15);
  }

  emote(key) {
    switch (key) {
      case 'wave':
        this.tone(NOTE(79), { decay: 0.2, gain: 0.1 });
        this.tone(NOTE(84), { at: 0.12, decay: 0.3, gain: 0.1 });
        break;
      case 'dance':
        [72, 76, 79, 76, 72, 79, 84].forEach((n, i) => this.tone(NOTE(n), { at: i * 0.14, decay: 0.12, gain: 0.08, type: 'triangle' }));
        break;
      case 'cheer':
        this.tone(NOTE(76), { decay: 0.4, gain: 0.1, slide: NOTE(88), slideTime: 0.3, type: 'triangle' });
        break;
      case 'hearts':
        [84, 88, 91].forEach((n, i) => this.tone(NOTE(n), { at: i * 0.09, decay: 0.3, gain: 0.07 }));
        break;
      case 'clap':
        for (let i = 0; i < 3; i++) this.noise(0.06, { at: i * 0.18, type: 'bandpass', freq: 2200, q: 1, gain: 0.25 });
        break;
      case 'sleepy':
        this.tone(NOTE(67), { decay: 0.8, gain: 0.07, slide: NOTE(60), slideTime: 0.8, type: 'triangle' });
        break;
      case 'laugh':
        for (let i = 0; i < 4; i++) this.tone(NOTE(81 - i), { at: i * 0.1, decay: 0.07, gain: 0.08, type: 'triangle', vibrato: 20 });
        break;
      case 'surprise':
        this.tone(NOTE(76), { decay: 0.18, gain: 0.1, slide: NOTE(91), slideTime: 0.12, type: 'triangle' });
        break;
      default:
        break;
    }
  }

  // "Animal talk": a little burst of pitched syllables for a phrase.
  babble(text, voice = 0) {
    if (!this.ready) return;
    // Letters of any alphabet: a Hangul syllable, a kana or an A each count once.
    const letters = [...text].filter((ch) => /[\p{L}\p{N}]/u.test(ch));
    const count = Math.min(14, Math.max(2, Math.round(letters.length / 2)));
    const base = 380 + (voice % 7) * 38;
    for (let i = 0; i < count; i++) {
      const c = letters[(i * 2) % Math.max(1, letters.length)]?.codePointAt(0) ?? 97;
      const f = base * (1 + ((c % 7) - 3) * 0.06) * (text.endsWith('?') && i === count - 1 ? 1.3 : 1);
      this.tone(f, { at: i * 0.075, decay: 0.06, gain: 0.07, type: 'triangle' });
      this.tone(f * 2.01, { at: i * 0.075, decay: 0.04, gain: 0.02 });
    }
  }

  // ------------------------------------------------ music and ambience

  setMood(mood, weather) {
    this.mood = mood;
    this.weather = weather;
  }

  startMusic() {
    this.musicOn = true;
  }

  stopMusic() {
    this.musicOn = false;
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.rainLoop(this.musicOn && (this.weather === 'rain' || this.weather === 'sprinkles'));
    if (!this.musicOn) {
      this.nextBeat = 0;
      return;
    }
    const night = this.mood === 'night';
    const spb = 60 / (night ? 66 : 88) / 2; // eighth notes
    if (this.nextBeat < now) this.nextBeat = now + 0.1;
    while (this.nextBeat < now + 0.2) {
      this.playBeat(this.beat, this.nextBeat - now, night, spb);
      this.nextBeat += spb;
      this.beat++;
    }
    // Birds in the day, crickets at night, now and then.
    if (now > this.ambienceAt) {
      this.ambienceAt = now + 4 + Math.random() * 7;
      if (this.weather === 'clear' || this.weather === 'rainbow') {
        if (night) for (let i = 0; i < 3; i++) this.tone(4200, { at: i * 0.09, decay: 0.03, gain: 0.012, dest: this.music });
        else {
          const f = 2600 + Math.random() * 900;
          for (let i = 0; i < 3; i++) this.tone(f * (1 + i * 0.08), { at: i * 0.1, decay: 0.07, gain: 0.02, slide: f * 1.25, dest: this.music });
        }
      }
    }
  }

  playBeat(beat, at, night, spb) {
    // Two bars per chord: C, Am, F, G (daytime) or Am, F, C, G (night).
    const chords = night
      ? [
          [57, 60, 64],
          [53, 57, 60],
          [48, 52, 55],
          [55, 59, 62],
        ]
      : [
          [48, 52, 55],
          [57, 60, 64],
          [53, 57, 60],
          [55, 59, 62],
        ];
    const bar = Math.floor(beat / 8);
    const chord = chords[Math.floor(bar / 2) % 4];
    const inBar = beat % 8;
    const quiet = this.weather === 'rain' || this.weather === 'snow' ? 0.6 : 1;
    if (inBar === 0 && bar % 2 === 0) {
      for (const n of chord) this.tone(NOTE(n), { at, attack: 0.4, decay: spb * 15, gain: 0.05 * quiet, type: 'triangle', dest: this.music });
    }
    if (inBar === 0 || inBar === 4) this.tone(NOTE(chord[0] - 12), { at, decay: spb * 3, gain: 0.12 * quiet, dest: this.music });
    // The melody wanders over the pentatonic scale, with rests.
    const play = night ? inBar % 2 === 0 && Math.random() < 0.7 : Math.random() < (inBar % 2 === 0 ? 0.75 : 0.35);
    if (play) {
      this.melodyNote = Math.max(0, Math.min(11, this.melodyNote + Math.round((Math.random() - 0.5) * 4)));
      const n = 72 + PENTA[this.melodyNote % 5] + 12 * Math.floor(this.melodyNote / 5) - (night ? 0 : 12);
      const f = NOTE(n);
      this.tone(f, { at, decay: night ? 0.7 : 0.35, gain: (night ? 0.07 : 0.09) * quiet, dest: this.music });
      this.tone(f * 3, { at, decay: 0.08, gain: 0.015 * quiet, dest: this.music });
    }
  }

  rainLoop(on) {
    const ctx = this.ctx;
    if (on && !this.rain) {
      const src = ctx.createBufferSource();
      this.noise(0.01, { gain: 0.0001 }); // makes sure the noise buffer exists
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
      src.connect(f).connect(g).connect(this.sfx);
      src.start();
      this.rain = { src, g };
    } else if (!on && this.rain) {
      const { src, g } = this.rain;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8);
      src.stop(ctx.currentTime + 3);
      this.rain = null;
    }
  }
}
