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

const [, , , , , , , BLUE, , , , WHITE, GRAY, CHARCOAL] = B.TOY_BRICKS;

// The workers' looks: grown-ups dressed for the office.
export const STAFF = [
  { name: 'Ada', look: { animal: 'grownup', skin: 'light', hair: 'bun', hairColor: 'black', face: 'glasses', shirt: 7, hat: 'none' } },
  { name: 'Ben', look: { animal: 'grownup', skin: 'brown', hair: 'short', hairColor: 'black', face: 'beard', shirt: 5, hat: 'none' } },
  { name: 'Cleo', look: { animal: 'grownup', skin: 'golden', hair: 'ponytail', hairColor: 'ginger', face: 'none', shirt: 8, hat: 'none' } },
  { name: 'Dev', look: { animal: 'grownup', skin: 'deep', hair: 'curly', hairColor: 'black', face: 'glasses-beard', shirt: 1, hat: 'headphones' } },
];
export const MAX_WORKERS = STAFF.length;
export const workerName = (k) => `${STAFF[k].name} 💼`;

// Three by five letters for the sign, top row first.
const LETTERS = {
  C: ['###', '#..', '#..', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
};

// The office as cells [dx, dy, dz, block] (as a stamp's: dx to the right
// of someone standing at its front, dz away from them, dy up from the
// ground), its door at dz = 0. The desks' chairs are where the workers sit.
export function officeCells() {
  const map = new Map();
  const put = (x, y, z, id) => map.set(`${x},${y},${z}`, [x, y, z, id]);
  const W = 8;
  const D = 12;
  for (let x = -W; x <= W; x++) for (let z = 0; z <= D; z++) put(x, 0, z, B.PARQUET);
  for (let y = 1; y <= 4; y++) {
    for (let x = -W; x <= W; x++) {
      for (let z = 0; z <= D; z++) {
        const sideX = x === -W || x === W;
        const sideZ = z === 0 || z === D;
        if (!sideX && !sideZ) {
          put(x, y, z, B.AIR);
          continue;
        }
        const corner = sideX && sideZ;
        // Glass all round between the floor band and the roof band.
        const glass = (y === 2 || y === 3) && !corner && (sideX ? z % 4 !== 0 : Math.abs(x) % 4 !== 0);
        put(x, y, z, corner || y === 4 ? BLUE : glass ? B.GLASS : WHITE);
      }
    }
  }
  // The way in, three wide.
  for (let x = -1; x <= 1; x++) for (let y = 1; y <= 2; y++) put(x, y, 0, B.AIR);
  // A flat roof, gray, with lamps under it.
  for (let x = -W; x <= W; x++) for (let z = 0; z <= D; z++) put(x, 5, z, GRAY);
  for (const x of [-4, 0, 4]) for (const z of [3, 9]) put(x, 4, z, B.LAMP);
  // The sign on the roof's front edge: white, the letters in blue, framed in charcoal.
  const word = 'CTB';
  const width = word.length * 4 - 1;
  const left = -Math.floor(width / 2);
  for (let x = left - 1; x <= left + width; x++) for (let y = 6; y <= 12; y++) put(x, y, 0, x === left - 1 || x === left + width || y === 6 || y === 12 ? CHARCOAL : WHITE);
  [...word].forEach((ch, k) => {
    LETTERS[ch].forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell === '#') put(left + k * 4 + c, 11 - r, 0, BLUE);
      });
    });
  });
  // The desks, two rows of four, an aisle up the middle: a chair facing a
  // table (+z), a TV on it facing the chair for a screen.
  for (const [x, z] of deskSpots()) {
    put(x, 1, z, B.turnedTo(B.CHAIR, 1));
    put(x, 1, z + 1, B.TABLE);
    put(x, 2, z + 1, B.turnedTo(B.TV, 3));
  }
  // A sofa by the way in for visitors, plants, bookshelves along the back.
  for (const z of [2, 3]) put(-7, 1, z, B.turnedTo(B.SOFA, 0));
  for (const z of [2, 3]) put(7, 1, z, B.turnedTo(B.SOFA, 2));
  for (const [x, z] of [
    [-7, 1],
    [7, 1],
    [-7, 11],
    [7, 11],
  ])
    put(x, 1, z, B.POTTED_PLANT);
  for (let x = -5; x <= 5; x++) if (Math.abs(x) > 1) put(x, 1, 11, B.turnedTo(B.BOOKSHELF, 3));
  for (const x of [-3, 3]) put(x, 0, -1, B.TULIP);
  return [...map.values()];
}

// Where the desks' chairs are, in the office's own cells: the workers' in
// order, so the first ones are nearest the door.
export function deskSpots() {
  return [
    [-5, 4],
    [5, 4],
    [-2, 4],
    [2, 4],
    [-5, 8],
    [5, 8],
    [-2, 8],
    [2, 8],
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
  constructor({ rooms, file = null, keeper = null, rtc = null, server = null, iceServers = [], log = (text) => console.log(text), answer = () => '', random = Math.random }) {
    this.rooms = rooms;
    this.file = file;
    this.keeper = keeper;
    this.rtc = rtc;
    this.server = server;
    this.iceServers = iceServers;
    this.log = log;
    this.answer = answer;
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
    const text = `${JSON.stringify({ code: room.code, token: this.token, site: this.site, save: room.exportSave() })}\n`;
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
