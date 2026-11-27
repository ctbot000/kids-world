// What Adventure Isle's bosses say out loud (shared/boss-lines.js): every boss
// a battle is fought with, in every episode, has a line for before it and
// after it — and the last boss of an episode with a second go, one for that
// too — each with its sound made (public/audio/voices, npm run voices).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { BOSS_LINES, voiceUrl, WHENS } from '../public/js/shared/boss-lines.js';
import { BOSSES } from '../public/js/shared/bosses.js';
import { CHAPTERS } from '../public/js/shared/isle-story.js';
import { NOD_BOSSES } from '../public/js/shared/nod/bosses.js';

const file = (who, when) => new URL(`../public/${voiceUrl(who, when)}`, import.meta.url);

test('every boss has something to say before its battle and after it', () => {
  const who = new Set();
  for (const ch of CHAPTERS) {
    if (ch.boss) who.add(ch.boss);
    for (const b of ch.battles ?? []) if (b.kind === 'hunt') who.add(b.beast);
    if (ch.quests?.some((q) => q.kind === 'jinx')) who.add('jinx');
  }
  for (const kind of Object.keys(NOD_BOSSES)) who.add(kind);
  assert.ok(who.size >= 35, `${who.size} bosses`);
  for (const w of who) {
    const l = BOSS_LINES[w];
    assert.ok(l, `no lines for ${w}`);
    assert.ok(l.before && l.after, `${w} says something before and after`);
    assert.ok(l.name && l.icon && /^#[0-9a-f]{6}$/i.test(l.color), `${w} is shown with a name, icon and colour`);
    if (BOSSES[w]) assert.equal(l.name, BOSSES[w].name, `${w} is called what the isle calls it`);
    if (NOD_BOSSES[w]) assert.equal(l.name, NOD_BOSSES[w].name, `${w} is called what the Land of Nod calls it`);
  }
  // (The last boss of an episode told in camps puffs up for a second go.)
  for (const ch of CHAPTERS.filter((c) => c.boss && !c.battles)) {
    const last = !CHAPTERS.some((o) => (o.episode ?? 1) === (ch.episode ?? 1) && CHAPTERS.indexOf(o) > CHAPTERS.indexOf(ch));
    if (last) assert.ok(BOSS_LINES[ch.boss].again, `${ch.boss} says something as it puffs up again`);
  }
});

test('every line is short, and has its sound', () => {
  const made = new Set(readdirSync(new URL('../public/audio/voices/', import.meta.url)).filter((f) => f.endsWith('.mp3')));
  let n = 0;
  for (const [who, l] of Object.entries(BOSS_LINES)) {
    for (const when of WHENS) {
      if (!l[when]) continue;
      n++;
      assert.ok(l[when].split(/\s+/).length <= 11, `${who} ${when} is a short line`);
      assert.ok(existsSync(file(who, when)) && statSync(file(who, when)).size > 2000, `${who}-${when}.mp3 is made (npm run voices)`);
      made.delete(`${who}-${when}.mp3`);
    }
  }
  assert.deepEqual([...made], [], 'no sound is left over from a line no longer there');
  assert.ok(n >= 70, `${n} lines`);
});
