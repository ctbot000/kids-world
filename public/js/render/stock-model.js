// The stock market's furniture as the real things look (blocks.js
// STOCK_TERMINAL, STOCK_TICKER, BULL_STATUE, BEAR_STATUE), not made of boxes.
//
// - A terminal: a navy kiosk on a plinth, a gold band round it, its screen
//   tilted up at you with the companies' real prices on it, a few at a time
//   (shared/stocks.js), and a little keypad.
// - A ticker: a long dark board hanging on a wall, the real prices scrolling
//   along it from right to left. Every ticker shows the one long strip, each at
//   the part of it its place in the world says, so pieces side by side make one
//   long board and the words carry on across them.
// - The market's statues: a golden bull charging, head down and tail up, and a
//   bronze bear up on its hind legs, one paw raised to swipe. A bull's horns go
//   up and a bear's paw comes down: that is the two kinds of market.
//
// Laid out in a cell's units, the foot in the middle of the floor at the
// origin, facing -z like all furniture; a ticker's back is against the wall at
// +z. The terminal's screen and the ticker's strip are one canvas each, shared
// by all of them and painted again only when the prices change, by a model in
// sight (group.userData.tick, which render/terrain.js calls each frame).
import * as THREE from '../../vendor/three.module.js';
import { BLOCKS } from '../shared/blocks.js';
import { market } from '../market.js';
import { COMPANIES, MINUTE, moodOf, quote, TICK_MS } from '../shared/stocks.js';
import { at, bake, roundedBox } from './gashapon-model.js';

export const STOCK_KINDS = new Set(['stock-terminal', 'stock-ticker', 'bull-statue', 'bear-statue']);

// How each part takes the light: three's physical material settings.
export const STOCK_FINISH = {
  navy: { color: '#2b3a55', roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 0.8 },
  dark: { color: '#20242c', roughness: 0.45, clearcoat: 0.4, envMapIntensity: 0.6 },
  gold: { color: '#efbf4f', metalness: 1, roughness: 0.25, envMapIntensity: 1.25 },
  bronze: { color: '#a8693a', metalness: 1, roughness: 0.38, envMapIntensity: 1.1 },
  pale: { color: '#d9a97a', metalness: 1, roughness: 0.3, envMapIntensity: 1.1 },
  horn: { color: '#fff5dc', roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.9 },
  stone: { color: '#8d8f98', roughness: 0.62, clearcoat: 0.25, envMapIntensity: 0.6 },
  green: { color: '#3fd07c', roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.8 },
  red: { color: '#ef5b5b', roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.8 },
  key: { color: '#d7dde6', roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.8 },
};

// ---------------------------------------------------------------- the canvases

// The strip of prices a ticker shows: a slot for each company, as many blocks
// long in all as TICKER_BLOCKS, scrolling TICKER_SPEED blocks a second. (Three
// makes it smaller for a graphics card that cannot take one so long.)
export const TICKER_W = 8192;
export const TICKER_H = 64;
export const TICKER_BLOCKS = 54;
export const TICKER_SPEED = 0.9;
const SLOT = TICKER_W / COMPANIES.length;

const FONT = "'Fredoka', ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";
const UP = '#4be38a';
const DOWN = '#ff6b6b';
const INK = '#eaf2ff';
const COIN = '#ffd166';

// The move in a price, as it is shown: "1.2%".
const pct = (change) => `${Math.abs(change * 100).toFixed(1)}%`;
// A price in coins, as much as fits: no cents on a big one.
const priced = (coins) => (coins >= 1000 ? Math.round(coins).toLocaleString('en-US') : coins.toFixed(coins >= 100 ? 1 : 2));

