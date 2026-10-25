// The CTB island: an island of this server where CTB's workers (ctb.js) have
// their office, a glass-and-white building with a big "CTB" sign on its
// roof, and inside it a desk for each of them, with a chair and a computer.
// Each worker is a player on the island, joined the way the AI friend
// joins one (dialer.js LocalLink), sitting at their desk and saying what they
// are working on — which is real work on this project: GitHub issues turned
// into pull requests. Children can visit, look round and ask them what they
// are doing. The island's owner is one login, set on the admin page (izeye
// unless changed), and nobody builds or draws there, not even them, so the
// office stays as it is; while they are away nobody owns it — never a worker, a visitor or the AI
// friend, which does not come here at all. It is saved in the keeper's data folder
// (ctb-island.json), and with the keeper online hosted peer to peer too
// (host.js) and on its list of open islands, as the AI friend's own island is.
// It is the one island a page opens without anyone logging in, from the link
// <game>/?ctb (see main.js), so anyone can come and watch them work.
import { EventEmitter } from 'node:events';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as B from '../public/js/shared/blocks.js';
import { generateCode } from '../public/js/shared/codes.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { seatPose } from '../public/js/shared/seats.js';
import { placeTemplate, stampByKey } from '../public/js/shared/stamps.js';
import { applyCells } from '../public/js/shared/tools.js';
import { CHAT_MAX, cleanChat, cleanLook, EMOTE_KEYS, PHRASES, STICKERS } from '../public/js/shared/words.js';
import { reachOf } from './builds.js';
import { LocalLink } from './dialer.js';
import { PeerHost } from './host.js';

export const ISLAND_NAME = 'CTB';
// Where the game is played, for the island's link (KIDS_WORLD_PAGES_URL to change it).
export const PAGES_URL = process.env.KIDS_WORLD_PAGES_URL || 'https://ctbot000.github.io/kids-world/';
// As the renderer's poses (render/avatar.js ANIM): typing at the desk while
// working on something, sitting back with a coffee while not.
const TYPE = 12;
const COFFEE = 13;
const SAVE_MS = 5 * 60000;
// Answering children: one worker at a time, and not too often.
const ANSWER_GAP_MS = 6000;
// An owner no page can be (a login's hash is 64 hex digits): the island has none.
const NOBODY = 'nobody';
// Where visitors arrive: on the plaza's paving, this far before the doors.
const ARRIVE_DZ = -31;
// How far before the grounds the land is cleared, for the view arriving.
const VIEW_CLEARING = 6;
// How high over an old office's floor is cleared when a new one goes up.
const CLEAR_HEIGHT = 20;

const [, , , , , TEAL, , , , , , WHITE, GRAY, CHARCOAL] = B.TOY_BRICKS;
const [, BLUE_CARPET] = B.CARPETS;
const [, , , , BLUE_CLOTH, , , WHITE_CLOTH] = B.CLOTHS;

// The workers' looks: grown-ups dressed for the office.
export const STAFF = [
  { name: 'Ada', look: { animal: 'grownup', skin: 'light', hair: 'bun', hairColor: 'black', face: 'glasses', shirt: 7, hat: 'none' } },
  { name: 'Ben', look: { animal: 'grownup', skin: 'brown', hair: 'short', hairColor: 'black', face: 'beard', shirt: 12, hat: 'none' } },
  { name: 'Cleo', look: { animal: 'grownup', skin: 'golden', hair: 'ponytail', hairColor: 'ginger', face: 'none', shirt: 11, hat: 'none' } },
  { name: 'Dev', look: { animal: 'grownup', skin: 'deep', hair: 'curly', hairColor: 'black', face: 'glasses-beard', shirt: 5, hat: 'headphones' } },
];
export const MAX_WORKERS = STAFF.length;
export const workerName = (k) => `${STAFF[k].name} 💼`;

// Which office the island has: a newer one is put up in place of an older one
// (5: the same office, put up again over what visitors had changed of it).
export const OFFICE_VERSION = 5;

// Three by five letters for the signs, top row first.
const LETTERS = {
  C: ['###', '#..', '#..', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
};

// "CTB" in cells: across from x0 (to the right), its top row at y0, on the
// plane z, each dot of the letters size by size cells.
function word(put, x0, y0, z, id, size = 1) {
  [...'CTB'].forEach((ch, k) => {
    LETTERS[ch].forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell !== '#') return;
        for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) put(x0 + (k * 4 + c) * size + i, y0 - r * size - j, z, id);
      });
    });
  });
}

// The grounds the office stands in, in its own cells: from the hedge at the
// front, where visitors arrive at the end of the boulevard, to the pines
// behind it. They are levelled before the office goes up.
export const GROUNDS = { x0: -16, x1: 16, z0: -41, z1: 20 };

