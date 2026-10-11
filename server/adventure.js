// The public adventure island: the one adventure island this server keeps
// for everyone to conquer together, on the list of open islands even while
// nobody is on it (as 🌟 Adventure Isle, heading the list). Players come
// and go as on any island; its toy box stays shut (nobody builds on it, and
// nothing is brought to it or sent away) and nobody flies on their own on
// it — it is everyone's adventure, on foot. Freed, the island is retired
// and the next stage's takes its place at once, a little harder (see
// shared/adventure.js), on and on without end — and at the beginning of
// each day it starts over again at stage 1.
//
// A retired island stays open a while for whoever is on it to enjoy their
// win, and once everyone has left it, it goes. The stage is not kept over a
// restart: the day decides it, and the island of a stage is the same one
// all that day, so a restart puts back just the island that was meant to be.
import { generateCode } from '../public/js/shared/codes.js';
import { Room } from '../public/js/shared/room.js';
import { PeerHost } from './host.js';

export const PUBLIC_ISLAND_NAME = 'Adventure Isle';
// How long a retired island is kept after everyone leaves it.
export const RETIRED_KEEP_MS = 10 * 60 * 1000;
// The stages climb through the island kinds: sunny, snowy and candy round
// about, and the island grows cozily big before it grows huge.
const STAGE_THEMES = ['sunny', 'snowy', 'candy'];
const stageTheme = (stage) => STAGE_THEMES[(stage - 1) % STAGE_THEMES.length];
const stageSize = (stage) => (stage >= 6 ? 'huge' : stage >= 3 ? 'big' : 'small');

