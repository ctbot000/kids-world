// Starts everything: the title screen with its little demo island, making,
// visiting and reopening islands, saving the islands you host, logging in and
// out, and the frame loop.
import { buildAtlas } from './render/atlas.js';
import { Renderer } from './render/renderer.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { KeeperClient, KeeperProblem } from './keeper.js';
import { GuestLink, HostLink, signalingOptions, WsLink } from './net.js';
import { Profile } from './profile.js';
import { Sound } from './sound.js';
import * as storage from './storage.js';
import { UI } from './ui.js';
import { isValidCode, normalizeCode } from './shared/codes.js';
import { cleanListing } from './shared/listing.js';
import { addProgress, mergeProfiles } from './shared/keeper.js';
import { generate, SIZES } from './shared/worldgen.js';

const params = new URLSearchParams(location.search);
// Who is playing: the player logged in on this device, with their own things
// here, or the guest. Logging in or out reloads the page as the other.
const who = storage.loadWho();
storage.useSpace(who?.player ?? null);
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
// Copies of your islands and of you go to the keeper whenever it is online,
// and logged in, what your other devices sent comes back.
const keeper = new KeeperClient({ profile, login: who });
keeper.addEventListener('status', () => ui.renderKeeper());
keeper.addEventListener('kept', () => ui.renderKeeper());
keeper.addEventListener('config', () => ui.renderLogin());
keeper.addEventListener('islands', () => ui.renderIslandList());
keeper.addEventListener('synced', () => ui.renderKeeper());
keeper.addEventListener('gone', () => loginGone());
keeper.addEventListener('needs-password', () => {
  if (!session && !ui.modalOpen) ui.makeLoginDialog({ why: 'Logins have passwords now, instead of secret pictures. Pick one for yours!' });
  else ui.toast('🔑', 'Your login needs a password now: pick one in 🔑 My login on the title screen.');
});
// An invitation to a friend's island, while you are playing (see invited()).
keeper.addEventListener('invite', (e) => invited(e.detail));
for (const type of ['change', 'basket', 'sticker']) profile.addEventListener(type, () => keeper.nudge());
profile.addEventListener('count', () => keeper.counted());
if (who) {
  const note = () => storage.notePlayer({ player: who.player, username: keeper.login.username, name: profile.name, look: profile.look });
  note();
  // A login from before usernames learns its own from the keeper.
  keeper.addEventListener('username', () => {
    storage.saveWho(keeper.login);
    note();
  });
  profile.addEventListener('change', () => {
    note();
    if (!session && demo.world) showDemoAvatar();
    ui.renderMe();
  });
}

let peerOptions = {};
let signalError = '';
try {
  peerOptions = signalingOptions(params);
} catch (error) {
  signalError = error.message;
}

let serverMode = false;
let session = null;
const demo = { world: null, avatar: null, t: 0, pose: null };

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
window.addEventListener('resize', () => {
  renderer.resize();
  // Turning the screen round moves the dialog, and you with it.
  if (demo.pose || session?.game.portrait) lookAtMe(true);
});
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
  if (demo.pose) {
    // Close up, facing the camera, while you choose how you look.
    v.dist += (demo.pose.dist - v.dist) * Math.min(1, dt * 4);
    v.pitch += (0.12 - v.pitch) * Math.min(1, dt * 4);
    v.yaw += dt * 0.12;
    v.shift = demo.pose.shift;
    v.lift = demo.pose.lift;
    if (a) a.root.rotation.y = v.yaw;
  } else {
    v.shift = 0;
    v.lift = 0;
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
  const tall = renderer.camera.aspect < 0.8 && !demo.pose;
  renderer.updateCamera(dt, { x: s.x, y: s.y - (tall ? 1.3 : 0.35), z: s.z }, false);
  renderer.frame(dt, { time: 0.36, weather: 'clear', focus: s });
}

// Where your character shows while the see-through "Change me" dialog covers
// part of the screen: beside it on a wide screen, and above it where it is a
// sheet along the bottom, far enough away to fit. aim: how high above your
// feet the camera looks.
function portraitView(aim) {
  if (window.innerWidth >= 900) return { shift: 1.1, lift: 0, dist: 3.4 };
  const modal = document.getElementById('modal');
  const h = window.innerHeight;
  // The room between the notch and the sheet, in shares of the screen's height.
  const top = parseFloat(getComputedStyle(modal).paddingTop) / h;
  const bottom = Math.max(top + 0.2, modal.querySelector('.panel').offsetTop / h);
  const t = Math.tan((renderer.camera.fov * Math.PI) / 360);
  // All of you (a bunny's ears are 1.9 up) fills 4/5 of the room...
  const dist = Math.max(3.4, 1.9 / (0.8 * (bottom - top) * 2 * t));
  // ...with your middle in the middle of it.
  const lift = 0.5 + (aim - 0.95) / (2 * dist * t) - (top + bottom) / 2;
  return { shift: 0, lift, dist };
}

