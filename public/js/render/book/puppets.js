// The bosses of the Storybook (shared/book/bosses.js), drawn as the big paper
// puppets of a picture book: a few drawings of each (paint.js cut-outs) for
// what it is doing, swapped, squashed, stretched, tipped and shaken as its
// moves say (bossAt), and going pop in a shower of paper at the end.
import * as THREE from '../../../vendor/three.module.js';
import { blob, cheeks, cutout, ellipse, eyes, INK, mouth, polygon, rounded, Sheet, shade, starPath } from './paint.js';

const TAU = Math.PI * 2;

// Each boss: how big its drawings are on the page (w, h metres), how many
// cells of the sheet each takes (cw, ch), and its drawings by name.
const PUPPETS = {
  grumbleweed: { w: 3.0, h: 4.0, cw: 3, ch: 4, frames: { out: fit(384, 512, (c, W, H) => weed(c, W, H, 'out')), wilt: fit(384, 512, (c, W, H) => weed(c, W, H, 'wilt')), hurt: fit(384, 512, (c, W, H) => weed(c, W, H, 'hurt')) } },
  crumple: { w: 4.0, h: 3.0, cw: 4, ch: 3, frames: { walk: fit(760, 570, (c, W, H) => crab(c, W, H, 'walk', 0)), walk2: fit(760, 570, (c, W, H) => crab(c, W, H, 'walk', 1)), snap: fit(760, 570, (c, W, H) => crab(c, W, H, 'snap', 0)), stuck: fit(760, 570, (c, W, H) => crab(c, W, H, 'stuck', 0)), stuck2: fit(760, 570, (c, W, H) => crab(c, W, H, 'stuck', 1)), hurt: fit(760, 570, (c, W, H) => crab(c, W, H, 'hurt', 0)) } },
  paperdragon: { w: 4.4, h: 3.3, cw: 4, ch: 3, frames: { up: fit(720, 540, (c, W, H) => dragon(c, W, H, 'up')), down: fit(720, 540, (c, W, H) => dragon(c, W, H, 'down')), rest: fit(720, 540, (c, W, H) => dragon(c, W, H, 'rest')), hurt: fit(720, 540, (c, W, H) => dragon(c, W, H, 'hurt')) } },
  nibbles: { w: 3.4, h: 3.4, cw: 3, ch: 3, frames: { stand: fit(480, 480, (c, W, H) => mouse(c, W, H, 'stand')), hop: fit(480, 480, (c, W, H) => mouse(c, W, H, 'hop')), bowl: fit(480, 480, (c, W, H) => mouse(c, W, H, 'bowl')), nap: fit(480, 480, (c, W, H) => mouse(c, W, H, 'nap')), hurt: fit(480, 480, (c, W, H) => mouse(c, W, H, 'hurt')) } },
  inkblot: { w: 3.0, h: 4.0, cw: 3, ch: 4, frames: { glide: fit(384, 512, (c, W, H) => count(c, W, H, 'glide')), throw: fit(384, 512, (c, W, H) => count(c, W, H, 'throw')), puff: fit(384, 512, (c, W, H) => count(c, W, H, 'puff')), laugh: fit(384, 512, (c, W, H) => count(c, W, H, 'laugh')), hurt: fit(384, 512, (c, W, H) => count(c, W, H, 'hurt')) } },
};

// A drawing made for a cell dw by dh px, scaled to the cell it is given.
function fit(dw, dh, draw) {
  return (ctx, W, H) => {
    ctx.save();
    ctx.scale(W / dw, H / dh);
    draw(ctx, dw, dh);
    ctx.restore();
  };
}

