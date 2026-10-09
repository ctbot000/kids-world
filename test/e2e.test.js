// End to end: real Chrome pages playing together, peer to peer through a
// local PeerServer and through the dedicated server. Each player gets its own
// browser context, so their profiles and tokens are separate, as on two
// devices. Set CHROME_PATH if Chrome is not installed in a standard place;
// without Chrome these tests are skipped.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { PeerServer } from 'peer';
import puppeteer from 'puppeteer-core';
import { CANDY_CANE, CLOTH, LEAVES, TALL_GRASS, TREE_PART, TULIP, WATER } from '../public/js/shared/blocks.js';
import { Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, KeepError, Keeper, KeeperStore, publicConfig } from '../server/keeper.js';
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

// Whatever a test leaves open is closed after it. A test that fails before it
// closes its pages would otherwise leave an island drawing in software for the
// rest of the run, and every test after it takes about three times as long.
afterEach(async () => {
  for (const context of browser?.browserContexts() ?? []) {
    if (context !== browser.defaultBrowserContext()) await context.close().catch(() => {});
  }
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

// init: runs in the page before the game does, to pretend to be another kind of browser.
async function openPlayer(url, profile = {}, init = null) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`${profile.name ?? 'player'}: ${error.message}`));
  // Small pages without studs keep software rendering (CI has no GPU) quick enough.
  await page.setViewport({ width: 720, height: 480 });
  if (process.env.E2E_NO_MOUSE) {
    // Like a CI machine with no mouse: the page thinks it is on a touch screen.
    await page.evaluateOnNewDocument(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q.includes('any-pointer: fine') ? { matches: false, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
    });
  }
  if (init) await page.evaluateOnNewDocument(init);
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
async function until(page, fn, arg, timeout = 30000 * SLOW) {
  try {
    return await page.waitForFunction(fn, { timeout }, arg);
  } catch (error) {
    const state = await page
      .evaluate(() => ({
        link: window.kidsWorld.session?.link.state,
        started: window.kidsWorld.session?.started,
        toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent),
      }))
      .catch(() => null);
    error.message += ` while waiting for ${String(fn).slice(0, 160)}; page: ${JSON.stringify(state)}`;
    throw error;
  }
}
const inGame = (page) => until(page, () => window.kidsWorld.session?.started && window.kidsWorld.game?.world, null, 60000 * SLOW);

// Fills the basket with every kind of treasure, or empties it, and switches the touch controls
// on or off. Upright, those stand on the hotbar and the basket, at a height that a
// ResizeObserver keeps, a frame later: this waits for it, which a new screen size needs too.
async function basketAndTouch(page, full, touch) {
  await page.evaluate(
    (full, touch) => {
      document.body.classList.toggle('touch', touch);
      const profile = window.kidsWorld.profile;
      for (const key of Object.keys(profile.basket)) profile.addToBasket(key, full ? 999 : -999);
    },
    full,
    touch,
  );
  await until(page, () => getComputedStyle(document.documentElement).getPropertyValue('--bottom-height') === `${document.getElementById('bottom').offsetHeight}px`);
}

// The Ride button follows the animal or vehicle beside you about the screen, over whatever is
// there, so it is not a button that stays put. The layout checks are of the ones that do, and
// they do without it: a pony or a cow wandering up to a player standing still, as one does on
// about one island in twenty-five within forty seconds, would put it among them.
function hideRideButton(page) {
  return page.addStyleTag({ content: '#ride { display: none !important; }' });
}

// Says five things, as many as the chat log keeps, under a name as long as names get, and
// waits for the lines that do not fit in the log's room to go, a frame later. Returns how many
// show, whether they are on screen, and what they lie over of the buttons, the tool options,
// the thumbstick and a connection message.
async function chatLines(page) {
  await page.evaluate(() => {
    const kw = window.kidsWorld;
    const me = kw.game.players.get(kw.game.pid);
    const name = me.name;
    me.name = 'Dazzling Hedgehog 2';
    document.getElementById('chatlog').replaceChildren();
    for (const text of ['What should we build?', "Let's go swimming!", "Let's be friends!", 'Take a picture!', 'Hi!']) kw.ui.chatLine({ pid: kw.game.pid, text });
    me.name = name;
  });
  await until(page, () => {
    const log = document.getElementById('chatlog');
    const top = log.getBoundingClientRect().top;
    return [...log.children].every((line) => line.getBoundingClientRect().top >= top - 0.5);
  });
  return page.evaluate(() => {
    const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const lines = [...document.querySelectorAll('#chatlog .line')].map((line) => line.getBoundingClientRect());
    // What shows of each: the basket and the hotbar cut off what they scroll out of sight.
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      const c = el.closest('#basket, #hotbar')?.getBoundingClientRect() ?? r;
      return { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) };
    };
    const under = [...document.querySelectorAll('#hud button, #toolopts > *, #joystick, #status')]
      .filter((el) => {
        const r = shown(el);
        return r.left < r.right && r.top < r.bottom && lines.some((line) => meets(line, r));
      })
      .map((el) => el.id || el.title.split(':')[0] || el.className);
    document.getElementById('chatlog').replaceChildren();
    return { shown: lines.length, onScreen: lines.every((r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight), under };
  });
}

// Puppeteer aims a click where something is when it looks, and a dialog popping
// in grows before the press lands, onto whatever is next to it there. This
// waits until something, and everything it is in, has stopped moving.
async function landed(page, element) {
  // In front first: a page behind another gets no frames, so nothing on it would stop.
  await page.bringToFront();
  await page.waitForFunction(
    (el) => {
      for (; el; el = el.parentElement) {
        if (el.getAnimations().some((a) => a.playState !== 'finished' && a.effect.getTiming().iterations !== Infinity)) return false;
      }
      return true;
    },
    { timeout: 15000 * SLOW },
    element,
  );
}

async function clickButton(page, text, scope = 'body') {
  const handle = await page.waitForFunction(
    (text, scope) => [...document.querySelector(scope).querySelectorAll('button')].find((b) => b.textContent.includes(text) && !b.disabled && b.offsetParent !== null),
    { timeout: 15000 * SLOW },
    text,
    scope,
  );
  await landed(page, handle);
  await handle.asElement().click();
}

// A switch in a dialog, once the dialog has landed.
async function clickSwitch(page, selector) {
  const handle = await page.waitForSelector(selector, { timeout: 15000 * SLOW });
  await landed(page, handle);
  await handle.click();
}

// A real click in the middle of something beside a see-through dialog, which
// must not be under the dialog: that would take the click instead.
async function clickBeside(page, selector) {
  // While the dialog pops in it is smaller, and something it will cover looks reachable.
  await landed(page, await page.$('#modal .panel'));
  const at = await page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return { x, y, reachable: el.contains(document.elementFromPoint(x, y)) };
  });
  assert.ok(at.reachable, `nothing covers ${selector}`);
  await page.mouse.click(at.x, at.y);
}

async function makeIsland(page, { online, theme = 'Sunny Island', size = '', name = '' }) {
  await clickButton(page, 'Make an island');
  // A name typed before the kind of island is picked stays.
  if (name) {
    const box = await page.waitForSelector('#modal .name-input');
    await landed(page, box);
    await box.evaluate((el) => (el.value = ''));
    await box.type(name);
  }
  await clickButton(page, theme, '#modal');
  if (size) await clickButton(page, size, '#modal');
  if (!online) await clickSwitch(page, '#modal .switch');
  await clickButton(page, 'Make it', '#modal');
  await inGame(page);
  if (online) await until(page, () => window.kidsWorld.session.link.state === 'online');
}

// Turns the camera until the top face of one of the cells is in plain view,
// trying them in turn (islands are random, and a tree crown, a hill or an
// animal can be in the way), and returns that cell and where it is on screen.
function inView(page, cells) {
  return page.evaluate((cells) => {
    const kw = window.kidsWorld;
    const r = kw.renderer;
    const g = kw.game;
    for (const c of cells) {
      for (let k = 0; k < 16; k++) {
        r.view.yaw = (k * Math.PI) / 8;
        r.view.pitch = k < 8 ? 1.1 : 0.8;
        r.view.dist = 7;
        kw.step(1 / 60, 40);
        const p = r.project(c.x + 0.5, c.y + 1, c.z + 0.5);
        const rect = r.canvas.getBoundingClientRect();
        const ndc = { x: (p.x / rect.width) * 2 - 1, y: -(p.y / rect.height) * 2 + 1 };
        const aim = g.aim(ndc);
        const h = aim?.kind === 'block' ? aim.hit : null;
        // The top of the cell itself, or a flower or tuft of grass standing on it.
        const onTop = h && h.x === c.x && h.z === c.z && ((h.y === c.y && h.ny === 1) || (h.y === c.y + 1 && g.world.get(h.x, h.y, h.z) >= 50 && g.world.get(h.x, h.y, h.z) < 70));
        // ...and nothing on top of it on screen (the hotbar, a button).
        const clear = document.elementFromPoint(rect.left + p.x, rect.top + p.y) === r.canvas;
        if (onTop && clear) {
          return { cell: c, at: { x: rect.left + p.x, y: rect.top + p.y } };
        }
      }
    }
    return null;
  }, cells);
}

// A spot on open ground a few steps from where the player stands, and the
// screen point of the middle of its top face: the column nearest (dx, dz)
// that can be seen and is dry land with nothing on it but air, a flower or a
// tuft of grass (only air if bare: a click at a flower acts on the flower,
// not on the block under it). A column's highest block is not always that:
// world.top() looks through water and stops at leaves, so where a walk ends
// beside a pond or a tree it can be a pond's floor, whose top the water hides,
// or a treetop as high as the camera. A failure names the island's seed, to
// replay it.
async function spotNear(page, dx, dz, { bare = false } = {}) {
  const { seed, cells } = await page.evaluate(
    (dx, dz, bare, tree) => {
      const g = window.kidsWorld.game;
      const b = g.me.body;
      const px = Math.floor(b.x);
      const pz = Math.floor(b.z);
      const open = [];
      for (let x = px + dx - 3; x <= px + dx + 3; x++) {
        for (let z = pz + dz - 3; z <= pz + dz + 3; z++) {
          // Not right beside us: a block there could go into us.
          if (Math.abs(x - px) <= 1 && Math.abs(z - pz) <= 1) continue;
          const y = g.world.top(x, z);
          const on = g.world.get(x, y + 1, z);
          if (y > 0 && !tree[g.world.get(x, y, z)] && (on === 0 || (!bare && on >= 50 && on < 70))) open.push({ x, y, z });
        }
      }
      const off = (c) => Math.hypot(c.x - px - dx, c.z - pz - dz);
      return { seed: g.world.seed, cells: open.sort((a, b) => off(a) - off(b)) };
    },
    dx,
    dz,
    bare,
    [...TREE_PART],
  );
  const seen = await inView(page, cells);
  assert.ok(seen, `one of ${cells.length} spots of open ground near ${dx}, ${dz} can be seen, on island seed ${seed}`);
  return seen;
}

// Where the top face of a cell is on screen, once the camera has turned to see it.
async function aimAt(page, cell) {
  const seen = await inView(page, [cell]);
  assert.ok(seen, `cell ${JSON.stringify(cell)} can be seen`);
  return seen.at;
}

const blockAt = (page, c) => page.evaluate((c) => window.kidsWorld.game.world.get(c.x, c.y, c.z), c);

test('playing alone: build with a click, pick up with a right-click, undo, talk', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Happy Panda', look: { animal: 'panda', fur: 'white', shirt: 1, hat: 'crown' } });
  await makeIsland(page, { online: false });
  assert.equal(await page.$eval('#island-code', (el) => el.textContent), 'Playing alone');
  const { cell, at } = await spotNear(page, 3, 0);
  const above = { ...cell, y: cell.y + 1 };
  // The first hotbar slot is grass.
  await page.mouse.click(at.x, at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) !== 0, above);
  const placed = await blockAt(page, above);
  assert.equal(placed, 2, 'a grass block went down on top');
  // Right-click picks it back up.
  const atBlock = await aimAt(page, above);
  await page.mouse.click(atBlock.x, atBlock.y, { button: 'right' });
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

