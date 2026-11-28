// A boss saying something out loud on Adventure Isle (shared/boss-lines.js):
// before a battle with it starts, after it ends, and (an episode's last boss)
// as it puffs itself up for a second go.
//
// A line waits for its boss to be seen: its first words until the boss is on
// your screen, near enough and out of the clouds; its last until you are near
// where it ended (let go if you are not, soon after). Then the boss says it
// where anyone looking sees it say it: in a speech bubble over its head (ui.js
// bossBubble, from speaking()), bobbing with its words (talkLevel, read where
// it is drawn), its voice from public/audio/voices through the game's sound
// (sound.js say), the music quieter under it. Every page does the same as its
// player sees the boss, so whoever is looking at it sees it talk. Each line is
// said once a game's stage, and one at a time.
import { BOSS_LINES, voiceUrl } from './shared/boss-lines.js';

// How far off a boss is seen to say its first words (blocks), how near where
// its battle ended you have to be to hear its last, and how long a line about
// what just happened waits for that before it is let go.
const SEE = 42;
const NEAR = 50;
const MOMENT_MS = 6000;
// How long a boss has to stay in view before it starts talking (a glimpse of
// it while you turn round is not enough).
const LOOK_MS = 350;
// How long words take to say, when there is no sound to tell.
const sayingTime = (text) => Math.min(5, 1.2 + text.split(/\s+/).length / 2.6);

function voices(g) {
  const adv = g.adventure;
  const stage = `${g.code ?? ''}|${adv?.run ?? 0}|${adv?.journey ?? 0}|${adv?.stage ?? 0}`;
  if (g.bossVoice?.stage !== stage) g.bossVoice = { stage, said: new Set(), waiting: [], last: new Map(), now: null, trackAt: 0 };
  return g.bossVoice;
}

// `who` (a key of BOSS_LINES) is to say its line for `when` ('before', 'again'
// or 'after') as soon as it can be seen to; `where` tells apart battles a stage
// has more than one of (a Toon Isle battle's id); at: where it is, when that
// is known better than the game can find it (where it went pop).
export function bossSays(g, who, when, where = '', { at = null } = {}) {
  const line = BOSS_LINES[who];
  const text = line?.[when];
  if (!text) return false;
  const v = voices(g);
  const key = `${where}|${who}|${when}`;
  if (v.said.has(key)) return false;
  v.said.add(key);
  // (A battle over, its first words are no longer worth saying.)
  if (when === 'after') v.waiting = v.waiting.filter((w) => w.who !== who);
  v.waiting.push({ who, when, where, text, line, at, since: performance.now() });
  return true;
}

// Each frame: where the bosses with something to say are, whether one can now
// say it, and how the line being said is going.
export function bossVoiceFrame(g, now) {
  const v = voices(g);
  if (now >= v.trackAt) {
    v.trackAt = now + 200;
    for (const who of new Set([...v.waiting.map((w) => w.who), ...[...v.said].map((k) => k.split('|')[1])])) {
      const p = locate(g, who);
      if (p) v.last.set(who, p);
    }
  }
  if (v.now) {
    v.now.p = locate(g, v.now.who) ?? v.now.p;
    if (now < v.now.until) return;
    v.now = null;
  }
  v.waiting = v.waiting.filter((w) => w.when === 'before' || now - w.since < MOMENT_MS);
  for (const w of v.waiting) {
    const p = w.when === 'before' ? locate(g, w.who) : (w.at ?? locate(g, w.who) ?? v.last.get(w.who));
    const ok = Boolean(p) && (w.when === 'before' ? seen(g, p) : near(g, p));
    w.lookedAt = ok ? (w.lookedAt ?? now) : null;
    if (!ok || (w.when === 'before' && now - w.lookedAt < LOOK_MS)) continue;
    v.waiting.splice(v.waiting.indexOf(w), 1);
    say(g, v, w, p, now);
    // (Seen here first: everyone else near it sees it say it too, bossHeard.)
    if (w.when === 'before') g.send({ t: 'bossays', who: w.who, when: w.when, where: w.where });
    return;
  }
}

// A boss starting its first words on a friend's page, as they saw it (the
// island's `bossays`): said here too, at the same time, if it is near you —
// so everyone there sees it talk — unless it is saying something already.
// Said, it is not said again when you come to see it yourself.
export function bossHeard(g, msg) {
  const line = BOSS_LINES[msg?.who];
  const text = line?.[msg.when];
  if (!text || typeof msg.where !== 'string') return;
  const v = voices(g);
  const now = performance.now();
  if (speaking(g)) return;
  const p = locate(g, msg.who);
  if (!p || dist(g, p) > SEE) return;
  v.said.add(`${msg.where}|${msg.who}|${msg.when}`);
  v.waiting = v.waiting.filter((w) => !(w.who === msg.who && w.when === msg.when));
  say(g, v, { who: msg.who, when: msg.when, where: msg.where, text, line }, p, now);
}