export class Puppet {
  constructor(kind, A) {
    this.kind = kind;
    this.spec = PUPPETS[kind] ?? PUPPETS.grumbleweed;
    this.A = A;
    const sp = this.spec;
    const sheet = new Sheet(128, 16, 3);
    for (const [name, draw] of Object.entries(sp.frames)) sheet.add(name, draw, sp.cw, sp.ch);
    this.sheet = sheet;
    this.texture = sheet.done();
    this.group = new THREE.Group();
    this.group.name = 'book-boss';
    this.mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 12;
    this.group.add(this.mesh);
    this.frame = null;
    // Grumbleweed's three flower pots, in front of it.
    if (kind === 'grumbleweed') {
      const pots = new Sheet(128, 4, 3);
      pots.add('pot', (c, W, H) => cutout(c, polygon([[W * 0.08, H * 0.12], [W * 0.92, H * 0.12], [W * 0.78, H], [W * 0.22, H]]), '#d9774a', { line: 6, edge: 7, top: H * 0.12, bottom: H }), 2, 1);
      const pm = new THREE.MeshBasicMaterial({ map: pots.done(), transparent: true, depthWrite: false, toneMapped: false });
      const r = pots.rects.get('pot');
      this.pots = [A.x0 + 5, (A.x0 + A.x1) / 2 + 0.5, A.x1 - 5].map((x) => {
        const g = new THREE.PlaneGeometry(2.6, 1.3);
        setUv(g, r);
        const m = new THREE.Mesh(g, pm);
        m.position.set(x, A.floor + 0.65 - 0.1, 0.4);
        m.renderOrder = 14;
        this.group.add(m);
        return m;
      });
      this.potMat = pm;
    }
    this.time = 0;
    this.gone = 0;
    this.setFrame(Object.keys(sp.frames)[0]);
  }

  setFrame(name) {
    if (this.frame === name) return;
    const r = this.sheet.rects.get(name);
    if (!r) return;
    this.frame = name;
    setUv(this.mesh.geometry, r);
  }

  // Each frame, as the boss's moves say it is now (bossAt: pose); null for
  // not about.
  update(dt, pose) {
    this.time += dt;
    const m = this.mesh;
    if (!pose || pose.hide) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const sp = this.spec;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let x = pose.x;
    let y = pose.y;
    let alpha = 1;
    const face = pose.face ?? 1;
    const shake = pose.shake ? Math.sin(this.time * 60) * 0.12 * pose.shake : 0;
    switch (this.kind) {
      case 'grumbleweed': {
        this.setFrame(pose.phase === 'hurt' ? 'hurt' : (pose.droop ?? 0) > 0.3 ? 'wilt' : 'out');
        // Down in its pot, up out of it.
        y = pose.y - 1.0 - (1 - (pose.up ?? 1)) * 3.4;
        rot = (pose.sway ?? 0) + shake;
        break;
      }
      case 'crumple': {
        const look = pose.look;
        if (look === 'stuck' || look === 'up') this.setFrame(pose.phase === 'hurt' ? 'hurt' : Math.floor((pose.step ?? 0) / 3) % 2 ? 'stuck2' : 'stuck');
        else if (look === 'snap') this.setFrame('snap');
        else this.setFrame(Math.floor((pose.step ?? 0) / 2) % 2 ? 'walk2' : 'walk');
        if (look === 'up') rot = Math.sin((pose.k ?? 0) * Math.PI) * 0.6;
        if (look === 'charge') rot = -face * 0.12;
        x += shake;
        break;
      }
      case 'paperdragon': {
        const look = pose.look;
        if (look === 'rest') {
          this.setFrame(pose.phase === 'hurt' ? 'hurt' : 'rest');
          sy = 1 + Math.sin(pose.pant ?? 0) * 0.05;
        } else {
          this.setFrame(Math.sin(pose.flap ?? 0) > 0 ? 'up' : 'down');
          rot = look === 'swoop' ? -face * 0.35 : Math.sin(this.time * 2) * 0.05;
          y -= 0.4;
        }
        x += shake;
        break;
      }
      case 'nibbles': {
        const look = pose.look;
        if (look === 'nap') this.setFrame(pose.phase === 'hurt' ? 'hurt' : 'nap');
        else if (look === 'bowl') this.setFrame('bowl');
        else if (look === 'hop') {
          this.setFrame('hop');
          sy = 1.08;
          sx = 0.94;
        } else if (look === 'land') {
          this.setFrame('stand');
          sy = 0.86;
          sx = 1.1;
        } else this.setFrame('stand');
        if (look === 'nap') sy *= 1 + Math.sin((pose.snore ?? 0) * 3) * 0.03;
        x += shake;
        break;
      }
      case 'inkblot': {
        const look = pose.look;
        this.setFrame(pose.phase === 'hurt' ? 'hurt' : look === 'throw' ? 'throw' : look === 'puff' || look === 'fall' ? 'puff' : look === 'laugh' ? 'laugh' : 'glide');
        if (look === 'glide') rot = Math.sin(this.time * 2.2) * 0.06;
        if (look === 'laugh') sy = 1 + Math.sin(this.time * 18) * 0.04;
        if (look === 'puff') sy = 1 + Math.sin(this.time * 6) * 0.04;
        x += shake;
        y -= look === 'glide' || look === 'throw' || look === 'laugh' ? 0.3 : 0;
        break;
      }
      default:
        break;
    }
    // Going pop: round and round, smaller and smaller.
    if (pose.phase === 'beaten') {
      const k = Math.min(1, (pose.k ?? 0) / 2.2);
      rot = k * 9;
      sx *= 1 - k * 0.85;
      sy *= 1 - k * 0.85;
      y += k * 2.5;
      alpha = 1 - Math.max(0, k - 0.7) / 0.3;
    }
    m.position.set(x, y, 0.15);
    m.rotation.z = rot;
    m.scale.set(sp.w * sx * (face < 0 ? -1 : 1), sp.h * sy, 1);
    this.mat.opacity = alpha;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.texture.dispose();
    if (this.pots) {
      for (const p of this.pots) p.geometry.dispose();
      this.potMat.map.dispose();
      this.potMat.dispose();
    }
  }
}

