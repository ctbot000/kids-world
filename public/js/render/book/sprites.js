// The little pictures of the Storybook (paint.js cut-outs): every kind of foe
// in each of its looks (skins, the stories' own) in a few drawings each — two
// steps, squashed flat, and one of its own (wings up, puffed up, down in its
// hole) — and the stars, bookmarks, platforms, springs, crates, treasure
// chests, what foes spit, and the things stood about for show. Each painted into a cell px
// square, its foot at the cell's foot.
import { blob, cheeks, cutout, ellipse, eyes, INK, mouth, polygon, rounded, shade, smooth, starPath } from './paint.js';

const TAU = Math.PI * 2;

// ------------------------------------------------ foes

// A creature: a body (round, tall or wide) of colour body, eyes and a mouth,
// feet that step (frame 'a' and 'b'), ears and a little something of its own
// (extra, drawn over it; under, drawn under it); 'flat' is it squashed.
function critter(ctx, S, frame, o) {
  const flat = frame === 'flat';
  const step = frame === 'b' ? 1 : 0;
  const W = S * (o.w ?? 0.62);
  const H = S * (o.h ?? 0.56) * (flat ? 0.42 : 1);
  const cx = S / 2;
  const foot = S - 8;
  const cy = foot - H / 2 - (o.feet === false ? 0 : S * 0.06) - (flat ? 0 : step * 3);
  ctx.save();
  o.under?.(ctx, S, frame, { cx, cy, W, H });
  // Feet.
  if (o.feet !== false && !flat) {
    for (const s of [-1, 1]) {
      const fx = cx + s * W * 0.25 + (step ? s * 4 : -s * 2);
      cutout(ctx, ellipse(fx, foot - S * 0.045, S * 0.09, S * 0.05), shade(o.body, -0.25), { line: 3, edge: 0, grain: 0 });
    }
  }
  // Ears.
  if (!flat) ears(ctx, cx, cy - H / 2, W, o);
  const shape = o.shape === 'tall' ? blob(cx, cy, W / 2.2, H / 2, 0.05, o.seed ?? 3, 10) : blob(cx, cy, W / 2, H / 2, o.wobble ?? 0.06, o.seed ?? 3, 10);
  cutout(ctx, shape, o.body, { line: 4, edge: 6, top: cy - H / 2, bottom: cy + H / 2 });
  if (o.belly) cutout(ctx, ellipse(cx, cy + H * 0.15, W * 0.3, H * 0.28), o.belly, { line: 0, edge: 0, shadeK: 0, grain: 0.03 });
  ctx.__skin = o.body;
  const er = S * (o.eye ?? 0.085);
  eyes(ctx, cx + (o.look ?? 0.08) * S, cy - H * (o.eyeUp ?? 0.12), flat ? er * 0.9 : er, S * (o.apart ?? 0.2), { mood: flat ? 'dizzy' : (o.mood ?? 'happy'), dx: 0.4 });
  if (!flat) {
    if (o.cheeks !== false) cheeks(ctx, cx + (o.look ?? 0.08) * S, cy + H * 0.08, S * 0.34, S * 0.04);
    mouth(ctx, cx + (o.look ?? 0.08) * S, cy + H * 0.18, S * 0.12, o.mouth ?? 'smile');
  }
  o.extra?.(ctx, S, frame, { cx, cy, W, H, foot });
  ctx.restore();
}

function ears(ctx, cx, top, W, o) {
  const col = shade(o.body, -0.05);
  if (o.ears === 'mouse') {
    for (const s of [-1, 1]) {
      cutout(ctx, ellipse(cx + s * W * 0.32, top + 6, W * 0.2, W * 0.2), col, { line: 3, edge: 4, grain: 0 });
      cutout(ctx, ellipse(cx + s * W * 0.32, top + 6, W * 0.11, W * 0.11), '#ffb3c6', { line: 0, edge: 0, grain: 0, shadeK: 0 });
    }
  } else if (o.ears === 'bunny') {
    for (const s of [-1, 1]) {
      cutout(ctx, ellipse(cx + s * W * 0.17, top - W * 0.28, W * 0.1, W * 0.36, s * 0.15), col, { line: 3, edge: 4, grain: 0 });
      cutout(ctx, ellipse(cx + s * W * 0.17, top - W * 0.26, W * 0.05, W * 0.26, s * 0.15), '#ffc6d6', { line: 0, edge: 0, grain: 0, shadeK: 0 });
    }
  } else if (o.ears === 'frog') {
    for (const s of [-1, 1]) cutout(ctx, ellipse(cx + s * W * 0.24, top + 8, W * 0.16, W * 0.14), o.body, { line: 3, edge: 4, grain: 0 });
  } else if (o.ears === 'antenna') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * W * 0.12, top + 6);
      ctx.quadraticCurveTo(cx + s * W * 0.3, top - 18, cx + s * W * 0.34, top - 22);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx + s * W * 0.34, top - 22, 4, 0, TAU);
      ctx.fill();
    }
  }
}

function spikes(ctx, cx, cy, rx, ry, n, col, tip, len = 0.32, from = 0, to = TAU) {
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * (i + 0.5)) / n;
    const x0 = cx + Math.cos(a - 0.18) * rx * 0.85;
    const y0 = cy + Math.sin(a - 0.18) * ry * 0.85;
    const x1 = cx + Math.cos(a + 0.18) * rx * 0.85;
    const y1 = cy + Math.sin(a + 0.18) * ry * 0.85;
    const xt = cx + Math.cos(a) * rx * (1 + len);
    const yt = cy + Math.sin(a) * ry * (1 + len);
    cutout(ctx, polygon([[x0, y0], [xt, yt], [x1, y1]]), col, { line: 3, edge: 3, grain: 0, shadeK: 0 });
    if (tip) {
      ctx.fillStyle = tip;
      ctx.beginPath();
      ctx.arc(xt, yt, 3, 0, TAU);
      ctx.fill();
    }
  }
}

function wings(ctx, cx, cy, W, frame, col, up = frame === 'x' || frame === 'b') {
  for (const s of [-1, 1]) {
    const tip = up ? -0.55 : 0.2;
    cutout(ctx, ellipse(cx + s * W * 0.55, cy + W * tip * 0.6, W * 0.36, W * 0.2, s * (up ? -0.7 : 0.4)), col, { line: 3, edge: 4, grain: 0.02 });
  }
}

