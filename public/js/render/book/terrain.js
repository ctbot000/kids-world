// The ground of a story of the Storybook (shared/book/level.js), painted as
// cut paper: each solid tile drawn as four quarters, each quarter one of a few
// pictures — inside, along an edge, round a corner (rounded) or in a corner
// going in — chosen by which of its neighbours are of the same stuff, so the
// ground comes out as one piece of paper with a grassy (or sandy, or snowy)
// top and a line of ink round it, and no seams. Planks and thorns are pictures
// of their own. All of it painted once on a sheet (paint.js) as the story
// opens, and drawn as a few meshes, a stretch of the page each.
import * as THREE from '../../../vendor/three.module.js';
import { TILE } from '../../shared/book/level.js';
import { hash2 } from '../../shared/rng.js';
import { canvas, cutout, INK, rounded, shade, textureOf } from './paint.js';

const Q = 64;
const N = 16;
const VARIANTS = 3;
const CHUNK = 32;
// How deep the terrain is drawn (behind everyone standing on it).
export const TERRAIN_Z = -0.45;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// The pictures of a story's ground, on one sheet: { texture, quarter(kind,
// case, left, top, variant) → uv, plank(variant) → uv, thorns → uv }.
export function paintTerrain(theme, seed = 1) {
  const c = canvas(Q * N, Q * N);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(Q * N, Q * N);
  const uv = new Map();
  let cell = 0;
  const place = (key, w = 1) => {
    if ((cell % N) + w > N) cell += N - (cell % N);
    const at = { x: (cell % N) * Q, y: Math.floor(cell / N) * Q };
    cell += w;
    const r = { u0: at.x / (Q * N), v0: 1 - (at.y + Q * w) / (Q * N), u1: (at.x + Q * w) / (Q * N), v1: 1 - at.y / (Q * N) };
    uv.set(key, r);
    return at;
  };
  for (const [kind, mat] of [
    [TILE.GROUND, theme.ground],
    [TILE.BLOCK, theme.block],
  ]) {
    for (let v = 0; v < VARIANTS; v++) {
      for (let kase = 0; kase < 5; kase++) {
        for (const left of [true, false]) {
          for (const top of [true, false]) {
            const at = place(`${kind}/${kase}/${left ? 'l' : 'r'}${top ? 't' : 'b'}/${v}`);
            paintQuarter(img, at.x, at.y, mat, kase, left, top, (seed * 31 + v * 7 + kind) >>> 0, v);
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Planks (each a whole tile: two cells by two), and thorns.
  if (cell % N) cell += N - (cell % N);
  const big = (key) => {
    if ((cell % N) + 2 > N) cell += N - (cell % N) + N;
    const at = { x: (cell % N) * Q, y: Math.floor(cell / N) * Q };
    cell += 2;
    if (cell % N === 0) cell += N;
    const s = Q * N;
    uv.set(key, { u0: at.x / s, v0: 1 - (at.y + 2 * Q) / s, u1: (at.x + 2 * Q) / s, v1: 1 - at.y / s });
    return at;
  };
  for (const end of ['m', 'l', 'r', 's']) {
    const at = big(`plank/${end}`);
    ctx.save();
    ctx.translate(at.x, at.y);
    paintPlank(ctx, theme.plank, end);
    ctx.restore();
  }
  const th = big('thorns');
  ctx.save();
  ctx.translate(th.x, th.y);
  paintThorns(ctx, theme);
  ctx.restore();
  return { texture: textureOf(c), uv, canvas: c };
}

// One quarter of a tile of ground (or blocks), painted a pixel at a time into
// img at (ox, oy): kase 0 inside, 1 open above (or below), 2 open to its side,
// 3 open both ways (a corner, rounded), 4 only open on the slant (a corner
// going in); left, top: which quarter.
function paintQuarter(img, ox, oy, mat, kase, left, top, seed, variant) {
  const fill = hex(mat.fill);
  const tops = hex(mat.top);
  const light = hex(mat.topLight);
  const under = hex(mat.under);
  const speck = hex(mat.speck);
  const ink = hex(INK);
  const W = img.width;
  const LINE = 0.04;
  const R = 0.3;
  for (let py = 0; py < Q; py++) {
    for (let px = 0; px < Q; px++) {
      const X = (left ? 0 : 0.5) + (px + 0.5) / (2 * Q);
      const Yt = (top ? 0 : 0.5) + (py + 0.5) / (2 * Q);
      const u = left ? X : 1 - X;
      let v = top ? Yt : 1 - Yt;
      // A puffy top (clouds): round bumps along it, dipping between.
      if (mat.scallop && top && (kase === 1 || kase === 3)) {
        const [amp, n] = mat.scallop;
        const w = ((X * n) % 1) - 0.5;
        v -= amp - amp * Math.sqrt(Math.max(0, 1 - 4 * w * w));
      }
      let d = 9;
      if (kase === 1) d = v;
      else if (kase === 2) d = u;
      else if (kase === 3) d = u < R && v < R ? R - Math.hypot(R - u, R - v) : Math.min(u, v);
      else if (kase === 4) d = Math.hypot(u, v);
      const k = (py * W + px) * 0 + ((oy + py) * W + ox + px) * 4;
      const a = Math.max(0, Math.min(1, d * 2 * Q + 0.5));
      if (a <= 0) {
        img.data[k + 3] = 0;
        continue;
      }
      // How far under an open top (or over an open bottom) it is.
      const exposedTop = top && (kase === 1 || kase === 3 || kase === 4);
      const exposedBottom = !top && (kase === 1 || kase === 3 || kase === 4);
      let col;
      const grass = 0.19 + 0.045 * Math.sin(Math.PI * 4 * X + 1.3) + 0.02 * Math.sin(Math.PI * 10 * X);
      if (d < LINE) col = ink;
      else if (exposedTop && d < grass) col = d < LINE + 0.05 ? light : tops;
      else if (exposedBottom && d < 0.13) col = under;
      else col = patternAt(mat.pattern, X, Yt, fill, speck, under, seed, variant);
      // A little grain, as paper has.
      const g = (hash2(seed, ox + px, oy + py) - 0.5) * 10;
      img.data[k] = clamp(col[0] + g);
      img.data[k + 1] = clamp(col[1] + g);
      img.data[k + 2] = clamp(col[2] + g);
      img.data[k + 3] = Math.round(a * 255);
    }
  }
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// The pattern inside the ground at (X, Yt) of its tile (Yt from its top).
function patternAt(kind, X, Yt, fill, speck, under, seed, variant) {
  switch (kind) {
    case 'pebbles': {
      for (let i = 0; i < 3; i++) {
        const cx = 0.15 + hash2(seed, variant, i) * 0.7;
        const cy = 0.35 + hash2(seed + 5, variant, i) * 0.55;
        const r = 0.05 + hash2(seed + 9, variant, i) * 0.05;
        const dd = Math.hypot((X - cx) * 1.2, Yt - cy);
        if (dd < r) return dd > r - 0.022 ? lerp3(under, fill, 0.2) : speck;
      }
      return fill;
    }
    case 'sand': {
      for (let i = 0; i < 6; i++) {
        const cx = hash2(seed, variant, i);
        const cy = 0.3 + hash2(seed + 3, variant, i) * 0.7;
        if (Math.hypot(X - cx, Yt - cy) < 0.018) return speck;
      }
      return fill;
    }
    case 'planks':
    case 'hull': {
      const row = Yt < 0.5 ? 0 : 1;
      const yy = Yt - row * 0.5;
      if (yy < 0.025 || yy > 0.475) return lerp3(fill, under, 0.7);
      const joint = row ? 0.25 : 0.75;
      if (Math.abs(X - joint) < 0.018) return lerp3(fill, under, 0.7);
      if (kind === 'hull' && Math.hypot(X - joint - 0.07, yy - 0.25) < 0.025) return under;
      // Wood grain.
      const grain = Math.sin((X * 9 + Math.sin(yy * 20 + row * 3) * 0.4) * Math.PI * 2);
      return grain > 0.92 ? lerp3(fill, under, 0.35) : fill;
    }
    case 'bricks': {
      const row = Math.floor(Yt / 0.25);
      const yy = Yt - row * 0.25;
      const off = row % 2 ? 0.25 : 0;
      const xx = (X + off) % 0.5;
      if (yy < 0.02 || xx < 0.02) return lerp3(fill, under, 0.65);
      const k = hash2(seed, row, Math.floor((X + off) / 0.5) + variant * 7) * 0.12;
      return lerp3(fill, speck, k * 4);
    }
    case 'puffs': {
      for (let i = 0; i < 4; i++) {
        const cx = hash2(seed, variant, i);
        const cy = 0.35 + hash2(seed + 2, variant, i) * 0.6;
        const r = 0.12 + hash2(seed + 4, variant, i) * 0.1;
        const dd = Math.hypot(X - cx, Yt - cy);
        if (dd < r) return lerp3(fill, speck, 0.6 * (1 - dd / r));
      }
      return fill;
    }
    case 'cheese': {
      for (let i = 0; i < 2; i++) {
        const cx = 0.2 + hash2(seed, variant, i) * 0.6;
        const cy = 0.35 + hash2(seed + 7, variant, i) * 0.5;
        const r = 0.07 + hash2(seed + 1, variant, i) * 0.09;
        const dd = Math.hypot(X - cx, Yt - cy);
        if (dd < r) return dd < r - 0.025 ? lerp3(under, fill, 0.15) : lerp3(under, speck, 0.4);
      }
      return fill;
    }
    case 'blots': {
      for (let i = 0; i < 3; i++) {
        const cx = hash2(seed, variant, i);
        const cy = 0.3 + hash2(seed + 6, variant, i) * 0.65;
        const r = 0.05 + hash2(seed + 8, variant, i) * 0.08;
        const wob = 1 + 0.25 * Math.sin(Math.atan2(Yt - cy, X - cx) * 5 + i);
        if (Math.hypot(X - cx, Yt - cy) < r * wob) return speck;
      }
      if (hash2(seed + 11, Math.floor(X * 40), Math.floor(Yt * 40) + variant * 99) > 0.997) return [230, 220, 255];
      return fill;
    }
    default:
      return fill;
  }
}

// A plank, a tile wide (end: 'm' joined both sides, 'l' its left end, 'r' its
// right, 's' on its own), board or cloud.
function paintPlank(ctx, p, end) {
  const S = 2 * Q;
  const x0 = end === 'l' || end === 's' ? 6 : -12;
  const x1 = end === 'r' || end === 's' ? S - 6 : S + 12;
  if (p.style === 'cloud') {
    const path = (c) => {
      c.moveTo(x0 + 10, 50);
      for (let k = 0; k <= 4; k++) {
        const x = x0 + 10 + ((x1 - x0 - 20) * k) / 4;
        c.arc(x, 30, 20 + (k % 2) * 6, Math.PI, 0);
      }
      c.lineTo(x1 - 10, 50);
      c.quadraticCurveTo(x1, 50, x1 - 4, 40);
      c.lineTo(x0 + 4, 40);
      c.closePath();
    };
    cutout(ctx, (c) => c.roundRect(x0, 14, x1 - x0, 40, 20), p.fill, { line: 4, edge: 0, top: 10, bottom: 56 });
    cutout(ctx, path, p.light, { line: 0, edge: 0, shadeK: 0, grain: 0.03 });
    return;
  }
  cutout(ctx, rounded(x0, 6, x1 - x0, 44, 10), p.fill, { line: 5, edge: 0, top: 6, bottom: 50 });
  ctx.strokeStyle = shade(p.fill, -0.35);
  ctx.lineWidth = 2;
  for (const y of [21, 35]) {
    ctx.beginPath();
    ctx.moveTo(Math.max(x0 + 10, 0), y);
    ctx.lineTo(Math.min(x1 - 10, S), y);
    ctx.stroke();
  }
  ctx.fillStyle = p.light;
  ctx.fillRect(Math.max(x0 + 8, 0), 10, Math.min(x1 - 8, S) - Math.max(x0 + 8, 0), 5);
  ctx.fillStyle = INK;
  for (const x of [S * 0.25, S * 0.75]) {
    ctx.beginPath();
    ctx.arc(x, 28, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Thorns: a bramble of spikes along the foot of their tile.
function paintThorns(ctx, theme) {
  const S = 2 * Q;
  const dark = theme.night ? '#5a4677' : '#4c7a35';
  const tip = theme.night ? '#c9b8ff' : '#e9f5d0';
  ctx.lineJoin = 'round';
  const path = (c) => {
    c.moveTo(0, S);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * S;
      c.lineTo(x + S / n / 2, S - 70 - (i % 2) * 10);
      c.lineTo(x + S / n, S - 8);
    }
    c.lineTo(S, S);
    c.closePath();
  };
  cutout(ctx, path, dark, { line: 4, edge: 0, top: S - 80, bottom: S });
  ctx.fillStyle = tip;
  for (let i = 0; i < 5; i++) {
    const x = (i / 5) * S + S / 10;
    ctx.beginPath();
    ctx.arc(x, S - 66 - (i % 2) * 10, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------ the meshes

// The ground of a page as meshes, a stretch at a time: { group, dispose }.
export function terrainMeshes(level, theme, seed = 1) {
  const sheet = paintTerrain(theme, seed);
  const mat = new THREE.MeshBasicMaterial({ map: sheet.texture, transparent: true, depthWrite: false, toneMapped: false });
  const group = new THREE.Group();
  group.name = 'book-terrain';
  const same = (kind, i, j) => (j < 0 ? true : level.at(i, j) === kind);
  for (let c0 = 0; c0 < level.w; c0 += CHUNK) {
    const pos = [];
    const uvs = [];
    const quad = (x0, y0, w, h, r) => {
      const z = TERRAIN_Z;
      pos.push(x0, y0, z, x0 + w, y0, z, x0 + w, y0 + h, z, x0, y0, z, x0 + w, y0 + h, z, x0, y0 + h, z);
      uvs.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v0, r.u1, r.v1, r.u0, r.v1);
    };
    for (let i = c0; i < Math.min(level.w, c0 + CHUNK); i++) {
      // Under the foot of the page, the ground goes on down out of sight.
      const foot = level.at(i, 0);
      if (foot === TILE.GROUND || foot === TILE.BLOCK) {
        for (let j = -6; j < 0; j++) {
          const v = Math.floor(hash2(seed, i, j) * VARIANTS);
          for (const left of [true, false]) {
            for (const top of [true, false]) {
              const side = level.at(i + (left ? -1 : 1), 0) !== foot;
              const r = sheet.uv.get(`${foot}/${side ? 2 : 0}/${left ? 'l' : 'r'}${top ? 't' : 'b'}/${v}`);
              quad(i + (left ? 0 : 0.5), j + (top ? 0.5 : 0), 0.5, 0.5, r);
            }
          }
        }
      }
      for (let j = 0; j < level.h; j++) {
        const kind = level.at(i, j);
        if (kind === TILE.GROUND || kind === TILE.BLOCK) {
          const v = Math.floor(hash2(seed, i, j) * VARIANTS);
          for (const left of [true, false]) {
            for (const top of [true, false]) {
              const sx = left ? -1 : 1;
              const sy = top ? 1 : -1;
              const side = !same(kind, i + sx, j);
              const vert = !same(kind, i, j + sy);
              const diag = !same(kind, i + sx, j + sy);
              const kase = side && vert ? 3 : vert ? 1 : side ? 2 : diag ? 4 : 0;
              const r = sheet.uv.get(`${kind}/${kase}/${left ? 'l' : 'r'}${top ? 't' : 'b'}/${v}`);
              quad(i + (left ? 0 : 0.5), j + (top ? 0.5 : 0), 0.5, 0.5, r);
            }
          }
        } else if (kind === TILE.PLANK) {
          const l = level.plank(i - 1, j);
          const r = level.plank(i + 1, j);
          const end = l && r ? 'm' : r ? 'l' : l ? 'r' : 's';
          quad(i, j, 1, 1, sheet.uv.get(`plank/${end}`));
        } else if (kind === TILE.THORNS) quad(i, j, 1, 1, sheet.uv.get('thorns'));
      }
    }
    if (!pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  return {
    group,
    sheet,
    dispose() {
      for (const m of group.children) m.geometry.dispose();
      mat.dispose();
      sheet.texture.dispose();
    },
  };
}
