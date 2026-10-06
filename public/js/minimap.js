// The little map in the corner: the island seen from straight above, with
// you, the way you are looking, your friends and the animals. Tapping it
// opens a big map of the whole island.
//
// North is up and east is to the right: a map pixel (x, y) is the world
// column (x, z). Seen from above, that is the 3D view without a mirror, so
// what is on your right on screen is on the right of your view on the map.
import * as B from './shared/blocks.js';
import { CRITTER_INFO } from './shared/critters.js';
import { lookIcon } from './shared/words.js';
import { shirtColor } from './render/avatar.js';

// The most blocks across each map shows; a bigger island scrolls to keep you in view.
const SPAN = { mini: 160, big: 320 };
const SHALLOW = [92, 190, 240];
const SEA = [44, 118, 206];
const INK = '#3d2e4f';
const YOU = '#ffd23f';
const FONT = "Fredoka, ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";
// How far ahead the wedge of what you see reaches, in blocks.
const VIEW = 22;
const DRAW_EVERY = 1 / 30;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;

// Which way an avatar or an animal faces: rotation.y turns its front (+Z) to (sin, cos).
export const facing = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

// Which way the camera looks: it sits at (sin, cos) of its yaw from what it follows.
export const looking = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

// The square of the world a map shows, at most `span` blocks across: all of
// the island when it fits, otherwise the part around `focus`, kept inside it.
export function mapFrame(world, focus, span) {
  const size = Math.min(Math.max(world.W, world.D), span);
  const fit = (extent, at) => (extent <= size ? (extent - size) / 2 : clamp(at - size / 2, 0, extent - size));
  return { x0: fit(world.W, focus.x), z0: fit(world.D, focus.z), size };
}

// The island from above, one pixel per column (rows run along z), kept up
// to date as blocks change. Higher ground facing north is lit and the ground
// just south of something tall is in its shadow, so hills, trees and houses
// stand out; water gets darker as it gets deeper.
export class MapImage {
  constructor(world, tint) {
    this.world = world;
    this.tint = tint;
    const n = world.W * world.D;
    this.rgba = new Uint8ClampedArray(n * 4);
    this.top = new Uint8Array(n); // what you see from above
    this.height = new Int16Array(n);
    this.under = new Uint8Array(n); // what you see through the water
    this.depth = new Uint8Array(n);
    this.dirty = new Uint8Array(n);
    this.queue = [];
    for (let i = 0; i < n; i++) this.measure(i);
    for (let i = 0; i < n; i++) this.paint(i);
  }

  measure(i) {
    const w = this.world;
    const x = i % w.W;
    const z = (i - x) / w.W;
    const base = (x * w.D + z) * w.H;
    const b = w.blocks;
    // Flowers, tufts of grass and treasures are too small to see from up here.
    let y = w.H - 1;
    for (; y >= 0; y--) {
      const kind = B.KIND[b[base + y]];
      if (kind !== B.K_AIR && kind !== B.K_PLANT && kind !== B.K_ITEM) break;
    }
    const id = y >= 0 ? b[base + y] : B.MAGIC_FLOOR;
    let under = id;
    let depth = 0;
    if (id === B.WATER) {
      let floor = y;
      while (floor >= 0 && !B.SOLID[b[base + floor]]) floor--;
      depth = Math.min(255, y - floor);
      under = floor >= 0 ? b[base + floor] : B.MAGIC_FLOOR;
    }
    this.top[i] = id;
    this.height[i] = y;
    this.under[i] = under;
    this.depth[i] = depth;
  }

