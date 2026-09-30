// End to end: real Chrome pages playing together, peer to peer through a
// local PeerServer and through the dedicated server. Each player gets its own
// browser context, so their profiles and tokens are separate, as on two
// devices. Set CHROME_PATH if Chrome is not installed in a standard place;
// without Chrome these tests are skipped.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { PeerServer } from 'peer';
import puppeteer from 'puppeteer-core';
import { createGameServer } from '../server/server.js';

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((path) => path && existsSync(path));

const skip = CHROME ? false : 'Chrome not found; set CHROME_PATH';

let browser;
let server;
let base;
let signalServer;
let signal;
const signalSockets = new Set();
const pageErrors = [];

before(async () => {
  if (skip) return;
  server = createGameServer({ log: () => {} });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}/`;
  signalServer = await new Promise((done) => PeerServer({ port: 0, host: '127.0.0.1', path: '/' }, done));
  signalServer.on('connection', (socket) => {
    signalSockets.add(socket);
    socket.on('close', () => signalSockets.delete(socket));
  });
  signal = `http://127.0.0.1:${signalServer.address().port}/`;
  const args = [
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--ignore-gpu-blocklist',
  ];
  // A real GPU where there is one (macOS), software rendering elsewhere.
  args.push(...(process.platform === 'darwin' && !process.env.CI ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']));
  if (process.env.CI) args.push('--no-sandbox');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args });
});

after(async () => {
  await browser?.close();
  await server?.shutdown();
  if (signalServer) {
    const closed = new Promise((done) => signalServer.close(done));
    for (const socket of signalSockets) socket.destroy();
    await closed;
  }
});

async function openPlayer(url, profile = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`${profile.name ?? 'player'}: ${error.message}`));
  // Small pages without studs keep software rendering (CI has no GPU) quick enough.
  await page.setViewport({ width: 720, height: 480 });
  await page.evaluateOnNewDocument((p) => {
    const saved = { ...p, seenHelp: true, settings: { studs: false, music: 0, sound: 0 } };
    localStorage.setItem('kidsworld.profile', JSON.stringify(saved));
  }, profile);
  page.setDefaultNavigationTimeout(60000 * SLOW);
  await page.goto(url);
  await page.waitForFunction(() => window.kidsWorld?.ui, { timeout: 60000 * SLOW });
  return page;
}

const p2p = (extra = '') => `${base}?p2p=1&signal=${encodeURIComponent(signal)}${extra}`;
const SLOW = process.env.CI ? 3 : 1;
const until = (page, fn, arg, timeout = 30000 * SLOW) => page.waitForFunction(fn, { timeout }, arg);
const inGame = (page) => until(page, () => window.kidsWorld.session?.started && window.kidsWorld.game?.world, null, 60000 * SLOW);

async function clickButton(page, text, scope = 'body') {
  const handle = await page.waitForFunction(
    (text, scope) => [...document.querySelector(scope).querySelectorAll('button')].find((b) => b.textContent.includes(text) && !b.disabled && b.offsetParent !== null),
    { timeout: 15000 * SLOW },
    text,
    scope,
  );
  await page.bringToFront();
  await handle.asElement().click();
}

async function makeIsland(page, { online, theme = 'Sunny Island' }) {
  await clickButton(page, 'Make an island');
  await clickButton(page, theme, '#modal');
  if (!online) await page.click('#modal .switch');
  await clickButton(page, 'Make it', '#modal');
  await inGame(page);
  if (online) await until(page, () => window.kidsWorld.session.link.state === 'online');
}

// A spot on open ground a few steps from where the player stands, and the
// screen point of the middle of its top face.
function spotNear(page, dx, dz) {
  return page.evaluate(
    (dx, dz) => {
      const kw = window.kidsWorld;
      const g = kw.game;
      const b = g.me.body;
      const x = Math.floor(b.x) + dx;
      const z = Math.floor(b.z) + dz;
      const y = g.world.top(x, z);
      return { x, y, z };
    },
    dx,
    dz,
  );
}

