// Painting the Storybook (Adventure Isle's seventh episode): everything in it
// is drawn on canvases, the way a picture book is, as cut-outs of coloured
// paper — a flat colour, a little grain, a white paper edge and a line of ink
// round it — and handed to the picture as textures (view.js). These are the
// brushes, and the sheets (atlases) the little pictures are packed on to.
import * as THREE from '../../../vendor/three.module.js';
import { hash2 } from '../../shared/rng.js';

export function canvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c;
}

// A texture of a canvas, smooth, and no mipmaps (they would bleed one picture
// of a sheet into the next).
export function textureOf(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = repeat;
  t.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// A colour a little lighter (k > 0) or darker (k < 0): '#rrggbb'.
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function mix(a, b, k) {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export const INK = '#2b2440';
export const PAPER = '#fffaf0';

// A shape (path: draws its outline on ctx, as a path) cut out of paper of
// colour fill: a white paper edge round it, then the colour, a little grain
// and a soft shade along its bottom, and a line of ink round it all. line: how
// thick the ink is (px); edge: how wide the paper border; shadeK: how dark
// the shade at its foot.
export function cutout(ctx, path, fill, { line = 3, edge = 5, ink = INK, shadeK = 0.18, grain = 0.06, top = null, bottom = null } = {}) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (edge > 0) {
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = edge * 2 + line;
    ctx.stroke();
  }
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  // The shade, and the grain, inside the shape only.
  ctx.save();
  ctx.clip();
  if (shadeK > 0 && top !== null && bottom !== null) {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, `rgba(40,20,60,${shadeK})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, ctx.canvas.width, bottom - top);
  }
  if (grain > 0) speckle(ctx, 0, top ?? 0, ctx.canvas.width, (bottom ?? ctx.canvas.height) - (top ?? 0), grain);
  ctx.restore();
  if (line > 0) {
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = ink;
    ctx.lineWidth = line;
    ctx.stroke();
  }
  ctx.restore();
}

// Paper grain: tiny specks lighter and darker, k how strong.
export function speckle(ctx, x, y, w, h, k = 0.06, seed = 7) {
  const n = Math.round((w * h) / 18);
  for (let i = 0; i < n; i++) {
    const u = hash2(seed, i, 1);
    const v = hash2(seed, i, 2);
    const light = hash2(seed, i, 3) < 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${k * 1.4})` : `rgba(40,20,60,${k})`;
    ctx.fillRect(x + u * w, y + v * h, 1.5, 1.5);
  }
}

// ------------------------------------------------ shapes, as paths

export const ellipse = (cx, cy, rx, ry, rot = 0) => (ctx) => ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);

export const rounded = (x, y, w, h, r) => (ctx) => ctx.roundRect(x, y, w, h, r);

// A blob: round, with its edge wobbling a little (wobble, as a share of its
// size), from a seed.
export function blob(cx, cy, rx, ry, wobble = 0.08, seed = 1, n = 9) {
  return (ctx) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + (hash2(seed, i, 5) - 0.5) * 2 * wobble;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    smooth(ctx, pts, true);
  };
}