const SKINS = {
  // Hopscotch Meadow
  inkling: (c, S, f) =>
    critter(c, S, f, {
      body: '#33407a',
      belly: '#4a5aa0',
      mood: 'big',
      extra: (x, S2, fr, b) => fr !== 'flat' && cutout(x, blob(b.cx + 4, b.cy - b.H / 2 - 4, 7, 10, 0.1, 9, 7), '#33407a', { line: 3, edge: 3, grain: 0 }),
    }),
  hoppit: (c, S, f) => critter(c, S, f, { body: '#62c25a', belly: '#b9ec8f', shape: 'wide', w: 0.7, h: 0.48, ears: 'frog', eyeUp: 0.42, mouth: 'grin', feet: true }),
  burr: (c, S, f) =>
    critter(c, S, f, {
      body: '#a0703f',
      mood: 'grump',
      mouth: 'grump',
      under: (x, S2, fr, b) => fr !== 'flat' && spikes(x, b.cx, b.cy, b.W / 2, b.H / 2, 11, '#6b4424', '#f5e6c8', 0.35, Math.PI * 0.95, Math.PI * 2.05),
    }),
  buzzer: (c, S, f) =>
    critter(c, S, f, {
      body: '#ffd23f',
      feet: false,
      ears: 'antenna',
      w: 0.6,
      h: 0.48,
      under: (x, S2, fr, b) => fr !== 'flat' && wings(x, b.cx, b.cy - b.H * 0.35, b.W * 0.7, fr, 'rgba(220,240,255,0.9)'),
      extra: (x, S2, fr, b) => {
        x.save();
        x.beginPath();
        blob(b.cx, b.cy, b.W / 2, b.H / 2, 0.06, 3, 10)(x);
        x.clip();
        x.fillStyle = '#2b2440';
        for (const dx of [-0.22, 0.02]) x.fillRect(b.cx + dx * S2 - S2 * 0.03 - 22, b.cy - b.H, S2 * 0.07, b.H * 2);
        x.restore();
        cutout(x, polygon([[b.cx - b.W / 2 + 2, b.cy + 2], [b.cx - b.W / 2 - 14, b.cy + 6], [b.cx - b.W / 2 + 2, b.cy + 12]]), '#2b2440', { line: 2, edge: 0, grain: 0 });
      },
    }),
  molly: (c, S, f) =>
    f === 'x'
      ? mound(c, S, '#9c6b44')
      : critter(c, S, f, {
          body: '#7d6656',
          belly: '#bba393',
          eye: 0.05,
          extra: (x, S2, fr, b) => {
            cutout(x, ellipse(b.cx + S2 * 0.12, b.cy + b.H * 0.02, S2 * 0.055, S2 * 0.045), '#ff8fb1', { line: 3, edge: 0, grain: 0 });
            for (const s of [-1, 1]) cutout(x, ellipse(b.cx + s * b.W * 0.48, b.cy + b.H * 0.2, S2 * 0.07, S2 * 0.05), '#ffc6d6', { line: 3, edge: 2, grain: 0 });
          },
        }),
  // Paper Boat Harbor
  pinch: (c, S, f) =>
    critter(c, S, f, {
      body: '#ec5b4c',
      shape: 'wide',
      w: 0.72,
      h: 0.42,
      eyeUp: 0.75,
      eye: 0.07,
      cheeks: false,
      extra: (x, S2, fr, b) => {
        if (fr === 'flat') return;
        for (const s of [-1, 1]) {
          const open = fr === 'b' ? 0.25 : 0;
          cutout(x, ellipse(b.cx + s * b.W * 0.62, b.cy - b.H * 0.35, S2 * 0.1, S2 * 0.08, s * (0.4 + open)), '#ec5b4c', { line: 3, edge: 4, grain: 0 });
          x.fillStyle = '#ffffff';
          x.beginPath();
          x.moveTo(b.cx + s * b.W * 0.62, b.cy - b.H * 0.35);
          x.lineTo(b.cx + s * b.W * 0.74, b.cy - b.H * 0.48 - open * 10);
          x.lineTo(b.cx + s * b.W * 0.74, b.cy - b.H * 0.25);
          x.fill();
        }
        x.strokeStyle = INK;
        x.lineWidth = 3;
        for (const s of [-1, 1]) {
          x.beginPath();
          x.moveTo(b.cx + s * S2 * 0.1, b.cy - b.H * 0.4);
          x.lineTo(b.cx + s * S2 * 0.1, b.cy - b.H * 0.62);
          x.stroke();
        }
      },
    }),
  urchin: (c, S, f) =>
    critter(c, S, f, {
      body: '#8a55c0',
      feet: false,
      mood: 'grump',
      mouth: 'grump',
      under: (x, S2, fr, b) => fr !== 'flat' && spikes(x, b.cx, b.cy, b.W / 2, b.H / 2, 14, '#5b2f8a', '#f0d8ff', 0.55),
    }),
  gull: (c, S, f) =>
    critter(c, S, f, {
      body: '#f6f6f6',
      feet: false,
      w: 0.56,
      h: 0.46,
      cheeks: false,
      under: (x, S2, fr, b) => fr !== 'flat' && wings(x, b.cx, b.cy - b.H * 0.1, b.W * 0.85, fr, '#e0e6ee'),
      extra: (x, S2, fr, b) => cutout(x, polygon([[b.cx + b.W * 0.38, b.cy - b.H * 0.02], [b.cx + b.W * 0.68, b.cy + b.H * 0.08], [b.cx + b.W * 0.36, b.cy + b.H * 0.2]]), '#ffa62b', { line: 3, edge: 2, grain: 0 }),
    }),
  squirt: (c, S, f) =>
    critter(c, S, f, {
      body: '#ff7aa8',
      belly: '#ffb3cc',
      feet: false,
      w: f === 'x' ? 0.7 : 0.6,
      h: f === 'x' ? 0.6 : 0.52,
      mouth: f === 'x' ? 'o' : 'smile',
      under: (x, S2, fr, b) => {
        if (fr === 'flat') return;
        for (let i = 0; i < 5; i++) {
          const tx = b.cx - b.W * 0.4 + (i * b.W * 0.8) / 4;
          cutout(x, ellipse(tx, b.cy + b.H * 0.48, S2 * 0.04, S2 * 0.1, Math.sin(i + (fr === 'b' ? 1 : 0)) * 0.4), '#ff7aa8', { line: 3, edge: 3, grain: 0 });
        }
      },
    }),
  clam: (c, S, f) => clam(c, S, f),
  leaper: (c, S, f) =>
    critter(c, S, f, {
      body: '#ffa94d',
      feet: false,
      shape: 'wide',
      w: 0.66,
      h: 0.42,
      cheeks: false,
      extra: (x, S2, fr, b) => {
        if (fr === 'flat') return;
        cutout(x, polygon([[b.cx - b.W * 0.45, b.cy], [b.cx - b.W * 0.75, b.cy - b.H * 0.4], [b.cx - b.W * 0.75, b.cy + b.H * 0.4]]), '#ff8a2b', { line: 3, edge: 3, grain: 0 });
        cutout(x, polygon([[b.cx - b.W * 0.1, b.cy - b.H * 0.45], [b.cx + b.W * 0.1, b.cy - b.H * 0.8], [b.cx + b.W * 0.25, b.cy - b.H * 0.4]]), '#ff8a2b', { line: 3, edge: 3, grain: 0 });
      },
    }),
  // Once-upon Castle
  knight: (c, S, f) =>
    critter(c, S, f, {
      body: '#5b8de0',
      belly: '#8fb4f0',
      shape: 'tall',
      eyeUp: 0.25,
      cheeks: false,
      mood: 'grump',
      extra: (x, S2, fr, b) => {
        if (fr === 'flat') return;
        cutout(x, (p) => p.roundRect(b.cx - b.W * 0.42, b.cy - b.H * 0.62, b.W * 0.84, b.H * 0.42, [18, 18, 6, 6]), '#c9c9d8', { line: 4, edge: 4, top: b.cy - b.H * 0.62, bottom: b.cy - b.H * 0.2 });
        x.fillStyle = INK;
        x.fillRect(b.cx - b.W * 0.3 + 10, b.cy - b.H * 0.42, b.W * 0.55, 6);
        cutout(x, blob(b.cx - 4, b.cy - b.H * 0.72, 12, 16, 0.1, 3, 7), '#e8453c', { line: 3, edge: 3, grain: 0 });
      },
    }),
  toad: (c, S, f) =>
    critter(c, S, f, {
      body: '#7fb069',
      belly: '#d6efb0',
      shape: 'wide',
      w: 0.7,
      h: 0.48,
      ears: 'frog',
      eyeUp: 0.42,
      extra: (x, S2, fr, b) => fr !== 'flat' && cutout(x, polygon([[b.cx - 18, b.cy - b.H * 0.55], [b.cx - 18, b.cy - b.H * 0.85], [b.cx - 8, b.cy - b.H * 0.7], [b.cx, b.cy - b.H * 0.9], [b.cx + 8, b.cy - b.H * 0.7], [b.cx + 18, b.cy - b.H * 0.85], [b.cx + 18, b.cy - b.H * 0.55]]), '#ffd84d', { line: 3, edge: 3, grain: 0 }),
    }),
  thistle: (c, S, f) =>
    critter(c, S, f, {
      body: '#a77bd6',
      mood: 'grump',
      mouth: 'grump',
      under: (x, S2, fr, b) => fr !== 'flat' && spikes(x, b.cx, b.cy, b.W / 2, b.H / 2, 12, '#4f8a3a', '#e8ffd8', 0.4),
    }),
  bat: (c, S, f) =>
    critter(c, S, f, {
      body: '#5b4b8a',
      feet: false,
      w: 0.5,
      h: 0.46,
      ears: 'mouse',
      mood: 'grump',
      mouth: 'grin',
      under: (x, S2, fr, b) => {
        if (fr === 'flat') return;
        const up = fr === 'b' || fr === 'x';
        for (const s of [-1, 1]) cutout(x, polygon([[b.cx + s * b.W * 0.3, b.cy - 6], [b.cx + s * b.W * 1.15, b.cy + (up ? -b.H * 0.7 : -b.H * 0.1)], [b.cx + s * b.W * 0.95, b.cy + b.H * 0.25], [b.cx + s * b.W * 0.7, b.cy + b.H * 0.1], [b.cx + s * b.W * 0.45, b.cy + b.H * 0.3]]), '#3f3266', { line: 3, edge: 4, grain: 0 });
      },
    }),
  spider: (c, S, f) =>
    critter(c, S, f, {
      body: '#2e2840',
      feet: false,
      w: 0.5,
      h: 0.46,
      cheeks: false,
      mouth: 'grin',
      under: (x, S2, fr, b) => {
        x.strokeStyle = INK;
        x.lineWidth = 5;
        x.lineCap = 'round';
        for (const s of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            const a = -0.6 + i * 0.4;
            x.beginPath();
            x.moveTo(b.cx + s * b.W * 0.3, b.cy + a * 10);
            x.quadraticCurveTo(b.cx + s * b.W * 0.8, b.cy + a * 30 - 16, b.cx + s * b.W * (0.85 + (fr === 'b' ? 0.08 : 0)), b.cy + a * 40 + 18);
            x.stroke();
          }
        }
      },
    }),
  cannon: (c, S, f) => cannon(c, S, f),
  // Twinkle Sky
  mouse: (c, S, f) =>
    critter(c, S, f, {
      body: '#b9b2cf',
      belly: '#e6e0f5',
      ears: 'mouse',
      extra: (x, S2, fr, b) => {
        cutout(x, ellipse(b.cx + b.W * 0.5, b.cy + b.H * 0.05, S2 * 0.03, S2 * 0.03), '#ff8fb1', { line: 2, edge: 0, grain: 0 });
        x.strokeStyle = '#ff8fb1';
        x.lineWidth = 4;
        x.beginPath();
        x.moveTo(b.cx - b.W * 0.48, b.cy + b.H * 0.3);
        x.quadraticCurveTo(b.cx - b.W * 0.8, b.cy, b.cx - b.W * 0.7, b.cy - b.H * 0.3);
        x.stroke();
      },
    }),
  bunny: (c, S, f) => critter(c, S, f, { body: '#fdfbff', belly: '#ffe6f0', ears: 'bunny', w: 0.58, h: 0.52 }),
  spikestar: (c, S, f) => spikestar(c, S, f),
  owl: (c, S, f) =>
    critter(c, S, f, {
      body: '#9a7864',
      belly: '#e8d6c0',
      feet: false,
      eye: 0.11,
      apart: 0.26,
      cheeks: false,
      mouth: 'o',
      under: (x, S2, fr, b) => fr !== 'flat' && wings(x, b.cx, b.cy, b.W * 0.7, fr, '#7a5a48'),
    }),
  cheese: (c, S, f) => wheel(c, S, f, '#ffcf4a', '#e0a92c', true),
  // Inkwell Keep
  blotling: (c, S, f) => critter(c, S, f, { body: '#2a1f44', belly: '#463a6e', mood: 'grump', mouth: 'grin', wobble: 0.14, seed: 7 }),
  inkfrog: (c, S, f) => critter(c, S, f, { body: '#4a3a78', belly: '#8a78c0', shape: 'wide', w: 0.7, h: 0.48, ears: 'frog', eyeUp: 0.42, mouth: 'grin', mood: 'grump' }),
  quillback: (c, S, f) =>
    critter(c, S, f, {
      body: '#6a5884',
      mood: 'grump',
      under: (x, S2, fr, b) => fr !== 'flat' && spikes(x, b.cx, b.cy, b.W / 2, b.H / 2, 10, '#f0ecff', INK, 0.5, Math.PI * 0.95, Math.PI * 2.05),
    }),
  inkmoth: (c, S, f) => critter(c, S, f, { body: '#8a76b8', feet: false, ears: 'antenna', w: 0.48, h: 0.44, under: (x, S2, fr, b) => fr !== 'flat' && wings(x, b.cx, b.cy - b.H * 0.1, b.W * 0.95, fr, '#c4b4ec') }),
  splat: (c, S, f) => (f === 'x' ? puddle(c, S, '#2a1f40') : critter(c, S, f, { body: '#33285a', feet: false, wobble: 0.2, seed: 11, mood: 'grump', mouth: 'grin', h: 0.6 })),
  inkpot: (c, S, f) => inkpot(c, S, f),
  drip: (c, S, f) =>
    critter(c, S, f, {
      body: '#3a2d63',
      feet: false,
      w: 0.48,
      h: 0.5,
      extra: (x, S2, fr, b) => fr !== 'flat' && cutout(x, polygon([[b.cx - 12, b.cy - b.H * 0.4], [b.cx, b.cy - b.H * 0.85], [b.cx + 12, b.cy - b.H * 0.4]]), '#3a2d63', { line: 3, edge: 3, grain: 0 }),
    }),
  barrel: (c, S, f) => wheel(c, S, f, '#8a5a3e', '#5e3a26', false),
};

