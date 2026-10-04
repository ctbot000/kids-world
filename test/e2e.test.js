// End to end: real Chrome pages playing together, peer to peer through a
// local PeerServer and through the dedicated server. Each player gets its own
// browser context, so their profiles and tokens are separate, as on two
// devices. Set CHROME_PATH if Chrome is not installed in a standard place;
// without Chrome these tests are skipped.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { PeerServer } from 'peer';
import puppeteer from 'puppeteer-core';
import { TREE_PART, TULIP, WATER } from '../public/js/shared/blocks.js';
import { Room } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { adminHandler } from '../server/admin.js';
import { createIdentity, Keeper, KeeperStore, publicConfig } from '../server/keeper.js';
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

async function makeIsland(page, { online, theme = 'Sunny Island', name = '' }) {
  await clickButton(page, 'Make an island');
  // A name typed before the kind of island is picked stays.
  if (name) {
    const box = await page.waitForSelector('#modal .name-input');
    await landed(page, box);
    await box.evaluate((el) => (el.value = ''));
    await box.type(name);
  }
  await clickButton(page, theme, '#modal');
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
// tuft of grass. A column's highest block is not always that: world.top()
// looks through water and stops at leaves, so where a walk ends beside a pond
// or a tree it can be a pond's floor, whose top the water hides, or a treetop
// as high as the camera. A failure names the island's seed, to replay it.
async function spotNear(page, dx, dz) {
  const { seed, cells } = await page.evaluate(
    (dx, dz, tree) => {
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
          if (y > 0 && !tree[g.world.get(x, y, z)] && (on === 0 || (on >= 50 && on < 70))) open.push({ x, y, z });
        }
      }
      const off = (c) => Math.hypot(c.x - px - dx, c.z - pz - dz);
      return { seed: g.world.seed, cells: open.sort((a, b) => off(a) - off(b)) };
    },
    dx,
    dz,
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
    for (const full of [false, true]) {
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
        const thumbs = [...document.querySelectorAll('#touch-buttons button')].map((b) => [b.offsetWidth, b.offsetHeight]);
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
      const where = `${width}×${height}${touch ? ' touch' : ''}${full ? ' with a full basket' : ''}`;
      assert.equal(seen.pills, full ? seen.kinds : 0, `on ${where} the basket shows every kind of treasure in it`);
      assert.deepEqual(seen.treasures, [], `on ${where} neither a button nor the thumbstick covers a treasure in the basket`);
      assert.deepEqual(seen.covered, [], `on ${where} the map is clear of the other buttons`);
      assert.deepEqual(seen.crowded, [], `on ${where} the tools, the talk buttons, the touch buttons and the thumbstick are clear of each other`);
      // The map's place beside the talk buttons is worked out from --talk.
      assert.deepEqual(seen.talk, [[seen.want, seen.want], [seen.want, seen.want]], `on ${where} the talk buttons are --talk across, as the map's place assumes`);
      if (touch) {
        assert.deepEqual(seen.thumbs, [[seen.thumb, seen.thumb], [seen.thumb, seen.thumb], [78, 78]], `on ${where} go down and fly are --touch across, and jump 78 px`);
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

test('an island you made is saved, under the name you typed, and can be opened again', { skip }, async () => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`saver: ${error.message}`));
  await page.setViewport({ width: 720, height: 480 });
  page.setDefaultNavigationTimeout(60000 * SLOW);
  await page.goto(base + '?p2p=1');
  await page.waitForFunction(() => window.kidsWorld?.ui, { timeout: 60000 * SLOW });
  await makeIsland(page, { online: false, theme: 'Flat Land', name: '  민지네   블록 섬 🧱' });
  const name = '민지네 블록 섬 🧱';
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

test('the ranking shows the players with a login to anyone, marks you once logged in, and lets you leave it and come back', { skip }, async () => {
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