export function setUv(geo, r) {
  const uv = geo.attributes.uv;
  // (PlaneGeometry: top left, top right, bottom left, bottom right.)
  uv.setXY(0, r.u0, r.v1);
  uv.setXY(1, r.u1, r.v1);
  uv.setXY(2, r.u0, r.v0);
  uv.setXY(3, r.u1, r.v0);
  uv.needsUpdate = true;
}

// ------------------------------------------------ the drawings

// Grumbleweed: a thistle as tall as a house, out of its pot: a thick stem, two
// prickly leaves, and a great purple flower for a head, grumpy (out), wilted
// (wilt: its head hanging, ready to be landed on) or hurt.
function weed(ctx, W, H, mood) {
  const cx = W / 2;
  const droop = mood === 'wilt' ? 1 : 0;
  ctx.lineCap = 'round';
  // Stem.
  cutout(ctx, (p) => {
    p.moveTo(cx - 18, H);
    p.quadraticCurveTo(cx - 30, H * 0.6, cx - 8 + droop * 30, H * 0.3 + droop * 40);
    p.lineTo(cx + 14 + droop * 30, H * 0.3 + droop * 40);
    p.quadraticCurveTo(cx - 6, H * 0.6, cx + 18, H);
    p.closePath();
  }, '#4f9a3a', { line: 5, edge: 6, top: H * 0.3, bottom: H });
  // Leaves, with prickles.
  for (const s of [-1, 1]) {
    const lx = cx + s * 60;
    const ly = H * 0.62;
    cutout(ctx, ellipse(lx, ly, 62, 24, s * 0.45 + droop * s * 0.3), '#5bb043', { line: 5, edge: 6, grain: 0.04 });
    ctx.fillStyle = '#f0ffe0';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(lx + s * (k * 26 - 30), ly - 18 + s * (k * 6), 4, 0, TAU);
      ctx.fill();
    }
  }
  // The flower head.
  const hy = H * 0.24 + droop * 60;
  const hx = cx + droop * 40;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(droop * 0.6);
  for (let k = 0; k < 14; k++) {
    ctx.save();
    ctx.rotate((k / 14) * TAU);
    cutout(ctx, ellipse(0, -96, 22, 40), mood === 'hurt' ? '#d6a4ff' : '#a466e0', { line: 4, edge: 4, grain: 0 });
    ctx.restore();
  }
  cutout(ctx, ellipse(0, 0, 80, 80), '#ffd23f', { line: 5, edge: 6, top: -80, bottom: 80 });
  ctx.__skin = '#ffd23f';
  eyes(ctx, 0, -14, 18, 60, { mood: mood === 'hurt' ? 'dizzy' : mood === 'wilt' ? 'sleepy' : 'grump', dx: 0.2 });
  mouth(ctx, 0, 30, 42, mood === 'out' ? 'grin' : 'o');
  cheeks(ctx, 0, 14, 104, 12);
  ctx.restore();
}