// What is still about of a foe down in its hole (a mole's hill).
function mound(ctx, S, col) {
  cutout(ctx, (p) => {
    p.moveTo(S * 0.15, S - 6);
    p.quadraticCurveTo(S / 2, S * 0.62, S * 0.85, S - 6);
    p.closePath();
  }, col, { line: 4, edge: 5, top: S * 0.62, bottom: S });
}

function puddle(ctx, S, col) {
  cutout(ctx, ellipse(S / 2, S - 12, S * 0.36, S * 0.07), col, { line: 4, edge: 5, top: S - 22, bottom: S });
}

function clam(ctx, S, f) {
  const open = f === 'a' || f === 'b';
  const cx = S / 2;
  const foot = S - 8;
  cutout(ctx, ellipse(cx, foot - S * 0.12, S * 0.32, S * 0.13), '#f5b8c8', { line: 4, edge: 5, top: foot - S * 0.25, bottom: foot });
  if (open) {
    cutout(ctx, ellipse(cx, foot - S * 0.18, S * 0.1, S * 0.1), '#ffffff', { line: 3, edge: 2, grain: 0 });
    ctx.__skin = '#f5b8c8';
    eyes(ctx, cx + 8, foot - S * 0.44, S * 0.07, S * 0.2, { mood: 'grump' });
  }
  const lid = open ? -0.75 : 0;
  ctx.save();
  ctx.translate(cx - S * 0.3, foot - S * 0.14);
  ctx.rotate(lid);
  cutout(ctx, (p) => {
    p.moveTo(0, 0);
    p.quadraticCurveTo(S * 0.3, -S * 0.34, S * 0.6, 0);
    p.closePath();
  }, '#ffcbd8', { line: 4, edge: 5, top: -S * 0.34, bottom: 0 });
  ctx.restore();
  if (f === 'flat') eyes(ctx, cx, foot - S * 0.12, S * 0.05, S * 0.16, { mood: 'dizzy' });
}

