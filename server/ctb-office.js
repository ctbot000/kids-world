// The CTB island: an island of this server where CTB's workers (ctb.js) have
// their office, a glass-and-white building with a big "CTB" sign on its
// roof, and inside it a desk for each of them, with a chair and a TV for a
// screen. Each worker is a player on the island, joined the way the AI friend
// joins one (dialer.js LocalLink), sitting at their desk and saying what they
// are working on — which is real work on this project: GitHub issues turned
// into pull requests. Children can visit, look round and ask them what they
// are doing; only the office's owner (the first worker) builds there, so the
// office stays as it is. It is saved in the keeper's data folder
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
import { placeTemplate } from '../public/js/shared/stamps.js';
import { applyCells } from '../public/js/shared/tools.js';
import { CHAT_MAX, cleanChat, cleanLook, EMOTE_KEYS, PHRASES, STICKERS } from '../public/js/shared/words.js';
import { findSite, layersAt, reachOf } from './builds.js';
import { LocalLink } from './dialer.js';
import { PeerHost } from './host.js';

export const ISLAND_NAME = 'CTB';
// Where the game is played, for the island's link (KIDS_WORLD_PAGES_URL to change it).
export const PAGES_URL = process.env.KIDS_WORLD_PAGES_URL || 'https://ctbot000.github.io/kids-world/';
// As the renderer's poses (render/avatar.js ANIM).
const SIT = 8;
const SAVE_MS = 5 * 60000;
// Answering children: one worker at a time, and not too often.
const ANSWER_GAP_MS = 6000;
// How high over an old office's floor is cleared when a new one goes up.
const CLEAR_HEIGHT = 20;

const [, , , , , TEAL, , , , , , WHITE, GRAY, CHARCOAL] = B.TOY_BRICKS;
const [, BLUE_CARPET] = B.CARPETS;

// The workers' looks: grown-ups dressed for the office.
export const STAFF = [
  { name: 'Ada', look: { animal: 'grownup', skin: 'light', hair: 'bun', hairColor: 'black', face: 'glasses', shirt: 7, hat: 'none' } },
  { name: 'Ben', look: { animal: 'grownup', skin: 'brown', hair: 'short', hairColor: 'black', face: 'beard', shirt: 12, hat: 'none' } },
  { name: 'Cleo', look: { animal: 'grownup', skin: 'golden', hair: 'ponytail', hairColor: 'ginger', face: 'none', shirt: 11, hat: 'none' } },
  { name: 'Dev', look: { animal: 'grownup', skin: 'deep', hair: 'curly', hairColor: 'black', face: 'glasses-beard', shirt: 5, hat: 'headphones' } },
];
export const MAX_WORKERS = STAFF.length;
export const workerName = (k) => `${STAFF[k].name} 💼`;

// Which office the island has: a newer one is put up in place of an older one.
export const OFFICE_VERSION = 2;

// Three by five letters for the signs, top row first.
const LETTERS = {
  C: ['###', '#..', '#..', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
};

// "CTB" in cells: across from x0 (to the right), its top row at y0, on the
// plane z (or, with alongX false, x is fixed and the letters run along z).
function word(put, x0, y0, z, id) {
  [...'CTB'].forEach((ch, k) => {
    LETTERS[ch].forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell === '#') put(x0 + k * 4 + c, y0 - r, z, id);
      });
    });
  });
}

