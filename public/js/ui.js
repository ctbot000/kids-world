// Everything on top of the 3D view: the title screen, the toolbar and
// hotbar, the toy box, talking and emotes, name tags and speech bubbles,
// settings, stickers, help, logging in and full screen. Big buttons, pictures
// first, few words.
import * as B from './shared/blocks.js';
import { CRITTER_INFO, CRITTER_TYPES } from './shared/critters.js';
import { isNight } from './shared/env.js';
import { prettyCode } from './shared/codes.js';
import { STAMPS } from './shared/stamps.js';
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem, USERNAME_MAX, USERNAME_MIN, usernameProblem } from './shared/keeper.js';
import { ANIMALS, CHAT_MAX, cleanChat, cleanIslandName, cleanLook, cleanName, EMOTES, FUR_COLORS, HAIR_COLORS, HAIRS, HATS, ISLAND_NAME_MAX, isValidName, KID, langOf, lookIcon, NAME_MAX, PHRASES, SHIRT_COLORS, SKIN_TONES, STICKERS as STICKER_EMOJI, randomIslandName, randomName } from './shared/words.js';
import { THEMES } from './shared/worldgen.js';
import { blockIcon } from './render/atlas.js';
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

const THEME_ICON = Object.fromEntries(THEMES.map((t) => [t.key, t.icon]));

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

export class UI {
  constructor({ profile, sound, atlas, input }) {
    this.profile = profile;
    this.sound = sound;
    this.atlas = atlas;
    this.input = input;
    this.icons = new Map();
    this.game = null;
    this.tags = new Map();
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
    $('btn-login').onclick = () => (handlers.login.who() ? this.myLoginDialog() : this.loginDialog());
    $('btn-stickers').onclick = () => this.stickersDialog();
    $('btn-help').onclick = () => this.helpDialog();
    $('btn-sound').onclick = () => this.soundDialog();
  }

  hideTitle() {
    $('title').hidden = true;
  }

  renderMe() {
    $('me-name').textContent = `Hi, ${this.profile.name}!`;
  }

  // The 🔑 by your name: there when there is a keeper to log in at, and
  // always while logged in, so a device without one can still log out.
  renderLogin() {
    const login = this.handlers?.login;
    const chip = $('btn-login');
    chip.hidden = !login?.available() && !login?.who();
    chip.textContent = login?.who() ? '🔑 My login' : '🔑 Log in';
    chip.classList.toggle('on', Boolean(login?.who()));
  }