// Captain Crumple: a crab as wide as a cart, in a paper hat.
function crab(ctx, W, H, look, k) {
  const cx = W / 2;
  const stuck = look === 'stuck' || look === 'hurt';
  const foot = H - 10;
  const body = (c) => blob(cx, stuck ? foot - 110 : foot - 120, 190, 92, 0.05, 4, 12)(c);
  ctx.save();
  if (stuck) {
    // On his back: legs up, waving.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const lx = cx + s * (60 + i * 50);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx, foot - 160);
        ctx.lineTo(lx + s * 20, foot - 230 - ((i + k) % 2) * 26);
        ctx.stroke();
        ctx.strokeStyle = '#ec5b4c';
        ctx.lineWidth = 10;
        ctx.stroke();
      }
    }
    cutout(ctx, body, '#ffd0c0', { line: 6, edge: 8, top: foot - 200, bottom: foot - 20 });
    ctx.strokeStyle = '#ec8a7a';
    ctx.lineWidth = 5;
    for (const dy of [-30, 0, 30]) {
      ctx.beginPath();
      ctx.moveTo(cx - 120, foot - 110 + dy);
      ctx.quadraticCurveTo(cx, foot - 90 + dy, cx + 120, foot - 110 + dy);
      ctx.stroke();
    }
    ctx.__skin = '#ffd0c0';
    eyes(ctx, cx, foot - 60, 22, 90, { mood: look === 'hurt' ? 'dizzy' : 'dizzy' });
    cutout(ctx, polygon([[cx - 80, foot - 24], [cx + 80, foot - 24], [cx, foot + 6]]), '#fff4e0', { line: 5, edge: 4, grain: 0 });
    ctx.restore();
    return;
  }
  // Legs.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const lx = cx + s * (90 + i * 40);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx, foot - 100);
      ctx.lineTo(lx + s * 30, foot - ((i + k) % 2) * 22);
      ctx.stroke();
      ctx.strokeStyle = '#d64a3c';
      ctx.lineWidth = 10;
      ctx.stroke();
    }
  }
  // Claws.
  const reach = look === 'snap' ? 70 : 0;
  for (const s of [-1, 1]) {
    const clx = cx + s * (215 + reach);
    const cly = foot - 190;
    cutout(ctx, ellipse(clx, cly, 62, 44, s * 0.3), '#ec5b4c', { line: 6, edge: 6, top: cly - 44, bottom: cly + 44 });
    cutout(ctx, polygon([[clx + s * 10, cly - 6], [clx + s * 64, cly - 42 - (look === 'snap' ? 0 : 18)], [clx + s * 64, cly + 8]]), '#fff4e0', { line: 4, edge: 0, grain: 0 });
  }
  cutout(ctx, body, '#ec5b4c', { line: 6, edge: 8, top: foot - 212, bottom: foot - 28 });
  // Eyes on stalks, and the hat.
  for (const s of [-1, 1]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx + s * 40, foot - 200);
    ctx.lineTo(cx + s * 48, foot - 250);
    ctx.stroke();
  }
  ctx.__skin = '#ec5b4c';
  eyes(ctx, cx, foot - 258, 24, 96, { mood: 'grump' });
  mouth(ctx, cx, foot - 110, 70, look === 'snap' ? 'grin' : 'grump');
  cutout(ctx, polygon([[cx - 80, foot - 284], [cx, foot - 360], [cx + 80, foot - 284]]), '#fff4e0', { line: 5, edge: 5, top: foot - 360, bottom: foot - 284 });
  cutout(ctx, ellipse(cx, foot - 300, 12, 12), '#e8453c', { line: 3, edge: 0, grain: 0 });
  ctx.restore();
}

