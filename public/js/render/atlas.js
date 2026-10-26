// Every block face, flower and fruit is painted here with Canvas 2D when the
// game starts — no image files. Tiles go into one texture array (one layer
// per tile), and the same paintings make the icons in the toy box.
import { BLOCK_IDS, BLOCKS, GEMS, KIND, K_FURNITURE, K_ITEM, K_PLANT } from '../shared/blocks.js';
import { modelBoxes } from '../shared/furniture.js';

export const TILE = 64;

// A tiny seeded random, so the speckles look the same every time.
function speckleRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const shade = (h, k) => {
  const c = hex(h);
  return rgb(c.map((v) => (k >= 0 ? v + (255 - v) * k : v * (1 + k))));
};

// ---------------------------------------------------------------- building blocks of the paintings

function fill(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE, TILE);
}

// The soft rounded edge that makes a block look like a toy brick.
function bevel(ctx, strength = 1) {
  const e = 5;
  let g = ctx.createLinearGradient(0, 0, 0, e);
  g.addColorStop(0, `rgba(255,255,255,${0.35 * strength})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TILE, e);
  g = ctx.createLinearGradient(0, 0, e, 0);
  g.addColorStop(0, `rgba(255,255,255,${0.25 * strength})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, e, TILE);
  g = ctx.createLinearGradient(0, TILE, 0, TILE - e);
  g.addColorStop(0, `rgba(0,0,0,${0.28 * strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, TILE - e, TILE, e);
  g = ctx.createLinearGradient(TILE, 0, TILE - e, 0);
  g.addColorStop(0, `rgba(0,0,0,${0.2 * strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(TILE - e, 0, e, TILE);
  // A thin seam between neighbouring blocks.
  ctx.strokeStyle = `rgba(0,0,0,${0.16 * strength})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, TILE - 1.5, TILE - 1.5);
}

// The round bump on top of a brick, painted (the 3D studs sit right on it).
function stud(ctx, strength = 1) {
  const c = TILE / 2;
  const r = TILE * 0.25;
  ctx.fillStyle = `rgba(0,0,0,${0.18 * strength})`;
  ctx.beginPath();
  ctx.arc(c + 2.5, c + 3, r, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c - r * 0.35, c - r * 0.35, r * 0.1, c, c, r);
  g.addColorStop(0, `rgba(255,255,255,${0.42 * strength})`);
  g.addColorStop(0.6, `rgba(255,255,255,${0.08 * strength})`);
  g.addColorStop(1, `rgba(0,0,0,${0.08 * strength})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(0,0,0,${0.18 * strength})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function speckles(ctx, seed, colors, count, size = [1.5, 3.5]) {
  const r = speckleRandom(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.beginPath();
    ctx.arc(4 + r() * (TILE - 8), 4 + r() * (TILE - 8), s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function blobs(ctx, seed, color, count, rmin, rmax) {
  const r = speckleRandom(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(r() * TILE, r() * TILE, rmin + r() * (rmax - rmin), 0, Math.PI * 2);
    ctx.fill();
  }
}

function wavyBand(ctx, color, depth, seed) {
  const r = speckleRandom(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(TILE, 0);
  ctx.lineTo(TILE, depth);
  const n = 6;
  for (let i = n; i >= 0; i--) {
    const x = (i / n) * TILE;
    const y = depth + (i % 2 === 0 ? 5 + r() * 5 : -1 - r() * 2);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function outline(ctx, color = 'rgba(40,30,30,0.55)', width = 2.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function star(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function stem(ctx, x0, y0, x1, y1, color = '#3f9a3a', width = 4) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1);
  ctx.stroke();
}

function leaf(ctx, x, y, len, angle, color = '#56b947') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ellipse(ctx, len / 2, 0, len / 2, len / 5);
  ctx.fill();
  outline(ctx, 'rgba(30,70,30,0.45)', 1.5);
  ctx.restore();
}

// A katsura leaf: nearly round, notched into a heart where its stalk joins
// and ending in a small blunt point, its veins fanning out from the notch.
// `size` is its radius; the notch is up before `angle` turns it.
function katsuraLeaf(ctx, x, y, size, angle, color, shadow = 'rgba(60,30,0,0.35)') {
  const s = size;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.bezierCurveTo(-s * 0.35, -s * 1.05, -s * 1.15, -s * 0.8, -s, -s * 0.05);
    ctx.bezierCurveTo(-s * 0.9, s * 0.55, -s * 0.35, s * 0.9, 0, s * 1.08);
    ctx.bezierCurveTo(s * 0.35, s * 0.9, s * 0.9, s * 0.55, s, -s * 0.05);
    ctx.bezierCurveTo(s * 1.15, -s * 0.8, s * 0.35, -s * 1.05, 0, -s * 0.5);
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Its shadow on the leaves under it.
  ctx.save();
  ctx.translate(s * 0.18, s * 0.28);
  shape();
  ctx.fillStyle = shadow;
  ctx.fill();
  ctx.restore();
  shape();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,0,0.22)';
  ctx.lineWidth = Math.max(0.6, s * 0.08);
  ctx.beginPath();
  for (const a of [0, -0.75, 0.75]) {
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(Math.sin(a) * s * 0.8, -s * 0.45 + Math.cos(a) * s * 1.3);
  }
  ctx.stroke();
  ctx.restore();
}

// Something drawn again a tile over wherever it crosses an edge, so the
// painting carries on into the next block's with no seam.
function wrapped(x, y, reach, draw) {
  for (const dx of [-TILE, 0, TILE]) {
    for (const dy of [-TILE, 0, TILE]) {
      if (x + dx > -reach && x + dx < TILE + reach && y + dy > -reach && y + dy < TILE + reach) draw(x + dx, y + dy);
    }
  }
}

// ---------------------------------------------------------------- the farm's paintings
// Crops are painted for planes a block wide, standing crossed in a #
// (render/mesher.js crop): the bottom of the picture is the ground, and only
// as much of it shows as the crop stands tall — a just-planted one, the
// bottom quarter or so — so each stage is painted that high, a couple of
// plants across. Tall corn is the whole picture, stretched up.

// A leaflet without an edge, for feathery and small leaves.
function leaflet(ctx, x, y, len, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ellipse(ctx, len / 2, 0, len / 2, len / 4.5);
  ctx.fill();
  ctx.restore();
}

// A carrot's feathery frond, from (x0, y0) out to (x1, y1).
function frond(ctx, x0, y0, x1, y1, color = '#5cbf46') {
  stem(ctx, x0, y0, x1, y1, color, 2.2);
  const a = Math.atan2(y1 - y0, x1 - x0);
  for (let t = 0.3; t <= 1.001; t += 0.12) {
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const len = 7 - t * 3;
    leaflet(ctx, x, y, len, a - 1, color);
    leaflet(ctx, x, y, len, a + 1, color);
  }
}

// A round leaf on its stalk, its veins drawn in.
function roundLeaf(ctx, x, y, r, color = '#3f9a3a') {
  ctx.fillStyle = color;
  ellipse(ctx, x, y, r, r * 0.86);
  ctx.fill();
  outline(ctx, 'rgba(20,60,20,0.5)', 1.5);
  ctx.strokeStyle = 'rgba(200,240,170,0.45)';
  ctx.lineWidth = 1.2;
  for (const a of [-2.2, -1.57, -0.9]) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.6);
    ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
    ctx.stroke();
  }
}

// A watermelon leaf: deep lobes, three round ones together.
function lobedLeaf(ctx, x, y, r, color = '#2f8a3f') {
  ctx.fillStyle = color;
  for (const [dx, dy, k] of [
    [-r * 0.55, r * 0.1, 0.62],
    [r * 0.55, r * 0.1, 0.62],
    [0, -r * 0.35, 0.7],
  ]) {
    ellipse(ctx, x + dx, y + dy, r * k, r * k * 0.8);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(190,235,160,0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.5);
  ctx.lineTo(x, y - r * 0.8);
  ctx.stroke();
}

// Three round leaflets together, as a strawberry's leaves grow.
function trefoil(ctx, x, y, r, color = '#43a548') {
  for (const a of [-2.4, -1.57, -0.74]) {
    ctx.fillStyle = color;
    ellipse(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.78, r * 0.62, a);
    ctx.fill();
    outline(ctx, 'rgba(20,70,25,0.45)', 1.2);
  }
}

// A little flower of five round petals.
function blossom(ctx, x, y, r, petal = '#ffffff', middle = '#ffd23a') {
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ellipse(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, r * 0.5);
    ctx.fill();
  }
  ctx.fillStyle = middle;
  ellipse(ctx, x, y, r * 0.38, r * 0.38);
  ctx.fill();
}

// A strawberry hanging point down, its seeds and its green cap.
function berry(ctx, x, y, s) {
  ctx.fillStyle = '#e8323e';
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.5);
  ctx.quadraticCurveTo(x - s * 1.05, y + s * 0.5, x, y + s * 1.25);
  ctx.quadraticCurveTo(x + s * 1.05, y + s * 0.5, x + s, y - s * 0.5);
  ctx.quadraticCurveTo(x, y - s * 1.0, x - s, y - s * 0.5);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 'rgba(120,10,20,0.55)', 1.2);
  ctx.fillStyle = '#ffe680';
  for (const [dx, dy] of [
    [-0.45, 0],
    [0.4, 0.05],
    [0, 0.35],
    [-0.2, 0.75],
    [0.25, 0.7],
    [0, -0.25],
  ]) {
    ellipse(ctx, x + dx * s, y + dy * s, Math.max(0.7, s * 0.09), Math.max(0.9, s * 0.13));
    ctx.fill();
  }
  ctx.fillStyle = '#3f9a3a';
  for (const a of [-2.6, -1.57, -0.55]) leaflet(ctx, x, y - s * 0.55, s * 0.9, a, '#3f9a3a');
}

// A round tomato with a highlight and a star of green on top.
function ripeTomato(ctx, x, y, r, color = '#e8382c') {
  ctx.fillStyle = color;
  ellipse(ctx, x, y, r, r * 0.9);
  ctx.fill();
  outline(ctx, 'rgba(110,15,10,0.55)', 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, x - r * 0.4, y - r * 0.3, r * 0.22, r * 0.32, 0.5);
  ctx.fill();
  for (let i = 0; i < 5; i++) leaflet(ctx, x, y - r * 0.82, r * 0.7, (i / 5) * Math.PI * 2, '#3f9a3a');
}

// An ear of corn, sticking out from its stalk: kernels in rows, wrapped at
// the bottom in its husk, a tuft of silk at the tip.
function cob(ctx, x, y, len, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23a';
  ellipse(ctx, 0, -len / 2, len * 0.2, len / 2);
  ctx.fill();
  outline(ctx, 'rgba(150,100,10,0.55)', 1.2);
  ctx.fillStyle = 'rgba(205,150,20,0.55)';
  for (let row = 0; row < 6; row++) {
    for (const k of [-0.45, 0, 0.45]) {
      ellipse(ctx, k * len * 0.2, -len * (0.15 + row * 0.13), len * 0.045, len * 0.035);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#8fcf6a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * len * 0.42, -len * 0.4, s * len * 0.08, -len * 0.62);
    ctx.quadraticCurveTo(s * len * 0.12, -len * 0.3, 0, 0);
    ctx.fill();
  }
  ctx.strokeStyle = '#b5703a';
  ctx.lineWidth = 1.2;
  for (const s of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(s * len * 0.12, -len * 1.18);
    ctx.stroke();
  }
  ctx.restore();
}

// A corn stalk from the ground up to `top`, its long leaves arching out.
function cornStalk(ctx, x, top, leaves) {
  stem(ctx, x, 64, x, top, '#6dab3a', 4.5);
  ctx.strokeStyle = '#5ea338';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  leaves.forEach((y, i) => {
    const s = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 13, y - 10, x + s * 17, y + 3);
    ctx.stroke();
  });
}

// A corn stalk's tassel, a spray of thin lines at its top.
function tassel(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  for (const dx of [-6, -3, 0, 3, 6]) {
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.quadraticCurveTo(x + dx * 0.5, y, x + dx, y - 3 + Math.abs(dx) * 0.5);
    ctx.stroke();
  }
}

// A curly tendril, as vines have.
function tendril(ctx, x, y, s) {
  ctx.strokeStyle = '#5ea338';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3; a += 0.3) {
    const r = s * (1 - a / (Math.PI * 3.4));
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}

// A gourd, round and ribbed (a pumpkin, or a little green one growing).
function gourd(ctx, x, y, rx, ry, color, rib) {
  ctx.fillStyle = color;
  for (const k of [-0.42, 0.42, 0]) {
    ellipse(ctx, x + k * rx, y, rx * (k ? 0.62 : 0.66), ry);
    ctx.fill();
  }
  ctx.strokeStyle = rib;
  ctx.lineWidth = 1.3;
  for (const k of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.ellipse(x + k * rx, y, rx * 0.25, ry * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ellipse(ctx, x, y, rx, ry);
  outline(ctx, 'rgba(90,50,10,0.45)', 1.2);
}

// A watermelon, striped.
function melon(ctx, x, y, rx, ry) {
  ctx.fillStyle = '#7fcf5f';
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#2f7a32';
  ctx.lineWidth = Math.max(1.5, rx * 0.18);
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * rx * 0.4, y - ry);
    ctx.quadraticCurveTo(x + k * rx * 0.48 + 1.5, y, x + k * rx * 0.4, y + ry);
    ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, x, y, rx, ry);
  outline(ctx, 'rgba(20,60,20,0.5)', 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, x - rx * 0.35, y - ry * 0.4, rx * 0.25, ry * 0.18, -0.3);
  ctx.fill();
}

// The ridges of a farmland's furrows, light on top and shaded under.
function furrows(ctx, base, ridge, light, groove) {
  fill(ctx, base);
  for (let i = 0; i < 4; i++) {
    const y = 3 + i * 16;
    ctx.fillStyle = ridge;
    ctx.fillRect(0, y, TILE, 8);
    ctx.fillStyle = light;
    ctx.fillRect(0, y, TILE, 2);
    ctx.fillStyle = groove;
    ctx.fillRect(0, y + 10, TILE, 4);
  }
}

// ---------------------------------------------------------------- the tiles

const PAINT = {
  toy(ctx) {
    fill(ctx, '#ececec');
    bevel(ctx, 1);
  },
  'grass-top'(ctx) {
    fill(ctx, '#7ccb57');
    speckles(ctx, 11, ['#8fd865', '#6bb84a', '#9ade70'], 60, [1.2, 2.6]);
    bevel(ctx, 0.7);
  },
  'grass-side'(ctx) {
    PAINT.dirt(ctx);
    wavyBand(ctx, '#7ccb57', 16, 3);
    speckles(ctx, 12, ['#8fd865'], 6, [1, 2]);
  },
  // The lawn mower's short grass (blocks.js MOWED): the same green cut close,
  // with the pale line the mower leaves along its way.
  'mowed-top'(ctx) {
    fill(ctx, '#6fbf4c');
    speckles(ctx, 16, ['#7ccb57', '#63b043', '#8fd865'], 60, [1.2, 2.6]);
    ctx.fillStyle = 'rgba(158,214,112,0.55)';
    ctx.fillRect(0, TILE / 2 - 3, TILE, 6);
    bevel(ctx, 0.7);
  },
  'mowed-side'(ctx) {
    PAINT.dirt(ctx);
    wavyBand(ctx, '#6fbf4c', 11, 3);
    speckles(ctx, 17, ['#7ccb57'], 6, [1, 2]);
  },
  // The monsters' gloomy ground (shared/adventure.js): dull purple with
  // darker blotches and a few grey wisps.
  'gloom-top'(ctx) {
    fill(ctx, '#6a5487');
    blobs(ctx, 13, 'rgba(60,40,85,0.45)', 10, 3, 7);
    speckles(ctx, 14, ['#7d6699', '#5a4575', '#8e85a0'], 46, [1.2, 2.6]);
    bevel(ctx, 0.7);
  },
  'gloom-side'(ctx) {
    PAINT.dirt(ctx);
    wavyBand(ctx, '#6a5487', 16, 7);
    speckles(ctx, 15, ['#7d6699'], 6, [1, 2]);
  },
  dirt(ctx) {
    fill(ctx, '#a0714a');
    speckles(ctx, 21, ['#8b603c', '#b3845a', '#936741'], 40, [1.5, 3.5]);
    bevel(ctx, 0.7);
  },
  sand(ctx) {
    fill(ctx, '#f4e1a6');
    speckles(ctx, 31, ['#e8d08e', '#fbecc0', '#ead596'], 70, [0.8, 1.8]);
    bevel(ctx, 0.6);
  },
  stone(ctx) {
    fill(ctx, '#aeb3ba');
    blobs(ctx, 41, 'rgba(120,126,136,0.45)', 9, 3, 8);
    blobs(ctx, 42, 'rgba(210,214,220,0.5)', 6, 2, 5);
    bevel(ctx, 0.9);
  },
  snow(ctx) {
    fill(ctx, '#f6f9ff');
    speckles(ctx, 51, ['#e3ecf8', '#ffffff'], 30, [1.5, 3]);
    bevel(ctx, 0.5);
  },
  'snow-side'(ctx) {
    PAINT.dirt(ctx);
    wavyBand(ctx, '#f6f9ff', 18, 5);
  },
  'wood-side'(ctx) {
    fill(ctx, '#8f5f3a');
    ctx.fillStyle = 'rgba(70,40,20,0.35)';
    for (let x = 6; x < TILE; x += 12) ctx.fillRect(x, 0, 3, TILE);
    ctx.fillStyle = 'rgba(255,220,180,0.15)';
    for (let x = 12; x < TILE; x += 12) ctx.fillRect(x, 0, 2, TILE);
    bevel(ctx, 0.6);
  },
  'wood-top'(ctx) {
    fill(ctx, '#dcad73');
    ctx.strokeStyle = 'rgba(140,90,50,0.55)';
    ctx.lineWidth = 2.5;
    for (let r = 6; r < 30; r += 7) {
      ctx.beginPath();
      ctx.arc(TILE / 2, TILE / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8f5f3a';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, TILE - 6, TILE - 6);
  },
  leaves(ctx) {
    fill(ctx, '#4fae45');
    blobs(ctx, 61, '#5fc052', 14, 5, 9);
    blobs(ctx, 62, '#78d268', 9, 3, 6);
    blobs(ctx, 63, 'rgba(40,110,40,0.45)', 8, 2, 4);
    bevel(ctx, 0.5);
  },
  'pine-leaves'(ctx) {
    fill(ctx, '#2e8a4e');
    const r = speckleRandom(71);
    ctx.strokeStyle = '#3fa362';
    ctx.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 4);
      ctx.lineTo(x, y - 3);
      ctx.lineTo(x + 5, y + 4);
      ctx.stroke();
    }
    bevel(ctx, 0.5);
  },
  // A katsura's leaves turned for autumn: little round hearts crowding over
  // each other at every angle, gold and lemon and a few apricot, with the
  // shade of the crown showing between them. The mesher tints each block's
  // corners on top of this, so the crown turns in patches (mesher.js).
  'katsura-leaves'(ctx) {
    fill(ctx, '#9a6a1c');
    const r = speckleRandom(66);
    const colors = ['#f6cf3f', '#f2c033', '#fadc5c', '#eeb42e', '#f4c84a', '#e9a93a', '#f7d86a', '#e39a35'];
    for (let i = 0; i < 74; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const size = 4 + r() * 3.2;
      const angle = r() * Math.PI * 2;
      const color = colors[Math.floor(r() * colors.length)];
      wrapped(x, y, size * 1.6, (wx, wy) => katsuraLeaf(ctx, wx, wy, size, angle, color));
    }
    bevel(ctx, 0.2);
  },
  // Katsura bark: grey-brown, in long shaggy plates between dark furrows,
  // peeling in strips at their edges.
  'katsura-bark'(ctx) {
    fill(ctx, '#7c6c60');
    const r = speckleRandom(67);
    const wave = (x, y, k) => x + Math.sin((y / TILE) * Math.PI * 2 * k[0] + k[1]) * k[2];
    for (let i = 0; i < 10; i++) {
      const x = (i / 10) * TILE + r() * 2;
      const w = 4 + r() * 3;
      const k = [1 + Math.floor(r() * 2), r() * 6, 1 + r() * 1.5];
      ctx.fillStyle = ['#8f7e70', '#998878', '#857568', '#a59585', '#8b7a69'][i % 5];
      for (const dx of [0, TILE]) {
        ctx.beginPath();
        for (let y = 0; y <= TILE; y += 2) ctx.lineTo(wave(x, y, k) - dx, y);
        for (let y = TILE; y >= 0; y -= 2) ctx.lineTo(wave(x + w, y, k) - dx, y);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(40,30,24,0.75)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const x = r() * TILE;
      const k = [1 + Math.floor(r() * 2), r() * 6, 1.5 + r() * 1.5];
      for (const dx of [-TILE, 0, TILE]) {
        ctx.beginPath();
        for (let y = 0; y <= TILE; y += 2) ctx.lineTo(wave(x, y, k) + dx, y);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 16; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const l = 6 + r() * 12;
      wrapped(x, y, 4, (wx, wy) => {
        ctx.fillStyle = 'rgba(48,36,28,0.55)';
        ctx.fillRect(wx + 1.6, wy, 1.2, l);
        ctx.fillStyle = r() < 0.5 ? '#ab9d8e' : '#a39181';
        ctx.fillRect(wx, wy, 1.8, l);
      });
    }
    bevel(ctx, 0.3);
  },
  'snowy-leaves'(ctx) {
    PAINT['pine-leaves'](ctx);
    wavyBand(ctx, '#f6f9ff', 14, 9);
  },
  water(ctx) {
    fill(ctx, '#58bdf0');
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const r = speckleRandom(81);
    for (let i = 0; i < 5; i++) {
      const x = r() * 44 + 4;
      const y = r() * 56 + 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 4, x + 12, y);
      ctx.stroke();
    }
  },
  ice(ctx) {
    fill(ctx, '#c6ecfa');
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 40);
    ctx.lineTo(30, 20);
    ctx.moveTo(24, 50);
    ctx.lineTo(50, 24);
    ctx.stroke();
    bevel(ctx, 0.6);
  },
  // Volcano rock: dark and dusty, with a colder sheen than stone.
  basalt(ctx) {
    fill(ctx, '#585c68');
    blobs(ctx, 44, 'rgba(38,40,50,0.5)', 10, 3, 8);
    blobs(ctx, 45, 'rgba(104,108,124,0.45)', 6, 2, 5);
    speckles(ctx, 46, ['#484c58', '#6b6f7e', '#7d8089'], 34, [1.2, 2.8]);
    bevel(ctx, 0.9);
  },
  // Molten rock: dark crust plates over a bright orange glow, with hot
  // cracks running between them. The lava shader (render/terrain.js) makes
  // it drift and shimmer.
  lava(ctx) {
    fill(ctx, '#e05a1e');
    blobs(ctx, 47, 'rgba(122,30,8,0.55)', 8, 6, 12);
    blobs(ctx, 48, 'rgba(255,170,50,0.6)', 7, 2, 5);
    const r = speckleRandom(49);
    ctx.strokeStyle = 'rgba(255,214,92,0.7)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = r() * 40 + 6;
      const y = r() * 56 + 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (r() - 0.5) * 14, y + r() * 12, x + (r() - 0.5) * 20, y + r() * 20);
      ctx.stroke();
    }
  },
  cloud(ctx) {
    fill(ctx, '#fdfeff');
    blobs(ctx, 91, 'rgba(210,225,245,0.5)', 8, 6, 12);
    blobs(ctx, 92, '#ffffff', 8, 6, 10);
    bevel(ctx, 0.3);
  },
  planks(ctx) {
    fill(ctx, '#d9a45f');
    ctx.fillStyle = 'rgba(120,70,30,0.45)';
    for (let y = 16; y < TILE; y += 16) ctx.fillRect(0, y - 1, TILE, 2.5);
    ctx.fillRect(TILE / 2, 0, 2, 16);
    ctx.fillRect(TILE / 4, 16, 2, 16);
    ctx.fillRect((TILE * 3) / 4, 32, 2, 16);
    ctx.fillRect(TILE / 3, 48, 2, 16);
    ctx.fillStyle = 'rgba(255,230,190,0.35)';
    for (let y = 2; y < TILE; y += 16) ctx.fillRect(0, y, TILE, 2);
    bevel(ctx, 0.8);
  },
  pebbles(ctx) {
    fill(ctx, '#8f949c');
    const r = speckleRandom(101);
    for (let i = 0; i < 12; i++) {
      const x = 6 + r() * 52;
      const y = 6 + r() * 52;
      const s = 6 + r() * 5;
      ctx.fillStyle = ['#b9bec6', '#a6abb3', '#c8ccd2'][i % 3];
      ellipse(ctx, x, y, s, s * 0.8, r() * 3);
      ctx.fill();
      outline(ctx, 'rgba(60,64,72,0.45)', 1.5);
    }
    bevel(ctx, 0.8);
  },
  'brick-wall'(ctx) {
    fill(ctx, '#eadcc8');
    ctx.fillStyle = '#c95f45';
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 0 : -16;
      for (let col = 0; col < 3; col++) {
        const x = off + col * 32 + 2;
        ctx.fillRect(x, row * 16 + 2, 28, 12);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 0 : -16;
      for (let col = 0; col < 3; col++) ctx.fillRect(off + col * 32 + 2, row * 16 + 2, 28, 3);
    }
    bevel(ctx, 0.6);
  },
  glass(ctx) {
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = 'rgba(200,235,255,0.28)';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, TILE - 5, TILE - 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 30);
    ctx.lineTo(30, 14);
    ctx.moveTo(18, 44);
    ctx.lineTo(44, 18);
    ctx.stroke();
  },
  lamp(ctx) {
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 34);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.6, '#ffe383');
    g.addColorStop(1, '#ffc94a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#6e4b2c';
    ctx.lineWidth = 7;
    ctx.strokeRect(3.5, 3.5, TILE - 7, TILE - 7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.lineTo(32, 60);
    ctx.moveTo(4, 32);
    ctx.lineTo(60, 32);
    ctx.stroke();
  },
  'star-block'(ctx) {
    fill(ctx, '#ffcf3f');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 40);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#fffbe8';
    star(ctx, 32, 34, 20, 9);
    ctx.fill();
    outline(ctx, 'rgba(200,130,20,0.6)', 2);
    bevel(ctx, 0.6);
  },
  'hay-top'(ctx) {
    fill(ctx, '#f2cf62');
    ctx.strokeStyle = 'rgba(190,140,40,0.55)';
    ctx.lineWidth = 2;
    const r = speckleRandom(111);
    for (let i = 0; i < 30; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 * (r() - 0.5), y + 8 * (r() - 0.5));
      ctx.stroke();
    }
    bevel(ctx, 0.6);
  },
  'hay-side'(ctx) {
    fill(ctx, '#f2cf62');
    ctx.strokeStyle = 'rgba(190,140,40,0.5)';
    ctx.lineWidth = 2;
    for (let x = 3; x < TILE; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 2, TILE);
      ctx.stroke();
    }
    ctx.fillStyle = '#b5413a';
    ctx.fillRect(0, 20, TILE, 5);
    ctx.fillRect(0, 42, TILE, 5);
    bevel(ctx, 0.6);
  },
  frosting(ctx) {
    fill(ctx, '#f8aacb');
    speckles(ctx, 121, ['#ffffff', '#fff27a', '#8fd3ff', '#a6ec8a', '#ff8a8a'], 22, [1.5, 2.2]);
    bevel(ctx, 0.5);
  },
  'frosting-side'(ctx) {
    PAINT.cookie(ctx);
    wavyBand(ctx, '#f8aacb', 18, 13);
  },
  cookie(ctx) {
    fill(ctx, '#dca468');
    speckles(ctx, 131, ['#6b3f22', '#5a331b'], 10, [2.5, 4]);
    speckles(ctx, 132, ['#e9b97f'], 20, [1, 2]);
    bevel(ctx, 0.7);
  },
  'candy-cane'(ctx) {
    fill(ctx, '#fff7f7');
    ctx.fillStyle = '#e8414e';
    for (let i = -TILE; i < TILE * 2; i += 22) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 11, 0);
      ctx.lineTo(i + 11 - TILE, TILE);
      ctx.lineTo(i - TILE, TILE);
      ctx.closePath();
      ctx.fill();
    }
    bevel(ctx, 0.7);
  },
  chocolate(ctx) {
    fill(ctx, '#7b4b2f');
    ctx.fillStyle = '#8e5a39';
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) ctx.fillRect(x * 32 + 4, y * 32 + 4, 24, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) ctx.fillRect(x * 32 + 4, y * 32 + 4, 24, 4);
    bevel(ctx, 0.7);
  },
  gummy(ctx) {
    fill(ctx, '#7fe08c');
    const g = ctx.createLinearGradient(0, 0, TILE, TILE);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ellipse(ctx, 18, 16, 8, 4, -0.6);
    ctx.fill();
    bevel(ctx, 0.5);
  },
  'cotton-candy'(ctx) {
    fill(ctx, '#ffc4e1');
    blobs(ctx, 141, '#c9e4ff', 7, 6, 11);
    blobs(ctx, 142, '#ffd9ec', 8, 5, 9);
    bevel(ctx, 0.3);
  },
  magic(ctx) {
    fill(ctx, '#5a3f98');
    const r = speckleRandom(151);
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    for (let i = 0; i < 7; i++) {
      star(ctx, 6 + r() * 52, 6 + r() * 52, 3 + r() * 2, 1.4, 4);
      ctx.fill();
    }
    bevel(ctx, 0.8);
  },

  'elevator-top'(ctx) {
    fill(ctx, '#fcd535');
    ctx.fillStyle = '#7d8794';
    ctx.fillRect(6, 6, TILE - 12, TILE - 12);
    ctx.fillStyle = '#aab3bf';
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    // An up arrow over a down arrow.
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(46, 30);
    ctx.lineTo(18, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8453c';
    ctx.beginPath();
    ctx.moveTo(32, 52);
    ctx.lineTo(46, 34);
    ctx.lineTo(18, 34);
    ctx.closePath();
    ctx.fill();
    bevel(ctx, 0.8);
  },
  elevator(ctx) {
    fill(ctx, '#aab3bf');
    // Yellow-and-black warning stripes top and bottom.
    for (const y of [0, TILE - 12]) {
      ctx.fillStyle = '#fcd535';
      ctx.fillRect(0, y, TILE, 12);
      ctx.fillStyle = '#2b2d33';
      for (let x = -12; x < TILE; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x + 8, y);
        ctx.lineTo(x + 16, y);
        ctx.lineTo(x + 8, y + 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Sliding doors.
    ctx.fillStyle = '#c9d0d9';
    ctx.fillRect(10, 16, 21, 32);
    ctx.fillRect(33, 16, 21, 32);
    ctx.fillStyle = '#7d8794';
    ctx.fillRect(31, 16, 2, 32);
    bevel(ctx, 0.6);
  },

  // A black mat in a padded blue rim, with a star to bounce on.
  'trampoline-top'(ctx) {
    fill(ctx, '#3a8ee8');
    ctx.fillStyle = '#2a6fc4';
    ctx.fillRect(8, 8, TILE - 16, TILE - 16);
    ctx.fillStyle = '#272b38';
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 24);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(32, 32, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fcd535';
    star(ctx, 32, 33, 8, 3.5);
    ctx.fill();
    bevel(ctx, 0.7);
  },
  // The padded rim, the springs under it, the frame, and a skirt down to the
  // ground.
  trampoline(ctx) {
    fill(ctx, '#2f7ad6');
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 4; x < TILE; x += 8) ctx.fillRect(x, 34, 2, TILE - 34);
    ctx.fillStyle = '#3b3f4a';
    ctx.fillRect(0, 13, TILE, 13);
    ctx.strokeStyle = '#d5dbe3';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let x = 6; x < TILE; x += 10.4) {
      ctx.beginPath();
      ctx.moveTo(x, 13);
      for (let k = 1; k <= 5; k++) ctx.lineTo(x + (k % 2 ? 2.5 : -2.5), 13 + k * 2.2);
      ctx.lineTo(x, 26);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a8ee8';
    ctx.fillRect(0, 0, TILE, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 3, TILE, 2);
    ctx.fillStyle = '#6b7383';
    ctx.fillRect(0, 26, TILE, 5);
    ctx.fillStyle = '#9aa3b2';
    ctx.fillRect(0, 26, TILE, 1.5);
    // A yellow scalloped trim along the top of the skirt.
    ctx.fillStyle = '#fcd535';
    ctx.fillRect(0, 31, TILE, 3);
    for (let x = 4; x < TILE; x += 8) {
      ctx.beginPath();
      ctx.arc(x, 34, 4, 0, Math.PI);
      ctx.fill();
    }
    bevel(ctx, 0.6);
  },

  // Tent cloth, tinted per block like the toy bricks: a fine weave, soft
  // folds, and a stitched seam down each side of the panel.
  cloth(ctx) {
    fill(ctx, '#f4f2ed');
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    for (let i = 1; i < TILE; i += 3) {
      ctx.fillRect(0, i, TILE, 1);
      ctx.fillRect(i, 0, 1, TILE);
    }
    const g = ctx.createLinearGradient(0, 0, TILE, 0);
    for (const [at, a] of [[0, 0], [0.22, 0.07], [0.42, 0], [0.62, 0.05], [0.82, 0], [1, 0]]) g.addColorStop(at, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(TILE * 0.47, 0, 4, TILE);
    for (const x of [4, TILE - 6]) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(x - 2, 0, 1.5, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = 2; y < TILE; y += 7) ctx.fillRect(x, y, 1.5, 4);
    }
    bevel(ctx, 0.3);
  },

  // ------------------------------------------------ home
  // White with the faintest grain, for furniture to tint any colour.
  plain(ctx) {
    fill(ctx, '#ffffff');
    speckles(ctx, 401, ['rgba(0,0,0,0.035)', 'rgba(255,255,255,0.5)'], 40, [1, 2.5]);
  },
  carpet(ctx) {
    fill(ctx, '#f4f2ed');
    speckles(ctx, 402, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.4)'], 260, [0.8, 1.8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, TILE - 12, TILE - 12);
    bevel(ctx, 0.25);
  },
  parquet(ctx) {
    fill(ctx, '#c98a52');
    // Little planks in a basket weave.
    for (let by = 0; by < 2; by++) {
      for (let bx = 0; bx < 2; bx++) {
        const across = (bx + by) % 2 === 0;
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = ['#d49a62', '#c28349', '#cf9259', '#b97a42'][(k + bx * 2 + by) % 4];
          if (across) ctx.fillRect(bx * 32, by * 32 + k * 8, 32, 8);
          else ctx.fillRect(bx * 32 + k * 8, by * 32, 8, 32);
          ctx.fillStyle = 'rgba(90,50,20,0.35)';
          if (across) ctx.fillRect(bx * 32, by * 32 + k * 8, 32, 1);
          else ctx.fillRect(bx * 32 + k * 8, by * 32, 1, 32);
        }
      }
    }
    bevel(ctx, 0.5);
  },
  // A racing island's track (blocks.js RACE_TRACK): dark grey asphalt,
  // speckled with the little stones in it.
  asphalt(ctx) {
    fill(ctx, '#4f535c');
    speckles(ctx, 31, ['#5d626c', '#454850', '#6a6f78', '#3e4148'], 90, [0.8, 2]);
    bevel(ctx, 0.35);
  },
  checker(ctx) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#3d4a63' : '#f4f1ea';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, TILE, 3);
    bevel(ctx, 0.6);
  },
  'wallpaper-stripes'(ctx) {
    fill(ctx, '#fde3ec');
    for (let x = 0; x < TILE; x += 16) {
      ctx.fillStyle = '#f7b6cd';
      ctx.fillRect(x + 4, 0, 6, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x + 12, 0, 1.5, TILE);
    }
    bevel(ctx, 0.2);
  },
  'wallpaper-flowers'(ctx) {
    fill(ctx, '#fff4cf');
    for (const [x, y, c] of [
      [16, 16, '#f47fb8'],
      [48, 48, '#f47fb8'],
      [48, 16, '#8c5bd6'],
      [16, 48, '#3a73d8'],
    ]) {
      ctx.fillStyle = c;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ellipse(ctx, x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.6, 3.6);
        ctx.fill();
      }
      ctx.fillStyle = '#fcd535';
      ellipse(ctx, x, y, 2.6, 2.6);
      ctx.fill();
    }
    ctx.fillStyle = '#9bd44a';
    for (const [x, y] of [
      [32, 32],
      [0, 32],
      [32, 0],
      [0, 0],
    ]) {
      ellipse(ctx, x + 2, y + 2, 3, 1.6, 0.6);
      ctx.fill();
    }
    bevel(ctx, 0.2);
  },
  'wallpaper-dots'(ctx) {
    fill(ctx, '#d6ecfb');
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        ellipse(ctx, x * 16 + (y % 2 ? 12 : 4), y * 16 + 8, 3.5, 3.5);
        ctx.fill();
      }
    }
    bevel(ctx, 0.2);
  },
  'wallpaper-stars'(ctx) {
    fill(ctx, '#2f3a6b');
    speckles(ctx, 403, ['rgba(255,255,255,0.5)'], 18, [0.6, 1.2]);
    ctx.fillStyle = '#fcd535';
    for (const [x, y, r] of [
      [14, 14, 6],
      [46, 22, 4.5],
      [26, 46, 5],
      [54, 54, 3.5],
    ]) {
      star(ctx, x, y, r, r * 0.45);
      ctx.fill();
    }
    bevel(ctx, 0.2);
  },

  // ------------------------------------------------ plants (transparent)
  tulip(ctx) {
    stem(ctx, 32, 62, 32, 26);
    leaf(ctx, 32, 50, 18, -0.9);
    leaf(ctx, 33, 44, 16, -2.3);
    ctx.fillStyle = '#ef4a5a';
    ctx.beginPath();
    ctx.moveTo(20, 16);
    ctx.lineTo(26, 24);
    ctx.lineTo(32, 12);
    ctx.lineTo(38, 24);
    ctx.lineTo(44, 16);
    ctx.lineTo(43, 26);
    ctx.quadraticCurveTo(32, 40, 21, 26);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(120,20,40,0.55)', 2);
  },
  daisy(ctx) {
    stem(ctx, 32, 62, 32, 30);
    leaf(ctx, 32, 52, 16, -0.7);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ellipse(ctx, 32 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 7, 4, a);
      ctx.fill();
      outline(ctx, 'rgba(120,120,140,0.5)', 1.5);
    }
    ctx.fillStyle = '#ffcd3c';
    ellipse(ctx, 32, 22, 6.5, 6.5);
    ctx.fill();
    outline(ctx, 'rgba(160,110,20,0.6)', 1.5);
  },
  bluebell(ctx) {
    stem(ctx, 30, 62, 34, 14, '#3f9a3a', 3.5);
    leaf(ctx, 31, 52, 18, -2.5);
    for (const [x, y] of [
      [22, 22],
      [40, 30],
      [24, 40],
    ]) {
      ctx.fillStyle = '#5b86ea';
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 8);
      ctx.quadraticCurveTo(x - 7, y - 6, x, y - 6);
      ctx.quadraticCurveTo(x + 7, y - 6, x + 7, y + 8);
      ctx.lineTo(x + 4, y + 5);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 4, y + 5);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 'rgba(30,40,110,0.55)', 1.5);
    }
  },
  cosmos(ctx) {
    stem(ctx, 32, 62, 32, 28);
    leaf(ctx, 32, 48, 14, -2.4);
    ctx.fillStyle = '#ff8fc4';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ellipse(ctx, 32 + Math.cos(a) * 9, 22 + Math.sin(a) * 9, 8, 6, a);
      ctx.fill();
      outline(ctx, 'rgba(150,40,90,0.5)', 1.5);
    }
    ctx.fillStyle = '#ffe066';
    ellipse(ctx, 32, 22, 5, 5);
    ctx.fill();
  },
  sunflower(ctx) {
    stem(ctx, 32, 62, 32, 30, '#3f9a3a', 5);
    leaf(ctx, 32, 50, 18, -0.6);
    leaf(ctx, 32, 44, 18, -2.5);
    ctx.fillStyle = '#ffcf26';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ellipse(ctx, 32 + Math.cos(a) * 14, 22 + Math.sin(a) * 14, 7, 3.5, a);
      ctx.fill();
    }
    ctx.fillStyle = '#8a5424';
    ellipse(ctx, 32, 22, 9, 9);
    ctx.fill();
    outline(ctx, 'rgba(80,40,10,0.6)', 2);
    speckles(ctx, 161, ['#6d3f18'], 0);
  },
  'tall-grass'(ctx) {
    ctx.strokeStyle = '#5cbf46';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const r = speckleRandom(171);
    for (let i = 0; i < 9; i++) {
      const x = 10 + i * 5.5;
      ctx.strokeStyle = i % 2 ? '#6fcf55' : '#4fae3e';
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.quadraticCurveTo(x + (r() - 0.5) * 14, 44, x + (r() - 0.5) * 20, 26 + r() * 14);
      ctx.stroke();
    }
  },
  mushroom(ctx) {
    ctx.fillStyle = '#fbf2dc';
    ctx.beginPath();
    ctx.roundRect(25, 36, 14, 26, 6);
    ctx.fill();
    outline(ctx, 'rgba(120,100,70,0.5)', 1.5);
    ctx.fillStyle = '#e8453c';
    ctx.beginPath();
    ctx.moveTo(10, 40);
    ctx.quadraticCurveTo(12, 14, 32, 14);
    ctx.quadraticCurveTo(52, 14, 54, 40);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(120,20,20,0.55)', 2);
    ctx.fillStyle = '#ffffff';
    for (const [x, y, s] of [
      [22, 28, 4],
      [36, 22, 5],
      [44, 33, 3.5],
      [30, 35, 3],
    ]) {
      ellipse(ctx, x, y, s, s);
      ctx.fill();
    }
  },
  sprout(ctx) {
    ctx.fillStyle = '#8b5a3c';
    ellipse(ctx, 32, 60, 12, 4);
    ctx.fill();
    stem(ctx, 32, 60, 32, 36, '#4fae3e', 4);
    leaf(ctx, 32, 38, 18, -0.5, '#6fcf55');
    leaf(ctx, 32, 38, 18, -2.6, '#6fcf55');
  },
  'pine-sprout'(ctx) {
    ctx.fillStyle = '#8b5a3c';
    ellipse(ctx, 32, 60, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#2e8a4e';
    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 9;
      ctx.beginPath();
      ctx.moveTo(32, y - 12);
      ctx.lineTo(44 + i * 2, y + 4);
      ctx.lineTo(20 - i * 2, y + 4);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 'rgba(20,60,30,0.5)', 1.5);
    }
  },
  // A katsura seedling: a thin red stalk with its little round leaves in
  // pairs on long red stems, green with a red blush, one gone yellow.
  'katsura-sprout'(ctx) {
    ctx.fillStyle = '#8b5a3c';
    ellipse(ctx, 32, 60, 12, 4);
    ctx.fill();
    stem(ctx, 32, 60, 32, 24, '#9c3b2e', 2.5);
    for (const [y, side, len, size, color] of [
      [44, -1, 11, 6.5, '#7fb446'],
      [44, 1, 11, 6.5, '#e2c03c'],
      [31, -1, 8, 5.5, '#8cc152'],
      [31, 1, 8, 5.5, '#86bb4c'],
      [22, 0, 0, 4.5, '#b4a24a'],
    ]) {
      const x = 32 + side * len;
      stem(ctx, 32, y, x, y - 3, '#9c3b2e', 1.5);
      katsuraLeaf(ctx, x, y - 3 - size * 0.3, size, side * 0.9 + Math.PI, color, 'rgba(0,0,0,0)');
    }
  },
  'candy-sprout'(ctx) {
    ctx.fillStyle = '#8b5a3c';
    ellipse(ctx, 32, 60, 12, 4);
    ctx.fill();
    stem(ctx, 32, 60, 32, 34, '#ffffff', 4);
    ctx.fillStyle = '#ff9fcf';
    ellipse(ctx, 32, 28, 10, 10);
    ctx.fill();
    outline(ctx, 'rgba(160,50,100,0.5)', 2);
  },
  gumdrop(ctx) {
    const colors = ['#ff6b8a', '#7fe08c', '#ffd24a'];
    colors.forEach((c, i) => {
      const x = 16 + i * 16;
      const y = 50 - (i % 2) * 6;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 10);
      ctx.quadraticCurveTo(x - 10, y - 12, x, y - 12);
      ctx.quadraticCurveTo(x + 10, y - 12, x + 10, y + 10);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 'rgba(90,40,60,0.5)', 1.5);
      speckles(ctx, 181 + i, ['rgba(255,255,255,0.8)'], 0);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ellipse(ctx, x - 4, y - 5, 2.5, 4, 0.4);
      ctx.fill();
    });
  },
  lollipop(ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, 30, 4, 34);
    ctx.fillStyle = '#ffd24a';
    ellipse(ctx, 32, 22, 17, 17);
    ctx.fill();
    ctx.strokeStyle = '#ff5f8f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 1 + a * 1;
      ctx.lineTo(32 + Math.cos(a) * r, 22 + Math.sin(a) * r);
    }
    ctx.stroke();
    ellipse(ctx, 32, 22, 17, 17);
    outline(ctx, 'rgba(140,60,40,0.55)', 2);
  },

  // ------------------------------------------------ the farm
  // Farmland in furrows, and watered (darker still, by its block's colour,
  // and glinting).
  farmland(ctx) {
    furrows(ctx, '#7a5234', '#946642', 'rgba(255,225,180,0.2)', 'rgba(45,25,12,0.35)');
    speckles(ctx, 81, ['#6a4429', '#a57650', '#8a5d3a'], 46, [1, 2.4]);
    bevel(ctx, 0.6);
  },
  'farmland-wet'(ctx) {
    furrows(ctx, '#6e4a30', '#86603f', 'rgba(255,240,220,0.22)', 'rgba(30,18,10,0.42)');
    speckles(ctx, 82, ['#5c3c25', '#94694a', '#7a5236'], 40, [1, 2.4]);
    const r = speckleRandom(83);
    ctx.fillStyle = 'rgba(225,240,255,0.75)';
    for (let i = 0; i < 9; i++) {
      ellipse(ctx, 4 + r() * 56, 13.5 + Math.floor(r() * 4) * 16, 1.8 + r() * 1.6, 0.9);
      ctx.fill();
    }
    bevel(ctx, 0.6);
  },
  // Just planted, every crop alike: a ridge of soil, shoots just up.
  'crop-planted'(ctx) {
    for (const x of [16, 48]) {
      ctx.fillStyle = '#7a5234';
      ellipse(ctx, x, 63, 15, 6);
      ctx.fill();
      ctx.fillStyle = '#946642';
      ellipse(ctx, x, 61.5, 11, 3);
      ctx.fill();
      for (const dx of [-5, 4]) {
        stem(ctx, x + dx, 60, x + dx + 1, 52, '#6fcf55', 2);
        leaflet(ctx, x + dx + 1, 52.5, 6, -2.5, '#7ad15a');
        leaflet(ctx, x + dx + 1, 52.5, 6, -0.6, '#7ad15a');
      }
    }
  },
  'crop-carrot-1'(ctx) {
    for (const x of [18, 46]) for (const [dx, top] of [[-9, 44], [0, 39], [9, 45]]) frond(ctx, x, 63, x + dx, top);
  },
  'crop-carrot-2'(ctx) {
    for (const x of [17, 47]) for (const [dx, top] of [[-14, 30], [-5, 22], [5, 21], [14, 31]]) frond(ctx, x, 63, x + dx, top, '#55b843');
  },
  'crop-carrot-3'(ctx) {
    for (const x of [17, 47]) {
      for (const [dx, top] of [[-15, 22], [-6, 13], [5, 12], [15, 23]]) frond(ctx, x, 58, x + dx, top, '#4fae3e');
      // The carrot's orange top, just out of the ground.
      ctx.fillStyle = '#ff8a1f';
      ellipse(ctx, x, 63, 7.5, 7);
      ctx.fill();
      outline(ctx, 'rgba(150,60,0,0.55)', 1.4);
      ctx.strokeStyle = 'rgba(190,80,0,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 5, 60);
      ctx.lineTo(x - 1, 60.5);
      ctx.moveTo(x + 1, 62);
      ctx.lineTo(x + 5, 61.5);
      ctx.stroke();
    }
  },
  'crop-strawberry-1'(ctx) {
    for (const x of [18, 46]) {
      stem(ctx, x, 64, x, 52, '#4fae3e', 2);
      trefoil(ctx, x, 50, 5.5);
    }
  },
  'crop-strawberry-2'(ctx) {
    for (const x of [16, 48]) {
      for (const [dx, y, r] of [[-7, 44, 7], [7, 46, 7], [0, 34, 7.5]]) {
        stem(ctx, x, 64, x + dx, y + 2, '#4fae3e', 2);
        trefoil(ctx, x + dx, y, r);
      }
    }
    for (const [x, y] of [[9, 30], [33, 40], [55, 29], [26, 54]]) blossom(ctx, x, y, 6);
  },
  'crop-strawberry-3'(ctx) {
    for (const x of [16, 48]) {
      for (const [dx, y, r] of [[-8, 36, 7.5], [8, 38, 7.5], [0, 25, 8]]) {
        stem(ctx, x, 64, x + dx, y + 2, '#4fae3e', 2);
        trefoil(ctx, x + dx, y, r);
      }
    }
    for (const [x, y, s] of [[8, 48, 5.5], [24, 52, 6], [40, 47, 5.5], [56, 52, 6], [32, 38, 5]]) berry(ctx, x, y, s);
  },
  'crop-tomato-1'(ctx) {
    for (const x of [18, 46]) {
      stem(ctx, x, 64, x, 42, '#4f9a3a', 2.5);
      for (const [y, a] of [[56, -2.6], [52, -0.5], [46, -2.4], [44, -0.7]]) leaf(ctx, x, y, 9, a, '#4caf50');
    }
  },
  'crop-tomato-2'(ctx) {
    // Tied to a stake, as tomatoes are.
    ctx.fillStyle = '#a8703f';
    ctx.fillRect(30.5, 16, 3, 48);
    stem(ctx, 32, 64, 30, 20, '#4f9a3a', 3);
    for (const [y, a] of [[58, -2.7], [54, -0.4], [46, -2.5], [42, -0.6], [34, -2.6], [30, -0.5], [24, -1.6]]) leaf(ctx, 31, y, 13, a, '#3f9a3a');
    for (const [x, y] of [[20, 38], [44, 28], [42, 50]]) {
      ctx.fillStyle = '#ffd23a';
      star(ctx, x, y, 4.5, 2);
      ctx.fill();
    }
    ripeTomato(ctx, 22, 50, 4.5, '#8fcf4a');
    ripeTomato(ctx, 40, 38, 4, '#8fcf4a');
  },
  'crop-tomato-3'(ctx) {
    ctx.fillStyle = '#a8703f';
    ctx.fillRect(30.5, 8, 3, 56);
    stem(ctx, 32, 64, 30, 12, '#4f9a3a', 3);
    for (const [y, a] of [[58, -2.7], [54, -0.4], [46, -2.5], [42, -0.6], [33, -2.6], [28, -0.5], [20, -2.4], [16, -0.8]]) leaf(ctx, 31, y, 14, a, '#3f9a3a');
    for (const [x, y, r] of [[21, 28, 6], [42, 22, 6.5], [20, 46, 6.5], [43, 41, 7], [33, 55, 5.5]]) ripeTomato(ctx, x, y, r);
  },
  'crop-corn-1'(ctx) {
    ctx.strokeStyle = '#6dbf45';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (const x of [20, 44]) {
      for (const [dx, top] of [[-10, 34], [2, 29], [11, 36]]) {
        ctx.beginPath();
        ctx.moveTo(x, 64);
        ctx.quadraticCurveTo(x + dx * 0.2, 46, x + dx, top);
        ctx.stroke();
      }
    }
  },
  'crop-corn-2'(ctx) {
    for (const x of [19, 45]) {
      cornStalk(ctx, x, 9, [54, 44, 33, 22]);
      tassel(ctx, x, 6, '#e6d48a');
    }
  },
  'crop-corn-3'(ctx) {
    for (const x of [19, 45]) {
      cornStalk(ctx, x, 9, [56, 46, 25, 16]);
      cob(ctx, x, 42, 18, x < 32 ? 0.35 : -0.35);
      tassel(ctx, x, 6, '#d9a93a');
    }
  },
  'crop-pumpkin-1'(ctx) {
    stem(ctx, 4, 62, 60, 61, '#5ea338', 2.5);
    roundLeaf(ctx, 18, 52, 8);
    roundLeaf(ctx, 46, 54, 7);
  },
  'crop-pumpkin-2'(ctx) {
    stem(ctx, 2, 60, 62, 58, '#5ea338', 3);
    for (const [x, y, r] of [[10, 46, 9], [31, 38, 10], [52, 44, 9], [44, 56, 7]]) roundLeaf(ctx, x, y, r);
    tendril(ctx, 20, 56, 4);
    // A yellow flower, and a little green pumpkin coming.
    blossom(ctx, 22, 30, 7, '#ffc233', '#f08a1a');
    gourd(ctx, 30, 57, 8, 6, '#86c051', 'rgba(60,110,30,0.6)');
  },
  // Ripe, the pumpkin itself is boxes (render/mesher.js GOURDS): these are
  // its leaves, out at either side of it.
  'crop-pumpkin-3'(ctx) {
    stem(ctx, 0, 61, 64, 60, '#5ea338', 3);
    for (const [x, y, r] of [[7, 50, 8.5], [57, 49, 8.5], [14, 58, 6], [50, 58, 6]]) roundLeaf(ctx, x, y, r);
    tendril(ctx, 4, 40, 3.5);
    tendril(ctx, 60, 39, 3.5);
  },
  'crop-watermelon-1'(ctx) {
    stem(ctx, 4, 62, 60, 61, '#4f9a3a', 2.5);
    lobedLeaf(ctx, 18, 53, 8);
    lobedLeaf(ctx, 46, 54, 7);
  },
  'crop-watermelon-2'(ctx) {
    stem(ctx, 2, 60, 62, 59, '#4f9a3a', 3);
    for (const [x, y, r] of [[10, 46, 9], [32, 40, 9.5], [53, 45, 9], [20, 56, 7]]) lobedLeaf(ctx, x, y, r);
    tendril(ctx, 44, 55, 4);
    blossom(ctx, 46, 32, 6, '#ffe04a', '#e8b020');
    melon(ctx, 36, 57, 9, 6);
  },
  'crop-watermelon-3'(ctx) {
    stem(ctx, 0, 61, 64, 60, '#4f9a3a', 3);
    for (const [x, y, r] of [[7, 50, 8.5], [57, 50, 8.5], [14, 58, 6], [50, 58, 6]]) lobedLeaf(ctx, x, y, r);
    tendril(ctx, 4, 40, 3.5);
    tendril(ctx, 60, 40, 3.5);
  },
  // The skins of a ripe pumpkin and watermelon (render/mesher.js GOURDS).
  'pumpkin-skin'(ctx) {
    fill(ctx, '#ff9420');
    for (let x = 0; x < TILE; x += 13) {
      const g = ctx.createLinearGradient(x, 0, x + 13, 0);
      g.addColorStop(0, 'rgba(190,80,0,0.45)');
      g.addColorStop(0.5, 'rgba(255,190,90,0.35)');
      g.addColorStop(1, 'rgba(190,80,0,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 13, TILE);
    }
    bevel(ctx, 0.35);
  },
  'melon-skin'(ctx) {
    fill(ctx, '#7fcf5f');
    ctx.fillStyle = '#2f7a32';
    for (let x = 4; x < TILE; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= TILE; y += 8) ctx.lineTo(x + (y % 16 ? 3 : -1), y);
      for (let y = TILE; y >= 0; y -= 8) ctx.lineTo(x + 6 + (y % 16 ? 2 : -2), y);
      ctx.closePath();
      ctx.fill();
    }
    bevel(ctx, 0.35);
  },
  // The watering can, as the toy box shows it (it is never put down).
  'watering-can'(ctx) {
    ctx.strokeStyle = '#2f7fc0';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 28);
    ctx.quadraticCurveTo(28, 6, 40, 28);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(42, 46);
    ctx.lineTo(56, 24);
    ctx.stroke();
    ctx.fillStyle = '#4fa8e8';
    ctx.beginPath();
    ctx.roundRect(10, 26, 34, 30, 6);
    ctx.fill();
    outline(ctx, 'rgba(20,60,110,0.6)', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(14, 30, 26, 5);
    ctx.fillStyle = '#2f7fc0';
    ellipse(ctx, 57, 22, 5, 4, -0.6);
    ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    for (const [x, y] of [[59, 32], [55, 38], [61, 42], [57, 49]]) {
      ellipse(ctx, x, y, 1.8, 2.6);
      ctx.fill();
    }
  },

  // ------------------------------------------------ items (transparent, drawn facing you)
  apple(ctx) {
    ctx.fillStyle = '#ec3d3d';
    ctx.beginPath();
    ctx.moveTo(32, 20);
    ctx.bezierCurveTo(10, 8, 4, 40, 18, 52);
    ctx.bezierCurveTo(24, 58, 30, 56, 32, 54);
    ctx.bezierCurveTo(34, 56, 40, 58, 46, 52);
    ctx.bezierCurveTo(60, 40, 54, 8, 32, 20);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(110,10,20,0.6)', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ellipse(ctx, 22, 30, 4, 7, 0.3);
    ctx.fill();
    stem(ctx, 32, 20, 34, 8, '#6b4226', 3);
    leaf(ctx, 34, 12, 14, -0.4);
  },
  orange(ctx) {
    ctx.fillStyle = '#ff9b2f';
    ellipse(ctx, 32, 36, 22, 21);
    ctx.fill();
    outline(ctx, 'rgba(140,60,10,0.6)', 2.5);
    speckles(ctx, 191, ['rgba(200,100,20,0.35)'], 14, [0.8, 1.4]);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ellipse(ctx, 23, 28, 4, 6, 0.4);
    ctx.fill();
    leaf(ctx, 32, 16, 14, -0.3);
  },
  peach(ctx) {
    const g = ctx.createLinearGradient(12, 20, 52, 56);
    g.addColorStop(0, '#ffd08a');
    g.addColorStop(1, '#ff8a8a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, 16);
    ctx.bezierCurveTo(8, 14, 8, 58, 32, 58);
    ctx.bezierCurveTo(56, 58, 56, 14, 32, 16);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(160,60,50,0.55)', 2.5);
    ctx.strokeStyle = 'rgba(220,90,80,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.quadraticCurveTo(26, 36, 32, 56);
    ctx.stroke();
    leaf(ctx, 32, 16, 15, -0.5);
  },
  pear(ctx) {
    ctx.fillStyle = '#b8d94a';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.bezierCurveTo(24, 12, 24, 28, 20, 34);
    ctx.bezierCurveTo(10, 46, 18, 60, 32, 60);
    ctx.bezierCurveTo(46, 60, 54, 46, 44, 34);
    ctx.bezierCurveTo(40, 28, 40, 12, 32, 12);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(80,100,20,0.6)', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, 25, 42, 4, 7, 0.3);
    ctx.fill();
    stem(ctx, 32, 13, 34, 5, '#6b4226', 3);
  },
  cherry(ctx) {
    ctx.strokeStyle = '#4f8a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 44);
    ctx.quadraticCurveTo(24, 16, 36, 8);
    ctx.moveTo(44, 46);
    ctx.quadraticCurveTo(40, 20, 36, 8);
    ctx.stroke();
    for (const [x, y] of [
      [19, 46],
      [45, 48],
    ]) {
      ctx.fillStyle = '#d8203a';
      ellipse(ctx, x, y, 11, 11);
      ctx.fill();
      outline(ctx, 'rgba(100,10,20,0.6)', 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ellipse(ctx, x - 4, y - 4, 2.5, 3.5, 0.4);
      ctx.fill();
    }
    leaf(ctx, 36, 9, 14, -0.2);
  },
  // A bunch of the flowers the lawn mower gathered (blocks.js FLOWER_BUNCH):
  // a tulip, a daisy and a pink flower, their stems tied with a ribbon.
  'flower-bunch'(ctx) {
    for (const [name, x, a] of [
      ['tulip', -11, -0.32],
      ['cosmos', 11, 0.32],
      ['daisy', 0, 0],
    ]) {
      ctx.save();
      ctx.translate(32 + x * 0.3, 60);
      ctx.rotate(a);
      ctx.scale(0.72, 0.72);
      ctx.translate(-32, -62);
      PAINT[name](ctx);
      ctx.restore();
    }
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(26, 46, 12, 6);
    outline(ctx, 'rgba(160,110,20,0.6)', 1.5);
  },
  shell(ctx) {
    ctx.fillStyle = '#ffd6dc';
    ctx.beginPath();
    ctx.moveTo(32, 54);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r = 24 + (i % 2 ? 2 : 0);
      ctx.lineTo(32 + Math.cos(a) * r, 44 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(160,80,90,0.6)', 2.5);
    ctx.strokeStyle = 'rgba(210,120,130,0.8)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(32, 52);
      ctx.lineTo(32 + Math.cos(a) * 22, 44 + Math.sin(a) * 22);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffc2cb';
    ctx.fillRect(26, 50, 12, 8);
  },
  pearl(ctx) {
    const g = ctx.createRadialGradient(32, 34, 2, 32, 34, 30);
    g.addColorStop(0, 'rgba(255,250,240,0.8)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#f6f2ee';
    ctx.beginPath();
    ctx.arc(32, 34, 17, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(150,140,160,0.6)', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ellipse(ctx, 26, 28, 5, 3.5, 0.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,210,0.35)';
    ellipse(ctx, 38, 40, 6, 4, -0.4);
    ctx.fill();
  },
  'star-piece'(ctx) {
    const g = ctx.createRadialGradient(32, 34, 2, 32, 34, 30);
    g.addColorStop(0, 'rgba(255,250,200,0.9)');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#ffd83a';
    star(ctx, 32, 34, 24, 11);
    ctx.fill();
    outline(ctx, 'rgba(180,110,10,0.7)', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    star(ctx, 28, 30, 7, 3);
    ctx.fill();
  },
  // Vegetables, as the basket shows them.
  carrot(ctx) {
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.moveTo(10, 58);
    ctx.quadraticCurveTo(22, 30, 36, 18);
    ctx.quadraticCurveTo(46, 14, 50, 22);
    ctx.quadraticCurveTo(48, 30, 38, 38);
    ctx.quadraticCurveTo(22, 52, 10, 58);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 'rgba(150,60,0,0.6)', 2.2);
    ctx.strokeStyle = 'rgba(190,80,0,0.6)';
    ctx.lineWidth = 1.6;
    for (const [x, y, k] of [[22, 44, 5], [30, 33, 6], [38, 26, 5]]) {
      ctx.beginPath();
      ctx.moveTo(x - k * 0.4, y - k * 0.5);
      ctx.lineTo(x + k * 0.6, y + k * 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ellipse(ctx, 34, 24, 2.5, 6, 0.8);
    ctx.fill();
    for (const [a, len] of [[-1.9, 16], [-1.3, 18], [-0.7, 15]]) frond(ctx, 46, 18, 46 + Math.cos(a) * len, 18 + Math.sin(a) * len, '#4fae3e');
  },
  strawberry(ctx) {
    berry(ctx, 32, 32, 19);
  },
  tomato(ctx) {
    ripeTomato(ctx, 32, 36, 21);
    stem(ctx, 32, 17, 35, 9, '#4f8a2a', 3);
  },
  corn(ctx) {
    cob(ctx, 22, 58, 50, 0.45);
  },
  pumpkin(ctx) {
    gourd(ctx, 32, 38, 26, 20, '#ff9420', 'rgba(190,80,0,0.6)');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, 22, 30, 3.5, 7, 0.4);
    ctx.fill();
    stem(ctx, 32, 20, 35, 9, '#6b8f2e', 5);
    leaf(ctx, 35, 14, 15, -0.3);
  },
  // A slice, as a watermelon is best known.
  watermelon(ctx) {
    ctx.fillStyle = '#3f9a3a';
    ctx.beginPath();
    ctx.moveTo(4, 26);
    ctx.arc(32, 26, 28, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8f5c8';
    ctx.beginPath();
    ctx.moveTo(8, 26);
    ctx.arc(32, 26, 24, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff4f5e';
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.arc(32, 26, 22, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, 26);
    ctx.arc(32, 26, 28, 0, Math.PI);
    ctx.closePath();
    outline(ctx, 'rgba(20,70,20,0.6)', 2.2);
    ctx.fillStyle = '#3a2a2a';
    for (const [x, y] of [[20, 32], [28, 38], [36, 38], [44, 32], [32, 30], [24, 40], [40, 40]]) {
      ellipse(ctx, x, y, 1.6, 2.6, (x - 32) * 0.05);
      ctx.fill();
    }
  },
};

// A cut jewel, pointing down: a flat top, a row of facets, and a point.
function jewel(ctx, cx, cy, r, color) {
  const top = cy - r * 0.55;
  const girdle = cy - r * 0.1;
  const tip = cy + r;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, top);
  ctx.lineTo(cx + r * 0.55, top);
  ctx.lineTo(cx + r, girdle);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx - r, girdle);
  ctx.closePath();
  ctx.fill();
  outline(ctx, shade(color, -0.55), Math.max(1.5, r / 9));
  // Facets: lighter on the crown, darker towards the point.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, top);
  ctx.lineTo(cx + r * 0.55, top);
  ctx.lineTo(cx + r * 0.3, girdle);
  ctx.lineTo(cx - r * 0.3, girdle);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.3, girdle);
  ctx.lineTo(cx + r, girdle);
  ctx.lineTo(cx, tip);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, r / 14);
  ctx.beginPath();
  ctx.moveTo(cx - r, girdle);
  ctx.lineTo(cx + r, girdle);
  ctx.moveTo(cx - r * 0.3, girdle);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx + r * 0.3, girdle);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  star(ctx, cx - r * 0.25, top + r * 0.2, r * 0.22, r * 0.07, 4);
  ctx.fill();
}

// Gem rocks: stone with crystals of their jewel growing out of it; and the
// jewel itself, glowing a little.
for (const [key, , , color] of GEMS) {
  PAINT[`${key}-rock`] = (ctx) => {
    PAINT.stone(ctx);
    const r = speckleRandom(key.length * 977 + key.charCodeAt(0));
    for (const [x, y, size] of [
      [18, 20, 11],
      [45, 17, 8],
      [40, 44, 12],
      [14, 48, 7],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((r() - 0.5) * 0.9);
      jewel(ctx, 0, 0, size, color);
      ctx.restore();
    }
  };
  PAINT[key] = (ctx) => {
    const g = ctx.createRadialGradient(32, 34, 2, 32, 34, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, TILE);
    jewel(ctx, 32, 30, 22, color);
  };
}

// The mining bomb: a round black bomb with a fizzing spark on a short fuse,
// as it sits in a mine and as the toy box shows it.
PAINT.bomb = (ctx) => {
  const g = ctx.createRadialGradient(26, 26, 4, 32, 34, 26);
  g.addColorStop(0, '#5a606b');
  g.addColorStop(1, '#23262c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 36, 21, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 'rgba(0,0,0,0.55)', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, 24, 28, 5, 3, -0.6);
  ctx.fill();
  // The fuse holder and the fuse curling up from it.
  ctx.strokeStyle = '#8a9099';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(32, 16);
  ctx.quadraticCurveTo(34, 8, 42, 7);
  ctx.stroke();
  star(ctx, 44, 6, 5, 2, 4);
  ctx.fillStyle = '#ffdf5a';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  star(ctx, 44, 6, 2, 0.8, 4);
  ctx.fill();
};

// Rails, seen from above: two steel rails on wooden sleepers, running down
// the tile; and round a corner, from the middle of its bottom edge to the
// middle of its right one (render/mesher.js turns them to fit).
function railBits(ctx, ties, rails) {
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of ties) {
    ctx.strokeStyle = '#7a5032';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = '#a5714a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  for (const path of rails) {
    ctx.strokeStyle = '#5b5f68';
    ctx.lineWidth = 6;
    path();
    ctx.stroke();
    ctx.strokeStyle = '#d7dde3';
    ctx.lineWidth = 2.5;
    path();
    ctx.stroke();
  }
}
PAINT.rail = (ctx) => {
  const ties = [8, 24, 40, 56].map((y) => [8, y, 56, y]);
  const rail = (x) => () => {
    ctx.beginPath();
    ctx.moveTo(x, -2);
    ctx.lineTo(x, TILE + 2);
  };
  railBits(ctx, ties, [rail(18), rail(46)]);
};
PAINT['rail-curve'] = (ctx) => {
  const ties = [0.12, 0.5, 0.88].map((k) => {
    const a = Math.PI + (k * Math.PI) / 2;
    return [64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8, 64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56];
  });
  const arc = (r) => () => {
    ctx.beginPath();
    ctx.arc(64, 64, r, Math.PI, Math.PI * 1.5);
  };
  railBits(ctx, ties, [arc(18), arc(46)]);
};

// Which painting each block face uses; blocks with studs get the version
// with a bump painted on top ("name+stud").
function tileNameFor(def, face) {
  const name = def.tiles[face];
  return face === 'top' && def.studs ? `${name}+stud` : name;
}

function painter(name) {
  if (name.endsWith('+stud')) {
    const base = PAINT[name.slice(0, -5)];
    return (ctx) => {
      base(ctx);
      stud(ctx, 0.85);
    };
  }
  return PAINT[name];
}

const averageOf = (data) => {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return n ? [r / n, g / n, b / n] : [255, 255, 255];
};

// ---------------------------------------------------------------- a real tree's leaves
// The leaves of a real tree (render/katsura.js) are pictures of their own,
// bigger than a block's, in their own texture: clusters of leaves on their
// stalks along a twig, and leaves fallen on the ground. Painted gold, for
// the mesher to tint each cluster its own autumn colour.
export const FOLIAGE_TILE = 256;

// A katsura leaf as it really is: nearly round, notched into a heart where
// its red stalk joins, with a blunt tip, a scalloped edge and pale veins
// fanning out from the notch, lighter in the middle. `s` is its radius; the
// notch is at the top before `angle` turns it; `wide` below 1 curls it; a
// `flat` one is only its shape in one colour (a shadow).
function katsuraBlade(ctx, x, y, s, angle, color, wide = 1, flat = false) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, -0.42 * s);
    ctx.bezierCurveTo(-0.3 * s, -1.0 * s, -1.12 * s, -0.78 * s, -1.02 * s, -0.05 * s);
    ctx.bezierCurveTo(-0.95 * s, 0.5 * s, -0.4 * s, 0.88 * s, 0, 1.06 * s);
    ctx.bezierCurveTo(0.4 * s, 0.88 * s, 0.95 * s, 0.5 * s, 1.02 * s, -0.05 * s);
    ctx.bezierCurveTo(1.12 * s, -0.78 * s, 0.3 * s, -1.0 * s, 0, -0.42 * s);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(wide, 1);
  path();
  if (flat) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    return;
  }
  const g = ctx.createRadialGradient(-0.2 * s, 0.05 * s, 0.1 * s, 0, 0.1 * s, 1.15 * s);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.2));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // The scalloped edge.
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.strokeStyle = shade(color, -0.22);
  ctx.setLineDash([s * 0.13, s * 0.07]);
  path();
  ctx.stroke();
  ctx.setLineDash([]);
  // Faint veins from the notch: one down the middle and two pairs out to the sides.
  ctx.strokeStyle = shade(color, 0.16);
  ctx.lineWidth = Math.max(0.6, s * 0.028);
  ctx.lineCap = 'round';
  for (const a of [0, -0.6, 0.6, -1.15, 1.15]) {
    const ex = Math.sin(a) * 0.92 * s;
    const ey = -0.4 * s + Math.cos(a) * 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(0, -0.4 * s);
    ctx.quadraticCurveTo(ex * 0.25, (ey - 0.4 * s) * 0.5, ex, Math.min(ey, 0.95 * s));
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

const KATSURA_GOLDS = ['#f6cf3f', '#f2c033', '#f8d955', '#efb531', '#f4c84a', '#f7d86a', '#eaa83a', '#f1bd3c'];

// Leaves on their stalks along a twig, fanning up and out from it.
function katsuraCluster(seed) {
  return (ctx) => {
    const r = speckleRandom(seed);
    const S = FOLIAGE_TILE;
    const y0 = S * (0.78 + r() * 0.1);
    const y1 = S * (0.52 + r() * 0.16);
    const twig = (t) => [S * (0.06 + 0.88 * t), y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * S * 0.05];
    const leaves = [];
    for (let i = 0; i < 18; i++) {
      const t = (i + 0.3 + r() * 0.4) / 18;
      const [px, py] = twig(t);
      const a = -Math.PI / 2 + (r() - 0.5) * 2.7;
      const stalk = S * (0.06 + r() * 0.08);
      const size = S * (0.105 + r() * 0.05);
      const nx = px + Math.cos(a) * stalk;
      const ny = py + Math.sin(a) * stalk;
      leaves.push({ px, py, nx, ny, a, size, color: KATSURA_GOLDS[Math.floor(r() * KATSURA_GOLDS.length)], wide: 0.85 + r() * 0.15 });
    }
    // The twig, and the leaves' stalks.
    ctx.strokeStyle = '#6e5a4a';
    ctx.lineWidth = S * 0.018;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) ctx.lineTo(...twig(t));
    ctx.stroke();
    ctx.strokeStyle = '#a1402f';
    ctx.lineWidth = S * 0.008;
    for (const l of leaves) {
      ctx.beginPath();
      ctx.moveTo(l.px, l.py);
      ctx.lineTo(l.nx, l.ny);
      ctx.stroke();
    }
    // Back ones first; each casts a little shade on the leaves under it.
    leaves.sort((a, b) => a.ny - b.ny);
    for (const l of leaves) {
      const at = [l.nx + Math.cos(l.a) * l.size * 0.42, l.ny + Math.sin(l.a) * l.size * 0.42];
      const turn = l.a - Math.PI / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      katsuraBlade(ctx, at[0] + S * 0.012, at[1] + S * 0.018, l.size, turn, 'rgba(90,50,0,0.35)', l.wide, true);
      ctx.restore();
      katsuraBlade(ctx, at[0], at[1], l.size, turn, l.color, l.wide);
    }
  };
}

