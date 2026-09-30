// One visit to an island, from this player's side: the copy of the world,
// you walking about, your friends and the animals moving smoothly, the
// tools, and everything said and done. Talks to the island through a link
// (see net.js) and draws through the renderer.
import * as B from './shared/blocks.js';
import { CRITTER_INFO, unpackCritter } from './shared/critters.js';
import { advanceTime, isNight } from './shared/env.js';
import { BODY, makeBody, stepBody, unstick } from './shared/physics.js';
import { raycast } from './shared/raycast.js';
import { PROTOCOL } from './shared/room.js';
import { facingFromYaw, STAMPS } from './shared/stamps.js';
import { applyCells, buildEdit, hillEdit, paintEdit, pickEdit, REACH, stampEdit } from './shared/tools.js';
import { World } from './shared/world.js';
import { PHRASES, STICKERS as STICKER_EMOJI } from './shared/words.js';
import { ANIM } from './render/avatar.js';

export const TOOLS = [
  { key: 'build', name: 'Build', icon: '🧱', key1: 'B' },
  { key: 'pick', name: 'Pick up', icon: '✋' },
  { key: 'paint', name: 'Paint', icon: '🖌️' },
  { key: 'hills', name: 'Hills', icon: '⛰️' },
  { key: 'stamp', name: 'Stamps', icon: '🏠' },
  { key: 'friends', name: 'Animals', icon: '🐰' },
];
export const HILL_MODES = [
  { key: 'raise', name: 'Raise', icon: '⬆️' },
  { key: 'lower', name: 'Dig', icon: '⬇️' },
  { key: 'flat', name: 'Flatten', icon: '➖' },
];

