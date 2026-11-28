// What there is to see and do of soul weapons (shared/souls.js), opened from ui.js:
// the Soul Forge — each weapon's parts, putting it together, facing its soul, and
// combining those that are yours — and the great shows over the whole screen
// (render/soul-shows.js) as a part is found, a weapon put together, its soul beaten
// and two weapons made one; and the words of a duel with a soul (nod/duel.js).
//
// The shows are drawn in 3D, loaded the first time one is wanted. Without WebGL they
// are told in words and pictures alone, and nothing else is any different.
import { h } from './ui.js';
import { episodeOf } from './shared/isle-story.js';
import {
  canForge,
  fusionOf,
  isMade,
  MELT_COINS,
  ownsSoul,
  partsFound,
  partsOf,
  SOUL_KEY,
  soulName,
  soulOf,
  SOULS,
  soulsIn,
  soulWeapon,
  spareOf,
  wantsParts,
  whereFound,
} from './shared/souls.js';
import { wornWeapon } from './shared/shop.js';

const specOf = (id) => soulWeapon(`${SOUL_KEY}${id}`);
const heldWith = (souls, key) => souls.held.find((id) => soulsIn(id).includes(key)) ?? '';
const gently = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// The stage and what is played on it, loaded once; null where it cannot be had.
let staging = null;
const loadStage = () => (staging ??= Promise.all([import('./render/soul-stage.js'), import('./render/soul-shows.js')]).then(([a, b]) => ({ ...a, ...b })).catch(() => null));
// Ready for a show about to come (a chest opened with a part in it).
export const soulStageSoon = () => void loadStage();

// ---------------------------------------------------------------- the screen

