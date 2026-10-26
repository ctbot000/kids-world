// One visit to an island, from this player's side: the copy of the world,
// you walking about, your friends, the animals and any monsters moving
// smoothly, your HP, an adventure island's camps and flags, a tower
// defense island's waves and towers, the tools,
// and everything said and done. Talks to the island through a link (see
// net.js) and draws through the renderer.
import * as B from './shared/blocks.js';
import { ARCADE_GAMES, arcadeNear, keyOf } from './shared/arcade.js';
import { goBoardNear, isGoBoard } from './shared/go.js';
import { cleanRound } from './shared/hideseek.js';
import { gashaponNear, isGashapon } from './shared/gashapon.js';
import { BENCH_H, pianoNear, pianoSeat } from './shared/piano.js';
import { tvNear } from './shared/tv.js';
import { cleanScreens, isComputer, screenNear } from './shared/screens.js';
import { furnitureDrop } from './shared/furniture.js';
import { stationNear } from './shared/station.js';
import { breakLeft, chalkboardNear, CLASS_SIZE } from './shared/school.js';
import { cookBreakLeft, cookCoins, makeLesson, recipeByKey, stoveNear } from './shared/cooking.js';
import { allByHeart, answerStudy, cleanNotebook, fileStudy, isStudyDesk, makeStudy, workbookByKey } from './shared/study.js';
import { load, save } from './storage.js';
import { applyStroke, blankPicture, boardNear, cleanStroke, decodePicture, isBlank, isBoard } from './shared/drawing.js';
import { DRAGON_HEARTS, FIRE, RIDE_FIRE, RIDE_HEARTS, TAMES_TO_INVITE } from './shared/dragon.js';
import { critterBox, CRITTER_INFO, headTop, mountUnder, riderAt, seatsFor, SURFACE, unpackCritter, waterColumn } from './shared/critters.js';
import { advanceTime, isNight } from './shared/env.js';
import { cleanStage, HELP_REACH } from './shared/adventure.js';
import { BUILD_REACH, DEFENSE_STATES, MAX_LEVEL, TOWER_COST, towerTop } from './shared/defense.js';
import { XP_FOR } from './shared/levels.js';
import { ARM_REACH, bodyOf, bopGap, HIT_MS, isHeavy, maxHp, STOMP, unpackMonster } from './shared/monsters.js';
import { padUnder, startLift, stepLift } from './shared/elevator.js';
import { EMOTE_TRICKS, makePet, placePet, petPose, startTrick, stepPet } from './shared/pets.js';
import { BODY, BOUNCE, keepApart, makeBody, MOVE, onTrampoline, stepBody, unstick } from './shared/physics.js';
import { raycast } from './shared/raycast.js';
import { freeSpot, seatNear, seatPose, standUpAt, teaTableNear, tubsShared } from './shared/seats.js';
import { getOffAt, rideState, startRide, stepRide } from './shared/riding.js';
import { isValidCode } from './shared/codes.js';
import { PROTOCOL } from './shared/room.js';
import { cleanPiece, SONG_MAX_BYTES, songName, SongPieces, songPieces } from './shared/song.js';
import { gearMove, POTION, weaponOf, wornOutfit, wornWeapon } from './shared/shop.js';
import { facingFromYaw, STAMPS } from './shared/stamps.js';
import { underTent } from './shared/tents.js';
import { applyCells, buildEdit, drillEdit, harvestEdit, hillEdit, paintEdit, pickEdit, REACH, stampEdit, waterEdit } from './shared/tools.js';
import { makeQuiz, quizCoins, QUIZ_LEVELS, WIN_OFFER_MS } from './shared/quiz.js';
import { World } from './shared/world.js';
import { lookHair, lookTall, petKind, PHRASES, STICKERS as STICKER_EMOJI } from './shared/words.js';
import { ANIM, shirtColor, SWINGS } from './render/avatar.js';
import { flashModel } from './render/toon.js';

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
// How the camera looks arriving at an island with a view to show: nearly level, to take in a building.
const ARRIVE_PITCH = -0.06;
const INTERP_MS = 130;
const CRITTER_INTERP_MS = 260;
// A monster is drawn where it is now (see monsterNow): carried on from its
// last update no further than this, a guess put right fading out this fast,
// and not carried on at all in these states, when it stands still.
const PREDICT_MS = 260;
const PREDICT_FADE = 8;
const STILL_STATES = new Set(['idle', 'giggle', 'stomp', 'dazed']);
// A bopped monster flies back about this far (the host's HIT_PUSH, see
// monsters.js), most of it in the first KICK_SECS: drawn so at once, not
// only once the host's next update says so.
const KICK_DIST = 1.4;
const KICK_SECS = 0.15;
// And as it flies back, it hops up off the ground (KICK_HOP high at the
// top, a small one less) and leans back from the blow (KICK_LEAN radians at
// the most), springing upright again, all in RECOIL_SECS.
const KICK_HOP = 0.45;
const KICK_LEAN = 0.5;
const RECOIL_SECS = 0.4;
const MOVE_SEND_MS = 90;
const REPEAT_MS = 230;
// Drops of water out of the watering can, and how seldom crops ripening near
// you play their little tune.
const WATER_DROPS = ['#5fb8ff', '#a8dcff', '#ffffff'];
const RIPE_TUNE_MS = 4000;
const UNDO_KEEP = 40;
// Game time, not wall-clock time: a frame that comes late cannot use up a
// speech bubble before it has been drawn.
const BUBBLE_SECS = 4.5;
// The 👊 button: the bubble blaster's bubble goes at a monster no further
// round from straight ahead than this (the cosine of 70°); any other swing
// sweeps round in front of you, like a sword in a Zelda game, and hits every
// monster it passes, as far round as this either side (the cosine of 100°).
const FRONT = 0.34;
const SWEEP = -0.17;
// A weapon this many swings from breaking says so.
const WEAR_WARN = 10;

// A monster bopped flashes white, on and off, this long.
const FLASH_MS = 300;
// A volcano island's own dragon, still wild (dragon.js): not to ride yet, but to bop.
const wildDragon = (c) => c.type === 'dragon' && Boolean(c.fight) && c.fight.mood !== 'tame';
const FLASH_BLINK = 75;
// How each swing's slash looks (render/effects.js slash): its colour, how
// high over the swinger's feet, and the hammer's coming down from overhead.
// The blaster has none: it blows a bubble.
const SLASHES = {
  punch: { color: '#ffe27a', y: 0.95 },
  sword: { color: '#4fc3ff', y: 0.95 },
  hammer: { color: '#ffc21a', y: 1.25, upright: true },
  lavablade: { color: '#ff6a1f', y: 0.95 },
};
// How each swing lands on a monster: your swing and the monsters it hit
// stop dead for stop ms (a little longer for each more one), the camera
// jolts by shake, and the hit bursts in the slash's colour. The heavier the
// weapon, the harder it lands.
const IMPACTS = {
  punch: { stop: 55, shake: 0.06 },
  sword: { stop: 70, shake: 0.08 },
  hammer: { stop: 120, shake: 0.2 },
  lavablade: { stop: 100, shake: 0.14 },
};
const STOP_MORE = 15;
const STOP_MAX = 160;
// How much more than HIT_MS apart bops are sent.
const BOP_SPACING = 120;
// What each tougher monster is, told the first time one comes out near you.
const TOUGH_TOLD = {
  big: { icon: '💪', text: 'A Big Bruiser! It bumps twice as much HP off you and takes six bops. Jumping on it takes three.' },
  spiky: { icon: '🦔', text: 'A Spiky! Don’t jump on it, ouch! Bop it four times instead.' },
  mosquito: { icon: '🦟', text: 'A giant mosquito! It darts at you out of the air, so don’t try to jump on it — swat it instead: two bops and it’s off!' },
  spider: { icon: '🕷️', text: 'A giant spider! It scuttles quicker than you walk, so run! You can jump on it — twice — or bop it four times.' },
  knight: { icon: '🛡️', text: 'A Grumble Knight! Its helmet and shield make it tough: eight bops, or four jumps on its helmet. Cross, it is nearly as quick as you run!' },
  golem: { icon: '🗿', text: 'A Stone Golem! Slow but very strong: a bump takes three times as much HP. Twelve bops — or six jumps — to see it off.' },
};