const INTERP_MS = 130;
const CRITTER_INTERP_MS = 260;
const MOVE_SEND_MS = 90;
const REPEAT_MS = 230;
const UNDO_KEEP = 40;

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class Game extends EventTarget {
  constructor({ link, renderer, sound, profile, mode }) {
    super();
    this.link = link;
    this.renderer = renderer;
    this.sound = sound;
    this.profile = profile;
    this.mode = mode; // 'host', 'guest' or 'server'
    this.world = null;
    this.pid = 0;
    this.host = 0;
    this.code = '';
    this.token = '';
    this.settings = { build: 'everyone', locked: false, day: 'cycle' };
    this.players = new Map();
    this.critters = new Map();
    this.env = { time: 0.3, weather: 'clear', mode: 'cycle' };
    this.chat = [];
    this.me = null;
    this.tool = 'build';
    this.size = 1;
    this.slot = 0;
    this.stamp = STAMPS[0].key;
    this.hillMode = 'raise';
    this.critterType = 'bunny';
    this.basketPick = null; // a basket key, when planting fruit or placing a shell or star
    this.seq = 0;
    this.pending = new Map();
    this.undoStack = [];
    this.target = null;
    this.previewKey = '';
    this.holding = null;
    this.lastMoveSent = 0;
    this.lastState = '';
    this.stepAcc = 0;
    this.wasInWater = false;
    this.seenNight = false;
    this.seenRainbow = false;
    this.closed = false;
    this.onMessage = (e) => this.receive(e.detail);
    link.addEventListener('message', this.onMessage);
  }

  // ------------------------------------------------ talking to the island

  joinMessage() {
    const p = this.profile;
    return { t: 'join', protocol: PROTOCOL, name: p.name, look: p.look, token: this.token };
  }

  send(msg) {
    this.link.send(msg);
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  receive(msg) {
    if (this.closed) return;
    switch (msg.t) {
      case 'welcome':
        this.welcome(msg);
        break;
      case 'joined':
        this.addPlayer(msg.player, true);
        break;
      case 'left':
        this.removePlayer(msg.pid, msg.kicked);
        break;
      case 'look': {
        const p = this.players.get(msg.pid);
        if (p) {
          p.look = msg.look;
          p.avatar?.setLook(msg.look);
          this.emit('players');
        }
        break;
      }
      case 'host':
        this.host = msg.pid;
        this.emit('players');
        this.emit('settings');
        break;
      case 'm':
        this.remoteMove(msg.p, msg.s);
        break;
      case 'edit':
        this.remoteEdit(msg);
        break;
      case 'ack':
        this.ack(msg);
        break;
      case 'say':
        this.said(msg);
        break;
      case 'emote':
        this.emoted(msg.pid, msg.e);
        break;
      case 'c':
        this.critterStates(msg.c);
        break;
      case 'cadd':
        this.critterAdded(msg);
        break;
      case 'cdel':
        this.critterRemoved(msg);
        break;
      case 'cfx':
        this.critterFx(msg);
        break;
      case 'env':
        this.setEnv(msg);
        break;
      case 'fx':
        if (msg.kind === 'star') this.fallingStar(msg);
        break;
      case 'settings':
        this.settings = msg.settings;
        this.emit('settings');
        break;
      case 'notice':
        this.emit('notice', { text: msg.text, level: msg.level ?? 'warn' });
        if (msg.level !== 'info') this.sound.play('no');
        break;
      case 'error':
        this.emit('fatal', { code: msg.code, text: msg.text });
        break;
      default:
        break;
    }
  }

  welcome(msg) {
    const again = Boolean(this.world) && this.code === msg.code;
    this.pid = msg.you;
    this.host = msg.host;
    this.code = msg.code;
    this.token = msg.token;
    this.settings = msg.settings;
    this.chat = msg.chat ?? [];
    const keep = again && this.me ? { x: this.me.body.x, y: this.me.body.y, z: this.me.body.z } : null;
    this.world = World.decode(msg.meta, msg.blocks);
    this.renderer.setWorld(this.world);
    this.renderer.terrain.buildAll();
    this.pending.clear();
    this.undoStack = [];
    for (const pid of [...this.players.keys()]) this.removePlayer(pid, false, true);
    for (const id of [...this.critters.keys()]) this.dropCritter(id);
    const spawn = this.world.spawn;
    const body = makeBody(keep?.x ?? spawn.x, keep?.y ?? spawn.y, keep?.z ?? spawn.z);
    unstick(this.world, body);
    this.me = { body, yaw: Math.PI, anim: ANIM.idle, speed: 0 };
    for (const p of msg.players) this.addPlayer(p, false);
    const names = new Map(msg.critters.map((c) => [c.id, c]));
    for (const row of msg.pack) {
      const c = unpackCritter(row);
      if (c) this.addCritter({ ...c, name: names.get(c.id)?.name ?? '' });
    }
    this.setEnv(msg.env);
    this.renderer.view.yaw = Math.PI * 0.9;
    this.emit('welcome', { again });
    this.emit('players');
    this.emit('settings');
  }

  // ------------------------------------------------ players

  addPlayer(p, announce) {
    if (p.id === this.pid) {
      this.players.set(p.id, { id: p.id, name: p.name, look: p.look, me: true });
      const a = this.renderer.addAvatar(p.id, p.look, p.name);
      this.players.get(p.id).avatar = a;
      this.emit('players');
      return;
    }
    const old = this.players.get(p.id);
    if (old?.avatar) this.renderer.removeAvatar(p.id);
    const player = { id: p.id, name: p.name, look: p.look, snaps: [], avatar: this.renderer.addAvatar(p.id, p.look, p.name), anim: 0, bubble: null };
    this.players.set(p.id, player);
    if (p.s) this.remoteMove(p.id, p.s, true);
    this.emit('players');
    if (announce) {
      this.sound.play('join');
      this.emit('toast', { icon: '👋', text: `${p.name} came to play!` });
      if (this.pid === this.host) this.profile.count('guests');
    }
  }

  removePlayer(pid, kicked = false, quiet = false) {
    const p = this.players.get(pid);
    if (!p) return;
    this.renderer.removeAvatar(pid);
    this.players.delete(pid);
    this.emit('players');
    if (!quiet && pid !== this.pid) {
      this.sound.play('leave');
      this.emit('toast', { icon: '👋', text: kicked ? `${p.name} went home.` : `${p.name} went home. Bye bye!` });
    }
  }

  remoteMove(pid, s, jump = false) {
    const p = this.players.get(pid);
    if (!p || p.me || !Array.isArray(s)) return;
    const now = performance.now();
    p.snaps.push({ t: now, x: s[0], y: s[1], z: s[2], yaw: s[3], anim: s[4], flags: s[5] });
    if (p.snaps.length > 12) p.snaps.shift();
    if (jump) p.snaps = [p.snaps[p.snaps.length - 1]];
  }

  // Where a friend should be drawn: a little in the past, between two updates.
  interpolate(snaps, delay) {
    const t = performance.now() - delay;
    if (snaps.length === 0) return null;
    let a = snaps[0];
    if (t <= a.t) return a;
    for (let i = 1; i < snaps.length; i++) {
      const b = snaps[i];
      if (b.t >= t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: lerpAngle(a.yaw, b.yaw, k), anim: b.anim, state: b.state, flags: b.flags };
      }
      a = b;
    }
    return a;
  }

  // ------------------------------------------------ animals

  addCritter(c) {
    const model = this.renderer.addCritter(c.id, c.type);
    const entry = { id: c.id, type: c.type, name: c.name, snaps: [{ t: performance.now(), x: c.x, y: c.y, z: c.z, yaw: c.yaw, state: c.state }], model, last: null, voiceAt: 0 };
    this.critters.set(c.id, entry);
    return entry;
  }

  dropCritter(id) {
    this.renderer.removeCritter(id);
    this.critters.delete(id);
  }

  critterStates(rows) {
    const now = performance.now();
    const seen = new Set();
    for (const row of rows) {
      const c = unpackCritter(row);
      if (!c) continue;
      seen.add(c.id);
      let entry = this.critters.get(c.id);
      if (!entry) entry = this.addCritter({ ...c, name: '' });
      entry.snaps.push({ t: now, x: c.x, y: c.y, z: c.z, yaw: c.yaw, state: c.state });
      if (entry.snaps.length > 8) entry.snaps.shift();
    }
    for (const id of [...this.critters.keys()]) if (!seen.has(id)) this.dropCritter(id);
  }

  critterAdded(msg) {
    const c = msg.s ? unpackCritter(msg.s) : null;
    if (!c || this.critters.has(c.id)) return;
    const entry = this.addCritter({ ...c, name: msg.critter.name });
    this.renderer.effects.sparkles(c.x, c.y + 0.4, c.z, 14);
    if (msg.by === this.pid) {
      this.sound.play(entry.type);
      this.emit('toast', { icon: CRITTER_INFO[entry.type].icon, text: `${msg.critter.name} the ${CRITTER_INFO[entry.type].name.toLowerCase()} moved in!` });
    }
  }

  critterRemoved(msg) {
    const entry = this.critters.get(msg.id);
    if (!entry) return;
    const p = entry.model.group.position;
    this.renderer.effects.sparkles(p.x, p.y + 0.4, p.z, 16);
    this.renderer.effects.hearts(p.x, p.y + 0.6, p.z, 2);
    if (msg.by === this.pid) this.sound.play('bye');
    this.dropCritter(msg.id);
  }

  critterFx(msg) {
    const entry = this.critters.get(msg.id);
    if (!entry) return;
    const p = entry.model.group.position;
    this.renderer.effects.hearts(p.x, p.y + entry.model.height, p.z, msg.fx === 'yum' ? 5 : 3);
    if (this.near(p.x, p.y, p.z, 20)) {
      this.sound.play(entry.type);
      if (msg.fx === 'yum') this.sound.play('yum');
    }
  }

  // ------------------------------------------------ edits

  // Makes a change here at once and asks the island to make it for everyone.
  edit(kind, cells, { expect = null, undoable = true } = {}) {
    if (!cells.length) return false;
    const seq = ++this.seq;
    const w = this.world;
    const undo = [];
    for (let i = 0; i < cells.length; i += 4) {
      const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
      undo.push(x, y, z, w.get(x, y, z), id);
      this.pending.set(w.index(x, y, z), seq);
    }
    applyCells(w, cells);
    this.renderer.terrain.cellsChanged(cells);
    if (this.me) unstick(w, this.me.body);
    const msg = { t: 'edit', seq, kind, cells };
    if (expect) msg.expect = expect;
    this.send(msg);
    if (undoable) {
      this.undoStack.push({ kind, cells: undo });
      if (this.undoStack.length > UNDO_KEEP) this.undoStack.shift();
      this.emit('undo', this.undoStack.length);
    }
    return true;
  }

  remoteEdit(msg) {
    const w = this.world;
    if (!w) return;
    const mine = msg.by === this.pid;
    const apply = [];
    for (let i = 0; i < msg.cells.length; i += 4) {
      const [x, y, z, id] = [msg.cells[i], msg.cells[i + 1], msg.cells[i + 2], msg.cells[i + 3]];
      if (!w.inBounds(x, y, z)) continue;
      const k = w.index(x, y, z);
      const pending = this.pending.get(k);
      if (mine) {
        // Our own change coming back: settled, unless we changed it again since.
        if (pending === msg.seq) this.pending.delete(k);
        else if (pending !== undefined) continue;
      } else if (pending !== undefined) {
        // Our own newer change will arrive after this one anyway.
        continue;
      }
      if (w.get(x, y, z) !== id) apply.push(x, y, z, id);
    }
    if (apply.length) {
      applyCells(w, apply);
      this.renderer.terrain.cellsChanged(apply);
    }
    if (!mine) this.editEffects(msg.kind, msg.cells, false);
    if (this.me) unstick(w, this.me.body);
  }

  ack(msg) {
    const w = this.world;
    if (!w) return;
    const fix = [];
    for (let i = 0; i < (msg.fix?.length ?? 0); i += 4) {
      const [x, y, z, id] = [msg.fix[i], msg.fix[i + 1], msg.fix[i + 2], msg.fix[i + 3]];
      if (!w.inBounds(x, y, z)) continue;
      const k = w.index(x, y, z);
      const pending = this.pending.get(k);
      if (pending !== undefined && pending !== msg.seq) continue;
      this.pending.delete(k);
      if (w.get(x, y, z) !== id) fix.push(x, y, z, id);
    }
    // Anything else of this edit that was not echoed back has settled too.
    for (const [k, seq] of this.pending) if (seq === msg.seq) this.pending.delete(k);
    if (fix.length) {
      applyCells(w, fix);
      this.renderer.terrain.cellsChanged(fix);
    }
  }

  undo() {
    const last = this.undoStack.pop();
    this.emit('undo', this.undoStack.length);
    if (!last) {
      this.sound.play('no');
      return;
    }
    const cells = [];
    const expect = [];
    const w = this.world;
    for (let i = last.cells.length - 5; i >= 0; i -= 5) {
      const [x, y, z, before, after] = last.cells.slice(i, i + 5);
      if (w.get(x, y, z) !== after) continue;
      cells.push(x, y, z, before);
      expect.push(after);
    }
    if (this.edit('undo', cells, { expect, undoable: false })) {
      this.sound.play('pop');
      for (let i = 0; i < Math.min(cells.length, 40); i += 4) this.renderer.effects.sparkles(cells[i] + 0.5, cells[i + 1] + 0.5, cells[i + 2] + 0.5, 2);
    }
  }

  editEffects(kind, cells, mine) {
    const fx = this.renderer.effects;
    const n = cells.length / 4;
    const first = [cells[0], cells[1], cells[2]];
    if (!mine && !this.near(first[0], first[1], first[2], 28)) return;
    const tint = this.renderer.atlas.studTint;
    const colorOf = (id) => `rgb(${tint[id * 3]},${tint[id * 3 + 1]},${tint[id * 3 + 2]})`;
    const every = Math.max(1, Math.floor(n / 24));
    for (let i = 0; i < n; i += every) {
      const [x, y, z, id] = [cells[i * 4], cells[i * 4 + 1], cells[i * 4 + 2], cells[i * 4 + 3]];
      if (kind === 'grow' || kind === 'nature') fx.sparkles(x + 0.5, y + 0.5, z + 0.5, 3);
      else if (id === B.AIR || id === B.WATER) fx.pop(x, y, z, '#ffffff', n > 4 ? 3 : 10);
      else fx.place(x, y, z, colorOf(id));
    }
    if (kind === 'grow' && this.near(first[0], first[1], first[2], 24)) this.sound.play('grow');
    if (!mine && this.near(first[0], first[1], first[2], 14)) {
      const id = cells[3];
      if (kind === 'pick') this.sound.play('pop');
      else if (kind === 'build' || kind === 'stamp') this.sound.play('place', { kind: B.block(id).sound });
    }
  }

  near(x, y, z, d) {
    if (!this.me) return false;
    const b = this.me.body;
    return Math.hypot(b.x - x, b.y - y, b.z - z) < d;
  }

  // ------------------------------------------------ talking

  say(entry) {
    this.send(entry);
    this.profile.count('said');
  }

  said(msg) {
    const text = Number.isInteger(msg.p) ? PHRASES[msg.p] : STICKER_EMOJI[msg.e];
    if (!text) return;
    this.chat.push(msg);
    if (this.chat.length > 30) this.chat.shift();
    const p = this.players.get(msg.pid);
    if (p) {
      p.bubble = { text, until: performance.now() + 4500, sticker: !Number.isInteger(msg.p) };
      if (Number.isInteger(msg.p)) this.sound.babble(text, msg.pid);
      else this.sound.play('ui');
    }
    this.emit('chat', { ...msg, text });
  }

  emote(key) {
    this.send({ t: 'emote', e: key });
    if (key === 'dance') this.profile.count('danced');
  }

  emoted(pid, key) {
    const p = this.players.get(pid);
    if (!p?.avatar) return;
    p.avatar.playEmote(key);
    p.emoteFx = { key, until: performance.now() + 2200, next: 0 };
    const pos = p.avatar.root.position;
    if (this.near(pos.x, pos.y, pos.z, 24)) this.sound.play('emote', { emote: key });
  }

  // ------------------------------------------------ time and weather

  setEnv(env) {
    this.env.time = env.time;
    this.env.weather = env.weather;
    this.env.mode = env.mode;
    this.emit('env');
  }

  fallingStar(msg) {
    this.renderer.sky.shootingStar(msg);
    this.sound.play('star');
    this.emit('toast', { icon: '🌠', text: 'A shooting star! Look for a star piece on the ground.' });
  }

  // ------------------------------------------------ tools

  selectedBlock() {
    if (this.basketPick) {
      const c = B.COLLECTABLES.find((x) => x.key === this.basketPick);
      return c ? c.sprout || c.item : 0;
    }
    return this.profile.data.hotbar[this.slot] ?? B.GRASS;
  }

  // Everything the pointer could mean: an animal, a block, or nothing.
  aim(ndc) {
    if (!this.world || !this.me) return null;
    const ray = this.renderer.ray(ndc.x, ndc.y);
    const tool = this.tool;
    const w = this.world;
    const stopAt = (id, x, y, z, start) => {
      if (id === B.AIR) return false;
      const kind = B.KIND[id];
      if (kind === B.K_WATER) return (tool === 'build' || tool === 'stamp' || tool === 'friends') && start !== B.WATER && !this.basketPick;
      if (kind === B.K_ITEM) return true;
      if (kind === B.K_PLANT) return tool !== 'hills';
      return true;
    };
    const eye = { x: this.me.body.x, y: this.me.body.y + BODY.eye, z: this.me.body.z };
    const maxDist = REACH + this.renderer.camDist;
    const hit = raycast(w, ray.origin.x, ray.origin.y, ray.origin.z, ray.dir.x, ray.dir.y, ray.dir.z, maxDist, stopAt);
    const critter = this.renderer.pickCritter(ray, maxDist);
    if (critter && (!hit || critter.dist < hit.dist)) {
      const m = this.critters.get(critter.id)?.model.group.position;
      if (m && Math.hypot(m.x - eye.x, m.y - eye.y, m.z - eye.z) <= REACH) return { kind: 'critter', id: critter.id };
    }
    if (!hit) return null;
    if (Math.hypot(hit.x + 0.5 - eye.x, hit.y + 0.5 - eye.y, hit.z + 0.5 - eye.z) > REACH) return { kind: 'far' };
    return { kind: 'block', hit };
  }

  // The change the current tool would make at a hit, and how to show it.
  plan(hit) {
    const w = this.world;
    const facing = facingFromYaw(this.renderer.view.yaw);
    if (B.KIND[hit.id] === B.K_ITEM) return { kind: 'collect', ...pickEdit(w, hit, 1), mode: 'remove' };
    switch (this.tool) {
      case 'build': {
        const id = this.selectedBlock();
        if (this.basketPick && (this.profile.basket[this.basketPick] ?? 0) <= 0) return { kind: 'build', cells: [], collected: [], mode: 'add', empty: true };
        const body = { ...this.me.body, radius: BODY.radius + 0.02 };
        return { kind: 'build', ...buildEdit(w, hit, id, this.basketPick ? 1 : this.size, [body]), mode: 'add' };
      }
      case 'pick':
        return { kind: 'pick', ...pickEdit(w, hit, this.size), mode: 'remove' };
      case 'paint': {
        const id = this.profile.data.hotbar[this.slot];
        return { kind: 'paint', ...paintEdit(w, hit, id, this.size), mode: 'paint' };
      }
      case 'hills':
        return { kind: 'hills', ...hillEdit(w, hit, this.hillMode, this.size), mode: 'mixed' };
      case 'stamp':
        return { kind: 'stamp', ...stampEdit(w, hit, this.stamp, facing), mode: 'add' };
      case 'friends':
        return { kind: 'invite', cells: [], collected: [], mode: 'none', spot: hit };
      default:
        return null;
    }
  }

  // Shows what would happen under the pointer (desktop only: fingers do not hover).
  updatePreview(ndc) {
    const r = this.renderer;
    if (!ndc || !this.world || this.uiBlocking) {
      this.target = null;
      r.showPreview(null);
      r.showOutline(null);
      this.previewKey = '';
      return;
    }
    const aim = this.aim(ndc);
    this.target = aim;
    if (!aim || aim.kind !== 'block') {
      r.showPreview(null);
      r.showOutline(null);
      this.previewKey = '';
      this.emit('aim', aim);
      return;
    }
    const h = aim.hit;
    const key = `${h.x},${h.y},${h.z},${h.nx},${h.ny},${h.nz},${this.tool},${this.size},${this.slot},${this.stamp},${this.hillMode},${this.basketPick},${facingFromYaw(r.view.yaw)},${this.world.get(h.x, h.y, h.z)}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    const plan = this.plan(h);
    this.plannedFor = key;
    this.planned = plan;
    if (!plan || plan.mode === 'none') {
      r.showPreview(null);
      r.showOutline([h.x, h.y, h.z]);
    } else {
      r.showPreview(plan.cells, plan.mode === 'mixed' ? 'add' : plan.mode);
      r.showOutline(plan.kind === 'build' || plan.kind === 'stamp' ? null : [h.x, h.y, h.z]);
    }
    this.emit('aim', aim);
  }

  // A tap or click at a point on the screen.
  use(ndc, secondary = false) {
    if (!this.world || !this.me) return;
    const aim = this.aim(ndc);
    if (!aim) return;
    if (aim.kind === 'far') {
      this.emit('notice', { text: 'That is too far away. Walk closer!', level: 'info' });
      this.sound.play('no');
      return;
    }
    if (aim.kind === 'critter') {
      this.touchCritter(aim.id);
      return;
    }
    const tool = this.tool;
    if (secondary && tool !== 'pick') {
      // Right-click always picks up, whatever the tool.
      const plan = pickEdit(this.world, aim.hit, 1);
      this.commit({ kind: 'pick', ...plan }, aim.hit);
      return;
    }
    const plan = this.plan(aim.hit);
    if (!plan) return;
    if (plan.kind === 'invite') {
      this.invite(aim.hit);
      return;
    }
    if (plan.empty) {
      this.emit('notice', { text: 'Your basket is empty. Find some more first!', level: 'info' });
      this.sound.play('no');
      return;
    }
    this.commit(plan, aim.hit);
  }

  commit(plan, hit) {
    const cells = plan.cells;
    if (!cells.length) {
      this.sound.play('no');
      return;
    }
    const kind = plan.kind === 'collect' ? 'pick' : plan.kind;
    if (!this.edit(kind, cells)) return;
    this.previewKey = '';
    this.editEffects(kind, cells, true);
    const p = this.profile;
    const n = cells.length / 4;
    const first = cells[3];
    switch (plan.kind) {
      case 'build':
        this.sound.play('place', { kind: B.block(first).sound });
        if (this.basketPick) {
          p.addToBasket(this.basketPick, -1);
          if (B.block(first).grows) p.count('sprouts');
        } else if (B.KIND[first] === B.K_PLANT) {
          p.count('planted', n);
          if (B.block(first).grows) p.count('sprouts', n);
        } else p.count('placed', n);
        break;
      case 'pick':
      case 'collect':
        this.sound.play('pop');
        p.count('picked', n);
        break;
      case 'paint':
        this.sound.play('paint');
        p.count('painted', n);
        break;
      case 'hills':
        this.sound.play('hills');
        p.count('hills');
        break;
      case 'stamp':
        this.sound.play('stamp');
        p.count('stamps');
        this.renderer.effects.sparkles(hit.x + 0.5, hit.y + 1.5, hit.z + 0.5, 20);
        break;
      default:
        break;
    }
    if (plan.collected?.length) this.collect(plan.collected, cells);
  }

  collect(ids, cells) {
    const p = this.profile;
    for (const id of ids) {
      const key = B.block(id).collect;
      if (!key) continue;
      p.addToBasket(key, 1);
      if (B.FRUIT_ITEMS.includes(id)) p.count('fruit');
      else if (id === B.SHELL) p.count('shells');
      else if (id === B.STAR_PIECE) p.count('stars');
      this.emit('collected', { key, id });
    }
    this.sound.play('collect');
    this.renderer.effects.sparkles(cells[0] + 0.5, cells[1] + 0.6, cells[2] + 0.5, 12, ['#ffd84d', '#ffffff', '#ff8fc4']);
  }

  touchCritter(id) {
    const entry = this.critters.get(id);
    if (!entry) return;
    if (this.tool === 'friends') {
      this.send({ t: 'critter', op: 'bye', id });
      return;
    }
    const fruit = this.basketPick && B.FRUITS.some(([k]) => k === this.basketPick) ? this.basketPick : null;
    if (fruit && (this.profile.basket[fruit] ?? 0) > 0) {
      this.send({ t: 'critter', op: 'feed', id, fruit });
      this.profile.addToBasket(fruit, -1);
      this.profile.count('fed');
      this.emit('toast', { icon: '💕', text: `${entry.name || 'Your friend'} loves it! Now they will follow you for a while.` });
    } else {
      this.send({ t: 'critter', op: 'pet', id });
    }
    this.profile.count('petted');
  }

  invite(hit) {
    const x = hit.x + hit.nx + 0.5;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz + 0.5;
    this.send({ t: 'critter', op: 'invite', type: this.critterType, x, y, z });
    this.profile.count('invited');
  }

  setTool(tool) {
    this.tool = tool;
    if (tool !== 'build') this.basketPick = tool === 'friends' ? null : this.basketPick;
    this.previewKey = '';
    this.emit('tool');
  }

  // ------------------------------------------------ each frame

  update(dt, input) {
    if (!this.world || !this.me) return;
    const env = this.env;
    env.time = advanceTime(env.time, dt, env.mode);
    this.moveMe(dt, input);
    this.sendMove();
    this.updatePlayers(dt);
    this.updateCritters(dt);
    // Holding the button down (after a moment) keeps building or picking as you sweep.
    const hold = this.holding;
    if (hold && performance.now() >= hold.at && this.tool !== 'stamp' && this.tool !== 'friends') {
      hold.at = performance.now() + REPEAT_MS;
      hold.acted = true;
      const ndc = input.hoverNdc() ?? hold.ndc;
      if (ndc) this.use(ndc);
    }
    this.updatePreview(input.hoverNdc());
    const b = this.me.body;
    if (this.portrait) {
      const v = this.renderer.view;
      v.yaw = lerpAngle(v.yaw, this.me.yaw, Math.min(1, dt * 4));
      v.pitch += (0.12 - v.pitch) * Math.min(1, dt * 4);
      v.dist += (3.4 - v.dist) * Math.min(1, dt * 4);
    }
    this.renderer.updateCamera(dt, b);
    this.selfVisible(this.renderer.camDist > 1.3);
    this.renderer.frame(dt, { time: env.time, weather: env.weather, focus: { x: b.x, y: b.y, z: b.z } });
    this.observe();
  }

  selfVisible(on) {
    const a = this.players.get(this.pid)?.avatar;
    if (a) a.root.visible = on;
  }

  moveMe(dt, input) {
    const me = this.me;
    const b = me.body;
    const w = this.world;
    const move = input.readMove();
    const yaw = this.renderer.view.yaw;
    // Forward is away from the camera.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const mx = fx * move.y + -fz * move.x;
    const mz = fz * move.y + fx * move.x;
    const wasGround = b.onGround;
    const events = stepBody(w, b, { mx, mz, jump: input.jump, down: input.down, run: input.run }, dt, { autoJump: this.profile.settings.autoJump });
    const speed = Math.hypot(b.vx, b.vz);
    if (speed > 0.3) me.yaw = lerpAngle(me.yaw, Math.atan2(b.vx, b.vz), Math.min(1, dt * 12));
    me.speed = speed;
    me.anim = b.flying ? ANIM.fly : b.inWater ? ANIM.swim : !b.onGround ? ANIM.air : speed > 5.8 ? ANIM.run : speed > 0.4 ? ANIM.walk : ANIM.idle;
    const fxs = this.renderer.effects;
    if (events.jumped) this.sound.play('jump');
    if (events.landed > 7 && !wasGround) {
      this.sound.play('land');
      fxs.dust(b.x, b.y, b.z);
    }
    if (events.splashed || (b.inWater && !this.wasInWater && b.vy < -2)) {
      this.sound.play('splash');
      fxs.splash(b.x, b.y + 0.8, b.z);
    }
    if (b.inWater && !this.wasInWater) this.profile.count('swims');
    this.wasInWater = b.inWater;
    if (b.onGround && speed > 0.5) {
      this.stepAcc += speed * dt;
      if (this.stepAcc > 1.1) {
        this.stepAcc = 0;
        const under = w.get(Math.floor(b.x), Math.floor(b.y - 0.1), Math.floor(b.z));
        this.sound.play('step', { kind: B.block(under).sound });
        this.profile.count('steps');
      }
    }
    if (b.y > 40) this.profile.count('highest', Math.floor(b.y), { max: true });
    const self = this.players.get(this.pid);
    if (self?.avatar) {
      const a = self.avatar;
      a.root.position.set(b.x, b.y, b.z);
      a.root.rotation.y = me.yaw;
      a.update(dt, me.anim, speed);
      this.renderer.placeShadow(a.shadow, b.x, b.y, b.z);
    }
  }

  // Turns the camera round to look at you from the front (while choosing how you look).
  setPortrait(on, shift = 0) {
    const v = this.renderer.view;
    if (on && !this.portrait) {
      this.portrait = { yaw: v.yaw, pitch: v.pitch, dist: v.dist };
      v.shift = shift;
    } else if (!on && this.portrait) {
      Object.assign(v, this.portrait, { shift: 0 });
      this.portrait = null;
    }
  }

  toggleFly() {
    const b = this.me?.body;
    if (!b) return;
    b.flying = !b.flying;
    if (b.flying) b.vy = 4;
    this.sound.play(b.flying ? 'jump' : 'land');
    this.emit('fly', b.flying);
  }

  sendMove() {
    const now = performance.now();
    if (now - this.lastMoveSent < MOVE_SEND_MS) return;
    const b = this.me.body;
    const s = [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +this.me.yaw.toFixed(2), this.me.anim, b.flying ? 1 : 0];
    const key = s.join(',');
    if (key === this.lastState && now - this.lastMoveSent < 1000) return;
    this.lastState = key;
    this.lastMoveSent = now;
    this.send({ t: 'm', s });
  }

  updatePlayers(dt) {
    const now = performance.now();
    for (const p of this.players.values()) {
      if (p.me || !p.avatar) continue;
      const s = this.interpolate(p.snaps, INTERP_MS);
      if (!s) continue;
      const a = p.avatar;
      const prev = a.root.position;
      const speed = Math.hypot(s.x - prev.x, s.z - prev.z) / Math.max(dt, 1e-3);
      a.root.position.set(s.x, s.y, s.z);
      a.root.rotation.y = s.yaw;
      a.update(dt, s.anim, Math.min(speed, 8));
      this.renderer.placeShadow(a.shadow, s.x, s.y, s.z);
      if (p.bubble && p.bubble.until < now) p.bubble = null;
    }
    // Emote effects: hearts, notes and so on above whoever is emoting.
    for (const p of this.players.values()) {
      const e = p.emoteFx;
      if (!e || !p.avatar) continue;
      if (e.until < now) {
        p.emoteFx = null;
        continue;
      }
      if (now < e.next) continue;
      const pos = p.avatar.root.position;
      const fx = this.renderer.effects;
      if (e.key === 'hearts') fx.hearts(pos.x, pos.y + 1.5, pos.z, 1);
      else if (e.key === 'dance') fx.notes(pos.x, pos.y + 1.6, pos.z);
      else if (e.key === 'sleepy') fx.zzz(pos.x, pos.y + 1.5, pos.z);
      else if (e.key === 'surprise' && !e.done) {
        fx.bang(pos.x, pos.y + 1.7, pos.z);
        e.done = true;
      } else if (e.key === 'cheer' || e.key === 'clap') fx.sparkles(pos.x, pos.y + 1.6, pos.z, 2);
      e.next = now + (e.key === 'sleepy' ? 600 : 350);
    }
    const self = this.players.get(this.pid);
    if (self?.bubble && self.bubble.until < now) self.bubble = null;
  }

  updateCritters(dt) {
    const now = performance.now();
    const night = isNight(this.env.time);
    for (const c of this.critters.values()) {
      const s = this.interpolate(c.snaps, CRITTER_INTERP_MS);
      if (!s) continue;
      const m = c.model;
      const prev = m.group.position.clone();
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.y = s.yaw;
      const moving = Math.hypot(s.x - prev.x, s.z - prev.z) > 0.004;
      const state = s.state ?? 'idle';
      m.update(dt, state, moving);
      this.renderer.placeShadow(m.shadow, s.x, s.y, s.z, 1);
      m.shadow.visible = m.shadow.visible && c.type !== 'butterfly';
      if (state === 'sleep' && c.type !== 'butterfly' && now > (c.zzzAt ?? 0)) {
        c.zzzAt = now + 1400 + Math.random() * 800;
        if (this.near(s.x, s.y, s.z, 30)) this.renderer.effects.zzz(s.x, s.y + m.height, s.z);
      }
      // Now and then an animal says hello, if you are near.
      if (!night && now > c.voiceAt && this.near(s.x, s.y, s.z, 9)) {
        c.voiceAt = now + 9000 + Math.random() * 14000;
        if (c.type !== 'butterfly') this.sound.play(c.type);
      }
    }
  }

  // Things worth a sticker that just happen: night skies and rainbows.
  observe() {
    const night = isNight(this.env.time);
    if (night && !this.seenNight) {
      this.seenNight = true;
      this.profile.count('nights');
    }
    if (this.env.weather === 'rainbow' && !this.seenRainbow) {
      this.seenRainbow = true;
      this.profile.count('rainbows');
    }
    this.sound.setMood(night ? 'night' : 'day', this.env.weather);
  }

  close() {
    this.closed = true;
    this.link.removeEventListener('message', this.onMessage);
    for (const pid of [...this.players.keys()]) this.renderer.removeAvatar(pid);
    for (const id of [...this.critters.keys()]) this.renderer.removeCritter(id);
    this.players.clear();
    this.critters.clear();
    this.renderer.showPreview(null);
    this.renderer.showOutline(null);
  }
}
