// One visit to an island, from this player's side: the copy of the world,
// you walking about, your friends, the animals and any monsters moving
// smoothly, your hearts, the tools, and everything said and done. Talks to the island through a link
// (see net.js) and draws through the renderer.
import * as B from './shared/blocks.js';
import { CRITTER_INFO, mountUnder, riderAt, SURFACE, unpackCritter, waterColumn } from './shared/critters.js';
import { advanceTime, isNight } from './shared/env.js';
import { MAX_HEARTS, MONSTER_BODY, unpackMonster } from './shared/monsters.js';
import { BODY, makeBody, stepBody, unstick } from './shared/physics.js';
import { raycast } from './shared/raycast.js';
import { getOffAt, rideState, startRide, stepRide } from './shared/riding.js';
import { PROTOCOL } from './shared/room.js';
import { facingFromYaw, STAMPS } from './shared/stamps.js';
import { applyCells, buildEdit, hillEdit, paintEdit, pickEdit, REACH, stampEdit } from './shared/tools.js';
import { World } from './shared/world.js';
import { PHRASES, STICKERS as STICKER_EMOJI } from './shared/words.js';
import { ANIM, shirtColor } from './render/avatar.js';

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
// Game time, not wall-clock time: a frame that comes late cannot use up a
// speech bubble before it has been drawn.
const BUBBLE_SECS = 4.5;

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
    this.settings = { build: 'everyone', locked: false, day: 'cycle', monsters: false, passcode: false };
    // The island's passcode, known while you are its owner ('' for none),
    // and the one you typed to come in as a new visitor.
    this.passcode = '';
    this.typedPasscode = '';
    // The pass an invitation came with, which lets you in without the passcode.
    this.invitePass = '';
    this.players = new Map();
    this.critters = new Map();
    // Monsters (shared/monsters.js), while the island has them, and your hearts.
    this.monsters = new Map();
    this.hearts = MAX_HEARTS;
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
    // The flying friend that sat on your head, once one has.
    this.perchedOn = 0;
    // The animal you are riding (see shared/riding.js), and the one close
    // enough to get on.
    this.riding = null;
    this.rideTarget = 0;
    this.closed = false;
    this.onMessage = (e) => this.receive(e.detail);
    link.addEventListener('message', this.onMessage);
  }

  // ------------------------------------------------ talking to the island

  joinMessage() {
    const p = this.profile;
    return { t: 'join', protocol: PROTOCOL, name: p.name, look: p.look, token: this.token, ...(this.typedPasscode ? { passcode: this.typedPasscode } : {}), ...(this.invitePass ? { pass: this.invitePass } : {}) };
  }

  // As the owner of an island with a passcode: a pass for a friend you
  // invite, so they come in without it (see Room.givePass). Resolves with
  // it, or '' when the island gave none in a few seconds.
  askPass() {
    return new Promise((done) => {
      const got = (e) => finish(e.detail);
      const finish = (pass) => {
        clearTimeout(timer);
        this.removeEventListener('pass', got);
        done(pass);
      };
      const timer = setTimeout(() => finish(''), 4000);
      this.addEventListener('pass', got);
      this.send({ t: 'pass' });
    });
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
          if (typeof msg.name === 'string' && msg.name) p.name = msg.name;
          p.avatar?.setLook(msg.look);
          // The saddle under them changes colour with their T-shirt.
          for (const c of this.critters.values()) if (c.rider === msg.pid) c.model.setRider(shirtColor(msg.look.shirt));
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
      case 'ride':
        this.rideNews(msg);
        break;
      case 'mon':
        this.monsterStates(msg.m);
        break;
      case 'bump':
        this.bumped(msg);
        break;
      case 'hearts':
        this.setHearts(msg.hearts);
        break;
      case 'pop':
        this.popped(msg);
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
      case 'passcode':
        this.passcode = typeof msg.passcode === 'string' ? msg.passcode : '';
        this.emit('settings');
        break;
      case 'pass':
        if (typeof msg.pass === 'string') this.emit('pass', msg.pass);
        break;
      case 'error':
        this.emit('fatal', { code: msg.code, text: msg.text, wrong: msg.wrong === true, wait: msg.wait === true });
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
    this.passcode = typeof msg.passcode === 'string' ? msg.passcode : '';
    this.chat = msg.chat ?? [];
    const keep = again && this.me ? { x: this.me.body.x, y: this.me.body.y, z: this.me.body.z } : null;
    this.world = World.decode(msg.meta, msg.blocks);
    this.renderer.setWorld(this.world);
    this.renderer.terrain.buildAll();
    this.riding = null;
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
      if (c) this.addCritter({ ...c, name: names.get(c.id)?.name ?? '', rider: names.get(c.id)?.rider ?? 0 });
    }
    for (const id of [...this.monsters.keys()]) this.dropMonster(id);
    this.monsterStates(msg.monsters ?? []);
    this.setHearts(msg.hearts ?? MAX_HEARTS);
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
    const entry = { id: c.id, type: c.type, name: c.name, snaps: [{ t: performance.now(), x: c.x, y: c.y, z: c.z, yaw: c.yaw, state: c.state }], model, last: null, voiceAt: 0, rider: 0 };
    this.critters.set(c.id, entry);
    if (c.rider) this.rideNews({ id: c.id, pid: c.rider });
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
    if (this.riding?.id === msg.id) this.dismount();
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
    // A whale ridden blows water, and an elephant sprays it from its trunk.
    if (msg.fx === 'spout') {
      entry.spoutUntil = performance.now() + 2400;
      return;
    }
    if (msg.fx === 'spray') {
      entry.sprayUntil = performance.now() + 1500;
      entry.model.trick = 1.6;
      if (this.near(p.x, p.y, p.z, 30)) this.sound.play('trumpet');
      return;
    }
    this.renderer.effects.hearts(p.x, p.y + entry.model.height, p.z, msg.fx === 'yum' ? 5 : 3);
    if (this.near(p.x, p.y, p.z, 20)) {
      this.sound.play(entry.type);
      if (msg.fx === 'yum') this.sound.play('yum');
    }
  }

  // ------------------------------------------------ monsters

  monsterStates(rows) {
    if (!Array.isArray(rows)) return;
    const now = performance.now();
    const seen = new Set();
    for (const row of rows) {
      const m = unpackMonster(row);
      if (!m) continue;
      seen.add(m.id);
      let entry = this.monsters.get(m.id);
      if (!entry) {
        entry = { id: m.id, snaps: [], model: this.renderer.addMonster(m.id), grumbleAt: now + Math.random() * 4000 };
        this.monsters.set(m.id, entry);
        if (this.near(m.x, m.y, m.z, 40)) this.renderer.effects.dust(m.x, m.y, m.z);
      }
      entry.snaps.push({ t: now, x: m.x, y: m.y, z: m.z, yaw: m.yaw, state: m.state });
      if (entry.snaps.length > 8) entry.snaps.shift();
    }
    // Gone (monsters turned off, or wandered off): a puff where each was.
    for (const [id, entry] of [...this.monsters]) {
      if (seen.has(id)) continue;
      const p = entry.model.group.position;
      if (this.near(p.x, p.y, p.z, 40)) this.renderer.effects.sparkles(p.x, p.y + 0.4, p.z, 8, ['#ffffff', '#d9c8ff']);
      this.dropMonster(id);
    }
  }

  dropMonster(id) {
    this.renderer.removeMonster(id);
    this.monsters.delete(id);
  }

  setHearts(n) {
    if (!Number.isInteger(n)) return;
    this.hearts = Math.max(0, Math.min(MAX_HEARTS, n));
    this.emit('hearts', this.hearts);
  }

  // A monster bumped into someone: you are knocked back (or sent home, out of
  // hearts), and a friend gets a little burst of stars.
  bumped(msg) {
    const entry = this.monsters.get(msg.id);
    if (entry) entry.model.squash = 0.3;
    if (msg.pid !== this.pid) {
      const p = this.players.get(msg.pid)?.avatar?.root.position;
      if (p && this.near(p.x, p.y, p.z, 30)) {
        this.renderer.effects.bang(p.x, p.y + 1.7, p.z);
        this.sound.play('bump');
      }
      return;
    }
    this.setHearts(msg.hearts);
    this.sound.play('bump');
    const b = this.me?.body;
    if (!b) return;
    this.renderer.effects.bang(b.x, b.y + 1.7, b.z);
    if (msg.home) {
      // Out of hearts: back to the start of the island with all of them.
      if (this.riding) this.dismount();
      const spawn = this.world.spawn;
      Object.assign(b, { x: spawn.x, y: spawn.y, z: spawn.z, vx: 0, vy: 0, vz: 0, flying: false });
      unstick(this.world, b);
      this.renderer.view.ready = false;
      this.renderer.effects.sparkles(b.x, b.y + 1, b.z, 20);
      this.sendMove(true);
      this.emit('toast', { icon: '💖', text: 'Out of hearts! Back to the start of the island, where no monster goes.' });
      return;
    }
    // Knocked back, away from it, and up a little.
    const dx = b.x - (Number(msg.x) || b.x);
    const dz = b.z - (Number(msg.z) || b.z);
    const d = Math.hypot(dx, dz);
    const dir = d > 0.01 ? [dx / d, dz / d] : [-Math.sin(this.me.yaw), -Math.cos(this.me.yaw)];
    b.vx = dir[0] * 9;
    b.vz = dir[1] * 9;
    b.vy = Math.max(b.vy, 6);
    b.onGround = false;
    this.flashUntil = performance.now() + 1600;
  }

  // A monster popped: tapped or jumped on.
  popped(msg) {
    const entry = this.monsters.get(msg.id);
    const p = entry?.model.group.position ?? { x: msg.x, y: msg.y, z: msg.z };
    const fx = this.renderer.effects;
    if ([p.x, p.y, p.z].every(Number.isFinite) && this.near(p.x, p.y, p.z, 40)) {
      fx.sparkles(p.x, p.y + 0.4, p.z, 18, ['#ffd84d', '#ffffff', '#b18cff', '#7fe08c']);
      fx.dust(p.x, p.y, p.z);
      this.sound.play('splat');
    }
    this.dropMonster(msg.id);
    if (msg.by === this.pid) {
      const first = !this.profile.data.stats.popped;
      this.profile.count('popped');
      if (first) this.emit('toast', { icon: '👾', text: 'Pop! Tap a monster or jump on it to pop it.' });
    }
  }

  // Tapping a monster (any tool will do).
  bop(id) {
    this.send({ t: 'bop', id });
  }

  // Landing on a monster pops it, and bounces you up.
  stomp() {
    const b = this.me.body;
    if (b.vy >= -0.5 || b.onGround || b.inWater) return;
    for (const entry of this.monsters.values()) {
      if (entry.stomped) continue;
      const m = entry.model.group.position;
      if (Math.hypot(m.x - b.x, m.z - b.z) > MONSTER_BODY.radius + BODY.radius) continue;
      const up = b.y - m.y;
      if (up < MONSTER_BODY.height * 0.5 || up > MONSTER_BODY.height + 0.5) continue;
      entry.stomped = true;
      this.bop(entry.id);
      b.vy = 9;
      this.sound.play('jump');
      return;
    }
  }

  updateMonsters(dt) {
    const now = performance.now();
    const night = isNight(this.env.time);
    const cam = this.renderer.camera.position;
    for (const entry of this.monsters.values()) {
      const s = this.interpolate(entry.snaps, CRITTER_INTERP_MS);
      if (!s) continue;
      const m = entry.model;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.y = s.yaw;
      m.group.visible = Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z) < m.seen;
      if (!m.group.visible) {
        m.shadow.visible = false;
        continue;
      }
      const ground = this.renderer.groundUnder(s.x, s.y, s.z);
      m.update(dt, s.state ?? 'idle', ground === null ? 9 : s.y - ground, night);
      this.renderer.placeShadow(m.shadow, s.x, s.y, s.z, 1);
      if (s.state === 'chase' && now > entry.grumbleAt && this.near(s.x, s.y, s.z, 10)) {
        entry.grumbleAt = now + 3500 + Math.random() * 4000;
        this.sound.play('grumble');
      }
    }
  }

  // ------------------------------------------------ riding

  // Someone got on an animal, or off it (pid 0).
  rideNews(msg) {
    const entry = this.critters.get(msg.id);
    if (!entry) return;
    const was = entry.rider;
    entry.rider = msg.pid;
    if (was && was !== msg.pid) {
      // Its last rider, still drawn on its back for a moment after.
      entry.lastRider = was;
      entry.leftAt = performance.now();
    }
    const look = this.players.get(msg.pid)?.look;
    entry.model.setRider(msg.pid && look ? shirtColor(look.shirt) : null);
    if (msg.pid === this.pid && this.riding?.id !== entry.id) this.mount(entry);
    else if (was === this.pid && msg.pid !== this.pid && this.riding?.id === entry.id) this.dismount();
    this.emit('ride');
  }

  // The big animal you could get on: the nearest one beside you that nobody
  // is riding.
  findRideable() {
    if (this.riding || !this.me) return 0;
    const b = this.me.body;
    let best = 0;
    let near = Infinity;
    for (const c of this.critters.values()) {
      const r = CRITTER_INFO[c.type]?.ride;
      if (!r || c.rider || !c.model.group.visible) continue;
      const p = c.model.group.position;
      const d = Math.hypot(p.x - b.x, p.z - b.z) - r.radius;
      const up = b.y - p.y;
      if (d < 2 && d < near && up > -1.6 && up < (r.sea ? 1.4 : r.seat + 0.6)) {
        best = c.id;
        near = d;
      }
    }
    return best;
  }

  // Q, or the Ride button: on the animal beside you, or off the one you are on.
  toggleRide() {
    if (this.riding) {
      this.getOff();
      return;
    }
    const id = this.rideTarget;
    if (!id) {
      this.emit('notice', { text: 'Walk up to a big animal to ride it!', level: 'info' });
      this.sound.play('no');
      return;
    }
    this.send({ t: 'critter', op: 'ride', id });
  }

  // Up on its back (the island said yes): from now on you move it, and the
  // island puts it under you.
  mount(entry) {
    const m = entry.model.group;
    const ride = startRide(this.world, entry.type, { x: m.position.x, y: m.position.y, z: m.position.z, yaw: m.rotation.y });
    if (!ride) {
      this.send({ t: 'critter', op: 'off' });
      this.emit('notice', { text: `There is no room to ride ${entry.name || 'it'} here. Lead them somewhere more open!`, level: 'info' });
      return;
    }
    const b = this.me.body;
    ride.id = entry.id;
    // A little hop up onto its back.
    ride.hop = { t: 0, x: b.x, y: b.y, z: b.z };
    this.riding = ride;
    b.flying = false;
    this.emit('fly', false);
    this.sound.play('jump');
    this.sound.play(entry.type);
    const info = CRITTER_INFO[entry.type];
    const how = this.touch ? 'Tap 👋 Get off to get down.' : 'Press Q to get off.';
    const trick = { leap: 'Jump to leap!', spout: 'Jump to blow water!', spray: 'Jump to spray water!' }[ride.r.trick] ?? 'Jump to jump!';
    this.emit('toast', { icon: info.icon, text: `You are riding ${entry.name || `the ${info.name.toLowerCase()}`}! ${trick} ${how}` });
    this.profile.count('rides');
    if (ride.r.sea) this.profile.count('searides');
    this.emit('ride');
  }

  // Getting off, at once: the island is told where you left it.
  getOff() {
    const ride = this.riding;
    // Not in the middle of a leap.
    if (!ride || ride.leap) return;
    this.sendMove(true);
    this.send({ t: 'critter', op: 'off' });
    this.dismount();
  }

  // Down beside it (or, if it went away, off where it was), and on foot again.
  dismount() {
    const ride = this.riding;
    if (!ride) return;
    this.riding = null;
    const at = getOffAt(this.world, ride);
    const b = this.me.body;
    Object.assign(b, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, onGround: false, flying: false });
    unstick(this.world, b);
    const entry = this.critters.get(ride.id);
    if (entry) {
      // It stays where it was left, until the island says where it goes next.
      const r = ride.body;
      entry.snaps = [{ t: performance.now(), x: r.x, y: r.y, z: r.z, yaw: ride.yaw, state: 'idle' }];
      entry.model.setRider(null);
    }
    this.sound.play('land');
    this.emit('ride');
  }

  // Your animal, moved as you steer it, and you on its back.
  moveRide(dt, input) {
    const ride = this.riding;
    const me = this.me;
    const move = input.readMove();
    const yaw = this.renderer.view.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    // Down (Shift, or ⬇️) dives at sea (and gets off on land: see pressDown).
    const ev = stepRide(this.world, ride, { mx: fx * move.y + -fz * move.x, mz: fz * move.y + fx * move.x, jump: input.jump, down: input.down, run: input.run }, dt);
    const r = ride.body;
    const seat = riderAt(ride.type, { x: r.x, y: r.y, z: r.z, yaw: ride.yaw });
    const b = me.body;
    Object.assign(b, { x: seat.x, y: seat.y, z: seat.z, vx: r.vx, vy: r.vy, vz: r.vz, onGround: r.onGround, inWater: false });
    const speed = Math.hypot(r.vx, r.vz);
    me.yaw = ride.yaw;
    me.speed = speed;
    me.anim = ANIM.ride;
    const fxs = this.renderer.effects;
    const entry = this.critters.get(ride.id);
    if (ev.jumped) {
      this.sound.play('jump');
      if (Math.random() < 0.4) this.sound.play(ride.type);
    }
    if (ev.landed > 7) {
      this.sound.play('land');
      fxs.dust(r.x, r.y, r.z);
    }
    if (ev.leapt || ev.splashed) {
      const top = this.surfaceAt(r.x, r.z);
      if (top !== null) fxs.splash(r.x, top, r.z);
      this.sound.play('splash');
    }
    if (ev.trick) {
      const now = performance.now();
      if (now > (ride.trickAt ?? 0)) {
        ride.trickAt = now + 2600;
        this.send({ t: 'critter', op: 'trick' });
      }
    }
    // Hoofbeats, or big soft paws.
    if (r.onGround && speed > 0.5) {
      this.stepAcc += speed * dt;
      if (this.stepAcc > (speed > ride.r.walk * 1.1 ? 1.6 : 1)) {
        this.stepAcc = 0;
        this.sound.play('hoof', { big: ride.type === 'elephant' || ride.type === 'polarbear' });
        this.profile.count('steps');
      }
    }
    // A unicorn leaves sparkles where it goes.
    if (ride.type === 'unicorn' && speed > 1 && Math.random() < dt * 14) fxs.sparkles(r.x - Math.sin(ride.yaw) * 0.6, r.y + 0.7, r.z - Math.cos(ride.yaw) * 0.6, 2, ['#ff9ec7', '#fff08a', '#8fd3ff', '#c7a4ff']);
    if (b.y > 40) this.profile.count('highest', Math.floor(b.y), { max: true });
    const self = this.players.get(this.pid);
    if (self?.avatar) {
      const a = self.avatar;
      let { x, y, z } = seat;
      if (ride.hop) {
        // Hopping up from where you stood.
        const h = ride.hop;
        h.t += dt;
        const k = Math.min(1, h.t / 0.3);
        x = h.x + (x - h.x) * k;
        y = h.y + (y - h.y) * k + Math.sin(Math.PI * k) * 0.5;
        z = h.z + (z - h.z) * k;
        if (k >= 1) ride.hop = null;
      }
      a.root.position.set(x, y, z);
      a.root.rotation.y = ride.yaw;
      a.ride = ride.r;
      a.update(dt, ANIM.ride, speed);
      a.shadow.visible = false;
    }
    if (entry) entry.model.setRider(shirtColor(this.profile.look.shirt));
  }

  // Shift or ⬇️ pressed: off the animal you are riding on land (at sea, it
  // dives, as long as it is held).
  pressDown() {
    if (this.riding && !this.riding.r.sea) this.getOff();
  }

  // Where an animal with someone on it is drawn: under you, as you move it;
  // under a friend, from where they are drawn. Null when it is on its own.
  mountPose(c) {
    if (this.riding?.id === c.id) {
      const r = this.riding.body;
      return { x: r.x, y: r.y, z: r.z, yaw: this.riding.yaw, state: c.spoutUntil > performance.now() ? 'spout' : rideState(this.riding) };
    }
    const recent = c.lastRider && performance.now() - c.leftAt < 600 ? c.lastRider : 0;
    const p = this.players.get(c.rider || recent);
    if (!p || p.me || !p.avatar || !p.seated) return null;
    const a = p.avatar.root;
    const at = mountUnder(c.type, { x: a.position.x, y: a.position.y, z: a.position.z, yaw: a.rotation.y });
    return { ...at, state: this.ridden(c, at) };
  }

  // How an animal a friend is riding moves, from how it is drawn going.
  ridden(c, at) {
    const r = CRITTER_INFO[c.type].ride;
    if (c.spoutUntil > performance.now()) return 'spout';
    if (r.sea) return at.y > (this.surfaceAt(at.x, at.z) ?? Infinity) ? 'jump' : 'swim';
    if (this.world.get(Math.floor(at.x), Math.floor(at.y + 0.5), Math.floor(at.z)) === B.WATER) return 'swim';
    const ground = this.renderer.groundUnder(at.x, at.y, at.z);
    if (ground !== null && at.y - ground > 0.35) return 'jump';
    const hs = c.model.hs;
    return hs > r.walk * 1.1 ? 'run' : hs > 0.4 ? 'walk' : 'idle';
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
    this.changed(cells);
    if (this.me) unstick(w, this.riding?.body ?? this.me.body);
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
      this.changed(apply);
    }
    if (!mine) this.editEffects(msg.kind, msg.cells, false);
    if (this.me) unstick(w, this.riding?.body ?? this.me.body);
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
      this.changed(fix);
    }
  }

  // Blocks of this copy of the world just changed: redraw them, and the map.
  changed(cells) {
    this.renderer.terrain.cellsChanged(cells);
    this.emit('cells', cells);
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

  // Something said: typed (text), a phrase (p) or a sticker (e). A long one
  // stays up a little longer, to be read.
  said(msg) {
    const typed = typeof msg.text === 'string' ? msg.text : '';
    const text = typed || (Number.isInteger(msg.p) ? PHRASES[msg.p] : STICKER_EMOJI[msg.e]);
    if (!text) return;
    this.chat.push(msg);
    if (this.chat.length > 30) this.chat.shift();
    const p = this.players.get(msg.pid);
    if (p) {
      const sticker = !typed && !Number.isInteger(msg.p);
      p.bubble = { text, left: BUBBLE_SECS + Math.min(6, [...typed].length / 20), sticker };
      if (sticker) this.sound.play('ui');
      else this.sound.babble(text, msg.pid);
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
    // A monster, before anything behind it (but a flower in front does not hide it).
    const monster = this.renderer.pickMonster(ray, maxDist);
    if (monster && (!hit || monster.dist < hit.dist + (B.KIND[hit.id] === B.K_PLANT ? 1.5 : 0))) {
      const m = this.monsters.get(monster.id)?.model.group.position;
      if (m && Math.hypot(m.x - eye.x, m.y + 0.4 - eye.y, m.z - eye.z) <= REACH + 1) return { kind: 'monster', id: monster.id };
    }
    // Not the animal you are riding, which is in the middle of the picture.
    const critter = this.renderer.pickCritter(ray, maxDist, this.riding?.id);
    // Flowers and grass are see-through: one in front of an animal, or the
    // one it stands in (a bee at a flower is inside its cell), does not hide
    // it; nor does the water hide what swims in it.
    const seeThrough = !hit ? 0 : B.KIND[hit.id] === B.K_PLANT ? 1.5 : B.KIND[hit.id] === B.K_WATER ? 8 : 0;
    if (critter && (!hit || critter.dist < hit.dist + seeThrough)) {
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
        const bodies = [{ ...this.me.body, radius: BODY.radius + 0.02, height: BODY.height }];
        if (this.riding) bodies.push({ ...this.riding.body, radius: this.riding.body.radius + 0.02 });
        return { kind: 'build', ...buildEdit(w, hit, id, this.basketPick ? 1 : this.size, bodies), mode: 'add' };
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
    if (aim.kind === 'monster') {
      this.bop(aim.id);
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
          this.spendBasket();
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

  // Uses one of the chosen treasure; when the last one is gone, back to blocks.
  spendBasket() {
    const key = this.basketPick;
    this.profile.addToBasket(key, -1);
    if ((this.profile.basket[key] ?? 0) <= 0) {
      this.basketPick = null;
      this.previewKey = '';
      this.emit('tool');
    }
  }

  // Puts the kind of block under the pointer into your hand (the middle mouse button).
  pickBlock(ndc) {
    const aim = this.aim(ndc);
    if (aim?.kind !== 'block') return null;
    const id = aim.hit.id;
    const def = B.block(id);
    if (!def.category) return null;
    const hot = [...this.profile.data.hotbar];
    const already = hot.indexOf(id);
    if (already >= 0) this.slot = already;
    else {
      hot[this.slot] = id;
      this.profile.update({ hotbar: hot });
    }
    this.basketPick = null;
    if (this.tool !== 'paint') this.setTool('build');
    this.previewKey = '';
    this.sound.play('ui');
    this.emit('tool');
    return id;
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
      this.spendBasket();
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
    this.touch = input.touchMode;
    if (this.riding) this.moveRide(dt, input);
    else this.moveMe(dt, input);
    this.rideTarget = this.findRideable();
    this.sendMove();
    this.updatePlayers(dt);
    this.updateCritters(dt);
    this.updateMonsters(dt);
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
      v.dist += (this.pose.dist - v.dist) * Math.min(1, dt * 4);
    }
    this.renderer.updateCamera(dt, b);
    this.selfVisible(this.renderer.camDist > 1.3);
    this.renderer.frame(dt, { time: env.time, weather: env.weather, focus: { x: b.x, y: b.y, z: b.z } });
    this.observe();
  }

  // Hidden while you look through your own eyes, and blinking for a moment
  // after a monster bumps into you.
  selfVisible(on) {
    const a = this.players.get(this.pid)?.avatar;
    const now = performance.now();
    const blink = now < (this.flashUntil ?? 0) && Math.floor(now / 90) % 2 === 1;
    if (a) a.root.visible = on && !blink;
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
    if (this.monsters.size) this.stomp();
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
    // Walking into a wall for a while: maybe stuck in a hole. Offer a way out.
    const pushing = Math.hypot(move.x, move.y) > 0.5 && b.onGround && !b.flying && speed < 0.3;
    this.stuckFor = pushing ? (this.stuckFor ?? 0) + dt : 0;
    if (this.stuckFor > 3 && performance.now() > (this.stuckHintAt ?? 0)) {
      this.stuckHintAt = performance.now() + 90000;
      this.emit('toast', { icon: '🪽', text: 'Stuck? Press F or tap the wings to fly!' });
    }
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
  // pose: where on the screen you show, and from how far; calling again moves you there.
  setPortrait(on, pose = { shift: 0, lift: 0, dist: 3.4 }) {
    const v = this.renderer.view;
    if (on) {
      this.portrait ??= { yaw: v.yaw, pitch: v.pitch, dist: v.dist };
      this.pose = pose;
      Object.assign(v, { shift: pose.shift, lift: pose.lift });
    } else if (this.portrait) {
      Object.assign(v, this.portrait, { shift: 0, lift: 0 });
      this.portrait = null;
    }
  }

  toggleFly() {
    const b = this.me?.body;
    if (!b) return;
    // Off the animal you are riding, and up into the air.
    if (this.riding) {
      this.getOff();
      if (this.riding) return;
      b.flying = false;
    }
    b.flying = !b.flying;
    if (b.flying) b.vy = 4;
    this.sound.play(b.flying ? 'jump' : 'land');
    this.emit('fly', b.flying);
  }

  // force: now, however soon after the last time (to get off an animal
  // right where you are).
  sendMove(force = false) {
    const now = performance.now();
    if (!force && now - this.lastMoveSent < MOVE_SEND_MS) return;
    const b = this.me.body;
    const s = [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +this.me.yaw.toFixed(2), this.me.anim, b.flying ? 1 : 0];
    const key = s.join(',');
    if (!force && key === this.lastState && now - this.lastMoveSent < 1000) return;
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
      // On an animal: sitting astride it, with no shadow of their own.
      p.seated = s.anim === ANIM.ride;
      const mount = p.seated ? [...this.critters.values()].find((c) => c.rider === p.id || c.lastRider === p.id) : null;
      a.ride = mount ? CRITTER_INFO[mount.type].ride : null;
      a.update(dt, s.anim, Math.min(speed, 12));
      this.renderer.placeShadow(a.shadow, s.x, s.y, s.z);
      if (p.seated) a.shadow.visible = false;
    }
    for (const p of this.players.values()) {
      if (p.bubble && (p.bubble.left -= dt) <= 0) p.bubble = null;
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
  }

  updateCritters(dt) {
    const now = performance.now();
    const night = isNight(this.env.time);
    const cam = this.renderer.camera.position;
    for (const c of this.critters.values()) {
      const s = this.mountPose(c) ?? this.interpolate(c.snaps, CRITTER_INTERP_MS);
      if (!s) continue;
      const m = c.model;
      const prev = m.group.position.clone();
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.y = s.yaw;
      const state = s.state ?? 'idle';
      // Far enough off, an animal is too small to see, and is not drawn.
      m.group.visible = Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z) < m.seen;
      if (m.group.visible) {
        const moving = Math.hypot(s.x - prev.x, s.z - prev.z) > 0.004;
        const ground = this.renderer.groundUnder(s.x, s.y, s.z);
        m.update(dt, state, moving, ground === null ? 9 : s.y - ground);
        this.renderer.placeShadow(m.shadow, s.x, s.y, s.z, 1);
        m.shadow.visible = m.shadow.visible && m.hasShadow;
      } else {
        m.shadow.visible = false;
      }
      if (c.sprayUntil > now) this.spray(c, now);
      if (state === 'sleep' && !m.tiny && now > (c.zzzAt ?? 0)) {
        c.zzzAt = now + 1400 + Math.random() * 800;
        if (this.near(s.x, s.y, s.z, 30)) this.renderer.effects.zzz(s.x, s.y + m.height, s.z);
      }
      // Now and then an animal says hello, if you are near (and it is awake:
      // owls only at night). Seagulls and the whale are heard from further
      // off, and less often.
      const info = CRITTER_INFO[c.type];
      const far = { seagull: 24, whale: 34, dolphin: 18 }[c.type] ?? (info?.big ? 14 : 9);
      const rare = c.type === 'seagull' || c.type === 'whale' ? 2 : 1;
      if (state !== 'sleep' && night === Boolean(info?.nocturnal) && now > c.voiceAt && this.near(s.x, s.y, s.z, far)) {
        c.voiceAt = now + (9000 + Math.random() * 14000) * rare;
        if (c.type !== 'butterfly') this.sound.play(c.type);
      }
      this.onYourHead(c, s, state);
      this.seaSights(c, s, state, now);
    }
  }

  // A splash where a dolphin, a penguin or a fish leaves the water or goes
  // back in, or a penguin or a seal dives; a penguin sliding on its tummy and
  // the whale's spout, which are each worth a sticker.
  seaSights(c, s, state, now) {
    const fx = this.renderer.effects;
    const was = c.was;
    c.was = state;
    if ((c.type === 'penguin' || c.type === 'seal') && state === 'dive' && was === 'swim') {
      const top = this.surfaceAt(s.x, s.z);
      if (top !== null && this.near(s.x, s.y, s.z, 30)) fx.splash(s.x, top, s.z);
    }
    if (c.type === 'penguin' && state === 'slide' && was !== 'slide' && this.near(s.x, s.y, s.z, 25)) this.profile.count('slides');
    if (c.type === 'dolphin' || c.type === 'penguin') {
      const top = this.surfaceAt(s.x, s.z);
      const out = top !== null && s.y > top;
      if (top !== null && c.out !== undefined && out !== c.out && this.near(s.x, s.y, s.z, 40)) {
        fx.splash(s.x, top, s.z);
        if (this.near(s.x, s.y, s.z, 20)) this.sound.play('splash');
      }
      c.out = out;
    } else if (c.type === 'fish') {
      const jumping = state === 'jump';
      const top = this.surfaceAt(s.x, s.z);
      if (jumping !== Boolean(c.jumping) && top !== null && this.near(s.x, s.y, s.z, 30)) fx.splash(s.x + Math.sin(s.yaw) * (jumping ? 0.1 : 0.9), top, s.z + Math.cos(s.yaw) * (jumping ? 0.1 : 0.9));
      c.jumping = jumping;
    } else if (c.type === 'whale') {
      const spouting = state === 'spout' || c.spoutUntil > now;
      if (spouting && !c.spouting && this.near(s.x, s.y, s.z, 50)) {
        this.sound.play('spout');
        this.profile.count('spouts');
      }
      c.spouting = spouting;
      if (spouting && now >= (c.spoutAt ?? 0) && this.near(s.x, s.y, s.z, 120)) {
        c.spoutAt = now + 50;
        // Up out of the blowhole, on top towards the front.
        const x = s.x + Math.sin(s.yaw) * 0.55;
        const z = s.z + Math.cos(s.yaw) * 0.55;
        for (let i = 0; i < 3; i++) {
          fx.add('drop', x, s.y + 0.55, z, { vx: (Math.random() - 0.5) * 1.2, vy: 5 + Math.random() * 1.8, vz: (Math.random() - 0.5) * 1.2, size: 0.17, life: 1.1, gravity: 8, color: '#e9f7ff' });
        }
      }
    }
  }

  // Water spraying up and out of the elephant's trunk.
  spray(c, now) {
    if (now < (c.sprayAt ?? 0) || !this.near(c.model.group.position.x, c.model.group.position.y, c.model.group.position.z, 60)) return;
    c.sprayAt = now + 40;
    const tip = c.model.tip?.getWorldPosition(c.model.group.position.clone());
    if (!tip) return;
    const yaw = c.model.group.rotation.y;
    for (let i = 0; i < 3; i++) {
      const f = 2.2 + Math.random() * 1.2;
      this.renderer.effects.add('drop', tip.x, tip.y, tip.z, { vx: Math.sin(yaw) * f + (Math.random() - 0.5) * 0.8, vy: 4.5 + Math.random() * 1.5, vz: Math.cos(yaw) * f + (Math.random() - 0.5) * 0.8, size: 0.15, life: 1, gravity: 9, color: '#e9f7ff' });
    }
  }

  // The height of the water's surface over (x, z), or null where there is none.
  surfaceAt(x, z) {
    const w = waterColumn(this.world, x, z);
    return w ? w.top + SURFACE : null;
  }

  // A flying friend sitting on your head is worth a sticker.
  onYourHead(c, s, state) {
    const b = this.me?.body;
    if (this.perchedOn || !b || state !== 'idle' || !CRITTER_INFO[c.type]?.flies) return;
    if (Math.hypot(s.x - b.x, s.z - b.z) > 0.2 || s.y - b.y < 1.2 || s.y - b.y > 2) return;
    this.perchedOn = c.id;
    this.profile.count('perched');
    this.emit('toast', { icon: CRITTER_INFO[c.type].icon, text: `${c.name || 'A friend'} is sitting on your head!` });
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
    for (const id of [...this.monsters.keys()]) this.renderer.removeMonster(id);
    this.players.clear();
    this.critters.clear();
    this.monsters.clear();
    this.renderer.showPreview(null);
    this.renderer.showOutline(null);
  }
}
