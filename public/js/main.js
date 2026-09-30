// Starts everything: the title screen with its little demo island, making,
// visiting and reopening islands, saving the islands you host, and the
// frame loop.
import { buildAtlas } from './render/atlas.js';
import { Renderer } from './render/renderer.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { GuestLink, HostLink, signalingOptions, WsLink } from './net.js';
import { Profile } from './profile.js';
import { Sound } from './sound.js';
import * as storage from './storage.js';
import { UI } from './ui.js';
import { isValidCode, normalizeCode } from './shared/codes.js';
import { generate } from './shared/worldgen.js';

const params = new URLSearchParams(location.search);
const profile = new Profile();
const sound = new Sound();
sound.setLevels(profile.settings);
const atlas = buildAtlas();
const canvas = document.getElementById('world');
let renderer;
try {
  renderer = new Renderer(canvas, atlas);
} catch (error) {
  // Without WebGL 2 there is no island to show; say so kindly and stop.
  document.getElementById('loading').hidden = false;
  document.getElementById('loading-text').textContent = 'Kids World needs a browser that can draw 3D pictures (WebGL 2). Try another browser or device.';
  throw error;
}
const input = new Input(canvas, document.getElementById('joystick'));
const ui = new UI({ profile, sound, atlas, input });

let peerOptions = {};
let signalError = '';
try {
  peerOptions = signalingOptions(params);
} catch (error) {
  signalError = error.message;
}

let serverMode = false;
let session = null;
const demo = { world: null, avatar: null, t: 0, looking: false };

// Quality steps down by itself on devices that struggle: first fewer pixels,
// then no studs and a shorter view.
const perf = { frames: 0, since: performance.now(), level: 0 };

function applySettings() {
  const touch = input.touchMode;
  const dpr = window.devicePixelRatio || 1;
  renderer.setQuality({
    studs: profile.settings.studs && perf.level < 2,
    pixelRatio: perf.level >= 1 ? 1 : Math.min(dpr, touch ? 1.5 : 2),
    far: perf.level >= 2 ? 110 : 150,
  });
}

function watchPerformance(now) {
  if (document.hidden || perf.level >= 2) {
    perf.frames = 0;
    perf.since = now;
    return;
  }
  perf.frames++;
  const secs = (now - perf.since) / 1000;
  if (secs < 5) return;
  const fps = perf.frames / secs;
  perf.frames = 0;
  perf.since = now;
  if (fps < 26 && session?.started) {
    perf.level++;
    applySettings();
  }
}
applySettings();
window.addEventListener('resize', () => renderer.resize());
document.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
document.addEventListener('keydown', () => sound.unlock(), { capture: true });

// ------------------------------------------------ the title screen's island

function startDemo() {
  const seed = 20261001 + (new Date().getDate() % 7);
  const { world } = generate({ seed, theme: 'sunny', name: 'Kids World' });
  demo.world = world;
  renderer.setWorld(world);
  renderer.terrain.buildAll();
  showDemoAvatar();
  renderer.view.dist = 7.5;
  renderer.view.pitch = 0.22;
}

function showDemoAvatar() {
  renderer.removeAvatar(-1);
  const s = demo.world.spawn;
  const a = renderer.addAvatar(-1, profile.look, profile.name);
  a.root.position.set(s.x, s.y, s.z);
  a.playEmote('wave');
  demo.avatar = a;
}

