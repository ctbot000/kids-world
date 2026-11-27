// What is far off behind a story of the Storybook: its sky (a sun, or the moon
// and stars), and paper scenery standing at three depths behind the page —
// hills, sea and islands, castles, clouds, quills — so that as you run along,
// what is further off slides by more slowly, as in a pop-up book. And down
// every pit, what you would fall into: water, ink, or the clouds far below.
import * as THREE from '../../../vendor/three.module.js';
import { hash2 } from '../../shared/rng.js';
import { blob, canvas, cutout, ellipse, polygon, shade, starPath, textureOf } from './paint.js';
import { BOOK_D } from './themes.js';

// How far behind the page each layer stands, and how many metres across the
// picture each repeat of it looks (at that depth); each painted from what
// looks 6 m under the page's foot to 20 m over it, as seen from the camera
// at its usual height.
const LAYERS = [
  { z: -150, period: 90, key: 'far' },
  { z: -70, period: 60, key: 'mid' },
  { z: -24, period: 36, key: 'near' },
];
const LOW = -6;
const HIGH = 20;

export class Backdrop {
  constructor(level, theme, key) {
    this.level = level;
    this.theme = theme;
    this.key = key;
    this.group = new THREE.Group();
    this.group.name = 'book-backdrop';
    this.time = 0;
    this.disposables = [];
    // The sky: a gradient, always filling the picture, far behind everything.
    const sky = canvas(4, 256);
    const sctx = sky.getContext('2d');
    const g = sctx.createLinearGradient(0, 0, 0, 256);
    theme.sky.forEach((c, i) => g.addColorStop(i / (theme.sky.length - 1), c));
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 4, 256);
    this.skyMat = new THREE.MeshBasicMaterial({ map: textureOf(sky), depthWrite: false, toneMapped: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.position.z = -400;
    this.group.add(this.sky);
    this.own(this.sky);
    // The sun, or the moon (and stars about it at night).
    this.sun = this.orb();
    this.group.add(this.sun);
    if (theme.night) {
      this.stars = this.starField();
      this.group.add(this.stars);
    }
    this.clouds = this.cloudLayer();
    this.group.add(this.clouds);
    // The scenery.
    this.layers = LAYERS.map((L, i) => this.layer(L, i));
    for (const l of this.layers) this.group.add(l.mesh);
    // Down the pits.
    this.pits = this.pitFill();
    this.group.add(this.pits.back, this.pits.front);
  }

  own(mesh) {
    this.disposables.push(mesh);
    return mesh;
  }

  dispose() {
    for (const m of this.disposables) {
      m.geometry?.dispose();
      m.material?.map?.dispose();
      m.material?.dispose();
    }
  }

  // Each frame: the sky kept filling the picture round the camera (cam: its x
  // and y, how far it is from the page and how wide it sees, in degrees).
  frame(dt, cam, camera) {
    this.time += dt;
    const D = camera.position.z;
    const far = D + 400;
    const h = 2 * far * Math.tan(((camera.fov * Math.PI) / 180) / 2);
    this.sky.scale.set(h * camera.aspect * 1.2, h * 1.2, 1);
    this.sky.position.set(camera.position.x, camera.position.y, -400);
    // The sun (or moon) stands still in the sky, well up and to one side.
    const hs = 2 * (D + 300) * Math.tan(((camera.fov * Math.PI) / 180) / 2);
    this.sun.position.set(camera.position.x + 0.28 * hs * camera.aspect, camera.position.y + 0.3 * hs, -300);
    if (this.stars) {
      this.stars.position.set(camera.position.x * 0.98, camera.position.y * 0.98, -320);
      this.stars.material.opacity = 0.75 + 0.25 * Math.sin(this.time * 1.7);
    }
    this.clouds.position.x = (this.time * 0.9) % 400;
    // The water (or ink, or clouds) down the pits, waving.
    this.pits.frontMat.map && (this.pits.frontMat.map.offset.x = (this.time * 0.08) % 1);
    this.pits.back.material.map && (this.pits.back.material.map.offset.x = (-this.time * 0.03) % 1);
  }

  orb() {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    const t = this.theme;
    if (t.night) {
      // A crescent moon with a sleepy face (the cheese moon of the story is
      // the page itself: up here it is only the moon).
      cutout(ctx, ellipse(128, 128, 92, 92), '#fff3c4', { line: 5, edge: 8, top: 36, bottom: 220 });
      ctx.fillStyle = 'rgba(230,200,120,0.45)';
      for (const [x, y, r] of [
        [100, 100, 14],
        [150, 160, 18],
        [160, 95, 9],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.save();
      ctx.translate(128, 128);
      ctx.fillStyle = shade(t.sun, -0.05);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath();
        ctx.moveTo(-12, 70);
        ctx.lineTo(0, 118);
        ctx.lineTo(12, 70);
        ctx.fill();
      }
      ctx.restore();
      cutout(ctx, ellipse(128, 128, 66, 66), t.sun, { line: 4, edge: 6, top: 60, bottom: 196 });
    }
    const mat = new THREE.MeshBasicMaterial({ map: textureOf(c), transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const m = this.own(new THREE.Mesh(new THREE.PlaneGeometry(26, 26), mat));
    m.renderOrder = -9;
    return m;
  }

  starField() {
    const n = 220;
    const pos = [];
    for (let i = 0; i < n; i++) pos.push((hash2(3, i, 1) - 0.5) * 700, (hash2(3, i, 2) - 0.3) * 300, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const c = canvas(32, 32);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff8d8';
    ctx.beginPath();
    starPath(16, 16, 15, 5, 4, 0)(ctx);
    ctx.fill();
    const mat = new THREE.PointsMaterial({ map: textureOf(c), size: 5, sizeAttenuation: true, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const p = new THREE.Points(geo, mat);
    p.renderOrder = -9;
    this.disposables.push(p);
    return p;
  }

  // Paper clouds drifting slowly across the sky.
  cloudLayer() {
    const c = canvas(512, 256);
    const ctx = c.getContext('2d');
    const col = this.theme.clouds;
    cutout(ctx, (x) => {
      blob(150, 150, 90, 50, 0.05, 2, 10)(x);
      x.moveTo(330, 140);
      blob(300, 130, 120, 70, 0.06, 5, 11)(x);
      x.moveTo(420, 160);
      blob(400, 160, 80, 45, 0.05, 9, 9)(x);
    }, col, { line: 0, edge: 7, top: 60, bottom: 220, shadeK: 0.08, grain: 0.03 });
    const tex = textureOf(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: this.theme.night ? 0.55 : 0.95 });
    const group = new THREE.Group();
    const { w } = this.level;
    for (let i = 0; i < 9; i++) {
      const m = this.own(new THREE.Mesh(new THREE.PlaneGeometry(60, 30), i ? mat : mat));
      m.position.set(-200 + (i / 9) * (w + 400) + hash2(7, i, 1) * 30, 30 + hash2(7, i, 2) * 26, -240);
      m.renderOrder = -8;
      group.add(m);
    }
    return group;
  }

  // A layer of scenery: a strip of paper cut-outs, repeating along the page.
  // Further off, it is bigger by as much as it is further from the camera, so
  // it looks as big as painted from the camera's usual height, and slides by
  // more slowly.
  layer(L, i) {
    const t = this.theme;
    const c = canvas(2048, 512);
    const ctx = c.getContext('2d');
    paintScenery(ctx, this.key, L.key, t, i);
    const tex = textureOf(c, { repeat: true });
    const k = 1 - L.z / BOOK_D;
    const width = this.level.w + 70 * k;
    const y0 = this.level.start.y + 2.4;
    const yb = y0 + (LOW - y0) * k;
    const yt = y0 + (HIGH - y0) * k;
    tex.repeat.set(width / (L.period * k), 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const mesh = this.own(new THREE.Mesh(new THREE.PlaneGeometry(width, yt - yb), mat));
    mesh.position.set(this.level.w / 2, (yb + yt) / 2, L.z);
    mesh.renderOrder = -7 + i;
    return { mesh, L };
  }

  // Whatever is down the pits: a back of it behind the ground, and its top in
  // front of anyone falling in, waving.
  pitFill() {
    const t = this.theme.pit;
    const pits = [];
    const L = this.level;
    let run = null;
    for (let i = 0; i <= L.w; i++) {
      const open = i < L.w && L.at(i, 0) === 0 && L.at(i, 1) === 0;
      if (open && !run) run = { x0: i };
      if (!open && run) {
        run.x1 = i;
        pits.push(run);
        run = null;
      }
    }
    // A strip of it, painted once.
    const c = canvas(512, 256);
    const ctx = c.getContext('2d');
    paintPit(ctx, t);
    const tex = textureOf(c, { repeat: true });
    const back = canvas(64, 64);
    const bctx = back.getContext('2d');
    const bg = bctx.createLinearGradient(0, 0, 0, 64);
    bg.addColorStop(0, shade(t.fill, 0.1));
    bg.addColorStop(1, shade(t.fill, -0.45));
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, 64, 64);
    const backMat = new THREE.MeshBasicMaterial({ map: textureOf(back), depthWrite: false, toneMapped: false, fog: false });
    const frontMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: 0.92 });
    const bpos = [];
    const fpos = [];
    const fuv = [];
    for (const p of pits) {
      const x0 = p.x0 - 0.2;
      const x1 = p.x1 + 0.2;
      bpos.push(...quad(x0, -8, x1, PIT_TOP - 0.1, -0.7));
      fpos.push(...quad(p.x0 - 0.05, -8, p.x1 + 0.05, PIT_TOP, 0.65));
      const u0 = p.x0 / 8;
      const u1 = p.x1 / 8;
      fuv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.Float32BufferAttribute(bpos.length ? bpos : quad(0, -9, 0.01, -8.9, -0.7), 3));
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos.length ? fpos : quad(0, -9, 0.01, -8.9, 0.65), 3));
    fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv.length ? fuv : [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    const buv = [];
    for (let i = 0; i < bgeo.attributes.position.count; i++) buv.push(0.5, (bgeo.attributes.position.getY(i) + 8) / 9);
    bgeo.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
    const b = this.own(new THREE.Mesh(bgeo, backMat));
    b.renderOrder = 1;
    const f = this.own(new THREE.Mesh(fgeo, frontMat));
    f.renderOrder = 30;
    return { back: b, front: f, frontMat, list: pits };
  }
}

// How high the water (or ink, or cloud) comes up a pit.
const PIT_TOP = 1.8;

const quad = (x0, y0, x1, y1, z) => [x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z];

// The top of the water (or ink, or clouds) in a pit, a strip 8 m wide that
// repeats: waves along its top, and under them the colour, going darker down.
function paintPit(ctx, t) {
  const W = 512;
  const H = 256;
  const top = 26;
  if (t.kind === 'clouds') {
    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * W;
      cutout(ctx, blob(x, top + 40, 50, 30, 0.05, i + 3, 9), i % 2 ? t.fill : shade(t.fill, 0.12), { line: 0, edge: 0, shadeK: 0, grain: 0.02 });
    }
    ctx.fillStyle = t.fill;
    ctx.fillRect(0, top + 40, W, H);
    return;
  }
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, t.light);
  g.addColorStop(0.12, t.fill);
  g.addColorStop(1, shade(t.fill, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, top + Math.sin((x / W) * Math.PI * 8) * 7);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = t.kind === 'ink' ? 0.35 : 0.8;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, top + Math.sin((x / W) * Math.PI * 8) * 7);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Glints.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.ellipse(hash2(4, i, 1) * W, top + 30 + hash2(4, i, 2) * 120, 18, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A strip of scenery for one layer (far, mid or near) of a story: 2048 by 512
// px, repeating side to side, its foot at the bottom.
function paintScenery(ctx, story, layer, t, depth) {
  const W = 2048;
  const H = 512;
  const seed = depth * 17 + story.length;
  const col = layer === 'far' ? t.far : layer === 'mid' ? t.mid : [t.near, shade(t.near, -0.1)];
  const edge = layer === 'near' ? 6 : 5;
  // (Painted a little low: lifted to where it looks right from the camera.)
  ctx.translate(0, -{ far: 25, mid: 70, near: 110 }[layer]);
  const ground = (c, y0, amp, waves, fill, s = seed) => {
    // (From a little past either side, so no edge of it shows where it repeats.)
    const path = (x) => {
      x.moveTo(-30, H + 200);
      for (let i = -1; i <= 65; i++) {
        const u = i / 64;
        const y = y0 - amp * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * waves + s)) - amp * 0.3 * Math.sin(u * Math.PI * 2 * (waves * 2 + 1) + s * 2);
        x.lineTo(u * W, y);
      }
      x.lineTo(W + 30, H + 200);
      x.closePath();
    };
    cutout(c, path, fill, { line: 3, edge, top: y0 - amp * 1.5, bottom: H + 200, shadeK: 0.12 });
  };
  switch (story) {
    case 'harbor':
      if (layer === 'far') {
        // The sea out to the horizon, and islands on it.
        ctx.fillStyle = shade(t.mid[1], 0.25);
        ctx.fillRect(0, 300, W, H + 200);
        for (let i = 0; i < 4; i++) cutout(ctx, (c) => c.ellipse(260 + i * 520, 302, 70 + (i % 2) * 30, 24, 0, Math.PI, 0), '#9fd18e', { line: 3, edge: 5, top: 270, bottom: 305 });
      } else if (layer === 'mid') {
        ctx.fillStyle = t.mid[1];
        ctx.fillRect(0, 380, W, H + 200);
        for (let i = 0; i < 3; i++) boat(ctx, 300 + i * 700, 382, 0.45 + (i % 2) * 0.12, ['#ffffff', '#ffe08a', '#ffb3c6'][i]);
      } else ground(ctx, 450, 30, 3, t.near);
      break;
    case 'turret':
      if (layer === 'far') {
        ground(ctx, 360, 60, 2, t.far[0]);
        for (let i = 0; i < 2; i++) castle(ctx, 500 + i * 1100, 318, 0.6, t.far[1]);
      } else if (layer === 'mid') {
        ground(ctx, 400, 40, 3, t.mid[0]);
        for (let i = 0; i < 8; i++) tree(ctx, 120 + i * 260, 400 - 20 * Math.sin(i), 0.55, t.mid[1]);
      } else ground(ctx, 455, 25, 4, t.near);
      break;
    case 'starry':
      if (layer === 'far') {
        for (let i = 0; i < 5; i++) cutout(ctx, ellipse(200 + i * 420, 110 + (i % 3) * 50, 10 + (i % 2) * 7, 10 + (i % 2) * 7), ['#ffb3c6', '#b3e5ff', '#ffe08a'][i % 3], { line: 3, edge: 4, top: 60, bottom: 220 });
        ground(ctx, 470, 30, 3, t.far[0]);
      } else if (layer === 'mid') {
        for (let i = 0; i < 6; i++) cutout(ctx, blob(170 + i * 340, 400, 150, 70, 0.07, i + 2, 10), t.mid[i % 2], { line: 3, edge: 5, top: 320, bottom: 470, shadeK: 0.1 });
      } else for (let i = 0; i < 8; i++) cutout(ctx, blob(130 + i * 256, 470, 120, 50, 0.06, i + 9, 10), t.near, { line: 3, edge: 6, top: 410, bottom: 520, shadeK: 0.1 });
      break;
    case 'inkwell':
      if (layer === 'far') {
        ground(ctx, 400, 50, 2, t.far[0]);
        for (let i = 0; i < 3; i++) bottle(ctx, 350 + i * 680, 360, 0.55, t.far[1]);
      } else if (layer === 'mid') {
        ground(ctx, 430, 30, 3, t.mid[0]);
        for (let i = 0; i < 6; i++) quill(ctx, 160 + i * 340, 428, 0.5 + (i % 2) * 0.15, t.mid[1]);
      } else ground(ctx, 460, 24, 4, t.near);
      break;
    default:
      // Hopscotch Meadow: green hills, lollipop trees, and a hedge.
      if (layer === 'far') ground(ctx, 330, 90, 2, t.far[0]);
      else if (layer === 'mid') {
        ground(ctx, 400, 45, 3, t.mid[0]);
        for (let i = 0; i < 7; i++) tree(ctx, 150 + i * 300, 392 - 20 * Math.sin(i * 1.7), 0.5 + 0.12 * ((i * 7) % 3), '#5aa845');
      } else ground(ctx, 455, 25, 4, t.near);
      break;
  }
}

function tree(ctx, x, y, s, fill) {
  cutout(ctx, (c) => c.roundRect(x - 9 * s, y - 70 * s, 18 * s, 75 * s, 6), '#8a5a3a', { line: 3, edge: 4, top: y - 70 * s, bottom: y });
  cutout(ctx, blob(x, y - 100 * s, 55 * s, 50 * s, 0.1, Math.round(x), 9), fill, { line: 3, edge: 5, top: y - 150 * s, bottom: y - 50 * s });
}

function castle(ctx, x, y, s, fill) {
  const path = (c) => {
    const w = 260 * s;
    c.moveTo(x - w / 2, y);
    c.lineTo(x - w / 2, y - 120 * s);
    for (let i = 0; i < 6; i++) {
      const bx = x - w / 2 + (i * w) / 6;
      c.lineTo(bx, y - 140 * s);
      c.lineTo(bx + w / 12, y - 140 * s);
      c.lineTo(bx + w / 12, y - 120 * s);
      c.lineTo(bx + w / 6, y - 120 * s);
    }
    c.lineTo(x + w / 2, y);
    c.closePath();
  };
  cutout(ctx, path, fill, { line: 3, edge: 5, top: y - 140 * s, bottom: y });
  for (const dx of [-150, 150]) {
    cutout(ctx, (c) => c.rect(x + dx * s - 30 * s, y - 220 * s, 60 * s, 220 * s), shade(fill, 0.05), { line: 3, edge: 5, top: y - 220 * s, bottom: y });
    cutout(ctx, polygon([[x + dx * s - 40 * s, y - 220 * s], [x + dx * s, y - 290 * s], [x + dx * s + 40 * s, y - 220 * s]]), '#e8698a', { line: 3, edge: 4, top: y - 290 * s, bottom: y - 220 * s });
  }
}

function boat(ctx, x, y, s, sail) {
  cutout(ctx, polygon([[x - 70 * s, y - 20 * s], [x + 70 * s, y - 20 * s], [x + 50 * s, y + 10 * s], [x - 50 * s, y + 10 * s]]), '#c97b4a', { line: 3, edge: 4, top: y - 20 * s, bottom: y + 10 * s });
  cutout(ctx, polygon([[x - 4 * s, y - 25 * s], [x - 4 * s, y - 120 * s], [x + 60 * s, y - 30 * s]]), sail, { line: 3, edge: 4, top: y - 120 * s, bottom: y - 25 * s });
}

function bottle(ctx, x, y, s, fill) {
  cutout(ctx, (c) => {
    c.moveTo(x - 60 * s, y);
    c.quadraticCurveTo(x - 70 * s, y - 120 * s, x - 22 * s, y - 140 * s);
    c.lineTo(x - 22 * s, y - 190 * s);
    c.lineTo(x + 22 * s, y - 190 * s);
    c.lineTo(x + 22 * s, y - 140 * s);
    c.quadraticCurveTo(x + 70 * s, y - 120 * s, x + 60 * s, y);
    c.closePath();
  }, fill, { line: 3, edge: 5, top: y - 190 * s, bottom: y });
}

function quill(ctx, x, y, s, fill) {
  cutout(ctx, (c) => {
    c.moveTo(x, y);
    c.quadraticCurveTo(x - 40 * s, y - 160 * s, x + 10 * s, y - 300 * s);
    c.quadraticCurveTo(x + 50 * s, y - 160 * s, x + 6 * s, y);
    c.closePath();
  }, fill, { line: 3, edge: 5, top: y - 300 * s, bottom: y });
}