// Which way (dx, dz) points, in words: north is -z (the map's top).
function compass(dx, dz) {
  const a = Math.atan2(dx, -dz);
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / (Math.PI / 4)) & 7];
}

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
    // Who you are when logged in, the same on all your devices (see main.js).
    this.who = '';
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
    // Monsters (shared/monsters.js), while the island has them, and your HP.
    this.monsters = new Map();
    this.hp = this.maxHp = maxHp(1);
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
    // dizzy there, out of HP, until a friend helps you up; the fireworks
    // when it is all free; and the extra-credit quizzes a conquered one
    // offers you (shared/quiz.js) — the offer, and the quiz you are taking.
    this.adventure = null;
    this.dizzy = false;
    this.fireworks = [];
    this.quizOffer = null;
    // The shared isle's next stage once this one is conquered (setNextStage).
    this.nextStage = null;
    this.quiz = null;
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
    // The games going at the island's arcade machines (shared/arcade.js),
    // by their machines' cells; the one close enough to play at, and the
    // one whose game you have open (see ui.js).
    this.arcade = new Map();
    this.arcadeTarget = null;
    this.arcadeAt = null;
    // The games of Go at the island's Go boards (shared/go.js), by their
    // boards' cell keys, the board you are by, and the one you play at.
    this.goGames = new Map();
    this.goTarget = null;
    this.goAt = null;
    // The game picked last at a board, to sit down to next: 'go' or 'gomoku'.
    this.goKind = 'go';
    // A round of hide and seek on the island (shared/hideseek.js), or null,
    // and when it was told of, to count its time down from.
    this.hideseek = null;
    this.hsAt = 0;
    // The gashapon machine beside you, and the one whose window is open.
    this.gashaTarget = null;
    this.gashaAt = null;
    // The piano beside you, and the one whose keyboard is open.
    this.pianoTarget = null;
    this.pianoAt = null;
    // The TV beside you, the one being watched, and its channel (the last
    // one watched, for the next TV too).
    this.tvTarget = null;
    this.tvAt = null;
    this.tvChannel = 0;
    // What the island's computers show, by cell (shared/screens.js), the
    // computer beside you to look at, and the one being looked at.
    this.screens = new Map();
    this.screenTarget = null;
    this.screenAt = null;
    // The broadcast station beside you, and the one you opened (shared/station.js).
    this.stationTarget = null;
    this.stationAt = null;
    // The chalkboard beside you (shared/school.js), and when your last class
    // of each level ended, for the break before the next one.
    this.classTarget = null;
    // The drawing board beside you, the one whose picture is open, and the
    // pictures on the island's boards, by cell key (shared/drawing.js).
    this.drawTarget = null;
    this.drawAt = null;
    this.drawings = new Map();
    this.classEnded = { junior: 0, senior: 0 };
    // The stove beside you (shared/cooking.js), when you last cooked each
    // recipe, for the break before the next time, and the cooking class
    // going: { recipe, asks, step, misses, right, done, coins, xp }.
    this.stoveTarget = null;
    this.cookEnded = {};
    this.cooking = null;
    // The study going at a study desk (shared/study.js): { book, asks, at,
    // shown, missed, right, done, learnt, xp }.
    this.study = null;
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
    return { t: 'join', protocol: PROTOCOL, name: p.name, look: p.shownLook, token: this.token, ...(this.who ? { who: this.who } : {}), ...(this.typedPasscode ? { passcode: this.typedPasscode } : {}), ...(this.invitePass ? { pass: this.invitePass } : {}) };
  }

  // The world's own profile to earn and carry with here (the shared isle has
  // one apart from yours — see main.js, which swaps it in once the island has
  // said it is that one). Everything after — counts, basket, gear, the level
  // in your look — goes to whichever it is.
  useProfile(profile) {
    if (this.profile === profile) return;
    this.profile.removeEventListener('change', this.onProfile);
    this.profile = profile;
    this.profile.addEventListener('change', this.onProfile);
    if (this.pid) this.syncPet(this.pid);
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
      case 'draw':
        this.drawHeard(msg);
        break;
      case 'piano':
        this.pianoHeard(msg);
        break;
      case 'swing': {
        const lands = this.players.get(msg.pid)?.avatar?.swing() ?? 0;
        const world = this.world;
        setTimeout(() => this.world === world && this.slashFrom(this.players.get(msg.pid)?.avatar), lands * 1000);
        break;
      }
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
      case 'chearts':
        this.rideHeartsNews(msg);
        break;
      case 'dragon':
        this.dragonNews(msg);
        break;
      case 'dhit':
        this.dragonHit(msg);
        break;
      case 'tamed':
        this.dragonTamed(msg);
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
      case 'hp':
        this.setHp(msg);
        break;
      case 'pop':
        this.popped(msg);
        break;
      case 'adv':
        this.adventureNews(msg);
        break;
      case 'gasha':
        this.gashaNews(msg);
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
      case 'next':
        this.setNextStage(msg);
        break;
      case 'helped':
        this.helped(msg);
        break;
      case 'healed':
        this.healed(msg);
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
      case 'arc':
        this.setArcade(msg.s);
        break;
      case 'arcfx':
        this.arcadeFx(msg);
        break;
      case 'go':
        this.setGo(msg.s);
        break;
      case 'screens':
        this.setScreens(msg.s);
        break;
      case 'gofx':
        this.goFx(msg);
        break;
      case 'hs':
        this.setHideSeek(msg.s);
        break;
      case 'hsfx':
        this.hideSeekFx(msg);
        break;
      case 'home':
        this.cameHome(msg);
        break;
      case 'env':
        this.setEnv(msg);
        break;
      case 'fx':
        if (msg.kind === 'star') this.fallingStar(msg);
        else if (msg.kind === 'blast') this.blast(msg);
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
    // An island everybody owns, so nobody is its owner (the public adventure
    // island): its card says which of its stages you are on.
    this.shared = msg.shared === true;
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
      if (c) this.addCritter({ ...c, name: names.get(c.id)?.name ?? '', rider: names.get(c.id)?.rider ?? 0, passengers: names.get(c.id)?.passengers }).fight = c.fight;
    }
    for (const id of [...this.monsters.keys()]) this.dropMonster(id);
    this.monsterStates(msg.monsters ?? []);
    this.setHp(msg);
    this.dizzy = false;
    this.setAdventure(msg.adventure ?? null);
    this.setNextStage(msg.next ?? null);
    this.setDefense(msg.defense ?? null);
    this.setArcade(msg.arcade ?? []);
    this.setGo(msg.go ?? []);
    this.setScreens(msg.screens ?? []);
    this.setHideSeek(msg.hideseek ?? null);
    this.setDrawings(msg.drawings ?? []);
    this.setEnv(msg.env);
    // The song goes on playing over a reconnect; its pieces come after this.
    if (msg.song?.id !== this.song?.id) this.setSong(msg.song ? { id: msg.song.id, name: songName(msg.song.name), ready: false } : null);
    // An island with a view to show turns you to it as you arrive.
    const view = !again && Number.isFinite(spawn.yaw);
    this.renderer.view.yaw = view ? spawn.yaw : Math.PI * 0.9;
    if (view) {
      this.renderer.view.pitch = ARRIVE_PITCH;
      this.me.yaw = spawn.yaw + Math.PI;
    }
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
    const player = { id: p.id, name: p.name, look: p.look, snaps: [], avatar: this.renderer.addAvatar(p.id, p.look, p.name), anim: 0, bubble: null, dizzy: p.dizzy === true, ai: p.ai === true };
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
      entry.fight = c.fight;
      // A ridden dragon's own hearts ride along in its fight (dragon.js packFight).
      if (c.fight?.rideHearts != null) {
        entry.rideHearts = c.fight.rideHearts;
        entry.rideMax = RIDE_HEARTS;
      }
      entry.snaps.push({ t: now, x: c.x, y: c.y, z: c.z, yaw: c.yaw, state: c.state });
      if (entry.snaps.length > 8) entry.snaps.shift();
    }
    for (const id of [...this.critters.keys()]) if (!seen.has(id)) this.dropCritter(id);
  }

  critterAdded(msg) {
    const c = msg.s ? unpackCritter(msg.s) : null;
    if (!c || this.critters.has(c.id)) return;
    const entry = this.addCritter({ ...c, name: msg.critter.name });
    entry.fight = c.fight;
    // A ridden dragon's own hearts ride along in its fight (dragon.js packFight).
    if (c.fight?.rideHearts != null) {
      entry.rideHearts = c.fight.rideHearts;
      entry.rideMax = RIDE_HEARTS;
    }
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
    // A giant clam tapped: its shells gape with a puff of bubbles, and the
    // one who tapped it finds a pearl in their basket if there was one.
    if (msg.fx === 'clam') {
      this.renderer.effects.sparkles(p.x, p.y + 0.3, p.z, 12, ['#cfeeff', '#ffffff', '#9fe8ff', '#e8f8ff']);
      if (this.near(p.x, p.y, p.z, 20)) this.sound.play('clam');
      if (msg.by === this.pid) {
        if (msg.pearl) {
          this.profile.addToBasket('pearl', 1);
          this.profile.count('pearls');
          this.sound.play('collect');
          this.emit('toast', { icon: '🦪', text: 'A pearl! It shines like the moon. ✨' });
        } else {
          this.sound.play('bubble');
        }
      }
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
      // Curled up in its bed it stays put: nothing shoves it out.
      const abed = sim.mode === 'bed' && sim.state === 'sleep';
      if (!abed && !sim.info.flies && sim.mode !== 'ride' && keepApart(this.world, sim.body, this.standing(`pet${pet.pid}`), `pet${pet.pid}`)) [sim.x, sim.z] = [sim.body.x, sim.body.z];
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
      // parrot on your head would sit on them. A friend hiding from you at
      // hide and seek hides with their pet: it would give them away.
      m.group.visible = Math.hypot(at.x - cam.x, at.y - cam.y, at.z - cam.z) < m.seen && !(pet.pid === this.pid && sim.mode === 'perch' && this.renderer.camDist <= 1.3) && !this.hiddenFromMe(pet.pid);
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

  // Petting a pet (anyone's), or giving it a fruit or a vegetable you are
  // holding: it shows here at once, and everyone else sees it too.
  touchPet(pid) {
    const pet = this.pets.get(pid);
    if (!pet) return;
    const fruit = this.basketPick && B.isFood(this.basketPick) ? this.basketPick : null;
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

  // Your HP, and the most you can have, as a message carries them ({ hp, max }).
  setHp(msg) {
    if (Number.isInteger(msg?.max) && msg.max > 0) this.maxHp = msg.max;
    if (Number.isInteger(msg?.hp)) this.hp = Math.max(0, Math.min(this.maxHp, msg.hp));
    this.emit('hp', this.hp);
  }

  // A monster bumped into someone: you are knocked back (further by King
  // Grumble), or out of HP sent home, or on an adventure island left
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
      if (msg.dizzy && p) this.emit('toast', { icon: '💫', text: `${p.name} is out of HP! Go and tap them to help them up.` });
      return;
    }
    if (msg.spiky && !this.toldSpikes) {
      this.toldSpikes = true;
      this.emit('toast', { icon: '🦔', text: 'Ouch, spikes! Bop a Spiky instead of jumping on it.' });
    }
    if (msg.fire && !this.toldFire) {
      this.toldFire = true;
      this.emit('toast', { icon: '🔥', text: 'Ouch, dragon fire! When it rears back, run out of the way it is facing — then bop it!' });
    }
    if (msg.lava && !this.toldLava) {
      this.toldLava = true;
      this.emit('toast', { icon: '🔥', text: 'Hot, hot, hot! Get out of the lava — it burns a lot!' });
    }
    this.setHp(msg);
    this.sound.play('bump');
    const b = this.me?.body;
    if (!b) return;
    // Knocked out of your seat, or off the piano bench.
    if (this.seat) this.standUp();
    if (this.pianoAt) {
      this.emit('piano-gone');
      this.closePiano();
    }
    this.renderer.effects.bang(b.x, b.y + 1.7, b.z);
    if (msg.home) {
      this.goHome(msg.at, this.adventure ? 'Out of HP! Back to the nearest safe place, where no monster goes.' : 'Out of HP! Back to the start of the island, where no monster goes.');
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
      // Out of HP, with friends about: sit tight for one to come.
      this.dizzy = true;
      if (this.riding) this.dismount();
      if (this.aboard) this.hopOff();
      b.flying = false;
      this.emit('fly', false);
      this.sound.play('dizzy');
      this.emit('toast', { icon: '💫', text: 'Out of HP! Sit tight: a friend can tap you to help you up.' });
      this.emit('dizzy', true);
    }
  }

  // Back to a safe place (at, as [x, y, z]; or the start of the island), and
  // on your feet with all your HP.
  goHome(at, text) {
    if (this.pianoAt) {
      this.pianoAt = null;
      this.emit('piano-gone');
    }
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
    const here = [p.x, p.y, p.z].every(Number.isFinite);
    const near = here && this.near(p.x, p.y, p.z, entry?.kind === 'king' ? 120 : 40);
    if (near) {
      fx.sparkles(p.x, p.y + 0.4, p.z, 18, ['#ffd84d', '#ffffff', '#b18cff', '#7fe08c']);
      fx.dust(p.x, p.y, p.z);
      // King Grumble goes with a much bigger pop.
      if (entry?.kind === 'big' || entry?.kind === 'knight' || entry?.kind === 'golem') fx.sparkles(p.x, p.y + 0.9, p.z, 30, entry.kind === 'golem' ? ['#b9bec7', '#ffffff', '#7fe08c'] : entry.kind === 'knight' ? ['#c9ced6', '#ffffff', '#62c4f5'] : ['#ff8fa3', '#ffffff', '#ffd84d']);
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
      // The reward for it, where it happened: stars out of the monster, and
      // a "+N ⭐" float over the spot (ui.js reward), with the XP it really
      // gave (levels.js), so what it says is what you got.
      const xp = XP_FOR.popped.xp;
      if (near) fx.stars(p.x, p.y + (entry?.kind === 'king' ? 1.4 : 0.7), p.z, isHeavy(entry?.kind) ? 7 : 4);
      if (here) this.emit('reward', { x: p.x, y: p.y, z: p.z, xp });
      if (first && entry?.kind !== 'king') this.emit('toast', { icon: '👾', text: 'Pop! Jump on a monster to pop it at once, or walk up to it and bop it until it pops.' });
    }
  }

  // A monster bopped, with hearts left: it squashes and hops back, and
  // whoever bopped it hears how many more bops it takes.
  monsterHit(msg) {
    const now = performance.now();
    const entry = this.monsters.get(msg.id);
    // Your own bop landed already (strike): it flashed, stopped and burst then.
    const struck = entry && msg.by === this.pid && now - (entry.struckAt ?? -Infinity) < 1500;
    if (entry) entry.model.squash = Math.max(entry.model.squash ?? 0, 0.4);
    if (entry && !struck) entry.flashUntil = now + FLASH_MS;
    if (entry && Number.isInteger(msg.hearts)) entry.hearts = msg.hearts;
    // Knocked back away from whoever bopped it (one marching keeps to its
    // road), once it has stopped dead from the blow.
    const from = msg.by === this.pid ? this.me?.body : this.players.get(msg.by)?.avatar?.root.position;
    let away = null;
    if (entry?.drawn && from) {
      const dx = entry.drawn.x - from.x;
      const dz = entry.drawn.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) away = { x: dx / d, z: dz / d };
    }
    if (entry && !struck && away) {
      entry.stopUntil = now + IMPACTS.punch.stop;
      if (!msg.march) entry.recoil = { ...away, at: entry.stopUntil };
    }
    if (away && !msg.march) entry.kick = { ...away, at: Math.max(now, entry.stopUntil ?? 0), snap: entry.seenSnap };
    const p = entry?.model.group.position;
    if (p && this.near(p.x, p.y, p.z, 30)) {
      if (!struck && away) {
        const size = bodyOf(entry.kind);
        const r = size.radius * 0.8;
        this.renderer.effects.impact(p.x - away.x * r, p.y + size.height * 0.55, p.z - away.z * r, away.x, away.z, '#ffffff');
      }
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

  // ------------------------------------------------ the dragon (dragon.js)

  // A wild dragon woke up, breathed fire, went back to sleep or wild again.
  dragonNews(msg) {
    const c = this.critters.get(msg.id);
    if (!c) return;
    const p = c.model.group.position;
    const near = this.near(p.x, p.y, p.z, 45);
    if (msg.fx === 'fire') {
      // Its own rider lit the flames and heard the whoosh at once (breath);
      // the island's word is for everyone else.
      if (this.riding?.id === c.id) return;
      c.fireYaw = Number(msg.yaw) || 0;
      c.fireUntil = performance.now() + (Number(msg.ms) || FIRE.ms);
      if (near) this.sound.play('fire');
    } else if (msg.fx === 'wake' && near) {
      this.sound.play('roar');
    }
  }

  // A wild dragon bopped: it flashes, and whoever bopped it hears how it is going.
  dragonHit(msg) {
    const c = this.critters.get(msg.id);
    if (!c) return;
    const now = performance.now();
    if (msg.by !== this.pid) c.flashUntil = now + FLASH_MS;
    if (c.fight && Number.isInteger(msg.hearts)) c.fight = { ...c.fight, mood: msg.hearts ? 'awake' : 'tame', hearts: msg.hearts };
    const p = c.model.group.position;
    if (this.near(p.x, p.y, p.z, 30)) {
      this.renderer.effects.bang(p.x, p.y + CRITTER_INFO.dragon.ride.height * 0.7, p.z);
      this.sound.play('bump');
    }
    if (msg.by === this.pid && msg.hearts && now > (this.toldDragonHit ?? 0)) {
      this.toldDragonHit = now + 20000;
      this.emit('toast', { icon: '🐲', text: `Bonk! ${msg.hearts} more ${msg.hearts === 1 ? 'heart' : 'hearts'} and ${c.name || 'the dragon'} is tired out. Watch out for its fire!` });
    }
  }

  // A wild dragon bopped tame: everyone who helped has tamed it once more
  // (kept in your gear), and after TAMES_TO_INVITE a dragon of your own
  // comes from the toy box.
  dragonTamed(msg) {
    const c = this.critters.get(msg.id);
    if (c) {
      c.fight = { mood: 'tame', hearts: 0, max: c.fight?.max ?? DRAGON_HEARTS };
      c.fireUntil = 0;
      const p = c.model.group.position;
      if (this.near(p.x, p.y, p.z, 60)) {
        const top = p.y + CRITTER_INFO.dragon.ride.height;
        this.renderer.effects.hearts(p.x, top, p.z, 8);
        this.renderer.effects.sparkles(p.x, top - 1, p.z, 30, ['#7fe08c', '#ffffff', '#ffd84d']);
        this.renderer.effects.firework(p.x, top + 2, p.z);
        this.sound.play('victory');
      }
    }
    const name = msg.name || 'the dragon';
    if (!Array.isArray(msg.by) || !msg.by.includes(this.pid)) {
      const hero = this.players.get(msg.hero)?.name;
      if (hero) this.emit('toast', { icon: '🐲', text: `${hero} tamed ${name}! Anyone can ride it now.` });
      return;
    }
    const n = this.profile.tameDragon();
    const left = TAMES_TO_INVITE - n;
    const text =
      left > 0
        ? `You tamed ${name}! Walk up and ride it. Tame a dragon ${left} more ${left === 1 ? 'time' : 'times'} to bring your own from the toy box (${n} of ${TAMES_TO_INVITE}).`
        : left === 0
          ? `You tamed ${name} — that’s ${TAMES_TO_INVITE} times! 🐲 A dragon of your own is in your toy box now: bring it to any island!`
          : `You tamed ${name} again! That’s ${n} times. Walk up and ride it!`;
    this.emit('toast', { icon: '🐲', text });
  }

  // Each frame, a dragon's flames while it breathes them, white flashes when
  // bopped, and a word about a wild one the first time you come near it.
  dragonFrame(c, s, now) {
    const m = c.model;
    const flash = now < (c.flashUntil ?? 0) && Math.floor((c.flashUntil - now) / FLASH_BLINK) % 2 === 0;
    if (flash || c.flashed) flashModel(m.group, flash);
    c.flashed = flash;
    if (now < (c.fireUntil ?? 0) && m.group.visible && m.mouth) {
      const at = m.mouth();
      this.renderer.effects.flames(at.x, at.y, at.z, c.fireYaw ?? s.yaw, FIRE.reach, FIRE.angle);
    }
    const me = this.me?.body;
    if (me && wildDragon(c) && !this.toldWild && Math.hypot(s.x - me.x, s.z - me.z) < 18) {
      this.toldWild = true;
      this.emit('toast', { icon: '🐲', text: `A wild dragon! Come close and it wakes up and breathes fire. Bop it (${this.touch ? '👊' : 'X'}) until it is tired out to tame it, then ride it!` });
    }
  }

  // Bopping a monster, or landing on it (on).
  bop(id, on = false) {
    this.send(on ? { t: 'bop', id, on: true } : { t: 'bop', id });
  }

  // Drinking an HP potion (the 🧪 button by your HP, or Y): one out of your
  // pocket and, the island agreeing (room.js), all your HP back at once —
  // sitting dizzy too, up you get on your own. Says whether you drank it.
  drink() {
    if (!this.world || !this.me) return false;
    if (this.hp >= this.maxHp && !this.dizzy) {
      this.emit('toast', { icon: '🧪', text: 'Your HP is already full up!' });
      return false;
    }
    if (!this.profile.drinkPotion()) {
      this.emit('toast', { icon: '🧪', text: `No potions left! The 🛒 shop sells them for ${POTION.price} coins.` });
      return false;
    }
    this.send({ t: 'potion' });
    return true;
  }

  // The next of your toy weapons into your hand (N, or the button by the
  // bop button): whichever of those you own you like, kept for every island.
  // Says whether it changed (with one weapon or none, there is nothing to
  // change, and the shop is where weapons come from).
  cycleWeapon() {
    if (!this.world || !this.profile) return false;
    const weapon = this.profile.nextWeapon();
    if (!weapon) return false;
    this.sound.play('ui');
    this.emit('toast', { icon: weapon.icon, text: `${weapon.name} in hand!` });
    return true;
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

  // The slash a swing leaves in the air as it lands, round in front of
  // whoever swung (avatar) as far as their weapon reaches.
  slashFrom(avatar) {
    const look = avatar && SLASHES[avatar.weaponKind ?? 'punch'];
    if (!look) return;
    const { position: at, rotation, scale } = avatar.root;
    if (!this.near(at.x, at.y, at.z, 40)) return;
    const reach = 0.3 + ARM_REACH + (weaponOf(avatar.weaponKind)?.reach ?? 0);
    this.renderer.effects.slash(at.x, at.y + look.y * scale.y, at.z, rotation.y, { reach, color: look.color, upright: look.upright });
  }

  // Your swing landing on monsters (hits, as attack found them), at once,
  // not only once the island says so: the swing and every monster in it
  // stop dead a moment, as in a Zelda game, the camera jolts, each one
  // flashes and squashes, a burst flies off it from where the blow met it,
  // and it hops back leaning away from the blow; the whack is as heavy as
  // the weapon (kind) is. Not King Grumble safe in his bubble: that bounces.
  strike(hits, kind, dragons = []) {
    const look = IMPACTS[kind] ?? IMPACTS.punch;
    const color = SLASHES[kind]?.color ?? SLASHES.punch.color;
    const now = performance.now();
    const until = now + Math.min(STOP_MAX, look.stop + STOP_MORE * (hits.length - 1));
    const b = this.me.body;
    let landed = 0;
    for (const hit of hits) {
      const entry = this.monsters.get(hit.id);
      if (!entry || (entry.kind === 'king' && this.adventure?.shield)) continue;
      const m = entry.model.group.position;
      const dx = m.x - b.x;
      const dz = m.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      entry.stopUntil = until;
      entry.struckAt = now;
      entry.flashUntil = until + FLASH_MS;
      entry.model.squash = Math.max(entry.model.squash ?? 0, 0.45);
      entry.recoil = { x: dx / d, z: dz / d, at: until };
      // Where the blow met it: its near side, a little over half way up.
      const r = hit.size.radius * 0.8;
      this.renderer.effects.impact(m.x - (dx / d) * r, m.y + hit.size.height * 0.55, m.z - (dz / d) * r, dx / d, dz / d, color);
      landed++;
    }
    for (const hit of dragons) {
      const c = this.critters.get(hit.id);
      if (!c) continue;
      const m = c.model.group.position;
      const dx = m.x - b.x;
      const dz = m.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      c.flashUntil = until + FLASH_MS;
      const r = hit.size.radius * 0.8;
      this.renderer.effects.impact(m.x - (dx / d) * r, m.y + hit.size.height * 0.35, m.z - (dz / d) * r, dx / d, dz / d, color);
      landed++;
    }
    if (!landed) return;
    this.hitStopUntil = until;
    this.renderer.shake(look.shake);
    this.sound.play('whack', { kind });
  }

  // The 👊 button (or X): a swing of the arm, and whatever is in it. It
  // sweeps round in front of you and bops every monster it passes through,
  // as far as an arm reaches, further with a toy weapon (see shop.js), and
  // nothing through a wall; the bubble blaster's bubble goes at the nearest
  // one in front of you instead. Returns the nearest one's id, or null.
  attack() {
    if (!this.world || !this.me || this.aboard) return null;
    // On a dragon's back, a swing is a breath of fire instead (see breath).
    if (this.riding) return this.breath();
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
    const blaster = weapon?.key === 'blaster';
    const hits = [];
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
      if (gap > 0.25 && (dx * fx + dz * fz) / d < (blaster ? FRONT : SWEEP)) continue;
      const ey = b.y + BODY.eye;
      const dy = m.y + size.height / 2 - ey;
      const len = Math.hypot(dx, dy, dz) || 1;
      if (raycast(this.world, b.x, ey, b.z, dx / len, dy / len, dz / len, Math.max(0, len - size.radius), (block) => B.SOLID[block] === 1)) continue;
      const hit = { id, gap, dx, dz, m, size };
      hits.push(hit);
      if (!best || gap < best.gap) best = hit;
    }
    // A wild dragon in the sweep too (dragon.js): bopped tame.
    const dragons = [];
    for (const c of this.critters.values()) {
      if (!wildDragon(c)) continue;
      const m = c.model.group.position;
      const r = CRITTER_INFO.dragon.ride;
      const size = { radius: r.radius, height: r.height };
      const gap = bopGap(b, { x: m.x, y: m.y, z: m.z, ...size }, reach);
      if (gap === null) continue;
      const dx = m.x - b.x;
      const dz = m.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      if (gap > 0.25 && (dx * fx + dz * fz) / d < (blaster ? FRONT : SWEEP)) continue;
      const hit = { id: c.id, gap, dx, dz, m, size, dragon: true };
      dragons.push(hit);
      if (!best || gap < best.gap) best = hit;
    }
    // The blaster turns to aim at its one; a sweep goes the way you face,
    // turning only for one right up against you behind.
    const behind = (hit) => (hit.dx * fx + hit.dz * fz) / (Math.hypot(hit.dx, hit.dz) || 1) < SWEEP;
    if (best && (blaster || behind(best))) this.me.yaw = Math.atan2(best.dx, best.dz);
    // The bop (and a blaster's bubble) goes when the swing lands, a moment on;
    // the whoosh of a swing as it starts.
    const lands = this.players.get(this.pid)?.avatar?.swing() ?? 0;
    this.send({ t: 'swing' });
    if (!blaster) this.sound.play('swish');
    const world = this.world;
    setTimeout(() => {
      if (this.world !== world) return;
      const yaw = this.me.yaw;
      const hand = { x: b.x + Math.sin(yaw) * 0.5, y: b.y + 1, z: b.z + Math.cos(yaw) * 0.5 };
      const at = best && (this.monsters.get(best.id)?.model.group.position ?? best.m);
      if (blaster) {
        if (at) this.renderer.effects.bubbleShot(hand.x, hand.y, hand.z, at.x, at.y + best.size.height / 2, at.z);
        else this.renderer.effects.bubbleShot(hand.x, hand.y, hand.z, hand.x + Math.sin(yaw) * reach, hand.y, hand.z + Math.cos(yaw) * reach);
        this.sound.play('blow');
      } else {
        this.slashFrom(this.players.get(this.pid)?.avatar);
        if (hits.length || dragons.length) this.strike(hits, weapon?.key ?? 'punch', dragons);
      }
      if (best) {
        this.bopSentAt = performance.now();
        for (const hit of blaster ? [best] : [...hits, ...dragons]) {
          if (hit.dragon) this.send({ t: 'critter', op: 'hit', id: hit.id });
          else this.bop(hit.id);
        }
        this.wearOut();
      }
    }, lands * 1000);
    if (best) return best.id;
    // A monster you can see but not reach: say how bopping works, now and then.
    const near = [...this.monsters.values()].some(({ model: { group: { position: m } } }) => Math.hypot(m.x - b.x, m.y - b.y, m.z - b.z) < 8);
    if (near && now > (this.toldReach ?? 0)) {
      this.toldReach = now + 20000;
      this.emit('toast', { icon: weapon?.icon ?? '👊', text: blaster ? 'Turn to face a monster a few steps away, then bop!' : 'Walk right up to a monster, then swing!' });
    }
    return null;
  }

  // On a dragon's back (attack above): a burst of fire ahead of it, told to
  // the island (room.js dragonBreath, which bops the monsters in the flames
  // and keeps the once-a-second pace) and lit here at once, the way a wild
  // dragon's flames show (dragonFrame). Returns the ride, or null — nothing
  // at all when the breath is not ready yet.
  breath() {
    const ride = this.riding;
    if (!ride || ride.type !== 'dragon') return null;
    const now = performance.now();
    if (now - (this.breathAt ?? -Infinity) < RIDE_FIRE.every) return null;
    this.breathAt = now;
    this.send({ t: 'critter', op: 'fire', id: ride.id });
    // The flames and the whoosh right away, on its entry — that is what
    // mountPose and dragonFrame read — and the island's word comes to
    // everyone else as a 'dragon' fx (dragonNews), as for a wild one.
    const c = this.critters.get(ride.id);
    if (c) {
      c.fireYaw = this.me.yaw;
      c.fireUntil = now + RIDE_FIRE.ms;
    }
    this.sound.play('fire');
    return ride;
  }

  // A swing that landed wears the weapon in your hand (shop.js usesLeft):
  // a word when it is nearly worn out, and when it breaks — out of your
  // hand, the next best you have in it (or your fist) — till the shop fixes it.
  wearOut() {
    const used = this.profile.useWeapon();
    if (!used) return;
    const { weapon, left } = used;
    if (!left) {
      this.sound.play('no');
      const next = wornWeapon(this.profile.data.gear);
      this.emit('toast', { icon: '💔', text: `Your ${weapon.name} broke! ${next ? `${next.icon} ${next.name} in hand. ` : ''}Fix it in the 🛒 shop.` });
    } else if (left === WEAR_WARN) {
      this.emit('toast', { icon: weapon.icon, text: `Your ${weapon.name} is wearing out: ${left} more bops. Fix it in the 🛒 shop!` });
    }
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
      entry.stomped = isHeavy(entry.kind) || entry.kind === 'knight' || this.defense ? now + 500 : Infinity;
      this.bop(entry.id, true);
      b.vy = 9;
      this.sound.play('jump');
      return;
    }
  }

  // Where a monster is drawn: where it is now, as near as can be told, not
  // where it was a moment ago like the animals. Drawn in the past, one
  // chasing you was still a step off when its bump knocked you back, and one
  // you bopped flew back long after the bonk. So side to side it carries on
  // from its last update at the speed it was going (still, if it was
  // standing still), no further than PREDICT_MS on; a guess put right by
  // the next update fades out rather than jumping. Up and down it hops as
  // it did a moment ago (a hop is too quick to guess), stepping up onto
  // whatever it is over now; and it is never drawn inside you.
  monsterNow(entry, dt) {
    const snaps = entry.snaps;
    const last = snaps[snaps.length - 1];
    if (!last) return null;
    const past = this.interpolate(snaps, CRITTER_INTERP_MS);
    const prev = snaps[snaps.length - 2];
    let x = last.x;
    let z = last.z;
    if (prev && !STILL_STATES.has(last.state) && last.t - prev.t > 20) {
      const k = Math.min(performance.now() - last.t, PREDICT_MS) / (last.t - prev.t);
      x += (last.x - prev.x) * k;
      z += (last.z - prev.z) * k;
    }
    // A new update moving the guess: from where it was drawn, smoothly.
    if (entry.seenSnap !== last && entry.drawn) {
      entry.err = { x: entry.drawn.x - x, z: entry.drawn.z - z };
    }
    entry.seenSnap = last;
    // Bopped a moment ago, before any update since: flying back already.
    const kick = entry.kick;
    if (kick && kick.snap === last) {
      const d = KICK_DIST * (1 - Math.exp(-Math.max(0, performance.now() - kick.at) / 1000 / KICK_SECS));
      x += kick.x * d;
      z += kick.z * d;
    } else entry.kick = null;
    if (entry.err) {
      const fade = Math.exp(-dt * PREDICT_FADE);
      entry.err.x *= fade;
      entry.err.z *= fade;
      // Not across the island: a long way off, it just goes there.
      if (Math.hypot(entry.err.x, entry.err.z) > 4) entry.err = null;
      else {
        x += entry.err.x;
        z += entry.err.z;
      }
    }
    let y = past.y;
    const w = this.world;
    for (let up = 0; up < 2 && w && B.SOLID[w.get(Math.floor(x), Math.floor(y + 0.05), Math.floor(z))] === 1; up++) y = Math.floor(y + 0.05) + 1;
    // Hopping back from a bop: up and down again (a big one hardly leaves the ground).
    const recoil = entry.recoil;
    if (recoil) {
      const k = (performance.now() - recoil.at) / 1000 / RECOIL_SECS;
      if (k >= 1) entry.recoil = null;
      else if (k > 0) y += KICK_HOP * (entry.kind === 'king' ? 0 : entry.kind === 'golem' ? 0.2 : entry.kind === 'big' ? 0.4 : 1) * 4 * k * (1 - k);
    }
    // Never inside you: right up against you at the most.
    const me = this.me?.body;
    if (me && !this.riding && !this.aboard) {
      const size = bodyOf(entry.kind);
      const dx = x - me.x;
      const dz = z - me.z;
      const d = Math.hypot(dx, dz);
      const min = size.radius + BODY.radius;
      if (d < min && d > 0.001 && y < me.y + BODY.height && y + size.height > me.y) {
        x = me.x + (dx / d) * min;
        z = me.z + (dz / d) * min;
      }
    }
    entry.drawn = { x, z };
    entry.yaw = entry.yaw === undefined ? last.yaw : lerpAngle(entry.yaw, last.yaw, 1 - Math.exp(-dt * 12));
    return { x, y, z, yaw: entry.yaw, state: last.state };
  }

  updateMonsters(dt) {
    const now = performance.now();
    const night = isNight(this.env.time);
    const cam = this.renderer.camera.position;
    for (const entry of this.monsters.values()) {
      // Stopped dead by a blow: held where it was, shivering.
      const stopped = now < (entry.stopUntil ?? 0) && entry.held;
      const s = stopped ? entry.held : this.monsterNow(entry, dt);
      if (!s) continue;
      if (!stopped) entry.held = s;
      const m = entry.model;
      const shiver = stopped ? 0.04 : 0;
      m.group.position.set(s.x + (Math.random() - 0.5) * shiver, s.y, s.z + (Math.random() - 0.5) * shiver);
      m.group.rotation.order = 'YXZ';
      m.group.rotation.y = s.yaw;
      // Leaning back from the blow, top first, and springing upright.
      const recoil = entry.recoil;
      const k = recoil ? (now - recoil.at) / 1000 / RECOIL_SECS : 1;
      const lean = k > 0 && k < 1 ? KICK_LEAN * (entry.kind === 'king' ? 0.3 : 1) * Math.sin(Math.PI * Math.sqrt(k)) * (1 - k) : 0;
      const c = Math.cos(s.yaw);
      const sn = Math.sin(s.yaw);
      m.group.rotation.x = lean ? lean * (recoil.x * sn + recoil.z * c) : 0;
      m.group.rotation.z = lean ? -lean * (recoil.x * c - recoil.z * sn) : 0;
      m.group.visible = Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z) < m.seen;
      if (!m.group.visible) {
        m.shadow.visible = false;
        continue;
      }
      const ground = this.renderer.groundUnder(s.x, s.y, s.z);
      m.update(stopped ? 0 : dt, s.state ?? 'idle', ground === null ? 9 : s.y - ground, night, Boolean(this.adventure?.shield));
      const flash = now < (entry.flashUntil ?? 0) && Math.floor((entry.flashUntil - now) / FLASH_BLINK) % 2 === 0;
      if (flash || entry.flashed) flashModel(m.group, flash);
      entry.flashed = flash;
      this.renderer.placeShadow(m.shadow, s.x, s.y, s.z, m.shadowScale ?? 1);
      const king = entry.kind === 'king';
      const big = isHeavy(entry.kind);
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
        // A mosquito whines and a spider skitters as they come at you; the
        // others grumble.
        if (entry.kind === 'mosquito') this.sound.play('mosquito');
        else if (entry.kind === 'spider') this.sound.play('spider');
        else this.sound.play('grumble', { big });
      }
    }
  }

  // ------------------------------------------------ an adventure island

  // The camps as the island tells of them as you arrive, each with its flag pole.
  setAdventure(a) {
    this.renderer.clearFlags();
    this.adventure = null;
    // Any quizzes were for the island as it was won: on one arrived at, even
    // a conquered one, none are yours to take.
    this.quizOffer = null;
    this.quiz = null;
    if (a && Array.isArray(a.camps) && a.camps.length) {
      const camps = new Map();
      for (const c of a.camps) {
        if (!Number.isInteger(c?.id) || ![c.x, c.y, c.z, c.r].every(Number.isFinite)) continue;
        const kind = c.kind === 'castle' ? 'castle' : 'camp';
        camps.set(c.id, { id: c.id, kind, x: c.x, y: c.y, z: c.z, r: c.r, freed: c.freed === true, progress: Number(c.progress) || 0, friends: 0, guarded: false, flag: this.renderer.addFlag(c.id, kind) });
      }
      // The public adventure island's stage, 1 on any other adventure island.
      this.adventure = { camps, won: a.won === true, stage: Number.isInteger(a.stage) ? Math.min(9999, Math.max(1, a.stage)) : 1, king: null, shield: true };
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
    if (entry) entry.flashUntil = performance.now() + FLASH_MS;
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
      // Everyone who freed the island may take its extra-credit quizzes
      // (shared/quiz.js): the offer comes up by itself once the fireworks
      // have had their moment (updateAdventure), and after that waits with
      // the 🎓 by the flag (ui.js) for as long as you stay.
      this.quizOffer = { at: performance.now() + WIN_OFFER_MS, told: false, taken: { junior: false, senior: false } };
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

  // The shared isle's stage conquered, the next one is up: { code, stage }
  // of its island (server/adventure.js), where the page takes you on to by
  // itself in a little while (ui.js). Says 'next-stage'.
  setNextStage(msg) {
    const code = typeof msg?.code === 'string' && isValidCode(msg.code) && msg.code !== this.code ? msg.code : '';
    this.nextStage = code ? { code, stage: cleanStage(msg.stage) } : null;
    this.emit('next-stage');
  }

  // ------------------------------------------------ extra-credit quizzes

  // One of the quizzes a conquered island offered (shared/quiz.js), its
  // questions picked and shuffled by chance: { level, questions, picks (the
  // answers you have given), right (how many of them were right), done }.
  // Says 'quiz', for the window taking it (ui.js). Returns true when the
  // answer was right, false when it was not, and undefined when it was no
  // answer to take (no quiz going, the quiz done, or a nonsense answer).
  quizAnswer(i) {
    const q = this.quiz;
    if (!q || q.done) return;
    const ask = q.questions[q.picks.length];
    if (!ask || !Number.isInteger(i) || i < 0 || i >= ask.choices.length) return;
    const right = i === ask.answer;
    q.picks.push(i);
    if (right) q.right++;
    if (q.picks.length < q.questions.length) {
      this.emit('quiz');
      return right;
    }
    // The last one answered: the quiz is done, and the extra credit is yours.
    q.done = true;
    q.coins = quizCoins(q.right, q.level);
    q.xp = XP_FOR.quizzes.xp + q.right * XP_FOR.quizright.xp + (q.right === q.questions.length ? XP_FOR.quizperfect.xp : 0);
    if (q.school) this.classEnded[q.level] = performance.now();
    else if (this.quizOffer) this.quizOffer.taken[q.level] = true;
    this.profile.count('quizzes');
    this.profile.count('quizright', q.right);
    if (q.right === q.questions.length) this.profile.count('quizperfect');
    if (q.coins) this.profile.earn(q.coins);
    const b = this.me?.body;
    if (b) this.emit('reward', { x: b.x, y: b.y, z: b.z, xp: q.xp });
    this.emit('quiz');
    return right;
  }

  // A quiz begun: one of the island's offer, not already taken. Says 'quiz',
  // which opens the window on it (ui.js).
  startQuiz(level) {
    if (!this.quizOffer || this.quizOffer.taken[level] || !QUIZ_LEVELS[level]) return;
    this.quiz = { level, ...makeQuiz(level, (Math.random() * 2 ** 31) | 0), picks: [], right: 0, done: false };
    this.emit('quiz');
  }

  // The quiz window closed: a quiz half done simply goes, to be begun afresh
  // if you like (nothing was earned from it yet).
  closeQuiz() {
    this.quiz = null;
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
      this.setHp(msg);
      this.sound.play('helpup');
      this.emit('toast', { icon: '🤝', text: helper ? `${helper.name} helped you up!` : 'Up you get!' });
    } else if (msg.by === this.pid) {
      this.profile.count('helped');
      this.sound.play('helpup');
      this.emit('toast', { icon: '🤝', text: `You helped ${p?.name ?? 'your friend'} up!` });
    }
  }

  // Someone drank an HP potion (shop.js): hearts over them wherever they
  // stand, and their HP — and their feet, if they sat dizzy — their own
  // again. What it filled up to is in the message ({ hp, max }).
  healed(msg) {
    const p = this.players.get(msg.pid);
    if (p) p.dizzy = false;
    const mine = msg.pid === this.pid;
    const at = mine ? this.me?.body : p?.avatar?.root.position;
    if (at && this.near(at.x, at.y, at.z, 30)) {
      this.renderer.effects.hearts(at.x, at.y + 1.6, at.z, 5);
      this.renderer.effects.sparkles(at.x, at.y + 1.2, at.z, 8, ['#ff8fc4', '#ffffff', '#b18cff']);
    }
    if (!mine) return;
    this.dizzy = false;
    this.emit('dizzy', false);
    this.setHp(msg);
    this.sound.play('sip');
    this.emit('toast', { icon: '🧪', text: 'Glug glug… HP filled right up!' });
  }

  // Dizzy too long, with no friend coming: back to the nearest safe place.
  cameHome(msg) {
    const p = this.players.get(msg.pid);
    if (p) p.dizzy = false;
    if (msg.pid !== this.pid || !this.me) return;
    this.setHp(msg);
    this.goHome(msg.at, 'Back you go to the nearest safe place, with all your HP.');
  }

  // Each frame: the flags where their camps are, fireworks going off, stars
  // going round the head of anyone dizzy, and the quizzes a conquered island
  // comes offering once the fireworks have had their moment.
  updateAdventure(dt) {
    const adv = this.adventure;
    const now = performance.now();
    const offer = this.quizOffer;
    if (offer && !offer.told && now >= offer.at) {
      offer.told = true;
      this.emit('quiz-offer');
    }
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
      if (this.near(a.x, a.y, a.z, 40)) this.renderer.effects.dizzy(a.x, a.y + p.avatar.sitTop + 0.12, a.z, t, 0.24);
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

  // ------------------------------------------------ gashapon machines

  // Q (or the Turn button) by a gashapon machine: its window opens.
  openGashapon() {
    const t = this.gashaTarget;
    if (!t) return;
    this.gashaAt = t;
    this.sound.play('ui');
    this.emit('gasha-open');
  }

  // The handle turned in its window (shared/gashapon.js): coins in, and a
  // capsule toy out of the machine with a sparkle. Returns what came out,
  // or null without the coins.
  turnGashapon() {
    const monster = Boolean(this.gashaAt?.monster);
    if (monster && !this.gashaHere()) {
      this.sound.play('no');
      return null;
    }
    const got = this.profile.turnGashapon(Math.random, { later: true, monster, stage: this.gashaStage() });
    if (!got) {
      this.sound.play('no');
      return null;
    }
    this.sound.play('gasha');
    const t = this.gashaAt;
    if (t) this.renderer.effects.sparkles(t.x + 0.5, t.y + 0.4, t.z + 0.5, got.toy.rare ? 14 : 8, got.toy.rare === 2 ? ['#ffd84d', '#fff3b0'] : [got.shell, '#ffffff']);
    return got;
  }

  // The capsule out of it opened (or its window closed before it was):
  // counted, with any sticker it earns.
  openCapsule(monster = false) {
    this.profile.openCapsule(monster);
  }

  // The adventure island's stage, for the Monster Gashapon's odds (1 on any
  // island but the public one's higher stages).
  gashaStage() {
    return this.adventure?.stage ?? 1;
  }

  // Whether the machine whose window is open is still there (the Monster
  // Gashapon goes after a while).
  gashaHere() {
    const t = this.gashaAt;
    return Boolean(t) && isGashapon(this.world.get(t.x, t.y, t.z));
  }

  // The Monster Gashapon turned up somewhere on the island, or went: told
  // to everyone, with a sparkle where it is if it is near.
  gashaNews(msg) {
    const { x, y, z } = msg;
    if (![x, y, z].every(Number.isInteger)) return;
    if (msg.gone) {
      if (this.gashaAt && this.gashaAt.x === x && this.gashaAt.y === y && this.gashaAt.z === z) this.emit('gasha-gone');
      this.emit('toast', { icon: '👾', text: 'The Monster Gashapon has gone! It will turn up again somewhere else.' });
      return;
    }
    const me = this.me?.body;
    const far = me ? Math.hypot(me.x - x - 0.5, me.z - z - 0.5) : 0;
    const way = me ? compass(x + 0.5 - me.x, z + 0.5 - me.z) : '';
    this.emit('toast', { icon: '👾', text: `A Monster Gashapon turned up${me ? ` ${Math.round(far)} steps ${way} of you` : ''}! Follow the light to it for a monster figure, before it goes.` });
    this.sound.play('fanfare');
    if (this.near(x + 0.5, y, z + 0.5, 60)) this.renderer.effects.sparkles(x + 0.5, y + 1.2, z + 0.5, 30, ['#b18cff', '#7fe08c', '#ffffff']);
  }

  closeGashapon() {
    this.gashaAt = null;
  }

  // ------------------------------------------------ pianos

  // Q (or the Play button) by a piano: its keyboard opens.
  // You sit down on the bench in front of its keys, facing it, hands on
  // the keys (render/avatar.js ANIM.piano), and stay there till it closes.
  openPiano() {
    const t = this.pianoTarget;
    const seat = t && pianoSeat(this.world, t.x, t.y, t.z);
    if (!seat) return;
    const b = this.me.body;
    if (b.flying) {
      b.flying = false;
      this.emit('fly', false);
    }
    this.pianoAt = t;
    this.atPiano(seat);
    this.sound.play('place', { kind: 'wood' });
    this.emit('piano-open');
    this.emit('ride');
  }

  // On the bench at the piano being played, and seen to be (sent at once).
  atPiano(seat) {
    const me = this.me;
    Object.assign(me.body, { x: seat.x, y: seat.y, z: seat.z, vx: 0, vy: 0, vz: 0, onGround: true, inWater: false, flying: false });
    me.yaw = seat.yaw;
    me.speed = 0;
    me.anim = ANIM.piano;
  }

  // At the piano, staying put; if the piano goes (someone picked it up),
  // its keyboard closes.
  stayAtPiano(dt) {
    const t = this.pianoAt;
    const seat = pianoSeat(this.world, t.x, t.y, t.z);
    if (!seat) {
      this.emit('piano-gone');
      this.closePiano();
      return;
    }
    this.atPiano(seat);
    const a = this.players.get(this.pid)?.avatar;
    if (a) {
      a.root.position.set(seat.x, seat.y, seat.z);
      a.root.rotation.y = seat.yaw;
      a.update(dt, ANIM.piano, 0);
      a.shadow.visible = false;
    }
  }

  // A key played (MIDI note n) on the open piano: heard at once, a note
  // floats up from the piano, and it goes to the island for friends to
  // hear (shared/piano.js).
  playPiano(n) {
    const t = this.pianoAt;
    if (!t) return;
    this.sound.piano(n, { grand: t.grand });
    this.players.get(this.pid)?.avatar?.pianoNote(n);
    this.pianoFx(t, n);
    this.send({ t: 'piano', n, at: [t.x, t.y, t.z] });
    this.profile.count('notes');
  }

  // A song followed all the way through on the piano.
  playedTune() {
    this.profile.count('tunes');
    this.sound.play('fanfare');
    const t = this.pianoAt;
    if (t) this.renderer.effects.sparkles(t.x + 0.5, t.y + 1.2, t.z + 0.5, 16);
  }

  // Up off the bench, standing where it was.
  closePiano() {
    const t = this.pianoAt;
    if (!t) return;
    this.pianoAt = null;
    const b = this.me.body;
    Object.assign(b, { y: b.y - BENCH_H, vx: 0, vy: 0, vz: 0, onGround: false });
    unstick(this.world, b);
    this.me.anim = ANIM.idle;
    this.emit('ride');
  }

  // ------------------------------------------------ TVs

  // Q (or the Watch button) by a TV: its picture opens (shared/tv.js).
  openTv() {
    const t = this.tvTarget;
    if (!t) return;
    this.tvAt = t;
    this.sound.play('ui');
    this.emit('tv-open');
  }

  // Flipped to channel i on the TV being watched: counted for XP and the
  // Channel Surfer sticker.
  watchChannel(i) {
    if (!this.tvAt || i === this.tvChannel) return;
    this.tvChannel = i;
    this.sound.play('ui');
    this.profile.count('channels');
  }

  closeTv() {
    this.tvAt = null;
  }

  // ------------------------------------------------ school

  // Q (or the Class button) by a chalkboard: the classes to pick from open
  // (shared/school.js).
  openClass() {
    if (!this.classTarget) return;
    this.sound.play('ui');
    this.emit('class-open');
  }

  // How long until a class of a level may begin (0: now).
  classBreak(level) {
    return breakLeft(this.classEnded[level], performance.now());
  }

  // A class begun at the chalkboard: a quiz of CLASS_SIZE questions, out of
  // the quizzes' banks, unless that level's break is still on. Says 'quiz',
  // which opens the window on it (ui.js).
  startClass(level) {
    if (!QUIZ_LEVELS[level] || this.classBreak(level) > 0) return;
    this.quiz = { level, school: true, ...makeQuiz(level, (Math.random() * 2 ** 31) | 0, CLASS_SIZE), picks: [], right: 0, done: false };
    this.emit('quiz');
  }

  // ------------------------------------------------ cooking classes

  // Q (or the Cook button) by a stove: the recipes to pick from open
  // (shared/cooking.js).
  openCooking() {
    if (!this.stoveTarget) return;
    this.sound.play('ui');
    this.emit('cook-open');
  }

  // How long until a recipe may be cooked again (0: now).
  cookBreak(key) {
    return cookBreakLeft(this.cookEnded[key] ?? 0, performance.now());
  }

  // A cooking class begun: the recipe's steps to put in order, unless its
  // break is still on. Says 'cooking', which opens the window on it (ui.js).
  startCooking(key) {
    if (!recipeByKey(key) || this.cookBreak(key) > 0) return;
    const lesson = makeLesson(key, (Math.random() * 2 ** 31) | 0);
    this.cooking = { ...lesson, step: 0, misses: lesson.asks.map(() => 0), right: 0, done: false };
    this.emit('cooking');
  }

  // A step picked as the one that comes next: true when it was (on to the
  // step after it, and with the last one the dish made, its coins and XP
  // yours), false when not (try again), undefined for no step to take.
  cookPick(i) {
    const c = this.cooking;
    if (!c || c.done) return;
    const ask = c.asks[c.step];
    if (!ask || !Number.isInteger(i) || i < 0 || i >= ask.choices.length) return;
    if (i !== ask.answer) {
      c.misses[c.step]++;
      this.emit('cooking');
      return false;
    }
    if (!c.misses[c.step]) c.right++;
    c.step++;
    if (c.step === c.asks.length) {
      c.done = true;
      c.coins = cookCoins(c.right);
      c.xp = XP_FOR.dishes.xp + c.right * XP_FOR.cookright.xp;
      this.cookEnded[c.recipe] = performance.now();
      this.profile.count('dishes');
      this.profile.count('cookright', c.right);
      if (c.coins) this.profile.earn(c.coins);
      const b = this.me?.body;
      if (b) this.emit('reward', { x: b.x, y: b.y, z: b.z, xp: c.xp });
    }
    this.emit('cooking');
    return true;
  }

  // The cooking window closed: a class half done simply goes.
  closeCooking() {
    this.cooking = null;
  }

  // ------------------------------------------------ studying

  // Whether you are sitting at a study desk.
  get atStudyDesk() {
    const c = this.seat;
    return !!c && isStudyDesk(this.world.get(c.x, c.y, c.z));
  }

  // Your notebook (shared/study.js), what you know of each workbook, kept on
  // this device for whoever is playing (storage.js).
  get notebook() {
    return cleanNotebook(load('notebook', {}));
  }

  // Sitting at a study desk (or the Study button there): your workbooks open.
  openStudy() {
    if (!this.atStudyDesk) return;
    this.sound.play('ui');
    this.emit('study-open');
  }

  // A study of a workbook begun. Says 'study', which opens the window on it
  // (ui.js).
  startStudy(book) {
    if (!workbookByKey(book) || !this.atStudyDesk) return;
    this.study = { ...makeStudy(book, this.notebook, (Math.random() * 2 ** 31) | 0), learnt: 0, xp: 0 };
    this.emit('study');
  }

  // A new fact read on its card: on to being asked it.
  studySeen() {
    const s = this.study;
    if (!s || s.done || !s.asks[s.at]?.learn || s.shown) return;
    s.shown = true;
    this.emit('study');
  }

  // An answer typed: { right, fact }, or undefined for nothing to answer.
  // With the last one the study is filed in your notebook, and what you
  // learnt counts for XP and stickers.
  studyAnswer(text) {
    const s = this.study;
    if (!s || s.done) return;
    const ask = s.asks[s.at];
    if (ask?.learn && !s.shown) return;
    const got = answerStudy(s, text);
    if (!got) return;
    if (s.done) {
      const notebook = this.notebook;
      s.learnt = fileStudy(notebook, s);
      save('notebook', notebook);
      s.byHeart = allByHeart(notebook);
      s.xp = XP_FOR.studies.xp + s.right * XP_FOR.studyright.xp;
      this.profile.count('studies');
      this.profile.count('studyright', s.right);
      this.profile.count('byheart', s.byHeart, { max: true });
      const b = this.me?.body;
      if (b) this.emit('reward', { x: b.x, y: b.y, z: b.z, xp: s.xp });
    }
    this.emit('study');
    return got;
  }

  // The study window closed: a study half done simply goes, unfiled.
  closeStudy() {
    this.study = null;
  }

  // ------------------------------------------------ computers' screens

  // What the island's computers show, as the island tells of it (the CTB
  // island's workers' real work), drawn on their screens for everyone.
  setScreens(list) {
    const before = this.screens;
    this.screens = cleanScreens(list);
    for (const [k, sc] of this.screens) {
      const id = this.world?.get(sc.x, sc.y, sc.z);
      if (isComputer(id)) this.renderer.screens.show(k, sc, id, furnitureDrop(id, this.world.get(sc.x, sc.y - 1, sc.z)));
      else this.screens.delete(k);
    }
    for (const k of before.keys()) if (!this.screens.has(k)) this.renderer.screens.remove(k);
    if (this.screenAt) this.screenAt = this.screens.get(this.screenAt.key) ? this.screenAt : null;
    this.emit('screens');
  }

  // Q (or the Look button) by a computer with a screen: it opens big.
  openScreen() {
    const t = this.screenTarget;
    if (!t) return;
    this.screenAt = t;
    this.sound.play('ui');
    this.emit('screen-open');
  }

  closeScreen() {
    this.screenAt = null;
  }

  // Whether everyone's spot in the seat in cell (x, y, z) is taken by
  // someone else sitting (or lying) in it: it is theirs until they get up.
  seatTaken(x, y, z) {
    return this.seatSpot(x, y, z) < 0;
  }

  // The spot free for you in the seat in cell (x, y, z) (shared/seats.js
  // freeSpot: a hot tub has two), or -1.
  seatSpot(x, y, z) {
    const others = [...this.players.values()].filter((p) => !p.me && p.inSeat && p.avatar).map((p) => p.avatar.root.position);
    return freeSpot(this.world, x, y, z, others);
  }

  // ------------------------------------------------ Go boards

  // The games of Go going at the island's boards, as the island tells of
  // them (shared/go.js packs them), drawn on their boards for everyone.
  setGo(list) {
    const before = this.goGames;
    this.goGames = new Map();
    for (const g of Array.isArray(list) ? list : []) {
      if (!g || typeof g.k !== 'string' || !isGoBoard(this.world?.get(g.x, g.y, g.z))) continue;
      this.goGames.set(g.k, g);
      this.renderer.goBoards.show(g.k, g);
    }
    for (const k of before.keys()) if (!this.goGames.has(k)) this.renderer.goBoards.remove(k);
    this.emit('go');
  }

  // Q (or the Play button) by a Go board: you sit down to play at it (a new
  // game if none is going there), and its window opens.
  openGo() {
    const t = this.goTarget;
    if (!t) return;
    this.goAt = t;
    this.goSend('sit', { kind: this.goKind });
    this.sound.play('open');
    this.emit('go-open');
  }

  // Something done at the board you play at: a stone at place i, a pass, a
  // fresh board of size n, calling the AI friend over, or giving up.
  goSend(op, extra = {}) {
    const t = this.goAt;
    if (t) this.send({ t: 'go', op, x: t.x, y: t.y, z: t.z, ...extra });
  }

  // The window closed: you get up from the board.
  closeGo() {
    const t = this.goAt;
    this.goAt = null;
    if (t) this.send({ t: 'go', op: 'leave', x: t.x, y: t.y, z: t.z });
  }

  // The game at the board you play at, or null.
  get goGame() {
    return this.goAt ? (this.goGames.get(this.goAt.key) ?? null) : null;
  }

  // What just happened at a board: a stone's click, a capture's pop, and at
  // the end of a game you played, counted for XP and the Go and Gomoku
  // stickers.
  goFx(msg) {
    const mine = this.goAt?.key === msg.k;
    if (msg.f === 'move') {
      const g = this.goGames.get(msg.k);
      if (mine || (g && Math.hypot(g.x + 0.5 - this.me.body.x, g.z + 0.5 - this.me.body.z) < 8)) {
        this.sound.play('place', { kind: 'stone' });
        if (msg.took) this.sound.play('pop');
      }
    } else if (msg.f === 'no' && msg.by === this.pid) {
      this.sound.play('no');
    } else if (msg.f === 'end' && Array.isArray(msg.p)) {
      const seat = msg.p.indexOf(this.pid);
      if (seat >= 0) {
        const gomoku = msg.kind === 'gomoku';
        this.profile.count(gomoku ? 'gomokugames' : 'gogames');
        const won = msg.win === (seat === 0 ? 'b' : 'w');
        if (won) this.profile.count(gomoku ? 'gomokuwins' : 'gowins');
        this.sound.play(won ? 'fanfare' : 'ding');
      }
    }
    this.emit('gofx', msg);
  }

  // ------------------------------------------------ drawing boards

  // The pictures on the island's boards, as the island tells of them on
  // arrival.
  setDrawings(rows) {
    this.drawings.clear();
    this.renderer.drawings.clear();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(row)) continue;
      const [x, y, z, text] = row;
      const px = decodePicture(text);
      if (px && isBoard(this.world.get(x, y, z))) this.showDrawing(x, y, z, px);
    }
    this.emit('drawing');
  }

  showDrawing(x, y, z, px) {
    const key = keyOf(x, y, z);
    if (isBlank(px)) {
      this.drawings.delete(key);
      this.renderer.drawings.remove(key);
      return;
    }
    this.drawings.set(key, px);
    this.renderer.drawings.show(key, this.world.get(x, y, z), x, y, z, px);
  }

  // The picture on a board, blank when nothing is drawn on it.
  drawingAt(t) {
    return this.drawings.get(keyOf(t.x, t.y, t.z)) ?? blankPicture();
  }

  // Q (or the Draw button) by a drawing board: its picture opens.
  openDrawing() {
    const t = this.drawTarget;
    if (!t) return;
    if (this.settings.owned) {
      this.emit('notice', { text: `${this.world.name} stays just as it is — no drawing here!`, level: 'info' });
      return;
    }
    this.drawAt = t;
    this.emit('draw-open');
  }

  // A stroke drawn on the open board, there at once. A line is drawn a bit
  // at a time as the finger moves and sent a few bits together (sendStroke):
  // drawn either way, it comes out the same.
  drawStroke(raw) {
    const t = this.drawAt;
    const s = cleanStroke(raw);
    if (!t || !s || !isBoard(this.world.get(t.x, t.y, t.z))) return;
    const px = this.drawingAt(t);
    applyStroke(px, s);
    this.showDrawing(t.x, t.y, t.z, px);
  }

  // A stroke drawn on the open board, to the island for everyone else.
  sendStroke(raw) {
    const t = this.drawAt;
    const s = cleanStroke(raw);
    if (t && s) this.send({ t: 'draw', at: [t.x, t.y, t.z], s });
  }

  // A friend's stroke on a board.
  drawHeard(msg) {
    const s = cleanStroke(msg.s);
    if (!s || !Array.isArray(msg.at)) return;
    const [x, y, z] = msg.at;
    if (!isBoard(this.world?.get(x, y, z))) return;
    const t = { x, y, z };
    const px = this.drawingAt(t);
    applyStroke(px, s);
    this.showDrawing(x, y, z, px);
    this.emit('drawing', keyOf(x, y, z));
  }

  // A line finished or a patch filled on the board: counted, for XP and the
  // Little Artist sticker.
  drew() {
    this.profile.count('strokes');
  }

  closeDrawing() {
    this.drawAt = null;
  }

  // Blocks changed: a board picked up takes its picture with it, and one
  // turned takes it round.
  drawingsChanged(cells) {
    if (!this.drawings.size || !cells) return;
    for (let i = 0; i < cells.length; i += 4) {
      const key = keyOf(cells[i], cells[i + 1], cells[i + 2]);
      const px = this.drawings.get(key);
      if (!px) continue;
      if (isBoard(cells[i + 3])) {
        this.renderer.drawings.show(key, cells[i + 3], cells[i], cells[i + 1], cells[i + 2], px);
      } else {
        this.drawings.delete(key);
        this.renderer.drawings.remove(key);
        this.emit('drawing', key);
      }
    }
  }

  // ------------------------------------------------ broadcast stations

  // Q (or the Go live button) by a broadcast station: its window opens,
  // your camera in it, to go live on every TV in the game (shared/station.js).
  openStation() {
    const t = this.stationTarget;
    if (!t) return;
    this.stationAt = t;
    this.sound.play('ui');
    this.emit('station-open');
  }

  closeStation() {
    this.stationAt = null;
  }

  // A friend playing a piano: heard when it is near, softer further away.
  pianoHeard(msg) {
    const [x, y, z] = msg.at;
    if (!this.near(x + 0.5, y, z + 0.5, 32)) return;
    const b = this.me.body;
    const d = Math.hypot(b.x - x - 0.5, b.y - y, b.z - z - 0.5);
    this.sound.piano(msg.n, { gain: Math.min(1, 4 / Math.max(4, d)), grand: B.BLOCKS[this.world.get(x, y, z)]?.model === 'grand-piano' });
    this.players.get(msg.pid)?.avatar?.pianoNote(msg.n);
    this.pianoFx({ x, y, z }, msg.n);
  }

  // Now and then a little note floats up out of a piano being played.
  pianoFx(t, n) {
    const now = performance.now();
    if (now - (this.pianoFxAt ?? 0) < 250) return;
    this.pianoFxAt = now;
    this.renderer.effects.notes(t.x + 0.5, t.y + 1 + (n - 60) / 48, t.z + 0.5);
  }

  // ------------------------------------------------ the video arcade

  // The games going at the island's arcade machines, as the island tells of
  // them (shared/arcade.js packs them).
  setArcade(list) {
    this.arcade = new Map();
    for (const p of Array.isArray(list) ? list : []) {
      if (!p || typeof p.k !== 'string') continue;
      this.arcade.set(p.k, p);
    }
    this.emit('arcade');
  }

  // Q (or the Play button) by a machine: its game opens, a round of it
  // starting if none is going.
  openArcade() {
    const t = this.arcadeTarget;
    if (!t) return;
    this.arcadeAt = t;
    this.send({ t: 'arcade', op: 'play', x: t.x, y: t.y, z: t.z });
    this.sound.play('ui');
    this.emit('arcade-open');
  }

  // ▶ Play in the game's window (a new round, or joining one).
  arcadePlay() {
    const t = this.arcadeAt;
    if (!t) return;
    this.send({ t: 'arcade', op: 'play', x: t.x, y: t.y, z: t.z });
  }

  arcadeBop(i) {
    const t = this.arcadeAt;
    if (t) this.send({ t: 'arcade', op: 'bop', x: t.x, y: t.y, z: t.z, i });
  }

  arcadeFlip(i) {
    const t = this.arcadeAt;
    if (t) this.send({ t: 'arcade', op: 'flip', x: t.x, y: t.y, z: t.z, i });
  }

  // The game's window closed: you leave the machine (its game goes on).
  closeArcade() {
    const t = this.arcadeAt;
    this.arcadeAt = null;
    if (t) this.send({ t: 'arcade', op: 'leave', x: t.x, y: t.y, z: t.z });
  }

  // What just happened at a machine: a blob popped, a card turned over, a
  // pair found, a round or a board done. The window open at it shows it,
  // and whoever it was earns their count of it (and a few coins, for a
  // round or a board done together).
  arcadeFx(msg) {
    const mine = this.arcadeAt?.key === msg.k;
    const playing = (rows) => Array.isArray(rows) && rows.some(([pid]) => pid === this.pid);
    switch (msg.f) {
      case 'pop':
        if (msg.by === this.pid) this.profile.count('blobpops');
        if (mine) this.sound.play('pop');
        else {
          const at = this.arcade.get(msg.k);
          if (at && this.near(at.x + 0.5, at.y + 1, at.z + 0.5, 25)) this.renderer.effects.sparkles(at.x + 0.5, at.y + 1, at.z + 0.5, 6, ['#ffd84d', '#ff8fc4']);
        }
        break;
      case 'flip':
        if (mine) this.sound.play('place', { kind: 'cloth' });
        break;
      case 'pair':
        if (msg.by === this.pid) this.profile.count('pairsfound');
        if (mine) this.sound.play('collect');
        break;
      case 'round': {
        if (mine) this.sound.play('fanfare');
        if (!playing(msg.ps)) break;
        this.profile.count('arcade');
        const minePops = msg.ps.find(([pid]) => pid === this.pid)?.[1] ?? 0;
        const coins = msg.s >= 35 ? 3 : msg.s >= 25 ? 2 : msg.s >= 15 ? 1 : 0;
        if (coins && minePops) this.profile.earn(coins);
        const best = msg.ps.reduce((a, b) => (b[1] > a[1] ? b : a), [0, 0]);
        const who = best[0] === this.pid ? 'You' : this.players.get(best[0])?.name ?? 'A friend';
        this.emit('toast', {
          icon: '👾',
          text: `Bop-a-Blob over — a score of ${msg.s} together! ${who} bopped the most.${coins && minePops ? ` 🪙 ${coins} ${coins === 1 ? 'coin' : 'coins'} for playing!` : ''}`,
        });
        break;
      }
      case 'board': {
        if (mine) this.sound.play('victory');
        if (!playing(msg.ps)) break;
        this.profile.count('arcade');
        const found = msg.ps.find(([pid]) => pid === this.pid)?.[1] ?? 0;
        if (found) this.profile.earn(2);
        this.emit('toast', { icon: '🃏', text: `All the pairs found! You found ${found} of them.${found ? ' 🪙 2 coins for playing!' : ''}` });
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------ hide and seek

  // The round as the island tells of it, each time it changes.
  setHideSeek(raw) {
    const was = this.hideseek;
    this.hideseek = cleanRound(raw);
    this.hsAt = performance.now();
    // Eyes shut to count: off whatever you were riding or driving, and
    // out of any window, to stand still where you are.
    if (this.counting && !(was?.phase === 'hide' && was.seeker === this.pid)) {
      if (this.riding) this.getOff();
      else if (this.aboard) this.getOut();
    }
    this.emit('hideseek');
  }

  // You, counting with your eyes shut while everyone else hides.
  get counting() {
    const r = this.hideseek;
    return r?.phase === 'hide' && r.seeker === this.pid;
  }

  // The seconds left of the count, or of the seeking.
  hideSeekLeft() {
    const r = this.hideseek;
    return r ? Math.max(0, Math.ceil((r.left - (performance.now() - this.hsAt)) / 1000)) : 0;
  }

  // Whether a friend is hiding from you, the seeker: their name tag, their
  // pet and their dot on the maps are not shown, so they hide for real.
  hiddenFromMe(pid) {
    const r = this.hideseek;
    return Boolean(r) && r.phase !== 'done' && r.seeker === this.pid && pid !== this.pid && r.hiders.includes(pid) && !r.found.includes(pid);
  }

  // 🙈 I'll be it! — a round with everyone else on the island hiding.
  hideSeekStart() {
    this.send({ t: 'hideseek', op: 'start' });
    this.sound.play('ui');
  }

  // 🏳️ Stop the round (the seeker, or the island's owner).
  hideSeekStop() {
    this.send({ t: 'hideseek', op: 'stop' });
  }

  // What just happened in the round: it started, the count was over,
  // someone was found, or it was over. Whoever played earns their counts
  // of it at the end, and a few coins: the seeker for each friend found,
  // and a hider never found for staying hidden.
  hideSeekFx(msg) {
    const name = (pid) => (pid === this.pid ? 'You' : (this.players.get(pid)?.name ?? 'A friend'));
    const toast = (icon, text) => this.emit('toast', { icon, text });
    switch (msg.f) {
      case 'start':
        this.sound.play('fanfare');
        if (msg.seeker === this.pid) toast('🙈', 'You are it! Eyes shut — count to 20 while everyone hides…');
        else toast('🙈', `${name(msg.seeker)} is it! Run and hide, quick!`);
        break;
      case 'seek':
        this.sound.play('ding');
        toast('🔍', this.hideseek?.seeker === this.pid ? 'Ready or not, here you come! Find everyone!' : `Ready or not, ${name(this.hideseek?.seeker)} is coming!`);
        break;
      case 'found': {
        this.sound.play(msg.pid === this.pid || msg.by === this.pid ? 'boing' : 'pop');
        if (msg.by === this.pid) this.profile.count('seekfound');
        const p = this.players.get(msg.pid);
        const at = p?.me ? this.me.body : p?.avatar?.root.position;
        if (at) this.renderer.effects.bang(at.x, at.y + 2.2, at.z);
        if (msg.pid === this.pid) toast('👀', `${name(msg.by)} found you!`);
        else toast('👀', `${name(msg.by)} found ${name(msg.pid)}!`);
        break;
      }
      case 'end': {
        const mine = msg.seeker === this.pid || msg.found.includes(this.pid) || msg.hidden.includes(this.pid);
        if (mine && msg.why !== 'stopped') this.profile.count('hideseek');
        let coins = 0;
        if (msg.seeker === this.pid) coins = msg.found.length;
        else if (msg.hidden.includes(this.pid) && !msg.why) {
          this.profile.count('hidden');
          coins = 3;
        }
        if (coins && !msg.why) this.profile.earn(coins);
        const pay = coins && !msg.why ? ` 🪙 ${coins} ${coins === 1 ? 'coin' : 'coins'}!` : '';
        if (mine) this.sound.play(msg.hidden.includes(this.pid) || (msg.seeker === this.pid && !msg.hidden.length) ? 'victory' : 'fanfare');
        let text;
        if (msg.why === 'stopped') text = 'Hide and seek was stopped. Play again any time!';
        else if (msg.why === 'seeker') text = 'The seeker went home, so hide and seek is over.';
        else if (msg.why === 'hiders') text = 'Nobody is left to find, so hide and seek is over.';
        else if (!msg.hidden.length) text = `${name(msg.seeker)} found everyone!${pay}`;
        else text = `Time's up! Never found: ${msg.hidden.map(name).join(', ')}.${pay}`;
        toast('🙈', text);
        break;
      }
      default:
        break;
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

  // A ridden dragon's own hearts (dragon.js RIDE_HEARTS), as they change: a
  // bump knocks some off (the rider's HP never), they come back by themselves,
  // and with none left the dragon rests — its rider, set down beside it, hears
  // why. rest: how long until it can be ridden again.
  rideHeartsNews(msg) {
    const c = this.critters.get(msg.id);
    if (!c) return;
    const was = c.rideHearts ?? msg.max ?? RIDE_HEARTS;
    c.rideHearts = msg.hearts;
    c.rideRestUntil = msg.rest ? performance.now() + msg.rest : 0;
    const p = c.model.group.position;
    if (msg.hearts < was) {
      c.flashUntil = performance.now() + FLASH_MS;
      if (this.near(p.x, p.y, p.z, 30)) {
        this.renderer.effects.bang(p.x, p.y + CRITTER_INFO.dragon.ride.height * 0.7, p.z);
        this.sound.play('bump');
      }
    }
    if (msg.rest && this.riding?.id === c.id) {
      this.getOff();
      this.emit('toast', { icon: '🐲', text: `${c.name || 'The dragon'} is worn out! Let it catch its breath a moment, then climb on again.` });
      this.sound.play('no');
    }
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
      if (!r || !this.canBoard(c) || !c.model.group.visible || wildDragon(c)) continue;
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
    if (this.dizzy || this.counting) return;
    if (this.aboard) {
      this.getOut();
      return;
    }
    if (this.riding) {
      this.getOff();
      return;
    }
    if (this.seat) {
      // At a study desk Q opens your workbooks; walking gets you up.
      if (this.atStudyDesk) this.openStudy();
      else this.standUp();
      return;
    }
    const id = this.rideTarget;
    if (!id && this.seatTarget) {
      this.sitDown(this.seatTarget);
      return;
    }
    if (!id && this.arcadeTarget) {
      this.openArcade();
      return;
    }
    if (!id && this.gashaTarget) {
      this.openGashapon();
      return;
    }
    if (!id && this.pianoTarget) {
      this.openPiano();
      return;
    }
    if (!id && this.tvTarget) {
      this.openTv();
      return;
    }
    if (!id && this.stationTarget) {
      this.openStation();
      return;
    }
    if (!id && this.classTarget) {
      this.openClass();
      return;
    }
    if (!id && this.stoveTarget) {
      this.openCooking();
      return;
    }
    if (!id && this.drawTarget) {
      this.openDrawing();
      return;
    }
    if (!id && this.goTarget) {
      this.openGo();
      return;
    }
    if (!id && this.screenTarget) {
      this.openScreen();
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
    const spot = this.seatSpot(cell.x, cell.y, cell.z);
    const pose = spot < 0 ? null : seatPose(this.world, cell.x, cell.y, cell.z, spot);
    if (!pose) return;
    const b = this.me.body;
    if (b.flying) {
      b.flying = false;
      this.emit('fly', false);
    }
    this.seat = { x: cell.x, y: cell.y, z: cell.z, spot };
    this.teaCounted = false;
    this.tubCounted = false;
    Object.assign(b, { x: pose.x, y: pose.y, z: pose.z, vx: 0, vy: 0, vz: 0 });
    this.sound.play('place', { kind: 'cloth' });
    this.profile.count('sat');
    // At a study desk your workbooks open as you sit down.
    if (isStudyDesk(this.world.get(cell.x, cell.y, cell.z))) this.emit('study-open');
    if (!this.toldSeat) {
      this.toldSeat = true;
      const id = this.world.get(cell.x, cell.y, cell.z);
      const name = B.block(id).name.toLowerCase();
      // At a study desk Q (and the button) open your workbooks instead.
      const how = isStudyDesk(id) ? 'Walk' : this.touch ? 'Walk, or tap 👋 Get up,' : 'Walk, or press Q,';
      this.emit('toast', { icon: pose.pose === 'soak' ? '♨️' : pose.pose === 'sit' ? '🛋️' : '🛏️', text: pose.pose === 'soak' ? `Ahh, into the ${name}! ${how} to get out.` : pose.pose !== 'sit' ? `Snuggled up in bed! ${how} to get up.` : `You sit ${isStudyDesk(id) ? 'at' : 'on'} the ${name}. ${how} to get up.` });
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

  // The island's hot tubs, each frame: steam rises off the water over
  // everyone soaking in one, you and your friends, and while two or more soak
  // in the same tub together, hearts show over it, like a tea party.
  updateHotTubs() {
    const now = performance.now();
    // Everyone soaking: you, and friends sitting in a hot tub's cell.
    const soaking = [];
    if (this.seat) {
      const pose = seatPose(this.world, this.seat.x, this.seat.y, this.seat.z, this.seat.spot);
      if (pose?.pose === 'soak') soaking.push({ who: this.players.get(this.pid), me: true, x: pose.x, y: pose.y, z: pose.z });
    }
    for (const p of this.players.values()) {
      if (p.me || !p.inSeat || !p.avatar) continue;
      const a = p.avatar.root.position;
      if (B.block(this.world.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))).model !== 'hot-tub') continue;
      soaking.push({ who: p, me: false, x: a.x, y: a.y, z: a.z });
    }
    for (const s of soaking) {
      // Now and then, a wisp of steam off the water round their shoulders.
      if (!s.who || now < (s.who.steamAt ?? 0) || !this.near(s.x, s.y, s.z, 40)) continue;
      s.who.steamAt = now + 400 + Math.random() * 300;
      this.renderer.effects.steam(s.x, s.y + 0.5, s.z);
    }
    // Hearts over any tub two are soaking in together, now and then while
    // they do, as a tea party's do. Only the tubs near enough to see, so a
    // far-off one is left alone. The first time you share one with a friend
    // you are told so, once each time you get in; the soak itself counts for
    // the Comfy Spot sticker, as any seat does (sitDown).
    for (const tub of tubsShared(this.world, soaking)) {
      if (!this.near(tub.x + 0.5, tub.y, tub.z + 0.5, 40) || now < (this.tubHeartsAt ?? 0)) continue;
      this.tubHeartsAt = now + 900 + Math.random() * 400;
      this.renderer.effects.hearts(tub.x + 0.5, tub.y + 1.3, tub.z + 0.5, 3);
      const inOne = tub.in.map((i) => soaking[i]);
      const friend = inOne.find((s) => !s.me)?.who?.name ?? null;
      if (!inOne.some((s) => s.me) || !friend || this.tubCounted) continue;
      this.tubCounted = true;
      this.emit('toast', { icon: '♨️', text: `A cozy soak with ${friend}!` });
    }
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
    const pose = seatPose(this.world, c.x, c.y, c.z, c.spot);
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
    me.anim = { sit: ANIM.sit, soak: ANIM.sit, lie: ANIM.lie, curl: ANIM.curl }[pose.pose];
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
    // Its own hearts, for the bar by yours (ui.js renderHp): full, until the
    // island says a bump has taken some.
    entry.rideHearts = entry.rideHearts ?? RIDE_HEARTS;
    entry.rideMax = entry.rideMax ?? RIDE_HEARTS;
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
      // A dragon bops from the saddle: fire at whatever is ahead (attack above).
      const fire = entry.type === 'dragon' ? ` Bop (${this.touch ? '👊' : 'X'}) to breathe fire!` : '';
      this.emit('toast', { icon: info.icon, text: `You are riding ${name}! ${trick}${fire} ${how}` });
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
    // Out of a helicopter or a balloon up in the air, you fly — but never
    // on the shared isle, where nobody flies on their own: there you come down.
    const flying = !this.shared && Boolean(at.flying);
    Object.assign(b, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, onGround: false, flying });
    if (flying) this.emit('fly', true);
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
    // A fun park's ride goes round by itself.
    if (info.fixed) this.emit('toast', { icon: info.icon, text: `All aboard the ${info.name}! Round and round you go. ${how}` });
    else this.emit('toast', { icon: info.icon, text: `All aboard ${name}! ${who} Jump to honk. ${how}` });
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
    // Out of a helicopter or a balloon up in the air, you fly — but never
    // on the shared isle, where nobody flies on their own: there you come down.
    flying = !this.shared && flying;
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
    // Rolling along rails, the camera swings round behind you the way you
    // are going, as on a roller coaster: pushing ahead keeps you going ahead.
    if (ride.rail?.next && ride.rail.v > 0.5) {
      const heading = Math.atan2(ride.rail.next.x - ride.rail.x, ride.rail.next.z - ride.rail.z) + Math.PI;
      const v = this.renderer.view;
      v.yaw += (heading - v.yaw - Math.PI * 2 * Math.floor((heading - v.yaw + Math.PI) / (Math.PI * 2))) * Math.min(1, dt * 2.5);
    }
    // On land and off the rails, it steps out of whatever it walked into too.
    if (!ride.r.sea && !ride.rail) keepApart(this.world, r, this.standing(`c${ride.id}`), `c${ride.id}`);
    const seat = riderAt(ride.type, { x: r.x, y: r.y, z: r.z, yaw: ride.yaw });
    const b = me.body;
    // Flying with it (a helicopter or a balloon) says so on your own body
    // too: the island knows, and King Grumble's stomp misses.
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
      // The 🚁 sticker is for flying the aircraft — and the dragon.
      if (CRITTER_INFO[ride.type].vehicle || ride.r.air) this.profile.count('flights');
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
    // Only the owner builds on this island right now (or it is the shared
    // isle, nobody's to build on): the drill stays still.
    if (!this.mayBuild) {
      if (!this.riding.toldNoDig) this.emit('notice', { text: this.staysAsMade ? `${this.world.name} stays just as it is, so the digger cannot dig.` : 'The island owner is the only builder right now, so the digger cannot dig.', level: 'info' });
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
      const now = performance.now();
      const state = c.spoutUntil > now ? 'spout' : now < (c.fireUntil ?? 0) && c.type === 'dragon' ? 'fire' : rideState(this.riding);
      return { x: r.x, y: r.y, z: r.z, yaw: this.riding.yaw, state };
    }
    const recent = c.lastRider && performance.now() - c.leftAt < 600 ? c.lastRider : 0;
    const p = this.players.get(c.rider || recent);
    if (!p || p.me || !p.avatar || !p.seated) return null;
    const a = p.avatar.root;
    const at = mountUnder(c.type, { x: a.position.x, y: a.position.y, z: a.position.z, yaw: a.rotation.y });
    // A dragon breathing fire rears as it does it (dragonFrame lights the flames).
    const state = performance.now() < (c.fireUntil ?? 0) && c.type === 'dragon' ? 'fire' : this.ridden(c, at);
    return { ...at, state };
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

  // Whether you may change this island: yours, or its owner lets friends
  // build. The shared isle is nobody's to build on: it stays as it was made,
  // and so does an island owned by one login (the CTB island), even for its owner.
  get mayBuild() {
    return !this.staysAsMade && (this.settings.build !== 'host' || this.pid === this.host);
  }

  get staysAsMade() {
    return this.shared || this.settings.owned === true;
  }

  // Makes a change here at once and asks the island to make it for everyone.
  edit(kind, cells, { expect = null, undoable = true } = {}) {
    if (!cells.length) return false;
    // Only the owner builds here right now (or it is the shared isle,
    // nobody's to build on): nothing changes, so nothing is picked up,
    // collected or spent either (the island would only say no).
    if (!this.mayBuild) {
      this.emit('notice', { text: this.staysAsMade ? `${this.world.name} stays just as it is — no building here!` : 'The island owner is the only builder right now.', level: 'warn' });
      this.sound.play('no');
      return false;
    }
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
    this.drawingsChanged(cells);
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
    // The island's farming: crops moving on a stage, farmland soaking up
    // the rain or drying out, all over the island.
    if (kind === 'crop') {
      this.cropEffects(cells);
      return;
    }
    if (!mine && !this.near(first[0], first[1], first[2], 28)) return;
    const tint = this.renderer.atlas.studTint;
    const colorOf = (id) => `rgb(${tint[id * 3]},${tint[id * 3 + 1]},${tint[id * 3 + 2]})`;
    const every = Math.max(1, Math.floor(n / 24));
    for (let i = 0; i < n; i += every) {
      const [x, y, z, id] = [cells[i * 4], cells[i * 4 + 1], cells[i * 4 + 2], cells[i * 4 + 3]];
      if (kind === 'grow' || kind === 'nature') fx.sparkles(x + 0.5, y + 0.5, z + 0.5, 3);
      else if (kind === 'water') fx.sparkles(x + 0.5, y + 1.3, z + 0.5, 4, WATER_DROPS);
      else if (id === B.AIR || id === B.WATER) fx.pop(x, y, z, '#ffffff', n > 4 ? 3 : 10);
      else fx.place(x, y, z, colorOf(id));
    }
    if (kind === 'grow' && this.near(first[0], first[1], first[2], 24)) this.sound.play('grow');
    if (!mine && this.near(first[0], first[1], first[2], 14)) {
      const id = cells[3];
      if (kind === 'pick') this.sound.play('pop');
      else if (kind === 'build' || kind === 'stamp') this.sound.play('place', { kind: B.block(id).sound });
      else if (kind === 'water') this.sound.play('water');
    }
  }

  // Crops the island moved on a stage (and farmland it watered or dried,
  // which shows by itself): a twinkle of its colour over each one that is
  // ripe now, and near you a little tune — not more than every few seconds,
  // however many ripen.
  cropEffects(cells) {
    let near = false;
    for (let i = 0; i < cells.length; i += 4) {
      const [x, y, z, id] = [cells[i], cells[i + 1], cells[i + 2], cells[i + 3]];
      if (!B.isRipe(id) || !this.near(x, y, z, 28)) continue;
      this.renderer.effects.sparkles(x + 0.5, y + 0.7, z + 0.5, 5, [B.cropOf(id).color, '#ffffff', '#fff3a0']);
      near ||= this.near(x, y, z, 16);
    }
    const now = performance.now();
    if (near && now >= (this.ripeTuneAt ?? 0)) {
      this.ripeTuneAt = now + RIPE_TUNE_MS;
      this.sound.play('grow');
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

  // A mining bomb going off (shared/room.js stepBombs): the boom seen and
  // heard wherever you stand, and any jewels the blast shook out of gem rocks
  // into the basket of whoever laid it.
  blast(msg) {
    const fx = this.renderer.effects;
    fx.pop(Math.floor(msg.x), Math.floor(msg.y), Math.floor(msg.z), '#d9d3c7', 24);
    fx.sparkles(msg.x, msg.y + 0.5, msg.z, 30, ['#ffd84d', '#ff8fc4', '#ffffff']);
    if (this.near(msg.x, msg.y, msg.z, 40)) this.sound.play('boom');
    if (msg.by !== this.pid || !msg.gems?.length) return;
    const cells = [];
    for (let i = 0; i < msg.gems.length; i++) cells.push(Math.floor(msg.x), Math.floor(msg.y), Math.floor(msg.z), B.AIR);
    this.collect(msg.gems, cells);
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
    // A ripe crop to pick, whatever the tool.
    if (B.isRipe(hit.id)) return { kind: 'collect', ...harvestEdit(w, hit), mode: 'remove' };
    switch (this.tool) {
      case 'build': {
        const id = this.selectedBlock();
        // The watering can waters farmland; it is never put down itself.
        if (id === B.WATERING_CAN) return { kind: 'water', ...waterEdit(w, hit, this.size), mode: 'paint' };
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
    if (secondary && tool !== 'pick' && !B.isRipe(aim.hit.id)) {
      // Right-click always picks up, whatever the tool (a ripe crop is picked as ever).
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
    // Watering farmland that is wet already only splashes; anything else
    // the watering can is no good for.
    if (plan.kind === 'water' && !plan.cells.length) {
      if (plan.spots.length) this.waterFx(plan.spots);
      else {
        this.emit('notice', { text: 'The watering can is for farmland: tap the soil, or what grows in it!', level: 'info' });
        this.sound.play('no');
      }
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
    // (Nor does it dry out what the watering can watered.)
    if (!this.edit(kind, cells, { undoable: plan.kind !== 'collect' && plan.kind !== 'water' })) return;
    this.previewKey = '';
    this.editEffects(kind, cells, true);
    const p = this.profile;
    const n = cells.length / 4;
    const first = cells[3];
    switch (plan.kind) {
      case 'build':
        this.sound.play('place', { kind: B.block(first).sound });
        if (this.basketPick) {
          // A vegetable planted (on the farmland it may have turned over).
          const sown = cells.some((id, i) => i % 4 === 3 && B.CROP_OF[id]);
          this.spendBasket();
          if (B.block(first).grows) p.count('sprouts');
          if (sown) p.count('sown');
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
      case 'water':
        this.sound.play('water');
        p.count('watered', n);
        break;
      default:
        break;
    }
    if (plan.collected?.length) this.collect(plan.collected, cells);
  }

  // The watering can poured on farmland that is wet already ([x, y, z]
  // cells): drops on it and a trickle, and nothing else (an edit that
  // waters some shows its drops in editEffects).
  waterFx(spots) {
    for (const [x, y, z] of spots) this.renderer.effects.sparkles(x + 0.5, y + 1.3, z + 0.5, 4, WATER_DROPS);
    this.sound.play('water');
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
      else if (B.isRipe(id)) p.count('harvested');
      else if (id === B.SHELL) p.count('shells');
      else if (id === B.PEARL) p.count('pearls');
      else if (id === B.STAR_PIECE) p.count('stars');
      else if (B.isJewel(id)) {
        p.count('gems');
        if (key === 'diamond') p.count('diamonds');
        const gem = B.GEMS.find(([k]) => k === key);
        if (gem) colors.unshift(gem[3], gem[3]);
        if (B.GEM_ROCK[id]) dug.push(gem);
      }
      const crop = B.cropOf(id);
      if (crop) colors.unshift(crop.color, crop.color);
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
      // What is on the shared isle is everyone's, and stays with the island.
      if (this.shared) {
        this.emit('notice', { text: `${this.world.name} is everyone’s, so its animals and vehicles stay.`, level: 'info' });
        this.sound.play('no');
        return;
      }
      this.send({ t: 'critter', op: 'bye', id });
      return;
    }
    // A firefly is only for looking at: no petting, and no fruit spent.
    if (CRITTER_INFO[entry.type].look) {
      this.emit('toast', { icon: CRITTER_INFO[entry.type].icon, text: `${entry.name || 'A firefly'} glows softly — just for looking at!` });
      return;
    }
    // A vehicle is only honked at, whatever is in your hand.
    if (CRITTER_INFO[entry.type].vehicle) {
      this.send({ t: 'critter', op: 'pet', id });
      return;
    }
    // A giant clam is only tapped at, whatever is in your hand (it opens,
    // and maybe there is a pearl in there).
    if (entry.type === 'clam') {
      this.send({ t: 'critter', op: 'pet', id });
      return;
    }
    const fruit = this.basketPick && B.isFood(this.basketPick) ? this.basketPick : null;
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
    // The shared isle's toy box stays shut: nothing is brought to it.
    if (this.shared) {
      this.emit('notice', { text: `${this.world.name} stays just as it was made, so its toy box stays shut!`, level: 'info' });
      this.sound.play('no');
      return;
    }
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
    this.seatTarget = !this.riding && !this.aboard && !this.seat && !this.dizzy && !on.flying && on.onGround ? seatNear(this.world, on, undefined, (x, y, z) => this.seatTaken(x, y, z)) : null;
    this.arcadeTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.dizzy && !on.flying && on.onGround ? arcadeNear(this.world, on) : null;
    this.gashaTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.dizzy && !on.flying && on.onGround ? gashaponNear(this.world, on) : null;
    this.pianoTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.dizzy && !on.flying && on.onGround ? pianoNear(this.world, on) : null;
    this.tvTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.dizzy && !on.flying && on.onGround ? tvNear(this.world, on) : null;
    this.stationTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.tvTarget && !this.dizzy && !on.flying && on.onGround ? stationNear(this.world, on) : null;
    this.classTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.tvTarget && !this.stationTarget && !this.dizzy && !on.flying && on.onGround ? chalkboardNear(this.world, on) : null;
    this.drawTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.tvTarget && !this.stationTarget && !this.classTarget && !this.dizzy && !on.flying && on.onGround ? boardNear(this.world, on) : null;
    this.stoveTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.tvTarget && !this.stationTarget && !this.classTarget && !this.drawTarget && !this.dizzy && !on.flying && on.onGround ? stoveNear(this.world, on) : null;
    this.goTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.tvTarget && !this.stationTarget && !this.classTarget && !this.drawTarget && !this.stoveTarget && !this.dizzy && !on.flying && on.onGround ? goBoardNear(this.world, on) : null;
    this.screenTarget = !this.riding && !this.aboard && !this.seat && !this.seatTarget && !this.arcadeTarget && !this.gashaTarget && !this.pianoTarget && !this.tvTarget && !this.stationTarget && !this.classTarget && !this.drawTarget && !this.stoveTarget && !this.goTarget && !this.dizzy && !on.flying && on.onGround ? screenNear(this.world, on, this.screens) : null;
    this.sendMove();
    this.updatePlayers(dt);
    if (this.seat) this.checkTeaParty();
    this.updateHotTubs();
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
    this.renderer.updateCamera(dt, this.seat ? { x: b.x, y: b.y - (this.me.anim === ANIM.sit ? 0.45 : 0.95), z: b.z } : this.pianoAt ? { x: b.x, y: b.y - BENCH_H, z: b.z } : b);
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
    if (this.pianoAt) {
      this.stayAtPiano(dt);
      return;
    }
    const me = this.me;
    const b = me.body;
    const w = this.world;
    // Sitting dizzy, you go nowhere; nor do you, eyes shut, counting to hide and seek.
    const still = this.dizzy || this.counting;
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
    // A swim in the lava counts too, bold swimmer (it burns: room.js).
    if ((b.inWater || b.inLava) && !this.wasInWater) this.profile.count('swims');
    // In a Fire Suit, lava does not burn (room.js): said so the first time.
    if (b.inLava && !this.toldFireproof && wornOutfit(this.profile.data.gear)?.power === 'fireproof') {
      this.toldFireproof = true;
      this.emit('toast', { icon: '🧑‍🚒', text: 'Your Fire Suit keeps you cool — swim in the lava all you like!' });
    }
    this.wasInWater = b.inWater || b.inLava;
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
      // Your swing stops dead a moment as it lands on a monster (strike).
      a.update(performance.now() < (this.hitStopUntil ?? 0) ? 0 : dt, me.anim, speed);
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
    // The shared isle is an adventure on foot: you cannot fly there on
    // your own (its helicopter and balloon fly as anywhere — ride them!).
    if (this.shared) {
      this.emit('notice', { text: `No flying on your own on ${this.world.name} — it is an adventure on foot!`, level: 'info' });
      this.sound.play('no');
      return;
    }
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
      // At a desk, typing or on a coffee break (the CTB office's workers), is sitting too.
      p.sitting = s.anim === ANIM.sit || s.anim === ANIM.type || s.anim === ANIM.coffee;
      // In a seat at all, sitting or lying: nobody else can sit there.
      p.inSeat = p.sitting || s.anim === ANIM.lie || s.anim === ANIM.curl;
      const mount = p.seated ? [...this.critters.values()].find((c) => c.rider === p.id || c.lastRider === p.id || c.passengers.includes(p.id)) : null;
      a.ride = mount ? CRITTER_INFO[mount.type].ride : null;
      a.update(dt, s.anim, Math.min(speed, 12));
      this.renderer.placeShadow(a.shadow, s.x, s.y, s.z);
      if (p.seated || p.inSeat || s.anim === ANIM.piano) a.shadow.visible = false;
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
      if (c.type === 'dragon') this.dragonFrame(c, s, now);
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
      if (!info?.vehicle && state !== 'sleep' && night === Boolean(info?.nocturnal) && now > c.voiceAt && this.near(s.x, s.y, s.z, far)) {
        c.voiceAt = now + (9000 + Math.random() * 14000) * rare;
        if (c.type !== 'butterfly' && c.type !== 'firefly') this.sound.play(c.type === 'dragon' ? 'roar' : c.type);
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
    this.arcade.clear();
    this.arcadeAt = null;
    this.arcadeTarget = null;
    this.hideseek = null;
    this.gashaAt = null;
    this.gashaTarget = null;
    this.pianoAt = null;
    this.pianoTarget = null;
    this.tvAt = null;
    this.tvTarget = null;
    this.stationAt = null;
    this.stationTarget = null;
    this.classTarget = null;
    this.stoveTarget = null;
    this.cooking = null;
    this.study = null;
    this.drawAt = null;
    this.drawTarget = null;
    this.goGames.clear();
    this.goAt = null;
    this.goTarget = null;
    this.renderer.goBoards.clear();
    this.screens.clear();
    this.screenAt = null;
    this.screenTarget = null;
    this.renderer.screens.clear();
    this.drawings.clear();
    this.renderer.drawings.clear();
    this.renderer.showPreview(null);
    this.renderer.showOutline(null);
    this.sound.setSong(null);
  }
}
