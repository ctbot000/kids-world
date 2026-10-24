// Everything on top of the 3D view: the title screen, the toolbar and
// hotbar, the toy box, talking and emotes, name tags and speech bubbles,
// settings, stickers, the ranking, help, logging in and full screen. Big
// buttons, pictures first, few words.
import * as B from './shared/blocks.js';
import { ARCADE_GAMES, FACES as CARD_FACES } from './shared/arcade.js';
import { BLACK, LESSONS, NO_MOVE, placeName, SIZES as GO_SIZES, WHITE } from './shared/go.js';
import { ALL_TOYS, GASHA_PRICE, MONSTER_FIGURES, MONSTER_PRICE, rarityOdds, rarityOf, TOYS, toysFound } from './shared/gashapon.js';
import { KEYS as PIANO_KEYS, noteOfKey, SONGS, songOf } from './shared/piano.js';
import { CHANNELS, channelsWith, LIVE, nextChannel, ON_AIR } from './shared/tv.js';
import { stationId } from './shared/broadcast.js';
import { isBroadcastStation, onAirShow } from './shared/station.js';
import { LiveTv } from './tv-live.js';
import { drawShow, drawStatic } from './tv-shows.js';
import { ANIMAL_TYPES, CRITTER_INFO, VEHICLES } from './shared/critters.js';
import { TAMES_TO_INVITE } from './shared/dragon.js';
import { isNight } from './shared/env.js';
import { prettyCode } from './shared/codes.js';
import { STICKER_XP } from './shared/levels.js';
import { boardsOf } from './shared/ranking.js';
import { CLOTHES, fixPrice, GEAR, isBroken, levelDoes, nextLevel, POTION, SEED_PACK, seedPrice, sellPrice, usesLeft, WEAPONS, wearing, wornWeapon } from './shared/shop.js';
import { STAMPS } from './shared/stamps.js';
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem, REPORT_TEXT_MAX, USERNAME_MAX, USERNAME_MIN, usernameProblem, WISH_TEXT_MAX } from './shared/keeper.js';
import { ANIMALS, CHAT_MAX, cleanChat, cleanIslandName, cleanLook, cleanName, EMOTES, FACES, FUR_COLORS, GROWN_UP, HAIR_COLORS, HAIRS, HATS, ISLAND_NAME_MAX, isPerson, isValidName, langOf, lookIcon, NAME_MAX, PET_COATS, petKind, PETS, PHRASES, randomPetName, SHIRT_COLORS, SKIN_TONES, STICKERS as STICKER_EMOJI, randomIslandName, randomName } from './shared/words.js';
import { SIZES, THEMES } from './shared/worldgen.js';
import { PASSCODE_LENGTH, randomPasscode } from './shared/listing.js';
import { bodyOf, maxHp } from './shared/monsters.js';
import { towerTop } from './shared/defense.js';
import { QUIZ_LEVELS, QUIZ_SIZE, quizCoins } from './shared/quiz.js';
import { CLASS_BREAK_MS, CLASS_SIZE } from './shared/school.js';
import { COOK_BREAK_MS, cookCoins, RECIPES, recipeByKey } from './shared/cooking.js';
import { BY_HEART, factsOf, workbookByKey, workbookProgress, WORKBOOKS } from './shared/study.js';
import { BRUSHES, COLORS as DRAW_COLORS, decodePicture, GALLERY_MAX, isBoard, MAX_POINTS, PICTURE_H, PICTURE_W } from './shared/drawing.js';
import { paint } from './render/drawings.js';
import { NEXT_STAGE_SECONDS } from './shared/adventure.js';
import { blockIcon } from './render/atlas.js';
import { seatOf } from './shared/seats.js';
import { shirtColor } from './render/avatar.js';
import { fullscreenMode, isFullscreen, onFullscreenChange, setFullscreen } from './fullscreen.js';
import { hairIcon } from './hair-icons.js';
import { hurried } from './hurry.js';
import { NEWS } from './news.js';
import { HILL_MODES, TOOLS } from './game.js';
import { MiniMap } from './minimap.js';
import { load, save } from './storage.js';
import { STICKERS } from './profile.js';
import { QUALITY_CHOICES } from './quality.js';
import { pictureFrom, recentErrors, screenshot } from './report.js';

// The ideas whose answers this device has shown already (see wishAnswered).
const WISHES_SEEN_KEY = 'kidsworld.wishes-seen';
const $ = (id) => document.getElementById(id);

// "just now", "5 minutes ago", "on 10/3/2026".
function ago(t) {
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  return `on ${new Date(t).toLocaleDateString()}`;
}

// A tiny element builder: h('button', { class: 'chip', onclick }, 'Hi').
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

// Line icons for what no emoji shows: full screen (corners pointing out, and
// in once the screen is full) and the Share button.
const LINE_ICONS = {
  full: '<svg class="line-icon full-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="enter" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path class="leave" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>',
  share: '<svg class="line-icon share-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5M12 3v11M8.5 6.5 12 3l3.5 3.5"/></svg>',
};

function lineIcon(name) {
  const t = document.createElement('template');
  t.innerHTML = LINE_ICONS[name];
  return t.content.firstElementChild;
}

// The camera's ways of looking (render/renderer.js VIEWS), in words and pictures.
const VIEW_NAMES = { behind: 'from behind you', eyes: 'through your eyes', sky: 'from the sky' };
const VIEW_ICONS = { behind: '🧍', eyes: '👀', sky: '☁️' };
// How finished the picture is (quality.js), in words.
const QUALITY_WORDS = { auto: '✨ Auto', high: '🌟 Best', medium: '👍 Good', low: '⚡ Fast' };
const THEME_ICON = Object.fromEntries(THEMES.map((t) => [t.key, t.icon]));

// What the island rule for monsters means (shared/monsters.js).
// The bop button shows while a monster is this near.
const ATTACK_SHOW = 14;
const MONSTERS_ABOUT = 'Grumpy jelly blobs hop after you and take some of your HP (each level up gives you more of it). Jump on one to pop it, or walk right up to it and bop it three times with 👊 (X)! Watch out for big Bruisers and prickly Spikies, more of them at night. HP comes back by itself — or drink a 🧪 potion from the shop to fill it up at once.';
// What an adventure island is (shared/adventure.js).
const ADVENTURE_ABOUT = 'Grumpy monster camps all over the island. Free them with friends, then pop King Grumble!';
// What a tower defense island is (shared/defense.js).
const DEFENSE_ABOUT = 'Monsters march along a road to the Star Stone. Build towers beside it with friends, and see off every wave!';

// "a peach", "an apple".
// "an elephant", "a unicorn".
const withArticle = (word) => `${/^(?!uni)[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

// What is wrong with a new password, in a few words (see passwordProblem).
const PASSWORD_HELP = {
  short: `Make your password at least ${PASSWORD_MIN} letters or numbers long.`,
  long: `That password is very long! At most ${PASSWORD_MAX} letters or numbers, please.`,
  name: 'Pick a password that is not your username.',
};

// What is wrong with a username, in a few words (see usernameProblem).
const USERNAME_HELP = {
  short: `Make your username at least ${USERNAME_MIN} letters long.`,
  long: `That username is very long! At most ${USERNAME_MAX} letters, please.`,
  odd: 'Use only letters, numbers and signs you can see.',
};

// "3 islands, 12 stickers and 5 treasures", leaving out what there is none of.
function things({ islands, stickers, treasures }) {
  const parts = [
    islands ? `${islands} ${islands === 1 ? 'island' : 'islands'}` : '',
    stickers ? `${stickers} ${stickers === 1 ? 'sticker' : 'stickers'}` : '',
    treasures ? `${treasures} ${treasures === 1 ? 'treasure' : 'treasures'}` : '',
  ].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? '';
}

// What to tell you when the keeper could not log you in, or make your login
// (the codes of KeeperProblem), as [icon, words].
function loginTrouble(error) {
  switch (error?.code) {
    case 'wrong':
      return ['🙈', 'That username and password do not go together. Try again!'];
    case 'weak':
      return ['🙈', PASSWORD_HELP[error.problem] ?? error.message];
    case 'username':
      return ['🙈', USERNAME_HELP[error.problem] ?? error.message];
    case 'taken':
      return ['🙈', 'Someone has that username already. Try another one!'];
    case 'wait': {
      const minutes = Math.max(1, Math.ceil((error.wait ?? 600000) / 60000));
      return ['⏳', `That was a lot of tries! Wait ${minutes === 1 ? 'a minute' : `${minutes} minutes`}, then try again.`];
    }
    case 'asleep':
      return ['😴', 'The island keeper is asleep right now. Try again when it is awake!'];
    case 'refused':
      return ['🙈', 'The island keeper cannot be reached right now. Try again later.'];
    case 'gone':
      return ['🔑', 'Your login was taken away at the island keeper.'];
    case 'room':
      return ['💾', 'This browser is out of room. Ask a grown-up for help.'];
    default:
      return ['😕', error?.message && error.message !== error.code ? `The island keeper said: ${error.message}` : 'That did not work. Try again later.'];
  }
}

// What to tell you when the keeper could not show the ranking, as [icon, words].
function rankingTrouble(error) {
  // A keeper running code from before the ranking: it says so in its terminal too.
  if (error?.code === 'bad') return ['🛠️', 'The island keeper needs an update before it can show the ranking. Ask a grown-up to update it!'];
  if (error?.code === 'asleep') return ['😴', 'The island keeper is asleep right now. The ranking is there when it is awake!'];
  return loginTrouble(error);
}

// What to tell you when the keeper could not show the players, as [icon, words].
function playersTrouble(error) {
  if (error?.code === 'bad') return ['🛠️', 'The island keeper needs an update before it can show the players. Ask a grown-up to update it!'];
  if (error?.code === 'asleep') return ['😴', 'The island keeper is asleep right now. The players are here when it is awake!'];
  return loginTrouble(error);
}

// What to tell you when an invitation could not go, as [icon, words].
function inviteTrouble(error, name) {
  if (error?.code === 'away') return ['😴', `${name} is not playing right now.`];
  // The AI friend, busy on other islands or unable to reach this one: it says why.
  if (error?.code === 'friend-busy') return ['🤖', error.message || `${name} can't come right now.`];
  if (error?.code === 'wait') return ['⏳', 'Wait a little before inviting again.'];
  return playersTrouble(error);
}

// An invitation can go to the same player again this long after the last.
const INVITE_AGAIN_MS = 15000;

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

// The ranking's worlds: everyone's everywhere, and the isle's own. A world's
// boards come from ranking.js; the keeper ranks each from that world's copy
// of every player.
const RANKING_WORLDS = [
  { key: 'home', icon: '🏝️', name: 'Every island' },
  { key: 'isle', icon: '🌟', name: 'Adventure Isle' },
];

// Another player's level by their name (levels.js), wherever a list says who
// someone is — the tag over them in the world, the ranking, the players, an
// invitation, the friends on an island: it travels in their look (look.level).
// ⭐N, with the level said aloud on a hover.
const levelTag = (look) => (look?.level ? h('span', { class: 'tag-level', title: `Level ${look.level}` }, `⭐${look.level} `) : null);