// Turns the camera to you while you choose how you look, or back (on: false).
// The title looks at your middle; a game looks 1.25 above your feet.
function lookAtMe(on) {
  demo.pose = on && !session ? portraitView(0.9) : null;
  session?.game.setPortrait(on, on ? portraitView(1.25) : undefined);
}

// ------------------------------------------------ sessions

function tokenKey(kind, id) {
  return `${kind}:${id}`;
}

// first(game): the message that opens the connection (a join, or making an island on the server).
// visit: the code of a friend's island you are visiting, and passcode: the
// one you typed for it.
// pass: from an invitation to it, which lets you in without its passcode.
function startSession({ link, mode, islandId = null, key, loadingText, first = (game) => game.joinMessage(), visit = '', passcode = '', pass = '' }) {
  endSession(false);
  const game = new Game({ link, renderer, sound, profile, mode });
  game.token = profile.token(key);
  game.typedPasscode = passcode;
  game.invitePass = pass;
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
    const { code, text, wrong, wait } = e.detail;
    backToTitle();
    // An island with a passcode: type it, and off you go again.
    if (code === 'passcode' && visit && !wait) {
      ui.passcodeDialog({ wrong }, (typed) => visitIsland(visit, typed));
      return;
    }
    ui.toast(wait ? '⏳' : '🙈', text, 'warn');
  });
  if (mode === 'host') link.room.onUpdate = () => session && (session.dirty = true);
  link.start(() => first(game));
  updateListing();
  return session;
}

function endSession(save = true) {
  if (!session) return;
  const s = session;
  clearTimeout(s.goneTimer);
  if (save) saveIsland();
  session = null;
  updateListing();
  s.game.close();
  s.link.close();
  ui.detach();
  sound.stopMusic();
}

function backToTitle() {
  endSession();
  if (reloadAtTitle) {
    reloadAs(reloadAtTitle);
    return;
  }
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
  keeper.nudge();
}
setInterval(() => {
  if (session?.dirty) saveIsland();
}, 15000);

// The island you host peer to peer is on the keeper's list of open islands
// while friends can visit it: how many are on it, whether it has a passcode
// and so on, as they change. (On the dedicated server, the server lists it.)
function updateListing() {
  const link = session?.mode === 'host' ? session.link : null;
  const open = link && session.started && link.online && link.state === 'online';
  keeper.setListing(open ? link.room.listing() : null);
}
setInterval(updateListing, 3000);
window.addEventListener('pagehide', () => saveIsland());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveIsland();
});

