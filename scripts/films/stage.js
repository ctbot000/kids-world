// The film stage: Adventure Isle's intro and ending films (films.js) shot
// with the game's own renderer, on the isle's own maps (shared/isle-maps.js),
// with its own models, a frame at a time on a clock of the film's own, and
// each frame put together with its captions and title cards in a canvas of
// its own. make-films.mjs drives it in a browser and makes the video.
import * as THREE from '/vendor/three.module.js';
import { buildAtlas } from '/js/render/atlas.js';
import { ANIM } from '/js/render/avatar.js';
import { Renderer } from '/js/render/renderer.js';
import { blobShadow, mesh, toon } from '/js/render/toon.js';
import * as B from '/js/shared/blocks.js';
import { buildIsle } from '/js/shared/isle-maps.js';
import { palette } from '/js/shared/worldgen.js';

export const W = 1280;
export const H = 720;
export const FPS = 30;

const canvas = document.getElementById('world');
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
export const renderer = new Renderer(canvas, buildAtlas());
renderer.setQuality({ level: 'high', studs: true, pixelRatio: 1.5, far: 240 });
const frameCanvas = document.createElement('canvas');
frameCanvas.width = W;
frameCanvas.height = H;
const ctx = frameCanvas.getContext('2d');

// ------------------------------------------------------------ worlds

const made = new Map();
// The island of a stage, as the isle has it (a fixed seed, so the film is the
// same each time it is made); freed: every camp freed and every gate open, as
// at the end of the story.
export function isle(stage, { freed = false } = {}) {
  const key = `${stage}:${freed}`;
  if (made.has(key)) return made.get(key);
  const m = buildIsle({ stage, seed: 20261107 + stage });
  const { world } = m;
  if (freed) {
    for (const g of m.gates) for (let k = 0; k < g.cells.length; k += 4) world.set(g.cells[k], g.cells[k + 1], g.cells[k + 2], g.cells[k + 3]);
    const pal = palette(world.theme);
    for (let x = 0; x < world.W; x++) {
      for (let z = 0; z < world.D; z++) {
        for (let y = 1; y < world.H - 1; y++) {
          if (world.get(x, y, z) !== B.GLOOM) continue;
          world.set(x, y, z, pal.top);
          if (world.get(x, y + 1, z) === B.AIR && (x * 7 + z * 13) % 5 === 0) world.set(x, y + 1, z, pal.flowers[(x + z) % pal.flowers.length]);
        }
      }
    }
  }
  made.set(key, m);
  return m;
}

let current = null;
function useWorld(world) {
  if (current === world) return;
  current = world;
  renderer.setWorld(world);
  renderer.terrain.buildAll();
}

// ------------------------------------------------------------ props

// A five-pointed star, glowing gold (the Star of Adventure Isle, and the
// Star Shards, smaller), with a halo round it.
const haloTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,248,200,1)');
  grad.addColorStop(0.25, 'rgba(255,220,90,0.6)');
  grad.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

export function star(size = 1, color = '#ffd84d') {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.42 : 1;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3 });
  geo.translate(0, 0, -0.14);
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, toon(color, { emissive: 0.85 }));
  body.scale.setScalar(size);
  group.add(body);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(size * 5);
  group.add(halo);
  group.userData = { body, halo };
  return group;
}

// ------------------------------------------------------------ actors

// Everyone and everything in the shot: { obj, update(t, dt) } each, its
// model's group added to the scene, gone again at the next shot.
let actors = [];
let nextId = 9000;
function clearActors() {
  for (const a of actors) {
    if (a.kind === 'avatar') renderer.removeAvatar(a.id);
    else if (a.kind === 'monster') renderer.removeMonster(a.id);
    else if (a.kind === 'critter') renderer.removeCritter(a.id);
    else a.obj.removeFromParent();
  }
  actors = [];
}

// A monster (or a boss) of a kind, standing at (x, y, z) facing yaw; act(t,
// dt) moves it about and says its state each frame: { x, y, z, yaw, state,
// air, shielded, scale }.
export function monster(kind, act) {
  const id = nextId++;
  const model = renderer.addMonster(id, kind);
  model.bubble && (model.bubble.visible = false);
  const a = { id, kind: 'monster', model, act };
  actors.push(a);
  return a;
}

// A kid (look: as the game has one), act(t, dt) → { x, y, z, yaw, anim, speed, emote }.
export function kid(look, act) {
  const id = nextId++;
  const model = renderer.addAvatar(id, look, '');
  const a = { id, kind: 'avatar', model, act };
  actors.push(a);
  return a;
}

// An animal or a vehicle (critters.js), act(t, dt) → { x, y, z, yaw, state, moving }.
export function critter(type, act) {
  const id = nextId++;
  const model = renderer.addCritter(id, type);
  const a = { id, kind: 'critter', model, act };
  actors.push(a);
  return a;
}