test('a pinch only zooms, never builds, a third finger down included; the finger left after it turns the camera from where it is', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Pinchy Crab' });
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  const { cell, at } = await spotNear(page, 3, 0);
  const above = { ...cell, y: cell.y + 1 };
  const was = await blockAt(page, above);
  // Counts every use of the tool, held down or tapped.
  await page.evaluate(() => {
    const g = window.kidsWorld.game;
    const use = g.use.bind(g);
    window.uses = 0;
    g.use = (...args) => (window.uses++, use(...args));
  });
  const view = () => page.evaluate(() => ({ uses: window.uses, dist: window.kidsWorld.renderer.view.dist, yaw: window.kidsWorld.renderer.view.yaw }));
  const before = await view();
  // Two fingers on the spot, a moment apart, spread out for well over the time a finger held
  // still takes to start building; on the way a third (a palm, a friend's hand) comes down and stays.
  // Under software rendering the page gets the second finger hundreds of milliseconds after the
  // first, not 40, near the 420 ms a finger held still takes to start building and now and then
  // past it. That is no pinch's fault, so the first finger's hold is put off until the second is
  // down, and it is the second finger that has to end it.
  await page.evaluate(() => {
    const g = window.kidsWorld.game;
    window.putOffHold = () => {
      if (g.holding) g.holding.at += 60000;
    };
    addEventListener('pointerdown', window.putOffHold);
  });
  const fingers = page.touchscreen;
  const one = await fingers.touchStart(at.x - 30, at.y);
  await delay(40);
  const two = await fingers.touchStart(at.x + 30, at.y);
  await until(page, () => window.kidsWorld.input.touches.size === 2);
  assert.equal(await page.evaluate(() => window.kidsWorld.game.holding), null, 'the second finger ended the first one\'s hold');
  await page.evaluate(() => removeEventListener('pointerdown', window.putOffHold));
  let three;
  for (let i = 1; i <= 30; i++) {
    if (i === 10) three = await fingers.touchStart(at.x, at.y + 50);
    await one.move(at.x - 30 - i * 2, at.y);
    await two.move(at.x + 30 + i * 2, at.y);
    await delay(30);
  }
  // The fingers end three times as far apart as they started, and the camera three times as
  // close. Moves reach the page with the next frame, which can be well after the last one is sent.
  const zoomed = before.dist / 3;
  await until(page, (d) => Math.abs(window.kidsWorld.renderer.view.dist - d) < 1e-9, zoomed);
  assert.equal((await view()).uses, 0, 'the tool was not used while pinching');
  // The third finger and then the second come up; the first, left down, turns the camera as far
  // as it moves from now on, not as far as it went during the pinch.
  await three.end();
  await two.end();
  await until(page, () => window.kidsWorld.input.touches.size === 1);
  const left = await view();
  assert.ok(Math.abs(left.dist - zoomed) < 1e-9, `a finger lifted from a pinch does not zoom, ${left.dist} after ${zoomed}`);
  for (let i = 1; i <= 5; i++) {
    await one.move(at.x - 90 + i * 2, at.y);
    await delay(30);
  }
  await one.end();
  await until(page, () => window.kidsWorld.input.touches.size === 0);
  const turned = (await view()).yaw - left.yaw;
  assert.ok(Math.abs(turned + 10 * 0.009) < 0.005, `the camera turned as a 10 px drag does, by ${turned.toFixed(3)}`);
  await delay(500);
  assert.equal((await view()).uses, 0, 'no finger tapped as it came up');
  assert.equal(await blockAt(page, above), was, 'nothing was built');
  // One finger held still on the spot does keep building.
  const spot = await aimAt(page, cell);
  const held = await fingers.touchStart(spot.x, spot.y);
  await until(page, () => window.uses >= 2);
  await held.end();
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
  // Held down while the page loses focus, it stops then, and does not start again.
  const blurred = await fingers.touchStart(spot.x, spot.y);
  await until(page, () => window.kidsWorld.game.holding);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(() => window.kidsWorld.game.holding), null, 'losing focus lets go of the tool');
  await blurred.end();
  const stopped = (await view()).uses;
  await delay(1000);
  assert.equal((await view()).uses, stopped, 'nothing was built after the focus went');
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a gem rock is dug out with a click into the basket, for keeps; a jewel from the basket is put down and picked up again', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false });
  const { cell } = await spotNear(page, 3, 0, { bare: true });
  // A ruby rock where the ground was, put there by the island itself.
  await page.evaluate(async (c) => {
    const B = await import('/js/shared/blocks.js');
    window.kidsWorld.session.link.room.natureCell([c.x, c.y, c.z], B.GEM_ROCKS[0]);
  }, cell);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 80, cell);
  const at = await aimAt(page, cell);
  // Any tool digs it: this is the Build tool.
  await page.mouse.click(at.x, at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 0, cell);
  await until(page, () => window.kidsWorld.profile.basket.ruby === 1 && [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('You found a Ruby!')));
  // Undo does not put it back to be found again.
  await page.keyboard.press('KeyZ');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await blockAt(page, cell), 0, 'the ruby rock stays dug out');
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.basket.ruby), 1);
  // The ruby from the basket goes down on the ground, as a little jewel...
  const ground = await spotNear(page, 0, 3);
  const above = { ...ground.cell, y: ground.cell.y + 1 };
  await page.click('#basket button');
  await page.mouse.click(ground.at.x, ground.at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 85, above);
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.basket.ruby), 0);
  // ...and a tap there picks it up again.
  await page.mouse.click(ground.at.x, ground.at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 0, above);
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.basket.ruby), 1);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a bird invited from the toy box is petted with a click, and once fed it sits on your head', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Gentle Bear', look: { animal: 'bear', fur: 'brown', shirt: 2, hat: 'none' } });
  await makeIsland(page, { online: false });
  // Choosing a bird in the toy box makes the Animals tool invite birds.
  await page.click('#btn-toybox');
  await clickButton(page, 'Animals', '#modal');
  await clickButton(page, 'Bird', '#modal');
  await until(page, () => window.kidsWorld.game.tool === 'friends' && window.kidsWorld.game.critterType === 'bird');
  const birds = () => page.evaluate(() => [...window.kidsWorld.game.critters.values()].filter((c) => c.type === 'bird').map((c) => c.id));
  const before = await birds();
  const { cell, at } = await spotNear(page, 3, 0);
  await page.mouse.click(at.x, at.y);
  await until(page, (n) => [...window.kidsWorld.game.critters.values()].filter((c) => c.type === 'bird').length > n, before.length);
  const id = (await birds()).find((b) => !before.includes(b));
  // Birds flit about: this one is asked to sit still where it came in, to be
  // clicked, in a tulip there. A flower is see-through: it must not take the click.
  await page.evaluate(
    (id, cell, tulip) => {
      const kw = window.kidsWorld;
      kw.game.edit('build', [cell.x, cell.y + 1, cell.z, tulip], { undoable: false });
      Object.assign(kw.session.link.room.critters.get(id), { x: cell.x + 0.5, y: cell.y + 1, z: cell.z + 0.5, mode: 'perch', perch: '', state: 'idle', timer: 1e9 });
    },
    id,
    cell,
    TULIP,
  );
  await until(
    page,
    ({ id, cell, tulip }) => {
      const g = window.kidsWorld.game;
      const p = g.critters.get(id)?.model.group.position;
      return p && Math.hypot(p.x - cell.x - 0.5, p.y - cell.y - 1, p.z - cell.z - 0.5) < 0.01 && g.world.get(cell.x, cell.y + 1, cell.z) === tulip;
    },
    { id, cell, tulip: TULIP },
  );
  const clickBird = async () => {
    const at = await page.evaluate((id) => {
      const kw = window.kidsWorld;
      const m = kw.game.critters.get(id).model;
      const p = m.group.position;
      const r = kw.renderer.canvas.getBoundingClientRect();
      const s = kw.renderer.project(p.x, p.y + m.height / 2, p.z);
      return { x: r.left + s.x, y: r.top + s.y };
    }, id);
    await page.mouse.click(at.x, at.y);
  };
  await page.click('#toolbar button[title="Build"]');
  await clickBird();
  await until(page, () => window.kidsWorld.profile.data.stats.petted === 1);
  // Given a fruit, it follows you, and sits on your head while you stand still.
  await page.evaluate(() => {
    window.kidsWorld.profile.addToBasket('apple', 1);
    window.kidsWorld.ui.pickBasket('apple');
  });
  await clickBird();
  await until(page, () => window.kidsWorld.profile.data.stats.fed === 1);
  await until(page, () => window.kidsWorld.profile.data.stickers['bird-buddy']);
  // The sticker comes as it lands; then it settles right on top of the head.
  await until(
    page,
    (id) => {
      const g = window.kidsWorld.game;
      const p = g.critters.get(id).model.group.position;
      const b = g.me.body;
      return Math.hypot(p.x - b.x, p.z - b.z) < 0.01 && Math.abs(p.y - b.y - 1.41) < 0.01;
    },
    id,
  );
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a fish under the water is petted with a click through it, not built on', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Calm Otter', look: { animal: 'cat', fur: 'grey', shirt: 5, hat: 'none' } });
  await makeIsland(page, { online: false });
  const { cell } = await spotNear(page, 3, 0);
  // A puddle there, and a fish in it, told to stay put.
  const id = await page.evaluate(
    (cell, water) => {
      const kw = window.kidsWorld;
      kw.game.edit('build', [cell.x, cell.y + 1, cell.z, water], { undoable: false });
      const c = kw.session.link.room.critters.add('fish', cell.x + 0.5, cell.y + 1.45, cell.z + 0.5);
      Object.assign(c, { mode: 'rest', timer: 1e9 });
      return c.id;
    },
    cell,
    WATER,
  );
  await until(
    page,
    ({ id, cell, water }) => {
      const g = window.kidsWorld.game;
      const p = g.critters.get(id)?.model.group.position;
      return p && Math.hypot(p.x - cell.x - 0.5, p.y - cell.y - 1.45, p.z - cell.z - 0.5) < 0.01 && g.world.get(cell.x, cell.y + 1, cell.z) === water;
    },
    { id, cell, water: WATER },
  );
  const at = await page.evaluate((id) => {
    const kw = window.kidsWorld;
    const p = kw.game.critters.get(id).model.group.position;
    const r = kw.renderer.canvas.getBoundingClientRect();
    const s = kw.renderer.project(p.x, p.y, p.z);
    return { x: r.left + s.x, y: r.top + s.y };
  }, id);
  await page.mouse.click(at.x, at.y);
  await until(page, () => window.kidsWorld.profile.data.stats.petted === 1);
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.data.stats.placed), 0, 'nothing was built on the water');
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a pony beside you is got on with the Ride button, ridden about, and got off with Q', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Brave Fox', look: { animal: 'fox', fur: 'orange', shirt: 4, hat: 'none' } });
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  // The island's own big animals away, and a pony two steps from you that
  // stays put until someone gets on.
  const id = await page.evaluate(async () => {
    const kw = window.kidsWorld;
    const room = kw.session.link.room;
    const { BIG, roomFor } = await import('/js/shared/critters.js');
    for (const c of [...room.critters.list]) if (BIG.includes(c.type)) room.critters.remove(c.id);
    const b = kw.game.me.body;
    const at = roomFor(room.world, 'pony', b.x + 2, b.y, b.z, 1);
    const c = room.critters.add('pony', at.x, at.y, at.z);
    Object.assign(c, { timer: 1e9, yaw: 0 });
    kw.renderer.view.yaw = Math.PI / 2;
    return c.id;
  });
  await until(page, (id) => window.kidsWorld.game.rideTarget === id && !document.getElementById('ride').hidden, id);
  assert.match(await page.$eval('#ride', (el) => el.textContent), /Ride/);
  // The camera settled, so that the button stays where it is to be pressed.
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 60));
  await page.click('#ride');
  await until(page, (id) => window.kidsWorld.game.riding?.id === id && window.kidsWorld.session.link.room.critters.get(id).rider === window.kidsWorld.game.pid, id);
  await until(page, () => document.getElementById('ride').textContent.includes('Get off'));
  // Ridden about: it goes where you go, there and on the island.
  const from = await page.evaluate((id) => ({ ...window.kidsWorld.session.link.room.critters.get(id) }), id);
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 90));
  await page.keyboard.up('KeyW');
  await until(
    page,
    ({ id, from }) => {
      const kw = window.kidsWorld;
      const c = kw.session.link.room.critters.get(id);
      const r = kw.game.riding.body;
      return Math.hypot(c.x - from.x, c.z - from.z) > 3 && Math.hypot(c.x - r.x, c.z - r.z) < 0.05;
    },
    { id, from },
  );
  assert.ok(await page.evaluate(() => window.kidsWorld.profile.data.stickers['giddy-up']), 'a sticker for it');
  // Q: off, beside it, and it stays there.
  await page.keyboard.press('KeyQ');
  await until(page, (id) => !window.kidsWorld.game.riding && window.kidsWorld.session.link.room.critters.get(id).rider === 0, id);
  const off = await page.evaluate((id) => {
    const kw = window.kidsWorld;
    const c = kw.session.link.room.critters.get(id);
    const b = kw.game.me.body;
    return Math.hypot(c.x - b.x, c.z - b.z);
  }, id);
  assert.ok(off > 0.7 && off < 2, `beside it, ${off.toFixed(2)} away`);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a digger beside you is driven with the Drive button: it digs a tunnel through stone and a ruby into the basket, and Q gets you out', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  // A digger two steps from you, facing a wall of stone with a ruby in it.
  const { id, ruby } = await page.evaluate(async () => {
    const kw = window.kidsWorld;
    const room = kw.session.link.room;
    const B = await import('/js/shared/blocks.js');
    const { BIG, roomFor, VEHICLES } = await import('/js/shared/critters.js');
    for (const c of [...room.critters.list]) if (BIG.includes(c.type) || VEHICLES.includes(c.type)) room.critters.remove(c.id);
    const b = kw.game.me.body;
    const at = roomFor(room.world, 'digger', b.x + 2, b.y, b.z, 1);
    const c = room.critters.add('digger', at.x, at.y, at.z, null, Math.PI / 2);
    const [x0, y0, z0] = [Math.floor(at.x) + 3, Math.floor(at.y), Math.floor(at.z)];
    for (let x = x0; x < x0 + 5; x++) for (let y = y0; y < y0 + 3; y++) for (let z = z0 - 1; z <= z0 + 1; z++) room.natureCell([x, y, z], B.STONE);
    const ruby = { x: x0 + 2, y: y0 + 1, z: z0 };
    room.natureCell([ruby.x, ruby.y, ruby.z], B.GEM_ROCKS[0]);
    kw.renderer.view.yaw = -Math.PI / 2;
    return { id: c.id, ruby };
  });
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 80, ruby);
  await until(page, (id) => window.kidsWorld.game.rideTarget === id && !document.getElementById('ride').hidden, id);
  assert.match(await page.$eval('#ride', (el) => el.textContent), /🚜 Drive/);
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 60));
  await page.click('#ride');
  await until(page, (id) => window.kidsWorld.game.riding?.id === id && window.kidsWorld.session.link.room.critters.get(id).rider === window.kidsWorld.game.pid, id);
  await until(page, () => document.getElementById('ride').textContent.includes('Get out') && [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('You are driving')));
  // On into the stone: a tunnel, and the ruby in the basket.
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 240));
  await page.keyboard.up('KeyW');
  await until(page, (c) => window.kidsWorld.session.link.room.world.get(c.x, c.y, c.z) === 0 && window.kidsWorld.profile.basket.ruby === 1, ruby);
  const done = await page.evaluate(() => {
    const kw = window.kidsWorld;
    return { x: kw.game.riding.body.x, drilled: kw.profile.data.stats.drilled, sticker: Boolean(kw.profile.data.stickers.driver) };
  });
  assert.ok(done.x > ruby.x - 1, `the digger went in after it, to ${done.x.toFixed(2)}`);
  assert.ok(done.drilled >= 27, `${done.drilled} blocks dug`);
  assert.ok(done.sticker, 'a sticker for driving');
  await page.keyboard.press('KeyQ');
  await until(page, (id) => !window.kidsWorld.game.riding && window.kidsWorld.session.link.room.critters.get(id).rider === 0, id);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('on an elevator pad, Space rides up to the pad above and Shift back down, with a hint and a sticker', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  // Two pads in a column a few steps away, and you standing on the lower one.
  const pad = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const room = kw.session.link.room;
    const b = kw.game.me.body;
    const x = Math.floor(b.x) + 3;
    const z = Math.floor(b.z);
    const y = room.world.top(x, z) + 1;
    room.natureCell([x, y, z], 91);
    room.natureCell([x, y + 7, z], 91);
    return { x, y, z };
  });
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y + 7, c.z) === 91, pad);
  await page.evaluate((c) => Object.assign(window.kidsWorld.game.me.body, { x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5, vx: 0, vy: 0, vz: 0 }), pad);
  const low = pad.y + 1;
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 30));
  await until(page, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('An elevator!')));
  await page.keyboard.down('Space');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 150));
  await page.keyboard.up('Space');
  const up = await page.evaluate(() => ({ y: window.kidsWorld.game.me.body.y, sticker: Boolean(window.kidsWorld.profile.data.stickers['going-up']) }));
  assert.equal(up.y, low + 7, 'on the pad above');
  assert.ok(up.sticker, 'a sticker for the ride');
  await page.keyboard.down('ShiftLeft');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 150));
  await page.keyboard.up('ShiftLeft');
  assert.equal(await page.evaluate(() => window.kidsWorld.game.me.body.y), low, 'back on the pad below');
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('on a trampoline, Space held bounces you higher and higher and a press of Shift stops you, with a hint and a sticker', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  // A trampoline a few steps away, and you standing on it.
  const pad = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const room = kw.session.link.room;
    const b = kw.game.me.body;
    const x = Math.floor(b.x) + 3;
    const z = Math.floor(b.z);
    const y = room.world.top(x, z) + 1;
    room.natureCell([x, y, z], 92);
    return { x, y, z };
  });
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 92, pad);
  await page.evaluate((c) => Object.assign(window.kidsWorld.game.me.body, { x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5, vx: 0, vy: 0, vz: 0 }), pad);
  const mat = pad.y + 1;
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 30));
  await until(page, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A trampoline!')));
  // A bounce or two short of the sticker, then up and up with Space held for
  // ten seconds, seen every quarter of a second (each step draws a frame,
  // slow on a software GPU).
  await page.evaluate(() => (window.kidsWorld.profile.data.stats.bounces = 17));
  await page.keyboard.down('Space');
  const tops = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const seen = [];
    for (let i = 0; i < 40; i++) {
      kw.step(1 / 60, 15);
      seen.push(kw.game.me.body.y);
    }
    return seen;
  });
  await page.keyboard.up('Space');
  const high = Math.max(...tops) - mat;
  assert.ok(high > 7 && high < 9, `bounced ${high} high`);
  assert.ok(Math.max(...tops.slice(0, 4)) - mat < 4, 'not that high in the first second');
  assert.ok(await page.evaluate(() => Boolean(window.kidsWorld.profile.data.stickers.boing)), 'a sticker for bouncing');
  // Shift pressed on the way up (and let go at once): down on the trampoline
  // at the next bounce, and staying there.
  await page.evaluate(() => {
    const kw = window.kidsWorld;
    for (let i = 0; i < 60 && kw.game.me.body.vy < 3; i++) kw.step(1 / 60, 3);
  });
  await page.keyboard.press('ShiftLeft');
  const end = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const b = kw.game.me.body;
    let down = -1;
    let upAgain = false;
    for (let i = 0; i < 30; i++) {
      kw.step(1 / 60, 8);
      if (down < 0 && b.onGround && b.vy === 0) down = i * 8;
      else if (down >= 0 && !b.onGround) upAgain = true;
    }
    return { down, upAgain, y: b.y, ground: b.onGround };
  });
  // Bouncing by itself, it would take seconds more to stop.
  assert.ok(end.down >= 0 && end.down < 110, `down after ${end.down} frames`);
  assert.deepEqual({ upAgain: end.upAgain, y: end.y, ground: end.ground }, { upAgain: false, y: mat, ground: true });
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a huge circus tent put down from the toy box with a click is walked into through its way in, with a hint, and a night in it is a camp out, with a sticker', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  await page.click('#btn-toybox');
  await clickButton(page, 'Stamps', '#modal');
  await clickButton(page, 'Circus Tent', '#modal');
  await until(page, () => window.kidsWorld.game.tool === 'stamp' && window.kidsWorld.game.stamp === 'circus-tent');
  const { cell, at } = await spotNear(page, 4, 0);
  await page.mouse.click(at.x, at.y);
  // The tent goes away from the camera, its way in where the click was: from
  // there, where its middle is and which way is in.
  const tent = await page.evaluate(async (c) => {
    const { FACING, facingFromYaw } = await import('/js/shared/stamps.js');
    const { f } = FACING[facingFromYaw(window.kidsWorld.renderer.view.yaw)];
    return { x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5, f, mid: { x: c.x + 0.5 + f[0] * 14, z: c.z + 0.5 + f[1] * 14 } };
  }, cell);
  // Its pole, at the bottom.
  await until(page, ({ t, pole }) => window.kidsWorld.game.world.get(Math.floor(t.mid.x), t.y, Math.floor(t.mid.z)) === pole, { t: tent, pole: CANDY_CANE });
  const cloth = await page.evaluate((cloth) => window.kidsWorld.game.world.blocks.filter((id) => cloth[id]).length, [...CLOTH]);
  assert.ok(cloth > 600, `${cloth} blocks of tent cloth`);
  // In front of its porch, walking straight in, past the way in and the benches to the ring.
  await page.evaluate((t) => {
    const kw = window.kidsWorld;
    Object.assign(kw.game.me.body, { x: t.x, y: t.y, z: t.z, vx: 0, vy: 0, vz: 0 });
    kw.renderer.view.yaw = Math.atan2(-t.f[0], -t.f[1]);
    kw.step(1 / 60, 5);
  }, tent);
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 150));
  await page.keyboard.up('KeyW');
  const inside = await page.evaluate((t) => {
    const b = window.kidsWorld.game.me.body;
    return { from: Math.hypot(b.x - t.mid.x, b.z - t.mid.z), on: b.y - t.y, past: (b.x - t.x) * t.f[0] + (b.z - t.z) * t.f[1] };
  }, tent);
  assert.ok(inside.past > 6 && inside.from < 9 && Math.abs(inside.on) < 0.01, `walked in: ${JSON.stringify(inside)}`);
  await until(page, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A tent!')));
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.data.stats.campouts), 0, 'no camp out by day');
  // Night falls: a camp out, once.
  await page.evaluate(() => {
    const room = window.kidsWorld.session.link.room;
    room.settings.day = 'night';
    room.env.time = 0;
    room.broadcast(room.envMessage());
  });
  await until(page, () => window.kidsWorld.profile.data.stickers['camp-out']);
  await until(page, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A camp out!')));
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 60));
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.data.stats.campouts), 1, 'once a night');
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a sofa picked in the toy box\'s Home tab goes down with a click turned to face you, and turned the other way when you look the other way', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  await page.click('#btn-toybox');
  await clickButton(page, 'Home', '#modal');
  await until(page, () => [...document.querySelectorAll('#modal .choice img')].some((i) => i.alt === 'Sofa' && i.src.startsWith('data:image')));
  await clickButton(page, 'Sofa', '#modal');
  const sofa = await page.evaluate(async () => (await import('/js/shared/blocks.js')).SOFA);
  await until(page, (id) => window.kidsWorld.game.selectedBlock() === id, sofa);
  for (const turn of [0, Math.PI / 2]) {
    await page.evaluate((turn) => {
      window.kidsWorld.renderer.view.yaw += turn;
      window.kidsWorld.step(1 / 60, 2);
    }, turn);
    const { cell, at } = await spotNear(page, 3, 0, { bare: true });
    const above = { ...cell, y: cell.y + 1 };
    await page.mouse.click(at.x, at.y);
    await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) !== 0, above);
    const got = await page.evaluate(async (c) => {
      const B = await import('/js/shared/blocks.js');
      const { facingFromYaw } = await import('/js/shared/stamps.js');
      const id = window.kidsWorld.game.world.get(c.x, c.y, c.z);
      return { base: B.baseOf(id), front: B.block(id).front, facing: facingFromYaw(window.kidsWorld.renderer.view.yaw) };
    }, above);
    assert.equal(got.base, sofa);
    assert.equal(got.front, (7 - got.facing) % 4, `facing you: ${JSON.stringify(got)}`);
  }
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.data.stats.furnished), 2);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('beside a sofa the Sit button sits you on it, the island sees you sitting, and walking gets you up; Q lies you down in a bed', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  // A sofa facing you a step in front, a bed further off, and you standing still.
  const at = await page.evaluate(async () => {
    const B = await import('/js/shared/blocks.js');
    const g = window.kidsWorld.game;
    const b = g.me.body;
    const [x, y, z] = [Math.floor(b.x), Math.floor(b.y), Math.floor(b.z)];
    const cells = [];
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = 0; dy < 3; dy++) if (g.world.get(x + dx, y + dy, z + dz) !== 0 && (dx || dz)) cells.push(x + dx, y + dy, z + dz, 0);
    g.edit('pick', cells, { undoable: false });
    g.edit('build', [x, y, z - 1, B.turnedTo(B.SOFA, 1), x + 3, y, z - 3, B.BED, x + 3, y, z - 2, B.BED], { undoable: false });
    Object.assign(b, { x: x + 0.5, z: z + 0.5, vx: 0, vz: 0 });
    window.kidsWorld.step(1 / 60, 10);
    return { x, y, z };
  });
  await until(page, () => !document.getElementById('ride').hidden && document.getElementById('ride').textContent.includes('Sit'));
  await page.click('#ride');
  await until(page, () => window.kidsWorld.game.seat && window.kidsWorld.game.me.anim === 8);
  const sat = await page.evaluate(() => {
    const kw = window.kidsWorld;
    kw.step(1 / 60, 10);
    const b = kw.game.me.body;
    return { y: b.y, yaw: kw.game.me.yaw, button: document.getElementById('ride').textContent };
  });
  assert.ok(sat.y > at.y + 0.4 && sat.y < at.y + 0.6, `on the seat: ${JSON.stringify(sat)}`);
  assert.ok(Math.abs(sat.yaw) < 0.01, 'facing the way the sofa faces');
  assert.ok(sat.button.includes('Get up'));
  // The island (in this page, peer to peer) has you sitting, for friends to see.
  await until(page, () => [...window.kidsWorld.session.link.room.players.values()].some((p) => p.s?.[4] === 8));
  await until(page, () => window.kidsWorld.profile.data.stickers.comfy);
  // A step forward gets you up, in front of the sofa.
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 3));
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 30));
  const up = await page.evaluate(() => ({ seat: window.kidsWorld.game.seat, anim: window.kidsWorld.game.me.anim, y: window.kidsWorld.game.me.body.y }));
  assert.equal(up.seat, null);
  assert.notEqual(up.anim, 8);
  assert.ok(Math.abs(up.y - at.y) < 0.01, `back on the ground: ${JSON.stringify(up)}`);
  // Beside the bed, Q lies you down in it, and Q gets you up again.
  await page.evaluate((c) => {
    const kw = window.kidsWorld;
    Object.assign(kw.game.me.body, { x: c.x + 2.5, y: c.y, z: c.z - 0.5, vx: 0, vz: 0 });
    kw.step(1 / 60, 10);
  }, at);
  await until(page, () => document.getElementById('ride').textContent.includes('Lie down'));
  await page.keyboard.press('KeyQ');
  await until(page, () => window.kidsWorld.game.me.anim === 9);
  await page.keyboard.press('KeyQ');
  await until(page, () => !window.kidsWorld.game.seat);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('coming down from a height thumps and puffs up dust every time, however high it was', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1');
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  // Dropped from heights a little apart, a frame a sixtieth of a second: a
  // fall ends just over the ground (which counts as on it) at the end of a
  // frame as often as not.
  const drops = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const g = kw.game;
    const b = g.me.body;
    const { sound } = g;
    const fx = g.renderer.effects;
    kw.step(1 / 60, 30);
    const ground = b.y;
    const heard = [];
    const play = sound.play;
    const dust = fx.dust;
    sound.play = function (name, ...rest) {
      heard.push(name);
      return play.call(this, name, ...rest);
    };
    fx.dust = function (...args) {
      heard.push('dust');
      return dust.apply(this, args);
    };
    const drops = [];
    try {
      for (let i = 0; i < 24; i++) {
        const h = 1.1 + i * 0.3;
        Object.assign(b, { y: ground + h, vx: 0, vy: 0, vz: 0, onGround: false });
        heard.length = 0;
        kw.step(1 / 60, 90);
        drops.push({ h: h.toFixed(1), thumps: heard.filter((n) => n === 'land').length, puffs: heard.filter((n) => n === 'dust').length, down: b.y === ground });
      }
    } finally {
      sound.play = play;
      fx.dust = dust;
    }
    return drops;
  });
  const odd = drops.filter((d) => d.thumps !== 1 || d.puffs !== 1 || !d.down);
  assert.deepEqual(odd, [], `of ${drops.length} drops`);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('monsters, turned on in Make an island: hearts on screen, one aimed at through leaves and grass but popped only with X from right up close, one with all its hearts only bonked, one taking a heart, and all gone when turned off', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Brave Fox' });
  await clickButton(page, 'Make an island');
  await clickButton(page, 'Flat Land', '#modal');
  await clickSwitch(page, '#modal .switch'); // Friends can visit: off
  await clickSwitch(page, '#modal .switch[aria-label="Monsters"]');
  await clickButton(page, 'Make it', '#modal');
  await inGame(page);
  assert.equal(await page.evaluate(() => window.kidsWorld.session.link.room.settings.monsters), true);
  await until(page, () => !document.getElementById('hearts').hidden && document.querySelectorAll('#hearts span:not(.lost)').length === 5);
  // Cells changed on the island, as the island changes them (as grass grows),
  // and once they have reached the game.
  const change = async (cells) => {
    await page.evaluate((cells) => {
      const room = window.kidsWorld.session.link.room;
      for (let i = 0; i < cells.length; i += 4) room.world.set(cells[i], cells[i + 1], cells[i + 2], cells[i + 3]);
      room.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'nature', cells });
    }, cells);
    await until(page, (cells) => cells.every((v, i) => i % 4 !== 3 || window.kidsWorld.game.world.get(cells[i - 3], cells[i - 2], cells[i - 1]) === v), cells);
  };
  // A clearing out of the safe place round the start (on a random island a
  // tree, a flower or a tuft of grass can be anywhere), with you in it and a
  // monster three steps in front of you, held still (giggling never bumps),
  // and none other coming out. On flat land the ground is under the start.
  const spot = await page.evaluate(() => {
    const room = window.kidsWorld.session.link.room;
    const w = room.world;
    room.monsters.clear();
    room.monsters.spawnAt = Infinity;
    const x = Math.floor(w.spawn.x) + 14;
    const y = Math.floor(w.spawn.y);
    const z = Math.floor(w.spawn.z);
    const cells = [];
    for (let cx = x - 4; cx <= x + 4; cx++) {
      for (let cz = z - 6; cz <= z + 12; cz++) {
        for (let cy = y; cy < y + 12; cy++) if (w.get(cx, cy, cz) !== 0) cells.push(cx, cy, cz, 0);
      }
    }
    return { x, y, z, cells };
  });
  const { x, y, z } = spot;
  await change(spot.cells);
  const id = await page.evaluate(({ x, y, z }) => {
    const kw = window.kidsWorld;
    const room = kw.session.link.room;
    Object.assign(kw.game.me.body, { x: x + 0.5, y, z: z + 0.5, vx: 0, vy: 0, vz: 0 });
    const m = room.monsters.add(room.world, x + 0.5, y, z - 2.5);
    // Held still, and down to its last heart: one tap pops it.
    m.giggle = Infinity;
    m.hearts = 1;
    Object.assign(kw.renderer.view, { yaw: 0, pitch: 0.35, dist: 7 });
    return m.id;
  }, spot);
  await until(page, (id) => window.kidsWorld.game.monsters.has(id), id);
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 120));
  // The camera slipped into a tree crown (leaves where it is), and tufts of
  // grass stand in front of the monster: a tap at it goes through both, as
  // the leaves are drawn see-through and grass never hides a monster.
  const camera = await page.evaluate(() => window.kidsWorld.renderer.camera.position.toArray().map(Math.floor));
  await change([...camera, LEAVES, x, y, z - 2, TALL_GRASS, x, y, z - 1, TALL_GRASS]);
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 10));
  const at = await page.evaluate(async (id) => {
    const kw = window.kidsWorld;
    const g = kw.game;
    const r = kw.renderer;
    const { raycast } = await import('/js/shared/raycast.js');
    const p = g.monsters.get(id).model.group.position;
    const s = r.project(p.x, p.y + 0.4, p.z);
    const rect = r.canvas.getBoundingClientRect();
    const ndc = kw.input.ndc(s.x, s.y);
    const ray = r.ray(ndc.x, ndc.y);
    // Everything the tap passes on its way to the monster.
    const passed = [];
    const o = ray.origin;
    raycast(g.world, o.x, o.y, o.z, ray.dir.x, ray.dir.y, ray.dir.z, o.distanceTo(p), (block, bx, by, bz, start, dist) => {
      if (block) passed.push({ block, dist });
      return false;
    });
    return { x: rect.left + s.x, y: rect.top + s.y, passed, aim: g.aim(ndc) };
  }, id);
  assert.equal(at.passed[0]?.dist, 0, 'the camera is in the leaves');
  assert.ok(at.passed.some((c) => c.block === TALL_GRASS), `the grass is in the way: ${JSON.stringify(at.passed)}`);
  assert.deepEqual(at.aim, { kind: 'monster', id });
  // A click at it bops nothing: it says how bopping works (with 👊 on a touch screen, as a CI
  // machine with no mouse is).
  await page.mouse.click(at.x, at.y);
  await until(page, () => document.body.textContent.includes(`press ${window.kidsWorld.game.touch ? '👊' : 'X'} to bop it`));
  // X, facing it from three steps off, is a swing at nothing: it is out of reach.
  await page.evaluate(() => (window.kidsWorld.game.me.yaw = Math.PI));
  await page.keyboard.press('KeyX');
  await until(page, () => document.body.textContent.includes('Walk right up to a monster and face it'));
  assert.equal(await page.evaluate((id) => window.kidsWorld.session.link.room.monsters.get(id)?.hearts, id), 1, 'too far to bop');
  // Right up to it, X pops it.
  await page.evaluate(({ x, y, z }) => {
    const g = window.kidsWorld.game;
    Object.assign(g.me.body, { x: x + 0.5, y, z: z - 1, vx: 0, vy: 0, vz: 0 });
    g.me.yaw = Math.PI;
    g.sendMove(true);
  }, spot);
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 10));
  // (Not before the last swing is over and its bop has had its moment.)
  await until(page, () => window.kidsWorld.game.attackReady());
  await page.keyboard.press('KeyX');
  await until(page, (id) => !window.kidsWorld.session.link.room.monsters.get(id) && !window.kidsWorld.game.monsters.has(id), id);
  assert.equal(await page.evaluate(() => window.kidsWorld.profile.data.stats.popped), 1);
  // One with all its hearts: a bop takes one, and says how many more it takes.
  const full = await page.evaluate(({ x, y, z }) => {
    const room = window.kidsWorld.session.link.room;
    const m = room.monsters.add(room.world, x + 0.5, y, z - 2.5);
    m.giggle = Infinity;
    return m.id;
  }, spot);
  await until(page, (id) => window.kidsWorld.game.monsters.has(id), full);
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 30));
  await page.evaluate(() => (window.kidsWorld.game.me.yaw = Math.PI));
  await until(page, () => window.kidsWorld.game.attackReady());
  await page.keyboard.press('KeyX');
  await until(page, (id) => window.kidsWorld.session.link.room.monsters.get(id)?.hearts === 2 && document.body.textContent.includes('2 more bops'), full);
  // On a touch screen the 👊 button is there while a monster is about, and does the same (once
  // the monster, knocked back, is in reach again).
  await page.evaluate(
    ({ id, x, y, z }) => Object.assign(window.kidsWorld.session.link.room.monsters.get(id).body, { x: x + 0.5, y, z: z - 2.5, vx: 0, vy: 0, vz: 0 }),
    { id: full, ...spot },
  );
  await until(page, ({ id, z }) => Math.abs(window.kidsWorld.game.monsters.get(id).model.group.position.z - (z - 2.5)) < 0.05, { id: full, z: spot.z });
  const wasTouch = await page.evaluate(() => {
    const was = document.body.classList.contains('touch');
    document.body.classList.add('touch');
    return was;
  });
  await until(page, () => !document.getElementById('btn-attack').hidden && document.getElementById('btn-attack').offsetWidth > 0);
  await until(page, () => window.kidsWorld.game.attackReady());
  await page.click('#btn-attack');
  await until(page, (id) => window.kidsWorld.session.link.room.monsters.get(id)?.hearts === 1, full);
  await page.evaluate((wasTouch) => document.body.classList.toggle('touch', wasTouch), wasTouch);
  await page.evaluate((id) => window.kidsWorld.session.link.room.monsters.remove(id), full);
  // One right beside you takes a heart, and knocks you back.
  const from = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const b = kw.game.me.body;
    kw.session.link.room.monsters.add(kw.session.link.room.world, b.x, b.y, b.z - 0.5);
    return { x: b.x, z: b.z };
  });
  await until(page, () => window.kidsWorld.game.hearts === 4 && document.querySelectorAll('#hearts .lost').length === 1);
  await page.evaluate(() => window.kidsWorld.step(1 / 60, 30));
  const pushed = await page.evaluate((from) => Math.hypot(window.kidsWorld.game.me.body.x - from.x, window.kidsWorld.game.me.body.z - from.z), from);
  assert.ok(pushed > 0.8, `knocked back ${pushed.toFixed(2)}`);
  // Off in Settings: no monsters, no hearts.
  await page.click('#btn-settings');
  await clickSwitch(page, '#modal .switch[aria-label="👾 Monsters"]');
  await until(page, () => document.getElementById('hearts').hidden && window.kidsWorld.game.monsters.size === 0 && !window.kidsWorld.session.link.room.settings.monsters);
  assert.equal(await page.evaluate(() => window.kidsWorld.game.hearts), 5);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('the little map shows the island and what you build; it opens the big map and can be switched off', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Clever Duck' });
  await makeIsland(page, { online: false });
  // A pixel of a map canvas, at a fraction of the way across and down.
  const pixel = (selector, fx, fy) =>
    page.evaluate(
      (selector, fx, fy) => {
        const c = document.querySelector(selector);
        return c.width ? [...c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data] : null;
      },
      selector,
      fx,
      fy,
    );
  const isSea = (p) => p && p[2] > p[0] + 60 && p[3] === 255;
  // The whole island fits on either map, so their corners are open sea; but a
  // dolphin's dot or the whale's picture can be anywhere out there. This is a
  // corner with no animal near it, as fractions of the way across and down.
  const seaCorner = (inset) =>
    page.evaluate((inset) => {
      const g = window.kidsWorld.game;
      const clear = ([fx, fy]) => [...g.critters.values()].every((c) => Math.hypot(c.model.group.position.x - fx * g.world.W, c.model.group.position.z - fy * g.world.D) > 8);
      return [[inset, inset], [1 - inset, inset], [inset, 1 - inset], [1 - inset, 1 - inset]].find(clear);
    }, inset);
  // A canvas starts out a blank 300 by 150, so having a width says nothing; the
  // map makes it square when it first draws, on the game's first frame.
  await until(page, () => {
    const c = document.querySelector('#minimap canvas');
    return c.width === c.height;
  });
  assert.ok(isSea(await pixel('#minimap canvas', ...(await seaCorner(0.02)))), 'the corners of the little map are sea');
  // A real pointer reaches it: nothing is on top of it.
  const center = await page.evaluate(() => {
    const b = document.getElementById('minimap').getBoundingClientRect();
    const x = b.left + b.width / 2;
    const y = b.top + b.height / 2;
    return { x, y, reachable: document.elementFromPoint(x, y)?.closest('#minimap') !== null };
  });
  assert.ok(center.reachable, 'nothing covers the little map');

  // A red brick (slot 6) built with a real click turns its spot on the map red.
  await page.keyboard.press('Digit6');
  const { cell, at } = await spotNear(page, 3, 1);
  await page.mouse.click(at.x, at.y);
  await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y + 1, c.z) === 30, cell);
  await until(
    page,
    (c) => {
      const [r, g, b] = window.kidsWorld.ui.minimap.picture.getContext('2d').getImageData(c.x, c.z, 1, 1).data;
      return r > g + 60 && r > b + 60;
    },
    cell,
  );

  // Clicking the little map opens the big one, drawn at once; Escape closes it.
  await page.mouse.click(center.x, center.y);
  await until(page, () => document.querySelector('#modal:not([hidden]) .big-map')?.width > 0);
  assert.ok(isSea(await pixel('#modal .big-map', ...(await seaCorner(0.01)))), 'the big map is drawn');
  await page.keyboard.press('Escape');
  await until(page, () => document.getElementById('modal').hidden && window.kidsWorld.ui.minimap.big === null);

  // Settings switches it off, and on again; the choice is kept.
  await page.click('#btn-settings');
  const toggle = '#modal .switch[aria-label$="Little map"]';
  await clickSwitch(page, toggle);
  await until(page, () => document.getElementById('minimap').hidden && window.kidsWorld.profile.settings.map === false);
  await clickSwitch(page, toggle);
  await until(page, () => !document.getElementById('minimap').hidden && window.kidsWorld.profile.settings.map === true);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('the little map and the hotbar fit beside every other button, on screens of every shape', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Tidy Fox' });
  await makeIsland(page, { online: false });
  await hideRideButton(page);
  // The bop button is shown or hidden by the test (on touch screens it shows while a monster is about).
  await page.evaluate(() => (window.kidsWorld.ui.attackButton = () => {}));
  // 768×1024 and 375×500 are exactly 3:4, as most iPads held upright are: upright, with the touch
  // buttons above the hotbar. The shortest upright screens have no room for the map. 1366×1024 is
  // sideways and wide enough for the whole hotbar between the thumbstick and the jump buttons.
  // 800×600 and 880×600 are too short for the column of tools beside a hotbar that wide. On touch
  // screens, 1133×744 (an iPad mini held sideways) and 1280×700 are too short for it above the
  // thumbstick, and 1000×561 for the talk buttons, halfway down the right side, above the touch buttons.
  // Narrower, 760×640 and 720×600 are too short for the column of smaller tools above the thumbstick,
  // and at 560×640 the little map shrinks to stay clear of the row they go in instead.
  // Each screen is seen with an empty basket and with a full one, which wraps over the hotbar
  // (in one row on the shortest upright screens): upright, the buttons rise above it, and so do the
  // talk buttons on computer screens that are narrow but neither short nor upright, like 700×800.
  // On narrow screens held sideways under 400 px tall it keeps to one row too, level with the
  // thumbstick and the jump buttons: the treasures it scrolls out of sight reach under them, but
  // are not drawn there.
  // Chat lines stand on all that too, between the buttons: on the shortest screens only the
  // newest fits, and from 600 px tall all five that the chat log keeps.
  const screens = [
    [1280, 800, false],
    [1000, 600, false],
    [880, 600, false],
    [800, 600, false],
    [720, 480, false],
    [700, 800, false],
    [1366, 1024, true],
    [1024, 768, true],
    [1133, 744, true],
    [1280, 700, true],
    [1000, 561, true],
    [760, 640, true],
    [720, 600, true],
    [560, 640, true],
    [768, 1024, true],
    [390, 844, true],
    [360, 740, true],
    [844, 390, true],
    [375, 548, true],
    [375, 500, true, false],
    [320, 460, true, false],
    [568, 320, true],
    [640, 360, true],
  ];
  for (const [width, height, touch, map = true] of screens) {
    await page.setViewport({ width, height });
    for (const [full, bop] of [[false, false], [true, false], [false, true], [true, true]]) {
      await page.evaluate((bop) => (document.getElementById('btn-attack').hidden = !bop), bop);
      await basketAndTouch(page, full, touch);
      const seen = await page.evaluate((touch) => {
        const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const m = document.getElementById('minimap').getBoundingClientRect();
        const covered = [];
        for (const el of document.querySelectorAll('#hud button, #hud .island-badge, #toolopts > *, #joystick')) {
          if (el.closest('#minimap')) continue;
          const r = el.getBoundingClientRect();
          if (r.width && r.height && meets(r, m)) covered.push(el.id || el.className);
        }
        // The tools, the talk buttons, the touch buttons and the thumbstick keep clear of each other.
        // Each of the first three takes a touch anywhere in its box, gaps included, so where two boxes
        // meet, the one later in the page takes the other's touches; the thumbstick's ring is drawn
        // over them, and a thumb on it there gets the box under it instead.
        const boxes = ['toolbar', 'talk', 'touch-buttons', 'joystick'].map((id) => [id, document.getElementById(id).getBoundingClientRect()]).filter(([, r]) => r.width);
        const crowded = [];
        for (const [i, [a, ra]] of boxes.entries()) {
          for (const [b, rb] of boxes.slice(i + 1)) if (meets(ra, rb)) crowded.push(`${a} and ${b}`);
        }
        // Every kind of treasure shows in the basket, and nothing lies over any of them, where they
        // show: a basket that scrolls cuts off what is out of sight at its edges.
        const pills = [...document.querySelectorAll('#basket button')];
        const kinds = Object.keys(window.kidsWorld.profile.basket).length;
        const basket = document.getElementById('basket').getBoundingClientRect();
        const shown = (r) => ({ left: Math.max(r.left, basket.left), right: Math.min(r.right, basket.right), top: Math.max(r.top, basket.top), bottom: Math.min(r.bottom, basket.bottom) });
        const treasures = [];
        for (const el of document.querySelectorAll('#hud button, #joystick')) {
          if (el.closest('#basket')) continue;
          const r = el.getBoundingClientRect();
          for (const pill of pills) {
            const p = shown(pill.getBoundingClientRect());
            if (r.width && p.left < p.right && p.top < p.bottom && meets(r, p)) treasures.push(`${el.id || el.className} on ${pill.title.split(':')[0]}`);
          }
        }
        const talk = [...document.querySelectorAll('#talk button')].map((b) => [b.offsetWidth, b.offsetHeight]);
        const want = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--talk'));
        const thumbs = [...document.querySelectorAll('#touch-buttons button:not([hidden])')].map((b) => [b.offsetWidth, b.offsetHeight]);
        const thumb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--touch'));
        const whole = [document.body.offsetWidth, document.body.offsetHeight, getComputedStyle(document.body).opacity];
        // The hotbar makes room for the thumbstick and the jump buttons only where they are level
        // with it, as on screens held sideways, and there it stays clear of them. Without them it
        // is as wide as it gets: it shows whole, or it spans the screen to 10 px from either edge.
        const row = () => document.querySelector('#bottom .hotrow').getBoundingClientRect();
        document.body.classList.remove('touch');
        const free = row().width;
        document.body.classList.toggle('touch', touch);
        const hot = row();
        const level = [...document.querySelectorAll('#hud button, #joystick')]
          .filter((el) => !el.closest('#bottom'))
          .map((el) => [el.id || el.className, el.getBoundingClientRect()])
          .filter(([, r]) => r.width && r.top < hot.bottom && r.bottom > hot.top);
        const bar = document.getElementById('hotbar');
        const scrolls = bar.scrollWidth > bar.clientWidth;
        const edges = [hot.left, innerWidth - hot.right].map(Math.round);
        const hotbar = {
          width: Math.round(hot.width),
          level: level.map(([name]) => name),
          clear: level.every(([, r]) => r.right <= hot.left || r.left >= hot.right),
          squeezed: !level.length && hot.width < free - 0.5,
          scrolls,
          edges,
          cut: !level.length && scrolls && Math.max(...edges) > 10,
        };
        return {
          covered,
          crowded,
          pills: pills.length,
          kinds,
          treasures,
          talk,
          want,
          thumbs,
          thumb,
          whole,
          hotbar,
          size: m.width,
          inside: m.left >= 0 && m.top >= 0 && m.right <= innerWidth && m.bottom <= innerHeight,
        };
      }, touch);
      const where = `${width}×${height}${touch ? ' touch' : ''}${full ? ' with a full basket' : ''}${bop ? ' and the bop button' : ''}`;
      assert.equal(seen.pills, full ? seen.kinds : 0, `on ${where} the basket shows every kind of treasure in it`);
      assert.deepEqual(seen.treasures, [], `on ${where} neither a button nor the thumbstick covers a treasure in the basket`);
      assert.deepEqual(seen.covered, [], `on ${where} the map is clear of the other buttons`);
      assert.deepEqual(seen.crowded, [], `on ${where} the tools, the talk buttons, the touch buttons and the thumbstick are clear of each other`);
      // The map's place beside the talk buttons is worked out from --talk.
      assert.deepEqual(seen.talk, [[seen.want, seen.want], [seen.want, seen.want]], `on ${where} the talk buttons are --talk across, as the map's place assumes`);
      if (touch) {
        assert.deepEqual(seen.thumbs, [...(bop ? [[seen.thumb, seen.thumb]] : []), [seen.thumb, seen.thumb], [seen.thumb, seen.thumb], [78, 78]], `on ${where} bop, go down and fly are --touch across, and jump 78 px`);
      }
      // <body> has a touch class too, on touch screens, but it is no touch button.
      assert.deepEqual(seen.whole, [width, height, '1'], `on ${where} the page is the whole screen, not see-through`);
      if (map) assert.ok(seen.inside && seen.size >= 90, `on ${where} the whole map is on screen: ${JSON.stringify(seen)}`);
      else assert.equal(seen.size, 0, `on ${where} there is no room for the map`);
      assert.deepEqual(seen.hotbar, { ...seen.hotbar, clear: true, squeezed: false, cut: false }, `on ${where} the hotbar is narrower only beside buttons level with it, and clear of them; elsewhere it shows whole or spans the screen`);
      const chat = await chatLines(page);
      assert.deepEqual(chat.under, [], `on ${where} no chat line lies over a button, the tool options or the thumbstick`);
      assert.ok(chat.onScreen && chat.shown >= (height >= 600 ? 5 : 1), `on ${where} the newest chat lines show, as many as fit: ${JSON.stringify(chat)}`);
    }
  }
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('every tool fits across an upright phone, and the row below still lines up with it', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Neat Hen' });
  await makeIsland(page, { online: false });
  for (const [width, height] of [[320, 568], [320, 460], [360, 640], [375, 667], [375, 548], [390, 844], [430, 932]]) {
    await page.setViewport({ width, height });
    const seen = await page.evaluate(() => {
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      const bar = box('#toolbar');
      const tools = [...document.querySelectorAll('#toolbar .tool')].map((t) => t.getBoundingClientRect());
      return {
        edges: [bar.left, innerWidth - bar.right],
        smallest: Math.min(...tools.map((t) => Math.min(t.width, t.height))),
        below: [box('#toolopts').top - bar.bottom, box('#talk').top - bar.bottom],
      };
    });
    const where = `${width}×${height}: ${JSON.stringify(seen)}`;
    assert.ok(Math.min(...seen.edges) >= 0, `on ${where} the whole row is on screen`);
    assert.ok(seen.smallest >= 40, `on ${where} the tools are still big enough to tap`);
    assert.deepEqual(seen.below, [12, 12], `on ${where} the tool's options and the talk buttons sit just below the row`);
  }
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('choosing how you look, you can see yourself beside the dialog or above it, on the title and in a game', { skip }, async () => {
  // A bunny: the ears make it the tallest look there is.
  const page = await openPlayer(base + '?p2p=1', { name: 'Proud Bunny', look: { animal: 'bunny', fur: 'pink', shirt: 1, hat: 'party' } });
  // Where all of you is on screen once the camera has turned to you, the dialog, and whether anything else shows.
  const look = () =>
    page.evaluate(async () => {
      const THREE = await import('./vendor/three.module.js');
      const kw = window.kidsWorld;
      kw.step(1 / 60, 90);
      const r = kw.renderer;
      const avatar = kw.game ? kw.game.players.get(kw.game.pid).avatar : r.avatars.get(-1);
      const box = new THREE.Box3().setFromObject(avatar.root);
      const xs = [];
      const ys = [];
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const p = r.project(x, y, z);
            xs.push(Math.round(p.x));
            ys.push(Math.round(p.y));
          }
        }
      }
      // Layout boxes: the dialog may still be popping in.
      const panel = document.querySelector('#modal .panel');
      const shows = (id) => !document.getElementById(id).hidden && getComputedStyle(document.getElementById(id)).visibility === 'visible';
      return {
        me: { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) },
        panel: { right: panel.offsetLeft + panel.offsetWidth, top: panel.offsetTop },
        screen: { width: innerWidth, height: innerHeight },
        others: shows('title') || shows('hud'),
      };
    });
  const onScreen = ({ me, screen }) => me.left >= 0 && me.top >= 0 && me.right <= screen.width && me.bottom <= screen.height;
  const above = async (where) => {
    const seen = await look();
    assert.ok(onScreen(seen) && seen.me.bottom <= seen.panel.top, `${where}: all of you is above the dialog: ${JSON.stringify(seen)}`);
    assert.equal(seen.others, false, `${where}: the title and the buttons make way`);
  };
  const beside = async (where) => {
    const seen = await look();
    assert.ok(onScreen(seen) && seen.me.left >= seen.panel.right, `${where}: all of you is beside the dialog: ${JSON.stringify(seen)}`);
    assert.equal(seen.others, true, `${where}: the title and the buttons stay`);
  };
  const done = async (where) => {
    await clickButton(page, 'Done', '#modal');
    const after = await page.evaluate(() => {
      const kw = window.kidsWorld;
      kw.step(1 / 60, 90);
      return { lens: kw.renderer.camera.view?.enabled ?? false, lift: kw.renderer.view.lift, posing: document.body.classList.contains('posing'), portrait: kw.game?.portrait ?? null };
    });
    assert.deepEqual(after, { lens: false, lift: 0, posing: false, portrait: null }, `${where}: the camera is back`);
  };
  // The new size reaches the game with the resize event, before the next frame.
  const resize = async (width, height) => {
    await page.setViewport({ width, height });
    await until(page, () => Math.abs(window.kidsWorld.renderer.camera.aspect - innerWidth / innerHeight) < 1e-6);
  };
  const open = async (inGame) => {
    if (inGame) {
      await page.click('#btn-settings');
      await clickButton(page, 'Change me', '#modal');
    } else {
      await clickButton(page, 'Change me');
    }
  };
  for (const inGame of [false, true]) {
    const where = inGame ? 'in a game' : 'on the title';
    // Open ground, so that nothing pulls the camera in.
    if (inGame) await makeIsland(page, { online: false, theme: 'Flat Land' });
    await resize(390, 844);
    await open(inGame);
    await above(`${where}, on an upright phone`);
    await resize(844, 390);
    await above(`${where}, on a phone turned round meanwhile`);
    await done(`${where}, on a phone`);
    await resize(1000, 600);
    await open(inGame);
    await beside(`${where}, on a wide screen`);
    await done(`${where}, on a wide screen`);
  }
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test("every tool's options stay clear of the buttons and the map beside them, and the island around them still takes a touch", { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Busy Mole' });
  await makeIsland(page, { online: false });
  // Hills shows two groups of options, which are too wide for one row beside the talk buttons on a phone held upright.
  // Sideways, the options are under the row of tools, and a full basket, between the thumbstick
  // and the jump buttons, is narrow: at 568×320 it would wrap up into Hills' options. So they are
  // on narrow touch screens too short for the column of tools above the thumbstick, such as 760×640,
  // 720×600 and 560×640, beside the little map.
  const screens = [
    [320, 568, true],
    [320, 460, true],
    [360, 640, true],
    [375, 667, true],
    [375, 548, true],
    [390, 844, true],
    [430, 932, true],
    [768, 1024, true],
    [568, 320, true],
    [640, 360, true],
    [844, 390, true],
    [760, 640, true],
    [720, 600, true],
    [560, 640, true],
    [800, 600, false],
    [1280, 800, false],
  ];
  for (const [width, height, touch] of screens) {
    await page.setViewport({ width, height });
    // A full basket lifts the touch buttons and the thumbstick on upright screens, towards the options.
    for (const full of [false, true]) {
      await basketAndTouch(page, full, touch);
      for (const tool of ['build', 'pick', 'paint', 'hills', 'stamp', 'friends']) {
        const seen = await page.evaluate(
          (tool) => {
            window.kidsWorld.game.setTool(tool);
            const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const others = [...document.querySelectorAll('#talk button, #minimap, #touch-buttons button, #joystick, #basket')].map((el) => el.getBoundingClientRect()).filter((r) => r.width);
            const pills = [...document.querySelectorAll('#toolopts .pill')];
            const last = document.getElementById('toolopts').lastElementChild.getBoundingClientRect();
            return {
              pills: pills.length,
              covered: pills.filter((p) => others.some((r) => meets(p.getBoundingClientRect(), r))).map((p) => p.title),
              // A finger on the middle of each one gets it, and it is all on screen.
              blocked: pills
                .filter((p) => {
                  const r = p.getBoundingClientRect();
                  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.pill');
                  return hit !== p || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight;
                })
                .map((p) => p.title),
              // Just past them is the island, not the box they sit in.
              beside: document.elementFromPoint(last.right + 4, last.top + last.height / 2)?.id,
            };
          },
          tool,
        );
        const where = `${width}×${height} with ${tool}${full ? ' and a full basket' : ''}: ${JSON.stringify(seen)}`;
        assert.ok(seen.pills > 0, `on ${where} the tool has options`);
        assert.deepEqual(seen.covered, [], `on ${where} no option is under the talk buttons, the map, the touch buttons, the thumbstick or the basket`);
        assert.deepEqual(seen.blocked, [], `on ${where} every option can be tapped`);
        assert.equal(seen.beside, 'world', `on ${where} a touch beside the options reaches the island`);
      }
    }
  }
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('a dialog opened from beside "Change me" takes its place and puts the camera back, on the title and in a game', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Busy Beaver' });
  // Wide: the title and the buttons stay beside the dialog, where a click reaches them.
  await page.setViewport({ width: 1280, height: 800 });
  await until(page, () => Math.abs(window.kidsWorld.renderer.camera.aspect - innerWidth / innerHeight) < 1e-6);
  // Whether the camera is turned to you: on a wide screen it moves you over beside the dialog.
  const camera = () =>
    page.evaluate(() => {
      const kw = window.kidsWorld;
      kw.step(1 / 60, 10);
      return { shift: kw.renderer.view.shift, posing: document.body.classList.contains('posing'), portrait: Boolean(kw.game?.portrait) };
    });
  const back = { shift: 0, posing: false, portrait: false };
  const showing = (heading) => until(page, (heading) => !document.getElementById('modal').hidden && document.querySelector('#modal h2').textContent.includes(heading), heading);

  // On the title, My islands...
  await clickButton(page, 'Change me');
  assert.deepEqual(await camera(), { shift: 1.1, posing: true, portrait: false }, 'on the title, the camera turns to you');
  await clickBeside(page, '#btn-mine');
  await showing('My islands');
  assert.deepEqual(await camera(), back, 'on the title, the camera is back');
  await page.keyboard.press('Escape');

  // ...in a game (with Change me opened from Settings), How to play from the top bar...
  await makeIsland(page, { online: false, theme: 'Flat Land' });
  const changeMe = async () => {
    await page.click('#btn-settings');
    await clickButton(page, 'Change me', '#modal');
    assert.deepEqual(await camera(), { shift: 1.1, posing: true, portrait: true }, 'in a game, the camera turns to you');
  };
  await changeMe();
  await clickBeside(page, '#btn-help-hud');
  await showing('How to play');
  assert.deepEqual(await camera(), back, 'in a game, the camera is back');
  await page.keyboard.press('Escape');
  assert.deepEqual(await camera(), back, 'in a game, the camera stays back once How to play is closed');

  // ...and the big map, from the little one: drawn, and let go when it is closed.
  await changeMe();
  await clickBeside(page, '#minimap');
  await until(page, () => {
    const c = document.querySelector('#modal:not([hidden]) .big-map');
    return c && c.width === c.height && window.kidsWorld.ui.minimap.big === c;
  });
  assert.deepEqual(await camera(), back, 'in a game, the camera is back with the big map');
  // Opened again over itself, the old big map is let go before the new one is made, so the new one is drawn.
  const redrawn = await page.evaluate(() => {
    const ui = window.kidsWorld.ui;
    const old = ui.minimap.big;
    ui.mapDialog();
    const canvas = document.querySelector('#modal .big-map');
    return canvas !== old && ui.minimap.big === canvas && canvas.width === canvas.height;
  });
  assert.ok(redrawn, 'the big map opened again is drawn');
  await page.keyboard.press('Escape');
  await until(page, () => document.getElementById('modal').hidden && window.kidsWorld.ui.minimap.big === null);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('full screen from the title, the top bar and Settings; iPhones are shown the Home Screen', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Tiny Owl' });
  const isFull = () => document.fullscreenElement === document.documentElement && document.body.classList.contains('fullscreen');
  await page.bringToFront();
  await page.click('#btn-fullscreen');
  await until(page, isFull);
  assert.equal(await page.$eval('#btn-fullscreen', (b) => b.getAttribute('aria-pressed')), 'true');
  await page.click('#btn-fullscreen');
  await until(page, () => !document.fullscreenElement && !document.body.classList.contains('fullscreen'));
  await makeIsland(page, { online: false });
  await page.click('#btn-fullscreen-hud');
  await until(page, isFull);
  // The switch in Settings shows it is on, and turns it off.
  await page.click('#btn-settings');
  await until(page, () => document.querySelector('#modal .fullscreen-switch')?.getAttribute('aria-checked') === 'true');
  await clickSwitch(page, '#modal .fullscreen-switch');
  await until(page, () => !document.fullscreenElement && document.querySelector('#modal .fullscreen-switch').getAttribute('aria-checked') === 'false');
  await page.browserContext().close();

  // Safari on an iPhone cannot make a page full screen: the button explains the Home Screen instead.
  const phone = await openPlayer(base + '?p2p=1', { name: 'Kind Seal' }, () => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Navigator.prototype, 'standalone', { get: () => false });
  });
  await phone.bringToFront();
  await phone.click('#btn-fullscreen');
  await until(phone, () => document.getElementById('modal-body').textContent.includes('Add to Home Screen'));
  assert.equal(await phone.evaluate(() => document.fullscreenElement), null);
  assert.deepEqual(pageErrors, []);
  await phone.browserContext().close();
});

