// Drawing boards: a whiteboard on a stand (a piece of furniture, blocks.js)
// to draw on together. Walk up to one and its picture opens in a window, a
// grid of PICTURE_W by PICTURE_H dots in a box of crayon colours, to draw on
// with a fingertip or the mouse, fill and wipe clean.
//
// A picture can go into your own gallery, kept with you (profile.js) and,
// with a login, on your other devices too through the keeper (keeper.js),
// to look at again, save as a file, or put up on a board again.
//
// Every stroke goes to the island (room.js), which draws it on its own copy
// of the picture and passes it on, so friends at the same board draw on it
// together and everyone sees it on the board itself. The island keeps the
// pictures when it is saved, and a board picked up takes its picture with it.
//
// No DOM here: the island, the pages and the tests all share it.
import { BLOCKS } from './blocks.js';
import { cellNear } from './arcade.js';
import { furniturePoint } from './furniture.js';
import { base64ToBytes, bytesToBase64 } from './world.js';
import { cleanIslandName } from './words.js';

export const PICTURE_W = 64;
export const PICTURE_H = 48;
const SIZE = PICTURE_W * PICTURE_H;

// The colours, 0 the board's own white (what the eraser draws with).
export const COLORS = [
  { key: 'white', name: 'White', hex: '#fbfbf8' },
  { key: 'black', name: 'Black', hex: '#2c2f36' },
  { key: 'red', name: 'Red', hex: '#e8453c' },
  { key: 'orange', name: 'Orange', hex: '#f59331' },
  { key: 'yellow', name: 'Yellow', hex: '#fcd535' },
  { key: 'green', name: 'Green', hex: '#35a852' },
  { key: 'sky', name: 'Sky Blue', hex: '#5cc8f2' },
  { key: 'blue', name: 'Blue', hex: '#3a73d8' },
  { key: 'purple', name: 'Purple', hex: '#8c5bd6' },
  { key: 'pink', name: 'Pink', hex: '#f47fb8' },
  { key: 'brown', name: 'Brown', hex: '#9a6236' },
  { key: 'grey', name: 'Grey', hex: '#9aa1ab' },
];

// Brush sizes, as the radius in dots of the round brush.
export const BRUSHES = [
  { key: 'thin', name: 'Thin', r: 0 },
  { key: 'medium', name: 'Medium', r: 1 },
  { key: 'thick', name: 'Thick', r: 3 },
];
const MAX_R = 3;

// The most dots one stroke message carries (x, y pairs), and the most
// pictures an island keeps.
export const MAX_POINTS = 64;
export const MAX_PICTURES = 64;

// Whether a block is a drawing board (any way it faces), and whether one is
// a picture frame hung on a wall with a drawing of your own in it (drawing.js).
export const isBoard = (id) => BLOCKS[id]?.model === 'drawing-board';
export const isFrame = (id) => BLOCKS[id]?.model === 'picture-frame';

// Whether a block carries a picture at all: a board to draw on, or a frame
// with a drawing hung in it.
export const isPictureAt = (id) => isBoard(id) || isFrame(id);

// The drawing board nearest a body standing beside it: { x, y, z, key } of
// its cell, or null. So too the picture frame beside you.
export const boardNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isBoard(id) ? {} : null), reach);
export const frameNear = (world, body, reach = 2.2) => cellNear(world, body, (id) => (isFrame(id) ? {} : null), reach);

// Where the picture is on the board, in the model's own layout (facing -z,
// furniture.js): from x0 to x1 across, y0 to y1 up, just in front of the
// board at z. The furniture model draws the board around it.
export const PICTURE_AT = { x0: 0.1, x1: 0.9, y0: 0.58, y1: 1.18, z: 0.468 };

// The picture's corners in the world on the board with block `id` at cell
// (x, y, z): bottom left, bottom right, top right and top left, as you face
// it. Facing the board you look towards its back (+z of its layout), so
// its left is at x1.
export function pictureCorners(id, x, y, z) {
  const { x0, x1, y0, y1, z: pz } = PICTURE_AT;
  return [
    furniturePoint(id, x, y, z, x1, y0, pz),
    furniturePoint(id, x, y, z, x0, y0, pz),
    furniturePoint(id, x, y, z, x0, y1, pz),
    furniturePoint(id, x, y, z, x1, y1, pz),
  ];
}