  paint(i) {
    const { W, sea } = this.world;
    const t = this.tint;
    const o = i * 4;
    const id = this.top[i];
    if (id === B.WATER) {
      const d = this.depth[i];
      const u = this.under[i] * 3;
      const deep = clamp((d - 1) / 7, 0, 1);
      const a = Math.min(0.9, 0.45 + d * 0.09);
      for (let c = 0; c < 3; c++) this.rgba[o + c] = mix(t[u + c], mix(SHALLOW[c], SEA[c], deep), a);
    } else {
      const h = this.height[i];
      const north = i >= W ? this.height[i - W] : h;
      const k = (1 + clamp(h - north, -2, 2) * 0.08) * (0.95 + 0.1 * clamp((h - sea) / 20, 0, 1));
      for (let c = 0; c < 3; c++) this.rgba[o + c] = t[id * 3 + c] * k;
    }
    this.rgba[o + 3] = 255;
  }

  // cells: flat [x, y, z, id...], as the world was just changed.
  cellsChanged(cells) {
    const { W, D } = this.world;
    for (let i = 0; i < cells.length; i += 4) {
      const x = cells[i];
      const z = cells[i + 2];
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      const k = z * W + x;
      if (this.dirty[k]) continue;
      this.dirty[k] = 1;
      this.queue.push(k);
    }
  }

  // Repaints the columns that changed, and the ones just south of them,
  // whose shading looks north. Returns whether anything was repainted.
  flush() {
    const q = this.queue;
    if (!q.length) return false;
    const { W, D } = this.world;
    for (const k of q) this.measure(k);
    for (const k of q) {
      this.paint(k);
      if (k + W < W * D) this.paint(k + W);
      this.dirty[k] = 0;
    }
    q.length = 0;
    return true;
  }

  colorAt(x, z) {
    const o = (z * this.world.W + x) * 4;
    return [this.rgba[o], this.rgba[o + 1], this.rgba[o + 2]];
  }
}

// Draws the little map, and the big one while it is open, a few dozen times a second.
export class MiniMap {
  constructor(canvas, atlas) {
    this.canvas = canvas;
    this.atlas = atlas;
    this.game = null;
    this.image = null;
    this.picture = null;
    this.big = null;
    this.hidden = false;
    this.wait = 0;
    this.clock = 0;
    this.sizes = new WeakMap();
    window.addEventListener('resize', () => this.relayout());
    this.onCells = (e) => this.image?.cellsChanged(e.detail);
    this.onWelcome = () => this.setWorld(this.game.world);
  }

  attach(game) {
    this.detach();
    this.game = game;
    game.addEventListener('cells', this.onCells);
    game.addEventListener('welcome', this.onWelcome);
    this.setWorld(game.world);
    this.relayout();
  }

  detach() {
    this.game?.removeEventListener('cells', this.onCells);
    this.game?.removeEventListener('welcome', this.onWelcome);
    this.game = null;
    this.image = null;
    this.big = null;
  }

  // A new copy of the world (arriving, or arriving again): paint it all.
  setWorld(world) {
    this.image = world ? new MapImage(world, this.atlas.studTint) : null;
    if (!world) return;
    this.picture = document.createElement('canvas');
    this.picture.width = world.W;
    this.picture.height = world.D;
    this.fresh = false;
  }

  // The maps changed size (a resize, or one was just shown): measure them again.
  relayout() {
    this.sizes = new WeakMap();
  }

  frame(dt) {
    this.clock += dt;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = DRAW_EVERY;
    this.draw();
  }

  draw() {
    const g = this.game;
    if (!g?.world || !this.image) return;
    if (this.image.flush() || !this.fresh) {
      this.picture.getContext('2d').putImageData(new ImageData(this.image.rgba, g.world.W, g.world.D), 0, 0);
      this.fresh = true;
    }
    if (!this.hidden) this.paint(this.canvas, false);
    if (this.big && !this.big.isConnected) this.big = null;
    if (this.big) this.paint(this.big, true);
  }

  // CSS pixels across. A hidden map measures zero, and that is never kept.
  measure(canvas) {
    let size = this.sizes.get(canvas);
    if (!size) {
      size = canvas.clientWidth;
      if (size > 0) this.sizes.set(canvas, size);
    }
    return size;
  }