// adventure: monster camps all over it, to free with friends (shared/adventure.js).
function makeIsland({ theme, size, name, online, settings = null, adventure = false }) {
  if (serverMode && online) {
    const link = new WsLink({ url: wsUrl() });
    // The first message makes the island; reconnecting later is an ordinary visit.
    startSession({
      link,
      mode: 'server',
      key: tokenKey('server', 'new'),
      loadingText: 'Making your island…',
      first: (game) => (game.code ? { ...game.joinMessage(), code: game.code } : { ...game.joinMessage(), t: 'create', theme, size, name, adventure, ...(settings ? { settings } : {}) }),
    });
    return;
  }
  const islandId = storage.newIslandId();
  const link = new HostLink({ island: { theme, size, name, settings, adventure }, online: online && !signalError, peerOptions });
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

// passcode: the one you typed for an island that has one. pass: from an
// invitation, which lets you in without it.
function visitIsland(raw, passcode = '', pass = '') {
  const code = normalizeCode(raw);
  if (!isValidCode(code)) {
    ui.toast('🙈', 'An island code has 6 numbers.', 'warn');
    return;
  }
  if (serverMode) {
    const link = new WsLink({ url: wsUrl() });
    startSession({ link, mode: 'server', key: tokenKey('server', code), loadingText: 'Flying to your friend’s island…', first: (game) => ({ ...game.joinMessage(), code }), visit: code, passcode, pass });
    return;
  }
  if (signalError) {
    ui.toast('🙈', signalError, 'warn');
    return;
  }
  const link = new GuestLink({ code, peerOptions });
  startSession({ link, mode: 'guest', key: tokenKey('visit', code), loadingText: 'Flying to your friend’s island…', visit: code, passcode, pass });
}

// Whether you have been on this island before, and so come back without its passcode.
function visitedBefore(code) {
  return Boolean(profile.token(tokenKey(serverMode ? 'server' : 'visit', code)));
}

// The list of open islands: the dedicated server's own, or peer to peer,
// the keeper's. Resolves with the listings; rejects with a KeeperProblem
// (none: there is no keeper to ask).
async function openIslands() {
  if (!serverMode) return keeper.openIslands();
  const res = await fetch('api/islands', { cache: 'no-store' });
  if (!res.ok) throw new KeeperProblem('bad');
  const reply = await res.json();
  return (Array.isArray(reply.islands) ? reply.islands : []).map(cleanListing).filter(Boolean);
}

// ------------------------------------------------ inviting players

// Inviting a player from the players list to the island you are on: its
// code, name and kind, and as its owner, a pass that lets them in without
// its passcode. Rejects with a KeeperProblem (see KeeperClient.invite).
async function invitePlayer(id) {
  const g = session?.game;
  if (!g?.code || !g.world) throw new KeeperProblem('bad');
  const island = {
    code: g.code,
    name: g.world.name,
    theme: g.world.theme,
    size: SIZES.find((s) => s.side === g.world.W)?.key ?? SIZES[0].key,
    server: serverMode,
  };
  if (g.settings.passcode && g.pid === g.host) {
    const pass = await g.askPass();
    if (pass) island.pass = pass;
  }
  return keeper.invite(id, island);
}

// Someone invited you to their island: a card says who and where, unless you
// are there already, or it is on a dedicated server and you are playing peer
// to peer (or the other way round), where its code means nothing.
function invited({ from, island }) {
  if (island.server !== serverMode || (session?.game.code === island.code && session.started)) return;
  ui.invitation({ from, island }, () => {
    // Off the island you are on first, saving it if it is yours.
    if (session) backToTitle();
    visitIsland(island.code, '', island.pass ?? '');
  });
}

// Logged in, you are playing now while the page is on screen.
function present() {
  keeper.setPresent(Boolean(who) && !document.hidden);
}
document.addEventListener('visibilitychange', present);

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
  // Named after the island, in letters and numbers of any language.
  const base = (snap.meta?.name ?? '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
  a.download = `${base || 'island'}.kidsworld.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ------------------------------------------------ logging in and out

// What the page says once it has reloaded as someone else.
const GREETINGS = {
  login: ['🔑', (name) => `Hi, ${name}! You are logged in. Your islands are on their way from the island keeper.`],
  adopted: ['🧳', (name) => `Hi, ${name}! What you made on this device is yours now, on all your devices.`],
  made: ['🔑', () => 'Your login is ready! Log in on your other devices with your username and password.'],
  logout: ['👋', () => 'Logged out. See you soon!'],
  gone: ['🔑', () => 'Your login was taken away at the island keeper, so you are playing as a guest now.'],
};
let reloadAtTitle = '';
let lookTimer = 0;

function reloadAs(greeting) {
  try {
    sessionStorage.setItem('kidsworld.greeting', greeting);
  } catch {
    // no greeting, then
  }
  location.reload();
}

function greet() {
  let greeting = '';
  try {
    greeting = sessionStorage.getItem('kidsworld.greeting') ?? '';
    sessionStorage.removeItem('kidsworld.greeting');
  } catch {
    return;
  }
  const [icon, text] = GREETINGS[greeting] ?? [];
  if (icon) setTimeout(() => ui.toast(icon, text(profile.name)), 400);
}

// Logged in somewhere else: this device plays as them from now on, with
// their own things here if they played here before, else what the keeper
// has of them (keeping this device's settings). adopt: the guest's things
// here are theirs, and come along (the keeper has moved its copies of them
// already); the guest starts afresh.
function playAs({ player, token, username = '', profile: kept }, { adopt = false } = {}) {
  const d = profile.data;
  const here = storage.loadFor(player, 'profile', null);
  let mine = here ?? (kept ? { ...kept, settings: d.settings, hotbar: d.hotbar, seenHelp: d.seenHelp } : null);
  if (adopt) profile.freeze();
  if (adopt && storage.moveGuestIslandsTo(player)) {
    const base = here && kept ? { ...here, ...mergeProfiles(here, kept) } : (mine ?? {});
    mine = { ...base, ...addProgress(base, d), changedAt: Date.now(), tokens: { ...d.tokens, ...base.tokens } };
    storage.resetGuest();
  }
  if (mine && mine !== here) storage.saveFor(player, 'profile', mine);
  storage.saveWho({ player, token, username });
  storage.notePlayer({ player, username, name: mine?.name ?? kept?.name ?? '', look: mine?.look ?? kept?.look ?? null });
  reloadAs(adopt ? 'adopted' : 'login');
}

// The guest made a login: their things here become the player's.
function becamePlayer({ player, token, username = '' }) {
  profile.store();
  keeper.store();
  if (!storage.moveGuestTo(player)) throw new KeeperProblem('room');
  storage.useSpace(player);
  storage.saveWho({ player, token, username });
  storage.notePlayer({ player, username, name: profile.name, look: profile.look });
}

// The keeper says the login this page used is gone (taken away in its
// admin pages): this device plays as the guest again, as soon as it can.
function loginGone() {
  storage.saveWho(null);
  if (who) storage.forgetPlayer(who.player);
  if (session) reloadAtTitle = 'gone';
  else reloadAs('gone');
}

const loginHandlers = {
  available: () => Boolean(keeper.config),
  who: () => who,
  // The login's username, which only you see (in games you are your made-up name).
  username: () => keeper.login?.username || '',
  // Players who logged in on this device before, to pick from.
  known: () => storage.knownPlayers().filter((p) => p.player !== who?.player && (p.username || p.name)),
  // What the guest has on this device, for a player logging in to bring
  // along if it is theirs: { name, islands, stickers, treasures }, or null.
  guest: () => {
    if (who) return null;
    const d = profile.data;
    const things = {
      name: profile.name,
      islands: storage.listIslands().length,
      stickers: Object.keys(d.stickers).length,
      treasures: Object.values(d.basket).reduce((a, b) => a + b, 0),
    };
    return things.islands || things.stickers || things.treasures ? things : null;
  },
  // Resolves with the keeper's answer, for enter() once you say whether the
  // guest's things here are yours.
  logIn: (username, password) => keeper.logIn(username, password),
  enter: async (reply, adopt) => {
    if (adopt) await keeper.adopt(reply.player, reply.token);
    playAs(reply, { adopt });
  },
  // Logged in: a new password. As the guest: a login with this username
  // (asName: as your name in games too), after which the page reloads as the
  // player once the dialog saying so is closed.
  make: async (password, username = null, { asName = false } = {}) => {
    const reply = await keeper.makeLogin(password, who ? null : username);
    if (!who && asName && reply.username !== profile.name) profile.update({ name: reply.username });
    if (!who) becamePlayer(reply);
    return reply;
  },
  made: () => reloadAs('made'),
  logOut: async () => {
    await keeper.logOut();
    storage.saveWho(null);
    reloadAs('logout');
  },
  keeper,
};

const titleHandlers = {
  make: (opts) => makeIsland(opts),
  visit: (code, passcode = '') => visitIsland(code, passcode),
  // The list of open islands is there with the dedicated server, or a keeper.
  listAvailable: () => serverMode || Boolean(keeper.config),
  openIslands,
  visitedBefore,
  islands: () => storage.listIslands(),
  open: (id) => openIsland(id),
  forget: (id) => {
    storage.forgetIsland(id);
    keeper.forget(id);
  },
  login: loginHandlers,
  openFile: (save) => {
    const id = storage.newIslandId();
    openIsland(id, save);
  },
  // In a game, friends see the new look, and the new display name, once
  // you stop typing it for a moment.
  lookChanged: () => {
    clearTimeout(lookTimer);
    if (session?.game) lookTimer = setTimeout(() => session?.game.send({ t: 'look', look: profile.look, name: profile.name }), 400);
    else showDemoAvatar();
  },
  lookOpen: () => lookAtMe(true),
  lookDone: () => lookAtMe(false),
};

const gameHandlers = {
  canInvite: () => session && (session.mode !== 'host' || session.link.online),
  inviteLink,
  invitePlayer,
  canToggleOnline: () => session?.mode === 'host' && !signalError,
  isOnline: () => session?.link.online ?? false,
  setOnline: (on) => {
    session?.link.setOnline(on);
    ui.renderIsland();
    updateListing();
  },
  // A passcode for the island ('' for none), as its owner.
  setPasscode: (passcode) => session?.game.send({ t: 'host', cmd: 'passcode', passcode }),
  canSave: () => session?.mode === 'host',
  saveFile: () => downloadIsland(),
  keeper,
  login: loginHandlers,
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
      case 'KeyQ':
        g.toggleRide();
        return true;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyC':
        // Down, as ever, and off an animal on land.
        g.pressDown();
        return false;
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
    ui.frame(dt);
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
  keeper,
  get session() {
    return session;
  },
  get game() {
    return session?.game ?? null;
  },
  // Only the last step is drawn. Drawing them all would hand a software GPU
  // (all a CI machine has) seconds of frames to work through, and nothing new
  // reaches the screen until it is done: not a speech bubble, not a toast.
  step(seconds = 1 / 60, times = 1) {
    try {
      for (let i = 0; i < times; i++) {
        renderer.drawing = i === times - 1;
        step(seconds);
      }
    } finally {
      renderer.drawing = true;
    }
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
  greet();
  const code = normalizeCode(params.get('code'));
  if (isValidCode(code)) ui.visitDialog(code);
  requestAnimationFrame(frame);
  present();
  keeper.start();
}

boot();
