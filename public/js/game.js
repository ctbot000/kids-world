// One visit to an island, from this player's side: the copy of the world,
// you walking about, your friends, the animals and any monsters moving
// smoothly, your hearts, an adventure island's camps and flags, a tower
// defense island's waves and towers, the tools,
// and everything said and done. Talks to the island through a link (see
// net.js) and draws through the renderer.
import * as B from './shared/blocks.js';
import { critterBox, CRITTER_INFO, headTop, mountUnder, riderAt, seatsFor, SURFACE, unpackCritter, waterColumn } from './shared/critters.js';
import { advanceTime, isNight } from './shared/env.js';
import { HELP_REACH } from './shared/adventure.js';
import { BUILD_REACH, DEFENSE_STATES, MAX_LEVEL, TOWER_COST, towerTop } from './shared/defense.js';
import { ARM_REACH, bodyOf, bopGap, HIT_MS, MAX_HEARTS, STOMP, unpackMonster } from './shared/monsters.js';
import { padUnder, startLift, stepLift } from './shared/elevator.js';
import { EMOTE_TRICKS, makePet, placePet, petPose, startTrick, stepPet } from './shared/pets.js';
import { BODY, BOUNCE, keepApart, makeBody, MOVE, onTrampoline, stepBody, unstick } from './shared/physics.js';
import { raycast } from './shared/raycast.js';
import { seatNear, seatPose, standUpAt, teaTableNear } from './shared/seats.js';
import { getOffAt, rideState, startRide, stepRide } from './shared/riding.js';
import { PROTOCOL } from './shared/room.js';
import { cleanPiece, SONG_MAX_BYTES, songName, SongPieces, songPieces } from './shared/song.js';
import { gearMove, wornWeapon } from './shared/shop.js';
import { facingFromYaw, STAMPS } from './shared/stamps.js';
import { underTent } from './shared/tents.js';
import { applyCells, buildEdit, drillEdit, hillEdit, paintEdit, pickEdit, REACH, stampEdit } from './shared/tools.js';
import { World } from './shared/world.js';
import { lookHair, lookTall, petKind, PHRASES, STICKERS as STICKER_EMOJI } from './shared/words.js';
import { ANIM, shirtColor, SWINGS } from './render/avatar.js';

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