// The Paper Dragon: a kite with a dragon's head, and a tail of bows.
function dragon(ctx, W, H, look) {
  const rest = look === 'rest' || look === 'hurt';
  const cx = W / 2;
  const cy = rest ? H * 0.62 : H * 0.48;
  // Tail.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 120, cy);
  for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(cx - 120 - i * 50, cy + (i % 2 ? -40 : 40), cx - 140 - i * 50, cy + (rest ? 60 : 10));
  ctx.stroke();
  for (let i = 1; i <= 4; i++) cutout(ctx, polygon([[cx - 140 - i * 50, cy + (rest ? 60 : 10)], [cx - 160 - i * 50, cy - 16 + (rest ? 60 : 10)], [cx - 160 - i * 50, cy + 16 + (rest ? 60 : 10)]]), ['#ff5d8f', '#ffd23f', '#5bc0eb', '#9bd35a'][i - 1], { line: 3, edge: 3, grain: 0 });
  // Wings.
  const up = look === 'up';
  for (const s of [-1, 1]) {
    if (rest && s < 0) continue;
    cutout(ctx, polygon([[cx - 20, cy - 20], [cx + s * 30 - 40, cy + (up ? -170 : 70)], [cx + 70, cy - 30]]), '#ffb3c6', { line: 5, edge: 5, top: cy - 170, bottom: cy + 70 });
  }
  // The kite.
  cutout(ctx, polygon([[cx - 140, cy], [cx, cy - 90], [cx + 150, cy], [cx, cy + 80]]), '#ff8a5b', { line: 6, edge: 8, top: cy - 90, bottom: cy + 80 });
  ctx.strokeStyle = '#c8553a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 140, cy);
  ctx.lineTo(cx + 150, cy);
  ctx.moveTo(cx, cy - 90);
  ctx.lineTo(cx, cy + 80);
  ctx.stroke();
  // The head, at the front.
  const hx = cx + 170;
  const hy = cy - (rest ? -10 : 30);
  cutout(ctx, polygon([[hx - 20, hy - 60], [hx - 4, hy - 110], [hx + 14, hy - 56]]), '#ffd23f', { line: 4, edge: 4, grain: 0 });
  cutout(ctx, polygon([[hx + 20, hy - 56], [hx + 46, hy - 100], [hx + 50, hy - 46]]), '#ffd23f', { line: 4, edge: 4, grain: 0 });
  cutout(ctx, blob(hx + 10, hy, 78, 62, 0.05, 5, 11), '#e8453c', { line: 6, edge: 8, top: hy - 62, bottom: hy + 62 });
  cutout(ctx, ellipse(hx + 64, hy + 18, 38, 26), '#ff7a6a', { line: 5, edge: 0, grain: 0 });
  ctx.fillStyle = INK;
  for (const dy of [10, 24]) {
    ctx.beginPath();
    ctx.arc(hx + 82, hy + dy, 5, 0, TAU);
    ctx.fill();
  }
  ctx.__skin = '#e8453c';
  eyes(ctx, hx + 6, hy - 16, 16, 52, { mood: look === 'hurt' ? 'dizzy' : rest ? 'sleepy' : 'grump', dx: 0.6 });
  if (rest) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(hx + 110 + i * 16, hy - 20 - i * 18, 9 - i * 2, 0, TAU);
      ctx.fill();
    }
  }
}

// King Nibbles: a big grey mouse in a crown, with cheese crumbs on him.
function mouse(ctx, W, H, look) {
  const cx = W / 2;
  const foot = H - 10;
  const nap = look === 'nap' || look === 'hurt';
  const by = foot - (nap ? 120 : 140);
  // Tail.
  ctx.strokeStyle = '#ff8fb1';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 100, foot - 60);
  ctx.quadraticCurveTo(cx - 200, foot - 40, cx - 170, foot - 170);
  ctx.stroke();
  // Feet.
  for (const s of [-1, 1]) cutout(ctx, ellipse(cx + s * 60, foot - 14, 46, 20), '#ff8fb1', { line: 5, edge: 4, grain: 0 });
  // Body.
  cutout(ctx, blob(cx, by, 128, nap ? 110 : 130, 0.04, 3, 12), '#b9b2cf', { line: 6, edge: 8, top: by - 130, bottom: by + 130 });
  cutout(ctx, ellipse(cx, by + 30, 76, 80), '#e6e0f5', { line: 0, edge: 0, shadeK: 0, grain: 0.03 });
  // Arms.
  if (look === 'bowl') cutout(ctx, ellipse(cx + 120, by - 10, 56, 22, -0.4), '#b9b2cf', { line: 5, edge: 5, grain: 0 });
  // Ears.
  const hy = nap ? by - 120 : by - 150;
  for (const s of [-1, 1]) {
    cutout(ctx, ellipse(cx + s * 90, hy - 30, 60, 60), '#b9b2cf', { line: 6, edge: 7, grain: 0 });
    cutout(ctx, ellipse(cx + s * 90, hy - 30, 36, 36), '#ffb3c6', { line: 0, edge: 0, grain: 0, shadeK: 0 });
  }
  // Head (on his body), crown.
  cutout(ctx, blob(cx + 10, hy + 40, 96, 80, 0.04, 6, 11), '#c6bfdb', { line: 6, edge: 6, top: hy - 40, bottom: hy + 120 });
  cutout(ctx, polygon([[cx - 50, hy - 20], [cx - 50, hy - 80], [cx - 25, hy - 50], [cx, hy - 90], [cx + 25, hy - 50], [cx + 50, hy - 80], [cx + 50, hy - 20]]), '#ffd23f', { line: 5, edge: 5, top: hy - 90, bottom: hy - 20 });
  cutout(ctx, ellipse(cx, hy - 40, 10, 10), '#e8453c', { line: 3, edge: 0, grain: 0 });
  ctx.__skin = '#c6bfdb';
  eyes(ctx, cx + 20, hy + 30, 18, 70, { mood: look === 'hurt' ? 'dizzy' : nap ? 'shut' : 'grump' });
  cutout(ctx, ellipse(cx + 96, hy + 56, 16, 14), '#ff8fb1', { line: 4, edge: 0, grain: 0 });
  mouth(ctx, cx + 30, hy + 84, 40, nap ? 'o' : 'grin');
  // Whiskers.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const dy of [-6, 8]) {
    ctx.beginPath();
    ctx.moveTo(cx + 104, hy + 56 + dy);
    ctx.lineTo(cx + 160, hy + 48 + dy * 2);
    ctx.stroke();
  }
  if (nap) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Fredoka, sans-serif';
    ctx.fillText('z', cx + 120, hy - 40);
    ctx.font = 'bold 40px Fredoka, sans-serif';
    ctx.fillText('z', cx + 160, hy - 80);
  }
}