// Where the drawing hangs in a picture frame, in the model's own layout
// (facing -z, furniture.js): the same shape as a board's picture, over the
// frame's white, just in front of it.
export const FRAME_AT = { x0: 0.18, x1: 0.82, y0: 0.34, y1: 0.82, z: 0.922 };

// The drawing's corners in the world on the frame with block `id` at cell
// (x, y, z), as pictureCorners does for a board.
export function frameCorners(id, x, y, z) {
  const { x0, x1, y0, y1, z: pz } = FRAME_AT;
  return [
    furniturePoint(id, x, y, z, x1, y0, pz),
    furniturePoint(id, x, y, z, x0, y0, pz),
    furniturePoint(id, x, y, z, x0, y1, pz),
    furniturePoint(id, x, y, z, x1, y1, pz),
  ];
}

export const blankPicture = () => new Uint8Array(SIZE);
export const isBlank = (px) => px.every((c) => c === 0);

// ---------------------------------------------------------------- strokes
// A stroke is one of:
//   { k: 'line', c, r, pts: [x0, y0, x1, y1, ...] }  dots joined up with the brush
//   { k: 'fill', c, x, y }                            the patch of one colour round a dot
//   { k: 'clear' }                                    wiped clean
//   { k: 'paste', px }                                a whole picture (as text) put up, from a gallery
// A long line goes as several, each starting where the last left off.

const dotIn = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < PICTURE_W && y < PICTURE_H;
const colorIn = (c) => Number.isInteger(c) && c >= 0 && c < COLORS.length;

// A stroke as it came from a page, checked, or null.
export function cleanStroke(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.k === 'clear') return { k: 'clear' };
  if (s.k === 'paste') return decodePicture(s.px) ? { k: 'paste', px: s.px } : null;
  if (!colorIn(s.c)) return null;
  if (s.k === 'fill') return dotIn(s.x, s.y) ? { k: 'fill', c: s.c, x: s.x, y: s.y } : null;
  if (s.k !== 'line' || !Number.isInteger(s.r) || s.r < 0 || s.r > MAX_R) return null;
  const pts = s.pts;
  if (!Array.isArray(pts) || pts.length < 2 || pts.length % 2 || pts.length > MAX_POINTS * 2) return null;
  for (let i = 0; i < pts.length; i += 2) if (!dotIn(pts[i], pts[i + 1])) return null;
  return { k: 'line', c: s.c, r: s.r, pts: pts.slice() };
}

function dab(px, x, y, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < PICTURE_W && yy < PICTURE_H) px[yy * PICTURE_W + xx] = c;
    }
  }
}

// Draws a (checked) stroke on a picture, the same way on every page and
// the island.
export function applyStroke(px, s) {
  if (s.k === 'clear') {
    px.fill(0);
    return;
  }
  if (s.k === 'paste') {
    px.set(decodePicture(s.px));
    return;
  }
  if (s.k === 'fill') {
    const from = px[s.y * PICTURE_W + s.x];
    if (from === s.c) return;
    const todo = [s.y * PICTURE_W + s.x];
    while (todo.length) {
      const i = todo.pop();
      if (px[i] !== from) continue;
      px[i] = s.c;
      const x = i % PICTURE_W;
      if (x > 0) todo.push(i - 1);
      if (x < PICTURE_W - 1) todo.push(i + 1);
      if (i >= PICTURE_W) todo.push(i - PICTURE_W);
      if (i < SIZE - PICTURE_W) todo.push(i + PICTURE_W);
    }
    return;
  }
  const { pts, r, c } = s;
  dab(px, pts[0], pts[1], r, c);
  for (let i = 2; i < pts.length; i += 2) {
    const [x0, y0, x1, y1] = [pts[i - 2], pts[i - 1], pts[i], pts[i + 1]];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 1; k <= n; k++) dab(px, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), r, c);
  }
}

