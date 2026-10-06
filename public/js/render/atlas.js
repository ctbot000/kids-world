// Every block face, flower and fruit is painted here with Canvas 2D when the
// game starts — no image files. Tiles go into one texture array (one layer
// per tile), and the same paintings make the icons in the toy box.
import { BLOCKS, GEMS, KIND, K_ITEM, K_PLANT } from '../shared/blocks.js';

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

  const faceLayer = new Int16Array(256 * 3).fill(0);
  const tint = new Uint8Array(256 * 3).fill(255);
  const studTint = new Uint8Array(256 * 3).fill(255);
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
  return { data, count: names.length, layers, faceLayer, tint, studTint, images };
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