// Looks at a cell from above and returns where its top face is on screen.
async function aimAt(page, cell) {
  return page.evaluate((c) => {
    const kw = window.kidsWorld;
    const r = kw.renderer;
    r.view.pitch = 1.1;
    r.view.dist = 9;
    kw.step(1 / 60, 30);
    const p = r.project(c.x + 0.5, c.y + 1, c.z + 0.5);
    const rect = r.canvas.getBoundingClientRect();
    return { x: rect.left + p.x, y: rect.top + p.y };
  }, cell);
}

const blockAt = (page, c) => page.evaluate((c) => window.kidsWorld.game.world.get(c.x, c.y, c.z), c);

test('playing alone: build with a click, pick up with a right-click, undo, talk', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Happy Panda', look: { animal: 'panda', fur: 'white', shirt: 1, hat: 'crown' } });
  await makeIsland(page, { online: false });
  assert.equal(await page.$eval('#island-code', (el) => el.textContent), 'Playing alone');
  const cell = await spotNear(page, 3, 0);
  const above = { ...cell, y: cell.y + 1 };
  // The first hotbar slot is grass.
  let at = await aimAt(page, cell);
  await page.mouse.click(at.x, at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) !== 0, above);
  const placed = await blockAt(page, above);
  assert.equal(placed, 2, 'a grass block went down on top');
  // Right-click picks it back up.
  at = await aimAt(page, above);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 0, above);
  // Undo puts it back.
  await page.keyboard.press('KeyZ');
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
  // Say hello: a bubble appears over our head.
  await page.click('#btn-say');
  await clickButton(page, 'Hello, friend!', '#modal');
  await until(page, () => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'Hello, friend!'));
  // The toy box shows pictures of the blocks.
  await page.click('#btn-toybox');
  await until(page, () => document.querySelectorAll('#modal .choice img').length >= 16 && [...document.querySelectorAll('#modal .choice img')].every((i) => i.src.startsWith('data:image')));
  await page.keyboard.press('Escape');
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('two friends peer to peer: visiting, building together, rules and saying goodbye', { skip }, async () => {
  const host = await openPlayer(p2p(), { name: 'Sunny Otter' });
  await makeIsland(host, { online: true });
  const code = await host.evaluate(() => window.kidsWorld.game.code);
  assert.match(code, /^\d{6}$/);
  assert.match(await host.$eval('#island-code', (el) => el.textContent), /^Code \d{3} \d{3}$/);

  // The invite link opens the visit dialog with the code filled in.
  const guest = await openPlayer(p2p(`&code=${code}`), { name: 'Brave Fox' });
  const filled = await guest.$$eval('#modal .code-input input', (els) => els.map((e) => e.value).join(''));
  assert.equal(filled, code);
  await clickButton(guest, 'go!', '#modal');
  await inGame(guest);
  await until(host, () => window.kidsWorld.game.players.size === 2);
  await until(guest, () => window.kidsWorld.game.players.size === 2);
  assert.equal(await guest.evaluate(() => window.kidsWorld.game.world.name), await host.evaluate(() => window.kidsWorld.game.world.name));

  // The guest builds; the host sees it.
  const cell = await spotNear(guest, 2, 2);
  const above = { ...cell, y: cell.y + 1 };
  const at = await aimAt(guest, cell);
  await guest.mouse.click(at.x, at.y);
  await until(host, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);

  // The guest walks; the host sees them move.
  const before = await host.evaluate(() => {
    const p = [...window.kidsWorld.game.players.values()].find((q) => !q.me);
    return p.avatar.root.position.toArray();
  });
  await guest.bringToFront();
  await guest.keyboard.down('KeyW');
  await delay(1500);
  await guest.keyboard.up('KeyW');
  await until(
    host,
    (b) => {
      const p = [...window.kidsWorld.game.players.values()].find((q) => !q.me);
      const now = p.avatar.root.position;
      return Math.hypot(now.x - b[0], now.z - b[2]) > 0.5;
    },
    before,
  );

  // The host makes building owner-only: the guest's next block is refused and taken back.
  await host.evaluate(() => window.kidsWorld.game.send({ t: 'host', cmd: 'settings', settings: { build: 'host' } }));
  await until(guest, () => window.kidsWorld.game.settings.build === 'host');
  const cell2 = await spotNear(guest, -2, 1);
  const above2 = { ...cell2, y: cell2.y + 1 };
  const at2 = await aimAt(guest, cell2);
  await guest.mouse.click(at2.x, at2.y);
  await until(guest, () => document.querySelector('.toast.warn')?.textContent.includes('only builder'));
  await until(guest, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 0, above2);
  assert.equal(await blockAt(host, above2), 0);

  // Both worlds are identical, block for block.
  const hash = (page) =>
    page.evaluate(() => {
      const b = window.kidsWorld.game.world.blocks;
      let h = 0;
      for (let i = 0; i < b.length; i++) h = (Math.imul(h, 31) + b[i]) >>> 0;
      return h;
    });
  assert.equal(await hash(guest), await hash(host));

  // The host sends the guest home: they are back at the title screen.
  const gid = await guest.evaluate(() => window.kidsWorld.game.pid);
  await host.evaluate((pid) => window.kidsWorld.game.send({ t: 'host', cmd: 'kick', pid }), gid);
  await until(guest, () => !window.kidsWorld.session && !document.getElementById('title').hidden);
  await until(host, () => window.kidsWorld.game.players.size === 1);
  assert.deepEqual(pageErrors, []);
  await guest.browserContext().close();
  await host.browserContext().close();
});