// The office as cells [dx, dy, dz, block] (as a stamp's: dx to the right of
// someone standing at its front, dz away from them, dy up from the ground),
// its doors at dz = 0: a modern glass building, one tall floor, with "CTB"
// in white letters along its roof. A paved plaza in front with planters and
// lights; inside, a lobby with a reception desk before a charcoal logo wall,
// the team's desks in pairs facing each other, each with a chair and a
// computer, a glass meeting room with a long table and a screen on its
// wall, a lounge and a pantry. The desks' chairs are where the workers sit.
export function officeCells() {
  const map = new Map();
  const put = (x, y, z, id) => map.set(`${x},${y},${z}`, [x, y, z, id]);
  const box = (x0, y0, z0, x1, y1, z1, id) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id);
  };
  const W = 11;
  const D = 16;
  const H = 9;
  // Where the glass is crossed by a charcoal band, as if at a second floor.
  const FLOOR_LINE = 5;
  const G = GROUNDS;
  // The grounds, level with the ground about them: a lawn inside a hedge,
  // open at the front where the boulevard begins.
  box(G.x0, -1, G.z0, G.x1, -1, G.z1, B.GRASS);
  for (let x = G.x0; x <= G.x1; x++) {
    if (Math.abs(x) > 3) put(x, 0, G.z0, B.LEAVES);
    put(x, 0, G.z1, B.LEAVES);
  }
  for (let z = G.z0; z <= G.z1; z++) for (const x of [G.x0, G.x1]) put(x, 0, z, B.LEAVES);
  // The boulevard, paved and edged in white, from the front of the grounds
  // to a step at the doors, round a fountain on a paved circle halfway.
  box(-2, -1, G.z0, 2, -1, -1, B.PEBBLES);
  for (let z = G.z0; z <= -1; z++) for (const x of [-3, 3]) put(x, -1, z, WHITE);
  const [fz, fr] = [-13, 6];
  for (let x = -fr - 1; x <= fr + 1; x++) {
    for (let z = fz - fr - 1; z <= fz + fr + 1; z++) {
      const d = Math.hypot(x, z - fz);
      if (d <= fr + 0.5) put(x, -1, z, d > fr - 0.5 ? WHITE : B.PEBBLES);
    }
  }
  for (const [x, y, z, id] of stampByKey('fountain').cells) put(x, y, z + fz - 3, id);
  box(-2, 0, -1, 2, 0, -1, B.PEBBLES);
  // Lamps along the way, beds of flowers either side, and great trees by the fountain.
  for (const x of [-4, 4]) for (const z of [-39, -35, -27, -23, -5, -2]) put(x, 0, z, B.FLOOR_LAMP);
  // Gate pillars where visitors arrive, a lamp on each.
  for (const x of [-4, 4]) {
    for (let y = 0; y <= 3; y++) put(x, y, -31, CHARCOAL);
    put(x, 4, -31, B.LAMP);
  }
  const flowers = [B.TULIP, B.DAISY, B.BLUEBELL];
  for (const x of [-9, -8, -7, -6, 6, 7, 8, 9]) {
    for (const z of [-38, -37, -36, -30, -29, -28, -24, -23, -22, -6, -5, -4]) put(x, 0, z, flowers[(x + z + 50) % 3]);
  }
  for (const x of [-12, 12]) for (const [dx, dy, dz, id] of stampByKey('big-tree').cells) put(x + dx, dy, fz + dz, id);
  // Flagpoles before the building, their flags in blue and white.
  for (const x of [-12, -8, 7, 11]) {
    for (let y = 0; y <= 6; y++) put(x, y, -3, B.FENCE);
    box(x + 1, 5, -3, x + 2, 6, -3, (x + 12) % 8 ? BLUE_CLOTH : WHITE_CLOTH);
  }
  // Pines behind and beside the building, against the sky.
  for (const x of [-14, 14]) for (const z of [3, 10, 17]) for (const [dx, dy, dz, id] of stampByKey('pine').cells) put(x + dx, dy, z + dz, id);
  for (const x of [-7, 0, 7]) for (const [dx, dy, dz, id] of stampByKey('pine').cells) put(x + dx, dy, 19 + dz, id);
  // Floor and walls.
  box(-W, 0, 0, W, 0, D, B.PARQUET);
  // A charcoal plinth all round, under the walls.
  for (let x = -W; x <= W; x++) for (let z = 0; z <= D; z++) if (Math.abs(x) === W || z === 0 || z === D) put(x, 0, z, CHARCOAL);
  box(-W + 1, 0, 1, W - 1, 0, 5, B.CHECKER_FLOOR);
  for (let y = 1; y <= H; y++) {
    for (let x = -W; x <= W; x++) {
      for (let z = 0; z <= D; z++) {
        const sideX = x === -W || x === W;
        const sideZ = z === 0 || z === D;
        if (!sideX && !sideZ) {
          put(x, y, z, B.AIR);
          continue;
        }
        const corner = sideX && sideZ;
        let id;
        if (z === 0) {
          // The front: all glass between charcoal columns, under a charcoal band.
          id = corner || y === H || y === FLOOR_LINE || [-8, -4, 4, 8].includes(x) ? CHARCOAL : B.GLASS;
        } else if (sideX) {
          // The sides: ribbons of glass between white bands, charcoal columns.
          id = corner || z % 4 === 0 || y === FLOOR_LINE ? CHARCOAL : y === 1 || y === H ? WHITE : B.GLASS;
        } else {
          // The back: white, with a ribbon of windows.
          id = Math.abs(x) % 4 === 0 || y === FLOOR_LINE ? CHARCOAL : y === 3 || y === 7 ? B.GLASS : WHITE;
        }
        put(x, y, z, id);
      }
    }
  }
  // The doors, three wide and three high, under a charcoal canopy.
  box(-1, 1, 0, 1, 3, 0, B.AIR);
  box(-3, 4, -2, 3, 4, -1, CHARCOAL);
  box(-3, 4, 0, 3, 4, 0, CHARCOAL);
  // A flat roof with a parapet, and "CTB" in white letters along its front.
  box(-W, H + 1, 0, W, H + 1, D, GRAY);
  for (let x = -W; x <= W; x++) for (const z of [0, D]) put(x, H + 2, z, CHARCOAL);
  for (let z = 0; z <= D; z++) for (const x of [-W, W]) put(x, H + 2, z, CHARCOAL);
  // Each dot of the letters two cells: the sign as wide as the building.
  word(put, -11, H + 12, 1, WHITE, 2);
  box(-11, H + 2, 1, 10, H + 2, 1, TEAL);
  // Lights in the ceiling, in a grid.
  for (const x of [-8, -4, 0, 4, 8]) for (const z of [3, 8, 13]) put(x, H, z, B.LAMP);

  // The lobby: a reception desk facing the doors, a charcoal wall behind it
  // with "CTB" on it in white, and seats either side for visitors.
  for (let x = -2; x <= 2; x++) put(x, 1, 3, B.turnedTo(B.COUNTER, 3));
  put(0, 1, 4, B.turnedTo(B.CHAIR, 3));
  put(-2, 2, 3, B.POTTED_PLANT);
  box(-6, 1, 6, 6, 5, 6, CHARCOAL);
  word(put, -5, 5, 5, WHITE);
  for (const z of [2, 3]) {
    put(-W + 1, 1, z, B.turnedTo(B.SOFA, 0));
    put(W - 1, 1, z, B.turnedTo(B.SOFA, 2));
  }
  put(-W + 2, 1, 2, B.TEA_TABLE);
  put(W - 2, 1, 2, B.TEA_TABLE);
  for (const x of [-W + 1, W - 1]) {
    put(x, 1, 1, B.POTTED_PLANT);
    put(x, 1, 4, B.FLOOR_LAMP);
  }
  for (const x of [-7, 7]) put(x, 1, 5, B.POTTED_PLANT);

  // The team's desks: pairs facing each other across a row of tables, a
  // computer on each.
  for (const [x, z, front] of deskSpots()) {
    put(x, 1, z, B.turnedTo(B.CHAIR, front));
    put(x, 1, z + (front === 1 ? 1 : -1), B.TABLE);
  }
  for (const [x, y, z, front] of deskComputers()) put(x, y, z, B.turnedTo(B.COMPUTER, front));
  // Between the pairs, plants; along the left wall, the pantry and shelves.
  put(-6, 1, 10, B.POTTED_PLANT);
  put(-6, 1, 14, B.POTTED_PLANT);
  put(-W + 1, 1, 13, B.turnedTo(B.FRIDGE, 0));
  put(-W + 1, 1, 14, B.turnedTo(B.COUNTER, 0));
  put(-W + 1, 1, 15, B.turnedTo(B.COUNTER, 0));
  for (const z of [8, 9, 10]) put(-W + 1, 1, z, B.turnedTo(B.BOOKSHELF, 0));

  // The meeting room: glass walls with a door, a blue carpet, a long table
  // with chairs round it, and a screen on the back wall.
  const [mx0, mx1, mz0] = [3, W - 1, 8];
  // Its walls stop at the height of the floor line outside; its ceiling is the office's.
  for (let y = 1; y <= FLOOR_LINE - 1; y++) {
    for (let x = mx0; x <= mx1; x++) put(x, y, mz0, x === mx0 || y === FLOOR_LINE - 1 ? CHARCOAL : B.GLASS);
    for (let z = mz0; z < D; z++) put(mx0, y, z, z === mz0 || y === FLOOR_LINE - 1 ? CHARCOAL : B.GLASS);
  }
  box(mx0 + 1, 1, mz0, mx0 + 2, 3, mz0, B.AIR);
  box(mx0 + 1, 0, mz0 + 1, mx1, 0, D - 1, BLUE_CARPET);
  for (let x = 5; x <= 8; x++) {
    for (const z of [11, 12]) put(x, 1, z, B.TABLE);
    put(x, 1, 10, B.turnedTo(B.CHAIR, 1));
    put(x, 1, 13, B.turnedTo(B.CHAIR, 3));
  }
  put(9, 1, 11, B.turnedTo(B.CHAIR, 2));
  put(9, 1, 12, B.turnedTo(B.CHAIR, 2));
  for (const x of [6, 7]) put(x, 3, D - 1, B.turnedTo(B.WALL_TV, 3));
  put(mx1, 1, D - 1, B.POTTED_PLANT);
  return [...map.values()];
}