// Over everything: a show, what is written over it, and the buttons to go on from
// it. Nothing else is drawn, or can be tapped, till it is closed.
class SoulScreen {
  constructor(ui, label) {
    this.ui = ui;
    this.closed = false;
    this.stage = null;
    this.show = null;
    this.canvas = h('canvas', { 'aria-hidden': 'true' });
    this.flat = h('div', { class: 'ss-flat', 'aria-hidden': 'true' });
    this.words = h('div', { class: 'ss-words', 'aria-live': 'polite' });
    this.buttons = h('div', { class: 'ss-buttons' });
    this.skipper = h('button', { class: 'ss-skip', type: 'button', onclick: () => this.skip() }, 'Skip ▶▶');
    this.el = h('div', { class: 'soul-show', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, this.canvas, this.flat, h('div', { class: 'ss-foot' }, this.words, this.buttons), this.skipper);
    this.el.addEventListener('pointerdown', (e) => {
      ui.sound.unlock();
      if (e.target === this.canvas || e.target === this.el) this.tapped = performance.now();
    });
    // (A tap on it goes straight to where it holds, once it has had a moment.)
    this.el.addEventListener('click', (e) => {
      if ((e.target === this.canvas || e.target === this.el) && performance.now() - this.began > 900) this.skip();
    });
    this.onKey = (e) => {
      const ask = this.buttons.lastElementChild;
      if (!['Enter', ' ', 'Escape'].includes(e.key) || (ask && e.key !== 'Escape')) return;
      e.preventDefault();
      e.stopPropagation();
      // (Escape: the last of the buttons, which goes no further.)
      if (ask) ask.click();
      else this.skip();
    };
    window.addEventListener('keydown', this.onKey, true);
    document.body.append(this.el);
    requestAnimationFrame(() => this.el.classList.add('on'));
    this.began = performance.now();
    // What was won only just now, by what is to be shown (a sticker, a level), is
    // told of over it as it comes to its end: nobody would see it under this.
    this.told = false;
    this.later = [];
    for (const el of document.querySelectorAll('#toasts .sticker')) {
      if (!el.told || this.began - el.told.at > 900) continue;
      this.later.push(el.told.what);
      el.remove();
    }
    ui.input.enabled = false;
    ui.input.releaseAll();
    if (ui.game) ui.game.uiBlocking = true;
    ui.soulScreen = this;
  }

  // Plays make(S, stage, opts) on it; said(what): what is written as it comes to
  // each part of it; last: what there is to say without any show at all.
  async play({ make, said, last, flat = '' }) {
    this.said = said;
    const S = await loadStage();
    if (this.closed) return;
    try {
      if (!S) throw new Error('no stage');
      this.stage = new S.SoulStage(this.canvas);
      this.stage.gentle = gently();
      this.show = make(S, this.stage, {
        say: (what) => !this.closed && this.said(what, this),
        sound: (name, opts) => !this.closed && this.ui.sound.play(name, opts),
      });
      // (What is behind it need not be drawn meanwhile.)
      this.behind = this.ui.game?.renderer ?? null;
      if (this.behind) this.behind.drawing = false;
      if (this.skipSoon) this.skip();
    } catch {
      this.stage?.dispose();
      this.stage = null;
      this.canvas.remove();
      this.el.classList.add('flat');
      this.flat.append(h('div', { class: 'rays' }), h('span', { class: 'emoji' }, flat));
      this.ui.sound.play('fanfare');
      this.said(last, this);
    }
  }

  skip() {
    if (!this.show) this.skipSoon = true;
    else if (!this.show.held) this.show.skip();
  }

  // What is written over it: each line new as it comes.
  write({ kicker = '', icon = '', title = '', sub = '', more = null, buttons = [] }) {
    this.words.replaceChildren(...[kicker ? h('p', { class: 'ss-kicker' }, kicker) : null, title ? h('h2', { class: 'ss-title' }, icon ? h('span', { class: 'ss-icon' }, icon) : '', icon ? ' ' : '', title) : null, sub ? h('p', { class: 'ss-sub' }, sub) : null, more].filter(Boolean));
    this.buttons.replaceChildren(
      ...buttons.map(([text, go, look = 'green']) =>
        h('button', { class: `big ${look}`, type: 'button', onclick: () => { this.ui.sound.play('ui'); this.close(go); } }, text),
      ),
    );
    this.skipper.hidden = buttons.length > 0;
    if (!buttons.length) return;
    this.buttons.firstElementChild.focus({ preventScroll: true });
    this.told = true;
    document.body.classList.add('soul-told');
    for (const what of this.later.splice(0)) this.ui.toast(...what);
  }

  close(then = null) {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('keydown', this.onKey, true);
    this.stage?.dispose();
    this.el.remove();
    document.body.classList.remove('soul-told');
    const { ui } = this;
    ui.soulScreen = null;
    if (this.behind) this.behind.drawing = true;
    if (ui.game) ui.game.uiBlocking = ui.modalOpen;
    ui.input.enabled = Boolean(ui.game) && !ui.modalOpen;
    then?.();
    nextScreen(ui);
    for (const what of this.later) ui.toast(...what);
  }
}

// One after another, if one comes while another is up (and never over the game
// itself being left).
const waiting = new WeakMap();
function screen(ui, label, opts) {
  const list = waiting.get(ui) ?? [];
  waiting.set(ui, list);
  list.push({ label, opts, game: ui.game });
  nextScreen(ui);
}

function nextScreen(ui) {
  if (ui.soulScreen) return;
  const list = waiting.get(ui) ?? [];
  let next = list.shift();
  while (next && next.game && next.game !== ui.game) next = list.shift();
  if (next) new SoulScreen(ui, next.label).play(next.opts);
}

// A row of a weapon's parts, those found lit.
function dots(w, counts, at = -1) {
  return h('div', { class: 'ss-dots', role: 'img', 'aria-label': `${counts.filter(Boolean).length} of ${w.parts.length} parts` }, ...w.parts.map((p, i) => h('span', { class: `${counts[i] ? 'on' : ''}${i === at ? ' new' : ''}` }, p.icon)));
}

// ---------------------------------------------------------------- what is shown

// A part out of a chest (game.js 'soul-part').
export function soulPartShow(ui, got) {
  const w = soulOf(got?.key);
  const part = w?.parts[got.i];
  if (!part) return;
  const { souls } = ui.isle.data.gear;
  const ready = got.fresh && canForge(souls, w.key);
  const counts = partsOf(souls, w.key);
  const duel = Boolean(ui.game?.adventure?.duel);
  screen(ui, `A part of ${w.name}`, {
    flat: part.icon,
    last: 'part',
    make: (S, stage, o) => new S.PartShow(stage, got, o),
    said: (what, s) => {
      if (what !== 'part') return;
      s.write({
        kicker: got.fresh ? `✨ A part of ${w.icon} ${w.name}, ${w.title}!` : `A part of ${w.icon} ${w.name} you have already`,
        icon: part.icon,
        title: part.name,
        sub: ready
          ? `That is every part of it! Put ${w.name} together at the Soul Forge.`
          : got.fresh
            ? `${got.found} of ${w.parts.length} parts found.`
            : got.spare
              ? `${w.name} is put together, so this one is to spare: melt it at the ⚒️ Soul Forge for 🪙 ${MELT_COINS}.`
              : `You have ${got.have} of it now. Melt one to spare at the ⚒️ Soul Forge for 🪙 ${MELT_COINS}.`,
        more: wantsParts(souls, w.key) ? dots(w, counts, got.i) : null,
        buttons: [
          ...(ready && !duel ? [['⚒️ To the Soul Forge!', () => soulForge(ui, w.key), 'yellow']] : []),
          [ready ? 'Later' : '👍 OK', null, ready ? 'blue' : 'green'],
        ],
      });
    },
  });
}

// Put together, and its soul waking.
function forgeShow(ui, key) {
  const w = soulOf(key);
  screen(ui, `${w.name} is put together`, {
    flat: w.icon,
    last: 'awake',
    make: (S, stage, o) => new S.ForgeShow(stage, key, o),
    said: (what, s) => {
      if (what === 'forging') s.write({ kicker: '⚒️ The Soul Forge' });
      else if (what === 'forged') s.write({ kicker: 'Put together!', icon: w.icon, title: w.name, sub: w.title });
      else if (what === 'awake') {
        s.write({
          kicker: `The soul of ${w.name} is awake!`,
          title: soulName(w),
          sub: `${w.name} is nobody’s till its soul is beaten. Beat ${w.soul.name}, on your own, and it is yours!`,
          buttons: [
            [`⚔️ Face ${w.soul.name}!`, () => face(ui, key), 'yellow'],
            ['Later', () => soulForge(ui, key), 'blue'],
          ],
        });
      }
    },
  });
}

// Its soul beaten, and the weapon yours.
function wonShow(ui, key, then) {
  const w = soulOf(key);
  const spec = specOf(key);
  screen(ui, `${w.name} is yours`, {
    flat: w.icon,
    last: 'won',
    make: (S, stage, o) => new S.WonShow(stage, key, spec, o),
    said: (what, s) => {
      if (what === 'beaten') s.write({ kicker: `${soulName(w)}, is beaten!`, title: `“${w.soul.yields}”` });
      else if (what === 'won') {
        s.write({
          kicker: `✨ ${w.name} is yours!`,
          icon: w.icon,
          title: `${w.name}, ${w.title}`,
          sub: `${w.does} It never wears out.`,
          buttons: [['🎉 Hooray!', then, 'yellow']],
        });
      }
    },
  });
}

// Two of yours made one.
function fuseShow(ui, a, b, c) {
  screen(ui, `${a.name} and ${b.name} combined`, {
    flat: c.icon,
    last: 'fused',
    make: (S, stage, o) => new S.FuseShow(stage, a, b, c, o),
    said: (what, s) => {
      if (what === 'fusing') s.write({ kicker: `${a.icon} ${a.name} and ${b.icon} ${b.name}…` });
      else if (what === 'fused') {
        const all = c.souls.length === SOULS.length;
        s.write({
          kicker: all ? '🌟 All seven souls in one!' : `Combined: ${c.souls.length} souls in one!`,
          icon: c.icon,
          title: c.name,
          sub: all ? 'There is nothing mightier in all the isle.' : `${c.title[0].toUpperCase()}${c.title.slice(1)}.`,
          more: h('p', { class: 'ss-power' }, `⚔️ ${a.power} and ${b.power} → `, h('b', {}, String(c.power))),
          buttons: [['🎉 Hooray!', () => soulForge(ui), 'yellow']],
        });
      }
    },
  });
}

// One taken apart again.
function splitShow(ui, spec, specs) {
  screen(ui, `${spec.name} taken apart`, {
    flat: '✂️',
    last: 'split',
    make: (S, stage, o) => new S.SplitShow(stage, spec, specs, o),
    said: (what, s) => {
      if (what === 'split') s.write({ kicker: `${spec.name}, taken apart again:`, title: specs.map((w) => w.name).join(' · '), buttons: [['👍 OK', () => soulForge(ui), 'green']] });
    },
  });
}

// Off to face a weapon's soul (main.js soulDuel).
function face(ui, key) {
  if (ui.modalOpen) ui.closeModal();
  (ui.game ? ui.gameHandlers : ui.handlers)?.soulDuel?.(key);
}

// Friends on the island hear of it.
const tell = (ui, msg) => ui.game?.shared && ui.game.send({ t: 'soul', ...msg });

// ---------------------------------------------------------------- the Soul Forge

// Whether there is anything for someone at the forge now: a weapon to put together,
// or a soul to face.
export const forgeCalls = (souls, list = SOULS) => list.some((w) => canForge(souls, w.key) || isMade(souls, w.key));

// The button to it, for the head of another window (ui.js backpack and shop).
export function forgeChip(ui) {
  if (ui.profile !== ui.isle || ui.game?.adventure?.duel) return null;
  const calls = forgeCalls(ui.isle.data.gear.souls);
  return h('button', { class: `chip forge-chip${calls ? ' calls' : ''}`, type: 'button', onclick: () => soulForge(ui) }, '⚒️ Soul Forge');
}

let lastSeen = '';
export function soulForge(ui, key = '') {
  const p = ui.isle;
  const souls = () => p.data.gear.souls;
  const here = ui.game?.soulHere?.()?.w.key ?? '';
  // Opened on the one asked for; or one with something to be done; or this episode's,
  // or the one last looked at.
  const calling = SOULS.find((w) => forgeCalls(souls(), [w]))?.key;
  let on = soulOf(key)?.key ?? (calling || here || soulOf(lastSeen)?.key || SOULS.find((w) => partsFound(souls(), w.key))?.key || SOULS[0].key);
  // The two picked to be combined, in the order picked.
  let picks = [];
  let S = null;
  let stage = null;
  let closed = false;
  let shown = '';
  let redraw = null;
  ui.openModal(
    (root) => {
      const coins = h('span', { class: 'coins', 'aria-label': 'Your coins' });
      const tabs = h('div', { class: 'tabs forge-tabs', role: 'tablist' });
      const canvas = h('canvas', { class: 'forge-canvas', 'aria-hidden': 'true' });
      const view = h('div', { class: 'forge-view' }, canvas, h('span', { class: 'forge-emoji emoji' }));
      const about = h('div', { class: 'forge-about' });
      const parts = h('div', { class: 'forge-parts' });
      const act = h('div', { class: 'forge-act' });
      const own = h('div', { class: 'forge-own' });
      const button = (text, go, look = 'green', disabled = false) => h('button', { class: `big ${look}`, type: 'button', disabled, onclick: go }, text);
      const chip = (text, go, disabled = false) => h('button', { class: 'chip', type: 'button', disabled, onclick: go }, text);
      const say = (icon, text) => ui.toast(icon, text);

      const drawTabs = () => {
        tabs.replaceChildren(
          ...SOULS.map((w) => {
            const s = souls();
            const mine = ownsSoul(s, w.key);
            const made = isMade(s, w.key);
            const n = partsFound(s, w.key);
            return h(
              'button',
              {
                class: `chip forge-tab${w.key === on ? ' on' : ''}${mine ? ' mine' : ''}${made || canForge(s, w.key) ? ' calls' : ''}`,
                type: 'button',
                role: 'tab',
                'aria-selected': String(w.key === on),
                'data-soul': w.key,
                style: `--soul: ${w.color}; --glow: ${w.glow}`,
                onclick: () => {
                  on = w.key;
                  ui.sound.play('ui');
                  draw();
                },
              },
              h('span', { class: 'emoji' }, w.icon),
              h('b', {}, w.name),
              h('span', { class: 'muted' }, mine ? 'Yours ✓' : made ? 'Awake!' : `${n}/${w.parts.length}`),
            );
          }),
        );
      };

      // The weapon in the middle: what there is of it, and the rest in thin light.
      const drawStage = () => {
        const w = soulOf(on);
        view.querySelector('.forge-emoji').textContent = stage ? '' : w.icon;
        view.style.setProperty('--soul', w.color);
        view.style.setProperty('--glow', w.glow);
        if (!stage) return;
        const s = souls();
        const held = heldWith(s, on);
        const whole = held || isMade(s, on);
        const have = partsOf(s, on).map((n) => n > 0);
        const look = `${on}|${whole ? (held || 'made') : have.map(Number).join('')}`;
        if (look === shown) return;
        shown = look;
        stage.clear();
        // (Its own form, even when it is in another now.)
        new S.PlanShow(stage, on, have, whole ? specOf(held && soulsIn(held)[0] === on ? held : on) : null);
      };

      const drawWeapon = () => {
        const w = soulOf(on);
        const s = souls();
        const ep = episodeOf(w.episode);
        const held = heldWith(s, on);
        const made = isMade(s, on);
        const ready = canForge(s, on);
        const n = partsFound(s, on);
        const spec = specOf(on);
        about.replaceChildren(
          h('p', { class: 'forge-kicker' }, `${ep.icon} Episode ${ep.n} · ${ep.title}`),
          h('h3', {}, `${w.icon} ${w.name}`, h('span', { class: 'muted' }, ` ${w.title}`)),
          h('p', {}, w.does),
          h('p', { class: 'muted' }, `⚔️ Takes ${spec.power} hearts a blow (bosses ×${spec.king}), and never wears out. No shop sells it.`),
        );
        const pics = S?.partPictures?.(on, partsOf(s, on).map((c) => c > 0)) ?? [];
        parts.replaceChildren(
          ...w.parts.map((part, i) => {
            const c = partsOf(s, on)[i];
            const spare = spareOf(s, on, i);
            return h(
              'div',
              { class: `forge-part${c || held || made ? '' : ' missing'}`, 'data-part': String(i) },
              pics[i] ? h('img', { src: pics[i], alt: '', draggable: false }) : h('span', { class: 'emoji' }, part.icon),
              h('b', {}, part.name),
              c > 1 || (c && !wantsParts(s, on)) ? h('span', { class: 'count' }, `×${c}`) : null,
              spare
                ? chip(`🔥 Melt 🪙 ${MELT_COINS}`, () => {
                    if (!p.meltPart(on, i)) return;
                    ui.sound.play('soul-melt');
                    say('🪙', `Melted a ${part.name} down for ${MELT_COINS} coins.`);
                  })
                : null,
            );
          }),
        );
        if (made) {
          act.replaceChildren(
            h('p', {}, `⚡ ${w.name} is put together, and ${soulName(w)}, is awake in it. Beat ${w.soul.name}, on your own, and it is yours. Out of HP you only lose this try: face it again as often as you like.`),
            button(`⚔️ Face ${w.soul.name}!`, () => face(ui, on), 'yellow'),
          );
        } else if (held) {
          const alone = soulsIn(held).length === 1;
          const inHand = wornWeapon(p.data.gear)?.id === held;
          act.replaceChildren(
            h('p', {}, alone ? `${w.name} is yours!` : `${w.name} is yours, and in ${specOf(held).name} now.`),
            inHand
              ? button('🙌 Put it away', () => { p.wear('weapon', false); ui.sound.play('ui'); }, 'blue')
              : button(`✋ Hold ${specOf(held).name}`, () => { p.pickSoul(held); ui.sound.play('soul-swing', { souls: soulsIn(held) }); }, 'green'),
          );
        } else if (ready) {
          act.replaceChildren(
            h('p', {}, `Every part of ${w.name} is here!`),
            button(
              '⚒️ Put it together!',
              () => {
                if (!p.forgeSoul(on)) return;
                tell(ui, { op: 'forged', w: on });
                ui.closeModal();
                forgeShow(ui, on);
              },
              'yellow',
            ),
          );
        } else {
          const waits = ui.game?.soulHere?.();
          act.replaceChildren(
            ...[
              h('p', {}, n ? `${n} of its ${w.parts.length} parts found. ` : '', `Its parts lie ${whereFound(w)}. You never know which you will find — one you have already, maybe!`),
              waits?.w.key === on ? h('p', { class: 'forge-hint' }, waits.waits ? '👑 There is a part for you on this very island, in its golden chest.' : '✓ You have found the part this island had for you: go on to the next!') : null,
            ].filter(Boolean),
          );
        }
      };

      // Those that are yours, to hold, combine and take apart.
      const drawOwn = () => {
        const s = souls();
        picks = picks.filter((id) => s.held.includes(id));
        if (!s.held.length) {
          own.replaceChildren();
          return;
        }
        const inHand = wornWeapon(p.data.gear)?.id ?? '';
        const pick = (id) => {
          picks = picks.includes(id) ? picks.filter((q) => q !== id) : [...picks, id].slice(-2);
          ui.sound.play('ui');
          drawOwn();
        };
        const card = (id) => {
          const spec = specOf(id);
          const at = picks.indexOf(id);
          const pic = S?.weaponPicture?.(spec);
          return h(
            'div',
            { class: `forge-weapon${at >= 0 ? ' on' : ''}`, 'data-id': id, style: `--soul: ${soulOf(soulsIn(id)[0]).color}` },
            pic ? h('img', { src: pic, alt: '', draggable: false }) : h('span', { class: 'emoji' }, spec.icon),
            h('b', {}, `${spec.name}${id === inHand ? ' ✅' : ''}`),
            h('span', { class: 'muted' }, `⚔️ ${spec.power} · ${soulsIn(id).map((k) => soulOf(k).icon).join('')}`),
            h(
              'div',
              { class: 'shop-buttons' },
              id === inHand ? chip('🙌 Put away', () => { p.wear('weapon', false); ui.sound.play('ui'); }) : chip('✋ Hold it', () => { p.pickSoul(id); ui.sound.play('ui'); }),
              s.held.length > 1 ? chip(at < 0 ? '➕ Combine' : `${at + 1}️⃣ Picked`, () => pick(id)) : null,
              soulsIn(id).length > 1
                ? chip('✂️ Take apart', () => {
                    const specs = p.splitSoul(id)?.map(specOf);
                    if (!specs) return;
                    ui.closeModal();
                    splitShow(ui, spec, specs);
                  })
                : null,
            ),
          );
        };
        const [a, b] = picks;
        const id = a && b ? fusionOf(s, a, b) : '';
        const made = id ? specOf(id) : null;
        const pic = made ? S?.weaponPicture?.(made) : null;
        own.replaceChildren(
          ...[
            h('h3', {}, '💫 Your soul weapons'),
            h('p', { class: 'muted' }, s.held.length > 1 ? 'Combine two into one of both their souls, mightier than either: it keeps the form of the first you pick, and strikes with every soul in it. Nothing is lost by it — take it apart again any time.' : 'Win another, and the two can be combined into one mightier than either.'),
            h('div', { class: 'grid forge-weapons' }, ...s.held.map(card)),
            made
              ? h(
                  'div',
                  { class: 'forge-fusion' },
                  pic ? h('img', { src: pic, alt: '', draggable: false }) : h('span', { class: 'emoji' }, made.icon),
                  h('div', {}, h('b', {}, `${specOf(a).name} + ${specOf(b).name} = ${made.name}`), h('p', { class: 'muted' }, made.does), h('p', {}, `⚔️ ${specOf(a).power} and ${specOf(b).power} → `, h('b', {}, String(made.power)))),
                  h(
                    'div',
                    { class: 'row' },
                    chip('⇄ The other way round', () => { picks = [b, a]; ui.sound.play('ui'); drawOwn(); }),
                    button(
                      '💫 Combine them!',
                      () => {
                        const spec = p.fuseSouls(a, b);
                        if (!spec) return;
                        tell(ui, { op: 'fused', key: spec.key });
                        ui.closeModal();
                        fuseShow(ui, specOf(a), specOf(b), spec);
                      },
                      'yellow',
                    ),
                  ),
                )
              : null,
          ].filter(Boolean),
        );
      };

      const draw = () => {
        lastSeen = on;
        coins.textContent = `🪙 ${p.data.coins.toLocaleString()}`;
        drawTabs();
        drawStage();
        drawWeapon();
        drawOwn();
      };
      redraw = draw;
      root.append(
        h('div', { class: 'dialog-head' }, h('h2', {}, '⚒️ Soul Forge'), coins, ui.profile === p ? h('button', { class: 'chip', type: 'button', onclick: () => ui.backpackDialog() }, '🎒 Backpack') : ''),
        h('p', { class: 'muted' }, 'Seven weapons no shop sells, one for each episode of Adventure Isle, each in pieces and with a soul of its own. Find every part, put it together, beat its soul — and combine those you win.'),
        tabs,
        h('div', { class: 'forge' }, view, h('div', { class: 'forge-side' }, about, act)),
        parts,
        own,
      );
      draw();
      p.addEventListener('basket', redraw);
      loadStage().then((got) => {
        if (closed || !got) return;
        S = got;
        try {
          stage = new S.SoulStage(canvas, { calm: true });
          stage.gentle = gently();
        } catch {
          stage = null;
          canvas.remove();
        }
        draw();
      });
    },
    {
      onClose: () => {
        closed = true;
        p.removeEventListener('basket', redraw);
        stage?.dispose();
        stage = null;
      },
    },
  );
}

// ---------------------------------------------------------------- elsewhere

// What the island card says of them on the isle (ui.js): this episode's weapon, how
// many of its parts there are, and whether one is here.
export function soulLines(ui, g) {
  const here = g.soulHere?.();
  if (!here) return [];
  const { w } = here;
  const { souls } = ui.isle.data.gear;
  const held = heldWith(souls, w.key);
  const status = held ? 'yours ✓' : isMade(souls, w.key) ? `beat ${w.soul.name}!` : canForge(souls, w.key) ? 'put it together!' : `${partsFound(souls, w.key)} of ${w.parts.length} parts`;
  return [
    h(
      'div',
      { class: 'soul-lines' },
      h('div', { class: `camp${held ? ' free' : ''}` }, w.icon, ` ${w.name}, ${w.title}`, h('span', { class: 'muted' }, status)),
      wantsParts(souls, w.key) ? h('div', { class: 'camp' }, '👑', ' A part in the golden chest', h('span', { class: 'muted' }, here.waits ? 'waiting here' : 'found ✓')) : '',
    ),
    h('div', { class: 'row', style: 'justify-content:center' }, forgeChip(ui) ?? ''),
  ];
}

// What a golden chest has for you, in its window (ui.js chestDialog).
export function soulChestLine(ui, g) {
  const here = g.soulHere?.();
  if (!here || !wantsParts(ui.isle.data.gear.souls, here.w.key)) return '';
  const { w } = here;
  return h('p', { class: 'soul-chest' }, here.waits ? `${w.icon} And in it there is a part of ${w.name}, ${w.title} — a soul weapon no shop sells!` : `${w.icon} You have found the part of ${w.name} there was for you on this island. The next island has another!`);
}

// Your soul weapons in the backpack (ui.js): card and tap are its own.
export function soulCards(ui, card, tap) {
  const p = ui.profile;
  const { souls } = p.data.gear;
  const held = wornWeapon(p.data.gear);
  return souls.held.map((id) => {
    const spec = specOf(id);
    const on = held?.id === id;
    return card(ui.gearPic('weapon', spec.key, spec.icon), spec.name, `✨ ${spec.does} Never wears out.`, on, on ? tap('🙌 Put away', () => p.wear('weapon', false)) : tap('✋ Hold it', () => p.pickSoul(id)));
  });
}

// ---------------------------------------------------------------- a duel

// Big words across the screen for a while, in a soul's own colours.
function banner(ui, w, kicker, title, ms = 3400, quote = false) {
  ui.soulBanner?.remove();
  const el = h('div', { class: `soul-banner${quote ? ' quote' : ''}`, 'aria-live': 'polite', style: `--soul: ${w.color}; --glow: ${w.glow}` }, kicker ? h('span', { class: 'sb-kicker' }, kicker) : '', h('span', { class: 'sb-title' }, title));
  ui.soulBanner = el;
  document.body.append(el);
  setTimeout(() => el.classList.add('going'), ms);
  setTimeout(() => el.remove(), ms + 600);
}

// Arriving: who it is.
export function soulDuelIntro(ui) {
  const w = soulOf(ui.game?.adventure?.duel);
  if (!w) return;
  // (Room for what is told of it, over its name.)
  for (const el of document.querySelectorAll('#toasts .sticker')) el.remove();
  banner(ui, w, `⚔️ The soul of ${w.name}`, soulName(w), 3000);
}

// What it says as it is fought (nod/fight.js 'soul-says').
export function soulSays(ui, { w: key, i, text }) {
  const w = soulOf(key);
  if (!w || !text) return;
  // (The first of them once the name of it is gone.)
  const game = ui.game;
  setTimeout(() => ui.game === game && !game.adventure?.won && banner(ui, w, `${w.icon} ${w.soul.name}`, `“${text}”`, 2600, true), i ? 150 : 1300);
}

// Over: the weapon yours, or not this time (game.js, nod/fight.js 'duel').
export function soulDuelOver(ui, { won }) {
  const game = ui.game;
  const w = soulOf(game?.adventure?.duel);
  if (!w) return;
  const go = () => ui.gameHandlers?.leaveDuel?.();
  if (won) {
    const fresh = ui.isle.beatSoul(w.key);
    ui.duelWon = fresh ? w.key : '';
    setTimeout(() => {
      if (ui.game !== game) return;
      if (ui.modalOpen) ui.closeModal();
      wonShow(ui, w.key, go);
    }, 2600);
    return;
  }
  setTimeout(() => {
    if (ui.game !== game) return;
    ui.openModal(
      (root) => {
        root.append(
          h('div', { class: 'chest-pic', 'aria-hidden': 'true' }, w.icon),
          h('h2', {}, `${w.soul.name} was too much this time`),
          h('p', {}, 'You are out of HP. But nothing is lost: the weapon waits for you, and so does its soul.'),
          h('p', { class: 'muted' }, game.adventure.story.nightmares[0].hint),
          h('button', { class: 'big yellow', type: 'button', onclick: () => { ui.closeModal(); ui.gameHandlers?.soulDuel?.(w.key); } }, `⚔️ Face ${w.soul.name} again`),
          h('button', { class: 'big blue', type: 'button', onclick: () => { ui.closeModal(); go(); } }, '🚪 Not now'),
        );
      },
      { narrow: true },
    );
  }, 2200);
}

// The island card in a duel (ui.js dreamCard).
export function duelCard(ui, g) {
  const w = soulOf(g.adventure.duel);
  const [b] = [...g.nod.fight.frights.values()].filter((f) => f.spec.boss);
  return [
    h('h3', {}, g.adventure.won ? `🏆 ${w.name} is yours!` : `⚔️ ${soulName(w)}`),
    h('div', { class: 'adventure-list' }, h('div', { class: 'camp castle' }, w.icon, ` The soul of ${w.name}`, h('span', { class: 'muted' }, b ? `${b.hearts} of ${b.max} hearts` : g.adventure.won ? 'beaten' : 'coming…'))),
    h('p', { class: 'muted' }, g.adventure.story.nightmares[0].hint),
    h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'chip', type: 'button', onclick: () => { ui.closeModal(); ui.gameHandlers?.leaveDuel?.(); } }, '🚪 Give up this try')),
  ];
}
