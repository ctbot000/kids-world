// Everything on top of the 3D view: the title screen, the toolbar and
// hotbar, the toy box, talking and emotes, name tags and speech bubbles,
// settings, stickers, the ranking, help, logging in and full screen. Big
// buttons, pictures first, few words.
import * as B from './shared/blocks.js';
import { ARCADE_GAMES, FACES as CARD_FACES } from './shared/arcade.js';
import { ANIMAL_TYPES, CRITTER_INFO, VEHICLES } from './shared/critters.js';
import { isNight } from './shared/env.js';
import { prettyCode } from './shared/codes.js';
import { STICKER_XP } from './shared/levels.js';
import { BOARDS } from './shared/ranking.js';
import { GEAR, levelDoes, nextLevel, sellPrice, wearing, wornWeapon } from './shared/shop.js';
import { STAMPS } from './shared/stamps.js';
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem, USERNAME_MAX, USERNAME_MIN, usernameProblem } from './shared/keeper.js';
import { ANIMALS, CHAT_MAX, cleanChat, cleanIslandName, cleanLook, cleanName, EMOTES, FACES, FUR_COLORS, GROWN_UP, HAIR_COLORS, HAIRS, HATS, ISLAND_NAME_MAX, isPerson, isValidName, langOf, lookIcon, NAME_MAX, PET_COATS, petKind, PETS, PHRASES, randomPetName, SHIRT_COLORS, SKIN_TONES, STICKERS as STICKER_EMOJI, randomIslandName, randomName } from './shared/words.js';
import { SIZES, THEMES } from './shared/worldgen.js';
import { PASSCODE_LENGTH, randomPasscode } from './shared/listing.js';
import { bodyOf, MAX_HEARTS } from './shared/monsters.js';
import { towerTop } from './shared/defense.js';
import { blockIcon } from './render/atlas.js';
import { seatOf } from './shared/seats.js';
import { shirtColor } from './render/avatar.js';
import { fullscreenMode, isFullscreen, onFullscreenChange, setFullscreen } from './fullscreen.js';
import { hairIcon } from './hair-icons.js';
import { HILL_MODES, TOOLS } from './game.js';
import { MiniMap } from './minimap.js';
import { STICKERS } from './profile.js';

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
const THEME_ICON = Object.fromEntries(THEMES.map((t) => [t.key, t.icon]));

// What the island rule for monsters means (shared/monsters.js).
// The bop button shows while a monster is this near.
const ATTACK_SHOW = 14;
const MONSTERS_ABOUT = 'Grumpy jelly blobs hop after you and take a heart. Jump on one to pop it, or walk right up to it and bop it three times with 👊 (X)! Watch out for big Bruisers and prickly Spikies, more of them at night.';
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