// Where the desks' chairs are, in the office's own cells, and the way each
// faces (as turnedTo's): the workers' in order, so the first ones are
// nearest the lobby. Pairs face each other across tables at z 9-10 and 13-14.
export function deskSpots() {
  return [
    [-4, 8, 1],
    [-2, 8, 1],
    [-4, 11, 3],
    [-2, 11, 3],
    [-9, 12, 1],
    [-8, 12, 1],
    [-9, 15, 3],
    [-8, 15, 3],
  ];
}

// The computer on each desk, in the workers' order: [x, y, z, front] in the
// office's own cells, on the table in front of the chair, facing it.
export function deskComputers() {
  return deskSpots().map(([x, z, front]) => [x, 2, front === 1 ? z + 1 : z - 1, front === 1 ? 3 : 1]);
}

// One worker on the island: a player sitting at their desk, saying what they
// are doing. The first one's token is kept with the island, so it comes back as itself.
class Clerk extends EventEmitter {
  constructor({ office, k }) {
    super();
    this.office = office;
    this.k = k;
    this.name = workerName(k);
    this.look = cleanLook(STAFF[k].look);
    this.me = 0;
    this.welcomed = false;
    this.ended = false;
    // Working on an issue (ctb.js screens): typing, or else on a coffee break.
    this.busy = false;
    this.link = new LocalLink(office.room);
    this.link.on('open', () => this.link.send({ t: 'join', protocol: PROTOCOL, name: this.name, look: this.look, ...(k === 0 && office.token ? { token: office.token } : {}) }));
    this.link.on('message', (msg) => this.safely(() => this.handle(msg)));
    this.link.on('close', () => {
      this.ended = true;
    });
  }