// The office as cells [dx, dy, dz, block] (as a stamp's: dx to the right of
// someone standing at its front, dz away from them, dy up from the ground),
// its doors at dz = 0: a modern glass building, one tall floor, with "CTB"
// in white letters along its roof. A paved plaza in front with planters and
// lights; inside, a lobby with a reception desk before a charcoal logo wall,
// the team's desks in pairs facing each other, each with a chair and a TV
// for a screen, a glass meeting room with a long table and a screen on its
// wall, a lounge and a pantry. The desks' chairs are where the workers sit.
export function officeCells() {
  const map = new Map();
  const put = (x, y, z, id) => map.set(`${x},${y},${z}`, [x, y, z, id]);
  const box = (x0, y0, z0, x1, y1, z1, id) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id);
  };
  const W = 11;
  const D = 16;
  const H = 6;
  // The plaza, level with the ground: paving up the middle to a step at the
  // doors, lawn and rows of flowers either side, and slim lamps along the way.
  box(-W, -1, -6, W, -1, -1, B.GRASS);
  box(-2, -1, -6, 2, -1, -1, B.PEBBLES);
  box(-2, 0, -1, 2, 0, -1, B.PEBBLES);
  for (const x of [-8, -7, -6, 6, 7, 8]) for (const z of [-4, -3]) put(x, 0, z, x % 2 ? B.TULIP : B.DAISY);
  for (const x of [-3, 3]) for (const z of [-6, -3]) put(x, 0, z, B.FLOOR_LAMP);
  for (const x of [-W, W]) put(x, 0, -1, B.POTTED_PLANT);
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
          id = corner || y === H || [-8, -4, 4, 8].includes(x) ? CHARCOAL : B.GLASS;
        } else if (sideX) {
          // The sides: ribbons of glass between white bands, charcoal columns.
          id = corner || z % 4 === 0 ? CHARCOAL : y === 1 || y === H ? WHITE : B.GLASS;
        } else {
          // The back: white, with a ribbon of windows.
          id = Math.abs(x) % 4 === 0 ? CHARCOAL : y >= 3 && y <= 4 ? B.GLASS : WHITE;
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
  word(put, -5, H + 7, 1, WHITE);
  box(-5, H + 2, 1, 5, H + 2, 1, TEAL);
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

  // The team's desks: pairs facing each other across a row of tables, a TV
  // on each for a screen.
  for (const [x, z, front] of deskSpots()) {
    put(x, 1, z, B.turnedTo(B.CHAIR, front));
    const tz = front === 1 ? z + 1 : z - 1;
    put(x, 1, tz, B.TABLE);
    put(x, 2, tz, B.turnedTo(B.TV, front === 1 ? 3 : 1));
  }
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
  for (let y = 1; y <= H - 1; y++) {
    for (let x = mx0; x <= mx1; x++) put(x, y, mz0, x === mx0 || y === H - 1 ? CHARCOAL : B.GLASS);
    for (let z = mz0; z < D; z++) put(mx0, y, z, z === mz0 || y === H - 1 ? CHARCOAL : B.GLASS);
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

// One worker on the island: a player sitting at their desk, saying what they
// are doing. The first one owns the island (its token is kept with it).
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

  // At their desk, sitting facing their screen.
  sit() {
    const seat = this.office.seats[this.k];
    if (!seat || !this.welcomed) return;
    this.link.send({ t: 'm', s: [+seat.x.toFixed(2), +seat.y.toFixed(2), +seat.z.toFixed(2), +seat.yaw.toFixed(2), SIT, 0] });
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

// The island, its office and the workers on it. answer(k, name, text) gives
// what worker k says back to a child (or '' for nothing).
export class Office {
  // ignores(name): someone the workers never answer — the AI friend, who
  // would answer them back, and on and on.
  constructor({ rooms, file = null, keeper = null, rtc = null, server = null, iceServers = [], log = (text) => console.log(text), answer = () => '', ignores = () => false, random = Math.random }) {
    this.rooms = rooms;
    this.file = file;
    this.keeper = keeper;
    this.rtc = rtc;
    this.server = server;
    this.iceServers = iceServers;
    this.log = log;
    this.answer = answer;
    this.ignores = ignores;
    this.random = random;
    this.room = null;
    this.token = '';
    this.seats = [];
    this.clerks = [];
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
    this.token = kept?.code === room.code && typeof kept.token === 'string' ? kept.token : '';
    this.site = !fresh && kept?.code === room.code && kept.site ? kept.site : null;
    // An office from before this one comes down, and this one goes up.
    if (this.site && kept.office !== OFFICE_VERSION) {
      this.clear(this.site);
      this.site = null;
    }
    if (!this.site) this.build();
    this.seats = this.seatsAt(this.site);
    this.log(`CTB: ${kept?.code === room.code ? 'back on' : 'made'} the island "${room.world.name}" (code ${room.code}).`);
    this.share();
    this.staff(workers);
    this.timer = setInterval(() => this.save(), SAVE_MS);
    this.timer.unref?.();
    await this.save();
    return this;
  }

  // The office put up on a flat spot near where everyone comes in.
  build() {
    const cells = officeCells();
    const world = this.room.world;
    const site = findSite(world, reachOf(cells), { random: this.random }) ?? { x: Math.floor(world.spawn.x), z: Math.floor(world.spawn.z) + 14, r: reachOf(cells), base: world.groundBelow(Math.floor(world.spawn.x), world.H - 1, Math.floor(world.spawn.z) + 14) + 1, facing: 0 };
    for (const layer of layersAt(world, cells, site)) applyCells(world, layer);
    this.site = site;
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

  // As many workers at their desks as there are now, the first always (it owns the island).
  staff(count) {
    const n = Math.max(1, Math.min(MAX_WORKERS, count));
    while (this.clerks.length > n) this.clerks.pop().leave();
    while (this.clerks.length < n) this.clerks.push(new Clerk({ office: this, k: this.clerks.length }));
  }

  isClerk(pid) {
    return this.clerks.some((c) => c.me === pid);
  }

  // Something a child said: the worker named in it answers, or the first.
  heard(clerk, pid, name, text) {
    if (this.ignores(name)) return;
    const lower = text.toLowerCase();
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
    const clerks = new Set(this.clerks.map((c) => c.me));
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
    this.clerks = [];
    if (this.room) this.keeper?.unlistIsland?.(this.room.code);
    this.host?.stop();
    this.host = null;
  }
}