function cannon(ctx, S, f) {
  const cx = S / 2;
  const foot = S - 8;
  if (f === 'x') {
    cutout(ctx, blob(cx - S * 0.3, foot - S * 0.42, S * 0.14, S * 0.12, 0.15, 5, 8), '#e8e8f0', { line: 3, edge: 3, grain: 0 });
  }
  cutout(ctx, rounded(cx - S * 0.32, foot - S * 0.46, S * 0.56, S * 0.24, 12), '#5c5c70', { line: 4, edge: 5, top: foot - S * 0.46, bottom: foot - S * 0.22 });
  cutout(ctx, rounded(cx - S * 0.38, foot - S * 0.5, S * 0.1, S * 0.32, 6), '#444457', { line: 4, edge: 3, grain: 0 });
  for (const s of [-1, 1]) cutout(ctx, ellipse(cx + s * S * 0.15, foot - S * 0.13, S * 0.12, S * 0.12), '#a8693d', { line: 4, edge: 4, grain: 0 });
  ctx.__skin = '#5c5c70';
  eyes(ctx, cx + S * 0.06, foot - S * 0.36, S * 0.05, S * 0.14, { mood: f === 'flat' ? 'dizzy' : 'grump', dx: -0.6 });
}

function inkpot(ctx, S, f) {
  const cx = S / 2;
  const foot = S - 8;
  cutout(ctx, (p) => {
    p.moveTo(cx - S * 0.3, foot);
    p.quadraticCurveTo(cx - S * 0.36, foot - S * 0.4, cx - S * 0.14, foot - S * 0.45);
    p.lineTo(cx - S * 0.12, foot - S * 0.58);
    p.lineTo(cx + S * 0.12, foot - S * 0.58);
    p.lineTo(cx + S * 0.14, foot - S * 0.45);
    p.quadraticCurveTo(cx + S * 0.36, foot - S * 0.4, cx + S * 0.3, foot);
    p.closePath();
  }, '#3d3260', { line: 4, edge: 6, top: foot - S * 0.58, bottom: foot });
  cutout(ctx, rounded(cx - S * 0.15, foot - S * 0.66, S * 0.3, S * 0.1, 4), '#a07850', { line: 3, edge: 3, grain: 0 });
  ctx.__skin = '#3d3260';
  eyes(ctx, cx - 6, foot - S * 0.25, S * 0.06, S * 0.16, { mood: f === 'flat' ? 'dizzy' : 'grump', dx: -0.6 });
  mouth(ctx, cx - 6, foot - S * 0.12, S * 0.1, f === 'x' ? 'o' : 'grump', '#e8e0ff');
}

function spikestar(ctx, S, f) {
  const cx = S / 2;
  const flat = f === 'flat';
  const cy = S - 8 - S * (flat ? 0.12 : 0.3);
  const r = S * (flat ? 0.2 : 0.3);
  ctx.save();
  if (flat) {
    ctx.translate(cx, cy);
    ctx.scale(1, 0.5);
    ctx.translate(-cx, -cy);
  }
  cutout(ctx, starPath(cx, cy, r, r * 0.6, 7), '#ffd84d', { line: 4, edge: 5, top: cy - r, bottom: cy + r });
  ctx.restore();
  ctx.__skin = '#ffd84d';
  eyes(ctx, cx + 4, cy - 4, S * 0.05, S * 0.14, { mood: flat ? 'dizzy' : 'grump' });
  if (!flat) mouth(ctx, cx + 4, cy + 10, S * 0.09, 'grump');
}

function wheel(ctx, S, f, col, dark, holes) {
  const cx = S / 2;
  const r = S * 0.34;
  const cy = S - 8 - r;
  cutout(ctx, ellipse(cx, cy, r, f === 'flat' ? r * 0.5 : r), col, { line: 4, edge: 5, top: cy - r, bottom: cy + r });
  if (holes) {
    for (const [dx, dy, rr] of [
      [-0.35, -0.3, 0.16],
      [0.3, 0.1, 0.2],
      [-0.1, 0.42, 0.12],
    ]) cutout(ctx, ellipse(cx + dx * r, cy + dy * r, rr * r, rr * r), dark, { line: 2, edge: 0, grain: 0, shadeK: 0 });
  } else {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 6;
    for (const k of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.9, cy + k * r);
      ctx.lineTo(cx + r * 0.9, cy + k * r);
      ctx.stroke();
    }
  }
  ctx.__skin = col;
  eyes(ctx, cx, cy - r * 0.2, S * 0.05, S * 0.16, { mood: f === 'flat' ? 'dizzy' : 'grump' });
}