  safely(fn) {
    try {
      fn();
    } catch (error) {
      this.office.log(`CTB: a mistake on the island: ${error.stack ?? error}`);
    }
  }

  handle(msg) {
    if (msg.t === 'welcome') {
      this.welcomed = true;
      this.me = msg.you;
      if (this.k === 0 && msg.token) this.office.token = msg.token;
      this.sit();
      this.emit('ready');
    } else if (msg.t === 'say' && msg.pid !== this.me && !this.office.isClerk(msg.pid)) {
      const text = typeof msg.text === 'string' ? msg.text : Number.isInteger(msg.p) ? (PHRASES[msg.p] ?? '') : Number.isInteger(msg.e) ? (STICKERS[msg.e] ?? '') : '';
      if (text) this.office.heard(this, msg.pid, msg.name, text);
    }
  }

  // At their desk, sitting facing their screen: typing away when busy,
  // sat back with a coffee when not.
  setBusy(busy) {
    if (busy === this.busy) return;
    this.busy = busy;
    this.sit();
  }

  sit() {
    const seat = this.office.seats[this.k];
    if (!seat || !this.welcomed) return;
    this.link.send({ t: 'm', s: [+seat.x.toFixed(2), +seat.y.toFixed(2), +seat.z.toFixed(2), +seat.yaw.toFixed(2), this.busy ? TYPE : COFFEE, 0] });
  }

  say(raw) {
    if (!this.welcomed || this.ended) return;
    let text = String(raw).replace(/\s+/gu, ' ').trim();
    if ([...text].length > CHAT_MAX) text = `${[...text].slice(0, CHAT_MAX - 1).join('')}…`;
    text = cleanChat(text);
    if (text) this.link.send({ t: 'say', text });
  }

  emote(e) {
    if (this.welcomed && !this.ended && EMOTE_KEYS.includes(e)) this.link.send({ t: 'emote', e });
  }

  leave() {
    if (this.ended) return;
    this.ended = true;
    this.link.send({ t: 'leave' });
    setTimeout(() => this.link.close('closed'), 300).unref?.();
  }
}

// CTB's guide: she waits by the gate, and walks each guest who arrives up
// the boulevard, round the fountain and into the lobby, pausing whenever
// they fall behind, and introduces the team there; then she goes back to
// the gate for the next. Her way, in the office's own cells (dx, dz).
export const GUIDE = {
  name: 'Grace 🌷',
  call: 'grace',
  look: { animal: 'grownup', skin: 'light', hair: 'long', hairColor: 'chestnut', face: 'none', shirt: 10, hat: 'flower', outfit: 'scarf' },
  home: [2, -29],
  route: [
    [1, -27],
    [0, -22],
    [-5, -19],
    [-7, -13],
    [-5, -7],
    [0, -4],
    [0, -1],
    [0, 1.6],
  ],
};
const GUIDE_SPEED = 3.2;
// How far behind a guest may fall before she waits for them, and how far ahead she goes again.
const GUIDE_WAIT = 6;
const GUIDE_GO = 3.5;
const GUIDE_TICK_MS = 100;
const GUIDE_LINGER_MS = 18000;
const GUIDE_GREET_MS = 1500;
const WALK = 1;
const IDLE = 0;

class Guide extends EventEmitter {
  constructor({ office }) {
    super();
    this.office = office;
    this.name = GUIDE.name;
    this.look = cleanLook(GUIDE.look);
    this.me = 0;
    this.welcomed = false;
    this.ended = false;
    this.players = new Map();
    // What she is doing: idle at the gate, greeting, leading a guest, at the lobby, or going back.
    this.mode = 'idle';
    this.guest = 0;
    this.path = [];
    this.step = 0;
    this.pos = null;
    this.yaw = 0;
    this.waitSaidAt = 0;
    this.until = 0;
    this.link = new LocalLink(office.room);
    this.link.on('open', () => this.link.send({ t: 'join', protocol: PROTOCOL, name: this.name, look: this.look }));
    this.link.on('message', (msg) => this.safely(() => this.handle(msg)));
    this.link.on('close', () => {
      this.ended = true;
      clearInterval(this.ticker);
    });
  }