export class UI {
  constructor({ profile, sound, atlas, input }) {
    this.profile = profile;
    this.sound = sound;
    this.atlas = atlas;
    this.input = input;
    this.icons = new Map();
    this.game = null;
    this.tags = new Map();
    // Over an adventure island's camps and King Grumble (see adventureTags).
    this.advTags = new Map();
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
    profile.addEventListener('sticker', (e) => {
      const s = e.detail;
      this.sound.play('sticker');
      this.toast(s.icon, `New sticker: ${s.name}!`, 'sticker');
    });
    profile.addEventListener('basket', () => this.renderBasket());
    for (const type of ['count', 'change']) profile.addEventListener(type, () => this.renderLevel());
    profile.addEventListener('level', (e) => this.levelUp(e.detail.level));
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

  // ------------------------------------------------ title screen

  showTitle(handlers) {
    this.handlers = handlers;
    $('title').hidden = false;
    $('hud').hidden = true;
    this.renderMe();
    this.renderLogin();
    $('btn-new').onclick = () => this.newIslandDialog();
    $('btn-visit').onclick = () => this.visitDialog();
    $('btn-mine').onclick = () => this.myIslandsDialog();
    $('btn-me').onclick = () => this.meDialog();
    $('btn-pet').onclick = () => this.petDialog();
    $('btn-login').onclick = () => (handlers.login.who() ? this.myLoginDialog() : this.loginDialog());
    $('btn-stickers').onclick = $('btn-level').onclick = () => this.stickersDialog();
    $('btn-shop').onclick = () => this.shopDialog();
    $('btn-ranking').onclick = () => this.rankingDialog();
    $('btn-players').onclick = () => this.playersDialog();
    $('btn-help').onclick = () => this.helpDialog();
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

  // Up a level: a fanfare, and sparkles round you on an island.
  levelUp(level) {
    this.sound.play('levelup');
    this.toast('🎉', `Level up! You are level ${level}!`, 'sticker level-up');
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
        setTimeout(() => digits.boxes[prefill.length >= 6 ? 5 : prefill.length]?.focus(), 50);
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
    const draw = (islands) => {
      note.hidden = islands.length > 0;
      note.textContent = 'No islands are open right now. Make one, and it shows up here for everyone!';
      list.replaceChildren(
        ...islands.map((it) => {
          const full = it.players >= it.max;
          const size = SIZES.find((s) => s.key === it.size)?.name ?? '';
          const who = it.players === 0 ? 'Nobody there right now' : `${it.players} of ${it.max} playing`;
          const adv = it.adventure
            ? it.adventure.won
              ? '🏆 Freed'
              : `⚔️ ${it.adventure.freed} of ${it.adventure.camps} camps free`
            : it.defense
              ? it.defense.won
                ? '🏆 Safe'
                : `🗼 Wave ${it.defense.wave} of ${it.defense.waves}`
              : '';
          return h(
            'div',
            { class: 'island-item' },
            h('span', { class: 'emoji' }, THEME_ICON[it.theme] ?? '🏝️'),
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
      let again = 5000;
      try {
        const islands = await this.handlers.openIslands();
        if (list.isConnected) draw(islands);
      } catch (error) {
        again = 30000;
        if (!list.isConnected) return;
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
        setTimeout(() => digits.boxes[0]?.focus(), 50);
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
    const got = this.profile.data.stickers;
    this.openModal((root) => {
      const count = STICKERS.filter((s) => got[s.key]).length;
      const ranking = this.handlers?.login?.available() ? h('button', { class: 'chip', type: 'button', onclick: () => this.rankingDialog() }, '🏆 Ranking') : null;
      const { xp, level, into, need } = this.profile.progress;
      root.append(
        h(
          'div',
          { class: 'level-card' },
          h('b', { class: 'level-big' }, `⭐ Level ${level}`),
          h('div', { class: 'level-bar wide', role: 'img', 'aria-label': need ? `${into} of ${need} XP` : 'Full' }, h('span', { style: `width:${need ? Math.floor((100 * into) / need) : 100}%` })),
          h('span', { class: 'muted' }, need ? `${xp.toLocaleString()} XP · ${(need - into).toLocaleString()} more to level ${level + 1}` : `${xp.toLocaleString()} XP · the top level!`),
          h('span', { class: 'muted' }, `Everything you do earns XP: building, finding treasures, petting animals, riding, exploring and popping monsters, and every sticker is ${STICKER_XP} more.`),
        ),
        h('div', { class: 'dialog-head' }, h('h2', {}, `⭐ My stickers (${count} of ${STICKERS.length})`), ranking, h('button', { class: 'chip', type: 'button', onclick: () => this.shopDialog() }, '🛒 Shop')),
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

  // The shop: sell what is in your basket for coins, and buy running shoes
  // and flying gear with them (shop.js). Redrawn as your basket changes, so
  // what you find while it is open shows up to sell.
  shopDialog() {
    const p = this.profile;
    let onBasket = null;
    this.openModal(
      (root) => {
        const coins = h('span', { class: 'coins', 'aria-label': 'Your coins' });
        const sell = h('div', { class: 'grid shop-grid' });
        const gear = h('div', { class: 'grid shop-grid gear-grid' });
        const button = (text, onclick, disabled = false) => h('button', { class: 'chip', type: 'button', disabled, onclick }, text);
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
              : [h('p', { class: 'muted shop-empty' }, 'Your basket is empty. Pick fruit, find seashells and star pieces, and dig up jewels, then sell them here!')]),
          );
          gear.replaceChildren(
            ...GEAR.map((g) => {
              const level = p.data.gear[g.key];
              const owned = level ? g.levels[level - 1] : null;
              const next = nextLevel(p.data.gear, g.key);
              const on = wearing(p.data.gear, g.key) > 0;
              const buy = () => {
                if (!p.buy(g.key)) {
                  this.sound.play('no');
                  return;
                }
                this.sound.play('fanfare');
                const now = { shoes: "You're running faster now.", wings: "You're flying faster now.", weapon: 'Walk up to a monster and bop it with the button (or X)!' }[g.key];
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
                  owned
                    ? button(on ? '🙌 Take off' : '👕 Put on', () => {
                        p.wear(g.key, !on);
                        this.sound.play('ui');
                      })
                    : null,
                  next
                    ? button(`${owned ? 'Upgrade to' : 'Buy'} ${next.icon} ${next.name} (🪙 ${next.price})`, buy, p.data.coins < next.price)
                    : h('span', { class: 'muted' }, '🏅 The best there is!'),
                ),
                next && p.data.coins < next.price ? h('span', { class: 'muted' }, `${next.price - p.data.coins} more coins to go!`) : null,
              );
            }),
          );
        };
        root.append(
          h('div', { class: 'dialog-head' }, h('h2', {}, '🛒 Shop'), coins),
          h('h3', {}, 'Sell your treasures'),
          sell,
          h('h3', {}, 'Gear'),
          gear,
        );
        draw();
        onBasket = draw;
        p.addEventListener('basket', onBasket);
      },
      { onClose: () => p.removeEventListener('basket', onBasket) },
    );
  }

  // The ranking of the players with a login, from the island keeper, live:
  // a tab for each board, its top players and your own place, redrawn as
  // the keeper tells of changes (a score that changed pops). Logged in, you
  // can leave it, or join it again; as the guest, logging in puts you in it.
  rankingDialog() {
    const keeper = this.handlers?.login?.keeper;
    if (!keeper) return;
    let current = BOARDS.some((b) => b.key === this.lastBoard) ? this.lastBoard : BOARDS[0].key;
    let onNews = null;
    let onStatus = null;
    this.openModal(
      (root) => {
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
            h('b', { class: 'who', lang: langOf(e.name) || undefined }, e.name, e.you ? h('span', { class: 'muted' }, ' (you)') : null),
            h('span', { class: `score${changed ? ' bump' : ''}` }, Number(e.score).toLocaleString()),
          );
        // Made once, so a tap on one is never lost to the keeper's news redrawing them.
        const tabs = BOARDS.map((b) =>
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
        );
        tabRow.append(...tabs);
        const draw = () => {
          this.lastBoard = current;
          BOARDS.forEach((b, i) => tabs[i].classList.toggle('on', b.key === current));
          const board = BOARDS.find((b) => b.key === current);
          const reply = this.ranking;
          const shown = reply?.boards?.find((b) => b.key === current);
          aboutText.textContent = board.text;
          live.hidden = !isLive();
          if (!shown) {
            list.replaceChildren();
            return;
          }
          const top = Array.isArray(shown.top) ? shown.top : [];
          const you = shown.you && top.length && !top.some((e) => e.you) ? { ...shown.you, name: this.profile.name, look: this.profile.look, you: true } : null;
          const before = drawn.key === current ? drawn.scores : null;
          const changed = (e) => Boolean(before) && before.get(e.name) !== e.score;
          drawn = { key: current, scores: new Map([...top, ...(you ? [you] : [])].map((e) => [e.name, e.score])) };
          if (!top.length) list.replaceChildren(h('li', { class: 'rank-empty muted' }, `Nobody yet. ${board.hint} to be the first!`));
          else list.replaceChildren(...top.map((e) => row(e, changed(e))), you ? h('li', { class: 'rank-gap', 'aria-hidden': 'true' }, '⋯') : '', you ? row(you, changed(you)) : '');
          const mine = keeper.login && reply.shown !== false && !shown.you && top.length ? h('p', { class: 'muted' }, `${board.hint} to be on this board too!`) : '';
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
              mine,
              h('label', { class: 'check-row' }, box, h('span', {}, 'Show me in the ranking')),
              h('p', { class: 'muted' }, reply.shown === false ? 'You are not in the ranking: nobody sees your name here.' : `Everyone sees your display name, ${this.profile.name}, and how you look.${players}`),
            );
          } else {
            foot.replaceChildren(h('p', { class: 'muted' }, `Players with a login are in the ranking.${players} Log in with 🔑 on the title screen to be in it too!`));
          }
        };
        onNews = (e) => {
          this.ranking = e.detail;
          note.say('', '');
          if (list.isConnected) draw();
        };
        onStatus = () => {
          if (list.isConnected) live.hidden = !isLive();
        };
        keeper.addEventListener('ranking', onNews);
        keeper.addEventListener('status', onStatus);
        root.append(h('h2', {}, '🏆 Ranking'), tabRow, about, h('div', { class: 'rank-note' }, note), list, foot);
        draw();
        note.say('🔎', 'Asking the island keeper…');
        keeper.watchRanking().catch((error) => {
          if (list.isConnected) note.say(...rankingTrouble(error), 'warn');
        });
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
            h('div', { class: 'info' }, h('b', { lang: langOf(p.name) || undefined }, p.name), h('span', { class: 'muted' }, p.online ? '🟢 Playing now' : 'Not playing right now')),
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
          let again = 5000;
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
        h('b', { lang: langOf(from.name) || undefined }, from.name),
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
          card('🪽', 'Fly', ['Press ', h('kbd', {}, 'F'), ' or the wings. Space goes up, ', h('kbd', {}, 'Shift'), ' goes down.']),
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
          card('🐴', 'Ride', ['Walk up to a pony, a cow, an elephant, a giraffe, a reindeer, a polar bear or a unicorn, and tap Ride (or press ', h('kbd', {}, 'Q'), '). Swim out to a dolphin or the whale and ride them too! A giant mosquito flies: hold jump to go up and ', h('kbd', {}, 'Shift'), ' (⬇️) to come down. Jump to jump, leap, blow water or spray it. ', h('kbd', {}, 'Q'), ' or 👋 gets you off.']),
          card('🚗', 'Vehicles', ['Walk up to the car, the boat, the digger, a mine cart or the kick scooter and tap Drive (or press ', h('kbd', {}, 'Q'), '). Jump to honk! The scooter is quicker than you run, and its bell goes ring-ring. Drive the digger into a hill to dig a tunnel and find jewels, and push a mine cart along its rails. More are in the toy box.']),
          card('🚌', 'Ride together', ['The bus and the ferry have seats for six friends. One of you drives; the others walk up and tap Hop on (or press ', h('kbd', {}, 'Q'), ') to ride along. Jump to honk!']),
          card('🚁', 'Fly', ['Get in the helicopter or the hot-air balloon and hold jump (', h('kbd', {}, 'Space'), ') to fly up, and ⬇️ (', h('kbd', {}, 'Shift'), ') to come down. Friends can hop on too: two in the helicopter, four in the balloon.']),
          card('🛗', 'Elevators', ['Stand on an elevator pad and jump to ride up to the next pad above, or tap ⬇️ (', h('kbd', {}, 'Shift'), ') to ride down. Put pads in a column, one above the other.']),
          card('🤸', 'Trampolines', ['Jump on a trampoline and bounce! Hold jump (', h('kbd', {}, 'Space'), ') to bounce higher and higher, or tap ⬇️ (', h('kbd', {}, 'Shift'), ') to stop. Stamp a Bouncy Castle to bounce with friends.']),
          card('🕹️', 'Video arcade', ['Put down an arcade machine from the toy box\'s 🛋️ Home tab, or a whole arcade of six with the 🕹️ Video Arcade stamp. Walk up to a machine and press ', h('kbd', {}, 'Q'), ' (or tap Play) for its game: on the purple one, bop the blobs that pop up — the gold ones are worth three; on the teal one, take turns flipping cards to find pairs. Everyone at a machine plays together, and a good game pays out a few coins!']),
          card('👊', 'Monsters', ['Jump on a monster to pop it! Or walk right up to it, face it and press ', h('kbd', {}, 'X'), ' or the 👊 button to bop it. A toy weapon from the 🛒 shop bops harder, and a sword or a bubble blaster reaches further. A big red Bruiser takes a few jumps and bumps hard, and never jump on a prickly orange Spiky: bop it!']),
          card('🗼', 'Tower defense islands', ['Make one with 🗼 Tower defense on. Monsters march along the road from their gate to the Star Stone. Stand by a wooden pad beside the road and tap 🗼 Build (or press ', h('kbd', {}, 'V'), ') for a tower that blows bubbles at them; build again to make it bigger. Every monster popped brings bricks. Ready? Tap 🌊 Start for the next wave!']),
          card('⚔️', 'Adventure islands', ['Make one with ⚔️ Adventure on. Pop the monsters of a camp, then stand by its flag to raise yours: with friends it goes up faster! A camp freed is a safe place. When every camp is free, pop King Grumble in his castle, and jump when he stomps. Out of hearts? Sit tight until a friend taps you to help you up.']),
          card('⛺', 'Tents', ['Stamp a huge Circus Tent or Camping Tent, or build one with tent cloth. Be in a tent at night for a camp out. No monster ever comes in!']),
          card('🍎', 'Treasures', ['Tap fruit, seashells and star pieces to put them in your basket. Plant fruit to grow a tree!']),
          card('💎', 'Jewels', ['Tap a sparkly gem rock to dig out its jewel. Look in the mine in the mountain, or dig deep down!']),
          card('🛒', 'Shop', ['Sell your fruit, shells, star pieces and jewels for coins in the 🛒 shop, then buy running shoes to run faster, wings or a jet pack to fly faster, and a toy sword, bubble blaster or star hammer to pop monsters!']),
          card('💬', 'Talk', ['Type to your friends with the speech bubble (', h('kbd', {}, 'T'), '), or tap a ready-made hello. Dance with the smiley.']),
          card('🗺️', 'Map', ['The little map shows where you are, with a yellow arrow. Tap it to see the whole island.']),
          card('↩️', 'Oops!', ['The undo button (or ', h('kbd', {}, 'Z'), ') takes back what you just did.']),
          card('🔢', 'Quick keys', [h('kbd', {}, '1'), '–', h('kbd', {}, '0'), ' pick blocks, ', h('kbd', {}, 'E'), ' opens the toy box, ', h('kbd', {}, 'T'), ' talks, ', h('kbd', {}, 'L'), ' changes how you look, ', h('kbd', {}, 'P'), ' takes a photo. The middle mouse button copies the block you point at.']),
          card('🎥', 'See through your eyes', ['Press 🎥 to look from behind you, through your own eyes, or from high in the sky. Zooming all the way in looks through your eyes too. Through your eyes, left and right turn you round.']),
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
        setTimeout(() => user.input.focus(), 60);
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
        setTimeout(() => (user ?? box).input.focus(), 60);
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

  // Safari on an iPhone cannot fill the screen, but the game opened from the Home Screen does.
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
    $('title').hidden = true;
    $('hud').hidden = false;
    document.body.classList.add('playing');
    document.body.classList.toggle('touch', this.input.touchMode);
    this.buildToolbar();
    this.buildHotbar();
    this.renderBasket();
    this.renderFriends();
    this.renderIsland();
    this.renderHearts();
    this.minimap.attach(game);
    this.renderMap();
    $('btn-toybox').onclick = () => this.toyBox();
    $('btn-view').onclick = () => this.nextView();
    $('btn-photo').onclick = () => this.takePhoto();
    $('btn-settings').onclick = () => this.settingsDialog();
    $('btn-help-hud').onclick = () => this.helpDialog();
    $('btn-stickers-hud').onclick = () => this.stickersDialog();
    $('btn-shop-hud').onclick = () => this.shopDialog();
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
    // Never keeping the focus, where Space (to jump) would press it again.
    $('ride').onmousedown = (e) => e.preventDefault();
    $('ride').onclick = () => {
      $('ride').blur();
      this.sound.unlock();
      game.toggleRide();
    };
    $('defend').onmousedown = (e) => e.preventDefault();
    $('defend').onclick = () => {
      $('defend').blur();
      this.sound.unlock();
      game.defend();
    };
    const on = (type, fn) => game.addEventListener(type, fn);
    on('players', () => this.renderFriends());
    on('settings', () => {
      this.renderIsland();
      this.renderHearts();
    });
    on('hearts', () => this.renderHearts());
    on('song', () => {
      this.drawSong?.();
      const song = game.song;
      if (song?.ready && song.id !== this.songToasted) {
        this.songToasted = song.id;
        this.toast('🎵', `Now playing: ${song.name}`);
      }
    });
    on('adventure', () => this.renderHearts());
    on('defense', () => this.renderDefense());
    on('welcome', () => this.renderDefense());
    on('arcade-open', () => this.arcadeDialog());
    on('arcade', () => this.renderArcade());
    on('tool', () => {
      this.buildToolbar();
      this.buildHotbar();
      this.renderBasket();
    });
    on('undo', () => this.buildToolbar());
    on('toast', (e) => this.toast(e.detail.icon, e.detail.text));
    on('notice', (e) => this.toast(e.detail.level === 'info' ? '💡' : '🙈', e.detail.text, e.detail.level === 'info' ? '' : 'warn'));
    on('chat', (e) => this.chatLine(e.detail));
    on('fly', (e) => $('btn-fly').classList.toggle('on', e.detail));
    on('aim', (e) => this.aimHint(e.detail));
    this.input.enabled = true;
  }

  detach() {
    this.game = null;
    this.minimap.detach();
    this.input.enabled = false;
    $('hud').hidden = true;
    $('ride').hidden = true;
    $('defend').hidden = true;
    $('defense').hidden = true;
    document.body.classList.remove('playing');
    for (const el of this.tags.values()) el.remove();
    this.tags.clear();
    for (const el of this.advTags.values()) el.remove();
    this.advTags.clear();
    $('chatlog').replaceChildren();
    this.closeModal();
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
            title: c.sprout ? `${c.plural}: plant one, or give one to an animal` : `${c.plural}: put one down`,
            onclick: () => this.pickBasket(c.key),
          },
          this.img(c.item, c.name),
          String(b[c.key]),
        ),
      ),
    );
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
      this.toast(c.sprout ? '🌱' : '✨', c.sprout ? `Tap the ground to plant ${withArticle(c.key)} tree, or tap an animal to give it one!` : `Tap the ground to put down ${withArticle(c.name.toLowerCase())}.`);
    }
  }

  // The toy box: every block, plant, stamp and animal to choose from.
  toyBox(tab = null) {
    const g = this.game;
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
          grid.replaceChildren(
            ...(vehicles ? VEHICLES : ANIMAL_TYPES).map((type) =>
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
        );
      },
      { narrow: true, seeThrough: true },
    );
  }

  inviteDialog() {
    const g = this.game;
    const handlers = this.gameHandlers;
    this.openModal(
      (root) => {
        root.append(h('h2', {}, `🏝️ ${g.world?.name ?? 'Island'}`));
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
        const adv = g.adventure;
        if (adv) {
          const camps = [...adv.camps.values()];
          const castle = camps.find((c) => c.kind === 'castle');
          root.append(
            h('h3', {}, adv.won ? '🏆 This island is free!' : '⚔️ Adventure'),
            h(
              'div',
              { class: 'adventure-list' },
              ...camps
                .filter((c) => c.kind === 'camp')
                .map((c) => h('div', { class: `camp${c.freed ? ' free' : ''}` }, c.freed ? '🚩' : '🏴', ` Camp ${c.id}`, h('span', { class: 'muted' }, c.freed ? 'free' : c.progress > 0 ? `${Math.floor(c.progress * 100)}%` : 'monsters'))),
              castle ? h('div', { class: `camp castle${adv.won ? ' free' : ''}` }, '👑', ' King Grumble', h('span', { class: 'muted' }, adv.won ? 'popped' : adv.shield ? 'in his bubble 🫧' : 'ready to pop!')) : '',
            ),
            adv.won ? '' : h('p', { class: 'muted' }, 'Pop the monsters of a camp, then stand by its flag together to raise yours. More friends, faster!'),
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
              h('span', { class: 'who' }, q.name, q.id === g.host ? ' 🏝️' : ''),
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

  // Saves a picture of the island (without the buttons) to the device.
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

  // Your hearts, shown while the island has monsters (or camps to free); a
  // shake when one goes. On an adventure island, how many camps are free too.
  renderHearts() {
    const el = $('hearts');
    const g = this.game;
    const adv = g?.adventure;
    const shown = Boolean(g?.settings.monsters) || Boolean(adv && !adv.won);
    el.hidden = !shown;
    if (!shown) {
      this.heartsShown = MAX_HEARTS;
      return;
    }
    const n = g.hearts;
    const camps = adv ? [...adv.camps.values()].filter((c) => c.kind === 'camp') : [];
    const freed = camps.filter((c) => c.freed).length;
    el.setAttribute('aria-label', `${n} of ${MAX_HEARTS} hearts${adv ? `, ${freed} of ${camps.length} camps free` : ''}`);
    el.replaceChildren(
      ...Array.from({ length: MAX_HEARTS }, (_, i) => h('span', { class: i < n ? '' : 'lost' }, '❤️')),
      adv ? h('span', { class: 'camps' }, `🚩 ${freed}/${camps.length}`) : '',
    );
    if (n < (this.heartsShown ?? MAX_HEARTS)) {
      el.classList.remove('hurt');
      void el.offsetWidth;
      el.classList.add('hurt');
    }
    this.heartsShown = n;
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
    if (!g.riding && !g.aboard && !g.rideTarget && !g.seat && !g.seatTarget && g.arcadeTarget) {
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
    // With someone at the wheel, the others hop on to ride along.
    const verb = info.vehicle ? (c.rider ? 'Hop on' : 'Drive') : 'Ride';
    const label = on ? (info.vehicle ? '👋 Get out' : '👋 Get off') : `${info.icon} ${verb}`;
    const key = `${label}|${touch}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'Q'));
      el.setAttribute('aria-label', on ? label.slice(3) : `${verb} ${c.name || info.name}`);
    }
    const scr = r.project(at.x, at.y + (on ? 1 : c.model.center), at.z);
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
    const label = g.seat ? '👋 Get up' : seat.pose === 'lie' ? '🛏️ Lie down' : '🪑 Sit';
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

  // Play, beside an arcade machine next to you: the same button again.
  arcadeButton(g, r) {
    const el = $('ride');
    const t = g.arcadeTarget;
    if (!t || this.modalOpen) {
      el.hidden = true;
      return;
    }
    const touch = this.input.touchMode;
    const label = '🕹️ Play';
    const key = `${label}|${touch}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'Q'));
      el.setAttribute('aria-label', `Play ${ARCADE_GAMES[t.game].name} at this machine`);
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
    const tag = (key, x, y, z, state, build, kind = '') => {
      const scr = r.project(x, y, z);
      if (!scr.visible) return;
      seen.add(key);
      let el = this.advTags.get(key);
      if (!el) {
        el = h('div', { class: `adv-tag ${kind}`.trim() });
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
  // toy weapon in your hand (or a fist).
  attackButton() {
    const g = this.game;
    const me = g.me?.body;
    const el = $('btn-attack');
    const near = Boolean(me) && !g.riding && [...g.monsters.values()].some(({ model: { group: { position: m } } }) => Math.hypot(m.x - me.x, m.y - me.y, m.z - me.z) < ATTACK_SHOW);
    if (el.hidden === near) el.hidden = !near;
    const icon = wornWeapon(this.profile.data.gear)?.icon ?? '👊';
    if (el.textContent !== icon) el.textContent = icon;
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
      const showName = p.id !== g.pid && far < 45;
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
          showName ? h('div', { class: 'name' }, p.look.level ? h('span', { class: 'tag-level', title: `Level ${p.look.level}` }, `⭐${p.look.level}`) : '', p.name, p.id === g.host ? ' 🏝️' : '') : '',
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
    this.rideButton(g, r);
    this.defendButton(g, r);
    this.adventureTags(g, r);
    // The clock: sun, moon and weather.
    const t = g.env.time;
    const w = g.env.weather;
    const sky = isNight(t) ? '🌙' : t < 0.3 ? '🌅' : t > 0.7 ? '🌇' : '☀️';
    const weather = { cloudy: '☁️', rain: '🌧️', rainbow: '🌈', snow: '❄️', sprinkles: '🍬' }[w] ?? '';
    const clock = $('clock');
    if (clock.textContent !== `${sky}${weather}`) clock.replaceChildren(sky, weather ? h('span', { class: 'weather' }, weather) : '');
  }
}
