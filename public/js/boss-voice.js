// A boss saying something out loud on Adventure Isle (shared/boss-lines.js):
// before a battle with it starts, after it ends, and (an episode's last boss,
// popped the first time) as it puffs itself up for a second go. Its voice
// comes from public/audio/voices through the game's sound (sound.js say), the
// music quieter under it, and its words show at the top under its name (ui.js
// speech) for as long as they take to say — the words alone, with the sound
// off. Each line is said once a game's stage, and lines come one after
// another, never over each other; one kept waiting too long is let go.
import { BOSS_LINES, voiceUrl } from './shared/boss-lines.js';

// How long a line may wait its turn before it is not worth saying any more.
const STALE_MS = 7000;

// How long words take to say, for when they are only shown.
const sayingTime = (text) => Math.min(5, 1.2 + text.split(/\s+/).length / 2.6);

// `who` (a key of BOSS_LINES) says its line for `when` ('before', 'again' or
// 'after'); `where` tells apart the battles a stage has more than one of (a
// Toon Isle battle's id). Whether it is going to say it.
export function bossSays(g, who, when, where = '') {
  const line = BOSS_LINES[who];
  const text = line?.[when];
  if (!text) return false;
  const adv = g.adventure;
  const key = `${g.code ?? ''}|${adv?.run ?? 0}|${adv?.journey ?? 0}|${adv?.stage ?? 0}|${where}|${who}|${when}`;
  g.saidLines ??= new Set();
  if (g.saidLines.has(key)) return false;
  g.saidLines.add(key);
  (g.speech ??= { queue: [], busy: false }).queue.push({ who, when, text, line, at: performance.now() });
  if (!g.speech.busy) sayNext(g);
  return true;
}

async function sayNext(g) {
  const s = g.speech.queue.shift();
  if (!s) {
    g.speech.busy = false;
    return;
  }
  if (performance.now() - s.at > STALE_MS) {
    sayNext(g);
    return;
  }
  g.speech.busy = true;
  const secs = (await g.sound.say(voiceUrl(s.who, s.when)).catch(() => 0)) || sayingTime(s.text);
  g.emit('speech', { who: s.who, name: s.line.name, icon: s.line.icon, color: s.line.color, text: s.text, secs });
  setTimeout(() => sayNext(g), (secs + 0.4) * 1000);
}