// Anything else (a three.js object), act(t, dt) → { x, y, z, ry, rz, scale, visible }.
export function prop(obj, act) {
  renderer.entities.add(obj);
  const a = { kind: 'prop', obj, act };
  actors.push(a);
  return a;
}

function stepActors(t, dt, night) {
  for (const a of actors) {
    const s = a.act(t, dt) ?? {};
    if (a.kind === 'monster') {
      const m = a.model;
      m.group.visible = s.visible !== false;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.y = s.yaw ?? 0;
      m.update(dt, s.state ?? 'idle', s.air ?? 0, night, Boolean(s.shielded));
      if (m.bubble) m.bubble.visible = m.bubbleRim.visible = Boolean(s.shielded);
      if (s.scale) m.group.scale.setScalar(s.scale);
      renderer.placeShadow(m.shadow, s.x, s.y, s.z, (m.shadowScale ?? 1) * (s.scale ?? 1));
      m.shadow.visible = s.visible !== false;
    } else if (a.kind === 'avatar') {
      const m = a.model;
      m.root.visible = s.visible !== false;
      m.root.position.set(s.x, s.y, s.z);
      m.root.rotation.y = s.yaw ?? 0;
      if (s.emote && m.emote !== s.emote) m.playEmote(s.emote);
      m.update(dt, s.anim ?? ANIM.idle, s.speed ?? 0);
      renderer.placeShadow(m.shadow, s.x, s.y, s.z, 1);
    } else if (a.kind === 'critter') {
      const m = a.model;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.y = s.yaw ?? 0;
      if (s.roll !== undefined) m.group.rotation.z = s.roll;
      if (s.pitch !== undefined) m.group.rotation.x = s.pitch;
      m.update(dt, s.state ?? 'idle', Boolean(s.moving), 0);
      if (m.shadow) m.shadow.visible = false;
    } else {
      const o = a.obj;
      o.visible = s.visible !== false;
      if (s.x !== undefined) o.position.set(s.x, s.y, s.z);
      if (s.ry !== undefined) o.rotation.y = s.ry;
      if (s.rz !== undefined) o.rotation.z = s.rz;
      if (s.scale !== undefined) o.scale.setScalar(Math.max(0.001, s.scale));
    }
  }
}

// ------------------------------------------------------------ the frame

// The film: shots, each { at, dur, world: made island, time (of day),
// weather, setup(shot) once as it starts (actors made there), camera(t) →
// { pos: [x, y, z], look: [x, y, z], fov }, fx(t, dt) for effects each
// frame, cut: how it comes in ('cut', 'fade', 'flash', 'white') }; and
// overlays: captions and cards, each { at, until, draw(ctx, k) } with k
// how far in (fading in and out).
let film = null;
let shotIndex = -1;
let lastT = 0;
const focus = new THREE.Vector3();

export function load(f) {
  film = f;
  let at = 0;
  for (const s of film.shots) {
    s.at = at;
    at += s.dur;
  }
  film.length = at;
  shotIndex = -1;
}

function shotAt(t) {
  let i = film.shots.findIndex((s) => t >= s.at && t < s.at + s.dur);
  if (i < 0) i = film.shots.length - 1;
  return i;
}

const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

