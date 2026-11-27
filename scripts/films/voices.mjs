// Every line said in Adventure Isle's films, spoken: the Kokoro voice model
// (Kokoro-82M, through kokoro-js, on this computer: the model comes from
// Hugging Face the first time, about 330 MB) says it in the voice the cast
// gives whoever says it (cast.js), and ffmpeg makes it higher or lower, and
// robotic, ghostly or echoing, as the cast says. Each line is kept, as a WAV
// file with what is known of it beside it, in a folder of its own (VOICES, or
// ~/.cache/kids-world-voices), so a film made again says the same thing in the
// same time without saying it again.
//
// speak(lines) → { [lineId]: { key, dur, env } }, lines each { who, text, max }:
// key: its file there (<key>.wav), dur: how long it is in seconds, env: how
// loud it is each thirtieth of a second (0 to 1), to bounce whoever says it.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CAST, lineId } from './cast.js';

export const VOICES = process.env.VOICES ?? join(homedir(), '.cache', 'kids-world-voices');
const CLIPS = join(VOICES, 'clips');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const RATE = 24000;
// Changed whenever how a line is made changes, so every line is made again.
const MAKE = 4;

let tts = null;
async function model() {
  if (tts) return tts;
  const { env } = await import('@huggingface/transformers');
  env.cacheDir = join(VOICES, 'models');
  const { KokoroTTS } = await import('kokoro-js');
  tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'fp32', device: 'cpu' });
  return tts;
}

// The words as the voice should read them: the story's curly quotes, dashes
// and dots as plain ones, and no emoji.
export function speakable(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*—\s*/g, ', ')
    .replace(/…/g, '...')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The sound without the quiet at either end (a little left before and after).
function trim(a) {
  let peak = 0;
  for (const v of a) peak = Math.max(peak, Math.abs(v));
  const floor = peak * 0.03;
  let i = 0;
  while (i < a.length && Math.abs(a[i]) < floor) i++;
  let j = a.length - 1;
  while (j > i && Math.abs(a[j]) < floor) j--;
  const pad = Math.round(RATE * 0.04);
  return a.slice(Math.max(0, i - pad), Math.min(a.length, j + pad * 2));
}

// What ffmpeg does to a voice: higher or lower (the same length), and fx.
function filters(c) {
  const out = [];
  const p = c.pitch ?? 1;
  if (Math.abs(p - 1) > 0.005) out.push(`asetrate=${Math.round(RATE * p)}`, `aresample=${RATE}`, `atempo=${(1 / p).toFixed(5)}`);
  if (c.fx === 'echo') out.push('aecho=0.85:0.55:55|110:0.32|0.16');
  if (c.fx === 'ghost') out.push('vibrato=f=5:d=0.12', 'aecho=0.8:0.5:90|180:0.25|0.12');
  if (c.fx === 'robot') out.push('aecho=0.9:0.8:9|17:0.45|0.3');
  return out;
}

function ffmpeg(a, chain) {
  if (!chain.length) return Promise.resolve(a);
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-af', chain.join(','), '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg: ${err.slice(-400)}`));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)).slice());
    });
    p.stdin.end(Buffer.from(a.buffer, a.byteOffset, a.length * 4));
  });
}

// As loud as every other line (by how loud it is where it is loud), never
// clipping; the robot's voice buzzing, as a tin voice does.
function finish(a, c) {
  if (c.fx === 'robot') for (let i = 0; i < a.length; i++) a[i] *= 0.72 + 0.28 * Math.sin((2 * Math.PI * 62 * i) / RATE);
  const win = Math.round(RATE / 50);
  const levels = [];
  for (let i = 0; i + win <= a.length; i += win) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += a[k] * a[k];
    levels.push(Math.sqrt(s / win));
  }
  levels.sort((x, y) => x - y);
  const loud = levels[Math.floor(levels.length * 0.8)] || 0.05;
  let peak = 0;
  for (const v of a) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(0.16 / loud, 0.95 / (peak || 1));
  for (let i = 0; i < a.length; i++) a[i] *= gain;
  return a;
}

// How loud it is each thirtieth of a second, 0 to 1.
function envelope(a) {
  const step = RATE / 30;
  const env = [];
  for (let i = 0; i < a.length; i += step) {
    let s = 0;
    const end = Math.min(a.length, Math.floor(i + step));
    for (let k = Math.floor(i); k < end; k++) s += a[k] * a[k];
    env.push(Math.sqrt(s / Math.max(1, end - Math.floor(i))));
  }
  const top = [...env].sort((x, y) => x - y)[Math.floor(env.length * 0.92)] || 1;
  return env.map((v) => Math.round(Math.min(1, v / top) * 100) / 100);
}

function wav(a) {
  const out = Buffer.alloc(44 + a.length * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + a.length * 2, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(RATE, 24);
  out.writeUInt32LE(RATE * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(a.length * 2, 40);
  for (let i = 0; i < a.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a[i])) * 32767), 44 + i * 2);
  return out;
}

async function say(c, text, speed) {
  const voice = await model();
  const audio = await voice.generate(speakable(text), { voice: c.voice, speed });
  return finish(await ffmpeg(trim(audio.audio), filters(c)), c);
}

// One line: from the folder if it has been said before, or said now (faster,
// as it must be, to fit in `max` seconds, but never more than a third faster).
async function line({ who, text, max }) {
  const c = CAST[who];
  if (!c) throw new Error(`nobody called ${who} in the cast`);
  const key = createHash('sha1')
    .update(JSON.stringify([MAKE, MODEL, c.voice, c.pitch ?? 1, c.speed ?? 1, c.fx ?? '', max ?? 0, text]))
    .digest('hex')
    .slice(0, 16);
  const meta = join(CLIPS, `${key}.json`);
  if (existsSync(meta) && existsSync(join(CLIPS, `${key}.wav`))) {
    const { dur, env } = JSON.parse(readFileSync(meta, 'utf8'));
    return { key, dur, env };
  }
  const base = c.speed ?? 1;
  let a = await say(c, text, base);
  if (max && a.length / RATE > max) {
    const faster = Math.min(base * 1.34, (base * a.length) / RATE / (max * 0.97));
    a = await say(c, text, faster);
    if (a.length / RATE > max) console.warn(`\n  too long even said faster (${(a.length / RATE).toFixed(2)} s for ${max} s): ${who}: ${text}`);
  }
  const info = { dur: Math.round((a.length / RATE) * 1000) / 1000, env: envelope(a), who, text };
  writeFileSync(join(CLIPS, `${key}.wav`), wav(a));
  writeFileSync(meta, JSON.stringify(info));
  return { key, dur: info.dur, env: info.env };
}

export async function speak(lines) {
  mkdirSync(CLIPS, { recursive: true });
  const out = {};
  for (const l of lines) out[lineId(l.who, l.text, l.max)] ??= await line(l);
  return out;
}

export const clipsDir = CLIPS;