// The drawings of a skin, by frame.
export const FRAMES = ['a', 'b', 'flat', 'x'];

export function paintSkin(ctx, skin, frame, S) {
  (SKINS[skin] ?? SKINS.inkling)(ctx, S, frame);
}

export const SKIN_KEYS = Object.keys(SKINS);

// ------------------------------------------------ what foes spit, and bosses throw

export function paintShot(ctx, kind, S) {
  const c = S / 2;
  switch (kind) {
    case 'seed':
      cutout(ctx, ellipse(c, c, S * 0.22, S * 0.32, 0.4), '#8a5a2e', { line: 4, edge: 5, top: c - S * 0.3, bottom: c + S * 0.3 });
      break;
    case 'fire':
    case 'flame':
      cutout(ctx, (p) => {
        p.moveTo(c, S * 0.08);
        p.quadraticCurveTo(c + S * 0.42, S * 0.5, c + S * 0.26, S * 0.8);
        p.quadraticCurveTo(c, S * 0.96, c - S * 0.26, S * 0.8);
        p.quadraticCurveTo(c - S * 0.42, S * 0.5, c, S * 0.08);
        p.closePath();
      }, '#ff8a2b', { line: 4, edge: 4, top: S * 0.08, bottom: S * 0.95 });
      cutout(ctx, ellipse(c, S * 0.66, S * 0.13, S * 0.18), '#ffe066', { line: 0, edge: 0, grain: 0, shadeK: 0 });
      break;
    case 'ripple':
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(c, S * 0.9, S * 0.38, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 4;
      ctx.stroke();
      break;
    case 'cheese':
      wheel(ctx, S, 'a', '#ffcf4a', '#e0a92c', true);
      break;
    case 'quill':
      cutout(ctx, (p) => {
        p.moveTo(S * 0.08, c);
        p.quadraticCurveTo(c, c - S * 0.22, S * 0.92, c);
        p.quadraticCurveTo(c, c + S * 0.22, S * 0.08, c);
        p.closePath();
      }, '#f0ecff', { line: 4, edge: 3, top: c - S * 0.2, bottom: c + S * 0.2 });
      break;
    default:
      // Ink: a blob, a drip, a blot.
      cutout(ctx, blob(c, c, S * 0.3, S * 0.3, 0.12, kind.length, 9), '#2b2050', { line: 4, edge: 5, top: c - S * 0.3, bottom: c + S * 0.3 });
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(c - S * 0.1, c - S * 0.1, S * 0.07, 0, TAU);
      ctx.fill();
  }
}

export const SHOT_KINDS = ['ink', 'seed', 'fire', 'flame', 'ripple', 'cheese', 'blot', 'quill', 'drip'];

// ------------------------------------------------ what lies about

// A star to pick up: gold, smiling.
export function paintStar(ctx, S) {
  const c = S / 2;
  cutout(ctx, starPath(c, c + 2, S * 0.42, S * 0.21), '#ffd23f', { line: 5, edge: 6, top: c - S * 0.42, bottom: c + S * 0.42, ink: '#a8590c' });
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(c - S * 0.1, c - S * 0.08, S * 0.06, S * 0.1, 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#a8590c';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(c + s * S * 0.08, c + 2, S * 0.03, 0, TAU);
    ctx.fill();
  }
}

// A bookmark on its pole, 1 by 2 cells: plain paper till lit, then a bright
// ribbon with a tassel.
export function paintMark(ctx, W, H, lit) {
  const x = W * 0.3;
  cutout(ctx, rounded(x - 5, H * 0.08, 10, H * 0.9, 5), '#8a5a3a', { line: 3, edge: 4, top: 0, bottom: H });
  const col = lit ? '#ff5d8f' : '#ece6dc';
  cutout(ctx, polygon([[x + 4, H * 0.1], [W - 8, H * 0.1], [W - 8, H * 0.52], [(x + W - 4) / 2, H * 0.42], [x + 4, H * 0.52]]), col, { line: 4, edge: 5, top: H * 0.1, bottom: H * 0.52 });
  ctx.strokeStyle = lit ? '#ffd23f' : '#c8c0b4';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 12, H * 0.14, W - 8 - x - 20, H * 0.26);
  ctx.setLineDash([]);
  if (lit) {
    cutout(ctx, starPath((x + W) / 2, H * 0.26, 14, 7), '#ffd23f', { line: 3, edge: 3, grain: 0 });
    cutout(ctx, ellipse(x, H * 0.06, 9, 9), '#ffd23f', { line: 3, edge: 3, grain: 0 });
  } else cutout(ctx, ellipse(x, H * 0.06, 8, 8), '#c8c0b4', { line: 3, edge: 3, grain: 0 });
}

// A platform that moves, w cells across by one: as its kind is.
export function paintMover(ctx, kind, W, H) {
  const top = H * 0.22;
  switch (kind) {
    case 'lily':
      cutout(ctx, ellipse(W / 2, top + 16, W / 2 - 8, 20), '#4fb44a', { line: 4, edge: 5, top, bottom: top + 36 });
      ctx.fillStyle = '#2f7d32';
      ctx.beginPath();
      ctx.moveTo(W / 2, top + 16);
      ctx.lineTo(W / 2 + 40, top - 2);
      ctx.lineTo(W / 2 + 54, top + 4);
      ctx.fill();
      cutout(ctx, starPath(W * 0.3, top + 6, 16, 8, 6), '#ffb3d1', { line: 3, edge: 3, grain: 0 });
      break;
    case 'boat':
      cutout(ctx, polygon([[6, top], [W - 6, top], [W - 40, top + 50], [40, top + 50]]), '#ffffff', { line: 4, edge: 4, top, bottom: top + 50 });
      ctx.strokeStyle = '#c8d8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, top + 16);
      ctx.lineTo(W - 30, top + 16);
      ctx.stroke();
      break;
    case 'cloud':
      cutout(ctx, (p) => {
        for (let k = 0; k < 4; k++) p.ellipse(30 + (k * (W - 60)) / 3, top + 18, 34, 22, 0, 0, TAU);
      }, '#f4f6ff', { line: 0, edge: 6, top, bottom: top + 44, shadeK: 0.1 });
      break;
    case 'lift':
      cutout(ctx, rounded(4, top, W - 8, 30, 6), '#9c6b3f', { line: 4, edge: 4, top, bottom: top + 30 });
      ctx.strokeStyle = '#6e6e80';
      ctx.lineWidth = 4;
      for (const x of [20, W - 20]) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(W / 2, 0);
        ctx.stroke();
      }
      break;
    default:
      // A raft of logs.
      for (let k = 0; k < Math.round(W / 40); k++) cutout(ctx, rounded(6 + k * 40, top, 36, 36, 16), '#8a5a3e', { line: 4, edge: 3, top, bottom: top + 36 });
  }
}