// ---------------------------------------------------------------- keeping
// A picture as text: runs of one colour as (colour, length) pairs, the
// length as a varint, then base64. A board with a little on it is a few
// dozen characters.

export function encodePicture(px) {
  const out = [];
  for (let i = 0; i < SIZE; ) {
    const c = px[i];
    let run = 1;
    while (i + run < SIZE && px[i + run] === c) run++;
    out.push(c);
    let n = run;
    while (n >= 0x80) {
      out.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    out.push(n);
    i += run;
  }
  return bytesToBase64(Uint8Array.from(out));
}

// A picture from its text, or null when it is not one.
export function decodePicture(text) {
  if (typeof text !== 'string' || text.length > SIZE * 4) return null;
  const bytes = base64ToBytes(text);
  const px = new Uint8Array(SIZE);
  let at = 0;
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    let run = 0;
    let shift = 0;
    for (;;) {
      if (i >= bytes.length || shift > 14) return null;
      const b = bytes[i++];
      run += (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    if (!colorIn(c) || run < 1 || at + run > SIZE) return null;
    px.fill(c, at, at + run);
    at += run;
  }
  return at === SIZE ? px : null;
}

// ---------------------------------------------------------------- galleries
// Your gallery: { items, changedAt }, the pictures newest first, each
// { id, px (as text), at (when it was saved), island (where it was drawn) }.
// A whole gallery of busy pictures still goes to the keeper in one go.
export const GALLERY_MAX = 24;
export const GALLERY_TEXT_MAX = 48_000;

const isPictureId = (v) => typeof v === 'string' && /^[a-z0-9]{6,16}$/.test(v);
const ID_LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const newPictureId = (random = Math.random) => Array.from({ length: 10 }, () => ID_LETTERS[Math.floor(random() * ID_LETTERS.length)]).join('');

// A gallery as it came (from this device or the keeper), checked: only
// pictures, each once, as many as fit.
export function cleanGallery(raw) {
  const items = [];
  const ids = new Set();
  let size = 0;
  for (const it of Array.isArray(raw?.items) ? raw.items.slice(0, GALLERY_MAX) : []) {
    if (!isPictureId(it?.id) || ids.has(it.id) || typeof it.px !== 'string' || size + it.px.length > GALLERY_TEXT_MAX) continue;
    const px = decodePicture(it.px);
    if (!px || isBlank(px)) continue;
    ids.add(it.id);
    size += it.px.length;
    items.push({ id: it.id, px: it.px, at: Number.isFinite(it.at) && it.at > 0 ? it.at : 0, island: cleanIslandName(it.island) || '' });
  }
  return { items, changedAt: Number.isFinite(raw?.changedAt) && raw.changedAt > 0 ? raw.changedAt : 0 };
}

// A picture added to the front of a gallery: { gallery } with it, or
// { why } — 'blank', 'same' (just like the newest one there) or 'full'.
export function addToGallery(gallery, { px, island = '', at = Date.now(), id = newPictureId() }) {
  const g = cleanGallery(gallery);
  if (isBlank(px)) return { why: 'blank' };
  const text = encodePicture(px);
  if (g.items[0]?.px === text) return { why: 'same' };
  const size = g.items.reduce((n, it) => n + it.px.length, 0);
  if (g.items.length >= GALLERY_MAX || size + text.length > GALLERY_TEXT_MAX) return { why: 'full' };
  return { gallery: { items: [{ id, px: text, at, island: cleanIslandName(island) || '' }, ...g.items], changedAt: at } };
}

// A gallery with one picture taken down.
export function removeFromGallery(gallery, id, at = Date.now()) {
  const g = cleanGallery(gallery);
  return { items: g.items.filter((it) => it.id !== id), changedAt: at };
}

// Two galleries as one, newest first (a guest's pictures joining a login's).
export function joinGalleries(a, b) {
  const x = cleanGallery(a);
  const y = cleanGallery(b);
  const seen = new Set(x.items.map((it) => it.id));
  const items = [...x.items, ...y.items.filter((it) => !seen.has(it.id))].sort((p, q) => q.at - p.at);
  return cleanGallery({ items, changedAt: Math.max(x.changedAt, y.changedAt) });
}