// Fallen leaves lying every which way, some curled, a little browner.
function katsuraLitter(ctx) {
  const r = speckleRandom(91);
  const S = FOLIAGE_TILE;
  const browns = ['#e9b43a', '#dc9a36', '#e2a64a', '#c98a3a', '#efc24a', '#d77f3c'];
  for (let i = 0; i < 16; i++) {
    const size = S * (0.06 + r() * 0.03);
    const x = size * 1.3 + r() * (S - size * 2.6);
    const y = size * 1.3 + r() * (S - size * 2.6);
    katsuraBlade(ctx, x, y, size, r() * Math.PI * 2, browns[Math.floor(r() * browns.length)], 0.6 + r() * 0.4);
  }
}

const FOLIAGE = {
  'katsura-cluster-0': katsuraCluster(81),
  'katsura-cluster-1': katsuraCluster(82),
  'katsura-cluster-2': katsuraCluster(83),
  'katsura-litter': katsuraLitter,
};

// The foliage pictures as layers of their own texture. Where nothing is
// painted the colour is the leaves' own, so their edges never darken as the
// texture shrinks into the distance.
function buildFoliage() {
  const S = FOLIAGE_TILE;
  const names = Object.keys(FOLIAGE);
  const data = new Uint8Array(S * S * 4 * names.length);
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  names.forEach((name, i) => {
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    FOLIAGE[name](ctx);
    ctx.restore();
    const img = ctx.getImageData(0, 0, S, S);
    const [r, g, b] = averageOf(img.data);
    for (let p = 0; p < img.data.length; p += 4) {
      if (img.data[p + 3] > 0) continue;
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;
    }
    data.set(img.data, i * S * S * 4);
  });
  return { data, size: S, count: names.length, layers: new Map(names.map((n, i) => [n, i])) };
}

