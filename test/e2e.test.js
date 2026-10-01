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

// Turns the camera until the top face of a cell is in plain view (islands are
// random, and a tree crown can be in the way), and returns where it is on screen.
async function aimAt(page, cell) {
  const at = await page.evaluate((c) => {
    const kw = window.kidsWorld;
    const r = kw.renderer;
    const g = kw.game;
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
        return { x: rect.left + p.x, y: rect.top + p.y };
      }
    }
    return null;
  }, cell);
  assert.ok(at, `cell ${JSON.stringify(cell)} can be seen`);
  return at;
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
  await until(page, () => document.querySelector('#minimap canvas').width > 0);
  assert.ok(isSea(await pixel('#minimap canvas', 0.02, 0.02)), 'the corner of the little map is sea');
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
  const cell = await spotNear(page, 3, 1);
  const at = await aimAt(page, cell);
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
  assert.ok(isSea(await pixel('#modal .big-map', 0.01, 0.99)), 'the big map is drawn');
  await page.keyboard.press('Escape');
  await until(page, () => document.getElementById('modal').hidden && window.kidsWorld.ui.minimap.big === null);

  // Settings switches it off, and on again; the choice is kept.
  await page.click('#btn-settings');
  const toggle = '#modal .switch[aria-label$="Little map"]';
  await page.waitForSelector(toggle);
  await page.click(toggle);
  await until(page, () => document.getElementById('minimap').hidden && window.kidsWorld.profile.settings.map === false);
  await page.click(toggle);
  await until(page, () => !document.getElementById('minimap').hidden && window.kidsWorld.profile.settings.map === true);
  assert.deepEqual(pageErrors, []);
  await page.browserContext().close();
});

test('the little map fits beside every other button, on screens of every shape', { skip }, async () => {
  const page = await openPlayer(base + '?p2p=1', { name: 'Tidy Fox' });
  await makeIsland(page, { online: false });
  const screens = [
    [1280, 800, false],
    [1000, 600, false],
    [720, 480, false],
    [1024, 768, true],
    [768, 1024, true],
    [390, 844, true],
    [360, 740, true],
    [844, 390, true],
    [375, 548, true],
    [568, 320, true],
  ];
  for (const [width, height, touch] of screens) {
    await page.setViewport({ width, height });
    const seen = await page.evaluate((touch) => {
      document.body.classList.toggle('touch', touch);
      const m = document.getElementById('minimap').getBoundingClientRect();
      const covered = [];
      for (const el of document.querySelectorAll('#hud button, #hud .island-badge, #toolopts > *, #joystick')) {
        if (el.closest('#minimap')) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top) covered.push(el.id || el.className);
      }
      return { covered, size: m.width, inside: m.left >= 0 && m.top >= 0 && m.right <= innerWidth && m.bottom <= innerHeight };
    }, touch);
    const where = `${width}×${height}${touch ? ' touch' : ''}`;
    assert.deepEqual(seen.covered, [], `on ${where} the map is clear of the other buttons`);
    assert.ok(seen.inside && seen.size >= 90, `on ${where} the whole map is on screen: ${JSON.stringify(seen)}`);
  }
  // An upright screen this small has no room for it.
  await page.setViewport({ width: 320, height: 460 });
  assert.equal(await page.evaluate(() => document.getElementById('minimap').getBoundingClientRect().width), 0);
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
  const screens = [
    [320, 568, true],
    [320, 460, true],
    [360, 640, true],
    [375, 667, true],
    [375, 548, true],
    [390, 844, true],
    [430, 932, true],
    [768, 1024, true],
    [844, 390, true],
    [1280, 800, false],
  ];
  for (const [width, height, touch] of screens) {
    await page.setViewport({ width, height });
    for (const tool of ['build', 'pick', 'paint', 'hills', 'stamp', 'friends']) {
      const seen = await page.evaluate(
        (tool, touch) => {
          document.body.classList.toggle('touch', touch);
          window.kidsWorld.game.setTool(tool);
          const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const others = [...document.querySelectorAll('#talk button, #minimap, #joystick')].map((el) => el.getBoundingClientRect()).filter((r) => r.width);
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
        touch,
      );
      const where = `${width}×${height} with ${tool}: ${JSON.stringify(seen)}`;
      assert.ok(seen.pills > 0, `on ${where} the tool has options`);
      assert.deepEqual(seen.covered, [], `on ${where} no option is under the talk buttons, the map or the thumbstick`);
      assert.deepEqual(seen.blocked, [], `on ${where} every option can be tapped`);
      assert.equal(seen.beside, 'world', `on ${where} a touch beside the options reaches the island`);
    }
  }
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
  await page.click('#modal .fullscreen-switch');
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

test('a phone held upright shows the whole island code beside the top buttons', { skip }, async () => {
  const page = await openPlayer(base, { name: 'Tiny Owl' });
  await makeIsland(page, { online: true });
  await page.setViewport({ width: 360, height: 640 });
  const layout = await page.evaluate(() => {
    const kw = window.kidsWorld;
    const measure = () => {
      const code = document.getElementById('island-code');
      const buttons = [...document.querySelectorAll('#topbar .round')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect());
      return {
        code: code.scrollWidth <= code.clientWidth,
        round: buttons.every((b) => b.width === b.height),
        onScreen: buttons.every((b) => b.right <= innerWidth),
        clearOfTools: document.getElementById('topbar').getBoundingClientRect().bottom <= document.getElementById('toolbar').getBoundingClientRect().top,
      };
    };
    // The widest code, and a clock with two emoji: sunrise and rain.
    document.getElementById('island-code').textContent = 'Code 000 000';
    kw.game.env.time = 0.28;
    kw.game.env.weather = 'rain';
    kw.ui.frame();
    const calm = measure();
    // A long connection message squeezes the badge, but the buttons stay put.
    kw.ui.setStatus('reconnecting', 'Lost the island for a moment. Reconnecting…');
    return { calm, busy: measure() };
  });
  assert.deepEqual(layout.calm, { code: true, round: true, onScreen: true, clearOfTools: true });
  assert.deepEqual({ ...layout.busy, code: true }, layout.calm);
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
  // Not always air: a flower or a tuft of grass can stand there, and the block replaces it.
  const was = await blockAt(host, above2);
  const at2 = await aimAt(guest, cell2);
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