// A spring as each story has them, at rest or squashed.
export function paintSpring(ctx, story, S, squashed) {
  const k = squashed ? 0.55 : 1;
  const foot = S - 4;
  const cx = S / 2;
  if (story === 'meadow' || story === 'turret') {
    cutout(ctx, rounded(cx - 14, foot - 40 * k, 28, 40 * k, 6), '#fff4e0', { line: 4, edge: 3, grain: 0 });
    cutout(ctx, (p) => p.ellipse(cx, foot - 40 * k, S * 0.45, 34 * k, 0, Math.PI, 0), '#e8453c', { line: 4, edge: 5, top: foot - 76 * k, bottom: foot - 40 * k });
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy] of [
      [-0.2, -0.55],
      [0.15, -0.7],
      [0.3, -0.48],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + dx * S, foot - 40 * k + dy * 34 * k, 7, 0, TAU);
      ctx.fill();
    }
    return;
  }
  if (story === 'harbor') {
    cutout(ctx, (p) => p.ellipse(cx, foot - 30 * k, S * 0.42, 30 * k, 0, 0, TAU), '#ffffff', { line: 4, edge: 4, top: foot - 60 * k, bottom: foot });
    ctx.fillStyle = '#e8453c';
    ctx.fillRect(cx - S * 0.4, foot - 36 * k, S * 0.8, 12 * k);
    return;
  }
  // A coiled spring.
  ctx.strokeStyle = story === 'inkwell' ? '#b4a3d2' : '#c8d0e8';
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) ctx.lineTo(cx + (i % 2 ? 22 : -22), foot - (i * 52 * k) / 5);
  ctx.stroke();
  cutout(ctx, rounded(cx - S * 0.4, foot - 60 * k - 14, S * 0.8, 16, 6), story === 'inkwell' ? '#8b78a8' : '#ffd23f', { line: 4, edge: 4, grain: 0 });
}

// A crate (a box to bop open), as each story has them.
export function paintCrate(ctx, story, S) {
  const col = { meadow: '#d79a5a', harbor: '#b9783f', turret: '#9a7448', starry: '#8f86d6', inkwell: '#6e5c86' }[story] ?? '#d79a5a';
  cutout(ctx, rounded(4, 4, S - 8, S - 8, 6), col, { line: 5, edge: 0, top: 4, bottom: S - 4 });
  ctx.strokeStyle = shade(col, -0.35);
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, S - 28, S - 28);
  ctx.beginPath();
  ctx.moveTo(16, 16);
  ctx.lineTo(S - 16, S - 16);
  ctx.stroke();
  cutout(ctx, starPath(S / 2, S / 2, 14, 7), '#ffd23f', { line: 3, edge: 3, grain: 0 });
}

// A treasure chest (gold: the golden one), shut or open: a box with bands and a
// lock, its lid domed; open, the lid thrown back and gold heaped up inside.
export function paintChest(ctx, S, gold, open) {
  const wood = gold ? '#ffcb3d' : '#b8723a';
  const band = gold ? '#c96f1c' : '#f2c34c';
  const L = S * 0.1;
  const R = S * 0.9;
  const w = R - L;
  const foot = S * 0.95;
  const rim = S * 0.6;
  if (open) {
    // The lid, back, its inside to see; and the treasure heaped up.
    cutout(ctx, polygon([[L + 3, rim], [L + 8, S * 0.16], [R - 8, S * 0.16], [R - 3, rim]]), shade(wood, -0.42), { line: 4, edge: 6, top: S * 0.16, bottom: rim });
    ctx.fillStyle = shade(band, -0.3);
    for (const x of [L + w * 0.2, R - w * 0.2]) ctx.fillRect(x - w * 0.045, S * 0.18, w * 0.09, rim - S * 0.2);
    cutout(ctx, ellipse(S / 2, rim + 2, w * 0.42, S * 0.14), '#ffd84d', { line: 3, edge: 0, top: rim - S * 0.14, bottom: rim + 6, ink: '#a8590c' });
    for (const [x, y, r] of [[0.36, -0.06, 0.07], [0.52, -0.1, 0.075], [0.66, -0.05, 0.065], [0.45, 0.0, 0.06], [0.6, 0.01, 0.06]]) cutout(ctx, ellipse(S * x, rim + S * y, S * r, S * r * 0.8), '#ffe98a', { line: 2, edge: 0, grain: 0, ink: '#a8590c' });
    cutout(ctx, starPath(S * 0.5, rim - S * 0.17, S * 0.07, S * 0.03, 4, 0), '#ffffff', { line: 0, edge: 0, grain: 0 });
  }
  // The box.
  cutout(ctx, rounded(L, rim, w, foot - rim, 7), wood, { line: 4, edge: 6, top: rim, bottom: foot });
  ctx.strokeStyle = shade(wood, -0.3);
  ctx.lineWidth = 2.5;
  for (const y of [rim + (foot - rim) * 0.36, rim + (foot - rim) * 0.7]) {
    ctx.beginPath();
    ctx.moveTo(L + 6, y);
    ctx.lineTo(R - 6, y);
    ctx.stroke();
  }
  for (const x of [L + w * 0.2, R - w * 0.2]) cutout(ctx, rounded(x - w * 0.05, rim + 2, w * 0.1, foot - rim - 4, 3), band, { line: 2, edge: 0, grain: 0 });
  if (!open) {
    // The lid, shut: a dome over the box.
    cutout(ctx, (p) => {
      p.moveTo(L, rim + 1);
      p.ellipse(S / 2, rim + 1, w / 2, S * 0.27, 0, Math.PI, 0);
      p.closePath();
    }, wood, { line: 4, edge: 6, top: rim - S * 0.27, bottom: rim });
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(S / 2, rim + 1, w / 2 - 2, S * 0.27 - 2, 0, Math.PI, 0);
    ctx.clip();
    ctx.fillStyle = band;
    for (const x of [L + w * 0.2, R - w * 0.2]) ctx.fillRect(x - w * 0.05, rim - S * 0.3, w * 0.1, S * 0.3);
    ctx.restore();
    if (gold) for (const [x, c] of [[0.34, '#ff4d6d'], [0.5, '#4fa8ff'], [0.66, '#3ecf74']]) cutout(ctx, ellipse(S * x, rim - S * 0.13, S * 0.045, S * 0.055), c, { line: 2, edge: 0, grain: 0 });
  }
  // The lock, with its keyhole.
  cutout(ctx, rounded(S / 2 - S * 0.08, rim - S * 0.05, S * 0.16, S * 0.17, 4), gold ? '#fff0b0' : '#ffd84d', { line: 3, edge: 0, grain: 0, ink: '#7a4410' });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(S / 2, rim + S * 0.02, S * 0.025, 0, TAU);
  ctx.fill();
  ctx.fillRect(S / 2 - S * 0.012, rim + S * 0.02, S * 0.024, S * 0.06);
}

// ------------------------------------------------ for show