function demoFrame(dt) {
  if (!demo.world) return;
  demo.t += dt;
  const s = demo.world.spawn;
  const a = demo.avatar;
  const v = renderer.view;
  if (demo.looking) {
    // Close up, facing the camera, while you choose how you look.
    v.dist += (3.4 - v.dist) * Math.min(1, dt * 4);
    v.pitch += (0.12 - v.pitch) * Math.min(1, dt * 4);
    v.yaw += dt * 0.12;
    v.shift = portraitShift();
    if (a) a.root.rotation.y = v.yaw;
  } else {
    v.shift = 0;
    v.dist += (7.5 - v.dist) * Math.min(1, dt * 2);
    v.pitch += (0.22 - v.pitch) * Math.min(1, dt * 2);
    v.yaw += dt * 0.06;
    if (a) a.root.rotation.y = v.yaw;
    if (a && demo.t % 7 < dt) a.playEmote(['wave', 'dance', 'cheer', 'hearts'][Math.floor(demo.t / 7) % 4]);
  }
  if (a) {
    a.update(dt, 0, 0);
    renderer.placeShadow(a.shadow, s.x, s.y, s.z);
  }
  // On a tall screen the buttons fill the bottom half, so look a little lower to lift the avatar.
  const tall = renderer.camera.aspect < 0.8 && !demo.looking;
  renderer.updateCamera(dt, { x: s.x, y: s.y - (tall ? 1.3 : 0.35), z: s.z }, false);
  renderer.frame(dt, { time: 0.36, weather: 'clear', focus: s });
}

// Where to put your character while a see-through dialog covers part of the screen.
function portraitShift() {
  return window.innerWidth >= 900 ? 1.1 : 0;
}

// ------------------------------------------------ sessions

function tokenKey(kind, id) {
  return `${kind}:${id}`;
}

// first(game): the message that opens the connection (a join, or making an island on the server).
function startSession({ link, mode, islandId = null, key, loadingText, first = (game) => game.joinMessage() }) {
  endSession(false);
  const game = new Game({ link, renderer, sound, profile, mode });
  game.token = profile.token(key);
  renderer.removeAvatar(-1);
  demo.avatar = null;
  session = { link, game, mode, islandId, key, started: false, dirty: false };
  ui.hideTitle();
  ui.loading(loadingText, () => backToTitle());
  link.addEventListener('status', (e) => {
    const { state, text } = e.detail;
    if (!session || session.link !== link) return;
    ui.setStatus(state, text);
    if (!session.started) {
      if (state === 'failed') ui.loading(`😕 ${text}`, () => backToTitle());
      else if (state !== 'online') ui.loading(text, () => backToTitle());
      return;
    }
    // A visitor whose friend's island went away: after a little while, ask what to do.
    clearTimeout(session.goneTimer);
    if (mode !== 'host' && (state === 'offline' || state === 'reconnecting' || state === 'failed')) {
      session.goneTimer = setTimeout(() => {
        if (session?.link === link && link.state !== 'online') ui.islandGone(() => backToTitle());
      }, state === 'failed' ? 0 : 12000);
    }
  });
  link.addEventListener('code', () => {
    if (session?.link !== link) return;
    game.code = link.code;
    ui.renderIsland();
  });
  game.addEventListener('welcome', (e) => {
    if (session?.game !== game) return;
    profile.setToken(key, game.token);
    if (!session.started) {
      session.started = true;
      ui.hideLoading();
      ui.attach(game, gameHandlers);
      sound.startMusic();
      if (mode !== 'host') profile.count('visits');
      if (!profile.data.seenHelp) {
        profile.update({ seenHelp: true });
        setTimeout(() => ui.toast('👋', 'Welcome! Walk with WASD or your thumb, and tap to build. ❓ shows how to play.'), 600);
      }
    }
    ui.renderIsland();
    if (mode === 'host') saveIsland();
  });
  game.addEventListener('fatal', (e) => {
    if (session?.game !== game) return;
    const { text } = e.detail;
    backToTitle();
    ui.toast('🙈', text, 'warn');
  });
  if (mode === 'host') link.room.onUpdate = () => session && (session.dirty = true);
  link.start(() => first(game));
  return session;
}

function endSession(save = true) {
  if (!session) return;
  const s = session;
  clearTimeout(s.goneTimer);
  if (save) saveIsland();
  session = null;
  s.game.close();
  s.link.close();
  ui.detach();
  sound.stopMusic();
}

function backToTitle() {
  endSession();
  ui.hideLoading();
  if (demo.world) {
    renderer.setWorld(demo.world);
    renderer.terrain.buildAll();
    showDemoAvatar();
  }
  ui.showTitle(titleHandlers);
}