export class UI {
  constructor({ profile, isle = null, sound, atlas, input }) {
    this.home = profile;
    this.isle = isle;
    // The world you are in: your profile, or on the shared isle the isle's
    // own (see attach and detach) — its pages show that one's things.
    this.profile = profile;
    this.sound = sound;
    this.atlas = atlas;
    this.input = input;
    this.icons = new Map();
    this.game = null;
    this.tags = new Map();
    // Over an adventure island's camps and King Grumble (see adventureTags).
    this.advTags = new Map();
    // What you got for popping a monster, over where you did it (see reward).
    this.floats = new Map();
    this.floatId = 0;
    this.modalClose = null;
    $('modal-close').addEventListener('click', () => this.closeModal());
    $('modal').addEventListener('pointerdown', (e) => {
      if (e.target === $('modal')) this.closeModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('modal').hidden) {
        e.preventDefault();
        this.closeModal();
      }
    });
    for (const p of [profile, isle]) {
      if (!p) continue;
      p.addEventListener('sticker', (e) => {
        const s = e.detail;
        this.sound.play('sticker');
        this.toast(s.icon, `New sticker: ${s.name}!`, 'sticker');
      });
      p.addEventListener('basket', () => this.renderBasket());
      for (const type of ['count', 'change']) p.addEventListener(type, () => this.renderLevel());
      p.addEventListener('level', (e) => this.levelUp(e.detail.level));
    }
    this.renderLevel();
    this.minimap = new MiniMap($('minimap').querySelector('canvas'), atlas);
    $('minimap').addEventListener('click', () => this.mapDialog());
    this.fullMode = fullscreenMode();
    $('btn-fullscreen').prepend(lineIcon('full'));
    $('btn-fullscreen-hud').append(lineIcon('full'));
    $('btn-fullscreen').onclick = $('btn-fullscreen-hud').onclick = () => this.toggleFullscreen();
    onFullscreenChange(() => this.renderFullscreen());
    this.renderFullscreen();
    // On narrow screens a connection message has a spot of its own where the
    // toasts start, and they make room for it (see .status in the stylesheet).
    new ResizeObserver(() => {
      const h = $('status').offsetHeight;
      document.documentElement.style.setProperty('--status-room', h ? `${h + 8}px` : '0px');
    }).observe($('status'));
    // On upright touch screens the touch buttons and the thumbstick, and on
    // narrow computer screens the talk buttons, stand on the hotbar and the
    // basket over it, which grows a row at a time as it fills (see
    // #touch-buttons and #talk in the stylesheet).
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--bottom-height', `${$('bottom').offsetHeight}px`);
    }).observe($('bottom'));
    // Chat lines keep to the room the stylesheet gives the chat log between
    // the buttons above and below it, which changes with them: a line that no
    // longer fits whole goes, and as the newest is at the bottom, the oldest go
    // first (see .chatlog in the stylesheet). Not a ResizeObserver on the log:
    // the room changes with --bottom-height and --status-room, after the two
    // observers above have reported, too late in the frame for it to report
    // too, and the browser raises a loop error instead.
    this.chatRoom = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.intersectionRatio < 0.99) e.target.remove();
      },
      { root: $('chatlog'), threshold: [0.99, 1] },
    );
  }

  // ------------------------------------------------ icons

  icon(id) {
    let entry = this.icons.get(id);
    if (!entry) {
      entry = { url: null, promise: blockIcon(this.atlas, id, 64) };
      entry.promise.then((url) => (entry.url = url));
      this.icons.set(id, entry);
    }
    return entry;
  }

  img(id, alt = '') {
    const el = h('img', { alt, draggable: false });
    const entry = this.icon(id);
    if (entry.url) el.src = entry.url;
    else entry.promise.then((url) => (el.src = url));
    return el;
  }

  // ------------------------------------------------ bits and pieces

  // Steps the camera on: from behind you, through your eyes, from the sky.
  nextView() {
    const name = this.game.renderer.nextView();
    this.toast('🎥', `Looking ${VIEW_NAMES[name]}`);
  }

  toast(icon, text, kind = '') {
    const el = h('div', { class: `toast ${kind}` }, h('span', { class: 'icon' }, icon), h('span', {}, text));
    $('toasts').append(el);
    while ($('toasts').children.length > 4) $('toasts').firstElementChild.remove();
    setTimeout(() => el.remove(), 4100);
  }

  // A reward for something you did, over where you did it: a popped
  // monster's XP (game.js popped). A pill of what you got rises away from
  // the spot and fades (frame keeps it over the place as you look about),
  // and the ⭐ ring on the Stickers button pings, the XP going in: what the
  // ring says and what the pill says are the same thing.
  reward({ x, y, z, xp }) {
    if (![x, y, z, xp].every(Number.isFinite) || xp <= 0) return;
    const el = h('div', { class: 'float-reward', title: `${xp} XP toward your next level` }, h('span', {}, `⭐ +${xp}`));
    $('overlays').append(el);
    this.floats.set(`reward-${this.floatId++}`, { x, y, z, at: performance.now(), el });
    while (this.floats.size > 8) {
      const oldest = this.floats.keys().next().value;
      this.floats.get(oldest).el.remove();
      this.floats.delete(oldest);
    }
    const button = $('btn-stickers-hud');
    button.classList.remove('gain');
    // So a pulse still going round again starts over.
    void button.offsetWidth;
    button.classList.add('gain');
    clearTimeout(this.gainTimer);
    this.gainTimer = setTimeout(() => button.classList.remove('gain'), 700);
  }

  loading(text, onCancel = null) {
    $('loading').hidden = false;
    $('loading-text').textContent = text;
    const cancel = $('loading-cancel');
    cancel.hidden = !onCancel;
    cancel.onclick = onCancel;
  }

  hideLoading() {
    $('loading').hidden = true;
  }

  // ------------------------------------------------ dialogs

  // pose: you are choosing how you look, so on a narrow screen everything
  // else makes way for you above the dialog.
  openModal(build, { narrow = false, onClose = null, seeThrough = false, pose = false } = {}) {
    // Opening a dialog over another closes that one first, so what it changed
    // goes back: the camera that turned to you, the big map being drawn. Before
    // building, as the new dialog may set the same things up again.
    const replaced = this.modalClose;
    this.modalClose = null;
    replaced?.();
    const body = $('modal-body');
    body.replaceChildren();
    build(body);
    const panel = $('modal').querySelector('.panel');
    panel.classList.toggle('narrow', narrow);
    $('modal').classList.toggle('see-through', seeThrough);
    document.body.classList.toggle('posing', pose);
    $('modal').hidden = false;
    this.modalClose = onClose;
    this.input.enabled = false;
    this.input.releaseAll();
    if (this.game) this.game.uiBlocking = true;
    this.sound.play('open');
  }

  closeModal() {
    if ($('modal').hidden) return;
    $('modal').hidden = true;
    document.body.classList.remove('posing');
    const fn = this.modalClose;
    this.modalClose = null;
    this.input.enabled = Boolean(this.game);
    if (this.game) this.game.uiBlocking = false;
    this.sound.play('close');
    fn?.();
  }

  get modalOpen() {
    return !$('modal').hidden;
  }

  // Puts the focus in a dialog's first box a moment after it opens, unless a
  // box in it has the focus already. On a busy device that moment can come
  // late, after another box was picked and typing in it had begun, and the
  // rest of what was typed went into the first box: a password into the
  // username, the numbers of a code into the one already filled.
  focusSoon(box, ms) {
    setTimeout(() => {
      if (!$('modal-body').contains(document.activeElement)) box?.focus();
    }, ms);
  }

  // ------------------------------------------------ title screen

  showTitle(handlers) {
    this.handlers = handlers;
    $('title').hidden = false;
    $('hud').hidden = true;
    this.renderMe();
    this.renderLogin();
    // The shared isle (server/adventure.js): its own way in, where the list
    // of open islands is — the dedicated server's, or a keeper's.
    this.renderIsle();
    $('btn-isle').onclick = () => handlers.sharedIsle?.();
    $('mode-build').onclick = () => this.setTitleWorld('home');
    $('mode-adventure').onclick = () => this.setTitleWorld('isle');
    $('btn-new').onclick = () => this.newIslandDialog();
    $('btn-visit').onclick = () => this.visitDialog();
    $('btn-mine').onclick = () => this.myIslandsDialog();
    $('btn-me').onclick = () => this.meDialog();
    $('btn-pet').onclick = () => this.petDialog();
    $('btn-login').onclick = () => (handlers.login.who() ? this.myLoginDialog() : this.loginDialog());
    $('gate-login').onclick = () => this.loginDialog();
    $('gate-make').onclick = () => this.makeLoginDialog();
    $('btn-stickers').onclick = $('btn-level').onclick = () => this.stickersDialog();
    $('btn-shop').onclick = () => this.shopDialog();
    $('btn-backpack').onclick = () => this.backpackDialog();
    $('btn-ranking').onclick = () => this.rankingDialog(this.profile === this.isle ? 'isle' : 'home');
    $('btn-players').onclick = () => this.playersDialog();
    $('btn-help').onclick = () => this.helpDialog();
    $('btn-news').onclick = () => this.newsDialog();
    $('btn-feedback').onclick = () => this.feedbackDialog();
    $('btn-sound').onclick = () => this.soundDialog();
  }

  hideTitle() {
    $('title').hidden = true;
  }

  renderMe() {
    $('me-name').textContent = `Hi, ${this.profile.name}!`;
  }

  // Your level and XP (levels.js): on the title screen, and on an island on
  // the ⭐ Stickers button, with a ring round it filling up to the next level.
  renderLevel() {
    const { xp, level, into, need } = this.profile.progress;
    const key = `${xp}|${level}`;
    if (this.levelKey === key) return;
    this.levelKey = key;
    const label = need ? `Level ${level}: ${into.toLocaleString()} of ${need.toLocaleString()} XP to level ${level + 1}` : `Level ${level}, the top level!`;
    const chip = $('btn-level');
    chip.textContent = `⭐ Level ${level}`;
    chip.title = label;
    const button = $('btn-stickers-hud');
    $('level-pip').textContent = String(level);
    button.style.setProperty('--xp', `${need ? Math.floor((100 * into) / need) : 100}%`);
    button.title = label;
    button.setAttribute('aria-label', `Stickers. ${label}`);
  }

  // Up a level: a fanfare (with the HP it brings), and sparkles round you on an island.
  levelUp(level) {
    this.sound.play('levelup');
    this.toast('🎉', `Level up! You are level ${level}! Max HP ${maxHp(level)}!`, 'sticker level-up');
    const me = this.game?.me?.body;
    if (me) {
      const fx = this.game.renderer.effects;
      fx.sparkles(me.x, me.y + 1, me.z, 30, ['#ffd84d', '#ffffff', '#ff8fa3', '#9fe8ff']);
      fx.firework(me.x, me.y + 4, me.z);
    }
  }

  // The 🔑 by your name: there when there is a keeper to log in at, and
  // always while logged in, so a device without one can still log out. The
  // 🏆 Ranking and 👫 Players, kept by the keeper too, are there with one.
  renderLogin() {
    const login = this.handlers?.login;
    const chip = $('btn-login');
    chip.hidden = !login?.available() && !login?.who();
    chip.textContent = login?.who() ? '🔑 My login' : '🔑 Log in';
    chip.classList.toggle('on', Boolean(login?.who()));
    $('btn-ranking').hidden = !login?.available();
    $('btn-players').hidden = !login?.available();
    // Nobody plays without a login: until you log in (or make one), the
    // title screen has only the way to, and says so while there is no
    // keeper to log in at.
    this.renderFeedback();
    const gated = Boolean(login?.required?.());
    $('title').classList.toggle('gated', gated);
    $('login-gate').hidden = !gated;
    $('gate-away').hidden = !gated || Boolean(login?.available());
    for (const id of ['gate-login', 'gate-make']) $(id).disabled = !login?.available();
  }

  // The 🌟 shared isle's own way in, there wherever the list of open
  // islands is: the dedicated server's own list, or a keeper's.
  renderIsle() {
    this.renderTitleWorld();
  }

  // 🧱 Build or ⚔️ Adventure on the title screen: two worlds of you, kept
  // apart. Build is your islands and your friends', with your level,
  // stickers, shop and ranking; Adventure is the shared isle, with its own.
  // There once the isle is (where the list of open islands is) or you have
  // been on it; remembered on this device, and the world you last played in.
  hasIsleWorld() {
    return Boolean(this.isle) && (Boolean(this.handlers?.listAvailable?.()) || this.isle.progress.xp > 0);
  }

  setTitleWorld(world) {
    this.titleWorld = world === 'isle' ? 'isle' : 'home';
    save('titleWorld', this.titleWorld);
    this.renderTitleWorld();
  }

  renderTitleWorld() {
    this.titleWorld ??= load('titleWorld', 'home') === 'isle' ? 'isle' : 'home';
    const can = this.hasIsleWorld();
    const isle = can && this.titleWorld === 'isle';
    $('mode-switch').hidden = !can;
    for (const [id, on] of [['mode-build', !isle], ['mode-adventure', isle]]) {
      $(id).classList.toggle('on', on);
      $(id).setAttribute('aria-selected', String(on));
    }
    const list = Boolean(this.handlers?.listAvailable?.());
    $('btn-isle').hidden = !isle || !list;
    $('isle-away').hidden = !isle || list;
    for (const id of ['btn-new', 'btn-visit', 'btn-mine']) $(id).hidden = isle;
    $('tagline').textContent = isle ? 'Free Adventure Isle from grumpy monsters together!' : 'Build a happy island with your friends!';
    // At the title, the pages show the world picked (on an island, the one you are in).
    const p = isle ? this.isle : this.home;
    if (!this.game && p !== this.profile) {
      this.profile = p;
      this.levelKey = '';
      this.renderLevel();
      // You on the title, dressed in that world's gear.
      this.handlers?.lookChanged?.();
    }
  }

  // The island's name: any typed, or one rolled for its kind (shown grey
  // while the box is empty). While what is typed is no name, the last one stays.
  newIslandDialog() {
    let theme = 'sunny';
    let size = SIZES[0].key;
    let rolled = randomIslandName(theme);
    let own = '';
    let online = true;
    let monsters = false;
    let adventure = false;
    let defense = false;
    this.openModal((root) => {
      const nameBox = h('input', { type: 'text', class: 'text-input name-input', value: rolled, placeholder: rolled, maxLength: ISLAND_NAME_MAX * 2, autocomplete: 'off', 'aria-label': 'Island name' });
      nameBox.spellcheck = false;
      nameBox.addEventListener('input', () => (own = nameBox.value.trim() ? cleanIslandName(nameBox.value) || own : ''));
      nameBox.addEventListener('change', () => {
        if (nameBox.value.trim()) nameBox.value = own || rolled;
      });
      // 🎲 drops a typed name; a kind of island picked keeps it.
      const roll = (anew) => {
        rolled = randomIslandName(theme);
        nameBox.placeholder = rolled;
        if (anew) own = '';
        if (!own && (anew || nameBox.value.trim())) nameBox.value = rolled;
      };
      const grid = h('div', { class: 'grid wide' });
      const draw = () => {
        grid.replaceChildren(
          ...THEMES.map((t) =>
            h(
              'button',
              {
                class: `choice big-choice${t.key === theme ? ' on' : ''}`,
                type: 'button',
                onclick: () => {
                  theme = t.key;
                  roll(false);
                  this.sound.play('ui');
                  draw();
                },
              },
              h('span', { class: 'emoji' }, t.icon),
              h('b', {}, t.name),
              h('small', {}, t.blurb),
            ),
          ),
        );
      };
      draw();
      const sizes = h('div', { class: 'grid sizes' });
      const drawSizes = () => {
        sizes.replaceChildren(
          ...SIZES.map((s) =>
            h(
              'button',
              {
                class: `choice${s.key === size ? ' on' : ''}`,
                type: 'button',
                'aria-pressed': String(s.key === size),
                onclick: () => {
                  size = s.key;
                  this.sound.play('ui');
                  drawSizes();
                },
              },
              h('span', { class: 'emoji' }, s.icon),
              h('b', {}, s.name),
              h('small', {}, s.blurb),
            ),
          ),
        );
      };
      drawSizes();
      const sw = h('button', { class: 'switch on', type: 'button', 'aria-label': 'Friends can visit', role: 'switch', 'aria-checked': 'true' });
      sw.onclick = () => {
        online = !online;
        sw.classList.toggle('on', online);
        sw.setAttribute('aria-checked', String(online));
        this.sound.play('ui');
      };
      const monsterSw = h('button', { class: 'switch', type: 'button', 'aria-label': 'Monsters', role: 'switch', 'aria-checked': 'false' });
      monsterSw.onclick = () => {
        monsters = !monsters;
        monsterSw.classList.toggle('on', monsters);
        monsterSw.setAttribute('aria-checked', String(monsters));
        this.sound.play('ui');
      };
      const adventureSw = h('button', { class: 'switch', type: 'button', 'aria-label': 'Adventure', role: 'switch', 'aria-checked': 'false' });
      const defenseSw = h('button', { class: 'switch', type: 'button', 'aria-label': 'Tower defense', role: 'switch', 'aria-checked': 'false' });
      // One or the other: an island is an adventure or a tower defense, never both.
      const showKinds = () => {
        adventureSw.classList.toggle('on', adventure);
        adventureSw.setAttribute('aria-checked', String(adventure));
        defenseSw.classList.toggle('on', defense);
        defenseSw.setAttribute('aria-checked', String(defense));
      };
      adventureSw.onclick = () => {
        adventure = !adventure;
        if (adventure) defense = false;
        showKinds();
        this.sound.play('ui');
      };
      defenseSw.onclick = () => {
        defense = !defense;
        if (defense) adventure = false;
        showKinds();
        this.sound.play('ui');
      };
      root.append(
        h('h2', {}, '🏝️ Make an island'),
        h('h3', {}, 'What kind of island?'),
        grid,
        h('h3', {}, 'How big?'),
        sizes,
        h('h3', {}, 'Its name'),
        h(
          'div',
          { class: 'row name-row' },
          nameBox,
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onclick: () => {
                roll(true);
                this.sound.play('ui');
              },
            },
            '🎲 New name',
          ),
        ),
        h('div', { class: 'setting' }, h('div', {}, h('b', {}, 'Friends can visit'), h('div', { class: 'muted' }, 'Friends join with your island code. Turn off to play alone.')), sw),
        h('div', { class: 'setting' }, h('div', {}, h('b', {}, '⚔️ Adventure'), h('div', { class: 'muted' }, ADVENTURE_ABOUT)), adventureSw),
        h('div', { class: 'setting' }, h('div', {}, h('b', {}, '🗼 Tower defense'), h('div', { class: 'muted' }, DEFENSE_ABOUT)), defenseSw),
        h('div', { class: 'setting' }, h('div', {}, h('b', {}, '👾 Monsters'), h('div', { class: 'muted' }, MONSTERS_ABOUT)), monsterSw),
        h(
          'button',
          {
            class: 'big green',
            type: 'button',
            style: 'margin-top:14px',
            onclick: () => {
              this.closeModal();
              this.handlers.make({ theme, size, name: own || rolled, online, adventure, defense, settings: monsters ? { monsters: true } : null });
            },
          },
          '✨ Make it!',
        ),
      );
    });
  }

  // count boxes of one digit each, like an island code: typing moves on to
  // the next, Backspace back, and a pasted number fills them all. done():
  // Enter in any of them. Returns { row, boxes, value() }.
  digitBoxes(count, prefill, done, label = 'Digit') {
    const boxes = [];
    const row = h('div', { class: 'code-input' });
    for (let i = 0; i < count; i++) {
      const box = h('input', { inputmode: 'numeric', maxlength: 1, pattern: '[0-9]*', autocomplete: 'off', 'aria-label': `${label} ${i + 1}` });
      box.value = prefill[i] ?? '';
      box.addEventListener('input', () => {
        const digits = box.value.replace(/\D/g, '');
        if (digits.length > 1) {
          // Pasted a whole code.
          digits
            .slice(0, count - i)
            .split('')
            .forEach((d, k) => (boxes[i + k].value = d));
          boxes[Math.min(count - 1, i + digits.length)].focus();
          return;
        }
        box.value = digits;
        if (digits && i < count - 1) boxes[i + 1].focus();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
        if (e.key === 'Enter') done();
      });
      boxes.push(box);
      row.append(box);
    }
    return { row, boxes, value: () => boxes.map((b) => b.value).join('') };
  }

  // Type a code, or pick an island from the list of open islands, which
  // keeps up with them while the dialog is open.
  visitDialog(prefill = '') {
    this.openModal(
      (root) => {
        const go = () => {
          const code = digits.value();
          if (code.length !== 6) {
            this.sound.play('no');
            digits.boxes.find((b) => !b.value)?.focus();
            return;
          }
          this.closeModal();
          this.handlers.visit(code);
        };
        const digits = this.digitBoxes(6, prefill, go);
        root.append(
          h('h2', {}, '✈️ Visit a friend'),
          h('p', {}, 'Type the island code your friend gives you.'),
          digits.row,
          h('button', { class: 'big blue', type: 'button', onclick: go }, '🛶 Let’s go!'),
          h('p', { class: 'muted', style: 'margin-top:12px' }, 'Your friend finds the code at the top of their screen.'),
        );
        if (this.handlers.listAvailable?.()) root.append(this.openIslandList());
        this.focusSoon(digits.boxes[prefill.length >= 6 ? 5 : prefill.length], 50);
      },
      { narrow: true },
    );
  }

  // 🌍 Islands open now: anyone's island that friends can visit, the busiest
  // first, asked for again every few seconds while it is on screen.
  openIslandList() {
    const note = h('p', { class: 'muted open-note' }, '🔄 Looking for islands…');
    const list = h('div', { class: 'island-list open-islands' });
    const section = h('div', { class: 'open-section' }, h('h3', {}, '🌍 Islands open now'), note, list);
    const locked = (it) => it.passcode && !this.handlers.visitedBefore(it.code);
    const visit = (it) => {
      if (locked(it)) {
        this.passcodeDialog({ name: it.name }, (typed) => this.handlers.visit(it.code, typed));
        return;
      }
      this.closeModal();
      this.handlers.visit(it.code);
    };
    // Drawn again only when something in it changed: buttons swapped for
    // the same ones would lose a tap made just then.
    let shown = '';
    const draw = (islands) => {
      const now = JSON.stringify(islands);
      if (now === shown) return;
      shown = now;
      note.hidden = islands.length > 0;
      note.textContent = 'No islands are open right now. Make one, and it shows up here for everyone!';
      list.replaceChildren(
        ...islands.map((it) => {
          const full = it.players >= it.max;
          const size = SIZES.find((s) => s.key === it.size)?.name ?? '';
          const who = it.players === 0 ? 'Nobody there right now' : `${it.players} of ${it.max} playing`;
          // The public adventure island's stage (any other adventure island
          // is stage 1, where it goes without saying).
          const stage = it.adventure && (it.public || it.adventure.stage > 1) ? `Stage ${it.adventure.stage} · ` : '';
          const adv = it.adventure
            ? it.adventure.won
              ? '🏆 Freed'
              : `⚔️ ${stage}${it.adventure.freed} of ${it.adventure.camps} camps free`
            : it.defense
              ? it.defense.won
                ? '🏆 Safe'
                : `🗼 Wave ${it.defense.wave} of ${it.defense.waves}`
              : '';
          return h(
            'div',
            { class: 'island-item' },
            h('span', { class: 'emoji' }, it.public ? '🌟' : (THEME_ICON[it.theme] ?? '🏝️')),
            h('div', { class: 'info' }, h('b', { lang: langOf(it.name) || undefined }, it.name), h('span', { class: 'muted' }, [adv, size, who, it.passcode ? '🔒 Passcode' : ''].filter(Boolean).join(' · '))),
            h(
              'button',
              { class: `chip${full ? '' : ' on'}`, type: 'button', disabled: full, 'aria-label': `Visit ${it.name}`, onclick: () => visit(it) },
              full ? 'Full' : locked(it) ? '🔒 Visit' : '🛶 Visit',
            ),
          );
        }),
      );
    };
    let started = false;
    // Again in a few seconds, or in half a minute when it could not be found.
    const ask = async () => {
      if (started && !list.isConnected) return;
      started = true;
      let again = hurried(5000);
      try {
        const islands = await this.handlers.openIslands();
        if (list.isConnected) draw(islands);
      } catch (error) {
        again = 30000;
        if (!list.isConnected) return;
        shown = '';
        list.replaceChildren();
        note.hidden = false;
        if (error?.code === 'bad') note.textContent = '🛠️ The island keeper needs an update before it can show open islands. Ask a grown-up to update it!';
        else if (error?.code === 'asleep' || error?.code === 'refused') note.textContent = '😴 The island keeper is asleep, so there is no list right now. You can still visit with a code!';
        else note.textContent = '😕 The list could not be found right now. You can still visit with a code!';
      }
      if (list.isConnected) setTimeout(ask, again);
    };
    // Once it is in the dialog.
    setTimeout(ask, 0);
    return section;
  }

  // An island with a passcode: four numbers its owner tells you. go(passcode).
  // wrong: the one typed last time was not right. name: the island's.
  passcodeDialog({ wrong = false, name = '' } = {}, go) {
    this.openModal(
      (root) => {
        const done = () => {
          const passcode = digits.value();
          if (passcode.length !== PASSCODE_LENGTH) {
            this.sound.play('no');
            digits.boxes.find((b) => !b.value)?.focus();
            return;
          }
          this.closeModal();
          go(passcode);
        };
        const digits = this.digitBoxes(PASSCODE_LENGTH, '', done, 'Passcode number');
        root.append(
          h('h2', {}, '🔒 Passcode'),
          wrong ? h('p', { class: 'wrong-passcode' }, '🙈 That passcode is not right. Try again!') : null,
          h('p', {}, h('span', { lang: langOf(name) || undefined }, name || 'This island'), ` has a passcode. Type the ${PASSCODE_LENGTH} numbers the island owner tells you.`),
          digits.row,
          h('button', { class: 'big blue', type: 'button', onclick: done }, '🛶 Let’s go!'),
        );
        this.focusSoon(digits.boxes[0], 50);
      },
      { narrow: true },
    );
  }

  // Before the CTB island from the link ?ctb, for someone not logged in: the
  // name they go by there, which they must type (prefill: the one they typed
  // last time on this device). go(name) once it is a name.
  watchNameDialog(prefill, go) {
    this.openModal(
      (root) => {
        const box = h('input', { type: 'text', class: 'text-input name-input', value: prefill, maxLength: NAME_MAX * 2, autocomplete: 'off', placeholder: 'Your name', 'aria-label': 'Your name' });
        box.spellcheck = false;
        const why = h('p', { class: 'muted', 'aria-live': 'polite' });
        const done = () => {
          const name = cleanName(box.value);
          if (!isValidName(name) || [...name].length > NAME_MAX) {
            this.sound.play('no');
            why.textContent = name ? `A name has at most ${NAME_MAX} letters.` : 'Type your name first!';
            box.focus();
            return;
          }
          this.closeModal();
          go(name);
        };
        box.addEventListener('keydown', (e) => e.key === 'Enter' && done());
        root.append(
          h('h2', {}, '🏢 Visit CTB'),
          h('p', {}, 'CTB’s helpers make Kids World better at their desks on the CTB island. What is your name?'),
          box,
          why,
          h('button', { class: 'big blue', type: 'button', onclick: done }, '🛶 Let’s go!'),
        );
        setTimeout(() => box.focus(), 50);
      },
      { narrow: true },
    );
  }

  myIslandsDialog() {
    // Logged in, anything new from your other devices shows up as it comes.
    this.handlers.login?.keeper.resync();
    this.openModal((root) => {
      this.islandList = h('div', { class: 'island-list' });
      this.islandNote = h('p', { class: 'muted island-sync' });
      const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (!f) return;
        try {
          const save = JSON.parse(await f.text());
          this.closeModal();
          this.handlers.openFile(save);
        } catch {
          this.toast('😕', 'That file is not an island.', 'warn');
        }
      });
      root.append(
        h('h2', {}, '📒 My islands'),
        this.islandNote,
        this.islandList,
        h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'chip', type: 'button', onclick: () => file.click() }, '📂 Open an island file'), file),
      );
    });
    this.renderIslandList();
  }

  // The islands in My islands, while it is open: again when some come back
  // from the keeper.
  renderIslandList() {
    const el = this.islandList;
    if (!el?.isConnected) return;
    const keeper = this.handlers.login?.keeper;
    const syncing = Boolean(keeper?.login) && (keeper.state === 'connecting' || keeper.syncing);
    this.islandNote.textContent = syncing ? '🔄 Looking for islands from your other devices…' : '';
    this.islandNote.hidden = !syncing;
    const list = this.handlers.islands();
    el.replaceChildren(
      ...(list.length
        ? list.map((it) =>
            h(
              'div',
              { class: 'island-item' },
              h('span', { class: 'emoji' }, THEME_ICON[it.theme] ?? '🏝️'),
              h('div', { class: 'info' }, h('b', { lang: langOf(it.name) || undefined }, it.name), h('span', { class: 'muted' }, `Played ${new Date(it.savedAt).toLocaleDateString()}`)),
              h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  'aria-label': `Remove ${it.name}`,
                  onclick: () => {
                    this.confirm(`Say goodbye to ${it.name} forever?`, 'Yes, remove it', () => {
                      this.handlers.forget(it.id);
                      this.myIslandsDialog();
                    });
                  },
                },
                '🗑️',
              ),
              h(
                'button',
                {
                  class: 'chip on',
                  type: 'button',
                  onclick: () => {
                    this.closeModal();
                    this.handlers.open(it.id);
                  },
                },
                '▶ Play',
              ),
            ),
          )
        : [h('p', { class: 'muted' }, 'No islands yet. Make one and it will wait for you here!')]),
    );
  }

  // The island a visitor was on has gone quiet (the friend closed it, or the internet dropped).
  islandGone(goHome) {
    if (this.modalOpen) return;
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '😴 The island is sleeping'),
          h('p', {}, 'Your friend’s island is closed right now, or the internet is taking a nap. We will keep trying to get back in.'),
          h(
            'div',
            { class: 'row', style: 'margin-top:14px' },
            h('button', { class: 'chip', type: 'button', onclick: () => this.closeModal() }, '⏳ Keep waiting'),
            h(
              'button',
              {
                class: 'chip on',
                type: 'button',
                onclick: () => {
                  this.closeModal();
                  goHome();
                },
              },
              '🏠 Go home',
            ),
          ),
        );
      },
      { narrow: true },
    );
  }

  confirm(text, yes, fn) {
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '🤔 Are you sure?'),
          h('p', {}, text),
          h(
            'div',
            { class: 'row', style: 'margin-top:14px' },
            h('button', { class: 'chip', type: 'button', onclick: () => this.closeModal() }, 'No'),
            h(
              'button',
              {
                class: 'chip on',
                type: 'button',
                onclick: () => {
                  this.closeModal();
                  fn();
                },
              },
              yes,
            ),
          ),
        );
      },
      { narrow: true },
    );
  }

  // Changing how you look: a kid (skin and hair) or an animal (fur), t-shirt,
  // hat, and your display name, the name friends see: typed, rolled, or,
  // logged in, your username.
  meDialog() {
    const p = this.profile;
    const look = { ...p.look };
    let name = p.name;
    const username = this.handlers.login?.username() ?? '';
    let same = null;
    const apply = () => {
      p.update({ look: { ...look }, name });
      this.handlers.lookChanged?.();
      $('me-name').textContent = `Hi, ${name}!`;
      if (same) same.checked = name === username;
    };
    this.openModal(
      (root) => {
        // Any name; while what is typed is no name (nothing yet), the last one stays.
        const nameBox = h('input', { type: 'text', class: 'text-input name-input', value: name, maxLength: NAME_MAX * 2, autocomplete: 'off', 'aria-label': 'Display name' });
        nameBox.spellcheck = false;
        nameBox.addEventListener('input', () => {
          const typed = cleanName(nameBox.value);
          if (!isValidName(typed) || [...typed].length > NAME_MAX || typed === name) return;
          name = typed;
          apply();
        });
        nameBox.addEventListener('change', () => (nameBox.value = name));
        // Logged in: the display name can be the username, and stays it while this is on.
        if (username) {
          same = h('input', { type: 'checkbox', checked: name === username });
          same.addEventListener('change', () => {
            if (!same.checked) {
              nameBox.focus();
              nameBox.select();
              return;
            }
            name = username;
            nameBox.value = name;
            this.sound.play('ui');
            apply();
          });
        }
        const animals = h('div', { class: 'grid' });
        // An animal's fur, or a kid's skin and hair.
        const parts = h('div', { class: 'look-parts' });
        const shirts = h('div', { class: 'swatches' });
        const hats = h('div', { class: 'grid' });
        const choose = (change) => {
          change();
          this.sound.play('ui');
          apply();
          draw();
        };
        const swatches = (colors, chosen, set) =>
          h(
            'div',
            { class: 'swatches' },
            ...Object.entries(colors).map(([key, color]) =>
              h('button', { class: `swatch${key === chosen ? ' on' : ''}`, type: 'button', style: `background:${color}`, 'aria-label': key, onclick: () => choose(() => set(key)) }),
            ),
          );
        const draw = () => {
          animals.replaceChildren(
            ...ANIMALS.map((a) =>
              h(
                'button',
                {
                  class: `choice${a.key === look.animal ? ' on' : ''}`,
                  type: 'button',
                  // A kid or a grown-up keeps the skin and hair last chosen; an animal comes in its own fur.
                  onclick: () => choose(() => Object.assign(look, isPerson({ animal: a.key }) ? cleanLook({ ...look, animal: a.key }) : { animal: a.key, fur: a.fur })),
                },
                h('span', { class: 'emoji' }, a.key === look.animal ? lookIcon(look) : a.icon),
                a.name,
              ),
            ),
          );
          if (isPerson(look)) {
            parts.replaceChildren(
              h('h3', {}, 'Skin'),
              swatches(SKIN_TONES, look.skin, (key) => (look.skin = key)),
              h('h3', {}, 'Hair'),
              h(
                'div',
                { class: 'grid' },
                ...HAIRS.map((style) =>
                  h(
                    'button',
                    { class: `choice${style.key === look.hair ? ' on' : ''}`, type: 'button', onclick: () => choose(() => (look.hair = style.key)) },
                    hairIcon(style.key, SKIN_TONES[look.skin], HAIR_COLORS[look.hairColor]),
                    style.name,
                  ),
                ),
              ),
              h('h3', {}, 'Hair colour'),
              swatches(HAIR_COLORS, look.hairColor, (key) => (look.hairColor = key)),
              ...(look.animal === GROWN_UP
                ? [
                    h('h3', {}, 'Face'),
                    h(
                      'div',
                      { class: 'grid' },
                      ...FACES.map((f) =>
                        h(
                          'button',
                          { class: `choice${f.key === look.face ? ' on' : ''}`, type: 'button', onclick: () => choose(() => (look.face = f.key)) },
                          hairIcon(look.hair, SKIN_TONES[look.skin], HAIR_COLORS[look.hairColor], f.key),
                          f.name,
                        ),
                      ),
                    ),
                  ]
                : []),
            );
          } else {
            parts.replaceChildren(h('h3', {}, 'Fur colour'), swatches(FUR_COLORS, look.fur, (key) => (look.fur = key)));
          }
          shirts.replaceChildren(
            ...SHIRT_COLORS.map((i) =>
              h('button', {
                class: `swatch${i === look.shirt ? ' on' : ''}`,
                type: 'button',
                style: `background:${shirtColor(i)}`,
                'aria-label': B.BRICK_COLORS[i][1],
                onclick: () => {
                  look.shirt = i;
                  this.sound.play('ui');
                  apply();
                  draw();
                },
              }),
            ),
          );
          hats.replaceChildren(
            ...HATS.map((hat) =>
              h(
                'button',
                {
                  class: `choice${hat.key === look.hat ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => {
                    look.hat = hat.key;
                    this.sound.play('ui');
                    apply();
                    draw();
                  },
                },
                h('span', { class: 'emoji' }, hat.icon),
                hat.name,
              ),
            ),
          );
        };
        draw();
        root.append(
          h('h2', {}, '🎨 Change me'),
          h('h3', { class: 'name-label' }, 'Display name ', h('span', { class: 'muted' }, '(what friends see)')),
          h('div', { class: 'row name-row' }, nameBox, h('button', { class: 'chip', type: 'button', onclick: () => {
            name = randomName();
            nameBox.value = name;
            this.sound.play('ui');
            apply();
          } }, '🎲 New name')),
          same ? h('label', { class: 'check-row same-row' }, same, h('span', {}, `Same as my username, ${username}`)) : '',
          h('h3', {}, 'I am a…'),
          animals,
          parts,
          h('h3', {}, 'T-shirt'),
          shirts,
          h('h3', {}, 'Hat'),
          hats,
          h('button', { class: 'big green', type: 'button', style: 'margin-top:16px', onclick: () => this.closeModal() }, '👍 Done'),
        );
      },
      { seeThrough: true, pose: true, onClose: () => this.handlers.lookDone?.() },
    );
    this.handlers.lookOpen?.();
  }

  // Your pet: which kind (or none), its coat and its name. It comes along to
  // every island you go to, and sits in front of you, to be seen, while you
  // choose.
  petDialog() {
    const p = this.profile;
    let pet = p.look.pet ? { ...p.look.pet } : null;
    const apply = () => {
      const { pet: _, ...look } = p.look;
      p.update({ look: pet ? { ...look, pet: { ...pet } } : look });
      this.handlers.lookChanged?.();
    };
    this.openModal(
      (root) => {
        const kinds = h('div', { class: 'grid' });
        const coats = h('div', { class: 'swatches' });
        // Any name; while what is typed is no name (nothing yet), the last one stays.
        const nameBox = h('input', { type: 'text', class: 'text-input name-input', maxLength: NAME_MAX * 2, autocomplete: 'off', 'aria-label': "Your pet's name" });
        nameBox.spellcheck = false;
        nameBox.addEventListener('input', () => {
          const typed = cleanName(nameBox.value);
          if (!pet || !isValidName(typed) || [...typed].length > NAME_MAX || typed === pet.name) return;
          pet.name = typed;
          apply();
        });
        nameBox.addEventListener('change', () => (nameBox.value = pet?.name ?? ''));
        const roll = h('button', { class: 'chip', type: 'button', onclick: () => {
          if (!pet) return;
          pet.name = randomPetName(pet.kind, Math.random, pet.name);
          nameBox.value = pet.name;
          this.sound.play('ui');
          apply();
        } }, '🎲 New name');
        const details = h('div', { class: 'pet-details' });
        const choose = (key) => {
          if (key && key !== pet?.kind) {
            const kind = petKind(key);
            // A name of its own kind's for a new kind, unless you typed one.
            const typed = pet && !petKind(pet.kind).names.includes(pet.name);
            pet = { kind: key, coat: kind.coats.includes(pet?.coat) ? pet.coat : kind.coats[0], name: typed ? pet.name : randomPetName(key) };
            this.profile.count('adopted', 1, { max: true });
            this.sound.play(key);
          } else if (!key) {
            pet = null;
            this.sound.play('ui');
          }
          apply();
          draw();
        };
        const draw = () => {
          kinds.replaceChildren(
            ...PETS.map((k) => h('button', { class: `choice${k.key === pet?.kind ? ' on' : ''}`, type: 'button', onclick: () => choose(k.key) }, h('span', { class: 'emoji' }, k.icon), k.name)),
            h('button', { class: `choice${pet ? '' : ' on'}`, type: 'button', onclick: () => choose(null) }, h('span', { class: 'emoji' }, '🚫'), 'No pet'),
          );
          details.hidden = !pet;
          if (!pet) return;
          nameBox.value = pet.name;
          coats.replaceChildren(
            ...petKind(pet.kind).coats.map((key) =>
              h('button', {
                class: `swatch${key === pet.coat ? ' on' : ''}`,
                type: 'button',
                style: `background:${PET_COATS[key]}`,
                'aria-label': key,
                onclick: () => {
                  pet.coat = key;
                  this.sound.play('ui');
                  apply();
                  draw();
                },
              }),
            ),
          );
        };
        details.append(h('h3', {}, 'Colour'), coats, h('h3', { class: 'name-label' }, 'Name'), h('div', { class: 'row name-row' }, nameBox, roll));
        draw();
        root.append(
          h('h2', {}, '🐾 My pet'),
          h('p', { class: 'muted' }, 'Your pet comes along to every island, and friends see it too.'),
          kinds,
          details,
          h('button', { class: 'big green', type: 'button', style: 'margin-top:16px', onclick: () => this.closeModal() }, '👍 Done'),
        );
      },
      { seeThrough: true, pose: true, onClose: () => this.handlers.lookDone?.() },
    );
    this.handlers.lookOpen?.();
  }

  stickersDialog() {
    const p = this.profile;
    const got = p.data.stickers;
    // On the shared isle, these are the isle's own, apart from yours
    // everywhere else: said so, and ranked on boards of their own.
    const isle = p === this.isle;
    this.openModal((root) => {
      const count = STICKERS.filter((s) => got[s.key]).length;
      const ranking = this.handlers?.login?.available() ? h('button', { class: 'chip', type: 'button', onclick: () => this.rankingDialog(isle ? 'isle' : 'home') }, '🏆 Ranking') : null;
      const { xp, level, into, need } = p.progress;
      root.append(
        h(
          'div',
          { class: 'level-card' },
          h('b', { class: 'level-big' }, `⭐ Level ${level}`),
          h('div', { class: 'level-bar wide', role: 'img', 'aria-label': need ? `${into} of ${need} XP` : 'Full' }, h('span', { style: `width:${need ? Math.floor((100 * into) / need) : 100}%` })),
          h('span', { class: 'muted' }, need ? `${xp.toLocaleString()} XP · ${(need - into).toLocaleString()} more to level ${level + 1}` : `${xp.toLocaleString()} XP · the top level!`),
          h('span', { class: 'muted' }, `Everything you do earns XP: building, finding treasures, petting animals, riding, exploring and popping monsters, and every sticker is ${STICKER_XP} more.`),
          isle ? h('span', { class: 'muted' }, 'Adventure Isle is a world of its own: this XP, this level and these stickers are the isle’s, kept apart from yours everywhere else — and kept at the island keeper with a ranking of their own.') : null,
        ),
        h('div', { class: 'dialog-head' }, h('h2', {}, `⭐ My stickers (${count} of ${STICKERS.length})`), ranking, h('button', { class: 'chip', type: 'button', onclick: () => this.shopDialog() }, '🛒 Shop'), h('button', { class: 'chip', type: 'button', onclick: () => this.backpackDialog() }, '🎒 Backpack'), h('button', { class: 'chip', type: 'button', onclick: () => this.galleryDialog() }, '🖼️ My gallery')),
        h(
          'div',
          { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(120px,1fr))' },
          ...STICKERS.map((s) =>
            h('div', { class: `sticker-card${got[s.key] ? '' : ' locked'}` }, h('span', { class: 'emoji' }, s.icon), h('b', {}, got[s.key] ? s.name : '???'), h('span', { class: 'muted' }, s.text)),
          ),
        ),
      );
    });
  }

  // The shop: sell what is in your basket for coins, and buy running shoes,
  // flying gear, roller skates, toy weapons, clothes and HP potions with them (shop.js).
  // Redrawn as your basket changes, so what you find while it is open shows
  // up to sell.
  shopDialog() {
    const p = this.profile;
    let onBasket = null;
    this.openModal(
      (root) => {
        const coins = h('span', { class: 'coins', 'aria-label': 'Your coins' });
        const sell = h('div', { class: 'grid shop-grid' });
        const gear = h('div', { class: 'grid shop-grid gear-grid' });
        const potions = h('div', { class: 'grid shop-grid' });
        const clothes = h('div', { class: 'grid shop-grid gear-grid' });
        const seeds = h('div', { class: 'grid shop-grid' });
        // Nothing is planted on the shared isle: no vegetables for sale there.
        const farming = p !== this.isle;
        const button = (text, onclick, disabled = false) => h('button', { class: 'chip', type: 'button', disabled, onclick }, text);
        // Weapons wear out as they bop (shop.js usesLeft): any worn one
        // fixed as good as new, for less than it cost.
        const fixes = () => {
          const worn = WEAPONS.slice(0, p.data.gear.weapon).filter((w) => fixPrice(p.data.gear, w));
          if (!worn.length) return null;
          return h(
            'div',
            { class: 'shop-buttons' },
            ...worn.map((w) => {
              const price = fixPrice(p.data.gear, w);
              const broken = isBroken(p.data.gear, w);
              return button(
                `🔧 Fix ${w.icon} ${broken ? '(broken)' : `(${usesLeft(p.data.gear, w)}/${w.uses})`} 🪙 ${price}`,
                () => {
                  if (!p.fixWeapon(w.key)) {
                    this.sound.play('no');
                    return;
                  }
                  this.sound.play('fanfare');
                  this.toast(w.icon, `Your ${w.name} is as good as new!`);
                },
                p.data.coins < price,
              );
            }),
          );
        };
        const draw = () => {
          coins.textContent = `🪙 ${p.data.coins.toLocaleString()}`;
          const b = p.basket;
          const have = B.COLLECTABLES.filter((c) => b[c.key] > 0);
          sell.replaceChildren(
            ...(have.length
              ? have.map((c) => {
                  const price = sellPrice(c.key);
                  const n = b[c.key];
                  const sold = (count) => () => {
                    if (!p.sell(c.key, count)) return;
                    this.sound.play('collect');
                    this.toast('🪙', `Sold ${count === 1 ? withArticle(c.name.toLowerCase()) : `${count} ${c.plural.toLowerCase()}`} for ${price * count} ${price * count === 1 ? 'coin' : 'coins'}!`);
                  };
                  return h(
                    'div',
                    { class: 'shop-card' },
                    this.img(c.item, c.name),
                    h('b', {}, `${c.name} × ${n}`),
                    h('span', { class: 'muted' }, `🪙 ${price} each`),
                    h('div', { class: 'shop-buttons' }, button('Sell 1', sold(1)), n > 1 ? button(`Sell all (🪙 ${price * n})`, sold(n)) : null),
                  );
                })
              : [h('p', { class: 'muted shop-empty' }, 'Your basket is empty. Pick fruit, grow vegetables, find seashells and star pieces, and dig up jewels, then sell them here!')]),
          );
          gear.replaceChildren(
            ...GEAR.map((g) => {
              const level = p.data.gear[g.key];
              const owned = level ? g.levels[level - 1] : null;
              const next = nextLevel(p.data.gear, g.key);
              const buy = () => {
                if (!p.buy(g.key)) {
                  this.sound.play('no');
                  return;
                }
                this.sound.play('fanfare');
                const now = { shoes: "You're running faster now.", wings: "You're flying faster now.", skates: 'Push off and glide! They go on in place of your shoes.', weapon: 'Walk up to a monster and bop it with the button (or X)!' }[g.key];
                this.toast(next.icon, `You got the ${next.name}! ${now}`);
              };
              return h(
                'div',
                { class: `shop-card gear${owned ? '' : ' locked'}` },
                h('span', { class: 'emoji' }, owned ? owned.icon : g.levels[0].icon),
                h('b', {}, owned ? owned.name : g.name),
                h('span', { class: 'muted' }, owned ? (owned.does ?? `${levelDoes(owned)} ${g.about}`) : g.about),
                next ? h('span', { class: 'muted' }, `${owned ? 'Next' : 'First'}: ${next.icon} ${levelDoes(next)}`) : null,
                h(
                  'div',
                  { class: 'shop-buttons' },
                  next
                    ? button(`${owned ? 'Upgrade to' : 'Buy'} ${next.icon} ${next.name} (🪙 ${next.price})`, buy, p.data.coins < next.price)
                    : h('span', { class: 'muted' }, '🏅 The best there is!'),
                ),
                next && p.data.coins < next.price ? h('span', { class: 'muted' }, `${next.price - p.data.coins} more coins to go!`) : null,
                g.key === 'weapon' ? fixes() : null,
              );
            }),
          );
          // Clothes: any of them, in any order, one on at a time; some just
          // for looks, some with a power while you have them on.
          clothes.replaceChildren(
            ...CLOTHES.map((c) => {
              const owned = p.data.gear.clothes.includes(c.key);
              return h(
                'div',
                { class: `shop-card gear${owned ? '' : ' locked'}` },
                h('span', { class: 'emoji' }, c.icon),
                h('b', {}, c.name),
                h('span', { class: 'muted' }, `${c.power ? '✨ ' : ''}${c.does}`),
                h(
                  'div',
                  { class: 'shop-buttons' },
                  owned
                    ? h('span', { class: 'muted' }, '✅ In your 🎒 backpack')
                    : button(`Buy ${c.icon} (🪙 ${c.price})`, () => {
                        if (!p.buyClothes(c.key)) {
                          this.sound.play('no');
                          return;
                        }
                        this.sound.play('fanfare');
                        this.toast(c.icon, `You got the ${c.name}! You're wearing it now${c.power ? ` — ${c.does.charAt(0).toLowerCase()}${c.does.slice(1)}` : '.'}`);
                      }, p.data.coins < c.price),
                ),
                !owned && p.data.coins < c.price ? h('span', { class: 'muted' }, `${c.price - p.data.coins} more coins to go!`) : null,
              );
            }),
          );
          potions.replaceChildren(
            h(
              'div',
              { class: 'shop-card gear' },
              h('span', { class: 'emoji' }, POTION.icon),
              h('b', {}, POTION.name),
              h('span', { class: 'muted' }, POTION.does),
              h('span', { class: 'muted' }, p.data.potions > 0 ? `You have ${p.data.potions} ${p.data.potions === 1 ? 'potion' : 'potions'} to drink.` : 'Drink one with the 🧪 button by your HP, or with Y.'),
              h(
                'div',
                { class: 'shop-buttons' },
                button(`Buy one (🪙 ${POTION.price})`, () => {
                  if (!p.buyPotion()) {
                    this.sound.play('no');
                    return;
                  }
                  this.sound.play('collect');
                  this.toast(POTION.icon, `You got an HP Potion! ${p.data.potions} to drink now.`);
                }, p.data.coins < POTION.price),
                button(`Buy 5 (🪙 ${POTION.price * 5})`, () => {
                  if (!p.buyPotion(5)) {
                    this.sound.play('no');
                    return;
                  }
                  this.sound.play('collect');
                  this.toast(POTION.icon, `Five HP Potions! ${p.data.potions} to drink now.`);
                }, p.data.coins < POTION.price * 5 || p.data.potions > 994),
              ),
              p.data.coins < POTION.price ? h('span', { class: 'muted' }, `${POTION.price - p.data.coins} more coins to go!`) : null,
            ),
          );
          if (farming) {
            seeds.replaceChildren(
              ...B.COLLECTABLES.filter((c) => seedPrice(c.key)).map((c) => {
                const price = seedPrice(c.key);
                const crop = B.cropByKey(c.key);
                return h(
                  'div',
                  { class: 'shop-card' },
                  this.img(c.item, c.name),
                  h('b', {}, `${SEED_PACK} ${c.plural}`),
                  h('span', { class: 'muted' }, `${crop.regrows ? 'Grows back after picking.' : 'Plant again after picking.'} Sells for 🪙 ${sellPrice(c.key)} each.`),
                  h(
                    'div',
                    { class: 'shop-buttons' },
                    button(`Buy ${SEED_PACK} (🪙 ${price})`, () => {
                      if (!p.buySeeds(c.key)) {
                        this.sound.play('no');
                        return;
                      }
                      this.sound.play('collect');
                      this.toast(crop.icon, `${SEED_PACK} ${c.plural.toLowerCase()} in your basket! Tap one there, then tap the ground to plant it.`);
                    }, p.data.coins < price),
                  ),
                );
              }),
            );
          }
        };
        // append() writes a null out as "null": only what is there.
        root.append(
          ...[
            h('div', { class: 'dialog-head' }, h('h2', {}, '🛒 Shop'), coins, h('button', { class: 'chip', type: 'button', onclick: () => this.backpackDialog() }, '🎒 Backpack')),
            p === this.isle ? h('p', { class: 'muted' }, 'Adventure Isle is a world of its own: these coins, these treasures, potions and gear are the isle’s, apart from yours everywhere else.') : null,
            h('p', { class: 'muted' }, 'What you buy goes in your 🎒 backpack, and on you straight away: put things on and take them off there.'),
            h('h3', {}, 'Sell your treasures'),
            sell,
            h('h3', {}, 'Gear'),
            gear,
            h('h3', {}, '👕 Clothes'),
            h('p', { class: 'muted' }, 'Worn one at a time over your t-shirt: friends see it on you. The ✨ ones give you a power while you have them on.'),
            clothes,
            h('h3', {}, '🧪 Potions'),
            potions,
            farming ? h('h3', {}, '🌱 Vegetables to plant') : null,
            farming ? h('p', { class: 'muted' }, 'Plant them on farmland (or grass) and water them: every ripe one you pick gives you two!') : null,
            farming ? seeds : null,
          ].filter(Boolean),
        );
        draw();
        onBasket = draw;
        p.addEventListener('basket', onBasket);
      },
      { onClose: () => p.removeEventListener('basket', onBasket) },
    );
  }

  // Your backpack: everything you have bought in the shop, to put on and
  // take off — running shoes, flying gear, roller skates, which toy weapon is in your hand,
  // clothes — and your HP potions, to drink on an island. Redrawn as what
  // you have changes (N on the island, a potion drunk, the shop).
  backpackDialog() {
    const p = this.profile;
    let onChange = null;
    this.openModal(
      (root) => {
        const list = h('div', { class: 'grid shop-grid gear-grid' });
        const button = (text, onclick) => h('button', { class: 'chip', type: 'button', onclick }, text);
        const card = (icon, name, does, on, action) =>
          h('div', { class: 'shop-card gear' }, h('span', { class: 'emoji' }, icon), h('b', {}, `${name}${on ? ' ✅' : ''}`), h('span', { class: 'muted' }, does), h('div', { class: 'shop-buttons' }, action));
        const tap = (text, change) =>
          button(text, () => {
            change();
            this.sound.play('ui');
          });
        const draw = () => {
          const gear = p.data.gear;
          const cards = [];
          for (const g of GEAR) {
            const level = gear[g.key];
            if (!level) continue;
            if (g.key === 'weapon') {
              // Any of the weapons you own can be the one in your hand; on
              // the island, N (or the button by the bop button) flips
              // through them too.
              const held = wornWeapon(gear);
              // A broken one waits for the shop to fix it.
              WEAPONS.slice(0, level).forEach((w, i) => {
                const on = held?.key === w.key;
                const left = usesLeft(gear, w);
                const does = left ? `${w.does} 💪 ${left} of ${w.uses} bops left.` : `💔 Broken! Fix it in the 🛒 shop.`;
                const action = !left ? null : on ? tap('🙌 Put away', () => p.wear('weapon', false)) : tap('✋ Hold it', () => p.pickWeapon(i + 1));
                cards.push(card(w.icon, w.name, does, on, action));
              });
              continue;
            }
            const owned = g.levels[level - 1];
            const on = wearing(gear, g.key) > 0;
            cards.push(card(owned.icon, owned.name, `${levelDoes(owned)} ${g.about}`, on, tap(on ? '🙌 Take off' : '👕 Put on', () => p.wear(g.key, !on))));
          }
          for (const c of CLOTHES) {
            if (!gear.clothes.includes(c.key)) continue;
            const on = gear.outfit === c.key;
            cards.push(card(c.icon, c.name, `${c.power ? '✨ ' : ''}${c.does}`, on, tap(on ? '🙌 Take off' : '👕 Put on', () => p.putOn(on ? '' : c.key))));
          }
          if (p.data.potions > 0) {
            const game = this.game?.world ? this.game : null;
            cards.push(card(POTION.icon, `${POTION.name} × ${p.data.potions}`, POTION.does, false, game ? button('😋 Drink one', () => game.drink()) : h('span', { class: 'muted' }, 'Drink one on an island.')));
          }
          // The capsule toys you have from gashapon machines, most rare first.
          const have = TOYS.filter((t) => (gear.toys[t.key] ?? 0) > 0).sort((a, b) => b.rare - a.rare);
          const empty = have.length || MONSTER_FIGURES.some((t) => (gear.toys[t.key] ?? 0) > 0)
            ? 'Nothing from the 🛒 shop in here yet: sell treasures from your basket there, and buy shoes, wings, toy weapons, clothes and potions!'
            : 'Your backpack is empty. Sell treasures from your basket in the 🛒 shop, and buy shoes, wings, toy weapons, clothes and potions: they all go in here!';
          list.replaceChildren(...(cards.length ? cards : [h('p', { class: 'muted shop-empty' }, empty)]));
          toysHead.textContent = `🎁 Capsule toys (${have.length} of ${TOYS.length})`;
          toys.replaceChildren(
            ...(have.length ? have.map((t) => this.toyCard(t, gear.toys[t.key])) : [h('p', { class: 'muted shop-empty' }, 'No capsule toys yet. Turn a 🎁 gashapon machine for one: you find them in the toy box\'s 🛋️ Home tab and at the 🕹️ Video Arcade.')]),
          );
          // And the monster figures, from the Monster Gashapon.
          const figs = MONSTER_FIGURES.filter((t) => (gear.toys[t.key] ?? 0) > 0).sort((a, b) => b.rare - a.rare);
          figsHead.textContent = `👾 Monster figures (${figs.length} of ${MONSTER_FIGURES.length})`;
          monsterFigs.replaceChildren(
            ...(figs.length ? figs.map((t) => this.toyCard(t, gear.toys[t.key])) : [h('p', { class: 'muted shop-empty' }, 'No monster figures yet. On an adventure island a 👾 Monster Gashapon turns up now and then: follow its beam of light to it!')]),
          );
        };
        const toysHead = h('h3', { class: 'backpack-toys-head' });
        const toys = h('div', { class: 'gasha-toys backpack-toys' });
        const figsHead = h('h3', { class: 'backpack-toys-head' });
        const monsterFigs = h('div', { class: 'gasha-toys backpack-toys backpack-figures' });
        this.loadToyPictures(() => {
          if (this.modalOpen && toys.isConnected) draw();
        });
        root.append(
          ...[
            h('div', { class: 'dialog-head' }, h('h2', {}, '🎒 Backpack'), h('button', { class: 'chip', type: 'button', onclick: () => this.shopDialog() }, '🛒 Shop')),
            p === this.isle ? h('p', { class: 'muted' }, 'This is Adventure Isle’s backpack: what you bought on the isle, apart from your things everywhere else.') : null,
            h('p', { class: 'muted' }, 'Put on what you like and see how you look: friends see it on you too. One set of clothes at a time, and one toy weapon in your hand.'),
            list,
            toysHead,
            toys,
            figsHead,
            monsterFigs,
          ].filter(Boolean),
        );
        draw();
        onChange = draw;
        p.addEventListener('basket', onChange);
      },
      // See-through, the camera turned to you as in "Change me", so each
      // thing put on or taken off shows on you (main.js sendGear).
      {
        seeThrough: true,
        pose: true,
        onClose: () => {
          p.removeEventListener('basket', onChange);
          this.handlers.lookDone?.();
        },
      },
    );
    this.handlers.lookOpen?.();
  }

  // The ranking of the players with a login, from the island keeper, live:
  // a tab for each board, its top players and your own place, redrawn as
  // the keeper tells of changes (a score that changed pops). Logged in, you
  // can leave it, or join it again; as the guest, logging in puts you in it.
  // Adventure Isle has a ranking of its own beside the other one (ranking.js
  // ISLE_BOARDS), from the isle's own world of each player: on the isle, the
  // isle's boards are what it opens with.
  rankingDialog(world = null) {
    const keeper = this.handlers?.login?.keeper;
    if (!keeper) return;
    let on = world === 'isle' || world === 'home' ? world : this.lastRankingWorld ?? (this.profile === this.isle ? 'isle' : 'home');
    let boards = boardsOf(on);
    let current = boards.some((b) => b.key === this.lastBoard) ? this.lastBoard : boards[0].key;
    let onNews = null;
    let onStatus = null;
    this.openModal(
      (root) => {
        const worldRow = h('div', { class: 'tabs ranking-tabs' });
        const tabRow = h('div', { class: 'tabs ranking-tabs' });
        const note = this.loginNote();
        const list = h('ol', { class: 'ranking' });
        const aboutText = h('span');
        const live = h('span', { class: 'live', hidden: true, title: 'Changes show up here as they happen' }, 'Live');
        const about = h('p', { class: 'muted rank-about' }, aboutText, live);
        const foot = h('div', { class: 'ranking-foot' });
        const isLive = () => keeper.watching && keeper.rankingLive && keeper.state === 'ready';
        // The scores last drawn on the board last drawn, by name: one that changed pops.
        let drawn = { key: '', scores: new Map() };
        const row = (e, changed) =>
          h(
            'li',
            { class: `rank-row${e.you ? ' you' : ''}` },
            h('span', { class: 'place', 'aria-label': `Number ${e.rank}` }, MEDALS[e.rank] ?? String(e.rank)),
            h('span', { class: 'avatar', style: `--c:${shirtColor(e.look?.shirt)}`, 'aria-hidden': 'true' }, lookIcon(e.look)),
            h('b', { class: 'who', lang: langOf(e.name) || undefined }, levelTag(e.look), e.name, e.you ? h('span', { class: 'muted' }, ' (you)') : null),
            h('span', { class: `score${changed ? ' bump' : ''}` }, Number(e.score).toLocaleString()),
          );
        const drawWorlds = () => {
          worldRow.replaceChildren(
            ...RANKING_WORLDS.map((w) =>
              h(
                'button',
                {
                  class: `chip${w.key === on ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => switchTo(w.key),
                },
                h('span', { class: 'emoji' }, w.icon),
                h('span', {}, w.name),
              ),
            ),
          );
        };
        // The boards of the world being looked at, made anew when it changes
        // (a tap on one is never lost to the keeper's news redrawing them).
        let tabs = [];
        const makeTabs = () => {
          tabRow.replaceChildren(
            ...(tabs = boards.map((b) =>
              h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  onclick: () => {
                    current = b.key;
                    this.sound.play('ui');
                    draw();
                  },
                },
                h('span', { class: 'emoji' }, b.icon),
                h('span', {}, b.name),
              ),
            )),
          );
        };
        const switchTo = (w) => {
          if (w === on) return;
          on = w;
          this.lastRankingWorld = w;
          boards = boardsOf(w);
          if (!boards.some((b) => b.key === current)) current = boards[0].key;
          this.ranking = null;
          drawn = { key: '', scores: new Map() };
          drawWorlds();
          makeTabs();
          draw();
          note.say('🔎', 'Asking the island keeper…');
          keeper.unwatchRanking();
          ask(w);
        };
        const draw = () => {
          this.lastBoard = current;
          boards.forEach((b, i) => tabs[i].classList.toggle('on', b.key === current));
          const board = boards.find((b) => b.key === current);
          const reply = this.ranking;
          const shown = reply?.boards?.find((b) => b.key === current);
          aboutText.textContent = board.text;
          live.hidden = !isLive();
          if (!shown) {
            list.replaceChildren();
            return;
          }
          const top = Array.isArray(shown.top) ? shown.top : [];
          const mine = on === 'isle' && this.isle ? { name: this.profile.name, look: this.isle.shownLook } : { name: this.profile.name, look: this.profile.shownLook };
          const you = shown.you && top.length && !top.some((e) => e.you) ? { ...shown.you, ...mine, you: true } : null;
          const before = drawn.key === current ? drawn.scores : null;
          const changed = (e) => Boolean(before) && before.get(e.name) !== e.score;
          drawn = { key: current, scores: new Map([...top, ...(you ? [you] : [])].map((e) => [e.name, e.score])) };
          if (!top.length) list.replaceChildren(h('li', { class: 'rank-empty muted' }, `Nobody yet. ${board.hint} to be the first!`));
          else list.replaceChildren(...top.map((e) => row(e, changed(e))), you ? h('li', { class: 'rank-gap', 'aria-hidden': 'true' }, '⋯') : '', you ? row(you, changed(you)) : '');
          const hint = keeper.login && reply.shown !== false && !shown.you && top.length ? h('p', { class: 'muted' }, `${board.hint} to be on this board too!`) : '';
          const players = reply.players ? ` ${reply.players} ${reply.players === 1 ? 'player is' : 'players are'} in it now.` : '';
          if (keeper.login) {
            const box = h('input', { type: 'checkbox', checked: reply.shown !== false });
            box.addEventListener('change', async () => {
              box.disabled = true;
              note.say('🔎', 'Asking the island keeper…');
              try {
                // The keeper's news of it redraws all this.
                await keeper.setRanked(box.checked);
                this.sound.play('ui');
                note.say('', '');
              } catch (error) {
                box.checked = !box.checked;
                box.disabled = false;
                note.say(...rankingTrouble(error), 'warn');
              }
            });
            foot.replaceChildren(
              hint,
              h('label', { class: 'check-row' }, box, h('span', {}, 'Show me in the ranking')),
              h('p', { class: 'muted' }, reply.shown === false ? 'You are not in the ranking: nobody sees your name here.' : `Everyone sees your display name, ${this.profile.name}, and how you look.${players}`),
            );
          } else {
            foot.replaceChildren(h('p', { class: 'muted' }, `Players with a login are in the ranking.${players} Log in with 🔑 on the title screen to be in it too!`));
          }
        };
        onNews = (e) => {
          if (e.detail.world !== on) return;
          this.ranking = e.detail;
          note.say('', '');
          if (list.isConnected) draw();
        };
        onStatus = () => {
          if (list.isConnected) live.hidden = !isLive();
        };
        const ask = (w) =>
          keeper.watchRanking(w).then(() => {
            if (!list.isConnected) return;
            // A keeper from before this world's boards answers with the
            // other world's: it says so here, and in its terminal.
            if (!keeper.rankingLive) note.say('🛠️', 'The island keeper needs an update before it can show this ranking. Ask a grown-up to update it!');
          }).catch((error) => {
            if (list.isConnected) note.say(...rankingTrouble(error), 'warn');
          });
        keeper.addEventListener('ranking', onNews);
        keeper.addEventListener('status', onStatus);
        root.append(h('h2', {}, '🏆 Ranking'), worldRow, tabRow, about, h('div', { class: 'rank-note' }, note), list, foot);
        drawWorlds();
        makeTabs();
        draw();
        note.say('🔎', 'Asking the island keeper…');
        ask(on);
      },
      {
        onClose: () => {
          keeper.removeEventListener('ranking', onNews);
          keeper.removeEventListener('status', onStatus);
          keeper.unwatchRanking();
        },
      },
    );
  }

  // 👫 Players: everyone else with a login, who is playing now first, from
  // the island keeper, asked for again every few seconds while it is open.
  // On an island friends can visit, 💌 Invite asks one who is playing now to
  // come. Logged in, you can leave the list; nobody can invite you then.
  playersDialog() {
    const keeper = this.handlers?.login?.keeper;
    if (!keeper) return;
    this.invitedAt ??= new Map();
    this.openModal(
      (root) => {
        const g = this.game;
        const note = this.loginNote();
        const about = h('p', { class: 'muted' });
        const list = h('div', { class: 'island-list players' });
        const foot = h('div', { class: 'ranking-foot' });
        root.append(h('h2', {}, '👫 Players'), about, h('div', { class: 'rank-note' }, note), list, foot);
        if (!keeper.login) {
          about.textContent = 'Players with a login are here, and they can invite each other to their islands. Log in with 🔑 on the title screen to see them!';
          return;
        }
        // On an island friends can visit (and not closed to new ones), you can invite.
        const canInvite = Boolean(g && this.gameHandlers?.canInvite());
        const inviting = canInvite && !g.settings.locked;
        if (!g) about.textContent = 'Everyone with a login. On your island, invite the ones playing now from the island card at the top!';
        else if (!canInvite) about.textContent = 'You are playing alone on this island. Open it to friends in ⚙️ Settings to invite players.';
        else if (g.settings.locked) about.textContent = 'This island is closed to new visitors. Open it in ⚙️ Settings to invite players.';
        else {
          const passcode = g.settings.passcode && g.pid !== g.host ? ' This island has a passcode: they need it from the island owner too.' : '';
          about.textContent = `Invite a player who is playing now to ${g.world?.name ?? 'this island'}.${passcode}`;
        }
        let reply = null;
        const invite = async (p, button) => {
          button.disabled = true;
          button.textContent = '💌 …';
          try {
            await this.gameHandlers.invitePlayer(p.id);
            this.invitedAt.set(p.id, Date.now());
            this.sound.play('ui');
            note.say('', '');
            this.toast('💌', `You invited ${p.name}!`);
            setTimeout(() => list.isConnected && draw(), INVITE_AGAIN_MS + 100);
          } catch (error) {
            this.sound.play('no');
            note.say(...inviteTrouble(error, p.name), 'warn');
          }
          if (list.isConnected) draw();
        };
        const row = (p) => {
          const sent = Date.now() - (this.invitedAt.get(p.id) ?? 0) < INVITE_AGAIN_MS;
          const button =
            inviting && p.online
              ? h(
                  'button',
                  { class: `chip${sent ? '' : ' on'}`, type: 'button', disabled: sent, 'aria-label': `Invite ${p.name}`, onclick: (e) => invite(p, e.currentTarget) },
                  sent ? '✅ Invited' : '💌 Invite',
                )
              : null;
          return h(
            'div',
            { class: `island-item player-item${p.online ? ' online' : ''}` },
            h('span', { class: 'avatar', style: `--c:${shirtColor(p.look?.shirt)}`, 'aria-hidden': 'true' }, lookIcon(p.look)),
            h('div', { class: 'info' }, h('b', { lang: langOf(p.name) || undefined }, levelTag(p.look), p.name), h('span', { class: 'muted' }, p.online ? '🟢 Playing now' : 'Not playing right now')),
            button,
          );
        };
        const draw = () => {
          if (!reply) return;
          const playing = reply.players.filter((p) => p.online).length;
          list.replaceChildren(...(reply.players.length ? reply.players.map(row) : [h('p', { class: 'muted' }, 'No other players with a login yet.')]));
          const box = h('input', { type: 'checkbox', checked: reply.shown });
          box.addEventListener('change', async () => {
            box.disabled = true;
            note.say('🔎', 'Asking the island keeper…');
            try {
              await keeper.setFindable(box.checked);
              reply.shown = box.checked;
              this.sound.play('ui');
              note.say('', '');
            } catch (error) {
              box.checked = !box.checked;
              note.say(...playersTrouble(error), 'warn');
            }
            if (list.isConnected) draw();
          });
          const count = reply.players.length ? `${reply.players.length} ${reply.players.length === 1 ? 'player' : 'players'}, ${playing} playing now. ` : '';
          foot.replaceChildren(
            h('label', { class: 'check-row' }, box, h('span', {}, 'Other players can find me and invite me')),
            h(
              'p',
              { class: 'muted' },
              count,
              reply.shown ? `They see your display name, ${this.profile.name}, how you look, and whether you are playing now.` : 'You are not on the list: nobody sees you here or can invite you.',
            ),
          );
        };
        let started = false;
        // Again in a few seconds, or in half a minute when it could not be found.
        const ask = async () => {
          if (started && !list.isConnected) return;
          started = true;
          let again = hurried(5000);
          try {
            reply = await keeper.players();
            if (!list.isConnected) return;
            if (note.textContent.startsWith('🔎')) note.say('', '');
            draw();
          } catch (error) {
            again = 30000;
            if (list.isConnected) note.say(...playersTrouble(error), 'warn');
          }
          if (list.isConnected) setTimeout(ask, again);
        };
        note.say('🔎', 'Asking the island keeper…');
        setTimeout(ask, 0);
      },
      { narrow: true },
    );
  }

  // Someone invited you to their island: who, and where, with 🛶 Let’s go!
  // and Not now. It goes by itself after a minute, or when the same player
  // invites you again.
  invitation({ from, island }, go) {
    const box = $('invitations');
    const id = String(from.id ?? '');
    for (const el of [...box.children]) if (el.dataset.from === id) el.remove();
    const answer = (yes) => {
      card.remove();
      this.sound.play('ui');
      if (yes) go();
    };
    const card = h(
      'div',
      { class: 'invitation', role: 'alertdialog', 'aria-label': `Invitation from ${from.name}` },
      h('span', { class: 'avatar', style: `--c:${shirtColor(from.look?.shirt)}`, 'aria-hidden': 'true' }, lookIcon(from.look)),
      h(
        'p',
        { class: 'words' },
        h('b', { lang: langOf(from.name) || undefined }, levelTag(from.look), from.name),
        ' invites you to ',
        h('b', { lang: langOf(island.name) || undefined }, `${THEME_ICON[island.theme] ?? '🏝️'} ${island.name}`),
        '!',
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'chip on', type: 'button', onclick: () => answer(true) }, '🛶 Let’s go!'),
        h('button', { class: 'chip', type: 'button', onclick: () => answer(false) }, 'Not now'),
      ),
    );
    card.dataset.from = id;
    box.append(card);
    while (box.children.length > 3) box.firstElementChild.remove();
    this.sound.play('sticker');
    setTimeout(() => card.remove(), 60000);
  }

  helpDialog() {
    const card = (emoji, title, text) => h('div', { class: 'help-card' }, h('span', { class: 'emoji' }, emoji), h('div', {}, h('b', {}, title), h('div', { class: 'muted' }, ...text)));
    this.openModal((root) => {
      root.append(
        h('h2', {}, '❓ How to play'),
        h(
          'div',
          { class: 'help-grid' },
          card('🚶', 'Walk around', ['Keys ', h('kbd', {}, 'W'), h('kbd', {}, 'A'), h('kbd', {}, 'S'), h('kbd', {}, 'D'), ' or the arrows. On a tablet, put your thumb on the left side.']),
          card('⤴️', 'Jump', ['Press ', h('kbd', {}, 'Space'), ' or the jump button. You hop up small steps by yourself.']),
          card('🪽', 'Fly', ['Press ', h('kbd', {}, 'F'), ' or the wings. Space goes up, ', h('kbd', {}, 'Shift'), ' goes down. Not on 🌟 Adventure Isle, though — that one is an adventure on foot!']),
          card('👀', 'Look around', ['Drag the picture with your mouse or finger. Scroll or pinch to zoom.']),
          card('🧱', 'Build', ['Pick a block below, then click or tap where it should go.']),
          card('✋', 'Pick up', ['Choose the hand, then click a block to take it away. Right-click works too.']),
          card('🖌️', 'Paint', ['Choose the brush, pick a colour below, and tap blocks to paint them.']),
          card('⛰️', 'Hills', ['Raise, dig or flatten the land. Big sizes make big hills!']),
          card('🏠', 'Stamps', ['Put down a whole house, tower, rainbow and more in one tap.']),
          card('🪑', 'Sit down', ['Walk up to a chair or a sofa and tap 🪑 Sit (or press ', h('kbd', {}, 'Q'), '), or to a bed and tap 🛏️ Lie down. Walk, jump or press ', h('kbd', {}, 'Q'), ' again to get up.']),
          card('🛋️', 'Home', ['Make a cozy room with the toy box\'s 🛋️ Home tab: carpets, wood floors and wallpaper, a sofa, a bed, a table and chairs, a kitchen, a TV, a fireplace and more. Furniture turns to face you as you put it down, and a picture goes on the wall you tap. Put sofas, beds, tables or counters side by side to make a big one!']),
          card('🐰', 'Animals', ['Tap an animal to pet it. Give it fruit and it follows you, and a flying friend sits on your head when you stand still! Use the bunny tool to invite new friends.']),
          card('🐶', 'Your pet', ['Pick a puppy, a kitten, a parrot, a baby dragon or another pet in 🐾 My pet. It comes along to every island! Tap it to pet it, and wave or dance: it does tricks too.']),
          card('🐬', 'Sea friends', ['Fish, dolphins, a whale, turtles, crabs and an octopus live in and by the sea, and penguins and seals on snowy islands. Swim out to meet them!']),
          card('🐴', 'Ride', ['Walk up to a pony, a cow, an elephant, a giraffe, a reindeer, a polar bear or a unicorn, and tap Ride (or press ', h('kbd', {}, 'Q'), '). Swim out to a dolphin or the whale and ride them too! Jump to jump, leap, blow water or spray it. ', h('kbd', {}, 'Q'), ' or 👋 gets you off.']),
          card('🐲', 'The dragon', ['Every 🌋 volcano island has a great green dragon, asleep near the crater. Go near and it wakes up and breathes fire: when it rears back, run out of the way it faces! Bop it (', h('kbd', {}, 'X'), ') until it is tired out and it is tame — walk up, tap Ride and hold jump to fly. Tame a dragon ' + TAMES_TO_INVITE + ' times and your own is in the toy box, to bring to any island.']),
          card('🚗', 'Vehicles', ['Walk up to the car, the boat, the digger, a mine cart or the kick scooter and tap Drive (or press ', h('kbd', {}, 'Q'), '). Jump to honk! The scooter is quicker than you run, and its bell goes ring-ring. Drive the digger into a hill to dig a tunnel and find jewels, and push a mine cart along its rails. More are in the toy box.']),
          card('🚌', 'Ride together', ['The bus and the ferry have seats for six friends. One of you drives; the others walk up and tap Hop on (or press ', h('kbd', {}, 'Q'), ') to ride along. Jump to honk!']),
          card('🚁', 'Fly', ['Get in the helicopter or the hot-air balloon and hold jump (', h('kbd', {}, 'Space'), ') to fly up, and ⬇️ (', h('kbd', {}, 'Shift'), ') to come down. Friends can hop on too: two in the helicopter, four in the balloon.']),
          card('🎡', 'Fun park', ['A 🎡 Fun Park Island has a roller coaster, a Ferris wheel and a merry-go-round. Walk up to the Ferris wheel or the merry-go-round and tap Hop on (or press ', h('kbd', {}, 'Q'), ') to go round and round with your friends. Get in a roller coaster car at its station and push ahead to climb the hill, then whoosh down the drop!']),
          card('🛗', 'Elevators', ['Stand on an elevator pad and jump to ride up to the next pad above, or tap ⬇️ (', h('kbd', {}, 'Shift'), ') to ride down. Put pads in a column, one above the other.']),
          card('🤸', 'Trampolines', ['Jump on a trampoline and bounce! Hold jump (', h('kbd', {}, 'Space'), ') to bounce higher and higher, or tap ⬇️ (', h('kbd', {}, 'Shift'), ') to stop. Stamp a Bouncy Castle to bounce with friends.']),
          card('🙈', 'Hide and seek', ['With friends on the island, tap 😊 (or the island’s name) and 🙈 I’ll be it! You shut your eyes and count to 20 while everyone hides, then you have 3 minutes to find them: come close with nothing in the way and they are found. Hiders never found earn 🪙 3 coins, and the seeker a coin for each friend found.']),
          card('🕹️', 'Video arcade', ['Put down an arcade machine from the toy box\'s 🛋️ Home tab, or a whole arcade of six with the 🕹️ Video Arcade stamp. Walk up to a machine and press ', h('kbd', {}, 'Q'), ' (or tap Play) for its game: on the purple one, bop the blobs that pop up — the gold ones are worth three; on the teal one, take turns flipping cards to find pairs. Everyone at a machine plays together, and a good game pays out a few coins!']),
          card('🎁', 'Gashapon', ['Walk up to a gashapon machine (in the toy box\'s 🛋️ Home tab, and at the back of the 🕹️ Video Arcade) and press ', h('kbd', {}, 'Q'), ' (or tap Turn). Put in 🪙 ' + GASHA_PRICE + ' coins and turn the handle: a capsule rolls out with a surprise toy inside! Collect all ' + TOYS.length + ' — ★★ rare ones and ★★★ super rare ones too. Your toys are in your 🎒 backpack.']),
          card('🎹', 'Pianos', ['Put down a piano or a grand piano from the toy box\'s 🛋️ Home tab, walk up to it and press ', h('kbd', {}, 'Q'), ' (or tap Play). Tap the keys — or play on your keyboard, Z to M low and Q to I high — and friends nearby hear you! Pick a song and the next key to play glows.']),
          card('📺', 'TVs', ['Put down a TV, a Retro TV or a Wall TV (on a wall) from the toy box\'s 🛋️ Home tab, walk up to it and press ', h('kbd', {}, 'Q'), ' (or tap Watch). Flip through the channels with ◀ ▶ (or the arrow keys, or 1 to ' + CHANNELS.length + '): fish, a bunny, a rocket, your island\'s weather and a dance party! When the grown-ups put a show on, every TV gets 📡 Live after those.']),
          card('📹', 'Broadcast Station', ['Put down a Broadcast Station (a TV camera on a tripod) from the toy box\'s 🛋️ Home tab, walk up to it and press ', h('kbd', {}, 'Q'), ' (or tap Go live). Say yes to your camera and microphone, tap 🔴 Go live, and you\'re on every TV on every island, on the 📹 On Air channel! One at a time; close the window to stop.']),
          card('👊', 'Monsters', ['Jump on a monster to pop it! Or walk right up to it and press ', h('kbd', {}, 'X'), ' or the 👊 button to swing: the swing sweeps round in front of you and bops every monster it passes, flashing it white. A toy weapon from the 🛒 shop bops harder, and a sword or a bubble blaster reaches further. Press ', h('kbd', {}, 'N'), ' (or the weapon button by the 👊 button) to carry the next of the weapons you own. Weapons wear out as they bop: fix them in the 🛒 shop before they break. A big red Bruiser takes a few jumps and bumps hard, never jump on a prickly orange Spiky or a darting giant mosquito: bop them! And a giant spider scuttles quicker than you walk, so run — two jumps or four bops see it off.']),
          card('🧪', 'HP potions', ['A bump from a monster takes some of your HP, and it comes back by itself. In a fix? Buy a 🧪 potion at the 🛒 shop and drink it with the 🧪 button by your HP (or press ', h('kbd', {}, 'Y'), '): all your HP back at once, and up you get on your own if you were sitting dizzy!']),
          card('🗼', 'Tower defense islands', ['Make one with 🗼 Tower defense on. Monsters march along the road from their gate to the Star Stone. Stand by a wooden pad beside the road and tap 🗼 Build (or press ', h('kbd', {}, 'V'), ') for a tower that blows bubbles at them; build again to make it bigger. Every monster popped brings bricks. Ready? Tap 🌊 Start for the next wave!']),
          card('⚔️', 'Adventure islands', ['Make one with ⚔️ Adventure on. Pop the monsters of a camp, then stand by its flag to raise yours: with friends it goes up faster! A camp freed is a safe place. When every camp is free, pop King Grumble in his castle, and jump when he stomps. Out of HP? Sit tight until a friend taps you to help you up. Now and then a 👾 Monster Gashapon turns up: follow its beam of light, and turn it for a figure of a real monster — on a higher stage of Adventure Isle, a rare one is likelier!']),
          card('🎨', 'Drawing boards', ['Put down a Drawing Board from the toy box\'s 🛋️ Home tab, walk up to it and press ', h('kbd', {}, 'Q'), ' (or tap Draw). Draw with your finger or the mouse: pick a colour and a brush, 🪣 fill a patch, or 🧽 rub out. 🖼️ Save your picture to your own gallery (in ⭐ Stickers too) to look at again or put up on a board again, or 💾 save it as a file! Friends at the same board draw with you, and everyone sees your picture on the board — it stays there when the island is saved!']),
          card('🏫', 'School', ['Stamp a 🏫 School, or put down school desks and a chalkboard (on a wall) from the toy box\'s 🛋️ Home tab. Walk up to the chalkboard and press ', h('kbd', {}, 'Q'), ' (or tap Class), and pick a class: one like Year 2 of elementary school, one like Year 3 of middle school. ' + CLASS_SIZE + ' questions, and every answer you get right is a coin or two! After a class, the next one of that kind is after a little break.']),
          card('🍳', 'Cooking class', ['Walk up to a stove (the toy box\'s 🛋️ Home tab, or stamp a 🍳 Cooking School) and press ', h('kbd', {}, 'Q'), ' (or tap Cook). Pick a recipe — pancakes, pizza, salad, cookies, soup or a sandwich — and tap each step in the right order. Every step right first time is a coin, and the dish is yours to be proud of!']),
          card('⚫', 'Go', ['Put down a Go Board from the toy box\'s 🛋️ Home tab, walk up to it and press ', h('kbd', {}, 'Q'), ' (or tap Play Go). You play black and go first. A friend at the board can play white, or tap 🤖 Play with Pip and the AI friend comes over to play and teaches you how as you go. Put stones on the crossings; surround a stone so it has no breathing spaces left and you capture it! Tap 📖 How to play to learn the rules a step at a time.']),
          card('📚', 'Studying', ['Put down a Study Desk from the toy box\'s 🛋️ Home tab and sit at it (press ', h('kbd', {}, 'Q'), ' beside it, or tap Sit): your workbooks open — adding, taking away, times tables, sharing and spelling. New facts are shown to you first, then you type the answers. Miss one and you see the answer and a way to work it out, and it comes back soon. Get a fact right four times and you know it by heart! Press ', h('kbd', {}, 'Q'), ' (or tap Study) to open them again, and walk to get up.']),
          card('🎓', 'Extra-credit quizzes', ['Conquer an adventure island and pick a quiz for extra credit: one like Year 2 of elementary school, one like Year 3 of middle school. Every answer you get right is a coin or two! They come up as the fireworks end, and after that wait by the 🎓 by the flag until you have done both.']),
          card('🌟', 'The shared isle', ['The 🌟 Adventure Isle button goes straight to one island everybody conquers together — anyone can come, and the more of you there are, the sooner King Grumble goes pop. Free it, and a harder one takes its place — stage 2, stage 3 and on — and after the fireworks, everyone there goes on to it by themselves (or tap 🌟 Go now). Every day it begins again at stage 1. It is an adventure on foot: its toy box stays shut, and you cannot fly on your own there — though its helicopter and balloon fly as ever! And it is a world of its own: the ⭐ XP and level you earn, the coins, treasures and gear you have there are the isle’s, apart from yours everywhere else — kept at the island keeper as yours is, and ranked on boards of their own.']),
          card('⛺', 'Tents', ['Stamp a huge Circus Tent or Camping Tent, or build one with tent cloth. Be in a tent at night for a camp out. No monster ever comes in!']),
          card('🍎', 'Treasures', ['Tap fruit, seashells and star pieces to put them in your basket. Plant fruit to grow a tree!']),
          card('🌾', 'Farming', ['Plant vegetables from your basket on farmland or grass — the 🛒 shop has some to start you off. Water them with the watering can from the toy box’s 🌾 Farm tab (the rain waters them too, and so does water close by) and they grow twice as fast. Tap a ripe one to pick it: each gives you two, to sell, to plant again or to give to an animal!']),
          card('💎', 'Jewels', ['Tap a sparkly gem rock to dig out its jewel. Look in the mine in the mountain, or dig deep down!']),
          card('🎒', 'Backpack', ['Everything you buy in the 🛒 shop goes in your 🎒 backpack (the 🎒 button, or ', h('kbd', {}, 'I'), '): put your shoes, wings and clothes on or take them off, pick which toy weapon is in your hand, drink a 🧪 potion, and see your 🎁 capsule toys from gashapon machines. You see yourself as you change.']),
          card('🛒', 'Shop', ['Sell your fruit, vegetables, shells, star pieces and jewels for coins in the 🛒 shop, then buy running shoes to run faster, 🛼 roller skates to glide, wings or a jet pack to fly faster, a toy sword, bubble blaster, star hammer or lava blade to pop monsters, 👕 clothes (a cape to jump higher, armor against bumps, a fire suit for lava, or just to look grand), 🧪 potions to fill your HP up, and vegetables to plant!']),
          card('💬', 'Talk', ['Type to your friends with the speech bubble (', h('kbd', {}, 'T'), '), or tap a ready-made hello. Dance with the smiley.']),
          card('🗺️', 'Map', ['The little map shows where you are, with a yellow arrow. Tap it to see the whole island.']),
          card('🏢', 'CTB', ['On the CTB island, Grace 🌷 meets you at the gate and shows you to the office, where grown-up helpers sit at their desks making Kids World better: they fix things and add new ones. Visit them and ask what they are working on! Got an idea for the game? Send it to them with 💡 below, and one of them writes back.']),
          card('↩️', 'Oops!', ['The undo button (or ', h('kbd', {}, 'Z'), ') takes back what you just did.']),
          card('🔢', 'Quick keys', [h('kbd', {}, '1'), '–', h('kbd', {}, '0'), ' pick blocks, ', h('kbd', {}, 'E'), ' opens the toy box, ', h('kbd', {}, 'T'), ' talks, ', h('kbd', {}, 'L'), ' changes how you look, ', h('kbd', {}, 'P'), ' takes a photo. The middle mouse button copies the block you point at.']),
          card('🎥', 'See through your eyes', ['Press 🎥 to look from behind you, through your own eyes, or from high in the sky. Zooming all the way in looks through your eyes too. Through your eyes, left and right turn you round.']),
          card('🖼️', 'Picture', ['🖼️ Picture in ⚙️ Settings picks how much the game draws: 🌟 Best gives everyone a shadow and makes faraway things soft, like a photo of toys; ⚡ Fast keeps a slow phone quick. ✨ Auto picks for your device, and goes easier by itself if the game gets slow.']),
          this.fullMode === 'toggle' ? card(lineIcon('full'), 'Full screen', ['The ', lineIcon('full'), ' button fills the whole screen with your island. It is in ⚙️ Settings too.']) : null,
          this.fullMode === 'home-screen' ? card(lineIcon('full'), 'Full screen', ['Add Kids World to the Home Screen and open it from there.']) : null,
        ),
        h(
          'p',
          { class: 'muted', style: 'margin-top:14px' },
          this.handlers?.login?.available()
            ? 'Your things stay on this device, and the island keeper keeps a copy. Log in with 🔑 to have them on your other devices too. Friends see your name, how you look and the phrases you pick.'
            : 'Everything stays on this device. Friends see your name, how you look and the phrases you pick.',
        ),
        this.reportButton(),
        this.ideaButton(),
      );
    });
  }

  // 📰 What's new: the updates given (the ones since you last played, when
  // it opens by itself), or every one in the list.
  newsDialog(news = NEWS) {
    const fresh = news !== NEWS;
    const when = (date) => new Date(`${date}T12:00:00+09:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    this.openModal((root) => {
      root.append(
        h('h2', {}, fresh ? '📰 What\'s new since you last played' : '📰 What\'s new'),
        h(
          'div',
          { class: 'news-list' },
          ...news.map((n) =>
            h('div', { class: 'help-card news-card', 'data-news': n.id }, h('span', { class: 'emoji' }, n.icon), h('div', {}, h('b', {}, n.title), h('span', { class: 'news-date muted' }, when(n.date)), h('div', { class: 'muted' }, n.text))),
          ),
        ),
        h('button', { class: 'big green', type: 'button', style: 'margin-top:16px', onclick: () => this.closeModal() }, '👍 Let\'s play!'),
      );
    });
  }

  // ------------------------------------------------ logins

  // A box for your username.
  usernameBox(value = '') {
    const input = h('input', { type: 'text', class: 'text-input', autocomplete: 'username', autocapitalize: 'none', maxLength: USERNAME_MAX * 3, value, 'aria-label': 'Username' });
    input.spellcheck = false;
    input.setAttribute('autocorrect', 'off');
    return { el: h('label', { class: 'password-box' }, h('span', {}, 'Username'), h('span', { class: 'row' }, input)), input };
  }

  // A password box, with 👁️ to see what you typed.
  passwordBox(label, autocomplete) {
    const input = h('input', { type: 'password', class: 'text-input', autocomplete, autocapitalize: 'off', maxLength: PASSWORD_MAX * 2, 'aria-label': label });
    input.spellcheck = false;
    input.setAttribute('autocorrect', 'off');
    const eye = h('button', { class: 'chip eye', type: 'button', 'aria-label': 'Show the password', 'aria-pressed': 'false' }, '👁️');
    eye.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.textContent = show ? '🙈' : '👁️';
      eye.setAttribute('aria-pressed', String(show));
      input.focus();
    });
    return { el: h('label', { class: 'password-box' }, h('span', {}, label), h('span', { class: 'row' }, input, eye)), input };
  }

  // A line saying how logging in is going, scrolled to where it can be read
  // on a short screen.
  loginNote() {
    const note = h('p', { class: 'login-note', 'aria-live': 'polite' });
    note.say = (icon, text, kind = '') => {
      note.className = `login-note${kind ? ` ${kind}` : ''}`;
      note.textContent = icon ? `${icon} ${text}` : '';
      if (icon && note.isConnected) note.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    return note;
  }

  // For a password manager: whose password it is.
  static username(name) {
    return h('input', { type: 'text', class: 'visually-hidden', autocomplete: 'username', value: name, readOnly: true, tabIndex: -1, 'aria-hidden': 'true' });
  }

  // Logging in: your username (or one of the players who logged in on this
  // device before) and your password. Then, if this device's guest has
  // things, whether they are yours to bring along.
  loginDialog() {
    const login = this.handlers.login;
    let asking = false;
    this.openModal(
      (root) => {
        const body = h('div');
        const foot = h(
          'div',
          { class: 'login-foot' },
          h('span', { class: 'muted' }, 'No login yet?'),
          h('button', { class: 'chip', type: 'button', onclick: () => this.makeLoginDialog() }, '✨ Make my login'),
        );
        // Logged in: what this device's guest has comes along, if it is yours.
        const welcome = (reply) => {
          const guest = login.guest();
          const name = reply.profile?.name || reply.username;
          const note = this.loginNote();
          const answer = async (adopt) => {
            for (const b of buttons) b.disabled = true;
            note.say(adopt ? '🧳' : '🎉', adopt ? 'Bringing them along…' : `Hi, ${name}!`);
            try {
              await login.enter(reply, adopt);
            } catch (error) {
              for (const b of buttons) b.disabled = false;
              note.say(...loginTrouble(error), 'warn');
              this.sound.play('no');
            }
          };
          const buttons = [
            h('button', { class: 'big green', type: 'button', onclick: () => answer(true) }, '✅ Yes, they are mine'),
            h('button', { class: 'chip', type: 'button', onclick: () => answer(false) }, '🙅 No, leave them here'),
          ];
          if (!guest) {
            body.replaceChildren(note);
            answer(false);
            return;
          }
          foot.hidden = true;
          body.replaceChildren(
            h('h3', {}, `🎉 Hi, ${name}!`),
            h('p', {}, `This device also has ${things(guest)} from playing here as ${guest.name}. Are they yours?`),
            h('p', { class: 'muted' }, 'If they are, they come along to your login, on all your devices.'),
            note,
            h('div', { class: 'login-answers' }, ...buttons),
          );
        };
        const note = this.loginNote();
        const user = this.usernameBox();
        const box = this.passwordBox('Password', 'current-password');
        const known = login.known();
        const go = async () => {
          if (asking) return;
          if (!user.input.value.trim()) {
            note.say('🙈', 'Type your username first.', 'warn');
            user.input.focus();
            return;
          }
          if (!box.input.value) {
            note.say('🙈', 'Type your password first.', 'warn');
            box.input.focus();
            return;
          }
          asking = true;
          note.say('🔎', 'Asking the island keeper…');
          try {
            welcome(await login.logIn(user.input.value, box.input.value));
          } catch (error) {
            asking = false;
            note.say(...loginTrouble(error), 'warn');
            this.sound.play('no');
            box.input.select();
          }
        };
        body.append(
          ...(known.length
            ? [
                h('h3', {}, 'Played here before'),
                h(
                  'div',
                  { class: 'row known-players' },
                  ...known.map((k) =>
                    h(
                      'button',
                      {
                        class: 'chip',
                        type: 'button',
                        onclick: () => {
                          user.input.value = k.username || k.name;
                          this.sound.play('ui');
                          box.input.focus();
                        },
                      },
                      h('span', { class: 'emoji' }, lookIcon(k.look)),
                      k.username || k.name,
                    ),
                  ),
                ),
              ]
            : []),
          h(
            'form',
            {
              class: 'login-form',
              onsubmit: (e) => {
                e.preventDefault();
                go();
              },
            },
            user.el,
            box.el,
            note,
            h('button', { class: 'big green', type: 'submit' }, '🔑 Log in'),
          ),
        );
        root.append(h('h2', {}, '🔑 Log in'), h('p', {}, 'Play as yourself, with your look, stickers and islands from your other devices.'), body, foot);
        this.focusSoon(user.input, 60);
      },
      { narrow: true },
    );
  }

  // Making a login, a username and a password (twice, to be sure), or a new
  // password for yours. Made as the guest, the page plays as the new login
  // once this closes. why: what to say first, when the keeper asked for a
  // password.
  makeLoginDialog({ why = '' } = {}) {
    const login = this.handlers.login;
    const loggedIn = Boolean(login.who());
    const name = this.profile.name;
    let made = false;
    let asking = false;
    this.openModal(
      (root) => {
        const note = this.loginNote();
        // The username starts as your name, and is your name in games unless you say otherwise.
        const user = loggedIn ? null : this.usernameBox(name);
        const asName = loggedIn ? null : h('input', { type: 'checkbox', checked: true });
        const asNameRow = asName ? h('label', { class: 'check-row' }, asName, h('span', {}, 'Use it as my display name too')) : null;
        const box = this.passwordBox(loggedIn ? 'New password' : 'Password', 'new-password');
        const again = this.passwordBox('The same password again', 'new-password');
        const button = h('button', { class: 'big green', type: 'submit' }, loggedIn ? '🔒 Save my password' : '✨ Make my login');
        const username = () => (user ? user.input.value : login.username());
        const go = async () => {
          if (asking) return;
          const odd = user ? usernameProblem(user.input.value) : '';
          if (odd) {
            note.say('🙈', USERNAME_HELP[odd], 'warn');
            user.input.focus();
            return;
          }
          const problem = passwordProblem(box.input.value, username());
          if (problem) {
            note.say('🙈', PASSWORD_HELP[problem], 'warn');
            box.input.focus();
            return;
          }
          if (box.input.value !== again.input.value) {
            note.say('🙈', 'The two passwords are not the same. Try again!', 'warn');
            again.input.select();
            return;
          }
          asking = true;
          button.disabled = true;
          note.say('🔎', 'Asking the island keeper…');
          let reply;
          try {
            reply = await login.make(box.input.value, user ? user.input.value : null, { asName: asName?.checked });
          } catch (error) {
            asking = false;
            button.disabled = false;
            note.say(...loginTrouble(error), 'warn');
            this.sound.play('no');
            if (error.code === 'taken' || error.code === 'username') user?.input.select();
            return;
          }
          made = true;
          this.sound.play('sticker');
          form.replaceChildren(
            note,
            h('p', { class: 'muted' }, 'Ask a grown-up to help you remember them.'),
            h('button', { class: 'big green', type: 'button', onclick: () => this.closeModal() }, '👍 Got it'),
          );
          note.say('🎉', loggedIn ? 'Your new password is ready!' : `Your login is ready! Log in on any device with your username, ${reply.username}, and your password.`, 'good');
        };
        const form = h(
          'form',
          {
            class: 'login-form',
            onsubmit: (e) => {
              e.preventDefault();
              go();
            },
          },
          user ? user.el : UI.username(login.username()),
          asNameRow,
          box.el,
          again.el,
          note,
          button,
        );
        // Not append(null), which would show "null".
        root.append(
          ...[
            h('h2', {}, loggedIn ? '🔒 New password' : '✨ Make my login'),
            why ? h('p', { class: 'login-note warn' }, `🔑 ${why}`) : null,
            h(
              'p',
              {},
              loggedIn
                ? `Pick a new password for ${login.username() || name}.`
                : 'Pick a username and a password you will remember. Log in with them on any device to play as yourself.',
            ),
            h(
              'p',
              { class: 'muted' },
              loggedIn
                ? `At least ${PASSWORD_MIN} letters or numbers, and not your username.`
                : `A username has ${USERNAME_MIN} to ${USERNAME_MAX} letters, numbers or signs; a password at least ${PASSWORD_MIN}, and not the username.`,
            ),
            form,
          ].filter(Boolean),
        );
        this.focusSoon((user ?? box).input, 60);
      },
      {
        narrow: true,
        onClose: () => {
          if (made && !loggedIn) login.made();
        },
      },
    );
  }

  // Logged in: who you are, how your copies are doing, a new password, and
  // logging out.
  myLoginDialog() {
    const login = this.handlers.login;
    const needsPassword = login.keeper.needsPassword;
    this.openModal(
      (root) => {
        const note = this.loginNote();
        const out = h(
          'button',
          {
            class: 'chip',
            type: 'button',
            onclick: async () => {
              out.disabled = true;
              note.say('👋', 'Logging out…');
              await login.logOut();
            },
          },
          '🚪 Log out',
        );
        const username = login.username();
        const differs = Boolean(username) && username !== this.profile.name;
        const align = h(
          'button',
          {
            class: 'chip',
            type: 'button',
            onclick: () => {
              this.profile.update({ name: username });
              this.handlers.lookChanged?.();
              this.renderMe();
              this.sound.play('ui');
              this.myLoginDialog();
            },
          },
          '🪪 Use my username instead',
        );
        root.append(
          ...[
            h('h2', {}, '🔑 My login'),
            needsPassword ? h('p', { class: 'login-note warn' }, '🔑 Your login needs a password now, instead of secret pictures.') : null,
            h(
              'p',
              {},
              username ? `Your username is ${username}. ` : '',
              differs ? `Friends see your display name, ${this.profile.name}.` : username ? 'It is your display name too, the name friends see.' : '',
              ' Your look, stickers and islands are the same on every device you log in on.',
            ),
            differs ? h('div', { class: 'row' }, align) : null,
            h('p', { class: 'muted' }, 'Change your display name, and how you look, in 🎨 Change me.'),
            h('p', { class: 'muted keeper-status' }, this.keeperText()),
            h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: `chip${needsPassword ? ' on' : ''}`, type: 'button', onclick: () => this.makeLoginDialog() }, '🔒 New password'), out),
            h('p', { class: 'muted', style: 'margin-top:12px' }, 'Log out when you are done on a device other people use too. Your islands stay safe with the island keeper.'),
            note,
          ].filter(Boolean),
        );
      },
      { narrow: true },
    );
  }

  // ------------------------------------------------ problems

  // The button to tell of a problem, where there is an island keeper to tell.
  reportButton(kind = 'chip report-button') {
    if (!this.canTellUs()) return null;
    return h('button', { class: kind, type: 'button', onclick: () => this.reportDialog() }, '🐞 Something went wrong?');
  }

  reportKeeper() {
    return this.gameHandlers?.keeper ?? this.handlers?.login?.keeper ?? null;
  }

  // Ideas and problems go to the keeper from a player logged in, so whoever
  // reads them knows who to thank (an idea taken is credited to them on
  // GitHub) and who to ask.
  canTellUs() {
    return Boolean(this.reportKeeper()?.config && this.handlers?.login?.who?.());
  }

  // Something went wrong: what you write goes to the grown-ups who run the
  // island keeper, with a picture of your screen as it was (the dialog this
  // came from closes first, and the picture can stay behind) or one you pick
  // instead (a screenshot from your phone's gallery, which shows what the
  // game's own picture cannot), where you were, and what went wrong in the
  // page lately (see report.js).
  async reportDialog() {
    const keeper = this.reportKeeper();
    if (!this.canTellUs()) return;
    this.closeModal();
    this.loading('📷 Taking a picture of your screen…');
    // The dialog that closed is off the screen by the next frame.
    await new Promise((done) => requestAnimationFrame(() => done()));
    let picture = '';
    try {
      picture = await screenshot(this.game?.renderer ?? null);
    } catch {
      picture = '';
    }
    this.hideLoading();
    const about = this.reportAbout();
    this.openModal(
      (root) => {
        let withPicture = Boolean(picture);
        // Where the picture came from: the screen, or picked from the device.
        let chosen = false;
        const text = h('textarea', { class: 'text-input report-text', rows: 4, maxLength: REPORT_TEXT_MAX, placeholder: 'What happened? What did you think would happen?', 'aria-label': 'What went wrong' });
        const note = h('p', { class: 'login-note warn', 'aria-live': 'polite', hidden: true });
        const shot = h('img', { class: 'report-shot', src: picture || null, alt: 'A picture of your screen', hidden: !picture });
        const sw = h('button', { class: 'switch on', type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Send the picture too', hidden: !picture });
        const showPicture = (on) => {
          withPicture = on;
          sw.classList.toggle('on', on);
          sw.setAttribute('aria-checked', String(on));
          shot.classList.toggle('off', !on);
        };
        sw.onclick = () => {
          showPicture(!withPicture);
          this.sound.play('ui');
        };
        const label = h('b', {}, picture ? '📷 Send this picture too' : '📷 No picture yet');
        const detail = h('div', { class: 'muted' }, picture ? 'It shows them what your screen looked like.' : 'Add one to show them what went wrong.');
        // A picture of your own: from a phone's gallery (where its own
        // screenshots are), or any picture on a computer.
        const file = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Pick a picture' });
        const pick = h('button', { class: 'chip report-pick', type: 'button', onclick: () => file.click() }, picture ? '🖼️ Use another picture' : '🖼️ Add a picture');
        file.onchange = async () => {
          const f = file.files?.[0];
          file.value = '';
          if (!f) return;
          try {
            picture = await pictureFrom(f);
          } catch {
            note.hidden = false;
            note.textContent = '🙈 That picture could not be opened. Try another one.';
            return;
          }
          chosen = true;
          note.hidden = true;
          shot.src = picture;
          shot.alt = 'The picture you picked';
          shot.hidden = false;
          sw.hidden = false;
          label.textContent = '🖼️ Send your picture';
          detail.textContent = 'The one you picked, instead of the game’s.';
          pick.textContent = '🖼️ Pick another picture';
          showPicture(true);
          this.sound.play('ui');
        };
        const send = h(
          'button',
          {
            class: 'big green',
            type: 'button',
            onclick: () => {
              const words = text.value.trim();
              if (!words && !withPicture) {
                note.hidden = false;
                note.textContent = '✏️ Write what went wrong first.';
                text.focus();
                return;
              }
              if (!keeper.report({ text: words, picture: withPicture ? picture : null, about: { ...about, picture: chosen ? 'chosen' : 'screen' } })) {
                note.hidden = false;
                note.textContent = '🙈 There is no island keeper to tell right now.';
                return;
              }
              this.closeModal();
              this.sound.play('sticker');
              this.toast('📮', keeper.state === 'ready' ? 'Thank you! Your note is on its way to the grown-ups.' : 'Thank you! Your note goes to the grown-ups when the island keeper wakes up.');
            },
          },
          '📮 Send',
        );
        root.append(
          h('h2', {}, '🐞 Something went wrong?'),
          h('p', {}, 'Tell the grown-ups who look after Kids World, and they will try to fix it.'),
          text,
          h('div', { class: 'setting report-picture' }, shot, h('div', {}, label, detail), sw),
          h('div', { class: 'row' }, pick, file),
          note,
          h('div', { class: 'row', style: 'margin-top:12px' }, send),
          h('p', { class: 'muted', style: 'margin-top:10px' }, 'Your name, the island you are on and what kind of device you have go along too. Never write your password here.'),
        );
        setTimeout(() => text.focus(), 60);
      },
      { narrow: true },
    );
  }

  // ------------------------------------------------ ideas for the game

  // 💌 on the title screen and in a game (in the top bar where it has room,
  // and in 💬 everywhere: see sayDialog), for a player logged in where there
  // is an island keeper to take an idea or a problem.
  renderFeedback() {
    const on = this.canTellUs();
    for (const id of ['btn-feedback', 'btn-feedback-hud']) $(id).hidden = !on;
  }

  // 💌 Ideas & problems: one tap to tell the grown-ups an idea for the game
  // (CTB's helpers read it and write back) or that something went wrong.
  feedbackDialog() {
    if (!this.canTellUs()) return;
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '💌 Tell us!'),
          h('p', {}, 'Have an idea that would make Kids World even better, or did something go wrong?'),
          h(
            'div',
            { class: 'feedback-choices' },
            h('button', { class: 'big yellow', type: 'button', onclick: () => this.ideasDialog() }, h('span', { class: 'emoji' }, '💡'), ' I have an idea!'),
            h('button', { class: 'big blue', type: 'button', onclick: () => this.reportDialog() }, h('span', { class: 'emoji' }, '🐞'), ' Something went wrong'),
          ),
        );
      },
      { narrow: true },
    );
  }

  // The button to send CTB's workers an idea for the game, where there is an
  // island keeper to take it.
  ideaButton(kind = 'chip report-button') {
    if (!this.canTellUs()) return null;
    return h('button', { class: kind, type: 'button', onclick: () => this.ideasDialog() }, '💡 An idea for the game?');
  }

  // Your ideas for Kids World: a box to write a new one in (logged in), and
  // the ones you sent, each with what the CTB helper who read it wrote back.
  // An answer that comes while it is open shows at once (see wishAnswered).
  ideasDialog() {
    const keeper = this.reportKeeper();
    if (!keeper?.config) return;
    const loggedIn = Boolean(this.handlers?.login?.who?.());
    this.openModal(
      (root) => {
        const list = h('div', { class: 'ideas' }, h('p', { class: 'muted' }, 'Looking for your ideas…'));
        const refresh = async () => {
          if (!loggedIn) return;
          try {
            const wishes = await keeper.wishes();
            this.markWishesSeen(wishes);
            list.replaceChildren(...(wishes.length ? wishes.map((w) => this.ideaCard(w)) : [h('p', { class: 'muted' }, 'No ideas yet. What would you love to see?')]));
          } catch {
            list.replaceChildren(h('p', { class: 'muted' }, '🙈 The island keeper is away, so your ideas cannot be shown right now.'));
          }
        };
        this.ideasRefresh = refresh;
        const text = h('textarea', { class: 'text-input report-text', rows: 3, maxLength: WISH_TEXT_MAX, placeholder: 'What would make Kids World even more fun?', 'aria-label': 'Your idea' });
        const note = h('p', { class: 'login-note warn', 'aria-live': 'polite', hidden: true });
        const say = (words) => {
          note.hidden = false;
          note.textContent = words;
        };
        const send = h(
          'button',
          {
            class: 'big green',
            type: 'button',
            onclick: async () => {
              const words = text.value.trim();
              if (!words) {
                say('✏️ Write your idea first.');
                text.focus();
                return;
              }
              send.disabled = true;
              try {
                await keeper.wish(words);
                text.value = '';
                note.hidden = true;
                this.sound.play('sticker');
                this.toast('💡', 'Thank you! A CTB helper will read your idea and write back to you here.');
                await refresh();
              } catch (error) {
                say(error?.code === 'wait' ? `⏳ ${error.message}` : error?.code === 'none' || error?.code === 'away' ? '🙈 The island keeper is away. Try again later!' : `🙈 ${error?.message || 'That did not work. Try again later!'}`);
              } finally {
                send.disabled = false;
              }
            },
          },
          '💡 Send my idea',
        );
        root.append(
          h('h2', {}, '💡 Ideas for Kids World'),
          h('p', {}, 'Tell the helpers at CTB what you would love to see in Kids World. One of them reads your idea and writes back to you!'),
          ...(loggedIn ? [text, note, h('div', { class: 'row', style: 'margin-top:12px' }, send)] : [h('p', { class: 'login-note warn' }, '🔑 Log in to send an idea.')]),
          loggedIn ? h('h3', { style: 'margin-top:16px' }, 'Your ideas') : null,
          loggedIn ? list : null,
        );
        refresh();
        if (loggedIn) setTimeout(() => text.focus(), 60);
      },
      {
        narrow: true,
        onClose: () => {
          this.ideasRefresh = null;
        },
      },
    );
  }

  // One of your ideas, and its answer once a helper has read it.
  ideaCard(w) {
    const status =
      w.state === 'waiting'
        ? h('div', { class: 'muted' }, '⏳ Waiting for a CTB helper to read it')
        : h('div', { class: `idea-answer ${w.state}` }, h('b', {}, w.state === 'accepted' ? `✅ ${w.by}: ` : `💭 ${w.by}: `), h('span', { lang: langOf(w.reply) || undefined }, w.reply));
    return h('div', { class: `idea ${w.state}` }, h('p', { class: 'idea-text', lang: langOf(w.text) || undefined }, `“${w.text}”`), status);
  }

  // A helper's answer to an idea of yours: said in a toast, and shown in the
  // ideas window if it is open.
  wishAnswered(wish) {
    if (wish.state === 'waiting') return;
    this.markWishesSeen([wish]);
    this.toast(wish.state === 'accepted' ? '✅' : '💭', `${wish.by} read your idea: ${wish.reply}`);
    this.ideasRefresh?.();
  }

  // Answers already shown on this device, so each is told once.
  wishesSeen() {
    try {
      const seen = JSON.parse(localStorage.getItem(WISHES_SEEN_KEY) ?? '[]');
      return new Set(Array.isArray(seen) ? seen : []);
    } catch {
      return new Set();
    }
  }

  markWishesSeen(wishes) {
    const seen = this.wishesSeen();
    for (const w of wishes) if (w.state !== 'waiting') seen.add(w.id);
    try {
      localStorage.setItem(WISHES_SEEN_KEY, JSON.stringify([...seen].slice(-100)));
    } catch {}
  }

  // Who and where you were, for a problem report: your name, the screen, the device, and the
  // island (never its passcode), with what went wrong in the page lately.
  reportAbout() {
    const g = this.game;
    return {
      name: this.profile.name,
      page: `${location.origin}${location.pathname}`,
      agent: navigator.userAgent,
      screen: `${innerWidth}×${innerHeight} @${Math.round(devicePixelRatio * 100) / 100}x`,
      layout: layoutFacts(),
      touch: Boolean(this.input.touchMode),
      where: g ? 'island' : 'title',
      island: g?.world
        ? {
            name: g.world.name,
            code: g.code,
            kind: g.adventure ? 'adventure' : g.defense ? 'defense' : 'build',
            theme: g.world.theme,
            players: g.players.size,
            host: g.pid === g.host,
            online: this.gameHandlers?.canInvite?.() ? 'open to friends' : 'alone',
          }
        : null,
      errors: recentErrors(),
    };
  }

  // ------------------------------------------------ full screen

  toggleFullscreen() {
    if (this.fullMode === 'home-screen') {
      this.homeScreenDialog();
      return;
    }
    this.sound.play('ui');
    setFullscreen(!isFullscreen()).catch(() => this.toast('🙈', 'Full screen did not work this time.', 'warn'));
  }

  renderFullscreen() {
    const on = isFullscreen();
    document.body.classList.toggle('fullscreen', on);
    for (const el of [$('btn-fullscreen'), $('btn-fullscreen-hud')]) {
      el.hidden = this.fullMode === 'none';
      if (this.fullMode === 'toggle') el.setAttribute('aria-pressed', String(on));
    }
    $('btn-fullscreen').classList.toggle('on', on);
    for (const sw of document.querySelectorAll('.fullscreen-switch')) {
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-checked', String(on));
    }
  }

  // What the keeper is up to, in a few words, for the Safe copies row in
  // Settings and for My login.
  keeperText() {
    const k = this.gameHandlers?.keeper ?? this.handlers?.login?.keeper;
    if (!k?.config) return '';
    if (k.state === 'off') return 'Off. Your islands stay on this device only.';
    if (k.syncing) return 'Bringing back what your other devices sent…';
    if (k.sending) return 'Copying to the island keeper…';
    const last = k.lastKept ? `Last copy ${ago(k.lastKept)}.` : '';
    if (k.state === 'away') return `The island keeper is asleep. Copies go when it wakes up. ${last}`.trim();
    if (k.state === 'refused') return 'Copies are paused for now.';
    if (k.login) return last || 'The island keeper keeps your islands for all your devices.';
    return last || 'When the island keeper is on, it keeps a copy of your islands, your look and your stickers.';
  }

  renderKeeper() {
    for (const el of document.querySelectorAll('.keeper-status')) el.textContent = this.keeperText();
    this.renderIslandList();
  }

  // The row in Settings, for screens with no room for the button at the top.
  fullscreenSetting() {
    if (this.fullMode === 'none') return null;
    const label = h('b', {}, lineIcon('full'), ' Full screen');
    if (this.fullMode === 'home-screen') {
      return h(
        'div',
        { class: 'setting' },
        h('div', {}, label, h('div', { class: 'muted' }, 'Open Kids World from the Home Screen.')),
        h('button', { class: 'chip', type: 'button', onclick: () => this.homeScreenDialog() }, 'How?'),
      );
    }
    const on = isFullscreen();
    const sw = h('button', { class: `switch fullscreen-switch${on ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': 'Full screen', onclick: () => this.toggleFullscreen() });
    return h('div', { class: 'setting' }, h('div', {}, label, h('div', { class: 'muted' }, 'Just your island, without the browser around it.')), sw);
  }

  // An iPhone cannot fill the screen, nor an iPad for long, but the game opened from the Home Screen does.
  homeScreenDialog() {
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '📱 Full screen'),
          h('p', {}, 'Kids World fills the whole screen when you open it from the Home Screen. Ask a grown-up to:'),
          h(
            'ol',
            { class: 'steps' },
            h('li', {}, 'Tap ', h('b', {}, 'Share'), ' ', lineIcon('share')),
            h('li', {}, 'Choose ', h('b', {}, 'Add to Home Screen')),
            h('li', {}, 'Open ', h('b', {}, 'Kids World'), ' from the Home Screen'),
          ),
          h(
            'p',
            { class: 'muted' },
            this.handlers?.login?.available()
              ? 'The Home Screen game keeps its own islands and stickers. To bring yours along, log in there with 🔑 Log in, or save an island to a file in ⚙️ Settings and open the file from 📒 My islands.'
              : 'The Home Screen game keeps its own islands and stickers. To bring an island along, save it to a file in ⚙️ Settings, then open the file from 📒 My islands.',
          ),
        );
      },
      { narrow: true },
    );
  }

  soundDialog() {
    this.openModal((root) => {
      root.append(h('h2', {}, '🔊 Sound'), this.soundSettings());
    }, { narrow: true });
  }

  soundSettings() {
    const s = this.profile.settings;
    const slider = (key, label) => {
      const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], 'aria-label': label });
      input.addEventListener('input', () => {
        this.profile.setting(key, Number(input.value));
        this.sound.setLevels({ [key]: Number(input.value) });
      });
      input.addEventListener('change', () => this.sound.play(key === 'music' ? 'grow' : 'pop'));
      return h('div', { class: 'setting' }, h('b', {}, label), input);
    };
    return h('div', {}, slider('music', '🎵 Music'), slider('sound', '🔔 Sounds'));
  }

  // ------------------------------------------------ in the game

  attach(game, handlers) {
    this.game = game;
    this.gameHandlers = handlers;
    // The world you are in, as the game has it: on the shared isle its own
    // XP, level, coins, basket and gear show, not yours everywhere else.
    if (game.profile !== this.profile) {
      this.profile = game.profile;
      this.levelKey = '';
      this.renderLevel();
    }
    // Back at the title, the world you played in.
    if (this.isle) this.setTitleWorld(game.profile === this.isle ? 'isle' : 'home');
    $('title').hidden = true;
    $('hud').hidden = false;
    document.body.classList.add('playing');
    document.body.classList.toggle('touch', this.input.touchMode);
    this.buildToolbar();
    this.buildHotbar();
    this.renderShared();
    this.renderBasket();
    this.renderFriends();
    this.renderIsland();
    this.renderHp();
    this.minimap.attach(game);
    this.renderMap();
    $('btn-toybox').onclick = () => this.toyBox();
    $('btn-view').onclick = () => this.nextView();
    $('btn-photo').onclick = () => this.takePhoto();
    $('btn-settings').onclick = () => this.settingsDialog();
    $('btn-help-hud').onclick = () => this.helpDialog();
    $('btn-feedback-hud').onclick = () => this.feedbackDialog();
    this.renderFeedback();
    $('btn-stickers-hud').onclick = () => this.stickersDialog();
    $('btn-shop-hud').onclick = () => this.shopDialog();
    $('btn-backpack-hud').onclick = () => this.backpackDialog();
    $('island-badge').onclick = () => this.inviteDialog();
    $('btn-say').onclick = () => this.sayDialog();
    $('btn-emote').onclick = () => this.emoteDialog();
    const hold = (el, key) => {
      el.onpointerdown = (e) => {
        e.preventDefault();
        this.input[key] = true;
        this.sound.unlock();
      };
      el.onpointerup = el.onpointerleave = el.onpointercancel = () => (this.input[key] = false);
    };
    hold($('btn-jump'), 'jumpHeld');
    hold($('btn-down'), 'downHeld');
    $('btn-down').addEventListener('pointerdown', () => game.pressDown());
    $('btn-fly').onclick = () => game.toggleFly();
    $('btn-attack').onpointerdown = (e) => {
      e.preventDefault();
      this.sound.unlock();
      game.attack();
    };
    // The weapon button, by it: the next of your toy weapons into your hand.
    $('btn-weapon').onmousedown = (e) => e.preventDefault();
    $('btn-weapon').onclick = () => {
      $('btn-weapon').blur();
      this.sound.unlock();
      game.cycleWeapon();
    };
    // The potion button, like the ride button, never keeping the focus,
    // where Space (to jump) would press it again.
    $('btn-potion').onmousedown = (e) => e.preventDefault();
    $('btn-potion').onclick = () => {
      $('btn-potion').blur();
      this.sound.unlock();
      game.drink();
    };
    // Never keeping the focus, where Space (to jump) would press it again.
    $('ride').onmousedown = (e) => e.preventDefault();
    $('ride').onclick = () => {
      $('ride').blur();
      this.sound.unlock();
      game.toggleRide();
    };
    $('next-stage').onmousedown = (e) => e.preventDefault();
    $('next-stage').onclick = () => {
      this.sound.unlock();
      this.sound.play('ui');
      this.goNextStage();
    };
    $('defend').onmousedown = (e) => e.preventDefault();
    $('defend').onclick = () => {
      $('defend').blur();
      this.sound.unlock();
      game.defend();
    };
    const on = (type, fn) => game.addEventListener(type, fn);
    on('players', () => {
      this.renderFriends();
      // Who is at a Go board, and whether the AI friend is here to call.
      this.renderGo();
    });
    on('settings', () => {
      this.renderIsland();
      this.renderHp();
    });
    on('hp', () => this.renderHp());
    on('song', () => {
      this.drawSong?.();
      const song = game.song;
      if (song?.ready && song.id !== this.songToasted) {
        this.songToasted = song.id;
        this.toast('🎵', `Now playing: ${song.name}`);
      }
    });
    on('adventure', () => this.renderHp());
    on('defense', () => this.renderDefense());
    on('dizzy', () => this.renderHp());
    on('welcome', () => {
      this.renderDefense();
      this.renderShared();
    });
    on('arcade-open', () => this.arcadeDialog());
    on('gasha-open', () => this.gashaDialog());
    on('gasha-gone', () => this.gashaShow?.());
    on('piano-open', () => this.pianoDialog());
    // Off the bench (bumped, sent home, or the piano picked up): its keyboard goes.
    on('piano-gone', () => this.modalOpen && $('modal').querySelector('.piano-board') && this.closeModal());
    on('tv-open', () => this.tvDialog());
    on('station-open', () => this.stationDialog());
    on('class-open', () => this.classDialog());
    on('cook-open', () => this.cookDialog());
    on('cooking', () => this.cookingNews());
    on('study-open', () => this.studyDialog());
    on('study', () => this.studyNews());
    on('draw-open', () => this.drawDialog());
    on('go-open', () => this.goDialog());
    on('go', () => this.renderGo());
    on('gofx', (e) => this.goHeard(e.detail));
    on('drawing', (e) => this.drawingChanged?.(e.detail));
    on('onair', () => this.onAirNews());
    on('arcade', () => this.renderArcade());
    on('hideseek', () => {
      this.renderHideSeek();
      if (this.modalOpen && $('modal').querySelector('.hideseek-part')) this.drawHideSeekPart?.();
    });
    on('quiz-offer', () => this.quizOfferDialog(true));
    on('quiz', () => this.quizNews());
    on('next-stage', () => this.nextStageNews());
    on('tool', () => {
      this.buildToolbar();
      this.buildHotbar();
      this.renderBasket();
    });
    on('undo', () => this.buildToolbar());
    on('toast', (e) => this.toast(e.detail.icon, e.detail.text));
    on('reward', (e) => this.reward(e.detail));
    on('notice', (e) => this.toast(e.detail.level === 'info' ? '💡' : '🙈', e.detail.text, e.detail.level === 'info' ? '' : 'warn'));
    on('chat', (e) => this.chatLine(e.detail));
    on('fly', (e) => $('btn-fly').classList.toggle('on', e.detail));
    on('aim', (e) => this.aimHint(e.detail));
    // Come back to a conquered stage (a reconnect, say): on you go from it.
    this.nextStageNews();
    this.input.enabled = true;
  }

  detach() {
    this.game = null;
    // Back at the title, the world picked there.
    this.profile = this.titleWorld === 'isle' && this.hasIsleWorld() ? this.isle : this.home;
    this.levelKey = '';
    this.renderLevel();
    this.minimap.detach();
    this.input.enabled = false;
    $('hud').hidden = true;
    $('ride').hidden = true;
    $('defend').hidden = true;
    $('defense').hidden = true;
    $('hideseek').hidden = true;
    $('blindfold').hidden = true;
    this.stopNextStage();
    document.body.classList.remove('playing');
    for (const el of this.tags.values()) el.remove();
    this.tags.clear();
    for (const el of this.advTags.values()) el.remove();
    this.advTags.clear();
    for (const f of this.floats.values()) f.el.remove();
    this.floats.clear();
    $('chatlog').replaceChildren();
    this.closeModal();
  }

  // On the shared isle nobody builds and nobody flies on their own, so its
  // tools, its toy box and its fly button are not even there.
  renderShared() {
    const shared = this.game?.shared === true;
    $('toolbar').hidden = shared;
    $('toolopts').hidden = shared;
    $('hotbar').hidden = shared;
    $('btn-toybox').hidden = shared;
    $('btn-fly').hidden = shared;
  }

  buildToolbar() {
    const g = this.game;
    const bar = $('toolbar');
    bar.replaceChildren(
      ...TOOLS.map((t) =>
        h(
          'button',
          {
            class: `tool${g.tool === t.key ? ' on' : ''}`,
            type: 'button',
            title: t.name,
            'aria-label': t.name,
            'aria-pressed': String(g.tool === t.key),
            onclick: () => {
              this.sound.play('ui');
              g.setTool(t.key);
              if (t.key === 'stamp' && !this.pickedStamp) this.toyBox('stamps');
              if (t.key === 'friends' && !this.pickedCritter) this.toyBox('animals');
            },
          },
          t.icon,
          h('small', {}, t.name),
        ),
      ),
      h(
        'button',
        {
          class: 'tool undo',
          type: 'button',
          title: 'Undo',
          'aria-label': 'Undo',
          disabled: g.undoStack.length === 0,
          style: g.undoStack.length === 0 ? 'opacity:.45' : '',
          onclick: () => g.undo(),
        },
        '↩️',
        h('small', {}, 'Undo'),
      ),
    );
    this.buildToolOptions();
  }

  buildToolOptions() {
    const g = this.game;
    const opts = $('toolopts');
    const groups = [];
    if (['build', 'pick', 'paint', 'hills'].includes(g.tool) && !(g.tool === 'build' && g.basketPick)) {
      groups.push(
        h(
          'div',
          { class: 'opt-group', 'aria-label': 'Size' },
          ...[1, 2, 3].map((s) =>
            h(
              'button',
              {
                class: `pill${g.size === s ? ' on' : ''}`,
                type: 'button',
                title: ['Small', 'Medium', 'Big'][s - 1],
                'aria-label': ['Small', 'Medium', 'Big'][s - 1],
                onclick: () => {
                  g.size = s;
                  g.previewKey = '';
                  this.sound.play('ui');
                  this.buildToolOptions();
                },
              },
              h('span', { class: 'dot', style: `width:${6 + s * 5}px;height:${6 + s * 5}px` }),
            ),
          ),
        ),
      );
    }
    if (g.tool === 'hills') {
      groups.push(
        h(
          'div',
          { class: 'opt-group' },
          ...HILL_MODES.map((m) =>
            h(
              'button',
              {
                class: `pill${g.hillMode === m.key ? ' on' : ''}`,
                type: 'button',
                title: m.name,
                'aria-label': m.name,
                onclick: () => {
                  g.hillMode = m.key;
                  g.previewKey = '';
                  this.sound.play('ui');
                  this.buildToolOptions();
                },
              },
              m.icon,
            ),
          ),
        ),
      );
    }
    if (g.tool === 'stamp') {
      const s = STAMPS.find((x) => x.key === g.stamp);
      groups.push(h('div', { class: 'opt-group' }, h('button', { class: 'pill', type: 'button', title: 'Choose a stamp', onclick: () => this.toyBox('stamps') }, s?.icon ?? '🏠')));
    }
    if (g.tool === 'friends') {
      const vehicle = Boolean(CRITTER_INFO[g.critterType].vehicle);
      groups.push(h('div', { class: 'opt-group' }, h('button', { class: 'pill', type: 'button', title: vehicle ? 'Choose a vehicle' : 'Choose an animal', onclick: () => this.toyBox(vehicle ? 'vehicles' : 'animals') }, CRITTER_INFO[g.critterType].icon)));
    }
    opts.replaceChildren(...groups);
  }

  buildHotbar() {
    const g = this.game;
    const bar = $('hotbar');
    const hot = this.profile.data.hotbar;
    bar.replaceChildren(
      ...hot.map((id, i) =>
        h(
          'button',
          {
            class: `slot${i === g.slot && !g.basketPick ? ' on' : ''}`,
            type: 'button',
            title: B.block(id).name,
            'aria-label': B.block(id).name,
            onclick: () => this.selectSlot(i),
          },
          this.img(id, B.block(id).name),
          h('span', { class: 'num' }, String((i + 1) % 10)),
        ),
      ),
    );
  }

  selectSlot(i) {
    const g = this.game;
    g.slot = i;
    g.basketPick = null;
    if (g.tool === 'stamp' || g.tool === 'friends' || g.tool === 'pick' || g.tool === 'hills') g.setTool('build');
    g.previewKey = '';
    this.sound.play('ui');
    this.buildHotbar();
    this.renderBasket();
    this.buildToolOptions();
  }

  renderBasket() {
    const g = this.game;
    const el = $('basket');
    if (!g) {
      el.replaceChildren();
      return;
    }
    const b = this.profile.basket;
    el.replaceChildren(
      ...B.COLLECTABLES.filter((c) => b[c.key] > 0).map((c) =>
        h(
          'button',
          {
            class: g.basketPick === c.key ? 'on' : '',
            type: 'button',
            title: c.crop ? `${c.plural}: plant one on farmland or grass, or give one to an animal` : c.sprout ? `${c.plural}: plant one, or give one to an animal` : `${c.plural}: put one down`,
            onclick: () => this.pickBasket(c.key),
          },
          this.img(c.item, c.name),
          String(b[c.key]),
        ),
      ),
    );
    // A potion drunk or bought shows on the 🧪 button too (shop.js).
    this.renderPotion();
  }

  pickBasket(key) {
    const g = this.game;
    g.basketPick = g.basketPick === key ? null : key;
    if (g.basketPick) g.setTool('build');
    g.previewKey = '';
    this.sound.play('ui');
    this.renderBasket();
    this.buildHotbar();
    this.buildToolOptions();
    if (g.basketPick) {
      const c = B.COLLECTABLES.find((x) => x.key === key);
      if (c.crop) this.toast(B.cropByKey(key).icon, `Tap farmland or grass to plant ${withArticle(c.name.toLowerCase())}, or tap an animal to give it one!`);
      else this.toast(c.sprout ? '🌱' : '✨', c.sprout ? `Tap the ground to plant ${withArticle(c.key)} tree, or tap an animal to give it one!` : `Tap the ground to put down ${withArticle(c.name.toLowerCase())}.`);
    }
  }

  // The toy box: every block, plant, stamp and animal to choose from.
  toyBox(tab = null) {
    const g = this.game;
    // The shared isle stays just as it was made: its toy box stays shut.
    if (g?.shared) {
      this.sound.play('no');
      this.toast('🧸', `${g.world.name} stays just as it was made, so its toy box stays shut!`);
      return;
    }
    let current = tab ?? this.lastTab ?? 'bricks';
    const tabs = [...B.CATEGORIES, { key: 'stamps', name: 'Stamps', icon: '🏠' }, { key: 'animals', name: 'Animals', icon: '🐰' }, { key: 'vehicles', name: 'Vehicles', icon: '🚗' }];
    this.openModal((root) => {
      const tabRow = h('div', { class: 'tabs' });
      const grid = h('div', { class: 'grid' });
      const draw = () => {
        this.lastTab = current;
        tabRow.replaceChildren(
          ...tabs.map((t) =>
            h(
              'button',
              {
                class: `chip${t.key === current ? ' on' : ''}`,
                type: 'button',
                onclick: () => {
                  current = t.key;
                  this.sound.play('ui');
                  draw();
                },
              },
              t.icon,
              ' ',
              t.name,
            ),
          ),
        );
        if (current === 'stamps') {
          grid.replaceChildren(
            ...STAMPS.map((s) =>
              h(
                'button',
                {
                  class: `choice${g.tool === 'stamp' && g.stamp === s.key ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => {
                    g.stamp = s.key;
                    this.pickedStamp = true;
                    g.setTool('stamp');
                    this.closeModal();
                    this.toast(s.icon, `Tap the ground to put down the ${s.name.toLowerCase()}!`);
                  },
                },
                h('span', { class: 'emoji' }, s.icon),
                s.name,
              ),
            ),
          );
        } else if (current === 'animals' || current === 'vehicles') {
          const vehicles = current === 'vehicles';
          // The dragon comes last, locked until you have tamed a volcano
          // island's dragon TAMES_TO_INVITE times (dragon.js).
          const tames = this.profile.data.gear.tames ?? 0;
          const open = tames >= TAMES_TO_INVITE;
          const locked = h(
            'button',
            {
              class: 'choice locked',
              type: 'button',
              'aria-label': `Dragon, locked: tamed ${tames} of ${TAMES_TO_INVITE} times`,
              onclick: () => {
                this.sound.play('no');
                this.toast('🔒', `Tame the wild dragon on a 🌋 volcano island ${TAMES_TO_INVITE} times to bring your own! You have tamed it ${tames} ${tames === 1 ? 'time' : 'times'}.`);
              },
            },
            h('span', { class: 'emoji' }, '🐲'),
            'Dragon',
            h('small', {}, `🔒 ${tames}/${TAMES_TO_INVITE} tamed`),
          );
          grid.replaceChildren(
            ...(vehicles ? VEHICLES : open ? [...ANIMAL_TYPES, 'dragon'] : ANIMAL_TYPES).map((type) =>
              h(
                'button',
                {
                  class: `choice${g.tool === 'friends' && g.critterType === type ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => {
                    g.critterType = type;
                    this.pickedCritter = true;
                    g.setTool('friends');
                    this.closeModal();
                    const what = withArticle(CRITTER_INFO[type].name.toLowerCase());
                    this.toast(CRITTER_INFO[type].icon, vehicles ? `Tap the ground to bring ${what}! Tap a vehicle to send it away.` : `Tap the ground to invite ${what}! Tap an animal to say bye.`);
                  },
                },
                h('span', { class: 'emoji' }, CRITTER_INFO[type].icon),
                CRITTER_INFO[type].name,
              ),
            ),
            ...(vehicles || open ? [] : [locked]),
          );
        } else {
          grid.replaceChildren(
            ...B.blocksIn(current).map((id) =>
              h(
                'button',
                {
                  class: `choice${this.profile.data.hotbar[g.slot] === id ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => {
                    const hot = [...this.profile.data.hotbar];
                    const already = hot.indexOf(id);
                    if (already >= 0) g.slot = already;
                    else hot[g.slot] = id;
                    this.profile.update({ hotbar: hot });
                    g.basketPick = null;
                    if (g.tool !== 'paint' || !B.block(id).cube) g.setTool('build');
                    g.previewKey = '';
                    this.buildHotbar();
                    this.closeModal();
                    if (id === B.WATERING_CAN) this.toast('🚿', 'Tap farmland to water it: what grows there grows twice as fast!');
                    else if (id === B.FARMLAND) this.toast('🌱', 'Put down farmland, then plant vegetables from your basket in it. The 🛒 shop has some to start you off!');
                  },
                },
                this.img(id, B.block(id).name),
                B.block(id).name,
              ),
            ),
          );
        }
      };
      draw();
      root.append(h('h2', {}, '🧸 Toy box'), tabRow, grid);
    });
  }

  // Talking: type anything, or tap a phrase or a sticker. What has been said
  // on the island is above, to read again and copy; the box takes a paste.
  sayDialog() {
    const g = this.game;
    this.openModal(
      (root) => {
        const box = h('input', { type: 'text', class: 'text-input', maxLength: CHAT_MAX, autocomplete: 'off', enterKeyHint: 'send', placeholder: 'Type something…', 'aria-label': 'Type something to say' });
        const history = h('div', { class: 'chat-history', role: 'log', 'aria-label': 'What was said' });
        this.chatHistory = { el: history, box };
        const send = () => {
          const text = cleanChat(box.value);
          if (!text) {
            box.focus();
            return;
          }
          g.say({ t: 'say', text });
          this.closeModal();
        };
        root.append(
          h('h2', {}, '💬 Say something'),
          // Telling the grown-ups, rather than the island: ideas and problems, first so it is never scrolled away.
          this.canTellUs() ? h('button', { class: 'chip feedback-chip', type: 'button', onclick: () => this.feedbackDialog() }, '💌 An idea, or something went wrong?') : null,
          history,
          h(
            'form',
            {
              class: 'row say-row',
              onsubmit: (e) => {
                e.preventDefault();
                send();
              },
            },
            box,
            h('button', { class: 'chip on', type: 'submit' }, '📨 Send'),
          ),
          h(
            'div',
            { class: 'phrases' },
            ...PHRASES.map((text, i) =>
              h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  onclick: () => {
                    g.say({ t: 'say', p: i });
                    this.closeModal();
                  },
                },
                text,
              ),
            ),
          ),
          h(
            'div',
            { class: 'stickers-row' },
            ...STICKER_EMOJI.map((emoji, i) =>
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': `Sticker ${emoji}`,
                  onclick: () => {
                    g.say({ t: 'say', e: i });
                    this.closeModal();
                  },
                },
                emoji,
              ),
            ),
          ),
        );
        this.renderChatHistory();
        // With a keyboard, straight to typing; on a touch screen, the phrases first.
        if (!this.input.touchMode) setTimeout(() => box.focus(), 60);
      },
      { seeThrough: true, onClose: () => (this.chatHistory = null) },
    );
  }

  // The island's chat so far (the game keeps the last 30, those said before
  // you came too), the newest at the bottom and in view. Each line can be
  // selected, and 📋 copies it; where the clipboard is out of reach (a page
  // not on https), it goes into the box instead.
  renderChatHistory() {
    const g = this.game;
    const view = this.chatHistory;
    if (!g || !view?.el.isConnected) return;
    const lines = g.chat
      .map((m) => ({ m, text: typeof m.text === 'string' && m.text ? m.text : Number.isInteger(m.p) ? PHRASES[m.p] : STICKER_EMOJI[m.e] }))
      .filter((l) => l.text);
    const atEnd = view.el.scrollHeight - view.el.scrollTop - view.el.clientHeight < 8;
    view.el.hidden = !lines.length;
    view.el.replaceChildren(
      ...lines.map(({ m, text }) => {
        const who = m.pid === g.pid ? 'Me' : (m.name ?? g.players.get(m.pid)?.name ?? 'Someone');
        return h(
          'div',
          { class: `said${m.pid === g.pid ? ' mine' : ''}` },
          h('span', { class: 'said-text', lang: langOf(text) || undefined }, h('b', {}, `${who}: `), text),
          h(
            'button',
            {
              class: 'copy',
              type: 'button',
              'aria-label': `Copy “${text}”`,
              title: 'Copy',
              onclick: async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  this.toast('📋', 'Copied! Paste it anywhere you type.');
                } catch {
                  view.box.value = [...text].slice(0, CHAT_MAX).join('');
                  view.box.focus();
                }
              },
            },
            '📋',
          ),
        );
      }),
    );
    if (atEnd || !view.shown) view.el.scrollTop = view.el.scrollHeight;
    view.shown = true;
  }

  emoteDialog() {
    const g = this.game;
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '😊 Emotes'),
          h(
            'div',
            { class: 'grid' },
            ...EMOTES.map((e) =>
              h(
                'button',
                {
                  class: 'choice',
                  type: 'button',
                  onclick: () => {
                    g.emote(e.key);
                    this.closeModal();
                  },
                },
                h('span', { class: 'emoji' }, e.icon),
                e.name,
              ),
            ),
          ),
          this.hideSeekPart(),
        );
      },
      { narrow: true, seeThrough: true },
    );
  }

  // Hide and seek, in the island's window: 🙈 I'll be it! to start a round
  // with everyone else on the island hiding, or how the round is going,
  // and 🏳️ Stop for the seeker and the island's owner. It redraws itself as
  // the round changes.
  hideSeekPart() {
    const part = h('div', { class: 'hideseek-part' });
    const draw = () => {
      const g = this.game;
      if (!g) return;
      const r = g.hideseek;
      const friends = [...g.players.values()].filter((p) => p.id !== g.pid).length;
      const rows = [h('h3', {}, '🙈 Hide and seek')];
      if (!r || r.phase === 'done') {
        rows.push(
          h('p', { class: 'muted' }, 'Whoever is it shuts their eyes and counts to 20 while everyone else hides, then has 3 minutes to find them all. Come close with nothing in the way and you are found!'),
          friends
            ? h(
                'div',
                { class: 'row', style: 'justify-content:center' },
                h(
                  'button',
                  {
                    class: 'big green hideseek-start',
                    type: 'button',
                    onclick: () => {
                      g.hideSeekStart();
                      this.closeModal();
                    },
                  },
                  h('span', { class: 'emoji' }, '🙈'),
                  ' I’ll be it!',
                ),
              )
            : h('p', { class: 'muted' }, 'You need a friend on the island to play. Invite one!'),
        );
      } else {
        const hiding = r.hiders.filter((pid) => !r.found.includes(pid)).length;
        const who = r.seeker === g.pid ? 'You are' : `${g.players.get(r.seeker)?.name ?? 'A friend'} is`;
        rows.push(h('p', {}, r.phase === 'hide' ? `${who} counting while everyone hides.` : `${who} looking: ${r.found.length} found, ${hiding} still hiding.`));
        if (r.seeker === g.pid || g.pid === g.host)
          rows.push(
            h(
              'div',
              { class: 'row', style: 'justify-content:center' },
              h(
                'button',
                {
                  class: 'chip hideseek-stop',
                  type: 'button',
                  onclick: () => {
                    g.hideSeekStop();
                    this.closeModal();
                  },
                },
                '🏳️ Stop the round',
              ),
            ),
          );
      }
      part.replaceChildren(...rows);
    };
    this.drawHideSeekPart = draw;
    draw();
    return part;
  }

  inviteDialog() {
    const g = this.game;
    const handlers = this.gameHandlers;
    this.openModal(
      (root) => {
        root.append(h('h2', {}, `🏝️ ${g.world?.name ?? 'Island'}`));
        if (g.shared) root.append(h('p', { class: 'muted' }, '🌟 Everyone’s island: anybody can come, and the more of you there are, the sooner it is free.'));
        if (handlers.canInvite()) {
          const link = handlers.inviteLink();
          root.append(
            h('p', {}, 'Tell your friends this code. They choose “Visit a friend” and type it in:'),
            h('div', { class: 'big-code' }, prettyCode(g.code)),
            h(
              'div',
              { class: 'row', style: 'justify-content:center' },
              h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  onclick: async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      this.toast('📋', 'Invite link copied! Ask a grown-up to send it to your friend.');
                    } catch {
                      this.toast('🙈', 'Could not copy. Read the code out loud instead!', 'warn');
                    }
                  },
                },
                '📋 Copy invite link',
              ),
            ),
          );
        } else {
          root.append(h('p', {}, 'You are playing alone on this island. Open it to friends in ⚙️ Settings.'));
        }
        if (g.pid === g.host && g.passcode) {
          root.append(h('p', { class: 'passcode-line' }, '🔒 Passcode ', h('b', { class: 'passcode' }, g.passcode), ': new friends type it to come in.'));
        } else if (g.settings.passcode) {
          root.append(h('p', { class: 'muted' }, '🔒 This island has a passcode.'));
        }
        if (g.song) root.append(h('p', { class: 'muted song-line' }, '🎵 The island song: ', h('b', { lang: langOf(g.song.name) || undefined }, g.song.name)));
        root.append(this.hideSeekPart());
        const adv = g.adventure;
        if (adv) {
          const camps = [...adv.camps.values()];
          const castle = camps.find((c) => c.kind === 'castle');
          // The shared isle says which of its stages this is; any other
          // adventure island is stage 1, where it goes without saying.
          const staged = g.shared || adv.stage > 1;
          root.append(
            h('h3', {}, adv.won ? '🏆 This island is free!' : `⚔️ Adventure${staged ? ` — stage ${adv.stage}` : ''}`),
            h(
              'div',
              { class: 'adventure-list' },
              ...(staged ? [h('div', { class: 'camp' }, '🌟', ' Stage', h('span', { class: 'muted' }, String(adv.stage)))] : []),
              ...camps
                .filter((c) => c.kind === 'camp')
                .map((c) => h('div', { class: `camp${c.freed ? ' free' : ''}` }, c.freed ? '🚩' : '🏴', ` Camp ${c.id}`, h('span', { class: 'muted' }, c.freed ? 'free' : c.progress > 0 ? `${Math.floor(c.progress * 100)}%` : 'monsters'))),
              castle ? h('div', { class: `camp castle${adv.won ? ' free' : ''}` }, '👑', ' King Grumble', h('span', { class: 'muted' }, adv.won ? 'popped' : adv.shield ? 'in his bubble 🫧' : 'ready to pop!')) : '',
            ),
            adv.won && g.quizOffer && (!g.quizOffer.taken.junior || !g.quizOffer.taken.senior)
              ? h('p', { class: 'muted' }, '🎓 Extra-credit quizzes by the flag: one at elementary school Year 2 level, one at middle school Year 3. Every answer right pays!')
              : adv.won
                ? ''
                : h('p', { class: 'muted' }, 'Pop the monsters of a camp, then stand by its flag together to raise yours. More friends, faster!'),
          );
        }
        const def = g.defense;
        if (def) {
          const built = def.pads.filter((p) => p.level > 0).length;
          root.append(
            h('h3', {}, def.state === 'won' ? '🏆 This island is safe!' : '🗼 Tower defense'),
            h(
              'div',
              { class: 'adventure-list' },
              h('div', { class: `camp${def.state === 'won' ? ' free' : ''}` }, '🌊', ' Wave', h('span', { class: 'muted' }, def.state === 'won' ? 'all seen off' : `${def.wave} of ${def.waves}${def.state === 'march' ? ', coming!' : ''}`)),
              h('div', { class: 'camp' }, '🌟', ' Star Stone', h('span', { class: 'muted' }, `${def.hearts} of ${def.max} hearts`)),
              h('div', { class: 'camp' }, '🗼', ' Towers', h('span', { class: 'muted' }, `${built} of ${def.pads.length} pads`)),
              h('div', { class: 'camp' }, '🧱', ' Bricks', h('span', { class: 'muted' }, String(def.bricks))),
            ),
            def.state === 'won' ? '' : h('p', { class: 'muted' }, 'Stand by a wooden pad beside the road to build a tower there, and again to make it bigger. Pop monsters for more bricks!'),
          );
        }
        root.append(h('p', { class: 'muted', style: 'margin-top:12px' }, `${g.players.size} ${g.players.size === 1 ? 'player' : 'players'} here now.`));
        // Players with a login, to invite one who is playing now.
        if (this.handlers?.login?.available()) {
          root.append(h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' }, h('button', { class: 'chip', type: 'button', onclick: () => this.playersDialog() }, '👫 Invite a player')));
        }
      },
      { narrow: true },
    );
  }

  // The island's passcode, for its owner: off, anyone can come in; on, new
  // visitors type its four numbers (🎲 rolls new ones). Friends who came in
  // before come back without it.
  passcodeSetting() {
    const g = this.game;
    const handlers = this.gameHandlers;
    const el = h('div', { class: 'passcode-setting' });
    const draw = () => {
      const on = Boolean(g.passcode);
      const sw = h('button', { class: `switch${on ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': 'Passcode' });
      sw.onclick = () => {
        this.sound.play('ui');
        set(on ? '' : randomPasscode());
      };
      const detail = on
        ? h('div', { class: 'muted' }, 'New visitors type ', h('b', { class: 'passcode' }, g.passcode), ' to come in.')
        : h('div', { class: 'muted' }, `Anyone can come in. Turn on so new visitors need ${PASSCODE_LENGTH} numbers.`);
      el.replaceChildren(h('div', { class: 'setting' }, h('div', {}, h('b', {}, '🔒 Passcode'), detail), sw));
      if (!on) return;
      const box = h('input', { type: 'text', class: 'text-input passcode-input', inputmode: 'numeric', maxLength: PASSCODE_LENGTH, value: g.passcode, autocomplete: 'off', 'aria-label': 'Change the passcode' });
      box.addEventListener('input', () => (box.value = box.value.replace(/\D/g, '').slice(0, PASSCODE_LENGTH)));
      box.addEventListener('change', () => {
        if (box.value.length === PASSCODE_LENGTH) {
          if (box.value !== g.passcode) set(box.value);
          return;
        }
        this.sound.play('no');
        this.toast('🙈', `A passcode has ${PASSCODE_LENGTH} numbers.`, 'warn');
        box.value = g.passcode;
      });
      box.addEventListener('keydown', (e) => e.key === 'Enter' && box.blur());
      const roll = h(
        'button',
        {
          class: 'chip',
          type: 'button',
          onclick: () => {
            this.sound.play('ui');
            set(randomPasscode());
          },
        },
        '🎲 New numbers',
      );
      el.append(h('div', { class: 'row passcode-row' }, box, roll));
    };
    // Shown at once; the island tells everyone it has one, and its owner the numbers.
    const set = (passcode) => {
      handlers.setPasscode(passcode);
      g.passcode = passcode;
      g.settings = { ...g.settings, passcode: passcode !== '' };
      draw();
    };
    draw();
    return el;
  }

  // The island's song, for its owner: an MP3 from their device that plays
  // for everyone instead of the island music, or the island music again.
  songSetting() {
    const g = this.game;
    const handlers = this.gameHandlers;
    const el = h('div', { class: 'song-setting' });
    const file = h('input', { type: 'file', accept: '.mp3,audio/mpeg', hidden: true, 'aria-label': 'Pick an MP3 song' });
    let busy = false;
    file.addEventListener('change', async () => {
      const picked = file.files?.[0];
      file.value = '';
      if (!picked) return;
      busy = true;
      draw();
      const problem = await handlers.playSong(picked);
      busy = false;
      if (problem) {
        this.sound.play('no');
        this.toast('🙈', problem, 'warn');
      }
      draw();
    });
    const draw = () => {
      const song = g.song;
      const detail = busy
        ? 'Getting the song ready…'
        : song
          ? h('span', {}, song.ready ? '▶️ ' : '⏳ ', h('b', { class: 'song-name', lang: langOf(song.name) || undefined }, song.name))
          : 'Play an MP3 from your device for everyone here, instead of the island music.';
      el.replaceChildren(
        h('div', { class: 'setting' }, h('div', {}, h('b', {}, '🎵 Island song'), h('div', { class: 'muted' }, detail))),
        h(
          'div',
          { class: 'row song-row' },
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              disabled: busy,
              onclick: () => {
                this.sound.unlock();
                this.sound.play('ui');
                file.click();
              },
            },
            song ? '🎵 Pick another song' : '🎵 Pick an MP3',
          ),
          song
            ? h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  disabled: busy,
                  onclick: async () => {
                    this.sound.play('ui');
                    await handlers.playSong(null);
                    draw();
                  },
                },
                '🎶 Island music',
              )
            : null,
        ),
        file,
      );
    };
    this.drawSong = draw;
    draw();
    return el;
  }

  // Where the camera looks from, picked outright; 🎥 and L step through the same.
  viewSetting() {
    const r = this.game.renderer;
    const row = h('div', { class: 'row' });
    const draw = () =>
      row.replaceChildren(
        ...Object.entries(VIEW_NAMES).map(([name, words]) =>
          h('button', { class: `chip${r.viewName === name ? ' on' : ''}`, type: 'button', 'data-view': name, onclick: () => {
            this.sound.play('ui');
            r.setView(name);
            draw();
          } }, `${VIEW_ICONS[name]} ${words[0].toUpperCase()}${words.slice(1)}`),
        ),
      );
    draw();
    return h('div', { class: 'setting' }, h('b', {}, '🎥 Look'), row);
  }

  // How finished the picture is (quality.js): Auto, or one picked outright.
  qualitySetting() {
    const p = this.profile;
    const row = h('div', { class: 'row' });
    const draw = () =>
      row.replaceChildren(
        ...QUALITY_CHOICES.map((key) =>
          h('button', { class: `chip${(p.settings.quality ?? 'auto') === key ? ' on' : ''}`, type: 'button', 'data-quality': key, onclick: () => {
            this.sound.play('ui');
            p.setting('quality', key);
            this.gameHandlers.applySettings();
            draw();
          } }, QUALITY_WORDS[key]),
        ),
      );
    draw();
    return h('div', { class: 'setting' }, h('b', {}, '🖼️ Picture'), row);
  }

  settingsDialog() {
    const g = this.game;
    const handlers = this.gameHandlers;
    const p = this.profile;
    const isHost = g.pid === g.host;
    this.openModal((root) => {
      const toggle = (on, label, detail, fn) => {
        const sw = h('button', { class: `switch${on ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label });
        sw.onclick = () => {
          on = !on;
          sw.classList.toggle('on', on);
          sw.setAttribute('aria-checked', String(on));
          this.sound.play('ui');
          fn(on);
        };
        return h('div', { class: 'setting' }, h('div', {}, h('b', {}, label), detail ? h('div', { class: 'muted' }, detail) : null), sw);
      };
      root.append(
        h('h2', {}, '⚙️ Settings'),
        this.soundSettings(),
        toggle(p.settings.studs, '🔵 Bumpy bricks', 'The round bumps on top of blocks.', (on) => {
          p.setting('studs', on);
          handlers.applySettings();
        }),
        toggle(p.settings.autoJump, '🦘 Hop up steps by myself', null, (on) => p.setting('autoJump', on)),
        toggle(p.settings.map, '🗺️ Little map', 'Where you, your friends and the animals are.', (on) => {
          p.setting('map', on);
          this.renderMap();
        }),
        this.viewSetting(),
        this.qualitySetting(),
      );
      if (handlers.keeper?.config && handlers.login?.who()) {
        // Logged in, copies always go: that is what the login is for.
        root.append(h('div', { class: 'setting' }, h('div', {}, h('b', {}, `🔑 Logged in as ${handlers.login.username() || p.name}`), h('div', { class: 'muted keeper-status' }, this.keeperText()))));
      } else if (handlers.keeper?.config) {
        root.append(
          toggle(p.settings.keeper !== false, '💾 Safe copies', h('span', { class: 'keeper-status' }, this.keeperText()), (on) => {
            p.setting('keeper', on);
            handlers.keeper.setEnabled(on);
            this.renderKeeper();
          }),
        );
      }
      const full = this.fullscreenSetting();
      if (full) root.append(full);
      if (isHost) {
        root.append(h('h3', {}, '🏝️ Island rules'));
        if (handlers.canToggleOnline()) {
          root.append(toggle(handlers.isOnline(), '👫 Friends can visit', 'Friends join with your island code.', (on) => handlers.setOnline(on)));
        }
        root.append(
          toggle(g.settings.build === 'everyone', '🧱 Friends can build', 'Turn off so only you can change the island.', (on) =>
            g.send({ t: 'host', cmd: 'settings', settings: { build: on ? 'everyone' : 'host' } }),
          ),
          toggle(g.settings.locked, '🚪 No new visitors', 'Friends already here can stay.', (on) => g.send({ t: 'host', cmd: 'settings', settings: { locked: on } })),
          this.passcodeSetting(),
          toggle(Boolean(g.settings.monsters), '👾 Monsters', MONSTERS_ABOUT, (on) => g.send({ t: 'host', cmd: 'settings', settings: { monsters: on } })),
          this.songSetting(),
        );
        const dayRow = h('div', { class: 'row' });
        const days = [
          ['cycle', '🌗 Day and night'],
          ['day', '☀️ Always day'],
          ['night', '🌙 Always night'],
        ];
        const drawDays = () =>
          dayRow.replaceChildren(
            ...days.map(([key, label]) =>
              h(
                'button',
                {
                  class: `chip${g.settings.day === key ? ' on' : ''}`,
                  type: 'button',
                  onclick: () => {
                    g.send({ t: 'host', cmd: 'settings', settings: { day: key } });
                    g.settings = { ...g.settings, day: key };
                    this.sound.play('ui');
                    drawDays();
                  },
                },
                label,
              ),
            ),
          );
        drawDays();
        root.append(h('div', { class: 'setting' }, h('b', {}, 'Time'), dayRow));
      }
      const others = [...g.players.values()].filter((q) => q.id !== g.pid);
      if (others.length) {
        root.append(
          h('h3', {}, '👫 Friends here'),
          ...others.map((q) =>
            h(
              'div',
              { class: 'player-row' },
              h('span', { class: 'friend', style: `--c:${shirtColor(q.look.shirt)}` }, lookIcon(q.look)),
              h('span', { class: 'who' }, levelTag(q.look), q.name, q.id === g.host ? ' 🏝️' : ''),
              isHost
                ? h(
                    'button',
                    {
                      class: 'chip',
                      type: 'button',
                      onclick: () =>
                        this.confirm(`Send ${q.name} home?`, '👋 Send home', () => {
                          g.send({ t: 'host', cmd: 'kick', pid: q.id });
                        }),
                    },
                    '👋 Send home',
                  )
                : null,
            ),
          ),
        );
      }
      root.append(
        h(
          'div',
          { class: 'row', style: 'margin-top:18px' },
          handlers.canSave() ? h('button', { class: 'chip', type: 'button', onclick: () => handlers.saveFile() }, '💾 Save island to a file') : null,
          h('button', { class: 'chip', type: 'button', onclick: () => this.meDialog() }, '🎨 Change me'),
          h('button', { class: 'chip', type: 'button', onclick: () => this.petDialog() }, '🐾 My pet'),
          this.reportButton('chip'),
          this.ideaButton('chip'),
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onclick: () => {
                this.closeModal();
                handlers.leave();
              },
            },
            '🚪 Leave island',
          ),
        ),
      );
    });
  }

  // Saves a picture of the island (without the buttons) to the device, and
  // counts towards the 📸 Photographer sticker (5 of them) — on whichever
  // world you are in: your own, or the isle's own there.
  takePhoto() {
    const g = this.game;
    if (!g) return;
    let url;
    try {
      url = g.renderer.photo();
    } catch {
      this.toast('🙈', 'The camera did not work this time.', 'warn');
      return;
    }
    const flash = $('flash');
    flash.hidden = true;
    void flash.offsetWidth;
    flash.hidden = false;
    setTimeout(() => (flash.hidden = true), 520);
    this.sound.play('photo');
    g.profile?.count('photos');
    const a = document.createElement('a');
    const name = (g.world?.name ?? 'island').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${name}-photo.png`;
    document.body.append(a);
    a.click();
    a.remove();
    this.toast('📸', 'Click! Your photo is saved.');
  }

  // The big map: the whole island, everyone's names and the animals.
  mapDialog() {
    const g = this.game;
    if (!g?.world) return;
    this.openModal(
      (root) => {
        const canvas = h('canvas', { class: 'big-map', role: 'img', 'aria-label': `Map of ${g.world.name}` });
        root.append(h('h2', {}, `🗺️ ${g.world.name}`), canvas, h('p', { class: 'muted map-note' }, 'The yellow arrow is you!'));
        this.minimap.big = canvas;
      },
      { onClose: () => (this.minimap.big = null) },
    );
    // Now, not a frame later: there is no next frame in a tab that is not being shown.
    this.minimap.draw();
  }

  // ------------------------------------------------ live parts of the HUD

  // The little map, unless it was switched off in Settings.
  renderMap() {
    const off = !this.profile.settings.map;
    $('minimap').hidden = off;
    this.minimap.hidden = off;
    this.minimap.relayout();
  }

  renderIsland() {
    const g = this.game;
    if (!g?.world) return;
    $('island-name').textContent = `${THEME_ICON[g.world.theme] ?? '🏝️'} ${g.world.name}`;
    $('island-code').textContent = this.gameHandlers?.canInvite() ? `Code ${prettyCode(g.code)}` : 'Playing alone';
  }

  // Your HP, shown while the island has monsters (or camps to free): the
  // number and a bar, going amber and then red as it runs low, and a shake
  // when a bump takes some. On an adventure island, how many camps are free too.
  renderHp() {
    const el = $('hearts');
    const row = $('hp-row');
    const g = this.game;
    const adv = g?.adventure;
    const shown = Boolean(g?.settings.monsters) || Boolean(adv && !adv.won);
    el.hidden = !shown;
    row.hidden = !shown;
    if (!shown) {
      this.hpShown = Infinity;
      this.renderPotion();
      return;
    }
    const { hp, maxHp } = g;
    const share = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const camps = adv ? [...adv.camps.values()].filter((c) => c.kind === 'camp') : [];
    const freed = camps.filter((c) => c.freed).length;
    el.setAttribute('aria-label', `${hp} of ${maxHp} HP${adv ? `, ${freed} of ${camps.length} camps free` : ''}`);
    el.replaceChildren(
      h('span', { class: 'hp-label' }, '❤️ HP'),
      h('span', { class: `hp-bar${share <= 0.25 ? ' low' : share <= 0.5 ? ' half' : ''}` }, h('span', { style: `width: ${(share * 100).toFixed(1)}%` })),
      h('span', { class: 'hp-num' }, `${hp}/${maxHp}`),
      adv ? h('span', { class: 'camps' }, `🚩 ${freed}/${camps.length}`) : '',
    );
    if (hp < (this.hpShown ?? Infinity)) {
      el.classList.remove('hurt');
      void el.offsetWidth;
      el.classList.add('hurt');
    }
    this.hpShown = hp;
    this.renderPotion();
  }

  // The 🧪 button by your HP (shop.js): a potion to drink, there whenever
  // you have one and there is something to drink it for — some HP missing,
  // or sitting dizzy on an adventure island.
  renderPotion() {
    const el = $('btn-potion');
    const g = this.game;
    const n = this.profile?.data.potions ?? 0;
    const drinkable = Boolean(g) && !g.closed && n > 0 && (g.hp < g.maxHp || g.dizzy);
    el.hidden = !drinkable;
    if (!drinkable) return;
    const text = `🧪 ${n}`;
    if (el.textContent !== text) el.textContent = text;
    el.setAttribute('aria-label', `Drink an HP potion (${n} left)`);
  }

  // A round of hide and seek: over the hotbar, the count or the time left
  // and how many are found; the seeker, counting, sees only the count.
  // Called every frame, so it changes only what changed.
  renderHideSeek() {
    const g = this.game;
    const r = g?.hideseek;
    const el = $('hideseek');
    const fold = $('blindfold');
    const left = g ? g.hideSeekLeft() : 0;
    const counting = Boolean(g?.counting);
    if (fold.hidden === counting) fold.hidden = !counting;
    if (counting && $('blindfold-count').textContent !== String(left)) $('blindfold-count').textContent = String(left);
    const key = r ? `${r.phase}|${r.seeker}|${r.hiders.join()}|${r.found.join()}|${left}` : '';
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.hidden = !r;
    if (!r) return;
    const name = (pid) => (pid === g.pid ? 'You' : (g.players.get(pid)?.name ?? 'A friend'));
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const found = h('span', { class: 'found' }, `👀 ${r.found.length}/${r.hiders.length}`);
    const me = r.seeker === g.pid ? 'seeker' : r.found.includes(g.pid) ? 'found' : r.hiders.includes(g.pid) ? 'hider' : 'watching';
    if (r.phase === 'hide') {
      el.replaceChildren(h('span', {}, `🙈 ${name(r.seeker)} ${r.seeker === g.pid ? 'are' : 'is'} counting: ${left}`), h('span', { class: 'muted' }, me === 'hider' ? 'Hide!' : 'Shh…'));
    } else if (r.phase === 'seek') {
      el.replaceChildren(h('span', {}, `🔍 ${clock}`), found, h('span', { class: 'muted' }, { seeker: 'Find them!', found: 'Found!', hider: 'Stay hidden!', watching: `${name(r.seeker)} is it` }[me]));
    } else {
      el.replaceChildren(h('span', {}, '🙈 Hide and seek is over'), found);
    }
  }

  // On a tower defense island: the wave, the Star Stone's hearts and the
  // bricks to build with; a shake when the Star Stone loses a heart.
  renderDefense() {
    const el = $('defense');
    const d = this.game?.defense;
    el.hidden = !d;
    if (!d) return;
    const wave = d.state === 'won' ? '🏆 Safe!' : `🌊 ${d.wave}/${d.waves}`;
    el.setAttribute('aria-label', `${d.state === 'won' ? 'Every wave seen off' : `Wave ${d.wave} of ${d.waves}`}, the Star Stone has ${d.hearts} of ${d.max} hearts, ${d.bricks} bricks`);
    el.replaceChildren(h('span', {}, wave), h('span', { class: 'stone' }, `🌟 ${d.hearts}`), h('span', {}, `🧱 ${d.bricks}`), d.state === 'march' && d.left ? h('span', { class: 'muted' }, `👾 ${d.left}`) : '');
    if (d.hearts < (this.stoneShown ?? d.max)) {
      el.classList.remove('hurt');
      void el.offsetWidth;
      el.classList.add('hurt');
    }
    this.stoneShown = d.hearts;
  }

  setStatus(state, text) {
    const el = $('status');
    const icon = { online: '🟢', offline: '', connecting: '🟡', reconnecting: '🟡', 'id-taken': '🟡', failed: '🔴' }[state] ?? '';
    el.textContent = state === 'online' || state === 'offline' ? '' : `${icon} ${text}`;
    this.renderIsland();
  }

  renderFriends() {
    const g = this.game;
    if (!g) return;
    $('friends').replaceChildren(
      ...[...g.players.values()].map((p) =>
        h('span', { class: 'friend', style: `--c:${shirtColor(p.look.shirt)}`, title: p.name }, lookIcon(p.look)),
      ),
    );
  }

  chatLine(msg) {
    const g = this.game;
    const who = g?.players.get(msg.pid)?.name ?? 'Someone';
    const el = h('div', { class: 'line', lang: langOf(msg.text) || undefined }, h('b', {}, `${who}: `), msg.text);
    $('chatlog').append(el);
    this.renderChatHistory();
    while ($('chatlog').children.length > 5) $('chatlog').firstElementChild.remove();
    this.chatRoom.observe(el);
    setTimeout(() => {
      this.chatRoom.unobserve(el);
      el.remove();
    }, 8200);
  }

  aimHint(aim) {
    const el = $('aim-hint');
    const g = this.game;
    if (aim?.kind === 'critter') {
      const c = g.critters.get(aim.id);
      const info = CRITTER_INFO[c?.type];
      el.textContent = c ? `${info.icon} ${c.name || info.name}${g.tool === 'friends' ? ' — tap to say bye' : info.vehicle ? ' — tap to honk' : ' — tap to pet'}` : '';
      el.hidden = !c;
    } else if (aim?.kind === 'pet') {
      const pet = g.pets.get(aim.pid);
      const kind = petKind(pet?.kind);
      const owner = aim.pid === g.pid ? '' : g.players.get(aim.pid)?.name;
      el.textContent = pet && kind ? `${kind.icon} ${pet.name}${owner ? ` (${owner}'s ${kind.name.toLowerCase()})` : ''} — tap to pet` : '';
      el.hidden = !pet || !kind;
    } else if (aim?.kind === 'monster') {
      const king = g.monsters.get(aim.id)?.kind === 'king';
      const press = g.touch ? `press ${$('btn-attack').textContent}` : 'press X';
      el.textContent = !king ? `👾 Monster — walk up and ${press} to bop it!` : g.adventure?.shield ? '🫧 King Grumble is in his bubble' : `👑 King Grumble — walk up and ${press} to bop him!`;
      el.hidden = false;
    } else if (aim?.kind === 'friend') {
      el.textContent = `🤝 ${g.players.get(aim.pid)?.name ?? 'A friend'} is dizzy — tap to help them up!`;
      el.hidden = false;
    } else if (aim?.kind === 'far') {
      el.textContent = 'Too far away — walk closer!';
      el.hidden = false;
    } else if (aim?.kind === 'block' && (B.CROP_OF[aim.hit.id] || B.SOIL[aim.hit.id])) {
      // How a crop is getting on, and whether its farmland is watered.
      const { x, y, z, id } = aim.hit;
      const crop = B.cropOf(id);
      const wet = B.SOIL[crop ? g.world.get(x, y - 1, z) : id] === 2;
      if (crop) el.textContent = `${crop.icon} ${crop.plural} — ${['just planted', 'sprouting', 'growing', 'ripe! Tap to pick'][B.STAGE_OF[id]]}${wet ? ' 💧' : ''}`;
      else el.textContent = wet ? '💧 Watered farmland — plant vegetables in it' : '🌱 Farmland — plant vegetables in it, and water it';
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  // Ride, beside the big animal next to you, and Get off, beside you while
  // you ride (or near the top, seeing through your own eyes): kept on the
  // screen, clear of the top bar, the toasts and the hotbar.
  rideButton(g, r) {
    if (!g.riding && !g.aboard && (g.seat || (!g.rideTarget && g.seatTarget))) {
      this.seatButton(g, r);
      return;
    }
    if (!g.riding && !g.aboard && !g.rideTarget && !g.seat && !g.seatTarget && (g.arcadeTarget || g.gashaTarget || g.pianoTarget || g.tvTarget || g.stationTarget || g.classTarget || g.drawTarget || g.stoveTarget || g.goTarget)) {
      this.arcadeButton(g, r);
      return;
    }
    const el = $('ride');
    const on = g.riding ?? g.aboard;
    const c = g.critters.get(on?.id ?? g.rideTarget);
    const at = on ? g.players.get(g.pid)?.avatar?.root.position : c?.model.group.position;
    if (!c || !at || this.modalOpen) {
      el.hidden = true;
      return;
    }
    const info = CRITTER_INFO[c.type];
    const touch = this.input.touchMode;
    // With someone at the wheel, the others hop on to ride along, as
    // everyone does on a fun park's rides.
    const verb = info.vehicle ? (c.rider || info.fixed ? 'Hop on' : 'Drive') : 'Ride';
    const label = on ? (info.vehicle ? '👋 Get out' : '👋 Get off') : `${info.icon} ${verb}`;
    const key = `${label}|${touch}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'Q'));
      el.setAttribute('aria-label', on ? label.slice(3) : `${verb} ${c.name || info.name}`);
    }
    // (By a fun park's ride, down where you get on, not up by its middle.)
    const scr = r.project(at.x, at.y + (on ? 1 : info.fixed ? 1.6 : c.model.center), at.z);
    if (!scr.visible && !on) {
      el.hidden = true;
      return;
    }
    const w = r.canvas.clientWidth;
    const hgt = r.canvas.clientHeight;
    const width = el.offsetWidth || 150;
    const x = scr.visible ? scr.x + 60 + width / 2 : w / 2;
    const y = scr.visible ? scr.y + 24 : 220;
    el.style.transform = `translate(${Math.min(w - 90 - width / 2, Math.max(16 + width / 2, x))}px, ${Math.min(hgt - 150, Math.max(200, y))}px) translate(-50%, -100%)`;
    el.hidden = false;
  }

  // Sit (or Lie down), beside the chair, sofa or bed next to you, and Get up
  // while you sit there: the Ride button, for seats.
  seatButton(g, r) {
    const el = $('ride');
    const cell = g.seat ?? g.seatTarget;
    const seat = seatOf(g.world.get(cell.x, cell.y, cell.z));
    if (!seat || this.modalOpen) {
      el.hidden = true;
      return;
    }
    const touch = this.input.touchMode;
    const label = g.seat ? (g.atStudyDesk ? '📚 Study' : '👋 Get up') : seat.pose === 'lie' ? '🛏️ Lie down' : '🪑 Sit';
    const key = `${label}|${touch}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'Q'));
      el.setAttribute('aria-label', label.slice(label.indexOf(' ') + 1));
    }
    const scr = r.project(cell.x + 0.5, cell.y + 1, cell.z + 0.5);
    const w = r.canvas.clientWidth;
    const hgt = r.canvas.clientHeight;
    const width = el.offsetWidth || 150;
    const x = scr.visible ? scr.x + 60 + width / 2 : w / 2;
    const y = scr.visible ? scr.y + 24 : 220;
    el.style.transform = `translate(${Math.min(w - 90 - width / 2, Math.max(16 + width / 2, x))}px, ${Math.min(hgt - 150, Math.max(200, y))}px) translate(-50%, -100%)`;
    el.hidden = false;
  }

  // Play, beside an arcade machine or a piano next to you, Turn beside a
  // gashapon machine, Watch beside a TV, or Go live beside a broadcast
  // station, Class beside a chalkboard, Draw beside a drawing board, or Cook
  // beside a stove: the same button again.
  arcadeButton(g, r) {
    const el = $('ride');
    const t = g.arcadeTarget ?? g.gashaTarget ?? g.pianoTarget ?? g.tvTarget ?? g.stationTarget ?? g.classTarget ?? g.drawTarget ?? g.stoveTarget ?? g.goTarget;
    if (!t || this.modalOpen) {
      el.hidden = true;
      return;
    }
    const touch = this.input.touchMode;
    const label = t.game ? '🕹️ Play' : t === g.pianoTarget ? '🎹 Play' : t === g.tvTarget ? '📺 Watch' : t === g.stationTarget ? '📹 Go live' : t === g.classTarget ? '✏️ Class' : t === g.drawTarget ? '🎨 Draw' : t === g.stoveTarget ? '🍳 Cook' : t === g.goTarget ? '⚫ Play Go' : t.monster ? '👾 Turn' : '🎁 Turn';
    const key = `${label}|${touch}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'Q'));
      el.setAttribute('aria-label', t.game ? `Play ${ARCADE_GAMES[t.game].name} at this machine` : t === g.pianoTarget ? `Play the ${t.grand ? 'grand piano' : 'piano'}` : t === g.tvTarget ? `Watch the ${t.name}` : t === g.stationTarget ? 'Go live at the broadcast station' : t === g.classTarget ? 'Have a class at the chalkboard' : t === g.drawTarget ? 'Draw on the drawing board' : t === g.stoveTarget ? 'Have a cooking class at the stove' : t === g.goTarget ? 'Play Go at this board' : t.monster ? 'Turn the Monster Gashapon for a monster figure' : 'Turn the gashapon machine for a capsule toy');
    }
    const scr = r.project(t.x + 0.5, t.y + 1.2, t.z + 0.5);
    const w = r.canvas.clientWidth;
    const hgt = r.canvas.clientHeight;
    const width = el.offsetWidth || 150;
    const x = scr.visible ? scr.x + 60 + width / 2 : w / 2;
    const y = scr.visible ? scr.y + 24 : 220;
    el.style.transform = `translate(${Math.min(w - 90 - width / 2, Math.max(16 + width / 2, x))}px, ${Math.min(hgt - 150, Math.max(200, y))}px) translate(-50%, -100%)`;
    el.hidden = false;
  }

  // The game at the arcade machine you pressed Play at, in a window: how it
  // is going, everyone who is at it, and the playing itself. Kept up to
  // date as the island tells of it (renderArcade).
  arcadeDialog() {
    const g = this.game;
    const t = g?.arcadeAt;
    if (!t) return;
    const def = ARCADE_GAMES[t.game];
    const blob = t.game === 'blob';
    this.arcadeEls = null;
    this.openModal(
      (root) => {
        const grid = h('div', { class: `arcade-grid ${blob ? 'holes' : 'cards'}`, role: 'group', 'aria-label': def.name });
        const cells = [];
        const n = blob ? 9 : 16;
        for (let i = 0; i < n; i++) {
          const el = h('button', { class: blob ? 'hole' : 'card', type: 'button', 'aria-label': blob ? `Hole ${i + 1}` : `Card ${i + 1}` }, blob ? '' : '?');
          el.onclick = () => {
            this.sound.unlock();
            if (blob) g.arcadeBop(i);
            else g.arcadeFlip(i);
          };
          cells.push(el);
          grid.append(el);
        }
        const play = h('button', { class: 'big green arcade-play', type: 'button', onclick: () => g.arcadePlay() }, '▶ Play');
        this.arcadeEls = { title: def, grid, cells, status: h('div', { class: 'arcade-status' }), players: h('div', { class: 'arcade-players' }), play, blob };
        root.append(h('h2', {}, `${def.icon} ${def.name}`), this.arcadeEls.status, grid, this.arcadeEls.players, play, h('p', { class: 'muted arcade-how' }, def.how));
      },
      { onClose: () => {
        this.arcadeEls = null;
        g.closeArcade();
      } },
    );
    this.renderArcade();
  }

  // The game's window, as it changes: what is in each hole or on each card,
  // the score or the pairs, whose go it is, who is at the machine, and
  // whether Play is there to be pressed. Only what changed is touched, so a
  // tap never lands on a button that was swapped under it.
  renderArcade() {
    const g = this.game;
    const els = this.arcadeEls;
    if (!g?.arcadeAt || !els || !this.modalOpen) return;
    const s = g.arcade.get(g.arcadeAt.key) ?? null;
    const name = (pid) => (pid === g.pid ? 'You' : g.players.get(pid)?.name ?? 'A friend');
    // What is going on: a count, a round, the scores after, or nothing yet.
    const phase = s ? s.p : -1;
    let status = '';
    if (els.blob) {
      if (phase === 0) status = `Get ready… ${Math.max(0, s.t)}!`;
      else if (phase === 1) status = `Score ${s.s} · ${Math.max(0, s.t)}s left`;
      else if (phase === 2) status = `All done — a score of ${s.s} together!`;
      else status = 'Press Play to start a round!';
    } else {
      const found = s ? s.ps.reduce((n, [, p]) => n + p, 0) : 0;
      if (phase === 1) status = s.w ? 'No, not a pair…' : `${s.t === g.pid ? 'Your turn' : `${name(s.t)}'s turn`} · ${found} of ${CARD_FACES.length} pairs found`;
      else if (phase === 2) status = `All ${CARD_FACES.length} pairs found!`;
      else status = 'Press Play to lay out the cards!';
    }
    if (els.status.dataset.k !== status) {
      els.status.dataset.k = status;
      els.status.textContent = status;
    }
    // The holes, or the cards.
    for (let i = 0; i < els.cells.length; i++) {
      const el = els.cells[i];
      let k = 'off';
      let face = '';
      if (els.blob) {
        const kind = s && phase === 1 ? s.h[i] : 0;
        k = kind === 2 ? 'gold' : kind === 1 ? 'up' : 'off';
        face = kind === 2 ? '⭐' : kind === 1 ? '👾' : '';
      } else if (s && phase >= 1) {
        const v = s.d[i];
        if (v >= 9) (k = 'won'), (face = CARD_FACES[v - 9]);
        else if (v >= 1) (k = 'up'), (face = CARD_FACES[v - 1]);
      }
      if (el.dataset.k !== `${k}|${face}`) {
        el.dataset.k = `${k}|${face}`;
        el.className = `${els.blob ? 'hole' : 'card'} ${k}`;
        el.replaceChildren(face || (els.blob ? '' : '?'));
      }
      const can = els.blob ? phase === 1 : phase === 1 && !s?.w && s?.t === g.pid;
      el.disabled = !can;
    }
    // Who is at the machine, and how each of them is doing.
    if (els.players.dataset.k !== JSON.stringify(s?.ps ?? [])) {
      els.players.dataset.k = JSON.stringify(s?.ps ?? []);
      els.players.replaceChildren(
        ...(s?.ps ?? []).map(([pid, n]) => h('span', { class: `chip arc-player${pid === s.t && !els.blob && phase === 1 ? ' turn' : ''}` }, `${name(pid)} ${els.blob ? '👆' : '🃏'} ${n}`)),
      );
    }
    // Play, once the last round (or board) is over with its scores.
    const show = !s || phase === 2;
    els.play.hidden = !show;
    if (show && els.play.dataset.k !== String(phase)) {
      els.play.dataset.k = String(phase);
      els.play.replaceChildren(phase === 2 ? '▶ Play again' : '▶ Play');
    }
  }

  // ------------------------------------------------ Go boards

  // The Go board you sat down at, in a window: how the game is going, the
  // board to tap a stone onto, who plays which colour, Pass and Give up, a
  // fresh board of any size, 🤖 Play with the AI friend, and 📖 How to play,
  // the rules a step at a time. Kept up to date as the island tells of the
  // game (renderGo); a tip over the board says what just happened.
  goDialog() {
    const g = this.game;
    if (!g?.goAt) return;
    this.goEls = null;
    this.goTip = '';
    this.openModal(
      (root) => {
        const board = h('div', { class: 'go-board', role: 'grid', 'aria-label': 'The Go board' });
        const status = h('div', { class: 'go-status', role: 'status' });
        const tip = h('div', { class: 'go-tip', hidden: true });
        const players = h('div', { class: 'go-players' });
        const pass = h('button', { class: 'chip', type: 'button', onclick: () => g.goSend('pass') }, '✋ Pass');
        const resign = h('button', { class: 'chip', type: 'button', onclick: () => g.goSend('resign') }, '🏳️ Give up');
        const call = h('button', { class: 'big green go-call', type: 'button', onclick: () => g.goSend('call') }, '🤖 Play with the AI friend');
        const sizes = GO_SIZES.map((n) => h('button', { class: 'chip go-size', type: 'button', 'data-n': n, onclick: () => g.goSend('new', { n }) }, `${n}×${n}`));
        const lessons = h('div', { class: 'go-lessons', hidden: true });
        const how = h('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', onclick: () => this.goLesson(lessons.hidden ? 0 : -1) }, '📖 How to play');
        this.goEls = { board, status, tip, players, pass, resign, call, sizes, lessons, how, n: 0, cells: [] };
        root.append(
          h('h2', {}, '⚫ Go ⚪'),
          status,
          tip,
          board,
          players,
          h('div', { class: 'go-row' }, pass, resign, how),
          call,
          h('div', { class: 'go-row go-new' }, h('span', { class: 'muted' }, 'New game:'), ...sizes),
          lessons,
        );
      },
      { onClose: () => {
        this.goEls = null;
        g.closeGo();
      } },
    );
    this.renderGo();
  }

  // The AI friend on this island, or null.
  goFriend() {
    for (const p of this.game?.players.values() ?? []) if (p.ai) return p;
    return null;
  }

  renderGo() {
    const g = this.game;
    const els = this.goEls;
    if (!g?.goAt || !els || !this.modalOpen) return;
    const s = g.goGame;
    const name = (pid) => (pid === g.pid ? 'You' : (g.players.get(pid)?.name ?? 'A friend'));
    const mine = s ? (s.p[0] === g.pid ? BLACK : s.p[1] === g.pid ? WHITE : null) : null;
    const friend = this.goFriend();
    // How it is going.
    let status = 'Sitting down…';
    if (s?.over) {
      const o = s.over;
      const won = o.win === 'draw' ? 'It is a draw!' : o.win === mine ? 'You win! 🎉' : mine ? `${name(s.p[o.win === BLACK ? 0 : 1])} wins!` : `${o.win === BLACK ? '⚫ Black' : '⚪ White'} wins!`;
      status = o.why === 'resign' ? `${won} (the other side gave up)` : `⚫ ${o.b} · ⚪ ${o.w} — ${won}`;
    } else if (s && !s.p[1]) status = s.call ? `Waiting for ${friend?.name ?? 'the AI friend'} to come and play…` : 'Waiting for someone to play white…';
    else if (s && !s.p[0]) status = 'Waiting for someone to play black…';
    else if (s) status = s.t === mine ? `Your turn — you are ${mine === BLACK ? '⚫ black' : '⚪ white'}` : `${name(s.p[s.t === BLACK ? 0 : 1])}'s turn${mine ? '' : ` (${s.t === BLACK ? '⚫' : '⚪'})`}`;
    if (els.status.textContent !== status) els.status.textContent = status;
    els.tip.hidden = !this.goTip;
    if (els.tip.textContent !== this.goTip) els.tip.textContent = this.goTip;
    // The board, made again for a new size.
    const n = s?.n ?? 5;
    if (els.n !== n) {
      els.n = n;
      els.board.style.setProperty('--n', n);
      els.cells = [];
      const cells = [];
      for (let i = 0; i < n * n; i++) {
        const r = Math.floor(i / n);
        const c = i % n;
        const el = h('button', { class: `go-pt${r === 0 ? ' top' : ''}${r === n - 1 ? ' bottom' : ''}${c === 0 ? ' left' : ''}${c === n - 1 ? ' right' : ''}`, type: 'button', 'aria-label': placeName(n, i), onclick: () => {
          this.sound.unlock();
          g.goSend('move', { i });
        } });
        els.cells.push(el);
        cells.push(el);
      }
      els.board.replaceChildren(...cells);
    }
    const myTurn = Boolean(s && !s.over && mine && s.t === mine && s.p[0] && s.p[1]);
    els.board.classList.toggle('my-turn', myTurn);
    for (let i = 0; i < els.cells.length; i++) {
      const el = els.cells[i];
      const v = s?.b[i] ?? '.';
      const k = `${v}${s?.last === i ? '!' : ''}`;
      if (el.dataset.k !== k) {
        el.dataset.k = k;
        el.replaceChildren(...(v === '.' ? [] : [h('span', { class: `go-stone ${v === BLACK ? 'black' : 'white'}${s.last === i ? ' last' : ''}` })]));
        el.setAttribute('aria-label', `${placeName(n, i)}${v === BLACK ? ', black' : v === WHITE ? ', white' : ''}`);
      }
      el.disabled = !myTurn || v !== '.';
    }
    // Who plays which colour, and how many stones each has taken.
    const seats = s ? [0, 1].map((k) => {
      const c = k === 0 ? BLACK : WHITE;
      const who = s.p[k] ? name(s.p[k]) : '…';
      return h('span', { class: `chip go-player${!s.over && s.t === c && s.p[0] && s.p[1] ? ' turn' : ''}` }, `${c === BLACK ? '⚫' : '⚪'} ${who}${s.cap[c] ? ` · took ${s.cap[c]}` : ''}`);
    }) : [];
    const pk = JSON.stringify(seats.map((e) => e.textContent + e.className));
    if (els.players.dataset.k !== pk) {
      els.players.dataset.k = pk;
      els.players.replaceChildren(...seats);
    }
    els.pass.disabled = !myTurn;
    els.resign.disabled = !(s && !s.over && mine && s.p[0] && s.p[1]);
    // Calling the AI friend over, for black waiting for someone to play.
    els.call.hidden = !(s && !s.over && mine === BLACK && !s.p[1] && !s.call);
    const callText = `🤖 Play with ${friend?.name ?? 'the AI friend'}`;
    if (els.call.textContent !== callText) els.call.textContent = callText;
    for (const b of els.sizes) b.classList.toggle('on', Number(b.dataset.n) === n);
    for (const b of els.sizes) b.disabled = !mine;
  }

  // What just happened at a board, as the tip over yours: why a stone could
  // not go where you tapped, stones in danger or taken, a pass, the count.
  goHeard(msg) {
    const g = this.game;
    if (!g?.goAt || msg?.k !== g.goAt.key) return;
    const s = g.goGame;
    const mine = s ? (s.p[0] === g.pid ? BLACK : s.p[1] === g.pid ? WHITE : null) : null;
    const name = (pid) => (pid === g.pid ? 'You' : (g.players.get(pid)?.name ?? 'A friend'));
    const stones = (k) => (k === 1 ? 'stone' : 'stones');
    let tip = null;
    if (msg.f === 'no' && msg.by === g.pid) tip = `🙅 ${NO_MOVE[msg.why] ?? NO_MOVE.taken}`;
    else if (msg.f === 'move' && msg.took) tip = msg.by === g.pid ? `🎉 You captured ${msg.took} ${stones(msg.took)}!` : mine ? `😮 ${name(msg.by)} captured ${msg.took} of your ${stones(msg.took)}!` : `${name(msg.by)} captured ${msg.took} ${stones(msg.took)}.`;
    else if (msg.f === 'atari' && mine) tip = msg.c === mine ? `⚠️ Your ${msg.n === 1 ? 'stone' : `${msg.n} stones`} at ${placeName(s?.n ?? 5, msg.i)} ${msg.n === 1 ? 'has' : 'have'} one breathing space left! Save ${msg.n === 1 ? 'it' : 'them'}, or ${msg.n === 1 ? 'it' : 'they'} will be captured.` : `👀 ${msg.n === 1 ? 'That stone has' : `Those ${msg.n} stones have`} one breathing space left: you can capture ${msg.n === 1 ? 'it' : 'them'}!`;
    // A tip stays until you play.
    else if (msg.f === 'move' && msg.by === g.pid) tip = '';
    else if (msg.f === 'pass') tip = msg.by === g.pid ? '✋ You passed.' : `✋ ${name(msg.by)} passed. Pass too to end the game and count, or keep playing.`;
    else if (msg.f === 'end') tip = msg.why === 'score' ? `🧮 Counted: your stones, and the empty places only your stones surround. ⚫ ${msg.b} · ⚪ ${msg.w}.` : '';
    else if (msg.f === 'new') tip = '';
    if (tip === null) return;
    // (A stone in danger is told of just after the move that did it.)
    this.goTip = tip;
    this.renderGo();
  }

  // 📖 How to play: lesson k of the rules (or closed, for -1), each with a
  // little board to show it.
  goLesson(k) {
    const els = this.goEls;
    if (!els) return;
    els.lessons.hidden = k < 0;
    els.how.setAttribute('aria-expanded', String(k >= 0));
    if (k < 0) return;
    const l = LESSONS[k];
    const n = l.board.length;
    const mini = h('div', { class: 'go-board mini', style: `--n: ${n}`, 'aria-hidden': 'true' });
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = l.board[r][c];
        mini.append(h('div', { class: `go-pt${r === 0 ? ' top' : ''}${r === n - 1 ? ' bottom' : ''}${c === 0 ? ' left' : ''}${c === n - 1 ? ' right' : ''}` }, v === 'b' || v === 'w' ? h('span', { class: `go-stone ${v === 'b' ? 'black' : 'white'}` }) : v === 'o' ? h('span', { class: 'go-mark breath' }) : v === 'x' ? h('span', { class: 'go-mark nope' }, '✕') : null));
      }
    }
    const back = h('button', { class: 'chip', type: 'button', disabled: k === 0, onclick: () => this.goLesson(k - 1) }, '◀ Back');
    const next = k < LESSONS.length - 1 ? h('button', { class: 'chip', type: 'button', onclick: () => this.goLesson(k + 1) }, 'Next ▶') : h('button', { class: 'chip', type: 'button', onclick: () => this.goLesson(-1) }, '✔ Got it!');
    els.lessons.replaceChildren(
      h('h3', {}, `${k + 1}. ${l.title}`),
      h('div', { class: 'go-lesson' }, mini, h('p', {}, l.text)),
      h('div', { class: 'go-row' }, back, h('span', { class: 'muted' }, `${k + 1} of ${LESSONS.length}`), next),
    );
    els.lessons.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  // ------------------------------------------------ gashapon machines

  // The gashapon machine you pressed Turn at, in a window: the machine with
  // its handle, your coins, the capsule that comes out and the toy in it,
  // and your collection of capsule toys, the ones still to find as closed
  // capsules. The Monster Gashapon's is the same, with its monster figures,
  // its own price and the odds of a rare one at the island's stage.
  gashaDialog() {
    const g = this.game;
    if (!g?.gashaAt) return;
    const monster = Boolean(g.gashaAt.monster);
    const stageNow = g.gashaStage();
    const kit = monster
      ? { list: MONSTER_FIGURES, price: MONSTER_PRICE, title: '👾 Monster Gashapon', button: '👾 Turn the handle', mine: 'My monster figures' }
      : { list: TOYS, price: GASHA_PRICE, title: '🎁 Gashapon', button: '🎁 Turn the handle', mine: 'My capsule toys' };
    let busy = false;
    const timers = [];
    // The capsule out of the machine and not yet open: what is in it, kept
    // out of the collection below until you see it.
    let got = null;
    // The toy just found, to make its card pop in the collection.
    let fresh = '';
    // The machine in 3D (render/gasha-stage.js), once it is up: without
    // WebGL, the flat one stays.
    let stage3d = null;
    let closed = false;
    this.openModal(
      (root) => {
        const coins = h('div', { class: 'gasha-coins' });
        const handle = h('div', { class: 'gasha-handle' });
        const toyEl = h('span', { class: 'gasha-toy' });
        const capsule = h(
          'button',
          { class: 'gasha-capsule', type: 'button', 'aria-label': 'Open the capsule', hidden: true },
          h('span', { class: 'gasha-burst' }),
          toyEl,
          h('span', { class: 'gasha-bottom' }),
          h('span', { class: 'gasha-top' }),
        );
        const said = h('div', { class: 'gasha-said', 'aria-live': 'polite' }, 'Put in coins and turn the handle!');
        const turn = h('button', { class: 'big green gasha-turn', type: 'button' }, `${kit.button} · 🪙 ${kit.price}`);
        const heading = h('h3', {});
        const grid = h('div', { class: 'gasha-toys' });
        const show = () => {
          const p = g.profile.data;
          const toys = { ...p.gear.toys };
          if (got) toys[got.toy.key] = (toys[got.toy.key] ?? 1) - 1;
          coins.textContent = `🪙 ${p.coins} ${p.coins === 1 ? 'coin' : 'coins'}`;
          const gone = monster && !g.gashaHere();
          turn.disabled = busy || gone || p.coins < kit.price;
          heading.textContent = `${kit.mine} (${toysFound(toys, kit.list)} of ${kit.list.length})`;
          grid.replaceChildren(
            ...kit.list.map((t) => {
              const n = toys[t.key] ?? 0;
              return this.toyCard(t, n, { fresh: t.key === fresh });
            }),
          );
          fresh = '';
          if (!busy && gone) said.textContent = 'The Monster Gashapon has gone! It will turn up again somewhere else.';
          else if (!busy && p.coins < kit.price) said.textContent = `You need 🪙 ${kit.price} coins. Sell treasures from your basket in the 🛒 shop!`;
        };
        this.gashaShow = show;
        const later = (ms, fn) => timers.push(setTimeout(fn, ms));
        const stop = () => {
          timers.forEach((t) => clearTimeout(t));
          timers.length = 0;
        };
        // The capsule pops open: its lid flies off, the toy jumps out in a
        // burst of light, and only then does it join the collection.
        const reveal = () => {
          if (!got) return;
          stop();
          const toy = got.toy;
          const rare = toy.rare === 2 ? '🌟 Super rare! ' : toy.rare === 1 ? '✨ Rare! ' : '';
          capsule.classList.remove('ready');
          capsule.classList.add('open', rarityOf(toy).key);
          stage3d?.open(rarityOf(toy).key);
          this.sound.play(toy.rare ? 'fanfare' : 'pop');
          const name = monster ? `${toy.name} figure` : toy.name;
          said.textContent = got.have === 1 ? `${rare}New! You got the ${name}!` : `${rare}Another ${name}! You have ${got.have} now.`;
          g.openCapsule(monster);
          later(600, () => {
            fresh = toy.key;
            busy = false;
            show();
          });
          got = null;
        };
        turn.onclick = () => {
          if (busy) return;
          this.sound.unlock();
          stop();
          got = g.turnGashapon();
          if (!got) {
            show();
            return;
          }
          busy = true;
          capsule.hidden = true;
          capsule.className = 'gasha-capsule';
          capsule.style.setProperty('--shell', got.shell);
          const drawn = got;
          toyEl.textContent = got.toy.icon;
          handle.classList.remove('turning');
          void handle.offsetWidth;
          handle.classList.add('turning');
          said.textContent = 'Click, click, click…';
          show();
          // It drops out of the chute and bounces, then wobbles, waiting to
          // be tapped open (or opening by itself after a while).
          stage3d?.turn();
          later(800, () => {
            capsule.hidden = false;
            capsule.classList.add('dropping');
            stage3d?.drop(drawn.shell, drawn.toy.key);
            this.sound.play('place', { kind: 'brick' });
          });
          later(stage3d ? 2200 : 1500, () => {
            capsule.classList.replace('dropping', 'ready');
            said.textContent = 'A capsule! Tap it open!';
          });
          later(stage3d ? 4800 : 4000, reveal);
        };
        capsule.onclick = () => {
          if (!capsule.hidden) reveal();
        };
        const machine = h(
          'div',
          { class: 'gasha-machine', 'aria-hidden': 'true' },
          h('div', { class: 'gasha-globe' }, ...Array.from({ length: 14 }, (_, i) => h('span', { class: `gasha-ball b${i % 6}` }))),
          h('div', { class: 'gasha-base' }, handle, h('div', { class: 'gasha-chute' })),
        );
        const canvas = h('canvas', { class: 'gasha-3d', 'aria-hidden': 'true' });
        const stage = h('div', { class: 'gasha-stage' }, machine, h('div', { class: 'gasha-tray' }, capsule), canvas);
        import('./render/gasha-stage.js')
          .then(({ GashaStage, toyPortraits }) => {
            if (closed) return;
            stage3d = new GashaStage(canvas, monster ? 'monster' : 'capsule');
            stage.classList.add('three');
            this.toyPictures ??= toyPortraits(ALL_TOYS.map((t) => t.key));
            show();
          })
          .catch(() => canvas.remove());
        // The Monster Gashapon's odds of a rare figure, better on a higher stage.
        const odds = rarityOdds(kit.list, stageNow).map((o) => `${Math.round(o * 100)}%`);
        const about = monster
          ? `Every turn is 🪙 ${kit.price} coins for one of ${kit.list.length} monster figures. ${stageNow > 1 ? `On stage ${stageNow}` : 'Here'} the odds are ★ ${odds[0]} · ★★ ${odds[1]} · ★★★ ${odds[2]} — the higher the stage, the better the chance of a rare one!`
          : `Every turn is 🪙 ${kit.price} coins for a surprise toy: ${kit.list.length} to collect, ★ common, ★★ rare and ★★★ super rare!`;
        root.append(h('h2', {}, kit.title), coins, stage, said, turn, heading, grid, h('p', { class: 'muted gasha-about' }, about));
        show();
      },
      {
        onClose: () => {
          timers.forEach((t) => clearTimeout(t));
          if (got) g.openCapsule(monster);
          got = null;
          closed = true;
          this.gashaShow = null;
          stage3d?.dispose();
          stage3d = null;
          g.closeGashapon();
        },
      },
    );
  }

  // A capsule toy's card (shared/gashapon.js), for the gashapon's window and
  // the backpack: its figure in 3D once the pictures are made (and its
  // emoji till then, or without WebGL), its name, how rare it is and how
  // many you have — or, with none of it yet, a closed capsule, ??? and how
  // rare the one still to find is. fresh: just found, so it pops.
  toyCard(t, n, { fresh = false } = {}) {
    const pic = this.toyPictures?.[n ? t.key : 'mystery'];
    const r = rarityOf(t);
    return h(
      'div',
      { class: `gasha-toy-card ${n ? r.key : 'missing'}${fresh ? ' fresh' : ''}`, title: n ? `${t.name} (${r.name})` : `A ${r.name.toLowerCase()} ${t.monster ? 'monster figure' : 'toy'} still to find` },
      pic ? h('img', { class: 'figure', src: pic, alt: n ? t.name : 'A capsule still to open', draggable: false }) : h('span', { class: 'icon' }, n ? t.icon : '❓'),
      h('span', { class: 'name' }, n ? t.name : '???'),
      h('span', { class: `rarity ${r.key}`, 'aria-label': r.name }, h('span', { class: 'stars' }, r.stars), ` ${r.name}`),
      n > 1 ? h('span', { class: 'count' }, `×${n}`) : null,
    );
  }

  // The toys' pictures in 3D (render/gasha-stage.js), made once and kept:
  // then `done`. Without WebGL there are none, and the emoji stay.
  loadToyPictures(done) {
    if (this.toyPictures) return done();
    import('./render/gasha-stage.js')
      .then(({ toyPortraits }) => {
        this.toyPictures = toyPortraits(ALL_TOYS.map((t) => t.key));
        done();
      })
      .catch(() => {});
  }

  // ------------------------------------------------ pianos

  // The piano you pressed Play at, in a window: its keyboard, two octaves
  // of keys to tap (or to play on your own keyboard, each key's letter on
  // it), and songs to follow, the next key to play lit up until the song
  // is done.
  pianoDialog() {
    const g = this.game;
    const t = g?.pianoAt;
    if (!t) return;
    const touch = this.input.touchMode;
    // The song being followed, and how far along it you are.
    let song = null;
    let at = 0;
    const keyEls = new Map();
    const said = h('div', { class: 'piano-said', 'aria-live': 'polite' }, 'Tap the keys to play!');
    const songs = h('div', { class: 'piano-songs' });
    const light = () => {
      const next = song ? song.notes[at] : null;
      for (const [n, el] of keyEls) el.classList.toggle('next', n === next);
    };
    const pick = (s) => {
      song = song === s ? null : s;
      at = 0;
      for (const b of songs.children) b.classList.toggle('on', b.dataset.song === song?.key);
      said.textContent = song ? `${song.icon} ${song.name}: play the glowing key!` : 'Tap the keys to play!';
      light();
    };
    const play = (n) => {
      this.sound.unlock();
      g.playPiano(n);
      const el = keyEls.get(n);
      if (el) {
        el.classList.remove('down');
        void el.offsetWidth;
        el.classList.add('down');
      }
      if (!song) return;
      if (n !== song.notes[at]) return;
      at++;
      if (at < song.notes.length) {
        said.textContent = `${song.icon} ${song.name}: ${at} of ${song.notes.length}`;
      } else {
        said.textContent = `🎉 You played ${song.name}!`;
        g.playedTune();
        song = null;
        for (const b of songs.children) b.classList.remove('on');
      }
      light();
    };
    // Keys held down on a keyboard play once, not over and over.
    const held = new Set();
    const keydown = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = noteOfKey(e.key);
      if (n === null || held.has(n)) return;
      e.preventDefault();
      held.add(n);
      play(n);
    };
    const keyup = (e) => held.delete(noteOfKey(e.key));
    this.openModal(
      (root) => {
        const whites = PIANO_KEYS.filter((k) => !k.black);
        const board = h('div', { class: 'piano-board', style: `--whites: ${whites.length}` });
        let white = 0;
        for (const k of PIANO_KEYS) {
          const el = h(
            'button',
            { class: `piano-key ${k.black ? 'black' : 'white'}`, type: 'button', 'aria-label': `${k.name} ${Math.floor(k.n / 12) - 1}`, style: k.black ? `--at: ${white}` : '' },
            touch ? '' : h('span', { class: 'piano-letter' }, k.key.toUpperCase()),
          );
          if (!k.black) white++;
          // On pointer down, so a quick run of taps (and two fingers at
          // once) all sound.
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            play(k.n);
          });
          keyEls.set(k.n, el);
          board.append(el);
        }
        songs.append(
          ...SONGS.map((s) => {
            const b = h('button', { class: 'piano-song', type: 'button', 'data-song': s.key }, `${s.icon} ${s.name}`);
            b.onclick = () => pick(songOf(s.key));
            return b;
          }),
        );
        root.append(h('h2', {}, t.grand ? '🎹 Grand Piano' : '🎹 Piano'), said, h('div', { class: 'piano-wrap' }, board), h('h3', {}, '🎵 Play a song'), songs, h('p', { class: 'muted' }, touch ? 'Friends nearby hear you play!' : 'Play with your keyboard too: Z X C V B N M for the low keys, Q W E R T Y U I for the high ones. Friends nearby hear you play!'));
        window.addEventListener('keydown', keydown);
        window.addEventListener('keyup', keyup);
      },
      {
        seeThrough: true,
        onClose: () => {
          window.removeEventListener('keydown', keydown);
          window.removeEventListener('keyup', keyup);
          g.closePiano();
        },
      },
    );
  }

  // ------------------------------------------------ drawing boards

  // The drawing board you pressed Draw at, in a window (shared/drawing.js):
  // its picture to draw on with a finger or the mouse, the colours, the
  // brushes, the fill and the eraser, and a button to wipe it clean. A
  // friend's strokes on it show as they come.
  drawDialog() {
    const g = this.game;
    const t = g?.drawAt;
    if (!t) return;
    const key = `${t.x},${t.y},${t.z}`;
    // The colour, the brush and the tool ('brush', 'fill' or 'eraser'), as
    // they were left last time.
    let { color, brush, tool } = this.drawPicks ?? { color: 1, brush: BRUSHES[1], tool: 'brush' };
    const canvas = h('canvas', { class: 'draw-canvas', width: PICTURE_W, height: PICTURE_H, 'aria-label': 'The drawing board’s picture: draw on it' });
    const redraw = () => paint(canvas, g.drawingAt(t));
    const colors = h('div', { class: 'draw-colors', role: 'group', 'aria-label': 'Colours' });
    const tools = h('div', { class: 'draw-tools', role: 'group', 'aria-label': 'Brushes' });
    const mark = () => {
      this.drawPicks = { color, brush, tool };
      for (const b of colors.children) b.classList.toggle('on', tool !== 'eraser' && Number(b.dataset.c) === color);
      for (const b of tools.children) b.classList.toggle('on', b.dataset.tool === tool && (tool !== 'brush' || b.dataset.r === String(brush.r)));
    };
    // White, the board's own colour, goes last.
    colors.append(
      ...[...DRAW_COLORS.keys()].slice(1).concat(0).map((c) =>
        h('button', {
          class: 'draw-color',
          type: 'button',
          'data-c': c,
          'aria-label': DRAW_COLORS[c].name,
          style: `--c: ${DRAW_COLORS[c].hex}`,
          onclick: () => {
            color = c;
            if (tool === 'eraser') tool = 'brush';
            mark();
          },
        }),
      ),
    );
    const toolButton = (name, label, icon, extra, pick) => h('button', { class: 'draw-tool', type: 'button', 'data-tool': name, 'aria-label': label, ...extra, onclick: () => (pick(), mark()) }, icon);
    let wipeTimer = 0;
    const wipe = h('button', { class: 'draw-tool wipe', type: 'button' }, '🗑️ Wipe clean');
    wipe.onclick = () => {
      if (!wipe.classList.contains('sure')) {
        wipe.classList.add('sure');
        wipe.textContent = '🗑️ Sure? Tap again';
        wipeTimer = setTimeout(() => {
          wipe.classList.remove('sure');
          wipe.textContent = '🗑️ Wipe clean';
        }, 3000);
        return;
      }
      clearTimeout(wipeTimer);
      wipe.classList.remove('sure');
      wipe.textContent = '🗑️ Wipe clean';
      this.sound.play('pop');
      g.drawStroke({ k: 'clear' });
      g.sendStroke({ k: 'clear' });
      redraw();
    };
    tools.append(
      ...BRUSHES.map((b) => toolButton('brush', `${b.name} brush`, h('span', { class: 'draw-dot', style: `--d: ${6 + b.r * 5}px` }), { 'data-r': b.r }, () => ((tool = 'brush'), (brush = b)))),
      toolButton('fill', 'Fill', '🪣', {}, () => (tool = 'fill')),
      toolButton('eraser', 'Eraser', '🧽', {}, () => (tool = 'eraser')),
      wipe,
    );
    // The dot of the picture under a pointer.
    const dotAt = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * PICTURE_W);
      const y = Math.floor(((e.clientY - r.top) / r.height) * PICTURE_H);
      return [Math.min(PICTURE_W - 1, Math.max(0, x)), Math.min(PICTURE_H - 1, Math.max(0, y))];
    };
    // The line being drawn: drawn at once as the pointer moves, and sent a
    // few dots at a time, each bit starting where the last one stopped.
    let line = null;
    let sendTimer = 0;
    const send = () => {
      if (!line || line.pts.length < 2 || line.sent === line.pts.length) return;
      g.sendStroke({ k: 'line', c: line.c, r: line.r, pts: line.pts });
      line.pts = line.pts.slice(-2);
      line.sent = 2;
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (line || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      this.sound.unlock();
      const [x, y] = dotAt(e);
      if (tool === 'fill') {
        const s = { k: 'fill', c: color, x, y };
        g.drawStroke(s);
        g.sendStroke(s);
        g.drew();
        this.sound.play('pop');
        redraw();
        return;
      }
      canvas.setPointerCapture?.(e.pointerId);
      line = { id: e.pointerId, c: tool === 'eraser' ? 0 : color, r: tool === 'eraser' ? 2 : brush.r, pts: [x, y], sent: 0 };
      g.drawStroke({ k: 'line', c: line.c, r: line.r, pts: [x, y] });
      redraw();
      sendTimer = setInterval(send, 60);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!line || e.pointerId !== line.id) return;
      e.preventDefault();
      const [x, y] = dotAt(e);
      const n = line.pts.length;
      if (line.pts[n - 2] === x && line.pts[n - 1] === y) return;
      g.drawStroke({ k: 'line', c: line.c, r: line.r, pts: [line.pts[n - 2], line.pts[n - 1], x, y] });
      line.pts.push(x, y);
      if (line.pts.length >= MAX_POINTS * 2) send();
      redraw();
    });
    const end = (e) => {
      if (!line || e.pointerId !== line.id) return;
      send();
      clearInterval(sendTimer);
      line = null;
      g.drew();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    this.drawingChanged = (k) => {
      if (k === undefined || k === key) redraw();
    };
    // Into your own gallery, to look at again (galleryDialog).
    const keep = () => {
      const { picture, why } = this.home.saveDrawing(g.drawingAt(t), g.world?.name);
      if (picture) {
        this.sound.play('photo');
        this.toast('🖼️', 'Your picture is in your gallery!');
      } else {
        this.sound.play('no');
        this.toast('🖼️', { same: 'That picture is in your gallery already.', full: `Your gallery is full (${GALLERY_MAX} pictures). Take one down to make room!`, blank: 'Draw something first!' }[why], 'warn');
      }
    };
    const saves = h(
      'div',
      { class: 'draw-saves' },
      h('button', { class: 'draw-tool save-gallery', type: 'button', onclick: keep }, '🖼️ To my gallery'),
      h('button', { class: 'draw-tool open-gallery', type: 'button', onclick: () => this.galleryDialog({ board: t }) }, '📂 My gallery'),
      h('button', { class: 'draw-tool save-file', type: 'button', onclick: () => this.savePictureFile(g.drawingAt(t), g.world?.name) }, '💾 Save picture'),
    );
    this.openModal(
      (root) => {
        root.append(h('h2', {}, '🎨 Drawing Board'), h('div', { class: 'draw-wrap' }, canvas), colors, h('div', { class: 'draw-bar' }, tools, saves), h('p', { class: 'muted' }, 'Friends at this board draw with you, and everyone sees your picture on the board!'));
        mark();
        redraw();
      },
      {
        onClose: () => {
          if (line) send();
          clearInterval(sendTimer);
          clearTimeout(wipeTimer);
          line = null;
          this.drawingChanged = null;
          g.closeDrawing();
        },
      },
    );
  }

  // A picture saved on this device as a PNG file, ten times as big, its
  // dots kept sharp.
  savePictureFile(px, island) {
    const small = h('canvas', { width: PICTURE_W, height: PICTURE_H });
    paint(small, px);
    const big = h('canvas', { width: PICTURE_W * 10, height: PICTURE_H * 10 });
    const ctx = big.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, big.width, big.height);
    const a = h('a', { href: big.toDataURL('image/png'), download: `${(island || 'island').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-drawing.png` });
    document.body.append(a);
    a.click();
    a.remove();
    this.sound.play('photo');
    this.toast('💾', 'Your picture is saved!');
  }

  // Your gallery: the drawings you saved from drawing boards (profile.js),
  // newest first, each to save as a file or take down — and, opened from a
  // board, to put up on it again. Kept up to date as it changes (on another
  // device too, with a login).
  galleryDialog({ board = null } = {}) {
    const p = this.home;
    const g = this.game;
    const grid = h('div', { class: 'gallery-grid' });
    const title = h('h2', {});
    const render = () => {
      const items = p.data.gallery.items;
      title.textContent = `🖼️ My gallery (${items.length} of ${GALLERY_MAX})`;
      if (!items.length) {
        grid.replaceChildren(h('p', { class: 'muted gallery-empty' }, 'No pictures yet! Draw on a drawing board (in the toy box’s 🛋️ Home tab) and tap 🖼️ To my gallery.'));
        return;
      }
      grid.replaceChildren(
        ...items.map((it) => {
          const px = decodePicture(it.px);
          const pic = h('canvas', { class: 'gallery-pic', width: PICTURE_W, height: PICTURE_H, role: 'img', 'aria-label': `A drawing${it.island ? ` from ${it.island}` : ''}` });
          paint(pic, px);
          const when = it.at ? new Date(it.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          const down = h('button', { class: 'chip gallery-down', type: 'button', 'aria-label': 'Take this picture down' }, '🗑️');
          down.onclick = () => {
            if (!down.classList.contains('sure')) {
              down.classList.add('sure');
              down.textContent = '🗑️ Sure?';
              setTimeout(() => {
                if (!down.isConnected) return;
                down.classList.remove('sure');
                down.textContent = '🗑️';
              }, 3000);
              return;
            }
            this.sound.play('pop');
            p.takeDownDrawing(it.id);
          };
          const putUp = () => {
            if (!g || !isBoard(g.world?.get(board.x, board.y, board.z))) {
              this.sound.play('no');
              return;
            }
            g.drawAt = board;
            const stroke = { k: 'paste', px: it.px };
            g.drawStroke(stroke);
            g.sendStroke(stroke);
            this.sound.play('pop');
            this.drawDialog();
          };
          return h(
            'div',
            { class: 'gallery-card', 'data-id': it.id },
            pic,
            h('span', { class: 'muted' }, [it.island, when].filter(Boolean).join(' · ')),
            h(
              'div',
              { class: 'shop-buttons' },
              board ? h('button', { class: 'chip gallery-put', type: 'button', onclick: putUp }, '🎨 Put it up') : null,
              h('button', { class: 'chip gallery-file', type: 'button', 'aria-label': 'Save as a picture file', onclick: () => this.savePictureFile(px, it.island) }, '💾'),
              down,
            ),
          );
        }),
      );
    };
    const changed = () => render();
    this.openModal(
      (root) => {
        const back = board && g ? h('button', { class: 'chip', type: 'button', onclick: () => ((g.drawAt = board), this.drawDialog()) }, '🎨 Back to the board') : null;
        root.append(h('div', { class: 'dialog-head' }, title, back), board ? h('p', { class: 'muted' }, 'Tap 🎨 Put it up to put a picture on this board again — for everyone to see!') : null, grid);
        render();
        p.addEventListener('gallery', changed);
      },
      { onClose: () => p.removeEventListener('gallery', changed) },
    );
  }

  // ------------------------------------------------ TVs

  // Something new on every TV, from the keeper's admin page, or nothing any
  // more (shared/broadcast.js): told while playing, and a TV being watched
  // gets the 📡 Live channel, or loses it.
  tvNews(tv, peerOptions) {
    this.broadcast = tv;
    this.tvPeerOptions = peerOptions;
    if (tv && this.game) this.toast('📡', `On TV now: ${tv.title}! Watch it on any TV, on channel ${channelsWith(tv, this.onAir).indexOf(LIVE) + 1}.`);
    this.tvChanged?.();
  }

  // Someone on air from a broadcast station now, on every TV in the game,
  // or nobody any more (shared/station.js, as the keeper tells of it): told
  // while playing, unless it is you, and a TV being watched gets the 📹 On
  // Air channel, or loses it.
  onAirNews(onAir) {
    this.onAir = onAir;
    this.onAirShow = onAir ? onAirShow(onAir) : null;
    if (onAir && this.game && onAir.station !== this.myStation) this.toast('📹', `${onAir.name} is on air! Watch on any TV, on channel ${channelsWith(this.broadcast, onAir).indexOf(ON_AIR) + 1}.`);
    this.tvChanged?.();
    this.stationChanged?.();
  }

  // The TV you pressed Watch at, in a window: its picture, the show on the
  // channel it is on (tv-shows.js), with a moment of static between
  // channels, and the channels to flip through with ◀ ▶, a tap on one, the
  // arrow keys or the number keys; and while something is on air, 📡 Live,
  // the same on every TV (tv-live.js).
  tvDialog() {
    const g = this.game;
    const t = g?.tvAt;
    if (!t) return;
    const W = 320;
    const H = 180;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = h('canvas', { class: 'tv-picture', width: W * dpr, height: H * dpr, role: 'img' });
    const ctx = canvas.getContext('2d');
    const said = h('div', { class: 'tv-said', hidden: true });
    const screen = h('div', { class: 'tv-screen' }, canvas, said);
    const name = h('div', { class: 'tv-name', 'aria-live': 'polite' });
    const chips = h('div', { class: 'tv-channels' });
    const hint = h('p', { class: 'muted' });
    const channelList = () => channelsWith(this.broadcast, this.onAir);
    // What a live channel shows: the keeper's broadcast, or someone's broadcast station here.
    const showOf = (c) => (c === LIVE ? this.broadcast : c === ON_AIR ? this.onAirShow : null);
    const title = (c) => (c === LIVE ? `Live: ${this.broadcast.title}` : c === ON_AIR ? `On Air: ${this.onAir.name}` : c.name);
    let channels = channelList();
    let channel = g.tvChannel < channels.length ? g.tvChannel : 0;
    let fuzz = 0;
    let frame = 0;
    let live = null;
    const start = performance.now();
    const say = (text) => {
      said.textContent = text;
      said.hidden = !text;
    };
    // The live show, while that is the channel and once the static is over.
    const tune = () => {
      const want = performance.now() >= fuzz ? showOf(channels[channel]) : null;
      if (live && live.tv === want) return;
      live?.close();
      live = null;
      say('');
      if (want) {
        live = new LiveTv(want, this.keeper?.peerOptions ?? this.tvPeerOptions, say);
        screen.append(live.el);
      }
      // No island music over the show.
      this.sound.hushMusic(Boolean(live));
    };
    const show = () => {
      const c = channels[channel];
      name.textContent = `${channel + 1} · ${c.icon} ${title(c)}`;
      canvas.setAttribute('aria-label', `${title(c)} on the TV`);
      chips.replaceChildren(
        ...channels.map((c, i) => {
          const b = h('button', { class: `tv-channel${i === channel ? ' on' : ''}${showOf(c) ? ' live' : ''}`, type: 'button', 'data-channel': String(i), 'aria-label': `Channel ${i + 1}, ${title(c)}` }, c.icon);
          b.onclick = () => flip(i);
          return b;
        }),
      );
      hint.textContent = this.input.touchMode ? '' : `Flip channels with ← → or 1 to ${channels.length} on your keyboard too.`;
    };
    const flip = (i) => {
      if (i === channel) return;
      channel = i;
      fuzz = performance.now() + 250;
      g.watchChannel(i);
      show();
      tune();
    };
    // Something new on air (or nothing): the channels again, the same one
    // on, or the first if it is gone; a new show on it comes in with static.
    this.tvChanged = () => {
      const was = channels[channel];
      channels = channelList();
      channel = channels.indexOf(was);
      if (channel < 0) {
        channel = 0;
        g.watchChannel(0);
      } else g.tvChannel = channel;
      const now = showOf(channels[channel]);
      if (now && now !== live?.tv) fuzz = performance.now() + 250;
      show();
      tune();
    };
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now < fuzz) {
        live?.close();
        live = null;
        this.sound.hushMusic(false);
        say('');
        drawStatic(ctx, canvas.width, canvas.height);
        return;
      }
      if (showOf(channels[channel])) {
        if (!live) tune();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawShow(ctx, channels[channel].key, (now - start) / 1000, W, H, g.env);
    };
    const keydown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      let i = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = nextChannel(channel, 1, channels.length);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = nextChannel(channel, -1, channels.length);
      else if (Number.isInteger(n) && n >= 1 && n <= channels.length) i = n - 1;
      if (i === null) return;
      e.preventDefault();
      flip(i);
    };
    this.openModal(
      (root) => {
        const prev = h('button', { class: 'tv-flip', type: 'button', 'aria-label': 'The channel before' }, '◀');
        const next = h('button', { class: 'tv-flip', type: 'button', 'aria-label': 'The next channel' }, '▶');
        prev.onclick = () => flip(nextChannel(channel, -1, channels.length));
        next.onclick = () => flip(nextChannel(channel, 1, channels.length));
        show();
        root.append(h('h2', {}, `📺 ${t.name}`), h('div', { class: 'tv-set' }, screen), h('div', { class: 'tv-remote' }, prev, name, next), chips, hint);
        frame = requestAnimationFrame(draw);
        window.addEventListener('keydown', keydown);
      },
      {
        seeThrough: true,
        onClose: () => {
          cancelAnimationFrame(frame);
          window.removeEventListener('keydown', keydown);
          live?.close();
          this.sound.hushMusic(false);
          this.tvChanged = null;
          g.closeTv();
        },
      },
    );
  }

  // ------------------------------------------------ broadcast stations

  // The broadcast station you pressed Go live at, in a window: your camera
  // in it as you look (your microphone too), and Go live, which makes this
  // page the TV station, a PeerJS peer each TV in the game watching calls
  // for the picture and the sound, and tells the keeper, which tells every
  // page (shared/station.js). Off air again with Stop, by closing the
  // window, when the station is gone or the keeper is; and nobody else goes
  // live while you are.
  stationDialog() {
    const g = this.game;
    const t = g?.stationAt;
    if (!t) return;
    const video = h('video', { class: 'station-camera', playsinline: true, autoplay: true });
    // Never your own voice back at you.
    video.muted = true;
    const said = h('div', { class: 'tv-said' }, '📹 Asking for your camera…');
    const tag = h('div', { class: 'station-tag', hidden: true }, '● ON AIR');
    const status = h('p', { class: 'station-status', 'aria-live': 'polite' }, 'Say yes when your browser asks for the camera and the microphone.');
    const go = h('button', { class: 'primary station-go', type: 'button', disabled: true }, '🔴 Go live');
    const mic = h('button', { class: 'station-mic', type: 'button', hidden: true, 'aria-pressed': 'false' }, '🎙️ Mic on');
    const st = { stream: null, peer: null, id: '', calls: new Set(), live: false, closed: false, check: 0, timer: 0 };
    const viewers = () => [...st.calls].filter((c) => c.open).length;
    const render = () => {
      const live = Boolean(st.id) && this.onAir?.station === st.id;
      tag.hidden = !live;
      go.textContent = st.id ? '⏹️ Stop' : '🔴 Go live';
      go.classList.toggle('primary', !st.id);
      go.disabled = !st.stream;
      if (live) {
        const n = viewers();
        status.textContent = `You’re on air on every TV, on every island! ${n === 1 ? '1 TV is' : `${n} TVs are`} watching.`;
      } else if (st.id) status.textContent = 'Going live…';
    };
    const offAir = (text) => {
      const was = st.id;
      clearTimeout(st.timer);
      st.live = false;
      for (const call of st.calls) call.close();
      st.calls.clear();
      st.peer?.destroy();
      st.peer = null;
      st.id = '';
      this.myStation = '';
      if (was) this.keeper?.goLive(null);
      this.sound.hushMusic(false);
      if (text !== undefined) status.textContent = text;
      if (!st.closed) render();
    };
    const goLive = () => {
      if (typeof Peer === 'undefined' || !this.keeper) {
        status.textContent = 'This browser can’t go live, sorry!';
        return;
      }
      const id = stationId();
      const peer = new Peer(id, this.keeper.peerOptions ?? {});
      st.peer = peer;
      st.id = id;
      this.myStation = id;
      render();
      st.timer = setTimeout(() => {
        if (st.peer === peer && !st.live) offAir('Couldn’t go live just now. Try again!');
      }, 20000);
      peer.on('open', () => {
        if (st.peer === peer) this.keeper.goLive({ name: this.profile.name, station: id });
      });
      peer.on('error', () => {
        if (st.peer === peer && !peer.open) offAir('Couldn’t go live just now. Try again!');
      });
      peer.on('disconnected', () => {
        if (st.peer === peer) peer.reconnect();
      });
      // Each TV calls in, sending nothing, and gets the camera and microphone back.
      peer.on('call', (call) => {
        if (st.peer !== peer) return;
        st.calls.add(call);
        const gone = () => {
          st.calls.delete(call);
          render();
        };
        call.on('close', gone);
        call.on('error', gone);
        call.answer(st.stream);
        setTimeout(render, 1500);
      });
      // No island music under your show.
      this.sound.hushMusic(true);
    };
    go.onclick = () => (st.id ? offAir('You’re off air.') : goLive());
    mic.onclick = () => {
      const on = !st.stream?.getAudioTracks()[0]?.enabled;
      for (const track of st.stream?.getAudioTracks() ?? []) track.enabled = on;
      mic.textContent = on ? '🎙️ Mic on' : '🔇 Mic off';
      mic.setAttribute('aria-pressed', String(!on));
    };
    // The island says who is on air: you at last, someone else first, or
    // nobody any more (the island let you go).
    this.stationChanged = () => {
      if (!st.id) return;
      const on = this.onAir;
      if (on && on.station !== st.id) offAir(`${on.name} is on air already. Wait till they’re done!`);
      else if (!on && st.live) offAir('You’re off air.');
      else {
        st.live = Boolean(on);
        render();
      }
    };
    // The keeper could not be asked, or said no.
    this.liveRefused = (code) => {
      if (!st.id) return;
      offAir(code === 'old' ? 'The island keeper needs an update before anyone can go live. Ask a grown-up!' : code === 'bad' ? 'Couldn’t go live just now. Try again!' : 'Going live needs the island keeper, and it can’t be reached right now. Try again later!');
    };
    const camera = async () => {
      const media = navigator.mediaDevices;
      if (!media?.getUserMedia) {
        said.textContent = '📹 No camera here.';
        status.textContent = 'This browser can’t use a camera (it needs https, or this computer).';
        return;
      }
      const video_ = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
      let stream = null;
      try {
        stream = await media.getUserMedia({ video: video_, audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        // No microphone (or not allowed): the picture alone.
        stream = await media.getUserMedia({ video: video_ }).catch(() => null);
      }
      if (st.closed) {
        for (const track of stream?.getTracks() ?? []) track.stop();
        return;
      }
      if (!stream) {
        said.textContent = '📹 No camera';
        status.textContent = 'Your camera didn’t come on. Is it allowed for this page?';
        return;
      }
      st.stream = stream;
      video.srcObject = stream;
      video.play().catch(() => {});
      said.hidden = true;
      mic.hidden = !stream.getAudioTracks().length;
      status.textContent = stream.getAudioTracks().length ? 'That’s you! Tap Go live to be on every TV, on every island.' : 'That’s you, with no microphone. Tap Go live to be on every TV, on every island.';
      render();
    };
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '📹 Broadcast Station'),
          h('div', { class: 'tv-set' }, h('div', { class: 'tv-screen station-screen' }, video, said, tag)),
          status,
          h('div', { class: 'station-buttons' }, go, mic),
          h('p', { class: 'muted' }, 'Everyone playing can watch you on any TV, on any island, on the 📹 On Air channel, while you’re live. Closing this window ends it.'),
        );
        camera();
      },
      {
        onClose: () => {
          st.closed = true;
          clearInterval(st.check);
          this.stationChanged = null;
          this.liveRefused = null;
          offAir();
          for (const track of st.stream?.getTracks() ?? []) track.stop();
          video.srcObject = null;
          g.closeStation();
        },
      },
    );
    // The station picked up or broken while you are at it: the window closes.
    st.check = setInterval(() => {
      if (!isBroadcastStation(g.world?.get(t.x, t.y, t.z))) this.closeModal();
    }, 1000);
  }

  // ------------------------------------------------ extra-credit quizzes

  // A quiz begun or answered, as the game tells of it (game.js startQuiz and
  // quizAnswer): the window on it opens, or the one already open shows where
  // it has got to.
  quizNews() {
    const g = this.game;
    if (!g?.quiz) return;
    if (this.quizEls?.quiz !== g.quiz) this.quizDialog();
    else this.renderQuiz();
  }

  // The quizzes a conquered adventure island offers (game.js quizOffer): one
  // at elementary school second-year level, one at middle school third-year
  // level, each for extra credit. auto: come up by itself once the island
  // was won, so never over a window already open — after that, the 🎓 by the
  // flag opens this again (adventureTags).
  quizOfferDialog(auto = false) {
    const g = this.game;
    if (!g?.quizOffer || (auto && this.modalOpen)) return;
    const levels = Object.values(QUIZ_LEVELS);
    const left = levels.filter((l) => !g.quizOffer.taken[l.key]).length;
    this.openModal(
      (root) => {
        root.append(
          h('h2', {}, '🎓 Extra credit!'),
          h('p', {}, left ? `${g.world?.name ?? 'The island'} is free, and you helped! Take a quiz for extra credit — one question, and the right answer pays.` : 'You have done both of this island’s quizzes. Well done!'),
        );
        for (const l of levels) {
          const done = g.quizOffer.taken[l.key];
          root.append(
            h(
              'button',
              {
                class: `big ${l.key === 'senior' ? 'pink' : 'blue'}`,
                type: 'button',
                disabled: done,
                onclick: () => {
                  this.sound.unlock();
                  this.sound.play('ui');
                  g.startQuiz(l.key);
                },
              },
              h('span', { class: 'emoji' }, l.icon),
              h('span', { class: 'quiz-level' }, h('span', {}, l.name), h('span', { class: 'quiz-sub' }, done ? '✓ done' : `🪙 ${quizCoins(1, l.key)} a right answer`)),
            ),
          );
        }
        if (left) root.append(h('p', { class: 'muted' }, `${QUIZ_SIZE === 1 ? 'One question' : `${QUIZ_SIZE} questions`} each. Finish one and the other is still there, by the 🎓 by the flag, ${g.nextStage ? `until everyone goes on to stage ${g.nextStage.stage}` : 'as long as you stay on the island'}.`));
      },
      { narrow: true },
    );
  }

  // ------------------------------------------------ on to the next stage

  // A stage of the shared isle conquered: a button counts down to the next
  // stage (game.js nextStage), and at nought, or tapped, off you go there.
  // The countdown holds while a window is open — a quiz, say — so nobody is
  // whisked away in the middle of one.
  nextStageNews() {
    const next = this.game?.nextStage;
    if (!next) {
      this.stopNextStage();
      return;
    }
    if (this.nextGo?.code === next.code) return;
    this.stopNextStage();
    this.nextGo = { ...next, left: NEXT_STAGE_SECONDS };
    this.nextTimer = setInterval(() => {
      if (this.modalOpen) return;
      if (--this.nextGo.left <= 0) this.goNextStage();
      else this.renderNextStage();
    }, 1000);
    this.renderNextStage();
  }

  renderNextStage() {
    const go = this.nextGo;
    const el = $('next-stage');
    el.hidden = !go;
    if (!go) return;
    el.replaceChildren(h('span', { class: 'emoji' }, '🌟'), `Stage ${go.stage} in ${go.left}…`, h('span', { class: 'go' }, 'Go now ▶'));
  }

  goNextStage() {
    const go = this.nextGo;
    this.stopNextStage();
    if (go) this.gameHandlers?.nextStage?.(go.code);
  }

  stopNextStage() {
    clearInterval(this.nextTimer);
    this.nextTimer = 0;
    this.nextGo = null;
    $('next-stage').hidden = true;
  }

  // ------------------------------------------------ school

  // The classes at a chalkboard (game.js openClass, shared/school.js): one
  // at elementary school Year 2 level and one at middle school Year 3, each
  // a few questions, with the break before the next one counting down on a
  // class just had.
  classDialog() {
    const g = this.game;
    if (!g) return;
    const levels = Object.values(QUIZ_LEVELS);
    let timer = 0;
    this.openModal(
      (root) => {
        const list = h('div', { class: 'class-list' });
        const render = () => {
          list.replaceChildren(
            ...levels.map((l) => {
              const wait = g.classBreak(l.key);
              const s = Math.ceil(wait / 1000);
              return h(
                'button',
                {
                  class: `big ${l.key === 'senior' ? 'pink' : 'blue'}`,
                  type: 'button',
                  disabled: wait > 0,
                  onclick: () => {
                    this.sound.unlock();
                    this.sound.play('ui');
                    g.startClass(l.key);
                  },
                },
                h('span', { class: 'emoji' }, l.icon),
                h('span', { class: 'quiz-level' }, h('span', {}, l.name), h('span', { class: 'quiz-sub' }, wait > 0 ? `🔔 Break: next class in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${CLASS_SIZE} questions · 🪙 ${quizCoins(1, l.key)} a right answer`)),
              );
            }),
          );
        };
        root.append(h('h2', {}, '🏫 School'), h('p', {}, 'Take a seat — class is about to begin! Pick a class, and every right answer earns coins.'), list);
        render();
        timer = setInterval(render, 1000);
      },
      { narrow: true, onClose: () => clearInterval(timer) },
    );
  }

  // ------------------------------------------------ cooking classes

  // The recipes at a stove (game.js openCooking, shared/cooking.js), one big
  // button each, the break before cooking one again counting down on a
  // recipe just made.
  cookDialog() {
    const g = this.game;
    if (!g) return;
    let timer = 0;
    this.openModal(
      (root) => {
        const list = h('div', { class: 'recipe-list' });
        const render = () => {
          list.replaceChildren(
            ...RECIPES.map((r, i) => {
              const wait = g.cookBreak(r.key);
              const s = Math.ceil(wait / 1000);
              return h(
                'button',
                {
                  class: `big ${['blue', 'pink', 'green'][i % 3]}`,
                  type: 'button',
                  disabled: wait > 0,
                  'data-recipe': r.key,
                  onclick: () => {
                    this.sound.unlock();
                    this.sound.play('ui');
                    g.startCooking(r.key);
                  },
                },
                h('span', { class: 'emoji' }, r.icon),
                h('span', { class: 'quiz-level' }, h('span', {}, r.name), h('span', { class: 'quiz-sub' }, wait > 0 ? `🧽 Washing up: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${r.steps.length} steps · 🪙 up to ${cookCoins(r.steps.length)}`)),
              );
            }),
          );
        };
        root.append(h('h2', {}, '🍳 Cooking Class'), h('p', {}, 'Aprons on! Pick a recipe, then tap each step in the right order. Every step right first time earns a coin.'), list);
        render();
        timer = setInterval(render, 1000);
      },
      { onClose: () => clearInterval(timer) },
    );
  }

  // ------------------------------------------------ studying

  // Your workbooks at a study desk (game.js openStudy, shared/study.js), one
  // big button each, with how many of its facts you know by heart.
  studyDialog() {
    const g = this.game;
    if (!g) return;
    const notebook = g.notebook;
    this.openModal(
      (root) => {
        const list = h(
          'div',
          { class: 'recipe-list' },
          WORKBOOKS.map((w, i) => {
            const p = workbookProgress(notebook, w.key);
            return h(
              'button',
              {
                class: `big ${['blue', 'pink', 'green'][i % 3]} workbook`,
                type: 'button',
                'data-book': w.key,
                onclick: () => {
                  this.sound.unlock();
                  this.sound.play('ui');
                  g.startStudy(w.key);
                },
              },
              h('span', { class: 'emoji' }, w.icon),
              h(
                'span',
                { class: 'quiz-level' },
                h('span', {}, w.name),
                h('span', { class: 'quiz-sub' }, w.how),
                h('span', { class: 'study-meter', role: 'img', 'aria-label': `${p.byHeart} of ${p.total} known by heart` }, h('span', { style: `width: ${(100 * p.byHeart) / p.total}%` })),
                h('span', { class: 'quiz-sub' }, `💡 ${p.byHeart} of ${p.total} by heart`),
              ),
            );
          }),
        );
        root.append(
          h('h2', {}, '📚 Study time'),
          h('p', {}, `Pick a workbook. New facts are shown to you first, then you type the answers. Get a fact right ${BY_HEART} times and you know it by heart!`),
          list,
        );
      },
      {},
    );
  }

  // The study going changed: its window opened on a new one, or brought up
  // to date.
  studyNews() {
    const s = this.game?.study;
    if (!s) return;
    if (this.studyEls?.study !== s) this.studyingDialog();
    else this.renderStudy();
  }

  // A word said out loud, for spelling (when the browser can speak).
  sayWord(word) {
    try {
      const synth = globalThis.speechSynthesis;
      if (!synth || !globalThis.SpeechSynthesisUtterance) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.8;
      synth.speak(u);
    } catch {
      // no voice: the picture and the sentence still tell the word
    }
  }

  // A study, in a window: a new fact on its card, the question being asked
  // with a box to type the answer in, a miss with the right answer and a way
  // to work it out, and at the end how it went.
  studyingDialog() {
    const g = this.game;
    const s = g?.study;
    if (!s) return;
    const book = workbookByKey(s.book);
    this.studyEls = null;
    this.openModal(
      (root) => {
        const status = h('div', { class: 'quiz-status' });
        const box = h('div', { class: 'study-box' });
        this.studyEls = { study: s, status, box, miss: null, said: -1, cheer: '' };
        root.append(h('h2', {}, `${book.icon} ${book.name}`), status, box);
      },
      {
        narrow: true,
        onClose: () => {
          this.studyEls = null;
          if (g.study === s) g.closeStudy();
        },
      },
    );
    this.renderStudy();
  }

  renderStudy() {
    const g = this.game;
    const s = g?.study;
    const els = this.studyEls;
    if (!s || els?.study !== s || !this.modalOpen) return;
    const book = workbookByKey(s.book);
    const total = factsOf(s.book).length;
    // A fact shown with its answer, as on a card.
    const solved = (fact) => (book.words ? h('div', { class: 'study-q' }, h('span', { class: 'study-picture', 'aria-hidden': 'true' }, fact.picture), ` ${fact.answer}`) : h('div', { class: 'study-q' }, fact.q.replace('?', fact.answer)));
    const button = (label, cls, fn) => h('button', { class: `big ${cls}`, type: 'button', onclick: fn }, label);
    const setStatus = (text) => {
      if (els.status.dataset.k === text) return;
      els.status.dataset.k = text;
      els.status.textContent = text;
    };

    if (els.miss) {
      const { fact } = els.miss;
      setStatus('Not quite!');
      const ok = button('OK, next', 'blue', () => {
        this.sound.play('ui');
        els.miss = null;
        this.renderStudy();
      });
      els.box.replaceChildren(h('p', { class: 'quiz-verdict' }, `🙈 The answer is ${fact.answer}:`), solved(fact), h('p', { class: 'study-hint' }, `💡 ${fact.hint}`), h('p', { class: 'muted' }, 'It will come back again soon, so you can get it right.'), ok);
      this.focusSoon(ok, 50);
      return;
    }

    if (s.done) {
      if (!els.cheered) {
        els.cheered = true;
        this.sound.play(s.missed.length ? 'fanfare' : 'victory');
      }
      const asked = s.asks.filter((a) => !a.again).length;
      const p = workbookProgress(g.notebook, s.book);
      setStatus(`Done! ${s.right} of ${asked} right first time`);
      els.box.replaceChildren(
        h('div', { class: 'cook-dish', 'aria-hidden': 'true' }, s.missed.length ? '📚' : '🌟'),
        h('div', { class: `quiz-result${s.missed.length ? '' : ' perfect'}` }, s.missed.length ? 'Good studying!' : 'Every one right first time!'),
        h('p', { class: 'quiz-credit' }, s.learnt ? `💡 ${s.learnt} more by heart! ` : '', `You know ${p.byHeart} of ${p.total} by heart.`, s.xp ? ` You earned ⭐ ${s.xp} XP.` : ''),
        s.missed.length ? h('p', { class: 'study-hint' }, '📝 To practise: ', s.asks.filter((a) => !a.again && s.missed.includes(a.fact.key)).map((a) => (book.words ? a.fact.answer : a.fact.q.replace('?', a.fact.answer))).join(', ')) : '',
        h('div', { class: 'study-meter big', role: 'img', 'aria-label': `${p.byHeart} of ${total} known by heart` }, h('span', { style: `width: ${(100 * p.byHeart) / total}%` })),
        button('🔁 Study again', 'blue', () => {
          this.sound.play('ui');
          g.startStudy(s.book);
        }),
        button('📖 Another workbook', 'pink', () => {
          this.sound.play('ui');
          this.closeModal();
          this.studyDialog();
        }),
        button('Done', 'green', () => this.closeModal()),
      );
      return;
    }

    const ask = s.asks[s.at];
    const { fact } = ask;
    const where = `${s.at + 1} of ${s.asks.length}`;
    if (ask.learn && !s.shown) {
      setStatus(`${where} · New!`);
      const got = button('👍 Got it', 'green', () => {
        this.sound.play('ui');
        g.studySeen();
      });
      if (book.words && els.said !== s.at) {
        els.said = s.at;
        this.sayWord(fact.say);
      }
      els.box.replaceChildren(
        h('p', {}, book.words ? '📖 A new word to learn:' : '📖 A new fact to learn:'),
        solved(fact),
        book.words ? h('p', { class: 'study-sentence' }, fact.q.replace('___', fact.answer)) : '',
        h('p', { class: 'study-hint' }, `💡 ${fact.hint}`),
        book.words ? button('🔊 Hear it', 'blue', () => this.sayWord(fact.say)) : '',
        got,
      );
      this.focusSoon(got, 50);
      return;
    }

    setStatus(`${els.cheer}${where}${ask.again ? ' · Try this one again' : ''}`);
    const input = h('input', {
      type: 'text',
      class: 'text-input study-input',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: false,
      inputmode: book.words ? 'text' : 'numeric',
      maxLength: 20,
      'aria-label': 'Your answer',
      placeholder: book.words ? 'Spell the word' : '?',
    });
    const check = () => {
      if (!input.value.trim()) {
        input.focus();
        return;
      }
      this.sound.unlock();
      const got = g.studyAnswer(input.value);
      if (!got) return;
      // The window is already on the next one: say how this one went.
      els.cheer = got.right ? '✅ Right! · ' : '';
      if (got.right) this.sound.play('collect');
      else {
        this.sound.play('no');
        els.miss = got;
      }
      this.renderStudy();
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        check();
      }
    };
    if (book.words && els.said !== s.at) {
      els.said = s.at;
      this.sayWord(fact.say);
    }
    els.box.replaceChildren(
      book.words
        ? h('div', { class: 'study-q' }, h('span', { class: 'study-picture', 'aria-hidden': 'true' }, fact.picture))
        : h('div', { class: 'study-q' }, fact.q),
      book.words ? h('p', { class: 'study-sentence' }, fact.q) : '',
      book.words ? button('🔊 Hear it', 'blue', () => this.sayWord(fact.say)) : '',
      h('form', { class: 'study-answer', onsubmit: (e) => (e.preventDefault(), check()) }, input, h('button', { class: 'big green', type: 'submit' }, 'Check')),
      h('p', { class: 'muted' }, `💡 ${workbookProgress(g.notebook, s.book).byHeart} of ${total} by heart · a fact is by heart after ${BY_HEART} times right`),
    );
    this.focusSoon(input, 50);
  }

  // The cooking class going changed: its window opened on a new one, or
  // brought up to date.
  cookingNews() {
    const c = this.game?.cooking;
    if (!c) return;
    if (this.cookEls?.cooking !== c) this.cookingDialog();
    else this.renderCooking();
  }

  // The cooking class, in a window: the steps done so far, a pan with what
  // has gone in, and the steps to pick the next one from; at the end, the
  // dish made and what it earned.
  cookingDialog() {
    const g = this.game;
    const c = g?.cooking;
    if (!c) return;
    const recipe = recipeByKey(c.recipe);
    this.cookEls = null;
    this.openModal(
      (root) => {
        const status = h('div', { class: 'quiz-status' });
        const box = h('div', { class: 'cook-box' });
        this.cookEls = { cooking: c, status, box, wrong: new Set(), step: 0 };
        root.append(h('h2', {}, `${recipe.icon} ${recipe.name}`), status, box);
      },
      {
        narrow: true,
        onClose: () => {
          this.cookEls = null;
          if (g.cooking === c) g.closeCooking();
        },
      },
    );
    this.renderCooking();
  }

  renderCooking() {
    const g = this.game;
    const c = g?.cooking;
    const els = this.cookEls;
    if (!c || els?.cooking !== c || !this.modalOpen) return;
    const recipe = recipeByKey(c.recipe);
    const total = c.asks.length;
    if (els.step !== c.step) {
      els.step = c.step;
      els.wrong.clear();
    }
    const status = c.done ? `Ready! ${c.right} of ${total} steps right first time` : `Step ${c.step + 1} of ${total} · What comes next?`;
    if (els.status.dataset.k !== status) {
      els.status.dataset.k = status;
      els.status.textContent = status;
    }
    const done = recipe.steps.slice(0, c.step);
    const steps = h('ol', { class: 'cook-steps' }, done.map((st) => h('li', {}, `✅ ${st.icon} ${st.text}`)));
    if (c.done) {
      if (!els.served) {
        els.served = true;
        this.sound.play(c.right === total ? 'victory' : 'fanfare');
      }
      const other = RECIPES.find((r) => r.key !== c.recipe && !g.cookBreak(r.key));
      els.box.replaceChildren(
        h('div', { class: 'cook-dish', 'aria-hidden': 'true' }, recipe.icon),
        h('div', { class: `quiz-result${c.right === total ? ' perfect' : ''}` }, `${c.right === total ? '🌟' : '🧑‍🍳'} Your ${recipe.name}${recipe.name.endsWith('s') ? ' are' : ' is'} ready!`),
        h('p', { class: 'quiz-credit' }, c.right === total ? 'Every step right first time! ' : 'Yummy! ', `You earned: 🪙 ${c.coins} ${c.coins === 1 ? 'coin' : 'coins'}`, c.xp ? ` and ⭐ ${c.xp} XP` : ''),
        steps,
        h('p', { class: 'muted' }, `🧽 The ${recipe.name} can be made again after a ${Math.round(COOK_BREAK_MS / 60_000)}-minute wash-up.`),
        other ? h('button', { class: 'big blue', type: 'button', onclick: () => { this.sound.play('ui'); this.closeModal(); this.cookDialog(); } }, h('span', { class: 'emoji' }, '📖'), ' Cook something else') : '',
        h('button', { class: 'big green', type: 'button', onclick: () => this.closeModal() }, 'Done'),
      );
      return;
    }
    const ask = c.asks[c.step];
    const pan = h('div', { class: 'cook-pan', 'aria-label': done.length ? `In the pan: ${done.map((st) => st.icon).join(' ')}` : 'An empty pan' }, done.length ? done.map((st) => h('span', {}, st.icon)) : h('span', { class: 'muted' }, '🍳'));
    const answers = h(
      'div',
      { class: 'quiz-answers', role: 'group', 'aria-label': 'Steps' },
      ask.choices.map((choice, at) =>
        h(
          'button',
          {
            class: `quiz-answer cook-step${els.wrong.has(at) ? ' wrong' : ''}`,
            type: 'button',
            disabled: els.wrong.has(at),
            onclick: () => {
              this.sound.unlock();
              const right = g.cookPick(at);
              if (right === true) this.sound.play('collect');
              else if (right === false) {
                els.wrong.add(at);
                this.sound.play('no');
                this.renderCooking();
              }
            },
          },
          h('span', { class: 'emoji' }, choice.icon),
          ` ${choice.text}`,
        ),
      ),
    );
    els.box.replaceChildren(steps, pan, answers, els.wrong.size ? h('p', { class: 'quiz-verdict' }, '🙈 Not yet! Which step comes before that one?') : '');
  }

  // The quiz you are taking, in a window: where it has got to, the question
  // being asked with its answers to pick from, and after the last one, what
  // you got and what it earned. Kept up to date as you answer (renderQuiz).
  // A question answered stays up a moment to show which answer was right,
  // until Next goes on to the question after it.
  quizDialog() {
    const g = this.game;
    const q = g?.quiz;
    if (!q) return;
    const def = QUIZ_LEVELS[q.level];
    this.quizEls = null;
    this.quizAt = 0;
    this.openModal(
      (root) => {
        const status = h('div', { class: 'quiz-status' });
        const box = h('div', { class: 'quiz-box' });
        this.quizEls = { quiz: q, status, box };
        root.append(h('h2', {}, `${def.icon} ${def.name}`), status, box);
      },
      {
        narrow: true,
        onClose: () => {
          this.quizEls = null;
          // Another quiz taken over this window (startQuiz from its results)
          // must not be closed with the window it took over.
          if (g.quiz === q) g.closeQuiz();
        },
      },
    );
    this.renderQuiz();
  }

  // The quiz's window, as it changes: the question and its answers (the one
  // you picked, which was right, and which was not), or the results and what
  // they earned, with the other quiz there to take if it is still to do.
  renderQuiz() {
    const g = this.game;
    const q = g?.quiz;
    const els = this.quizEls;
    if (!q || els?.quiz !== q || !this.modalOpen) return;
    const total = q.questions.length;
    if (q.done && !els.done) {
      els.done = true;
      this.sound.play(q.right === total ? 'victory' : 'fanfare');
    }
    const i = Math.min(this.quizAt, q.picks.length);
    const status = q.done && this.quizAt >= total ? `You got ${q.right} of ${total} right!` : total === 1 ? 'Pick the right answer' : `Question ${i + 1} of ${total} · ${q.right} right`;
    if (els.status.dataset.k !== status) {
      els.status.dataset.k = status;
      els.status.textContent = status;
    }
    // All answered, and past the last one's answer: the results.
    if (q.done && this.quizAt >= total) {
      const perfect = q.right === total;
      const coins = q.coins ?? quizCoins(q.right, q.level);
      const other = Object.values(QUIZ_LEVELS).find((l) => l.key !== q.level && (q.school ? !g.classBreak(l.key) : g.quizOffer && !g.quizOffer.taken[l.key]));
      els.box.replaceChildren(
        h('div', { class: `quiz-result${perfect ? ' perfect' : ''}` }, `${perfect ? '💯' : '🎓'} ${q.right} of ${total} right`),
        h(
          'p',
          { class: 'quiz-credit' },
          perfect ? (total === 1 ? 'Right! ' : 'Perfect, every one right! ') : q.right ? 'Well done! ' : '',
          `${q.school ? 'You earned' : 'Extra credit'}: 🪙 ${coins} ${coins === 1 ? 'coin' : 'coins'}`, q.xp ? ` and ⭐ ${q.xp} XP` : '',
        ),
        q.school ? h('p', { class: 'muted' }, `🔔 The next ${QUIZ_LEVELS[q.level].name} class is after a ${Math.round(CLASS_BREAK_MS / 60_000)}-minute break.`) : '',
        other ? h('button', { class: 'big blue', type: 'button', onclick: () => { this.sound.play('ui'); if (q.school) g.startClass(other.key); else g.startQuiz(other.key); } }, h('span', { class: 'emoji' }, other.icon), q.school ? ` The ${other.name} class` : ` The ${other.name} quiz`) : '',
        h('button', { class: 'big green', type: 'button', onclick: () => this.closeModal() }, 'Done'),
      );
      return;
    }
    // The question being asked, or the one just answered, its answers marked.
    const ask = q.questions[i];
    const answered = this.quizAt < q.picks.length;
    const answers = h(
      'div',
      { class: 'quiz-answers', role: 'group', 'aria-label': 'Answers' },
      ask.choices.map((choice, at) =>
        h(
          'button',
          {
            class: `quiz-answer${answered ? (at === ask.answer ? ' right' : at === q.picks[this.quizAt] ? ' wrong' : ' dim') : ''}`,
            type: 'button',
            disabled: answered,
            onclick: () => {
              this.sound.unlock();
              const right = g.quizAnswer(at);
              if (right === true) this.sound.play('collect');
              else if (right === false) this.sound.play('no');
            },
          },
          choice,
        ),
      ),
    );
    els.box.replaceChildren(
      h('div', { class: 'quiz-question' }, ask.q),
      answers,
      answered ? h('p', { class: 'quiz-verdict' }, q.picks[this.quizAt] === ask.answer ? '✅ Yes, that’s the one!' : '❌ Not this one — the right answer is the one outlined green.') : '',
      answered
        ? h('button', { class: 'big green', type: 'button', onclick: () => { this.sound.play('ui'); this.quizAt++; this.renderQuiz(); } }, this.quizAt === total - 1 ? 'How you did ▶' : 'Next ▶')
        : '',
    );
  }

  // On a tower defense island: Build, beside the pad you stand by (Bigger,
  // for a tower there, with its cost in bricks), or by none, Start, while
  // the next wave waits.
  defendButton(g, r) {
    const el = $('defend');
    const t = g.defendTarget();
    if (!t || this.modalOpen || (t.pad && !t.cost)) {
      el.hidden = true;
      return;
    }
    const d = g.defense;
    const touch = this.input.touchMode;
    const label = t.start ? `🌊 Start wave ${d.wave}` : t.pad.level ? `⬆️ Bigger · 🧱 ${t.cost}` : `🗼 Build · 🧱 ${t.cost}`;
    const key = `${label}|${touch}|${d.bricks >= (t.cost ?? 0)}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'V'));
      el.setAttribute('aria-label', t.start ? `Start wave ${d.wave}` : `${t.pad.level ? 'Make the tower bigger' : 'Build a tower'} for ${t.cost} bricks`);
      el.classList.toggle('short', !t.start && d.bricks < t.cost);
    }
    const w = r.canvas.clientWidth;
    const hgt = r.canvas.clientHeight;
    const width = el.offsetWidth || 170;
    const scr = t.pad ? r.project(t.pad.x, t.pad.y + 1.2, t.pad.z) : null;
    const x = scr?.visible ? scr.x : w / 2;
    const y = scr?.visible ? scr.y : hgt - 170;
    el.style.transform = `translate(${Math.min(w - 16 - width / 2, Math.max(16 + width / 2, x))}px, ${Math.min(hgt - 150, Math.max(200, y))}px) translate(-50%, -100%)`;
    el.hidden = false;
  }

  // On an adventure island: over each camp near you, how its flag is going
  // (or what to do there), and over King Grumble, his hearts (or his bubble);
  // over any other monster, its hearts.
  adventureTags(g, r) {
    const seen = new Set();
    const adv = g.adventure;
    const me = g.me?.body;
    const tag = (key, x, y, z, state, build, kind = '', onClick = null) => {
      const scr = r.project(x, y, z);
      if (!scr.visible) return;
      seen.add(key);
      let el = this.advTags.get(key);
      if (!el) {
        el = h('div', { class: `adv-tag ${kind}`.trim() });
        if (onClick) el.onclick = () => { this.sound.unlock(); onClick(); };
        this.advTags.set(key, el);
        $('overlays').append(el);
      }
      if (el.dataset.key !== state) {
        el.dataset.key = state;
        el.replaceChildren(...build());
      }
      el.style.transform = `translate(${scr.x}px, ${scr.y}px) translate(-50%, -100%)`;
    };
    const bar = (share, kind) => h('div', { class: `bar ${kind}` }, h('span', { style: `width:${Math.round(share * 100)}%` }));
    // On a tower defense island: over the Star Stone its hearts, over the
    // gate what it is, and over each pad near you what it holds.
    const def = g.defense;
    if (def && me) {
      const s = def.stone;
      if (Math.hypot(s.x - me.x, s.z - me.z) < 50) {
        tag('stone', s.x, s.y + 4.4, s.z, `${def.hearts}|${def.max}`, () => [h('div', { class: 'label' }, `🌟 Star Stone · ${def.hearts}`), bar(def.hearts / Math.max(1, def.max), 'stone')]);
      }
      const gt = def.gate;
      if (def.state !== 'won' && Math.hypot(gt.x - me.x, gt.z - me.z) < 50) tag('gate', gt.x, gt.y + 7.4, gt.z, 'gate', () => [h('div', { class: 'label' }, '👾 Monster gate')]);
      for (const p of def.pads) {
        if (Math.hypot(p.x - me.x, p.z - me.z) > 24) continue;
        const top = p.level ? towerTop(p, p.level).y + 1.1 : p.y + 1;
        const label = p.level ? `🗼 ${'★'.repeat(p.level)}` : '🧱 Tower pad';
        tag(`pad-${p.id}`, p.x, top, p.z, label, () => [h('div', { class: 'label' }, label)]);
      }
    }
    if (adv && me && !adv.won) {
      for (const c of adv.camps.values()) {
        if (c.freed || !c.flag) continue;
        const far = Math.hypot(c.x - me.x, c.z - me.z);
        if (far > 40) continue;
        const p = c.flag.group.position;
        const pct = Math.floor(c.progress * 100);
        let label;
        if (c.kind === 'castle') label = adv.shield ? '🫧 Free every camp first!' : '👑 Pop King Grumble!';
        else if (c.friends && c.guarded) label = '👾 Pop the monsters first!';
        else if (c.friends) label = `🚩 ${pct}%${c.friends > 1 ? ` · ${c.friends} friends` : ''}`;
        else if (far < c.r + 3) label = '🚩 Stand by the flag!';
        else label = `🚩 Camp ${c.id}`;
        // Over the heads of friends standing by it.
        tag(`camp-${c.id}`, p.x, p.y + 2.8, p.z, `${label}|${pct}`, () => [h('div', { class: 'label' }, label), c.kind === 'camp' && pct > 0 ? bar(c.progress, 'flag') : '']);
      }
      const king = [...g.monsters.values()].find((e) => e.kind === 'king');
      const p = king?.model.group.position;
      if (p && adv.king && Math.hypot(p.x - me.x, p.z - me.z) < 45) {
        const { hearts, max } = adv.king;
        tag('king', p.x, p.y + 2.9, p.z, `${hearts}|${max}|${adv.shield}`, () => [h('div', { class: 'label' }, adv.shield ? '👑 King Grumble 🫧' : '👑 King Grumble'), adv.shield ? '' : bar(hearts / Math.max(1, max), 'king')]);
      }
    }
    // A conquered island's extra-credit quizzes wait by its flag — the
    // castle's, or the last camp's on an island that had no castle — until
    // both are done: 🎓 over it, and a tap takes them (ui.js quizOfferDialog).
    if (adv && me && adv.won && g.quizOffer && Object.values(QUIZ_LEVELS).some((l) => !g.quizOffer.taken[l.key])) {
      const camps = [...adv.camps.values()];
      const spot = camps.find((c) => c.kind === 'castle') ?? camps[camps.length - 1];
      if (spot && Math.hypot(spot.x - me.x, spot.z - me.z) < 50) {
        tag('quiz', spot.x, spot.y + 4.6, spot.z, 'quiz', () => [h('div', { class: 'label' }, '🎓 Extra credit quiz!')], 'quiz', () => this.quizOfferDialog());
      }
    }
    // Over a wild dragon near you (dragon.js), its name and the hearts it has left.
    if (me) {
      for (const c of g.critters.values()) {
        const f = c.fight;
        if (c.type !== 'dragon' || !f || f.mood === 'tame') continue;
        const p = c.model.group.position;
        if (Math.hypot(p.x - me.x, p.z - me.z) > 40) continue;
        const label = `🐲 ${c.name || 'Dragon'}${f.mood === 'asleep' ? ' 💤' : ''} · wild`;
        tag(`dragon-${c.id}`, p.x, p.y + c.model.height + 0.6, p.z, `${label}|${f.hearts}|${f.max}`, () => [h('div', { class: 'label' }, label), bar(f.hearts / Math.max(1, f.max), 'king')]);
      }
    }
    // Over every other monster near you, a bar of the hearts it has left.
    if (me) {
      for (const e of g.monsters.values()) {
        if (adv && e.kind === 'king') continue;
        const p = e.model.group.position;
        if (Math.hypot(p.x - me.x, p.z - me.z) > 30) continue;
        const max = Math.max(1, e.max ?? 1);
        const hearts = Math.max(0, Math.min(max, e.hearts ?? max));
        const top = e.kind === 'king' ? 2.9 : bodyOf(e.kind).height + 0.3;
        tag(`mon-${e.id}`, p.x, p.y + top, p.z, `${hearts}|${max}`, () => [bar(hearts / max, 'monster')], 'mon');
      }
    }
    for (const [key, el] of this.advTags) {
      if (seen.has(key)) continue;
      el.remove();
      this.advTags.delete(key);
    }
  }

  // Name tags and speech bubbles follow everyone around; the maps keep up.
  // The bop button, on touch screens while a monster is about, showing the
  // toy weapon in your hand (or a fist) — and beside it, with two or more
  // weapons to carry, the button that flips through them.
  attackButton() {
    const g = this.game;
    const me = g.me?.body;
    const el = $('btn-attack');
    const close = (m, far = ATTACK_SHOW) => Math.hypot(m.x - me.x, m.y - me.y, m.z - me.z) < far;
    const near = Boolean(me) && !g.riding && ([...g.monsters.values()].some(({ model: { group: { position: m } } }) => close(m)) || [...g.critters.values()].some((c) => c.type === 'dragon' && c.fight && c.fight.mood !== 'tame' && close(c.model.group.position, ATTACK_SHOW + 6)));
    if (el.hidden === near) el.hidden = !near;
    const icon = wornWeapon(this.profile.data.gear)?.icon ?? '👊';
    if (el.textContent !== icon) el.textContent = icon;
    const swap = $('btn-weapon');
    const weapons = this.profile.data.gear.weapon >= 2;
    if (swap.hidden === weapons) swap.hidden = !weapons;
    if (weapons && swap.textContent !== icon) swap.textContent = icon;
  }

  frame(dt) {
    const g = this.game;
    if (!g?.world) return;
    this.minimap.frame(dt);
    this.attackButton();
    const r = g.renderer;
    const seen = new Set();
    const me = g.me?.body;
    for (const p of g.players.values()) {
      if (!p.avatar) continue;
      const pos = p.avatar.root.position;
      const far = me ? Math.hypot(pos.x - me.x, pos.z - me.z) : 0;
      // Not for a friend hiding from you at hide and seek, seen through walls.
      const showName = p.id !== g.pid && far < 45 && !g.hiddenFromMe(p.id);
      if (!showName && !p.bubble) continue;
      const scr = r.project(pos.x, pos.y + 1.72 + p.avatar.tall, pos.z);
      if (!scr.visible) continue;
      seen.add(p.id);
      let tag = this.tags.get(p.id);
      if (!tag) {
        tag = h('div', { class: 'tag' });
        this.tags.set(p.id, tag);
        $('overlays').append(tag);
      }
      const key = `${p.name}|${p.bubble?.text ?? ''}|${showName}|${p.id === g.host}|${p.look.level ?? 0}`;
      if (tag.dataset.key !== key) {
        tag.dataset.key = key;
        tag.style.setProperty('--c', shirtColor(p.look.shirt));
        tag.replaceChildren(
          p.bubble ? h('div', { class: `bubble${p.bubble.sticker ? ' sticker' : ''}`, lang: langOf(p.bubble.text) || undefined }, p.bubble.text) : '',
          showName ? h('div', { class: 'name' }, levelTag(p.look), p.name, p.id === g.host ? ' 🏝️' : '') : '',
        );
      }
      tag.style.transform = `translate(${scr.x}px, ${scr.y}px) translate(-50%, -100%)`;
    }
    for (const [pid, tag] of this.tags) {
      if (!seen.has(pid)) {
        tag.remove();
        this.tags.delete(pid);
      }
    }
    this.renderHideSeek();
    this.rideButton(g, r);
    this.defendButton(g, r);
    this.adventureTags(g, r);
    // The reward floats: each up out of the world where it happened and
    // gone, a second and a bit on.
    for (const [key, f] of this.floats) {
      const t = (performance.now() - f.at) / 1200;
      if (t >= 1) {
        f.el.remove();
        this.floats.delete(key);
        continue;
      }
      const scr = r.project(f.x, f.y + 0.9 + t * 1.2, f.z);
      if (!scr.visible) {
        f.el.style.opacity = '0';
        continue;
      }
      f.el.style.transform = `translate(${scr.x}px, ${scr.y}px) translate(-50%, -50%)`;
      f.el.style.opacity = t < 0.7 ? 1 : String(1 - (t - 0.7) / 0.3);
    }
    // The clock: sun, moon and weather.
    const t = g.env.time;
    const w = g.env.weather;
    const sky = isNight(t) ? '🌙' : t < 0.3 ? '🌅' : t > 0.7 ? '🌇' : '☀️';
    const weather = { cloudy: '☁️', rain: '🌧️', rainbow: '🌈', snow: '❄️', sprinkles: '🍬' }[w] ?? '';
    const clock = $('clock');
    if (clock.textContent !== `${sky}${weather}`) clock.replaceChildren(sky, weather ? h('span', { class: 'weather' }, weather) : '');
  }
}

// How the page sits on the screen, for a problem report: what a browser
// reports wrongly shows up here, such as the strip the Home Screen game on an
// iPad leaves along the bottom (the window, the page, 100vh and the world
// against the screen and the notch and status bar's insets).
function layoutFacts() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const px = (v) => Math.round(parseFloat(v) || 0);
  const vh = Math.round(probe.getBoundingClientRect().height) - px(cs.paddingTop) - px(cs.paddingBottom);
  const insets = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px).join(' ');
  probe.remove();
  const vv = globalThis.visualViewport;
  const world = document.getElementById('world')?.getBoundingClientRect();
  const titleEl = document.getElementById('title');
  const title = titleEl && !titleEl.hidden ? titleEl.getBoundingClientRect() : null;
  const app = navigator.standalone === true ? 'yes' : navigator.standalone === false ? 'no' : '?';
  return [
    `home screen ${app}, standalone ${matchMedia('(display-mode: standalone)').matches ? 'yes' : 'no'}`,
    `screen ${screen.width}×${screen.height}`,
    `page ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}`,
    vv ? `visual ${Math.round(vv.width)}×${Math.round(vv.height)}+${Math.round(vv.offsetTop)}` : null,
    `100vh ${vh}`,
    `insets ${insets}`,
    world ? `world ${Math.round(world.top)}..${Math.round(world.bottom)}` : null,
    title ? `title ${Math.round(title.top)}..${Math.round(title.bottom)}` : null,
    `gap ${getComputedStyle(document.documentElement).getPropertyValue('--app-gap').trim() || 'none'}`,
  ]
    .filter(Boolean)
    .join('; ');
}
