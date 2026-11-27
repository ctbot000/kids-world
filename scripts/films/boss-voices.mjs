// What Adventure Isle's bosses say in the game (shared/boss-lines.js), spoken
// in their voices from the films' cast (cast.js) by the Kokoro model
// (voices.mjs, kept with the films' lines), and made into small MP3s the page
// plays (public/audio/voices/<who>-<when>.mp3). Only the lines whose words or
// voices changed are made again; files for lines no longer there go.
//
// npm run voices
// Needs ffmpeg (Homebrew's: /opt/homebrew/bin).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOSS_LINES, WHENS } from '../../public/js/shared/boss-lines.js';
import { lineId } from './cast.js';
import { clipsDir, speak } from './voices.mjs';

for (const e of ['uncaughtException', 'unhandledRejection']) {
  process.on(e, (err) => {
    console.error(`\n${e}:`, err?.stack ?? err);
    process.exit(1);
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'public', 'audio', 'voices');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
mkdirSync(OUT, { recursive: true });

// Which clip each file was made from, so an unchanged line is left alone.
const madeFile = join(OUT, '.made.json');
const made = existsSync(madeFile) ? JSON.parse(readFileSync(madeFile, 'utf8')) : {};
const lines = [];
for (const [who, l] of Object.entries(BOSS_LINES)) for (const when of WHENS) if (l[when]) lines.push({ name: `${who}-${when}`, who: l.cast ?? who, text: l[when] });
const voices = await speak(lines.map(({ who, text }) => ({ who, text })));
const keep = new Set();
let n = 0;
for (const l of lines) {
  const v = voices[lineId(l.who, l.text)];
  const file = join(OUT, `${l.name}.mp3`);
  keep.add(`${l.name}.mp3`);
  if (made[l.name] === v.key && existsSync(file)) continue;
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(clipsDir, `${v.key}.wav`), '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k', file]);
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  made[l.name] = v.key;
  n++;
  console.log(`${l.name}: ${v.dur.toFixed(2)} s`);
}
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.mp3') && !keep.has(f)) {
    rmSync(join(OUT, f));
    delete made[f.slice(0, -4)];
  }
}
writeFileSync(madeFile, `${JSON.stringify(made, null, 1)}\n`);
console.log(`${n} made, ${lines.length} lines in all → ${OUT}`);