// Hosted islands are saved in this browser, often, and whenever the page goes away.
function saveIsland() {
  if (!session?.started || session.mode !== 'host' || !session.islandId) return;
  session.dirty = false;
  const ok = storage.storeIsland(session.islandId, session.link.exportSave());
  if (!ok && !session.warnedFull) {
    session.warnedFull = true;
    ui.toast('💾', 'This browser is out of room to save islands. Use ⚙️ → Save island to a file.', 'warn');
  }
}
setInterval(() => {
  if (session?.dirty) saveIsland();
}, 15000);
window.addEventListener('pagehide', () => saveIsland());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveIsland();
});

function makeIsland({ theme, name, online }) {
  if (serverMode && online) {
    const link = new WsLink({ url: wsUrl() });
    // The first message makes the island; reconnecting later is an ordinary visit.
    startSession({
      link,
      mode: 'server',
      key: tokenKey('server', 'new'),
      loadingText: 'Making your island…',
      first: (game) => (game.code ? { ...game.joinMessage(), code: game.code } : { ...game.joinMessage(), t: 'create', theme, name }),
    });
    return;
  }
  const islandId = storage.newIslandId();
  const link = new HostLink({ island: { theme, name }, online: online && !signalError, peerOptions });
  startSession({ link, mode: 'host', islandId, key: tokenKey('island', islandId), loadingText: 'Making your island…' });
  if (online && signalError) ui.toast('🙈', signalError, 'warn');
}

function openIsland(id, save = null) {
  const snapshot = save ?? storage.loadIsland(id);
  if (!snapshot) {
    ui.toast('😕', 'That island could not be found.', 'warn');
    return;
  }
  let link;
  try {
    link = new HostLink({ island: { save: snapshot }, online: !signalError, peerOptions });
  } catch (error) {
    ui.toast('😕', `That island could not be opened: ${error.message}`, 'warn');
    return;
  }
  startSession({ link, mode: 'host', islandId: id, key: tokenKey('island', id), loadingText: 'Opening your island…' });
}

function visitIsland(raw) {
  const code = normalizeCode(raw);
  if (!isValidCode(code)) {
    ui.toast('🙈', 'An island code has 6 numbers.', 'warn');
    return;
  }
  if (serverMode) {
    const link = new WsLink({ url: wsUrl() });
    startSession({ link, mode: 'server', key: tokenKey('server', code), loadingText: 'Flying to your friend’s island…', first: (game) => ({ ...game.joinMessage(), code }) });
    return;
  }
  if (signalError) {
    ui.toast('🙈', signalError, 'warn');
    return;
  }
  const link = new GuestLink({ code, peerOptions });
  startSession({ link, mode: 'guest', key: tokenKey('visit', code), loadingText: 'Flying to your friend’s island…' });
}

function wsUrl() {
  const u = new URL('ws', location.href);
  u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  u.search = '';
  return u.href;
}

function inviteLink() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('code', session?.game.code ?? '');
  if (params.get('signal')) u.searchParams.set('signal', params.get('signal'));
  return u.href;
}