// Paints every tile. Returns the raw layers plus lookup tables the mesher
// uses: tile layer per block face, tint and stud colour per block.
export function buildAtlas() {
  const wanted = new Set(Object.keys(PAINT));
  for (const def of BLOCKS) if (def?.tiles) for (const face of ['top', 'side', 'bottom']) wanted.add(tileNameFor(def, face));
  const names = [...wanted];
  const layers = new Map(names.map((n, i) => [n, i]));
  const data = new Uint8Array(TILE * TILE * 4 * names.length);
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const averages = new Map();
  const images = new Map();
  names.forEach((name, i) => {
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.save();
    painter(name)(ctx);
    ctx.restore();
    const img = ctx.getImageData(0, 0, TILE, TILE);
    data.set(img.data, i * TILE * TILE * 4);
    averages.set(name, averageOf(img.data));
    images.set(name, canvas.toDataURL());
  });

  const faceLayer = new Int16Array(BLOCK_IDS * 3).fill(0);
  const tint = new Uint8Array(BLOCK_IDS * 3).fill(255);
  const studTint = new Uint8Array(BLOCK_IDS * 3).fill(255);
  for (const def of BLOCKS) {
    if (!def?.tiles) continue;
    ['top', 'side', 'bottom'].forEach((face, f) => {
      faceLayer[def.id * 3 + f] = layers.get(tileNameFor(def, face)) ?? 0;
    });
    const t = hex(def.color);
    tint.set(t, def.id * 3);
    const avg = averages.get(def.tiles.top) ?? [255, 255, 255];
    studTint.set(avg.map((v, k) => Math.min(255, (v * t[k]) / 255)), def.id * 3);
  }
  return { data, count: names.length, layers, faceLayer, tint, studTint, images, averages, foliage: buildFoliage() };
}