test('the dedicated server hosts islands for friends to share', { skip }, async () => {
  const a = await openPlayer(base, { name: 'Jolly Koala' });
  await makeIsland(a, { online: true, theme: 'Candy Island' });
  const code = await a.evaluate(() => window.kidsWorld.game.code);
  assert.equal(await a.evaluate(() => window.kidsWorld.game.mode), 'server');
  const b = await openPlayer(`${base}?code=${code}`, { name: 'Merry Seal' });
  await clickButton(b, 'go!', '#modal');
  await inGame(b);
  assert.equal(await b.evaluate(() => window.kidsWorld.game.world.theme), 'candy');
  const cell = await spotNear(a, 1, 3);
  const above = { ...cell, y: cell.y + 1 };
  const at = await aimAt(a, cell);
  await a.mouse.click(at.x, at.y);
  await until(b, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
  assert.deepEqual(pageErrors, []);
  await a.browserContext().close();
  await b.browserContext().close();
});

test('an island you made is saved and can be opened again', { skip }, async () => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`saver: ${error.message}`));
  await page.setViewport({ width: 720, height: 480 });
  page.setDefaultNavigationTimeout(60000 * SLOW);
  await page.goto(base + '?p2p=1');
  await page.waitForFunction(() => window.kidsWorld?.ui, { timeout: 60000 * SLOW });
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  const name = await page.evaluate(() => window.kidsWorld.game.world.name);
  const cell = await spotNear(page, 2, -2);
  const above = { ...cell, y: cell.y + 1 };
  const at = await aimAt(page, cell);
  await page.mouse.click(at.x, at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
  // Leaving saves it; reloading the page and opening it brings the block back.
  await page.click('#btn-settings');
  await clickButton(page, 'Leave island', '#modal');
  await until(page, () => !document.getElementById('title').hidden);
  await page.reload();
  await page.waitForFunction(() => window.kidsWorld?.ui, { timeout: 60000 * SLOW });
  await clickButton(page, 'My islands');
  await until(page, (n) => document.querySelector('#modal .island-item b')?.textContent === n, name);
  await clickButton(page, 'Play', '#modal');
  await inGame(page);
  assert.equal(await blockAt(page, above), 2);
  assert.deepEqual(pageErrors, []);
  await context.close();
});
