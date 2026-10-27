// The kitchen in a cooking class's window (ui.js cookingDialog): what the
// step is done in — a bowl, a frying pan or a pot on the stove, a baking
// tray (in the oven while it bakes), a chopping board or a plate — seen from
// above, and in it the food as far as the class has got: eggs cracked into
// the bowl, milk rising, a batter stirred smooth, a pancake going golden,
// sauce where you have spread it, vegetables in more and more pieces with
// every chop. Drawn on a 2D canvas KITCHEN_W × KITCHEN_H, from the lesson
// (shared/cooking.js) and the window's own view of your hands:
//   { points, covered (the places rubbed over, rubPoints), spin (radians
//   stirred), pos (where your hand is, or null), tool (what is in it),
//   pour (true while pouring), t (seconds, for things that wobble) }.
import { DARKEST, doneness, GOLDEN, recipeByKey } from '../shared/cooking.js';
import { hash2 } from '../shared/rng.js';

export const KITCHEN_W = 360;
export const KITCHEN_H = 250;
// The middle of the vessel, and how far from it is in it.
export const VESSEL = { x: 180, y: 128, r: 84 };

const TAU = Math.PI * 2;

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => {
  const a = c1.match(/\w\w/g).map((x) => parseInt(x, 16));
  const b = c2.match(/\w\w/g).map((x) => parseInt(x, 16));
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], Math.max(0, Math.min(1, t))))).join(',')})`;
};
// The colour of something on the heat: raw, then golden, then too dark.
const baked = (raw, golden, dark, heat) => (heat <= GOLDEN[0] ? mix(raw, golden, heat / GOLDEN[0]) : heat <= GOLDEN[1] ? golden : mix(golden, dark, (heat - GOLDEN[1]) / (DARKEST - GOLDEN[1])));

const disc = (ctx, x, y, r, fill) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
};
const emoji = (ctx, ch, x, y, size, turn = 0) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 0);
  ctx.restore();
};
const roundRect = (ctx, x, y, w, h, r, fill, stroke) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
};

// Places a little apart, by a seed: where things sit in the vessel.
// r is how far out they go, or [across, up] for an oval.
const spots = (n, seed, r, cx = VESSEL.x, cy = VESSEL.y) =>
  Array.from({ length: n }, (_, i) => {
    const a = hash2(seed, i, 1) * TAU;
    const d = Math.sqrt(hash2(seed, i, 2));
    const [rx, ry] = Array.isArray(r) ? r : [r, r];
    return [cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, hash2(seed, i, 3)];
  });

// The six cookies on the tray.
const COOKIES = [-1, 0, 1].flatMap((i) => [-1, 1].map((j) => [VESSEL.x + i * 64, VESSEL.y + j * 38]));
const SLICE = { x: VESSEL.x - 58, y: VESSEL.y - 58, w: 116, h: 116 };

// Where a rub step has to go over, as points 8 apart: the dough to roll out
// or put sauce and cheese on, the cookies, the vegetables to wash, the
// bread to butter. [] for any other step.
export function rubPoints(recipe, step) {
  const look = recipeByKey(recipe)?.steps[step]?.look;
  if (!look) return [];
  const inside = {
    roll: (x, y) => Math.hypot(x - VESSEL.x, y - VESSEL.y) < 72,
    sauce: (x, y) => Math.hypot(x - VESSEL.x, y - VESSEL.y) < 64,
    cheese: (x, y) => Math.hypot(x - VESSEL.x, y - VESSEL.y) < 64,
    chips: (x, y) => COOKIES.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 22),
    wash: (x, y) => Math.abs(x - VESSEL.x) < 100 && Math.abs(y - VESSEL.y) < 52,
    butter: (x, y) => x > SLICE.x + 4 && x < SLICE.x + SLICE.w - 4 && y > SLICE.y + 4 && y < SLICE.y + SLICE.h - 4,
  }[look];
  const out = [];
  for (let y = 4; y < KITCHEN_H; y += 8) for (let x = 4; x < KITCHEN_W; x += 8) if (inside(x, y)) out.push([x, y]);
  return out;
}

// The vessels, drawn empty.
function vessel(ctx, kind, hot, heat) {
  const { x, y, r } = VESSEL;
  if (kind === 'pan' || kind === 'pot') {
    // The burner under it, glowing while it is on.
    disc(ctx, x, y, r + 22, '#2b2e33');
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8 - k * 4, 0, TAU);
      ctx.strokeStyle = hot ? `rgba(255,${120 + k * 40},40,${0.55 + 0.15 * Math.sin(heat * 20 + k)})` : '#454950';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  if (kind === 'bowl') {
    disc(ctx, x, y + 4, r + 12, 'rgba(0,0,0,0.15)');
    disc(ctx, x, y, r + 12, '#8ec5e8');
    disc(ctx, x, y, r, '#eaf5fc');
  } else if (kind === 'pan') {
    roundRect(ctx, x + r - 4, y - 9, 90, 18, 8, '#3a2a20');
    disc(ctx, x, y, r + 6, '#2f3237');
    disc(ctx, x, y, r, '#4a4e55');
  } else if (kind === 'pot') {
    for (const s of [-1, 1]) roundRect(ctx, x + s * (r + 6) - 14, y - 10, 28, 20, 8, '#777d86');
    disc(ctx, x, y, r + 6, '#aab1ba');
    disc(ctx, x, y, r, '#8a919b');
  } else if (kind === 'tray') {
    roundRect(ctx, x - 125, y - 82, 250, 164, 12, '#9aa1ab', '#6e757f');
    roundRect(ctx, x - 115, y - 72, 230, 144, 8, '#b8bec6');
  } else if (kind === 'board') {
    roundRect(ctx, x - 130, y - 78, 260, 156, 18, '#c99a62', '#9b7243');
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x - 120, y + k * 26);
      ctx.lineTo(x + 120, y + k * 26 + 4);
      ctx.strokeStyle = 'rgba(120,80,40,0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (kind === 'plate') {
    disc(ctx, x, y + 4, r + 10, 'rgba(0,0,0,0.12)');
    disc(ctx, x, y, r + 10, '#ffffff');
    disc(ctx, x, y, r - 8, '#f3f1ec');
  }
}

// An egg cracked: the white, and its yolk.
const egg = (ctx, x, y) => {
  disc(ctx, x, y, 26, 'rgba(255,255,255,0.95)');
  disc(ctx, x + 3, y - 2, 12, '#ffc21a');
};
const flour = (ctx, x, y, s = 1) => {
  disc(ctx, x, y, 22 * s, '#fbf8f0');
  disc(ctx, x - 6 * s, y - 5 * s, 9 * s, '#ffffff');
};
const pour = (ctx, view, colour, into) => {
  if (!view.pour || !view.pos) return;
  ctx.beginPath();
  ctx.moveTo(view.pos.x - 6, view.pos.y + 14);
  ctx.quadraticCurveTo(view.pos.x - 10, (view.pos.y + into) / 2, VESSEL.x + (view.pos.x - VESSEL.x) * 0.4, into);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();
};
// Where the rub has gone, on the points covered.
const rubbed = (view, fn) => {
  view.points?.forEach((p, i) => view.covered?.[i] && fn(p[0], p[1], i));
};
// Where the whole vegetables lie on a board, side by side.
const wholeAt = (list, i) => [VESSEL.x + (i - (list.length - 1) / 2) * 70, VESSEL.y];

// Vegetables, whole or chopped into more and more pieces.
const veggies = (ctx, list, chops, seed, r = 60) => {
  if (!chops) {
    list.forEach((ch, i) => emoji(ctx, ch, ...wholeAt(list, i), 54, (i - 1) * 0.3));
    return;
  }
  const n = list.length * (1 + chops);
  const size = Math.max(16, 50 / Math.sqrt(1 + chops));
  spots(n, seed, r).forEach(([x, y, k], i) => emoji(ctx, list[i % list.length], x, y, size, k * TAU));
};
const bubbles = (ctx, heat, t, r, colour = 'rgba(255,255,255,0.55)') => {
  const n = Math.floor(heat * 10);
  spots(n, 5 + Math.floor(t * 2), r).forEach(([x, y, k]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3 + k * 5, 0, TAU);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
};
// A swirl in a stirred bowl.
const swirl = (ctx, spin, r, colour) => {
  ctx.save();
  ctx.translate(VESSEL.x, VESSEL.y);
  ctx.rotate(spin);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.3 + k * 0.22), k, k + 2.2);
    ctx.stroke();
  }
  ctx.restore();
};

// What is in the vessel, by recipe, at a step with its progress p and heat.
const FOOD = {
  pancakes(ctx, step, p, heat, view) {
    const { x, y } = VESSEL;
    const eggs = step === 0 ? Math.round(p * 2) : 2;
    const milk = step === 1 ? p : step > 1 ? 1 : 0;
    const scoops = step === 2 ? Math.round(p * 2) : step > 2 ? 2 : 0;
    if (step <= 3) {
      const smooth = step === 3 ? p : 0;
      if (milk) disc(ctx, x, y, 30 + 46 * milk, mix('f7f1e1', 'f2d48a', smooth));
      ctx.globalAlpha = 1 - smooth;
      if (eggs >= 1) egg(ctx, x - 26, y - 12);
      if (eggs >= 2) egg(ctx, x + 24, y + 14);
      if (scoops >= 1) flour(ctx, x + 30, y - 30);
      if (scoops >= 2) flour(ctx, x - 30, y + 30);
      ctx.globalAlpha = 1;
      if (step === 3) swirl(ctx, view.spin, 70, 'rgba(200,150,60,0.5)');
      if (step === 1) pour(ctx, view, '#f7f1e1', y);
      return;
    }
    // In the pan: a pancake, browning, bubbles coming up.
    disc(ctx, x, y, 58, baked('f2e2b0', 'e0a040', '6e4119', heat));
    disc(ctx, x - 8, y - 8, 40, baked('f5e8c0', 'e8b45c', '7c4a1e', heat));
    if (heat < GOLDEN[1]) bubbles(ctx, heat, view.t, 46, 'rgba(255,250,230,0.7)');
  },
  pizza(ctx, step, p, heat, view) {
    const { x, y } = VESSEL;
    if (step === 0 && p === 0) return;
    const r = step === 0 ? 26 : step === 1 ? 26 + 46 * p : 72;
    const crust = baked('f0d9a8', 'dfa055', '6b3f17', step === 4 ? heat : 0);
    disc(ctx, x, y, r, crust);
    if (step <= 1) {
      disc(ctx, x - r * 0.2, y - r * 0.2, r * 0.6, 'rgba(255,255,255,0.18)');
      return;
    }
    disc(ctx, x, y, 64, step === 2 ? baked('f6e2b6', 'e8b878', '7a4a1f', 0) : '#d8432c');
    if (step === 2) rubbed(view, (px, py) => disc(ctx, px, py, 7, '#d8432c'));
    const cheese = baked('fff1a8', 'f5c542', 'a86a1c', step === 4 ? heat : 0);
    const shred = (px, py, i) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(hash2(9, i, 0) * TAU);
      roundRect(ctx, -6, -2, 12, 4, 2, cheese);
      ctx.restore();
    };
    if (step === 3) rubbed(view, shred);
    if (step === 4) {
      spots(46, 3, 60).forEach(([px, py], i) => (heat > 0.5 ? disc(ctx, px, py, 9, cheese) : shred(px, py, i)));
      spots(7, 11, 50).forEach(([px, py]) => disc(ctx, px, py, 8, '#b33a2a'));
    }
  },
  salad(ctx, step, p, heat, view) {
    const greens = ['🥬', '🍅', '🥒'];
    if (step === 0) {
      veggies(ctx, greens, 0);
      // Mud on them until it is rubbed off, drops of water where you rub.
      view.points.forEach(([px, py], i) => !view.covered[i] && hash2(4, px, py) < 0.35 && greens.some((_, k) => Math.hypot(px - wholeAt(greens, k)[0], py - wholeAt(greens, k)[1]) < 24) && disc(ctx, px, py, 5, 'rgba(110,75,40,0.8)'));
      if (view.pos && view.down) spots(6, Math.floor(view.t * 10), 18, view.pos.x, view.pos.y).forEach(([px, py]) => disc(ctx, px, py, 3, 'rgba(120,190,255,0.9)'));
      return;
    }
    if (step === 1) {
      veggies(ctx, greens, Math.round(p * 6), 21, [105, 58]);
      return;
    }
    ctx.save();
    ctx.translate(VESSEL.x, VESSEL.y);
    ctx.rotate(step === 3 ? view.spin : 0);
    ctx.translate(-VESSEL.x, -VESSEL.y);
    veggies(ctx, greens, 6, 21, 62);
    ctx.restore();
    const oil = step === 2 ? p : 1;
    spots(Math.round(oil * 16), 8, 56).forEach(([px, py]) => disc(ctx, px, py, 5, 'rgba(214,190,60,0.7)'));
    if (step === 2) pour(ctx, view, 'rgba(214,190,60,0.9)', VESSEL.y);
  },
  cookies(ctx, step, p, heat, view) {
    const { x, y } = VESSEL;
    if (step <= 2) {
      const smooth = step === 2 ? p : 0;
      if (step === 0 && p === 0) return;
      if (step === 2) disc(ctx, x, y, 40 + 20 * smooth, mix('ffe27a', 'e8c89a', smooth));
      ctx.globalAlpha = 1 - smooth;
      roundRect(ctx, x - 22, y - 16, 44, 32, 6, '#ffd84d');
      const scoops = step === 1 ? Math.round(p * 2) : step > 1 ? 2 : 0;
      if (scoops >= 1) flour(ctx, x + 34, y - 24);
      if (scoops >= 2) flour(ctx, x - 34, y + 26);
      ctx.globalAlpha = 1;
      if (step === 2) swirl(ctx, view.spin, 66, 'rgba(160,110,50,0.5)');
      return;
    }
    const dough = baked('ecd3a4', 'd99a4e', '6b3f17', step === 4 ? heat : 0);
    COOKIES.forEach(([cx, cy]) => disc(ctx, cx, cy, step === 4 ? 22 + heat * 4 : 22, dough));
    const chip = (px, py) => disc(ctx, px, py, 3.5, '#4a2a16');
    if (step === 3) rubbed(view, (px, py, i) => i % 2 === 0 && chip(px, py));
    else COOKIES.forEach(([cx, cy], k) => spots(6, 40 + k, 15, cx, cy).forEach(([px, py]) => chip(px, py)));
  },
  soup(ctx, step, p, heat, view) {
    const { x, y } = VESSEL;
    const greens = ['🥕', '🥔'];
    if (step === 0) {
      veggies(ctx, greens, Math.round(p * 6), 31, [105, 58]);
      return;
    }
    const water = step === 1 ? p : 1;
    const hot = step === 2 ? Math.min(1, heat / GOLDEN[0]) : step > 2 ? 1 : 0;
    if (water) disc(ctx, x, y, 30 + 48 * water, mix('8fd0f5', 'f0a858', hot * 0.8));
    veggies(ctx, greens, 6, 31, 58);
    if (step === 1) pour(ctx, view, 'rgba(120,190,255,0.9)', y);
    if (step === 2) bubbles(ctx, heat, view.t, 60);
    const salt = step === 3 ? Math.round(p * 3) : 0;
    spots(salt * 8, 17, 50).forEach(([px, py]) => disc(ctx, px, py, 2, '#ffffff'));
  },
  sandwich(ctx, step, p, heat, view) {
    if (step === 0 && p === 0) return;
    const bread = () => {
      roundRect(ctx, SLICE.x - 6, SLICE.y - 6, SLICE.w + 12, SLICE.h + 12, 18, '#c98a45');
      roundRect(ctx, SLICE.x, SLICE.y, SLICE.w, SLICE.h, 14, '#f6deb0');
    };
    bread();
    if (step === 1) rubbed(view, (px, py) => disc(ctx, px, py, 6, 'rgba(255,220,90,0.8)'));
    if (step >= 2) roundRect(ctx, SLICE.x + 4, SLICE.y + 4, SLICE.w - 8, SLICE.h - 8, 12, 'rgba(255,220,90,0.8)');
    if (step >= 3 || (step === 2 && p >= 1)) {
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * TAU;
        const r = 70 + Math.sin(a * 6) * 8;
        ctx.lineTo(VESSEL.x + Math.cos(a) * r, VESSEL.y + Math.sin(a) * r);
      }
      ctx.fillStyle = '#6cc04a';
      ctx.fill();
    }
    if (step === 4) {
      ctx.save();
      ctx.translate(VESSEL.x, VESSEL.y);
      ctx.rotate(0.2);
      roundRect(ctx, -52, -52, 104, 104, 4, '#ffd23f');
      ctx.restore();
      ctx.globalAlpha = 0.92;
      bread();
      ctx.globalAlpha = 1;
    }
  },
};

// The whole kitchen: the counter, the vessel with the food in it, the oven
// round a tray baking, and what is in your hand.
export function drawKitchen(ctx, lesson, view) {
  ctx.clearRect(0, 0, KITCHEN_W, KITCHEN_H);
  // The counter top, in tiles.
  ctx.fillStyle = '#efe6d6';
  ctx.fillRect(0, 0, KITCHEN_W, KITCHEN_H);
  ctx.strokeStyle = 'rgba(150,130,100,0.18)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= KITCHEN_W; k += 40) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k, KITCHEN_H);
    ctx.stroke();
  }
  for (let k = 0; k <= KITCHEN_H; k += 40) {
    ctx.beginPath();
    ctx.moveTo(0, k);
    ctx.lineTo(KITCHEN_W, k);
    ctx.stroke();
  }
  const recipe = recipeByKey(lesson?.recipe);
  if (!recipe) return;
  const at = Math.min(lesson.step, recipe.steps.length - 1);
  const st = recipe.steps[at];
  const heating = !lesson.done && st.act === 'heat' && lesson.phase === 'work';
  vessel(ctx, st.vessel, heating, view.t);
  const p = lesson.done ? 1 : lesson.progress;
  FOOD[recipe.key](ctx, at, p, lesson.done ? GOLDEN[0] : lesson.heat, view);
  if (st.act === 'heat' && st.vessel === 'tray' && heating) {
    // The oven round it: its door frame and the glow inside.
    ctx.fillStyle = `rgba(255,130,30,${0.12 + 0.05 * Math.sin(view.t * 3)})`;
    ctx.fillRect(0, 0, KITCHEN_W, KITCHEN_H);
    ctx.strokeStyle = '#3b3f46';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, KITCHEN_W - 18, KITCHEN_H - 18);
  }
  if (st.act === 'heat' && heating) {
    // Steam, more of it as it cooks.
    const n = Math.floor(lesson.heat * 4);
    for (let k = 0; k < n; k++) {
      const sx = VESSEL.x - 40 + k * 22;
      const sy = VESSEL.y - 40 - ((view.t * 30 + k * 17) % 50);
      disc(ctx, sx + Math.sin(view.t * 2 + k) * 6, sy, 8, 'rgba(255,255,255,0.35)');
    }
    // How done it is: a gauge along the top, golden in the middle.
    const gx = 40;
    const gw = KITCHEN_W - 80;
    roundRect(ctx, gx, 22, gw, 14, 7, '#f6e7c8', '#8a6a3a');
    ctx.fillStyle = '#ffcf3f';
    ctx.fillRect(gx + (GOLDEN[0] / DARKEST) * gw, 24, ((GOLDEN[1] - GOLDEN[0]) / DARKEST) * gw, 10);
    const mx = gx + (lesson.heat / DARKEST) * gw;
    disc(ctx, mx, 29, 9, { raw: '#f2f2f2', golden: '#ffb000', dark: '#6e4119' }[doneness(lesson.heat)]);
  }
  // What is in your hand, where it is.
  if (view.pos && view.tool) {
    const tilt = view.pour ? -1.1 : view.down && st.act === 'chop' ? 0.5 : 0;
    emoji(ctx, view.tool, view.pos.x, view.pos.y, 44, tilt);
  }
}