// One frame at time t (seconds into the film), as a JPEG data URL.
export function frame(t) {
  const i = shotAt(t);
  const shot = film.shots[i];
  const local = t - shot.at;
  let dt = Math.max(0, Math.min(0.1, t - lastT));
  if (i !== shotIndex) {
    clearActors();
    renderer.effects.update(10);
    renderer.bossFx = renderer.bossFx.filter((f) => (f.dispose?.(), false));
    useWorld(shot.world.world);
    shotIndex = i;
    renderer.sky.setWeather(shot.weather ?? 'clear');
    shot.setup?.(shot);
    dt = 1 / FPS;
  }
  lastT = t;
  const time = typeof shot.time === 'function' ? shot.time(local) : (shot.time ?? 0.3);
  const night = time < 0.2 || time > 0.8;
  stepActors(local, dt, night);
  shot.fx?.(local, dt);
  const cam = shot.camera(local);
  renderer.camera.position.set(...cam.pos);
  renderer.camera.lookAt(...cam.look);
  renderer.camera.fov = cam.fov ?? 50;
  renderer.camera.updateProjectionMatrix();
  focus.set(...cam.look);
  renderer.frame(dt, { time, weather: shot.weather ?? 'clear', focus, tornado: null, satIn: 0 });
  ctx.drawImage(canvas, 0, 0, W, H);
  // Coming in: a fade from black, or a flash of white.
  const into = local < 0.6 ? 1 - local / 0.6 : 0;
  if (into && shot.cut === 'fade') {
    ctx.fillStyle = `rgba(0,0,0,${ease(into)})`;
    ctx.fillRect(0, 0, W, H);
  } else if (into && (shot.cut === 'flash' || shot.cut === 'white')) {
    ctx.fillStyle = `rgba(255,255,255,${ease(into) * (shot.cut === 'white' ? 1 : 0.8)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Going out: a fade to black, for the shot that asks for one.
  const left = shot.at + shot.dur - t;
  if (shot.out === 'fade' && left < 0.6) {
    ctx.fillStyle = `rgba(0,0,0,${ease(1 - left / 0.6)})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (const o of film.overlays) {
    if (t < o.at || t > o.until) continue;
    const k = Math.min(1, (t - o.at) / 0.45, (o.until - t) / 0.45);
    o.draw(ctx, ease(k), t - o.at);
  }
  return frameCanvas.toDataURL('image/jpeg', 0.94);
}

// ------------------------------------------------------------ overlays

const FONT = '"Fredoka", "Arial Rounded MT Bold", sans-serif';

function wrap(text, width, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// A caption at the bottom, from `at` for `secs`.
export function caption(at, secs, text) {
  return {
    at,
    until: at + secs,
    draw(c, k) {
      const font = `600 32px ${FONT}`;
      const lines = wrap(text, W * 0.78, font);
      const lh = 42;
      const h = lines.length * lh + 26;
      const w = Math.min(W * 0.86, Math.max(...lines.map((l) => c.measureText(l).width)) + 56);
      const y = H - h - 34 + (1 - k) * 10;
      c.save();
      c.globalAlpha = k;
      c.fillStyle = 'rgba(24,18,40,0.62)';
      roundRect(c, (W - w) / 2, y, w, h, 22);
      c.fill();
      c.font = font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#fffaf0';
      lines.forEach((l, i) => c.fillText(l, W / 2, y + 13 + lh * (i + 0.5)));
      c.restore();
    },
  };
}

// A name over a shot of one of the captains: its icon, name and where.
export function nameCard(at, secs, title, sub) {
  return {
    at,
    until: at + secs,
    draw(c, k, local) {
      c.save();
      c.globalAlpha = k;
      const x = 70 + (1 - k) * -30;
      c.font = `700 46px ${FONT}`;
      c.textBaseline = 'alphabetic';
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(30,20,50,0.75)';
      c.strokeText(title, x, H - 120);
      c.fillStyle = '#ffe680';
      c.fillText(title, x, H - 120);
      c.font = `600 28px ${FONT}`;
      c.lineWidth = 6;
      c.strokeText(sub, x + 4, H - 78);
      c.fillStyle = '#ffffff';
      c.fillText(sub, x + 4, H - 78);
      c.restore();
    },
  };
}

// A title card in the middle: big, gold, with a line under it.
export function titleCard(at, secs, title, sub = '', { y = H * 0.42, size = 84 } = {}) {
  return {
    at,
    until: at + secs,
    draw(c, k, local) {
      c.save();
      c.globalAlpha = k;
      const s = 0.92 + 0.08 * ease(Math.min(1, local / 1.2));
      c.translate(W / 2, y);
      c.scale(s, s);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `700 ${size}px ${FONT}`;
      c.lineJoin = 'round';
      c.lineWidth = 14;
      c.strokeStyle = 'rgba(40,24,70,0.85)';
      c.strokeText(title, 0, 0);
      const g = c.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, '#fff6b8');
      g.addColorStop(0.5, '#ffd23f');
      g.addColorStop(1, '#ff9a3d');
      c.fillStyle = g;
      c.fillText(title, 0, 0);
      if (sub) {
        c.font = `600 ${Math.round(size * 0.38)}px ${FONT}`;
        c.lineWidth = 8;
        c.strokeText(sub, 0, size * 0.85);
        c.fillStyle = '#ffffff';
        c.fillText(sub, 0, size * 0.85);
      }
      c.restore();
    },
  };
}

// Lines rolling up the screen, as the credits do, over secs.
export function roll(at, secs, lines) {
  return {
    at,
    until: at + secs,
    draw(c, k, local) {
      c.save();
      c.globalAlpha = k;
      c.fillStyle = 'rgba(12,8,28,0.45)';
      c.fillRect(W * 0.2, 0, W * 0.6, H);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const lh = 46;
      const total = lines.length * lh + H;
      const y0 = H + 20 - (local / secs) * total;
      lines.forEach((l, i) => {
        const y = y0 + i * lh;
        if (y < -40 || y > H + 40) return;
        const head = l.startsWith('#');
        c.font = head ? `700 38px ${FONT}` : `600 30px ${FONT}`;
        c.fillStyle = head ? '#ffe680' : '#ffffff';
        c.fillText(head ? l.slice(1) : l, W / 2, y);
      });
      c.restore();
    },
  };
}

export { ANIM, B, blobShadow, mesh, THREE, toon };

// How long the loaded film is, and where its poster still is.
export const lengthOf = () => film?.length ?? 0;
export const posterOf = () => film?.poster ?? null;