function downloadIsland() {
  if (!session || session.mode !== 'host') return;
  const snap = session.link.exportSave();
  const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(snap.meta?.name ?? 'island').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.kidsworld.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const titleHandlers = {
  make: (opts) => makeIsland(opts),
  visit: (code) => visitIsland(code),
  islands: () => storage.listIslands(),
  open: (id) => openIsland(id),
  forget: (id) => storage.forgetIsland(id),
  openFile: (save) => {
    const id = storage.newIslandId();
    openIsland(id, save);
  },
  lookChanged: () => {
    if (session?.game) session.game.send({ t: 'look', look: profile.look });
    else showDemoAvatar();
  },
  lookOpen: () => {
    if (!session) demo.looking = true;
    else session.game.setPortrait(true, portraitShift());
  },
  lookDone: () => {
    demo.looking = false;
    session?.game.setPortrait(false);
  },
};

const gameHandlers = {
  canInvite: () => session && (session.mode !== 'host' || session.link.online),
  inviteLink,
  canToggleOnline: () => session?.mode === 'host' && !signalError,
  isOnline: () => session?.link.online ?? false,
  setOnline: (on) => {
    session?.link.setOnline(on);
    ui.renderIsland();
  },
  canSave: () => session?.mode === 'host',
  saveFile: () => downloadIsland(),
  applySettings: () => applySettings(),
  leave: () => backToTitle(),
};
Object.assign(ui, { handlers: titleHandlers });

// ------------------------------------------------ keys and pointer

input
  .on('unlock', () => sound.unlock())
  .on('tap', (ndc, button) => {
    const g = session?.game;
    if (!g || ui.modalOpen) return;
    if (g.holdActed) {
      g.holdActed = false;
      return;
    }
    g.use(ndc, button === 2);
  })
  .on('hold', (down, ndc) => {
    const g = session?.game;
    if (!g) return;
    if (down) {
      g.holding = { at: performance.now() + 420, ndc };
      g.holdActed = false;
    } else if (g.holding) {
      g.holdActed = g.holding.acted === true;
      g.holding = null;
    }
  })
  .on('orbit', (dx, dy, type) => {
    const k = type === 'touch' ? 0.009 : 0.006;
    renderer.orbit(-dx * k, dy * k);
  })
  .on('zoom', (f) => renderer.zoom(f))
  .on('pickBlock', (ndc) => {
    if (session?.game && !ui.modalOpen) session.game.pickBlock(ndc);
  })
  .on('key', (code, e) => {
    const g = session?.game;
    if (!g || ui.modalOpen) return false;
    if (code.startsWith('Digit')) {
      const n = Number(code.slice(5));
      ui.selectSlot(n === 0 ? 9 : n - 1);
      return true;
    }
    switch (code) {
      case 'KeyE':
      case 'KeyB':
      case 'Tab':
        ui.toyBox();
        return true;
      case 'KeyT':
      case 'Enter':
        ui.sayDialog();
        return true;
      case 'KeyG':
        ui.emoteDialog();
        return true;
      case 'KeyF':
        g.toggleFly();
        return true;
      case 'KeyZ':
        g.undo();
        return true;
      case 'KeyH':
        ui.helpDialog();
        return true;
      case 'KeyP':
        ui.takePhoto();
        return true;
      case 'KeyM':
        profile.setting('music', profile.settings.music > 0 ? 0 : 0.5);
        sound.setLevels(profile.settings);
        ui.toast(profile.settings.music > 0 ? '🎵' : '🔇', profile.settings.music > 0 ? 'Music on' : 'Music off');
        return true;
      default:
        return false;
    }
  });

// ------------------------------------------------ the frame loop

let last = performance.now();
function step(dt) {
  const g = session?.game;
  if (g?.world && session.started) {
    g.update(dt, input);
    ui.frame();
  } else if (!session) {
    demoFrame(dt);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  step(dt);
  watchPerformance(now);
}

// For automated tests: the running pieces, and a way to step time without frames.
window.kidsWorld = {
  profile,
  renderer,
  ui,
  input,
  get session() {
    return session;
  },
  get game() {
    return session?.game ?? null;
  },
  step(seconds = 1 / 60, times = 1) {
    for (let i = 0; i < times; i++) step(seconds);
  },
};

async function boot() {
  try {
    const res = await fetch('api/info', { cache: 'no-store' });
    if (res.ok) {
      const info = await res.json();
      serverMode = info.app === 'kids-world' && info.mode === 'server' && params.get('p2p') !== '1';
    }
  } catch {
    serverMode = false;
  }
  startDemo();
  ui.showTitle(titleHandlers);
  const code = normalizeCode(params.get('code'));
  if (isValidCode(code)) ui.visitDialog(code);
  requestAnimationFrame(frame);
}

boot();
