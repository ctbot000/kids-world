// Draws the Home Screen icon, public/apple-touch-icon.png, from favicon.svg
// in Chrome. iPhones want a 180-pixel square PNG with nothing see-through;
// they round the corners themselves.
// Run after changing favicon.svg: npm run icon
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => path && existsSync(path));
if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH');

const SIZE = 180;
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
const html = `<body style="margin:0">
<div style="width:${SIZE}px;height:${SIZE}px;display:grid;place-items:center;background:linear-gradient(#bfe6ff,#7cc4ff)">
<img src="data:image/svg+xml;base64,${svg.toString('base64')}" width="132" height="132">
</div>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE });
await page.setContent(html, { waitUntil: 'load' });
const out = fileURLToPath(new URL('../public/apple-touch-icon.png', import.meta.url));
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
await browser.close();
console.log('drew public/apple-touch-icon.png');