  safely(fn) {
    try {
      fn();
    } catch (error) {
      this.office.log(`CTB: a mistake with the guide: ${error.stack ?? error}`);
    }
  }

  // A point of the office's own (dx, dz: whole numbers the middles of its
  // cells) on the island, standing on the ground there.
  at([dx, dz]) {
    const s = this.office.site;
    const [[x, , z]] = placeTemplate([[0, 0, 0, 0]], s.x, s.base, s.z, s.facing);
    const [[ax, , az]] = placeTemplate([[1, 0, 0, 0]], s.x, s.base, s.z, s.facing);
    const [[bx, , bz]] = placeTemplate([[0, 0, 1, 0]], s.x, s.base, s.z, s.facing);
    // The office's frame as world directions: dx along (ax - x, az - z), dz along (bx - x, bz - z).
    const wx = x + 0.5 + (ax - x) * dx + (bx - x) * dz;
    const wz = z + 0.5 + (az - z) * dx + (bz - z) * dz;
    return { x: wx, y: this.groundAt(wx, wz), z: wz };
  }

  groundAt(x, z) {
    const world = this.office.room.world;
    return world.groundBelow(Math.floor(x), this.office.site.base + 4, Math.floor(z)) + 1;
  }

  handle(msg) {
    switch (msg.t) {
      case 'welcome': {
        this.welcomed = true;
        this.me = msg.you;
        for (const p of msg.players ?? []) if (p.id !== this.me) this.players.set(p.id, { ...p });
        this.goHome(true);
        this.ticker = setInterval(() => this.safely(() => this.tick()), GUIDE_TICK_MS);
        this.ticker.unref?.();
        break;
      }
      case 'joined':
        if (msg.player?.id && msg.player.id !== this.me) {
          this.players.set(msg.player.id, { ...msg.player });
          if (this.isGuest(msg.player)) this.arrived(msg.player);
        }
        break;
      case 'left':
        this.players.delete(msg.pid);
        if (msg.pid === this.guest && this.mode !== 'idle') this.goHome();
        break;
      case 'm': {
        const p = this.players.get(msg.p);
        if (p) p.s = msg.s;
        break;
      }
      case 'say':
        if (msg.pid !== this.me && typeof msg.text === 'string' && msg.text.toLowerCase().includes(GUIDE.call)) this.askedBy(msg.pid, msg.name);
        break;
    }
  }

  // A guest: someone who is not one of CTB's own, nor the AI friend.
  isGuest(p) {
    // The workers by name too: one joining may not have its id known yet.
    return !this.office.isClerk(p.id) && !STAFF.some((_, k) => workerName(k) === p.name) && !this.office.ignores(p.name ?? '');
  }

  arrived(p) {
    if (this.mode === 'idle' || this.mode === 'back') {
      this.guest = p.id;
      this.mode = 'greeting';
      this.until = Date.now() + GUIDE_GREET_MS;
      this.say(`Welcome to CTB, ${p.name}! I'm Grace, your guide. Come with me — I'll show you our office!`);
      this.emote('wave');
    } else {
      setTimeout(() => this.say(`Welcome, ${p.name}! Come along — we're on our way to the office!`), 2500).unref?.();
    }
  }

  // Someone said her name: she offers a tour, or says where they are going.
  askedBy(pid, name) {
    const p = this.players.get(pid);
    if (!p || !this.isGuest(p)) return;
    if (this.mode === 'idle' || this.mode === 'back') {
      this.guest = pid;
      this.say(`Hi ${name}! Let me show you around CTB. Follow me!`);
      this.lead();
    } else this.say(`Hi ${name}! This way — the office is just ahead!`);
  }

  lead() {
    this.mode = 'leading';
    this.path = GUIDE.route.map((p) => this.at(p));
    this.step = 0;
  }

  goHome(now = false) {
    const home = this.at(GUIDE.home);
    this.guest = 0;
    if (now || !this.pos) {
      this.pos = home;
      this.mode = 'idle';
      this.face(this.at([GUIDE.home[0], GUIDE.home[1] - 5]));
      this.send(IDLE);
      return;
    }
    // The way she came, back to the gate.
    this.path = [...GUIDE.route].reverse().slice(1).map((p) => this.at(p)).concat([home]);
    this.step = 0;
    this.mode = 'back';
  }

  face(to) {
    this.yaw = Math.atan2(to.x - this.pos.x, to.z - this.pos.z);
  }

  guestPos() {
    const s = this.players.get(this.guest)?.s;
    return s ? { x: s[0], y: s[1], z: s[2] } : null;
  }