// Count Inkblot: a blot of ink with a top hat, a monocle and a twirly moustache.
function count(ctx, W, H, look) {
  const cx = W / 2;
  const foot = H - 10;
  const puff = look === 'puff' || look === 'hurt';
  const by = foot - (puff ? 130 : 170);
  // Drips under him.
  if (!puff) for (const dx of [-60, 10, 70]) cutout(ctx, ellipse(cx + dx, foot - 40 - (dx % 3) * 6, 14, 30), '#2b2050', { line: 4, edge: 4, grain: 0 });
  cutout(ctx, blob(cx, by, 140, puff ? 120 : 150, 0.1, 13, 13), '#2b2050', { line: 6, edge: 9, top: by - 150, bottom: by + 150 });
  ctx.fillStyle = 'rgba(160,140,220,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - 60, by - 60, 30, 46, 0.4, 0, TAU);
  ctx.fill();
  // Hands.
  for (const s of [-1, 1]) {
    const up = look === 'throw' && s > 0;
    cutout(ctx, ellipse(cx + s * 150, by + (up ? -110 : 20), 32, 28), '#ffffff', { line: 5, edge: 4, grain: 0 });
  }
  // Face.
  ctx.__skin = '#2b2050';
  eyes(ctx, cx + 10, by - 30, 24, 90, { mood: look === 'hurt' ? 'dizzy' : puff ? 'sleepy' : 'grump', ink: '#120b1f' });
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx + 55, by - 30, 34, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 85, by - 14);
  ctx.quadraticCurveTo(cx + 100, by + 40, cx + 90, by + 80);
  ctx.stroke();
  // Moustache.
  ctx.strokeStyle = '#e9e3f7';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + 10, by + 30);
    ctx.quadraticCurveTo(cx + 10 + s * 50, by + 60, cx + 10 + s * 70, by + 24);
    ctx.stroke();
  }
  if (look === 'laugh' || look === 'throw') mouth(ctx, cx + 10, by + 66, 56, 'grin', '#e9e3f7');
  else mouth(ctx, cx + 10, by + 74, 50, puff ? 'o' : 'grump', '#e9e3f7');
  // The hat (askew when he is puffed out).
  ctx.save();
  ctx.translate(cx + (puff ? 30 : 0), by - (puff ? 120 : 150));
  ctx.rotate(puff ? 0.35 : -0.08);
  cutout(ctx, rounded(-110, -14, 220, 28, 12), '#1a1028', { line: 5, edge: 6, grain: 0 });
  cutout(ctx, rounded(-70, -150, 140, 140, 10), '#1a1028', { line: 5, edge: 6, top: -150, bottom: 0 });
  ctx.fillStyle = '#9b4fd6';
  ctx.fillRect(-70, -40, 140, 18);
  cutout(ctx, starPath(0, -31, 14, 7), '#ffd23f', { line: 2, edge: 0, grain: 0 });
  ctx.restore();
}

export { shade };