// The day a moment is in, as the server sees days.
const dayOf = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// The island of one stage of one day: always the same one, so a restart
// mid-day brings back the very island that stage had.
function seedFor(day, stage) {
  let h = 2166136261;
  for (const c of `${day}:${stage}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export class PublicAdventure {
  // rooms: the server's islands (see server.js), which the island of each
  // stage is one of. retiredKeepMs: how long a conquered (or a day's ended)
  // island is kept after everyone leaves it.
  constructor({ rooms, log = () => {}, now = () => Date.now(), retiredKeepMs = RETIRED_KEEP_MS } = {}) {
    if (!rooms) throw new Error('The public adventure island needs the server\'s islands.');
    this.rooms = rooms;
    this.log = log;
    this.now = now;
    this.retiredKeepMs = retiredKeepMs;
    // Each island as it comes and goes (set before start(), see shareTheIsle):
    // onOpen(room) for the new public island of a stage, onRetire(room) for
    // the one that stopped being it, and onGone(room) once that one is gone.
    this.onOpen = null;
    this.onRetire = null;
    this.onGone = null;
    this.stage = 0;
    this.day = '';
    this.entry = null;
    this.retired = [];
    this.stopped = false;
  }

  get room() {
    return this.entry && !this.entry.room.closed ? this.entry.room : null;
  }

  // Makes the island of stage 1 for today. Call tick() now and then (the
  // server does, about ten times a second) for the stages to follow.
  start() {
    if (this.entry) return this;
    const now = this.now();
    this.open(1, dayOf(now));
    this.say(`Adventure Isle is up: stage 1 (code ${this.entry.code}).`);
    return this;
  }

  // A new stage (or a new day's stage 1) in place of the current island:
  // that one is retired — left open a while for whoever is on it — and this
  // island of the new stage is the public one from here on.
  open(stage, day) {
    this.stage = stage;
    this.day = day;
    const code = this.freeCode();
    const room = new Room({
      code,
      theme: stageTheme(stage),
      size: stageSize(stage),
      name: PUBLIC_ISLAND_NAME,
      adventure: true,
      stage,
      shared: true,
      seed: seedFor(day, stage),
      log: (error) => this.log(`Adventure Isle: a mistake on stage ${stage}: ${error?.message ?? error}`),
    });
    room.public = true;
    this.entry = { code, room, emptySince: 0, public: true };
    this.rooms.set(code, this.entry);
    this.onOpen?.(room);
    return this.entry;
  }

  freeCode() {
    for (;;) {
      const code = generateCode();
      if (!this.rooms.has(code)) return code;
    }
  }

  // Moves the public island on: won, to the next stage; the day turned, back
  // to stage 1 however the last one was going.
  tick(now = this.now()) {
    if (this.stopped || !this.entry) return;
    this.sweep(now);
    const day = dayOf(now);
    if (day !== this.day) {
      this.retire(now, `A new day! 🌟 ${PUBLIC_ISLAND_NAME} starts again from stage 1 — it is first on the list of islands.`);
      this.open(1, day);
      this.say(`Adventure Isle: a new day; stage 1 is up (code ${this.entry.code}).`);
      return;
    }
    if (this.entry.room.closed) {
      // Gone by itself (the server shutting down): never while ticking.
      this.retire(now, '');
      this.open(this.stage, day);
      return;
    }
    if (this.entry.room.adventure?.won) {
      // The next stage's island first, so everyone on this one can be told
      // where it is: their pages fly them on there by themselves (ui.js).
      const done = this.entry;
      this.open(this.stage + 1, day);
      const next = { code: this.entry.code, stage: this.stage };
      this.retire(now, `On to stage ${next.stage}! 🌟 Off you all go there in a moment — come and conquer it together!`, done, next);
      this.say(`stage ${next.stage - 1} conquered; stage ${next.stage} is up (code ${next.code}).`);
    }
  }

  // The island that was the public one: no longer the island to conquer, no
  // longer listed as public, told where the next one is (next: the next
  // stage's { code, stage }, when it was won), and kept until everyone has
  // left it (and a while).
  retire(now, text, entry = this.entry, next = null) {
    const { code, room } = entry;
    room.public = false;
    entry.public = false;
    // Anyone coming back to it (a page reconnecting) is told too.
    if (next) room.next = next;
    this.retired.push({ code, room, emptySince: room.online > 0 ? 0 : now });
    if (room.online > 0) {
      if (text) room.broadcast({ t: 'notice', level: 'info', text });
      if (next) room.broadcast({ t: 'next', ...next });
    }
    this.onRetire?.(room);
  }

  // Retired islands go once everyone has left them and a while has passed.
  sweep(now) {
    for (let i = this.retired.length - 1; i >= 0; i--) {
      const r = this.retired[i];
      if (r.room.closed) {
        this.rooms.delete(r.code);
        this.retired.splice(i, 1);
        this.onGone?.(r.room);
        continue;
      }
      if (r.room.online > 0) {
        r.emptySince = 0;
        continue;
      }
      r.emptySince ||= now;
      if (now - r.emptySince < this.retiredKeepMs) continue;
      r.room.close();
      this.rooms.delete(r.code);
      this.retired.splice(i, 1);
      this.onGone?.(r.room);
    }
  }

  say(text) {
    this.log(`Adventure Isle: ${text}`);
  }

  stop() {
    this.stopped = true;
    const closing = this.entry ? [this.entry, ...this.retired] : [...this.retired];
    if (this.entry) this.onRetire?.(this.entry.room);
    for (const entry of closing) {
      if (!entry.room.closed) entry.room.close();
      this.rooms.delete(entry.code);
      this.onGone?.(entry.room);
    }
    this.entry = null;
    this.retired = [];
  }
}

// The shared isle over WebRTC as well, the way the AI friend's island is
// (buddy.js): each of its stages hosted peer to peer under its code and on
// the keeper's list of open islands, so pages anywhere — the game on GitHub
// Pages — can come and conquer it together. Returns a function that stops it.
export function shareTheIsle(keeper, isle, { log = () => {}, iceServers } = {}) {
  const hosts = new Map();
  const share = (room) => {
    if (!room || hosts.has(room) || room.closed) return;
    const host = new PeerHost({ room, rtc: keeper.rtc, server: keeper.server, ...(iceServers ? { iceServers } : {}) });
    let said = '';
    host.on('state', (state, detail) => {
      const now = state === 'online' ? 'online' : state === 'id-taken' || state === 'error' ? state : '';
      if (!now || now === said) return;
      said = now;
      log(now === 'online' ? `Adventure Isle: stage ${room.stage} is open to everyone, peer to peer.` : `Adventure Isle: stage ${room.stage} cannot be reached peer to peer yet (${detail || now}).`);
    });
    host.start();
    keeper.listIsland(room.code, () => (host.state === 'online' && !room.closed ? room.listing() : null));
    hosts.set(room, host);
  };
  // A stage won or a day over: off the list at once, but whoever is on it
  // stays on it, peer to peer too, until it goes — to see the fireworks and
  // to be told where the next stage is.
  const unlist = (room) => keeper.unlistIsland(room.code);
  const unshare = (room) => {
    const host = hosts.get(room);
    if (!host) return;
    hosts.delete(room);
    keeper.unlistIsland(room.code);
    host.stop();
  };
  isle.onOpen = share;
  isle.onRetire = unlist;
  isle.onGone = unshare;
  share(isle.room);
  return () => {
    isle.onOpen = null;
    isle.onRetire = null;
    isle.onGone = null;
    for (const [room, host] of hosts) {
      keeper.unlistIsland(room.code);
      host.stop();
    }
    hosts.clear();
  };
}