// How fast left and right turn you round looking through your own eyes (radians a second).
const TURN_SPEED = 2.4;
const INTERP_MS = 130;
const CRITTER_INTERP_MS = 260;
const MOVE_SEND_MS = 90;
const REPEAT_MS = 230;
const UNDO_KEEP = 40;
// Game time, not wall-clock time: a frame that comes late cannot use up a
// speech bubble before it has been drawn.
const BUBBLE_SECS = 4.5;
// The 👊 button: a swing at a monster no further round from straight ahead
// than this (the cosine of 70°).
const FRONT = 0.34;
// How much more than HIT_MS apart bops are sent.
const BOP_SPACING = 120;
// What each tougher monster is, told the first time one comes out near you.
const TOUGH_TOLD = {
  big: { icon: '💪', text: 'A Big Bruiser! It bumps two hearts off you and takes six bops. Jumping on it takes three.' },
  spiky: { icon: '🦔', text: 'A Spiky! Don’t jump on it, ouch! Bop it four times instead.' },
};

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
    this.song = null;
    this.songPieces = new SongPieces();
    this.typedPasscode = '';
    // The pass an invitation came with, which lets you in without the passcode.
    this.invitePass = '';
    this.players = new Map();
    this.critters = new Map();
    // Everyone's pets (shared/pets.js), by their owner: each page moves them all.
    this.pets = new Map();
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
    // An adventure island's camps and King Grumble (shared/adventure.js), as
    // the island tells of them (null on any other island); whether you sit
    // dizzy there, out of hearts, until a friend helps you up; and the
    // fireworks when it is all free.
    this.adventure = null;
    this.dizzy = false;
    this.fireworks = [];
    // A tower defense island's road, pads, towers and waves
    // (shared/defense.js), as the island tells of them (null on any other).
    this.defense = null;
    // The flying friend that sat on your head, once one has.
    this.perchedOn = 0;
    // The animal you are riding (see shared/riding.js), and the one close
    // enough to get on.
    this.riding = null;
    this.rideTarget = 0;
    // The seat you sit on (its cell, see shared/seats.js), and the one close
    // enough to sit on.
    this.seat = null;
    this.seatTarget = null;
    this.closed = false;
    this.onMessage = (e) => this.receive(e.detail);
    link.addEventListener('message', this.onMessage);
    // A new pet (or none) chosen while here: at your side at once.
    this.onProfile = () => this.syncPet(this.pid);
    profile.addEventListener('change', this.onProfile);
  }

  // ------------------------------------------------ talking to the island

  joinMessage() {
    const p = this.profile;
    return { t: 'join', protocol: PROTOCOL, name: p.name, look: p.shownLook, token: this.token, ...(this.typedPasscode ? { passcode: this.typedPasscode } : {}), ...(this.invitePass ? { pass: this.invitePass } : {}) };
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
          for (const c of this.critters.values()) {
            if (c.rider === msg.pid) c.model.setRider(shirtColor(msg.look.shirt));
            const seat = c.passengers.indexOf(msg.pid);
            if (seat >= 0) c.model.setPassenger(seat, shirtColor(msg.look.shirt));
          }
          if (msg.pid !== this.pid) this.syncPet(msg.pid);
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
      case 'swing':
        this.players.get(msg.pid)?.avatar?.swing();
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
      case 'pfx':
        // Your own taps showed at once (see touchPet).
        if (msg.by !== this.pid) this.petFx(msg);
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
      case 'adv':
        this.adventureNews(msg);
        break;
      case 'freed':
        this.campFreed(msg);
        break;
      case 'shield':
        this.shieldDown();
        break;
      case 'kinghit':
        this.kingHit(msg);
        break;
      case 'mhit':
        this.monsterHit(msg);
        break;
      case 'stomp':
        this.stomped(msg);
        break;
      case 'won':
        this.islandWon(msg);
        break;
      case 'helped':
        this.helped(msg);
        break;
      case 'def':
        this.defenseNews(msg);
        break;
      case 'zap':
        this.zapped(msg);
        break;
      case 'leak':
        this.leaked(msg);
        break;
      case 'dwave':
        this.waveNews(msg);
        break;
      case 'tower':
        this.towerBuilt(msg);
        break;
      case 'home':
        this.cameHome(msg);
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
      case 'song':
        this.songNews(msg);
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
    this.aboard = null;
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
      if (c) this.addCritter({ ...c, name: names.get(c.id)?.name ?? '', rider: names.get(c.id)?.rider ?? 0, passengers: names.get(c.id)?.passengers });
    }
    for (const id of [...this.monsters.keys()]) this.dropMonster(id);
    this.monsterStates(msg.monsters ?? []);
    this.setHearts(msg.hearts ?? MAX_HEARTS);
    this.dizzy = false;
    this.setAdventure(msg.adventure ?? null);
    this.setDefense(msg.defense ?? null);
    this.setEnv(msg.env);
    // The song goes on playing over a reconnect; its pieces come after this.
    if (msg.song?.id !== this.song?.id) this.setSong(msg.song ? { id: msg.song.id, name: songName(msg.song.name), ready: false } : null);
    this.renderer.view.yaw = Math.PI * 0.9;
    this.emit('welcome', { again });
    this.emit('players');
    this.emit('settings');
  }

  // ------------------------------------------------ the island's song

  // What is playing: null (the island music), or { id, name, ready } with
  // ready false while its pieces are still coming. blob: the song itself.
  setSong(song, blob = null) {
    this.song = song;
    this.songPieces = new SongPieces();
    this.sound.setSong(blob);
    this.emit('song');
  }

  songNews(msg) {
    if (msg.off === true) {
      if (this.song) this.setSong(null);
      return;
    }
    const piece = cleanPiece(msg);
    if (!piece || (this.song?.ready && this.song.id === piece.id)) return;
    if (this.song?.id !== piece.id) this.setSong({ id: piece.id, name: piece.name, ready: false });
    const whole = this.songPieces.add(piece);
    if (whole == null) return;
    const id = piece.id;
    fetch(`data:audio/mpeg;base64,${whole}`)
      .then((r) => r.blob())
      .then((blob) => {
        if (!this.closed && this.song?.id === id) this.setSong({ ...this.song, ready: true }, blob);
      })
      .catch(() => {});
  }

  // The owner plays an MP3 (a File, or a Blob with its name) for everyone.
  // Resolves to '' once it is on its way, or what is wrong with it.
  async playSong(file, name = file.name) {
    if (this.pid !== this.host) return 'Only the island owner can pick the song.';
    if (!(file.type === 'audio/mpeg' || /\.mp3$/i.test(name ?? ''))) return 'That is not an MP3 song.';
    if (file.size > SONG_MAX_BYTES) return `That song is too big. Pick one under ${SONG_MAX_BYTES / 1024 / 1024} MB.`;
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const base64 = url.slice(url.indexOf(',') + 1);
    if (!base64 || this.closed) return 'That song could not be read.';
    const { id, n, pieces } = songPieces(base64);
    const song = { id, name: songName(name), ready: true };
    this.setSong(song, file.type === 'audio/mpeg' ? file : new Blob([file], { type: 'audio/mpeg' }));
    pieces.forEach((data, i) => this.send({ t: 'host', cmd: 'song', id, name: song.name, i, n, data }));
    return '';
  }

  // Back to the island music, for everyone.
  stopSong() {
    if (!this.song) return;
    this.send({ t: 'host', cmd: 'song', off: true });
    this.setSong(null);
  }

  // ------------------------------------------------ players

  addPlayer(p, announce) {
    if (p.id === this.pid) {
      this.players.set(p.id, { id: p.id, name: p.name, look: p.look, me: true });
      const a = this.renderer.addAvatar(p.id, p.look, p.name);
      this.players.get(p.id).avatar = a;
      this.syncPet(p.id, { quiet: true });
      this.emit('players');
      return;
    }
    const old = this.players.get(p.id);
    if (old?.avatar) this.renderer.removeAvatar(p.id);
    const player = { id: p.id, name: p.name, look: p.look, snaps: [], avatar: this.renderer.addAvatar(p.id, p.look, p.name), anim: 0, bubble: null, dizzy: p.dizzy === true };
    this.players.set(p.id, player);
    if (p.s) {
      this.remoteMove(p.id, p.s, true);
      player.avatar.root.position.set(p.s[0], p.s[1], p.s[2]);
      player.avatar.root.rotation.y = p.s[3];
    }
    this.syncPet(p.id, { quiet: !announce });
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
    this.dropPet(pid);
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
    const entry = { id: c.id, type: c.type, name: c.name, snaps: [{ t: performance.now(), x: c.x, y: c.y, z: c.z, yaw: c.yaw, state: c.state }], model, last: null, voiceAt: 0, rider: 0, passengers: new Array(seatsFor(c.type)).fill(0) };
    this.critters.set(c.id, entry);
    if (c.rider) this.rideNews({ id: c.id, pid: c.rider });
    if (Array.isArray(c.passengers)) c.passengers.forEach((pid, i) => pid && this.rideNews({ id: c.id, pid, seat: i + 1 }));
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
      const info = CRITTER_INFO[entry.type];
      this.sound.play(entry.type);
      this.emit('toast', { icon: info.icon, text: `${msg.critter.name} the ${info.name.toLowerCase()} ${info.vehicle ? 'is here! Walk up to it to drive it.' : 'moved in!'}` });
    }
  }

  critterRemoved(msg) {
    const entry = this.critters.get(msg.id);
    if (!entry) return;
    if (this.riding?.id === msg.id) this.dismount();
    if (this.aboard?.id === msg.id) this.hopOff();
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
    // A vehicle honked, or tapped (it honks then too): its lights flash.
    if (CRITTER_INFO[entry.type].vehicle) {
      entry.model.trick = 0.7;
      if (this.near(p.x, p.y, p.z, 30)) this.sound.play('honk', { type: entry.type });
      return;
    }
    this.renderer.effects.hearts(p.x, p.y + entry.model.height, p.z, msg.fx === 'yum' ? 5 : 3);
    if (this.near(p.x, p.y, p.z, 20)) {
      this.sound.play(entry.type);
      if (msg.fx === 'yum') this.sound.play('yum');
    }
  }

  // ------------------------------------------------ pets

  // A player's pet as their look has it now: brought along (popping in
  // beside them unless quiet), changed, or gone. Yours is as your profile
  // has it, at once, even before the island hears of it.
  syncPet(pid, { quiet = false } = {}) {
    const p = this.players.get(pid);
    const look = pid === this.pid ? this.profile.look : p?.look;
    const want = p && look?.pet ? look.pet : null;
    const have = this.pets.get(pid);
    if (have && want && have.kind === want.kind && have.coat === want.coat) {
      have.name = want.name;
      have.model.setCollar(shirtColor(look.shirt));
      return;
    }
    const was = have ? { x: have.sim.x, y: have.sim.y, z: have.sim.z, yaw: have.sim.yaw, mode: have.sim.mode } : null;
    if (have) this.dropPet(pid);
    const owner = want && this.world ? this.petOwner(pid) : null;
    if (!owner) return;
    const sim = makePet(want.kind, owner.x, owner.y, owner.z, { yaw: owner.yaw, seed: (pid * 2654435761) >>> 0 || 1 });
    // A new kind where the old one was; otherwise in beside its owner.
    if (was && !petKind(want.kind)?.flies === !petKind(have.kind)?.flies && was.mode !== 'ride') {
      Object.assign(sim.body, { x: was.x, y: was.y, z: was.z });
      Object.assign(sim, { x: was.x, y: was.y, z: was.z, yaw: was.yaw });
      sim.last = { x: owner.x, y: owner.y, z: owner.z };
    } else {
      placePet(this.world, sim, owner);
    }
    const model = this.renderer.addPet(pid, want, shirtColor(look.shirt));
    model.group.position.set(sim.x, sim.y, sim.z);
    model.group.rotation.y = sim.yaw;
    this.pets.set(pid, { pid, kind: want.kind, coat: want.coat, name: want.name, sim, model, voiceAt: performance.now() + 4000 + Math.random() * 8000, zzzAt: 0 });
    if (!quiet) {
      this.renderer.effects.sparkles(sim.x, sim.y + 0.3, sim.z, 14);
      if (this.near(sim.x, sim.y, sim.z, 20)) this.sound.play(want.kind);
    }
  }

  dropPet(pid) {
    this.renderer.removePet(pid);
    this.pets.delete(pid);
  }

  // A pet's owner as this page sees them, for it to follow (see stepPet):
  // you as you are, or a friend where they are drawn. Null if not here.
  petOwner(pid) {
    const p = this.players.get(pid);
    if (!p || !this.me) return null;
    const look = p.me ? this.profile.look : p.look;
    const head = headTop(look?.hat, lookHair(look), lookTall(look));
    if (p.me) {
      const b = this.me.body;
      const speed = this.me.speed;
      return {
        x: b.x,
        y: b.y,
        z: b.z,
        yaw: this.me.yaw,
        speed,
        moving: speed > 0.5 || (!b.onGround && !b.inWater && !b.flying && !this.riding),
        flying: b.flying,
        swimming: b.inWater && !this.riding,
        riding: this.riding?.type ?? '',
        head,
        headTaken: this.headTaken(b.x, b.y + head, b.z),
        pose: Boolean(this.portrait),
      };
    }
    const a = p.avatar?.root;
    if (!a) return null;
    const s = p.snaps[p.snaps.length - 1];
    const anim = s?.anim ?? ANIM.idle;
    const last = p.petLast ?? { x: a.position.x, z: a.position.z, speed: 0 };
    const now = performance.now();
    const dt = Math.max(1e-3, (now - (last.at ?? now)) / 1000);
    const speed = last.at ? last.speed + (Math.hypot(a.position.x - last.x, a.position.z - last.z) / dt - last.speed) * Math.min(1, dt * 8) : 0;
    p.petLast = { x: a.position.x, z: a.position.z, speed, at: now };
    const mount = anim === ANIM.ride ? [...this.critters.values()].find((c) => c.rider === pid) : null;
    return {
      x: a.position.x,
      y: a.position.y,
      z: a.position.z,
      yaw: a.rotation.y,
      speed,
      moving: speed > 0.5 || anim === ANIM.air || anim === ANIM.walk || anim === ANIM.run,
      flying: anim === ANIM.fly,
      swimming: anim === ANIM.swim,
      riding: mount?.type ?? '',
      head,
      headTaken: this.headTaken(a.position.x, a.position.y + head, a.position.z),
      pose: false,
    };
  }

  // Everyone and everything standing about, as this page sees them, for
  // keeping out of each other (see physics.js keepApart): players (someone
  // riding counts as what they ride), the animals and vehicles on the
  // ground, monsters, and pets on their feet. Each has a key; skip: the one
  // asking. You are left out unless a pet is asking.
  standing(skip = `p${this.pid}`) {
    const out = [];
    const add = (key, at, radius, height) => {
      if (key !== skip) out.push({ x: at.x, y: at.y, z: at.z, radius, height, key });
    };
    for (const p of this.players.values()) {
      if (p.me) {
        if (!this.riding && !this.aboard) add(`p${p.id}`, this.me.body, BODY.radius, BODY.height);
        continue;
      }
      const s = p.snaps?.[p.snaps.length - 1];
      if (p.avatar && s?.anim !== ANIM.ride) add(`p${p.id}`, p.avatar.root.position, BODY.radius, BODY.height);
    }
    for (const c of this.critters.values()) {
      const box = critterBox(c.type);
      if (box && c.model) add(`c${c.id}`, c.model.group.position, box.radius, box.height);
    }
    for (const m of this.monsters.values()) {
      const size = bodyOf(m.kind);
      add(`m${m.id}`, m.model.group.position, size.radius, size.height);
    }
    for (const pet of this.pets.values()) {
      const sim = pet.sim;
      if (!sim.info.flies && sim.mode !== 'ride') add(`pet${pet.pid}`, sim.body, sim.body.radius, sim.body.height);
    }
    return out;
  }

  // Whether a flying friend (an animal) sits on a head at the top (x, y, z).
  headTaken(x, y, z) {
    for (const c of this.critters.values()) {
      if (!CRITTER_INFO[c.type]?.flies) continue;
      const m = c.model.group.position;
      if (Math.hypot(m.x - x, m.z - z) < 0.3 && Math.abs(m.y - y) < 0.35) return true;
    }
    return false;
  }

  // Every pet, after its owner, as this page sees them; riding along with
  // them on whatever they ride.
  updatePets(dt) {
    const night = isNight(this.env.time);
    const cam = this.renderer.camera.position;
    const now = performance.now();
    const fx = this.renderer.effects;
    for (const pet of this.pets.values()) {
      const owner = this.petOwner(pet.pid);
      if (!owner) continue;
      const sim = pet.sim;
      const ev = stepPet(this.world, sim, owner, dt, { night });
      if (!sim.info.flies && sim.mode !== 'ride' && keepApart(this.world, sim.body, this.standing(`pet${pet.pid}`), `pet${pet.pid}`)) [sim.x, sim.z] = [sim.body.x, sim.body.z];
      const m = pet.model;
      const seat = sim.mode === 'ride' ? this.petMount(pet.pid) : null;
      if (ev.boarded) pet.hop = { t: 0, x: m.group.position.x, y: m.group.position.y, z: m.group.position.z };
      let at = seat ?? { x: sim.x, y: sim.y, z: sim.z, yaw: sim.yaw };
      if (pet.hop && seat) {
        // A little hop up from where it stood.
        const h = pet.hop;
        h.t += dt;
        const k = Math.min(1, h.t / 0.35);
        at = { ...at, x: h.x + (at.x - h.x) * k, y: h.y + (at.y - h.y) * k + Math.sin(Math.PI * k) * 0.6, z: h.z + (at.z - h.z) * k };
        if (k >= 1) pet.hop = null;
      }
      m.group.position.set(at.x, at.y, at.z);
      m.group.rotation.y = at.yaw;
      // Far off, too small to see; and looking through your own eyes, a
      // parrot on your head would sit on them.
      m.group.visible = Math.hypot(at.x - cam.x, at.y - cam.y, at.z - cam.z) < m.seen && !(pet.pid === this.pid && sim.mode === 'perch' && this.renderer.camDist <= 1.3);
      if (m.group.visible) {
        m.update(dt, petPose(sim));
        this.renderer.placeShadow(m.shadow, at.x, at.y, at.z, 1);
        if (seat) m.shadow.visible = false;
      } else {
        m.shadow.visible = false;
      }
      if (ev.popped && ev.popped !== 'pose') {
        fx.sparkles(sim.x, sim.y + 0.3, sim.z, 10);
        if (this.near(sim.x, sim.y, sim.z, 16)) this.sound.play('pop');
      }
      if (ev.splashed && this.near(sim.x, sim.y, sim.z, 20)) fx.splash(sim.x, sim.y + 0.3, sim.z);
      const pose = petPose(sim);
      if (pose === 'sleep' && now > pet.zzzAt && this.near(at.x, at.y, at.z, 30)) {
        pet.zzzAt = now + 1600 + Math.random() * 800;
        fx.zzz(at.x, at.y + m.height, at.z);
      }
      // Now and then it says something, awake and near you.
      if (pose !== 'sleep' && now > pet.voiceAt && this.near(at.x, at.y, at.z, 10)) {
        pet.voiceAt = now + 20000 + Math.random() * 25000;
        this.sound.play(pet.kind);
      }
    }
  }

  // Where a pet riding along with its owner sits (on the animal or in the
  // vehicle they ride), or null when it is nowhere to be seen.
  petMount(pid) {
    const entry = pid === this.pid && this.riding ? this.critters.get(this.riding.id) : [...this.critters.values()].find((c) => c.rider === pid || (c.lastRider === pid && performance.now() - c.leftAt < 600));
    return entry ? this.renderer.petSeat(entry.model) : null;
  }

  // Petting a pet (anyone's), or giving it a fruit you are holding: it shows
  // here at once, and everyone else sees it too.
  touchPet(pid) {
    const pet = this.pets.get(pid);
    if (!pet) return;
    const fruit = this.basketPick && B.FRUITS.some(([k]) => k === this.basketPick) ? this.basketPick : null;
    if (fruit && (this.profile.basket[fruit] ?? 0) > 0) {
      this.send({ t: 'pet', op: 'feed', pid, fruit });
      this.spendBasket();
      this.profile.count('fed');
      this.petFx({ pid, by: this.pid, fx: 'yum', fruit });
    } else {
      this.send({ t: 'pet', op: 'pet', pid });
      this.petFx({ pid, by: this.pid, fx: 'pet' });
    }
    this.profile.count('petted');
    if (pid !== this.pid) this.profile.count('petpals');
  }

  // Someone petted a pet (fx: pet) or gave it a fruit (yum): it is happy, or
  // munches it.
  petFx(msg) {
    const pet = this.pets.get(msg.pid);
    if (!pet) return;
    const sim = pet.sim;
    if (sim.mode !== 'ride') startTrick(sim, msg.fx === 'yum' ? 'eat' : 'happy');
    const p = pet.model.group.position;
    this.renderer.effects.hearts(p.x, p.y + pet.model.height, p.z, msg.fx === 'yum' ? 5 : 3);
    if (this.near(p.x, p.y, p.z, 20)) {
      this.sound.play(pet.kind);
      if (msg.fx === 'yum') this.sound.play('yum');
    }
    const by = this.players.get(msg.by);
    if (msg.pid === this.pid && msg.by !== this.pid && by) this.emit('toast', { icon: petKind(pet.kind)?.icon ?? '🐾', text: msg.fx === 'yum' ? `${by.name} gave ${pet.name} a treat!` : `${by.name} petted ${pet.name}!` });
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
        entry = { id: m.id, kind: m.kind, snaps: [], model: this.renderer.addMonster(m.id, m.kind), grumbleAt: now + Math.random() * 4000 };
        this.monsters.set(m.id, entry);
        if (this.near(m.x, m.y, m.z, 40)) this.renderer.effects.dust(m.x, m.y, m.z);
        // The first tough one near you this time: what it is.
        const told = TOUGH_TOLD[m.kind];
        if (told && !this.toldKinds?.has(m.kind) && this.near(m.x, m.y, m.z, 30)) {
          (this.toldKinds ??= new Set()).add(m.kind);
          this.emit('toast', told);
        }
      }
      entry.snaps.push({ t: now, x: m.x, y: m.y, z: m.z, yaw: m.yaw, state: m.state });
      entry.hearts = m.hearts;
      entry.max = m.max;
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

  // A monster bumped into someone: you are knocked back (further by King
  // Grumble), or out of hearts sent home, or on an adventure island left
  // sitting dizzy for a friend to help up; a friend gets a little burst of stars.
  bumped(msg) {
    const entry = this.monsters.get(msg.id);
    if (entry) entry.model.squash = 0.3;
    if (msg.pid !== this.pid) {
      const p = this.players.get(msg.pid);
      if (p) p.dizzy = msg.dizzy === true;
      const at = p?.avatar?.root.position;
      if (at && this.near(at.x, at.y, at.z, 30)) {
        this.renderer.effects.bang(at.x, at.y + 1.7, at.z);
        this.sound.play('bump');
      }
      if (msg.dizzy && p) this.emit('toast', { icon: '💫', text: `${p.name} is out of hearts! Go and tap them to help them up.` });
      return;
    }
    if (msg.spiky && !this.toldSpikes) {
      this.toldSpikes = true;
      this.emit('toast', { icon: '🦔', text: 'Ouch, spikes! Bop a Spiky instead of jumping on it.' });
    }
    this.setHearts(msg.hearts);
    this.sound.play('bump');
    const b = this.me?.body;
    if (!b) return;
    // Knocked out of your seat.
    if (this.seat) this.standUp();
    this.renderer.effects.bang(b.x, b.y + 1.7, b.z);
    if (msg.home) {
      this.goHome(msg.at, this.adventure ? 'Out of hearts! Back to the nearest safe place, where no monster goes.' : 'Out of hearts! Back to the start of the island, where no monster goes.');
      return;
    }
    // Knocked back, away from it, and up a little.
    const dx = b.x - (Number(msg.x) || b.x);
    const dz = b.z - (Number(msg.z) || b.z);
    const d = Math.hypot(dx, dz);
    const dir = d > 0.01 ? [dx / d, dz / d] : [-Math.sin(this.me.yaw), -Math.cos(this.me.yaw)];
    const push = msg.big ? 13 : 9;
    b.vx = dir[0] * push;
    b.vz = dir[1] * push;
    b.vy = Math.max(b.vy, msg.big ? 7 : 6);
    b.onGround = false;
    this.flashUntil = performance.now() + 1600;
    if (msg.dizzy) {
      // Out of hearts, with friends about: sit tight for one to come.
      this.dizzy = true;
      if (this.riding) this.dismount();
      if (this.aboard) this.hopOff();
      b.flying = false;
      this.emit('fly', false);
      this.sound.play('dizzy');
      this.emit('toast', { icon: '💫', text: 'Out of hearts! Sit tight: a friend can tap you to help you up.' });
      this.emit('dizzy', true);
    }
  }

  // Back to a safe place (at, as [x, y, z]; or the start of the island), and
  // on your feet with all your hearts.
  goHome(at, text) {
    if (this.riding) this.dismount();
    if (this.aboard) this.hopOff();
    const b = this.me.body;
    const spawn = this.world.spawn;
    const [x, y, z] = Array.isArray(at) && at.length === 3 && at.every(Number.isFinite) ? at : [spawn.x, spawn.y, spawn.z];
    Object.assign(b, { x, y, z, vx: 0, vy: 0, vz: 0, flying: false });
    unstick(this.world, b);
    this.dizzy = false;
    this.emit('dizzy', false);
    this.renderer.view.ready = false;
    this.renderer.effects.sparkles(b.x, b.y + 1, b.z, 20);
    this.sendMove(true);
    this.emit('toast', { icon: '💖', text });
  }

  // A monster popped: bopped or jumped on.
  popped(msg) {
    const entry = this.monsters.get(msg.id);
    const p = entry?.model.group.position ?? { x: msg.x, y: msg.y, z: msg.z };
    const fx = this.renderer.effects;
    if ([p.x, p.y, p.z].every(Number.isFinite) && this.near(p.x, p.y, p.z, entry?.kind === 'king' ? 120 : 40)) {
      fx.sparkles(p.x, p.y + 0.4, p.z, 18, ['#ffd84d', '#ffffff', '#b18cff', '#7fe08c']);
      fx.dust(p.x, p.y, p.z);
      // King Grumble goes with a much bigger pop.
      if (entry?.kind === 'big') fx.sparkles(p.x, p.y + 0.9, p.z, 30, ['#ff8fa3', '#ffffff', '#ffd84d']);
      if (entry?.kind === 'king') {
        fx.sparkles(p.x, p.y + 1.2, p.z, 60, ['#ffd84d', '#ffffff', '#b18cff', '#ff8fc4']);
        fx.firework(p.x, p.y + 2, p.z);
      }
      this.sound.play('splat');
    }
    this.dropMonster(msg.id);
    if (msg.by === this.pid) {
      const first = !this.profile.data.stats.popped;
      this.profile.count('popped');
      if (first && entry?.kind !== 'king') this.emit('toast', { icon: '👾', text: 'Pop! Jump on a monster to pop it at once, or walk up to it and bop it until it pops.' });
    }
  }

  // A monster bopped, with hearts left: it squashes and hops back, and
  // whoever bopped it hears how many more bops it takes.
  monsterHit(msg) {
    const entry = this.monsters.get(msg.id);
    if (entry) entry.model.squash = 0.4;
    if (entry && Number.isInteger(msg.hearts)) entry.hearts = msg.hearts;
    const p = entry?.model.group.position;
    if (p && this.near(p.x, p.y, p.z, 30)) {
      this.renderer.effects.sparkles(p.x, p.y + 0.6, p.z, 6, ['#ffffff', '#d9c8ff']);
      this.renderer.effects.bang(p.x, p.y + 1, p.z);
      this.sound.play('bump');
    }
    if (msg.by === this.pid && performance.now() > (this.toldHit ?? 0)) {
      this.toldHit = performance.now() + 20000;
      const n = msg.hearts | 0;
      const more = n === 1 ? 'One more bop' : `${n} more bops`;
      const jump = { big: 'Jumping on it takes three.', spiky: 'Don’t jump on it, though!' }[entry?.kind] ?? 'Jumping on it pops it at once.';
      this.emit('toast', { icon: '👾', text: msg.march ? `Bonk! ${more} and it pops. Jumping on it takes three!` : `Bonk! ${more} and it pops. Watch out, it’s cross now! ${jump}` });
    }
  }

  // Bopping a monster, or landing on it (on).
  bop(id, on = false) {
    this.send(on ? { t: 'bop', id, on: true } : { t: 'bop', id });
  }

  // Whether the 👊 button can swing now: the last swing over, and this one
  // landing well over HIT_MS after the last bop went (the host takes one a
  // moment from each friend, and a bop that goes late, or comes quicker over
  // the network, must not come too soon after it).
  attackReady() {
    const now = performance.now();
    const swing = SWINGS[wornWeapon(this.profile.data.gear)?.key] ?? SWINGS.punch;
    return now >= (this.attackAt ?? 0) && now + swing.secs * swing.strike * 1000 >= (this.bopSentAt ?? -Infinity) + HIT_MS + BOP_SPACING;
  }

  // The 👊 button (or X): a swing of the arm, and whatever is in it, at the
  // monster right in front of you, if one is close enough: as far as an arm
  // reaches, further with a toy weapon (see shop.js), and nothing through a
  // wall. You turn to face it. Returns the monster's id, or null.
  attack() {
    if (!this.world || !this.me || this.riding || this.aboard) return null;
    if (this.dizzy || !this.attackReady()) return null;
    const now = performance.now();
    const weapon = wornWeapon(this.profile.data.gear);
    // Not again before this swing is over.
    this.attackAt = now + (SWINGS[weapon?.key] ?? SWINGS.punch).secs * 1000;
    const b = this.me.body;
    const reach = ARM_REACH + (weapon?.reach ?? 0);
    // In front: the way you face, or, looking through your own eyes, the way
    // you look.
    if (this.renderer.camDist <= 1.3) this.me.yaw = this.renderer.view.yaw + Math.PI;
    const fx = Math.sin(this.me.yaw);
    const fz = Math.cos(this.me.yaw);
    let best = null;
    for (const [id, entry] of this.monsters) {
      const m = entry.model.group.position;
      const size = bodyOf(entry.kind);
      const gap = bopGap(b, { x: m.x, y: m.y, z: m.z, radius: size.radius, height: size.height }, reach);
      if (gap === null) continue;
      // In front of you (or right up against you, anywhere round you).
      const dx = m.x - b.x;
      const dz = m.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      if (gap > 0.25 && (dx * fx + dz * fz) / d < FRONT) continue;
      const ey = b.y + BODY.eye;
      const dy = m.y + size.height / 2 - ey;
      const len = Math.hypot(dx, dy, dz) || 1;
      if (raycast(this.world, b.x, ey, b.z, dx / len, dy / len, dz / len, Math.max(0, len - size.radius), (block) => B.SOLID[block] === 1)) continue;
      if (!best || gap < best.gap) best = { id, gap, dx, dz, m, size };
    }
    if (best) this.me.yaw = Math.atan2(best.dx, best.dz);
    // The bop (and a blaster's bubble) goes when the swing lands, a moment on;
    // the whoosh of a swing as it starts.
    const lands = this.players.get(this.pid)?.avatar?.swing() ?? 0;
    this.send({ t: 'swing' });
    if (weapon?.key !== 'blaster') this.sound.play('swish');
    const world = this.world;
    setTimeout(() => {
      if (this.world !== world) return;
      const yaw = this.me.yaw;
      const hand = { x: b.x + Math.sin(yaw) * 0.5, y: b.y + 1, z: b.z + Math.cos(yaw) * 0.5 };
      const at = best && (this.monsters.get(best.id)?.model.group.position ?? best.m);
      if (weapon?.key === 'blaster') {
        if (at) this.renderer.effects.bubbleShot(hand.x, hand.y, hand.z, at.x, at.y + best.size.height / 2, at.z);
        else this.renderer.effects.bubbleShot(hand.x, hand.y, hand.z, hand.x + Math.sin(yaw) * reach, hand.y, hand.z + Math.cos(yaw) * reach);
        this.sound.play('blow');
      }
      if (best) {
        this.bopSentAt = performance.now();
        this.bop(best.id);
      }
    }, lands * 1000);
    if (best) return best.id;
    // A monster you can see but not reach: say how bopping works, now and then.
    const near = [...this.monsters.values()].some(({ model: { group: { position: m } } }) => Math.hypot(m.x - b.x, m.y - b.y, m.z - b.z) < 8);
    if (near && now > (this.toldReach ?? 0)) {
      this.toldReach = now + 20000;
      this.emit('toast', { icon: weapon?.icon ?? '👊', text: weapon?.key === 'blaster' ? 'Turn to face a monster a few steps away, then bop!' : 'Walk right up to a monster and face it, then bop!' });
    }
    return null;
  }

  // Landing on a monster pops it, and bounces you up.
  stomp() {
    const b = this.me.body;
    if (b.vy >= -0.5 || b.onGround || b.inWater) return;
    const now = performance.now();
    for (const entry of this.monsters.values()) {
      // King Grumble can be landed on again and again (and so can one
      // marching on a tower defense island, which a landing only hurts).
      if (entry.stomped && now < entry.stomped) continue;
      // Nobody lands on a Spiky: the host counts it as a bump.
      if (entry.kind === 'spiky') continue;
      const m = entry.model.group.position;
      const size = bodyOf(entry.kind);
      if (Math.hypot(m.x - b.x, m.z - b.z) > size.radius + BODY.radius) continue;
      const up = b.y - m.y;
      if (up < size.height * 0.5 || up > size.height + 0.5) continue;
      entry.stomped = entry.kind === 'king' || entry.kind === 'big' || this.defense ? now + 500 : Infinity;
      this.bop(entry.id, true);
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
      m.update(dt, s.state ?? 'idle', ground === null ? 9 : s.y - ground, night, Boolean(this.adventure?.shield));
      this.renderer.placeShadow(m.shadow, s.x, s.y, s.z, m.shadowScale ?? 1);
      const king = entry.kind === 'king';
      const big = king || entry.kind === 'big';
      // King Grumble dazed from a stomp: stars round his crown, and the first
      // time you see it near, how to make the most of it.
      if (king && s.state === 'dazed' && this.near(s.x, s.y, s.z, 40)) {
        this.renderer.effects.dizzy(s.x, s.y + 2.2, s.z, now / 1000, 0.75);
        if (!this.toldDazed && this.near(s.x, s.y, s.z, 20)) {
          this.toldDazed = true;
          this.emit('toast', { icon: '💫', text: 'King Grumble is dazed after his stomp! Bop him now: every bop counts three times.' });
        }
      }
      if (s.state === 'chase' && now > entry.grumbleAt && this.near(s.x, s.y, s.z, big ? 24 : 10)) {
        entry.grumbleAt = now + 3500 + Math.random() * 4000;
        this.sound.play('grumble', { big });
      }
    }
  }

  // ------------------------------------------------ an adventure island

  // The camps as the island tells of them as you arrive, each with its flag pole.
  setAdventure(a) {
    this.renderer.clearFlags();
    this.adventure = null;
    if (a && Array.isArray(a.camps) && a.camps.length) {
      const camps = new Map();
      for (const c of a.camps) {
        if (!Number.isInteger(c?.id) || ![c.x, c.y, c.z, c.r].every(Number.isFinite)) continue;
        const kind = c.kind === 'castle' ? 'castle' : 'camp';
        camps.set(c.id, { id: c.id, kind, x: c.x, y: c.y, z: c.z, r: c.r, freed: c.freed === true, progress: Number(c.progress) || 0, friends: 0, guarded: false, flag: this.renderer.addFlag(c.id, kind) });
      }
      this.adventure = { camps, won: a.won === true, king: null, shield: true };
      this.adventureNews(a);
    }
    this.emit('adventure');
  }

  // How far up each flag is, how many friends are by it and whether its
  // monsters guard it, and King Grumble's hearts, a few times a second.
  adventureNews(msg) {
    const adv = this.adventure;
    if (!adv) return;
    const seen = new Set();
    for (const row of Array.isArray(msg.c) ? msg.c : []) {
      const c = adv.camps.get(row?.[0]);
      if (!c || c.freed) continue;
      seen.add(c.id);
      c.progress = Math.max(0, Math.min(1, (Number(row[1]) || 0) / 100));
      c.friends = row[2] | 0;
      c.guarded = row[3] === 1;
    }
    for (const c of adv.camps.values()) {
      if (seen.has(c.id)) continue;
      c.friends = 0;
      c.guarded = false;
    }
    adv.king = Array.isArray(msg.k) && msg.k.length >= 2 ? { hearts: msg.k[0], max: msg.k[1] } : null;
    adv.shield = msg.shield !== false && !adv.won;
    this.emit('adventure');
  }

  campFreed(msg) {
    const adv = this.adventure;
    const c = adv?.camps.get(msg.id);
    if (!c) return;
    Object.assign(c, { freed: true, progress: 1, friends: 0, guarded: false });
    const left = [...adv.camps.values()].filter((o) => o.kind === 'camp' && !o.freed).length;
    if (this.near(c.x, c.y, c.z, 60)) {
      this.sound.play('fanfare');
      this.renderer.effects.sparkles(c.x, c.y + (c.flag?.top ?? 4), c.z, 30, ['#ffd84d', '#ffffff', '#5cc3f2', '#7fe08c']);
    }
    const mine = Array.isArray(msg.by) && msg.by.includes(this.pid);
    if (mine) this.profile.count('freed');
    const more = left ? ` ${left === 1 ? 'One more camp' : `${left} more camps`} to free!` : '';
    this.emit('toast', { icon: '🚩', text: mine ? `You freed Camp ${c.id}! It is a safe place now.${more}` : `Camp ${c.id} is free!${more}` });
    this.emit('adventure');
  }

  // Every camp free: King Grumble's bubble popped.
  shieldDown() {
    const adv = this.adventure;
    if (!adv?.shield) return;
    adv.shield = false;
    for (const e of this.monsters.values()) {
      const p = e.model.group.position;
      if (e.kind === 'king' && this.near(p.x, p.y, p.z, 60)) this.renderer.effects.sparkles(p.x, p.y + 1.2, p.z, 30, ['#cdeeff', '#ffffff', '#ffd84d']);
    }
    this.sound.play('shield');
    this.emit('toast', { icon: '🫧', text: 'Every camp is free! King Grumble’s bubble popped. Off to his castle, and pop him!' });
    this.emit('adventure');
  }

  // King Grumble bopped: a heart off him, or a boing off his bubble.
  kingHit(msg) {
    const entry = this.monsters.get(msg.id);
    const p = entry?.model.group.position;
    if (msg.shielded) {
      entry?.model.bubbleBounce?.();
      if (p && this.near(p.x, p.y, p.z, 30)) this.sound.play('bubble');
      if (msg.by === this.pid && performance.now() > (this.toldBubble ?? 0)) {
        this.toldBubble = performance.now() + 8000;
        this.emit('toast', { icon: '🫧', text: 'King Grumble is safe in his bubble until every camp is free!' });
      }
      return;
    }
    if (this.adventure && Number.isInteger(msg.hearts)) this.adventure.king = { hearts: msg.hearts, max: msg.max };
    if (entry) entry.model.squash = msg.dazed ? 0.6 : 0.45;
    if (p && this.near(p.x, p.y, p.z, 40)) {
      this.renderer.effects.sparkles(p.x, p.y + 1.4, p.z, msg.dazed ? 36 : 14, ['#ffd84d', '#ffffff', '#ff8fc4']);
      this.renderer.effects.bang(p.x, p.y + 2.3, p.z);
      this.sound.play('ouch');
    }
    this.emit('adventure');
  }

  // King Grumble landing from a stomp: a ring rushing out over the ground,
  // dust, a thump, and the ground shaking under anyone near.
  stomped(msg) {
    if (![msg.x, msg.y, msg.z].every(Number.isFinite) || !this.me) return;
    const d = Math.hypot(this.me.body.x - msg.x, this.me.body.z - msg.z);
    if (d > 60) return;
    this.renderer.shockwave(msg.x, msg.y, msg.z, STOMP.reach);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.renderer.effects.dust(msg.x + Math.cos(a) * 1.4, msg.y, msg.z + Math.sin(a) * 1.4);
    }
    this.sound.play('stomp', { near: Math.max(0.2, 1 - d / 60) });
    if (d < 14) this.renderer.shake(0.3 * (1 - d / 14));
  }

  // The whole island free: fireworks, a fanfare, and for everyone who was
  // there, a sticker and a diamond.
  islandWon(msg) {
    const adv = this.adventure;
    if (adv) {
      Object.assign(adv, { won: true, shield: false, king: null });
      for (const c of adv.camps.values()) Object.assign(c, { freed: true, progress: 1, friends: 0, guarded: false });
    }
    const b = this.me?.body;
    const [x, y, z] = [msg.x, msg.y, msg.z].every(Number.isFinite) ? [msg.x, msg.y, msg.z] : [b?.x ?? 0, b?.y ?? 0, b?.z ?? 0];
    const now = performance.now();
    for (let i = 0; i < 10; i++) this.fireworks.push({ at: now + 300 + i * 380, x: x + (Math.random() - 0.5) * 16, y: y + 11 + Math.random() * 6, z: z + (Math.random() - 0.5) * 16 });
    this.sound.play('victory');
    const mine = Array.isArray(msg.by) && msg.by.includes(this.pid);
    if (mine) {
      this.profile.count('kings');
      this.profile.addToBasket('diamond', 1);
    }
    if (this.dizzy) {
      this.dizzy = false;
      this.emit('dizzy', false);
    }
    const hero = msg.hero === this.pid ? 'You' : this.players.get(msg.hero)?.name;
    const what = hero ? `${hero} popped King Grumble!` : 'Every camp is free!';
    this.emit('toast', { icon: '👑', text: `${what} ${this.world?.name ?? 'The island'} is free!${mine ? ' A diamond for everyone who helped! 💎' : ''}` });
    this.emit('adventure');
  }

  // A friend helped someone up (by 0: the island did, being freed).
  helped(msg) {
    const p = this.players.get(msg.pid);
    if (p) p.dizzy = false;
    const at = p?.avatar?.root.position;
    if (at && this.near(at.x, at.y, at.z, 30)) this.renderer.effects.hearts(at.x, at.y + 1.6, at.z, 5);
    const helper = msg.by ? this.players.get(msg.by) : null;
    if (msg.pid === this.pid) {
      this.dizzy = false;
      this.emit('dizzy', false);
      this.setHearts(msg.hearts);
      this.sound.play('helpup');
      this.emit('toast', { icon: '🤝', text: helper ? `${helper.name} helped you up!` : 'Up you get!' });
    } else if (msg.by === this.pid) {
      this.profile.count('helped');
      this.sound.play('helpup');
      this.emit('toast', { icon: '🤝', text: `You helped ${p?.name ?? 'your friend'} up!` });
    }
  }

  // Dizzy too long, with no friend coming: back to the nearest safe place.
  cameHome(msg) {
    const p = this.players.get(msg.pid);
    if (p) p.dizzy = false;
    if (msg.pid !== this.pid || !this.me) return;
    this.setHearts(msg.hearts);
    this.goHome(msg.at, 'Back you go to the nearest safe place, with all your hearts.');
  }

  // Each frame: the flags where their camps are, fireworks going off, and
  // stars going round the head of anyone dizzy.
  updateAdventure(dt) {
    const adv = this.adventure;
    const now = performance.now();
    if (adv) {
      for (const c of adv.camps.values()) {
        if (!c.flag) continue;
        const top = this.world.top(Math.floor(c.x), Math.floor(c.z));
        c.flag.group.position.set(c.x, top >= 0 ? top + 1 : c.y, c.z);
        c.flag.update(dt, c.progress, c.freed);
      }
    }
    while (this.fireworks.length && this.fireworks[0].at <= now) {
      const f = this.fireworks.shift();
      this.renderer.effects.firework(f.x, f.y, f.z);
      if (this.near(f.x, f.y, f.z, 90)) this.sound.play('pop');
    }
    const t = now / 1000;
    for (const p of this.players.values()) {
      if (!(p.me ? this.dizzy : p.dizzy) || !p.avatar) continue;
      const a = p.avatar.root.position;
      if (this.near(a.x, a.y, a.z, 40)) this.renderer.effects.dizzy(a.x, a.y + 1.35 + p.avatar.sitTall, a.z, t);
    }
  }

  // ------------------------------------------------ a tower defense island

  // The road, the pads and the Star Stone, as the island tells of them as you arrive.
  setDefense(d) {
    this.defense = null;
    const point = (o) => (o && [o.x, o.y, o.z].every(Number.isFinite) ? { x: o.x, y: o.y, z: o.z } : null);
    if (d && Array.isArray(d.path) && Array.isArray(d.pads) && point(d.stone) && point(d.gate)) {
      const pads = d.pads.filter((p) => Number.isInteger(p?.id) && point(p)).map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z, level: 0 }));
      this.defense = { path: d.path.filter((c) => Array.isArray(c) && c.every(Number.isFinite)), pads, stone: point(d.stone), gate: point(d.gate), wave: 1, waves: 10, state: 'ready', hearts: 10, max: 10, bricks: 0, left: 0 };
      this.defenseNews(d);
    }
    this.emit('defense');
  }

  // The wave, the Star Stone's hearts, the bricks and the towers, as they change.
  defenseNews(msg) {
    const d = this.defense;
    if (!d) return;
    const int = (v, was) => (Number.isInteger(v) ? v : was);
    d.wave = int(msg.w, d.wave);
    d.waves = int(msg.n, d.waves);
    d.state = DEFENSE_STATES[msg.s] ?? d.state;
    d.hearts = int(msg.h, d.hearts);
    d.max = int(msg.hm, d.max);
    d.bricks = int(msg.b, d.bricks);
    d.left = int(msg.l, d.left);
    if (Array.isArray(msg.lv)) d.pads.forEach((p, i) => (p.level = Math.max(0, Math.min(MAX_LEVEL, msg.lv[i] | 0))));
    this.emit('defense');
  }

  // Towers blowing bubbles: each one flying from the top of its tower to
  // the monster it is after.
  zapped(msg) {
    const d = this.defense;
    if (!d || !Array.isArray(msg.z)) return;
    const now = performance.now();
    for (const [padId, id] of msg.z) {
      const pad = d.pads.find((p) => p.id === padId);
      const entry = this.monsters.get(id);
      if (!pad || !entry) continue;
      const from = towerTop(pad, Math.max(1, pad.level));
      const to = entry.model.group.position;
      if (!this.near(from.x, from.y, from.z, 60)) continue;
      this.renderer.effects.bubbleShot(from.x, from.y, from.z, to.x, to.y + 0.5, to.z);
      entry.model.squash = Math.max(entry.model.squash ?? 0, 0.25);
      if (now > (this.zapSoundAt ?? 0) && this.near(from.x, from.y, from.z, 25)) {
        this.zapSoundAt = now + 120;
        this.sound.play('blow');
      }
    }
  }

  // A monster got to the Star Stone: a heart off it.
  leaked(msg) {
    const d = this.defense;
    if (!d) return;
    if (Number.isInteger(msg.hearts)) d.hearts = msg.hearts;
    this.dropMonster(msg.id);
    const s = d.stone;
    if (this.near(s.x, s.y, s.z, 60)) {
      this.renderer.effects.sparkles(s.x, s.y + 2, s.z, 16, ['#b18cff', '#ffffff', '#7b4fd0']);
      this.renderer.effects.bang(s.x, s.y + 3.5, s.z);
      this.sound.play('ouch');
    }
    if (performance.now() > (this.toldLeak ?? 0)) {
      this.toldLeak = performance.now() + 15000;
      this.emit('toast', { icon: '🌟', text: `A monster got to the Star Stone! ${d.hearts} ${d.hearts === 1 ? 'heart' : 'hearts'} left. Build more towers by the road!` });
    }
    this.emit('defense');
  }

  // A wave on its way, seen off, or lost (the Star Stone out of hearts);
  // with the last one seen off, the island is safe: fireworks over the
  // Star Stone, and a sticker and a diamond for everyone there.
  waveNews(msg) {
    const d = this.defense;
    if (!d) return;
    const n = msg.wave | 0;
    if (msg.k === 'start') {
      d.state = 'march';
      this.sound.play('grumble', { big: true });
      const by = msg.by === this.pid ? '' : `${this.players.get(msg.by)?.name ?? 'A friend'} pressed Start. `;
      this.emit('toast', { icon: '🌊', text: `${by}Wave ${n} is coming! Here they come out of the gate…` });
    } else if (msg.k === 'lost') {
      d.state = 'ready';
      this.sound.play('no');
      this.emit('toast', { icon: '💫', text: `The monsters got the Star Stone! It shines again. Build more towers and try wave ${n} again!` });
    } else if (msg.k === 'clear') {
      const mine = Array.isArray(msg.by) && msg.by.includes(this.pid);
      if (msg.won) {
        d.state = 'won';
        const s = d.stone;
        const now = performance.now();
        for (let i = 0; i < 10; i++) this.fireworks.push({ at: now + 300 + i * 380, x: s.x + (Math.random() - 0.5) * 16, y: s.y + 11 + Math.random() * 6, z: s.z + (Math.random() - 0.5) * 16 });
        this.sound.play('victory');
        if (mine) {
          this.profile.count('defended');
          this.profile.addToBasket('diamond', 1);
        }
        this.emit('toast', { icon: '🏆', text: `Every wave is seen off! ${this.world?.name ?? 'The island'} is safe!${mine ? ' A diamond for everyone who helped! 💎' : ''}` });
      } else {
        d.state = 'ready';
        this.sound.play('fanfare');
        this.emit('toast', { icon: '🎉', text: `Wave ${n} seen off! 🧱 ${msg.bricks | 0} bricks for it. Press Start when you are ready for wave ${n + 1}.` });
      }
    }
    this.emit('defense');
  }

  // A tower built on a pad, or made bigger.
  towerBuilt(msg) {
    const d = this.defense;
    const pad = d?.pads.find((p) => p.id === msg.pad);
    if (!pad) return;
    pad.level = Math.max(0, Math.min(MAX_LEVEL, msg.level | 0));
    const top = towerTop(pad, pad.level);
    if (this.near(top.x, top.y, top.z, 50)) {
      this.renderer.effects.sparkles(top.x, top.y, top.z, 24, ['#ffd84d', '#ffffff', '#5cc3f2']);
      this.sound.play('stamp');
    }
    if (msg.by === this.pid) {
      this.profile.count('towers');
      if (pad.level === 1 && !this.toldTower) {
        this.toldTower = true;
        this.emit('toast', { icon: '🏰', text: 'A tower! It blows bubbles at monsters going by. Build by it again to make it bigger.' });
      }
    }
    this.emit('defense');
  }

  // What the Build button does here: build on (or make bigger) the pad
  // you stand by, or, by none, start the next wave. Null: nothing to do.
  defendTarget() {
    const d = this.defense;
    if (!d || !this.me || this.riding || this.aboard || d.state === 'won') return null;
    const b = this.me.body;
    let pad = null;
    let near = BUILD_REACH;
    for (const p of d.pads) {
      const far = Math.hypot(p.x - b.x, p.z - b.z);
      if (far <= near && Math.abs(b.y - p.y) < 4) {
        near = far;
        pad = p;
      }
    }
    if (pad) return { pad, cost: pad.level < MAX_LEVEL ? TOWER_COST[pad.level + 1] : 0 };
    return d.state === 'ready' ? { start: true } : null;
  }

  defend() {
    const t = this.defendTarget();
    if (!t) return;
    if (t.start) this.send({ t: 'defend', cmd: 'start' });
    else if (t.cost) {
      if (this.defense.bricks < t.cost) {
        this.sound.play('no');
        this.emit('toast', { icon: '🧱', text: `That takes 🧱 ${t.cost} bricks, and there are ${this.defense.bricks}. Pop monsters to get more!` });
        return;
      }
      this.send({ t: 'defend', cmd: 'build', pad: t.pad.id });
    }
  }

  // ------------------------------------------------ riding

  // Someone got on an animal, or off it (pid 0).
  rideNews(msg) {
    const entry = this.critters.get(msg.id);
    if (!entry) return;
    if (msg.seat) {
      this.seatNews(entry, msg);
      return;
    }
    const was = entry.rider;
    entry.rider = msg.pid;
    if (was && was !== msg.pid) {
      // Its last rider, still drawn on its back for a moment after.
      entry.lastRider = was;
      entry.leftAt = performance.now();
    }
    const look = this.players.get(msg.pid)?.look;
    entry.model.setRider(msg.pid && look ? shirtColor(look.shirt) : null);
    // Someone took the wheel of the one you ride along in.
    if (msg.pid && msg.pid !== this.pid && this.aboard?.id === entry.id) this.profile.count('along');
    if (msg.pid === this.pid && this.riding?.id !== entry.id) this.mount(entry);
    else if (was === this.pid && msg.pid !== this.pid && this.riding?.id === entry.id) this.dismount();
    this.emit('ride');
  }

  // Someone hopped on to ride along in one of a vehicle's seats for
  // friends, or got out of it (pid 0).
  seatNews(entry, msg) {
    const i = msg.seat - 1;
    if (!(i < entry.passengers.length)) return;
    const was = entry.passengers[i];
    entry.passengers[i] = msg.pid;
    const look = this.players.get(msg.pid)?.look;
    entry.model.setPassenger(i, msg.pid && look ? shirtColor(look.shirt) : null);
    if (msg.pid === this.pid && this.aboard?.id !== entry.id) this.hopOn(entry, msg.seat);
    else if (was === this.pid && msg.pid !== this.pid && this.aboard?.id === entry.id) this.hopOff();
    this.emit('ride');
  }

  // Whether you could get on this: nobody is riding it, or it has a seat
  // free for you to ride along in.
  canBoard(c) {
    return !c.rider || c.passengers.includes(0);
  }

  // The big animal or vehicle you could get on: the nearest one beside you
  // with room for you.
  findRideable() {
    if (this.riding || this.aboard || !this.me) return 0;
    const b = this.me.body;
    let best = 0;
    let near = Infinity;
    for (const c of this.critters.values()) {
      const r = CRITTER_INFO[c.type]?.ride;
      if (!r || !this.canBoard(c) || !c.model.group.visible) continue;
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
    if (this.dizzy) return;
    if (this.aboard) {
      this.getOut();
      return;
    }
    if (this.riding) {
      this.getOff();
      return;
    }
    if (this.seat) {
      this.standUp();
      return;
    }
    const id = this.rideTarget;
    if (!id && this.seatTarget) {
      this.sitDown(this.seatTarget);
      return;
    }
    if (!id) {
      this.emit('notice', { text: 'Walk up to a big animal, a vehicle or a seat to ride it or sit on it!', level: 'info' });
      this.sound.play('no');
      return;
    }
    this.send({ t: 'critter', op: 'ride', id });
  }

  // Down on a chair or a sofa, or into bed (see shared/seats.js): you stay
  // there until you move, jump, press Shift or Q, or something bumps you.
  sitDown(cell) {
    const pose = seatPose(this.world, cell.x, cell.y, cell.z);
    if (!pose) return;
    const b = this.me.body;
    if (b.flying) {
      b.flying = false;
      this.emit('fly', false);
    }
    this.seat = { x: cell.x, y: cell.y, z: cell.z };
    this.teaCounted = false;
    Object.assign(b, { x: pose.x, y: pose.y, z: pose.z, vx: 0, vy: 0, vz: 0 });
    this.sound.play('place', { kind: 'cloth' });
    this.profile.count('sat');
    if (!this.toldSeat) {
      this.toldSeat = true;
      const name = B.block(this.world.get(cell.x, cell.y, cell.z)).name.toLowerCase();
      const how = this.touch ? 'Walk, or tap 👋 Get up,' : 'Walk, or press Q,';
      this.emit('toast', { icon: pose.pose === 'sit' ? '🛋️' : '🛏️', text: pose.pose !== 'sit' ? `Snuggled up in bed! ${how} to get up.` : `You sit on the ${name}. ${how} to get up.` });
    }
    this.emit('ride');
  }

  // Up out of your seat, in front of it (or beside it, or on top).
  standUp() {
    const c = this.seat;
    if (!c) return;
    this.seat = null;
    const at = standUpAt(this.world, c.x, c.y, c.z);
    const b = this.me.body;
    Object.assign(b, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, onGround: false });
    unstick(this.world, b);
    this.emit('ride');
  }

  // A tea party: you and a friend both sitting (shared/seats.js) with a Tea
  // Table beside each of your seats, at the same table or two pushed
  // together. Counted once each time you sit down, with hearts over the
  // table; the 🫖 sticker is what it earns.
  checkTeaParty() {
    if (this.teaCounted || !this.seat) return;
    const pose = seatPose(this.world, this.seat.x, this.seat.y, this.seat.z);
    if (!pose || pose.pose !== 'sit') return;
    const mine = teaTableNear(this.world, this.seat.x, this.seat.y, this.seat.z);
    if (!mine) return;
    for (const p of this.players.values()) {
      if (p.me || !p.sitting || !p.avatar) continue;
      const a = p.avatar.root.position;
      const theirs = teaTableNear(this.world, Math.floor(a.x), Math.floor(a.y), Math.floor(a.z));
      if (!theirs || Math.hypot(theirs.x - mine.x, theirs.z - mine.z) > 2) continue;
      this.teaCounted = true;
      this.profile.count('teas');
      this.renderer.effects.hearts(mine.x + 0.5, mine.y + 1.4, mine.z + 0.5, 5);
      if (!this.toldTea) {
        this.toldTea = true;
        this.emit('toast', { icon: '🫖', text: `Tea time with ${p.name}!` });
      }
      return;
    }
  }

  // In your seat, staying put: up you get if you move, or if the seat goes
  // (someone picked it up) or something else moved you (sent home, say).
  stayInSeat(dt, input) {
    const me = this.me;
    const b = me.body;
    const c = this.seat;
    const pose = seatPose(this.world, c.x, c.y, c.z);
    if (!pose || Math.hypot(b.x - pose.x, b.z - pose.z) > 0.8) {
      this.seat = null;
      if (pose) return;
      unstick(this.world, b);
      this.emit('ride');
      return;
    }
    const move = input.readMove();
    if (this.dizzy || Math.hypot(move.x, move.y) > 0.3 || input.jump || input.down) {
      this.standUp();
      this.liftLatch = true;
      return;
    }
    Object.assign(b, { x: pose.x, y: pose.y, z: pose.z, vx: 0, vy: 0, vz: 0, onGround: true, inWater: false, flying: false });
    me.yaw = pose.yaw;
    me.speed = 0;
    me.anim = { sit: ANIM.sit, lie: ANIM.lie, curl: ANIM.curl }[pose.pose];
    const a = this.players.get(this.pid)?.avatar;
    if (a) {
      a.root.position.set(b.x, b.y, b.z);
      a.root.rotation.y = me.yaw;
      a.update(dt, me.anim, 0);
      a.shadow.visible = false;
    }
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
    const name = entry.name || `the ${info.name.toLowerCase()}`;
    if (info.vehicle) {
      const how = this.touch ? 'Tap 👋 Get out to get out.' : 'Press Q to get out.';
      const what = {
        digger: `Drive into a hill to dig a tunnel! Hold jump to dig up, or ${this.touch ? '⬇️' : 'Shift'} to dig down.`,
        minecart: 'Push to roll along the rails! Jump to ring the bell.',
        scooter: 'Quicker than you run! Jump to ring the bell.',
        bus: 'Friends can hop on behind you! Jump to honk!',
        ferry: 'Friends can hop on behind you! Jump to toot!',
        helicopter: `Hold jump to fly up, and ${this.touch ? '⬇️' : 'Shift'} to come down! Two friends can hop on behind you.`,
        balloon: `Hold jump to float up, and ${this.touch ? '⬇️' : 'Shift'} to come down! Four friends can hop on with you.`,
      }[entry.type] ?? 'Jump to honk!';
      this.emit('toast', { icon: info.icon, text: `You are driving ${name}! ${what} ${how}` });
      this.profile.count('drives');
    } else {
      const how = this.touch ? 'Tap 👋 Get off to get down.' : 'Press Q to get off.';
      const trick =
        { leap: 'Jump to leap!', spout: 'Jump to blow water!', spray: 'Jump to spray water!' }[ride.r.trick] ??
        (ride.r.air ? `Hold jump to fly up, and ${this.touch ? '⬇️' : 'Shift'} to come down!` : 'Jump to jump!');
      this.emit('toast', { icon: info.icon, text: `You are riding ${name}! ${trick} ${how}` });
      this.profile.count('rides');
      if (ride.r.sea) this.profile.count('searides');
    }
    this.railed = 0;
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
    // Out of a helicopter or a balloon up in the air, you fly.
    Object.assign(b, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, onGround: false, flying: Boolean(at.flying) });
    if (at.flying) this.emit('fly', true);
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

  // In a seat for friends (the island said yes): a friend drives, and you
  // ride along wherever they go.
  hopOn(entry, seat) {
    const b = this.me.body;
    if (b.flying) {
      b.flying = false;
      this.emit('fly', false);
    }
    this.seat = null;
    this.aboard = { id: entry.id, seat, type: entry.type, held: true, hop: { t: 0, x: b.x, y: b.y, z: b.z } };
    this.sound.play('jump');
    const info = CRITTER_INFO[entry.type];
    const name = entry.name || `the ${info.name.toLowerCase()}`;
    const driver = this.players.get(entry.rider);
    const who = driver ? `${driver.name || 'A friend'} is driving.` : 'Nobody is driving yet.';
    const how = this.touch ? 'Tap 👋 Get out to get out.' : 'Press Q to get out.';
    this.emit('toast', { icon: info.icon, text: `All aboard ${name}! ${who} Jump to honk. ${how}` });
    if (driver) this.profile.count('along');
    this.emit('ride');
  }

  // Getting out of a seat for friends, at once.
  getOut() {
    if (!this.aboard) return;
    this.sendMove(true);
    this.send({ t: 'critter', op: 'off' });
    this.hopOff();
  }

  // Down beside the vehicle (or where you were, if it went away), and on
  // foot again.
  hopOff() {
    const a = this.aboard;
    if (!a) return;
    this.aboard = null;
    const b = this.me.body;
    let flying = false;
    const entry = this.critters.get(a.id);
    if (entry) {
      const g = entry.model.group;
      const at = getOffAt(this.world, { body: { x: g.position.x, y: g.position.y, z: g.position.z, inWater: false }, yaw: g.rotation.y, r: CRITTER_INFO[a.type].ride });
      Object.assign(b, { x: at.x, y: at.y, z: at.z });
      flying = Boolean(at.flying);
    }
    // Out of a helicopter or a balloon up in the air, you fly.
    Object.assign(b, { vx: 0, vy: 0, vz: 0, onGround: false, flying });
    if (flying) this.emit('fly', true);
    unstick(this.world, b);
    this.sound.play('land');
    this.emit('ride');
  }

  // Riding along: nothing to steer, but jump honks.
  rideAlong(input) {
    const a = this.aboard;
    if (!this.critters.get(a.id) || this.dizzy) {
      this.hopOff();
      return;
    }
    input.readMove();
    if (input.jump && !a.held) {
      const now = performance.now();
      if (now > (a.trickAt ?? 0)) {
        a.trickAt = now + 700;
        this.send({ t: 'critter', op: 'trick' });
      }
    }
    a.held = Boolean(input.jump);
    this.me.anim = ANIM.ride;
  }

  // Everyone riding along in a vehicle, in their seats in it as it is drawn
  // (you too, and the camera with you), whatever their page last said.
  seatPassengers(dt) {
    for (const c of this.critters.values()) {
      if (!c.passengers.some(Boolean)) continue;
      const g = c.model.group;
      const r = CRITTER_INFO[c.type].ride;
      const speed = c.model.hs ?? 0;
      c.passengers.forEach((pid, i) => {
        if (!pid) return;
        const seat = riderAt(c.type, { x: g.position.x, y: g.position.y, z: g.position.z, yaw: g.rotation.y }, i + 1);
        const p = this.players.get(pid);
        const mine = pid === this.pid && this.aboard?.id === c.id;
        // A friend's page that has not put them in it yet: where they are.
        if (!p?.avatar || (!mine && !p.seated)) return;
        let { x, y, z } = seat;
        if (mine) {
          Object.assign(this.me.body, { x, y, z, vx: 0, vy: 0, vz: 0, onGround: true, inWater: false, flying: false });
          this.me.yaw = seat.yaw;
          this.me.speed = speed;
          const h = this.aboard.hop;
          if (h) {
            // Hopping up from where you stood.
            h.t += dt;
            const k = Math.min(1, h.t / 0.3);
            x = h.x + (x - h.x) * k;
            y = h.y + (y - h.y) * k + Math.sin(Math.PI * k) * 0.5;
            z = h.z + (z - h.z) * k;
            if (k >= 1) this.aboard.hop = null;
          }
        }
        const av = p.avatar;
        av.root.position.set(x, y, z);
        av.root.rotation.y = seat.yaw;
        av.ride = r;
        if (mine) av.update(dt, ANIM.ride, speed);
        av.shadow.visible = false;
      });
    }
  }

  // Your animal, moved as you steer it, and you on its back.
  moveRide(dt, input) {
    const ride = this.riding;
    const me = this.me;
    const move = this.steer(input.readMove(), dt);
    const yaw = this.renderer.view.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    // Down (Shift, or ⬇️) dives at sea (and gets off on land: see pressDown).
    const ev = stepRide(this.world, ride, { mx: fx * move.y + -fz * move.x, mz: fz * move.y + fx * move.x, jump: input.jump, down: input.down, run: input.run }, dt);
    const r = ride.body;
    // On land and off the rails, it steps out of whatever it walked into too.
    if (!ride.r.sea && !ride.rail) keepApart(this.world, r, this.standing(`c${ride.id}`), `c${ride.id}`);
    const seat = riderAt(ride.type, { x: r.x, y: r.y, z: r.z, yaw: ride.yaw });
    const b = me.body;
    // Flying with it (a helicopter, a balloon, a giant mosquito) says so on
    // your own body too: the island knows, and King Grumble's stomp misses.
    Object.assign(b, { x: seat.x, y: seat.y, z: seat.z, vx: r.vx, vy: r.vy, vz: r.vz, onGround: r.onGround, inWater: false, flying: Boolean(r.flying) });
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
        // A honk can come again sooner than a spout or a spray.
        ride.trickAt = now + (ride.r.trick === 'honk' ? 700 : 2600);
        this.send({ t: 'critter', op: 'trick' });
      }
    }
    if (ev.dig) this.drill(ev.dig);
    // Along the rails: clickety-clack over each rail, a clunk at the end of the line.
    if (ev.rolled) {
      this.railed += ev.rolled;
      this.stepAcc += ev.rolled;
      if (this.stepAcc > 1) {
        this.stepAcc = 0;
        this.sound.play('clack', { speed });
      }
      if (this.railed >= 1) {
        this.profile.count('railed', Math.floor(this.railed));
        this.railed %= 1;
      }
    }
    if (ev.bumped) this.sound.play('bump');
    // Up into the air, and back down.
    if (ev.tookOff) {
      this.sound.play('liftoff', { type: ride.type });
      fxs.dust(r.x, r.y, r.z);
      // The 🚁 sticker is for flying the aircraft; riding a giant mosquito
      // counts as a ride (as anywhere else you get on one).
      if (CRITTER_INFO[ride.type].vehicle) this.profile.count('flights');
    }
    if (ev.touchedDown) {
      this.sound.play('land');
      fxs.dust(r.x, r.y, r.z);
    }
    const vehicle = CRITTER_INFO[ride.type].vehicle;
    if (vehicle) {
      // An engine's hum, a little higher the faster it goes (and up in the
      // air, the whirr of the rotor or the roar of the burner, even hovering).
      const flying = r.flying;
      if (!ride.rail && (speed > 0.5 || flying) && ride.type !== 'minecart') {
        this.stepAcc += Math.max(speed, flying ? 4 : 0) * dt;
        if (this.stepAcc > 1.4) {
          this.stepAcc = 0;
          this.sound.play('motor', { type: ride.type, speed });
          if (r.onGround || ride.r.sea) this.profile.count('steps');
        }
      }
      if (ride.r.sea && speed > 2 && Math.random() < dt * 10) {
        const top = this.surfaceAt(r.x, r.z);
        if (top !== null) fxs.splash(r.x - Math.sin(ride.yaw) * 0.8, top, r.z - Math.cos(ride.yaw) * 0.8);
      }
    } else if (ride.r.air && r.flying) {
      // Riding a giant mosquito: its whine, on and off, as it drones along.
      this.stepAcc += Math.max(speed, 3) * dt;
      if (this.stepAcc > 2.6) {
        this.stepAcc = 0;
        this.sound.play('mosquito');
      }
    } else if (r.onGround && speed > 0.5) {
      // Hoofbeats, or big soft paws.
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
  // dives, as long as it is held; the digger digs down, a helicopter or a
  // balloon comes down, and a mine cart on its rails rolls on). On foot in the air, it lands you at the next bounce
  // on a trampoline, held down then or not.
  pressDown() {
    if (this.dizzy) return;
    if (this.seat) {
      this.standUp();
      return;
    }
    if (this.riding) {
      if (!this.riding.r.sea && !this.riding.r.drill && !this.riding.rail && !this.riding.r.air) this.getOff();
      return;
    }
    if (this.aboard) {
      const r = CRITTER_INFO[this.aboard.type].ride;
      if (!r.sea && !r.air) this.getOut();
      return;
    }
    const b = this.me?.body;
    if (b && !b.flying && !b.inWater && !(b.onGround && b.vy === 0)) this.landNext = true;
  }

  // The digger's drill taking out the ground in front of it, with any jewels
  // in it going in your basket (and, those dug out, for keeps).
  drill(dig) {
    // Only the owner builds on this island right now: the drill stays still.
    if (this.settings.build === 'host' && this.pid !== this.host) {
      if (!this.riding.toldNoDig) this.emit('notice', { text: 'The island owner is the only builder right now, so the digger cannot dig.', level: 'info' });
      this.riding.toldNoDig = true;
      return;
    }
    const plan = drillEdit(this.world, dig);
    const cells = plan.cells;
    if (!this.edit('pick', cells, { undoable: !plan.collected.length })) return;
    this.previewKey = '';
    this.editEffects('pick', cells, true);
    for (let i = 0; i < cells.length; i += 8) this.renderer.effects.dust(cells[i] + 0.5, cells[i + 1], cells[i + 2] + 0.5);
    this.sound.play('dig');
    let dug = 0;
    for (let i = 3; i < cells.length; i += 4) if (cells[i] === B.AIR || cells[i] === B.WATER) dug++;
    this.profile.count('drilled', dug);
    if (plan.collected.length) this.collect(plan.collected, cells);
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
    if (this.me && !this.seat && !this.aboard) unstick(w, this.riding?.body ?? this.me.body);
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
    if (this.me && !this.seat && !this.aboard) unstick(w, this.riding?.body ?? this.me.body);
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
    // Their pet joins in, with a trick of its own.
    const pet = this.pets.get(pid);
    if (pet && EMOTE_TRICKS[key] && pet.sim.mode !== 'ride') {
      startTrick(pet.sim, EMOTE_TRICKS[key]);
      if (key === 'hearts') this.renderer.effects.hearts(pet.sim.x, pet.sim.y + pet.model.height, pet.sim.z, 2);
      if (pid === this.pid) this.profile.count('tricks');
    }
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

  // Everything the pointer could mean: a monster, an animal, a block, or
  // nothing. What is drawn see-through right in front of the camera, such as a
  // tree crown it slipped into, is looked through.
  aim(ndc) {
    if (!this.world || !this.me) return null;
    const r = this.renderer;
    const ray = r.ray(ndc.x, ndc.y);
    const tool = this.tool;
    const w = this.world;
    const stopAt = (id, x, y, z, start, dist) => {
      if (id === B.AIR || r.seeThrough(dist, ray.dir)) return false;
      const kind = B.KIND[id];
      if (kind === B.K_WATER) return (tool === 'build' || tool === 'stamp' || tool === 'friends') && start !== B.WATER && !this.basketPick;
      if (kind === B.K_ITEM) return true;
      if (kind === B.K_PLANT) return tool !== 'hills';
      return true;
    };
    const eye = { x: this.me.body.x, y: this.me.body.y + BODY.eye, z: this.me.body.z };
    const maxDist = REACH + r.camDist;
    const hit = raycast(w, ray.origin.x, ray.origin.y, ray.origin.z, ray.dir.x, ray.dir.y, ray.dir.z, maxDist, stopAt);
    // A monster, unless a solid block is in the way: flowers and grass never
    // hide one (it hops about in them), nor does the ground just under it.
    const monster = r.pickMonster(ray, maxDist);
    if (monster) {
      const entry = this.monsters.get(monster.id);
      // Not bopped with a tap (that is the 👊 button, see attack), but named,
      // and a tap at one builds nothing behind it.
      const size = bodyOf(entry?.kind);
      const wall = raycast(w, ray.origin.x, ray.origin.y, ray.origin.z, ray.dir.x, ray.dir.y, ray.dir.z, monster.dist - size.radius, (id, x, y, z, start, dist) => B.SOLID[id] === 1 && !r.seeThrough(dist, ray.dir));
      if (entry && !wall) return { kind: 'monster', id: monster.id };
    }
    // A friend sitting dizzy, to help up from beside them, unless a solid
    // block is in the way: the flowers of a camp just freed never hide one.
    const dizzy = [...this.players.values()].filter((p) => p.dizzy && !p.me).map((p) => p.id);
    const friend = dizzy.length ? r.pickAvatar(ray, maxDist, dizzy) : null;
    if (friend) {
      const wall = raycast(w, ray.origin.x, ray.origin.y, ray.origin.z, ray.dir.x, ray.dir.y, ray.dir.z, friend.dist - 0.4, (id, x, y, z, start, dist) => B.SOLID[id] === 1 && !r.seeThrough(dist, ray.dir));
      const a = this.players.get(friend.id)?.avatar?.root.position;
      if (a && !wall) return Math.hypot(a.x - this.me.body.x, a.y - this.me.body.y, a.z - this.me.body.z) <= HELP_REACH ? { kind: 'friend', pid: friend.id } : { kind: 'far' };
    }
    // Not the animal you are riding, which is in the middle of the picture,
    // nor your pet riding along with you or sitting on your head.
    const critter = r.pickCritter(ray, maxDist, this.riding?.id ?? this.aboard?.id);
    const mode = this.pets.get(this.pid)?.sim.mode;
    const pet = r.pickPet(ray, maxDist, mode === 'ride' || mode === 'perch' ? this.pid : null);
    // Flowers and grass are see-through: one in front of an animal, or the
    // one it stands in (a bee at a flower is inside its cell), does not hide
    // it; nor does the water hide what swims in it.
    const seeThrough = !hit ? 0 : B.KIND[hit.id] === B.K_PLANT ? 1.5 : B.KIND[hit.id] === B.K_WATER ? 8 : 0;
    // The nearer of the two, an animal or a pet.
    const friends = [critter && { aim: { kind: 'critter', id: critter.id }, dist: critter.dist, at: this.critters.get(critter.id)?.model.group.position }, pet && { aim: { kind: 'pet', pid: pet.id }, dist: pet.dist, at: this.pets.get(pet.id)?.model.group.position }];
    for (const f of friends.filter(Boolean).sort((a, b) => a.dist - b.dist)) {
      if (hit && f.dist >= hit.dist + seeThrough) continue;
      if (f.at && Math.hypot(f.at.x - eye.x, f.at.y - eye.y, f.at.z - eye.z) <= REACH) return f.aim;
    }
    if (!hit) return null;
    if (Math.hypot(hit.x + 0.5 - eye.x, hit.y + 0.5 - eye.y, hit.z + 0.5 - eye.z) > REACH) return { kind: 'far' };
    return { kind: 'block', hit };
  }

  // The change the current tool would make at a hit, and how to show it.
  plan(hit) {
    const w = this.world;
    const facing = facingFromYaw(this.renderer.view.yaw);
    // Treasures, and gem rocks to dig a jewel out of, whatever the tool.
    if (B.KIND[hit.id] === B.K_ITEM || B.GEM_ROCK[hit.id]) return { kind: 'collect', ...pickEdit(w, hit, 1), mode: 'remove' };
    switch (this.tool) {
      case 'build': {
        const id = this.selectedBlock();
        if (this.basketPick && (this.profile.basket[this.basketPick] ?? 0) <= 0) return { kind: 'build', cells: [], collected: [], mode: 'add', empty: true };
        const bodies = [{ ...this.me.body, radius: BODY.radius + 0.02, height: BODY.height }];
        if (this.riding) bodies.push({ ...this.riding.body, radius: this.riding.body.radius + 0.02 });
        return { kind: 'build', ...buildEdit(w, hit, id, this.basketPick ? 1 : this.size, bodies, facing), mode: 'add' };
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
    // Sitting dizzy, you wait for a friend.
    if (this.dizzy) {
      this.sound.play('no');
      return;
    }
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
    if (aim.kind === 'pet') {
      this.touchPet(aim.pid);
      return;
    }
    if (aim.kind === 'monster') {
      this.emit('notice', { text: this.touch ? 'Walk up to it and press 👊 to bop it!' : 'Walk up to it and press X to bop it!', level: 'info' });
      return;
    }
    if (aim.kind === 'friend') {
      this.send({ t: 'help', pid: aim.pid });
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
    // Undo would put a treasure back to be found again: finding is for keeps.
    if (!this.edit(kind, cells, { undoable: plan.kind !== 'collect' })) return;
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
        } else {
          p.count('placed', n);
          if (B.KIND[first] === B.K_FURNITURE) p.count('furnished', n);
        }
        break;
      case 'pick':
      case 'collect':
        this.sound.play(B.GEM_ROCK[plan.collected?.[0]] ? 'dig' : 'pop');
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
    const colors = ['#ffd84d', '#ffffff', '#ff8fc4'];
    const dug = [];
    for (const id of ids) {
      const key = B.block(id).collect;
      if (!key) continue;
      p.addToBasket(key, 1);
      if (B.FRUIT_ITEMS.includes(id)) p.count('fruit');
      else if (id === B.SHELL) p.count('shells');
      else if (id === B.STAR_PIECE) p.count('stars');
      else if (B.isJewel(id)) {
        p.count('gems');
        if (key === 'diamond') p.count('diamonds');
        const gem = B.GEMS.find(([k]) => k === key);
        if (gem) colors.unshift(gem[3], gem[3]);
        if (B.GEM_ROCK[id]) dug.push(gem);
      }
      this.emit('collected', { key, id });
    }
    // Dug out of the rock: say which jewel it was.
    if (dug.length === 1) this.emit('toast', { icon: '💎', text: `You found ${/^[aeiou]/i.test(dug[0][1]) ? 'an' : 'a'} ${dug[0][1]}!` });
    else if (dug.length > 1) this.emit('toast', { icon: '💎', text: `You found ${dug.length} jewels!` });
    this.sound.play('collect');
    this.renderer.effects.sparkles(cells[0] + 0.5, cells[1] + 0.6, cells[2] + 0.5, dug.length ? 24 : 12, colors);
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
    const id = B.baseOf(aim.hit.id);
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
    // A vehicle is only honked at, whatever is in your hand.
    if (CRITTER_INFO[entry.type].vehicle) {
      this.send({ t: 'critter', op: 'pet', id });
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
    else if (this.aboard) this.rideAlong(input);
    else this.moveMe(dt, input);
    this.rideTarget = this.findRideable();
    const on = this.me.body;
    this.seatTarget = !this.riding && !this.aboard && !this.seat && !this.dizzy && !on.flying && on.onGround ? seatNear(this.world, on) : null;
    this.sendMove();
    this.updatePlayers(dt);
    if (this.seat) this.checkTeaParty();
    this.updateCritters(dt);
    this.seatPassengers(dt);
    this.updatePets(dt);
    this.updateMonsters(dt);
    this.updateAdventure(dt);
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
    // Sitting or lying down, your eyes are lower than your hips are high.
    this.renderer.updateCamera(dt, this.seat ? { x: b.x, y: b.y - (this.me.anim === ANIM.sit ? 0.45 : 0.95), z: b.z } : b);
    this.selfVisible(this.renderer.camDist > 1.3);
    this.renderer.frame(dt, { time: env.time, weather: env.weather, focus: { x: b.x, y: b.y, z: b.z } });
    this.observe();
  }

  // On an elevator pad, jump goes up to the next pad above and down goes to
  // the one below.
  boardLift(input) {
    const b = this.me.body;
    if (b.flying || (!input.jump && !input.down)) return false;
    const lift = startLift(this.world, b, input.jump ? 1 : -1);
    if (!lift) return false;
    this.lift = lift;
    this.sound.play('lift', { up: lift.dir > 0 });
    this.profile.count('lifts');
    return true;
  }

  // Carries you along the ride you are on, and the events a step has.
  rideLift(dt) {
    const b = this.me.body;
    const lift = this.lift;
    if (b.flying || Math.hypot(b.x - lift.x, b.z - lift.z) > 1.5) {
      this.lift = null;
      return { jumped: false, landed: 0, splashed: false, bumped: false };
    }
    if (stepLift(b, lift, dt)) {
      this.lift = null;
      this.liftLatch = true;
      unstick(this.world, b);
      this.sound.play('ding');
    }
    return { jumped: false, landed: 0, splashed: false, bumped: false };
  }

  // Hidden while you look through your own eyes, and blinking for a moment
  // after a monster bumps into you.
  selfVisible(on) {
    const a = this.players.get(this.pid)?.avatar;
    const now = performance.now();
    const blink = now < (this.flashUntil ?? 0) && Math.floor(now / 90) % 2 === 1;
    if (a) a.root.visible = on && !blink;
  }

  // Looking through your own eyes, left and right turn you (and the way you
  // look) instead of stepping sideways; from anywhere else they walk that way.
  steer(move, dt) {
    if (this.renderer.camDist > 1.3 || !move.x) return move;
    this.renderer.view.yaw -= move.x * TURN_SPEED * dt;
    if (!this.riding) this.me.yaw = this.renderer.view.yaw + Math.PI;
    return { x: 0, y: move.y };
  }

  moveMe(dt, input) {
    if (this.seat) {
      this.stayInSeat(dt, input);
      return;
    }
    const me = this.me;
    const b = me.body;
    const w = this.world;
    // Sitting dizzy, you go nowhere.
    const still = this.dizzy;
    const move = this.steer(still ? { x: 0, y: 0 } : input.readMove(), dt);
    const yaw = this.renderer.view.yaw;
    // Forward is away from the camera.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const mx = fx * move.y + -fz * move.x;
    const mz = fz * move.y + fx * move.x;
    // Faster in the gear you wear from the shop.
    const gear = gearMove(this.profile.data.gear, MOVE);
    // Jump still held on getting off a lift does not also hop.
    if (!input.jump) this.liftLatch = false;
    const events = this.lift ? this.rideLift(dt) : !still && this.boardLift(input) ? this.rideLift(dt) : stepBody(w, b, { mx, mz, jump: !still && input.jump && !this.liftLatch, down: !still && (input.down || this.landNext), run: input.run }, dt, { autoJump: this.profile.settings.autoJump, bounce: true, move: gear });
    // Down pressed while bouncing lasts until you stand on something.
    if ((b.onGround && b.vy === 0) || b.flying || b.inWater) this.landNext = false;
    if (this.monsters.size) this.stomp();
    // Walked into someone, an animal, a monster or a pet: back out of them.
    if (!this.lift) keepApart(w, b, this.standing(), `p${this.pid}`);
    if (!this.toldLift && !this.lift && padUnder(w, b)) {
      this.toldLift = true;
      this.emit('toast', { icon: '🛗', text: `An elevator! ${this.touch ? 'Jump' : 'Press Space'} to go up, ${this.touch ? '⬇️' : 'Shift'} to go down.` });
    }
    if (!this.toldBounce && (events.bounced || (b.onGround && onTrampoline(w, b)))) {
      this.toldBounce = true;
      this.emit('toast', { icon: '🤸', text: `A trampoline! Hold ${this.touch ? 'jump' : 'Space'} to bounce higher and higher, ${this.touch ? '⬇️' : 'Shift'} to stop.` });
    }
    const speed = Math.hypot(b.vx, b.vz);
    if (speed > 0.3) me.yaw = lerpAngle(me.yaw, Math.atan2(b.vx, b.vz), Math.min(1, dt * 12));
    me.speed = speed;
    me.anim = b.flying ? ANIM.fly : b.inWater ? ANIM.swim : !b.onGround ? ANIM.air : still ? ANIM.dizzy : speed > ((gear ?? MOVE).walk + (gear ?? MOVE).run) / 2 ? ANIM.run : speed > 0.4 ? ANIM.walk : ANIM.idle;
    const fxs = this.renderer.effects;
    if (events.bounced) {
      this.sound.play('boing', { speed: events.bounced });
      fxs.boing(b.x, events.bouncedAt, b.z, events.bounced >= BOUNCE.max);
      this.profile.count('bounces');
    } else if (events.jumped) {
      this.sound.play('jump');
    }
    // Not on whether you were on the ground before this frame: just over it
    // counts as on it, and a fall can end there a frame before it lands.
    if (events.landed > 7) {
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
    if (!b || this.dizzy) return;
    // Off the animal you are riding, and up into the air.
    if (this.aboard) {
      this.getOut();
      b.flying = false;
    }
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
      // Sitting on a chair or a sofa (not lying in bed): tea party company.
      p.sitting = s.anim === ANIM.sit;
      const mount = p.seated ? [...this.critters.values()].find((c) => c.rider === p.id || c.lastRider === p.id || c.passengers.includes(p.id)) : null;
      a.ride = mount ? CRITTER_INFO[mount.type].ride : null;
      a.update(dt, s.anim, Math.min(speed, 12));
      this.renderer.placeShadow(a.shadow, s.x, s.y, s.z);
      if (p.seated || s.anim === ANIM.sit || s.anim === ANIM.lie || s.anim === ANIM.curl) a.shadow.visible = false;
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
      const { x, z } = p.avatar.root.position;
      const y = p.avatar.root.position.y + p.avatar.tall;
      const fx = this.renderer.effects;
      if (e.key === 'hearts') fx.hearts(x, y + 1.5, z, 1);
      else if (e.key === 'dance') fx.notes(x, y + 1.6, z);
      else if (e.key === 'sleepy') fx.zzz(x, y + 1.5, z);
      else if (e.key === 'surprise' && !e.done) {
        fx.bang(x, y + 1.7, z);
        e.done = true;
      } else if (e.key === 'cheer' || e.key === 'clap') fx.sparkles(x, y + 1.6, z, 2);
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
      const far = { seagull: 24, whale: 34, dolphin: 18, mosquito: 16 }[c.type] ?? (info?.big ? 14 : 9);
      const rare = c.type === 'seagull' || c.type === 'whale' ? 2 : 1;
      if (!info?.vehicle && state !== 'sleep' && night === Boolean(info?.nocturnal) && now > c.voiceAt && this.near(s.x, s.y, s.z, far)) {
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

  // Things worth a sticker that just happen: night skies, rainbows, and a
  // night in a tent.
  observe() {
    const night = isNight(this.env.time);
    if (night && !this.seenNight) {
      this.seenNight = true;
      this.profile.count('nights');
    }
    const b = this.me.body;
    const inTent = underTent(this.world, b.x, b.y, b.z);
    if (inTent && !night && !this.toldTent) {
      this.toldTent = true;
      this.emit('toast', { icon: '⛺', text: 'A tent! Come in here at night for a camp out.' });
    }
    // Once a night: in a tent, that is a camp out.
    if (!night) this.campedOut = false;
    else if (inTent && !this.campedOut) {
      this.campedOut = true;
      this.toldTent = true;
      this.profile.count('campouts');
      this.emit('toast', { icon: '⛺', text: 'A camp out! Snug as a bug in a tent.' });
      this.renderer.effects.sparkles(b.x, b.y + 1.8, b.z, 12, ['#ffd84d', '#ffffff', '#c3a9f2']);
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
    this.profile.removeEventListener('change', this.onProfile);
    for (const pid of [...this.pets.keys()]) this.dropPet(pid);
    for (const pid of [...this.players.keys()]) this.renderer.removeAvatar(pid);
    for (const id of [...this.critters.keys()]) this.renderer.removeCritter(id);
    for (const id of [...this.monsters.keys()]) this.renderer.removeMonster(id);
    this.renderer.clearFlags();
    this.players.clear();
    this.critters.clear();
    this.monsters.clear();
    this.renderer.showPreview(null);
    this.renderer.showOutline(null);
    this.sound.setSong(null);
  }
}