  paint(canvas, big) {
    const css = this.measure(canvas);
    if (!css) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(css * dpr);
    // Setting the size clears the canvas, and everything is drawn again below anyway.
    if (canvas.width !== px) canvas.width = px;
    if (canvas.height !== px) canvas.height = px;
    const ctx = canvas.getContext('2d');
    const g = this.game;
    const w = g.world;
    const me = g.me;
    const f = mapFrame(w, me?.body ?? w.spawn, big ? SPAN.big : SPAN.mini);
    const k = px / f.size;
    const X = (x) => (x - f.x0) * k;
    const Y = (z) => (z - f.z0) * k;
    // One unit of marker size: a CSS pixel on the little map, a bit more on the big one.
    const u = dpr * (big ? 1.6 : 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${SEA})`;
    ctx.fillRect(0, 0, px, px);
    // Whole pixels, so the blocks do not shimmer when the map scrolls.
    ctx.imageSmoothingEnabled = false;
    const left = Math.round(X(0));
    const top = Math.round(Y(0));
    ctx.drawImage(this.picture, left, top, Math.round(X(w.W)) - left, Math.round(Y(w.D)) - top);

    // The way you are looking, as a soft wedge as wide as the screen's view.
    // Yellow like you, because white disappears on snow. (Unlike the other
    // calls here, the gradient throws on a number that is not finite, and a
    // throw would stop every frame of the game, not just the map.)
    if (me && Number.isFinite(me.body.x) && Number.isFinite(me.body.z)) {
      const mx = X(me.body.x);
      const my = Y(me.body.z);
      const cam = g.renderer.camera;
      const look = looking(g.renderer.view.yaw);
      const dir = Math.atan2(look.z, look.x);
      const half = clamp(Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect), 0.2, 1.3);
      const reach = Math.max(VIEW * k, 18 * u);
      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, reach);
      glow.addColorStop(0, 'rgba(255, 214, 64, 0.9)');
      glow.addColorStop(1, 'rgba(255, 214, 64, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, reach, dir - half, dir + half);
      ctx.closePath();
      ctx.fill();
    }

    // The animals: little coral dots here (white ones vanish on snow), their pictures on the big map.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(17 * u)}px ${FONT}`;
    for (const c of g.critters.values()) {
      const p = c.model.group.position;
      const x = X(p.x);
      const y = Y(p.z);
      if (big) {
        ctx.fillText(CRITTER_INFO[c.type]?.icon ?? '🐾', x, y);
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, 2.3 * u, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8a65';
      ctx.fill();
      ctx.lineWidth = 1 * u;
      ctx.strokeStyle = 'rgba(61, 46, 79, 0.8)';
      ctx.stroke();
    }

    // An adventure island's camps: the monsters' purple flag on each, the
    // island's sky-blue one once it is free, and a crown on King Grumble's castle.
    for (const c of g.adventure?.camps.values() ?? []) campMark(ctx, X(c.x), Y(c.z), c, (big ? 1.5 : 1) * u);

    // Friends: a dot in their T-shirt colour, and on the big map their animal (or kid) and name too.
    for (const p of g.players.values()) {
      if (p.me || !p.avatar) continue;
      const pos = p.avatar.root.position;
      const x = X(pos.x);
      const y = Y(pos.z);
      const color = shirtColor(p.look?.shirt);
      const r = (big ? 9 : 4.6) * u;
      ctx.beginPath();
      ctx.arc(x, y, r + 1.4 * u, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(61, 46, 79, 0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = big ? 'white' : color;
      ctx.fill();
      ctx.lineWidth = (big ? 3 : 1.8) * u;
      ctx.strokeStyle = big ? color : 'white';
      ctx.stroke();
      if (big) {
        ctx.font = `${Math.round(11 * u)}px ${FONT}`;
        ctx.fillText(lookIcon(p.look), x, y + 0.5 * u);
        label(ctx, p.name, x, y + r + 9 * u, u);
      }
    }

    // You: a yellow arrow pointing the way you face. The big map makes it pulse, so it is easy to find.
    if (me) {
      const mx = X(me.body.x);
      const my = Y(me.body.z);
      if (big) {
        const t = (this.clock * 0.9) % 1;
        ctx.beginPath();
        ctx.arc(mx, my, (8 + 14 * t) * u, 0, Math.PI * 2);
        ctx.lineWidth = 2.5 * u;
        ctx.strokeStyle = `rgba(255, 210, 63, ${0.9 * (1 - t)})`;
        ctx.stroke();
      }
      const face = facing(me.yaw);
      arrow(ctx, mx, my, Math.atan2(face.z, face.x), (big ? 4.6 : 4.4) * u, u);
    }
  }
}

// A teardrop pointing along `angle`: round at the back and sharp only at the
// front, so there is no mistaking which way it points (a notched arrowhead's
// back corners can be sharper than its tip, and then it reads backwards).
// `size` is the round part's radius.
function arrow(ctx, x, y, angle, size, u) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  // The tip is two radii out, where the sides leave the circle at 60 degrees.
  ctx.moveTo(size * 2, 0);
  ctx.arc(0, 0, size, Math.PI / 3, -Math.PI / 3);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4.2 * u;
  ctx.strokeStyle = 'white';
  ctx.stroke();
  ctx.fillStyle = YOU;
  ctx.fill();
  ctx.lineWidth = 1.6 * u;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

// A camp on the map: a little flag on a pole standing at (x, y), purple for
// the monsters' and sky blue once it is free; the castle with a gold crown
// over its flag. `u` is the marker size unit.
function campMark(ctx, x, y, camp, u) {
  const free = camp.freed;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  // The pole.
  ctx.beginPath();
  ctx.moveTo(0, 2 * u);
  ctx.lineTo(0, -9 * u);
  ctx.lineWidth = 3.4 * u;
  ctx.strokeStyle = 'white';
  ctx.stroke();
  ctx.lineWidth = 1.4 * u;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // The flag.
  ctx.beginPath();
  ctx.moveTo(0.6 * u, -9 * u);
  ctx.lineTo(8 * u, -6.3 * u);
  ctx.lineTo(0.6 * u, -3.6 * u);
  ctx.closePath();
  ctx.fillStyle = free ? '#5cc3f2' : '#7b4fd0';
  ctx.fill();
  ctx.lineWidth = 1.2 * u;
  ctx.strokeStyle = 'white';
  ctx.stroke();
  if (camp.kind === 'castle') {
    // A crown over it.
    ctx.beginPath();
    ctx.moveTo(-4 * u, -11 * u);
    ctx.lineTo(-4 * u, -15 * u);
    ctx.lineTo(-2 * u, -13 * u);
    ctx.lineTo(0, -16 * u);
    ctx.lineTo(2 * u, -13 * u);
    ctx.lineTo(4 * u, -15 * u);
    ctx.lineTo(4 * u, -11 * u);
    ctx.closePath();
    ctx.fillStyle = '#ffcc33';
    ctx.fill();
    ctx.lineWidth = 1 * u;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();
}

// A name in a little white pill, centred on (x, y). (Two half circles and
// the lines between them: older Safari has no roundRect, and a throw here
// would stop every frame.)
function label(ctx, text, x, y, u) {
  ctx.font = `700 ${Math.round(8 * u)}px ${FONT}`;
  const r = 6.5 * u;
  const half = ctx.measureText(text).width / 2 + 4.5 * u - r;
  ctx.beginPath();
  ctx.arc(x - half, y, r, Math.PI / 2, Math.PI * 1.5);
  ctx.arc(x + half, y, r, Math.PI * 1.5, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y + 0.5 * u);
}