  tick() {
    if (!this.welcomed || this.ended || !this.pos) return;
    const now = Date.now();
    if (this.mode === 'greeting') {
      const g = this.guestPos();
      if (g) this.face(g);
      this.send(IDLE);
      if (now >= this.until) this.lead();
      return;
    }
    if (this.mode === 'lobby') {
      const g = this.guestPos();
      if (g) this.face(g);
      this.send(IDLE);
      if (now >= this.until) this.goHome();
      return;
    }
    if (this.mode !== 'leading' && this.mode !== 'back') return;
    // Leading: wait for a guest who falls behind, facing them.
    if (this.mode === 'leading') {
      const g = this.guestPos();
      const gap = g ? Math.hypot(g.x - this.pos.x, g.z - this.pos.z) : 0;
      if (g && (gap > GUIDE_WAIT || (this.waiting && gap > GUIDE_GO))) {
        this.waiting = true;
        this.face(g);
        this.send(IDLE);
        if (now - this.waitSaidAt > 9000) {
          this.waitSaidAt = now;
          this.say('This way! 🌷');
          this.emote('wave');
        }
        return;
      }
      this.waiting = false;
    }
    const target = this.path[this.step];
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const stride = (this.office.guideSpeed * GUIDE_TICK_MS) / 1000;
    if (d <= stride) {
      this.pos = { ...target };
      this.step++;
      if (this.step >= this.path.length) return this.reached();
    } else {
      this.pos = { x: this.pos.x + (dx / d) * stride, y: 0, z: this.pos.z + (dz / d) * stride };
      this.pos.y = this.groundAt(this.pos.x, this.pos.z);
      this.yaw = Math.atan2(dx, dz);
    }
    this.send(WALK);
  }

  reached() {
    if (this.mode === 'back') {
      this.mode = 'idle';
      this.face(this.at([GUIDE.home[0], GUIDE.home[1] - 5]));
      this.send(IDLE);
      return;
    }
    const name = this.players.get(this.guest)?.name ?? 'friend';
    this.mode = 'lobby';
    this.until = Date.now() + GUIDE_LINGER_MS;
    this.say(`Here we are, ${name}! That's our team at their desks — they make Kids World better every day. Say hi to them!`);
    this.emote('cheer');
    setTimeout(() => this.mode === 'lobby' && this.say('Got an idea for the game? Tap 💌 and our team will read it. Have fun!'), 6000).unref?.();
  }

  send(anim) {
    if (!this.welcomed || this.ended) return;
    const p = this.pos;
    const yaw = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    this.link.send({ t: 'm', s: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +yaw.toFixed(2), anim, 0] });
  }

  say(text) {
    if (!this.welcomed || this.ended) return;
    const clean = cleanChat(text.length > CHAT_MAX ? `${[...text].slice(0, CHAT_MAX - 1).join('')}…` : text);
    if (clean) this.link.send({ t: 'say', text: clean });
  }

  emote(e) {
    if (this.welcomed && !this.ended && EMOTE_KEYS.includes(e)) this.link.send({ t: 'emote', e });
  }

  leave() {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.ticker);
    this.link.send({ t: 'leave' });
    setTimeout(() => this.link.close('closed'), 300).unref?.();
  }
}

// The island, its office and the workers on it. answer(k, name, text) gives
// what worker k says back to a child (or '' for nothing).
export class Office {
  // ignores(name): someone the workers never answer — the AI friend, who
  // would answer them back, and on and on.
  // guideSpeed: how fast the guide walks, blocks a second (quicker in tests).
  // ownerWho: the island's owner, as the hash a login's pages tell islands
  // (shared/room.js ownerWho); '' for none, when nobody owns it.
  constructor({ rooms, file = null, keeper = null, rtc = null, server = null, iceServers = [], log = (text) => console.log(text), answer = () => '', ignores = () => false, random = Math.random, guideSpeed = GUIDE_SPEED, ownerWho = '' }) {
    this.rooms = rooms;
    this.file = file;
    this.keeper = keeper;
    this.rtc = rtc;
    this.server = server;
    this.iceServers = iceServers;
    this.log = log;
    this.answer = answer;
    this.ignores = ignores;
    this.guideSpeed = guideSpeed;
    this.ownerWho = ownerWho;
    this.random = random;
    this.room = null;
    this.token = '';
    this.seats = [];
    this.clerks = [];
    this.screenList = [];
    this.host = null;
    this.answeredAt = 0;
    this.saving = Promise.resolve();
    this.timer = null;
  }

  // The island as saved, or a new one with the office on it; then the workers sit down.
  async open(workers) {
    const kept = await this.read();
    let room = kept?.code ? this.rooms.get(kept.code)?.room : null;
    if (room?.closed) room = null;
    let fresh = false;
    if (!room) {
      const code = kept?.code && !this.rooms.has(kept.code) ? kept.code : this.freeCode();
      const log = (error) => this.log(`CTB: a mistake on its island: ${error?.message ?? error}`);
      try {
        room = kept?.save ? new Room({ code, save: kept.save, log }) : null;
      } catch (error) {
        this.log(`CTB: its island could not be opened again (${error.message}); making a new one.`);
      }
      if (!room) {
        room = new Room({ code, theme: 'sunny', size: 'small', name: ISLAND_NAME, settings: { build: 'host', monsters: false }, log });
        fresh = true;
      }
      if (!room.world.name) room.world.name = ISLAND_NAME;
      this.rooms.set(code, { room, emptySince: 0 });
    }
    // Anyone may come and see it from a link, logged in or not (main.js ?ctb).
    room.watchable = true;
    this.room = room;
    this.setOwner(this.ownerWho);
    this.token = kept?.code === room.code && typeof kept.token === 'string' ? kept.token : '';
    this.site = !fresh && kept?.code === room.code && kept.site ? kept.site : null;
    // An office from before this one comes down, and this one goes up.
    if (this.site && kept.office !== OFFICE_VERSION) {
      this.clear(this.site);
      this.site = null;
    }
    if (!this.site) this.build();
    this.arriveAtDoors();
    this.seats = this.seatsAt(this.site);
    this.log(`CTB: ${kept?.code === room.code ? 'back on' : 'made'} the island "${room.world.name}" (code ${room.code}).`);
    this.share();
    this.staff(workers);
    this.timer = setInterval(() => this.save(), SAVE_MS);
    this.timer.unref?.();
    await this.save();
    return this;
  }