// Paints the strip of prices from a snapshot, or while there is none, a word that
// they are on the way.
export function paintTicker(ctx, snapshot) {
  ctx.fillStyle = '#0d1520';
  ctx.fillRect(0, 0, TICKER_W, TICKER_H);
  ctx.textBaseline = 'middle';
  const y = TICKER_H / 2 + 2;
  COMPANIES.forEach((c, i) => {
    const q = quote(snapshot, c.key);
    let x = i * SLOT + 16;
    const put = (text, color, font) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width + 12;
    };
    put(c.icon, INK, `38px ${FONT}`);
    put(c.ticker, INK, `600 38px ${FONT}`);
    if (!q) {
      put('...', '#8fa3bd', `600 38px ${FONT}`);
      return;
    }
    const up = q.change >= 0;
    put(priced(q.coins), COIN, `600 38px ${FONT}`);
    put(`${up ? '▲' : '▼'}${pct(q.change)}`, up ? UP : DOWN, `600 34px ${FONT}`);
  });
}

// The terminal's screen, and how many companies it shows at a time.
export const SCREEN_W = 512;
export const SCREEN_H = 340;
export const SCREEN_ROWS = 8;

// Paints the screen from a snapshot, the companies `page` pages along: how the
// markets are doing along the top, and a row for each company, a faint line of the
// last month of the first of them behind it all.
export function paintTerminal(ctx, snapshot, page = 0) {
  const W = SCREEN_W;
  const H = SCREEN_H;
  ctx.fillStyle = '#0d1520';
  ctx.fillRect(0, 0, W, H);
  const pages = Math.ceil(COMPANIES.length / SCREEN_ROWS);
  const from = ((page % pages) + pages) % pages;
  const shown = COMPANIES.slice(from * SCREEN_ROWS, (from + 1) * SCREEN_ROWS);
  const line = snapshot?.stocks?.[shown[0].key]?.month ?? [];
  if (line.length > 1) {
    const lo = Math.min(...line);
    const hi = Math.max(...line);
    const at = (v) => H - 14 - ((v - lo) / Math.max(1e-6, hi - lo)) * (H - 90);
    ctx.beginPath();
    line.forEach((v, i) => ctx.lineTo((W * i) / (line.length - 1), at(v)));
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(99, 170, 255, 0.34)';
    ctx.stroke();
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 170, 255, 0.1)';
    ctx.fill();
  }
  // The top line.
  const mood = moodOf(snapshot);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('📈 Stocks', 14, 28);
  ctx.textAlign = 'right';
  if (mood) ctx.fillText(mood.icon, W - 14, 28);
  ctx.fillStyle = 'rgba(234, 242, 255, 0.28)';
  ctx.fillRect(14, 50, W - 28, 2);
  // A row for each company.
  const row = (H - 58) / SCREEN_ROWS;
  shown.forEach((c, i) => {
    const q = quote(snapshot, c.key);
    const ry = 58 + row * (i + 0.5);
    ctx.textAlign = 'left';
    ctx.font = `26px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(c.icon, 14, ry);
    ctx.font = `600 27px ${FONT}`;
    ctx.fillText(c.ticker, 56, ry);
    ctx.textAlign = 'right';
    if (!q) {
      ctx.fillStyle = '#8fa3bd';
      ctx.fillText('...', W - 14, ry);
      return;
    }
    const up = q.change >= 0;
    ctx.fillStyle = COIN;
    ctx.fillText(priced(q.coins), 340, ry);
    ctx.fillStyle = up ? UP : DOWN;
    ctx.fillText(`${up ? '▲' : '▼'} ${pct(q.change)}`, W - 14, ry);
  });
}

// A canvas and its texture, painted by `paint` when the prices change. With no
// page (the tests), it stays blank.
function board(w, h, paint, wrap = false) {
  if (typeof document === 'undefined') return { texture: null, update() {} };
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (wrap) texture.wrapS = THREE.RepeatWrapping;
  let tick = null;
  // In sight, it wants prices no older than a few minutes (market.js), and
  // paints them as soon as they come, and at each tick, a screen going on a page.
  const update = () => {
    const now = Math.floor(Date.now() / TICK_MS);
    if (now === tick) return;
    tick = now;
    market.want(5 * MINUTE);
    paint(ctx, market.snapshot, now);
    texture.needsUpdate = true;
  };
  market.addEventListener('change', () => (tick = null));
  update();
  return { texture, update };
}

// The one screen and the one strip, whoever draws them.
let screen = null;
let strip = null;

// Materials for every part, each made by `make` from its settings; and
// the screen and the strip, always bright, as their canvases paint them.
export function stockMaterials(make = (f) => new THREE.MeshPhysicalMaterial({ metalness: 0, ...f })) {
  const out = {};
  for (const [k, f] of Object.entries(STOCK_FINISH)) out[k] = make(f);
  screen ??= board(SCREEN_W, SCREEN_H, paintTerminal);
  strip ??= board(TICKER_W, TICKER_H, paintTicker, true);
  out.screen = new THREE.MeshBasicMaterial({ map: screen.texture, color: screen.texture ? '#ffffff' : '#10202f' });
  out.strip = new THREE.MeshBasicMaterial({ map: strip.texture, color: strip.texture ? '#ffffff' : '#10202f' });
  out.updateScreen = screen.update;
  out.updateStrip = (time) => {
    strip.update();
    if (strip.texture) strip.texture.offset.x = ((time * TICKER_SPEED) / TICKER_BLOCKS) % 1;
  };
  return out;
}

// ---------------------------------------------------------------- shapes

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BALL = new THREE.SphereGeometry(1, 16, 12);
const LOW_BALL = new THREE.SphereGeometry(1, 10, 8);
const ROD = new THREE.CylinderGeometry(1, 1, 1, 12);
const Y = new THREE.Vector3(0, 1, 0);

// A rod with a radius at each end from point a to point b, as one part.
function limb(a, b, r0, r1 = r0) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const dir = to.clone().sub(from);
  const m = new THREE.Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()), new THREE.Vector3(1, dir.length(), 1));
  return { g: new THREE.CylinderGeometry(r1, r0, 1, 12), m };
}
const blob = (x, y, z, rx, ry = rx, rz = rx, rot = [0, 0, 0], g = BALL) => ({ g, m: at(x, y, z, ...rot, rx, ry, rz) });
const brick = (x, y, z, w, h, d, rot = [0, 0, 0]) => ({ g: BOX, m: at(x, y, z, ...rot, w, h, d) });

const baked = (list) => Object.fromEntries(Object.entries(list).map(([k, parts]) => [k, bake(parts.map(({ g, m }) => ({ g, m: m ?? new THREE.Matrix4() })))]));

// The shapes of each, made once and shared by all of them, by name.
const kept = new Map();
const keep = (name, make) => kept.get(name) ?? kept.set(name, make()).get(name);

function add(group, list, materials) {
  for (const [k, g] of Object.entries(list)) {
    const m = new THREE.Mesh(g, materials[k]);
    m.userData.shared = true;
    group.add(m);
  }
}

// The terminal's screen, tilted back to look up at you: where its middle is, and
// how far it leans.
export const SCREEN = { y: 0.76, z: -0.1, tilt: 0.32, w: 0.62, h: 0.41 };

const terminalBody = () =>
  keep('terminal', () => {
    const { y, z, tilt, w, h } = SCREEN;
    const p = { navy: [], dark: [], gold: [], key: [], green: [], red: [] };
    // The plinth, the body, and a gold band round it.
    p.dark.push({ g: roundedBox(0.74, 0.06, 0.66, 0.02), m: at(0, 0.03, 0.03) });
    p.navy.push({ g: roundedBox(0.58, 0.52, 0.46, 0.04), m: at(0, 0.32, 0.08) });
    p.gold.push({ g: roundedBox(0.6, 0.03, 0.48, 0.01), m: at(0, 0.44, 0.08) });
    // The head, tilted back, its screen in a dark frame.
    p.navy.push({ g: roundedBox(w + 0.08, h + 0.08, 0.12, 0.035), m: at(0, y, z + 0.075, tilt) });
    p.dark.push({ g: roundedBox(w + 0.03, h + 0.03, 0.02, 0.01), m: at(0, y - 0.002, z + 0.012, tilt) });
    // Behind the head, down into the body.
    p.navy.push({ g: roundedBox(0.4, 0.3, 0.24, 0.03), m: at(0, 0.62, 0.13, tilt * 0.6) });
    // A shelf of keys under the screen, with a green key on your left and a red
    // one on your right, for buying and selling. (Seen from in front, your left
    // is the layout's +x.)
    p.dark.push({ g: roundedBox(0.5, 0.025, 0.14, 0.008), m: at(0, 0.5, -0.2, -0.35) });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) p.key.push({ g: roundedBox(0.05, 0.016, 0.04, 0.005, 2), m: at(-0.09 + i * 0.06, 0.517 + j * 0.018, -0.228 + j * 0.05, -0.35) });
    }
    p.green.push({ g: roundedBox(0.06, 0.018, 0.09, 0.005, 2), m: at(0.18, 0.527, -0.203, -0.35) });
    p.red.push({ g: roundedBox(0.06, 0.018, 0.09, 0.005, 2), m: at(-0.18, 0.527, -0.203, -0.35) });
    // A green line going up on its front, up to the right as you face it, with
    // an arrowhead at the end.
    const face = -0.155;
    const rising = [[0.2, 0.13], [0.09, 0.22], [0.02, 0.17], [-0.15, 0.31]];
    for (let i = 0; i < rising.length - 1; i++) p.green.push(limb([rising[i][0], rising[i][1], face], [rising[i + 1][0], rising[i + 1][1], face], 0.015));
    const [hx, hy] = rising.at(-1);
    const [px, py] = rising.at(-2);
    // The cone's point up the way the last stretch goes.
    p.green.push({ g: new THREE.ConeGeometry(0.038, 0.07, 10), m: new THREE.Matrix4().compose(new THREE.Vector3(hx, hy, face), new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(hx - px, hy - py, 0).normalize()), new THREE.Vector3(1, 1, 0.4)) });
    return baked(p);
  });

const terminalScreen = () =>
  keep('terminal screen', () => {
    const g = new THREE.PlaneGeometry(SCREEN.w, SCREEN.h);
    // A plane faces +z: turned to face -z, tilted back and into place.
    g.applyMatrix4(at(0, SCREEN.y, SCREEN.z, SCREEN.tilt).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
    return g;
  });

function terminal(materials) {
  const group = new THREE.Group();
  add(group, terminalBody(), materials);
  const screen = new THREE.Mesh(terminalScreen(), materials.screen);
  screen.userData.shared = true;
  group.add(screen);
  group.userData.together = true;
  group.userData.tick = () => materials.updateScreen?.();
  return group;
}

// A ticker's measures: its frame, and its strip in front of the wall.
export const TICKER = { y0: 0.3, y1: 0.76, back: 0.5, front: 0.43, inset: 0.04 };

const tickerFrame = () =>
  keep('ticker frame', () => {
    const { y0, y1, back, front, inset } = TICKER;
    const mid = (back + front) / 2;
    const depth = back - front;
    return baked({
      dark: [brick(0, (y0 + y1) / 2, mid + depth * 0.25, 1, y1 - y0, depth * 0.5), brick(0, y1 - inset / 2, mid, 1, inset, depth), brick(0, y0 + inset / 2, mid, 1, inset, depth)],
      gold: [brick(0, y1 + 0.006, mid - 0.002, 1, 0.012, depth), brick(0, y0 - 0.006, mid - 0.002, 1, 0.012, depth)],
    });
  });

// How far along the world's strip a piece is at cell (x, y, z), block `id`: to
// the viewer's right as blocks in the world, and each row a stretch further on,
// so rows one above the other do not all say the same thing.
export function tickerPlace(x, y, z, id) {
  const front = BLOCKS[id]?.front ?? 3;
  // The direction the piece's front looks in, and the viewer's right, facing it.
  const [fx, fz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][front];
  const [rx, rz] = [fz, -fx];
  return (x + 0.5) * rx + (z + 0.5) * rz + y * 7;
}

// The strip of a ticker at place `along`: its left edge (seen from in front, the
// model's +x) further back along the strip than its right edge.
export function tickerStrip(along) {
  const { y0, y1, front, inset } = TICKER;
  const [a, b] = [(along - 0.5) / TICKER_BLOCKS, (along + 0.5) / TICKER_BLOCKS];
  const g = new THREE.BufferGeometry();
  const [lo, hi] = [y0 + inset, y1 - inset];
  g.setAttribute('position', new THREE.Float32BufferAttribute([0.5, lo, front, -0.5, lo, front, -0.5, hi, front, 0.5, hi, front], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([a, 0, b, 0, b, 1, a, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
  // Wound to face -z.
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeBoundingSphere();
  return g;
}

function ticker(materials, cell) {
  const group = new THREE.Group();
  add(group, tickerFrame(), materials);
  const [x, y, z, id] = cell ?? [0, 0, 0, 0];
  const strip = new THREE.Mesh(tickerStrip(tickerPlace(x, y, z, id)), materials.strip);
  // This one's own, unlike the rest: given back with its chunk.
  group.add(strip);
  group.userData.together = true;
  group.userData.tick = (time) => materials.updateStrip?.(time);
  group.userData.dispose = () => strip.geometry.dispose();
  return group;
}

const plinth = () => ({ stone: [{ g: roundedBox(0.86, 0.1, 0.86, 0.025), m: at(0, 0.05, 0) }] });

// A bull charging at -z, its head down and its tail up.
const bullBody = () =>
  keep('bull', () => {
    const g = [
      // Rump, belly and the great hump of its shoulders.
      blob(0, 0.42, 0.22, 0.17, 0.17, 0.17),
      blob(0, 0.4, 0.04, 0.165, 0.16, 0.26),
      blob(0, 0.46, -0.1, 0.19, 0.2, 0.17),
      blob(0, 0.53, -0.08, 0.13, 0.12, 0.13),
      // Its neck, head and muzzle, low down.
      limb([0, 0.46, -0.14], [0, 0.36, -0.28], 0.13, 0.095),
      blob(0, 0.33, -0.31, 0.095, 0.09, 0.105),
      blob(0, 0.28, -0.39, 0.07, 0.055, 0.06),
      // Its ears.
      blob(-0.105, 0.385, -0.27, 0.045, 0.02, 0.025, [0, 0, 0.5], LOW_BALL),
      blob(0.105, 0.385, -0.27, 0.045, 0.02, 0.025, [0, 0, -0.5], LOW_BALL),
      // Its legs: the front ones stretched out, the back ones pushing off.
      limb([-0.1, 0.36, -0.1], [-0.13, 0.22, -0.2], 0.06, 0.04),
      limb([-0.13, 0.22, -0.2], [-0.12, 0.12, -0.27], 0.04, 0.03),
      limb([0.1, 0.36, -0.08], [0.12, 0.23, -0.1], 0.06, 0.04),
      limb([0.12, 0.23, -0.1], [0.12, 0.12, -0.15], 0.04, 0.03),
      limb([-0.1, 0.38, 0.26], [-0.12, 0.25, 0.3], 0.07, 0.042),
      limb([-0.12, 0.25, 0.3], [-0.12, 0.12, 0.37], 0.042, 0.03),
      limb([0.1, 0.38, 0.24], [0.12, 0.25, 0.26], 0.07, 0.042),
      limb([0.12, 0.25, 0.26], [0.12, 0.12, 0.26], 0.042, 0.03),
      // Its tail, whipped up over its back, with a tuft.
      limb([0, 0.53, 0.34], [0, 0.66, 0.4], 0.018, 0.012),
      limb([0, 0.66, 0.4], [0, 0.76, 0.34], 0.012, 0.009),
      blob(0, 0.79, 0.32, 0.028, 0.038, 0.028, [0.5, 0, 0], LOW_BALL),
    ];
    const dark = [
      // Its hooves, eyes and nostrils.
      ...[[-0.12, -0.28], [0.12, -0.16], [-0.12, 0.38], [0.12, 0.26]].map(([x, z]) => ({ g: ROD, m: at(x, 0.115, z, 0, 0, 0, 0.036, 0.03, 0.036) })),
      blob(-0.07, 0.355, -0.385, 0.014, 0.014, 0.014, undefined, LOW_BALL),
      blob(0.07, 0.355, -0.385, 0.014, 0.014, 0.014, undefined, LOW_BALL),
      blob(-0.03, 0.28, -0.447, 0.011, 0.011, 0.008, undefined, LOW_BALL),
      blob(0.03, 0.28, -0.447, 0.011, 0.011, 0.008, undefined, LOW_BALL),
    ];
    const horn = [];
    for (const s of [-1, 1]) {
      horn.push(limb([s * 0.07, 0.4, -0.3], [s * 0.19, 0.42, -0.32], 0.028, 0.02), limb([s * 0.19, 0.42, -0.32], [s * 0.24, 0.5, -0.37], 0.02, 0.012), limb([s * 0.24, 0.5, -0.37], [s * 0.24, 0.58, -0.42], 0.012, 0.002));
    }
    return baked({ gold: g, dark, horn, ...plinth() });
  });

// A bear up on its hind legs, its right paw raised to swipe at -z.
const bearBody = () =>
  keep('bear', () => {
    const b = [
      // Its round body, and its big feet.
      blob(0, 0.36, 0.05, 0.19, 0.24, 0.17),
      blob(0, 0.56, 0.03, 0.155, 0.15, 0.135),
      blob(-0.11, 0.16, -0.04, 0.085, 0.055, 0.125),
      blob(0.11, 0.16, -0.04, 0.085, 0.055, 0.125),
      limb([-0.1, 0.27, 0.03], [-0.11, 0.17, 0.0], 0.09, 0.075),
      limb([0.1, 0.27, 0.03], [0.11, 0.17, 0.0], 0.09, 0.075),
      // Its head and round ears.
      blob(0, 0.72, -0.02, 0.125, 0.115, 0.115),
      blob(-0.1, 0.815, 0, 0.042, 0.045, 0.024),
      blob(0.1, 0.815, 0, 0.042, 0.045, 0.024),
      // An arm up to swipe, its paw over its head (on the left as you face it),
      // and the other hanging ready, a stubby tail behind.
      limb([0.15, 0.58, 0.02], [0.27, 0.74, -0.04], 0.062, 0.05),
      limb([0.27, 0.74, -0.04], [0.29, 0.88, -0.1], 0.05, 0.045),
      blob(0.29, 0.91, -0.11, 0.058, 0.056, 0.045),
      limb([-0.15, 0.58, 0.02], [-0.23, 0.46, -0.05], 0.062, 0.05),
      limb([-0.23, 0.46, -0.05], [-0.21, 0.36, -0.12], 0.05, 0.045),
      blob(-0.21, 0.34, -0.13, 0.054, 0.05, 0.05),
      blob(0, 0.22, 0.22, 0.04, 0.04, 0.04, undefined, LOW_BALL),
    ];
    const pale = [
      // Its tummy, muzzle and the insides of its ears, a brighter bronze.
      blob(0, 0.35, -0.095, 0.13, 0.18, 0.04),
      blob(0, 0.69, -0.115, 0.06, 0.048, 0.05),
      blob(-0.1, 0.815, -0.018, 0.024, 0.026, 0.012, undefined, LOW_BALL),
      blob(0.1, 0.815, -0.018, 0.024, 0.026, 0.012, undefined, LOW_BALL),
    ];
    const dark = [
      // Its nose and eyes, and claws on the raised paw.
      blob(0, 0.71, -0.16, 0.02, 0.015, 0.012, undefined, LOW_BALL),
      blob(-0.05, 0.75, -0.115, 0.014, 0.014, 0.01, undefined, LOW_BALL),
      blob(0.05, 0.75, -0.115, 0.014, 0.014, 0.01, undefined, LOW_BALL),
      ...[-0.03, 0, 0.03].map((dx) => ({ g: new THREE.ConeGeometry(0.009, 0.03, 6), m: at(0.29 + dx, 0.945, -0.15, -0.9) })),
    ];
    return baked({ bronze: b, pale, dark, ...plinth() });
  });

// The real model of a piece of the stock market. cell: [x, y, z, block], for
// a ticker to find its place in the one long strip.
export function stockModel(materials, kind, cell = null) {
  if (kind === 'stock-terminal') return terminal(materials);
  if (kind === 'stock-ticker') return ticker(materials, cell);
  const group = new THREE.Group();
  add(group, kind === 'bull-statue' ? bullBody() : bearBody(), materials);
  return group;
}
