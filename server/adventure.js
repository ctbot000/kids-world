// The public adventure island: the one adventure island this server keeps
// for everyone to conquer together, on the list of open islands even while
// nobody is on it (as 🌟 Adventure Isle, heading the list). Players come
// and go as on any island; its toy box stays shut (nobody builds on it, and
// nothing is brought to it or sent away) and nobody flies on their own on
// it — it is everyone's adventure, on foot. Freed, the island is retired
// and the next stage's takes its place at once, a little harder (see
// shared/adventure.js), up to the last chapter of its story (shared/isle-
// story.js). Win that one and the story is over: the ending plays for
// everyone there (ui.js), and a new journey starts at stage 1. Nothing else
// starts it over, so a stage stays where it got to for as long as it takes.
//
// A retired island stays open a while for whoever is on it to enjoy their
// win, and once everyone has left it, it goes. The journey, the stage and the
// camps freed so far are kept over a restart (in `file`, when given), and the
// island of a stage of a journey is always the same one, so a restart puts
// back just the island it had.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateCode } from '../public/js/shared/codes.js';
import { chapterOf, STAGES } from '../public/js/shared/isle-story.js';
import { Room } from '../public/js/shared/room.js';
import { PeerHost } from './host.js';

export const PUBLIC_ISLAND_NAME = 'Adventure Isle';
// How long a retired island is kept after everyone leaves it.
export const RETIRED_KEEP_MS = 10 * 60 * 1000;

