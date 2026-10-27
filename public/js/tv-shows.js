// What is on each TV channel (shared/tv.js CHANNELS): a little cartoon for
// each, drawn into a 2D canvas frame by frame, `t` seconds in, at W × H
// (16:9). `env` is the island's time and weather, for Island Weather.
import { isNight, isRaining } from './shared/env.js';

const TAU = Math.PI * 2;

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function cloud(ctx, x, y, s, color = '#ffffff') {
  circle(ctx, x, y, 14 * s, color);
  circle(ctx, x + 16 * s, y - 6 * s, 16 * s, color);
  circle(ctx, x + 34 * s, y, 13 * s, color);
  ctx.fillRect(x, y, 34 * s, 13 * s);
}

// A fish facing right (dir 1) or left (-1), its tail waggling.
function fish(ctx, x, y, s, color, dir, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 10, 0, 0, TAU);
  ctx.fill();
  const wag = Math.sin(t * 10) * 4;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-26, -9 + wag);
  ctx.lineTo(-26, 9 + wag);
  ctx.closePath();
  ctx.fill();
  circle(ctx, 8, -3, 3, '#ffffff');
  circle(ctx, 9, -3, 1.6, '#2c2f36');
  ctx.restore();
}

function fishTank(ctx, t, W, H) {
  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#6fd0ff');
  sea.addColorStop(1, '#1f6fb8');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, W, H);
  // Light from above, wavering.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 97 + t * 12) % (W + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 30, 0);
    ctx.lineTo(x + 60, H);
    ctx.lineTo(x + 20, H);
    ctx.fill();
  }
  // Sand, and weed waving on it.
  ctx.fillStyle = '#f3d98b';
  ctx.fillRect(0, H - 22, W, 22);
  ctx.strokeStyle = '#3fae5c';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const x of [30, 52, 250, 272, 290]) {
    ctx.beginPath();
    ctx.moveTo(x, H - 20);
    for (let k = 1; k <= 5; k++) ctx.lineTo(x + Math.sin(t * 2 + k * 0.8 + x) * 5 * (k / 5), H - 20 - k * 14);
    ctx.stroke();
  }
  // Fish, there and back.
  const kinds = [
    ['#ff9a3c', 0.55, 50, 1],
    ['#fcd535', 0.8, 95, 0.8],
    ['#f47fb8', 0.42, 130, 1.1],
    ['#8c5bd6', 0.65, 70, 0.7],
  ];
  kinds.forEach(([color, speed, y, s], i) => {
    const p = (t * speed * 0.25 + i * 0.37) % 2;
    const dir = p < 1 ? 1 : -1;
    const f = p < 1 ? p : 2 - p;
    fish(ctx, -30 + f * (W + 60), y + Math.sin(t * 1.5 + i) * 8, s, color, dir, t + i);
  });
  // Bubbles going up.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const y = H - ((t * 30 + i * 41) % (H + 20));
    ctx.beginPath();
    ctx.arc(60 + i * 29 + Math.sin(t * 3 + i) * 4, y, 2 + (i % 3), 0, TAU);
    ctx.stroke();
  }
}