  // The island's name: any typed, or one rolled for its kind (shown grey
  // while the box is empty). While what is typed is no name, the last one stays.
  newIslandDialog() {
    let theme = 'sunny';
    let rolled = randomIslandName(theme);
    let own = '';
    let online = true;
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
      const sw = h('button', { class: 'switch on', type: 'button', 'aria-label': 'Friends can visit', role: 'switch', 'aria-checked': 'true' });
      sw.onclick = () => {
        online = !online;
        sw.classList.toggle('on', online);
        sw.setAttribute('aria-checked', String(online));
        this.sound.play('ui');
      };
      root.append(
        h('h2', {}, '🏝️ Make an island'),
        h('h3', {}, 'What kind of island?'),
        grid,
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
        h(
          'button',
          {
            class: 'big green',
            type: 'button',
            style: 'margin-top:14px',
            onclick: () => {
              this.closeModal();
              this.handlers.make({ theme, name: own || rolled, online });
            },
          },
          '✨ Make it!',
        ),
      );
    });
  }

  visitDialog(prefill = '') {
    this.openModal(
      (root) => {
        const boxes = [];
        const go = () => {
          const code = boxes.map((b) => b.value).join('');
          if (code.length !== 6) {
            this.sound.play('no');
            boxes.find((b) => !b.value)?.focus();
            return;
          }
          this.closeModal();
          this.handlers.visit(code);
        };
        const row = h('div', { class: 'code-input' });
        for (let i = 0; i < 6; i++) {
          const box = h('input', { inputmode: 'numeric', maxlength: 1, pattern: '[0-9]*', autocomplete: 'off', 'aria-label': `Digit ${i + 1}` });
          box.value = prefill[i] ?? '';
          box.addEventListener('input', () => {
            const digits = box.value.replace(/\D/g, '');
            if (digits.length > 1) {
              // Pasted a whole code.
              digits
                .slice(0, 6 - i)
                .split('')
                .forEach((d, k) => (boxes[i + k].value = d));
              boxes[Math.min(5, i + digits.length)].focus();
              return;
            }
            box.value = digits;
            if (digits && i < 5) boxes[i + 1].focus();
          });
          box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
            if (e.key === 'Enter') go();
          });
          boxes.push(box);
          row.append(box);
        }
        root.append(
          h('h2', {}, '✈️ Visit a friend'),
          h('p', {}, 'Type the island code your friend gives you.'),
          row,
          h('button', { class: 'big blue', type: 'button', onclick: go }, '🛶 Let’s go!'),
          h('p', { class: 'muted', style: 'margin-top:12px' }, 'Your friend finds the code at the top of their screen.'),
        );
        setTimeout(() => boxes[prefill.length >= 6 ? 5 : prefill.length]?.focus(), 50);
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
                  // A kid keeps the skin and hair last chosen; an animal comes in its own fur.
                  onclick: () => choose(() => Object.assign(look, a.key === KID ? cleanLook({ ...look, animal: KID }) : { animal: a.key, fur: a.fur })),
                },
                h('span', { class: 'emoji' }, a.key === look.animal ? lookIcon(look) : a.icon),
                a.name,
              ),
            ),
          );
          if (look.animal === KID) {
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

  stickersDialog() {
    const got = this.profile.data.stickers;
    this.openModal((root) => {
      const count = STICKERS.filter((s) => got[s.key]).length;
      root.append(
        h('h2', {}, `⭐ My stickers (${count} of ${STICKERS.length})`),
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
          card('🐰', 'Animals', ['Tap an animal to pet it. Give it fruit and it follows you, and a flying friend sits on your head when you stand still! Use the bunny tool to invite new friends.']),
          card('🐬', 'Sea friends', ['Fish, dolphins, a whale, turtles, crabs and an octopus live in and by the sea, and penguins and seals on snowy islands. Swim out to meet them!']),
          card('🐴', 'Ride', ['Walk up to a pony, a cow, an elephant, a giraffe, a reindeer, a polar bear or a unicorn, and tap Ride (or press ', h('kbd', {}, 'Q'), '). Swim out to a dolphin or the whale and ride them too! Jump to jump, leap, blow water or spray it. ', h('kbd', {}, 'Q'), ' or 👋 gets you off.']),
          card('🍎', 'Treasures', ['Tap fruit, seashells and star pieces to put them in your basket. Plant fruit to grow a tree!']),
          card('💬', 'Talk', ['Type to your friends with the speech bubble (', h('kbd', {}, 'T'), '), or tap a ready-made hello. Dance with the smiley.']),
          card('🗺️', 'Map', ['The little map shows where you are, with a yellow arrow. Tap it to see the whole island.']),
          card('↩️', 'Oops!', ['The undo button (or ', h('kbd', {}, 'Z'), ') takes back what you just did.']),
          card('🔢', 'Quick keys', [h('kbd', {}, '1'), '–', h('kbd', {}, '0'), ' pick blocks, ', h('kbd', {}, 'E'), ' opens the toy box, ', h('kbd', {}, 'T'), ' talks, ', h('kbd', {}, 'P'), ' takes a photo. The middle mouse button copies the block you point at.']),
          card('👀', 'See through your eyes', ['Zoom all the way in to look around as yourself.']),
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
    this.minimap.attach(game);
    this.renderMap();
    $('btn-toybox').onclick = () => this.toyBox();
    $('btn-photo').onclick = () => this.takePhoto();
    $('btn-settings').onclick = () => this.settingsDialog();
    $('btn-help-hud').onclick = () => this.helpDialog();
    $('btn-stickers-hud').onclick = () => this.stickersDialog();
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
    // Never keeping the focus, where Space (to jump) would press it again.
    $('ride').onmousedown = (e) => e.preventDefault();
    $('ride').onclick = () => {
      $('ride').blur();
      this.sound.unlock();
      game.toggleRide();
    };
    const on = (type, fn) => game.addEventListener(type, fn);
    on('players', () => this.renderFriends());
    on('settings', () => this.renderIsland());
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
    document.body.classList.remove('playing');
    for (const el of this.tags.values()) el.remove();
    this.tags.clear();
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
      groups.push(h('div', { class: 'opt-group' }, h('button', { class: 'pill', type: 'button', title: 'Choose an animal', onclick: () => this.toyBox('animals') }, CRITTER_INFO[g.critterType].icon)));
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
    const tabs = [...B.CATEGORIES, { key: 'stamps', name: 'Stamps', icon: '🏠' }, { key: 'animals', name: 'Animals', icon: '🐰' }];
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
        } else if (current === 'animals') {
          grid.replaceChildren(
            ...CRITTER_TYPES.map((type) =>
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
                    this.toast(CRITTER_INFO[type].icon, `Tap the ground to invite ${withArticle(CRITTER_INFO[type].name.toLowerCase())}! Tap an animal to say bye.`);
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

  // Talking: type anything, or tap a phrase or a sticker.
  sayDialog() {
    const g = this.game;
    this.openModal(
      (root) => {
        const box = h('input', { type: 'text', class: 'text-input', maxLength: CHAT_MAX, autocomplete: 'off', enterKeyHint: 'send', placeholder: 'Type something…', 'aria-label': 'Type something to say' });
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
        // With a keyboard, straight to typing; on a touch screen, the phrases first.
        if (!this.input.touchMode) setTimeout(() => box.focus(), 60);
      },
      { seeThrough: true },
    );
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
        root.append(h('p', { class: 'muted', style: 'margin-top:12px' }, `${g.players.size} ${g.players.size === 1 ? 'player' : 'players'} here now.`));
      },
      { narrow: true },
    );
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
          toggle(g.settings.locked, '🔒 No new visitors', 'Friends already here can stay.', (on) => g.send({ t: 'host', cmd: 'settings', settings: { locked: on } })),
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
      el.textContent = c ? `${info.icon} ${c.name || info.name}${g.tool === 'friends' ? ' — tap to say bye' : ' — tap to pet'}` : '';
      el.hidden = !c;
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
    const el = $('ride');
    const c = g.critters.get(g.riding?.id ?? g.rideTarget);
    const at = g.riding ? g.players.get(g.pid)?.avatar?.root.position : c?.model.group.position;
    if (!c || !at || this.modalOpen) {
      el.hidden = true;
      return;
    }
    const info = CRITTER_INFO[c.type];
    const touch = this.input.touchMode;
    const label = g.riding ? '👋 Get off' : `${info.icon} Ride`;
    const key = `${label}|${touch}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(label, touch ? '' : h('kbd', {}, 'Q'));
      el.setAttribute('aria-label', g.riding ? 'Get off' : `Ride ${c.name || info.name}`);
    }
    const scr = r.project(at.x, at.y + (g.riding ? 1 : c.model.center), at.z);
    if (!scr.visible && !g.riding) {
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

  // Name tags and speech bubbles follow everyone around; the maps keep up.
  frame(dt) {
    const g = this.game;
    if (!g?.world) return;
    this.minimap.frame(dt);
    const r = g.renderer;
    const seen = new Set();
    const me = g.me?.body;
    for (const p of g.players.values()) {
      if (!p.avatar) continue;
      const pos = p.avatar.root.position;
      const far = me ? Math.hypot(pos.x - me.x, pos.z - me.z) : 0;
      const showName = p.id !== g.pid && far < 45;
      if (!showName && !p.bubble) continue;
      const scr = r.project(pos.x, pos.y + 1.72, pos.z);
      if (!scr.visible) continue;
      seen.add(p.id);
      let tag = this.tags.get(p.id);
      if (!tag) {
        tag = h('div', { class: 'tag' });
        this.tags.set(p.id, tag);
        $('overlays').append(tag);
      }
      const key = `${p.name}|${p.bubble?.text ?? ''}|${showName}|${p.id === g.host}`;
      if (tag.dataset.key !== key) {
        tag.dataset.key = key;
        tag.style.setProperty('--c', shirtColor(p.look.shirt));
        tag.replaceChildren(
          p.bubble ? h('div', { class: `bubble${p.bubble.sticker ? ' sticker' : ''}`, lang: langOf(p.bubble.text) || undefined }, p.bubble.text) : '',
          showName ? h('div', { class: 'name' }, p.name, p.id === g.host ? ' 🏝️' : '') : '',
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
    // The clock: sun, moon and weather.
    const t = g.env.time;
    const w = g.env.weather;
    const sky = isNight(t) ? '🌙' : t < 0.3 ? '🌅' : t > 0.7 ? '🌇' : '☀️';
    const weather = { cloudy: '☁️', rain: '🌧️', rainbow: '🌈', snow: '❄️', sprinkles: '🍬' }[w] ?? '';
    const clock = $('clock');
    if (clock.textContent !== `${sky}${weather}`) clock.replaceChildren(sky, weather ? h('span', { class: 'weather' }, weather) : '');
  }
}