// A little 3D block (or the flower itself) for the toy box and hotbar.
export function blockIcon(atlas, id, size = 64) {
  const def = BLOCKS[id];
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const kind = KIND[id];
  const load = (name) => {
    const img = new Image();
    img.src = atlas.images.get(name);
    return img;
  };
  if (kind === K_FURNITURE) return Promise.resolve(furnitureIcon(atlas, id, canvas, ctx, size));
  if (kind === K_PLANT || kind === K_ITEM) {
    const img = load(def.tiles.top);
    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL());
      };
    });
  }
  const top = load(tileNameFor(def, 'top'));
  const side = load(def.tiles.side);
  const tint = def.color;
  return Promise.all([top, side].map((img) => new Promise((r) => (img.complete ? r() : (img.onload = r))))).then(() => {
    const s = size / 64;
    const tinted = (img, darken) => {
      const c = document.createElement('canvas');
      c.width = TILE;
      c.height = TILE;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = tint;
      x.fillRect(0, 0, TILE, TILE);
      if (darken) {
        x.fillStyle = `rgba(0,0,0,${darken})`;
        x.fillRect(0, 0, TILE, TILE);
      }
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(img, 0, 0);
      return c;
    };
    const t = tinted(top, 0);
    const l = tinted(side, 0.12);
    const r = tinted(side, 0.28);
    const w = 28 * s;
    const h = 16 * s;
    const cx = size / 2;
    const cy = 16 * s;
    // Top diamond.
    ctx.save();
    ctx.setTransform(w / TILE, h / TILE, -w / TILE, h / TILE, cx, cy - h);
    ctx.drawImage(t, 0, 0);
    ctx.restore();
    // Left face.
    ctx.save();
    ctx.setTransform(w / TILE, h / TILE, 0, (30 * s) / TILE, cx - w, cy);
    ctx.drawImage(l, 0, 0);
    ctx.restore();
    // Right face.
    ctx.save();
    ctx.setTransform(w / TILE, -h / TILE, 0, (30 * s) / TILE, cx, cy + h);
    ctx.drawImage(r, 0, 0);
    ctx.restore();
    return canvas.toDataURL();
  });
}