// Each kind, drawn in a cell w by h cells (of S px): [w, h, draw(ctx, W, H)].
export const DECOR = {
  tulip: [1, 1, (c, W, H) => flower(c, W, H, '#ff5d8f', 'tulip')],
  daisy: [1, 1, (c, W, H) => flower(c, W, H, '#ffffff', 'daisy')],
  grass: [1, 1, (c, W, H) => tuft(c, W, H, '#5bb043')],
  bush: [2, 1, (c, W, H) => cutout(c, blob(W / 2, H - H * 0.32, W * 0.42, H * 0.32, 0.08, 4, 10), '#4f9a3a', { line: 4, edge: 6, top: H * 0.36, bottom: H })],
  tree: [2, 3, (c, W, H) => {
    cutout(c, rounded(W / 2 - 16, H * 0.45, 32, H * 0.55, 10), '#8a5a3a', { line: 4, edge: 5, top: H * 0.45, bottom: H });
    cutout(c, blob(W / 2, H * 0.32, W * 0.44, H * 0.28, 0.1, 6, 11), '#5aa845', { line: 4, edge: 6, top: H * 0.04, bottom: H * 0.6 });
    for (const [x, y] of [
      [0.35, 0.25],
      [0.6, 0.38],
      [0.5, 0.18],
    ]) cutout(c, ellipse(W * x, H * y, 9, 9), '#ff5d5d', { line: 3, edge: 0, grain: 0 });
  }],
  fence: [2, 1, (c, W, H) => {
    for (let k = 0; k < 4; k++) cutout(c, polygon([[k * (W / 4) + 8, H], [k * (W / 4) + 8, H * 0.35], [k * (W / 4) + W / 8, H * 0.22], [k * (W / 4) + W / 4 - 8, H * 0.35], [k * (W / 4) + W / 4 - 8, H]]), '#fff4e0', { line: 3, edge: 0 });
    c.fillStyle = '#e8d8c0';
    c.fillRect(0, H * 0.55, W, 10);
  }],
  gate: [2, 2, (c, W, H) => {
    cutout(c, rounded(8, H * 0.2, 20, H * 0.8, 6), '#fff4e0', { line: 4, edge: 4 });
    cutout(c, rounded(W - 28, H * 0.2, 20, H * 0.8, 6), '#fff4e0', { line: 4, edge: 4 });
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(W / 2, H * 0.32, W / 2 - 18, Math.PI, 0);
    c.stroke();
    cutout(c, ellipse(W / 2, H * 0.12, 14, 14), '#ff5d8f', { line: 3, edge: 3, grain: 0 });
  }],
  sign: [1, 1, (c, W, H) => {
    cutout(c, rounded(W / 2 - 6, H * 0.4, 12, H * 0.6, 4), '#8a5a3a', { line: 3, edge: 3 });
    cutout(c, rounded(8, H * 0.12, W - 16, H * 0.36, 8), '#e3ab6c', { line: 4, edge: 4 });
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(W * 0.35, H * 0.3);
    c.lineTo(W * 0.62, H * 0.3);
    c.lineTo(W * 0.62, H * 0.2);
    c.lineTo(W * 0.78, H * 0.3);
    c.lineTo(W * 0.62, H * 0.4);
    c.lineTo(W * 0.62, H * 0.3);
    c.fill();
  }],
  windmill: [3, 4, (c, W, H) => {
    cutout(c, polygon([[W * 0.3, H], [W * 0.38, H * 0.3], [W * 0.62, H * 0.3], [W * 0.7, H]]), '#fff4e0', { line: 4, edge: 6, top: H * 0.3, bottom: H });
    cutout(c, polygon([[W * 0.34, H * 0.32], [W * 0.5, H * 0.18], [W * 0.66, H * 0.32]]), '#e8453c', { line: 4, edge: 4 });
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(W / 2, H * 0.27);
      c.rotate(k * (Math.PI / 2) + 0.4);
      cutout(c, rounded(-8, -H * 0.27, 16, H * 0.25, 4), '#e3ab6c', { line: 3, edge: 3, grain: 0 });
      c.restore();
    }
    cutout(c, rounded(W * 0.45, H * 0.78, W * 0.1, H * 0.22, [10, 10, 0, 0]), '#8a5a3a', { line: 3, edge: 0 });
  }],
  pot: [2, 1, (c, W, H) => cutout(c, polygon([[W * 0.12, H * 0.25], [W * 0.88, H * 0.25], [W * 0.75, H], [W * 0.25, H]]), '#d9774a', { line: 5, edge: 6, top: H * 0.25, bottom: H })],
  shell: [1, 1, (c, W, H) => cutout(c, (p) => p.ellipse(W / 2, H - 14, 22, 18, 0, Math.PI, 0), '#ffc6d6', { line: 3, edge: 4 })],
  rock: [1, 1, (c, W, H) => cutout(c, blob(W / 2, H - 20, 34, 22, 0.12, 5, 8), '#b8b0a8', { line: 4, edge: 4, top: H - 44, bottom: H })],
  palm: [2, 3, (c, W, H) => {
    cutout(c, (p) => {
      p.moveTo(W / 2 - 10, H);
      p.quadraticCurveTo(W / 2 - 30, H * 0.5, W / 2 + 6, H * 0.2);
      p.lineTo(W / 2 + 18, H * 0.22);
      p.quadraticCurveTo(W / 2 - 10, H * 0.5, W / 2 + 12, H);
      p.closePath();
    }, '#b0784a', { line: 4, edge: 5 });
    for (let k = 0; k < 5; k++) cutout(c, ellipse(W / 2 + 6 + Math.cos(-0.3 - k * 0.7) * 50, H * 0.2 + Math.sin(-0.3 - k * 0.7) * 18, 52, 14, -0.3 - k * 0.7), '#4fb44a', { line: 3, edge: 4, grain: 0 });
  }],
  hut: [3, 2, (c, W, H) => {
    cutout(c, rounded(W * 0.15, H * 0.4, W * 0.7, H * 0.6, 6), '#fff4e0', { line: 4, edge: 5 });
    cutout(c, polygon([[W * 0.05, H * 0.45], [W / 2, H * 0.05], [W * 0.95, H * 0.45]]), '#4aa0d8', { line: 4, edge: 5 });
    cutout(c, rounded(W * 0.42, H * 0.62, W * 0.16, H * 0.38, [12, 12, 0, 0]), '#8a5a3a', { line: 3, edge: 0 });
  }],
  post: [1, 3, (c, W, H) => cutout(c, rounded(W / 2 - 10, 0, 20, H, 6), '#7a5232', { line: 4, edge: 4 })],
  lighthouse: [2, 5, (c, W, H) => {
    cutout(c, polygon([[W * 0.25, H], [W * 0.36, H * 0.22], [W * 0.64, H * 0.22], [W * 0.75, H]]), '#ffffff', { line: 4, edge: 6, top: H * 0.22, bottom: H });
    c.fillStyle = '#e8453c';
    for (const y of [0.4, 0.62, 0.84]) c.fillRect(W * 0.28, H * y, W * 0.44, H * 0.08);
    cutout(c, rounded(W * 0.32, H * 0.1, W * 0.36, H * 0.13, 6), '#ffe066', { line: 4, edge: 4 });
    cutout(c, polygon([[W * 0.28, H * 0.1], [W / 2, 0], [W * 0.72, H * 0.1]]), '#e8453c', { line: 4, edge: 4 });
  }],
  mast: [1, 5, (c, W, H) => cutout(c, rounded(W / 2 - 9, H * 0.05, 18, H * 0.95, 6), '#8a5a3a', { line: 4, edge: 4 })],
  gatehouse: [4, 5, (c, W, H) => {
    cutout(c, rounded(W * 0.05, H * 0.25, W * 0.9, H * 0.75, 4), '#c9c3da', { line: 4, edge: 6, top: H * 0.25, bottom: H });
    for (let k = 0; k < 5; k++) cutout(c, rounded(W * 0.05 + k * W * 0.2, H * 0.17, W * 0.12, H * 0.1, 2), '#c9c3da', { line: 4, edge: 0 });
    cutout(c, rounded(W * 0.3, H * 0.5, W * 0.4, H * 0.5, [W * 0.2, W * 0.2, 0, 0]), '#4a3a5a', { line: 4, edge: 0 });
  }],
  candle: [1, 1, (c, W, H) => {
    cutout(c, rounded(W / 2 - 10, H * 0.45, 20, H * 0.55, 4), '#fff4e0', { line: 3, edge: 3 });
    cutout(c, ellipse(W / 2, H * 0.32, 9, 15), '#ffb020', { line: 3, edge: 0, grain: 0 });
  }],
  banner: [1, 2, (c, W, H) => cutout(c, polygon([[10, 0], [W - 10, 0], [W - 10, H * 0.8], [W / 2, H * 0.65], [10, H * 0.8]]), '#e8453c', { line: 4, edge: 5 })],
  window: [1, 2, (c, W, H) => cutout(c, rounded(W * 0.25, H * 0.2, W * 0.5, H * 0.6, [W * 0.25, W * 0.25, 2, 2]), '#3a3256', { line: 4, edge: 5 })],
  flag: [1, 2, (c, W, H) => {
    cutout(c, rounded(8, 0, 8, H, 3), '#8a5a3a', { line: 3, edge: 3 });
    cutout(c, polygon([[16, 6], [W - 6, H * 0.18], [16, H * 0.34]]), '#ffd23f', { line: 3, edge: 4 });
  }],
  nest: [3, 1, (c, W, H) => cutout(c, (p) => p.ellipse(W / 2, H * 0.7, W * 0.45, H * 0.3, 0, 0, TAU), '#b07a4a', { line: 4, edge: 5 })],
  crater: [2, 1, (c, W, H) => cutout(c, ellipse(W / 2, H - 14, W * 0.4, 10), 'rgba(170,180,230,0.9)', { line: 3, edge: 0, grain: 0 })],
  twinkle: [1, 1, (c, W, H) => cutout(c, starPath(W / 2, H * 0.6, 16, 6, 4, 0), '#fff3a0', { line: 2, edge: 3, grain: 0 })],
  moonhouse: [3, 3, (c, W, H) => {
    cutout(c, (p) => p.ellipse(W / 2, H, W * 0.42, H * 0.6, 0, Math.PI, 0), '#ffe07a', { line: 4, edge: 6 });
    cutout(c, rounded(W * 0.42, H * 0.7, W * 0.16, H * 0.3, [14, 14, 0, 0]), '#8a5a3a', { line: 3, edge: 0 });
    cutout(c, ellipse(W * 0.3, H * 0.62, 12, 12), '#fff8d8', { line: 3, edge: 0 });
  }],
  quill: [1, 5, (c, W, H) => {
    cutout(c, (p) => {
      p.moveTo(W / 2, H);
      p.quadraticCurveTo(W * 0.05, H * 0.45, W / 2, 0);
      p.quadraticCurveTo(W * 0.95, H * 0.45, W / 2, H);
      p.closePath();
    }, '#e9e3f7', { line: 4, edge: 4 });
    c.strokeStyle = '#8a7aa8';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(W / 2, H);
    c.lineTo(W / 2, H * 0.05);
    c.stroke();
  }],
  quilltuft: [1, 1, (c, W, H) => tuft(c, W, H, '#8a78b0')],
  blot: [1, 1, (c, W, H) => cutout(c, blob(W / 2, H - 12, 30, 9, 0.2, 7, 9), '#1d1430', { line: 0, edge: 0, grain: 0, shadeK: 0 })],
  bottle: [2, 3, (c, W, H) => {
    cutout(c, (p) => {
      p.moveTo(W * 0.2, H);
      p.quadraticCurveTo(W * 0.1, H * 0.5, W * 0.38, H * 0.4);
      p.lineTo(W * 0.38, H * 0.15);
      p.lineTo(W * 0.62, H * 0.15);
      p.lineTo(W * 0.62, H * 0.4);
      p.quadraticCurveTo(W * 0.9, H * 0.5, W * 0.8, H);
      p.closePath();
    }, '#3d3260', { line: 4, edge: 6 });
    cutout(c, rounded(W * 0.35, H * 0.08, W * 0.3, H * 0.1, 4), '#a07850', { line: 3, edge: 3 });
  }],
};