// The island of one stage of one journey: always the same one, so a restart
// brings back the very island that stage had.
function seedFor(journey, stage) {
  let h = 2166136261;
  for (const c of `${journey}:${stage}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export class PublicAdventure {
  // rooms: the server's islands (see server.js), which the island of each
  // stage is one of. retiredKeepMs: how long a conquered island is kept after
  // everyone leaves it. file: where the journey and stage are kept over a
  // restart, or none.
  constructor({ rooms, log = () => {}, now = () => Date.now(), retiredKeepMs = RETIRED_KEEP_MS, file = null } = {}) {
    if (!rooms) throw new Error('The public adventure island needs the server\'s islands.');
    this.rooms = rooms;
    this.log = log;
    this.now = now;
    this.retiredKeepMs = retiredKeepMs;
    this.file = file;
    // Each island as it comes and goes (set before start(), see shareTheIsle):
    // onOpen(room) for the new public island of a stage, onRetire(room) for
    // the one that stopped being it, and onGone(room) once that one is gone.
    this.onOpen = null;
    this.onRetire = null;
    this.onGone = null;
    this.stage = 0;
    // How many times round the story this is, 1 the first time.
    this.journey = 1;
    this.freed = 0;
    this.entry = null;
    this.retired = [];
    this.stopped = false;
  }

  get room() {
    return this.entry && !this.entry.room.closed ? this.entry.room : null;
  }

  // Makes the island of the stage it had got to: the one kept from before a
  // restart, with the camps freed by then, or stage 1 of the first journey.
  // Call tick() now and then (the server does, about ten times a second) for
  // the stages to follow.
  start() {
    if (this.entry) return this;
    const kept = this.readKept();
    this.open(kept?.stage ?? 1, kept?.journey ?? 1, kept?.freed ?? []);
    this.say(`Adventure Isle is up: stage ${this.stage} of ${STAGES}, journey ${this.journey} (code ${this.entry.code}).`);
    return this;
  }

  // What was kept, checked; null if nothing that makes sense is. (A file from
  // the days when the stages started over each day, or went past the last
  // chapter, has no journey: on from there, the first one.)
  readKept() {
    if (!this.file) return null;
    try {
      const kept = JSON.parse(readFileSync(this.file, 'utf8'));
      if (!Number.isInteger(kept?.stage) || kept.stage < 1) return null;
      const journey = Number.isInteger(kept.journey) && kept.journey >= 1 ? kept.journey : 1;
      if (kept.stage > STAGES) return { stage: 1, journey: journey + 1, freed: [] };
      return { stage: kept.stage, journey, freed: Array.isArray(kept.freed) ? kept.freed.filter(Number.isInteger) : [] };
    } catch (error) {
      if (error.code !== 'ENOENT') this.say(`its stage in ${this.file} could not be read (${error.message}).`);
      return null;
    }
  }

  // The journey, the stage and the camps freed, written as each of them
  // changes: a tiny file, rarely.
  keep() {
    if (!this.file) return;
    const freed = this.entry ? this.entry.room.adventure.camps.filter((c) => c.freed).map((c) => c.id) : [];
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, `${JSON.stringify({ journey: this.journey, stage: this.stage, freed })}\n`);
      renameSync(`${this.file}.tmp`, this.file);
    } catch (error) {
      this.say(`its stage could not be kept (${error.message}).`);
    }
  }

  // A new stage in place of the current island: that one is retired — left
  // open a while for whoever is on it — and this island of the new stage is
  // the public one from here on. freed: the camps freed on it already (those
  // kept over a restart), freed again now, with nobody there to see.
  open(stage, journey, freed = []) {
    this.stage = stage;
    this.journey = journey;
    const code = this.freeCode();
    // Each stage is a chapter of the isle's story, with its own map (the
    // room makes it: shared/isle-maps.js).
    const chapter = chapterOf(stage);
    const room = new Room({
      code,
      theme: chapter.theme,
      name: PUBLIC_ISLAND_NAME,
      adventure: true,
      stage,
      journey,
      shared: true,
      seed: seedFor(journey, stage),
      settings: chapter.day ? { day: chapter.day } : null,
      log: (error) => this.log(`Adventure Isle: a mistake on stage ${stage}: ${error?.message ?? error}`),
    });
    room.public = true;
    for (const id of freed) {
      const camp = room.adventure.campById(id);
      if (camp?.kind === 'camp' && !camp.freed) room.campFreed(room.adventure.free(camp, [], room.monsters));
    }
    this.entry = { code, room, emptySince: 0, public: true };
    this.freed = room.adventure.camps.filter((c) => c.freed).length;
    this.keep();
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

  // Moves the public island on: won, to the next stage — and the last stage
  // won, the story told, back to stage 1 on a new journey.
  tick(now = this.now()) {
    if (this.stopped || !this.entry) return;
    this.sweep(now);
    if (this.entry.room.closed) {
      // Gone by itself (the server shutting down): never while ticking.
      this.retire(now, '');
      this.open(this.stage, this.journey);
      return;
    }
    const adv = this.entry.room.adventure;
    if (adv?.won) {
      // The next stage's island first, so everyone on this one can be told
      // where it is: their pages fly them on there by themselves (ui.js).
      const done = this.entry;
      const last = this.stage >= STAGES;
      this.open(last ? 1 : this.stage + 1, last ? this.journey + 1 : this.journey);
      const next = { code: this.entry.code, stage: this.stage };
      if (last) {
        this.retire(now, `The Star of ${PUBLIC_ISLAND_NAME} shines again! 🌟 A new journey starts from stage 1 — come along when you are ready!`, done, next);
        this.say(`the last stage conquered; journey ${this.journey} starts at stage 1 (code ${next.code}).`);
      } else {
        this.retire(now, `On to stage ${next.stage}! 🌟 Off you all go there in a moment — come and conquer it together!`, done, next);
        this.say(`stage ${next.stage - 1} conquered; stage ${next.stage} is up (code ${next.code}).`);
      }
      return;
    }
    // A camp freed since last time: kept, so a restart does not take it back.
    const freed = adv ? adv.camps.filter((c) => c.freed).length : 0;
    if (freed !== this.freed) {
      this.freed = freed;
      this.keep();
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
    // Anyone coming to it from here on (a page reconnecting) is told too.
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
  // A stage won: off the list at once, but whoever is on it stays on it, peer
  // to peer too, until it goes — to see the fireworks and to be told where the
  // next stage is.
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
