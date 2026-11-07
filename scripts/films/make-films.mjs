// Makes Adventure Isle's intro and ending films (films.js) as videos in
// public/video/: each frame drawn in a real browser by the game's own renderer
// (stage.js), on a clock of the film's own, its music and sound made there too
// (score.js), and ffmpeg putting them together as an MP4 (H.264 and AAC, which
// every browser plays) and a still for its poster.
//
// npm run films [-- intro|ending] (FROM=s TO=s for a part, PREVIEW=1 for a
// quick small one in the scratch folder of your choice, OUT=dir)
// Needs Google Chrome and ffmpeg (Homebrew's: /opt/homebrew/bin).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import serveStatic from 'serve-static';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const OUT = process.env.OUT ?? join(root, 'public', 'video');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const names = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const which = names.length ? names : ['intro', 'ending'];
const preview = Boolean(process.env.PREVIEW);
mkdirSync(OUT, { recursive: true });

// The game's files, and the film's own beside them.
const game = serveStatic(join(root, 'public'), { index: false });
const films = serveStatic(here, { index: false });
const server = createServer((req, res) => {
  const done = () => {
    res.statusCode = 404;
    res.end();
  };
  if (req.url.startsWith('/films/')) {
    req.url = req.url.slice('/films'.length);
    films(req, res, done);
  } else game(req, res, done);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`${base}/films/stage.html`);
await page.waitForFunction(() => window.filmReady === true, { timeout: 60000 });

const run = (cmd, args, input) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${err.slice(-800)}`))));
    if (input) input(p.stdin);
  });

for (const name of which) {
  const t0 = Date.now();
  await page.evaluate((n) => window.film.load(n), name);
  const length = await page.evaluate(() => window.film.length());
  const from = Number(process.env.FROM ?? 0);
  const to = Math.min(length, Number(process.env.TO ?? length));
  const fps = preview ? 15 : 30;
  const frames = Math.round((to - from) * fps);
  const video = join(OUT, `isle-${name}.mp4`);
  const audio = join(OUT, `.isle-${name}.wav`);
  // The music and sound first, the whole length (or the part).
  const wav = await page.evaluate((n, secs) => window.film.score(n, secs), name, length);
  writeFileSync(audio, Buffer.from(wav, 'base64'));
  const size = preview ? '640x360' : '1280x720';
  await run(
    FFMPEG,
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-ss', String(from), '-t', String(to - from), '-i', audio,
      '-s', size, '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-tune', 'animation', '-crf', preview ? '30' : '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-shortest',
      video,
    ],
    async (stdin) => {
      for (let i = 0; i < frames; i++) {
        const t = from + i / fps;
        const url = await page.evaluate((tt) => window.film.frame(tt), t);
        const ok = stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
        if (!ok) await new Promise((r) => stdin.once('drain', r));
        if (i % (fps * 5) === 0) process.stdout.write(`\r${name}: ${(t - from).toFixed(0)}/${(to - from).toFixed(0)} s`);
      }
      stdin.end();
    },
  );
  // Its poster: a still from where the film says (or its first second).
  const still = await page.evaluate(() => window.film.poster?.() ?? null);
  const posterAt = Number(still ?? Math.min(length - 0.1, 1));
  const shot = await page.evaluate((tt) => window.film.frame(tt), posterAt);
  const raw = join(OUT, `.isle-${name}-poster.jpg`);
  writeFileSync(raw, Buffer.from(shot.slice(shot.indexOf(',') + 1), 'base64'));
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=960:-2', '-q:v', '4', join(OUT, `isle-${name}.jpg`)]);
  (await import('node:fs')).rmSync(raw, { force: true });
  console.log(`\r${name}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${video}`);
  (await import('node:fs')).rmSync(audio, { force: true });
}
if (errors.length) console.log('page errors:', errors);
await browser.close();
server.close();