// A smooth closed (or open) curve through points.
export function smooth(ctx, pts, closed = true) {
  const n = pts.length;
  const at = (i) => pts[((i % n) + n) % n];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) {
    const m0 = mid(at(-1), at(0));
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(at(i), at(i + 1));
      ctx.quadraticCurveTo(at(i)[0], at(i)[1], m[0], m[1]);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

// A star of n points, outer radius r and inner ri, turned rot.
export function starPath(cx, cy, r, ri = r * 0.5, n = 5, rot = -Math.PI / 2) {
  return (ctx) => {
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 ? ri : r;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
}

export function polygon(pts) {
  return (ctx) => {
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
}

// ------------------------------------------------ faces

// A pair of eyes at (x, y), each r round, so far apart, looking dx along (-1
// to 1); mood: 'happy' (plain), 'grump' (brows down), 'sleepy' (lids),
// 'shut' (lines), 'dizzy' (spirals), 'big' (big shiny ones).
export function eyes(ctx, x, y, r, apart, { dx = 0.3, mood = 'happy', ink = INK } = {}) {
  for (const s of [-1, 1]) {
    const ex = x + (s * apart) / 2;
    if (mood === 'shut') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(2, r * 0.35);
      ctx.beginPath();
      ctx.arc(ex, y - r * 0.2, r * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    if (mood === 'dizzy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.5, r * 0.25);
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.3) {
        const rr = (a / (Math.PI * 5)) * r;
        ctx.lineTo(ex + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, y, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(ex + dx * r * 0.35, y + r * 0.1, r * 0.55, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + dx * r * 0.35 - r * 0.2, y - r * 0.15, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    if (mood === 'grump') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(2, r * 0.3);
      ctx.beginPath();
      ctx.moveTo(ex - s * r * 1.1, y - r * 1.5);
      ctx.lineTo(ex + s * r * 0.8, y - r * 0.9);
      ctx.stroke();
    } else if (mood === 'sleepy') {
      ctx.fillStyle = ctx.__skin ?? '#888';
      ctx.beginPath();
      ctx.ellipse(ex, y - r * 0.35, r * 1.08, r * 0.8, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.5, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(ex - r, y - r * 0.3);
      ctx.lineTo(ex + r, y - r * 0.3);
      ctx.stroke();
    }
  }
}

// A mouth at (x, y), w wide: 'smile', 'grin' (open, teeth), 'grump', 'o'.
export function mouth(ctx, x, y, w, kind = 'smile', ink = INK) {
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(2, w * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'smile') {
    ctx.arc(x, y - w * 0.3, w * 0.5, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  } else if (kind === 'grump') {
    ctx.arc(x, y + w * 0.35, w * 0.5, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else if (kind === 'o') {
    ctx.ellipse(x, y, w * 0.22, w * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'grin') {
    ctx.moveTo(x - w / 2, y - w * 0.1);
    ctx.quadraticCurveTo(x, y + w * 0.6, x + w / 2, y - w * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w * 0.3, y - w * 0.08, w * 0.6, w * 0.14);
  }
}

// Rosy cheeks.
export function cheeks(ctx, x, y, apart, r) {
  ctx.fillStyle = 'rgba(255,120,150,0.45)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + (s * apart) / 2, y, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------ sheets

// A sheet of little pictures, each picture as many cells of cell px as it
// needs (w across, h down), packed in rows, each painted by draw(ctx, w, h)
// into its own place (clipped to it, with pad px kept clear round it), and
// where on the sheet it is (uv).
export class Sheet {
  constructor(cell = 128, n = 8, pad = 2) {
    this.cell = cell;
    this.n = n;
    this.pad = pad;
    this.size = cell * n;
    this.c = canvas(this.size, this.size);
    this.ctx = this.c.getContext('2d');
    this.x = 0;
    this.y = 0;
    this.rowH = 0;
    this.rects = new Map();
    this.texture = null;
  }

  // Paints a picture w cells wide and h high under a key: its uv rect
  // { u0, v0, u1, v1, w, h }.
  add(key, draw, w = 1, h = 1) {
    if (this.x + w > this.n) {
      this.x = 0;
      this.y += this.rowH;
      this.rowH = 0;
    }
    if (this.y + h > this.n) throw new Error(`The sheet is full (${key}).`);
    const x = this.x * this.cell;
    const y = this.y * this.cell;
    this.x += w;
    this.rowH = Math.max(this.rowH, h);
    const pw = w * this.cell;
    const ph = h * this.cell;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + this.pad, y + this.pad, pw - 2 * this.pad, ph - 2 * this.pad);
    ctx.clip();
    ctx.translate(x + this.pad, y + this.pad);
    draw(ctx, pw - 2 * this.pad, ph - 2 * this.pad);
    ctx.restore();
    const r = { u0: (x + this.pad) / this.size, v0: 1 - (y + ph - this.pad) / this.size, u1: (x + pw - this.pad) / this.size, v1: 1 - (y + this.pad) / this.size, w, h };
    this.rects.set(key, r);
    return r;
  }

  done() {
    this.texture = textureOf(this.c);
    return this.texture;
  }
}