  // The office put up in the middle of the island, its grounds levelled
  // first: everything above them cleared away (hills and trees too), and the
  // ground filled up to them, so nothing stands between the boulevard and
  // the building.
  build() {
    const world = this.room.world;
    const G = GROUNDS;
    const site = { x: Math.floor(world.W / 2), z: Math.floor(world.D / 2) + Math.floor((-G.z0 - G.z1) / 2), r: reachOf(officeCells()), base: 0, facing: 0 };
    // The grounds, and a clearing before them where the camera of someone
    // arriving stands, so no tree or hill gets in the way of the view.
    const corners = placeTemplate([[G.x0 - 1, 0, G.z0 - VIEW_CLEARING, 0], [G.x1 + 1, 0, G.z1 + 1, 0]], site.x, 0, site.z, site.facing);
    const [xs, zs] = [corners.map((c) => c[0]), corners.map((c) => c[2])];
    const [x0, x1, z0, z1] = [Math.max(0, Math.min(...xs)), Math.min(world.W - 1, Math.max(...xs)), Math.max(0, Math.min(...zs)), Math.min(world.D - 1, Math.max(...zs))];
    // Level with the land there: the middle height of the ground over the grounds.
    const heights = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) heights.push(world.groundBelow(x, world.H - 1, z));
    heights.sort((a, b) => a - b);
    site.base = Math.max(world.sea + 1, heights[heights.length >> 1]) + 1;
    const cells = [];
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        for (let y = 1; y < world.H; y++) {
          const now = world.get(x, y, z);
          const want = y < site.base - 1 ? (now === B.AIR || now === B.WATER ? B.DIRT : null) : y === site.base - 1 ? B.GRASS : B.AIR;
          if (want !== null && now !== want) cells.push(x, y, z, want);
        }
      }
    }
    applyCells(world, cells);
    applyCells(world, placeTemplate(officeCells(), site.x, site.base, site.z, site.facing).flat());
    // Animals and vehicles that were on the land are taken off it, rather
    // than left in the air where a hill was.
    for (const c of [...this.room.critters.list]) if (c.x >= x0 && c.x <= x1 + 1 && c.z >= z0 && c.z <= z1 + 1) this.room.critters.remove(c.id);
    this.site = site;
  }

  // Its owner: one login, never a worker or a visitor (who owned it before
  // stops). With them away, nobody owns it, so nobody but them builds there.
  setOwner(who) {
    this.ownerWho = who;
    const room = this.room;
    if (!room) return;
    room.ownerWho = who || NOBODY;
    const owner = [...room.players.values()].find((p) => p.who && p.who === who && p.online);
    const host = owner?.id ?? 0;
    room.reservedHost = 0;
    if (room.host !== host) {
      room.host = host;
      room.broadcast({ t: 'host', pid: host });
    }
  }

  // Everyone comes to the island at the front of the grounds, at the end of
  // the boulevard, turned to the office: the whole building, "CTB" on its
  // roof, the fountain and the flags before it, at first sight. From there
  // it is a walk up the boulevard to the doors, over no hill or water.
  arriveAtDoors() {
    const s = this.site;
    const [[x, , z], [ax, , az]] = placeTemplate([[0, 0, ARRIVE_DZ, 0], [0, 0, ARRIVE_DZ + 1, 0]], s.x, s.base, s.z, s.facing);
    // A camera's yaw looks along (-sin, -cos): towards the doors.
    this.room.world.spawn = { x: x + 0.5, y: s.base, z: z + 0.5, yaw: Math.atan2(-(ax - x), -(az - z)) };
  }

  // Everything over the ground where an office stood, cleared away.
  clear(site) {
    const world = this.room.world;
    const m = site.r + 1;
    const cells = [];
    for (let x = site.x - m; x <= site.x + m; x++) {
      for (let z = site.z - m; z <= site.z + m; z++) {
        for (let y = site.base; y <= site.base + CLEAR_HEIGHT; y++) if (world.inBounds(x, y, z) && world.get(x, y, z) !== B.AIR) cells.push(x, y, z, B.AIR);
      }
    }
    applyCells(world, cells);
  }

  // Each desk's seat on the island, in the workers' order.
  seatsAt(site) {
    const chairs = placeTemplate(
      deskSpots().map(([x, z]) => [x, 1, z, B.CHAIR]),
      site.x,
      site.base,
      site.z,
      site.facing,
    );
    return chairs.map(([x, y, z]) => seatPose(this.room.world, x, y, z)).filter(Boolean);
  }

  // As many workers at their desks as there are now, the first always.
  staff(count) {
    const n = Math.max(1, Math.min(MAX_WORKERS, count));
    while (this.clerks.length > n) this.clerks.pop().leave();
    while (this.clerks.length < n) this.clerks.push(new Clerk({ office: this, k: this.clerks.length }));
    this.showScreens();
    // The guide is always there, whoever else is: once the first worker is in.
    if (!this.guide && !this.guideComing) {
      this.guideComing = true;
      const first = this.clerks[0];
      const come = () => {
        if (this.room && !this.closed) this.guide = new Guide({ office: this });
      };
      if (first.welcomed) come();
      else first.once('ready', come);
    }
  }

  // What the workers' computers show (ctb.js screens): each worker's real
  // work, on the computer at their desk, for everyone on the island to see.
  // A desk nobody sits at shows nothing of its own.
  showScreens(list = this.screenList) {
    this.screenList = list;
    if (!this.room || !this.site) return;
    const cells = placeTemplate(deskComputers(), this.site.x, this.site.base, this.site.z, this.site.facing);
    const screens = [];
    this.clerks.forEach((c, k) => {
      c.setBusy(Boolean(list[k]?.issue));
      if (list[k] && cells[k]) screens.push({ x: cells[k][0], y: cells[k][1], z: cells[k][2], ...list[k] });
    });
    this.room.setScreens(screens);
  }

  isClerk(pid) {
    return this.clerks.some((c) => c.me === pid) || this.guide?.me === pid;
  }

  // Something a child said: the worker named in it answers, or the first.
  heard(clerk, pid, name, text) {
    if (this.ignores(name)) return;
    const lower = text.toLowerCase();
    // Said to the guide: she answers it herself.
    if (lower.includes(GUIDE.call)) return;
    const named = this.clerks.find((c) => lower.includes(STAFF[c.k].name.toLowerCase()));
    if ((named ?? this.clerks[0]) !== clerk) return;
    const now = Date.now();
    if (now - this.answeredAt < ANSWER_GAP_MS) return;
    this.answeredAt = now;
    const said = this.answer(clerk.k, name, text);
    if (said) setTimeout(() => clerk.say(said), 900).unref?.();
  }

  say(k, text) {
    this.clerks[k]?.say(text);
  }

  emote(k, e) {
    this.clerks[k]?.emote(e);
  }

  // Open to pages anywhere: hosted peer to peer and on the keeper's list.
  share() {
    if (!this.rtc || !this.keeper?.listIsland) return;
    const room = this.room;
    const host = new PeerHost({ room, rtc: this.rtc, server: this.server, iceServers: this.iceServers });
    let said = '';
    host.on('state', (state, detail) => {
      const now = state === 'online' ? 'online' : state === 'id-taken' || state === 'error' ? state : '';
      if (!now || now === said) return;
      said = now;
      this.log(now === 'online' ? `CTB: the island "${room.world.name}" is open to everyone, peer to peer.` : `CTB: its island cannot be reached peer to peer yet (${detail || now}).`);
    });
    host.start();
    this.host = host;
    this.keeper.listIsland(room.code, () => (host.state === 'online' && !room.closed ? room.listing() : null));
  }

  freeCode() {
    for (;;) {
      const code = generateCode();
      if (!this.rooms.has(code)) return code;
    }
  }

  async read() {
    if (!this.file) return null;
    try {
      const kept = JSON.parse(await readFile(this.file, 'utf8'));
      return kept && typeof kept === 'object' ? kept : null;
    } catch (error) {
      if (error.code !== 'ENOENT') this.log(`CTB: its island in ${this.file} could not be read (${error.message}).`);
      return null;
    }
  }

  save() {
    const room = this.room;
    if (!room || !this.file) return this.saving;
    const text = `${JSON.stringify({ code: room.code, token: this.token, site: this.site, office: OFFICE_VERSION, save: room.exportSave() })}\n`;
    const file = this.file;
    this.saving = this.saving.then(async () => {
      try {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, text);
        await rename(`${file}.tmp`, file);
      } catch (error) {
        this.log(`CTB: its island could not be saved (${error.message}).`);
      }
    });
    return this.saving;
  }

  // What the admin page shows of it.
  summary() {
    const room = this.room;
    if (!room) return null;
    const clerks = new Set([...this.clerks.map((c) => c.me), this.guide?.me]);
    return {
      code: room.code,
      name: room.world.name,
      // The link anyone can open it with, on the game's website.
      url: `${PAGES_URL}?ctb`,
      shared: this.host?.state ?? '',
      visitors: [...room.players.values()].filter((p) => !clerks.has(p.id)).map((p) => p.name),
    };
  }

  async close() {
    clearInterval(this.timer);
    await this.save();
    for (const c of this.clerks) c.leave();
    this.closed = true;
    this.guide?.leave();
    this.guide = null;
    this.clerks = [];
    if (this.room) this.keeper?.unlistIsland?.(this.room.code);
    this.host?.stop();
    this.host = null;
  }
}