function say(g, v, w, p, now) {
  const s = { who: w.who, when: w.when, text: w.text, name: w.line.name, icon: w.line.icon, color: w.line.color, p, start: now, until: now + sayingTime(w.text) * 1000, sound: false };
  v.now = s;
  g.sound
    .say(voiceUrl(w.who, w.when))
    .then((secs) => {
      if (!secs || v.now !== s) return;
      s.sound = true;
      s.until = performance.now() + secs * 1000 + 350;
    })
    .catch(() => {});
}

// The line being said just now: { who, name, icon, color, text, p (over its
// head), start, until }, or null.
export function speaking(g) {
  const s = g.bossVoice?.now;
  return s && performance.now() < s.until ? s : null;
}

// How much `who` is talking just now, 0 to 1: how loud its voice is (the game's
// sound), or, with no sound, a lively babble while its words show.
export function talkLevel(g, who) {
  const s = speaking(g);
  if (!s || s.who !== who) return 0;
  const t = (performance.now() - s.start) / 1000;
  if (t < 0.05) return 0;
  if (s.sound) return Math.min(1, g.sound.voiceLevel() * 1.6);
  return Math.max(0, 0.55 + 0.45 * Math.sin(t * 15) * Math.sin(t * 4.3));
}

// Over the head of whoever `who` is, wherever it is just now: a boss of the
// isle (or a Big Bad), Jinx, a fright of the Land of Nod or the Storybook's
// boss. Null when it is not about.
function locate(g, who) {
  if (g.book) {
    const t = g.book.boss?.kind === who ? g.book.tags().find((o) => o.key === 'bookboss') : null;
    return t ? { x: t.x, y: t.y, z: t.z, mid: { x: t.x, y: t.y - 2, z: t.z } } : null;
  }
  if (g.nod) {
    for (const f of g.nod.fight.frights.values()) {
      if (f.kind !== who || !f.spec.boss) continue;
      const k = f.alt + f.spec.height + 0.9;
      const m = f.alt + f.spec.height * 0.5;
      return { x: f.x + f.up.x * k, y: f.y + f.up.y * k, z: f.z + f.up.z * k, mid: { x: f.x + f.up.x * m, y: f.y + f.up.y * m, z: f.z + f.up.z * m } };
    }
    return null;
  }
  const me = g.me?.body;
  const far = (p) => (me ? Math.hypot(p.x - me.x, p.z - me.z) : 0);
  let best = null;
  if (who === 'jinx') {
    for (const c of g.critters.values()) {
      if (c.type !== 'magpie' || !c.model.group.visible) continue;
      const p = c.model.group.position;
      const tall = c.model.height ?? 1;
      if (!best || far(p) < far(best)) best = { x: p.x, y: p.y + tall + 0.6, z: p.z, mid: { x: p.x, y: p.y + tall * 0.5, z: p.z } };
    }
    return best;
  }
  for (const e of g.monsters.values()) {
    if (e.kind !== who || !e.model.group.visible) continue;
    const p = e.model.group.position;
    const tall = (e.model.height ?? 1.8) * e.model.group.scale.y;
    if (!best || far(p) < far(best)) best = { x: p.x, y: p.y + tall + 1.1, z: p.z, mid: { x: p.x, y: p.y + tall * 0.5, z: p.z } };
  }
  return best;
}

// On your screen (its middle a little way in from the edges), near enough,
// and not under Toon Isle's clouds.
function seen(g, p) {
  const r = g.renderer;
  const c = p.mid ?? p;
  const s = r.project(c.x, c.y, c.z);
  const w = r.canvas.clientWidth;
  const h = r.canvas.clientHeight;
  if (!s.visible || s.x < w * 0.06 || s.x > w * 0.94 || s.y < h * 0.04 || s.y > h * 0.96) return false;
  if (g.book) return true;
  if (g.inFog?.(p.x, p.z)) return false;
  return dist(g, p) <= SEE;
}

function near(g, p) {
  if (g.book) return true;
  return dist(g, p) <= NEAR;
}

function dist(g, p) {
  const me = g.nod ? g.nod.w : g.me?.body;
  return me ? Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z) : Infinity;
}