// A piece of furniture as the toy box shows it: its boxes seen from the front
// and a little to the side and above, each face a flat colour (the box's
// colour times its tile's), the ones further back drawn first.
function furnitureIcon(atlas, id, canvas, ctx, size) {
  // Seen from -x, -z: x goes left and back, z goes right and back; then
  // made as big as fits (never more than half again a whole block's size),
  // so a picture or a lamp is not lost in its square. A fence is shown
  // joined up both sides, as it mostly stands.
  const flat = (x, y, z) => [(z - x) * 24, -y * 30 - (x + z) * 11];
  const shown = modelBoxes(id, BLOCKS[id].model === 'fence' ? (dx, dz) => dz === 0 : undefined);
  const corners = shown.flatMap(([x0, y0, z0, x1, y1, z1]) => [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => flat(x, y, z)))));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((size * 0.84) / (maxX - minX), (size * 0.84) / (maxY - minY), (size / 64) * 1.5);
  const at = (x, y, z) => {
    const [fx, fy] = flat(x, y, z);
    return [size / 2 + (fx - (minX + maxX) / 2) * s, size / 2 + (fy - (minY + maxY) / 2) * s];
  };
  const boxes = shown.map(([x0, y0, z0, x1, y1, z1, color, tile]) => {
    const avg = tile === 'glow' ? [255, 255, 255] : (atlas.averages?.get(tile) ?? [255, 255, 255]);
    const rgbOf = hex(color).map((v, k) => (v * avg[k]) / 255);
    return { x0, x1, y0, y1, z0, z1, rgbOf, glow: tile === 'glow' };
  });
  boxes.sort((p, q) => q.x1 + q.z1 - (p.x1 + p.z1) || p.y0 - q.y0);
  const poly = (pts, col) => {
    ctx.beginPath();
    pts.forEach(([x, y, z], i) => {
      const [px, py] = at(x, y, z);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.8 * (size / 64);
    ctx.stroke();
  };
  for (const b of boxes) {
    const { x0, x1, y0, y1, z0, z1 } = b;
    const k = (f) => rgb(b.rgbOf.map((v) => (b.glow ? v : v * f)));
    poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], k(0.78));
    poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], k(0.9));
    poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], k(1));
  }
  return canvas.toDataURL();
}