function bunnyHop(ctx, t, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#8fd3ff');
  sky.addColorStop(1, '#d9f3ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  circle(ctx, W - 40, 32, 18, '#ffe066');
  for (let i = 0; i < 3; i++) cloud(ctx, ((i * 140 - t * 14) % (W + 120) + W + 120) % (W + 120) - 60, 28 + i * 14, 0.7);
  // Two rows of hills, rolling past.
  for (const [color, y, speed, size] of [
    ['#9ee07f', H - 60, 20, 70],
    ['#5fc35a', H - 34, 50, 50],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y - Math.abs(Math.sin((x + t * speed) / size)) * 18);
    ctx.lineTo(W, H);
    ctx.fill();
  }
  // Carrots going by, and the bunny hopping along.
  for (let i = 0; i < 2; i++) {
    const x = ((i * 170 - t * 50) % (W + 60) + W + 60) % (W + 60) - 20;
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.moveTo(x, H - 26);
    ctx.lineTo(x + 8, H - 26);
    ctx.lineTo(x + 4, H - 8);
    ctx.fill();
    ctx.fillStyle = '#3fae5c';
    ctx.fillRect(x + 2, H - 32, 4, 6);
  }
  const hop = Math.abs(Math.sin(t * 4));
  const bx = W * 0.4;
  const by = H - 40 - hop * 36;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(1 + (1 - hop) * 0.08, 1 - (1 - hop) * 0.08);
  circle(ctx, 0, 0, 16, '#ffffff');
  circle(ctx, -14, 4, 6, '#ffffff');
  circle(ctx, 14, -14, 11, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(10, -34, 4, 12, -0.2, 0, TAU);
  ctx.ellipse(18, -33, 4, 12, 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffb3cf';
  ctx.beginPath();
  ctx.ellipse(10, -33, 2, 8, -0.2, 0, TAU);
  ctx.ellipse(18, -32, 2, 8, 0.25, 0, TAU);
  ctx.fill();
  circle(ctx, 18, -16, 2, '#2c2f36');
  circle(ctx, 24, -11, 2.2, '#ff8fb1');
  ctx.restore();
}

function spaceTrip(ctx, t, W, H) {
  ctx.fillStyle = '#0d1030';
  ctx.fillRect(0, 0, W, H);
  // Stars streaming past, the near ones faster.
  for (let i = 0; i < 60; i++) {
    const depth = 1 + (i % 3);
    const x = (W - ((t * 30 * depth + i * 53) % W) + W) % W;
    const y = (i * 37) % H;
    ctx.fillStyle = depth === 3 ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(x, y, depth, depth);
  }
  // A ringed planet drifting by.
  const px = W - ((t * 8) % (W + 160)) + 80;
  circle(ctx, px, 50, 26, '#f59331');
  ctx.strokeStyle = '#ffd99a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(px, 50, 42, 10, -0.3, 0, TAU);
  ctx.stroke();
  // The rocket, bobbing, flame flickering.
  const rx = W * 0.32;
  const ry = H * 0.58 + Math.sin(t * 2) * 10;
  ctx.save();
  ctx.translate(rx, ry);
  ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffb347' : '#ffe066';
  ctx.beginPath();
  ctx.moveTo(-26, -7);
  ctx.lineTo(-46 - Math.random() * 10, 0);
  ctx.lineTo(-26, 7);
  ctx.fill();
  ctx.fillStyle = '#e8453c';
  ctx.beginPath();
  ctx.moveTo(-18, -12);
  ctx.lineTo(-30, -20);
  ctx.lineTo(-24, -6);
  ctx.moveTo(-18, 12);
  ctx.lineTo(-30, 20);
  ctx.lineTo(-24, 6);
  ctx.fill();
  ctx.fillStyle = '#f7f5ef';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 13, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8453c';
  ctx.beginPath();
  ctx.moveTo(20, -9);
  ctx.quadraticCurveTo(38, 0, 20, 9);
  ctx.fill();
  circle(ctx, 4, 0, 6, '#3a73d8');
  circle(ctx, 2, -2, 2, '#bfe3ff');
  ctx.restore();
}

const WEATHER_WORDS = {
  clear: 'Sunny',
  cloudy: 'Cloudy',
  rain: 'Rainy',
  tornado: 'Tornado!',
  rainbow: 'Rainbow!',
  snow: 'Snowy',
  sprinkles: 'Candy sprinkles!',
};

function islandWeather(ctx, t, W, H, env) {
  const night = isNight(env.time);
  const weather = env.weather in WEATHER_WORDS ? env.weather : 'clear';
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, night ? '#1b2050' : weather === 'clear' || weather === 'rainbow' ? '#5bb8ff' : '#8a9bb3');
  sky.addColorStop(1, night ? '#3b3f7a' : '#d9f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // The picture on the left: the sun or the moon, clouds, and what falls.
  const cx = 82;
  const cy = 74;
  if (night) {
    circle(ctx, cx, cy, 26, '#fff6c9');
    circle(ctx, cx + 12, cy - 8, 22, '#1b2050');
    for (let i = 0; i < 6; i++) if (Math.sin(t * 3 + i) > -0.3) circle(ctx, 20 + i * 27, 18 + (i % 2) * 16, 1.6, '#ffffff');
  } else if (weather !== 'cloudy' && weather !== 'tornado' && !isRaining(weather)) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.5);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.beginPath();
      ctx.moveTo(32, 0);
      ctx.lineTo(42, 0);
      ctx.stroke();
    }
    ctx.restore();
    circle(ctx, cx, cy, 26, '#ffe066');
  }
  if (weather === 'rainbow') {
    ['#e8453c', '#f59331', '#fcd535', '#35a852', '#3a73d8', '#8c5bd6'].forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy + 50, 70 - i * 4, Math.PI, TAU);
      ctx.stroke();
    });
  }
  if (weather !== 'clear' && weather !== 'rainbow') cloud(ctx, cx - 34 + Math.sin(t) * 4, cy - 4, 1.3, night ? '#9aa1c0' : '#ffffff');
  if (weather === 'tornado') {
    // A grey funnel under the cloud, swaying, its rings going round.
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const sway = Math.sin(t * 2 + k * 3) * 8 * (1 - k);
      ctx.fillStyle = i % 2 ? '#8a939e' : '#a7b0bb';
      ctx.beginPath();
      ctx.ellipse(cx - 30 + sway, cy + 78 - i * 8, 4 + 26 * k * k + 4 * k, 3 + 2 * k, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (isRaining(weather)) {
    for (let i = 0; i < 14; i++) {
      const x = cx - 36 + ((i * 13) % 70);
      const y = cy + 18 + ((t * (weather === 'rain' ? 80 : 30) + i * 17) % 70);
      if (weather === 'rain') {
        ctx.fillStyle = '#4fa3ff';
        ctx.fillRect(x, y, 2, 7);
      } else if (weather === 'snow') {
        circle(ctx, x, y, 2.5, '#ffffff');
      } else {
        ctx.fillStyle = ['#f47fb8', '#fcd535', '#8fe3ff', '#7ed36f'][i % 4];
        ctx.fillRect(x, y, 5, 2);
      }
    }
  }
  // The forecast on the right.
  const part = night ? 'Tonight' : env.time < 0.4 ? 'This morning' : env.time < 0.6 ? 'This afternoon' : 'This evening';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.beginPath();
  ctx.roundRect(158, 40, W - 172, 92, 12);
  ctx.fill();
  ctx.fillStyle = '#2c2f36';
  ctx.textAlign = 'center';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(part + ' here:', 158 + (W - 172) / 2, 66);
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText(WEATHER_WORDS[weather], 158 + (W - 172) / 2, 96);
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(night ? 'Sleep tight! 🌙' : weather === 'rain' ? 'Your farm gets watered!' : weather === 'tornado' ? 'Stay indoors — or take a spin!' : 'A good day to play!', 158 + (W - 172) / 2, 120);
  // The news ticker along the bottom.
  ctx.fillStyle = '#e8453c';
  ctx.fillRect(0, H - 22, W, 22);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = '700 12px system-ui, sans-serif';
  const news = '📺 ISLAND WEATHER  ·  Remember to water your carrots  ·  Pets love a pat  ·  ';
  const width = ctx.measureText(news).width;
  const x = -((t * 40) % width);
  ctx.fillText(news + news + news, x, H - 7);
}

function danceParty(ctx, t, W, H) {
  ctx.fillStyle = '#251645';
  ctx.fillRect(0, 0, W, H);
  // A floor of flashing tiles.
  const beat = Math.floor(t * 2.5);
  const colors = ['#f47fb8', '#fcd535', '#2fc1b3', '#8c5bd6', '#f59331'];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = colors[(i + j * 3 + beat) % colors.length];
      ctx.globalAlpha = (i + j + beat) % 2 ? 0.9 : 0.35;
      ctx.fillRect(i * (W / 8), H - 40 + j * 20, W / 8 - 2, 18);
    }
  }
  ctx.globalAlpha = 1;
  // Spotlights sweeping.
  for (let i = 0; i < 3; i++) {
    const a = Math.sin(t * 1.3 + i * 2) * 0.5;
    ctx.fillStyle = `${colors[i]}33`;
    ctx.beginPath();
    ctx.moveTo(W * (0.2 + i * 0.3), 0);
    ctx.lineTo(W * (0.2 + i * 0.3) + Math.sin(a) * 200 - 40, H);
    ctx.lineTo(W * (0.2 + i * 0.3) + Math.sin(a) * 200 + 40, H);
    ctx.fill();
  }
  // The disco ball.
  circle(ctx, W / 2, 18, 12, '#c9ced6');
  for (let i = 0; i < 6; i++) if ((i + beat) % 2) circle(ctx, W / 2 - 6 + (i % 3) * 6, 14 + Math.floor(i / 3) * 8, 2, '#ffffff');
  // Three blobs dancing to the beat, each its own way.
  const blobs = [
    ['#f2a0e0', W * 0.25, 0],
    ['#8fe3ff', W * 0.5, 1],
    ['#b6f27a', W * 0.75, 2],
  ];
  for (const [color, x, k] of blobs) {
    const bounce = Math.abs(Math.sin(t * Math.PI * 1.25 + k));
    const lean = Math.sin(t * Math.PI * 1.25 + k) * 0.25;
    ctx.save();
    ctx.translate(x, H - 46 - bounce * 16);
    ctx.rotate(lean);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 22 - bounce * 3, 0, 0, TAU);
    ctx.fill();
    // Arms up, then down.
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const up = beat % 2 ? -1 : 0.3;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-28, up * 18);
    ctx.moveTo(16, 0);
    ctx.lineTo(28, -up * 18);
    ctx.stroke();
    circle(ctx, -6, -5, 3, '#2c2f36');
    circle(ctx, 6, -5, 3, '#2c2f36');
    ctx.strokeStyle = '#2c2f36';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.restore();
  }
  // Notes floating up.
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  for (let i = 0; i < 4; i++) {
    const y = H - 70 - ((t * 25 + i * 30) % 90);
    ctx.globalAlpha = Math.max(0, Math.min(1, (y - 20) / 40));
    ctx.fillText(i % 2 ? '♪' : '♫', 30 + i * 80 + Math.sin(t * 2 + i) * 8, y);
  }
  ctx.globalAlpha = 1;
}

const SHOWS = { fish: fishTank, bunny: bunnyHop, space: spaceTrip, weather: islandWeather, dance: danceParty };

// Draw channel `key`'s show at t seconds into ctx's W × H canvas.
export function drawShow(ctx, key, t, W, H, env = { time: 0.3, weather: 'clear' }) {
  ctx.save();
  (SHOWS[key] ?? fishTank)(ctx, t, W, H, env);
  ctx.restore();
}

// Static between channels: a fuzz of grey dots.
export function drawStatic(ctx, W, H) {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