test('the whole island code shows beside the top buttons, and a long connection message beside or under them', { skip }, async () => {
  const page = await openPlayer(base, { name: 'Tiny Owl' });
  await makeIsland(page, { online: true });
  await hideRideButton(page);
  const messages = [
    ['reconnecting', 'Lost the island for a moment. Reconnecting…'],
    ['failed', 'Friends cannot visit right now (the connection helper did not load). You can still play alone.'],
  ];
  // Phones held upright or sideways have no room for the message in the top bar; a computer does.
  // On the shortest upright touch screen, with Hills picked, the longest message still reaches
  // the top of the thumbstick's ring: there it may cover the thumbstick, drawn over it. 1000×600
  // is too short for the column of tools under the top bar. A full basket lifts the touch buttons
  // and the thumbstick towards the message on upright touch screens, and the shortest have the
  // least room for that. Held sideways, the message goes under the tool options on a phone; under
  // 400 px tall the basket keeps to one row below it, and the thumbstick, drawn under the message
  // there, may reach up into it (at 568×320 even the short one does). On narrow touch screens too
  // short for the column of tools above the thumbstick, such as 760×640, 720×600 and 560×640, it
  // goes under the options too; without touch it stays beside the column. Chat lines keep clear of
  // the message: on the shortest screens it leaves them little room, or none.
  for (const [width, height, inTopBar, coverable = [], full = false] of [
    [320, 460, false, ['joystick']],
    [320, 460, false, ['joystick'], true],
    [375, 500, false, [], true],
    [320, 568, false],
    [360, 640, false],
    [568, 320, false, ['joystick']],
    [568, 320, false, ['joystick'], true],
    [640, 360, false, ['joystick'], true],
    [720, 480, false],
    [760, 640, false],
    [720, 600, false],
    [720, 600, false, [], true],
    [560, 640, false, [], true],
    [1000, 600, true],
    [1280, 800, true],
  ]) {
    await page.setViewport({ width, height });
    // With one row of tool options, and with the two groups Hills has.
    for (const [state, text, tool] of ['build', 'hills'].flatMap((tool) => messages.map((m) => [...m, tool]))) {
      const layout = await page.evaluate(
        async (state, text, tool, full) => {
          const kw = window.kidsWorld;
          const $ = (id) => document.getElementById(id);
          const box = (el) => el.getBoundingClientRect();
          kw.game.setTool(tool);
          for (const key of Object.keys(kw.profile.basket)) kw.profile.addToBasket(key, full ? 999 : -999);
          const show = (state, text) => {
            kw.ui.setStatus(state, text);
            // The widest code, and a clock with two emoji: sunrise and rain.
            $('island-code').textContent = 'Code 000 000';
            kw.game.env.time = 0.28;
            kw.game.env.weather = 'rain';
            kw.ui.frame();
          };
          const measure = () => {
            const code = $('island-code');
            // A fraction of a pixel too little is enough for an ellipsis, and scrollWidth rounds it away.
            const text = document.createRange();
            text.selectNodeContents(code);
            const buttons = [...document.querySelectorAll('#topbar .round')].filter((b) => b.offsetParent).map(box);
            return {
              code: text.getBoundingClientRect().width <= box(code).width,
              badge: box($('island-badge')).width,
              round: buttons.every((b) => b.width === b.height),
              onScreen: buttons.every((b) => b.right <= innerWidth),
              clearOfTools: box($('topbar')).bottom <= box($('toolbar')).top,
            };
          };
          show('online', 'Friends can visit with the code');
          const calm = measure();
          show(state, text);
          const busy = measure();
          // A toast while the message is up: the toasts make room for it once its size is known.
          $('toasts').replaceChildren();
          kw.ui.toast('🌱', 'Tap the ground to plant a tree, or tap an animal to give it one!');
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          const status = $('status');
          const s = box(status);
          const bar = box($('topbar'));
          const toasts = box($('toasts'));
          // Everything else on the screen; a toast still sliding in counts where it lands.
          const covered = [...document.querySelectorAll('#hud button, #toolbar, #toolopts > *, #joystick, .toast')]
            .map((el) => {
              if (!el.classList.contains('toast')) return [el, box(el)];
              const left = toasts.left + el.offsetLeft;
              const top = toasts.top + el.offsetTop;
              return [el, { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight, width: el.offsetWidth }];
            })
            .filter(([, r]) => r.width && r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top);
          // Whether it is drawn under the message: both let taps through to the island, so for a
          // moment they take them, for a hit test in the middle of where they meet.
          const underMessage = ([el, r]) => {
            const x = (Math.max(r.left, s.left) + Math.min(r.right, s.right)) / 2;
            const y = (Math.max(r.top, s.top) + Math.min(r.bottom, s.bottom)) / 2;
            status.style.pointerEvents = el.style.pointerEvents = 'auto';
            const hit = document.elementFromPoint(x, y);
            status.style.pointerEvents = el.style.pointerEvents = '';
            return status.contains(hit);
          };
          // A treasure in the basket goes by its name.
          const name = ([el]) => el.id || el.className || el.title.split(':')[0];
          return {
            calm,
            busy,
            message: {
              whole: status.scrollWidth <= status.clientWidth && status.scrollHeight <= status.clientHeight,
              inTopBar: s.top >= bar.top && s.bottom <= bar.bottom,
              onScreen: s.left >= 0 && s.top >= 0 && s.right <= innerWidth && s.bottom <= innerHeight,
              covered: covered.map(name),
              under: covered.filter(underMessage).map(name),
            },
          };
        },
        state,
        text,
        tool,
        full,
      );
      const where = `${width}×${height}, ${state}, ${tool}${full ? ', a full basket' : ''}`;
      assert.deepEqual(layout.calm, { ...layout.calm, code: true, round: true, onScreen: true, clearOfTools: true }, where);
      assert.deepEqual(layout.busy, layout.calm, `${where}: the island's badge and the buttons stay as they were`);
      const { under, ...message } = layout.message;
      const covered = message.covered.filter((el) => !(coverable.includes(el) && under.includes(el)));
      assert.deepEqual({ ...message, covered }, { whole: true, inTopBar, onScreen: true, covered: [] }, `${where}: the whole message, clear of everything`);
      const chat = await chatLines(page);
      assert.deepEqual(chat.under, [], `${where}: no chat line lies over the message, a button, the tool options or the thumbstick`);
      assert.ok(chat.onScreen, `${where}: the chat lines are on screen`);
    }
  }
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

// Turns the camera until a tap on a player's pet (pid) would pet it, and
// returns where to tap; null if no view of it does.
function petOnScreen(page, pid) {
  return page.evaluate((pid) => {
    const kw = window.kidsWorld;
    const r = kw.renderer;
    const g = kw.game;
    for (let k = 0; k < 24; k++) {
      r.view.yaw = (k * Math.PI) / 6;
      r.view.pitch = k < 12 ? 0.5 : 0.85;
      r.view.dist = 4;
      kw.step(1 / 60, 30);
      const m = r.pets.get(pid);
      if (!m) return null;
      const p = m.group.position;
      const s = r.project(p.x, p.y + m.center, p.z);
      const rect = r.canvas.getBoundingClientRect();
      const aim = g.aim({ x: (s.x / rect.width) * 2 - 1, y: -(s.y / rect.height) * 2 + 1 });
      const clear = document.elementFromPoint(rect.left + s.x, rect.top + s.y) === r.canvas;
      if (s.visible && clear && aim?.kind === 'pet' && aim.pid === pid) return { x: rect.left + s.x, y: rect.top + s.y };
    }
    return null;
  }, pid);
}

test('a pet picked in My pet comes along: it follows you and sits by you, is petted with a click, joins in when you wave, and a friend sees it and pets it too', { skip }, async () => {
  const a = await openPlayer(base, { name: 'Kind Owl', look: { animal: 'bear', fur: 'brown', shirt: 2, hat: 'none' } });
  // On the title, My pet: a brown puppy, named, which sits at your feet there.
  await clickButton(a, 'My pet');
  await clickButton(a, 'Puppy', '#modal');
  await clickSwitch(a, '#modal .swatch[aria-label="brown"]');
  const box = await a.waitForSelector('#modal .name-input');
  await landed(a, box);
  await box.evaluate((el) => (el.value = ''));
  await box.type('Biscuit 🐾');
  await until(a, () => window.kidsWorld.profile.data.stickers['best-friends']);
  await clickButton(a, 'Done', '#modal');
  assert.deepEqual(await a.evaluate(() => window.kidsWorld.profile.look.pet), { kind: 'puppy', coat: 'brown', name: 'Biscuit 🐾' });
  await until(a, () => window.kidsWorld.renderer.pets.get(-1)?.kind === 'puppy');

  // On an island it comes along, follows you about, and sits by you when you stop.
  await makeIsland(a, { online: true, theme: 'Flat Land' });
  const pid = await a.evaluate(() => window.kidsWorld.game.pid);
  await until(a, (pid) => window.kidsWorld.game.pets.get(pid)?.kind === 'puppy', pid);
  const start = await a.evaluate(() => ({ x: window.kidsWorld.game.me.body.x, z: window.kidsWorld.game.me.body.z }));
  await a.evaluate(() => {
    const kw = window.kidsWorld;
    kw.renderer.view.yaw = 0;
    kw.input.keys.add('KeyW');
    kw.step(1 / 60, 90);
    kw.input.keys.delete('KeyW');
  });
  const walked = await a.evaluate((start) => {
    const g = window.kidsWorld.game;
    const pet = g.pets.get(g.pid).sim;
    return { far: Math.hypot(g.me.body.x - start.x, g.me.body.z - start.z), behind: Math.hypot(pet.x - g.me.body.x, pet.z - g.me.body.z) };
  }, start);
  assert.ok(walked.far > 4 && walked.behind < 4, `it keeps up as you walk: ${JSON.stringify(walked)}`);
  await a.evaluate(() => window.kidsWorld.step(1 / 60, 240));
  const sitting = await a.evaluate(() => {
    const g = window.kidsWorld.game;
    const pet = g.pets.get(g.pid).sim;
    return { state: pet.state, by: Math.hypot(pet.x - g.me.body.x, pet.z - g.me.body.z) };
  });
  assert.ok(sitting.state === 'sit' && sitting.by < 1.6, `then sits beside you: ${JSON.stringify(sitting)}`);

  // A click on it pets it (with hearts and a happy wiggle), and a wave makes it beg.
  const at = await petOnScreen(a, pid);
  assert.ok(at, 'your puppy can be seen to be tapped');
  await a.mouse.click(at.x, at.y);
  await until(a, () => window.kidsWorld.profile.data.stats.petted === 1);
  assert.equal(await a.evaluate(() => window.kidsWorld.game.pets.get(window.kidsWorld.game.pid).sim.trick), 'happy');
  await a.evaluate(() => window.kidsWorld.ui.emoteDialog());
  await clickButton(a, 'Wave', '#modal');
  await until(a, () => window.kidsWorld.game.pets.get(window.kidsWorld.game.pid).sim.trick === 'beg');
  assert.equal(await a.evaluate(() => window.kidsWorld.profile.data.stats.tricks), 1);

  // A friend comes: they see Biscuit beside Kind Owl, walk over and pet it, and Kind Owl hears of it.
  const code = await a.evaluate(() => window.kidsWorld.game.code);
  const b = await openPlayer(`${base}?code=${code}`, { name: 'Merry Seal' });
  await clickButton(b, 'go!', '#modal');
  await inGame(b);
  await until(b, (pid) => window.kidsWorld.game.pets.get(pid)?.name === 'Biscuit 🐾', pid);
  await b.evaluate((pid) => {
    const g = window.kidsWorld.game;
    const pet = g.pets.get(pid).sim;
    Object.assign(g.me.body, { x: pet.x + 2, y: pet.y + 0.5, z: pet.z, vx: 0, vy: 0, vz: 0 });
    window.kidsWorld.step(1 / 60, 30);
  }, pid);
  const there = await petOnScreen(b, pid);
  assert.ok(there, "the friend's puppy can be seen to be tapped");
  await b.mouse.click(there.x, there.y);
  await until(b, () => window.kidsWorld.profile.data.stickers['pet-pal']);
  await until(a, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Merry Seal petted Biscuit 🐾!')));
  assert.deepEqual(pageErrors, []);
  await a.browserContext().close();
  await b.browserContext().close();
});

test('two friends peer to peer: visiting, building together, rules and saying goodbye', { skip }, async () => {
  const host = await openPlayer(p2p(), { name: 'Sunny Otter' });
  // A name of the host's own, typed in Change me.
  await clickButton(host, 'Change me');
  const nameBox = await host.waitForSelector('#modal .name-input');
  await landed(host, nameBox);
  await nameBox.evaluate((el) => (el.value = ''));
  await nameBox.type('민지 the Builder');
  await clickButton(host, 'Done', '#modal');
  assert.equal(await host.$eval('#me-name', (el) => el.textContent), 'Hi, 민지 the Builder!');
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
  assert.ok(await guest.evaluate(() => [...window.kidsWorld.game.players.values()].some((p) => p.name === '민지 the Builder')), 'the guest sees the host’s own name');
  // A new display name while there: the guest sees it as soon as the host stops typing.
  await host.click('#btn-settings');
  await clickButton(host, 'Change me', '#modal');
  const renameBox = await host.waitForSelector('#modal .name-input');
  await landed(host, renameBox);
  await renameBox.evaluate((el) => (el.value = ''));
  await renameBox.type('Captain 민지');
  await until(guest, () => [...window.kidsWorld.game.players.values()].some((p) => p.name === 'Captain 민지'));
  // And a kid now, with pink pigtails: the guest sees them swing.
  await clickButton(host, 'Kid', '#modal');
  await clickButton(host, 'Pigtails', '#modal');
  await clickSwitch(host, '#modal .swatch[aria-label="pink"]');
  await until(guest, () => [...window.kidsWorld.game.players.values()].some((p) => !p.me && p.look.animal === 'kid' && p.look.hairColor === 'pink' && p.avatar.sway.length === 2));
  await clickButton(host, 'Done', '#modal');

  // The guest types something; the host hears it, in a bubble and in the chat.
  const words = '안녕! Let’s build a castle 🏰';
  await guest.click('#btn-say');
  const sayBox = await guest.waitForSelector('#modal .say-row input');
  await landed(guest, sayBox);
  await sayBox.click();
  await sayBox.type(words);
  await guest.keyboard.press('Enter');
  await until(host, (w) => [...window.kidsWorld.game.players.values()].some((p) => p.bubble?.text === w), words);
  await until(host, (w) => [...document.querySelectorAll('#chatlog .line')].some((l) => l.textContent.endsWith(w) && l.lang === 'ko'), words);

  // The guest builds; the host sees it.
  const { cell, at } = await spotNear(guest, 2, 2);
  const above = { ...cell, y: cell.y + 1 };
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
  const { cell: cell2, at: at2 } = await spotNear(guest, -2, 1);
  const above2 = { ...cell2, y: cell2.y + 1 };
  // Not always air: a flower or a tuft of grass can stand there, and the block replaces it.
  const was = await blockAt(host, above2);
  await guest.mouse.click(at2.x, at2.y);
  await until(guest, () => document.querySelector('.toast.warn')?.textContent.includes('only builder'));
  await until(guest, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === c.was, { ...above2, was });
  assert.equal(await blockAt(host, above2), was);

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
  const { cell, at } = await spotNear(a, 1, 3);
  const above = { ...cell, y: cell.y + 1 };
  await a.mouse.click(at.x, at.y);
  await until(b, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
  assert.deepEqual(pageErrors, []);
  await a.browserContext().close();
  await b.browserContext().close();
});

test('an island you made is saved, under the name you typed and in the size you picked, and can be opened again', { skip }, async () => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`saver: ${error.message}`));
  await page.setViewport({ width: 720, height: 480 });
  page.setDefaultNavigationTimeout(60000 * SLOW);
  await page.goto(base + '?p2p=1');
  await page.waitForFunction(() => window.kidsWorld?.ui, { timeout: 60000 * SLOW });
  await makeIsland(page, { online: false, theme: 'Flat Land', size: 'Huge', name: '  민지네   블록 섬 🧱' });
  const name = '민지네 블록 섬 🧱';
  assert.equal(await page.evaluate(() => window.kidsWorld.game.world.W), 256, 'a huge island');
  assert.equal(await page.evaluate(() => window.kidsWorld.game.world.name), name, 'as typed, tidied');
  assert.equal(await page.$eval('#island-name', (el) => el.textContent), `🟩 ${name}`);
  const { cell, at } = await spotNear(page, 2, -2);
  const above = { ...cell, y: cell.y + 1 };
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
  assert.equal(await page.$eval('#modal .island-item b', (el) => el.lang), 'ko', 'wrapped as Korean');
  await clickButton(page, 'Play', '#modal');
  await inGame(page);
  assert.equal(await blockAt(page, above), 2);
  assert.equal(await page.evaluate(() => window.kidsWorld.game.world.W), 256, 'still huge');
  assert.deepEqual(pageErrors, []);
  await context.close();
});

// ---------------------------------------------------------------- the keeper

// Polls something on this side (the keeper's store) until it holds.
async function eventually(fn, timeout = 30000 * SLOW) {
  const end = Date.now() + timeout;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${String(fn).slice(0, 160)}`);
    await delay(200);
  }
}

// A keeper in this process, online through the local PeerServer.
async function keeperOnline(identity, dir) {
  const store = await new KeeperStore(dir).open();
  const keeper = new Keeper({ store, identity, signal, iceServers: [], log: () => {} });
  await keeper.start();
  await eventually(() => keeper.state === 'online');
  return keeper;
}

test('the keeper keeps copies of your islands and of you, sent peer to peer; an impostor gets nothing', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const identity = await createIdentity(join(dir, 'real'));
  let keeper = await keeperOnline(identity, join(dir, 'real'));
  // The pages of this server are told about the keeper; the other tests' pages are not.
  const games = createGameServer({ log: () => {}, keeperConfig: publicConfig(identity, signal) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const page = await openPlayer(`http://127.0.0.1:${games.address().port}/?p2p=1&signal=${encodeURIComponent(signal)}`, { name: 'Sunny Otter' });
  try {
    // A new island is saved at once, and a copy goes to the keeper, with you.
    await makeIsland(page, { online: false, theme: 'Flat Land' });
    const device = KeeperStore.deviceId(await page.evaluate(() => window.kidsWorld.keeper.data.device));
    const kept = async () => (await keeper.store.devices()).find((d) => d.id === device);
    await eventually(async () => (await kept())?.islands.length === 1 && Boolean((await kept()).profile));
    assert.equal((await kept()).profile.name, 'Sunny Otter');
    assert.equal((await kept()).islands[0].name, await page.evaluate(() => window.kidsWorld.game.world.name));

    // What you build is in a copy within a save or two.
    const { cell, at } = await spotNear(page, 2, 2);
    const above = { ...cell, y: cell.y + 1 };
    await page.mouse.click(at.x, at.y);
    await until(page, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
    const keptBlock = async () => {
      const save = JSON.parse(await readFile(await keeper.store.islandFile(device, (await kept()).islands[0].id), 'utf8'));
      return World.decode(save.meta, save.blocks).get(above.x, above.y, above.z);
    };
    await eventually(async () => (await keptBlock()) === 2, 60000 * SLOW);
    await page.click('#btn-settings');
    await until(page, () => document.querySelector('#modal .keeper-status')?.textContent.startsWith('Last copy'));
    await page.keyboard.press('Escape');

    // The keeper goes away and someone else takes its peer id: they are sent nothing.
    await keeper.stop();
    const other = await createIdentity(join(dir, 'other'));
    const impostor = await keeperOnline({ ...other, peer: identity.peer }, join(dir, 'other'));
    // A new hat: one the random look you started with is not wearing already.
    const hat = await page.evaluate(() => {
      const { profile } = window.kidsWorld;
      const hat = profile.look.hat === 'crown' ? 'cap' : 'crown';
      profile.update({ look: { ...profile.look, hat } });
      return hat;
    });
    await until(page, () => window.kidsWorld.keeper.state === 'refused');
    assert.deepEqual(await impostor.store.devices(), []);
    await impostor.stop();

    // The real keeper is back: the next time the game is opened, the change that waited goes to it.
    keeper = await keeperOnline(identity, join(dir, 'real'));
    const again = await page.browserContext().newPage();
    again.on('pageerror', (error) => pageErrors.push(`again: ${error.message}`));
    await again.goto(page.url());
    await eventually(async () => (await kept())?.profile.look.hat === hat);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.browserContext().close();
    await keeper.stop();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

// Types into the dialog's boxes (username, password, the password again), in order, once it has landed.
async function typeInto(page, ...values) {
  await page.waitForSelector('#modal .password-box input', { timeout: 15000 * SLOW });
  const boxes = await page.$$('#modal .password-box input');
  for (const [i, value] of values.entries()) {
    await landed(page, boxes[i]);
    await boxes[i].evaluate((el) => (el.value = ''));
    await boxes[i].type(value);
  }
}

// Does something that reloads the page as someone else, and waits for the game to be back.
async function reloadsAfter(page, fn) {
  const reloaded = page.waitForNavigation({ timeout: 60000 * SLOW });
  await fn();
  await reloaded;
  await page.waitForFunction(() => window.kidsWorld?.ui, { timeout: 60000 * SLOW });
}

const islandNames = (page) => page.evaluate(() => window.kidsWorld.ui.handlers.islands().map((i) => i.name));

test('a login made on one device logs in another: what each made comes along, the same both ways, until logging out', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const identity = await createIdentity(dir);
  const keeper = await keeperOnline(identity, dir);
  const games = createGameServer({ log: () => {}, keeperConfig: publicConfig(identity, signal) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${games.address().port}/?p2p=1&signal=${encodeURIComponent(signal)}`;
  const look = { animal: 'fox', fur: 'orange', shirt: 3, hat: 'crown' };
  const tablet = await openPlayer(url, { name: 'Sunny Otter', look });
  const phone = await openPlayer(url, { name: 'Happy Panda', look: { animal: 'panda', fur: 'white', shirt: 5, hat: 'cap' } });
  const username = 'Otter Fan 7';
  const password = 'rocket-apple7';
  const leave = async (page) => {
    await page.click('#btn-settings');
    await clickButton(page, 'Leave island', '#modal');
    await until(page, () => !document.getElementById('title').hidden);
  };
  try {
    // The tablet makes an island, then a login: a username, and a password typed twice.
    await makeIsland(tablet, { online: false, theme: 'Flat Land' });
    const name = await tablet.evaluate(() => window.kidsWorld.game.world.name);
    await leave(tablet);
    await clickButton(tablet, 'Log in');
    await clickButton(tablet, 'Make my login', '#modal');
    await typeInto(tablet, username, password, 'rocket-apple8');
    await clickButton(tablet, 'Make my login', '#modal');
    await until(tablet, () => document.querySelector('#modal .login-note')?.textContent.includes('not the same'));
    await typeInto(tablet, username, password, password);
    await clickButton(tablet, 'Make my login', '#modal');
    await until(tablet, () => document.querySelector('#modal .login-note')?.textContent.includes('Your login is ready'));
    await reloadsAfter(tablet, () => clickButton(tablet, 'Got it', '#modal'));
    await until(tablet, () => document.getElementById('btn-login').textContent.includes('My login'));
    assert.equal(await tablet.evaluate(() => window.kidsWorld.keeper.login.username), username);
    // The username is the name in games now, as the box under it said.
    assert.equal(await tablet.$eval('#me-name', (el) => el.textContent), `Hi, ${username}!`);
    const player = await tablet.evaluate(() => window.kidsWorld.keeper.login.player);
    assert.equal(player, KeeperStore.deviceId(await tablet.evaluate(() => window.kidsWorld.keeper.data.device)), 'the tablet’s copies are the player’s');
    await eventually(async () => (await keeper.store.list(player)).profile?.name === username);

    // The phone was played on before, as Happy Panda, who made an island there too.
    await makeIsland(phone, { online: false, theme: 'Flat Land' });
    const own = await phone.evaluate(() => window.kidsWorld.game.world.name);
    await leave(phone);
    const guestDevice = KeeperStore.deviceId(await phone.evaluate(() => window.kidsWorld.keeper.data.device));
    await eventually(async () => (await keeper.store.devices()).some((d) => d.id === guestDevice && d.islands.length === 1));

    // It logs in with the username, in any case, and the password (a wrong one first).
    await clickButton(phone, 'Log in');
    await typeInto(phone, username, 'not-my-password');
    await phone.keyboard.press('Enter');
    await until(phone, () => document.querySelector('#modal .login-note')?.textContent.includes('do not go together'));
    await typeInto(phone, username.toUpperCase(), password);
    await phone.keyboard.press('Enter');
    // Happy Panda's island was Sunny Otter's: it comes along.
    await until(phone, () => document.querySelector('#modal')?.textContent.includes('Are they yours?'));
    await reloadsAfter(phone, () => clickButton(phone, 'Yes, they are mine', '#modal'));
    assert.equal(await phone.$eval('#me-name', (el) => el.textContent), `Hi, ${username}!`);
    assert.equal(await phone.evaluate(() => window.kidsWorld.keeper.login.username), username);
    assert.deepEqual(await phone.evaluate(() => window.kidsWorld.profile.look), look);
    const kept = async () => (await keeper.store.list(player)).islands.map((i) => i.name).sort();
    assert.deepEqual(await kept(), [name, own].sort(), 'the keeper moved the phone’s copies into the login');
    assert.ok(!(await keeper.store.devices()).some((d) => d.id === guestDevice));

    // Both islands are on the phone; it opens the tablet's as its owner and builds on it.
    await clickButton(phone, 'My islands');
    for (const n of [name, own]) await until(phone, (n) => [...document.querySelectorAll('#modal .island-item b')].some((b) => b.textContent === n), n);
    await phone.evaluate((n) => [...document.querySelectorAll('#modal .island-item')].find((it) => it.querySelector('b').textContent === n).querySelector('.chip.on').click(), name);
    await inGame(phone);
    assert.equal(await phone.evaluate(() => window.kidsWorld.game.world.name), name);
    assert.equal(await phone.evaluate(() => window.kidsWorld.game.pid === window.kidsWorld.game.host), true, 'the owner');
    const { cell, at } = await spotNear(phone, 2, -2);
    const above = { ...cell, y: cell.y + 1 };
    await phone.mouse.click(at.x, at.y);
    await until(phone, (c) => window.kidsWorld.game.world.get(c.x, c.y, c.z) === 2, above);
    await leave(phone);
    const id = await phone.evaluate((n) => window.kidsWorld.ui.handlers.islands().find((i) => i.name === n).id, name);
    const keptBlock = async () => {
      const text = await keeper.store.islandText(player, id);
      const save = text && JSON.parse(text);
      return save ? World.decode(save.meta, save.blocks).get(above.x, above.y, above.z) : 0;
    };
    await eventually(async () => (await keptBlock()) === 2);

    // Back on the tablet: the phone's island, and the phone's brick.
    await reloadsAfter(tablet, () => tablet.reload());
    await until(tablet, (own) => window.kidsWorld.ui.handlers.islands().some((i) => i.name === own) && window.kidsWorld.keeper.listed && !window.kidsWorld.keeper.syncing, own);
    await until(tablet, (id) => window.kidsWorld.keeper.data.sent[id] > 0 && !window.kidsWorld.keeper.toFetch.length, id);
    await clickButton(tablet, 'My islands');
    await tablet.evaluate((n) => [...document.querySelectorAll('#modal .island-item')].find((it) => it.querySelector('b').textContent === n).querySelector('.chip.on').click(), name);
    await inGame(tablet);
    assert.equal(await blockAt(tablet, above), 2);

    // The display name is the username until another is picked, and the username again in one tap.
    await leave(tablet);
    await clickButton(tablet, 'Change me');
    assert.equal(await tablet.$eval('#modal .same-row input', (el) => el.checked), true);
    const nameBox = await tablet.waitForSelector('#modal .name-input');
    await landed(tablet, nameBox);
    await nameBox.evaluate((el) => (el.value = ''));
    await nameBox.type('Captain Otter');
    await until(tablet, () => !document.querySelector('#modal .same-row input').checked);
    await clickButton(tablet, 'Done', '#modal');
    assert.equal(await tablet.$eval('#me-name', (el) => el.textContent), 'Hi, Captain Otter!');
    await clickButton(tablet, 'My login');
    await clickButton(tablet, 'Use my username instead', '#modal');
    await until(tablet, (u) => document.getElementById('me-name').textContent === `Hi, ${u}!`, username);
    await tablet.keyboard.press('Escape');

    // The phone logs out: the guest starts afresh, and only the tablet is logged in.
    await clickButton(phone, 'My login');
    await reloadsAfter(phone, () => clickButton(phone, 'Log out', '#modal'));
    await until(phone, () => document.getElementById('btn-login').textContent.includes('Log in'));
    assert.deepEqual(await islandNames(phone), [], 'Happy Panda’s island went with the login');
    assert.equal((await keeper.store.devices()).find((d) => d.id === player).login.devices, 1);
    assert.deepEqual(pageErrors, []);
  } finally {
    await tablet.browserContext().close();
    await phone.browserContext().close();
    await keeper.stop();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test('the ranking shows the players with a login to anyone, live: you marked once logged in, leaving it and coming back, and a friend climbing as they build', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const identity = await createIdentity(dir);
  const keeper = await keeperOnline(identity, dir);
  const games = createGameServer({ log: () => {}, keeperConfig: publicConfig(identity, signal) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${games.address().port}/?p2p=1&signal=${encodeURIComponent(signal)}`;
  const password = 'rocket-apple7';
  await keeper.store.makeLogin(
    KeeperStore.deviceId('c3'.repeat(16)),
    password,
    { name: 'Minji', look: { animal: 'bunny', shirt: 2 }, stats: { placed: 120 }, stickers: { 'first-block': 5, builder: 6 } },
    { username: 'minji kim' },
  );
  await keeper.store.makeLogin(KeeperStore.deviceId('e5'.repeat(16)), 'dogs and stars', { name: 'Brave Fox', stats: { placed: 30 } }, { username: 'fox' });
  const page = await openPlayer(url, { name: 'Sunny Otter' });
  let friend = null;
  const names = () => page.evaluate(() => [...document.querySelectorAll('#modal .rank-row .who')].map((b) => b.firstChild.textContent));
  try {
    // A guest sees it from the title screen, and is told how to be in it.
    await clickButton(page, 'Ranking');
    await clickButton(page, 'Builders', '#modal');
    await until(page, () => document.querySelectorAll('#modal .rank-row').length === 2);
    assert.deepEqual(await names(), ['Minji', 'Brave Fox']);
    assert.match(await page.$eval('#modal .ranking-foot', (el) => el.textContent), /Players with a login are in the ranking/);
    assert.equal(await page.$('#modal .ranking-foot input'), null);
    await page.keyboard.press('Escape');

    // Minji logs in there, and finds herself on the board, from her stickers too.
    await clickButton(page, 'Log in');
    await typeInto(page, 'Minji Kim', password);
    await reloadsAfter(page, () => page.keyboard.press('Enter'));
    await clickButton(page, 'Stickers');
    await clickButton(page, 'Ranking', '#modal');
    await until(page, () => document.querySelector('#modal .rank-row.you'));
    assert.deepEqual(await names(), ['Minji'], 'Brave Fox has no stickers');
    assert.equal(await page.$eval('#modal .ranking-foot input', (el) => el.checked), true);

    // She leaves it: nobody sees her there now, on any board.
    await clickSwitch(page, '#modal .ranking-foot input');
    await until(page, () => document.querySelector('#modal .ranking-foot')?.textContent.includes('You are not in the ranking'));
    assert.deepEqual(await names(), []);
    assert.equal((await keeper.store.ranking()).players, 1);
    await clickButton(page, 'Builders', '#modal');
    assert.deepEqual(await names(), ['Brave Fox']);
    // And comes back.
    await clickSwitch(page, '#modal .ranking-foot input');
    await until(page, () => document.querySelector('#modal .rank-row.you'));
    assert.deepEqual(await names(), ['Minji', 'Brave Fox']);
    assert.equal(await page.$eval('#modal .rank-row.you .place', (el) => el.textContent), '🥇');
    assert.equal(await page.$eval('#modal .live', (el) => !el.hidden), true, 'live');

    // Brave Fox logs in on another device and builds: Minji's open ranking shows him climb past her.
    friend = await openPlayer(url, { name: 'Lucky Bunny' });
    await clickButton(friend, 'Log in');
    await typeInto(friend, 'fox', 'dogs and stars');
    await reloadsAfter(friend, () => friend.keyboard.press('Enter'));
    await until(friend, () => window.kidsWorld.keeper.listed && !window.kidsWorld.keeper.syncing);
    await friend.evaluate(() => window.kidsWorld.profile.count('placed', 200));
    await until(page, () => document.querySelector('#modal .rank-row .who')?.firstChild.textContent === 'Brave Fox');
    assert.deepEqual(await names(), ['Brave Fox', 'Minji']);
    assert.equal(await page.$eval('#modal .rank-row .score', (el) => el.textContent), '230');
    assert.equal(await page.$eval('#modal .rank-row.you .place', (el) => el.textContent), '🥈');
    // Closed, it stops watching, and the connection goes quiet as before.
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.kidsWorld.keeper.watching), false);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.browserContext().close();
    await friend?.browserContext().close();
    await keeper.stop();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a keeper running code from before the ranking: the page says it needs an update, never live, and the keeper says so in its terminal', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const identity = await createIdentity(dir);
  const keeper = await keeperOnline(identity, dir);
  const said = [];
  keeper.log = (line) => said.push(String(line));
  // As one started from a folder not yet updated: it knows none of the ranking's messages.
  const handle = keeper.handle.bind(keeper);
  keeper.handle = async (conn, msg) => {
    if (conn.folder && ['ranking', 'unwatch', 'ranked'].includes(msg.t)) {
      keeper.unknown(msg.t);
      throw new KeepError('bad', 'The keeper does not know that message.');
    }
    return handle(conn, msg);
  };
  const games = createGameServer({ log: () => {}, keeperConfig: publicConfig(identity, signal) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const page = await openPlayer(`http://127.0.0.1:${games.address().port}/?p2p=1&signal=${encodeURIComponent(signal)}`, { name: 'Sunny Otter' });
  try {
    await clickButton(page, 'Ranking');
    await until(page, () => document.querySelector('#modal .login-note')?.textContent.includes('needs an update'));
    // Asked once, not again and again, and never shown as live.
    await delay(1500);
    assert.equal(await page.$eval('#modal .live', (el) => el.hidden), true);
    assert.equal(await page.$$eval('#modal .rank-row', (rows) => rows.length), 0);
    assert.deepEqual(said, ['keeper: a page asked for "ranking", which this keeper does not know: the game is newer than it. Update it with git pull, then restart npm start.']);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.browserContext().close();
    await keeper.stop();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test('the admin page shows each player, their login and their islands, drawn from above, deletes them, and moves a device’s copies into a login', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const store = await new KeeperStore(dir).open();
  const key = 'e5'.repeat(16);
  const room = new Room({ code: '482753', theme: 'snowy', seed: 3 });
  await store.keepIsland(key, '0123456789ab', room.exportSave());
  await store.keepProfile(key, { name: 'Brave Fox', look: { animal: 'fox', fur: 'orange', shirt: 2, hat: 'none' }, stickers: { 'first-block': 1 } });
  await store.makeLogin(KeeperStore.deviceId(key), 'moon-moon-star');
  const games = createGameServer({ log: () => {}, admin: adminHandler({ store }) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`admin: ${error.message}`));
  page.on('dialog', (dialog) => dialog.accept());
  try {
    await page.goto(`http://127.0.0.1:${games.address().port}/admin/`);
    await until(page, () => document.querySelector('.device h3')?.textContent === 'Brave Fox');
    assert.equal(await page.$eval('.island h4', (el) => el.textContent), `❄️ ${room.world.name}`);
    assert.match(await page.$eval('.login-line', (el) => el.textContent), /Logs in as Brave Fox on 1 device/);
    // The island from above: one pixel per column.
    await until(page, () => document.querySelector('img.map')?.naturalWidth === 128);
    const href = await page.$eval('.island a.button', (a) => a.getAttribute('href'));
    assert.match(href, /^\/admin\/api\/devices\/[0-9a-f]{20}\/islands\/0123456789ab\?day=\d{4}-\d{2}-\d{2}&download$/);
    await page.click('.island button.danger');
    await until(page, () => !document.querySelector('.island'));
    assert.deepEqual((await store.devices())[0].islands, []);

    // An old tablet's copies, from before logins, moved into Brave Fox's login.
    const old = 'f6'.repeat(16);
    await store.keepIsland(old, 'ffffffffffff', room.exportSave());
    await store.keepProfile(old, { name: 'Lucky Bunny', stickers: { rainbow: 1 } });
    await page.reload();
    await until(page, () => [...document.querySelectorAll('.device h3')].some((h) => h.textContent === 'Lucky Bunny'));
    await clickButton(page, 'Move into this login');
    await until(page, () => ![...document.querySelectorAll('.device h3')].some((h) => h.textContent === 'Lucky Bunny'));
    const [fox] = await store.devices();
    assert.deepEqual(
      fox.islands.map((i) => i.id),
      ['ffffffffffff'],
    );
    assert.equal(fox.profile.stickers.rainbow, 1);
    assert.deepEqual(pageErrors, []);
  } finally {
    await context.close();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test('an island open to friends is on everyone’s list of open islands, through the keeper; one with a passcode asks new visitors for it', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const identity = await createIdentity(dir);
  const keeper = await keeperOnline(identity, dir);
  const games = createGameServer({ log: () => {}, keeperConfig: publicConfig(identity, signal) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${games.address().port}/?p2p=1&signal=${encodeURIComponent(signal)}`;
  const host = await openPlayer(url, { name: 'Sunny Otter' });
  const guest = await openPlayer(url, { name: 'Brave Fox' });
  const listed = (page) => page.evaluate(() => [...document.querySelectorAll('#modal .open-islands .island-item')].map((el) => [el.querySelector('b').textContent, el.querySelector('button').textContent]));
  // Types four numbers into the passcode dialog, and goes.
  const typePasscode = async (page, passcode) => {
    const box = await page.waitForSelector('#modal .code-input input');
    await landed(page, box);
    await box.click();
    await page.keyboard.type(passcode);
    await clickButton(page, 'go!', '#modal');
  };
  try {
    // Nothing open yet.
    await clickButton(guest, 'Visit a friend');
    await until(guest, () => document.querySelector('#modal .open-note')?.textContent.startsWith('No islands are open'));

    // An island open to friends shows up by itself, and anyone can come in.
    await makeIsland(host, { online: true, theme: 'Candy Island', name: '토끼 Bay' });
    await until(guest, () => [...document.querySelectorAll('#modal .open-islands b')].some((b) => b.textContent === '토끼 Bay' && b.lang === 'ko'));
    assert.deepEqual(await listed(guest), [['토끼 Bay', '🛶 Visit']]);
    assert.equal(await guest.$eval('#modal .open-islands .muted', (el) => el.textContent), 'Cozy · 1 of 8 playing');

    // Its owner gives it a passcode: the list says so, and a new visitor is asked for it.
    await host.click('#btn-settings');
    await clickSwitch(host, '#modal .passcode-setting .switch');
    const passcode = await host.evaluate(() => window.kidsWorld.game.passcode);
    assert.match(passcode, /^\d{4}$/);
    assert.equal(await host.$eval('#modal .passcode-setting b.passcode', (el) => el.textContent), passcode);
    await host.keyboard.press('Escape');
    await until(guest, () => [...document.querySelectorAll('#modal .open-islands .island-item')].some((el) => el.textContent.includes('🔒 Passcode')));
    await clickButton(guest, '🔒 Visit', '#modal');
    const wrong = passcode === '0000' ? '1111' : '0000';
    await typePasscode(guest, wrong);
    // Not right: asked again.
    await until(guest, () => document.querySelector('#modal .wrong-passcode'));
    assert.equal(await guest.evaluate(() => window.kidsWorld.session), null);
    await typePasscode(guest, passcode);
    await inGame(guest);
    await until(host, () => window.kidsWorld.game.players.size === 2);
    assert.equal(await guest.evaluate(() => window.kidsWorld.game.passcode), '', 'only the owner knows it');
    assert.equal(await guest.evaluate(() => window.kidsWorld.game.settings.passcode), true);

    // Once in, a friend comes back without it.
    await guest.evaluate(() => window.kidsWorld.ui.gameHandlers.leave());
    await until(guest, () => !window.kidsWorld.session);
    await clickButton(guest, 'Visit a friend');
    await until(guest, () => [...document.querySelectorAll('#modal .open-islands button')].some((b) => b.textContent === '🛶 Visit'));
    await clickButton(guest, '🛶 Visit', '#modal .open-islands');
    await inGame(guest);
    await until(host, () => window.kidsWorld.game.players.size === 2);

    // Closed to friends: off the list, for everyone.
    await guest.evaluate(() => window.kidsWorld.ui.gameHandlers.leave());
    await host.evaluate(() => window.kidsWorld.ui.gameHandlers.setOnline(false));
    await clickButton(guest, 'Visit a friend');
    await until(guest, () => document.querySelector('#modal .open-note')?.textContent.startsWith('No islands are open'));
    assert.equal(keeper.openIslands().length, 0);
    assert.deepEqual(pageErrors, []);
  } finally {
    await host.browserContext().close();
    await guest.browserContext().close();
    await keeper.stop();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a logged-in player sees the other players and who is playing now, and invites one to an island with a passcode, who comes in without it', { skip }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-e2e-'));
  const identity = await createIdentity(dir);
  const keeper = await keeperOnline(identity, dir);
  const games = createGameServer({ log: () => {}, keeperConfig: publicConfig(identity, signal) });
  await new Promise((done) => games.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${games.address().port}/?p2p=1&signal=${encodeURIComponent(signal)}`;
  const password = 'rocket-apple7';
  await keeper.store.makeLogin(KeeperStore.deviceId('a1'.repeat(16)), password, { name: 'Sunny Otter', look: { animal: 'cat', shirt: 4 } }, { username: 'otter' });
  await keeper.store.makeLogin(KeeperStore.deviceId('c3'.repeat(16)), password, { name: 'Minji', look: { animal: 'bunny', shirt: 2 } }, { username: 'minji' });
  await keeper.store.makeLogin(KeeperStore.deviceId('e5'.repeat(16)), password, { name: 'Brave Fox' }, { username: 'fox' });
  const host = await openPlayer(url, { name: 'Guest One' });
  const friend = await openPlayer(url, { name: 'Guest Two' });
  const logIn = async (page, username) => {
    await clickButton(page, 'Log in');
    await typeInto(page, username, password);
    await reloadsAfter(page, () => page.keyboard.press('Enter'));
    await until(page, () => window.kidsWorld.keeper.listed && !window.kidsWorld.keeper.syncing);
  };
  const players = (page) => page.evaluate(() => [...document.querySelectorAll('#modal .player-item')].map((el) => [el.querySelector('b').textContent, el.querySelector('.muted').textContent, el.querySelector('button')?.textContent ?? '']));
  try {
    // A guest is told to log in to see them.
    await clickButton(friend, 'Players');
    await until(friend, () => document.querySelector('#modal')?.textContent.includes('Log in with 🔑'));
    await friend.keyboard.press('Escape');

    // Both log in. Minji sees everyone else, Sunny Otter playing now.
    await logIn(friend, 'minji');
    await logIn(host, 'otter');
    await eventually(() => keeper.onlinePlayers().size === 2);
    await clickButton(friend, 'Players');
    await until(friend, () => document.querySelectorAll('#modal .player-item').length === 2);
    assert.deepEqual(await players(friend), [
      ['Sunny Otter', '🟢 Playing now', ''],
      ['Brave Fox', 'Not playing right now', ''],
    ]);
    assert.equal(await friend.$eval('#modal .ranking-foot input', (el) => el.checked), true);
    await friend.keyboard.press('Escape');

    // Sunny Otter makes an island with a passcode, and invites Minji from its island card.
    await makeIsland(host, { online: true, theme: 'Candy Island', name: 'Candy Cove' });
    await host.click('#btn-settings');
    await clickSwitch(host, '#modal .passcode-setting .switch');
    await host.keyboard.press('Escape');
    await host.click('#island-badge');
    await clickButton(host, 'Invite a player', '#modal');
    await until(host, () => document.querySelectorAll('#modal .player-item').length === 2);
    assert.deepEqual(await players(host), [
      ['Minji', '🟢 Playing now', '💌 Invite'],
      ['Brave Fox', 'Not playing right now', ''],
    ]);
    await clickButton(host, '💌 Invite', '#modal');
    await until(host, () => document.querySelector('#modal .player-item button')?.textContent === '✅ Invited');

    // Minji is asked, by name and island, and goes: no passcode asked for.
    await until(friend, () => document.querySelector('#invitations .invitation'));
    assert.equal(await friend.$eval('#invitations .invitation .words', (el) => el.textContent), 'Sunny Otter invites you to 🍭 Candy Cove!');
    await clickButton(friend, 'Let’s go!', '#invitations');
    await inGame(friend);
    assert.equal(await friend.evaluate(() => window.kidsWorld.game.world.name), 'Candy Cove');
    await until(host, () => window.kidsWorld.game.players.size === 2);
    assert.equal(await friend.$('#invitations .invitation'), null);

    // Minji leaves the list: nobody sees her there, or can invite her.
    await friend.evaluate(() => window.kidsWorld.ui.playersDialog());
    await until(friend, () => document.querySelector('#modal .ranking-foot input'));
    await clickSwitch(friend, '#modal .ranking-foot input');
    await until(friend, () => document.querySelector('#modal .ranking-foot')?.textContent.includes('You are not on the list'));
    await until(host, () => [...document.querySelectorAll('#modal .player-item b')].map((b) => b.textContent).join() === 'Brave Fox');
    assert.deepEqual(pageErrors, []);
  } finally {
    await host.browserContext().close();
    await friend.browserContext().close();
    await keeper.stop();
    await games.shutdown();
    await rm(dir, { recursive: true, force: true });
  }
});

test('an adventure island with a friend: a camp’s monster popped with X from up close (the friend seeing the swing), its flag raised together, and a dizzy friend helped up with a click', { skip }, async () => {
  const host = await openPlayer(p2p(), { name: 'Brave Fox' });
  await clickButton(host, 'Make an island');
  await clickButton(host, 'Flat Land', '#modal');
  await clickSwitch(host, '#modal .switch[aria-label="Adventure"]');
  await clickButton(host, 'Make it', '#modal');
  await inGame(host);
  await until(host, () => window.kidsWorld.session.link.state === 'online');
  // Its camps and King Grumble's castle, their flags, and how many are free beside your hearts.
  const camps = await host.evaluate(() => window.kidsWorld.session.link.room.adventure.camps.map(({ id, kind, x, y, z, r }) => ({ id, kind, x, y, z, r })));
  assert.deepEqual(
    camps.map((c) => c.kind),
    ['camp', 'camp', 'camp', 'castle'],
  );
  await until(host, () => window.kidsWorld.renderer.flags.size === 4 && !document.getElementById('hearts').hidden && document.querySelector('#hearts .camps')?.textContent === '🚩 0/3');
  const code = await host.evaluate(() => window.kidsWorld.game.code);
  const guest = await openPlayer(p2p(`&code=${code}`), { name: 'Happy Panda' });
  await clickButton(guest, 'go!', '#modal');
  await inGame(guest);
  await until(guest, () => window.kidsWorld.game.adventure?.camps.size === 4 && window.kidsWorld.renderer.flags.size === 4);
  await until(host, () => window.kidsWorld.game.players.size === 2);
  // Each player standing somewhere in camp 1, still, looking along yaw, with the camera close
  // behind them, inside the camp: never pulled in by its fence, which would put what is in
  // front of them down under the hotbar.
  const [c] = camps;
  // Where a point is on the host's screen, whether anything is over it there, and what a tap
  // there means.
  const target = (p) =>
    host.evaluate((p) => {
      const kw = window.kidsWorld;
      const s = kw.renderer.project(p.x, p.y, p.z);
      const rect = kw.renderer.canvas.getBoundingClientRect();
      const x = rect.left + s.x;
      const y = rect.top + s.y;
      const el = document.elementFromPoint(x, y);
      const b = kw.game.me.body;
      const cam = kw.renderer.camera.position;
      return { x, y, clear: el === kw.renderer.canvas, over: el && `${el.tagName}#${el.id}.${el.className} in ${el.parentElement?.id}`, at: p, me: [b.x, b.y, b.z], camera: [cam.x, cam.y, cam.z], aim: kw.game.aim(kw.input.ndc(s.x, s.y)) };
    }, p);
  const stand = (page, dx, dz, yaw = 0) =>
    page.evaluate(
      (c, dx, dz, yaw) => {
        const kw = window.kidsWorld;
        Object.assign(kw.game.me.body, { x: c.x + dx, y: c.y, z: c.z + dz, vx: 0, vy: 0, vz: 0, flying: false });
        Object.assign(kw.renderer.view, { yaw, pitch: 0.25, dist: 4 });
        kw.game.sendMove(true);
      },
      c,
      dx,
      dz,
      yaw,
    );
  // Nothing inside camp 1 to get in the way of a click (a hay bale can be anywhere): all of
  // it cleared, as the island changes it, but its fence and the flag's floor.
  const cleared = await host.evaluate((c) => {
    const room = window.kidsWorld.session.link.room;
    const w = room.world;
    const cx = Math.floor(c.x);
    const cz = Math.floor(c.z);
    const cells = [];
    for (let x = cx - c.r; x <= cx + c.r; x++) {
      for (let z = cz - c.r; z <= cz + c.r; z++) {
        if (Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) > c.r - 1) continue;
        for (let y = c.y; y < c.y + 6; y++) if (w.get(x, y, z) !== 0 && !(y === c.y && Math.max(Math.abs(x - cx), Math.abs(z - cz)) <= 1)) cells.push(x, y, z, 0);
      }
    }
    for (let i = 0; i < cells.length; i += 4) w.set(cells[i], cells[i + 1], cells[i + 2], 0);
    room.broadcast({ t: 'edit', by: 0, seq: 0, kind: 'nature', cells });
    return cells;
  }, c);
  for (const page of [host, guest]) await until(page, (cells) => cells.every((v, i) => i % 4 !== 3 || window.kidsWorld.game.world.get(cells[i - 3], cells[i - 2], cells[i - 1]) === 0), cleared);
  // Near it, its monsters come out; all but one go, and that one is held still in front of the host.
  await stand(host, 2.5, c.r + 6);
  await stand(guest, -2.5, c.r + 6);
  await until(host, (id) => window.kidsWorld.session.link.room.monsters.list.filter((m) => m.camp === id).length === 3, c.id);
  // (Before the host goes in: one of them chasing the host would knock them about the camp.)
  const id = await host.evaluate((c) => {
    const room = window.kidsWorld.session.link.room;
    const [m, ...rest] = room.monsters.list.filter((o) => o.camp === c.id);
    for (const o of rest) room.monsters.remove(o.id);
    // None coming back while this runs, however slowly (a popped one would in 20 seconds).
    room.adventure.campById(c.id).back = [Infinity, Infinity, Infinity];
    Object.assign(m.body, { x: c.x + 2.5, y: c.y, z: c.z - 2, vx: 0, vy: 0, vz: 0 });
    // Down to its last heart: one tap pops it.
    m.giggle = Infinity;
    m.hearts = 1;
    return m.id;
  }, c);
  await stand(host, 2.5, 0.5);
  // Drawn where the island has it (a moved monster is drawn sliding there, a little behind), with the camera settled.
  await until(
    host,
    (id) => {
      const kw = window.kidsWorld;
      const m = kw.session.link.room.monsters.get(id);
      const at = kw.game.monsters.get(id)?.model.group.position;
      return at && Math.hypot(at.x - m.body.x, at.y - m.body.y, at.z - m.body.z) < 0.05;
    },
    id,
  );
  await host.evaluate(() => window.kidsWorld.step(1 / 60, 60));
  const held = await host.evaluate((id) => window.kidsWorld.game.monsters.get(id).model.group.position.toArray(), id);
  const at = await target({ x: held[0], y: held[1] + 0.4, z: held[2] });
  assert.deepEqual(at.aim, { kind: 'monster', id }, `the monster, under the tap: ${JSON.stringify(at)}`);
  assert.ok(at.clear, `nothing over the monster on screen: ${JSON.stringify(at)}`);
  // A click at it only says how to bop it; up close, facing it, X pops it.
  await host.mouse.click(at.x, at.y);
  await until(host, () => document.body.textContent.includes(`press ${window.kidsWorld.game.touch ? '👊' : 'X'} to bop it`));
  assert.ok(await host.evaluate((id) => window.kidsWorld.session.link.room.monsters.get(id), id), 'a click pops nothing');
  await stand(host, 2.5, -0.8);
  await host.evaluate(() => (window.kidsWorld.game.me.yaw = Math.PI));
  await host.keyboard.press('KeyX');
  // The friend sees the swing too.
  const hostPid = await host.evaluate(() => window.kidsWorld.game.pid);
  await until(guest, (pid) => window.kidsWorld.game.players.get(pid)?.avatar?.swingAt !== undefined, hostPid);
  try {
    await until(host, (id) => !window.kidsWorld.session.link.room.monsters.get(id), id);
  } catch (error) {
    // What was under the click then, and where the monster and the host were, at the island and on the page.
    const now = await host.evaluate(
      (id, at) => {
        const kw = window.kidsWorld;
        const room = kw.session.link.room;
        const m = room.monsters.get(id);
        const el = document.elementFromPoint(at.x, at.y);
        const rect = kw.renderer.canvas.getBoundingClientRect();
        return {
          under: el ? `${el.tagName}#${el.id}.${el.className}` : null,
          aim: kw.game.aim(kw.input.ndc(at.x - rect.left, at.y - rect.top)),
          monster: m && [m.body.x, m.body.y, m.body.z, m.giggle],
          host: room.players.get(kw.game.pid).s,
          dizzy: kw.game.dizzy,
          holding: kw.game.holding,
          seed: room.world.seed,
        };
      },
      id,
      at,
    );
    error.message += `; then: ${JSON.stringify(now)}`;
    throw error;
  }
  // Both by the flag: up it goes, and the camp is free, for both of them.
  await stand(guest, -2.5, 0);
  try {
    await until(host, (id) => window.kidsWorld.game.adventure.camps.get(id).freed, c.id, 30000 * SLOW);
  } catch (error) {
    // How the camp was doing, and where everyone stood, at the island; and its seed, to replay it.
    const at = await host.evaluate((id) => {
      const room = window.kidsWorld.session.link.room;
      const camp = room.adventure.campById(id);
      const near = (x, z) => [...Array(7)].map((_, dy) => room.world.get(Math.floor(x), Math.floor(camp.y) - 1 + dy, Math.floor(z))).join(',');
      return {
        seed: room.world.seed,
        camp: { x: camp.x, y: camp.y, z: camp.z, progress: camp.progress, holders: camp.holders, guarded: camp.guarded, awake: camp.awake, back: camp.back },
        monsters: room.monsters.list.map((m) => [m.camp, m.kind, +m.body.x.toFixed(2), +m.body.y.toFixed(2), +m.body.z.toFixed(2)]),
        players: [...room.players.values()].map((p) => [p.id, p.online, p.s, near(p.s[0], p.s[2])]),
      };
    }, c.id);
    error.message += `; at the island: ${JSON.stringify(at)}`;
    throw error;
  }
  await until(guest, (id) => window.kidsWorld.game.adventure.camps.get(id).freed && window.kidsWorld.profile.data.stats.freed === 1, c.id);
  assert.equal(await host.evaluate(() => window.kidsWorld.profile.data.stats.freed), 1);
  await until(host, () => document.querySelector('#hearts .camps')?.textContent === '🚩 1/3');
  // The guest out of hearts, knocked back towards the middle of the camp to sit dizzy there,
  // and the host, beside them, taps them to help them up (through the flowers of the camp freed).
  await stand(guest, 2.5, 0);
  const guestPid = await guest.evaluate(() => window.kidsWorld.game.pid);
  await host.evaluate((pid) => {
    const room = window.kidsWorld.session.link.room;
    const p = room.players.get(pid);
    p.hearts = 1;
    p.safeUntil = 0;
    room.hurt(pid, { id: 0, kind: 'blob', body: { x: p.s[0], z: p.s[2] + 1 } }, room.now());
  }, guestPid);
  await until(guest, () => window.kidsWorld.game.dizzy && window.kidsWorld.game.hearts === 0 && window.kidsWorld.game.me.body.onGround);
  await until(host, (pid) => window.kidsWorld.game.players.get(pid)?.dizzy, guestPid);
  const sat = await guest.evaluate(() => ({ x: window.kidsWorld.game.me.body.x, y: window.kidsWorld.game.me.body.y, z: window.kidsWorld.game.me.body.z }));
  await stand(host, sat.x - c.x, sat.z - c.z + 2.5);
  // Drawn sitting where they are on the host's screen too.
  await until(
    host,
    ({ pid, sat }) => {
      const at = window.kidsWorld.game.players.get(pid)?.avatar.root.position;
      return at && Math.hypot(at.x - sat.x, at.y - sat.y, at.z - sat.z) < 0.05;
    },
    { pid: guestPid, sat },
  );
  await host.evaluate(() => window.kidsWorld.step(1 / 60, 60));
  const sitting = await host.evaluate((pid) => window.kidsWorld.game.players.get(pid).avatar.root.position.toArray(), guestPid);
  const friend = await target({ x: sitting[0], y: sitting[1] + 0.6, z: sitting[2] });
  assert.deepEqual(friend.aim, { kind: 'friend', pid: guestPid }, `the friend, under the tap: ${JSON.stringify(friend)}`);
  assert.ok(friend.clear, `nothing over the friend on screen: ${JSON.stringify(friend)}`);
  await host.mouse.click(friend.x, friend.y);
  await until(guest, () => !window.kidsWorld.game.dizzy && window.kidsWorld.game.hearts === 3);
  await until(host, () => window.kidsWorld.profile.data.stats.helped === 1);
  assert.deepEqual(pageErrors, []);
  await host.browserContext().close();
  await guest.browserContext().close();
});

// ---------------------------------------------------------------- the island's song

test('a tower defense island: a tower built by its pad with V, a wave started with the Start button, and bubbles blown at its monsters', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Brave Fox' });
  await clickButton(page, 'Make an island');
  await clickButton(page, 'Flat Land', '#modal');
  await clickSwitch(page, '#modal .switch'); // Friends can visit: off
  // Adventure first, then Tower defense: one or the other, never both.
  await clickSwitch(page, '#modal .switch[aria-label="Adventure"]');
  await clickSwitch(page, '#modal .switch[aria-label="Tower defense"]');
  assert.equal(await page.evaluate(() => document.querySelector('#modal .switch[aria-label="Adventure"]').getAttribute('aria-checked')), 'false');
  await clickButton(page, 'Make it', '#modal');
  await inGame(page);
  const def = await page.evaluate(() => {
    const d = window.kidsWorld.session.link.room.defense;
    return { pads: d.pads.map(({ id, x, y, z }) => ({ id, x, y, z })), gate: d.gate, stone: d.stone, bricks: d.bricks, adventure: Boolean(window.kidsWorld.session.link.room.adventure) };
  });
  assert.equal(def.adventure, false);
  // The wave, the Star Stone's hearts and the bricks, under the hotbar's row.
  await until(page, (b) => !document.getElementById('defense').hidden && document.getElementById('defense').textContent.includes('1/10') && document.getElementById('defense').textContent.includes(`🧱 ${b}`), def.bricks);
  const stand = (at) =>
    page.evaluate((at) => {
      const kw = window.kidsWorld;
      Object.assign(kw.game.me.body, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, flying: false });
      kw.game.sendMove(true);
    }, at);
  // By the pad nearest the gate: Build, and V builds a tower there.
  const pad = def.pads.reduce((a, b) => (Math.hypot(b.x - def.gate.x, b.z - def.gate.z) < Math.hypot(a.x - def.gate.x, a.z - def.gate.z) ? b : a));
  await stand({ x: pad.x + 1.5, y: pad.y, z: pad.z });
  await until(page, () => !document.getElementById('defend').hidden && document.getElementById('defend').textContent.includes('Build'));
  await page.keyboard.press('KeyV');
  await until(page, (id) => window.kidsWorld.session.link.room.defense.padById(id).level === 1 && window.kidsWorld.game.defense.pads.find((p) => p.id === id).level === 1, pad.id);
  await until(page, () => document.getElementById('defend').textContent.includes('Bigger'));
  // Its blocks on the page's island too.
  assert.equal(await page.evaluate((p) => window.kidsWorld.game.world.get(Math.floor(p.x), p.y, Math.floor(p.z)), pad), 14);
  // Away from every pad, by the start: Start, clicked.
  await page.evaluate(() => {
    const kw = window.kidsWorld;
    const fx = kw.renderer.effects;
    window.bubbles = 0;
    const shot = fx.bubbleShot.bind(fx);
    fx.bubbleShot = (...a) => {
      window.bubbles++;
      shot(...a);
    };
  });
  const spawn = await page.evaluate(() => window.kidsWorld.game.world.spawn);
  await stand(spawn);
  await until(page, () => !document.getElementById('defend').hidden && document.getElementById('defend').textContent.includes('Start wave 1'));
  await page.click('#defend');
  await until(page, () => window.kidsWorld.session.link.room.defense.state === 'march');
  // Out of the gate they come, on the page too, and the tower blows bubbles at them.
  await until(page, () => [...window.kidsWorld.game.monsters.values()].length > 0);
  await stand({ x: pad.x + 1.5, y: pad.y, z: pad.z });
  await until(page, () => window.bubbles > 0, undefined, 60000 * SLOW);
  assert.equal(await page.evaluate(() => window.kidsWorld.game.defense.state), 'march');
  await page.close();
});

test('an island song: the owner picks an MP3 in Settings, a friend here and one who comes later hear it, Island music brings the island music back, and the island plays it again when opened again', { skip }, async () => {
  // A song bigger than one piece (see shared/song.js): a short MP3 behind an
  // ID3 tag padded out with zeros, which players skip.
  const tone = await readFile(new URL('./fixtures/tone.mp3', import.meta.url));
  const pad = 700_000;
  const tag = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, (pad >> 21) & 0x7f, (pad >> 14) & 0x7f, (pad >> 7) & 0x7f, pad & 0x7f]);
  const dir = await mkdtemp(join(tmpdir(), 'kids-world-song-'));
  const file = join(dir, 'Happy_Tune.mp3');
  await writeFile(file, Buffer.concat([tag, Buffer.alloc(pad), tone]));
  const pick = async (page, button) => {
    const [chooser] = await Promise.all([page.waitForFileChooser(), clickButton(page, button, '#modal')]);
    await chooser.accept([file]);
  };
  const hearing = (page) =>
    until(page, () => {
      const { game } = window.kidsWorld;
      const el = game.sound.song?.el;
      return game.song?.ready && game.song.name === 'Happy Tune' && el && !el.paused && el.currentTime > 0.2;
    });
  // A friend's page has been clicked (the go! button), so it may play sound.
  const visit = async (code, name) => {
    const page = await openPlayer(p2p(`&code=${code}`), { name });
    await clickButton(page, 'go!', '#modal');
    await inGame(page);
    await page.evaluate(() => window.kidsWorld.game.sound.unlock());
    return page;
  };
  try {
    const host = await openPlayer(p2p(), { name: 'Sunny Otter' });
    await makeIsland(host, { online: true });
    const code = await host.evaluate(() => window.kidsWorld.game.code);
    const guest = await visit(code, 'Brave Fox');

    await host.click('#btn-settings');
    await until(host, () => document.querySelector('#modal .song-setting')?.textContent.includes('instead of the island music'));
    await pick(host, 'Pick an MP3');
    await until(host, () => document.querySelector('#modal .song-name')?.textContent === 'Happy Tune');
    await hearing(host);
    assert.ok((await host.evaluate(() => window.kidsWorld.session.link.room.song.n)) >= 4, 'sent in pieces');
    await hearing(guest);
    await until(guest, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Now playing: Happy Tune')));
    // The island music waits while the song plays.
    assert.equal(await guest.evaluate(() => window.kidsWorld.game.sound.nextBeat), 0);

    const late = await visit(code, 'Late Owl');
    await hearing(late);

    // Back to the island music, for everyone.
    await clickButton(host, 'Island music', '#modal');
    for (const page of [host, guest, late]) await until(page, () => !window.kidsWorld.game.song && !window.kidsWorld.game.sound.song && window.kidsWorld.game.sound.nextBeat > 0);
    await late.browserContext().close();
    await guest.browserContext().close();

    // Picked again, it is the island's song the next time it is opened.
    await pick(host, 'Pick an MP3');
    await hearing(host);
    await clickButton(host, 'Leave island', '#modal');
    await until(host, () => !document.getElementById('title').hidden && !window.kidsWorld.game);
    await clickButton(host, 'My islands');
    await clickButton(host, 'Play', '#modal');
    await inGame(host);
    await hearing(host);
    assert.deepEqual(pageErrors, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