function flower(ctx, W, H, col, kind) {
  ctx.strokeStyle = '#3f8a2c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(W / 2, H);
  ctx.quadraticCurveTo(W / 2 - 8, H * 0.7, W / 2, H * 0.45);
  ctx.stroke();
  cutout(ctx, ellipse(W / 2 + 12, H * 0.72, 12, 6, -0.5), '#5bb043', { line: 3, edge: 0, grain: 0 });
  if (kind === 'tulip') cutout(ctx, (p) => {
    p.moveTo(W / 2 - 16, H * 0.3);
    p.lineTo(W / 2 - 8, H * 0.42);
    p.lineTo(W / 2, H * 0.3);
    p.lineTo(W / 2 + 8, H * 0.42);
    p.lineTo(W / 2 + 16, H * 0.3);
    p.quadraticCurveTo(W / 2 + 18, H * 0.55, W / 2, H * 0.55);
    p.quadraticCurveTo(W / 2 - 18, H * 0.55, W / 2 - 16, H * 0.3);
    p.closePath();
  }, col, { line: 3, edge: 4 });
  else {
    cutout(ctx, starPath(W / 2, H * 0.4, 20, 11, 8), col, { line: 3, edge: 4, grain: 0 });
    cutout(ctx, ellipse(W / 2, H * 0.4, 8, 8), '#ffd23f', { line: 2, edge: 0, grain: 0 });
  }
}

function tuft(ctx, W, H, col) {
  cutout(ctx, (p) => {
    p.moveTo(W * 0.2, H);
    p.lineTo(W * 0.3, H * 0.55);
    p.lineTo(W * 0.42, H * 0.85);
    p.lineTo(W * 0.5, H * 0.45);
    p.lineTo(W * 0.6, H * 0.85);
    p.lineTo(W * 0.72, H * 0.58);
    p.lineTo(W * 0.8, H);
    p.closePath();
  }, col, { line: 3, edge: 3, grain: 0 });
}

export { smooth };
